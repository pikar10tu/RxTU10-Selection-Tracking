// battleBeats.js — แปลง log ของ engine เป็น "beat" ที่บอกว่าแต่ละเหตุการณ์ควรถูกเล่าหนักแค่ไหน
// pure ล้วน: ไม่ import อะไร ไม่อ่าน DOM/store/Date.now → เทสด้วย node --test ได้ตรงๆ
//
// ════════════════════════════════════════════════════════════════════
//  หลักการเดียวที่คุมทั้งไฟล์ (สเปก 2026-08-28-battle-rhythm-redesign)
//
//      kind  คุม "เวลา"      อย่างเดียว
//      weight คุม "ความดัง"  อย่างเดียว
//      ห้ามปนกันเด็ดขาด
//
//  ⚠️ ฉบับก่อน (23 ส.ค.) ใช้ `tier` ตัวเดียวคุมทั้งสองอย่าง แล้วแจกชั้นด้วย "โควตาอันดับ"
//     ผลที่วัดได้จาก log จริง 200 ไฟต์: คู่หมัดที่ดาเมจต่างกันไม่เกิน 8% บนเป้าเดียวกัน
//     **29% ได้คนละชั้น** ⇒ หมัดที่ทำเลือดหาย 20.0% เงียบสนิท 320ms ส่วนหมัดที่ทำ 18.8%
//     ได้ 1300ms + จอสั่น · user เทสจอจริงแล้วรายงานว่า "ตีเบาบ้างแรงบ้าง ไม่สม่ำเสมอ"
//     → เลิกใช้โควตา ให้ weight มาจาก %เลือดที่หายจริง = ดาเมจเท่ากันเล่าเหมือนกันเสมอ
// ════════════════════════════════════════════════════════════════════

// ── ค่าที่ปรับรสนิยมได้ทั้งหมด อยู่ในบล็อกนี้บล็อกเดียว ─────────────
/** จังหวะพื้นฐานของ 1 หมัด (ms ที่ pace ×1) — user เลือก 520 เอง 28 ส.ค. หลังเล่นห้องเทียบ */
export const BEAT = 520
export const KO_MULT = 2          // หมัดที่ทำให้ใครสักคนตาย
export const FINISH_MULT = 4      // หมัดปิดเกม
/** หยุดให้อ่านตอนสกิลโปรก "ครั้งแรก" ของสกิลนั้นในไฟต์ — ครั้งซ้ำไม่หยุด */
export const SKILL_PAUSE = 200
/** ยกแรก (aura + onStart) ป้ายขึ้นพร้อมกันทุกใบ แล้วค้างรวมครั้งเดียว ไม่ว่าจะกี่ตัว */
export const OPEN_GROUP_MS = 1100

/** สัดส่วนเฟส [windup, motion, hitstop, tail] — แต่ละชุดต้องรวมได้ 1 พอดี (มีเทสคุม) */
export const SHAPE = {
  hit:    [0.28, 0.22, 0.08, 0.42],
  ko:     [0.24, 0.16, 0.18, 0.42],   // hitstop ยาวขึ้น = ค้างให้เห็นจังหวะน็อก ไม่ใช่ยืด tail ให้รอเปล่า
  finish: [0.26, 0.14, 0.20, 0.40],
}

/** สูตรความดัง — ทุกตัวคูณอยู่ในนี้ ไม่มีเลขลอยที่อื่น */
export const WEIGHT_CFG = { dmgFull: 0.30, dmgWeight: 0.70, crit: 0.18, super: 0.12 }

/** โหมดเร่ง (กดค้าง) ย่อเฉพาะหมัดปกติ — โมเมนต์ห้ามแตะ ไม่งั้นกลายเป็นปุ่มข้าม */
export const FF_SCALE = { hit: 0.45, ko: 1, finish: 1, sub: 1, skill: 1, skillMoment: 1, openGroup: 1 }

/** จังหวะเป็น-ตาย — ได้โมเมนต์เต็มเสมอ แม้เป็นครั้งซ้ำ */
export const CLUTCH_EFFECTS = new Set(['revive', 'cheatDeath', 'saveAlly'])

