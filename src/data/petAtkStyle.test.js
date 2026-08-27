import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PETS, atkStyleOf, projectileOf, passiveOf, sparkOf } from './index.js'

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

// ── ประกายประจำตัวตอนตีโดน (คืนเอกลักษณ์รายตัวที่หายไปตอนเลิกใช้ ranged) ──

test('sparkOf: เพ็ทที่เคยเป็น ranged มีประกายประจำตัว', () => {
  const bahamut = PETS.find(p => p.id === 'bahamut')
  const whale = PETS.find(p => p.id === 'whale')
  assert.equal(sparkOf(bahamut), '🔥')
  assert.equal(sparkOf(whale), '💧')
})

test('sparkOf: เพ็ทที่ไม่มีประกาย คืน null (ให้ผู้เรียกตกกลับไป 💥 กลาง)', () => {
  assert.equal(sparkOf(PETS.find(p => p.id === 'wolf')), null)
  assert.equal(sparkOf(null), null)
  assert.equal(sparkOf({}), null)
})

test('sparkOf: ประกายทุกตัวในแค็ตตาล็อกต้องมีไฟล์ asset (ไม่งั้นดาวหายกลางไฟต์)', async () => {
  const { fluentFile } = await import('../utils/emoji.js')
  const sparks = [...new Set(PETS.map(sparkOf).filter(Boolean))]
  assert.ok(sparks.length >= 5, `มีประกาย ${sparks.length} แบบ`)
  sparks.forEach(c => assert.ok(fluentFile(c), `${c} ไม่มี fluentFile`))
})
