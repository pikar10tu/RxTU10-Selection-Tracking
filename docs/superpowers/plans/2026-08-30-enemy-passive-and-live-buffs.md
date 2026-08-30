# เห็นพาสสีฟศัตรู + อ่านบัฟสดระหว่างรีเพลย์ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้เล่นเห็นพาสสีฟของทีมศัตรูก่อนสู้ (หอคอย + สนามประลอง) และอ่านได้ระหว่างรีเพลย์ว่าตัวที่แตะดูกำลังติดบัฟอะไร มาจากใคร พร้อมทำเลข ATK/HP บนการ์ดให้วิ่งตามสกิลที่ทำงานจริง

**Architecture:** ตรรกะทั้งหมดเป็น pure function ใน `src/utils/` (มีเทส `node --test`) · component อ่านผลอย่างเดียว · เอนจินเป็นแหล่งความจริงเดียวของตัวเลข — แนบ snapshot สเตตัสมากับ event ที่มันเปลี่ยนค่าจริง UI ไม่คำนวณ aura ซ้ำ

**Tech Stack:** Vue 3 (`<script setup>` + scoped style) · Vite · Pinia · เทส `node:test` + `node:assert/strict` ไม่มี test runner กลาง

**สเปก:** `docs/superpowers/specs/2026-08-30-enemy-passive-and-live-buffs-design.md`

## Global Constraints

- **ฟอนต์ขั้นต่ำ `.7rem`** ห้ามต่ำกว่านี้ในไฟล์ `.vue`/`.css` ใดๆ (ภาษาไทยมีสระบน-ล่าง) · ตรวจ: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/` ต้องไม่เจออะไร
- **overlay `position:fixed` ใต้ `<RouterView>` ต้อง `<Teleport to="body">` เสมอ** (CLAUDE.md ข้อ 6)
- **z-index ตามบันได CLAUDE.md ข้อ 12** — ถามว่า "ถูกเปิดจากในอะไร" แล้วเลือกให้สูงกว่านั้น · 400 = sheet/modal ฐาน · 410 = อะไรที่เปิดจากในตัว 400 · 420–430 = BattleReplay
- **สีตัวอักษรบนพื้นเข้ม** — การ์ด `#1e293b` ห้ามใช้ `color: rgba(0,0,0,…)` (CLAUDE.md ข้อ 13)
- **ห้ามพิมพ์ตัวเลขของ passive ลง template เอง** — ผ่าน `passiveValueAt`/`passiveText`/`effectText` เสมอ ไม่งั้นระบบขั้น (`passiveLv`) มาแล้วเลขไม่ขยับ
- **ห้ามสร้าง event ชนิดใหม่ลง `log`** — `buildBeats` pass 3 ตกท้ายไปสาขา attack (`battleBeats.js:187`) จะพัง · ของใหม่ไปอยู่บน `result` หรือเป็นฟิลด์เพิ่มบน event ที่มีอยู่
- **ห้ามตั้งชื่อฟิลด์บน event ซ้ำกับที่ `buildBeats` spread ทับ** (`kind`) — grep ชื่อใหม่ก่อนใช้เสมอ (CLAUDE.md ข้อ 15)
- **ห้าม `sed` คำว่า "ธาตุ" ทั้งรีโป** — `data/drugs.js` มี "ธาตุเหล็ก"
- commit เป็นไทย รูปแบบ `Area: อะไร (ทำไม)` · โทนข้อความผู้ใช้ตาม `docs/voice-guide.md`
- ตรวจงานทุกครั้งด้วย `npm run build` (ไม่มี lint/test runner กลาง)

---

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `src/data/petPassives.js` | ทะเบียนพาสสีฟ + ข้อความ · เพิ่มฟิลด์ `short` ทุกตัว + `effectText()` + `STATUS_ICON/TEXT.duoRegen` | แก้ |
| `src/utils/battleEngine.js` | เอนจิน · เพิ่ม `result.units` + แนบ `statsAfter` บน event ที่เปลี่ยนสเตตัส | แก้ |
| `src/utils/battlePassives.js` | ตรรกะ passive · `applyAuras`/`runOnKill` แนบ `statsAfter` | แก้ |
| `src/utils/battleBuffs.js` | **ใหม่** — `buffSources()` (ที่มาของบัฟ) + `liveBuffs()` (สถานะสดตาม beat) | สร้าง |
| `src/utils/battleBuffs.test.js` | เทสของข้างบน | สร้าง |
| `src/components/pets/PetScoutCard.vue` | **ใหม่** — การ์ดสอดแนมเพ็ท (สเตตัส + พาสสีฟ) ใช้ร่วมหอคอย/แผ่นชั้น/สนามประลอง | สร้าง |
| `src/components/battle/BattleReplay.vue` | `dispStats` + บล็อก "กำลังได้รับ" + `statusMap` derive จาก `buffSources` | แก้ |
| `src/views/TowerView.vue` | ลบ `tw-scout` ใช้ `PetScoutCard` | แก้ |
| `src/components/tower/FloorSheet.vue` | ศัตรูกดได้ → `PetScoutCard` | แก้ |
| `src/views/ArenaView.vue` | เลย์เอาต์การ์ดคู่ต่อสู้ใหม่ + `PetScoutCard` | แก้ |

**ลำดับ:** Task 1 → 2 → 3 → 4 → 5 เป็นสายที่พึ่งพากัน · Task 6 → 7 แตะคนละไฟล์ ทำขนานได้

---

## Task 1: ข้อความผลของพาสสีฟให้ตรงตัว (`short` + `effectText`)

**Files:**
- Modify: `src/data/petPassives.js`
- Test: `src/utils/battlePassives.test.js` (ไฟล์เทสของ petPassives อยู่ที่นี่)

**Interfaces:**
- Consumes: `passiveValueAt(p, level)` ที่มีอยู่แล้ว
- Produces: `effectText(p, level = 1) → string` · ฟิลด์ `short` บนทุกรายการของ `PET_PASSIVES` · `STATUS_ICON.duoRegen` = `'💧'` · `STATUS_TEXT.duoRegen` = `'ทีมฟื้นเลือดทุกรอบ'`

- [ ] **Step 1: เขียนเทสที่ยังแดง**

ต่อท้าย `src/utils/battlePassives.test.js` (import `effectText` เพิ่มในบรรทัด import ของ `../data/petPassives.js`):

```js
// ── ข้อความผลของ passive (short / effectText) ────────────────
test('PET_PASSIVES: ทุกตัวมี short และเติมเลขครบ ไม่เหลือ {placeholder}', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.ok(typeof p.short === 'string' && p.short.length > 0, `${id} ไม่มี short`)
    const filled = effectText(p, 1)
    assert.ok(!/\{\w+\}/.test(filled), `${id} เหลือ placeholder: ${filled}`)
  }
})

test('effectText: ขั้นสูงขึ้นแล้วเลขต้องขยับ (ตัวที่ step ไม่เป็น 0)', () => {
  // whale teamHp pct 10 step 3 → ขั้น 3 ต้องได้ 16
  assert.notEqual(effectText(PET_PASSIVES.whale, 1), effectText(PET_PASSIVES.whale, 3))
  assert.match(effectText(PET_PASSIVES.whale, 3), /16/)
})

test('effectText: ฟีนิกซ์กับแมวต้องอ่านต่างกัน (เดิมชนกันที่ "กันตายได้ 1 ครั้ง")', () => {
  assert.notEqual(effectText(PET_PASSIVES.phoenix, 1), effectText(PET_PASSIVES.cat, 1))
})

test('หมาป่า: desc/short ต้องไม่มีคำว่า "สายพลัง" (ชื่อสายจริงคือ จู่โจม)', () => {
  assert.ok(!PET_PASSIVES.wolf.desc.includes('สายพลัง'), PET_PASSIVES.wolf.desc)
  assert.ok(!PET_PASSIVES.wolf.short.includes('สายพลัง'), PET_PASSIVES.wolf.short)
  assert.ok(PET_PASSIVES.wolf.desc.includes('จู่โจม'))
})

test('STATUS_ICON/STATUS_TEXT: มี duoRegen แล้ว (คู่หู 🐳🦭 เดิมไม่มีป้ายเลย)', () => {
  assert.equal(STATUS_ICON.duoRegen, '💧')
  assert.ok(STATUS_TEXT.duoRegen)
})
```

เพิ่ม `effectText`, `STATUS_ICON`, `STATUS_TEXT` เข้าใน import ของไฟล์เทส:

