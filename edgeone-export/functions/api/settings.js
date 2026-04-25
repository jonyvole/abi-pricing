import { json, corsPreflight, requireAdmin } from "./_shared.js";

const DEFAULT_SETTINGS = {
  footer_title: "ABI Pricing Through Time",
  footer_text_before: "Track in-game prices. Stay informed. Use creator code ",
  footer_link_label: "JonyVole",
  footer_link_url: "https://www.arenabreakoutinfinite.com/creatorcode/index.html?codeid=JonyVole",
  footer_text_after: ".",
};

const KEY = "settings";

export async function onRequestOptions() { return corsPreflight(); }

export async function onRequestGet({ env }) {
  if (!env || !env.PRICING_KV) return json(DEFAULT_SETTINGS);
  const stored = await env.PRICING_KV.get(KEY, { type: "json" });
  return json({ ...DEFAULT_SETTINGS, ...(stored || {}) });
}

export async function onRequestPut({ request, env }) {
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
  };
  await env.PRICING_KV.put(KEY, JSON.stringify(merged));
  return json(merged);
}
