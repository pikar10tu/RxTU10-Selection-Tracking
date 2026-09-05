// ════════════════════════════════════════════════════════════
//  Battle engine — pure + deterministic (seeded) · พอร์ตจาก
//  scripts/battle-sim.mjs (resolve) + บันทึก log ทุก action ให้ UI replay
//  ไม่มี side effect — ไม่อ่าน store/Firestore/Date.now
// ════════════════════════════════════════════════════════════
import { BATTLE_CFG, buildCombatant, elementMult } from '../data/battle.js'
import {
  runSetup, applyAuras, runOnStart, runOnRound, runOnAttack, runOnHit, runOnDealt, runOnDeath, runOnKill, runOnAnyDeath, statsSnapshot,
  tauntTargetOf, psOf,
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

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 สเปก §7.6 (6 ก.ย. 2026): "การตายทุกทางต้องนับเป็นการตาย · ใครสร้างดาเมจ คนนั้นคือผู้ฆ่า"
  //    หนาม (thorns) · เกราะสะท้อน (armorStack) เกิด "ข้างใน" strike() ที่ยังไม่จบ — ต้องยกธง/strike()/
  //    resolveSilentDeath ขึ้นมาไว้ "ก่อน" onStart แล้ว เพราะ aoeOpener (บาฮามุท, ยิงก่อนรอบ 1) ก็ฆ่าได้
  //    เงียบๆ เหมือนกัน และต้องใช้ strike()/resolveSilentDeath ตัวเดียวกันกับที่ strike() เรียกตอนจบตัวเอง
  //    (ย้ายมาจากตำแหน่งเดิมหลัง onStart — ของเดิมไม่เคยต้องใช้ strike() ก่อน onStart เพราะยังไม่มีใครฆ่าใคร
  //    แบบเงียบตอนนั้น)
  // ═══════════════════════════════════════════════════════════════════════

  // กันเกราะสะท้อนชนกันไปมา: ระหว่างยิงก้อนสะท้อน ห้ามมีก้อนสะท้อนใหม่เกิดขึ้นอีกชั้น
  let reflecting = false
  // 🔴 P2c-1 Task 6 (รีวิวรอบ 1): แยกจาก `reflecting` เพราะความหมายคนละเรื่อง — ถ้าใช้ธงเดียวกัน
  //    หมัดสวนของฟีนิกซ์ที่ลงบนตัวมีเกราะ (armorStack) จะกินสแตคเกราะไปฟรีๆ (runOnHit คิด res.reflect
  //    ให้แล้ว) แต่เอนจินไม่ยิงก้อนสะท้อนนั้นเลย เพราะบล็อกเกราะเช็ค `!reflecting` ซึ่งบล็อกหมัดสวนตั้งเป็น
  //    true ไปแล้วครอบไว้ทั้งก้อน ⇒ เกราะจ่ายสแตคแต่ไม่ได้อะไรกลับ ทุกครั้งที่ฟีนิกซ์สวนใส่ตัวมีเกราะ
  //    (บรีฟเดิมสั่งให้ใช้ธงเดียวกับ armorStack ตรงๆ — user เคาะแก้เอง 5 ก.ย. ไม่ใช่การตีความของ agent)
  //    `countering` = หมัดสวนของฟีนิกซ์กำลังบิน · `reflecting` ยังคงความหมายเดิมเป๊ะ (ก้อนสะท้อนเกราะกำลังบิน)
  //    บล็อกเกราะยังเช็คแค่ `!reflecting` เหมือนเดิม (กันเกราะสะท้อนชนกันเอง) — เกราะที่โดนหมัดสวนจึง
  //    สะท้อนกลับได้ตามปกติ (นั่นคือเป้าหมายของการแก้) ส่วนบล็อกหมัดสวนเช็คทั้งสองธง (`!reflecting &&
  //    !countering`) กันสามทาง: ฟีนิกซ์สองตัวสวนกันไม่รู้จบ (countering กันเอง) และหมัดสวนไม่เกิดซ้อนใน
  //    ก้อนสะท้อนเกราะของตัวเอง (reflecting กัน) — แต่ปล่อยให้เกราะที่โดนหมัดสวนสะท้อนกลับได้จริง
  let countering = false

  /** หักเลือด 1 ครั้ง + บันทึก log · คืน true ถ้าเป้าตายจริง (ผ่าน onDeath แล้ว)
   *  forced = หมัดนี้ลงบนเป้าที่ถูก taunt บังคับมา (ไม่ใช่เป้าที่เลือกเอง) — ส่งต่อให้ runOnHit ตัดสินใจลดดาเมจ
   *  🔴 เป้ารองของ cleave และดาเมจสะท้อนของ armorStack ไม่ใช่หมัดที่ถูกบังคับ ⇒ เรียก strike() โดยไม่ส่ง forced (= false) */
  const strike = (att, tg, foes, mult, tier, sub, forced = false) => {
    const before = tg.hp
    // onHit: guardian (เพื่อนรับแทน) → dodge → ลดดาเมจ → หนาม  (มุมของ "ผู้รับ" ล้วน)
    const attTeam = att.side === 'A' ? A : B
    const hitRes = runOnHit(tg, Math.max(0, mult), att, foes, rand, forced)
    for (const e of hitRes.events) log.push(e)
    // onDealt: ผลฝั่ง "ผู้ตี" ที่ต้องรู้ดาเมจจริง (healOnAttack / teamLifesteal)
    // 🔒 ต้อง push ต่อท้าย hitRes.events ทันที — ลำดับ event ใน log คือสิ่งที่รีเพลย์เล่าตามตรงๆ
    for (const e of runOnDealt(att, attTeam, hitRes.dmg + hitRes.pierce).events) log.push(e)
    tg.hp -= hitRes.dmg
    // ดาเมจทะลุ (infect) — หักหลังสายลดจบแล้ว จึงไม่โดน guardian/dodge/DR/เกราะ
    // ยังอยู่ใน beat เดิม และ attack event คิด dmg จาก before-after อยู่แล้ว หลอดเลือดจึงตรงเอง
    if (hitRes.pierce > 0) tg.hp -= hitRes.pierce
    if (hitRes.thorns > 0) att.hp -= hitRes.thorns

    // เกราะสะท้อน — ใส่ศัตรูทุกตัวของผู้รับ ผ่าน strike() ปกติ (โดนสายลดของฝั่งนั้นตามสเปก)
    // 🔒 sub: true ⇒ อยู่ beat เดิม ไม่เพิ่มจังหวะ · reflecting กันไม่ให้เกราะฝั่งตรงข้ามสะท้อนกลับมาวนไม่รู้จบ
    // ⚠️ ต้อง finally: ถ้าอะไรใน strike/runOnHit/runOnDeath/runOnAnyDeath ที่ซ้อนอยู่ throw ขึ้นมา
    //    แล้วไม่มี finally, reflecting จะค้าง true ไปตลอดไฟต์ที่เหลือ ⇒ เกราะทุกตัวหลังจากนั้นเงียบสนิทไม่มีใครรู้
    // 🔑 ตั้งใจให้อยู่ "ก่อน" การเช็คตายของตัวที่มีเกราะ (let dead = ... ข้างล่าง) — เกราะโปรกในหมัดที่
    //    ฆ่าเจ้าของมันเอง (เช่นโดนเชื้อระเบิดผ่าน pierce ในหมัดเดียวกัน) ก็ยังต้องสะท้อนครบทั้งชุด
    //    เพราะมันโปรกไปแล้วตอนรับหมัดนั้น ⇒ **ไม่ใช่บั๊ก อย่า "แก้" ด้วยการเลื่อนลงไปใต้ if (dead)**
    if (hitRes.reflect > 0 && !reflecting) {
      reflecting = true
      try {
        const victims = alive(att.side === 'A' ? A : B)
        for (const v of victims) {
          // 🔴 victims เป็น snapshot ตั้งแต่ก่อนเข้าลูป แต่เป้าตายกลางลูปได้จริง (เช่นไปรับแทนเพื่อน
          //    ตามกฎ guardian ในก้อนสะท้อนใบก่อนหน้า) — ตีศพซ้ำ = runOnDeath รอบสอง อาจกินสิทธิ์
          //    revive ทิ้งฟรี · ลูป cleave ของ hit() กันด้วยเช็คเดียวกันนี้อยู่แล้ว
          if (v.hp <= 0) continue
          strike(tg, v, att.side === 'A' ? A : B, hitRes.reflect, { crit: false, eff: 'neutral' }, true)
        }
      } finally {
        reflecting = false
      }
    }

    // 🔴 รีวิวรอบ 2 (6 ก.ย.): ตายหนึ่งครั้งต้องรันฮุคครั้งเดียว — ทางเดินซ้อน (X ตี Y ที่มีเกราะสะท้อน ⇒
    //    Y ยิงสะท้อนใส่ v ผ่าน strike() ชั้นใน ⇒ Y โดนหนามของ v สวนตายกลางชั้นใน ⇒ resolveSilentDeath
    //    รันฮุคของ Y ไปแล้วรอบหนึ่งด้วยผู้ฆ่า=v) ทำให้ tg ของ strike() ชั้นนอกนี้ (=Y ตัวเดียวกัน) ตายอยู่แล้ว
    //    ตอนมาถึงบรรทัดนี้ ⇒ ต้องเรียก resolveSilentDeath ตัวเดียวกัน (ไม่ใช่ลอจิกซ้ำ) เพื่อให้ธงกันซ้ำ
    //    (_deathDone ใน resolveSilentDeath) ทำงาน ไม่งั้นทีเร็กซ์ได้ 2 ชั้นจากศพเดียว (บั๊กเดิมของ P2c-1
    //    ที่เพิ่งแก้ไปแล้วครั้งหนึ่ง — คนละจุดแต่รูปแบบเดียวกัน)
    let dead = tg.hp <= 0
    if (dead) dead = resolveSilentDeath(tg, att)
    log.push({
      t: 'attack', side: att.side, attacker: att.uid, target: tg.uid,
      dmg: Math.round(before - tg.hp), crit: !!tier?.crit, eff: tier?.eff || 'neutral',
      dodged: hitRes.dodged,
      // 🔒 sub = หมัดลูกใน beat เดียวกัน (cleave/multiStrike) — battleBeats ให้ timing ZERO
      //    ถ้าไม่ตั้ง flag นี้ ทุกเป้ารองจะกลายเป็น "จังหวะหมัด" ใหม่ = ไฟต์ยืดทันที (กฎเหล็กพัง)
      ...(sub ? { sub: true } : {}),
      targetHpAfter: Math.max(0, Math.round(tg.hp)), dead,
    })
    // 🔴 สเปก §7.6: ตายเงียบ 2 ทางที่เหลือของ strike() นี้ — หนาม (att โดนสวนตอนบรรทัด 81) และ guardian
    //    (ผู้พิทักษ์ hitRes.guard โดนหักตอนอยู่ใน runOnHit) ต้องแก้ "หลัง" log เหตุการณ์ของหมัดนี้ (ก้อน
    //    'attack' ข้างบน) เท่านั้น — เหตุต้องมาก่อนผลเสมอ (battleBeats.js อนุมานใครปิดไฟต์จาก log ล้วน)
    //    และห้ามเช็คตอน strike() ยังไม่จบ (ตระกูลบั๊กเดียวกับธง reflecting/countering ด้านบน)
    //    ผู้ฆ่าตามสเปก: หนาม → เจ้าของหนาม (tg, ผู้รับหมัดที่สะท้อนกลับ) · guardian → คนสวนหมัดมา (att เดิม
    //    ของ strike() นี้เอง ไม่ใช่ผู้พิทักษ์ — บากุไม่ได้สร้างดาเมจ แค่ย้ายเข้าตัว)
    resolveSilentDeath(att, tg)
    resolveSilentDeath(hitRes.guard, att)
    return dead
  }

  /** จุดเดียวที่ตัดสินว่า "ตัวนี้ตายจริงไหม" ไม่ว่าจะมาจากทางไหน (ตี tg ปกติ, หนาม/guardian หลัง strike()
   *  ของตัวเอง, หรือ aoeOpener ก่อนรอบ 1) — ตามลำดับเดียวกับ if(dead) เดิม: runOnDeath → หมัดสวนของฟีนิกซ์
   *  (ถ้ามี) → runOnAnyDeath · คืน true ถ้าตายจริง (ไม่ถูกกันไว้)
   *  @param unit    ตัวที่อาจตาย (เช็ค hp เองในนี้ — เรียกได้เสมอแม้ไม่ตาย/ไม่มีตัว)
   *  @param killer  ผู้สร้างดาเมจจริงตามสเปก §7.6 (ไม่ใช่คนที่ดาเมจไปตกใส่)
   *
   *  🔴 รีวิวรอบ 2 (6 ก.ย.): "หนึ่งการตาย = รันฮุคหนึ่งครั้ง" ต้องเป็นคุณสมบัติของฟังก์ชันนี้เอง ไม่ใช่ให้
   *     ทุกจุดที่เรียกจำเอง — เพราะ unit ตัวเดียวกันเข้าถึงจุดนี้ได้จากคนละเส้นทางในหมัดเดียวกัน (เช่น Y เป็น
   *     tg ของ strike() ชั้นนอก และเป็น att ของ strike() ชั้นในตอนเกราะสะท้อนของ Y เองยิงออกไป แล้วโดนหนาม
   *     ของเป้าสวนตายกลางชั้นใน) ใช้ธง `ps._deathDone` กันรันฮุคซ้ำของ "การตายเดียวกัน" — ตั้งเฉพาะตอนตายจริง
   *     (ไม่ถูก prevent) และเคลียร์ทันทีที่เจอ unit.hp > 0 (ฟื้นจาก revive/cheatDeath/saveAlly) เพื่อให้การตาย
   *     "ครั้งใหม่" ของตัวเดียวกันทีหลังในไฟต์เดียวกันรันฮุคได้เต็มรอบอีกครั้ง ไม่ใช่ธงถาวรตลอดไฟต์ */
  const resolveSilentDeath = (unit, killer) => {
    if (!unit) return false
    if (unit.hp > 0) { psOf(unit)._deathDone = false; return false }
    const st = psOf(unit)
    if (st._deathDone) return true   // การตายเดียวกันนี้รันฮุคไปแล้วจากเส้นทางอื่น (ดูดอคบล็อกด้านบน) — ไม่รันซ้ำ
    const unitTeam = unit.side === 'A' ? A : B
    const killerTeam = killer.side === 'A' ? A : B
    const d = runOnDeath(unit, unitTeam, killer)
    for (const e of d.events) log.push(e)
    // 🔑 ห้าม return ตอน prevented เฉยๆ — หมัดสวนของฟีนิกซ์ต้องยิงแม้ prevented=true (revive คือกรณีนั้นเป๊ะ)
    //    ตรงกับโค้ดเดิมใน strike(): `if (d.prevented) dead=false` แล้วเช็ค d.counter แยกเป็นคนละ if
    if (d.counter && !reflecting && !countering) {
      countering = true
      try {
        if (d.counter.target.hp > 0) strike(unit, d.counter.target, killerTeam, d.counter.mult, { crit: false, eff: 'neutral' }, true)
      } finally { countering = false }
    }
    if (d.prevented) return false
    st._deathDone = true
    for (const e of runOnAnyDeath(unit, killerTeam, unitTeam, rand)) log.push(e)
    return true
  }

  // เลือกเป้า: ถูกบังคับ (taunt) มาก่อนเสมอ · ไม่งั้นสุ่มตามเดิม
  // 🔴 ต้องเช็ค taunt ก่อนเรียก rand() — ถ้าเรียก rand() แล้วค่อยทิ้งผล ลำดับสุ่มจะเลื่อนทั้งไฟต์
  const pick = (foes) => {
    const forced = tauntTargetOf(foes)
    if (forced) return forced
    const al = alive(foes)
    return al.length ? al[Math.floor(rand() * al.length)] : null
  }

  // onStart (ก่อนหมัดแรก) — ต้องเรียกทีละ event แล้ว resolve aoeOpener "ทันทีหลัง" event ของมันเอง
  // (สเปก §7.6: บาฮามุทฆ่าเพ็ทฝั่งตรงข้ามได้ก่อนรอบ 1 · เอนจินยืนยันแล้วว่าตั้งใจให้เกิดได้)
  // 🔑 ใช้ resolveSilentDeath ตัวเดียวกับที่ strike() ใช้ — ฟีนิกซ์ที่ตายจาก aoeOpener ก็ต้องฟื้น+สวนได้
  //    เหมือนตายทางอื่นทุกทาง ไม่ใช่กรณีพิเศษ
  for (const e of [...runOnStart(A, B), ...runOnStart(B, A)]) {
    log.push(e)
    if (e.t === 'passive' && e.effect === 'aoeOpener') {
      const killer = (e.side === 'A' ? A : B).find(u => u.uid === e.uid)
      const victims = e.side === 'A' ? B : A
      for (const uid of e.targets || []) resolveSilentDeath(victims.find(u => u.uid === uid), killer)
    }
  }

  /** 1 หมัด = 1 beat · cleave/multiStrike อยู่ในหมัดเดียวกัน (กฎเหล็ก: ห้ามเพิ่ม beat)
   *  🔴 forced ต้องจำไว้ "ก่อน" pick() คืนเป้า — pick() เองก็เรียก tauntTargetOf ซ้ำ แต่ไม่ดึง rand()
   *     ก่อนเช็ค taunt ⇒ เรียกซ้ำได้โดยไม่ทำให้ลำดับสุ่มของไฟต์เลื่อน (ดู comment บน pick ด้านบน) */
  const hit = (att, foes) => {
    const forced = !!tauntTargetOf(foes)
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
    // 🔴 สเปก §7.6 ข้อ 6 (รีวิวรอบ 2, 6 ก.ย.): เช็ค att.hp > 0 ด้วย — เข้าถึงได้จริงวันนี้แล้ว ไม่ใช่สมมุติ
    //    (🐰 กระต่ายถือ multiStrike) หนามของเป้าตัวแรกสวนผู้ตีตายกลางหมัดได้ ⇒ ต้องหยุด ไม่ตีซ้ำทั้งที่ตายแล้ว
    const perHit = mod.strikes > 1 ? base * (mod.strikePct / 100) : base
    let killed = false
    for (let i = 0; i < mod.strikes; i++) {
      if (tg.hp <= 0 || att.hp <= 0) break
      if (strike(att, tg, foes, perHit, { crit, eff }, i > 0, forced)) killed = true
    }
    // เป้ารองของ cleave — ดาเมจลดตาม pct · ยังอยู่ beat เดียวกัน
    // ⚠️ ไม่ใช่หมัดที่ถูกบังคับ แม้เป้าหลักจะถูก taunt ดึงมาก็ตาม — ส่ง false เสมอ (สเปกงานย่อยนี้)
    // 🔴 สเปก §7.6 ข้อ 6: เช็ค att.hp > 0 เหมือนกัน — เข้าถึงได้จริงวันนี้ (🐕 เซอร์เบอรัสถือ cleave) หมัดหลัก
    //    ข้างบนอาจฆ่าผู้ตีไปแล้ว (โดนหนามของเป้าหลักสวนตาย) ก่อนจะมาถึงเป้ารอง ⇒ ต้องหยุดตีเป้ารองด้วย
    for (const x of mod.extra) {
      if (att.hp <= 0) break
      if (x.unit.hp <= 0) continue
      if (strike(att, x.unit, foes, base * (x.pct / 100), { crit: false, eff: 'neutral' }, true, false)) killed = true
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
      // killChain — "ตัวเดียวที่เพิ่ม beat ได้" จึงมีเพดานจาก value.max
      // 🔴 เรียก runOnKill ครั้งเดียวต่อการฆ่าหนึ่งครั้ง — เงื่อนไข "ศัตรูยังเหลือ" ย้ายมาไว้ใน
      //    การตัดสินใจ "ตีต่อไหม" ไม่ใช่เงื่อนไขเข้าลูป · ของเดิมเข้าลูปไม่ได้ตอนศัตรูหมด
      //    แล้วบรรทัดใต้ลูปยิงซ้ำ ⇒ ทีเร็กซ์ได้ 2 ชั้นต่อการล้ม 1 ตัว (บั๊กจริงตั้งแต่ ส.ค.)
      // 🔴 สเปก §7.6 ข้อ 6: ต้องเช็ค att.hp > 0 ด้วย — ตั้งแต่หนาม/guardian ฆ่าผู้ตีกลางหมัดได้จริง
      //    (ผ่าน resolveSilentDeath ด้านบน) ผู้ตีที่ตายกลาง hit() ของตัวเอง (เช่นโดนหนามสวนจนตายพอดี
      //    ตอนฆ่าศัตรูตัวที่กำลังจะน็อก) ต้องหยุดตีทันที ไม่ใช่ตีต่อทั้งที่ตายไปแล้ว
      let chain = 0
      while (killed && att.hp > 0 && turns < BATTLE_CFG.maxTurns) {
        const k = runOnKill(att, chain, team, foes)
        for (const e of k.events) log.push(e)
        if (!k.extraAttack || !alive(foes).length) break
        chain++; turns++
        killed = hit(att, foes)
      }
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
