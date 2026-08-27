import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toSlots, firstEmpty, nextEmpty, placeAt } from './teamSlots.js'

const M = 3

test('toSlots — ยาวเท่า maxSlots เสมอ ช่องว่างเป็น null', () => {
  assert.deepEqual(toSlots([], M), [null, null, null])
  assert.deepEqual(toSlots(['a'], M), ['a', null, null])
  assert.deepEqual(toSlots(['a', 'b', 'c'], M), ['a', 'b', 'c'])
  assert.deepEqual(toSlots(['a', 'b', 'c', 'd'], M), ['a', 'b', 'c'])   // เกิน = ตัดทิ้ง
  assert.deepEqual(toSlots(null, M), [null, null, null])
  assert.deepEqual(toSlots(['a', null, 'b'], M), ['a', null, 'b'])      // ช่องว่างกลางคงไว้
})

test('firstEmpty — ช่องว่างช่องแรก, เต็ม = -1', () => {
  assert.equal(firstEmpty([null, null, null]), 0)
  assert.equal(firstEmpty(['a', null, null]), 1)
  assert.equal(firstEmpty(['a', null, 'c']), 1)
  assert.equal(firstEmpty(['a', 'b', 'c']), -1)
})

test('nextEmpty — เดินหน้าก่อน แล้ววนกลับต้น, ไม่มีเลย = อยู่ที่เดิม', () => {
  assert.equal(nextEmpty(['a', null, null], 0), 1)
  assert.equal(nextEmpty(['a', 'b', null], 0), 2)
  assert.equal(nextEmpty([null, 'b', 'c'], 2), 0)        // วนกลับต้น
  assert.equal(nextEmpty(['a', 'b', 'c'], 1), 1)         // เต็ม = อยู่กับที่
})

test('placeAt — ใส่ลงช่องว่าง แล้ว cursor เลื่อนไปช่องว่างถัดไป', () => {
  const r = placeAt([null, null, null], 0, 'a', M)
  assert.deepEqual(r.slots, ['a', null, null])
  assert.equal(r.cursor, 1)
})

test('placeAt — ใส่ทับช่องที่มีตัว ตัวเดิมหลุดออก ไม่ไปโผล่ช่องอื่น', () => {
  const r = placeAt(['a', 'b', 'c'], 1, 'x', M)
  assert.deepEqual(r.slots, ['a', 'x', 'c'])
  assert.equal(r.slots.includes('b'), false)
})

test('placeAt — ทีมเต็มก็ยังสลับได้ (ไม่มีสถานะกดไม่ได้)', () => {
  const r = placeAt(['a', 'b', 'c'], 2, 'x', M)
  assert.deepEqual(r.slots, ['a', 'b', 'x'])
  assert.equal(r.cursor, 2)          // ไม่มีช่องว่าง = cursor อยู่กับที่
})

test('placeAt — ใส่ตัวที่อยู่ช่องอื่นอยู่แล้ว = สลับที่กัน 2 ช่อง ไม่ทำสำเนา', () => {
  const r = placeAt(['a', 'b', 'c'], 0, 'c', M)
  assert.deepEqual(r.slots, ['c', 'b', 'a'])
  assert.equal(r.slots.filter(x => x === 'c').length, 1)
})

test('placeAt — ย้ายตัวจากช่องอื่นมาช่องว่าง ช่องเดิมกลายเป็นว่าง', () => {
  const r = placeAt(['a', 'b', null], 2, 'a', M)
  assert.deepEqual(r.slots, [null, 'b', 'a'])
})

test('placeAt — ใส่ตัวที่อยู่ช่อง cursor เองอยู่แล้ว = ไม่เปลี่ยนอะไร (idempotent)', () => {
  const before = ['a', 'b', 'c']
  const r = placeAt(before, 1, 'b', M)
  assert.deepEqual(r.slots, ['a', 'b', 'c'])
  assert.equal(r.cursor, 1)
})

test('placeAt — ไม่แก้ array เดิม (คืนของใหม่เสมอ)', () => {
  const before = ['a', null, null]
  const r = placeAt(before, 1, 'b', M)
  assert.deepEqual(before, ['a', null, null])
  assert.notEqual(r.slots, before)
})

test('placeAt — cursor นอกช่วง ถูกหนีบให้อยู่ในช่วง', () => {
  assert.deepEqual(placeAt([null, null, null], 9, 'a', M).slots, [null, null, 'a'])
  assert.deepEqual(placeAt([null, null, null], -3, 'a', M).slots, ['a', null, null])
})

test('placeAt — id ว่าง = ถอดตัวในช่องนั้นออก', () => {
  const r = placeAt(['a', 'b', 'c'], 1, null, M)
  assert.deepEqual(r.slots, ['a', null, 'c'])
})

test('placeAt — ผลลัพธ์ยาวเท่า maxSlots เสมอแม้ input สั้น/ยาวผิด', () => {
  assert.equal(placeAt(['a'], 0, 'x', M).slots.length, M)
  assert.equal(placeAt(['a', 'b', 'c', 'd', 'e'], 0, 'x', M).slots.length, M)
})
