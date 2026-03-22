// ── Ink Content Script ────────────────────────────────────────────
const EVM_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);

const pageCache = new Map();
let hideTimer = null;
let currentAnchor = null;

// ── Tooltip ───────────────────────────────────────────────────────

const tooltip = document.createElement('div');
tooltip.className = 'ink-tooltip';
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
tooltip.addEventListener('mouseleave', scheduleHide);
document.body.appendChild(tooltip);

function scheduleHide() {
  hideTimer = setTimeout(hideTooltip, 200);
}

function hideTooltip() {
  tooltip.classList.remove('ink-tooltip--visible');
  currentAnchor = null;
}

function positionTooltip(anchor) {
  const rect = anchor.getBoundingClientRect();
  const tipHeight = 260, tipWidth = 320;
  let top = rect.bottom + 8, left = rect.left;
  if (rect.bottom + tipHeight > window.innerHeight) top = rect.top - tipHeight - 8;
  if (left + tipWidth > window.innerWidth) left = window.innerWidth - tipWidth - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}

function showLoading(anchor) {
  currentAnchor = anchor;
  tooltip.innerHTML = `
    <div class="ink-tt-header"><span class="ink-tt-logo">● INK</span><span class="ink-tt-close" id="ink-close">✕</span></div>
    <div class="ink-tt-address">${anchor.dataset.inkAddress}</div>
    <div class="ink-tt-loading"><div class="ink-tt-spinner"></div>Analyzing contract…</div>`;
  document.getElementById('ink-close')?.addEventListener('click', hideTooltip);
  positionTooltip(anchor);
  tooltip.classList.add('ink-tooltip--visible');
}

function showResult(anchor, data) {
  if (currentAnchor !== anchor) return;
  const level = (data.level || '').toLowerCase();
  const warnings = (data.warnings || []).slice(0, 3);
  tooltip.innerHTML = `
    <div class="ink-tt-header"><span class="ink-tt-logo">● INK</span><span class="ink-tt-close" id="ink-close">✕</span></div>
    <div class="ink-tt-address">${data.address || anchor.dataset.inkAddress}</div>
    <div class="ink-tt-score-row">
      <span class="ink-tt-score ink-tt-score--${level}">${data.score}</span>
      <span class="ink-tt-level ink-tt-level--${level}">${data.level} Risk</span>
      ${data.tokenName ? `<span style="font-size:12px;color:rgba(255,255,255,0.4);margin-left:auto">${data.tokenName}</span>` : ''}
    </div>
    <div class="ink-tt-divider"></div>
    <div class="ink-tt-warnings">
      ${warnings.map(w => `<div class="ink-tt-warning"><span class="ink-tt-warning-dot"></span><span>${w}</span></div>`).join('')}
    </div>
    <div class="ink-tt-footer">
      <span class="ink-tt-link" id="ink-open-app">Open full analysis →</span>
    </div>`;
  document.getElementById('ink-close')?.addEventListener('click', hideTooltip);
  document.getElementById('ink-open-app')?.addEventListener('click', () => {
    window.open(`https://ink-hinni2omx-jehp23s-projects.vercel.app/?address=${data.address || anchor.dataset.inkAddress}`, '_blank');
  });
  positionTooltip(anchor);
}

function showError(anchor) {
  if (currentAnchor !== anchor) return;
  tooltip.innerHTML = `
    <div class="ink-tt-header"><span class="ink-tt-logo">● INK</span><span class="ink-tt-close" id="ink-close">✕</span></div>
    <div class="ink-tt-address">${anchor.dataset.inkAddress}</div>
    <div class="ink-tt-loading" style="color:rgba(244,63,94,0.8)">Could not analyze this contract.</div>`;
  document.getElementById('ink-close')?.addEventListener('click', hideTooltip);
  positionTooltip(anchor);
}

// ── Hover handlers ────────────────────────────────────────────────

