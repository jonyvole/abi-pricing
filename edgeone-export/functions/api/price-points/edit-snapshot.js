import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, safe } from "../_shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, old_date, new_date, prices: priceMap } = body || {};
  if (!category_id || !old_date || !new_date) {
    return json({ detail: "category_id, old_date and new_date required" }, 400);
  }
  if (!DATE_RE.test(old_date) || !DATE_RE.test(new_date)) {
    return json({ detail: "Invalid date format, use YYYY-MM-DD" }, 400);
  }
  if (!priceMap || typeof priceMap !== "object") {
    return json({ detail: "prices object required" }, 400);
  }
  const [items, prices] = await Promise.all([
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
  ]);
  const validIds = new Set(items.filter((it) => it.category_id === category_id).map((it) => it.id));
  let next = prices.slice();
  let affected = 0;
  for (const [itemId, raw] of Object.entries(priceMap)) {
    if (!validIds.has(itemId)) continue;
    // Always strip the old_date entry first
    next = next.filter((p) => !(p.item_id === itemId && p.date === old_date));
    // Empty / null -> just removed (already done)
    if (raw === "" || raw == null) { affected += 1; continue; }
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    // Remove any existing entry at new_date for this item, then insert fresh
    next = next.filter((p) => !(p.item_id === itemId && p.date === new_date));
    next.push({ id: uuid(), item_id: itemId, date: new_date, price: num, created_at: nowIso() });
    affected += 1;
  }
  await writeList(env, STORE_KEYS.PRICES, next);
  return json({ affected, old_date, new_date });
});
