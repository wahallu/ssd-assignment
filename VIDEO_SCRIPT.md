# EventHub — YouTube Demonstration Script (4 members, ≤ 20 min)

**Goal:** show the original vulnerabilities, the fixes, and the Google OIDC login,
with every member speaking and doing a live demo. Record with screen share.

**Repos to show on screen**
- Original: https://github.com/wahallu/CTSE---Assignment
- Modified: https://github.com/wahallu/ssd-assignment

**Speaking split (each ≈ 4–5 min)**
| Member | Section |
|--------|---------|
| Fonseka G N V S (IT22207272) | Intro, architecture, secrets & JWT, gateway trust boundary |
| Jayasinghe I A S A (IT22228062) | Access control & IDOR (users, tickets, payments) |
| Navod W D C (IT22049872) | Business logic (price/amount/status), NoSQL injection, seat race |
| Hettiarachchi H A S L (IT22246332) | CORS/headers/passwords/rate-limit, **Google OIDC**, best practices, close |

**Before recording:** start the stack (`docker compose up` or the local run script),
have two terminals open — one running `security-tests/exploits.sh`, one for `curl` —
and the modified repo's commit list open in a browser tab.

---

## 0:00 — Opening (Fonseka)
> "Hi, we're group … . For SE4030 Secure Software Development we took **EventHub**,
> an event‑ticketing app built as five Node.js microservices behind an API gateway
> with a React frontend and MongoDB. Its last commit predates the semester and it's
> not a teaching app. We found **eleven distinct vulnerabilities**, fixed all of
> them, and added **Sign in with Google** using OpenID Connect."

Show: the architecture table in the README; the service folders.

> "Here's our proof harness. Against the **original** code it reports
> **17 vulnerable / 0 safe**; against our **fixed** code, **0 vulnerable / 17 safe**."

Show: `security-tests/results/before-fixes.txt` and `after-fixes.txt` side by side.

## 2:00 — Secrets & JWT + the gateway trust boundary (Fonseka)
> "First finding: the JWT secret defaulted to the literal string `eventhub`, and a
> live MongoDB Atlas password was committed to the repo."

Show original: `apigateway/src/middleware/auth.js` line `process.env.JWT_SECRET || "eventhub"`
and the old `docker-compose.yml` credentials in git history.

Live demo (original running): forge an admin token signed with `eventhub` and call a
protected route:
```bash
# forge a token with the leaked secret and hit an admin route
node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"admin",exp:Math.floor(Date.now()/1e3)+3600});console.log(h+"."+p+"."+c.createHmac("sha256","eventhub").update(h+"."+p).digest("base64url"))'
curl -H "Authorization: Bearer <token>" http://localhost:7000/api/users   # 200 on original
```
> "Our fix: a fail‑fast `config/env.js` refuses to start without a strong 32‑char
> secret and an internal key, all secrets move to `.env`, and — the key architectural
> change — the **gateway is the only place a JWT is verified**. It strips any
> client‑sent identity headers, then injects the internal key and the verified user
> id and role. Every backend service now rejects direct calls."

Show: `apigateway/src/app.js` (strip + injectTrust) and `middlewares/security.js` (`internalAuth`).
Re‑run the forged token on the fixed stack → **401**.

## 5:00 — Access control & IDOR (Jayasinghe)
> "The original let anyone register as an admin — the register endpoint copied the
> `role` from the request body."

Live demo (original): `curl -X POST …/register -d '{"role":"admin",…}'` → admin account.
Show fix: `userController.registerUser` forcing `role:"customer"`.

> "Worse, any logged‑in customer could list every account, reset anyone's password,
> and promote themselves to admin — a classic IDOR."

Live demo (original): as a customer, `GET /api/users` (all users), `PUT /api/users/<self> {"role":"admin"}`, `PUT /api/users/<other> {"password":"…"}` → all succeed.
Show fix: `userRoutes.js` — admin‑only list, `requireSelfOrAdmin`, admin‑only role change.
Re‑run on fixed → **403** each time.

> "The same IDOR existed on tickets and payments — reading and cancelling other
> people's tickets, listing every payment."

