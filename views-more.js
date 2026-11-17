import { db, kvGet, kvSet, today, addDays, getDay, bumpDay, setDayField, requestPersist } from './db.js';
import { Q, surah, sa, vid, text, verseBody, splitBasmala, ar, ref, juzOf, norm } from './quran.js';
import { player, RECITERS, reciter, downloadedSummary, deleteDownloads } from './audio.js';
import { loadVerses, statusOf, counts, retention, resetCache, vstate } from './srs.js';
import { S, PLAN, saveSettings, savePlan, route, go, routes } from './state.js';
import { esc, $, $$, ic, toast, sheet, ask, setTop, SRC_Q, SRC_EXP, fmtDur, saveFile, chips, bindChips } from './ui.js';
import { LESSONS } from './tajweed.js';
import { streak, checklist } from './app.js';

// ---------------- MORE ----------------
route('more', async (v) => {
  setTop('المزيد', {});
  const it = (h, t, s, i) => `<a class="li" href="#${h}"><div class="num">${i}</div><div class="t"><b>${t}</b><span>${s}</span></div>${ic.chev.replace('<svg', '<svg class="chev"')}</a>`;
  v.innerHTML = `<div class="list">
    ${it('revision', 'المراجعة الذكية', 'جدول التكرار المتباعد', ic.repeat)}
    ${it('record', 'تسجيل تلاوتي', 'سجّل، استمع، قارن', ic.mic)}
    ${it('tajweed', 'تعلم التجويد', 'ثمانية دروس مع أمثلة وتمارين', ic.octa)}
    ${it('plan', 'خطتي اليومية', 'الأهداف والتذكير', ic.plan)}
    ${it('stats', 'لوحة التقدم', 'الإحصاءات والإنجازات', ic.chart)}
    ${it('bookmarks', 'العلامات', 'الآيات المحفوظة بعلامة', ic.bookmark)}
  </div><div class="list" style="margin-top:12px">
    ${it('settings', 'الإعدادات', 'المظهر، الخط، القارئ، التنزيلات', ic.gear)}
    ${it('backup', 'النسخ الاحتياطي والتصدير', 'احفظ تقدمك واستعده', ic.shield)}
    ${it('about', 'المصادر وحول التطبيق', 'Tanzil، مصادر الصوت، التراخيص', ic.info)}
  </div>`;
});

