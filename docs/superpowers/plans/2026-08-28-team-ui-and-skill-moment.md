# แผน implement สเปก A + C — UI จัดทีม/เพ็ท/อันดับหอคอย + โมเมนต์สกิล

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans

**Goal:** แก้ UI จัดทีมที่กดแล้วงง · ยกทักษะขึ้นบนหน้าข้อมูลเพ็ท · ทำอันดับหอคอยให้เห็นทุกคน · เปลี่ยนคำเรียกเป็น "สาย" (จู่โจม/สมดุล/พิทักษ์) · ให้ passive มีจังหวะให้อ่านในหน้าต่อสู้

**Architecture:** ตรรกะใหม่ทุกก้อนออกเป็น pure function ที่เทสด้วย `node --test` ได้ (`teamSlots.js` · `towerRivals.js` · `battleBeats.js`) แล้ว component เหลือแค่ผูกสาย ไม่แตะ engine / Firestore / rules / สคีมา

**Tech Stack:** Vue 3 SFC + scoped style · Pinia · `node --test` สำหรับ pure utils · `npm run build` เป็นด่านตรวจ

สเปก: [A](../specs/2026-08-28-team-pet-tower-ui-design.md) · [C](../specs/2026-08-28-skill-moment-design.md)

## Global Constraints

- ฟอนต์ห้ามต่ำกว่า `.7rem` — ตรวจ `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/` ต้องไม่เจอ
- overlay/modal/sheet `position:fixed` ใต้ `<RouterView>` ต้อง `<Teleport to="body">` เสมอ (CLAUDE.md ข้อ 6)
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น
- ห้ามแก้ `data/drugs.js` (มี "ธาตุเหล็ก" ที่เป็นเนื้อหายา) — ห้าม sed คำว่า "ธาตุ" ทั้งโปรเจกต์
- ห้ามแตะ `TIER_TIMING` ของหมัด (chip/solid/heavy/finish) — style A ที่ user สั่งคาไว้
- ห้ามใช้ `backdrop-filter` / `filter: blur()` (iOS Safari paint)
- คีย์ภายใน `fist/scissors/paper`, `ELEMENTS`, `EL_NAME` ไม่เปลี่ยน — เปลี่ยนแค่ค่าที่แสดง
- commit รูปแบบ `Area: อะไร (ทำไม)` ภาษาไทย

---

### Task 1: เปลี่ยนคำ — ชื่อสาย + "ธาตุ"→"สาย" + ชื่อสกิล

**Files:** `src/data/index.js` · `src/data/guide.js` · `src/views/TowerView.vue` · `src/views/ExpeditionView.vue` · `src/components/battle/BattleReplay.vue` · `src/utils/battlePassives.js`

- [ ] `EL_NAME` = `{ fist:'จู่โจม', scissors:'สมดุล', paper:'พิทักษ์' }` · `_EL_NAME` เติม emoji นำหน้าแบบเดิม
- [ ] `guide.js` วงข่มใหม่: `✊ จู่โจม ข่ม ✌️ สมดุล · ✌️ สมดุล ข่ม ✋ พิทักษ์ · ✋ พิทักษ์ ข่ม ✊ จู่โจม`
- [ ] `guide.js` หัวข้อ help `element` เปลี่ยน title `ธาตุ`→`สาย` + body ทุกคำ
- [ ] `TowerView.vue:26` + label "ธาตุ" ในกล่อง scout → "สาย"
- [ ] `ExpeditionView.vue` 3 จุด: `ธาตุ`→`สาย`, `ธาตุตรง`→`สายตรง`, `เพ็ทที่มีธาตุตรงมิชชัน`→`เพ็ทที่มีสายตรงมิชชัน`
- [ ] `BattleReplay.vue` แถว inspect `<span>ธาตุ</span>`→`<span>สาย</span>`
- [ ] `battlePassives.js:129` `name: 'คลื่นคู่หู'` → `'รางวัลคนเก่ง'`
- [ ] ตรวจ: `grep -rn "ค้อน\|กรรไกร" src/` ไม่เจอ · `grep -rn "ธาตุ" src/ --include=*.vue` ไม่เหลือข้อความผู้ใช้ · `drugs.js` ยังมี "ธาตุเหล็ก"
- [ ] `npm run build` ผ่าน → commit

---

### Task 2: `utils/teamSlots.js` — ตรรกะช่องทีม (TDD)

**Files:** Create `src/utils/teamSlots.js` + `src/utils/teamSlots.test.js`

**Produces:**
- `toSlots(activeIds, maxSlots) -> (string|null)[]` ยาว `maxSlots` เสมอ
- `firstEmpty(slots) -> number` (ไม่มีช่องว่าง = `-1`)
- `nextEmpty(slots, from) -> number` (วนไปข้างหน้า ไม่มี = `from`)
- `placeAt(slots, cursor, id, maxSlots) -> { slots, cursor }`

