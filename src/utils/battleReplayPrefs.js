// battleReplayPrefs.js — preset ของ BattleReplay 3 แกนที่อิสระต่อกัน
//   แกน A (fx)    = ความอลังการของภาพ → ตอบคำถาม "แลคมั้ย" (กระทบต้นทุน GPU ล้วน)
//   แกน B (pace)  = จังหวะ → ตอบคำถาม "สนุกมั้ย" (ไม่กระทบต้นทุนเลย)
//   แกน C (style) = ท่าชน → ตอบคำถาม "ดูแล้วเหมือนพุ่งเข้าชนกันจริงมั้ย" (แบบ A/B/C/D)
// เก็บลง localStorage ของเครื่องนั้นเครื่องเดียว — ไม่แตะ config/app กัน user ทดสอบแล้วกระทบนักศึกษาที่กำลังเล่นอยู่

/** flags ทั้ง 5 ตัวต้องมีครบทุก preset — โค้ดที่อ่าน flag คาดหวัง boolean ไม่ใช่ undefined */
export const FX_PRESETS = {
  high: { cardLunge: true,  targetSquash: true,  screenShake: true,  burst: true, ko: true },
  mid:  { cardLunge: true,  targetSquash: false, screenShake: false, burst: true, ko: true },
  low:  { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true },
}

/** ใช้เมื่อ prefersReducedMotion() = true — คงจังหวะ 4 ชั้นไว้ ตัดแต่การเคลื่อนไหว
 *  (28 ส.ค. 2026 bypass ทั้งเว็บแล้ว → ปกติไม่ถูกใช้ เหลือไว้เผื่อเปิดกลับ ดู utils/motionPref.js) */
export const REDUCED_FLAGS = { cardLunge: false, targetSquash: false, screenShake: false, burst: false, ko: false }

export const PACE_PRESETS = { grand: 1.25, normal: 1, tight: 0.8 }

/** ป้ายภาษาไทยของสองแกนแรก — อยู่ที่นี่เพราะทั้งพาเนล Admin และป้ายมุมจอในไฟต์ทดสอบต้องใช้ชุดเดียวกัน */
export const FX_LABEL = { high: 'สวยสุด', mid: 'กลาง', low: 'เบา' }
export const PACE_LABEL = { grand: 'อลังการ', normal: 'กลาง', tight: 'กระชับ' }

/**
 * ท่าชน 4 แบบให้เลือกเทียบในห้องแล็บ — ทุกแบบยังเคารพข้อบังคับ v3 (1 หมัด = 1 animation ต่อการ์ด, transform/opacity ล้วน)
 * ต่างกันแค่ "รูปร่างของ keyframes" ไม่ใช่จำนวนอนิเมชัน → ต้นทุนต่อหมัดใกล้กัน ยกเว้น chipReach/recoil ที่เพิ่มการ์ดที่ขยับ
 *
 *   reach     สัดส่วนระยะที่การ์ดผู้ตีพุ่งไปถึง (1 = ทับกลางเป้าเลย · .7 = หยุดตรงที่ขอบการ์ดชนกัน เห็นทั้งคู่)
 *   pull      ตัวคูณระยะถอยหลังตอนเงื้อ
 *   chipReach สัดส่วนระยะที่ชั้น "ถาก" สะบัดไปข้างหน้า (0 = ไม่ขยับการ์ดเลย = ของเดิม)
 *             ⚠️ ชั้นถาก = 55% ของหมัดทั้งไฟต์ → ตัวนี้คือตัวแปรที่แพงที่สุดในตาราง ถ้าเลือกแบบที่มีแล้วกระตุก คือตัวนี้
 *   spin      องศาที่การ์ดเอียงเข้าหาเป้าระหว่างพุ่ง (0 = ไม่เอียง)
 *   back      จังหวะกลับที่เดิม: 'tail' = ค่อยๆ ลอยกลับตลอด tail (เดิม) · 'snap' = กลับใน 220ms แล้วนิ่ง · 'fast' = 130ms
 *   bounce    px ที่เลยที่เดิมไปอีกนิดตอนกลับ แล้วค่อยเข้าที่ (0 = ไม่มีเด้ง)
 *   recoil    px ที่การ์ด "เป้า" ถูกกระแทกถอยหลังตามแนวหมัด แยกตามชั้น (0 = ไม่ถอย = ของเดิม)
 *   squash    ความแรงที่เป้าบีบตัว แยกตามชั้น
 */
