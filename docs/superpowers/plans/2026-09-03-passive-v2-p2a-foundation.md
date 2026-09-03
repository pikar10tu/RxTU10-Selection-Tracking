# พาสสีฟ v2 — P2a: ฐานสถาปัตยกรรม + กลไกตัวคูณ 8 ตัว Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** วางฐานที่กลไกใหม่ทั้งหมดของ P2 ต้องยืนบน (`unit.ps` · hook ใหม่ 2 ตัว · ช่อง `pierce` · กฎจังหวะเพ็ทหลาย part) แล้วลงกลไกตัวคูณล้วน 8 ตัว — **โดยผลไฟต์ของเพ็ท 27 ตัวที่มีอยู่ต้องเหมือนเดิมทุกไบต์**

**Architecture:** ทุกอย่างเป็น pure function ใน `src/utils/battlePassives.js` ตามแบบของเดิม · แตะ `battleEngine.js` แค่ 2 จุด (ต่อช่อง `pierce` เข้า `strike()` และเรียก `runOnAnyDeath`) · แตะ `battleBeats.js` 1 จุด (กฎจังหวะหลาย part) · ไม่มีเพ็ทตัวไหนถือกลไกใหม่ในแผนนี้ ⇒ พิสูจน์ความถูกต้องด้วย differential ว่าเกมไม่เปลี่ยน

**Tech Stack:** Vue 3 + Vite · ES modules ล้วน · เทสด้วย `node:test` เท่านั้น (ไม่มี framework อื่น) · ภาษาไทยทั้งโปรเจกต์

**สเปก:** `docs/superpowers/specs/2026-09-03-passive-v2-p2-engine-design.md` §2–§3 · สเปกแม่ `docs/superpowers/specs/2026-09-03-passive-v2-design.md` §4

## Global Constraints

- 🔒 **passive ห้ามเพิ่มจำนวน beat** — เพิ่มได้แค่ FX กับตัวเลข · `killChain` เป็นข้อยกเว้นเดียวและมีเพดาน
- 🔴 **ห้ามใช้ชื่อฟิลด์ `kind` ใน event** — ชนิดผลชื่อ `fxKind` เท่านั้น (`kind` เป็นของ `battleBeats` = เวลา · CLAUDE.md ข้อ 15)
- 🔴 **ห้ามแตะทะเบียน `PET_PASSIVES`** — แผนนี้ไม่เปลี่ยนเพ็ทสักตัว (เพ็ทเป็นงานของ P2c/P3)
- 🔴 **ผลไฟต์ต้องเหมือนเดิมทุกไบต์** — เงื่อนไขผ่านของ Task 10 · ทุก task ก่อนหน้าต้องไม่ทำให้มันแดง
- 🎲 **สุ่มทุกจุดต้องใช้ `rand` ที่เอนจินส่งมา** — ห้ามใช้ `Math.random()` (รีเพลย์ต้องตรงกับผลจริง)
- 📝 **ห้ามพิมพ์ตัวเลขลง `desc`/`short`** — ใส่ `{pct}` `{count}` … แล้วให้ `passiveText()` เติม
- ✅ **เทสทั้งรีโปต้องผ่านครบทุกงานย่อย** — ปัจจุบัน **993 ผ่าน** · รัน `node --test $(find src -name "*.test.js")`
- ✅ **`npm run build` ต้องผ่าน** ก่อน commit ทุกครั้ง
- 🧪 **เพ็ทสังเคราะห์ในเทสต้องขึ้นต้นด้วย `__`** และลบทิ้งใน `finally` เสมอ — แพทเทิร์นที่ไฟล์เทสใช้อยู่แล้ว
  (`__two`, `__mix`, `__dual`, `__blank__`) · ห้ามใช้ชื่อธรรมดาอย่าง `lion`/`boar` เพราะ **P3 จะเพิ่มเพ็ทจริงชื่อพวกนี้**
  แล้วเทสจะไปทับทะเบียนจริงเงียบๆ
- 📌 commit เป็นไทย รูปแบบ `Area: อะไร (ทำไม)`
- 🚫 **ห้าม `git push`** — ผู้ใช้เป็นคน push เอง

## File Structure

| ไฟล์ | หน้าที่ | งานย่อยที่แตะ |
|---|---|---|
| `src/utils/battlePassives.js` | ตรรกะพาสสีฟทั้งหมด (pure) | 1, 2, 3, 4, 5, 7, 8, 9 |
| `src/utils/battlePassives.test.js` | เทสตรรกะพาสสีฟ (มีอยู่แล้ว 993 เคสรวมทั้งรีโป) | 1, 2, 3, 4, 5, 7, 8, 9 |
| `src/utils/battleEngine.js` | ต่อท่อ `pierce` + เรียก `runOnAnyDeath` (2 จุดเท่านั้น) | 3, 5 |
| `src/utils/battleBeats.js` | กฎจังหวะของเพ็ทหลาย part | 6 |
| `src/utils/battleBeats.test.js` | เทสจังหวะ (มีอยู่แล้ว) | 6 |
| `src/data/petPassives.js` | เพิ่ม `STATUS_ICON`/`STATUS_TEXT` ของ effect ใหม่ 8 ตัว | 9 |
| `scripts/battle-differential.mjs` (สร้างใหม่) | เครื่องมือพิสูจน์ว่าเกมไม่เปลี่ยน | 10 |

**ไม่ต้องแตะ:** ไฟล์ `.vue` ทุกไฟล์ (ภาษาการเล่าเรื่องเป็นงานของ P2c) · `src/data/petPassives.js` ส่วนทะเบียน 27 ตัว

---

