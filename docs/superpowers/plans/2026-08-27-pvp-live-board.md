# PvP กระดานสด + เศรษฐกิจตามความกล้า Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้กระดานคู่ต่อสู้สดใหม่ตลอดและเจอคนทั้งชั้นปี + จ่ายเหรียญตามส่วนต่างพลังทีมเพื่อไม่ให้มีท่าเล่นไหนชนะขาด

**Architecture:** ตรรกะทั้งหมดเป็น pure function ในไฟล์แยก (`pvpCoins` วัดพลัง+จ่ายเหรียญ · `pvpBoard` seed+cooldown · `pvpMatch` คัดคู่ · `pvpBot` บอทสำรอง) แล้ว `useArena` ทำหน้าที่ประกอบอย่างเดียว · ไม่มี Firestore collection ใหม่ ไม่มี read เพิ่ม — กระดานทั้งหมดคำนวณจาก `roster/current` ที่โหลดอยู่แล้ว + ฟิลด์ตัวนับ 2 ตัวใน user doc

**Tech Stack:** Vue 3 + Pinia · เทส pure ด้วย `node --test` (ไม่มี component runner — ส่วน UI verify ด้วย `npm run build` + เทสจอจริง)

**Spec:** `docs/superpowers/specs/2026-08-27-pvp-live-board-design.md`
**Base commit:** `915708f` · **backup branch:** `backup/pre-pvp-matchmaking` มีอยู่แล้ว (สร้างก่อน commit `40fa238`) ไม่ต้องสร้างใหม่

## Global Constraints

- ห้ามสร้าง Firestore collection ใหม่ · ห้ามเขียน doc ผู้ใช้คนอื่น · ห้ามแก้ `firestore.rules` · ห้ามแก้ `battleEngine.js`
- **คู่ต่อสู้อ่านจาก `members.rosterRows` เท่านั้น** · ห้าม import `fbUsers`/`guestUsers` เข้า Arena (= อ่าน users ทั้ง collection, ต้นเหตุ O(N²) ที่แก้ไปแล้ว)
- ห้ามแก้ `roster.js:rosterOpponents()` (ชั้นรูปข้อมูล) — matchmaking อยู่ไฟล์แยก
- ไม่แตะโควตา `PVP_DAILY_ATTACKS = 5` · ไม่แตะ Elo (`nextRating`, `BOT_RATING_MULT`)
- **CLAUDE.md ข้อ 9:** `patchUser()` อัปเดต state แบบ synchronous ⇒ **หยิบค่าที่ต้องใช้เก็บเป็นตัวแปรก่อนเรียก `patchUser` เสมอ** ห้ามอ่าน computed ตัวเดิมซ้ำหลังเรียก
- ฟอนต์ในไฟล์ `.vue` ห้ามต่ำกว่า `.7rem`
- ค่าคงที่ (แก้ที่จุดกำหนด): `PVP_COIN_BASE = 150` · `PVP_COIN_EXP = 0.9` · clamp `[0.25, 2.5]` · `PVP_CONSOLE_MULT = 0.25` · `PVP_REFRESH_COOLDOWN_MS = 3600000` · `BOARD_SIZE = 5` · `NEAR_WINDOW = 12` · `BOT_POWER_RATIOS = [0.75, 1.15, 0.9, 1.3, 1.0]`
- commit รูปแบบ `Area: อะไร (ทำไม)` ไทยปนอังกฤษ
- verify ทุก task: `node --test src/utils/*.test.js src/data/*.test.js` ผ่านหมด + (task ที่แตะ UI) `npm run build` เขียว

## File Structure

| ไฟล์ | ความรับผิดชอบ | สถานะ |
|---|---|---|
| `src/utils/pvpCoins.js` | วัดพลังทีมจริง + คำนวณเหรียญจากผลไฟต์ | **สร้างใหม่** (Task 1) |
| `src/utils/pvpBoard.js` | seed ของกระดาน + กติกา cooldown ปุ่มรีเฟรช | **สร้างใหม่** (Task 2) |
| `src/utils/pvpMatch.js` | คัดย่านเรตใกล้ + สับไพ่ 2 รอบ | แก้ (Task 3) |
| `src/utils/pvpBot.js` | บอทสำรองที่สเกลตามพลังทีม | เขียนใหม่เกือบหมด (Task 4) |
| `src/utils/roster.js` | `buildRosterRow` ใส่ season reset | แก้ 3 บรรทัด (Task 5) |
| `src/utils/pvpRating.js` | ลบ `PVP_WIN_COIN`/`PVP_BOT_COIN` | แก้ (Task 6) |
| `src/composables/useArena.js` | ประกอบทั้งหมด + action รีเฟรช | แก้ (Task 6) |
| `src/views/ArenaView.vue` | ปุ่มรีเฟรช + เหรียญที่จะได้ + ลบ dead UI | แก้ (Task 7) |

---

### Task 1: วัดพลังทีม + สูตรเหรียญ (`utils/pvpCoins.js`)

หัวใจของ "เศรษฐกิจตามความกล้า" — วัดความแกร่งจาก**เพ็ทจริง** ไม่ใช่เรต (เรตวัดความขยันบุก คนเรตสูงทีมกากจะกลายเป็นเป้าทำเงิน)

**Files:**
- Create: `src/utils/pvpCoins.js`
- Create: `src/utils/pvpCoins.test.js`

**Interfaces:**
- Consumes: `combatStats(pet)` จาก `src/data/petPower.js` (คืน `{ atk, maxHp, ... }`)
- Produces: `teamPower(team) => number` · `coinForResult(myPower, oppPower, won) => number` · ค่าคงที่ `PVP_COIN_BASE`, `PVP_COIN_EXP`, `PVP_COIN_MIN`, `PVP_COIN_MAX`, `PVP_CONSOLE_MULT`

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — สร้าง `src/utils/pvpCoins.test.js`

