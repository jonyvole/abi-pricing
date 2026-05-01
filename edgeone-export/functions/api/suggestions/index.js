import { json, corsPreflight, readList, writeList, readJson, writeJson, requireAdmin, uuid, nowIso, STORE_KEYS, safe } from "../_shared.js";

const COOLDOWN_SECONDS = 60;

function hashIp(rawIp) {
  const ip = String(rawIp || "unknown");
  let h = 2166136261;
  for (let i = 0; i < ip.length; i += 1) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "ip_" + (h >>> 0).toString(16);
}

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const list = await readList(env, STORE_KEYS.SUGGESTIONS);
  list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return json(list);
});

export const onRequestPost = safe(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const text = String((body && body.text) || "").trim();
  const name = String((body && body.name) || "").trim();
  const contact = String((body && body.contact) || "").trim();
  if (!text) return json({ detail: "Suggestion text required" }, 400);
  if (text.length > 1000) return json({ detail: "Suggestion too long (max 1000 chars)" }, 400);
  if (name.length > 120) return json({ detail: "Name too long (max 120 chars)" }, 400);
  if (contact.length > 200) return json({ detail: "Contact too long (max 200 chars)" }, 400);

  const ipHash = hashIp(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For"));
  const nowMs = Date.now();
  const rateMap = (await readJson(env, STORE_KEYS.SUGGESTION_RATE_LIMIT)) || {};
  const nextAllowed = Number(rateMap[ipHash] || 0);
  if (nextAllowed > nowMs) {
    const retryAfter = Math.ceil((nextAllowed - nowMs) / 1000);
    return json({ detail: "Please wait before sending another suggestion.", retry_after_seconds: retryAfter }, 429);
  }

  const list = await readList(env, STORE_KEYS.SUGGESTIONS);
  const entry = {
    id: uuid(),
    text,
    name: name || null,
    contact: contact || null,
    ip_hash: ipHash,
    status: "new",
    created_at: nowIso(),
    read_at: null,
  };
  list.push(entry);
  await writeList(env, STORE_KEYS.SUGGESTIONS, list);
  rateMap[ipHash] = nowMs + COOLDOWN_SECONDS * 1000;
  await writeJson(env, STORE_KEYS.SUGGESTION_RATE_LIMIT, rateMap);
  return json({ ok: true, id: entry.id }, 201);
});

