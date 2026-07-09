#!/usr/bin/env bash
#
# Lightweight production health check for procuvex.com.
#
# Runs a handful of cheap, unauthenticated probes and, if any fail, sends an
# email alert (SendGrid) and exits non-zero so the CI run is marked failed
# (which in turn can trigger the auto-remediation Automation).
#
# Probes:
#   1. Site up            GET  /                         -> 200
#   2. DB-backed API      GET  /.netlify/functions/network-stats -> 200 + numeric "total"
#   3. ai-proxy auth      POST /.netlify/functions/ai-proxy (no JWT) -> 401 (security canary)
#   4. Backup freshness   newest db-backups/daily/ object younger than MAX_BACKUP_AGE_HOURS
#
# Required environment variables:
#   SUPABASE_URL                Project URL, e.g. https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY   Service-role key (Storage read for the backup check)
#   SENDGRID_API_KEY            SendGrid API key for the alert email
# Optional:
#   SITE_URL                    Target site (default: https://procuvex.com)
#   ALERT_EMAIL                 Recipient (default: team@procuvex.com)
#   FROM_EMAIL                  Sender, must be a verified SendGrid sender (default: support@core314.com)
#   BACKUP_BUCKET               Bucket to check (default: db-backups)
#   MAX_BACKUP_AGE_HOURS        Freshness threshold (default: 26)
#
set -uo pipefail

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

SITE_URL="${SITE_URL:-https://procuvex.com}"
ALERT_EMAIL="${ALERT_EMAIL:-team@procuvex.com}"
FROM_EMAIL="${FROM_EMAIL:-support@core314.com}"
BACKUP_BUCKET="${BACKUP_BUCKET:-db-backups}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"

failures=()

echo "[health-check] $(date -u +%Y-%m-%dT%H:%M:%SZ) target=${SITE_URL}"

# 1. Site up ------------------------------------------------------------------
code="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' "${SITE_URL}/" || echo 000)"
if [ "${code}" = "200" ]; then
  echo "[health-check] OK   site root -> ${code}"
else
  echo "[health-check] FAIL site root -> ${code}"
  failures+=("Site root returned HTTP ${code} (expected 200) at ${SITE_URL}/")
fi

# 2. DB-backed public API -----------------------------------------------------
stats_body="$(curl -sS -m 30 "${SITE_URL}/.netlify/functions/network-stats" || echo '')"
if echo "${stats_body}" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d.get('total'), (int,float)) else 1)" 2>/dev/null; then
  echo "[health-check] OK   network-stats returns numeric total"
else
  echo "[health-check] FAIL network-stats did not return a numeric total"
  failures+=("network-stats endpoint unhealthy (no numeric 'total') — DB/API path may be down")
fi

# 3. ai-proxy auth canary (unauthenticated must be rejected) ------------------
ai_code="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST \
  "${SITE_URL}/.netlify/functions/ai-proxy" \
  -H 'Content-Type: application/json' -d '{}' || echo 000)"
if [ "${ai_code}" = "401" ] || [ "${ai_code}" = "403" ]; then
  echo "[health-check] OK   ai-proxy rejects unauthenticated -> ${ai_code}"
else
  echo "[health-check] FAIL ai-proxy unauth -> ${ai_code} (expected 401/403)"
  failures+=("SECURITY: ai-proxy returned HTTP ${ai_code} to an unauthenticated request (expected 401/403) — possible auth regression")
fi

# 4. Backup freshness ---------------------------------------------------------
newest_json="$(curl -sS -m 30 -X POST "${SUPABASE_URL}/storage/v1/object/list/${BACKUP_BUCKET}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"daily/","limit":1,"sortBy":{"column":"created_at","order":"desc"}}' || echo '[]')"
backup_msg="$(echo "${newest_json}" | MAX_H="${MAX_BACKUP_AGE_HOURS}" python3 -c "
import sys, os, json, datetime
maxh = float(os.environ['MAX_H'])
try:
    objs = json.load(sys.stdin)
except Exception:
    objs = []
if not isinstance(objs, list) or not objs:
    print('FAIL|no backup objects found in daily/'); sys.exit(0)
ca = objs[0].get('created_at')
name = objs[0].get('name', '?')
if not ca:
    print('FAIL|newest backup has no created_at'); sys.exit(0)
dt = datetime.datetime.fromisoformat(ca.replace('Z', '+00:00'))
age_h = (datetime.datetime.now(datetime.timezone.utc) - dt).total_seconds() / 3600.0
if age_h > maxh:
    print(f'FAIL|newest backup {name} is {age_h:.1f}h old (> {maxh:.0f}h threshold)')
else:
    print(f'OK|newest backup {name} is {age_h:.1f}h old')
")"
if [ "${backup_msg%%|*}" = "OK" ]; then
  echo "[health-check] OK   ${backup_msg#*|}"
else
  echo "[health-check] FAIL ${backup_msg#*|}"
  failures+=("Backup freshness: ${backup_msg#*|}")
fi

# Result ----------------------------------------------------------------------
if [ "${#failures[@]}" -eq 0 ]; then
  echo "[health-check] all checks passed"
  exit 0
fi

echo "[health-check] ${#failures[@]} check(s) failed"
printf '%s\n' "${failures[@]}"

# Send alert email via SendGrid (best-effort; still fail the job regardless).
if [ -n "${SENDGRID_API_KEY:-}" ]; then
  run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
  payload="$(FAILS="$(printf '%s\n' "${failures[@]}")" RUN_URL="${run_url}" TO="${ALERT_EMAIL}" FROM="${FROM_EMAIL}" SITE="${SITE_URL}" python3 -c "
import os, json
fails = os.environ['FAILS'].strip().split('\n')
text = ('Procuvex production health check FAILED at ' + os.environ['SITE'] + '\n\n'
        + '\n'.join('- ' + f for f in fails)
        + '\n\nWorkflow run: ' + os.environ['RUN_URL']
        + '\n\nThis is an automated alert from the health-check workflow.')
print(json.dumps({
  'personalizations': [{'to': [{'email': os.environ['TO']}]}],
  'from': {'email': os.environ['FROM'], 'name': 'Procuvex Monitoring'},
  'subject': 'ALERT: Procuvex health check failed (' + str(len(fails)) + ' issue(s))',
  'content': [{'type': 'text/plain', 'value': text}],
}))
")"
  mail_code="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST 'https://api.sendgrid.com/v3/mail/send' \
    -H "Authorization: Bearer ${SENDGRID_API_KEY}" \
    -H 'Content-Type: application/json' \
    --data "${payload}" || echo 000)"
  echo "[health-check] alert email -> HTTP ${mail_code}"
else
  echo "[health-check] SENDGRID_API_KEY not set — skipping email alert"
fi

exit 1
