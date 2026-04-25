import { json, corsPreflight, readList, writeList, requireAdmin, KV_KEYS } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export async function onRequestDelete({ request, env, params }) {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const id = params.id;
  const prices = await readList(env, KV_KEYS.PRICES);
  const before = prices.length;
  const next = prices.filter((p) => p.id !== id);
  if (next.length === before) return json({ detail: "Not found" }, 404);
  await writeList(env, KV_KEYS.PRICES, next);
  return json({ ok: true });
}
