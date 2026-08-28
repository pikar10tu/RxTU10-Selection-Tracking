// battleMotion.js — คณิตของ keyframes การ์ดพุ่ง/การ์ดโดนชน แยกออกมาเป็น pure function
// เหตุผลที่ต้องแยก: battleFx.js อ่าน import.meta.env → node --test import ไม่ได้เลย
// ส่วนที่พังเงียบที่สุดของท่าชนคือ "ลำดับ offset" (WAAPI โยนทิ้งทั้งอนิเมชันถ้า offset ถอยหลัง
// = การ์ดนิ่งสนิททั้งไฟต์โดยไม่มี error ให้เห็นบนมือถือ) → ต้องมีเทสจับ ไม่ใช่ไล่อ่านเอา
//
// ⚠️ 28 ส.ค. 2026: เลิกใช้ท่าชนหลายแบบ (MOTION_STYLES A/B/C/D) และเลิกแยกท่าตามชั้น
//    user เทสจอจริงแล้วสั่งว่า "อยากให้การ์ดทุกอันขยับพอๆ กันในการโจมตีแต่ละที"
//    ของเดิมแบบ A ตั้ง chipReach: 0 ⇒ **41.8% ของหมัดทั้งไฟต์การ์ดไม่ขยับเลย**
//    ตอนนี้: ระยะพุ่ง (reach) และเวลาคงที่ทุกหมัด · weight ปรับได้แค่ "ความลึกของท่า"

/** ค่าปรับรสนิยมของท่าชน — อยู่ในบล็อกนี้บล็อกเดียว */
export const LUNGE = {
  reach: 0.72,          // สัดส่วนระยะที่พุ่งไปถึง (.72 = หยุดตรงจุดปะทะ เห็นการ์ดทั้งสองใบ ไม่ทับกัน)
  pullBase: 8,          // ถอยหลังตอนเงื้อ (px) ที่ weight = 0
  pullPerWeight: 10,    // บวกเพิ่มตาม weight → 8–18px
  scaleBase: 0.06,      // ยืด/บีบตอนพุ่งถึง ที่ weight = 0
  scalePerWeight: 0.06, // บวกเพิ่มตาม weight → 6–12%
  backMs: 200,          // เวลากลับเข้าที่หลังชน แล้วนิ่งรอ beat ถัดไป
  bounce: 5,            // px ที่เลยที่เดิมไปทางตรงข้ามนิดนึงก่อนเข้าที่ (แรงเฉื่อยหลังชน)
}

/** ตัวคูณความลึกของท่าตาม kind — ไม่แตะ reach (ระยะต้องเท่ากันทุกหมัด) */
export const DEPTH = { hit: 1, ko: 1.15, finish: 1.35 }

/** การ์ดเป้าบีบตัว/ถูกกระแทกถอย — แรงตาม weight เหมือนกัน */
export const SQUASH = { amtBase: 0.12, amtPerWeight: 0.26, recoilBase: 4, recoilPerWeight: 12 }

/** จอสั่น — เฉพาะโมเมนต์เท่านั้น หมัดปกติห้ามสั่นเด็ดขาด */
export const SHAKE = { ko: [4, 2], finish: [7, 3] }

const REST = 'translate(0,0) scale(1)'
const clamp01 = (v) => Math.max(0, Math.min(1, v || 0))

/** kind ไหนบ้างที่การ์ดผู้ตี "พุ่ง" — หมัดลูกไม่พุ่ง (มันอยู่ในหมัดหลักที่พุ่งอยู่แล้ว) */
export function lungesIn(kind) {
  return kind === 'hit' || kind === 'ko' || kind === 'finish'
}

/**
 * keyframes ของการ์ดผู้ตี — 1 animation ครอบ windup+motion+hitstop+tail ทั้งก้อน (ข้อบังคับ v3)
 * @param {string} kind    hit | ko | finish
 * @param {number} weight  0..1 ความดังของหมัด (คุมความลึกของท่าเท่านั้น ไม่คุมระยะ/เวลา)
 * @param {Object} timing  scaled timing ของ beat นี้ {windup, motion, hitstop, tail}
 * @param {Object} vec     เวกเตอร์จากผู้ตีไปเป้า {x, y} (px)
 * @returns {Array|null}   keyframes หรือ null = kind นี้ไม่ให้การ์ดขยับ
 */
