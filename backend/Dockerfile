# Backend image — works on Render, Fly.io, Railway, Google Cloud Run, Azure Container Apps, etc.
FROM python:3.11-slim

WORKDIR /app

# System deps (kept minimal; jq build wheel is unused on these hosts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Drop heavy/unused deps that bloat the image and aren't needed for the deployed API.
RUN sed -i '/^jq/d;/^black/d;/^isort/d;/^flake8/d;/^mypy/d;/^pytest/d;/^emergentintegrations/d' requirements.txt \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8001
EXPOSE 8001

# $PORT is provided by Render/Fly/Railway/etc.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
