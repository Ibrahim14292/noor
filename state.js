import { kvGet, kvSet } from './db.js';
export const S = {
  theme: 'auto', qsize: 28, reciter: 'alafasy', rate: 1, readMode: 'flow', basmala: true, gap: 0,
  tajReciter: 'husary', showStatus: true,
};
export const PLAN = { minutes: 30, newPerDay: 3, time: '05:30', weeklyNew: 15, weeklyDays: 6, listenMin: 10, reminder: false };
export async function loadState() {
  Object.assign(S, await kvGet('settings', {}));
  Object.assign(PLAN, await kvGet('plan', {}));
  applyTheme();
}
export async function saveSettings(patch = {}) { Object.assign(S, patch); await kvSet('settings', S); applyTheme(); }
export async function savePlan(patch = {}) { Object.assign(PLAN, patch); await kvSet('plan', PLAN); }
export function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--qsize', S.qsize + 'px');
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0E1517' : '#FAF7F0';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// router registry
export const routes = {};
export const route = (name, fn) => { routes[name] = fn; };
export const go = h => { if (location.hash !== '#' + h) location.hash = h; else window.dispatchEvent(new HashChangeEvent('hashchange')); };
