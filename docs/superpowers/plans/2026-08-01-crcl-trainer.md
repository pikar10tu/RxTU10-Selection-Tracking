# ตัวฝึกคำนวณ CrCl — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าฝึกคำนวณ CrCl (Cockcroft-Gault) ในโหมด Study ทำต่อเนื่องได้ไม่จำกัด เปิด/ปิดสูตรได้ และเก็บจำนวนข้อที่ทำสะสมไว้เงียบๆ สำหรับกระดานอันดับในอนาคต

**Architecture:** สูตร/สุ่มโจทย์/เกณฑ์ยอมรับอยู่ใน `src/utils/crcl.js` (pure, เทส `node --test`) · view เป็นชั้นแสดงผล + เขียนสถิติแบบ batch · เก็บยอดใต้ `users/{uid}.minigames.crcl` เพื่อให้ `buildMinigameBoard(…, 'crcl')` ใช้ได้ทันทีวันหลังโดยไม่ต้องแตะแคชสมาชิก และ **ไม่ใส่ entry ใน `MINIGAMES` registry** เพื่อไม่ให้การ์ดโผล่บนหน้า Play

**Tech Stack:** Vue 3 (script setup) + Pinia + Firebase Firestore

**Spec:** `docs/superpowers/specs/2026-08-01-crcl-trainer-design.md`

## Global Constraints

- คอมเมนต์ในโค้ด/commit เป็นไทยปนอังกฤษ · commit `Area: อะไร (ทำไม)`
- โทนข้อความยึด `docs/voice-guide.md` · single-file component + `<style scoped>`
- **ใช้ token ธีม (`var(--primary)` / `var(--ink)` / `var(--pop)`) — ห้าม hardcode `#4f46e5`** (สีธีมเก่า)
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น
- ตรรกะใน `crcl.js` ห้ามอ้าง DOM/`window`/`Date.now()` — `rng` ฉีดเข้ามา
- **ห้ามเพิ่ม entry ใน `src/data/minigames.js`** — ตัวเลขนี้ต้องไม่โผล่บนหน้า Play
- **ห้ามแสดงยอดสะสมที่ไหนเลย** — บนจอโชว์ได้แค่ตัวนับของเซสชันปัจจุบัน
- ห้ามแตะ `minigameCore.js` · `MinigameShell.vue` · `firestore.rules` · ระบบแฟลชการ์ด/ควิซเดิม

---

## Task 1: ตรรกะ CrCl (TDD)

**Files:**
- Create: `src/utils/crcl.js`, `src/utils/crcl.test.js`

**Interfaces:**
- Produces: `TOLERANCE_PCT = 0.02` · `TOLERANCE_MIN = 1` · `cockcroftGault({ age, weightKg, scr, female }) → number` · `makeProblem(rng?) → { age, weightKg, scr, female }` · `isClose(answer, expected) → boolean`

- [ ] **Step 1: เขียนเทสก่อน**

