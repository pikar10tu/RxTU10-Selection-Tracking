// loseTip — pure: แพ้แล้วชี้ทางไปต่อ 1 ทาง (ใช้ทั้งหอคอยและสนามประลอง)
// spec: docs/superpowers/specs/2026-08-31-pvp-daily-quest-design.md
// เทส: node --test src/utils/loseTip.test.js
import { PULL_COST } from './gacha.js'

const TEXT = {
  tower: 'ทีมยังสู้ชั้นนี้ไม่ไหว — ลองเสริมทีมก่อนไต่ต่อ',
  arena: 'อยากชนะบ้าง? ลองเสริมทีมก่อนบุกรอบหน้า',
}

/**
 * เลือกปุ่มเดียวตามสถานะจริงของคนนั้น — คนที่เหรียญไม่พอไม่ควรถูกส่งไปหน้าที่กดอะไรไม่ได้
 * @param {'tower'|'arena'} mode
 * @param {{coins?:number, freeGachaTickets?:number}} userData
 */
export function buildLoseTip(mode, userData) {
  const text = TEXT[mode]
  if (!text) return null
  const canPull = (userData?.freeGachaTickets || 0) > 0 || (userData?.coins || 0) >= PULL_COST
  return canPull
    ? { text, label: '🎰 อัญเชิญเพ็ท', to: '/shop' }
    : { text, label: '🐾 อัพเกรดเพ็ท', to: '/play/pets' }
}
