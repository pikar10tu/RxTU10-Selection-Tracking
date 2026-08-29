# สนามประลอง: จัดระเบียบ UI + กระดานอันดับในรุ่น — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** จัดหน้า `/play/arena` ให้มีลำดับสายตาชัด (4 โซนคนละน้ำหนัก) และเพิ่มกระดานอันดับแต้มประลองของทั้งรุ่น

**Architecture:** ย้ายแผงแต้มออกจาก `ArenaView` เป็น `ArenaStatus.vue` (พื้นเข้ม) · เพิ่ม `arenaRivals.js` (pure) จัดอันดับจาก `rosterRows` ที่หน้านี้โหลดอยู่แล้ว → `ArenaRankCard.vue` + `ArenaRankSheet.vue` · เติม `pw`/`pl` (ชนะ-แพ้ซีซั่นนี้) ลงแถว roster เพื่อแยกคนที่เคยลงสนามจริงออกจากคนที่ยังเป็นค่าเริ่มต้น 1000 · **ไม่มี Firestore read เพิ่มแม้แต่ครั้งเดียว**

**Tech Stack:** Vue 3 (`<script setup>`, SFC + scoped style) · Pinia · Firebase Firestore · เทส pure utils ด้วย `node --test`

สเปก: `docs/superpowers/specs/2026-08-29-arena-ui-ranking-design.md`

## Global Constraints

ข้อบังคับของโปรเจกต์ที่ใช้กับ **ทุก task** ในแผนนี้:

- **ฟอนต์ขั้นต่ำ `.7rem`** — ห้ามมี `font-size` ต่ำกว่านี้ในไฟล์ `.vue`/`.css` ใดๆ ตรวจด้วย
  `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/` ต้องไม่เจออะไร
- **สีตัวอักษรต้องเข้ากับพื้นหลังของตัวเอง** (CLAUDE.md ข้อ 13) — บนแผงพื้นเข้มห้ามใช้
  `color: rgba(0,0,0,...)` ที่ก๊อปมาจากการ์ดพื้นขาว ต้องเป็นขาวโปร่ง เช่น `rgba(255,255,255,.75)`
- **overlay `position:fixed` ต้อง Teleport to body** (CLAUDE.md ข้อ 6) — งานนี้ใช้ `BottomSheet` ซึ่ง Teleport ให้แล้ว
  ชั้น z-index ฐาน 400 พอ เพราะ sheet เปิดจากการ์ดในหน้า ไม่ได้เปิดจากใน overlay อื่น (ข้อ 12)
- **single-file component + scoped style** · คอมเมนต์เป็นไทยปนอังกฤษ
- **commit รูปแบบ `Area: อะไร (ทำไม)`** — Area ของงานนี้คือ `Arena` (ยกเว้น task ที่แตะ roster ใช้ `Roster`)
- **โทนข้อความผู้ใช้** ยึด `docs/voice-guide.md` — เป็นกันเอง อธิบายชัด ไม่ใช้คำหวือหวา
- **ห้ามแตะ** `BattleReplay.vue` · `utils/battle*.js` · `utils/pvpRating.js` · `utils/pvpCoins.js` ·
  `utils/pvpMatch.js` · `utils/pvpBoard.js` · `utils/pvpHistory.js` (ตรรกะ) · `views/TowerView.vue` ·
  `components/tower/*` · ตรรกะการบุก/เขียนผลใน `useArena.js`
- **ไม่มี Firestore read เพิ่ม** — ทุกอย่างอ่านจาก `members.rosterRows` ที่ `ArenaView` โหลดอยู่แล้ว
- ค่าคงที่ที่ต้องใช้ตรงตามของเดิม: `PVP_RATING_START = 1000` · `PVP_DAILY_ATTACKS = 5` ·
  `SEASON_SOFT_KEEP = 0.5` · `BATTLE_SLOTS = 3`
- CSS variable ที่มีให้ใช้: `--primary: #4f46e5` · `--primary-light: #eef2ff` · `--ink: #241b33` ·
  `--muted: #64748b` · `--pop: 3px 3px 0 var(--ink)`
- ทำงานบน branch `master` (ตามธรรมเนียมโปรเจกต์: push master = GitHub Actions build+deploy)

---

## File Structure

```
สร้าง  src/utils/arenaRivals.js             จัดอันดับแต้มประลองทั้งรุ่น (pure ไม่แตะ Vue/Firestore)
       src/utils/arenaRivals.test.js
       src/components/battle/ArenaStatus.vue    แผงสถานะพื้นเข้ม (แต้ม/อันดับ/ซีซั่น/โควตา/ทีมเฝ้าบ้าน)
       src/components/battle/ArenaRankCard.vue  กระดานอันดับในหน้า + ปุ่มเปิดแผ่นเต็ม (ถือ state ของ sheet เอง)
       src/components/battle/ArenaRankSheet.vue แผ่นอันดับเต็มทั้งรุ่น (BottomSheet)
แก้    src/utils/roster.js                   + pw/pl ในแถว
       src/utils/roster.test.js              + เคสใหม่ของ pw/pl
       src/views/ArenaView.vue               ประกอบ 4 โซน + computed rivals + ป้ายอันดับบนการ์ดคู่ต่อสู้
       src/components/battle/PvpHistory.vue  พับได้ + บรรทัดสรุป
```

ขอบเขตความรับผิดชอบ:
- `arenaRivals.js` รู้แค่ตัวเลข ไม่รู้จัก roster/Vue → เทสได้ตรงๆ
- `ArenaView.vue` เป็นคนแปลง `rosterRows` → รูปที่ `arenaRanking()` กิน แล้วแจกลงลูก
- `ArenaRankCard.vue` ถือ `open` ของ sheet เอง → `ArenaView` ไม่ต้องรู้เรื่องแผ่น

---

## Task 1: เติม `pw`/`pl` ลงแถว roster

**Files:**
- Modify: `src/utils/roster.js` (ฟังก์ชัน `buildRosterRow`, ~บรรทัด 29–79)
- Test: `src/utils/roster.test.js` (เพิ่มท้ายไฟล์)

**Interfaces:**
- Consumes: `applySeasonReset(pvp, seasonId)` และ `currentSeasonId()` จาก `./pvpSeason.js` (import อยู่แล้วในไฟล์)
- Produces: แถว roster มีคีย์ใหม่ `pw?: number` (ชนะซีซั่นนี้) และ `pl?: number` (แพ้ซีซั่นนี้)
  ใส่เฉพาะเมื่อ > 0 · อยู่หลัง `ta15` และ **ก่อน** `h`/`ev` เสมอ

- [ ] **Step 1: เขียนเทสที่ต้องแดง**

เติมท้าย `src/utils/roster.test.js`:

