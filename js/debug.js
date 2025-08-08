// Lightweight debug overlay and logger
// Usage:
// import { initDebugUI, debugLog } from './js/debug.js';
// initDebugUI();
// debugLog('message', optionalData);

export function initDebugUI(options = {}) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('debugOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'debugOverlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '10px';
  overlay.style.bottom = '10px';
  overlay.style.width = options.width || '380px';
  overlay.style.maxHeight = options.maxHeight || '40vh';
  overlay.style.overflowY = 'auto';
  overlay.style.padding = '8px';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.color = '#d7ffcc';
  overlay.style.fontFamily = 'Menlo, Consolas, monospace';
  overlay.style.fontSize = '12px';
  overlay.style.lineHeight = '1.4';
  overlay.style.border = '1px solid rgba(255,255,255,0.15)';
  overlay.style.borderRadius = '6px';
  overlay.style.zIndex = '99999';
  overlay.style.display = 'none';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '6px';
  const title = document.createElement('div');
  title.textContent = 'Debug';
  title.style.fontWeight = 'bold';
  title.style.color = '#a7f3d0';
  const btns = document.createElement('div');
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '×';
  toggleBtn.style.background = 'transparent';
  toggleBtn.style.color = '#d7ffcc';
  toggleBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  toggleBtn.style.borderRadius = '3px';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.onclick = () => { overlay.style.display = 'none'; };
  btns.appendChild(toggleBtn);
  header.appendChild(title);
  header.appendChild(btns);

  const list = document.createElement('div');
  list.id = 'debugOverlayList';

  const hint = document.createElement('div');
  hint.style.marginTop = '6px';
  hint.style.opacity = '0.7';
  hint.textContent = 'Press ` key to toggle';

  overlay.appendChild(header);
  overlay.appendChild(list);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    }
  });

  // expose globally
  window.__debugOverlay = overlay;
  window.__debugList = list;
}

export function debugLog(label, data) {
  // console logging
  if (data !== undefined) {
    try { console.log(`[DEBUG] ${label}`, data); } catch (_) {}
  } else {
    try { console.log(`[DEBUG] ${label}`); } catch (_) {}
  }

  // overlay logging
  if (typeof window === 'undefined') return;
  const list = window.__debugList;
  if (!list) return;
  const entry = document.createElement('div');
  const ts = new Date();
  const time = ts.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(ts.getMilliseconds()).padStart(3, '0');
  const text = typeof data === 'undefined' ? `${time}  ${label}` : `${time}  ${label}  ${safeJson(data)}`;
  entry.textContent = text;
  list.appendChild(entry);
  // keep last 120 lines
  while (list.childNodes.length > 120) list.removeChild(list.firstChild);
  // auto scroll if visible
  const overlay = window.__debugOverlay;
  if (overlay && overlay.style.display !== 'none') {
    overlay.scrollTop = overlay.scrollHeight;
  }
}

function safeJson(obj) {
  try { return JSON.stringify(obj); } catch (_) { return String(obj); }
}
