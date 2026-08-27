# PvP Matchmaking Implementation Plan (แก้ใหม่ 27 ส.ค.)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน matchmaking ของสนามประลองเป็น "สุ่ม 5 คนจริงในย่านเรตใกล้เคียง + บอท 2 ตัว (อ่อน/แกร่ง)" refresh รายวัน

**Spec:** `docs/superpowers/specs/2026-07-04-pvp-gating-matchmaking-design.md` (สเปกยังใช้ได้ทั้งฉบับ)
**แทนที่แผนเดิม:** `docs/superpowers/plans/2026-07-04-pvp-matchmaking.md` — **อย่าใช้แผนนั้น** Task 3/4 อ้างของที่ถูกรื้อไปแล้ว
**Base commit:** `349bf91` · **backup branch:** สร้าง `backup/pre-pvp-matchmaking` จาก HEAD ก่อนเริ่ม Task 1

## ทำไมต้องเขียนแผนใหม่ (อ่านก่อนเริ่ม)

commit `e818422` (roster doc, 20 ส.ค.) รื้อวิธีอ่านคู่ต่อสู้ทับแผนเดิม:

| แผนเดิมสั่ง | ความจริงวันนี้ |
|---|---|
| แก้ `src/utils/pvpMatch.js` | **ไฟล์ถูกลบไปแล้ว** — logic ย้ายเข้า `roster.js:rosterOpponents()` |
| `useArena` อ่าน `members.fbUsers` + `guestUsers` | **ห้ามแตะ** — สองตัวนี้เป็นของ AdminView เท่านั้น (อ่าน users ทั้ง collection = ต้นเหตุ O(N²) ที่เพิ่งแก้ไป) ต้องใช้ `members.rosterRows` |
| `pickHumanOpponents` ต้องกันตัวเอง/กันคนไม่มีทีม/เติม `rating` เอง | `rosterOpponents()` **ทำครบทั้ง 3 อย่างแล้ว** + แนบ `team` มาพร้อมสู้ |

⇒ Task 1–2 ของแผนเดิมยังใช้ได้ · Task 3–4 เขียนใหม่ทั้งคู่ (งานเหลือน้อยกว่าเดิม เพราะ roster ทำครึ่งทางให้แล้ว)

## Global Constraints

- ห้ามสร้าง Firestore collection ใหม่ · ห้ามเขียน doc ผู้ใช้คนอื่น · ห้ามแก้ `firestore.rules` · ห้ามแก้ `src/data/userSchema.js`
- **คู่ต่อสู้อ่านจาก `members.rosterRows` เท่านั้น** (อ่าน Firestore เพิ่ม 0) · ห้าม import `fbUsers`/`guestUsers` เข้า Arena
- ห้ามแก้ `roster.js:rosterOpponents()` — เป็นชั้นรูปข้อมูล, matchmaking ไปอยู่ไฟล์แยก
- matchmaking + บอท = pure + deterministic จาก seed (เทสได้ด้วย `node --test`)
- ไม่แตะสูตรพลังบอท (`botPowerFor`) · ไม่แตะ Elo/โควตา/เหรียญ/`battleEngine`
- ค่าคงที่: `HUMAN_POOL = 5` · `NEAR_WINDOW = 12` · `BOT_RATING_SPREAD = 300` · (เดิม `PVP_DAILY_ATTACKS = 5` — พูล 7 เป้าแต่บุกได้ 5 คือความตั้งใจ ผู้เล่นต้องเลือก)
- commit รูปแบบ `Area: อะไร (ทำไม)` ไทยปนอังกฤษ
- verify ทุก task: `node --test src/utils/*.test.js src/data/*.test.js` ผ่านหมด + (task ที่แตะ UI) `npm run build` เขียว

---

### Task 1: แยก seeded PRNG ใช้ร่วม (`utils/seededRng.js`)

