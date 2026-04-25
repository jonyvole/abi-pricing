import { json, corsPreflight, readList, writeList, requireAdmin, KV_KEYS, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestDelete = safe(async ({ request, env, params }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const id = params && params.id;
  const [cats, items, prices] = await Promise.all([
    readList(env, KV_KEYS.CATEGORIES),
    readList(env, KV_KEYS.ITEMS),
    readList(env, KV_KEYS.PRICES),
  ]);
  const cat = cats.find((c) => c.id === id);
  if (!cat) return json({ detail: "Not found" }, 404);
  const itemIdsToDelete = new Set(items.filter((it) => it.category_id === id).map((it) => it.id));
  const newCats = cats.filter((c) => c.id !== id);
  const newItems = items.filter((it) => it.category_id !== id);
  const newPrices = prices.filter((p) => !itemIdsToDelete.has(p.item_id));
  await Promise.all([
    writeList(env, KV_KEYS.CATEGORIES, newCats),
    writeList(env, KV_KEYS.ITEMS, newItems),
    writeList(env, KV_KEYS.PRICES, newPrices),
  ]);
  return json({ ok: true });
});
