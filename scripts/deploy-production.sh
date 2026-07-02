#!/usr/bin/env bash
set -euo pipefail

SECRETS_FILE="${MYKIS_DEPLOY_ENV:-$HOME/.config/mykis/deploy.env}"
PRODUCTION_URL="${MYKIS_PRODUCTION_URL:-https://mykis-learning.nkhaduy.workers.dev}"
SUPABASE_MIGRATION_TRANSPORT="${SUPABASE_MIGRATION_TRANSPORT:-auto}"
DRY_RUN_ONLY=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN_ONLY=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: bash scripts/deploy-production.sh [--dry-run]" >&2
  exit 1
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing deployment secrets file: $SECRETS_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS_FILE"

required_vars=(
  SUPABASE_DB_URL
  SUPABASE_ACCESS_TOKEN
  SUPABASE_PROJECT_ID
  CLOUDFLARE_API_TOKEN
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment variable: $name" >&2
    exit 1
  fi
done

export SUPABASE_ACCESS_TOKEN
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

echo "Deployment secrets file found."
echo "Required deployment variables are present."

if [[ "$SUPABASE_MIGRATION_TRANSPORT" == "postgres" ]]; then
  echo "Migration transport: postgres"
  echo "Listing Supabase migrations before push..."
  npx supabase@latest migration list \
    --db-url "$SUPABASE_DB_URL"

  echo "Running Supabase migration dry-run..."
  npx supabase@latest db push \
    --db-url "$SUPABASE_DB_URL" \
    --dry-run

  if [[ "$DRY_RUN_ONLY" == "1" ]]; then
    echo "Dry-run complete; skipping migration apply, build, deploy, and smoke tests."
    exit 0
  fi

  echo "Applying Supabase migrations..."
  npx supabase@latest db push \
    --db-url "$SUPABASE_DB_URL"

  echo "Listing Supabase migrations after push..."
  npx supabase@latest migration list \
    --db-url "$SUPABASE_DB_URL"
elif [[ "$SUPABASE_MIGRATION_TRANSPORT" == "auto" || "$SUPABASE_MIGRATION_TRANSPORT" == "api" ]]; then
  echo "Migration transport: management-api"
  api_status="$(python3 - <<'PY'
import os, urllib.error, urllib.request
ref=os.environ["SUPABASE_PROJECT_ID"]
token=os.environ["SUPABASE_ACCESS_TOKEN"]
req=urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/migrations",
    headers={"Authorization":f"Bearer {token}","Accept":"application/json","User-Agent":"MyKIS-Deploy/1.0"},
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read(1)
        print(r.status)
except urllib.error.HTTPError as e:
    print(e.code)
PY
)"
  echo "Management Migration API HTTP status: $api_status"
  if [[ "$api_status" == "200" ]]; then
    echo "Running Supabase Management API migration dry-run..."
    python3 scripts/supabase-migrate-api.py dry-run

    if [[ "$DRY_RUN_ONLY" == "1" ]]; then
      echo "Dry-run complete; skipping migration apply, build, deploy, and smoke tests."
      exit 0
    fi

    echo "Applying Supabase migrations via Management API..."
    python3 scripts/supabase-migrate-api.py apply
  elif [[ "$api_status" == "403" ]]; then
    echo "Management Migration API returned 403. Use GitHub Actions workflow_dispatch after adding repository secrets." >&2
    exit 1
  elif [[ "$api_status" == "401" ]]; then
    echo "Management Migration API returned 401. Check SUPABASE_ACCESS_TOKEN." >&2
    exit 1
  elif [[ "$api_status" == "429" ]]; then
    echo "Management Migration API returned 429. Try again after rate limit resets." >&2
    exit 1
  else
    echo "Management Migration API unavailable with HTTP $api_status." >&2
    exit 1
  fi
else
  echo "Invalid SUPABASE_MIGRATION_TRANSPORT: $SUPABASE_MIGRATION_TRANSPORT" >&2
  exit 1
fi

echo "Building static assets..."
npm run build

echo "Deploying Cloudflare Worker..."
NODE_TLS_REJECT_UNAUTHORIZED=0 npx wrangler deploy

echo "Running production smoke tests..."
curl -fsS "$PRODUCTION_URL/login" >/dev/null
curl -fsS "$PRODUCTION_URL/admin/audit-log" >/dev/null
curl -fsS "$PRODUCTION_URL/dashboard" >/dev/null

status="$(curl -sS -o /tmp/mykis-audit-smoke.json -w '%{http_code}' "$PRODUCTION_URL/api/admin/audit-logs")"
if [[ "$status" != "401" && "$status" != "403" ]]; then
  echo "Unexpected audit API unauthenticated status: $status" >&2
  exit 1
fi

echo "Production smoke tests passed."
