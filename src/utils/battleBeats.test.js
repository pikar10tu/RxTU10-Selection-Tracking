import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBeats, scaleTiming, beatDuration, totalDuration,
  TIER_TIMING, DANGER_PCT, SURVIVE_PCT, HEAVY_SCORE_FLOOR,
  PASSIVE_TIMING, OPEN_GROUP_MS, PASSIVE_SPOT_QUOTA,
} from './battleBeats.js'
import { simulateBattle } from './battleEngine.js'
import { buildCombatant } from '../data/battle.js'

const MH = { A0: 100, A1: 100, B0: 100, B1: 100 }
const atk = (o) => ({ t: 'attack', side: 'A', attacker: 'A0', target: 'B0', crit: false, eff: 'neutral', dead: false, dmg: 5, targetHpAfter: 50, ...o })
const tiersOf = (beats) => beats.filter(b => b.t === 'attack').map(b => b.tier)
const countTier = (beats, t) => tiersOf(beats).filter(x => x === t).length

// log ยาว n หมัด ดาเมจไล่จากน้อยไปมาก → อันดับคะแนนคาดเดาได้
// ×3 เพื่อให้หมัดอันดับต้นๆ มี score ผ่าน HEAVY_SCORE_FLOOR (.12) ไม่งั้นโควตา heavy จะถูก floor ตัดหมด
function ramp(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = (i + 1) * 3
    out.push(atk({ dmg: d, targetHpAfter: Math.max(1, 100 - d) }))
  }
  return out
}

test('finish มีหมัดเดียวต่อไฟต์ และเป็น attack ตัวสุดท้ายของ log เสมอ', () => {
  const beats = buildBeats([...ramp(20), { t: 'end', winner: 'A' }], MH)
  assert.equal(countTier(beats, 'finish'), 1)
  const atks = beats.filter(b => b.t === 'attack')
  assert.equal(atks[atks.length - 1].tier, 'finish')
  assert.equal(beats[beats.length - 1].tier, null)          // t:'end' ไม่ใช่ attack
})

test('finish ไม่ผูกกับการฆ่า — หมัดที่ฆ่ากลางไฟต์ไม่ใช่ finish', () => {
  const log = [...ramp(19)]
  log[5] = atk({ dmg: 60, targetHpAfter: 0, dead: true })
  const beats = buildBeats(log, MH)
  assert.notEqual(beats[5].tier, 'finish')
  assert.equal(countTier(beats, 'finish'), 1)
})

test('kill เป็น flag แยกจากชั้น — ตายเมื่อไหร่ก็ติดธง ไม่ว่าชั้นไหน', () => {
  const log = [...ramp(19)]
  log[2] = atk({ dmg: 1, targetHpAfter: 0, dead: true })    // ดาเมจน้อยมากแต่ฆ่า
  const beats = buildBeats(log, MH)
  assert.equal(beats[2].kill, true)
  assert.equal(beats[0].kill, false)
})

test('โควตา heavy/solid อยู่ในกรอบ clamp ตามความยาวไฟต์', () => {
  // ไฟต์สั้น 12 หมัด → round(12*.13)=2 แต่ถูก clamp ขึ้นเป็น 3
  const short = buildBeats(ramp(12), MH)
  assert.equal(countTier(short, 'heavy'), 3)
  // ไฟต์ยาว 60 หมัด → round(60*.13)=8 clamp ลงเหลือ 6 · solid round(60*.28)=17 clamp เหลือ 11
  const long = buildBeats(ramp(60), MH)
  assert.equal(countTier(long, 'heavy'), 6)
  assert.equal(countTier(long, 'solid'), 11)
  assert.equal(countTier(long, 'chip'), 60 - 6 - 11 - 1)
})

