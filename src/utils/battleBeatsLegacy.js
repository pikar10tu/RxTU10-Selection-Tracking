// battleBeatsLegacy.js — กู้ "จังหวะเดิม 4 ชั้น" ไว้เทียบรสนิยม 1 รอบ (สเปก 2026-08-28 §6)
// pure ล้วนเหมือน battleBeats.js · เปิดผ่าน prefs.legacyBeats (localStorage เครื่องเดียว)
//
// ⚠️ ไฟล์นี้เป็นของชั่วคราว — ลบทิ้งพร้อม prefs.legacyBeats หลัง user เทสจอจริงแล้วเลือกได้
//
// ┌─ กู้กลับ ─────────────────────────┬─ ไม่กู้กลับ ────────────────────────────────┐
// │ ตารางเวลา 4 ชั้น 320/600/1300/2000 │ บั๊ก หมัดลูกยิงจอสั่นเต็มสูตร (kind ยังถูกเสมอ) │
// │ ความดัง FX ตามชั้น (ผ่าน legacyTier)│ บั๊ก สุ่มเยื้องเลข ±14px / พูลถูกยึด           │
// │ ชั้นถากไม่ขยับการ์ด                │ บั๊ก สกิล onAttack ถูกกลืนเข้ายกแรก            │
// │ โควตาสปอตไลต์ 3 + glance 250ms     │ ป้ายสถานะบนการ์ด (ของใหม่ล้วน)                │
// └───────────────────────────────────┴────────────────────────────────────────────┘
// เหตุผล: โหมดเดิมมีไว้เทียบ "รสนิยมของจังหวะ" ไม่ใช่ให้เอาของเสียกลับมา
import { buildBeats } from './battleBeats.js'

/** เวลาแต่ละเฟสต่อชั้น (ms ที่ pace ×1) — ค่าเดิมเป๊ะจากฉบับ 23 ส.ค. */
export const TIER_TIMING = {
  chip:   { windup: 0,   motion: 100, hitstop: 0,   tail: 220 },
  solid:  { windup: 140, motion: 130, hitstop: 40,  tail: 290 },
  heavy:  { windup: 350, motion: 100, hitstop: 120, tail: 730 },
  finish: { windup: 430, motion: 250, hitstop: 250, tail: 1070 },
}
const ZERO = { windup: 0, motion: 0, hitstop: 0, tail: 0 }
const PASSIVE_TIMING = {
  spotlight: { windup: 420, motion: 0, hitstop: 550, tail: 230 },
  glance:    { windup: 0,   motion: 0, hitstop: 250, tail: 0   },
}
const OPEN_GROUP_MS = 1100
const SPOT_QUOTA = 3
const CLUTCH = new Set(['revive', 'cheatDeath', 'saveAlly'])

const HEAVY_SHARE = 0.13, HEAVY_MIN = 3, HEAVY_MAX = 6
const SOLID_SHARE = 0.28, SOLID_MIN = 5, SOLID_MAX = 11
const HEAVY_SCORE_FLOOR = 0.12
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const scoreOf = (e, dmgPct) =>
  dmgPct + (e.crit ? 0.15 : 0) + (e.eff === 'super' ? 0.08 : 0) + (e.dead ? 0.30 : 0)

/** kind ที่ renderer เข้าใจ ← ชั้นเดิม (renderer เดินด้วย kind เสมอ ไม่ต้องแตกสองสาย) */
const KIND_OF_TIER = { chip: 'hit', solid: 'hit', heavy: 'hit', finish: 'finish' }

/**
 * เหมือน buildBeats() แต่ทับ timing ด้วยตารางเดิม แล้วติด legacyTier ให้ renderer อ่าน
 * @returns beat[] ที่มีทั้ง kind/weight (ของใหม่) และ legacyTier/timing (ของเดิม)
 */
