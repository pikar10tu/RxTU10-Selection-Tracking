# พาสสีฟ v2 — P2c-1: ใช้หนี้เอนจิน + ขยายเพ็ทเดิม 8 ตัว Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดหนี้เอนจินสองข้อที่ P2a/P2b ทิ้งไว้ แล้วเปลี่ยนกลไกของเพ็ท 8 ตัวที่ผู้เล่นถืออยู่จริง — **นี่คือเฟสแรกของ P2 ที่เกมเปลี่ยนจริง**

**Architecture:** งานย่อย 1–2 แก้เอนจิน/จังหวะ (กระทบทุกไฟต์) · งานย่อย 3–8 แก้ทีละเพ็ทโดยแยก commit ต่อตัว เพื่อให้ย้อนกลับทีละตัวได้ถ้า P4 ไม่ชอบ · งานย่อย 9 วัดผลรวมด้วย sim แล้วรายงาน

**Tech Stack:** Vue 3 + Vite · ES modules ล้วน · เทสด้วย `node:test` เท่านั้น · ภาษาไทยทั้งโปรเจกต์

**สเปก:** `docs/superpowers/specs/2026-09-03-passive-v2-p2-engine-design.md` §5 (เพ็ท 8 ตัว) · §7.4/§7.5 (หนี้) · สเปกแม่ §4.4

## 🔴 เงื่อนไขผ่านของแผนนี้ต่างจาก P2a/P2b โดยสิ้นเชิง

P2a และ P2b พิสูจน์ตัวเองด้วย **"ไฟต์ต้องเหมือนเดิมทุกไบต์"** เพราะไม่มีเพ็ทตัวไหนถือกลไกใหม่
**แผนนี้ตั้งใจให้เกมเปลี่ยน** ⇒ `battle-differential` จะไม่เป็น 0 อีกต่อไป และนั่นถูกต้องแล้ว

เงื่อนไขใหม่: **ทุกงานย่อยต้องพิสูจน์ว่าไฟต์ที่เปลี่ยน คือไฟต์ที่มีเพ็ทที่งานนั้นแตะเท่านั้น**
งานย่อย 1 จะขยาย `battle-differential` ให้รายงานว่าไฟต์ที่ต่างมีเพ็ทตัวไหนร่วมอยู่บ้าง เพื่อให้เช็คข้อนี้ได้จริง

## Global Constraints

- 🔒 **passive ห้ามเพิ่มจำนวน beat** — `killChain` เป็นข้อยกเว้นเดียว · หมัดสวนของฟีนิกซ์และก้อนสะท้อนต้องเป็น `sub: true`
- 🔴 **ห้ามใช้ชื่อฟิลด์ `kind` ใน event** — ชนิดผลชื่อ `fxKind` เท่านั้น
- 🔴 **แก้ทีละเพ็ท แยก commit ต่อตัว** — P4 ต้องย้อนกลับทีละตัวได้โดยไม่ลากตัวอื่นไปด้วย
- 📝 **ห้ามพิมพ์ตัวเลขลง `desc`/`short`** — ใส่ `{pct}` `{times}` … แล้วให้ `passiveText()` เติม · ทุก effect ใหม่ต้องมีป้ายครบและอยู่ในกลุ่มพอดีหนึ่งกลุ่ม (เทสคุมอยู่แล้ว)
- 🎲 **สุ่มทุกจุดต้องใช้ `rand` ที่เอนจินส่งมา** — ห้าม `Math.random()`
- 🧪 เพ็ทสังเคราะห์ในเทสขึ้นต้นด้วย `__` และลบทิ้งใน `finally`
- ✅ `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` ผ่าน
- 📌 commit เป็นไทย รูปแบบ `Area: อะไร (ทำไม)` · 🚫 **ห้าม `git push`**

## ฐานที่ยืนอยู่ (`master` ที่ `7b2c7f5`)

| ของที่มีให้ใช้ | ที่อยู่ |
|---|---|
| ก้อน state ต่อตัว | `psOf(u)` → `{ uses, atkStacks, rage, armor, infect, … }` |
| hook | `setup` · `aura` · `onStart` · `onRound` · `onAttack` · `onHit` · `onDealt` · `onDeath` · `onAnyDeath` · `onKill` |
| ช่องพิเศษของ `runOnHit` | `dmg` · `dodged` · `thorns` · `pierce` (ทะลุสายลด) · `reflect` (เกราะสะท้อน) |
| เครื่องพิสูจน์ | `node scripts/battle-differential.mjs <base>` |

**เลขตั้งต้น: 1,054 เทสผ่าน · build ผ่าน · differential เทียบ `7b2c7f5` ได้ 0**

## File Structure

| ไฟล์ | หน้าที่ | งานย่อย |
|---|---|---|
| `src/utils/battleEngine.js` | เรียก `runOnKill` ครั้งเดียว · ยิงหมัดสวนของฟีนิกซ์ | 1, 6 |
| `src/utils/battleBeats.js` | จังหวะของหมัดลูกที่ปิดไฟต์ | 2 |
| `src/utils/battlePassives.js` | ตรรกะของ effect ใหม่/ที่เปลี่ยน | 3, 5, 6, 7 |
| `src/data/petPassives.js` | ทะเบียนเพ็ท 8 ตัว + ป้าย | 3, 4, 5, 6, 8 |
| `scripts/battle-differential.mjs` | รายงานว่าไฟต์ที่ต่างมีเพ็ทตัวไหน | 1 |

---

### Task 1: `runOnKill` ยิงครั้งเดียวต่อการฆ่า + ทำให้ differential บอกได้ว่าใครเปลี่ยน

