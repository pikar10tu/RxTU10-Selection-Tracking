// เทส passive — pure ทั้งหมด · รัน: node --test src/utils/battlePassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  runSetup, applyAuras, runOnStart, runOnRound, runOnAttack, runOnHit, runOnDealt, runOnDeath, runOnKill, runOnAnyDeath, passiveFor, psOf,
  tauntTargetOf,
} from './battlePassives.js'
import { PET_PASSIVES, passiveValueAt, passiveText, effectText, partsOf, PASSIVE_MAX_LEVEL, STATUS_ICON, STATUS_TEXT } from '../data/petPassives.js'
import { PETS } from '../data/index.js'
import { COMBAT_BASE, COMBAT_GRADE, ELEMENT_BIAS } from '../data/petPower.js'
import { simulateBattle } from './battleEngine.js'
import { buildBeats, beatDuration } from './battleBeats.js'

const u = (id, over = {}) => ({ id, uid: over.uid || 'A0', side: 'A', atk: 100, maxHp: 1000, hp: 1000, element: 'fist', ...over })
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)] }

// ── psOf: state bag ──────────────────────────────────────────
test('psOf: สร้างก้อน state ตอนอ่านครั้งแรก และคืนก้อนเดิมทุกครั้งถัดไป', () => {
  const u_ = { uid: 'A0' }
  const a = psOf(u_)
  a.foo = 1
  assert.equal(psOf(u_).foo, 1)
  assert.equal(u_.ps, a)
})

test('ตัวนับกันตายย้ายไปอยู่ใน ps.uses แล้ว (ไม่ใช่ฟิลด์ลอยบนตัวละคร)', () => {
  const cat = { uid: 'A0', side: 'A', id: 'cat', hp: 0, maxHp: 100, atk: 10 }
  const out = runOnDeath(cat, [cat])
  assert.equal(out.prevented, true)
  assert.equal(psOf(cat).uses, 1)
  assert.equal(cat.passiveUses, undefined)
})

// ── data integrity ──────────────────────────────────────────
test('เพ็ททุกตัวในแค็ตตาล็อกมี passive ครบ ไม่มีตัวไหนตกหล่น', () => {
  const missing = PETS.filter(p => !PET_PASSIVES[p.id]).map(p => p.id)
  assert.deepEqual(missing, [], 'เพ็ทที่ยังไม่มี passive')
})

test('passive ทุกอันมีฟิลด์ครบและ hook ที่รู้จัก', () => {
  const HOOKS = ['aura', 'onStart', 'onRound', 'onAttack', 'onHit', 'onKill', 'onDeath']
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.ok(p.name && p.icon && p.desc, `${id} ฟิลด์ไม่ครบ`)
    const parts = partsOf(p)
    assert.ok(parts.length > 0, `${id} ไม่มี part เลย`)
    for (const part of parts) {
      assert.ok(part.effect, `${id} part ไม่มี effect`)
      assert.ok(HOOKS.includes(part.hook), `${id} hook ไม่รู้จัก: ${part.hook}`)
    }
  }
})

test('ชื่อ passive ไม่ซ้ำกัน (ผู้เล่นต้องแยกออกว่าใครเป็นใคร)', () => {
  const names = Object.values(PET_PASSIVES).map(p => p.name)
  assert.equal(new Set(names).size, names.length)
})

// ── setup ───────────────────────────────────────────────────
test('stealStats: ศัตรูเสียจริง และผู้ขโมยได้เพิ่มเท่ากับที่ขโมยมารวมกัน', () => {
  PET_PASSIVES.__thief = {
    name: 'ทดสอบขโมย', icon: '🧪',
    parts: [{ hook: 'setup', effect: 'stealStats', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ขโมย {pct}%', short: 'ขโมย {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__thief', hp: 100, maxHp: 100, atk: 50 }
    const f1 = { uid: 'B0', side: 'B', id: 'blank', hp: 200, maxHp: 200, atk: 30 }
    const f2 = { uid: 'B1', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 20 }
    const out = runSetup([me], [f1, f2])
    assert.equal(f1.atk, 27)                       // เสีย 10%
    assert.equal(f2.atk, 18)
    assert.equal(me.atk, 50 + 3 + 2)               // ได้ที่ขโมยมารวมกัน
    assert.equal(f1.maxHp, 180)
    assert.equal(f1.hp, 180)                       // เลือดปัจจุบันลดตามสัดส่วน ไม่ล้นหลอด
    assert.equal(me.maxHp, 100 + 20 + 10)
    assert.equal(out.length, 1)
    assert.equal(out[0].fxKind, 'buff')
  } finally { delete PET_PASSIVES.__thief }
})

test('stealStats: ไม่มีศัตรู = ไม่มี event ไม่ throw', () => {
  PET_PASSIVES.__thief = {
    name: 'ทดสอบขโมย', icon: '🧪',
    parts: [{ hook: 'setup', effect: 'stealStats', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ขโมย {pct}%', short: 'ขโมย {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__thief', hp: 100, maxHp: 100, atk: 50 }
    assert.deepEqual(runSetup([me], []), [])
    assert.equal(me.atk, 50)
  } finally { delete PET_PASSIVES.__thief }
})

// ── aura ────────────────────────────────────────────────────
test('teamHp (whale): เพิ่ม maxHp ทั้งทีม และเลือดเต็มตาม', () => {
  const team = [u('whale'), u('cat', { uid: 'A1' })]
  applyAuras(team, [])
  assert.equal(Math.round(team[1].maxHp), 1100)
  assert.equal(team[1].hp, team[1].maxHp)
})

test('teamAtk (seal): เดี่ยว +6% · เข้าคู่ whale เป็น +10% และได้ teamRegen', () => {
  const solo = [u('seal')]
  applyAuras(solo, [])
  assert.ok(Math.abs(solo[0].atk - 106) < 0.01)

  const duo = [u('seal'), u('whale', { uid: 'A1' })]
  applyAuras(duo, [])
  // whale teamHp ไม่แตะ atk — atk มาจาก seal อย่างเดียว
  assert.ok(Math.abs(duo[0].atk - 110) < 0.01, `ได้ ${duo[0].atk}`)
  assert.equal(duo[0].teamRegenPct, 3)
})

test('teamAtkPerElement (wolf): ยิ่งมีเพื่อนสาย fist ยิ่งแรง', () => {
  const one = [u('wolf')]
  const three = [u('wolf'), u('trex', { uid: 'A1' }), u('kirin', { uid: 'A2' })]
  applyAuras(one, []); applyAuras(three, [])
  assert.ok(three[0].atk > one[0].atk)
})

test('enemyVuln (owl): ไปลงที่ศัตรู ไม่ใช่ทีมตัวเอง', () => {
  const team = [u('owl')], foes = [u('cat', { uid: 'B0', side: 'B' })]
  applyAuras(team, foes)
  assert.equal(foes[0].vuln, 0.06)
  assert.equal(team[0].vuln, undefined)
})

test('elementTrinity: ครบ 3 สายถึงจะติด ขาดสายเดียวไม่ได้อะไรเลย', () => {
  PET_PASSIVES.__lion = {
    name: 'ทดสอบสิงโต', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'elementTrinity', value: { pct: 8, hpPct: 8 }, step: { pct: 0, hpPct: 0 } }],
    desc: 'ครบสาย +{pct}%', short: 'ครบสาย +{pct}%',
  }
  try {
    const mk = (uid, el) => ({ uid, side: 'A', id: uid === 'A0' ? '__lion' : 'blank', element: el, hp: 100, maxHp: 100, atk: 100 })
    const full = [mk('A0', 'fist'), mk('A1', 'scissors'), mk('A2', 'paper')]
    applyAuras(full, [])
    assert.equal(Math.round(full[1].atk), 108)
    assert.equal(Math.round(full[1].maxHp), 108)

    const partial = [mk('A0', 'fist'), mk('A1', 'fist'), mk('A2', 'paper')]
    applyAuras(partial, [])
    assert.equal(partial[1].atk, 100)
  } finally { delete PET_PASSIVES.__lion }
})

test('teamDamageReduction: ทีมได้ pct · เจ้าของได้สองเท่า', () => {
  PET_PASSIVES.__shell = {
    name: 'ทดสอบกระดอง', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'teamDamageReduction', value: { pct: 10 }, step: { pct: 0 } }],
    desc: 'ทีมลด {pct}%', short: 'ทีมลด {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__shell', hp: 100, maxHp: 100, atk: 10 }
    const mate = { uid: 'A1', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    applyAuras([me, mate], [])
    assert.equal(mate.teamDrPct, 10)
    assert.equal(me.teamDrPct, 20)
  } finally { delete PET_PASSIVES.__shell }
})

test('teamLifesteal: แปะ % ให้ทุกคนในทีมรวมเจ้าของ', () => {
  PET_PASSIVES.__bat = {
    name: 'ทดสอบค้างคาว', icon: '🧪',
    parts: [{ hook: 'aura', effect: 'teamLifesteal', value: { pct: 8 }, step: { pct: 0 } }],
    desc: 'ทีมดูด {pct}%', short: 'ทีมดูด {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__bat', hp: 100, maxHp: 100, atk: 10 }
    const mate = { uid: 'A1', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    applyAuras([me, mate], [])
    assert.equal(me.lifestealPct, 8)
    assert.equal(mate.lifestealPct, 8)
  } finally { delete PET_PASSIVES.__bat }
})

// ── onStart / onRound ───────────────────────────────────────
test('aoeOpener (bahamut): ศัตรูทุกตัวโดน + มี event', () => {
  const foes = [u('cat', { uid: 'B0' }), u('mouse', { uid: 'B1' })]
  const evs = runOnStart([u('bahamut')], foes)
  assert.ok(foes[0].hp < 1000 && foes[1].hp < 1000)
  assert.equal(evs.length, 1)
  assert.equal(evs[0].t, 'passive')
  assert.deepEqual(evs[0].targets, ['B0', 'B1'])
})

test('regenSelf: ฟื้นเมื่อเลือดพร่อง · เลือดเต็มแล้วไม่เด้ง event ซ้ำซาก', () => {
  const hurt = u('panda', { hp: 500 })
  assert.equal(runOnRound([hurt]).length, 1)
  assert.ok(hurt.hp > 500)
  assert.equal(runOnRound([u('panda')]).length, 0, 'เลือดเต็มไม่ควรมี event')
})

test('healLowestAlly (unicorn): ฟื้นให้เพื่อนที่พร่องสุด ไม่ใช่ตัวเอง', () => {
  const uni = u('unicorn', { hp: 100 })
  const hurt = u('cat', { uid: 'A1', hp: 200 })
  const ok = u('mouse', { uid: 'A2' })
  const evs = runOnRound([uni, hurt, ok])
  assert.equal(evs[0].targets[0], 'A1')
  assert.ok(hurt.hp > 200)
  assert.equal(uni.hp, 100, 'ต้องไม่ฟื้นให้ตัวเอง')
})

// ── onAttack ────────────────────────────────────────────────
test('targetLowest (simurgh): เปลี่ยนเป้าไปตัวเลือดน้อยสุด', () => {
  const foes = [u('cat', { uid: 'B0', hp: 900 }), u('mouse', { uid: 'B1', hp: 100 })]
  const r = runOnAttack(u('simurgh'), foes[0], foes, () => 0.5)
  assert.equal(r.target.uid, 'B1')
})

test('cleave (cerberus): เป้ารอง 2 ตัว (รวมเป้าหลักเป็น 3) และไม่ซ้ำเป้าหลัก', () => {
  const foes = [u('cat', { uid: 'B0' }), u('mouse', { uid: 'B1' }), u('turtle', { uid: 'B2' })]
  const r = runOnAttack(u('cerberus'), foes[0], foes, () => 0.5)
  assert.equal(r.extra.length, 2)
  assert.ok(!r.extra.some(x => x.unit.uid === 'B0'))
})

test('cleave: ศัตรูเหลือตัวเดียว ไม่มีเป้ารอง ไม่เด้ง event หลอก', () => {
  const foes = [u('cat', { uid: 'B0' })]
  const r = runOnAttack(u('dragon'), foes[0], foes, () => 0.5)
  assert.equal(r.extra.length, 0)
  assert.equal(r.events.length, 0)
})

test('execute (shark): แรงขึ้นเฉพาะเป้าเลือดน้อย', () => {
  const low = u('cat', { uid: 'B0', hp: 100 })
  const high = u('cat', { uid: 'B0', hp: 900 })
  assert.ok(runOnAttack(u('shark'), low, [low], () => 0.5).atkMult > 1)
  assert.equal(runOnAttack(u('shark'), high, [high], () => 0.5).atkMult, 1)
})

test('atkWhenFull (hamster): แรงเฉพาะตอนเลือดเต็ม', () => {
  const foe = u('cat', { uid: 'B0' })
  assert.ok(runOnAttack(u('hamster'), foe, [foe], () => 0.5).atkMult > 1)
  assert.equal(runOnAttack(u('hamster', { hp: 999 }), foe, [foe], () => 0.5).atkMult, 1)
})

test('multiStrike (rabbit): ตี 2 ทีเมื่อสุ่มติด · อยู่ใน beat เดียว (strikes ไม่ใช่ beat ใหม่)', () => {
  const foe = u('cat', { uid: 'B0' })
  assert.equal(runOnAttack(u('rabbit'), foe, [foe], () => 0.1).strikes, 2)
  assert.equal(runOnAttack(u('rabbit'), foe, [foe], () => 0.9).strikes, 1)
})

test('berserk: ยิ่งเลือดหายยิ่งแรง นับเป็นขั้นละ 10%', () => {
  PET_PASSIVES.__boar = {
    name: 'ทดสอบหมูป่า', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'berserk', value: { pct: 6 }, step: { pct: 0 } }],
    desc: 'เลือดหายยิ่งแรง +{pct}%', short: 'เลือดหายยิ่งแรง +{pct}%',
  }
  try {
    const tg = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    const full = { uid: 'A0', side: 'A', id: '__boar', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(runOnAttack(full, tg, [tg], () => 0.5).atkMult, 1)          // เลือดเต็ม = ไม่ได้อะไร
    const hurt = { uid: 'A0', side: 'A', id: '__boar', hp: 40, maxHp: 100, atk: 10 }
    const r = runOnAttack(hurt, tg, [tg], () => 0.5)
    assert.equal(Math.round(r.atkMult * 100) / 100, 1.36)                    // หาย 60% = 6 ขั้น × 6%
    assert.equal(r.events.length, 1)
  } finally { delete PET_PASSIVES.__boar }
})

test('berserk: เส้นพอดี 80%/90% ต้องไม่ตกขั้นเพราะ float (1-0.8 ไม่ใช่ 0.2 เป๊ะ)', () => {
  PET_PASSIVES.__boar = {
    name: 'ทดสอบหมูป่า', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'berserk', value: { pct: 6 }, step: { pct: 0 } }],
    desc: 'เลือดหายยิ่งแรง +{pct}%', short: 'เลือดหายยิ่งแรง +{pct}%',
  }
  try {
    const tg = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    const at = (hp) => {
      const me = { uid: 'A0', side: 'A', id: '__boar', hp, maxHp: 100, atk: 10 }
      return runOnAttack(me, tg, [tg], () => 0.5)
    }
    // เลือด 80% เป๊ะ = หายไป 20% = 2 ขั้น (ของเดิมได้ 1 ขั้น เพราะ (1-0.8)*10 = 1.9999999999999996)
    assert.equal(Math.round(at(80).atkMult * 100) / 100, 1.12)
    assert.equal(Math.round(at(90).atkMult * 100) / 100, 1.06)   // 90% เป๊ะ = 1 ขั้น
  } finally { delete PET_PASSIVES.__boar }
})