- [ ] เขียนเทสก่อน ครอบ: ใส่ช่องว่าง / ใส่ทับ (ตัวเดิมหลุด ไม่ไปโผล่ช่องอื่น) / ใส่ตัวที่อยู่ช่องอื่น = สลับที่ 2 ช่อง / ใส่ตัวที่อยู่ช่อง cursor เอง = ไม่เปลี่ยน (idempotent) / `slots.length === maxSlots` เสมอ ช่องว่าง = `null` / cursor เลื่อนไปช่องว่างถัดไป ถ้าไม่มีอยู่กับที่
- [ ] `node --test src/utils/teamSlots.test.js` ต้อง FAIL ก่อน
- [ ] implement ให้ผ่าน → commit

---

### Task 3: `TeamPicker.vue` — โมเดล "ช่องคือเคอร์เซอร์"

**Files:** Modify `src/components/battle/TeamPicker.vue`
**Consumes:** `toSlots`/`firstEmpty`/`placeAt` จาก Task 2

- [ ] เพิ่ม `cursor = ref(0)` · watch `open` → `cursor = firstEmpty(slots) ?? 0`
- [ ] แตะช่อง = `cursor = i` เท่านั้น (เอา `detailId = id` ออก) · ช่องเป็น `role="radio"` ใน `radiogroup`
- [ ] เพิ่มปุ่ม `⋯` มุมช่องที่มีตัว → `detailId = id` · `aria-label` บอกชื่อเพ็ท
- [ ] แตะการ์ดคลัง → `placeAt()` แล้ว `save()` · **เอา `:disabled` ของการ์ดคลังออกทั้งหมด**
- [ ] เพ็ทที่ออกผจญภัย: ยังจาง + ป้าย 🗺️ แต่ **กดได้** → `toast(... 'info')` บอกเหตุผล
- [ ] hint เปลี่ยนเป็นสถานะ: `กำลังเลือกให้ช่อง N · แตะตัวข้างล่าง` (ทีมเต็มบอกว่าแตะแล้วสลับได้)
- [ ] วงเคอร์เซอร์เต้นเบา ๆ + `@media (prefers-reduced-motion: reduce)` ตัดอนิเมชันเหลือเส้นทึบ
- [ ] props/emits (`open`, `update:open`) ห้ามเปลี่ยน — `PetsView`/`ArenaView`/`TowerView` ใช้ร่วม
- [ ] `save()` ยังเรียก `syncRosterRow()` · `npm run build` → commit

---

### Task 4: `PetDetailModal.vue` — ยกทักษะขึ้นบน

**Files:** Modify `src/components/pets/PetDetailModal.vue`

- [ ] ย้ายบล็อกทักษะเฉพาะขึ้นไปอยู่ **ใต้ hero ทันที** เหนือปุ่มใส่ทีม
- [ ] ทำเป็นการ์ดเด่น: ไอคอน + ชื่อตัวใหญ่ + คำอธิบายจาก `passiveText(pdPassive)`
- [ ] ป้ายสายใน hero ใช้ `EL_NAME` ตรง ๆ — **ไม่มีคำบรรยายบุคลิกต่อท้าย**
- [ ] `npm run build` → commit

---

### Task 5: `towerRivals.js` — หน้าต่างรอบตัวเรา (TDD)

**Files:** Modify `src/utils/towerRivals.js` · Create `src/utils/towerRivals.test.js`

**Produces:** `towerRanking(others, me)` คืนของเดิมครบ (`top`/`myRank`/`total`/`chaseName`/`chaseGap`) + `around: Row[]` (±2 รอบตัวเรา) + `all: Row[]`
Row = `{ uid, nickname, floor, rank, isMe }`

- [ ] เทสก่อน: เราอันดับ 1–3 → `around` ซ้อน `top` · เราท้ายสุด → `around` สั้นลง ไม่แพดของปลอม · `towerBest`=0 → `myRank:null`, `around:[]` · คนเดียว → `total:1` · `all` เรียงถูกและ `rank` ต่อเนื่อง 1..n
- [ ] FAIL ก่อน → implement → PASS → commit

---

### Task 6: การ์ดอันดับหอคอย + กระดานเต็ม

**Files:** Modify `src/views/TowerView.vue` · Create `src/components/tower/TowerRankSheet.vue`
**Consumes:** `around`/`all` จาก Task 5

- [ ] หัวข้อ `🏁 เพื่อนร่วมไต่` → `🏆 อันดับหอคอย`
- [ ] การ์ดโชว์ `top` + ตัวคั่น `⋯` (เฉพาะตอนมีช่องว่างจริง) + `around` · **ห้ามมีแถวซ้ำ** · แถวเราใช้คลาส `tw-rival-me` เดิม
- [ ] ปุ่ม `ดูอันดับทั้งหมด (N)` เปิด `TowerRankSheet`
- [ ] `TowerRankSheet.vue` ใช้ `BottomSheet.vue` (Teleport อยู่ในนั้นแล้ว) · ลิสต์ `all` · auto-scroll มาแถวตัวเองตอนเปิด
- [ ] **ไม่มี Firestore read เพิ่ม** — ใช้ `membersStore.rosterRows` ที่โหลดแล้ว
- [ ] `npm run build` → commit

