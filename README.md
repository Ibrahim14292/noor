# نور – NOOR · My Personal Quran Journey

A local-first Progressive Web App for Quran memorization, listening, revision, recitation recording, and Tajweed learning. Arabic RTL, optimized for iPhone Safari.

## Put it online (permanent HTTPS link): pick one, all free

**Option A: GitHub Pages (recommended, permanent)**
1. Create a free account at github.com and a new public repository named `noor`.
2. Click **Add file → Upload files**, then drag in **all the contents** of this folder (index.html, css, js, data, fonts, icons, sw.js, manifest.webmanifest).
3. Commit, then open **Settings → Pages** and set *Source: Deploy from a branch → main / (root)*.
4. After about a minute your app is live at `https://YOUR-NAME.github.io/noor/`.

**Option B: Cloudflare Pages**
dash.cloudflare.com → Workers & Pages → Create → Pages → *Upload assets*, then drop this folder. You get `https://noor-xxx.pages.dev`.

**Option C: Netlify**
app.netlify.com/drop, then drag this folder. Sign in (free) to **claim** the site; unclaimed drops are deleted after a short time.

The app is fully static: no server, no database, no API keys.

## Install on iPhone
1. Open your HTTPS link in **Safari** (it must be Safari).
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **نور** from the Home Screen. It runs full-screen and the Quran text works offline.
4. In the app: **More → Settings → Persistent storage → Request** to protect your data.
5. Recording: allow microphone access the first time you record.
6. Offline listening: **Listen**, pick a surah, then tap **Download the selected surah**.
7. Reminders: **More → My daily plan → Add reminder to Calendar**.
8. Back up regularly: **More → Backup** (save the file to the Files app or iCloud Drive).

## Run locally
```
cd noor && python3 -m http.server 8080   # then open http://localhost:8080
```

## Sources and integrity
- **Quran text:** Tanzil Quran Text (Uthmani, with pause marks), © Tanzil Project, CC BY 3.0, verbatim (https://tanzil.net). All 6,236 verses were checked programmatically against a direct tanzil.net download: every letter and diacritic matches, and the only differences are Tanzil's optional pause and tanween marks. The text is never edited. The only presentation step shows Tanzil's basmala prefix on verse 1 as a surah header.
- **Juz, hizb and page metadata:** Tanzil metadata via `quran-meta`.
- **Audio:** original verse-by-verse recordings from EveryAyah.com, with Islamic Network CDN (alquran.cloud) as an automatic fallback. Nothing is synthesized.
- **Fonts:** Amiri Quran and Amiri (OFL 1.1); IBM Plex Sans Arabic (OFL 1.1).
- **Tajweed lessons:** written for this app (Hafs via al-Shatibiyyah) and clearly labelled as explanation, not Quran text. Each Quranic example is a verse reference rendered from the verified text.
- The app does not grade pronunciation. Please recite to a qualified teacher.

## iPhone notes and limits
- Background playback keeps going when the screen locks if the app is installed to the Home Screen. Phone calls pause it; tap Play to resume. The lock screen shows playback controls.
- Offline audio uses CORS downloads. If a source refuses, the app tells you which verses failed.
- Web push needs a server, so reminders use a calendar (.ics) event instead.
- All data stays on the device (IndexedDB). There is no account and no tracking.

## Structure
```
index.html  manifest.webmanifest  sw.js
css/app.css
js/app.js (shell, home, mushaf)   js/views-practice.js (listen, memorize, revision, record)
js/views-more.js (tajweed, plan, stats, settings, backup, about)
js/quran.js  js/audio.js  js/srs.js  js/db.js  js/state.js  js/ui.js  js/tajweed.js
data/quran.json  fonts/  icons/
```
