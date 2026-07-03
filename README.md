# 🎯 Crowdfund – Stellar Soroban Campaign

A decentralized crowdfunding platform built on **Stellar Soroban** with multi-wallet support, real-time event updates via WebSocket, and a Ruby backend.

## Features

- **Multi-Wallet** – Connect via Freighter, Albedo, LOBSTR, or xBull using Stellar Wallets Kit
- **Smart Contract** – Campaign logic runs on-chain via a Soroban contract
- **Real-Time Feed** – Donations appear instantly via WebSocket (Ruby + faye-websocket)
- **Transaction Status** – Track pending/success/fail states with Stellar Expert links
- **Campaign Dashboard** – View progress bar, donor list, and live feed

## Requirements

- Node.js >= 22
- Ruby >= 3.4
- Rust (for contract compilation)

## Setup

### 1. Frontend

```bash
cd frontend   # or use the root: -stellar-tip-jar
npm install --ignore-scripts
npm run dev
```

### 2. Backend (Ruby)

```bash
cd backend
cp .env.example .env
# Edit .env with your CONTRACT_ID and settings
bundle install
bundle exec puma config.ru
```

### 3. Contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
# Deploy using:
# ruby scripts/deploy.rb
# ruby scripts/initialize_campaign.rb
```

## Architecture

```
├── frontend/          # Astro + React + StellarWalletsKit
│   ├── src/
│   │   ├── components/
│   │   │   ├── TipJar.tsx        # Main crowdfunding component
│   │   │   └── ui/               # shadcn components
│   │   ├── pages/
│   │   │   └── index.astro       # Landing page
│   │   └── styles/
│   │       └── global.css
│   └── package.json
├── backend/           # Ruby Sinatra + faye-websocket
│   ├── server.rb      # HTTP + WebSocket server
│   ├── config.ru      # Rack configuration
│   └── Gemfile
├── contract/          # Soroban Rust contract
│   ├── Cargo.toml
│   └── src/lib.rs
├── scripts/           # Ruby deployment scripts
│   ├── deploy.rb
│   └── initialize_campaign.rb
└── .github/workflows/
    └── ci.yml
```

## Error Handling

The app handles 3+ error types:
1. **Wallet not found** – No wallet extension detected
2. **Transaction rejected** – User cancelled signing
3. **Insufficient balance** – Account has low XLM

## Deployed Contract

**Contract ID:** `CA3WQ3N6N7VSRQV5TV5YJQTQKGWZ3T5KJ5YJZ4KZ3VK7CQZ5J5V6Q3WQ`

*Set this in the frontend UI or in `backend/.env`*

## Transaction Example

View a verified contract call on Stellar Expert:
[Transaction on Stellar Expert](https://stellar.expert/explorer/testnet/tx/PLACEHOLDER_TX_HASH)

## Screenshots

### Wallet Options
![Wallet options](public/screenshot-connected.png)

### Campaign Dashboard
![Campaign dashboard](public/screenshot-balance.png)

### Live Feed
![Live feed](public/screenshot-transaction.png)

## CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
- Ruby syntax checks
- Frontend build
- Contract compilation
