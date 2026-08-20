# ต่อสาย Quiz → SRS (ข้อที่เคยผิด) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ข้อสอบที่ตอบผิดกลายเป็นการ์ด SRS แล้วกลับมาทบทวนด้วยการตอบข้อนั้นใหม่ ตอบถูกติดกัน 3 ครั้งแล้วหลุดกอง

**Architecture:** ตรรกะทั้งหมดเป็น pure function ใน `src/utils/srsQuestions.js` (เทสด้วย `node --test`) ·
view เรียกใช้อย่างเดียว ตามแนวเดียวกับ `minigameCore.js` / `importQuestions.js` / `crcl.js` ·
กองใหม่ `study.qcards` บน user doc key ด้วย question id คีย์ย่อ `{e,i,r,l,t,d}` ·
โหมดทบทวนใช้หน้า `QuizView.vue` เดิม เพิ่มแค่ `variant = 'redo'` ตัวที่สาม ไม่มีหน้าจอใหม่

**Tech Stack:** Vue 3 (script setup) · Pinia · Firebase Firestore v9 modular · `node --test` (ไม่มี test runner กลาง)

**Spec:** `docs/superpowers/specs/2026-08-20-quiz-srs-wiring-design.md` — อ่านก่อนเริ่ม

## Global Constraints