ดึง `rng` (mulberry32) ออกจาก `pvpBot.js:9` มาเป็นโมดูลกลาง + เพิ่ม `hashStr` สำหรับ seed รายวัน · พฤติกรรม `getPvpBot` เดิมต้องไม่เปลี่ยน (เทสเดิมยังผ่าน)

**Files:** Create `src/utils/seededRng.js`, `src/utils/seededRng.test.js` · Modify `src/utils/pvpBot.js`

**Interfaces:** Produces `mulberry32(seed:number) => (() => number)` · `hashStr(str:string) => number` (uint32)

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — `src/utils/seededRng.test.js`

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
  assert.equal(hashStr('2026-08-27abc'), hashStr('2026-08-27abc'))
  assert.ok(Number.isInteger(hashStr('x')) && hashStr('x') >= 0)
})

test('hashStr: input ต่างกัน = ค่าต่างกัน', () => {
  assert.notEqual(hashStr('a'), hashStr('b'))
  assert.notEqual(hashStr('2026-08-27uidA'), hashStr('2026-08-27uidB'))
})
```

- [ ] **Step 2: รันเทสให้ล้ม** — `node --test src/utils/seededRng.test.js` → FAIL (`Cannot find module './seededRng.js'`)

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

- [ ] **Step 4: รันเทสให้ผ่าน** — `node --test src/utils/seededRng.test.js` → PASS (5 เทส)

- [ ] **Step 5: refactor `src/utils/pvpBot.js`**
  - เพิ่มท้ายบล็อก import: `import { mulberry32 } from './seededRng.js'`
  - ลบ `function rng(seed) { ... }` ทั้งบล็อก (บรรทัด 9–17)
  - ใน `getPvpBot`: `const rand = rng((seed >>> 0) || 1)` → `const rand = mulberry32((seed >>> 0) || 1)`

- [ ] **Step 6: เทสเดิมต้องไม่พัง** — `node --test src/utils/pvpBot.test.js src/utils/seededRng.test.js` → PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/utils/seededRng.js src/utils/seededRng.test.js src/utils/pvpBot.js
git commit -m "PvP: แยก seeded PRNG ใช้ร่วม (mulberry32+hashStr) เตรียม matchmaking รายวัน"
```

---

### Task 2: บอท 2 ตัว อ่อน/แกร่ง (`getPvpBots` ใน `pvpBot.js`)

คืนบอท 2 ตัว: อ่อน (เรต − spread, ไม่ต่ำกว่า floor) + แกร่ง (เรต + spread) · คง `getPvpBot`/`botPowerFor` เดิมไว้ครบ

**Files:** Modify `src/utils/pvpBot.js`, `src/utils/pvpBot.test.js`

**Interfaces:** Consumes `getPvpBot(rating, seed)`, `PVP_RATING_FLOOR` · Produces `getPvpBots(rating, seed) => [easy, hard]` แต่ละตัว `{ uid, name, isBot:true, rating, team, label }`

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — เพิ่มใน `src/utils/pvpBot.test.js` (แก้บรรทัด import ให้ครบ)

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
  assert.ok(easy.team.length > 0 && hard.team.length > 0)
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

test('getPvpBots: บอทแกร่งไม่อ่อนกว่าบอทอ่อน (พลังตามเรต)', () => {
  const [easy, hard] = getPvpBots(1400, 3)
  assert.ok(botPowerFor(hard.rating).grade >= botPowerFor(easy.rating).grade)
})
```

- [ ] **Step 2: รันเทสให้ล้ม** — `node --test src/utils/pvpBot.test.js` → FAIL (`getPvpBots is not a function`)

- [ ] **Step 3: เพิ่มโค้ดใน `src/utils/pvpBot.js`**

เพิ่ม import (ต่อจาก import BATTLE_SLOTS):
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

⚠️ `getPvpBot` ใช้ `seed` ตรงๆ ในการเลือกธาตุ (`ELS[((seed >>> 0) + i) % 3]`) ไม่ใช่แค่ผ่าน `rand()` — การ xor seed ของบอทแกร่งจึงเปลี่ยนทั้งธาตุและตัวเพ็ท (ตั้งใจ)

- [ ] **Step 4: รันเทสให้ผ่าน** — `node --test src/utils/pvpBot.test.js` → PASS (เทสเดิม + 4 ใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpBot.js src/utils/pvpBot.test.js
git commit -m "PvP: getPvpBots บอท 2 ตัว อ่อน/แกร่ง คร่อมเรตผู้เล่น (รวมบอทหลายระดับในพูล)"
```

