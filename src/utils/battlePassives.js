// src/utils/battlePassives.js
// ตรรกะ passive — pure ทั้งหมด ไม่แตะ store/DOM/Date · สุ่มทุกจุดต้องรับ rand จากเอนจิน (deterministic)
// data อยู่ที่ src/data/petPassives.js · สเปก: docs/superpowers/specs/2026-08-27-passive-v1-design.md
//
// 🔒 กฎเหล็ก: passive ไม่เพิ่มจำนวน beat — cleave/multiStrike อยู่ใน beat เดียวกับหมัดหลัก
//    (ยิงเป็น event `passive` ที่ battleBeats ให้ timing ZERO ⇒ ไม่กินเวลา)
//    killChain เป็นข้อยกเว้นเดียวที่เพิ่ม beat จริง จึงมีเพดาน
import { PET_PASSIVES, passiveValueAt, partsAt, partAt, partWithEffect } from '../data/petPassives.js'

export const passiveFor = (unit) => PET_PASSIVES[unit?.id] || null

/** ค่าของ part นั้นตามขั้นที่เพ็ทอัพไว้ (ยังไม่มีระบบหิน ⇒ undefined = ขั้น 1)
 *  ⚠️ ห้ามอ่าน part.value ตรงๆ ในตรรกะ — ไม่งั้นพอระบบหินมา ค่าจะไม่ขยับตามขั้น */
const valOf = (part, unit) => passiveValueAt(part, unit?.passiveLv)
const alive = (t) => t.filter(u => u.hp > 0)
const pctOf = (v, pct) => v * (pct / 100)

/** state ของพาสสีฟระหว่างไฟต์ — สร้างตอนถูกอ่านครั้งแรก (ไม่ต้องแตะ buildCombatant)
 *  🔴 state ทุกกองต้องอยู่ในนี้ ห้ามแปะฟิลด์ลอยบนตัวละครอีก — ตัวละครมี atk/hp/uid/side/…
 *     อยู่แล้ว การเติมฟิลด์ปนเข้าไปคือบั๊กชื่อชนกันแบบเดียวกับ kind/fxKind (CLAUDE.md ข้อ 15)
 *  คีย์ที่ใช้: uses (กันตายไปแล้วกี่ครั้ง) · atkStacks (ชั้น stackAtk) · rage (ชั้น atkOnHit) */
export const psOf = (u) => (u.ps || (u.ps = {}))

/** snapshot สเตตัสที่ "UI เอาไปวาด" ของทั้งสองทีม — atk/maxHp เท่านั้น
 *  🔑 เอนจินเป็นแหล่งความจริงเดียว — ถ้าปล่อยให้ UI คำนวณ aura เอง
 *     วันที่สูตรเปลี่ยนจะมีสองแหล่งความจริงทันที แล้วเลขบนจอกับเลขที่ใช้สู้จะคลาดกันเงียบๆ
 *  ⚠️ ชื่อฟิลด์ปลายทางคือ `statsAfter` — ห้ามชนกับ `kind` ที่ buildBeats spread ทับ (CLAUDE.md ข้อ 15) */
export function statsSnapshot(...teams) {
  const out = {}
  for (const t of teams) for (const u of t) out[u.uid] = { atk: Math.round(u.atk), maxHp: Math.round(u.maxHp) }
  return out
}

/** effect ที่ขยับ atk/maxHp จริง — teamCrit/enemyVuln ไม่ต้องแบก snapshot ไปด้วย */
const STAT_EFFECTS = new Set(['teamHp', 'teamAtk', 'teamAtkPerElement', 'stackAtk', 'elementTrinity'])

/** สร้าง event สำหรับ log — รูปเดียวกับที่ BattleReplay/battleBeats รับ
 *  🔴 ชนิดผลชื่อ `fxKind` ห้ามใช้ชื่อ `kind` เด็ดขาด — `kind` เป็นของ battleBeats (= เวลา)
 *     และมันสร้าง beat ด้วย { ...event, kind } ⇒ ชื่อซ้ำเมื่อไหร่ ชนิดผลหายทั้งระบบทันที
 *     (เกิดมาแล้ว 28 ส.ค. `f32b519`: ฮีลแล้วหลอดขึ้นแต่เลข +N ไม่ขึ้น เพราะ 'heal' ถูกทับด้วย 'skill') */