/** effect ของ hook ที่ทำงาน "ก่อนไฟต์เริ่ม" (`setup` + `aura`) — ใช้ตัดกลุ่มยกแรก (ดู openCutOf)
 *  🔴 เพิ่ม effect ใหม่บน hook `aura`/`setup` เมื่อไหร่ ต้องมาเติมที่นี่ด้วยเสมอ — ไฟล์นี้ไม่ import อะไร
 *     จึงตรวจให้ไม่ได้ตอนคอมไพล์ · เทสข้ามไฟล์ใน battleBeats.test.js เป็นตัวคุมแทน
 *     ถ้าตกหล่น: openCutOf จะตัดกลุ่มยกแรกที่ตัวนั้นทันที ⇒ ป้ายออร่าเลิกขึ้นพร้อมกัน
 *     กลายเป็นทยอยขึ้นทีละใบ ซึ่งเป็นอาการที่สเปกบอกให้เลี่ยงตรงๆ */
export const OPENING_EFFECTS = new Set([
  'teamHp', 'teamAtk', 'teamAtkPerElement', 'teamCrit', 'enemyVuln',   // aura เดิม 5 ตัว
  'elementTrinity', 'teamLifesteal', 'teamDamageReduction',            // aura ใหม่ของ P2
  'stealStats',                                                        // hook setup — เอนจิน log ก่อน aura ทุกใบ
])

export const DANGER_PCT = 0.25         // เลือดเหลือไม่เกินนี้ (ยังไม่ตาย) = โซนอันตราย
export const SURVIVE_PCT = 0.10        // ตกผ่านเส้นนี้ครั้งแรก = ป้าย "รอด!"

const ZERO = { windup: 0, motion: 0, hitstop: 0, tail: 0 }
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/** แตกงบเวลา total ออกเป็น 4 เฟสตามสัดส่วนของ kind นั้น */
function phasesOf(total, shape) {
  return {
    windup:  total * shape[0],
    motion:  total * shape[1],
    hitstop: total * shape[2],
    tail:    total * shape[3],
  }
}

/** เวลาของ beat ตาม kind — ฟังก์ชันเดียวที่ตัดสินเรื่องเวลา (ห้ามมีที่อื่น) */
export function timingOf(kind) {
  switch (kind) {
    case 'hit':         return phasesOf(BEAT, SHAPE.hit)
    case 'ko':          return phasesOf(BEAT * KO_MULT, SHAPE.ko)
    case 'finish':      return phasesOf(BEAT * FINISH_MULT, SHAPE.finish)
    case 'skillMoment': return phasesOf(BEAT * KO_MULT, SHAPE.ko)
    case 'skill':       return { ...ZERO, hitstop: SKILL_PAUSE }
    case 'openGroup':   return { ...ZERO, hitstop: OPEN_GROUP_MS }
    // sub · openQuiet · skillQuiet · round/end/ไม่รู้จัก = ผ่านไปเงียบๆ ไม่กินเวลา
    default:            return { ...ZERO }
  }
}

/** ความดังของหมัด 0..1 — มาจากของจริงล้วน ไม่มีอันดับ ไม่มีโควตา */
export function weightOf(e, dmgPct) {
  const ev = e || {}
  const base = clamp01((dmgPct || 0) / WEIGHT_CFG.dmgFull) * WEIGHT_CFG.dmgWeight
  const w = clamp01(base
    + (ev.crit ? WEIGHT_CFG.crit : 0)
    + (ev.eff === 'super' ? WEIGHT_CFG.super : 0))
  // ปัดทศนิยม 3 ตำแหน่ง — ค่านี้ไปโผล่ใน keyframes กับขนาดฟอนต์ ถ้าปล่อยเศษ float ไว้
  // จะได้ .9999999999999999 แทน 1 และค่าเดียวกันอาจต่างกันเล็กน้อยข้ามเครื่อง = เทสเปราะ
  return Math.round(w * 1000) / 1000
}

