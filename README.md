# Proyecto Centurion – Stellar Fintech Platform

## Overview

Proyecto Centurion is a Fintech payment platform built on the **Stellar network**.
It enables merchants to accept payments in **MXN** (Mexican Peso stablecoin) while
allowing customers to pay using any supported asset — **USD**, **GOLD**, or **XLM** —
with automatic conversion at checkout via Stellar's built-in DEX path payments.

Key features:
- **QR-code checkout** – Merchant generates a QR; customer scans with the Centurion wallet app.
- **NFC / SoftPOS checkout** – Android Chrome (Web NFC API) taps an NFC tag at POS.
- **Path Payments** – Stellar automatically routes USD/GOLD → XLM → MXN in a single atomic transaction.
- **Three custom assets** – MXN (payments), USD (investment), GOLD (investment/store of value).
- **Non-custodial** – The backend never holds private keys. The customer's wallet signs all transactions locally.

---

## Architecture

```
┌────────────┐    HTTPS    ┌──────────────────┐    Horizon API    ┌──────────────────┐
│  Frontend  │────────────▶│  Backend (Node)   │──────────────────▶│  Stellar Testnet │
│ React/Vite │◀────────────│  Express + Knex   │◀──────────────────│  Horizon + DEX   │
└────────────┘             └──────────────────┘                    └──────────────────┘
                                    │
                               ┌────▼────┐
                               │Postgres │
                               │   16    │
                               └─────────┘
```

### Stellar components

| Component | Description |
|-----------|-------------|
| **Horizon API** | REST gateway to Stellar ledger. Testnet: `https://horizon-testnet.stellar.org` |
| **Custom Assets** | MXN, USD, GOLD – each has an *issuer* keypair and a *distributor* keypair |
| **DEX Offers** | The distributor places `manageSellOffer` orders to provide path-payment liquidity |
| **Path Payments** | `pathPaymentStrictReceive` – sender pays `sendMax` of their asset; merchant receives exact MXN |

### Asset roles

| Asset | Purpose | Issuer | Distributor |
|-------|---------|--------|-------------|
| **MXN** | Payment token (merchant receives this) | `MXN_ISSUER_*` | `MXN_DISTRIBUTOR_*` |
| **USD** | Investment / payment source | `USD_ISSUER_*` | `USD_DISTRIBUTOR_*` |
| **GOLD** | Investment / payment source | `GOLD_ISSUER_*` | `GOLD_DISTRIBUTOR_*` |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose (for local full-stack)

### 1. Clone the repo

```bash
git clone <repo-url>
cd seguro-agricola
```

### 2. Install backend dependencies

```bash
cd backend && npm install && cd ..
```

### 3. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

### 4. Install scripts dependencies

```bash
cd scripts && npm install && cd ..
```

### 5. Generate testnet accounts

```bash
cd scripts
npm run setup
```

This generates 6 Stellar keypairs (MXN/USD/GOLD × issuer/distributor),
funds them via Friendbot, and saves them to `scripts/testnet-accounts.json`.

At the end it prints the values you need for `backend/.env`.

### 6. Copy values to backend/.env

```bash
# Create backend/.env (copy the block printed by npm run setup)
cat > backend/.env << 'EOF'
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org

# Paste the values printed by setup-testnet.ts here:
MXN_ISSUER_PUBLIC=G...
MXN_ISSUER_SECRET=S...
MXN_DISTRIBUTOR_PUBLIC=G...
MXN_DISTRIBUTOR_SECRET=S...
USD_ISSUER_PUBLIC=G...
USD_ISSUER_SECRET=S...
USD_DISTRIBUTOR_PUBLIC=G...
USD_DISTRIBUTOR_SECRET=S...
GOLD_ISSUER_PUBLIC=G...
GOLD_ISSUER_SECRET=S...
GOLD_DISTRIBUTOR_PUBLIC=G...
GOLD_DISTRIBUTOR_SECRET=S...

DB_CLIENT=pg
DATABASE_URL=postgresql://centurion:centurion_dev@localhost:5432/centurion
PORT=3001
JWT_SECRET=change-me-in-production
EOF
```

### 7. Issue MXN / USD / GOLD assets

```bash
cd scripts
npm run issue
```

Each asset's distributor creates a trustline, the issuer mints 1,000,000 tokens,
and an initial DEX offer is placed to seed liquidity.

### 8. Add DEX liquidity depth

```bash
npm run liquidity
```

Adds 3-tier offer books for each pair plus direct USD/MXN cross-pair offers.

### 9. Verify payment paths

```bash
npm run verify
```

Calls Horizon's strict-receive path-find API for USD→MXN, GOLD→MXN, and
XLM→MXN routes. Exits with code 1 if no viable paths are found.

### 10. Start the backend

```bash
cd ../backend
npm run dev
```

Backend runs on `http://localhost:3001`.

### 11. Start the frontend

```bash
cd ../frontend
npm run dev
```

Frontend runs on `http://localhost:3000`.

### Docker Compose (full stack)

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend:  `http://localhost:3001`
- Postgres: `localhost:5432`

---

## Payment Flow

