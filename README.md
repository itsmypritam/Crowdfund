## 🎯 Crowdfund 
<img width="1891" height="902" alt="lanidng page" src="https://github.com/user-attachments/assets/f32b1d1f-94f4-4c5e-abe1-ed7029c91ec8" />

<img width="1631" height="832" alt="image" src="https://github.com/user-attachments/assets/756d2ae0-04d5-4f4a-b7d1-247bd9084e5f" />


##Multiple wallets supoort
<img width="1372" height="911" alt="multiple wallet" src="https://github.com/user-attachments/assets/0e172dcb-9e8f-4eb3-8982-68d157c5d1cf" />
<img width="1567" height="865" alt="success9999" src="https://github.com/user-attachments/assets/d4f71a2e-ba08-4a2d-ade1-fb9c19fc6e17" />


A decentralized crowdfunding platform built on **Stellar Soroban** with multi-wallet support and real-time WebSocket updates.

[![CI](https://github.com/itsmypritam/-stellar-tip-jar/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/-stellar-tip-jar/actions/workflows/ci.yml)
![Test Status](https://img.shields.io/badge/tests-6%20passing-brightgreen)

## Live Demo

- **Frontend**:[ https://warriorpinto-6k1ikg.stormkit.dev/ (Stormkit)](https://warriorpinto-6k1ikg.stormkit.dev/)
- **Backend API**: https://stellar-tip-jar.onrender.com
- **Backend Health**: https://stellar-tip-jar.onrender.com/health






https://github.com/user-attachments/assets/d55b5894-b587-4db2-a9c5-9e2b82c3fd55




## Features

- **Multi-Wallet** – Connect via Freighter, Albedo, LOBSTR, or xBull
- **Smart Contract** – Campaign logic runs on-chain via a Soroban contract
- **Real-Time Feed** – Donations appear instantly via WebSocket
- **Transaction Status** – Track pending/success/fail states with Stellar Expert links
- **Campaign Dashboard** – Progress bar, donor list, live feed
- **Mobile Responsive** – Fully responsive UI built with Tailwind CSS
- **CI/CD** – Automated test and build pipeline via GitHub Actions

## Requirements

- Node.js >= 22
- Rust (for contract compilation)

## Setup

### 1. Frontend

```bash
npm install --ignore-scripts
npm run dev
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```


##Mobile Responsiveness

<img width="120" height="150" alt="WhatsApp Image 2026-07-04 at 6 56 35 AM" src="https://github.com/user-attachments/assets/bd298c29-bade-4a1c-a15d-69850591d89e" />
<img width="120" height="150" alt="WhatsApp Image 2026-07-04 at 6 56 26 AM" src="https://github.com/user-attachments/assets/44f26c93-492b-49af-9fa5-237bc667e0a0" />

### 3. Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
# Run all tests
npm test

# Or backend tests only
cd backend && npm test
```

### Test Results
<img width="1918" height="780" alt="ci pritamdev" src="https://github.com/user-attachments/assets/f1129fa0-43e2-4362-8aba-698e93042618" />
<img width="1647" height="672" alt="ci passed" src="https://github.com/user-attachments/assets/724fcc62-a1de-4b54-9107-f1f8b67ac23b" />

```

✓ server.test.mjs (6 tests)
  ✓ GET / → returns service info with status running
  ✓ GET /health → returns ok status
  ✓ POST /api/contract-id → saves and returns contractId
  ✓ POST /api/contract-id → clears contractId when empty
  ✓ POST /api/donation → returns 400 when fields missing
  ✓ POST /api/donation → accepts valid donation and returns ok
```

## Architecture

```
├── src/                # Astro + React frontend
│   ├── components/
│   │   ├── TipJar.tsx  # Main crowdfunding component
│   │   └── ui/         # shadcn components
│   └── pages/
├── backend/            # Express.js + WebSocket
│   ├── server.js       # HTTP + WebSocket server
│   ├── server.test.mjs # API tests
│   └── package.json
├── contract/           # Soroban Rust contract
│   ├── Cargo.toml
│   └── src/lib.rs
└── scripts/            # Deployment scripts
```

## Smart Contract
<img width="1912" height="933" alt="doanted tip" src="https://github.com/user-attachments/assets/3d91cdd7-803e-4c07-a6ad-39be531b543e" />




<img width="1918" height="852" alt="555" src="https://github.com/user-attachments/assets/b2927b22-cdd8-4943-8f58-e8ce892547af" />


The Soroban contract (`contract/src/lib.rs`) supports:
- `initialize` – Set up a campaign with owner, goal, deadline, title, description
- `donate` – Contribute XLM to the campaign (caps at goal)
- `withdraw` – Owner withdraws funds after campaign ends or goal is reached
- `get_campaign` – View campaign details
- `get_donors` – Paginated donor list
- `get_donor_count` – Total donor count

### Contract Details

- **Network**: Stellar Testnet
- **Contract ID**: `CAZZTPKG54TM5CGPPZQSQWAEYRGKGWM2PDR232TUMZITK3JYKSGCUT5S`
- **Deployment Tx**: [`63ea3ad51e915382bf901ea5282151f885d1244a56476b6d262e24d74456d784`](https://stellar.expert/explorer/testnet/tx/63ea3ad51e915382bf901ea5282151f885d1244a56476b6d262e24d74456d784)
- **WASM Upload Tx**: [`c69b31a9f4eef9b5bf6d4bee6aad5e9abf7f957bd98f1a77e17b485e606117f3`](https://stellar.expert/explorer/testnet/tx/c69b31a9f4eef9b5bf6d4bee6aad5e9abf7f957bd98f1a77e17b485e606117f3)



<img width="1911" height="876" alt="transacion" src="https://github.com/user-attachments/assets/c2ab652a-1e5d-4da5-8df1-c4f27a33877c" />

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
1. Backend: Install dependencies + Run tests
2. Frontend: Install dependencies + Build

## Error Handling

The app handles 5+ error types:
1. **Wallet not found** – No wallet extension detected
2. **Transaction rejected** – User cancelled signing
3. **Insufficient balance** – Account has low XLM
4. **Contract errors** – Simulation/execution failures with descriptive messages
5. **HostError (WasmVm, InvalidAction)** – WASM/SDK version mismatch (Protocol 27 requires soroban-sdk >=27)

### Known SDK Quirks (v16+)

- `simulateContract` was removed in `@stellar/stellar-sdk` v16 — use `simulateTransaction()` with `TransactionBuilder` instead
- Write-path simulations (donate, init, withdraw) must include `authMode: "record"` so `require_auth()` doesn't fail during unsigned simulation
- Read-only simulations need a dummy source account — use any valid testnet address

## Commits

- 10+ meaningful commits with descriptive messages
- Full project history: https://github.com/itsmypritam/-stellar-tip-jar/commits/master

## Submission

- **Level**: 3 - Orange belt
- **Demo Video**: *(link to 1-2 min video)*
- **Screenshots**: See `/screenshots/` directory

## License

MIT
