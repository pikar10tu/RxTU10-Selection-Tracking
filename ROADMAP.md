# RxTU10 v2 — แผนพัฒนา (รีวิว 13 มิ.ย. 2026)

สถานะ: โค้ดเบสแข็งแรง สถาปัตยกรรมดี (Vue 3 + Pinia + Firestore, optimistic update + rules)
ตอนนี้ล็อกให้เห็นเฉพาะ admin/academic — เป้าหมายของแผนนี้คือเปิดตัวให้ทั้งชั้นปีใช้

---

## ⏭️ คิวใหม่ (user สั่ง 29 มิ.ย. 2026 — เรียงความสำคัญ 1→5)

> "เบื้องต้นเท่านี้ก่อน ลำดับความสำคัญตามนี้เลย" · รายละเอียดเต็มใน memory `rxtu10_backlog_2026-06-29`

1. **หน้าตรวจข้อสอบ (Peer Review วิชาการ)** — ✅✅ **build+push+deploy เสร็จ (3 ก.ค.)** + review workflow v2 (วงจรผลตรวจ/นำออก-นำกลับ/หมวด dropdown) + rules deployed
   ⏳ **รอ user กด "ซิงก์ระบบตรวจ" ใน Admin 1 ครั้ง → เทส /review จอจริง** (เติม reviewStatus ให้ข้อเก่า ไม่งั้นคิวว่าง)
2. **ปรับ UI หน้า battle** — ✅✅ **build+push+deploy เสร็จ (3 ก.ค.)** · telegraph windup + melee พุ่ง 100% + เลขดาเมจ 1.5rem/crit 2rem + modal สรุปแยก+peek · +แก้ปุ่มปิดตอน peek (4 ก.ค.) · ⏳ รอ user เทสจอจริง
3. **PvP gating + matchmaking** ⏭️ **ถัดไป — เริ่มด้วย brainstorm** — ปิดอยู่=ไม่เห็นทีมใคร ขึ้น "เร็วๆ นี้" · เปิดแล้วสุ่ม 5 คนระดับใกล้เคียง + บอท 1–2 ตัว (ยังไม่ brainstorm)
4. **Expedition rework** — ปิดก่อนแล้วแก้: pet filter+กรอบใหญ่, ตัดธาตุ เหลือ ง่าย/กลาง/ยาก ตามเวลา, ตั้งชื่อใหม่ (ยังไม่ brainstorm)
5. **บอสโลก** (World Boss รวมรุ่น) — ค่อยมาออกแบบ

---

## 📝 อัปเดต session 22 ส.ค. 2026 (ล่าสุด)

**user สั่ง "อยากอัพเกรดระบบเกม"** → brainstorm แล้วแตกเป็น **3 โปรเจกต์ย่อย ทำเรียงกัน** (แต่ละอันมี spec+plan ของตัวเอง)

### 1. 🌱 ฟาร์มมีชีวิต — ✅ build 6 tasks + final review (opus) + fix wave + **push/deploy แล้ว** (`33c44b8`)
spec `docs/superpowers/specs/2026-08-22-farm-visual-life-design.md` · plan `docs/superpowers/plans/2026-08-22-farm-visual-life.md`
ของที่ได้ (ไม่แตะกลไกเกมเลย — ไม่แตะ `useFarm.js`/rules/schema):
- พืชเปลี่ยนภาพตามระยะการโต `stageEmoji()` ใน `data/crops.js` (pure + เทส 8 เคส) · override รายพืชด้วยฟิลด์ `stages`
- แปลงเป็นฉากดิน/ฟ้า เส้นขอบฟ้าที่ **42%** (เริ่มที่ 52% แล้วขยับ เพราะชื่อพืชสีขาวตกคร่อมเส้น → สระ/วรรณยุกต์อ่านไม่ออก)
- `utils/farmfx.js` — ชั้นเอฟเฟกต์ยิงของ A→B (WAAPI, **แปะที่ `body`** ตาม CLAUDE.md ข้อ 6, `z-index:250` = สูงกว่า nav 200 แต่ต่ำกว่าโมดัล) · ไม่แตะ `battlefx.js`
- ชิปเหรียญบนหัวฟาร์ม + `composables/useCountUp.js` (วิ่งเฉพาะตอนเพิ่ม, ค่าลดเปลี่ยนทันที)
- ⏳ **รอ user เทสจอจริง** (deploy ไปก่อนตามที่ user สั่ง) — จุดที่ต้องดู: ของลอยต้องอยู่**เหนือ** bottom-nav · โหมดลดการเคลื่อนไหวต้องได้ผลลัพธ์ครบ · จอ 320px + ฟอนต์ระบบใหญ่ กับชื่อพืชยาว
- 🔲 **ค้าง 1 จุด (parked, cosmetic):** `.plot.ready` ใน `FarmGrid.vue` ยังไม่มี `inset 0 -6px 10px -6px rgba(80,55,25,.35)` ในกฎ static → คนเปิด **reduced-motion** ไม่เห็นเงาดินในแปลงพร้อมเก็บ (keyframes `plotGlow` มีแล้ว) — เก็บรอบหน้า
- ⚠️ ผลข้างเคียงที่ตั้งใจ: ชื่อพืชยาวโดนตัดท้ายเป็น `…` บนจอแคบ (บังคับบรรทัดเดียวเพื่อกันหลุดขึ้นพื้นฟ้า)

### 2. 🛒 ออเดอร์ฟาร์ม — ✅ build เสร็จ + fix wave (final review) + **รอ user เทสจอจริง**
spec `docs/superpowers/specs/2026-08-22-farm-orders-design.md` · plan `docs/superpowers/plans/2026-08-22-farm-orders.md`
บอร์ด 5 ช่องในหน้าฟาร์ม เติมใบเองตามเวลา (ไม่รีเซ็ตรายวัน — ใบที่ยังไม่ส่งค้างอยู่ได้เรื่อยๆ ไม่ผูก `dailyQuest`
เพราะตอน brainstorm user ค้านดีไซน์รายวัน) ส่งพืชตามที่ขอ → เหรียญ · ปฏิเสธได้แต่รอนานกว่า · พ่วงกับดัก `cheatLogs`
(`utils/farmPlausibility.js`) ตรวจของที่มากเกินจะเป็นไปได้ ไม่แตะ `useFarm.js`/rules

