// src/utils/battlePassives.js
// ตรรกะ passive — pure ทั้งหมด ไม่แตะ store/DOM/Date · สุ่มทุกจุดต้องรับ rand จากเอนจิน (deterministic)
// data อยู่ที่ src/data/petPassives.js · สเปก: docs/superpowers/specs/2026-08-27-passive-v1-design.md
//
// 🔒 กฎเหล็ก: passive ไม่เพิ่มจำนวน beat — cleave/multiStrike อยู่ใน beat เดียวกับหมัดหลัก
//    (ยิงเป็น event `passive` ที่ battleBeats ให้ timing ZERO ⇒ ไม่กินเวลา)
//    killChain เป็นข้อยกเว้นเดียวที่เพิ่ม beat จริง จึงมีเพดาน
import { PET_PASSIVES, passiveValueAt } from '../data/petPassives.js'

export const passiveFor = (unit) => PET_PASSIVES[unit?.id] || null

/** ค่าของ passive ตามขั้นที่เพ็ทตัวนั้นอัพไว้ (ยังไม่มีระบบหิน ⇒ undefined = ขั้น 1)
 *  ⚠️ ห้ามอ่าน p.value ตรงๆ ในตรรกะ — ไม่งั้นพอระบบหินมา ค่าจะไม่ขยับตามขั้น */
const valOf = (p, unit) => passiveValueAt(p, unit?.passiveLv)
const alive = (t) => t.filter(u => u.hp > 0)
const pctOf = (v, pct) => v * (pct / 100)

