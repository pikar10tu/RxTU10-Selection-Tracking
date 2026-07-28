# ปรับปรุงระบบตรวจข้อสอบ v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำตาม feedback ทีมวิชาการ 5 ข้อ (หมายเหตุผู้ตรวจ · ใครตรวจ · คิวเร่งข้อค้าง · หมวดหลายค่า · ตรวจชนกัน) พร้อมปิดหนี้เชิงโครงสร้าง 3 ข้อ (สถานะ `half` + ต้นทุน read คงที่ · แก้ผลตรวจที่เพิ่งส่ง · แถบความคืบหน้ารวม)

**Architecture:** ตรรกะทั้งหมดอยู่ใน pure util ที่เทสได้ด้วย `node --test` (`questionReview.js`, `questionCategories.js` ใหม่) แล้ว view เป็นแค่ชั้นแสดงผล · การเขียนที่แข่งกันได้ทั้งหมดผ่าน `runTransaction` เดิม · ต้นทุน read ของหน้าตรวจถูกตรึงด้วยการแยกสถานะ `half` ออกจาก `pending` แล้วดึง 2 ก้อนแยกกัน (ก้อนค้างดึงครบ · ก้อนใหม่สุ่มหน้าต่างด้วย field `rand`)

**Tech Stack:** Vue 3 (script setup) + Pinia + Firebase Firestore (long-polling) · ไม่มี test runner กลาง — pure util เทสด้วย `node --test`, view ตรวจด้วย `npm run build` + ทดลองใน dev

**Spec:** `docs/superpowers/specs/2026-07-29-review-improvements-design.md`

## Global Constraints

- ข้อความจากผู้ใช้ทุกช่องต้องผ่าน `cleanText(str, LIMITS.xxx)` จาก `utils/text.js` ก่อนเขียน Firestore เสมอ
- คอมเมนต์ในโค้ดและ commit message เป็นไทยปนอังกฤษ · รูปแบบ commit: `Area: อะไร (ทำไม)`
- โทนข้อความผู้ใช้ยึด `docs/voice-guide.md` — เป็นกันเอง อธิบายฟังก์ชันชัด ไม่หวือหวา
- single-file component + `<style scoped>` · สีธีมหลัก indigo `#4f46e5`
- **`MAX_CATEGORIES = 5`** — จำนวนหมวด/กลุ่มโรคสูงสุดต่อข้อ
- **น้ำหนักคิว:** `conflict` = 8 · `half` = 4 · `pending` = 1
- **ขนาดคิวที่ดึง:** ก้อนค้าง/ขัดแย้ง `limit(200)` · ก้อนยังไม่มีใครตรวจ `limit(40)`
- **`LIMITS.reviewNote = 1000`**
- ห้ามใส่ `updatedAt` หรือฟิลด์นอก `reviewSubmitKeys` ลงใน patch ของเส้นทางส่ง/แก้ผลตรวจ (rules ใช้ `hasOnly()` จะปฏิเสธทั้งก้อน)
- `overlay/modal` ที่ `position:fixed` ใต้ `<RouterView>` ต้องห่อ `<Teleport to="body">` เสมอ (กับดักข้อ 6 ใน CLAUDE.md) — งานรอบนี้ไม่ได้เพิ่ม overlay ใหม่ แต่ถ้าจะเพิ่มต้องทำตามนี้
- แก้ `firestore.rules` หรือ `firestore.indexes.json` แล้ว **ต้อง deploy** ไม่งั้นไม่มีผลจริง

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|------|----------------|
| `src/utils/questionReview.js` | ตรรกะสถานะตรวจ + น้ำหนักคิว + การสุ่ม (pure) |
| `src/utils/questionCategories.js` **(ใหม่)** | ทางเข้าเดียวของการอ่าน/normalize หมวดหลายค่า (pure) |
| `src/utils/questionsFilter.js` | ค้นหา/กรองคลังฝั่ง admin (pure) |
| `src/utils/questionsMeta.js` | สรุป meta คลังให้หน้า quiz (pure) |
| `src/utils/questionReport.js` | snapshot ข้อตอนแจ้งผิด (pure) |
| `src/utils/importQuestions.js` | แปลง JSON นำเข้า → rows (pure) |
| `src/utils/text.js` | `LIMITS` ค่าเดียวของความยาวสูงสุด |
| `src/components/questions/TopicSelect.vue` | เลือกหมวดหลายค่า (ชิป + dropdown + เพิ่มหัวข้อใหม่) |
| `src/views/ReviewView.vue` | หน้าตรวจ: โหลดคิว · สุ่ม · ฟอร์ม · แก้ผลตรวจ · แถบความคืบหน้า |
| `src/views/QuestionsView.vue` | คลังข้อสอบ: ฟอร์ม/ตัวกรอง/แผงผลตรวจ |
| `src/views/QuizView.vue` | ฝั่งนักศึกษา: แสดงหมายเหตุผู้ตรวจท้ายเฉลย |
| `src/views/AdminView.vue` | ปุ่มซิงก์ระบบตรวจ (backfill + ซ่อม drift) |
| `firestore.rules` / `firestore.indexes.json` | สิทธิ์เขียน + index สำหรับหน้าต่างสุ่ม |

---

## Task 1: สถานะ `half` + น้ำหนักคิว (pure)

**Files:**
- Modify: `src/utils/questionReview.js`
- Test: `src/utils/questionReview.test.js`

**Interfaces:**
- Consumes: —
- Produces: `computeStatus(question) → 'pending'|'half'|'passed'|'failed'|'conflict'` · `REVIEW_WEIGHTS` · `reviewWeight(question) → number` · `pickWeighted(list, rnd = Math.random) → item|null` · `REVIEW_STATUS_LABEL.half`

- [ ] **Step 1: เขียนเทสที่ต้องแดงก่อน**

เพิ่มท้าย `src/utils/questionReview.test.js` (ไฟล์ใช้ `node:test` + `node:assert/strict` อยู่แล้ว — ดูหัวไฟล์เดิมแล้วใช้ import ชุดเดียวกัน):

```js
test("1 เสียง → half (แยกจาก pending เพื่อให้คิวเร่งข้อค้างได้)", () => {
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 0 }), 'half')
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 1 }), 'half')
})

test('ไม่มีเสียงเลย → pending', () => {
  assert.equal(computeStatus({}), 'pending')
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 0 }), 'pending')
})

test('เสียงที่ 3 นับด้วย — เสียงข้างมากตัดสิน', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 1 }), 'passed')
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 2 }), 'failed')
  assert.equal(computeStatus({ reviewPass: 3, reviewFail: 0 }), 'passed')
})

test('reviewWeight — conflict 8 · half 4 · pending 1', () => {
  assert.equal(reviewWeight({ reviewPass: 1, reviewFail: 1 }), 8)
  assert.equal(reviewWeight({ reviewPass: 1, reviewFail: 0 }), 4)
  assert.equal(reviewWeight({}), 1)
})

test('pickWeighted — เลือกตามช่วงน้ำหนักสะสม', () => {
  const pending = { id: 'p' }                               // น้ำหนัก 1
  const half = { id: 'h', reviewPass: 1, reviewFail: 0 }    // น้ำหนัก 4
  const list = [pending, half]                              // รวม 5
  assert.equal(pickWeighted(list, () => 0).id, 'p')         // 0.0 × 5 = 0   → ช่วงแรก
  assert.equal(pickWeighted(list, () => 0.1).id, 'p')       // 0.5           → ช่วงแรก
  assert.equal(pickWeighted(list, () => 0.5).id, 'h')       // 2.5           → ช่วงสอง
  assert.equal(pickWeighted(list, () => 0.999).id, 'h')     // ~5            → ช่วงสอง
})

test('pickWeighted — ลิสต์ว่างคืน null', () => {
  assert.equal(pickWeighted([], () => 0), null)
  assert.equal(pickWeighted(undefined, () => 0), null)
})

test('ป้ายสถานะมี half', () => {
  assert.equal(REVIEW_STATUS_LABEL.half, 'ตรวจแล้ว 1 คน')
})
```

แก้บรรทัด import ด้านบนของไฟล์เทสให้ดึงของใหม่เข้ามาด้วย: `reviewWeight`, `pickWeighted`, `REVIEW_STATUS_LABEL` (ถ้ายังไม่ได้ import)

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/questionReview.test.js`
Expected: FAIL — `computeStatus({reviewPass:1}) === 'pending'` ไม่ใช่ `'half'` และ `reviewWeight is not a function`

⚠️ เทสเดิมในไฟล์นี้บางตัวคาดว่า 1 เสียง = `'pending'` — ถ้ามี ให้แก้ค่าที่คาดหวังเป็น `'half'` (นี่คือการเปลี่ยนพฤติกรรมที่ตั้งใจ ไม่ใช่บั๊ก)

- [ ] **Step 3: แก้ `computeStatus` + เพิ่มฟังก์ชันใหม่**

แทนที่ `computeStatus` เดิมใน `src/utils/questionReview.js`:

```js
// สรุปสถานะจากตัวนับเสียงบนเอกสารข้อสอบ
//  0 เสียง → pending · 1 เสียง → half (ค้างครึ่งทาง คิวจะเร่งให้)
//  ≥2 เสียง: pass>fail → passed · fail>pass → failed · เสมอ → conflict (รอคนตัดสิน)
//  เสียงที่ 3 นับด้วย (เกิดตอนหลายคนตรวจชนกัน) — เสียงข้างมากตัดสิน ไม่มีทางเสมอที่เลขคี่
export function computeStatus(question) {
  const pass = question?.reviewPass || 0
  const fail = question?.reviewFail || 0
  const votes = pass + fail
  if (votes === 0) return 'pending'
  if (votes === 1) return 'half'
  if (pass > fail) return 'passed'
  if (fail > pass) return 'failed'
  return 'conflict'
}
```

เพิ่มต่อท้ายไฟล์ (ก่อน `buildLeaderboard`):

```js
// น้ำหนักคิวสุ่ม — ข้อที่ "ใกล้จบ" ต้องถูกหยิบบ่อยกว่า เพื่อให้มีข้อที่ตรวจครบ 2 เยอะขึ้น
export const REVIEW_WEIGHTS = { conflict: 8, half: 4, pending: 1 }
export function reviewWeight(question) {
  return REVIEW_WEIGHTS[computeStatus(question)] || 1
}