// ---------------- TAJWEED ----------------
route('tajweed', async (v) => {
  setTop('تعلم التجويد', { sub: 'رواية حفص عن عاصم', back: 'more' });
  const prog = await kvGet('tajweed', {});
  const done = LESSONS.filter(l => prog[l.id]?.done).length;
  v.innerHTML = `<div class="card"><div class="row between"><b>تقدمك</b><span class="small muted">${ar(done)} / ${ar(LESSONS.length)} دروس</span></div><div class="progress" style="margin-top:8px"><i style="width:${100 * done / LESSONS.length}%"></i></div></div>
  <div class="list" style="margin-top:12px">${LESSONS.map((l, i) => `<a class="li" href="#lesson-${l.id}"><div class="num">${prog[l.id]?.done ? ic.check : ar(i + 1)}</div><div class="t"><b>${l.title}</b><span>${l.sub}${prog[l.id]?.score != null ? ` · التمرين ${ar(prog[l.id].score)}/${ar(l.quiz.length)}` : ''}</span></div>${ic.chev.replace('<svg', '<svg class="chev"')}</a>`).join('')}</div>
  <p class="note" style="margin-top:14px">التجويد علم يُتلقّى بالمشافهة. استعمل هذه الدروس للفهم والتدريب، واعرض تلاوتك على معلم متقن ليصحح لك عمليًا.</p>`;
});
function exampleHTML(ex, k) {
  let id, hl = [];
  if (ex.auto) { id = Q.ayahs.findIndex(t => t.includes(ex.auto)) + 1; const words = verseBody(id).split(' '); const m = words.findIndex(w => w.includes(ex.auto)); hl = [m - 1, m]; }
  else id = vid(ex.s, ex.a);
  const words = verseBody(id).split(' ');
  if (!ex.auto) { const t = ex.w.split(' ').map(norm); for (let i = 0; i + t.length <= words.length; i++) if (t.every((x, j) => norm(words[i + j]) === x)) { hl = t.map((_, j) => i + j); break; } }
  const html = words.map((w, i) => hl.includes(i) ? `<mark>${esc(w)}</mark>` : esc(w)).join(' ');
  return `<div class="ex"><div class="row between">${SRC_Q}<span class="badge teal">${esc(ref(id))}</span></div><div class="q">${html}</div><div class="row between"><div class="why">${esc(ex.why)}</div><button class="btn sm soft" data-play="${id}">${ic.play}استمع</button></div></div>`;
}
route('lesson', async (v, [lid]) => {
  const L = LESSONS.find(l => l.id === lid) || LESSONS[0]; const prog = await kvGet('tajweed', {});
  setTop(L.title, { sub: L.sub, back: 'tajweed' });
  v.innerHTML = `<div class="card lesson-body">${SRC_EXP}${L.body}</div>
  <div class="h2">أمثلة من القرآن الكريم <small>التلاوة: ${esc(reciter(S.tajReciter).ar)}</small></div>
  ${L.examples.map(exampleHTML).join('')}
  <div class="h2">تمرين</div><div class="card quiz" id="quiz">${L.quiz.map((q, i) => `<div data-q="${i}" style="margin-bottom:14px"><b>${ar(i + 1)}. ${esc(q.q)}</b>${q.o.map((o, j) => `<button class="btn opt" data-o="${j}">${esc(o)}</button>`).join('')}<div class="small muted ex-e" style="display:none">${esc(q.e)}</div></div>`).join('')}</div>
  <div class="grid2" style="margin-top:12px"><a class="btn soft" href="#record">${ic.mic}سجّل وتدرّب</a><button class="btn pri" id="done">${prog[L.id]?.done ? ic.check + 'مكتمل' : 'أتممت الدرس'}</button></div>
  <label class="f">قارئ أمثلة التجويد</label><select class="input" id="tr">${RECITERS.map(r => `<option value="${r.id}" ${r.id === S.tajReciter ? 'selected' : ''}>${r.ar}</option>`).join('')}</select>`;
  v.addEventListener('click', e => { const b = e.target.closest('[data-play]'); if (b) player.start([+b.dataset.play], { reciter: S.tajReciter, rate: S.rate, basmala: false }); });
  let score = 0, answered = 0;
  $$('#quiz [data-q]', v).forEach(qd => qd.addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b || qd.dataset.ans) return; const q = L.quiz[+qd.dataset.q]; qd.dataset.ans = 1; answered++;
    const ok = +b.dataset.o === q.a; if (ok) score++;
    b.classList.add(ok ? 'right' : 'wrong'); $$('.opt', qd)[q.a].classList.add('right'); $('.ex-e', qd).style.display = 'block';
    if (answered === L.quiz.length) { prog[L.id] = { ...(prog[L.id] || {}), score, at: today() }; kvSet('tajweed', prog); toast(`نتيجتك ${ar(score)} من ${ar(L.quiz.length)}`); }
  }));
  $('#done', v).onclick = async () => { prog[L.id] = { ...(prog[L.id] || {}), done: true, at: today() }; await kvSet('tajweed', prog); bumpDay('lessons', 1); toast('بارك الله فيك'); go('tajweed'); };
  $('#tr', v).onchange = e => saveSettings({ tajReciter: e.target.value });
});

