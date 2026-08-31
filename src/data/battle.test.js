import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCombatant, elementMult, BATTLE_CFG } from './battle.js'

test('BATTLE_CFG ตรงกับ sim ที่จูนแล้ว', () => {
  assert.equal(BATTLE_CFG.teamSize, undefined)   // จำนวนช่องทีมอยู่ที่ BATTLE_SLOTS ไม่ใช่ที่นี่
  assert.equal(BATTLE_CFG.maxRounds, 30)
  assert.equal(BATTLE_CFG.maxTurns, 300)
  assert.equal(BATTLE_CFG.elementAdv, 1.20)
  assert.equal(BATTLE_CFG.elementDis, 0.83)
})

test('buildCombatant: fist เกรด 0 legendary — bias atk↑ hp↓', () => {
  const c = buildCombatant({ id: 'trex', rarity: 'legendary', element: 'fist', grade: 0 })
  assert.equal(c.atk, 14 * 1.2)
  assert.equal(c.maxHp, 70 * 0.85)
  assert.equal(c.hp, c.maxHp)
  assert.equal(c.element, 'fist')
})

test('buildCombatant: clamp เกรดเกิน 5 → ใช้ index 5 (V=×2.0)', () => {
  const c = buildCombatant({ id: 'x', rarity: 'common', element: 'scissors', grade: 99 })
  assert.equal(Math.round(c.atk), Math.round(10 * 2.0))
  assert.equal(Math.round(c.maxHp), Math.round(50 * 2.0))
})

test('buildCombatant: เกรด V แรงกว่าเกรด 0 ราว 2 เท่า (เห็นผลอัพเกรด)', () => {
  const g0 = buildCombatant({ rarity: 'legendary', element: 'scissors', grade: 0 })
  const g5 = buildCombatant({ rarity: 'legendary', element: 'scissors', grade: 5 })
  assert.ok(g5.atk / g0.atk >= 1.9 && g5.atk / g0.atk <= 2.1)
})

test('elementMult: ได้เปรียบ/เสียเปรียบ/เสมอ', () => {
  assert.equal(elementMult('fist', 'scissors'), 1.20)
  assert.equal(elementMult('scissors', 'fist'), 0.83)
  assert.equal(elementMult('fist', 'fist'), 1)
})