test('giantSlayer: เป้าตัวใหญ่กว่ายิ่งแรง แต่ชนเพดาน', () => {
  PET_PASSIVES.__badger = {
    name: 'ทดสอบแบดเจอร์', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'giantSlayer', value: { pct: 5, max: 50 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้มยักษ์ +{pct}%', short: 'ล้มยักษ์ +{pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__badger', hp: 100, maxHp: 100, atk: 10 }
    const small = { uid: 'B0', side: 'B', id: 'blank', hp: 80, maxHp: 80, atk: 10 }
    assert.equal(runOnAttack(me, small, [small], () => 0.5).atkMult, 1)      // เป้าเล็กกว่า = ไม่ได้อะไร
    const big = { uid: 'B1', side: 'B', id: 'blank', hp: 130, maxHp: 130, atk: 10 }
    assert.equal(Math.round(runOnAttack(me, big, [big], () => 0.5).atkMult * 100) / 100, 1.15)  // 3 ขั้น
    const huge = { uid: 'B2', side: 'B', id: 'blank', hp: 500, maxHp: 500, atk: 10 }
    assert.equal(Math.round(runOnAttack(me, huge, [huge], () => 0.5).atkMult * 100) / 100, 1.5) // ชนเพดาน
  } finally { delete PET_PASSIVES.__badger }
})

test('giantSlayer: เส้นพอดี 1.2×/1.4× ต้องไม่ตกขั้นเพราะ float (maxHp มาจากตารางตัวคูณที่ลงตัว)', () => {
  PET_PASSIVES.__badger = {
    name: 'ทดสอบแบดเจอร์', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'giantSlayer', value: { pct: 5, max: 50 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้มยักษ์ +{pct}%', short: 'ล้มยักษ์ +{pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__badger', hp: 100, maxHp: 100, atk: 10 }
    const foe = (maxHp) => ({ uid: 'B0', side: 'B', id: 'blank', hp: maxHp, maxHp, atk: 10 })
    const mult = (maxHp) => Math.round(runOnAttack(me, foe(maxHp), [foe(maxHp)], () => 0.5).atkMult * 100) / 100
    // 1.2× เป๊ะ = 2 ขั้น (ของเดิมได้ 1 ขั้น เพราะ (1.2-1)*10 = 1.9999999999999996)
    assert.equal(mult(120), 1.1)
    assert.equal(mult(140), 1.2)                                  // 1.4× เป๊ะ = 4 ขั้น
  } finally { delete PET_PASSIVES.__badger }
})

test('berserk/giantSlayer: fxKind buff ใช้กติกาเดียวกัน — targets = ตัวที่ได้บัฟ · amount = % ที่เพิ่มจริง', () => {
  PET_PASSIVES.__boar = {
    name: 'ทดสอบหมูป่า', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'berserk', value: { pct: 6 }, step: { pct: 0 } }],
    desc: 'เลือดหายยิ่งแรง +{pct}%', short: 'เลือดหายยิ่งแรง +{pct}%',
  }
  PET_PASSIVES.__badger = {
    name: 'ทดสอบแบดเจอร์', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'giantSlayer', value: { pct: 5, max: 50 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้มยักษ์ +{pct}%', short: 'ล้มยักษ์ +{pct}%',
  }
  try {
    const huge = { uid: 'B0', side: 'B', id: 'blank', hp: 500, maxHp: 500, atk: 10 }
    const boar = { uid: 'A0', side: 'A', id: '__boar', hp: 40, maxHp: 100, atk: 10 }
    const e1 = runOnAttack(boar, huge, [huge], () => 0.5).events[0]
    assert.deepEqual(e1.targets, ['A0'])            // ตัวที่ได้บัฟ ไม่ใช่เป้าที่ไปตี
    assert.equal(e1.amount, 36)                     // 6 ขั้น × 6% = +36% (ไม่ใช่ "6")

    const badger = { uid: 'A1', side: 'A', id: '__badger', hp: 100, maxHp: 100, atk: 10 }
    const e2 = runOnAttack(badger, huge, [huge], () => 0.5).events[0]
    assert.deepEqual(e2.targets, ['A1'])            // เดิมชี้ไปที่เหยื่อ = คนละกติกากับ berserk
    assert.equal(e2.amount, 50)                     // ชนเพดาน 50% (ถ้าส่งเป็น "จำนวนขั้น" จะได้ 40 ซึ่งโกหก)
  } finally { delete PET_PASSIVES.__boar; delete PET_PASSIVES.__badger }
})

// ── onDealt (ผลฝั่งผู้ตี) ────────────────────────────────────
test('healOnAttack: ฟื้นเพื่อนที่บอบช้ำสุดตามดาเมจจริงที่ทำได้', () => {
  PET_PASSIVES.__uni = {
    name: 'ทดสอบยูนิคอร์น', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'healOnAttack', value: { pct: 12 }, step: { pct: 0 } }],
    desc: 'ตีแล้วฟื้นเพื่อน {pct}%', short: 'ตีแล้วฟื้นเพื่อน {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__uni', hp: 100, maxHp: 100, atk: 10 }
    const hurt = { uid: 'A1', side: 'A', id: 'blank', hp: 50, maxHp: 100, atk: 10 }
    const res = runOnDealt(me, [me, hurt], 100)
    assert.equal(hurt.hp, 62)                       // 12% ของดาเมจ 100
    assert.ok(res.events.some(e => e.effect === 'healOnAttack'))
  } finally { delete PET_PASSIVES.__uni }
})

