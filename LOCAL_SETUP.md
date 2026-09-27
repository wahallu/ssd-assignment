# Run EventHub Locally Without Docker

This guide runs MongoDB, the five Node.js services, and the Vite frontend
directly on macOS. Docker is not required.

## Local ports

| Component | Port |
|---|---:|
| User Service | 3000 |
| Event Service | 4000 |
| Ticket Service | 5100 |
| Payment Service | 6000 |
| API Gateway | 7100 |
| Vite frontend | 5173 |
| MongoDB | 27017 |

The repository normally uses ports `5000` and `7000` for the Ticket Service
and API Gateway. On macOS those ports may be occupied by Control Center/AirPlay
Receiver, so this guide uses `5100` and `7100` instead.

## 1. Install the prerequisites

Check Node.js and npm:

```bash
node --version
npm --version
```

Node.js 22 and npm 10 were used during local verification.

Install MongoDB with Homebrew if it is not already installed:

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
```

Start MongoDB:

```bash
brew services start mongodb-community@7.0
```

Confirm that it is listening:

```bash
lsof -nP -iTCP:27017 -sTCP:LISTEN
```

## 2. Install the project dependencies

Run these commands from the repository root:

```bash
npm install --no-package-lock --prefix apigateway
npm install --no-package-lock --prefix userservice
npm install --no-package-lock --prefix eventservice
npm install --no-package-lock --prefix ticketservice
npm install --no-package-lock --prefix paymentservice
npm install --no-package-lock --prefix frontend
```

## 3. Create the local environment file

Copy the example file:

```bash
cp .env.example .env.local
echo ".env.local" >> .git/info/exclude
```

The second command prevents your local secrets file from being accidentally
included in this repository. Never commit real secrets.

Generate two different secrets:

```bash
openssl rand -hex 48
openssl rand -hex 48
```

Open `.env.local` and make the following changes. Paste one generated value
into `JWT_SECRET` and the other into `INTERNAL_API_KEY`:

```dotenv
USER_MONGODB_URI=mongodb://127.0.0.1:27017/eventhub_users
EVENT_MONGODB_URI=mongodb://127.0.0.1:27017/eventhub_events
TICKET_MONGODB_URI=mongodb://127.0.0.1:27017/eventhub_tickets
PAYMENT_MONGODB_URI=mongodb://127.0.0.1:27017/eventhub_payments

JWT_SECRET=PASTE_THE_FIRST_GENERATED_SECRET_HERE
INTERNAL_API_KEY=PASTE_THE_SECOND_GENERATED_SECRET_HERE

CORS_ORIGINS=http://localhost:5173

ADMIN_BOOTSTRAP_EMAIL=admin@eventhub.local
ADMIN_BOOTSTRAP_PASSWORD='LocalAdmin!2026'

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:7100/api/users/auth/google/callback
OAUTH_SUCCESS_REDIRECT=http://localhost:5173/oauth/callback
```

Google sign-in is optional. Normal email/password registration and login work
when the Google values are empty.

## 4. Start the backend services

Open five terminal tabs or windows. Run one block in each terminal from the
repository root.

### Terminal 1 — User Service

```bash
cd userservice
set -a
source ../.env.local
set +a
PORT=3000 MONGODB_URI="$USER_MONGODB_URI" npm start
```

### Terminal 2 — Event Service

```bash
cd eventservice
set -a
source ../.env.local
set +a
PORT=4000 MONGODB_URI="$EVENT_MONGODB_URI" npm start
```

### Terminal 3 — Ticket Service

```bash
cd ticketservice
set -a
source ../.env.local
set +a
PORT=5100 \
MONGODB_URI="$TICKET_MONGODB_URI" \
EVENT_SERVICE_URL=http://127.0.0.1:4000 \
npm start
```

### Terminal 4 — Payment Service

```bash
cd paymentservice
set -a
source ../.env.local
set +a
PORT=6000 \
MONGODB_URI="$PAYMENT_MONGODB_URI" \
TICKET_SERVICE_URL=http://127.0.0.1:5100 \
npm start
```

### Terminal 5 — API Gateway

```bash
cd apigateway
set -a
source ../.env.local
set +a
PORT=7100 \
USER_SERVICE_URL=http://127.0.0.1:3000 \
EVENT_SERVICE_URL=http://127.0.0.1:4000 \
TICKET_SERVICE_URL=http://127.0.0.1:5100 \
PAYMENT_SERVICE_URL=http://127.0.0.1:6000 \
npm start
```

Keep these terminals open while using the application.

## 5. Start the frontend

Open a sixth terminal at the repository root:

```bash
cd frontend
VITE_API_URL=http://localhost:7100 npm run dev -- --host 127.0.0.1
```

Open the application at:

<http://localhost:5173>

Use `localhost` in the browser rather than `127.0.0.1`, because the configured
CORS origin is `http://localhost:5173`.

The local bootstrap administrator is:

```text
Email:    admin@eventhub.local
Password: LocalAdmin!2026
```

The administrator is only created when no administrator already exists in the
user database. Changing `ADMIN_BOOTSTRAP_PASSWORD` later does not reset an
existing administrator's password.

## 6. Verify the application

Check the gateway health endpoint:

```bash
curl http://localhost:7100/
```

Expected result:

```json
{"success":true,"service":"API Gateway","status":"running"}
```

Check the public events endpoint:

```bash
curl http://localhost:7100/api/events
```

Check all local listeners:

```bash
lsof -nP \
  -iTCP:3000 -iTCP:4000 -iTCP:5100 -iTCP:6000 \
  -iTCP:7100 -iTCP:5173 -sTCP:LISTEN
```

## 7. Stop the application

Press `Ctrl+C` once in each of the six application terminals.

MongoDB may remain running for later development. To stop it too, run:

```bash
brew services stop mongodb-community@7.0
```

## Port troubleshooting

To see which program owns a required port:

```bash
lsof -nP -iTCP:7100 -sTCP:LISTEN
```

If you want to use the repository's original ports `5000` and `7000`, disable
AirPlay Receiver in macOS System Settings or stop the process using those
ports. Then replace `5100` with `5000` and `7100` with `7000` everywhere in
this guide.
