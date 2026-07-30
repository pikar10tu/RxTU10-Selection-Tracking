// เทส questionReview — pure logic สถานะ/คิว/leaderboard การตรวจข้อสอบ
// รัน: node --test src/utils/questionReview.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStatus, needsReviewBy, reviewContentChanged, REVIEW_RESET, tallyReviewCounts, nextReviewQueue, buildLeaderboard, reviewStatusKey, REVIEW_STATUS_LABEL, VERDICT_LABEL, reviewWeight, pickWeighted, REVIEW_WEIGHTS } from './questionReview.js'

// ── computeStatus (นับจาก reviewPass/reviewFail บน doc) ──
test('ยังไม่มีเสียง → pending', () => {
  assert.equal(computeStatus({}), 'pending')
  assert.equal(computeStatus(null), 'pending')
})
test('1 เสียง (ยังไม่ครบ 2) → half', () => {
  assert.equal(computeStatus({ reviewPass: 1 }), 'half')
  assert.equal(computeStatus({ reviewFail: 1 }), 'half')
})
test('pass 2 → passed', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 0 }), 'passed')
})
test('pass 1 + fail 1 → conflict', () => {
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 1 }), 'conflict')
})
test('fail 2 (fix+wrong หรือ wrong+wrong) → failed', () => {
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 2 }), 'failed')
})
test('คนที่ 3 ตัดสิน conflict → เสียงข้างมากเป็น passed', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 1 }), 'passed')
})
test('คนที่ 3 ตัดสิน conflict → เสียงข้างมากเป็น failed', () => {
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 2 }), 'failed')
})

// ── needsReviewBy ──
test('ข้อตัวเอง (createdBy == me) → ไม่ต้องตรวจ', () => {
  assert.equal(needsReviewBy({ createdBy: 'me', reviewedBy: [] }, 'me'), false)
})
test('ข้อ import (createdBy == me แต่ source=import) → ต้องตรวจ (คนกด import ไม่ใช่คนแต่งโจทย์)', () => {
  assert.equal(needsReviewBy({ createdBy: 'me', source: 'import', reviewedBy: [] }, 'me'), true)
})
test('ข้อ import ที่ฉันตรวจแล้ว → ไม่ต้องตรวจซ้ำ', () => {
  assert.equal(needsReviewBy({ createdBy: 'me', source: 'import', reviewedBy: ['me'] }, 'me'), false)
})
test('ตรวจไปแล้ว (อยู่ใน reviewedBy) → ไม่ต้องตรวจ', () => {
  assert.equal(needsReviewBy({ reviewedBy: ['me'] }, 'me'), false)
})
test('ข้อใหม่ ยังไม่มีใครตรวจ → ต้องตรวจ', () => {
  assert.equal(needsReviewBy({ reviewedBy: [] }, 'me'), true)
  assert.equal(needsReviewBy({}, 'me'), true)
})
test('มี 1 เสียงจากคนอื่น → ยังต้องตรวจ (หาให้ครบ 2)', () => {
  assert.equal(needsReviewBy({ reviewedBy: ['x'], reviewPass: 1 }, 'me'), true)
})
test('ครบ 2 เสียง passed → ไม่ต้องตรวจ', () => {
  const q = { reviewedBy: ['x', 'y'], reviewPass: 2, reviewFail: 0 }
  assert.equal(needsReviewBy(q, 'me'), false)
})
test('ครบ 2 เสียง failed → ไม่ต้องตรวจ', () => {
  const q = { reviewedBy: ['x', 'y'], reviewPass: 0, reviewFail: 2 }
  assert.equal(needsReviewBy(q, 'me'), false)
})
test('conflict (2 เสียงขัดแย้ง) → คนที่ 3 ต้องตรวจ', () => {
  const q = { reviewedBy: ['x', 'y'], reviewPass: 1, reviewFail: 1 }
  assert.equal(needsReviewBy(q, 'me'), true)
})
test('conflict แต่ฉันเป็น 1 ใน 2 คนเดิม → ไม่ต้องตรวจซ้ำ', () => {
  const q = { reviewedBy: ['me', 'y'], reviewPass: 1, reviewFail: 1 }
  assert.equal(needsReviewBy(q, 'me'), false)
})
test('conflict ที่คนที่ 3 ตัดสินแล้ว → ไม่ต้องตรวจ', () => {
  const q = { reviewedBy: ['x', 'y', 'z'], reviewPass: 2, reviewFail: 1 }
  assert.equal(needsReviewBy(q, 'me'), false)
})