test('runOnHit ไม่รับทีมผู้ตีอีกแล้ว — ผลฝั่งผู้ตีย้ายไป runOnDealt ทั้งหมด', () => {
  PET_PASSIVES.__uni = {
    name: 'ทดสอบยูนิคอร์น', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'healOnAttack', value: { pct: 12 }, step: { pct: 0 } }],
    desc: 'ตีแล้วฟื้นเพื่อน {pct}%', short: 'ตีแล้วฟื้นเพื่อน {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__uni', hp: 100, maxHp: 100, atk: 10 }
    const hurt = { uid: 'A1', side: 'A', id: 'blank', hp: 50, maxHp: 100, atk: 10 }
    const tg = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    // พารามิเตอร์ที่ 6 ของ runOnHit วันนี้คือ `forced` (บอกว่าหมัดนี้ถูก taunt บังคับมาหรือเลือกเอง — P2b)
    // ไม่ใช่ทีมผู้ตีอีกต่อไป (นั่นคือของ P2a ที่ถูกตัดออกแล้ว) — ส่ง false ตรงๆ เพราะเคสนี้ไม่ได้ทดสอบ taunt
    // สิ่งที่ยังต้องพิสูจน์จาก P2a คือ "runOnHit มองไม่เห็นทีมผู้ตี": ผลฝั่งผู้ตี (healOnAttack) ย้ายไป
    // runOnDealt ทั้งหมดแล้ว ⇒ เพื่อนของผู้ตีที่เลือดพร่อง (hurt) ต้องไม่ถูกฟื้นจากอะไรใน runOnHit เลย
    // แม้จะส่ง [tg] เป็นทีมผู้รับตามจริง ก็ไม่มีทางไปถึง hurt ได้ (เดิมเคยพิสูจน์ด้วย runOnHit.length === 5
    // แต่ arity ไม่ได้พิสูจน์อะไร — พารามิเตอร์ที่ 6 งอกกลับมาจริงในงานนี้ เพียงแค่มี default จึงไม่โผล่ใน .length)
    const res = runOnHit(tg, 100, me, [tg], () => 0.5, false)
    assert.equal(hurt.hp, 50, 'runOnHit มองไม่เห็นทีมผู้ตี — เพื่อนของผู้ตีต้องไม่ถูกฟื้นจากอะไรในนี้')
    assert.equal(res.events.length, 0, 'healOnAttack ไม่ได้ยิงจาก runOnHit เลย (ย้ายไป runOnDealt ทั้งหมด)')
  } finally { delete PET_PASSIVES.__uni }
})

test('teamLifesteal: ผู้ตีดูดเลือดจากดาเมจที่ทำได้จริง + ส่ง hpPct ให้หลอดเลือดตาม', () => {
  const me = { uid: 'A0', side: 'A', id: 'blank', hp: 50, maxHp: 100, atk: 10, lifestealPct: 8 }
  const out = runOnDealt(me, [me], 100)
  assert.equal(me.hp, 58)                           // 8% ของ 100
  assert.equal(out.events.length, 1)
  const e = out.events[0]
  assert.equal(e.effect, 'teamLifesteal')
  assert.equal(e.fxKind, 'heal')
  assert.deepEqual(e.targets, ['A0'])
  assert.equal(e.amount, 8)                         // เลือดจริงที่ฟื้นได้ ไม่ใช่ % ของสูตร
  assert.equal(e.hpPct, 58)
  assert.equal('kind' in e, false)                  // 🔴 ห้ามมีฟิลด์ชื่อ kind (CLAUDE.md ข้อ 15)
})

test('teamLifesteal: ไม่ล้นหลอด และเลือดเต็มอยู่แล้วต้องไม่มี event', () => {
  const full = { uid: 'A0', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10, lifestealPct: 8 }
  assert.deepEqual(runOnDealt(full, [full], 100).events, [])
  assert.equal(full.hp, 100)

  const nearly = { uid: 'A0', side: 'A', id: 'blank', hp: 97, maxHp: 100, atk: 10, lifestealPct: 50 }
  const out = runOnDealt(nearly, [nearly], 100)
  assert.equal(nearly.hp, 100)                      // ดูดได้ 50 แต่หลอดรับได้แค่ 3
  assert.equal(out.events[0].amount, 3)
})

test('runOnDealt: ไม่มีดาเมจ/ไม่มีทีมผู้ตี = เงียบ ไม่ throw', () => {
  const me = { uid: 'A0', side: 'A', id: 'blank', hp: 50, maxHp: 100, atk: 10, lifestealPct: 8 }
  assert.deepEqual(runOnDealt(me, [me], 0).events, [])
  assert.deepEqual(runOnDealt(me, null, 100).events, [])
  assert.deepEqual(runOnDealt(null, [me], 100).events, [])
  assert.equal(me.hp, 50)
})

test('runOnDealt: ผู้ตีที่ตายไปแล้ว (โดนหนามกลางบีต) ต้องไม่ดูดเลือดกลับมา', () => {
  const me = { uid: 'A0', side: 'A', id: '__blank__', hp: 0, maxHp: 100, atk: 10, lifestealPct: 50 }
  const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 50, maxHp: 100, atk: 10 }
  const out = runOnDealt(me, [me, mate], 100)
  assert.equal(me.hp, 0, 'ตัวที่ตายแล้วต้องไม่ฟื้นเอง')
  assert.deepEqual(out.events, [])
})

// ── onHit ───────────────────────────────────────────────────
test('damageReduction (mammoth): ลดดาเมจที่ตัวเองรับ', () => {
  const r = runOnHit(u('mammoth'), 100, u('cat'), [u('mammoth')], () => 0.5)
  assert.equal(r.dmg, 80)
})

test('dodge (fox): หลบแล้วดาเมจเป็น 0', () => {
  const hit = runOnHit(u('fox'), 100, u('cat'), [u('fox')], () => 0.01)
  assert.equal(hit.dmg, 0)
  assert.equal(hit.dodged, true)
  assert.equal(runOnHit(u('fox'), 100, u('cat'), [u('fox')], () => 0.99).dmg, 100)
})

test('thorns (hedgehog): สะท้อนกลับผู้ตี', () => {
  const r = runOnHit(u('hedgehog'), 100, u('cat'), [u('hedgehog')], () => 0.5)
  assert.ok(r.thorns > 0)
  assert.equal(r.events[0].targets[0], 'A0')
})

test('guardian (qilin): รับแทนเพื่อนที่พร่องสุด · เลือดผู้พิทักษ์ลดจริง', () => {
  const guard = u('qilin', { uid: 'A0' })
  const weak = u('cat', { uid: 'A1', hp: 100 })
  const r = runOnHit(weak, 100, u('mouse'), [guard, weak], () => 0.5)
  assert.equal(r.dmg, 50)
  assert.equal(guard.hp, 950)
})

test('guardian: ไม่รับแทนเพื่อนที่ไม่ได้พร่องสุด', () => {
  const guard = u('qilin', { uid: 'A0' })
  const weak = u('cat', { uid: 'A1', hp: 50 })
  const mid = u('mouse', { uid: 'A2', hp: 800 })
  const r = runOnHit(mid, 100, u('cat'), [guard, weak, mid], () => 0.9)
  assert.equal(r.dmg, 100)
  assert.equal(guard.hp, 1000)
})

test('atkOnHit: โดนตีทีนึง atk เพิ่มถาวร ไม่มีเพดาน (user ยืนยัน)', () => {
  PET_PASSIVES.__gori = {
    name: 'ทดสอบกอริลลา', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } }],
    desc: 'โดนตีแล้วแรงขึ้น {pct}%', short: 'โดนตีแล้วแรงขึ้น {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__gori', hp: 100, maxHp: 100, atk: 100 }
    const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
    for (let i = 0; i < 3; i++) runOnHit(me, 10, att, [me], () => 0.5)
    assert.equal(psOf(me).rage, 3)
    // ทบต้น 100×1.03³ = 109.2727 ≠ บวกเชิงเส้น 100×(1+3×0.03) = 109.0 — ปัดสองตำแหน่งให้เห็นส่วนต่าง
    assert.equal(Math.round(me.atk * 100) / 100, 109.27)
  } finally { delete PET_PASSIVES.__gori }
})

test('atkOnHit: หมัดที่ถูกหลบทั้งหมัด ไม่นับเป็น "โดนตี" จึงไม่สะสมชั้น', () => {
  PET_PASSIVES.__rage = {
    name: 'ทดสอบเดือด', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'dodge', value: { pct: 100 }, step: { pct: 0 } },
      { hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ {pct}%', short: 'ทดสอบ {pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__rage', hp: 100, maxHp: 100, atk: 100 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(me, 100, att, [me], () => 0)     // rand 0 = หลบติดแน่นอน
    assert.equal(res.dmg, 0)
    assert.equal(psOf(me).rage, undefined, 'หลบได้แล้วยังสะสมชั้น = ผิดนิยาม "ทุกครั้งที่รับดาเมจ"')
    assert.equal(me.atk, 100)
  } finally { delete PET_PASSIVES.__rage }
})

test('atkOnHit: หมัดที่ดาเมจผ่านเข้ามาจริง ยังสะสมเหมือนเดิม', () => {
  const me = { uid: 'A0', side: 'A', id: '__rage2', hp: 100, maxHp: 100, atk: 100 }
  PET_PASSIVES.__rage2 = {
    name: 'ทดสอบเดือด2', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'atkOnHit', value: { pct: 3 }, step: { pct: 0 } }],
    desc: 'ทดสอบ {pct}%', short: 'ทดสอบ {pct}%',
  }
  try {
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    runOnHit(me, 50, att, [me], () => 0.99)
    assert.equal(psOf(me).rage, 1)
    assert.equal(Math.round(me.atk), 103)
  } finally { delete PET_PASSIVES.__rage2 }
})

