// ── Ink Background Service Worker ────────────────────────────────
// Handles API calls and caching across all tabs.
// Update BACKEND_URL after Railway deployment.

const BACKEND_URL = 'https://ink-backend-mkis.onrender.com';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE') {
    handleAnalyze(msg.address, msg.language || 'en')
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async reply
  }

  if (msg.type === 'CLEAR_CACHE') {
    chrome.storage.local.clear(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_STATS') {
    chrome.storage.local.get(null, items => {
      const count = Object.keys(items).filter(k => k.startsWith('ink_')).length;
      sendResponse({ cachedCount: count });
    });
    return true;
  }
});

async function handleAnalyze(address, language) {
  const key = 'ink_' + address.toLowerCase() + '_' + language;
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];

  if (entry && (Date.now() - entry.cachedAt) < CACHE_TTL_MS) {
    return { source: 'cache', data: entry.data };
  }

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chain: 'avalanche', language }),
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  const data = await res.json();
  await chrome.storage.local.set({ [key]: { data, cachedAt: Date.now() } });
  return { source: 'api', data };
}