### Task 1: ล้างของค้างจาก P1

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit` guardian ~บรรทัด 236-250 · `runOnDeath` saveAlly ~บรรทัด 310-316 · `runOnDeath` onDeath ~บรรทัด 291 · `runOnHit` res ~บรรทัด 235)
- Test: `src/utils/battlePassives.test.js:322-334` (เคส `upgradable`)

**Interfaces:**
- Consumes: `partsAt`, `partAt` จาก `src/data/petPassives.js` (มีอยู่แล้ว)
- Produces: `runOnHit()` ไม่คืนฟิลด์ `absorber` อีกต่อไป — ไม่มีใครอ่านอยู่แล้ว

รายการที่ §10/§2.5 ของสเปกจดไว้ ทั้งหมดไม่เปลี่ยนพฤติกรรม (วันนี้ทุกตัวมี part เดียว) แต่เป็นกับดักของ P2

- [ ] **Step 1: เขียนเทสที่กันการถอยหลัง**

เพิ่มท้าย `src/utils/battlePassives.test.js`:

```js
test('guardian: ต้องหาจาก hook onHit ไม่ใช่ effect-first (กันเจอ part ผิดตอนเพ็ทมีหลาย part)', () => {
  // เพ็ทสังเคราะห์: guardian อยู่บน hook อื่นมาก่อน แล้วค่อยมีตัวจริงบน onHit
  const fake = {
    name: 'ทดสอบ', icon: '🧪',
    parts: [
      { hook: 'onRound', effect: 'guardian', value: { pct: 99 } },
      { hook: 'onHit', effect: 'guardian', value: { pct: 50 } },
    ],
  }
  const g = { uid: 'A0', side: 'A', id: '__fake', hp: 100, maxHp: 100, atk: 10 }
  const d = { uid: 'A1', side: 'A', id: 'blank', hp: 40, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  PET_PASSIVES.__fake = fake
  try {
    const res = runOnHit(d, 100, att, [g, d], () => 0.99)
    // ต้องได้ 50% (ตัวจริงบน onHit) ไม่ใช่ 99% ของ part แรกที่ effect ตรง
    assert.equal(Math.round(res.dmg), 50)
  } finally { delete PET_PASSIVES.__fake }
})

test('runOnHit ไม่คืนฟิลด์ absorber อีกแล้ว (เอนจินไม่เคยอ่าน = โค้ดตาย)', () => {
  const d = { uid: 'A0', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const res = runOnHit(d, 100, att, [d], () => 0.5)
  assert.equal('absorber' in res, false)
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL 2 เคส
- เคสแรกได้ `100` ไม่ใช่ `50` — โค้ดเดิมเจอ part แรกที่ effect ตรง (อันที่อยู่บน `onRound`) แล้วเช็ค
  `gpart.hook !== 'onHit'` จึง `continue` ทิ้งทั้งตัว ⇒ **guardian ไม่ทำงานเลยทั้งที่มี part ที่ถูกต้องอยู่**
- เคสที่สองเจอฟิลด์ `absorber` ในผลลัพธ์

- [ ] **Step 3: แก้ทั้ง 4 จุด**

ใน `src/utils/battlePassives.js` `runOnHit` — บรรทัดแรกของฟังก์ชัน ตัด `absorber` ออก:

```js
  const res = { dmg, dodged: false, thorns: 0, events: [] }
```

ในลูป guardian เปลี่ยนจาก `partWithEffect` เป็นการหาในลิสต์ของ hook ที่ถูกต้อง:

```js
  for (const g of alive(team)) {
    const gp = passiveFor(g)
    const gpart = partsAt(gp, 'onHit').find(x => x.effect === 'guardian')
    if (!gpart || g === defender) continue
```

ใน `runOnDeath` ลูป saveAlly:

```js
    const gpart = partsAt(gp, 'onDeath').find(x => x.effect === 'saveAlly')
    if (!gpart) continue
```

เหนือ `partAt(p, 'onDeath')` ใน `runOnDeath` เติมคอมเมนต์อธิบายว่าทำไมเป็น part เดียว:

```js
  // onDeath มี part เดียวโดยธรรมชาติ: กันตายได้ครั้งเดียวต่อการตายหนึ่งครั้ง
  // ถ้าวันหนึ่งมีเพ็ทที่ revive + cheatDeath พร้อมกัน ต้องเปลี่ยนเป็น partsAt แล้วนิยามลำดับก่อน
  const part = partAt(p, 'onDeath')
```

- [ ] **Step 4: แก้เทส `upgradable` ให้กลับมานับ "ตัวเพ็ท" ไม่ใช่ "part"**

ใน `src/utils/battlePassives.test.js:322-334` เปลี่ยนตัวนับให้เก็บ id:

```js
  const upgradable = new Set()
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const part of partsOf(p)) {
      const lo = passiveValueAt(part, 1)
      const hi = passiveValueAt(part, PASSIVE_MAX_LEVEL)
      // นับเฉพาะตัวที่ "อัพขั้นแล้วเลขขยับจริง" — มี step เป็นบวกอย่างเดียวไม่พอ
      // (step ที่คำนวณแล้วไม่ขยับ = หินอัพขั้นไม่ให้อะไรเลย ซึ่งเป็นบั๊กที่เทสนี้มีไว้จับ)
      if (Object.keys(hi).some(k => typeof hi[k] === 'number' && hi[k] > lo[k])) upgradable.add(id)
    }
  }
  assert.ok(upgradable.size >= 20, `เพ็ทที่อัพขั้นแล้วเลขขยับมีแค่ ${upgradable.size} ตัว`)
```

🔴 **ต้องคงการเทียบขั้น 1 กับขั้นสูงสุดไว้** — ของเดิมเช็คว่า "อัพแล้วเลขขยับจริง" ถ้าเปลี่ยนเป็น
นับแค่ `step` ที่เป็นบวก เทสจะผ่านทั้งที่หินอัพขั้นไม่ให้อะไรเลย = ลดความครอบคลุมของเทสเดิม
ซึ่งขัดกับข้อบังคับของแผนเอง · ที่เปลี่ยนคือ**หน่วยที่นับ** (ตัวเพ็ท ไม่ใช่ part) เท่านั้น

- [ ] **Step 5: รันเทสทั้งรีโป**

Run: `node --test $(find src -name "*.test.js")`
Expected: fail 0 · จำนวนเทสเพิ่มเป็น 995
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: ล้างของค้าง P1 (หา part จาก hook ที่ถูก + ลบ absorber ที่ไม่มีใครอ่าน)"
```

---

### Task 2: `unit.ps` — ที่เก็บ state ของพาสสีฟ

**Files:**
- Modify: `src/utils/battlePassives.js` (เพิ่ม `psOf` ใต้ `pctOf` ~บรรทัด 16 · `runOnDeath` 3 จุดที่ใช้ `passiveUses` · `runOnKill` 2 จุดที่ใช้ `atkStacks`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `psOf(unit) -> object` — ก้อน state ของพาสสีฟ สร้างตอนอ่านครั้งแรก · คีย์ที่ใช้ในแผนนี้: `uses` (เดิม `unit.passiveUses`), `atkStacks` (เดิม `unit.atkStacks`), `rage` (Task 9)
- Consumes: —

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('psOf: สร้างก้อน state ตอนอ่านครั้งแรก และคืนก้อนเดิมทุกครั้งถัดไป', () => {
  const u = { uid: 'A0' }
  const a = psOf(u)
  a.foo = 1
  assert.equal(psOf(u).foo, 1)
  assert.equal(u.ps, a)
})

test('ตัวนับกันตายย้ายไปอยู่ใน ps.uses แล้ว (ไม่ใช่ฟิลด์ลอยบนตัวละคร)', () => {
  const cat = { uid: 'A0', side: 'A', id: 'cat', hp: 0, maxHp: 100, atk: 10 }
  const out = runOnDeath(cat, [cat])
  assert.equal(out.prevented, true)
  assert.equal(psOf(cat).uses, 1)
  assert.equal(cat.passiveUses, undefined)
})
```

เพิ่ม `psOf` เข้า import ของไฟล์เทส

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `psOf is not defined`

- [ ] **Step 3: เพิ่ม `psOf` แล้วย้ายของเดิม 2 ฟิลด์**

ใต้ `const pctOf = ...` ใน `src/utils/battlePassives.js`:

```js
/** state ของพาสสีฟระหว่างไฟต์ — สร้างตอนถูกอ่านครั้งแรก (ไม่ต้องแตะ buildCombatant)
 *  🔴 state ทุกกองต้องอยู่ในนี้ ห้ามแปะฟิลด์ลอยบนตัวละครอีก — ตัวละครมี atk/hp/uid/side/…
 *     อยู่แล้ว การเติมฟิลด์ปนเข้าไปคือบั๊กชื่อชนกันแบบเดียวกับ kind/fxKind (CLAUDE.md ข้อ 15)
 *  คีย์ที่ใช้: uses (กันตายไปแล้วกี่ครั้ง) · atkStacks (ชั้น stackAtk) · rage (ชั้น atkOnHit) */
export const psOf = (u) => (u.ps || (u.ps = {}))
```

ใน `runOnDeath` แทนที่ทั้ง 3 จุด (`revive`, `cheatDeath`, `saveAlly`):

```js
  // เดิม: (unit.passiveUses || 0)      →  psOf(unit).uses || 0
  // เดิม: unit.passiveUses = (unit.passiveUses || 0) + 1  →  psOf(unit).uses = (psOf(unit).uses || 0) + 1
```

ใน `runOnKill` `stackAtk`:

```js
      const st = psOf(killer)
      const stacks = st.atkStacks || 0
      if (stacks < v.max) {
        st.atkStacks = stacks + 1
        killer.atk *= 1 + v.pct / 100
        const e = ev(killer, p, part, { targets: [killer.uid], amount: st.atkStacks, fxKind: 'buff' })
```

- [ ] **Step 4: หาฟิลด์เก่าที่ค้าง**

Run: `grep -rn "passiveUses\|atkStacks" src/ scripts/`
Expected: เจอเฉพาะใน `ps.atkStacks` ที่เพิ่งเขียน — **ถ้าเจอ `unit.passiveUses` หรือ `killer.atkStacks` ที่ไหนอีกแปลว่าย้ายไม่ครบ**

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: รวม state ระหว่างไฟต์ไว้ที่ unit.ps (กันฟิลด์ลอยชนกันตอน P2)"
```

---

### Task 3: ช่อง `pierce` — ดาเมจที่ไม่ผ่านสายลด

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit` — ค่าเริ่มต้นของ `res`)
- Modify: `src/utils/battleEngine.js` (`strike()` ~บรรทัด 46)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runOnHit()` คืน `res.pierce` (number, ค่าเริ่มต้น 0) — ดาเมจที่เอนจินหักจากเป้า**หลังจาก**หัก `res.dmg` แล้ว ไม่ผ่าน guardian/dodge/damageReduction/thorns
- Consumes: `psOf` จาก Task 2

ในแผนนี้ยังไม่มีใครใส่ค่าให้ `pierce` (คนใส่คือ `infect` ใน P2b) — งานนี้คือวางท่อให้เสร็จและพิสูจน์ว่าท่อทำงาน

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('pierce: ค่าเริ่มต้นเป็น 0 เสมอ', () => {
  const d = { uid: 'A0', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  assert.equal(runOnHit(d, 100, att, [d], () => 0.5).pierce, 0)
})

// การพิสูจน์ว่า pierce "ทะลุ" จริง ต้องรอ P2b ที่มี infect เป็นตัวผลิตค่า
// (วันนี้ไม่มีโค้ดจริงสายไหนใส่ค่าให้ pierce ⇒ เทสที่เขียนตอนนี้จะได้แค่ทดสอบตัวเอง:
//  ตั้ง res.pierce = 30 เองแล้วเช็คว่าได้ 30 ซึ่งไม่ได้แตะโค้ดจริงเลย)
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `pierce` เป็น `undefined`

- [ ] **Step 3: เพิ่มช่องใน `runOnHit`**

```js
  // pierce = ดาเมจที่ "ไม่ผ่านสายลด" — เอนจินหักหลัง res.dmg · วันนี้มีแค่ infect (P2b) ที่ใส่ค่า
  // 🔴 ห้ามเอาไปใช้กับกลไกอื่นโดยไม่แก้สเปก: การทะลุเกราะคือเหตุผลที่ไวรัสมีอยู่
  //    ถ้าแจกให้ตัวอื่นด้วย มันจะกลายเป็นแค่ "ดาเมจเพิ่ม" อีกตัวหนึ่ง
  const res = { dmg, dodged: false, thorns: 0, pierce: 0, events: [] }
```

- [ ] **Step 4: ต่อท่อในเอนจิน**

ใน `src/utils/battleEngine.js` `strike()` เปลี่ยนบรรทัดหักเลือด:

```js
    tg.hp -= hitRes.dmg
    // ดาเมจทะลุ (infect) — หักหลังสายลดจบแล้ว จึงไม่โดน guardian/dodge/DR/เกราะ
    // ยังอยู่ใน beat เดิม และ attack event คิด dmg จาก before-after อยู่แล้ว หลอดเลือดจึงตรงเอง
    if (hitRes.pierce > 0) tg.hp -= hitRes.pierce
    if (hitRes.thorns > 0) att.hp -= hitRes.thorns
```

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Battle: เปิดช่อง pierce ใน runOnHit (รองรับดาเมจทะลุเกราะของ P2b)"
```

---

### Task 4: hook `setup` + กลไก `stealStats`

**Files:**
- Modify: `src/utils/battlePassives.js` (เพิ่ม `runSetup` เหนือ `applyAuras`)
- Modify: `src/utils/battleEngine.js` (~บรรทัด 32 ก่อน `applyAuras`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runSetup(team, foes) -> event[]` — รันก่อน `applyAuras` ทั้งหมด · แก้ `atk`/`maxHp`/`hp` ของทั้งสองฝั่งได้
- Consumes: `psOf`, `statsSnapshot`, `ev`, `alive`, `pctOf`

`stealStats` ✅ ค่าที่ user เคาะ: **5%** · ขโมย atk และ maxHp อย่างละ 5% จากศัตรู**ทุกตัว** และ **ศัตรูเสียจริง**

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('stealStats: ศัตรูเสียจริง และผู้ขโมยได้เพิ่มเท่ากับที่ขโมยมารวมกัน', () => {
  PET_PASSIVES.__thief = {
    name: 'ทดสอบขโมย', icon: '🧪',
    parts: [{ hook: 'setup', effect: 'stealStats', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ขโมย {pct}%', short: 'ขโมย {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__thief', hp: 100, maxHp: 100, atk: 50 }
    const f1 = { uid: 'B0', side: 'B', id: 'blank', hp: 200, maxHp: 200, atk: 30 }
    const f2 = { uid: 'B1', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 20 }
    const out = runSetup([me], [f1, f2])
    assert.equal(f1.atk, 27)                       // เสีย 10%
    assert.equal(f2.atk, 18)
    assert.equal(me.atk, 50 + 3 + 2)               // ได้ที่ขโมยมารวมกัน
    assert.equal(f1.maxHp, 180)
    assert.equal(f1.hp, 180)                       // เลือดปัจจุบันลดตามสัดส่วน ไม่ล้นหลอด
    assert.equal(me.maxHp, 100 + 20 + 10)
    assert.equal(out.length, 1)
    assert.equal(out[0].fxKind, 'buff')
  } finally { delete PET_PASSIVES.__thief }
})

test('stealStats: ไม่มีศัตรู = ไม่มี event ไม่ throw', () => {
  PET_PASSIVES.__thief = {
    name: 'ทดสอบขโมย', icon: '🧪',
    parts: [{ hook: 'setup', effect: 'stealStats', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ขโมย {pct}%', short: 'ขโมย {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__thief', hp: 100, maxHp: 100, atk: 50 }
    assert.deepEqual(runSetup([me], []), [])
    assert.equal(me.atk, 50)
  } finally { delete PET_PASSIVES.__thief }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `runSetup is not defined`

- [ ] **Step 3: เขียน `runSetup`**

วางเหนือหัวข้อ `aura` ใน `src/utils/battlePassives.js`:

```js
// ══════════════════════════════════════════════════════════════
//  setup — ก่อน aura ทุกอย่าง (แก้ atk/maxHp ดิบได้)
// ══════════════════════════════════════════════════════════════
/** ผลที่ต้องเกิด "ก่อน" ออร่า เพราะมันเปลี่ยนตัวเลขที่ออร่าจะไปคูณต่อ
 *  🔴 ต้องรันก่อน applyAuras เสมอ — ไม่งั้น statsSnapshot ที่ส่งให้รีเพลย์เป็นเลขก่อนขโมย
 *     แล้วเลขบนการ์ดกับดาเมจจริงจะคลาดกันเงียบๆ */
export function runSetup(team, foes) {
  const out = []
  for (const u of alive(team)) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'setup')) {
      const v = valOf(part, u)
      if (part.effect !== 'stealStats') continue
      const targets = alive(foes)
      if (!targets.length) continue
      let gotAtk = 0, gotHp = 0
      for (const f of targets) {
        const dAtk = pctOf(f.atk, v.pct)
        const dHp = pctOf(f.maxHp, v.pct)
        f.atk -= dAtk
        f.maxHp -= dHp
        f.hp = Math.min(f.hp, f.maxHp)      // เลือดปัจจุบันห้ามล้นหลอดที่หดลง
        gotAtk += dAtk
        gotHp += dHp
      }
      u.atk += gotAtk
      u.maxHp += gotHp
      u.hp += gotHp                          // ได้เลือดมาเต็มก้อนที่ขโมยได้
      const e = ev(u, p, part, { targets: targets.map(t => t.uid), amount: Math.round(gotAtk), fxKind: 'buff' })
      e.statsAfter = statsSnapshot(team, foes)
      out.push(e)
    }
  }
  return out
}
```

- [ ] **Step 4: ต่อท่อในเอนจิน**

ใน `src/utils/battleEngine.js` เหนือบรรทัด `const auraEvents = ...`:

```js
  // setup ต้องมาก่อน aura — stealStats เปลี่ยนเลขดิบที่ออร่าจะไปคูณต่อ
  for (const e of [...runSetup(A, B), ...runSetup(B, A)]) log.push(e)
```

แล้วเพิ่ม `runSetup` เข้า import ที่หัวไฟล์

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: hook setup + stealStats (ขโมยแล้วศัตรูเสียจริง ก่อนออร่าคิดเลข)"
```

---

### Task 5: hook `onAnyDeath`

**Files:**
- Modify: `src/utils/battlePassives.js` (เพิ่ม `runOnAnyDeath` ใต้ `runOnDeath`)
- Modify: `src/utils/battleEngine.js` (`strike()` หลังบล็อก `if (dead)`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runOnAnyDeath(dead, killerTeam, foes) -> event[]` — เรียกเมื่อมีใครตายจริง ยิงให้ทุกตัวที่ยังไม่ตายใน `killerTeam` ที่มี part บน hook `onAnyDeath`
- Consumes: `psOf` (Task 2) · `statsSnapshot`

ในแผนนี้ยังไม่มีเพ็ทตัวไหนใช้ hook นี้ (🦖 ทีเร็กซ์ย้ายมาใน P2c) — งานนี้คือวางกลไกให้พร้อม

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('onAnyDeath: ศัตรูล้มโดยใครก็ได้ ทุกตัวในทีมที่มี hook นี้ได้ชั้นเพิ่ม (ยึดเพดาน max)', () => {
  PET_PASSIVES.__scav = {
    name: 'ทดสอบซาก', icon: '🧪',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 10, max: 2 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้ม 1 ตัว +{pct}%', short: 'ล้ม 1 ตัว +{pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__scav', hp: 100, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: 'blank', hp: 0, maxHp: 100, atk: 10 }
    const e1 = runOnAnyDeath(dead, [me], [dead])
    assert.equal(e1.length, 1)
    assert.equal(Math.round(me.atk), 110)
    assert.equal(psOf(me).atkStacks, 1)
    runOnAnyDeath(dead, [me], [dead])
    assert.equal(psOf(me).atkStacks, 2)
    const e3 = runOnAnyDeath(dead, [me], [dead])      // ชนเพดานแล้ว
    assert.equal(e3.length, 0)
    assert.equal(psOf(me).atkStacks, 2)
  } finally { delete PET_PASSIVES.__scav }
})

test('onAnyDeath: ตัวที่ตายแล้วไม่ได้ชั้น', () => {
  PET_PASSIVES.__scav = {
    name: 'ทดสอบซาก', icon: '🧪',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 10, max: 3 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้ม 1 ตัว +{pct}%', short: 'ล้ม 1 ตัว +{pct}%',
  }
  try {
    const corpse = { uid: 'A0', side: 'A', id: '__scav', hp: 0, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: 'blank', hp: 0, maxHp: 100, atk: 10 }
    assert.deepEqual(runOnAnyDeath(dead, [corpse], [dead]), [])
    assert.equal(corpse.atk, 100)
  } finally { delete PET_PASSIVES.__scav }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `runOnAnyDeath is not defined`

- [ ] **Step 3: เขียน `runOnAnyDeath`**

ใต้ `runOnDeath` ใน `src/utils/battlePassives.js`:

```js
/** ใครสักคนตายจริงแล้ว — ยิงให้ทีมของ "ฝั่งที่ได้ประโยชน์" (ฝั่งตรงข้ามคนที่ตาย)
 *  ต่างจาก onKill ตรงที่ไม่สนว่าใครเป็นคนล้ม ⇒ 🦖 ได้ชั้นแม้เพื่อนเป็นคนเก็บ (P2c) */
export function runOnAnyDeath(dead, killerTeam, foes) {
  const out = []
  for (const u of alive(killerTeam)) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'onAnyDeath')) {
      const v = valOf(part, u)
      if (part.effect !== 'stackAtk') continue
      const st = psOf(u)
      const stacks = st.atkStacks || 0
      if (stacks >= v.max) continue
      st.atkStacks = stacks + 1
      u.atk *= 1 + v.pct / 100
      const e = ev(u, p, part, { targets: [u.uid], amount: st.atkStacks, fxKind: 'buff' })
      if (killerTeam && foes) e.statsAfter = statsSnapshot(killerTeam, foes)
      out.push(e)
    }
  }
  return out
}
```

- [ ] **Step 4: ต่อท่อในเอนจิน**

ใน `strike()` ของ `src/utils/battleEngine.js` — **หลัง** บล็อก `if (dead) { ... }` และ **ก่อน** `log.push({ t: 'attack', ... })`:

```js
    if (dead) {
      // ฝั่งที่ได้ประโยชน์คือทีมของผู้ตี — ไม่ว่าใครเป็นคนลงมือจริง
      const killerTeam = att.side === 'A' ? A : B
      for (const e of runOnAnyDeath(tg, killerTeam, foes)) log.push(e)
    }