**⚠️ เศรษฐกิจ (จำลอง 20,000 ใบที่ Lv.12 — ต้องคิดตอนจูน `cut margin ฟาร์ม` ที่ค้างด้านล่าง):**
- รางวัลต่อใบ: p10 2,280 · median 19,456 · p90 119,000 · สูงสุด 418,200
- ออเดอร์ **ไม่ใช่ faucet อิสระ** แต่เป็น **ตัวคูณบนผลผลิตที่มีอยู่แล้ว เพดาน 1.7×** (ต้องมีของจริงถึงส่งได้) ไม่บิดลำดับความคุ้มของพืช
- แต่เพดาน throughput 5 ช่อง/30 นาที = **240 ใบ/วัน** สูงกว่าที่ฟาร์มพืชยาวผลิตได้มาก → สายปลูกแล้วลืมยัดเข้าออเดอร์ได้เกือบ 100%
  = ได้ +70% แบบราบ (ตาราง 220,000/วัน ด้านล่าง → ประมาณ **374,000/วัน**) ส่วนพืชสั้น (ผักกาด 12 แปลง ≈ 3,456 ใบ/วัน)
  ยัดเข้าออเดอร์ได้แค่ ~1,920 ใบ/วัน → บัฟน้อยกว่ามาก **= ถ่างช่องว่างพืชยาว/สั้นให้กว้างขึ้น** ตรงข้ามกับปัญหาที่บันทึกไว้ใน ROADMAP เอง
- ปรับได้ที่ `REFILL_MS` บรรทัดเดียวใน `data/farmOrders.js`

### 3. 🍖 อาหารเพ็ท — (ยังไม่ brainstorm)
🔑 **ข้อสรุปสำคัญ: ไม่ต้องรอ P3 passive ถ้าเป็นบัฟรายได้ idle** — `utils/idleIncome.js` รับ `buffFrom/buffUntil/buffMult` เป็นช่วงเวลาอยู่แล้ว
⚠️ แต่รองรับ **บัฟตัวเดียว** (เควสรายวัน ×1.5) สแตกด้วยการต่อเวลา ไม่ใช่คูณซ้อน → ถ้าอาหารเป็นบัฟคนละคูณ ต้องขยายให้รับหลายช่วง (เขียนใส่สเปกตั้งแต่แรก)
ถ้าจะให้บัฟ **พลังต่อสู้** ต้องรอ P3 (`passiveOf()` ใน `data/index.js` ยังคืน `null` ทุกตัว) เพราะ P3 จะรื้อทีมบอทหอคอย 70+ ด้วย

**ตัดทิ้งจาก backlog ฟาร์มเดิม:** 🏭 โรงงานแปรรูป (idle ซ้อน idle จูน balance ยาก) · 🧪 ปรุงยา เลื่อนเป็นโปรเจกต์ใหญ่แยกรอบ
**user เกริ่นว่าจะทำรอบหลัง:** ตั้งชื่อพืชใหม่/รีไรท์ข้อความฟาร์ม · ฟาร์มเป็นฉากเดียวทั้งผืน (ตัวเลือก C ตอน brainstorm)

---

## 📝 อัปเดต session 9 ก.ค. 2026

**งานแทรก user สั่ง: จัดหมวดหน้า Play ใหม่ (hub 2 ชั้น) + ปลดแปลงฟาร์ม** — brainstorm เสร็จ
spec: `docs/superpowers/specs/2026-07-09-play-restructure-farm-plots-design.md`
- IA ใหม่: Play landing (การ์ดใหญ่ โหมดเพ็ท/โหมดฟาร์ม + section มินิเกม) → PetHubView (`/play/pets` รวมเกมใช้เพ็ท) + FarmView (`/play/farm` ฟาร์มเต็มหน้า) · ทุก view เกมเดิมไม่แตะ
- ฟาร์มปลดแปลง: เริ่ม 1 แปลง, ซื้อที่ร้านค้าฟาร์ม, ราคาแพงขึ้นเรื่อยๆ (ช่วงต้นถูก), เพดานตามเลเวลบ้าน · `farm.plotsUnlocked` default 1 → คนเก่ารีเซ็ตเหลือ 1 อัตโนมัติ (coin sink ใหม่)

### 🌱 Backlog: ต่อยอดระบบฟาร์ม (ยังไม่ brainstorm ละเอียด — user สั่งจดไว้ 9 ก.ค.)

> `farm.inventory` เป็น generic `{cropId:qty}` → เพิ่ม sink ใหม่ได้โดยไม่แตะ schema · ถึงเวลาค่อย brainstorm รายอันแบบละเอียด

1. **🧪 ปรุงยา / เภสัชกรรม (แนะนำทำก่อน)** — killer angle ตรงธีมเภสัช: เอาพืช(สมุนไพร 🌿/โสม 🪴/เห็ด 🍄)
   ไปปรุงเป็นยา/ผลิตภัณฑ์ (crafting: วัตถุดิบ + เวลา → ยาขายแพงกว่าพืชดิบ) · coin sink + แฝงความรู้ (ผูกชื่อยากับเนื้อหาเรียนได้)
2. **🍖 อาหารเพ็ท (เชื่อม 2 ระบบ)** — ตอนนี้ฟาร์ม↔เพ็ทแยกขาดกัน · เอาพืชทำอาหาร → เพ็ทกิน → buff ชั่วคราว
   (รายได้ idle / พลังต่อสู้) · ทำให้สายเพ็ท/ต่อสู้มีเหตุผลปลูกฟาร์ม · ⚠️ ระวัง balance ต่อสู้/economy
3. **🏭 โรงงาน/แปรรูป (idle production)** — เครื่องแปรรูปอัตโนมัติ ใส่พืช→รอ→ผลิตภัณฑ์ · sink (ซื้อ+อัปเครื่อง)
   ⚠️ ระวังซ้อนกับรายได้ idle บ้าน (idle-ซ้อน-idle จูน balance ยาก)
4. **🛒 ตลาด/ออเดอร์รายวัน** — ส่งพืชตามออเดอร์ → รางวัลก้อน · จูงใจปลูกหลากหลาย · ผูก daily quest ที่มีอยู่ได้

