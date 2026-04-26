# ABI Pricing — EdgeOne Pages Bundle (Upstash Redis edition)

This is a fully self-contained build of your ABI Pricing dashboard ready to deploy on **Tencent EdgeOne Pages**, with persistent storage on **Upstash Redis** (free tier, no credit card needed).

- **Static frontend** (the React build output) — `index.html`, `static/`, `assets/`.
- **Edge Functions backend** (`functions/api/...`) — JavaScript handlers for the EdgeOne V8 runtime.
- **Upstash Redis** as the database (replaces both MongoDB and EdgeOne KV).

The JonyVole creator-code banner is preserved at `assets/jonyvole-banner.png` and clicks through to your creator code page.

---

## 1. Folder structure

```
edgeone-export/
├── index.html                       <- React entrypoint
├── static/                          <- React JS / CSS
├── assets/jonyvole-banner.png       <- preserved Squarespace banner
├── asset-manifest.json
└── functions/
    └── api/
        ├── _shared.js               (helpers — not routed)
        ├── index.js                 GET  /api
        ├── debug.js                 GET  /api/debug         (diagnostic)
        ├── seed.js                  GET  /api/seed
        ├── settings.js              GET, PUT /api/settings  (footer text)
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
        └── chart-data/
            └── [id].js              GET        /api/chart-data/:id
```

---

## 2. Create your free Upstash Redis database (5 minutes)

1. Go to **https://console.upstash.com/redis** and sign up (Google/GitHub login, no card required).
2. Click **Create Database**.
   - Name: `abi-pricing` (anything you like)
   - Type: **Regional** (cheapest, plenty fast)
   - Region: pick whatever is closest to you
   - Eviction: **disabled** (you don't want price history evicted)
3. After creation, scroll to the **REST API** section. You'll see two values you need:
   - `UPSTASH_REDIS_REST_URL`  (e.g. `https://flying-tiger-12345.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN`  (a long string starting with `AY…`)

Keep that page open — you'll paste these into EdgeOne in step 4.

---

## 3. Deploy the bundle to EdgeOne

1. EdgeOne Console → **Pages** → **Create Project** → **Direct Upload**.
2. Zip the contents of this folder (NOT the parent folder) and upload. The structure inside the zip should start with `index.html`, `static/`, `assets/`, and `functions/`.
3. Wait for EdgeOne to finish deploying.

> Alternative: push these files to GitHub and use **Import Git** in EdgeOne Pages.

---

## 4. Set environment variables on the EdgeOne project

Pages project → **Settings → Environment Variables → Add**. Add **three** variables:

| Variable name | Value |
|---|---|
| `UPSTASH_REDIS_URL` | the REST URL from Upstash, e.g. `https://flying-tiger-12345.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | the long token from Upstash (starts with `AY…`) |
| `ADMIN_PASSWORD` | whatever password you want to use to log in at `/admin` |

Save and **redeploy** (EdgeOne usually does this automatically).

> No KV namespace bindings needed. You can ignore the KV section entirely.

---

## 5. Verify everything is connected

Open `https://<your-project>.edgeone.app/api/debug` in a browser. You should see:

```json
{
  "upstash_url_set": true,
  "upstash_token_set": true,
  "admin_password_set": true,
  "runtime_has_crypto": true,
  "can_read": true,
  "can_write": true,
  "seeded_flag": null,    // becomes "1" after first dashboard load
  "error": null
}
```

If any of `can_read` / `can_write` is `false`, the `error` field will tell you exactly what went wrong (most often a typo in the URL/token).

---

## 6. Use the app

1. Visit your EdgeOne URL — the dashboard loads, auto-seeds 10 categories on first request.
2. Visit `/admin`, log in with your `ADMIN_PASSWORD`, delete the sample data, add real prices.
3. Edit the footer text from the **Site Settings (Footer)** card in the admin panel — saves to Upstash Redis instantly, public site updates within a refresh.

---

## 7. Smoke-test the API by hand

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

## 8. Free-tier limits (Upstash)

- **10 000 commands/day** (a "command" = one GET or one SET). Each chart view is 3 reads, each price-snapshot save is 1 write. 10 K/day comfortably covers thousands of visitors.
- **256 MB storage** — your data won't exceed ~5 MB even after 10 years of weekly logging.
- No credit card required, no expiry. If you ever outgrow free, paid tier starts at ~$0.20 per 100 K commands.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/debug` returns `upstash_url_set: false` | env var missing | Add `UPSTASH_REDIS_URL` in EdgeOne Settings, redeploy |
| `/api/debug` returns `can_read: false` with auth error | token typo | Re-paste `UPSTASH_REDIS_TOKEN` from Upstash console |
| `/api/admin/login` returns "ADMIN_PASSWORD env var not set" | env var missing | Add `ADMIN_PASSWORD` in EdgeOne Settings, redeploy |
| Anything returns "Edge function exception" | something threw at runtime | The response now includes the actual error message — share it with support / your developer |
| Saved prices don't show up | browser cache | Hard refresh (Ctrl-Shift-R / Cmd-Shift-R) |

---

That's it. **Upload zip → set 3 env vars → done.** No KV bindings, no MongoDB, no extra services.