// ---------------- PLAN ----------------
route('plan', async (v) => {
  setTop('خطتي اليومية', { back: 'more' });
  const cl = await checklist();
  const week = []; for (let k = 6; k >= 0; k--) week.push(await getDay(addDays(today(), -k)));
  const wNew = week.reduce((s, d) => s + (d.newMem || 0), 0), wDays = week.filter(d => (d.newMem || 0) + (d.revDone || 0) > 0 || (d.listenSec || 0) > 120).length;
  v.innerHTML = `
  <div class="card"><b>قائمة اليوم</b>
    ${[['a', 'أ. حفظ جديد'], ['b', 'ب. مراجعة المحفوظ'], ['c', 'ج. استماع وتلاوة']].map(([k, t]) => `<div class="check ${cl[k].done ? 'done' : ''}"><div class="box">${ic.check}</div><div class="grow"><b>${t}</b><div class="tiny muted">${cl[k].txt}</div></div></div>`).join('')}</div>
  <div class="h2">أهداف هذا الأسبوع</div>
  <div class="card"><div class="row between small"><span>آيات جديدة</span><span>${ar(wNew)} / ${ar(PLAN.weeklyNew)}</span></div><div class="progress" style="margin:6px 0 12px"><i style="width:${Math.min(100, 100 * wNew / PLAN.weeklyNew)}%"></i></div>
  <div class="row between small"><span>أيام النشاط</span><span>${ar(wDays)} / ${ar(PLAN.weeklyDays)}</span></div><div class="progress" style="margin-top:6px"><i style="width:${Math.min(100, 100 * wDays / PLAN.weeklyDays)}%"></i></div></div>
  <div class="h2">إعداد الخطة</div>
  <div class="card">
    <div class="grid2"><div><label class="f">مدة الدراسة اليومية (دقيقة)</label><input class="input" type="number" id="mn" min="5" max="300" value="${PLAN.minutes}"></div><div><label class="f">آيات جديدة يوميًا</label><input class="input" type="number" id="np" min="1" max="50" value="${PLAN.newPerDay}"></div></div>
    <div class="grid2"><div><label class="f">دقائق الاستماع والتلاوة</label><input class="input" type="number" id="lm" min="1" max="180" value="${PLAN.listenMin}"></div><div><label class="f">الوقت المفضل</label><input class="input" type="time" id="tm" value="${PLAN.time}"></div></div>
    <div class="grid2"><div><label class="f">هدف الآيات أسبوعيًا</label><input class="input" type="number" id="wn" min="1" max="500" value="${PLAN.weeklyNew}"></div><div><label class="f">أيام الدراسة أسبوعيًا</label><input class="input" type="number" id="wd" min="1" max="7" value="${PLAN.weeklyDays}"></div></div>
    <label class="f">القارئ المفضل</label><select class="input" id="rc">${RECITERS.map(r => `<option value="${r.id}" ${r.id === S.reciter ? 'selected' : ''}>${r.ar}</option>`).join('')}</select>
    <button class="btn pri block" id="sv" style="margin-top:14px">حفظ الخطة</button></div>
  <div class="h2">التذكير اليومي</div>
  <div class="card"><p class="small" style="margin-top:0">أضف تذكيرًا يوميًا متكررًا إلى تقويم iPhone في وقتك المفضل. هذه أكثر طريقة موثوقة للتذكير، وتعمل دون إنترنت ودون حساب أو خادم.</p>
    <button class="btn soft block" id="ics">${ic.cal}إضافة تذكير إلى التقويم</button>
    <p class="tiny muted">إشعارات تطبيقات الويب على iPhone تتطلب خادم إشعارات خارجيًا، لذلك اعتمدنا التقويم بديلًا يعمل دائمًا.</p></div>`;
  $('#sv', v).onclick = async () => {
    await savePlan({ minutes: +$('#mn', v).value || 30, newPerDay: +$('#np', v).value || 3, listenMin: +$('#lm', v).value || 10, time: $('#tm', v).value || '05:30', weeklyNew: +$('#wn', v).value || 15, weeklyDays: +$('#wd', v).value || 6 });
    await saveSettings({ reciter: $('#rc', v).value }); toast('حُفظت الخطة'); routes.plan(v);
  };
  $('#ics', v).onclick = () => {
    const [hh, mm] = (PLAN.time || '05:30').split(':'); const d = today().replace(/-/g, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOOR//Quran Journey//AR', 'BEGIN:VEVENT', `UID:noor-daily-${Date.now()}@noor`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${d}T${hh}${mm}00`, `DURATION:PT${PLAN.minutes}M`, 'RRULE:FREQ=DAILY', 'SUMMARY:نور — وردي من القرآن', `DESCRIPTION:حفظ ${PLAN.newPerDay} آيات + المراجعة + ${PLAN.listenMin} دقائق استماع`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:وقت وردك من القرآن', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    saveFile(new Blob([ics], { type: 'text/calendar' }), 'noor-reminder.ics');
  };
});

// ---------------- STATS ----------------
function bars(data, key, color, labels, h = 120) {
  const max = Math.max(1, ...data.map(d => d[key] || 0)); const w = 300 / data.length;
  return `<svg class="chart" viewBox="0 0 300 ${h + 18}">${data.map((d, i) => { const bh = (d[key] || 0) / max * h; return `<rect x="${i * w + w * .18}" y="${h - bh}" width="${w * .64}" height="${Math.max(bh, 1)}" rx="3" fill="${color}" opacity="${bh ? 1 : .25}"><title>${d[key] || 0}</title></rect>${labels ? `<text x="${i * w + w / 2}" y="${h + 13}" text-anchor="middle">${labels[i]}</text>` : ''}`; }).join('')}</svg>`;
}
const MILESTONES = [
  [c => c.verses >= 1, 'v1', 'أول آية تحفظها — بداية مباركة'], [c => c.verses >= 10, 'v10', 'عشر آيات محفوظة'], [c => c.verses >= 50, 'v50', 'خمسون آية محفوظة'],
  [c => c.verses >= 100, 'v100', 'مئة آية محفوظة'], [c => c.verses >= 500, 'v500', 'خمسمئة آية محفوظة'], [c => c.verses >= 1000, 'v1000', 'ألف آية محفوظة'],
  [c => c.streak >= 7, 's7', 'أسبوع متواصل من الورد'], [c => c.streak >= 30, 's30', 'ثلاثون يومًا متواصلة'], [c => c.streak >= 100, 's100', 'مئة يوم متواصلة'],
];
route('stats', async (v) => {
  setTop('لوحة التقدم', { back: 'more' });
  await loadVerses();
  const c = await counts(); const st = await streak(); const ret = await retention();
  const days = new Map((await db.all('days')).map(d => [d.d, d]));
  const all = [...days.values()];
  const tot = k => all.reduce((s, d) => s + (d[k] || 0), 0);
  const memSet = id => ['memorized', 'revise'].includes(statusOf(id));
  const fullSurahs = Q.surahs.filter(s => { for (let k = 0; k < s.ayas; k++) if (!memSet(s.start + k)) return false; return true; });
  const juzPct = Array.from({ length: 30 }, (_, j) => { const f = Q.juzStart[j], t = j < 29 ? Q.juzStart[j + 1] - 1 : 6236; let n = 0; for (let id = f; id <= t; id++) if (memSet(id)) n++; return n / (t - f + 1); });
  let lastMemId = 0; for (const x of (await db.all('verses'))) if (x.memorizedAt && ['memorized', 'revise'].includes(x.status) && (!lastMemId || x.memorizedAt >= (vstate(lastMemId)?.memorizedAt || ''))) lastMemId = x.id;
  const curJuz = lastMemId ? juzOf(lastMemId) : null;
  const last7 = [], last30 = []; for (let k = 29; k >= 0; k--) { const d = addDays(today(), -k); const x = days.get(d) || { d }; last30.push({ ...x, min: Math.round(((x.listenSec || 0) + (x.memSec || 0) + (x.revSec || 0)) / 60) }); if (k < 7) last7.push(x); }
  const wkLbl = last7.map(d => new Intl.DateTimeFormat('ar-EG', { weekday: 'narrow' }).format(new Date(d.d + 'T12:00:00')));
  const revDue7 = last7.reduce((s, d) => s + (d.revDue || 0), 0), revDone7 = last7.reduce((s, d) => s + Math.min(d.revDone || 0, d.revDue || d.revDone || 0), 0);
  const revRate = revDue7 ? Math.round(100 * revDone7 / revDue7) : null;
  const cc = { verses: c.memorized + c.revise, streak: st };
  const got = await kvGet('milestones', {}); let changed = false;
  for (const [f, k] of MILESTONES) if (f(cc) && !got[k]) { got[k] = today(); changed = true; }
  for (const s of fullSurahs) if (!got['su' + s.n]) { got['su' + s.n] = today(); changed = true; }
  juzPct.forEach((p, j) => { if (p === 1 && !got['j' + (j + 1)]) { got['j' + (j + 1)] = today(); changed = true; } });
  if (changed) await kvSet('milestones', got);
  const msText = k => k.startsWith('su') ? `أتممت حفظ سورة ${surah(+k.slice(2)).ar}` : k.startsWith('j') && !k.startsWith('ju') ? `أتممت حفظ الجزء ${ar(k.slice(1))}` : (MILESTONES.find(m => m[1] === k) || [])[2];
  const ms = Object.entries(got).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 8);
  v.innerHTML = `
  <div class="kpis">
    <div class="kpi"><b>${ar(cc.verses)}</b><span>آية محفوظة</span><br><em>${ar((cc.verses / 62.36).toFixed(1))}٪ من القرآن</em></div>
    <div class="kpi"><b>${ar(fullSurahs.length)}</b><span>سورة محفوظة كاملة</span></div>
    <div class="kpi"><b>${curJuz ? ar(curJuz) : '—'}</b><span>الجزء الحالي</span></div>
    <div class="kpi"><b>${ar(st)}</b><span>أيام متتالية</span></div>
    <div class="kpi"><b style="font-size:20px">${fmtDur(tot('listenSec'))}</b><span>وقت الاستماع</span></div>
    <div class="kpi"><b style="font-size:20px">${fmtDur(tot('memSec'))}</b><span>وقت الحفظ</span></div>
    <div class="kpi"><b>${revRate == null ? '—' : ar(revRate) + '٪'}</b><span>إنجاز المراجعة (٧ أيام)</span></div>
    <div class="kpi"><b>${ret == null ? '—' : ar(ret) + '٪'}</b><span>نسبة التثبيت (٣٠ يومًا)</span></div>
  </div>
  <div class="h2">هذا الأسبوع <small>آيات جديدة · مراجعات</small></div>
  <div class="card">${bars(last7, 'newMem', 'var(--teal)', wkLbl)}${bars(last7, 'revDone', 'var(--gold)', null, 60)}</div>
  <div class="h2">آخر ٣٠ يومًا <small>دقائق الدراسة يوميًا</small></div>
  <div class="card">${bars(last30, 'min', 'var(--blue)', last30.map((d, i) => i % 5 === 4 ? ar(+d.d.slice(8)) : ''))}</div>
  <div class="h2">خريطة الأجزاء</div>
  <div class="card"><div class="juzmap">${juzPct.map((p, j) => `<div class="${p === 1 ? 'full' : ''}" title="${Math.round(p * 100)}%"><i style="height:${p * 100}%"></i><span>${ar(j + 1)}</span></div>`).join('')}</div></div>
  <div class="h2">إنجازات</div>
  ${ms.length ? ms.map(([k, d]) => `<div class="milestone"><span class="st">${ic.star}</span><div class="grow"><b>${msText(k)}</b><div class="tiny muted">${new Date(d + 'T12:00:00').toLocaleDateString('ar-EG')}</div></div></div>`).join('') + '<p class="small muted" style="text-align:center">الحمد لله الذي بنعمته تتم الصالحات. نسأل الله القبول والثبات.</p>' : '<div class="empty">ستظهر هنا إنجازاتك بإذن الله.</div>'}`;
});

