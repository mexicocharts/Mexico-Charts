#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db preflight
pnpm --filter @workspace/db push
pnpm --filter @workspace/scripts run artist-social-import-verified -- --file=./data/verified-artist-social-accounts.csv --write=true
