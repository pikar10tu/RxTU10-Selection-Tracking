> ⛔ **แผนนี้เลิกใช้แล้ว (27 ส.ค. 2026) — อย่าทำตาม**
> commit `e818422` (roster doc, 20 ส.ค.) ลบ `src/utils/pvpMatch.js` และห้าม Arena อ่าน `members.fbUsers` แล้ว
> ⇒ Task 3–4 ในแผนนี้อ้างของที่ไม่มีอยู่จริง · **ใช้ `docs/superpowers/plans/2026-08-27-pvp-matchmaking.md` แทน** (build เสร็จแล้ว)

# PvP Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน matchmaking ของสนามประลองเป็น "สุ่ม 5 คนจริงในย่านเรตใกล้เคียง + บอท 2 ตัว (อ่อน/แกร่ง)" refresh รายวัน

**Architecture:** ทุกอย่าง pure + deterministic จาก seed รายวัน (`hashStr('YYYY-MM-DD'+uid)`) — ไม่มี state ใหม่ใน Firestore. แยก PRNG ที่ใช้ร่วม (`utils/seededRng.js`), ปรับ `pvpMatch`/`pvpBot` ให้รับ seed, แล้ว `useArena` ประกอบพูล.

**Tech Stack:** Vue 3 + Pinia · เทส pure ด้วย `node --test` (ไม่มี component runner — ส่วน UI verify ด้วย `npm run build` + เทสจอจริง)

**Spec:** `docs/superpowers/specs/2026-07-04-pvp-gating-matchmaking-design.md`
**Base commit (ก่อนเริ่ม):** `1397326` (ส่วน A hard-close ทำแล้ว) · **backup branch:** สร้าง `backup/pre-pvp-matchmaking` จาก HEAD ก่อนเริ่ม Task 1

## Global Constraints

- ห้ามสร้าง Firestore collection ใหม่ · ห้ามเขียน doc ผู้ใช้คนอื่น · ห้ามแก้ `firestore.rules` · ห้ามแก้ `src/data/userSchema.js`
- คู่ต่อสู้อ่านจาก `members` store cache เท่านั้น (อ่าน Firestore เพิ่ม 0)
- matchmaking + บอท = pure + deterministic จาก seed (เทสได้ด้วย `node --test`)
- ไม่แตะสูตรพลังบอท (`botPowerFor`) — จูนทีหลัง · ไม่แตะ Elo/โควต้า/เหรียญ/`battleEngine`
- ค่าคงที่ (แก้ที่จุดกำหนด): `HUMAN_POOL = 5` · `NEAR_WINDOW = 12` · `BOT_RATING_SPREAD = 300` · (เดิม `PVP_RATING_START = 1000` · `PVP_RATING_FLOOR = 100`)
- commit รูปแบบ `Area: อะไร (ทำไม)` ไทยปนอังกฤษ
- verify ทุก task: `node --test src/utils/*.test.js src/data/*.test.js` ผ่านทั้งหมด + (task ที่แตะ UI) `npm run build` เขียว

---

### Task 1: แยก seeded PRNG ใช้ร่วม (`utils/seededRng.js`)

ดึง `rng` (mulberry32) ออกจาก `pvpBot.js` มาเป็นโมดูลกลาง + เพิ่ม `hashStr` สำหรับ seed รายวัน · `pvpBot` เปลี่ยนมา import (พฤติกรรม `getPvpBot` เดิมต้องไม่เปลี่ยน — เทสเดิมยังผ่าน)

**Files:**
- Create: `src/utils/seededRng.js`
- Create: `src/utils/seededRng.test.js`
- Modify: `src/utils/pvpBot.js` (ลบ `rng` ภายใน → import `mulberry32`)

**Interfaces:**
- Produces: `mulberry32(seed:number) => (() => number)` (คืนฟังก์ชันสุ่ม [0,1)) · `hashStr(str:string) => number` (uint32)

- [ ] **Step 1: เขียนเทสที่ล้มก่อน**

