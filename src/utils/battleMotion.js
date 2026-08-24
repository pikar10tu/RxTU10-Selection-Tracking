// battleMotion.js — คณิตของ keyframes การ์ดพุ่ง/การ์ดโดนชน แยกออกมาเป็น pure function
// เหตุผลที่ต้องแยก: battleFx.js อ่าน import.meta.env → node --test import ไม่ได้เลย
// ส่วนที่พังเงียบที่สุดของท่าชนคือ "ลำดับ offset" (WAAPI โยนทิ้งทั้งอนิเมชันถ้า offset ถอยหลัง
// = การ์ดนิ่งสนิททั้งไฟต์โดยไม่มี error ให้เห็นบนมือถือ) → ต้องมีเทสจับ ไม่ใช่ไล่อ่านเอา
import { motionStyle } from './battleReplayPrefs.js'

/** ท่าต่อชั้น: pull = ถอยหลังกี่ px · psx/psy = สเกลตอนย่อ · sx/sy = สเกลตอนพุ่งถึง (ยืดตามทิศ) */
export const LUNGE_POSE = {
  chip:   { pull: 4,  psx: 1.02, psy: 0.97, sx: 0.97, sy: 1.05 },   // ใช้เมื่อ style.chipReach > 0 เท่านั้น
  solid:  { pull: 14, psx: 1.06, psy: 0.90, sx: 0.90, sy: 1.18 },
  heavy:  { pull: 24, psx: 1.12, psy: 0.94, sx: 0.82, sy: 1.30 },
  finish: { pull: 28, psx: 1.16, psy: 0.92, sx: 0.80, sy: 1.34 },
}

/** เวลาที่ใช้ "กลับเข้าที่" ต่อแบบ — 'tail' = ใช้ tail ทั้งก้อน (ลอยกลับยาวแบบเดิม) */
const BACK_MS = { snap: 220, fast: 130 }

const REST = 'translate(0,0) scale(1)'

/**
 * keyframes ของการ์ดผู้ตี — 1 animation ครอบ windup+motion+hitstop+tail ทั้งก้อน (ข้อบังคับ v3)
 * @param {string} styleName ชื่อท่าชน (A/B/C/D)
 * @param {string} tier      chip | solid | heavy | finish
 * @param {Object} timing    scaled timing ของ beat นี้ {windup, motion, hitstop, tail}
 * @param {Object} vec       เวกเตอร์จากผู้ตีไปเป้า {x, y} (px)
 * @returns {Array|null}     keyframes หรือ null = แบบนี้ไม่ให้ชั้นนี้ขยับการ์ด
 */