// สุ่ม 1 ข้อจากคิวตามน้ำหนัก (rnd ฉีดได้เพื่อเทส)
//  ผลพลอยได้: ต่างคนได้คนละข้อ → ลดการตรวจชนกันเทียบกับการเรียงแบบเดิม
export function pickWeighted(list, rnd = Math.random) {
  const items = list || []
  if (!items.length) return null
  const total = items.reduce((sum, q) => sum + reviewWeight(q), 0)
  let r = rnd() * total
  for (const q of items) {
    r -= reviewWeight(q)
    if (r < 0) return q
  }
  return items[items.length - 1]   // กันปัดเศษทศนิยมจนหลุดลูป
}
```

แก้ `REVIEW_STATUS_LABEL` เพิ่ม key `half`:

```js
export const REVIEW_STATUS_LABEL = {
  pending: 'รอตรวจ', half: 'ตรวจแล้ว 1 คน', passed: 'ผ่านตรวจ',
  conflict: 'ขัดแย้ง', failed: 'ไม่ผ่าน', retired: 'นำออก',
}
```

**อย่าแก้:** `needsReviewBy` (เงื่อนไข `reviewedBy.length < 2 || computeStatus === 'conflict'` ยังถูกต้อง) · `REVIEW_RESET` (ต้องรีเซ็ตเป็น `'pending'` ให้ตรงกับ rules `isReviewReset`) · `reviewContentChanged` (หมายเหตุ/หมวดต้องไม่ล้างผลตรวจ)

- [ ] **Step 4: รันเทสให้เขียว**

Run: `node --test src/utils/questionReview.test.js`
Expected: PASS ทุกเทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/questionReview.js src/utils/questionReview.test.js
git commit -m "Review: เพิ่มสถานะ half + น้ำหนักคิวสุ่ม (เร่งข้อที่ค้าง 1 เสียงให้ครบสอง)"
```

---

## Task 2: โมดูลหมวดหลายค่า (pure, ใหม่)

**Files:**
- Create: `src/utils/questionCategories.js`
- Test: `src/utils/questionCategories.test.js` (ใหม่)

**Interfaces:**
- Consumes: `cleanText`, `LIMITS` จาก `src/utils/text.js`
- Produces: `MAX_CATEGORIES = 5` · `getCategories(question) → string[]` · `normalizeCategories(arr) → string[]`

- [ ] **Step 1: เขียนเทส**

สร้าง `src/utils/questionCategories.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getCategories, normalizeCategories, MAX_CATEGORIES } from './questionCategories.js'

test('getCategories — ข้อใหม่ที่มี categories array', () => {
  assert.deepEqual(getCategories({ categories: ['เบาหวาน', 'ไต'] }), ['เบาหวาน', 'ไต'])
})

test('getCategories — ข้อเก่าที่มีแค่ category เดี่ยว → ห่อเป็น array', () => {
  assert.deepEqual(getCategories({ category: 'ยาปฏิชีวนะ' }), ['ยาปฏิชีวนะ'])
})

test('getCategories — categories ชนะ category เมื่อมีทั้งคู่', () => {
  assert.deepEqual(getCategories({ categories: ['ใหม่'], category: 'เก่า' }), ['ใหม่'])
})

test('getCategories — ไม่มีหมวด / ค่าว่าง / undefined → []', () => {
  assert.deepEqual(getCategories({}), [])
  assert.deepEqual(getCategories({ category: '' }), [])
  assert.deepEqual(getCategories({ categories: [] }), [])
  assert.deepEqual(getCategories(undefined), [])
})

test('getCategories — ตัดช่องว่างหัวท้ายและค่าซ้ำ', () => {
  assert.deepEqual(getCategories({ categories: ['  ไต  ', 'ไต', '', 'ตับ'] }), ['ไต', 'ตับ'])
})

test('normalizeCategories — clean + ตัดว่าง + unique', () => {
  assert.deepEqual(normalizeCategories(['ไต', '  ', 'ไต', 'ตับ']), ['ไต', 'ตับ'])
})

test(`normalizeCategories — เกิน ${MAX_CATEGORIES} ตัด`, () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  assert.equal(normalizeCategories(many).length, MAX_CATEGORIES)
  assert.deepEqual(normalizeCategories(many), ['a', 'b', 'c', 'd', 'e'])
})

test('normalizeCategories — ไม่ใช่ array → []', () => {
  assert.deepEqual(normalizeCategories(undefined), [])
  assert.deepEqual(normalizeCategories('ไต'), [])
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/questionCategories.test.js`
Expected: FAIL — `Cannot find module './questionCategories.js'`

- [ ] **Step 3: เขียนโมดูล**

สร้าง `src/utils/questionCategories.js`:

```js
// ════════════════════════════════════════════════════════════
//  หมวด / กลุ่มโรคของข้อสอบ — 1 ข้อมีได้หลายหมวด (MAX_CATEGORIES)
//  ทางเข้าเดียวของการอ่านหมวด: ห้ามอ่าน q.category ตรงๆ ที่อื่นอีก
//  ข้อเก่าเก็บเป็น category (string เดี่ยว) — getCategories ห่อให้อัตโนมัติ
//  จึงใช้งานได้ทันทีโดยไม่ต้องรอ migrate (ปุ่มซิงก์ใน Admin ค่อยตามเติมให้)
// ════════════════════════════════════════════════════════════
import { cleanText, LIMITS } from './text.js'

export const MAX_CATEGORIES = 5

// อ่านหมวดของข้อเป็น array เสมอ (ตัดค่าว่าง/ช่องว่างหัวท้าย/ค่าซ้ำ)
export function getCategories(question) {
  const raw = Array.isArray(question?.categories)
    ? question.categories
    : (question?.category ? [question.category] : [])
  return [...new Set(raw.map(c => (c || '').trim()).filter(Boolean))]
}

// เตรียมค่าก่อนเขียน Firestore — cleanText ทีละตัว + ตัดว่าง + unique + จำกัดจำนวน
export function normalizeCategories(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map(c => cleanText(c, LIMITS.category))
    .filter(Boolean)
  return [...new Set(clean)].slice(0, MAX_CATEGORIES)
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `node --test src/utils/questionCategories.test.js`
Expected: PASS ทุกเทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/questionCategories.js src/utils/questionCategories.test.js
git commit -m "Questions: โมดูลหมวดหลายค่า getCategories/normalizeCategories (รองรับ 1 ข้อหลายกลุ่มโรค)"
```

---

## Task 3: ตัวกรอง/ค้นหาคลัง รองรับหมวดหลายค่า

**Files:**
- Modify: `src/utils/questionsFilter.js`
- Test: `src/utils/questionsFilter.test.js`

**Interfaces:**
- Consumes: `getCategories` จาก Task 2
- Produces: `distinctCategories(list)` และ `filterQuestions(list, {search, status, category})` ที่เข้าใจ `categories` array

- [ ] **Step 1: เขียนเทสเพิ่ม**

เพิ่มท้าย `src/utils/questionsFilter.test.js` (ไฟล์มีชุดข้อ `Q` อยู่แล้ว — ชุดใหม่นี้ประกาศแยกไม่ทับของเดิม):

```js
const QM = [
  { id: 'm1', question: 'ผู้ป่วยเบาหวานร่วมกับโรคไต', categories: ['เบาหวาน', 'ไต'], isPublished: true },
  { id: 'm2', question: 'ยาลดความดัน', categories: ['ความดัน'], isPublished: true },
  { id: 'm3', question: 'ข้อเก่ายังใช้ category เดี่ยว', category: 'ไต', isPublished: true },
]

test('distinctCategories — รวมทุกค่าจาก categories + ข้อเก่าที่ยังเป็น category', () => {
  assert.deepEqual(distinctCategories(QM), ['ความดัน', 'เบาหวาน', 'ไต'].sort((a, b) => a.localeCompare(b)))
})

test('กรองหมวด — ข้อที่มีหลายหมวดต้องติดทุกหมวดที่ตัวเองอยู่', () => {
  assert.deepEqual(filterQuestions(QM, { category: 'เบาหวาน' }).map(q => q.id), ['m1'])
  assert.deepEqual(filterQuestions(QM, { category: 'ไต' }).map(q => q.id), ['m1', 'm3'])
})

test('ค้นหา — คำค้นแมตช์ชื่อหมวดที่สองได้', () => {
  assert.deepEqual(filterQuestions(QM, { search: 'ไต' }).map(q => q.id), ['m1', 'm3'])
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/questionsFilter.test.js`
Expected: FAIL — `distinctCategories` คืนแค่ `['ไต']` (อ่าน `q.category` อย่างเดียว) และการกรอง/ค้นหาไม่เห็น `categories`

- [ ] **Step 3: แก้ util**

ใน `src/utils/questionsFilter.js` เพิ่ม import ด้านบน:

```js
import { getCategories } from './questionCategories.js'
```

แทนที่ `distinctCategories` ทั้งฟังก์ชัน:

```js
// รายการหมวดที่ไม่ซ้ำ (รวมทุกค่าของข้อที่มีหลายหมวด) เรียงตามตัวอักษร — ใช้ทำ dropdown กรอง
export function distinctCategories(list) {
    const set = new Set()
    for (const q of (list || [])) for (const c of getCategories(q)) set.add(c)
    return [...set].sort((a, b) => a.localeCompare(b))
}
```

ใน `filterQuestions` แทนที่ 2 บรรทัดที่อ่าน `item.category`:

