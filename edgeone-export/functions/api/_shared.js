// Shared helpers for EdgeOne Pages Edge Functions
// This file is NOT routed (filename starts with underscore).

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

export const KV_KEYS = {
  CATEGORIES: "categories",
  ITEMS: "items",
  PRICES: "prices",
  SEEDED: "seeded",
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

// Wrap a handler so any thrown exception is returned as JSON instead of 545.
export function safe(handler) {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (e) {
      const msg = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
      return json({
        detail: "Edge function exception",
        error: msg.slice(0, 2000),
        kv_bound: !!(ctx && ctx.env && ctx.env.PRICING_KV),
        admin_set: !!(ctx && ctx.env && ctx.env.ADMIN_PASSWORD),
      }, 500);
    }
  };
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
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

// ---- KV helpers (KV namespace bound as env.PRICING_KV) ----
function getKV(env) {
  if (!env || !env.PRICING_KV) {
    throw new Error("KV namespace 'PRICING_KV' not bound. Bind it in EdgeOne Pages → Function Management → Namespace bindings.");
  }
  return env.PRICING_KV;
}

export async function readList(env, key) {
  const kv = getKV(env);
  const raw = await kv.get(key, { type: "json" });
  return Array.isArray(raw) ? raw : [];
}

export async function writeList(env, key, list) {
  const kv = getKV(env);
  await kv.put(key, JSON.stringify(list));
}

export async function readAll(env) {
  const [categories, items, prices] = await Promise.all([
    readList(env, KV_KEYS.CATEGORIES),
    readList(env, KV_KEYS.ITEMS),
    readList(env, KV_KEYS.PRICES),
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
  const kv = getKV(env);
  const seeded = await kv.get(KV_KEYS.SEEDED, { type: "text" });
  if (seeded === "1") return false;
  const existing = await readList(env, KV_KEYS.CATEGORIES);
  if (existing.length > 0) {
    await kv.put(KV_KEYS.SEEDED, "1");
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
    writeList(env, KV_KEYS.CATEGORIES, categories),
    writeList(env, KV_KEYS.ITEMS, items),
    writeList(env, KV_KEYS.PRICES, prices),
  ]);
  await kv.put(KV_KEYS.SEEDED, "1");
  return true;
}
