// petGrade — pure: ค่าอัพเกรดเพ็ท (เกรด 0-5, อัพ 1 ขั้นใช้ 1 copy + เหรียญ)
export { MAX_GRADE } from '../data/petPower.js'
import { MAX_GRADE } from '../data/petPower.js'
// เหรียญต่อการอัพ 1 ขั้น = base[rarity] × เกรดเป้า (draft pin, tunable)
const RARITY_GRADE_COIN = { common: 200, rare: 600, epic: 1500, legendary: 4000 }

export function gradeUpCost(pet) {
  const g = pet?.grade || 0
  if (g >= MAX_GRADE) return null
  const target = g + 1
  const base = RARITY_GRADE_COIN[pet?.rarity] ?? RARITY_GRADE_COIN.common
  return { copies: 1, coins: base * target }
}

export function canUpgrade(pet, ownedCoins) {
  const cost = gradeUpCost(pet)
  if (!cost) return false
  return (pet.copies || 0) >= cost.copies && (ownedCoins || 0) >= cost.coins
}

/**
 * ทำไมอัพไม่ได้ — `null` = อัพได้
 *
 * มีไว้เพราะปุ่ม "วิวัฒน์" เป็นปุ่มเทาเฉยๆ เมื่ออัพไม่ได้ และ `:disabled` ทำให้กดไม่ติด
 * ⇒ toast "ตัวซ้ำหรือเหรียญไม่พอ" ใน evolve() ไม่มีทางถูกเรียกจากหน้าจอเลย
 * ผู้เล่นเห็นแค่ "มี 11 ตัวซ้ำ" กับปุ่มที่กดไม่ได้ = เข้าใจว่าระบบพัง
 * (เพื่อนแจ้งจริง 31 ส.ค. 2026 "มีตัวซ้ำ 11 ตัวแต่อัพไม่ได้ เป็นหลายตัวเลย" — ตัวจริงคือเหรียญไม่พอ
 *  ซึ่งเจอง่ายมากเพราะกาชา 1,000 เหรียญ/ครั้ง ⇒ คนที่ปั่นจนได้ตัวซ้ำเยอะ = เหรียญหมดพอดี)
 *
 * ⚠️ ต้องตรงกับ canUpgrade() เสมอ — มีเทสไล่ทุกคู่คุมไว้
 */
export function upgradeBlock(pet, ownedCoins) {
  const cost = gradeUpCost(pet)
  if (!cost) return { reason: 'maxed' }
  const copiesShort = Math.max(0, cost.copies - (pet?.copies || 0))
  const coinsShort  = Math.max(0, cost.coins  - (ownedCoins || 0))
  if (!copiesShort && !coinsShort) return null
  return { reason: 'short', copiesShort, coinsShort }
}