```js
// เทส pvpCoins — pure: พลังทีม + เหรียญตามส่วนต่างพลัง
// รัน: node --test src/utils/pvpCoins.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  teamPower, coinForResult,
  PVP_COIN_BASE, PVP_COIN_MIN, PVP_COIN_MAX, PVP_CONSOLE_MULT,
} from './pvpCoins.js'

const mk = (rarity, grade) => ['fist', 'scissors', 'paper']
  .map((e, i) => ({ id: 'p' + i, rarity, element: e, grade }))

test('teamPower: ทีมว่าง/null = 0', () => {
  assert.equal(teamPower([]), 0)
  assert.equal(teamPower(null), 0)
})

test('teamPower: เกรดสูงกว่า = พลังมากกว่า · ความหายากสูงกว่า = พลังมากกว่า', () => {
  assert.ok(teamPower(mk('rare', 4)) > teamPower(mk('rare', 1)))
  assert.ok(teamPower(mk('legendary', 3)) > teamPower(mk('common', 3)))
})

test('coinForResult: ชนะคู่ที่พลังเท่ากัน = PVP_COIN_BASE', () => {
  assert.equal(coinForResult(5000, 5000, true), PVP_COIN_BASE)
})

test('coinForResult: ชนะคนแกร่งกว่าได้มากกว่าชนะคนอ่อนกว่า', () => {
  const strong = coinForResult(5000, 9000, true)
  const weak   = coinForResult(5000, 2000, true)
  assert.ok(strong > PVP_COIN_BASE)
  assert.ok(weak < PVP_COIN_BASE)
})

test('coinForResult: ตัวคูณถูก clamp ทั้งสองด้าน', () => {
  // อ่อนกว่ามหาศาล → พื้น · แกร่งกว่ามหาศาล → เพดาน
  assert.equal(coinForResult(999999, 1, true), Math.round(PVP_COIN_BASE * PVP_COIN_MIN / 10) * 10)
  assert.equal(coinForResult(1, 999999, true), Math.round(PVP_COIN_BASE * PVP_COIN_MAX / 10) * 10)
})

test('coinForResult: แพ้ให้คนแกร่งกว่า ได้ปลอบใจ = 25% ของค่าชนะ', () => {
  const win = coinForResult(5000, 9000, true)
  assert.equal(coinForResult(5000, 9000, false), Math.round(win * PVP_CONSOLE_MULT / 10) * 10)
})

test('coinForResult: แพ้ให้คนอ่อนกว่าหรือพอกัน = 0 (ไม่ปลอบใจการล้มเหลวที่ไม่ได้กล้า)', () => {
  assert.equal(coinForResult(5000, 2000, false), 0)
  assert.equal(coinForResult(5000, 5000, false), 0)
})

test('coinForResult: myPower = 0 ไม่หารศูนย์ ไม่คืน NaN', () => {
  const c = coinForResult(0, 5000, true)
  assert.ok(Number.isFinite(c) && c > 0)
})

test('coinForResult: เหรียญลงท้ายด้วย 0 เสมอ (ปัดสิบ)', () => {
  for (const opp of [1000, 3333, 7777, 12000]) {
    assert.equal(coinForResult(5000, opp, true) % 10, 0)
  }
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpCoins.test.js`
Expected: FAIL (`Cannot find module './pvpCoins.js'`)

- [ ] **Step 3: สร้าง `src/utils/pvpCoins.js`**

```js
// src/utils/pvpCoins.js
// PvP เศรษฐกิจ — pure: วัดพลังทีมจริงแล้วจ่ายเหรียญตามส่วนต่าง (ไม่ใช่ตามเรต)
// เหตุที่ไม่ใช้เรต: เรตในระบบนี้ได้มาจาก "ขยันบุก" ไม่ใช่ "ทีมแกร่ง"
// ⇒ คนเรตสูงทีมกากจะกลายเป็นเป้าทำเงินชั้นดีที่คนไล่ล่าด้วยปุ่มรีเฟรช
import { combatStats } from '../data/petPower.js'

export const PVP_COIN_BASE    = 150    // เหรียญเมื่อชนะคู่ที่พลังพอกัน
export const PVP_COIN_EXP     = 0.9    // ความชันของรางวัลตามส่วนต่างพลัง
export const PVP_COIN_MIN     = 0.25   // ตัวคูณต่ำสุด (ตีคนอ่อนกว่ามาก)
export const PVP_COIN_MAX     = 2.5    // ตัวคูณสูงสุด (ท้าคนแกร่งกว่ามาก)
export const PVP_CONSOLE_MULT = 0.25   // แพ้ให้คนแกร่งกว่า ได้ปลอบใจกี่ส่วนของค่าชนะ

/** พลังทีม = Σ (atk × maxHp) — ตัวแทนความแกร่งจริง คิดจากเพ็ทไม่ใช่เรต */
export function teamPower(team) {
  return (team || []).reduce((sum, pet) => {
    const c = combatStats(pet)
    return sum + c.atk * c.maxHp
  }, 0)
}

const round10 = (n) => Math.round(n / 10) * 10

/**
 * เหรียญจากผลไฟต์ 1 ครั้ง
 * ชนะ = ฐาน × (พลังเขา/พลังเรา)^0.9 คุมไว้ 0.25–2.5 เท่า
 * แพ้ให้คนแกร่งกว่า = 25% ของค่าชนะ · แพ้ให้คนอ่อนกว่า/พอกัน = 0
 *
 * ⚠️ เหรียญปลอบใจมีไว้ชดเชยที่ battleEngine วันนี้แทบไม่มีพลิก (100% หรือ 0%)
 *    ถ้าไม่มี ท้าคนแกร่งกว่า = ได้ 0 แน่นอน ไม่มีใครท้า ระบบความกล้าตายตั้งแต่วันแรก
 *    🔮 เมื่อระบบ passive (P3) มาแล้วเกิดพลิกได้จริง ให้กลับมาลด/ถอด PVP_CONSOLE_MULT ก่อนอย่างอื่น
 */
export function coinForResult(myPower, oppPower, won) {
  const ratio = oppPower / Math.max(1, myPower)
  const mult = Math.min(PVP_COIN_MAX, Math.max(PVP_COIN_MIN, Math.pow(ratio, PVP_COIN_EXP)))
  const win = round10(PVP_COIN_BASE * mult)
  if (won) return win
  return ratio > 1 ? round10(win * PVP_CONSOLE_MULT) : 0
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpCoins.test.js`
Expected: PASS (9 เทส)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpCoins.js src/utils/pvpCoins.test.js
git commit -m "PvP: เหรียญตามส่วนต่างพลังทีม + ปลอบใจเมื่อท้าคนแกร่งกว่า (เลิกจ่ายคงที่ที่ทำให้ล่าเป้าอ่อนคุ้มที่สุด)"
```

---

### Task 2: seed ของกระดาน + cooldown ปุ่มรีเฟรช (`utils/pvpBoard.js`)

**Files:**
- Create: `src/utils/pvpBoard.js`
- Create: `src/utils/pvpBoard.test.js`

**Interfaces:**
- Consumes: `hashStr(str)` จาก `./seededRng.js`
- Produces: `boardSeed(dayStr, uid, nonce) => number` · `refreshLeftMs(lastAt, now, cooldown?) => number` · `canRefresh(lastAt, now, cooldown?) => boolean` · `PVP_REFRESH_COOLDOWN_MS`

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — สร้าง `src/utils/pvpBoard.test.js`

```js
// เทส pvpBoard — pure: seed กระดาน + cooldown ปุ่มรีเฟรช
// รัน: node --test src/utils/pvpBoard.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boardSeed, refreshLeftMs, canRefresh, PVP_REFRESH_COOLDOWN_MS } from './pvpBoard.js'

test('boardSeed: input เดิม = seed เดิม (โหลดหน้าใหม่ไม่รีโรล)', () => {
  assert.equal(boardSeed('2026-08-27', 'me', 3), boardSeed('2026-08-27', 'me', 3))
})

test('boardSeed: nonce ขยับ = seed เปลี่ยน', () => {
  assert.notEqual(boardSeed('2026-08-27', 'me', 3), boardSeed('2026-08-27', 'me', 4))
})

test('boardSeed: ข้ามวัน = seed เปลี่ยน · คนละคน = seed เปลี่ยน', () => {
  assert.notEqual(boardSeed('2026-08-27', 'me', 0), boardSeed('2026-08-28', 'me', 0))
  assert.notEqual(boardSeed('2026-08-27', 'me', 0), boardSeed('2026-08-27', 'you', 0))
})

