// src/data/expeditions.js
// Expedition (ส่งผจญภัย) — ค่าคงที่เกม + มิชชัน + reward table (ปรับเลขที่นี่ที่เดียว)
// เลขจูนผ่าน sim แล้ว (scripts/expedition-sim.mjs · 27 มิ.ย. 2026):
// floor ต่ำพอไม่ทับรายได้บ้านต้นเกม · คุณภาพสายดันรายได้ขึ้นชัด (POWER_K สูง) ·
// เพดานปลายเกม (สายสุด) ~10–11% ของบ้าน Lv12/วัน · ตั๋วปลายเกม ~1/วัน

// ระยะเวลา 3 ระดับ (ผู้เล่นเลือก) · hours = ระยะเวลาจริง · ยาว = คุ้มกว่าต่อรอบ แต่รอนาน
export const DURATIONS = [
  { id: 'short',  label: 'สั้น',  hours: 1, baseCoins: 40,  coinCap: 250,  ticketChance: 0.02 },
  { id: 'medium', label: 'กลาง', hours: 4, baseCoins: 150, coinCap: 1100, ticketChance: 0.06 },
  { id: 'long',   label: 'ยาว',  hours: 8, baseCoins: 320, coinCap: 3000, ticketChance: 0.10 },
]

// มิชชันคงที่ — ครอบ 3 ธาตุ เพื่อให้เลือก element-match ได้เสมอ · ส่งตัวธาตุตรง = โบนัส
export const MISSIONS = [
  { id: 'forest', name: 'ป่าลึกลับ',      element: 'fist',     emoji: '🌲', flavor: 'บุกป่าหาสมุนไพรหายาก' },
  { id: 'ruins',  name: 'ซากปรักหักพัง', element: 'scissors', emoji: '🏚️', flavor: 'ค้นซากเมืองเก่าหาของมีค่า' },
  { id: 'peak',   name: 'ยอดเขาเมฆา',    element: 'paper',    emoji: '⛰️', flavor: 'ปีนเขาสูงเก็บผลึกพลัง' },
]

// น้ำหนักคุณภาพ (rarity+เกรด) ย้ายไป data/petPower.js (แหล่งพลังเดียว) — re-export ชื่อเดิม
export { RARITY_WEIGHT, EXP_GRADE_K as GRADE_K } from './petPower.js'
export const POWER_K = 0.18        // partyPower → ตัวคูณเหรียญ (สูง = คุณภาพสายมีผลชัด)
export const ELEMENT_K = 0.12      // ต่อ 1 ตัวที่ธาตุตรง → +12% (โบนัสเสริม ไม่ครอบงำ)
export const TICKET_POWER_K = 0.006 // partyPower → +โอกาสตั๋ว (ต่ำ = กันเพดานตั๋ว whale + เลี่ยง short-spam)
export const TICKET_EL_K = 0.05     // โบนัสธาตุ → +โอกาสตั๋ว
export const TICKET_CHANCE_MAX = 0.9

// reward table — extensible: เพิ่มชนิดใหม่ = เพิ่ม entry (field = field ใน user doc ที่จะ increment)
export const REWARD_TYPES = {
  coins:       { label: 'เหรียญ',   emoji: '🪙', field: 'coins' },
  gachaTicket: { label: 'ตั๋วอัญเชิญ', emoji: '🎟️', field: 'freeGachaTickets' },
}

export const EXPEDITION_PARTY_SIZE = 3