```
Customer Wallet                   Backend                        Stellar Network
──────────────                   ───────                        ───────────────
GET /api/qr/session/:token  ──▶  Load session, verify
                            ◀──  { merchantAddr, amountMxn }

POST /api/payment/quote     ──▶  Horizon path-find (strict-receive)
  { sendAsset, destAmount } ◀──  { quoteId, sendMax, path, expiresAt }

POST /api/payment/build     ──▶  Load sender account sequence
  { quoteId, senderAddr }   ◀──  { paymentId, unsignedXdr }

[Wallet signs XDR locally]

POST /api/payment/submit    ──▶  submitTransaction(signedXdr)  ──▶  Ledger close
  { paymentId, signedXdr }            Update DB status         ◀──  tx hash
                            ◀──  { paymentId, txHash, status: SETTLED }
```

The entire payment (path conversion + delivery to merchant) is **atomic** –
either all hops succeed or the whole transaction reverts. No partial fills.

---

## QR Payment Flow

1. **Merchant POS** calls `POST /api/qr/session` with `merchantAddress` + `amountMxn`.
2. Backend generates a random token, stores the session in Postgres, returns a QR image (base64 PNG).
3. Merchant displays the QR on their screen / receipt printer.
4. **Customer** opens the Centurion wallet, scans the QR code.
5. Wallet deep-links to `/pay?token=<token>`, fetches session details, then follows the Payment Flow above.
6. On settlement, the QR session status transitions to `SETTLED` and the merchant POS can poll for confirmation.

Session TTL is configurable (default: 5 minutes). Expired sessions return HTTP 410.

---

## NFC Payment (SoftPOS)

The SoftPOS flow uses the **Web NFC API**, available in Android Chrome 89+.

1. **Merchant POS** writes an NFC payload (`{ sessionToken, merchantName, issuedAt }`) to an NFC tag via `NDEFWriter`.
2. **Customer** taps their Android phone to the tag. Chrome reads the tag and opens a deep-link in the Centurion wallet PWA.
3. The wallet extracts `sessionToken`, validates `issuedAt` (rejects tags older than 5 minutes), then follows the standard Payment Flow.

Requirements:
- Android Chrome 89+ on the customer's device.
- The merchant device must support Web NFC writing (Android Chrome, NFC-enabled hardware).
- HTTPS is required for Web NFC (enforced in production; use `localhost` for dev).

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/qr/session` | Create a QR checkout session |
| `GET`  | `/qr/session/:token` | Poll a session by token |
| `POST` | `/payment/quote` | Get a path-payment quote |
| `POST` | `/payment/build` | Build unsigned Stellar XDR |
| `POST` | `/payment/submit` | Submit signed XDR to network |
| `GET`  | `/payment/:id` | Get payment details / receipt |
| `GET`  | `/account/:address` | Get account balances & trustlines |
| `GET`  | `/rates` | Get live USD/MXN and GOLD/MXN rates |
| `GET`  | `/health` | Health check (used by Docker) |

All error responses follow the `ApiError` shape:

```json
{
  "code": "QUOTE_EXPIRED",
  "message": "The quote has expired. Please request a new one.",
  "details": null
}
```

---

## Project Structure

```
seguro-agricola/
├── backend/
│   ├── src/
│   │   ├── config/        ← env config, asset definitions
│   │   ├── db/            ← Knex migrations & query helpers
│   │   ├── middleware/     ← auth, error handler, rate limiter
│   │   ├── routes/        ← Express route handlers
│   │   ├── services/      ← business logic (payments, QR, rates)
│   │   ├── stellar/       ← Horizon client, path-find, tx builder
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    ← Reusable UI components
│   │   ├── hooks/         ← React hooks (usePayment, useNFC, …)
│   │   ├── pages/         ← Route-level page components
│   │   ├── store/         ← Zustand / Redux state
│   │   └── config/        ← API base URL, Stellar network config
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── scripts/
│   ├── setup-testnet.ts   ← Generate & fund keypairs
│   ├── issue-assets.ts    ← Issue MXN/USD/GOLD on-chain
│   ├── create-liquidity.ts← DEX offer depth
│   ├── verify-path.ts     ← Route verification
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   └── types/
│       ├── centurion.ts   ← Core domain types
│       └── api.ts         ← Request/Response DTOs
├── docker-compose.yml
└── README.md
```

---

## Environment Variables (backend/.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `STELLAR_NETWORK` | `testnet` or `mainnet` | `testnet` |
| `HORIZON_URL` | Horizon endpoint | `https://horizon-testnet.stellar.org` |
| `MXN_ISSUER_PUBLIC` | G… public key of MXN issuer | |
| `MXN_ISSUER_SECRET` | S… secret key of MXN issuer | |
| `MXN_DISTRIBUTOR_PUBLIC` | G… public key | |
| `MXN_DISTRIBUTOR_SECRET` | S… secret key | |
| `USD_ISSUER_PUBLIC` | G… | |
| `USD_ISSUER_SECRET` | S… | |
| `USD_DISTRIBUTOR_PUBLIC` | G… | |
| `USD_DISTRIBUTOR_SECRET` | S… | |
| `GOLD_ISSUER_PUBLIC` | G… | |
| `GOLD_ISSUER_SECRET` | S… | |
| `GOLD_DISTRIBUTOR_PUBLIC` | G… | |
| `GOLD_DISTRIBUTOR_SECRET` | S… | |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://centurion:centurion_dev@localhost:5432/centurion` |
| `PORT` | HTTP port | `3001` |
| `JWT_SECRET` | Secret for signing JWTs | (generate with `openssl rand -hex 32`) |
| `QUOTE_TTL_SECONDS` | Quote expiry in seconds | `30` |
| `SESSION_TTL_SECONDS` | QR session expiry in seconds | `300` |

---

## License

MIT — see [LICENSE](LICENSE).
