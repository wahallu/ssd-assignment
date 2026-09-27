# Fonseka's Video Demonstration Script

**Presenter:** Fonseka G N V S — IT22207272  
**Target time:** 4 to 5 minutes  
**Topics:** Introduction, architecture, secrets, JWT security, and the API Gateway
trust boundary

This version uses simple spoken English. Do not read file names or code line by
line. Show the important part, explain it, and move to the next screen.

## Before recording

1. Start the fixed application using `LOCAL_SETUP.md`.
2. Confirm the frontend opens at <http://localhost:5173>.
3. Confirm the gateway is running at <http://localhost:7100>.
4. Increase the terminal and VS Code font size.
5. Hide bookmarks, notifications, passwords, `.env.local`, and all real secrets.
6. Open these files before recording:
   - `README.md`
   - `security-tests/results/before-fixes.txt`
   - `security-tests/results/after-fixes.txt`
   - `apigateway/src/config/env.js`
   - `apigateway/src/app.js`
   - `userservice/src/middlewares/security.js`
7. Open a terminal at the repository root for the live commands below.

**Important:** Never show the old database password or the contents of any real
environment file in the recording. It is enough to say that a credential was
committed and was later removed and rotated.

## Screen plan

| Time | What to show | Main point |
|---|---|---|
| 0:00–0:45 | README title, members, and architecture table | Introduce EventHub |
| 0:45–1:20 | Service folders in VS Code | Explain the architecture |
| 1:20–1:55 | Before and after result files | Show evidence of improvement |
| 1:55–2:35 | Old JWT line, then current `config/env.js` | Explain the secret problem and fix |
| 2:35–3:10 | Terminal: missing-secret test and forged JWT test | Demonstrate fail-fast and HTTP 401 |
| 3:10–4:10 | Gateway `app.js` and backend `internalAuth` | Explain the trust boundary |
| 4:10–4:35 | Terminal: direct backend request | Demonstrate HTTP 403 |
| 4:35–4:50 | Result files or architecture table | Summarize and hand over |

## Full spoken script and screen actions

### 0:00–0:45 — Introduction

**Show:** The top of `README.md`, including the project name and group members.

**Say:**

> Hello, I am Fonseka, and my student ID is IT22207272. This is our Secure
> Software Development assignment. Our application is called EventHub. It is an
> event ticket booking system. We reviewed the original application, found its
> security problems, fixed them, and tested the fixed version.

**Show:** Scroll to the architecture table in `README.md`.

**Say:**

> The system has a React frontend, one API Gateway, and four backend services.
> They are the User, Event, Ticket, and Payment services. MongoDB stores the
> application data. The browser should communicate through the API Gateway.

### 0:45–1:20 — Architecture

**Show:** The VS Code Explorer. Point to these folders without opening every file:

- `frontend`
- `apigateway`
- `userservice`
- `eventservice`
- `ticketservice`
- `paymentservice`

**Say:**

> The frontend sends API requests to the gateway. The gateway checks the user
> token and sends valid requests to the correct service. This gives us one
> controlled entry point instead of trusting every service separately.

### 1:20–1:55 — Security-test evidence

**Show:** `security-tests/results/before-fixes.txt`. Highlight the final line:
`17 vulnerable / 0 safe`.

**Say:**

> We created the same black-box security tests for both versions. In the
> original version, all seventeen checks were vulnerable.

**Show:** `security-tests/results/after-fixes.txt`. Highlight the final line:
`0 vulnerable / 17 safe`.

**Say:**

> After our fixes, the same seventeen checks were safe. These files are saved
> evidence from our test runs. Now I will demonstrate two of my security fixes.

### 1:55–2:35 — Weak JWT secret and secret management

**Show the old code safely:** In a terminal, run:

```bash
git show 54f42bc^:apigateway/src/middleware/auth.js | nl -ba | sed -n '16,24p'
```

Point to this old expression:

```text
process.env.JWT_SECRET || "eventhub"
```

**Say:**

> In the original gateway, the JWT secret had a default value called
> `eventhub`. An attacker who knows this value can create a fake token and claim
> to be an administrator. The original repository also contained a database
> credential. I will not show that credential in this video.