**Files:**
- Modify: `src/utils/battleEngine.js` (ลูป `while (killed …)` และบรรทัด `if (killed)` ใต้ลูป)
- Modify: `scripts/battle-differential.mjs`
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runOnKill` ถูกเรียก **ครั้งเดียวต่อการฆ่าหนึ่งครั้ง** รวมถึงหมัดที่ปิดไฟต์
- Produces: `battle-differential` พิมพ์รายชื่อเพ็ทที่อยู่ในไฟต์ที่ต่าง พร้อมจำนวนไฟต์ต่อตัว

บั๊กเดิม (สเปก §7.4 ข้อ 4): ลูปเรียก `runOnKill` หนึ่งครั้งแล้ว `break` ตอน `!extraAttack` จากนั้นบรรทัดใต้ลูป
`if (killed)` ยิงซ้ำอีกครั้ง ⇒ 🦖 ทีเร็กซ์ได้ 2 ชั้นต่อการล้ม 1 ตัว

⚠️ **ห้ามแก้ด้วยการลบบรรทัดใต้ลูปทิ้งเฉยๆ** — เงื่อนไข `while` มี `alive(foes).length` อยู่ แปลว่า
**การฆ่าที่ปิดไฟต์ไม่เคยเข้าลูป** บรรทัดใต้ลูปเป็นตัวเดียวที่ยิงให้มัน ลบแล้วหมัดปิดเกมจะไม่ได้ชั้นเลย

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('runOnKill: การตายหนึ่งครั้งต้องได้ชั้นไม่เกินหนึ่ง (ของเดิมยิงซ้ำ 2 ครั้งต่อศพ)', () => {
  // ⚠️ ห้ามเช็คด้วย "จำนวนชั้นรวม" หรือ "ชั้นซ้ำกันไหม" — เพดานของทีเร็กซ์คือ 3 ซึ่งบังเอิญเท่ากับ
  //    จำนวนศัตรู ⇒ ทั้งก่อนและหลังแก้ได้ [1,2,3] เหมือนกันเป๊ะ เทสแบบนั้นจะเขียวทั้งที่บั๊กยังอยู่
  //    สัญญาณจริงคือ "ศพเดียวมี stackAtk สองใบติดกัน"
  const strong = { id: 'trex', rarity: 'legendary', element: 'fist', grade: 5 }
  const weak = { id: '__blank__', rarity: 'common', element: 'scissors', grade: 0 }
  const r = simulateBattle([strong], [weak, weak, weak], 999)
  let sinceDeath = -1, worst = 0
  for (const e of r.log) {
    if (e.t === 'attack') { if (sinceDeath >= 0) worst = Math.max(worst, sinceDeath); sinceDeath = e.dead ? 0 : -1 }
    else if (sinceDeath >= 0 && e.t === 'passive' && e.effect === 'stackAtk') sinceDeath += 1
  }
  worst = Math.max(worst, Math.max(0, sinceDeath))
  assert.equal(worst, 1, 'ศพเดียวต้องให้ชั้นเดียว — มากกว่านั้นแปลว่า runOnKill ยิงซ้ำ')
})

test('runOnKill: หมัดที่ปิดไฟต์ก็ต้องได้ชั้น (บรรทัดใต้ลูปเป็นตัวเดียวที่ยิงให้มัน)', () => {
  const strong = { id: 'trex', rarity: 'legendary', element: 'fist', grade: 5 }
  const weak = { id: '__blank__', rarity: 'common', element: 'scissors', grade: 0 }
  const r = simulateBattle([strong], [weak], 4242)          // ศัตรูตัวเดียว = ตายทีเดียวจบ
  assert.equal(r.winner, 'A')
  const stacks = r.log.filter(e => e.t === 'passive' && e.effect === 'stackAtk')
  assert.equal(stacks.length, 1, 'หมัดปิดเกมต้องได้ชั้น 1 ชั้น')
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL เคสแรก — `worst` เป็น 2 (ศพเดียวได้สองชั้น)
เคสที่สองควรผ่านอยู่แล้ว (มันคุ้มครองบรรทัดที่ห้ามลบ)

- [ ] **Step 3: รวมสองจุดเป็นการเรียกครั้งเดียว**

ใน `src/utils/battleEngine.js`:

```js
      let killed = hit(att, foes)
      // killChain — "ตัวเดียวที่เพิ่ม beat ได้" จึงมีเพดานจาก value.max
      // 🔴 เรียก runOnKill ครั้งเดียวต่อการฆ่าหนึ่งครั้ง — เงื่อนไข "ศัตรูยังเหลือ" ย้ายมาไว้ใน
      //    การตัดสินใจ "ตีต่อไหม" ไม่ใช่เงื่อนไขเข้าลูป · ของเดิมเข้าลูปไม่ได้ตอนศัตรูหมด
      //    แล้วบรรทัดใต้ลูปยิงซ้ำ ⇒ ทีเร็กซ์ได้ 2 ชั้นต่อการล้ม 1 ตัว (บั๊กจริงตั้งแต่ ส.ค.)
      let chain = 0
      while (killed && turns < BATTLE_CFG.maxTurns) {
        const k = runOnKill(att, chain, team, foes)
        for (const e of k.events) log.push(e)
        if (!k.extraAttack || !alive(foes).length) break
        chain++; turns++
        killed = hit(att, foes)
      }
      cursor[cur] = (ai + 1) % team.length
```

(ลบบรรทัด `if (killed) { const k = runOnKill(...) … }` ใต้ลูปออก — ตอนนี้ลูปครอบทั้งสองกรณีแล้ว)

- [ ] **Step 4: ให้ differential บอกว่าไฟต์ที่ต่างมีเพ็ทตัวไหน**

ใน `scripts/battle-differential.mjs` — เก็บ id ของทั้งสองทีมทุกครั้งที่เจอไฟต์ต่าง แล้วสรุปท้ายสุด:

🔴 **อย่านับแค่ "เพ็ทตัวนี้อยู่ในไฟต์ที่ต่างกี่ไฟต์"** — ตัวเติมทีมกับคู่ต่อสู้จะติดมาด้วยเสมอ
แล้วรายการจะไม่มีวันอ่านว่า "มีแต่ตัวเดียว" ⇒ ตอบคำถามที่เราถามไม่ได้เลย
สิ่งที่ต้องรู้คือ **"ไฟต์ที่ต่างโดยไม่มีตัวนี้ มีกี่ไฟต์"** — ตัวที่ได้ 0 คือตัวที่อยู่ในทุกไฟต์ที่ต่าง

```js
// เก็บรายชื่อเพ็ทของไฟต์ที่ผลต่างกัน (เก็บเป็น Set ต่อไฟต์)
const badTeams = []
// …ใน cmp() ตอนที่เจอว่าต่าง:
badTeams.push(new Set([...A, ...B].map(u => u.id)))
// …ตอนพิมพ์สรุป:
if (badTeams.length) {
  const ids = new Set(badTeams.flatMap(t => [...t]))
  const rows = [...ids]
    .map(id => [id, badTeams.filter(t => !t.has(id)).length])
    .sort((a, b) => a[1] - b[1])
    .map(([id, n]) => `${id} ${n}`)
  console.log('ไฟต์ที่ต่างโดยไม่มีเพ็ทตัวนี้ (0 = อยู่ในทุกไฟต์ที่ต่าง = ตัวที่เปลี่ยนจริง):')
  console.log('  ' + rows.join(' · '))
}
```

- [ ] **Step 5: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5`
Expected: **ต่างกัน > 0 และในรายการแยกเดี่ยว `trex` ต้องมีค่า 0** (= อยู่ในไฟต์ที่ต่างทุกไฟต์)
ถ้ามีเพ็ทตัวอื่นได้ 0 ด้วย แปลว่าการรวมลูปเปลี่ยนอย่างอื่นนอกจากทีเร็กซ์ ให้หยุดแล้วรายงาน
บันทึกตัวเลข "ต่างกันกี่ไฟต์" ไว้ — งานย่อยถัดๆ ไปจะเทียบกับเลขนี้

