// ════════════════════════════════════════════════════════════
//  Bulk-import ข้อสอบจาก JSON (วางใน QuestionsView)
//  parseImport = pure: รับ string → { rows, skipped, error }
//    - rows    : payload พร้อมเขียน (ยังไม่มี createdBy/createdAt/source — เติมตอน I/O)
//    - skipped : [{ index, reason }] ข้อที่ตกกติกา (caller log/แจ้งผู้ใช้)
//    - warnings: [{ index, reason }] ข้อที่นำเข้าได้แต่มีจุดต้องดู (เช่น กลุ่มโรคระบุมาไม่ถูก)
//    - error   : string ถ้า JSON พังทั้งก้อน (parse ไม่ได้ / ไม่ใช่ array / ว่าง), ปกติ = null
//  ใช้กติกา validate เดียวกับ `valid` computed + การ clean เดียวกับ save() ใน QuestionsView
//  ความปลอดภัยวิชาการ: บังคับ isPublished:false ทุกข้อ — ไม่รับ true จาก JSON
// ════════════════════════════════════════════════════════════
import { cleanText, LIMITS } from './text.js'
import { isDomainKey } from '../data/domains.js'
import { normalizeCategories } from './questionCategories.js'
import { plePatch, pleFields } from './pleMapping.js'
import { isPleGroupKey, groupByKey } from '../data/plecc.js'

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// หมวด/กลุ่มโรคของ 1 item → { fields, warning }
//  ลำดับความเชื่อถือ: pleGroup ที่ระบุมาตรงๆ > เดาจาก categories/category
//  categories ไม่ได้มาจากไฟล์ตรงๆ อีกต่อไป — ระบบ derive จากกลุ่มเสมอ (ดู plePatch)
//  ระบุกลุ่มมาผิด/ไม่ระบุ = ไม่ทิ้งข้อ แต่ปล่อยให้ไปโผล่ในกอง "ไม่มีกลุ่มโรค" ให้วิชาการเคาะ
function pleFromItem(item) {
  if (item.pleGroup != null && !isPleGroupKey(item.pleGroup)) {
    return { fields: legacyPle(item), warning: `pleGroup "${item.pleGroup}" ไม่มีในทะเบียนกลุ่มโรค` }
  }
  const explicit = plePatch(item.pleGroup, item.pleSub)
  if (explicit) {
    const warning = item.pleSub != null && explicit.pleSub == null
      ? `pleSub "${item.pleSub}" ไม่ได้อยู่ในกลุ่ม "${item.pleGroup}" — ตัดทิ้ง`
      : null
    return { fields: explicit, warning }
  }
  return { fields: legacyPle(item), warning: null }
}

// ทางสำรอง: ไม่มี pleGroup → เดาจากชื่อหมวดที่ให้มา (รองรับไฟล์เก่าที่ทำไว้ก่อนมีทะเบียน)
function legacyPle(item) {
  const cats = normalizeCategories(
    Array.isArray(item.categories) ? item.categories : (item.category != null ? [item.category] : [])
  )
  const guess = pleFields({ categories: cats })
  return guess.group
    ? plePatch(guess.group, guess.sub)
    : { pleGroup: null, pleSub: null, categories: cats }
}

// แปลง 1 item → { row, warning } หรือ null (ถ้าตกกติกา)
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

  const ple = pleFromItem(item)

  return {
    row: {
      question,
      choices,
      answer,
      ...ple.fields,   // pleGroup + pleSub + categories (สอดคล้องกันเสมอ)
      explanation: cleanText(item.explanation, LIMITS.explanation) || null,
      // ไม่ระบุ domain → เดาจากกลุ่มโรค (กลุ่ม 1–15 = care · ระบบอื่น = law · sci_* = sci)
      // ทุกกลุ่มผูก domain ไว้แล้วใน plecc.js จึงไม่ต้องให้คนทำไฟล์กรอกซ้ำ
      domain: isDomainKey(item.domain) ? item.domain : (groupByKey(ple.fields.pleGroup)?.domain ?? null),
      examSets,
      isPublished: false, // บังคับร่างเสมอ — ทีมวิชาการตรวจก่อน publish ทีละข้อ
    },
    warning: ple.warning,
  }
}

export function parseImport(text) {
  const out = { rows: [], skipped: [], warnings: [], error: null }

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
    const parsed = rowFromItem(item)
    if (!parsed) {
      out.skipped.push({ index, reason: 'ข้อมูลไม่ครบ/ผิดรูปแบบ (ต้องมีโจทย์ + ตัวเลือกไม่ว่าง ≥ 2)' })
      return
    }
    out.rows.push(parsed.row)
    if (parsed.warning) out.warnings.push({ index, reason: parsed.warning })
  })

  return out
}