---

### Task 3: สุ่มคนจริงในย่านเรตใกล้ (`utils/pvpMatch.js` — ไฟล์ใหม่)

**นี่คือ task ที่เขียนใหม่ทั้งหมดจากแผนเดิม** — ไฟล์เดิมถูกลบไปตอนรื้อ roster สร้างใหม่ให้เป็นชั้นบางๆ ที่ **รับ output ของ `rosterOpponents()` มาแล้ว** (ซึ่งกันตัวเอง/กันคนไม่มีทีม/เติม rating/แนบ team ให้เรียบร้อย) หน้าที่เหลืออย่างเดียวคือ "คัดย่านใกล้ แล้วสุ่มด้วย seed"

**Files:** Create `src/utils/pvpMatch.js`, `src/utils/pvpMatch.test.js`

**Interfaces:**
- Consumes: `mulberry32` (Task 1) · candidate = `{ uid, nickname, rating, team }` (รูปจาก `rosterOpponents`)
- Produces: `pickHumanOpponents(candidates, myRating, seed=0, n=HUMAN_POOL, window=NEAR_WINDOW) => candidate[]` · export `HUMAN_POOL=5`, `NEAR_WINDOW=12`

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — `src/utils/pvpMatch.test.js`

```js
// เทส pvpMatch — pure: คัดย่านเรตใกล้ + สุ่มด้วย seed
// รัน: node --test src/utils/pvpMatch.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickHumanOpponents, HUMAN_POOL, NEAR_WINDOW } from './pvpMatch.js'

// candidate รูปเดียวกับที่ rosterOpponents() คืนมา (กรอง+เติม rating มาแล้ว)
const mk = (uid, rating) => ({ uid, nickname: uid, rating, team: [{ id: 'cat' }] })

test('pickHumanOpponents: คืนไม่เกิน n', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  assert.equal(pickHumanOpponents(cands, 1000, 1).length, HUMAN_POOL)
})

test('pickHumanOpponents: candidate น้อยกว่า n → คืนเท่าที่มี', () => {
  assert.equal(pickHumanOpponents([mk('a', 1000), mk('b', 1010)], 1000, 1).length, 2)
})

test('pickHumanOpponents: พูลว่าง → คืน []', () => {
  assert.deepEqual(pickHumanOpponents([], 1000, 1), [])
  assert.deepEqual(pickHumanOpponents(null, 1000, 1), [])
})

test('pickHumanOpponents: seed เดียวกัน = ผลเดิม (นิ่งทั้งวัน)', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  const b = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  assert.deepEqual(a, b)
})

test('pickHumanOpponents: seed ต่าง = ชุด/ลำดับต่างได้ (ไม่ตายตัวแบบเดิม)', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 12345).map(o => o.uid).join()
  assert.notEqual(a, b)
})

test('pickHumanOpponents: เลือกเฉพาะย่านใกล้ (คนเรตไกลเกิน window ไม่ถูกเลือก)', () => {
  const near = Array.from({ length: NEAR_WINDOW }, (_, i) => mk('n' + i, 1000 + i))
  const out = pickHumanOpponents([...near, mk('far', 9000)], 1000, 5).map(o => o.uid)
  assert.ok(!out.includes('far'))
})

test('pickHumanOpponents: ไม่แก้ array ที่รับเข้ามา (ไม่ mutate ของ store)', () => {
  const cands = Array.from({ length: 8 }, (_, i) => mk('u' + i, 1000 + i))
  const before = cands.map(o => o.uid)
  pickHumanOpponents(cands, 1000, 3)
  assert.deepEqual(cands.map(o => o.uid), before)
})

test('pickHumanOpponents: ไม่คืนคนซ้ำ', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const out = pickHumanOpponents(cands, 1000, 77).map(o => o.uid)
  assert.equal(new Set(out).size, out.length)
})
```

