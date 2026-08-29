# CLAUDE.md — RxTU10 v2

เว็บแอพของชั้นปี (เภสัช มธ. รุ่น 10) — รวมข้อมูลเพื่อน + เกมสะสม/ฟาร์ม + ระบบเตรียมสอบ
Vue 3 + Vite + Pinia + Firebase (Auth/Firestore) · มือถือเป็นหลัก · UI ภาษาไทย · client-only ไม่มี backend

## คำสั่ง

```
npm run dev                              # dev server
npm run build                            # build → dist/
git push origin master                   # deploy เว็บหลัก: GitHub Actions build+publish → GitHub Pages อัตโนมัติ
firebase deploy --only firestore:rules   # ⚠️ แก้ firestore.rules แล้วต้อง deploy เสมอ ไม่งั้นไม่มีผล (CLI: firebase-tools)
firebase deploy --only hosting           # deploy host สำรอง (Firebase) — build ก่อน
```
ไม่มี test runner กลาง/lint — ตรวจด้วย `npm run build` + ทดลองใน dev
มีเทสเฉพาะจุด (pure utils) รันตรงด้วย `node --test src/utils/<x>.test.js` เช่น `importQuestions.test.js`

**Deploy:** host หลัก = **GitHub Pages ผ่าน GitHub Actions** (`.github/workflows/deploy-pages.yml`) —
push `master` = auto build+publish ไป `pikar10tu.github.io/rxtu10/` (ลิงก์ที่ทั้งชั้นปีใช้)
host สำรอง = Firebase Hosting (`rxtu10dashboard.web.app`) · Firestore เดียวกันทั้งสองที่ ·
firestore rules ใช้ `firebase deploy` เสมอ (Pages เสิร์ฟแค่ frontend ไม่แตะ rules)

## สถาปัตยกรรม

```
src/
  firebase/config.js   Firebase init + ADMIN_EMAIL + ค่าคงที่ระบบ (PLE_CC_DATE ฯลฯ)
                       ⚠️ ต้องใช้ initializeFirestore({experimentalForceLongPolling:true})
  stores/auth.js       หัวใจของแอพ — ดูแพทเทิร์น patchUser ด้านล่าง
  stores/members.js    รายชื่อสมาชิก (users ทุกคน + guest จาก data/students.js)
  router/index.js      hash router, lazy routes, reload-guard กัน stale chunk หลัง deploy
  App.vue              launch gate: เข้าได้เมื่อ isLoggedIn && (isAcademic || !maintenance)
                       maintenance อ่านสดจาก Firestore (useAppConfig) — admin toggle ได้ ไม่ต้อง deploy
  views/               หน้าละไฟล์: Home Members Play Study Quiz Questions Shop Rank Admin Me Pets
  composables/         useDaily (รายได้ idle) useFarm useResidence useToast useConfirm useGuard
                       useAppConfig (launch gate: live config/app.maintenance, default locked, public-read)
  data/                ค่าคงที่เกมทั้งหมด ปรับตัวเลขที่นี่ (ดู "เศรษฐกิจ")
  utils/               sm2.js (SRS) petUtils.js (รายได้เพ็ท v2) text.js (cleanText+LIMITS) avatar.js
                       importQuestions.js (parseImport: bulk JSON → rows/skipped, pure + มี .test.js)
firestore.rules        trust-based + light guards (ownership, role, coin range)
.github/workflows/     deploy-pages.yml — CI build+publish ไป GitHub Pages เมื่อ push master
ROADMAP.md             แผนพัฒนาปัจจุบัน + บั๊กที่รู้แล้ว + ข้อเสนอปรับ economy — อ่านก่อนเริ่มงานใหม่
```

## แพทเทิร์นสำคัญ (ทำตามเสมอ)

**เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น**
- `optimistic` = ค่า local ตรงๆ (อัปเดต UI ทันที), `server` = Firestore patch (ใช้ `increment()`/`serverTimestamp()` ได้)
- ภายในจัดการ blockSnapshot ให้แล้ว (กัน onSnapshot เขียนทับ optimistic state ~1.5s)
- คืน boolean — caller เป็นคน toast เอง

**Roles:** `student | academic | admin` บน user doc · ADMIN_EMAIL ใน config = super-admin ถาวร
gates: `auth.isAdmin`, `auth.isAcademic` (admin ⊃ academic) · user แก้ role ตัวเองไม่ได้ (rules บังคับ)

