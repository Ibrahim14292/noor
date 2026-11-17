import { db, kvGet, kvSet, today, getDay, setDayField, flushDays, requestPersist, addDays, initStorage, storageOK } from './db.js';
import { loadQuran, Q, surah, sa, vid, text, juzOf, hizbOf, pageOf, isSajda, juzRange, hizbRange, splitBasmala, ar, ref, searchText, searchSurah, parseRef } from './quran.js';
import { initPlayer, player, reciter, RECITERS } from './audio.js';
import { loadVerses, statusOf, setStatus, STATUS, dueList, counts } from './srs.js';
import { S, PLAN, loadState, saveSettings, routes, route, go } from './state.js';
import { esc, $, $$, ic, toast, sheet, setTop, SRC_Q, fmtDur, chips, bindChips } from './ui.js';
import './views-practice.js';
import './views-more.js';

// ---------------- shell ----------------
const TABS = [['home', 'الرئيسية', ic.home], ['mushaf', 'المصحف', ic.book], ['listen', 'الاستماع', ic.head], ['hifz', 'الحفظ', ic.brain], ['more', 'المزيد', ic.more]];
const TAB_OF = { home: 'home', mushaf: 'mushaf', read: 'mushaf', juz: 'mushaf', hizb: 'mushaf', bookmarks: 'mushaf', listen: 'listen', hifz: 'hifz', memorize: 'hifz', revision: 'hifz' };
function shell() {
  document.body.insertAdjacentHTML('afterbegin', `
  <div id="app"><header class="topbar" id="topbar"></header><main class="view" id="view"></main></div>
  <div class="mini" id="mini"><button id="mPlay" aria-label="تشغيل">${ic.play}</button><div class="mt"><b id="mTitle"></b><span id="mSub"></span></div><button id="mOpen" aria-label="فتح المشغل">${ic.head}</button><button id="mStop" aria-label="إيقاف">${ic.x}</button><div class="prog"><i id="mProg"></i></div></div>
  <nav class="tabs" id="tabs">${TABS.map(([h, l, i]) => `<a href="#${h}" data-t="${h}">${i}<span>${l}</span></a>`).join('')}</nav>`);
  addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });
}
function miniPlayer() {
  const upd = () => {
    const on = player.active; document.body.classList.toggle('has-mini', on);
    if (!on) return;
    $('#mPlay').innerHTML = player.playing ? ic.pause : ic.play;
    const id = player.current; $('#mTitle').textContent = id ? `سورة ${ref(id)}` : '';
    $('#mSub').textContent = reciter(player.rid).ar + (player.vRep !== 1 ? ` · تكرار ${player.vRep === 0 ? '∞' : ar(player.vCount + 1) + '/' + ar(player.vRep)}` : '');
  };
  ['state', 'verse', 'repeat', 'stop'].forEach(e => player.addEventListener(e, upd));
  player.addEventListener('time', () => { const d = player.el.duration; $('#mProg').style.width = d ? (100 * player.el.currentTime / d) + '%' : 0; });
  player.addEventListener('error', e => toast(e.detail.msg, 4000));
  player.addEventListener('blocked', () => toast('اضغط تشغيل لبدء التلاوة'));
  $('#mPlay').onclick = () => player.toggle(); $('#mStop').onclick = () => player.stop(); $('#mOpen').onclick = () => go('listen');
  upd();
}

let cleanup = null;
async function router() {
  const raw = decodeURIComponent(location.hash.slice(1)) || 'home';
  const [name, ...args] = raw.split('-');
  const fn = routes[name] || routes.home;
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const view = $('#view'); view.innerHTML = ''; view.className = 'view';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === (TAB_OF[name] || (routes[name] ? 'more' : 'home'))));
  if (!args.length || name !== 'read') scrollTo(0, 0);
  try { cleanup = (await fn(view, args)) || null; } catch (e) { console.error(e); view.innerHTML = `<div class="empty">حدث خطأ: ${esc(e.message)}</div>`; }
}

