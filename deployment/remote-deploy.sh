#!/usr/bin/env bash
set -euo pipefail

HOSTING_DIR="${HOSTING_DIR:-$HOME/hosting/command-center}"
mkdir -p "$HOSTING_DIR/data"
cd "$HOSTING_DIR"

touch .env
if ! grep -q '^RELAY_SECRET=' .env 2>/dev/null; then
  printf "RELAY_SECRET='%s'\n" "$(openssl rand -hex 32)" >> .env
fi
if ! grep -q '^SESSION_SECRET=' .env 2>/dev/null; then
  printf "SESSION_SECRET='%s'\n" "$(openssl rand -hex 32)" >> .env
fi

if [[ ! -f .env.runtime ]]; then
  echo "Missing .env.runtime — deploy aborted." >&2
  exit 1
fi

for key in RELAY_SECRET SESSION_SECRET; do
  if ! grep -q "^${key}=" .env.runtime; then
    grep "^${key}=" .env >> .env.runtime
  fi
done

read_image() {
  local line val
  line="$(grep '^COMMAND_CENTER_IMAGE=' .env.runtime | head -n1)"
  val="${line#COMMAND_CENTER_IMAGE=}"
  val="${val#\'}"; val="${val%\'}"
  val="${val#\"}"; val="${val%\"}"
  printf '%s' "$val"
}

export COMMAND_CENTER_IMAGE="$(read_image)"
if [[ -z "$COMMAND_CENTER_IMAGE" ]]; then
  echo "COMMAND_CENTER_IMAGE missing in .env.runtime" >&2
  exit 1
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-manuel-envisix}" --password-stdin >/dev/null
fi

docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d --remove-orphans

echo "Deploy finished (secrets not logged)."