```

เพิ่ม `runOnAnyDeath` เข้า import ที่หัวไฟล์

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: hook onAnyDeath (ศัตรูล้มโดยใครก็ได้ก็นับ — เตรียมไว้ให้ทีเร็กซ์)"
```

---

### Task 6: กฎจังหวะของเพ็ทหลาย part

**Files:**
- Modify: `src/utils/battleBeats.js:155-165` (บล็อกแจก kind ให้ passive)
- Test: `src/utils/battleBeats.test.js`

**Interfaces:**
- Consumes: `log` ที่มี event `passive` หลายใบจาก uid เดียวกันติดกัน
- Produces: `buildBeats()` แจก `skillQuiet` ให้ทุกใบในก้อนยกเว้นใบสุดท้าย ซึ่งได้ `skill` — **ก้อนเดียว = จังหวะเดียว**

จาก §2.4: ถ้าปล่อยตามโค้ดวันนี้ เพ็ท 3 part ที่ effect ไม่ซ้ำกันจะได้ `SKILL_PAUSE` 200ms × 3 = หยุด 600ms ติดกัน
และเพ็ทที่มีสอง part ใช้ effect เดียวกัน part ที่สองจะถูกลดเป็น `skillQuiet` เงียบหายไปเลย

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มใน `src/utils/battleBeats.test.js`:

```js
test('เพ็ทหลาย part ที่ยิงติดกัน = จังหวะเดียว (ใบสุดท้ายถือเวลาคนเดียว)', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'stackAtk' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'healLowestAlly' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.deepEqual([b[1].kind, b[2].kind, b[3].kind], ['skillQuiet', 'skillQuiet', 'skill'])
  const held = [b[1], b[2], b[3]].reduce((s, x) => s + x.timing.hitstop, 0)
  assert.equal(held, SKILL_PAUSE)      // รวมกันแล้วยังหยุดแค่ครั้งเดียว ไม่ใช่ 3 เท่า
})

test('สอง part ที่ effect เดียวกันของเพ็ทตัวเดียว ต้องไม่ถูกกลืนหายไปเงียบๆ', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.equal(b[2].kind, 'skill')     // ใบสุดท้ายของก้อนยังได้ประกาศ
})
```

เพิ่ม `SKILL_PAUSE` เข้า import ของไฟล์เทสถ้ายังไม่มี

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battleBeats.test.js`
Expected: FAIL เคสแรก — ได้ `['skill','skill','skill']` และ `held` = 600

- [ ] **Step 3: แก้บล็อกแจก kind**

ใน `src/utils/battleBeats.js` แทนที่ลูป `for (let i = openCut; ...)`:

```js
    // ที่เหลือ: ครั้งแรกของสกิลนั้นได้หยุดสั้นๆ · ครั้งซ้ำเงียบ · จังหวะเป็น-ตายได้โมเมนต์เต็ม
    // 🔑 เพ็ทตัวเดียวยิงหลาย part ติดกัน = "ก้อนเดียว" ⇒ ใบสุดท้ายของก้อนถือเวลาคนเดียว
    //    ที่เหลือ 0ms (แพทเทิร์นเดียวกับ openQuiet/openGroup ของยกแรก)
    //    ถ้าไม่ทำ เพ็ท 3 part จะได้ SKILL_PAUSE × 3 = หยุด 600ms ติดกันในจังหวะเดียว
    // ⚠️ คีย์ตัวดักซ้ำต้องมีลำดับ part ด้วย ไม่งั้นสอง part ที่ effect เดียวกัน
    //    ใบที่สองจะถูกลดเป็น skillQuiet แล้วหายไปเงียบๆ
    const seen = new Set()
    const seenInGroup = new Map()
    for (let i = openCut; i < evts.length; i++) {
      const e = evts[i]
      if (!e || e.t !== 'passive') continue
      const uid = e.uid || ''
      const nth = (seenInGroup.get(uid) || 0)
      seenInGroup.set(uid, nth + 1)
      const key = `${uid}:${e.effect || ''}:${nth}`
      const first = !seen.has(key)
      seen.add(key)
      const next = evts[i + 1]
      const lastOfGroup = !(next && next.t === 'passive' && (next.uid || '') === uid)
      if (CLUTCH_EFFECTS.has(e.effect)) pKind.set(i, 'skillMoment')
      else if (!lastOfGroup) pKind.set(i, 'skillQuiet')
      else pKind.set(i, first ? 'skill' : 'skillQuiet')
    }
