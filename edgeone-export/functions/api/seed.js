import { json, corsPreflight, ensureSeeded } from "./_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export async function onRequestGet({ env }) {
  const did = await ensureSeeded(env);
  return json({ seeded: did, message: did ? "Seeded default categories" : "Already seeded" });
}