สร้าง `src/utils/seededRng.test.js`:
```js
// เทส seededRng — pure PRNG + string hash
// รัน: node --test src/utils/seededRng.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32, hashStr } from './seededRng.js'

test('mulberry32: seed เดียวกัน = ลำดับเดียวกัน (deterministic)', () => {
  const a = mulberry32(12345), b = mulberry32(12345)
  for (let i = 0; i < 5; i++) assert.equal(a(), b())
})

test('mulberry32: คืนค่าในช่วง [0,1)', () => {
  const r = mulberry32(1)
  for (let i = 0; i < 20; i++) { const v = r(); assert.ok(v >= 0 && v < 1) }
})

test('mulberry32: seed ต่างกัน = ค่าแรกต่างกัน', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)())
})

test('hashStr: input เดียวกัน = ค่าเดียวกัน + เป็น uint32', () => {
  assert.equal(hashStr('2026-07-04abc'), hashStr('2026-07-04abc'))
  assert.ok(Number.isInteger(hashStr('x')) && hashStr('x') >= 0)
})

test('hashStr: input ต่างกัน = ค่าต่างกัน', () => {
  assert.notEqual(hashStr('a'), hashStr('b'))
  assert.notEqual(hashStr('2026-07-04uidA'), hashStr('2026-07-04uidB'))
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/seededRng.test.js`
Expected: FAIL (`Cannot find module './seededRng.js'`)

- [ ] **Step 3: สร้าง `src/utils/seededRng.js`**

```js
// seeded PRNG + string hash — pure, deterministic (ใช้ร่วม pvpBot + pvpMatch)
// mulberry32: ย้ายมาจาก pvpBot.rng เดิม (พฤติกรรมเดิมทุกประการ)
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a → uint32 · แปลง 'YYYY-MM-DD'+uid เป็น seed รายวันคงที่
export function hashStr(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/seededRng.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: refactor `pvpBot.js` ให้ import `mulberry32` (ลบ `rng` ภายใน)**

ใน `src/utils/pvpBot.js`:
- เพิ่ม import ท้ายบล็อก import: `import { mulberry32 } from './seededRng.js'`
- ลบฟังก์ชัน `function rng(seed) { ... }` ทั้งบล็อก (ย้ายไป seededRng แล้ว)
- ใน `getPvpBot` เปลี่ยน `const rand = rng((seed >>> 0) || 1)` → `const rand = mulberry32((seed >>> 0) || 1)`

- [ ] **Step 6: รันเทสเดิมของ pvpBot + seededRng ให้ผ่าน (พฤติกรรม getPvpBot ต้องไม่เปลี่ยน)**

Run: `node --test src/utils/pvpBot.test.js src/utils/seededRng.test.js`
Expected: PASS ทั้งหมด (pvpBot เดิม + seededRng ใหม่)

- [ ] **Step 7: Commit**

```bash
git add src/utils/seededRng.js src/utils/seededRng.test.js src/utils/pvpBot.js
git commit -m "PvP: แยก seeded PRNG ใช้ร่วม (mulberry32+hashStr) เตรียม matchmaking รายวัน"
```

---

### Task 2: บอท 2 ตัว อ่อน/แกร่ง (`getPvpBots` ใน `pvpBot.js`)

เพิ่มฟังก์ชันคืนบอท 2 ตัว: อ่อน (เรต − spread, floor) + แกร่ง (เรต + spread) · คง `getPvpBot`/`botPowerFor` เดิม

**Files:**
- Modify: `src/utils/pvpBot.js` (+ `BOT_RATING_SPREAD`, `getPvpBots`, import `PVP_RATING_FLOOR`)
- Modify: `src/utils/pvpBot.test.js` (+ เทส getPvpBots)

**Interfaces:**
- Consumes: `getPvpBot(rating, seed)` (เดิม), `mulberry32` (Task 1)
- Produces: `getPvpBots(rating:number, seed:number) => [easyBot, hardBot]` โดยแต่ละตัวมี `{ uid, name, isBot:true, rating, team, label }`

- [ ] **Step 1: เขียนเทสที่ล้มก่อน — เพิ่มใน `src/utils/pvpBot.test.js`**

เพิ่มบล็อก import ให้มี `getPvpBots, BOT_RATING_SPREAD` และเพิ่มเทส:
```js
import { getPvpBot, getPvpBots, BOT_RATING_SPREAD, botPowerFor } from './pvpBot.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'

test('getPvpBots: คืน 2 ตัว อ่อน+แกร่ง คร่อมเรตผู้เล่น', () => {
  const [easy, hard] = getPvpBots(1000, 42)
  assert.equal(easy.uid, 'bot-easy')
  assert.equal(hard.uid, 'bot-hard')
  assert.equal(easy.label, 'อ่อน')
  assert.equal(hard.label, 'แกร่ง')
  assert.equal(easy.isBot, true)
  assert.equal(hard.isBot, true)
  assert.equal(easy.rating, 1000 - BOT_RATING_SPREAD)
  assert.equal(hard.rating, 1000 + BOT_RATING_SPREAD)
  assert.ok(easy.team.length === 4 && hard.team.length === 4)
})

