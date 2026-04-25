# ABI Pricing — EdgeOne Pages Bundle

This is a fully self-contained build of your ABI Pricing dashboard ready to deploy on **Tencent EdgeOne Pages**. It contains:

- **Static frontend** (the React build output) — the `index.html`, `static/`, and `assets/` folders.
- **Edge Functions backend** (`functions/api/...`) — JavaScript replacements for the FastAPI server, written for the EdgeOne Pages V8 runtime.
- **EdgeOne KV** (replaces MongoDB) — all categories, items, and price snapshots are stored in a KV namespace named `PRICING_KV`.

The JonyVole creator-code banner is preserved at `assets/jonyvole-banner.png` and clicks through to your creator code page.

---

## 1. What's in this folder

```
edgeone-export/
├── index.html                      <- React entrypoint
├── static/                          <- React JS / CSS
├── assets/jonyvole-banner.png       <- preserved Squarespace banner
├── asset-manifest.json
└── functions/
    └── api/
        ├── _shared.js               (helpers — not routed)
        ├── index.js                 GET  /api
        ├── seed.js                  GET  /api/seed
        ├── admin/
        │   └── login.js             POST /api/admin/login
        ├── categories/
        │   ├── index.js             GET, POST  /api/categories
        │   └── [id].js              DELETE     /api/categories/:id
        ├── items/
        │   ├── index.js             GET, POST  /api/items
        │   └── [id].js              DELETE     /api/items/:id
        ├── price-points/
        │   ├── index.js             GET, POST  /api/price-points
        │   ├── bulk.js              POST       /api/price-points/bulk
        │   └── [id].js              DELETE     /api/price-points/:id
        ├── chart-data/
        │   └── [id].js              GET        /api/chart-data/:id
        └── settings.js              GET, PUT   /api/settings (footer text)
```

---

## 2. Deploy step-by-step (zip upload)

1. Log in to the **EdgeOne Console** → **Pages** → **Create Project** → choose **Direct Upload**.
2. Compress the entire contents of this folder (NOT the parent folder) into a `.zip` and upload it. The structure inside the zip should start with `index.html`, `static/`, `assets/`, and `functions/`.
3. Wait for EdgeOne to finish deploying. Click your preview URL — the dashboard should load and show the seeded sample data the first time anyone hits `/api/categories`.

> Alternative: push these files to GitHub and use **Import Git** in EdgeOne Pages — same result, with auto-redeploy on every push.

---

## 3. Bind the KV namespace (required — admin will not work without this)

The functions persist data in EdgeOne KV under a binding named `PRICING_KV`.

1. **Console → KV Storage → Create Namespace** → name it anything (e.g. `abi-pricing`).
2. Open your Pages project → **Function Management → Namespace bindings → Add binding**.
3. **Variable name:** `PRICING_KV`  ←  *must be exactly this*
4. **KV namespace:** select the one you just created.
5. Save. (EdgeOne re-deploys functions automatically.)

---

## 4. Set the admin password

Set an environment variable on the project so the admin panel works:

1. Pages project → **Settings → Environment Variables → Add**.
2. **Key:** `ADMIN_PASSWORD`
3. **Value:** anything you like, e.g. `jonyvole2026` (this is the password you'll type at `/admin`).
4. Save and redeploy.

---

## 5. First-run seed

The very first request to `/api/categories` (loading the dashboard) auto-seeds 10 default categories with sample data on Helmets and Tier 5 Ammo. You can also force it manually by visiting:

```
https://<your-project>.edgeone.app/api/seed
```

After that, log in at `/admin` with your `ADMIN_PASSWORD`, delete the sample data and add your real prices.

The footer text ("Track in-game prices. Stay informed. Use creator code JonyVole.") is now editable from the **Site Settings (Footer)** card in the admin panel — no code change or rebuild needed. Five fields: title label, text-before-link, link label, link URL, text-after-link. Save → the public site updates instantly (KV is eventually consistent, may take ~60s).

---

## 6. Smoke-test the API

```
# 1. List categories (also triggers seed on first call)
curl https://<your-project>.edgeone.app/api/categories

# 2. Login
curl -X POST https://<your-project>.edgeone.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'

# 3. Add a category (admin)
curl -X POST https://<your-project>.edgeone.app/api/categories \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_PASSWORD" \
  -d '{"name":"Pistols","order":10}'
```

---

## 7. Notes & limitations

- **KV is eventually consistent** (~60s global sync). After you save a price, refresh once if it takes a moment to appear.
- **KV value size**: 25 MB per key — easily holds tens of thousands of price points for this app.
- **Wrong password** on `/admin/login` returns HTTP 401; protected endpoints return 401 if `X-Admin-Token` header is missing or wrong.
- The frontend uses **same-origin** API calls (`/api/...`), so there is no `REACT_APP_BACKEND_URL` to configure.
- To change the admin password later, just update the `ADMIN_PASSWORD` env var in EdgeOne and redeploy.

---

## 8. If something doesn't work

| Symptom | Likely cause | Fix |
|---|---|---|
| Dashboard loads but sidebar is empty | KV namespace not bound | Bind `PRICING_KV` in Function Management → Namespace bindings |
| `/api/admin/login` returns "ADMIN_PASSWORD env var not set" | Env var missing | Add `ADMIN_PASSWORD` env var, redeploy |
| `404` on `/api/...` paths | Functions not deployed (zip didn't include `functions/` folder) | Re-zip with `functions/` at the root and re-upload |
| Saved prices don't show up | KV eventual consistency | Wait ~60s and refresh |

---

That's it. Drop the zip into EdgeOne Pages, bind KV, set the password — done.