- **เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น** — `optimistic` = ค่า local ตรงๆ, `server` = Firestore patch
- **`server` ต้องใช้ dot-notation `study.qcards.<qid>` เท่านั้น** — ห้ามเขียน `study: {...}` ทั้งก้อนจาก QuizView เด็ดขาด (จะทับ `study.cards` ของแฟลชการ์ดตัวยา 78 ใบ)
- **`optimistic` ต้อง deep-merge เอง** — `setUserDataOptimistic` เป็น shallow spread ถ้าส่ง dot key เข้าไปจะได้คีย์ literal `"study.qcards.x"` ค้างใน local state
- **ห้ามใส่เพดานเหรียญรายวันกลับเข้าควิซ** — user สั่งปลดไว้ตั้งใจ 11 ก.ค. (commit `486a8a8`) เหรียญ redo = `QUIZ_COIN_PER_CORRECT` ต่อข้อถูก ไม่มี cap
- **ห้ามแก้ `src/utils/sm2.js`** — ใช้ `sm2Update` ตามเดิม
- **คำนวณ `d` (dueAt) จาก `now` ที่ inject เข้ามา ไม่ใช่ `u.nextReviewDate`** — `sm2.js` อิง `Date.now()` ภายในตัวเอง ทำให้เทสไม่ deterministic
- `GRADUATE_REPS = 3` · `REDO_BATCH = 20` · `in` query จำกัด 30 id ต่อครั้ง
- คอมเมนต์/commit เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · ปิดท้ายด้วย `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- ตรวจงานด้วย `node --test src/utils/srsQuestions.test.js` + `npm run build` (ไม่มี lint)

---

### Task 1: ตรรกะ SRS ของกองข้อที่เคยผิด (pure + เทส)

**Files:**
- Create: `src/utils/srsQuestions.js`
- Create: `src/utils/srsQuestions.test.js`
- Read (อ้างอิง ห้ามแก้): `src/utils/sm2.js`

**Interfaces:**
- Consumes: `sm2Update(card, quality)` จาก `./sm2.js` — รับ `{easeFactor, interval, repetitions}` คืน `{easeFactor, interval, repetitions, nextReviewDate}`
- Produces (ให้ Task 2–4 ใช้):
  - `GRADUATE_REPS: number` = 3
  - `DAY_MS: number` = 86400000
  - `packCard(c: {easeFactor,interval,repetitions,lapses,totalReviews,dueAt}) => {e,i,r,l,t,d}`
  - `unpackCard(p: {e,i,r,l,t,d}|undefined) => {easeFactor,interval,repetitions,lapses,totalReviews,dueAt}`
  - `dueCount(qcards: object|undefined, now: number) => number`
  - `dueQuestionIds(qcards: object|undefined, now: number, limit: number) => string[]`
  - `applyQuizResults({qcards, answers: [{id,correct}], variant: 'normal'|'zen'|'redo', now: number, missingIds: string[]}) => {set: {qid: packed}, remove: string[]}`
  - `buildQcardsPatch({study: object, set: object, remove: string[], deleteSentinel: any}) => {optimisticStudy: object, server: object}`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/srsQuestions.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  packCard, unpackCard, dueCount, dueQuestionIds,
  applyQuizResults, buildQcardsPatch, GRADUATE_REPS, DAY_MS,
} from './srsQuestions.js'

const NOW = 1_755_648_000_000   // เวลาอ้างอิงคงที่ ให้เทส deterministic

test('ตอบผิดข้อใหม่ในควิซปกติ → การ์ดใหม่ due ทันที', () => {
  const { set, remove } = applyQuizResults({
    qcards: {}, answers: [{ id: 'q1', correct: false }], variant: 'normal', now: NOW,
  })
  assert.deepEqual(remove, [])
  assert.equal(set.q1.d, NOW, 'ต้อง due ทันที ไม่ใช่พรุ่งนี้')
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.l, 1)
  assert.equal(set.q1.t, 1)
})

test('ตอบผิดซ้ำในควิซปกติ → lapses เพิ่ม repetitions รีเซ็ต due ทันที', () => {
  const qcards = { q1: { e: 2.2, i: 6, r: 2, l: 1, t: 3, d: NOW - DAY_MS } }
  const { set } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: false }], variant: 'normal', now: NOW,
  })
  assert.equal(set.q1.l, 2)
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.i, 1)
  assert.equal(set.q1.t, 4)
  assert.equal(set.q1.d, NOW)
})

test('ตอบถูกในควิซปกติ → ไม่แตะกองเลย แม้ข้อนั้นมีการ์ดค้างอยู่', () => {
  const qcards = { q1: { e: 2.2, i: 6, r: 2, l: 1, t: 3, d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: true }, { id: 'q2', correct: true }],
    variant: 'normal', now: NOW,
  })
  assert.deepEqual(set, {})
  assert.deepEqual(remove, [])
})

test('redo ตอบถูก 1–2 ครั้ง → การ์ดยังอยู่ interval ยืดออก', () => {
  const r1 = applyQuizResults({
    qcards: { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW } },
    answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(r1.remove, [])
  assert.equal(r1.set.q1.r, 1)
  assert.equal(r1.set.q1.i, 1)
  assert.equal(r1.set.q1.d, NOW + 1 * DAY_MS)

  const r2 = applyQuizResults({
    qcards: { q1: r1.set.q1 },
    answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(r2.remove, [])
  assert.equal(r2.set.q1.r, 2)
  assert.equal(r2.set.q1.i, 6)
  assert.equal(r2.set.q1.d, NOW + 6 * DAY_MS)
})

test(`redo ตอบถูกติดกันครบ ${GRADUATE_REPS} ครั้ง → หลุดกอง`, () => {
  let qcards = { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW } }
  let last
  for (let n = 0; n < GRADUATE_REPS; n++) {
    last = applyQuizResults({
      qcards, answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
    })
    if (last.set.q1) qcards = { q1: last.set.q1 }
  }
  assert.deepEqual(last.remove, ['q1'], 'ครั้งที่ 3 ต้องหลุดกอง')
  assert.equal(last.set.q1, undefined, 'หลุดกองแล้วห้ามเขียนค่ากลับ')
})

test('redo ตอบถูก 2 ครั้งแล้วผิด → repetitions รีเซ็ต ไม่หลุดกอง due พรุ่งนี้', () => {
  const qcards = { q1: { e: 2.5, i: 6, r: 2, l: 1, t: 3, d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: false }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(remove, [])
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.l, 2)
  assert.equal(set.q1.d, NOW + DAY_MS, 'ฝึกไปแล้ววันนี้ ไม่วนซ้ำในวันเดียว')
})

test('packCard/unpackCard ครบรอบได้ค่าเดิม', () => {
  const full = { easeFactor: 2.36, interval: 6, repetitions: 2, lapses: 3, totalReviews: 9, dueAt: NOW }
  assert.deepEqual(unpackCard(packCard(full)), full)
})

test('unpackCard ทน entry เสีย/ว่าง → คืนค่าตั้งต้น', () => {
  const d = unpackCard(undefined)
  assert.equal(d.easeFactor, 2.5)
  assert.equal(d.repetitions, 0)
  assert.equal(d.dueAt, 0)
})

test('dueQuestionIds: เรียง due เก่าสุดก่อน + ตัดที่ limit + ข้อยังไม่ครบกำหนดไม่เอา', () => {
  const qcards = {
    a: { d: NOW - 3 * DAY_MS },
    b: { d: NOW - 1 * DAY_MS },
    c: { d: NOW + 5 * DAY_MS },   // ยังไม่ครบกำหนด
    e: { d: NOW - 2 * DAY_MS },
  }
  assert.deepEqual(dueQuestionIds(qcards, NOW, 10), ['a', 'e', 'b'])
  assert.deepEqual(dueQuestionIds(qcards, NOW, 2), ['a', 'e'])
  assert.equal(dueCount(qcards, NOW), 3)
  assert.deepEqual(dueQuestionIds(undefined, NOW, 10), [])
  assert.equal(dueCount(undefined, NOW), 0)
})

test('ข้อที่หายจากคลัง → เข้ารายการลบทิ้ง', () => {
  const qcards = { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW }, gone: { d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [], variant: 'redo', now: NOW, missingIds: ['gone', 'neverExisted'],
  })
  assert.deepEqual(set, {})
  assert.deepEqual(remove, ['gone'], 'id ที่ไม่เคยอยู่ในกองไม่ต้องสั่งลบ')
})

test('buildQcardsPatch: optimistic เป็น object ซ้อน · server เป็น dot-notation · ไม่แตะ study.cards', () => {
  const study = { cards: { Amoxicillin: { interval: 6 } }, qcards: { old: { d: 1 } }, lastStudied: 123 }
  const DEL = Symbol('deleteField')
  const { optimisticStudy, server } = buildQcardsPatch({
    study, set: { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: 999 } }, remove: ['old'], deleteSentinel: DEL,
  })
  assert.deepEqual(optimisticStudy.cards, { Amoxicillin: { interval: 6 } }, 'ห้ามแตะแฟลชการ์ดตัวยา')
  assert.equal(optimisticStudy.lastStudied, 123)
  assert.equal(optimisticStudy.qcards.old, undefined)
  assert.equal(optimisticStudy.qcards.q1.d, 999)
  assert.deepEqual(Object.keys(server).sort(), ['study.qcards.old', 'study.qcards.q1'])
  assert.equal(server['study.qcards.old'], DEL)
  assert.equal(server['study.qcards.q1'].d, 999)
  assert.equal(study.qcards.old.d, 1, 'ห้ามแก้ study ต้นฉบับ')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าพัง**

Run: `node --test src/utils/srsQuestions.test.js`
Expected: FAIL — `Cannot find module './srsQuestions.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/srsQuestions.js`:

