/**
 * ฟีดกระดานข่าว — ตรรกะล้วน ไม่แตะ Firestore/Vue
 *
 * สองเลน: (1) `ev` ในแถว roster ของเจ้าตัว = ข่าวไหลเร็ว เกาะไปกับ write ที่เกิดอยู่แล้ว
 *          (2) collection `news` = ข่าว "ครั้งแรก/ที่หนึ่งของรุ่น" ที่ควรอยู่ยาว
 *
 * เก็บแค่รหัส+ตัวเลข ไม่เก็บข้อความไทย ⇒ แก้สำนวนทีหลังได้โดยไม่ต้องย้อนแก้ข้อมูล
 * ชื่อคนก็ไม่เก็บ — ดึงจาก rows[uid].n ตอนอ่าน ⇒ เปลี่ยนชื่อเล่นแล้วข่าวเก่าเปลี่ยนตาม
 *
 * spec: docs/superpowers/specs/2026-08-28-news-board-live-design.md
 * เทส: node --test src/utils/newsFeed.test.js
 */
import { MINIGAMES } from '../data/minigames.js'
import { TA_MODES } from './timeAttack.js'
import { RESIDENCE_TIERS } from '../data/residence.js'

/** เก็บกี่ข่าวต่อคน — ⚠️ เพิ่มแล้วต้องคำนวณขนาด doc ใหม่ (3×~30B×105คน ≈ 9.5KB จากลิมิต 1MB) */
export const EVENT_MAX = 3
/** กี่บรรทัดบนกระดาน */
export const FEED_MAX = 10
/** กันคนเดียวยึดกระดาน — เก็บ 3 แต่โชว์ได้ 2 */
export const PER_USER_MAX = 2
/** ข่าวเลน roster เก่ากว่านี้ = ไม่โชว์ (ev ไม่มีวันหมดอายุเอง คนเลิกเล่นจะค้างหัวกระดานถาวร) */
export const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000

const gameName = (key) => MINIGAMES.find(g => g.key === key)?.name || 'มินิเกม'
const taLabel  = (key) => TA_MODES.find(m => m.key === key)?.label || 'Time Attack'
const GRADE_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

/** ชื่อขั้นบ้านจากเลเวล — ห้ามใช้ getTier() ที่นี่เพราะมัน clamp (เลเวล 0 จะกลายเป็นขั้น 1) */
const tierName = (level) => RESIDENCE_TIERS[Number(level) - 1]?.tierName || ''
/** ข่าวย้ายบ้าน: บอกชื่อขั้นเก่า→ใหม่ · ขั้นเก่าไม่มี (เลเวล 1 = คนใหม่) ก็เป็นข่าวต้อนรับแทน */
function houseText(who, e) {
  const to = tierName(e.v)
  if (!to) return `${who} อัปเกรดบ้านเป็นเลเวล ${e.v}`   // เลเวลใหม่เกินทะเบียน — กันข่าวหาย
  const from = tierName(Number(e.v) - 1)
  return from
    ? `${who} ได้ย้ายจาก ${from} ไปอยู่ ${to} ยินดีด้วย`
    : `${who} ได้เข้าสู่ระบบ ยินดีต้อนรับ`
}

/**
 * ทะเบียนชนิดข่าว — เพิ่มชนิดใหม่ที่นี่ที่เดียว
 * text(who, e) : who = ชื่อที่ขึ้นต้นประโยค ('คุณ' ถ้าเป็นตัวเอง) · e = { k, v, g?, t }
 * สำนวนตาม docs/voice-guide.md — เรียบๆ ไม่หวือหวา
 */
