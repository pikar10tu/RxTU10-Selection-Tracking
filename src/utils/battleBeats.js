// battleBeats.js — แปลง log ของ engine เป็น "beat" ที่บอกว่าแต่ละเหตุการณ์ควรถูกเล่าหนักแค่ไหน
// pure ล้วน: ไม่ import อะไร ไม่อ่าน DOM/store/Date.now → เทสด้วย node --test ได้ตรงๆ
//
// ⚠️ การแบ่งชั้นเป็น "โควตาโมเมนต์พิเศษต่อไฟต์" ไม่ใช่เกณฑ์ตายตัว
//    ฉบับแรกใช้เกณฑ์ตายตัว (dmgPct > .20 → heavy ฯลฯ) แล้ววัด log จริงได้ heavy 53%
//    → ไฟต์ยาว 33 วิ นานกว่าระบบเดิม เพราะแพ้ทางเกิด ~1 ใน 3 ของคู่ธาตุโดยธรรมชาติ
//    โควตาการันตีสัดส่วนไม่ว่าทีมจะแกร่งแค่ไหน และการันตีว่า "ไม่มีไฟต์ไหนที่ไม่มีจุดพีค"

/** เวลาแต่ละเฟสต่อชั้น (ms ที่ pace ×1) — รวม chip 320 / solid 600 / heavy 1300 / finish 2000 */
export const TIER_TIMING = {
  chip:   { windup: 0,   motion: 100, hitstop: 0,   tail: 220 },
  solid:  { windup: 140, motion: 130, hitstop: 40,  tail: 290 },
  heavy:  { windup: 350, motion: 100, hitstop: 120, tail: 730 },
  finish: { windup: 430, motion: 250, hitstop: 250, tail: 1070 },
}
const ZERO = { windup: 0, motion: 0, hitstop: 0, tail: 0 }

/** โหมดเร่ง (กดค้าง) ย่อเฉพาะชั้นล่าง — heavy/finish ห้ามแตะ ไม่งั้นกลายเป็นปุ่มข้าม */
export const FF_SCALE = { chip: 0.3, solid: 0.3, heavy: 1, finish: 1 }

export const DANGER_PCT = 0.25         // เลือดเหลือไม่เกินนี้ (ยังไม่ตาย) = โซนอันตราย
export const SURVIVE_PCT = 0.10        // ตกผ่านเส้นนี้ครั้งแรก = ป้าย "รอด!"
export const HEAVY_SCORE_FLOOR = 0.12  // ต่ำกว่านี้ไม่ให้เป็น heavy แม้ติดอันดับ (กันไฟต์จิ๊บจ๊อยได้เลขทองใหญ่)

const HEAVY_SHARE = 0.13, HEAVY_MIN = 3, HEAVY_MAX = 6
const SOLID_SHARE = 0.28, SOLID_MIN = 5, SOLID_MAX = 11

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** คะแนนความสำคัญ — การฆ่าให้ +.30 จึงมักดันหมัดสังหารขึ้นชั้น heavy เอง โดยไม่ต้องบังคับ */
function scoreOf(e, dmgPct) {
  return dmgPct + (e.crit ? 0.15 : 0) + (e.eff === 'super' ? 0.08 : 0) + (e.dead ? 0.30 : 0)
}

/**
 * @param {Array} log  log จาก simulateBattle()
 * @param {Object} maxHpByUid  uid → maxHp (จาก buildCombatant) — uid ที่ขาดถูกมองเป็น 1 กันหารศูนย์
 * @returns {Array} beat[] ยาวเท่า log เสมอ (1 event = 1 beat) เพื่อให้ index ตรงกับของเดิม
 */
