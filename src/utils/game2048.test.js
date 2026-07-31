import test from 'node:test'
import assert from 'node:assert/strict'
import { SIZE, newBoard, move, spawn, isGameOver } from './game2048.js'

// helper: สร้างกระดานจาก 4 แถว (อ่านง่ายกว่า array 16 ช่อง)
const B = (...rows) => rows.flat()

test('เลื่อนซ้าย: ไทล์ชิดขอบ ไม่มีรวม', () => {
  const r = move(B([0,0,2,0],[0,4,0,0],[0,0,0,0],[0,0,0,8]), 'left')
  assert.deepEqual(r.board.slice(0,4), [2,0,0,0])
  assert.deepEqual(r.board.slice(4,8), [4,0,0,0])
  assert.deepEqual(r.board.slice(12,16), [8,0,0,0])
  assert.equal(r.gained, 0)
  assert.equal(r.moved, true)
})

test('รวมคู่เท่ากัน ได้คะแนนเท่าค่าใหม่', () => {
  const r = move(B([2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [4,0,0,0])
  assert.equal(r.gained, 4)
})

test('ห้ามรวมซ้ำในตาเดียว — [2,2,4,0] ต้องได้ [4,4,0,0] ไม่ใช่ [8,...]', () => {
  const r = move(B([2,2,4,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [4,4,0,0])
  assert.equal(r.gained, 4)
})

test('สี่ตัวเท่ากันรวมเป็นสองคู่', () => {
  const r = move(B([4,4,4,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [8,8,0,0])
  assert.equal(r.gained, 16)
})

test('เลื่อนขวา: รวมจากฝั่งขวาก่อน', () => {
  const r = move(B([2,2,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'right')
  assert.deepEqual(r.board.slice(0,4), [0,0,2,4])
  assert.equal(r.gained, 4)
})

test('เลื่อนขึ้น/ลง ทำงานตามคอลัมน์', () => {
  const up = move(B([0,0,0,0],[2,0,0,0],[2,0,0,0],[0,0,0,0]), 'up')
  assert.equal(up.board[0], 4)
  assert.equal(up.gained, 4)
  const down = move(B([2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]), 'down')
  assert.equal(down.board[12], 4)
})

test('ตาที่กระดานไม่เปลี่ยน → moved = false และไม่ได้คะแนน', () => {
  const r = move(B([2,4,8,16],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.equal(r.moved, false)
  assert.equal(r.gained, 0)
})

test('spawn ลงเฉพาะช่องว่าง และเป็น 2 หรือ 4', () => {
  const board = B([2,2,2,2],[2,2,2,2],[2,2,2,0],[2,2,2,2])   // ว่างช่องเดียว index 11
  const out = spawn(board, () => 0)
  assert.ok(out[11] === 2 || out[11] === 4)
  assert.equal(out.filter(v => v === 0).length, 0)
})

test('spawn: rng ต่ำ = 2 · rng สูง = 4 (4 ออก 10%)', () => {
  const board = new Array(16).fill(0)
  assert.equal(spawn(board, () => 0)[0], 2)
  assert.equal(spawn(board, () => 0.99)[15], 4)
})

test('newBoard เริ่มด้วยไทล์ 2 ตัว', () => {
  const b = newBoard(() => 0.5)
  assert.equal(b.length, SIZE * SIZE)
  assert.equal(b.filter(v => v !== 0).length, 2)
})

test('isGameOver: กระดานเต็มแต่ยังรวมได้ = ยังไม่จบ', () => {
  assert.equal(isGameOver(B([2,2,4,8],[4,8,16,32],[2,4,8,16],[4,8,16,32])), false)
})

test('isGameOver: กระดานเต็มและไม่มีคู่ติดกัน = จบ', () => {
  assert.equal(isGameOver(B([2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2])), true)
})

test('isGameOver: ยังมีช่องว่าง = ยังไม่จบ', () => {
  assert.equal(isGameOver(B([2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,0])), false)
})
