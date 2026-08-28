#!/usr/bin/env bash
#
# One-shot installer for a fresh Ubuntu 24.04 box.
#
# Installs Docker, clones the repo, creates /opt/zcu-indexer with a generated
# .env, and prints the API token you need to paste into the explorer.
#
# Run as root:
#   sudo -i
#   curl -fsSL https://raw.githubusercontent.com/blockchainmint1/zcu-mempool/main/infra/zcu-indexer/install.sh | bash
#
# Or, if the repo is already cloned:
#   sudo bash /opt/zcu-mempool/infra/zcu-indexer/install.sh
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/blockchainmint1/zcu-mempool.git}"
REPO_DIR="${REPO_DIR:-/opt/zcu-mempool}"
STACK_DIR="${STACK_DIR:-/opt/zcu-indexer}"
DOMAIN="${DOMAIN:-api.mempool.zerochill.com}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run this as root (sudo -i first)"

say "Installing prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git rsync openssl

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi

# Docker must come back on its own after a reboot.
systemctl enable --now docker

say "Fetching the repo"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull --ff-only
elif [ -n "$REPO_URL" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  die "$REPO_DIR does not exist and REPO_URL was not set"
fi

say "Creating $STACK_DIR"
mkdir -p "$STACK_DIR/data/postgres" "$STACK_DIR/data/certbot/conf" "$STACK_DIR/data/certbot/www"
rsync -a --exclude '.env' --exclude 'data/' \
  "$REPO_DIR/infra/zcu-indexer/" "$STACK_DIR/"
chmod +x "$STACK_DIR"/*.sh

if [ ! -f "$STACK_DIR/.env" ]; then
  say "Generating .env with fresh credentials"
  PG_PASS="$(openssl rand -hex 24)"
  API_TOKEN="$(openssl rand -hex 32)"
  cat > "$STACK_DIR/.env" <<EOF
POSTGRES_USER=zcu
POSTGRES_DB=zcu_index
POSTGRES_PASSWORD=$PG_PASS
API_TOKEN=$API_TOKEN
ZCU_RPC_URL=https://node-zcu.honest.money
BATCH_SIZE=50
POLL_MS=5000
BALANCE_INTERVAL_MS=60000
REORG_DEPTH=12
EOF
  chmod 600 "$STACK_DIR/.env"
else
  echo "  .env already exists, leaving it alone"
fi

say "Done installing"

cat <<EOF

Next steps:

  1. Make sure DNS for $DOMAIN points at this box's public IP.

  2. Issue the TLS certificate:

       bash $STACK_DIR/certbot.sh

  3. Start everything:

       bash $STACK_DIR/deploy.sh

  4. Copy this API token into the explorer (secret ZCU_INDEXER_TOKEN):

EOF

grep '^API_TOKEN=' "$STACK_DIR/.env" | cut -d= -f2
echo
