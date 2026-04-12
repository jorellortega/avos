#!/usr/bin/env bash
# Print STRIPE_SECRET_KEY from .env.local (stdout only, for use in other scripts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Missing .env.local" >&2
  exit 1
fi
KEY=$(grep -E '^[[:space:]]*STRIPE_SECRET_KEY=' "$ROOT/.env.local" | head -1 | sed 's/^[[:space:]]*STRIPE_SECRET_KEY=//' | tr -d '\r')
KEY="${KEY#\"}"
KEY="${KEY%\"}"
KEY="${KEY#\'}"
KEY="${KEY%\'}"
KEY="${KEY// /}"
if [[ -z "$KEY" ]]; then
  echo "Set STRIPE_SECRET_KEY in .env.local" >&2
  exit 1
fi
if [[ "$KEY" != sk_test_* && "$KEY" != sk_live_* ]]; then
  echo "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_" >&2
  exit 1
fi
printf '%s' "$KEY"
