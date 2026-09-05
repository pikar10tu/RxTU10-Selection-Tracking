import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simulateBattle } from './battleEngine.js'
import { buildCombatant } from '../data/battle.js'
import { PET_PASSIVES } from '../data/petPassives.js'

const mono = (rarity, element, grade, n = 4) =>
  Array.from({ length: n }, (_, i) => ({ id: `${element}${i}`, rarity, element, grade }))

test('deterministic: seed เดิม → ผลเหมือนเป๊ะ', () => {
  const a = mono('rare', 'fist', 3), b = mono('rare', 'scissors', 3)
  const r1 = simulateBattle(a, b, 12345)
  const r2 = simulateBattle(a, b, 12345)
  assert.deepEqual(r1, r2)
})

test('log จบด้วย end event ที่ winner ตรงกับผล', () => {
  const r = simulateBattle(mono('rare', 'fist', 3), mono('rare', 'scissors', 3), 7)
  const end = r.log[r.log.length - 1]
  assert.equal(end.t, 'end')
  assert.equal(end.winner, r.winner)
  assert.ok(r.rounds >= 1)
})

test('ธาตุได้เปรียบชนะเกินครึ่ง (fist vs scissors, เกรดเท่ากัน)', () => {
  let wins = 0, N = 300
  for (let s = 1; s <= N; s++)
    if (simulateBattle(mono('rare', 'fist', 3), mono('rare', 'scissors', 3), s * 99991).winner === 'A') wins++
  assert.ok(wins / N > 0.6, `winrate ${wins / N}`)
})

test('เกรดสูงกว่าชนะเกินครึ่ง (ธาตุเดียวกัน)', () => {
  let wins = 0, N = 300
  for (let s = 1; s <= N; s++)
    if (simulateBattle(mono('rare', 'scissors', 5), mono('rare', 'scissors', 2), s * 1237).winner === 'A') wins++
  assert.ok(wins / N > 0.6, `winrate ${wins / N}`)
})

test('ทีมว่างฝั่งหนึ่ง → อีกฝั่งชนะ', () => {
  assert.equal(simulateBattle(mono('common', 'fist', 0), [], 1).winner, 'A')
  assert.equal(simulateBattle([], mono('common', 'fist', 0), 1).winner, 'B')
})

test('attack event มี eff ตรงกับ matchup ธาตุ', () => {
  // fist ชนะ scissors → ผู้ตีฝั่ง A (fist) ควรมี eff:'super', ฝั่ง B (scissors→fist) eff:'weak'
  const r = simulateBattle(mono('rare', 'fist', 3), mono('rare', 'scissors', 3), 7)
  const atkA = r.log.filter(e => e.t === 'attack' && e.side === 'A')
  const atkB = r.log.filter(e => e.t === 'attack' && e.side === 'B')
  assert.ok(atkA.length && atkA.every(e => e.eff === 'super'), 'A (fist) ตี scissors = super ทุกครั้ง')
  assert.ok(atkB.length && atkB.every(e => e.eff === 'weak'), 'B (scissors) ตี fist = weak ทุกครั้ง')
  assert.ok(['super', 'weak', 'neutral'].includes(atkA[0].eff))
})

test('log มี round marker ต้นแต่ละรอบ ตามจำนวน rounds', () => {
  const r = simulateBattle(mono('rare', 'fist', 3), mono('rare', 'scissors', 3), 7)
  const rounds = r.log.filter(e => e.t === 'round')
  assert.equal(rounds.length, r.rounds)
  assert.equal(rounds[0].n, 1)
})

test('ฝั่งตัวเยอะกว่าได้ตีก่อน', () => {
  const a = mono('rare', 'scissors', 3, 1)  // 1 ตัว
  const b = mono('rare', 'scissors', 3, 3)  // 3 ตัว
  const first = simulateBattle(a, b, 42).log.find(e => e.t === 'attack')
  assert.equal(first.side, 'B')
})

test('ฝั่งตีสลับกันเสมอ (ไม่ว่าเหลือกี่ตัว)', () => {
  const r = simulateBattle(mono('rare', 'fist', 3, 1), mono('rare', 'scissors', 3, 4), 99)
  const sides = r.log.filter(e => e.t === 'attack').map(e => e.side)
  assert.ok(sides.length > 2)
  for (let i = 1; i < sides.length; i++) assert.notEqual(sides[i], sides[i - 1], `ตำแหน่ง ${i} ไม่สลับ`)
})

