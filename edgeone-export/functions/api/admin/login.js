import { json, corsPreflight, safe } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestPost = safe(async ({ request, env }) => {
  const adminPwd = (env && env.ADMIN_PASSWORD) || "";
  if (!adminPwd) return json({ detail: "ADMIN_PASSWORD env var not set" }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
  if (!body || body.password !== adminPwd) return json({ detail: "Invalid password" }, 401);
  return json({ token: adminPwd });
});