**ข้อความจากผู้ใช้ทุกช่อง:** ผ่าน `cleanText(str, LIMITS.xxx)` จาก utils/text.js ก่อนเขียนเสมอ

**ฟอนต์ขั้นต่ำ `.7rem`** — ห้ามมี `font-size` ต่ำกว่านี้ในไฟล์ `.vue`/`.css` ใดๆ
ภาษาไทยมีสระบน-ล่างและวรรณยุกต์ ต่ำกว่า ~11px อ่านไม่ออกบนมือถือจริง (เคยหลุดไป 190 จุด เล็กสุด `.46rem` ≈ 7px)
ตรวจเร็ว: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/` ต้องไม่เจออะไร

**สไตล์:** คอมเมนต์/commit เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · โทนข้อความผู้ใช้: ยึด docs/voice-guide.md (เป็นกันเอง อธิบายฟังก์ชันชัด ไม่ใช้คำหวือหวา) ·
single-file component + scoped style · สีธีมหลัก indigo (#4f46e5) ใน style.css

## Data model (Firestore)

- `users/{uid}` — ทุกอย่างของผู้เล่นอยู่ใน doc เดียว: coins, residence.level, pets[], activePets,
  farm{plots,inventory}, study.cards{} (SRS), quizHigh/quizCoinDate/quizCoinsToday,
  studyCoinDate/studyCoinsToday, tags[], likes
  → schema กลาง: `data/userSchema.js` (USER_DEFAULTS + normalizeUserData) เพิ่มฟิลด์ใหม่ที่นี่ก่อน
- `config/app` — `{ maintenance: bool }` launch gate (public-read, admin-write) ดู useAppConfig
- `questions` — คลังข้อสอบ (academic เขียน, นักศึกษาอ่านเฉพาะ isPublished)
- `examSessions` — ผลการทำข้อสอบ (create-only แล้ว; ยังไม่มีหน้าอ่าน — ดู ROADMAP Phase 1)
- `news` `feedback` `drugReports` `cheatLogs` — admin triage ใน AdminView
- SRS เก็บใน user doc `study.cards` (ไม่มี subcollection — rules srsCards ที่ค้างถูกลบแล้ว)

## เศรษฐกิจ (ตัวเลขทั้งหมด tunable)

- รายได้ idle = บ้าน (`data/residence.js` ladder 12 ขั้น) + เพ็ทในคลัง (`utils/petUtils.js`
  RARITY_DAILY_BASE + GRADE_MULTI_V2 — ตัวจริงตัวเดียว; ซาก legacy ใน data/index.js ถูกลบแล้ว 12 ก.ค. ดู [[pet-overhaul]])
  สะสมสูงสุด 24 ชม. กดเก็บที่ Home (useDaily)
- ฟาร์ม `data/crops.js` (ปลดล็อกตามเลเวลบ้าน) · อัญเชิญเพ็ท `utils/gacha.js` (rates/pity, catalog จาก `data/index.js`) (ระบบศักยภาพถอดออกแล้ว — pet build depth ไปที่ passive)
- เหรียญจากการเรียน: Quiz 100/ข้อ **ไม่มี cap แล้ว** (11 ก.ค. ทำมากได้มาก) · Study 5/ใบ cap 150/วัน (studyCoinDate/studyCoinsToday)
- ⚠️ สมดุลปัจจุบันเพี้ยน: ฟาร์มพืชยาว >> รายได้บ้าน, รายได้จากการเรียน ~1% — ตารางวิเคราะห์+ข้อเสนอใน ROADMAP.md

## กับดักที่เคยเจอแล้ว (อย่าทำซ้ำ)

1. login ใช้ `signInWithPopup` ทุกอุปกรณ์ (รวมมือถือ) — **อย่าเปลี่ยนกลับไป redirect เป็นค่าหลัก**
   เหตุ: host คนละโดเมนกับ authDomain → signInWithRedirect พึ่ง third-party storage ที่ Safari/Chrome
   มือถือบล็อก → ล็อกอินแล้วเด้งกลับหน้า login. popup เลี่ยงได้. redirect เหลือเป็น fallback เท่านั้น.
   (in-app webview เช่น LINE บล็อกทั้งคู่ → LoginLanding เตือนให้เปิดในเบราว์เซอร์จริง)
2. Firestore ต้อง force long-polling — เครือข่ายมหาลัย/มือถือบล็อก WebChannel
3. แก้ rules แล้วลืม deploy = ไม่มีผลจริง (rules ขึ้นผ่าน `firebase deploy` เท่านั้น — Pages/Actions ไม่แตะ rules)
4. repo เดียวกันมี 2 ประวัติ: v1 (vanilla JS, branch main) และ v2 (โฟลเดอร์นี้, branch master)
   ⚠️ GitHub Pages เสิร์ฟ **v2** แล้ว (ผ่าน Actions, source=GitHub Actions) — v1 ยังอยู่บน main แต่ Pages เลิกเสิร์ฟ
5. การ์ด/กระดานของฟีเจอร์ที่ยังไม่เปิด (PvP, หอคอย, ตลาด) มีโครงใน UI แล้ว — อย่าเข้าใจผิดว่า implement แล้ว
6. **overlay/modal/sheet `position:fixed` ที่ render ใต้ `<RouterView>` (คือใน view หรือ component ที่อยู่ในหน้า) ต้องห่อ `<Teleport to="body">` เสมอ** — ไม่งั้น `#bottom-nav` (z200 ที่ root) จะเพนต์ทับ (nav โผล่ทะลุก้น backdrop / บังปุ่มก้น sheet). เหตุ: `#main-content` เป็น `position:fixed` = สร้าง **stacking context** → z-index ของ overlay ข้างใน (แม้ 400+) สู้ nav ข้าม context ไม่ได้ · **z-index สูงแค่ไหนก็ไม่ช่วย ต้อง Teleport เท่านั้น** · บั๊กนี้วนกลับมาแล้ว ≥5 รอบ (farm-ov 470193f→389540e, sheet เมล/เควส 29d34dd, battle result 0894a9b, SeedPicker+6 modal 10 ก.ค.) มักหลุดตอน refactor ที่ลบ wrapper Teleport ทิ้ง · modal ที่ mount ใน `App.vue` ระดับ root (Help/Confirm/Toast/onboarding gates) ปลอดภัยอยู่แล้ว (เป็น sibling ของ nav) · pattern อ้างอิง: `components/shared/BottomSheet.vue`
   - แฝง: `env(safe-area-inset-bottom)` = 0 บน iOS เพราะ `index.html` ยังไม่มี `viewport-fit=cover` (ถ้าจะพึ่ง safe-area จริงต้องเติมก่อน) · `--btm`/`#main-content bottom` ยังไม่บวก safe-area (ok เพราะ nav border-box คงสูง 66px) — ดู ROADMAP ถ้าจะทำ edge-to-edge
