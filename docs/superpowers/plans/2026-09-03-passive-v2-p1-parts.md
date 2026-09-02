# พาสสีฟ v2 — P1: รื้อโครงเป็น `parts[]` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนโครงข้อมูลพาสสีฟจาก "`hook` 1 + `effect` 1 ต่อเพ็ท" เป็น `parts: [{hook, effect, value, step}]` เพื่อให้เพ็ทตัวเดียวมีหลายผลได้ — **โดยพฤติกรรมเกมต้องไม่เปลี่ยนแม้แต่นิดเดียว**

**Architecture:** ใส่ตัวช่วยอ่าน (`partsOf`/`partsAt`/`partAt`/`partWithEffect`) ที่ **รองรับรูปเก่าไปก่อน** → ย้ายผู้อ่านทุกรายมาใช้ตัวช่วย (ทีละไฟล์ เทสผ่านตลอดทาง) → แปลงข้อมูล 27 ตัว → ถอดสะพานรูปเก่าทิ้งพร้อมเทสกันย้อนกลับ · ลำดับนี้ทำให้ทุกงานย่อยจบแล้วเทสผ่านทันที ไม่มีช่วงที่ระบบพัง

**Tech Stack:** Vue 3 + Vite · ES modules ล้วน · เทสด้วย `node:test` (ไม่มี framework อื่น)

**สเปก:** `docs/superpowers/specs/2026-09-03-passive-v2-design.md` §3

## Global Constraints

- 🔒 **passive ห้ามเพิ่มจำนวน beat** — เพิ่มได้แค่ FX กับตัวเลข · `killChain` เป็นข้อยกเว้นเดียวและมีเพดาน
- 🔴 **ห้ามใช้ชื่อฟิลด์ `kind` ใน event** — ชนิดผลชื่อ `fxKind` เท่านั้น (`kind` เป็นของ `battleBeats` = เวลา · CLAUDE.md ข้อ 15)
- 📝 **ห้ามพิมพ์ตัวเลขลง `desc`/`short`** — ใส่ `{pct}` `{count}` … แล้วให้ `passiveText()` เติม
- ✅ **เทสทั้งรีโปต้องผ่านครบทุกงานย่อย** — ปัจจุบัน **976 ผ่าน**
  รัน: `node --test $(find src -name "*.test.js")`
- ✅ **`npm run build` ต้องผ่าน** ก่อน commit ทุกครั้ง
- 🚫 **P1 ห้ามเปลี่ยนพฤติกรรมเกม** — ห้ามแก้ค่าคาดหวังของเทสเดิม แก้ได้แค่บรรทัดที่อ้าง `p.hook`/`p.effect` ตรงๆ
- 📌 commit เป็นไทย รูปแบบ `Area: อะไร (ทำไม)`

## File Structure

| ไฟล์ | หน้าที่ | งานย่อยที่แตะ |
|---|---|---|
| `src/data/petPassives.js` | data + ตัวช่วยอ่านรูปข้อมูล (ไม่มีตรรกะไฟต์) | 1, 5, 6 |
| `src/data/petPassives.test.js` (สร้างใหม่) | เทสของตัวช่วยอ่าน + เทสกันย้อนรูปเก่า | 1, 6 |
| `src/utils/battlePassives.js` | ตรรกะไฟต์ทั้งหมด (pure) | 2 |
| `src/utils/battlePassives.test.js` | เทสตรรกะไฟต์ (มีอยู่แล้ว — เพิ่มเคสหลาย part) | 2 |
| `src/utils/battleBuffs.js` | แหล่งความจริงของ "ใครติดบัฟอะไร มาจากใคร" | 3 |
| `scripts/export-pet-data.mjs` · `scripts/build-pet-balance-page.mjs` · `scripts/passive-power-sim.mjs` | เครื่องมือวัด/ดัมป์ข้อมูล (dev only) | 4 |

**ไม่ต้องแตะ:** ไฟล์ `.vue` ทุกไฟล์ (ใช้แค่ `passiveText`/`name`/`icon` ไม่เคยอ่าน `effect`/`hook`) · `battleBeats.js` และ `battleBeatsLegacy.js` (อ่าน `e.effect` จาก **event** ไม่ใช่จาก data — event ยังมี `effect` ราย part เหมือนเดิม)

---

### Task 1: ตัวช่วยอ่าน `parts` (รองรับรูปเก่าไปก่อน)

**Files:**
- Modify: `src/data/petPassives.js` (เพิ่มตัวช่วยหลัง `passiveValueAt` ~บรรทัด 211)
- Test: `src/data/petPassives.test.js` (สร้างใหม่)