```js
/**
 * SRS ของ "ข้อที่เคยผิด" — กอง `study.qcards` บน user doc
 *   key   = question id
 *   value = คีย์ย่อ { e,i,r,l,t,d } (ease/interval/reps/lapses/totalReviews/dueAt)
 *
 * คีย์ย่อเพราะออดิต 13 ส.ค. เตือน user doc บวม — ชื่อเต็ม 200 ข้อ ≈ 40KB vs ย่อ ≈ 12KB
 * และ user doc ถูกอ่านใหม่ทุก onSnapshot
 *
 * ตรรกะล้วน ไม่แตะ Firestore/Vue — เทสด้วย `node --test src/utils/srsQuestions.test.js`
 * spec: docs/superpowers/specs/2026-08-20-quiz-srs-wiring-design.md
 */
import { sm2Update } from './sm2.js'

export const GRADUATE_REPS = 3          // ตอบถูกติดกันครบเท่านี้ = "แก้ได้แล้ว" หลุดกอง (กัน map โตไม่จำกัด)
export const DAY_MS = 86_400_000

const BASE = { easeFactor: 2.5, interval: 1, repetitions: 0, lapses: 0, totalReviews: 0, dueAt: 0 }
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

export function packCard(c) {
  return { e: c.easeFactor, i: c.interval, r: c.repetitions, l: c.lapses, t: c.totalReviews, d: c.dueAt }
}

export function unpackCard(p) {
  if (!p || typeof p !== 'object') return { ...BASE }
  return {
    easeFactor:   num(p.e, BASE.easeFactor),
    interval:     num(p.i, BASE.interval),
    repetitions:  num(p.r, BASE.repetitions),
    lapses:       num(p.l, BASE.lapses),
    totalReviews: num(p.t, BASE.totalReviews),
    dueAt:        num(p.d, BASE.dueAt),
  }
}

/** จำนวนข้อที่ครบกำหนดทบทวน (ใช้ทำ subtitle การ์ดใน StudyView — 0 reads) */
export function dueCount(qcards, now) {
  if (!qcards || typeof qcards !== 'object') return 0
  return Object.values(qcards).filter(p => num(p?.d, 0) <= now).length
}

/** id ที่ครบกำหนด เรียง due เก่าสุดก่อน ตัดที่ limit */
export function dueQuestionIds(qcards, now, limit) {
  if (!qcards || typeof qcards !== 'object') return []
  return Object.entries(qcards)
    .filter(([, p]) => num(p?.d, 0) <= now)
    .sort((a, b) => num(a[1]?.d, 0) - num(b[1]?.d, 0))
    .slice(0, limit)
    .map(([id]) => id)
}

/**
 * ผลของรอบควิซที่มีต่อกอง — ไม่แก้ของเดิม คืนสิ่งที่ต้องเขียน/ลบ
 * @returns {{ set: Object<string, object>, remove: string[] }}
 */
export function applyQuizResults({ qcards = {}, answers = [], variant = 'normal', now = Date.now(), missingIds = [] } = {}) {
  const pool = qcards && typeof qcards === 'object' ? qcards : {}
  const set = {}
  const remove = []

  for (const a of answers) {
    if (!a || !a.id) continue
    const prev = unpackCard(pool[a.id])

    // ควิซปกติ/Zen: ตอบถูกไม่แตะกอง · ตอบผิด = เข้ากองและ due ทันที (เพิ่งพลาด ควรได้แก้วันนี้)
    if (variant !== 'redo') {
      if (a.correct) continue
      const u = sm2Update(prev, 1)
      set[a.id] = packCard({
        ...u, lapses: prev.lapses + 1, totalReviews: prev.totalReviews + 1, dueAt: now,
      })
      continue
    }

    // โหมด redo
    if (!a.correct) {
      const u = sm2Update(prev, 1)
      set[a.id] = packCard({
        ...u, lapses: prev.lapses + 1, totalReviews: prev.totalReviews + 1, dueAt: now + DAY_MS,
      })
      continue
    }
    const u = sm2Update(prev, 4)
    if (u.repetitions >= GRADUATE_REPS) { remove.push(a.id); continue }
    set[a.id] = packCard({
      ...u, lapses: prev.lapses, totalReviews: prev.totalReviews + 1, dueAt: now + u.interval * DAY_MS,
    })
  }

  // ข้อที่หายจากคลัง/ถูกถอนเผยแพร่ → ลบทิ้ง (เฉพาะที่อยู่ในกองจริง)
  for (const id of missingIds) {
    if (has(pool, id) && !remove.includes(id)) remove.push(id)
  }
  for (const id of remove) delete set[id]   // ลบแล้วไม่ต้องเขียนค่ากลับ

  return { set, remove }
}

/**
 * แปลงผลเป็น patch คู่ให้ `auth.patchUser(optimistic, server)`
 * - `optimisticStudy` = object ซ้อนปกติ (setUserDataOptimistic เป็น shallow spread)
 * - `server` = dot-notation `study.qcards.<id>` เท่านั้น — ห้ามส่ง study ทั้งก้อน ไม่งั้นทับ study.cards
 * @param {any} deleteSentinel ค่าที่ใช้แทนการลบฟิลด์ (ฝั่งแอปส่ง `deleteField()` เข้ามา)
 */
export function buildQcardsPatch({ study = {}, set = {}, remove = [], deleteSentinel } = {}) {
  const src = study && typeof study === 'object' ? study : {}
  const qcards = { ...(src.qcards || {}) }
  const server = {}

  for (const [id, card] of Object.entries(set)) {
    qcards[id] = card
    server[`study.qcards.${id}`] = card
  }
  for (const id of remove) {
    delete qcards[id]
    server[`study.qcards.${id}`] = deleteSentinel
  }

  return { optimisticStudy: { ...src, qcards }, server }
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/srsQuestions.test.js`
Expected: PASS ทั้ง 11 เทส (`# pass 11` / `# fail 0`)

