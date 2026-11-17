// Verified Quran text access. The text in data/quran.json is the Tanzil Uthmani text,
// used verbatim. Nothing in this module modifies verse characters; the only presentation
// step is showing the basmala that Tanzil prefixes to the first verse as a separate header.
export let Q = null;
let surahOfId; // Uint8Array id->surah

export async function loadQuran() {
  if (Q) return Q;
  const r = await fetch('quran.json');
  Q = await r.json();
  if (Q.ayahs.length !== 6236 || Q.surahs.length !== 114) throw new Error('Quran data incomplete');
  surahOfId = new Uint8Array(6237);
  for (const s of Q.surahs) for (let a = 0; a < s.ayas; a++) surahOfId[s.start + a] = s.n;
  return Q;
}
export const surah = n => Q.surahs[n - 1];
export const vid = (s, a) => Q.surahs[s - 1].start + a - 1;
export function sa(id) { const s = surahOfId[id]; return { s, a: id - Q.surahs[s - 1].start + 1 }; }
export const text = id => Q.ayahs[id - 1];
function bsearch(arr, id) { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= id) lo = m; else hi = m - 1; } return lo + 1; }
export const juzOf = id => bsearch(Q.juzStart, id);
export const rubOf = id => bsearch(Q.rubStart, id);          // 1..240
export const hizbOf = id => Math.ceil(rubOf(id) / 4);         // 1..60
export const pageOf = id => bsearch(Q.pageStart, id);
export const isSajda = id => Q.sajda.includes(id);
export const juzRange = j => [Q.juzStart[j - 1], j < 30 ? Q.juzStart[j] - 1 : 6236];
export const hizbRange = h => [Q.rubStart[(h - 1) * 4], h < 60 ? Q.rubStart[h * 4] - 1 : 6236];

// Basmala presentation: Tanzil prefixes the first verse of surahs 2..114 (except 9)
// with the basmala (4 words). We display those 4 words as a header, character-for-character.
export function splitBasmala(id) {
  const t = text(id); const { s, a } = sa(id);
  if (a !== 1 || s === 1 || s === 9) return { basmala: null, body: t };
  const words = t.split(' ');
  const strip = w => w.replace(/[ً-ْٰۖ-ۭ]/g, '');
  const B = Q.basmala.split(' ').map(strip);
  if (words.length > 4 && words.slice(0, 4).map(strip).join(' ') === B.join(' ')) {
    return { basmala: words.slice(0, 4).join(' '), body: words.slice(4).join(' ') };
  }
  return { basmala: null, body: t };
}
export const verseBody = id => splitBasmala(id).body;

const AR = '٠١٢٣٤٥٦٧٨٩';
export const ar = n => String(n).replace(/\d/g, d => AR[d]);
export const endMark = a => '۝' + ar(a); // ۝ + Arabic-Indic number (rendered by Amiri Quran as a verse end ornament)
export const ref = id => { const { s, a } = sa(id); return `${surah(s).ar} ${ar(a)}`; };

// Search normalisation (search only — never used for display)
export function norm(s) {
  return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/\s+/g, ' ').trim();
}
let _normIdx;
export function searchText(q, limit = 60) {
  const nq = norm(q); if (nq.length < 2) return [];
  if (!_normIdx) _normIdx = Q.ayahs.map(norm);
  const out = [];
  for (let i = 0; i < 6236 && out.length < limit; i++) if (_normIdx[i].includes(nq)) out.push(i + 1);
  return out;
}
export function searchSurah(q) {
  const nq = norm(q).toLowerCase(); if (!nq) return [];
  if (/^\d+$/.test(q.trim())) { const n = +q.trim(); return n >= 1 && n <= 114 ? [surah(n)] : []; }
  return Q.surahs.filter(s => norm(s.ar).includes(nq) || s.t.toLowerCase().replace(/[-']/g, '').includes(nq.replace(/[-' ]/g, '')) || s.en.toLowerCase().includes(nq));
}
// "2:255" or "البقرة 255"
export function parseRef(q) {
  const m = q.trim().match(/^(\d{1,3})\s*[:：\/\-\s]\s*(\d{1,3})$/);
  if (m) { const s = +m[1], a = +m[2]; if (s >= 1 && s <= 114 && a >= 1 && a <= surah(s).ayas) return vid(s, a); }
  const m2 = q.trim().match(/^(.+?)\s+(\d{1,3}|[٠-٩]{1,3})$/);
  if (m2) {
    const a = +m2[2].replace(/[٠-٩]/g, d => AR.indexOf(d)); const ss = searchSurah(m2[1]);
    if (ss.length && a >= 1 && a <= ss[0].ayas) return vid(ss[0].n, a);
  }
  return null;
}