```js
test('buildRosterRow pw/pl = ชนะ-แพ้ของซีซั่นปัจจุบัน ใส่เฉพาะเมื่อ > 0', () => {
  const season = currentSeasonId()
  const r = buildRosterRow(user({ pvp: { rating: 1120, wins: 12, losses: 8, seasonId: season } }))
  assert.equal(r.pw, 12)
  assert.equal(r.pl, 8)

  // ยังไม่เคยสู้ = ไม่มีคีย์เลย (กันแถวบวมด้วยศูนย์ เหมือน m/ta4 — ทั้งรุ่นโหลด doc นี้ทุกเซสชัน)
  const zero = buildRosterRow(user({ pvp: { rating: 1000, wins: 0, losses: 0, seasonId: season } }))
  assert.equal('pw' in zero, false)
  assert.equal('pl' in zero, false)
})

test('buildRosterRow pw/pl ต้องมาจาก applySeasonReset ก้อนเดียวกับ r', () => {
  // ข้ามเดือน: เรตถูกบีบเข้ากลาง ชนะ/แพ้ถูกล้าง
  // ถ้าคำนวณแยกกัน จะได้เรตของเดือนนี้คู่กับชนะ/แพ้ของเดือนก่อน = ตัวเลขคนละเรื่อง
  const r = buildRosterRow(user({ pvp: { rating: 1400, wins: 20, losses: 3, seasonId: '2000-01' } }))
  assert.equal(r.r, 1200, 'บีบครึ่ง: 1000 + (1400-1000)*0.5')
  assert.equal('pw' in r, false)
  assert.equal('pl' in r, false)
})

test('buildRosterRow pw/pl ต้องอยู่ก่อน h/ev — rosterRowChanged เทียบ JSON ตามลำดับคีย์', () => {
  const prev = { h: [{ u: 'x', w: 1, c: 5, t: 1 }], ev: [{ k: 'pv', v: 3, t: 1 }] }
  const row = buildRosterRow(user({ pvp: { rating: 1120, wins: 1, losses: 1, seasonId: currentSeasonId() } }), prev)
  const keys = Object.keys(row)
  assert.ok(keys.indexOf('pw') < keys.indexOf('h'), 'pw ต้องมาก่อน h')
  assert.ok(keys.indexOf('pl') < keys.indexOf('ev'), 'pl ต้องมาก่อน ev')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

```
node --test src/utils/roster.test.js
```

Expected: FAIL — `r.pw` เป็น `undefined` (คาด 12)

- [ ] **Step 3: แก้ `buildRosterRow`**

ใน `src/utils/roster.js` เหนือ `return {` (ถัดจากบล็อกที่คำนวณ `ta4`/`ta15`) เพิ่ม:

```js
  // เรต+ชนะ+แพ้ "ของซีซั่นปัจจุบัน" — ต้องคำนวณครั้งเดียวแล้วใช้ทั้งก้อน
  // ⚠️ ห้ามเรียก applySeasonReset ซ้ำแยกกันต่อฟิลด์ ไม่งั้นวันข้ามเดือนจะได้
  //    เรตของเดือนใหม่คู่กับชนะ/แพ้ของเดือนเก่า
  const pvp = applySeasonReset(d.pvp, currentSeasonId())
```

แล้วในอ็อบเจกต์ที่ return เปลี่ยนบรรทัด `r:` ให้ใช้ `pvp` และเพิ่ม `pw`/`pl` **ต่อจาก `ta15` ก่อน `h`**:

```js
    // เรต "ของซีซั่นปัจจุบัน" — ไม่ใช่เรตดิบ เพราะ soft-reset จะถูกเขียนจริงต่อเมื่อเจ้าตัวบุกครั้งแรกของเดือน
    // ถ้าเขียนดิบ วันที่ 1 ของเดือน เจ้าตัวเห็นเรตบีบแล้วแต่ทั้งชั้นปียังเห็นเรตเดือนก่อน (คนเลิกเล่นค้างถาวร)
    r:  num(pvp.rating, PVP_RATING_START),
    m,
    tm,
    ...(ta4  ? { ta4 }  : {}),
    ...(ta15 ? { ta15 } : {}),
    // ชนะ/แพ้ซีซั่นนี้ — ใช้แยก "เคยลงสนามจริง" ออกจากคนที่ยังเป็นค่าเริ่มต้น 1000 (กระดานอันดับ)
    // ใส่เฉพาะเมื่อ > 0 ตามแพทเทิร์นเดียวกับ m/ta4 · ต้องอยู่ก่อน h/ev เสมอ
    ...(num(pvp.wins, 0)   ? { pw: num(pvp.wins, 0) }   : {}),
    ...(num(pvp.losses, 0) ? { pl: num(pvp.losses, 0) } : {}),
    // h ต่อท้ายเสมอ (ตำแหน่งคงที่ = rosterRowChanged เทียบ JSON ได้ตรง ไม่ยิงเขียนเปล่า)
    ...(prev?.h?.length ? { h: prev.h } : {}),
    // ev ต่อหลัง h ด้วยเหตุผลเดียวกัน — ข่าวกระดาน (ดู utils/newsFeed.js)
    ...(prev?.ev?.length ? { ev: prev.ev } : {}),
```

- [ ] **Step 4: รันเทสให้เขียว (ทั้งไฟล์ ไม่ใช่แค่เคสใหม่)**

```
node --test src/utils/roster.test.js
```

Expected: PASS ทุกเคส (เคสเดิมต้องไม่พังด้วย — โดยเฉพาะเคสที่เช็ค `r.r === 1120`)

- [ ] **Step 5: commit**

```bash
git add src/utils/roster.js src/utils/roster.test.js
git commit -m "Roster: เก็บชนะ-แพ้ PvP ซีซั่นนี้ลงแถว (กระดานอันดับต้องแยกคนที่เคยลงสนามจริง)"
```

---

## Task 2: `arenaRivals.js` — จัดอันดับแต้มประลองทั้งรุ่น

**Files:**
- Create: `src/utils/arenaRivals.js`
- Test: `src/utils/arenaRivals.test.js`

**Interfaces:**
- Consumes: ไม่พึ่งอะไรในโปรเจกต์เลย (pure ล้วน รับ array เข้า)
- Produces:
  ```js
  export const AROUND_RADIUS = 2
  export const TOP_COUNT = 10
  export function arenaRanking(others, me)
  // others: Array<{ uid, nickname, rating, wins, losses }>
  // me:     { uid, nickname, rating, wins, losses }  (ค่าสด ทับแถวซ้ำจาก roster)
  // return: { top, around, all, myRank, total, chaseName, chaseGap }
  // แถว = { uid, nickname, rating, wins, losses, rank, isMe }
  ```

- [ ] **Step 1: เขียนเทสที่ต้องแดง**

สร้าง `src/utils/arenaRivals.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arenaRanking, AROUND_RADIUS, TOP_COUNT } from './arenaRivals.js'

/** ผู้เล่นที่เคยลงสนาม (ไฟต์ > 0) */
const u = (uid, rating, wins = 1, losses = 0) => ({ uid, nickname: uid, rating, wins, losses })
/** เพื่อน n คน แต้มไล่ลง 2000, 1990, … (ทุกคนเคยลงสนาม) */
const many = (n) => Array.from({ length: n }, (_, i) => u('p' + i, 2000 - i * 10))

