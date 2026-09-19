# SE4030 – Secure Software Development Assignment
## EventHub – Secure Microservices Event Ticketing Platform

### Group Members

| Index Number | Name |
|--------------|------|
| IT22207272 | Fonseka G N V S |
| IT22228062 | Jayasinghe I A S A |
| IT22049872 | Navod W D C |
| IT22246332 | Hettiarachchi H A S L |

### Project Links

- **Original project (before fixes):** https://github.com/wahallu/CTSE---Assignment
- **Modified project (after fixes):** _<add the new GitHub repository URL here after pushing>_
- **YouTube demonstration (max 20 min):** _<add the unlisted YouTube link here>_

> The modified repository must preserve the detailed commit history in this
> branch (`security-fixes`). See `git log` for one commit per vulnerability fix.

---

## What the application is

EventHub is an event‑ticketing web application built as **five Node.js /
Express microservices** behind an **API Gateway**, with a **React (Vite)**
single‑page front end and **MongoDB** for storage:

| Service | Port | Responsibility |
|---------|------|----------------|
| API Gateway | 7000 | Single entry point, authentication, routing, rate limiting |
| User Service | 3000 | Registration, login, accounts, roles, Google OIDC |
| Event Service | 4000 | Events and seat inventory |
| Ticket Service | 5000 | Bookings |
| Payment Service | 6000 | Payments |
| Frontend | 80 | React SPA |

The original code was last committed before the semester start date and is not
a teaching/deliberately‑vulnerable app.

---

## Vulnerabilities identified and fixed (7+ distinct)

A black‑box exploit harness (`security-tests/exploits.sh`) confirms each item.
It reports **17 vulnerable / 0 safe** against the original code and
**0 vulnerable / 17 safe** after the fixes (see `security-tests/results/`).

1. Mass‑assignment privilege escalation – register with `role:"admin"`
2. Hard‑coded / default JWT secret (`"eventhub"`) + committed DB credentials
3. Broken access control / IDOR on user accounts (list all, edit/reset any, self‑promote)
4. Missing authentication on event management (anyone can create/edit/delete events)
5. Business‑logic tampering – client‑controlled ticket price & status
6. Business‑logic tampering – client‑controlled payment amount & status
7. IDOR on tickets and payments (read/cancel others', list everyone's)
8. NoSQL operator injection (`?userId[$ne]=…`)
9. Security misconfiguration – permissive CORS, missing security headers, leaked errors
10. Weak password policy and no login brute‑force protection
11. Race condition / seat overselling (fixed with atomic reservation)

Full details, evidence and fixes are in **`report/EventHub-Security-Report.pdf`**.

---

## New feature – Sign in with Google (OpenID Connect)

An OpenID Connect **Authorization Code flow with PKCE** was added to the User
Service (`userservice/src/controllers/oauthController.js`) and the login page.
It uses `state` (CSRF), `nonce` (replay), ID‑token validation and verified‑email
checks. Configure the Google credentials in `.env` (see `.env.example`).

---

## Running locally

```bash
cp .env.example .env      # then fill in the secrets
docker compose up --build
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Running the security tests

```bash
ADMIN_BOOTSTRAP_EMAIL=admin@eventhub.local \
ADMIN_BOOTSTRAP_PASSWORD='<bootstrap password>' \
GATEWAY=http://localhost:7000 \
bash security-tests/exploits.sh
```