```

⚠️ `seenInGroup` นับ "ใบที่เท่าไรของ uid นี้ในไฟต์" — ทำให้ part ที่สองของเพ็ทเดียวกันมีคีย์ของตัวเอง
ไม่ถูกกลืนเป็นครั้งซ้ำของ part แรก

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/battleBeats.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: ล็อกลำดับ event ของเพ็ทหลาย part**

สเปก §2.4 ข้อ 3 บอกว่า "ลำดับใน `parts[]` = ลำดับบนจอ" แต่เทสเพ็ทหลาย part ที่มีอยู่
(`src/utils/battlePassives.test.js:403` เคส `'onRound: พาสสีฟที่มี 2 part ใน hook เดียวกัน ต้องทำงานครบทั้งคู่'`)
เช็คแค่ว่ามีครบด้วย `effects.includes(...)` ไม่ได้เช็คลำดับ

แทนที่สอง assert เดิม:

```js
    assert.ok(effects.includes('regenSelf'), 'part แรกไม่ทำงาน')
    assert.ok(effects.includes('healLowestAlly'), 'part ที่สองไม่ทำงาน')
```

ด้วยการล็อกลำดับไปเลย (ครอบคลุมกว่าเดิม — ยังเช็คว่าทำงานครบทั้งคู่อยู่):

```js
    // ลำดับใน parts[] = ลำดับที่ event โผล่บนจอ — เป็นสัญญาในสเปก §2.4 ต้องมีเทสกัน
    assert.deepEqual(effects, ['regenSelf', 'healLowestAlly'])
```

- [ ] **Step 6: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
⚠️ ถ้าเทสจังหวะเดิมแดง **ห้ามแก้ค่าคาดหวังของเทสเดิม** — ให้กลับมาดูว่าตรรกะก้อนผิดตรงไหน

- [ ] **Step 7: Commit**

```bash
git add src/utils/battleBeats.js src/utils/battleBeats.test.js src/utils/battlePassives.test.js
git commit -m "Beats: เพ็ทหลาย part ยิงติดกันนับเป็นจังหวะเดียว (กันหยุด 200ms คูณจำนวน part)"
```

---

### Task 7: กลไก aura 3 ตัว

**Files:**
- Modify: `src/utils/battlePassives.js` (`applyAuras` — เพิ่ม 3 case)
- Modify: `src/utils/battlePassives.js` (`STAT_EFFECTS` — เพิ่ม `elementTrinity`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `applyAuras(team, foes)` (มีอยู่แล้ว)
- Produces: ฟิลด์ใหม่บนตัวละครที่ `runOnHit` จะอ่านใน Task 9 — `u.teamDrPct` (number, %) และ `u.lifestealPct` (number, %)

| effect | สูตร | ค่าตั้งต้น |
|---|---|---|
| `elementTrinity` | ทีมมีครบ ✊✌️✋ → ทั้งทีม atk +`pct`% และ maxHp +`hpPct`% | 8 / 8 |
| `teamLifesteal` | เพื่อนทุกตัวได้ `lifestealPct` += `pct` (ใช้จริงตอนตีใน Task 9) | 8 |
| `teamDamageReduction` | ทั้งทีม `teamDrPct` += `pct` · **เจ้าของได้อีกรอบ (2 เท่า)** | 10 (เจ้าของ 20) ✅user |

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('elementTrinity: ครบ 3 สายถึงจะติด ขาดสายเดียวไม่ได้อะไรเลย', () => {
  PET_PASSIVES.__lion = {
    name: 'ทดสอบสิงโต', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'elementTrinity', value: { pct: 8, hpPct: 8 }, step: { pct: 0, hpPct: 0 } }],
    desc: 'ครบสาย +{pct}%', short: 'ครบสาย +{pct}%',
  }
  try {
    const mk = (uid, el) => ({ uid, side: 'A', id: uid === 'A0' ? '__lion' : 'blank', element: el, hp: 100, maxHp: 100, atk: 100 })
    const full = [mk('A0', 'fist'), mk('A1', 'scissors'), mk('A2', 'paper')]
    applyAuras(full, [])
    assert.equal(Math.round(full[1].atk), 108)
    assert.equal(Math.round(full[1].maxHp), 108)

    const partial = [mk('A0', 'fist'), mk('A1', 'fist'), mk('A2', 'paper')]
    applyAuras(partial, [])
    assert.equal(partial[1].atk, 100)
  } finally { delete PET_PASSIVES.__lion }
})

test('teamDamageReduction: ทีมได้ pct · เจ้าของได้สองเท่า', () => {
  PET_PASSIVES.__shell = {
    name: 'ทดสอบกระดอง', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'teamDamageReduction', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ทีมลด {pct}%', short: 'ทีมลด {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__shell', hp: 100, maxHp: 100, atk: 10 }
    const mate = { uid: 'A1', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    applyAuras([me, mate], [])
    assert.equal(mate.teamDrPct, 10)
    assert.equal(me.teamDrPct, 20)
  } finally { delete PET_PASSIVES.__shell }
})

test('teamLifesteal: แปะ % ให้ทุกคนในทีมรวมเจ้าของ', () => {
  PET_PASSIVES.__bat = {
    name: 'ทดสอบค้างคาว', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'teamLifesteal', value: { pct: 8 }, step: { pct: 0 } }],
    desc: 'ทีมดูด {pct}%', short: 'ทีมดูด {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__bat', hp: 100, maxHp: 100, atk: 10 }
    const mate = { uid: 'A1', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    applyAuras([me, mate], [])
    assert.equal(me.lifestealPct, 8)
    assert.equal(mate.lifestealPct, 8)
  } finally { delete PET_PASSIVES.__bat }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL ทั้ง 3 เคส (ค่ายังไม่ขยับ / ฟิลด์เป็น `undefined`)

- [ ] **Step 3: เพิ่ม 3 case ใน `applyAuras`**

ใน `switch (part.effect)` ของ `applyAuras`:

```js
        case 'elementTrinity': {
          // ต้องครบทั้ง 3 สายในทีมที่ยังไม่ตาย — ขาดสายเดียวไม่ได้อะไรเลย (all-or-nothing โดยตั้งใจ)
          const els = new Set(alive(team).map(t => t.element))
          if (els.size < 3) break
          for (const t of team) {
            t.atk *= (1 + v.pct / 100)
            t.maxHp *= (1 + v.hpPct / 100)
            t.hp = t.maxHp
          }
          break
        }
        case 'teamLifesteal':
          // แปะ % ไว้บนตัวละคร — ใช้จริงตอนตีใน runOnHit (ที่นั่นเท่านั้นที่รู้ดาเมจจริง)
          for (const t of team) t.lifestealPct = (t.lifestealPct || 0) + v.pct
          break
        case 'teamDamageReduction':
          for (const t of team) t.teamDrPct = (t.teamDrPct || 0) + v.pct
          // เจ้าของได้อีกรอบ = 2 เท่า · บวกนอกลูปไม่ใช่ special-case ในลูป เพราะถ้ามีเจ้าของสองตัวในทีมเดียว
          // การเช็คในลูปจะนับซ้ำผิดตัว (แบบนี้: เจ้าของได้ 3×pct เพื่อนได้ 2×pct ซึ่งถูกต้อง)
          u.teamDrPct = (u.teamDrPct || 0) + v.pct
          break
