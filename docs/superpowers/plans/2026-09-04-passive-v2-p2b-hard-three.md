# พาสสีฟ v2 — P2b: สามตัวยาก (`infect` · `taunt` · `armorStack`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลงกลไกสามตัวที่แตะท่อของเอนจินจริง — เชื้อที่ทะลุทุกเกราะ · การบังคับเป้า · เกราะที่กันทั้งหมัดแล้วสะท้อนคืน — **โดยผลไฟต์ของเพ็ท 27 ตัวที่มีอยู่ต้องเหมือนเดิมทุกไบต์** และใช้หนี้ที่ P2a ทิ้งไว้ให้หมด

**Architecture:** `infect` ใช้ช่อง `pierce` ที่ P2a วางไว้แล้ว (คิดใน `runOnHit` เพราะต้องรู้ทั้งเป้าและช่อง pierce) · `taunt` เป็นจุดเดียวที่แตะการเลือกเป้าใน `battleEngine.js` · `armorStack` คืนก้อนสะท้อนให้เอนจินไปยิงผ่าน `strike()` ปกติ เพื่อให้ดาเมจสะท้อนโดนสายลดตามสเปก · ไม่มีเพ็ทตัวไหนถือกลไกใหม่ในแผนนี้ (เพ็ทเป็นงาน P3) ⇒ พิสูจน์ด้วย `battle-differential` ว่าเกมไม่ขยับ

**Tech Stack:** Vue 3 + Vite · ES modules ล้วน · เทสด้วย `node:test` เท่านั้น · ภาษาไทยทั้งโปรเจกต์

**สเปก:** `docs/superpowers/specs/2026-09-03-passive-v2-p2-engine-design.md` §4 (กลไก) และ §7.4 (หนี้ที่ต้องใช้คืน)

## ฐานที่ยืนอยู่ (P2a ลงเสร็จแล้ว — `master` ที่ `18516b3`)

| ของที่มีให้ใช้แล้ว | ลายเซ็น / ที่อยู่ |
|---|---|
| ก้อน state ต่อตัว | `psOf(u)` → `{ uses, atkStacks, rage, … }` (`battlePassives.js:29`) |
| ช่องดาเมจทะลุ | `runOnHit()` คืน `res.pierce` · เอนจินหักหลัง `res.dmg` (**ยังไม่มีใครใส่ค่า — แผนนี้คือคนแรก**) |
| ผลฝั่งผู้ตี | `runOnDealt(attacker, attTeam, dealt)` (`battlePassives.js:341`) |
| ผลฝั่งผู้รับ | `runOnHit(defender, dmg, attacker, team, rand)` (`battlePassives.js:389`) — 5 พารามิเตอร์ |
| hook ใหม่ | `runSetup(team, foes)` · `runOnAnyDeath(dead, killerTeam, foes)` |
| กฎจังหวะ | ก้อน = event ของ uid เดียวกันที่ติดกัน · `OUT_OF_GROUP_EFFECTS` กันบางตัวออก |
| เครื่องพิสูจน์ | `node scripts/battle-differential.mjs <base>` → ต้องได้ `ต่างกัน 0` |

**เลขตั้งต้นก่อนเริ่ม: 1,027 เทสผ่าน · `npm run build` ผ่าน · differential เทียบ `18516b3` ได้ 0**

## Global Constraints

- 🔒 **passive ห้ามเพิ่มจำนวน beat** — `killChain` เป็นข้อยกเว้นเดียว · ดาเมจสะท้อนของ `armorStack` ต้องเป็น `sub: true` (อยู่ beat เดิม)
- 🔴 **ห้ามใช้ชื่อฟิลด์ `kind` ใน event** — ชนิดผลชื่อ `fxKind` เท่านั้น (CLAUDE.md ข้อ 15)
- 🔴 **ห้ามแตะทะเบียน `PET_PASSIVES`** — แผนนี้ไม่เปลี่ยนเพ็ทสักตัว
- 🔴 **ผลไฟต์ต้องเหมือนเดิมทุกไบต์** — `node scripts/battle-differential.mjs 18516b3` ต้องได้ `ต่างกัน 0` (งานย่อย 8 เป็นด่านสุดท้าย แต่ทุกงานย่อยก่อนหน้าต้องไม่ทำให้มันแดง)
- 🎲 **สุ่มทุกจุดต้องใช้ `rand` ที่เอนจินส่งมา** — ห้าม `Math.random()` (รีเพลย์ต้องตรงกับผลจริง)
- 🧪 **เพ็ทสังเคราะห์ในเทสขึ้นต้นด้วย `__`** และลบทิ้งใน `finally` เสมอ
- ✅ `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` ผ่าน
- 📌 commit เป็นไทย รูปแบบ `Area: อะไร (ทำไม)` · 🚫 **ห้าม `git push`**

## File Structure

| ไฟล์ | หน้าที่ | งานย่อยที่แตะ |
|---|---|---|
| `src/utils/battlePassives.js` | ตรรกะพาสสีฟทั้งหมด (pure) | 1, 2, 4, 5, 6, 7 |
| `src/utils/battlePassives.test.js` | เทสตรรกะพาสสีฟ | 1, 2, 4, 5, 6, 7 |
| `src/utils/battleEngine.js` | เลือกเป้า (`taunt`) · ยิงดาเมจสะท้อน · ส่ง `rand` ให้ `runOnAnyDeath` | 2, 3, 7 |
| `src/utils/battleBeats.js` | `OUT_OF_GROUP_EFFECTS` | 1 |
| `src/data/petPassives.js` | ป้ายของ effect ใหม่ 3 ตัว | 8 |
| `src/data/petPassives.test.js` | เทสความครบของป้าย | 8 |

**ไม่ต้องแตะ:** ไฟล์ `.vue` ทุกไฟล์ (ภาษาการเล่าเรื่องเป็นงาน P2c) · `scripts/passive-power-sim.mjs`

---