export function buildBeatsLegacy(log, maxHpByUid) {
  const beats = buildBeats(log, maxHpByUid)
  const evts = Array.isArray(log) ? log : []
  const mh = maxHpByUid || {}

  // ── ชั้นของหมัด: โควตาอันดับแบบเดิม ──
  const atkIdx = []
  const score = new Map()
  for (let i = 0; i < evts.length; i++) {
    const e = evts[i]
    if (!e || e.t !== 'attack' || e.sub) continue
    const max = mh[e.target] > 0 ? mh[e.target] : 1
    atkIdx.push(i)
    score.set(i, scoreOf(e, (e.dmg || 0) / max))
  }
  const tierAt = new Map()
  if (atkIdx.length) {
    const last = atkIdx[atkIdx.length - 1]
    tierAt.set(last, 'finish')
    const n = atkIdx.length
    const nHeavy = clamp(Math.round(n * HEAVY_SHARE), HEAVY_MIN, HEAVY_MAX)
    const nSolid = clamp(Math.round(n * SOLID_SHARE), SOLID_MIN, SOLID_MAX)
    const rest = atkIdx.filter(i => i !== last).sort((a, b) => score.get(b) - score.get(a))
    let h = 0, sd = 0
    for (const i of rest) {
      if (h < nHeavy && score.get(i) >= HEAVY_SCORE_FLOOR) { tierAt.set(i, 'heavy'); h++; continue }
      if (sd < nSolid) { tierAt.set(i, 'solid'); sd++; continue }
      tierAt.set(i, 'chip')
    }
  }

  // ── ชั้นของ passive: ยกแรก + โควตาสปอตไลต์ 3 + glance/mute ──
  // (ตัดกลุ่มยกแรกที่ attack แรกแบบเดิม — จงใจคงบั๊ก 6 ไว้ให้ "จังหวะเดิม" เป็นของเดิมจริงๆ ไม่ได้ ⇒
  //  ใช้จุดตัดของใหม่ เพราะบั๊ก 6 เป็นของเสียล้วน ไม่ใช่รสนิยม — ดูตารางหัวไฟล์)
  const pTierAt = new Map()
  {
    const firstNonOpen = beats.findIndex(b => b.kind !== 'openQuiet' && b.kind !== 'openGroup')
    const openCut = firstNonOpen < 0 ? beats.length : firstNonOpen
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
      cand.push({ i, key, first, score: (CLUTCH.has(e.effect) ? 1 : 0) + (first ? 0.5 : 0) + size })
    }
    const spot = new Set(), usedKey = new Set()
    for (const c of cand.slice().sort((a, b) => (b.score - a.score) || (a.i - b.i))) {
      if (spot.size >= SPOT_QUOTA) break
      if (usedKey.has(c.key)) continue
      if (!c.first && c.score < 1) continue
      spot.add(c.i); usedKey.add(c.key)
    }
    for (const c of cand) pTierAt.set(c.i, spot.has(c.i) ? 'spotlight' : (c.first ? 'glance' : 'mute'))
  }

  return beats.map((b, i) => {
    if (b.t === 'attack') {
      if (b.kind === 'sub') return { ...b, legacyTier: null }
      const tier = tierAt.get(i) || 'chip'
      return { ...b, kind: KIND_OF_TIER[tier], legacyTier: tier, timing: { ...TIER_TIMING[tier] } }
    }
    if (b.t !== 'passive') return b
    if (b.kind === 'openQuiet') return b
    if (b.kind === 'openGroup') return { ...b, timing: { ...ZERO, hitstop: OPEN_GROUP_MS } }
    const pt = pTierAt.get(i)
    if (pt === 'spotlight') return { ...b, kind: 'skillMoment', timing: { ...PASSIVE_TIMING.spotlight } }
    if (pt === 'glance')    return { ...b, kind: 'skill', timing: { ...PASSIVE_TIMING.glance } }
    return { ...b, kind: 'skillQuiet', timing: { ...ZERO } }
  })
}

/** ความดัง FX ตามชั้นเดิม — renderer เรียกตัวนี้เมื่อ beat มี legacyTier */
export function legacyImpact(tier) {
  switch (tier) {
    case 'chip':   return { burst: 0,  shake: null }
    case 'solid':  return { burst: 34, shake: null }
    case 'heavy':  return { burst: 66, shake: 'ko' }
    case 'finish': return { burst: 92, shake: 'finish' }
    default:       return { burst: 0,  shake: null }
  }
}
