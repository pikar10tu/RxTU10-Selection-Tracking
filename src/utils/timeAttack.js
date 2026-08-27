/**
 * Time Attack — ตรรกะล้วน ไม่แตะ Firestore/Vue/DOM
 * นาฬิกา · สถิติดีสุด · กระดานอันดับในรุ่น
 *
 * spec: docs/superpowers/specs/2026-08-28-time-attack-design.md
 * เทส: node --test src/utils/timeAttack.test.js
 */

/**
 * โหมดที่เล่นได้ — `key` ใช้เป็นทั้งตัวเลือกกระดานและฟิลด์ `mode` ใน examSessions
 * `bestField` = คีย์ใน user doc `timeAttack.*` · `rowKey` = คีย์ในแถว roster
 */
export const TA_MODES = [
  { key: 'ta4',  minutes: 4,  ms: 4 * 60_000,  emoji: '⚡', label: '4 นาที',
    tagline: 'รอบเร็ว — ตอบให้ไวที่สุด',  bestField: 'best4',  rowKey: 'ta4'  },
  { key: 'ta15', minutes: 15, ms: 15 * 60_000, emoji: '🔥', label: '15 นาที',
    tagline: 'รอบยาว — วัดความอึด',       bestField: 'best15', rowKey: 'ta15' },
]

export const getTaMode = (key) => TA_MODES.find(m => m.key === key) || null

// ── ค่าคงที่จังหวะเกม ──
export const TA_BATCH = 25            // ดึงโจทย์ล็อตละกี่ข้อ (= reads ต่อล็อต)
export const TA_REFILL_AT = 8         // เหลือในคิวเท่านี้ → ยิงล็อตถัดไป (ไม่ block นาฬิกา)
export const TA_FLASH_MS = 400        // โชว์ไฟเขียว/แดงนานเท่าไหร่ก่อนไปข้อถัดไป
export const TA_TICK_MS = 200         // ถี่กว่า 1 วิ เพื่อให้เลขไม่กระตุกและจบไม่คลาดเกิน .2 วิ
export const TA_EMPTY_STREAK_MAX = 2  // ดึงแล้วไม่ได้ข้อใหม่ติดกันกี่ครั้งถึงถือว่าคลังหมดจริง

/** เวลาที่เหลือ (ms) — คำนวณจากเวลาปลายทางเสมอ ห้ามสะสมจาก tick */
export function remainingMs(endAt, now) {
  if (!endAt) return 0
  return Math.max(0, endAt - now)
}

/** ms → 'M:SS' (ปัดขึ้น — เหลือ 0.4 วิ ยังต้องเห็น 0:01) */
export function clockLabel(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** สถิติใหม่? — เท่าเดิมไม่นับ (กันป้าย "ทำลายสถิติ" เด้งทุกรอบที่ตัน) */
export function newBest(prev, score) {
  const p = Number(prev) || 0
  const s = Number(score) || 0
  return { best: Math.max(p, s), isNew: s > p }
}

/**
 * กระดานอันดับในรุ่น — จาก `rosterRows` ที่โหลดอยู่แล้ว ⇒ ไม่มี read เพิ่ม
 * @param rows   members.rosterRows ({ [uid]: row })
 *               ⚠️ ต้องเป็น rosterRows ไม่ใช่ rosterUsers — rosterUsers คีย์ด้วย studentId จึงตก guest ทั้งหมด
 * @param me     { uid, name, photo, best } ค่าสดจาก user doc (roster อาจยังไม่ทัน sync) หรือ null
 * @param rowKey 'ta4' | 'ta15'
 * @returns { top, mine } — mine มีค่าต่อเมื่อเราไม่ติด top (คนอันดับ 30 ต้องเห็นตัวเองด้วย)
 */
export function taBoard(rows, me, rowKey, max = 10) {
  const list = []
  for (const [uid, row] of Object.entries(rows || {})) {
    list.push({ uid, name: row?.n || '?', photo: row?.p || null, best: Number(row?.[rowKey]) || 0, isMe: false })
  }
  if (me?.uid) {
    const mineRow = list.find(r => r.uid === me.uid)
    const best = Math.max(Number(me.best) || 0, mineRow?.best || 0)
    if (mineRow) {
      mineRow.best = best
      mineRow.isMe = true
      mineRow.name = me.name || mineRow.name
    } else {
      list.push({ uid: me.uid, name: me.name || '?', photo: me.photo || null, best, isMe: true })
    }
  }
  const ranked = list
    .filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best || String(a.name).localeCompare(String(b.name), 'th'))
    .map((r, i) => ({ ...r, rank: i + 1 }))
  const top = ranked.slice(0, max)
  const mine = ranked.find(r => r.isMe) || null
  return { top, mine: mine && mine.rank > max ? mine : null }
}