test('all — เรียงแต้มมากไปน้อย rank ต่อเนื่อง 1..n และ isMe ถูกตัว', () => {
  const r = arenaRanking([u('a', 900), u('c', 1300)], u('me', 1100))
  assert.deepEqual(r.all.map(x => x.uid), ['c', 'me', 'a'])
  assert.deepEqual(r.all.map(x => x.rank), [1, 2, 3])
  assert.deepEqual(r.all.map(x => x.isMe), [false, true, false])
  assert.equal(r.total, 3)
  assert.equal(r.myRank, 2)
})

test('all — ตัดคนที่ยังไม่เคยลงสนามทิ้ง (ชนะ+แพ้ = 0)', () => {
  // นี่คือหัวใจของกระดานนี้: ทุกคนใน roster มีเรตเริ่มต้น 1000 เท่ากันหมด
  const r = arenaRanking([u('never', 1000, 0, 0), u('b', 1200)], u('me', 1100))
  assert.deepEqual(r.all.map(x => x.uid), ['b', 'me'])
  assert.equal(r.total, 2)
})

test('เราที่ยังไม่เคยลงสนาม = ไม่ขึ้นกระดาน myRank เป็น null', () => {
  const r = arenaRanking([u('b', 1200)], u('me', 1000, 0, 0))
  assert.deepEqual(r.all.map(x => x.uid), ['b'])
  assert.equal(r.myRank, null)
  assert.deepEqual(r.around, [])
  assert.equal(r.chaseName, null)
})

test('ค่าสดของเราทับแถวซ้ำที่มาจาก roster', () => {
  // แถวใน roster ของเราอาจเก่ากว่าค่าใน memory หนึ่งไฟต์
  const r = arenaRanking([u('me', 1000, 1, 0), u('a', 1100)], u('me', 1400, 9, 2))
  assert.equal(r.total, 2)
  assert.equal(r.myRank, 1)
  assert.equal(r.all[0].rating, 1400)
  assert.equal(r.all[0].wins, 9)
  assert.equal(r.all[0].losses, 2)
})

test('แต้มเท่ากัน — ตัดสินด้วยชื่อเล่น เพื่อให้ลำดับคงที่ไม่สลับไปมา', () => {
  const r = arenaRanking([{ uid: 'x', nickname: 'ซี', rating: 1100, wins: 1, losses: 0 },
                          { uid: 'y', nickname: 'เอ', rating: 1100, wins: 1, losses: 0 }],
                         u('me', 900))
  assert.deepEqual(r.all.map(x => x.uid), ['y', 'x', 'me'])
})

test('top — ตัดที่ TOP_COUNT', () => {
  const r = arenaRanking(many(30), u('me', 100))
  assert.equal(r.top.length, TOP_COUNT)
  assert.equal(r.top[0].rank, 1)
  assert.equal(r.top.at(-1).rank, TOP_COUNT)
})

test('around — หน้าต่าง ±AROUND_RADIUS รอบตัวเรา', () => {
  const r = arenaRanking(many(30), u('me', 1855))   // แทรกกลางกระดาน
  assert.equal(r.around.length, AROUND_RADIUS * 2 + 1)
  assert.equal(r.around.some(x => x.isMe), true)
  assert.deepEqual(r.around.map(x => x.rank),
    [r.myRank - 2, r.myRank - 1, r.myRank, r.myRank + 1, r.myRank + 2])
})

test('around — อยู่อันดับ 1 ไม่แพดแถวปลอมข้างบน', () => {
  const r = arenaRanking(many(10), u('me', 9999))
  assert.equal(r.myRank, 1)
  assert.equal(r.around.length, AROUND_RADIUS + 1, 'ได้แค่ตัวเอง + ข้างล่าง 2')
  assert.equal(r.around[0].isMe, true)
})

test('chaseName/chaseGap — คนอันดับเหนือเราและระยะห่างเป็นแต้ม', () => {
  const r = arenaRanking([u('a', 1300), u('b', 1000)], u('me', 1150))
  assert.equal(r.chaseName, 'a')
  assert.equal(r.chaseGap, 150)
})

test('อันดับ 1 ไม่มีใครให้ไล่', () => {
  const r = arenaRanking([u('a', 900)], u('me', 1200))
  assert.equal(r.chaseName, null)
  assert.equal(r.chaseGap, 0)
})

test('ไม่มีใครในรุ่นเคยลงสนามเลย — total 0 (การ์ดจะซ่อนทั้งใบ)', () => {
  const r = arenaRanking([u('a', 1000, 0, 0)], u('me', 1000, 0, 0))
  assert.equal(r.total, 0)
  assert.equal(r.myRank, null)
  assert.deepEqual(r.top, [])
})

