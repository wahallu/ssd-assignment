#!/usr/bin/env bash
# ------------------------------------------------------------------
# EventHub - Access Control & IDOR demo  (Jayasinghe I A S A, IT22228062)
# Shows the same checks against the running gateway and prints, per step,
# whether the access-control check PASSED (blocked) or FAILED (allowed).
#
#   Original code:  bash demo-access-control.sh ORIGINAL
#   Fixed code:     ADMIN_EMAIL=admin@eventhub.local ADMIN_PASSWORD='<pwd>' \
#                   bash demo-access-control.sh FIXED
#
# Options:  GATEWAY=http://localhost:7000 (default)   NOPAUSE=1
# Needs:    curl, jq
# ------------------------------------------------------------------
set -u
LABEL="${1:-}"
GW="${GATEWAY:-http://localhost:7000}"
RUN="$(date +%s)$RANDOM"
PW='Str0ngPass1'

R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[1;36m'; D=$'\e[2m'; W=$'\e[1m'; N=$'\e[0m'

command -v jq >/dev/null || { echo "jq is required (macOS: brew install jq)"; exit 1; }
curl -s -o /dev/null "$GW/" || { echo "Gateway not reachable at $GW - start the stack first."; exit 1; }

CODE=""; BODY=""
call() {
  local m=$1 p=$2 t=${3:-} d=${4:-}
  local args=(-s -o /tmp/eh_demo_body -w '%{http_code}' -H 'Connection: close' -X "$m" "$GW$p")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  local tries=0
  while :; do
    CODE=$(curl "${args[@]}"); BODY=$(cat /tmp/eh_demo_body)
    # The gateway proxy can very occasionally drop a POST body (a known
    # http-proxy-middleware timing quirk); retry that transient 500 so the
    # demo is deterministic. Real auth failures (401/403) are never retried.
    echo "$BODY" | grep -q "req.body" && [ $tries -lt 4 ] && { tries=$((tries+1)); sleep 0.4; continue; }
    break
  done
  sleep 0.2
}
j() { echo "$BODY" | jq -r "$1" 2>/dev/null; }
pause() { [ "${NOPAUSE:-0}" = "1" ] && { echo; return; }; echo; read -r -p "${D}   press Enter for next step${N}" _; echo; }
title() { echo; echo "${B}=== $1 ===${N}"; }
req() { echo "   ${W}Try:${N} $1"; }
declare -a SUMMARY
verdict() {
  if [ "$2" = "1" ]; then echo "   ${R}RESULT: attack succeeded${N} - $3"; SUMMARY+=("${R}INSECURE${N}  $1")
  else echo "   ${G}RESULT: blocked${N} - $3"; SUMMARY+=("${G}SECURE  ${N}  $1"); fi
}

clear 2>/dev/null
echo "${W}EventHub - Access Control & IDOR demo${N}   version: ${Y}${LABEL:-?}${N}   gateway: $GW"
echo "${D}Presenter: Jayasinghe I A S A (IT22228062)${N}"

# ---------- set-up ----------
title "Set-up: two customers - Alice (attacker) and Bob (victim)"
call POST /api/users/register "" "{\"name\":\"Alice\",\"email\":\"alice$RUN@test.com\",\"password\":\"$PW\"}"
ALICE=$(j .token); ALICE_ID=$(j .data.id)
call POST /api/users/register "" "{\"name\":\"Bob\",\"email\":\"bob$RUN@test.com\",\"password\":\"$PW\"}"
BOB=$(j .token); BOB_ID=$(j .data.id)
echo "   Alice id: ${Y}$ALICE_ID${N}"
echo "   Bob   id: ${Y}$BOB_ID${N}"
echo "   Both are ordinary customers. Alice's token is used for every attack below."

ADMIN=""
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  call POST /api/users/login "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
  ADMIN=$(j '.token // empty')
fi
pause

# ---------- V1 ----------
title "V1  Mass assignment: sign up as an admin"
req "POST /api/users/register  with  \"role\":\"admin\"  in the body"
call POST /api/users/register "" "{\"name\":\"Mallory\",\"email\":\"mallory$RUN@test.com\",\"password\":\"$PW\",\"role\":\"admin\"}"
ROLE=$(j '.data.role // empty')
echo "   Server saved this new account with role = ${Y}${ROLE:-none}${N}"
[ "$ROLE" = "admin" ] && verdict "V1  register as admin" 1 "public signup created an ADMIN account" \
                      || verdict "V1  register as admin" 0 "role forced to '$ROLE'; client value ignored"
pause

# ---------- V3a ----------
title "V3a  IDOR: list every user account"
req "GET /api/users   (as customer Alice)"
call GET /api/users "$ALICE"
echo "   HTTP $CODE, accounts returned: ${Y}$(j '.count // 0')${N}"
[ "$CODE" = "200" ] && verdict "V3a list all users" 1 "customer read the whole user table" \
                    || verdict "V3a list all users" 0 "HTTP $CODE (admin only)"
pause

# ---------- V3b ----------
title "V3b  Privilege escalation: promote myself to admin"
req "PUT /api/users/<Alice's own id>   {\"role\":\"admin\"}   (as Alice)"
call PUT "/api/users/$ALICE_ID" "$ALICE" '{"role":"admin"}'
NROLE=$(j '.data.role // empty')
echo "   HTTP $CODE, Alice's role is now: ${Y}${NROLE:-unchanged}${N}"
[ "$NROLE" = "admin" ] && verdict "V3b self-promote" 1 "customer became admin" \
                       || verdict "V3b self-promote" 0 "HTTP $CODE, role unchanged"
pause

# ---------- V3c ----------
title "V3c  Account takeover: reset another user's password"
req "PUT /api/users/<Bob's id>   {\"password\":\"...\"}   (as Alice)"
call PUT "/api/users/$BOB_ID" "$ALICE" '{"password":"hacked_by_alice1"}'
echo "   HTTP $CODE"
[ "$CODE" = "200" ] && verdict "V3c reset Bob's password" 1 "Alice changed Bob's password" \
                    || verdict "V3c reset Bob's password" 0 "HTTP $CODE (owner or admin only)"
pause

# ---------- set-up an event + Bob's ticket for the ticket/payment checks ----------
title "Set-up for ticket/payment checks: Bob books a ticket"
EVENT_ID=""
# original code: anyone can create an event; fixed code: needs the admin token
call POST /api/events "${ADMIN:-}" "{\"name\":\"Concert\",\"location\":\"Colombo\",\"date\":\"2030-01-01\",\"availableSeats\":50,\"price\":25}"
EVENT_ID=$(j '.data._id // empty')
if [ -z "$EVENT_ID" ]; then
  call GET /api/events; EVENT_ID=$(echo "$BODY" | jq -r '.data[0]._id // empty' 2>/dev/null)
fi
echo "   event id: ${Y}${EVENT_ID:-<none>}${N}"
# Bob books (original wants price/status in body; fixed derives them - sending extra fields is harmless)
call POST /api/tickets "$BOB" "{\"eventId\":\"$EVENT_ID\",\"userId\":\"$BOB_ID\",\"seatCount\":1,\"price\":25,\"status\":\"booked\"}"
BOB_TICKET=$(j '.data._id // empty')
echo "   Bob's ticket id: ${Y}${BOB_TICKET:-<none>}${N}"
pause

# ---------- V6a ----------
title "V6a  IDOR: read another user's tickets"
req "GET /api/tickets/user/<Bob's id>   (as Alice)"
call GET "/api/tickets/user/$BOB_ID" "$ALICE"
NT=$(j '.count // 0')
echo "   HTTP $CODE, Bob's tickets visible to Alice: ${Y}$NT${N}"
{ [ "$CODE" = "200" ] && [ "$NT" != "0" ]; } && verdict "V6a read Bob's tickets" 1 "Alice saw Bob's booking" \
                                             || verdict "V6a read Bob's tickets" 0 "HTTP $CODE (owner or admin only)"
pause

# ---------- V6b ----------
title "V6b  IDOR: cancel another user's ticket"
req "PUT /api/tickets/<Bob's ticket>   {\"status\":\"cancelled\"}   (as Alice)"
call PUT "/api/tickets/$BOB_TICKET" "$ALICE" '{"status":"cancelled"}'
echo "   HTTP $CODE"
[ "$CODE" = "200" ] && verdict "V6b cancel Bob's ticket" 1 "Alice cancelled Bob's ticket" \
                    || verdict "V6b cancel Bob's ticket" 0 "HTTP $CODE (owner or admin only)"
pause

# ---------- V6c ----------
title "V6c  IDOR: see everyone's payments"
# make sure a payment belonging to Bob exists
call POST /api/payments "$BOB" "{\"ticketId\":\"$BOB_TICKET\",\"userId\":\"$BOB_ID\",\"amount\":25,\"paymentMethod\":\"card\",\"status\":\"completed\"}" >/dev/null
req "GET /api/payments   (as Alice)"
call GET /api/payments "$ALICE"
TOTAL=$(j '.count // 0')
OTHERS=$(echo "$BODY" | jq -r --arg me "$ALICE_ID" '[.data[]? | select(.userId != $me)] | length' 2>/dev/null)
echo "   HTTP $CODE, total payments returned: ${Y}$TOTAL${N}, of which belong to OTHER users: ${Y}${OTHERS:-0}${N}"
{ [ "$CODE" = "200" ] && [ "${OTHERS:-0}" -gt 0 ] 2>/dev/null; } && verdict "V6c see others' payments" 1 "Alice saw other users' payment records" \
                                                                 || verdict "V6c see others' payments" 0 "Alice only sees her own payments"
pause

# ---------- summary ----------
title "Summary  (version: ${LABEL:-?})"
for line in "${SUMMARY[@]}"; do echo "   $line"; done
echo
echo "${D}   INSECURE = the check failed, the attack got through (expected on ORIGINAL).${N}"
echo "${D}   SECURE   = the server returned 403 / scoped the data (expected on FIXED).${N}"
