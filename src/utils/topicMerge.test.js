// เทส topicMerge — นับการใช้งานหมวด + วางแผนรวม/เปลี่ยนชื่อหมวดทั้งคลัง (pure)
import test from 'node:test'
import assert from 'node:assert/strict'
import { topicUsage, topicRows, mergeTopicsPlan } from './topicMerge.js'

const BANK = [
  { id: 'a', question: 'ข้อ A', categories: ['โรคระบบทางเดินอาหาร', 'เบาหวาน'] },
  { id: 'b', question: 'ข้อ B', categories: ['โรคทางเดินอาหาร'] },
  { id: 'c', question: 'ข้อ C', categories: ['โรคทางเดินอาหาร', 'โรคระบบทางเดินอาหาร'] },
  { id: 'd', question: 'ข้อ D', category: 'โรคทางเดินอาหาร' },   // ข้อเก่า: category เดี่ยว
  { id: 'e', question: 'ข้อ E', categories: [] },
]

// ── topicUsage ──
test('topicUsage — นับจำนวนข้อต่อหมวด รวมข้อเก่าที่มีแค่ category เดี่ยว', () => {
  const u = topicUsage(BANK)
  assert.equal(u.get('โรคทางเดินอาหาร'), 3)
  assert.equal(u.get('โรคระบบทางเดินอาหาร'), 2)
  assert.equal(u.get('เบาหวาน'), 1)
})

test('topicUsage — คลังว่าง / undefined → Map ว่าง', () => {
  assert.equal(topicUsage([]).size, 0)
  assert.equal(topicUsage(undefined).size, 0)
})

// ── topicRows ──
test('topicRows — รวมทะเบียนกลางกับหมวดที่อยู่บนข้อจริง', () => {
  const rows = topicRows(BANK, ['โรคระบบทางเดินอาหาร', 'ยาทาปฏิชีวนะ'])
  const byName = Object.fromEntries(rows.map(r => [r.name, r]))
  assert.equal(rows.length, 4)                                  // 3 หมวดบนข้อ + 1 หมวดร้างในทะเบียน
  assert.deepEqual(byName['ยาทาปฏิชีวนะ'], { name: 'ยาทาปฏิชีวนะ', count: 0, registered: true })
  assert.equal(byName['โรคทางเดินอาหาร'].registered, false)     // อยู่บนข้อแต่ตกทะเบียน
  assert.equal(byName['โรคทางเดินอาหาร'].count, 3)
})

test('topicRows — เรียงข้อเยอะมาก่อน แล้วค่อยเรียงชื่อ', () => {
  const rows = topicRows(BANK, [])
  assert.deepEqual(rows.map(r => r.count), [3, 2, 1])
  assert.equal(rows[0].name, 'โรคทางเดินอาหาร')
})

// ── mergeTopicsPlan ──
test('mergeTopicsPlan — เปลี่ยนชื่อหมวดในทุกข้อที่ติดหมวดต้นทาง', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.equal(p.target, 'โรคระบบทางเดินอาหาร')
  assert.equal(p.affected, 3)                                   // b, c, d
  assert.deepEqual(p.updates.find(u => u.id === 'b').categories, ['โรคระบบทางเดินอาหาร'])
})

test('mergeTopicsPlan — ข้อที่มีทั้งต้นทางและปลายทางอยู่แล้ว ต้องไม่เหลือหมวดซ้ำ', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.deepEqual(p.updates.find(u => u.id === 'c').categories, ['โรคระบบทางเดินอาหาร'])
})

test('mergeTopicsPlan — ข้อเก่าที่มีแค่ category เดี่ยว ได้ categories ที่ถูกต้องกลับไป', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.deepEqual(p.updates.find(u => u.id === 'd').categories, ['โรคระบบทางเดินอาหาร'])
})

test('mergeTopicsPlan — ข้อที่ไม่เกี่ยวไม่เข้า updates (ไม่เขียนซ้ำเปล่าๆ)', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.deepEqual(p.updates.map(u => u.id).sort(), ['b', 'c', 'd'])
})

test('mergeTopicsPlan — รวมหลายต้นทางพร้อมกัน', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร', 'เบาหวาน'], 'ระบบทางเดินอาหาร')
  assert.equal(p.affected, 4)                                   // a, b, c, d
  // a มี ['โรคระบบทางเดินอาหาร', 'เบาหวาน'] — ตัวแรกไม่ใช่ต้นทาง ต้องอยู่ยั้ง มีแค่ 'เบาหวาน' ที่ถูกย้าย
  assert.deepEqual(p.updates.find(u => u.id === 'a').categories, ['โรคระบบทางเดินอาหาร', 'ระบบทางเดินอาหาร'])
})

test('mergeTopicsPlan — คงลำดับหมวดเดิมของข้อไว้', () => {
  const bank = [{ id: 'x', question: 'X', categories: ['ไต', 'ตับ', 'หัวใจ'] }]
  const p = mergeTopicsPlan(bank, ['ตับ'], 'ตับและทางเดินน้ำดี')
  assert.deepEqual(p.updates[0].categories, ['ไต', 'ตับและทางเดินน้ำดี', 'หัวใจ'])
})

test('mergeTopicsPlan — ปลายทางอยู่ในต้นทางเอง → ตัดออก ไม่นับเป็นการรวมตัวเอง', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร', 'โรคระบบทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.deepEqual(p.sources, ['โรคทางเดินอาหาร'])
  assert.equal(p.affected, 3)
})

test('mergeTopicsPlan — ปลายทางว่าง / ต้นทางว่าง → แผนเปล่า', () => {
  assert.equal(mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], '   ').affected, 0)
  assert.equal(mergeTopicsPlan(BANK, [], 'อะไรก็ได้').affected, 0)
  assert.equal(mergeTopicsPlan(BANK, ['ไม่มีหมวดนี้'], 'ปลายทาง').affected, 0)
})

test('mergeTopicsPlan — sample = ตัวอย่างข้อที่จะโดนแก้ 3 ข้อแรก', () => {
  const p = mergeTopicsPlan(BANK, ['โรคทางเดินอาหาร'], 'โรคระบบทางเดินอาหาร')
  assert.equal(p.sample.length, 3)
  assert.deepEqual(p.sample[0], { id: 'b', question: 'ข้อ B' })
})

test('mergeTopicsPlan — ไม่แก้ไขอ็อบเจกต์ต้นทาง (pure)', () => {
  const bank = [{ id: 'x', question: 'X', categories: ['ตับ'] }]
  mergeTopicsPlan(bank, ['ตับ'], 'ตับใหม่')
  assert.deepEqual(bank[0].categories, ['ตับ'])
})
