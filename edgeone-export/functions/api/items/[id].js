import { json, corsPreflight, readList, writeList, requireAdmin, STORE_KEYS, touchLastEdited, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestDelete = safe(async ({ request, env, params }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const id = params && params.id;
  const [items, prices] = await Promise.all([
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
  ]);
  const item = items.find((it) => it.id === id);
  if (!item) return json({ detail: "Not found" }, 404);
  const newItems = items.filter((it) => it.id !== id);
  const newPrices = prices.filter((p) => p.item_id !== id);
  await Promise.all([
    writeList(env, STORE_KEYS.ITEMS, newItems),
    writeList(env, STORE_KEYS.PRICES, newPrices),
  ]);
  await touchLastEdited(env);
  return json({ ok: true });
});
