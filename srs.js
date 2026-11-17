// Memorization state + spaced-repetition revision (SM-2 inspired, user-tunable).
import { db, kvGet, today, addDays, dayDiff, bumpDay } from './db.js';

export const STATUS = {
  new: { ar: 'جديدة', cls: '' }, learning: { ar: 'قيد الحفظ', cls: 'info' },
  memorized: { ar: 'محفوظة', cls: 'ok' }, revise: { ar: 'تحتاج مراجعة', cls: 'warn' },
};
export const DEFAULT_SRS = { scale: 1, maxInterval: 120, dailyCap: 60, firstGap: 1, secondGap: 3, leech: 3 };

let cache = null; // Map id -> state
export async function loadVerses() { if (!cache) { cache = new Map(); for (const v of await db.all('verses')) cache.set(v.id, v); } return cache; }
export const vstate = id => cache?.get(id);
export const statusOf = id => cache?.get(id)?.status || 'new';
async function save(v) { cache.set(v.id, v); await db.put('verses', v); document.dispatchEvent(new CustomEvent('noor:verse', { detail: v.id })); }

export async function setStatus(id, status) {
  await loadVerses();
  const v = cache.get(id) || { id, status: 'new', ef: 2.5, interval: 0, reps: 0, lapses: 0, hist: [] };
  const prev = v.status; v.status = status;
  if (status === 'memorized' && prev !== 'memorized') {
    const cfg = { ...DEFAULT_SRS, ...(await kvGet('srs', {})) };
    v.memorizedAt ||= today(); v.reps = v.reps || 0; v.interval = cfg.firstGap; v.due = addDays(today(), cfg.firstGap);
    if (prev !== 'revise') bumpDay('newMem', 1);
  }
  if (status === 'learning') v.learningAt ||= today();
  if (status === 'revise') v.due = today();
  if (status === 'new') { v.due = null; v.interval = 0; v.reps = 0; }
  await save(v); return v;
}

// rating: 'easy' | 'hard' | 'forgot'
export async function review(id, rating) {
  await loadVerses();
  const cfg = { ...DEFAULT_SRS, ...(await kvGet('srs', {})) };
  const v = cache.get(id) || { id, status: 'memorized', ef: 2.5, interval: 0, reps: 0, lapses: 0, hist: [] };
  v.hist = (v.hist || []).slice(-30); v.hist.push({ d: today(), r: rating });
  if (rating === 'forgot') {
    v.lapses = (v.lapses || 0) + 1; v.ef = Math.max(1.3, (v.ef || 2.5) - 0.2); v.reps = 0; v.interval = 1;
    v.status = 'revise';
  } else if (rating === 'hard') {
    v.ef = Math.max(1.3, (v.ef || 2.5) - 0.15); v.reps = (v.reps || 0) + 1;
    v.interval = Math.max(1, Math.round((v.interval || 1) * 1.2 * cfg.scale));
    v.hard = (v.hard || 0) + 1;
    if (v.status === 'revise') v.status = 'memorized';
  } else {
    v.ef = Math.min(2.8, (v.ef || 2.5) + 0.05); v.reps = (v.reps || 0) + 1;
    // memorizing already scheduled the first check (firstGap); successful reviews then widen the gap
    v.interval = v.reps === 1 ? cfg.secondGap : v.reps === 2 ? Math.round(cfg.secondGap * v.ef * cfg.scale) : Math.round((v.interval || 1) * v.ef * cfg.scale);
    v.status = 'memorized';
  }
  v.interval = Math.min(Math.max(1, v.interval), cfg.maxInterval);
  v.due = addDays(today(), v.interval); v.last = today();
  await save(v);
  await db.put('log', { d: today(), id, r: rating, t: Date.now() });
  bumpDay('revDone', 1); if (rating === 'forgot') bumpDay('revForgot', 1);
  return v;
}

// Priority: overdue days, weak memory (low ease, many lapses) first.
export async function dueList(d = today()) {
  await loadVerses();
  const cfg = { ...DEFAULT_SRS, ...(await kvGet('srs', {})) };
  const due = [...cache.values()].filter(v => (v.status === 'memorized' || v.status === 'revise') && v.due && v.due <= d);
  const score = v => dayDiff(v.due, d) * 1 + (v.lapses || 0) * 3 + (2.8 - (v.ef || 2.5)) * 6 + (v.status === 'revise' ? 10 : 0);
  due.sort((a, b) => score(b) - score(a));
  return due.slice(0, cfg.dailyCap);
}
export async function weakVerses(n = 30) {
  await loadVerses();
  return [...cache.values()].filter(v => (v.lapses || 0) + (v.hard || 0) > 0)
    .sort((a, b) => ((b.lapses || 0) * 2 + (b.hard || 0)) - ((a.lapses || 0) * 2 + (a.hard || 0))).slice(0, n);
}
export async function counts() {
  await loadVerses(); const c = { new: 0, learning: 0, memorized: 0, revise: 0 };
  for (const v of cache.values()) c[v.status] = (c[v.status] || 0) + 1; return c;
}
export async function retention(days = 30) {
  const since = addDays(today(), -days); const logs = (await db.all('log')).filter(l => l.d >= since);
  if (!logs.length) return null;
  return Math.round(100 * logs.filter(l => l.r !== 'forgot').length / logs.length);
}
export function resetCache() { cache = null; }
