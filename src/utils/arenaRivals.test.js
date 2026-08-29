import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arenaRanking, AROUND_RADIUS, TOP_COUNT } from './arenaRivals.js'

/** ผู้เล่นที่เคยลงสนาม (ไฟต์ > 0) */
const u = (uid, rating, wins = 1, losses = 0) => ({ uid, nickname: uid, rating, wins, losses })
/** เพื่อน n คน แต้มไล่ลง 2000, 1990, … (ทุกคนเคยลงสนาม) */
const many = (n) => Array.from({ length: n }, (_, i) => u('p' + i, 2000 - i * 10))

test('all — เรียงแต้มมากไปน้อย rank ต่อเนื่อง 1..n และ isMe ถูกตัว', () => {
  const r = arenaRanking([u('a', 900), u('c', 1300)], u('me', 1100))
  assert.deepEqual(r.all.map(x => x.uid), ['c', 'me', 'a'])
  assert.deepEqual(r.all.map(x => x.rank), [1, 2, 3])
  assert.deepEqual(r.all.map(x => x.isMe), [false, true, false])
  assert.equal(r.total, 3)
  assert.equal(r.myRank, 2)
})

test('all — ตัดคนที่ยังไม่เคยลงสนามทิ้ง (ชนะ+แพ้ = 0)', () => {
  // นี่คือหัวใจของกระดานนี้: ทุกคนใน roster มีเรตเริ่มต้น 1000 เท่ากันหมด
  const r = arenaRanking([u('never', 1000, 0, 0), u('b', 1200)], u('me', 1100))
  assert.deepEqual(r.all.map(x => x.uid), ['b', 'me'])
  assert.equal(r.total, 2)
})

test('เราที่ยังไม่เคยลงสนาม = ไม่ขึ้นกระดาน myRank เป็น null', () => {
  const r = arenaRanking([u('b', 1200)], u('me', 1000, 0, 0))
  assert.deepEqual(r.all.map(x => x.uid), ['b'])
  assert.equal(r.myRank, null)
  assert.deepEqual(r.around, [])
  assert.equal(r.chaseName, null)
})

test('ค่าสดของเราทับแถวซ้ำที่มาจาก roster', () => {
  // แถวใน roster ของเราอาจเก่ากว่าค่าใน memory หนึ่งไฟต์
  const r = arenaRanking([u('me', 1000, 1, 0), u('a', 1100)], u('me', 1400, 9, 2))
  assert.equal(r.total, 2)
  assert.equal(r.myRank, 1)
  assert.equal(r.all[0].rating, 1400)
  assert.equal(r.all[0].wins, 9)
  assert.equal(r.all[0].losses, 2)
})

test('แต้มเท่ากัน — ตัดสินด้วยชื่อเล่น ลำดับจึงคงที่ไม่ขึ้นกับลำดับที่ Object.entries คายมา', () => {
  const tie = (uid, nickname) => ({ uid, nickname, rating: 1100, wins: 1, losses: 0 })
  assert.deepEqual(arenaRanking([tie('x', 'bee'), tie('y', 'ant')], u('me', 900)).all.map(v => v.uid),
    ['y', 'x', 'me'])
  // สลับลำดับ input แล้วต้องได้ผลเดิมเป๊ะ — นี่คือคุณสมบัติที่ต้องการจริง
  // (ค่า collation ของภาษาไทยขึ้นกับ ICU ของ runtime จึงไม่เอามาผูกเป็นเทส)
  assert.deepEqual(arenaRanking([tie('y', 'ant'), tie('x', 'bee')], u('me', 900)).all.map(v => v.uid),
    ['y', 'x', 'me'])
})

test('top — ตัดที่ TOP_COUNT', () => {
  const r = arenaRanking(many(30), u('me', 100))
  assert.equal(r.top.length, TOP_COUNT)
  assert.equal(r.top[0].rank, 1)
  assert.equal(r.top.at(-1).rank, TOP_COUNT)
})

test('around — หน้าต่าง ±AROUND_RADIUS รอบตัวเรา', () => {
  const r = arenaRanking(many(30), u('me', 1855))   // แทรกกลางกระดาน
  assert.equal(r.around.length, AROUND_RADIUS * 2 + 1)
  assert.equal(r.around.some(x => x.isMe), true)
  assert.deepEqual(r.around.map(x => x.rank),
    [r.myRank - 2, r.myRank - 1, r.myRank, r.myRank + 1, r.myRank + 2])
})

test('around — อยู่อันดับ 1 ไม่แพดแถวปลอมข้างบน', () => {
  const r = arenaRanking(many(10), u('me', 9999))
  assert.equal(r.myRank, 1)
  assert.equal(r.around.length, AROUND_RADIUS + 1, 'ได้แค่ตัวเอง + ข้างล่าง 2')
  assert.equal(r.around[0].isMe, true)
})

test('chaseName/chaseGap — คนอันดับเหนือเราและระยะห่างเป็นแต้ม', () => {
  const r = arenaRanking([u('a', 1300), u('b', 1000)], u('me', 1150))
  assert.equal(r.chaseName, 'a')
  assert.equal(r.chaseGap, 150)
})

test('อันดับ 1 ไม่มีใครให้ไล่', () => {
  const r = arenaRanking([u('a', 900)], u('me', 1200))
  assert.equal(r.chaseName, null)
  assert.equal(r.chaseGap, 0)
})

test('ไม่มีใครในรุ่นเคยลงสนามเลย — total 0 (การ์ดจะซ่อนทั้งใบ)', () => {
  const r = arenaRanking([u('a', 1000, 0, 0)], u('me', 1000, 0, 0))
  assert.equal(r.total, 0)
  assert.equal(r.myRank, null)
  assert.deepEqual(r.top, [])
})

test('ทนของเสีย — others เป็น null / แถวไม่มี uid / ตัวเลขหาย', () => {
  const r = arenaRanking(null, u('me', 1100))
  assert.equal(r.total, 1)
  const r2 = arenaRanking([{ nickname: 'ไร้ uid', rating: 5000, wins: 3, losses: 0 },
                           { uid: 'z', nickname: 'z' }], u('me', 1100))
  assert.deepEqual(r2.all.map(x => x.uid), ['me'], 'แถวไม่มี uid ตกไป · แถวไม่มี wins/losses = ไฟต์ 0')
})