test('teamDamageReduction: หักเป็นทอดกับ damageReduction ของตัวเอง ไม่ใช่บวก %', () => {
  const d = { uid: 'A0', side: 'A', id: 'turtle', hp: 100, maxHp: 100, atk: 10, teamDrPct: 20 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  // 🐢 turtle มี damageReduction 12% ของตัวเองอยู่แล้ว ⇒ 100 × 0.8 × 0.88 = 70.4
  const res = runOnHit(d, 100, att, [d], () => 0.5)
  assert.equal(Math.round(res.dmg * 10) / 10, 70.4)
})

// ── onDeath / onKill ────────────────────────────────────────
test('revive (phoenix): ฟื้นครั้งเดียวเท่านั้น', () => {
  const ph = u('phoenix', { hp: -5 })
  const first = runOnDeath(ph, [ph])
  assert.equal(first.prevented, true)
  assert.ok(ph.hp > 0)
  ph.hp = -5
  assert.equal(runOnDeath(ph, [ph]).prevented, false, 'ครั้งที่สองต้องตายจริง')
})

test('cheatDeath (cat): รอดด้วยเลือด 1 ครั้งเดียว', () => {
  const c = u('cat', { hp: -20 })
  assert.equal(runOnDeath(c, [c]).prevented, true)
  assert.equal(c.hp, 1)
})

test('saveAlly (genie): กันเพื่อนตาย 1 ครั้ง แล้วหมดสิทธิ์', () => {
  const g = u('genie', { uid: 'A0' })
  const a = u('mouse', { uid: 'A1', hp: -10 })
  assert.equal(runOnDeath(a, [g, a]).prevented, true)
  assert.equal(a.hp, 1)
  const b = u('turtle', { uid: 'A2', hp: -10 })
  assert.equal(runOnDeath(b, [g, b]).prevented, false, 'genie ใช้ได้ครั้งเดียว')
})

test('stackAtk (trex): สะสมได้ถึงเพดานแล้วหยุด', () => {
  const t = u('trex')
  const base = t.atk
  for (let i = 0; i < 6; i++) runOnKill(t, 0)
  assert.equal(psOf(t).atkStacks, 3, 'เพดาน 3 ชั้น')
  assert.ok(t.atk > base)
})

test('killChain (kirin): ตีต่อได้จนถึงเพดาน แล้วหยุด (ไม่วนไม่รู้จบ)', () => {
  const k = u('kirin')
  assert.equal(runOnKill(k, 0).extraAttack, true)
  assert.equal(runOnKill(k, 1).extraAttack, true)
  assert.equal(runOnKill(k, 2).extraAttack, false)
})

test('onAnyDeath: ศัตรูล้มโดยใครก็ได้ ทุกตัวในทีมที่มี hook นี้ได้ชั้นเพิ่ม (ยึดเพดาน max)', () => {
  PET_PASSIVES.__scav = {
    name: 'ทดสอบซาก', icon: '🧪',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 10, max: 2 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้ม 1 ตัว +{pct}%', short: 'ล้ม 1 ตัว +{pct}%',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__scav', hp: 100, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: 'blank', hp: 0, maxHp: 100, atk: 10 }
    const e1 = runOnAnyDeath(dead, [me], [dead])
    assert.equal(e1.length, 1)
    assert.equal(Math.round(me.atk), 110)
    assert.equal(psOf(me).atkStacks, 1)
    runOnAnyDeath(dead, [me], [dead])
    assert.equal(psOf(me).atkStacks, 2)
    const e3 = runOnAnyDeath(dead, [me], [dead])      // ชนเพดานแล้ว
    assert.equal(e3.length, 0)
    assert.equal(psOf(me).atkStacks, 2)
  } finally { delete PET_PASSIVES.__scav }
})

test('onAnyDeath: ตัวที่ตายแล้วไม่ได้ชั้น', () => {
  PET_PASSIVES.__scav = {
    name: 'ทดสอบซาก', icon: '🧪',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 10, max: 3 }, step: { pct: 0, max: 0 } }],
    desc: 'ล้ม 1 ตัว +{pct}%', short: 'ล้ม 1 ตัว +{pct}%',
  }
  try {
    const corpse = { uid: 'A0', side: 'A', id: '__scav', hp: 0, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: 'blank', hp: 0, maxHp: 100, atk: 10 }
    assert.deepEqual(runOnAnyDeath(dead, [corpse], [dead]), [])
    assert.equal(corpse.atk, 100)
  } finally { delete PET_PASSIVES.__scav }
})

// ── infect (ตอนที่ 3: ส่งต่อเชื้อตอนตัวติดเชื้อล้ม) ─────────────
// 🔑 ไวรัสในเทสต้องลงทะเบียนพาสสีฟจริง (id ชี้ไปที่ part ที่มี effect: 'infect') — ไม่ใช่ id ลอยๆ
//    ที่หาไม่เจอใน PET_PASSIVES เพราะ vpart ของ runOnAnyDeath ต้องเจอค่า max จริงเพื่อพิสูจน์ว่าเพดานที่ยึด
//    มาจาก value.max ของไวรัส ไม่ใช่ fallback (fallback มีไว้กันพังกรณีที่ไม่ควรเกิดจริงเท่านั้น)
test('infect: ตัวติดเชื้อล้ม เชื้อย้ายไปเพื่อนของมันแบบ deterministic และไม่เกินเพดาน', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: '__blank__', hp: 0, maxHp: 100, atk: 10 }
    const alive1 = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const alive2 = { uid: 'B2', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    psOf(dead).infect = { n: 4, from: virus }
    psOf(alive2).infect = { n: 3, from: virus }
    runOnAnyDeath(dead, [virus], [dead, alive1, alive2], () => 0.99)   // 0.99 = ตัวท้ายสุด
    assert.equal(psOf(alive2).infect.n, 5, 'รวมแล้วยึดเพดาน 5')
    assert.equal(psOf(dead).infect, undefined, 'ศพต้องไม่ถือเชื้อต่อ')
  } finally { delete PET_PASSIVES.__virus }
})

test('infect: ไม่มีศัตรูเหลือให้ย้าย ก็ไม่ throw', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const dead = { uid: 'B0', side: 'B', id: '__blank__', hp: 0, maxHp: 100, atk: 10 }
    psOf(dead).infect = { n: 2, from: virus }
    runOnAnyDeath(dead, [virus], [dead], () => 0.5)
    assert.equal(psOf(dead).infect, undefined)
  } finally { delete PET_PASSIVES.__virus }
})

// ── integration: กฎเหล็ก + determinism ──────────────────────
const team = (ids, rarity, grade) => ids.map((id, i) => {
  const d = PETS.find(p => p.id === id)
  return { id, rarity: d?.rarity || rarity, element: d?.element || 'fist', grade }
})

test('deterministic: seed เดิม + ทีมเดิม = log เดิมเป๊ะ (ทั้งเกมพึ่งข้อนี้)', () => {
  const A = team(['cerberus', 'rabbit', 'fox'], 'epic', 4)
  const B = team(['phoenix', 'qilin', 'hedgehog'], 'legendary', 4)
  assert.deepEqual(simulateBattle(A, B, 777).log, simulateBattle(A, B, 777).log)
})

test('🔒 กฎเหล็ก: cleave/multiStrike ไม่เพิ่มจำนวน beat', () => {
  // cerberus โดน 3 ตัว — จำนวน attack event เพิ่ม แต่ beat (ที่มี timing) ต้องไม่เพิ่ม
  const A = team(['cerberus', 'cerberus', 'cerberus'], 'epic', 4)
  const B = team(['turtle', 'mouse', 'hamster'], 'common', 4)
  const { log } = simulateBattle(A, B, 42)
  const beats = buildBeats(log, {})
  const subs = log.filter(e => e.t === 'attack' && e.sub)
  assert.ok(subs.length > 0, 'ต้องมีหมัดลูกเกิดขึ้นจริงถึงจะเทสได้')
  for (const [i, e] of log.entries()) {
    if (e.t === 'attack' && e.sub) {
      // 28 ส.ค.: ฟิลด์เปลี่ยนจาก tier → kind (กฎเหล็กเหมือนเดิม) — และ kind ต้องมีค่าเสมอ
      // ไม่ใช่ null/undefined เพราะ renderer switch(kind) จะได้ไม่มีอะไรตกลง default โดยบังเอิญ
      assert.equal(beats[i].kind, 'sub', 'หมัดลูกต้องเป็น kind sub')
      assert.equal(beats[i].timing.motion, 0, 'หมัดลูกต้องไม่กินเวลา')
      assert.equal(beatDuration(beats[i]), 0, 'หมัดลูกต้องไม่กินเวลาทั้ง beat')
    }
  }
})

test('ไฟต์จบเสมอ ไม่ค้างลูปแม้ทีมฟื้นเลือดชนกันเอง', () => {
  const A = team(['ouroboros', 'panda', 'unicorn'], 'legendary', 5)
  const B = team(['ouroboros', 'panda', 'unicorn'], 'legendary', 5)
  for (let s = 1; s <= 20; s++) {
    const r = simulateBattle(A, B, s)
    assert.ok(r.winner === 'A' || r.winner === 'B')
    assert.ok(r.log.at(-1).t === 'end')
  }
})

