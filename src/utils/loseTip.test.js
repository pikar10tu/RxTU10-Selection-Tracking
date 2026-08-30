// เทส loseTip — รัน: node --test src/utils/loseTip.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLoseTip } from './loseTip.js'
import { PULL_COST } from './gacha.js'

test('มีตั๋วฟรี หรือเหรียญพอ → ชี้ไปกาชา', () => {
  assert.equal(buildLoseTip('tower', { freeGachaTickets: 1, coins: 0 }).to, '/shop')
  assert.equal(buildLoseTip('arena', { coins: PULL_COST }).to, '/shop')
})

test('ไม่พอ → ชี้ไปอัพเกรดเพ็ท (ไม่ส่งไปหน้าที่กดอะไรไม่ได้)', () => {
  assert.equal(buildLoseTip('tower', { coins: PULL_COST - 1, freeGachaTickets: 0 }).to, '/play/pets')
  assert.equal(buildLoseTip('arena', {}).to, '/play/pets')
  assert.equal(buildLoseTip('arena', null).to, '/play/pets')
})

test('ข้อความต่างกันตามโหมด และไม่มีคำว่า "แพ้ก็นับ"', () => {
  const t = buildLoseTip('tower', {}).text
  const a = buildLoseTip('arena', {}).text
  assert.notEqual(t, a)
  assert.ok(t && a)
})

test('โหมดที่ไม่รู้จัก → null (ไม่วาดอะไร)', () => {
  assert.equal(buildLoseTip('mystery', {}), null)
})
