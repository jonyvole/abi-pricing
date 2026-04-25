// Diagnostic endpoint — no writes. Use this to verify deployment state.
// GET /api/_debug
import { json, safe } from "./_shared.js";

export const onRequestGet = safe(async ({ env }) => {
  const out = {
    kv_bound: !!(env && env.PRICING_KV),
    admin_password_set: !!(env && env.ADMIN_PASSWORD),
    runtime: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? "has-crypto" : "no-crypto",
    can_read_kv: false,
    can_write_kv: false,
    seeded_flag: null,
    write_error: null,
  };
  if (out.kv_bound) {
    try {
      const v = await env.PRICING_KV.get("seeded", { type: "text" });
      out.can_read_kv = true;
      out.seeded_flag = v;
    } catch (e) {
      out.write_error = "READ failed: " + (e && e.message ? e.message : String(e));
    }
    try {
      const probeKey = "_debug_probe";
      const probeVal = "ok-" + Date.now();
      await env.PRICING_KV.put(probeKey, probeVal);
      const back = await env.PRICING_KV.get(probeKey, { type: "text" });
      out.can_write_kv = back === probeVal;
    } catch (e) {
      out.write_error = "WRITE failed: " + (e && e.stack ? e.stack : (e && e.message ? e.message : String(e)));
    }
  }
  return json(out);
});