**ลำดับแนะนำ:** #1 ปรุงยา → #2 อาหารเพ็ท (สองอันนี้ทำให้ฟาร์มเป็นหัวใจกลางป้อนทั้งเภสัชกรรม+เพ็ท)

### 🎨 งานแทรก 10 ก.ค. — UI polish (pet/arena/battle) + Active team 3
spec `docs/superpowers/specs/2026-07-10-pet-arena-battle-polish-design.md` (brainstorm เสร็จ) — 4 อย่าง: (1) หน้า Pet declutter แบบ 7DS (ดาวเกรด+ขอบ rarity ถอด ATK/HP ไปดู detail) (2) พื้นหลังสนามธีมแยกโหมด Arena=โคลอสเซียม/Tower=หอคอย (prop theme) (3) เลข HP/ATK ในไฟต์ใหญ่ขึ้น (4) **Active team = 3 คงที่ทุกคน** ตัด battleSlots ออกจาก perk บ้าน (BATTLE_SLOTS=3, cap resolveBattleTeam, normalize slice 4→3)

### 🏯 Backlog: Tower (หอคอย) rework — user มีแผนรื้อ (10 ก.ค., ยังไม่ brainstorm)
ไว้ session ถัดไป · แยก brainstorm เอง · ปัจจุบัน tower ใช้ BattleReplay + useTower + towerFloors + bonus ladder (ดู economy-battle-master-plan §4)

---

## 📝 อัปเดต session 3–4 ก.ค. 2026

- **คิว #1 Peer Review + workflow v2** ✅ deploy — ดู memory `rxtu10_backlog_2026-06-29` (10 จุด code-review + 5 tasks v2) · **user ต้องกดซิงก์ใน Admin ก่อนเทส**
- **คิว #2 Battle UI clarity** ✅ deploy (plan `docs/superpowers/plans/2026-07-03-battle-ui-clarity.md`, 5 tasks + final review ผ่าน) · แก้ตามด้วย: ปุ่มปิดตอน peek สนาม
- **Nav: ย้าย Study ไปกลาง + วงกลมลอยเน้นเรียน** ✅ deploy (spec `2026-07-03-study-center-nav-design.md`)
- **งานแทรก user สั่ง 4 ก.ค. ✅ deploy ครบ 4:**
  1. Battle: เพิ่มปุ่มปิดตอน peek สนามหลังจบ
  2. Quiz: แบนเนอร์แจ้ง "ข้อสอบนำเข้าจากคลังเก่า รอทีมวิชาการตรวจ" (blanket, `.qv-notice` — ลบเมื่อมีข้อผ่านตรวจ)
  3. **Daily quest rework**: quiz5/study5/gacha1 → **quiz5/ปลูกพืช3/กาชา2** · รางวัลคง buff ×1.5 + **ตั๋ว 1→3 ใบ** (field `dailyQuest.farm` แทน study)
  4. **Admin econ editor**: ปุ่ม 💰 รายคนใน AdminView ปรับ **เหรียญ + เลเวลบ้าน** (rules `isAdmin()` อนุญาตอยู่แล้ว) — แอดมินไว้ลดเลเวลบ้านตัวเองตอนเปิดเซิฟ

---

## ⏭️ ถัดไป (คิว session หน้า — บันทึก 24 มิ.ย. 2026) — ⚠️ SUPERSEDED โดยคิว 29 มิ.ย. ด้านบน

> ส่วนใหญ่ทำเสร็จแล้ว: อนิเมชันหอคอย ✅ (battle overhaul + battle UI clarity) · Expedition ✅ deploy 27 มิ.ย. · เก็บไว้อ้างอิง + 2 TODO ที่ยังค้าง:
> 1. 🚨 **บั๊กล็อกอินมือถือ** — user ยังไม่ได้มาแจ้งอาการ (ถ้ามีปัญหาค่อยว่ากัน) · กับดักเดิม: `signInWithPopup` ทุกอุปกรณ์ + Firestore force long-polling อย่า revert (CLAUDE.md ข้อ 1–2)
> 2. **RESET ชั้นหอคอยทุกคน** (`towerFloor`→1, `towerBest`→0) ตอนเปิดเซิฟ — ยังไม่ทำ · ตอนนี้มีปุ่มปรับรายคนใน Admin แล้ว แต่ยังไม่มี bulk reset (ทำ migration/one-time flag ตอนเปิด)

---

## 🐞 บั๊กที่รู้แล้ว / ต้องกลับมาแก้

> รายงานโดย user 16 มิ.ย. 2026 — ยังไม่ได้แก้ บันทึกไว้กันลืม

1. **อีโมจิยังเป็นสี่เหลี่ยม (tofu) บางจุด** — พบที่ **"เก็บเหรียญรายวัน"** (Home / `useDaily`) — ✅ เสร็จ (16 มิ.ย.)
   root cause: emoji ฝังใน **JS expression** (mustache ternary / toast string) จึงถูก codemod `<Emoji>` ข้าม → ฟอนต์ระบบ → tofu
   แก้: `DailyCard.vue` ปุ่ม `เก็บ +X🪙` + `⚠️ เต็มแล้ว` ย้ายเป็น `v-if/v-else` + `<Emoji>` · `useDaily.js` toast เปลี่ยน 🪙 → คำว่า "เหรียญ" (toast เป็น plain text ฝัง `<Emoji>` ไม่ได้)
