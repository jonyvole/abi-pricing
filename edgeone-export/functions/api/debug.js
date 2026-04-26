// Diagnostic endpoint — verifies Upstash Redis connectivity. No auth required.
// GET /api/debug
import { json, safe } from "./_shared.js";

export const onRequestGet = safe(async ({ env }) => {
  const out = {
    upstash_url_set: !!(env && env.UPSTASH_REDIS_URL),
    upstash_token_set: !!(env && env.UPSTASH_REDIS_TOKEN),
    admin_password_set: !!(env && env.ADMIN_PASSWORD),
    runtime_has_crypto: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function",
    can_read: false,
    can_write: false,
    seeded_flag: null,
    error: null,
  };
  if (!out.upstash_url_set || !out.upstash_token_set) {
    out.error = "UPSTASH_REDIS_URL and/or UPSTASH_REDIS_TOKEN env vars missing on the EdgeOne project. Add them in Settings → Environment Variables.";
    return json(out);
  }
  const headers = {
    "Authorization": `Bearer ${env.UPSTASH_REDIS_TOKEN}`,
    "Content-Type": "application/json",
  };
  // READ test
  try {
    const r = await fetch(env.UPSTASH_REDIS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(["GET", "abi:seeded"]),
    });
    const t = await r.text();
    if (!r.ok) {
      out.error = `READ ${r.status}: ${t.slice(0, 300)}`;
      return json(out);
    }
    out.can_read = true;
    try { out.seeded_flag = JSON.parse(t).result; } catch { out.seeded_flag = t.slice(0, 100); }
  } catch (e) {
    out.error = "READ exception: " + (e && e.message ? e.message : String(e));
    return json(out);
  }
  // WRITE test
  try {
    const probeVal = "ok-" + Date.now();
    const r = await fetch(env.UPSTASH_REDIS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(["SET", "abi:_debug_probe", probeVal]),
    });
    const t = await r.text();
    if (!r.ok) {
      out.error = `WRITE ${r.status}: ${t.slice(0, 300)}`;
      return json(out);
    }
    out.can_write = true;
  } catch (e) {
    out.error = "WRITE exception: " + (e && e.message ? e.message : String(e));
    return json(out);
  }
  return json(out);
});
