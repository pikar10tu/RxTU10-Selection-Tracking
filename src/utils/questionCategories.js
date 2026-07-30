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