2. **ฟาร์ม: ปลูกพืชแล้วเลื่อนลงมาดูผลผลิตไม่ได้** — โมดัลฟาร์ม scroll ลงไม่สุด เห็นผลผลิตไม่ครบ — ✅ **เสร็จจริง 17 มิ.ย.** (Teleport, commit 389540e · user ยืนยันหาย)
   ⚠️ **root cause จริง = stacking context trap:** `#main-content` เป็น `position:fixed` → สร้าง stacking context → `.farm-ov` (modal ใน PlayView) ถูกขังในนั้น z-index:400 สู้ `#bottom-nav` (z200) ที่ root **ไม่ได้** → nav ทับก้น sheet (เป็นทั้งคอม+มือถือ ไม่ใช่ mobile-only)
   **fix จริง:** `<Teleport to="body">` ครอบ `.farm-ov` → ย้ายไประดับ root เหมือน ConfirmModal → z-index มีผล nav ไม่ทับ (แถม fix `SeedPicker` `.sp-ov` ที่ติดกับดักเดียวกันด้วย)
   ❌ ความพยายามที่ไม่ได้ผล (เก็บไว้กันทำซ้ำ): z-index 200→400/410 (16 มิ.ย.) + `vh`→`dvh` (17 มิ.ย.) — แก้ไม่ตรงต้นเหตุทั้งคู่ (z-index ใช้ไม่ได้เพราะถูกขังใน stacking context · dvh = red herring จากการเทียบกับ sheet exp/forge/tower/pvp ที่จริงๆ ยังไม่มีใครใช้)
   📌 **บทเรียน: modal/sheet ที่ render ใน view (ใต้ `#main-content` position:fixed) ต้อง `<Teleport to="body">` เสมอ — โปรเจกต์นี้เดิมไม่มี Teleport เลย, modal ที่ work (Confirm/Help) อยู่ใน `App.vue` ระดับ root ทั้งหมด** · follow-up: `.slide-panel` (z400 ใน view) + modal อื่นในอนาคต น่าจะติดกับดักเดียวกัน

3. **อีโมจิ tofu ในฟาร์ม toast** — เห็นตอน**ขายพืชผล** (และปลูก/เก็บเกี่ยว) — 🔲 **ยังไม่แก้** (พบ 17 มิ.ย.)
   root cause: `composables/useFarm.js` toast ฝัง `🪙` + `crop.emoji` ใน **JS string** (บรรทัด 65/70/83/96/107) → toast เป็น plain text ฝัง `<Emoji>` ไม่ได้ → ฟอนต์ระบบ → tofu (คลาสเดียวกับข้อ 1)
   fix: `🪙`→คำว่า "เหรียญ" + เอา `crop.emoji` ออก (เหลือชื่อพืช) ในทุก toast ของ useFarm
4. **อีโมจิ tofu ในกระดานข่าว** — ข้อความข่าว (`n.msg` ที่ admin พิมพ์) ที่มี emoji — 🔲 **ยังไม่แก้** (พบ 17 มิ.ย.)
   root cause: `NewsBoard.vue` render `{{ n.msg }}` เป็น text ตรงๆ (ไอคอน `n.icon` ผ่าน `<Emoji>` แล้ว แต่ตัวข้อความไม่ได้) → emoji ในข้อความ dynamic = ฟอนต์ระบบ = tofu
   fix: (a) ง่ายสุด — ล้างข่าวเก่า/เลี่ยงใส่ emoji ในเนื้อข่าว · (b) ใหญ่กว่า — render ข้อความ dynamic ผ่าน emoji-aware parser (แตก text → `<Emoji>` ราย codepoint)

---

## 📝 อัปเดต session 17 มิ.ย. 2026

- **Economy Step 1 — spec + plan พร้อมแล้ว** (commit e9cfa6c): `docs/superpowers/specs/2026-06-17-economy-step1-design.md` + `docs/superpowers/plans/2026-06-17-economy-step1.md` (8 tasks TDD, โค้ดจริงครบ)
  → chunk แรกของ `docs/economy-battle-master-plan.md`: **cut margin ฟาร์ม** (margin-scale + sim, ไม่ใช่ cut sellPrice ตรงๆ) + **daily quest** (แต้มเรียน SRS+quiz ≥15/วัน → ปลด **×1.25 idle** บ้าน+เพ็ท จนถึง reset) · ไม่แตะ rules
  ⚠️ **sim รอบหน้าต้องรวมตัวคูณจากออเดอร์ฟาร์ม (session 22 ส.ค. ด้านล่าง) ด้วย** — พืชยาวได้ +70% แบบราบจากออเดอร์ ตัวเลข 220,000/วัน ในตารางด้านล่างยังไม่รวม
  → ⏳ **build = post-launch (defer)** ตาม Phase 3 · 3 หมุด cross-cutting (หอคอย/เกรด 12-8/battle numbers) parked ไป spec Step 2-3
- **กระดานข่าวย้าย Home → Play** (commit 9652c7f): collapsed บรรทัดล่าสุด → กด accordion กาง log พร้อมเวลา · ซ่อนถ้าไม่มีข่าว · ลบจาก Home
- **บั๊กฟาร์มเลื่อนไม่สุด** → ✅ (ดู 🐞 ข้อ 2 ด้านบน)

---

## 🔴 Phase 0 — ก่อนเปิดตัว (บล็อกการ launch ทั้งหมด)

> ✅ **โค้ดเสร็จครบทั้ง 5 ข้อแล้ว (15 มิ.ย. 2026)** — build ผ่าน
> ⚠️ **เหลือ deploy เท่านั้น:** `npm run build && firebase deploy --only hosting,firestore:rules`
> (rules เปลี่ยน: เพิ่ม `config/{doc}`, examSessions create-only, ลบ srsCards — **ต้อง deploy ไม่งั้น launch toggle ใช้ไม่ได้**)
> หลัง deploy → เปิดเว็บจริงด้วยปุ่ม 🚀 ในแท็บ Admin (ไม่ต้อง deploy ซ้ำ)

### 1. Nav ของนักศึกษาผิด — ✅ เสร็จ (`App.vue`: `:to` แยกตาม `isAcademic`)
Bottom nav มีปุ่ม "📝 ข้อสอบ" ชี้ไป `/questions` ซึ่งเป็นหน้าจัดการคลังข้อสอบ
(นักศึกษาเข้าแล้วเจอ "เฉพาะแอดมินหรือทีมวิชาการเท่านั้น")
→ แยกเงื่อนไข: นักศึกษาเห็นปุ่มไป `/quiz`, ทีมวิชาการเห็น `/questions`

### 2. บั๊ก UI: ปุ่มลัดหน้า Home มองไม่เห็น — ✅ เสร็จ (`HomeView`: `.hs-label/.hs-sub` → var สีธีม, การ์ดพื้น #fff)
`.hs-label` ใช้ `color:#fff` บนพื้นหลัง `rgba(255,255,255,.06)` — ธีมแอพเป็นพื้นสว่าง
ตัวหนังสือขาวบนพื้นขาว มาจากธีมมืดเวอร์ชันเก่า → เปลี่ยนเป็น `var(--text)` + พื้น `#fff`

