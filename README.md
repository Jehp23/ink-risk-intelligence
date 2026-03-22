<p align="center">
  <img src="./ink_logo.svg" alt="Ink Logo" width="80" />
</p>

<h1 align="center">Ink — Smart Contract Risk Intelligence</h1>

<p align="center">
  <strong>Analyze any Avalanche smart contract and get an instant, AI-powered risk report in plain language.</strong><br/>
  No wallet needed. Free. Bilingual (EN/ES).
</p>

<p align="center">
  <a href="https://ink-three-iota.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-ink--three--iota.vercel.app-6366f1?style=for-the-badge&logo=vercel" alt="Live Demo" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Avalanche-C--Chain-e84142?style=for-the-badge&logo=avalanche" alt="Avalanche" />
  &nbsp;
  <img src="https://img.shields.io/badge/AI-Llama%203.3%2070B-10b981?style=for-the-badge" alt="Llama 3.3" />
</p>

---

## What is Ink?

Blockchain data is public — but it's not legible to most people. Anyone can look at a smart contract, but very few can understand what the code actually does or whether it's safe.

**Ink bridges that gap.** Paste any Avalanche contract address and get:

- A **risk score** from 0 to 100
- A **risk level** (Low / Medium / High) with color coding
- **Plain-language warnings** about what makes it risky
- An **AI-generated explanation** written for non-technical users

We don't just show data — we translate on-chain complexity into human decisions.

---

## Demo

| Low Risk | High Risk |
|----------|-----------|
| USDC (Circle) `0xB97EF9...` — Score: 25 | RUG Token `0xb8EF3a...` — Score: 65 |

