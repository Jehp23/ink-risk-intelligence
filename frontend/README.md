# Ink — Smart Contract Risk Analyzer

> Translate blockchain complexity into human decisions.

Ink analyzes Avalanche C-Chain smart contracts and returns an instant risk score with an AI-generated plain-language explanation — no wallet required, no technical knowledge needed.

**Live app:** https://ink-hinni2omx-jehp23s-projects.vercel.app

---

## What it does

Paste any Avalanche contract address and get:

- **Risk score** (0–100) computed from 11 on-chain signals
- **Risk level** — Low / Medium / High with color coding
- **Warnings** in plain language (mint functions, holder concentration, unverified contracts, etc.)
- **AI explanation** powered by Groq / Llama 3.3-70B in English or Spanish

## Tech stack

- **Next.js 15** (App Router) + **TailwindCSS v4**
- Calls the [Ink backend](https://github.com/Jehp23/ink-backend) via `POST /analyze`
- Language toggle EN / ES
- Configurable via `NEXT_PUBLIC_API_URL` env var

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, set this to your deployed backend URL.

## Demo contracts

| Token | Address | Expected result |
|-------|---------|-----------------|
| USDC  | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Low Risk (~25) |
| RUG   | `0xb8EF3a190b68175000B74B4160d325FD5024760e` | High Risk (~65) |

## Deploy

```bash
# Vercel (recommended)
vercel --prod
```

Set `NEXT_PUBLIC_API_URL` in Vercel environment variables to your backend URL.