test('boardSeed: uid/nonce หายไป ไม่พัง', () => {
  assert.ok(Number.isInteger(boardSeed('2026-08-27', null, undefined)))
})

test('refreshLeftMs: เพิ่งกด = เหลือเต็ม cooldown', () => {
  assert.equal(refreshLeftMs(1000, 1000), PVP_REFRESH_COOLDOWN_MS)
})

test('refreshLeftMs: ครบพอดี = 0 (ขอบเวลาต้องกดได้)', () => {
  assert.equal(refreshLeftMs(1000, 1000 + PVP_REFRESH_COOLDOWN_MS), 0)
})

test('refreshLeftMs: ยังไม่เคยกด (lastAt ว่าง) = 0', () => {
  assert.equal(refreshLeftMs(0, 5000), 0)
  assert.equal(refreshLeftMs(undefined, 5000), 0)
})

test('refreshLeftMs: นาฬิกาเครื่องเดินถอยหลัง ต้องไม่ล็อกนานกว่า cooldown', () => {
  const left = refreshLeftMs(9_000_000, 1_000_000)   // now < lastAt
  assert.ok(left <= PVP_REFRESH_COOLDOWN_MS)
})

test('canRefresh: สอดคล้องกับ refreshLeftMs', () => {
  assert.equal(canRefresh(1000, 1000), false)
  assert.equal(canRefresh(1000, 1000 + PVP_REFRESH_COOLDOWN_MS), true)
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpBoard.test.js`
Expected: FAIL (`Cannot find module './pvpBoard.js'`)

- [ ] **Step 3: สร้าง `src/utils/pvpBoard.js`**

```js
// src/utils/pvpBoard.js
// PvP กระดาน — pure: seed ของกระดาน + กติกา cooldown ปุ่มรีเฟรช
// กระดานเปลี่ยนเมื่อ: บุกจบ 1 ครั้ง (nonce++) · กดปุ่มรี (nonce++) · ข้ามวัน
// ⚠️ โหลดหน้าใหม่ต้อง "ไม่" เปลี่ยน — ไม่งั้นกด F5 รัวๆ = รีฟรีไม่จำกัด cooldown ไร้ความหมาย
//    (จึงต้องเก็บ nonce ใน user doc ไม่ใช่ใน state ของ component)
import { hashStr } from './seededRng.js'

export const PVP_REFRESH_COOLDOWN_MS = 60 * 60 * 1000   // 1 ชม.

/** seed ของกระดาน ณ วันนี้ของผู้เล่นคนนี้ ที่ nonce นี้ */
export function boardSeed(dayStr, uid, nonce) {
  return hashStr(`${dayStr}|${uid || ''}|${nonce || 0}`)
}

/** เหลืออีกกี่ ms ถึงกดรีได้ (0 = กดได้เลย) */
export function refreshLeftMs(lastAt, now, cooldown = PVP_REFRESH_COOLDOWN_MS) {
  // clamp ที่ 0 กันนาฬิกาเครื่องเดินถอยหลังแล้วล็อกปุ่มยาวเกิน cooldown
  const passed = Math.max(0, now - (lastAt || 0))
  return passed >= cooldown ? 0 : cooldown - passed
}

export const canRefresh = (lastAt, now, cooldown = PVP_REFRESH_COOLDOWN_MS) =>
  refreshLeftMs(lastAt, now, cooldown) === 0
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpBoard.test.js`
Expected: PASS (9 เทส)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpBoard.js src/utils/pvpBoard.test.js
git commit -m "PvP: seed กระดานตาม nonce + cooldown ปุ่มรีเฟรช (โหลดหน้าใหม่ต้องไม่รีโรล)"
```

---

### Task 3: สับไพ่ 2 รอบ ให้เจอคนทั้งชั้นปี (`utils/pvpMatch.js`)

**นี่คือ task ที่แก้บั๊กร้ายแรงที่สุด** — ตอนนี้เพื่อน 93 จาก 105 คนไม่มีวันโผล่ในพูลใครเลย เพราะทุกคนเรตเท่ากันที่ 1000 ⇒ ระยะห่าง = 0 เท่ากันหมด ⇒ `sort` เสถียรไม่สลับอะไร ⇒ ย่านใกล้ = 12 คนแรกตามลำดับคีย์ใน roster doc ตายตัว

**Files:**
- Modify: `src/utils/pvpMatch.js` (เขียนทับทั้งไฟล์)
- Modify: `src/utils/pvpMatch.test.js` (เปลี่ยนชื่อค่าคงที่ + เพิ่มเทสความหลากหลาย)

**Interfaces:**
- Consumes: `mulberry32(seed)` จาก `./seededRng.js` · candidate = `{ uid, nickname, rating, team }` (รูปจาก `rosterOpponents`)
- Produces: `pickHumanOpponents(candidates, myRating, seed=0, n=BOARD_SIZE, window=NEAR_WINDOW) => candidate[]` · export `BOARD_SIZE = 5`, `NEAR_WINDOW = 12`
- ⚠️ `HUMAN_POOL` เดิมถูก**เปลี่ยนชื่อเป็น `BOARD_SIZE`** (ความหมายเปลี่ยน: บอทไม่ใช่ตัวประจำอีกแล้ว 5 = ขนาดกระดานทั้งกระดาน)

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — เขียนทับ `src/utils/pvpMatch.test.js` ทั้งไฟล์

```js
// เทส pvpMatch — pure: คัดย่านเรตใกล้ + สับไพ่ 2 รอบ
// รัน: node --test src/utils/pvpMatch.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickHumanOpponents, BOARD_SIZE, NEAR_WINDOW } from './pvpMatch.js'

// candidate รูปเดียวกับที่ rosterOpponents() คืนมา (กรอง+เติม rating มาแล้ว)
const mk = (uid, rating) => ({ uid, nickname: uid, rating, team: [{ id: 'cat' }] })

test('pickHumanOpponents: คืนไม่เกิน n', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  assert.equal(pickHumanOpponents(cands, 1000, 1).length, BOARD_SIZE)
})

test('pickHumanOpponents: candidate น้อยกว่า n → คืนเท่าที่มี', () => {
  assert.equal(pickHumanOpponents([mk('a', 1000), mk('b', 1010)], 1000, 1).length, 2)
})

test('pickHumanOpponents: พูลว่าง → คืน []', () => {
  assert.deepEqual(pickHumanOpponents([], 1000, 1), [])
  assert.deepEqual(pickHumanOpponents(null, 1000, 1), [])
})

test('pickHumanOpponents: seed เดียวกัน = ผลเดิม', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  const b = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  assert.deepEqual(a, b)
})

test('pickHumanOpponents: seed ต่าง = ชุด/ลำดับต่างได้', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 12345).map(o => o.uid).join()
  assert.notEqual(a, b)
})

test('pickHumanOpponents: เลือกเฉพาะย่านใกล้เมื่อเรตกระจายจริง', () => {
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

// ── เทสหลักของ task นี้ ──
test('pickHumanOpponents: ทั้งชั้นปีเรตเท่ากันหมด ต้องยังเจอคนได้กว้างกว่าขนาดหน้าต่าง', () => {
  // สถานการณ์จริงตอนเปิดตัว: ทุกคนยังไม่เคยเล่น PvP → เรต 1000 เท่ากันเป๊ะ
  const cands = Array.from({ length: 100 }, (_, i) => mk('u' + i, 1000))
  const seen = new Set()
  for (let seed = 1; seed <= 200; seed++) {
    pickHumanOpponents(cands, 1000, seed).forEach(o => seen.add(o.uid))
  }
  // ก่อนแก้: ติดอยู่ที่ NEAR_WINDOW คนแรกตามลำดับคีย์ตลอดกาล
  assert.ok(seen.size > NEAR_WINDOW * 3, `เจอแค่ ${seen.size} คน — ยังติดกับดัก tie-order`)
})

test('pickHumanOpponents: เรตเท่ากันหมด seed ต่างกันต้องได้คนละชุด', () => {
  const cands = Array.from({ length: 100 }, (_, i) => mk('u' + i, 1000))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 2).map(o => o.uid).join()
  assert.notEqual(a, b)
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpMatch.test.js`
Expected: FAIL — `BOARD_SIZE` undefined และเทส "เรตเท่ากันหมด" ล้ม (เจอแค่ 12 คน)

- [ ] **Step 3: เขียนทับ `src/utils/pvpMatch.js` ทั้งไฟล์**

```js
// src/utils/pvpMatch.js
// PvP matchmaking — pure: คัดย่านเรตใกล้แล้วสุ่ม · บอทเติมช่องที่เหลือใน useArena
// รับ candidate ที่ rosterOpponents() กรองมาแล้ว (ไม่มีตัวเอง · มีทีม · มี rating)
import { mulberry32 } from './seededRng.js'

export const BOARD_SIZE  = 5    // ขนาดกระดาน = เท่าโควตาบุก/วัน (คนจริงก่อน บอทเติมที่เหลือ)
export const NEAR_WINDOW = 12   // เอาคนเรตใกล้สุด N คนเป็น "ย่านใกล้" ก่อนสุ่ม

/** สับไพ่ในที่ (Fisher-Yates) ด้วย rng ที่ส่งเข้ามา */
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

/**
 * สุ่มคนจริง n คนในย่านเรตใกล้ myRating (seeded → นิ่งต่อ seed เดียวกัน)
 *
 * ⚠️ ต้องสับไพ่ 2 รอบ ทำครึ่งเดียวไม่แก้ปัญหา:
 *   รอบ 1 (ก่อน sort) — ตอนเปิดตัวทั้งชั้นปียังไม่เคยเล่น PvP เรตจึงเท่ากันหมดที่ 1000
 *     ⇒ ระยะห่างเป็น 0 เท่ากันทุกคน ⇒ sort เสถียรไม่สลับอะไรเลย
 *     ⇒ ย่านใกล้กลายเป็น "12 คนแรกตามลำดับคีย์ใน roster doc" ตายตัวถาวร (เพื่อน 93/105 ไม่มีวันโผล่)
 *     สับก่อน sort ⇒ คนที่ระยะเท่ากันคงลำดับที่เพิ่งสับไว้ = สลับที่กันจริงตาม seed
 *   รอบ 2 (หลังตัดย่าน) — สุ่มผู้ท้าชิงจากย่านใกล้ตามปกติ
 */
export function pickHumanOpponents(candidates, myRating, seed = 0, n = BOARD_SIZE, window = NEAR_WINDOW) {
  const rand = mulberry32(seed >>> 0)
  // copy ก่อน — candidates มาจาก computed ของ store ห้าม mutate
  const near = shuffle([...(candidates || [])], rand)
    .sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating))
    .slice(0, Math.max(window, n))
  return shuffle(near, rand).slice(0, n)
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpMatch.test.js`
Expected: PASS (10 เทส)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpMatch.js src/utils/pvpMatch.test.js
git commit -m "PvP: สับไพ่ก่อนเรียงระยะเรต (เรตเสมอกันทั้งชั้นทำให้เพื่อน 93/105 ไม่มีวันโผล่ในพูล)"
```

---

### Task 4: บอทสำรองที่สเกลตามพลังทีม (`utils/pvpBot.js`)

บอทเดิมสเกลตาม**เรต** ทั้งที่ความแกร่งจริงมาจาก**เพ็ท** — วัดจริงแล้วได้ 0% หรือ 100% แทบทุกช่อง (ปุ่มฟรีกับกำแพง ไม่ใช่ตัวเลือก) · ของใหม่เล็งที่พลังทีมของผู้เล่นโดยตรง และโผล่เฉพาะตอนคนจริงไม่ครบกระดาน

**Files:**
- Modify: `src/utils/pvpBot.js` (เขียนทับทั้งไฟล์)
- Modify: `src/utils/pvpBot.test.js` (เขียนทับทั้งไฟล์ — `botPowerFor`/`getPvpBot`/`getPvpBots`/`BOT_RATING_SPREAD` ถูกลบ)

**Interfaces:**
- Consumes: `PETS` จาก `../data/index.js` · `BATTLE_SLOTS` จาก `../data/residence.js` · `RARITY_ORDER`, `MAX_GRADE` จาก `../data/petPower.js` · `mulberry32` จาก `./seededRng.js` · `teamPower` จาก `./pvpCoins.js` (Task 1) · `PVP_RATING_FLOOR` จาก `./pvpRating.js`
- Produces: `botTeamOf(rarity, grade, seed) => unit[]` · `botTeamForPower(targetPower, seed) => unit[]` · `getFallbackBots(myPower, myRating, seed, count) => bot[]` · `BOT_POWER_RATIOS`
- bot = `{ uid, name, label, isBot: true, rating, team }` — `uid` ต่างกันทุกตัว (`bot-0`, `bot-1`, …) เพื่อไม่ให้ key ของ `v-for` ชนกัน

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — เขียนทับ `src/utils/pvpBot.test.js` ทั้งไฟล์

```js
// src/utils/pvpBot.test.js
// เทสบอทสำรอง — สเกลตามพลังทีมผู้เล่น ไม่ใช่ตามเรต
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { botTeamOf, botTeamForPower, getFallbackBots, BOT_POWER_RATIOS } from './pvpBot.js'
import { teamPower } from './pvpCoins.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'
import { BATTLE_SLOTS } from '../data/residence.js'

test('botTeamOf: คืนทีมเต็มช่อง + deterministic ต่อ seed', () => {
  const a = botTeamOf('rare', 3, 42)
  assert.equal(a.length, BATTLE_SLOTS)
  assert.deepEqual(a, botTeamOf('rare', 3, 42))
})

test('botTeamOf: เกรดสูงกว่า = พลังมากกว่า', () => {
  assert.ok(teamPower(botTeamOf('rare', 5, 7)) > teamPower(botTeamOf('rare', 0, 7)))
})

test('botTeamForPower: พลังใกล้เป้าหมายกว่าตัวเลือกสุดขอบ', () => {
  const target = teamPower(botTeamOf('rare', 3, 11))
  const got = botTeamForPower(target, 11)
  const diff = Math.abs(teamPower(got) - target)
  assert.ok(diff <= Math.abs(teamPower(botTeamOf('common', 0, 11)) - target))
  assert.ok(diff <= Math.abs(teamPower(botTeamOf('legendary', 5, 11)) - target))
})

test('botTeamForPower: deterministic ต่อ seed', () => {
  assert.deepEqual(botTeamForPower(5000, 3), botTeamForPower(5000, 3))
})

test('botTeamForPower: target 0 หรือมหาศาล ไม่พัง', () => {
  assert.equal(botTeamForPower(0, 1).length, BATTLE_SLOTS)
  assert.equal(botTeamForPower(1e12, 1).length, BATTLE_SLOTS)
})

test('getFallbackBots: คืนตามจำนวนที่ขอ + uid ไม่ซ้ำ', () => {
  const bots = getFallbackBots(5000, 1000, 42, 3)
  assert.equal(bots.length, 3)
  assert.equal(new Set(bots.map(b => b.uid)).size, 3)
  assert.ok(bots.every(b => b.isBot === true && b.team.length === BATTLE_SLOTS))
})

test('getFallbackBots: ขอ 0 ตัว = ไม่มีบอทเลย (กระดานคนจริงเต็มแล้ว)', () => {
  assert.deepEqual(getFallbackBots(5000, 1000, 42, 0), [])
  assert.deepEqual(getFallbackBots(5000, 1000, 42, -1), [])
})

test('getFallbackBots: ตัวแรกอ่อนกว่าเรา ตัวสองแกร่งกว่าเรา (ตามพลัง ไม่ใช่เรต)', () => {
  const myPower = teamPower(botTeamOf('rare', 3, 5))
  const [easy, hard] = getFallbackBots(myPower, 1000, 42, 2)
  assert.ok(teamPower(easy.team) < myPower)
  assert.ok(teamPower(hard.team) > myPower)
  assert.equal(easy.label, 'อ่อน')
  assert.equal(hard.label, 'แกร่ง')
})

test('getFallbackBots: เรตบอทไม่ต่ำกว่าพื้น แม้เรตเราจะต่ำมาก', () => {
  const bots = getFallbackBots(5000, PVP_RATING_FLOOR, 42, 2)
  assert.ok(bots.every(b => b.rating >= PVP_RATING_FLOOR))
})

test('getFallbackBots: ขอมากกว่าจำนวนอัตราส่วนที่มี ก็ไม่พัง', () => {
  const bots = getFallbackBots(5000, 1000, 42, BOT_POWER_RATIOS.length + 3)
  assert.ok(bots.length <= BOT_POWER_RATIOS.length)
  assert.equal(new Set(bots.map(b => b.uid)).size, bots.length)
})
```

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/pvpBot.test.js`
Expected: FAIL (`botTeamOf is not a function` / import ไม่เจอ)

- [ ] **Step 3: เขียนทับ `src/utils/pvpBot.js` ทั้งไฟล์**

```js
// src/utils/pvpBot.js
// PvP bot — pure: หุ่นซ้อมที่ "เติมช่องว่าง" บนกระดานเมื่อคนจริงไม่ครบ
// deterministic จาก seed (แนวเดียว getFloorTeam)
//
// ⚠️ ของเดิมสเกลบอทตาม "เรต" ทั้งที่ความแกร่งจริงมาจาก "เพ็ท" — วัดจริง 200 ไฟต์/ช่องแล้ว
//    ได้ 0% หรือ 100% แทบทุกช่อง คือปุ่มเหรียญฟรีกับกำแพง ไม่ใช่ตัวเลือกความยาก
//    ของใหม่เล็งที่ teamPower ของผู้เล่นโดยตรง
import { PETS } from '../data/index.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { RARITY_ORDER, MAX_GRADE } from '../data/petPower.js'
import { mulberry32 } from './seededRng.js'
import { teamPower } from './pvpCoins.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'

const ELS = ['fist', 'scissors', 'paper']

// อัตราส่วนพลังของบอทเทียบกับทีมผู้เล่น เรียงตามลำดับที่อยากให้โผล่ก่อน
export const BOT_POWER_RATIOS = [0.75, 1.15, 0.9, 1.3, 1.0]

const labelFor = (r) => (r < 0.95 ? 'อ่อน' : (r > 1.05 ? 'แกร่ง' : 'พอกัน'))

/** ทีมหุ่นซ้อมที่ความหายาก/เกรดกำหนด · ธาตุผสมจาก seed */
export function botTeamOf(rarity, grade, seed) {
  const rand = mulberry32((seed >>> 0) || 1)
  const team = []
  for (let i = 0; i < BATTLE_SLOTS; i++) {
    const element = ELS[((seed >>> 0) + i) % 3]
    const pool = PETS.filter(p => p.rarity === rarity && p.element === element)
    const fallback = PETS.filter(p => p.element === element)
    const src = pool.length ? pool : fallback
    const def = src[Math.floor(rand() * src.length)]
    team.push({ id: def.id, rarity: def.rarity, element: def.element, grade })
  }
  return team
}

/** ทีมที่พลังใกล้ targetPower ที่สุด — ไล่กริด (ความหายาก × เกรด) = 24 แบบ */
export function botTeamForPower(targetPower, seed) {
  let bestTeam = null
  let bestDiff = Infinity
  for (const rarity of RARITY_ORDER) {
    for (let grade = 0; grade <= MAX_GRADE; grade++) {
      const team = botTeamOf(rarity, grade, seed)
      const diff = Math.abs(teamPower(team) - targetPower)
      if (diff < bestDiff) { bestDiff = diff; bestTeam = team }
    }
  }
  return bestTeam
}

/**
 * บอทเติมช่องว่างบนกระดาน — เล็งพลังจากทีมผู้เล่น ไม่ใช่จากเรต
 * count = จำนวนช่องที่คนจริงเติมไม่ครบ (ปกติชั้นปีมีคนเกิน 5 คน ⇒ 0 = ไม่เห็นบอทเลย)
 */
export function getFallbackBots(myPower, myRating, seed, count) {
  const n = Math.max(0, Math.min(count, BOT_POWER_RATIOS.length))
  const out = []
  for (let i = 0; i < n; i++) {
    const ratio = BOT_POWER_RATIOS[i]
    // seed ต่างกันต่อตัว กันบอทสองตัวได้ทีมซ้ำกัน
    const s = ((seed >>> 0) ^ Math.imul(0x9e3779b9, i + 1)) >>> 0
    out.push({
      uid: `bot-${i}`,
      name: 'หุ่นซ้อม',
      label: labelFor(ratio),
      isBot: true,
      rating: Math.max(PVP_RATING_FLOOR, Math.round(myRating * ratio)),
      team: botTeamForPower(myPower * ratio, s),
    })
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpBot.test.js src/utils/pvpCoins.test.js`
Expected: PASS ทั้งหมด (บอท 10 + เหรียญ 9)

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpBot.js src/utils/pvpBot.test.js
git commit -m "PvP: บอทเล็งพลังทีมผู้เล่นแทนเรต + เป็นตัวสำรองเติมช่องว่าง (เดิมเป็น 0%/100% ไม่ใช่ตัวเลือก)"
```

---

### Task 5: เรตซีซั่นบนบอร์ดให้ตรงกับที่เจ้าตัวเห็น (`utils/roster.js`)

`buildRosterRow` เขียน `pvp.rating` ดิบ แต่ soft-reset จะถูกเขียนจริงต่อเมื่อเจ้าตัวบุกครั้งแรกของเดือน ⇒ วันที่ 1 ก.ย. เจ้าตัวเห็นเรตตัวเอง 1300 แต่ทั้งชั้นปี (และระบบจับคู่) ยังเห็นเขาเป็น 1600 จนกว่าเขาจะบุก · คนที่เลิกเล่นจะค้างถาวร

**Files:**
- Modify: `src/utils/roster.js` (import + บรรทัด `r:` ใน `buildRosterRow`)
- Modify: `src/utils/roster.test.js` (เพิ่มเทส)

**Interfaces:**
- Consumes: `applySeasonReset(pvp, season)`, `currentSeasonId()` จาก `./pvpSeason.js`
- Produces: ไม่มีของใหม่ — `buildRosterRow(u).r` เปลี่ยนความหมายเป็น "เรตของซีซั่นปัจจุบัน"

- [ ] **Step 1: เขียนเทสที่ล้มก่อน** — เพิ่มท้าย `src/utils/roster.test.js`

```js
import { currentSeasonId } from './pvpSeason.js'

test('buildRosterRow: เรตข้ามซีซั่นต้องถูกบีบก่อนขึ้นบอร์ด (ไม่ใช่เรตดิบของเดือนก่อน)', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    pvp: { rating: 1600, wins: 9, losses: 1, seasonId: '2000-01' },   // ซีซั่นเก่าแน่ๆ
  })
  assert.ok(row.r < 1600, 'เรตบนบอร์ดยังเป็นของเดือนก่อน')
  assert.equal(row.r, 1300)   // soft reset: 1000 + (1600-1000)×0.5
})