**Interfaces:**
- Consumes: `PASSIVE_MAX_LEVEL`, `PET_PASSIVES` (มีอยู่แล้ว)
- Produces:
  - `partsOf(p) -> Array<{hook, effect, value, step, tag?}>` — คืน `p.parts` ถ้ามี ไม่งั้นห่อรูปเก่าเป็น 1 part
  - `partsAt(p, hook) -> Array<part>` — ทุก part ที่ hook ตรง (ตามลำดับใน `parts`)
  - `partAt(p, hook) -> part|null` — part แรกที่ hook ตรง
  - `partWithEffect(p, effect) -> part|null`
  - `passiveValueAt(node, level)` — เดิมรับ passive · หลังงานนี้รับ **part หรือ passive** ก็ได้ (อ่าน `.value`/`.step` ของ node ที่ส่งมา)
  - `effectText(p, level, { onTarget, effect })` — เพิ่มออปชัน `effect` เลือกว่าจะเอาข้อความของ part ไหน

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/data/petPassives.test.js`:

```js
// เทสตัวช่วยอ่านรูปข้อมูลพาสสีฟ — pure · รัน: node --test src/data/petPassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PET_PASSIVES, partsOf, partsAt, partAt, partWithEffect,
  passiveValueAt, passiveText, effectText,
} from './petPassives.js'

test('partsOf: รูปใหม่คืน parts ตรงๆ', () => {
  const p = { parts: [{ hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1 } }] }
  assert.equal(partsOf(p).length, 1)
  assert.equal(partsOf(p)[0].effect, 'regenSelf')
})

test('partsOf: รูปเก่าถูกห่อเป็น 1 part ให้อัตโนมัติ (สะพานชั่วคราวของ P1)', () => {
  const old = { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }
  const parts = partsOf(old)
  assert.equal(parts.length, 1)
  assert.deepEqual(
    { hook: parts[0].hook, effect: parts[0].effect, value: parts[0].value, step: parts[0].step },
    { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } },
  )
})

test('partsOf: ไม่มีอะไรเลยคืนลิสต์ว่าง ไม่ throw', () => {
  assert.deepEqual(partsOf(null), [])
  assert.deepEqual(partsOf({}), [])
})

test('partsAt: คืนทุก part ที่ hook ตรง ตามลำดับที่เขียนไว้', () => {
  const p = { parts: [
    { hook: 'onRound', effect: 'regenSelf', value: { pct: 3 } },
    { hook: 'onRound', effect: 'stackAtk', value: { pct: 5, max: 4 } },
    { hook: 'onHit', effect: 'dodge', value: { pct: 9 } },
  ] }
  assert.deepEqual(partsAt(p, 'onRound').map(x => x.effect), ['regenSelf', 'stackAtk'])
  assert.deepEqual(partsAt(p, 'onHit').map(x => x.effect), ['dodge'])
  assert.deepEqual(partsAt(p, 'aura'), [])
})

test('partAt / partWithEffect', () => {
  const p = { parts: [
    { hook: 'onRound', effect: 'regenSelf', value: { pct: 3 } },
    { hook: 'onRound', effect: 'stackAtk', value: { pct: 5, max: 4 } },
  ] }
  assert.equal(partAt(p, 'onRound').effect, 'regenSelf')
  assert.equal(partAt(p, 'onKill'), null)
  assert.equal(partWithEffect(p, 'stackAtk').value.max, 4)
  assert.equal(partWithEffect(p, 'dodge'), null)
})

test('passiveValueAt: รับ part ตรงๆ ได้ และไต่ขั้นตาม step', () => {
  const part = { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }
  assert.equal(passiveValueAt(part, 1).pct, 12)
  assert.equal(passiveValueAt(part, 3).pct, 18)
})

test('passiveText: หลาย part ที่คีย์ไม่ชนกัน เติมได้ครบทุกช่อง', () => {
  const p = {
    parts: [
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1 } },
      { hook: 'onKill', effect: 'stackAtk', value: { max: 3 }, step: { max: 0 } },
    ],
    desc: 'ฟื้น {pct}% ทุกรอบ · สะสมได้ {max} ชั้น',
  }
  assert.equal(passiveText(p, 1), 'ฟื้น 4% ทุกรอบ · สะสมได้ 3 ชั้น')
  assert.equal(passiveText(p, 3), 'ฟื้น 6% ทุกรอบ · สะสมได้ 3 ชั้น')
})

test('passiveText: คีย์ชนกันแยกด้วย tag — {tag.key}', () => {
  const p = {
    parts: [
      { hook: 'onHit', effect: 'guardian', tag: 'guard', value: { pct: 50 }, step: { pct: 8 } },
      { hook: 'onRound', effect: 'regenSelf', tag: 'regen', value: { pct: 3 }, step: { pct: 1 } },
    ],
    desc: 'รับแทน {guard.pct}% · ฟื้นเอง {regen.pct}%/รอบ',
  }
  assert.equal(passiveText(p, 1), 'รับแทน 50% · ฟื้นเอง 3%/รอบ')
  assert.equal(passiveText(p, 2), 'รับแทน 58% · ฟื้นเอง 4%/รอบ')
})