```js
import { PET_PASSIVES, passiveValueAt, passiveText, effectText, PASSIVE_MAX_LEVEL, STATUS_ICON, STATUS_TEXT } from '../data/petPassives.js'
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/battlePassives.test.js`
Expected: FAIL — `effectText is not a function`

- [ ] **Step 3: เพิ่ม `effectText` + `duoRegen` ลง `src/data/petPassives.js`**

ใต้ `passiveText` (บรรทัด ~188):

```js
/** ข้อความ "ผล" สั้นๆ พร้อมเลขจริงของขั้นนั้น — ใช้ในรายการบัฟหน้า inspect
 *  ฝาแฝดของ passiveText แต่กินฟิลด์ `short` (สั้นกว่า desc, เขียนจากมุมเจ้าของสกิล)
 *  ⚠️ ห้ามพิมพ์ตัวเลขลง short เอง — ใส่ {pct} {count} … แล้วให้ passiveValueAt เติม */
export function effectText(p, level = 1) {
  if (!p) return ''
  const v = passiveValueAt(p, level)
  return String(p.short || p.desc || '').replace(/\{(\w+)\}/g, (m, key) => (v[key] ?? m))
}
```

เติม `duoRegen` ลง `STATUS_ICON` และ `STATUS_TEXT`:

```js
export const STATUS_ICON = {
  teamHp: '❤️', teamAtk: '⚔️', teamAtkPerElement: '⚔️', teamCrit: '💥', enemyVuln: '🎯',
  guardian: '🛡️', damageReduction: '🧱', dodge: '💨', thorns: '⚡',
  revive: '🧿', saveAlly: '🧿', cheatDeath: '🧿', stackAtk: '⬆️',
  duoRegen: '💧',
}
```

```js
export const STATUS_TEXT = {
  teamHp: 'เลือดสูงสุดเพิ่ม', teamAtk: 'พลังโจมตีเพิ่ม', teamAtkPerElement: 'พลังโจมตีเพิ่ม',
  teamCrit: 'โอกาสคริเพิ่ม', enemyVuln: 'รับดาเมจเพิ่ม',
  guardian: 'มีเพื่อนรับแทนให้', damageReduction: 'ลดดาเมจที่ได้รับ', dodge: 'มีโอกาสหลบ',
  thorns: 'ตีแล้วเจ็บกลับ', revive: 'กันตายได้ 1 ครั้ง', saveAlly: 'กันเพื่อนตายได้ 1 ครั้ง',
  cheatDeath: 'กันตายได้ 1 ครั้ง', stackAtk: 'ยิ่งฆ่ายิ่งแรง',
  duoRegen: 'ทีมฟื้นเลือดทุกรอบ',
}
```

- [ ] **Step 4: เติม `short` ให้ครบ 22 ตัว + แก้ desc หมาป่า**

เพิ่มบรรทัด `short:` ต่อจาก `desc:` ของแต่ละรายการใน `PET_PASSIVES` ตามตารางนี้ (ลอกทั้งข้อความ อย่าย่อ):

| id | `short` |
|---|---|
| `bahamut` | `'เริ่มสู้ ยิงศัตรูทุกตัว {pct}% ของพลังโจมตี'` |
| `kirin` | `'น็อกแล้วได้ตีต่อ สูงสุด {max} ครั้ง/เทิร์น'` |
| `trex` | `'ล้มศัตรู 1 ตัว พลังโจมตี +{pct}% (สูงสุด {max} ชั้น)'` |
| `ouroboros` | `'ฟื้นเลือดตัวเอง {pct}% ทุกต้นรอบ'` |
| `simurgh` | `'เล็งศัตรูที่เลือดน้อยที่สุดเสมอ'` |
| `phoenix` | `'ตายครั้งแรกแล้วฟื้นด้วยเลือด {pct}%'` |
| `whale` | `'เลือดสูงสุดทั้งทีม +{pct}%'` |
| `qilin` | `'รับดาเมจแทนเพื่อนที่เลือดน้อยสุด {pct}%'` |
| `mammoth` | `'ลดดาเมจที่ตัวเองได้รับ {pct}%'` |
| `dragon` | `'ไฟลามโดนศัตรู {count} ตัว · ตัวรอง {pct}% ของดาเมจ'` |
| `cerberus` | `'เขี้ยวโดนศัตรู {count} ตัว · ตัวรอง {pct}% ของดาเมจ'` |
| `unicorn` | `'ฟื้นเลือดเพื่อนที่บอบช้ำสุด {pct}% ทุกต้นรอบ'` |
| `fairy` | `'โอกาสคริทั้งทีม +{pct}%'` |
| `panda` | `'ฟื้นเลือดตัวเอง {pct}% ทุกต้นรอบ'` |
| `genie` | `'กันเพื่อนไม่ให้ตาย {times} ครั้ง (เหลือเลือด 1)'` |
| `wolf` | `'พลังโจมตีทีม +{pct}% ต่อเพื่อนสายจู่โจม 1 ตัว'` |
| `shark` | `'ตีแรงขึ้น {pct}% กับศัตรูที่เลือดต่ำกว่า {below}%'` |
| `fox` | `'หลบการโจมตี {pct}%'` |
| `rabbit` | `'โอกาส {chance}% ตีสองทีรวด (ทีละ {pct}% ของดาเมจ)'` |
| `owl` | `'ศัตรูทุกตัวรับดาเมจเพิ่ม {pct}%'` |
| `seal` | `'พลังโจมตีทีม +{pct}% (คู่กับ 🐳 เป็น +{duoPct}%)'` |
| `hedgehog` | `'สะท้อน {pct}% ของดาเมจกลับไปที่ผู้โจมตี'` |
| `hamster` | `'ตอนเลือดเต็ม พลังโจมตี +{pct}%'` |
| `mouse` | `'หลบการโจมตี {pct}%'` |
| `cat` | `'รอดตายครั้งแรกด้วยเลือด 1'` |
| `butterfly` | `'ฟื้นเลือดเพื่อนที่บอบช้ำสุด {pct}% ทุกต้นรอบ'` |
| `turtle` | `'ลดดาเมจที่ตัวเองได้รับ {pct}%'` |

แล้วแก้ `desc` ของ `wolf` (บรรทัด ~105):

```js
    desc: 'พลังโจมตีทั้งทีม +{pct}% ต่อเพื่อนสายจู่โจม 1 ตัว',
```

- [ ] **Step 5: รันเทสให้เขียว**

Run: `node --test src/utils/battlePassives.test.js`
Expected: PASS ทั้งไฟล์ (เทสเดิมต้องไม่แดงด้วย)

- [ ] **Step 6: Commit**

```bash
git add src/data/petPassives.js src/utils/battlePassives.test.js
git commit -m "Passive: ข้อความผลตรงตัวต่อสกิล + แก้ 'สายพลัง' ที่ไม่มีอยู่จริง (อ่านแล้วไม่รู้ว่าได้อะไร)"
```

---

## Task 2: เอนจินคืนสเตตัสจริง (`result.units` + `statsAfter`)

**Files:**
- Modify: `src/utils/battlePassives.js`
- Modify: `src/utils/battleEngine.js`
- Test: `src/utils/battleEngine.test.js`

**Interfaces:**
- Consumes: `applyAuras(team, foes)`, `runOnKill(killer, chainUsed)` ที่มีอยู่
- Produces:
  - `simulateBattle()` คืน `{ winner, rounds, log, units }` โดย `units = { A0: { atk: number, maxHp: number }, ... }` = สเตตัส **หลัง aura ก่อนหมัดแรก** (ปัดเป็นจำนวนเต็ม)
  - event `t:'passive'` ที่เปลี่ยนสเตตัสจริง (`teamHp`, `teamAtk`, `teamAtkPerElement`, `stackAtk`) มีฟิลด์ `statsAfter: { A0: { atk, maxHp }, ... }` — snapshot **ของทั้งสองทีม** หลัง effect นั้นทำงานเสร็จ

- [ ] **Step 1: เขียนเทสที่ยังแดง**

ต่อท้าย `src/utils/battleEngine.test.js`:

```js
// ── สเตตัสที่ UI เอาไปวาด (units / statsAfter) ────────────────
const teamOf = (...ids) => ids.map(id => ({ id, rarity: 'legendary', element: 'fist', grade: 0 }))

test('result.units: มีครบทุก uid ของทั้งสองทีม พร้อม atk/maxHp', () => {
  const r = simulateBattle(teamOf('turtle', 'turtle'), teamOf('turtle'), 7)
  assert.deepEqual(Object.keys(r.units).sort(), ['A0', 'A1', 'B0'])
  for (const u of Object.values(r.units)) {
    assert.equal(typeof u.atk, 'number')
    assert.ok(u.maxHp > 0)
  }
})

test('result.units: ทีมมีคุณวาฬ → maxHp ทั้งทีม = ค่าดิบ × 1.10 (teamHp 10%)', () => {
  const withWhale = simulateBattle(teamOf('whale', 'turtle'), teamOf('turtle'), 7)
  const without   = simulateBattle(teamOf('turtle', 'turtle'), teamOf('turtle'), 7)
  // A1 เป็น turtle เกรด/ระดับเดียวกันทั้งสองไฟต์ ต่างกันแค่มีวาฬอยู่ในทีมหรือเปล่า
  const ratio = withWhale.units.A1.maxHp / without.units.A1.maxHp
  assert.ok(Math.abs(ratio - 1.10) < 0.01, `ratio ${ratio}`)
  // ศัตรูต้องไม่ได้รับผล (aura ลงทีมตัวเองเท่านั้น)
  assert.equal(withWhale.units.B0.maxHp, without.units.B0.maxHp)
})

test('statsAfter: ติดมากับ aura ที่เปลี่ยนค่าจริง ไม่ติดกับ aura ที่ไม่แตะ atk/maxHp', () => {
  const r = simulateBattle(teamOf('whale', 'fairy'), teamOf('turtle'), 7)
  const auras = r.log.filter(e => e.t === 'passive' && e.fxKind === 'aura')
  const hp   = auras.find(e => e.effect === 'teamHp')
  const crit = auras.find(e => e.effect === 'teamCrit')
  assert.ok(hp.statsAfter, 'teamHp ต้องมี statsAfter')
  assert.equal(crit.statsAfter, undefined, 'teamCrit ไม่แตะ atk/maxHp จึงไม่ต้องมี')
  assert.equal(hp.statsAfter.A0.maxHp, r.units.A0.maxHp)
})

test('statsAfter: stackAtk ส่ง atk ใหม่มาทุกชั้นที่สะสม', () => {
  // trex ตัวเดียวถล่มศัตรู 3 ตัวอ่อนๆ ให้มีโอกาสสะสมสแต็ก
  const r = simulateBattle(teamOf('trex'), Array.from({ length: 3 },
    () => ({ id: 'mouse', rarity: 'common', element: 'scissors', grade: 0 })), 3)
  const stacks = r.log.filter(e => e.t === 'passive' && e.effect === 'stackAtk')
  assert.ok(stacks.length >= 1, 'ควรมี stackAtk อย่างน้อย 1 ครั้ง')
  for (const s of stacks) assert.ok(s.statsAfter.A0.atk > 0)
  // ชั้นหลังต้องแรงกว่าชั้นก่อน
  if (stacks.length >= 2) assert.ok(stacks[1].statsAfter.A0.atk > stacks[0].statsAfter.A0.atk)
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/battleEngine.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'A0')` (ยังไม่มี `r.units`)

- [ ] **Step 3: เพิ่มตัวช่วย snapshot ใน `src/utils/battlePassives.js`**

ใต้ `const pctOf = …` (บรรทัด ~17):

```js
/** snapshot สเตตัสที่ "UI เอาไปวาด" ของทั้งสองทีม — atk/maxHp เท่านั้น
 *  🔑 เอนจินเป็นแหล่งความจริงเดียว · ถ้าปล่อยให้ UI คำนวณ aura เอง วันที่สูตรเปลี่ยนจะมีสองแหล่งทันที
 *  ⚠️ ชื่อฟิลด์ `statsAfter` ห้ามชนกับ `kind` ที่ buildBeats spread ทับ (CLAUDE.md ข้อ 15) */
export function statsSnapshot(...teams) {
  const out = {}
  for (const t of teams) for (const u of t) out[u.uid] = { atk: Math.round(u.atk), maxHp: Math.round(u.maxHp) }
  return out
}

/** effect ที่ขยับ atk/maxHp จริง — ตัวอื่น (teamCrit/enemyVuln) ไม่ต้องแบก snapshot ไปด้วย */
const STAT_EFFECTS = new Set(['teamHp', 'teamAtk', 'teamAtkPerElement', 'stackAtk'])
```

- [ ] **Step 4: แนบ `statsAfter` ใน `applyAuras`**

ใน `applyAuras(team, foes)` — event ถูก `push` **ก่อน** `switch` ที่แก้ stat จริง จึงต้องเก็บ ref ของ event ไว้แล้วเติมทีหลัง เปลี่ยนเป็น:

```js
export function applyAuras(team, foes) {
  const ids = new Set(alive(team).map(u => u.id))
  const out = []
  for (const u of team) {
    const p = passiveFor(u)
    if (!p || p.hook !== 'aura') continue
    const v = valOf(p, u)
    const e = ev(u, p, { targets: [u.uid], fxKind: 'aura' })
    out.push(e)
    switch (p.effect) {
      // … (สาขาทั้งหมดคงเดิม ไม่ต้องแก้) …
    }
    // ⚠️ ต้องเติม "หลัง" switch — event ถูก push ก่อนที่ stat จะเปลี่ยนจริง
    if (STAT_EFFECTS.has(p.effect)) e.statsAfter = statsSnapshot(team, foes)
  }
  return out
}
```

- [ ] **Step 5: แนบ `statsAfter` ใน `runOnKill`**

`runOnKill` มองเห็นแค่ `killer` ตัวเดียว จึงต้องรับทีมเข้ามาด้วย — เปลี่ยนลายเซ็นเป็น `runOnKill(killer, chainUsed, team, foes)` (พารามิเตอร์ใหม่ optional ให้เทสเดิมที่เรียก 2 ตัวไม่พัง) แล้วในสาขา `stackAtk` หลัง `killer.atk *= …`:

```js
  if (p.effect === 'stackAtk') {
    const stacks = killer.atkStacks || 0
    if (stacks < v.max) {
      killer.atkStacks = stacks + 1
      killer.atk *= 1 + v.pct / 100
      const e = ev(killer, p, { targets: [killer.uid], amount: killer.atkStacks, fxKind: 'buff' })
      if (team && foes) e.statsAfter = statsSnapshot(team, foes)
      out.events.push(e)
    }
  }
```

- [ ] **Step 6: ส่งทีมเข้า `runOnKill` + คืน `units` ใน `src/utils/battleEngine.js`**

ในบล็อกหลังหมัด (บรรทัด ~120–130) `runOnKill(att, chain)` มี 2 จุด — ทั้งคู่อยู่ในสโคปที่ `att` เป็นฝั่งผู้ตี และ `foes` คือทีมตรงข้าม ต้องส่ง **ทีมของผู้ตี** เป็น `team`:

```js
        const k = runOnKill(att, chain, team, foes)
```
```js
      if (killed) { const k = runOnKill(att, chain, team, foes); for (const e of k.events) log.push(e) }
```

(ตัวแปร `team` ในลูปคือทีมของ `att` อยู่แล้ว — ยืนยันด้วยการอ่านบรรทัดเหนือขึ้นไปก่อนแก้)

เก็บ snapshot หลัง aura — เพิ่มบรรทัดใต้ `for (const e of auraEvents) log.push(e)`:

```js
  // สเตตัสหลัง aura ก่อนหมัดแรก = "ตัวหารจริง" ของหลอดเลือดฝั่ง UI
  // (targetHpAfter ใน log อยู่บนสเกลนี้ ไม่ใช่ค่าดิบ)
  const units = statsSnapshot(A, B)
```

เพิ่ม `statsSnapshot` ใน import ด้านบนไฟล์:

```js
import {
  applyAuras, runOnStart, runOnRound, runOnAttack, runOnHit, runOnDeath, runOnKill, statsSnapshot,
} from './battlePassives.js'
```

แล้วแก้บรรทัดสุดท้าย:

```js
  return { winner, rounds: round, log, units }
```

- [ ] **Step 7: รันเทสให้เขียว**