7. **ล็อกอินขึ้น "The requested action is invalid." = referrer allowlist ของ API key ขาด `authDomain`** (ไม่ใช่บั๊กโค้ด — แก้ที่ Google Cloud Console)
   เหตุ: popup เปิดหน้า `/__/auth/handler` ที่อยู่บน `rxtu10dashboard.firebaseapp.com` → handler ยิง `identitytoolkit/v1/projects` เพื่อเช็คว่าโดเมนแอปได้รับอนุญาต → ถ้า API key จำกัด referrer ไว้แค่ `pikar10tu.github.io` จะได้ 403 `API_KEY_HTTP_REFERRER_BLOCKED` → console ขึ้น `Unable to verify that the app domain is authorized` → หน้าแสดง error นั้น
   ⚠️ **`authorizedDomains` ใน Firebase Auth เป็นคนละที่กับ referrer allowlist ของ API key** — ตอนพังจะเห็น authorizedDomains ถูกต้องครบทุกโดเมน ทำให้หลงไปแก้ผิดที่
   แก้: Cloud Console → Credentials → API key → Websites ต้องมีครบทั้งโฮสต์แอป **และ** `rxtu10dashboard.firebaseapp.com/*` + `rxtu10dashboard.web.app/*`
   วินิจฉัยเร็ว: `curl -s -H "Referer: https://rxtu10dashboard.firebaseapp.com/" "https://identitytoolkit.googleapis.com/v1/projects?key=<apiKey>"` — ได้ `authorizedDomains` = ปกติ, ได้ 403 = เจอตัวปัญหา
   (เกิดจริง 13 ส.ค. 2026 ล็อกอินพังทั้งเว็บทุกคนทั้ง 2 โฮสต์ · น่าจะมาจากแบนเนอร์ Google ที่ชวนจำกัด key แล้วเติมโดเมนให้จากทราฟฟิกที่เห็น ซึ่งเห็นแค่โฮสต์แอป · ตามด้วย commit `4125fe9` = `utils/authError.js` ให้แอปเตือนเองเมื่อ popup ตายเร็วผิดปกติ เพราะเดิม `auth/popup-closed-by-user` ถูกกลืนเงียบทั้งกรณีคนกดปิดและระบบพัง)