test('effectText: รับออปชัน effect ได้โดยผลยังเหมือนเดิมในรอบนี้ (P3 ค่อยใช้จริง)', () => {
  const p = {
    parts: [
      { hook: 'onHit', effect: 'guardian', tag: 'guard', value: { pct: 50 } },
      { hook: 'onRound', effect: 'regenSelf', tag: 'regen', value: { pct: 3 } },
    ],
    short: 'รับแทน {guard.pct}%',
  }
  // วันนี้ทุกตัวมี short เดียว ⇒ ส่ง effect เข้าไปต้องไม่ทำให้ข้อความเปลี่ยน (กันพฤติกรรมเปลี่ยนใน P1)
  assert.equal(effectText(p, 1, { effect: 'regenSelf' }), 'รับแทน 50%')
  assert.equal(effectText(p, 1), 'รับแทน 50%')
})

test('เพ็ททุกตัวในทะเบียนมีอย่างน้อย 1 part และทุก part มี hook+effect', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    const parts = partsOf(p)
    assert.ok(parts.length >= 1, `${id} ไม่มี part เลย`)
    for (const part of parts) {
      assert.ok(part.hook, `${id} มี part ที่ไม่มี hook`)
      assert.ok(part.effect, `${id} มี part ที่ไม่มี effect`)
    }
  }
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/data/petPassives.test.js`
Expected: FAIL — `partsOf is not a function` (export ยังไม่มี)

- [ ] **Step 3: เขียนตัวช่วยใน `petPassives.js`**

แทรก **หลัง** `passiveValueAt` (ก่อน `passiveText`) และ **แก้ `passiveText`/`effectText` ให้ใช้ค่ารวมจากทุก part**:

```js
// ════════════════════════════════════════════════════════════════════
//  ตัวช่วยอ่านรูปข้อมูล — ตรรกะทุกที่ต้องอ่านผ่านตัวช่วยพวกนี้ ห้ามแตะ p.hook/p.effect ตรงๆ
//
//  🔑 เพ็ทตัวเดียวมีได้หลายผล (บากุ = รับแทน + ฟื้นเอง) ⇒ เก็บเป็น parts[]
//  ⚠️ ระหว่าง P1 ตัวช่วยยัง "ห่อ" รูปเก่า {hook, effect} ให้เป็น 1 part ชั่วคราว
//     เพื่อให้ย้ายผู้อ่านทีละไฟล์ได้โดยเทสไม่แดง — สะพานนี้ถูกถอดทิ้งในงานย่อยสุดท้ายของ P1
// ════════════════════════════════════════════════════════════════════

/** ทุก part ของ passive (รูปเก่าถูกห่อให้เป็น 1 part) */
export function partsOf(p) {
  if (!p) return []
  if (Array.isArray(p.parts)) return p.parts
  if (p.hook && p.effect) return [{ hook: p.hook, effect: p.effect, value: p.value, step: p.step }]
  return []
}

/** ทุก part ที่ hook ตรง — ตามลำดับที่เขียนไว้ใน parts (ลำดับมีผลกับลำดับ event บนจอ) */
export const partsAt = (p, hook) => partsOf(p).filter(x => x.hook === hook)

/** part แรกที่ hook ตรง (ใช้ตอนที่ hook นั้นมีได้ part เดียวโดยธรรมชาติ) */
export const partAt = (p, hook) => partsOf(p).find(x => x.hook === hook) || null

/** part ที่ให้ผลนั้น */
export const partWithEffect = (p, effect) => partsOf(p).find(x => x.effect === effect) || null

/** ค่ารวมของทุก part สำหรับเติมข้อความ — คีย์ล้วน (part แรกที่มีคีย์นั้นชนะ)
 *  + คีย์แบบ `tag.key` สำหรับ part ที่คีย์ชนกัน (บากุมี pct สองตัว) */
function mergedValues(p, level) {
  const out = {}
  for (const part of partsOf(p)) {
    const v = passiveValueAt(part, level)
    for (const [k, val] of Object.entries(v)) {
      if (!(k in out)) out[k] = val
      if (part.tag) out[`${part.tag}.${k}`] = val
    }
  }
  return out
}
```

แล้วเปลี่ยน **ไส้ใน** ของ `passiveText` และ `effectText` ให้ใช้ `mergedValues` (ลายเซ็นเดิมไม่เปลี่ยน + `effectText` รับออปชัน `effect` เพิ่ม):

```js
export function passiveText(p, level = 1) {
  if (!p) return ''
  const v = mergedValues(p, level)
  return String(p.desc || '').replace(/\{([\w.]+)\}/g, (m, key) => (v[key] ?? m))
}