test('event passive ไปโผล่ใน log จริงตอนสู้', () => {
  const A = team(['bahamut', 'unicorn', 'wolf'], 'legendary', 5)
  const B = team(['cat', 'mouse', 'turtle'], 'common', 3)
  const kinds = new Set(simulateBattle(A, B, 9).log.filter(e => e.t === 'passive').map(e => e.effect))
  assert.ok(kinds.has('aoeOpener'), 'bahamut ต้อง proc ตอนเริ่ม')
  assert.ok(kinds.has('cheatDeath') || kinds.has('healLowestAlly') || kinds.has('dodge'),
    'ต้องมี passive ระหว่างสู้ proc อย่างน้อย 1 อย่าง')
})

test('aura ต้องเด้ง event ป้ายด้วย — ไม่งั้นทีมที่มี aura ล้วนจะเงียบสนิท', () => {
  // เจอจากเทสจอจริง 27 ส.ค.: ทีม phoenix/whale/seal มี aura 2 ตัว → ไม่มีป้ายขึ้นเลย
  const evs = applyAuras([u('whale'), u('seal', { uid: 'A1' })], [])
  assert.equal(evs.length, 2)
  assert.ok(evs.every(e => e.t === 'passive' && e.fxKind === 'aura' && e.name))
})

test('ทุกทีมต้องมีป้าย passive ขึ้นอย่างน้อย 1 อันเสมอ (ไม่มีไฟต์ที่เงียบสนิท)', () => {
  const A = team(['phoenix', 'whale', 'seal'], 'legendary', 3)
  const B = team(['kirin', 'simurgh', 'bahamut'], 'legendary', 3)
  for (let s = 1; s <= 20; s++) {
    const mine = simulateBattle(A, B, s).log.filter(e => e.t === 'passive' && e.side === 'A')
    assert.ok(mine.length > 0, `seed ${s} ไม่มีป้าย passive ฝั่งเราเลย`)
  }
})

// ── ตัวเลขในคำอธิบาย + เผื่อระบบหินอัพพลัง 3 ขั้น ──

test('passiveText: ไม่มี {placeholder} หลุดออกจอสักตัว ทุกขั้น', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (let lv = 1; lv <= PASSIVE_MAX_LEVEL; lv++) {
      const txt = passiveText(p, lv)
      assert.ok(!/[{}]/.test(txt), `${id} ขั้น ${lv} ยังมี placeholder: ${txt}`)
    }
  }
})

test('passiveText: ตัวเลขที่โชว์ต้องตรงกับค่าจริงของขั้นนั้น (ไม่ใช่เลขที่พิมพ์ไว้)', () => {
  const p = PET_PASSIVES.bahamut
  const part = partsOf(p)[0]
  assert.ok(passiveText(p, 1).includes(String(passiveValueAt(part, 1).pct)))
  assert.ok(passiveText(p, 3).includes(String(passiveValueAt(part, 3).pct)))
  assert.notEqual(passiveText(p, 1), passiveText(p, 3), 'ขั้นต่างกันข้อความต้องต่างกัน')
})

test('passiveValueAt: ขั้นนอกช่วงถูก clamp · ขั้น 1 = ค่าตั้งต้นเป๊ะ', () => {
  const part = partsOf(PET_PASSIVES.fox)[0]
  assert.deepEqual(passiveValueAt(part, 1), part.value)
  assert.deepEqual(passiveValueAt(part, 0), passiveValueAt(part, 1))
  assert.deepEqual(passiveValueAt(part, 99), passiveValueAt(part, PASSIVE_MAX_LEVEL))
})

test('🪨 ขั้น 3 ต้องไม่หลุดเพดานความสมเหตุสมผล (เผื่อดันเจี้ยนหิน)', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const part of partsOf(p)) {
      const v = passiveValueAt(part, PASSIVE_MAX_LEVEL)
      if (part.effect === 'dodge') assert.ok(v.pct <= 25, `${id} หลบ ${v.pct}% สูงเกินจนไฟต์ยืด`)
      if (part.effect === 'damageReduction') assert.ok(v.pct <= 35, `${id} ลดดาเมจ ${v.pct}% สูงเกิน`)
      if (part.effect === 'guardian') assert.ok(v.pct <= 100, `${id} รับแทน ${v.pct}% เกิน 100% เป็นไปไม่ได้`)
      if (part.effect === 'revive') assert.ok(v.pct <= 70, `${id} ฟื้น ${v.pct}% สูงเกิน`)
      if (part.effect === 'multiStrike') assert.ok(v.chance <= 60, `${id} โอกาสตีซ้ำ ${v.chance}% สูงเกิน`)
    }
  }
})

test('🪨 killChain/cheatDeath/saveAlly ต้องอัพขั้นแล้วค่าไม่ขยับ (โตแล้วพัง)', () => {
  for (const id of ['kirin', 'cat', 'genie']) {
    const part = partsOf(PET_PASSIVES[id])[0]
    assert.deepEqual(passiveValueAt(part, PASSIVE_MAX_LEVEL), passiveValueAt(part, 1), `${id} ไม่ควรอัพได้`)
  }
})

test('ขั้น 3 ต้องแรงกว่าขั้น 1 จริงสำหรับตัวที่อัพได้ (ไม่งั้นหินไร้ความหมาย)', () => {
  const upgradable = new Set()
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const part of partsOf(p)) {
      const lo = passiveValueAt(part, 1)
      const hi = passiveValueAt(part, PASSIVE_MAX_LEVEL)
      // นับเฉพาะตัวที่ "อัพขั้นแล้วเลขขยับจริง" — มี step เป็นบวกอย่างเดียวไม่พอ
      // (step ที่คำนวณแล้วไม่ขยับ = หินอัพขั้นไม่ให้อะไรเลย ซึ่งเป็นบั๊กที่เทสนี้มีไว้จับ)
      if (Object.keys(hi).some(k => typeof hi[k] === 'number' && hi[k] > lo[k])) upgradable.add(id)
    }
  }
  assert.ok(upgradable.size >= 20, `เพ็ทที่อัพขั้นแล้วเลขขยับมีแค่ ${upgradable.size} ตัว`)
})

// user เทสจอจริง 29 ส.ค.: ทีม seal+whale เลือดขึ้นแต่ "เลขไม่ขึ้น"
// เหตุ: buildBeats ใส่ kind (= เวลา) ทับ kind (= ชนิดผล) ที่ passive ส่งมา
// → renderer มองไม่เห็น 'heal' อีกเลย · ชนิดผลจึงต้องอยู่คนละฟิลด์กับเวลา
test('🔑 ชนิดผลของ passive ต้องรอด buildBeats — ไม่ถูก kind (เวลา) ทับ', () => {
  const A = team(['whale', 'seal', 'turtle'], 'legendary', 5)
  const B = team(['kirin', 'simurgh', 'bahamut'], 'legendary', 5)
  let checked = 0
  for (let s = 1; s <= 20; s++) {
    const { log } = simulateBattle(A, B, s)
    const beats = buildBeats(log, {})
    for (const [i, e] of log.entries()) {
      if (e.t !== 'passive' || e.effect !== 'duoRegen') continue
      checked++
      assert.equal(beats[i].fxKind, 'heal', `seed ${s} beat ${i}: ชนิดผลหาย`)
      assert.ok(beats[i].amount > 0, 'ต้องมีเลือดที่ฟื้นจริงติดมาด้วย (เลข +N)')
    }
  }
  assert.ok(checked > 0, 'ต้องมี duoRegen โปรกจริงถึงจะเทสได้')
})

// ── ข้อความผลของ passive (short / effectText) ────────────────
// เดิมรายการบัฟอ่านจาก STATUS_TEXT ที่คีย์ด้วย effect — พาสสีฟคนละตัวที่ใช้ effect เดียวกัน
// จึงได้ข้อความเหมือนกันเป๊ะทั้งที่ให้ผลคนละอย่าง (ฟีนิกซ์ฟื้น 35% vs แมวเหลือเลือด 1)
test('PET_PASSIVES: ทุกตัวมี short และเติมเลขครบ ไม่เหลือ {placeholder}', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.ok(typeof p.short === 'string' && p.short.length > 0, `${id} ไม่มี short`)
    const filled = effectText(p, 1)
    assert.ok(!/\{\w+\}/.test(filled), `${id} เหลือ placeholder: ${filled}`)
  }
})

test('effectText: ขั้นสูงขึ้นแล้วเลขต้องขยับ (ตัวที่ step ไม่เป็น 0)', () => {
  assert.notEqual(effectText(PET_PASSIVES.whale, 1), effectText(PET_PASSIVES.whale, 3))
  assert.match(effectText(PET_PASSIVES.whale, 3), /16/)
})

test('effectText: ฟีนิกซ์กับแมวต้องอ่านต่างกัน (เดิมชนกันที่ "กันตายได้ 1 ครั้ง")', () => {
  assert.notEqual(effectText(PET_PASSIVES.phoenix, 1), effectText(PET_PASSIVES.cat, 1))
})

test('หมาป่า: desc/short ต้องไม่มีคำว่า "สายพลัง" (ชื่อสายจริงคือ จู่โจม)', () => {
  assert.ok(!PET_PASSIVES.wolf.desc.includes('สายพลัง'), PET_PASSIVES.wolf.desc)
  assert.ok(!PET_PASSIVES.wolf.short.includes('สายพลัง'), PET_PASSIVES.wolf.short)
  assert.ok(PET_PASSIVES.wolf.desc.includes('จู่โจม'))
})

test('STATUS_ICON/STATUS_TEXT: มี duoRegen แล้ว (คู่หู 🐳🦭 เดิมไม่มีป้ายเลย)', () => {
  assert.equal(STATUS_ICON.duoRegen, '💧')
  assert.ok(STATUS_TEXT.duoRegen)
})

test('effectText: aura ที่ลงฝั่งตรงข้ามมีข้อความมุมผู้รับแยก (onTarget)', () => {
  const owl = PET_PASSIVES.owl
  assert.equal(effectText(owl, 1), 'ศัตรูทุกตัวรับดาเมจเพิ่ม 6%')
  assert.equal(effectText(owl, 1, { onTarget: true }), 'รับดาเมจเพิ่ม 6%')
  // ตัวที่ไม่มี shortOn ต้องตกกลับไป short เหมือนเดิม ไม่ใช่ค่าว่าง
  assert.equal(effectText(PET_PASSIVES.whale, 1, { onTarget: true }), effectText(PET_PASSIVES.whale, 1))
})