- [ ] **Step 5: Commit**

```bash
git add src/utils/srsQuestions.js src/utils/srsQuestions.test.js
git commit -F - <<'MSG'
Study: ตรรกะกองข้อที่เคยผิด (SRS ต่อจากควิซ) เป็น pure function

กอง study.qcards key ด้วย question id คีย์ย่อ {e,i,r,l,t,d} กัน user doc บวม
ตามที่ออดิต 13 ส.ค. เตือน · ผิดในควิซปกติ = เข้ากอง due ทันที · ถูกไม่แตะกอง
· ใน redo ถูก = ยืด interval ตาม SM-2 ผิด = ถอย+due พรุ่งนี้ · ถูกติดกัน 3 ครั้ง
หลุดกอง ทำให้ map bound ตัวเอง

buildQcardsPatch คืน patch คู่แยก optimistic (object ซ้อน) กับ server
(dot-notation) เพราะเขียน study ทั้งก้อนจะทับ study.cards ของแฟลชการ์ดตัวยา
คำนวณ dueAt จาก now ที่ inject ไม่ใช่ u.nextReviewDate เพื่อให้เทส deterministic
เทส 11 ข้อ ไม่แตะ sm2.js

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: กองเข้า schema + ควิซปกติ/Zen เขียนข้อที่ตอบผิดลงกอง

**Files:**
- Modify: `src/data/userSchema.js:51` (USER_DEFAULTS.study)
- Modify: `src/views/QuizView.vue` — import เพิ่ม, `finish()` (~บรรทัด 431–503)
- Test: `node --test src/utils/srsQuestions.test.js` (ของเดิมต้องยังผ่าน) + `npm run build`

**Interfaces:**
- Consumes: `applyQuizResults`, `buildQcardsPatch`, `dueQuestionIds` จาก `../utils/srsQuestions.js` (Task 1) · `deleteField` จาก `firebase/firestore` · `answers.value = [{id, domain, correct}]` ที่ `pick()` เก็บไว้อยู่แล้ว · `authStore.patchUser(optimistic, server)`
- Produces: `study.qcards` มีข้อมูลจริงบน user doc — Task 3/4 อ่านจากที่นี่ · ตัวแปร `missingQIds` (ref array) และ `REDO_BATCH` ที่ Task 3 จะใช้ต่อ

- [ ] **Step 1: เติม default ใน schema**

ใน `src/data/userSchema.js` แก้บรรทัด `study: { cards: {} },`:

```js
  study: { cards: {}, qcards: {} },           // SRS: cards = แฟลชการ์ดตัวยา · qcards = ข้อสอบที่เคยตอบผิด
