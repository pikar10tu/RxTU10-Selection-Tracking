import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PETS, atkStyleOf, projectileOf, passiveOf } from './index.js'

// user สั่ง 27 ส.ค.: ทุกตัวเป็น melee ให้หมด อยากเห็นท่าง้างหมัดทุกไฟต์
// (ranged เดิมคือ legendary ครบทั้ง 3 + epic 4 + owl ⇒ ทีมยิ่งแกร่งยิ่งไม่เห็นท่าง้างเลย)
test('atkStyleOf: ทุกตัวในแค็ตตาล็อกเป็น melee — ไม่มีข้อยกเว้น', () => {
  const notMelee = PETS.filter(p => atkStyleOf(p) !== 'melee')
  assert.deepEqual(notMelee.map(p => p.id), [], 'ยังมีตัวที่ไม่ใช่ melee')
})

test('atkStyleOf: แม้ data ยังมี atkStyle:"ranged" ค้างอยู่ ก็ต้องคืน melee', () => {
  // ฟิลด์ยังอยู่ในแค็ตตาล็อกโดยตั้งใจ — เก็บไว้ให้ย้อนกลับ/เอาไปใช้เป็นเอกลักษณ์ตอนตีโดนได้
  assert.equal(atkStyleOf({ id: 'x', atkStyle: 'ranged', projectile: '🔥' }), 'melee')
})

test('projectileOf: emoji ประจำตัวยังอ่านได้ครบ (ไม่ได้ลบข้อมูลทิ้ง)', () => {
  const withProj = PETS.filter(p => p.projectile)
  assert.ok(withProj.length >= 8, `เหลือ ${withProj.length} ตัวที่มี projectile`)
  withProj.forEach(p => assert.equal(projectileOf(p), p.projectile, `${p.id} projectile`))
})

test('passive default null', () => {
  assert.equal(passiveOf(PETS.find(p => p.id === 'wolf')), null)
})