// ---------------- home ----------------
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : h < 18 ? 'السلام عليكم' : 'مساء الخير'; };
export async function streak() {
  const days = new Map((await db.all('days')).map(d => [d.d, d]));
  const active = d => { const x = days.get(d); return x && ((x.listenSec || 0) >= 60 || x.newMem || x.revDone || (x.memSec || 0) >= 60 || x.recCount || x.lessons); };
  let d = today(), n = 0; if (!active(d)) d = addDays(d, -1);
  while (active(d)) { n++; d = addDays(d, -1); }
  return n;
}
export async function checklist() {
  const day = await getDay(); const due = await dueList();
  const revDue = Math.max(day.revDue || 0, due.length + (day.revDone || 0));
  if (revDue !== day.revDue) await setDayField('revDue', revDue);
  const man = day.manual || {};
  const listenMin = ((day.listenSec || 0) + (day.recSec || 0)) / 60;
  return {
    day, due, revDue,
    a: { done: man.a || (day.newMem || 0) >= PLAN.newPerDay, txt: `${ar(day.newMem || 0)} / ${ar(PLAN.newPerDay)} آيات جديدة` },
    b: { done: man.b || (revDue > 0 ? (day.revDone || 0) >= revDue : (day.revDone || 0) > 0 || due.length === 0), txt: revDue ? `${ar(day.revDone || 0)} / ${ar(revDue)} مراجعة` : 'لا مراجعات مستحقة اليوم' },
    c: { done: man.c || listenMin >= PLAN.listenMin, txt: `${ar(Math.floor(listenMin))} / ${ar(PLAN.listenMin)} دقيقة استماع وتلاوة` },
  };
}
function ayahOfDay() {
  const n = Math.floor(Date.now() / 864e5); let id = (n * 7919) % 6236 + 1;
  while (text(id).length > 150 || splitBasmala(id).basmala) id = id % 6236 + 1;
  return id;
}
route('home', async (v) => {
  setTop('نور', { sub: 'رحلتي مع القرآن', actions: `<a class="iconbtn" href="#settings" aria-label="الإعدادات">${ic.gear}</a>` });
  const [st, c, cl, last, lastL] = await Promise.all([streak(), counts(), checklist(), kvGet('lastRead'), kvGet('lastListen')]);
  const hijri = (() => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); } catch (e) { return ''; } })();
  const greg = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const aod = ayahOfDay();
  const item = (k, title, href, label, ico) => `<div class="check ${cl[k].done ? 'done' : ''}" data-k="${k}"><div class="box">${ic.check}</div><div class="grow"><b>${title}</b><div class="tiny muted">${cl[k].txt}</div></div><a class="btn sm soft" href="#${href}">${ico}${label}</a></div>`;
  const doneN = ['a', 'b', 'c'].filter(k => cl[k].done).length;
  v.innerHTML = `
  <section class="hero">
    <p class="greet">${greet()}</p><div class="date">${greg}${hijri ? ' · ' + hijri : ''}</div>
    <div class="stats"><div><b>${ar(st)}</b><span>أيام متتالية</span></div><div><b>${ar(c.memorized + c.revise)}</b><span>آية محفوظة</span></div><div><b>${ar(cl.due.length)}</b><span>مراجعة اليوم</span></div></div>
  </section>
  <div class="h2">خطة اليوم <small>${ar(doneN)} / ٣ مكتمل</small></div>
  <div class="card" style="padding:4px 14px">
    ${item('a', 'أ. حفظ جديد', 'memorize', 'ابدأ', ic.brain)}
    ${item('b', 'ب. مراجعة المحفوظ', 'revision', 'راجع', ic.repeat)}
    ${item('c', 'ج. استماع وتلاوة', 'listen', 'استمع', ic.head)}
  </div>
  ${last || lastL ? `<div class="h2">تابع من حيث توقفت</div><div class="list">
    ${last ? `<a class="li" href="#read-${sa(last.id).s}-${sa(last.id).a}"><div class="num">${ic.book}</div><div class="t"><b>القراءة: سورة ${esc(ref(last.id))}</b><span>الجزء ${ar(juzOf(last.id))} · الصفحة ${ar(pageOf(last.id))}</span></div>${ic.chev.replace('<svg', '<svg class="chev"')}</a>` : ''}
    ${lastL ? `<a class="li" href="#listen-resume"><div class="num">${ic.head}</div><div class="t"><b>الاستماع: سورة ${esc(ref(lastL.id))}</b><span>${esc(reciter(lastL.rid).ar)}</span></div>${ic.chev.replace('<svg', '<svg class="chev"')}</a>` : ''}
  </div>` : ''}
  <div class="h2">آية اليوم</div>
  <div class="card"><div class="row between">${SRC_Q}<span class="badge teal">${esc(ref(aod))}</span></div>
    <div class="ayah-day">${esc(text(aod))}</div>
    <div class="row"><button class="btn sm soft" id="aodPlay">${ic.play}استمع</button><a class="btn sm ghost" href="#read-${sa(aod).s}-${sa(aod).a}">في المصحف</a></div></div>
  <div class="h2">أدواتي</div>
  <div class="grid2">
    ${[['memorize', 'الحفظ', 'آية بآية مع التكرار', ic.brain], ['revision', 'المراجعة الذكية', `${ar(cl.due.length)} مستحقة`, ic.repeat], ['record', 'تسجيل تلاوتي', 'سجّل وقارن', ic.mic], ['tajweed', 'تعلم التجويد', '٨ دروس عملية', ic.octa], ['plan', 'خطتي اليومية', 'الأهداف والتذكير', ic.plan], ['stats', 'لوحة التقدم', 'إحصاءات ورسوم', ic.chart]]
      .map(([h, b, s, i]) => `<a class="tile" href="#${h}"><div class="ic">${i}</div><b>${b}</b><span>${s}</span></a>`).join('')}
  </div>
  <p class="note info" style="margin-top:16px">${ic.info.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} أفضل طريق لإتقان التلاوة هو القراءة على معلم متقن يسمعك ويصحح لك. هذا التطبيق رفيق للمراجعة والتدريب، لا بديلًا عن المعلم.</p>`;
  $$('.check .box', v).forEach(b => b.onclick = async () => {
    const k = b.parentElement.dataset.k; const day = await getDay(); const man = day.manual || {}; man[k] = !b.parentElement.classList.contains('done'); await setDayField('manual', man); routes.home(v);
  });
  $('#aodPlay', v).onclick = () => player.start([aod], { reciter: S.reciter, rate: S.rate, basmala: false });
});

