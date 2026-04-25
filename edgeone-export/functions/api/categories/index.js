import { json, corsPreflight, readList, writeList, requireAdmin, uuid, slugify, nowIso, ensureSeeded, KV_KEYS } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export async function onRequestGet({ env }) {
  await ensureSeeded(env);
  const list = await readList(env, KV_KEYS.CATEGORIES);
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return json(list);
}

export async function onRequestPost({ request, env }) {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const name = (body && body.name || "").trim();
  if (!name) return json({ detail: "Name required" }, 400);
  const order = Number.isFinite(body.order) ? body.order : 0;
  const list = await readList(env, KV_KEYS.CATEGORIES);
  const cat = { id: uuid(), name, slug: slugify(name), order, created_at: nowIso() };
  list.push(cat);
  await writeList(env, KV_KEYS.CATEGORIES, list);
  return json(cat);
}