```js
        const cats = getCategories(item)
        if (category !== '__all' && !cats.includes(category)) return false
        if (q) {
            const hay = normForSearch(`${item.question || ''} ${cats.join(' ')}`)
            if (!hay.includes(q)) return false
        }
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `node --test src/utils/questionsFilter.test.js`
Expected: PASS ทุกเทส (รวมเทสเดิมที่ใช้ `category` เดี่ยว — `getCategories` ห่อให้อยู่แล้ว)

- [ ] **Step 5: Commit**

```bash
git add src/utils/questionsFilter.js src/utils/questionsFilter.test.js
git commit -m "Questions: ตัวกรอง/ค้นหาคลังอ่านหมวดหลายค่า (ข้อ 1 ข้อติดได้หลายกลุ่มโรค)"
```

---

## Task 4: meta / report / import + `LIMITS.reviewNote`

**Files:**
- Modify: `src/utils/questionsMeta.js`, `src/utils/questionReport.js`, `src/utils/importQuestions.js`, `src/utils/text.js`
- Test: `src/utils/questionsMeta.test.js`, `src/utils/importQuestions.test.js`

**Interfaces:**
- Consumes: `getCategories`, `normalizeCategories` จาก Task 2
- Produces: row ของ `parseImport` ใช้ `categories: string[]` แทน `category: string|null` · `LIMITS.reviewNote = 1000`

- [ ] **Step 1: เขียน/แก้เทส**

**ก)** เพิ่มท้าย `src/utils/questionsMeta.test.js`:

```js
test('categories ของ meta รวมทุกค่าจากข้อที่มีหลายหมวด', () => {
  const m = buildMeta([
    { isPublished: true, categories: ['เบาหวาน', 'ไต'] },
    { isPublished: true, category: 'ไต' },
    { isPublished: false, categories: ['ไม่นับ'] },
  ])
  assert.deepEqual(m.categories, ['เบาหวาน', 'ไต'].sort((a, b) => a.localeCompare(b, 'th')))
})
```

**ข)** แก้เทสเดิมใน `src/utils/importQuestions.test.js` 2 จุด (พฤติกรรมเปลี่ยนโดยตั้งใจ):

จุดที่ 1 — `assert.deepEqual(r.rows[0], {...})` เปลี่ยน `category: 'ยาปฏิชีวนะ',` เป็น `categories: ['ยาปฏิชีวนะ'],`

จุดที่ 2 — เทส `'category/explanation ไม่ส่งมา → เป็น null'` เปลี่ยนบรรทัด `assert.equal(r.rows[0].category, null)` เป็น `assert.deepEqual(r.rows[0].categories, [])`

**ค)** เพิ่มเทสใหม่ท้าย `src/utils/importQuestions.test.js`:

```js
test('นำเข้ารับ categories (array) ได้ และตัดค่าว่าง/ซ้ำ', () => {
  const r = parseImport(one({
    question: 'Q', choices: ['a', 'b'], answer: 0, categories: ['ไต', '', 'ไต', 'ตับ'],
  }))
  assert.deepEqual(r.rows[0].categories, ['ไต', 'ตับ'])
})

test('นำเข้ารับ category (string เดี่ยว) แบบเดิมได้ → ห่อเป็น array', () => {
  const r = parseImport(one({ question: 'Q', choices: ['a', 'b'], answer: 0, category: 'ไต' }))
  assert.deepEqual(r.rows[0].categories, ['ไต'])
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/questionsMeta.test.js src/utils/importQuestions.test.js`
Expected: FAIL ทั้งสองไฟล์ — meta ยังอ่าน `q.category` อย่างเดียว · row ยังคืน `category`

- [ ] **Step 3: แก้ทั้ง 4 ไฟล์**

**`src/utils/text.js`** — เพิ่มใน `LIMITS` ต่อจาก `reviewerName: 60,`:

```js
  reviewNote: 1000,
```

**`src/utils/questionsMeta.js`** — เพิ่ม import และแทนบรรทัด `const cats = ...`:

```js
import { getCategories } from './questionCategories.js'
```
```js
  const cats = [...new Set(pub.flatMap(q => getCategories(q)))]
```

**`src/utils/questionReport.js`** — เพิ่ม import และแก้ `category` ใน `buildSnapshot`:

```js
import { getCategories } from './questionCategories.js'
```
```js
    category: getCategories(q).join(', '),
```

**`src/utils/importQuestions.js`** — เพิ่ม import:

```js
import { normalizeCategories } from './questionCategories.js'
```

แทนบรรทัด `category: cleanText(item.category, LIMITS.category) || null,` ใน object ที่ return ด้วย `categories,` และเพิ่มการเตรียมค่าไว้เหนือ `return` (วางถัดจากบล็อก `examSets` ที่มีอยู่ ให้อ่านคู่กันเห็นว่าเป็น pattern เดียวกัน):

```js
  // หมวด/กลุ่มโรค: รับ categories (array) หรือ category (string เดี่ยว) — normalize + จำกัดจำนวน
  const categories = normalizeCategories(
    Array.isArray(item.categories) ? item.categories : (item.category != null ? [item.category] : [])
  )
```

- [ ] **Step 4: รันเทสทั้งชุดให้เขียว**

Run: `node --test src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js src/utils/questionsFilter.test.js`
Expected: PASS ทุกไฟล์ (`questionReport.test.js` เดิมผ่านได้เอง เพราะ `getCategories({category:'C'}).join(', ') === 'C'` และ `getCategories({}).join(', ') === ''`)

- [ ] **Step 5: Commit**

```bash
git add src/utils/questionsMeta.js src/utils/questionReport.js src/utils/importQuestions.js src/utils/text.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js
git commit -m "Questions: meta/report/import รองรับหมวดหลายค่า + LIMITS.reviewNote (เตรียมหมายเหตุผู้ตรวจ)"
```

---

## Task 5: firestore.rules + index

**Files:**
- Modify: `firestore.rules` (บล็อก `match /questions/{id}` และ `match /reviews/{reviewerUid}`)
- Modify: `firestore.indexes.json`

**Interfaces:**
- Consumes: —
- Produces: สิทธิ์เขียน `categories`/`reviewNote` ในเส้นทางตรวจ · `isReviewAmend(qid)` สำหรับ Task 12 · index `reviewStatus + rand` สำหรับ Task 10

- [ ] **Step 1: แก้ `reviewSubmitKeys()`**

ใน `firestore.rules` แทนที่ฟังก์ชันเดิม:

```
      // ชุด key ที่ยอมให้แตะตอน "ส่งผลตรวจ" = review keys + หมวด + หมายเหตุผู้ตรวจ
      // (ผู้ตรวจติดแท็กหมวดและเขียนหมายเหตุไปพร้อมกับการส่งผลได้ในทรานแซกชันเดียว)
      function reviewSubmitKeys() {
        return ['reviewedBy', 'reviewPass', 'reviewFail', 'reviewStatus', 'reviewVerdicts',
                'category', 'categories', 'reviewNote'].toSet();
      }
```

- [ ] **Step 2: เพิ่ม `isReviewAmend()` และต่อเข้ากับ `allow update`**

เพิ่มฟังก์ชันถัดจาก `isReviewSubmit(qid)`:

```
      // แก้ผลตรวจของตัวเอง: ไม่เพิ่มคนตรวจ (reviewedBy เท่าเดิม) + เสียงรวมเท่าเดิม
      // (ย้ายเสียงข้ามฝั่ง pass↔fail) + ต้องเขียน reviews/{uid} ของตัวเองในทรานแซกชันเดียวกัน
      function isReviewAmend(qid) {
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly(reviewSubmitKeys())
          && (request.auth.uid in resource.data.get('reviewedBy', []))
          && request.resource.data.get('reviewedBy', []) == resource.data.get('reviewedBy', [])
          && request.resource.data.get('reviewPass', 0) + request.resource.data.get('reviewFail', 0)
             == resource.data.get('reviewPass', 0) + resource.data.get('reviewFail', 0)
          && existsAfter(/databases/$(database)/documents/questions/$(qid)/reviews/$(request.auth.uid));
      }
```

แก้บรรทัด `allow update` ของ `match /questions/{id}`:

```
      allow update: if canEditQuestions()
        && (isAdmin() || reviewUntouched() || isReviewSubmit(id) || isReviewAmend(id) || isReviewReset());
```

- [ ] **Step 3: ยอมให้เจ้าของแก้ verdict ของตัวเองได้**

ใน `match /reviews/{reviewerUid}` แทนที่บล็อก `allow update` (เดิมล็อก `verdict` ไว้กัน desync — ตอนนี้การแก้มาพร้อม `isReviewAmend` ที่ย้ายตัวนับให้ในทรานแซกชันเดียวกันแล้ว):

```
        //  update: เจ้าของแก้ผลตรวจตัวเองได้ (verdict/reason/ref) — ห้ามเปลี่ยน reviewerUid
        //          (กันสวมชื่อคนอื่น) · ตัวนับบน doc ถูกย้ายพร้อมกันผ่าน isReviewAmend
        allow update: if isAdmin()
          || (canEditQuestions()
              && reviewerUid == request.auth.uid
              && request.resource.data.get('reviewerUid', '') == resource.data.get('reviewerUid', ''));
```

- [ ] **Step 4: เพิ่ม index**

ใน `firestore.indexes.json` เพิ่มเข้าไปในอาเรย์ `indexes` (ต่อท้ายก้อน `questions` ก้อนสุดท้าย):

```json
    {
      "collectionGroup": "questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "reviewStatus", "order": "ASCENDING" },
        { "fieldPath": "rand", "order": "ASCENDING" }
      ]
    },
```

ระวัง JSON comma — ก้อนใหม่ต้องมี `,` คั่นถูกต้องและไฟล์ยัง parse ได้

- [ ] **Step 5: ตรวจ + deploy**

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('json ok')"`
Expected: `json ok`

Run: `firebase deploy --only firestore:rules,firestore:indexes`
Expected: `Deploy complete!` — ถ้า rules มี syntax error CLI จะฟ้องพร้อมเลขบรรทัด ให้แก้แล้ว deploy ใหม่จนผ่าน
(index สร้างเสร็จอาจใช้เวลาสักครู่ — เช็กสถานะ Enabled ได้ที่ Firebase Console › Firestore › Indexes)

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "Rules: อนุญาต categories/reviewNote ในเส้นทางตรวจ + isReviewAmend + index reviewStatus+rand"
```

---

## Task 6: `TopicSelect` → เลือกหมวดหลายค่า

**Files:**
- Modify: `src/components/questions/TopicSelect.vue` (เขียนใหม่ทั้งไฟล์ตาม pattern ของ `ExamSetSelect.vue`)

**Interfaces:**
- Consumes: `MAX_CATEGORIES` จาก Task 2 · `useTopics()` (`topics`, `loadTopics`, `addTopic`) ของเดิม
- Produces: คอมโพเนนต์ที่รับ/ส่ง `modelValue: Array<string>` (ผู้ใช้: Task 7 และ Task 11)

- [ ] **Step 1: เขียนคอมโพเนนต์ใหม่**

แทนที่ `src/components/questions/TopicSelect.vue` ทั้งไฟล์:

```vue
<!-- src/components/questions/TopicSelect.vue — เลือกหมวด/กลุ่มโรคได้หลายค่า (สูงสุด MAX_CATEGORIES) -->
<template>
  <div class="ts">
    <!-- หมวดที่เลือกไว้ (ชิป) -->
    <div v-if="modelValue.length" class="ts-chips">
      <span v-for="name in modelValue" :key="name" class="ts-chip">
        {{ name }}
        <button type="button" class="ts-chip-x" @click="removeTopic(name)" aria-label="ถอดหมวดนี้">✕</button>
      </span>
    </div>

    <select class="ts-input" :value="''" :disabled="full" @change="onSelect">
      <option value="">{{ full ? `เลือกได้สูงสุด ${MAX_CATEGORIES} หมวด` : '+ เลือกหมวด / กลุ่มโรค…' }}</option>
      <option v-for="t in available" :key="t" :value="t">{{ t }}</option>
      <option value="__add">➕ เพิ่มหัวข้อใหม่…</option>
    </select>

    <div v-if="adding" class="ts-add">
      <input v-model="newName" :maxlength="LIMITS.category" class="ts-input" placeholder="ชื่อหัวข้อใหม่ เช่น ยาปฏิชีวนะ" @keydown.enter.prevent="confirmAdd" />
      <button type="button" class="ts-btn" :disabled="busy || !newName.trim()" @click="confirmAdd">เพิ่ม</button>
      <button type="button" class="ts-btn ts-cancel" @click="cancelAdd">ยกเลิก</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTopics } from '../../composables/useTopics.js'
