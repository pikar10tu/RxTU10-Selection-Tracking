// dailyQuest — pure: เควสต์รายวัน (reset แบบ write-time, ไม่ต้อง cron)
// spec: docs/superpowers/specs/2026-08-31-pvp-daily-quest-design.md
// เทส: node --test src/utils/dailyQuest.test.js

// ⚠️ เป้าช่องที่ 3 ไม่ตายตัว — ขึ้นกับว่าสนามประลองเปิดอยู่ไหม (`pvpOpen` แอดมิน toggle ได้สดๆ)
//    ถ้าเป้าเป็น pvp ตายตัวแล้วแอดมินปิดสนาม = ทั้งชั้นปีทำเควสไม่ครบ ไม่ได้บัฟจนกว่าจะมีคนสังเกต
//    ดีฟอลต์ pvpOpen = false ทุกที่ (เท่ากับพฤติกรรมเดิม) ⇒ caller ที่ลืมส่งไม่ทำให้เควสทำไม่ได้
export function questGoals(pvpOpen = false) {
  return pvpOpen
    ? { quiz: 5, farm: 3, pvp: 1 }
    : { quiz: 5, farm: 3, gacha: 2 }
}

export const BUFF_MS = 24 * 60 * 60 * 1000
export const QUEST_TICKETS = 10   // ตั๋วกาชาฟรีที่ได้เมื่อรับรางวัลเควส (3 → 10 เมื่อ 31 ส.ค. ให้รางวัลรู้สึกคุ้ม)

// นับ gacha ต่อไปแม้ pvpOpen เปิด (ShopView ยัง bump อยู่) — แอดมินสลับ flag กลางวันได้
// ตัวนับที่ยังเดินอยู่แปลว่าสลับแล้วความคืบหน้าของคนที่ทำไปแล้วไม่หาย
const fresh = (today) => ({ date: today, quiz: 0, farm: 0, gacha: 0, pvp: 0, claimed: false })

// คืน object ใหม่: ถ้าข้ามวัน รีเซ็ตก่อน แล้ว +n ที่ field
export function bumpDailyQuest(dq, field, today, n = 1) {
  const base = (dq && dq.date === today)
    ? {
        date: dq.date, quiz: dq.quiz || 0, farm: dq.farm || 0,
        gacha: dq.gacha || 0, pvp: dq.pvp || 0, claimed: !!dq.claimed,
      }
    : fresh(today)
  base[field] = (base[field] || 0) + n
  return base
}

export function questComplete(dq, today, pvpOpen = false) {
  if (!dq || dq.date !== today) return false
  const goals = questGoals(pvpOpen)
  return Object.keys(goals).every(k => (dq[k] || 0) >= goals[k])
}

export function questClaimable(dq, today, pvpOpen = false) {
  return questComplete(dq, today, pvpOpen) && !dq.claimed
}

// true = วันนี้ยังไม่กดรับรางวัลเควส (ใช้ขับจุดแดงบนปุ่ม header) — ไม่เกี่ยวกับเป้า จึงไม่ต้องรู้ pvpOpen
export function questNotClaimed(dq, today) {
  return !(dq && dq.date === today && dq.claimed)
}

export function questIncomeMult(userData, now) {
  const until = userData?.incomeBuffUntil
  return (until && now < until) ? 1.5 : 1
}