### 3. ย้าย launch gate จาก hardcode ไป Firestore — ✅ เสร็จ (`composables/useAppConfig.js` + toggle ใน Admin)
ตอนนี้ gate อยู่ใน `App.vue` (`v-else-if="authStore.isAcademic"`) เปิดตัวต้อง deploy ใหม่
→ สร้าง doc `config/app { maintenance: true/false }` + onSnapshot → เปิด/ปิดได้ทันทีจาก Admin

### 4. ปิดช่องโหว่เหรียญ: ฝึกอิสระ (Study) ฟาร์มเหรียญได้ไม่จำกัด — ✅ เสร็จ (cap 150/วัน + ฟิลด์ studyCoinDate/studyCoinsToday)
`grade()` ให้ 5🪙/ใบ ทุก session ใหม่ → กด "ฝึกอิสระ" วนได้เรื่อยๆ (100🪙/รอบ ไม่มีเพดาน)
→ ใส่ daily cap แบบเดียวกับ Quiz (เช่น studyCoinsToday ≤ 150/วัน)

### 5. Quiz: สลับตำแหน่งตัวเลือก — ✅ เสร็จ (`shuffleChoices()` remap index เฉลย ตอน start())
เฉลยอยู่ตัวอักษรเดิมเสมอ ทำซ้ำ = จำตัวอักษรไม่ใช่เนื้อหา → shuffle choices ตอน start()

### 6. งานที่ค้างจากรอบก่อน (ทำแล้ว รอ deploy)
- [x] login มือถือ redirect / long-polling / hosting config / rules news — push แล้ว
- [ ] `firebase deploy --only firestore:rules` (⚠️ ยังไม่ได้รัน — บล็อก launch toggle)
- [x] rules `examSessions` → create-only (ตัด update/delete) — แก้แล้ว รอ deploy
- [x] ลบ rules `srsCards` subcollection ที่ไม่ได้ใช้ — แก้แล้ว รอ deploy

---

## 🟠 Phase 1 — สัปดาห์เปิดตัว

1. **ทีมวิชาการกรอกคลังข้อสอบ** — ระบบพร้อมแล้ว เริ่มได้ทันที (เป้า ≥50 ข้อ ก่อนเปิด)
   → หมวด **`domain` = Care / Sci / Law** (หมวดใหญ่ fixed 3) + `category` (หัวข้อย่อย) → dropdown + ฝึกเฉพาะหมวด · ดู `docs/cowork-question-import.md`
2. **หน้าประวัติการทำข้อสอบ (ส่วนตัว 🔒)** — `examSessions` per-user · เห็นแค่ของตัวเอง
   แสดง: คะแนนล่าสุด, กราฟพัฒนาการ, สถิติราย domain (Care/Sci/Law) → กลับมาซ้อมซ้ำ
   ⚠️ **ไม่มี ranking คะแนนสอบ** — รักษา privacy การฝึก (การฝึกข้อสอบเป็นเรื่องส่วนตัว)
3. **ซ่อน board ที่ยังไม่มีข้อมูล** (PvP/หอคอย โชว์ 0 ดูเหมือนเว็บพัง) — **ไม่ทำ rank board ข้อสอบ** (privacy)
4. **นับถอยหลังสอบบน Home** — มี `PLE_CC_DATE` (11 ธ.ค. 2026) ใน config อยู่แล้วแต่ไม่ได้ใช้
   → ดูรายละเอียด UI ใน **🏠 หน้าหลัก: ภาพรวมวันนี้** ด้านล่าง
5. **เอา "วิธีเล่น" (guide รวม) ออกก่อน → แทนด้วยปุ่ม `?` อธิบายราย feature (contextual help)**
   - สร้าง `<HelpButton>` (`?`) เปิด popover/modal คำอธิบาย**เฉพาะจุดนั้น**
   - วางปุ่ม `?` ตามแต่ละฟีเจอร์: ที่อยู่อาศัย (กดดูจาก Home), ฟาร์ม, Study, Quiz, Shop/กาชา, เพ็ท ฯลฯ
   - เนื้อหาเก็บเป็น data ราย feature · เช่น **ที่อยู่อาศัย** กด `?` → อธิบาย + **ตารางแต่ละระดับพร้อมรายได้** (ดึงจาก `data/residence.js`)
   - ข้อดี: อธิบายตรงจุดตอนผู้ใช้สงสัยพอดี + เลี่ยง copy เก่าที่ผิด (เช่น "ปราสาท 12 ขั้น" ที่จริงคือเกาะส่วนตัว)
6. **เอา rank ออกจากหน้า Home** — ลบทางลัด/วิดเจ็ต "🏆 Rank" ใน `HomeView` (`home-shortcuts`)
   ให้สอดคล้องนโยบาย privacy (ไม่โชว์อันดับการฝึก) · เหลือทางลัด Shop / Pets / Study-Quiz
7. **หน้า Members: เพิ่มการจัดเรียง** (`MembersView`)
   - **default = เรียงตามรหัส นศ. น้อย→มาก**
   - **การ์ดของเจ้าของแอคเค้าปักหมุดช่องแรกสุดเสมอ** (ไม่ว่าเลือกเรียงแบบไหน)
   - เพิ่ม dropdown เลือกการเรียง (รหัส / ชื่อ / เลเวล ฯลฯ)

---

## 🟡 Phase 2 — ระบบเตรียมสอบเชิงลึก (จุดขายหลักของแอพ)

1. **ข้อที่ตอบผิด → เข้า SRS อัตโนมัติ** — เชื่อม Quiz กับ Study เป็น loop เดียว:
   ทำข้อสอบ → ผิดข้อไหน ระบบจำ → โผล่ในรอบทบทวนจน "แม่น"
