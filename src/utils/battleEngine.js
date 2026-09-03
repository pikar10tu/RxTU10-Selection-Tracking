// ════════════════════════════════════════════════════════════
//  Battle engine — pure + deterministic (seeded) · พอร์ตจาก
//  scripts/battle-sim.mjs (resolve) + บันทึก log ทุก action ให้ UI replay
//  ไม่มี side effect — ไม่อ่าน store/Firestore/Date.now
// ════════════════════════════════════════════════════════════
import { BATTLE_CFG, buildCombatant, elementMult } from '../data/battle.js'
import {
  runSetup, applyAuras, runOnStart, runOnRound, runOnAttack, runOnHit, runOnDeath, runOnKill, runOnAnyDeath, statsSnapshot,
} from './battlePassives.js'

// mulberry32 — RNG เดียวกับ sim
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const alive = (t) => t.filter(f => f.hp > 0)

/** teamA/teamB = array ของ {id,rarity,element,grade} (≤4) · seed = int */
export function simulateBattle(teamA, teamB, seed) {
  const rand = rng(seed)
  const A = (teamA || []).map((p, i) => ({ ...buildCombatant(p), id: p?.id, uid: `A${i}`, side: 'A' }))
  const B = (teamB || []).map((p, i) => ({ ...buildCombatant(p), id: p?.id, uid: `B${i}`, side: 'B' }))
  const log = []

  // ── ลำดับ hook ที่ห้ามสลับ (สเปก §B): setup → aura → onStart → [onRound] → onAttack → onHit → onDeath → onKill ──
  // setup ต้องมาก่อน aura — stealStats เปลี่ยนเลขดิบที่ออร่าจะไปคูณต่อ
  for (const e of [...runSetup(A, B), ...runSetup(B, A)]) log.push(e)
  const auraEvents = [...applyAuras(A, B), ...applyAuras(B, A)]
  for (const e of auraEvents) log.push(e)
  // สเตตัสหลัง aura ก่อนหมัดแรก = "ตัวหารจริง" ของหลอดเลือดฝั่ง UI
  // (targetHpAfter ใน log อยู่บนสเกลนี้ ไม่ใช่ค่าดิบ — ใช้ค่าดิบแล้วทีมที่มีคุณวาฬหลอดจะเกิน 100%)
  const units = statsSnapshot(A, B)
  for (const e of [...runOnStart(A, B), ...runOnStart(B, A)]) log.push(e)

  const pick = (foes) => { const al = alive(foes); return al.length ? al[Math.floor(rand() * al.length)] : null }

  /** หักเลือด 1 ครั้ง + บันทึก log · คืน true ถ้าเป้าตายจริง (ผ่าน onDeath แล้ว) */
  const strike = (att, tg, foes, mult, tier, sub) => {
    const before = tg.hp
    // onHit: guardian (เพื่อนรับแทน) → dodge → ลดดาเมจ → หนาม
    const hitRes = runOnHit(tg, Math.max(0, mult), att, foes, rand)
    for (const e of hitRes.events) log.push(e)
    tg.hp -= hitRes.dmg
    // ดาเมจทะลุ (infect) — หักหลังสายลดจบแล้ว จึงไม่โดน guardian/dodge/DR/เกราะ
    // ยังอยู่ใน beat เดิม และ attack event คิด dmg จาก before-after อยู่แล้ว หลอดเลือดจึงตรงเอง
    if (hitRes.pierce > 0) tg.hp -= hitRes.pierce
    if (hitRes.thorns > 0) att.hp -= hitRes.thorns

    let dead = tg.hp <= 0
    if (dead) {
      const d = runOnDeath(tg, foes)          // foes (จากมุมผู้ตี) = ทีมของ tg
      for (const e of d.events) log.push(e)
      if (d.prevented) dead = false
    }
    if (dead) {
      // ฝั่งที่ได้ประโยชน์คือทีมของผู้ตี — ไม่ว่าใครเป็นคนลงมือจริง
      const killerTeam = att.side === 'A' ? A : B
      for (const e of runOnAnyDeath(tg, killerTeam, foes)) log.push(e)
    }
    log.push({
      t: 'attack', side: att.side, attacker: att.uid, target: tg.uid,
      dmg: Math.round(before - tg.hp), crit: !!tier?.crit, eff: tier?.eff || 'neutral',
      dodged: hitRes.dodged,
      // 🔒 sub = หมัดลูกใน beat เดียวกัน (cleave/multiStrike) — battleBeats ให้ timing ZERO
      //    ถ้าไม่ตั้ง flag นี้ ทุกเป้ารองจะกลายเป็น "จังหวะหมัด" ใหม่ = ไฟต์ยืดทันที (กฎเหล็กพัง)
      ...(sub ? { sub: true } : {}),
      targetHpAfter: Math.max(0, Math.round(tg.hp)), dead,
    })
    return dead
  }

  /** 1 หมัด = 1 beat · cleave/multiStrike อยู่ในหมัดเดียวกัน (กฎเหล็ก: ห้ามเพิ่ม beat) */
  const hit = (att, foes) => {
    let tg = pick(foes)
    if (!tg) return false
    const mod = runOnAttack(att, tg, foes, rand)
    for (const e of mod.events) log.push(e)
    tg = mod.target || tg

    let m = elementMult(att.element, tg.element)
    const eff = m > 1 ? 'super' : (m < 1 ? 'weak' : 'neutral')  // ธาตุล้วน ก่อนคูณ crit/variance
    const crit = rand() < (BATTLE_CFG.critRate + (att.critBonus || 0))
    if (crit) m *= BATTLE_CFG.critMult
    m *= 1 + (rand() * 2 - 1) * BATTLE_CFG.variance
    m *= mod.atkMult * (1 + (tg.vuln || 0))
    const base = att.atk * m

    // หมัดหลัก (multiStrike = ตีซ้ำเป้าเดิมใน beat เดียว ทีละ strikePct)
    const perHit = mod.strikes > 1 ? base * (mod.strikePct / 100) : base
    let killed = false
    for (let i = 0; i < mod.strikes; i++) {
      if (tg.hp <= 0) break
      if (strike(att, tg, foes, perHit, { crit, eff }, i > 0)) killed = true
    }
    // เป้ารองของ cleave — ดาเมจลดตาม pct · ยังอยู่ beat เดียวกัน
    for (const x of mod.extra) {
      if (x.unit.hp <= 0) continue
      if (strike(att, x.unit, foes, base * (x.pct / 100), { crit: false, eff: 'neutral' }, true)) killed = true
    }
    return killed
  }

  const countAlive = (t) => t.reduce((n, f) => n + (f.hp > 0 ? 1 : 0), 0)
  // หาตัวออกตี: ไล่จาก cursor ไปขวา วนกลับมาซ้าย เจอตัวแรกที่ยังไม่ตาย (-1 = ไม่มี)
  const nextAttacker = (team, cursor) => {
    const n = team.length
    for (let k = 0; k < n; k++) { const i = (cursor + k) % n; if (team[i].hp > 0) return i }
    return -1
  }

  // ใครก่อน: ฝั่งตัวเยอะกว่าตีก่อน · เท่ากัน → สุ่ม (ดึงจาก rand เดิม คง deterministic)
  const ca = countAlive(A), cb = countAlive(B)
  const first = ca > cb ? 'A' : cb > ca ? 'B' : (rand() < 0.5 ? 'A' : 'B')
  const cursor = { A: 0, B: 0 }
  let cur = first, round = 0, turns = 0

  while (alive(A).length && alive(B).length && turns < BATTLE_CFG.maxTurns) {
    if (cur === first) {
      round++; log.push({ t: 'round', n: round })
      for (const e of [...runOnRound(A), ...runOnRound(B)]) log.push(e)
    }
    const team = cur === 'A' ? A : B
    const foes = cur === 'A' ? B : A
    const ai = nextAttacker(team, cursor[cur])
    if (ai !== -1) {
      const att = team[ai]
      let killed = hit(att, foes)
      // killChain — "ตัวเดียวที่เพิ่ม beat ได้" จึงมีเพดานจาก value.max และหยุดทันทีที่ศัตรูหมด
      let chain = 0
      while (killed && alive(foes).length && turns < BATTLE_CFG.maxTurns) {
        const k = runOnKill(att, chain, team, foes)
        for (const e of k.events) log.push(e)
        if (!k.extraAttack) break
        chain++; turns++
        killed = hit(att, foes)
      }
      if (killed) { const k = runOnKill(att, chain, team, foes); for (const e of k.events) log.push(e) }
      cursor[cur] = (ai + 1) % team.length
    }
    turns++
    cur = cur === 'A' ? 'B' : 'A'   // สลับฝั่งเสมอ
  }

  const pct = (t) => { const max = t.reduce((s, f) => s + f.maxHp, 0); return max ? t.reduce((s, f) => s + Math.max(0, f.hp), 0) / max : 0 }
  const aAlive = alive(A).length > 0, bAlive = alive(B).length > 0
  const hpPctA = pct(A), hpPctB = pct(B)
  let winner
  if (aAlive && !bAlive) winner = 'A'
  else if (bAlive && !aAlive) winner = 'B'
  else winner = hpPctA >= hpPctB ? 'A' : 'B'

  log.push({ t: 'end', winner, rounds: round, hpPctA, hpPctB })
  return { winner, rounds: round, log, units }
}
