import { json, corsPreflight, requireAdmin, safe, readJson, writeJson, touchLastEdited, nowIso, STORE_KEYS } from "./_shared.js";

const DEFAULT_SETTINGS = {
  footer_title: "ABI Pricing Through Time",
  footer_text_before: "Track in-game prices. Stay informed. Use creator code ",
  footer_link_label: "JonyVole",
  footer_link_url: "https://www.arenabreakoutinfinite.com/creatorcode/index.html?codeid=JonyVole",
  footer_text_after: ".",
};

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ env }) => {
  const stored = await readJson(env, STORE_KEYS.SETTINGS);
  return json({ ...DEFAULT_SETTINGS, ...(stored || {}) });
});

export const onRequestPut = safe(async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  const merged = {
    footer_title: String(body.footer_title ?? DEFAULT_SETTINGS.footer_title),
    footer_text_before: String(body.footer_text_before ?? DEFAULT_SETTINGS.footer_text_before),
    footer_link_label: String(body.footer_link_label ?? DEFAULT_SETTINGS.footer_link_label),
    footer_link_url: String(body.footer_link_url ?? DEFAULT_SETTINGS.footer_link_url),
    footer_text_after: String(body.footer_text_after ?? DEFAULT_SETTINGS.footer_text_after),
    updated_at: nowIso(),
  };
  await writeJson(env, STORE_KEYS.SETTINGS, merged);
  await touchLastEdited(env);
  return json(merged);
});

// Fallback: some EdgeOne setups don't dispatch PUT to onRequestPut.
export const onRequest = safe(async (ctx) => {
  const m = ctx.request.method.toUpperCase();
  if (m === "OPTIONS") return corsPreflight();
  if (m === "GET") return onRequestGet(ctx);
  if (m === "PUT" || m === "POST") return onRequestPut(ctx);
  return json({ detail: `Method ${m} not allowed` }, 405);
});