// ---------------- mushaf index ----------------
route('mushaf', async (v, [tab = 'surah']) => {
  setTop('المصحف الشريف', { sub: 'رواية حفص عن عاصم · نص Tanzil العثماني', actions: `<button class="iconbtn" id="srch" aria-label="بحث">${ic.search}</button><a class="iconbtn" href="#bookmarks" aria-label="العلامات">${ic.bookmark}</a>` });
  $('#srch').onclick = openSearch;
  const last = await kvGet('lastRead'); await loadVerses();
  const memIn = s => { let n = 0; const st = surah(s); for (let i = 0; i < st.ayas; i++) { const x = statusOf(st.start + i); if (x === 'memorized' || x === 'revise') n++; } return n; };
  const lists = {
    surah: () => Q.surahs.map(s => { const m = memIn(s.n); return `<a class="li" href="#read-${s.n}"><div class="num">${ar(s.n)}</div><div class="t"><b class="sname">${s.ar}</b><span>${s.type} · ${ar(s.ayas)} آية · ${s.t}</span></div>${m ? `<span class="badge ${m === s.ayas ? 'ok' : 'info'}">${m === s.ayas ? 'محفوظة' : ar(m) + '/' + ar(s.ayas)}</span>` : ''}</a>`; }).join(''),
    juz: () => Array.from({ length: 30 }, (_, i) => { const [f] = juzRange(i + 1); return `<a class="li" href="#juz-${i + 1}"><div class="num">${ar(i + 1)}</div><div class="t"><b>الجزء ${ar(i + 1)}</b><span>يبدأ من سورة ${esc(ref(f))}</span></div></a>`; }).join(''),
    hizb: () => Array.from({ length: 60 }, (_, i) => { const [f] = hizbRange(i + 1); return `<a class="li" href="#hizb-${i + 1}"><div class="num">${ar(i + 1)}</div><div class="t"><b>الحزب ${ar(i + 1)}</b><span>الجزء ${ar(Math.ceil((i + 1) / 2))} · يبدأ من ${esc(ref(f))}</span></div></a>`; }).join(''),
  };
  v.innerHTML = `
  ${last ? `<a class="card row" style="text-decoration:none;color:inherit" href="#read-${sa(last.id).s}-${sa(last.id).a}"><div class="grow"><div class="tiny muted">تابع القراءة</div><b class="sname">سورة ${esc(ref(last.id))}</b></div><span class="btn sm pri">متابعة</span></a>` : ''}
  <div class="card row" style="padding:10px;margin-top:12px"><input class="input grow" id="jump" placeholder="انتقل إلى آية: 2:255 أو البقرة 255" inputmode="text"><button class="btn pri sm" id="jumpGo">انتقال</button></div>
  <div class="seg" style="margin:14px 0 10px">${[['surah', 'السور'], ['juz', 'الأجزاء'], ['hizb', 'الأحزاب']].map(([k, l]) => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="list" id="idx">${lists[tab]()}</div>`;
  $$('.seg button', v).forEach(b => b.onclick = () => { $$('.seg button', v).forEach(x => x.classList.toggle('on', x === b)); $('#idx', v).innerHTML = lists[b.dataset.k](); });
  const jump = () => { const id = parseRef($('#jump').value); if (id) { const { s, a } = sa(id); go(`read-${s}-${a}`); } else toast('اكتب رقم السورة ورقم الآية، مثل 2:255'); };
  $('#jumpGo').onclick = jump; $('#jump').onkeydown = e => { if (e.key === 'Enter') jump(); };
});

