import { db, kvGet, kvSet, bumpDay, today, getDay } from './db.js';
import { Q, surah, sa, vid, text, verseBody, splitBasmala, ar, ref, juzOf } from './quran.js';
import { player, RECITERS, reciter, downloadRange, offlineBlob } from './audio.js';
import { loadVerses, statusOf, setStatus, STATUS, review, dueList, weakVerses, counts, retention, DEFAULT_SRS } from './srs.js';
import { S, PLAN, saveSettings, route, go, routes } from './state.js';
import { esc, $, $$, ic, toast, sheet, ask, setTop, SRC_Q, SRC_MINE, surahOptions, ayahOptions, clock, fmtDur, chips, bindChips } from './ui.js';
import { range } from './app.js';

const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const reciterSelect = (cur, id = 'rec') => `<select class="input" id="${id}">${RECITERS.map(r => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${r.ar}</option>`).join('')}</select>`;
function rangePicker(root, s, a1, a2, onChange) {
  root.innerHTML = `<label class="f">السورة</label><select class="input" data-r="s">${surahOptions(s)}</select>
  <div class="grid2"><div><label class="f">من الآية</label><select class="input" data-r="a1">${ayahOptions(s, a1)}</select></div><div><label class="f">إلى الآية</label><select class="input" data-r="a2">${ayahOptions(s, a2)}</select></div></div>`;
  const g = k => root.querySelector(`[data-r="${k}"]`);
  const val = () => ({ s: +g('s').value, a1: +g('a1').value, a2: Math.max(+g('a1').value, +g('a2').value) });
  g('s').onchange = () => { const n = +g('s').value; g('a1').innerHTML = ayahOptions(n, 1); g('a2').innerHTML = ayahOptions(n, surah(n).ayas); onChange?.(val()); };
  g('a1').onchange = () => { if (+g('a2').value < +g('a1').value) g('a2').value = g('a1').value; onChange?.(val()); };
  g('a2').onchange = () => onChange?.(val());
  return val;
}

// ---------------- LISTEN ----------------
route('listen', async (v, [mode]) => {
  setTop('الاستماع والتكرار', { sub: 'تلاوات حقيقية موثّقة — آية بآية' });
  const L = { ...{ s: 1, a1: 1, a2: 7, vRep: 1, rRep: 1, autoNext: true }, ...(await kvGet('listenCfg', {})) };
  if (mode === 'resume') { const last = await kvGet('lastListen'); if (last) { const p = sa(last.id); L.s = p.s; L.a1 = sa(last.q[0]).a; L.a2 = sa(last.q[1]).a; L.resumeAt = last.id; } }
  const r = reciter(S.reciter);
  v.innerHTML = `
  <div class="card player-card">
    <div class="tiny muted">${esc(r.ar)} · <span id="srcLbl">${esc(r.src[0].label)}</span></div>
    <div class="now" id="now">—</div>
    <div class="q" id="nowText" style="font-size:calc(var(--qsize)*.8);line-height:2;min-height:60px"></div>
    <div class="scrub"><i id="scrub"></i></div>
    <div class="rep-ind" id="repInd"></div>
    <div class="ctrls"><button class="sm" id="pPrev" aria-label="السابق">${ic.prev}</button><button class="big" id="pPlay" aria-label="تشغيل">${ic.play}</button><button class="sm" id="pNext" aria-label="التالي">${ic.next}</button></div>
    <button class="btn ghost sm" id="pStop">${ic.stop} إيقاف</button>
  </div>
  <div class="h2">القارئ</div>
  <div class="list" id="recList">${RECITERS.map(x => `<div class="li" data-r="${x.id}"><div class="num">${x.id === S.reciter ? ic.check : ''}</div><div class="t"><b>${x.ar}</b><span>${x.en} · ${x.style}</span></div></div>`).join('')}</div>
  <div class="h2">ماذا تريد أن تسمع؟</div>
  <div class="card"><div id="rp"></div>
    <label class="f">تكرار كل آية</label>${chips('vrep', [[1, 'مرة'], [2, '٢'], [3, '٣'], [5, '٥'], [10, '١٠'], [20, '٢٠'], [0, '∞']], L.vRep)}
    <label class="f">تكرار المقطع كاملًا</label>${chips('rrep', [[1, 'مرة'], [2, '٢'], [3, '٣'], [5, '٥'], [0, '∞']], L.rRep)}
    <label class="f">السرعة</label>${chips('rate', [[0.75, '٠٫٧٥×'], [1, '١×'], [1.25, '١٫٢٥×'], [1.5, '١٫٥×']], S.rate)}
    <label class="f">فاصل بين التكرارات</label>${chips('gap', [[0, 'بدون'], [1, '١ ث'], [2, '٢ ث'], [3, '٣ ث']], S.gap)}
    <div class="row between" style="margin-top:12px"><span>الانتقال تلقائيًا للآية التالية</span><label class="switch"><input type="checkbox" id="auto" ${L.autoNext ? 'checked' : ''}><i></i></label></div>
    <div class="row between" style="margin-top:10px"><span>البسملة قبل أول السورة</span><label class="switch"><input type="checkbox" id="bas" ${S.basmala ? 'checked' : ''}><i></i></label></div>
    <div class="grid2" style="margin-top:14px"><button class="btn pri" id="go">${ic.play}تشغيل المقطع</button><button class="btn soft" id="whole">${ic.repeat}السورة كاملة</button></div>
  </div>
  <div class="h2">الاستماع دون إنترنت</div>
  <div class="card"><p class="small muted" style="margin-top:0">نزّل آيات السورة المحددة بصوت القارئ المختار لتعمل دون اتصال. تُحفظ على جهازك فقط للاستماع الشخصي، وتبقى حقوق التلاوات لأصحابها وناشريها.</p>
    <button class="btn block" id="dl">${ic.down}تنزيل السورة المحددة</button><div class="progress" style="margin-top:10px;display:none" id="dlp"><i></i></div><div class="tiny muted" id="dlt"></div></div>
  <p class="tiny muted" style="margin-top:14px">مصادر الصوت: EveryAyah.com و Islamic Network CDN (alquran.cloud) — تسجيلات أصلية للقرّاء، دون أي صوت مُولَّد. على iPhone: يستمر التشغيل عند قفل الشاشة إذا ثُبِّت التطبيق على الشاشة الرئيسية، وقد يتوقف أثناء المكالمات؛ اضغط تشغيل للمتابعة.</p>`;
  const getR = rangePicker($('#rp', v), L.s, L.a1, L.a2, x => { Object.assign(L, x); kvSet('listenCfg', L); });
  bindChips(v, 'vrep', x => { L.vRep = +x; kvSet('listenCfg', L); if (player.active) player.vRep = +x; });
  bindChips(v, 'rrep', x => { L.rRep = +x; kvSet('listenCfg', L); if (player.active) player.rRep = +x; });
  bindChips(v, 'rate', x => { saveSettings({ rate: +x }); player.setRate(+x); });
  bindChips(v, 'gap', x => { saveSettings({ gap: +x }); player.gap = +x; });
  $('#auto', v).onchange = e => { L.autoNext = e.target.checked; player.autoNext = L.autoNext; kvSet('listenCfg', L); };
  $('#bas', v).onchange = e => { saveSettings({ basmala: e.target.checked }); player.basmala = e.target.checked; };
  $('#recList', v).onclick = e => { const li = e.target.closest('[data-r]'); if (!li) return; saveSettings({ reciter: li.dataset.r }); if (player.active) player.setReciter(li.dataset.r); routes.listen(v, []); };
  const startQ = (whole) => {
    const x = getR(); const st = surah(x.s);
    const ids = whole ? range(st.start, st.start + st.ayas - 1) : range(vid(x.s, x.a1), vid(x.s, x.a2));
    player.start(ids, { reciter: S.reciter, rate: S.rate, verseRepeat: L.vRep, rangeRepeat: whole ? (L.rRep || 1) : L.rRep, autoNext: L.autoNext, basmala: S.basmala, gap: S.gap, startAt: L.resumeAt });
    L.resumeAt = null;
  };
  $('#go', v).onclick = () => startQ(false); $('#whole', v).onclick = () => startQ(true);
  $('#pPlay', v).onclick = () => player.active ? player.toggle() : startQ(false);
  $('#pNext', v).onclick = () => player.next(); $('#pPrev', v).onclick = () => player.prev(); $('#pStop', v).onclick = () => player.stop();
  let ac; $('#dl', v).onclick = async () => {
    if (ac) { ac.abort(); return; }
    const x = getR(); const st = surah(x.s); ac = new AbortController();
    $('#dlp', v).style.display = 'block'; $('#dl', v).innerHTML = `${ic.x}إيقاف التنزيل`;
    const res = await downloadRange(S.reciter, st.start, st.start + st.ayas - 1, (i, n, ok, fail) => { $('#dlp i', v).style.width = (100 * i / n) + '%'; $('#dlt', v).textContent = `${ar(i)} / ${ar(n)}${fail ? ` · تعذّر ${ar(fail)}` : ''}`; }, ac.signal);
    if (st.n !== 1 && st.n !== 9) await downloadRange(S.reciter, 1, 1); // basmala
    ac = null; $('#dl', v).innerHTML = `${ic.down}تنزيل السورة المحددة`;
    toast(res.fail ? `اكتمل جزئيًا: تعذّر تنزيل ${ar(res.fail)} آية (قد لا يسمح المصدر بالتنزيل).` : `تم تنزيل سورة ${st.ar} للاستماع دون إنترنت`, 4000);
  };
  const upd = () => {
    $('#pPlay', v).innerHTML = player.playing ? ic.pause : ic.play;
    const id = player.current; if (!id) return;
    $('#now', v).textContent = player.inBasmala ? 'البسملة' : `سورة ${ref(id)}`;
    $('#nowText', v).textContent = player.inBasmala ? Q.basmala : verseBody(id);
    $('#srcLbl', v).textContent = player.sourceLabel || '';
    $('#repInd', v).textContent = (player.vRep !== 1 ? `تكرار الآية: ${ar(player.vCount + 1)} / ${player.vRep ? ar(player.vRep) : '∞'}` : '') + (player.rRep !== 1 ? ` · المقطع: ${ar(player.rCount + 1)} / ${player.rRep ? ar(player.rRep) : '∞'}` : '');
  };
  const tm = () => { const d = player.el.duration; $('#scrub', v).style.width = d ? (100 * player.el.currentTime / d) + '%' : 0; };
  ['state', 'verse', 'repeat'].forEach(e => player.addEventListener(e, upd)); player.addEventListener('time', tm); upd();
  return () => { ['state', 'verse', 'repeat'].forEach(e => player.removeEventListener(e, upd)); player.removeEventListener('time', tm); };
});

// ---------------- HIFZ hub ----------------
route('hifz', async (v) => {
  setTop('الحفظ والمراجعة', {});
  const [c, due, ret, day] = await Promise.all([counts(), dueList(), retention(), getDay()]);
  const lastMem = await kvGet('memCfg');
  v.innerHTML = `
  <div class="grid2"><div class="kpi"><b>${ar(c.memorized + c.revise)}</b><span>آية محفوظة</span></div><div class="kpi"><b>${ar(c.learning)}</b><span>قيد الحفظ</span></div><div class="kpi"><b>${ar(due.length)}</b><span>مستحقة للمراجعة</span></div><div class="kpi"><b>${ret == null ? '—' : ar(ret) + '٪'}</b><span>نسبة التثبيت (٣٠ يومًا)</span></div></div>
  <div class="card" style="margin-top:12px"><div class="row between"><b>هدف اليوم</b><span class="small muted">${ar(day.newMem || 0)} / ${ar(PLAN.newPerDay)} آيات</span></div><div class="progress" style="margin-top:8px"><i style="width:${Math.min(100, 100 * (day.newMem || 0) / PLAN.newPerDay)}%"></i></div></div>
  <div class="grid2" style="margin-top:12px"><a class="btn pri" href="#memorize">${ic.brain}حفظ جديد</a><a class="btn soft" href="#revision">${ic.repeat}المراجعة (${ar(due.length)})</a></div>
  ${lastMem ? `<a class="card row" style="text-decoration:none;color:inherit;margin-top:12px" href="#memorize-${lastMem.s}-${lastMem.a1}-${lastMem.a2}"><div class="grow"><div class="tiny muted">آخر جلسة حفظ</div><b>سورة ${esc(surah(lastMem.s).ar)} ${ar(lastMem.a1)}–${ar(lastMem.a2)}</b></div><span class="btn sm soft">تابع</span></a>` : ''}
  <div class="h2">طريقة الحفظ المقترحة</div>
  <div class="card small"><ol style="margin:0;padding-inline-start:20px;line-height:2">
  <li>استمع للآية مكررة مع متابعة النص بعينك.</li><li>اقرأها بصوتك مع التلاوة، ثم وحدك.</li><li>أخفِ النص وسمّع من حفظك، ثم اكشف وتحقق.</li><li>اربط الآية بما قبلها قبل الانتقال.</li><li>ضع «محفوظة» حين تتقنها، وستظهر لك في المراجعة في موعدها.</li></ol></div>`;
});

// ---------------- MEMORIZE ----------------
route('memorize', async (v, [ps, pa1, pa2]) => {
  setTop('نظام الحفظ', { back: 'hifz' });
  await loadVerses();
  const cfg = { s: 67, a1: 1, a2: 5, rep: 5, ...(await kvGet('memCfg', {})) };
  if (ps) { cfg.s = +ps; cfg.a1 = +pa1 || 1; cfg.a2 = +pa2 || Math.min(surah(cfg.s).ayas, cfg.a1 + 4); }
  v.innerHTML = `<div class="card"><div id="rp"></div>
    <label class="f">عدد مرات التكرار لكل آية</label>${chips('rep', [[3, '٣'], [5, '٥'], [10, '١٠'], [20, '٢٠']], cfg.rep)}
    <label class="f">القارئ</label>${reciterSelect(S.reciter)}
    <button class="btn pri block" id="start" style="margin-top:16px">${ic.brain}ابدأ جلسة الحفظ</button></div>
    <p class="tiny muted">يُحسب وقت الجلسة ضمن «وقت الحفظ» في لوحة التقدم.</p>`;
  const getR = rangePicker($('#rp', v), cfg.s, cfg.a1, cfg.a2);
  bindChips(v, 'rep', x => cfg.rep = +x);
  $('#rec', v).onchange = e => saveSettings({ reciter: e.target.value });
  $('#start', v).onclick = () => { Object.assign(cfg, getR()); kvSet('memCfg', cfg); session(v, cfg); };
  let stop; const session = (v, cfg) => { stop = memSession(v, cfg); };
  return () => stop?.();
});
function memSession(v, cfg) {
  const ids = range(vid(cfg.s, cfg.a1), vid(cfg.s, cfg.a2)); let i = 0; let mode = 'follow'; // follow | hint | hide
  let secs = 0, running = true, acc = 0; const t0 = Date.now();
  setTop(`حفظ سورة ${surah(cfg.s).ar}`, { sub: `الآيات ${ar(cfg.a1)}–${ar(cfg.a2)}`, back: 'memorize' });
  v.innerHTML = `
  <div class="card row between"><div><div class="tiny muted">وقت الجلسة</div><div class="timer" id="tm">٠٠:٠٠</div></div><button class="btn sm" id="tp">${ic.pause}إيقاف مؤقت</button><button class="btn sm soft" id="end">إنهاء</button></div>
  <div class="dots" id="dots"></div>
  <div class="card">
    <div class="row between">${SRC_Q}<span class="badge teal" id="vr"></span></div>
    <div class="mem-verse" id="mv"><div class="q" id="mq"></div><div class="cover">${ic.eyeoff}<span>سمّع الآية من حفظك ثم اكشفها للتحقق</span></div></div>
    <div class="seg" id="modes"><button data-m="follow" class="on">${'متابعة النص'}</button><button data-m="hint">تلميح</button><button data-m="hide">إخفاء</button></div>
    <div class="ctrls"><button class="sm" id="pv" aria-label="السابقة">${ic.prev}</button><button class="big" id="pl" aria-label="تشغيل">${ic.play}</button><button class="sm" id="nx" aria-label="التالية">${ic.next}</button></div>
    <div class="rep-ind" style="text-align:center" id="ri"></div>
    <div class="grid2" style="margin-top:10px"><button class="btn soft" id="rv">${ic.eye}اكشف النص</button><button class="btn soft" id="link">${ic.repeat}ربط الآيات</button></div>
    <label class="f">حالة هذه الآية</label><div class="status-pick" id="sp">${Object.entries(STATUS).map(([k, x]) => `<button data-s="${k}">${x.ar}</button>`).join('')}</div>
  </div>
  <div class="note" style="margin-top:12px">${ic.info.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} سمّع ما حفظته على معلّم متقن ليتأكد من صحة نطقك وتجويدك.</div>`;
  const mv = $('#mv', v);
  const render = () => {
    const id = ids[i]; const words = verseBody(id).split(' ');
    $('#mq', v).innerHTML = words.map(w => `<span class="w">${esc(w)}</span>`).join(' ') + ` <span class="endm">﴿${ar(sa(id).a)}﴾</span>`;
    $('#vr', v).textContent = ref(id);
    mv.className = 'mem-verse' + (mode === 'hide' ? ' hidden' : mode === 'hint' ? ' hint' : '');
    $('#dots', v).innerHTML = ids.map((x, k) => `<i class="${k === i ? 'cur' : ['memorized', 'revise'].includes(statusOf(x)) ? 'on' : ''}"></i>`).join('');
    $$('#sp button', v).forEach(b => b.classList.toggle('on', b.dataset.s === statusOf(id)));
  };
  const play = (one = true) => {
    if (player.active && player.playing && player.q.length === 1 && player.current === ids[i]) { player.pause(); return; }
    player.start(one ? [ids[i]] : ids, { reciter: S.reciter, rate: S.rate, verseRepeat: one ? cfg.rep : 1, rangeRepeat: 1, basmala: false, ctx: 'mem', autoNext: !one || true });
    if (statusOf(ids[i]) === 'new') setStatus(ids[i], 'learning').then(render);
  };
  const ri = () => { $('#pl', v).innerHTML = player.playing ? ic.pause : ic.play; $('#ri', v).textContent = player.active && player.q.length === 1 ? `التكرار ${ar(Math.min(player.vCount + 1, cfg.rep))} من ${ar(cfg.rep)}` : player.active ? `ربط الآيات: ${ref(player.current)}` : `سيُكرر كل آية ${ar(cfg.rep)} مرات`; };
  const onDone = () => { if (player.q.length === 1 && mode === 'follow') toast('أحسنت. جرّب الآن «إخفاء» وسمّع من حفظك'); };
  ['state', 'repeat', 'verse'].forEach(e => player.addEventListener(e, ri)); player.addEventListener('done', onDone);
  $('#pl', v).onclick = () => play(true);
  $('#link', v).onclick = () => play(false);
  $('#nx', v).onclick = () => { if (i < ids.length - 1) { i++; player.stop(); render(); ri(); } else toast('هذه آخر آية في المقطع — اضغط «ربط الآيات» للمراجعة'); };
  $('#pv', v).onclick = () => { if (i > 0) { i--; player.stop(); render(); ri(); } };
  $('#rv', v).onclick = () => { mv.classList.remove('hidden', 'hint'); setTimeout(() => { if (mode !== 'follow') mv.classList.add(mode === 'hide' ? 'hidden' : 'hint'); }, 6000); };
  $$('#modes button', v).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#modes button', v).forEach(x => x.classList.toggle('on', x === b)); render(); });
  $$('#sp button', v).forEach(b => b.onclick = async () => { await setStatus(ids[i], b.dataset.s); render(); if (b.dataset.s === 'memorized') toast(`بارك الله فيك — ستظهر الآية في المراجعة غدًا`); });
  $('#tp', v).onclick = () => { running = !running; $('#tp', v).innerHTML = running ? `${ic.pause}إيقاف مؤقت` : `${ic.play}استئناف`; };
  const tick = setInterval(() => { if (!running || document.hidden) return; secs++; acc++; $('#tm', v).textContent = clock(secs); if (acc >= 10) { bumpDay('memSec', acc); acc = 0; } }, 1000);
  $('#end', v).onclick = async () => {
    if (acc) bumpDay('memSec', acc); acc = 0; player.stop();
    const mem = ids.filter(x => statusOf(x) === 'memorized').length;
    sheet(`<h3>انتهت الجلسة</h3><p>المدة: <b>${clock(secs)}</b><br>محفوظ في هذا المقطع: <b>${ar(mem)} / ${ar(ids.length)}</b></p><p class="small muted">«خيركم من تعلّم القرآن وعلّمه» — تقبّل الله منك.</p><a class="btn pri block" href="#hifz" data-close>العودة</a>`);
  };
  render(); ri();
  return () => { clearInterval(tick); if (acc) bumpDay('memSec', acc); ['state', 'repeat', 'verse'].forEach(e => player.removeEventListener(e, ri)); player.removeEventListener('done', onDone); };
}

// ---------------- REVISION ----------------
route('revision', async (v, [mode, sArg]) => {
  setTop('المراجعة الذكية', { back: 'hifz', actions: `<button class="iconbtn" id="srsCfg" aria-label="إعدادات الجدول">${ic.gear}</button>` });
  $('#srsCfg').onclick = srsSheet;
  await loadVerses();
  let queue;
  if (mode === 'surah') { const st = surah(+sArg); queue = range(st.start, st.start + st.ayas - 1).filter(id => ['memorized', 'revise'].includes(statusOf(id))).map(id => ({ id })); }
  else if (mode === 'weak') queue = await weakVerses(20);
  else queue = await dueList();
  if (mode === 'start' || mode === 'surah' || mode === 'weak') return revSession(v, queue.map(q => q.id));
  const [weak, ret, day] = await Promise.all([weakVerses(8), retention(), getDay()]);
  const memSurahs = Q.surahs.filter(st => { for (let k = 0; k < st.ayas; k++) if (['memorized', 'revise'].includes(statusOf(st.start + k))) return true; return false; });
  const groups = {}; queue.forEach(q => { const s = sa(q.id).s; (groups[s] ||= []).push(q.id); });
  v.innerHTML = `
  <div class="card"><div class="row between"><div><b style="font-size:20px">${ar(queue.length)} آية</b><div class="tiny muted">مستحقة اليوم · أُنجز ${ar(day.revDone || 0)}</div></div><div style="text-align:left"><b>${ret == null ? '—' : ar(ret) + '٪'}</b><div class="tiny muted">التثبيت</div></div></div>
    ${queue.length ? `<button class="btn pri block" style="margin-top:12px" id="startRev">${ic.repeat}ابدأ مراجعة اليوم</button>` : `<div class="empty" style="padding:14px 0 4px">لا مراجعات مستحقة الآن. ${memSurahs.length ? 'يمكنك مراجعة سورة بنفسك من الأسفل.' : 'احفظ آيات جديدة لتبدأ جدول المراجعة.'}</div>`}</div>
  ${Object.keys(groups).length ? `<div class="h2">المستحق حسب السورة</div><div class="list">${Object.entries(groups).map(([s, arr]) => `<div class="li"><div class="num">${ar(s)}</div><div class="t"><b>${surah(+s).ar}</b><span>${arr.slice(0, 12).map(id => ar(sa(id).a)).join('، ')}${arr.length > 12 ? '…' : ''}</span></div><span class="badge">${ar(arr.length)}</span></div>`).join('')}</div>` : ''}
  ${weak.length ? `<div class="h2">آيات أنساها كثيرًا <small><a href="#revision-weak">راجعها الآن</a></small></div><div class="list">${weak.map(w => `<a class="li" href="#read-${sa(w.id).s}-${sa(w.id).a}"><div class="t"><b>${esc(ref(w.id))}</b><span>نسيان ${ar(w.lapses || 0)} · صعوبة ${ar(w.hard || 0)}</span></div><span class="badge ${STATUS[w.status]?.cls || ''}">${STATUS[w.status]?.ar || ''}</span></a>`).join('')}</div>` : ''}
  ${memSurahs.length ? `<div class="h2">مراجعة سورة محددة</div><div class="chips">${memSurahs.map(st => `<a class="chip" href="#revision-surah-${st.n}">${st.ar}</a>`).join('')}</div>` : ''}
  <p class="tiny muted" style="margin-top:16px">يعتمد الجدول على مبدأ التكرار المتباعد: كل مراجعة ناجحة تُبعد الموعد التالي، والآية المنسية تعود غدًا وتُقدَّم في الأولوية. عدّل الجدول من زر الإعدادات أعلاه.</p>`;
  $('#startRev', v)?.addEventListener('click', () => go('revision-start'));
});
function revSession(v, ids) {
  if (!ids.length) { v.innerHTML = '<div class="empty">لا توجد آيات في هذه المراجعة.</div>'; return; }
  let i = 0, secs = 0, acc = 0; const res = { easy: 0, hard: 0, forgot: 0 };
  v.innerHTML = `<div class="row between"><div class="timer" id="tm">٠٠:٠٠</div><span class="muted small" id="cnt"></span></div><div class="progress" style="margin:8px 0 12px"><i id="pg"></i></div>
  <div class="card"><div class="row between">${SRC_Q}<span class="badge teal" id="vr"></span></div>
  <div class="tiny muted" id="prevHint" style="margin-top:8px"></div>
  <div class="mem-verse hidden" id="mv"><div class="q" id="mq"></div><div class="cover">${ic.eyeoff}<span>سمّع الآية من حفظك</span></div></div>
  <div class="grid2"><button class="btn soft" id="rv">${ic.eye}اكشف</button><button class="btn soft" id="pl">${ic.play}استمع</button></div>
  <label class="f">كيف كان تسميعك؟</label>
  <div class="rate"><button class="e" data-r="easy">سهلة<small>متقنة</small></button><button class="d" data-r="hard">صعبة<small>بتردد</small></button><button class="f" data-r="forgot">نسيتها<small>تعود غدًا</small></button></div></div>`;
  const mv = $('#mv', v);
  const render = () => {
    const id = ids[i]; const { s, a } = sa(id);
    $('#mq', v).textContent = verseBody(id); $('#vr', v).textContent = ref(id);
    $('#prevHint', v).textContent = a > 1 ? `ما قبلها: ${verseBody(id - 1).split(' ').slice(-4).join(' ')} …` : `بداية سورة ${surah(s).ar}`;
    mv.classList.add('hidden'); $('#cnt', v).textContent = `${ar(i + 1)} / ${ar(ids.length)}`; $('#pg', v).style.width = (100 * i / ids.length) + '%';
  };
  $('#rv', v).onclick = () => mv.classList.toggle('hidden');
  $('#pl', v).onclick = () => player.start([ids[i]], { reciter: S.reciter, rate: S.rate, basmala: false, ctx: 'rev' });
  $$('.rate button', v).forEach(b => b.onclick = async () => {
    await review(ids[i], b.dataset.r); res[b.dataset.r]++; player.stop();
    if (i < ids.length - 1) { i++; render(); } else finish();
  });
  const tick = setInterval(() => { if (document.hidden) return; secs++; acc++; $('#tm', v).textContent = clock(secs); if (acc >= 10) { bumpDay('revSec', acc); acc = 0; } }, 1000);
  function finish() {
    clearInterval(tick); if (acc) bumpDay('revSec', acc); acc = 0;
    v.innerHTML = `<div class="card" style="text-align:center"><h3 class="sname" style="font-size:24px;margin:6px 0">أتممت المراجعة</h3><p class="muted">المدة ${clock(secs)}</p>
    <div class="grid3"><div class="kpi"><b style="color:var(--ok)">${ar(res.easy)}</b><span>سهلة</span></div><div class="kpi"><b style="color:var(--warn)">${ar(res.hard)}</b><span>صعبة</span></div><div class="kpi"><b style="color:var(--bad)">${ar(res.forgot)}</b><span>منسية</span></div></div>
    <p class="small muted">${res.forgot ? 'الآيات المنسية ستعود غدًا بأولوية أعلى — لا بأس، فالتكرار طريق الإتقان.' : 'ما شاء الله، ثبّتك الله.'}</p><a class="btn pri block" href="#revision">تم</a></div>`;
  }
  render();
  return () => { clearInterval(tick); if (acc) bumpDay('revSec', acc); };
}
async function srsSheet() {
  const c = { ...DEFAULT_SRS, ...(await kvGet('srs', {})) };
  sheet(`<h3>تخصيص جدول المراجعة</h3>
  <label class="f">سرعة تباعد المواعيد: <b id="scV">${ar(c.scale)}×</b></label><input type="range" id="sc" min="0.5" max="2" step="0.1" value="${c.scale}"><div class="tiny muted">أقل من ١: مراجعة أكثر تكرارًا · أكثر من ١: مواعيد أبعد</div>
  <div class="grid2"><div><label class="f">أول مراجعة بعد (أيام)</label><input class="input" type="number" id="fg" min="1" max="7" value="${c.firstGap}"></div><div><label class="f">الثانية بعد (أيام)</label><input class="input" type="number" id="sg" min="1" max="14" value="${c.secondGap}"></div></div>
  <div class="grid2"><div><label class="f">أقصى فاصل (أيام)</label><input class="input" type="number" id="mi" min="7" max="365" value="${c.maxInterval}"></div><div><label class="f">حد المراجعات يوميًا</label><input class="input" type="number" id="dc" min="5" max="500" value="${c.dailyCap}"></div></div>
  <button class="btn pri block" id="sv" style="margin-top:16px">حفظ</button>`, (sh, close) => {
    $('#sc', sh).oninput = e => $('#scV', sh).textContent = ar(e.target.value) + '×';
    $('#sv', sh).onclick = async () => { await kvSet('srs', { scale: +$('#sc', sh).value, firstGap: +$('#fg', sh).value || 1, secondGap: +$('#sg', sh).value || 3, maxInterval: +$('#mi', sh).value || 120, dailyCap: +$('#dc', sh).value || 60 }); close(); toast('حُفظ الجدول'); };
  });
}

// ---------------- RECORD ----------------
route('record', async (v, [ps, pa1, pa2]) => {
  setTop('تسجيل تلاوتي', { sub: 'محفوظة على جهازك فقط', back: 'more' });
  const cfg = { s: 1, a1: 1, a2: 7, ...(await kvGet('recCfg', {})) };
  if (ps) { cfg.s = +ps; cfg.a1 = +pa1 || 1; cfg.a2 = +pa2 || cfg.a1; }
  const recs = (await db.all('recs')).sort((a, b) => b.at - a.at);
  const groups = {}; recs.forEach(r => { const k = `${r.s}-${r.a1}-${r.a2}`; (groups[k] ||= []).push(r); });
  const supported = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  v.innerHTML = `
  <div class="card"><div id="rp"></div>
    ${supported ? `<div style="text-align:center;margin-top:12px"><div class="timer" id="rt">٠٠:٠٠</div><div class="wave" id="wv">${'<i></i>'.repeat(32)}</div><button class="rec-btn" id="rb" aria-label="تسجيل">${ic.mic}</button><div class="tiny muted" id="rs">اضغط لبدء التسجيل</div></div>
    <div class="row" style="justify-content:center"><button class="btn sm soft" id="ref">${ic.play}استمع للقارئ أولًا</button></div>`
    : `<div class="note" style="margin-top:12px">التسجيل غير متاح هنا. على iPhone افتح التطبيق من Safari أو من الشاشة الرئيسية واسمح بالوصول إلى الميكروفون.</div>`}
  </div>
  <div class="note info" style="margin-top:12px">لا يقيّم التطبيق نطقك أو تجويدك آليًا؛ فلا توجد حاليًا أداة موثّقة تقوم بذلك بدقة. قارن تسجيلاتك بتلاوة القارئ، وقيّم نفسك، والأهم: اعرض تلاوتك على معلّم متقن.</div>
  <div class="h2">تسجيلاتي <small>${ar(recs.length)}</small></div>
  <div id="groups">${Object.keys(groups).length ? Object.entries(groups).map(([k, arr]) => groupHTML(k, arr)).join('') : `<div class="empty">${ic.mic}<div>لا تسجيلات بعد</div></div>`}</div>`;
  const getR = rangePicker($('#rp', v), cfg.s, cfg.a1, cfg.a2, x => { Object.assign(cfg, x); kvSet('recCfg', cfg); });
  bindRecordList(v, () => routes.record(v, []));
  if (!supported) return;
  $('#ref', v).onclick = () => { const x = getR(); player.start(range(vid(x.s, x.a1), vid(x.s, x.a2)), { reciter: S.reciter, rate: S.rate, basmala: false }); };
  let mr, stream, chunks = [], t0, tick, actx, raf;
  $('#rb', v).onclick = async () => {
    if (mr && mr.state === 'recording') { mr.stop(); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { toast('لم يُسمح بالوصول إلى الميكروفون — فعّله من إعدادات Safari'); return; }
    player.pause();
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
    mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      clearInterval(tick); cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); actx?.close();
      $('#rb', v).classList.remove('on'); $('#rs', v).textContent = 'اضغط لبدء التسجيل';
      const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/mp4' }); const dur = (Date.now() - t0) / 1000;
      if (dur < 1) return toast('التسجيل قصير جدًا');
      const x = getR(); afterRecord(v, { s: x.s, a1: x.a1, a2: x.a2, blob, dur });
    };
    mr.start(); t0 = Date.now(); /* no timeslice: iOS Safari corrupts timestamps when chunks are concatenated */ $('#rb', v).classList.add('on'); $('#rs', v).textContent = 'جارٍ التسجيل… اضغط للإيقاف';
    tick = setInterval(() => $('#rt', v).textContent = clock((Date.now() - t0) / 1000), 500);
    if (!IS_IOS) try { // level meter skipped on iOS: a second AudioContext can alter the mic sample rate (fast/silent recordings)
      actx = new (window.AudioContext || window.webkitAudioContext)(); const an = actx.createAnalyser(); an.fftSize = 64; actx.createMediaStreamSource(stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount); const bars = $$('#wv i', v);
      const draw = () => { an.getByteFrequencyData(data); bars.forEach((b, k) => b.style.height = (4 + (data[k % data.length] / 255) * 40) + 'px'); raf = requestAnimationFrame(draw); }; draw();
    } catch (e) {}
  };
  return () => { if (mr && mr.state === 'recording') mr.stop(); };
});
function afterRecord(v, r) {
  let rating = 0; const url = URL.createObjectURL(r.blob);
  sheet(`<h3>حفظ التسجيل</h3><p class="small muted">سورة ${esc(surah(r.s).ar)} · الآيات ${ar(r.a1)}–${ar(r.a2)} · ${clock(r.dur)}</p>
  <audio controls src="${url}" style="width:100%"></audio>
  <label class="f">تقييمك لنفسك (اختياري)</label><div class="stars" id="st">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}">★</button>`).join('')}</div>
  <label class="f">ملاحظة شخصية</label><textarea class="input" id="nt" placeholder="مثال: انتبه للقلقلة في آخر الآية، والمد المتصل"></textarea>
  <div class="grid2" style="margin-top:14px"><button class="btn bad" id="dis">حذف</button><button class="btn pri" id="sv">حفظ</button></div>`, (sh, close) => {
    $$('#st button', sh).forEach(b => b.onclick = () => { rating = +b.dataset.n; $$('#st button', sh).forEach(x => x.classList.toggle('on', +x.dataset.n <= rating)); });
    $('#dis', sh).onclick = () => { URL.revokeObjectURL(url); close(); };
    $('#sv', sh).onclick = async () => {
      const rec = { id: 'r' + Date.now(), at: Date.now(), d: today(), s: r.s, a1: r.a1, a2: r.a2, blob: r.blob, mime: r.blob.type, dur: r.dur, rating, note: $('#nt', sh).value.trim() };
      await db.put('recs', rec); bumpDay('recCount', 1); bumpDay('recSec', Math.round(r.dur)); URL.revokeObjectURL(url); close(); toast('حُفظ التسجيل على جهازك'); routes.record(v, []);
    };
  });
}
function groupHTML(k, arr) {
  const [s, a1, a2] = k.split('-').map(Number); const rated = arr.filter(r => r.rating).reverse();
  const spark = rated.length > 1 ? `<svg viewBox="0 0 100 24" class="chart" style="height:24px;width:100px">${(() => { const pts = rated.map((r, i) => `${(i / (rated.length - 1)) * 96 + 2},${22 - (r.rating - 1) * 5}`).join(' '); return `<polyline fill="none" stroke="var(--gold)" stroke-width="2" points="${pts}"/>`; })()}</svg>` : '';
  return `<div class="card" data-g="${k}"><div class="row between"><div><b class="sname">${surah(s).ar}</b> <span class="small muted">${a1 === a2 ? 'آية ' + ar(a1) : 'الآيات ' + ar(a1) + '–' + ar(a2)}</span></div>${spark}</div>
  ${arr.length > 1 ? `<button class="btn sm soft" data-cmp="${k}" style="margin:8px 0">${ic.repeat}قارن أقدم وأحدث تسجيل</button>` : ''}
  ${arr.map(r => `<div class="hr"></div><div data-rid="${r.id}"><div class="row between"><span class="small">${new Date(r.at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })} · ${clock(r.dur)}</span><span class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= r.rating ? 'on' : ''}" data-rate="${n}">★</button>`).join('')}</span></div>
    ${r.note ? `<div class="small" style="margin:4px 0">${SRC_MINE}<br>${esc(r.note)}</div>` : ''}
    <div class="row" style="margin-top:6px"><button class="btn sm soft" data-p="${r.id}">${ic.play}استمع</button><button class="btn sm ghost" data-n="${r.id}">ملاحظة</button><button class="btn sm ghost" data-ex="${r.id}">${ic.share}</button><span class="grow"></span><button class="iconbtn" data-del="${r.id}" aria-label="حذف">${ic.trash}</button></div></div>`).join('')}</div>`;
}
let recAudio;
function bindRecordList(v, refresh) {
  const box = $('#groups', v);
  const playBlob = async (id) => { const r = await db.get('recs', id); if (!r) return; player.pause(); recAudio?.pause(); recAudio = new Audio(URL.createObjectURL(r.blob)); recAudio.play().catch(() => toast('تعذّر التشغيل')); return recAudio; };
  box.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.p) playBlob(t.dataset.p);
    if (t.dataset.del) { if (await ask('حذف هذا التسجيل نهائيًا؟', 'حذف', true)) { await db.del('recs', t.dataset.del); refresh(); } }
    if (t.dataset.rate) { const id = t.closest('[data-rid]').dataset.rid; const r = await db.get('recs', id); r.rating = +t.dataset.rate; await db.put('recs', r); refresh(); }
    if (t.dataset.n) { const r = await db.get('recs', t.dataset.n); sheet(`<h3>ملاحظة شخصية</h3><textarea class="input" id="nt">${esc(r.note || '')}</textarea><button class="btn pri block" id="sv" style="margin-top:12px">حفظ</button>`, (sh, close) => { $('#sv', sh).onclick = async () => { r.note = $('#nt', sh).value.trim(); await db.put('recs', r); close(); refresh(); }; }); }
    if (t.dataset.ex) { const r = await db.get('recs', t.dataset.ex); const { saveFile } = await import('./ui.js'); saveFile(r.blob, `noor-${r.s}-${r.a1}-${r.a2}-${r.d}.${(r.mime || '').includes('webm') ? 'webm' : 'm4a'}`); }
    if (t.dataset.cmp) {
      const [s, a1, a2] = t.dataset.cmp.split('-').map(Number);
      const arr = (await db.all('recs')).filter(r => r.s === s && r.a1 === a1 && r.a2 === a2).sort((a, b) => a.at - b.at);
      const A = arr[0], B = arr[arr.length - 1];
      sheet(`<h3>مقارنة التسجيلات</h3><p class="small muted">استمع للأقدم ثم الأحدث، ثم للقارئ، ولاحظ التحسّن في المخارج والمدود والغنن.</p>
      <div class="card"><b>الأقدم</b> <span class="small muted">${new Date(A.at).toLocaleDateString('ar-EG')}</span><audio controls style="width:100%" src="${URL.createObjectURL(A.blob)}"></audio></div>
      <div class="card"><b>الأحدث</b> <span class="small muted">${new Date(B.at).toLocaleDateString('ar-EG')}</span><audio controls style="width:100%" src="${URL.createObjectURL(B.blob)}"></audio></div>
      <button class="btn soft block" id="rf" style="margin-top:10px">${ic.play}تلاوة ${esc(reciter(S.reciter).ar)}</button>`, sh => {
        $('#rf', sh).onclick = () => player.start(range(vid(s, a1), vid(s, a2)), { reciter: S.reciter, basmala: false });
      });
    }
  };
}
