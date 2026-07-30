// เทส questionsFilter — pure logic ค้นหา/กรองคลังข้อสอบ (ใช้ใน QuestionsView admin)
// รัน: node --test src/utils/questionsFilter.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterQuestions, distinctCategories, normForSearch } from './questionsFilter.js'

const Q = [
  { id: '1', question: 'ยาใดเป็น first-line ของ CAP', category: 'ยาปฏิชีวนะ', isPublished: true },
  { id: '2', question: 'Paracetamol ออกฤทธิ์ที่ใด', category: 'เภสัชวิทยา', isPublished: false },
  { id: '3', question: 'ค่า half-life คือ', category: 'เภสัชจลนศาสตร์', isPublished: true },
  { id: '4', question: 'ยาปฏิชีวนะกลุ่มใด', category: '', isPublished: false },
]

test('status: all คืนทุกข้อ', () => {
  assert.equal(filterQuestions(Q, { status: 'all' }).length, 4)
})

test('status: published / draft กรองตามการเผยแพร่', () => {
  assert.deepEqual(filterQuestions(Q, { status: 'published' }).map(q => q.id), ['1', '3'])
  assert.deepEqual(filterQuestions(Q, { status: 'draft' }).map(q => q.id), ['2', '4'])
})

test('category: กรองตามหมวดตรงตัว', () => {
  assert.deepEqual(filterQuestions(Q, { category: 'ยาปฏิชีวนะ' }).map(q => q.id), ['1'])
})

test('search: substring บน question (ไม่สนตัวพิมพ์เล็กใหญ่)', () => {
  assert.deepEqual(filterQuestions(Q, { search: 'PARACETAMOL' }).map(q => q.id), ['2'])
})

test('search: ค้นจาก category ได้ด้วย', () => {
  assert.deepEqual(filterQuestions(Q, { search: 'จลนศาสตร์' }).map(q => q.id), ['3'])
})

test('search: normalize ช่องว่างซ้อน (ยุบหลายเว้นวรรคเป็นหนึ่ง)', () => {
  // โจทย์ข้อ 2 = "Paracetamol ออกฤทธิ์ที่ใด" → ค้นด้วยช่องว่างซ้อนต้องยังเจอ
  assert.deepEqual(filterQuestions(Q, { search: 'paracetamol   ออกฤทธิ์' }).map(q => q.id), ['2'])
})

test('รวมหลายเงื่อนไข (status + category + search)', () => {
  const r = filterQuestions(Q, { status: 'published', category: 'ยาปฏิชีวนะ', search: 'CAP' })
  assert.deepEqual(r.map(q => q.id), ['1'])
})

test('ไม่ส่ง option → คืนทุกข้อ (default all/__all/ว่าง)', () => {
  assert.equal(filterQuestions(Q).length, 4)
})

test('distinctCategories: ไม่ซ้ำ เรียง ตัดค่าว่าง', () => {
  assert.deepEqual(distinctCategories(Q), ['เภสัชจลนศาสตร์', 'เภสัชวิทยา', 'ยาปฏิชีวนะ'].sort((a, b) => a.localeCompare(b)))
})

test('normForSearch: lowercase + collapse + trim', () => {
  assert.equal(normForSearch('  Hello   World '), 'hello world')
  assert.equal(normForSearch(undefined), '')
})

const QM = [
  { id: 'm1', question: 'ผู้ป่วยเบาหวานร่วมกับโรคไต', categories: ['เบาหวาน', 'ไต'], isPublished: true },
  { id: 'm2', question: 'ยาลดความดัน', categories: ['ความดัน'], isPublished: true },
  { id: 'm3', question: 'ข้อเก่ายังใช้ category เดี่ยว', category: 'ไต', isPublished: true },
]

test('distinctCategories — รวมทุกค่าจาก categories + ข้อเก่าที่ยังเป็น category', () => {
  assert.deepEqual(distinctCategories(QM), ['ความดัน', 'เบาหวาน', 'ไต'].sort((a, b) => a.localeCompare(b)))
})

test('กรองหมวด — ข้อที่มีหลายหมวดต้องติดทุกหมวดที่ตัวเองอยู่', () => {
  assert.deepEqual(filterQuestions(QM, { category: 'เบาหวาน' }).map(q => q.id), ['m1'])
  assert.deepEqual(filterQuestions(QM, { category: 'ไต' }).map(q => q.id), ['m1', 'm3'])
})

test('ค้นหา — คำค้นแมตช์ชื่อหมวดที่สองได้', () => {
  assert.deepEqual(filterQuestions(QM, { search: 'ไต' }).map(q => q.id), ['m1', 'm3'])
})