8. **`emojifyHtml()` (`utils/emoji.js`) escape ข้อความให้แล้ว — อย่าถอดออก** เพราะเอาต์พุตไปเข้า `v-html` ใน `ConfirmModal.vue` และผู้เรียกส่งชื่อเล่นผู้ใช้ (`AdminView`) กับโจทย์ข้อสอบ (`QuestionsView`) เข้ามา · ไม่ escape = นักศึกษาตั้งชื่อเล่นเป็นแท็กแล้วรันสคริปต์ในเบราว์เซอร์แอดมิน ซึ่งเขียน `role` ได้ทุก doc ตาม rules
   ⚠️ คอมเมนต์ใน `utils/text.js` ที่ว่า "Vue's `{{ }}` already HTML-escapes… so this is about abuse/bloat, not XSS" **ใช้ไม่ได้กับเส้นทาง `v-html`** — `cleanText()` ไม่ได้กรอง `<` ให้ ถ้าจะเพิ่มจุดที่ใช้ `v-html` ใหม่ ต้อง escape เองเสมอ
9. **`patchUser()` อัปเดต state ในเครื่องแบบ synchronous (`setUserDataOptimistic` ก่อน `await`) → `computed` ทุกตัวที่ผูกกับ `userData` เปลี่ยนค่า "ทันที" ไม่ต้องรอ Firestore**
   ⇒ อ่าน computed ตัวเดิมซ้ำหลังเรียก patchUser = ได้ค่าของ "สถานะใหม่" ไม่ใช่สถานะตอนเริ่มทำงาน
   **หยิบค่าที่ต้องใช้เก็บเป็นตัวแปรก่อนเรียก patchUser เสมอ** (แพทเทิร์นเดียวกับ `const cleared = floor.value`)
   เกิดจริง 24 ส.ค. 2026 ที่ `useTower.fight()`: `return { botTeam: botTeam.value }` หลังชั้นขยับแล้ว
   → replay วาดทีมบอทของ**ชั้นถัดไป** ทับผลของชั้นที่เพิ่งสู้ · ชนะชั้น 1 (บอท 1 ตัว) แล้วจอโชว์ศัตรู 2 ใบ
   แต่ log มีแค่ B0 → ตีตายตัวเดียว log จบ = ผู้เล่นเห็นเป็น "เกมจบทั้งที่ศัตรูยังเหลือ" (แก้ commit ถัดจาก a94a2b0)
   ⚠️ ชั้น 3+ จำนวนบอทเท่ากันเลยไม่สะดุดตา แต่สปีชีส์/ธาตุ/maxHp ที่วาดก็ผิดตัวอยู่ดี (หลอดเลือดหดผิดสัดส่วนเงียบๆ)
   BattleReplay มี `warnTeamMismatch()` (dev only) เตือนไว้แล้วถ้าทีมที่วาดไม่ตรงกับ uid ใน log

10. **อ่าน snapshot ของ user doc ต้องใช้ `snap.data({ serverTimestamps: 'estimate' })` เสมอ — `snap.data()` เปล่าๆ ส่งฟิลด์ `serverTimestamp()` ที่ยังไม่ยืนยันมาเป็น `null`**
   Firestore ยิง snapshot ท้องถิ่นทันทีที่เขียน (latency compensation) โดยเวลาที่เซิร์ฟเวอร์ยังไม่ประทับจะเป็น null
   → ฟิลด์เวลา "หายไป" ชั่วคราวจนกว่าเซิร์ฟเวอร์จะ ack · เดิมไม่พังเพราะ blockSnapshot **ทิ้ง** snapshot ช่วงนั้น
   แต่ `bef0f25` (20 ส.ค.) เปลี่ยนเป็น **พักไว้ apply ตอนปลดบล็อก 1.5 วิ** → ถ้าเน็ตช้ากว่านั้น ค่าว่างจะทับ optimistic
   เกิดจริง 28 ส.ค. 2026: `lastDaily` หาย → `useDaily` อ่านว่า "ยังไม่เคยเก็บ" → บาร์รายได้เต็ม 100% ทันที
   **กดรับรายได้ประจำวันซ้ำได้รัวๆ ทุก ~1.5 วิ เหรียญพุ่ง** (ยกเหรียญที่ได้ไปแล้วให้ ไม่ไล่หัก)
   ⚠️ ระวังเป็นพิเศษเมื่อ **เวลาเป็นเงื่อนไขของรางวัล** — ค่าว่างต้องไม่แปลว่า "ผ่านมานานแล้ว"
   แนวกันที่สองของรายได้: `effectiveLastMs()` (`utils/idleIncome.js`) + `_lastClaim` ใน `useDaily` = เวลาเก็บล่าสุดเดินหน้าอย่างเดียว

