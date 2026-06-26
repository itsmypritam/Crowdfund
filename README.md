# ☕ Tip Jar – Stellar Testnet dApp

A responsive Stellar Tip Jar landing page built with **Astro** + **React** + **shadcn/ui** for the Stellar White Belt challenge. Connect your Freighter wallet and send XLM tips instantly on testnet.

## Features

- **Wallet Integration** – Connect / disconnect Freighter wallet
- **Balance Display** – Fetch and show XLM balance from Horizon testnet
- **Send XLM** – Make payments with optional memo to a fixed tip jar address
- **QR Code** – Scan to copy the tip jar address
- **Transaction Feedback** – Success / error state with explorer link
- **Landing Page** – Hero, features, testimonials, and CTA sections with Unsplash imagery
- **Dark Mode** – Built-in dark theme via shadcn/ui CSS variables

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
4. Connect your wallet on the Tip Jar page
5. Enter an amount and optionally a memo, then click "Send Tip"

## Screenshots

| Wallet Connected | Balance Displayed | Transaction Sent |
|---|---|---|
| *(screenshot)* | *(screenshot)* | *(screenshot)* |

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
│   ├── ui/                 # shadcn primitives (button, card, input, badge, avatar)
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
