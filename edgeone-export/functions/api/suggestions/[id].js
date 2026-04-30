import { json, corsPreflight, readList, writeList, requireAdmin, nowIso, STORE_KEYS, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPatch = safe(async ({ request, env, params }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const id = params && params.id;
  if (!id) return json({ detail: "id required" }, 400);

  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const markRead = body && body.read === true;
  const markUnread = body && body.read === false;
  if (!markRead && !markUnread) {
    return json({ detail: "Provide read: true or read: false" }, 400);
  }

  const list = await readList(env, STORE_KEYS.SUGGESTIONS);
  const idx = list.findIndex((it) => it.id === id);
  if (idx < 0) return json({ detail: "Not found" }, 404);

  list[idx] = {
    ...list[idx],
    status: markRead ? "read" : "new",
    read_at: markRead ? nowIso() : null,
  };
  await writeList(env, STORE_KEYS.SUGGESTIONS, list);
  return json({ ok: true, item: list[idx] });
});

export const onRequestDelete = safe(async ({ request, env, params }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const id = params && params.id;
  if (!id) return json({ detail: "id required" }, 400);

  const list = await readList(env, STORE_KEYS.SUGGESTIONS);
  const next = list.filter((it) => it.id !== id);
  if (next.length === list.length) return json({ detail: "Not found" }, 404);
  await writeList(env, STORE_KEYS.SUGGESTIONS, next);
  return json({ ok: true });
});

