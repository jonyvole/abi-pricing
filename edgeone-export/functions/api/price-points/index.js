import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, safe } from "../_shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ request, env }) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id");
  const all = await readList(env, STORE_KEYS.PRICES);
  const filtered = itemId ? all.filter((p) => p.item_id === itemId) : all;
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  return json(filtered);
});

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { item_id, date, price } = body || {};
  if (!item_id || !date) return json({ detail: "item_id and date required" }, 400);
  if (!DATE_RE.test(date)) return json({ detail: "Invalid date format, use YYYY-MM-DD" }, 400);
  const items = await readList(env, STORE_KEYS.ITEMS);
  if (!items.find((it) => it.id === item_id)) return json({ detail: "Item not found" }, 404);
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum)) return json({ detail: "price must be a number" }, 400);
  const prices = await readList(env, STORE_KEYS.PRICES);
  const idx = prices.findIndex((p) => p.item_id === item_id && p.date === date);
  let entry;
  if (idx >= 0) {
    prices[idx] = { ...prices[idx], price: priceNum };
    entry = prices[idx];
  } else {
    entry = { id: uuid(), item_id, date, price: priceNum, created_at: nowIso() };
    prices.push(entry);
  }
  await writeList(env, STORE_KEYS.PRICES, prices);
  return json(entry);
});