export function effectText(p, level = 1, { onTarget = false, effect = null } = {}) {
  if (!p) return ''
  const v = mergedValues(p, level)
  const tpl = (onTarget && p.shortOn) || p.short || p.desc || ''
  return String(tpl).replace(/\{([\w.]+)\}/g, (m, key) => (v[key] ?? m))
}
```

> ⚠️ regex เปลี่ยนจาก `\{(\w+)\}` เป็น `\{([\w.]+)\}` เพื่อรับ `{guard.pct}` · `\w` ไม่กินจุด
> ⚠️ พารามิเตอร์ `effect` ยังไม่ถูกใช้ในรอบนี้ (ทุกตัวมี `short` เดียว) — มีไว้ให้ผู้เรียกใน Task 3 ส่งได้โดยไม่ต้องแก้ลายเซ็นอีกรอบ ตอน P3 ที่เพ็ทหลายผลมาถึงค่อยทำให้มันเลือกข้อความจริง

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/data/petPassives.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")`
Expected: **976 + เคสใหม่ ผ่านหมด · fail 0**
Run: `npm run build`
Expected: `✓ built in …`

- [ ] **Step 6: Commit**

```bash
git add src/data/petPassives.js src/data/petPassives.test.js
git commit -m "Passive: ตัวช่วยอ่าน parts[] + ข้อความเติมค่าจากทุก part (ยังห่อรูปเก่าให้อยู่)"
```

---

### Task 2: ย้าย `battlePassives.js` มาอ่านผ่านตัวช่วย

**Files:**
- Modify: `src/utils/battlePassives.js` (ทุกจุดที่อ้าง `p.hook`/`p.effect`)
- Test: `src/utils/battlePassives.test.js` (เพิ่มเคสท้ายไฟล์)

**Interfaces:**
- Consumes: `partsOf`, `partsAt`, `partAt`, `partWithEffect`, `passiveValueAt` จาก Task 1
- Produces: ลายเซ็นของ `applyAuras` / `runOnStart` / `runOnRound` / `runOnAttack` / `runOnHit` / `runOnDeath` / `runOnKill` **ไม่เปลี่ยน** — เปลี่ยนแค่ข้างใน

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน (พาสสีฟ 2 ผลใน hook เดียวกันต้องทำงานทั้งคู่)**

ต่อท้าย `src/utils/battlePassives.test.js`:

```js
// ── หลายผลในตัวเดียว (โครง parts[]) ─────────────────────────────
// ลงทะเบียนพาสสีฟสมมติชั่วคราวในทะเบียน แล้วลบทิ้งท้ายเทส
// (แพทเทิร์นเดียวกับ id '__blank__' ที่ sim ใช้ — ทะเบียนเป็น object ธรรมดา)
test('onRound: พาสสีฟที่มี 2 part ใน hook เดียวกัน ต้องทำงานครบทั้งคู่', () => {
  PET_PASSIVES.__two = {
    name: 'ทดสอบสองผล', icon: '🧪',
    parts: [
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 10 }, step: { pct: 0 } },
      { hook: 'onRound', effect: 'healLowestAlly', value: { pct: 20 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const me = u('__two', { uid: 'A0', hp: 500 })      // maxHp 1000 ⇒ พร่องอยู่
    const mate = u('__blank__', { uid: 'A1', hp: 200 })
    const events = runOnRound([me, mate])
    const effects = events.map(e => e.effect)
    assert.ok(effects.includes('regenSelf'), 'part แรกไม่ทำงาน')
    assert.ok(effects.includes('healLowestAlly'), 'part ที่สองไม่ทำงาน')
    assert.equal(me.hp, 600)                            // +10% ของ 1000
    assert.equal(mate.hp, 400)                          // +20% ของ 1000
  } finally {
    delete PET_PASSIVES.__two
  }
})

test('onHit: part ของ hook อื่นต้องไม่ถูกเรียกผิดจังหวะ', () => {
  PET_PASSIVES.__mix = {
    name: 'ทดสอบข้ามฮุก', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'damageReduction', value: { pct: 50 }, step: { pct: 0 } },
      { hook: 'onKill', effect: 'stackAtk', value: { pct: 10, max: 3 }, step: { pct: 0, max: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const d = u('__mix', { uid: 'A0' })
    const res = runOnHit(d, 100, u('__blank__', { uid: 'B0', side: 'B' }), [d], () => 0.99)
    assert.equal(res.dmg, 50)                                   // ลดครึ่ง
    assert.equal(res.events.filter(e => e.effect === 'stackAtk').length, 0)
  } finally {
    delete PET_PASSIVES.__mix
  }
})
```

> ต้องเพิ่ม `runOnRound`, `runOnHit`, `PET_PASSIVES` เข้า import ท้ายไฟล์เทสถ้ายังไม่มี — เช็คบรรทัด import บนสุดก่อน (ปัจจุบันมีครบแล้วทั้งสามตัว)

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `part ที่สองไม่ทำงาน` (โค้ดเดิมอ่าน `p.effect` ตัวเดียว จึงเห็นแค่ part แรก)

