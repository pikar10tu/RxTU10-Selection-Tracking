// ════════════════════════════════════════════════════════════
//  หมวด / กลุ่มโรคของข้อสอบ — 1 ข้อมีได้หลายหมวด (MAX_CATEGORIES)
//  ทางเข้าเดียวของการอ่านหมวด: ห้ามอ่าน q.category ตรงๆ ที่อื่นอีก
//  ข้อเก่าเก็บเป็น category (string เดี่ยว) — getCategories ห่อให้อัตโนมัติ
//  จึงใช้งานได้ทันทีโดยไม่ต้องรอ migrate (ปุ่มซิงก์ใน Admin ค่อยตามเติมให้)
// ════════════════════════════════════════════════════════════
import { cleanText, LIMITS } from './text.js'

export const MAX_CATEGORIES = 5

// อ่านหมวดของข้อเป็น array เสมอ (ตัดค่าว่าง/ช่องว่างหัวท้าย/ค่าซ้ำ)
export function getCategories(question) {
  const raw = Array.isArray(question?.categories)
    ? question.categories
    : (question?.category ? [question.category] : [])
  return [...new Set(raw.map(c => (c || '').trim()).filter(Boolean))]
}

// เตรียมค่าก่อนเขียน Firestore — cleanText ทีละตัว + ตัดว่าง + unique + จำกัดจำนวน
export function normalizeCategories(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map(c => cleanText(c, LIMITS.category))
    .filter(Boolean)
  return [...new Set(clean)].slice(0, MAX_CATEGORIES)
}

// ชื่อหมวดที่ยังไม่อยู่ใน "ทะเบียนกลาง" (config/topics.list ที่ dropdown อ่าน)
//  ทะเบียนกลางเคยโตทางเดียว = ต้องมีคนกด "➕ เพิ่มหัวข้อใหม่" เท่านั้น
//  หมวดที่มากับ bulk import / ข้อเก่าที่มีแค่ category เดี่ยว จึงติดอยู่บนข้อ
//  แต่ไม่เคยขึ้น dropdown ให้คนตรวจข้ออื่นเลือกตาม (เช่น "โรคอ้วนและการควบคุมน้ำหนัก")
//  → ทุกทางที่เขียนหมวดลงข้อ ให้ส่งชื่อผ่านนี่แล้ว arrayUnion เข้าทะเบียนด้วย
//  ไม่ตัดที่ MAX_CATEGORIES — เพดานนั้นคือ "กี่หมวดต่อ 1 ข้อ" ไม่ใช่ขนาดทะเบียน
export function unregisteredTopics(registry, incoming) {
  const known = new Set((Array.isArray(registry) ? registry : [])
    .map(t => (t || '').trim()).filter(Boolean))
  const out = []
  for (const name of (Array.isArray(incoming) ? incoming : [])) {
    const clean = cleanText(name, LIMITS.category)
    if (!clean || known.has(clean)) continue
    known.add(clean)      // กันซ้ำภายในชุดที่ส่งเข้ามาเอง
    out.push(clean)
  }
  return out
}
