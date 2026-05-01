import { json, corsPreflight, readAll, ensureSeeded, safe, compareSnapshotDates } from "../_shared.js";

export async function onRequestOptions() { return corsPreflight(); }

export const onRequestGet = safe(async ({ env, params }) => {
  await ensureSeeded(env);
  const categoryId = params && params.id;
  const { items, prices } = await readAll(env);
  const catItems = items.filter((it) => it.category_id === categoryId);
  if (catItems.length === 0) return json({ items: [], rows: [] });
  const itemIds = new Set(catItems.map((it) => it.id));
  const dateMap = new Map();
  for (const p of prices) {
    if (!itemIds.has(p.item_id)) continue;
    let row = dateMap.get(p.date);
    if (!row) { row = { date: p.date }; dateMap.set(p.date, row); }
    row[p.item_id] = p.price;
  }
  const rows = Array.from(dateMap.values()).sort((a, b) => compareSnapshotDates(a.date, b.date));
  return json({ items: catItems, rows });
});
