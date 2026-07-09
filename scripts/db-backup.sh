#!/usr/bin/env bash
#
# Nightly logical backup of the production Postgres database to a private S3 bucket.
#
# Produces a compressed pg_dump custom-format archive and uploads it with
# server-side encryption. Intended to run from CI (see
# .github/workflows/db-backup.yml) but can also be run locally for testing.
#
# Required environment variables:
#   SUPABASE_DB_URL       Full Postgres connection string (session pooler, port 5432).
#   BACKUP_S3_BUCKET      Destination S3 bucket name (private, encrypted).
#   AWS_REGION            AWS region of the bucket.
#   AWS_ACCESS_KEY_ID     Credentials for a write-only IAM user (s3:PutObject only).
#   AWS_SECRET_ACCESS_KEY
#
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${AWS_REGION:?AWS_REGION is required}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="procuvex-db-${timestamp}.dump"
s3_key="daily/${dump_file}"

echo "[db-backup] pg_dump start ${timestamp}"
# Custom format (-Fc) is compressed and restorable with pg_restore.
# --no-owner / --no-privileges keep the dump portable across projects.
pg_dump "${SUPABASE_DB_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${dump_file}"

size="$(du -h "${dump_file}" | cut -f1)"
echo "[db-backup] dump complete: ${dump_file} (${size})"

echo "[db-backup] uploading to s3://${BACKUP_S3_BUCKET}/${s3_key}"
aws s3 cp "${dump_file}" "s3://${BACKUP_S3_BUCKET}/${s3_key}" \
  --region "${AWS_REGION}" \
  --sse AES256 \
  --only-show-errors

echo "[db-backup] upload complete: s3://${BACKUP_S3_BUCKET}/${s3_key}"
rm -f "${dump_file}"
echo "[db-backup] done"