Run: `node --test src/utils/battleEngine.test.js src/utils/battlePassives.test.js src/utils/battleBeats.test.js src/utils/battleSummary.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 8: Commit**

```bash
git add src/utils/battleEngine.js src/utils/battlePassives.js src/utils/battleEngine.test.js
git commit -m "Battle: เอนจินคืนสเตตัสจริง units + statsAfter (UI จะได้ไม่ต้องคำนวณ aura ซ้ำ)"
```

---

## Task 3: `battleBuffs.js` — ที่มาของบัฟ + สถานะสด

**Files:**
- Create: `src/utils/battleBuffs.js`
- Create: `src/utils/battleBuffs.test.js`

**Interfaces:**
- Consumes: `PET_PASSIVES`, `effectText`, `STATUS_ICON`, `STATUS_TEXT`, `TEAM_AURA_EFFECTS`, `FOE_AURA_EFFECTS`, `SELF_STATUS_EFFECTS` จาก `../data/petPassives.js` · `getPetDef` จาก `../data/index.js`
- Produces:
  - `buffSources(playerTeam, botTeam) → { A0: Buff[], B0: Buff[], … }`
    `Buff = { key, effect, icon, label, skillName, skillIcon, ownerUid, ownerName, ownerEmoji, self, buff, foeSide }`
    - `key` = string ไม่ซ้ำในลิสต์เดียว (`effect + ':' + ownerUid`)
    - `icon` = `STATUS_ICON[effect]` (ไอคอนของ **ผล**) · `label` = `effectText(passive)` (ข้อความผลพร้อมเลข)
    - `skillIcon`/`skillName` = ของ passive · `ownerEmoji`/`ownerName` = ของเพ็ทเจ้าของ
    - `self` = เจ้าของคือยูนิตนั้นเอง · `buff` = true/false · `foeSide` = เจ้าของอยู่ทีมตรงข้าม
  - `liveBuffs(sources, beats, idx) → Buff[]` เหมือนเดิม + `{ stacks?: number, maxStacks?: number, spent?: boolean }`
  - `badgesOf(list, max) → { key, icon, label, buff }[]` — ย่อให้เหลือรูปที่ป้ายบนการ์ดใช้ (ตัดที่มาทิ้ง + ตัดที่ `max`)

- [ ] **Step 1: เขียนเทสที่ยังแดง**

สร้าง `src/utils/battleBuffs.test.js`:

```js
// เทสที่มาของบัฟ + สถานะสด — pure ทั้งหมด · รัน: node --test src/utils/battleBuffs.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buffSources, liveBuffs, badgesOf } from './battleBuffs.js'
import { STATUS_MAX } from '../data/petPassives.js'

const p = (id, over = {}) => ({ id, rarity: 'legendary', element: 'fist', grade: 0, ...over })
const find = (list, effect) => list.find(b => b.effect === effect)

test('บัฟจากทีมตัวเอง: คุณวาฬในทีม → ❤️ ขึ้นทุกใบฝั่งเรา พร้อมชื่อเจ้าของ', () => {
  const s = buffSources([p('whale'), p('turtle')], [p('mouse')])
  for (const uid of ['A0', 'A1']) {
    const b = find(s[uid], 'teamHp')
    assert.ok(b, `${uid} ควรได้ teamHp`)
    assert.equal(b.ownerUid, 'A0')
    assert.equal(b.skillName, 'พรมหาสมุทร')
    assert.equal(b.buff, true)
    assert.equal(b.foeSide, false)
    assert.match(b.label, /10/)          // effectText เติมเลขจริงให้แล้ว
  }
  assert.equal(find(s.B0, 'teamHp'), undefined, 'aura ต้องไม่ข้ามไปทีมศัตรู')
})

test('ดีบัฟข้ามฝั่ง: นกฮูกอยู่ทีมศัตรู → 🎯 ขึ้นบนทีมเรา ติดธง foeSide', () => {
  const s = buffSources([p('turtle')], [p('owl')])
  const b = find(s.A0, 'enemyVuln')
  assert.ok(b)
  assert.equal(b.buff, false)
  assert.equal(b.foeSide, true)
  assert.equal(b.ownerUid, 'B0')
  assert.equal(b.ownerName, 'นกฮูก')
  assert.equal(find(s.B0, 'enemyVuln'), undefined, 'เจ้าของ aura ไม่ควรติดดีบัฟของตัวเอง')
})

test('สถานะติดตัว: ขึ้นเฉพาะเจ้าตัว และ self = true', () => {
  const s = buffSources([p('fox'), p('turtle')], [p('mouse')])
  const b = find(s.A0, 'dodge')
  assert.ok(b)
  assert.equal(b.self, true)
  assert.equal(find(s.A1, 'dodge'), undefined, 'เพื่อนไม่ควรได้ dodge ไปด้วย')
})

test('คู่หู 🐳🦭: duoRegen ขึ้นครบทีมเมื่อมีทั้งคู่ · ไม่ขึ้นเมื่อมีตัวเดียว', () => {
  const both = buffSources([p('whale'), p('seal')], [p('mouse')])
  assert.ok(find(both.A0, 'duoRegen'), 'A0 ควรได้ duoRegen')
  assert.ok(find(both.A1, 'duoRegen'), 'A1 ควรได้ duoRegen')
  const solo = buffSources([p('seal'), p('turtle')], [p('mouse')])
  assert.equal(find(solo.A0, 'duoRegen'), undefined, 'ไม่มีวาฬ = ไม่มีคู่หู')
})

test('key ไม่ซ้ำในลิสต์เดียว (สอง passive ที่ให้ effect เดียวกันต้องอยู่ได้ทั้งคู่)', () => {
  const s = buffSources([p('fox'), p('mouse')], [p('turtle')])   // dodge ทั้งคู่ แต่คนละตัว
  const keys = [...s.A0, ...s.A1].map(b => b.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('liveBuffs: stacks นับตาม idx — ก่อนถึง beat = 0 · หลัง 2 beat = 2', () => {
  const s = buffSources([p('trex')], [p('mouse'), p('mouse')])
  const beats = [
    { t: 'attack', attacker: 'A0', target: 'B0' },
    { t: 'passive', uid: 'A0', effect: 'stackAtk', amount: 1 },
    { t: 'attack', attacker: 'A0', target: 'B1' },
    { t: 'passive', uid: 'A0', effect: 'stackAtk', amount: 2 },
  ]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'stackAtk').stacks, 0)
  assert.equal(find(liveBuffs(s.A0, beats, 1), 'stackAtk').stacks, 1)
  assert.equal(find(liveBuffs(s.A0, beats, 3), 'stackAtk').stacks, 2)
  assert.equal(find(liveBuffs(s.A0, beats, 3), 'stackAtk').maxStacks, 3)
})

test('liveBuffs: spent — เห็น event revive แล้วต้องเป็น true', () => {
  const s = buffSources([p('phoenix')], [p('mouse')])
  const beats = [{ t: 'attack', attacker: 'B0', target: 'A0' },
                 { t: 'passive', uid: 'A0', effect: 'revive', fxKind: 'revive' }]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'revive').spent, false)
  assert.equal(find(liveBuffs(s.A0, beats, 1), 'revive').spent, true)
})

test('liveBuffs: saveAlly ของเพื่อนถูกใช้ → นับที่ "เจ้าของ" ไม่ใช่คนที่ถูกช่วย', () => {
  const s = buffSources([p('genie'), p('turtle')], [p('mouse')])
  const beats = [{ t: 'passive', uid: 'A0', effect: 'saveAlly', targets: ['A1'], fxKind: 'save' }]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'saveAlly').spent, true)
})

