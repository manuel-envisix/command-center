#!/usr/bin/env bash
set -euo pipefail

HOSTING_DIR="${HOSTING_DIR:-$HOME/hosting/command-center}"
mkdir -p "$HOSTING_DIR/data"
cd "$HOSTING_DIR"

touch .env
if ! grep -q '^SESSION_SECRET=' .env 2>/dev/null; then
  printf "SESSION_SECRET='%s'\n" "$(openssl rand -hex 32)" >> .env
fi

# RELAY_SECRET: prefer CI-managed value in .env.runtime; otherwise generate-once in .env
if ! grep -q '^RELAY_SECRET=' .env 2>/dev/null && ! grep -q '^RELAY_SECRET=' .env.runtime 2>/dev/null; then
  printf "RELAY_SECRET='%s'\n" "$(openssl rand -hex 32)" >> .env
fi

if [[ ! -f .env.runtime ]]; then
  echo "Missing .env.runtime — deploy aborted." >&2
  exit 1
fi

if ! grep -q '^RELAY_SECRET=' .env.runtime; then
  grep '^RELAY_SECRET=' .env >> .env.runtime
fi
if ! grep -q '^SESSION_SECRET=' .env.runtime; then
  grep '^SESSION_SECRET=' .env >> .env.runtime
fi

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

ghcr_login() {
  local token_file="${HOSTING_DIR}/.ghcr_token"
  if [[ -f "$token_file" ]]; then
    GHCR_TOKEN="$(cat "$token_file")"
    rm -f "$token_file"
  fi
  if [[ -z "${GHCR_TOKEN:-}" ]]; then
    return 0
  fi
  local user="${GHCR_USER:-manuel-envisix}"
  local attempt=1
  while [[ $attempt -le 3 ]]; do
    if printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$user" --password-stdin >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "GHCR docker login failed after retries (continuing with anonymous pull if package is public)." >&2
  return 0
}

ghcr_login

docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d --remove-orphans --force-recreate

echo "Deploy finished (secrets not logged)."
