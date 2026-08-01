// ════════════════════════════════════════════════════════════
//  CrCl (Cockcroft-Gault) — สูตร/สุ่มโจทย์/เกณฑ์ยอมรับ · pure ล้วน เทส node --test ได้
//  rng ฉีดเข้ามาเพื่อให้เทสคุมผลสุ่มได้ · ห้ามอ้าง DOM/Date.now() ในไฟล์นี้
// ════════════════════════════════════════════════════════════

// เกณฑ์ยอมรับ: นักศึกษาปัดเลขระหว่างทางต่างกันได้ จึงรับ ±2%
//  แต่ต้องมีพื้น 1 mL/min ด้วย ไม่งั้นเคส CrCl ต่ำมาก (เช่น 10) จะเหลือ ±0.2 ซึ่งแคบเกินจริง
export const TOLERANCE_PCT = 0.02
export const TOLERANCE_MIN = 1

// CrCl = [(140 − อายุ) × น้ำหนัก(kg)] / (72 × Scr(mg/dL)) · ผู้หญิงคูณ 0.85
export function cockcroftGault({ age, weightKg, scr, female }) {
  const base = ((140 - age) * weightKg) / (72 * scr)
  return female ? base * 0.85 : base
}

// แถบ CrCl ที่ยอมรับได้ (mL/min) — สุ่มค่าที่ต่างกันเกินนี้ทิ้ง กันคนไข้ที่เป็นไปไม่ได้ทางคลินิก
export const PLAUSIBLE_MIN = 8
export const PLAUSIBLE_MAX = 160

// สุ่มโจทย์ในพิสัยที่เจอจริงในคลินิก · อายุ 18–90 · น้ำหนัก 40–110 kg · Scr 0.5–4.0 (ทศนิยม 1 ตำแหน่ง)
// สุ่มอายุ/น้ำหนัก/Scr อิสระกันทำให้ได้คนไข้ที่เป็นไปไม่ได้ (CrCl 300+) และเอียงไปทางไตวายหนัก
// จึงสุ่มใหม่จนกว่าค่าที่ได้จะอยู่ในช่วงที่เจอจริง — ยังคง pure และคุม rng ได้จากภายนอก
export function makeProblem(rng = Math.random) {
  for (let i = 0; i < 50; i++) {
    const age = 18 + Math.floor(rng() * 73)
    const weightKg = 40 + Math.floor(rng() * 71)
    const scr = Math.round((0.5 + rng() * 3.5) * 10) / 10
    const female = rng() < 0.5
    const p = { age, weightKg, scr, female }
    const v = cockcroftGault(p)
    if (v >= PLAUSIBLE_MIN && v <= PLAUSIBLE_MAX) return p
  }
  return { age: 65, weightKg: 70, scr: 1.2, female: false }   // fallback กันลูปไม่จบ (แทบไม่มีทางถึง)
}

// ตอบถูกเมื่อห่างจากเฉลยไม่เกิน max(1 mL/min, 2%)
export function isClose(answer, expected) {
  if (!Number.isFinite(answer)) return false
  const tol = Math.max(TOLERANCE_MIN, Math.abs(expected) * TOLERANCE_PCT)
  return Math.abs(answer - expected) <= tol
}