สร้าง `src/utils/crcl.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { cockcroftGault, makeProblem, isClose, TOLERANCE_MIN } from './crcl.js'

test('Cockcroft-Gault ผู้ชาย: (140-40)×70 / (72×1.0) = 97.22', () => {
  const v = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  assert.ok(Math.abs(v - 97.222) < 0.01, `ได้ ${v}`)
})

test('ผู้หญิงคูณ 0.85', () => {
  const m = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  const f = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: true })
  assert.ok(Math.abs(f - m * 0.85) < 1e-9)
})

test('Scr สูงขึ้น → CrCl ต่ำลง · อายุมากขึ้น → CrCl ต่ำลง', () => {
  const base = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  assert.ok(cockcroftGault({ age: 40, weightKg: 70, scr: 2.0, female: false }) < base)
  assert.ok(cockcroftGault({ age: 80, weightKg: 70, scr: 1.0, female: false }) < base)
})

test('isClose: ตอบตรงเป๊ะ = ถูก', () => {
  assert.equal(isClose(97.2, 97.222), true)
})

test('isClose: ในช่วง 2% = ถูก · นอกช่วง = ผิด', () => {
  assert.equal(isClose(100, 100), true)
  assert.equal(isClose(101.9, 100), true)    // +1.9% → ยอมรับ
  assert.equal(isClose(98.1, 100), true)     // −1.9% → ยอมรับ
  assert.equal(isClose(103, 100), false)     // +3% → ไม่ยอมรับ
  assert.equal(isClose(96, 100), false)
})

test(`isClose: CrCl ต่ำมากใช้ floor ${TOLERANCE_MIN} mL/min แทน 2%`, () => {
  // เฉลย 10 → 2% = 0.2 ซึ่งแคบเกินไป · floor 1 ต้องยอมรับ ±1
  assert.equal(isClose(10.9, 10), true)
  assert.equal(isClose(9.1, 10), true)
  assert.equal(isClose(11.5, 10), false)
})

test('isClose: คำตอบที่ไม่ใช่ตัวเลข = ผิด (ไม่ throw)', () => {
  assert.equal(isClose(NaN, 100), false)
  assert.equal(isClose(undefined, 100), false)
  assert.equal(isClose(Infinity, 100), false)
})

test('makeProblem: rng ต่ำสุด → ขอบล่างของทุกค่า', () => {
  const p = makeProblem(() => 0)
  assert.deepEqual(p, { age: 18, weightKg: 40, scr: 0.5, female: true })
})

test('makeProblem: rng สูงสุด → ขอบบนของทุกค่า', () => {
  const p = makeProblem(() => 0.999)
  assert.equal(p.age, 90)
  assert.equal(p.weightKg, 110)
  assert.equal(p.scr, 4)
  assert.equal(p.female, false)
})

test('makeProblem: Scr มีทศนิยมไม่เกิน 1 ตำแหน่งเสมอ', () => {
  for (let i = 0; i < 50; i++) {
    const { scr } = makeProblem()
    assert.equal(Math.round(scr * 10) / 10, scr, `scr ${scr} มีทศนิยมเกิน 1 ตำแหน่ง`)
  }
})
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `node --test src/utils/crcl.test.js`
Expected: FAIL — `Cannot find module './crcl.js'`

- [ ] **Step 3: เขียนโมดูล**

สร้าง `src/utils/crcl.js`:

```js
// ════════════════════════════════════════════════════════════
//  CrCl (Cockcroft-Gault) — สูตร/สุ่มโจทย์/เกณฑ์ยอมรับ · pure ล้วน เทส node --test ได้
//  rng ฉีดเข้ามาเพื่อให้เทสคุมผลสุ่มได้ · ห้ามอ้าง DOM/Date.now() ในไฟล์นี้
// ════════════════════════════════════════════════════════════

// เกณฑ์ยอมรับ: นักศึกษาปัดเลขระหว่างทางต่างกันได้ จึงรับ ±2%
//  แต่ต้องมีพื้น 1 mL/min ด้วย ไม่งั้นเคส CrCl ต่ำมาก (เช่น 10) จะเหลือ ±0.2 ซึ่งแคบเกินจริง
export const TOLERANCE_PCT = 0.02
export const TOLERANCE_MIN = 1

// CrCl = [(140 − อายุ) × น้ำหนัก(kg)] / (72 × Scr(mg/dL)) · ผู้หญิงคูณ 0.85
export function cockcroftGault({ age, weightKg, scr, female }) {
  const base = ((140 - age) * weightKg) / (72 * scr)
  return female ? base * 0.85 : base
}

