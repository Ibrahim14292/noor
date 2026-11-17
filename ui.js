import { Q, ar } from './quran.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const ic = {
  home: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>'),
  book: I('<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>'),
  head: I('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'),
  brain: I('<path d="M12 3l2.2 4.6L19 8.3l-3.5 3.4.8 4.8L12 14.2 7.7 16.5l.8-4.8L5 8.3l4.8-.7z"/><path d="M8 20h8"/>'),
  more: I('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  play: I('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  pause: I('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>'),
  next: I('<path d="M17 5v14M15 12 5 5v14z"/>', 'style="transform:scaleX(-1)"'),
  prev: I('<path d="M17 5v14M15 12 5 5v14z"/>'),
  stop: I('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  repeat: I('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  back: I('<path d="m9 6 6 6-6 6"/>'),
  chev: I('<path d="m15 6-6 6 6 6"/>'),
  bookmark: I('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  check: I('<path d="m5 12 5 5 9-10"/>', 'stroke-width="2.6"'),
  eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeoff: I('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  down: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  up: I('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  flame: I('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5-1-3 0-6 1-8z"/>'),
  star: I('<path d="M12 2.8 14.6 9l6.6.5-5 4.3 1.6 6.4L12 16.8 6.2 20.2l1.6-6.4-5-4.3 6.6-.5z"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  type: I('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
  plan: I('<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4"/>'),
  shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  octa: I('<path d="M12 2l2.9 7.1L22 12l-7.1 2.9L12 22l-2.9-7.1L2 12l7.1-2.9z"/><circle cx="12" cy="12" r="2.2"/>'),
  share: I('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
};

export function toast(msg, ms = 2600) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}
export function sheet(html, onMount) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog');
  sh.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(scrim, sh);
  requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
  const close = () => { scrim.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { scrim.remove(); sh.remove(); }, 260); };
  scrim.onclick = close;
  sh.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  onMount?.(sh, close);
  return close;
}
export function ask(msg, okLabel = 'تأكيد', danger = false) {
  return new Promise(res => {
    let done = false;
    const close = sheet(`<h3>${esc(msg)}</h3><div class="grid2" style="margin-top:14px"><button class="btn" data-a="0">إلغاء</button><button class="btn ${danger ? 'bad' : 'pri'}" data-a="1">${esc(okLabel)}</button></div>`, (sh, c) => {
      sh.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { done = true; res(b.dataset.a === '1'); c(); });
    });
    setTimeout(() => { if (!document.querySelector('.sheet')) { if (!done) res(false); } }, 60000);
  });
}
export function surahOptions(sel) { return Q.surahs.map(s => `<option value="${s.n}" ${s.n == sel ? 'selected' : ''}>${ar(s.n)}. ${s.ar}</option>`).join(''); }
export function ayahOptions(s, sel) { const n = Q.surahs[s - 1].ayas; let o = ''; for (let i = 1; i <= n; i++) o += `<option value="${i}" ${i == sel ? 'selected' : ''}>${ar(i)}</option>`; return o; }
export function fmtDur(sec) {
  sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (h) return `${ar(h)} س ${ar(m)} د`; if (m) return `${ar(m)} د`; return `${ar(s)} ث`;
}
export const clock = sec => { sec = Math.floor(sec); const m = Math.floor(sec / 60), s = sec % 60; return ar(String(m).padStart(2, '0')) + ':' + ar(String(s).padStart(2, '0')); };
export function chips(name, opts, cur) { return `<div class="chips" data-chips="${name}">${opts.map(([v, l]) => `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`; }
export function bindChips(root, name, fn) {
  const box = root.querySelector(`[data-chips="${name}"]`); if (!box) return;
  box.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); });
}
// Save/share a file on iPhone (Share sheet → Save to Files), falling back to a download link.
export async function saveFile(blob, name) {
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
export const SRC_Q = '<span class="label-src"><i></i>نص قرآني موثّق · Tanzil</span>';
export const SRC_EXP = '<span class="label-src exp"><i></i>شرح تعليمي — ليس من نص القرآن</span>';
export const SRC_MINE = '<span class="label-src mine"><i></i>ملاحظة شخصية</span>';

// top bar for the current view
export function setTop(title, { sub = '', back = null, actions = '' } = {}) {
  const t = document.getElementById('topbar');
  t.innerHTML = `${back ? `<a class="iconbtn" href="#${back}" aria-label="رجوع">${ic.back}</a>` : ''}<h1>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${actions}`;
}
