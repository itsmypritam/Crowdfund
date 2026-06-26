# ☕ Tip Jar – Stellar Testnet dApp

A responsive, dark-themed Stellar Tip Jar landing page built with **Astro**, **React**, and **shadcn/ui**. Connect your Freighter wallet and send XLM tips instantly on the Stellar testnet.

## Features

- **Wallet Integration** – Connect / disconnect Freighter wallet with session persistence
- **Balance Display** – Fetch and show XLM balance from Horizon testnet (handles unfunded accounts gracefully)
- **Send XLM** – Make payments with optional memo to a fixed tip jar address
- **QR Code** – Scan to copy the tip jar address
- **Transaction Feedback** – Success / error state with Stellar Expert explorer link
- **Landing Page** – Hero, features, testimonials, and CTA sections with Unsplash imagery

## Screenshots

### Wallet Connected

![Wallet connected state](public/screenshot-connected.png)

### Balance Displayed

![Balance displayed](public/screenshot-balance.png)

### Successful Testnet Transaction

![Successful testnet transaction](public/screenshot-transaction.png)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:4321`.

## Usage

1. Install the [Freighter](https://freighter.app) browser extension
2. Switch Freighter to **Stellar Testnet**
3. Fund your wallet via the [Stellar Lab faucet](https://lab.stellar.org/account/fund)
4. Open the app and click **Connect Freighter Wallet**
5. Enter an amount and optionally a memo, then click **Send Tip**

## Tech Stack

| Tool | Purpose |
|---|---|
| [Astro](https://astro.build) | Static site generator |
| [React](https://react.dev) | Interactive component |
| [shadcn/ui](https://ui.shadcn.com) | Component library (base-nova style) |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling |
| [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) | Stellar network SDK |
| [@stellar/freighter-api](https://github.com/stellar/freighter) | Freighter wallet integration |
| [qrcode.react](https://github.com/zpao/qrcode.react) | QR code generation |
| [Unsplash](https://unsplash.com) | Stock photography |

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   └── avatar.tsx
│   └── TipJar.tsx          # Wallet connect, balance, send XLM, QR code
├── lib/
│   └── utils.ts            # cn() utility
├── pages/
│   └── index.astro         # Landing page with all sections
└── styles/
    └── global.css           # Tailwind + shadcn CSS variables
```