**Show:** `apigateway/src/config/env.js`. Highlight the required-variable check
and the minimum JWT-secret length check.

**Say:**

> In the fixed version, there is no default secret. Secrets come from environment
> variables and are not stored in the source code. The gateway refuses to start
> if the JWT secret or internal API key is missing. It also requires a JWT secret
> of at least thirty-two characters.

### 2:35–3:10 — Live security demonstrations

#### Demo A: missing secrets stop the gateway

**Show:** Run this command in a new terminal. It does not stop the already running
gateway on port 7100.

```bash
cd apigateway
env -u JWT_SECRET -u INTERNAL_API_KEY node src/app.js
cd ..
```

**Point to:** The fatal missing-variable message.

**Say:**

> This is fail-fast security. The service stops instead of silently using an
> unsafe secret.

#### Demo B: forged token is rejected

**Show:** From the repository root, paste this complete block:

```bash
FORGED_TOKEN=$(node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({id:"000000000000000000000000",email:"attacker@test.com",role:"admin",exp:Math.floor(Date.now()/1000)+3600});process.stdout.write(h+"."+p+"."+c.createHmac("sha256","eventhub").update(h+"."+p).digest("base64url"))')
curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  -H "Authorization: Bearer $FORGED_TOKEN" \
  http://localhost:7100/api/users
unset FORGED_TOKEN
```

**Expected result:**

```text
HTTP 401
```

**Say:**

> This token claims that the attacker is an administrator and is signed with
> the old default secret. The fixed gateway returns HTTP 401, which means the
> fake token is not accepted.

Do not display or read the generated token. Only show the HTTP result.

### 3:10–4:10 — API Gateway trust boundary

**Show:** `apigateway/src/app.js`. Use VS Code search to find
`delete req.headers`.

**Say:**

> We also made the gateway the trust boundary. First, it removes identity and
> internal-key headers sent by the client. This prevents a user from sending a
> fake admin role in a request header.

**Show:** Search for `injectTrust` in the same file. Point to the internal key,
user ID, role, and email headers.

**Say:**

> After checking a real JWT, the gateway adds the trusted user ID and role. It
> also adds a private internal service key. The same key is shared only between
> the gateway and backend services.

**Show:** `userservice/src/middlewares/security.js`. Highlight the `internalAuth`
function and its HTTP 403 response.

**Say:**

> Every backend service checks this internal key. If a request did not come
> through the gateway, the service rejects it. The key comparison is also done
> safely using a constant-time comparison.

### 4:10–4:35 — Direct-access demonstration

**Show:** Run this command:

```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://localhost:3000/api/users
```

**Expected result:**

```text
HTTP 403
```

**Say:**

> Here I called the User Service directly, without the API Gateway and without
> the internal key. It returns HTTP 403 Forbidden. This proves that a client
> cannot directly access the protected backend API.

### 4:35–4:50 — Summary and handover

**Show:** Return to the architecture table or the fixed-results file.

**Say:**

> To summarize, we removed unsafe default secrets, moved secrets to environment
> configuration, rejected forged tokens, and made the API Gateway the trusted
> entry point. Now I will hand over to Jayasinghe to explain access control and
> IDOR vulnerabilities.

## Quick command card

Keep this section open off-screen in case you need to copy a command.

```bash
# Confirm the fixed gateway is running
curl -s http://localhost:7100/

# Show the old weak-secret line without checking out old code
git show 54f42bc^:apigateway/src/middleware/auth.js | nl -ba | sed -n '16,24p'

# Show that missing secrets stop startup
(cd apigateway && env -u JWT_SECRET -u INTERNAL_API_KEY node src/app.js)

# Direct backend access must be forbidden
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/api/users
```

## Recording tips

- Speak slowly and pause after each terminal result.
- Keep the mouse still while speaking.
- Highlight only one small code section at a time.
- Say “HTTP four-oh-one” and “HTTP four-oh-three,” not “four hundred and one.”
- Do not show `.env.local`, tokens, database credentials, browser passwords, or
  private account details.
- If a live command fails, show the saved result files and continue speaking.
- Perform one practice recording and keep your section below five minutes.
