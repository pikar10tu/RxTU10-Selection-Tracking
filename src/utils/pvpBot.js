// src/utils/pvpBot.js
// PvP bot — pure: หุ่นซ้อมในพูลคู่ต่อสู้ · สเกลตามเรต · deterministic จาก seed (แนวเดียว getFloorTeam)
import { PETS } from '../data/index.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { mulberry32 } from './seededRng.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'

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

export const BOT_RATING_SPREAD = 300   // ระยะเรตบอทอ่อน/แกร่งจากผู้เล่น (tunable — พลังบอทคงสูตรเดิม)

/**
 * บอท 2 ตัวในพูล: อ่อน (เรต − spread, ไม่ต่ำกว่า floor) + แกร่ง (เรต + spread)
 * seed ต่างกัน (xor const) กันทีมสองตัวซ้ำกัน — getPvpBot ใช้ seed เลือกธาตุตรงๆ ด้วย
 * ไม่ใช่แค่ผ่าน rand() ⇒ xor เปลี่ยนทั้งธาตุและตัวเพ็ท · uid ต่างกัน = key v-for ไม่ชน
 */
export function getPvpBots(rating, seed) {
  const s = seed >>> 0
  const easy = { ...getPvpBot(Math.max(PVP_RATING_FLOOR, rating - BOT_RATING_SPREAD), s),
                 uid: 'bot-easy', label: 'อ่อน' }
  const hard = { ...getPvpBot(rating + BOT_RATING_SPREAD, (s ^ 0x9e3779b9) >>> 0),
                 uid: 'bot-hard', label: 'แกร่ง' }
  return [easy, hard]
}
