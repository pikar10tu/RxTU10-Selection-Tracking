// เทส seededRng — pure PRNG + string hash
// รัน: node --test src/utils/seededRng.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32, hashStr } from './seededRng.js'

test('mulberry32: seed เดียวกัน = ลำดับเดียวกัน (deterministic)', () => {
  const a = mulberry32(12345), b = mulberry32(12345)
  for (let i = 0; i < 5; i++) assert.equal(a(), b())
})

test('mulberry32: คืนค่าในช่วง [0,1)', () => {
  const r = mulberry32(1)
  for (let i = 0; i < 20; i++) { const v = r(); assert.ok(v >= 0 && v < 1) }
})

test('mulberry32: seed ต่างกัน = ค่าแรกต่างกัน', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)())
})

test('hashStr: input เดียวกัน = ค่าเดียวกัน + เป็น uint32', () => {
  assert.equal(hashStr('2026-08-27abc'), hashStr('2026-08-27abc'))
  assert.ok(Number.isInteger(hashStr('x')) && hashStr('x') >= 0)
})

test('hashStr: input ต่างกัน = ค่าต่างกัน', () => {
  assert.notEqual(hashStr('a'), hashStr('b'))
  assert.notEqual(hashStr('2026-08-27uidA'), hashStr('2026-08-27uidB'))
})
