import test from 'node:test'
import assert from 'node:assert/strict'
import {
  packCard, unpackCard, dueCount, dueQuestionIds,
  applyQuizResults, buildQcardsPatch, GRADUATE_REPS, DAY_MS,
} from './srsQuestions.js'

const NOW = 1_755_648_000_000   // เวลาอ้างอิงคงที่ ให้เทส deterministic

test('ตอบผิดข้อใหม่ในควิซปกติ → การ์ดใหม่ due ทันที', () => {
  const { set, remove } = applyQuizResults({
    qcards: {}, answers: [{ id: 'q1', correct: false }], variant: 'normal', now: NOW,
  })
  assert.deepEqual(remove, [])
  assert.equal(set.q1.d, NOW, 'ต้อง due ทันที ไม่ใช่พรุ่งนี้')
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.l, 1)
  assert.equal(set.q1.t, 1)
})

test('ตอบผิดซ้ำในควิซปกติ → lapses เพิ่ม repetitions รีเซ็ต due ทันที', () => {
  const qcards = { q1: { e: 2.2, i: 6, r: 2, l: 1, t: 3, d: NOW - DAY_MS } }
  const { set } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: false }], variant: 'normal', now: NOW,
  })
  assert.equal(set.q1.l, 2)
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.i, 1)
  assert.equal(set.q1.t, 4)
  assert.equal(set.q1.d, NOW)
})

test('ตอบถูกในควิซปกติ → ไม่แตะกองเลย แม้ข้อนั้นมีการ์ดค้างอยู่', () => {
  const qcards = { q1: { e: 2.2, i: 6, r: 2, l: 1, t: 3, d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: true }, { id: 'q2', correct: true }],
    variant: 'normal', now: NOW,
  })
  assert.deepEqual(set, {})
  assert.deepEqual(remove, [])
})

test('redo ตอบถูก 1–2 ครั้ง → การ์ดยังอยู่ interval ยืดออก', () => {
  const r1 = applyQuizResults({
    qcards: { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW } },
    answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(r1.remove, [])
  assert.equal(r1.set.q1.r, 1)
  assert.equal(r1.set.q1.i, 1)
  assert.equal(r1.set.q1.d, NOW + 1 * DAY_MS)

  const r2 = applyQuizResults({
    qcards: { q1: r1.set.q1 },
    answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(r2.remove, [])
  assert.equal(r2.set.q1.r, 2)
  assert.equal(r2.set.q1.i, 6)
  assert.equal(r2.set.q1.d, NOW + 6 * DAY_MS)
})

test(`redo ตอบถูกติดกันครบ ${GRADUATE_REPS} ครั้ง → หลุดกอง`, () => {
  let qcards = { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW } }
  let last
  for (let n = 0; n < GRADUATE_REPS; n++) {
    last = applyQuizResults({
      qcards, answers: [{ id: 'q1', correct: true }], variant: 'redo', now: NOW,
    })
    if (last.set.q1) qcards = { q1: last.set.q1 }
  }
  assert.deepEqual(last.remove, ['q1'], 'ครั้งที่ 3 ต้องหลุดกอง')
  assert.equal(last.set.q1, undefined, 'หลุดกองแล้วห้ามเขียนค่ากลับ')
})

test('redo ตอบถูก 2 ครั้งแล้วผิด → repetitions รีเซ็ต ไม่หลุดกอง due พรุ่งนี้', () => {
  const qcards = { q1: { e: 2.5, i: 6, r: 2, l: 1, t: 3, d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [{ id: 'q1', correct: false }], variant: 'redo', now: NOW,
  })
  assert.deepEqual(remove, [])
  assert.equal(set.q1.r, 0)
  assert.equal(set.q1.l, 2)
  assert.equal(set.q1.d, NOW + DAY_MS, 'ฝึกไปแล้ววันนี้ ไม่วนซ้ำในวันเดียว')
})

test('packCard/unpackCard ครบรอบได้ค่าเดิม', () => {
  const full = { easeFactor: 2.36, interval: 6, repetitions: 2, lapses: 3, totalReviews: 9, dueAt: NOW }
  assert.deepEqual(unpackCard(packCard(full)), full)
})

test('unpackCard ทน entry เสีย/ว่าง → คืนค่าตั้งต้น', () => {
  const d = unpackCard(undefined)
  assert.equal(d.easeFactor, 2.5)
  assert.equal(d.repetitions, 0)
  assert.equal(d.dueAt, 0)
})

test('dueQuestionIds: เรียง due เก่าสุดก่อน + ตัดที่ limit + ข้อยังไม่ครบกำหนดไม่เอา', () => {
  const qcards = {
    a: { d: NOW - 3 * DAY_MS },
    b: { d: NOW - 1 * DAY_MS },
    c: { d: NOW + 5 * DAY_MS },   // ยังไม่ครบกำหนด
    e: { d: NOW - 2 * DAY_MS },
  }
  assert.deepEqual(dueQuestionIds(qcards, NOW, 10), ['a', 'e', 'b'])
  assert.deepEqual(dueQuestionIds(qcards, NOW, 2), ['a', 'e'])
  assert.equal(dueCount(qcards, NOW), 3)
  assert.deepEqual(dueQuestionIds(undefined, NOW, 10), [])
  assert.equal(dueCount(undefined, NOW), 0)
})

test('ข้อที่หายจากคลัง → เข้ารายการลบทิ้ง', () => {
  const qcards = { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: NOW }, gone: { d: NOW } }
  const { set, remove } = applyQuizResults({
    qcards, answers: [], variant: 'redo', now: NOW, missingIds: ['gone', 'neverExisted'],
  })
  assert.deepEqual(set, {})
  assert.deepEqual(remove, ['gone'], 'id ที่ไม่เคยอยู่ในกองไม่ต้องสั่งลบ')
})

test('buildQcardsPatch: optimistic เป็น object ซ้อน · server เป็น dot-notation · ไม่แตะ study.cards', () => {
  const study = { cards: { Amoxicillin: { interval: 6 } }, qcards: { old: { d: 1 } }, lastStudied: 123 }
  const DEL = Symbol('deleteField')
  const { optimisticStudy, server } = buildQcardsPatch({
    study, set: { q1: { e: 2.5, i: 1, r: 0, l: 1, t: 1, d: 999 } }, remove: ['old'], deleteSentinel: DEL,
  })
  assert.deepEqual(optimisticStudy.cards, { Amoxicillin: { interval: 6 } }, 'ห้ามแตะแฟลชการ์ดตัวยา')
  assert.equal(optimisticStudy.lastStudied, 123)
  assert.equal(optimisticStudy.qcards.old, undefined)
  assert.equal(optimisticStudy.qcards.q1.d, 999)
  assert.deepEqual(Object.keys(server).sort(), ['study.qcards.old', 'study.qcards.q1'])
  assert.equal(server['study.qcards.old'], DEL)
  assert.equal(server['study.qcards.q1'].d, 999)
  assert.equal(study.qcards.old.d, 1, 'ห้ามแก้ study ต้นฉบับ')
})