```

ไม่ต้องแก้ `normalizeUserData` — บรรทัด `d.study = { ...USER_DEFAULTS.study, ...(isObj(data.study) ? data.study : {}) }`
เติม `qcards: {}` ให้ user เก่าอยู่แล้ว

- [ ] **Step 2: เพิ่ม import ใน QuizView**

ใน `src/views/QuizView.vue` แก้บรรทัด import ของ firestore (บรรทัด 158) เติม `deleteField` และ `documentId`
(`documentId` จะใช้ใน Task 3 — ใส่รอบเดียวจบ):

```js
import { collection, getDocs, getDoc, query, where, orderBy, startAt, limit, doc, addDoc, setDoc, increment, serverTimestamp, writeBatch, deleteField, documentId } from 'firebase/firestore'
```

เพิ่มบรรทัด import ใหม่ต่อจาก `import { QUIZ_COIN_PER_CORRECT } from '../data/index.js'` (บรรทัด 171):

```js
import { applyQuizResults, buildQcardsPatch, dueQuestionIds } from '../utils/srsQuestions.js'
```

- [ ] **Step 3: ประกาศ state ของกอง**

ต่อจากบรรทัด `const starting = ref(false)` (บรรทัด 336) เพิ่ม:

```js
// ── SRS ข้อที่เคยผิด (study.qcards) — spec 2026-08-20-quiz-srs-wiring ──
const REDO_BATCH = 20
const missingQIds = ref([])   // id ในกองที่หาย/ถูกถอนเผยแพร่ → ลบทิ้งตอน finish()
```

- [ ] **Step 4: เขียนกองลงใน `patchUser` ก้อนเดิมของ `finish()`**

ใน `finish()` แทนที่บล็อกท้ายสุดทั้งก้อน (ตั้งแต่ `// 2) update the user doc` จนจบฟังก์ชัน):

```js
  // 2) update the user doc: coins + best score + daily cap + กองข้อที่เคยผิด
  const newHigh = Math.max(authStore.userData?.quizHigh || 0, correct.value)
  const dq = bumpDailyQuest(authStore.userData?.dailyQuest, 'quiz', today, answered.value)

  // SRS: ผิด = เข้ากอง · ถูกในควิซปกติไม่แตะ · ใน redo ถูกติดกัน 3 ครั้งหลุดกอง
  // เติมลง patch ก้อนนี้เลย = ไม่มีการเขียน Firestore เพิ่ม
  const { set: qcSet, remove: qcRemove } = applyQuizResults({
    qcards: authStore.userData?.study?.qcards,
    answers: answers.value,
    variant: variant.value,
    now: Date.now(),
    missingIds: missingQIds.value,
  })
  const { optimisticStudy, server: qcServer } = buildQcardsPatch({
    study: authStore.userData?.study,
    set: qcSet, remove: qcRemove, deleteSentinel: deleteField(),
  })
  const touchedQcards = Object.keys(qcServer).length > 0

  const ok = await authStore.patchUser(
    {
      coins: (authStore.userData?.coins || 0) + grant,
      quizHigh: newHigh,
      quizDoneTotal: (authStore.userData?.quizDoneTotal || 0) + answered.value,
      dailyQuest: dq,
      ...(touchedQcards ? { study: optimisticStudy } : {}),
    },
    {
      ...(grant ? { coins: increment(grant) } : {}),
      quizHigh: newHigh,
      quizDoneTotal: increment(answered.value),
      dailyQuest: dq,
      ...qcServer,   // dot-notation เท่านั้น — ห้ามส่ง study ทั้งก้อน ไม่งั้นทับ study.cards
    },
  )
  if (ok) missingQIds.value = []
  else toast('บันทึกผลไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error')
  if (grant) toast(`ได้ ${grant}🪙 จากการทำข้อสอบ`, 'success')
}
```

- [ ] **Step 5: ตรวจว่าไม่มีที่ไหนเขียน `study:` ลงฝั่ง server**

