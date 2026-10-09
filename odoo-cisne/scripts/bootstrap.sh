#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${HOST:-db}"
DB_PORT="${PORT:-5432}"
DB_USER="${USER:-odoo}"
DB_PASSWORD="${PASSWORD:?database password is required}"
DB_NAME="${CISNE_DB_NAME:-cisne}"
MODULES="${CISNE_BOOTSTRAP_MODULES:-base,web,cisne_branding}"

COMMON_ARGS=(
  -c /etc/odoo/odoo.conf
  --db_host="$DB_HOST"
  --db_port="$DB_PORT"
  --db_user="$DB_USER"
  --db_password="$DB_PASSWORD"
  -d "$DB_NAME"
)

python3 - "$DB_HOST" "$DB_PORT" <<'PY'
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])

for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            raise SystemExit(0)
    except OSError:
        time.sleep(1)

raise SystemExit("database did not become reachable")
PY

INIT_ARGS=(--stop-after-init -i "$MODULES")
if [[ "${CISNE_WITHOUT_DEMO:-true}" == "true" ]]; then
  INIT_ARGS+=(--without-demo=all)
fi

echo "Initializing/updating Cisne ERP database '${DB_NAME}' with governed module set."
odoo "${COMMON_ARGS[@]}" "${INIT_ARGS[@]}"

echo "Starting Cisne Rondônia ERP."
exec odoo "${COMMON_ARGS[@]}"