- [ ] **Step 3: แก้ `battlePassives.js` ทีละจุด**

3.1 เพิ่ม import + ลบตัวช่วยเดิมที่อ่าน `p.value` ตรงๆ:

```js
import { PET_PASSIVES, passiveValueAt, partsOf, partsAt, partAt, partWithEffect } from '../data/petPassives.js'
```

`valOf` เปลี่ยนให้รับ **part**:

```js
/** ค่าของ part นั้นตามขั้นที่เพ็ทอัพไว้ (ยังไม่มีระบบหิน ⇒ undefined = ขั้น 1)
 *  ⚠️ ห้ามอ่าน part.value ตรงๆ ในตรรกะ — ไม่งั้นพอระบบหินมา ค่าจะไม่ขยับตามขั้น */
const valOf = (part, unit) => passiveValueAt(part, unit?.passiveLv)
```

3.2 `ev()` — รับ part เพิ่ม เพื่อให้ event ยังมี `effect` ที่ถูกตัว:

```js
function ev(unit, p, part, extra = {}) {
  return { t: 'passive', uid: unit.uid, side: unit.side, petId: unit.id,
    name: p.name, icon: p.icon, effect: part.effect, ...extra }
}
```

> ทุกจุดที่เรียก `ev(x, p, {…})` ต้องเปลี่ยนเป็น `ev(x, p, part, {…})` — มี 17 จุด อย่าลืมสักจุด (เทสจับได้ทุกจุดเพราะ `effect` จะกลายเป็น `undefined`)

3.3 `applyAuras` — วนทุก part ที่ hook เป็น `aura`:

```js
for (const u of team) {
  const p = passiveFor(u)
  for (const part of partsAt(p, 'aura')) {
    const v = valOf(part, u)
    const e = ev(u, p, part, { targets: [u.uid], fxKind: 'aura' })
    out.push(e)
    switch (part.effect) {
      // …เนื้อในทุก case เหมือนเดิมทุกบรรทัด…
    }
    if (STAT_EFFECTS.has(part.effect)) e.statsAfter = statsSnapshot(team, foes)
  }
}
```

3.4 `runOnStart` · `runOnRound` — เปลี่ยน `if (!p || p.hook !== 'onX') continue` + `if (p.effect === …)` เป็น `for (const part of partsAt(p, 'onX')) { … switch (part.effect) … }`
⚠️ ใน `runOnRound` บล็อก `u.teamRegenPct` (คู่หู 🐳🦭) อยู่ **นอก** ลูป part เหมือนเดิม — มันไม่ได้มาจากพาสสีฟของตัวเอง

3.5 `runOnAttack` — เดิม `return res` เร็วถ้า hook ไม่ตรง · ใหม่:

```js
export function runOnAttack(att, target, foes, rand) {
  const p = passiveFor(att)
  const res = { target, atkMult: 1, extra: [], strikes: 1, strikePct: 100, events: [] }
  for (const part of partsAt(p, 'onAttack')) {
    const v = valOf(part, att)
    switch (part.effect) {
      // …เนื้อในเหมือนเดิม แต่ `p` → `part` ในทุก valOf/ev…
    }
  }
  return res
}
```

3.6 `runOnHit` — 2 จุด:
- ลูป guardian: `const gpart = partWithEffect(gp, 'guardian'); if (!gpart || gpart.hook !== 'onHit' || g === defender) continue` แล้วใช้ `valOf(gpart, g)`
- ของ defender เอง: `for (const part of partsAt(p, 'onHit')) { … }`

3.7 `runOnDeath` — 2 จุด:
- ของตัวเอง: `const part = partAt(p, 'onDeath')` แล้วเช็ค `part && (unit.passiveUses || 0) < (valOf(part, unit).times || 1)`
- ของเพื่อน: `const gpart = partWithEffect(gp, 'saveAlly'); if (!gpart || gpart.hook !== 'onDeath') continue`

3.8 `runOnKill` — `for (const part of partsAt(p, 'onKill')) { … }`

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: PASS ทั้งไฟล์ (เคสเดิมทุกตัว + 2 เคสใหม่)

- [ ] **Step 5: รันเทสทั้งรีโป + build + sim เทียบผลว่าไม่เปลี่ยน**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/passive-power-sim.mjs 300`
Expected: ผลออกมาเป็นตารางปกติ **ไม่มีบรรทัดไหน `effect: undefined`** และไม่มีตัวไหน lift = 0.0% ทั้งแถบ (0.0% ทั้งแถบ = passive ไม่ทำงานเลย = ย้ายพลาด)

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: เอนจินอ่านพาสสีฟผ่าน parts[] (เพ็ทตัวเดียวมีหลายผลได้แล้ว)"
```

---

### Task 3: ย้าย `battleBuffs.js` มาอ่านผ่านตัวช่วย

