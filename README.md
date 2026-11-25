# AkashVault — Production-Grade MERN Authentication System

A complete MERN (`MongoDB`, `Express`, `React`, `Node.js`) authentication application written in ES6+ JavaScript, featuring dual-channel registration (Email or E.164 Phone), OTP ownership verification, a 6-digit PIN login flow, contact-verified PIN recovery, server-enforced single active device sessions, and atomic 5-attempt / 1-hour account lockout.

> **Scope Note**: Biometric / WebAuthn authentication (`Method 2`) is intentionally excluded as requested.

---

## Project Structure

```text
.
├── ARCHITECTURE.md          # System architecture, Mermaid user flows & sequence diagrams, DB design
├── API_DOCS.md              # Complete REST API contract
├── SECURITY.md              # Security controls, threat mitigations & secret rotation
├── package.json             # Workspace helper scripts
├── server/
│   └── src/
│       ├── config/          # Zod-validated env loader & Mongoose DB connection
│       ├── controllers/     # HTTP handlers (thin controller layer)
│       ├── middleware/      # Auth/session guard, CSRF, NoSQL sanitizer, rate limiters, errors
│       ├── models/          # User, PendingRegistration, Session, OTP, SecurityLog
│       ├── routes/          # Express REST router
│       ├── services/        # Auth, OTP, Session, and Email/SMS delivery services
│       ├── utils/           # Crypto, JWT/cookie helpers, AppError/response helpers
│       └── validators/      # Zod schemas & DOB/PIN/email validators
└── client/
    └── src/
        ├── components/      # AuthLayout, AlertBanner, Button, PinCodeInput, ProtectedRoute
        ├── context/         # AuthContext (in-memory user/session state, zero localStorage tokens)
        ├── hooks/           # useCountdown timer hook
        ├── pages/           # Welcome, Register, VerifyOTP, CreatePIN, Login, ForgotPIN,
        │                    # ResetPIN, AccountLocked, SessionReplaced, Dashboard
        ├── routes/          # React Router configuration
        ├── services/        # Axios client (CSRF + silent refresh rotation) & authService
        ├── styles/          # Design tokens & responsive Swiss-fintech CSS
        └── utils/           # Client validation rules & constants
```

---

## Prerequisites

- **Node.js** `>= 20` (tested on `v22.16.0`)
- **npm** `>= 10`
- **MongoDB** `>= 6.0` (local `mongod` or MongoDB Atlas URI)

---

## Quick Setup

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure Environment Variables
Configure `server/.env` and `client/.env` with your database, SMTP, and cryptographic secrets.

Required production secrets (generate 64-byte hex values via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`):
- `JWT_ACCESS_SECRET`
- `JWT_SETUP_SECRET`
- `OTP_HMAC_SECRET`
- `REFRESH_HMAC_SECRET`

#### Email Provider
- **Email (SMTP / Nodemailer)**: Set `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`.
- **Local Development Fallback**: When `NODE_ENV=development` and SMTP credentials are left blank, OTP delivery logs cleanly to the **server terminal console** (`[DEV OTP - EMAIL]`) and is never returned in HTTP responses. In `NODE_ENV=production`, missing provider credentials fail safely with `503`.

---

## Running Locally

Start the Express API server (`http://localhost:5000`):
```bash
npm run dev:server
```

Start the React Vite dev server (`http://localhost:5173`, proxies `/api` to `http://localhost:5000`):
```bash
npm run dev:client
```

---

## Production Build & Deployment Recommendations

Build the React frontend bundle:
```bash
npm run build:client
```

### Production Hardening Checklist
1. Set `NODE_ENV=production` and `COOKIE_SECURE=true` behind TLS/HTTPS termination.
2. Configure `APP_ORIGIN` to your exact HTTPS frontend origin.
3. Use a MongoDB replica set (or Atlas cluster) with TLS and least-privilege DB credentials.
4. Configure real SMTP and Twilio credentials; startup fails cleanly if critical secrets are missing or left as placeholders.
5. Keep `trust proxy` aligned with your reverse proxy hop count (Nginx/Cloudflare/ALB) so `express-rate-limit` and security logs record accurate client IPs.
