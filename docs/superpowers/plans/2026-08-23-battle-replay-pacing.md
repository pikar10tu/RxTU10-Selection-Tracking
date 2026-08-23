# BattleReplay Pacing (4 ชั้น) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รื้อจังหวะการเล่า `BattleReplay` จาก "ทุกหมัดเท่ากัน ~1 วิ × 27 หมัด" เป็น 4 ชั้นตามความสำคัญ (350/600/1300/2000ms) เอาปุ่มข้ามและปุ่มเร็วออก แทนด้วยกดค้างเร่งที่ไม่แตะไฮไลต์ พร้อมพาเนล Admin ให้ user เลือก preset ภาพ×จังหวะบนมือถือจริง

**Architecture:** แยกส่วน "คิด" ออกจากส่วน "วาด" — `battleBeats.js` (pure) แปลง log ของ engine เป็น beat ที่ติดป้าย tier + timing · `battleReplayPrefs.js` (pure + localStorage) ถือ preset · `battleFx.js` รับ tier/flags แล้ววาด · `BattleReplay.vue` เป็นตัวเดินเวลาอย่างเดียว ไม่ตัดสินใจเรื่องน้ำหนัก · **ไม่แตะ `battleEngine.js` เลย** ผลไฟต์ยังคำนวณล่วงหน้า 100% เหมือนเดิม

**Tech Stack:** Vue 3 (script setup) · WAAPI (`el.animate`) · `node:test` สำหรับ pure utils · Vite build

**สเปกอ้างอิง:** `docs/superpowers/specs/2026-08-23-battle-replay-pacing-design.md` (commit `8071b37`)

## Global Constraints

- **ห้ามแตะ** `src/utils/battleEngine.js` · `src/data/battle.js` · `src/utils/battleSummary.js` · firestore rules · ฝั่ง economy
- **ไม่มี test runner กลางในรีโป** — pure utils รันตรงด้วย `node --test src/utils/<x>.test.js` · ส่วน Vue/DOM ตรวจด้วย `npm run build` + ทดลองใน `npm run dev` (ตาม CLAUDE.md)
- **ข้อบังคับ performance จาก v3 (`docs/superpowers/specs/2026-07-17-battle-replay-v3-fx-split-design.md`) มีผลทุกบรรทัด:**
  - การ์ดจริงขยับได้ **1 `el.animate()` ต่อหมัดเท่านั้น** keyframes ครบวงจร `fill:'none'` — ห้ามแตกเป็นหลาย animation
  - keyframes มีแต่ `transform`/`opacity` — `zIndex` ตั้ง static ก่อนเริ่ม เคลียร์หลังจบ **ห้ามอยู่ใน keyframes**
  - ห้ามแตะ paint property ของการ์ด (border/class) ระหว่าง animation รัน — เปลี่ยนให้เสร็จก่อนสั่ง animate
  - ของอายุ < 1 วิ ห้ามอยู่ใน Vue reactivity — ต้องอยู่ใน FX pool (imperative)
  - **ห้าม animation วนไม่รู้จบบนการ์ด** (= layer ค้างถาวร) — วงแหวนอันตรายต้องอยู่บน FX pool
  - motion ใหม่ทุกตัวเป็นของ `battleFx` ไม่ใช่ของ component — เพื่อให้โดน `cancelAll()` เก็บกวาดจาก registry เดียว
- **ทุก emoji ผ่าน `<Emoji>` component** (Fluent self-host) — ห้ามใส่ emoji ดิบในเทมเพลต Vue (เป็น tofu บนบางเครื่อง) · ใน `battleFx.js` ใช้ `fluentFile()` ตรงตามแพทเทิร์นเดิม
- **overlay ที่ `position:fixed` ใต้ RouterView ต้อง `Teleport to body` เสมอ** (CLAUDE.md ข้อ 6) — `BattleReplay` ทำอยู่แล้ว ห้ามถอด
- UI ภาษาไทยทั้งหมด · มือถือเป็นหลัก
- `gen` guard เดิมใน `BattleReplay.vue` ต้องคงไว้ทุกจุดที่มี `await` — reset/ไฟต์ใหม่ระหว่างทางต้องตัด promise chain ได้

---

## File Structure

| ไฟล์ | สถานะ | ความรับผิดชอบเดียว |
|---|---|---|
| `src/utils/battleBeats.js` | สร้าง | log → beat[] (tier, timing, danger, survive) + ฟังก์ชันคิดเวลา · pure ล้วน |
| `src/utils/battleBeats.test.js` | สร้าง | เทส `battleBeats.js` |
| `src/utils/battleReplayPrefs.js` | สร้าง | นิยาม preset แกน A/B + อ่าน-เขียน localStorage |
| `src/utils/battleReplayPrefs.test.js` | สร้าง | เทส `battleReplayPrefs.js` |
| `src/utils/battleFx.js` | แก้ | วาดตาม tier + flags (ไม่ตัดสินใจเรื่องน้ำหนักเอง) |
| `src/components/battle/BattleReplay.vue` | แก้ | เดินเวลาตาม beat + ปุ่มควบคุม + หลอดเลือด |
| `src/views/AdminView.vue` | แก้ | พาเนลเลือก preset + ยิงไฟต์ทดสอบ |

---

## Task 1: `battleBeats.js` — แบ่งชั้นด้วยโควตา + คิดเวลา (pure)

**Files:**
- Create: `src/utils/battleBeats.js`
- Test: `src/utils/battleBeats.test.js`

**Interfaces:**
- Consumes: `simulateBattle` จาก `./battleEngine.js` และ `buildCombatant` จาก `../data/battle.js` — **เฉพาะในไฟล์เทส** ตัว `battleBeats.js` เองไม่ import อะไรเลย
- Produces:
  - `buildBeats(log, maxHpByUid) → beat[]` (ยาวเท่า log เสมอ 1 event = 1 beat)
  - `beat = { ...event, tier, dmgPct, hpPctAfter, score, timing, kill, danger, survive }`
  - `tier: 'chip'|'solid'|'heavy'|'finish'|null`
  - `scaleTiming(beat, { pace = 1, ff = false }) → {windup,motion,hitstop,tail}`
  - `beatDuration(beat, opts) → number` · `totalDuration(beats, opts) → number`
  - ค่าคงที่: `TIER_TIMING`, `FF_SCALE`, `DANGER_PCT`, `SURVIVE_PCT`, `HEAVY_SCORE_FLOOR`

**⚠️ อ่านก่อนเริ่ม:** การแบ่งชั้นเป็น **โควตาต่อไฟต์ ไม่ใช่เกณฑ์ตายตัว** (สเปก §3.2) — ชั้นของหมัดหนึ่งขึ้นกับว่ามันอยู่อันดับที่เท่าไหร่เมื่อเทียบกับหมัดอื่น *ในไฟต์เดียวกัน* ฉบับแรกของสเปกใช้เกณฑ์ตายตัวแล้ววัดจริงได้ heavy 53% ไฟต์ยาว 33 วิ (นานกว่าระบบเดิม) — **อย่าเปลี่ยนกลับไปเป็นเกณฑ์ตายตัว**

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/battleBeats.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBeats, scaleTiming, beatDuration, totalDuration,
  TIER_TIMING, DANGER_PCT, SURVIVE_PCT, HEAVY_SCORE_FLOOR,
} from './battleBeats.js'
import { simulateBattle } from './battleEngine.js'
import { buildCombatant } from '../data/battle.js'

const MH = { A0: 100, A1: 100, B0: 100, B1: 100 }
const atk = (o) => ({ t: 'attack', side: 'A', attacker: 'A0', target: 'B0', crit: false, eff: 'neutral', dead: false, dmg: 5, targetHpAfter: 50, ...o })
const tiersOf = (beats) => beats.filter(b => b.t === 'attack').map(b => b.tier)
const countTier = (beats, t) => tiersOf(beats).filter(x => x === t).length

// log ยาว n หมัด ดาเมจไล่จากน้อยไปมาก → อันดับคะแนนคาดเดาได้
// ×3 เพื่อให้หมัดอันดับต้นๆ มี score ผ่าน HEAVY_SCORE_FLOOR (.12) ไม่งั้นโควตา heavy จะถูก floor ตัดหมด
function ramp(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = (i + 1) * 3
    out.push(atk({ dmg: d, targetHpAfter: Math.max(1, 100 - d) }))
  }
  return out
}

test('finish มีหมัดเดียวต่อไฟต์ และเป็น attack ตัวสุดท้ายของ log เสมอ', () => {
  const beats = buildBeats([...ramp(20), { t: 'end', winner: 'A' }], MH)
  assert.equal(countTier(beats, 'finish'), 1)
  const atks = beats.filter(b => b.t === 'attack')
  assert.equal(atks[atks.length - 1].tier, 'finish')
  assert.equal(beats[beats.length - 1].tier, null)          // t:'end' ไม่ใช่ attack
})

test('finish ไม่ผูกกับการฆ่า — หมัดที่ฆ่ากลางไฟต์ไม่ใช่ finish', () => {
  const log = [...ramp(19)]
  log[5] = atk({ dmg: 60, targetHpAfter: 0, dead: true })
  const beats = buildBeats(log, MH)
  assert.notEqual(beats[5].tier, 'finish')
  assert.equal(countTier(beats, 'finish'), 1)
})

test('kill เป็น flag แยกจากชั้น — ตายเมื่อไหร่ก็ติดธง ไม่ว่าชั้นไหน', () => {
  const log = [...ramp(19)]
  log[2] = atk({ dmg: 1, targetHpAfter: 0, dead: true })    // ดาเมจน้อยมากแต่ฆ่า
  const beats = buildBeats(log, MH)
  assert.equal(beats[2].kill, true)
  assert.equal(beats[0].kill, false)
})

test('โควตา heavy/solid อยู่ในกรอบ clamp ตามความยาวไฟต์', () => {
  // ไฟต์สั้น 12 หมัด → round(12*.13)=2 แต่ถูก clamp ขึ้นเป็น 3
  const short = buildBeats(ramp(12), MH)
  assert.equal(countTier(short, 'heavy'), 3)
  // ไฟต์ยาว 60 หมัด → round(60*.13)=8 clamp ลงเหลือ 6 · solid round(60*.28)=17 clamp เหลือ 11
  const long = buildBeats(ramp(60), MH)
  assert.equal(countTier(long, 'heavy'), 6)
  assert.equal(countTier(long, 'solid'), 11)
  assert.equal(countTier(long, 'chip'), 60 - 6 - 11 - 1)
})

test('heavy ตกให้หมัดคะแนนสูงสุดก่อน', () => {
  const beats = buildBeats(ramp(20), MH)
  const atks = beats.filter(b => b.t === 'attack')
  const notLast = atks.slice(0, -1)
  const heavy = notLast.filter(b => b.tier === 'heavy')
  const rest = notLast.filter(b => b.tier !== 'heavy')
  const minHeavy = Math.min(...heavy.map(b => b.score))
  const maxRest = Math.max(...rest.map(b => b.score))
  assert.ok(minHeavy >= maxRest, 'หมัด heavy คะแนนต่ำสุด ต้องไม่ต่ำกว่าหมัดที่ไม่ใช่ heavy คะแนนสูงสุด')
})

test('score floor: ไฟต์ที่ทุกหมัดจิ๊บจ๊อย จะไม่มี heavy เลย', () => {
  // ดาเมจ 1% ทุกหมัด ไม่คริ ไม่แพ้ทาง ไม่ฆ่า → score = .01 ต่ำกว่า floor
  const log = Array.from({ length: 20 }, () => atk({ dmg: 1, targetHpAfter: 90 }))
  const beats = buildBeats(log, MH)
  assert.equal(countTier(beats, 'heavy'), 0)
  assert.equal(countTier(beats, 'finish'), 1)     // finish ยังมีเสมอ — ไฟต์ต้องมีจุดจบ
  assert.equal(HEAVY_SCORE_FLOOR, 0.12)
})

test('round/end ได้ tier null และ timing 0 ทุกช่อง', () => {
  const beats = buildBeats([{ t: 'round', n: 1 }, { t: 'end', winner: 'A' }], MH)
  for (const b of beats) {
    assert.equal(b.tier, null)
    assert.deepEqual(b.timing, { windup: 0, motion: 0, hitstop: 0, tail: 0 })
    assert.equal(beatDuration(b), 0)
  }
})