### Task 1: ใช้หนี้ที่ P2a ทิ้งไว้ (สเปก §7.4 ข้อ 2, 3, 7)

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnDealt` หัวฟังก์ชัน · `runOnHit` เคส `atkOnHit`)
- Modify: `src/utils/battleBeats.js` (`OUT_OF_GROUP_EFFECTS`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `psOf`, `runOnDealt`, `runOnHit` (มีอยู่แล้ว)
- Produces: `atkOnHit` สะสมเฉพาะเมื่อ **หมัดนั้นทำดาเมจได้จริง** — งานย่อย 2 (`armorStack`) พึ่งพฤติกรรมนี้

หนี้สามข้อ ทำก่อนเพราะข้อที่สามเปลี่ยนกติกาที่ `armorStack` ต้องเคารพ

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('runOnDealt: ผู้ตีที่ตายไปแล้ว (โดนหนามกลางบีต) ต้องไม่ดูดเลือดกลับมา', () => {
  const me = { uid: 'A0', side: 'A', id: '__blank__', hp: 0, maxHp: 100, atk: 10, lifestealPct: 50 }
  const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 50, maxHp: 100, atk: 10 }
  const out = runOnDealt(me, [me, mate], 100)
  assert.equal(me.hp, 0, 'ตัวที่ตายแล้วต้องไม่ฟื้นเอง')
  assert.deepEqual(out.events, [])
})

test('atkOnHit: หมัดที่ถูกหลบทั้งหมัด ไม่นับเป็น "โดนตี" จึงไม่สะสมชั้น', () => {
  PET_PASSIVES.__rage = {
    name: 'ทดสอบเดือด', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'dodge', value: { pct: 100 }, step: { pct: 0 } },
      { hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ {pct}%', short: 'ทดสอบ {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__rage', hp: 100, maxHp: 100, atk: 100 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(me, 100, att, [me], () => 0)     // rand 0 = หลบติดแน่นอน
    assert.equal(res.dmg, 0)
    assert.equal(psOf(me).rage, undefined, 'หลบได้แล้วยังสะสมชั้น = ผิดนิยาม "ทุกครั้งที่รับดาเมจ"')
    assert.equal(me.atk, 100)
  } finally { delete PET_PASSIVES.__rage }
})

test('atkOnHit: หมัดที่ดาเมจผ่านเข้ามาจริง ยังสะสมเหมือนเดิม', () => {
  const me = { uid: 'A0', side: 'A', id: '__rage2', hp: 100, maxHp: 100, atk: 100 }
  PET_PASSIVES.__rage2 = {
    name: 'ทดสอบเดือด2', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } }],
    desc: 'ทดสอบ {pct}%', short: 'ทดสอบ {pct}%',
  }
  try {
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    runOnHit(me, 50, att, [me], () => 0.99)
    assert.equal(psOf(me).rage, 1)
    assert.equal(Math.round(me.atk), 103)
  } finally { delete PET_PASSIVES.__rage2 }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL 2 เคส — เคสแรกเห็นผู้ตายฟื้นเลือด · เคสที่สองเห็น `rage` เป็น 1 ทั้งที่หลบได้

- [ ] **Step 3: การ์ดผู้ตีที่ตายแล้วใน `runOnDealt`**

บรรทัดแรกของฟังก์ชัน:

```js
export function runOnDealt(attacker, attTeam, dealt) {
  const out = { events: [] }
  // 🔴 ผู้ตีอาจตายไปแล้วระหว่างบีตนี้ (โดนหนามสวนตอน sub-hit ก่อนหน้า) — เอนจินไม่ได้เช็คเลือด
  //    ผู้ตีระหว่าง cleave/multiStrike · ถ้าปล่อยให้ teamLifesteal ทำงานต่อ มันจะดูดเลือดตัวเอง
  //    กลับขึ้นมาเกิน 0 โดยไม่เคยผ่าน runOnDeath = ฟื้นคืนชีพโดยไม่เคยตายอย่างเป็นทางการ
  if (!attacker || attacker.hp <= 0 || !attTeam || dealt <= 0) return out
```

(ถ้าฟังก์ชันมีการ์ดบางส่วนอยู่แล้ว ให้รวมเป็นบรรทัดเดียวนี้ ห้ามเช็คซ้ำสองที่)

- [ ] **Step 4: `atkOnHit` ย้ายออกมานอกลูป และเช็คว่าดาเมจผ่านจริง**

ลบเคส `atkOnHit` ออกจาก `switch (part.effect)` แล้วเขียนใหม่ **หลัง** ลูป `for (const part of partsAt(p, 'onHit'))` และ **หลัง** บรรทัด `res.dmg = Math.max(0, res.dmg)`:

```js
  // atkOnHit — ต้องรู้ผลสุดท้ายของสายลดก่อนถึงจะตอบได้ว่า "โดนตี" จริงไหม
  // 🔴 อยู่นอกลูปโดยตั้งใจ: ถ้าอยู่ในลูป ผลจะขึ้นกับ *ลำดับ part ในข้อมูล* — เพ็ทที่เขียน
  //    [damageReduction, dodge] จะสะสมชั้น ส่วน [dodge, damageReduction] จะไม่สะสม ทั้งที่หลบเหมือนกัน
  //    (สเปก §7.4 ข้อ 6 เตือนเรื่องลำดับ part ไว้แล้ว — ตรงนี้คือการถอดความขึ้นกับลำดับออกให้หมด)
  if (res.dmg > 0) {
    for (const part of partsAt(p, 'onHit')) {
      if (part.effect !== 'atkOnHit') continue
      const v = valOf(part, defender)
      const st = psOf(defender)
      st.rage = (st.rage || 0) + 1
      defender.atk *= 1 + v.pct / 100
      const e = ev(defender, p, part, { targets: [defender.uid], amount: st.rage, fxKind: 'buff' })
      e.statsAfter = statsSnapshot(team)
      res.events.push(e)
    }
  }
```

- [ ] **Step 5: กัน `teamLifesteal` ออกจากก้อนจังหวะ**

ใน `src/utils/battleBeats.js`:

```js
/** effect ที่ "ไม่ใช่สกิลของเพ็ทที่มันโผล่บน" จึงห้ามถูกกลืนเข้าก้อนจังหวะของเพ็ทตัวนั้น
 *  duoRegen = ของคู่หู 🐳🦭 แต่ยิงบนตัวผู้รับ
 *  teamLifesteal = ออร่าของ 🦇 แต่ยิงบนตัวที่ออกหมัด · ถ้าเพ็ทตัวเดียวมีทั้ง healOnAttack
 *    และ teamLifesteal สองใบจะติดกันบน uid เดียว แล้วกฎก้อนจะปิดเสียงใบแรกทิ้ง */
export const OUT_OF_GROUP_EFFECTS = new Set(['duoRegen', 'teamLifesteal'])
```

- [ ] **Step 6: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**

- [ ] **Step 7: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleBeats.js src/utils/battlePassives.test.js
git commit -m "Passive: ใช้หนี้ P2a — การ์ดผู้ตีที่ตายแล้ว + atkOnHit นับเฉพาะหมัดที่ดาเมจผ่าน (เลิกขึ้นกับลำดับ part)"
```

---

### Task 2: `armorStack` — เกราะที่กันทั้งหมัดแล้วสะท้อนคืน

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit` — เคสใหม่ · `res.reflect`)
- Modify: `src/utils/battleEngine.js` (`strike()` — ยิงก้อนสะท้อน)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `psOf` · `res.dmg` ก่อนถูกล้าง
- Produces: `runOnHit()` คืน `res.reflect` (number, ค่าเริ่มต้น 0) = ดาเมจดิบที่ต้องสะท้อนใส่**ศัตรูทุกตัวของผู้รับ** · เอนจินเป็นคนยิง ผ่าน `strike()` ปกติ (โดนสายลดของฝั่งตรงข้ามตามสเปก)

กติกาจากสเปก §4.3: เริ่มไฟต์มี `count` สแตค · โดนหมัด → กิน 1 สแตค **กันหมัดนั้นทั้งหมด** แล้วสะท้อน `pct`% ของดาเมจนั้นใส่ศัตรูทั้งหมด · หมดสแตคแล้วรับปกติ · ไม่มีการเติมระหว่างไฟต์ · ดาเมจสะท้อนหักลดตามปกติ (มีแค่ `infect` ที่ทะลุ) · ค่าตั้งต้น `{ count: 2, pct: 80 }` ✅user

🔴 **เกราะกันได้ก่อน `pierce`** — ดาเมจเชื้อยังเข้าแม้เกราะจะกันหมัดหลักไว้หมด (สเปก §4.3 บรรทัดสุดท้าย)

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('armorStack: กินสแตคแล้วกันทั้งหมัด + คืนก้อนสะท้อนให้เอนจิน', () => {
  PET_PASSIVES.__armor = {
    name: 'ทดสอบเกราะ', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'armorStack', value: { count: 2, pct: 80 }, step: { count: 0, pct: 0 } }],
    desc: 'เกราะ {count} ชั้น สะท้อน {pct}%', short: 'เกราะ {count} ชั้น',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__armor', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const r1 = runOnHit(me, 100, att, [me], () => 0.5)
    assert.equal(r1.dmg, 0, 'สแตคแรกต้องกันหมัดทั้งหมด')
    assert.equal(r1.reflect, 80)
    assert.equal(psOf(me).armor, 1)

    const r2 = runOnHit(me, 50, att, [me], () => 0.5)
    assert.equal(r2.dmg, 0)
    assert.equal(r2.reflect, 40)
    assert.equal(psOf(me).armor, 0)

    const r3 = runOnHit(me, 50, att, [me], () => 0.5)
    assert.equal(r3.dmg, 50, 'หมดสแตคแล้วต้องรับเต็ม')
    assert.equal(r3.reflect, 0)
  } finally { delete PET_PASSIVES.__armor }
})

test('armorStack: กันหมัดหลักได้ แต่กันดาเมจเชื้อไม่ได้ (pierce ทะลุเกราะ)', () => {
  PET_PASSIVES.__armor2 = {
    name: 'ทดสอบเกราะ2', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'armorStack', value: { count: 1, pct: 0 }, step: { count: 0, pct: 0 } }],
    desc: 'เกราะ {count} ชั้น', short: 'เกราะ {count} ชั้น',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__armor2', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(me, 100, att, [me], () => 0.5)
    res.pierce = 30                      // จำลองว่างานย่อย 6 ใส่ค่าให้ (เทสจริงอยู่ที่งานย่อย 6)
    assert.equal(res.dmg, 0)
    assert.equal(res.pierce, 30, 'เกราะต้องไม่แตะช่อง pierce')
  } finally { delete PET_PASSIVES.__armor2 }
})
```

⚠️ เคสที่สองตั้งค่า `pierce` เองเพื่อยืนยันว่า **โค้ดเกราะไม่ไปแตะช่องนั้น** ไม่ใช่เพื่อพิสูจน์ว่า pierce ทะลุ (อันนั้นเป็นงานย่อย 6 และต้องยิงผ่าน `simulateBattle`)

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `r1.dmg` เป็น 100 และ `reflect` เป็น `undefined`

- [ ] **Step 3: เพิ่มช่อง `reflect` และเคส `armorStack`**

แก้บรรทัด `res` ต้นฟังก์ชัน `runOnHit`:

```js
  const res = { dmg, dodged: false, thorns: 0, pierce: 0, reflect: 0, events: [] }
```

เพิ่มเคสใน `switch (part.effect)` ของลูป `onHit`:

```js
      case 'armorStack': {
        const st = psOf(defender)
        // เติมสแตคครั้งเดียวตอนโดนหมัดแรกของไฟต์ — ไม่มีการเติมซ้ำระหว่างไฟต์ (สเปก §4.3)
        if (st.armor === undefined) st.armor = v.count
        if (st.armor <= 0) break
        st.armor -= 1
        res.reflect = pctOf(res.dmg, v.pct)
        res.dmg = 0                                  // กันทั้งหมัด ไม่ใช่โล่ที่มีค่าเลือด
        res.events.push(ev(defender, p, part, { targets: [defender.uid],
          amount: st.armor, fxKind: 'guard' }))
        break
      }
```

- [ ] **Step 4: ให้เอนจินยิงก้อนสะท้อน**

ใน `strike()` ของ `src/utils/battleEngine.js` **หลัง** บรรทัดหัก `thorns` และ **ก่อน** `let dead = tg.hp <= 0`:

```js
    // เกราะสะท้อน — ใส่ศัตรูทุกตัวของผู้รับ ผ่าน strike() ปกติ (โดนสายลดของฝั่งนั้นตามสเปก)
    // 🔒 sub: true ⇒ อยู่ beat เดิม ไม่เพิ่มจังหวะ · reflecting กันไม่ให้เกราะฝั่งตรงข้ามสะท้อนกลับมาวนไม่รู้จบ
    if (hitRes.reflect > 0 && !reflecting) {
      reflecting = true
      const victims = alive(att.side === 'A' ? A : B)
      for (const v of victims) strike(tg, v, att.side === 'A' ? A : B, hitRes.reflect, { crit: false, eff: 'neutral' }, true)
      reflecting = false
    }
```

แล้วประกาศ flag ไว้เหนือ `strike` ในสโคปของ `simulateBattle`:

```js
  // กันเกราะสะท้อนชนกันไปมา: ระหว่างยิงก้อนสะท้อน ห้ามมีก้อนสะท้อนใหม่เกิดขึ้นอีกชั้น
  let reflecting = false
```

⚠️ พารามิเตอร์ที่สามของ `strike` คือ "ทีมของเป้า" — ตอนสะท้อน เป้าคือศัตรูของผู้รับ ทีมของเป้าจึงเป็นทีมของ `att`

- [ ] **Step 5: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`** (ไม่มีเพ็ทถือ `armorStack` ⇒ `reflect` เป็น 0 เสมอ)

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: armorStack กันทั้งหมัดแล้วสะท้อนใส่ศัตรูทุกตัว (ยังไม่มีเพ็ทถือ)"
```

---

### Task 3: `taunt` ตอนที่ 1 — ลำดับการเลือกเป้า

**Files:**
- Modify: `src/utils/battleEngine.js` (`pick()` → ฟังก์ชันเลือกเป้าที่มีลำดับ)
- Test: `src/utils/battlePassives.test.js` — `tauntTargetOf` เป็น pure function ที่อยู่ใน `battlePassives.js` เทสจึงอยู่ไฟล์เดียวกับมัน ไม่ต้องสร้างไฟล์เทสใหม่

**Interfaces:**
- Produces: `pickTarget(foes, rand) -> unit|null` — เลือกเป้าตามลำดับ `taunt` > `targetLowest` > สุ่ม

🔴 **นี่คือจุดเดียวใน P2b ที่แตะโค้ดที่ทุกไฟต์ในเกมวิ่งผ่าน** — differential คือด่านที่ต้องผ่านให้ได้

กติกาจากสเปก §4.2: ศัตรูทุกตัวที่ออกหมัดในรอบนั้นต้องตีมาที่กอริลลา · ลำดับ `taunt` > `targetLowest` > สุ่ม · กอริลลา 2 ตัวในทีมเดียว **เอาช่องซ้ายสุด** (ต้อง deterministic)

✅ **user เคาะ 4 ก.ย.: บากุ (`guardian`) รับแทนกอริลลาที่ท้าชนได้ตามกฎปกติ — เป็นคอมโบที่ตั้งใจ**
⇒ **งานย่อยนี้และงานย่อย 4 ห้ามเขียนโค้ดกันไม่ให้ `guardian` แทรกหมัดที่ถูกบังคับ** · ปล่อยสายเดิมทำงานตามปกติ

⚠️ `targetLowest` วันนี้อยู่ใน `runOnAttack` (เปลี่ยน `res.target` ทีหลัง) ไม่ได้อยู่ใน `pick()` — **ห้ามย้ายมันในงานย่อยนี้** เพราะจะทำให้ลำดับการดึง `rand` เปลี่ยน แล้ว differential แดงทั้งกระดาน · งานย่อยนี้ทำแค่ให้ `taunt` มาก่อน `pick()` แบบสุ่ม แล้ว `targetLowest` ยังทำงานทีหลังเหมือนเดิม (ถ้ามี `taunt` อยู่ `runOnAttack` ต้องไม่เปลี่ยนเป้า — ดูงานย่อย 4)

- [ ] **Step 1: แยกตัวเลือกเป้าออกมาเป็น pure function ใน `battlePassives.js`**

```js
/** ตัวที่ถูกบังคับให้เป็นเป้าในรอบนี้ (taunt) — คืน null ถ้าไม่มีใครบังคับ
 *  🔴 กอริลลา 2 ตัวในทีมเดียว = เอาช่องซ้ายสุดเสมอ · ต้อง deterministic ไม่งั้นรีเพลย์ไม่ตรงกับผลจริง
 *  🔴 ห้ามดึง rand ในฟังก์ชันนี้ — ลำดับการดึงสุ่มของเอนจินต้องไม่เปลี่ยน ไม่งั้นไฟต์เดิมทั้งเกมเพี้ยน */
export function tauntTargetOf(foes) {
  for (const u of alive(foes)) {
    const part = partsAt(passiveFor(u), 'onRound').find(x => x.effect === 'taunt')
    if (part) return u
  }
  return null
}
```

- [ ] **Step 2: เขียนเทส**

```js
test('tauntTargetOf: ไม่มีใครมี taunt คืน null (ไฟต์ปกติต้องไม่เปลี่ยนพฤติกรรม)', () => {
  const a = { uid: 'B0', side: 'B', id: 'turtle', hp: 100, maxHp: 100, atk: 10 }
  const b = { uid: 'B1', side: 'B', id: 'fox', hp: 100, maxHp: 100, atk: 10 }
  assert.equal(tauntTargetOf([a, b]), null)
})

test('tauntTargetOf: มีสองตัวเอาช่องซ้ายสุด และข้ามตัวที่ตายแล้ว', () => {
  PET_PASSIVES.__taunt = {
    name: 'ทดสอบท้าชน', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const dead = { uid: 'B0', side: 'B', id: '__taunt', hp: 0, maxHp: 100, atk: 10 }
    const left = { uid: 'B1', side: 'B', id: '__taunt', hp: 100, maxHp: 100, atk: 10 }
    const right = { uid: 'B2', side: 'B', id: '__taunt', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(tauntTargetOf([dead, left, right]), left)
  } finally { delete PET_PASSIVES.__taunt }
})
```

- [ ] **Step 3: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `tauntTargetOf is not defined`

- [ ] **Step 4: ต่อเข้าเอนจิน**

ใน `src/utils/battleEngine.js` แทนที่ `pick`:

```js
  // เลือกเป้า: ถูกบังคับ (taunt) มาก่อนเสมอ · ไม่งั้นสุ่มตามเดิม
  // 🔴 ต้องเช็ค taunt ก่อนเรียก rand() — ถ้าเรียก rand() แล้วค่อยทิ้งผล ลำดับสุ่มจะเลื่อนทั้งไฟต์
  const pick = (foes) => {
    const forced = tauntTargetOf(foes)
    if (forced) return forced
    const al = alive(foes)
    return al.length ? al[Math.floor(rand() * al.length)] : null
  }
```

- [ ] **Step 5: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**
⚠️ ถ้าอันนี้ไม่เป็น 0 แปลว่าลำดับการดึง `rand` เปลี่ยน — กลับไปดู Step 4 ว่าเรียก `rand()` เมื่อไม่มี `taunt` เท่านั้นจริงไหม

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Battle: taunt บังคับเป้าก่อนการสุ่ม (ยังไม่มีเพ็ทถือ ลำดับ rand เดิมไม่ขยับ)"
```

---

### Task 4: `taunt` ตอนที่ 2 — ลดดาเมจเฉพาะหมัดที่ถูกดึงมา

**Files:**
- Modify: `src/utils/battleEngine.js` (`hit()` — ส่ง flag ว่าหมัดนี้ถูกบังคับ)
- Modify: `src/utils/battlePassives.js` (`runOnAttack` ต้องไม่เปลี่ยนเป้าที่ถูกบังคับ · `runOnHit` รับ flag)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `tauntTargetOf` จากงานย่อย 3
- Produces: `runOnHit(defender, dmg, attacker, team, rand, forced = false)` — พารามิเตอร์ที่หกบอกว่าหมัดนี้มาจากผลบังคับ

⚠️ **นี่คือการเพิ่มพารามิเตอร์ที่ P2a เพิ่งตัดออกไป** — ยอมรับได้เพราะมันเป็นข้อมูล *ของหมัดนั้น* ไม่ใช่ทีมของใคร แต่ **ต้องมีค่า default และห้ามให้จุดเรียกเดิมพัง**

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('taunt: ลดดาเมจเฉพาะหมัดที่ถูกบังคับมา ไม่ใช่ทุกหมัด', () => {
  PET_PASSIVES.__taunt2 = {
    name: 'ทดสอบท้าชน2', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const me = { uid: 'B0', side: 'B', id: '__taunt2', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(runOnHit(me, 100, att, [me], () => 0.5, true).dmg, 75, 'หมัดที่ถูกดึงมาต้องลด 25%')
    assert.equal(runOnHit(me, 100, att, [me], () => 0.5, false).dmg, 100, 'หมัดที่เลือกเองต้องไม่ลด')
  } finally { delete PET_PASSIVES.__taunt2 }
})

test('runOnAttack: targetLowest ต้องไม่แย่งเป้าที่ถูก taunt บังคับไว้', () => {
  PET_PASSIVES.__taunt3 = {
    name: 'ทดสอบท้าชน3', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const gorilla = { uid: 'B0', side: 'B', id: '__taunt3', hp: 100, maxHp: 100, atk: 10 }
    const weak = { uid: 'B1', side: 'B', id: '__blank__', hp: 5, maxHp: 100, atk: 10 }
    const eagle = { uid: 'A0', side: 'A', id: 'simurgh', hp: 100, maxHp: 100, atk: 10 }
    const mod = runOnAttack(eagle, gorilla, [gorilla, weak], () => 0.5)
    assert.equal(mod.target, gorilla, 'taunt ต้องชนะ targetLowest ตามลำดับในสเปก')
  } finally { delete PET_PASSIVES.__taunt3 }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL ทั้งสองเคส (ยังไม่ลดดาเมจ · `targetLowest` ยังแย่งเป้าไปที่ `weak`)

- [ ] **Step 3: `runOnHit` รับ flag แล้วลดดาเมจ**

```js
export function runOnHit(defender, dmg, attacker, team, rand, forced = false) {
```

เพิ่มการหักไว้ **ก่อน** ลูป `onHit` และ **หลัง** `teamDrPct` (เป็นการลดของ "สถานการณ์" ไม่ใช่ของ part):

```js
  // taunt — ลดเฉพาะหมัดที่ถูกดึงมาหาเจ้าตัว ไม่ใช่ตลอดเวลา (สเปก §4.2)
  // flag มาจากเอนจินซึ่งเป็นคนรู้ว่าเป้าถูกบังคับหรือเลือกเอง — ห้ามให้ที่นี่เดาเอง
  if (forced) {
    const tp = partsAt(p0, 'onRound').find(x => x.effect === 'taunt')
    if (tp) res.dmg -= pctOf(res.dmg, valOf(tp, defender).pct)
  }
```

(ประกาศ `const p0 = passiveFor(defender)` ไว้ก่อนบล็อกนี้ แล้วให้ลูปด้านล่างใช้ตัวเดียวกัน ไม่ต้องเรียกซ้ำ)

- [ ] **Step 4: `runOnAttack` ต้องไม่แย่งเป้าที่ถูกบังคับ**

ในเคส `targetLowest` เติมการ์ดบรรทัดแรก:

```js
      case 'targetLowest': {
        if (tauntTargetOf(foes)) break        // ถูกบังคับอยู่ — ลำดับในสเปก: taunt > targetLowest
```

- [ ] **Step 5: เอนจินส่ง flag**

ใน `hit()` ของ `battleEngine.js` — จำไว้ว่าเป้าถูกบังคับหรือไม่ แล้วส่งต่อลงไปถึง `strike()`:

```js
  const hit = (att, foes) => {
    const forced = !!tauntTargetOf(foes)
    let tg = pick(foes)
    ...
```

แล้วเพิ่มพารามิเตอร์ `forced` ให้ `strike` และส่งต่อเข้า `runOnHit`
⚠️ **หมัดลูกของ cleave ที่ไปโดนตัวอื่น ไม่ใช่หมัดที่ถูกบังคับ** — ส่ง `false` ให้ `mod.extra` เสมอ

- [ ] **Step 6: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**

- [ ] **Step 7: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: taunt ลดดาเมจเฉพาะหมัดที่ถูกดึงมา + กัน targetLowest แย่งเป้า (ลำดับตามสเปก)"
```

---

### Task 5: `infect` ตอนที่ 1 — แปะเชื้อและเพดานชั้น

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit` — ฝั่งผู้ตีที่เป็นไวรัส)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `psOf(target).infect = { n, from }` — จำนวนชั้น + ตัวไวรัสที่แปะ (เก็บ ref ของ unit ไม่ใช่ uid เพราะต้องอ่าน `atk` ตอนระเบิด แม้ไวรัสจะตายแล้ว)

🔴 **`infect` เป็น effect เดียวที่อ่านพาสสีฟของ *ผู้ตี* ข้างใน `runOnHit`** — เพราะมันต้องเขียน state ของเป้า และงานย่อย 6 ต้องใช้ช่อง `pierce` ที่อยู่ในผลลัพธ์ของฟังก์ชันนี้ · `runOnDealt` ไม่รู้จักเป้า จึงทำที่นั่นไม่ได้ · ต้องเขียนคอมเมนต์กำกับไว้ ไม่งั้นคนอ่านจะงงว่าทำไมผลของผู้ตีมาโผล่ตรงนี้

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('infect: ไวรัสตีแล้วเป้าได้ชั้นเชื้อ ชนเพดานแล้วไม่เกิน', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    for (let i = 0; i < 7; i++) runOnHit(tgt, 10, virus, [tgt], () => 0.5)
    assert.equal(psOf(tgt).infect.n, 5, 'เพดาน 5 ชั้น')
    assert.equal(psOf(tgt).infect.from, virus)
  } finally { delete PET_PASSIVES.__virus }
})

test('infect: เพ็ทที่ไม่ใช่ไวรัสตี ไม่แปะเชื้อ', () => {
  const att = { uid: 'A0', side: 'A', id: 'turtle', hp: 100, maxHp: 100, atk: 100 }
  const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  runOnHit(tgt, 10, att, [tgt], () => 0.5)
  assert.equal(psOf(tgt).infect, undefined)
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `psOf(tgt).infect` เป็น `undefined`

- [ ] **Step 3: แปะเชื้อใน `runOnHit`**

วางไว้ **ท้ายฟังก์ชัน ก่อน `return res`** (แปะหลังจากสายลดจบแล้ว — การแปะไม่ขึ้นกับว่าหมัดทำดาเมจได้เท่าไร):

```js
  // ── ผลของ "ผู้ตี" ที่ต้องเขียน state ของเป้า ──
  // 🔴 infect เป็น effect เดียวที่อ่านพาสสีฟของผู้ตีในฟังก์ชันนี้ เพราะมันต้อง (1) เขียน ps ของเป้า
  //    และ (2) ใส่ค่าลงช่อง pierce ซึ่งอยู่ในผลลัพธ์ของ runOnHit · runOnDealt ไม่รู้จักเป้า จึงทำที่นั่นไม่ได้
  const ap = passiveFor(attacker)
  for (const part of partsAt(ap, 'onAttack')) {
    if (part.effect !== 'infect') continue
    const v = valOf(part, attacker)
    const st = psOf(defender)
    const cur = st.infect || { n: 0, from: attacker }
    if (cur.n < v.max) {
      st.infect = { n: cur.n + 1, from: attacker }
      res.events.push(ev(attacker, ap, part, { targets: [defender.uid],
        amount: st.infect.n, fxKind: 'debuff' }))
    } else {
      st.infect = cur
    }
  }
```

- [ ] **Step 4: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**

- [ ] **Step 5: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: infect แปะชั้นเชื้อพร้อมเพดาน (ยังไม่ระเบิด)"
```

---

### Task 6: `infect` ตอนที่ 2 — ระเบิดผ่าน `pierce` + ใช้หนี้เทสทะลุเกราะ

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnHit`)
- Test: `src/utils/battlePassives.test.js` (หน่วยย่อย) และ **เทสระดับ `simulateBattle`** (หนี้จากสเปก §7.4 ข้อ 1)

**Interfaces:**
- Consumes: `psOf(defender).infect` จากงานย่อย 5 · ช่อง `res.pierce`
- Produces: ดาเมจเชื้อไปทางช่อง `pierce` เท่านั้น

กติกา: เป้าที่ติดเชื้อถูกตีโดย**ใครก็ได้ในทีมไวรัส** (รวมไวรัสเอง) → `pierce += pct% × atk ของไวรัส × n` · **เชื้อไม่ลดตอนระเบิด** · ไวรัสตายแล้วยังทำงานต่อ (อ่าน `atk` จาก object เดิมได้)

- [ ] **Step 1: เขียนเทสหน่วยย่อย**

```js
test('infect: เพื่อนร่วมทีมไวรัสตี ก็ระเบิดเชื้อ และเชื้อไม่ลดลง', () => {
  const virus = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 100 }
  const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
  psOf(tgt).infect = { n: 3, from: virus }
  const res = runOnHit(tgt, 10, mate, [tgt], () => 0.5)
  assert.equal(res.pierce, 45, '15% ของ atk 100 × 3 ชั้น')
  assert.equal(psOf(tgt).infect.n, 3, 'เชื้อต้องไม่ลดตอนระเบิด')
})

test('infect: ศัตรูของไวรัสตีกันเอง ไม่ระเบิด', () => {
  const virus = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 100 }
  const foe = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
  psOf(tgt).infect = { n: 3, from: virus }
  assert.equal(runOnHit(tgt, 10, foe, [tgt], () => 0.5).pierce, 0)
})

test('infect: ไวรัสตายแล้วเชื้อยังระเบิดได้ (อ่าน atk จากตัวที่ตายแล้ว)', () => {
  const deadVirus = { uid: 'A0', side: 'A', id: '__blank__', hp: 0, maxHp: 100, atk: 100 }
  const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
  psOf(tgt).infect = { n: 2, from: deadVirus }
  assert.equal(runOnHit(tgt, 10, mate, [tgt], () => 0.5).pierce, 30)
})
```

⚠️ ค่า `pct` ในเทสสามข้อบนใช้ 15 ซึ่งเป็นค่าตั้งต้นจากสเปก — ถ้าโค้ดต้องอ่าน `pct` จากพาสสีฟของไวรัส ให้เทสลงทะเบียน `__virus` แบบงานย่อย 5 แล้วให้ `from` ชี้ไปที่ยูนิตที่ `id: '__virus'`

- [ ] **Step 2: เขียนเทสระดับ `simulateBattle` — หนี้ที่ P2a ค้างไว้**

นี่คือข้อที่สเปก §7.4 ข้อ 1 บังคับ: **พิสูจน์ว่าดาเมจเชื้อทะลุเกราะจริง ผ่านเอนจินเต็มใบ ไม่ใช่แค่ระดับฟังก์ชัน**

```js
test('infect ทะลุทุกเกราะจริง — ยิงผ่าน simulateBattle ไม่ใช่แค่ระดับฟังก์ชัน', () => {
  // ทีม A: ไวรัสล้วน · ทีม B: เต่า (damageReduction) + จิ้งจอก (dodge) + บากุ (guardian)
  // ถ้าเชื้อถูกหักโดยสายลด ดาเมจรวมที่ B เสียจะน้อยกว่าที่คำนวณไว้อย่างเห็นได้ชัด
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const A = [{ id: '__virus', rarity: 'legendary', element: 'fist', grade: 3 }]
    const B = [{ id: 'turtle', rarity: 'common', element: 'paper', grade: 3 }]
    const r = simulateBattle(A, B, 12345)
    const pierced = r.log.filter(e => e.t === 'passive' && e.effect === 'infect')
    assert.ok(pierced.length > 0, 'ต้องมี event เชื้อในไฟต์')
    // ยืนยันว่าดาเมจที่เป้าเสียมากกว่าดาเมจหมัดหลังหักลดเพียงอย่างเดียว
    // (คำนวณตัวเลขจริงตอนเขียนเทส แล้วปักเป็นค่าคงที่ พร้อมคอมเมนต์ว่ามาจากไหน)
  } finally { delete PET_PASSIVES.__virus }
})
```

⚠️ **ตัวเลขที่ปักต้องคำนวณจากการรันจริงแล้วอธิบายที่มาในคอมเมนต์** ห้ามปักเลขที่ได้จากการรันแล้วก๊อปมาเฉยๆ โดยไม่รู้ว่าทำไมเป็นค่านั้น — ถ้าอธิบายไม่ได้แปลว่ายังไม่เข้าใจสิ่งที่กำลังเทส

- [ ] **Step 3: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `res.pierce` ยังเป็น 0

- [ ] **Step 4: เขียนการระเบิด**

ในบล็อกที่งานย่อย 5 เพิ่มไว้ท้าย `runOnHit` — เพิ่มการระเบิด**ก่อน**การแปะ (เป้าที่ติดเชื้ออยู่แล้วระเบิดจากหมัดนี้ ส่วนชั้นใหม่จากหมัดนี้ค่อยขึ้นทีหลัง):

```js
  // ระเบิดเชื้อ — ใครก็ได้ในทีมไวรัสตี (รวมไวรัสเอง) · เชื้อไม่ลด · ไปทางช่อง pierce เท่านั้น
  const inf = psOf(defender).infect
  if (inf && inf.n > 0 && attacker && inf.from && attacker.side === inf.from.side) {
    const vp = passiveFor(inf.from)
    const vpart = partsAt(vp, 'onAttack').find(x => x.effect === 'infect')
    if (vpart) {
      const vv = valOf(vpart, inf.from)
      res.pierce += pctOf(inf.from.atk, vv.pct) * inf.n
      res.events.push(ev(inf.from, vp, vpart, { targets: [defender.uid],
        amount: Math.round(res.pierce), fxKind: 'damage' }))
    }
  }
```

- [ ] **Step 5: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: infect ระเบิดผ่านช่อง pierce + เทสทะลุเกราะระดับ simulateBattle (ใช้หนี้ P2a)"
```

---

### Task 7: `infect` ตอนที่ 3 — ส่งต่อเชื้อตอนตัวติดเชื้อล้ม

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnAnyDeath` — เพิ่มพารามิเตอร์ `rand`)
- Modify: `src/utils/battleEngine.js` (ส่ง `rand` เข้าไป)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runOnAnyDeath(dead, killerTeam, foes, rand)` — พารามิเตอร์ที่สี่ใหม่ · `dead` ที่เดิมไม่ได้ใช้ ตอนนี้ได้ใช้จริง (เป็นศพที่ต้องโยนเชื้อออกไป)

กติกา: ตัวติดเชื้อล้ม → โยนชั้นทั้งหมดไปศัตรูตัวอื่น **สุ่ม 1 ตัว** ด้วย `rand` ของเอนจิน · ยึดเพดาน 5

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('infect: ตัวติดเชื้อล้ม เชื้อย้ายไปเพื่อนของมันแบบ deterministic และไม่เกินเพดาน', () => {
  const virus = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 100 }
  const dead = { uid: 'B0', side: 'B', id: '__blank__', hp: 0, maxHp: 100, atk: 10 }
  const alive1 = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const alive2 = { uid: 'B2', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  psOf(dead).infect = { n: 4, from: virus }
  psOf(alive2).infect = { n: 3, from: virus }
  runOnAnyDeath(dead, [virus], [dead, alive1, alive2], () => 0.99)   // 0.99 = ตัวท้ายสุด
  assert.equal(psOf(alive2).infect.n, 5, 'รวมแล้วยึดเพดาน 5')
  assert.equal(psOf(dead).infect, undefined, 'ศพต้องไม่ถือเชื้อต่อ')
})

test('infect: ไม่มีศัตรูเหลือให้ย้าย ก็ไม่ throw', () => {
  const virus = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 100 }
  const dead = { uid: 'B0', side: 'B', id: '__blank__', hp: 0, maxHp: 100, atk: 10 }
  psOf(dead).infect = { n: 2, from: virus }
  runOnAnyDeath(dead, [virus], [dead], () => 0.5)
  assert.equal(psOf(dead).infect, undefined)
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — เชื้อยังค้างอยู่ที่ศพ

- [ ] **Step 3: เขียนการส่งต่อ**

ต้นฟังก์ชัน `runOnAnyDeath` (ก่อนลูป `stackAtk` เดิม):

```js
export function runOnAnyDeath(dead, killerTeam, foes, rand) {
  const out = []

  // ส่งต่อเชื้อ — ศพยังแพร่ต่อได้ 1 ทอด สุ่มไปเพื่อนของมันที่ยังไม่ตาย
  // 🎲 ใช้ rand ของเอนจินเท่านั้น (รีเพลย์ต้องตรงกับผลจริง) · ยึดเพดานเดิมของเชื้อ
  const inf = dead && dead.ps && dead.ps.infect
  if (inf && inf.n > 0 && typeof rand === 'function') {
    const others = alive(foes || []).filter(u => u !== dead)
    if (others.length) {
      const to = others[Math.floor(rand() * others.length)]
      const vpart = partsAt(passiveFor(inf.from), 'onAttack').find(x => x.effect === 'infect')
      const cap = vpart ? valOf(vpart, inf.from).max : inf.n
      const cur = psOf(to).infect
      psOf(to).infect = { n: Math.min(cap, (cur ? cur.n : 0) + inf.n), from: inf.from }
    }
    delete psOf(dead).infect
  }
```

- [ ] **Step 4: เอนจินส่ง `rand`**

ใน `strike()` ของ `battleEngine.js`:

```js
      for (const e of runOnAnyDeath(tg, killerTeam, foes, rand)) log.push(e)
```

- [ ] **Step 5: รันเทสทั้งรีโป + build + differential**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**
⚠️ ถ้าแดง: การส่ง `rand` เข้าไปต้องไม่ทำให้มีการ *ดึง* `rand()` เพิ่มในไฟต์ที่ไม่มีเชื้อ — เช็คว่าการดึงอยู่ใต้ `if (inf...)` จริง

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/utils/battlePassives.test.js
git commit -m "Passive: เชื้อย้ายไปเพื่อนของศพแบบสุ่มด้วย rand ของเอนจิน (ยึดเพดานเดิม)"
```

---

### Task 8: ป้ายของกลไกใหม่ + ปิดงาน

**Files:**
- Modify: `src/data/petPassives.js` (`STATUS_ICON` · `STATUS_TEXT` · `SELF_STATUS_EFFECTS` / กลุ่มใหม่สำหรับ debuff)
- Test: `src/data/petPassives.test.js`

**Interfaces:**
- Consumes: เทสความครบของป้ายที่ P2a เขียนไว้ (เช็คทั้งไอคอน ข้อความ และการอยู่ในกลุ่มพอดีหนึ่งกลุ่ม)

⚠️ **`infect` เป็น debuff ที่ลงบน *ศัตรู*** ต่างจากทุกตัวที่ผ่านมา — ป้ายต้องไปโผล่บนตัวที่ติดเชื้อ ไม่ใช่บนไวรัส
ดู `FOE_AURA_EFFECTS` ว่าใช้ซ้ำได้ไหม ถ้าไม่ได้ให้เพิ่มกลุ่มใหม่แล้วอัปเดตเทสความครบให้ครอบคลุมกลุ่มนั้นด้วย

- [ ] **Step 1: เพิ่มป้าย 3 ตัว**

```js
  // ── P2b ──
  infect: '🦠', taunt: '💢', armorStack: '🛡️',
```

```js
  infect: 'ติดเชื้อ ยิ่งโดนตียิ่งเจ็บ', taunt: 'บังคับให้ศัตรูตีตัวเอง', armorStack: 'มีเกราะกันหมัดเต็มใบ',
```

⚠️ `taunt` ใช้ 💢 ซ้ำกับ `atkOnHit` ที่ P2a ใส่ไว้ — **ตรวจก่อนแล้วเลือกไอคอนที่ไม่ซ้ำ** (ป้ายสองอันหน้าตาเดียวกันบนการ์ดเดียวกันคือของที่ผู้เล่นอ่านไม่ออก)

- [ ] **Step 2: อัปเดตเทสความครบให้รวม 3 ตัวใหม่**

เพิ่ม `'infect'`, `'taunt'`, `'armorStack'` ลงลิสต์ในเทส `'effect ใหม่ของ P2 ต้องมีไอคอน…'` และเพิ่ม assert ว่าไอคอนของทุก effect **ไม่ซ้ำกัน**:

```js
test('ไอคอนป้ายต้องไม่ซ้ำกัน (ป้ายสองอันหน้าตาเดียวกันบนการ์ดเดียว = อ่านไม่ออก)', () => {
  const seen = new Map()
  for (const [k, icon] of Object.entries(STATUS_ICON)) {
    if (seen.has(icon)) assert.fail(`${k} ใช้ไอคอน ${icon} ซ้ำกับ ${seen.get(icon)}`)
    seen.set(icon, k)
  }
})
```

⚠️ เทสตัวนี้อาจแดงกับของเดิม (`revive`/`saveAlly`/`cheatDeath` ใช้ 🧿 เหมือนกันโดยตั้งใจ · `teamAtk`/`teamAtkPerElement` ใช้ ⚔️) — ถ้าแดง **ห้ามแก้ไอคอนของเดิม** ให้ทำลิสต์ยกเว้นที่มีคอมเมนต์อธิบายว่าทำไมกลุ่มนั้นตั้งใจใช้ไอคอนเดียวกัน

- [ ] **Step 3: รันครบทุกด่าน**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 18516b3` → **`ต่างกัน 0`**
Run: `node scripts/passive-power-sim.mjs 1500` → อันดับต้องเหมือนเดิมทุกตัว (ไม่มีเพ็ทถือกลไกใหม่ ⇒ ห้ามขยับ)

- [ ] **Step 4: Commit**

```bash
git add src/data/petPassives.js src/data/petPassives.test.js
git commit -m "Passive: ป้ายของ infect/taunt/armorStack + เทสกันไอคอนซ้ำ"
```

---

## หลังจบ P2b

รายงานให้ user: จำนวนเทสที่ผ่าน · ผล `battle-differential` (ต้องเป็น 0) · แล้วรอไฟเขียวก่อนเขียนแผน **P2c**
(ขยายเพ็ทเดิม 8 ตัว + ภาษาการเล่าเรื่องในรีเพลย์) ซึ่งเป็นเฟสแรกของ P2 ที่ผู้เล่นจะเห็นความเปลี่ยนแปลงจริง

**หนี้ที่ P2b ยังส่งต่อไป P2c** (จากสเปก §7.4): แก้ `runOnKill` ที่ยิงซ้ำ — ⚠️ **ห้ามลบบรรทัดท้ายทิ้งเฉยๆ**
เพราะการฆ่าที่ปิดไฟต์ไม่เคยเข้าลูป `while` · ต้องรวมสองจุดเป็นการเรียกครั้งเดียว + มีเทสเจาะจงที่หมัดปิดเกม