Show fix: ticket/payment controllers scoping lists to the token identity and
owner‑or‑admin checks. Re‑run those checks on the fixed stack → **403**.

## 9:30 — Business logic, injection, race (Navod)
> "The app trusted the client for money. Booking accepted a `price` and a `status`,
> so you could book a ticket for **price 0** and mark it **booked**; payments
> accepted an `amount` and `status`, so you could record a **completed 0.00**
> payment and get a confirmed ticket."

Live demo (original): book with `{"price":0,"status":"booked"}`; pay with
`{"amount":0,"status":"completed"}`.
Show fix: ticket price = `event.price × seatCount` server‑side, status forced to
`pending`; payment amount taken from the ticket, status set by the server, user can
only pay for their own ticket. Re‑run on fixed → price 25, status pending; server
charges the real amount.

> "There was NoSQL operator injection — `?userId[$ne]=…` dumped every ticket."

Live demo (original): `GET '/api/tickets?userId[$ne]=x'` → all tickets.
Show fix: list uses the trusted token id, plus a `sanitize()` middleware that strips
`$`/`.` keys. Re‑run → only the caller's ticket.

> "Finally a race condition: seats were read and written in two steps, so concurrent
> bookings could oversell. We replaced it with an **atomic conditional decrement**."

Show: `eventController.reserveSeats` (`findOneAndUpdate` with `availableSeats >= n`).

## 13:30 — Config, passwords, rate‑limit + Google OIDC (Hettiarachchi)
> "Config issues: CORS allowed any origin, no security headers, and errors leaked
> internal messages."

Show: `curl -I -H 'Origin: https://evil.example' …` on original (allowed) vs fixed
(blocked, security headers present, no `X-Powered-By`).

> "Passwords like `1` were accepted and login allowed 100 tries. We enforce ≥ 8 chars
> with letters and numbers and a strict 5‑attempts/15‑min limiter."

Live demo (fixed): weak password → 400; 6 quick bad logins → **429**.

> "Now the new feature — **Sign in with Google** using OpenID Connect."

Live demo (fixed, Google configured): click **Continue with Google** on the login
page → Google consent → redirected back → logged in.
Show: `oauthController.js` and explain the security controls:
> "It's the Authorization Code flow with **PKCE**, a **state** parameter against
> CSRF, a **nonce** against replay, the ID token is validated for signature,
> audience and expiry, and we require Google's **verified email**. The flow secrets
> live in a signed httpOnly cookie, and our app token comes back in the URL fragment
> so it never reaches server logs."

## 17:30 — Commit history, unfixed items, best practices, close (Hettiarachchi)
Show: the modified repo commit list — **one detailed commit per fix**.
> "We documented a few defence‑in‑depth items we left as future work: a real payment
> gateway, token revocation/refresh, and moving the browser token to httpOnly
> cookies. And the practices that would have prevented all of this: never commit
> secrets, deny‑by‑default with least privilege, keep business logic
> server‑authoritative, validate input, and add dependency scanning, SAST and secret
> scanning to CI. Thanks for watching."

---

### Live-demo command cheat sheet (keep off‑screen)
```bash
# run the full before/after check
ADMIN_BOOTSTRAP_EMAIL=admin@eventhub.local ADMIN_BOOTSTRAP_PASSWORD='<pwd>' \
GATEWAY=http://localhost:7000 bash security-tests/exploits.sh

# register + login to get a customer token
curl -s -X POST http://localhost:7000/api/users/register -H 'Content-Type: application/json' \
  -d '{"name":"Demo","email":"demo@test.com","password":"Str0ngPass1"}' | jq -r .token

# IDOR attempt (expect 403 on fixed)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:7000/api/users -H "Authorization: Bearer $TOKEN"

# price tampering (expect price from event, status pending on fixed)
curl -s -X POST http://localhost:7000/api/tickets -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"eventId":"<id>","seatCount":1,"price":0,"status":"booked"}' | jq

# CORS / headers
curl -sI -H 'Origin: https://evil.example' http://localhost:7000/api/events | grep -i 'access-control\|x-content\|x-frame'
```