test('heavy ตกให้หมัดคะแนนสูงสุดก่อน', () => {
  const beats = buildBeats(ramp(20), MH)
  const atks = beats.filter(b => b.t === 'attack')
  const notLast = atks.slice(0, -1)
  const heavy = notLast.filter(b => b.tier === 'heavy')
  const rest = notLast.filter(b => b.tier !== 'heavy')
  const minHeavy = Math.min(...heavy.map(b => b.score))
  const maxRest = Math.max(...rest.map(b => b.score))
  assert.ok(minHeavy >= maxRest, 'หมัด heavy คะแนนต่ำสุด ต้องไม่ต่ำกว่าหมัดที่ไม่ใช่ heavy คะแนนสูงสุด')
})

test('score floor: ไฟต์ที่ทุกหมัดจิ๊บจ๊อย จะไม่มี heavy เลย', () => {
  // ดาเมจ 1% ทุกหมัด ไม่คริ ไม่แพ้ทาง ไม่ฆ่า → score = .01 ต่ำกว่า floor
  const log = Array.from({ length: 20 }, () => atk({ dmg: 1, targetHpAfter: 90 }))
  const beats = buildBeats(log, MH)
  assert.equal(countTier(beats, 'heavy'), 0)
  assert.equal(countTier(beats, 'finish'), 1)     // finish ยังมีเสมอ — ไฟต์ต้องมีจุดจบ
  assert.equal(HEAVY_SCORE_FLOOR, 0.12)
})

test('round/end ได้ tier null และ timing 0 ทุกช่อง', () => {
  const beats = buildBeats([{ t: 'round', n: 1 }, { t: 'end', winner: 'A' }], MH)
  for (const b of beats) {
    assert.equal(b.tier, null)
    assert.deepEqual(b.timing, { windup: 0, motion: 0, hitstop: 0, tail: 0 })
    assert.equal(beatDuration(b), 0)
  }
})

test('event type แปลกปลอมผ่านไปเงียบๆ ไม่ throw (ช่องเว้นให้ P3 passive)', () => {
  const beats = buildBeats([{ t: 'passive', uid: 'A0', name: 'shield' }], MH)
  assert.equal(beats[0].tier, null)
  assert.equal(beats[0].name, 'shield')          // ฟิลด์เดิมต้องอยู่ครบ
})

test('log ว่าง/null → array ว่าง ไม่ throw', () => {
  assert.deepEqual(buildBeats([], MH), [])
  assert.deepEqual(buildBeats(null, MH), [])
})

test('danger ติดเมื่อเลือดเหลือไม่เกิน 25% และยังไม่ตาย', () => {
  const beats = buildBeats([
    atk({ dmg: 9, targetHpAfter: 30 }),
    atk({ dmg: 9, targetHpAfter: 25 }),
    atk({ dmg: 25, targetHpAfter: 0, dead: true }),
  ], MH)
  assert.equal(beats[0].danger, false)
  assert.equal(beats[1].danger, true)
  assert.equal(beats[2].danger, false)           // ตายแล้วไม่ใช่ danger
  assert.equal(DANGER_PCT, 0.25)
})

test('survive ติดครั้งเดียวต่อตัว ตอนตกผ่าน 10% ครั้งแรก', () => {
  const beats = buildBeats([
    atk({ dmg: 9, targetHpAfter: 12 }),
    atk({ dmg: 9, targetHpAfter: 8 }),
    atk({ dmg: 3, targetHpAfter: 5 }),
    atk({ dmg: 5, targetHpAfter: 0, dead: true }),
  ], MH)
  assert.deepEqual(beats.map(b => b.survive), [false, true, false, false])
  assert.equal(SURVIVE_PCT, 0.10)
})

test('uid ที่ไม่มีใน maxHpByUid → ไม่ NaN ไม่หารด้วยศูนย์', () => {
  const [b] = buildBeats([atk({ target: 'Z9', dmg: 10, targetHpAfter: 5 })], {})
  assert.ok(Number.isFinite(b.dmgPct))
  assert.ok(Number.isFinite(b.hpPctAfter))
  assert.ok(Number.isFinite(b.score))
})

