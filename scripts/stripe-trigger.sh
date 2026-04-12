#!/usr/bin/env bash
# stripe trigger using STRIPE_SECRET_KEY from .env.local (avoids expired stripe login key).
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=$(bash scripts/stripe-read-secret.sh)
if [[ $# -lt 1 ]]; then
  echo "Usage: npm run stripe:trigger -- <event>" >&2
  echo "Example: npm run stripe:trigger -- payment_intent.succeeded" >&2
  exit 1
fi
exec stripe trigger "$@" --api-key "$KEY"