11. **โหมดลดการเคลื่อนไหว (prefers-reduced-motion) ถูก bypass ทั้งเว็บแล้ว (28 ส.ค. 2026 — user สั่ง "ทุกคนจะไปเห็นอนิเมชั่นเดียวกัน")**
   ฝั่ง JS อ่านผ่าน `prefersReducedMotion()` ใน `utils/motionPref.js` ตัวเดียว (ตอนนี้คืน `false` เสมอ) ·
   บล็อก CSS `@media (prefers-reduced-motion: reduce)` ถูกลบออกหมดแล้ว
   **อย่าเติม `matchMedia('(prefers-reduced-motion: reduce)')` ตรงๆ กลับเข้าไป** — เรียก `prefersReducedMotion()` แทน
   จะกลับไปเคารพ OS: ตั้ง `RESPECT_REDUCED_MOTION = true` แล้วเอาบล็อก CSS กลับจาก git

12. **overlay ที่เปิดจาก "ข้างใน" overlay อื่น ต้องมี z-index สูงกว่าตัวที่เปิดมัน** — Teleport อย่างเดียวไม่พอ
   ข้อ 6 แก้เรื่อง "overlay สู้ bottom-nav ไม่ได้" ไปแล้ว แต่พอทุกตัว Teleport ไป body หมด
   มันกลายเป็น **พี่น้องกันที่ root** ⇒ ใครโผล่ข้างบนตัดสินด้วย z-index ล้วนๆ
   เกิดจริง 28 ส.ค. 2026: กด ⋯ ในหน้าจัดทีม (หอคอย/สนามประลอง) แล้ว `PetDetailModal` (z230)
   ไปอยู่ **ใต้** `BottomSheet` (z400) — ผู้เล่นเห็นแค่จอมืดลงเฉยๆ นึกว่าปุ่มเสีย
   **บันไดชั้นที่ใช้อยู่ (ยึดตามนี้):**
   ```
   200  #bottom-nav
   220  ProfileModal      → 250 PetStatPopup → 260 AchievementDetailModal   (ห่วงโซ่ที่ถูกอยู่แล้ว)
   300–330  onboarding gates (MigrationWelcome / ConsentGate / IntroTour)
   400  sheet/modal ฐาน   (BottomSheet · HelpModal · ShopView)
   410  อะไรที่เปิด "จากใน" ตัว 400  (SeedPicker · SpendCopiesModal · PetDetailModal)
   420–430  BattleReplay (overlay ไฟต์ · peek · inspect)
   500+ toast / balloon / WelcomeBox
   ```
   ⚠️ เพิ่ม overlay ใหม่ = ถามก่อนว่า "มันถูกเปิดจากในอะไร" แล้วเลือกชั้นให้สูงกว่านั้น
   ไม่ใช่หยิบเลขจากตัวที่หน้าตาคล้ายกัน (นี่คือทางที่ PetDetailModal ได้ z230 มาแต่แรก)

13. **สีตัวอักษรบนการ์ดพื้นเข้ม — อย่าก๊อปสไตล์ข้ามพื้นหลัง**
   เกิดจริง 28 ส.ค. 2026: `.br-card-passdesc` (หน้าข้อมูลเพ็ทใน replay, พื้น `#1e293b`)
   ใช้ `color: rgba(0,0,0,.62)` = ดำบนกรมท่า contrast ~1.4:1 อ่านไม่ออกเลย
   ต้นเหตุคือก๊อปมาจาก `.br-spot-desc` ซึ่งอยู่บนการ์ด **พื้นขาว** จึงถูกที่นั่นแต่ผิดที่นี่
   ตรวจเร็วก่อน commit: `grep -n "color: rgba(0,0,0" src/components/battle/BattleReplay.vue`
   แล้วไล่ดูทีละจุดว่าพื้นหลังของ element นั้นสว่างหรือเข้ม