// สุ่มโจทย์ในพิสัยที่เจอจริงในคลินิก · อายุ 18–90 · น้ำหนัก 40–110 kg · Scr 0.5–4.0 (ทศนิยม 1 ตำแหน่ง)
export function makeProblem(rng = Math.random) {
  const age = 18 + Math.floor(rng() * 73)
  const weightKg = 40 + Math.floor(rng() * 71)
  const scr = Math.round((0.5 + rng() * 3.5) * 10) / 10
  const female = rng() < 0.5
  return { age, weightKg, scr, female }
}

// ตอบถูกเมื่อห่างจากเฉลยไม่เกิน max(1 mL/min, 2%)
export function isClose(answer, expected) {
  if (!Number.isFinite(answer)) return false
  const tol = Math.max(TOLERANCE_MIN, Math.abs(expected) * TOLERANCE_PCT)
  return Math.abs(answer - expected) <= tol
}
```

> `makeProblem` เรียก `rng()` 4 ครั้งตามลำดับ อายุ → น้ำหนัก → Scr → เพศ · เทสพึ่งลำดับนี้ อย่าสลับ

- [ ] **Step 4: รันให้เขียว**

Run: `node --test src/utils/crcl.test.js`
Expected: PASS ทุกเทส output สะอาด

- [ ] **Step 5: Commit**

```bash
git add src/utils/crcl.js src/utils/crcl.test.js
git commit -m "Study: ตรรกะ CrCl Cockcroft-Gault เป็น pure function (สูตร/สุ่มโจทย์/ช่วงยอมรับ)"
```

---

## Task 2: หน้าฝึก CrCl + ทางเข้าใน Study

**Files:**
- Create: `src/views/CrClTrainerView.vue`
- Modify: `src/router/index.js`, `src/views/StudyView.vue`

**Interfaces:**
- Consumes: `cockcroftGault` / `makeProblem` / `isClose` (Task 1) · `auth.patchUser` · `increment` จาก `firebase/firestore`
- Produces: route `/study/crcl` · ฟิลด์ `users/{uid}.minigames.crcl.{best,correct}`

- [ ] **Step 1: route**

ใน `src/router/index.js` เพิ่มถัดจาก route ของ `/study`:

```js
    { path: '/study/crcl', name: 'crcl', component: () => import('../views/CrClTrainerView.vue') },
```

- [ ] **Step 2: การ์ดทางเข้าในหน้า Study**

ใน `src/views/StudyView.vue` เพิ่มการ์ดต่อท้ายกลุ่ม `QuizModeCard` (กลุ่มเดียวกับ ทั่วไป/Zen):

```html
        <QuizModeCard emoji="🧮" title="ฝึกคำนวณ CrCl" subtitle="Cockcroft-Gault ทำต่อเนื่องได้ไม่จำกัด" to="/study/crcl" />
```

- [ ] **Step 3: หน้าฝึก**

สร้าง `src/views/CrClTrainerView.vue`:

```vue
<!-- src/views/CrClTrainerView.vue — ฝึกคำนวณ CrCl (Cockcroft-Gault) ทำต่อเนื่อง
     ตรรกะทั้งหมดอยู่ใน utils/crcl.js · หน้านี้เก็บยอดสะสมเงียบๆ ไม่แสดงบนจอ -->
