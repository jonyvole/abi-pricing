# ABI Pricing Through Time — PRD

## Original problem statement
> "is there a way for me to add new things to the graphs? i originally used squarespace, however my free trial expiration"

User had a Squarespace site ("ABI Pricing Through Time") tracking Arena Breakout Infinite (ABI) in-game item prices. The free trial expired. They want a fully editable replacement web app where they can add new data points / items / categories to graphs through an admin panel, and they want to preserve the JonyVole creator-code banner image.

## User personas
- **Owner / Operator (JonyVole)** — uses the admin panel to add categories, items, and price snapshots over time.
- **Public visitor** — views the dashboard, browses categories, reads charts, clicks through the JonyVole creator-code banner.

## Tech stack
- Backend: FastAPI + Motor (async MongoDB) — `/app/backend/server.py`
- Frontend: React 19 + react-router-dom + recharts + lucide-react — `/app/frontend/src/`
- DB: MongoDB collections: `categories`, `items`, `price_points`
- Theme: Tactical dark "Performance Pro" (Chivo + IBM Plex Mono + IBM Plex Sans on #08090A with #FFB300 amber accent)

## Architecture
- Public dashboard at `/` — left sidebar with categories, recharts LineChart per category, items table with last price + % change, JonyVole banner pinned top, footer.
- Admin panel at `/admin` — password-gated (X-Admin-Token = ADMIN_PASSWORD env). Three sub-modules: CategoryManager, ItemManager, PriceEditor (bulk snapshot input + history table).
- Auth: Single-operator simple password gate (ADMIN_PASSWORD in backend `.env`).

## Core requirements (static)
- Migrate from Squarespace; preserve JonyVole banner image + click-through link.
- Editable graphs: admin can add categories, items (with color), and dated price points.
- Public visitors see clean charts.

## What's been implemented (2026-04-25)
- 10 seeded categories (Helmets, Masks, Body Armour, Unarmoured Chest Rigs, Backpacks, Headsets, Tier 3/4/5 Ammo, Grenades) with sample data on Helmets and Tier 5 Ammo.
- CRUD endpoints (categories/items/price-points) with cascade deletes.
- `POST /api/price-points/bulk` for adding a full snapshot (all items in a category, one date) in one click.
- Upsert behavior on `(item_id, date)` so re-entering a price replaces.
- Admin login + logout, localStorage session, bearer header injected via axios interceptor.
- JonyVole banner component using preserved image asset (`/assets/jonyvole-banner.png` from the original Squarespace export).
- Tactical dark UI per design guidelines: Chivo headings, IBM Plex Mono prices, sharp corners, amber accent.
- Charts: line per item, custom tooltip, dashed grid, monospace ticks.
- Items legend table with last price + % change indicator.
- Backend test suite at `/app/backend/tests/backend_test.py` (8/8 passed).
- Full E2E Playwright validation passed.

## Backlog / Future
- P1: Per-item bulk paste / CSV import for fast historical data backfill.
- P1: Inline edit/delete of individual price points from the history table (currently only via add-snapshot upsert + DELETE endpoint).
- P2: Multiple admin operators with proper JWT login.
- P2: Date range filter on chart, log-scale toggle, item visibility toggles.
- P2: Export chart as PNG / share-link per category.
- P2: Public-facing search across all items.
- P3: Image upload per item.

## Known limitations
- Single shared admin password (acceptable for personal/hobby site).
- Slug uniqueness not enforced on categories with identical names.
- Cascade deletes are not transactional.

## Next tasks list
- Decide if multi-admin or social login is needed.
- Decide if CSV import is desired for historical data backfill.
- Consider deploying via Emergent (Save to GitHub → Deploy).