// ---------------- search ----------------
export function openSearch() {
  sheet(`<h3>البحث في المصحف</h3><input class="input" id="sq" placeholder="اسم سورة، رقم آية (2:255)، أو كلمات من آية" autocomplete="off"><p class="tiny muted">البحث في النص يتجاهل التشكيل، والنتائج تُعرض بالرسم العثماني كما هو.</p><div id="sr"></div>`, (sh, close) => {
    const inp = $('#sq', sh); setTimeout(() => inp.focus(), 300);
    let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 200); };
    function run() {
      const q = inp.value.trim(); const out = $('#sr', sh); if (!q) { out.innerHTML = ''; return; }
      let html = ''; const r = parseRef(q);
      if (r) html += `<div class="list"><a class="li" href="#read-${sa(r).s}-${sa(r).a}" data-close><div class="num">${ic.chev}</div><div class="t"><b>انتقل إلى سورة ${esc(ref(r))}</b></div></a></div>`;
      const ss = searchSurah(q).slice(0, 8);
      if (ss.length) html += `<div class="h2">السور</div><div class="list">${ss.map(s => `<a class="li" href="#read-${s.n}" data-close><div class="num">${ar(s.n)}</div><div class="t"><b class="sname">${s.ar}</b><span>${s.t} · ${ar(s.ayas)} آية</span></div></a>`).join('')}</div>`;
      const vs = q.length >= 2 && !/^\d/.test(q) ? searchText(q, 50) : [];
      if (vs.length) html += `<div class="h2">الآيات <small>${ar(vs.length)}${vs.length === 50 ? '+' : ''}</small></div><div class="list">${vs.map(id => `<a class="li" href="#read-${sa(id).s}-${sa(id).a}" data-close style="display:block"><span class="badge teal">${esc(ref(id))}</span><div class="q" style="font-size:20px;line-height:1.9">${esc(text(id))}</div></a>`).join('')}</div>`;
      out.innerHTML = html || '<div class="empty">لا نتائج</div>';
    }
  });
}

