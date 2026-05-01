import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, touchLastEdited, safe, normalizeSnapshotDateInput } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, old_date, new_date, new_time, new_timezone, prices: priceMap } = body || {};
  if (!category_id || !old_date || !new_date) {
    return json({ detail: "category_id, old_date and new_date required" }, 400);
  }
  if (!priceMap || typeof priceMap !== "object") {
    return json({ detail: "prices object required" }, 400);
  }
  const normalizedNewDate = normalizeSnapshotDateInput(new_date, new Date(), { time: new_time, timezone: new_timezone });
  if (!normalizedNewDate) return json({ detail: "Invalid new snapshot date" }, 400);
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
    next = next.filter((p) => !(p.item_id === itemId && p.date === normalizedNewDate));
    next.push({ id: uuid(), item_id: itemId, date: normalizedNewDate, price: num, created_at: nowIso() });
    affected += 1;
  }
  await writeList(env, STORE_KEYS.PRICES, next);
  await touchLastEdited(env);
  return json({ affected, old_date, new_date: normalizedNewDate });
});
