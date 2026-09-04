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

/** "อัตราส่วนนี้เป็นกี่ขั้นละ 10%" — ปัดลง แต่ต้องไม่พลาดที่เส้นพอดี
 *  🔴 ห้ามเขียน Math.floor(ratio * 10) ตรงๆ: ratio มาจากการลบ float
 *     `1.2 - 1 = 0.19999999999999996` ⇒ ×10 = 1.9999999999999996 ⇒ floor ได้ 1 ทั้งที่ต้องได้ 2
 *     และเส้นพวกนี้เจอบ่อยของจริง เพราะ maxHp มาจากตารางตัวคูณ rarity/grade ที่ลงตัวสวยๆ
 *     (เลือดเหลือ 80%/90% เป๊ะ · เป้าใหญ่กว่า 1.2×/1.4× เป๊ะ) — 1e-9 เล็กกว่าความละเอียดที่เกมใช้จริงมาก */
const stepsOf10 = (ratio) => Math.floor(ratio * 10 + 1e-9)

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
 *     (เกิดมาแล้ว 28 ส.ค. `f32b519`: ฮีลแล้วหลอดขึ้นแต่เลข +N ไม่ขึ้น เพราะ 'heal' ถูกทับด้วย 'skill')
 *
 *  📐 กติกาของ `targets` กับ `amount` — เขียนไว้ตรงนี้เพราะ P2c (ชั้นชิป) จะอ่านสองฟิลด์นี้
 *     แล้วถ้าแต่ละ effect ตีความคนละแบบ ชิปจะพิมพ์เลขมั่วโดยไม่มีเทสจับ:
 *       `targets` = การ์ดที่ "ผลไปลง" (คนที่โดน/คนที่ได้) ⇒ FX กับหลอดเลือดยิงที่ใบนั้น
 *       `amount`  = เลขที่ชิปต้องพิมพ์ในหน่วยของ effect นั้น
 *     - `fxKind: 'heal'|'revive'` → targets = คนที่ถูกฟื้น · amount = เลือดจริงที่ฟื้นได้ (+ ส่ง `hpPct` ด้วย)
 *     - `fxKind: 'damage'|'thorns'` → targets = คนที่กิน · amount = ดาเมจจริง
 *     - `fxKind: 'buff'` → **targets = ตัวที่ได้บัฟ (ไม่ใช่เป้าที่ไปตี)** ·
 *       amount = "เลขของบัฟนั้น": `stackAtk`/`atkOnHit` = จำนวนชั้นสะสม (battleBuffs.liveBuffs อ่านเป็นชั้น)
 *       ส่วนตัวที่ไม่ได้สะสมชั้น (`berserk`/`giantSlayer`) = **% ดาเมจที่เพิ่มได้จริงรอบนี้** (ปัดจำนวนเต็ม)
 *       ⚠️ giantSlayer ห้ามส่งเป็น "จำนวนขั้น" เพราะมันมีเพดาน `max` ⇒ ขั้นกับ % ไม่ตรงกันเมื่อชนเพดาน */
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
          u.teamDrPct = (u.teamDrPct || 0) + v.pct      // เจ้าของได้อีกรอบ = 2 เท่า (user เคาะ 3 ก.ย.)
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

/** ตัวที่ถูกบังคับให้เป็นเป้าในรอบนี้ (taunt) — คืน null ถ้าไม่มีใครบังคับ
 *  🔴 กอริลลา 2 ตัวในทีมเดียว = เอาช่องซ้ายสุดเสมอ · ต้อง deterministic ไม่งั้นรีเพลย์ไม่ตรงกับผลจริง
 *  🔴 ห้ามดึง rand ในฟังก์ชันนี้ — ลำดับการดึงสุ่มของเอนจินต้องไม่เปลี่ยน ไม่งั้นไฟต์เดิมทั้งเกมเพี้ยน */
