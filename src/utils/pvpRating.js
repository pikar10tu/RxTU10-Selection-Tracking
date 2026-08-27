// PvP core — pure: ค่าคงที่ + ระบบเรต (Elo-ish) · ฉีดค่าได้ทุกฟังก์ชัน
export const PVP_RATING_START = 1000   // แต้มประลองเริ่มต้น
export const PVP_RATING_FLOOR = 100    // แต้มต่ำสุด (กันติดลบ)
export const PVP_K = 32                // ความไวของเรต
export const BOT_RATING_MULT = 0.5     // บอทให้แต้มครึ่งของคนจริง
export const PVP_DAILY_ATTACKS = 5     // โควต้าบุก/วัน (รวมคน+บอท)

/** โอกาสชนะคาดหวังของ my ต่อ opp (Elo) */
export function expectedScore(my, opp) {
  return 1 / (1 + Math.pow(10, (opp - my) / 400))
}

/** เรตใหม่หลังสู้ · mult=1 คนจริง, 0.5 บอท · clamp ≥ floor */
export function nextRating(my, opp, won, { K = PVP_K, mult = 1 } = {}) {
  const delta = mult * K * ((won ? 1 : 0) - expectedScore(my, opp))
  return Math.max(PVP_RATING_FLOOR, Math.round(my + delta))
}
