// src/utils/pvpBot.js
// PvP bot — pure: หุ่นซ้อมในพูลคู่ต่อสู้ · สเกลตามเรต · deterministic จาก seed (แนวเดียว getFloorTeam)
import { PETS } from '../data/index.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { mulberry32 } from './seededRng.js'

const RARITY_BY_TIER = ['common', 'rare', 'epic', 'legendary']
const ELS = ['fist', 'scissors', 'paper']

/** เรต → เกรด/ความหายากคร่าวๆ (เรต ~800 = อ่อน, ~2000 = แกร่งสุด) */
export function botPowerFor(rating) {
  const t = Math.max(0, Math.min(1, (rating - 800) / 1200))
  const grade = Math.round(t * 5)
  const tier = Math.min(3, Math.floor(t * 4))
  return { grade, rarity: RARITY_BY_TIER[tier] }
}

/** หุ่นซ้อม 3 ตัว สเกลตามเรต + ธาตุผสม · เรตบอท = เรตผู้เล่น (จับคู่สูสี) */
export function getPvpBot(rating, seed) {
  const rand = mulberry32((seed >>> 0) || 1)
  const { grade, rarity } = botPowerFor(rating)
  const team = []
  for (let i = 0; i < BATTLE_SLOTS; i++) {
    const element = ELS[((seed >>> 0) + i) % 3]
    const pool = PETS.filter(p => p.rarity === rarity && p.element === element)
    const fallback = PETS.filter(p => p.element === element)
    const src = pool.length ? pool : fallback
    const def = src[Math.floor(rand() * src.length)]
    team.push({ id: def.id, rarity: def.rarity, element: def.element, grade })
  }
  return { uid: 'bot', name: 'หุ่นซ้อม', isBot: true, rating, team }
}
