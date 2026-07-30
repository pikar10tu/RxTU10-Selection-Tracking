import test from 'node:test'
import assert from 'node:assert/strict'
import { getCategories, normalizeCategories, MAX_CATEGORIES } from './questionCategories.js'

test('getCategories — ข้อใหม่ที่มี categories array', () => {
  assert.deepEqual(getCategories({ categories: ['เบาหวาน', 'ไต'] }), ['เบาหวาน', 'ไต'])
})

test('getCategories — ข้อเก่าที่มีแค่ category เดี่ยว → ห่อเป็น array', () => {
  assert.deepEqual(getCategories({ category: 'ยาปฏิชีวนะ' }), ['ยาปฏิชีวนะ'])
})

test('getCategories — categories ชนะ category เมื่อมีทั้งคู่', () => {
  assert.deepEqual(getCategories({ categories: ['ใหม่'], category: 'เก่า' }), ['ใหม่'])
})

test('getCategories — ไม่มีหมวด / ค่าว่าง / undefined → []', () => {
  assert.deepEqual(getCategories({}), [])
  assert.deepEqual(getCategories({ category: '' }), [])
  assert.deepEqual(getCategories({ categories: [] }), [])
  assert.deepEqual(getCategories(undefined), [])
})

test('getCategories — ตัดช่องว่างหัวท้ายและค่าซ้ำ', () => {
  assert.deepEqual(getCategories({ categories: ['  ไต  ', 'ไต', '', 'ตับ'] }), ['ไต', 'ตับ'])
})

test('normalizeCategories — clean + ตัดว่าง + unique', () => {
  assert.deepEqual(normalizeCategories(['ไต', '  ', 'ไต', 'ตับ']), ['ไต', 'ตับ'])
})

test(`normalizeCategories — เกิน ${MAX_CATEGORIES} ตัด`, () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  assert.equal(normalizeCategories(many).length, MAX_CATEGORIES)
  assert.deepEqual(normalizeCategories(many), ['a', 'b', 'c', 'd', 'e'])
})

test('normalizeCategories — ไม่ใช่ array → []', () => {
  assert.deepEqual(normalizeCategories(undefined), [])
  assert.deepEqual(normalizeCategories('ไต'), [])
})
