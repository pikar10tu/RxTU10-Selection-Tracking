import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simulateBattle } from './battleEngine.js'
import { buildCombatant } from '../data/battle.js'

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