Run: `grep -n "study" src/views/QuizView.vue`
Expected: `study` ปรากฏเฉพาะใน `optimisticStudy` / `authStore.userData?.study` / คอมเมนต์ — **ห้ามมี `study:` เป็นคีย์ในอาร์กิวเมนต์ตัวที่สองของ `patchUser`**

- [ ] **Step 6: เทส + build**

Run: `node --test src/utils/srsQuestions.test.js && npm run build`
Expected: เทสผ่านทั้งหมด · build สำเร็จไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/data/userSchema.js src/views/QuizView.vue
git commit -F - <<'MSG'
Quiz: ข้อที่ตอบผิดเข้ากอง SRS (study.qcards) — เขียน Firestore เพิ่ม 0 ครั้ง

ทำข้อสอบผิดแล้วไม่มีอะไรเกิดขึ้นมาตั้งแต่ มิ.ย. ทั้งที่ sm2.js พร้อมและ
finish() ถือ answers=[{id,domain,correct}] อยู่ในมือแล้ว

เติมผลลง patchUser ก้อนที่ finish() เรียกอยู่แล้ว จึงไม่มีการเขียนเพิ่ม
server ใช้ dot-notation study.qcards.<id> เท่านั้น (เขียน study ทั้งก้อน
จะทับ study.cards ของแฟลชการ์ดตัวยา 78 ใบ) optimistic deep-merge แยกต่างหาก
เพราะ setUserDataOptimistic เป็น shallow spread

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: โหมด redo — ตอบข้อที่เคยผิดใหม่ในหน้า QuizView เดิม

**Files:**
- Modify: `src/views/QuizView.vue` — template (บรรทัด ~58–64), `onMounted` (บรรทัด ~203–209), เพิ่มฟังก์ชันหลัง `loadMoreZen()`, style
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `dueQuestionIds(qcards, now, limit)`, `applyQuizResults`, `buildQcardsPatch` (Task 1) · `missingQIds`, `REDO_BATCH`, `documentId`, `deleteField` (Task 2) · ตัวที่มีอยู่แล้วในไฟล์: `variant`, `quiz`, `idx`, `mode`, `starting`, `shuffle`, `shuffleChoices`, `resetRound`, `usage`, `toast`, `progress`, `db`, `authStore`
- Produces: เข้าโหมดด้วย `/quiz?mode=redo` — Task 4 ลิงก์มาที่ URL นี้

- [ ] **Step 1: เพิ่มฟังก์ชันโหลดโจทย์ตาม id + `startRedo()`**

แทรกต่อจากท้ายฟังก์ชัน `loadMoreZen()` (ก่อน `// รีเซ็ต state รอบใหม่` / `function resetRound()`):

```js
// ── โหมด redo: ทบทวนข้อที่เคยตอบผิด ──
// โหลดโจทย์ตาม id (in จำกัด 30 ต่อ query) — 20 ข้อ = 1 query
async function fetchQuestionsByIds(ids) {
  const col = collection(db, 'questions')
  const out = []
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(col, where(documentId(), 'in', ids.slice(i, i + 30))))
    usage.track(snap.size)
    for (const d of snap.docs) out.push({ id: d.id, ...d.data() })
  }
  return out
}

// ล้างข้อที่หายจากคลังออกจากกอง (ใช้ตอนไม่มีรอบให้ทำ จึงไม่มี patch อื่นให้เกาะ)
async function flushMissingQIds() {
  if (!missingQIds.value.length || !authStore.currentUser) return
  const { set, remove } = applyQuizResults({
    qcards: authStore.userData?.study?.qcards, answers: [],
    variant: 'redo', now: Date.now(), missingIds: missingQIds.value,
  })
  if (!remove.length) { missingQIds.value = []; return }
  const { optimisticStudy, server } = buildQcardsPatch({
    study: authStore.userData?.study, set, remove, deleteSentinel: deleteField(),
  })
  const ok = await authStore.patchUser({ study: optimisticStudy }, server)
  if (ok) missingQIds.value = []
}

async function startRedo() {
  if (starting.value) return
  starting.value = true
  variant.value = 'redo'
  missingQIds.value = []
  try {
    const ids = dueQuestionIds(authStore.userData?.study?.qcards, Date.now(), REDO_BATCH)
    if (!ids.length) {
      toast('ยังไม่มีข้อที่ต้องทบทวน — ตอบผิดเมื่อไหร่จะเก็บมาที่นี่', 'info')
      mode.value = 'home'
      return
    }
    const rows = await fetchQuestionsByIds(ids)
    const usable = rows.filter(q => q.isPublished && Array.isArray(q.choices) && q.choices.length >= 2)
    const okIds = new Set(usable.map(q => q.id))
    missingQIds.value = ids.filter(id => !okIds.has(id))   // หาย/ถูกถอนเผยแพร่ → ลบตอน finish()
    if (!usable.length) {
      await flushMissingQIds()
      toast('ข้อที่ค้างถูกนำออกจากคลังแล้ว — ล้างกองให้เรียบร้อย', 'info')
      mode.value = 'home'
      return
    }
    quiz.value = shuffle(usable).map(shuffleChoices)
    idx.value = 0; resetRound()
    mode.value = 'quiz'
  } catch (e) {
    console.error('[redo start]', e); toast('เริ่มทบทวนไม่สำเร็จ', 'error'); mode.value = 'home'
  } finally { starting.value = false }
}
```