test('buildRosterRow: เรตในซีซั่นปัจจุบันไม่ถูกแตะ', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    pvp: { rating: 1600, wins: 9, losses: 1, seasonId: currentSeasonId() },
  })
  assert.equal(row.r, 1600)
})

test('buildRosterRow: ไม่มี pvp เลย = เรตเริ่มต้น', () => {
  assert.equal(buildRosterRow({ uid: 'u1', nickname: 'เทส' }).r, 1000)
})
```

ℹ️ `src/utils/roster.test.js` import `test`/`assert`/`buildRosterRow` ไว้ครบแล้ว — เติมแค่บรรทัด `import { currentSeasonId } from './pvpSeason.js'` อย่าสร้าง import ซ้ำ

- [ ] **Step 2: รันเทสให้ล้ม**

Run: `node --test src/utils/roster.test.js`
Expected: FAIL — `row.r` ได้ 1600 ทั้งที่ควรเป็น 1300

- [ ] **Step 3: แก้ `src/utils/roster.js`**

เติม import ต่อจาก import ที่มี `PVP_RATING_START`:
```js
import { applySeasonReset, currentSeasonId } from './pvpSeason.js'
```
ใน `buildRosterRow` เปลี่ยนบรรทัด `r:` จาก
```js
    r:  num(d.pvp?.rating, PVP_RATING_START),