// ── หลายผลในตัวเดียว (โครง parts[]) ─────────────────────────────
// ลงทะเบียนพาสสีฟสมมติชั่วคราวในทะเบียน แล้วลบทิ้งท้ายเทส
// (แพทเทิร์นเดียวกับ id '__blank__' ที่ sim ใช้ — ทะเบียนเป็น object ธรรมดา)
test('onRound: พาสสีฟที่มี 2 part ใน hook เดียวกัน ต้องทำงานครบทั้งคู่', () => {
  PET_PASSIVES.__two = {
    name: 'ทดสอบสองผล', icon: '🧪',
    parts: [
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 10 }, step: { pct: 0 } },
      { hook: 'onRound', effect: 'healLowestAlly', value: { pct: 20 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const me = u('__two', { uid: 'A0', hp: 500 })      // maxHp 1000 ⇒ พร่องอยู่
    const mate = u('__blank__', { uid: 'A1', hp: 200 })
    const events = runOnRound([me, mate])
    const effects = events.map(e => e.effect)
    // ลำดับใน parts[] = ลำดับที่ event โผล่บนจอ — เป็นสัญญาในสเปก §2.4 ต้องมีเทสกัน
    assert.deepEqual(effects, ['regenSelf', 'healLowestAlly'])
    assert.equal(me.hp, 600)                            // +10% ของ 1000
    assert.equal(mate.hp, 400)                          // +20% ของ 1000
  } finally {
    delete PET_PASSIVES.__two
  }
})

test('onHit: part ของ hook อื่นต้องไม่ถูกเรียกผิดจังหวะ', () => {
  PET_PASSIVES.__mix = {
    name: 'ทดสอบข้ามฮุก', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'damageReduction', value: { pct: 50 }, step: { pct: 0 } },
      { hook: 'onKill', effect: 'stackAtk', value: { pct: 10, max: 3 }, step: { pct: 0, max: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const d = u('__mix', { uid: 'A0' })
    const res = runOnHit(d, 100, u('__blank__', { uid: 'B0', side: 'B' }), [d], () => 0.99)
    assert.equal(res.dmg, 50)                                   // ลดครึ่ง
    assert.equal(res.events.filter(e => e.effect === 'stackAtk').length, 0)
  } finally {
    delete PET_PASSIVES.__mix
  }
})

test('guardian: ต้องหาจาก hook onHit ไม่ใช่ effect-first (กันเจอ part ผิดตอนเพ็ทมีหลาย part)', () => {
  // เพ็ทสังเคราะห์: guardian อยู่บน hook อื่นมาก่อน แล้วค่อยมีตัวจริงบน onHit
  const fake = {
    name: 'ทดสอบ', icon: '🧪',
    parts: [
      { hook: 'onRound', effect: 'guardian', value: { pct: 99 } },
      { hook: 'onHit', effect: 'guardian', value: { pct: 50 } },
    ],
  }
  const g = { uid: 'A0', side: 'A', id: '__fake', hp: 100, maxHp: 100, atk: 10 }
  const d = { uid: 'A1', side: 'A', id: 'blank', hp: 40, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  PET_PASSIVES.__fake = fake
  try {
    const res = runOnHit(d, 100, att, [g, d], () => 0.99)
    // ต้องได้ 50% (ตัวจริงบน onHit) ไม่ใช่ 99% ของ part แรกที่ effect ตรง
    assert.equal(Math.round(res.dmg), 50)
  } finally { delete PET_PASSIVES.__fake }
})

test('runOnHit ไม่คืนฟิลด์ absorber อีกแล้ว (เอนจินไม่เคยอ่าน = โค้ดตาย)', () => {
  const d = { uid: 'A0', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const res = runOnHit(d, 100, att, [d], () => 0.5)
  assert.equal('absorber' in res, false)
})

// การพิสูจน์ว่า pierce "ทะลุ" จริง ต้องรอ P2b ที่มี infect เป็นตัวผลิตค่า
// (วันนี้ไม่มีโค้ดจริงสายไหนใส่ค่าให้ pierce ⇒ เทสที่เขียนตอนนี้จะได้แค่ทดสอบตัวเอง)
test('pierce: ค่าเริ่มต้นเป็น 0 เสมอ', () => {
  const d = { uid: 'A0', side: 'A', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  const att = { uid: 'B0', side: 'B', id: 'blank', hp: 100, maxHp: 100, atk: 10 }
  assert.equal(runOnHit(d, 100, att, [d], () => 0.5).pierce, 0)
})

test('armorStack: กินสแตคแล้วกันทั้งหมัด + คืนก้อนสะท้อนให้เอนจิน', () => {
  PET_PASSIVES.__armor = {
    name: 'ทดสอบเกราะ', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'armorStack', value: { count: 2, pct: 80 }, step: { count: 0, pct: 0 } }],
    desc: 'เกราะ {count} ชั้น สะท้อน {pct}%', short: 'เกราะ {count} ชั้น',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__armor', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const r1 = runOnHit(me, 100, att, [me], () => 0.5)
    assert.equal(r1.dmg, 0, 'สแตคแรกต้องกันหมัดทั้งหมด')
    assert.equal(r1.reflect, 80)
    assert.equal(psOf(me).armor, 1)

    const r2 = runOnHit(me, 50, att, [me], () => 0.5)
    assert.equal(r2.dmg, 0)
    assert.equal(r2.reflect, 40)
    assert.equal(psOf(me).armor, 0)

    const r3 = runOnHit(me, 50, att, [me], () => 0.5)
    assert.equal(r3.dmg, 50, 'หมดสแตคแล้วต้องรับเต็ม')
    assert.equal(r3.reflect, 0)
  } finally { delete PET_PASSIVES.__armor }
})

test('armorStack: กันหมัดหลักได้ แต่กันดาเมจเชื้อไม่ได้ (pierce ทะลุเกราะ)', () => {
  PET_PASSIVES.__armor2 = {
    name: 'ทดสอบเกราะ2', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'armorStack', value: { count: 1, pct: 0 }, step: { count: 0, pct: 0 } }],
    desc: 'เกราะ {count} ชั้น', short: 'เกราะ {count} ชั้น',
  }
  try {
    const me = { uid: 'A0', side: 'A', id: '__armor2', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(me, 100, att, [me], () => 0.5)
    res.pierce = 30                      // จำลองว่างานย่อย 6 ใส่ค่าให้ (เทสจริงอยู่ที่งานย่อย 6)
    assert.equal(res.dmg, 0)
    assert.equal(res.pierce, 30, 'เกราะต้องไม่แตะช่อง pierce')
  } finally { delete PET_PASSIVES.__armor2 }
})

// ── tauntTargetOf ────────────────────────────────────────────
test('tauntTargetOf: ไม่มีใครมี taunt คืน null (ไฟต์ปกติต้องไม่เปลี่ยนพฤติกรรม)', () => {
  const a = { uid: 'B0', side: 'B', id: 'turtle', hp: 100, maxHp: 100, atk: 10 }
  const b = { uid: 'B1', side: 'B', id: 'fox', hp: 100, maxHp: 100, atk: 10 }
  assert.equal(tauntTargetOf([a, b]), null)
})

test('tauntTargetOf: มีสองตัวเอาช่องซ้ายสุด และข้ามตัวที่ตายแล้ว', () => {
  PET_PASSIVES.__taunt = {
    name: 'ทดสอบท้าชน', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const dead = { uid: 'B0', side: 'B', id: '__taunt', hp: 0, maxHp: 100, atk: 10 }
    const left = { uid: 'B1', side: 'B', id: '__taunt', hp: 100, maxHp: 100, atk: 10 }
    const right = { uid: 'B2', side: 'B', id: '__taunt', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(tauntTargetOf([dead, left, right]), left)
  } finally { delete PET_PASSIVES.__taunt }
})

test('taunt: ลดดาเมจเฉพาะหมัดที่ถูกบังคับมา ไม่ใช่ทุกหมัด', () => {
  PET_PASSIVES.__taunt2 = {
    name: 'ทดสอบท้าชน2', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const me = { uid: 'B0', side: 'B', id: '__taunt2', hp: 100, maxHp: 100, atk: 10 }
    const att = { uid: 'A0', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    assert.equal(runOnHit(me, 100, att, [me], () => 0.5, true).dmg, 75, 'หมัดที่ถูกดึงมาต้องลด 25%')
    assert.equal(runOnHit(me, 100, att, [me], () => 0.5, false).dmg, 100, 'หมัดที่เลือกเองต้องไม่ลด')
  } finally { delete PET_PASSIVES.__taunt2 }
})

test('runOnAttack: targetLowest ต้องไม่แย่งเป้าที่ถูก taunt บังคับไว้', () => {
  PET_PASSIVES.__taunt3 = {
    name: 'ทดสอบท้าชน3', icon: '🧪',
    parts: [{ hook: 'onRound', effect: 'taunt', value: { pct: 25 }, step: { pct: 0 } }],
    desc: 'ท้าชน ลด {pct}%', short: 'ท้าชน ลด {pct}%',
  }
  try {
    const gorilla = { uid: 'B0', side: 'B', id: '__taunt3', hp: 100, maxHp: 100, atk: 10 }
    const weak = { uid: 'B1', side: 'B', id: '__blank__', hp: 5, maxHp: 100, atk: 10 }
    const eagle = { uid: 'A0', side: 'A', id: 'simurgh', hp: 100, maxHp: 100, atk: 10 }
    const mod = runOnAttack(eagle, gorilla, [gorilla, weak], () => 0.5)
    assert.equal(mod.target, gorilla, 'taunt ต้องชนะ targetLowest ตามลำดับในสเปก')
  } finally { delete PET_PASSIVES.__taunt3 }
})

// ── infect (ตอนที่ 1: แปะเชื้อ + เพดาน — ยังไม่ระเบิด) ────────
test('infect: ไวรัสตีแล้วเป้าได้ชั้นเชื้อ ชนเพดานแล้วไม่เกิน', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    // 🔴 P2b (งานย่อย 6) ทำให้หมัดที่ 2 เป็นต้นไปของลูปนี้ "ระเบิด" ด้วย (virus ตีเป้าที่ตัวเองแปะเชื้อไว้แล้ว
    //    ก็ถือว่าอยู่ทีมเดียวกับ from) — แต่ event ระเบิดใช้ชื่อ effect แยกเป็น 'infectBurst' แล้ว (fix round 1
    //    ข้อ 2: กันชนคีย์ dedupe ของ battleBeats.js) ⇒ filter effect === 'infect' เฉยๆ ก็ได้เฉพาะการแปะชั้น
    //    ตรงกับที่เทสนี้ตั้งใจวัดอยู่แล้ว ไม่ต้องพึ่ง fxKind (เพดานของการ "แปะ" ไม่ใช่จำนวนครั้งที่ "ระเบิด"
    //    ซึ่งไม่มีเพดานและถูกเทสแยกไว้ต่างหากแล้ว)
    let tagEvents = 0
    for (let i = 0; i < 7; i++) {
      const r = runOnHit(tgt, 10, virus, [tgt], () => 0.5)
      tagEvents += r.events.filter(e => e.effect === 'infect').length
    }
    assert.equal(psOf(tgt).infect.n, 5, 'เพดาน 5 ชั้น')
    assert.equal(psOf(tgt).infect.from, virus)
    assert.equal(tagEvents, 5, 'ชนเพดานแล้วต้องเงียบ — 7 หมัดต้องได้ event แปะชั้นแค่ 5 อัน ไม่ใช่ 7')
  } finally { delete PET_PASSIVES.__virus }
})

test('infect: เพ็ทที่ไม่ใช่ไวรัสตี ไม่แปะเชื้อ', () => {
  const att = { uid: 'A0', side: 'A', id: 'turtle', hp: 100, maxHp: 100, atk: 100 }
  const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
  runOnHit(tgt, 10, att, [tgt], () => 0.5)
  assert.equal(psOf(tgt).infect, undefined)
})

test('infect: ไวรัสตัวแรกเป็นเจ้าของสแตคเสมอ — ไวรัสตัวที่สองตีต่อไม่แย่งความเป็นเจ้าของ', () => {
  PET_PASSIVES.__virusA = {
    name: 'ทดสอบเชื้อ A', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  PET_PASSIVES.__virusB = {
    name: 'ทดสอบเชื้อ B', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virusA = { uid: 'A0', side: 'A', id: '__virusA', hp: 100, maxHp: 100, atk: 100 }
    const virusB = { uid: 'A1', side: 'A', id: '__virusB', hp: 100, maxHp: 100, atk: 999 } // atk ต่างกันชัดเจน
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    runOnHit(tgt, 10, virusA, [tgt], () => 0.5)
    runOnHit(tgt, 10, virusA, [tgt], () => 0.5)
    assert.equal(psOf(tgt).infect.n, 2)
    assert.equal(psOf(tgt).infect.from, virusA, 'ก่อนไวรัส B ตี เจ้าของต้องเป็น A')

    runOnHit(tgt, 10, virusB, [tgt], () => 0.5)     // ไวรัส B ตีต่อ ยังไม่ชนเพดาน (n=2 < max=5)
    assert.equal(psOf(tgt).infect.n, 3, 'สแตคยังต้องเพิ่มจากไวรัส B')
    assert.equal(psOf(tgt).infect.from, virusA, 'ไวรัสตัวแรก (A) ยังต้องเป็นเจ้าของสแตค ไม่ใช่ B ที่ตีล่าสุด')
  } finally { delete PET_PASSIVES.__virusA; delete PET_PASSIVES.__virusB }
})

test('infect: ดอดจ์เต็มหมัด (dmg=0) ก็ยังติดเชื้อ — การแปะไม่ขึ้นกับดาเมจที่ทะลุเข้ามา', () => {
  PET_PASSIVES.__virusDmg = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  PET_PASSIVES.__dodger = {
    name: 'ทดสอบหลบ', icon: '🧪',
    parts: [{ hook: 'onHit', effect: 'dodge', value: { pct: 100 }, step: { pct: 0 } }],
    desc: 'หลบ {pct}%', short: 'หลบ {pct}%',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virusDmg', hp: 100, maxHp: 100, atk: 100 }
    const tgt = { uid: 'B0', side: 'B', id: '__dodger', hp: 100, maxHp: 100, atk: 10 }
    const res = runOnHit(tgt, 10, virus, [tgt], () => 0)   // rand 0 = หลบติดแน่นอน (dodge 100%)
    assert.equal(res.dodged, true, 'ต้องหลบจริงในเทสนี้')
    assert.equal(res.dmg, 0, 'ดาเมจต้องเป็น 0 หลังหลบ')
    assert.equal(psOf(tgt).infect.n, 1, 'หลบเต็มหมัดก็ยังต้องติดเชื้อ 1 ชั้น')
    assert.equal(psOf(tgt).infect.from, virus)
  } finally { delete PET_PASSIVES.__virusDmg; delete PET_PASSIVES.__dodger }
})

// ── infect (ตอนที่ 2: ระเบิดผ่าน pierce) ───────────────────────
// ⚠️ pct ของสามเทสนี้อ่านจากพาสสีฟของไวรัสตอนระเบิด (Step 4: passiveFor(inf.from) → หา part effect infect)
//    ⇒ ต้องลงทะเบียน __virus แบบงานย่อย 5 แล้วให้ from ชี้ยูนิตที่ id: '__virus' จริง — id '__blank__' หา
//    part ไม่เจอ (ไม่มีพาสสีฟ) จะได้ pierce = 0 เสมอโดยไม่เกี่ยวกับตรรกะที่กำลังเทส
test('infect: เพื่อนร่วมทีมไวรัสตี ก็ระเบิดเชื้อ และเชื้อไม่ลดลง', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    psOf(tgt).infect = { n: 3, from: virus }
    const res = runOnHit(tgt, 10, mate, [tgt], () => 0.5)
    assert.equal(res.pierce, 45, '15% ของ atk 100 × 3 ชั้น')
    assert.equal(psOf(tgt).infect.n, 3, 'เชื้อต้องไม่ลดตอนระเบิด')
  } finally { delete PET_PASSIVES.__virus }
})

test('infect: ศัตรูของไวรัสตีกันเอง ไม่ระเบิด', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const virus = { uid: 'A0', side: 'A', id: '__virus', hp: 100, maxHp: 100, atk: 100 }
    const foe = { uid: 'B1', side: 'B', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    psOf(tgt).infect = { n: 3, from: virus }
    assert.equal(runOnHit(tgt, 10, foe, [tgt], () => 0.5).pierce, 0)
  } finally { delete PET_PASSIVES.__virus }
})