function ev(unit, p, part, extra = {}) {
  return { t: 'passive', uid: unit.uid, side: unit.side, petId: unit.id, name: p.name, icon: p.icon, effect: part.effect, ...extra }
}

/** ฟื้นเลือดให้ unit แล้วคืน { amount, hpPct } — amount = เลือดจริงที่ฟื้นได้ (ไม่ใช่ % ของ passive)
 *  ⚠️ ผู้เล่นต้องเห็นเลขจริง (+15) ไม่ใช่ % ของสูตร และหลอดเลือดต้องขยับตาม */
function healUnit(u, pct) {
  const before = u.hp
  u.hp = Math.min(u.maxHp, u.hp + pctOf(u.maxHp, pct))
  return { amount: Math.round(u.hp - before), hpPct: Math.round((u.hp / u.maxHp) * 100) }
}

/** เพื่อนร่วมทีมที่ยังไม่ตายและเลือดพร่องที่สุด (คืน null ถ้าไม่มีใครพร่อง) */
function lowestHpAlly(team, exclude) {
  let best = null
  for (const u of alive(team)) {
    if (u === exclude) continue
    if (!best || u.hp / u.maxHp < best.hp / best.maxHp) best = u
  }
  return best
}

// ══════════════════════════════════════════════════════════════
//  setup — ก่อน aura ทุกอย่าง (แก้ atk/maxHp ดิบได้)
// ══════════════════════════════════════════════════════════════
/** ผลที่ต้องเกิด "ก่อน" ออร่า เพราะมันเปลี่ยนตัวเลขที่ออร่าจะไปคูณต่อ
 *  🔴 ต้องรันก่อน applyAuras เสมอ — ไม่งั้น statsSnapshot ที่ส่งให้รีเพลย์เป็นเลขก่อนขโมย
 *     แล้วเลขบนการ์ดกับดาเมจจริงจะคลาดกันเงียบๆ */
