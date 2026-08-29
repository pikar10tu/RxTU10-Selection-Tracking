// ════════════════════════════════════════════════════════════
//  questionTriage — จัดกอง "ข้อที่รอดำเนินการ" ให้ทีมวิชาการ (pure ทั้งไฟล์)
//  ใช้ในหน้า /review — โหลดคลังแบบ on-demand ครั้งเดียวต่อเซสชัน (ดู loadTriage)
//  ⚠️ หน้า /review ออกแบบให้ต้นทุน read คงที่ (conflict + สุ่ม pending 40) ห้ามยิงอ่านทั้ง
//     collection ตอนเปิดหน้า — ต้องรอให้ผู้ใช้กดดูรายการก่อนเสมอ
//
//  3 กอง (user เคาะ 29 ส.ค. 2026):
//    failed   ไม่ผ่านตรวจ    → วิชาการต้องแก้ แล้วส่งกลับเข้าคิว
//    conflict ขัดแย้ง        → ของเก่าสมัยเกณฑ์ 2 คน รอคนที่ 3 ตัดสินที่ /review
//    nogroup  ไม่มีกลุ่มโรค   → เลือกกลุ่มตามเกณฑ์สภาฯ ให้ (ดู data/plecc.js)
//
//  ⚠️ ข้อ retired ไม่เข้ากองไหนเลย — ถูกนำออกจากการใช้งานโดยตั้งใจแล้ว
//  ⚠️ 1 ข้ออยู่ได้หลายกองพร้อมกัน (เช่น ไม่ผ่านตรวจ + ไม่มีหมวด) — ตั้งใจให้ซ้ำ
//     เพราะแต่ละกองคือ "งานคนละชิ้น" ที่ต้องทำ ไม่ใช่การจัดหมวดหมู่ข้อ
// ════════════════════════════════════════════════════════════
import { reviewStatusKey } from './questionReview.js'
import { pleFields } from './pleMapping.js'

// Firestore Timestamp | Date | ISO | number → ms (0 ถ้าแปลงไม่ได้)
function toMs(t) {
  if (!t) return 0
  if (typeof t === 'number') return t
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.toDate === 'function') return t.toDate().getTime()
  const n = new Date(t).getTime()
  return Number.isNaN(n) ? 0 : n
}

// เรียงงานที่ควรทำก่อน: ข้อที่ "เผยแพร่อยู่" มาก่อนเสมอ (นักศึกษาเห็นของที่มีปัญหาอยู่ตอนนี้)
// แล้วค่อยใหม่สุดก่อนในแต่ละชั้น
function byUrgency(a, b) {
  const pa = a.isPublished === true ? 0 : 1
  const pb = b.isPublished === true ? 0 : 1
  return pa - pb || toMs(b.createdAt) - toMs(a.createdAt)
}

export const BUCKET_KEYS = ['failed', 'conflict', 'nogroup']

export const BUCKET_META = {
  failed: {
    icon: '🔴', label: 'ไม่ผ่านตรวจ',
    hint: 'คนตรวจบอกว่าต้องแก้หรือผิด — แก้ให้ถูกแล้วส่งกลับเข้าคิวตรวจ',
  },
  conflict: {
    icon: '⚠️', label: 'ขัดแย้ง',
    hint: 'ตรวจไป 2 คนแล้วผลไม่ตรงกัน (ของเก่าสมัยเกณฑ์ 2 คน) — ต้องมีคนที่ 3 ไปตัดสินที่หน้าตรวจ',
  },
  nogroup: {
    icon: '🏷️', label: 'ไม่มีกลุ่มโรค',
    hint: 'ยังไม่ได้จัดเข้ากลุ่มตามเกณฑ์สภาฯ — ไปเลือกกลุ่มให้ที่คลังข้อสอบ',
  },
}

// ข้อนี้อยู่กองไหนบ้าง (array ว่าง = ไม่มีปัญหา)
export function bucketsOf(question) {
  if (!question || question.retired) return []
  const out = []
  const status = reviewStatusKey(question)
  if (status === 'failed') out.push('failed')
  if (status === 'conflict') out.push('conflict')
  if (!pleFields(question).group) out.push('nogroup')
  return out
}

// จัดทั้งคลังลงกอง — { failed: [...], conflict: [...], nogroup: [...] }
export function triageBuckets(questions) {
  const out = Object.fromEntries(BUCKET_KEYS.map(k => [k, []]))
  for (const q of (questions || [])) {
    for (const k of bucketsOf(q)) out[k].push(q)
  }
  for (const k of BUCKET_KEYS) out[k].sort(byUrgency)
  return out
}

// สรุปตัวเลขไว้โชว์บนแถบรวม
//  total = "จำนวนข้อที่มีปัญหา" (นับข้อไม่ซ้ำ) ไม่ใช่ผลบวกของทุกกอง เพราะ 1 ข้ออยู่ได้หลายกอง
export function triageSummary(questions) {
  const b = triageBuckets(questions)
  const counts = Object.fromEntries(BUCKET_KEYS.map(k => [k, b[k].length]))
  const ids = new Set()
  for (const k of BUCKET_KEYS) for (const q of b[k]) ids.add(q.id)
  return { counts, total: ids.size, urgent: countUrgent(b) }
}

// ข้อที่ "เผยแพร่อยู่ทั้งที่มีปัญหา" — นับไม่ซ้ำ · นี่คือเลขที่ควรทำให้เป็น 0 ก่อนใคร
function countUrgent(buckets) {
  const ids = new Set()
  for (const k of BUCKET_KEYS) {
    for (const q of buckets[k]) if (q.isPublished === true) ids.add(q.id)
  }
  return ids.size
}