// ── reviewContentChanged + REVIEW_RESET ──
test('โจทย์/ตัวเลือก/เฉลย/คำอธิบายเหมือนเดิม → ไม่เปลี่ยน (toggle publish ไม่นับ)', () => {
  const before = { question: 'Q', choices: ['a', 'b'], answer: 0, explanation: 'e', isPublished: false, category: 'x' }
  const after  = { question: 'Q', choices: ['a', 'b'], answer: 0, explanation: 'e', isPublished: true,  category: 'y' }
  assert.equal(reviewContentChanged(before, after), false)
})
test('แก้โจทย์/เฉลย/ตัวเลือก → เปลี่ยน', () => {
  const base = { question: 'Q', choices: ['a', 'b'], answer: 0, explanation: null }
  assert.equal(reviewContentChanged(base, { ...base, question: 'Q2' }), true)
  assert.equal(reviewContentChanged(base, { ...base, answer: 1 }), true)
  assert.equal(reviewContentChanged(base, { ...base, choices: ['a', 'c'] }), true)
})
test('explanation undefined กับ null ถือว่าเท่ากัน', () => {
  const before = { question: 'Q', choices: ['a'], answer: 0 }
  const after  = { question: 'Q', choices: ['a'], answer: 0, explanation: null }
  assert.equal(reviewContentChanged(before, after), false)
})
test('ไม่มีข้อมูลเดิมให้เทียบ → ถือว่าเปลี่ยน (ปลอดภัยไว้ก่อน)', () => {
  assert.equal(reviewContentChanged(null, { question: 'Q' }), true)
})
test('REVIEW_RESET ทำให้ข้อกลับเข้าคิวและสถานะกลับเป็น pending', () => {
  const q = { reviewedBy: ['x', 'y'], reviewPass: 0, reviewFail: 2, reviewStatus: 'failed', ...REVIEW_RESET }
  assert.equal(computeStatus(q), 'pending')
  assert.equal(needsReviewBy(q, 'x'), true)
})

// ── retired + reviewStatusKey ──
test('ข้อ retired → ไม่เข้าคิวตรวจ ไม่ว่าสถานะไหน', () => {
  assert.equal(needsReviewBy({ retired: true, reviewedBy: [] }, 'me'), false)
  assert.equal(needsReviewBy({ retired: true, reviewedBy: ['x', 'y'], reviewPass: 1, reviewFail: 1 }, 'me'), false)
})
test('reviewStatusKey: retired ทับสถานะคำนวณ', () => {
  assert.equal(reviewStatusKey({ retired: true, reviewPass: 2, reviewFail: 0 }), 'retired')
  assert.equal(reviewStatusKey({ reviewPass: 1, reviewFail: 1 }), 'conflict')
  assert.equal(reviewStatusKey({}), 'pending')
  assert.equal(reviewStatusKey(null), 'pending')
})
test('label ครบทุก key', () => {
  for (const k of ['pending', 'passed', 'conflict', 'failed', 'retired']) assert.ok(REVIEW_STATUS_LABEL[k])
  for (const k of ['correct', 'fix', 'wrong']) assert.ok(VERDICT_LABEL[k])
})

// ── tallyReviewCounts ──
test('นับจำนวนข้อที่แต่ละ uid ตรวจ', () => {
  const qs = [
    { reviewedBy: ['a', 'b'] },
    { reviewedBy: ['a'] },
    { reviewedBy: [] },
    { /* ไม่มี field */ },
  ]
  assert.deepEqual(tallyReviewCounts(qs), { a: 2, b: 1 })
})
test('คลังว่าง → object ว่าง', () => {
  assert.deepEqual(tallyReviewCounts([]), {})
})