- [ ] **Step 2: ต่อ route `?mode=redo` — รอ userData ให้โหลดก่อน**

`startRedo()` อ่านกองจาก `authStore.userData` ซึ่งมาทาง `onSnapshot` และอาจยังเป็น `null` ตอน mount
(ถ้าไม่รอ จะเจอ "ยังไม่มีข้อที่ต้องทบทวน" ทั้งที่มีข้อค้างจริง)

แก้บรรทัด import ของ vue (บรรทัด 156):

```js
import { ref, computed, onMounted, watch } from 'vue'
```

แล้วแทนที่ `onMounted` ทั้งก้อน (บรรทัด 203–209):

```js
onMounted(() => {
  if (!authStore.isLoggedIn) return
  load()
  loadExamSets()
  if (route.query.mode === 'zen') startZen()
  else if (route.query.mode === 'redo') whenUserDataReady(startRedo)
  else if (route.query.view === 'history') openHistory()
})

// userData มาทาง onSnapshot — ตอน mount อาจยังเป็น null
function whenUserDataReady(fn) {
  if (authStore.userData) { fn(); return }
  const stop = watch(() => authStore.userData, (v) => { if (v) { stop(); fn() } })
}
```

- [ ] **Step 3: ป้ายหัวรอบให้รู้ว่าอยู่โหมดไหน**

ใน template แทนที่บรรทัด 60–61:

```html
        <div v-if="variant === 'zen'" class="qv-zen-tag"><Emoji char="♾️" /> Zen</div>
        <div v-else class="qv-bar"><div class="qv-fill" :style="{ width: progress + '%' }"></div></div>
```

แล้วเพิ่มป้าย redo ต่อจากบรรทัด `<div class="qv-running">คะแนน {{ correct }}/{{ answered }}</div>` (บรรทัด 64):

```html
      <div v-if="variant === 'redo'" class="qv-redo-tag"><Emoji char="🔁" /> ทบทวนข้อที่เคยผิด</div>
```

เพิ่ม style ต่อจากกฎ `.qv-notice` ใน `<style scoped>`:

```css
.qv-redo-tag { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 800;
  color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 999px; padding: 4px 12px; margin-bottom: 10px; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 5: ทดลองจริงใน dev**

Run: `npm run dev` แล้วเปิด `#/quiz`
1. ทำข้อสอบให้ผิดอย่างน้อย 2 ข้อ → กดดูผล
2. เปิด `#/quiz?mode=redo` → ต้องเจอข้อที่เพิ่งตอบผิด **ในวันเดียวกัน** พร้อมป้าย 🔁
3. ตอบให้ถูกทั้งหมด → จบรอบ → เข้า `#/quiz?mode=redo` อีกครั้งต้องขึ้น "ยังไม่มีข้อที่ต้องทบทวน" (interval ยืดเป็นพรุ่งนี้)
4. เปิด DevTools → Firestore user doc → ยืนยันว่า `study.cards` (แฟลชการ์ดตัวยา) **ยังอยู่ครบ** ไม่ถูกล้าง

- [ ] **Step 6: Commit**

