// Shared helpers for EdgeOne Pages Edge Functions.
// Storage backend: Upstash Redis (REST API).
// Required env vars on the EdgeOne project:
//   UPSTASH_REDIS_URL   -> https://<region>-<name>-<id>.upstash.io
//   UPSTASH_REDIS_TOKEN -> the REST token from your Upstash console
//   ADMIN_PASSWORD      -> the password for /admin

export const DEFAULT_CATEGORIES = [
  "Helmets", "Masks", "Body Armour", "Unarmoured Chest Rigs",
  "Backpacks", "Headsets", "Tier 3 Ammo", "Tier 4 Ammo",
  "Tier 5 Ammo", "Grenades",
];

export const DEFAULT_ITEMS = {
  "Helmets": [
    ["MICH 2000", "#FFB300"],
    ["LShZ-2DTM", "#4CAF50"],
    ["Altyn", "#FF3B30"],
    ["Maska-1Sch", "#3DA9FC"],
  ],
  "Tier 5 Ammo": [
    ["7.62x39 BP", "#FFB300"],
    ["5.45x39 7N39", "#4CAF50"],
    ["12.7x55 PS12B", "#FF3B30"],
  ],
};

export const SAMPLE_DATES = [
  "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01",
];

export const STORE_KEYS = {
  CATEGORIES: "abi:categories",
  ITEMS: "abi:items",
  PRICES: "abi:prices",
  SETTINGS: "abi:settings",
  LAST_EDITED: "abi:last_edited",
  SEEDED: "abi:seeded",
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export function safe(handler) {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (e) {
      const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
      return json({
        detail: "Edge function exception",
        error: msg.slice(0, 2000),
        upstash_url_set: !!(ctx && ctx.env && ctx.env.UPSTASH_REDIS_URL),
        upstash_token_set: !!(ctx && ctx.env && ctx.env.UPSTASH_REDIS_TOKEN),
        admin_set: !!(ctx && ctx.env && ctx.env.ADMIN_PASSWORD),
      }, 500);
    }
  };
}

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nowIso() {
  return new Date().toISOString();
}

// ---- Upstash Redis REST helpers ----
async function redisCmd(env, cmd) {
  const url = env && env.UPSTASH_REDIS_URL;
  const token = env && env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN env vars not set");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Upstash ${res.status}: ${txt.slice(0, 300)}`);
  }
  let body;
  try { body = JSON.parse(txt); } catch { throw new Error(`Upstash bad JSON: ${txt.slice(0, 200)}`); }
  if (body && body.error) throw new Error(`Upstash error: ${body.error}`);
  return body ? body.result : null;
}

async function redisGet(env, key) {
  return await redisCmd(env, ["GET", key]);
}

async function redisSet(env, key, value) {
  return await redisCmd(env, ["SET", key, value]);
}

// ---- High-level helpers used by all routes ----
export async function readList(env, key) {
  const raw = await redisGet(env, key);
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeList(env, key, list) {
  await redisSet(env, key, JSON.stringify(list));
}

export async function readJson(env, key) {
  const raw = await redisGet(env, key);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function writeJson(env, key, value) {
  await redisSet(env, key, JSON.stringify(value));
}

export async function touchLastEdited(env, iso = nowIso()) {
  await writeJson(env, STORE_KEYS.LAST_EDITED, { timestamp: iso });
  return iso;
}

export async function readAll(env) {
  const [categories, items, prices] = await Promise.all([
    readList(env, STORE_KEYS.CATEGORIES),
    readList(env, STORE_KEYS.ITEMS),
    readList(env, STORE_KEYS.PRICES),
  ]);
  return { categories, items, prices };
}

// ---- Auth ----
export function requireAdmin(request, env) {
  const adminPwd = (env && env.ADMIN_PASSWORD) || "";
  const token = request.headers.get("X-Admin-Token") || "";
  if (!adminPwd) {
    return json({ detail: "ADMIN_PASSWORD env var not set on the EdgeOne project" }, 500);
  }
  if (token !== adminPwd) {
    return json({ detail: "Unauthorized" }, 401);
  }
  return null;
}

// ---- Seed ----
export async function ensureSeeded(env) {
  const seeded = await redisGet(env, STORE_KEYS.SEEDED);
  if (seeded === "1") return false;
  const existing = await readList(env, STORE_KEYS.CATEGORIES);
  if (existing.length > 0) {
    await redisSet(env, STORE_KEYS.SEEDED, "1");
    return false;
  }
  const categories = [];
  const items = [];
  const prices = [];
  DEFAULT_CATEGORIES.forEach((name, i) => {
    const cat = { id: uuid(), name, slug: slugify(name), order: i, created_at: nowIso() };
    categories.push(cat);
    const list = DEFAULT_ITEMS[name] || [];
    list.forEach(([itemName, color], j) => {
      const item = { id: uuid(), category_id: cat.id, name: itemName, color, created_at: nowIso() };
      items.push(item);
      const base = 1000 * (j + 1);
      SAMPLE_DATES.forEach((d, k) => {
        prices.push({
          id: uuid(),
          item_id: item.id,
          date: d,
          price: base + k * 200 + j * 50,
          created_at: nowIso(),
        });
      });
    });
  });
  await Promise.all([
    writeList(env, STORE_KEYS.CATEGORIES, categories),
    writeList(env, STORE_KEYS.ITEMS, items),
    writeList(env, STORE_KEYS.PRICES, prices),
  ]);
  await redisSet(env, STORE_KEYS.SEEDED, "1");
  return true;
}