2. **โหมดทบทวนเฉพาะหมวด** ใน Study (ตอนนี้ deck รวม 78 ตัวยาก้อนเดียว เลือกหมวดไม่ได้)
3. **Daily quest ผูกเหรียญกับการเรียน** (ดู Economy ด้านล่าง) — เช่น
   "ทบทวนครบโควต้าวันนี้ → รายได้บ้าน +25% เป็นเวลา 24 ชม."
   ให้การเรียนเป็น "ตัวคูณ" ของเกม แทนที่จะแข่งแจกเหรียญตรงๆ (คุมเงินเฟ้อได้)
   → UI แสดงผลอยู่ใน **🏠 หน้าหลัก: ภาพรวมวันนี้** ด้านล่าง
4. **Streak การทบทวน** — แสดงไฟ 🔥 ติดต่อกันกี่วัน (กลไกเดียวที่พิสูจน์แล้วว่าคนกลับมาทุกวัน)
   → UI แสดงผลอยู่ใน **🏠 หน้าหลัก: ภาพรวมวันนี้** ด้านล่าง
5. **Daily Quiz (kahoot 5 ข้อ/วัน) — โชว์คะแนน/leaderboard ได้** ← ข้อยกเว้นเดียวจากนโยบาย privacy
   ทุกคนทำชุดเดียวกันต่อวัน · ให้คะแนนตาม ถูก+เร็ว · รีเซ็ตรายวัน · ผูกกับ daily quest
   = ชาเลนจ์รายวัน competitive (ต่างจากการฝึกส่วนตัวที่ไม่โชว์คะแนน) · hook รายวันที่ดี

---

## 🟢 Phase 3 — ยกเครื่องใหญ่: เกม + เศรษฐกิจ + สังคม (post-launch)

> 🔑 **ทำหลังเปิดตัว ไม่ใช่ก่อน** — เหตุผล: คุณค่าหลัก = ระบบติว (เกือบพร้อม) ต้องส่งให้ทันก่อนสอบ PLE
> (11 ธ.ค. 2026 เหลือ ~6 เดือน) · rework ใหญ่+เสี่ยง ต้องจูนด้วย user จริง · เปิดก่อน = ได้ feedback + โมเมนตัม ·
> รื้อตอนคนเล่นยังน้อย = migrate ถูก · **อย่าเปิดระบบใหม่ที่ทำครึ่งๆ** (battle/ทัวร์/บอส) ปล่อยตอนเสร็จ ·
> เพ็ท/ฟาร์มเดิมเปิดไปได้เลย

**spec เต็ม → `docs/economy-battle-master-plan.md`** · ลำดับสร้าง:

1. **เศรษฐกิจสกุลเดียว** — cap ฟาร์ม + daily quest ปลดตัวคูณ ×1.25 (ฐาน)
2. **Pet roster rework (27 ตัว)** + **กาชา rework** (1,000/จุ่ม · 10 แถม 1 · dupe→เกรด · pity)
3. **Battle engine (brawl) + passive (signature 27 ตัว) + หอคอย (PvE)**
4. **Expedition** (ส่งเพ็ทผจญภัย — ป้อนตั๋วระบบอื่น)
5. **Weekly Tournament + World Boss (co-op) + cosmetic/badge** — event สลับสัปดาห์
6. **Potential affix + ตลาด (market)** — endgame

> เครื่องมือจูน: `scripts/battle-sim.mjs` + `scripts/battle-passive-test.mjs` (รันก่อน lock ตัวเลข)

---

## 🏠 หน้าหลัก: ภาพรวมวันนี้

> ปรับ mindset Home จาก "รวมทางลัด" → "ตอบคำถาม วันนี้ฉันควรทำอะไร?" ใน 5 วินาที

**เลย์เอาต์ใหม่ (บนลงล่าง):**

### ① นับถอยหลัง PLE CC — ✅ ทำได้ทันที
- ใช้ `PLE_CC_DATE = '2026-12-11T00:00:00+07:00'` ใน `src/firebase/config.js` render "เหลืออีก X วัน" ตัวเลขใหญ่บนสุด
- เป้าหมายร่วมของทั้งชั้นปี ทำให้ทุกคนรู้สึกว่าเวลาเหลือน้อย
- *(รวม Phase 1 ข้อ 4 มาอยู่ที่นี่)*

### ② งานวันนี้ของฉัน

| Widget | พร้อม? | รายละเอียด |
|---|---|---|
| 📚 การ์ด SRS ครบกำหนด X ใบ | ✅ ทันที | ดึงจาก `userData.study.cards` — `nextReviewDate <= Date.now()` (pattern จาก `StudyView.vue:129`) |
| 🔥 Streak กี่วันติด | ⏳ schema | เพิ่ม `study.lastStudied` ใน `src/data/userSchema.js` + update ใน StudyView ทุก grade |
| ⚡ Daily quest buff | ⏳ Phase 2.3 | รอระบบ daily quest (Phase 2 ข้อ 3) |
| 🎓 ปุ่มจัดการยา/ข้อสอบ | ✅ ทันที | เห็นเฉพาะ `auth.isAcademic` — link ไป `/questions` (ข้อสอบ) + deck management (ยา) |

*(รวม Phase 2 ข้อ 3 และ 4 มาอ้างอิงที่นี่)*

### ③ อีเวนต์/ความเคลื่อนไหวกลุ่ม (ยกระดับ NewsBoard)

ปัจจุบัน `news` collection มี `{ id, msg, icon?, ts }` — เพียงพอสำหรับประกาศธรรมดา

| การเปลี่ยนแปลง | พร้อม? | หมายเหตุ |
|---|---|---|
| เพิ่ม `type` field (`announce` / `event` / `achievement`) | ✅ ทันที | backward-compatible, `NewsBoard.vue:28` |
| Admin โพสต์ event (เปิดชุดข้อสอบใหม่, เหรียญ x2 สุดสัปดาห์) | ✅ ทันที | เพิ่ม dropdown type ใน AdminView |
| auto-post เมื่อคนขึ้นอันดับ | ⏳ รอหลังเปิด | ต้องการ client trigger |

### ④ ทางลัด
ของเดิม — จัดลำดับใหม่ให้ Study/Quiz ขึ้นก่อน (core loop ของแอพ)

**ลำดับการพัฒนา:**
```
ทำได้เลย    : ① countdown + ② SRS due count + ② academic button + ③ event type + admin post
รอ Phase 2  : ② streak (schema เล็กน้อย) + daily quest buff
รอหลังเปิด  : ③ auto-post achievement
```

