# ☕ Tip Jar – Stellar Testnet dApp

A minimal Stellar Tip Jar page built with **Astro** + **React** for the Stellar White Belt challenge.

## Features

- Connect / disconnect Freighter wallet
- View connected wallet's XLM balance
- Send XLM tips to a fixed testnet address
- QR code for the tip jar address
- Transaction success/failure feedback
- Links to Stellar Expert explorer for confirmed txs

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

## Built With

- [Astro](https://astro.build)
- [React](https://react.dev)
- [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk)
- [@stellar/freighter-api](https://github.com/stellar/freighter)
- [qrcode.react](https://github.com/zpao/qrcode.react)