/** effect ที่ "ไม่ใช่สกิลของเพ็ทที่มันโผล่บน" จึงห้ามถูกกลืนเข้าก้อนจังหวะของเพ็ทตัวนั้น
 *  duoRegen = ของคู่หู 🐳🦭 แต่ยิงบนตัวผู้รับ · ถ้าจัดก้อนด้วย uid เฉยๆ มันจะไปเกาะกับพาสสีฟของเพ็ทใบนั้น
 *    (เช่น regenSelf ของ 🐼) แล้วถูกลดเป็น skillQuiet = ป้าย 💧 หายไปทั้งที่คู่หูทำงานอยู่ (วัดจริง 2 ไฟต์)
 *  teamLifesteal = ออร่าของ 🦇 แต่ยิงบนตัวที่ออกหมัด · ถ้าเพ็ทตัวเดียวมีทั้ง healOnAttack
 *    และ teamLifesteal สองใบจะติดกันบน uid เดียว แล้วกฎก้อนจะปิดเสียงใบแรกทิ้ง
 *  ✅ user เคาะ 3 ก.ย. 2026: "ก้อนหนึ่ง = สกิลของเพ็ทตัวเดียวยิงหลาย part · duoRegen ไม่ใช่แบบนั้น
 *     ให้มันมีโมเมนต์ของตัวเอง" — จึงกันออกจากก้อนตรงนี้ ไม่ใช่ไปยุ่งกับลำดับ event ในเอนจิน */
export const OUT_OF_GROUP_EFFECTS = new Set(['duoRegen', 'teamLifesteal'])

/** คีย์ของ "ก้อน" = เพ็ทหนึ่งตัวยิงสกิลของตัวเองติดกัน · effect ที่ไม่ใช่สกิลของใบนั้นได้คีย์ของตัวเอง */
const groupIdOf = (e) => (OUT_OF_GROUP_EFFECTS.has(e.effect) ? `${e.uid || ''}#${e.effect}` : (e.uid || ''))

/**
 * ตัดกลุ่ม "ยกแรก" ที่ตรงไหน
 *
 * ⚠️ ฉบับก่อนตัดที่ index ของ attack event แรก ซึ่งผิด เพราะ engine push event ของ
 *    runOnAttack (cleave/multiStrike/execute) **ก่อน** log ของหมัดเสมอ (battleEngine.js hit())
 *    ⇒ สกิลโจมตีของตัวที่ตีคนแรก ถูกกลืนเข้ากลุ่มยกแรกทุกไฟต์ แล้วไม่เคยได้ประกาศตอนโปรกจริง
 *    แก้: ตัดที่ passive ตัวแรกที่ "ไม่ใช่ของเปิดไฟต์" หรือที่ attack แรก แล้วแต่อะไรมาก่อน
 */
function openCutOf(evts) {
  for (let i = 0; i < evts.length; i++) {
    const e = evts[i]
    if (!e) continue
    if (e.t === 'attack') return i
    if (e.t === 'passive' && !OPENING_EFFECTS.has(e.effect)) return i
    if (e.t === 'round' || e.t === 'end') return i
  }
  return evts.length
}

/**
 * @param {Array} log  log จาก simulateBattle()
 * @param {Object} maxHpByUid  uid → maxHp (จาก buildCombatant) — uid ที่ขาดถูกมองเป็น 1 กันหารศูนย์
 * @returns {Array} beat[] ยาวเท่า log เสมอ (1 event = 1 beat) เพื่อให้ index ตรงกับของเดิม
 */