<template>
  <div class="tab-content cr-wrap">
    <div class="page-title cr-head">
      <button class="cr-back" @click="$router.push('/study')">‹ กลับ</button>
      <span><Emoji char="🧮" /> ฝึกคำนวณ CrCl</span>
    </div>

    <button class="cr-formula-btn" @click="toggleFormula">
      {{ showFormula ? 'ซ่อนสูตร' : 'ดูสูตร' }}
    </button>
    <div v-if="showFormula" class="cr-formula">
      <div class="cr-formula-main">CrCl = (140 − อายุ) × น้ำหนัก(kg) ÷ (72 × Scr)</div>
      <div class="cr-formula-note">ถ้าเป็นผู้หญิง คูณ 0.85 · ผลลัพธ์หน่วย mL/min</div>
    </div>

    <div class="cr-card">
      <div class="cr-row"><span>เพศ</span><b>{{ p.female ? 'หญิง' : 'ชาย' }}</b></div>
      <div class="cr-row"><span>อายุ</span><b>{{ p.age }} ปี</b></div>
      <div class="cr-row"><span>น้ำหนัก</span><b>{{ p.weightKg }} kg</b></div>
      <div class="cr-row"><span>Scr</span><b>{{ p.scr.toFixed(1) }} mg/dL</b></div>
    </div>

    <div class="cr-answer">
      <input
        ref="inputEl" v-model="input" class="cr-input" inputmode="decimal"
        placeholder="CrCl (mL/min)" :readonly="checked" @keyup.enter="onEnter"
      />
      <button v-if="!checked" class="cr-btn" :disabled="!input.trim()" @click="check">ตรวจคำตอบ</button>
      <button v-else class="cr-btn" @click="next">ข้อถัดไป →</button>
    </div>

    <div v-if="checked" class="cr-result" :class="{ ok: lastOk }">
      <div class="cr-result-head">{{ lastOk ? '✅ ถูกต้อง' : '❌ ยังไม่ถูก' }}</div>
      <div class="cr-result-ans">เฉลย <b>{{ expected.toFixed(1) }}</b> mL/min</div>
      <div class="cr-result-work">
        ({{ 140 - p.age }} × {{ p.weightKg }}) ÷ (72 × {{ p.scr.toFixed(1) }}){{ p.female ? ' × 0.85' : '' }}
      </div>
    </div>

    <div class="cr-session">รอบนี้ทำไปแล้ว <b>{{ sDone }}</b> ข้อ · ถูก <b>{{ sCorrect }}</b></div>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { cockcroftGault, makeProblem, isClose } from '../utils/crcl.js'

const LS_KEY = 'rxtu10:crcl:showFormula'
const FLUSH_EVERY = 10        // เขียน Firestore ทุกกี่ข้อ (โหมดต่อเนื่อง เขียนทุกข้อแพงเกินจำเป็น)

const auth = useAuthStore()
const inputEl = ref(null)

const p = ref(makeProblem())
const input = ref('')
const checked = ref(false)
const lastOk = ref(false)
const showFormula = ref(localStorage.getItem(LS_KEY) === '1')

// ตัวนับ "เฉพาะรอบนี้" — ยอดสะสมไม่แสดงบนจอเด็ดขาด (ตามที่สั่ง)
const sDone = ref(0)
const sCorrect = ref(0)

const expected = computed(() => cockcroftGault(p.value))

// ยอดที่ยังไม่ได้เขียนลงฐาน — flush ทุก FLUSH_EVERY ข้อ และตอนออกจากหน้า
let pendingDone = 0
let pendingCorrect = 0

function toggleFormula() {
  showFormula.value = !showFormula.value
  localStorage.setItem(LS_KEY, showFormula.value ? '1' : '0')
}

function check() {
  if (checked.value) return
  const ans = parseFloat(input.value.replace(',', '.'))
  lastOk.value = isClose(ans, expected.value)
  checked.value = true
  sDone.value += 1
  pendingDone += 1
  if (lastOk.value) { sCorrect.value += 1; pendingCorrect += 1 }
  if (pendingDone >= FLUSH_EVERY) flush()
}

function next() {
  p.value = makeProblem()
  input.value = ''
  checked.value = false
  nextTick(() => inputEl.value?.focus())
}

function onEnter() { checked.value ? next() : (input.value.trim() && check()) }