test('ทนของเสีย — others เป็น null / แถวไม่มี uid / ตัวเลขหาย', () => {
  const r = arenaRanking(null, u('me', 1100))
  assert.equal(r.total, 1)
  const r2 = arenaRanking([{ nickname: 'ไร้ uid', rating: 5000, wins: 3, losses: 0 },
                           { uid: 'z', nickname: 'z' }], u('me', 1100))
  assert.deepEqual(r2.all.map(x => x.uid), ['me'], 'แถวไม่มี uid ตกไป · แถวไม่มี wins/losses = ไฟต์ 0')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

```
node --test src/utils/arenaRivals.test.js
```

Expected: FAIL — `Cannot find module './arenaRivals.js'`

- [ ] **Step 3: เขียน `src/utils/arenaRivals.js`**

```js
// arenaRivals — pure: จัดอันดับแต้มประลองของทั้งรุ่น (การ์ด "อันดับในรุ่น" หน้าสนามประลอง)
//
// โครงตาม towerRivals.js แต่กรองด้วย "เคยลงสนามจริง" (ชนะ+แพ้ > 0) แทน towerBest >= 1
// เพราะทุกคนใน roster มีเรตเริ่มต้น 1000 เท่ากันหมด ⇒ ไม่กรอง = กระดานเป็นแถว 1000 ยาวเหยียด
// ⚠️ ไม่มี Firestore read เพิ่ม — คำนวณจาก rosterRows ที่หน้าสนามโหลดไว้แล้ว 1 read
//
// เทส: node --test src/utils/arenaRivals.test.js

/** จำนวนแถวเหนือ/ใต้ตัวเราในหน้าต่าง around */
export const AROUND_RADIUS = 2
/** จำนวนแถวหัวตารางที่การ์ดโชว์เสมอ — มากกว่าหอคอย (3) เพราะการ์ดนี้มีที่ว่างพอ */
export const TOP_COUNT = 10

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fights = (u) => num(u?.wins) + num(u?.losses)

/**
 * @param {Array<{uid,nickname,rating,wins,losses}>} others  จาก rosterRows (ไม่รวมตัวเรา)
 * @param {{uid,nickname,rating,wins,losses}} me             ค่าสดจาก useArena (soft-reset แล้ว)
 * @returns {{top,around,all,myRank,total,chaseName,chaseGap}}
 *          แถว = { uid, nickname, rating, wins, losses, rank, isMe }
 */
export function arenaRanking(others, me) {
  const map = new Map()
  for (const u of (others || [])) if (u && u.uid) map.set(u.uid, u)
  if (me && me.uid) map.set(me.uid, me)   // ค่าสดทับของซ้ำที่มาจาก roster

  const ranked = [...map.values()]
    .filter(u => fights(u) > 0)
    .sort((a, b) => (num(b.rating) - num(a.rating))
      || String(a.nickname).localeCompare(String(b.nickname)))

  const meUid = me?.uid
  const all = ranked.map((u, i) => ({
    uid: u.uid,
    nickname: u.nickname,
    rating: num(u.rating),
    wins: num(u.wins),
    losses: num(u.losses),
    rank: i + 1,
    isMe: u.uid === meUid,
  }))

  const myIdx = all.findIndex(u => u.isMe)
  const chase = myIdx > 0 ? all[myIdx - 1] : null

  // หน้าต่างรอบตัวเรา — หนีบให้อยู่ในกระดาน แต่ **ไม่แพดแถวปลอม**
  // (คนอันดับ 1 เห็น 3 แถว ไม่ใช่ 5 แถวที่มีช่องว่างข้างบน)
  const around = myIdx < 0 ? [] : all.slice(
    Math.max(0, myIdx - AROUND_RADIUS),
    Math.min(all.length, myIdx + AROUND_RADIUS + 1),
  )

  return {
    top: all.slice(0, TOP_COUNT),
    around,
    all,
    myRank: myIdx >= 0 ? myIdx + 1 : null,
    total: all.length,
    chaseName: chase ? chase.nickname : null,
    chaseGap: chase ? chase.rating - num(me?.rating) : 0,
  }
}
```

- [ ] **Step 4: รันเทสให้เขียว**

```
node --test src/utils/arenaRivals.test.js
```

Expected: PASS ทุกเคส

- [ ] **Step 5: commit**

```bash
git add src/utils/arenaRivals.js src/utils/arenaRivals.test.js
git commit -m "Arena: เพิ่ม arenaRivals จัดอันดับแต้มประลองทั้งรุ่น (เรต 1012 ลอยๆ ไม่บอกอะไร)"
```

---

## Task 3: แผงสถานะพื้นเข้ม (`ArenaStatus.vue`) + computed `rivals` ใน `ArenaView`

**Files:**
- Create: `src/components/battle/ArenaStatus.vue`
- Modify: `src/views/ArenaView.vue` (แทนที่บล็อก `.ar-card.ar-me` บรรทัด 16–21 + เพิ่ม computed)
- Test: manual (`npm run build` + เปิด dev)

**Interfaces:**
- Consumes: `arenaRanking()` จาก Task 2 · `rating`/`wins`/`losses`/`attacksLeft`/`myTeam` จาก `useArena()` (export อยู่แล้วทั้งหมด — ยืนยันที่ท้าย `useArena.js`)
- Produces:
  - `ArenaStatus` props: `rating: Number` · `wins: Number` · `losses: Number` · `attacksLeft: Number` ·
    `myRank: Number|null` · `total: Number` · `team: Array` (หน่วยรบจาก `resolveBattleTeam` = `{id,rarity,element,grade}`)
  - `ArenaStatus` emit: `pick` (กดปุ่มจัดทีม)
  - `ArenaView` มี computed `rivals` (ผลของ `arenaRanking`) ให้ Task 4/5 ใช้ต่อ

- [ ] **Step 1: สร้าง `src/components/battle/ArenaStatus.vue`**

```vue
<!-- src/components/battle/ArenaStatus.vue -->
<!-- แผงสถานะสนามประลอง — พื้นเข้มใบเดียวในหน้า จึงเด่นสุดโดยไม่ต้องแข่งกับใคร
     ไล่สีตระกูลเดียวกับ .tower-arena ใน style.css เพื่อให้อ่านเป็นพี่น้องกับหอคอย
     ⚠️ พื้นเข้ม — ตัวอักษรรองต้องเป็นขาวโปร่ง ห้ามก๊อป rgba(0,0,0,..) จากการ์ดพื้นขาว (CLAUDE.md ข้อ 13) -->
<template>
  <div class="as">
    <div class="as-top">
      <span class="as-score">
        <b class="as-num">{{ rating.toLocaleString() }}</b>
        <span class="as-unit">แต้มประลอง</span>
      </span>
      <span class="as-rank">{{ rankLabel }}</span>
    </div>

    <div class="as-line2">
      <span class="as-wl">ชนะ {{ wins }} · แพ้ {{ losses }}</span>
      <!-- ป้ายซีซั่น: applySeasonReset ล้างชนะ/แพ้ทุกต้นเดือนอย่างเงียบๆ ถ้าไม่บอกก็เหมือนสถิติหายเฉยๆ -->
      <span class="as-season">ซีซั่น {{ seasonLabel }}</span>
    </div>

    <div class="as-quota">
      <span class="as-dots" role="img" :aria-label="`บุกได้อีก ${attacksLeft} จาก ${max} ครั้ง`">
        <i v-for="i in max" :key="i" class="as-dot" :class="{ used: i > attacksLeft }" />
      </span>
      <span class="as-quota-txt">
        {{ attacksLeft > 0 ? `บุกได้อีก ${attacksLeft} ครั้งวันนี้` : 'โควตาวันนี้หมดแล้ว พรุ่งนี้เริ่มใหม่' }}
      </span>
    </div>

    <div class="as-sep" />

    <div class="as-team">
      <span class="as-team-l">
        <span class="as-team-cap">ทีมเฝ้าบ้าน</span>
        <span v-if="team.length" class="as-thumbs">
          <PetThumb v-for="(p, i) in team" :key="i" :pet="p" />
        </span>
        <!-- ⚠️ ข้อความนี้ตรงตามโค้ดจริง: rosterOpponents() ข้ามแถวที่ tm ว่าง
             ⇒ ไม่จัดทีม = ไม่โผล่บนกระดานของใครเลย ห้ามเขียนว่า "จะโดนบุกแล้วแพ้ฟรี" -->
        <span v-else class="as-team-empty">ยังไม่ได้ตั้งทีม — ตอนนี้ยังไม่มีใครบุกเราได้</span>
      </span>
      <button class="as-pick" :class="{ hot: !team.length }" @click="$emit('pick')">
        <Emoji char="🛡️" /> จัดทีม
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import PetThumb from '../shared/PetThumb.vue'
import { PVP_DAILY_ATTACKS } from '../../utils/pvpRating.js'
import { currentSeasonId } from '../../utils/pvpSeason.js'

const props = defineProps({
  rating: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  attacksLeft: { type: Number, default: 0 },
  myRank: { type: Number, default: null },
  total: { type: Number, default: 0 },
  team: { type: Array, default: () => [] },   // หน่วยรบจาก resolveBattleTeam
})
defineEmits(['pick'])

const max = PVP_DAILY_ATTACKS

const rankLabel = computed(() =>
  props.myRank ? `อันดับ ${props.myRank} จาก ${props.total}` : 'ยังไม่ติดอันดับ')

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
// currentSeasonId() คืน 'YYYY-MM' — แปลงเป็นชื่อเดือนไทยย่อ
const seasonLabel = computed(() => {
  const m = Number(currentSeasonId().slice(5, 7))
  return TH_MONTH[m - 1] || currentSeasonId()
})
</script>

<style scoped>
.as {
  position: relative;
  background: linear-gradient(160deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%);
  border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop);
  padding: 14px 16px; margin-bottom: 16px; color: #fff; overflow: hidden;
}
/* ลายจางแบบเดียวกับ .tower-arena — ให้พื้นไม่แบนจนดูเป็นกล่องสี */
.as::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M20 0l20 20-20 20L0 20z'/%3E%3C/g%3E%3C/svg%3E");
}
.as > * { position: relative; }

.as-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.as-score { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.as-num { font-size: 1.7rem; font-weight: 800; line-height: 1.1; }
.as-unit { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.75); }
.as-rank { font-size: .76rem; font-weight: 800; color: #fff; background: rgba(255,255,255,.18); border-radius: 999px; padding: 3px 10px; white-space: nowrap; flex-shrink: 0; }

.as-line2 { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.as-wl { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.8); }
.as-season { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,.62); border: 1px solid rgba(255,255,255,.3); border-radius: 999px; padding: 1px 8px; }

.as-quota { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.as-dots { display: inline-flex; gap: 4px; }
.as-dot { width: 10px; height: 10px; border-radius: 50%; background: #fde68a; border: 1.5px solid rgba(0,0,0,.25); }
.as-dot.used { background: transparent; border-color: rgba(255,255,255,.45); }
.as-quota-txt { font-size: .74rem; font-weight: 700; color: rgba(255,255,255,.8); }

.as-sep { height: 1px; background: rgba(255,255,255,.22); margin: 12px 0 10px; }

.as-team { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.as-team-l { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.as-team-cap { font-size: .72rem; font-weight: 800; color: rgba(255,255,255,.7); }
.as-thumbs { display: flex; gap: 5px; }
.as-thumbs > * { width: 40px; flex-shrink: 0; }
.as-team-empty { font-size: .74rem; font-weight: 700; color: #fde68a; line-height: 1.45; }

.as-pick { border: 2px solid var(--ink); background: #fff; color: var(--ink); border-radius: 11px; padding: 9px 13px; font-family: inherit; font-weight: 800; font-size: .78rem; cursor: pointer; box-shadow: var(--pop); display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
.as-pick:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.as-pick.hot { background: #fde68a; }
</style>
```

- [ ] **Step 2: แก้ `ArenaView.vue` — แทนที่การ์ดแต้มเดิมด้วยแผงใหม่**

ลบบล็อกนี้ทั้งก้อนออกจาก template:

```html
      <!-- สรุปแต้ม -->
      <div class="ar-card ar-me">
        <div class="ar-rating"><Emoji char="🏆" /> แต้มประลอง <b>{{ rating.toLocaleString() }}</b></div>
        <div class="ar-sub">ชนะ {{ wins }} · แพ้ {{ losses }} · โจมตีได้อีก <b>{{ attacksLeft }}</b> ครั้งวันนี้</div>
        <button class="ar-edit" @click="pickOpen = true"><Emoji char="🛡️" /> จัดทีม</button>
      </div>
```

ใส่แทนที่:

```html
      <ArenaStatus
        :rating="rating" :wins="wins" :losses="losses" :attacks-left="attacksLeft"
        :my-rank="rivals.myRank" :total="rivals.total" :team="myTeam"
        @pick="pickOpen = true"
      />
```

ใน `<script setup>` เพิ่ม import:

```js
import ArenaStatus from '../components/battle/ArenaStatus.vue'
import { arenaRanking } from '../utils/arenaRivals.js'
import { PVP_RATING_START } from '../utils/pvpRating.js'
```

รับ `myTeam` เพิ่มจาก `useArena()` (มันคืนมาให้อยู่แล้ว):

```js
const { rating, wins, losses, attacksLeft, myTeam, opponents, fight, refreshBoard, refreshLeft, coinPreview } = useArena()
```

แล้วเพิ่ม computed ใต้ `const oppPreview = ...`:

```js
// อันดับแต้มประลองทั้งรุ่น — อ่าน rosterRows ดิบ (rosterUsers key ด้วย studentId แล้วตก guest)
// ค่าสดของเราจาก useArena ทับแถวตัวเองใน roster ซึ่งอาจเก่ากว่าหนึ่งไฟต์
// ⚠️ ไม่มี Firestore read เพิ่ม — roster โหลดไว้แล้วตอน onMounted
const rivals = computed(() => {
  const meUid = authStore.currentUser?.uid || 'me'
  const others = Object.entries(members.rosterRows || {})
    .filter(([uid, r]) => r && uid !== meUid)
    .map(([uid, r]) => ({
      uid,
      nickname: r.n || '?',
      rating: typeof r.r === 'number' ? r.r : PVP_RATING_START,
      wins: r.pw || 0,
      losses: r.pl || 0,
    }))
  return arenaRanking(others, {
    uid: meUid,
    nickname: authStore.userData?.nickname || 'ฉัน',
    rating: rating.value, wins: wins.value, losses: losses.value,
  })
})
```

ลบ CSS ที่ไม่มีคนใช้แล้วออกจาก `<style scoped>`: `.ar-card`, `.ar-me`, `.ar-rating`, `.ar-rating b`, `.ar-sub`, `.ar-edit`, `.ar-edit:active`

- [ ] **Step 3: build ให้ผ่าน**

```
npm run build
```

Expected: build สำเร็จ ไม่มี error/warning เรื่อง import ที่หาไม่เจอ

- [ ] **Step 4: ตรวจฟอนต์ขั้นต่ำ**

```
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```

Expected: ไม่มีผลลัพธ์

- [ ] **Step 5: commit**

```bash
git add src/components/battle/ArenaStatus.vue src/views/ArenaView.vue
git commit -m "Arena: แผงสถานะพื้นเข้ม โชว์อันดับ+ซีซั่น+ทีมเฝ้าบ้าน (การ์ดขาวเหมือนกันหมดจนไม่มีลำดับสายตา)"
```

---

## Task 4: กระดานอันดับในหน้า + แผ่นเต็ม

**Files:**
- Create: `src/components/battle/ArenaRankSheet.vue`
- Create: `src/components/battle/ArenaRankCard.vue`
- Modify: `src/views/ArenaView.vue` (วางการ์ดใต้กระดานคู่ต่อสู้ เหนือ `<PvpHistory />`)

**Interfaces:**
- Consumes: `rivals` computed จาก Task 3 (`{ top, around, all, myRank, total, chaseName, chaseGap }`)
- Produces:
  - `ArenaRankSheet` props: `open: Boolean` · `rows: Array` (แถวจาก `arenaRanking().all`) · emit `update:open`
  - `ArenaRankCard` props: `rivals: Object|null` — ถือ state ของ sheet เอง `ArenaView` ไม่ต้องรู้เรื่องแผ่น

- [ ] **Step 1: สร้าง `src/components/battle/ArenaRankSheet.vue`**

```vue
<!-- ArenaRankSheet — กระดานอันดับแต้มประลองเต็มทั้งรุ่น
     ข้อมูลมาจาก arenaRanking().all ที่หน้าสนามคำนวณไว้แล้ว → **ไม่มี Firestore read เพิ่ม**
     BottomSheet ห่อ Teleport to body ให้แล้ว (ไม่งั้น #bottom-nav จะทับก้นแผ่น — CLAUDE.md ข้อ 6)
     เปิดจากการ์ดในหน้า ไม่ได้เปิดจากใน overlay อื่น ⇒ ใช้ชั้นฐาน 400 ของ BottomSheet ได้ (ข้อ 12) -->
<template>
  <BottomSheet :open="open" icon="🏆" title="อันดับสนามประลอง" @update:open="$emit('update:open', $event)">
    <ol class="ars-list">
      <li
        v-for="r in rows" :key="r.uid"
        :ref="el => { if (r.isMe) meEl = el }"
        class="ars-row" :class="{ me: r.isMe }"
      >
        <span class="ars-medal">{{ medal(r.rank) }}</span>
        <span class="ars-name">{{ r.nickname }}<span v-if="r.isMe" class="ars-badge">คุณ</span></span>
        <span class="ars-wl">{{ r.wins }}–{{ r.losses }}</span>
        <span class="ars-rt">{{ r.rating.toLocaleString() }}</span>
      </li>
      <li v-if="!rows.length" class="ars-empty">ยังไม่มีใครลงสนามเลย — เป็นคนแรกสิ!</li>
    </ol>
  </BottomSheet>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },   // [{ uid, nickname, rating, wins, losses, rank, isMe }]
})
defineEmits(['update:open'])

const meEl = ref(null)
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank))

// เปิดแผ่นมา → เลื่อนมาที่แถวตัวเองเลย (ทั้งรุ่น 50+ คน ไม่งั้นต้องไถหาเองทุกครั้ง)
// nextTick รอ v-if ของ BottomSheet วาดเสร็จก่อน ไม่งั้น ref ยังเป็น null
watch(() => props.open, async (o) => {
  if (!o) return
  await nextTick()
  meEl.value?.scrollIntoView({ block: 'center' })
})
</script>

<style scoped>
.ars-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ars-row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 10px; }
.ars-row.me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.ars-medal { font-size: .95rem; flex-shrink: 0; min-width: 26px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.ars-name { font-size: .84rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.ars-badge { margin-left: 6px; font-size: .7rem; font-weight: 800; color: var(--primary); }
.ars-wl { font-size: .74rem; font-weight: 700; color: var(--muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.ars-rt { font-size: .84rem; font-weight: 800; color: var(--ink); flex-shrink: 0; min-width: 46px; text-align: right; font-variant-numeric: tabular-nums; }
.ars-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .8rem; padding: 20px 8px; }
</style>
```

- [ ] **Step 2: สร้าง `src/components/battle/ArenaRankCard.vue`**

```vue
<!-- ArenaRankCard — กระดานอันดับแต้มประลองในหน้า (top 10 + หน้าต่างรอบตัวเรา)
     แถวบางๆ ไม่มีขอบรายแถว — ตั้งใจให้เบากว่าการ์ดคู่ต่อสู้ที่เป็นของ "กดได้"
     ไม่มี Firestore read เพิ่ม — rivals คำนวณจาก rosterRows ที่ ArenaView โหลดไว้แล้ว -->
<template>
  <div v-if="rivals && rivals.total" class="arc">
    <div class="arc-head">
      <span class="arc-title"><Emoji char="🏆" /> อันดับในรุ่น</span>
      <span class="arc-my">{{ rivals.myRank ? `อันดับ ${rivals.myRank} จาก ${rivals.total}` : `ทั้งหมด ${rivals.total} คน` }}</span>
    </div>
    <div v-if="rivals.chaseName" class="arc-chase">
      ไล่ {{ rivals.chaseName }} อีก {{ rivals.chaseGap.toLocaleString() }} แต้ม
    </div>

    <div class="arc-rows">
      <template v-for="(r, i) in rows" :key="r.kind === 'gap' ? 'gap' + i : r.uid">
        <div v-if="r.kind === 'gap'" class="arc-gap">⋯</div>
        <div v-else class="arc-row" :class="{ me: r.isMe }">
          <span class="arc-medal">{{ medal(r.rank) }}</span>
          <span class="arc-name">{{ r.nickname }}<span v-if="r.isMe" class="arc-you">คุณ</span></span>
          <span class="arc-wl">{{ r.wins }}–{{ r.losses }}</span>
          <span class="arc-rt">{{ r.rating.toLocaleString() }}</span>
        </div>
      </template>
      <div v-if="!rivals.myRank" class="arc-none">คุณยังไม่ติดอันดับ — บุกสัก 1 ครั้งก็ขึ้นแล้ว</div>
    </div>

    <button class="arc-all" @click="open = true">ดูอันดับทั้งหมด ({{ rivals.total }})</button>
    <ArenaRankSheet v-model:open="open" :rows="rivals.all" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import ArenaRankSheet from './ArenaRankSheet.vue'
import { TOP_COUNT } from '../../utils/arenaRivals.js'

const props = defineProps({
  rivals: { type: Object, default: null },   // ผลของ arenaRanking()
})

const open = ref(false)
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank))

// หัวตาราง TOP_COUNT แถว + หน้าต่างรอบตัวเรา · ตัวคั่น ⋯ เฉพาะตอนมีช่องว่างจริง
// ⚠️ ต้องกันแถวซ้ำ: ถ้าเราอยู่ในหัวตารางอยู่แล้ว หน้าต่าง around จะทับกันพอดี
const rows = computed(() => {
  const r = props.rivals
  if (!r) return []
  const out = r.top.map(u => ({ ...u, kind: 'row' }))
  const extra = r.around.filter(u => u.rank > TOP_COUNT)
  if (!extra.length) return out
  if (extra[0].rank > TOP_COUNT + 1) out.push({ kind: 'gap' })
  return out.concat(extra.map(u => ({ ...u, kind: 'row' })))
})
</script>

<style scoped>
.arc { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; margin-top: 16px; }
.arc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.arc-title { font-size: .88rem; font-weight: 800; }
.arc-my { font-size: .72rem; font-weight: 700; color: var(--muted); white-space: nowrap; }
.arc-chase { font-size: .74rem; color: var(--muted); margin-top: 2px; }

.arc-rows { margin-top: 8px; display: flex; flex-direction: column; }
.arc-row { display: flex; align-items: center; gap: 8px; padding: 6px 6px; border-radius: 9px; }
.arc-row.me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.arc-medal { font-size: .86rem; flex-shrink: 0; min-width: 24px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.arc-name { font-size: .8rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arc-you { margin-left: 6px; font-size: .7rem; font-weight: 800; color: var(--primary); }
.arc-wl { font-size: .72rem; font-weight: 700; color: var(--muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.arc-rt { font-size: .82rem; font-weight: 800; flex-shrink: 0; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
.arc-gap { text-align: center; color: rgba(0,0,0,.35); font-size: .8rem; line-height: 1; padding: 2px 0; }
.arc-none { font-size: .74rem; color: var(--muted); text-align: center; padding: 8px 4px 2px; line-height: 1.5; }

.arc-all { margin-top: 10px; width: 100%; border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 8px 12px; font-family: inherit; font-weight: 800; font-size: .76rem; cursor: pointer; box-shadow: var(--pop); }
.arc-all:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
</style>
```

- [ ] **Step 3: วางการ์ดลง `ArenaView.vue`**

ใน template ใส่ **ระหว่าง** `</div>` ปิด `.ar-list` กับ `<PvpHistory />`:

```html
      <ArenaRankCard :rivals="rivals" />
```

เพิ่ม import ใน `<script setup>`:

```js
import ArenaRankCard from '../components/battle/ArenaRankCard.vue'
```

- [ ] **Step 4: build + ตรวจฟอนต์**

```
npm run build
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```

Expected: build ผ่าน · grep ไม่เจออะไร

- [ ] **Step 5: commit**

```bash
git add src/components/battle/ArenaRankCard.vue src/components/battle/ArenaRankSheet.vue src/views/ArenaView.vue
git commit -m "Arena: กระดานอันดับในรุ่น top 10 + แผ่นเต็ม (เห็นแต้มกับอันดับคนอื่นได้แล้ว)"
```

---

## Task 5: หัวโซนคู่ต่อสู้ + ป้ายอันดับบนการ์ด

**Files:**
- Modify: `src/views/ArenaView.vue` (บล็อก `.ar-board-head` และ `.ar-opp`)

**Interfaces:**
- Consumes: `rivals` computed จาก Task 3
- Produces: helper `rankOf(uid)` ใน `ArenaView` — คืนเลขอันดับ หรือ `null` ถ้าคนนั้นยังไม่ติดอันดับ/เป็นบอท

- [ ] **Step 1: เพิ่ม helper ใน `<script setup>` ของ `ArenaView.vue`**

วางใต้ computed `rivals`:

```js
// อันดับของคู่ต่อสู้ — Map สร้างครั้งเดียวต่อการเปลี่ยนกระดาน ไม่ใช่ find() ต่อการ์ด
const rankByUid = computed(() => {
  const m = new Map()
  for (const r of (rivals.value?.all || [])) m.set(r.uid, r.rank)
  return m
})
// บอทไม่มีแถวใน roster · คนจริงที่ยังไม่เคยบุกก็ยังไม่ติดอันดับ → ทั้งคู่คืน null = ไม่ขึ้นป้าย
const rankOf = (opp) => (opp?.isBot ? null : (rankByUid.value.get(opp?.uid) ?? null))
const rankBadge = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`)
```

- [ ] **Step 2: เปลี่ยนหัวโซนใน template**

แทนที่บล็อกนี้:

```html
      <!-- กระดานคู่ต่อสู้ -->
      <div class="ar-board-head">
        <span class="ar-board-hint">ตีเสร็จได้คู่ใหม่ทันที</span>
        <button class="ar-refresh" :disabled="busy || refreshLeft > 0" @click="onRefresh">
          <Emoji char="🔄" /> {{ refreshLeft > 0 ? `อีก ${Math.ceil(refreshLeft / 60000)} นาที` : 'เปลี่ยนคู่' }}
        </button>
      </div>
```

ด้วย:

```html
      <!-- กระดานคู่ต่อสู้ — โซน "ของกดได้" หัวโซนชัดเพื่อแยกจากแผงสถานะด้านบน -->
      <div class="ar-board-head">
        <span class="ar-board-title"><Emoji char="⚔️" /> เลือกคู่ต่อสู้</span>
        <button class="ar-refresh" :disabled="busy || refreshLeft > 0" @click="onRefresh">
          <Emoji char="🔄" /> {{ refreshLeft > 0 ? `อีก ${Math.ceil(refreshLeft / 60000)} นาที` : 'เปลี่ยนคู่' }}
        </button>
      </div>
      <div class="ar-board-hint">ตีเสร็จได้คู่ใหม่ทันที</div>
```

- [ ] **Step 3: เพิ่มป้ายอันดับบนการ์ดคู่ต่อสู้**

`<span class="ar-opp-name">` คงเดิมไม่ต้องแตะ · เปลี่ยนเฉพาะบรรทัดเรตให้พ่วงป้ายอันดับ —
แทนที่บล็อกนี้:

```html
            <span class="ar-opp-rt">
              {{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span>
              <span class="ar-opp-coin"><Emoji char="🪙" /> {{ coinPreview(opp).toLocaleString() }}</span>
            </span>
```

ด้วย:

```html
            <span class="ar-opp-rt">
              <span v-if="rankOf(opp)" class="ar-opp-rank">{{ rankBadge(rankOf(opp)) }}</span>
              {{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span>
              <span class="ar-opp-coin"><Emoji char="🪙" /> {{ coinPreview(opp).toLocaleString() }}</span>
            </span>
```

- [ ] **Step 4: แก้ CSS ใน `<style scoped>` ของ `ArenaView.vue`**

`.ar-board-head` และ `.ar-board-hint` **มีอยู่แล้ว** ให้แทนที่สองบรรทัดนั้น (อย่าเพิ่มซ้ำ)
แล้วเติมอีกสองบรรทัดที่ยังไม่มี:

```css
/* แทนที่ของเดิม */
.ar-board-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.ar-board-hint { font-size: .72rem; color: rgba(0,0,0,.5); margin-bottom: 8px; }
/* เพิ่มใหม่ */
.ar-board-title { font-size: .88rem; font-weight: 800; }
.ar-opp-rank { font-weight: 800; color: var(--primary); margin-right: 3px; }
```

- [ ] **Step 5: build + ตรวจฟอนต์ + commit**

```bash
npm run build
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
git add src/views/ArenaView.vue
git commit -m "Arena: หัวโซนเลือกคู่ต่อสู้ + ป้ายอันดับบนการ์ด (เรตของคู่ต่อสู้เทียบกับใครไม่ได้เลย)"
```

Expected: build ผ่าน · grep ไม่เจออะไร

---

## Task 6: ประวัติพับได้ + บรรทัดสรุป

**Files:**
- Modify: `src/components/battle/PvpHistory.vue`

**Interfaces:**
- Consumes: `myAttacks()`, `defenseLog()`, `agoLabel()` จาก `utils/pvpHistory.js` (ไม่แตะไฟล์นั้น)
- Produces: ไม่มีอะไรที่ task อื่นใช้ต่อ

- [ ] **Step 1: ครอบเนื้อหาด้วยหัวข้อกดได้**

แทนที่ `<div class="ph-head">…</div>` เดิม (ทั้งบล็อก รวมแท็บ) ด้วย:

```html
    <!-- พับไว้เป็นค่าเริ่มต้น — ของย้อนหลังไม่ควรกินพื้นที่ตอนเปิดหน้า
         แต่หัวข้อต้องบอกว่าข้างในมีอะไร ไม่งั้นไม่มีใครกด -->
    <button class="ph-toggle" :aria-expanded="open" @click="open = !open">
      <span class="ph-title"><Emoji char="📜" /> ประวัติ</span>
      <span v-if="defSummary" class="ph-sum">{{ defSummary }}</span>
      <span class="ph-caret" :class="{ open }">▸</span>
    </button>

    <div v-if="open" class="ph-tabs" role="tablist">
      <button class="ph-tab" :class="{ on: tab === 'def' }" role="tab" :aria-selected="tab === 'def'"
        @click="tab = 'def'">ตั้งรับ</button>
      <button class="ph-tab" :class="{ on: tab === 'atk' }" role="tab" :aria-selected="tab === 'atk'"
        @click="tab = 'atk'">เราไปบุก</button>
    </div>
```

- [ ] **Step 2: ห่อเนื้อหาที่เหลือด้วย `v-if="open"`**

เปลี่ยน `<template v-if="tab === 'def'">` เป็น `<template v-if="open && tab === 'def'">`
และ `<template v-else>` เป็น `<template v-else-if="open">`
และเพิ่ม `v-if="open"` ให้ `<div class="ph-note">`

- [ ] **Step 3: เพิ่ม state + computed ใน `<script setup>`**

ใต้ `const tab = ref('def')` เพิ่ม:

```js
const open = ref(false)
```

ใต้ `const defense = computed(...)` เพิ่ม:

```js
// บรรทัดสรุปบนหัวข้อ — นับจาก defenseLog ที่ computed อยู่แล้ว ไม่ได้สแกน roster ซ้ำ
const defSummary = computed(() => {
  const list = defense.value
  if (!list.length) return ''
  const held = list.filter(r => r.won).length
  return `โดนบุก ${list.length} ครั้ง (รอด ${held})`
})
```

- [ ] **Step 4: เพิ่ม CSS**

ใน `<style scoped>` เปลี่ยน `.ph-tabs` ให้มี margin ล่าง และเพิ่มสไตล์ปุ่มหัวข้อ:

```css
.ph-toggle { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; padding: 0; font-family: inherit; cursor: pointer; text-align: left; color: inherit; }
.ph-sum { flex: 1; font-size: .74rem; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ph-caret { margin-left: auto; font-size: .8rem; color: var(--muted); transition: transform .15s ease; }
.ph-caret.open { transform: rotate(90deg); }
.ph-tabs { display: flex; gap: 6px; margin: 10px 0 4px; }
```

แล้วลบ `.ph-head { … }` ที่ไม่มีคนใช้แล้วออก

- [ ] **Step 5: build + commit**

```bash
npm run build
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
git add src/components/battle/PvpHistory.vue
git commit -m "Arena: พับกล่องประวัติไว้ + สรุปว่าโดนบุกกี่ครั้งบนหัวข้อ (ของย้อนหลังไม่ควรกินจอตอนเปิดหน้า)"
```

Expected: build ผ่าน · grep ไม่เจออะไร

---

## Task 7: ตรวจรวม + push

**Files:** ไม่มีไฟล์ใหม่ (แก้ตามที่เจอเท่านั้น)

**Interfaces:**
- Consumes: ผลของ Task 1–6 ทั้งหมด
- Produces: commit ที่ push ขึ้น `origin master` → GitHub Actions build+deploy อัตโนมัติ

- [ ] **Step 1: รันเทส pure ทั้งชุดที่เกี่ยวข้อง**

```
node --test src/utils/arenaRivals.test.js src/utils/roster.test.js src/utils/pvpHistory.test.js src/utils/pvpSeason.test.js src/utils/pvpRating.test.js
```

Expected: PASS ทั้งหมด (ไฟล์ที่ไม่ได้แก้ต้องไม่พังด้วย)

- [ ] **Step 2: build**

```
npm run build
```

Expected: สำเร็จ ไม่มี error

- [ ] **Step 3: ตรวจฟอนต์ขั้นต่ำทั้งโปรเจกต์**

```
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```

Expected: ไม่มีผลลัพธ์ (exit 1 จาก grep = ปกติ แปลว่าไม่เจอ)

- [ ] **Step 4: ตรวจสีดำบนพื้นเข้ม (CLAUDE.md ข้อ 13)**

```
grep -n "rgba(0,0,0" src/components/battle/ArenaStatus.vue
```

Expected: ไม่มีผลลัพธ์ — แผงนี้พื้นเข้มทั้งใบ ห้ามมีสีดำโปร่งเลย
(ถ้าเจอ ให้เปลี่ยนเป็น `rgba(255,255,255,...)` ที่ค่า contrast เทียบเท่า)

- [ ] **Step 5: ตรวจว่าไม่มี Firestore read เพิ่ม**

```
grep -nE "getDoc|getDocs|onSnapshot|collection\(" src/components/battle/ArenaStatus.vue src/components/battle/ArenaRankCard.vue src/components/battle/ArenaRankSheet.vue src/utils/arenaRivals.js
```

Expected: ไม่มีผลลัพธ์ — ทุกอย่างต้องมาจาก props/`rosterRows` เท่านั้น

- [ ] **Step 6: ตรวจว่าไม่ได้แตะไฟล์ต้องห้าม**

```
git diff --stat afc7973..HEAD
```

Expected: ต้องไม่มี `BattleReplay.vue` · `TowerView.vue` · `components/tower/*` ·
`utils/pvpRating.js` · `utils/pvpCoins.js` · `utils/pvpMatch.js` · `utils/pvpBoard.js` ·
`utils/pvpHistory.js` · `utils/battle*.js` อยู่ในรายการ
(`useArena.js` ก็ไม่ควรถูกแก้ — `myTeam` export อยู่แล้ว)

- [ ] **Step 7: push**

```bash
git push origin master
```

Expected: push สำเร็จ · GitHub Actions เริ่ม build+publish ไป GitHub Pages

- [ ] **Step 8: บอก user ว่าต้องกดอะไรหลัง deploy**

แจ้งชัดเจนว่า **แอดมินต้องกด "🔄 สร้าง roster ใหม่" ใน AdminView 1 ครั้ง**
ไม่งั้นกระดานอันดับจะมีแต่คนที่บุกหลัง deploy (เพราะแถวเก่ายังไม่มี `pw`/`pl`)

---

## เกณฑ์ว่าเสร็จ (จากสเปก §7)

- [ ] `npm run build` ผ่าน
- [ ] `node --test src/utils/arenaRivals.test.js` ผ่าน
- [ ] `node --test src/utils/roster.test.js` ผ่าน (เดิม + เคสใหม่)
- [ ] เปิด `/play/arena` แล้วเห็น 4 โซนแยกกันชัด ไม่มีการ์ดขาวเรียงกันรวด
- [ ] เห็นแต้ม+อันดับของคนอื่นในรุ่นทั้งในกระดานและบนการ์ดคู่ต่อสู้
- [ ] ไม่มี Firestore read เพิ่ม
- [ ] push ขึ้น `origin master` แล้ว
- [ ] แจ้ง user ว่าแอดมินต้องกด "🔄 สร้าง roster ใหม่" 1 ครั้ง