14. **`questions.categories` เป็นค่า derive ห้ามเขียนมือ — แหล่งความจริงคือ `pleGroup`/`pleSub`**
   หมวด/กลุ่มโรคย้ายไปทะเบียนตายตัว `data/plecc.js` แล้ว (29 ส.ค. 2026 ตามภาคผนวก ๑ ประกาศศูนย์สอบฯ ๕/๒๕๖๖)
   เขียนหมวดเมื่อไหร่ให้ผ่าน `plePatch(group, sub)` เสมอ — มันคืน `{pleGroup, pleSub, categories}` เป็นชุดเดียว
   ⚠️ **เหตุผลที่ต้อง derive ไม่ใช่แค่ความสวยงาม — มันคือกลไกกันพังตอน deploy**
   ตอนปล่อยของ เพื่อนอาจเปิดหน้า `/review` ค้างไว้ด้วยโค้ดเวอร์ชันเก่า ซึ่งยัง submit `categories`
   ชุด free text เดิมทับได้ · แต่โค้ดเก่า**ไม่รู้จัก `pleGroup`/`pleSub` จึงแตะไม่ได้เลย**
   ⇒ แหล่งความจริงรอดเสมอ · แล้วปุ่ม "🔄 ซิงก์ระบบตรวจ" re-derive `categories` กลับมาให้ถูก (`pleCatsDrifted`)
   ⇒ worst case = ป้ายหมวดเพี้ยนชั่วคราว ไม่ใช่ data loss
   **ลำดับ deploy ห้ามสลับ:** `firebase deploy --only firestore:rules` (เพิ่ม `pleGroup`/`pleSub` ใน
   `reviewSubmitKeys`) → `git push` → แล้วค่อยกดปุ่มแมพ · สลับลำดับ = client ใหม่ส่งผลตรวจไม่ผ่าน permission
   ⚠️ `config/topics.list` เลิกเป็นทะเบียนหลักแล้ว (โตเองจนงอก 82 หมวดซ้ำซ้อน) — **ห้ามเติมช่อง
   "เพิ่มหัวข้อใหม่" กลับเข้า `TopicSelect`** จะเพิ่มกลุ่มจริงต้องไปแก้ `data/plecc.js` แล้ว deploy

15. **`kind` ของ beat = "เวลา" เท่านั้น — ห้ามให้ event ตัวไหนส่งฟิลด์ชื่อ `kind` เข้ามาอีก**
   `buildBeats()` ประกอบ beat ด้วย `{ ...event, kind }` ⇒ ฟิลด์ชื่อเดียวกันของ event ถูกทับเงียบๆ ทุกครั้ง
   28 ส.ค. `f32b519` เปลี่ยนชื่อ `tier`→`kind` แล้วชนกับ `kind` ของ passive (ชนิดผล: heal/guard/dodge/…)
   ⇒ **FX ของ passive ตายทั้งระบบ** — ฮีลแล้วหลอดเลือดขึ้น (ใช้ `hpPct` คนละฟิลด์เลยรอด) แต่เลข `+N`
   ประกาย ✨ วงแหวนกัน ป้าย "ไม่โดน" ไม่ขึ้นสักอัน · user เจอตอนเทสทีม 🦭แมวน้ำ+🐳คุณวาฬ 29 ส.ค.
   ชนิดผลชื่อ `fxKind` แล้ว (`battlePassives.js` → `BattleReplay.firePassiveFx`) · เทสคุมไว้ 2 ที่
   🔑 บทเรียนที่กว้างกว่านั้น: **rename ฟิลด์ในของที่ถูก spread ทับกัน ต้อง grep ชื่อใหม่ที่ปลายทางด้วย**
   ว่ามีใครใช้ชื่อนั้นอยู่ก่อนไหม — คอมไพเลอร์ไม่เตือน เทสที่มีอยู่ก็ไม่จับ (มันเช็ค `kind` ฝั่งเวลาผ่านหมด)

