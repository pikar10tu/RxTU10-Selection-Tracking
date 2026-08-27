// เทส pvpMatch — pure: คัดย่านเรตใกล้ + สับไพ่ 2 รอบ
// รัน: node --test src/utils/pvpMatch.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickHumanOpponents, BOARD_SIZE, NEAR_WINDOW } from './pvpMatch.js'

// candidate รูปเดียวกับที่ rosterOpponents() คืนมา (กรอง+เติม rating มาแล้ว)
const mk = (uid, rating) => ({ uid, nickname: uid, rating, team: [{ id: 'cat' }] })

test('pickHumanOpponents: คืนไม่เกิน n', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  assert.equal(pickHumanOpponents(cands, 1000, 1).length, BOARD_SIZE)
})

test('pickHumanOpponents: candidate น้อยกว่า n → คืนเท่าที่มี', () => {
  assert.equal(pickHumanOpponents([mk('a', 1000), mk('b', 1010)], 1000, 1).length, 2)
})

test('pickHumanOpponents: พูลว่าง → คืน []', () => {
  assert.deepEqual(pickHumanOpponents([], 1000, 1), [])
  assert.deepEqual(pickHumanOpponents(null, 1000, 1), [])
})

test('pickHumanOpponents: seed เดียวกัน = ผลเดิม', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  const b = pickHumanOpponents(cands, 1000, 999).map(o => o.uid)
  assert.deepEqual(a, b)
})

test('pickHumanOpponents: seed ต่าง = ชุด/ลำดับต่างได้', () => {
  const cands = Array.from({ length: 20 }, (_, i) => mk('u' + i, 1000 + i))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 12345).map(o => o.uid).join()
  assert.notEqual(a, b)
})

test('pickHumanOpponents: เลือกเฉพาะย่านใกล้เมื่อเรตกระจายจริง', () => {
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

// ── เทสหลักของ task นี้ ──
test('pickHumanOpponents: ทั้งชั้นปีเรตเท่ากันหมด ต้องยังเจอคนได้กว้างกว่าขนาดหน้าต่าง', () => {
  // สถานการณ์จริงตอนเปิดตัว: ทุกคนยังไม่เคยเล่น PvP → เรต 1000 เท่ากันเป๊ะ
  const cands = Array.from({ length: 100 }, (_, i) => mk('u' + i, 1000))
  const seen = new Set()
  for (let seed = 1; seed <= 200; seed++) {
    pickHumanOpponents(cands, 1000, seed).forEach(o => seen.add(o.uid))
  }
  // ก่อนแก้: ติดอยู่ที่ NEAR_WINDOW คนแรกตามลำดับคีย์ตลอดกาล
  assert.ok(seen.size > NEAR_WINDOW * 3, `เจอแค่ ${seen.size} คน — ยังติดกับดัก tie-order`)
})

test('pickHumanOpponents: เรตเท่ากันหมด seed ต่างกันต้องได้คนละชุด', () => {
  const cands = Array.from({ length: 100 }, (_, i) => mk('u' + i, 1000))
  const a = pickHumanOpponents(cands, 1000, 1).map(o => o.uid).join()
  const b = pickHumanOpponents(cands, 1000, 2).map(o => o.uid).join()
  assert.notEqual(a, b)
})