test('infect: ไวรัสตายแล้วเชื้อยังระเบิดได้ (อ่าน atk จากตัวที่ตายแล้ว)', () => {
  PET_PASSIVES.__virus = {
    name: 'ทดสอบเชื้อ', icon: '🧪',
    parts: [{ hook: 'onAttack', effect: 'infect', value: { pct: 15, max: 5 }, step: { pct: 0, max: 0 } }],
    desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
  }
  try {
    const deadVirus = { uid: 'A0', side: 'A', id: '__virus', hp: 0, maxHp: 100, atk: 100 }
    const mate = { uid: 'A1', side: 'A', id: '__blank__', hp: 100, maxHp: 100, atk: 10 }
    const tgt = { uid: 'B0', side: 'B', id: '__blank__', hp: 500, maxHp: 500, atk: 10 }
    psOf(tgt).infect = { n: 2, from: deadVirus }
    assert.equal(runOnHit(tgt, 10, mate, [tgt], () => 0.5).pierce, 30)
  } finally { delete PET_PASSIVES.__virus }
})

// หนี้จากสเปก §7.4 ข้อ 1 (P2a Task 3 เคยเขียนเทสที่ตั้งค่า res.pierce เองแล้วเช็คค่าที่เพิ่งตั้ง —
// พิสูจน์แค่ว่า JS assignment ทำงาน ไม่ได้พิสูจน์ว่า pierce ทะลุเกราะจริง จึงถูกลบทิ้งใน P2a)
// เทสนี้ยิงผ่าน simulateBattle เต็มใบ ให้ engine เป็นคนคำนวณทั้งสายลดและ pierce เอง แล้วตรวจทุก event
// ระเบิดเชื้อในไฟต์เทียบกับสูตร infect เป๊ะๆ ไม่ใช่แค่ "มากกว่า 0" — ถ้า turtle มีสิทธิ์หักดาเมจนี้ได้แม้แต่นิดเดียว
// (damageReduction 12% ของมันเอง) ตัวเลขที่ได้จริงจะไม่ตรงสูตรทันที
//
// 🔴 fix round 1: เช็คแค่ event.amount (ตัวเลขที่ battlePassives.js เขียนอธิบายตัวเองในหมัดเดียวกัน) ไม่พอ —
//    บล็อกระเบิดไม่เคยอ่าน res.dmg เลย ต่อให้ battleEngine.js หัก hitRes.pierce ผิด (เช่นหักครึ่งเดียว)
//    event.amount ก็ยังพิมพ์ค่าที่ "ควรจะเป็น" เหมือนเดิม เทสแบบเดิมจะยังผ่านทั้งที่ปลายทาง (ฝั่งใช้ค่า) พัง
//    ต้องพิสูจน์ที่ hp ของเป้าที่หายไปจริง (ฝั่ง battleEngine.js: `tg.hp -= hitRes.pierce`) จึงรัน simulateBattle
//    ซ้ำสองครั้งด้วย seed เดิมเป๊ะ ครั้งหนึ่ง pct=15 (ของจริง) อีกครั้ง pct=0 (คุมกลุ่ม) — โค้ดของ infect
//    ไม่เรียก rand() เลยสักจุด (ทั้งตอนแปะและตอนระเบิด) และ pct ไม่มีผลต่อ elementMult/crit/variance/การเลือก
//    เป้าของ battleEngine.js ⇒ ลำดับการดึง rand() ทั้งไฟต์เหมือนกันเป๊ะระหว่างสองรัน จนกว่าฝั่งใดฝั่งหนึ่งจะตาย
//    ก่อน (การตายเกิดจาก hp ต่างกัน ซึ่งมาทีหลังหมัดที่กำลังเทส) ⇒ ดาเมจ "หมัดหลักหลังหักลด" ของหมัดที่ N
//    เหมือนกันทั้งสองรันเป๊ะ ส่วนต่างของ attack.dmg ระหว่างสองรันที่หมัดเดียวกัน = pierce ล้วนๆ ที่ถูกหักจริง
//    จาก hp ของเป้า — ไม่ใช่ค่าที่ battlePassives.js "รายงาน" — นี่คือครึ่งที่หนี้ P2a ต้องการ
test('infect ทะลุทุกเกราะจริง — ยิงผ่าน simulateBattle ไม่ใช่แค่ระดับฟังก์ชัน', () => {
  // ทีม A: ไวรัสล้วน (1 ตัว) · ทีม B: เต่า (damageReduction) — ทีมละตัวเดียว ⇒ A0 ตี B0 ทุกหมัดแน่นอน
  // ถ้าเชื้อถูกหักโดยสายลด ดาเมจที่ B เสียแต่ละหมัดจะน้อยกว่าที่คำนวณไว้อย่างเห็นได้ชัด
  const A = [{ id: '__virus', rarity: 'legendary', element: 'fist', grade: 3 }]
  const B = [{ id: 'turtle', rarity: 'common', element: 'paper', grade: 3 }]
  const runWith = (pct) => {
    PET_PASSIVES.__virus = {
      name: 'ทดสอบเชื้อ', icon: '🧪',
      parts: [{ hook: 'onAttack', effect: 'infect', value: { pct, max: 5 }, step: { pct: 0, max: 0 } }],
      desc: 'เชื้อ {pct}% ต่อชั้น สูงสุด {max}', short: 'เชื้อ {pct}% ต่อชั้น',
    }
    try { return simulateBattle(A, B, 12345) } finally { delete PET_PASSIVES.__virus }
  }
  const real = runWith(15)                     // ของจริง — pierce มีค่า
  const ctrl = runWith(0)                       // คุมกลุ่ม — โครงสร้างพาสสีฟเหมือนกันทุกจุด (แปะชั้นยังทำงาน,
                                                 // เดิน code path เดียวกัน, ไม่เรียก rand() เพิ่ม/น้อยลง)
                                                 // ต่างกันแค่ pierce ที่ผลิตออกมาเป็น 0 เท่านั้น

  // effect ของ "แปะชั้น" กับ "ระเบิด" แยกชื่อกันแล้ว (infect vs infectBurst — ดู docblock ของ ev() ในซอร์ส
  // สำหรับเหตุผลเรื่องคีย์ dedupe ของ battleBeats.js) กรองได้ตรงๆ ไม่ต้องพึ่ง fxKind อีกต่อไป
  const tagEvents = real.log.filter(e => e.t === 'passive' && e.effect === 'infect')
  const burstEvents = real.log.filter(e => e.t === 'passive' && e.effect === 'infectBurst')
  assert.ok(tagEvents.length > 0 && burstEvents.length > 0, 'ต้องมีทั้งเหตุการณ์แปะเชื้อและระเบิดเชื้อ')

  // ── ที่มาของ virusAtk: buildCombatant (src/data/petPower.js combatStats), ไม่เดา ──
  //   rarity legendary → COMBAT_BASE.legendary.atk = 14
  //   grade 3          → COMBAT_GRADE[3] = 1.52
  //   element fist      → ELEMENT_BIAS.fist.atk = 1.2
  //   atk = 14 × 1.52 × 1.2 = 25.536 (คูณตามลำดับเดียวกับ combatStats() เป๊ะ กันพลาดจุดทศนิยม)
  //   __virus ไม่มี aura/setup ใดๆ ที่แตะ atk ⇒ ค่านี้คงที่ตลอดทั้งไฟต์ ไม่ต้องคำนึงถึง atkOnHit/stackAtk
  const virusAtk = COMBAT_BASE.legendary.atk * COMBAT_GRADE[3] * ELEMENT_BIAS.fist.atk
  assert.equal(virusAtk, 25.536)

  // ── ครึ่งที่ 1 (ตัวรายงานตัวเอง — ยังเก็บไว้เป็นเช็คชั้นแรก): event.amount ของบล็อกระเบิดต้องตรงสูตร
  //    amount = Math.round(virusAtk × 0.15 × nก่อนหน้า) (delta ของหมัดนี้ ไม่ใช่สะสม — fix round 1 ข้อ 3) ──
  let stackSoFar = 0, boomChecked = 0
  for (const e of real.log) {
    if (e.t !== 'passive' || (e.effect !== 'infect' && e.effect !== 'infectBurst')) continue
    if (e.effect === 'infectBurst') {
      const undiminished = Math.round(virusAtk * 0.15 * stackSoFar)
      assert.equal(e.amount, undiminished, `pierce หมัดที่ n=${stackSoFar} ต้องเท่ากับ ${undiminished}`)
      boomChecked++
    } else {
      stackSoFar = e.amount   // st.infect.n หลังแปะของหมัดนี้ — ใช้เป็น n "ก่อนหน้า" ของหมัดถัดไป
    }
  }
  assert.ok(boomChecked > 0, 'ต้องมีหมัดที่ทำให้เชื้อระเบิดจริงอย่างน้อย 1 ครั้งถึงจะพิสูจน์อะไรได้')

  // ── ครึ่งที่ 2 (ของจริงที่หนี้ต้องการ — พิสูจน์ผ่าน hp ที่หายจริง ไม่ใช่ event ที่รายงานตัวเอง) ──
  // เทียบ attack event ฝั่ง A (A0 ตี B0) ทีละหมัดระหว่างรันจริงกับรันคุมกลุ่ม: ส่วนต่างของ dmg ที่บันทึกจริง
  // (ซึ่งมาจาก `tg.hp -= hitRes.dmg` แล้ว `tg.hp -= hitRes.pierce` ใน battleEngine.js — คนละจุดกับที่
  // battlePassives.js เขียน event) ต้องเท่ากับ pierce ที่สูตรทำนายไว้ (คำนวณไว้ในครึ่งที่ 1 แล้ว: 4, 8, 11)
  const realHits = real.log.filter(e => e.t === 'attack' && e.side === 'A')
  const ctrlHits = ctrl.log.filter(e => e.t === 'attack' && e.side === 'A')
  const pierceByHit = [0, 4, 8, 11]   // n=0,1,2,3 ก่อนหมัดที่ 1,2,3,4 ตามลำดับ (จาก round(3.8304×n) ด้านบน)
  // หมัดที่ 1 (n=0 ยังไม่มีสแตค) ไม่มี pierce เลยทั้งสองรัน ⇒ diff ต้องเป็น 0 พอดี ไม่มีปัญหาการปัดเศษ
  assert.equal(realHits[0].dmg - ctrlHits[0].dmg, pierceByHit[0])
  // หมัดที่ 2 และ 3: ยืนยันด้วย diff แบบเป๊ะ (ตรวจแล้วว่า seed 12345 ไม่ชนขอบการปัดเศษที่หมัดเหล่านี้ —
  // main-หลังลดของหมัดนั้นบวก pierce ไม่ข้ามเส้น .5 พอดี) ทั้งสองหมัดนี้มีทั้งไวรัสมีชีวิตในทั้งสองรันแน่นอน
  // (turtle ยังไม่ตายในรันไหนเลยตอนนี้ ⇒ ลำดับ rand() ยังซิงก์กันอยู่ 100%)
  assert.equal(realHits[1].dmg - ctrlHits[1].dmg, pierceByHit[1],
    'หมัดที่ 2: ส่วนต่างดาเมจจริงระหว่างมี/ไม่มี pierce ต้องเท่ากับ pierce เป๊ะ (ไม่ถูกหักที่ปลายทาง)')
  assert.equal(realHits[2].dmg - ctrlHits[2].dmg, pierceByHit[2],
    'หมัดที่ 3: เหมือนกัน — พิสูจน์ผ่าน hp ที่หายจริง ไม่ใช่ event ที่ battlePassives.js รายงานเอง')
  // หมัดที่ 4: main-หลังลดของหมัดนี้บังเอิญอยู่ชิดขอบ .5 (ยืนยันด้วยสคริปต์สำรวจ: real=30, ctrl=18, diff=12
  // ไม่ใช่ 11) — เป็นผลจากการปัดเศษสองรอบอิสระกัน (round(M+p) กับ round(M) ต่างกันได้ไม่เกิน 1 จาก round(p)
  // เสมอ เป็นสมบัติทางคณิตศาสตร์ของ Math.round ไม่ใช่บั๊ก) จึงเช็คแบบคลาดได้ไม่เกิน 1 แทนการเช็คเป๊ะที่หมัดนี้
  assert.ok(Math.abs((realHits[3].dmg - ctrlHits[3].dmg) - pierceByHit[3]) <= 1,
    'หมัดที่ 4: ส่วนต่างต้องใกล้เคียง pierce ในช่วงคลาดเคลื่อนจากการปัดเศษ (≤1) เท่านั้น')

  // ── ค่าที่วัดได้จริงตอนเขียนเทสนี้ (seed 12345, เพื่อบันทึกไว้เป็นหลักฐาน ไม่ใช่ที่มาของสูตร) ──
  //   debuff n=1 → burst 4 (round(3.8304×1)) → debuff n=2 → burst 8 (round(3.8304×2))
  //   → debuff n=3 → burst 11 (round(3.8304×3)) → debuff n=4 (ไฟต์จบก่อนหมัดถัดไป ชนะฝั่ง A รอบที่ 4)
  // ยืนยันจำนวน event ให้ตรงกับที่สังเกตได้จริง กันไม่ให้สูตรข้างบน "ผ่านโดยบังเอิญ" เพราะไม่มีอะไรให้เช็คเลย
  assert.equal(tagEvents.length, 4)
  assert.equal(boomChecked, 3)
  assert.equal(realHits.length, 4)
})