// ---------------- reader ----------------
function verseHTML(id, bms, cards) {
  const { a } = sa(id); const { body } = splitBasmala(id); const st = S.showStatus ? statusOf(id) : 'new';
  const end = `<span class="endm">﴿${ar(a)}﴾</span>${isSajda(id) ? '<span class="sajda"> ۩</span>' : ''}${bms.has(id) ? '<span class="bm-dot"></span>' : ''}`;
  if (cards) return `<div class="vc" data-id="${id}"><div class="vc-top"><span class="badge teal">${esc(ref(id))}</span>${st !== 'new' ? `<span class="badge ${STATUS[st].cls}">${STATUS[st].ar}</span>` : ''}<span class="sp"></span><button class="iconbtn" data-play="${id}" aria-label="استمع">${ic.play}</button></div><div class="q v" data-id="${id}">${esc(body)} ${end}</div></div>`;
  return `<span class="v st-${st}" data-id="${id}">${esc(body)} ${end}</span> `;
}
async function renderRange(v, from, to, target, title, sub, backTo) {
  const bms = new Set((await db.all('bookmarks')).map(b => b.id)); await loadVerses();
  const cards = S.readMode === 'cards';
  setTop(title, { sub, back: backTo, actions: `<button class="iconbtn" id="rPlay" aria-label="استمع">${ic.play}</button><button class="iconbtn" id="rType" aria-label="الخط">${ic.type}</button><button class="iconbtn" id="rSearch" aria-label="بحث">${ic.search}</button>` });
  let html = '', open = false; let lastJ = 0, lastH = 0;
  const closeP = () => { if (open && !cards) html += '</div>'; open = false; };
  const openP = () => { if (!open) { html += cards ? '' : '<div class="mushaf q">'; open = true; } };
  for (let id = from; id <= to; id++) {
    const { s, a } = sa(id);
    if (a === 1) {
      closeP(); const st = surah(s); const sb = splitBasmala(id);
      html += `<div class="surah-head"><div class="nm">سورة ${st.ar}</div><div class="mt">${st.type} · ${ar(st.ayas)} آية · ترتيب النزول ${ar(st.ord)}</div></div>`;
      if (sb.basmala) html += `<div class="basmala q">${esc(sb.basmala)}</div>`;
    }
    const j = juzOf(id), h = hizbOf(id);
    if (Q.pageStart.includes(id) && id !== from) { closeP(); html += `<div class="marker">صفحة ${ar(pageOf(id))}${j !== lastJ ? ` · الجزء ${ar(j)}` : ''}${h !== lastH ? ` · الحزب ${ar(h)}` : ''}</div>`; }
    lastJ = j; lastH = h;
    openP(); html += verseHTML(id, bms, cards);
  }
  closeP();
  v.innerHTML = `<div class="${cards ? 'vlist' : ''}" id="reader">${html}</div><p class="tiny muted" style="text-align:center;margin-top:20px">${SRC_Q} — نص منقول حرفيًا من مشروع تنزيل · tanzil.net</p>`;
  const R = $('#reader', v);
  R.addEventListener('click', e => {
    const p = e.target.closest('[data-play]'); if (p) { e.stopPropagation(); const id = +p.dataset.play; player.start(range(id, to), { reciter: S.reciter, rate: S.rate, basmala: S.basmala }); return; }
    const el = e.target.closest('[data-id]'); if (el) verseSheet(+el.dataset.id, to, () => renderRange(v, from, to, +el.dataset.id, title, sub, backTo));
  });
  $('#rPlay').onclick = () => player.start(range(target || from, to), { reciter: S.reciter, rate: S.rate, basmala: S.basmala, gap: S.gap });
  $('#rSearch').onclick = openSearch;
  $('#rType').onclick = () => typeSheet(() => renderRange(v, from, to, firstVisible || target, title, sub, backTo));
  // highlight while playing
  const onVerse = () => { $$('.v.hl,.vc.hl', R).forEach(x => x.classList.remove('hl')); const el = R.querySelector(`${cards ? '.vc' : '.v'}[data-id="${player.current}"]`); if (el) { el.classList.add('hl'); if (!document.hidden) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
  player.addEventListener('verse', onVerse); if (player.active) onVerse();
  // remember position
  let firstVisible = null, saveT;
  const io = new IntersectionObserver(ents => {
    const vis = ents.filter(e => e.isIntersecting).map(e => +e.target.dataset.id); if (!vis.length) return;
    firstVisible = Math.min(...vis); clearTimeout(saveT); saveT = setTimeout(() => kvSet('lastRead', { id: firstVisible, at: Date.now() }), 700);
  }, { rootMargin: '-90px 0px -60% 0px' });
  $$(cards ? '.vc' : '.v', R).forEach(x => io.observe(x));
  if (target) requestAnimationFrame(() => { const el = R.querySelector(`[data-id="${target}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('sel'); setTimeout(() => el.classList.remove('sel'), 2200); } });
  else kvSet('lastRead', { id: from, at: Date.now() });
  return () => { io.disconnect(); player.removeEventListener('verse', onVerse); };
}
export const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
route('read', (v, [s = 1, a]) => { s = Math.min(114, Math.max(1, +s || 1)); const st = surah(s); const from = st.start, to = st.start + st.ayas - 1; const t = a ? vid(s, Math.min(+a, st.ayas)) : null; return renderRange(v, from, to, t, `سورة ${st.ar}`, `الجزء ${ar(juzOf(from))} · ${st.type} · ${ar(st.ayas)} آية`, 'mushaf'); });
route('juz', (v, [j = 1]) => { const [f, t] = juzRange(+j); return renderRange(v, f, t, null, `الجزء ${ar(j)}`, `من ${ref(f)} إلى ${ref(t)}`, 'mushaf-juz'); });
route('hizb', (v, [h = 1]) => { const [f, t] = hizbRange(+h); return renderRange(v, f, t, null, `الحزب ${ar(h)}`, `من ${ref(f)} إلى ${ref(t)}`, 'mushaf-hizb'); });

function typeSheet(onDone) {
  sheet(`<h3>إعدادات القراءة</h3>
  <label class="f">حجم خط المصحف</label><input type="range" min="20" max="44" step="1" value="${S.qsize}" id="qs">
  <div class="q" style="text-align:center;font-size:var(--qsize)">${esc(text(2))}</div>
  <label class="f">طريقة العرض</label><div class="seg" id="rm"><button data-m="flow" class="${S.readMode === 'flow' ? 'on' : ''}">مصحف متصل</button><button data-m="cards" class="${S.readMode === 'cards' ? 'on' : ''}">آية بآية</button></div>
  <div class="row between" style="margin-top:14px"><span>إظهار حالة الحفظ تحت الآيات</span><label class="switch"><input type="checkbox" id="ss" ${S.showStatus ? 'checked' : ''}><i></i></label></div>
  <button class="btn pri block" data-close style="margin-top:16px">تم</button>`, (sh) => {
    $('#qs', sh).oninput = e => saveSettings({ qsize: +e.target.value });
    $$('#rm button', sh).forEach(b => b.onclick = () => { $$('#rm button', sh).forEach(x => x.classList.toggle('on', x === b)); saveSettings({ readMode: b.dataset.m }); });
    $('#ss', sh).onchange = e => saveSettings({ showStatus: e.target.checked });
    sh.querySelector('[data-close]').addEventListener('click', onDone);
  });
}
export function verseSheet(id, rangeEnd, onChange) {
  const { s, a } = sa(id); const st = statusOf(id);
  sheet(`<div class="row between"><h3>سورة ${esc(ref(id))}</h3><span class="tiny muted">الجزء ${ar(juzOf(id))} · الحزب ${ar(hizbOf(id))} · ص ${ar(pageOf(id))}</span></div>
  <div class="q" style="font-size:calc(var(--qsize)*.85);line-height:2">${esc(text(id))}</div>${SRC_Q}
  <div class="acts">
    <button data-a="play">${ic.play}استمع من هنا</button><button data-a="rep">${ic.repeat}كرر الآية</button>
    <button data-a="mem">${ic.brain}احفظها</button><button data-a="rec">${ic.mic}سجّل تلاوتك</button>
    <button data-a="bm">${ic.bookmark}علامة</button><button data-a="copy">${ic.copy}نسخ</button>
    <button data-a="tafsir" style="display:none"></button>
  </div>
  <label class="f">حالة الحفظ</label>
  <div class="status-pick">${Object.entries(STATUS).map(([k, x]) => `<button data-s="${k}" class="${st === k ? 'on' : ''}">${x.ar}</button>`).join('')}</div>`, (sh, close) => {
    sh.querySelector('.acts').onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const act = b.dataset.a;
      if (act === 'play') { player.start(range(id, rangeEnd || surah(s).start + surah(s).ayas - 1), { reciter: S.reciter, rate: S.rate, basmala: S.basmala, gap: S.gap }); close(); }
      if (act === 'rep') { player.start([id], { reciter: S.reciter, rate: S.rate, verseRepeat: 0, basmala: false }); close(); toast('تكرار مستمر — أوقفه من المشغل'); }
      if (act === 'mem') { close(); go(`memorize-${s}-${a}`); }
      if (act === 'rec') { close(); go(`record-${s}-${a}`); }
      if (act === 'bm') { const ex = await db.get('bookmarks', id); if (ex) { await db.del('bookmarks', id); toast('أزيلت العلامة'); } else { await db.put('bookmarks', { id, at: Date.now() }); toast('حُفظت العلامة'); } close(); onChange?.(); }
      if (act === 'copy') { try { await navigator.clipboard.writeText(`${text(id)} [سورة ${ref(id)}]`); toast('نُسخت الآية بنصها الموثّق'); } catch (e) { toast('تعذّر النسخ'); } }
    };
    $$('.status-pick button', sh).forEach(b => b.onclick = async () => { await setStatus(id, b.dataset.s); $$('.status-pick button', sh).forEach(x => x.classList.toggle('on', x === b)); onChange?.(); });
  });
}

route('bookmarks', async (v) => {
  setTop('العلامات وسجل القراءة', { back: 'mushaf' });
  const bms = (await db.all('bookmarks')).sort((a, b) => b.at - a.at);
  v.innerHTML = bms.length ? `<div class="list">${bms.map(b => `<a class="li" href="#read-${sa(b.id).s}-${sa(b.id).a}" style="display:block"><div class="row between"><span class="badge gold">${esc(ref(b.id))}</span><span class="tiny muted">${new Date(b.at).toLocaleDateString('ar-EG')}</span></div><div class="q" style="font-size:20px;line-height:1.9">${esc(text(b.id))}</div></a>`).join('')}</div>`
    : `<div class="empty">${ic.bookmark}<div>لا توجد علامات بعد.<br>اضغط على أي آية في المصحف ثم «علامة».</div></div>`;
});

// ---------------- boot ----------------
async function boot() {
  shell();
  $('#view').innerHTML = '<div class="empty">جارٍ تحميل المصحف…</div>';
  await initStorage();
  await Promise.all([loadQuran(), loadState()]);
  initPlayer(); miniPlayer();
  await loadVerses();
  addEventListener('hashchange', router); router();
  addEventListener('pagehide', flushDays); document.addEventListener('visibilitychange', () => { if (document.hidden) flushDays(); });
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  requestPersist();
  if (!storageOK) toast('التخزين غير متاح في هذا المتصفح — لن يُحفظ التقدم. افتح التطبيق من رابطه أو من الشاشة الرئيسية.', 6000);
}
boot();
