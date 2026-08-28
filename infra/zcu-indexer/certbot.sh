#!/usr/bin/env bash
#
# Issue (or renew) the TLS certificate for the indexer API.
#
#   sudo bash /opt/zcu-indexer/certbot.sh
#
# Uses the webroot challenge, served by a temporary standalone nginx so this
# works before the main stack is running.
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/zcu-indexer}"
DOMAIN="${DOMAIN:-indexer-zcu.honest.money}"
EMAIL="${EMAIL:-admin@honest.money}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

cd "$STACK_DIR" || die "$STACK_DIR not found"
mkdir -p data/certbot/conf data/certbot/www

say "Checking DNS for $DOMAIN"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
PUBLIC_IP="$(curl -fsS --max-time 10 https://checkip.amazonaws.com || echo unknown)"
echo "  $DOMAIN -> ${RESOLVED:-<nothing>}"
echo "  this box -> $PUBLIC_IP"
if [ -z "$RESOLVED" ]; then
  die "DNS for $DOMAIN does not resolve yet. Add the A record and wait a few minutes."
fi

say "Stopping anything on port 80"
docker compose stop nginx 2>/dev/null || true

say "Serving the ACME challenge"
docker run -d --name zcu-acme \
  -p 80:80 \
  -v "$STACK_DIR/data/certbot/www:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine >/dev/null

cleanup() { docker rm -f zcu-acme >/dev/null 2>&1 || true; }
trap cleanup EXIT

sleep 2

say "Requesting the certificate"
docker run --rm \
  -v "$STACK_DIR/data/certbot/conf:/etc/letsencrypt" \
  -v "$STACK_DIR/data/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --no-eff-email \
    --non-interactive \
    --keep-until-expiring

cleanup
trap - EXIT

say "Certificate in place"
ls -1 "$STACK_DIR/data/certbot/conf/live/$DOMAIN/" 2>/dev/null || die "certificate files missing"

say "Installing the monthly renewal cron"
cat > /etc/cron.d/zcu-indexer-certbot <<EOF
0 3 1 * * root cd $STACK_DIR && docker run --rm -v $STACK_DIR/data/certbot/conf:/etc/letsencrypt -v $STACK_DIR/data/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose restart nginx
EOF
chmod 644 /etc/cron.d/zcu-indexer-certbot

echo
echo "Done. Now run:  bash $STACK_DIR/deploy.sh"