test('ฝั่งเหลือ 1 ตัว ตัวนั้นได้ตีทุกตาของฝั่งตน', () => {
  const r = simulateBattle(mono('rare', 'fist', 3, 1), mono('rare', 'scissors', 3, 4), 99)
  const aAtks = r.log.filter(e => e.t === 'attack' && e.side === 'A')
  assert.ok(aAtks.length > 1)
  assert.ok(aAtks.every(e => e.attacker === 'A0'), 'ตัวเดียวของ A ต้องเป็น A0 เสมอ')
})

test('เลือกตัวออกตีจากซ้ายไปขวา (ก่อนมีตัวตาย)', () => {
  // paper mono = อึด (hp bias 1.2) → ตัวแรกตายช้า มีพื้นที่เช็คลำดับ
  const r = simulateBattle(mono('rare', 'paper', 3, 4), mono('rare', 'paper', 3, 4), 7)
  const seq = []
  for (const e of r.log) {
    if (e.t === 'attack' && e.dead) break
    if (e.t === 'attack' && e.side === 'A') seq.push(e.attacker)
  }
  assert.deepEqual(seq.slice(0, 4), ['A0', 'A1', 'A2', 'A3'])
})

// ── สเตตัสที่ UI เอาไปวาด (units / statsAfter) ────────────────
// เดิม BattleReplay คำนวณ ATK/HP จาก buildCombatant ล้วน ไม่ผ่าน aura
// แต่ log ส่ง targetHpAfter มาบนสเกลหลัง aura ⇒ ทีมที่มีคุณวาฬหลอดเลือดเริ่มเกิน 100%
const teamOf = (...ids) => ids.map(id => ({ id, rarity: 'legendary', element: 'fist', grade: 0 }))

test('result.units: มีครบทุก uid ของทั้งสองทีม พร้อม atk/maxHp', () => {
  const r = simulateBattle(teamOf('turtle', 'turtle'), teamOf('turtle'), 7)
  assert.deepEqual(Object.keys(r.units).sort(), ['A0', 'A1', 'B0'])
  for (const u of Object.values(r.units)) {
    assert.equal(typeof u.atk, 'number')
    assert.ok(u.maxHp > 0)
  }
})

test('result.units: ทีมมีคุณวาฬ → maxHp ทั้งทีม = ค่าดิบ x 1.10 (teamHp 10%)', () => {
  const withWhale = simulateBattle(teamOf('whale', 'turtle'), teamOf('turtle'), 7)
  const without   = simulateBattle(teamOf('turtle', 'turtle'), teamOf('turtle'), 7)
  // ⚠️ เทียบค่าตรงๆ อย่าเทียบเป็นอัตราส่วนของเลขที่ปัดแล้ว — ฐานจริง 59.5 ปัดเป็น 60
  //    ทำให้ 65/60 = 1.083 ทั้งที่คณิตข้างในถูก (59.5 x 1.1 = 65.45)
  const raw = buildCombatant({ rarity: 'legendary', element: 'fist', grade: 0 }).maxHp
  assert.equal(withWhale.units.A1.maxHp, Math.round(raw * 1.1))
  assert.equal(without.units.A1.maxHp, Math.round(raw))
  assert.equal(withWhale.units.B0.maxHp, without.units.B0.maxHp, 'aura ต้องไม่ข้ามไปทีมศัตรู')
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
  const weak = Array.from({ length: 3 }, () => ({ id: 'mouse', rarity: 'common', element: 'scissors', grade: 0 }))
  const r = simulateBattle(teamOf('trex'), weak, 3)
  const stacks = r.log.filter(e => e.t === 'passive' && e.effect === 'stackAtk')
  assert.ok(stacks.length >= 1, 'ควรมี stackAtk อย่างน้อย 1 ครั้ง')
  for (const s of stacks) assert.ok(s.statsAfter.A0.atk > 0)
  if (stacks.length >= 2) assert.ok(stacks[1].statsAfter.A0.atk > stacks[0].statsAfter.A0.atk)
})