import { useToast } from '../../composables/useToast.js'
import { LIMITS } from '../../utils/text.js'
import { MAX_CATEGORIES } from '../../utils/questionCategories.js'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const { topics, loadTopics, addTopic } = useTopics()
const { toast } = useToast()
const adding = ref(false)
const newName = ref('')
const busy = ref(false)

onMounted(loadTopics)

const full = computed(() => props.modelValue.length >= MAX_CATEGORIES)
// หัวข้อที่ยังไม่ถูกเลือก (ค่าที่เลือกแล้วไม่ต้องโผล่ซ้ำ)
const available = computed(() => topics.value.filter(t => !props.modelValue.includes(t)))

function add(name) {
  if (!name || props.modelValue.includes(name) || full.value) return
  emit('update:modelValue', [...props.modelValue, name])
}
function removeTopic(name) {
  emit('update:modelValue', props.modelValue.filter(n => n !== name))
}
function onSelect(e) {
  const v = e.target.value
  e.target.value = ''                    // reset ไม่ให้ค้างค่าใน select
  if (v === '__add') { adding.value = true; return }
  add(v)
}
function cancelAdd() { adding.value = false; newName.value = '' }

async function confirmAdd() {
  if (busy.value) return
  busy.value = true
  try {
    const name = await addTopic(newName.value)
    if (!name) { toast('ชื่อหัวข้อใช้ไม่ได้ ลองพิมพ์ใหม่', 'error'); return }   // cleanText strip จนว่าง
    add(name)
    cancelAdd()
  } catch (e) { console.error('[topic add]', e); toast('เพิ่มหัวข้อไม่สำเร็จ', 'error') }
  finally { busy.value = false }
}
</script>