```

แล้วเติม `elementTrinity` เข้า `STAT_EFFECTS` (มันขยับ atk/maxHp จริง จึงต้องแบก `statsAfter` ไปให้รีเพลย์):

```js
const STAT_EFFECTS = new Set(['teamHp', 'teamAtk', 'teamAtkPerElement', 'stackAtk', 'elementTrinity'])
```

- [ ] **Step 4: รันเทสให้ผ่าน + ทั้งรีโป + build**

Run: `node --test src/utils/battlePassives.test.js` → PASS
Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: ออร่าใหม่ 3 ตัว ครบสาย/ดูดเลือดทีม/ลดดาเมจทีม (ยังไม่มีเพ็ทถือ)"
```

---

### Task 8: กลไก `onAttack` 3 ตัว

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnAttack` — เพิ่ม 2 case: `berserk`, `giantSlayer`)
- Modify: `src/utils/battlePassives.js` (`runOnHit` — `healOnAttack` ของ**ผู้ตี**)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `runOnAttack(att, target, foes, rand)` · `runOnHit(defender, dmg, attacker, team, rand)`
- Produces: `res.atkMult` ที่คูณเพิ่มจาก `berserk`/`giantSlayer` · `runOnHit` คืน `res.events` ที่มีการฟื้นเลือดของ `healOnAttack`

| effect | สูตร | ค่าตั้งต้น |
|---|---|---|
| `berserk` | ดาเมจ +`pct`% ต่อทุก **10% ของเลือดที่หายไป** (เลือด 40% = หาย 60% = 6 ขั้น) | 6 |
| `giantSlayer` | ดาเมจ +`pct`% ต่อทุก **10% ที่ maxHp เป้าสูงกว่า maxHp ตัวเอง** · เพดาน `max`% | 5 · เพดาน 50 |
| `healOnAttack` | เมื่อตี ฟื้นเลือดเพื่อนที่บอบช้ำสุด `pct`% **ของดาเมจที่ทำได้จริง** | 12 |

🔴 `healOnAttack` เขียน `hook: 'onAttack'` ในข้อมูล (มุมผู้เล่น: "เมื่อฉันตี") แต่**คำนวณใน `runOnHit`**
เพราะที่นั่นเท่านั้นที่รู้ดาเมจจริงหลังหักทุกอย่าง — ต้องเขียนคอมเมนต์กำกับไว้ ไม่งั้นคนอ่าน `runOnAttack`
จะหาไม่เจอแล้วนึกว่าลืมทำ

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('berserk: ยิ่งเลือดหายยิ่งแรง นับเป็นขั้นละ 10%', () => {
  PET_PASSIVES.__boar = {
    name: 'ทดสอบหมูป่า', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'berserk', value: { pct: 6 }, step: { pct: 0 } }],
    desc: 'เลือดหายยิ่งแรง +{pct}%', short: 'เลือดหายยิ่งแรง +{pct}%',
  }
  try {
    const tg = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    const full = { uid: 'A0', side: 'A', id: '__boar', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(runOnAttack(full, tg, [tg], () => 0.5).atkMult, 1)          // เลือดเต็ม = ไม่ได้อะไร
    const hurt = { uid: 'A0', side: 'A', id: '__boar', hp: 40, maxHp: 100, atk: 10 }
    const r = runOnAttack(hurt, tg, [tg], () => 0.5)
    assert.equal(Math.round(r.atkMult * 100) / 100, 1.36)                    // หาย 60% = 6 ขั้น × 6%
    assert.equal(r.events.length, 1)
  } finally { delete PET_PASSIVES.__boar }
})

test('giantSlayer: เป้าตัวใหญ่กว่ายิ่งแรง แต่ชนเพดาน', () => {
  PET_PASSIVES.__badger = {
    name: 'ทดสอบแบดเจอร์', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'giantSlayer', value: { pct: 5, max: 50 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้มยักษ์ +{pct}%', short: 'ล้มยักษ์ +{pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__badger', hp: 100, maxHp: 100, atk: 10 }
    const small = { uid: 'B0', side: 'B', id: 'blank', hp: 80, maxHp: 80, atk: 10 }
    assert.equal(runOnAttack(me, small, [small], () => 0.5).atkMult, 1)      // เป้าเล็กกว่า = ไม่ได้อะไร
    const big = { uid: 'B1', side: 'B', id: 'blank', hp: 130, maxHp: 130, atk: 10 }
    assert.equal(Math.round(runOnAttack(me, big, [big], () => 0.5).atkMult * 100) / 100, 1.15)  // 3 ขั้น
    const huge = { uid: 'B2', side: 'B', id: 'blank', hp: 500, maxHp: 500, atk: 10 }
    assert.equal(Math.round(runOnAttack(me, huge, [huge], () => 0.5).atkMult * 100) / 100, 1.5) // ชนเพดาน
  } finally { delete PET_PASSIVES.__badger }
})

test('healOnAttack: ฟื้นเพื่อนที่บอบช้ำสุดตามดาเมจจริงที่ทำได้', () => {
  PET_PASSIVES.__uni = {
    name: 'ทดสอบยูนิคอร์น', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'healOnAttack', value: { pct: 12 }, step: { pct: 0 } }],
    desc: 'ตีแล้วฟื้นเพื่อน {pct}%', short: 'ตีแล้วฟื้นเพื่อน {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__uni', hp: 100, maxHp: 100, atk: 10 }
    const hurt = { uid: 'A1', side: 'A', id: 'blank', hp: 50, maxHp: 100, atk: 10 }
    const tg = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(tg, 100, me, [tg], () => 0.5, [me, hurt])
    assert.equal(hurt.hp, 62)                       // 12% ของดาเมจ 100
    assert.ok(res.events.some(e => e.effect === 'healOnAttack'))
  } finally { delete PET_PASSIVES.__uni }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL ทั้ง 3 เคส

- [ ] **Step 3: เพิ่ม 2 case ใน `runOnAttack`**

```js
      case 'berserk': {
        // ขั้นละ 10% ของเลือดที่หายไป — ปัดลง (เลือด 40% = หาย 60% = 6 ขั้น)
        const steps = Math.floor((1 - att.hp / att.maxHp) * 10)
        if (steps > 0) {
          res.atkMult *= 1 + (steps * v.pct) / 100
          res.events.push(ev(att, p, part, { targets: [att.uid], amount: steps, fxKind: 'buff' }))
        }
        break
      }
      case 'giantSlayer': {
        // ขั้นละ 10% ที่ maxHp ของเป้าสูงกว่าเรา · เพดานที่ v.max
        if (!target) break
        const steps = Math.floor((target.maxHp / att.maxHp - 1) * 10)
        if (steps > 0) {
          const pct = Math.min(steps * v.pct, v.max)
          res.atkMult *= 1 + pct / 100
          res.events.push(ev(att, p, part, { targets: [target.uid], amount: Math.round(pct), fxKind: 'buff' }))
        }
        break
      }
