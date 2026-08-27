// เทส pvpMatch — pure: คัดย่านเรตใกล้ + สุ่มด้วย seed
// รัน: node --test src/utils/pvpMatch.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickHumanOpponents, HUMAN_POOL, NEAR_WINDOW } from './pvpMatch.js'

// candidate รูปเดียวกับที่ rosterOpponents() คืนมา (กรอง+เติม rating มาแล้ว)
const mk = (uid, rating) => ({ uid, nickname: uid, rating, team: [{ id: 'cat' }] })

test('pickHumanOpponents: คืนไม่เกิน n', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  assert.equal(pickHumanOpponents(cands, 1000, 1).length, HUMAN_POOL)
})

test('pickHumanOpponents: candidate น้อยกว่า n → คืนเท่าที่มี', () => {
  assert.equal(pickHumanOpponents([mk('a', 1000), mk('b', 1010)], 1000, 1).length, 2)
})

test('pickHumanOpponents: พูลว่าง → คืน []', () => {
  assert.deepEqual(pickHumanOpponents([], 1000, 1), [])
  assert.deepEqual(pickHumanOpponents(null, 1000, 1), [])
})

test('pickHumanOpponents: seed เดียวกัน = ผลเดิม (นิ่งทั้งวัน)', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  const b = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  assert.deepEqual(a, b)
})

test('pickHumanOpponents: seed ต่าง = ชุด/ลำดับต่างได้ (ไม่ตายตัวแบบเดิม)', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 12345).map(o => o.uid).join()
  assert.notEqual(a, b)
})

test('pickHumanOpponents: เลือกเฉพาะย่านใกล้ (คนเรตไกลเกิน window ไม่ถูกเลือก)', () => {
  const near = Array.from({ length: NEAR_WINDOW }, (_, i) => mk('n' + i, 1000 + i))
  const out = pickHumanOpponents([...near, mk('far', 9000)], 1000, 5).map(o => o.uid)
  assert.ok(!out.includes('far'))
})

test('pickHumanOpponents: ไม่แก้ array ที่รับเข้ามา (ไม่ mutate ของ store)', () => {
  const cands = Array.from({ length: 8 }, (_, i) => mk('u' + i, 1000 + i))
  const before = cands.map(o => o.uid)
  pickHumanOpponents(cands, 1000, 3)
  assert.deepEqual(cands.map(o => o.uid), before)
})

test('pickHumanOpponents: ไม่คืนคนซ้ำ', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const out = pickHumanOpponents(cands, 1000, 77).map(o => o.uid)
  assert.equal(new Set(out).size, out.length)
})
