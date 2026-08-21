// ════════════════════════════════════════════════════════════
//  จัดการหมวด/กลุ่มโรคระดับคลัง — pure ทั้งไฟล์ (I/O อยู่ที่ QuestionsView)
//    topicUsage      : นับว่าหมวดไหนถูกใช้กี่ข้อ
//    topicRows       : แถวสำหรับตารางจัดการหมวด (ทะเบียนกลาง ∪ หมวดที่อยู่บนข้อจริง)
//    mergeTopicsPlan : แผนรวม/เปลี่ยนชื่อหมวด — คืนเฉพาะข้อที่ค่าเปลี่ยนจริง
//  "เปลี่ยนชื่อ" = รวม 1 ต้นทางเข้าชื่อใหม่ จึงใช้ฟังก์ชันเดียวกันทั้งคู่
// ════════════════════════════════════════════════════════════
import { getCategories } from './questionCategories.js'
import { cleanText, LIMITS } from './text.js'

// Map<ชื่อหมวด, จำนวนข้อที่ติดหมวดนั้น> — getCategories ครอบข้อเก่าที่มีแค่ category เดี่ยวให้แล้ว
export function topicUsage(questions) {
  const out = new Map()
  for (const q of (questions || [])) {
    for (const c of getCategories(q)) out.set(c, (out.get(c) || 0) + 1)
  }
  return out
}

// แถวตารางจัดการหมวด — เรียงข้อเยอะมาก่อน (หมวดหลักอยู่บน หมวดร้างตกท้าย) แล้วค่อยเรียงชื่อ
//  registered:false = อยู่บนข้อจริงแต่ตกทะเบียนกลาง (dropdown ยังไม่รู้จัก)
export function topicRows(questions, registry) {
  const usage = topicUsage(questions)
  const known = new Set((Array.isArray(registry) ? registry : [])
    .map(t => (t || '').trim()).filter(Boolean))
  return [...new Set([...known, ...usage.keys()])]
    .map(name => ({ name, count: usage.get(name) || 0, registered: known.has(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'))
}

// แผนรวมหมวด sources → target
//  คืน { target, sources, updates: [{id, categories}], affected, sample }
//  ⚠️ ไม่เรียก normalizeCategories ตอนประกอบผล — มันตัดที่ MAX_CATEGORIES
//     การรวมมีแต่ทำให้จำนวนหมวดต่อข้อเท่าเดิมหรือลดลง ถ้าไปเจอข้อเก่าที่มีเกินเพดาน
//     การ normalize จะกินหมวดท้ายๆ หายเงียบทั้งที่ไม่เกี่ยวกับการรวมเลย
export function mergeTopicsPlan(questions, sources, target) {
  const clean = cleanText(target, LIMITS.category)
  const empty = { target: clean, sources: [], updates: [], affected: 0, sample: [] }
  if (!clean) return empty

  // ต้นทางที่ใช้ได้จริง: clean แล้ว ไม่ว่าง ไม่ซ้ำ และไม่ใช่ตัวปลายทางเอง (รวมตัวเองไม่มีความหมาย)
  const from = [...new Set((Array.isArray(sources) ? sources : [])
    .map(s => cleanText(s, LIMITS.category))
    .filter(s => s && s !== clean))]
  if (!from.length) return empty

  const fromSet = new Set(from)
  const updates = []
  const sample = []
  for (const q of (questions || [])) {
    const cats = getCategories(q)
    if (!cats.some(c => fromSet.has(c))) continue      // ข้อไม่เกี่ยว — ไม่เขียนซ้ำเปล่าๆ
    const next = []
    for (const c of cats) {
      const mapped = fromSet.has(c) ? clean : c
      if (!next.includes(mapped)) next.push(mapped)    // ข้อที่มีทั้งต้นทางและปลายทางจะยุบเหลืออันเดียว
    }
    updates.push({ id: q.id, categories: next })
    if (sample.length < 3) sample.push({ id: q.id, question: q.question })
  }
  return { target: clean, sources: from, updates, affected: updates.length, sample }
}