```
เป็น
```js
    // เรต "ของซีซั่นปัจจุบัน" — ไม่ใช่เรตดิบ เพราะ soft-reset จะถูกเขียนจริงต่อเมื่อเจ้าตัวบุกครั้งแรกของเดือน
    // ถ้าเขียนดิบ วันที่ 1 ของเดือน เจ้าตัวเห็นเรตบีบแล้วแต่ทั้งชั้นปียังเห็นเรตเดือนก่อน (คนเลิกเล่นค้างถาวร)
    r:  num(applySeasonReset(d.pvp, currentSeasonId()).rating, PVP_RATING_START),
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/roster.test.js`
Expected: PASS ทั้งไฟล์ (เทสเดิม + 3 ใหม่)

- [ ] **Step 5: Commit**

```bash
git add src/utils/roster.js src/utils/roster.test.js
git commit -m "Roster: เรตบนบอร์ดผ่าน soft-reset ซีซั่น (เดิมคนที่ยังไม่บุกเดือนใหม่ค้างเรตเดือนก่อน)"
```

---

### Task 6: ประกอบกระดาน + action รีเฟรช (`useArena.js` + `pvpRating.js`)

**Files:**
- Modify: `src/utils/pvpRating.js` (ลบ 2 ค่าคงที่)
- Modify: `src/composables/useArena.js`

**Interfaces:**
- Consumes: `pickHumanOpponents`, `BOARD_SIZE` (Task 3) · `getFallbackBots` (Task 4) · `teamPower`, `coinForResult` (Task 1) · `boardSeed`, `canRefresh`, `refreshLeftMs` (Task 2) · `rosterOpponents` (เดิม)
- Produces: `useArena()` คืนเพิ่ม `refreshBoard()`, `refreshLeft` (computed ms), `coinPreview(opp)` — ใช้โดย `ArenaView.vue` (Task 7)

- [ ] **Step 1: ลบค่าคงที่เหรียญคงที่ใน `src/utils/pvpRating.js`**

ลบ 2 บรรทัดนี้ทั้งคู่ (เหรียญคิดจากพลังทีมแล้ว ไม่ใช่ค่าคงที่):
```js
export const PVP_WIN_COIN = 200        // เหรียญเมื่อชนะคนจริง
export const PVP_BOT_COIN = 120        // เหรียญเมื่อชนะบอท
```

- [ ] **Step 2: แก้ import block ใน `src/composables/useArena.js`**

เปลี่ยนบล็อก import (บรรทัด ~12–18) จากของเดิม เป็น:
```js
import {
  nextRating, BOT_RATING_MULT, PVP_DAILY_ATTACKS,
} from '../utils/pvpRating.js'
import { currentSeasonId, applySeasonReset } from '../utils/pvpSeason.js'
import { getFallbackBots } from '../utils/pvpBot.js'
import { pickHumanOpponents, BOARD_SIZE } from '../utils/pvpMatch.js'
import { teamPower, coinForResult } from '../utils/pvpCoins.js'
import { boardSeed, canRefresh, refreshLeftMs } from '../utils/pvpBoard.js'
```
(`hashStr` ไม่ต้อง import แล้ว — `boardSeed` ห่อให้)

- [ ] **Step 3: แทนที่ computed `opponents` ทั้งบล็อกรวมคอมเมนต์**

```js
  // พลังทีมเรา — ฐานของทั้งการจ่ายเหรียญและการเล็งบอท
  const myPower = computed(() => teamPower(myTeam.value))

  // nonce ของกระดาน: ขยับเมื่อบุกจบ 1 ครั้ง หรือกดปุ่มรี · เก็บใน user doc ไม่ใช่ใน component
  // ⇒ โหลดหน้าใหม่ได้กระดานเดิม (ไม่งั้นกด F5 รัวๆ = รีฟรีไม่จำกัด cooldown ไร้ความหมาย)
  const boardNonce = computed(() => auth.userData?.pvpBoardNonce || 0)

  // กระดาน 5 ช่อง = เท่าโควตาบุก/วัน · คนจริงก่อน บอทเติมเฉพาะช่องที่ขาด
  // roster ให้ทีมมาพร้อมสู้แล้ว (เหมือนบอท) จึงไม่ต้องอ่าน doc คู่ต่อสู้เลย
  const opponents = computed(() => {
    const uid = auth.currentUser?.uid
    const seed = boardSeed(todayStr(), uid, boardNonce.value)
    const humans = pickHumanOpponents(
      rosterOpponents(members.rosterRows || {}, uid), rating.value, seed,
    )
    const bots = getFallbackBots(myPower.value, rating.value, seed, BOARD_SIZE - humans.length)
    return [...humans, ...bots]
  })

  // เหรียญที่จะได้ถ้าชนะคนนี้ — โชว์บนการ์ดให้เลือกได้ว่าจะเล่นปลอดภัยหรือกล้าเสี่ยง
  const coinPreview = (opp) => coinForResult(myPower.value, teamPower(opp?.team), true)

  // cooldown ปุ่มรีเฟรช (ms ที่เหลือ · 0 = กดได้)
  const refreshLeft = computed(() => refreshLeftMs(auth.userData?.pvpRefreshAt, Date.now()))
