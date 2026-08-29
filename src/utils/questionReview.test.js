// เทส questionReview — pure logic สถานะ/คิว/leaderboard การตรวจข้อสอบ
// รัน: node --test src/utils/questionReview.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStatus, needsReviewBy, reviewContentChanged, REVIEW_RESET, tallyReviewCounts, nextReviewQueue, buildLeaderboard, reviewStatusKey, REVIEW_STATUS_LABEL, VERDICT_LABEL, pickRandom } from './questionReview.js'

// ── computeStatus (นับจาก reviewPass/reviewFail บน doc) — เกณฑ์ 1 คน/ข้อ ──
test('ยังไม่มีเสียง → pending', () => {
  assert.equal(computeStatus({}), 'pending')
  assert.equal(computeStatus(null), 'pending')
})
test('1 เสียงตัดสินได้เลย — 1-0 → passed · 0-1 → failed', () => {
  assert.equal(computeStatus({ reviewPass: 1 }), 'passed')
  assert.equal(computeStatus({ reviewFail: 1 }), 'failed')
})
test('pass 2 (ของเก่าสมัยเกณฑ์ 2 คน) → passed', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 0 }), 'passed')
})
test('pass 1 + fail 1 (ของเก่า) → conflict', () => {
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
test('มี 1 เสียงจากคนอื่นแล้ว → จบ ไม่ต้องตรวจอีก (เกณฑ์ 1 คน/ข้อ)', () => {
  assert.equal(needsReviewBy({ reviewedBy: ['x'], reviewPass: 1 }, 'me'), false)
  assert.equal(needsReviewBy({ reviewedBy: ['x'], reviewFail: 1 }, 'me'), false)
})
test('ครบ 2 เสียง passed (ของเก่า) → ไม่ต้องตรวจ', () => {
  const q = { reviewedBy: ['x', 'y'], reviewPass: 2, reviewFail: 0 }
  assert.equal(needsReviewBy(q, 'me'), false)
})
test('ครบ 2 เสียง failed (ของเก่า) → ไม่ต้องตรวจ', () => {
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
    { id: '5', reviewedBy: ['x'], reviewPass: 1 },                       // 1 เสียง = จบแล้ว
    { id: '6', reviewedBy: ['x', 'y'], reviewPass: 1, reviewFail: 1 },   // conflict → รอคนตัดสิน
  ]
  assert.deepEqual(nextReviewQueue(qs, 'me').map(q => q.id), ['4', '6'])
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

// ── เกณฑ์ 1 คน/ข้อ: สถานะ half ต้องไม่มีทางเกิดขึ้นอีก ──
test('ไม่มีเสียงเลย → pending', () => {
  assert.equal(computeStatus({}), 'pending')
  assert.equal(computeStatus({ reviewPass: 0, reviewFail: 0 }), 'pending')
})

test("computeStatus ไม่คืน 'half' อีกแล้วไม่ว่าเสียงเท่าไหร่", () => {
  for (let pass = 0; pass <= 3; pass++) {
    for (let fail = 0; fail <= 3; fail++) {
      assert.notEqual(computeStatus({ reviewPass: pass, reviewFail: fail }), 'half')
    }
  }
})

test("ป้ายสถานะไม่มี half แล้ว", () => {
  assert.equal(REVIEW_STATUS_LABEL.half, undefined)
})

test('เสียงที่ 3 นับด้วย — เสียงข้างมากตัดสิน', () => {
  assert.equal(computeStatus({ reviewPass: 2, reviewFail: 1 }), 'passed')
  assert.equal(computeStatus({ reviewPass: 1, reviewFail: 2 }), 'failed')
  assert.equal(computeStatus({ reviewPass: 3, reviewFail: 0 }), 'passed')
})

// ── pickRandom (สุ่มคิวแบบเท่ากันหมด แทนการถ่วงน้ำหนักเดิม) ──
test('pickRandom — แบ่งช่วงเท่ากันตามจำนวนข้อ', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  assert.equal(pickRandom(list, () => 0).id, 'a')
  assert.equal(pickRandom(list, () => 0.3).id, 'b')
  assert.equal(pickRandom(list, () => 0.5).id, 'c')
  assert.equal(pickRandom(list, () => 0.99).id, 'd')
})

test('pickRandom — rnd คืน 1.0 พอดี ต้องไม่หลุดขอบ array', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  assert.equal(pickRandom(list, () => 1).id, 'b')
})

test('pickRandom — ลิสต์ว่างคืน null', () => {
  assert.equal(pickRandom([], () => 0), null)
  assert.equal(pickRandom(undefined, () => 0), null)
})
