#!/usr/bin/env bash
# Use STRIPE_SECRET_KEY from .env.local (avoids stale `stripe login` key).
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=$(bash scripts/stripe-read-secret.sh)

exec stripe listen \
  --forward-to localhost:3000/api/webhooks/stripe \
  --api-key "$KEY"