test('getPvpBots: บอทอ่อนไม่ต่ำกว่า floor', () => {
  const [easy] = getPvpBots(150, 42)   // 150 - 300 < floor
  assert.equal(easy.rating, PVP_RATING_FLOOR)
})

test('getPvpBots: deterministic ต่อ seed (ทีมเดิม)', () => {
  const a = getPvpBots(1200, 7), b = getPvpBots(1200, 7)
  assert.deepEqual(a[0].team, b[0].team)
  assert.deepEqual(a[1].team, b[1].team)
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpBot.test.js`
Expected: FAIL (`getPvpBots is not a function` / `BOT_RATING_SPREAD` undefined)

- [ ] **Step 3: เพิ่มโค้ดใน `src/utils/pvpBot.js`**

เพิ่ม import ค่าคงที่ (ต่อจาก import PETS):
```js
import { PVP_RATING_FLOOR } from './pvpRating.js'
```
เพิ่มท้ายไฟล์ (หลัง `getPvpBot`):
```js
export const BOT_RATING_SPREAD = 300   // ระยะเรตบอทอ่อน/แกร่งจากผู้เล่น (tunable — พลังบอทคงสูตรเดิม)

// บอท 2 ตัวในพูล: อ่อน (เรต − spread, ไม่ต่ำกว่า floor) + แกร่ง (เรต + spread)
// seed ต่างกัน (xor const) กันทีมสองตัวซ้ำกัน · uid ต่างกัน = key v-for ไม่ชน
export function getPvpBots(rating, seed) {
  const s = seed >>> 0
  const easy = { ...getPvpBot(Math.max(PVP_RATING_FLOOR, rating - BOT_RATING_SPREAD), s),
                 uid: 'bot-easy', label: 'อ่อน' }
  const hard = { ...getPvpBot(rating + BOT_RATING_SPREAD, (s ^ 0x9e3779b9) >>> 0),
                 uid: 'bot-hard', label: 'แกร่ง' }
  return [easy, hard]
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpBot.test.js`
Expected: PASS (เทสเดิม + 3 เทสใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpBot.js src/utils/pvpBot.test.js
git commit -m "PvP: getPvpBots บอท 2 ตัว อ่อน/แกร่ง คร่อมเรตผู้เล่น (รวมบอทหลายระดับในพูล)"
```

---

### Task 3: สุ่มคนจริงในย่านเรตใกล้ (`pickHumanOpponents` ใน `pvpMatch.js`)

เปลี่ยนจาก "เรียงใกล้สุด เอา n แรก" → "เอาย่านใกล้ ~12 คน แล้วสุ่ม 5 (seeded)"

**Files:**
- Modify: `src/utils/pvpMatch.js` (+ `HUMAN_POOL`, `NEAR_WINDOW`, seed param, seeded shuffle)
- Modify: `src/utils/pvpMatch.test.js` (อัปเดต signature + เทสใหม่)

**Interfaces:**
- Consumes: `mulberry32` (Task 1), `eligibleOpponents` (เดิมในไฟล์นี้), `PVP_RATING_START`
- Produces: `pickHumanOpponents(meUid, myRating, candidates, seed=0, n=HUMAN_POOL, window=NEAR_WINDOW) => opponent[]` (แต่ละตัวเติมฟิลด์ `rating`) · export `HUMAN_POOL=5`, `NEAR_WINDOW=12`

- [ ] **Step 1: อัปเดตเทสให้สะท้อน signature+พฤติกรรมใหม่ (ล้มก่อน) — `src/utils/pvpMatch.test.js`**

แทนที่เทสเดิมของ `pickHumanOpponents` ด้วยชุดนี้ (คง `eligibleOpponents` tests เดิมถ้ามี):
```js
import { eligibleOpponents, pickHumanOpponents, HUMAN_POOL, NEAR_WINDOW } from './pvpMatch.js'
import { PVP_RATING_START } from './pvpRating.js'

// สร้างผู้เล่นจำลอง: uid, เรต, มีทีม
const mk = (uid, rating, team = true) => ({
  uid, nickname: uid, pvp: { rating },
  activePets: team ? [{ id: 'cat' }] : [],
})

test('pickHumanOpponents: กันตัวเอง + คนไม่มีทีม', () => {
  const cands = [mk('me', 1000), mk('a', 1000), mk('b', 1000, false)]
  const out = pickHumanOpponents('me', 1000, cands, 1)
  const uids = out.map(o => o.uid)
  assert.ok(!uids.includes('me'))   // ตัวเอง
  assert.ok(!uids.includes('b'))    // ไม่มีทีม
  assert.ok(uids.includes('a'))
})

test('pickHumanOpponents: คืนไม่เกิน n และเติมฟิลด์ rating', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const out = pickHumanOpponents('me', 1000, cands, 1)
  assert.equal(out.length, HUMAN_POOL)
  assert.ok(out.every(o => typeof o.rating === 'number'))
})

test('pickHumanOpponents: candidate น้อยกว่า n → คืนเท่าที่มี', () => {
  const cands = [mk('a', 1000), mk('b', 1010)]
  const out = pickHumanOpponents('me', 1000, cands, 1)
  assert.equal(out.length, 2)
})

test('pickHumanOpponents: seed เดียวกัน = ผลเดิม (นิ่งทั้งวัน)', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents('me', 1000, cands, 999).map(o => o.uid)
  const b = pickHumanOpponents('me', 1000, cands, 999).map(o => o.uid)
  assert.deepEqual(a, b)
})

test('pickHumanOpponents: เลือกเฉพาะย่านใกล้ (คนเรตไกลเกิน window ไม่ถูกเลือก)', () => {
  // 12 คนใกล้ (เรต 1000±) + 1 คนไกลมาก (เรต 9000) → คนไกลไม่ควรโผล่
  const near = Array.from({ length: NEAR_WINDOW }, (_, i) => mk('n' + i, 1000 + i))
  const far = mk('far', 9000)
  const out = pickHumanOpponents('me', 1000, [...near, far], 5).map(o => o.uid)
  assert.ok(!out.includes('far'))
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpMatch.test.js`
Expected: FAIL (`HUMAN_POOL`/`NEAR_WINDOW` undefined หรือ signature ไม่รับ seed → ผลไม่ตรง)

- [ ] **Step 3: แก้ `src/utils/pvpMatch.js`**

แทนที่ทั้งไฟล์ด้วย:
```js
// PvP matchmaking — pure: สุ่มคู่ต่อสู้คนจริงในย่านเรตใกล้ (seeded รายวัน) · บอทเติมใน useArena
import { PVP_RATING_START } from './pvpRating.js'
import { mulberry32 } from './seededRng.js'

export const HUMAN_POOL  = 5    // จำนวนคนจริงในพูล
export const NEAR_WINDOW = 12   // เอาคนเรตใกล้สุด N คนเป็น "ย่านใกล้" ก่อนสุ่ม

const hasTeam = (c) => Array.isArray(c.activePets) && c.activePets.some(Boolean)

/** คนที่บุกได้: มีทีม + ไม่ใช่ตัวเอง + มี uid */
export function eligibleOpponents(meUid, candidates) {
  return (candidates || []).filter(c => c && c.uid && c.uid !== meUid && hasTeam(c))
}

/** สุ่มคนจริง n คนในย่านเรตใกล้ myRating (seeded → นิ่งต่อ seed เดียวกัน) */
export function pickHumanOpponents(meUid, myRating, candidates, seed = 0, n = HUMAN_POOL, window = NEAR_WINDOW) {
  const near = eligibleOpponents(meUid, candidates)
    .map(c => ({ ...c, rating: c.pvp?.rating ?? PVP_RATING_START }))
    .sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating))
    .slice(0, Math.max(window, n))
  // seeded Fisher–Yates shuffle ย่านใกล้ แล้วเอา n ตัวแรก
  const rand = mulberry32(seed >>> 0)
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[near[i], near[j]] = [near[j], near[i]]
  }
  return near.slice(0, n)
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpMatch.test.js`
Expected: PASS (5 เทส)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpMatch.js src/utils/pvpMatch.test.js
git commit -m "PvP: matchmaking สุ่ม 5 คนในย่านเรตใกล้ (seeded รายวัน แทนเรียงใกล้สุดตายตัว)"
```

---

### Task 4: ประกอบพูล + ป้ายบอท (`useArena.js` + `ArenaView.vue`)

รวม 5 คน + 2 บอท ด้วย seed รายวัน · โชว์ป้ายบอทอ่อน/แกร่ง

**Files:**
- Modify: `src/composables/useArena.js` (`opponents` computed)
- Modify: `src/views/ArenaView.vue` (ป้ายบอทในแถวคู่ต่อสู้)

**Interfaces:**
- Consumes: `pickHumanOpponents(meUid, rating, candidates, seed)` (Task 3), `getPvpBots(rating, seed)` (Task 2), `hashStr` (Task 1)

- [ ] **Step 1: แก้ `opponents` ใน `src/composables/useArena.js`**

เปลี่ยน import:
```js
import { getPvpBots } from '../utils/pvpBot.js'          // แทน getPvpBot
import { pickHumanOpponents } from '../utils/pvpMatch.js'
import { hashStr } from '../utils/seededRng.js'
```
แทนที่ computed `opponents` เดิม:
```js
  // พูลคู่ต่อสู้ = สุ่ม 5 คนจริงย่านเรตใกล้ + บอท 2 ตัว (อ่อน/แกร่ง) · seed รายวัน+ต่อคน → นิ่งทั้งวัน
  const opponents = computed(() => {
    const flat = [...Object.values(members.fbUsers || {}), ...(members.guestUsers || [])]
    const seed = hashStr(todayStr() + (auth.currentUser?.uid || ''))
    const humans = pickHumanOpponents(auth.currentUser?.uid, rating.value, flat, seed)
    const bots = getPvpBots(rating.value, seed)
    return [...humans, ...bots]
  })
```

- [ ] **Step 2: แก้ป้ายบอทใน `src/views/ArenaView.vue`**

ในแถวคู่ต่อสู้ เปลี่ยนบรรทัดเรตของบอทให้โชว์ระดับจาก `opp.label` (เดิมโชว์ " · ฝึกซ้อม"):
```html
            <span class="ar-opp-rt">{{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · {{ opp.label }}</span></span>
```
(ชื่อบอทยังเป็น "หุ่นซ้อม" เดิมจาก template — ป้ายอ่อน/แกร่งต่อท้ายเรต)

- [ ] **Step 3: รันเทส pure ทั้งหมด + build**

Run: `node --test src/utils/*.test.js src/data/*.test.js`
Expected: PASS ทั้งหมด (รวม seededRng/pvpBot/pvpMatch ที่แก้)

Run: `npm run build`
Expected: build เขียว (`✓ built`)

- [ ] **Step 4: Commit**

```bash
git add src/composables/useArena.js src/views/ArenaView.vue
git commit -m "PvP: ประกอบพูล 5 คน + 2 บอท ด้วย seed รายวัน + ป้ายบอทอ่อน/แกร่ง"
```

---

## Checklist เทสจอจริง (หลัง merge + admin เปิดสนาม)

- [ ] admin เปิดสนาม (`config/app.pvpOpen=true`) → การ์ด Play เป็นลิงก์ เข้า /arena ได้
- [ ] พูลโชว์คนจริง ≤5 (เรตใกล้เรา) + บอท 2 ตัว (ป้าย "อ่อน"/"แกร่ง", เรตต่ำ/สูงกว่าเรา)
- [ ] refresh หน้า/เข้าใหม่ในวันเดียว → พูลเดิม (ไม่สุ่มใหม่) · ข้ามวัน → พูลเปลี่ยน
- [ ] มีผู้เล่นจริงน้อย (<5 มีทีม) → โชว์เท่าที่มี + บอท 2 ตัวยังอยู่เสมอ
- [ ] บุกบอทแกร่งชนะ = ได้แต้มมากกว่าบุกบอทอ่อนชนะ (Elo)
- [ ] /tower ยังทำงานปกติ (ใช้ `resolveBattleTeam` ร่วม — ไม่กระทบ)

## Self-Review (ทำแล้ว)

- **Spec coverage:** ส่วน A (gating) = ทำแล้ว pre-plan · ส่วน B1 seededRng=Task1 · B2 สุ่มคน=Task3 · B3 บอท2ตัว=Task2 · B4 ประกอบพูล=Task4 · B5 ป้ายบอท=Task4 · เทส 3 ไฟล์ครอบใน Task1-3 ✓ ครบ
- **Placeholder scan:** ไม่มี TBD/TODO — โค้ด+เทสเต็มทุก step ✓
- **Type consistency:** `pickHumanOpponents(meUid, myRating, candidates, seed, n, window)` ตรงกันทั้ง Task3 (นิยาม) และ Task4 (เรียก 4 args) ✓ · `getPvpBots(rating, seed)` ตรง Task2/Task4 ✓ · `hashStr`/`mulberry32` จาก Task1 ใช้ครบ ✓ · `BOT_RATING_SPREAD`/`HUMAN_POOL`/`NEAR_WINDOW` export+import ตรง ✓