🔴 **อ่านรายการให้ถูก:** ตัวเลขข้างชื่อเพ็ทคือ "จำนวนไฟต์ที่ต่างโดย**ไม่มี**ตัวนี้อยู่" ไม่ใช่จำนวนไฟต์ที่มันอยู่
เพ็ทที่ได้ 0 คือตัวที่อยู่ในไฟต์ที่ต่างทุกไฟต์ = ตัวที่พฤติกรรมเปลี่ยนจริง · เพ็ทที่แค่ยืนอยู่ในทีมด้วย
(เช่นตัวเติมทีมอย่าง `qilin`/`genie`) จะได้เลขมากกว่า 0 เสมอ

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleEngine.js scripts/battle-differential.mjs src/utils/battlePassives.test.js
git commit -m "Battle: runOnKill ยิงครั้งเดียวต่อการฆ่า (ทีเร็กซ์เคยได้ 2 ชั้นต่อการล้ม 1 ตัว)"
```

---

### Task 2: หมัดลูกที่ปิดไฟต์ถือเวลาปิดเกม

**Files:**
- Modify: `src/utils/battleBeats.js` (`finishAt` ~บรรทัด 150-155 · การแจก `kind` ~บรรทัด 229)
- Test: `src/utils/battleBeats.test.js`

**Interfaces:**
- Produces: `buildBeats()` ให้ `finish` กับ **attack ใบสุดท้ายของไฟต์** ไม่ว่าจะเป็นหมัดลูกหรือไม่ · ใบอื่นในบีตเดียวกันได้ `sub` (0ms แต่ยัง weight เท่าเดิม)

✅ **user เคาะ 5 ก.ย.: ทั้งก้อนถือเวลาปิดเกมร่วมกัน ใบสุดท้ายถือเวลาคนเดียว** — แพทเทิร์นเดียวกับ `openQuiet`/`openGroup`
⇒ ไม่เพิ่ม beat และคนดูเห็นหมัดที่ปิดเกมจริงๆ แทนที่จะเห็นหมัดหลักที่ถูกกันจนดาเมจเป็น 0 กินเวลา ×4

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('หมัดลูกที่ปิดไฟต์ได้เวลาปิดเกม ส่วนหมัดหลักในบีตเดียวกันยกเวลาให้', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 80 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B1', dmg: 50, targetHpAfter: 0, dead: true, sub: true },
  ]
  const b = buildBeats(log, { B0: 100, B1: 100 })
  assert.equal(b[2].kind, 'finish', 'ใบสุดท้ายของไฟต์ต้องได้บีตปิดเกม แม้จะเป็นหมัดลูก')
  assert.equal(b[1].kind, 'sub', 'หมัดหลักของบีตนั้นยกเวลาให้ใบสุดท้าย')
  assert.equal(b[0].kind, 'hit', 'บีตก่อนหน้าไม่เกี่ยว')
})

test('ไฟต์ที่จบด้วยหมัดหลักตามปกติ จังหวะต้องไม่เปลี่ยน', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 90, targetHpAfter: 0, dead: true },
  ]
  const b = buildBeats(log, { B0: 100 })
  assert.equal(b[1].kind, 'finish')
  assert.equal(b[0].kind, 'hit')
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battleBeats.test.js`
Expected: FAIL เคสแรก — `b[2].kind` เป็น `'sub'` และ `b[1].kind` เป็น `'finish'`

- [ ] **Step 3: แก้การหา `finishAt` และการแจก `kind`**

```js
  // หมัดปิดเกม = attack ใบสุดท้ายของไฟต์ — **นับหมัดลูกด้วย** (user เคาะ 5 ก.ย.)
  // ของเดิมข้ามหมัดลูกไป ⇒ ก้อนสะท้อน/cleave ที่ปิดเกมถูกเล่าเป็น 0ms ส่วนหมัดหลักที่ถูกกัน
  // จนดาเมจเป็น 0 กลับได้บีตปิดเกม ×4 — คนดูเห็นจังหวะจบที่ไม่ใช่จังหวะที่ฆ่าจริง
  let finishAt = -1
  for (let i = evts.length - 1; i >= 0; i--) {
    const ev = evts[i]
    if (ev && ev.t === 'attack') { finishAt = i; break }
  }

  // ใบอื่นที่อยู่ในบีตเดียวกับหมัดปิดเกม → ยกเวลาให้ใบสุดท้ายคนเดียว (แพทเทิร์นเดียวกับ openGroup)
  const finishGroup = new Set()
  for (let i = finishAt; i >= 0; i--) {
    const ev = evts[i]
    if (!ev || ev.t !== 'attack') break
    if (i !== finishAt) finishGroup.add(i)
    if (!ev.sub) break                    // ถึงหมัดหลักของบีตแล้ว รวมมันด้วยแล้วหยุด
  }
```

แล้วแก้บรรทัดแจก `kind`:

```js
    const kind = i === finishAt ? 'finish'
      : (finishGroup.has(i) || ev.sub) ? 'sub'
      : (ev.dead === true ? 'ko' : 'hit')
```

- [ ] **Step 4: รันเทส + วัดผลกระทบ**