- [ ] **Step 2: รันเทสให้ล้ม** — `node --test src/utils/pvpMatch.test.js` → FAIL (`Cannot find module './pvpMatch.js'`)

- [ ] **Step 3: สร้าง `src/utils/pvpMatch.js`**

```js
// src/utils/pvpMatch.js
// PvP matchmaking — pure: คัดย่านเรตใกล้แล้วสุ่ม (seeded รายวัน) · บอทเติมใน useArena
// รับ candidate ที่ rosterOpponents() กรองมาแล้ว (ไม่มีตัวเอง · มีทีม · มี rating)
import { mulberry32 } from './seededRng.js'

export const HUMAN_POOL  = 5    // จำนวนคนจริงในพูล
export const NEAR_WINDOW = 12   // เอาคนเรตใกล้สุด N คนเป็น "ย่านใกล้" ก่อนสุ่ม

/** สุ่มคนจริง n คนในย่านเรตใกล้ myRating (seeded → นิ่งต่อ seed เดียวกัน) */
export function pickHumanOpponents(candidates, myRating, seed = 0, n = HUMAN_POOL, window = NEAR_WINDOW) {
  // copy ก่อน sort — candidates มาจาก computed ของ store ห้าม mutate
  const near = [...(candidates || [])]
    .sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating))
    .slice(0, Math.max(window, n))
  // seeded Fisher-Yates shuffle ย่านใกล้ แล้วเอา n ตัวแรก
  const rand = mulberry32(seed >>> 0)
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = near[i]; near[i] = near[j]; near[j] = tmp
  }
  return near.slice(0, n)
}
```

- [ ] **Step 4: รันเทสให้ผ่าน** — `node --test src/utils/pvpMatch.test.js` → PASS (8 เทส)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpMatch.js src/utils/pvpMatch.test.js
git commit -m "PvP: matchmaking สุ่ม 5 คนในย่านเรตใกล้ (seeded รายวัน แทนเรียงใกล้สุดตายตัว)"
```

---

### Task 4: ประกอบพูล + ป้ายบอท (`useArena.js` + `ArenaView.vue`)

รวม 5 คน + 2 บอท ด้วย seed รายวัน · แยกบอทสองตัวให้ผู้เล่นเห็นว่าตัวไหนอ่อน/แกร่ง

**Files:** Modify `src/composables/useArena.js`, `src/views/ArenaView.vue`

**Interfaces:** Consumes `pickHumanOpponents` (Task 3), `getPvpBots` (Task 2), `hashStr` (Task 1), `rosterOpponents` (เดิม)

- [ ] **Step 1: แก้ `src/composables/useArena.js`**

เปลี่ยน import บรรทัด 16 (`import { getPvpBot } from '../utils/pvpBot.js'`) เป็น:
```js
import { getPvpBots } from '../utils/pvpBot.js'
import { pickHumanOpponents } from '../utils/pvpMatch.js'
import { hashStr } from '../utils/seededRng.js'
```
แทนที่ computed `opponents` (บรรทัด ~45–54) ทั้งบล็อกรวมคอมเมนต์:
```js
  // พูลคู่ต่อสู้ = สุ่ม 5 คนจริงย่านเรตใกล้ + บอท 2 ตัว (อ่อน/แกร่ง)
  // seed = วันที่+uid → นิ่งทั้งวัน (refresh หน้าไม่สุ่มใหม่) · ข้ามวันได้พูลใหม่ · คนละคนได้คนละพูล
  // roster ให้ทีมมาพร้อมสู้แล้ว (เหมือนบอท) จึงไม่ต้องอ่าน doc คู่ต่อสู้เลย
  const opponents = computed(() => {
    const seed = hashStr(todayStr() + (auth.currentUser?.uid || ''))
    const humans = pickHumanOpponents(
      rosterOpponents(members.rosterRows || {}, auth.currentUser?.uid),
      rating.value, seed,
    )
    return [...humans, ...getPvpBots(rating.value, seed)]
  })