test('badgesOf: ตัดที่มาทิ้ง + ไม่เกิน STATUS_MAX', () => {
  const s = buffSources([p('whale'), p('fairy'), p('wolf'), p('fox')], [p('owl')])
  const b = badgesOf(s.A3, STATUS_MAX)
  assert.ok(b.length <= STATUS_MAX)
  assert.deepEqual(Object.keys(b[0]).sort(), ['buff', 'icon', 'key', 'label'])
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/battleBuffs.test.js`
Expected: FAIL — `Cannot find module './battleBuffs.js'`

- [ ] **Step 3: เขียน `src/utils/battleBuffs.js`**

```js
// src/utils/battleBuffs.js
// "ตอนนี้ตัวนี้ติดบัฟอะไร มาจากใคร" — pure ทั้งหมด ไม่แตะ store/DOM/Date
// สเปก: docs/superpowers/specs/2026-08-30-enemy-passive-and-live-buffs-design.md
//
// 🔑 ต่างจาก statusMap เดิมตรงที่ "เก็บที่มาไว้" — ของเดิมยุบเป็น Set ของ effect
//    ทำให้บอกได้แค่ว่าได้อะไร ไม่รู้ว่าใครให้
// 🔒 ห้ามเรียกตัวไหนในนี้ระหว่างการ์ดมีอนิเมชันวิ่ง — เรียกได้เฉพาะตอนไฟต์พัก (เปิด inspect)
import { getPetDef } from '../data/index.js'
import {
  PET_PASSIVES, effectText, STATUS_ICON, STATUS_TEXT,
  TEAM_AURA_EFFECTS, FOE_AURA_EFFECTS, SELF_STATUS_EFFECTS,
} from '../data/petPassives.js'

const passiveOf = (pet) => PET_PASSIVES[pet?.id] || null
const defOf = (pet) => getPetDef(pet?.id) || { name: '?', emoji: '❓' }

/** effect ที่ "ใช้แล้วหมด" — เห็น event ของมันใน beat ที่ผ่านมา = หมดฤทธิ์ */
const ONE_SHOT = new Set(['revive', 'cheatDeath', 'saveAlly'])

function makeBuff(effect, owner, ownerUid, opts) {
  const p = opts.passive
  const def = defOf(owner)
  return {
    key: `${effect}:${ownerUid}`,
    effect,
    icon: STATUS_ICON[effect] || '',
    label: opts.label ?? effectText(p, owner?.passiveLv),
    skillName: opts.skillName ?? p?.name ?? '',
    skillIcon: opts.skillIcon ?? p?.icon ?? '',
    ownerUid,
    ownerName: def.name,
    ownerEmoji: def.emoji,
    self: false,
    buff: opts.buff !== false,
    foeSide: !!opts.foeSide,
  }
}

/** aura ของทีมหนึ่ง: effect → { owner, uid, passive } (ตัวแรกที่เจอเป็นเจ้าของ) */
function aurasOf(team, side) {
  const mine = [], theirs = [], duo = []
  const ids = new Set(team.filter(Boolean).map(p => p.id))
  team.forEach((pet, i) => {
    const p = passiveOf(pet)
    if (!p || p.hook !== 'aura') return
    const entry = { owner: pet, uid: side + i, passive: p }
    if (TEAM_AURA_EFFECTS.has(p.effect)) mine.push({ effect: p.effect, ...entry })
    else if (FOE_AURA_EFFECTS.has(p.effect)) theirs.push({ effect: p.effect, ...entry })
    // คู่หู: teamAtk ที่มี duoWith และเพื่อนคนนั้นอยู่ในทีมจริง → ทีมได้ regen เพิ่มอีกช่อง
    if (p.effect === 'teamAtk' && p.value?.duoWith && ids.has(p.value.duoWith)) {
      duo.push({ effect: 'duoRegen', ...entry })
    }
  })
  return { mine, theirs, duo }
}

/**
 * ผูก effect เข้ากับตัวที่เป็นเจ้าของ → รู้ว่าบัฟแต่ละอันมาจากไหน
 * @returns {{[uid: string]: object[]}} คีย์เป็น uid (A0/B1/…) เหมือนที่ engine ใช้
 */
export function buffSources(playerTeam, botTeam) {
  const teams = { A: playerTeam || [], B: botTeam || [] }
  const aura = { A: aurasOf(teams.A, 'A'), B: aurasOf(teams.B, 'B') }
  const out = {}
  for (const side of ['A', 'B']) {
    const own = aura[side], foe = aura[side === 'A' ? 'B' : 'A']
    teams[side].forEach((pet, i) => {
      const uid = side + i
      const list = []
      // 1) สถานะติดตัว — ขึ้นเฉพาะเจ้าตัว
      const self = passiveOf(pet)
      if (self && SELF_STATUS_EFFECTS.has(self.effect)) {
        const b = makeBuff(self.effect, pet, uid, { passive: self })
        b.self = true
        list.push(b)
      }
      // 2) aura จากทีมตัวเอง (รวมของตัวเอง) + คู่หู
      for (const a of [...own.mine, ...own.duo]) {
        const b = makeBuff(a.effect, a.owner, a.uid, {
          passive: a.passive,
          // duoRegen ไม่ใช่ผลหลักของ passive นั้น จึงใช้คำกลางแทน effectText
          label: a.effect === 'duoRegen' ? STATUS_TEXT.duoRegen : undefined,
        })
        b.self = a.uid === uid
        list.push(b)
      }
      // 3) ดีบัฟที่ศัตรูแผ่ใส่
      for (const a of foe.theirs) {
        list.push(makeBuff(a.effect, a.owner, a.uid, { passive: a.passive, buff: false, foeSide: true }))
      }
      out[uid] = list
    })
  }
  return out
}

/**
 * เติมสถานะสดจาก beat ที่เล่นไปแล้ว (0..idx)
 * ⚠️ ต้องเรียกตอนไฟต์พักเท่านั้น — ดูหัวไฟล์
 */
export function liveBuffs(sources, beats, idx) {
  const played = (beats || []).slice(0, Math.max(0, (idx ?? -1) + 1))
  return (sources || []).map((b) => {
    if (b.effect === 'stackAtk') {
      let stacks = 0
      for (const e of played) {
        if (e?.t === 'passive' && e.effect === 'stackAtk' && e.uid === b.ownerUid) stacks = e.amount || stacks
      }
      return { ...b, stacks, maxStacks: maxStacksOf(b) }
    }
    if (ONE_SHOT.has(b.effect)) {
      const spent = played.some(e => e?.t === 'passive' && e.effect === b.effect && e.uid === b.ownerUid)
      return { ...b, spent }
    }
    return b
  })
}

/** เพดานสแต็กของเจ้าของ — อ่านจากทะเบียน ไม่ใช่เลขพิมพ์มือ */
function maxStacksOf(b) {
  for (const p of Object.values(PET_PASSIVES)) {
    if (p.effect === b.effect && p.name === b.skillName) return p.value?.max ?? 0
  }
  return 0
}

/** ย่อเป็นรูปที่ป้ายไอคอนเล็กบนการ์ดใช้ — ตัดที่มาทิ้ง + ตัดที่ max
 *  ⚠️ ต้องไม่มี effect ซ้ำ (ป้ายซ้ำ 2 อันบนการ์ดเดียวอ่านไม่รู้เรื่อง) */
export function badgesOf(list, max) {
  const seen = new Set()
  const out = []
  for (const b of list || []) {
    if (!b.icon || seen.has(b.effect)) continue
    seen.add(b.effect)
    out.push({ key: b.effect, icon: b.icon, label: STATUS_TEXT[b.effect] || '', buff: b.buff })
    if (out.length >= max) break
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `node --test src/utils/battleBuffs.test.js`
Expected: PASS ทั้ง 9 เทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleBuffs.js src/utils/battleBuffs.test.js
git commit -m "Battle: battleBuffs เก็บที่มาของบัฟ + สถานะสดตามจังหวะ (statusMap เดิมยุบเป็น Set จนที่มาหาย)"
```

---

## Task 4: เลขบนการ์ดในรีเพลย์วิ่งตามสกิล (`dispStats`)

**Files:**
- Modify: `src/components/battle/BattleReplay.vue`

**Interfaces:**
- Consumes: `result.units` + `statsAfter` จาก Task 2
- Produces: `atkOf(uid)` / `curHp(uid)` / `ticksFor(uid)` อ่านจาก `dispStats` (reactive) แทน `unitAtk`/`maxHp`

**🔴 จุดที่พลาดแล้วพังทั้งไฟต์ ไม่ใช่แค่เลขเพี้ยน — อ่านให้จบก่อนแก้:**

| ตัวแปร | คือ | reactive? |
|---|---|---|
| `maxHp` (plain object เดิม) | **ค่าหลัง aura** จาก `result.units` — เป็นตัวหาร `hp%` และป้อน `buildBeats` | **ห้าม** ถ้าทำเป็น ref แล้ว `beats` จะ re-compute กลางไฟต์ ขณะ `idx` ชี้เข้าอาเรย์เก่า |
| `dispStats` (ref ใหม่) | เลขที่พิมพ์บนการ์ด เริ่มค่าดิบ วิ่งตาม `statsAfter` | ใช่ |

- [ ] **Step 1: เปลี่ยน `buildMax` ให้ใช้ `result.units` + ตั้ง `dispStats` เป็นค่าดิบ**

หาบรรทัดประกาศ `let maxHp = {}` / `let unitAtk = {}` (อยู่เหนือ `buildMax`) —
**ลบ `unitAtk` ทิ้งทั้งตัว** เพราะ Step 2 จะให้ `atkOf()` อ่านจาก `dispStats` แทน ไม่มีใครใช้มันอีก ·
**เก็บ `let maxHp = {}` ไว้** เพราะ `buildBeats(rawLog, maxHp)` ยังต้องใช้ และมันต้องไม่ reactive

แล้วแทน `buildMax(d)` (บรรทัด ~360) ด้วย:

```js
// เลขที่ "พิมพ์บนการ์ด" — เริ่มที่ค่าดิบ แล้ววิ่งตาม statsAfter ที่เอนจินส่งมา
// (ผู้เล่นต้องเห็นค่าเดียวกับตอนจัดทีม แล้วเห็นมันขยับตอนสกิลทำงาน — user สั่ง 30 ส.ค.)
const dispStats = ref({})

function buildMax(d) {
  maxHp = {}
  const disp = {}
  const add = (p, uid) => {
    const c = buildCombatant(p)
    disp[uid] = { atk: Math.round(c.atk), maxHp: Math.round(c.maxHp) || 1 }
    // 🔑 ตัวหาร hp% ต้องเป็นค่า "หลัง aura" ของเอนจิน ไม่ใช่ค่าดิบ
    //    log ส่ง targetHpAfter มาบนสเกลนั้น — ใช้ค่าดิบแล้วทีมที่มีคุณวาฬหลอดจะเริ่มเกิน 100%
    maxHp[uid] = Math.round(d?.result?.units?.[uid]?.maxHp ?? disp[uid].maxHp) || 1
  }
  ;(d?.botTeam || []).forEach((p, i) => add(p, 'B' + i))
  ;(d?.playerTeam || []).forEach((p, i) => add(p, 'A' + i))
  dispStats.value = disp
  if (import.meta.env.DEV) warnTeamMismatch(d)
}
```

- [ ] **Step 2: ให้ตัวอ่านทั้งสามใช้ `dispStats`**

แทนที่ 3 ฟังก์ชัน (บรรทัด ~296):

```js
function atkOf(uid) { return dispStats.value[uid]?.atk ?? 0 }
function curHp(uid) {
  const max = dispStats.value[uid]?.maxHp || 0
  return Math.round(max * (hp.value[uid] ?? 100) / 100)
}
function ticksFor(uid) {
  const max = dispStats.value[uid]?.maxHp || 1, out = []
  for (let h = 50; h < max; h += 50) out.push((h / max) * 100)  // % ตำแหน่งขีดทุก 50 HP
  return out
}
```

- [ ] **Step 3: รับ `statsAfter` ตอน beat เล่นถึง**

ใน `step()` (บรรทัด ~748) มีบรรทัด `const b = beats.value[idx.value]` — เพิ่ม **ต่อจากบรรทัดนั้นทันที**
ก่อนที่ beat จะถูก dispatch ไปตามชนิด:

```js
    // สกิลเปลี่ยนสเตตัสจริง → เลขบนการ์ดขยับตรงนี้ให้ผู้เล่นเห็น
    // (aura เล่นในกลุ่มเปิดตอนไม่มีการ์ดใบไหนมีอนิเมชัน · stackAtk ≤3 ครั้ง/ไฟต์ ตามเพดาน trex)
    // ⚠️ ที่นี่ที่เดียว — อย่าไปกระจายใส่ตาม handler รายชนิด จะพลาดชนิดใดชนิดหนึ่งแน่
    if (b?.statsAfter) dispStats.value = { ...dispStats.value, ...b.statsAfter }
```

⚠️ ต้องอยู่ **นอก** `try/catch` ที่ครอบ dispatch — ถ้า handler ชนิดไหนโยน error เลขก็ยังต้องถูกต้อง

- [ ] **Step 4: คืนค่าดิบตอน reset**

ใน `reset()` (บรรทัด ~417) `buildMax(d)` ถูกเรียกอยู่แล้วซึ่งตั้ง `dispStats` ใหม่ทั้งก้อน — **ยืนยันว่า `buildMax` ถูกเรียกใน reset จริง** ถ้าไม่ ให้เพิ่ม `buildMax(props.data)` เข้าไป ไม่งั้นไฟต์ที่ 2 จะเริ่มด้วยเลขบัฟของไฟต์ก่อน (เคสเดียวกับบั๊ก fx re-attach 18 ก.ค.)

- [ ] **Step 5: ตรวจว่า build ผ่าน**

Run: `npm run build`
Expected: build สำเร็จ ไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/components/battle/BattleReplay.vue
git commit -m "Battle: เลข ATK/HP บนการ์ดเริ่มค่าดิบแล้ววิ่งตามสกิล + ซ่อมหลอดเลือดเกิน 100% ตอนมีคุณวาฬ"
```

---

## Task 5: บล็อก "กำลังได้รับ" ในหน้าต่าง inspect

**Files:**
- Modify: `src/components/battle/BattleReplay.vue`

**Interfaces:**
- Consumes: `buffSources`, `liveBuffs`, `badgesOf` จาก Task 3
- Produces: —

- [ ] **Step 1: เปลี่ยน `statusMap` มา derive จาก `buffSources`**

แทนที่ `statusMap` ทั้งก้อน (บรรทัด ~314–347) — **คงคอมเมนต์กฎเหล็ก perf เดิมไว้ทั้งหมด** แล้วเปลี่ยนไส้ใน:

```js
// แหล่งความจริงเดียวของ "ใครติดบัฟอะไร มาจากใคร" — ป้ายบนการ์ดคือของก้อนนี้ที่ตัดที่มาทิ้ง
const buffMap = computed(() => buffSources(props.data?.playerTeam || [], props.data?.botTeam || []))
const statusMap = computed(() => {
  const out = {}
  for (const [uid, list] of Object.entries(buffMap.value)) out[uid] = badgesOf(list, STATUS_MAX)
  return out
})
function statusOf(uid) { return statusMap.value[uid] || [] }
```

ลบ import ที่ไม่ใช้แล้วออกจากหัวไฟล์ (`TEAM_AURA_EFFECTS`, `FOE_AURA_EFFECTS`, `SELF_STATUS_EFFECTS`, `STATUS_ICON`, `STATUS_TEXT`) — เก็บ `STATUS_MAX` ไว้ · เพิ่ม:

```js
import { buffSources, liveBuffs, badgesOf } from '../../utils/battleBuffs.js'
```

⚠️ `statusOf()` ในเทมเพลตอ่าน `st.key` / `st.icon` / `st.buff` — `badgesOf` คืนคีย์ครบทั้งสามแล้ว ไม่ต้องแก้เทมเพลตส่วนป้าย

- [ ] **Step 2: เพิ่ม computed ของรายการบัฟสด**

ใต้ `const insp = computed(…)` (บรรทัด ~801):

```js
// รายการบัฟที่ยูนิตนี้กำลังได้รับ — คำนวณตอนเปิดหน้าต่างเท่านั้น (ไฟต์พักแล้ว ไม่ชนกฎเหล็ก perf)
const inspBuffs = computed(() => {
  const uid = inspectUid.value
  if (!uid) return []
  return liveBuffs(buffMap.value[uid] || [], beats.value, idx.value)
})
```

- [ ] **Step 3: เพิ่มบล็อกในเทมเพลต**

ใต้ `<div v-if="insp.passive" class="br-card-passdesc">…</div>` (บรรทัด ~154) ก่อนปุ่มปิด:

```html
        <div v-if="inspBuffs.length" class="br-buffs">
          <div class="br-buffs-head">กำลังได้รับ</div>
          <div v-for="b in inspBuffs" :key="b.key" class="br-buff"
               :class="{ dbf: !b.buff, spent: b.spent }">
            <div class="br-buff-src">
              <Emoji :char="b.skillIcon" /> {{ b.skillName }}
              <span class="br-buff-owner">
                · <template v-if="b.self">ตัวเอง</template>
                <template v-else><Emoji :char="b.ownerEmoji" /> {{ b.ownerName }}</template>
                <template v-if="b.foeSide"> · ฝ่ายศัตรู</template>
              </span>
            </div>
            <div class="br-buff-eff">
              <Emoji :char="b.icon" /> {{ b.label }}
              <span v-if="b.spent" class="br-buff-tag">ใช้ไปแล้ว</span>
              <span v-else-if="b.maxStacks" class="br-buff-tag">{{ b.stacks }}/{{ b.maxStacks }} ชั้น</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 4: เพิ่ม CSS**

ต่อท้ายบล็อก `.br-card-*` ใน `<style scoped>`:

```css
/* รายการบัฟในการ์ด inspect — พื้นการ์ดเป็น #1e293b (เข้ม)
   ⚠️ ถมเขียว/แดงทึบแล้ววางตัวอักษรสว่าง = แสบตาและอ่านยากกว่าเดิม
   จึงใช้พื้นจาง 16% + แถบสีทึบขอบซ้าย · วัดแล้ว 9.9:1 (บัฟ) และ 11.4:1 (ดีบัฟ) ผ่าน AA สบาย
   สีไม่ใช่ตัวบอกเดียว — ไอคอนของผลกับคำว่า "ฝ่ายศัตรู" ซ้ำอีก 2 ชั้น (ตาบอดสีเขียว-แดงพบบ่อยสุด) */
.br-buffs { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.br-buffs-head { font-size: .74rem; font-weight: 800; color: #94a3b8; margin-bottom: 2px; }
.br-buff {
  border-left: 3px solid #4ade80; border-radius: 0 10px 10px 0;
  background: rgba(34,197,94,.16); padding: 6px 9px;
}
.br-buff.dbf { border-left-color: #f87171; background: rgba(239,68,68,.16); }
/* ใช้ไปแล้ว = ไม่ได้ให้อะไรอีก ถ้ายังเขียวอยู่จะอ่านผิดว่ายังกันตายได้ */
.br-buff.spent { border-left-color: #94a3b8; background: rgba(148,163,184,.14); opacity: .62; }
.br-buff-src { font-size: .78rem; font-weight: 800; color: #f1f5f9; }
.br-buff-owner { font-weight: 700; color: #cbd5e1; }
.br-buff-eff { font-size: .76rem; color: #e2e8f0; margin-top: 1px; }
.br-buff-tag {
  margin-left: 6px; font-size: .7rem; font-weight: 800; color: #cbd5e1;
  background: rgba(255,255,255,.12); border-radius: 999px; padding: 1px 7px;
}
```

- [ ] **Step 5: ตรวจฟอนต์ขั้นต่ำ + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: ไม่เจออะไร

Run: `npm run build`
Expected: build สำเร็จ

- [ ] **Step 6: รันเทสฝั่ง battle ทั้งชุดกันของเดิมแดง**

Run: `node --test src/utils/battleBuffs.test.js src/utils/battlePassives.test.js src/utils/battleEngine.test.js src/utils/battleBeats.test.js src/utils/battleSummary.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 7: Commit**

```bash
git add src/components/battle/BattleReplay.vue
git commit -m "Battle: หน้าต่างดูตัวบอกบัฟที่กำลังได้รับ พร้อมชื่อสกิลกับเจ้าของ (เดิมเห็นแค่ไอคอนเล็กไม่รู้ที่มา)"
```

---

## Task 6: `PetScoutCard.vue` + เชื่อมหอคอย

**Files:**
- Create: `src/components/pets/PetScoutCard.vue`
- Modify: `src/views/TowerView.vue`
- Modify: `src/components/tower/FloorSheet.vue`

**Interfaces:**
- Consumes: `getPetDef`, `RARITY`, `GRADE_LABELS`, `ELEMENTS`, `EL_NAME` จาก `../../data/index.js` · `buildCombatant` จาก `../../data/battle.js` · `passiveOf` จาก `../../data/index.js` · `passiveText` จาก `../../data/petPassives.js` · `useEscapeKey`
- Produces: component `<PetScoutCard :pet="pet" @close="…" />` — `pet = null` = ปิด

- [ ] **Step 1: สร้าง `src/components/pets/PetScoutCard.vue`**

```vue
<!-- PetScoutCard — การ์ดสอดแนมเพ็ท (สเตตัส + ทักษะเฉพาะ) ใช้ร่วมหอคอย/แผ่นชั้น/สนามประลอง
     ก่อนหน้านี้การ์ดแบบนี้เขียนซ้ำ 3 ที่ (tw-scout · br-card · PetStatPopup) และไม่มีที่ไหนบอกพาสสีฟเลย
     ยกเว้น br-card — ผู้เล่นจึงจัดทีมสู้ศัตรูโดยไม่รู้ว่าอีกฝั่งมีสกิลอะไร
     ⚠️ BattleReplay ไม่ใช้ตัวนี้ — การ์ดในนั้นมีบัฟสดเพิ่มและอยู่ใต้กฎ perf ของสนามรบ
     ⚠️ ATK/HP ที่โชว์เป็น "ค่าดิบ" ยังไม่ผ่าน aura — ตรงกับเลขที่รีเพลย์เปิดมาตอน READY-GO -->
<template>
  <!-- Teleport ไป body: #main-content เป็น stacking context (CLAUDE.md ข้อ 6)
       z410 เพราะถูกเปิดจากในแผ่นชั้นหอคอยซึ่งเป็น BottomSheet z400 (CLAUDE.md ข้อ 12) -->
  <Teleport to="body">
    <div v-if="pet" class="psc-ov" @click.self="$emit('close')">
      <div class="psc-box">
        <div class="psc-emoji"><Emoji :char="def.emoji" /></div>
        <div class="psc-name">{{ def.name }}</div>
        <div class="psc-row"><span>สาย</span><b><Emoji :char="elEmoji" /> {{ elName }}</b></div>
        <div class="psc-row"><span>ระดับ</span><b>{{ rarityLabel }} · เกรด {{ gradeLabel }}</b></div>
        <div class="psc-row"><span>พลังโจมตี</span><b>{{ stat.atk }}</b></div>
        <div class="psc-row"><span>พลังชีวิต</span><b>{{ stat.hp }}</b></div>

        <div class="psc-sep"></div>
        <template v-if="passive">
          <div class="psc-skill"><Emoji :char="passive.icon" /> {{ passive.name }}</div>
          <div class="psc-skill-desc">{{ passiveText(passive, pet.passiveLv) }}</div>
        </template>
        <div v-else class="psc-skill-desc">ตัวนี้ยังไม่มีทักษะเฉพาะ</div>

        <button class="psc-x" @click="$emit('close')">ปิด</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { getPetDef, passiveOf, RARITY, GRADE_LABELS, ELEMENTS, EL_NAME } from '../../data/index.js'
import { passiveText } from '../../data/petPassives.js'
import { buildCombatant } from '../../data/battle.js'
import { useEscapeKey } from '../../composables/useEscapeKey.js'

const props = defineProps({ pet: { type: Object, default: null } })
const emit = defineEmits(['close'])
useEscapeKey(() => !!props.pet, () => emit('close'))

const def = computed(() => getPetDef(props.pet?.id) || { emoji: '❓', name: '?', element: 'scissors', rarity: 'common' })
const passive = computed(() => passiveOf(def.value))
const elEmoji = computed(() => ELEMENTS[def.value.element]?.emoji || '✊')
const elName = computed(() => EL_NAME[def.value.element] || def.value.element)
const rarityLabel = computed(() => RARITY[props.pet?.rarity || def.value.rarity]?.label || def.value.rarity)
const gradeLabel = computed(() => GRADE_LABELS[Math.min(5, Math.max(0, props.pet?.grade || 0))])
const stat = computed(() => {
  if (!props.pet) return { atk: 0, hp: 0 }
  const c = buildCombatant(props.pet)
  return { atk: Math.round(c.atk), hp: Math.round(c.maxHp) }
})
</script>

<style scoped>
/* ⚠️ พื้นการ์ดเข้ม #1e293b — ตัวอักษรต้องสว่างทั้งหมด ห้าม rgba(0,0,0,…) (CLAUDE.md ข้อ 13) */
.psc-ov { position: fixed; inset: 0; z-index: 410; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.psc-box { background: #1e293b; color: #fff; border: 2px solid #fff; border-radius: 18px; padding: 16px 18px; width: 268px; display: flex; flex-direction: column; gap: 7px; max-height: 88vh; overflow-y: auto; }
.psc-emoji { font-size: 2.8rem; text-align: center; }
.psc-name { text-align: center; font-weight: 800; font-size: 1.1rem; margin-bottom: 4px; }
.psc-row { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; }
.psc-row span { color: rgba(255,255,255,.6); }
.psc-sep { height: 1px; background: rgba(255,255,255,.16); margin: 4px 0 2px; }
.psc-skill { font-size: .84rem; font-weight: 800; color: #fde68a; }
.psc-skill-desc { font-size: .76rem; line-height: 1.5; color: #cbd5e1; }
.psc-x { margin-top: 10px; border: 2px solid #fff; background: rgba(255,255,255,.14); color: #fff; border-radius: 12px; padding: 9px; font-family: inherit; font-weight: 800; cursor: pointer; }
</style>
```

⚠️ ก่อนเขียน ให้ยืนยันว่า `passiveOf` ถูก export จาก `src/data/index.js` จริง (`BattleReplay.vue` import มาจากที่นั่น) — ถ้าไม่ใช่ ให้ใช้ `PET_PASSIVES[def.id]` จาก `../../data/petPassives.js` แทน

- [ ] **Step 2: เชื่อม `TowerView.vue` — ลบ `tw-scout`**

- ลบบล็อก `<div v-if="scout" class="tw-scout">…</div>` ทั้งก้อน (บรรทัด ~96–106)
- ใส่แทนที่: `<PetScoutCard :pet="scout" @close="scout = null" />`
- ลบ `scoutStat` computed (บรรทัด ~204–207) และ helper ที่เหลือใช้เฉพาะ scout (`rarityLabel`/`elName` ถ้าไม่มีที่อื่นใช้ — grep ก่อนลบ)
- ลบ CSS `.tw-scout*` ทั้งหมด (บรรทัด ~289–295)
- เพิ่ม `import PetScoutCard from '../components/pets/PetScoutCard.vue'`
- `const scout = ref(null)` คงไว้ · ปุ่ม `@click="scout = p"` คงไว้

- [ ] **Step 3: เชื่อม `FloorSheet.vue` — ศัตรูกดได้**

เปลี่ยนแถวศัตรู:

```html
      <div class="fs-sec">ศัตรูที่รออยู่</div>
      <div class="fs-team">
        <button v-for="(p, i) in botTeam" :key="i" class="fs-mon" type="button"
                :aria-label="`ดูข้อมูล ${defName(p)}`" @click="scout = p">
          <PetThumb :pet="p" />
        </button>
      </div>
```

ใน `<script setup>` เพิ่ม:

```js
import { ref } from 'vue'
import PetScoutCard from '../pets/PetScoutCard.vue'
import { getPetDef } from '../../data/index.js'
const scout = ref(null)
const defName = (p) => getPetDef(p?.id)?.name || 'เพ็ท'
```

(`ref` ต้องรวมเข้ากับบรรทัด `import { computed } from 'vue'` ที่มีอยู่ → `import { computed, ref } from 'vue'`)

วาง `<PetScoutCard :pet="scout" @close="scout = null" />` ไว้หลัง `</BottomSheet>` **นอก** sheet (เป็นพี่น้องกัน) แล้วห่อทั้งสองด้วย `<template>` fragment หรือวางไว้ท้าย root element เดิม

CSS: `.fs-mon` ต้องรีเซ็ตสไตล์ปุ่ม —

```css
.fs-mon { width: 58px; flex-shrink: 0; padding: 0; border: none; background: none; font-family: inherit; cursor: pointer; }
```

- [ ] **Step 4: ตรวจฟอนต์ + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: ไม่เจออะไร

Run: `npm run build`
Expected: build สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add src/components/pets/PetScoutCard.vue src/views/TowerView.vue src/components/tower/FloorSheet.vue
git commit -m "Tower: การ์ดสอดแนมบอกทักษะเฉพาะของศัตรู + แผ่นชั้นกดดูได้ (เดิมจัดทีมโดยไม่รู้ว่าอีกฝั่งมีสกิลอะไร)"
```

---

## Task 7: สนามประลอง — ขยายรูปเพ็ท + กดดูได้

**Files:**
- Modify: `src/views/ArenaView.vue`

**Interfaces:**
- Consumes: `PetScoutCard` จาก Task 6

- [ ] **Step 1: จัดโครงการ์ดคู่ต่อสู้ใหม่**

แทนที่บล็อก `<div v-for="opp in opponents" …>` ทั้งก้อน:

```html
        <div v-for="opp in opponents" :key="opp.uid" class="ar-opp">
          <div class="ar-opp-top">
            <span class="ar-opp-info">
              <span class="ar-opp-name">
                <Emoji :char="opp.isBot ? '🤖' : '🧑'" /> {{ opp.isBot ? ('หุ่นซ้อม' + (opp.label ? ' · ' + opp.label : '')) : (opp.nickname || '?') }}
              </span>
              <span class="ar-opp-rt">
                <span v-if="rankOf(opp)" class="ar-opp-rank">{{ rankBadge(rankOf(opp)) }}</span>
                {{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span>
                <span class="ar-opp-coin"><Emoji char="🪙" /> {{ coinPreview(opp).toLocaleString() }}</span>
              </span>
            </span>
            <button class="ar-fight" :disabled="!canFight || busy || attacksLeft <= 0" @click="onFight(opp)">
              <Emoji char="⚔️" /> บุก
            </button>
          </div>
          <div class="ar-opp-team">
            <button v-for="(p, i) in oppPreview(opp)" :key="i" type="button" class="ar-opp-pet"
                    :aria-label="`ดูข้อมูล ${petName(p)}`" @click="scout = p">
              <PetThumb :pet="p" />
            </button>
          </div>
        </div>
```

- [ ] **Step 2: เพิ่ม state + import**

```js
import PetScoutCard from '../components/pets/PetScoutCard.vue'
import { getPetDef } from '../data/index.js'

const scout = ref(null)
const petName = (p) => getPetDef(p?.id)?.name || 'เพ็ท'
```

วาง `<PetScoutCard :pet="scout" @close="scout = null" />` ข้าง `<BattleReplay …/>` ท้ายเทมเพลต

- [ ] **Step 3: แก้ CSS**

```css
.ar-opp { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 10px; }
.ar-opp-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ar-opp-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ar-opp-name { font-size: .78rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-opp-rt { font-size: .7rem; color: rgba(0,0,0,.5); }
/* ทีมศัตรูได้บรรทัดของตัวเอง — 34px เดิมเล็กจนอ่าน ATK/HP บนการ์ดไม่ออกเลย */
.ar-opp-team { display: flex; gap: 8px; }
.ar-opp-pet { width: 58px; flex-shrink: 0; padding: 0; border: none; background: none; font-family: inherit; cursor: pointer; }
```

ลบบรรทัดเดิม `.ar-opp-team :deep(.pet-thumb), .ar-opp-team > * { width: 34px; }` และ `max-width: 100px` ของ `.ar-opp-name`

- [ ] **Step 4: ตรวจฟอนต์ + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: ไม่เจออะไร

Run: `npm run build`
Expected: build สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add src/views/ArenaView.vue
git commit -m "Arena: ทีมศัตรูได้บรรทัดของตัวเอง รูปโต 58px + กดดูทักษะได้ (34px เล็กจนอ่านเลขไม่ออก)"
```

---

## Task 8: ตรวจรวบยอด + push

- [ ] **Step 1: รันเทส pure ทั้งหมดที่เกี่ยวข้อง**

Run:
```bash
node --test src/utils/battleBuffs.test.js src/utils/battlePassives.test.js \
  src/utils/battleEngine.test.js src/utils/battleBeats.test.js src/utils/battleSummary.test.js \
  src/utils/battleStats.test.js src/utils/petTeam.test.js src/utils/roster.test.js
```
Expected: PASS ทั้งหมด

- [ ] **Step 2: ตรวจกฎประจำรีโป**

```bash
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/            # ต้องว่าง
grep -n "color: rgba(0,0,0" src/components/battle/BattleReplay.vue   # ไล่ดูว่าอยู่บนพื้นสว่างทุกจุด
grep -rn "สายพลัง" src/                                    # ต้องว่าง
npm run build
```

- [ ] **Step 3: push**

```bash
git push origin master
```

**ไม่ต้อง `firebase deploy --only firestore:rules`** — งานนี้ไม่แตะ rules · ไม่มีปุ่มแอดมินให้กดหลัง deploy · 0 Firestore read เพิ่ม

---

## หลัง deploy: อะไรที่ต้องเทสจอจริง

1. หอคอย — แตะการ์ดศัตรู เห็นทักษะเฉพาะ · แตะโหนดชั้น → ในแผ่นชั้นแตะศัตรูก็เปิดได้ และการ์ดต้องอยู่ **เหนือ** แผ่นชั้น (ถ้าเห็นแค่จอมืดลง = z-index ตก ดู CLAUDE.md ข้อ 12)
2. สนามประลอง — รูปเพ็ทโตอ่าน ATK/HP ออก · กดแล้วเปิดการ์ด · ปุ่มบุกยังกดง่ายไม่ชนกัน
3. รีเพลย์ทีมที่มี 🐳 คุณวาฬ — ตอน READY-GO เลข HP = ค่าดิบ พอออร่าเปล่งแล้วต้องขยับขึ้น และ **หลอดเลือดต้องไม่เกิน 100%**
4. รีเพลย์ทีมที่มี 🦖 ทีเร็กซ์ — ล้มศัตรูแล้ว ATK ขยับ · แตะดูเห็น "x/3 ชั้น"
5. แตะดูตัวที่ติดดีบัฟจากนกฮูกฝั่งตรงข้าม — แถวต้องเป็นแดง + เขียนว่า "ฝ่ายศัตรู"
6. ปิดหน้าต่างดูตัวแล้วไฟต์ต้องเดินต่อ (ไม่ค้าง)