test('scaleTiming: pace คูณทุกช่อง · ff ย่อเฉพาะ chip/solid', () => {
  const beats = buildBeats(ramp(20), MH)
  const pick = (t) => beats.find(b => b.tier === t)
  const chip = pick('chip'), heavy = pick('heavy'), finish = pick('finish')

  assert.deepEqual(scaleTiming(chip, { pace: 2 }), {
    windup: TIER_TIMING.chip.windup * 2, motion: TIER_TIMING.chip.motion * 2,
    hitstop: TIER_TIMING.chip.hitstop * 2, tail: TIER_TIMING.chip.tail * 2,
  })
  assert.equal(beatDuration(chip, { ff: true }), beatDuration(chip) * 0.3)
  // กติกาหลักของฟีเจอร์กดค้างเร่ง — ห้ามย่อไฮไลต์
  assert.equal(beatDuration(heavy, { ff: true }), beatDuration(heavy))
  assert.equal(beatDuration(finish, { ff: true }), beatDuration(finish))
})

// ── งบเวลากับ log จริง 3 ระดับความแกร่งของทีม ──
const mk = (t) => t.map(([id, rarity, element, grade]) => ({ id, rarity, element, grade }))
const PROFILES = {
  'กลาง': {
    A: mk([['dragon', 'epic', 'fist', 3], ['wolf', 'rare', 'fist', 3], ['fox', 'rare', 'scissors', 3], ['owl', 'rare', 'paper', 3]]),
    B: mk([['bahamut', 'legendary', 'fist', 5], ['phoenix', 'legendary', 'scissors', 5], ['whale', 'legendary', 'paper', 5], ['panda', 'epic', 'paper', 5]]),
    // worst/ffWorst ขยับขึ้นตอนเปิดระบบ passive (27 ส.ค.) — passive สายฟื้นเลือด/กันดาเมจ
    // (regen · guardian · damageReduction · revive · teamHp) ทำให้ต้องตีมากขึ้นกว่าจะจบไฟต์
    // ทุกค่าขยับขึ้นอีกครั้งตอนเปิด "โมเมนต์สกิล" (28 ส.ค.) — passive ที่ได้สปอตไลต์/ป้ายผ่าน
    // กินเวลาเพิ่ม ~5.2 วิ/ไฟต์ ซึ่งเป็นราคาที่ตั้งใจจ่าย ไม่ใช่ของบวมโดยบังเอิญ
    // ⚠️ ตัวคุมของฟีเจอร์นี้จริง ๆ คือเทส "งบเวลาของ passive" ท้ายไฟล์ (แม่นกว่าเวลารวมที่ปนหมัด)
    cap: { avg: 24000, worst: 30000, ffAvg: 17500, ffWorst: 21000 },
  },
  'ท็อป': {
    A: mk([['kirin', 'legendary', 'fist', 5], ['trex', 'legendary', 'fist', 5], ['ouroboros', 'legendary', 'scissors', 5], ['mammoth', 'legendary', 'paper', 5]]),
    B: mk([['simurgh', 'legendary', 'scissors', 5], ['qilin', 'legendary', 'paper', 5], ['cerberus', 'epic', 'fist', 5], ['panda', 'epic', 'paper', 5]]),
    cap: { avg: 32500, worst: 36000, ffAvg: 21000, ffWorst: 23000 },
  },
  'อ่อน': {
    A: mk([['hedgehog', 'common', 'fist', 1], ['cat', 'common', 'scissors', 1], ['turtle', 'common', 'paper', 1], ['hamster', 'common', 'fist', 1]]),
    B: mk([['mouse', 'common', 'scissors', 1], ['butterfly', 'common', 'paper', 1], ['seal', 'rare', 'paper', 2], ['fox', 'rare', 'scissors', 2]]),
    cap: { avg: 31000, worst: 35500, ffAvg: 20500, ffWorst: 23000 },
  },
}
const CHROME = 1100 + 900       // intro READY?/GO! + ค้างสนามท้ายไฟต์