export function tauntTargetOf(foes) {
  for (const u of alive(foes)) {
    const part = partsAt(passiveFor(u), 'onRound').find(x => x.effect === 'taunt')
    if (part) return u
  }
  return null
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
        if (tauntTargetOf(foes)) break        // ถูกบังคับอยู่ — ลำดับในสเปก: taunt > targetLowest
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
      case 'berserk': {
        // ขั้นละ 10% ของเลือดที่หายไป — ปัดลง (เลือด 40% = หาย 60% = 6 ขั้น)
        const steps = stepsOf10(1 - att.hp / att.maxHp)
        if (steps > 0) {
          const pct = steps * v.pct
          res.atkMult *= 1 + pct / 100
          res.events.push(ev(att, p, part, { targets: [att.uid], amount: Math.round(pct), fxKind: 'buff' }))
        }
        break
      }
      case 'giantSlayer': {
        // ขั้นละ 10% ที่ maxHp ของเป้าสูงกว่าเรา · เพดานที่ v.max
        if (!target) break
        const steps = stepsOf10(target.maxHp / att.maxHp - 1)
        if (steps > 0) {
          const pct = Math.min(steps * v.pct, v.max)
          res.atkMult *= 1 + pct / 100
          // targets = ตัวที่ได้บัฟ (ผู้ตี) ไม่ใช่เป้าที่ไปตี — ดูกติกาใน docblock ของ ev()
          res.events.push(ev(att, p, part, { targets: [att.uid], amount: Math.round(pct), fxKind: 'buff' }))
        }
        break
      }
      // 🔴 healOnAttack ก็ hook: 'onAttack' ในข้อมูล แต่คำนวณใน runOnDealt (ข้างล่างนี้) — ดูคอมเมนต์ที่นั่น
    }
  }
  return res
}

/** ── ผลฝั่ง "ผู้ตี" ที่ต้องรู้ดาเมจจริงถึงจะคิดได้ ──
 *  เรียกทันทีหลัง runOnHit ของหมัดนั้น (เอนจิน push event ต่อจากกันเลย ⇒ ลำดับบนจอไม่เปลี่ยน)
 *  คืน { events }
 *
 *  🔴 hook ในข้อมูลของ effect พวกนี้คือ `onAttack` (มุมผู้เล่น: "เมื่อฉันตี") แต่คิดที่นี่
 *     เพราะ runOnAttack ยังไม่รู้ดาเมจจริง — ใครอ่าน runOnAttack แล้วหา healOnAttack/ดูดเลือดไม่เจอ ให้มาดูตรงนี้
 *  🔑 แยกออกจาก runOnHit เพราะ runOnHit เป็นมุมของ "ผู้รับ" ล้วน — เดิมรับทีมผู้ตีเป็นพารามิเตอร์
 *     ตัวที่ 6 (`attTeam = null`) ต่อท้ายพารามิเตอร์ชื่อ `team` ที่แปลว่าทีมผู้รับ ⇒ สลับกันได้ง่ายมาก
 *     และถ้าลืมส่ง ผลฝั่งผู้ตีจะเงียบหายโดยไม่มีใครรู้ · P2b ยังจะเติม taunt/infect เข้ามาอีก
 *  @param {object} attacker  ตัวที่ตี
 *  @param {Array}  attTeam   ทีมของผู้ตี (ต้องมี ไม่งั้นหาเพื่อนที่บอบช้ำสุดไม่ได้)
 *  @param {number} dealt     ดาเมจที่ลงจริงกับเป้าในหมัดนี้ (res.dmg + res.pierce)
 */
