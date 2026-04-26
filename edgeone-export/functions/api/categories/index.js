import { json, corsPreflight, readList, writeList, requireAdmin, uuid, slugify, nowIso, ensureSeeded, STORE_KEYS, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ env }) => {
  await ensureSeeded(env);
  const list = await readList(env, STORE_KEYS.CATEGORIES);
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return json(list);
});

export const onRequestPost = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const name = ((body && body.name) || "").trim();
  if (!name) return json({ detail: "Name required" }, 400);
  const order = Number.isFinite(body && body.order) ? body.order : 0;
  const list = await readList(env, STORE_KEYS.CATEGORIES);
  const cat = { id: uuid(), name, slug: slugify(name), order, created_at: nowIso() };
  list.push(cat);
  await writeList(env, STORE_KEYS.CATEGORIES, list);
  return json(cat);
});
