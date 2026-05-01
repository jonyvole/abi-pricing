import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, touchLastEdited, safe, normalizeSnapshotDateInput } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, date, time, timezone, prices: priceMap } = body || {};
  if (!category_id || !date) return json({ detail: "category_id and date required" }, 400);
  const snapshotDate = normalizeSnapshotDateInput(date, new Date(), { time, timezone });
  if (!snapshotDate) return json({ detail: "Invalid snapshot date" }, 400);
  if (!priceMap || typeof priceMap !== "object") return json({ detail: "prices object required" }, 400);

  const [items, prices] = await Promise.all([
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
  ]);
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const created = [];
  for (const [itemId, rawPrice] of Object.entries(priceMap)) {
    if (rawPrice === "" || rawPrice == null) continue;
    const num = Number(rawPrice);
    if (!Number.isFinite(num)) continue;
    if (!itemMap.has(itemId)) continue;
    const idx = prices.findIndex((p) => p.item_id === itemId && p.date === snapshotDate);
    if (idx >= 0) {
      prices[idx] = { ...prices[idx], price: num, updated_at: nowIso() };
      created.push(prices[idx]);
    } else {
      const entry = { id: uuid(), item_id: itemId, date: snapshotDate, price: num, created_at: nowIso() };
      prices.push(entry);
      created.push(entry);
    }
  }
  await writeList(env, STORE_KEYS.PRICES, prices);
  await touchLastEdited(env);
  return json({ created: created.length, items: created });
});