export function runOnDealt(attacker, attTeam, dealt) {
  const out = { events: [] }
  // 🔴 ผู้ตีอาจตายไปแล้วระหว่างบีตนี้ (โดนหนามสวนตอน sub-hit ก่อนหน้า) — เอนจินไม่ได้เช็คเลือด
  //    ผู้ตีระหว่าง cleave/multiStrike · ถ้าปล่อยให้ teamLifesteal ทำงานต่อ มันจะดูดเลือดตัวเอง
  //    กลับขึ้นมาเกิน 0 โดยไม่เคยผ่าน runOnDeath = ฟื้นคืนชีพโดยไม่เคยตายอย่างเป็นทางการ
  if (!attacker || attacker.hp <= 0 || !attTeam || dealt <= 0) return out

  const ap = passiveFor(attacker)
  for (const part of partsAt(ap, 'onAttack')) {
    if (part.effect !== 'healOnAttack') continue
    // 🔑 ยิงครั้งเดียวต่อ "หมัดลูก" หนึ่งใบ (cleave/multiStrike ยิงหลายรอบต่อ beat) — ตั้งใจ ✅ user เคาะ:
    //    สูตรเป็นเชิงเส้น (pct ของดาเมจ) ⇒ รวมทั้ง beat แล้วได้เท่ากับคิดทีเดียวจากดาเมจรวมเป๊ะ
    //    และการเลือกเป้าใหม่ทุกหมัดลูกทำให้ "ฟื้นให้คนที่บอบช้ำที่สุด ณ วินาทีนั้น" ซึ่งเป็นพฤติกรรมที่ดีกว่า
    //    (คิดทีเดียวตอนจบ beat = เทเลือดก้อนเดียวใส่คนเดียว อาจล้นหลอดทิ้งทั้งที่อีกคนกำลังจะตาย)
    const t = lowestHpAlly(attTeam, attacker)
    if (!t || t.hp >= t.maxHp) continue
    const before = t.hp
    t.hp = Math.min(t.maxHp, t.hp + pctOf(dealt, valOf(part, attacker).pct))
    const amount = Math.round(t.hp - before)
    if (amount > 0) {
      out.events.push(ev(attacker, ap, part, { targets: [t.uid], amount,
        hpPct: Math.round((t.hp / t.maxHp) * 100), fxKind: 'heal' }))
    }
  }

  // ดูดเลือดของทีม (teamLifesteal) — applyAuras แปะ % ไว้บนตัวละคร ที่นี่คือที่เดียวที่รู้ดาเมจจริง
  // 🔑 event ไม่ผ่าน ev() เพราะ "เจ้าของออร่า" อาจเป็นเพื่อนคนละตัวกับคนที่ได้ดูด — ชื่อ/ไอคอนของ
  //    พาสสีฟตัวเองจึงใช้ไม่ได้ · ใช้แพทเทิร์นเดียวกับ duoRegen ใน runOnRound (คำกลาง + ไอคอนของ *ผล*)
  if (attacker.lifestealPct > 0) {
    const before = attacker.hp
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + pctOf(dealt, attacker.lifestealPct))
    const amount = Math.round(attacker.hp - before)
    if (amount > 0) {
      out.events.push({
        t: 'passive', uid: attacker.uid, side: attacker.side, petId: attacker.id,
        name: 'ดูดเลือด', icon: '🩸', effect: 'teamLifesteal', targets: [attacker.uid],
        amount, hpPct: Math.round((attacker.hp / attacker.maxHp) * 100), fxKind: 'heal',
      })
    }
  }

  return out
}

// ══════════════════════════════════════════════════════════════
//  onHit — ก่อนหักเลือด (dodge / ลดดาเมจ / เปลี่ยนตัวรับ / หนาม)
// ══════════════════════════════════════════════════════════════
/**
 * คืน { dmg, dodged, thorns, events, pierce, reflect }
 *   thorns   = ดาเมจสะท้อนกลับไปที่ผู้ตี (เอนจินเป็นคนหัก)
 *   reflect  = ดาเมจดิบที่ต้องยิงใส่ศัตรูทุกตัวของผู้รับ ผ่าน strike() ปกติ (armorStack, สเปก §4.3)
 */