**Files:**
- Modify: `src/utils/battleBuffs.js:24-29` (`maxStacksOf`), `:53-69` (`aurasOf`), `:85-90` (สถานะติดตัว)
- Test: `src/utils/battleBuffs.test.js` (มีอยู่แล้ว — เพิ่มเคส)

**Interfaces:**
- Consumes: `partsOf`, `partsAt`, `partWithEffect` จาก Task 1
- Produces: `buffSources()` / `statusChips()` ลายเซ็นเดิม ผลลัพธ์เดิม

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

ต่อท้าย `src/utils/battleBuffs.test.js`:

```js
test('บัฟ: พาสสีฟ 2 ผลต้องได้ป้ายครบทั้งสองใบ', () => {
  PET_PASSIVES.__dual = {
    name: 'ทดสอบสองป้าย', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'damageReduction', value: { pct: 10 }, step: { pct: 0 } },
      { hook: 'onHit', effect: 'dodge', value: { pct: 5 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const src = buffSources([{ id: '__dual' }], [])
    const effects = (src.A0 || []).map(b => b.effect)
    assert.ok(effects.includes('damageReduction'), 'ป้ายแรกหาย')
    assert.ok(effects.includes('dodge'), 'ป้ายที่สองหาย')
  } finally {
    delete PET_PASSIVES.__dual
  }
})
```

> เช็ค import บนสุดของไฟล์เทสว่ามี `PET_PASSIVES` และ `buffSources` แล้วหรือยัง ถ้ายังให้เติม

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battleBuffs.test.js`
Expected: FAIL — `ป้ายที่สองหาย`

- [ ] **Step 3: แก้ `battleBuffs.js`**

```js
import {
  STATUS_ICON, STATUS_TEXT, STATUS_MAX, PET_PASSIVES, effectText,
  TEAM_AURA_EFFECTS, FOE_AURA_EFFECTS, SELF_STATUS_EFFECTS,
  partsOf, partsAt, partWithEffect,
} from '../data/petPassives.js'
```

`maxStacksOf` — หาเพดานจาก part ที่ effect ตรง:

```js
function maxStacksOf(b) {
  for (const p of Object.values(PET_PASSIVES)) {
    if (p.name !== b.skillName) continue
    const part = partWithEffect(p, b.effect)
    if (part) return part.value?.max ?? 0
  }
  return 0
}
```

`aurasOf` — วนทุก aura part:

```js
team.forEach((pet, i) => {
  const p = passiveOf(pet)
  const entry = { owner: pet, uid: side + i, passive: p }
  for (const part of partsAt(p, 'aura')) {
    if (TEAM_AURA_EFFECTS.has(part.effect)) mine.push({ effect: part.effect, ...entry })
    else if (FOE_AURA_EFFECTS.has(part.effect)) theirs.push({ effect: part.effect, ...entry })
    // คู่หู 🐳🦭 — teamAtk ที่มี duoWith และเพื่อนคนนั้นอยู่ในทีมจริง
    if (part.effect === 'teamAtk' && part.value?.duoWith && ids.has(part.value.duoWith)) {
      duo.push({ effect: 'duoRegen', ...entry })
    }
  }
})
```

สถานะติดตัว — วนทุก part แทนที่จะดูผลเดียว:

```js
const self = passiveOf(pet)
for (const part of partsOf(self)) {
  if (!SELF_STATUS_EFFECTS.has(part.effect)) continue
  const b = makeBuff(part.effect, pet, uid, { passive: self })
  b.self = true
  list.push(b)
}
```

`makeBuff` — ส่ง effect ให้ `effectText` เลือกข้อความ (ยังได้ผลเดิมวันนี้ แต่ P3 จะพึ่งมัน):

```js
label: opts.label ?? effectText(p, owner?.passiveLv, { onTarget: !!opts.foeSide, effect }),
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/battleBuffs.test.js`
Expected: PASS

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleBuffs.js src/utils/battleBuffs.test.js
git commit -m "Buffs: ป้ายสถานะอ่านผ่าน parts[] (พาสสีฟหลายผลได้ป้ายครบ)"
```

---

### Task 4: ย้ายเครื่องมือใน `scripts/` มาอ่านผ่านตัวช่วย

**Files:**
- Modify: `scripts/export-pet-data.mjs:36` · `scripts/passive-power-sim.mjs:62` · `scripts/build-pet-balance-page.mjs:74-75,94,106`
- Test: รันสคริปต์จริงแล้วดูผล (สคริปต์ dev ไม่มีเทสอัตโนมัติ — เป็นข้อยกเว้นที่ตั้งใจ)

**Interfaces:**
- Consumes: `partsOf` จาก Task 1
- Produces: JSON ที่ `export-pet-data.mjs` พ่นออกมา เพิ่มฟิลด์ `parts: [{hook, effect}]` และ **คง `hook`/`effect` เดิมไว้** (= part แรก) เพื่อให้ `build-pet-balance-page.mjs` ที่อ่านฟิลด์เดิมยังทำงาน

