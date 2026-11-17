// Authentic recitation playback (verse-by-verse MP3s from public Quran audio archives).
// No synthetic audio is ever generated. Each reciter lists candidate sources in order;
// if one fails to load the next is tried and the working one is remembered.
import { db, kvGet, kvSet, bumpDay } from './db.js';
import { sa, surah, ref, Q } from './quran.js';

const pad = n => String(n).padStart(3, '0');
const EA = (folder) => ({ host: 'everyayah.com', url: (s, a) => `https://everyayah.com/data/${folder}/${pad(s)}${pad(a)}.mp3`, label: `EveryAyah · ${folder}` });
const IN = (ed, br = 128) => ({ host: 'cdn.islamic.network', url: (s, a, id) => `https://cdn.islamic.network/quran/audio/${br}/${ed}/${id}.mp3`, label: `Islamic Network CDN · ${ed} (${br}kbps)` });

export const RECITERS = [
  { id: 'alafasy', ar: 'مشاري راشد العفاسي', en: 'Mishary Rashid Alafasy', style: 'مرتل', src: [EA('Alafasy_128kbps'), IN('ar.alafasy'), EA('Alafasy_64kbps')] },
  { id: 'husary', ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary', style: 'مرتل', src: [EA('Husary_128kbps'), IN('ar.husary'), EA('Husary_64kbps')] },
  { id: 'minshawi', ar: 'محمد صديق المنشاوي', en: 'Mohamed Siddiq El-Minshawi', style: 'مرتل', src: [EA('Minshawy_Murattal_128kbps'), IN('ar.minshawi')] },
  { id: 'abdulbasit', ar: 'عبد الباسط عبد الصمد', en: 'Abdul Basit Abdus Samad', style: 'مرتل', src: [EA('Abdul_Basit_Murattal_192kbps'), EA('Abdul_Basit_Murattal_64kbps'), IN('ar.abdulbasitmurattal', 192), IN('ar.abdulbasitmurattal', 64)] },
  { id: 'maher', ar: 'ماهر المعيقلي', en: 'Maher Al-Muaiqly', style: 'مرتل', src: [EA('MaherAlMuaiqly128kbps'), IN('ar.mahermuaiqly'), EA('Maher_AlMuaiqly_64kbps')] },
  { id: 'sudais', ar: 'عبد الرحمن السديس', en: 'Abdulrahman Al-Sudais', style: 'مرتل', src: [EA('Abdurrahmaan_As-Sudais_192kbps'), IN('ar.abdurrahmaansudais', 192), EA('Abdurrahmaan_As-Sudais_64kbps'), IN('ar.abdurrahmaansudais', 64)] },
];
export const reciter = id => RECITERS.find(r => r.id === id) || RECITERS[0];

const workingIdx = {}; // reciterId -> index of last working source
async function loadWorking() { Object.assign(workingIdx, await kvGet('audioWorking', {})); }
loadWorking();

export function candidateUrls(rid, id) {
  const r = reciter(rid); const { s, a } = sa(id);
  const order = [...r.src.keys()]; const w = workingIdx[rid];
  if (w != null) { order.splice(order.indexOf(w), 1); order.unshift(w); }
  return order.map(i => ({ i, url: r.src[i].url(s, a, id), label: r.src[i].label }));
}

// ---------- offline downloads (stored as blobs in IndexedDB) ----------
export async function offlineBlob(rid, id) { const r = await db.get('audio', `${rid}:${id}`); return r ? r.blob : null; }
export async function downloadVerse(rid, id) {
  if (await db.get('audio', `${rid}:${id}`)) return true;
  for (const c of candidateUrls(rid, id)) {
    try {
      const res = await fetch(c.url, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob(); if (blob.size < 500) continue;
      await db.put('audio', { k: `${rid}:${id}`, rid, id, blob, src: c.label, at: Date.now() });
      return true;
    } catch (e) { /* CORS or network — try next source */ }
  }
  return false;
}
export async function downloadRange(rid, from, to, onProgress, signal) {
  let ok = 0, fail = 0;
  for (let id = from; id <= to; id++) {
    if (signal?.aborted) break;
    (await downloadVerse(rid, id)) ? ok++ : fail++;
    onProgress?.(id - from + 1, to - from + 1, ok, fail);
  }
  return { ok, fail };
}
export async function downloadedSummary() {
  const keys = await db.keys('audio'); const m = {};
  for (const k of keys) { const [rid, id] = k.split(':'); const s = sa(+id).s; ((m[rid] ||= {})[s] ||= 0); m[rid][s]++; }
  return m;
}
export async function deleteDownloads(rid, s) {
  const keys = await db.keys('audio');
  for (const k of keys) { const [r, id] = k.split(':'); if (r === rid && (!s || sa(+id).s === s)) await db.del('audio', k); }
}

// ---------- player engine ----------
// queue: array of verse ids. verseRepeat: times each verse plays (0 = infinite).
// rangeRepeat: times the whole queue plays (0 = infinite). autoNext: continue to next verse.
class Player extends EventTarget {
  constructor() {
    super();
    this.el = document.createElement('audio');
    this.el.preload = 'auto'; this.el.setAttribute('playsinline', ''); this.el.setAttribute('webkit-playsinline', '');
    document.body.appendChild(this.el);
    this.q = []; this.pos = 0; this.vRep = 1; this.rRep = 1; this.vCount = 0; this.rCount = 0;
    this.rid = 'alafasy'; this.rate = 1; this.autoNext = true; this.basmala = true; this.gap = 0;
    this.playing = false; this.inBasmala = false; this.objUrl = null; this.ctx = 'listen';
    this._cands = []; this._ci = 0; this._lastTick = 0;
    const el = this.el;
    el.addEventListener('ended', () => this._onEnded());
    el.addEventListener('error', () => this._onError());
    el.addEventListener('playing', () => { this.playing = true; this._emit('state'); });
    el.addEventListener('pause', () => { this.playing = false; this._emit('state'); this._savePos(); });
    el.addEventListener('timeupdate', () => {
      const now = performance.now();
      if (this.playing && this._lastTick && now - this._lastTick < 2000) this._acc += (now - this._lastTick) / 1000;
      this._lastTick = now;
      if (this._acc >= 5) { bumpDay('listenSec', Math.round(this._acc)); this._acc = 0; }
      this._emit('time');
    });
    this._acc = 0;
    // iOS interruptions (calls, Siri): media element pauses; we keep the queue so the user can resume.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this._emit('state'); });
    this._setupMediaSession();
  }
  _emit(t, detail) { this.dispatchEvent(new CustomEvent(t, { detail })); }
  get current() { return this.q[this.pos]; }
  get active() { return this.q.length > 0; }

  async start(ids, opts = {}) {
    this.q = ids.slice(); this.pos = opts.startAt ? Math.max(0, ids.indexOf(opts.startAt)) : 0;
    this.vRep = opts.verseRepeat ?? 1; this.rRep = opts.rangeRepeat ?? 1;
    if (opts.reciter) this.rid = opts.reciter;
    if (opts.rate) this.rate = opts.rate;
    if (opts.autoNext != null) this.autoNext = opts.autoNext;
    if (opts.basmala != null) this.basmala = opts.basmala;
    if (opts.gap != null) this.gap = opts.gap;
    this.ctx = opts.ctx || 'listen';
    this.vCount = 0; this.rCount = 0;
    await this._loadCurrent(true);
  }
  async _loadCurrent(withBasmala) {
    const id = this.current; if (!id) return;
    const { s, a } = sa(id);
    this.inBasmala = withBasmala && this.basmala && a === 1 && s !== 1 && s !== 9 && this.vCount === 0;
    const srcId = this.inBasmala ? 1 : id; // 1:1 is the basmala recitation
    if (this.objUrl) { URL.revokeObjectURL(this.objUrl); this.objUrl = null; }
    const blob = await offlineBlob(this.rid, srcId);
    if (blob) { this.objUrl = URL.createObjectURL(blob); this._cands = [{ url: this.objUrl, label: 'محفوظ على الجهاز', i: -1 }]; }
    else this._cands = candidateUrls(this.rid, srcId);
    this._ci = 0; this._setSrc();
    this._emit('verse', { id, basmala: this.inBasmala });
    this._updateMediaSession();
    try { await this.el.play(); } catch (e) { this.playing = false; this._emit('state'); this._emit('blocked'); }
  }
  _setSrc() {
    const c = this._cands[this._ci]; if (!c) return;
    this.sourceLabel = c.label; this.el.src = c.url;
    this.el.defaultPlaybackRate = this.rate; this.el.playbackRate = this.rate;
    try { this.el.preservesPitch = true; this.el.webkitPreservesPitch = true; } catch (e) {}
  }
  _onError() {
    if (!this.q.length) return;
    this._ci++;
    if (this._ci < this._cands.length) { this._setSrc(); this.el.play().catch(() => {}); return; }
    this.playing = false; this._emit('state');
    this._emit('error', { msg: navigator.onLine ? 'تعذّر تحميل التلاوة من المصادر المتاحة' : 'لا يوجد اتصال — نزّل السورة للاستماع دون إنترنت' });
  }
  async _onEnded() {
    const c = this._cands[this._ci];
    if (c && c.i >= 0 && workingIdx[this.rid] !== c.i) { workingIdx[this.rid] = c.i; kvSet('audioWorking', workingIdx); }
    if (this.inBasmala) { this.inBasmala = false; return this._loadCurrent(false); }
    this.vCount++;
    this._emit('repeat', { count: this.vCount });
    if (this.vRep === 0 || this.vCount < this.vRep) return this._after(() => this._loadCurrent(false));
    this.vCount = 0;
    if (!this.autoNext) { this.playing = false; this._emit('state'); this._emit('done'); return; }
    if (this.pos < this.q.length - 1) { this.pos++; return this._after(() => this._loadCurrent(true)); }
    this.rCount++;
    if (this.rRep === 0 || this.rCount < this.rRep) { this.pos = 0; return this._after(() => this._loadCurrent(true)); }
    this.playing = false; this._emit('state'); this._emit('done'); this._savePos();
  }
  _after(fn) { if (this.gap > 0) setTimeout(fn, this.gap * 1000); else fn(); }
  toggle() { if (!this.q.length) return; if (this.el.paused) this.el.play().catch(() => this._emit('blocked')); else this.el.pause(); }
  pause() { this.el.pause(); }
  next() { if (this.pos < this.q.length - 1) { this.pos++; this.vCount = 0; this._loadCurrent(true); } }
  prev() { if (this.el.currentTime > 2 || this.pos === 0) { this.el.currentTime = 0; this.el.play().catch(() => {}); } else { this.pos--; this.vCount = 0; this._loadCurrent(true); } }
  jumpTo(id) { const i = this.q.indexOf(id); if (i >= 0) { this.pos = i; this.vCount = 0; this._loadCurrent(true); } }
  setRate(r) { this.rate = r; this.el.defaultPlaybackRate = r; this.el.playbackRate = r; }
  setReciter(rid) { this.rid = rid; if (this.q.length) { const was = !this.el.paused; this._loadCurrent(false).then(() => { if (!was) this.el.pause(); }); } }
  stop() { this.el.pause(); this._savePos(); this.q = []; this.el.removeAttribute('src'); this.el.load(); this._emit('state'); this._emit('stop'); }
  _savePos() { if (this.current) kvSet('lastListen', { id: this.current, rid: this.rid, q: [this.q[0], this.q[this.q.length - 1]], at: Date.now() }); }
  _setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
    h('play', () => this.el.play()); h('pause', () => this.el.pause());
    h('nexttrack', () => this.next()); h('previoustrack', () => this.prev());
  }
  _updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.inBasmala ? 'البسملة' : `سورة ${ref(this.current)}`, artist: reciter(this.rid).ar, album: 'نور – NOOR',
        artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
    } catch (e) {}
  }
}
export let player;
export function initPlayer() { player = new Player(); return player; }
