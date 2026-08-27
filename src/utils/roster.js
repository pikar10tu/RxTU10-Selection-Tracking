/**
 * `config/roster` — doc สรุปรวมของทั้งรุ่น เพื่อให้ทุกจออ่าน 1 read
 * แทนการ getDocs(collection(db,'users')) ซึ่งเป็น N reads ต่อคน → N² ต่อรอบ
 *
 * โครง: { rows: { [uid]: row }, updatedAt }
 * row  = { s,n,t,l,p,g,tb,r,m,tm } — คีย์ย่อเพราะทุกคนอ่าน doc นี้ทุกเซสชัน
 *
 * ตรรกะล้วน ไม่แตะ Firestore/Vue — เทส `node --test src/utils/roster.test.js`
 * spec: docs/superpowers/specs/2026-08-20-roster-doc-design.md
 */
import { MINIGAMES } from '../data/minigames.js'
import { getPetDef } from '../data/index.js'
import { stripTrailingEmoji } from './text.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { PVP_RATING_START } from './pvpRating.js'
import { applySeasonReset, currentSeasonId } from './pvpSeason.js'

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** userData (doc เต็ม) → แถวย่อสำหรับ roster */
export function buildRosterRow(u) {
  const d = u || {}

  // มินิเกม: เก็บเฉพาะเกมที่เคยทำคะแนนได้จริง — กันแถวบวมด้วยศูนย์
  const m = {}
  for (const g of MINIGAMES) {
    const best = num(d.minigames?.[g.key]?.best, 0)
    if (best > 0) m[g.key] = best
  }

  // ทีมสู้: [{i: petId, g: grade}] — rarity/element ดึงจาก catalog ตอนอ่าน จึงไม่ต้องเก็บ
  // ⚠️ ต้องเป็น array ของ "object" ไม่ใช่ [[id, grade]] — Firestore ไม่รองรับ array ซ้อน array
  //    (setDoc throw "Nested arrays are not supported") · map ใน array ใช้ได้ปกติ
  const pets = Array.isArray(d.pets) ? d.pets : []
  const tm = (Array.isArray(d.activePets) ? d.activePets : [])
    .filter(Boolean)
    .slice(0, BATTLE_SLOTS)
    .map((id) => {
      const inst = pets.find(p => (p?.id || p?.species) === id) || {}
      return { i: id, g: num(inst.grade, 0) }
    })

  return {
    s:  d.studentId ?? null,
    n:  stripTrailingEmoji(d.nickname || d.name?.split(' ')[0] || '') || '?',
    t:  d.track ?? null,
    l:  num(d.residence?.level, 1),
    p:  d.googlePhoto ?? null,      // ⚠️ ไม่เอา customPhoto — data URL ก้อนใหญ่
    g:  d.guestStatus ?? null,
    tb: num(d.towerBest, 0),
    // เรต "ของซีซั่นปัจจุบัน" — ไม่ใช่เรตดิบ เพราะ soft-reset จะถูกเขียนจริงต่อเมื่อเจ้าตัวบุกครั้งแรกของเดือน
    // ถ้าเขียนดิบ วันที่ 1 ของเดือน เจ้าตัวเห็นเรตบีบแล้วแต่ทั้งชั้นปียังเห็นเรตเดือนก่อน (คนเลิกเล่นค้างถาวร)
    r:  num(applySeasonReset(d.pvp, currentSeasonId()).rating, PVP_RATING_START),
    m,
    tm,
  }
}

/** เทียบสองแถว — true = ต้องเขียน · ใช้ JSON เพราะแถวเป็น plain data ตื้น คีย์เรียงคงที่จาก buildRosterRow */
export function rosterRowChanged(oldRow, newRow) {
  if (!oldRow) return true
  return JSON.stringify(oldRow) !== JSON.stringify(newRow)
}

/** สร้าง rows ทั้งก้อนจาก users ทั้ง collection (ใช้เฉพาะปุ่มแอดมิน) */
export function buildRosterFromUsers(docs) {
  const rows = {}
  for (const { uid, data } of docs || []) {
    if (!data) continue
    if (!data.studentId && !data.nickname) continue   // ตรรกะเดิมของ members store
    rows[uid] = buildRosterRow(data)
  }
  return rows
}

/** แถวย่อ → รูปที่ view เดิมคุ้นเคย (คล้าย light subset ของ fbUsers) */
function toMember(uid, row) {
  const minigames = {}
  for (const [k, best] of Object.entries(row.m || {})) minigames[k] = { best }
  return {
    uid,
    studentId: row.s,
    nickname: row.n,
    track: row.t,
    residence: { level: row.l },
    googlePhoto: row.p,
    guestStatus: row.g,
    towerBest: row.tb,
    pvp: { rating: row.r },
    minigames,
    activePetsTeam: rosterTeam(row),
  }
}

/** rows → { byStudentId, guests } · guest = แถวที่มี g (ไม่ใช่ null) */
export function rosterToMembers(rows) {
  const byStudentId = {}
  const guests = []
  for (const [uid, row] of Object.entries(rows || {})) {
    const mem = toMember(uid, row)
    if (row.g || row.t === 'guest') guests.push(mem)
    else if (row.s) byStudentId[row.s] = mem
  }
  return { byStudentId, guests }
}

/** [{i,g}] → รูปเดียวกับ resolveBattleTeam (utils/petTeam.js) */
export function rosterTeam(row) {
  return (row?.tm || []).map((slot) => {
    const id = slot?.i
    const def = getPetDef(id) || {}
    return {
      id,
      rarity:  def.rarity  || 'common',
      element: def.element || 'scissors',
      grade:   num(slot?.g, 0),
    }
  })
}

/** คู่ต่อสู้ที่บุกได้ — มีทีม + ไม่ใช่ตัวเอง · team resolve มาให้แล้ว (เหมือนบอท) */
export function rosterOpponents(rows, meUid) {
  const out = []
  for (const [uid, row] of Object.entries(rows || {})) {
    if (uid === meUid) continue
    if (!row?.tm?.length) continue
    out.push({ uid, nickname: row.n, rating: num(row.r, PVP_RATING_START), team: rosterTeam(row) })
  }
  return out
}
