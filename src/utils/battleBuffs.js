// src/utils/battleBuffs.js
// "ตอนนี้ตัวนี้ติดบัฟอะไร มาจากใคร" — pure ทั้งหมด ไม่แตะ store/DOM/Date
// สเปก: docs/superpowers/specs/2026-08-30-enemy-passive-and-live-buffs-design.md
//
// 🔑 ต่างจาก statusMap เดิมตรงที่ "เก็บที่มาไว้" — ของเดิมยุบ effect เป็น Set
//    จึงบอกได้แค่ว่าได้อะไร ไม่รู้ว่าใครให้ · ป้ายไอคอนเล็กบนการ์ดตอนนี้เป็นก้อนนี้ที่ตัดที่มาทิ้ง (badgesOf)
//
// 🔒 liveBuffs อ่าน beat ที่เล่นไปแล้ว = ผลเปลี่ยนตามจังหวะ ⇒ **เรียกได้เฉพาะตอนไฟต์พัก**
//    (หน้าต่าง inspect สั่ง paused=true ก่อนเปิดอยู่แล้ว) ห้ามเอาไปผูกกับป้ายบนการ์ด
//    เพราะเปลี่ยน paint ขณะการ์ดมีอนิเมชัน = re-raster ทั้งใบ (ข้อบังคับ v3 ของ BattleReplay)
import { getPetDef } from '../data/index.js'
import {
  PET_PASSIVES, effectText, STATUS_ICON, STATUS_TEXT,
  TEAM_AURA_EFFECTS, FOE_AURA_EFFECTS, SELF_STATUS_EFFECTS,
} from '../data/petPassives.js'

const passiveOf = (pet) => PET_PASSIVES[pet?.id] || null
const defOf = (pet) => getPetDef(pet?.id) || { name: '?', emoji: '❓' }

/** effect ที่ "ใช้แล้วหมด" — เห็น event ของมันใน beat ที่ผ่านมา = หมดฤทธิ์ */
const ONE_SHOT = new Set(['revive', 'cheatDeath', 'saveAlly'])

/** เพดานสแต็กของสกิลนั้น — อ่านจากทะเบียน ไม่ใช่เลขพิมพ์มือ */
function maxStacksOf(b) {
  for (const p of Object.values(PET_PASSIVES)) {
    if (p.effect === b.effect && p.name === b.skillName) return p.value?.max ?? 0
  }
  return 0
}

function makeBuff(effect, owner, ownerUid, opts) {
  const p = opts.passive
  const def = defOf(owner)
  return {
    // key ต้องพ่วง ownerUid — เพ็ทสองตัวในทีมเดียวให้ effect เดียวกันได้ (🦊 กับ 🐭 หลบเหมือนกัน)
    key: `${effect}:${ownerUid}`,
    effect,
    icon: STATUS_ICON[effect] || '',
    // foeSide = ป้ายอยู่บน "ตัวที่โดน" ⇒ ต้องใช้ข้อความมุมผู้รับ ไม่ใช่มุมเจ้าของสกิล
    label: opts.label ?? effectText(p, owner?.passiveLv, { onTarget: !!opts.foeSide }),
    skillName: opts.skillName ?? p?.name ?? '',
    skillIcon: opts.skillIcon ?? p?.icon ?? '',
    ownerUid,
    ownerName: def.name,
    ownerEmoji: def.emoji,
    self: false,
    buff: opts.buff !== false,
    foeSide: !!opts.foeSide,
  }
}

/** aura ของทีมหนึ่ง แยกเป็น: ลงทีมตัวเอง / ลงทีมตรงข้าม / คู่หู */
function aurasOf(team, side) {
  const mine = [], theirs = [], duo = []
  const ids = new Set(team.filter(Boolean).map(p => p.id))
  team.forEach((pet, i) => {
    const p = passiveOf(pet)
    if (!p || p.hook !== 'aura') return
    const entry = { owner: pet, uid: side + i, passive: p }
    if (TEAM_AURA_EFFECTS.has(p.effect)) mine.push({ effect: p.effect, ...entry })
    else if (FOE_AURA_EFFECTS.has(p.effect)) theirs.push({ effect: p.effect, ...entry })
    // คู่หู 🐳🦭 — teamAtk ที่มี duoWith และเพื่อนคนนั้นอยู่ในทีมจริง ⇒ ทีมได้ regen เพิ่มอีกช่อง
    // (ตรงกับเงื่อนไข duo ใน battlePassives.applyAuras) เดิมช่องนี้ไม่มีป้ายเลย ผู้เล่นไม่รู้ว่าคู่หูทำงาน
    if (p.effect === 'teamAtk' && p.value?.duoWith && ids.has(p.value.duoWith)) {
      duo.push({ effect: 'duoRegen', ...entry })
    }
  })
  return { mine, theirs, duo }
}