function measure(prof) {
  const maxHp = {}
  prof.A.forEach((p, i) => { maxHp['A' + i] = Math.round(buildCombatant(p).maxHp) || 1 })
  prof.B.forEach((p, i) => { maxHp['B' + i] = Math.round(buildCombatant(p).maxHp) || 1 })
  let sum = 0, worst = 0, ffSum = 0, ffWorst = 0, oldSum = 0, pSum = 0, pWorst = 0
  const cnt = { chip: 0, solid: 0, heavy: 0, finish: 0 }
  for (let s = 1; s <= 200; s++) {
    const beats = buildBeats(simulateBattle(prof.A, prof.B, s).log, maxHp)
    for (const b of beats) if (b.tier) cnt[b.tier]++
    const d = totalDuration(beats) + CHROME
    const f = totalDuration(beats, { ff: true }) + CHROME
    sum += d; ffSum += f
    oldSum += beats.filter(b => b.t === 'attack').length * 1000    // ระบบเดิม ~1 วิ/หมัด
    if (d > worst) worst = d
    if (f > ffWorst) ffWorst = f
    // งบที่ passive กินไปโดยเฉพาะ — แยกออกมาเพราะเวลารวมปนเวลาหมัดจนจับของบวมไม่เจอ
    const pv = beats.filter(b => b.pTier)
      .reduce((a, b) => a + b.timing.windup + b.timing.motion + b.timing.hitstop + b.timing.tail, 0)
    pSum += pv
    if (pv > pWorst) pWorst = pv
  }
  const tot = cnt.chip + cnt.solid + cnt.heavy + cnt.finish
  return {
    avg: sum / 200, worst, ffAvg: ffSum / 200, ffWorst, oldAvg: oldSum / 200,
    pAvg: pSum / 200, pWorst,
    share: { chip: cnt.chip / tot, heavy: cnt.heavy / tot, finish: cnt.finish / tot },
  }
}

for (const [name, prof] of Object.entries(PROFILES)) {
  test(`งบเวลา — ทีม${name}`, () => {
    const m = measure(prof)
    assert.ok(m.avg <= prof.cap.avg, `เฉลี่ย ${Math.round(m.avg)}ms ต้องไม่เกิน ${prof.cap.avg}`)
    assert.ok(m.worst <= prof.cap.worst, `ยาวสุด ${Math.round(m.worst)}ms ต้องไม่เกิน ${prof.cap.worst}`)
    assert.ok(m.ffAvg <= prof.cap.ffAvg, `เร่งเฉลี่ย ${Math.round(m.ffAvg)}ms ต้องไม่เกิน ${prof.cap.ffAvg}`)
    assert.ok(m.ffWorst <= prof.cap.ffWorst, `เร่งยาวสุด ${Math.round(m.ffWorst)}ms ต้องไม่เกิน ${prof.cap.ffWorst}`)
    assert.ok(m.avg < m.oldAvg, `ต้องสั้นกว่าระบบเดิม (ใหม่ ${Math.round(m.avg)} vs เดิม ${Math.round(m.oldAvg)})`)
  })
  test(`งบเวลาของ passive — ทีม${name}`, () => {
    const m = measure(prof)
    // ตัวคุมจริงของ "โมเมนต์สกิล": โควตาต้องกันไม่ให้เวลา passive โตตามจำนวน passive ในทีม
    // (ถ้าวันหลังเผลอเอาโควตาออกแล้วหยุดทุกตัว ตัวเลขนี้จะพุ่งทันที — เวลารวมจะจับไม่ทัน)
    assert.ok(m.pAvg <= 6500, `passive กินเฉลี่ย ${Math.round(m.pAvg)}ms ต้องไม่เกิน 6500`)
    assert.ok(m.pWorst <= 8000, `passive กินสูงสุด ${Math.round(m.pWorst)}ms ต้องไม่เกิน 8000`)
  })
  test(`สัดส่วนชั้น — ทีม${name}`, () => {
    const { share } = measure(prof)
    // กันการกลับไปเป็นแบบฉบับแรกที่ heavy บวมเป็น 53%
    assert.ok(share.chip >= 0.45, `chip ${(share.chip * 100).toFixed(0)}% ต้องไม่ต่ำกว่า 45%`)
    assert.ok(share.heavy <= 0.20, `heavy ${(share.heavy * 100).toFixed(0)}% ต้องไม่เกิน 20%`)
    assert.ok(share.finish <= 0.06, `finish ${(share.finish * 100).toFixed(0)}% ต้องไม่เกิน 6%`)
  })
}


