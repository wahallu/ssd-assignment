# Access Control & IDOR — screen-recording guide
**Presenter: Jayasinghe I A S A (IT22228062)** · EventHub / SE4030
Target length: **4–5 minutes**

This is your slice of the group demo (video script section 5:00–9:30). You show
three access-control bugs from the *original* code, then prove your fixes block
them in the *modified* code, and explain the idea behind them.

Two files:
- `demo-access-control.sh` — runs the attacks and prints **INSECURE** (attack got
  through) or **SECURE** (blocked). Run it once against each version.
- this guide — what to say and click while recording.

---

## A. Before you hit record (setup, do this off-camera)

You need the stack running and `jq` installed (`brew install jq` on macOS).

**Terminal layout:** open **two terminals** side by side.
- **Left** = the app (docker compose logs).
- **Right** = where you run `demo-access-control.sh`.

### 1. Record the ORIGINAL first
```bash
# in the repo root, check out the original code on a temp branch
git switch -c demo-original 149e090        # 149e090 = last pre-fix commit
docker compose up --build                  # leave running in the LEFT terminal
```
Wait until the gateway line appears. Then in the RIGHT terminal:
```bash
bash demo-access-control.sh ORIGINAL
```
Press Enter to step through. You will see mostly **INSECURE**. Stop the stack
(`Ctrl-C`, then `docker compose down`) when done.

### 2. Record the FIXED next
```bash
git switch main                            # back to your fixed code
docker compose up --build                  # LEFT terminal
```
The fixed run needs an admin login (to create the event), so pass the same admin
values you put in your `.env`:
```bash
ADMIN_EMAIL=admin@eventhub.local ADMIN_PASSWORD='<your ADMIN_BOOTSTRAP_PASSWORD>' \
  bash demo-access-control.sh FIXED
```
You will see all **SECURE**.

> Tip: run each once. Re-running many times can trip the login rate-limiter
> (that's V10, a different member's part). If it does, wait 15 min or restart the
> gateway.

---

## B. What to say while recording (script)

### 0:00 — Hand-off / intro (~20s)
> "Thanks [previous member]. I'm Jayasinghe, and my part is **access control** —
> making sure a logged-in user can only do what they're allowed to. The original
> app checked *whether* you were logged in, but never checked *what you own or
> whether you're an admin*. I'll show three bugs from that, and the fixes.
> Everything I do here is as an ordinary customer called **Alice**, attacking
> another customer **Bob**."

*(On screen: have the `userRoutes.js` and `ticketController.js` files open in a tab
to point at later.)*

### 0:20 — Run the ORIGINAL demo (~1min 40s)
Start `bash demo-access-control.sh ORIGINAL`. Step through and narrate:

- **V1 – register as admin:**
  > "First, registration. I send my signup with an extra field, `role: admin`.
  > The server copies it straight in — so I just created an **admin account from
  > the public signup page**. That's called **mass assignment**."

- **V3a – list all users:**
  > "As a normal customer I call GET /api/users and get **every account** in the
  > system — names, emails, IDs."

- **V3b / V3c – IDOR on accounts:**
  > "I can PUT to my own record and set `role: admin` to **promote myself**, and I
  > can PUT to *Bob's* record and change his password — **account takeover**.
  > Changing an ID in the URL to someone else's is called **IDOR**, Insecure
  > Direct Object Reference."
  > *(If these two show a red 500 error instead of success on your machine, say:
  > "this endpoint erred out on our DB, but the point is there's no ownership
  > check here at all.")*

- **V6a / V6b / V6c – IDOR on tickets & payments:**
  > "Same story on bookings: I read Bob's tickets, I cancel Bob's ticket, and I
  > list **every payment in the system** — other people's money data. None of
  > these check who owns the record."

Point at the summary: *"So on the original code, almost everything is INSECURE."*

### 2:00 — Show the fix in code (~40s)
Switch to your editor. Point at two things:

1. `userservice/src/routes/userRoutes.js`:
   > "I added guards. `GET /` is now **admin-only**. The `:id` routes use
   > **requireSelfOrAdmin** — you must be the owner or an admin. And in the
   > controller, `role` can only be changed by an admin, and only `name`, `email`,
   > `password` are accepted — a **whitelist**, so you can't mass-assign `role`."

2. `ticketController.js` / `paymentController.js`:
   > "For tickets and payments the identity comes from the **verified token**
   > (`req.auth.userId`), never from the request body. Lists are **scoped** to your
   > own id, and every record is checked with **owner-or-admin**. Payment edits and
   > deletes are admin-only."

### 2:40 — Run the FIXED demo (~1min 20s)
Start `ADMIN_EMAIL=... ADMIN_PASSWORD=... bash demo-access-control.sh FIXED`.
Step through:
> "Same attacks, fixed code. Register as admin → I'm forced to **customer**. List
> all users → **403 Forbidden**. Promote myself → **403**. Reset Bob's password →
> **403**. Read Bob's tickets, cancel his ticket → **403**. And payments — I only
> ever see **my own**."

Point at the summary: *"Every check is now SECURE."*

### 4:00 — One-line wrap (~15s)
> "So: identity always comes from the verified token, users can't escalate their
> own role, and every record is limited to its owner or an admin. This is OWASP
> **A01, Broken Access Control**, the number-one risk. Over to [next member] for
> the business-logic bugs."

---

## C. Quick reference — the mapping (keep this beside you)

| Demo check | Attack (as Alice) | Original | Fixed | File that fixes it |
|---|---|---|---|---|
| V1  | register with `role:admin` | becomes admin | forced `customer` | `userController.registerUser` |
| V3a | GET /api/users | lists all | 403 | `userRoutes.js` (requireAdmin) |
| V3b | PUT own id `{role:admin}` | self-promotes | 403 | `updateUser` role check |
| V3c | PUT Bob's id `{password}` | takeover | 403 | `requireSelfOrAdmin` |
| V6a | GET /tickets/user/Bob | reads his | 403 | `getTicketsByUserId` |
| V6b | PUT Bob's ticket `{cancelled}` | cancels his | 403 | `isOwnerOrAdmin` |
| V6c | GET /api/payments | sees all | own only | `getAllPayments` scope |

**401 vs 403** (likely viva question): 401 = not logged in / bad token
(authentication). 403 = logged in but not allowed (authorization). Your fixes
return **403** — the user is known, just not permitted.

## D. If a step misbehaves on camera
- A one-off **500** on register/PUT is a proxy timing hiccup — the script retries
  it automatically; if it still shows, just re-run that step.
- **429 Too Many Requests** = rate limit from re-running; restart the gateway.
- Nothing here modifies data permanently that matters — every run makes fresh
  Alice/Bob accounts.
