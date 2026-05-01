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
  SUGGESTIONS: "abi:suggestions",
  SUGGESTION_RATE_LIMIT: "abi:suggestion_rate_limit",
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

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SNAPSHOT_LABEL_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})(?::(00|30))?(am|pm)\s+(UTC[+-]\d{2}:\d{2})$/i;
const TIME_INPUT_RE = /^(\d{1,2})(?::(00|30))?(am|pm)$/i;
const TIMEZONE_INPUT_RE = /^UTC[+-]\d{2}:\d{2}$/i;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function roundToHalfHour(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  if (minutes < 15) d.setMinutes(0);
  else if (minutes < 45) d.setMinutes(30);
  else {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  }
  return d;
}

function timezoneLabel(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = pad2(Math.floor(abs / 60));
  const mm = pad2(abs % 60);
  return `UTC${sign}${hh}:${mm}`;
}

function timeLabel(date) {
  const rawHours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = rawHours >= 12 ? "pm" : "am";
  const hour12 = rawHours % 12 || 12;
  return minutes === 0 ? `${hour12}${ampm}` : `${hour12}:${pad2(minutes)}${ampm}`;
}

function parseDateOnlyLocal(dateOnly) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function formatSnapshotDateLabel(dateOnly, now = new Date()) {
  const rounded = roundToHalfHour(now);
  return `${dateOnly} ${timeLabel(rounded)} ${timezoneLabel(rounded)}`;
}

function normalizeManualTime(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const m = value.match(TIME_INPUT_RE);
  if (!m) return "";
  const hour = Number(m[1]);
  if (hour < 1 || hour > 12) return "";
  const minutes = m[2] || "00";
  const suffix = m[3].toLowerCase();
  return minutes === "00" ? `${hour}${suffix}` : `${hour}:${minutes}${suffix}`;
}

function normalizeManualTimezone(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (!TIMEZONE_INPUT_RE.test(value)) return "";
  const m = value.match(/^UTC([+-])(\d{2}):(\d{2})$/i);
  if (!m) return "";
  const sign = m[1];
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (hh > 14 || mm > 59) return "";
  return `UTC${sign}${pad2(hh)}:${pad2(mm)}`;
}

export function normalizeSnapshotDateInput(input, now = new Date(), options = {}) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (DATE_ONLY_RE.test(value)) {
    const manualTime = normalizeManualTime(options && options.time);
    const manualTimezone = normalizeManualTimezone(options && options.timezone);
    if (manualTime && manualTimezone) return `${value} ${manualTime} ${manualTimezone}`;
    return formatSnapshotDateLabel(value, now);
  }
  return value;
}

export function compareSnapshotDates(a, b) {
  const va = String(a || "").trim();
  const vb = String(b || "").trim();
  if (va === vb) return 0;

  const ma = va.match(SNAPSHOT_LABEL_RE);
  const mb = vb.match(SNAPSHOT_LABEL_RE);
  if (ma && mb) {
    const [_, dateA, hA, mA = "00", apA] = ma;
    const [__, dateB, hB, mB = "00", apB] = mb;
    const toMinuteOfDay = (h, m, ap) => {
      let hh = Number(h) % 12;
      if (String(ap).toLowerCase() === "pm") hh += 12;
      return hh * 60 + Number(m);
    };
    const d = dateA.localeCompare(dateB);
    if (d !== 0) return d;
    return toMinuteOfDay(hA, mA, apA) - toMinuteOfDay(hB, mB, apB);
  }

  if (DATE_ONLY_RE.test(va) && DATE_ONLY_RE.test(vb)) {
    return va.localeCompare(vb);
  }

  if (DATE_ONLY_RE.test(va) && mb) {
    const dateCmp = va.localeCompare(mb[1]);
    if (dateCmp !== 0) return dateCmp;
    return -1;
  }
  if (ma && DATE_ONLY_RE.test(vb)) {
    const dateCmp = ma[1].localeCompare(vb);
    if (dateCmp !== 0) return dateCmp;
    return 1;
  }

  const da = Date.parse(va);
  const db = Date.parse(vb);
  if (Number.isFinite(da) && Number.isFinite(db)) return da - db;

  if (DATE_ONLY_RE.test(va)) return parseDateOnlyLocal(va).getTime() - (Number.isFinite(db) ? db : 0);
  if (DATE_ONLY_RE.test(vb)) return (Number.isFinite(da) ? da : 0) - parseDateOnlyLocal(vb).getTime();

  return va.localeCompare(vb);
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