async function handleMouseEnter(e) {
  clearTimeout(hideTimer);
  const el = e.currentTarget;
  const address = el.dataset.inkAddress;
  if (!address) return;

  if (pageCache.has(address)) {
    currentAnchor = el;
    showResult(el, pageCache.get(address));
    return;
  }

  if (el.dataset.inkStatus === 'loading') return;
  el.dataset.inkStatus = 'loading';
  el.dataset.inkDot = 'loading';
  showLoading(el);

  try {
    const response = await chrome.runtime.sendMessage({ type: 'ANALYZE', address });
    if (response?.data) {
      const data = response.data;
      pageCache.set(address, data);
      el.dataset.inkStatus = 'loaded';
      el.dataset.inkDot = data.level.toLowerCase();
      showResult(el, data);
    } else {
      el.dataset.inkStatus = 'error';
      el.dataset.inkDot = 'error';
      showError(el);
    }
  } catch {
    el.dataset.inkStatus = 'error';
    el.dataset.inkDot = 'error';
    showError(el);
  }
}

function handleMouseLeave() { scheduleHide(); }

// ── DOM scanning ──────────────────────────────────────────────────

function extractAddress(el) {
  // From href: /address/0x... or /token/0x...
  const href = el.getAttribute('href') || '';
  const hrefMatch = href.match(/0x[a-fA-F0-9]{40}/);
  if (hrefMatch) return hrefMatch[0];

  // From text content (full address)
  const text = el.textContent || '';
  EVM_REGEX.lastIndex = 0;
  const textMatch = EVM_REGEX.exec(text);
  if (textMatch) return textMatch[0];

  return null;
}

function decorateElement(el) {
  if (el.dataset.inkAddress) return; // already processed
  const address = extractAddress(el);
  if (!address) return;

  el.dataset.inkAddress = address;
  el.dataset.inkStatus = 'pending';
  el.dataset.inkDot = 'pending';
  el.classList.add('ink-decorated');
  el.addEventListener('mouseenter', handleMouseEnter);
  el.addEventListener('mouseleave', handleMouseLeave);
}

function scanRoot(root) {
  // 1. Scan links with EVM addresses in href
  const links = root.querySelectorAll
    ? root.querySelectorAll('a[href*="/address/0x"], a[href*="/token/0x"]')
    : [];
  links.forEach(decorateElement);

  // 2. Scan text nodes for full addresses (fallback for non-link contexts)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName?.toUpperCase();
      if (!node.parentElement) return NodeFilter.FILTER_SKIP;
      if (SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.dataset.inkAddress) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.classList.contains('ink-decorated')) return NodeFilter.FILTER_REJECT;
      EVM_REGEX.lastIndex = 0;
      return EVM_REGEX.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  nodes.forEach(wrapTextNode);
}

function wrapTextNode(textNode) {
  const text = textNode.nodeValue;
  EVM_REGEX.lastIndex = 0;
  let match, lastIndex = 0, hasMatch = false;
  const fragment = document.createDocumentFragment();

  while ((match = EVM_REGEX.exec(text)) !== null) {
    hasMatch = true;
    if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    const span = document.createElement('span');
    span.className = 'ink-address ink-decorated';
    span.dataset.inkAddress = match[0];
    span.dataset.inkStatus = 'pending';
    span.dataset.inkDot = 'pending';
    span.innerHTML = `<span class="ink-dot-inline"></span>${match[0].slice(0,6)}…${match[0].slice(-4)}`;
    span.title = match[0];
    span.addEventListener('mouseenter', handleMouseEnter);
    span.addEventListener('mouseleave', handleMouseLeave);
    fragment.appendChild(span);
    lastIndex = EVM_REGEX.lastIndex;
  }

  if (!hasMatch) return;
  if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  textNode.parentNode.replaceChild(fragment, textNode);
}

// ── MutationObserver ──────────────────────────────────────────────

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('ink-tooltip')) {
        scanRoot(node);
        // Also check the node itself if it's a link
        if (node.tagName === 'A') decorateElement(node);
      }
    }
  }
});

// ── Init ──────────────────────────────────────────────────────────

scanRoot(document.body);
observer.observe(document.body, { childList: true, subtree: true });

// Re-scan after delays for SPAs that render content after load
setTimeout(() => scanRoot(document.body), 800);
setTimeout(() => scanRoot(document.body), 2500);
setTimeout(() => scanRoot(document.body), 5000);
