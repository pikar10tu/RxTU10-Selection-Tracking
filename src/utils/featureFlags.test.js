import test from 'node:test'
import assert from 'node:assert/strict'
import { isFeatureOpen, FEATURE_KEYS } from './featureFlags.js'

test('config หาย/ยังไม่โหลด → ทุก key ปิด (safe default)', () => {
  for (const k of FEATURE_KEYS) {
    assert.equal(isFeatureOpen(null, k), false, `${k} ต้องปิดเมื่อ config เป็น null`)
    assert.equal(isFeatureOpen(undefined, k), false)
    assert.equal(isFeatureOpen({}, k), false, `${k} ต้องปิดเมื่อไม่มีฟิลด์`)
  }
})

test('เปิดเฉพาะ key ที่ตั้งไว้ ไม่ลามไปตัวอื่น', () => {
  const cfg = { arcadeOpen: true }
  assert.equal(isFeatureOpen(cfg, 'arcadeOpen'), true)
  assert.equal(isFeatureOpen(cfg, 'expeditionOpen'), false)
  assert.equal(isFeatureOpen(cfg, 'pvpOpen'), false)
})

test('ต้องเป็น boolean true เท่านั้น — ค่าที่พิมพ์ผิดใน console ห้ามเปิดฟีเจอร์', () => {
  for (const bad of ['true', 'yes', 1, 'TRUE', [], {}, 'false', 0, null]) {
    assert.equal(isFeatureOpen({ arcadeOpen: bad }, 'arcadeOpen'), false,
      `ค่า ${JSON.stringify(bad)} ต้องนับเป็นปิด`)
  }
  assert.equal(isFeatureOpen({ arcadeOpen: true }, 'arcadeOpen'), true)
})

test('แอดมินเห็นเสมอแม้ flag ปิด (ไว้เทสก่อนเปิดจริง)', () => {
  assert.equal(isFeatureOpen(null, 'arcadeOpen', { isAdmin: true }), true)
  assert.equal(isFeatureOpen({ arcadeOpen: false }, 'arcadeOpen', { isAdmin: true }), true)
  assert.equal(isFeatureOpen({ arcadeOpen: false }, 'arcadeOpen', { isAdmin: false }), false)
})

test('key ที่ไม่รู้จัก → ปิดเสมอ แม้ config จะตั้งค่าไว้', () => {
  assert.equal(isFeatureOpen({ somethingElse: true }, 'somethingElse'), false)
  assert.equal(isFeatureOpen({ somethingElse: true }, 'somethingElse', { isAdmin: true }), false,
    'แอดมินก็ไม่ควรเปิด key ที่ไม่มีอยู่จริง — กันพิมพ์ชื่อ flag ผิดแล้วเงียบ')
})

test('FEATURE_KEYS ครบและไม่ซ้ำ', () => {
  assert.deepEqual([...FEATURE_KEYS].sort(), ['arcadeOpen', 'expeditionOpen', 'pvpOpen'])
  assert.equal(new Set(FEATURE_KEYS).size, FEATURE_KEYS.length)
})
