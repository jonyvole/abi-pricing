import { json } from "./_shared.js";

export async function onRequestGet() {
  return json({ message: "ABI Pricing API on EdgeOne Edge Functions", ok: true });
}
