const FRONTEND_URL = 'https://ink-three-iota.vercel.app';
const currentLang = 'en';
let lastAddress = '';

// ── State helpers ─────────────────────────────────────────────────
function showState(name) {
  ['empty', 'loading', 'result', 'error'].forEach(s => {
    document.getElementById(`state-${s}`).style.display = s === name ? (s === 'result' ? 'block' : 'flex') : 'none';
  });
  if (name === 'loading' || name === 'empty') {
    document.getElementById('state-loading').style.display = name === 'loading' ? 'block' : 'none';
    document.getElementById('state-empty').style.display = name === 'empty' ? 'block' : 'none';
  }
}

// ── Render result ─────────────────────────────────────────────────
function renderResult(data) {
  const level = (data.level || '').toLowerCase();

  const scoreEl = document.getElementById('res-score');
  scoreEl.textContent = data.score;
  scoreEl.className = `score-num score-${level}`;

  const levelEl = document.getElementById('res-level');
  levelEl.textContent = `${data.level} Risk`;
  levelEl.className = `level-badge badge-${level}`;

  const tokenEl = document.getElementById('res-token');
  tokenEl.textContent = data.tokenName ? `${data.tokenName}${data.tokenSymbol ? ' · ' + data.tokenSymbol : ''}` : '';

  const card = document.getElementById('result-card');
  card.className = `result-card${level === 'high' ? ' risk-high' : ''}`;

  const warningsEl = document.getElementById('res-warnings');
  warningsEl.innerHTML = (data.warnings || []).slice(0, 3).map(w => `
    <div class="warning">
      <span class="warn-dot${level === 'high' ? ' high' : ''}"></span>
      <span>${w}</span>
    </div>`).join('');

  document.getElementById('state-result').style.display = 'block';
  document.getElementById('state-loading').style.display = 'none';
  document.getElementById('state-empty').style.display = 'none';
  document.getElementById('state-error').style.display = 'none';
}

// ── Analyze ───────────────────────────────────────────────────────
async function analyze() {
  const address = document.getElementById('addr-input').value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    document.getElementById('error-text').textContent = 'Enter a valid 0x address (42 characters).';
    document.getElementById('state-empty').style.display = 'none';
    document.getElementById('state-error').style.display = 'flex';
    return;
  }

  lastAddress = address;
  document.getElementById('state-empty').style.display = 'none';
  document.getElementById('state-result').style.display = 'none';
  document.getElementById('state-error').style.display = 'none';
  document.getElementById('state-loading').style.display = 'block';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE',
      address,
      language: currentLang,
    });

    if (response?.data) {
      renderResult(response.data);
    } else {
      document.getElementById('state-loading').style.display = 'none';
      document.getElementById('error-text').textContent = 'Could not analyze this contract.';
      document.getElementById('state-error').style.display = 'flex';
    }
  } catch {
    document.getElementById('state-loading').style.display = 'none';
    document.getElementById('error-text').textContent = 'Connection error. Is the backend running?';
    document.getElementById('state-error').style.display = 'flex';
  }
}

// ── Open in app ───────────────────────────────────────────────────
function openInApp() {
  const address = lastAddress || document.getElementById('addr-input').value.trim();
  const url = /^0x[a-fA-F0-9]{40}$/.test(address)
    ? `${FRONTEND_URL}/?address=${address}`
    : FRONTEND_URL;
  chrome.tabs.create({ url });
}

// ── Events ────────────────────────────────────────────────────────
document.getElementById('btn-analyze').addEventListener('click', analyze);
document.getElementById('btn-open-app').addEventListener('click', openInApp);
document.getElementById('addr-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') analyze();
});
