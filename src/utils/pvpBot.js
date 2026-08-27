// src/utils/pvpBot.js
// PvP bot — pure: หุ่นซ้อมที่ "เติมช่องว่าง" บนกระดานเมื่อคนจริงไม่ครบ
// deterministic จาก seed (แนวเดียว getFloorTeam)
//
// ⚠️ ของเดิมสเกลบอทตาม "เรต" ทั้งที่ความแกร่งจริงมาจาก "เพ็ท" — วัดจริง 200 ไฟต์/ช่องแล้ว
//    ได้ 0% หรือ 100% แทบทุกช่อง คือปุ่มเหรียญฟรีกับกำแพง ไม่ใช่ตัวเลือกความยาก
//    ของใหม่เล็งที่ teamPower ของผู้เล่นโดยตรง
import { PETS } from '../data/index.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { RARITY_ORDER, MAX_GRADE } from '../data/petPower.js'
import { mulberry32 } from './seededRng.js'
import { teamPower } from './pvpCoins.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'

const ELS = ['fist', 'scissors', 'paper']

// อัตราส่วนพลังของบอทเทียบกับทีมผู้เล่น เรียงตามลำดับที่อยากให้โผล่ก่อน
export const BOT_POWER_RATIOS = [0.75, 1.15, 0.9, 1.3, 1.0]

// ป้ายผูกกับอัตราส่วนแบบหนึ่งต่อหนึ่ง — ห้ามคำนวณจากช่วงค่า เพราะ 0.75 กับ 0.9
// จะตกช่วงเดียวกันแล้วได้ป้าย "อ่อน" ซ้ำ ⇒ บนกระดานจะมี "หุ่นซ้อม · อ่อน" สองใบที่แยกไม่ออก
const BOT_LABELS = ['อ่อน', 'แกร่ง', 'อ่อนนิดหน่อย', 'แกร่งมาก', 'พอกัน']

/** ทีมหุ่นซ้อมที่ความหายาก/เกรดกำหนด · ธาตุผสมจาก seed */
export function botTeamOf(rarity, grade, seed) {
  const rand = mulberry32((seed >>> 0) || 1)
  const team = []
  for (let i = 0; i < BATTLE_SLOTS; i++) {
    const element = ELS[((seed >>> 0) + i) % 3]
    const pool = PETS.filter(p => p.rarity === rarity && p.element === element)
    const fallback = PETS.filter(p => p.element === element)
    const src = pool.length ? pool : fallback
    const def = src[Math.floor(rand() * src.length)]
    team.push({ id: def.id, rarity: def.rarity, element: def.element, grade })
  }
  return team
}

/** ทีมที่พลังใกล้ targetPower ที่สุด — ไล่กริด (ความหายาก × เกรด) = 24 แบบ */
export function botTeamForPower(targetPower, seed) {
  let bestTeam = null
  let bestDiff = Infinity
  for (const rarity of RARITY_ORDER) {
    for (let grade = 0; grade <= MAX_GRADE; grade++) {
      const team = botTeamOf(rarity, grade, seed)
      const diff = Math.abs(teamPower(team) - targetPower)
      if (diff < bestDiff) { bestDiff = diff; bestTeam = team }
    }
  }
  return bestTeam
}

/**
 * บอทเติมช่องว่างบนกระดาน — เล็งพลังจากทีมผู้เล่น ไม่ใช่จากเรต
 * count = จำนวนช่องที่คนจริงเติมไม่ครบ (ปกติชั้นปีมีคนเกิน 5 คน ⇒ 0 = ไม่เห็นบอทเลย)
 */
export function getFallbackBots(myPower, myRating, seed, count) {
  const n = Math.max(0, Math.min(count, BOT_POWER_RATIOS.length))
  const out = []
  for (let i = 0; i < n; i++) {
    const ratio = BOT_POWER_RATIOS[i]
    // seed ต่างกันต่อตัว กันบอทสองตัวได้ทีมซ้ำกัน
    const s = ((seed >>> 0) ^ Math.imul(0x9e3779b9, i + 1)) >>> 0
    out.push({
      uid: `bot-${i}`,
      name: 'หุ่นซ้อม',
      label: BOT_LABELS[i],
      isBot: true,
      rating: Math.max(PVP_RATING_FLOOR, Math.round(myRating * ratio)),
      team: botTeamForPower(myPower * ratio, s),
    })
  }
  return out
}