// ── nextReviewQueue ──
test('คืนเฉพาะข้อที่ฉันต้องตรวจ (กันข้อตัวเอง/ตรวจซ้ำ/ครบแล้ว)', () => {
  const qs = [
    { id: '1', createdBy: 'me', reviewedBy: [] },                        // ข้อตัวเอง
    { id: '2', reviewedBy: ['me'] },                                     // ตรวจแล้ว
    { id: '3', reviewedBy: ['x', 'y'], reviewPass: 2, reviewFail: 0 },   // passed
    { id: '4', reviewedBy: [] },                                         // ใหม่ → ต้องตรวจ
    { id: '5', reviewedBy: ['x'], reviewPass: 1 },                       // 1 เสียง → ต้องตรวจ
  ]
  assert.deepEqual(nextReviewQueue(qs, 'me').map(q => q.id), ['4', '5'])
})
test('ไม่มี myUid → คิวว่าง', () => {
  assert.deepEqual(nextReviewQueue([{ reviewedBy: [] }], null), [])
})

// ── buildLeaderboard ──
test('เรียงมาก→น้อย + แมพชื่อจาก nameMap', () => {
  const rows = buildLeaderboard({ a: 3, b: 5, c: 1 }, { a: 'Ann', b: 'Bee', c: 'Cee' })
  assert.deepEqual(rows, [
    { uid: 'b', name: 'Bee', count: 5 },
    { uid: 'a', name: 'Ann', count: 3 },
    { uid: 'c', name: 'Cee', count: 1 },
  ])
})
test('uid ไม่มีใน nameMap → ชื่อ "ไม่ระบุ"', () => {
  const rows = buildLeaderboard({ z: 2 }, {})
  assert.equal(rows[0].name, 'ไม่ระบุ')
})
test('count เท่ากัน → tiebreak ด้วยชื่อ', () => {
  const rows = buildLeaderboard({ a: 2, b: 2 }, { a: 'Beta', b: 'Alpha' })
  assert.deepEqual(rows.map(r => r.name), ['Alpha', 'Beta'])
})

// ── สถานะ half + น้ำหนักคิว ──
test("1 เสียง → half (แยกจาก pending เพื่อให้คิวเร่งข้อค้างได้)", () => {
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 0 }), 'half')
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 1 }), 'half')
})

test('ไม่มีเสียงเลย → pending', () => {
  assert.equal(computeStatus({}), 'pending')
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 0 }), 'pending')
})

test('เสียงที่ 3 นับด้วย — เสียงข้างมากตัดสิน', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 1 }), 'passed')
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 2 }), 'failed')
  assert.equal(computeStatus({ reviewPass: 3, reviewFail: 0 }), 'passed')
})

test('reviewWeight — conflict 8 · half 4 · pending 1', () => {
  assert.equal(reviewWeight({ reviewPass: 1, reviewFail: 1 }), 8)
  assert.equal(reviewWeight({ reviewPass: 1, reviewFail: 0 }), 4)
  assert.equal(reviewWeight({}), 1)
})

test('pickWeighted — เลือกตามช่วงน้ำหนักสะสม', () => {
  const pending = { id: 'p' }                               // น้ำหนัก 1
  const half = { id: 'h', reviewPass: 1, reviewFail: 0 }    // น้ำหนัก 4
  const list = [pending, half]                              // รวม 5
  assert.equal(pickWeighted(list, () => 0).id, 'p')         // 0.0 × 5 = 0   → ช่วงแรก
  assert.equal(pickWeighted(list, () => 0.1).id, 'p')       // 0.5           → ช่วงแรก
  assert.equal(pickWeighted(list, () => 0.5).id, 'h')       // 2.5           → ช่วงสอง
  assert.equal(pickWeighted(list, () => 0.999).id, 'h')     // ~5            → ช่วงสอง
})

test('pickWeighted — ลิสต์ว่างคืน null', () => {
  assert.equal(pickWeighted([], () => 0), null)
  assert.equal(pickWeighted(undefined, () => 0), null)
})

test('ป้ายสถานะมี half', () => {
  assert.equal(REVIEW_STATUS_LABEL.half, 'ตรวจแล้ว 1 คน')
})
