#!/usr/bin/env bash
#
# Nightly logical backup of the production Postgres database to a private
# Supabase Storage bucket.
#
# Produces a compressed pg_dump custom-format archive, uploads it to the
# `db-backups` bucket via the Storage REST API, then prunes archives older than
# RETENTION_DAYS. Intended to run from CI (see .github/workflows/db-backup.yml)
# but can also be run locally for testing.
#
# Required environment variables:
#   SUPABASE_DB_URL             Full Postgres connection string (session pooler, :5432).
#   SUPABASE_URL                Project URL, e.g. https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY   Service-role (secret) API key for Storage writes.
# Optional:
#   BACKUP_BUCKET               Destination bucket (default: db-backups).
#   RETENTION_DAYS              Days to keep archives (default: 14).
#
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
BUCKET="${BACKUP_BUCKET:-db-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="procuvex-db-${timestamp}.dump"
object_key="daily/${dump_file}"

# Prefer the newest installed pg_dump. Ubuntu/CI runners often ship an older
# client (e.g. 16) on PATH; pg_dump refuses to dump a newer server, so pick the
# highest-versioned binary under /usr/lib/postgresql/*/bin when available.
PG_DUMP="pg_dump"
for d in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V -r); do
  if [ -x "${d}/pg_dump" ]; then PG_DUMP="${d}/pg_dump"; break; fi
done
echo "[db-backup] using $("${PG_DUMP}" --version)"

echo "[db-backup] pg_dump start ${timestamp}"
# Custom format (-Fc) is compressed and restorable with pg_restore.
# --no-owner / --no-privileges keep the dump portable across projects.
"${PG_DUMP}" "${SUPABASE_DB_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${dump_file}"
echo "[db-backup] dump complete: ${dump_file} ($(du -h "${dump_file}" | cut -f1))"

echo "[db-backup] uploading to ${BUCKET}/${object_key}"
http_code="$(curl -s -o /tmp/db-backup-upload.out -w '%{http_code}' -X POST \
  "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${object_key}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${dump_file}")"
if [ "${http_code}" != "200" ]; then
  echo "[db-backup] ERROR: upload failed (HTTP ${http_code}): $(cat /tmp/db-backup-upload.out)"
  exit 1
fi
echo "[db-backup] upload complete: ${BUCKET}/${object_key}"
rm -f "${dump_file}"

echo "[db-backup] pruning archives older than ${RETENTION_DAYS} day(s)"
curl -s -X POST "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"daily/","limit":1000,"sortBy":{"column":"created_at","order":"asc"}}' \
  > /tmp/db-backup-list.json

python3 - "${RETENTION_DAYS}" <<'PY'
import sys, json, datetime
days = int(sys.argv[1])
cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
try:
    objects = json.load(open('/tmp/db-backup-list.json'))
except Exception:
    objects = []
old = []
for o in objects if isinstance(objects, list) else []:
    ca = o.get('created_at')
    if not ca:
        continue
    dt = datetime.datetime.fromisoformat(ca.replace('Z', '+00:00'))
    if dt < cutoff:
        old.append('daily/' + o['name'])
json.dump({'prefixes': old}, open('/tmp/db-backup-old.json', 'w'))
print(f"[db-backup] {len(old)} archive(s) past retention" + (": " + ", ".join(old) if old else ""))
PY

if [ "$(python3 -c "import json;print(len(json.load(open('/tmp/db-backup-old.json'))['prefixes']))")" != "0" ]; then
  curl -s -X DELETE "${SUPABASE_URL}/storage/v1/object/${BUCKET}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data "@/tmp/db-backup-old.json" > /dev/null
  echo "[db-backup] pruned expired archives"
fi

echo "[db-backup] done"