export function runOnHit(defender, dmg, attacker, team, rand, forced = false) {
  // pierce = ดาเมจที่ "ไม่ผ่านสายลด" — เอนจินหักหลัง res.dmg · วันนี้มีแค่ infect (P2b) ที่ใส่ค่า
  // 🔴 ห้ามเอาไปใช้กับกลไกอื่นโดยไม่แก้สเปก: การทะลุเกราะคือเหตุผลที่ไวรัสมีอยู่
  //    ถ้าแจกให้ตัวอื่นด้วย มันจะกลายเป็นแค่ "ดาเมจเพิ่ม" อีกตัวหนึ่ง
  const res = { dmg, dodged: false, thorns: 0, pierce: 0, reflect: 0, events: [] }

  // 1) guardian ของ "เพื่อนในทีมเดียวกัน" — ต้องเช็คก่อนของตัว defender เอง
  // 🔑 ส่วนที่ผู้พิทักษ์รับไปถูกหักออกจากดาเมจ "ก่อน" teamDrPct และก่อน damageReduction ทุกตัว
  //    ⇒ ก้อนนั้นไม่ผ่านสายลดเลยแม้แต่ชั้นเดียว (ผู้พิทักษ์กินเต็มๆ ตามสัดส่วนที่รับ)
  //    เป็นไปตามสเปก ตั้งใจให้เป็นแบบนี้: การ์ดของผู้พิทักษ์คือ "เอาตัวเข้าแลก" ไม่ใช่ "ลดดาเมจอีกชั้น"
  //    ถ้าย้ายไปหักทีหลัง เกราะของเป้าจะไปลดก้อนที่เพื่อนเป็นคนกินด้วย = ผู้พิทักษ์ได้ประโยชน์จากเกราะคนอื่น
  //    ⚠️ อย่าเพิ่งคิดว่าเป็นบั๊กแล้วสลับลำดับ — มีเทสของสายลดคุมตัวเลขนี้อยู่
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

  // ลดดาเมจของออร่าทีม — หักก่อน แล้ว damageReduction ของตัวเองหักต่อเป็นทอด
  // (ไม่ใช่บวก % กัน: 20% + 12% ≠ 32% แต่เป็น ×0.8×0.88 = ลดจริง 29.6%)
  if (defender.teamDrPct > 0) res.dmg -= pctOf(res.dmg, defender.teamDrPct)

  // taunt — ลดเฉพาะหมัดที่ถูกดึงมาหาเจ้าตัว ไม่ใช่ตลอดเวลา (สเปก §4.2)
  // flag มาจากเอนจินซึ่งเป็นคนรู้ว่าเป้าถูกบังคับหรือเลือกเอง — ห้ามให้ที่นี่เดาเอง
  const p0 = passiveFor(defender)
  if (forced) {
    const tp = partsAt(p0, 'onRound').find(x => x.effect === 'taunt')
    if (tp) res.dmg -= pctOf(res.dmg, valOf(tp, defender).pct)
  }

  const p = p0
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
      case 'armorStack': {
        // กันไว้เผื่อเพ็ทวันหน้ามี armorStack 2 part บนตัวเดียว (วันนี้ยังไม่มี, ทะเบียนล็อกอยู่):
        // ถ้าไม่กันตรงนี้ part ที่สองจะเห็น res.dmg = 0 จาก part แรกไปแล้ว แล้วคำนวณ
        // res.reflect = pctOf(0, pct) = 0 ทับค่าที่ถูกต้องของ part แรก ทั้งที่ยังกินสแตคไปฟรีอีก 1 ชั้น
        if (res.reflect > 0) break
        const st = psOf(defender)
        // เติมสแตคครั้งเดียวตอนโดนหมัดแรกของไฟต์ — ไม่มีการเติมซ้ำระหว่างไฟต์ (สเปก §4.3)
        if (st.armor === undefined) st.armor = v.count
        if (st.armor <= 0) break
        st.armor -= 1
        res.reflect = pctOf(res.dmg, v.pct)
        res.dmg = 0                                  // กันทั้งหมัด ไม่ใช่โล่ที่มีค่าเลือด
        res.events.push(ev(defender, p, part, { targets: [defender.uid],
          amount: st.armor, fxKind: 'guard' }))
        break
      }
    }
  }

  // พื้นดาเมจ — หนีบครั้งเดียวหลังสายลดจบ
  // 🔴 teamDrPct เป็น "ลดแบบบวก %" ตัวเดียวในไฟล์นี้ และ**ไม่มีเพดาน** (ออร่าซ้อนกันหลายตัวได้)
  //    ถ้าเกิน 100% ขึ้นมา res.dmg จะติดลบ แล้วเอนจินทำ `tg.hp -= dmg` = หมัดนั้นกลายเป็นการฟื้นเลือดให้เป้า
  //    (ตัวลดอื่นหักเป็นทอด ×(1-p) จึงเข้าใกล้ 0 ได้แต่ไม่มีวันติดลบ)
  res.dmg = Math.max(0, res.dmg)

  // atkOnHit — ต้องรู้ผลสุดท้ายของสายลดก่อนถึงจะตอบได้ว่า "โดนตี" จริงไหม
  // 🔴 อยู่นอกลูปโดยตั้งใจ: ถ้าอยู่ในลูป ผลจะขึ้นกับ *ลำดับ part ในข้อมูล* — เพ็ทที่เขียน
  //    [damageReduction, dodge] จะสะสมชั้น ส่วน [dodge, damageReduction] จะไม่สะสม ทั้งที่หลบเหมือนกัน
  //    (สเปก §7.4 ข้อ 6 เตือนเรื่องลำดับ part ไว้แล้ว — ตรงนี้คือการถอดความขึ้นกับลำดับออกให้หมด)
  if (res.dmg > 0) {
    for (const part of partsAt(p, 'onHit')) {
      if (part.effect !== 'atkOnHit') continue
      const v = valOf(part, defender)
      const st = psOf(defender)
      st.rage = (st.rage || 0) + 1
      defender.atk *= 1 + v.pct / 100
      const e = ev(defender, p, part, { targets: [defender.uid], amount: st.rage, fxKind: 'buff' })
      e.statsAfter = statsSnapshot(team)
      res.events.push(e)
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