// เขียนยอดสะสมแบบ batch · รีเซ็ต pending ก่อน await กันนับซ้ำถ้าถูกเรียกซ้อน
async function flush() {
  const d = pendingDone
  const c = pendingCorrect
  if (!d) return
  pendingDone = 0
  pendingCorrect = 0
  const cur = auth.userData?.minigames?.crcl || { best: 0, correct: 0 }
  await auth.patchUser(
    {
      minigames: {
        ...auth.userData?.minigames,
        // best = "จำนวนข้อที่ทำสะสม" (ไม่ใช่คะแนนสูงสุด) — ใช้ชื่อนี้เพื่อให้ buildMinigameBoard
        // เปิดกระดานได้ทันทีวันหลังโดยไม่ต้องแตะแคชสมาชิก · ยอดนี้ไม่แสดงบนจอที่ไหนเลย
        crcl: { best: (cur.best || 0) + d, correct: (cur.correct || 0) + c },
      },
    },
    { 'minigames.crcl.best': increment(d), 'minigames.crcl.correct': increment(c) },
  )
}

onMounted(() => inputEl.value?.focus())
onBeforeUnmount(() => { flush() })   // fire-and-forget: ออกจากหน้าแล้วยอดที่ค้างต้องไม่หาย
</script>

<style scoped>
.cr-wrap { max-width: 480px; margin: 0 auto; }
.cr-head { display: flex; align-items: center; gap: 10px; }
.cr-back { all: unset; cursor: pointer; font-weight: 700; color: var(--primary); padding: 6px 4px; }
.cr-formula-btn { all: unset; cursor: pointer; display: block; margin: 0 auto 8px; font-size: .78rem;
  color: var(--primary); text-decoration: underline; padding: 6px; }
.cr-formula { background: var(--primary-light); border: 2px solid var(--ink); border-radius: 12px;
  padding: 12px; margin-bottom: 12px; text-align: center; }
.cr-formula-main { font-weight: 800; font-size: .84rem; color: var(--ink); line-height: 1.5; }
.cr-formula-note { font-size: .72rem; color: rgba(0,0,0,.55); margin-top: 5px; }
.cr-card { background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop);
  padding: 14px 16px; margin-bottom: 14px; }
.cr-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0;
  font-size: .86rem; color: rgba(0,0,0,.6); }
.cr-row b { font-size: 1rem; color: var(--ink); }
.cr-answer { display: flex; gap: 8px; }
.cr-input { flex: 1; min-width: 0; border: 2px solid var(--ink); border-radius: 12px; padding: 12px;
  font-family: inherit; font-size: 1rem; box-sizing: border-box; }
