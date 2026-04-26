import { json, corsPreflight, readList, writeList, requireAdmin, STORE_KEYS, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, date } = body || {};
  if (!category_id || !date) return json({ detail: "category_id and date required" }, 400);
  const [items, prices] = await Promise.all([
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
  ]);
  const validIds = new Set(items.filter((it) => it.category_id === category_id).map((it) => it.id));
  const before = prices.length;
  const next = prices.filter((p) => !(validIds.has(p.item_id) && p.date === date));
  await writeList(env, STORE_KEYS.PRICES, next);
  return json({ deleted: before - next.length });
});