// 🔴 แมวเป็นตัวเดียวที่ขยับ atk ผ่าน hook onDeath (สถานะ "ทนต่อ" +50% แล้วคืนตอนหมด)
//    ถ้า event ของมันไม่แบก statsAfter การ์ดในรีเพลย์จะค้างเลขเก่าทั้งที่ตัวจริงตีด้วยเลขใหม่ —
//    เทสนี้จึงยิงไฟต์จริงแล้วบังคับกฎเดียวกับที่ stealStats/aura/stackAtk/atkOnHit ถือกันอยู่
test('statsAfter: ทุก event ของแมวที่ขยับ atk ต้องแบกสเตตัสใหม่มาด้วย (ไฟต์จริง)', () => {
  // แมวเกรด 0 ธาตุเสียเปรียบ เจอหนูเกรด 4 → โดนหมัดถึงตาย 3 ครั้งก่อนตายจริงในยกที่ 5
  const r = simulateBattle([{ id: 'cat', rarity: 'common', element: 'fist', grade: 0 }],
                           [{ id: 'mouse', rarity: 'legendary', element: 'paper', grade: 4 }], 1)
  const evs = r.log.filter(e => e.t === 'passive' && (e.effect === 'cheatDeath' || e.effect === 'grit'))
  assert.deepEqual(evs.map(e => e.effect), ['cheatDeath', 'grit', 'grit'], 'ต้องรอดหมัดถึงตาย 3 ครั้งในไฟต์จริง')
  for (const e of evs) assert.ok(e.statsAfter, `${e.effect} ไม่มี statsAfter`)

  const base = r.units.A0.atk                    // ตัวเลขที่การ์ดตั้งต้น (หลังออร่า)
  const buffed = evs[0].statsAfter.A0.atk
  assert.ok(buffed > base, `ตอนได้สถานะ การ์ดต้องขึ้นเป็นเลขที่ใช้สู้จริง (${buffed} ควรมากกว่า ${base})`)
  assert.ok(Math.abs(buffed - base * 1.5) <= 1, `+50% ตามพาสสีฟ (ได้ ${buffed} จากฐาน ${base})`)
  assert.equal(evs[1].statsAfter.A0.atk, buffed, 'ระหว่างยังมีสถานะ เลขต้องค้างที่ค่าบัฟ')
  assert.equal(evs[2].statsAfter.A0.atk, base, 'ใบที่สถานะหมดพอดี ต้องคืนเลขเดิม ไม่ค้างบัฟ')
})

// ── ตายเงียบ (สเปก §7.6, 6 ก.ย. 2026) ─────────────────────────────────────
// หนาม/guardian/aoeOpener หักเลือดตรงๆ โดยไม่ผ่าน onDeath/onAnyDeath มาก่อน ⇒ ฟีนิกซ์ไม่ฟื้น
// แมวไม่ได้ cheatDeath ทีเร็กซ์ไม่ได้ชั้น · กติกาผู้ฆ่า: ใครสร้างดาเมจคือผู้ฆ่า ไม่ใช่คนที่ดาเมจไปตกใส่

test('หนาม: ฟีนิกซ์ที่ตายจากหนามกลางหมัดของตัวเองต้องฟื้น แล้วสวนใส่ "เจ้าของหนาม" (สเปก §7.6)', () => {
  // ยิงจริงผ่าน simulateBattle() (ไม่ใช่ log เขียนมือ) — ลำดับ event ที่กติกานี้อ่านมาจากเอนจินจริงเท่านั้น
  // 🔴 RED ที่พิสูจน์แล้วก่อนแก้ (ดูรายงาน): seed นี้ทำให้ A0 (ฟีนิกซ์) เลือดติดลบเงียบๆ ตอนบรรทัด
  //    `att.hp -= hitRes.thorns` กลางหมัดที่ 3 ของฟีนิกซ์เอง — ของเดิมจบไฟต์ตรงนั้นเลยไม่มี revive event
  //    เลยสักใบ ทั้งที่ฟีนิกซ์มี revive เหลือเต็ม (ยังไม่เคยตายมาก่อนในไฟต์นี้)
  const A = [{ id: 'phoenix', rarity: 'legendary', element: 'fist', grade: 5 }]
  const B = [{ id: 'hedgehog', rarity: 'legendary', element: 'scissors', grade: 5 }]
  const r = simulateBattle(A, B, 40)

  const revive = r.log.find(e => e.t === 'passive' && e.effect === 'revive' && e.uid === 'A0')
  assert.ok(revive, 'ฟีนิกซ์ต้องฟื้นแม้ตายจากหนาม ไม่ใช่ตายเงียบ')

  // เหตุ (attack ที่ทำให้ตาย) ต้องมาก่อนผล (revive) เสมอ — battleBeats.js อ่านลำดับนี้
  // หา 'attack' ก้อนสุดท้าย "ก่อน" revive (ไม่ใช่ทั้ง log เพราะหลัง revive มีหมัดสวนของฟีนิกซ์เองอีกก้อน
  // ที่ attacker เป็น A0 เหมือนกัน ต้องไม่หยิบผิดก้อน)
  const idxRevive = r.log.indexOf(revive)
  const lethalAttack = [...r.log.slice(0, idxRevive)].reverse().find(e => e.t === 'attack' && e.attacker === 'A0')
  assert.ok(lethalAttack, 'ต้องมีหมัดของฟีนิกซ์เองอยู่ก่อน revive (หมัดที่โดนหนามสวนตายกลางหมัด)')

  // หมัดสวนต้องลงที่ "เจ้าของหนาม" (B0/หนาม) ไม่ใช่คนอื่น — เช็คจากหมัดสวน (sub:true) ถัดจาก revive
  const counter = r.log.slice(idxRevive + 1).find(e => e.t === 'attack' && e.sub)
  assert.ok(counter, 'ต้องมีหมัดสวนหลัง revive')
  assert.equal(counter.attacker, 'A0')
  assert.equal(counter.target, 'B0', 'หมัดสวนต้องลงที่เจ้าของหนาม (ผู้สร้างดาเมจจริง) ไม่ใช่ใครอื่น')
})

