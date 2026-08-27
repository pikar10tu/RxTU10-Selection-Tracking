// src/utils/seededRng.js
// seeded PRNG + string hash — pure, deterministic (ใช้ร่วม pvpBot + pvpMatch)
// mulberry32: ย้ายมาจาก pvpBot.rng เดิม (พฤติกรรมเดิมทุกประการ)
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a → uint32 · แปลง 'YYYY-MM-DD'+uid เป็น seed รายวันคงที่
export function hashStr(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
