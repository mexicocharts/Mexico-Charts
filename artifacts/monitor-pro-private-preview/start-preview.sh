#!/usr/bin/env bash
set -euo pipefail

checkout=/tmp/monitor-pro-preview-approved-9019f42
expected_revision=9019f42d7c5919be6ae39f716a0fdaa4d4d9bb34
expected_tree=a7fe04c41929d9f5b28b03054d60835b8d5bb957
approved_branch=codex/monitor-pro-bounded-diagnostics-1051
approved_repository=https://github.com/mexicocharts/Mexico-Charts.git
api_port=8100
api_log=/tmp/monitor-pro-private-api-baf7bc8.log
build_log=/tmp/monitor-pro-private-build-baf7bc8.log

restore_approved_checkout() {
  local restore_root restore_checkout
  restore_root="$(mktemp -d /tmp/monitor-pro-preview-restore.XXXXXX)"
  restore_checkout="$restore_root/checkout"

  if ! (
    git clone --quiet --single-branch --branch "$approved_branch" \
      "$approved_repository" "$restore_checkout"
    git -C "$restore_checkout" checkout --quiet --detach "$expected_revision"
    [[ "$(git -C "$restore_checkout" rev-parse HEAD)" == "$expected_revision" ]]
    [[ "$(git -C "$restore_checkout" rev-parse HEAD^{tree})" == "$expected_tree" ]]
    CI=1 pnpm --dir "$restore_checkout" install --frozen-lockfile --offline
    [[ -z "$(git -C "$restore_checkout" status --porcelain --untracked-files=no)" ]]
  ); then
    rm -rf -- "$restore_root"
    echo "Approved Monitor Pro checkout restoration failed." >&2
    exit 1
  fi

  if [[ -e "$checkout" ]]; then
    rm -rf -- "$restore_root"
    echo "Approved Monitor Pro checkout appeared during restoration." >&2
    exit 1
  fi

  mv -- "$restore_checkout" "$checkout"
  rmdir -- "$restore_root"
}

if [[ ! -d "$checkout/.git" ]]; then
  restore_approved_checkout
fi

actual_revision="$(git -C "$checkout" rev-parse HEAD)"
if [[ "$actual_revision" != "$expected_revision" ]]; then
  echo "Approved Monitor Pro checkout revision mismatch." >&2
  exit 1
fi
actual_tree="$(git -C "$checkout" rev-parse HEAD^{tree})"
if [[ "$actual_tree" != "$expected_tree" ]]; then
  echo "Approved Monitor Pro checkout tree mismatch." >&2
  exit 1
fi

if [[ ! -x "$checkout/node_modules/.bin/vite" &&
      ! -x "$checkout/artifacts/mexico-charts/node_modules/.bin/vite" ]]; then
  CI=1 pnpm --dir "$checkout" install --frozen-lockfile --offline
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

if ! (
  cd "$checkout/artifacts/mexico-charts"
  VITE_CLERK_PUBLISHABLE_KEY="$MONITOR_PRO_CLERK_PUBLISHABLE_KEY" \
    BASE_PATH="$BASE_PATH" \
    pnpm exec vite build --config vite.config.ts
) >"$build_log" 2>&1; then
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