/** สร้าง event สำหรับ log — รูปเดียวกับที่ BattleReplay/battleBeats รับ */
function ev(unit, p, extra = {}) {
  return { t: 'passive', uid: unit.uid, side: unit.side, petId: unit.id, name: p.name, icon: p.icon, effect: p.effect, ...extra }
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
    if (!p || p.hook !== 'aura') continue
    const v = valOf(p, u)
    // ⚠️ aura ต้องเด้งป้ายตอนเริ่มด้วย — เดิมสเปกเขียนว่า "ไม่มี event เพราะเห็นผลผ่านตัวเลข"
    //    แต่เทสจอจริงพบว่าทีมที่มี aura ล้วน (เช่น whale+seal) เงียบสนิท ผู้เล่นไม่รู้เลยว่ามี passive
    //    master plan §5.5 เขียนถูกแล้วว่า "proc ตอนเริ่มเกม → ป้ายขึ้นพร้อมกันตอนเริ่ม"
    out.push(ev(u, p, { targets: [u.uid], kind: 'aura' }))
    switch (p.effect) {
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
    if (!p || p.hook !== 'onStart') continue
    const v = valOf(p, u)
    if (p.effect === 'aoeOpener') {
      const targets = alive(foes)
      if (!targets.length) continue
      const dmg = pctOf(u.atk, v.pct)
      for (const t of targets) t.hp -= dmg
      out.push(ev(u, p, { targets: targets.map(t => t.uid), amount: Math.round(dmg), kind: 'damage' }))
    } else if (p.effect === 'teamHealOpener') {
      const targets = alive(team)
      for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + pctOf(t.maxHp, v.pct))
      out.push(ev(u, p, { targets: targets.map(t => t.uid), amount: v.pct, kind: 'heal' }))
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
    if (u.teamRegenPct && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + pctOf(u.maxHp, u.teamRegenPct))
    if (!p || p.hook !== 'onRound') continue
    const v = valOf(p, u)
    if (p.effect === 'regenSelf') {
      if (u.hp >= u.maxHp) continue                       // เลือดเต็มแล้วไม่ต้องเด้งป้าย
      u.hp = Math.min(u.maxHp, u.hp + pctOf(u.maxHp, v.pct))
      out.push(ev(u, p, { targets: [u.uid], amount: v.pct, kind: 'heal' }))
    } else if (p.effect === 'healLowestAlly') {
      const t = lowestHpAlly(team, u)
      if (!t || t.hp >= t.maxHp) continue
      t.hp = Math.min(t.maxHp, t.hp + pctOf(t.maxHp, v.pct))
      out.push(ev(u, p, { targets: [t.uid], amount: v.pct, kind: 'heal' }))
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
  if (!p || p.hook !== 'onAttack') return res
  const v = valOf(p, att)
  switch (p.effect) {
    case 'targetLowest': {
      const low = alive(foes).reduce((b, f) => (!b || f.hp / f.maxHp < b.hp / b.maxHp ? f : b), null)
      if (low && low !== target) {
        res.target = low
        res.events.push(ev(att, p, { targets: [low.uid], kind: 'aim' }))
      }
      break
    }
    case 'cleave': {
      const others = alive(foes).filter(f => f !== res.target).slice(0, Math.max(0, (v.count || 1) - 1))
      if (others.length) {
        res.extra = others.map(u => ({ unit: u, pct: v.pct }))
        res.events.push(ev(att, p, { targets: [res.target.uid, ...others.map(u => u.uid)], kind: 'cleave' }))
      }
      break
    }
    case 'execute':
      if (target && target.hp / target.maxHp < (v.below / 100)) {
        res.atkMult *= 1 + v.pct / 100
        res.events.push(ev(att, p, { targets: [target.uid], kind: 'buff' }))
      }
      break
    case 'atkWhenFull':
      if (att.hp >= att.maxHp) {
        res.atkMult *= 1 + v.pct / 100
        res.events.push(ev(att, p, { targets: [att.uid], kind: 'buff' }))
      }
      break
    case 'multiStrike':
      if (rand() * 100 < v.chance) {
        res.strikes = 2
        res.strikePct = v.pct
        res.events.push(ev(att, p, { targets: [target?.uid].filter(Boolean), kind: 'multi' }))
      }
      break
  }
  return res
}

// ══════════════════════════════════════════════════════════════
//  onHit — ก่อนหักเลือด (dodge / ลดดาเมจ / เปลี่ยนตัวรับ / หนาม)
// ══════════════════════════════════════════════════════════════
/**
 * คืน { dmg, absorber, dodged, thorns, events }
 *   absorber = ตัวที่รับดาเมจจริง (guardian อาจไม่ใช่ defender)
 *   thorns   = ดาเมจสะท้อนกลับไปที่ผู้ตี (เอนจินเป็นคนหัก)
 */
export function runOnHit(defender, dmg, attacker, team, rand) {
  const res = { dmg, absorber: defender, dodged: false, thorns: 0, events: [] }

  // 1) guardian ของ "เพื่อนในทีมเดียวกัน" — ต้องเช็คก่อนของตัว defender เอง
  for (const g of alive(team)) {
    const gp = passiveFor(g)
    if (!gp || gp.hook !== 'onHit' || gp.effect !== 'guardian' || g === defender) continue
    const low = lowestHpAlly(team, g)
    if (low !== defender) continue                     // รับแทนเฉพาะเพื่อนที่บอบช้ำที่สุด
    const share = pctOf(res.dmg, valOf(gp, g).pct)
    g.hp -= share
    res.dmg -= share
    res.events.push(ev(g, gp, { targets: [defender.uid], amount: Math.round(share), kind: 'guard' }))
    break                                              // ผู้พิทักษ์ตัวเดียวพอ
  }

  const p = passiveFor(defender)
  if (!p || p.hook !== 'onHit') return res
  const v = valOf(p, defender)
  switch (p.effect) {
    case 'dodge':
      if (rand() * 100 < v.pct) {
        res.dodged = true
        res.dmg = 0
        res.events.push(ev(defender, p, { targets: [defender.uid], kind: 'dodge' }))
      }
      break
    case 'damageReduction': {
      const cut = pctOf(res.dmg, v.pct)
      if (cut > 0) {
        res.dmg -= cut
        res.events.push(ev(defender, p, { targets: [defender.uid], amount: Math.round(cut), kind: 'reduce' }))
      }
      break
    }
    case 'thorns':
      res.thorns = pctOf(res.dmg, v.pct)
      if (res.thorns > 0 && attacker) {
        res.events.push(ev(defender, p, { targets: [attacker.uid], amount: Math.round(res.thorns), kind: 'thorns' }))
      }
      break
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
  if (p && p.hook === 'onDeath' && (unit.passiveUses || 0) < (valOf(p, unit).times || 1)) {
    const v = valOf(p, unit)
    if (p.effect === 'revive') {
      unit.passiveUses = (unit.passiveUses || 0) + 1
      unit.hp = pctOf(unit.maxHp, v.pct)
      out.prevented = true
      out.events.push(ev(unit, p, { targets: [unit.uid], amount: Math.round(unit.hp), kind: 'revive' }))
      return out
    }
    if (p.effect === 'cheatDeath') {
      unit.passiveUses = (unit.passiveUses || 0) + 1
      unit.hp = 1
      out.prevented = true
      out.events.push(ev(unit, p, { targets: [unit.uid], kind: 'revive' }))
      return out
    }
  }

  // 2) ของเพื่อน — genie กันเพื่อนตาย 1 ครั้ง
  for (const g of alive(team)) {
    if (g === unit) continue
    const gp = passiveFor(g)
    if (!gp || gp.hook !== 'onDeath' || gp.effect !== 'saveAlly') continue
    if ((g.passiveUses || 0) >= (valOf(gp, g).times || 1)) continue
    g.passiveUses = (g.passiveUses || 0) + 1
    unit.hp = 1
    out.prevented = true
    out.events.push(ev(g, gp, { targets: [unit.uid], kind: 'save' }))
    break
  }
  return out
}

// ══════════════════════════════════════════════════════════════
//  onKill — หลังศัตรูตายจริง (onDeath ต้องผ่านไปแล้ว)
// ══════════════════════════════════════════════════════════════
/** คืน { extraAttack, events } — extraAttack = true ให้เอนจินตีต่ออีก 1 หมัด (beat เพิ่มจริง) */
export function runOnKill(killer, chainUsed) {
  const out = { extraAttack: false, events: [] }
  const p = passiveFor(killer)
  if (!p || p.hook !== 'onKill') return out
  const v = valOf(p, killer)
  if (p.effect === 'stackAtk') {
    const stacks = killer.atkStacks || 0
    if (stacks < v.max) {
      killer.atkStacks = stacks + 1
      killer.atk *= 1 + v.pct / 100
      out.events.push(ev(killer, p, { targets: [killer.uid], amount: killer.atkStacks, kind: 'buff' }))
    }
  } else if (p.effect === 'killChain') {
    if (chainUsed < v.max) {
      out.extraAttack = true
      out.events.push(ev(killer, p, { targets: [killer.uid], kind: 'chain' }))
    }
  }
  return out
}
