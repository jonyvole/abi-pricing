import { json, corsPreflight, readJson, readList, STORE_KEYS, safe } from "./_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

function toMillis(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export const onRequestGet = safe(async ({ env }) => {
  const stored = await readJson(env, STORE_KEYS.LAST_EDITED);
  if (stored && typeof stored.timestamp === "string") {
    return json({ last_edited_at: stored.timestamp });
  }

  const [categories, items, prices, settings] = await Promise.all([
    readList(env, STORE_KEYS.CATEGORIES),
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
    readJson(env, STORE_KEYS.SETTINGS),
  ]);

  let latestMs = null;
  const consider = (iso) => {
    const ms = toMillis(iso);
    if (ms == null) return;
    if (latestMs == null || ms > latestMs) latestMs = ms;
  };

  for (const row of categories) consider(row && (row.updated_at || row.created_at));
  for (const row of items) consider(row && (row.updated_at || row.created_at));
  for (const row of prices) consider(row && (row.updated_at || row.created_at));
  consider(settings && settings.updated_at);

  return json({
    last_edited_at: latestMs == null ? null : new Date(latestMs).toISOString(),
  });
});