// ---------------- SETTINGS ----------------
route('settings', async (v) => {
  setTop('الإعدادات', { back: 'more' });
  const dl = await downloadedSummary();
  let est = ''; try { const e = await navigator.storage.estimate(); est = `${(e.usage / 1048576).toFixed(1)} م.ب مستخدمة`; } catch (e) {}
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  v.innerHTML = `
  <div class="card"><label class="f" style="margin-top:0">المظهر</label><div class="seg" id="th">${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([k, l]) => `<button data-k="${k}" class="${S.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <label class="f">حجم خط المصحف</label><input type="range" min="20" max="44" value="${S.qsize}" id="qs"><div class="q" style="text-align:center">${esc(verseBody(vid(112, 1)))}</div>
  <label class="f">طريقة عرض المصحف</label><div class="seg" id="rm"><button data-m="flow" class="${S.readMode === 'flow' ? 'on' : ''}">متصل</button><button data-m="cards" class="${S.readMode === 'cards' ? 'on' : ''}">آية بآية</button></div>
  <label class="f">القارئ الافتراضي</label><select class="input" id="rc">${RECITERS.map(r => `<option value="${r.id}" ${r.id === S.reciter ? 'selected' : ''}>${r.ar}</option>`).join('')}</select></div>
  <div class="h2">التلاوات المنزّلة <small>${est}</small></div>
  <div class="list">${Object.keys(dl).length ? Object.entries(dl).flatMap(([rid, ss]) => Object.entries(ss).map(([s, n]) => `<div class="li"><div class="t"><b>${surah(+s).ar}</b><span>${reciter(rid).ar} · ${ar(n)} ملف</span></div><button class="iconbtn" data-del="${rid}|${s}" aria-label="حذف">${ic.trash}</button></div>`)).join('') : '<div class="li"><div class="t"><span>لا توجد تلاوات منزّلة — نزّلها من صفحة الاستماع.</span></div></div>'}</div>
  <div class="h2">الخصوصية والتخزين</div>
  <div class="card small"><p style="margin-top:0">كل بياناتك — التقدم، الملاحظات، والتسجيلات الصوتية — محفوظة على هذا الجهاز فقط في قاعدة بيانات المتصفح، ولا تُرفع إلى أي خادم. لا يوجد حساب ولا تتبع.</p>
  <div class="row between"><span>تخزين دائم ${persisted ? '<span class="badge ok">مفعّل</span>' : '<span class="badge warn">غير مؤكد</span>'}</span><button class="btn sm soft" id="ps">طلب التفعيل</button></div>
  <p class="tiny muted">على iPhone: ثبّت التطبيق على الشاشة الرئيسية وخذ نسخة احتياطية دورية؛ فقد يحذف iOS بيانات المواقع غير المستخدمة لفترة طويلة.</p></div>
  <div class="h2">إدارة البيانات</div>
  <div class="list"><a class="li" href="#backup"><div class="t"><b>النسخ الاحتياطي والاستعادة</b></div></a>
  <div class="li" id="delRecs"><div class="t"><b style="color:var(--bad)">حذف كل التسجيلات</b></div></div>
  <div class="li" id="reset"><div class="t"><b style="color:var(--bad)">مسح كل البيانات</b><span>التقدم والتسجيلات والإعدادات</span></div></div></div>`;
  $$('#th button', v).forEach(b => b.onclick = () => { saveSettings({ theme: b.dataset.k }); $$('#th button', v).forEach(x => x.classList.toggle('on', x === b)); });
  $('#qs', v).oninput = e => saveSettings({ qsize: +e.target.value });
  $$('#rm button', v).forEach(b => b.onclick = () => { saveSettings({ readMode: b.dataset.m }); $$('#rm button', v).forEach(x => x.classList.toggle('on', x === b)); });
  $('#rc', v).onchange = e => saveSettings({ reciter: e.target.value });
  $('#ps', v).onclick = async () => { const ok = await requestPersist(); toast(ok ? 'تم تفعيل التخزين الدائم' : 'لم يوافق المتصفح — ثبّت التطبيق على الشاشة الرئيسية ثم أعد المحاولة'); routes.settings(v); };
  v.addEventListener('click', async e => { const b = e.target.closest('[data-del]'); if (!b) return; const [rid, s] = b.dataset.del.split('|'); await deleteDownloads(rid, +s); routes.settings(v); });
  $('#delRecs', v).onclick = async () => { if (await ask('حذف كل تسجيلاتك نهائيًا؟', 'حذف', true)) { await db.clear('recs'); toast('حُذفت التسجيلات'); } };
  $('#reset', v).onclick = async () => { if (await ask('مسح كل البيانات؟ لا يمكن التراجع. خذ نسخة احتياطية أولًا.', 'مسح الكل', true)) { for (const s of db.stores) await db.clear(s); resetCache(); toast('تم المسح'); setTimeout(() => location.reload(), 600); } };
});

// ---------------- BACKUP ----------------
const b64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
route('backup', async (v) => {
  setTop('النسخ الاحتياطي والتصدير', { back: 'more' });
  const nRecs = (await db.keys('recs')).length;
  v.innerHTML = `
  <div class="card"><b>نسخة احتياطية كاملة</b><p class="small muted">ملف واحد يحتوي تقدمك وجدول المراجعة والإعدادات والعلامات وسجل النشاط. احفظه في «الملفات» أو iCloud Drive.</p>
  <div class="row between"><span class="small">تضمين التسجيلات الصوتية (${ar(nRecs)})</span><label class="switch"><input type="checkbox" id="inc"><i></i></label></div>
  <button class="btn pri block" id="exp" style="margin-top:12px">${ic.down}تصدير نسخة احتياطية</button></div>
  <div class="card"><b>استعادة</b><p class="small muted">اختر ملف نسخة احتياطية من «نور». ستُستبدل البيانات الحالية.</p><input type="file" id="imp" accept="application/json,.json" class="input"></div>
  <div class="card"><b>تصدير التقدم (CSV)</b><p class="small muted">جدول بحالة كل آية عملت عليها ومواعيد مراجعتها — يُفتح في Numbers أو Excel.</p><button class="btn soft block" id="csv">${ic.list}تصدير CSV</button></div>`;
  $('#exp', v).onclick = async () => {
    const out = { app: 'NOOR', format: 1, exportedAt: new Date().toISOString(), note: 'Personal progress only. Quran text is not included and must not be altered.', stores: {} };
    for (const s of ['kv', 'verses', 'days', 'log', 'bookmarks']) out.stores[s] = await db.all(s);
    if ($('#inc', v).checked) out.stores.recs = await Promise.all((await db.all('recs')).map(async r => ({ ...r, blob: await b64(r.blob) })));
    saveFile(new Blob([JSON.stringify(out)], { type: 'application/json' }), `noor-backup-${today()}.json`);
  };
  $('#imp', v).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text()); if (data.app !== 'NOOR') throw new Error('ليس ملف نسخة من نور');
      if (!(await ask('استبدال بياناتك الحالية بهذه النسخة؟', 'استعادة', true))) return;
      for (const s of ['kv', 'verses', 'days', 'log', 'bookmarks']) if (data.stores[s]) { await db.clear(s); await db.putMany(s, data.stores[s]); }
      if (data.stores.recs) { await db.clear('recs'); for (const r of data.stores.recs) { r.blob = await (await fetch(r.blob)).blob(); await db.put('recs', r); } }
      resetCache(); toast('تمت الاستعادة'); setTimeout(() => location.reload(), 700);
    } catch (err) { toast('تعذّرت الاستعادة: ' + err.message, 4000); }
  };
  $('#csv', v).onclick = async () => {
    const rows = [['surah', 'surah_name', 'ayah', 'status', 'memorized_at', 'next_review', 'interval_days', 'lapses', 'difficult']];
    for (const x of (await db.all('verses')).sort((a, b) => a.id - b.id)) { const p = sa(x.id); rows.push([p.s, surah(p.s).ar, p.a, x.status, x.memorizedAt || '', x.due || '', x.interval || 0, x.lapses || 0, x.hard || 0]); }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveFile(new Blob([csv], { type: 'text/csv' }), `noor-progress-${today()}.csv`);
  };
});

// ---------------- ABOUT ----------------
route('about', async (v) => {
  setTop('المصادر وحول التطبيق', { back: 'more' });
  v.innerHTML = `
  <div class="card"><b class="sname" style="font-size:22px">نور · NOOR</b><p class="small muted" style="margin:4px 0 0">رفيق شخصي لحفظ القرآن الكريم ومراجعته وتحسين تلاوته.</p></div>
  <div class="h2">نص القرآن الكريم</div>
  <div class="card small"><p style="margin-top:0">نص المصحف في هذا التطبيق هو <b>نص تنزيل العثماني</b> (Tanzil Quran Text — Uthmani) مع علامات الوقف، منقول حرفيًا دون أي تعديل في الحروف أو التشكيل. تحققنا آليًا من مطابقة الآيات الـ ٦٢٣٦ حرفًا وتشكيلًا لنسخة منزّلة مباشرة من tanzil.net.</p>
  <p>العرض الوحيد المختلف: يضع نص تنزيل البسملة في بداية الآية الأولى من كل سورة (عدا الفاتحة والتوبة)، ونعرضها نحن عنوانًا فوق السورة بحروفها كما هي.</p>
  <div dir="ltr" style="text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:12px;line-height:1.6">
  Tanzil Quran Text (Uthmani)<br>Copyright (C) 2007-2025 Tanzil Project<br>License: Creative Commons Attribution 3.0<br><br>
  This copy of the Quran text is carefully produced, highly verified and continuously monitored by a group of specialists in Tanzil Project.<br><br>
  TERMS OF USE:<br>- Permission is granted to copy and distribute verbatim copies of this text, but CHANGING IT IS NOT ALLOWED.<br>
  - This Quran text can be used in any website or application, provided that its source (Tanzil Project) is clearly indicated, and a link is made to tanzil.net to enable users to keep track of changes.<br>
  - This copyright notice shall be included in all verbatim copies of the text, and shall be kept intact for distribution.</div>
  <p><a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a> — بيانات الأجزاء والأحزاب والصفحات من بيانات تنزيل الوصفية (عبر مكتبة quran-meta).</p></div>
  <div class="h2">التلاوات الصوتية</div>
  <div class="card small"><p style="margin-top:0">تسجيلات أصلية لكل آية من أرشيفات صوتية عامة معروفة. لا يولّد التطبيق أي صوت ولا يقلّد أصوات القرّاء.</p>
  <ul style="padding-inline-start:18px">${RECITERS.map(r => `<li><b>${r.ar}</b> (${r.en}) — ${r.src.map(s => s.host).filter((x, i, a) => a.indexOf(x) === i).join('، ')}</li>`).join('')}</ul>
  <p><a href="https://everyayah.com" target="_blank" rel="noopener">everyayah.com</a> · <a href="https://alquran.cloud" target="_blank" rel="noopener">alquran.cloud</a> (Islamic Network CDN). التنزيل للاستماع الشخصي دون إنترنت فقط، وحقوق التلاوات لأصحابها.</p></div>
  <div class="h2">التمييز بين أنواع المحتوى</div>
  <div class="card small"><div>${SRC_Q} — آيات من نص تنزيل الموثّق، كما هي.</div><div style="margin-top:6px">${SRC_EXP} — دروس التجويد والإرشادات، كتبت للتطبيق وفق رواية حفص من طريق الشاطبية.</div><div style="margin-top:6px"><span class="label-src mine"><i></i>ملاحظة شخصية</span> — ما تكتبه أنت.</div>
  <p>لا يحتوي التطبيق على ترجمات أو تفسير.</p></div>
  <div class="h2">تنبيه مهم</div>
  <div class="note">لا يقدّم التطبيق تقييمًا آليًا للنطق أو التجويد، ولا يغني عن معلّم متقن. احرص على عرض حفظك وتلاوتك على شيخ أو معلّم مجاز يسمعك ويصحح لك.</div>
  <div class="h2">الخطوط</div>
  <div class="card small">Amiri Quran و Amiri (The Amiri Project — SIL Open Font License 1.1) · IBM Plex Sans Arabic (SIL OFL 1.1).</div>`;
});
