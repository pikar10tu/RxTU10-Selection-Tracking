import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TA_MODES, getTaMode, remainingMs, clockLabel, newBest, taBoard,
} from './timeAttack.js'

test('TA_MODES มี 4 และ 15 นาที พร้อมคีย์ที่ผูกกับ user doc / roster', () => {
  assert.deepEqual(TA_MODES.map(m => m.key), ['ta4', 'ta15'])
  assert.equal(TA_MODES[0].ms, 4 * 60_000)
  assert.equal(TA_MODES[1].ms, 15 * 60_000)
  assert.equal(TA_MODES[0].bestField, 'best4')
  assert.equal(TA_MODES[1].rowKey, 'ta15')
  assert.equal(getTaMode('ta4').minutes, 4)
  assert.equal(getTaMode('nope'), null)
})

test('remainingMs ไม่ติดลบ และ 0 เมื่อยังไม่เริ่ม', () => {
  assert.equal(remainingMs(1000, 400), 600)
  assert.equal(remainingMs(1000, 5000), 0)
  assert.equal(remainingMs(0, 5000), 0)
  assert.equal(remainingMs(null, 5000), 0)
})

test('clockLabel ปัดขึ้นวินาที และเติมศูนย์หน้า', () => {
  assert.equal(clockLabel(240_000), '4:00')
  assert.equal(clockLabel(65_000), '1:05')
  assert.equal(clockLabel(9_400), '0:10', 'ปัดขึ้น — เหลือ 9.4 วิยังไม่ควรโชว์ 0:09')
  assert.equal(clockLabel(0), '0:00')
})

test('newBest บอกว่าทำลายสถิติไหม', () => {
  assert.deepEqual(newBest(10, 14), { best: 14, isNew: true })
  assert.deepEqual(newBest(10, 10), { best: 10, isNew: false }, 'เท่าเดิมไม่นับว่าทำลาย')
  assert.deepEqual(newBest(10, 3), { best: 10, isNew: false })
  assert.deepEqual(newBest(undefined, 1), { best: 1, isNew: true })
  assert.deepEqual(newBest(0, 0), { best: 0, isNew: false }, 'ได้ 0 ข้อไม่ใช่สถิติใหม่')
})

const rows = {
  a: { n: 'เอ', p: 'photoA', ta4: 20 },
  b: { n: 'บี', p: null, ta4: 35, ta15: 90 },
  c: { n: 'ซี', p: null },
  g: { n: 'เกสต์', p: null, g: 'guest', ta4: 28 },
}

test('taBoard เรียงมาก→น้อย ตัดคนที่ยังไม่เคยเล่น และติดอันดับให้', () => {
  const { top } = taBoard(rows, null, 'ta4')
  assert.deepEqual(top.map(r => r.uid), ['b', 'g', 'a'])
  assert.deepEqual(top.map(r => r.rank), [1, 2, 3])
  assert.equal(top.find(r => r.uid === 'c'), undefined, 'best=0 ต้องไม่ขึ้นกระดาน')
})

test('taBoard รวม guest (อ่านจาก rosterRows ไม่ใช่ rosterUsers)', () => {
  assert.equal(taBoard(rows, null, 'ta4').top.some(r => r.uid === 'g'), true)
})

test('taBoard overlay ค่าสดของฉันทับแถว roster ที่ยังไม่ทัน sync', () => {
  const me = { uid: 'a', name: 'เอ', photo: 'photoA', best: 99 }
  const { top } = taBoard(rows, me, 'ta4')
  assert.equal(top[0].uid, 'a')
  assert.equal(top[0].best, 99)
  assert.equal(top[0].isMe, true)
  assert.equal(top.filter(r => r.uid === 'a').length, 1, 'ห้ามซ้ำสองแถว')
})

test('taBoard ไม่ลดค่าลงถ้า roster สูงกว่าค่าสดในเครื่อง', () => {
  const { top } = taBoard(rows, { uid: 'b', name: 'บี', best: 1 }, 'ta4')
  assert.equal(top[0].best, 35)
})

test('taBoard คนใหม่ที่ยังไม่มีแถวใน roster ก็ขึ้นกระดานได้', () => {
  const { top } = taBoard(rows, { uid: 'zz', name: 'ใหม่', best: 50 }, 'ta4')
  assert.equal(top[0].uid, 'zz')
})

test('taBoard ตัดที่ max และคืน mine แยกเมื่อเราหลุด top', () => {
  const many = {}
  for (let i = 0; i < 20; i++) many['u' + i] = { n: 'u' + i, ta4: 100 - i }
  many.me = { n: 'ฉัน', ta4: 1 }
  const { top, mine } = taBoard(many, { uid: 'me', name: 'ฉัน', best: 1 }, 'ta4')
  assert.equal(top.length, 10)
  assert.equal(mine.uid, 'me')
  assert.equal(mine.rank, 21)
})

test('taBoard ไม่คืน mine ซ้ำเมื่อเราติด top อยู่แล้ว', () => {
  assert.equal(taBoard(rows, { uid: 'b', name: 'บี', best: 35 }, 'ta4').mine, null)
})

test('taBoard รับ rows ว่าง/undefined ได้', () => {
  assert.deepEqual(taBoard(undefined, null, 'ta4'), { top: [], mine: null })
  assert.deepEqual(taBoard({}, null, 'ta15'), { top: [], mine: null })
})