<style scoped>
.ts-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.ts-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--primary-light, #eef2ff); color: #4f46e5; border-radius: 999px; padding: 4px 6px 4px 11px; font-size: .74rem; font-weight: 700; }
.ts-chip-x { border: none; background: rgba(0,0,0,.08); border-radius: 50%; width: 18px; height: 18px; cursor: pointer; color: #4f46e5; font-size: .66rem; line-height: 1; }
.ts-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; background: #fff; }
.ts-input:focus { outline: none; box-shadow: var(--pop); }
.ts-input:disabled { background: #f1f5f9; color: rgba(0,0,0,.45); }
.ts-add { display: flex; gap: 6px; margin-top: 6px; }
.ts-add .ts-input { flex: 1; }
.ts-btn { flex-shrink: 0; border: 2px solid var(--ink); border-radius: 9px; padding: 6px 12px; font-family: inherit; font-size: .75rem; font-weight: 800; background: var(--primary); color: #fff; cursor: pointer; }
.ts-btn:disabled { background: #cbd5e1; cursor: default; }
.ts-cancel { background: #fff; color: var(--ink); }
</style>
```

> หมายเหตุ: ค่าเดิมของข้อเก่าที่ไม่อยู่ในลิสต์กลาง (พิมพ์อิสระ) ยังคงอยู่ได้ เพราะมันมาเป็นชิปจาก `modelValue` ไม่ได้พึ่ง `topics`

- [ ] **Step 2: ตรวจว่า build ไม่พัง (ยังไม่มีใครส่ง array ให้ — จะแก้ใน Task 7/11)**

Run: `npm run build`
Expected: build ผ่าน (อาจมี warning เรื่อง prop type ตอน runtime เท่านั้น ซึ่งจะหายเมื่อ Task 7/11 เสร็จ)

- [ ] **Step 3: Commit**

```bash
git add src/components/questions/TopicSelect.vue
git commit -m "Questions: TopicSelect เลือกหมวดได้หลายค่า (ชิป + dropdown ตาม pattern ExamSetSelect)"
```

---

## Task 7: คลังข้อสอบ — หมวดหลายค่า + ช่องหมายเหตุผู้ตรวจ

**Files:**
- Modify: `src/views/QuestionsView.vue`

**Interfaces:**
- Consumes: `getCategories`, `normalizeCategories` (Task 2) · `TopicSelect` แบบ array (Task 6)
- Produces: เอกสารข้อสอบที่บันทึกจากหน้านี้มี `categories: string[]` และ `reviewNote: string|null`

- [ ] **Step 1: import ของใหม่**

เพิ่มบรรทัด import ในบล็อก `<script setup>`:

```js
import { getCategories, normalizeCategories } from '../utils/questionCategories.js'
```

- [ ] **Step 2: ฟอร์ม — เปลี่ยน TopicSelect เป็น array + เพิ่มช่องหมายเหตุ**

แทนที่ 2 บรรทัดในเทมเพลต:

```html
        <label class="qz-label">หมวด / กลุ่มโรค (เลือกได้หลายกลุ่ม)</label>
        <TopicSelect v-model="draft.categories" />
```

และเพิ่มช่องหมายเหตุถัดจากช่อง `explanation` ในฟอร์ม (ค้นหา `draft.explanation` ในเทมเพลตแล้ววางต่อท้ายบล็อกนั้น):

```html
        <label class="qz-label">หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย — ไม่บังคับ)</label>
        <textarea v-model="draft.reviewNote" :maxlength="LIMITS.reviewNote" class="qz-input" rows="2" placeholder="ข้อควรระวัง / จุดที่คนมักเข้าใจผิด…"></textarea>
```

- [ ] **Step 3: แถวรายการ + แผงรายละเอียด — แสดงหลายชิป**

แทนที่บรรทัดที่แสดงหมวดในแผงรายละเอียด (`<span v-if="q.category" class="qz-cat qz-cat-sm">{{ q.category }}</span>`):

```html
            <span v-for="c in getCategories(q)" :key="c" class="qz-cat qz-cat-sm">{{ c }}</span>
```

และในแถวรายการ (`<span v-if="q.category" class="qz-cat qz-cat-sm">` ตัวที่อยู่ในบล็อก `qz-row` ถ้ามี) ใช้รูปแบบเดียวกัน

เพิ่มการแสดงหมายเหตุในแผงรายละเอียด ถัดจากบรรทัด `qz-exp`:

```html
            <div v-if="q.reviewNote" class="qz-note"><Emoji char="📝" /> {{ q.reviewNote }}</div>
```

เพิ่ม style ใน `<style scoped>`:

```css
.qz-note { margin-top: 7px; font-size: .74rem; color: #1e40af; background: #eff6ff; border-radius: 8px; padding: 8px 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
```

- [ ] **Step 4: draft / edit / save**

ใน `blankDraft()` (บรรทัดที่ return object ตั้งต้น) เปลี่ยน `category: ''` เป็น:

```js
categories: [], reviewNote: '',
```

ใน `edit(q)` เปลี่ยน `category: q.category || '',` เป็น:

```js
    categories: getCategories(q),
    reviewNote: q.reviewNote || '',
```

ใน `save()` เปลี่ยนบรรทัด `category: cleanText(d.category, LIMITS.category) || null,` ใน `payload` เป็น:

```js
    categories: normalizeCategories(d.categories),
    reviewNote: cleanText(d.reviewNote, LIMITS.reviewNote) || null,
```

> `reviewContentChanged()` ไม่ได้ดู `categories`/`reviewNote` ⇒ แก้สองอย่างนี้จะ **ไม่** ล้างผลตรวจ (ตั้งใจ) — ห้ามเพิ่มสองฟิลด์นี้เข้าไปใน `reviewContentChanged`

- [ ] **Step 5: กล่องช่วยเหลือรูปแบบ JSON ของ import**

ในบล็อกคำอธิบายรูปแบบ import (ที่มีบรรทัดอธิบาย `examSets`) เพิ่มบรรทัดอธิบายหมวดหลายค่า:

```html
              <code>categories</code> = array ชื่อหมวด/กลุ่มโรค เช่น <code>["เบาหวาน","ไต"]</code> (หรือ <code>category</code> เดี่ยว) · ไม่บังคับ · สูงสุด 5 กลุ่ม ·
```

- [ ] **Step 6: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

Run: `npm run dev` แล้วเปิดหน้าคลังข้อสอบ ตรวจด้วยตา:
- เพิ่มข้อใหม่ ติดหมวด 2–3 กลุ่ม → บันทึก → กางข้อดู เห็นชิปครบทุกกลุ่ม
- ติดครบ 5 กลุ่มแล้ว dropdown ต้องถูก disable พร้อมข้อความบอก
- แก้ข้อเก่าที่มี `category` เดี่ยว → ฟอร์มต้องโชว์เป็นชิป 1 อัน → บันทึกแล้วกลายเป็น `categories`
- ตัวกรองหมวดยังเลือกได้และกรองถูก
- ใส่หมายเหตุผู้ตรวจ → บันทึก → กางข้อเห็นกล่องน้ำเงิน 📝
- **สำคัญ:** แก้แค่หมวด/หมายเหตุแล้วบันทึก → ป้าย "สถานะตรวจ" ต้อง **ไม่** กลับไปเป็น "รอตรวจ"

- [ ] **Step 7: Commit**

```bash
git add src/views/QuestionsView.vue
git commit -m "Questions: คลังข้อสอบรองรับหมวดหลายค่า + ช่องหมายเหตุผู้ตรวจ (แก้แล้วไม่ล้างผลตรวจ)"
```

---

## Task 8: คลังข้อสอบ — บอกว่าใครตรวจ (เสริมของเดิม)

**Files:**
- Modify: `src/views/QuestionsView.vue`

**Interfaces:**
- Consumes: `reviewMeta/main.names` (แผนที่ uid → ชื่อจริง ที่ ReviewView เขียนไว้ตอน submit)
- Produces: —

> บริบท: หน้านี้**มีแผงผลตรวจอยู่แล้ว** (`detailReviews` โหลด subcollection ตอนกางข้อ แสดงชื่อ + ผลตัดสิน + เหตุผล) งานนี้คือเติมส่วนที่ยังขาด: บรรทัดสรุป "ตรวจโดย" ที่เห็นทันทีโดยไม่ต้องรอโหลด + เรฟและเวลาในแต่ละผลตรวจ

- [ ] **Step 1: โหลด `reviewMeta/main` ตอนเข้าหน้า**

เพิ่ม state ใกล้ ๆ ตัวแปร `detailReviews`:

```js
const reviewerNames = ref({})   // uid → ชื่อจริง (จาก reviewMeta) — ใช้โชว์ "ตรวจโดย" โดยไม่ต้องอ่าน subcollection
```

ใน `load()` เพิ่มการอ่าน 1 doc (วางไว้หลังการโหลดคลังหลัก ใช้ `getDoc` ที่ import อยู่แล้ว — ถ้ายังไม่ได้ import ให้เพิ่ม `getDoc` ในบรรทัด import ของ `firebase/firestore`):

```js
  try {
    const metaSnap = await getDoc(doc(db, 'reviewMeta', 'main'))
    usage.track(1)
    if (metaSnap.exists()) reviewerNames.value = metaSnap.data().names || {}
  } catch (e) { console.error('[reviewMeta names]', e) }   // ไม่ critical — ปล่อยหน้าใช้งานต่อได้
```

- [ ] **Step 2: helper ชื่อผู้ตรวจ**

เพิ่มถัดจาก `reviewerNames`:

```js
// ชื่อคนที่ตรวจข้อนี้ — อ่านจาก reviewedBy บน doc (มีอยู่แล้ว ไม่เปลือง read) + แผนที่ชื่อจาก reviewMeta
function reviewerListOf(q) {
  return (q.reviewedBy || []).map(uid => reviewerNames.value[uid] || 'ไม่ระบุ')
}
```

- [ ] **Step 3: แสดงในแผงรายละเอียด**

เพิ่มบรรทัดถัดจาก `<div class="qz-audit-row"><b>สถานะตรวจ:</b> …</div>`:

```html
              <div class="qz-audit-row">
                <b>ตรวจโดย:</b>
                <span v-if="q.reviewedBy?.length">{{ reviewerListOf(q).join(', ') }}</span>
                <span v-else>ยังไม่มีใครตรวจ</span>
              </div>
```

และเติมเรฟ + เวลาในแต่ละผลตรวจ (แทนที่บล็อก `qz-audit-rev` เดิม):

```html
                <div v-for="r in detailReviews" :key="r.id" class="qz-audit-rev">
                  <b>{{ r.reviewerName || 'ไม่ระบุ' }}</b> — {{ VERDICT_LABEL[r.verdict] || r.verdict }}
                  <span class="qz-audit-time">· {{ fmtTime(r.ts) || '—' }}</span>
                  <div v-if="r.reason" class="qz-audit-reason">{{ r.reason }}</div>
                  <div v-if="r.ref" class="qz-audit-ref">เรฟ: {{ r.ref }}</div>
                </div>
```

เพิ่ม style:

```css
.qz-audit-time { color: rgba(0,0,0,.4); font-size: .66rem; }
.qz-audit-ref { color: rgba(0,0,0,.45); font-size: .68rem; margin-top: 2px; overflow-wrap: anywhere; }
```

(ถ้า `.qz-audit-reason` เดิมเป็น `<span>` inline อยู่ ให้ปรับ style ให้เป็นบล็อกอ่านง่าย: `display:block; font-size:.72rem; color:rgba(0,0,0,.65); line-height:1.4; margin-top:2px; white-space:pre-wrap; overflow-wrap:anywhere;`)

- [ ] **Step 4: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → เปิดคลังข้อสอบ กางข้อที่มีคนตรวจแล้ว:
- เห็นบรรทัด "ตรวจโดย: <ชื่อ>, <ชื่อ>" ทันทีโดยไม่ต้องรอโหลด
- ผลตรวจแต่ละอันมีเวลา และมีเรฟ (ถ้าผู้ตรวจใส่มา)
- ข้อที่ยังไม่มีใครตรวจ เห็น "ยังไม่มีใครตรวจ"

- [ ] **Step 5: Commit**

```bash
git add src/views/QuestionsView.vue
git commit -m "Questions: บรรทัดตรวจโดย + เรฟ/เวลาในผลตรวจ (ทีมวิชาการตามงานกันได้)"
```

---

## Task 9: ฝั่งนักศึกษา — แสดงหมายเหตุผู้ตรวจท้ายเฉลย

**Files:**
- Modify: `src/views/QuizView.vue`

**Interfaces:**
- Consumes: `question.reviewNote`
- Produces: —

- [ ] **Step 1: เพิ่มการแสดงผล**

ใต้บรรทัดเฉลยเดิม (`<div v-if="current.explanation" class="qv-exp">…</div>`) เพิ่ม:

```html
        <div v-if="current.reviewNote" class="qv-note"><Emoji char="📝" /> หมายเหตุจากผู้ตรวจ: {{ current.reviewNote }}</div>
```

เพิ่ม style ใน `<style scoped>` (โทนน้ำเงินให้ต่างจากเฉลยที่เป็นเหลือง จะได้เห็นว่าคนละก้อน):

```css
.qv-note { margin-top: 8px; font-size: .76rem; color: #1e40af; background: #eff6ff; border-radius: 8px; padding: 9px 11px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
```

**ห้ามแสดงชื่อผู้ตรวจตรงนี้** — ชื่อเห็นเฉพาะทีมวิชาการเท่านั้น (และ `reviewMeta` นักศึกษาอ่านไม่ได้อยู่แล้ว)

- [ ] **Step 2: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → ทำควิซข้อที่ใส่ `reviewNote` ไว้จาก Task 7 → ตอบแล้วต้องเห็นกล่องน้ำเงิน "📝 หมายเหตุจากผู้ตรวจ: …" ใต้เฉลย · ข้อที่ไม่มีหมายเหตุต้องไม่มีกล่องว่างโผล่

- [ ] **Step 3: Commit**

```bash
git add src/views/QuizView.vue
git commit -m "Quiz: แสดงหมายเหตุผู้ตรวจท้ายเฉลย (คำอธิบายเพิ่มเติมจากทีมวิชาการ)"
```

---

## Task 10: หน้าตรวจ — โหลดคิวแบบต้นทุนคงที่ + สุ่มถ่วงน้ำหนัก

**Files:**
- Modify: `src/views/ReviewView.vue`

**Interfaces:**
- Consumes: `pickWeighted` (Task 1) · `quizSample(first, wrap, n)` จาก `src/utils/quizSample.js` · index `reviewStatus + rand` (Task 5)
- Produces: `currentId` ref + `pickNext()` — Task 11/12 เรียกใช้หลังส่ง/แก้ผลตรวจ

- [ ] **Step 1: แก้ import**

เพิ่ม `orderBy, startAt, limit` เข้าไปในบรรทัด import ของ `firebase/firestore` และเพิ่ม 2 บรรทัด:

```js
import { pickWeighted } from '../utils/questionReview.js'   // รวมกับ import เดิมจากไฟล์นี้ได้
import { quizSample } from '../utils/quizSample.js'
```

- [ ] **Step 2: เปลี่ยน `current` จาก computed ตัวแรกของคิว เป็นข้อที่สุ่มไว้**

แทนที่บล็อก `queue` / `current` เดิม:

```js
const HALF_LIMIT = 200      // ข้อค้าง 1 เสียง + ขัดแย้ง — ดึงมาให้ครบ (ปกติมีไม่เยอะ)
const PENDING_WINDOW = 40   // ข้อที่ยังไม่มีใครตรวจ — สุ่มหน้าต่างเล็กพอ ต้นทุนคงที่

const currentId = ref(null)
// คิวข้อที่ต้องให้ฉันตรวจ ลบข้อที่กด "ข้าม" ในเซสชันนี้
const queue = computed(() =>
  nextReviewQueue(list.value, myUid.value).filter(q => !skippedIds.value.has(q.id)))
// ข้อปัจจุบัน = ข้อที่สุ่มไว้ (ตรึงไว้จนกว่าจะส่ง/ข้าม — ห้ามผูกกับ queue[0] ไม่งั้นข้อจะเด้งเอง)
const current = computed(() => queue.value.find(q => q.id === currentId.value) || null)

// สุ่มข้อถัดไปตามน้ำหนัก: ขัดแย้ง ×8 · ค้าง 1 เสียง ×4 · ยังไม่มีใครตรวจ ×1
function pickNext() {
  const q = pickWeighted(queue.value)
  currentId.value = q ? q.id : null
}
```

- [ ] **Step 3: เขียน `load()` ใหม่**

แทนที่ฟังก์ชัน `load()` ทั้งฟังก์ชัน:

```js
// โหลดคิว 2 ก้อนแยกกัน — ต้นทุน read คงที่ไม่โตตามขนาดคลัง
//  ก้อน A: ข้อค้าง 1 เสียง + ขัดแย้ง → ดึงมาให้ครบ (นี่คือข้อที่เราอยากเร่งให้จบ)
//  ก้อน B: ข้อที่ยังไม่มีใครตรวจ → สุ่มหน้าต่างด้วย field rand (pattern เดียวกับ QuizView)
//  ข้อเก่าก่อนระบบตรวจไม่มี field reviewStatus จะไม่ติด query —
//  แอดมินต้องกด "🔄 ซิงก์ระบบตรวจ" ในหน้า Admin หนึ่งครั้งก่อนเริ่มใช้
async function load() {
  loading.value = true
  try {
    const col = collection(db, 'questions')
    const R = Math.random()
    const [halfSnap, firstSnap, metaSnap] = await Promise.all([
      getDocs(query(col, where('reviewStatus', 'in', ['half', 'conflict']), limit(HALF_LIMIT))),
      getDocs(query(col, where('reviewStatus', '==', 'pending'), orderBy('rand'), startAt(R), limit(PENDING_WINDOW))),
      getDoc(doc(db, 'reviewMeta', 'main')),
    ])
    let reads = halfSnap.size + firstSnap.size + 1
    // สุ่มไปชนปลายลิสต์ → วนอ่านต้นลิสต์เติมให้เต็มหน้าต่าง
    let wrap = []
    if (firstSnap.size < PENDING_WINDOW) {
      const wrapSnap = await getDocs(query(col, where('reviewStatus', '==', 'pending'), orderBy('rand'), limit(PENDING_WINDOW)))
      wrap = wrapSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      reads += wrapSnap.size
    }
    usage.track(reads)
    const pending = quizSample(firstSnap.docs.map(d => ({ id: d.id, ...d.data() })), wrap, PENDING_WINDOW)
    list.value = [...halfSnap.docs.map(d => ({ id: d.id, ...d.data() })), ...pending]
    if (metaSnap.exists()) meta.value = metaSnap.data()
    pickNext()
  } catch (e) { console.error('[review load]', e); toast('โหลดข้อสอบไม่สำเร็จ', 'error') }
  finally { loading.value = false }
}
```

> ลบการ `.sort()` ตาม `createdAt` ทิ้ง — ไม่ต้องเรียงแล้วเพราะเลือกข้อด้วยการสุ่มถ่วงน้ำหนัก (และการเรียงแบบเดิมคือสาเหตุที่ทุกคนได้ข้อเดียวกันจนตรวจชนกัน)

- [ ] **Step 4: เรียก `pickNext()` ทุกจุดที่คิวขยับ**

- ใน `skip()` เพิ่ม `pickNext()` เป็นบรรทัดสุดท้าย
- ใน `unskipAll()` เพิ่ม `pickNext()` ต่อจากการล้าง Set
- ใน `submit()` หลังอัปเดต `list.value[idx]` สำเร็จ ให้เรียก `pickNext()` (ถ้ายังไม่ได้ทำใน Task 11 ให้เพิ่มที่นี่ก่อน)

- [ ] **Step 5: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → เปิด `/review` ด้วยบัญชีวิชาการ:
- ข้อขึ้นมาเป็นข้อสุ่ม ไม่ใช่ข้อใหม่สุดเสมอ · กด "ข้ามข้อนี้" หลายครั้ง ต้องได้ข้อต่าง ๆ กัน
- รีเฟรชหน้าหลายรอบ ควรได้ข้อเริ่มต้นต่างกัน (สุ่ม)
- เปิด DevTools › Network ดูว่ามี query 2–3 ก้อน และจำนวน doc ที่อ่านไม่เกิน ~240
- ถ้าเจอ error `The query requires an index` ⇒ index จาก Task 5 ยังสร้างไม่เสร็จ รอสักครู่แล้วลองใหม่

- [ ] **Step 6: Commit**

```bash
git add src/views/ReviewView.vue
git commit -m "Review: โหลดคิว 2 ก้อน + สุ่มถ่วงน้ำหนัก (ต้นทุน read คงที่ + เร่งข้อค้าง + ลดตรวจชนกัน)"
```

---

## Task 11: หน้าตรวจ — หมวดหลายค่า + หมายเหตุ + toast + ตัวนับความคืบหน้า

**Files:**
- Modify: `src/views/ReviewView.vue`

**Interfaces:**
- Consumes: `normalizeCategories`, `getCategories` (Task 2) · `TopicSelect` array (Task 6) · `computeStatus` (Task 1)
- Produces: `reviewMeta/main.progress` — Task 13 อ่านไปแสดง

- [ ] **Step 1: import + state**

เพิ่ม import:

```js
import { getCategories, normalizeCategories } from '../utils/questionCategories.js'
```

เปลี่ยน state `topic` เป็น array และเพิ่ม state หมายเหตุ:

```js
const topics = ref([])        // หมวด/กลุ่มโรคของข้อปัจจุบัน (ตั้งต้นจากของเดิม แก้ได้ระหว่างตรวจ)
const note = ref('')          // หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย) — ต่อเติมจากของเดิมได้
const hadNote = ref(false)    // ข้อนี้มีหมายเหตุจากคนก่อนไหม (ใช้โชว์ป้ายเตือนไม่ให้ลบทิ้ง)
```

- [ ] **Step 2: watch ข้อปัจจุบัน — เติมค่าเดิมลงฟอร์ม**

ใน `watch(current, …)` แทนบรรทัด `topic.value = q?.category || null` ด้วย:

```js
  topics.value = getCategories(q)
  note.value = q?.reviewNote || ''
  hadNote.value = !!q?.reviewNote
```

- [ ] **Step 3: เทมเพลตฟอร์ม**

แทน `<TopicSelect v-model="topic" />` และ label ของมัน:

```html
          <label class="rv-label">หมวด / กลุ่มโรค (เลือกได้หลายกลุ่ม — ใช้ทำสถิติรายหัวข้อ)</label>
          <TopicSelect v-model="topics" />
```

เพิ่มช่องหมายเหตุถัดจากช่องเรฟ:

```html
          <label class="rv-label">
            หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย — ไม่บังคับ)
            <span v-if="hadNote" class="rv-note-hint">มีหมายเหตุจากผู้ตรวจคนก่อน — ต่อเติมหรือขัดเกลาได้</span>
          </label>
          <textarea v-model="note" :maxlength="LIMITS.reviewNote" class="rv-input" rows="3" placeholder="ข้อควรระวัง / จุดที่คนมักเข้าใจผิด…"></textarea>
```

เพิ่ม style:

```css
.rv-note-hint { display: block; font-weight: 700; color: #b45309; font-size: .64rem; margin-top: 2px; }
```

- [ ] **Step 4: เขียนค่าใหม่ในทรานแซกชัน `submit()`**

ใน `runTransaction` แทนที่บล็อกที่คำนวณ/เขียน `qPatch` ด้วย:

```js
      const oldStatus = computeStatus(cur)
      newPass = (cur.reviewPass || 0) + (isPass ? 1 : 0)
      newFail = (cur.reviewFail || 0) + (isPass ? 0 : 1)
      newStatus = computeStatus({ reviewPass: newPass, reviewFail: newFail })
      wasResolved = oldStatus === 'passed' || oldStatus === 'failed'   // ข้อปิดไปแล้ว = เราเป็นเสียงที่ 3
      // 1) รายละเอียดเต็มใน subcollection (doc id = uid → กันตรวจซ้ำ)
      tx.set(doc(db, 'questions', q.id, 'reviews', uid), {
        reviewerUid: uid,
        reviewerName,
        verdict: v,
        reason: cleanText(reason.value, LIMITS.reviewReason),
        ref: cleanText(refText.value, LIMITS.reviewRef),
        ts: serverTimestamp(),
      })
      // 2) aggregate บนข้อ — ห้ามใส่ field นอก reviewSubmitKeys (rules ใช้ hasOnly จะปฏิเสธทั้งก้อน)
      const qPatch = {
        reviewedBy: arrayUnion(uid),
        reviewPass: newPass,
        reviewFail: newFail,
        reviewStatus: newStatus,
        reviewVerdicts: deleteField(),   // ล้าง map โครงเก่า (ถ้ามี)
      }
      const newCats = normalizeCategories(topics.value)
      if (JSON.stringify(newCats) !== JSON.stringify(getCategories(cur))) qPatch.categories = newCats
      const newNote = cleanText(note.value, LIMITS.reviewNote)
      if (newNote !== (cur.reviewNote || '')) qPatch.reviewNote = newNote || null
      tx.update(qRef, qPatch)
      // 3) ตัวนับ leaderboard + ชื่อ snapshot + ความคืบหน้าคลัง (collection แยก นักศึกษาอ่านไม่ได้)
      //    oldStatus === newStatus ได้จริง (เช่น passed 2-0 + เสียงที่ 3 = passed 3-0)
      //    ต้องไม่ใส่ increment ซ้ำ key เดียวกันในก้อนเดียว ไม่งั้นตัวหลังทับตัวแรก = ตัวเลขเพี้ยน
      const progress = oldStatus === newStatus
        ? {}
        : { [oldStatus]: increment(-1), [newStatus]: increment(1) }
      tx.set(doc(db, 'reviewMeta', 'main'),
        { counts: { [uid]: increment(1) }, names: { [uid]: reviewerName }, progress }, { merge: true })
```

ประกาศตัวแปร 2 ตัวนี้ไว้ข้าง ๆ `let newPass = 0, newFail = 0, …` (นอกทรานแซกชัน) และ **เซ็ตค่าใหม่ต้นทรานแซกชันทุกครั้งเหมือน `already`** เพราะทรานแซกชันรีทรายได้ ค่าที่ใช้ต่อต้องเป็นของรอบที่สำเร็จจริง:

```js
let wasResolved = false      // ข้อปิดไปแล้วตอนเราส่ง = เราเป็นเสียงที่ 3
let oldStatusLocal = 'pending'   // สถานะก่อนหน้า — Task 13 ใช้ขยับแถบความคืบหน้าในเครื่อง
```

ในทรานแซกชัน หลังบรรทัด `const oldStatus = computeStatus(cur)` ให้เพิ่ม `oldStatusLocal = oldStatus`

- [ ] **Step 5: toast ให้ตรงความจริง**

แทนบล็อกหลังทรานแซกชันสำเร็จ:

```js
    if (already) {
      toast('คุณตรวจข้อนี้ไปแล้ว', 'info')
    } else if (wasResolved) {
      toast('มีคนตรวจข้อนี้พร้อมกัน — นับเสียงคุณเป็นเสียงที่ 3 ด้วยแล้ว', 'success')
    } else {
      toast('ส่งผลตรวจแล้ว ขอบคุณ!', 'success')
    }
    pickNext()
```

(ถ้า `useToast` ไม่รองรับชนิด `'info'` ให้ใช้ค่า default ของโปรเจกต์แทน — เช็กที่ `src/composables/useToast.js` ก่อน)

อัปเดต local ให้ตรงกับที่เขียนจริง — แทนบล็อก `const patch = already ? {} : {...}`:

```js
      const patch = already ? {} : {
        reviewPass: newPass, reviewFail: newFail, reviewStatus: newStatus,
        categories: normalizeCategories(topics.value),
        reviewNote: cleanText(note.value, LIMITS.reviewNote) || null,
      }
```

- [ ] **Step 6: ข้อความกล่องยืนยัน**

แก้ข้อความใน `confirm(...)` จาก `'ส่งแล้วแก้เองไม่ได้ — ถ้ากดพลาดให้แจ้งแอดมินล้างผลตรวจ'` เป็น:

```
ส่งแล้วยังกดแก้ได้จากแถบด้านล่างก่อนออกจากหน้านี้
```

- [ ] **Step 7: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → `/review`:
- ติดหมวดหลายกลุ่มแล้วส่ง → เปิดคลังข้อสอบดูข้อนั้น เห็นชิปครบ
- ข้อที่มีหมายเหตุอยู่แล้ว ต้องเห็นข้อความเดิมในช่อง + ป้ายส้มเตือน
- ส่งผลตรวจ 1 ข้อ → เปิด Firestore Console ดู `reviewMeta/main` ต้องมี `progress` ที่ขยับ (เช่น `pending` ลด 1, `half` เพิ่ม 1)
- ⚠️ ถ้าเจอ error สิทธิ์ (`Missing or insufficient permissions`) แปลว่า rules Task 5 ยังไม่ได้ deploy หรือมี field เกินใน `qPatch`

- [ ] **Step 8: Commit**

```bash
git add src/views/ReviewView.vue
git commit -m "Review: หมวดหลายค่า + หมายเหตุผู้ตรวจ + toast ตรงความจริง + ตัวนับความคืบหน้า"
```

---

## Task 12: หน้าตรวจ — แก้ผลตรวจที่เพิ่งส่ง

**Files:**
- Modify: `src/views/ReviewView.vue`

**Interfaces:**
- Consumes: `isReviewAmend` ใน rules (Task 5) · `computeStatus` (Task 1)
- Produces: —

- [ ] **Step 1: state ของ "ข้อล่าสุดที่ส่ง"**

```js
// ข้อที่เพิ่งส่งในเซสชันนี้ — ให้กดแก้ได้ถ้ากดพลาด (หายเมื่อรีโหลดหน้า)
const lastSubmit = ref(null)     // { qid, qhash, verdict, reason, ref, questionText }
const amending = ref(false)      // กำลังเปิดฟอร์มแก้อยู่ไหม
const amendVerdict = ref(null)
const amendReason = ref('')
const amendRef = ref('')
```

ใน `submit()` หลังสำเร็จ (เฉพาะกรณี `!already`) ตั้งค่า:

```js
      lastSubmit.value = {
        qid: q.id, qhash: q.qhash || null, verdict: v,
        reason: reason.value, ref: refText.value,
        questionText: (q.question || '').slice(0, 60),
      }
```

- [ ] **Step 2: เทมเพลตแถบแก้ผลตรวจ**

วางไว้ใต้การ์ดข้อปัจจุบัน (นอก `<section class="rv-card">` แต่ยังอยู่ใน `<template v-else>` ของ gate) — **ไม่ใช่ overlay จึงไม่ต้อง Teleport**:

```html
      <div v-if="lastSubmit" class="rv-last">
        <div class="rv-last-top">
          <span>เพิ่งส่ง: <b>{{ VERDICT_LABEL[lastSubmit.verdict] }}</b> — {{ lastSubmit.questionText }}…</span>
          <button v-if="!amending" class="rv-mini" @click="openAmend">แก้ผลตรวจ</button>
        </div>
        <div v-if="amending" class="rv-last-form">
          <div class="rv-verdicts">
            <button
              v-for="vv in VERDICTS" :key="vv.key"
              type="button" class="rv-vbtn" :class="[vv.key, { on: amendVerdict === vv.key }]"
              @click="amendVerdict = vv.key"
            >{{ vv.label }}</button>
          </div>
          <textarea v-model="amendReason" :maxlength="LIMITS.reviewReason" class="rv-input" rows="2" placeholder="เหตุผล (บังคับเมื่อไม่ผ่าน)"></textarea>
          <input v-model="amendRef" :maxlength="LIMITS.reviewRef" class="rv-input" placeholder="เรฟอ้างอิง (ไม่บังคับ)" />
          <div class="rv-actions">
            <button class="rv-btn rv-gray" :disabled="submitting" @click="amending = false">ยกเลิก</button>
            <button class="rv-btn rv-primary" :disabled="!canAmend || submitting" @click="submitAmend">บันทึกการแก้</button>
          </div>
        </div>
      </div>
```

เพิ่ม style:

```css
.rv-last { background: #fffdf7; border: 2px dashed rgba(0,0,0,.18); border-radius: 14px; padding: 11px 13px; margin-bottom: 16px; }
.rv-last-top { display: flex; align-items: center; gap: 10px; justify-content: space-between; font-size: .76rem; color: rgba(0,0,0,.65); line-height: 1.4; }
.rv-mini { flex-shrink: 0; border: 2px solid var(--ink); border-radius: 9px; padding: 5px 11px; font-family: inherit; font-size: .72rem; font-weight: 800; background: #fff; color: var(--ink); cursor: pointer; }
.rv-last-form { margin-top: 10px; }
.rv-last-form .rv-input { margin-bottom: 6px; }
```

- [ ] **Step 3: ตรรกะเปิดฟอร์ม + เงื่อนไขปุ่ม**

```js
function openAmend() {
  amendVerdict.value = lastSubmit.value?.verdict || null
  amendReason.value = lastSubmit.value?.reason || ''
  amendRef.value = lastSubmit.value?.ref || ''
  amending.value = true
}
// เหตุผลบังคับเฉพาะผลที่ไม่ผ่าน (เหมือนฟอร์มหลัก)
const canAmend = computed(() =>
  !!amendVerdict.value && (amendVerdict.value === 'correct' || !!amendReason.value.trim()))
```

- [ ] **Step 4: ทรานแซกชันแก้ผลตรวจ**

```js
// แก้ผลตรวจของตัวเอง — ย้ายเสียงข้ามฝั่ง เสียงรวมเท่าเดิม (rules: isReviewAmend)
async function submitAmend() {
  const ls = lastSubmit.value
  if (!canAmend.value || submitting.value || !ls || !myUid.value) return
  if (!(await confirm(`แก้ผลตรวจเป็น "${VERDICT_LABEL[amendVerdict.value]}"?`))) return
  submitting.value = true
  const uid = myUid.value
  const v = amendVerdict.value
  const isPass = v === 'correct'
  try {
    await runTransaction(db, async (tx) => {
      const qRef = doc(db, 'questions', ls.qid)
      const snap = await tx.get(qRef)
      if (!snap.exists()) throw new Error('__gone')
      const cur = snap.data()
      if ((cur.qhash || null) !== (ls.qhash || null)) throw new Error('__stale')
      if (!(cur.reviewedBy || []).includes(uid)) throw new Error('__gone')
      const revRef = doc(db, 'questions', ls.qid, 'reviews', uid)
      const revSnap = await tx.get(revRef)
      const oldVerdict = revSnap.exists() ? revSnap.data().verdict : ls.verdict
      const oldIsPass = oldVerdict === 'correct'
      const oldStatus = computeStatus(cur)
      const newPass = (cur.reviewPass || 0) - (oldIsPass ? 1 : 0) + (isPass ? 1 : 0)
      const newFail = (cur.reviewFail || 0) - (oldIsPass ? 0 : 1) + (isPass ? 0 : 1)
      const newStatus = computeStatus({ reviewPass: newPass, reviewFail: newFail })
      tx.set(revRef, {
        reviewerUid: uid,
        reviewerName: revSnap.exists() ? revSnap.data().reviewerName : null,
        verdict: v,
        reason: cleanText(amendReason.value, LIMITS.reviewReason),
        ref: cleanText(amendRef.value, LIMITS.reviewRef),
        ts: serverTimestamp(),
      })
      tx.update(qRef, { reviewPass: newPass, reviewFail: newFail, reviewStatus: newStatus })
      // counts ไม่แตะ — ไม่ใช่การตรวจข้อใหม่ · progress ขยับเฉพาะเมื่อสถานะเปลี่ยนจริง
      if (oldStatus !== newStatus) {
        tx.set(doc(db, 'reviewMeta', 'main'),
          { progress: { [oldStatus]: increment(-1), [newStatus]: increment(1) } }, { merge: true })
      }
    })
    usage.track(2, 3)
    toast('แก้ผลตรวจแล้ว', 'success')
    lastSubmit.value = { ...ls, verdict: v, reason: amendReason.value, ref: amendRef.value }
    amending.value = false
  } catch (e) {
    if (e.message === '__stale') toast('ข้อนี้เพิ่งถูกแก้เนื้อหา — แก้ผลตรวจไม่ได้แล้ว', 'error')
    else if (e.message === '__gone') toast('ผลตรวจนี้ถูกล้างไปแล้ว', 'error')
    else { console.error('[review amend]', e); toast('แก้ไม่สำเร็จ', 'error') }
    lastSubmit.value = null
  } finally { submitting.value = false }
}
```

> `reviewerName: null` เกิดได้เฉพาะกรณี subdoc หาย (ผิดปกติ) — rules ไม่บังคับ field นี้ และ UI มี fallback `'ไม่ระบุ'` อยู่แล้ว

- [ ] **Step 5: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → `/review`:
- ส่งผลตรวจ "ถูกต้อง" → แถบ "เพิ่งส่ง" โผล่ → กด "แก้ผลตรวจ" → เลือก "ผิด" + ใส่เหตุผล → บันทึก
- เปิดคลังข้อสอบดูข้อนั้น: สถานะตรวจต้องเปลี่ยนตาม และ **จำนวนผลตรวจต้องเท่าเดิม** (ไม่กลายเป็น 2 เสียงจากคนเดียว)
- ดู `reviewMeta/main`: `counts` ของเราต้อง **ไม่เพิ่ม** จากการแก้
- รีโหลดหน้า → แถบหายไป (ตั้งใจ)

- [ ] **Step 6: Commit**

```bash
git add src/views/ReviewView.vue
git commit -m "Review: แก้ผลตรวจที่เพิ่งส่งได้เอง (กดพลาดแล้วไม่ต้องรบกวนแอดมิน)"
```

---

## Task 13: หน้าตรวจ — แถบความคืบหน้ารวม

**Files:**
- Modify: `src/views/ReviewView.vue`

**Interfaces:**
- Consumes: `reviewMeta/main.progress` (Task 11 เขียน, Task 14 ซ่อม)
- Produces: —

- [ ] **Step 1: computed สรุป**

แทนที่ `summary` เดิม:

```js
// ความคืบหน้าทั้งคลัง — มาจากตัวนับใน reviewMeta (ไม่เปลือง read)
// half/conflict เป็นเลขสดจากคิวที่โหลดมาจริงได้ก็จริง แต่ใช้ค่าจาก meta ให้เป็นชุดเดียวกันทั้งแถบ
const progress = computed(() => {
  const p = meta.value.progress || {}
  const num = k => Math.max(0, p[k] || 0)
  const passed = num('passed'), failed = num('failed')
  const half = num('half'), conflict = num('conflict'), pending = num('pending')
  const total = passed + failed + half + conflict + pending
  return { passed, failed, half, conflict, pending, total, pct: total ? Math.round((passed / total) * 100) : 0 }
})
// จำนวนข้อที่ต้องให้ฉันตรวจ "ในคิวรอบนี้" (เท่าที่โหลดมา ไม่ใช่ทั้งคลัง)
const myQueueCount = computed(() => nextReviewQueue(list.value, myUid.value).length)
```

- [ ] **Step 2: เทมเพลตแถบสรุป**

แทนที่ `<div class="rv-summary">…</div>` เดิม:

```html
      <div class="rv-summary">
        <div class="rv-sum-line">
          <Emoji char="📋" /> ผ่านแล้ว <b>{{ progress.passed }}</b> · ค้าง 1 เสียง <b>{{ progress.half }}</b> ·
          รอตรวจ <b>{{ progress.pending }}</b><span v-if="progress.conflict"> · ขัดแย้ง <b>{{ progress.conflict }}</b></span>
        </div>
        <div v-if="progress.total" class="rv-bar"><div class="rv-bar-fill" :style="{ width: progress.pct + '%' }"></div></div>
        <div class="rv-sum-mine">คิวรอบนี้ของคุณ: <b>{{ myQueueCount }}</b> ข้อ</div>
      </div>
```

เพิ่ม style:

```css
.rv-sum-line { line-height: 1.5; }
.rv-bar { height: 7px; border-radius: 999px; background: rgba(0,0,0,.09); overflow: hidden; margin: 8px 0 6px; }
.rv-bar-fill { height: 100%; background: #22c55e; border-radius: 999px; transition: width .3s; }
.rv-sum-mine { font-size: .7rem; color: rgba(0,0,0,.5); }
```

- [ ] **Step 3: แทนที่ที่อื่นที่ยังอ้าง `summary`**

`summary` ถูกลบไปแล้วใน Step 1 — เทมเพลตยังมีอีกจุดที่อ้างถึงมัน (สถานะ "ข้ามไว้ N ข้อ") ต้องแก้ด้วย ไม่งั้นหน้าพัง:

```html
      <div v-else-if="myQueueCount" class="rv-empty">
        <Emoji char="⏭️" /> ข้ามไว้ {{ myQueueCount }} ข้อ — ยังไม่ได้ตรวจ
        <button class="rv-btn rv-gray rv-unskip" @click="unskipAll">ดูข้อที่ข้ามอีกรอบ</button>
      </div>
```

ค้นทั้งไฟล์ด้วยคำว่า `summary` ให้แน่ใจว่าไม่เหลือที่อ้างถึงอีก

- [ ] **Step 4: อัปเดต local หลังส่งผลตรวจ**

ในบล็อกที่อัปเดต `meta.value` หลัง submit สำเร็จ (Task 11) ให้ขยับ `progress` ในเครื่องด้วย เพื่อให้แถบขยับทันทีไม่ต้องรีโหลด:

```js
    if (!already) {
      const p = { ...(meta.value.progress || {}) }
      if (oldStatusLocal !== newStatus) {
        p[oldStatusLocal] = Math.max(0, (p[oldStatusLocal] || 0) - 1)
        p[newStatus] = (p[newStatus] || 0) + 1
      }
      meta.value = {
        counts: { ...(meta.value.counts || {}), [uid]: ((meta.value.counts || {})[uid] || 0) + 1 },
        names: { ...(meta.value.names || {}), [uid]: reviewerName },
        progress: p,
      }
    }
```

(`oldStatusLocal` ถูกประกาศและเซ็ตไว้แล้วใน Task 11 Step 4)

- [ ] **Step 5: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → `/review`:
- แถบบนสุดแสดงตัวเลข 4 ก้อน + แถบเขียว
- ส่งผลตรวจ 1 ข้อ → ตัวเลขขยับทันทีโดยไม่ต้องรีโหลด
- ถ้ายังไม่เคยกดซิงก์ ตัวเลขจะเป็น 0 ทั้งแถว — ปกติ (Task 14 แก้ให้)
- กดข้ามข้อจนหมดคิว → ต้องเห็นข้อความ "ข้ามไว้ N ข้อ" และปุ่มดูอีกรอบทำงานได้ (ไม่ใช่หน้าขาว/error)

- [ ] **Step 6: Commit**

```bash
git add src/views/ReviewView.vue
git commit -m "Review: แถบความคืบหน้าตรวจทั้งคลัง (ทีมเห็นว่างานเดินถึงไหน)"
```

---

## Task 14: Admin — ขยายปุ่มซิงก์ระบบตรวจ

**Files:**
- Modify: `src/views/AdminView.vue` (ฟังก์ชัน `syncReviewSystem`)

**Interfaces:**
- Consumes: `computeStatus`, `reviewStatusKey` (Task 1) · `getCategories` (Task 2)
- Produces: `reviewMeta/main.progress` ที่ตรงกับคลังจริง · `categories` ของข้อเก่า · `reviewStatus: 'half'` ของข้อค้าง 1 เสียง

- [ ] **Step 1: import เพิ่ม**

```js
import { getCategories } from '../utils/questionCategories.js'
```
และเพิ่ม `reviewStatusKey` เข้าไปในบรรทัด import จาก `questionReview.js` (ถ้ายังไม่มี)

- [ ] **Step 2: ขยายเงื่อนไข stale + patch**

แทนบล็อกคำนวณ `stale` และลูป batch:

```js
    // ข้อที่ต้องแก้: สถานะไม่ตรงกับที่คำนวณได้ (รวมข้อค้าง 1 เสียงที่ยังเป็น pending → half)
    // หรือยังมี map โครงเก่า หรือยังไม่มี categories ทั้งที่มี category เดี่ยว
    const stale = all.filter(q =>
      (q.reviewStatus || null) !== computeStatus(q)
      || q.reviewVerdicts !== undefined
      || (!Array.isArray(q.categories) && !!q.category))
    for (let i = 0; i < stale.length; i += 500) {
      const batch = writeBatch(db)
      for (const q of stale.slice(i, i + 500)) {
        const patch = {
          reviewStatus: computeStatus(q),
          reviewPass: q.reviewPass || 0,
          reviewFail: q.reviewFail || 0,
          reviewVerdicts: deleteField(),
        }
        if (!Array.isArray(q.categories) && q.category) patch.categories = getCategories(q)
        batch.update(doc(db, 'questions', q.id), patch)
      }
      await batch.commit()
    }
```

> การเขียนนี้ทำโดยแอดมิน ซึ่ง rules ปล่อยผ่านด้วย `isAdmin()` — ไม่ติดข้อจำกัด `hasOnly(reviewSubmitKeys())`

- [ ] **Step 3: คำนวณ `progress` ใหม่ทั้งก้อน**

แทนบล็อกที่เขียน `reviewMeta`:

```js
    // ตัวนับใหม่จากคลังจริง — ชื่อคงของเดิมไว้ (ชื่อมาจาก snapshot ตอน submit)
    // progress คำนวณใหม่ทั้งก้อน = ซ่อม drift จากการสร้างข้อใหม่/import/ล้างผลตรวจ/นำออก
    const progress = { pending: 0, half: 0, passed: 0, failed: 0, conflict: 0, retired: 0 }
    for (const q of all) {
      const key = reviewStatusKey(q)
      if (key in progress) progress[key]++
    }
    const metaRef = doc(db, 'reviewMeta', 'main')
    const cur = await getDoc(metaRef)
    await setDoc(metaRef, {
      counts: tallyReviewCounts(all),
      names: cur.exists() ? (cur.data().names || {}) : {},
      progress,
    })
```

- [ ] **Step 4: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `npm run dev` → เข้า Admin ด้วยบัญชีแอดมิน กด "🔄 ซิงก์ระบบตรวจ":
- toast บอกจำนวนข้อที่อัปเดต
- เปิด Firestore Console › `reviewMeta/main` → มี `progress` ครบ 6 key และผลรวมเท่าจำนวนข้อในคลัง
- ข้อที่มี 1 เสียงต้องมี `reviewStatus: 'half'` แล้ว
- ข้อเก่าที่มี `category` ต้องมี `categories` เพิ่มมา (ค่า `category` เดิมยังอยู่ ไม่ลบ — ตั้งใจ)
- **กดปุ่มซ้ำอีกครั้ง** → ต้องบอกว่าอัปเดต 0 ข้อ (idempotent)
- กลับไป `/review` → แถบความคืบหน้ามีตัวเลขจริง และข้อค้าง 1 เสียงถูกหยิบมาบ่อยขึ้นชัดเจน

- [ ] **Step 5: Commit**

```bash
git add src/views/AdminView.vue
git commit -m "Admin: ซิงก์ระบบตรวจเติม categories + คำนวณ progress ใหม่ (backfill สถานะ half ให้เอง)"
```

---

## หลังทำครบทุก Task

- [ ] **รันเทส pure util ทั้งหมด**

Run: `node --test src/utils/questionReview.test.js src/utils/questionCategories.test.js src/utils/questionsFilter.test.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js`
Expected: PASS ทุกไฟล์

- [ ] **Build**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

- [ ] **Deploy**

```bash
git push origin master                                      # GitHub Pages (host หลัก)
firebase deploy --only firestore:rules,firestore:indexes     # ถ้ายังไม่ได้ deploy ตอน Task 5
```

- [ ] **หลัง deploy — งานที่ user ต้องทำเอง 1 ครั้ง**

เข้า Admin › กด **"🔄 ซิงก์ระบบตรวจ"** หนึ่งครั้ง (ประทับสถานะ `half` + เติม `categories` ให้ข้อเก่า + ตั้งต้นตัวนับความคืบหน้า) — ไม่กดแล้วคิวจะไม่เร่งข้อค้าง และแถบความคืบหน้าจะเป็น 0

---

## Self-Review (ผู้เขียนแผนตรวจเองแล้ว)

**ความครอบคลุมเทียบสเปก:** §3.1 ฟิลด์ใหม่ → Task 4/7/11 · §3.2 progress → Task 11/13/14 · §3.3 LIMITS → Task 4 · §3.4 rules → Task 5 · §3.5 index → Task 5 · §4.1 half → Task 1 · §4.2 น้ำหนัก → Task 1 · §4.3 หมวด → Task 2 · §4.4 ไม่แตะ `reviewContentChanged` → ระบุห้ามไว้ใน Task 1 และ Task 7 · §5.1 โหลดคิว → Task 10 · §5.2 สุ่ม → Task 10 · §5.3 ฟอร์ม → Task 11 · §5.4 ทรานแซกชัน → Task 11 · §5.5 amend → Task 12 · §5.6 แถบสรุป → Task 13 · §6.1 ใครตรวจ → Task 8 · §6.2 หมวด+หมายเหตุ → Task 7 · §6.3 utils → Task 3/4 · §7 TopicSelect → Task 6 · §8 นักศึกษา → Task 9 · §9 Admin → Task 14 · §10 concurrency → Task 11 (toast + เสียงที่ 3) + Task 10 (ลดการชน)

**หมายเหตุที่พบระหว่างเขียนแผน:** §6.1 ของสเปกทำไว้แล้วบางส่วนในโค้ดปัจจุบัน (`detailReviews` โหลด subcollection ตอนกางข้อ แสดงชื่อ+ผลตัดสิน+เหตุผลอยู่แล้ว) Task 8 จึงเหลือแค่บรรทัดสรุป "ตรวจโดย" + เรฟ/เวลา — เล็กกว่าที่สเปกประเมินไว้
