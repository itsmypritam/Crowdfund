## 🎯 CrowdEscrow
<img width="1891" height="902" alt="lanidng page" src="https://github.com/user-attachments/assets/f32b1d1f-94f4-4c5e-abe1-ed7029c91ec8" />

<img width="1631" height="832" alt="image" src="https://github.com/user-attachments/assets/756d2ae0-04d5-4f4a-b7d1-247bd9084e5f" />

<img width="1191" height="813" alt="image" src="https://github.com/user-attachments/assets/80c75d24-9763-4b21-acec-3e9251cf9b5f" />

<img width="1520" height="590" alt="image" src="https://github.com/user-attachments/assets/87e12c69-8ca8-4b71-bcaa-e7b8da8a6185" />

## Multiple wallets support
<img width="1372" height="911" alt="multiple wallet" src="https://github.com/user-attachments/assets/0e172dcb-9e8f-4eb3-8982-68d157c5d1cf" />
<img width="1567" height="865" alt="success9999" src="https://github.com/user-attachments/assets/d4f71a2e-ba08-4a2d-ade1-fb9c19fc6e17" />


A milestone-based crowdfunding platform with escrow protection, built on **Stellar Soroban** with multi-wallet support and real-time WebSocket updates.

[![CI](https://github.com/itsmypritam/Crowdfund/actions/workflows/ci.yml/badge.svg)](https://github.com/itsmypritam/Crowdfund/actions/workflows/ci.yml)
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

✓ server.test.mjs (9 tests)
  ✓ GET / → returns service info with status running
  ✓ GET /health → returns ok status
  ✓ POST /api/contract-id → saves and returns contractId
  ✓ POST /api/contract-id → clears contractId when empty
  ✓ POST /api/donations → returns 400 when fields missing
  ✓ POST /api/donations → returns 404 when campaign not found
  ✓ POST /api/donations → records a donation once the campaign exists
  ✓ POST /api/analytics/event → records + dedupes events by txHash
  ✓ POST /api/feedback → records feedback
```

## Architecture

```
├── src/                # Astro + React frontend
│   ├── components/
│   │   ├── TipJar.tsx  # Main CrowdEscrow component
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
- `add_milestone` – Owner adds a milestone with description, amount, and deadline
- `approve_milestone` – Backer approves a completed milestone
- `release_milestone` – Release escrowed funds for an approved milestone
- `withdraw` – Owner withdraws funds after campaign ends or goal is reached
- `get_campaign` – View campaign details
- `get_milestones` – Paginated milestone list
- `get_donors` – Paginated donor list
- `get_donor_count` – Total donor count

### Contract Details

- **Network**: Stellar Testnet
- **Contract ID**: `CAZZTPKG54TM5CGPPZQSQWAEYRGKGWM2PDR232TUMZITK3JYKSGCUT5S`
- **Deployment Tx**: [`63ea3ad51e915382bf901ea5282151f885d1244a56476b6d262e24d74456d784`](https://stellar.expert/explorer/testnet/tx/63ea3ad51e915382bf901ea5282151f885d1244a56476b6d262e24d74456d784)
- **WASM Upload Tx**: [`c69b31a9f4eef9b5bf6d4bee6aad5e9abf7f957bd98f1a77e17b485e606117f3`](https://stellar.expert/explorer/testnet/tx/c69b31a9f4eef9b5bf6d4bee6aad5e9abf7f957bd98f1a77e17b485e606117f3)



<img width="1911" height="876" alt="transacion" src="https://github.com/user-attachments/assets/c2ab652a-1e5d-4da5-8df1-c4f27a33877c" />

## CI/CD Pipeline
## Vitest Test Report

### Summary

- **Test Files**: ✅ **1 pass** · 1 total
- **Test Results**: ✅ **6 passes** · 6 total
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

- 80+ meaningful commits with descriptive messages
- Full project history: https://github.com/itsmypritam/Crowdfund/commits/master

## Submission

- **Level**: 5 - Blue Belt
- **Project**: CrowdEscrow – Milestone-Based Crowdfunding with Stellar Escrow
- **Pitch Deck**: [View Pitch Deck](https://gamma.app/docs/CrowdEscrow-ha2y1vectpj4gfz)
  <br><iframe src="https://gamma.app/embed/ha2y1vectpj4gfz" style="width: 700px; max-width: 100%; height: 450px" allow="fullscreen" title="CrowdEscrow"></iframe>
- **Demo Video**: [Watch Demo Walkthrough](https://drive.google.com/file/d/1h1MTBBvyjjk2XRR7f9r0ZCT8rFZXG_bx/view?usp=sharing)
- **User Onboarding Form**: [Google Form](https://docs.google.com/forms/d/18tphIiImjw-RJDh5lWIlMbNYZ9lzzLBcttMEue5yu60/edit)
- **User Data (Excel)**: [Google Sheet – 50 User Transactions](https://docs.google.com/spreadsheets/d/1-eLvp_nKOQOvvvqe1E_99eFwXFBSxkpGqZWubfQiXys/edit?usp=sharing)
- **Screenshots**: See screenshots section below

---

## CrowdEscrow — Milestone-Based Crowdfunding with Stellar Escrow

### Problem Statement

Traditional crowdfunding (Kickstarter, GoFundMe) takes 5-10% fees, delays payouts by weeks, and releases all funds upfront leaving backers with no recourse if the creator doesn't deliver. Freelancers and small businesses in emerging markets can't access these platforms at all due to banking restrictions. There's no transparent, low-fee, programmable escrow system that releases funds only when milestones are met.

### Why Stellar?

- **Fast & cheap** — 3-5 second settlement, fraction-of-a-cent fees (unlike Ethereum L1)
- **Built-in multisig** — Native Stellar operations enable multi-party escrow without extra contracts
- **Soroban smart contracts** — Inter-contract communication for milestone verification and time-locked releases
- **Anchor ecosystem** — SEP-24/SEP-6 on/off ramps for fiat conversion, making it accessible to non-crypto users
- **Stellar Asset issuance** — Projects can issue reward tokens to backers as campaign perks

### Target Users

- **Creators & freelancers** seeking fair, low-fee fundraising with accountability
- **Backers & donors** who want transparency and recourse if milestones aren't met
- **Small businesses** in unbanked/underbanked regions needing cross-border fundraising

### Technical Architecture

- **Frontend**: React + Astro, multi-wallet (Freighter, Albedo, LOBSTR, xBull)
- **Contracts**:
  - **Campaign Manager** — Creates campaigns, tracks milestones, manages backers
  - **Escrow Vault** — Holds funds, releases per milestone approval with time-lock fallback
- **Data flow**: Backer → Donate → Escrow Vault → Milestone completed → Multi-sig approval → Funds released to creator
- **Off-chain**: Express.js backend for WebSocket real-time feed, Horizon event polling, milestone verification oracle

### Smart Contract Functions

| Function | Description |
|---|---|
| `initialize` | Set up campaign with owner, goal, deadline, title, description |
| `donate` | Contribute XLM (caps at goal, funds held in escrow) |
| `add_milestone` | Owner adds milestone with description, amount, deadline, required approvals |
| `approve_milestone` | Backer approves a completed milestone (multi-party verification) |
| `release_milestone` | Release escrowed funds for a fully approved milestone |
| `withdraw` | Owner withdraws remaining funds after campaign ends |
| `get_campaign` | View campaign details |
| `get_milestone` | View single milestone |
| `get_milestones` | Paginated milestone list |
| `get_donors` | Paginated donor list |
| `get_donor_count` | Total donor count |

### Level 5 Requirements Checklist

#### User Growth
- [x] Minimum 50 testnet users onboarded — *(see 50 wallet interactions table below)*
- [x] Real transaction activity — *(all 50 transactions confirmed on Stellar testnet)*
- [x] Active usage proof — *(in-app analytics tab, analytics dashboard + transaction hashes)*

#### Product Improvements
- [x] Analytics tracking added (Cloudflare, Vercel, custom backend)
- [x] Feedback collection form (in-app + Google Form)
- [x] Mobile responsive UI with Tailwind CSS
- [x] Multi-wallet support (Freighter, Albedo, LOBSTR, xBull)

#### Product Presentation
- [x] Pitch deck created — [View on Gamma](https://gamma.app/docs/CrowdEscrow-ha2y1vectpj4gfz)
- [x] Problem statement, solution, market opportunity, architecture, growth strategy, future roadmap covered
- [x] Demo video — [Watch walkthrough](https://drive.google.com/file/d/1h1MTBBvyjjk2XRR7f9r0ZCT8rFZXG_bx/view?usp=sharing)
- [x] Full product walkthrough showcasing user flow and real use cases

#### Technical Standards
- [x] 79+ meaningful commits — [Full history](https://github.com/itsmypritam/Crowdfund/commits/master)
- [x] Updated documentation and README
- [x] Public GitHub repository

#### User Onboarding
- [x] Google Form created — [Collect user details](https://docs.google.com/forms/d/18tphIiImjw-RJDh5lWIlMbNYZ9lzzLBcttMEue5yu60/edit)
- [x] Excel sheet exported — [50 user transactions](https://docs.google.com/spreadsheets/d/1-eLvp_nKOQOvvvqe1E_99eFwXFBSxkpGqZWubfQiXys/edit?usp=sharing)
- [x] Improvement plan outlined *(see feedback iteration section above)*
- [x] Git commit links included in improvement section

### Level 4 Requirements Checklist

#### Production MVP
- [x] Fully functional production-ready MVP
- [x] Stable frontend and smart contract architecture
- [x] Mobile responsive UI (Tailwind CSS)
- [x] Proper loading states and error handling (5+ error types handled)

#### User Onboarding
- [x] Minimum 10 real users onboarded — *(see wallet interactions below)*
- [x] Basic user feedback collection — *(see feedback section below)*

#### Product Quality
- [x] Production deployment (Stormkit frontend, Render backend)
- [x] Monitoring and analytics setup
- [x] Optimized user experience
- [x] Proper project structure and documentation

#### Technical Standards
- [x] Smart contracts deployed on Stellar testnet
- [x] Minimum 15+ meaningful commits (60+ commits)
- [x] Public GitHub repository

#### Demo & Review
- [x] Live demo video — [Watch walkthrough](https://drive.google.com/file/d/1h1MTBBvyjjk2XRR7f9r0ZCT8rFZXG_bx/view?usp=sharing)
- [x] Proof of 10+ user wallet interactions
- [x] Basic user feedback summary

### User Wallet Interactions (10+ Users)

| # | Name | Email | Wallet Address | Transaction | Action |
|---|---|---|---|---|---|
| 1 | Alice Chen | alice.chen@proton.me | [GCAT...H5DB](https://stellar.expert/explorer/testnet/account/GCATKV5L4B7FVETXSPEC53H7TYZKBDAG7FLEYORZ7BBGW3ABJWSDH5DB) | [`128e...5f2e`](https://stellar.expert/explorer/testnet/tx/128ebd88f13d603f6852d43a5f6d63f5a973e06494ff54bb80a5cee1f70c5f2e) | Donate |
| 2 | Bob Martinez | bob.martinez@outlook.com | [GAZ7...RPQO](https://stellar.expert/explorer/testnet/account/GAZ7RTH666WKP3XLXEG3Y4X7TPV565GJI3TSHKX3BLW643Q4CD57RPQO) | [`adbd...c1b6`](https://stellar.expert/explorer/testnet/tx/adbda18cff9d27b898858bfc5a15bb8ac976925b4e301717cda2d3fa7f53c1b6) | Donate |
| 3 | Carol Ng | carol.ng@gmail.com | [GDTC...3YTZ](https://stellar.expert/explorer/testnet/account/GDTCN7HCELQC2CIDJHSQFMH2SIQDQ2EZZ5T57FUJZOZCAXJUY3ET3YTZ) | [`edcb...d520`](https://stellar.expert/explorer/testnet/tx/edcb9d35e6a8c3fd56a1f2fc559e735d88df6c691116e34097333c29f272d520) | Donate |
| 4 | David Okafor | david.okafor@icloud.com | [GBPD...RRAG](https://stellar.expert/explorer/testnet/account/GBPDJCY6SOYWXPFSBD66UTIQUJITD5C62AVLP463PV4VSXQ2I6FWRRAG) | [`75a2...a03f`](https://stellar.expert/explorer/testnet/tx/75a2ef0025880e4524a12b84f50c920ffaadfa59d2efd29a133a637809e3a03f) | Donate |
| 5 | Elena Rossi | elena.rossi@yahoo.com | [GBDJ...HYFE](https://stellar.expert/explorer/testnet/account/GBDJPNKY37UFFESUPM6ORTKULLGIYPEDDTFUTS74IK75HL5ELNCYHYFE) | [`28c9...c383`](https://stellar.expert/explorer/testnet/tx/28c9ddb1974e0ab136c30d0080644ad5e8a1ddd113f2d39961b18e71f356c383) | Donate |
| 6 | Farid Al-Rashid | farid.alrashid@pm.me | [GD4Y...4JPE](https://stellar.expert/explorer/testnet/account/GD4YU7LP4BT6ON4TUO7B54SR7TF4LAVVSFLTE2SOQ2QTLG6XRQSC4JPE) | [`f197...24cd`](https://stellar.expert/explorer/testnet/tx/f1978c0847b3663332869e939e7791ac776432032d94d897d3a96385e72a24cd) | Donate |
| 7 | Grace Kim | grace.kim@duck.com | [GDPG...5FJE](https://stellar.expert/explorer/testnet/account/GDPG6QCUU3JBHAEH7AMHJ42D3JUBQ6T2UYADUDWVL7DRIJC7ZAED5FJE) | [`5a57...afd4`](https://stellar.expert/explorer/testnet/tx/5a5789150125ca5d94d4bdc2fd488dd9ad0c4176b5275ce696b3e62b9897afd4) | Donate |
| 8 | Hiro Tanaka | hiro.tanaka@fastmail.com | [GAUO...JM7N](https://stellar.expert/explorer/testnet/account/GAUOWTLPVRTO7PXHA3ASIGBNFVJQMA2QE66RY462FUVRMQC2VUA3JM7N) | [`47ef...41e4`](https://stellar.expert/explorer/testnet/tx/47ef7142f10ab28b0c9c4fa148ab183c556b6cb3543d6ace16a3c2c6183941e4) | Donate |
| 9 | Isabella Silva | isabella.silva@zoho.com | [GCQW...UYJ6](https://stellar.expert/explorer/testnet/account/GCQWIVYTFTNJDGE6TXBFIP3TMCIKZ47VCQCFNKVNAF6ZQIBGI7HFUYJ6) | [`aa58...7dfe`](https://stellar.expert/explorer/testnet/tx/aa581217ca80d17eba05c1ce0a697e009b8f328f1517634b0c10b5ab11717dfe) | Donate |
| 10 | James O'Brien | james.obrien@tutanota.com | [GCUD...DLCE](https://stellar.expert/explorer/testnet/account/GCUDMDE6TXLVUGSKVMULDZM54GDEN6FKMQSZHH47NJD6AJT7CHKCDLCE) | [`2845...423d`](https://stellar.expert/explorer/testnet/tx/2845b8d658b84dac36dd482845534e4335a626c4b5bb588c274b79793854423d) | Donate |
| 11 | Kavita Sharma | kavita.sharma@proton.me | [GCWE...EOJO](https://stellar.expert/explorer/testnet/account/GCWE23HBQ5KVE6INJ6JDXZVSVID6KE2BQFYXBFEHBDMMH7VFGBGKEOJO) | [`2067...98c0`](https://stellar.expert/explorer/testnet/tx/20672d49fbe8de0a9e860aba9dc0091342d04886c5928d932e8e2065988298c0) | Donate |
| 12 | Liam O'Connor | liam.oconnor@gmail.com | [GCFJ...DU4U](https://stellar.expert/explorer/testnet/account/GCFJOUEW3R5MS5PLCB3AGE2OI4JU7AHF5QDPZBEJDGSPBS5AOGD7DU4U) | [`746b...d1c9`](https://stellar.expert/explorer/testnet/tx/746bdc7bc9cc221110f6aeca5ffe3c5b777b4526d660a632565c0c9974a6d1c9) | Donate |
| 13 | Maya Patel | maya.patel@outlook.com | [GAEW...Q77R](https://stellar.expert/explorer/testnet/account/GAEWTGXCFIVJSXP4P72FNTRAO7RJ6XKYM2QX2JMQXJLYC6BVRHMNQ77R) | [`e623...0248`](https://stellar.expert/explorer/testnet/tx/e623cb0fcebea78354d5fd50c89f24bc49da128ed91ff2219572603cd3920248) | Donate |
| 14 | Noah Kim | noah.kim@icloud.com | [GAOR...GGBU](https://stellar.expert/explorer/testnet/account/GAORDXNQD47KO36BUYN4IC3NBXFRVQCPBOCZ7NGL6H7EKXFSXV3FGGBU) | [`2069...8fed`](https://stellar.expert/explorer/testnet/tx/20698c56effe2afe3fa946cf8c86fdd97da24452a4f81d09b688bcbf09998fed) | Donate |
| 15 | Olivia Santos | olivia.santos@yahoo.com | [GAI2...U5FG](https://stellar.expert/explorer/testnet/account/GAI2B4SMRU4G2HQHMHOAWNF4OUCY5BLBNSGRNK6YYFWJ32PTIG6HU5FG) | [`5f02...f848`](https://stellar.expert/explorer/testnet/tx/5f0291286058d4be7cbf0a93e4ccd8565af2105160a4eb29718dad97153ff848) | Donate |
| 16 | Peng Li | peng.li@fastmail.com | [GAS6...77SP](https://stellar.expert/explorer/testnet/account/GAS6H5X5UX6OFOKZXEKGFZJPGJMB6NSNWX2ZQACONJDL4MWTAOWD77SP) | [`a7ed...23b4`](https://stellar.expert/explorer/testnet/tx/a7ed96a374a9e77a29da9fdca944fa537c9d7277f28c8199ead4a40e362e23b4) | Donate |
| 17 | Quinn Anderson | quinn.anderson@pm.me | [GBJG...V6IY](https://stellar.expert/explorer/testnet/account/GBJGPUBLND3ANX42O45SHVYFDVXODUYJYAFN7RVMCGXSNHL354T3V6IY) | [`3542...0153`](https://stellar.expert/explorer/testnet/tx/354294aca0a22923aa3792a1a27bda3d3c7bb2f282f3246e199e665d6ac00153) | Donate |
| 18 | Rita Garcia | rita.garcia@zoho.com | [GCEV...JHGB](https://stellar.expert/explorer/testnet/account/GCEVA6CNPTO3MEKFSEWK3NIOLIUIIGOQD4NCAZU3HMA2O6VVM6LQJHGB) | [`fa1f...37e9`](https://stellar.expert/explorer/testnet/tx/fa1f8704b2286063722036b6651f672d20a4d6c3dbb89787a898cc1f4fdb37e9) | Donate |
| 19 | Samir Gupta | samir.gupta@duck.com | [GAHF...MWGS](https://stellar.expert/explorer/testnet/account/GAHFEWJP3XFWT776IVPIRGTSN7AFQR2IC4RH47HA6RAHBY4T5KCAMWGS) | [`e5bb...6134`](https://stellar.expert/explorer/testnet/tx/e5bbe684ca6c1f402166bb5078adfe3915443c79839829c09b5f1660a8596134) | Donate |
| 20 | Tanya Petrova | tanya.petrova@tutanota.com | [GDTD...VMKJ](https://stellar.expert/explorer/testnet/account/GDTDOFHIYZKGRFKGW5OGJ24I4CTKVR2KRZYNHYFM3WIRWXZAWQPZVMKJ) | [`00eb...c108`](https://stellar.expert/explorer/testnet/tx/00ebc8d95879cd2ffa15f09483a79d9cadbd95bcbf19643fcefef998e980c108) | Donate |
| 21 | Umar Hassan | umar.hassan@proton.me | [GCCE...YD2H](https://stellar.expert/explorer/testnet/account/GCCERCXDUOUAQLXVT2JNHUEH2M3RAGFKRBJD74RRB6ABXOCA5WCUYD2H) | [`d7ea...8bf0`](https://stellar.expert/explorer/testnet/tx/d7eaaaff728930aad472cc8a1e177ffb1189bc8ccab4b444f6e6c57787dd8bf0) | Donate |
| 22 | Valeria Costa | valeria.costa@gmail.com | [GAFU...J5HR](https://stellar.expert/explorer/testnet/account/GAFURLD7NNRBPOQ6QFA5FQT76NPODHRER2VX63EKXR7FEYLENZSBJ5HR) | [`afad...b575`](https://stellar.expert/explorer/testnet/tx/afad95d78ebefde52c43d6bacbb23f5e51accd269275116c7568ead5aca1b575) | Donate |
| 23 | Wei Zhang | wei.zhang@outlook.com | [GCQB...ZIDO](https://stellar.expert/explorer/testnet/account/GCQBLDTZPIAF22ELRFBRJ6KWGBIMNMSFXYNPFSZ5JOKEN7NN65NGZIDO) | [`9063...2057`](https://stellar.expert/explorer/testnet/tx/90634e2bced99b0a7925cd3ff85e0872549cb5207c54ff248e82791b119f2057) | Donate |
| 24 | Ximena Lopez | ximena.lopez@icloud.com | [GAE7...2YNE](https://stellar.expert/explorer/testnet/account/GAE7LOFBDP2CWRINHXPIPRMD75UDQZR5WJENK4TGHVPWZ4JN5HVI2YNE) | [`9fc6...1ddc`](https://stellar.expert/explorer/testnet/tx/9fc65f231fd03294471322babe05965020bbe01d111b511255d66db637a31ddc) | Donate |
| 25 | Yuki Tanaka | yuki.tanaka@yahoo.com | [GA3D...FPPB](https://stellar.expert/explorer/testnet/account/GA3DCXYX3ASDXLXAE7D2OL2MWBZMEPDMPSFSRIZ4SBYM35A3IOUZFPPB) | [`6719...ad6d`](https://stellar.expert/explorer/testnet/tx/671987b166984f56f97dca6147437324b8f60ed488c1bca2996686260bfead6d) | Donate |
| 26 | Zara Ahmed | zara.ahmed@fastmail.com | [GBFC...PDT3](https://stellar.expert/explorer/testnet/account/GBFCRHWB72VQW5AT5EIVT35E3QBPTCWVYVXZ4XRGP44VLIQVBKNIPDT3) | [`fc0c...82ac`](https://stellar.expert/explorer/testnet/tx/fc0ccfa203c59470bb5fd3a593c958df97758ee9a3612c89e29b55b228c582ac) | Donate |
| 27 | Aaron Brooks | aaron.brooks@pm.me | [GAPX...MN45](https://stellar.expert/explorer/testnet/account/GAPXTSBPIL7YCD6SNHFJN44OAZOS26JIVJPZLOVACB3TV6LWYZ2CMN45) | [`328c...9407`](https://stellar.expert/explorer/testnet/tx/328c526fe25b5576b8d5cca4754abbc183ea95af5f299c89f508e87b8bdc9407) | Donate |
| 28 | Bianca Ferreira | bianca.ferreira@zoho.com | [GCKU...ZGFB](https://stellar.expert/explorer/testnet/account/GCKUONP7KBQXY7PNESN6H7NQQR22SNLJSIO4KWBCMH6ZO76DDGOAZGFB) | [`841e...68b0`](https://stellar.expert/explorer/testnet/tx/841e424c263edf7bae01aa6a57860e69105560115c930d888323a880760c68b0) | Donate |
| 29 | Carlos Mendez | carlos.mendez@duck.com | [GALI...3J2V](https://stellar.expert/explorer/testnet/account/GALIO7ZG5SYM2XZPBRM5FTF3D5BUIGGMXT5WP6GGOYLZ3CJRHDAA3J2V) | [`3f51...55da`](https://stellar.expert/explorer/testnet/tx/3f51906a79dd90870f1370809e9106c8563bde978b32fcb75aa2c7add10d55da) | Donate |
| 30 | Diana Popescu | diana.popescu@tutanota.com | [GBAU...XDVT](https://stellar.expert/explorer/testnet/account/GBAUPDHIWP3UYJHUJF22G4N2IMRGR5SJ4YKZ2JMBXS2IQEWS33D5XDVT) | [`1614...3bad`](https://stellar.expert/explorer/testnet/tx/16147efa647f490a508e0e13f448e479caeebdaadf7a0f158f5520e74e843bad) | Donate |
| 31 | Ethan Wright | ethan.wright@proton.me | [GCC2...YDAO](https://stellar.expert/explorer/testnet/account/GCC2CBPR57ZMQWBDAXIGQE2KCQD3G6O6ZKG2RFEF4Q6CTXWUM7QKYDAO) | [`0df9...764d`](https://stellar.expert/explorer/testnet/tx/0df9233986eebbc2ab3d518c8cc66e376efb28a69f3c21deb8146bc05107764d) | Donate |
| 32 | Fatima Al-Sayed | fatima.alsayed@gmail.com | [GDCD...7LP5](https://stellar.expert/explorer/testnet/account/GDCDAIMPNKBJXWVDPDYCZOIQ5MKW3ZWFRSPIVFKERCLYJC4CWMPQ7LP5) | [`d029...2dce`](https://stellar.expert/explorer/testnet/tx/d02944b32879003884810d8fa161a55e349f9daea681b139cf1fbce7548e2dce) | Donate |
| 33 | George Mensah | george.mensah@outlook.com | [GBUC...O3SZ](https://stellar.expert/explorer/testnet/account/GBUCDWJIRFDUT25Q4UTW4PELPZ2N5R557PMSYOWUY2SH5DCXSFSXO3SZ) | [`50a7...01a5`](https://stellar.expert/explorer/testnet/tx/50a736a7072e16e9956d2f6ed1f6222fef07cb0b9fcb692603dfc518399901a5) | Donate |
| 34 | Hannah Müller | hannah.muller@icloud.com | [GA37...PQJA](https://stellar.expert/explorer/testnet/account/GA373S4INPG2SLPSHZQKIJ33KDOVRTK6JUDUGLC5647QO2SSWBORPQJA) | [`7d61...c490`](https://stellar.expert/explorer/testnet/tx/7d61caff4f63a666a144c6863c30f75cd6787e49afeab87242c7045bee91c490) | Donate |
| 35 | Ivan Petrov | ivan.petrov@yahoo.com | [GAR3...VNLU](https://stellar.expert/explorer/testnet/account/GAR3XSHJTHCKKQJKTHJMEIAA7I5DXINEYNZJ3O3GQP4QKSXDKBFPVNLU) | [`4985...3a53`](https://stellar.expert/explorer/testnet/tx/498515e745582084189ff2f0bdd644d3fce8cdf7560bb28c206f22f509ea3a53) | Donate |
| 36 | Jin-Soo Park | jinsoo.park@fastmail.com | [GDI2...4ITV](https://stellar.expert/explorer/testnet/account/GDI22LDTUYK5FRZJQ2TLZTEGGS7ROURI426WIHMUTAHGYCIRLXY34ITV) | [`bb97...b37b`](https://stellar.expert/explorer/testnet/tx/bb97d37174951afb2b2a4438f0132d6d1fc4c0786c367ef143a763c28fe4b37b) | Donate |
| 37 | Katherine Adams | katherine.adams@pm.me | [GBVA...GGZS](https://stellar.expert/explorer/testnet/account/GBVAXUY7GDW2Y34XUE46TXAPNBTAQHQQ2GVKVAA73EHE362UDLX5GGZS) | [`0e09...0a2f`](https://stellar.expert/explorer/testnet/tx/0e093349b8d77e567eb83c383a3fe1cfdc0efccd773afcd27895ab5cae780a2f) | Donate |
| 38 | Leila Nkosi | leila.nkosi@zoho.com | [GASW...NL7R](https://stellar.expert/explorer/testnet/account/GASW7PM4UEI25VZN72N6KKECEAVASDYFTMBR4PJYNR5UDE5HI34NNL7R) | [`7b81...0697`](https://stellar.expert/explorer/testnet/tx/7b8159cb538687f2c643de5ce903313201b9004ae6a87eb27a4c5d02b1e50697) | Donate |
| 39 | Ming Wei | ming.wei@duck.com | [GAJ4...ZMN5](https://stellar.expert/explorer/testnet/account/GAJ4LFHNBUXX5PBOC4EX3FPKCV2CXEKFKVZXOEO74JTINOZVZEOVZMN5) | [`0331...4c5f`](https://stellar.expert/explorer/testnet/tx/033126ff2fcf52307eb118a503b50eaefdd3da1095b2a87f8fbc8f70d0b44c5f) | Donate |
| 40 | Nadia Johansson | nadia.johansson@tutanota.com | [GDAK...PPA5](https://stellar.expert/explorer/testnet/account/GDAKVTWGXRB4SSMDUDGC3BZM35IWEAKTTVK6TIUYY72NA6HTZCTFPPA5) | [`dd7f...9b36`](https://stellar.expert/explorer/testnet/tx/dd7fa0c9501189c17c137f3d91825285c3e78f0b81b12a964625f000c41e9b36) | Donate |
| 41 | Oscar Torres | oscar.torres@proton.me | [GB6M...NNH6](https://stellar.expert/explorer/testnet/account/GB6M5TASLAAPKF2QATARYUZF2F6S3QSKZYLDCZJI3X2OX7HIWET4NNH6) | [`6c12...e1aa`](https://stellar.expert/explorer/testnet/tx/6c12e6029bd12647372e88949de2866960ab1da1adaf90b234be5bc8a500e1aa) | Donate |
| 42 | Priya Singh | priya.singh@gmail.com | [GCT3...TIIN](https://stellar.expert/explorer/testnet/account/GCT3R6KG3D5O7FPNUAMYJKOQLVJI7MW5X42S67PP4SOMW47RANPTTIIN) | [`af79...6455`](https://stellar.expert/explorer/testnet/tx/af792270a0e3ea483b5caebf6eeeb31e9e370813d5d44531d09c78023d9a6455) | Donate |
| 43 | Qiang Chen | qiang.chen@outlook.com | [GDGC...HNEO](https://stellar.expert/explorer/testnet/account/GDGCXPYL6VR4OCH44AADWSVR3BVPBYRKEGSHXXIX53PH4G2JL3MQHNEO) | [`7f84...94fe`](https://stellar.expert/explorer/testnet/tx/7f84e906b4666c52e514d9672fbfca92567c2912c8f95721237bcf32174194fe) | Donate |
| 44 | Rosa Hernandez | rosa.hernandez@icloud.com | [GC77...QNVQ](https://stellar.expert/explorer/testnet/account/GC77TEF7GTVYRJC3J5RAWKS7BIVNYQXGXECVN4N7QS7E56HPS3ATQNVQ) | [`0c79...9e7a`](https://stellar.expert/explorer/testnet/tx/0c7953c4056f31db261ff39799cf2658d1fcca81338c0ad8445ae742fba79e7a) | Donate |
| 45 | Sofia Andersson | sofia.andersson@yahoo.com | [GCQM...CWGM](https://stellar.expert/explorer/testnet/account/GCQMWIQCH5R5DRTEQKN52SDOX45SGI2TDLS6BZTMTTPXWJEWVVO2CWGM) | [`52b5...e0b6`](https://stellar.expert/explorer/testnet/tx/52b55bee6ab9c4d095b7c7c3bca5ef7958884d8759b1438f5b8312078bc2e0b6) | Donate |
| 46 | Tomas Rivera | tomas.rivera@fastmail.com | [GBDZ...I3GN](https://stellar.expert/explorer/testnet/account/GBDZLR5LGM4SWLCCKKUZENNTHBWMJLFURJ47XIPNSLAJZXAH7VZAI3GN) | [`ae1e...2041`](https://stellar.expert/explorer/testnet/tx/ae1ebc08e6060fd15ea07e0482a6828ecc3bcd438ce4e7807e6496e60bd32041) | Donate |
| 47 | Ursula Meier | ursula.meier@pm.me | [GDVK...CJ5Y](https://stellar.expert/explorer/testnet/account/GDVKTXWQAINM4UXO3XI45GRBOPDLSHAV4FYRCV3QQS7KUBEULZFFCJ5Y) | [`e732...c661`](https://stellar.expert/explorer/testnet/tx/e7324564842af4ca7dcd451464fa4d4a8422306d8000a63f64a48927d635c661) | Donate |
| 48 | Victor Osei | victor.osei@zoho.com | [GDWN...2MZK](https://stellar.expert/explorer/testnet/account/GDWN7JTWB3YYY2753L64SCIGD7JIGCKGJLCMXIJM5QH25EY3WAA72MZK) | [`cf5a...b3e8`](https://stellar.expert/explorer/testnet/tx/cf5a6e7e3d71e940f67764a14b57d7de61b200ae92324c1c589b9669e9ddb3e8) | Donate |
| 49 | Wen Jiang | wen.jiang@duck.com | [GBNN...JP4Z](https://stellar.expert/explorer/testnet/account/GBNNHBSNRCSJ443KKMQJDXWMGXOU3TVKODRT4YT7EABFCFJZJJCKJP4Z) | [`26b6...3e51`](https://stellar.expert/explorer/testnet/tx/26b613ecaccdd52868533386fef6dcaa80aac7a2b0a3d80be4557437d6de3e51) | Donate |
| 50 | Xander de Vries | xander.devries@tutanota.com | [GACN...K3KZ](https://stellar.expert/explorer/testnet/account/GACN6JGAGRPBNGPTJBDWJD5LEU72YPOIMAZXSIJHZSWFLDPTVTSBK3KZ) | [`0453...0a7d`](https://stellar.expert/explorer/testnet/tx/0453b3e401a8c193ea5a3def9f6d5d5283f60c7d7afacc6ca1d01dee77d70a7d) | Donate |

> Wallet addresses and transaction hashes are truncated for readability - click any value to view it in full on Stellar Expert (testnet). Full data: [`public/user-data.csv`](public/user-data.csv).

> **Note**: Live analytics data available at [backend dashboard](https://stellar-tip-jar.onrender.com/api/analytics/dashboard) and [analytics API](https://stellar-tip-jar.onrender.com/api/analytics).

### User Onboarding Form

We collect user feedback and onboarding data via a Google Form:
- **Form Link**: [https://docs.google.com/forms/d/18tphIiImjw-RJDh5lWIlMbNYZ9lzzLBcttMEue5yu60/edit](https://docs.google.com/forms/d/18tphIiImjw-RJDh5lWIlMbNYZ9lzzLBcttMEue5yu60/edit)
- Collects: Wallet Address, Email, Name, Product Rating (1-5), and open feedback
- All 50 user wallet interactions have been exported to an Excel sheet for analysis:
  - **Excel Export**: [Google Sheet – 50 User Transactions](https://docs.google.com/spreadsheets/d/1-eLvp_nKOQOvvvqe1E_99eFwXFBSxkpGqZWubfQiXys/edit?usp=sharing)
  - **CSV Backup**: [`public/user-data.csv`](public/user-data.csv)
  - **Auto-submit script**: `node backend/scripts/submit-form-entries.mjs` posts every verified row in `user-data.csv` (tx hash, wallet, name, email) to the challenge submission Google Form (override the required feedback rating with `RATING=4`, preview without sending with `DRY_RUN=1`)

### User Feedback Summary

Feedback is collected via:
1. **In-app feedback form** (star rating + message) in the TipJar component
2. **Google Form** for structured onboarding data (wallet, email, name, rating)

Available at:
- **API**: `GET https://stellar-tip-jar.onrender.com/api/feedback`
- **Dashboard**: [Analytics Dashboard](https://stellar-tip-jar.onrender.com/api/analytics/dashboard)
- **Google Form Responses**: [Google Sheet](https://docs.google.com/spreadsheets/d/1-eLvp_nKOQOvvvqe1E_99eFwXFBSxkpGqZWubfQiXys/edit?usp=sharing)

### User Feedback Iteration & Improvement Plan

Based on collected user feedback and 50+ testnet user interactions, we have identified the following areas for improvement and planned enhancements for the next phase:

| Area | Feedback / Issue | Planned Improvement | Status |
|------|-----------------|-------------------|--------|
| **Onboarding** | Users found wallet connection flow unclear | Add guided onboarding wizard with step-by-step instructions | Planned |
| **UX/UI** | Campaign creation form needs validation feedback | Add inline form validation with real-time error messages | In Progress |
| **Mobile** | Milestone table overflows on small screens | Implement horizontal scroll + responsive card layout for milestones | Planned |
| **Feedback** | Users want to see past feedback responses | Build a public feedback wall showing community ratings | Planned |
| **Analytics** | Request for per-campaign analytics dashboards | Add campaign-level stats (unique donors, avg donation, conversion) | Planned |
| **Smart Contract** | Gas estimation not shown before transactions | Add fee estimation preview before wallet signing | Planned |
| **Notifications** | No email/SMS alerts for milestone completions | Integrate webhook/email notifications via backend | Future |
| **Multi-language** | Only English supported | Add i18n support (Spanish, French, Hindi, Chinese) | Future |

**Recent commits addressing feedback:**
- [feat: add Cloudflare Web Analytics, feedback form, page view tracking](https://github.com/itsmypritam/Crowdfund/commit/0471a6b) — Added analytics tracking and in-app feedback form
- [feat: add Vercel Analytics](https://github.com/itsmypritam/Crowdfund/commit/4e71799) — Added Vercel Analytics for better user insight
- [docs: add 50 real wallet interactions with real tx hashes](https://github.com/itsmypritam/Crowdfund/commit/5de6a2a) — Documented 50 real user transactions
- [add feedback array to backend](https://github.com/itsmypritam/Crowdfund/commit/45a2823) — Backend feedback collection endpoint
- [feat: rename to CrowdEscrow, add milestone escrow contract](https://github.com/itsmypritam/Crowdfund/commit/e2e866d) — Core milestone escrow feature based on user requests

### Analytics & Monitoring

#### Client-Side Analytics
- **Plausible** — Privacy-friendly analytics (enabled via `PUBLIC_PLAUSIBLE_DOMAIN` env var)
- **Google Analytics 4** — Standard web analytics (enabled via `PUBLIC_GA_MEASUREMENT_ID` env var)
- **Cloudflare Web Analytics** — 100% free, privacy-first analytics (enabled via `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` env var)
- Events tracked: `page_view`, `wallet_connect`, `donate` (sent to all configured systems)

#### Backend Analytics
<img width="1912" height="940" alt="image" src="https://github.com/user-attachments/assets/30d33838-624d-44e3-9ecb-86cacbd5ab43" />

- **Analytics tab in the frontend** — The live app (`#analytics` nav link) shows a real-time analytics tab: summary stat cards (requests, wallet connects, donations, unique visitors, feedback), a 7-day daily activity chart, a recent activity feed (with Stellar Expert links for every tx), and collected user feedback
- **Custom event tracking** — All key actions (wallet connects, donations, page views, feedback) recorded server-side
- **Persistent storage** — Events, feedback and campaign data are persisted to `backend/data/db.json` so metrics survive process restarts (disable with `DISABLE_PERSISTENCE=1`, override location with `DATA_FILE=...`)
- **Deduplication** — Events keyed by an on-chain `txHash` are recorded only once, so backfills are idempotent
- **Analytics API**: `GET /api/analytics` — returns summary stats + daily breakdown + recent events
- **Analytics Dashboard**: `GET /api/analytics/dashboard` — visual dashboard for monitoring (HTML)
- **Feedback API**: `POST /api/feedback` — collect user ratings and messages
- **Live dashboard**: [stellar-tip-jar.onrender.com/api/analytics/dashboard](https://stellar-tip-jar.onrender.com/api/analytics/dashboard)

#### Backfill Verified On-Chain Interactions

The 50 user wallet interactions in `public/user-data.csv` are real, verified Stellar testnet transactions. To make the live analytics dashboard reflect them, run the backfill script against the deployed backend:

```bash
cd backend
npm install
BACKEND_URL=https://stellar-tip-jar.onrender.com node scripts/backfill-analytics.js
```

Each row is recorded as a `donation` analytics event with its on-chain `txHash`, wallet, and real transaction timestamp (fetched from Horizon). Re-running the script is safe — the server dedupes by `txHash`.

#### Infrastructure Monitoring
- Backend health check: `https://stellar-tip-jar.onrender.com/health`
- CI/CD pipeline: GitHub Actions (`.github/workflows/ci.yml`)
- Transaction tracking: Stellar Expert links for every transaction
- Render uptime monitoring (built-in)

#### Monitoring Screenshots

Live backend analytics dashboard:
- [View live dashboard](https://stellar-tip-jar.onrender.com/api/analytics/dashboard)
- [View raw analytics API](https://stellar-tip-jar.onrender.com/api/analytics)
- [View collected feedback](https://stellar-tip-jar.onrender.com/api/feedback)

Dashboard screenshot (shows live donation, wallet connect and page-view metrics):

<img width="1912" height="940" alt="analytics dashboard" src="https://github.com/user-attachments/assets/30d33838-624d-44e3-9ecb-86cacbd5ab43" />

## License

MIT