test('guardian: ผู้พิทักษ์ที่ตายจากส่วนแบ่งที่รับแทนเพื่อนต้องกิน cheatDeath โดยผู้ฆ่าคือ "คนที่สวนหมัดมา" (สเปก §7.6)', () => {
  // เพ็ทสังเคราะห์: ผู้พิทักษ์ถือทั้ง guardian (onHit) และ cheatDeath (onDeath) พร้อมกัน — ของจริงในเกม
  // วันนี้ guardian มีแค่บากุ (ไม่มี onDeath) แต่กติกาที่ทดสอบอยู่เป็นกลไกเอนจินล้วน ไม่ขึ้นกับว่าใครถือ
  PET_PASSIVES.__catGuardian = {
    name: 'แมวผู้พิทักษ์ทดสอบ', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'guardian', value: { pct: 100 }, step: { pct: 0 } },
      { hook: 'onDeath', effect: 'cheatDeath', value: { times: 1, grit: 0, atkPct: 0 }, step: { times: 0, grit: 0, atkPct: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  // ล่อเป้าทดสอบ: บังคับให้ศัตรูตี A1 เสมอ (ไม่งั้นสุ่มเป้า ทำให้ผู้พิทักษ์ไม่ได้รับแทนทุกหมัด)
  PET_PASSIVES.__weakTaunt = {
    name: 'ล่อเป้าทดสอบ', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 0 }, step: { pct: 0 } }],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const A = [
      { id: '__catGuardian', rarity: 'common', element: 'fist', grade: 0 },
      { id: '__weakTaunt', rarity: 'common', element: 'scissors', grade: 0 },
    ]
    const B = [{ id: 'trex', rarity: 'legendary', element: 'fist', grade: 5 }]  // ทีเร็กซ์ = พยานเช็คว่าผู้ฆ่าคือฝั่งนี้จริง
    const r = simulateBattle(A, B, 1)

    const guardEvents = r.log.filter(e => e.t === 'passive' && e.effect === 'guardian' && e.uid === 'A0')
    const lethalGuard = guardEvents.find(e => e.guardHpPct <= 0)
    assert.ok(lethalGuard, 'ต้องมีก้อนที่ผู้พิทักษ์รับแทนจนเลือดหมด')

    const cheat = r.log.find(e => e.t === 'passive' && e.effect === 'cheatDeath' && e.uid === 'A0')
    assert.ok(cheat, 'ผู้พิทักษ์ต้องกิน cheatDeath ไม่ใช่ตายเงียบ')
    assert.ok(r.log.indexOf(cheat) > r.log.indexOf(lethalGuard), 'cheatDeath ต้องมาหลัง log ที่ทำให้ตาย (เหตุมาก่อนผล)')

    // cheatDeath ใช้ได้ครั้งเดียว — ก้อนรับแทนที่ทำให้ตายรอบถัดมาต้องตายจริง แล้ว "ฝั่งผู้โจมตี" (ทีเร็กซ์)
    // ต้องได้ประโยชน์ (stackAtk) ไม่ใช่ทีมของผู้พิทักษ์เอง — พิสูจน์ว่าผู้ฆ่าคือคนที่สวนหมัดมา ไม่ใช่ผู้พิทักษ์
    const stack = r.log.find(e => e.t === 'passive' && e.effect === 'stackAtk' && e.uid === 'B0')
    assert.ok(stack, 'ทีเร็กซ์ (ฝั่งผู้โจมตี) ต้องได้ชั้นตอนผู้พิทักษ์ตายจริงในรอบถัดมา — ยืนยันว่าผู้ฆ่าคือผู้โจมตี ไม่ใช่ผู้พิทักษ์เอง')
  } finally {
    delete PET_PASSIVES.__catGuardian
    delete PET_PASSIVES.__weakTaunt
  }
})