Run: `node --test $(find src -name "*.test.js")` → fail 0
Run: `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5`
Expected: **`ต่างกัน` เท่าเดิมจากงานย่อย 1** (แก้จังหวะไม่แตะ log) แต่บรรทัดข้อมูล `kind ต่างกัน` จะเพิ่มขึ้น
— บันทึกตัวเลขทั้งสองไว้ในรายงาน ถ้า `ต่างกัน` ขยับ แปลว่าเผลอแตะ log ให้หยุดแล้วรายงาน

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleBeats.js src/utils/battleBeats.test.js
git commit -m "Beats: หมัดลูกที่ปิดไฟต์ถือเวลาปิดเกม หมัดหลักในบีตยกให้ (คนดูเคยเห็นจังหวะจบผิดใบ)"
```

---

### Task 3: 🐺 หมาป่า — ออร่าตรงๆ และลบ `teamAtkPerElement` ทิ้งทั้งระบบ

**Files:**
- Modify: `src/data/petPassives.js` (`wolf` · `STATUS_ICON` · `STATUS_TEXT` · `TEAM_AURA_EFFECTS`)
- Modify: `src/utils/battlePassives.js` (`applyAuras` เคส `teamAtkPerElement` · `STAT_EFFECTS`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: effect `teamAtkPerElement` **หายไปจากโค้ดทั้งหมด** · หมาป่าใช้ effect ใหม่ `teamAtkElement` ที่บัฟเฉพาะเพื่อนสายที่ระบุ

เดิม: ทั้งทีม +`pct`% **ต่อจำนวนเพื่อนสายจู่โจม 1 ตัว** (ยิ่งมีเยอะยิ่งคูณ) · ใหม่ตามสเปก §5:
**เพื่อนสายจู่โจมทุกตัว atk +`pct`%** (ตัวที่ไม่ใช่สายจู่โจมไม่ได้อะไร)

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('หมาป่า: บัฟเฉพาะเพื่อนสายจู่โจม ตัวสายอื่นไม่ได้อะไร', () => {
  const mk = (uid, id, el) => ({ uid, side: 'A', id, element: el, hp: 100, maxHp: 100, atk: 100 })
  const wolf = mk('A0', 'wolf', 'fist')
  const fistMate = mk('A1', '__blank__', 'fist')
  const paperMate = mk('A2', '__blank__', 'paper')
  applyAuras([wolf, fistMate, paperMate], [])
  assert.equal(Math.round(fistMate.atk), 104, 'เพื่อนสายจู่โจมได้ 4%')
  assert.equal(Math.round(wolf.atk), 104, 'ตัวหมาป่าเองก็สายจู่โจม จึงได้ด้วย')
  assert.equal(paperMate.atk, 100, 'สายอื่นต้องไม่ได้อะไร')
})

test('teamAtkPerElement ถูกลบออกจากระบบแล้ว (ค่าคงที่ที่ไม่มีใครอ่าน อันตรายกว่าค่าที่ผิด)', () => {
  assert.equal(STATUS_ICON.teamAtkPerElement, undefined)
  assert.equal(STATUS_TEXT.teamAtkPerElement, undefined)
  assert.equal(TEAM_AURA_EFFECTS.has('teamAtkPerElement'), false)
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const part of partsOf(p)) {
      assert.notEqual(part.effect, 'teamAtkPerElement', `${id} ยังใช้ effect ที่ถูกลบแล้ว`)
    }
  }
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL ทั้งสองเคส

- [ ] **Step 3: เปลี่ยนเคสใน `applyAuras`**

ลบเคส `teamAtkPerElement` ทิ้ง แล้วใส่เคสใหม่แทน:

```js
        case 'teamAtkElement':
          // บัฟเฉพาะเพื่อนที่อยู่สายที่ระบุ — ตัวสายอื่นในทีมไม่ได้อะไร
          // (ของเดิม teamAtkPerElement บัฟ *ทั้งทีม* โดยคูณตามจำนวนเพื่อนสายนั้น ⇒ ยิ่งกองยิ่งบาน)
          for (const t of team) if (t.element === v.element) t.atk *= (1 + v.pct / 100)
          break
```

แก้ `STAT_EFFECTS` ให้เป็น `teamAtkElement` แทนชื่อเดิม

- [ ] **Step 4: แก้ทะเบียนหมาป่าและป้าย**

```js
  wolf: {
    name: 'สัญชาตญาณฝูง', icon: '🐺',
    parts: [{ hook: 'aura', effect: 'teamAtkElement', value: { pct: 4, element: 'fist' }, step: { pct: 1.5 } }],
    desc: 'เพื่อนสายจู่โจมทุกตัว พลังโจมตี +{pct}%',
    short: 'เพื่อนสายจู่โจมทุกตัว +{pct}%',
  },
```

ใน `STATUS_ICON`/`STATUS_TEXT`/`TEAM_AURA_EFFECTS`: ลบคีย์ `teamAtkPerElement` แล้วใส่ `teamAtkElement` แทน
(ไอคอน ⚔️ เดิมใช้ต่อได้ — มันอยู่ในกลุ่มไอคอนซ้ำที่เทสอนุญาตไว้แล้วคู่กับ `teamAtk`)

- [ ] **Step 5: รันแล้วอ่านผล**

Run: `grep -rn "teamAtkPerElement" src/ scripts/` → **ต้องไม่เจออะไรเลย**
Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → รายชื่อเพ็ทที่ต่างต้องมีแค่ `trex` (จากงานย่อย 1) กับ `wolf`

- [ ] **Step 6: Commit**

```bash
git add src/data/petPassives.js src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: หมาป่าบัฟเฉพาะสายจู่โจม + ลบ teamAtkPerElement ทิ้งทั้งระบบ"
```

---

### Task 4: 🦖 ทีเร็กซ์ — ย้ายไป `onAnyDeath`

**Files:**
- Modify: `src/data/petPassives.js` (`trex`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: hook `onAnyDeath` ที่ P2a วางไว้ (ยิงให้ทีมฝั่งตรงข้ามของศพ เมื่อการตายเป็นที่สิ้นสุดแล้ว)
- Produces: ทีเร็กซ์ได้ชั้นเมื่อ **ศัตรูล้มโดยใครก็ได้** เพดานเดิม 3 ชั้น

งานนี้แตะแค่ข้อมูล — ตรรกะ `stackAtk` บน `onAnyDeath` ลงไว้ตั้งแต่ P2a แล้ว

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('ทีเร็กซ์: เพื่อนเป็นคนล้มศัตรู ทีเร็กซ์ก็ได้ชั้น', () => {
  const trex = { id: 'trex', rarity: 'legendary', element: 'fist', grade: 0 }   // อ่อนสุด จะได้ไม่ได้เป็นคนฆ่าเอง
  const mate = { id: 'bahamut', rarity: 'legendary', element: 'fist', grade: 5 }
  const weak = { id: '__blank__', rarity: 'common', element: 'scissors', grade: 0 }
  const r = simulateBattle([trex, mate], [weak, weak], 777)
  const mine = r.log.filter(e => e.t === 'passive' && e.effect === 'stackAtk' && e.petId === 'trex')
  assert.ok(mine.length > 0, 'ต้องได้ชั้นแม้ไม่ได้เป็นคนฆ่า')
})

test('ทีเร็กซ์: hook ย้ายไป onAnyDeath แล้ว ไม่เหลือ onKill', () => {
  const parts = partsOf(PET_PASSIVES.trex)
  assert.equal(parts.length, 1)
  assert.equal(parts[0].hook, 'onAnyDeath')
  assert.equal(parts[0].value.max, 3, 'เพดานชั้นเดิมต้องไม่เปลี่ยน')
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — hook ยังเป็น `onKill`

- [ ] **Step 3: แก้ทะเบียน**

```js
  trex: {
    name: 'สัญชาตญาณนักล่า', icon: '🦖',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 12, max: 3 }, step: { pct: 4, max: 0 } }],
    desc: 'ศัตรูล้ม 1 ตัว (ใครล้มก็ได้) พลังโจมตี +{pct}% ถาวร (สะสมได้ {max} ชั้น)',
    short: 'ศัตรูล้ม 1 ตัว พลังโจมตี +{pct}% (สะสม {max} ชั้น)',
  },
