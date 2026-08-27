# Time Attack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** โหมดข้อสอบจับเวลา 4 / 15 นาที ตอบให้ได้มากที่สุด พร้อมกระดานอันดับในรุ่น — ปลดการ์ด "เร็วๆ นี้" ที่ค้างมาตั้งแต่ 23 มิ.ย.

**Architecture:** หน้าแยก `/study/time-attack` (แพทเทิร์นเดียวกับ `/study/crcl`) · 3 จอในไฟล์เดียว (เลือก/เล่น/ผล) · โจทย์ไหลมาเป็นล็อตละ 25 ข้อแบบ prefetch ไม่ block นาฬิกา · สถิติดีสุดเก็บใน user doc แล้วสะท้อนขึ้นแถว roster ⇒ กระดานอันดับใช้ 0 read เพิ่ม

**Tech Stack:** Vue 3 `<script setup>` · Pinia · Firestore (`orderBy('rand')` windowed sampling) · เทส `node --test`

**Spec:** `docs/superpowers/specs/2026-08-28-time-attack-design.md`

## Global Constraints

- ห้ามมี `font-size` ต่ำกว่า `.7rem` ในไฟล์ `.vue`/`.css` ใดๆ (ตรวจ: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`)
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น — `server` ใช้ **dot-notation** สำหรับ nested map (`patchUser` ใช้ `updateDoc` ⇒ dot-notation ทำงาน) · **ห้ามส่ง `study` ทั้งก้อน** ไม่งั้นทับ `study.cards`
- นาฬิกาคำนวณจาก `endAt - Date.now()` ทุก tick — **ห้ามสะสมเวลาจาก tick** (มือถือ throttle `setInterval` ตอนสลับแอป)
- ห้ามยกเลิกโหมด/สลับหมวดระหว่างเล่น · ทั้งรุ่นต้องเจอกติกาเดียวกันถึงเทียบคะแนนได้ (ไม่มีตัวเลือกหมวด)
- เหรียญ = `ถูก × QUIZ_COIN_PER_CORRECT` (100) เท่าโหมดปกติ · ไม่มี combo/streak multiplier
- คีย์ในแถว roster สั้นเสมอ (`ta4`, `ta15`) และ **ใส่ต่อเมื่อ > 0**
- อ่านกระดานจาก `members.rosterRows` **ไม่ใช่ `rosterUsers`** (`rosterUsers` คีย์ด้วย studentId จึงตก guest ทั้งหมด)
- commit รูปแบบ `Area: อะไร (ทำไม)` เป็นไทย · คอมเมนต์ในโค้ดไทยปนอังกฤษตามสไตล์รีโป

---

### Task 1: `utils/timeAttack.js` — ตรรกะล้วน + เทส

**Files:**
- Create: `src/utils/timeAttack.js`
- Test: `src/utils/timeAttack.test.js`

**Interfaces:**
- Consumes: ไม่มี (pure)
- Produces:
  - `TA_MODES = [{ key, minutes, ms, emoji, label, tagline, bestField, rowKey }]` — `key` เป็น `'ta4' | 'ta15'`
  - `getTaMode(key) -> mode | null`
  - `TA_BATCH = 25` · `TA_REFILL_AT = 8` · `TA_FLASH_MS = 400` · `TA_TICK_MS = 200` · `TA_EMPTY_STREAK_MAX = 2`
  - `remainingMs(endAt, now) -> number` (ไม่ติดลบ)
  - `clockLabel(ms) -> 'M:SS'`
  - `newBest(prev, score) -> { best, isNew }`
  - `taBoard(rows, me, rowKey, max = 10) -> { top: [{ uid, name, photo, best, rank, isMe }], mine: row|null }`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
// src/utils/timeAttack.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TA_MODES, getTaMode, remainingMs, clockLabel, newBest, taBoard,
} from './timeAttack.js'

test('TA_MODES มี 4 และ 15 นาที พร้อมคีย์ที่ผูกกับ user doc / roster', () => {
  assert.deepEqual(TA_MODES.map(m => m.key), ['ta4', 'ta15'])
  assert.equal(TA_MODES[0].ms, 4 * 60_000)
  assert.equal(TA_MODES[1].ms, 15 * 60_000)
  assert.equal(TA_MODES[0].bestField, 'best4')
  assert.equal(TA_MODES[1].rowKey, 'ta15')
  assert.equal(getTaMode('ta4').minutes, 4)
  assert.equal(getTaMode('nope'), null)
})

test('remainingMs ไม่ติดลบ และ 0 เมื่อยังไม่เริ่ม', () => {
  assert.equal(remainingMs(1000, 400), 600)
  assert.equal(remainingMs(1000, 5000), 0)
  assert.equal(remainingMs(0, 5000), 0)
  assert.equal(remainingMs(null, 5000), 0)
})

test('clockLabel ปัดขึ้นวินาที และเติมศูนย์หน้า', () => {
  assert.equal(clockLabel(240_000), '4:00')
  assert.equal(clockLabel(65_000), '1:05')
  assert.equal(clockLabel(9_400), '0:10', 'ปัดขึ้น — เหลือ 9.4 วิยังไม่ควรโชว์ 0:09')
  assert.equal(clockLabel(0), '0:00')
})

test('newBest บอกว่าทำลายสถิติไหม', () => {
  assert.deepEqual(newBest(10, 14), { best: 14, isNew: true })
  assert.deepEqual(newBest(10, 10), { best: 10, isNew: false }, 'เท่าเดิมไม่นับว่าทำลาย')
  assert.deepEqual(newBest(10, 3), { best: 10, isNew: false })
  assert.deepEqual(newBest(undefined, 1), { best: 1, isNew: true })
  assert.deepEqual(newBest(0, 0), { best: 0, isNew: false }, 'ได้ 0 ข้อไม่ใช่สถิติใหม่')
})

const rows = {
  a: { n: 'เอ', p: 'photoA', ta4: 20 },
  b: { n: 'บี', p: null, ta4: 35, ta15: 90 },
  c: { n: 'ซี', p: null },                       // ยังไม่เคยเล่น
  g: { n: 'เกสต์', p: null, g: 'guest', ta4: 28 },
}

test('taBoard เรียงมาก→น้อย ตัดคนที่ยังไม่เคยเล่น และติดอันดับให้', () => {
  const { top } = taBoard(rows, null, 'ta4')
  assert.deepEqual(top.map(r => r.uid), ['b', 'g', 'a'])
  assert.deepEqual(top.map(r => r.rank), [1, 2, 3])
  assert.equal(top.find(r => r.uid === 'c'), undefined, 'best=0 ต้องไม่ขึ้นกระดาน')
})

test('taBoard รวม guest (อ่านจาก rosterRows ไม่ใช่ rosterUsers)', () => {
  assert.equal(taBoard(rows, null, 'ta4').top.some(r => r.uid === 'g'), true)
})

test('taBoard overlay ค่าสดของฉันทับแถว roster ที่ยังไม่ทัน sync', () => {
  const me = { uid: 'a', name: 'เอ', photo: 'photoA', best: 99 }
  const { top } = taBoard(rows, me, 'ta4')
  assert.equal(top[0].uid, 'a')
  assert.equal(top[0].best, 99)
  assert.equal(top[0].isMe, true)
  assert.equal(top.filter(r => r.uid === 'a').length, 1, 'ห้ามซ้ำสองแถว')
})

test('taBoard ไม่ลดค่าลงถ้า roster สูงกว่าค่าสดในเครื่อง', () => {
  const { top } = taBoard(rows, { uid: 'b', name: 'บี', best: 1 }, 'ta4')
  assert.equal(top[0].best, 35)
})

test('taBoard คนใหม่ที่ยังไม่มีแถวใน roster ก็ขึ้นกระดานได้', () => {
  const { top } = taBoard(rows, { uid: 'zz', name: 'ใหม่', best: 50 }, 'ta4')
  assert.equal(top[0].uid, 'zz')
})

test('taBoard ตัดที่ max และคืน mine แยกเมื่อเราหลุด top', () => {
  const many = {}
  for (let i = 0; i < 20; i++) many['u' + i] = { n: 'u' + i, ta4: 100 - i }
  many.me = { n: 'ฉัน', ta4: 1 }
  const { top, mine } = taBoard(many, { uid: 'me', name: 'ฉัน', best: 1 }, 'ta4')
  assert.equal(top.length, 10)
  assert.equal(mine.uid, 'me')
  assert.equal(mine.rank, 21)
})

test('taBoard ไม่คืน mine ซ้ำเมื่อเราติด top อยู่แล้ว', () => {
  assert.equal(taBoard(rows, { uid: 'b', name: 'บี', best: 35 }, 'ta4').mine, null)
})

test('taBoard รับ rows ว่าง/undefined ได้', () => {
  assert.deepEqual(taBoard(undefined, null, 'ta4'), { top: [], mine: null })
  assert.deepEqual(taBoard({}, null, 'ta15'), { top: [], mine: null })
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าล้มเหลว**

Run: `node --test src/utils/timeAttack.test.js`
Expected: FAIL — `Cannot find module './timeAttack.js'`

- [ ] **Step 3: เขียน implementation**

```js
// src/utils/timeAttack.js
/**
 * Time Attack — ตรรกะล้วน ไม่แตะ Firestore/Vue/DOM
 * นาฬิกา · สถิติดีสุด · กระดานอันดับในรุ่น
 *
 * spec: docs/superpowers/specs/2026-08-28-time-attack-design.md
 * เทส: node --test src/utils/timeAttack.test.js
 */

/**
 * โหมดที่เล่นได้ — `key` ใช้เป็นทั้ง query param, ฟิลด์ใน examSessions (`mode`) และตัวเลือกกระดาน
 * `bestField` = คีย์ใน user doc `timeAttack.*` · `rowKey` = คีย์ในแถว roster
 */
export const TA_MODES = [
  { key: 'ta4',  minutes: 4,  ms: 4 * 60_000,  emoji: '⚡', label: '4 นาที',
    tagline: 'รอบเร็ว — ตอบให้ไวที่สุด',  bestField: 'best4',  rowKey: 'ta4'  },
  { key: 'ta15', minutes: 15, ms: 15 * 60_000, emoji: '🔥', label: '15 นาที',
    tagline: 'รอบยาว — วัดความอึด',       bestField: 'best15', rowKey: 'ta15' },
]

export const getTaMode = (key) => TA_MODES.find(m => m.key === key) || null

// ── ค่าคงที่จังหวะเกม ──
export const TA_BATCH = 25            // ดึงโจทย์ล็อตละกี่ข้อ (= reads ต่อล็อต)
export const TA_REFILL_AT = 8         // เหลือในคิวเท่านี้ → ยิงล็อตถัดไป (ไม่ block นาฬิกา)
export const TA_FLASH_MS = 400        // โชว์ไฟเขียว/แดงนานเท่าไหร่ก่อนไปข้อถัดไป
export const TA_TICK_MS = 200         // ถี่กว่า 1 วิ เพื่อให้เลขไม่กระตุกและจบไม่คลาดเกิน .2 วิ
export const TA_EMPTY_STREAK_MAX = 2  // ดึงแล้วไม่ได้ข้อใหม่ติดกันกี่ครั้งถึงถือว่าคลังหมดจริง

/** เวลาที่เหลือ (ms) — คำนวณจากเวลาปลายทางเสมอ ห้ามสะสมจาก tick */
export function remainingMs(endAt, now) {
  if (!endAt) return 0
  return Math.max(0, endAt - now)
}

/** ms → 'M:SS' (ปัดขึ้น — เหลือ 0.4 วิ ยังต้องเห็น 0:01) */
export function clockLabel(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** สถิติใหม่? — เท่าเดิมไม่นับ (กันป้าย "ทำลายสถิติ" เด้งทุกรอบที่ตัน) */
export function newBest(prev, score) {
  const p = Number(prev) || 0
  const s = Number(score) || 0
  return { best: Math.max(p, s), isNew: s > p }
}

/**
 * กระดานอันดับในรุ่น — จาก `rosterRows` ที่โหลดอยู่แล้ว ⇒ ไม่มี read เพิ่ม
 * @param rows   members.rosterRows ({ [uid]: row }) — ใช้ตัวนี้ ไม่ใช่ rosterUsers (ตก guest)
 * @param me     { uid, name, photo, best } ค่าสดจาก user doc (roster อาจยังไม่ทัน sync) หรือ null
 * @param rowKey 'ta4' | 'ta15'
 * @returns { top, mine } — mine มีค่าต่อเมื่อเราไม่ติด top (คนอันดับ 30 ต้องเห็นตัวเองด้วย)
 */
export function taBoard(rows, me, rowKey, max = 10) {
  const list = []
  for (const [uid, row] of Object.entries(rows || {})) {
    list.push({ uid, name: row?.n || '?', photo: row?.p || null, best: Number(row?.[rowKey]) || 0, isMe: false })
  }
  if (me?.uid) {
    const mineRow = list.find(r => r.uid === me.uid)
    const best = Math.max(Number(me.best) || 0, mineRow?.best || 0)
    if (mineRow) {
      mineRow.best = best
      mineRow.isMe = true
      mineRow.name = me.name || mineRow.name
    } else {
      list.push({ uid: me.uid, name: me.name || '?', photo: me.photo || null, best, isMe: true })
    }
  }
  const ranked = list
    .filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best || String(a.name).localeCompare(String(b.name), 'th'))
    .map((r, i) => ({ ...r, rank: i + 1 }))
  const top = ranked.slice(0, max)
  const mine = ranked.find(r => r.isMe) || null
  return { top, mine: mine && mine.rank > max ? mine : null }
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/timeAttack.test.js`
Expected: PASS ทุกเทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/timeAttack.js src/utils/timeAttack.test.js
git commit -m "Time Attack: ตรรกะนาฬิกา/สถิติ/กระดานอันดับ (pure + เทส)"
```

---

### Task 2: ที่เก็บสถิติ — `userSchema` + แถว roster

**Files:**
- Modify: `src/data/userSchema.js`
- Modify: `src/utils/roster.js` (`buildRosterRow`)
- Test: `src/utils/roster.test.js`, `src/data/userSchema.test.js`

**Interfaces:**
- Consumes: ไม่มี
- Produces: `USER_DEFAULTS.timeAttack = { best4: 0, best15: 0 }` · แถว roster มี `ta4` / `ta15` เมื่อ > 0

⚠️ ถ้าทำ plan `2026-08-28-pvp-history.md` มาก่อน `buildRosterRow` จะมีพารามิเตอร์ที่ 2 (`prev`) แล้ว — **อย่าลบทิ้ง** เติม `ta4`/`ta15` เข้าไปในตัวเดิม

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

ต่อท้าย `src/utils/roster.test.js`:

```js
test('buildRosterRow ใส่ ta4/ta15 เฉพาะที่ > 0 (กันแถวบวมด้วยศูนย์)', () => {
  const r = buildRosterRow(user({ timeAttack: { best4: 23, best15: 0 } }))
  assert.equal(r.ta4, 23)
  assert.equal('ta15' in r, false)
  const empty = buildRosterRow(user())
  assert.equal('ta4' in empty, false)
  assert.equal('ta15' in empty, false)
})

test('buildRosterRow ทน timeAttack เพี้ยน/ไม่ใช่ตัวเลข', () => {
  assert.equal('ta4' in buildRosterRow(user({ timeAttack: null })), false)
  assert.equal('ta4' in buildRosterRow(user({ timeAttack: { best4: 'มั่ว' } })), false)
})
```

ต่อท้าย `src/data/userSchema.test.js` (ดูรูปแบบเทสที่มีอยู่ในไฟล์แล้วเขียนให้เข้ากัน):

```js
test('normalizeUserData เติม timeAttack ให้ user เก่าที่ยังไม่มีฟิลด์', () => {
  const d = normalizeUserData({})
  assert.deepEqual(d.timeAttack, { best4: 0, best15: 0 })
})

test('normalizeUserData คงสถิติเดิมและเติมคีย์ที่ขาด', () => {
  const d = normalizeUserData({ timeAttack: { best4: 30 } })
  assert.equal(d.timeAttack.best4, 30)
  assert.equal(d.timeAttack.best15, 0)
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าล้มเหลว**

Run: `node --test src/utils/roster.test.js src/data/userSchema.test.js`
Expected: FAIL ทั้งสองไฟล์

- [ ] **Step 3: เติม `userSchema`**

ใน `USER_DEFAULTS` (วางใกล้ `minigames: {}` บรรทัด ~68):

```js
  timeAttack: { best4: 0, best15: 0 },   // คะแนนดีสุดโหมดจับเวลา (ดู utils/timeAttack.js)
```

ใน `normalizeUserData` วางถัดจากบรรทัดที่จัดการ `minigames` (~154) โดยใช้แพทเทิร์นเดียวกับ `d.pvp`:

```js
  d.timeAttack = { ...USER_DEFAULTS.timeAttack, ...(isObj(data.timeAttack) ? data.timeAttack : {}) }
```

- [ ] **Step 4: เติมแถว roster**

ใน `src/utils/roster.js` เหนือ `return` ของ `buildRosterRow`:

```js
  // Time Attack: ใส่เฉพาะที่ทำได้จริง — แถวนี้ทุกคนทั้งรุ่นโหลดทุกเซสชัน
  const ta4  = num(d.timeAttack?.best4, 0)
  const ta15 = num(d.timeAttack?.best15, 0)
```

และในตัว object ที่ return ต่อจาก `tm,` (ถ้ามี `h` ให้วาง `ta*` **ก่อน** `h` เพื่อคงลำดับคีย์คงที่):

```js
    ...(ta4  ? { ta4 }  : {}),
    ...(ta15 ? { ta15 } : {}),
```

- [ ] **Step 5: รันเทสให้ผ่าน**

Run: `node --test src/utils/roster.test.js src/data/userSchema.test.js`
Expected: PASS ทั้งสองไฟล์ (เทสเดิมต้องไม่พัง)

- [ ] **Step 6: Commit**

```bash
git add src/data/userSchema.js src/data/userSchema.test.js src/utils/roster.js src/utils/roster.test.js
git commit -m "Time Attack: ที่เก็บสถิติใน user doc + สะท้อนขึ้นแถว roster (กระดานอันดับไม่ต้องอ่านเพิ่ม)"
```

---

### Task 3: แยกการดึงโจทย์เป็นของใช้ร่วม

**Files:**
- Create: `src/composables/useQuestionFeed.js`
- Create: `src/utils/quizShuffle.js`
- Create: `src/utils/quizShuffle.test.js`
- Modify: `src/views/QuizView.vue` (ลบ `fetchQuestions`, `shuffle`, `shuffleChoices` ที่เป็นสำเนาในไฟล์)

**Interfaces:**
- Consumes: `quizSample` (มีอยู่แล้ว `src/utils/quizSample.js`)
- Produces:
  - `useQuestionFeed() -> { fetchQuestions(n, { domain = '__all', examSet = null }) }` — คืน array ของ `{ id, ...data }` ที่มี `choices` ≥ 2 ตัว
  - `shuffle(arr) -> arr ใหม่` · `shuffleChoices(q) -> q ใหม่ที่สลับตัวเลือกและ remap `answer``

**เป้าหมาย:** ไม่ให้ตรรกะสุ่ม windowed `orderBy('rand')` + wrap มีสำเนาที่สองตอน Time Attack เข้ามาใช้ · **พฤติกรรมของ QuizView ต้องเหมือนเดิมเป๊ะ**

- [ ] **Step 1: เขียนเทส `quizShuffle`**

```js
// src/utils/quizShuffle.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { shuffle, shuffleChoices } from './quizShuffle.js'

test('shuffle ไม่แตะ array เดิม และคงสมาชิกครบ', () => {
  const src = [1, 2, 3, 4, 5]
  const out = shuffle(src)
  assert.deepEqual(src, [1, 2, 3, 4, 5], 'ต้นฉบับต้องไม่ถูกแก้')
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5])
})