export function lungeKeyframes(styleName, tier, timing, vec) {
  const style = motionStyle(styleName)
  const P = LUNGE_POSE[tier]
  if (!P) return null
  // ชั้นถากขยับเฉพาะแบบที่สั่งไว้ — แบบ A ไม่ขยับการ์ดเลย (ของเดิม 55% ของหมัดจึงนิ่งสนิท)
  const reach = tier === 'chip' ? style.chipReach : style.reach
  if (!(reach > 0)) return null
  const total = timing.windup + timing.motion + timing.hitstop + timing.tail
  if (!(total > 0)) return null

  const vx = vec.x, vy = vec.y
  const len = Math.hypot(vx, vy) || 1
  const dx = (vx * reach).toFixed(1), dy = (vy * reach).toFixed(1)
  const pull = (P.pull * (tier === 'chip' ? 1 : style.pull)).toFixed(1)
  // เอียงเข้าหาเป้า: เครื่องหมายตามทิศแนวนอน (ตีไปทางขวา = เอียงขวา) ไม่งั้นดูเหมือนสะบัดผิดทาง
  const tilt = style.spin ? ` rotate(${(vx >= 0 ? style.spin : -style.spin).toFixed(1)}deg)` : ''
  const hit = `translate(${dx}px, ${dy}px) scale(${P.sx}, ${P.sy})${tilt}`

  const o1 = timing.windup / total
  const o2 = (timing.windup + timing.motion) / total
  const o3 = (timing.windup + timing.motion + timing.hitstop) / total

  const kf = [{ transform: REST, offset: 0 }]
  // windup 0 (ชั้นถาก) = ไม่มีเฟรมเงื้อ — ใส่ที่ offset 0 ซ้ำจะกลายเป็นกระตุกจากท่าถอยหลังทันทีที่เริ่ม
  if (o1 > 0) kf.push({ transform: `translate(0, ${pull}px) scale(${P.psx}, ${P.psy})`, offset: o1 })
  kf.push({ transform: hit, offset: o2 })
  // เฟรม o2→o3 ซ้ำท่าเดิม = การ์ดหยุดนิ่งช่วง hitstop โดยไม่ต้องแตกเป็น animation ที่สอง
  if (o3 > o2) kf.push({ transform: hit, offset: o3 })

  // จังหวะกลับ: 'tail' ลอยกลับยาวตลอด tail (เดิม) · 'snap'/'fast' กลับให้จบเร็วแล้วนิ่งรอ beat ถัดไป
  const backMs = style.back === 'tail' ? timing.tail : Math.min(BACK_MS[style.back] ?? 220, timing.tail)
  const o4 = (timing.windup + timing.motion + timing.hitstop + backMs) / total
  if (o4 < 0.985) {
    if (style.bounce > 0) {
      // เลยที่เดิมไปทางตรงข้ามนิดนึงก่อนเข้าที่ = แรงเฉื่อยหลังชน (ตัวที่ทำให้ "ชน" ต่างจาก "เลื่อนกลับ")
      const bx = (-vx / len * style.bounce).toFixed(1), by = (-vy / len * style.bounce).toFixed(1)
      kf.push({ transform: `translate(${bx}px, ${by}px) scale(1)`, offset: o4 })
    } else {
      kf.push({ transform: REST, offset: o4 })     // ถึงที่แล้วนิ่งสนิทจนจบ beat
    }
  }
  kf.push({ transform: REST, offset: 1 })
  return kf
}

/** ชั้นนี้ทำให้การ์ด "เป้า" มีปฏิกิริยามั้ยภายใต้ท่าชนนี้ (ยังต้องผ่าน flag targetSquash ของ preset ภาพอีกชั้น) */
export function targetReactsIn(styleName, tier) {
  const s = motionStyle(styleName)
  return (s.squash?.[tier] > 0) || (s.recoil?.[tier] > 0)
}

/**
 * keyframes ของการ์ดเป้าตอนโดนชน: ถอยหลังตามแนวหมัด + บีบตัว แล้วดีดกลับ
 * @param {Object} unit เวกเตอร์หนึ่งหน่วยตามแนวหมัด {x, y} (null/ศูนย์ = ไม่ถอย บีบอย่างเดียว)
 */
export function squashKeyframes(styleName, tier, unit) {
  const style = motionStyle(styleName)
  const amt = style.squash?.[tier] || 0
  const push = style.recoil?.[tier] || 0
  if (!(amt > 0) && !(push > 0)) return null
  const kx = push > 0 && unit ? unit.x * push : 0
  const ky = push > 0 && unit ? unit.y * push : 0
  const at = (f) => `translate(${(kx * f).toFixed(1)}px, ${(ky * f).toFixed(1)}px)`
  return [
    { transform: 'translate(0,0) scale(1)' },
    { transform: `${at(1)} scale(${(1 + amt * 0.5).toFixed(3)}, ${(1 - amt).toFixed(3)})`, offset: .3 },
    { transform: `${at(.35)} scale(${(1 - amt * 0.3).toFixed(3)}, ${(1 + amt * 0.4).toFixed(3)})`, offset: .6 },
    { transform: 'translate(0,0) scale(1)' },
  ]
}