export function buildBeats(log, maxHpByUid) {
  const evts = Array.isArray(log) ? log : []
  const mh = maxHpByUid || {}

  // ── pass 1: คิด dmgPct / hpPctAfter / score ของทุก attack ──
  const info = evts.map((e) => {
    const ev = e || {}
    if (ev.t !== 'attack') return null
    const max = mh[ev.target] > 0 ? mh[ev.target] : 1
    const dmgPct = (ev.dmg || 0) / max
    return {
      dmgPct,
      hpPctAfter: Math.max(0, (ev.targetHpAfter || 0) / max),
      score: scoreOf(ev, dmgPct),
    }
  })
  const atkIdx = []
  for (let i = 0; i < evts.length; i++) if (info[i]) atkIdx.push(i)

  // ── pass 2: แจกชั้นตามโควตา (จัดอันดับด้วย score ภายในไฟต์นี้เท่านั้น) ──
  const tierAt = new Map()
  if (atkIdx.length) {
    const last = atkIdx[atkIdx.length - 1]
    tierAt.set(last, 'finish')                                   // หมัดจบไฟต์ = 1 หมัดเสมอ
    const n = atkIdx.length
    const nHeavy = clamp(Math.round(n * HEAVY_SHARE), HEAVY_MIN, HEAVY_MAX)
    const nSolid = clamp(Math.round(n * SOLID_SHARE), SOLID_MIN, SOLID_MAX)
    const rest = atkIdx.filter(i => i !== last).sort((a, b) => info[b].score - info[a].score)
    let h = 0, sd = 0
    for (const i of rest) {
      // เรียงคะแนนมากไปน้อยแล้ว — พอเจอตัวที่ต่ำกว่า floor ตัวที่เหลือก็ต่ำกว่าหมด
      if (h < nHeavy && info[i].score >= HEAVY_SCORE_FLOOR) { tierAt.set(i, 'heavy'); h++; continue }
      if (sd < nSolid) { tierAt.set(i, 'solid'); sd++; continue }
      tierAt.set(i, 'chip')
    }
  }

  // ── pass 3: ประกอบ beat ตามลำดับ log จริง (danger/survive ต้องไล่ตามเวลา ไม่ใช่ตามอันดับ) ──
  const belowSurvive = new Set()
  return evts.map((e, i) => {
    const ev = e || {}
    const inf = info[i]
    if (!inf) {
      // round / end / event ที่ยังไม่รู้จัก (เช่น passive ในอนาคต) — ผ่านไปเงียบๆ ไม่กินเวลา
      return { ...ev, tier: null, dmgPct: 0, hpPctAfter: 1, score: 0, timing: { ...ZERO }, kill: false, danger: false, survive: false }
    }
    const tier = tierAt.get(i) || 'chip'
    const alive = inf.hpPctAfter > 0
    const danger = alive && inf.hpPctAfter <= DANGER_PCT
    let survive = false
    if (alive && inf.hpPctAfter < SURVIVE_PCT) {
      if (!belowSurvive.has(ev.target)) { survive = true; belowSurvive.add(ev.target) }
    } else if (alive) {
      belowSurvive.delete(ev.target)     // ยังไม่มีระบบฮีล แต่กันไว้ให้ P3 ไม่ต้องกลับมาแก้
    }
    return {
      ...ev, tier, dmgPct: inf.dmgPct, hpPctAfter: inf.hpPctAfter, score: inf.score,
      timing: { ...TIER_TIMING[tier] },
      kill: ev.dead === true,            // แยกจากชั้น — ตายเมื่อไหร่ก็เล่นอนิเมชันน็อกเสมอ
      danger, survive,
    }
  })
}

/** คูณเวลาตาม pace (รสนิยม) และ ff (กดค้างเร่ง) — ไม่แก้ beat เดิม */
export function scaleTiming(beat, { pace = 1, ff = false } = {}) {
  const t = (beat && beat.timing) || ZERO
  const k = pace * (ff && beat && beat.tier ? (FF_SCALE[beat.tier] ?? 1) : 1)
  return { windup: t.windup * k, motion: t.motion * k, hitstop: t.hitstop * k, tail: t.tail * k }
}

export function beatDuration(beat, opts) {
  const t = scaleTiming(beat, opts)
  return t.windup + t.motion + t.hitstop + t.tail
}

export function totalDuration(beats, opts) {
  return (beats || []).reduce((s, b) => s + beatDuration(b, opts), 0)
}
