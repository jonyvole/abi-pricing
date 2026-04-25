# Deploying to EdgeOne Pages (Hybrid)

EdgeOne Pages can only host static files + edge functions. Your app has a Python/FastAPI backend
and a MongoDB database, so we'll split the deployment:

```
┌──────────────────────────┐    HTTPS    ┌───────────────────────────────┐    TCP/TLS   ┌─────────────────────┐
│  EdgeOne Pages (static)  │ ──────────▶ │  Render / Railway / Fly.io    │ ───────────▶ │  MongoDB Atlas (DB) │
│  React build (this app)  │             │  FastAPI backend (server.py)  │              │  free shared cluster │
└──────────────────────────┘             └───────────────────────────────┘              └─────────────────────┘
```

You'll do this once. After that, all updates are: edit data via `/admin` → done. No re-deploys needed.

---

## Step 1 · Create a free MongoDB database (5 min)

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free).
2. Create a free **M0 Shared** cluster (any region close to your backend host).
3. **Database Access** → add a user (remember the password).
4. **Network Access** → "Allow access from anywhere" (`0.0.0.0/0`) for now.
5. **Database** → click **Connect** → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the actual password. Save this string — you'll paste it in Step 2.

---

## Step 2 · Deploy the FastAPI backend to Render (free, 5 min)

> If you prefer Railway / Fly.io / Cloud Run, the same Dockerfile works — skip to Step 2b.

1. **Push this repo to GitHub** (use the *Save to GitHub* button in Emergent's chat input).
2. Sign up at https://render.com (free).
3. Click **New ▾ → Blueprint**, pick your GitHub repo. Render will detect `backend/render.yaml`.
4. When prompted, set:
   - `MONGO_URL` = the connection string from Step 1.
   - `DB_NAME` = `abi_pricing` (or anything).
   - `ADMIN_PASSWORD` = pick a strong password (this is your `/admin` login).
   - `CORS_ORIGINS` = your EdgeOne site URL once known, e.g. `https://abi-pricing.edgeone.app`. For now you can use `*` and tighten later.
5. Click **Apply**. Render builds the Docker image and gives you a URL like:
   ```
   https://abi-pricing-backend.onrender.com
   ```
   Test it: visiting `https://...onrender.com/api/categories` should return JSON with your 10 categories.

> Render free tier sleeps after 15 min idle (~30 s cold start on first request). Fine for this use case.
> Want zero cold starts? Upgrade to $7/mo on Render, or use Fly.io free tier (always-on small VM).

### Step 2b · Alternative hosts using the same Dockerfile
- **Railway**: New → Deploy from GitHub → choose `backend/` as root → set the same env vars.
- **Fly.io**: `fly launch` from `backend/` directory, set secrets with `fly secrets set MONGO_URL=...`.
- **Google Cloud Run**: `gcloud run deploy --source backend/`.

---

## Step 3 · Build the React frontend pointing at your backend

On your local machine (or any computer with Node 18+ and yarn):

```bash
git clone <your-repo>
cd <your-repo>
BACKEND_URL=https://abi-pricing-backend.onrender.com ./build-frontend.sh
```

This produces `frontend/build/` containing the static site (HTML/JS/CSS/images) with your backend URL baked in.

> If you don't have a shell, manually:
> 1. `cd frontend`
> 2. Create `frontend/.env.production` with one line: `REACT_APP_BACKEND_URL=https://your-backend.onrender.com`
> 3. `yarn install && yarn build`
> 4. The result is in `frontend/build/`.

---

## Step 4 · Upload to EdgeOne Pages

EdgeOne Pages supports two upload methods:

### Method A — Direct upload (fastest, no Git needed)
1. In the EdgeOne console: **Pages → Create Project → Upload Files (Direct Upload)**.
2. Zip the **contents** of `frontend/build/` (not the `build` folder itself):
   ```bash
   cd frontend/build && zip -r ../../abi-pricing-edgeone.zip .
   ```
3. Upload `abi-pricing-edgeone.zip` to EdgeOne. Done — your site is live.

### Method B — Connect a Git repo
1. In EdgeOne: **Pages → Create Project → Import from Git**.
2. Pick your repo.
3. Build settings:
   - **Root directory**: `frontend`
   - **Build command**: `yarn install && yarn build`
   - **Output directory**: `build`
   - **Environment variable**: `REACT_APP_BACKEND_URL=https://abi-pricing-backend.onrender.com`
4. Save & deploy. Future `git push` auto-redeploys.

### SPA routing (important)
The `/admin` route must serve `index.html`. Two helpers are already in `frontend/public/` and get copied into the build:
- `_redirects` — `/* /index.html 200` (Netlify-style fallback, EdgeOne respects this).
- `edgeone.json` — explicit route map.

If after upload `/admin` shows 404, in EdgeOne project settings set **404 fallback page** to `/index.html`.

---

## Step 5 · Lock down CORS

Once your EdgeOne URL is final (e.g. `https://abi-pricing.edgeone.app` or your custom domain):

In Render → your backend service → Environment → set:
```
CORS_ORIGINS=https://abi-pricing.edgeone.app,https://yourdomain.com
```
Save → Render auto-redeploys.

---

## Updating prices later

You DON'T need to rebuild or re-upload anything to update data:
1. Visit `https://abi-pricing.edgeone.app/admin`
2. Log in with your `ADMIN_PASSWORD`
3. Add categories / items / dated price snapshots → public site updates live.

You only need to rebuild + re-upload the frontend if you change UI code.

---

## Custom domain on EdgeOne

EdgeOne → your project → **Domains** → add your custom domain → follow the CNAME instructions.
Then update `CORS_ORIGINS` on the backend to include the new domain.

---

## Files added to your repo for this deployment

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Container image used by Render / Fly / Railway / Cloud Run |
| `backend/render.yaml` | Render Blueprint (one-click deploy) |
| `backend/Procfile` | Railway / Heroku-style start command |
| `backend/runtime.txt` | Python version pin |
| `backend/.env.example` | Sample env vars for the backend |
| `frontend/.env.production.example` | Sample frontend env (BACKEND_URL) |
| `frontend/public/_redirects` | SPA fallback for static hosts |
| `frontend/public/edgeone.json` | Explicit EdgeOne route map |
| `build-frontend.sh` | Helper script to build the frontend with a custom backend URL |

---

## Cost summary
- MongoDB Atlas M0: **free** (512 MB, plenty for price history)
- Render free web service: **free** (sleeps after idle, ~30s cold start)
- EdgeOne Pages: **free** within EdgeOne's normal traffic quota

Total: **$0/month** for low/medium traffic.