test('shuffleChoices สลับตัวเลือกแล้ว answer ยังชี้ข้อความเดิม', () => {
  const q = { id: 'q1', question: 'อะไร', choices: ['ก', 'ข', 'ค', 'ง'], answer: 2 }
  for (let i = 0; i < 50; i++) {
    const s = shuffleChoices(q)
    assert.equal(s.choices[s.answer], 'ค', 'เฉลยต้องยังเป็นข้อความเดิมเสมอ')
    assert.equal(s.choices.length, 4)
    assert.deepEqual([...s.choices].sort(), ['ก', 'ข', 'ค', 'ง'])
    assert.equal(s.id, 'q1', 'ฟิลด์อื่นต้องติดไปด้วย')
    assert.deepEqual(q.choices, ['ก', 'ข', 'ค', 'ง'], 'ต้นฉบับต้องไม่ถูกแก้')
  }
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าล้มเหลว**

Run: `node --test src/utils/quizShuffle.test.js`
Expected: FAIL — `Cannot find module './quizShuffle.js'`

- [ ] **Step 3: สร้าง `utils/quizShuffle.js`** (ยกโค้ดเดิมจาก `QuizView.vue` มาทั้งดุ้น ไม่แก้ตรรกะ)

```js
// src/utils/quizShuffle.js
/** สลับลำดับ — คืน array ใหม่ ไม่แตะต้นฉบับ (Fisher–Yates) */
export function shuffle(arr) {
  const a = (arr || []).slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

/**
 * สลับตำแหน่งตัวเลือกในข้อหนึ่ง + remap index เฉลยให้ตรงตำแหน่งใหม่
 * (กันคนจำว่า "เฉลยคือข้อ ก" จากการทำซ้ำ — ให้จำเนื้อหาแทน)
 */
export function shuffleChoices(q) {
  const order = shuffle(q.choices.map((_, i) => i))
  return {
    ...q,
    choices: order.map(i => q.choices[i]),
    answer: order.indexOf(q.answer),
  }
}
```

- [ ] **Step 4: สร้าง `composables/useQuestionFeed.js`**

```js
// src/composables/useQuestionFeed.js
/**
 * ดึงโจทย์สุ่มจากคลัง — ใช้ร่วมโดย QuizView (ทั่วไป/Zen) และ TimeAttackView
 *
 * วิธีสุ่ม: ทุกข้อมีฟิลด์ `rand` (0..1) → เปิดหน้าต่างที่ `startAt(Math.random())`
 * ถ้าได้ไม่ครบ (ชนปลายช่วง) ค่อยวนกลับไปดึงจากต้นแล้วผสมด้วย `quizSample`
 * ⇒ ไม่ต้องอ่านคลังทั้งก้อน · 1 query = n reads
 *
 * ⚠️ ต้องมี composite index: isPublished + rand (และ isPublished + examSets CONTAINS + rand)
 */
import { collection, getDocs, query, where, orderBy, startAt, limit } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useUsageStore } from '../stores/usage.js'
import { quizSample } from '../utils/quizSample.js'

export function useQuestionFeed() {
  const usage = useUsageStore()

  /**
   * @param n         จำนวนข้อที่ขอ (ได้จริงอาจน้อยกว่าถ้าคลัง/หมวดมีไม่พอ)
   * @param domain    '__all' = ทุกหมวด
   * @param examSet   ชื่อชุดย้อนหลัง (สลับกับ domain — ใส่แล้ว domain ถูกมองข้าม)
   */
  async function fetchQuestions(n, { domain = '__all', examSet = null } = {}) {
    const R = Math.random()
    const base = [where('isPublished', '==', true)]
    // ชุดย้อนหลังมาก่อน (สลับกับหมวด) — ใช้ composite index isPublished+examSets(CONTAINS)+rand
    if (examSet) base.push(where('examSets', 'array-contains', examSet))
    else if (domain && domain !== '__all') base.push(where('domain', '==', domain))
    const col = collection(db, 'questions')
    const firstSnap = await getDocs(query(col, ...base, orderBy('rand'), startAt(R), limit(n)))
    usage.track(firstSnap.size)
    const first = firstSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    let wrap = []
    if (first.length < n) {
      const wrapSnap = await getDocs(query(col, ...base, orderBy('rand'), limit(n)))
      usage.track(wrapSnap.size)
      wrap = wrapSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    }
    return quizSample(first, wrap, n).filter(q => Array.isArray(q.choices) && q.choices.length >= 2)
  }

  return { fetchQuestions }
}
```

- [ ] **Step 5: เปลี่ยน `QuizView.vue` ให้ใช้ของกลาง**

1. ลบฟังก์ชัน `shuffle`, `shuffleChoices` และ `fetchQuestions` ออกจากไฟล์
2. เพิ่ม import:

```js
import { shuffle, shuffleChoices } from '../utils/quizShuffle.js'
import { useQuestionFeed } from '../composables/useQuestionFeed.js'
```

3. ใต้ `const { toast } = useToast()` เพิ่ม:

```js
const { fetchQuestions: feedQuestions } = useQuestionFeed()
// ห่อให้ผู้เรียกเดิม (start/startZen) ยังส่งแค่จำนวนข้อได้เหมือนเดิม
const fetchQuestions = (n) => feedQuestions(n, { domain: dom.value, examSet: examSet.value })
```

4. ล้าง import ที่ไม่ได้ใช้แล้วจากบรรทัด `import { collection, getDocs, ... } from 'firebase/firestore'` — **ตรวจทีละตัวด้วย grep ก่อนลบ**:

```bash
grep -n "startAt\|quizSample" src/views/QuizView.vue
```
`startAt` และ import ของ `quizSample` ต้องไม่เหลือการใช้งานแล้ว ⇒ ลบทั้งสอง
(`collection`, `getDocs`, `query`, `where`, `orderBy`, `limit`, `documentId` ยังใช้อยู่ใน `loadHistory` / `fetchQuestionsByIds` — **ห้ามลบ**)

- [ ] **Step 6: รันเทส + บิลด์**

```bash
node --test src/utils/quizShuffle.test.js
npm run build
```
Expected: เทสผ่าน · build ผ่านไม่มี warning เรื่อง unused import ที่ทำให้ error

- [ ] **Step 7: เทสด้วยมือใน dev**

```bash
npm run dev
```
เปิด `/quiz` → เลือกหมวด → เริ่ม → ต้องได้โจทย์ตามปกติ · เปิด `/quiz?mode=zen` → ทำเกิน 13 ข้อ ต้องมีข้อไหลต่อ
(นี่คือการยืนยันว่าการ refactor ไม่เปลี่ยนพฤติกรรม)

- [ ] **Step 8: Commit**

```bash
git add src/composables/useQuestionFeed.js src/utils/quizShuffle.js src/utils/quizShuffle.test.js src/views/QuizView.vue
git commit -m "Quiz: แยกการสุ่มดึงโจทย์เป็น useQuestionFeed (Time Attack จะได้ไม่ก๊อปตรรกะสุ่มเป็นสำเนาที่สอง)"
```

---

### Task 4: หน้า Time Attack — จอเลือกโหมด + กระดานอันดับ + ทางเข้า

**Files:**
- Create: `src/views/TimeAttackView.vue`
- Create: `src/components/study/TaBoard.vue`
- Modify: `src/router/index.js`
- Modify: `src/views/StudyView.vue` (การ์ดโหมด)
- Modify: `src/data/guide.js`

**Interfaces:**
- Consumes: `TA_MODES`, `taBoard` (Task 1) · `members.rosterRows`
- Produces: route `/study/time-attack` ชื่อ `timeAttack` · component `TaBoard` รับ prop `rowKey`

- [ ] **Step 1: สร้าง `TaBoard.vue`**

```vue
<!-- src/components/study/TaBoard.vue -->
<!-- กระดานอันดับ Time Attack — อ่านจาก roster ที่โหลดอยู่แล้ว ⇒ ไม่มี read เพิ่ม
     ⚠️ ใช้ rosterRows ไม่ใช่ rosterUsers (rosterUsers คีย์ด้วย studentId จึงตก guest ทั้งหมด) -->
<template>
  <div class="tb">
    <div class="tb-head">
      <span class="tb-title"><Emoji char="🏅" /> อันดับในรุ่น · {{ label }}</span>
    </div>
    <div v-if="members.rosterLoading && !board.top.length" class="tb-empty">กำลังโหลด…</div>
    <div v-else-if="!board.top.length" class="tb-empty">ยังไม่มีใครทำสถิติไว้ — เป็นคนแรกเลยไหม?</div>
    <template v-else>
      <div v-for="r in board.top" :key="r.uid" class="tb-row" :class="{ me: r.isMe }">
        <span class="tb-rank" :class="'r' + r.rank">{{ r.rank }}</span>
        <span class="tb-name">{{ r.name }}<span v-if="r.isMe" class="tb-you"> (คุณ)</span></span>
        <span class="tb-best">{{ r.best }} ข้อ</span>
      </div>
      <div v-if="board.mine" class="tb-row me tb-mine">
        <span class="tb-rank">{{ board.mine.rank }}</span>
        <span class="tb-name">{{ board.mine.name }}<span class="tb-you"> (คุณ)</span></span>
        <span class="tb-best">{{ board.mine.best }} ข้อ</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useMembersStore } from '../../stores/members.js'
import { taBoard, getTaMode } from '../../utils/timeAttack.js'

const props = defineProps({ modeKey: { type: String, required: true } })

const auth = useAuthStore()
const members = useMembersStore()

const mode = computed(() => getTaMode(props.modeKey))
const label = computed(() => mode.value?.label || '')

// overlay ค่าสดของเราทับแถว roster — เพิ่งจบรอบแล้ว roster อาจยังไม่ทัน sync
const me = computed(() => {
  const u = auth.userData
  if (!u || !auth.currentUser) return null
  return {
    uid: auth.currentUser.uid,
    name: u.nickname || u.name?.split(' ')[0] || 'ฉัน',
    photo: u.googlePhoto || null,
    best: u.timeAttack?.[mode.value?.bestField] || 0,
  }
})

const board = computed(() => taBoard(members.rosterRows || {}, me.value, mode.value?.rowKey || 'ta4'))
</script>

<style scoped>
.tb { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; }
.tb-head { margin-bottom: 8px; }
.tb-title { font-size: .84rem; font-weight: 800; }
.tb-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px dashed rgba(0,0,0,.12); font-size: .78rem; }
.tb-row.me { background: var(--primary-light); border-radius: 8px; padding-left: 6px; padding-right: 6px; }
.tb-mine { margin-top: 6px; border-top: 2px solid rgba(0,0,0,.18); }
.tb-rank { width: 24px; text-align: center; font-weight: 800; color: rgba(0,0,0,.45); flex-shrink: 0; font-size: .76rem; }
.tb-rank.r1 { color: #d97706; }
.tb-rank.r2 { color: #64748b; }
.tb-rank.r3 { color: #b45309; }
.tb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.tb-you { color: var(--primary); font-weight: 800; }
.tb-best { font-weight: 800; flex-shrink: 0; }
.tb-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .76rem; padding: 14px 8px; line-height: 1.6; }
</style>
```

- [ ] **Step 2: สร้าง `TimeAttackView.vue` — จอเลือกโหมดเท่านั้น**

(Task 5/6 จะเติมจอเล่นและจอผลในไฟล์เดียวกัน · ขั้นนี้ต้องเปิดหน้าได้และเห็นกระดานจริง)

```vue
<!-- src/views/TimeAttackView.vue -->
<!-- Time Attack — ข้อสอบจับเวลา 4/15 นาที + กระดานอันดับในรุ่น
     spec: docs/superpowers/specs/2026-08-28-time-attack-design.md
     หลักการ: เวลาคือทรัพยากร ⇒ ระหว่างเล่นไม่มีอะไรให้อ่านนอกจากโจทย์
              คำอธิบายทั้งหมดยกไปไว้จอผล -->
<template>
  <div class="tab-content">
    <div class="ta-head">
      <button class="ta-back" aria-label="ย้อนกลับ" @click="onBack">‹</button>
      <span class="ta-head-title"><Emoji char="⏱️" /> Time Attack</span>
      <HelpButton topic="timeAttack" style="margin-left:auto" />
    </div>

    <div v-if="!auth.isLoggedIn" class="ta-empty">เข้าสู่ระบบเพื่อเล่น</div>

    <!-- ── เลือกโหมด ── -->
    <template v-else-if="stage === 'pick'">
      <div class="ta-intro">ตอบให้ได้มากที่สุดก่อนหมดเวลา · ตอบแล้วไปข้อถัดไปทันที เฉลยทั้งหมดรอดูตอนจบ</div>

      <div class="ta-modes">
        <button v-for="m in TA_MODES" :key="m.key" class="ta-mode" :disabled="starting" @click="startRun(m)">
          <span class="ta-mode-emoji"><Emoji :char="m.emoji" /></span>
          <span class="ta-mode-text">
            <b>{{ m.label }}</b>
            <small>{{ m.tagline }}</small>
          </span>
          <span class="ta-mode-best">
            <span class="ta-mode-best-n">{{ bestOf(m) }}</span>
            <span class="ta-mode-best-l">สถิติเดิม</span>
          </span>
        </button>
      </div>
      <div v-if="starting" class="ta-loading">กำลังเตรียมข้อสอบ…</div>

      <div class="ta-boards">
        <TaBoard v-for="m in TA_MODES" :key="m.key" :mode-key="m.key" />
      </div>

      <div class="ta-hint">ตอบถูกได้เหรียญ +{{ QUIZ_COIN_PER_CORRECT }}/ข้อ เท่าโหมดปกติ · ข้อที่ตอบผิดจะถูกเก็บไปไว้ในโหมด "ข้อที่เคยผิด" ให้อัตโนมัติ</div>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import HelpButton from '../components/help/HelpButton.vue'
import TaBoard from '../components/study/TaBoard.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { TA_MODES } from '../utils/timeAttack.js'
import { QUIZ_COIN_PER_CORRECT } from '../data/index.js'

const auth = useAuthStore()
const members = useMembersStore()
const router = useRouter()

const stage = ref('pick')      // pick | play | result
const starting = ref(false)

const bestOf = (m) => auth.userData?.timeAttack?.[m.bestField] || 0

// Task 5 จะแทนที่ด้วยของจริง
async function startRun(_m) {}

function onBack() {
  if (stage.value === 'pick') router.back()
  else stage.value = 'pick'
}

onMounted(() => { members.loadRoster() })
</script>

<style scoped>
.ta-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.ta-head-title { font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; color: var(--ink); }
.ta-back { border: 2px solid var(--ink); background: #fff; border-radius: 10px; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; box-shadow: var(--pop); }
.ta-back:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-empty { text-align: center; color: rgba(0,0,0,.45); padding: 40px 16px; font-size: .85rem; line-height: 1.6; }
.ta-intro { font-size: .78rem; color: rgba(0,0,0,.6); line-height: 1.6; margin-bottom: 12px; }
.ta-modes { display: flex; flex-direction: column; gap: 10px; }
.ta-mode { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 14px; border-radius: 16px; background: var(--primary-light); border: 2px solid var(--ink); box-shadow: var(--pop); font-family: inherit; cursor: pointer; }
.ta-mode:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-mode:disabled { opacity: .6; cursor: default; }
.ta-mode-emoji { font-size: 1.6rem; flex-shrink: 0; }
.ta-mode-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ta-mode-text b { font-size: .95rem; color: #3730a3; }
.ta-mode-text small { font-size: .72rem; color: #6366f1; }
.ta-mode-best { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ta-mode-best-n { font-size: 1.1rem; font-weight: 800; color: #3730a3; }
.ta-mode-best-l { font-size: .7rem; color: #6366f1; }
.ta-loading { text-align: center; font-size: .78rem; color: rgba(0,0,0,.5); margin-top: 10px; }
.ta-boards { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.ta-hint { margin-top: 14px; font-size: .72rem; color: rgba(0,0,0,.5); line-height: 1.6; }
</style>
```

- [ ] **Step 3: เพิ่ม route**

ใน `src/router/index.js` ถัดจากบรรทัด `/study/crcl`:

```js
    { path: '/study/time-attack', name: 'timeAttack', component: () => import('../views/TimeAttackView.vue') },
```

- [ ] **Step 4: ปลดการ์ดใน `StudyView.vue`**

แทนบรรทัด 24:

```html
        <QuizModeCard emoji="⏱️" title="Time Attack" subtitle="แข่งกับเวลา 4 / 15 นาที · มีอันดับในรุ่น" to="/study/time-attack" />
```

- [ ] **Step 5: เพิ่มหัวข้อไกด์**

ใน `src/data/guide.js` เพิ่มหัวข้อใหม่ (วางถัดจาก `quiz`):

```js
  timeAttack: {
    icon: '⏱️', title: 'Time Attack',
    body: [
      'เลือก 4 นาที (รอบเร็ว) หรือ 15 นาที (รอบยาว) แล้วตอบให้ได้มากที่สุดก่อนหมดเวลา — คะแนนคือจำนวนข้อที่ตอบถูก',
      'ตอบแล้วขึ้นข้อถัดไปทันที ไม่มีคำอธิบายระหว่างเล่น เพราะทุกวินาทีที่ใช้อ่านคือคะแนนที่หายไป — เฉลยของข้อที่ตอบผิดรออยู่ที่จอผลตอนจบ',
      'ตอบผิดไม่หักคะแนน แต่กินเวลา · ข้อที่ผิดจะถูกเก็บไปไว้ในโหมด "ข้อที่เคยผิด" ให้เองเหมือนโหมดอื่น',
      'ได้เหรียญ +100 ต่อข้อที่ถูก เท่าโหมดปกติ และสถิติดีสุดจะขึ้นกระดานอันดับของทั้งรุ่น',
    ],
  },
```

แก้บรรทัดใน `study.body` ที่เขียนว่า `โหมดแข่งกำลังจะมา` เป็น `และ Time Attack (จับเวลา 4/15 นาที มีอันดับในรุ่น)`

- [ ] **Step 6: บิลด์ + เปิดดูจริง**

```bash
npm run build
npm run dev
```
เปิด `/study` → การ์ด Time Attack ต้องกดได้ → เข้าหน้าเห็น 2 ปุ่มโหมด + กระดาน 2 อัน (ตอนนี้ว่างเพราะยังไม่มีใครเล่น) · ปุ่ม `?` เปิดไกด์ได้

- [ ] **Step 7: Commit**

```bash
git add src/views/TimeAttackView.vue src/components/study/TaBoard.vue src/router/index.js src/views/StudyView.vue src/data/guide.js
git commit -m "Time Attack: หน้าเลือกโหมด + กระดานอันดับในรุ่น (ปลดการ์ดที่ค้าง 'เร็วๆ นี้')"
```

---

### Task 5: จอเล่น — นาฬิกา + คิวโจทย์ที่ไม่หยุดรอเน็ต

**Files:**
- Modify: `src/views/TimeAttackView.vue`

**Interfaces:**
- Consumes: `useQuestionFeed().fetchQuestions` (Task 3) · `shuffleChoices` (Task 3) · ค่าคงที่ + `remainingMs`/`clockLabel` (Task 1)
- Produces: `stage === 'play'` ทำงานครบ และเรียก `finish(reason)` เมื่อจบ (Task 6 เป็นคนเขียน `finish` ตัวจริง — ขั้นนี้ให้ `finish` แค่หยุดนาฬิกาแล้วตั้ง `stage = 'result'`)

- [ ] **Step 1: เพิ่ม template จอเล่น** (ต่อจาก block `stage === 'pick'`)

```html
    <!-- ── กำลังเล่น ── -->
    <template v-else-if="stage === 'play'">
      <div class="ta-bar">
        <button class="ta-quit" aria-label="ออกจากรอบนี้" @click="finish('quit')">✕</button>
        <span class="ta-clock" :class="{ hurry: leftMs <= 10_000 }">{{ clockLabel(leftMs) }}</span>
        <span class="ta-score">ถูก {{ correct }} / ตอบไป {{ answered }}</span>
      </div>

      <div v-if="!cur" class="ta-wait">กำลังโหลดข้อถัดไป… <small>(เวลายังเดินอยู่นะ)</small></div>
      <template v-else>
        <div class="ta-q">{{ cur.question }}</div>
        <div class="ta-choices">
          <button
            v-for="(c, i) in cur.choices" :key="i"
            class="ta-choice" :class="choiceClass(i)"
            :disabled="locked" @click="pick(i)"
          >
            <span class="ta-letter">{{ LETTERS[i] }}</span><span class="ta-ctext">{{ c }}</span>
          </button>
        </div>
      </template>
    </template>
```

- [ ] **Step 2: เพิ่ม state + ตรรกะใน `<script setup>`**

เพิ่ม import:

```js
import { onUnmounted } from 'vue'
import { useToast } from '../composables/useToast.js'
import { useQuestionFeed } from '../composables/useQuestionFeed.js'
import { shuffleChoices } from '../utils/quizShuffle.js'
import {
  TA_MODES, TA_BATCH, TA_REFILL_AT, TA_FLASH_MS, TA_TICK_MS, TA_EMPTY_STREAK_MAX,
  remainingMs, clockLabel,
} from '../utils/timeAttack.js'
```

(รวม `TA_MODES` เข้ากับ import เดิม — อย่า import ซ้ำสองบรรทัด)

```js
const { toast } = useToast()
const { fetchQuestions } = useQuestionFeed()

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

const mode = ref(null)         // โหมดที่กำลังเล่น (entry จาก TA_MODES)
const queue = ref([])          // โจทย์ที่รอเสิร์ฟ
const cur = ref(null)
const picked = ref(null)
const locked = ref(false)
const correct = ref(0)
const answered = ref(0)
const answers = ref([])        // { id, domain, correct } — ใช้ต่อที่ examSessions/SRS
const missed = ref([])         // { q, picked } — เฉลยที่ยกไปโชว์ตอนจบ
const leftMs = ref(0)
const endReason = ref('time')  // time | quit | empty

let seen = new Set()           // id ที่เคยเข้าคิวแล้ว — กันข้อซ้ำในรอบเดียว
let emptyStreak = 0            // ดึงแล้วไม่ได้ข้อใหม่ติดกันกี่ครั้ง
let exhausted = false          // คลังหมดจริง
let fetching = false
let waiting = false            // คิวหมดแต่ยังโหลดอยู่
let endAt = 0
let tickTimer = null
let flashTimer = null

function clearTimers() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = null }
}
onUnmounted(clearTimers)

/** ดึงล็อตถัดไปแบบไม่ block — นาฬิกาต้องไม่มีวันหยุดรอเน็ต */
async function topUp() {
  if (fetching || exhausted) return
  fetching = true
  try {
    const rows = await fetchQuestions(TA_BATCH)
    const fresh = rows.filter(q => q?.id && !seen.has(q.id))
    for (const q of fresh) seen.add(q.id)
    if (!fresh.length) {
      // หน้าต่างสุ่มวนมาเจอของเดิมหมด — ยังไม่ฟันธงว่าคลังหมด ต้องพลาดติดกันหลายครั้ง
      emptyStreak++
      if (emptyStreak >= TA_EMPTY_STREAK_MAX) exhausted = true
    } else {
      emptyStreak = 0
      queue.value.push(...fresh.map(shuffleChoices))
    }
  } catch (e) {
    console.error('[ta feed]', e)
  } finally {
    fetching = false
    if (waiting && stage.value === 'play') serveNext()   // คิวเคยหมดระหว่างรอ
  }
}

/** หยิบข้อถัดไปขึ้นจอ */
function serveNext() {
  if (stage.value !== 'play') return
  if (!queue.value.length) {
    if (exhausted) { finish('empty'); return }
    waiting = true
    cur.value = null
    topUp()
    return
  }
  waiting = false
  cur.value = queue.value.shift()
  picked.value = null
  locked.value = false
  if (queue.value.length <= TA_REFILL_AT) topUp()   // เติมล่วงหน้า ไม่ await
}

function pick(i) {
  if (locked.value || !cur.value) return
  locked.value = true
  picked.value = i
  answered.value++
  const ok = i === cur.value.answer
  if (ok) correct.value++
  else missed.value.push({ q: cur.value, picked: i })
  answers.value.push({ id: cur.value.id, domain: cur.value.domain || null, correct: ok })
  flashTimer = setTimeout(() => { flashTimer = null; serveNext() }, TA_FLASH_MS)
}

function choiceClass(i) {
  if (picked.value === null) return ''
  if (i === cur.value.answer) return 'correct'
  if (i === picked.value) return 'wrong'
  return 'dim'
}

async function startRun(m) {
  if (starting.value) return
  starting.value = true
  try {
    // ล้าง state รอบก่อน
    mode.value = m
    queue.value = []
    cur.value = null; picked.value = null; locked.value = false
    correct.value = 0; answered.value = 0
    answers.value = []; missed.value = []
    seen = new Set(); emptyStreak = 0; exhausted = false; fetching = false; waiting = false
    endReason.value = 'time'

    await topUp()                       // ล็อตแรกต้องรอ — ไม่งั้นนาฬิกาเดินโดยไม่มีโจทย์
    if (!queue.value.length) { toast('ยังไม่มีข้อสอบให้ทำ', 'error'); return }

    stage.value = 'play'
    endAt = Date.now() + m.ms
    leftMs.value = m.ms
    clearTimers()
    // ⚠️ คำนวณจากเวลาปลายทางทุก tick — ห้ามสะสม (มือถือ throttle setInterval ตอนสลับแอป)
    tickTimer = setInterval(() => {
      leftMs.value = remainingMs(endAt, Date.now())
      if (leftMs.value <= 0) finish('time')
    }, TA_TICK_MS)
    serveNext()
  } finally {
    starting.value = false
  }
}

// Task 6 จะแทนที่ด้วยตัวที่บันทึกผลจริง
function finish(reason) {
  if (stage.value !== 'play') return
  endReason.value = reason
  clearTimers()
  stage.value = 'result'
}
```

⚠️ `startRun` เดิมใน Task 4 เป็น stub — **ลบทิ้ง** อย่าให้เหลือสองตัว

- [ ] **Step 3: เพิ่ม style จอเล่น**

```css
.ta-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.ta-quit { border: 2px solid var(--ink); background: #fff; border-radius: 10px; width: 32px; height: 32px; font-size: .95rem; cursor: pointer; box-shadow: var(--pop); flex-shrink: 0; }
.ta-clock { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.ta-clock.hurry { color: #dc2626; animation: ta-pulse .6s ease-in-out infinite; }
@keyframes ta-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.ta-score { margin-left: auto; font-size: .76rem; font-weight: 800; color: rgba(0,0,0,.6); }
.ta-wait { text-align: center; color: rgba(0,0,0,.45); padding: 40px 16px; font-size: .85rem; line-height: 1.7; }
.ta-wait small { display: block; font-size: .72rem; margin-top: 4px; }
.ta-q { font-size: .95rem; font-weight: 700; line-height: 1.7; margin-bottom: 14px; }
.ta-choices { display: flex; flex-direction: column; gap: 8px; }
.ta-choice { display: flex; align-items: flex-start; gap: 10px; text-align: left; width: 100%; padding: 12px; border: 2px solid var(--ink); border-radius: 14px; background: #fff; box-shadow: var(--pop); font-family: inherit; font-size: .84rem; line-height: 1.6; cursor: pointer; }
.ta-choice:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-choice.correct { background: #dcfce7; border-color: #15803d; }
.ta-choice.wrong { background: #fee2e2; border-color: #b91c1c; }
.ta-choice.dim { opacity: .5; }
.ta-letter { font-weight: 800; flex-shrink: 0; }
.ta-ctext { flex: 1; min-width: 0; }
```

- [ ] **Step 4: เทสด้วยมือใน dev**

```bash
npm run dev
```
ตรวจให้ครบ:
1. กด 4 นาที → นาฬิกาเริ่มที่ 4:00 และเดินลง
2. ตอบข้อหนึ่ง → เห็นไฟเขียว/แดง ~0.4 วิ แล้วขึ้นข้อใหม่เอง โดยไม่ต้องกดอะไร
3. ตอบรัวๆ เกิน 25 ข้อ → **ต้องไม่มีข้อไหนซ้ำ และไม่มีจังหวะค้าง** (พิสูจน์ว่า prefetch ทำงาน)
4. สลับไปแอปอื่น ~30 วิ แล้วกลับมา → นาฬิกาต้องลดไปตามเวลาจริง ไม่ใช่ค้างที่เดิม
5. รอจนหมดเวลา → เด้งเข้าจอผล (ตอนนี้ยังว่าง — Task 6 จะเติม)
6. กด ✕ กลางคัน → เข้าจอผลเช่นกัน

- [ ] **Step 5: บิลด์ + Commit**

```bash
npm run build
git add src/views/TimeAttackView.vue
git commit -m "Time Attack: จอเล่น — นาฬิกานับจากเวลาปลายทาง + คิวโจทย์ prefetch (ไม่หยุดรอเน็ต)"
```

---

### Task 6: จอผล + บันทึกผลลง Firestore

**Files:**
- Modify: `src/views/TimeAttackView.vue`

**Interfaces:**
- Consumes: `newBest` (Task 1) · `applyQuizResults`, `buildQcardsPatch` (`src/utils/srsQuestions.js`) · `bumpDailyQuest` · `tallyAnswers` · `useRosterSync`
- Produces: เขียน `examSessions` 1 doc/รอบ (`mode: 'ta4'|'ta15'`) · `questionStats` · user doc (`coins`, `timeAttack.*`, `quizDoneTotal`, `dailyQuest`, `study.qcards`) · `syncRosterRow()`

⚠️ **ห้ามแตะ `quizHigh`** — นั่นคือสถิติของโหมดปกติ (จำนวนข้อถูกในชุด) คนละหน่วยกับคะแนน Time Attack

- [ ] **Step 1: เพิ่ม template จอผล**

```html
    <!-- ── ผล ── -->
    <template v-else-if="stage === 'result'">
      <div class="ta-result">
        <div class="ta-res-emoji">{{ resultEmoji }}</div>
        <div class="ta-res-title">{{ endReasonText }}</div>
        <div class="ta-res-score">{{ correct }}<span> ข้อ</span></div>
        <div class="ta-res-sub">ตอบไป {{ answered }} ข้อ · แม่น {{ accuracy }}%</div>
        <div v-if="isNewBest" class="ta-res-best"><Emoji char="🎉" /> สถิติใหม่! (เดิม {{ prevBest }} ข้อ)</div>
        <div v-else class="ta-res-prev">สถิติเดิมของคุณ {{ prevBest }} ข้อ</div>
        <div v-if="coinsEarned" class="ta-res-coins">+{{ coinsEarned.toLocaleString() }} <Emoji char="🪙" /></div>
      </div>

      <div class="ta-res-actions">
        <button class="ta-again" @click="startRun(mode)">เล่นอีกรอบ</button>
        <button class="ta-tohome" @click="stage = 'pick'">กลับหน้าเลือกโหมด</button>
      </div>

      <TaBoard v-if="mode" :mode-key="mode.key" class="ta-res-board" />

      <template v-if="missed.length">
        <div class="ta-miss-head"><Emoji char="📖" /> ข้อที่ตอบผิด ({{ missed.length }}) — ดูเฉลยได้เต็มที่ ไม่มีเวลาจับแล้ว</div>
        <div v-for="(m, i) in missed" :key="i" class="ta-miss">
          <div class="ta-miss-q">{{ m.q.question }}</div>
          <div class="ta-miss-line no">คุณตอบ: {{ m.q.choices[m.picked] }}</div>
          <div class="ta-miss-line ok">เฉลย: {{ m.q.choices[m.q.answer] }}</div>
          <div v-if="m.q.explanation" class="ta-miss-exp"><Emoji char="💡" /> {{ m.q.explanation }}</div>
        </div>
      </template>
      <div v-else-if="answered" class="ta-miss-none"><Emoji char="🏆" /> ตอบถูกหมดทุกข้อ!</div>
    </template>
```

- [ ] **Step 2: เพิ่ม import + computed + `finish` ตัวจริง**

```js
import { collection, addDoc, doc, setDoc, writeBatch, increment, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useUsageStore } from '../stores/usage.js'
import { useRosterSync } from '../composables/useRosterSync.js'
import { DOMAIN_KEYS } from '../data/domains.js'
import { bumpDailyQuest } from '../utils/dailyQuest.js'
import { tallyAnswers } from '../utils/questionStats.js'
import { applyQuizResults, buildQcardsPatch } from '../utils/srsQuestions.js'
import { newBest } from '../utils/timeAttack.js'   // รวมเข้ากับ import เดิมของ timeAttack.js
```

```js
const usage = useUsageStore()
const { syncRosterRow } = useRosterSync()

const coinsEarned = ref(0)
const isNewBest = ref(false)
const prevBest = ref(0)

const accuracy = computed(() => answered.value ? Math.round((correct.value / answered.value) * 100) : 0)
const resultEmoji = computed(() => accuracy.value >= 80 ? '🏆' : accuracy.value >= 50 ? '😊' : '📚')
const endReasonText = computed(() => ({
  time:  'หมดเวลา!',
  quit:  'จบรอบแล้ว',
  empty: 'ทำครบทุกข้อในคลังแล้ว!',
}[endReason.value] || 'จบรอบแล้ว'))
```

(อย่าลืมเติม `computed` เข้าไปใน `import { ref, onMounted, onUnmounted } from 'vue'`)

แทน `finish` เดิมทั้งตัว:

```js
/** จบรอบ: หยุดนาฬิกา → ขึ้นจอผลทันที → ค่อยบันทึกเบื้องหลัง (ผู้เล่นไม่ต้องรอเน็ต) */
async function finish(reason) {
  if (stage.value !== 'play') return
  endReason.value = reason
  clearTimers()
  stage.value = 'result'

  const m = mode.value
  const grant = correct.value * QUIZ_COIN_PER_CORRECT
  coinsEarned.value = grant

  // ⚠️ CLAUDE.md ข้อ 9 — หยิบค่าก่อนเรียก patchUser (หลังเรียกแล้ว userData เปลี่ยนทันที)
  const before = auth.userData?.timeAttack?.[m.bestField] || 0
  const { best, isNew } = newBest(before, correct.value)
  prevBest.value = before
  isNewBest.value = isNew

  if (!auth.currentUser || !answered.value) return

  // 1) บันทึกรอบนี้ลง examSessions — mode ทำให้แยกออกจากควิซปกติได้ภายหลัง
  try {
    usage.track(0, 1)
    const domainStats = Object.fromEntries(DOMAIN_KEYS.map(k => [k, { c: 0, t: 0 }]))
    domainStats.none = { c: 0, t: 0 }
    for (const a of answers.value) {
      const bucket = (a.domain && domainStats[a.domain]) ? a.domain : 'none'
      domainStats[bucket].t++
      if (a.correct) domainStats[bucket].c++
    }
    await addDoc(collection(db, 'examSessions'), {
      userId: auth.currentUser.uid,
      nickname: auth.userData?.nickname || null,
      total: answered.value,
      correct: correct.value,
      pct: accuracy.value,
      domain: null, examSet: null, category: null,
      mode: m.key,
      domainStats,
      ts: serverTimestamp(),
    })
  } catch (e) { console.error('[ta session]', e) }

  // 2) สถิติรายข้อ (non-fatal เหมือน QuizView)
  try {
    const tally = tallyAnswers(answers.value)
    const qids = Object.keys(tally)
    if (qids.length) {
      const batch = writeBatch(db)
      for (const qid of qids) {
        batch.set(doc(db, 'questionStats', qid),
          { a: increment(tally[qid].a), c: increment(tally[qid].c) }, { merge: true })
      }
      await batch.commit()
      usage.track(0, qids.length)
    }
  } catch (e) { console.error('[ta questionStats]', e) }

  // 3) user doc: เหรียญ + สถิติดีสุด + กองข้อที่เคยผิด + เควสรายวัน
  const today = new Date().toISOString().slice(0, 10)
  const dq = bumpDailyQuest(auth.userData?.dailyQuest, 'quiz', today, answered.value)
  // ตอบผิดในโหมดนี้ = เข้ากอง "ข้อที่เคยผิด" เหมือนควิซปกติ (variant 'normal')
  const { set: qcSet, remove: qcRemove } = applyQuizResults({
    qcards: auth.userData?.study?.qcards,
    answers: answers.value,
    variant: 'normal',
    now: Date.now(),
    missingIds: [],
  })
  const { optimisticStudy, server: qcServer } = buildQcardsPatch({
    study: auth.userData?.study, set: qcSet, remove: qcRemove, deleteSentinel: deleteField(),
  })
  const touchedQcards = Object.keys(qcServer).length > 0

  const ok = await auth.patchUser(
    {
      coins: (auth.userData?.coins || 0) + grant,
      timeAttack: { ...(auth.userData?.timeAttack || {}), [m.bestField]: best },
      quizDoneTotal: (auth.userData?.quizDoneTotal || 0) + answered.value,
      dailyQuest: dq,
      ...(touchedQcards ? { study: optimisticStudy } : {}),
    },
    {
      ...(grant ? { coins: increment(grant) } : {}),
      // dot-notation — เขียนทั้งก้อนจะทับสถิติของอีกโหมด
      [`timeAttack.${m.bestField}`]: best,
      quizDoneTotal: increment(answered.value),
      dailyQuest: dq,
      ...qcServer,   // dot-notation เท่านั้น — ห้ามส่ง study ทั้งก้อน ไม่งั้นทับ study.cards
    },
  )
  if (!ok) { toast('บันทึกผลไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error'); return }
  if (grant) toast(`ได้ ${grant.toLocaleString()}🪙 จาก Time Attack`, 'success')
  if (isNew) syncRosterRow()   // สถิติใหม่เท่านั้นที่ต้องขึ้นกระดาน (ไม่เปลี่ยน = ไม่ยิง Firestore อยู่แล้ว)
}
```

- [ ] **Step 3: เพิ่ม style จอผล**

```css
.ta-result { text-align: center; padding: 20px 12px 12px; }
.ta-res-emoji { font-size: 3rem; }
.ta-res-title { font-size: .95rem; font-weight: 800; margin-top: 4px; }
.ta-res-score { font-family: var(--font-display); font-size: 3rem; font-weight: 800; color: var(--primary); line-height: 1.1; }
.ta-res-score span { font-size: 1.1rem; color: rgba(0,0,0,.5); }
.ta-res-sub { font-size: .8rem; color: rgba(0,0,0,.55); }
.ta-res-best { margin-top: 8px; font-size: .85rem; font-weight: 800; color: #15803d; }
.ta-res-prev { margin-top: 8px; font-size: .78rem; color: rgba(0,0,0,.45); }
.ta-res-coins { margin-top: 6px; font-size: 1rem; font-weight: 800; color: #b45309; }
.ta-res-actions { display: flex; gap: 8px; margin: 8px 0 16px; }
.ta-again, .ta-tohome { flex: 1; border: 2px solid var(--ink); border-radius: 12px; padding: 12px; font-family: inherit; font-weight: 800; font-size: .82rem; cursor: pointer; box-shadow: var(--pop); }
.ta-again { background: var(--primary); color: #fff; }
.ta-tohome { background: #fff; }
.ta-again:active, .ta-tohome:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-res-board { margin-bottom: 16px; }
.ta-miss-head { font-size: .82rem; font-weight: 800; margin-bottom: 8px; line-height: 1.6; }
.ta-miss { background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 12px; margin-bottom: 8px; }
.ta-miss-q { font-size: .84rem; font-weight: 700; line-height: 1.6; margin-bottom: 6px; }
.ta-miss-line { font-size: .78rem; line-height: 1.6; }
.ta-miss-line.no { color: #b91c1c; }
.ta-miss-line.ok { color: #15803d; font-weight: 700; }
.ta-miss-exp { margin-top: 6px; font-size: .76rem; color: rgba(0,0,0,.6); line-height: 1.6; }
.ta-miss-none { text-align: center; font-size: .85rem; font-weight: 800; color: #15803d; padding: 16px; }
</style>
```

- [ ] **Step 4: บิลด์ + ตรวจฟอนต์**

```bash
npm run build
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```
Expected: build ผ่าน · grep ไม่เจออะไร

- [ ] **Step 5: เทสด้วยมือใน dev (เส้นทางเต็ม)**

```bash
npm run dev
```
1. เล่น 4 นาที ตอบผิดอย่างน้อย 2 ข้อ แล้วกด ✕ → จอผลต้องโชว์คะแนน · ความแม่น · เหรียญ · **รายการข้อผิดพร้อมเฉลย**
2. เหรียญในหัวมุมเพิ่มขึ้นจริง
3. เข้า `/quiz?mode=redo` → ต้องเจอข้อที่เพิ่งตอบผิด (พิสูจน์ว่า SRS ต่อติด)
4. กลับหน้าเลือกโหมด → สถิติเดิมของโหมดนั้นอัปเดต และชื่อเราขึ้นกระดาน
5. เล่นอีกรอบให้ได้คะแนนต่ำกว่าเดิม → **สถิติต้องไม่ลดลง** และไม่ขึ้นป้าย "สถิติใหม่"
6. รีโหลดหน้า → สถิติยังอยู่

- [ ] **Step 6: Commit**

```bash
git add src/views/TimeAttackView.vue
git commit -m "Time Attack: จอผล + บันทึกเหรียญ/สถิติ/SRS/กระดาน (เฉลยข้อที่ผิดยกมาไว้ตอนจบ)"
```

---

## หลัง deploy — เทสจอจริง (มือถือ)

1. เล่น 15 นาทีจริง 1 รอบ → **ต้องไม่มีจังหวะค้างรอโจทย์เลย** (ถ้าค้างบ่อย = `TA_BATCH`/`TA_REFILL_AT` ต้องปรับ)
2. สลับไป LINE แล้วกลับมา → นาฬิกาเดินตามเวลาจริง
3. 10 วินาทีสุดท้าย นาฬิกาแดง+เต้น และตัดจบตรงเวลา
4. เช็คว่ากระดานอันดับขึ้นทั้งคนที่มี studentId และ guest
5. ดูตัวนับ usage ในหน้า Admin ว่าจำนวน read ต่อรอบใกล้เคียงจำนวนข้อที่ทำจริง (ไม่ควรเกิน +25)