**Try it live:** [ink-three-iota.vercel.app](https://ink-three-iota.vercel.app)

---

## Architecture

```
User inputs address
       │
       ▼
┌─────────────────────────┐
│   Frontend (Next.js)    │  ←  Vercel
│   ink-three-iota.vercel │
└───────────┬─────────────┘
            │ POST /analyze
            ▼
┌─────────────────────────┐
│  Backend (Node/Express) │  ←  Render
│  ink-backend-mkis       │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
Snowtrace API   Routescan API
(contract code) (holder data)
     │
     ▼
scoringEngine.js  ← deterministic, no LLM
     │
     ▼
Groq API (Llama 3.3 70B)  ← explanation only
     │
     ▼
MongoDB Atlas  ← cache (TTL 1h, keyed by address+language)
```

> **Critical design rule:** The LLM never calculates the score. Scoring is 100% deterministic. The LLM only explains the results in plain language.

---

## Risk Scoring

Ink evaluates 11 on-chain signals, each carrying a risk weight:

| Signal | Condition | Points |
|--------|-----------|--------|
| Holder concentration (top 1) | > 30% of supply | +20 |
| Holder concentration (top 10) | > 60% of supply | +15 |
| Ownership | Not renounced | +20 |
| Contract verification | Unverified on Snowtrace | +15 |
| Mint function | Present in source | +10 |
| Blacklist function | Present in source | +10 |
| Transfer restrictions | Present in source | +10 |
| Liquidity pool age | < 7 days old | +10 |
| Liquidity amount | < $10,000 USD | +10 |
| Pause function | Present in source | +5 |
| Proxy / delegatecall | Detected | +5 |

**Score → Level:**
- `0–30` → 🟢 Low Risk
- `31–60` → 🟡 Medium Risk
- `61–100` → 🔴 High Risk

---

## Project Structure

```
ink-risk-intelligence/
├── frontend/               # Next.js web app (Vercel)
├── backend/                # Node.js + Express API (Render)
├── chrome-extension/       # Chrome extension (Manifest v3)
├── ink_logo.svg            # Brand assets
└── README.md
```

---

## Frontend

**Stack:** Next.js 15 · TailwindCSS v4 · TypeScript · React 19

**Features:**
- Single-page app: hero → ticker → analyzer → how it works
- Risk score card with color coding (emerald / amber / rose)
- Quick view (warning pills) + Full analysis (AI explanation) toggle
- Reactive mascot — Ink the octopus changes color by risk level
- Scrolling ticker of pre-analyzed Avalanche tokens
- Deep linking: `?address=0x...` auto-analyzes on load
- Language toggle EN/ES (UI + AI explanations)
- Recent analyses stored in localStorage

### Run locally

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

**Environment** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Backend

**Stack:** Node.js · Express 5 · Mongoose · ethers.js · Groq SDK

**Main endpoint:**

```http
POST /analyze
Content-Type: application/json

{
  "address": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "chain": "avalanche",
  "language": "en"
}
```

**Response:**
```json
{
  "address": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "score": 25,
  "level": "Low",
  "warnings": [],
  "explanation": "This contract is verified, ownership has been renounced...",
  "signals": {
    "contract_verified": true,
    "ownership_renounced": true,
    "has_mint_function": false,
    "holder_concentration_top1": 8.2,
    "holder_concentration_top10": 31.4
  }
}
```

**Other endpoints:**
- `GET /health` — Health check
- `GET /stats` — Total contracts analyzed

### Run locally

```bash
cd backend
npm install
cp .env.example .env   # fill in your API keys
node index.js
# → http://localhost:8000
```

**Environment** (`backend/.env`):
```env
PORT=8000
MONGO_URI=mongodb+srv://...
AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=           # optional, increases rate limits
GROQ_API_KEY=gsk_...
COVALENT_API_KEY=cqt_...
```

### Services

| File | Purpose |
|------|---------|
| `src/services/scoringEngine.js` | Deterministic risk scoring — no LLM |
| `src/services/avalancheService.js` | Snowtrace API + Avalanche RPC |
| `src/services/covalentService.js` | Token holder concentration |
| `src/services/llmService.js` | Groq API — Llama 3.3 70B |
| `src/services/aiService.js` | AI explanation wrapper |
| `src/config/db.js` | MongoDB connection |
| `src/models/ContractAnalysis.js` | Cache schema (TTL 1h) |

---

## Chrome Extension

**Manifest v3 · Works on any website**

The extension does two things:

1. **Content script** — Scans any webpage for EVM addresses, highlights them, and shows a risk tooltip on hover.
2. **Popup** — A mini analyzer: paste any address, get the score + warnings, open full analysis in the web app.

### Install (developer mode)

1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `chrome-extension/` folder

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TailwindCSS v4, TypeScript |
| Backend | Node.js, Express 5, Mongoose |
| Blockchain | Avalanche C-Chain, ethers.js, Snowtrace API |
| Token data | Routescan API, Covalent API |
| AI | Groq API — Llama 3.3 70B Versatile |
| Cache | MongoDB Atlas (TTL 1h) |
| Hosting | Vercel (frontend) + Render (backend) |
| Extension | Chrome Manifest v3 |

---

## Tested Contracts

| Token | Address | Score | Level |
|-------|---------|-------|-------|
| USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 25 | 🟢 Low |
| USDT.e | `0xc7198437980c041c805A1EDcbA50c1Ce5db95118` | 30 | 🟢 Low |
| WETH.e | `0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB` | 30 | 🟢 Low |
| JOE | `0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fD7` | 35 | 🟡 Medium |
| QI | `0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5` | 35 | 🟡 Medium |
| DAI.e | `0xd586E7F844cEa2F87f50152665BCbc2C279D8d70` | 45 | 🟡 Medium |
| WBTC.e | `0x50b7545627a5162F82A992c33b87aDc75187B218` | 45 | 🟡 Medium |
| PNG | `0x60781C2586D68229fde47564546784ab3fACA982` | 55 | 🟡 Medium |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` | 60 | 🟡 Medium |
| sAVAX | `0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE` | 60 | 🟡 Medium |
| RUG Token | `0xb8EF3a190b68175000B74B4160d325FD5024760e` | 65 | 🔴 High |
| BTC.b | `0x152b9d0FdC40C096757F570A51E494bd4b943E50` | 70 | 🔴 High |

---

## Why Ink?

Existing tools (Token Sniffer, GoPlus, RugDoc) show data.
**We explain what it means.**

Our differentiator is the translation layer — turning on-chain complexity into plain-language risk decisions that non-technical users can actually act on.

---

## Team

| Name | Role | GitHub |
|------|------|--------|
| Luciano | AI + scoring logic | [@jehp23](https://github.com/jehp23) |
| Agustín | API + on-chain data | [@juarex9](https://github.com/juarex9) |
| Mariano | UI + demo + clarity | [@Marixs01](https://github.com/Marixs01) |

---

<p align="center">Built at a hackathon · Avalanche C-Chain · 2025</p>