test('event type แปลกปลอมผ่านไปเงียบๆ ไม่ throw (ช่องเว้นให้ P3 passive)', () => {
  const beats = buildBeats([{ t: 'passive', uid: 'A0', name: 'shield' }], MH)
  assert.equal(beats[0].tier, null)
  assert.equal(beats[0].name, 'shield')          // ฟิลด์เดิมต้องอยู่ครบ
})

test('log ว่าง/null → array ว่าง ไม่ throw', () => {
  assert.deepEqual(buildBeats([], MH), [])
  assert.deepEqual(buildBeats(null, MH), [])
})

test('danger ติดเมื่อเลือดเหลือไม่เกิน 25% และยังไม่ตาย', () => {
  const beats = buildBeats([
    atk({ dmg: 9, targetHpAfter: 30 }),
    atk({ dmg: 9, targetHpAfter: 25 }),
    atk({ dmg: 25, targetHpAfter: 0, dead: true }),
  ], MH)
  assert.equal(beats[0].danger, false)
  assert.equal(beats[1].danger, true)
  assert.equal(beats[2].danger, false)           // ตายแล้วไม่ใช่ danger
  assert.equal(DANGER_PCT, 0.25)
})

test('survive ติดครั้งเดียวต่อตัว ตอนตกผ่าน 10% ครั้งแรก', () => {
  const beats = buildBeats([
    atk({ dmg: 9, targetHpAfter: 12 }),
    atk({ dmg: 9, targetHpAfter: 8 }),
    atk({ dmg: 3, targetHpAfter: 5 }),
    atk({ dmg: 5, targetHpAfter: 0, dead: true }),
  ], MH)
  assert.deepEqual(beats.map(b => b.survive), [false, true, false, false])
  assert.equal(SURVIVE_PCT, 0.10)
})

test('uid ที่ไม่มีใน maxHpByUid → ไม่ NaN ไม่หารด้วยศูนย์', () => {
  const [b] = buildBeats([atk({ target: 'Z9', dmg: 10, targetHpAfter: 5 })], {})
  assert.ok(Number.isFinite(b.dmgPct))
  assert.ok(Number.isFinite(b.hpPctAfter))
  assert.ok(Number.isFinite(b.score))
})

test('scaleTiming: pace คูณทุกช่อง · ff ย่อเฉพาะ chip/solid', () => {
  const beats = buildBeats(ramp(20), MH)
  const pick = (t) => beats.find(b => b.tier === t)
  const chip = pick('chip'), heavy = pick('heavy'), finish = pick('finish')

  assert.deepEqual(scaleTiming(chip, { pace: 2 }), {
    windup: TIER_TIMING.chip.windup * 2, motion: TIER_TIMING.chip.motion * 2,
    hitstop: TIER_TIMING.chip.hitstop * 2, tail: TIER_TIMING.chip.tail * 2,
  })
  assert.equal(beatDuration(chip, { ff: true }), beatDuration(chip) * 0.3)
  // กติกาหลักของฟีเจอร์กดค้างเร่ง — ห้ามย่อไฮไลต์
  assert.equal(beatDuration(heavy, { ff: true }), beatDuration(heavy))
  assert.equal(beatDuration(finish, { ff: true }), beatDuration(finish))
})

// ── งบเวลากับ log จริง 3 ระดับความแกร่งของทีม ──
const mk = (t) => t.map(([id, rarity, element, grade]) => ({ id, rarity, element, grade }))
const PROFILES = {
  'กลาง': {
    A: mk([['dragon', 'epic', 'fist', 3], ['wolf', 'rare', 'fist', 3], ['fox', 'rare', 'scissors', 3], ['owl', 'rare', 'paper', 3]]),
    B: mk([['bahamut', 'legendary', 'fist', 5], ['phoenix', 'legendary', 'scissors', 5], ['whale', 'legendary', 'paper', 5], ['panda', 'epic', 'paper', 5]]),
    cap: { avg: 19500, worst: 23000, ffAvg: 12500, ffWorst: 14000 },
  },
  'ท็อป': {
    A: mk([['kirin', 'legendary', 'fist', 5], ['trex', 'legendary', 'fist', 5], ['ouroboros', 'legendary', 'scissors', 5], ['mammoth', 'legendary', 'paper', 5]]),
    B: mk([['simurgh', 'legendary', 'scissors', 5], ['qilin', 'legendary', 'paper', 5], ['cerberus', 'epic', 'fist', 5], ['panda', 'epic', 'paper', 5]]),
    cap: { avg: 26500, worst: 29500, ffAvg: 16000, ffWorst: 18000 },
  },
  'อ่อน': {
    A: mk([['hedgehog', 'common', 'fist', 1], ['cat', 'common', 'scissors', 1], ['turtle', 'common', 'paper', 1], ['hamster', 'common', 'fist', 1]]),
    B: mk([['mouse', 'common', 'scissors', 1], ['butterfly', 'common', 'paper', 1], ['seal', 'rare', 'paper', 2], ['fox', 'rare', 'scissors', 2]]),
    cap: { avg: 26500, worst: 29500, ffAvg: 16000, ffWorst: 18000 },
  },
}
const CHROME = 1100 + 900       // intro READY?/GO! + ค้างสนามท้ายไฟต์

function measure(prof) {
  const maxHp = {}
  prof.A.forEach((p, i) => { maxHp['A' + i] = Math.round(buildCombatant(p).maxHp) || 1 })
  prof.B.forEach((p, i) => { maxHp['B' + i] = Math.round(buildCombatant(p).maxHp) || 1 })
  let sum = 0, worst = 0, ffSum = 0, ffWorst = 0, oldSum = 0
  const cnt = { chip: 0, solid: 0, heavy: 0, finish: 0 }
  for (let s = 1; s <= 200; s++) {
    const beats = buildBeats(simulateBattle(prof.A, prof.B, s).log, maxHp)
    for (const b of beats) if (b.tier) cnt[b.tier]++
    const d = totalDuration(beats) + CHROME
    const f = totalDuration(beats, { ff: true }) + CHROME
    sum += d; ffSum += f
    oldSum += beats.filter(b => b.t === 'attack').length * 1000    // ระบบเดิม ~1 วิ/หมัด
    if (d > worst) worst = d
    if (f > ffWorst) ffWorst = f
  }
  const tot = cnt.chip + cnt.solid + cnt.heavy + cnt.finish
  return {
    avg: sum / 200, worst, ffAvg: ffSum / 200, ffWorst, oldAvg: oldSum / 200,
    share: { chip: cnt.chip / tot, heavy: cnt.heavy / tot, finish: cnt.finish / tot },
  }
}

for (const [name, prof] of Object.entries(PROFILES)) {
  test(`งบเวลา — ทีม${name}`, () => {
    const m = measure(prof)
    assert.ok(m.avg <= prof.cap.avg, `เฉลี่ย ${Math.round(m.avg)}ms ต้องไม่เกิน ${prof.cap.avg}`)
    assert.ok(m.worst <= prof.cap.worst, `ยาวสุด ${Math.round(m.worst)}ms ต้องไม่เกิน ${prof.cap.worst}`)
    assert.ok(m.ffAvg <= prof.cap.ffAvg, `เร่งเฉลี่ย ${Math.round(m.ffAvg)}ms ต้องไม่เกิน ${prof.cap.ffAvg}`)
    assert.ok(m.ffWorst <= prof.cap.ffWorst, `เร่งยาวสุด ${Math.round(m.ffWorst)}ms ต้องไม่เกิน ${prof.cap.ffWorst}`)
    assert.ok(m.avg < m.oldAvg, `ต้องสั้นกว่าระบบเดิม (ใหม่ ${Math.round(m.avg)} vs เดิม ${Math.round(m.oldAvg)})`)
  })
  test(`สัดส่วนชั้น — ทีม${name}`, () => {
    const { share } = measure(prof)
    // กันการกลับไปเป็นแบบฉบับแรกที่ heavy บวมเป็น 53%
    assert.ok(share.chip >= 0.45, `chip ${(share.chip * 100).toFixed(0)}% ต้องไม่ต่ำกว่า 45%`)
    assert.ok(share.heavy <= 0.20, `heavy ${(share.heavy * 100).toFixed(0)}% ต้องไม่เกิน 20%`)
    assert.ok(share.finish <= 0.06, `finish ${(share.finish * 100).toFixed(0)}% ต้องไม่เกิน 6%`)
  })
}
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

```
node --test src/utils/battleBeats.test.js
```
Expected: FAIL — `Cannot find module './battleBeats.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/battleBeats.js`:

```js
// battleBeats.js — แปลง log ของ engine เป็น "beat" ที่บอกว่าแต่ละเหตุการณ์ควรถูกเล่าหนักแค่ไหน
// pure ล้วน: ไม่ import อะไร ไม่อ่าน DOM/store/Date.now → เทสด้วย node --test ได้ตรงๆ
//
// ⚠️ การแบ่งชั้นเป็น "โควตาโมเมนต์พิเศษต่อไฟต์" ไม่ใช่เกณฑ์ตายตัว
//    ฉบับแรกใช้เกณฑ์ตายตัว (dmgPct > .20 → heavy ฯลฯ) แล้ววัด log จริงได้ heavy 53%
//    → ไฟต์ยาว 33 วิ นานกว่าระบบเดิม เพราะแพ้ทางเกิด ~1 ใน 3 ของคู่ธาตุโดยธรรมชาติ
//    โควตาการันตีสัดส่วนไม่ว่าทีมจะแกร่งแค่ไหน และการันตีว่า "ไม่มีไฟต์ไหนที่ไม่มีจุดพีค"

/** เวลาแต่ละเฟสต่อชั้น (ms ที่ pace ×1) — รวม chip 320 / solid 600 / heavy 1300 / finish 2000 */
export const TIER_TIMING = {
  chip:   { windup: 0,   motion: 100, hitstop: 0,   tail: 220 },
  solid:  { windup: 140, motion: 130, hitstop: 40,  tail: 290 },
  heavy:  { windup: 350, motion: 100, hitstop: 120, tail: 730 },
  finish: { windup: 430, motion: 250, hitstop: 250, tail: 1070 },
}
const ZERO = { windup: 0, motion: 0, hitstop: 0, tail: 0 }

/** โหมดเร่ง (กดค้าง) ย่อเฉพาะชั้นล่าง — heavy/finish ห้ามแตะ ไม่งั้นกลายเป็นปุ่มข้าม */
export const FF_SCALE = { chip: 0.3, solid: 0.3, heavy: 1, finish: 1 }

export const DANGER_PCT = 0.25         // เลือดเหลือไม่เกินนี้ (ยังไม่ตาย) = โซนอันตราย
export const SURVIVE_PCT = 0.10        // ตกผ่านเส้นนี้ครั้งแรก = ป้าย "รอด!"
export const HEAVY_SCORE_FLOOR = 0.12  // ต่ำกว่านี้ไม่ให้เป็น heavy แม้ติดอันดับ (กันไฟต์จิ๊บจ๊อยได้เลขทองใหญ่)

const HEAVY_SHARE = 0.13, HEAVY_MIN = 3, HEAVY_MAX = 6
const SOLID_SHARE = 0.28, SOLID_MIN = 5, SOLID_MAX = 11

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** คะแนนความสำคัญ — การฆ่าให้ +.30 จึงมักดันหมัดสังหารขึ้นชั้น heavy เอง โดยไม่ต้องบังคับ */
function scoreOf(e, dmgPct) {
  return dmgPct + (e.crit ? 0.15 : 0) + (e.eff === 'super' ? 0.08 : 0) + (e.dead ? 0.30 : 0)
}

/**
 * @param {Array} log  log จาก simulateBattle()
 * @param {Object} maxHpByUid  uid → maxHp (จาก buildCombatant) — uid ที่ขาดถูกมองเป็น 1 กันหารศูนย์
 * @returns {Array} beat[] ยาวเท่า log เสมอ (1 event = 1 beat) เพื่อให้ index ตรงกับของเดิม
 */
export function buildBeats(log, maxHpByUid) {
  const evts = Array.isArray(log) ? log : []
  const mh = maxHpByUid || {}

  // ── pass 1: คิด dmgPct / hpPctAfter / score ของทุก attack ──
  const info = evts.map((e) => {
    const ev = e || {}
    if (ev.t !== 'attack') return null
    const max = mh[ev.target] > 0 ? mh[ev.target] : 1
    const dmgPct = (ev.dmg || 0) / max
    return {
      dmgPct,
      hpPctAfter: Math.max(0, (ev.targetHpAfter || 0) / max),
      score: scoreOf(ev, dmgPct),
    }
  })
  const atkIdx = []
  for (let i = 0; i < evts.length; i++) if (info[i]) atkIdx.push(i)

  // ── pass 2: แจกชั้นตามโควตา (จัดอันดับด้วย score ภายในไฟต์นี้เท่านั้น) ──
  const tierAt = new Map()
  if (atkIdx.length) {
    const last = atkIdx[atkIdx.length - 1]
    tierAt.set(last, 'finish')                                   // หมัดจบไฟต์ = 1 หมัดเสมอ
    const n = atkIdx.length
    const nHeavy = clamp(Math.round(n * HEAVY_SHARE), HEAVY_MIN, HEAVY_MAX)
    const nSolid = clamp(Math.round(n * SOLID_SHARE), SOLID_MIN, SOLID_MAX)
    const rest = atkIdx.filter(i => i !== last).sort((a, b) => info[b].score - info[a].score)
    let h = 0, sd = 0
    for (const i of rest) {
      // เรียงคะแนนมากไปน้อยแล้ว — พอเจอตัวที่ต่ำกว่า floor ตัวที่เหลือก็ต่ำกว่าหมด
      if (h < nHeavy && info[i].score >= HEAVY_SCORE_FLOOR) { tierAt.set(i, 'heavy'); h++; continue }
      if (sd < nSolid) { tierAt.set(i, 'solid'); sd++; continue }
      tierAt.set(i, 'chip')
    }
  }

  // ── pass 3: ประกอบ beat ตามลำดับ log จริง (danger/survive ต้องไล่ตามเวลา ไม่ใช่ตามอันดับ) ──
  const belowSurvive = new Set()
  return evts.map((e, i) => {
    const ev = e || {}
    const inf = info[i]
    if (!inf) {
      // round / end / event ที่ยังไม่รู้จัก (เช่น passive ในอนาคต) — ผ่านไปเงียบๆ ไม่กินเวลา
      return { ...ev, tier: null, dmgPct: 0, hpPctAfter: 1, score: 0, timing: { ...ZERO }, kill: false, danger: false, survive: false }
    }
    const tier = tierAt.get(i) || 'chip'
    const alive = inf.hpPctAfter > 0
    const danger = alive && inf.hpPctAfter <= DANGER_PCT
    let survive = false
    if (alive && inf.hpPctAfter < SURVIVE_PCT) {
      if (!belowSurvive.has(ev.target)) { survive = true; belowSurvive.add(ev.target) }
    } else if (alive) {
      belowSurvive.delete(ev.target)     // ยังไม่มีระบบฮีล แต่กันไว้ให้ P3 ไม่ต้องกลับมาแก้
    }
    return {
      ...ev, tier, dmgPct: inf.dmgPct, hpPctAfter: inf.hpPctAfter, score: inf.score,
      timing: { ...TIER_TIMING[tier] },
      kill: ev.dead === true,            // แยกจากชั้น — ตายเมื่อไหร่ก็เล่นอนิเมชันน็อกเสมอ
      danger, survive,
    }
  })
}

/** คูณเวลาตาม pace (รสนิยม) และ ff (กดค้างเร่ง) — ไม่แก้ beat เดิม */
export function scaleTiming(beat, { pace = 1, ff = false } = {}) {
  const t = (beat && beat.timing) || ZERO
  const k = pace * (ff && beat && beat.tier ? (FF_SCALE[beat.tier] ?? 1) : 1)
  return { windup: t.windup * k, motion: t.motion * k, hitstop: t.hitstop * k, tail: t.tail * k }
}

export function beatDuration(beat, opts) {
  const t = scaleTiming(beat, opts)
  return t.windup + t.motion + t.hitstop + t.tail
}

export function totalDuration(beats, opts) {
  return (beats || []).reduce((s, b) => s + beatDuration(b, opts), 0)
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

```
node --test src/utils/battleBeats.test.js
```
Expected: PASS ทุกเคส

**ถ้าเทสงบเวลาหรือสัดส่วนไม่ผ่าน อย่าขยายเพดานในเทสเพื่อให้ผ่าน** — ให้พิมพ์ค่าจริงออกมาแล้วรายงาน เพราะมันแปลว่าค่าโควตา (`HEAVY_SHARE`/`SOLID_SHARE`/clamp) หรือ `TIER_TIMING` ต้องปรับ ซึ่งกระทบสเปก §3.3 ที่ต้องแก้ตามด้วย

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleBeats.js src/utils/battleBeats.test.js
git commit -m "Battle: battleBeats.js — แบ่งชั้นด้วยโควตาต่อไฟต์ + คิดงบเวลา (pure, เทสงบเวลา 3 ระดับทีม)"
```

---

## Task 2: `battleReplayPrefs.js` — preset ภาพ×จังหวะ

**Files:**
- Create: `src/utils/battleReplayPrefs.js`
- Test: `src/utils/battleReplayPrefs.test.js`

**Interfaces:**
- Consumes: ไม่มี (ไฟล์นี้ไม่ import อะไร)
- Produces:
  - `FX_PRESETS` = `{ high|mid|low: { cardLunge, targetSquash, screenShake, burst, ko } }` (boolean ทั้งหมด)
  - `PACE_PRESETS` = `{ grand: 1.25, normal: 1, tight: 0.8 }`
  - `REDUCED_FLAGS` — flags ทุกตัวเป็น false
  - `DEFAULT_PREFS` = `{ fx: 'high', pace: 'normal' }`
  - `readPrefs(storage?) → { fx, pace }`
  - `writePrefs({ fx, pace }, storage?) → { fx, pace }`
  - `fxFlags(name) → flags object`
  - `paceMult(name) → number`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/battleReplayPrefs.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FX_PRESETS, PACE_PRESETS, REDUCED_FLAGS, DEFAULT_PREFS,
  readPrefs, writePrefs, fxFlags, paceMult,
} from './battleReplayPrefs.js'

// localStorage ปลอมสำหรับ node (ไม่มี window)
function fakeStorage(seed) {
  const m = new Map(Object.entries(seed || {}))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    _dump: () => Object.fromEntries(m),
  }
}

test('preset ภาพไล่จากหนักไปเบาอย่างสอดคล้อง', () => {
  assert.deepEqual(FX_PRESETS.high, { cardLunge: true, targetSquash: true, screenShake: true, burst: true, ko: true })
  assert.deepEqual(FX_PRESETS.mid, { cardLunge: true, targetSquash: false, screenShake: false, burst: true, ko: true })
  assert.deepEqual(FX_PRESETS.low, { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true })
  // จอสั่นต้องอยู่ใน high เท่านั้น — §6.2 ของสเปกบังคับ
  assert.equal(FX_PRESETS.mid.screenShake, false)
  assert.equal(FX_PRESETS.low.screenShake, false)
})

test('reduced-motion ปิด motion ทุกตัว', () => {
  for (const v of Object.values(REDUCED_FLAGS)) assert.equal(v, false)
  // ต้องมีคีย์ครบเท่ากับ preset ปกติ ไม่งั้นโค้ดที่อ่าน flag จะได้ undefined
  assert.deepEqual(Object.keys(REDUCED_FLAGS).sort(), Object.keys(FX_PRESETS.high).sort())
})

test('ตัวคูณจังหวะตามสเปก', () => {
  assert.equal(PACE_PRESETS.grand, 1.25)
  assert.equal(PACE_PRESETS.normal, 1)
  assert.equal(PACE_PRESETS.tight, 0.8)
  assert.equal(paceMult('tight'), 0.8)
  assert.equal(paceMult('ไม่มีอันนี้'), 1)     // ชื่อมั่ว → normal
  assert.equal(paceMult(undefined), 1)
})

test('fxFlags ชื่อมั่ว → ตกกลับค่าเริ่มต้น', () => {
  assert.deepEqual(fxFlags('mid'), FX_PRESETS.mid)
  assert.deepEqual(fxFlags('ไม่มีอันนี้'), FX_PRESETS[DEFAULT_PREFS.fx])
  assert.deepEqual(fxFlags(undefined), FX_PRESETS[DEFAULT_PREFS.fx])
})

test('readPrefs: ไม่มีค่าเก็บไว้ → ค่าเริ่มต้น', () => {
  assert.deepEqual(readPrefs(fakeStorage()), DEFAULT_PREFS)
})

test('readPrefs: JSON เสีย → ค่าเริ่มต้น ไม่ throw', () => {
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': '{ไม่ใช่ json' })
  assert.deepEqual(readPrefs(s), DEFAULT_PREFS)
})

test('readPrefs: ค่าที่ไม่รู้จักถูกแทนที่ทีละฟิลด์', () => {
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ fx: 'ระเบิด', pace: 'tight' }) })
  assert.deepEqual(readPrefs(s), { fx: DEFAULT_PREFS.fx, pace: 'tight' })
})

test('writePrefs แล้ว readPrefs ได้ค่าเดิมกลับมา', () => {
  const s = fakeStorage()
  writePrefs({ fx: 'low', pace: 'grand' }, s)
  assert.deepEqual(readPrefs(s), { fx: 'low', pace: 'grand' })
})

test('ไม่มี storage เลย (SSR/โหมดปิดคุกกี้) → ไม่ throw', () => {
  assert.deepEqual(readPrefs(null), DEFAULT_PREFS)
  assert.doesNotThrow(() => writePrefs({ fx: 'low', pace: 'tight' }, null))
})