export function lungeKeyframes(kind, weight, timing, vec) {
  if (!lungesIn(kind)) return null
  const t = timing || {}
  const total = (t.windup || 0) + (t.motion || 0) + (t.hitstop || 0) + (t.tail || 0)
  if (!(total > 0)) return null

  const w = clamp01(weight)
  const depth = DEPTH[kind] || 1
  const vx = (vec?.x || 0) * LUNGE.reach
  const vy = (vec?.y || 0) * LUNGE.reach
  const len = Math.hypot(vec?.x || 0, vec?.y || 0) || 1

  const pull = ((LUNGE.pullBase + LUNGE.pullPerWeight * w) * depth).toFixed(1)
  const amt = (LUNGE.scaleBase + LUNGE.scalePerWeight * w) * depth
  const hit = `translate(${vx.toFixed(1)}px, ${vy.toFixed(1)}px) scale(${(1 - amt).toFixed(3)}, ${(1 + amt).toFixed(3)})`

  const o1 = t.windup / total
  const o2 = (t.windup + t.motion) / total
  const o3 = (t.windup + t.motion + t.hitstop) / total

  const kf = [{ transform: REST, offset: 0 }]
  // windup 0 = ไม่มีเฟรมเงื้อ — ใส่ที่ offset 0 ซ้ำจะกลายเป็นกระตุกจากท่าถอยหลังทันทีที่เริ่ม
  if (o1 > 0) kf.push({ transform: `translate(0, ${pull}px) scale(${(1 + amt * 0.5).toFixed(3)}, ${(1 - amt * 0.6).toFixed(3)})`, offset: o1 })
  kf.push({ transform: hit, offset: o2 })
  // เฟรม o2→o3 ซ้ำท่าเดิม = การ์ดหยุดนิ่งช่วง hitstop โดยไม่ต้องแตกเป็น animation ที่สอง
  if (o3 > o2) kf.push({ transform: hit, offset: o3 })

  // กลับเข้าที่ให้จบเร็ว แล้วนิ่งรอ beat ถัดไป (ไม่ลอยกลับยาวตลอด tail แบบเดิม
  // ซึ่งทำให้การ์ดยังเคลื่อนอยู่ตอนหมัดถัดไปเริ่ม = อ่านเป็น "เนือย" ไม่ใช่ "ชน")
  const backMs = Math.min(LUNGE.backMs, t.tail || 0)
  const o4 = (t.windup + t.motion + t.hitstop + backMs) / total
  if (o4 < 0.985) {
    const bx = (-(vec?.x || 0) / len * LUNGE.bounce).toFixed(1)
    const by = (-(vec?.y || 0) / len * LUNGE.bounce).toFixed(1)
    kf.push({ transform: `translate(${bx}px, ${by}px) scale(1)`, offset: o4 })
  }
  kf.push({ transform: REST, offset: 1 })
  return kf
}

/** kind นี้ทำให้การ์ด "เป้า" มีปฏิกิริยามั้ย — ทุกหมัดที่กินเวลามีหมด (เดิม solid ไม่มีเลย) */
export function targetReactsIn(kind) {
  return lungesIn(kind)
}

/**
 * keyframes ของการ์ดเป้าตอนโดนชน: ถอยหลังตามแนวหมัด + บีบตัว แล้วดีดกลับ
 * @param {string} kind
 * @param {number} weight  แรงบีบ/แรงถอยไล่ตามความดังของหมัด
 * @param {Object} unit    เวกเตอร์หนึ่งหน่วยตามแนวหมัด {x, y} (null = ไม่ถอย บีบอย่างเดียว)
 */
export function squashKeyframes(kind, weight, unit) {
  if (!targetReactsIn(kind)) return null
  const w = clamp01(weight)
  const depth = DEPTH[kind] || 1
  const amt = (SQUASH.amtBase + SQUASH.amtPerWeight * w) * depth
  const push = (SQUASH.recoilBase + SQUASH.recoilPerWeight * w) * depth
  const kx = unit ? unit.x * push : 0
  const ky = unit ? unit.y * push : 0
  const at = (f) => `translate(${(kx * f).toFixed(1)}px, ${(ky * f).toFixed(1)}px)`
  return [
    { transform: 'translate(0,0) scale(1)' },
    { transform: `${at(1)} scale(${(1 + amt * 0.5).toFixed(3)}, ${(1 - amt).toFixed(3)})`, offset: .3 },
    { transform: `${at(.35)} scale(${(1 - amt * 0.3).toFixed(3)}, ${(1 + amt * 0.4).toFixed(3)})`, offset: .6 },
    { transform: 'translate(0,0) scale(1)' },
  ]
}

/** แรงสั่นจอของ kind นี้ — คืน null ถ้าไม่สั่น (หมัดปกติและหมัดลูก) */
export function shakeFor(kind) {
  return SHAKE[kind] || null
}
