#!/usr/bin/env bash
# ============================================================================
#  Banc de test SQL.
#
#  Monte un Postgres jetable, y joue supabase/schema.sql TEL QUEL (précédé du
#  strict minimum de Supabase : schéma auth, auth.uid(), rôles, publication),
#  puis les scénarios. Aucune base distante n'est touchée, rien n'est installé.
#
#  Usage :  supabase/tests/run.sh
#  Réglages facultatifs :  PGBIN=/chemin/vers/postgres/bin  PGPORT_TEST=54329
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$HERE/../schema.sql"

PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || true)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  for c in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql*/bin; do
    [ -x "$c/initdb" ] && PGBIN="$c" && break
  done
fi
if [ -z "${PGBIN:-}" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "initdb introuvable. Installer PostgreSQL, ou donner PGBIN=/chemin/vers/bin." >&2
  exit 1
fi

PORT="${PGPORT_TEST:-54329}"
WORK="$(mktemp -d)"
DATA="$WORK/data"
SQL="$WORK/sql"

# initdb refuse de tourner en root : on bascule alors sur l'utilisateur système
# postgres, qui doit pouvoir lire les fichiers — d'où la copie dans $WORK.
AS=""
if [ "$(id -u)" = "0" ]; then AS="postgres"; fi
run() { if [ -n "$AS" ]; then su "$AS" -c "$1"; else bash -c "$1"; fi; }

cleanup() {
  run "'$PGBIN/pg_ctl' -D '$DATA' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$DATA" "$SQL"
cp "$SCHEMA" "$SQL/20-schema.sql"
cp "$HERE/harness.sql" "$SQL/10-harness.sql"
cp "$HERE/grants.sql" "$SQL/30-grants.sql"
for f in "$HERE"/[0-9][0-9]-*.sql; do cp "$f" "$SQL/40-$(basename "$f")"; done
if [ -n "$AS" ]; then chmod -R a+rX "$WORK"; chown -R "$AS" "$WORK"; fi
chmod 700 "$DATA"

echo "Postgres jetable : $PGBIN (port $PORT)"
run "'$PGBIN/initdb' -D '$DATA' -U postgres --auth=trust -E UTF8" >/dev/null
if ! run "'$PGBIN/pg_ctl' -D '$DATA' -o '-p $PORT -h 127.0.0.1 -k \"\" -c wal_level=logical' -l '$WORK/log' -w start" >/dev/null; then
  echo "--- journal du serveur ---" >&2
  cat "$WORK/log" >&2 || true
  echo "Port déjà pris ? Relancer avec PGPORT_TEST=54330" >&2
  exit 1
fi
run "'$PGBIN/createdb' -h 127.0.0.1 -p '$PORT' -U postgres courses_test"

for f in "$SQL"/*.sql; do
  run "'$PGBIN/psql' -h 127.0.0.1 -p '$PORT' -U postgres -d courses_test -v ON_ERROR_STOP=1 -q -f '$f'"
done

echo ""
echo "✓ banc de test vert"
