// src/utils/pvpMatch.js
// PvP matchmaking — pure: คัดย่านเรตใกล้แล้วสุ่ม (seeded รายวัน) · บอทเติมใน useArena
// รับ candidate ที่ rosterOpponents() กรองมาแล้ว (ไม่มีตัวเอง · มีทีม · มี rating)
import { mulberry32 } from './seededRng.js'

export const HUMAN_POOL  = 5    // จำนวนคนจริงในพูล
export const NEAR_WINDOW = 12   // เอาคนเรตใกล้สุด N คนเป็น "ย่านใกล้" ก่อนสุ่ม

/** สุ่มคนจริง n คนในย่านเรตใกล้ myRating (seeded → นิ่งต่อ seed เดียวกัน) */
export function pickHumanOpponents(candidates, myRating, seed = 0, n = HUMAN_POOL, window = NEAR_WINDOW) {
  // copy ก่อน sort — candidates มาจาก computed ของ store ห้าม mutate
  const near = [...(candidates || [])]
    .sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating))
    .slice(0, Math.max(window, n))
  // seeded Fisher-Yates shuffle ย่านใกล้ แล้วเอา n ตัวแรก
  const rand = mulberry32(seed >>> 0)
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = near[i]; near[i] = near[j]; near[j] = tmp
  }
  return near.slice(0, n)
}
