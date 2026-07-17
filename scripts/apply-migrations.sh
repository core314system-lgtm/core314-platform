#!/usr/bin/env bash
#
# Applies pending SQL migrations from supabase/migrations/ to the target
# database, tracked by filename in public._ci_schema_migrations.
#
# Design goals:
#   * Idempotent  — only files not yet recorded are executed; safe to re-run.
#   * Atomic      — each migration and its bookkeeping insert run in a single
#                   transaction, so a failure leaves no partial/untracked state.
#   * Safe adopt  — the first run against an already-migrated database records
#                   every existing migration as applied WITHOUT executing it
#                   (baseline), so historical migrations are never re-run
#                   against production.
#
# Migrations are keyed by full filename (not a parsed timestamp) because this
# repo has multiple files sharing the same date prefix, which the Supabase
# CLI's version-based `db push` cannot disambiguate.
#
# Requires: SUPABASE_DB_URL (Postgres connection string) and psql on PATH.
# Optional: MIGRATIONS_DIR (default: supabase/migrations)
#           DRY_RUN=true    (list what would be applied, change nothing)

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
DRY_RUN="${DRY_RUN:-false}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --no-psqlrc -qtA)

sql_literal() { printf "%s" "$1" | sed "s/'/''/g"; }

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No migrations directory at $MIGRATIONS_DIR — nothing to do."
  exit 0
fi

shopt -s nullglob
mapfile -t files < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | sort)
if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR — nothing to do."
  exit 0
fi

# 1. Detect whether the tracking table already exists (before creating it), so
#    a brand-new/adopted database can be baselined rather than fully replayed.
existed=$("${PSQL[@]}" -c "SELECT to_regclass('public._ci_schema_migrations') IS NOT NULL;")

# A dry run is fully read-only: never create the tracking table or write to it.
if [ "$DRY_RUN" != "true" ]; then
  "${PSQL[@]}" -c "
CREATE TABLE IF NOT EXISTS public._ci_schema_migrations (
  filename   text PRIMARY KEY,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  baselined  boolean NOT NULL DEFAULT false
);"
fi

# 2. First run against an existing database: baseline, do not execute.
if [ "$existed" != "t" ]; then
  echo "::notice::Tracking table absent — baselining ${#files[@]} existing migration(s) as applied WITHOUT executing them (database assumed already at this state)."
  if [ "$DRY_RUN" = "true" ]; then
    for f in "${files[@]}"; do echo "  would baseline: $(basename "$f")"; done
    echo "DRY_RUN: no changes made."
    exit 0
  fi
  for f in "${files[@]}"; do
    base=$(basename "$f")
    sum=$(sha256sum "$f" | awk '{print $1}')
    "${PSQL[@]}" -c "INSERT INTO public._ci_schema_migrations(filename, checksum, baselined) VALUES ('$(sql_literal "$base")','$sum',true) ON CONFLICT (filename) DO NOTHING;"
    echo "  baselined: $base"
  done
  echo "Baseline complete. Future runs will apply only new migrations."
  exit 0
fi

# 3. Normal run: apply any migration not yet recorded, in filename order.
applied=0
for f in "${files[@]}"; do
  base=$(basename "$f")
  sum=$(sha256sum "$f" | awk '{print $1}')
  seen=$("${PSQL[@]}" -c "SELECT 1 FROM public._ci_schema_migrations WHERE filename='$(sql_literal "$base")';")
  if [ "$seen" = "1" ]; then
    prev=$("${PSQL[@]}" -c "SELECT checksum FROM public._ci_schema_migrations WHERE filename='$(sql_literal "$base")';")
    if [ "$prev" != "$sum" ]; then
      echo "::warning::$base was already applied but its contents changed since. Not re-running — migrations are append-only; add a new migration instead."
    fi
    continue
  fi

  if [ "$DRY_RUN" = "true" ]; then
    echo "  would apply: $base"
    applied=$((applied + 1))
    continue
  fi

  echo "Applying: $base"
  combined=$(mktemp)
  cat "$f" >"$combined"
  printf "\nINSERT INTO public._ci_schema_migrations(filename, checksum) VALUES ('%s','%s');\n" "$(sql_literal "$base")" "$sum" >>"$combined"
  "${PSQL[@]}" --single-transaction -f "$combined"
  rm -f "$combined"
  applied=$((applied + 1))
done

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY_RUN: $applied migration(s) would be applied. No changes made."
else
  echo "Done. Applied $applied new migration(s)."
fi
