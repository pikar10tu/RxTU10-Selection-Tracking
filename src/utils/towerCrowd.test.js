// เทส buildFloorCrowd — pure function แปลง roster rows → เพื่อนปักหมุดรายชั้น
// รัน: node --test src/utils/towerCrowd.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFloorCrowd, CROWD_SHOWN } from './towerCrowd.js'

const row = (n, tb, extra = {}) => ({ n, tb, p: null, s: '001', t: 'sci', g: null, ...extra })

test('จัดกลุ่มตาม towerBest — คนละชั้นอยู่คนละคีย์', () => {
  const m = buildFloorCrowd({ a: row('เอ', 5), b: row('บี', 9) }, 'me')
  assert.equal(m.size, 2)
  assert.equal(m.get(5).all.length, 1)
  assert.equal(m.get(9).all[0].name, 'บี')
})

test('กองกันเกิน CROWD_SHOWN → shown ตัดที่ 3, extra นับที่เหลือ', () => {
  const rows = {}
  for (let i = 0; i < 7; i++) rows['u' + i] = row('คน' + i, 12)
  const c = buildFloorCrowd(rows, 'me')
  assert.equal(CROWD_SHOWN, 3)
  assert.equal(c.get(12).shown.length, 3)
  assert.equal(c.get(12).extra, 4)
  assert.equal(c.get(12).all.length, 7)
})

test('กองกันพอดี 3 คน → extra เป็น 0 ไม่ติดลบ', () => {
  const rows = { a: row('เอ', 4), b: row('บี', 4), c: row('ซี', 4) }
  const c = buildFloorCrowd(rows, 'me')
  assert.equal(c.get(4).shown.length, 3)
  assert.equal(c.get(4).extra, 0)
})

test('ตัวเองไม่โผล่ในราง (มี marker แยกอยู่แล้ว)', () => {
  const m = buildFloorCrowd({ me: row('ฉัน', 20), a: row('เอ', 20) }, 'me')
  assert.equal(m.get(20).all.length, 1)
  assert.equal(m.get(20).all[0].uid, 'a')
})

test('guest ติดมาด้วย — รางนับทุกคนใน roster ไม่ใช่เฉพาะนักศึกษา', () => {
  const m = buildFloorCrowd({ g1: row('เกสต์', 7, { g: 'pending', s: null }) }, 'me')
  assert.equal(m.get(7).all.length, 1)
  assert.equal(m.get(7).all[0].name, 'เกสต์')
})

test('tb = 0 / ไม่มี tb / tb ติดลบ → ไม่ปักหมุด', () => {
  const m = buildFloorCrowd({ a: row('เอ', 0), b: { n: 'บี' }, c: row('ซี', -3) }, 'me')
  assert.equal(m.size, 0)
})

test('rows ว่าง / undefined / null → Map ว่าง ไม่ throw', () => {
  assert.equal(buildFloorCrowd({}, 'me').size, 0)
  assert.equal(buildFloorCrowd(undefined, 'me').size, 0)
  assert.equal(buildFloorCrowd(null, 'me').size, 0)
})

test('แถวที่เป็น null ใน rows ไม่ทำให้พัง', () => {
  const m = buildFloorCrowd({ a: null, b: row('บี', 3) }, 'me')
  assert.equal(m.size, 1)
})

test('ลำดับคงที่แม้สลับลำดับ key ขาเข้า (กันวงกระพริบสลับที่ตอน re-render)', () => {
  const a = buildFloorCrowd({ z: row('ซี', 6), a: row('เอ', 6), m: row('เอ็ม', 6) }, 'me')
  const b = buildFloorCrowd({ m: row('เอ็ม', 6), z: row('ซี', 6), a: row('เอ', 6) }, 'me')
  assert.deepEqual(a.get(6).all.map(f => f.uid), b.get(6).all.map(f => f.uid))
})

test('tb เป็นทศนิยม → ปัดลงเป็นชั้นจำนวนเต็ม', () => {
  const m = buildFloorCrowd({ a: row('เอ', 8.9) }, 'me')
  assert.equal(m.get(8).all.length, 1)
})

test('photo มาจาก row.p · ไม่มีก็เป็น null (ให้ view ไป fallback เป็น letterAvatar)', () => {
  const m = buildFloorCrowd({ a: row('เอ', 2, { p: 'https://x/y.jpg' }), b: row('บี', 2) }, 'me')
  const byUid = Object.fromEntries(m.get(2).all.map(f => [f.uid, f.photo]))
  assert.equal(byUid.a, 'https://x/y.jpg')
  assert.equal(byUid.b, null)
})

test('ไม่มีชื่อ → ใช้ "?" ไม่ใช่ undefined', () => {
  const m = buildFloorCrowd({ a: { tb: 3 } }, 'me')
  assert.equal(m.get(3).all[0].name, '?')
})
