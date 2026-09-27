# Security & Secrets Strategy

This document outlines the security practices and secret management strategy for the Event Management System.

## 1. Local Development
For local development, secrets are stored in `.env` files.
- **Never commit `.env` files to version control.** They are included in `.gitignore`.
- Reference the `.env.example` files in each service directory to see which variables need to be configured.

### Required Environment Variables (Local)
- `MONGODB_URI`: Connection string for MongoDB. (Default in docker-compose: `mongodb://mongodb:27017/<service_db>`)
- `PORT`: Port the service runs on.
- `JWT_SECRET`: Secret key used for signing JSON Web Tokens in `UserService` and API Gateway (if applicable).

## 2. CI/CD Pipeline (GitHub Actions)
The CI/CD pipeline requires several secrets to function correctly. These must be added to your repository settings under **Settings > Secrets and variables > Actions**.

### Required GitHub Secrets
| Secret Name           | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `DOCKER_USERNAME`     | DockerHub username for pushing images.                                      |
| `DOCKER_PASSWORD`     | DockerHub personal access token or password.                                |
| `SONAR_TOKEN`         | Token generated from SonarCloud for code analysis.                          |
| `AZURE_CREDENTIALS`   | Service Principal JSON for Azure Container Apps deployment.                 |

## 3. Production Deployment (Azure Container Apps)
In production, environment variables should be securely injected into the containers.

- Use **Azure Key Vault** to store highly sensitive information like database connection strings and JWT secrets.
- Map the Key Vault secrets to the Container Apps environment variables.
- Ensure that the Azure Container Apps environment is configured to restrict traffic to the API Gateway only. Internal services (`event-service`, `ticket-service`, `user-service`, `payment-service`) should not have public endpoints enabled.

## 4. API Security
- The API Gateway is the single point of entry. Implement Rate Limiting and CORS policies at the gateway level.
- Authentication: Generate JWTs in the `UserService` and validate them in the API Gateway before routing to protected endpoints.

## 5. OAuth / OpenID Connect Secrets (Sign in with Google)

The Google sign-in feature (`userservice/src/controllers/oauthController.js`) introduces
its own secret, `GOOGLE_CLIENT_SECRET`, alongside `JWT_SECRET` and the database
credentials above. It follows the same rules — local `.env` only, never committed,
injected via Key Vault / Container Apps in production — plus a few points specific
to OAuth:

- **The client secret never reaches the browser.** The frontend only ever
  redirects the user to `GET /api/users/auth/google`; the authorization code
  is exchanged for tokens in a server-to-server call
  (`userservice` → `https://oauth2.googleapis.com/token`) where
  `GOOGLE_CLIENT_SECRET` is attached. No client-side code, response, or log
  line ever contains it.
- **Feature is optional and fails closed.** `isConfigured()` requires all of
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` to be
  set; if any are missing, the endpoints return `503` instead of starting an
  insecure or half-configured flow. This means the secret can be safely
  omitted in environments (e.g. a reviewer's local machine) that don't need
  Google login.
- **Short-lived flow state, not a session secret.** `state`, `nonce` and the
  PKCE `code_verifier` are held in a cookie signed with the existing
  `JWT_SECRET` (10-minute expiry) rather than a new secret or a server-side
  session store — one fewer secret to provision and rotate.
- **The application token, not Google's, is what the app trusts.** After the
  ID token is validated (signature, audience, issuer, expiry, `email_verified`),
  the user service issues its own JWT signed with `JWT_SECRET`. Google's
  tokens are never stored or forwarded to the frontend.
- **Rotation:** if `GOOGLE_CLIENT_SECRET` ever leaks (e.g. committed by
  mistake, or the flow cookie is discussed while `JWT_SECRET` is
  reused elsewhere), rotate it in Google Cloud Console under the OAuth
  Client's credentials, then update the secret store — the same "rotate,
  don't just delete from the file" rule as the JWT secret and DB credentials
  in Section 1.
