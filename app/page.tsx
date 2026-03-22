"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const InkMascot = dynamic(() =>
  import("@/components/InkMascot").then((m) => m.InkMascot), { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────

type Level = "Low" | "Medium" | "High";

interface Signals {
  contract_verified: boolean | null;
  has_mint_function: boolean | null;
  has_blacklist_function: boolean | null;
  has_pause_function: boolean | null;
  ownership_renounced: boolean | null;
  has_transfer_restrictions: boolean | null;
  holder_concentration_top1: number | null;
  holder_concentration_top10: number | null;
  liquidity_pool_age_days: number | null;
  liquidity_amount_usd: number | null;
  is_proxy: boolean | null;
}

interface AnalysisResult {
  address: string;
  score: number;
  level: Level;
  warnings: string[];
  explanation: string;
  signals: Signals;
  language: string;
  tokenName?: string | null;
  tokenSymbol?: string | null;
}

interface TokenSuggestion {
  address: string;
  name: string;
  symbol: string;
  liquidityUsd: number | null;
}

interface TokenPreview {
  address: string;
  name: string;
  symbol: string;
  priceUsd: string | null;
  liquidityUsd: number | null;
}

interface RecentItem {
  address: string;
  tokenName:   string | null;
  tokenSymbol: string | null;
  score: number;
  level: Level;
}

const EVM_REGEX  = /^0x[a-fA-F0-9]{40}$/;
const RECENT_KEY = "ink_recent";
const API_URL    = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Token name → address lookup (Avalanche C-Chain, verified)
const TOKEN_LOOKUP: Record<string, string> = {
  "usdc":     "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "rug":      "0xb8EF3a190b68175000B74B4160d325FD5024760e",
  "joe":      "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fD7",
  "dai.e":    "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
  "dai":      "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
  "wavax":    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  "avax":     "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  "usdt.e":   "0xc7198437980c041c805A1EDcbA50c1Ce5db95118",
  "usdt":     "0xc7198437980c041c805A1EDcbA50c1Ce5db95118",
  "weth.e":   "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  "weth":     "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  "eth":      "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  "png":      "0x60781C2586D68229fde47564546784ab3fACA982",
  "pangolin": "0x60781C2586D68229fde47564546784ab3fACA982",
  "qi":       "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5",
  "savax":    "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
  "btc.b":    "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
  "btcb":     "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
  "btc":      "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
  "bitcoin":  "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
  "wbtc.e":   "0x50b7545627a5162F82A992c33b87aDc75187B218",
  "wbtc":     "0x50b7545627a5162F82A992c33b87aDc75187B218",
};

// ── Translations ───────────────────────────────────────────────────

type Lang = "en" | "es";

const T = {
  en: {
    badges:        ["Avalanche C-Chain", "Snowtrace API", "Llama 3.3 · 70B", "Real-time"],
    hero_line1:    "Know before",
    hero_line2:    "you invest.",
    hero_sub:      "Ink analyzes any Avalanche smart contract and gives you an instant, AI-powered risk report in plain language.",
    hero_cta:      "Analyze a contract",
    hero_free:     "Free · No wallet needed",
    stats:         (count: number) => [
      { value: 11,    fmt: (n: number) => `${n}`,    label: "Risk signals checked"  },
      { value: 3,     fmt: (n: number) => `${n}`,    label: "On-chain data sources" },
      { value: count, fmt: (n: number) => `${n}+`,   label: "Contracts analyzed"    },
    ],
    ticker_live:   "Live",
    sec_label:     "Risk Analysis",
    sec_title:     "Analyze a contract",
    sec_sub:       "Paste any Avalanche contract address to get your instant report.",
    placeholder:   "0x address or token name (USDC, WAVAX…)",
    btn_analyze:   "Analyze",
    btn_analyzing: "Analyzing…",
    btn_go:        "Go",
    try_example:   "Try an example",
    examples: [
      { label: "USDC",          sub: "Circle · Verified stablecoin",    dot: "bg-emerald-400", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
      { label: "RUG Token",     sub: "High risk · Concentrated supply", dot: "bg-rose-400",    address: "0xb8EF3a190b68175000B74B4160d325FD5024760e" },
    ],
    loading_steps: ["Fetching contract data…", "Running risk analysis…", "Generating AI explanation…"],
    risk_score:    "Risk Score",
    level_desc: {
      High:   "This contract shows significant red flags.",
      Medium: "Some risk signals detected. Proceed with caution.",
      Low:    "No major risk signals detected.",
    },
    clean_badge:   "Clean ✓",
    no_threats:    "No threats detected — this contract looks safe.",
    quick_view:    "Quick view",
    full_analysis: "Full analysis",
    risk_signals:  "Risk Signals",
    no_signals:    "No risk signals detected",
    ai_analysis:   "AI Analysis",
    analyze_ph:    "Address or token name…",
    btn_clear:     "↩ Clear",
    hiw_label:     "How it works",
    hiw_title:     "Three steps. Zero guessing.",
    steps: [
      { n: "01", title: "Paste the address",        body: "Any Avalanche C-Chain contract. No wallet or setup needed." },
      { n: "02", title: "Ink reads the blockchain", body: "Source code, holders, liquidity — fetched in real time."    },
      { n: "03", title: "Get your risk report",     body: "A score and AI explanation you can actually act on."        },
    ],
    snowtrace_link: "View on Snowtrace →",
    warnings_label: "Warnings",
    copy_report:    "Copy report",
    copy_done:      "Copied ✓",
    share:          "Share →",
    share_done:     "Link copied ✓",
    na_label:       "N/A",
    recent_label:   "Recent",
    err_tx_hash:    "That looks like a transaction hash. Enter a contract address (42 characters).",
    err_no_server:  "Can't reach the server. Make sure the backend is running.",
    err_not_found:  "Contract not found on Avalanche. Double-check the address.",
    err_unknown_token: (name: string) => `"${name}" not found on Avalanche. Try the contract address (0x…).`,
    searching_token:   "Searching on Avalanche…",
    select_token:      "Multiple tokens found — select one:",
    liq_label:         "Liquidity",
    warn_eoa:       "No token data found — this address may be a wallet, not a contract.",
    footer: "ink · risk intelligence · avalanche",
  },
  es: {
    badges:        ["Avalanche C-Chain", "Snowtrace API", "Llama 3.3 · 70B", "Tiempo real"],
    hero_line1:    "Invertí con",
    hero_line2:    "confianza.",
    hero_sub:      "Ink analiza cualquier contrato de Avalanche y te da un informe de riesgo instantáneo con IA, en lenguaje simple.",
    hero_cta:      "Analizar un contrato",
    hero_free:     "Gratis · Sin wallet",
    stats:         (count: number) => [
      { value: 11,    fmt: (n: number) => `${n}`,    label: "Señales de riesgo"         },
      { value: 3,     fmt: (n: number) => `${n}`,    label: "Fuentes de datos on-chain" },
      { value: count, fmt: (n: number) => `${n}+`,   label: "Contratos analizados"      },
    ],
    ticker_live:   "En vivo",
    sec_label:     "Análisis de Riesgo",
    sec_title:     "Analizá un contrato",
    sec_sub:       "Pegá cualquier dirección de contrato de Avalanche para obtener tu informe al instante.",
    placeholder:   "Dirección 0x o nombre del token (USDC, WAVAX…)",
    btn_analyze:   "Analizar",
    btn_analyzing: "Analizando…",
    btn_go:        "Ir",
    try_example:   "Probá un ejemplo",
    examples: [
      { label: "USDC",             sub: "Circle · Stablecoin verificada",   dot: "bg-emerald-400", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
      { label: "RUG Token",         sub: "Alto riesgo · Supply concentrado",  dot: "bg-rose-400",  address: "0xb8EF3a190b68175000B74B4160d325FD5024760e" },
    ],
    loading_steps: ["Obteniendo datos del contrato…", "Ejecutando análisis de riesgo…", "Generando explicación con IA…"],
    risk_score:    "Puntuación de Riesgo",
    level_desc: {
      High:   "Este contrato muestra señales de alerta significativas.",
      Medium: "Se detectaron algunas señales de riesgo. Procedé con cuidado.",
      Low:    "No se detectaron señales de riesgo importantes.",
    },
    clean_badge:   "Limpio ✓",
    no_threats:    "Sin amenazas detectadas — este contrato parece seguro.",
    quick_view:    "Vista rápida",
    full_analysis: "Análisis completo",
    risk_signals:  "Señales de Riesgo",
    no_signals:    "No se detectaron señales de riesgo",
    ai_analysis:   "Análisis IA",
    analyze_ph:    "Dirección o nombre del token…",
    btn_clear:     "↩ Limpiar",
    hiw_label:     "Cómo funciona",
    hiw_title:     "Tres pasos. Cero dudas.",
    steps: [
      { n: "01", title: "Pegá la dirección",         body: "Cualquier contrato de Avalanche C-Chain. Sin billetera ni configuración." },
      { n: "02", title: "Ink lee la blockchain",     body: "Código fuente, holders, liquidez — obtenidos en tiempo real."           },
      { n: "03", title: "Obtenés tu informe",        body: "Un score y una explicación con IA sobre la que podés actuar."           },
    ],
    snowtrace_link: "Ver en Snowtrace →",
    warnings_label: "Advertencias",
    copy_report:    "Copiar informe",
    copy_done:      "Copiado ✓",
    share:          "Compartir →",
    share_done:     "Link copiado ✓",
    na_label:       "N/A",
    recent_label:   "Recientes",
    err_tx_hash:    "Eso parece un hash de transacción. Ingresá una dirección de contrato (42 caracteres).",
    err_no_server:  "No se puede conectar al servidor. Verificá que el backend esté corriendo.",
    err_not_found:  "Contrato no encontrado en Avalanche. Revisá la dirección.",
    err_unknown_token: (name: string) => `"${name}" no encontrado en Avalanche. Probá con la dirección (0x…).`,
    searching_token:   "Buscando en Avalanche…",
    select_token:      "Varios tokens encontrados — elegí uno:",
    liq_label:         "Liquidez",
    warn_eoa:       "Sin datos de token — esta dirección puede ser una wallet, no un contrato.",
    footer: "ink · inteligencia de riesgo · avalanche",
  },
} as const;

// ── Constants ──────────────────────────────────────────────────────

const LEVEL_COLOR: Record<Level, string> = {
  Low:    "text-emerald-400",
  Medium: "text-amber-400",
  High:   "text-rose-400",
};

const LEVEL_GLOW: Record<Level, string> = {
  Low:    "#10b981",
  Medium: "#f59e0b",
  High:   "#f43f5e",
};

const LEVEL_STROKE: Record<Level, string> = {
  Low:    "#10b981",
  Medium: "#f59e0b",
  High:   "#f43f5e",
};

const LEVEL_BG_TINT: Record<Level, string> = {
  Low:    "radial-gradient(ellipse 80% 60% at 50% 50%, #05291880 0%, transparent 70%)",
  Medium: "radial-gradient(ellipse 80% 60% at 50% 50%, #2d190080 0%, transparent 70%)",
  High:   "radial-gradient(ellipse 80% 60% at 50% 50%, #2d050880 0%, transparent 70%)",
};

const TICKER: { addr: string; full: string; name: string; score: number; level: Level }[] = [
  { addr: "0xB97EF9...c48a6E", full: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", name: "USDC",   score: 25, level: "Low"    },
  { addr: "0xb8EF3a...24760e", full: "0xb8EF3a190b68175000B74B4160d325FD5024760e", name: "RUG",    score: 65, level: "High"   },
  { addr: "0x6e84a6...C0fD7",  full: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fD7", name: "JOE",    score: 35, level: "Medium" },
  { addr: "0xd586E7...8d70",   full: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", name: "DAI.e",  score: 45, level: "Medium" },
  { addr: "0xB31f66...D66c7",  full: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", name: "WAVAX",  score: 60, level: "Medium" },
  { addr: "0xc71984...b95118", full: "0xc7198437980c041c805A1EDcbA50c1Ce5db95118", name: "USDT.e", score: 30, level: "Low"    },
  { addr: "0x49D5c2...10bAB",  full: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", name: "WETH.e", score: 30, level: "Low"    },
  { addr: "0x60781C...CA982",  full: "0x60781C2586D68229fde47564546784ab3fACA982", name: "PNG",    score: 55, level: "Medium" },
  { addr: "0x872943...76C0F5", full: "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", name: "QI",     score: 35, level: "Medium" },
  { addr: "0x2b2C81...E0eA4bE",full: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", name: "sAVAX",  score: 60, level: "Medium" },
  { addr: "0x152b9d...943E50", full: "0x152b9d0FdC40C096757F570A51E494bd4b943E50", name: "BTC.b",  score: 70, level: "High"   },
  { addr: "0x50b754...7B218",  full: "0x50b7545627a5162F82A992c33b87aDc75187B218", name: "WBTC.e", score: 45, level: "Medium" },
];


// ── Signal config ──────────────────────────────────────────────────

type SignalValue = boolean | number | null;

const SIGNAL_CONFIG: {
  key: keyof Signals;
  en: string;
  es: string;
  isRisky: (v: SignalValue) => boolean | null;
  fmt: (v: SignalValue, l: Lang) => string;
}[] = [
  {
    key: "contract_verified",
    en: "Contract Verified", es: "Contrato Verificado",
    isRisky: v => v === null ? null : !v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Verified" : "Verificado") : (l === "en" ? "Unverified" : "No verificado"),
  },
  {
    key: "ownership_renounced",
    en: "Ownership", es: "Ownership",
    isRisky: v => v === null ? null : !v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Renounced" : "Renunciado") : (l === "en" ? "Not renounced" : "No renunciado"),
  },
  {
    key: "has_mint_function",
    en: "Mint Function", es: "Función Mint",
    isRisky: v => v === null ? null : !!v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Present" : "Presente") : (l === "en" ? "None" : "Ninguna"),
  },
  {
    key: "has_blacklist_function",
    en: "Blacklist", es: "Blacklist",
    isRisky: v => v === null ? null : !!v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Present" : "Presente") : (l === "en" ? "None" : "Ninguna"),
  },
  {
    key: "has_transfer_restrictions",
    en: "Transfer Limits", es: "Límites de Transferencia",
    isRisky: v => v === null ? null : !!v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Present" : "Presentes") : (l === "en" ? "None" : "Ninguno"),
  },
  {
    key: "has_pause_function",
    en: "Pause Function", es: "Función Pause",
    isRisky: v => v === null ? null : !!v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Present" : "Presente") : (l === "en" ? "None" : "Ninguna"),
  },
  {
    key: "is_proxy",
    en: "Proxy Contract", es: "Contrato Proxy",
    isRisky: v => v === null ? null : !!v,
    fmt: (v, l) => v === null ? "—" : v ? (l === "en" ? "Yes" : "Sí") : (l === "en" ? "No" : "No"),
  },
  {
    key: "holder_concentration_top1",
    en: "Top Holder", es: "Mayor Holder",
    isRisky: v => v === null ? null : (v as number) > 30,
    fmt: v => v === null ? "—" : `${v}%`,
  },
  {
    key: "holder_concentration_top10",
    en: "Top 10 Holders", es: "Top 10 Holders",
    isRisky: v => v === null ? null : (v as number) > 60,
    fmt: v => v === null ? "—" : `${v}%`,
  },
  {
    key: "liquidity_pool_age_days",
    en: "Liquidity Age", es: "Edad Liquidez",
    isRisky: v => v === null ? null : (v as number) < 7,
    fmt: (v, l) => v === null ? "—" : `${v} ${l === "en" ? "days" : "días"}`,
  },
  {
    key: "liquidity_amount_usd",
    en: "Liquidity", es: "Liquidez",
    isRisky: v => v === null ? null : (v as number) < 10000,
    fmt: v => v === null ? "—" : `$${(v as number).toLocaleString()}`,
  },
];

// ── Hooks ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1600, active = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setV(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return v;
}

// ── Sub-components ─────────────────────────────────────────────────

function StatItem({ value, fmt, label, active }: {
  value: number; fmt: (n: number) => string; label: string; active: boolean;
}) {
  const n = useCountUp(value, 1600, active);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[32px] font-bold text-white tabular-nums tracking-tight leading-none">{fmt(n)}</span>
      <span className="text-xs text-white/30 font-medium">{label}</span>
    </div>
  );
}

function ScoreGauge({ score, level }: { score: number; level: Level }) {
  const r    = 54;
  const circ = 2 * Math.PI * r;
  const [displayed, setDisplayed] = useState(0);
  const [arcPct, setArcPct]       = useState(0);

  useEffect(() => {
    setDisplayed(0);
    setArcPct(0);
    const duration = 1100;
    const start    = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out expo
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplayed(Math.round(eased * score));
      setArcPct(eased * score);
      if (p < 1) requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const offset = circ * (1 - arcPct / 100);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="110" height="110" viewBox="0 0 136 136" className="sm:w-[136px] sm:h-[136px]">
        <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="68" cy="68" r={r} fill="none"
          stroke={LEVEL_STROKE[level]}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 68 68)"
          style={{
            transition: "stroke 0.8s ease",
            filter: `drop-shadow(0 0 8px ${LEVEL_STROKE[level]}80)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        {score === 0 ? (
          <span className="text-3xl font-bold text-emerald-400">✓</span>
        ) : (
          <span className={`text-3xl font-bold tabular-nums tracking-tight ${LEVEL_COLOR[level]}`}>{displayed}</span>
        )}
        <span className="text-[10px] text-white/25 mt-1 uppercase tracking-widest">/ 100</span>
      </div>
    </div>
  );
}

function LoadingSteps({ step, steps }: { step: number; steps: readonly string[] }) {
  return (
    <div className="mt-10 w-full space-y-3 anim-fade-up">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} className="flex items-center gap-3.5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-all duration-500
              ${done   ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
              : active ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40 animate-pulse"
              :          "bg-white/4 text-white/20 ring-1 ring-white/8"}`}>
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-sm transition-all duration-500
              ${done ? "text-white/25 line-through" : active ? "text-white/80" : "text-white/20"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SignalGrid({ signals, lang }: { signals: Signals; lang: Lang }) {
  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-1.5">
      {SIGNAL_CONFIG.map((cfg, i) => {
        const raw = signals[cfg.key] as SignalValue;
        const risky = cfg.isRisky(raw);
        const isNull = raw === null;
        const label = lang === "en" ? cfg.en : cfg.es;
        const value = cfg.fmt(raw, lang);
        return (
          <div
            key={cfg.key}
            className={`stagger-up flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
              isNull   ? "bg-white/[0.03]" :
              risky    ? "bg-rose-500/8 border border-rose-500/10" :
                         "bg-emerald-500/8 border border-emerald-500/10"
            }`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              isNull ? "bg-white/8 text-white/20" :
              risky  ? "bg-rose-500/20 text-rose-400" :
                       "bg-emerald-500/20 text-emerald-400"
            }`}>
              {isNull ? "·" : risky ? "✗" : "✓"}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-medium leading-tight truncate ${
                isNull ? "text-white/25" : risky ? "text-rose-300/80" : "text-emerald-300/80"
              }`}>{label}</p>
              <p className={`text-[10px] leading-tight mt-0.5 ${isNull ? "text-white/15" : "text-white/40"}`}>{value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TICKER_COLOR: Record<Level, string> = {
  Low:    "text-emerald-400",
  Medium: "text-amber-400",
  High:   "text-rose-400",
};
const TICKER_DOT: Record<Level, string> = {
  Low:    "bg-emerald-400",
  Medium: "bg-amber-400",
  High:   "bg-rose-400",
};
const TICKER_BADGE: Record<Level, string> = {
  Low:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  High:   "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

function Ticker({ liveLabel, onSelect }: { liveLabel: string; onSelect: (addr: string) => void }) {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="w-full overflow-hidden border-y border-white/[0.05]">
      <div className="flex items-center">
        {/* Live label */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-r border-white/5 bg-white/[0.02]">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">{liveLabel}</span>
        </div>
        {/* Scrolling items */}
        <div className="overflow-hidden flex-1">
          <div
            className="flex gap-0"
            style={{ width: "max-content", animation: "ticker-scroll 40s linear infinite" }}
            onMouseEnter={e => (e.currentTarget.style.animationPlayState = "paused")}
            onMouseLeave={e => (e.currentTarget.style.animationPlayState = "running")}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => onSelect(item.full)}
                className="flex items-center gap-2.5 shrink-0 text-xs px-6 py-3.5 border-r border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TICKER_DOT[item.level]}`} />
                <span className="text-white/55 font-semibold">{item.name}</span>
                <span className="text-white/18 font-mono hidden sm:inline">{item.addr}</span>
                <span className={`font-bold tabular-nums ${TICKER_COLOR[item.level]}`}>{item.score}</span>
                <span className={`text-[10px] border rounded-full px-1.5 py-0.5 font-medium ${TICKER_BADGE[item.level]}`}>{item.level}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function Home() {
  const [address, setAddress]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [loadStep, setLoadStep]   = useState(0);
  const [result, setResult]       = useState<AnalysisResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [mascotKey, setMascotKey] = useState(0);
  const [statsOn, setStatsOn]     = useState(false);
  const [viewMode, setViewMode]   = useState<"quick" | "full">("quick");
  const [lang, setLang]           = useState<Lang>("es");
  const [copied, setCopied]       = useState(false);
  const [shared, setShared]       = useState(false);
  const [recent, setRecent]       = useState<RecentItem[]>([]);
  const [suggestions, setSuggestions]   = useState<TokenSuggestion[]>([]);
  const [searching, setSearching]       = useState(false);
  const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const t = T[lang];

  const analyzerRef = useRef<HTMLDivElement>(null);
  const statsRef    = useRef<HTMLDivElement>(null);
  const [analyzedCount, setAnalyzedCount] = useState(12);

  // Fetch real analyzed count from backend
  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then(r => r.json())
      .then(d => { if (d.total > 0) setAnalyzedCount(d.total); })
      .catch(() => {});
  }, []);

  // Load recent analyses from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Re-analyze when language changes if there's a loaded result
  const prevLang = useRef<Lang>(lang);
  useEffect(() => {
    if (prevLang.current !== lang && result && !loading) {
      prevLang.current = lang;
      analyze(result.address);
    } else {
      prevLang.current = lang;
    }
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsOn(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!loading) return;
    setLoadStep(0);
    const t1 = setTimeout(() => setLoadStep(1), 2200);  // on-chain data ~2s
    const t2 = setTimeout(() => setLoadStep(2), 5500);  // scoring done ~5s, AI starts
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  // Token preview: fetch when a valid EVM address is typed/pasted
  useEffect(() => {
    const trimmed = address.trim();
    if (!EVM_REGEX.test(trimmed)) {
      setTokenPreview(null);
      return;
    }
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${trimmed}`);
        const data = await res.json();
        const avaxPair = data.pairs?.find((p: { chainId: string }) => p.chainId === "avalanche");
        if (avaxPair?.baseToken) {
          setTokenPreview({
            address: trimmed,
            name: avaxPair.baseToken.name,
            symbol: avaxPair.baseToken.symbol,
            priceUsd: avaxPair.priceUsd ?? null,
            liquidityUsd: avaxPair.liquidity?.usd ?? null,
          });
        } else {
          setTokenPreview(null);
        }
      } catch {
        setTokenPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [address]);

  // Deep linking: auto-analyze if ?address= is present in URL
  const didAutoAnalyze = useRef(false);
  useEffect(() => {
    if (didAutoAnalyze.current) return;
    const params = new URLSearchParams(window.location.search);
    const addrParam = params.get("address");
    if (addrParam && EVM_REGEX.test(addrParam.trim())) {
      didAutoAnalyze.current = true;
      setAddress(addrParam.trim());
      analyzerRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        setLoading(true);
        setError(null);
        setResult(null);
        setViewMode("quick");
        fetch(`${API_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addrParam.trim(), chain: "avalanche", language: lang }),
        })
          .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.message || e.error || `Error ${r.status}`))))
          .then((data: AnalysisResult) => {
            setResult(data); setMascotKey(k => k + 1); setViewMode("quick");
            const item: RecentItem = { address: data.address, tokenName: data.tokenName ?? null, tokenSymbol: data.tokenSymbol ?? null, score: data.score, level: data.level };
            setRecent(prev => { const next = [item, ...prev.filter(r => r.address !== data.address)].slice(0, 5); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /**/ } return next; });
          })
          .catch(e => setError(e instanceof Error ? e.message : "Something went wrong"))
          .finally(() => setLoading(false));
      }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchToken(query: string): Promise<TokenSuggestion[]> {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!data.pairs) return [];
    // Filter Avalanche pairs, deduplicate by token address, sort by liquidity
    const seen = new Set<string>();
    const results: TokenSuggestion[] = [];
    for (const pair of data.pairs) {
      if (pair.chainId !== "avalanche") continue;
      const token = pair.baseToken;
      if (!token?.address || seen.has(token.address.toLowerCase())) continue;
      seen.add(token.address.toLowerCase());
      results.push({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        liquidityUsd: pair.liquidity?.usd ?? null,
      });
    }
    return results.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)).slice(0, 5);
  }

  async function analyze(overrideAddress?: string) {
    const raw = (overrideAddress || address).trim();
    if (!raw) return;
    if (overrideAddress) setAddress(overrideAddress);

    // TX hash detection (0x + 64 hex chars)
    if (/^0x[a-fA-F0-9]{64}$/.test(raw)) {
      setError(t.err_tx_hash);
      return;
    }

    // Token name lookup — resolve name → address
    let resolved = raw;
    if (!EVM_REGEX.test(raw)) {
      // 1. Check local lookup first (instant)
      const local = TOKEN_LOOKUP[raw.toLowerCase()];
      if (local) {
        resolved = local;
        setAddress(local);
      } else {
        // 2. Search DexScreener for Avalanche tokens
        setSearching(true);
        setSuggestions([]);
        try {
          const found = await searchToken(raw);
          if (found.length === 0) {
            setError(t.err_unknown_token(raw));
            setSearching(false);
            return;
          }
          if (found.length === 1) {
            resolved = found[0].address;
            setAddress(found[0].address);
          } else {
            // Multiple results — show suggestions, stop here
            setSuggestions(found);
            setSearching(false);
            return;
          }
        } catch {
          setError(t.err_unknown_token(raw));
          setSearching(false);
          return;
        }
        setSearching(false);
      }
    }
    setSuggestions([]);

    setLoading(true);
    setError(null);
    setResult(null);
    setViewMode("quick");
    if (overrideAddress) setTokenPreview(null);
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: resolved, chain: "avalanche", language: lang }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || err.error || "";
        if (msg.toLowerCase().includes("no se encontró") || msg.toLowerCase().includes("not found")) {
          throw new Error(t.err_not_found);
        }
        throw new Error(msg || `Error ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      // Merge tokenPreview as fallback for name/symbol if backend didn't return them
      setTokenPreview(prev => {
        if (prev && !data.tokenName) data.tokenName = prev.name;
        if (prev && !data.tokenSymbol) data.tokenSymbol = prev.symbol;
        return prev; // keep preview alive for result card
      });
      setResult(data);
      setMascotKey(k => k + 1);
      // Save to recent analyses (with preview fallback)
      const item: RecentItem = { address: data.address, tokenName: data.tokenName ?? tokenPreview?.name ?? null, tokenSymbol: data.tokenSymbol ?? tokenPreview?.symbol ?? null, score: data.score, level: data.level };
      setRecent(prev => {
        const next = [item, ...prev.filter(r => r.address !== data.address)].slice(0, 5);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("fetch") || msg.includes("Failed") || msg.includes("NetworkError") || msg.includes("ECONNREFUSED")) {
        setError(t.err_no_server);
      } else {
        setError(msg || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!result) return;
    const tokenId = result.tokenName
      ? `${result.tokenName}${result.tokenSymbol ? ` (${result.tokenSymbol})` : ""}`
      : result.address;
    const lines = [
      `Ink Risk Report — ${tokenId}`,
      `Address: ${result.address}`,
      `Score: ${result.score}/100 · ${result.level} Risk`,
      "",
      "Warnings:",
      ...(result.warnings.length > 0 ? result.warnings.map(w => `  • ${w}`) : ["  None"]),
      "",
      result.explanation,
      "",
      `Analyzed by Ink · https://snowtrace.io/address/${result.address}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareAnalysis() {
    if (!result) return;
    const url = `${window.location.origin}${window.location.pathname}?address=${result.address}`;
    navigator.clipboard.writeText(url).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    });
  }

  const glow = result ? LEVEL_GLOW[result.level] : "#7c3aed";

  return (
    <div className="relative z-10">

      {/* 3 — Reactive background tint */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: result ? LEVEL_BG_TINT[result.level] : "transparent",
          transition: "background 1.4s ease",
        }}
      />

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="min-h-screen flex flex-col px-8 md:px-16 pt-10 pb-14 max-w-6xl mx-auto">

        {/* Nav */}
        <nav className="flex items-center justify-between mb-auto">
          <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                <InkMascot score={0} color="#29063c" width={20} />
              </div>
              <span className="text-sm font-semibold text-white/90 tracking-wide">Ink</span>
            </div>
          <div className="flex items-center gap-3">
            {t.badges.map(b => (
              <span key={b} className="hidden md:block text-[11px] text-white/30 glass-sm px-3 py-1.5 rounded-full">{b}</span>
            ))}
            <span className="md:hidden text-xs text-white/30 glass-sm px-3.5 py-1.5 rounded-full">Avalanche C-Chain</span>
            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === "en" ? "es" : "en")}
              className="text-[11px] font-semibold text-white/40 hover:text-white/80 glass-sm px-3 py-1.5 rounded-full transition-all duration-200"
            >
              {lang === "en" ? "ES" : "EN"}
            </button>
          </div>
        </nav>

        {/* Two-column hero */}
        <div className="flex-1 flex items-center">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center py-16">

            {/* Left — text */}
            <div className="flex flex-col gap-8 anim-fade-up">
              <div className="space-y-5">
                <h1 className="text-5xl lg:text-6xl font-bold tracking-[-0.03em] leading-[1.05]">
                  <span className="bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                    {t.hero_line1}
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
                    {t.hero_line2}
                  </span>
                </h1>
                <p className="text-lg text-white/40 leading-relaxed font-light max-w-sm">
                  {t.hero_sub}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => analyzerRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="btn-shimmer flex items-center gap-2.5 text-white font-medium text-sm px-7 py-3.5 rounded-2xl shadow-lg shadow-violet-900/40"
                  style={{ background: "linear-gradient(to right, #7c3aed, #a855f7, #7c3aed)" }}
                >
                  {t.hero_cta}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1.5v10M1.5 6.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="text-xs text-white/25">{t.hero_free}</span>
              </div>

              {/* Stats */}
              <div ref={statsRef} className="grid grid-cols-3 gap-8 pt-4 border-t border-white/6">
                {t.stats(analyzedCount).map(s => <StatItem key={s.label} {...s} active={statsOn} />)}
              </div>
            </div>

            {/* Right — Mascot */}
            <div className="flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div
                  className="anim-glow absolute rounded-full pointer-events-none"
                  style={{
                    width: 420, height: 420,
                    background: `radial-gradient(circle, ${glow}22 0%, transparent 68%)`,
                    transition: "background 1.2s ease",
                  }}
                />
                <InkMascot
                  key={mascotKey}
                  score={undefined}
                  width={240}
                  className={`relative z-10 ${loading ? "anim-think" : "anim-float"}`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <Ticker liveLabel={t.ticker_live} onSelect={addr => {
        analyzerRef.current?.scrollIntoView({ behavior: "smooth" });
        analyze(addr);
      }} />

      {/* ── ANALYZER ────────────────────────────────────────────── */}
      <section ref={analyzerRef} className="px-8 md:px-16 py-20 pb-32 max-w-6xl mx-auto">

        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/25 mb-3">{t.sec_label}</p>
          <h2 className="text-3xl font-bold tracking-[-0.02em] text-white">{t.sec_title}</h2>
          <p className="text-sm text-white/35 mt-3">{t.sec_sub}</p>
        </div>

        {/* ── State: no result yet ───────────────────────────────── */}
        {!result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* Left — Input */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={address}
                    onChange={e => { setAddress(e.target.value); setSuggestions([]); setError(null); if (!e.target.value.trim()) setTokenPreview(null); }}
                    onKeyDown={e => e.key === "Enter" && analyze()}
                    placeholder={t.placeholder}
                    disabled={loading}
                    className="flex-1 glass rounded-2xl px-5 py-3.5 text-sm font-mono text-white/80 placeholder:text-white/20 outline-none focus:ring-1 focus:ring-violet-500/60 disabled:opacity-40 transition-all duration-300"
                  />
                  <button
                    onClick={() => analyze()}
                    disabled={loading || !address.trim()}
                    className="btn-shimmer disabled:opacity-35 disabled:cursor-not-allowed text-white font-medium text-sm px-6 py-3.5 rounded-2xl shrink-0 shadow-lg shadow-violet-900/30"
                    style={{ background: "linear-gradient(to right, #7c3aed, #a855f7, #7c3aed)" }}
                  >
                    {loading ? t.btn_analyzing : t.btn_analyze}
                  </button>
                </div>

                {/* Token preview */}
                {(tokenPreview || previewLoading) && !loading && (
                  <div className="anim-fade-up flex items-center gap-3 glass-sm rounded-xl px-4 py-2.5">
                    {previewLoading ? (
                      <span className="w-3 h-3 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-violet-400/60 shrink-0" />
                    )}
                    {tokenPreview && (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white/80">{tokenPreview.symbol}</span>
                        <span className="text-xs text-white/35 truncate">{tokenPreview.name}</span>
                        {tokenPreview.priceUsd && (
                          <span className="text-xs text-white/25 ml-auto shrink-0">${parseFloat(tokenPreview.priceUsd).toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!loading && (
                  <div className="anim-fade-up flex flex-col gap-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/20">{t.try_example}</p>
                    <div className="flex gap-2.5">
                      {t.examples.map(ex => (
                        <button
                          key={ex.address}
                          onClick={() => { setAddress(ex.address); setError(null); }}
                          className="flex-1 glass-sm hover:bg-white/[0.06] active:scale-[0.98] rounded-2xl px-4 py-3 text-left transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ex.dot}`} />
                            <p className="text-sm font-medium text-white/80">{ex.label}</p>
                          </div>
                          <p className="text-[11px] text-white/25 ml-3.5">{ex.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {searching && (
                <div className="flex items-center gap-3 text-sm text-white/40 anim-fade-up">
                  <span className="w-4 h-4 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin shrink-0" />
                  {t.searching_token}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="anim-fade-up flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/25">{t.select_token}</p>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map(s => (
                      <button
                        key={s.address}
                        onClick={() => {
                          setAddress(s.address);
                          setSuggestions([]);
                          setTokenPreview({ address: s.address, name: s.name, symbol: s.symbol, priceUsd: null, liquidityUsd: s.liquidityUsd });
                          analyze(s.address);
                        }}
                        className="flex items-center gap-3 glass-sm hover:bg-white/[0.07] active:scale-[0.99] rounded-xl px-4 py-3 text-left transition-all duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white/80">{s.symbol}</span>
                            <span className="text-xs text-white/35 truncate">{s.name}</span>
                          </div>
                          <p className="text-[11px] font-mono text-white/20 mt-0.5">{s.address.slice(0,10)}…{s.address.slice(-4)}</p>
                        </div>
                        {s.liquidityUsd !== null && (
                          <span className="text-[11px] text-white/25 shrink-0">
                            {t.liq_label} ${s.liquidityUsd >= 1000 ? `${(s.liquidityUsd/1000).toFixed(0)}k` : s.liquidityUsd.toFixed(0)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && <LoadingSteps step={loadStep} steps={t.loading_steps} />}

              {error && (
                <div className="glass rounded-2xl px-5 py-4 border !border-rose-500/20">
                  <p className="text-sm text-rose-400">{error}</p>
                </div>
              )}

              {/* Recent analyses */}
              {!loading && recent.length > 0 && (
                <div className="anim-fade-up flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/20">{t.recent_label}</p>
                  <div className="flex flex-col gap-1.5">
                    {recent.map(item => (
                      <button
                        key={item.address}
                        onClick={() => { setAddress(item.address); setError(null); }}
                        className="flex items-center gap-3 glass-sm hover:bg-white/[0.06] active:scale-[0.99] rounded-xl px-4 py-2.5 text-left transition-all duration-200"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.level === "High" ? "bg-rose-400" : item.level === "Medium" ? "bg-amber-400" : "bg-emerald-400"
                        }`} />
                        <span className="text-sm text-white/70 font-medium truncate flex-1">
                          {item.tokenName || `${item.address.slice(0, 6)}…${item.address.slice(-4)}`}
                          {item.tokenSymbol && <span className="text-white/30 ml-1.5 text-xs">{item.tokenSymbol}</span>}
                        </span>
                        <span className={`text-xs font-bold tabular-nums shrink-0 ${
                          item.level === "High" ? "text-rose-400" : item.level === "Medium" ? "text-amber-400" : "text-emerald-400"
                        }`}>{item.score}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — empty, input takes full attention */}
            <div className="hidden lg:block" />
          </div>
        )}

        {/* ── State: result ready ────────────────────────────────── */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8 items-start anim-fade-up">

            {/* Left — mascot + token identity + controls */}
            <div className="flex flex-col items-center gap-4 lg:gap-5 pt-2 lg:pt-4">
              <div className="relative flex items-center justify-center">
                <div className="anim-glow absolute rounded-full pointer-events-none"
                  style={{
                    width: 240, height: 240,
                    background: `radial-gradient(circle, ${LEVEL_GLOW[result.level]}28 0%, transparent 68%)`,
                    transition: "background 1.2s ease",
                  }} />
                <InkMascot key={mascotKey} score={result.score} width={160} className={`relative z-10 anim-pop ${loading ? "anim-think" : "anim-float"}`} />
              </div>

              {/* Token identity card */}
              {(() => {
                const name   = result.tokenName   || tokenPreview?.name   || null;
                const symbol = result.tokenSymbol || tokenPreview?.symbol || null;
                const price  = tokenPreview?.priceUsd ?? null;
                return (
                  <div className="w-full glass-sm rounded-2xl px-4 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {name
                          ? <span className="text-sm font-semibold text-white/80 truncate">{name}</span>
                          : <span className="text-xs font-mono text-white/30 truncate">{result.address.slice(0,10)}…{result.address.slice(-6)}</span>
                        }
                        {symbol && <span className="text-[11px] text-white/30 glass-sm px-2 py-0.5 rounded-full shrink-0">{symbol}</span>}
                      </div>
                      {price && (
                        <span className="text-xs font-medium text-white/40 shrink-0">
                          ${parseFloat(price) < 0.01 ? parseFloat(price).toExponential(2) : parseFloat(price).toFixed(4)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-white/20">
                      {result.address.slice(0, 10)}…{result.address.slice(-8)}
                    </p>
                  </div>
                );
              })()}

              {/* Analyze another */}
              <div className="w-full flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={address}
                    onChange={e => { setAddress(e.target.value); setSuggestions([]); setError(null); if (!e.target.value.trim()) setTokenPreview(null); }}
                    onKeyDown={e => e.key === "Enter" && analyze()}
                    placeholder={t.analyze_ph}
                    disabled={loading}
                    className="flex-1 glass rounded-xl px-4 py-2.5 text-xs font-mono text-white/70 placeholder:text-white/20 outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-40 transition-all duration-300"
                  />
                  <button
                    onClick={() => analyze()}
                    disabled={loading || !address.trim()}
                    className="btn-shimmer disabled:opacity-35 disabled:cursor-not-allowed text-white font-medium text-xs px-4 py-2.5 rounded-xl shrink-0"
                    style={{ background: "linear-gradient(to right, #7c3aed, #a855f7, #7c3aed)" }}
                  >
                    {loading ? "…" : t.btn_go}
                  </button>
                </div>
                <button
                  onClick={() => { setResult(null); setAddress(""); setError(null); setTokenPreview(null); }}
                  className="w-full glass-sm hover:bg-white/[0.06] active:scale-[0.98] text-white/30 hover:text-white/60 text-xs font-medium py-2 rounded-xl transition-all duration-200"
                >
                  {t.btn_clear}
                </button>
              </div>

              {loading && <LoadingSteps step={loadStep} steps={t.loading_steps} />}
              {error && (
                <div className="w-full glass rounded-xl px-4 py-3 border !border-rose-500/20">
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
              )}
            </div>

            {/* Right — Result card */}
            <div className="flex flex-col gap-3">
            {!result.tokenName && !result.tokenSymbol && result.signals.contract_verified === false && (
              <div className="flex items-center gap-2.5 glass-sm rounded-2xl px-4 py-3 border border-amber-500/15">
                <span className="text-amber-400 text-sm shrink-0">⚠</span>
                <p className="text-xs text-amber-300/70">{t.warn_eoa}</p>
              </div>
            )}
            <div className={`glass rounded-3xl overflow-hidden ${result.level === "High" ? "high-risk-card" : ""}`}>

              {/* Score header */}
              <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 flex items-center gap-4 sm:gap-6 stagger-up" style={{ animationDelay: "0ms" }}>
                <ScoreGauge score={result.score} level={result.level} />
                <div className="flex-1 min-w-0">
                  {/* Token identity — use backend data with DexScreener fallback */}
                  {(() => {
                    const name   = result.tokenName   || tokenPreview?.name   || null;
                    const symbol = result.tokenSymbol || tokenPreview?.symbol || null;
                    const price  = tokenPreview?.priceUsd ?? null;
                    return (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {name && <p className="text-base font-bold text-white/90 truncate">{name}</p>}
                          {symbol && (
                            <span className="text-[11px] font-semibold text-white/35 glass-sm px-2 py-0.5 rounded-full shrink-0">
                              {symbol}
                            </span>
                          )}
                          {result.signals.contract_verified && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-[11px] font-mono text-white/20">
                            {result.address.slice(0, 8)}…{result.address.slice(-6)}
                          </p>
                          {price && (
                            <span className="text-[11px] text-white/30">
                              ${parseFloat(price) < 0.01 ? parseFloat(price).toExponential(2) : parseFloat(price).toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 font-medium mb-1">{t.risk_score}</p>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className={`text-2xl font-bold ${LEVEL_COLOR[result.level]}`}>{result.level} Risk</p>
                    {result.score === 0 && (
                      <span className="text-[11px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                        {t.clean_badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/25 mt-2 leading-relaxed">
                    {result.score === 0 ? t.no_threats : t.level_desc[result.level]}
                  </p>
                </div>
              </div>

              <div className="h-px bg-white/5 mx-5 sm:mx-7" />

              {/* View toggle */}
              <div className="px-5 sm:px-7 pt-5 pb-4 stagger-up flex gap-2" style={{ animationDelay: "100ms" }}>
                <button
                  onClick={() => setViewMode("quick")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                    ${viewMode === "quick"
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}
                >
                  {t.quick_view}
                </button>
                <button
                  onClick={() => setViewMode("full")}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                    ${viewMode === "full"
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}
                >
                  {t.full_analysis}
                </button>
              </div>

              <div className="h-px bg-white/5 mx-5 sm:mx-7" />

              {/* Quick view — warning pills */}
              {viewMode === "quick" && (
                <div className="px-5 sm:px-7 py-5 stagger-up" style={{ animationDelay: "200ms" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 font-medium mb-4">{t.risk_signals}</p>
                  {result.warnings.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.warnings.map((w, i) => (
                        <span key={i}
                          className="text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-2xl px-3.5 py-2 leading-snug">
                          {w}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-2xl px-3.5 py-2">
                      ✓ {t.no_signals}
                    </span>
                  )}
                </div>
              )}

              {/* Full view — signal grid + AI explanation */}
              {viewMode === "full" && (
                <>
                  <div className="px-5 sm:px-7 py-5 stagger-up" style={{ animationDelay: "200ms" }}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 font-medium mb-4">{t.risk_signals}</p>
                    <SignalGrid signals={result.signals} lang={lang} />
                  </div>

                  <div className="h-px bg-white/5 mx-5 sm:mx-7" />

                  {result.warnings.length > 0 && (
                    <div className="px-5 sm:px-7 py-5 stagger-up" style={{ animationDelay: "280ms" }}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 font-medium mb-3">{t.warnings_label}</p>
                      <ul className="flex flex-col gap-2">
                        {result.warnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-rose-500/15 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            </span>
                            <span className="text-xs text-white/55 leading-relaxed">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="h-px bg-white/5 mx-5 sm:mx-7" />

                  <div className="px-5 sm:px-7 py-5 stagger-up" style={{ animationDelay: "300ms" }}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 font-medium">{t.ai_analysis}</p>
                      <span className="text-[11px] text-white/20 glass-sm px-2.5 py-1 rounded-full">Llama 3.3 · 70B</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{result.explanation}</p>
                  </div>
                </>
              )}

              {/* Footer actions */}
              <div className="px-5 sm:px-7 pb-5 sm:pb-7 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyReport}
                    className="text-[11px] text-white/25 hover:text-white/60 glass-sm px-3 py-1.5 rounded-full transition-all duration-200"
                  >
                    {copied ? t.copy_done : t.copy_report}
                  </button>
                  <button
                    onClick={shareAnalysis}
                    className="text-[11px] text-white/25 hover:text-violet-400 glass-sm px-3 py-1.5 rounded-full transition-all duration-200"
                  >
                    {shared ? t.share_done : t.share}
                  </button>
                </div>
                <a
                  href={`https://snowtrace.io/address/${result.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-white/20 hover:text-violet-400 transition-colors duration-200"
                >
                  {t.snowtrace_link}
                </a>
              </div>
            </div>
            </div>{/* end result card wrapper */}
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section className="px-8 md:px-16 py-24 max-w-6xl mx-auto border-t border-white/5">
        <div className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/25 mb-3">{t.hiw_label}</p>
            <h2 className="text-3xl font-bold tracking-[-0.02em] text-white">{t.hiw_title}</h2>
          </div>
          <button
            onClick={() => analyzerRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="self-start md:self-auto text-xs text-violet-400 hover:text-violet-300 glass-sm px-4 py-2 rounded-full transition-colors duration-200"
          >
            {t.hero_cta} →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {t.steps.map((s, idx) => (
            <div key={s.n} className="glass step-card rounded-3xl px-7 py-7 flex flex-col gap-5 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  {idx === 0 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-violet-400">
                      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  )}
                  {idx === 1 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-violet-400">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  )}
                  {idx === 2 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-violet-400">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-[11px] font-black text-white/12 tabular-nums tracking-widest">{s.n}</span>
              </div>
              <div>
                <p className="font-semibold text-white/90 mb-2">{s.title}</p>
                <p className="text-sm text-white/35 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pb-12 text-[11px] text-white/15 tracking-[0.2em] uppercase border-t border-white/5 pt-8">
        {t.footer}
      </footer>
    </div>
  );
}