- [ ] **Step 1: แก้ `export-pet-data.mjs`**

```js
import { PET_PASSIVES, passiveValueAt, passiveText, effectText, PASSIVE_MAX_LEVEL, partsOf } from '../src/data/petPassives.js'
```

บรรทัดที่ประกอบ object พาสสีฟ:

```js
// hook/effect แบบเดี่ยว = part แรก — คงไว้ให้หน้าเพจเดิมอ่านได้ · ของจริงอยู่ใน parts
const parts = partsOf(pas)
… name: pas.name, icon: pas.icon, hook: parts[0]?.hook, effect: parts[0]?.effect,
   parts: parts.map(x => ({ hook: x.hook, effect: x.effect })),
```

- [ ] **Step 2: แก้ `passive-power-sim.mjs`**

```js
import { PET_PASSIVES, partsOf } from '../src/data/petPassives.js'
…
const parts = partsOf(pas)
… passive: pas.name, effect: parts.map(x => x.effect).join('+'), hook: parts.map(x => x.hook).join('+'),
```

> รวมด้วย `+` เพื่อให้ตารางผลอ่านออกทันทีว่าตัวไหนมีหลายผล (`guardian+regenSelf`)

- [ ] **Step 3: แก้ `build-pet-balance-page.mjs`**

ทุกจุดที่ใช้ `pv.hook` / `pv.effect` / `p.passive.hook` / `p.passive.effect` ยังใช้ได้ตามเดิม (Step 1 คงฟิลด์ไว้แล้ว) — **แก้เฉพาะ** จุดที่แสดง effect ให้โชว์ครบทุก part:

```js
<code class="tag-code">${(pv.parts || [{ effect: pv.effect }]).map(x => x.effect).join(' + ')}</code>
```

- [ ] **Step 4: รันจริงแล้วดูผลด้วยตา**

Run: `node scripts/export-pet-data.mjs`
Expected: ไม่ error · เปิดไฟล์ผลลัพธ์ดูว่า **ไม่มี `"hook": null` หรือ `"effect": null`** สักตัว
Run: `node scripts/build-pet-balance-page.mjs`
Expected: สร้าง `docs/pet-balance-page.html` ได้ ไม่ error

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "Tools: เครื่องมือวัดพาสสีฟอ่านผ่าน parts[] (ตัวหลายผลโชว์ครบ)"
```

---

### Task 5: แปลงข้อมูล 27 ตัวเป็น `parts[]`

**Files:**
- Modify: `src/data/petPassives.js:20-199` (ทุกรายการใน `PET_PASSIVES`)

**Interfaces:**
- Consumes: —
- Produces: `PET_PASSIVES` ทุกตัวอยู่ในรูป `{ name, icon, parts: [...], desc, short, shortOn? }`

- [ ] **Step 1: แปลงทีละตัว — งานเชิงกล ห้ามแก้ค่า**

รูปเดิม:

```js
  hedgehog: {
    name: 'เกราะหนาม', icon: '🦔',
    hook: 'onHit', effect: 'thorns', value: { pct: 8 }, step: { pct: 3 },
    desc: 'สะท้อน {pct}% ของดาเมจที่รับกลับไปที่ผู้โจมตี',
    short: 'สะท้อน {pct}% ของดาเมจกลับไปที่ผู้โจมตี',
  },
```

รูปใหม่:

```js
  hedgehog: {
    name: 'เกราะหนาม', icon: '🦔',
    parts: [{ hook: 'onHit', effect: 'thorns', value: { pct: 8 }, step: { pct: 3 } }],
    desc: 'สะท้อน {pct}% ของดาเมจที่รับกลับไปที่ผู้โจมตี',
    short: 'สะท้อน {pct}% ของดาเมจกลับไปที่ผู้โจมตี',
  },