/**
 * ผูก effect เข้ากับตัวที่เป็นเจ้าของ → รู้ว่าบัฟแต่ละอันมาจากไหน
 * @returns {{[uid: string]: object[]}} คีย์เป็น uid (A0/B1/…) เหมือนที่ engine ใช้
 */
export function buffSources(playerTeam, botTeam) {
  const teams = { A: playerTeam || [], B: botTeam || [] }
  const aura = { A: aurasOf(teams.A, 'A'), B: aurasOf(teams.B, 'B') }
  const out = {}
  for (const side of ['A', 'B']) {
    const own = aura[side], foe = aura[side === 'A' ? 'B' : 'A']
    teams[side].forEach((pet, i) => {
      const uid = side + i
      const list = []
      // 1) สถานะติดตัว — ขึ้นเฉพาะเจ้าตัว
      const self = passiveOf(pet)
      if (self && SELF_STATUS_EFFECTS.has(self.effect)) {
        const b = makeBuff(self.effect, pet, uid, { passive: self })
        b.self = true
        list.push(b)
      }
      // 2) aura จากทีมตัวเอง (รวมของตัวเอง) + คู่หู
      for (const a of [...own.mine, ...own.duo]) {
        const b = makeBuff(a.effect, a.owner, a.uid, {
          passive: a.passive,
          // duoRegen ไม่ใช่ผลหลักของ passive นั้น (ผลหลักคือ teamAtk) จึงใช้คำกลางแทน effectText
          label: a.effect === 'duoRegen' ? STATUS_TEXT.duoRegen : undefined,
        })
        b.self = a.uid === uid
        list.push(b)
      }
      // 3) ดีบัฟที่ศัตรูแผ่ใส่ — ป้ายไปอยู่ที่ "ปลายทางของผล" ไม่ใช่ที่เจ้าของสกิล
      //    (🦉 อยู่ทีมศัตรู แต่ 🎯 โผล่บนทีมเรา)
      for (const a of foe.theirs) {
        list.push(makeBuff(a.effect, a.owner, a.uid, { passive: a.passive, buff: false, foeSide: true }))
      }
      out[uid] = list
    })
  }
  return out
}

/**
 * เติมสถานะสดจาก beat ที่เล่นไปแล้ว (0..idx)
 * ⚠️ เรียกตอนไฟต์พักเท่านั้น — ดูหัวไฟล์
 */
export function liveBuffs(sources, beats, idx) {
  const played = (beats || []).slice(0, Math.max(0, (idx ?? -1) + 1))
  return (sources || []).map((b) => {
    if (b.effect === 'stackAtk') {
      let stacks = 0
      for (const e of played) {
        // amount ที่เอนจินส่งมา = จำนวนชั้นสะสม (killer.atkStacks) ไม่ใช่ % ต่อชั้น
        if (e?.t === 'passive' && e.effect === 'stackAtk' && e.uid === b.ownerUid) stacks = e.amount || stacks
      }
      return { ...b, stacks, maxStacks: maxStacksOf(b) }
    }
    if (ONE_SHOT.has(b.effect)) {
      // นับที่ "เจ้าของ" ไม่ใช่คนที่ถูกช่วย — genie กันเพื่อนตาย event ยิงจาก uid ของ genie
      const spent = played.some(e => e?.t === 'passive' && e.effect === b.effect && e.uid === b.ownerUid)
      return { ...b, spent }
    }
    return b
  })
}

/** ย่อเป็นรูปที่ป้ายไอคอนเล็กบนการ์ดใช้ — ตัดที่มาทิ้ง + ตัดที่ max
 *  ⚠️ ต้องไม่มี effect ซ้ำ (ป้าย 💨 สองอันบนการ์ดเดียวอ่านไม่รู้เรื่อง) */
export function badgesOf(list, max) {
  const seen = new Set()
  const out = []
  for (const b of list || []) {
    if (!b.icon || seen.has(b.effect)) continue
    seen.add(b.effect)
    out.push({ key: b.effect, icon: b.icon, label: STATUS_TEXT[b.effect] || '', buff: b.buff })
    if (out.length >= max) break
  }
  return out
}
