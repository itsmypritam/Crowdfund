# Stellar Tip Jar

A decentralized crowdfunding platform built on **Stellar Soroban** with multi-wallet support and real-time WebSocket updates.

## Features

- **Multi-Wallet** – Connect via Freighter, Albedo, LOBSTR, or xBull
- **Smart Contract** – Campaign logic runs on-chain via a Soroban contract
- **Real-Time Feed** – Donations appear instantly via WebSocket
- **Transaction Status** – Track pending/success/fail states with Stellar Expert links
- **Campaign Dashboard** – Progress bar, donor list, live feed

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

## Architecture

```
├── src/                # Astro + React frontend
│   ├── components/
│   │   ├── TipJar.tsx  # Main crowdfunding component
│   │   └── ui/         # shadcn components
│   └── pages/
├── backend/            # Express.js + WebSocket
│   ├── server.js       # HTTP + WebSocket server
│   └── package.json
├── contract/           # Soroban Rust contract
│   ├── Cargo.toml
│   └── src/lib.rs
└── scripts/            # Deployment scripts
```

## Error Handling

The app handles 3+ error types:
1. **Wallet not found** – No wallet extension detected
2. **Transaction rejected** – User cancelled signing
3. **Insufficient balance** – Account has low XLM

## CI

GitHub Actions workflow runs:
- Backend lint
- Frontend build
- Contract compilation