export function buildBeats(log, maxHpByUid) {
  const evts = Array.isArray(log) ? log : []
  const mh = maxHpByUid || {}

  // ── pass 1: %เลือดที่หายจริงของทุกหมัด ──
  // sub = หมัดลูกของ cleave/multiStrike — อยู่ใน beat ของหมัดหลัก ไม่นับเป็นจังหวะใหม่
  // (ไม่งั้น cerberus ที่โดน 3 ตัว = 3 จังหวะ ⇒ ไฟต์ยืดตามจำนวน passive ในทีม)
  const info = evts.map((e) => {
    const ev = e || {}
    if (ev.t !== 'attack') return null
    const max = mh[ev.target] > 0 ? mh[ev.target] : 1
    return {
      dmgPct: (ev.dmg || 0) / max,
      hpPctAfter: Math.max(0, (ev.targetHpAfter || 0) / max),
    }
  })

  // หมัดปิดเกม = attack ตัวสุดท้ายที่ไม่ใช่หมัดลูก (มีได้ตัวเดียวต่อไฟต์เสมอ)
  let finishAt = -1
  for (let i = evts.length - 1; i >= 0; i--) {
    const ev = evts[i]
    if (ev && ev.t === 'attack' && !ev.sub) { finishAt = i; break }
  }

  // ── pass 2: แจก kind ให้ passive ──
  // ยกแรกทุกตัวได้ timing 0 ยกเว้น "ตัวสุดท้ายของกลุ่ม" ที่ถือเวลาค้างไว้ทั้งก้อน
  // → replay ยิงป้ายรัวจนครบ (ห่างกัน 0ms = ตาเห็นเป็นพร้อมกัน) แล้วค้างทีเดียว
  // ทำแบบนี้เพราะต้องคง "1 event = 1 beat" ไว้ (index ต้องตรงกับ log)
  const pKind = new Map()
  {
    const openCut = openCutOf(evts)
    const openIdx = []
    for (let i = 0; i < openCut; i++) {
      const e = evts[i]
      if (e && e.t === 'passive') { pKind.set(i, 'openQuiet'); openIdx.push(i) }
    }
    if (openIdx.length) pKind.set(openIdx[openIdx.length - 1], 'openGroup')

    // ที่เหลือ: ครั้งแรกของสกิลนั้นได้หยุดสั้นๆ · ครั้งซ้ำเงียบ · จังหวะเป็น-ตายได้โมเมนต์เต็ม
    // 🔑 เพ็ทตัวเดียวยิงหลาย part ติดกัน = "ก้อนเดียว" ⇒ ใบสุดท้ายของก้อนถือเวลาคนเดียว
    //    ที่เหลือ 0ms (แพทเทิร์นเดียวกับ openQuiet/openGroup ของยกแรก)
    //    ถ้าไม่ทำ เพ็ท 3 part จะได้ SKILL_PAUSE × 3 = หยุด 600ms ติดกันในจังหวะเดียว
    // ⚠️ คีย์ตัวดักซ้ำต้องมีลำดับ part ด้วย ไม่งั้นสอง part ที่ effect เดียวกัน
    //    ใบที่สองจะถูกลดเป็น skillQuiet แล้วหายไปเงียบๆ
    // 🔒 ลำดับที่ใส่ในคีย์ต้องนับ "ใบที่เท่าไรของ effect นี้ในก้อนปัจจุบัน" (nth ต่อ-effect)
    //    ไม่ใช่ตำแหน่งดิบของ event ในก้อน (0,1,2,... ไม่สน effect) — เพราะตำแหน่งดิบขยับได้เวลา
    //    "พาร์ตข้างเคียงในก้อนเดียวกัน" มีเงื่อนไขข้าม ตัวอย่างจริงจาก P2c: 🐍 อูโรโบรอส มี
    //    parts: [regenSelf, stackAtk] บน onRound และ regenSelf ข้ามตัวเองเวลาเลือดเต็ม
    //    (battlePassives.js: `if (u.hp >= u.maxHp) continue`) ⇒ รอบเลือดเต็ม ก้อนมีแค่ [stackAtk]
    //    (ตำแหน่งดิบ 0) รอบเลือดพร่อง ก้อนมี [regenSelf, stackAtk] (stackAtk ตำแหน่งดิบขยับเป็น 1)
    //    ถ้าคีย์ผูกกับตำแหน่งดิบ stackAtk จะได้คนละคีย์ทุกครั้งที่ regenSelf ข้าม/ไม่ข้าม สลับกัน
    //    ⇒ ประกาศซ้ำทุกครั้งที่ข้ามเส้นเลือดเต็ม/พร่อง = หยุด 200ms ที่ไม่ควรมี
    //    นับแยกต่อ-effect แก้ปัญหานี้เพราะ stackAtk เป็น "ใบที่ 0 ของ stackAtk ในก้อน" เสมอ
    //    ไม่ว่า regenSelf จะร่วมก้อนด้วยหรือไม่ — คีย์เดิม ยังถูกจับเป็นครั้งซ้ำถูกต้อง
    const seen = new Set()
    let groupId = null
    let groupEffCount = null   // Map: effect → กี่ใบของ effect นี้แล้วในก้อนปัจจุบัน
    for (let i = openCut; i < evts.length; i++) {
      const e = evts[i]
      if (!e || e.t !== 'passive') { groupId = null; groupEffCount = null; continue }
      const uid = e.uid || ''
      const gid = groupIdOf(e)
      if (gid !== groupId) { groupId = gid; groupEffCount = new Map() }
      const eff = e.effect || ''
      const nth = groupEffCount.get(eff) || 0
      groupEffCount.set(eff, nth + 1)
      const key = `${uid}:${eff}:${nth}`
      const first = !seen.has(key)
      seen.add(key)
      const next = evts[i + 1]
      const lastOfGroup = !(next && next.t === 'passive' && groupIdOf(next) === gid)
      if (CLUTCH_EFFECTS.has(e.effect)) pKind.set(i, 'skillMoment')
      else if (!lastOfGroup) pKind.set(i, 'skillQuiet')
      else pKind.set(i, first ? 'skill' : 'skillQuiet')
    }
  }

  // ── pass 3: ประกอบ beat ตามลำดับ log จริง (danger/survive ต้องไล่ตามเวลา) ──
  const belowSurvive = new Set()
  return evts.map((e, i) => {
    const ev = e || {}
    const inf = info[i]

    if (!inf) {
      const kind = pKind.get(i) || null
      // 🔴 `kind` ที่ใส่ตรงนี้ทับฟิลด์ชื่อเดียวกันของ event เดิมเสมอ — ชนิดผลของ passive
      //    จึงต้องชื่อ `fxKind` (ดู battlePassives.js) ห้ามมีใครส่ง `kind` มากับ event อีก
      return {
        ...ev, kind, weight: 0, timing: timingOf(kind),
        dmgPct: 0, hpPctAfter: 1, kill: false, danger: false, survive: false,
      }
    }

    // หมัดลูกไม่กินเวลา แต่ยังมี weight ของตัวเอง (จึงเบากว่าหมัดหลักโดยอัตโนมัติ ไม่ต้อง hardcode)
    // 🔒 นี่คือจุดที่บั๊กเดิมอยู่: เมื่อก่อน tier=null แล้ว applyImpact ตกลง else ตัวสุดท้าย
    //    = ได้เอฟเฟกต์ระดับหมัดปิดเกม 11.5 ครั้ง/ไฟต์ · ตอนนี้ kind มีค่าเสมอ ไม่มีทางตกท้าย
    const kind = ev.sub ? 'sub' : (i === finishAt ? 'finish' : (ev.dead === true ? 'ko' : 'hit'))

    const alive = inf.hpPctAfter > 0
    const danger = alive && inf.hpPctAfter <= DANGER_PCT
    let survive = false
    if (alive && inf.hpPctAfter < SURVIVE_PCT) {
      if (!belowSurvive.has(ev.target)) { survive = true; belowSurvive.add(ev.target) }
    } else if (alive) {
      belowSurvive.delete(ev.target)     // เผื่อระบบฮีลในอนาคต
    }

    return {
      ...ev,
      kind,
      weight: weightOf(ev, inf.dmgPct),
      timing: timingOf(kind),
      dmgPct: inf.dmgPct,
      hpPctAfter: inf.hpPctAfter,
      kill: ev.dead === true,            // แยกจาก kind — ตายเมื่อไหร่ก็เล่นอนิเมชันน็อกเสมอ
      danger, survive,
    }
  })
}

/** คูณเวลาตาม pace (รสนิยม) และ ff (กดค้างเร่ง) — ไม่แก้ beat เดิม */
export function scaleTiming(beat, { pace = 1, ff = false } = {}) {
  const t = (beat && beat.timing) || ZERO
  const ffK = (ff && beat && beat.kind) ? (FF_SCALE[beat.kind] ?? 1) : 1
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