export function runSetup(team, foes) {
  const out = []
  for (const u of alive(team)) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'setup')) {
      const v = valOf(part, u)
      if (part.effect !== 'stealStats') continue
      const targets = alive(foes)
      if (!targets.length) continue
      let gotAtk = 0, gotHp = 0
      for (const f of targets) {
        const dAtk = pctOf(f.atk, v.pct)
        const dHp = pctOf(f.maxHp, v.pct)
        f.atk -= dAtk
        f.maxHp -= dHp
        f.hp = Math.min(f.hp, f.maxHp)      // เลือดปัจจุบันห้ามล้นหลอดที่หดลง
        gotAtk += dAtk
        gotHp += dHp
      }
      u.atk += gotAtk
      u.maxHp += gotHp
      u.hp += gotHp                          // ได้เลือดมาเต็มก้อนที่ขโมยได้
      const e = ev(u, p, part, { targets: targets.map(t => t.uid), amount: Math.round(gotAtk), fxKind: 'buff' })
      e.statsAfter = statsSnapshot(team, foes)
      out.push(e)
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  aura — แก้ stat ก่อนไฟต์เริ่ม (ไม่มี event, ผู้เล่นเห็นผลผ่านตัวเลขบนการ์ด)
// ══════════════════════════════════════════════════════════════
/**
 * ใส่ aura ของทีมหนึ่งลงบนทีมตัวเอง + ผลข้ามฝั่ง (enemyVuln) ลงบนศัตรู
 * ⚠️ ต้องเรียกให้ครบทั้งสองฝั่ง "ก่อน" หมัดแรก และเรียกครั้งเดียวเท่านั้น
 */
export function applyAuras(team, foes) {
  const ids = new Set(alive(team).map(u => u.id))
  const out = []
  for (const u of team) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'aura')) {
      const v = valOf(part, u)
      // ⚠️ aura ต้องเด้งป้ายตอนเริ่มด้วย — เดิมสเปกเขียนว่า "ไม่มี event เพราะเห็นผลผ่านตัวเลข"
      //    แต่เทสจอจริงพบว่าทีมที่มี aura ล้วน (เช่น whale+seal) เงียบสนิท ผู้เล่นไม่รู้เลยว่ามี passive
      //    master plan §5.5 เขียนถูกแล้วว่า "proc ตอนเริ่มเกม → ป้ายขึ้นพร้อมกันตอนเริ่ม"
      const e = ev(u, p, part, { targets: [u.uid], fxKind: 'aura' })
      out.push(e)
      switch (part.effect) {
        case 'teamHp': {
          const add = pctOf(1, v.pct)
          for (const t of team) { t.maxHp *= (1 + add); t.hp = t.maxHp }
          break
        }
        case 'teamCrit':
          for (const t of team) t.critBonus = (t.critBonus || 0) + v.pct / 100
          break
        case 'teamAtk': {
          // คู่หู: ถ้ามีเพื่อนตามที่ระบุอยู่ในทีม บัฟแรงขึ้น + ทีมได้ regen
          const duo = v.duoWith && ids.has(v.duoWith)
          const pct = duo ? v.duoPct : v.pct
          for (const t of team) t.atk *= (1 + pct / 100)
          if (duo && v.duoRegen) for (const t of team) t.teamRegenPct = (t.teamRegenPct || 0) + v.duoRegen
          break
        }
        case 'teamAtkPerElement': {
          const n = team.filter(t => t.element === v.element).length
          if (n > 0) for (const t of team) t.atk *= (1 + (v.pct * n) / 100)
          break
        }
        case 'teamRegen':
          // ใช้ช่องเดียวกับ duo whale🔗seal — ถ้ามีทั้งคู่ก็บวกกัน (ตั้งใจ)
          for (const t of team) t.teamRegenPct = (t.teamRegenPct || 0) + v.pct
          break
        case 'enemyVuln':
          for (const f of foes) f.vuln = (f.vuln || 0) + v.pct / 100
          break
        case 'elementTrinity': {
          // ต้องครบทั้ง 3 สายในทีมที่ยังไม่ตาย — ขาดสายเดียวไม่ได้อะไรเลย (all-or-nothing โดยตั้งใจ)
          const els = new Set(alive(team).map(t => t.element))
          if (els.size < 3) break
          for (const t of team) {
            t.atk *= (1 + v.pct / 100)
            t.maxHp *= (1 + v.hpPct / 100)
            t.hp = t.maxHp
          }
          break
        }
        case 'teamLifesteal':
          // แปะ % ไว้บนตัวละคร — ใช้จริงตอนตีใน runOnHit (ที่นั่นเท่านั้นที่รู้ดาเมจจริง)
          for (const t of team) t.lifestealPct = (t.lifestealPct || 0) + v.pct
          break
        case 'teamDamageReduction':
          for (const t of team) t.teamDrPct = (t.teamDrPct || 0) + v.pct
          u.teamDrPct = (u.teamDrPct || 0) + v.pct      // เจ้าของได้อีกรอบ = 2 เท่า ✅user
          break
      }
      // ⚠️ ต้องเติม "หลัง" switch — event ถูก push ไปก่อนที่ stat จะเปลี่ยนจริง
      //    ถ้าเติมตอนสร้าง ev() จะได้ snapshot ของ "ก่อนออร่าทำงาน" = เลขไม่ขยับเลยบนจอ
      if (STAT_EFFECTS.has(part.effect)) e.statsAfter = statsSnapshot(team, foes)
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  onStart — ก่อนหมัดแรก
// ══════════════════════════════════════════════════════════════
export function runOnStart(team, foes) {
  const out = []
  for (const u of alive(team)) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'onStart')) {
      const v = valOf(part, u)
      if (part.effect === 'aoeOpener') {
        const targets = alive(foes)
        if (!targets.length) continue
        const dmg = pctOf(u.atk, v.pct)
        for (const t of targets) t.hp -= dmg
        out.push(ev(u, p, part, { targets: targets.map(t => t.uid), amount: Math.round(dmg), fxKind: 'damage' }))
      } else if (part.effect === 'teamHealOpener') {
        const targets = alive(team)
        for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + pctOf(t.maxHp, v.pct))
        out.push(ev(u, p, part, { targets: targets.map(t => t.uid), amount: v.pct, fxKind: 'heal' }))
      }
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  onRound — ต้นรอบใหม่
// ══════════════════════════════════════════════════════════════
export function runOnRound(team) {
  const out = []
  for (const u of alive(team)) {
    const p = passiveFor(u)
    // regen จากคู่หู whale🔗seal ติดมากับ unit ไม่ได้มาจาก passive ของตัวเอง
    // คู่หู whale🔗seal — เดิมฟื้นเงียบไม่มี event เลย ผู้เล่นไม่เห็นว่าคู่หูทำงานอยู่
    if (u.teamRegenPct && u.hp < u.maxHp) {
      const h = healUnit(u, u.teamRegenPct)
      if (h.amount > 0) out.push({ t: 'passive', uid: u.uid, side: u.side, petId: u.id,
        name: 'รางวัลคนเก่ง', icon: '💧', effect: 'duoRegen', targets: [u.uid], ...h, fxKind: 'heal' })
    }
    for (const part of partsAt(p, 'onRound')) {
      const v = valOf(part, u)
      if (part.effect === 'regenSelf') {
        if (u.hp >= u.maxHp) continue                       // เลือดเต็มแล้วไม่ต้องเด้งป้าย
        const h = healUnit(u, v.pct)
        out.push(ev(u, p, part, { targets: [u.uid], ...h, fxKind: 'heal' }))
      } else if (part.effect === 'healLowestAlly') {
        const t = lowestHpAlly(team, u)
        if (!t || t.hp >= t.maxHp) continue
        const h = healUnit(t, v.pct)
        out.push(ev(u, p, part, { targets: [t.uid], ...h, fxKind: 'heal' }))
      }
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  onAttack — ก่อนคิดดาเมจ (คืนตัวปรับ ไม่แก้ state เอง)
// ══════════════════════════════════════════════════════════════
/**
 * คืน { target, atkMult, extra[], strikes, events }
 *   target  = เป้าหลัก (อาจถูกเปลี่ยนโดย targetLowest)
 *   atkMult = ตัวคูณดาเมจของหมัดหลัก (execute / atkWhenFull)
 *   extra   = [{ unit, pct }] เป้ารองของ cleave — โดนใน beat เดียวกัน
 *   strikes = จำนวนหมัดบนเป้าหลักใน beat เดียวกัน (multiStrike)
 */
export function runOnAttack(att, target, foes, rand) {
  const p = passiveFor(att)
  const res = { target, atkMult: 1, extra: [], strikes: 1, strikePct: 100, events: [] }
  for (const part of partsAt(p, 'onAttack')) {
    const v = valOf(part, att)
    switch (part.effect) {
      case 'targetLowest': {
        const low = alive(foes).reduce((b, f) => (!b || f.hp / f.maxHp < b.hp / b.maxHp ? f : b), null)
        if (low && low !== target) {
          res.target = low
          res.events.push(ev(att, p, part, { targets: [low.uid], fxKind: 'aim' }))
        }
        break
      }
      case 'cleave': {
        const others = alive(foes).filter(f => f !== res.target).slice(0, Math.max(0, (v.count || 1) - 1))
        if (others.length) {
          res.extra = others.map(u => ({ unit: u, pct: v.pct }))
          res.events.push(ev(att, p, part, { targets: [res.target.uid, ...others.map(u => u.uid)], fxKind: 'cleave' }))
        }
        break
      }
      case 'execute':
        if (target && target.hp / target.maxHp < (v.below / 100)) {
          res.atkMult *= 1 + v.pct / 100
          res.events.push(ev(att, p, part, { targets: [target.uid], fxKind: 'buff' }))
        }
        break
      case 'atkWhenFull':
        if (att.hp >= att.maxHp) {
          res.atkMult *= 1 + v.pct / 100
          res.events.push(ev(att, p, part, { targets: [att.uid], fxKind: 'buff' }))
        }
        break
      case 'multiStrike':
        if (rand() * 100 < v.chance) {
          res.strikes = 2
          res.strikePct = v.pct
          res.events.push(ev(att, p, part, { targets: [target?.uid].filter(Boolean), fxKind: 'multi' }))
        }
        break
    }
  }
  return res
}

// ══════════════════════════════════════════════════════════════
//  onHit — ก่อนหักเลือด (dodge / ลดดาเมจ / เปลี่ยนตัวรับ / หนาม)
// ══════════════════════════════════════════════════════════════
/**
 * คืน { dmg, dodged, thorns, events, pierce }
 *   thorns   = ดาเมจสะท้อนกลับไปที่ผู้ตี (เอนจินเป็นคนหัก)
 */
export function runOnHit(defender, dmg, attacker, team, rand) {
  // pierce = ดาเมจที่ "ไม่ผ่านสายลด" — เอนจินหักหลัง res.dmg · วันนี้มีแค่ infect (P2b) ที่ใส่ค่า
  // 🔴 ห้ามเอาไปใช้กับกลไกอื่นโดยไม่แก้สเปก: การทะลุเกราะคือเหตุผลที่ไวรัสมีอยู่
  //    ถ้าแจกให้ตัวอื่นด้วย มันจะกลายเป็นแค่ "ดาเมจเพิ่ม" อีกตัวหนึ่ง
  const res = { dmg, dodged: false, thorns: 0, pierce: 0, events: [] }

  // 1) guardian ของ "เพื่อนในทีมเดียวกัน" — ต้องเช็คก่อนของตัว defender เอง
  for (const g of alive(team)) {
    const gp = passiveFor(g)
    const gpart = partsAt(gp, 'onHit').find(x => x.effect === 'guardian')
    if (!gpart || g === defender) continue
    const low = lowestHpAlly(team, g)
    if (low !== defender) continue                     // รับแทนเฉพาะเพื่อนที่บอบช้ำที่สุด
    const share = pctOf(res.dmg, valOf(gpart, g).pct)
    g.hp -= share
    res.dmg -= share
    // ⚠️ เลือดผู้พิทักษ์ลดโดยไม่มี attack event ⇒ ถ้าไม่ส่ง hpPct หลอดของเขาจะค้างเต็มทั้งที่เลือดหาย
    res.events.push(ev(g, gp, gpart, { targets: [defender.uid], amount: Math.round(share),
      guardUid: g.uid, guardHpPct: Math.max(0, Math.round((g.hp / g.maxHp) * 100)), fxKind: 'guard' }))
    break                                              // ผู้พิทักษ์ตัวเดียวพอ
  }

  const p = passiveFor(defender)
  for (const part of partsAt(p, 'onHit')) {
    const v = valOf(part, defender)
    switch (part.effect) {
      case 'dodge':
        if (rand() * 100 < v.pct) {
          res.dodged = true
          res.dmg = 0
          res.events.push(ev(defender, p, part, { targets: [defender.uid], fxKind: 'dodge' }))
        }
        break
      case 'damageReduction': {
        const cut = pctOf(res.dmg, v.pct)
        if (cut > 0) {
          res.dmg -= cut
          res.events.push(ev(defender, p, part, { targets: [defender.uid], amount: Math.round(cut), fxKind: 'reduce' }))
        }
        break
      }
      case 'thorns':
        res.thorns = pctOf(res.dmg, v.pct)
        if (res.thorns > 0 && attacker) {
          res.events.push(ev(defender, p, part, { targets: [attacker.uid], amount: Math.round(res.thorns), fxKind: 'thorns' }))
        }
        break
    }
  }
  return res
}

// ══════════════════════════════════════════════════════════════
//  onDeath — ตอนกำลังจะตาย (คืน true = กันไว้ได้ ยังไม่ตาย)
// ══════════════════════════════════════════════════════════════
export function runOnDeath(unit, team) {
  const out = { prevented: false, events: [] }

  // 1) ของตัวเอง — revive / cheatDeath
  const p = passiveFor(unit)
  // onDeath มี part เดียวโดยธรรมชาติ: กันตายได้ครั้งเดียวต่อการตายหนึ่งครั้ง
  // ถ้าวันหนึ่งมีเพ็ทที่ revive + cheatDeath พร้อมกัน ต้องเปลี่ยนเป็น partsAt แล้วนิยามลำดับก่อน
  const part = partAt(p, 'onDeath')
  if (part && (psOf(unit).uses || 0) < (valOf(part, unit).times || 1)) {
    const v = valOf(part, unit)
    if (part.effect === 'revive') {
      psOf(unit).uses = (psOf(unit).uses || 0) + 1
      unit.hp = pctOf(unit.maxHp, v.pct)
      out.prevented = true
      out.events.push(ev(unit, p, part, { targets: [unit.uid], amount: Math.round(unit.hp),
        hpPct: Math.round((unit.hp / unit.maxHp) * 100), fxKind: 'revive' }))
      return out
    }
    if (part.effect === 'cheatDeath') {
      psOf(unit).uses = (psOf(unit).uses || 0) + 1
      unit.hp = 1
      out.prevented = true
      out.events.push(ev(unit, p, part, { targets: [unit.uid], hpPct: 1, fxKind: 'revive' }))
      return out
    }
  }

  // 2) ของเพื่อน — genie กันเพื่อนตาย 1 ครั้ง
  for (const g of alive(team)) {
    if (g === unit) continue
    const gp = passiveFor(g)
    const gpart = partsAt(gp, 'onDeath').find(x => x.effect === 'saveAlly')
    if (!gpart) continue
    if ((psOf(g).uses || 0) >= (valOf(gpart, g).times || 1)) continue
    psOf(g).uses = (psOf(g).uses || 0) + 1
    unit.hp = 1
    out.prevented = true
    out.events.push(ev(g, gp, gpart, { targets: [unit.uid], hpPct: 1, fxKind: 'save' }))
    break
  }
  return out
}

/** ใครสักคนตายจริงแล้ว — ยิงให้ทีมของ "ฝั่งที่ได้ประโยชน์" (ฝั่งตรงข้ามคนที่ตาย)
 *  ต่างจาก onKill ตรงที่ไม่สนว่าใครเป็นคนล้ม ⇒ 🦖 ได้ชั้นแม้เพื่อนเป็นคนเก็บ (P2c) */
export function runOnAnyDeath(dead, killerTeam, foes) {
  const out = []
  for (const u of alive(killerTeam)) {
    const p = passiveFor(u)
    for (const part of partsAt(p, 'onAnyDeath')) {
      const v = valOf(part, u)
      if (part.effect !== 'stackAtk') continue
      const st = psOf(u)
      const stacks = st.atkStacks || 0
      if (stacks >= v.max) continue
      st.atkStacks = stacks + 1
      u.atk *= 1 + v.pct / 100
      const e = ev(u, p, part, { targets: [u.uid], amount: st.atkStacks, fxKind: 'buff' })
      if (killerTeam && foes) e.statsAfter = statsSnapshot(killerTeam, foes)
      out.push(e)
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  onKill — หลังศัตรูตายจริง (onDeath ต้องผ่านไปแล้ว)
// ══════════════════════════════════════════════════════════════
/** คืน { extraAttack, events } — extraAttack = true ให้เอนจินตีต่ออีก 1 หมัด (beat เพิ่มจริง) */
export function runOnKill(killer, chainUsed, team, foes) {
  const out = { extraAttack: false, events: [] }
  const p = passiveFor(killer)
  for (const part of partsAt(p, 'onKill')) {
    const v = valOf(part, killer)
    if (part.effect === 'stackAtk') {
      const st = psOf(killer)
      const stacks = st.atkStacks || 0
      if (stacks < v.max) {
        st.atkStacks = stacks + 1
        killer.atk *= 1 + v.pct / 100
        const e = ev(killer, p, part, { targets: [killer.uid], amount: st.atkStacks, fxKind: 'buff' })
        if (team && foes) e.statsAfter = statsSnapshot(team, foes)
        out.events.push(e)
      }
    } else if (part.effect === 'killChain') {
      if (chainUsed < v.max) {
        out.extraAttack = true
        out.events.push(ev(killer, p, part, { targets: [killer.uid], fxKind: 'chain' }))
      }
    }
  }
  return out
}
