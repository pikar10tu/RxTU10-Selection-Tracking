// เทส questionTriage — กองงานค้างของทีมวิชาการ
// รัน: node --test src/utils/questionTriage.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketsOf, triageBuckets, triageSummary, BUCKET_KEYS, BUCKET_META } from './questionTriage.js'

// ข้อที่ "ปกติ" — ผ่านตรวจ + มีกลุ่ม (ใช้เป็นฐานแล้วค่อยทำให้พังทีละอย่าง)
const OK = { id: 'ok', reviewPass: 1, reviewFail: 0, pleGroup: 'renal', isPublished: true }

test('ข้อปกติไม่เข้ากองไหนเลย', () => {
  assert.deepEqual(bucketsOf(OK), [])
})
test('ไม่ผ่านตรวจ → กอง failed', () => {
  assert.deepEqual(bucketsOf({ ...OK, reviewPass: 0, reviewFail: 1 }), ['failed'])
})
test('ขัดแย้ง → กอง conflict', () => {
  assert.deepEqual(bucketsOf({ ...OK, reviewPass: 1, reviewFail: 1 }), ['conflict'])
})
test('ไม่มี pleGroup และเดาจากหมวดเดิมไม่ได้ → กอง nogroup', () => {
  assert.deepEqual(bucketsOf({ id: 'x', reviewPass: 1, categories: ['หมวดประหลาด'] }), ['nogroup'])
})
test('ยังไม่ migrate แต่หมวดเดิมเดาได้ → ไม่เข้ากอง nogroup', () => {
  assert.deepEqual(bucketsOf({ id: 'x', reviewPass: 1, categories: ['โรคไต'] }), [])
})
test('ข้อใหม่ยังไม่มีใครตรวจ + ไม่มีหมวด → เข้าแค่ nogroup (ไม่ใช่ failed)', () => {
  assert.deepEqual(bucketsOf({ id: 'x' }), ['nogroup'])
})
test('1 ข้ออยู่ได้หลายกองพร้อมกัน', () => {
  assert.deepEqual(bucketsOf({ id: 'x', reviewFail: 1, categories: [] }), ['failed', 'nogroup'])
})
test('ข้อ retired ไม่เข้ากองไหนเลย แม้จะพังทุกอย่าง', () => {
  assert.deepEqual(bucketsOf({ id: 'x', retired: true, reviewFail: 1, categories: [] }), [])
})
test('null/undefined ไม่ระเบิด', () => {
  assert.deepEqual(bucketsOf(null), [])
  assert.deepEqual(bucketsOf(undefined), [])
})

// ── triageBuckets ──
test('จัดกองครบและมีครบทุก key เสมอ (แม้กองว่าง)', () => {
  const b = triageBuckets([OK])
  assert.deepEqual(Object.keys(b).sort(), [...BUCKET_KEYS].sort())
  for (const k of BUCKET_KEYS) assert.deepEqual(b[k], [])
})
test('ข้อที่เผยแพร่อยู่มาก่อนข้อร่างเสมอ (นักศึกษาเห็นของพังอยู่ตอนนี้)', () => {
  const bank = [
    { id: 'draft', reviewFail: 1, pleGroup: 'renal', isPublished: false, createdAt: 200 },
    { id: 'pub', reviewFail: 1, pleGroup: 'renal', isPublished: true, createdAt: 100 },
  ]
  assert.deepEqual(triageBuckets(bank).failed.map(q => q.id), ['pub', 'draft'])
})
test('ในชั้นเดียวกัน ใหม่สุดมาก่อน', () => {
  const bank = [
    { id: 'old', reviewFail: 1, pleGroup: 'renal', isPublished: true, createdAt: 100 },
    { id: 'new', reviewFail: 1, pleGroup: 'renal', isPublished: true, createdAt: 300 },
  ]
  assert.deepEqual(triageBuckets(bank).failed.map(q => q.id), ['new', 'old'])
})
test('createdAt เป็น Firestore Timestamp ก็เรียงได้', () => {
  const ts = (ms) => ({ toMillis: () => ms })
  const bank = [
    { id: 'a', reviewFail: 1, pleGroup: 'renal', isPublished: true, createdAt: ts(100) },
    { id: 'b', reviewFail: 1, pleGroup: 'renal', isPublished: true, createdAt: ts(300) },
  ]
  assert.deepEqual(triageBuckets(bank).failed.map(q => q.id), ['b', 'a'])
})
test('คลังว่าง → ทุกกองว่าง ไม่พัง', () => {
  const b = triageBuckets([])
  for (const k of BUCKET_KEYS) assert.deepEqual(b[k], [])
  assert.deepEqual(triageBuckets(null).failed, [])
})

// ── triageSummary ──
test('total นับข้อไม่ซ้ำ ไม่ใช่ผลบวกทุกกอง', () => {
  // ข้อเดียวที่ทั้งไม่ผ่านตรวจและไม่มีหมวด → counts รวมได้ 2 แต่ total ต้องเป็น 1
  const s = triageSummary([{ id: 'x', reviewFail: 1, categories: [] }])
  assert.equal(s.counts.failed, 1)
  assert.equal(s.counts.nogroup, 1)
  assert.equal(s.total, 1)
})
test('urgent นับเฉพาะข้อที่เผยแพร่อยู่ และไม่นับซ้ำ', () => {
  const s = triageSummary([
    { id: 'a', reviewFail: 1, categories: [], isPublished: true },   // 2 กอง แต่ 1 ข้อ
    { id: 'b', reviewFail: 1, pleGroup: 'renal', isPublished: false },
  ])
  assert.equal(s.total, 2)
  assert.equal(s.urgent, 1)
})
test('คลังสะอาด → total 0', () => {
  assert.equal(triageSummary([OK]).total, 0)
  assert.equal(triageSummary([]).total, 0)
})

// ── ป้ายกำกับ ──
test('ทุกกองมีป้าย/ไอคอน/คำอธิบายครบ', () => {
  for (const k of BUCKET_KEYS) {
    assert.ok(BUCKET_META[k]?.icon, `${k} ไม่มีไอคอน`)
    assert.ok(BUCKET_META[k]?.label, `${k} ไม่มีป้าย`)
    assert.ok(BUCKET_META[k]?.hint, `${k} ไม่มีคำอธิบายว่าต้องทำอะไรต่อ`)
  }
})
