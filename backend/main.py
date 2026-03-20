from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Scam Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    address: str
    chain: str = "avalanche"

class Signals(BaseModel):
    holder_concentration_top1: float | None = None
    holder_concentration_top10: float | None = None
    ownership_renounced: bool | None = None
    contract_verified: bool | None = None
    has_mint_function: bool | None = None
    has_blacklist_function: bool | None = None
    has_pause_function: bool | None = None
    has_transfer_restrictions: bool | None = None
    liquidity_pool_age_days: int | None = None
    liquidity_amount_usd: float | None = None

class AnalyzeResponse(BaseModel):
    address: str
    score: int
    level: str
    warnings: list[str]
    explanation: str
    signals: Signals

# ── Scoring engine (deterministic — NO LLM involvement) ─────────────────────

def compute_score(signals: Signals) -> tuple[int, list[str]]:
    """Returns (score 0-100, list of human-readable warnings)."""
    score = 0
    warnings = []

    if signals.holder_concentration_top1 and signals.holder_concentration_top1 > 30:
        score += 20
        warnings.append(
            f"Top holder controls {signals.holder_concentration_top1:.1f}% of supply"
        )

    if signals.holder_concentration_top10 and signals.holder_concentration_top10 > 60:
        score += 15
        warnings.append(
            f"Top 10 holders control {signals.holder_concentration_top10:.1f}% of supply"
        )

    if signals.ownership_renounced is False:
        score += 20
        warnings.append("Owner has not renounced ownership")

    if signals.contract_verified is False:
        score += 15
        warnings.append("Contract is not verified on Snowtrace")

    if signals.has_mint_function:
        score += 10
        warnings.append("Contract includes a mint function (unlimited token creation possible)")

    if signals.has_blacklist_function:
        score += 10
        warnings.append("Contract includes a blacklist function (your wallet could be blocked)")

    if signals.has_pause_function:
        score += 5
        warnings.append("Contract includes a pause function (transfers can be frozen)")

    if signals.has_transfer_restrictions:
        score += 10
        warnings.append("Contract has transfer restrictions")

    if signals.liquidity_pool_age_days is not None and signals.liquidity_pool_age_days < 7:
        score += 10
        warnings.append(
            f"Liquidity pool was created only {signals.liquidity_pool_age_days} day(s) ago"
        )

    if signals.liquidity_amount_usd is not None and signals.liquidity_amount_usd < 10_000:
        score += 10
        warnings.append(
            f"Very low liquidity (${signals.liquidity_amount_usd:,.0f})"
        )

    return min(score, 100), warnings


def score_to_level(score: int) -> str:
    if score <= 30:
        return "Low"
    elif score <= 60:
        return "Medium"
    return "High"

# ── On-chain data fetching ───────────────────────────────────────────────────

SNOWTRACE_API_KEY = os.getenv("SNOWTRACE_API_KEY", "")
COVALENT_API_KEY  = os.getenv("COVALENT_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")

async def fetch_snowtrace_data(address: str) -> dict:
    """Fetch contract source / ABI from Snowtrace to detect functions."""
    url = "https://api.snowtrace.io/api"
    params = {
        "module": "contract",
        "action": "getsourcecode",
        "address": address,
        "apikey": SNOWTRACE_API_KEY,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    result = data.get("result", [{}])[0] if data.get("result") else {}
    return result


async def fetch_holder_data(address: str) -> dict:
    """Fetch top holders from Covalent."""
    url = f"https://api.covalenthq.com/v1/43114/tokens/{address}/token_holders_v2/"
    headers = {"Authorization": f"Bearer {COVALENT_API_KEY}"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers, params={"page-size": 10})
        return resp.json()


async def call_llm_explanation(address: str, score: int, level: str, signals: Signals, warnings: list[str]) -> str:
    """Ask the LLM to explain the risk in plain language. Score is already computed."""
    if not OPENAI_API_KEY:
        return "AI explanation unavailable (no API key configured)."

    signals_list = "\n".join(f"- {w}" for w in warnings) if warnings else "- No significant risk signals detected"

    prompt = f"""Analyze the following smart contract risk data and explain it clearly.

Contract address: {address}
Risk score: {score}/100
Risk level: {level}

Detected signals:
{signals_list}

Your response must include:
1. A 2-3 sentence plain-language explanation of why this contract is risky (or not).
2. The most important warnings, phrased so a non-technical user understands the real-world implication.
3. A one-sentence bottom line.

Do not repeat the raw signal names. Translate them into consequences the user cares about."""

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a blockchain security analyst. Your job is to explain smart "
                            "contract risk to non-technical users in plain, simple language. "
                            "Be direct. Avoid jargon. Never invent signals that were not provided."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 300,
                "temperature": 0.3,
            },
        )
        data = resp.json()
    return data["choices"][0]["message"]["content"].strip()

# ── Main endpoint ────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    if req.chain != "avalanche":
        raise HTTPException(status_code=400, detail="Only Avalanche C-Chain is supported.")

    address = req.address.strip().lower()

    # 1. Fetch on-chain data
    snowtrace = await fetch_snowtrace_data(address)

    # 2. Build signals from raw data
    source_code = snowtrace.get("SourceCode", "")
    contract_verified = bool(source_code and source_code != "")
    has_mint       = "mint" in source_code.lower()       if source_code else None
    has_blacklist  = "blacklist" in source_code.lower()  if source_code else None
    has_pause      = "pause" in source_code.lower()       if source_code else None

    signals = Signals(
        contract_verified=contract_verified,
        has_mint_function=has_mint,
        has_blacklist_function=has_blacklist,
        has_pause_function=has_pause,
        # TODO (Agustín): fill holder data from Covalent
        holder_concentration_top1=None,
        holder_concentration_top10=None,
        ownership_renounced=None,
        liquidity_pool_age_days=None,
        liquidity_amount_usd=None,
    )

    # 3. Score (deterministic)
    score, warnings = compute_score(signals)
    level = score_to_level(score)

    # 4. LLM explanation
    explanation = await call_llm_explanation(address, score, level, signals, warnings)

    return AnalyzeResponse(
        address=address,
        score=score,
        level=level,
        warnings=warnings,
        explanation=explanation,
        signals=signals,
    )


@app.get("/health")
def health():
    return {"status": "ok"}