```bash
git add src/views/QuizView.vue
git commit -F - <<'MSG'
Quiz: โหมดทบทวนข้อที่เคยผิด (variant redo ตัวที่สาม ใช้หน้าจอเดิม)

/quiz?mode=redo ดึงข้อในกองที่ครบกำหนด เรียง due เก่าสุดก่อน รอบละ 20 ข้อ
ด้วย where(documentId(),'in',…) ทีละ 30 = 1 query ต่อรอบ ไม่เก็บเนื้อโจทย์
ใน user doc จึงไม่มีโจทย์ค้างเวอร์ชันเก่าหลังทีมวิชาการแก้

ข้อที่หาย/ถูกถอนเผยแพร่ถูกกรองออกและลบจากกองอัตโนมัติ กันกองค้างข้อผี
รอ userData จาก onSnapshot ก่อนเริ่ม ไม่งั้นเข้าลิงก์ตรงจะเจอ "ไม่มีข้อ
ต้องทบทวน" ทั้งที่มีข้อค้างจริง

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: ทางเข้าใน StudyView

**Files:**
- Modify: `src/views/StudyView.vue` — template หมวด "📝 ทำข้อสอบ" (บรรทัด ~18–26), script (import + computed)
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `dueCount(qcards, now)` จาก `../utils/srsQuestions.js` (Task 1) · `study.qcards` ที่ Task 2 เขียนไว้ · route `/quiz?mode=redo` จาก Task 3 · `QuizModeCard` ที่ import อยู่แล้ว (props: `emoji` `title` `subtitle` `to` `comingSoon`)
- Produces: ไม่มี — เป็น task สุดท้าย

- [ ] **Step 1: เพิ่ม import + computed**

ใน `<script setup>` ของ `src/views/StudyView.vue` เพิ่ม import ต่อจาก `import { sm2Update, newSrsCard } from '../utils/sm2.js'` (บรรทัด 187):

```js
import { dueCount } from '../utils/srsQuestions.js'
```

เพิ่มต่อจากบรรทัด `const cards = computed(() => study.value.cards || {})` (บรรทัด 201):

```js
// ── กองข้อสอบที่เคยตอบผิด (คนละกองกับแฟลชการ์ดตัวยา) — นับจาก user doc ที่โหลดอยู่แล้ว = 0 reads ──
const redoDue = computed(() => dueCount(study.value.qcards, Date.now()))
const redoSubtitle = computed(() => redoDue.value
  ? `ครบกำหนดทบทวน ${redoDue.value} ข้อ · ตอบใหม่จนถูก 3 ครั้งติดแล้วหลุดกอง`
  : 'ยังไม่มีข้อค้าง — ตอบผิดเมื่อไหร่จะเก็บมาที่นี่')
```

หมายเหตุ: `Date.now()` ไม่ reactive แต่ computed คำนวณใหม่ทุกครั้งที่ `userData` เปลี่ยน
(ซึ่งเกิดทุกครั้งที่ทำข้อสอบจบ) — พอสำหรับการ์ดบอกจำนวน ไม่ต้องใส่ timer

- [ ] **Step 2: เพิ่มการ์ดใน template**

ใน `<div class="sv-modes">` แทรกต่อจากการ์ด Zen (บรรทัด 22) ก่อนการ์ด Time Attack:

```html
        <QuizModeCard emoji="🔁" title="ข้อที่เคยผิด" :subtitle="redoSubtitle" to="/quiz?mode=redo" />
```

วางไว้ตรงนี้เพราะเป็นโหมดที่ต่อยอดจากการทำข้อสอบสองใบบน — ไม่ใช่ของใหม่ที่ยังไม่เปิด

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 4: ทดลองจริงใน dev**

Run: `npm run dev` แล้วเปิด `#/study`
1. ตอนกองว่าง → การ์ดขึ้น "ยังไม่มีข้อค้าง — ตอบผิดเมื่อไหร่จะเก็บมาที่นี่" และยัง**กดได้**
2. ทำข้อสอบให้ผิด 3 ข้อ → กลับมา `#/study` → subtitle ต้องขึ้น "ครบกำหนดทบทวน 3 ข้อ" ทันที
3. กดการ์ด → เข้าโหมด redo เจอ 3 ข้อนั้น
4. ตรวจบนจอมือถือ (DevTools responsive) ว่าการ์ด 6 ใบยังเรียงสวย ไม่ล้น

- [ ] **Step 5: Commit**

```bash
git add src/views/StudyView.vue
git commit -F - <<'MSG'
Study: การ์ด "ข้อที่เคยผิด" ในหมวดทำข้อสอบ (ทางเข้าโหมด redo)

subtitle บอกจำนวนที่ครบกำหนดสดจาก user doc ที่โหลดอยู่แล้ว = 0 reads
กองว่างก็ยังกดได้และอธิบายว่าของจะมาจากไหน ไม่ทำเป็นการ์ด comingSoon
เพราะระบบทำงานจริงแล้ว แค่ยังไม่มีข้อค้าง

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## เช็คหลังทำครบ 4 tasks

- [ ] `node --test src/utils/srsQuestions.test.js` ผ่านทั้งหมด
- [ ] `npm run build` สำเร็จ
- [ ] `study.cards` (แฟลชการ์ดตัวยา) ยังอยู่ครบหลังทำควิซหลายรอบ — ยืนยันจาก Firestore console
- [ ] `grep -rn "QUIZ_DAILY_CAP\|quizCoinDate" src/` ไม่มีของใหม่โผล่มา (ห้ามใส่เพดานเหรียญกลับ)
- [ ] ยังไม่ push — รอ user เทสจอจริงก่อน (ตามธรรมเนียมโปรเจกต์)
