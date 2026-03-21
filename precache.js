/**
 * precache.js — Pre-warms MongoDB cache for all ticker contracts.
 * Run once before the demo: node precache.js
 */

require("dotenv/config");
const axios = require("axios");

const API = "http://localhost:8000/analyze";

const CONTRACTS = [
  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
  "0xb8EF3a190b68175000B74B4160d325FD5024760e", // RUG
  "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fD7", // JOE
  "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", // DAI.e
  "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
  "0xc7198437980c041c805A1EDcbA50c1Ce5db95118", // USDT.e
  "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", // WETH.e
  "0x60781C2586D68229fde47564546784ab3fACA982", // PNG
  "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", // QI
  "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", // sAVAX
  "0x152b9d0FdC40C096757F570A51E494bd4b943E50", // BTC.b
  "0x50b7545627a5162F82A992c33b87aDc75187B218", // WBTC.e
];

async function analyze(address, language) {
  try {
    const res = await axios.post(API, { address, language }, { timeout: 30000 });
    const { score, level, tokenName, tokenSymbol } = res.data;
    console.log(`✅ ${(tokenName || address.slice(0, 10)).padEnd(12)} [${language}] — ${score}/100 ${level}`);
  } catch (e) {
    console.error(`❌ ${address.slice(0, 10)} [${language}] — ${e.message}`);
  }
}

(async () => {
  console.log(`\n🔥 Pre-caching ${CONTRACTS.length} contracts × 2 languages...\n`);
  for (const address of CONTRACTS) {
    await analyze(address, "es");
    await analyze(address, "en");
    await new Promise(r => setTimeout(r, 500)); // throttle
  }
  console.log("\n✅ Pre-cache complete. The demo is ready.\n");
})();
