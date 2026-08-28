#!/usr/bin/env bash
#
# Deploy the ZCU indexer stack.
#
# Pulls the latest code from the git checkout and syncs it into the live
# stack directory, preserving .env and data/. Safe to run repeatedly.
#
#   sudo /opt/zcu-indexer/deploy.sh
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zcu-mempool}"
STACK_DIR="${STACK_DIR:-/opt/zcu-indexer}"
SRC_DIR="$REPO_DIR/infra/zcu-indexer"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

[ -d "$REPO_DIR/.git" ] || die "$REPO_DIR is not a git checkout"
[ -f "$STACK_DIR/.env" ] || die "$STACK_DIR/.env is missing — create it from .env.example first"

say "Pulling latest code"
git -C "$REPO_DIR" pull --ff-only

say "Syncing stack files (preserving .env and data/)"
mkdir -p "$STACK_DIR"
rsync -a --delete \
  --exclude '.env' \
  --exclude 'data/' \
  "$SRC_DIR/" "$STACK_DIR/"

cd "$STACK_DIR"

say "Building images and starting postgres, indexer and api"
docker compose up -d --build postgres indexer api

say "Validating nginx config"
if [ -f ./data/certbot/conf/live/api.mempool.zerochill.com/fullchain.pem ]; then
  # Test in a throwaway container ON THE COMPOSE NETWORK so the `api`
  # upstream hostname resolves exactly as it will for the real nginx.
  NETWORK="$(docker compose ps -q api | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -n1)"
  [ -n "$NETWORK" ] || die "could not determine the compose network"
  docker run --rm \
    --network "$NETWORK" \
    -v "$STACK_DIR/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
    -v "$STACK_DIR/data/certbot/conf:/etc/letsencrypt:ro" \
    --entrypoint nginx nginx:1.27-alpine -t \
    || die "nginx config is invalid — nginx was not started"
else
  echo "  (no certificate yet, skipping nginx test)"
fi

say "Starting nginx"
docker compose up -d --build nginx

say "Waiting for the API to answer"
for i in $(seq 1 30); do
  if docker compose exec -T api wget -qO- http://localhost:8080/health >/dev/null 2>&1; then
    echo "  API healthy"
    break
  fi
  [ "$i" = 30 ] && die "API did not become healthy — check: docker compose logs api"
  sleep 2
done

# nginx resolves the `api` upstream once at startup. When the api container is
# rebuilt it gets a new IP, so a long-running nginx keeps proxying to the dead
# address and answers 502. Restart it after every deploy.
say "Restarting nginx so it picks up the new API container"
docker compose restart nginx
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' https://api.mempool.zerochill.com/health || true)"
  if [ "$code" = "200" ]; then
    echo "  public API healthy (https 200)"
    break
  fi
  [ "$i" = 30 ] && die "public API still returning $code — check: docker compose logs nginx"
  sleep 2
done


say "Status"
docker compose ps

say "Indexer progress (Ctrl-C to stop watching)"
docker compose logs -f --tail=20 indexer