```

- [ ] **Step 4: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → รายชื่อเพ็ทเพิ่ม `trex` (มีอยู่แล้ว) ไม่ควรมีตัวใหม่โผล่

- [ ] **Step 5: Commit**

```bash
git add src/data/petPassives.js src/utils/battlePassives.test.js
git commit -m "Passive: ทีเร็กซ์ได้ชั้นเมื่อศัตรูล้มโดยใครก็ได้ (ย้ายไป onAnyDeath)"
```

---

### Task 5: 🐱 แมว — รอดแล้วทนต่ออีก 2 หมัด + แรงขึ้น 50%

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnDeath` เคส `cheatDeath`)
- Modify: `src/data/petPassives.js` (`cat`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `psOf(unit).grit` — จำนวนหมัดถึงตายที่ยังทนได้ · ระหว่างที่ `grit > 0` แมวมี atk เพิ่ม `atkPct`%

กติกา: รอดตายครั้งแรกด้วย `cheatDeath` เหมือนเดิม → จากนั้น **หมัดถึงตายอีก 2 ครั้งไม่ฆ่ามัน** (เหลือเลือด 1 ทุกครั้ง)
ระหว่างสถานะนี้ atk +50% · พอ `grit` หมด บัฟหาย และหมัดถึงตายครั้งถัดไปฆ่าได้ตามปกติ
⇒ รวมแล้วแมวทนหมัดถึงตายได้ **3 ครั้ง** (1 จาก `cheatDeath` + 2 จาก `grit`)

🔴 **นี่คือสถานะหลายชั้นตัวแรกของเกม** — ต้องคืนค่า atk ตอนหมดสถานะ ไม่งั้นบัฟค้างถาวร

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('แมว: รอดตายครั้งแรกแล้วได้สถานะทน 2 หมัด + แรงขึ้น แล้วบัฟหายตอนหมดสถานะ', () => {
  const cat = { uid: 'A0', side: 'A', id: 'cat', hp: 0, maxHp: 100, atk: 100 }
  const team = [cat]

  const d1 = runOnDeath(cat, team)                       // ครั้งที่ 1 — cheatDeath
  assert.equal(d1.prevented, true)
  assert.equal(cat.hp, 1)
  assert.equal(psOf(cat).grit, 2, 'ได้สถานะทน 2 หมัด')
  assert.equal(Math.round(cat.atk), 150, 'atk +50% ระหว่างมีสถานะ')

  cat.hp = 0
  assert.equal(runOnDeath(cat, team).prevented, true)    // ครั้งที่ 2 — กินสถานะ
  assert.equal(psOf(cat).grit, 1)
  assert.equal(Math.round(cat.atk), 150, 'ยังมีสถานะ บัฟยังอยู่')

  cat.hp = 0
  assert.equal(runOnDeath(cat, team).prevented, true)    // ครั้งที่ 3 — สถานะหมดพอดี
  assert.equal(psOf(cat).grit, 0)
  assert.equal(Math.round(cat.atk), 100, 'สถานะหมด บัฟต้องหายไปด้วย ไม่ค้างถาวร')

  cat.hp = 0
  assert.equal(runOnDeath(cat, team).prevented, false, 'ครั้งที่ 4 ตายจริง')
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `psOf(cat).grit` เป็น `undefined` และครั้งที่ 2 ตายจริง

- [ ] **Step 3: แก้เคส `cheatDeath` ใน `runOnDeath`**

แทนที่เคสเดิมด้วย:

```js
    if (part.effect === 'cheatDeath') {
      const st = psOf(unit)
      st.uses = (st.uses || 0) + 1
      unit.hp = 1
      // สถานะ "ทนต่อ" — หมัดถึงตายอีก v.grit ครั้งไม่ฆ่ามัน และระหว่างนั้นแรงขึ้น v.atkPct%
      // 🔴 ต้องคืน atk ตอนสถานะหมด ไม่งั้นบัฟค้างถาวรทั้งไฟต์ (สถานะหลายชั้นตัวแรกของเกม)
      if (v.grit > 0) {
        st.grit = v.grit
        st.gritMult = 1 + (v.atkPct || 0) / 100
        unit.atk *= st.gritMult
      }
      out.prevented = true
      out.events.push(ev(unit, p, part, { targets: [unit.uid], hpPct: 1, amount: st.grit || 0, fxKind: 'revive' }))
      return out
    }
```

แล้ว **เหนือ** บล็อกนั้น (ก่อนเช็ค `uses` กับ `times`) ใส่การกินสถานะ:

```js
  // กินสถานะ "ทนต่อ" ก่อน — ยังไม่แตะโควตา cheatDeath
  const gst = unit.ps && unit.ps.grit
  if (gst > 0) {
    const st = psOf(unit)
    st.grit -= 1
    unit.hp = 1
    if (st.grit === 0 && st.gritMult) { unit.atk /= st.gritMult; st.gritMult = 0 }
    out.prevented = true
    out.events.push({ t: 'passive', uid: unit.uid, side: unit.side, petId: unit.id,
      name: passiveFor(unit)?.name || 'ทนต่อ', icon: passiveFor(unit)?.icon || '🐱',
      effect: 'grit', targets: [unit.uid], amount: st.grit, hpPct: 1, fxKind: 'revive' })
    return out
  }
```

- [ ] **Step 4: แก้ทะเบียนแมว + ป้ายของ effect `grit`**

```js
  cat: {
    name: 'เก้าชีวิต', icon: '🐱',
    parts: [{ hook: 'onDeath', effect: 'cheatDeath', value: { times: 1, grit: 2, atkPct: 50 },
              step: { times: 0, grit: 0, atkPct: 0 } }],
    desc: 'รอดตายได้ {times} ครั้ง แล้วทนต่ออีก {grit} หมัด · ระหว่างนั้นพลังโจมตี +{atkPct}%',
    short: 'รอดตาย {times} ครั้ง แล้วทนต่ออีก {grit} หมัด (+{atkPct}%)',
  },
```

เพิ่ม `grit` ลง `STATUS_ICON` (เลือกไอคอนที่ยังไม่มีใครใช้) · `STATUS_TEXT` · `SELF_STATUS_EFFECTS`

- [ ] **Step 5: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → รายชื่อเพ็ทที่ต่างต้องเพิ่มแค่ `cat`

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/data/petPassives.js src/utils/battlePassives.test.js
git commit -m "Passive: แมวรอดแล้วทนต่ออีก 2 หมัดพร้อมบัฟพลังโจมตี (คืนค่าตอนสถานะหมด)"
```

---

### Task 6: 🐦‍🔥 ฟีนิกซ์ — คืนชีพแล้วตีสวนผู้สังหาร

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnDeath` — รับผู้สังหาร คืนหมัดสวน)
- Modify: `src/utils/battleEngine.js` (`strike()` — ยิงหมัดสวน)
- Modify: `src/data/petPassives.js` (`phoenix`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Produces: `runOnDeath(unit, team, attacker = null)` — พารามิเตอร์ที่สามใหม่ · คืน `out.counter = { target, mult }` เมื่อฟีนิกซ์คืนชีพและมีผู้สังหารให้ตีสวน
- เอนจินยิงหมัดสวนผ่าน `strike()` แบบ `sub: true` (อยู่ beat เดิม 🔒)

🔴 **หมัดสวนต้องไม่กลายเป็น beat ใหม่** และต้องไม่ยิงย้อนกลับไม่รู้จบ (ฟีนิกซ์สองตัวตีกันตาย) —
ใช้ธง `reflecting` ตัวเดียวกับที่ `armorStack` ใช้อยู่ ถ้าอยู่ในก้อนสะท้อน/สวนอยู่แล้ว ห้ามสวนซ้อน

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('ฟีนิกซ์: คืนชีพแล้วคืนหมัดสวนใส่ผู้สังหาร', () => {
  const px = { uid: 'A0', side: 'A', id: 'phoenix', hp: 0, maxHp: 100, atk: 200 }
  const killer = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const out = runOnDeath(px, [px], killer)
  assert.equal(out.prevented, true)
  assert.ok(px.hp > 1, 'คืนชีพด้วยเลือดตามสูตรเดิม')
  assert.equal(out.counter.target, killer)
  assert.equal(out.counter.mult, 300, '150% ของ atk 200')
})

test('ฟีนิกซ์: ไม่มีผู้สังหาร (ตายจากออร่า/หนาม) ต้องไม่ throw และไม่มีหมัดสวน', () => {
  const px = { uid: 'A0', side: 'A', id: 'phoenix', hp: 0, maxHp: 100, atk: 200 }
  const out = runOnDeath(px, [px])
  assert.equal(out.prevented, true)
  assert.equal(out.counter, undefined)
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `out.counter` เป็น `undefined` ในเคสแรก

- [ ] **Step 3: แก้ `runOnDeath`**

เปลี่ยนลายเซ็นเป็น `export function runOnDeath(unit, team, attacker = null)` แล้วในเคส `revive`:

```js
    if (part.effect === 'revive') {
      psOf(unit).uses = (psOf(unit).uses || 0) + 1
      unit.hp = pctOf(unit.maxHp, v.pct)
      out.prevented = true
      // ตีสวนผู้สังหาร — เอนจินเป็นคนยิงผ่าน strike() ปกติ (โดนสายลดของฝั่งนั้น) แบบ sub
      // 🔒 sub ⇒ อยู่ beat เดิม ไม่เพิ่มจังหวะ · ถ้าไม่มีผู้สังหาร (ตายจากออร่า/หนาม) ก็ไม่มีหมัดสวน
      if (v.counterPct > 0 && attacker && attacker.hp > 0) {
        out.counter = { target: attacker, mult: pctOf(unit.atk, v.counterPct) }
      }
      out.events.push(ev(unit, p, part, { targets: [unit.uid], amount: Math.round(unit.hp),
        hpPct: Math.round((unit.hp / unit.maxHp) * 100), fxKind: 'revive' }))
      return out
    }
```

- [ ] **Step 4: ให้เอนจินส่งผู้สังหารและยิงหมัดสวน**

ใน `strike()` — จุดที่เรียก `runOnDeath`:

```js
      const d = runOnDeath(tg, foes, att)
      for (const e of d.events) log.push(e)
      if (d.prevented) dead = false
      // หมัดสวนของฟีนิกซ์ — ใช้ธงเดียวกับก้อนสะท้อน กันสวนซ้อนไม่รู้จบ (ฟีนิกซ์สองตัวตีกันตาย)
      if (d.counter && !reflecting) {
        reflecting = true
        try {
          if (d.counter.target.hp > 0) {
            strike(tg, d.counter.target, att.side === 'A' ? A : B, d.counter.mult, { crit: false, eff: 'neutral' }, true)
          }
        } finally { reflecting = false }
      }
```

- [ ] **Step 5: แก้ทะเบียนฟีนิกซ์**

```js
  phoenix: {
    name: 'เกิดใหม่จากเถ้า', icon: '🔥',
    parts: [{ hook: 'onDeath', effect: 'revive', value: { pct: 35, counterPct: 150 },
              step: { pct: 10, counterPct: 0 } }],
    desc: 'ตายครั้งแรกแล้วฟื้นด้วยเลือด {pct}% แล้วตีสวนผู้สังหาร {counterPct}% ของพลังโจมตี',
    short: 'ฟื้นด้วยเลือด {pct}% + ตีสวน {counterPct}%',
  },
```

- [ ] **Step 6: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → เพิ่ม `phoenix` เข้ามาในรายชื่อ
Run: ตรวจว่าไม่มี beat เพิ่ม — บรรทัด `เวลารวมต่างกัน` ต้องอธิบายได้ (หมัดสวนเป็น `sub` จึงไม่ควรเพิ่มเวลา)

- [ ] **Step 7: Commit**

```bash
git add src/utils/battlePassives.js src/utils/battleEngine.js src/data/petPassives.js src/utils/battlePassives.test.js
git commit -m "Passive: ฟีนิกซ์คืนชีพแล้วตีสวนผู้สังหาร (แนบบนบีตการตาย ไม่เพิ่มจังหวะ)"
```

---

### Task 7: 🐕 เซอร์เบอรัส — สุ่ม 3 เป้า ซ้ำตัวเดิมได้

**Files:**
- Modify: `src/utils/battlePassives.js` (`runOnAttack` เคส `cleave`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: `rand` ที่ `runOnAttack` รับอยู่แล้ว
- Produces: `res.extra` อาจมีเป้าซ้ำตัวเดิมได้ — ตัวเดียวอาจโดน 2–3 ที

⚠️ เดิม `cleave` เลือกเป้ารอง "ไม่ซ้ำ" ด้วย `.filter(...).slice(0, count-1)` (ไม่ดึง `rand` เลย)
ของใหม่ดึง `rand` ⇒ **ลำดับสุ่มของไฟต์ที่มีเซอร์เบอรัส/มังกรจะเลื่อน** — เป็นเจตนา แต่ต้องรู้ตัว
🔴 มังกร (`dragon`) ก็ใช้ `cleave` — สเปกไม่ได้สั่งให้มังกรเปลี่ยน ⇒ **ต้องแยกด้วยค่าในข้อมูล ไม่ใช่แยกด้วย id**
ใช้คีย์ใหม่ `repeat: true` ใน `value` ของเซอร์เบอรัสเท่านั้น

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('เซอร์เบอรัส: สุ่มเป้ารองซ้ำตัวเดิมได้ (repeat: true)', () => {
  const att = { uid: 'A0', side: 'A', id: 'cerberus', hp: 100, maxHp: 100, atk: 100 }
  const f1 = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const f2 = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const res = runOnAttack(att, f1, [f1, f2], () => 0)      // rand 0 = เลือกตัวแรกเสมอ
  assert.equal(res.extra.length, 2, 'count 3 ⇒ เป้ารอง 2 ตัว')
  assert.ok(res.extra.every(x => x.unit === f1), 'rand 0 ⇒ ซ้ำตัวเดิมได้')
})

test('มังกร: ยังเป็น cleave แบบไม่ซ้ำเหมือนเดิม (สเปกไม่ได้สั่งให้เปลี่ยน)', () => {
  const att = { uid: 'A0', side: 'A', id: 'dragon', hp: 100, maxHp: 100, atk: 100 }
  const f1 = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const f2 = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  const res = runOnAttack(att, f1, [f1, f2], () => 0)
  assert.deepEqual(res.extra.map(x => x.unit), [f2], 'เป้ารองต้องเป็นตัวที่ไม่ใช่เป้าหลัก')
})
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL เคสแรก — ได้ `[f2]` ตัวเดียว

- [ ] **Step 3: แก้เคส `cleave`**

```js
      case 'cleave': {
        const pool = alive(foes)
        let others
        if (v.repeat) {
          // สุ่มซ้ำตัวเดิมได้ — ตัวเดียวอาจโดนหลายที (🐕 เซอร์เบอรัส)
          // 🎲 ดึง rand ตรงนี้ ⇒ ลำดับสุ่มของไฟต์ที่มีตัวนี้เลื่อนจากของเดิม เป็นเจตนา
          others = []
          for (let i = 0; i < Math.max(0, (v.count || 1) - 1); i++) {
            if (!pool.length) break
            others.push(pool[Math.floor(rand() * pool.length)])
          }
        } else {
          others = pool.filter(f => f !== res.target).slice(0, Math.max(0, (v.count || 1) - 1))
        }
        if (others.length) {
          res.extra = others.map(u => ({ unit: u, pct: v.pct }))
          res.events.push(ev(att, p, part, { targets: [res.target.uid, ...others.map(u => u.uid)], fxKind: 'cleave' }))
        }
        break
      }
```

- [ ] **Step 4: แก้ทะเบียนเซอร์เบอรัส**

```js
  cerberus: {
    name: 'ตรีเขี้ยวอสูร', icon: '🦷',
    parts: [{ hook: 'onAttack', effect: 'cleave', value: { count: 3, pct: 40, repeat: true },
              step: { count: 0, pct: 8 } }],
    desc: 'พุ่งขย้ำทีเดียว เขี้ยวลง {count} ที สุ่มเป้า ซ้ำตัวเดิมได้ · แต่ละทีโดน {pct}% ของดาเมจ',
    short: 'เขี้ยวลง {count} ที สุ่มเป้า · ทีละ {pct}%',
  },
```

- [ ] **Step 5: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → เพิ่ม `cerberus` · **`dragon` ต้องไม่โผล่ในรายชื่อ**
(ถ้ามังกรโผล่ แปลว่าแยกด้วยข้อมูลไม่สำเร็จ)

- [ ] **Step 6: Commit**

```bash
git add src/utils/battlePassives.js src/data/petPassives.js src/utils/battlePassives.test.js
git commit -m "Passive: เซอร์เบอรัสสุ่มเป้าซ้ำตัวเดิมได้ (มังกรยังเป็นแบบเดิม แยกด้วย repeat ในข้อมูล)"
```

---

### Task 8: 🐍 อูโรโบรอส + 🐘 บากุ เป็น 2 parts · 🐉 บาฮามุทเลขใหม่

**Files:**
- Modify: `src/data/petPassives.js` (`ouroboros` · `qilin` · `bahamut`)
- Test: `src/utils/battlePassives.test.js`

**Interfaces:**
- Consumes: กฎจังหวะเพ็ทหลาย part ที่ P2a วางไว้ (คีย์ตัวดักซ้ำนับ nth ต่อ-effect ในก้อน)

🔴 **นี่คือเพ็ทหลาย part ตัวแรกจริงของเกม** — กฎ §2.4 ที่ P2a เขียนไว้จะทำงานที่นี่เป็นครั้งแรก
โดยเฉพาะ 🐍 ที่ `regenSelf` ข้ามตัวเองตอนเลือดเต็ม แล้ว `stackAtk` ต้องไม่ประกาศซ้ำเพราะตำแหน่งเลื่อน

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

```js
test('อูโรโบรอส/บากุ: มี 2 part และลำดับ event ตรงกับลำดับใน parts', () => {
  for (const id of ['ouroboros', 'qilin']) {
    assert.equal(partsOf(PET_PASSIVES[id]).length, 2, `${id} ต้องมี 2 part`)
  }
  const snake = u('ouroboros', { uid: 'A0', hp: 100 })       // เลือดพร่อง ⇒ regen ทำงาน
  const events = runOnRound([snake])
  assert.deepEqual(events.map(e => e.effect), ['regenSelf', 'stackAtk'])
})

test('อูโรโบรอส: เลือดเต็ม regen ข้าม แต่ stackAtk ยังทำงาน', () => {
  const snake = u('ouroboros', { uid: 'A0' })                // เลือดเต็ม
  const events = runOnRound([snake])
  assert.deepEqual(events.map(e => e.effect), ['stackAtk'])
})

test('บาฮามุท: เลขเปิดไฟต์เป็น 150% ของพลังโจมตี', () => {
  const v = partsOf(PET_PASSIVES.bahamut)[0].value
  assert.equal(v.pct, 150)
})
```

⚠️ `stackAtk` บน `onRound` ยังไม่มีตรรกะ — `runOnRound` วันนี้รู้จักแค่ `regenSelf`/`healLowestAlly`
ต้องเพิ่มเคสให้มัน (ใช้ `psOf().atkStacks` และเพดาน `max` แบบเดียวกับที่อื่น)

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL ทั้งสามเคส

- [ ] **Step 3: เพิ่มเคส `stackAtk` ใน `runOnRound`**

```js
      } else if (part.effect === 'stackAtk') {
        // ไต่ชั้นทุกต้นรอบ (🐍) — เพดานและวิธีคิดเหมือน onKill/onAnyDeath ทุกประการ
        const st = psOf(u)
        const stacks = st.atkStacks || 0
        if (stacks < v.max) {
          st.atkStacks = stacks + 1
          u.atk *= 1 + v.pct / 100
          const e = ev(u, p, part, { targets: [u.uid], amount: st.atkStacks, fxKind: 'buff' })
          e.statsAfter = statsSnapshot(team)
          out.push(e)
        }
      }
```

- [ ] **Step 4: แก้ทะเบียนสามตัว**

สอง part นี้ใช้คีย์ `pct` ชนกัน ⇒ **ต้องใส่ `tag` แล้วอ้างเป็น `{tag.key}` ในข้อความ**
(กลไก `tag` มีมาตั้งแต่ P1 — `mergedValues` สร้างคีย์ `regen.pct` / `rage.pct` ให้เอง)

```js
  ouroboros: {
    name: 'วัฏจักรนิรันดร์', icon: '🐍',
    parts: [
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1.5 }, tag: 'regen' },
      { hook: 'onRound', effect: 'stackAtk', value: { pct: 5, max: 4 }, step: { pct: 1, max: 0 }, tag: 'rage' },
    ],
    desc: 'ทุกต้นรอบ ฟื้นเลือดตัวเอง {regen.pct}% และพลังโจมตี +{rage.pct}% (สะสมได้ {rage.max} ชั้น)',
    short: 'ทุกต้นรอบ ฟื้น {regen.pct}% + แรง +{rage.pct}%',
  },
```

```js
  qilin: {
    name: 'ปราการพิทักษ์', icon: '🛡️',
    parts: [
      { hook: 'onHit', effect: 'guardian', value: { pct: 50 }, step: { pct: 8 }, tag: 'guard' },
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 3 }, step: { pct: 1 }, tag: 'regen' },
    ],
    desc: 'รับดาเมจแทนเพื่อนที่เลือดน้อยสุด {guard.pct}% · ฟื้นเลือดตัวเอง {regen.pct}% ทุกต้นรอบ',
    short: 'รับแทน {guard.pct}% · ฟื้นเอง {regen.pct}%/รอบ',
  },
```

บาฮามุท: เปลี่ยน `value.pct` เป็น `150` (step ปล่อยไว้ — P4 เป็นเจ้าของเลข)

- [ ] **Step 5: รันแล้วอ่านผล**

Run: `node --test $(find src -name "*.test.js")` → fail 0 · `npm run build` → ผ่าน
Run: `node scripts/battle-differential.mjs 7b2c7f5` → เพิ่ม `ouroboros`, `qilin`, `bahamut`
⚠️ **ดูบรรทัด `เวลารวมต่างกัน` ด้วย** — เพ็ท 2 part ตัวแรกของเกมอยู่ตรงนี้ ถ้ากฎจังหวะของ P2a ทำงานถูก
เวลาต่อบีตต้องไม่บาน (หยุด 200ms ครั้งเดียวต่อก้อน ไม่ใช่สองครั้ง) — ถ้าบานให้หยุดแล้วรายงาน

- [ ] **Step 6: Commit**

```bash
git add src/data/petPassives.js src/utils/battlePassives.js src/utils/battlePassives.test.js
git commit -m "Passive: อูโรโบรอส/บากุเป็น 2 part + บาฮามุทเปิดไฟต์ 150% (เพ็ทหลาย part ตัวแรกจริง)"
```

---

### Task 9: วัดผลรวมด้วย sim แล้วรายงาน

**Files:** — (ไม่แก้โค้ด งานนี้คือการวัดและรายงาน)

- [ ] **Step 1: วัด sim ก่อน/หลัง**

```bash
git stash list   # ต้องว่าง
node scripts/passive-power-sim.mjs 1500 > /tmp/sim-after.txt
git worktree add --detach /tmp/p2c-base 7b2c7f5 && (cd /tmp/p2c-base && npm run build >/dev/null 2>&1; node scripts/passive-power-sim.mjs 1500 > /tmp/sim-before.txt)
```

แล้วเทียบสองไฟล์ทีละแถว

- [ ] **Step 2: รายงานให้ user**

ตารางที่มีอย่างน้อย: ชื่อเพ็ท · lift ก่อน · lift หลัง · ส่วนต่าง · อันดับก่อน/หลัง
พร้อมบอกชัดว่า **เพ็ทที่ไม่ได้แตะตัวไหนขยับบ้างและทำไม** (เช่น หมาป่าเปลี่ยน ⇒ ทีมสายจู่โจมทั้งทีมขยับตาม)

🔴 **ห้ามมีตัวไหนกลายเป็น 0.0% เป๊ะ** (= พาสสีฟตาย) · ถ้ามี ให้รายงานเป็นข้อค้นพบ ไม่ใช่แก้เลขเอง —
**เลขบาลานซ์เป็นของ P4** งานนี้แค่วัดและรายงาน

- [ ] **Step 3: เก็บกวาด**

```bash
git worktree remove --force /tmp/p2c-base
```

- [ ] **Step 4: Commit รายงาน (ถ้ามีไฟล์)**

ถ้าเขียนผลลงเอกสาร ให้ commit เป็น `Docs: ผล sim ก่อน/หลัง P2c-1 (ข้อมูลตั้งต้นให้ P4)`

---

## หลังจบ P2c-1

รายงานให้ user: จำนวนเทสที่ผ่าน · รายชื่อเพ็ทที่ไฟต์เปลี่ยน (ต้องตรงกับ 8 ตัวที่ตั้งใจแก้ + ตัวที่ได้รับผลทางอ้อม) ·
ตาราง sim ก่อน/หลัง · แล้วรอไฟเขียวก่อนเขียนแผน **P2c-2 (ภาษาการเล่าเรื่องในรีเพลย์)**

**หนี้ที่ยังไม่ได้ใช้ในแผนนี้** (จากสเปก §7.5) — ทั้งหมดเป็นเรื่องหน้าจอ จึงไปอยู่ใน P2c-2:
event ของก้อนสะท้อนถูก log ก่อนหมัดที่เป็นต้นเหตุ · `fxKind: 'debuff'` ยังไม่มีตัวเรนเดอร์ ·
จำนวนชิปต่อบีตอาจทะลุเพดานที่วัดไว้
