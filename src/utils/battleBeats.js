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

// ── จังหวะของ passive (สเปก 2026-08-28-skill-moment) ──
// วัดจาก log จริง 300 ไฟต์: passive 19.6 ตัว/ไฟต์ (p90 36 max 74) และ 51% เป็นฮีลซ้ำ ๆ
// ถ้าหยุดให้อ่านทุกตัวตัวละ 700ms = +13.7s เฉลี่ย p90 +25s → ไฟต์ 30–46 วิ พังแน่
// จึงคุมด้วย "โควตาสปอตไลต์ต่อไฟต์" แบบเดียวกับชั้นหมัด แทนเกณฑ์ตายตัว
export const PASSIVE_TIMING = {
  spotlight: { windup: 420, motion: 0, hitstop: 550, tail: 230 },   // รวม 1200 — แบนเนอร์ขึ้น ค้างอ่าน แล้วผลค่อยลง
  glance:    { windup: 0,   motion: 0, hitstop: 250, tail: 0   },   // ป้ายผ่าน หยุดสั้น ๆ
  mute:      { windup: 0,   motion: 0, hitstop: 0,   tail: 0   },   // ครั้งซ้ำ = ป้าย+FX ยังขึ้น แต่ไม่กินเวลา (พฤติกรรมเดิม)
}
/** ยกแรก (aura + onStart) ป้ายขึ้นพร้อมกันทุกใบ แล้วค้างรวมครั้งเดียว ไม่ว่าจะกี่ตัว */
export const OPEN_GROUP_MS = 1100
export const PASSIVE_SPOT_QUOTA = 3
/** จังหวะเป็น-ตาย — ได้สปอตไลต์แม้เป็นครั้งซ้ำ */
export const CLUTCH_EFFECTS = new Set(['revive', 'cheatDeath', 'saveAlly'])
/** กดค้างเร่ง: ย่อได้เฉพาะป้ายผ่าน — ห้ามย่อสปอตไลต์ ไม่งั้นกลายเป็นปุ่มข้ามสกิล */
export const FF_PASSIVE_SCALE = { spotlight: 1, openGroup: 1, glance: 0.3, mute: 1 }

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
    // sub = หมัดลูกของ cleave/multiStrike — อยู่ใน beat ของหมัดหลัก ไม่นับเป็นจังหวะใหม่
    // (ไม่งั้น cerberus ที่โดน 3 ตัว = 3 จังหวะ ⇒ ไฟต์ยืดตามจำนวน passive ในทีม)
    if (ev.t !== 'attack' || ev.sub) return null
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

  // ── pass 2b: แจกชั้นให้ passive ──
  // ยกแรก = passive ทุกตัวก่อนหมัดแรก (engine รัน applyAuras → runOnStart ก่อนเสมอ)
  // ทุกตัวได้ timing 0 ยกเว้น "ตัวสุดท้ายของกลุ่ม" ที่ถือเวลาค้างไว้ทั้งก้อน
  // → replay ยิงป้ายรัวจนครบ (ห่างกัน 0ms = ตาเห็นเป็นพร้อมกัน) แล้วค้างทีเดียว
  // ทำแบบนี้เพราะ buildBeats ต้องคง "1 event = 1 beat" ไว้ (index ต้องตรงกับ log)
  const pTierAt = new Map()
  {
    const firstAtk = evts.findIndex(e => e && e.t === 'attack')
    const openCut = firstAtk < 0 ? evts.length : firstAtk
    const openIdx = []
    for (let i = 0; i < openCut; i++) {
      const e = evts[i]
      if (!e || e.t !== 'passive') continue
      // aoeOpener (ลมหายใจราชัน) เป็น "การกระทำ" ไม่ใช่บัฟที่ติดอยู่เฉย ๆ
      // → รอกลุ่มยกแรกหายก่อน แล้วเล่นเต็มตัว (นับนอกโควตา เพราะเกิดแค่ .24 ครั้ง/ไฟต์)
      if (e.effect === 'aoeOpener') pTierAt.set(i, 'spotlight')
      else openIdx.push(i)
    }
    for (const i of openIdx) pTierAt.set(i, 'openGroup')
    const lastOpen = openIdx.length ? openIdx[openIdx.length - 1] : -1

    // ที่เหลือ: ให้คะแนนแล้วแจกโควตา
    const seen = new Set()
    const cand = []
    for (let i = openCut; i < evts.length; i++) {
      const e = evts[i]
      if (!e || e.t !== 'passive') continue
      const key = `${e.uid || ''}:${e.effect || ''}`
      const first = !seen.has(key)
      seen.add(key)
      const tgt = (Array.isArray(e.targets) && e.targets[0]) || e.uid
      const max = mh[tgt] > 0 ? mh[tgt] : 1
      const size = Math.min(0.5, Math.max(0, (e.amount || 0) / max))
      cand.push({ i, key, first, score: (CLUTCH_EFFECTS.has(e.effect) ? 1 : 0) + (first ? 0.5 : 0) + size })
    }
    const spot = new Set(), usedKey = new Set()
    // เรียงคะแนนมากไปน้อย · เท่ากันเอาตัวที่เกิดก่อน (ลำดับคงที่ ไม่ขึ้นกับ sort ของ engine)
    for (const c of cand.slice().sort((a, b) => (b.score - a.score) || (a.i - b.i))) {
      if (spot.size >= PASSIVE_SPOT_QUOTA) break
      if (usedKey.has(c.key)) continue          // 1 สกิลได้สปอตไลต์ครั้งเดียวต่อไฟต์
      if (!c.first && c.score < 1) continue     // ครั้งซ้ำที่ไม่ใช่จังหวะเป็น-ตาย ไม่มีสิทธิ์
      spot.add(c.i); usedKey.add(c.key)
    }
    for (const c of cand) pTierAt.set(c.i, spot.has(c.i) ? 'spotlight' : (c.first ? 'glance' : 'mute'))
    if (lastOpen >= 0) pTierAt.set(lastOpen, 'openGroupHold')
  }

  // ── pass 3: ประกอบ beat ตามลำดับ log จริง (danger/survive ต้องไล่ตามเวลา ไม่ใช่ตามอันดับ) ──
  const belowSurvive = new Set()
  return evts.map((e, i) => {
    const ev = e || {}
    const inf = info[i]
    if (!inf) {
      // passive — ชั้นมาจาก pass 2b · ที่เหลือ (round/end/ไม่รู้จัก) ผ่านไปเงียบๆ ไม่กินเวลา
      const raw = pTierAt.get(i)
      const hold = raw === 'openGroupHold'
      const pTier = hold ? 'openGroup' : raw
      const timing = hold ? { ...ZERO, hitstop: OPEN_GROUP_MS }
        : (pTier && PASSIVE_TIMING[pTier] ? { ...PASSIVE_TIMING[pTier] } : { ...ZERO })
      return { ...ev, tier: null, pTier: pTier || null, dmgPct: 0, hpPctAfter: 1, score: 0, timing, kill: false, danger: false, survive: false }
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
  let ffK = 1
  if (ff && beat) {
    if (beat.tier) ffK = FF_SCALE[beat.tier] ?? 1
    else if (beat.pTier) ffK = FF_PASSIVE_SCALE[beat.pTier] ?? 1
  }
  const k = pace * ffK
  return { windup: t.windup * k, motion: t.motion * k, hitstop: t.hitstop * k, tail: t.tail * k }
}

export function beatDuration(beat, opts) {
  const t = scaleTiming(beat, opts)
  return t.windup + t.motion + t.hitstop + t.tail
}

export function totalDuration(beats, opts) {
  return (beats || []).reduce((s, b) => s + beatDuration(b, opts), 0)
}
