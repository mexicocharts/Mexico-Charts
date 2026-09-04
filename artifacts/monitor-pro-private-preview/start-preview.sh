#!/usr/bin/env bash
set -euo pipefail

checkout=/tmp/monitor-pro-preview-approved
expected_revision=34ecae3fe529b9db7fab114e679cb6d21d95b542
api_port=8099
api_log=/tmp/monitor-pro-private-api.log
build_log=/tmp/monitor-pro-private-build.log

if [[ ! -d "$checkout/.git" ]]; then
  echo "Approved Monitor Pro checkout is unavailable." >&2
  exit 1
fi

actual_revision="$(git -C "$checkout" rev-parse HEAD)"
if [[ "$actual_revision" != "$expected_revision" ]]; then
  echo "Approved Monitor Pro checkout revision mismatch." >&2
  exit 1
fi

if [[ -z "${PORT:-}" || -z "${BASE_PATH:-}" ]]; then
  echo "Managed PORT and BASE_PATH are required." >&2
  exit 1
fi

: "${MONITOR_PRO_CLERK_PUBLISHABLE_KEY:?Monitor Pro publishable key is required.}"
: "${MONITOR_PRO_CLERK_SECRET_KEY:?Monitor Pro secret key is required.}"
: "${MONITOR_PRO_ARTIST_PRO_INTERNAL_USER_IDS:?Monitor Pro internal user IDs are required.}"

cleanup() {
  if [[ -n "${api_pid:-}" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$checkout"
unset REPLIT_DEPLOYMENT

if ! VITE_CLERK_PUBLISHABLE_KEY="$MONITOR_PRO_CLERK_PUBLISHABLE_KEY" \
  BASE_PATH="$BASE_PATH" \
  pnpm --filter @workspace/mexico-charts run build >"$build_log" 2>&1; then
  echo "Approved Monitor Pro frontend build failed." >&2
  exit 1
fi

(
  export NODE_ENV=development
  export MONITOR_PRO_READONLY_PREVIEW=true
  export PORT="$api_port"
  export CLERK_PUBLISHABLE_KEY="$MONITOR_PRO_CLERK_PUBLISHABLE_KEY"
  export CLERK_SECRET_KEY="$MONITOR_PRO_CLERK_SECRET_KEY"
  export ARTIST_PRO_INTERNAL_USER_IDS="$MONITOR_PRO_ARTIST_PRO_INTERNAL_USER_IDS"
  exec /home/runner/workspace/scripts/node_modules/.bin/tsx \
    artifacts/api-server/src/monitor-pro-preview.ts
) >"$api_log" 2>&1 &
api_pid=$!

ready=false
for _ in $(seq 1 30); do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    break
  fi
  health="$(curl -fsS --max-time 2 \
    "http://127.0.0.1:${api_port}/api/preview-health" 2>/dev/null || true)"
  if [[ "$health" == *'"databaseReadOnly":true'* &&
        "$health" == *'"backgroundJobsStarted":false'* ]]; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "Isolated Monitor Pro API refused read-only readiness." >&2
  exit 1
fi

export NODE_ENV=development
export MONITOR_PRO_API_TARGET="http://127.0.0.1:${api_port}"
export MONITOR_PRO_STATIC_ROOT="$checkout/artifacts/mexico-charts/dist/public"

# The static server does not need Clerk credentials or internal user IDs.
unset CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY ARTIST_PRO_INTERNAL_USER_IDS
unset MONITOR_PRO_CLERK_PUBLISHABLE_KEY MONITOR_PRO_CLERK_SECRET_KEY
unset MONITOR_PRO_ARTIST_PRO_INTERNAL_USER_IDS MONITOR_PRO_VITE_CLERK_PUBLISHABLE_KEY

exec node /home/runner/workspace/artifacts/monitor-pro-private-preview/server.mjs