---

### Task 7: `battleBeats.js` — แจกชั้นให้ passive (TDD)

**Files:** Modify `src/utils/battleBeats.js` · Modify `src/utils/battleBeats.test.js`

**Produces:** `PASSIVE_TIMING` · `OPEN_GROUP_MS = 1100` · `PASSIVE_SPOT_QUOTA = 3` · `CLUTCH_EFFECTS` · beat ของ passive ได้ `pTier: 'spotlight'|'glance'|'mute'|'openGroup'`

```js
export const PASSIVE_TIMING = {
  spotlight: { windup: 420, motion: 0, hitstop: 550, tail: 230 },  // รวม 1200
  glance:    { windup: 0,   motion: 0, hitstop: 250, tail: 0   },  // รวม 250
  mute:      { windup: 0,   motion: 0, hitstop: 0,   tail: 0   },
}
export const OPEN_GROUP_MS = 1100
export const PASSIVE_SPOT_QUOTA = 3
export const CLUTCH_EFFECTS = new Set(['revive', 'cheatDeath', 'saveAlly'])
```

score = `(CLUTCH ? 1.0 : 0) + (ครั้งแรกของ uid:effect ? 0.5 : 0) + min(0.5, amount / maxHp ของเป้า)`
กฎ: 1 `uid:effect` ได้ spotlight ครั้งเดียว · ครั้งซ้ำที่ score < 1.0 ไม่มีสิทธิ์ · โควตา 3

ยกแรก = passive ทุกตัวก่อน `attack` แรก · ทุกตัวได้ `openGroup` timing 0 **ยกเว้นตัวสุดท้ายของกลุ่ม** ได้ `hitstop: OPEN_GROUP_MS` · `aoeOpener` ในหน้าต่างนี้ได้ `spotlight` (นอกโควตา)

- [ ] เทสก่อน (เคสตามสเปก C §เทส) — รวม `beats.length === log.length` และไฟต์ไม่มี passive ต้องเหมือนเดิมเป๊ะ
- [ ] FAIL → implement → PASS → commit

---

### Task 8: `BattleReplay.vue` — เล่นจังหวะสปอตไลต์

**Files:** Modify `src/components/battle/BattleReplay.vue` · `src/utils/battleBeats.js` (`FF_SCALE`)
**Consumes:** `pTier` จาก Task 7

- [ ] `applyPassive()` เป็น `async` แยกตาม `beat.pTier` (ส่ง beat เข้าไป ไม่ใช่ event เปล่า)
- [ ] `spotlight` ไทม์ไลน์ 1200ms: หรี่ฉาก+การ์ดเรือง 0ms → แบนเนอร์เข้า 180ms → ค้าง 420–970ms → **ผลลง 970ms** → จบ 1200ms
- [ ] **เลื่อนการอัปเดต `hp.value` ของชั้น spotlight ไปเฟสผล** (วันนี้อัปทันทีต้นฟังก์ชัน)
- [ ] ทุก `await` ใช้ `wait()` ที่ผูก `gen` + `if (g !== gen) return` หลังทุกครั้ง
- [ ] ฉากหรี่ = div ทึบ + `opacity`/`will-change: opacity` — **ห้าม backdrop-filter**
- [ ] `prefers-reduced-motion` → ตัดการเลื่อน เหลือ fade แต่**ยังหยุดครบ 1200ms**
- [ ] `FF_SCALE` เพิ่ม `spotlight:1 · openGroup:1 · glance:0.3 · mute:0`
- [ ] `npm run build` → commit

---

### Task 9: แตะเพ็ทหยุดอ่าน — แก้ 3 จุด

**Files:** Modify `src/components/battle/BattleReplay.vue`

- [ ] `pausedBeforeInspect` เก็บตอน `inspect()` · `closeInspect()` คืนค่านั้น แล้วเรียก `step()` ถ้าไม่ได้พักเอง
- [ ] ผูก `closeInspect` กับทั้งปุ่มปิด, คลิกฉากหลัง, และ Escape
- [ ] ป๊อปอัปเติมคำอธิบายสกิลจาก `passiveText(insp.passive)` ใต้ชื่อ
- [ ] จุดไอคอนสกิลมุมการ์ดในสนาม — **static เท่านั้น** ไม่ re-render ทุกเฟรม
- [ ] `npm run build` → commit

---

### Task 10: สคริปต์วัดงบเวลา + ตรวจปิดงาน

**Files:** Create `scripts/passive-pacing-sim.mjs`

- [ ] พอร์ตสคริปต์ที่ใช้ตอน brainstorm เข้ารีโป (จำลอง 300 ไฟต์ นับ passive/ชั้น/เวลาจาก `buildBeats` จริง)
- [ ] รันแล้วต้องได้ avg ≤ 21s และ p90 ≤ 26s
- [ ] `npm run build` · `node --test` ทุกไฟล์เทสที่แตะ · เช็คฟอนต์ `.7rem`
- [ ] commit + `git push origin master`