```

- [ ] **Step 4: แก้การคิดเหรียญใน `applyResult`**

แทนที่ 2 บรรทัดเดิม
```js
    // เหรียญ: ชนะคนจริง = PVP_WIN_COIN, ชนะบอท = PVP_BOT_COIN, แพ้ = 0
    const coin = won ? (opp.isBot ? PVP_BOT_COIN : PVP_WIN_COIN) : 0
```
ด้วย
```js
    // เหรียญตามส่วนต่างพลังทีม · แพ้ให้คนแกร่งกว่ายังได้ปลอบใจ (ดู pvpCoins)
    const coin = coinForResult(myPower.value, teamPower(opp.team), won)
```

ในบล็อก `patchUser` เพิ่ม `pvpBoardNonce` เข้าไปทั้งฝั่ง optimistic และฝั่ง server
**⚠️ CLAUDE.md ข้อ 9 — หยิบค่าก่อนเรียก `patchUser`** เพิ่มบรรทัดนี้ก่อน `const ok = await auth.patchUser(`:
```js
    const nextNonce = (auth.userData?.pvpBoardNonce || 0) + 1   // บุกจบ = กระดานชุดใหม่
```
แล้วเติม `pvpBoardNonce: nextNonce,` ต่อท้ายทั้งสอง object ที่ส่งให้ `patchUser`
(ฝั่ง server ใช้ค่าตรงๆ ไม่ใช้ `increment()` — จะได้ตรงกับ optimistic เป๊ะ กัน seed กระพริบ)

- [ ] **Step 5: เพิ่ม action `refreshBoard` (วางก่อน `return` ท้ายฟังก์ชัน)**

```js
  // กดรีเฟรชกระดานเอง — ฟรีแต่มี cooldown (การรีที่ได้จากการบุกจ่ายด้วยโควตาไปแล้ว)
  async function refreshBoard() {
    if (!canRefresh(auth.userData?.pvpRefreshAt, Date.now())) {
      const min = Math.ceil(refreshLeft.value / 60000)
      toast(`เปลี่ยนคู่ต่อสู้ได้อีกครั้งในอีก ${min} นาที`, 'info')
      return false
    }
    const now = Date.now()
    const nextNonce = (auth.userData?.pvpBoardNonce || 0) + 1
    const patch = { pvpBoardNonce: nextNonce, pvpRefreshAt: now }
    const ok = await auth.patchUser(patch, patch)
    if (!ok) toast('เปลี่ยนคู่ต่อสู้ไม่สำเร็จ', 'error')
    return ok
  }
```

- [ ] **Step 6: แก้บรรทัด `return` ท้าย `useArena`**

```js
  return {
    rating, wins, losses, attacksLeft, myTeam, opponents, fight,
    refreshBoard, refreshLeft, coinPreview,
  }
```

- [ ] **Step 7: เทส + build**

Run: `node --test src/utils/*.test.js src/data/*.test.js`
Expected: PASS ทั้งหมด

Run: `npm run build`
Expected: build เขียว (`✓ built`) — ถ้าล้มด้วย `PVP_WIN_COIN is not exported` แปลว่ายังมีที่อ้างค้าง ให้ `grep -rn "PVP_WIN_COIN\|PVP_BOT_COIN" src/` แล้วลบให้หมด

- [ ] **Step 8: Commit**

```bash
git add src/utils/pvpRating.js src/composables/useArena.js
git commit -m "PvP: ประกอบกระดานสด — nonce ต่อไฟต์/ปุ่มรี + เหรียญตามพลัง + บอทเติมช่องว่าง"
```

---

### Task 7: ปุ่มรีเฟรช + เหรียญที่จะได้ + ลบ dead UI (`ArenaView.vue`)

**Files:**
- Modify: `src/views/ArenaView.vue`

**Interfaces:**
- Consumes: `refreshBoard()`, `refreshLeft`, `coinPreview(opp)` จาก `useArena()` (Task 6)

- [ ] **Step 1: ลบ dead UI**

ลบบล็อกนี้ทั้งก้อน (นักศึกษาไม่มีทางเห็น — `onMounted` เด้งออกก่อนตั้งแต่ hard close `1397326`):
```html
      <!-- ก่อนเปิด: เห็น/จัดทีมได้ แต่ยังบุกไม่ได้ -->
      <div v-if="!canFight" class="ar-locked">
        <Emoji char="🔜" /> สนามประลองยังไม่เปิด — จัดทีมรอไว้ก่อนได้เลย เปิดพร้อมกันเร็ว ๆ นี้
      </div>
```
ลบ CSS `.ar-locked { ... }` ที่ไม่มีใครใช้แล้ว
และแก้คอมเมนต์หัวไฟล์ (บรรทัด 2–4) ให้ตรงความจริง:
```html
<!-- src/views/ArenaView.vue -->
<!-- สนามประลอง PvP — แต้มประลอง, กระดานคู่ต่อสู้ 5 ช่อง, บุก, จัดทีม
     สนามปิด = เด้งกลับ /play ทันที (นักศึกษาไม่เห็นหน้านี้เลย)
     admin: เข้าและบุกได้เสมอแม้ pvpOpen=false (ทดสอบก่อนเปิดจริง) -->
```

- [ ] **Step 2: เติมหัวกระดาน + ปุ่มรีเฟรช เหนือ `<div class="ar-list">`**

```html
      <div class="ar-board-head">
        <span class="ar-board-hint">ตีเสร็จได้คู่ใหม่ทันที</span>
        <button class="ar-refresh" :disabled="busy || refreshLeft > 0" @click="onRefresh">
          <Emoji char="🔄" /> {{ refreshLeft > 0 ? `อีก ${Math.ceil(refreshLeft / 60000)} นาที` : 'เปลี่ยนคู่' }}
        </button>
      </div>
```

- [ ] **Step 3: โชว์เหรียญที่จะได้บนแถวคู่ต่อสู้**

แทนที่บรรทัดเรต (บรรทัด ~35) ด้วย:
```html
            <span class="ar-opp-rt">
              {{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span>
              <span class="ar-opp-coin"><Emoji char="🪙" /> {{ coinPreview(opp).toLocaleString() }}</span>
            </span>
```
และเติมป้ายบอทในบรรทัดชื่อ (บรรทัด ~33) — บอทหลายตัวชื่อ "หุ่นซ้อม" เหมือนกันหมด แยกไม่ออกถ้าไม่ติดป้าย:
```html
              <Emoji :char="opp.isBot ? '🤖' : '🧑'" /> {{ opp.isBot ? ('หุ่นซ้อม' + (opp.label ? ' · ' + opp.label : '')) : (opp.nickname || '?') }}
```

- [ ] **Step 4: ต่อสายใน `<script setup>`**

เปลี่ยนบรรทัดที่ดึงค่าจาก `useArena()`:
```js
const { rating, wins, losses, attacksLeft, opponents, fight, refreshBoard, refreshLeft, coinPreview } = useArena()
```
เพิ่มฟังก์ชันต่อจาก `onFight`:
```js
async function onRefresh() {
  if (busy.value) return
  busy.value = true
  try { await refreshBoard() } finally { busy.value = false }
}
```

- [ ] **Step 5: เพิ่ม CSS (ต่อท้าย `<style scoped>`)**

```css
.ar-board-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ar-board-hint { font-size: .72rem; color: rgba(0,0,0,.5); }
.ar-refresh { border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 6px 12px; font-family: inherit; font-weight: 800; font-size: .74rem; cursor: pointer; box-shadow: var(--pop); display: inline-flex; align-items: center; gap: 5px; }
.ar-refresh:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ar-refresh:disabled { opacity: .5; cursor: default; }
.ar-opp-coin { margin-left: 6px; font-weight: 800; color: #b45309; }
```

- [ ] **Step 6: ตรวจฟอนต์ + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/views/ArenaView.vue`
Expected: ไม่เจออะไร (ฟอนต์ขั้นต่ำ `.7rem` ตาม CLAUDE.md)

Run: `npm run build`
Expected: build เขียว

- [ ] **Step 7: Commit**

```bash
git add src/views/ArenaView.vue
git commit -m "Arena: ปุ่มเปลี่ยนคู่ + เหรียญที่จะได้บนการ์ด + ลบแบนเนอร์ที่ไม่มีใครเห็น"
```

---

## Checklist เทสจอจริง (หลัง deploy + admin เปิดสนาม)

- [ ] admin เปิดสนาม (`config/app.pvpOpen=true`) → เข้า /arena ได้
- [ ] กระดานมี 5 ช่อง เป็นคนจริงทั้งหมด (ชั้นปีมีคนเกิน 5 คนที่มีทีม) — **ไม่ควรเห็นบอทเลย**
- [ ] **โหลดหน้าใหม่ (F5) → กระดานเดิมเป๊ะ** ไม่สุ่มใหม่ · ออกไป /play แล้วกลับมา → เดิมเป๊ะ
- [ ] บุก 1 ครั้ง (ชนะหรือแพ้) → กระดานเปลี่ยนชุดทันทีหลังปิดหน้าสรุป
- [ ] กด "เปลี่ยนคู่" → ได้ชุดใหม่ · กดซ้ำทันที → ปุ่มเทา ขึ้นเวลาที่เหลือ · โหลดหน้าใหม่แล้วกดอีก → ยังเทาอยู่ (cooldown ไม่รีเซ็ตด้วยการรีโหลด)
- [ ] เหรียญบนการ์ดคนแกร่งกว่า > คนอ่อนกว่า และตัวเลขที่ได้จริงหลังชนะตรงกับที่โชว์
- [ ] แพ้ให้คนแกร่งกว่า → ได้เหรียญปลอบใจ (หน้าสรุปโชว์) · แพ้ให้คนอ่อนกว่า → ได้ 0
- [ ] เจอเพื่อนหลากหลายขึ้นจริง — กดเปลี่ยนคู่หลายรอบข้ามวัน ต้องไม่วนอยู่กลุ่มเดิม
- [ ] โควตาหมด 5 ครั้ง → ปุ่มบุกเทาทั้งกระดาน แต่ปุ่มเปลี่ยนคู่ยังกดได้
- [ ] จัดทีมใหม่ให้แกร่งขึ้น → เหรียญบนการ์ดเดิมต้องลดลง (เพราะเทียบกับพลังเราที่สูงขึ้น)
- [ ] /tower + /members ยังทำงานปกติ (ใช้ roster ร่วม — Task 5 แตะ `buildRosterRow`)
- [ ] ขึ้นเดือนใหม่: เรตตัวเองบนหน้า /arena กับบนบอร์ดสมาชิกต้องตรงกันตั้งแต่ก่อนบุกครั้งแรก

## Self-Review

- **Spec coverage:** A1 สับไพ่ 2 รอบ=Task3 · A2 nonce+cooldown=Task2+6 · A3 กระดาน 5 ช่อง=Task3(BOARD_SIZE)+6 · B1 teamPower=Task1 · B2 สูตร=Task1 · B3 ปลอบใจ+หมายเหตุ passive=Task1 (คอมเมนต์ในโค้ด) · B4 ผลลัพธ์=เทส Task1 + เช็คลิสต์จอจริง · C บอทสำรองตามพลัง=Task4+6 · D เรตซีซั่น=Task5, dead UI=Task7 ✓ ครบทุกหัวข้อ
- **Placeholder scan:** ไม่มี TBD/TODO · ทุก step ที่แตะโค้ดมีบล็อกโค้ดจริง ✓
- **Type consistency:** `teamPower(team)`/`coinForResult(myPower, oppPower, won)` นิยาม Task1 → ใช้ Task4/6 ตรงกัน ✓ · `boardSeed(dayStr, uid, nonce)`/`refreshLeftMs(lastAt, now)`/`canRefresh(lastAt, now)` นิยาม Task2 → ใช้ Task6 ตรงกัน ✓ · `pickHumanOpponents(candidates, myRating, seed, n, window)` + `BOARD_SIZE` นิยาม Task3 → ใช้ Task6 ตรงกัน ✓ · `getFallbackBots(myPower, myRating, seed, count)` นิยาม Task4 → ใช้ Task6 ตรงกัน ✓ · `refreshBoard`/`refreshLeft`/`coinPreview` ที่ Task6 export → ใช้ Task7 ตรงกัน ✓
- **ชื่อที่ถูกลบต้องไม่มีใครอ้างค้าง:** `PVP_WIN_COIN`, `PVP_BOT_COIN` (Task6 Step1) · `HUMAN_POOL` (Task3) · `botPowerFor`, `getPvpBot`, `getPvpBots`, `BOT_RATING_SPREAD` (Task4) — ตรวจไว้แล้วว่าไม่มีที่อื่นใน `src/` อ้างถึงนอกจากไฟล์เทสของตัวเอง ซึ่งถูกเขียนทับใน task เดียวกัน ✓
