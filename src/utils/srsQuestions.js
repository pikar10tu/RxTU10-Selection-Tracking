/**
 * SRS ของ "ข้อที่เคยผิด" — กอง `study.qcards` บน user doc
 *   key   = question id
 *   value = คีย์ย่อ { e,i,r,l,t,d } (ease/interval/reps/lapses/totalReviews/dueAt)
 *
 * คีย์ย่อเพราะออดิต 13 ส.ค. เตือน user doc บวม — ชื่อเต็ม 200 ข้อ ≈ 40KB vs ย่อ ≈ 12KB
 * และ user doc ถูกอ่านใหม่ทุก onSnapshot
 *
 * ตรรกะล้วน ไม่แตะ Firestore/Vue — เทสด้วย `node --test src/utils/srsQuestions.test.js`
 * spec: docs/superpowers/specs/2026-08-20-quiz-srs-wiring-design.md
 */
import { sm2Update } from './sm2.js'

export const GRADUATE_REPS = 3          // ตอบถูกติดกันครบเท่านี้ = "แก้ได้แล้ว" หลุดกอง (กัน map โตไม่จำกัด)
export const DAY_MS = 86_400_000

const BASE = { easeFactor: 2.5, interval: 1, repetitions: 0, lapses: 0, totalReviews: 0, dueAt: 0 }
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

export function packCard(c) {
  return { e: c.easeFactor, i: c.interval, r: c.repetitions, l: c.lapses, t: c.totalReviews, d: c.dueAt }
}

export function unpackCard(p) {
  if (!p || typeof p !== 'object') return { ...BASE }
  return {
    easeFactor:   num(p.e, BASE.easeFactor),
    interval:     num(p.i, BASE.interval),
    repetitions:  num(p.r, BASE.repetitions),
    lapses:       num(p.l, BASE.lapses),
    totalReviews: num(p.t, BASE.totalReviews),
    dueAt:        num(p.d, BASE.dueAt),
  }
}

/** จำนวนข้อที่ครบกำหนดทบทวน (ใช้ทำ subtitle การ์ดใน StudyView — 0 reads) */
export function dueCount(qcards, now) {
  if (!qcards || typeof qcards !== 'object') return 0
  return Object.values(qcards).filter(p => num(p?.d, 0) <= now).length
}

/** id ที่ครบกำหนด เรียง due เก่าสุดก่อน ตัดที่ limit */
export function dueQuestionIds(qcards, now, limit) {
  if (!qcards || typeof qcards !== 'object') return []
  return Object.entries(qcards)
    .filter(([, p]) => num(p?.d, 0) <= now)
    .sort((a, b) => num(a[1]?.d, 0) - num(b[1]?.d, 0))
    .slice(0, limit)
    .map(([id]) => id)
}

/**
 * ผลของรอบควิซที่มีต่อกอง — ไม่แก้ของเดิม คืนสิ่งที่ต้องเขียน/ลบ
 * @returns {{ set: Object<string, object>, remove: string[] }}
 */
export function applyQuizResults({ qcards = {}, answers = [], variant = 'normal', now = Date.now(), missingIds = [] } = {}) {
  const pool = qcards && typeof qcards === 'object' ? qcards : {}
  const set = {}
  const remove = []

  for (const a of answers) {
    if (!a || !a.id) continue
    const prev = unpackCard(pool[a.id])

    // ควิซปกติ/Zen: ตอบถูกไม่แตะกอง · ตอบผิด = เข้ากองและ due ทันที (เพิ่งพลาด ควรได้แก้วันนี้)
    if (variant !== 'redo') {
      if (a.correct) continue
      const u = sm2Update(prev, 1)
      set[a.id] = packCard({
        ...u, lapses: prev.lapses + 1, totalReviews: prev.totalReviews + 1, dueAt: now,
      })
      continue
    }

    // โหมด redo
    if (!a.correct) {
      const u = sm2Update(prev, 1)
      set[a.id] = packCard({
        ...u, lapses: prev.lapses + 1, totalReviews: prev.totalReviews + 1, dueAt: now + DAY_MS,
      })
      continue
    }
    const u = sm2Update(prev, 4)
    if (u.repetitions >= GRADUATE_REPS) { remove.push(a.id); continue }
    set[a.id] = packCard({
      ...u, lapses: prev.lapses, totalReviews: prev.totalReviews + 1, dueAt: now + u.interval * DAY_MS,
    })
  }

  // ข้อที่หายจากคลัง/ถูกถอนเผยแพร่ → ลบทิ้ง (เฉพาะที่อยู่ในกองจริง)
  for (const id of missingIds) {
    if (has(pool, id) && !remove.includes(id)) remove.push(id)
  }
  for (const id of remove) delete set[id]   // ลบแล้วไม่ต้องเขียนค่ากลับ

  return { set, remove }
}

/**
 * แปลงผลเป็น patch คู่ให้ `auth.patchUser(optimistic, server)`
 * - `optimisticStudy` = object ซ้อนปกติ (setUserDataOptimistic เป็น shallow spread)
 * - `server` = dot-notation `study.qcards.<id>` เท่านั้น — ห้ามส่ง study ทั้งก้อน ไม่งั้นทับ study.cards
 * @param {any} deleteSentinel ค่าที่ใช้แทนการลบฟิลด์ (ฝั่งแอปส่ง `deleteField()` เข้ามา)
 */
export function buildQcardsPatch({ study = {}, set = {}, remove = [], deleteSentinel } = {}) {
  const src = study && typeof study === 'object' ? study : {}
  const qcards = { ...(src.qcards || {}) }
  const server = {}

  for (const [id, card] of Object.entries(set)) {
    qcards[id] = card
    server[`study.qcards.${id}`] = card
  }
  for (const id of remove) {
    delete qcards[id]
    server[`study.qcards.${id}`] = deleteSentinel
  }

  return { optimisticStudy: { ...src, qcards }, server }
}