export const MOTION_STYLES = {
  A: {
    label: 'A · เดิม', hint: 'พุ่งทับกลางเป้า ลอยกลับยาว · ชั้นถากไม่ขยับการ์ด',
    reach: 1.00, pull: 1, chipReach: 0, spin: 0, back: 'tail', bounce: 0,
    recoil: { solid: 0, heavy: 0, finish: 0 }, squash: { solid: 0, heavy: 0.36, finish: 0.50 },
  },
  B: {
    label: 'B · ชนแล้วเด้ง', hint: 'หยุดตรงจุดปะทะ (เห็นทั้งคู่) เป้าถอยหลัง แล้วดีดกลับที่เดิมเร็ว',
    reach: 0.70, pull: 1.15, chipReach: 0.12, spin: 0, back: 'snap', bounce: 6,
    recoil: { solid: 7, heavy: 14, finish: 20 }, squash: { solid: 0.16, heavy: 0.36, finish: 0.50 },
  },
  C: {
    label: 'C · กระแทกหนัก', hint: 'เงื้อลึก เอียงตัวเข้าชน เป้ากระเด็นไกล — อลังการสุด แพงสุด',
    reach: 0.80, pull: 1.6, chipReach: 0.14, spin: 7, back: 'tail', bounce: 10,
    recoil: { solid: 9, heavy: 20, finish: 28 }, squash: { solid: 0.20, heavy: 0.42, finish: 0.58 },
  },
  D: {
    label: 'D · เร็ว สะบัด', hint: 'เงื้อสั้น พุ่งแตะแล้วดีดกลับทันที เหลือช่วงนิ่งให้อ่านเลข',
    reach: 0.64, pull: 0.55, chipReach: 0.13, spin: 0, back: 'fast', bounce: 4,
    recoil: { solid: 5, heavy: 10, finish: 14 }, squash: { solid: 0.14, heavy: 0.30, finish: 0.42 },
  },
}

/** ⚠️ ค่าเริ่มต้นที่ส่งถึงนักศึกษาจริง — อัปเดตตรงนี้หลัง user เทสจอจริงผ่านพาเนล Admin แล้ว (§11.4 ของสเปก)
 *  style ยังเป็น 'A' = พฤติกรรมเดิมเป๊ะ จนกว่าจะมีคนดูของจริงแล้วเลือกแบบอื่น */
export const DEFAULT_PREFS = { fx: 'high', pace: 'normal', style: 'A', motionOverride: false }

const KEY = 'rxtu10.battleReplayPrefs'

function defaultStorage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function readPrefs(storage) {
  const s = storage === undefined ? defaultStorage() : storage
  if (!s) return { ...DEFAULT_PREFS }
  let raw = null
  try { raw = s.getItem(KEY) } catch { return { ...DEFAULT_PREFS } }
  if (!raw) return { ...DEFAULT_PREFS }
  let o = null
  try { o = JSON.parse(raw) } catch { return { ...DEFAULT_PREFS } }
  if (!o || typeof o !== 'object') return { ...DEFAULT_PREFS }
  return {
    fx:    FX_PRESETS[o.fx] ? o.fx : DEFAULT_PREFS.fx,          // ตกกลับทีละฟิลด์ ไม่ทิ้งทั้งก้อน
    pace:  PACE_PRESETS[o.pace] ? o.pace : DEFAULT_PREFS.pace,
    style: MOTION_STYLES[o.style] ? o.style : DEFAULT_PREFS.style,
    motionOverride: o.motionOverride === true,
  }
}

export function writePrefs(p, storage) {
  const next = {
    fx:    FX_PRESETS[p && p.fx] ? p.fx : DEFAULT_PREFS.fx,
    pace:  PACE_PRESETS[p && p.pace] ? p.pace : DEFAULT_PREFS.pace,
    style: MOTION_STYLES[p && p.style] ? p.style : DEFAULT_PREFS.style,
    motionOverride: !!(p && p.motionOverride),
  }
  const s = storage === undefined ? defaultStorage() : storage
  if (s) { try { s.setItem(KEY, JSON.stringify(next)) } catch { /* โควตาเต็ม/private mode — ใช้ค่าใน memory ต่อไป */ } }
  return next
}

export function fxFlags(name) { return { ...(FX_PRESETS[name] || FX_PRESETS[DEFAULT_PREFS.fx]) } }
export function paceMult(name) { return PACE_PRESETS[name] ?? PACE_PRESETS.normal }
/** คืน object ท่าชน — ชื่อมั่ว/undefined ตกกลับแบบ default (ไม่คืน undefined เด็ดขาด ฝั่ง fx อ่านฟิลด์ตรงๆ) */
export function motionStyle(name) { return MOTION_STYLES[name] || MOTION_STYLES[DEFAULT_PREFS.style] }
