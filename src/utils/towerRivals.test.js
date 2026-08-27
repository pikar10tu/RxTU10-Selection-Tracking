import { test } from 'node:test'
import assert from 'node:assert/strict'
import { towerRanking, AROUND_RADIUS } from './towerRivals.js'

const u = (uid, floor) => ({ uid, nickname: uid, towerBest: floor })
/** เพื่อน n คน ชั้นไล่ลง 100, 99, … */
const many = (n) => Array.from({ length: n }, (_, i) => u('p' + i, 100 - i))

test('all — เรียงชั้นมากไปน้อย และ rank ต่อเนื่อง 1..n', () => {
  const r = towerRanking([u('a', 5), u('c', 20)], u('me', 12))
  assert.deepEqual(r.all.map(x => x.uid), ['c', 'me', 'a'])
  assert.deepEqual(r.all.map(x => x.rank), [1, 2, 3])
  assert.deepEqual(r.all.map(x => x.isMe), [false, true, false])
  assert.equal(r.total, 3)
  assert.equal(r.myRank, 2)
})

test('all — ตัดคนที่ยังไม่เคยชนะสักชั้นทิ้ง', () => {
  const r = towerRanking([u('a', 0), u('b', 3)], u('me', 5))
  assert.deepEqual(r.all.map(x => x.uid), ['me', 'b'])
})

test('all — ค่าสดของเราทับแถวซ้ำที่มาจาก roster', () => {
  const r = towerRanking([u('me', 1), u('a', 4)], u('me', 40))
  assert.equal(r.total, 2)
  assert.equal(r.all[0].uid, 'me')
  assert.equal(r.all[0].floor, 40)
})

test('around — ±2 รอบตัวเรา รวมตัวเราเป็น 5 แถว', () => {
  const r = towerRanking(many(20), u('me', 89))     // เราแทรกเป็นอันดับ 12
  assert.equal(r.myRank, 12)
  assert.deepEqual(r.around.map(x => x.rank), [10, 11, 12, 13, 14])
  assert.equal(r.around.find(x => x.isMe).rank, 12)
  assert.equal(AROUND_RADIUS, 2)
})

test('around — เราอยู่อันดับ 1 ไม่แพดแถวปลอมข้างบน', () => {
  const r = towerRanking(many(10), u('me', 999))
  assert.equal(r.myRank, 1)
  assert.deepEqual(r.around.map(x => x.rank), [1, 2, 3])
})

test('around — เราอยู่ท้ายสุด ไม่แพดแถวปลอมข้างล่าง', () => {
  const r = towerRanking(many(10), u('me', 1))
  assert.equal(r.myRank, 11)
  assert.deepEqual(r.around.map(x => x.rank), [9, 10, 11])
})

test('around — ยังไม่ติดอันดับ (ไม่เคยชนะสักชั้น) = ว่าง และ myRank เป็น null', () => {
  const r = towerRanking(many(6), u('me', 0))
  assert.equal(r.myRank, null)
  assert.deepEqual(r.around, [])
  assert.equal(r.total, 6)
})

test('around — กระดานเล็กกว่าหน้าต่าง คืนทุกคนไม่ซ้ำ', () => {
  const r = towerRanking([u('a', 9)], u('me', 4))
  assert.deepEqual(r.around.map(x => x.rank), [1, 2])
})

test('top — ยังคืน 3 อันดับแรกเหมือนเดิม (การ์ดเดิมยังใช้ได้)', () => {
  const r = towerRanking(many(10), u('me', 50))
  assert.equal(r.top.length, 3)
  assert.deepEqual(r.top.map(x => x.floor), [100, 99, 98])
  assert.equal(typeof r.top[0].nickname, 'string')
})

test('chase — ตามหลังคนอันดับเหนือเราพอดี', () => {
  const r = towerRanking([u('a', 50), u('b', 42)], u('me', 40))
  assert.equal(r.chaseName, 'b')
  assert.equal(r.chaseGap, 2)
})

test('chase — เราอันดับ 1 ไม่มีใครให้ไล่', () => {
  const r = towerRanking([u('a', 5)], u('me', 40))
  assert.equal(r.chaseName, null)
  assert.equal(r.chaseGap, 0)
})

test('คนเดียวในกระดาน', () => {
  const r = towerRanking([], u('me', 7))
  assert.equal(r.total, 1)
  assert.equal(r.myRank, 1)
  assert.deepEqual(r.around.map(x => x.rank), [1])
})

test('ไม่มีใครเลย (กระดานว่าง)', () => {
  const r = towerRanking([], u('me', 0))
  assert.equal(r.total, 0)
  assert.equal(r.myRank, null)
  assert.deepEqual(r.all, [])
  assert.deepEqual(r.around, [])
  assert.deepEqual(r.top, [])
})

test('ทน others เป็น null / แถวเสีย', () => {
  const r = towerRanking(null, u('me', 3))
  assert.equal(r.total, 1)
  const r2 = towerRanking([null, { uid: '', towerBest: 9 }, u('a', 2)], u('me', 3))
  assert.deepEqual(r2.all.map(x => x.uid), ['me', 'a'])
})
