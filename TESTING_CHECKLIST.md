# Testing & Demo Checklist

Use this checklist to verify that all systems, Docker configurations, and the API Gateway are functioning correctly.

## 1. Starting the Environment Locally
- [ ] Ensure Docker Engine is running on your machine.
- [ ] Open a terminal in the root directory `d:\Y4S1\CTSE---Assignment`.
- [ ] Run the following command:
  ```bash
  docker-compose up --build -d
  ```
- [ ] Verify that all 6 containers are running (`frontend`, `event-service`, `ticket-service`, `user-service`, `payment-service`).
  ```bash
  docker ps
  ```

## 2. Service Health Tests
Test the services directly via their exposed ports.

- [ ] **Event Service Route**: 
  - `GET http://localhost:4000/api/events/health` (Assuming service has a health route, adjust path as necessary)
- [ ] **Ticket Service Route**:
  - `GET http://localhost:5000/api/tickets/health`
- [ ] **User Service Route**:
  - `GET http://localhost:3000/api/users/health`
- [ ] **Payment Service Route**:
  - `GET http://localhost:6000/api/payments/health`

## 3. Database Persistence Test
- [ ] Create an entity (User/Event) using a POST request via the API Gateway.
- [ ] Run `docker-compose down`.
- [ ] Run `docker-compose up -d`.
- [ ] Verify that the entity still exists across container restarts (validating `mongodb_data` volume is working).

## 4. CI/CD Verification
- [ ] Commit and push a minor code change or a README update to the `main` branch.
- [ ] Navigate to the **Actions** tab in GitHub.
- [ ] Verify that the `CI/CD Pipeline` workflow triggers.
- [ ] Check `SonarCloud Analysis` job completes without failing quality gates.
- [ ] Check `Build & Push to DockerHub` creates new images with the latest commit SHA.
- [ ] (If Azure is configured) Check `Deploy to Azure Container Apps` successfully updates the revisions.

## 5. Security & Routing Check
- [ ] Make a direct request to `http://localhost:4000/api/events`. It should work locally since ports are mapped.
- [ ] *For Production*: Assuming you use Azure API Management, verify that attempting to access a specific Container App URL directly bypasses the Azure API Management is denied (by configuring internal ingress for the apps).

## 6. Authentication Hardening & Google OIDC

- [ ] **Weak password rejection**: `POST /api/users/register` with a short/simple
      password (e.g. `"1"` or `"password"`) → expect **400** and no account created.
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:7000/api/users/register \
    -H 'Content-Type: application/json' \
    -d '{"name":"Weak","email":"weak@test.com","password":"1"}'
  ```
- [ ] **Strong password accepted**: same request with e.g. `"Str0ngPass1"` → expect **201**.
- [ ] **Brute-force lockout**: send 6 rapid bad-password login attempts for the same
      account → the 6th (and beyond, within the 15‑minute window) returns **429**.
  ```bash
  for i in 1 2 3 4 5 6; do
    curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:7000/api/users/login \
      -H 'Content-Type: application/json' \
      -d '{"email":"weak@test.com","password":"WrongPass1"}'
  done
  ```
- [ ] **Google OIDC login (manual walkthrough)**:
  - [ ] Ensure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and
        `OAUTH_SUCCESS_REDIRECT` are set in `.env` (see `.env.example`).
  - [ ] Open the frontend login page (`/users/login`) and click **Continue with Google**.
  - [ ] Confirm you land on Google's account chooser / consent screen (not an error).
  - [ ] Approve consent and confirm the browser redirects to `/oauth/callback` and then
        automatically to `/events`, logged in (name/role visible in the UI).
  - [ ] Confirm the URL bar no longer shows `#token=...` after the redirect completes
        (the fragment is cleared via `history.replaceState`).
  - [ ] **Negative case**: revisit the callback URL a second time with the same
        `code`/`state` query string (or wait >10 minutes and retry) → expect a
        friendly error on `/oauth/callback`, not a raw JSON response.
  - [ ] **Unconfigured case**: with Google env vars unset, `GET /api/users/auth/google`
        → expect **503** `"Google sign-in is not configured on this server"`.
