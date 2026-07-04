## 🎯 Crowdfund 
<img width="1891" height="902" alt="lanidng page" src="https://github.com/user-attachments/assets/f32b1d1f-94f4-4c5e-abe1-ed7029c91ec8" />

<img width="1631" height="832" alt="image" src="https://github.com/user-attachments/assets/756d2ae0-04d5-4f4a-b7d1-247bd9084e5f" />


##Multiple wallets supoort
<img width="1372" height="911" alt="multiple wallet" src="https://github.com/user-attachments/assets/0e172dcb-9e8f-4eb3-8982-68d157c5d1cf" />

A decentralized crowdfunding platform built on **Stellar Soroban** with multi-wallet support and real-time WebSocket updates.

[![CI](https://github.com/itsmypritam/-stellar-tip-jar/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/-stellar-tip-jar/actions/workflows/ci.yml)
![Test Status](https://img.shields.io/badge/tests-6%20passing-brightgreen)

## Live Demo

- **Frontend**:[ https://warriorpinto-6k1ikg.stormkit.dev/ (Stormkit)](https://warriorpinto-6k1ikg.stormkit.dev/)
- **Backend API**: https://stellar-tip-jar.onrender.com
- **Backend Health**: https://stellar-tip-jar.onrender.com/health

https://github.com/user-attachments/assets/6b0a0a4e-7ca8-4014-bb6e-b65d3a850200


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
- **Contract ID**: `CCYDMK3BVXFDNJVORCXHY5ZGTDACQG5HHKFDQ4PCECCU4SEYNZGEJT5E`
- **Deployment Tx**: [`2a96982e00893989d57e8430c8bed7e119b21ec2f3d740d5663b78851df0d6a6`](https://stellar.expert/explorer/testnet/tx/2a96982e00893989d57e8430c8bed7e119b21ec2f3d740d5663b78851df0d6a6)
- **WASM Upload Tx**: [`6b7ddc8841a1583861aa80e1b68452f911bcf242dfb9f57bd61db9c7ac5e7fe1`](https://stellar.expert/explorer/testnet/tx/6b7ddc8841a1583861aa80e1b68452f911bcf242dfb9f57bd61db9c7ac5e7fe1)

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
1. Backend: Install dependencies + Run tests
2. Frontend: Install dependencies + Build

## Error Handling

The app handles 4+ error types:
1. **Wallet not found** – No wallet extension detected
2. **Transaction rejected** – User cancelled signing
3. **Insufficient balance** – Account has low XLM
4. **Contract errors** – Simulation/execution failures with descriptive messages

## Commits

- 10+ meaningful commits with descriptive messages
- Full project history: https://github.com/itsmypritam/-stellar-tip-jar/commits/master

## Submission

- **Level**: 2 – Yellow Belt
- **Demo Video**: *(link to 1-2 min video)*
- **Screenshots**: See `/screenshots/` directory

## License

MIT