// ════════════════════════════════════════════════════════════
//  โมเมนต์สกิล — ชั้นของ passive (สเปก 2026-08-28-skill-moment)
// ════════════════════════════════════════════════════════════
const pas = (o) => ({ t: 'passive', uid: 'A0', side: 'A', effect: 'regenSelf', kind: 'heal', amount: 3, targets: ['A0'], ...o })
const pTiers = (beats) => beats.filter(b => b.t === 'passive').map(b => b.pTier)
const dur = (b) => b.timing.windup + b.timing.motion + b.timing.hitstop + b.timing.tail

test('passive — ฮีลตัวเดิมซ้ำ ๆ ครั้งแรกเท่านั้นที่หยุด ที่เหลือเงียบ', () => {
  const log = [atk({}), ...Array.from({ length: 5 }, () => pas({})), atk({})]
  const t = pTiers(buildBeats(log, MH))
  assert.equal(t.length, 5)
  assert.ok(t[0] === 'spotlight' || t[0] === 'glance', `ครั้งแรกต้องหยุด ได้ ${t[0]}`)
  assert.deepEqual(t.slice(1), ['mute', 'mute', 'mute', 'mute'])
})

test('passive — ชั้น mute กินเวลา 0ms (พฤติกรรมเดิมเป๊ะ)', () => {
  const log = [atk({}), pas({}), pas({})]
  const b = buildBeats(log, MH).filter(x => x.t === 'passive')
  assert.equal(dur(b[1]), 0)
})

test('passive — โควตาสปอตไลต์ไม่เกิน 3 ไม่ว่าจะมี passive กี่ตัว', () => {
  const log = [atk({})]
  for (let i = 0; i < 40; i++) log.push(pas({ uid: 'A' + i, effect: 'e' + i, amount: 40 }))
  const t = pTiers(buildBeats(log, { ...MH }))
  assert.equal(t.filter(x => x === 'spotlight').length, PASSIVE_SPOT_QUOTA)
})

test('passive — 1 สกิลของตัวเดียวกันได้สปอตไลต์ครั้งเดียวต่อไฟต์', () => {
  const log = [atk({})]
  for (let i = 0; i < 6; i++) log.push(pas({ uid: 'A0', effect: 'revive', kind: 'revive', amount: 50 }))
  const t = pTiers(buildBeats(log, MH))
  assert.equal(t.filter(x => x === 'spotlight').length, 1)
})

test('passive — จังหวะเป็น-ตาย (revive/cheatDeath/saveAlly) ได้สปอตไลต์แม้เบียดกับฮีลใหญ่', () => {
  const log = [atk({})]
  for (let i = 0; i < 5; i++) log.push(pas({ uid: 'A1', effect: 'healLowestAlly', amount: 45, targets: ['A1'] }))
  log.push(pas({ uid: 'B1', effect: 'cheatDeath', kind: 'save', amount: 1, targets: ['B1'] }))
  const beats = buildBeats(log, MH).filter(b => b.t === 'passive')
  assert.equal(beats[beats.length - 1].pTier, 'spotlight')
})

