// เทส pvpCoins — pure: พลังทีม + เหรียญตามส่วนต่างพลัง
// รัน: node --test src/utils/pvpCoins.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  teamPower, coinForResult,
  PVP_COIN_BASE, PVP_COIN_MIN, PVP_COIN_MAX, PVP_CONSOLE_MULT,
} from './pvpCoins.js'

const mk = (rarity, grade) => ['fist', 'scissors', 'paper']
  .map((e, i) => ({ id: 'p' + i, rarity, element: e, grade }))

test('teamPower: ทีมว่าง/null = 0', () => {
  assert.equal(teamPower([]), 0)
  assert.equal(teamPower(null), 0)
})

test('teamPower: เกรดสูงกว่า = พลังมากกว่า · ความหายากสูงกว่า = พลังมากกว่า', () => {
  assert.ok(teamPower(mk('rare', 4)) > teamPower(mk('rare', 1)))
  assert.ok(teamPower(mk('legendary', 3)) > teamPower(mk('common', 3)))
})

test('coinForResult: ชนะคู่ที่พลังเท่ากัน = PVP_COIN_BASE', () => {
  assert.equal(coinForResult(5000, 5000, true), PVP_COIN_BASE)
})

test('coinForResult: ชนะคนแกร่งกว่าได้มากกว่าชนะคนอ่อนกว่า', () => {
  const strong = coinForResult(5000, 9000, true)
  const weak   = coinForResult(5000, 2000, true)
  assert.ok(strong > PVP_COIN_BASE)
  assert.ok(weak < PVP_COIN_BASE)
})

test('coinForResult: ตัวคูณถูก clamp ทั้งสองด้าน', () => {
  // อ่อนกว่ามหาศาล → พื้น · แกร่งกว่ามหาศาล → เพดาน
  assert.equal(coinForResult(999999, 1, true), Math.round(PVP_COIN_BASE * PVP_COIN_MIN / 10) * 10)
  assert.equal(coinForResult(1, 999999, true), Math.round(PVP_COIN_BASE * PVP_COIN_MAX / 10) * 10)
})

test('coinForResult: แพ้ให้คนแกร่งกว่า ได้ปลอบใจ = 25% ของค่าชนะ', () => {
  const win = coinForResult(5000, 9000, true)
  assert.equal(coinForResult(5000, 9000, false), Math.round(win * PVP_CONSOLE_MULT / 10) * 10)
})

test('coinForResult: แพ้ให้คนอ่อนกว่าหรือพอกัน = 0 (ไม่ปลอบใจการล้มเหลวที่ไม่ได้กล้า)', () => {
  assert.equal(coinForResult(5000, 2000, false), 0)
  assert.equal(coinForResult(5000, 5000, false), 0)
})

test('coinForResult: myPower = 0 ไม่หารศูนย์ ไม่คืน NaN', () => {
  const c = coinForResult(0, 5000, true)
  assert.ok(Number.isFinite(c) && c > 0)
})

test('coinForResult: เหรียญลงท้ายด้วย 0 เสมอ (ปัดสิบ)', () => {
  for (const opp of [1000, 3333, 7777, 12000]) {
    assert.equal(coinForResult(5000, opp, true) % 10, 0)
  }
})