.cr-input[readonly] { background: #f1f5f9; }   /* readonly ไม่ใช่ disabled — disabled จะไม่ยิง keyup ทำให้ Enter ข้อถัดไปตาย */
.cr-btn { flex-shrink: 0; all: unset; cursor: pointer; background: var(--primary); color: #fff;
  font-weight: 800; padding: 12px 18px; border-radius: 12px; text-align: center; }
.cr-btn:disabled { background: #cbd5e1; cursor: default; }
.cr-result { margin-top: 14px; border: 2px dashed rgba(0,0,0,.2); border-radius: 12px; padding: 12px;
  background: #fef2f2; }
.cr-result.ok { background: #f0fdf4; }
.cr-result-head { font-weight: 800; font-size: .92rem; }
.cr-result-ans { font-size: .88rem; margin-top: 4px; }
.cr-result-work { font-size: .76rem; color: rgba(0,0,0,.55); margin-top: 4px; overflow-wrap: anywhere; }
.cr-session { text-align: center; font-size: .76rem; color: rgba(0,0,0,.45); margin-top: 16px; }
</style>
```

- [ ] **Step 4: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `node --test src/utils/crcl.test.js`
Expected: PASS

Run: `grep -n "crcl" src/data/minigames.js`
Expected: **ไม่มีผลลัพธ์** — ห้ามมี entry ใน registry (ไม่งั้นการ์ดจะโผล่บนหน้า Play)

Run: `grep -rn "4f46e5" src/views/CrClTrainerView.vue`
Expected: ไม่มีผลลัพธ์

- [ ] **Step 5: Commit**

```bash
git add src/views/CrClTrainerView.vue src/router/index.js src/views/StudyView.vue
git commit -m "Study: หน้าฝึกคำนวณ CrCl ทำต่อเนื่อง + เปิดปิดสูตร (เก็บยอดเงียบไว้ทำกระดานทีหลัง)"
```

---

## หลังทำครบทุก Task

- [ ] **รันเทสทั้งหมด**

Run: `node --test src/utils/crcl.test.js src/utils/game2048.test.js src/utils/stacker.test.js src/utils/nextAction.test.js src/utils/questionReview.test.js src/utils/questionCategories.test.js src/utils/questionsFilter.test.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js`
Expected: PASS ทั้งหมด

- [ ] **Build** — `npm run build` ต้องผ่าน

- [ ] **Deploy** — `git push origin master` (ไม่แก้ rules จึงไม่ต้อง `firebase deploy`)

- [ ] **สิ่งที่ user ต้องเทสบนจอจริง**

1. หน้า Study มีการ์ด "🧮 ฝึกคำนวณ CrCl" · กดแล้วเข้าหน้าฝึก
2. กด "ดูสูตร"/"ซ่อนสูตร" ได้ · ออกจากหน้าแล้วกลับเข้ามาใหม่ **ยังจำสถานะเดิม**
3. พิมพ์คำตอบถูก → ✅ · ผิด → ❌ พร้อมเฉลยและการแทนค่าในสูตร · Enter ใช้แทนปุ่มได้ทั้งสองจังหวะ
4. ทำต่อเนื่อง 10+ ข้อ แล้วเปิด Firestore ดู `users/{uid}.minigames.crcl.best` ว่าขยับ
5. **ยอดสะสมต้องไม่โผล่ที่ไหนเลย** — ไม่มีบนหน้าฝึก ไม่มีการ์ดบนหน้า Play ไม่มีในกระดานอันดับ
6. ทำ 3 ข้อแล้วออกจากหน้าทันที → ยอดต้องถูกบันทึก (flush ตอน unmount)

---

## Self-Review (ผู้เขียนแผนตรวจเองแล้ว)

**ครอบคลุมสเปก:** สูตร CG + สุ่มโจทย์ + ช่วงยอมรับ → Task 1 · โหมดต่อเนื่อง/เปิดปิดสูตร/ช่องพิมพ์ →
Task 2 Step 3 · เก็บยอดใต้ `minigames.crcl` แบบ batch → `flush()` · ไม่ใส่ registry entry → มี grep ตรวจ ·
ไม่แสดงยอดสะสม → หน้าจอมีแต่ตัวนับเซสชัน

**Placeholder scan:** ไม่มี TBD/TODO · ทุกขั้นมีโค้ดจริง

**ชื่อ/ชนิดสอดคล้อง:** `makeProblem` คืน `{ age, weightKg, scr, female }` ตรงกันทั้งเทส, `cockcroftGault`,
และเทมเพลต · `isClose(answer, expected)` ลำดับอาร์กิวเมนต์ตรงกันทุกที่ · `minigames.crcl.{best,correct}`
สะกดตรงกันระหว่าง optimistic object กับ dot-notation

**จุดที่จับได้ตอนตรวจเอง (1):** ร่างแรกใส่ `:disabled="checked"` บนช่องพิมพ์ — **input ที่ disabled ไม่ยิง
keyboard event** ⇒ `@keyup.enter` สาขา "ข้อถัดไป" จะตายสนิท · เปลี่ยนเป็น `:readonly` แล้ว (ยังโฟกัสได้ ยังยิง event)

**จุดที่จับได้ตอนตรวจเอง (2):** `flush()` ต้องรีเซ็ต `pendingDone/pendingCorrect` **ก่อน** `await` ไม่งั้นถ้า
flush ถูกเรียกซ้อน (ครบ 10 พอดีตอนกำลังออกจากหน้า) จะนับซ้ำ — เขียนกำกับไว้ในโค้ดแล้ว
