// Local-first storage (IndexedDB). Nothing leaves the device.
const DB_NAME = 'noor', DB_VER = 1;
const STORES = {
  kv: { keyPath: 'k' },            // settings, positions, plan, misc
  verses: { keyPath: 'id' },       // memorization state per verse (global id 1..6236)
  days: { keyPath: 'd' },          // daily aggregates YYYY-MM-DD
  log: { keyPath: 'i', autoIncrement: true }, // revision events
  recs: { keyPath: 'id' },         // personal recordings (blobs)
  audio: { keyPath: 'k' },         // downloaded recitation verses `${reciter}:${id}`
  bookmarks: { keyPath: 'id' },
};
let _db;
function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [n, o] of Object.entries(STORES)) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, o);
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function tx(store, mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out; const p = fn(s);
    if (p && 'onsuccess' in p) p.onsuccess = () => { out = p.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
const idb = {
  get: (s, k) => tx(s, 'readonly', st => st.get(k)),
  put: (s, v) => tx(s, 'readwrite', st => st.put(v)),
  del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
  all: (s) => tx(s, 'readonly', st => st.getAll()),
  keys: (s) => tx(s, 'readonly', st => st.getAllKeys()),
  clear: (s) => tx(s, 'readwrite', st => st.clear()),
  putMany: (s, arr) => tx(s, 'readwrite', st => { arr.forEach(v => st.put(v)); }),
};
// In-memory fallback when IndexedDB is unavailable (private browsing / sandboxed previews).
const mem = {}; let autoI = 1;
const M = s => (mem[s] ||= new Map());
const kp = (s, v) => { const o = STORES[s]; if (o.autoIncrement && v[o.keyPath] == null) v[o.keyPath] = autoI++; return v[o.keyPath]; };
const memdb = {
  get: async (s, k) => M(s).get(k), put: async (s, v) => { M(s).set(kp(s, v), v); }, del: async (s, k) => { M(s).delete(k); },
  all: async s => [...M(s).values()], keys: async s => [...M(s).keys()], clear: async s => { M(s).clear(); }, putMany: async (s, arr) => arr.forEach(v => M(s).set(kp(s, v), v)),
};
export let storageOK = true;
let impl = null;
async function pick() {
  if (impl) return impl;
  try { if (!self.indexedDB) throw 0; await Promise.race([open(), new Promise((_, r) => setTimeout(() => r(0), 3000))]); impl = idb; }
  catch (e) { impl = memdb; storageOK = false; }
  return impl;
}
export const db = { stores: Object.keys(STORES) };
for (const m of Object.keys(idb)) db[m] = async (...a) => (await pick())[m](...a);
export const initStorage = pick;
export async function kvGet(k, def) { const r = await db.get('kv', k); return r ? r.v : def; }
export async function kvSet(k, v) { await db.put('kv', { k, v }); }

export function today(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10);
}
export function addDays(ds, n) { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return today(d); }
export function dayDiff(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }

// Daily aggregates (time is in seconds)
const dayQueue = new Map(); let dayTimer;
export async function bumpDay(field, n = 1) {
  const d = today(); const key = d + '|' + field;
  dayQueue.set(key, (dayQueue.get(key) || 0) + n);
  clearTimeout(dayTimer); dayTimer = setTimeout(flushDays, 800);
}
export async function flushDays() {
  if (!dayQueue.size) return;
  const items = [...dayQueue]; dayQueue.clear();
  const byDay = {};
  for (const [k, n] of items) { const [d, f] = k.split('|'); (byDay[d] ||= {})[f] = n; }
  for (const [d, fields] of Object.entries(byDay)) {
    const cur = (await db.get('days', d)) || { d };
    for (const [f, n] of Object.entries(fields)) cur[f] = (cur[f] || 0) + n;
    await db.put('days', cur);
  }
  document.dispatchEvent(new CustomEvent('noor:days'));
}
export async function getDay(d = today()) { return (await db.get('days', d)) || { d }; }
export async function setDayField(field, v, d = today()) { const cur = await getDay(d); cur[field] = v; await db.put('days', cur); }

export async function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
  return false;
}