---

## 🎰 Gacha ใหม่ (Genshin-style) — แทนระบบไข่

> ⚠️ **SUPERSEDED** → เวอร์ชันล่าสุด `docs/economy-battle-master-plan.md` §2 (กาชา **1,000/จุ่ม · 10 แถม 1** เดิม 8,000) · บล็อกนี้เก็บไว้อ้างอิงเฉยๆ

**ทำไมเปลี่ยน:** ระบบไข่ปัจจุบัน = "เลือก tier จ่ายเงิน" ขาดความตื่นเต้นและการวางแผน
Gacha + pity → ผู้เล่นรู้สึกว่าพยายามแล้วต้องได้ มีเป้าหมายที่ชัดเจน

### สิ่งที่ต้องทำ

1. **ลบระบบไข่เดิม** — `userSchema.js` ลบ `eggs: []`, ลบ egg UI ใน `ShopView.vue`
   (ปัจจุบัน eggs array ไม่ได้ใช้งานจริง — `rollPetFromEgg` สร้าง pet โดยตรง)
2. **Banner system** — featured pet หมุนเวียน ตั้งจาก admin หรือ config
   - เพิ่ม `gachaFeaturedId` ใน `src/firebase/config.js`
   - เพิ่ม `gachaPity: { standard: 0, featured: 0 }` ใน `src/data/userSchema.js`
3. **Pity mechanic**
   - Soft pity ~75 pulls: rate legendary เริ่มเพิ่มขึ้นแบบ step
   - Hard pity 100 pulls: การันตี legendary (featured มี 50/50 → guaranteed ครั้งถัดไป)
4. **Pull modes**
   - Single pull ~8,000 🪙 (เทียบ gold egg เดิม)
   - 10-pull ~72,000 🪙 (discount 10%) + การันตี rare ขึ้นไปอย่างน้อย 1 ใบ
5. **Rate pools**
   - Standard banner: rate เดิมจาก gold egg (common 0%, rare 28%, epic 52%, legendary 20%)
   - Featured banner: legendary up-rate ตัวที่เลือก, pity counter แยกจาก standard
6. **Animation**
   - Reveal ทีละใบ (10-pull) พร้อม delay แบบ Genshin
   - Star burst effect + shake เมื่อออก epic/legendary
   - ใช้ CSS `@keyframes` + JS delay — ไม่จำเป็นต้องมี 3D library

---

## ⚔️ Battle System Rework (ทีมเพ็ทสู้พร้อมกัน — Auto-resolve)

> ⚠️ **SUPERSEDED** → `docs/economy-battle-master-plan.md` §5 (โมเดล brawl + sim + passive · เลิกใช้ speed/cooldown, ใช้ลำดับสุ่ม) · บล็อกนี้เก็บไว้อ้างอิง

*(รวม/แทนที่ Phase 3 ข้อ 1)*

**แนวทาง: async team-auto-battle** (client-only ทำได้ ไม่ใช่ real-time)
- ผู้เล่นตั้งทีม 3–4 เพ็ท (ตามเลเวลบ้าน — `activePets` มีใน user doc แล้ว)
- กด "สู้" → engine resolve battle ฝั่ง client → animate ผลการสู้ (fast-forward ได้)
- เพ็ทในทีมโจมตีพร้อมกันตาม speed/cooldown (ไม่ใช่ turn-by-turn แบบเก่า)

### Engine ที่ต้องสร้าง

1. **`utils/battleEngine.js`**
   - Damage calc: ATK × element multiplier × crit roll (crit rate/dmg มีใน potential แล้ว)
   - Element: ✊✌️✋ มีใน `data/index.js` พร้อม advantage table
   - Lifesteal, Dodge — ใช้ค่าจาก potential affixes
2. **`data/towerFloors.js`** — bot team config ต่อชั้น (หรือ procedural gen จาก floor number)
3. **PvP async** — snapshot ทีม user เก็บใน Firestore → ดึง opponent snapshot มา resolve client-side

### Field ที่ต้องเพิ่มใน userSchema

- `pvpRecord: { wins, losses }` (`pvpVictories` มีอยู่แล้ว แต่ขาด losses)
- `lastPvpAt: null` (cooldown กัน spam)

---

## 🏯 Tower Rework (AFK Arena — ชั้นหอคอย = รายได้ประจำวัน)

> ⚠️ **SUPERSEDED** → `docs/economy-battle-master-plan.md` §4 · บล็อกนี้เก็บไว้อ้างอิง (bonus ladder ยังใช้ได้)

*(รวม/แทนที่ส่วน tower ใน Phase 3)*

**แนวคิด:** `towerBest` → บวก flat coins ต่อวันแทนรางวัลครั้งเดียวต่อด่าน
ยิ่งดันสูง ยิ่งรวยเร็วตลอดไป — tower เป็น "passive investment" ระยะยาว

### Bonus ladder (tunable ใน `data/towerBonus.js`)

| Tower Floor | Bonus รายวัน |
|---|---|
| 1–9 | +0 🪙 |
| 10–19 | +500 🪙 |
| 20–29 | +1,500 🪙 |
| 30–49 | +4,000 🪙 |
| 50–74 | +10,000 🪙 |
| 75+ | +20,000 🪙 |

*(floor 30 ≈ รายได้บ้าน Lv6 ตั้งใจให้สมดุล — ปรับตัวเลขที่ `data/towerBonus.js`)*

### สิ่งที่ต้องสร้าง

1. **`data/towerBonus.js`** — `export function getTowerBonus(floor)` คืน flat coins/วัน
2. แก้ **`src/composables/useDaily.js`** — `baseIncome += getTowerBonus(userData.towerBest)`
3. ลบ fixed coin reward ต่อ floor ออก (ถ้ามี) → ใช้ bonus ladder แทน
4. **`data/towerFloors.js`** — bot team config ต่อชั้น (ใช้ร่วมกับ Battle Engine)

---

## 💰 Coin Economy — วิเคราะห์และข้อเสนอ

> ⚠️ **SUPERSEDED** → `docs/economy-battle-master-plan.md` §1 (เศรษฐกิจสกุลเดียว + cap ฟาร์ม + daily quest ×1.25) · ตาราง/วิเคราะห์ด้านล่างยังใช้อ้างอิงปัญหาเดิมได้

