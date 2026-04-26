import { json, corsPreflight, readList, writeList, requireAdmin, uuid, nowIso, STORE_KEYS, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ request, env }) => {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category_id");
  const all = await readList(env, STORE_KEYS.ITEMS);
  const filtered = categoryId ? all.filter((it) => it.category_id === categoryId) : all;
  return json(filtered);
});

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const { category_id, name, color } = body || {};
  if (!category_id || !name) return json({ detail: "category_id and name required" }, 400);
  const cats = await readList(env, STORE_KEYS.CATEGORIES);
  if (!cats.find((c) => c.id === category_id)) return json({ detail: "Category not found" }, 404);
  const items = await readList(env, STORE_KEYS.ITEMS);
  const item = { id: uuid(), category_id, name: String(name).trim(), color: color || null, created_at: nowIso() };
  items.push(item);
  await writeList(env, STORE_KEYS.ITEMS, items);
  return json(item);
});