```

- [ ] **Step 4: เพิ่ม `healOnAttack` ใน `runOnHit`**

เปลี่ยน signature ให้รับทีมของผู้ตีเข้ามา (พารามิเตอร์สุดท้าย ค่าเริ่มต้น `null` เพื่อไม่ให้จุดเรียกเดิมพัง):

```js
export function runOnHit(defender, dmg, attacker, team, rand, attTeam = null) {
```

ท้ายฟังก์ชัน ก่อน `return res`:

```js
  // ── ผลของ "ผู้ตี" ที่ต้องรู้ดาเมจจริงถึงจะคิดได้ ──
  // 🔴 hook ในข้อมูลคือ onAttack (มุมผู้เล่น: "เมื่อฉันตี") แต่คำนวณที่นี่เพราะ runOnAttack
  //    ยังไม่รู้ดาเมจจริง — ใครอ่าน runOnAttack แล้วหา healOnAttack ไม่เจอ ให้มาดูตรงนี้
  const dealt = res.dmg + res.pierce
  if (attacker && dealt > 0 && attTeam) {
    const ap = passiveFor(attacker)
    for (const part of partsAt(ap, 'onAttack')) {
      if (part.effect !== 'healOnAttack') continue
      const t = lowestHpAlly(attTeam, attacker)
      if (!t || t.hp >= t.maxHp) continue
      const before = t.hp
      t.hp = Math.min(t.maxHp, t.hp + pctOf(dealt, valOf(part, attacker).pct))
      const amount = Math.round(t.hp - before)
      if (amount > 0) {
        res.events.push(ev(attacker, ap, part, { targets: [t.uid], amount,
          hpPct: Math.round((t.hp / t.maxHp) * 100), fxKind: 'heal' }))
      }
    }
  }
```

- [ ] **Step 5: ส่งทีมผู้ตีเข้ามาจากเอนจิน**

ใน `src/utils/battleEngine.js` `strike()`:

```js
    const attTeam = att.side === 'A' ? A : B
    const hitRes = runOnHit(tg, Math.max(0, mult), att, foes, rand, attTeam)
```

- [ ] **Step 6: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 7: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: berserk/giantSlayer/healOnAttack (ยังไม่มีเพ็ทถือ)"
```

---

### Task 9: `atkOnHit` + ป้ายของ effect ใหม่ทั้ง 8 ตัว

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit` — case `atkOnHit` + การหัก `teamDrPct`)
- Modify: `src/data/petPassives.js` (`STATUS_ICON` · `STATUS_TEXT` · `SELF_STATUS_EFFECTS` · `TEAM_AURA_EFFECTS`)
- Test: `src/utils/battlePassives.test.js` · `src/data/petPassives.test.js`

**Interfaces:**
- Consumes: `u.teamDrPct` จาก Task 7 · `psOf` จาก Task 2
- Produces: `STATUS_ICON`/`STATUS_TEXT` ครบทุก effect ที่ P2 เพิ่ม — มินิชิปใน P2c อ่านจากตรงนี้

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('atkOnHit: โดนตีทีนึง atk เพิ่มถาวร ไม่มีเพดาน (user ยืนยัน)', () => {
  PET_PASSIVES.__gori = {
    name: 'ทดสอบกอริลลา', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } }],
    desc: 'โดนตีแล้วแรงขึ้น {pct}%', short: 'โดนตีแล้วแรงขึ้น {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__gori', hp: 100, maxHp: 100, atk: 100 }
    const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    for (let i = 0; i < 3; i++) runOnHit(me, 10, att, [me], () => 0.5)
    assert.equal(psOf(me).rage, 3)
    assert.equal(Math.round(me.atk), 109)            // 100 × 1.03³
  } finally { delete PET_PASSIVES.__gori }
})

test('teamDamageReduction: หักเป็นทอดกับ damageReduction ของตัวเอง ไม่ใช่บวก %', () => {
  const d = { uid: 'A0', side: 'A', id: 'turtle', hp: 100, maxHp: 100, atk: 10, teamDrPct: 20 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  // 🐢 turtle มี damageReduction 12% ของตัวเองอยู่แล้ว ⇒ 100 × 0.8 × 0.88 = 70.4
  const res = runOnHit(d, 100, att, [d], () => 0.5)
  assert.equal(Math.round(res.dmg * 10) / 10, 70.4)
})
```

และใน `src/data/petPassives.test.js`:

```js
test('effect ใหม่ของ P2 ต้องมีไอคอนและคำอธิบายป้ายครบ (มินิชิปใน P2c อ่านจากตรงนี้)', () => {
  for (const k of ['elementTrinity', 'teamLifesteal', 'teamDamageReduction', 'atkOnHit',
                   'berserk', 'giantSlayer', 'healOnAttack', 'stealStats']) {
    assert.ok(STATUS_ICON[k], `${k} ไม่มีไอคอน`)
    assert.ok(STATUS_TEXT[k], `${k} ไม่มีคำอธิบายป้าย`)
  }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js src/data/petPassives.test.js`
Expected: FAIL ทั้ง 3 เคส

- [ ] **Step 3: เพิ่มการหัก `teamDrPct` และ case `atkOnHit` ใน `runOnHit`**

**ก่อน** ลูป `for (const part of partsAt(p, 'onHit'))` (หลังบล็อก guardian):

```js
  // ลดดาเมจของออร่าทีม — หักก่อน แล้ว damageReduction ของตัวเองหักต่อเป็นทอด
  // (ไม่ใช่บวก % กัน: 20% + 12% ≠ 32% แต่เป็น ×0.8×0.88 = ลดจริง 29.6%)
  if (defender.teamDrPct > 0) res.dmg -= pctOf(res.dmg, defender.teamDrPct)
```

ใน `switch (part.effect)` ของลูป `onHit`:

```js
      case 'atkOnHit': {
        // ไม่มีเพดานโดยตั้งใจ (user ยืนยัน) — P4 ต้องรายงานว่าในไฟต์ยาวมันบานแค่ไหน
        const st = psOf(defender)
        st.rage = (st.rage || 0) + 1
        defender.atk *= 1 + v.pct / 100
        const e = ev(defender, p, part, { targets: [defender.uid], amount: st.rage, fxKind: 'buff' })
        e.statsAfter = statsSnapshot(team)
        res.events.push(e)
        break
      }
```

- [ ] **Step 4: เพิ่มป้ายของ effect ใหม่ใน `src/data/petPassives.js`**

```js
export const STATUS_ICON = {
  teamHp: '❤️', teamAtk: '⚔️', teamAtkPerElement: '⚔️', teamCrit: '💥', enemyVuln: '🎯',
  guardian: '🛡️', damageReduction: '🧱', dodge: '💨', thorns: '⚡',
  revive: '🧿', saveAlly: '🧿', cheatDeath: '🧿', stackAtk: '⬆️',
  duoRegen: '💧',
  // ── P2 ──
  elementTrinity: '🔺', teamLifesteal: '🩸', teamDamageReduction: '🧱', atkOnHit: '💢',
  berserk: '🔥', giantSlayer: '🗡️', healOnAttack: '💞', stealStats: '🫳',
}

export const STATUS_TEXT = {
  teamHp: 'เลือดสูงสุดเพิ่ม', teamAtk: 'พลังโจมตีเพิ่ม', teamAtkPerElement: 'พลังโจมตีเพิ่ม',
  teamCrit: 'โอกาสคริติคอลเพิ่ม', enemyVuln: 'รับดาเมจเพิ่ม',
  guardian: 'มีเพื่อนรับแทนให้', damageReduction: 'ลดดาเมจที่ได้รับ', dodge: 'มีโอกาสหลบ',
  thorns: 'ตีแล้วเจ็บกลับ', revive: 'ตายแล้วฟื้นคืนชีพได้ 1 ครั้ง', saveAlly: 'กันเพื่อนตายได้ 1 ครั้ง',
  cheatDeath: 'รอดตายด้วยเลือด 1 ได้ 1 ครั้ง', stackAtk: 'ยิ่งฆ่ายิ่งแรง',
  duoRegen: 'ทีมฟื้นเลือดทุกรอบ',
  // ── P2 ──
  elementTrinity: 'ทีมครบสายจึงแรงขึ้น', teamLifesteal: 'ตีแล้วดูดเลือด',
  teamDamageReduction: 'ทั้งทีมลดดาเมจที่ได้รับ', atkOnHit: 'ยิ่งโดนตียิ่งแรง',
  berserk: 'ยิ่งเลือดหายยิ่งแรง', giantSlayer: 'ยิ่งเป้าตัวใหญ่ยิ่งแรง',
  healOnAttack: 'ตีแล้วฟื้นเลือดเพื่อน', stealStats: 'ขโมยพลังจากศัตรู',
}
```

เติมกลุ่มให้ถูก:

```js
export const TEAM_AURA_EFFECTS = new Set(['teamHp', 'teamAtk', 'teamAtkPerElement', 'teamCrit',
  'elementTrinity', 'teamLifesteal', 'teamDamageReduction'])
export const SELF_STATUS_EFFECTS = new Set([
  'guardian', 'damageReduction', 'dodge', 'thorns', 'revive', 'saveAlly', 'cheatDeath', 'stackAtk',
  'atkOnHit', 'berserk', 'giantSlayer', 'stealStats',
])
```

- [ ] **Step 5: รันเทสทั้งรีโป + build**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/data/petPassives.js src/utils/battlePassives.test.js src/data/petPassives.test.js
git commit -m "Passive: atkOnHit + ลดดาเมจทีมหักเป็นทอด + ป้ายของ effect ใหม่ 8 ตัว"
```

---

### Task 10: พิสูจน์ว่าเกมไม่เปลี่ยนแม้แต่ไบต์เดียว

**Files:**
- Create: `scripts/battle-differential.mjs`
- Test: — (สคริปต์นี้คือเครื่องมือ ไม่ใช่เทสในสวีท)

**Interfaces:**
- Consumes: `simulateBattle` จากทั้งทรีปัจจุบันและ base tree · `PETS`, `PET_PASSIVES`, `BATTLE_SLOTS`
- Produces: `node scripts/battle-differential.mjs <base-sha>` → พิมพ์จำนวนไฟต์ที่ต่างกัน · exit 1 ถ้ามีสักไฟต์ที่ต่าง

นี่คือเงื่อนไขผ่านของทั้งแผน — ไม่มีเพ็ทตัวไหนถือกลไกใหม่ ⇒ **ผลไฟต์ต้องเหมือน base เป๊ะ**
(เทคนิคเดียวกับที่รีวิว P1 ใช้ยืนยันว่าการรื้อโครงไม่เปลี่ยนพฤติกรรม)

- [ ] **Step 1: เขียนสคริปต์**

```js
// battle-differential — พิสูจน์ว่า "เกมไม่เปลี่ยน" ด้วยการยิงไฟต์ล็อกซีดเทียบกับ base tree
//
// 🔑 ใช้ทุกครั้งที่แก้เอนจิน/พาสสีฟแล้วอ้างว่า "พฤติกรรมเหมือนเดิม" — แข็งแรงกว่า sim
//    เพราะเทียบ log ทีละไบต์ ไม่ใช่เทียบค่าเฉลี่ยที่กลบความต่างเล็กๆ ได้
//
// รัน: node scripts/battle-differential.mjs <base-sha>
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = process.argv[2]
if (!BASE) { console.error('ใส่ base sha ด้วย: node scripts/battle-differential.mjs <sha>'); process.exit(2) }

const dir = mkdtempSync(join(tmpdir(), 'rxtu-diff-'))
execSync(`git archive ${BASE} src | tar -x -C "${dir}"`, { stdio: 'inherit' })

const here = await import('../src/utils/battleEngine.js')
const base = await import(pathToFileURL(join(dir, 'src/utils/battleEngine.js')).href)
const { PETS } = await import('../src/data/index.js')
const { BATTLE_SLOTS } = await import('../src/data/residence.js')
const { PET_PASSIVES } = await import('../src/data/petPassives.js')

const ids = PETS.filter(p => PET_PASSIVES[p.id])
const mk = (p) => ({ id: p.id, rarity: p.rarity, element: p.element, grade: 3 })

let n = 0, bad = 0
const cmp = (A, B, seed) => {
  n++
  const a = here.simulateBattle(A, B, seed)
  const b = base.simulateBattle(A, B, seed)
  if (JSON.stringify({ w: a.winner, l: a.log }) !== JSON.stringify({ w: b.winner, l: b.log })) {
    bad++
    if (bad <= 3) console.error('ต่างกันที่ซีด', seed, A.map(x => x.id).join('+'), 'vs', B.map(x => x.id).join('+'))
  }
}

// ทุกคู่เพ็ท × 3 ซีด — ทีมเติมด้วย 🛡️ กับ 🧞 ให้ guardian/saveAlly ได้ทำงานด้วย
for (const p of ids) for (const q of ids) for (let s = 1; s <= 3; s++) {
  cmp([mk(p), mk(PETS.find(x => x.id === 'qilin')), mk(PETS.find(x => x.id === 'genie'))].slice(0, BATTLE_SLOTS),
      [mk(q), mk(PETS.find(x => x.id === 'qilin')), mk(PETS.find(x => x.id === 'genie'))].slice(0, BATTLE_SLOTS),
      s * 2654435761)
}
// 3v3 สุ่มอีก 400 ไฟต์ ให้เจอส่วนผสมที่ลูปคู่ไม่ครอบคลุม
let seed = 12345
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
for (let i = 0; i < 400; i++) {
  const team = () => Array.from({ length: BATTLE_SLOTS }, () => mk(ids[Math.floor(rnd() * ids.length)]))
  cmp(team(), team(), Math.floor(rnd() * 1e9))
}

rmSync(dir, { recursive: true, force: true })
console.log(`เทียบ ${n} ไฟต์ · ต่างกัน ${bad}`)
process.exit(bad === 0 ? 0 : 1)
```

- [ ] **Step 2: รันเทียบกับ base**

```bash
node scripts/battle-differential.mjs $(git merge-base master HEAD)
```

Expected: `เทียบ 2xxx ไฟต์ · ต่างกัน 0` และ exit code 0
⚠️ **ถ้าต่างแม้แต่ไฟต์เดียว = มีงานย่อยก่อนหน้าทำเกมเปลี่ยน** ให้ไล่จากซีดที่มันพิมพ์ออกมา
ห้าม "ปรับเทสให้ผ่าน" เด็ดขาด

- [ ] **Step 3: รันเทสทั้งรีโป + build อีกรอบ**

Run: `node --test $(find src -name "*.test.js")` → fail 0 (ควรได้ ~1,010 เคส)
Run: `npm run build` → ผ่าน

- [ ] **Step 4: Commit**

```bash
git add scripts/battle-differential.mjs
git commit -m "Tools: สคริปต์เทียบผลไฟต์กับ base ทีละไบต์ (เงื่อนไขผ่านของ P2a/P2b)"
```

---

## หลังจบ P2a

รายงานให้ user: จำนวนเทสที่ผ่าน · ผลของ `battle-differential` (ต้องเป็น 0) · แล้ว**รอไฟเขียวก่อนเขียนแผน P2b**
(`infect` / `taunt` / `armorStack`) — เขียนทีละเฟสตามกติกาเดิมของโปรเจกต์ เพราะ P2b ต้องรู้ก่อนว่า
`psOf` กับช่อง `pierce` หน้าตาจริงหลังลงมือเป็นยังไง
