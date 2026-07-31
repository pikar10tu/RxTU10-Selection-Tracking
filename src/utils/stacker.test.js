import test from 'node:test'
import assert from 'node:assert/strict'
import { COLS, newStack, stepBlock, dropBlock } from './stacker.js'

test('เริ่มเกม: มีฐาน 1 แถว บล็อกกว้างเท่าฐาน', () => {
  const s = newStack(6)
  assert.equal(s.rows.length, 1)
  assert.equal(s.rows[0].w, 6)
  assert.equal(s.w, 6)
})

test('stepBlock เลื่อนตามทิศและเวลา', () => {
  const s = { ...newStack(6), x: 0, dir: 1, speed: 2 }
  assert.equal(stepBlock(s, 0.5).x, 1)         // 2 คอลัมน์/วินาที × 0.5 วิ
})

test('stepBlock เด้งกลับที่ขอบซ้ายและขอบขวา', () => {
  const right = stepBlock({ ...newStack(6), x: COLS - 6, dir: 1, speed: 5 }, 1)
  assert.equal(right.dir, -1)
  assert.ok(right.x <= COLS - 6)
  const left = stepBlock({ ...newStack(6), x: 0, dir: -1, speed: 5 }, 1)
  assert.equal(left.dir, 1)
  assert.ok(left.x >= 0)
})

test('วางตรงเป๊ะ: ความกว้างไม่ลด และได้แถวเพิ่ม', () => {
  const s = { ...newStack(6), x: 3 }
  s.rows = [{ x: 3, w: 6 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, false)
  assert.equal(r.state.rows.length, 2)
  assert.equal(r.state.rows[1].w, 6)
  assert.equal(r.state.w, 6)
})

test('วางเยื้อง 2 คอลัมน์: ความกว้างลด 2 และเริ่มที่ขอบทับ', () => {
  const s = { ...newStack(6), x: 5 }
  s.rows = [{ x: 3, w: 6 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, false)
  assert.equal(r.state.rows[1].w, 4)
  assert.equal(r.state.rows[1].x, 5)
  assert.equal(r.state.w, 4)
})

test('วางไม่ทับเลย = จบเกม และไม่เพิ่มแถว', () => {
  const s = { ...newStack(4), x: 8 }
  s.rows = [{ x: 0, w: 4 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, true)
  assert.equal(r.state.rows.length, 1)
})

test('ยิ่งสูงยิ่งเร็ว', () => {
  const s = { ...newStack(6), x: 3 }
  s.rows = [{ x: 3, w: 6 }]
  assert.ok(dropBlock(s).state.speed > s.speed)
})