const KINDS = {
  tw: { icon: '🏰', text: (who, e) => `${who} ไต่หอคอยถึงชั้น ${e.v}` },
  pg: { icon: '🐾', text: (who, e) => `${who} อัปเกรดเพ็ทถึงเกรด ${GRADE_ROMAN[e.v] || e.v}` },
  qz: { icon: '📚', text: (who, e) => `${who} ตอบควิซถูกรวด ${e.v} ข้อ` },
  mg: { icon: '🎮', text: (who, e) => `${who} ทำคะแนน ${gameName(e.g)} ขึ้นอันดับ ${e.v} ของรุ่น` },
  ta: { icon: '⏱️', text: (who, e) => `${who} ทำสถิติ Time Attack ${taLabel(e.g)} ขึ้นอันดับ ${e.v} ของรุ่น` },
  hs: { icon: '🏠', text: houseText },
  fo: { icon: '🌾', text: (who, e) => `${who} ส่งออเดอร์ฟาร์มชิ้นใหญ่ ได้ ${(Number(e.v) || 0).toLocaleString()} เหรียญ` },
  pv: { icon: '⚔️', text: (who, e) => `${who} ขึ้นอันดับ ${e.v} ของสนามประลอง` },
}

/** ต่อข่าวใหม่ไว้หน้าสุด แล้วตัดท้ายให้เหลือ EVENT_MAX — คู่แฝดของ pushHistory */
export function pushEvent(list, ev) {
  const prev = Array.isArray(list) ? list : []
  if (!ev || !ev.k || !KINDS[ev.k]) return prev      // ข่าวเสีย = ไม่แตะของเดิม
  return [ev, ...prev].slice(0, EVENT_MAX)
}

/**
 * อันดับของ "คะแนนนี้" ในรุ่น (1-based) — นับเฉพาะคนอื่นที่ทำได้สูงกว่า
 * ใช้คะแนนที่เพิ่งทำได้เป็นตัวตั้ง ไม่ใช่ค่าในแถวตัวเอง เพราะแถวตัวเองยังไม่ถูกเขียน ณ จุดที่เรียก
 */
export function rankOfScore(rows, myUid, pick, score) {
  const mine = Number(score) || 0
  let better = 0
  for (const [uid, row] of Object.entries(rows || {})) {
    if (uid === myUid) continue
    if ((Number(pick(row)) || 0) > mine) better++
  }
  return better + 1
}

const tsToMs = (ts) => {
  if (!ts) return 0
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  return Number(ts) || 0
}

/**
 * รวมสองเลนเป็นฟีดเดียว
 * @param rows      members.rosterRows ({ [uid]: row })
 *                  ⚠️ ต้องเป็น rosterRows ไม่ใช่ rosterUsers — rosterUsers คีย์ด้วย studentId จึงตก guest ทั้งหมด
 * @param newsDocs  doc จาก collection news ([{ id, msg, icon, uid, ts }])
 */
export function buildFeed(rows, newsDocs, { now = Date.now(), myUid = null } = {}) {
  const items = []

  for (const [uid, row] of Object.entries(rows || {})) {
    const evs = Array.isArray(row?.ev) ? row.ev : []
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i]
      const def = KINDS[e?.k]
      if (!def) continue                                   // ชนิดจากเวอร์ชันใหม่กว่า = ข้ามเงียบ ห้าม throw
      const t = Number(e.t) || 0
      if (!t || now - t > EVENT_TTL_MS) continue
      const who = uid === myUid ? 'คุณ' : (row?.n || '?')
      items.push({ id: `${uid}:${i}:${t}`, uid, icon: def.icon, text: def.text(who, e), t })
    }
  }

  // เลน news ไม่ตัดอายุ — ตั้งใจให้อยู่ยาว และทำให้กระดานไม่มีทางว่างแม้ไม่มีใครเล่นมาหลายวัน
  for (const d of newsDocs || []) {
    if (!d?.msg) continue
    items.push({ id: `news:${d.id}`, uid: d.uid || null, icon: d.icon || '📢', text: d.msg, t: tsToMs(d.ts) })
  }

  items.sort((a, b) => b.t - a.t)

  const perUser = {}
  const out = []
  for (const it of items) {
    if (it.uid) {
      const n = (perUser[it.uid] || 0) + 1
      if (n > PER_USER_MAX) continue
      perUser[it.uid] = n
    }
    out.push(it)
    if (out.length >= FEED_MAX) break
  }
  return out
}

/** "12 นาทีที่แล้ว" — ข่าวไหลเร็ว คนอ่านต้องรู้ว่าสดแค่ไหน ไม่ใช่วันที่เต็ม */
export function timeAgo(t, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - (Number(t) || 0)) / 1000))
  if (s < 60) return 'เมื่อกี้'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}
