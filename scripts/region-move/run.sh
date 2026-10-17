#!/usr/bin/env bash
# Region move helper for Platform OS One. Copies the live Supabase project
# (Tokyo) into a new, empty Supabase project (Sydney). It runs from the
# "Region move" workflow in GitHub Actions, one step at a time:
#
#   check               read only: confirms everything is ready, changes nothing
#   copy-database       copies tables, data and logins into the empty Sydney database
#   copy-functions      copies the Edge Functions exactly as they run in Tokyo
#   copy-auth-settings  copies the site URL, redirect URLs and Google sign-in
#
# This repo is public, so its Actions logs are public too. The script prints
# ticks, crosses and names only. It never prints row counts, rows, keys or
# passwords, and it never uploads anything. Tokyo is only ever read from.
#
# The full walkthrough is docs/region-move-sydney.md.

set -euo pipefail

OLD_PROJECT_REF="${OLD_PROJECT_REF:-ysavtiiezxbqcnkkjnjo}"
NEW_PROJECT_REF="${NEW_PROJECT_REF:-}"
STEP="${STEP:-check}"
SYDNEY_REGION="ap-southeast-2"
API="${SUPABASE_API:-https://api.supabase.com/v1}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK=""
FAILED=0

say()  { printf '%s\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
note() { printf '  · %s\n' "$*"; }
bad()  { printf '  ✗ %s\n' "$*"; FAILED=1; }
die()  { bad "$*"; exit 1; }
has()  { [ -n "${!1:-}" ]; }

# Drop spaces and line breaks around a pasted value.
trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Hide a value from the rest of the Actions log. The runner decodes %25, %0D
# and %0A in a command's value, so encode those first or a password with a %
# in it would register the wrong mask.
mask() {
  if [ -n "${1:-}" ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
    local v="${1//'%'/%25}"
    v="${v//$'\r'/%0D}"
    v="${v//$'\n'/%0A}"
    printf '::add-mask::%s\n' "$v"
  fi
}

workdir() {
  if [ -z "$WORK" ]; then
    WORK="$(mktemp -d)"
    chmod 700 "$WORK"
    trap 'rm -rf "$WORK"' EXIT
  fi
}

url_part() { # prints nothing for a string that isn't a valid URL
  python3 -c 'import sys, urllib.parse as u
try:
    p = u.urlparse(sys.argv[1]); v = getattr(p, sys.argv[2]) or ""
except ValueError:
    v = ""
print(u.unquote(str(v)))' "$1" "$2"
}

# Runs psql against a database. On failure it prints only the kind of error:
# Postgres error text and context lines can quote a row's values, and the
# log is public.
psql_quiet() {
  local url="$1"; shift
  local err rc=0
  err="$(mktemp)"
  PGCONNECT_TIMEOUT=20 psql "$url" -X -A -t -q -v ON_ERROR_STOP=1 "$@" 2>"$err" || rc=$?
  if [ "$rc" -ne 0 ]; then
    { grep -oE '(ERROR|FATAL): +[^"(:]*|failed: [A-Za-z .]+' "$err" || true; } | head -3 | sed 's/^/    /' >&2
  fi
  rm -f "$err"
  return "$rc"
}
sql1() { psql_quiet "$1" -c "$2"; }

finish() { # finish <success message> <failure message>
  say ""
  if [ "$FAILED" -ne 0 ]; then say "$2"; exit 1; fi
  say "$1"
}

# ---------------------------------------------------------------- inputs ---

check_inputs() {
  if [[ ! "$NEW_PROJECT_REF" =~ ^[a-z]{20}$ ]]; then
    die "The Sydney project ref should be the 20 lowercase letters from its dashboard address."
  fi
  if [ "$NEW_PROJECT_REF" = "$OLD_PROJECT_REF" ]; then
    die "That ref is the Tokyo project. Use the new Sydney project's ref."
  fi
  ok "Moving $OLD_PROJECT_REF (Tokyo) to $NEW_PROJECT_REF (Sydney)"
}

# The connection string can be pasted exactly as Supabase shows it, with
# [YOUR-PASSWORD] still in it, and the password added as its own secret
# (OLD_DB_PASSWORD, NEW_DB_PASSWORD). This puts the password in, encoded so
# any character in it is safe. Spaces or line breaks pasted around either
# value are dropped. Call it directly, never inside $(...).
resolve_db_url() { # resolve_db_url <URL variable name>
  local name="$1" pw_name="${1%_URL}_PASSWORD" url pw enc
  url="$(trim "${!name:-}")"
  pw="$(trim "${!pw_name:-}")"
  if [ -n "$url" ] && [ -n "$pw" ] && [[ "$url" == *"[YOUR-PASSWORD]"* ]]; then
    enc="$(python3 -c 'import sys, urllib.parse as u; print(u.quote(sys.argv[1], safe=""))' "$pw")"
    mask "$pw"
    mask "$enc"
    url="$(python3 -c 'import sys; print(sys.argv[1].replace("[YOUR-PASSWORD]", sys.argv[2]))' "$url" "$enc")"
  fi
  printf -v "$name" '%s' "$url"
}

# check_db_url <secret name> <expected project ref> <label>
check_db_url() {
  local name="$1" ref="$2" label="$3" url host user pw
  url="${!name}"
  if [[ "$url" == *"[YOUR-PASSWORD]"* ]]; then
    bad "$label: $name still says [YOUR-PASSWORD]. Add the database password as the ${name%_URL}_PASSWORD secret."
    return 1
  fi
  host="$(url_part "$url" hostname)"
  user="$(url_part "$url" username)"
  pw="$(url_part "$url" password)"
  mask "$pw"
  if [ -z "$host" ]; then
    bad "$label: $name isn't a database connection string"; return 1
  fi
  if [[ "$host" == db.*.supabase.co ]]; then
    bad "$label: $name is the direct connection, which GitHub can't reach. In Supabase click Connect and copy the Session pooler string instead."
    return 1
  fi
  if [[ "$user" != *".$ref" ]]; then
    bad "$label: $name belongs to a different project. Check OLD_DB_URL and NEW_DB_URL aren't swapped."
    return 1
  fi
  if [ -z "$pw" ]; then
    bad "$label: $name has no database password in it."
    return 1
  fi
  ok "$label connection string looks right"
}

# ------------------------------------------------------------- databases ---

db_ready() {
  local fail=0 live tables users old_ext new_ext missing
  check_db_url OLD_DB_URL "$OLD_PROJECT_REF" "Tokyo" || fail=1
  check_db_url NEW_DB_URL "$NEW_PROJECT_REF" "Sydney" || fail=1
  [ "$fail" -eq 0 ] || return 1

  if sql1 "$OLD_DB_URL" 'select 1' >/dev/null; then ok "Connected to the Tokyo database"
  else bad "Couldn't connect to the Tokyo database"; return 1; fi
  if sql1 "$NEW_DB_URL" 'select 1' >/dev/null; then ok "Connected to the Sydney database"
  else bad "Couldn't connect to the Sydney database"; return 1; fi

  live="$(sql1 "$OLD_DB_URL" "select (select count(*) from public.organizations) > 0 and (select count(*) from public.customers) > 0")" || live=""
  if [ "$live" = "t" ]; then ok "Tokyo has the live data"
  else bad "Tokyo doesn't look like the live database (no organizations or customers)"; return 1; fi

  tables="$(sql1 "$NEW_DB_URL" "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")" || tables="?"
  users="$(sql1 "$NEW_DB_URL" "select count(*) from auth.users")" || users="?"
  if [ "$tables" = "0" ] && [ "$users" = "0" ]; then ok "Sydney is empty, so it's safe to copy into"
  else bad "Sydney already has tables or users in it. Refusing to copy over them."; return 1; fi

  old_ext="$(sql1 "$OLD_DB_URL" "select string_agg(extname, ' ' order by extname) from pg_extension")" || old_ext=""
  new_ext="$(sql1 "$NEW_DB_URL" "select string_agg(extname, ' ' order by extname) from pg_extension")" || new_ext=""
  missing="$(comm -23 <(tr ' ' '\n' <<<"$old_ext" | sort -u) <(tr ' ' '\n' <<<"$new_ext" | sort -u) | paste -sd ' ' -)"
  if [ -z "$missing" ]; then ok "Every database extension Tokyo uses is switched on in Sydney"
  else bad "Switch these on in Sydney first (Database > Extensions): $missing"; return 1; fi
}

# Writes roles.sql, schema.sql and data.sql for Tokyo into the given folder,
# exactly as Supabase's backup and restore guide does it.
dump_old() {
  local dir="$1"
  supabase db dump --db-url "$OLD_DB_URL" -f "$dir/roles.sql" --role-only >/dev/null
  supabase db dump --db-url "$OLD_DB_URL" -f "$dir/schema.sql" >/dev/null
  supabase db dump --db-url "$OLD_DB_URL" -f "$dir/data.sql" --use-copy --data-only \
    -x "storage.buckets_vectors" -x "storage.vector_indexes" >/dev/null
}

# Loads the three files into Sydney in a single transaction: either all of it
# lands, or none of it does and Sydney stays empty.
restore_new() {
  local dir="$1"
  psql_quiet "$NEW_DB_URL" --single-transaction \
    --file "$dir/roles.sql" \
    --file "$dir/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$dir/data.sql" >/dev/null
}

# Table name and row count for every table the app owns, plus logins.
COUNT_SQL="select n.nspname || '.' || c.relname || '=' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
order by 1"

TRIGGER_SQL="select coalesce(string_agg(tgname, ' ' order by tgname), '')
from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal"

verify_copy() {
  local old new line table total=0 mismatch=0 old_trig new_trig missing
  old="$(sql1 "$OLD_DB_URL" "$COUNT_SQL")" || { bad "Couldn't read Tokyo's tables to compare"; return 1; }
  new="$(sql1 "$NEW_DB_URL" "$COUNT_SQL")" || { bad "Couldn't read Sydney's tables to compare"; return 1; }
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    total=$((total + 1))
    table="${line%%=*}"
    if ! grep -qxF -- "$line" <<<"$new"; then bad "$table doesn't match Tokyo"; mismatch=1; fi
  done <<<"$old"
  if [ "$mismatch" -eq 0 ]; then ok "All $total tables match Tokyo row for row, logins included"; fi

  old_trig="$(sql1 "$OLD_DB_URL" "$TRIGGER_SQL")" || old_trig=""
  new_trig="$(sql1 "$NEW_DB_URL" "$TRIGGER_SQL")" || new_trig=""
  missing="$(comm -23 <(tr ' ' '\n' <<<"$old_trig" | sed '/^$/d' | sort -u) <(tr ' ' '\n' <<<"$new_trig" | sed '/^$/d' | sort -u) | paste -sd ' ' -)"
  if [ -z "$missing" ]; then ok "Sign-in triggers match Tokyo"
  else bad "Sign-in triggers missing in Sydney: $missing"; fi
}

# ------------------------------------------------------------ Supabase API ---

# Masks the access token and writes it to a header file, so it never sits on
# a command line. Call this directly, never inside $(...): the mask line has
# to reach the log, not get captured into a variable.
prepare_api() {
  workdir
  mask "$SUPABASE_ACCESS_TOKEN"
  printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN" > "$WORK/auth.hdr"
  chmod 600 "$WORK/auth.hdr"
}

# api METHOD PATH OUTFILE [BODYFILE]  prints the HTTP status code.
# prepare_api must have run first.
api() {
  if [ -z "$WORK" ] || [ ! -f "$WORK/auth.hdr" ]; then printf '000'; return 0; fi
  local args=(-sS -o "$3" -w '%{http_code}' -X "$1" -H "@$WORK/auth.hdr")
  if [ -n "${4:-}" ]; then args+=(-H 'Content-Type: application/json' --data-binary "@$4"); fi
  curl "${args[@]}" "$API$2" 2>/dev/null || true
}

google_secret_readable() {
  jq -e '(.external_google_secret // "") as $s
         | ($s | length) > 0 and ($s | test("^[*•x]+$") | not)' "$1" >/dev/null
}

secrets_to_add() {
  local s1 s2 missing
  s1="$(api GET "/projects/$OLD_PROJECT_REF/secrets" "$WORK/secrets_old.json")"
  s2="$(api GET "/projects/$NEW_PROJECT_REF/secrets" "$WORK/secrets_new.json")"
  if [ "$s1" != "200" ] || [ "$s2" != "200" ]; then
    note "Couldn't compare Edge Function secrets (HTTP $s1 / $s2)"; return 1
  fi
  missing="$(comm -23 \
    <(jq -r '.[].name' "$WORK/secrets_old.json" | { grep -v '^SUPABASE_' || true; } | sort -u) \
    <(jq -r '.[].name' "$WORK/secrets_new.json" | sort -u) | paste -sd ' ' -)"
  if [ -n "$missing" ]; then note "Edge Function secrets to add in Sydney (Edge Functions > Secrets): $missing"
  else ok "Sydney has every Edge Function secret Tokyo has"; fi
}

# Downloads one live Edge Function from Tokyo into its own folder.
download_fn() { # download_fn <slug> <folder> <log>
  mkdir -p "$2/supabase/functions"
  ( cd "$2" && supabase functions download "$1" --project-ref "$OLD_PROJECT_REF" ) >"$3" 2>&1
}

token_checks() {
  prepare_api
  export SUPABASE_ACCESS_TOKEN
  local s region slug
  s="$(api GET "/projects/$OLD_PROJECT_REF" "$WORK/old.json")"
  if [ "$s" = "200" ]; then note "Tokyo project region: $(jq -r '.region // "unknown"' "$WORK/old.json")"
  else bad "The access token can't see the Tokyo project (HTTP $s)"; fi

  s="$(api GET "/projects/$NEW_PROJECT_REF" "$WORK/new.json")"
  if [ "$s" = "200" ]; then
    region="$(jq -r '.region // "unknown"' "$WORK/new.json")"
    if [ "$region" = "$SYDNEY_REGION" ]; then ok "The new project is in Sydney ($region)"
    else bad "The new project is in $region, not Sydney ($SYDNEY_REGION)"; fi
  else bad "The access token can't see the Sydney project (HTTP $s)"; fi

  s="$(api GET "/projects/$OLD_PROJECT_REF/functions" "$WORK/functions.json")"
  if [ "$s" = "200" ]; then
    while IFS= read -r slug; do
      [ -n "$slug" ] || continue
      if download_fn "$slug" "$WORK/try-$slug" "$WORK/try-$slug.log"; then ok "Edge Function $slug can be copied"
      else bad "Edge Function $slug couldn't be downloaded from Tokyo"; tail -n 3 "$WORK/try-$slug.log" | sed 's/^/    /'; fi
    done < <(jq -r '.[] | select(.status == "ACTIVE") | .slug' "$WORK/functions.json")
  else bad "Couldn't list Tokyo's Edge Functions (HTTP $s)"; fi

  secrets_to_add || true

  s="$(api GET "/projects/$OLD_PROJECT_REF/config/auth" "$WORK/auth_old.json")"
  if [ "$s" = "200" ]; then
    ok "Read Tokyo's sign-in settings"
    if [ "$(jq -r '.external_google_enabled // false' "$WORK/auth_old.json")" = "true" ]; then
      if google_secret_readable "$WORK/auth_old.json"; then note "Google sign-in is on, and its secret can be copied across automatically"
      else note "Google sign-in is on. Its secret can't be read back, so it needs pasting into Sydney once"; fi
    fi
  else bad "Couldn't read Tokyo's sign-in settings (HTTP $s)"; fi

  s="$(api GET "/projects/$NEW_PROJECT_REF/api-keys?reveal=false" "$WORK/keys_new.json")"
  if [ "$s" = "200" ]; then
    if jq -e 'any(.[]; .name == "anon") and any(.[]; .name == "service_role")' "$WORK/keys_new.json" >/dev/null; then
      ok "Sydney has the anon and service_role keys the app uses"
    else
      bad "Sydney has no anon or service_role keys. The app needs a small change before the switch (see the runbook)"
    fi
  else note "Couldn't check Sydney's API keys (HTTP $s)"; fi
}

# ------------------------------------------------------------------ steps ---

step_check() {
  say "Checking everything. Nothing gets changed in this step."
  check_inputs
  local s
  for s in OLD_DB_URL NEW_DB_URL SUPABASE_ACCESS_TOKEN; do
    if has "$s"; then ok "Secret $s is set"; else bad "Secret $s is missing"; fi
  done
  for s in OLD_DB_PASSWORD NEW_DB_PASSWORD; do
    if has "$s"; then ok "Secret $s is set"; fi
  done
  resolve_db_url OLD_DB_URL
  resolve_db_url NEW_DB_URL
  if has SUPABASE_ACCESS_TOKEN; then token_checks || true; fi
  if has OLD_DB_URL && has NEW_DB_URL; then db_ready || true; fi
  finish "All clear. Ready for copy-database." \
         "Fix the ✗ lines above, then run check again. Nothing was changed."
}

step_copy_database() {
  say "Copying the database. Tokyo is only read from."
  check_inputs
  has OLD_DB_URL || die "Secret OLD_DB_URL is missing"
  has NEW_DB_URL || die "Secret NEW_DB_URL is missing"
  resolve_db_url OLD_DB_URL
  resolve_db_url NEW_DB_URL
  db_ready || die "Not copying. Fix the line above and run check again. Nothing was changed."
  workdir
  dump_old "$WORK" || die "Couldn't read the Tokyo database. Nothing was changed."
  ok "Read Tokyo's tables, data and logins"
  restore_new "$WORK" || die "Sydney didn't accept the copy. Nothing was saved there, so it's safe to fix and run again."
  ok "Wrote everything into Sydney in one go"
  if psql_quiet "$NEW_DB_URL" -f "$HERE/post-restore.sql" >/dev/null; then ok "Sign-up trigger is in place"
  else bad "Couldn't put the sign-up trigger in place"; fi
  verify_copy || true
  finish "Database copied. Next step: copy-functions." \
         "The data is in Sydney, but something above needs a look before going further."
}

step_copy_functions() {
  say "Copying the Edge Functions exactly as they run in Tokyo."
  check_inputs
  has SUPABASE_ACCESS_TOKEN || die "Secret SUPABASE_ACCESS_TOKEN is missing"
  export SUPABASE_ACCESS_TOKEN
  prepare_api
  local s slug verify ws log flags slugs=()
  s="$(api GET "/projects/$OLD_PROJECT_REF/functions" "$WORK/functions.json")"
  [ "$s" = "200" ] || die "Couldn't list Tokyo's Edge Functions (HTTP $s)"
  mapfile -t slugs < <(jq -r '.[] | select(.status == "ACTIVE") | .slug' "$WORK/functions.json")
  [ "${#slugs[@]}" -gt 0 ] || die "Tokyo has no active Edge Functions to copy"
  for slug in "${slugs[@]}"; do
    if [[ ! "$slug" =~ ^[A-Za-z0-9_-]+$ ]]; then bad "Skipped an Edge Function with an unexpected name"; continue; fi
    verify="$(jq -r --arg s "$slug" '.[] | select(.slug == $s) | .verify_jwt' "$WORK/functions.json")"
    ws="$WORK/fn-$slug"; log="$WORK/fn-$slug.log"
    if ! download_fn "$slug" "$ws" "$log"; then
      bad "$slug couldn't be downloaded from Tokyo"; tail -n 3 "$log" | sed 's/^/    /'; continue
    fi
    flags=()
    if [ "$verify" = "false" ]; then flags+=(--no-verify-jwt); fi
    if ( cd "$ws" && supabase functions deploy "$slug" --project-ref "$NEW_PROJECT_REF" ${flags[@]+"${flags[@]}"} ) >"$log" 2>&1; then
      ok "$slug copied"
    else
      bad "$slug wasn't accepted by Sydney"; tail -n 3 "$log" | sed 's/^/    /'
    fi
  done
  secrets_to_add || true
  finish "Edge Functions copied. Next step: copy-auth-settings." \
         "Some Edge Functions need a look (the ✗ lines). The rest were copied."
}

step_copy_auth_settings() {
  say "Copying the sign-in settings."
  check_inputs
  has SUPABASE_ACCESS_TOKEN || die "Secret SUPABASE_ACCESS_TOKEN is missing"
  prepare_api
  local s google
  s="$(api GET "/projects/$OLD_PROJECT_REF/config/auth" "$WORK/auth_old.json")"
  [ "$s" = "200" ] || die "Couldn't read Tokyo's sign-in settings (HTTP $s)"
  mask "$(jq -r '.external_google_secret // empty' "$WORK/auth_old.json")"
  google="$(jq -r '.external_google_enabled // false' "$WORK/auth_old.json")"
  jq '{site_url, uri_allow_list, external_google_enabled, external_google_client_id, external_google_secret}
      | with_entries(select(.value != null and .value != ""))
      | if ((.external_google_secret // "") | test("^[*•x]+$")) then del(.external_google_secret) else . end' \
    "$WORK/auth_old.json" > "$WORK/auth_patch.json"
  s="$(api PATCH "/projects/$NEW_PROJECT_REF/config/auth" "$WORK/auth_new.json" "$WORK/auth_patch.json")"
  if [ "$s" = "200" ]; then ok "Copied: $(jq -r 'keys | join(", ")' "$WORK/auth_patch.json")"
  else bad "Sydney didn't accept the sign-in settings (HTTP $s)"; fi
  if [ "$google" = "true" ] && ! jq -e 'has("external_google_secret")' "$WORK/auth_patch.json" >/dev/null; then
    note "Google's client secret didn't come across. Paste it in Sydney: Authentication > Sign In / Providers > Google."
  fi
  note "In Google Cloud, add this to the sign-in client's Authorized redirect URIs: https://$NEW_PROJECT_REF.supabase.co/auth/v1/callback"
  finish "Sign-in settings copied. Next: the switch in Vercel (see the runbook)." \
         "The sign-in settings need a look (the ✗ lines)."
}

main() {
  case "$STEP" in
    check)              step_check ;;
    copy-database)      step_copy_database ;;
    copy-functions)     step_copy_functions ;;
    copy-auth-settings) step_copy_auth_settings ;;
    *) die "Unknown step '$STEP'. Use check, copy-database, copy-functions or copy-auth-settings." ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
