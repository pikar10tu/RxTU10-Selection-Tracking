// ════════════════════════════════════════════════════════════
//  Bulk-import ข้อสอบจาก JSON (วางใน QuestionsView)
//  parseImport = pure: รับ string → { rows, skipped, error }
//    - rows    : payload พร้อมเขียน (ยังไม่มี createdBy/createdAt/source — เติมตอน I/O)
//    - skipped : [{ index, reason }] ข้อที่ตกกติกา (caller log/แจ้งผู้ใช้)
//    - error   : string ถ้า JSON พังทั้งก้อน (parse ไม่ได้ / ไม่ใช่ array / ว่าง), ปกติ = null
//  ใช้กติกา validate เดียวกับ `valid` computed + การ clean เดียวกับ save() ใน QuestionsView
//  ความปลอดภัยวิชาการ: บังคับ isPublished:false ทุกข้อ — ไม่รับ true จาก JSON
// ════════════════════════════════════════════════════════════
import { cleanText, LIMITS } from './text.js'
import { isDomainKey } from '../data/domains.js'
import { normalizeCategories } from './questionCategories.js'

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// แปลง 1 item → payload หรือ null (ถ้าตกกติกา)
function rowFromItem(item) {
  if (!isPlainObject(item)) return null

  const question = cleanText(item.question, LIMITS.question)
  if (!question) return null

  if (!Array.isArray(item.choices)) return null
  const choices = item.choices.map(c => cleanText(c, LIMITS.choice)).filter(Boolean)
  if (choices.length < 2) return null

  // answer: coerce → int, default 0; clamp ถ้าเกินช่วง (เหมือน save())
  let answer = Math.trunc(Number(item.answer))
  if (!Number.isFinite(answer) || answer < 0 || answer >= choices.length) answer = 0

  // ชุดข้อสอบย้อนหลัง: รับ examSets (array) หรือ examSet (string เดี่ยว) — clean + ตัดว่าง
  const rawSets = Array.isArray(item.examSets)
    ? item.examSets
    : (item.examSet != null ? [item.examSet] : [])
  const examSets = rawSets.map(s => cleanText(s, LIMITS.category)).filter(Boolean)

  // หมวด/กลุ่มโรค: รับ categories (array) หรือ category (string เดี่ยว) — normalize + จำกัดจำนวน
  const categories = normalizeCategories(
    Array.isArray(item.categories) ? item.categories : (item.category != null ? [item.category] : [])
  )

  return {
    question,
    choices,
    answer,
    categories,
    explanation: cleanText(item.explanation, LIMITS.explanation) || null,
    domain: isDomainKey(item.domain) ? item.domain : null,
    examSets,
    isPublished: false, // บังคับร่างเสมอ — ทีมวิชาการตรวจก่อน publish ทีละข้อ
  }
}

export function parseImport(text) {
  const out = { rows: [], skipped: [], error: null }

  if (!text || !String(text).trim()) {
    out.error = 'ยังไม่มีข้อมูล — วาง JSON ก่อน'
    return out
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    out.error = 'รูปแบบ JSON ไม่ถูกต้อง (parse ไม่ได้)'
    return out
  }

  if (!Array.isArray(data)) {
    out.error = 'ต้องเป็น array ของข้อสอบ เช่น [ { ... }, { ... } ]'
    return out
  }

  data.forEach((item, index) => {
    const row = rowFromItem(item)
    if (row) out.rows.push(row)
    else out.skipped.push({ index, reason: 'ข้อมูลไม่ครบ/ผิดรูปแบบ (ต้องมีโจทย์ + ตัวเลือกไม่ว่าง ≥ 2)' })
  })

  return out
}
