// ════════════════════════════════════════════════════════════
//  questionReport — pure helpers ฟีเจอร์ "แจ้งข้อสอบผิด" (Phase 5)
//  ไม่ import Firestore: caller เป็นคนเติม serverTimestamp() เอง → เทสได้ตรง
// ════════════════════════════════════════════════════════════
import { getCategories } from './questionCategories.js'

// deterministic doc id → 1 report ต่อ (ข้อ, ผู้ใช้); re-report = ทับ doc เดิม
export function reportDocId(questionId, uid) {
  return `${questionId}__${uid}`
}

// snapshot ของข้อ ณ เวลาแจ้ง — fallback เผื่อข้อถูกแก้/ลบก่อนรีวิว
// answerText เก็บ "ข้อความ" คำตอบ (ไม่ใช่ index) เพราะ QuizView สลับตำแหน่งตัวเลือก
export function buildSnapshot(q) {
  const choices = Array.isArray(q?.choices) ? q.choices.slice() : []
  const answer = typeof q?.answer === 'number' ? q.answer : -1
  return {
    question: q?.question || '',
    category: getCategories(q).join(', '),
    choices,
    answerText: choices[answer] ?? '',
    explanation: q?.explanation || '',
  }
}

// Firestore Timestamp | Date | ISO string | number → ms (0 ถ้าแปลงไม่ได้)
function toMs(t) {
  if (!t) return 0
  if (typeof t === 'number') return t
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.toDate === 'function') return t.toDate().getTime()
  const n = new Date(t).getTime()
  return Number.isNaN(n) ? 0 : n
}

// จัดกลุ่ม reports[] (flat) ตาม questionId → [{ questionId, count, reports[], snapshot }]
// ในกลุ่ม + ระหว่างกลุ่ม เรียงใหม่สุดก่อน (tie-break: count มากก่อน)
export function groupReports(reports) {
  const byQ = new Map()
  for (const r of reports || []) {
    if (!byQ.has(r.questionId)) byQ.set(r.questionId, [])
    byQ.get(r.questionId).push(r)
  }
  const groups = []
  for (const [questionId, rs] of byQ) {
    const sorted = rs.slice().sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    groups.push({ questionId, count: sorted.length, reports: sorted, snapshot: sorted[0]?.questionSnapshot || null })
  }
  return groups.sort((a, b) =>
    toMs(b.reports[0]?.createdAt) - toMs(a.reports[0]?.createdAt) || b.count - a.count
  )
}

// patch สำหรับปิด report (ไม่รวม resolvedAt — caller เติม serverTimestamp())
//   valid   → stamp รางวัล, รอ Mailbox ส่ง (rewardDelivered:false)
//   invalid → ไม่มีรางวัล
export function resolvePayload(verdict, rewardConst) {
  if (verdict === 'valid') {
    return { status: 'resolved', verdict: 'valid', rewardAmount: rewardConst, rewardDelivered: false }
  }
  return { status: 'resolved', verdict: 'invalid', rewardAmount: 0 }
}