test('storage โยน error ตอนเขียน (โควตาเต็ม/Safari private) → ไม่ throw', () => {
  const boom = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
  assert.deepEqual(readPrefs(boom), DEFAULT_PREFS)
  assert.doesNotThrow(() => writePrefs({ fx: 'high', pace: 'normal' }, boom))
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

```
node --test src/utils/battleReplayPrefs.test.js
```
Expected: FAIL — `Cannot find module './battleReplayPrefs.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/battleReplayPrefs.js`:

```js
// battleReplayPrefs.js — preset ของ BattleReplay 2 แกนที่อิสระต่อกัน
//   แกน A (fx)   = ความอลังการของภาพ → ตอบคำถาม "แลคมั้ย" (กระทบต้นทุน GPU ล้วน)
//   แกน B (pace) = จังหวะ → ตอบคำถาม "สนุกมั้ย" (ไม่กระทบต้นทุนเลย)
// เก็บลง localStorage ของเครื่องนั้นเครื่องเดียว — ไม่แตะ config/app กัน user ทดสอบแล้วกระทบนักศึกษาที่กำลังเล่นอยู่

/** flags ทั้ง 5 ตัวต้องมีครบทุก preset — โค้ดที่อ่าน flag คาดหวัง boolean ไม่ใช่ undefined */
export const FX_PRESETS = {
  high: { cardLunge: true,  targetSquash: true,  screenShake: true,  burst: true, ko: true },
  mid:  { cardLunge: true,  targetSquash: false, screenShake: false, burst: true, ko: true },
  low:  { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true },
}

/** ใช้เมื่อเครื่องตั้ง prefers-reduced-motion — คงจังหวะ 4 ชั้นไว้ ตัดแต่การเคลื่อนไหว */
export const REDUCED_FLAGS = { cardLunge: false, targetSquash: false, screenShake: false, burst: false, ko: false }

export const PACE_PRESETS = { grand: 1.25, normal: 1, tight: 0.8 }

/** ⚠️ ค่าเริ่มต้นที่ส่งถึงนักศึกษาจริง — อัปเดตตรงนี้หลัง user เทสจอจริงผ่านพาเนล Admin แล้ว (§11.4 ของสเปก) */
export const DEFAULT_PREFS = { fx: 'high', pace: 'normal' }

const KEY = 'rxtu10.battleReplayPrefs'

function defaultStorage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function readPrefs(storage) {
  const s = storage === undefined ? defaultStorage() : storage
  if (!s) return { ...DEFAULT_PREFS }
  let raw = null
  try { raw = s.getItem(KEY) } catch { return { ...DEFAULT_PREFS } }
  if (!raw) return { ...DEFAULT_PREFS }
  let o = null
  try { o = JSON.parse(raw) } catch { return { ...DEFAULT_PREFS } }
  if (!o || typeof o !== 'object') return { ...DEFAULT_PREFS }
  return {
    fx:   FX_PRESETS[o.fx] ? o.fx : DEFAULT_PREFS.fx,          // ตกกลับทีละฟิลด์ ไม่ทิ้งทั้งก้อน
    pace: PACE_PRESETS[o.pace] ? o.pace : DEFAULT_PREFS.pace,
  }
}

export function writePrefs(p, storage) {
  const next = {
    fx:   FX_PRESETS[p && p.fx] ? p.fx : DEFAULT_PREFS.fx,
    pace: PACE_PRESETS[p && p.pace] ? p.pace : DEFAULT_PREFS.pace,
  }
  const s = storage === undefined ? defaultStorage() : storage
  if (s) { try { s.setItem(KEY, JSON.stringify(next)) } catch { /* โควตาเต็ม/private mode — ใช้ค่าใน memory ต่อไป */ } }
  return next
}

export function fxFlags(name) { return { ...(FX_PRESETS[name] || FX_PRESETS[DEFAULT_PREFS.fx]) } }
export function paceMult(name) { return PACE_PRESETS[name] ?? PACE_PRESETS.normal }
```

- [ ] **Step 4: รันเทสให้ผ่าน**

```
node --test src/utils/battleReplayPrefs.test.js
```
Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleReplayPrefs.js src/utils/battleReplayPrefs.test.js
git commit -m "Battle: battleReplayPrefs.js — preset ภาพ×จังหวะ เก็บใน localStorage (pure, มีเทส)"
```

---

## Task 3: `battleFx.js` — เอฟเฟกต์ที่รู้จัก tier และ flags

**Files:**
- Modify: `src/utils/battleFx.js`
- Modify: `src/components/battle/BattleReplay.vue` (เฉพาะบล็อก `<style>` ท้ายไฟล์ — เพิ่ม class ของ pool ใหม่)

**Interfaces:**
- Consumes: `fxFlags`, `REDUCED_FLAGS` จาก `./battleReplayPrefs.js`
- Produces (เพิ่มใน object ที่ `createBattleFx()` คืน):
  - `setFlags(flags)` — flags object จาก `fxFlags()`
  - `jab(fromUid, toUid, ms) → Promise` — ชั้น chip: ประกายเล็กบน FX layer ไม่แตะการ์ด
  - `lunge(el, fromUid, toUid, timing, tier) → Promise` — **แทน `cardLunge`** · 1 animation ครอบทั้ง beat
  - `squashTarget(el, tier, ms) → Promise`
  - `shake(px, times, rot) → Promise`
  - `ko(uid, el) → Promise`
  - `dangerRing(uid, on)` — ไม่คืน promise (สถานะค้าง)
  - `pop(uid, { dmg, crit, eff, tier })` — เพิ่มพารามิเตอร์ `tier`
  - `callout(uid, kind)` — เพิ่ม kind `'survive'`
  - `ring(uid, phase, ms)` — เพิ่มพารามิเตอร์ `ms`
  - `burst(uid, size)` — เพิ่มพารามิเตอร์ `size`
  - `projectile(fromUid, toUid, char, ms)` — เพิ่มพารามิเตอร์ `ms`
- **ลบออก:** `cardLunge` (ถูก `lunge` แทนที่ทั้งหมด)

- [ ] **Step 1: เพิ่ม flags + pool ใหม่**

ใน `src/utils/battleFx.js` เพิ่ม import ที่หัวไฟล์:

```js
import { fluentFile } from './emoji.js'
import { fxFlags, REDUCED_FLAGS } from './battleReplayPrefs.js'
```

ใน `createBattleFx()` เพิ่มตัวแปรสถานะ (ถัดจากบรรทัด `let boxEl = null, layer = null, getEl = () => null, rate = 1`):

```js
  let flags = fxFlags(undefined)                    // ค่าเริ่มต้นจาก DEFAULT_PREFS จนกว่า component จะเรียก setFlags
  const reducedMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const reduced = () => !!(reducedMQ && reducedMQ.matches)
  // อ่าน flag ผ่านตัวนี้เสมอ — reduced-motion ทับ preset ที่ user เลือกได้ตลอด
  const F = (k) => (reduced() ? REDUCED_FLAGS[k] : flags[k])
  function setFlags(f) { flags = { ...flags, ...(f || {}) } }
```

ขยาย `pool` และ `buildPools()`:

```js
  const pool = { pop: [], call: [], puff: [], ring: [], burst: [], proj: [], dash: [], jab: [], danger: [] }
  let popIdx = 0, callIdx = 0, puffIdx = 0, jabIdx = 0
  const dangerOn = new Map()      // uid → element ที่กำลังเต้นอยู่
```

ใน `buildPools()` เพิ่มท้าย (ก่อน `hideAllPools()`):

```js
    pool.jab = [mkImg('brfx-jab'), mkImg('brfx-jab')]
    pool.jab.forEach(e => imgSrc(e, '💥'))
    for (let i = 0; i < 8; i++) pool.danger.push(mkEl('brfx-danger'))   // สูงสุด 8 ตัวต่อไฟต์ (4v4)
```

ใน `cancelAll()` เพิ่มการล้างสถานะวงแหวนอันตรายก่อน `hideAllPools()`:

```js
  function cancelAll() {
    for (const a of anims) a.cancel()          // reject → run() กลืนแล้ว
    anims.clear()
    dangerOn.clear()                           // สถานะค้าง ต้องล้างด้วย ไม่งั้นไฟต์ใหม่จะ reuse element ไม่ได้
    hideAllPools()
  }
```

- [ ] **Step 2: เขียนเอฟเฟกต์ใหม่**

เพิ่มฟังก์ชันเหล่านี้ใน `createBattleFx()` (วางถัดจาก `burst`):

```js
  // ── ชั้น chip: ประกายเล็กระหว่างทาง ไม่แตะการ์ดเลย (นี่คือเหตุผลที่ชั้น 1 ราคาเกือบศูนย์) ──
  function jab(fromUid, toUid, ms = 110) {
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = pool.jab[jabIdx = (jabIdx + 1) % pool.jab.length]
    el.getAnimations?.().forEach(x => x.cancel())
    el.style.opacity = '1'
    const mx = a.x + (b.x - a.x) * 0.7, my = a.y + (b.y - a.y) * 0.7   // หยุดที่ 70% = ฟีล "เอื้อมไปแตะ"
    return run(el, [
      { transform: `translate(${a.x}px, ${a.y}px) scale(.3) translateZ(0)`, opacity: .7 },
      { transform: `translate(${mx}px, ${my}px) scale(.85) translateZ(0)`, opacity: 1, offset: .7 },
      { transform: `translate(${mx}px, ${my}px) scale(.6) translateZ(0)`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }

  // ── การ์ดพุ่ง: 1 animation ครอบ windup+motion+hitstop+tail ทั้งก้อน (ข้อบังคับ v3 — 1 promotion/หมัด) ──
  // ท่าต่อชั้น: pull = ถอยหลังกี่ px · psx/psy = สเกลตอนย่อ · sx/sy = สเกลตอนพุ่งถึง (ยืดตามทิศ)
  const LUNGE_POSE = {
    solid:  { pull: 14, psx: 1.06, psy: 0.90, sx: 0.90, sy: 1.18 },
    heavy:  { pull: 24, psx: 1.12, psy: 0.94, sx: 0.82, sy: 1.30 },
    finish: { pull: 28, psx: 1.16, psy: 0.92, sx: 0.80, sy: 1.34 },
  }
  function lunge(el, fromUid, toUid, timing, tier) {
    if (!F('cardLunge') || !el) return Promise.resolve()
    const P = LUNGE_POSE[tier]; if (!P) return Promise.resolve()      // chip ไม่มีท่า = ไม่พุ่ง
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const total = timing.windup + timing.motion + timing.hitstop + timing.tail
    if (total <= 0) return Promise.resolve()
    const dx = (b.x - a.x).toFixed(1), dy = (b.y - a.y).toFixed(1)
    const o1 = timing.windup / total
    const o2 = (timing.windup + timing.motion) / total
    const o3 = (timing.windup + timing.motion + timing.hitstop) / total
    const hit = `translate(${dx}px, ${dy}px) scale(${P.sx}, ${P.sy})`
    // เฟรม o2→o3 ซ้ำท่าเดิม = การ์ดหยุดนิ่งช่วง hitstop โดยไม่ต้องแตกเป็น animation ที่สอง
    const kf = [
      { transform: 'translate(0,0) scale(1)', offset: 0 },
      { transform: `translate(0, ${P.pull}px) scale(${P.psx}, ${P.psy})`, offset: o1 },
      { transform: hit, offset: o2 },
      { transform: hit, offset: o3 },
      { transform: 'translate(0,0) scale(1)', offset: 1 },
    ]
    el.style.zIndex = '7'                        // static ก่อนเริ่ม ไม่อยู่ใน keyframes (ข้อบังคับ v3)
    const anim = el.animate(kf, { duration: total, easing: 'ease-in-out', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => {
      anims.delete(anim); el.style.zIndex = ''; el.style.transform = ''
    })
  }

  // ── เป้าบีบตัวแล้วดีดกลับ — ชั้น heavy/finish เท่านั้น (preset high) ──
  function squashTarget(el, tier, ms = 400) {
    if (!F('targetSquash') || !el) return Promise.resolve()
    const amt = tier === 'finish' ? 0.5 : 0.36
    const anim = el.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${(1 + amt * 0.5).toFixed(3)}, ${(1 - amt).toFixed(3)})`, offset: .3 },
      { transform: `scale(${(1 - amt * 0.3).toFixed(3)}, ${(1 + amt * 0.4).toFixed(3)})`, offset: .6 },
      { transform: 'scale(1)' },
    ], { duration: ms, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); el.style.transform = '' })
  }

  // ── จอสั่น — ของแพงที่สุดในไฟล์นี้ (transform ทั้ง .br-box = re-raster เต็มจอ) ──
  // เปิดเฉพาะ preset high และเรียกได้เฉพาะชั้น heavy/finish เท่านั้น (§6.2 ของสเปก)
  function shake(px, times, rot = false) {
    if (!F('screenShake') || !boxEl) return Promise.resolve()
    const kf = [{ transform: 'translate(0,0)' }]
    for (let i = 0; i < times; i++) {
      kf.push({ transform: `translate(${px}px, ${-px}px)${rot ? ' rotate(.6deg)' : ''}` })
      kf.push({ transform: `translate(${-px}px, ${px}px)${rot ? ' rotate(-.6deg)' : ''}` })
    }
    kf.push({ transform: 'translate(0,0)' })
    const anim = boxEl.animate(kf, { duration: 90 * times + 60, easing: 'ease-out', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); boxEl.style.transform = '' })
  }

  // ── น็อก: การ์ดหมุนกระเด็นออก + ควัน (แทน koPuff เดิมสำหรับชั้น finish) ──
  function ko(uid, el) {
    koPuff(uid)
    if (!F('ko') || !el) return Promise.resolve()
    const anim = el.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: 'translate(70px,-60px) rotate(150deg) scale(.6)', opacity: 0 },
    ], { duration: 520, easing: 'ease-in', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); el.style.transform = '' })
  }

  // ── โซนอันตราย: วงแหวนเต้นค้างบน FX pool (ห้ามทำบนการ์ด = layer ค้างถาวร ตามข้อบังคับ v3) ──
  function dangerRing(uid, on) {
    if (on) {
      if (dangerOn.has(uid)) return
      const free = pool.danger.find(e => !Array.from(dangerOn.values()).includes(e))
      if (!free) return
      const base = baseXform(uid, 0, 0); if (!base) return
      free.style.transform = base
      free.style.opacity = '1'
      free.getAnimations?.().forEach(a => a.cancel())
      // infinite ได้เพราะเป็น pool element ที่ promote ถาวรอยู่แล้ว + animate แค่ opacity
      const anim = free.animate(
        [{ opacity: .15 }, { opacity: .75 }, { opacity: .15 }],
        { duration: 900, iterations: Infinity, easing: 'ease-in-out' })
      anims.add(anim)          // โดน cancelAll() เก็บกวาดตอน reset/ไฟต์ใหม่
      dangerOn.set(uid, free)
      return
    }
    const el = dangerOn.get(uid)
    if (!el) return
    el.getAnimations?.().forEach(a => a.cancel())
    el.style.opacity = '0'
    dangerOn.delete(uid)
  }
```

- [ ] **Step 3: แก้เอฟเฟกต์เดิมให้รับ tier/ms/flags**

แก้ `pop` — เปลี่ยนลายเซ็นและเพิ่มคลาสตามชั้น:

```js
  const POP_TIER_CLS = { chip: 'tier-chip', solid: 'tier-solid', heavy: 'tier-heavy', finish: 'tier-finish' }
  function pop(uid, { dmg, crit, eff, tier }) {
    const el = pool.pop[popIdx = (popIdx + 1) % pool.pop.length]
    el.getAnimations?.().forEach(a => a.cancel())
    el.textContent = '-' + dmg
    el.className = 'brfx brfx-pop ' + (POP_TIER_CLS[tier] || POP_TIER_CLS.solid)
      + (crit ? ' crit' : eff === 'super' ? ' super' : eff === 'weak' ? ' weak' : '')
    const dx = Math.round(Math.random() * 28 - 14)
    const base = baseXform(uid, dx, -6); if (!base) return
    el.style.opacity = '1'
    // ชั้นสูงให้เลขอยู่นานกว่า — คงหลักการเดิมว่าไม่หารด้วย rate (อ่านเลขทันเสมอ)
    const ms = tier === 'finish' ? 1100 : tier === 'heavy' ? 900 : tier === 'chip' ? 420 : 620
    const rise = tier === 'finish' ? 26 : tier === 'heavy' ? 30 : tier === 'chip' ? 14 : 22
    const spring = tier !== 'chip'
    const kf = spring ? [
      { transform: base + ' translateY(0) scale(.3)', opacity: 0, offset: 0 },
      { transform: base + ' translateY(-6px) scale(1.35)', opacity: 1, offset: .28 },
      { transform: base + ' translateY(-12px) scale(1)', opacity: 1, offset: .45 },
      { transform: base + ` translateY(-${rise}px) scale(1)`, opacity: 0, offset: 1 },
    ] : [
      { transform: base + ' translateY(0)', opacity: 0, offset: 0 },
      { transform: base + ' translateY(-4px)', opacity: 1, offset: .2 },
      { transform: base + ` translateY(-${rise}px)`, opacity: 0, offset: 1 },
    ]
    const a = el.animate(kf, { duration: ms, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { if (el.textContent === '-' + dmg) el.style.opacity = '0' })
  }
```

แก้ `callout` เพิ่ม kind `'survive'` — แทนบรรทัด `el.textContent = ...` ด้วย:

```js
    el.textContent = kind === 'super' ? 'แพ้ทาง! ⚡' : kind === 'survive' ? 'รอด!' : 'ต้านทาน 🛡️'
```

แก้ `ring` ให้รับเวลา — เปลี่ยนลายเซ็นเป็น `function ring(uid, phase, ms)` และแทน `{ duration: phase === 'windup' ? 250 : 120, ... }` ด้วย:

```js
    }, { duration: ms || (phase === 'windup' ? 250 : 120), easing: 'ease-out', fill: 'forwards' })
```

แก้ `burst` ให้รับขนาด + เคารพ flag — เปลี่ยนลายเซ็นเป็น `function burst(uid, size)` แล้วเพิ่มที่ต้นฟังก์ชันและก่อน `run`:

```js
  function burst(uid, size) {
    if (!F('burst')) return Promise.resolve()
    const el = pool.burst[burstIdx = (burstIdx + 1) % pool.burst.length]
    el.getAnimations?.().forEach(a => a.cancel())
    const base = baseXform(uid, 0, 0); if (!base) return Promise.resolve()
    if (size) { el.style.width = size + 'px'; el.style.height = size + 'px' }   // ทับ .brfx-burst ที่ตั้ง 2rem ไว้
    el.style.opacity = '1'
    return run(el, [
      { transform: base + ' scale(.4)', opacity: 1 },
      { transform: base + ' scale(1.4)', opacity: 0 },
    ], { duration: 280, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }
```

แก้ `projectile` ให้รับเวลา — เปลี่ยนลายเซ็นเป็น `function projectile(fromUid, toUid, char, ms)` และแทน `{ duration: 280, ... }` ด้วย `{ duration: ms || 280, ... }`

**ลบ `cardLunge` ทิ้งทั้งฟังก์ชัน** (ถูก `lunge` แทนที่)

แก้บรรทัด return ท้ายไฟล์:

```js
  return {
    attach, reset, cancelAll, setRate, setFlags, destroy, centerOf, invalidateCenters,
    pop, callout, koPuff, ring, burst, projectile, dash,
    jab, lunge, squashTarget, shake, ko, dangerRing,
  }
```

- [ ] **Step 4: เพิ่ม CSS ของ pool ใหม่**

ใน `src/components/battle/BattleReplay.vue` บล็อก `<style>` **ตัวที่ไม่ scoped** (ท้ายไฟล์) เพิ่มต่อจาก `.brfx-ring.acting`:

```css
/* ขนาดเลขตามชั้น — นี่คือช่องทางหลักที่ผู้เล่นอ่านน้ำหนักของหมัดออกขณะดูเร็วๆ */
.brfx-pop.tier-chip   { font-size: .9rem;  color: #fecaca; }
.brfx-pop.tier-solid  { font-size: 1.15rem; }
.brfx-pop.tier-heavy  { font-size: 1.7rem; }
.brfx-pop.tier-finish { font-size: 2.3rem; }
/* crit/super/weak ทับสีได้ แต่ห้ามทับขนาดของชั้น — ชั้นเป็นเจ้าของขนาด */
.brfx-pop.crit { color: #fbbf24; }
.brfx-pop.weak { color: #cbd5e1; }

.brfx-call.survive { background: #34d399; color: #06371f; }

.brfx-jab { width: 1.1rem; height: 1.1rem; }

/* วงแหวนโซนอันตราย — เต้นด้วย opacity ล้วนบน pool element ที่ promote ถาวรแล้ว */
.brfx-danger {
  width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 18px;
  box-shadow: 0 0 0 3px #ef4444, 0 0 16px 3px rgba(239, 68, 68, .5);
}
```

**ลบบรรทัดเดิม** `.brfx-pop { ... font-size: 1.5rem; ... }` ออกเฉพาะส่วน `font-size` และ `.brfx-pop.crit { color: #fbbf24; font-size: 2rem; }` / `.brfx-pop.super { color: #fca5a5; }` / `.brfx-pop.weak { color: #cbd5e1; font-size: 1.1rem; }` — ขนาดต้องมาจากชั้นอย่างเดียว ไม่งั้น crit จะไปทับขนาดของ finish · เก็บ `.brfx-pop.super { color: #fca5a5; }` ไว้

- [ ] **Step 5: ตรวจว่า build ผ่านและไม่มี reference ค้าง**

```
grep -rn "cardLunge" src/
npm run build
```
Expected: `grep` ไม่เจออะไรเลย (ถ้าเจอใน `BattleReplay.vue` แปลว่ายังไม่ได้แก้ — Task 4 จะแก้ ให้ปล่อยไว้ก่อนแล้วรวม commit กับ Task 4 แทน) · `npm run build` สำเร็จไม่มี error

- [ ] **Step 6: Commit**

```bash
git add src/utils/battleFx.js src/components/battle/BattleReplay.vue
git commit -m "Battle: battleFx รับ tier + preset flags (jab/lunge/squash/shake/ko/dangerRing) แทน cardLunge"
```

---

## Task 4: `BattleReplay.vue` — เดินเวลาตาม beat

**Files:**
- Modify: `src/components/battle/BattleReplay.vue` (ส่วน `<script setup>`)

**Interfaces:**
- Consumes: `buildBeats`, `scaleTiming` จาก `../../utils/battleBeats.js` · `readPrefs`, `fxFlags`, `paceMult` จาก `../../utils/battleReplayPrefs.js` · `fx.jab/lunge/squashTarget/shake/ko/ring/burst/pop/projectile` จาก Task 3
- Produces: `beats` computed · `ffActive` ref (Task 6 จะเป็นคนเปิด/ปิด) · `applyAttack(beat)` ที่เดินตาม `beat.timing`

- [ ] **Step 1: เพิ่ม import และ state**

เพิ่มใน import block:

```js
import { buildBeats, scaleTiming } from '../../utils/battleBeats.js'
import { readPrefs, fxFlags, paceMult } from '../../utils/battleReplayPrefs.js'
```

แทน `const REPLAY_CFG = { baseDelay: 380, speeds: [1, 2, 4], hitStopMs: 130, resultDelayMs: 500 }` ด้วย:

```js
// เวลาทั้งหมดมาจาก beat.timing แล้ว — เหลือแค่เวลา "รอบนอกไฟต์"
// resultDelayMs 900 (เดิม 500) = ให้หมัดน็อกชั้น finish ได้ลงจอดก่อนเปิด modal สรุป
const REPLAY_CFG = { resultDelayMs: 900 }
```

เพิ่มถัดจาก `const speed = ref(1)` (แล้ว**ลบ** `speed` ทิ้ง เพราะปุ่มเร็วหายไปใน Task 6):

```js
const prefs = ref(readPrefs())          // อ่านครั้งเดียวตอน mount — พาเนล Admin เขียนก่อนเปิด replay อยู่แล้ว
const ffActive = ref(false)             // โหมดเร่ง (กดค้าง) — Task 6 เป็นคนสลับ
const pace = computed(() => paceMult(prefs.value.pace))
```

- [ ] **Step 2: แทน `log` computed ด้วย `beats`**

แทน `const log = computed(() => props.data?.result?.log || [])` ด้วย:

```js
const rawLog = computed(() => props.data?.result?.log || [])
const beats = computed(() => buildBeats(rawLog.value, maxHp))
```

⚠️ `maxHp` เป็น plain object ที่ `buildMax()` เขียนทับ ไม่ใช่ ref — `beats` จึงไม่ re-compute เองเมื่อ `maxHp` เปลี่ยน **แต่ปลอดภัย** เพราะ `buildMax(d)` ถูกเรียกก่อน `reset()` ในตัว watcher เดียวกันเสมอ และ `rawLog` เปลี่ยนพร้อมกัน (`props.data` ใหม่ทั้งก้อน) ซึ่ง trigger การ compute ใหม่อยู่แล้ว

แทนทุกจุดที่อ้าง `log.value` ด้วย `beats.value`:
- `const done = computed(() => idx.value >= beats.value.length)`
- `summary` computed — ใช้ `rawLog.value` (`computeBattleSummary` ต้องการ event ดิบ) → `computeBattleSummary(rawLog.value, ...)`
- ใน `step()` และ `skipToEnd()` (ซึ่ง Task 6 จะลบ `skipToEnd` ทิ้ง)

**ลบ** `const delay = computed(() => REPLAY_CFG.baseDelay / speed.value)` ทิ้ง

- [ ] **Step 3: เขียน `applyAttack` ใหม่ให้เดินตาม timing**

แทนฟังก์ชัน `applyAttack` เดิมทั้งก้อนด้วย:

```js
// windup → motion → impact → hitstop → tail ตาม beat.timing
// การ์ดพุ่ง = 1 animation ครอบทั้ง beat (ยิงแล้วไม่ await — เราเดินเวลาด้วย wait() แยก) ตามข้อบังคับ v3
async function applyAttack(beat) {
  const g = gen
  const t = scaleTiming(beat, { pace: pace.value, ff: ffActive.value })
  const def = defForUid(beat.attacker)
  const ranged = atkStyleOf(def) === 'ranged'

  if (beat.tier !== 'chip') {
    highlight(beat.attacker, 'windup')                       // เปลี่ยน class ให้เสร็จ "ก่อน" สั่ง animate (ข้อบังคับ v3)
    fx?.ring(beat.attacker, 'windup', t.windup)
    if (!ranged) fx?.lunge(els[beat.attacker], beat.attacker, beat.target, t, beat.tier)
    await wait(t.windup); if (g !== gen) return
    highlight(beat.attacker, 'windup', false)
  }
  highlight(beat.attacker, 'acting')

  if (ranged) fx?.projectile(beat.attacker, beat.target, projectileOf(def), t.motion)
  else if (beat.tier === 'chip') fx?.jab(beat.attacker, beat.target, t.motion)
  // melee ชั้นอื่น: การ์ดพุ่งอยู่แล้วจาก lunge() ด้านบน ไม่ต้องยิงอะไรเพิ่ม

  await wait(t.motion); if (g !== gen) return
  applyImpact(beat, g)
  await wait(t.hitstop); if (g !== gen) return
  highlight(beat.attacker, 'acting', false)
  await wait(t.tail)
}
```

**ลบ** ฟังก์ชัน `playMotion` และ `meleeMode` ทิ้ง (`?melee=dash` เป็น plan B ของ v3 ที่ตัดสินไปแล้วว่าใช้ card — และ `lunge` ครอบหน้าที่นี้หมดแล้ว)

- [ ] **Step 4: แก้ `applyImpact` ให้ใช้ tier**

แทน `applyImpact` เดิมด้วย:

```js
// impact: hp/pop/callout/burst/ko ตอนโดนตี — รับ g เช็ค gen กัน reset ระหว่างพุ่งมาเขียน state เก่าทับ
function applyImpact(beat, g) {
  if (g !== gen) return
  const tgtEl = els[beat.target]
  highlight(beat.target, 'flash')
  setTimeout(() => { if (g === gen) highlight(beat.target, 'flash', false) }, 250)

  // ขนาดดาว/แรงสั่นตามชั้น — ชั้น chip/solid ห้ามสั่นจอเด็ดขาด (§6.2 ของสเปก)
  if (beat.tier === 'chip') { /* ชั้นถากไม่มีดาว ไม่มีสั่น */ }
  else if (beat.tier === 'solid') fx?.burst(beat.target, 34)
  else if (beat.tier === 'heavy') { fx?.burst(beat.target, 66); fx?.shake(5, 2); fx?.squashTarget(tgtEl, 'heavy', 420) }
  else { fx?.burst(beat.target, 92); fx?.shake(8, 3, true); fx?.squashTarget(tgtEl, 'finish', 420) }

  hp.value = { ...hp.value, [beat.target]: Math.max(0, Math.round((beat.targetHpAfter / (maxHp[beat.target] || 1)) * 100)) }
  setDead(beat.target)

  fx?.pop(beat.target, { dmg: beat.dmg, crit: beat.crit, eff: beat.eff, tier: beat.tier })
  if (beat.eff === 'super' || beat.eff === 'weak') fx?.callout(beat.target, beat.eff)

  // อนิเมชันน็อกผูกกับ beat.kill ไม่ใช่กับชั้น — 1 ไฟต์ตาย 4–5 ตัว แต่มีชั้น finish แค่หมัดเดียว
  if (beat.kill) { fx?.dangerRing(beat.target, false); fx?.ko(beat.target, tgtEl) }
  else {
    if (beat.danger) fx?.dangerRing(beat.target, true)
    if (beat.survive) fx?.callout(beat.target, 'survive')
  }
}
```

- [ ] **Step 5: แก้ `step()` ให้เลิกใช้ `delay`**

แทน `step()` เดิมด้วย:

```js
async function step() {
  clearTimeout(timer)
  if (paused.value) return
  if (idx.value >= beats.value.length) { clearHighlights(); return }
  const g = gen
  const b = beats.value[idx.value]
  const h = handlers[b.t]
  if (h) await h(b)          // attack = รอครบทั้ง beat จริง · round = sync · type ที่ไม่รู้จัก = ข้ามเงียบ
  if (g !== gen) return
  idx.value++
  // ช่องว่างระหว่างหมัดอยู่ใน beat.timing.tail แล้ว — ไม่มี baseDelay อีกต่อไป
  if (idx.value < beats.value.length) timer = setTimeout(step, 0)
  else clearHighlights()
}
```

- [ ] **Step 6: ตั้ง flags ตอน attach และล้างวงแหวนตอน reset**

ใน `ensureFx()` แทน `fx.setRate(speed.value)` ด้วย:

```js
  fx.setFlags(fxFlags(prefs.value.fx))
```

ใน `reset()` เพิ่มบรรทัดอ่าน prefs ใหม่ (บนสุดของฟังก์ชัน ถัดจาก `gen++`):

```js
  prefs.value = readPrefs()     // อ่านใหม่ทุกไฟต์ — พาเนล Admin เปลี่ยนค่าแล้วยิงไฟต์ทดสอบต้องเห็นผลทันที
```

(`fx.reset()` เรียก `cancelAll()` ซึ่งล้าง `dangerOn` ให้แล้วจาก Task 3)

- [ ] **Step 7: ตรวจด้วย build + ทดลองใน dev**

```
npm run build
npm run dev
```
Expected: build ผ่าน · เปิดหอคอย สู้ 1 ไฟต์ แล้วเห็น:
- หมัดเล็กๆ ผ่านไปเร็วมาก (การ์ดไม่ขยับ มีแค่ประกาย + เลขเล็ก)
- หมัดคริ/แพ้ทาง มีช่วงถอยเงื้อมีวงแหวนเรืองชัดเจนก่อนพุ่ง
- หมัดสุดท้ายช้าลง มีจังหวะนิ่ง แล้วการ์ดหมุนกระเด็นออก
- ไฟต์จบเร็วกว่าเดิมชัดเจน (จับเวลาคร่าวๆ ควรราว 18–22 วิ ไม่ใช่ 27)

- [ ] **Step 8: Commit**

```bash
git add src/components/battle/BattleReplay.vue
git commit -m "Battle: BattleReplay เดินเวลาตาม beat.timing แทน baseDelay คงที่ (4 ชั้นทำงานจริง)"
```

---

## Task 5: หลอดเลือด — หลอดผี + โซนอันตราย

**Files:**
- Modify: `src/components/battle/BattleReplay.vue` (template + style scoped)

**Interfaces:**
- Consumes: `hpPct(uid)` เดิม · `fx.dangerRing` จาก Task 3 (Task 4 เรียกไปแล้ว)
- Produces: หลอดผีในทุกการ์ด — ไม่มี API ใหม่ให้ task อื่นใช้

- [ ] **Step 1: เพิ่มหลอดผีในเทมเพลต**

ใน `src/components/battle/BattleReplay.vue` **ทั้งสองบล็อก** (ทีมศัตรู `br-unit foe` และทีมเรา `br-unit me`) เพิ่ม `<div class="br-hp-ghost">` **ก่อน** `.br-hp-fill` เสมอ

ฝั่งศัตรู:

```html
          <div class="br-hp">
            <div class="br-hp-ghost" :style="{ transform: 'scaleX(' + hpPct('B'+i) / 100 + ')' }"></div>
            <div class="br-hp-fill" :style="{ transform: 'scaleX(' + hpPct('B'+i) / 100 + ')' }"></div>
            <span v-for="(t, ti) in ticksFor('B'+i)" :key="ti" class="br-tick" :style="{ left: t + '%' }"></span>
          </div>
```

ฝั่งเรา:

```html
          <div class="br-hp">
            <div class="br-hp-ghost" :style="{ transform: 'scaleX(' + hpPct('A'+i) / 100 + ')' }"></div>
            <div class="br-hp-fill mine" :style="{ transform: 'scaleX(' + hpPct('A'+i) / 100 + ')' }"></div>
            <span v-for="(t, ti) in ticksFor('A'+i)" :key="ti" class="br-tick" :style="{ left: t + '%' }"></span>
          </div>
```

**กลไก:** ทั้งสองหลอดผูกกับค่าเดียวกัน แต่ transition ต่างกัน — หลอดจริงหดทันที (0.1s) หลอดผีหน่วง 0.16s แล้วค่อยหดช้าๆ (0.45s) ช่องว่างสีขาวที่โผล่ระหว่างนั้นคือ "เพิ่งเสียไปเท่านี้" ไม่ต้องมี state เพิ่มแม้แต่ตัวเดียว

- [ ] **Step 2: เพิ่ม CSS**

ในบล็อก `<style scoped>` แก้ `.br-hp-fill` และเพิ่ม `.br-hp-ghost` ต่อจากมัน:

```css
.br-hp-fill { width: 100%; height: 100%; background: #ef4444; border-radius: 999px; transform-origin: left center; transition: transform .1s linear; }
.br-hp-fill.mine { background: #34d399; }
/* หลอดผี: อยู่ใต้หลอดจริง หดตามหลัง → ช่องขาวที่โผล่ = ดาเมจที่เพิ่งกิน */
.br-hp-ghost { position: absolute; inset: 0; background: #fff; opacity: .75; border-radius: 999px;
  transform-origin: left center; transition: transform .45s ease-out .16s; }
```

⚠️ `.br-hp-fill` เดิมเป็น `transition: transform .2s ease-out` — ต้องเปลี่ยนเป็น `.1s linear` ไม่งั้นหลอดจริงกับหลอดผีหดพร้อมกันจนมองไม่เห็นช่องว่าง
⚠️ `.br-hp-fill` ต้องมี `position: relative` หรืออยู่หลัง ghost ใน DOM เพื่อให้ทับข้างบน — ลำดับใน DOM จัดการให้แล้ว (ghost มาก่อน) แต่ต้องเพิ่ม `position: relative` ใน `.br-hp-fill` เพื่อให้ชนะ `position: absolute` ของ ghost:

```css
.br-hp-fill { position: relative; width: 100%; height: 100%; background: #ef4444; border-radius: 999px; transform-origin: left center; transition: transform .1s linear; }
```

- [ ] **Step 3: ตรวจด้วย build + ทดลองใน dev**

```
npm run build
npm run dev
```
Expected:
- ทุกครั้งที่โดนตี เห็นแถบขาวโผล่แล้วไล่ตามหลังหลอดสีจนหาย
- เมื่อตัวไหนเลือดเหลือต่ำกว่า 25% มีวงแหวนแดงเต้นค้างรอบการ์ดนั้น
- ตัวนั้นตาย → วงแหวนหายทันที ไม่ค้าง
- เล่นไฟต์ใหม่ → ไม่มีวงแหวนค้างจากไฟต์ก่อน

- [ ] **Step 4: Commit**

```bash
git add src/components/battle/BattleReplay.vue
git commit -m "Battle: หลอดผีไล่ตามหลัง + วงแหวนโซนอันตราย = ความลุ้นย้ายมาอยู่ที่หลอดเลือด"
```

---

## Task 6: ปุ่มควบคุม — เอาข้าม/เร็วออก ใส่กดค้างเร่ง

**Files:**
- Modify: `src/components/battle/BattleReplay.vue` (template + script + style scoped)

**Interfaces:**
- Consumes: `ffActive` ref จาก Task 4
- Produces: ไม่มี API ใหม่

- [ ] **Step 1: ลบปุ่มข้ามและปุ่มเร็วออกจากเทมเพลต**

แทนบล็อก `.br-ctrl` เดิมทั้งก้อนด้วย:

```html
      <div class="br-ctrl" v-if="!done">
        <button class="br-btn sm" @click="togglePause"><Emoji :char="paused ? '▶️' : '⏸️'" /> {{ paused ? 'เล่น' : 'พัก' }}</button>
      </div>
      <div v-if="ffActive" class="br-ff"><Emoji char="⏩" /> เร่ง</div>
      <div v-if="holdHint" class="br-hold-hint">กดค้างเพื่อเร่ง</div>
```

- [ ] **Step 2: ผูก long-press เข้ากับกล่องสนาม**

แก้ `<div class="br-box" ref="boxRef">` เป็น:

```html
    <div class="br-box" ref="boxRef"
         @pointerdown="onHoldStart" @pointerup="onHoldEnd"
         @pointercancel="onHoldEnd" @pointerleave="onHoldEnd">
```

- [ ] **Step 3: ลบ `skipToEnd`/`cycleSpeed` และเขียน long-press**

ใน `<script setup>`:

**ลบ** ฟังก์ชัน `skipToEnd()` และ `cycleSpeed()` ทั้งก้อน · **ลบ** `const speed = ref(1)` (ถ้ายังเหลือจาก Task 4)

เพิ่ม:

```js
// ── กดค้าง = เร่ง (ไม่ใช่ข้าม) ──
// กติกาที่ทำให้มันไม่ใช่ปุ่มข้าม: FF_SCALE ใน battleBeats ย่อเฉพาะ chip/solid — heavy/finish เล่นเต็มเสมอ
// ผลคือคนรีบก็ยังได้ดูคริกับหมัดน็อกครบ แล้วจบที่หน้าสรุปเหมือนกัน
const HOLD_MS = 400
const holdHint = ref(false)
let holdTimer = null, hintTimer = null
function onHoldStart(e) {
  if (done.value || inspectUid.value) return
  if (e.target.closest && e.target.closest('.br-unit, .br-btn')) return   // แตะการ์ด/ปุ่ม = คนละเจตนา
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => { ffActive.value = true; holdHint.value = false }, HOLD_MS)
}
function onHoldEnd() {
  clearTimeout(holdTimer)
  if (!ffActive.value) {
    // แตะสั้นๆ โดยไม่ค้าง → บอกใบ้ว่ามีทางเร่งอยู่ (ค้นพบได้ตอนต้องการ ไม่ล่อตาตอนไม่ต้องการ)
    holdHint.value = true
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { holdHint.value = false }, 1500)
  }
  ffActive.value = false
}
```

ใน `reset()` เพิ่มการล้างสถานะ (ถัดจาก `paused.value = false`):

```js
  ffActive.value = false; holdHint.value = false
  clearTimeout(holdTimer); clearTimeout(hintTimer)
```

ใน `onUnmounted` เพิ่ม `clearTimeout(holdTimer); clearTimeout(hintTimer)`

- [ ] **Step 4: เพิ่ม CSS**

ในบล็อก `<style scoped>`:

```css
/* ป้ายบอกสถานะเร่ง — เกาะมุมบนซ้ายของกล่อง ไม่บังสนาม */
.br-ff { position: absolute; top: 2px; left: 4px; z-index: 11; font-size: .72rem; font-weight: 800;
  color: #fde68a; background: rgba(0,0,0,.55); border-radius: 7px; padding: 2px 7px; pointer-events: none; }
.br-hold-hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: 46px; z-index: 11;
  font-size: .72rem; font-weight: 700; color: rgba(255,255,255,.75); background: rgba(0,0,0,.45);
  border-radius: 999px; padding: 4px 10px; pointer-events: none; animation: br-hint-in .2s ease; }
@keyframes br-hint-in { from { opacity: 0 } to { opacity: 1 } }
```

- [ ] **Step 5: ตรวจว่าไม่มี reference ค้าง แล้ว build**

```
grep -n "skipToEnd\|cycleSpeed\|speed\.value\|REPLAY_CFG.speeds\|baseDelay\|hitStopMs" src/components/battle/BattleReplay.vue
npm run build
```
Expected: `grep` ไม่เจออะไรเลย · build ผ่าน

- [ ] **Step 6: ทดลองใน dev**

```
npm run dev
```
Expected:
- แถบล่างเหลือปุ่ม "พัก" ปุ่มเดียว ไม่มี "ข้ามไปผล" ไม่มี "เร็ว ×N"
- แตะจอแป๊บเดียวแล้วปล่อย → ขึ้นคำใบ้ "กดค้างเพื่อเร่ง" แล้วหายไปเอง
- กดค้าง → ขึ้นป้าย "⏩ เร่ง" หมัดเล็กวิ่งเร็วขึ้นชัดเจน
- **กดค้างต่อไปตอนถึงหมัดคริ/หมัดน็อก → ต้องยังเล่นเต็มความยาว ไม่ถูกย่อ** (นี่คือกติกาหลักของฟีเจอร์)
- ปล่อยนิ้ว → กลับความเร็วปกติทันที ป้ายหาย
- แตะการ์ดเพ็ท → เปิด inspect ตามเดิม ไม่ไปทริกเกอร์โหมดเร่ง

- [ ] **Step 7: Commit**

```bash
git add src/components/battle/BattleReplay.vue
git commit -m "Battle: เอาปุ่มข้าม+ปุ่มเร็วออก เหลือพัก + กดค้างเร่งที่ไม่ย่อชั้น heavy/finish"
```

---

## Task 7: พาเนลทดสอบใน Admin

**Files:**
- Modify: `src/views/AdminView.vue`
- Modify: `src/components/battle/BattleReplay.vue` (สรุปตัวเลข fps หลังไฟต์)

**Interfaces:**
- Consumes: `FX_PRESETS`, `PACE_PRESETS`, `readPrefs`, `writePrefs` จาก `../utils/battleReplayPrefs.js` · `simulateBattle` จาก `../utils/battleEngine.js` · `BattleReplay` component
- Produces: prop ใหม่บน `BattleReplay` — `data.fpsMeter === true` เปิดมิเตอร์และตัวนับโดยไม่ต้องพิมพ์ `?fps=1`

- [ ] **Step 1: ขยายมิเตอร์ fps ให้นับเฟรมแย่**

ใน `src/components/battle/BattleReplay.vue` แทนบล็อก FPS meter เดิมด้วย:

```js
// ── FPS/frame-time meter — เปิดด้วย ?fps=1 ท้าย URL หรือ data.fpsMeter (พาเนล Admin) ──
// worst = frame time แย่สุดใน ~1 วิ · over16/over33 = จำนวนเฟรมสะสมทั้งไฟต์ที่หลุด 60fps / ต่ำกว่า 30fps
const showFps = computed(() => new URLSearchParams(location.search).has('fps') || props.data?.fpsMeter === true)
const fpsWorst = ref(0)
const fpsOver16 = ref(0)
const fpsOver33 = ref(0)
const fpsPeak = ref(0)
let fpsRaf = 0, fpsLast = 0, fpsMax = 0, fpsWindowStart = 0
function fpsLoop(now) {
  if (fpsLast) {
    const dt = now - fpsLast
    if (dt > fpsMax) fpsMax = dt
    if (dt > fpsPeak.value) fpsPeak.value = dt
    if (dt > 33) fpsOver33.value++
    else if (dt > 16) fpsOver16.value++
    if (now - fpsWindowStart > 1000) { fpsWorst.value = Math.round(fpsMax); fpsMax = 0; fpsWindowStart = now }
  } else { fpsWindowStart = now }
  fpsLast = now
  fpsRaf = requestAnimationFrame(fpsLoop)
}
function startFps() {
  if (!showFps.value || fpsRaf) return
  fpsLast = 0; fpsMax = 0; fpsWindowStart = 0
  fpsPeak.value = 0; fpsOver16.value = 0; fpsOver33.value = 0
  fpsRaf = requestAnimationFrame(fpsLoop)
}
watch(showFps, (v) => { if (v) startFps() }, { immediate: true })
```

ใน `reset()` เพิ่ม `startFps()` ท้ายฟังก์ชัน (รีเซ็ตตัวนับทุกไฟต์ใหม่)

ในเทมเพลต เพิ่มสรุปในกล่อง modal สรุปผล — วางก่อน `<div class="br-modal-btns">`:

```html
        <div v-if="showFps" class="br-fps-sum">
          เฟรมแย่สุด <b>{{ Math.round(fpsPeak) }}ms</b> ·
          หลุด 60fps <b>{{ fpsOver16 }}</b> เฟรม ·
          ต่ำกว่า 30fps <b :class="{ bad: fpsOver33 > 0 }">{{ fpsOver33 }}</b> เฟรม
        </div>
```

CSS ใน `<style scoped>`:

```css
.br-fps-sum { text-align: center; font-size: .72rem; color: rgba(255,255,255,.72); font-variant-numeric: tabular-nums;
  border-top: 1px solid rgba(255,255,255,.15); padding-top: 7px; margin-top: 2px; }
.br-fps-sum b { color: #fde68a; }
.br-fps-sum b.bad { color: #f87171; }
```

- [ ] **Step 2: เพิ่มพาเนลใน AdminView**

ใน `src/views/AdminView.vue` เพิ่ม import:

```js
import BattleReplay from '../components/battle/BattleReplay.vue'
import { simulateBattle } from '../utils/battleEngine.js'
import { FX_PRESETS, PACE_PRESETS, readPrefs, writePrefs } from '../utils/battleReplayPrefs.js'
```

เพิ่ม state + logic ใน `<script setup>`:

```js
// ── ห้องแล็บจังหวะไฟต์ (§11 ของสเปก battle-replay-pacing) ──
// ค่าที่เลือกเก็บใน localStorage ของเครื่องนี้เท่านั้น ไม่แตะ config/app → นักศึกษาที่กำลังเล่นอยู่ไม่โดนผลกระทบ
const fxPrefs = ref(readPrefs())
const FX_LABEL = { high: 'สวยสุด', mid: 'กลาง', low: 'เบา' }
const PACE_LABEL = { grand: 'อลังการ', normal: 'กลาง', tight: 'กระชับ' }
const fxNames = Object.keys(FX_PRESETS)
const paceNames = Object.keys(PACE_PRESETS)
function pickFx(name) { fxPrefs.value = writePrefs({ ...fxPrefs.value, fx: name }) }
function pickPace(name) { fxPrefs.value = writePrefs({ ...fxPrefs.value, pace: name }) }

// ไฟต์ทดสอบ: เคสหนักสุดเท่าที่ทำได้ — เพ็ททั้ง 8 ตัวเป็น melee ล้วน (ไม่มี atkStyle:"ranged" ซึ่งไม่แตะการ์ดเลย)
// ธาตุคละกันโดยตั้งใจ → เกิดแพ้ทางบ่อย → หมัดชั้น heavy เยอะ → จอสั่น+เป้าบีบตัวถี่สุด
// seed 695 คัดมาจากการไล่ 3000 seed ด้วย engine จริง แล้วเลือกตัวที่หนักสุด: 40 หมัด · คริ 7 · แพ้ทาง 22
// ไม่เขียน Firestore ไม่ให้รางวัล ยิงซ้ำได้ไม่จำกัด และเป็นไฟต์เดิมเป๊ะทุกครั้ง จึงเทียบ preset กันได้
const TEST_SEED = 695
const TEST_TEAM_A = [
  { id: 'kirin', rarity: 'legendary', element: 'fist', grade: 5 },
  { id: 'trex', rarity: 'legendary', element: 'fist', grade: 5 },
  { id: 'ouroboros', rarity: 'legendary', element: 'scissors', grade: 5 },
  { id: 'mammoth', rarity: 'legendary', element: 'paper', grade: 5 },
]
const TEST_TEAM_B = [
  { id: 'simurgh', rarity: 'legendary', element: 'scissors', grade: 5 },
  { id: 'qilin', rarity: 'legendary', element: 'paper', grade: 5 },
  { id: 'cerberus', rarity: 'epic', element: 'fist', grade: 5 },
  { id: 'panda', rarity: 'epic', element: 'paper', grade: 5 },
]
const fxReplay = ref(null)
function runTestFight() {
  const result = simulateBattle(TEST_TEAM_A, TEST_TEAM_B, TEST_SEED)
  fxReplay.value = {
    playerTeam: TEST_TEAM_A, botTeam: TEST_TEAM_B, result,
    won: result.winner === 'A',
    vsLabel: 'ไฟต์ทดสอบ',
    winText: 'ชนะ (ไฟต์ทดสอบ ไม่มีรางวัล)',
    loseText: 'แพ้ (ไฟต์ทดสอบ ไม่มีรางวัล)',
    rewardText: '—',
    fpsMeter: true,
  }
}
```

เพิ่ม section ในเทมเพลต (วางต่อจาก section สุดท้าย ก่อนปิด container) — ตามแพทเทิร์น `admin-card` ที่มีอยู่:

```html
      <!-- ───── ห้องแล็บจังหวะไฟต์ ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🎬" /> ห้องแล็บจังหวะไฟต์</span></div>
        <div class="admin-hint">
          ค่าที่เลือก <b>เก็บบนเครื่องนี้เครื่องเดียว</b> ไม่กระทบนักศึกษาคนอื่น ·
          ไฟต์ทดสอบเป็นเคสหนักสุด (4v4 ประชิดล้วน) และเป็นไฟต์เดิมทุกครั้ง จึงเทียบกันได้จริง ·
          ไม่มีรางวัล ไม่บันทึกอะไร ยิงซ้ำได้ไม่จำกัด
        </div>

        <div class="admin-hint"><b>ภาพ</b> — ไล่ลงมาถ้าเจอกระตุก</div>
        <div class="fxlab-row">
          <button v-for="n in fxNames" :key="n" class="btn-mini"
                  :class="{ on: fxPrefs.fx === n }" @click="pickFx(n)">{{ FX_LABEL[n] }}</button>
        </div>

        <div class="admin-hint"><b>จังหวะ</b> — ไม่เกี่ยวกับความลื่น เลือกตามความรู้สึกล้วนๆ</div>
        <div class="fxlab-row">
          <button v-for="n in paceNames" :key="n" class="btn-mini"
                  :class="{ on: fxPrefs.pace === n }" @click="pickPace(n)">{{ PACE_LABEL[n] }}</button>
        </div>

        <button class="btn-mini" @click="runTestFight">▶ ยิงไฟต์ทดสอบ</button>
      </section>
```

เพิ่มการ render replay — วางท้ายเทมเพลตคู่กับ modal อื่นๆ ของ AdminView:

```html
    <BattleReplay :data="fxReplay" theme="arena" @close="fxReplay = null" />
```

CSS:

```css
.fxlab-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.fxlab-row .btn-mini.on { background: var(--ink); color: #fff; }
```

- [ ] **Step 3: ตรวจว่าเพ็ททั้ง 8 ตัวมีจริงและเป็น melee ทุกตัว**

pool เพ็ทอยู่ใน `src/data/index.js` (ค่าคงที่ `PETS` รูปแบบ `{ id:"bahamut", …, atkStyle:"ranged" }`) — เพ็ทที่**ไม่มี** `atkStyle:"ranged"` คือ melee

```
for id in kirin trex ouroboros mammoth simurgh qilin cerberus panda; do
  line=$(grep -o "{ id:\"$id\".*}" src/data/index.js | head -1)
  if [ -z "$line" ]; then echo "ขาด: $id"
  elif echo "$line" | grep -q 'atkStyle:"ranged"'; then echo "เป็น ranged: $id"
  fi
done
```
Expected: ไม่พิมพ์อะไรออกมา · ถ้ามีตัวไหนขาดหรือเป็น ranged ให้เลือกใหม่จากรายการ melee ด้วย
`grep -n 'id:"' src/data/index.js | grep -v 'atkStyle:"ranged"'` โดยคงเงื่อนไข **ธาตุคละกัน** ไว้ (จะได้เกิดแพ้ทางบ่อย = ชั้น heavy เยอะ = เคสหนักสุดจริง)

- [ ] **Step 4: Build + ทดลอง**

```
npm run build
npm run dev
```
Expected: เข้าหน้า Admin → เห็นการ์ด "ห้องแล็บจังหวะไฟต์" → กดปุ่มเลือก preset แล้วปุ่มติดสถานะ → กด "ยิงไฟต์ทดสอบ" แล้ว replay เปิดขึ้นมาเล่นจนจบ → หน้าสรุปโชว์บรรทัด "เฟรมแย่สุด … หลุด 60fps … ต่ำกว่า 30fps …" → ปิดแล้วเปลี่ยน preset ยิงใหม่ได้ ค่าที่เลือกยังอยู่หลังรีเฟรชหน้า

- [ ] **Step 5: Commit**

```bash
git add src/views/AdminView.vue src/components/battle/BattleReplay.vue
git commit -m "Admin: ห้องแล็บจังหวะไฟต์ — เลือก preset ภาพ×จังหวะ + ยิงไฟต์ทดสอบ seed คงที่ + สรุปเฟรม"
```

---

## Task 8: reduced-motion + ตรวจรวมก่อนส่ง

**Files:**
- Modify: `src/utils/battleFx.js` (เฉพาะจุดที่ยังไม่ได้เคารพ reduced)
- Modify: `src/components/battle/BattleReplay.vue` (หลอดผีภายใต้ reduced-motion)

**Interfaces:**
- Consumes: `REDUCED_FLAGS` (เชื่อมไว้แล้วใน Task 3 ผ่าน `F()`)
- Produces: ไม่มี API ใหม่

- [ ] **Step 1: ตัดการเคลื่อนไหวที่ยังหลุดอยู่ภายใต้ reduced-motion**

`F()` จาก Task 3 ครอบ `cardLunge`/`targetSquash`/`screenShake`/`burst`/`ko` ไว้แล้ว เหลือ `jab` กับหลอดผีที่ยังเคลื่อนที่อยู่

ใน `src/utils/battleFx.js` แก้ `jab` ให้ไม่เดินทางเมื่อ reduced (ให้เป็นแค่ประกายที่เป้า):

```js
  function jab(fromUid, toUid, ms = 110) {
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = pool.jab[jabIdx = (jabIdx + 1) % pool.jab.length]
    el.getAnimations?.().forEach(x => x.cancel())
    el.style.opacity = '1'
    // reduced-motion: ไม่วิ่งข้ามจอ แค่กะพริบที่เป้า (ยังบอกได้ว่าหมัดลงตรงไหน)
    const sx = reduced() ? b.x : a.x, sy = reduced() ? b.y : a.y
    const mx = b.x - (b.x - a.x) * 0.3, my = b.y - (b.y - a.y) * 0.3   // หยุดที่ 70% ของทาง
    const ex = reduced() ? b.x : mx, ey = reduced() ? b.y : my
    return run(el, [
      { transform: `translate(${sx}px, ${sy}px) scale(.3) translateZ(0)`, opacity: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.85) translateZ(0)`, opacity: 1, offset: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.6) translateZ(0)`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }
```

ใน `BattleReplay.vue` บล็อก `<style scoped>` เพิ่มท้ายสุด:

```css
/* reduced-motion: คงจังหวะ 4 ชั้น ขนาดเลข และ hitstop ไว้ครบ — ตัดเฉพาะของที่เคลื่อนไหว
   หลอดผีเปลี่ยนจาก "ไล่ตามหลัง" เป็น "จางหาย" ยังบอกปริมาณดาเมจได้เหมือนเดิม */
@media (prefers-reduced-motion: reduce) {
  .br-hp-ghost { transition: opacity .4s ease-out .1s; }
  .br-intro-txt.ready, .br-intro-txt.go { animation: none; }
  .br-modal { animation: none; }
  .br-hold-hint { animation: none; }
}
```

- [ ] **Step 2: ตรวจ reduced-motion จริง**

```
npm run dev
```
เปิด DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce` → ยิงไฟต์ทดสอบจาก Admin

Expected:
- จอไม่สั่นเลยแม้แต่หมัดน็อก · การ์ดไม่พุ่ง ไม่บีบตัว ไม่หมุนกระเด็น · ไม่มีดาวคอมิก
- **แต่**: หมัดถากยังผ่านเร็ว หมัดคริยังมีช่วงเงื้อนานกับเลขตัวใหญ่ หมัดสุดท้ายยังช้าและมีจังหวะนิ่ง — คนที่แพ้อาการเมาภาพต้องยังอ่านออกว่าหมัดไหนสำคัญ

- [ ] **Step 3: ตรวจรวมทั้งชุด**

```
node --test src/utils/battleBeats.test.js
node --test src/utils/battleReplayPrefs.test.js
node --test src/utils/battleSummary.test.js
node --test src/utils/battleStats.test.js
node --test src/data/battle.test.js
node --test src/utils/battleEngine.test.js
npm run build
```
Expected: เทสทั้งหมด PASS (เทสเดิม 4 ไฟล์ต้องไม่แดง — เราไม่ได้แตะไฟล์ที่มันเทส) · build สำเร็จ

- [ ] **Step 4: ไล่เช็คด้วยตาใน dev ครบทุกเส้นทาง**

ยิงไฟต์ทดสอบจาก Admin แล้วตรวจทีละข้อ:

1. **หอคอย** — เข้าหอคอยสู้จริง 1 ชั้น: replay เล่นจบ เปิดหน้าสรุป ชั้นขยับถูกต้อง
2. **สนามประลอง (Arena)** — สู้ 1 ครั้ง: replay ใช้ธีม arena ทำงานเหมือนกัน
3. กดค้างเร่งตอนกำลังเงื้อชั้น heavy → **หมัดนั้นต้องยังเล่นเต็ม**
4. พัก → แตะการ์ดเปิด inspect → ปิด → กดเล่นต่อ: ไม่มี state ค้าง ไม่รันซ้อน
5. เล่นไฟต์ใหม่ทันทีหลังไฟต์เก่าจบ (ยิงทดสอบซ้ำ 3 ครั้งติด): ไม่มี FX ค้าง ไม่มีวงแหวนอันตรายค้าง การ์ดไม่ค้าง transform
6. หมุนจอระหว่างไฟต์: ตำแหน่ง FX ยังตรงการ์ด (centers ถูก invalidate)
7. กด Escape ตอนหน้าสรุปเปิด → ปิด modal ได้เหมือนเดิม

- [ ] **Step 5: Commit**

```bash
git add src/utils/battleFx.js src/components/battle/BattleReplay.vue
git commit -m "Battle: รองรับ prefers-reduced-motion — ตัดการเคลื่อนไหว คงจังหวะ 4 ชั้นไว้ครบ"
```

- [ ] **Step 6: ส่งมอบให้ user เทสจอจริง**

**ยังไม่ push** — รายงาน user ว่าพร้อมให้เทสแล้ว พร้อมข้อมูลนี้:
- เข้า Admin → "ห้องแล็บจังหวะไฟต์"
- ลำดับที่แนะนำ: ตั้งจังหวะไว้ที่ "กลาง" ก่อน แล้วไล่ **ภาพ** จาก สวยสุด → กลาง → เบา จดตัวเลข "ต่ำกว่า 30fps กี่เฟรม" ของแต่ละค่า เลือกค่าที่สวยที่สุดที่ยังได้ **0 เฟรม**
- จากนั้นล็อกภาพไว้ แล้วไล่ **จังหวะ** ทั้ง 3 ค่า เลือกตามความรู้สึก
- แจ้งผลกลับมา → จะเอาไปฮาร์ดโค้ดใน `DEFAULT_PREFS` ของ `src/utils/battleReplayPrefs.js` แล้วค่อย push deploy

---

## Self-Review

**1. Spec coverage**

| สเปก | Task |
|---|---|
| §3 `battleBeats.js` (โควตาแบ่งชั้น + score + timing + kill/danger/survive) | Task 1 |
| §4 การเคลื่อนไหวรายชั้น (chip ไม่แตะการ์ด · solid lunge · heavy +squash+shake · น็อกผูกกับ `beat.kill` ไม่ใช่ชั้น) | Task 3 (วาด) + Task 4 (สั่ง) |
| §5 หลอดผี · โซนอันตราย · ป้าย "รอด!" | Task 5 (หลอดผี+CSS) · Task 3 `dangerRing`/`callout('survive')` · Task 4 เรียกใช้ |
| §6.1 งบ promotion (chip 0 promotion) | Task 3 `lunge` คืน resolve ทันทีเมื่อ tier ไม่มีท่า + Task 4 ไม่เรียก lunge ตอน chip |
| §6.2 จอสั่นเฉพาะชั้น 3–4 + ตัดสินด้วยพาเนล | Task 3 `shake` เช็ค flag · Task 4 เรียกเฉพาะ heavy/finish · Task 7 พาเนล |
| §6.3 ห้าม animation วนบนการ์ด | Task 3 `dangerRing` อยู่บน FX pool |
| §6.4 ข้อบังคับ v3 (1 animation/หมัด, transform อย่างเดียว, zIndex นอก keyframes) | Task 3 `lunge` + Global Constraints |
| §7.1 ตัดปุ่มข้าม + ปุ่มเร็ว | Task 6 |
| §7.2 กดค้างเร่ง + ไม่แตะชั้น 3–4 | Task 1 `FF_SCALE` (กติกา) + Task 6 (UI) |
| §7.4 ค้างสนาม 900ms ก่อนเปิดสรุป | Task 4 Step 1 (`resultDelayMs: 900`) |
| §8 ช่องเว้น P3 passive (`tier: null` ไม่ throw) | Task 1 (มีเทสรับประกัน) |
| §9 `prefers-reduced-motion` | Task 8 |
| §10 เทส | Task 1, Task 2 (เทสอัตโนมัติ) · Task 8 Step 3–4 (เทสด้วยตา) |
| §11 พาเนล Admin 2 แกน + ไฟต์ทดสอบ + สรุปเฟรม | Task 2 (preset) + Task 7 (UI) |
| §13 ตารางไฟล์ | ครบทุกไฟล์ |

**ไม่มีข้อไหนของสเปกที่ไม่มี task รองรับ**

**2. Placeholder scan** — ไม่มี TBD/TODO · ทุกขั้นตอนที่เป็นโค้ดมีโค้ดจริง · ไม่มี "similar to Task N"

**3. Type consistency** — ตรวจแล้ว:
- `scaleTiming(beat, { pace, ff })` ใช้ชื่อเดียวกันใน Task 1 (นิยาม) และ Task 4 (เรียก) ✓
- `fx.lunge(el, fromUid, toUid, timing, tier)` ลำดับพารามิเตอร์ตรงกันระหว่าง Task 3 (นิยาม) และ Task 4 (เรียก) ✓
- `fx.pop(uid, { dmg, crit, eff, tier })` — Task 3 เพิ่ม `tier`, Task 4 ส่ง `tier` ✓
- `fx.shake(px, times, rot)` — Task 4 เรียก `shake(5, 2)` และ `shake(8, 3, true)` ตรงลายเซ็น ✓
- `fx.ko(uid, el)` — Task 3 นิยามรับ 2 ตัว, Task 4 เรียก `fx.ko(beat.target, tgtEl)` ✓
- `fxFlags(name)` คืน object 5 คีย์ตรงกับที่ `F()` ใน Task 3 อ่าน ✓
- `readPrefs()/writePrefs()` คืน `{ fx, pace }` ตรงกันทั้ง Task 2, 4, 7 ✓
- **`cardLunge` ถูกลบใน Task 3 และผู้เรียกเดียว (`playMotion`) ถูกลบใน Task 4** — Task 3 Step 5 จึงระบุไว้ว่า `grep` อาจยังเจอใน `BattleReplay.vue` ระหว่างช่วงคาบเกี่ยว ✓
