# AI Scam Detector

> Paste a smart contract address → get an instant risk score + AI explanation.

## Quick Start

### Backend (Agustín)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add your API keys
uvicorn main:app --reload --port 8000
```

### Frontend (Mariano / Luciano)
```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

## Project Structure
```
AI Scam Detector/
├── backend/
│   ├── main.py          ← FastAPI app + scoring engine
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   └── page.tsx     ← main UI
│   └── components/
│       └── InkMascot.jsx ← color-shifting octopus mascot
└── CLAUDE.md            ← full project reference
```

## API
`POST http://localhost:8000/analyze`
```json
{ "address": "0xabc...", "chain": "avalanche" }
```
