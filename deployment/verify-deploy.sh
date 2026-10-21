#!/usr/bin/env bash
set -euo pipefail

decode() { if [ -n "${1:-}" ]; then printf '%s' "$1" | base64 -d; else echo ''; fi }

relay_secret="$(decode "${RELAY_SECRET_B64:-}")"
if [ -z "$relay_secret" ]; then relay_secret="${CC_RELAY_SECRET:-}"; fi

wrong_code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST https://agent-factory.envisix.at/push \
  -H 'Authorization: Bearer definitely-wrong-token' \
  -H 'Content-Type: application/json' \
  -d '{"kind":"view","blocks":[]}' || true)
echo "POST /push with wrong bearer: HTTP $wrong_code"
if [ "$wrong_code" != "401" ]; then
  echo "Expected HTTP 401 for invalid push bearer, got $wrong_code" >&2
  exit 1
fi

if [ -z "$relay_secret" ]; then
  echo "RELAY_SECRET repo secret not set - skipping container hash check"
  exit 0
fi

expected_hash="$(printf '%s' "$relay_secret" | sha256sum | awk '{print $1}')"
install -m 700 -d ~/.ssh
printf '%s\n' "$SSH_PRIVATE_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key
actual_hash="$(ssh -i ~/.ssh/deploy_key "${VPS_USER}@${VPS_HOST}" 'docker exec command-center printenv RELAY_SECRET | sha256sum' | awk '{print $1}')"
if [ "$actual_hash" = "$expected_hash" ]; then
  echo "RELAY_SECRET container check: match"
else
  echo "RELAY_SECRET container check: mismatch"
  exit 1
fi