test('aoeOpener: บาฮามุทฆ่าศัตรูก่อนรอบ 1 ได้ · ทีเร็กซ์ (ทีมเดียวกัน) ต้องได้ชั้น stackAtk (สเปก §7.6)', () => {
  const A = [
    { id: 'bahamut', rarity: 'legendary', element: 'fist', grade: 5 },
    { id: 'trex', rarity: 'legendary', element: 'fist', grade: 5 },
  ]
  const B = [{ id: 'mouse', rarity: 'common', element: 'fist', grade: 0 }]
  const r = simulateBattle(A, B, 1)

  const opener = r.log.find(e => e.t === 'passive' && e.effect === 'aoeOpener')
  assert.ok(opener, 'ต้องมี aoeOpener event')
  assert.ok(opener.targets.includes('B0'), 'บาฮามุทต้องยิงโดน B0')

  const stack = r.log.find(e => e.t === 'passive' && e.effect === 'stackAtk' && e.uid === 'A1')
  assert.ok(stack, 'ทีเร็กซ์ต้องได้ชั้น stackAtk จากศัตรูที่ตายด้วย aoeOpener ก่อนรอบ 1')
  assert.ok(r.log.indexOf(stack) > r.log.indexOf(opener), 'ต้องยิงหลัง event ของ aoeOpener เอง (เหตุมาก่อนผล)')

  assert.equal(r.rounds, 0, 'B0 ตายหมดตั้งแต่ก่อนรอบ 1 — ไม่มีรอบไหนเกิดขึ้นจริง (สเปก: ล้มเพ็ทก่อนรอบ 1 ได้')
  assert.equal(r.winner, 'A')
})

test('killChain: ผู้ตีที่ตายจากหนามกลางหมัดของตัวเองต้องหยุดตี ไม่ตีต่อทั้งที่ตายไปแล้ว (สเปก §7.6 ข้อ 6)', () => {
  // เพ็ทสังเคราะห์หนาม 500% — บังคับให้ "ตีศัตรูตัวแรกสำเร็จ" กับ "หนามสวนกลับจนตัวเองตาย" เกิดในหมัดเดียวกัน
  // แบบไม่ต้องพึ่ง RNG พอดิบพอดี (thorns ธรรมดา 8% ของเกมจริงไม่พอฆ่ากีรินได้ภายในหมัดเดียว)
  PET_PASSIVES.__spikeTest = {
    name: 'หนามทดสอบ', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'thorns', value: { pct: 500 }, step: { pct: 0 } }],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const A = [{ id: 'kirin', rarity: 'legendary', element: 'fist', grade: 5 }]   // killChain สูงสุด 2 ครั้ง/รอบ
    const B = [
      { id: '__spikeTest', rarity: 'common', element: 'fist', grade: 0 },
      { id: '__spikeTest', rarity: 'common', element: 'fist', grade: 0 },        // ตัวที่ 2 = เป้าที่ไม่ควรถูกตีถ้าแก้ถูก
    ]
    const r = simulateBattle(A, B, 43)

    const atkA0 = r.log.filter(e => e.t === 'attack' && e.attacker === 'A0')
    assert.equal(atkA0.length, 1, 'กีรินตายจากหนามกลางหมัดแรก (ฆ่า B0 สำเร็จแต่โดนหนามสวนตายไปด้วย) ต้องไม่มีหมัดที่ 2 จาก killChain')
    assert.equal(atkA0[0].dead, true, 'หมัดแรกต้องฆ่า B0 สำเร็จจริง (เข้าเงื่อนไข killChain)')

    const chainEvents = r.log.filter(e => e.t === 'passive' && e.effect === 'killChain')
    assert.equal(chainEvents.length, 0, 'ต้องไม่มี killChain event เกิดขึ้นเลย เพราะกีรินตายไปแล้วก่อนถึงจังหวะตีต่อ')

    assert.equal(r.winner, 'B', 'กีรินตายจริง เหลือ B1 รอด ทีม B ต้องชนะ')
  } finally {
    delete PET_PASSIVES.__spikeTest
  }
})