```

🔴 **ห้ามเปลี่ยนตัวเลขใน `value`/`step` แม้แต่ตัวเดียว · ห้ามแตะ `desc`/`short`/`shortOn`/`name`/`icon`**
🔴 คอมเมนต์ที่คร่อมแต่ละรายการอยู่ (เช่นบล็อกยาวเหนือ `butterfly`) **เก็บไว้ทั้งหมด** — มันคือบันทึกว่าทำไมค่านั้นถึงเป็นค่านั้น

- [ ] **Step 2: อัปเดตคอมเมนต์ "กฎเหล็ก" หัวไฟล์**

เติมใต้บล็อก 🔒 เดิม:

```js
// 🧩 โครงข้อมูล: พาสสีฟ 1 ตัว = `parts: [{ hook, effect, value, step, tag? }]`
//    เพ็ทตัวเดียวมีได้หลายผล (บากุ = รับแทน + ฟื้นเอง) · ลำดับใน parts = ลำดับที่ event โผล่บนจอ
//    `tag` ใส่เมื่อสอง part ใช้ชื่อคีย์ชนกัน แล้วอ้างในข้อความว่า {tag.pct}
//    ❌ ห้ามกลับไปเขียน hook/effect ไว้ระดับบนสุดอีก — มีเทสกันไว้ใน petPassives.test.js
```

- [ ] **Step 3: รันเทสทั้งรีโป**

Run: `node --test $(find src -name "*.test.js")`
Expected: **fail 0** — ถ้ามีตัวไหนพิมพ์ตกจะเห็นทันทีเพราะ `partsOf` คืนลิสต์ว่าง แล้วพาสสีฟตัวนั้นเงียบไปเลย
Run: `npm run build` → ผ่าน

- [ ] **Step 4: ตรวจด้วยตาว่าไม่มีใครตกหล่น**

Run: `grep -c "parts: \[" src/data/petPassives.js`
Expected: **27**
Run: `grep -n "^    hook:" src/data/petPassives.js`
Expected: ไม่เจออะไรเลย (ไม่มี hook ระดับบนสุดหลงเหลือ)

- [ ] **Step 5: Commit**

```bash
git add src/data/petPassives.js
git commit -m "Passive: แปลงทะเบียน 27 ตัวเป็น parts[] (ค่าเดิมทุกตัว ไม่แตะตัวเลข)"
```

---

### Task 6: ถอดสะพานรูปเก่าทิ้ง + เทสกันย้อนกลับ

**Files:**
- Modify: `src/data/petPassives.js` (`partsOf`)
- Test: `src/data/petPassives.test.js`

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1–5
- Produces: `partsOf(p)` คืน `p.parts` เท่านั้น — รูปเก่าไม่ถูกรองรับอีกต่อไป

- [ ] **Step 1: แก้เทสของสะพาน + เพิ่มเทสกันย้อนกลับ**

ใน `src/data/petPassives.test.js` **แทนที่** เคส `'partsOf: รูปเก่าถูกห่อเป็น 1 part ให้อัตโนมัติ (สะพานชั่วคราวของ P1)'` ด้วย:

```js
test('partsOf: รูปเก่าไม่ถูกรองรับอีกแล้ว — คืนลิสต์ว่าง', () => {
  const old = { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }
  assert.deepEqual(partsOf(old), [])
})

test('ทะเบียนต้องไม่มี hook/effect ระดับบนสุดหลงเหลือ (สองแหล่งความจริง = พังเงียบ)', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.equal(p.hook, undefined, `${id} ยังมี hook ระดับบนสุด`)
    assert.equal(p.effect, undefined, `${id} ยังมี effect ระดับบนสุด`)
    assert.ok(Array.isArray(p.parts), `${id} ไม่มี parts`)
  }
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/data/petPassives.test.js`
Expected: FAIL ที่เคสแรก (สะพานยังห่อรูปเก่าให้อยู่)

- [ ] **Step 3: ถอดสะพาน**

```js
/** ทุก part ของ passive — `parts` เป็นทางเดียว ไม่รองรับ hook/effect ระดับบนสุดอีกแล้ว
 *  (เคยรองรับชั่วคราวตอนย้ายโครง P1 · เก็บสองรูปไว้พร้อมกัน = สองแหล่งความจริง แล้วพังเงียบ) */
export function partsOf(p) {
  return Array.isArray(p?.parts) ? p.parts : []
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/data/petPassives.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: รันเทสทั้งรีโป + build + sim ยืนยันว่าเกมเหมือนเดิม**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/passive-power-sim.mjs 1500`
Expected: อันดับและตัวเลข lift **ใกล้เคียงของเดิมที่บันทึกไว้ในสเปกบาลานซ์** (🐘 บากุติดลบ · 🐕 เซอร์เบอรัสอันดับ 2 · สายฟื้นเลือดต้นรอบแรงสุด) — เบี่ยงได้ตามความสุ่ม แต่ **ห้ามมีตัวไหนกลายเป็น 0.0% เป๊ะ** (= passive ตาย)

- [ ] **Step 6: Commit + push**

```bash
git add src/data/petPassives.js src/data/petPassives.test.js
git commit -m "Passive: ถอดสะพานรูปเก่าทิ้ง — parts[] เป็นทางเดียว (กันสองแหล่งความจริง)"
git push
```

---

## หลังจบ P1

รายงานให้ user: เทสผ่านกี่ตัว · ผล `passive-power-sim` เทียบกับของเดิม · แล้วรอไฟเขียวก่อนเขียนแผน **P2 (กลไกใหม่ 11 แบบ)**

**P2–P5 จะมีแผนของตัวเองคนละไฟล์** — เขียนทีละเฟส ไม่เขียนล่วงหน้าทั้งหมด เพราะ P2 ต้องรู้ก่อนว่า `parts[]` หน้าตาจริงหลังลงมือเป็นยังไง
