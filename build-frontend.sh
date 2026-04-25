#!/usr/bin/env bash
# Build the React frontend for EdgeOne Pages.
# Usage:
#   BACKEND_URL=https://your-deployed-backend.example.com ./build-frontend.sh
#
# Output: /app/frontend/build  (zip its contents and upload to EdgeOne Pages)

set -euo pipefail

if [ -z "${BACKEND_URL:-}" ]; then
  echo "ERROR: BACKEND_URL env var is required."
  echo "Example: BACKEND_URL=https://abi-pricing-backend.onrender.com ./build-frontend.sh"
  exit 1
fi

cd "$(dirname "$0")/frontend"

echo "REACT_APP_BACKEND_URL=$BACKEND_URL" > .env.production
echo ">> Wrote frontend/.env.production with BACKEND_URL=$BACKEND_URL"

echo ">> Installing deps..."
yarn install --frozen-lockfile

echo ">> Building production bundle..."
yarn build

echo ""
echo ">> Build done."
echo ">> Upload the contents of: $(pwd)/build  to EdgeOne Pages."
echo ">> Tip: zip it with:  (cd build && zip -r ../abi-pricing-edgeone.zip .)"
