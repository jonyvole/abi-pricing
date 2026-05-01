import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, touchLastEdited, safe, normalizeSnapshotDateInput, compareSnapshotDates } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ request, env }) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id");
  const all = await readList(env, STORE_KEYS.PRICES);
  const filtered = itemId ? all.filter((p) => p.item_id === itemId) : all;
  filtered.sort((a, b) => compareSnapshotDates(a.date, b.date));
  return json(filtered);
});

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { item_id, date, price } = body || {};
  if (!item_id || !date) return json({ detail: "item_id and date required" }, 400);
  const snapshotDate = normalizeSnapshotDateInput(date);
  if (!snapshotDate) return json({ detail: "Invalid snapshot date" }, 400);
  const items = await readList(env, STORE_KEYS.ITEMS);
  if (!items.find((it) => it.id === item_id)) return json({ detail: "Item not found" }, 404);
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum)) return json({ detail: "price must be a number" }, 400);
  const prices = await readList(env, STORE_KEYS.PRICES);
  let idx = prices.findIndex((p) => p.item_id === item_id && p.date === snapshotDate);
  if (idx < 0 && snapshotDate !== date) {
    idx = prices.findIndex((p) => p.item_id === item_id && p.date === date);
  }
  let entry;
  if (idx >= 0) {
    prices[idx] = { ...prices[idx], price: priceNum, updated_at: nowIso() };
    entry = prices[idx];
  } else {
    entry = { id: uuid(), item_id, date: snapshotDate, price: priceNum, created_at: nowIso() };
    prices.push(entry);
  }
  await writeList(env, STORE_KEYS.PRICES, prices);
  await touchLastEdited(env);
  return json(entry);
});