```

แก้ `vsLabel` ใน `fight()` ให้แยกบอทสองตัวออกจากกัน:
```js
    const name = opp.isBot ? `หุ่นซ้อม${opp.label ? ' (' + opp.label + ')' : ''}` : (opp.nickname || 'คู่ต่อสู้')
```

- [ ] **Step 2: แก้ป้ายบอทใน `src/views/ArenaView.vue`**

บรรทัด 33 (ชื่อ) — สองแถวเป็น "หุ่นซ้อม" เหมือนกันจะแยกไม่ออก ต้องต่อป้าย:
```html
              <Emoji :char="opp.isBot ? '🤖' : '🧑'" /> {{ opp.isBot ? ('หุ่นซ้อม' + (opp.label ? ' · ' + opp.label : '')) : (opp.nickname || '?') }}
```
บรรทัด 35 (เรต) — คง " · ฝึกซ้อม" ไว้เหมือนเดิม (บอกว่าได้แต้มครึ่งเดียว คนละเรื่องกับป้ายอ่อน/แกร่ง)

- [ ] **Step 3: เทส + build**

Run: `node --test src/utils/*.test.js src/data/*.test.js` → PASS ทั้งหมด
Run: `npm run build` → เขียว (`✓ built`)

- [ ] **Step 4: Commit**

```bash
git add src/composables/useArena.js src/views/ArenaView.vue
git commit -m "PvP: ประกอบพูล 5 คน + 2 บอท ด้วย seed รายวัน + ป้ายบอทอ่อน/แกร่ง"
```

---

## Checklist เทสจอจริง (หลัง deploy + admin เปิดสนาม)

- [ ] admin เปิดสนาม (`config/app.pvpOpen=true`) → เข้า /arena ได้
- [ ] พูลโชว์คนจริง ≤5 (เรตใกล้เรา) + บอท 2 ตัว แยกป้าย "อ่อน"/"แกร่ง" เรตต่ำ/สูงกว่าเรา
- [ ] refresh หน้า/เข้าใหม่ในวันเดียว → **พูลเดิมเป๊ะ** (ไม่สุ่มใหม่) · ข้ามวัน → พูลเปลี่ยน
- [ ] roster ยังไม่โหลด (เข้า /arena ตรงๆ) → ไม่ error, บอท 2 ตัวยังอยู่, คนจริงโผล่ตามหลังได้
- [ ] มีผู้เล่นจริงน้อยกว่า 5 คนที่มีทีม → โชว์เท่าที่มี + บอท 2 ตัวยังอยู่เสมอ
- [ ] บุกบอทแกร่งชนะ = ได้แต้มมากกว่าบุกบอทอ่อนชนะ (Elo) · แพ้บอทอ่อน = เสียแต้มเยอะกว่า
- [ ] หน้าสรุปหลังสู้บอท โชว์ "VS หุ่นซ้อม (อ่อน/แกร่ง)" ตรงตัวที่บุกจริง
- [ ] โควตาหมด 5 ครั้ง → ยังเหลือ 2 เป้าที่บุกไม่ได้ (ตั้งใจ) ปุ่มบุกขึ้น toast โควตาหมด
- [ ] /tower ยังทำงานปกติ (ใช้ `resolveBattleTeam` + roster ร่วม)