test('passive — ยกแรกได้ openGroup ทุกตัว และมีตัวเดียวที่ถือเวลาค้าง (ตัวสุดท้ายของกลุ่ม)', () => {
  const log = [
    pas({ uid: 'A0', effect: 'teamHp', kind: 'aura', amount: 0 }),
    pas({ uid: 'A1', effect: 'teamCrit', kind: 'aura', amount: 0 }),
    pas({ uid: 'B0', effect: 'teamAtk', kind: 'aura', amount: 0 }),
    atk({}), pas({ uid: 'A0', effect: 'regenSelf' }),
  ]
  const beats = buildBeats(log, MH)
  assert.deepEqual(beats.slice(0, 3).map(b => b.pTier), ['openGroup', 'openGroup', 'openGroup'])
  const holds = beats.slice(0, 3).filter(b => dur(b) > 0)
  assert.equal(holds.length, 1, 'ต้องค้างครั้งเดียวทั้งกลุ่ม ไม่ใช่ทีละตัว')
  assert.equal(holds[0], beats[2], 'ตัวที่ถือเวลาค้างต้องเป็นตัวสุดท้ายของกลุ่ม')
  assert.equal(dur(beats[2]), OPEN_GROUP_MS)
})

test('passive — ยกแรกยาวเท่าเดิมไม่ว่าจะมี aura กี่ตัว (นี่คือเหตุผลที่รวมกลุ่ม)', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => pas({ uid: 'A' + i, effect: 'aura' + i, kind: 'aura', amount: 0 }))
  const one = buildBeats([...mk(1), atk({})], MH).filter(b => b.t === 'passive')
  const seven = buildBeats([...mk(7), atk({})], MH).filter(b => b.t === 'passive')
  assert.equal(one.reduce((a, b) => a + dur(b), 0), seven.reduce((a, b) => a + dur(b), 0))
})

test('passive — ลมหายใจราชัน (aoeOpener) ในยกแรกได้สปอตไลต์ ไม่ถูกกลืนเข้ากลุ่ม', () => {
  const log = [
    pas({ uid: 'A0', effect: 'teamHp', kind: 'aura', amount: 0 }),
    pas({ uid: 'B0', effect: 'aoeOpener', kind: 'damage', amount: 20, targets: ['A0', 'A1'] }),
    atk({}),
  ]
  const beats = buildBeats(log, MH)
  assert.equal(beats[0].pTier, 'openGroup')
  assert.equal(beats[1].pTier, 'spotlight')
  assert.equal(dur(beats[1]), PASSIVE_TIMING.spotlight.windup + PASSIVE_TIMING.spotlight.hitstop + PASSIVE_TIMING.spotlight.tail)
})

test('passive — ไฟต์ที่ไม่มี passive เลย ได้ beat เหมือนเดิมทุกประการ', () => {
  const log = [...ramp(12), { t: 'end', winner: 'A' }]
  const beats = buildBeats(log, MH)
  assert.equal(beats.every(b => !b.pTier), true)   // หมัดไม่มี pTier · event อื่นได้ null
  assert.equal(totalDuration(beats), beats.reduce((a, b) => a + dur(b), 0))
})

test('passive — beats ยาวเท่า log เสมอ (ข้อบังคับ index ตรงกัน)', () => {
  const log = [pas({}), pas({ uid: 'A1' }), atk({}), pas({}), { t: 'round', n: 2 }, atk({}), { t: 'end' }]
  assert.equal(buildBeats(log, MH).length, log.length)
})

test('passive — กดค้างเร่งย่อได้เฉพาะป้ายผ่าน ห้ามย่อสปอตไลต์/ยกแรก', () => {
  const spot = { t: 'passive', pTier: 'spotlight', timing: { ...PASSIVE_TIMING.spotlight } }
  const glance = { t: 'passive', pTier: 'glance', timing: { ...PASSIVE_TIMING.glance } }
  const open = { t: 'passive', pTier: 'openGroup', timing: { windup: 0, motion: 0, hitstop: OPEN_GROUP_MS, tail: 0 } }
  assert.equal(beatDuration(spot, { ff: true }), beatDuration(spot))
  assert.equal(beatDuration(open, { ff: true }), beatDuration(open))
  assert.ok(beatDuration(glance, { ff: true }) < beatDuration(glance))
})
