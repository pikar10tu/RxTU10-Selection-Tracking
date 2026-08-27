# PvP ประวัติโจมตี/ตั้งรับ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้เล่นเห็นว่าตัวเองไปบุกใครมาบ้าง และ**ใครมาบุกทีมตั้งรับของเราบ้าง** โดยไม่เพิ่ม read/write/collection แม้แต่จุดเดียว

**Architecture:** firestore.rules ห้ามเขียน doc คนอื่น ⇒ ผู้บุกจดผลลง**แถว roster ของตัวเอง** (`rows.<myUid>.h`) ฝ่ายรับสแกนทุกแถวหาคนที่ `h[].u === myUid` แล้วกลับด้านผลลัพธ์ · `roster/current` ถูกอ่าน 1 read ตอนเข้าหน้าอยู่แล้ว และมี write หลังทุกไฟต์อยู่แล้ว (เรตเปลี่ยน)

**Tech Stack:** Vue 3 `<script setup>` · Pinia · Firestore (`updateDoc` dot-notation) · เทส `node --test`

**Spec:** `docs/superpowers/specs/2026-08-27-pvp-history-design.md`

## Global Constraints

- ห้ามมี `font-size` ต่ำกว่า `.7rem` ในไฟล์ `.vue`/`.css` ใดๆ (ตรวจ: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`)
- คีย์ในแถว roster ต้องสั้น (`h`, `u`, `w`, `c`, `t`) — ทุกไบต์คูณจำนวนคนทั้งชั้นปี
- เก็บสูงสุด **5 รายการ/คน** (`HISTORY_MAX = 5`) — ห้ามเพิ่มโดยไม่คำนวณขนาด doc ใหม่ (ปัจจุบัน ≈24KB จากลิมิต 1MB)
- บันทึกเฉพาะไฟต์กับ**คนจริง** (`opp.isBot` → ข้าม) — บอทไม่มีแถวใน roster
- ห้ามผูกรางวัล/เหรียญใดๆ กับฝั่งตั้งรับ (ผู้บุกเป็นคนจดผลเอง ⇒ โกหกได้)
- เขียน roster ด้วย dot-notation `rows.<uid>` เท่านั้น — `setDoc` ทั้งก้อนจะลบแถวคนอื่นและถูก rules ปฏิเสธ
- commit รูปแบบ `Area: อะไร (ทำไม)` เป็นไทย · คอมเมนต์ในโค้ดไทยปนอังกฤษตามสไตล์รีโป

---

### Task 1: `utils/pvpHistory.js` — ตรรกะล้วน + เทส

**Files:**
- Create: `src/utils/pvpHistory.js`
- Test: `src/utils/pvpHistory.test.js`

**Interfaces:**
- Consumes: ไม่มี (pure)
- Produces:
  - `HISTORY_MAX = 5`
  - `pushHistory(list, entry) -> Array` — ใหม่สุดอยู่หน้า ตัดเหลือ 5
  - `myAttacks(rows, uid) -> [{ uid, name, won, coin, t }]`
  - `defenseLog(rows, uid, max = 10) -> [{ uid, name, won, t }]` (`won` = **มุมฝ่ายรับ**)
  - `agoLabel(t, now) -> string`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
// src/utils/pvpHistory.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { pushHistory, myAttacks, defenseLog, agoLabel, HISTORY_MAX } from './pvpHistory.js'

const e = (u, w, c, t) => ({ u, w, c, t })

test('pushHistory ใหม่สุดอยู่หน้า และตัดที่ 5', () => {
  let list = []
  for (let i = 1; i <= 7; i++) list = pushHistory(list, e('x' + i, 1, 10, i))
  assert.equal(list.length, HISTORY_MAX)
  assert.equal(list[0].u, 'x7', 'ใหม่สุดต้องอยู่หน้า')
  assert.equal(list[4].u, 'x3', 'เก่าสุดที่เหลือคือรายการที่ 3')
})

test('pushHistory รับ list ที่ไม่ใช่ array ได้ (แถวเก่าที่ยังไม่มี h)', () => {
  assert.deepEqual(pushHistory(undefined, e('a', 1, 5, 1)), [e('a', 1, 5, 1)])
  assert.deepEqual(pushHistory(null, e('a', 0, 0, 2)), [e('a', 0, 0, 2)])
})

test('pushHistory entry ที่ไม่มี u ถูกปฏิเสธ (กันแถวเสีย)', () => {
  const list = [e('a', 1, 5, 1)]
  assert.deepEqual(pushHistory(list, { w: 1 }), list)
  assert.deepEqual(pushHistory(list, null), list)
})

const rows = {
  me:  { n: 'ฉัน',  h: [e('bob', 1, 250, 300), e('ann', 0, 40, 200)] },
  bob: { n: 'บ๊อบ', h: [e('me', 1, 120, 400), e('ann', 1, 90, 100)] },
  ann: { n: 'แอน',  h: [e('me', 0, 30, 500)] },
  cat: { n: 'แคท' },
}

test('myAttacks เติมชื่อเป้าหมายจากแถวของเขา และคงลำดับเดิม', () => {
  const r = myAttacks(rows, 'me')
  assert.equal(r.length, 2)
  assert.deepEqual(r[0], { uid: 'bob', name: 'บ๊อบ', won: true, coin: 250, t: 300 })
  assert.equal(r[1].name, 'แอน')
  assert.equal(r[1].won, false)
})

test('myAttacks แถวที่ไม่มี h คืน array ว่าง', () => {
  assert.deepEqual(myAttacks(rows, 'cat'), [])
  assert.deepEqual(myAttacks(undefined, 'me'), [])
})

test('defenseLog เก็บเฉพาะคนที่บุกเรา เรียงใหม่สุดก่อน และกลับด้านผล', () => {
  const r = defenseLog(rows, 'me')
  assert.equal(r.length, 2)
  assert.equal(r[0].uid, 'ann', 't=500 ใหม่สุด')
  assert.equal(r[0].won, true, 'แอนบุกแล้วแพ้ (w:0) ⇒ ฝั่งเรารอด')
  assert.equal(r[0].name, 'แอน')
  assert.equal(r[1].uid, 'bob')
  assert.equal(r[1].won, false, 'บ๊อบบุกแล้วชนะ (w:1) ⇒ ฝั่งเราแพ้')
})

test('defenseLog ไม่นับแถวของตัวเอง และไม่มีเหรียญติดมา', () => {
  const self = { me: { n: 'ฉัน', h: [e('me', 1, 999, 900)] } }
  assert.deepEqual(defenseLog(self, 'me'), [])
  assert.equal('coin' in defenseLog(rows, 'me')[0], false, 'ฝั่งตั้งรับห้ามโชว์เหรียญของผู้บุก')
})

test('defenseLog ตัดที่ max', () => {
  const many = {}
  for (let i = 0; i < 30; i++) many['u' + i] = { n: 'u' + i, h: [e('me', 1, 0, i)] }
  assert.equal(defenseLog(many, 'me').length, 10)
  assert.equal(defenseLog(many, 'me', 3).length, 3)
})

test('agoLabel อ่านง่ายทุกช่วง', () => {
  const now = 1_000_000_000
  assert.equal(agoLabel(now - 30_000, now), 'เมื่อกี้')
  assert.equal(agoLabel(now - 12 * 60_000, now), '12 นาทีที่แล้ว')
  assert.equal(agoLabel(now - 3 * 3_600_000, now), '3 ชม.ที่แล้ว')
  assert.equal(agoLabel(now - 2 * 86_400_000, now), '2 วันก่อน')
  assert.equal(agoLabel(0, now), '')
  assert.equal(agoLabel(now + 60_000, now), 'เมื่อกี้', 'นาฬิกาเครื่องเพี้ยน = ห้ามโชว์เวลาติดลบ')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าล้มเหลว**

Run: `node --test src/utils/pvpHistory.test.js`
Expected: FAIL — `Cannot find module './pvpHistory.js'`

- [ ] **Step 3: เขียน implementation**

```js
// src/utils/pvpHistory.js
/**
 * ประวัติบุก/ตั้งรับของสนามประลอง — ตรรกะล้วน ไม่แตะ Firestore/Vue
 *
 * ที่ต้องอ้อมแบบนี้: rules ห้ามเขียน doc ของคนอื่น ⇒ A บุก B แล้วเขียนลง doc ของ B ไม่ได้
 * ⇒ ผู้บุกจดผลลงแถว roster ของตัวเอง · ฝ่ายรับสแกนทุกแถวหาคนที่บุกตัวเอง
 *
 * รูปรายการ: { u: uidเป้าหมาย, w: 1ชนะ/0แพ้, c: เหรียญที่ได้, t: Date.now() }
 * คีย์สั้นเพราะอยู่ในแถว roster ที่ทุกคนทั้งชั้นปีโหลดทุกเซสชัน
 *
 * spec: docs/superpowers/specs/2026-08-27-pvp-history-design.md
 * เทส: node --test src/utils/pvpHistory.test.js
 */

/** เก็บกี่รายการต่อคน — ⚠️ เพิ่มแล้วต้องคำนวณขนาด doc ใหม่ (5×~45B×105คน ≈ 24KB จากลิมิต 1MB) */
export const HISTORY_MAX = 5

/** ต่อรายการใหม่ไว้หน้าสุด แล้วตัดท้ายให้เหลือ HISTORY_MAX */
export function pushHistory(list, entry) {
  const prev = Array.isArray(list) ? list : []
  if (!entry || !entry.u) return prev        // entry เสีย = ไม่แตะของเดิม
  return [entry, ...prev].slice(0, HISTORY_MAX)
}

/** ประวัติที่ "เราไปบุก" — อ่านตรงจากแถวเรา แล้วเติมชื่อเป้าหมายจากแถวของเขา */
export function myAttacks(rows, uid) {
  const h = Array.isArray(rows?.[uid]?.h) ? rows[uid].h : []
  return h.map(e => ({
    uid:  e?.u || null,
    name: rows?.[e?.u]?.n || '?',            // เป้าหมายออกจากรุ่นไปแล้ว = '?'
    won:  !!e?.w,
    coin: Number(e?.c) || 0,
    t:    Number(e?.t) || 0,
  }))
}

/**
 * ประวัติที่ "มีคนมาบุกเรา" — สแกนทุกแถว (105 แถว × 5 รายการ ≈ 525 รอบ ทำใน computed ได้สบาย)
 * ⚠️ ผลต้องกลับด้าน: w:1 ของผู้บุก = ฝั่งเราแพ้
 * ⚠️ ห้ามคืนเหรียญของผู้บุกออกไป — ฝั่งตั้งรับไม่ได้อะไรจากการถูกบุก
 */
export function defenseLog(rows, uid, max = 10) {
  const out = []
  for (const [attacker, row] of Object.entries(rows || {})) {
    if (attacker === uid) continue
    const h = Array.isArray(row?.h) ? row.h : []
    for (const e of h) {
      if (e?.u !== uid) continue
      out.push({ uid: attacker, name: row?.n || '?', won: !e?.w, t: Number(e?.t) || 0 })
    }
  }
  return out.sort((a, b) => b.t - a.t).slice(0, max)
}

/**
 * เวลาแบบคร่าวๆ — t มาจาก Date.now() ของ "เครื่องผู้บุก" (serverTimestamp ใส่ใน array ไม่ได้)
 * ⇒ นาฬิกาเครื่องเพี้ยนได้ จึง clamp ไม่ให้ติดลบ และไม่โชว์วินาที
 */
export function agoLabel(t, now = Date.now()) {
  if (!t) return ''
  const d = Math.max(0, now - t)
  if (d < 60_000) return 'เมื่อกี้'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} นาทีที่แล้ว`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} ชม.ที่แล้ว`
  return `${Math.floor(d / 86_400_000)} วันก่อน`
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/pvpHistory.test.js`
Expected: PASS ทุกเทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/pvpHistory.js src/utils/pvpHistory.test.js
git commit -m "PvP: ตรรกะประวัติบุก/ตั้งรับ (ผู้บุกจดผลลงแถวตัวเอง ฝ่ายรับสแกนหา)"
```

---

### Task 2: `buildRosterRow` ต้องไม่ล้าง `h`

**Files:**
- Modify: `src/utils/roster.js` (`buildRosterRow`, คอมเมนต์ `buildRosterFromUsers`)
- Modify: `src/views/AdminView.vue` (ข้อความ confirm ปุ่มสร้าง roster)
- Test: `src/utils/roster.test.js` (เพิ่มเทส)

**Interfaces:**
- Produces: `buildRosterRow(u, prev)` — พารามิเตอร์ที่ 2 ใหม่ · ถ้า `prev.h` มีของ ให้พ่วง `h` ติดไปในแถวใหม่ (คีย์อยู่ท้ายสุดเสมอ)

⚠️ **จุดที่พลาดง่ายที่สุดของทั้งฟีเจอร์:** `buildRosterRow()` สร้างแถวใหม่จาก user doc ทั้งก้อนทุกครั้ง — ถ้าไม่พ่วง `h` เดิม ประวัติจะถูกล้างทุกครั้งที่ sync (เปลี่ยนชื่อ · อัปบ้าน · จบมินิเกม · จบไฟต์ ก็เรียก sync ทั้งนั้น)

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

ต่อท้าย `src/utils/roster.test.js`:

```js
test('buildRosterRow คง h เดิมไว้ (ไม่งั้น sync ครั้งถัดไปล้างประวัติทิ้ง)', () => {
  const prev = { n: 'ปิ๊ก', h: [{ u: 'bob', w: 1, c: 250, t: 111 }] }
  const r = buildRosterRow(user(), prev)
  assert.deepEqual(r.h, prev.h)
})

test('buildRosterRow ไม่ใส่คีย์ h เลยถ้าไม่เคยมีประวัติ (กันแถวบวมด้วย array ว่าง)', () => {
  assert.equal('h' in buildRosterRow(user()), false)
  assert.equal('h' in buildRosterRow(user(), { n: 'ปิ๊ก' }), false)
  assert.equal('h' in buildRosterRow(user(), { n: 'ปิ๊ก', h: [] }), false)
})

test('buildRosterRow เรียกซ้ำด้วยแถวที่ตัวเองสร้าง ได้ผลเท่าเดิม (rosterRowChanged ต้องไม่ยิงเขียนเปล่า)', () => {
  const prev = buildRosterRow(user(), { h: [{ u: 'bob', w: 1, c: 250, t: 111 }] })
  const next = buildRosterRow(user(), prev)
  assert.equal(rosterRowChanged(prev, next), false, 'คีย์ต้องเรียงเหมือนเดิมด้วย (เทียบด้วย JSON.stringify)')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าล้มเหลว**

Run: `node --test src/utils/roster.test.js`
Expected: FAIL — `r.h` เป็น `undefined`

- [ ] **Step 3: แก้ `buildRosterRow`**

เปลี่ยน JSDoc + ลายเซ็น + return ใน `src/utils/roster.js` (เนื้อในเดิมทั้งหมดไม่แตะ):

```js
/**
 * userData (doc เต็ม) → แถวย่อสำหรับ roster
 * @param prev แถวเดิมของคนนี้ (ถ้ามี) — ใช้พ่วงข้อมูลที่ **ไม่ได้อยู่ใน user doc** ติดมาด้วย
 *             ตอนนี้มีอย่างเดียวคือ `h` (ประวัติบุก · ดู utils/pvpHistory.js)
 *             ⚠️ ไม่พ่วง = ประวัติหายทุกครั้งที่ sync (เปลี่ยนชื่อ/อัปบ้าน/จบมินิเกมก็ sync)
 */
export function buildRosterRow(u, prev) {
```

และท้าย object ที่ return (ต่อจาก `tm,`):

```js
    // h ต่อท้ายเสมอ (ตำแหน่งคงที่ = rosterRowChanged เทียบ JSON ได้ตรง)
    ...(prev?.h?.length ? { h: prev.h } : {}),
```

เติมคอมเมนต์เตือนเหนือ `buildRosterFromUsers`:

```js
/** สร้าง rows ทั้งก้อนจาก users ทั้ง collection (ใช้เฉพาะปุ่มแอดมิน)
 *  ⚠️ ประวัติบุก (`h`) หายทั้งรุ่น — ไม่ได้อยู่ใน user doc · ปุ่มแอดมินต้องเตือนก่อนกด */
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/roster.test.js`
Expected: PASS ทั้งไฟล์ (เทสเดิมที่เรียก `buildRosterRow(u)` พารามิเตอร์เดียวต้องยังผ่าน)

- [ ] **Step 5: เตือนในปุ่มแอดมิน**

```bash
grep -n "roster" src/views/AdminView.vue
```
หาข้อความ confirm ของปุ่มสร้าง roster แล้ว**ต่อท้าย** (ไม่เขียนทับ): `ประวัติการบุกของทุกคนจะถูกล้างด้วย`

- [ ] **Step 6: Commit**

```bash
git add src/utils/roster.js src/utils/roster.test.js src/views/AdminView.vue
git commit -m "Roster: แถวคง h (ประวัติบุก) ไว้ตอน sync + เตือนตอนแอดมินสร้าง roster ใหม่"
```

---

### Task 3: บันทึกผลไฟต์ลงแถวตัวเอง

**Files:**
- Modify: `src/composables/useRosterSync.js`
- Modify: `src/composables/useArena.js` (ท้าย `applyResult`)

**Interfaces:**
- Consumes: `pushHistory` (Task 1), `buildRosterRow(u, prev)` (Task 2)
- Produces: `syncRosterRow({ history })` — พารามิเตอร์ optional · `history` = `{ u, w, c, t }` หรือ `null` · ผู้เรียกเดิมทุกจุด (`syncRosterRow()`) ยังทำงานเหมือนเดิม

- [ ] **Step 1: แก้ `useRosterSync.js`**

เพิ่ม import:

```js
import { pushHistory } from '../utils/pvpHistory.js'
```

แก้ตัวฟังก์ชัน (ส่วนที่เหลือของ try/catch เดิมไม่แตะ):

```js
  /**
   * @param opts.history รายการประวัติบุก 1 รายการ ({u,w,c,t}) หรือ null
   *        — เขียนพ่วงไปกับ write เดิมที่เกิดหลังไฟต์อยู่แล้ว (ไม่มี write เพิ่ม)
   */
  async function syncRosterRow({ history = null } = {}) {
    const uid = auth.currentUser?.uid
    const u = auth.userData
    if (!uid || !u) return
    if (!u.studentId && !u.nickname) return
    if (members.rosterMissing) return

    const prev = members.rosterRows?.[uid]
    const next = buildRosterRow({ ...u, uid }, prev)
    if (history) next.h = pushHistory(prev?.h, history)
    if (!rosterRowChanged(prev, next)) return
```

- [ ] **Step 2: แก้ `useArena.applyResult`**

แทนบรรทัด `syncRosterRow()   // เรตเปลี่ยน → อัปแถวตัวเองในบอร์ด` ด้วย:

```js
    // เรตเปลี่ยน → อัปแถวตัวเองในบอร์ด · พ่วงประวัติการบุกไปในการเขียนครั้งเดียวกัน
    // บอทข้าม: ไม่มีแถวใน roster และไม่มีใครต้องเห็นฝั่งตั้งรับของบอท
    syncRosterRow({
      history: opp.isBot ? null : { u: opp.uid, w: won ? 1 : 0, c: coin, t: Date.now() },
    })
```

⚠️ `syncRosterRow` อ่านแถวจาก `auth.userData` ซึ่ง `patchUser` อัปเดตแบบ synchronous ไปแล้ว (CLAUDE.md ข้อ 9) ⇒ เรตใหม่ติดไปในการเขียนครั้งเดียว **ห้ามย้ายไปเรียกก่อน `patchUser`**

- [ ] **Step 3: บิลด์**

Run: `npm run build`
Expected: สำเร็จ ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add src/composables/useRosterSync.js src/composables/useArena.js
git commit -m "PvP: จดผลบุกลงแถว roster ตัวเองหลังไฟต์ (พ่วงกับ sync เรตเดิม ไม่มี write เพิ่ม)"
```

---

### Task 4: `PvpHistory.vue` + ต่อเข้าหน้า Arena

**Files:**
- Create: `src/components/battle/PvpHistory.vue`
- Modify: `src/views/ArenaView.vue`
- Modify: `src/data/guide.js` (หัวข้อ `arena`)

**Interfaces:**
- Consumes: `myAttacks`, `defenseLog`, `agoLabel` (Task 1) · `members.rosterRows` (Pinia)
- ไม่มี overlay/modal ⇒ **ไม่ต้อง Teleport** (CLAUDE.md ข้อ 6 ใช้กับ `position:fixed` เท่านั้น)

- [ ] **Step 1: สร้าง component**

```vue
<!-- src/components/battle/PvpHistory.vue -->
<!-- ประวัติสนามประลอง 2 แท็บ — ค่าเริ่มต้นที่ "ตั้งรับ" (ของที่ไม่เคยเห็นมาก่อน น่าดูกว่า)
     อ่านจาก roster ที่โหลดอยู่แล้วทั้งหมด ⇒ ไม่มี read เพิ่ม
     ⚠️ ฝั่งตั้งรับห้ามโชว์เหรียญและห้ามให้รางวัล — ผู้บุกเป็นคนจดผลเอง (ดูสเปก) -->
<template>
  <div class="ph">
    <div class="ph-head">
      <span class="ph-title"><Emoji char="📜" /> ประวัติ</span>
      <div class="ph-tabs" role="tablist">
        <button class="ph-tab" :class="{ on: tab === 'def' }" role="tab" :aria-selected="tab === 'def'"
          @click="tab = 'def'">ตั้งรับ</button>
        <button class="ph-tab" :class="{ on: tab === 'atk' }" role="tab" :aria-selected="tab === 'atk'"
          @click="tab = 'atk'">เราไปบุก</button>
      </div>
    </div>

    <template v-if="tab === 'def'">
      <div v-if="!defense.length" class="ph-empty">ยังไม่มีใครมาบุกเลย — ทีมที่จัดไว้กำลังเฝ้าอยู่</div>
      <div v-for="(r, i) in defense" :key="'d' + i" class="ph-row">
        <span class="ph-who"><Emoji char="🛡️" /> {{ r.name }} บุกเรา</span>
        <span class="ph-res" :class="r.won ? 'ok' : 'no'">{{ r.won ? 'เรารอด' : 'เราแพ้' }}</span>
        <span class="ph-ago">{{ agoLabel(r.t, now) }}</span>
      </div>
    </template>

    <template v-else>
      <div v-if="!attacks.length" class="ph-empty">ยังไม่ได้ออกบุกใครเลย — เลือกสักคนจากกระดานด้านบน</div>
      <div v-for="(r, i) in attacks" :key="'a' + i" class="ph-row">
        <span class="ph-who"><Emoji char="⚔️" /> บุก {{ r.name }}</span>
        <span class="ph-res" :class="r.won ? 'ok' : 'no'">{{ r.won ? 'ชนะ' : 'แพ้' }}</span>
        <span v-if="r.coin" class="ph-coin">+{{ r.coin.toLocaleString() }}<Emoji char="🪙" /></span>
        <span class="ph-ago">{{ agoLabel(r.t, now) }}</span>
      </div>
    </template>

    <div class="ph-note">เก็บ 5 รายการล่าสุดของแต่ละคน · ทั้งรุ่นเห็นประวัติของกันและกันได้</div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useMembersStore } from '../../stores/members.js'
import { myAttacks, defenseLog, agoLabel } from '../../utils/pvpHistory.js'

const auth = useAuthStore()
const members = useMembersStore()

const tab = ref('def')
const now = Date.now()   // แช่ไว้ตอน mount — ป้ายเวลาไม่ต้องเดินสด (เลี่ยง re-render ทั้งลิสต์)

const uid = computed(() => auth.currentUser?.uid)
const attacks = computed(() => myAttacks(members.rosterRows || {}, uid.value))
const defense = computed(() => defenseLog(members.rosterRows || {}, uid.value))
</script>

<style scoped>
.ph { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; margin-top: 14px; }
.ph-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.ph-title { font-size: .88rem; font-weight: 800; }
.ph-tabs { display: flex; gap: 6px; }
.ph-tab { border: 2px solid var(--ink); background: #fff; border-radius: 999px; padding: 4px 12px; font-family: inherit; font-weight: 800; font-size: .72rem; cursor: pointer; }
.ph-tab.on { background: var(--primary); color: #fff; }
.ph-row { display: flex; align-items: center; gap: 6px; padding: 7px 0; border-top: 1px dashed rgba(0,0,0,.12); font-size: .76rem; }
.ph-who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.ph-res { font-weight: 800; flex-shrink: 0; }
.ph-res.ok { color: #15803d; }
.ph-res.no { color: #b91c1c; }
.ph-coin { font-weight: 800; color: #b45309; flex-shrink: 0; }
.ph-ago { color: rgba(0,0,0,.45); font-size: .7rem; flex-shrink: 0; }
.ph-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .76rem; padding: 16px 8px; line-height: 1.6; }
.ph-note { margin-top: 10px; font-size: .7rem; color: rgba(0,0,0,.4); line-height: 1.5; }
</style>
```

- [ ] **Step 2: ต่อเข้า `ArenaView.vue`**

ใน `<template>` ต่อจาก `</div>` ที่ปิด `.ar-list` (ยังอยู่ใน `<template v-if="authStore.isLoggedIn">`):

```html
      <PvpHistory />
```

ใน `<script setup>` เพิ่ม import:

```js
import PvpHistory from '../components/battle/PvpHistory.vue'
```

- [ ] **Step 3: เติมไกด์**

ใน `src/data/guide.js` หัวข้อ `arena` เพิ่มเป็นบรรทัดสุดท้ายของ `body`:

```js
      'ท้ายหน้ามีประวัติ 2 แท็บ — "ตั้งรับ" คือคนที่มาบุกทีมเรา (เห็นได้แม้ตอนนั้นเราไม่ได้ออนไลน์) และ "เราไปบุก" คือผลที่เราไปตีคนอื่นมา เก็บ 5 รายการล่าสุด',
```

- [ ] **Step 4: บิลด์ + ตรวจฟอนต์**

```bash
npm run build
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```
Expected: build ผ่าน · grep ไม่เจออะไร

- [ ] **Step 5: Commit**

```bash
git add src/components/battle/PvpHistory.vue src/views/ArenaView.vue src/data/guide.js
git commit -m "PvP: กล่องประวัติ 2 แท็บท้ายหน้าสนาม (ตั้งรับ/เราไปบุก)"
```

---

## หลัง deploy — เทสจอจริง

1. บุกคนจริง 1 ครั้ง → แท็บ "เราไปบุก" ต้องขึ้นรายการทันที (ไม่ต้องรีโหลด)
2. รีโหลดหน้า → รายการยังอยู่ (ยืนยันว่าเขียนลง Firestore จริง ไม่ใช่แค่ state ในเครื่อง)
3. **เปลี่ยนชื่อเล่นที่หน้า Me แล้วกลับมา → ประวัติต้องยังอยู่** (เทสว่า Task 2 ทำงานจริง)
4. ให้เพื่อนบุกเรา → แท็บ "ตั้งรับ" ขึ้นชื่อเพื่อน และผลกลับด้านถูกต้อง
5. บุกบอท → **ต้องไม่มีรายการเพิ่ม**
