import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeUpCost, canUpgrade, upgradeBlock, MAX_GRADE } from './petGrade.js'

test('gradeUpCost ใช้ 1 copy ทุกขั้น, เหรียญ scale ตามเกรดเป้า', () => {
  assert.deepEqual(gradeUpCost({ grade: 0, rarity: 'common' }), { copies: 1, coins: 200 })   // 200*1
  assert.deepEqual(gradeUpCost({ grade: 1, rarity: 'common' }), { copies: 1, coins: 400 })   // 200*2
  assert.deepEqual(gradeUpCost({ grade: 4, rarity: 'legendary' }), { copies: 1, coins: 20000 }) // 4000*5
})

test('gradeUpCost = null เมื่อ maxed', () => {
  assert.equal(gradeUpCost({ grade: MAX_GRADE, rarity: 'epic' }), null)
})

test('canUpgrade ต้องมี 1 copy + เหรียญพอ', () => {
  assert.equal(canUpgrade({ grade: 0, rarity: 'common', copies: 1 }, 200), true)
  assert.equal(canUpgrade({ grade: 0, rarity: 'common', copies: 0 }, 200), false) // copy ไม่พอ
  assert.equal(canUpgrade({ grade: 0, rarity: 'common', copies: 1 }, 199), false) // เหรียญไม่พอ
})

// ── เหตุผลที่อัพไม่ได้ — ปุ่มเทาเฉยๆ ไม่บอกอะไร (เพื่อนแจ้ง 31 ส.ค. "มีตัวซ้ำ 11 แต่อัพไม่ได้") ──

test('upgradeBlock = null เมื่ออัพได้จริง', () => {
  assert.equal(upgradeBlock({ grade: 0, rarity: 'common', copies: 1 }, 200), null)
})

test('upgradeBlock บอกว่าขาดเหรียญอีกเท่าไหร่ (เคสของเพื่อน: ตัวซ้ำเหลือเฟือแต่เหรียญไม่พอ)', () => {
  assert.deepEqual(upgradeBlock({ grade: 3, rarity: 'legendary', copies: 11 }, 1250),
    { reason: 'short', copiesShort: 0, coinsShort: 14750 })   // 4000*4 = 16000
})

test('upgradeBlock บอกว่าขาดตัวซ้ำอีกกี่ตัว', () => {
  assert.deepEqual(upgradeBlock({ grade: 0, rarity: 'common', copies: 0 }, 999999),
    { reason: 'short', copiesShort: 1, coinsShort: 0 })
})

test('upgradeBlock ขาดทั้งคู่ = รายงานทั้งคู่', () => {
  assert.deepEqual(upgradeBlock({ grade: 0, rarity: 'rare', copies: 0 }, 100),
    { reason: 'short', copiesShort: 1, coinsShort: 500 })
})

test('upgradeBlock บอก maxed แยกจากขาดของ', () => {
  assert.deepEqual(upgradeBlock({ grade: MAX_GRADE, rarity: 'epic', copies: 9 }, 0), { reason: 'maxed' })
})

test('upgradeBlock ตรงกับ canUpgrade เสมอ (null ⇔ อัพได้)', () => {
  for (const copies of [0, 1, 11]) {
    for (const coins of [0, 200, 999999]) {
      const pet = { grade: 0, rarity: 'common', copies }
      assert.equal(upgradeBlock(pet, coins) === null, canUpgrade(pet, coins), `copies=${copies} coins=${coins}`)
    }
  }
})
