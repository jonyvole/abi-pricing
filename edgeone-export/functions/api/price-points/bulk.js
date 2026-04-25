import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, KV_KEYS, safe } from "../_shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, date, prices: priceMap } = body || {};
  if (!category_id || !date) return json({ detail: "category_id and date required" }, 400);
  if (!DATE_RE.test(date)) return json({ detail: "Invalid date format, use YYYY-MM-DD" }, 400);
  if (!priceMap || typeof priceMap !== "object") return json({ detail: "prices object required" }, 400);

  const [items, prices] = await Promise.all([
    readList(env, KV_KEYS.ITEMS),
    readList(env, KV_KEYS.PRICES),
  ]);
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const created = [];
  for (const [itemId, rawPrice] of Object.entries(priceMap)) {
    if (rawPrice === "" || rawPrice == null) continue;
    const num = Number(rawPrice);
    if (!Number.isFinite(num)) continue;
    if (!itemMap.has(itemId)) continue;
    const idx = prices.findIndex((p) => p.item_id === itemId && p.date === date);
    if (idx >= 0) {
      prices[idx] = { ...prices[idx], price: num };
      created.push(prices[idx]);
    } else {
      const entry = { id: uuid(), item_id: itemId, date, price: num, created_at: nowIso() };
      prices.push(entry);
      created.push(entry);
    }
  }
  await writeList(env, KV_KEYS.PRICES, prices);
  return json({ created: created.length, items: created });
});