### ตัวเลขปัจจุบัน (ต่อวัน)

| แหล่งรายได้ | Lv2 | Lv6 | Lv12 |
|---|---|---|---|
| บ้าน (idle) | 600 | 5,000 | 55,000 |
| ฟาร์มพืชยาว เต็มแปลง¹ | **15,000** | **34,600** | **220,000** (~374,000 ถ้ายัดเข้าออเดอร์ฟาร์มด้วย — ดู session 22 ส.ค.) |
| เพ็ทเต็มคลัง (ประมาณ) | ~500 | ~3,000 | ~40,000 |
| Quiz (cap) | 300 | 300 | 300 |
| Study | ไม่จำกัด⚠️ | ไม่จำกัด⚠️ | ไม่จำกัด⚠️ |

¹ มันฝรั่ง 3,000/แปลง/วัน ×5 แปลง · แตงโม 4,333 ×8 · ทานตะวัน 16,000 ×12

### ปัญหา

1. **ฟาร์มกินทุกอย่าง** — พืชยาว (ปลูกแล้วลืม) ให้รายได้ 7–25 เท่าของบ้านที่เลเวลเดียวกัน
   ทำให้ "อัปบ้านเพื่อรายได้" ที่เป็น pitch หลักแทบไม่มีความหมาย คนอัปบ้านเพราะอยากได้แปลงเพิ่ม
2. **รายได้จากการเรียน ≈ 1% ของรายได้เกม** — Quiz cap 300 เทียบฟาร์มหลักหมื่น
   ไม่มีแรงจูงใจทางเศรษฐกิจให้เข้าหน้า Study/Quiz เลย ทั้งที่เป็นเป้าหมายหลักของแอพ
3. **ช่องโหว่ฝึกอิสระ** (Phase 0 ข้อ 4)

### ข้อเสนอปรับ (เลือกใช้ได้)

- **ลด sellPrice พืชยาว ~50–60%** ให้พืชยาวเต็มแปลง ≈ 1–1.5 เท่าของรายได้บ้าน
  (มันฝรั่ง 4200→2400, แตงโม 9000→5500, ฟักทอง 20000→12000, ทานตะวัน 22000→11000,
  ต้นไม้เงินตรา 70000→40000) — พืชสั้นคงเดิม (เป็นรางวัล active play อยู่แล้ว)
- **การเรียนให้ "buff" ไม่ใช่เหรียญดิบ** — ทบทวน SRS ครบ + quiz ≥10 ข้อ → daily income ×1.25 (24 ชม.)
  สเกลตามเลเวลอัตโนมัติ ไม่ inflate เศรษฐกิจ และทำให้คนเก่งเกม = คนที่เรียนสม่ำเสมอ
- เพดาน Study 150/วัน + เพดาน Quiz คงไว้ 300 (เหรียญจากการเรียนเป็น bonus ไม่ใช่รายได้หลัก)
- ราคาบ้าน/ไข่/ศักยภาพ **เหมาะสมแล้ว** ไม่ต้องแตะ (ladder ถึง Lv12 = 1.42M,
  legendary เกรดสูงสุด ≈ 1M — เป็น sink ระยะยาวที่ดี)

### Pacing โดยประมาณหลังปรับ
เปิดเทอม → Lv6 ใน ~2 สัปดาห์ → Lv12 ใน ~2–2.5 เดือน (เล่นสม่ำเสมอ) — พอดีกับหนึ่งเทอม

---

## 🎨 UX/UI Polish (ทำแทรกได้เรื่อยๆ)

1. **ธีมไม่เป็นเอกภาพ** — `style.css` เป็น indigo material (#4f46e5) แต่ Home/Shop ใช้
   ลาเวนเดอร์-ชมพู (#b58df1, #c4a5f5→#f7a8c4), Rank ใช้ slate (#1e293b), Quiz ใช้ indigo
   → เลือกหนึ่งโทน ประกาศเป็น CSS vars แล้วไล่แทนที่ gradient/สีที่ hardcode ทีละหน้า
2. **ฟอนต์เล็กเกินบนมือถือ** — มี .56–.64rem หลายจุด (≈9–10px) → ขั้นต่ำ .7rem
   และปุ่มเล็กสุด 28px → ขั้นต่ำ ~40px (touch target)
3. **PWA** — เพิ่ม manifest + ไอคอน + theme-color ให้ "Add to Home Screen" ได้สวยๆ
   (นักศึกษาใช้มือถือเป็นหลัก ตอนนี้ index.html ไม่มี manifest เลย)
4. PetDetailModal โชว์ ATK/HP/Crit แต่ระบบสู้ยังไม่มา → ติดป้าย "ใช้ในโหมดสู้ เร็วๆ นี้"
5. MaintenanceScreen → ใส่ตัวนับถอยหลังวันเปิดตัว สร้างกระแสก่อน launch

---

## ลำดับแนะนำ (สรุปสั้น)

```
สัปดาห์นี้   : Phase 0 ทั้งหมด (≈ 1-2 วันโค้ด) + ทีมวิชาการเริ่มกรอกข้อสอบ
สัปดาห์หน้า : Phase 1 (ประวัติคะแนน, rank ข้อสอบ, countdown) → เปิดตัว 🚀  ← ส่งระบบติวให้ทันก่อนสอบ
หลังเปิดตัว : Phase 2 (SRS↔Quiz loop, daily quest, streak)
rework ใหญ่ : Phase 3 = ยกเครื่องเกม+เศรษฐกิจ+สังคม (ดู master plan) — ทำเป็นอัปเดตก้อนใหญ่หลังเปิด ไม่ใช่ก่อน
แทรกได้     : polish ธีม/PWA
```

> 💡 **ทำไม Phase 3 ถึงไว้หลังเปิด ไม่ใช่ก่อน:** คุณค่าหลัก = ระบบติว ต้องส่งให้ทันก่อนสอบ PLE (เหลือ ~6 เดือน) · rework ใหญ่ต้องจูนด้วย user จริง + ได้ feedback ก่อน · รื้อตอนคนยังน้อย = migrate ถูก · เปิดก่อน = โมเมนตัม (กันโปรเจคไม่คลอด)
