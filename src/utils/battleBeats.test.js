import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBeats, scaleTiming, beatDuration, totalDuration, weightOf, timingOf,
  BEAT, KO_MULT, FINISH_MULT, SKILL_PAUSE, OPEN_GROUP_MS, SHAPE, FF_SCALE, WEIGHT_CFG, OPENING_EFFECTS,
} from './battleBeats.js'
// battleBeats.js ไม่ import อะไรโดยตั้งใจ — เทสจึงเป็นที่เดียวที่เอาสองฝั่งมาชนกันได้
import { PET_PASSIVES, partsOf, TEAM_AURA_EFFECTS, FOE_AURA_EFFECTS } from '../data/petPassives.js'
// 🔴 log ที่เขียนมือพิสูจน์ได้แค่ "รูปที่เรานึกออก" — ตระกูลหมัดสวน/สะท้อนมีรูปที่เอนจินเท่านั้นที่ผลิตได้
//    (หมัดลูกถูก log ก่อนหมัดแม่) จึงต้องมีเทสที่กิน log จากไฟต์จริงอย่างน้อยหนึ่งตัว
import { simulateBattle } from './battleEngine.js'

const MH = { A0: 100, A1: 100, B0: 100, B1: 100 }
const atk = (o = {}) => ({ t: 'attack', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90, ...o })
const pas = (o = {}) => ({ t: 'passive', uid: 'A0', effect: 'regenSelf', name: 'ฟื้นฟู', icon: '🎋', ...o })
const kinds = (bs) => bs.map(b => b.kind)

// ── ตารางเวลา ──────────────────────────────────────────────────────

test('SHAPE ทุกชุดรวมได้ 1 พอดี — ไม่งั้นเวลาจริงไม่ตรงกับที่ประกาศไว้', () => {
  for (const [name, arr] of Object.entries(SHAPE)) {
    const sum = arr.reduce((s, v) => s + v, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9, `${name} รวมได้ ${sum}`)
  }
})

test('timingOf: หมัดปกติ/KO/ปิดเกม ได้เวลาตามตัวคูณเป๊ะ', () => {
  const sum = (t) => t.windup + t.motion + t.hitstop + t.tail
  assert.equal(Math.round(sum(timingOf('hit'))), BEAT)
  assert.equal(Math.round(sum(timingOf('ko'))), BEAT * KO_MULT)
  assert.equal(Math.round(sum(timingOf('finish'))), BEAT * FINISH_MULT)
  assert.equal(Math.round(sum(timingOf('skill'))), SKILL_PAUSE)
  assert.equal(Math.round(sum(timingOf('openGroup'))), OPEN_GROUP_MS)
})

test('timingOf: kind ที่ไม่รู้จัก/หมัดลูก = ไม่กินเวลา (ไม่ throw ไม่ undefined)', () => {
  for (const k of ['sub', 'skillQuiet', 'openQuiet', 'ไม่มีอันนี้', null, undefined]) {
    const t = timingOf(k)
    assert.deepEqual(t, { windup: 0, motion: 0, hitstop: 0, tail: 0 }, String(k))
  }
})

// ── weight: ตัวที่ฆ่าบั๊ก "ดาเมจเท่ากันแต่เล่าคนละแบบ" ──────────────

test('🔑 ดาเมจเท่ากันบนเป้าเดียวกัน → weight เท่ากันเป๊ะ ไม่ว่าอยู่ตำแหน่งไหนของไฟต์', () => {
  const log = [
    atk({ dmg: 20, targetHpAfter: 80 }),
    atk({ dmg: 35, targetHpAfter: 45 }),
    atk({ dmg: 40, targetHpAfter: 5 }),
    atk({ dmg: 20, targetHpAfter: 0, dead: true }),   // ดาเมจ 20 เท่าตัวแรก
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[0].weight, bs[3].weight, 'ดาเมจ 20 เท่ากันต้องได้ weight เท่ากัน')
})

test('weight: มากขึ้นตามดาเมจ และตัน 1 ไม่เกิน', () => {
  assert.ok(weightOf({}, 0.10) < weightOf({}, 0.20))
  assert.ok(weightOf({}, 0.20) < weightOf({}, 0.30))
  assert.equal(weightOf({}, 0.30), WEIGHT_CFG.dmgWeight)          // ตันที่ dmgFull
  assert.equal(weightOf({}, 9.9), WEIGHT_CFG.dmgWeight)           // เกินแล้วไม่โตต่อ
  assert.equal(weightOf({ crit: true, eff: 'super' }, 9.9), 1)    // clamp บนสุด
})

test('weight: อยู่ใน [0,1] เสมอ แม้ maxHp ขาด/ดาเมจติดลบ/ค่าเพี้ยน', () => {
  const log = [atk({ dmg: -5, target: 'ไม่มี' }), atk({ dmg: 1e9, target: 'ไม่มี' })]
  for (const b of buildBeats(log, {})) {
    assert.ok(b.weight >= 0 && b.weight <= 1, `weight = ${b.weight}`)
  }
})

test('weight ไม่แตะเวลา · kind ไม่แตะ weight (สองแกนต้องอิสระต่อกัน)', () => {
  // ตัวที่ 3 มีไว้กันไม่ให้ตัวที่ 2 กลายเป็น finish (หมัดหลักตัวสุดท้ายของ log)
  const log = [atk({ dmg: 30, targetHpAfter: 70 }), atk({ dmg: 30, targetHpAfter: 40, crit: true }), atk()]
  const bs = buildBeats(log, MH)
  assert.ok(bs[1].weight > bs[0].weight, 'คริต้องดังกว่า')
  assert.equal(bs[0].kind, bs[1].kind, 'kind เดียวกัน')
  assert.deepEqual(bs[0].timing, bs[1].timing, 'แต่ต้องกินเวลาเท่ากัน')
})

// ── kind ของหมัด ───────────────────────────────────────────────────

test('🔑 ไม่มี beat ไหนได้ kind = undefined (ตัวที่กันบั๊กหมัดลูกยิงเอฟเฟกต์เต็มสูตร)', () => {
  const log = [
    pas({ effect: 'teamAtk', fxKind: 'aura' }),
    atk(), atk({ sub: true, dmg: 4 }), pas(), { t: 'round', n: 2 },
    atk({ dmg: 90, targetHpAfter: 0, dead: true }),
    { t: 'end', winner: 'A' },
  ]
  for (const b of buildBeats(log, MH)) {
    assert.notEqual(b.kind, undefined, `${b.t} ได้ kind undefined`)
  }
})

test('หมัดลูก (sub) = kind sub และไม่กินเวลาเลย', () => {
  const bs = buildBeats([atk(), atk({ sub: true, dmg: 5, target: 'B1' }), atk({ dmg: 99, targetHpAfter: 0, dead: true })], MH)
  assert.equal(bs[1].kind, 'sub')
  assert.equal(beatDuration(bs[1]), 0)
  assert.ok(bs[1].weight > 0, 'แต่ยังมี weight ของตัวเอง (ประกายเล็กตามความแรง)')
})

test('finish มีตัวเดียวต่อไฟต์เสมอ และเป็นหมัดหลักตัวสุดท้าย', () => {
  const log = [atk(), atk({ dmg: 50, targetHpAfter: 0, dead: true }), atk({ dmg: 99, targetHpAfter: 0, dead: true })]
  const bs = buildBeats(log, MH)
  assert.equal(kinds(bs).filter(k => k === 'finish').length, 1)
  assert.equal(bs[2].kind, 'finish')
  assert.equal(bs[1].kind, 'ko', 'หมัดที่ฆ่าแต่ไม่จบไฟต์ = ko')
})

test('หมัดลูกที่ปิดไฟต์ได้เวลาปิดเกม ส่วนหมัดหลักในบีตเดียวกันยกเวลาให้', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 80 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B1', dmg: 50, targetHpAfter: 0, dead: true, sub: true },
  ]
  const b = buildBeats(log, { B0: 100, B1: 100 })
  assert.equal(b[2].kind, 'finish', 'ใบสุดท้ายของไฟต์ต้องได้บีตปิดเกม แม้จะเป็นหมัดลูก')
  assert.equal(b[1].kind, 'sub', 'หมัดหลักของบีตนั้นยกเวลาให้ใบสุดท้าย')
  assert.equal(b[0].kind, 'hit', 'บีตก่อนหน้าไม่เกี่ยว')
})

test('ไฟต์ที่จบด้วยหมัดหลักตามปกติ จังหวะต้องไม่เปลี่ยน', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 90, targetHpAfter: 0, dead: true },
  ]
  const b = buildBeats(log, { B0: 100 })
  assert.equal(b[1].kind, 'finish')
  assert.equal(b[0].kind, 'hit')
})

test('หมัดลูกที่อยู่ท้าย log กลายเป็น finish ส่วนหมัดหลักก่อนหน้ายกเวลาให้ (user เคาะ 5 ก.ย.)', () => {
  const log = [atk({ dmg: 99, targetHpAfter: 0, dead: true }), atk({ sub: true, dmg: 3, target: 'B1' })]
  const bs = buildBeats(log, MH)
  assert.equal(bs[1].kind, 'finish', 'หมัดลูกใบสุดท้ายของไฟต์ต้องได้บีตปิดเกม')
  assert.equal(bs[0].kind, 'sub', 'หมัดหลักในบีตเดียวกันยกเวลาให้ใบสุดท้าย')
})

// ── หมัดสวน/สะท้อน: เอนจิน log ไว้ "ก่อน" หมัดแม่ ⇒ ใบท้าย log ไม่ใช่หมัดที่ปิดไฟต์ ──
// 🔑 เทสตัวนี้กิน log จาก simulateBattle จริง ไม่ใช่ log ที่เขียนมือ — เพราะรูปที่เขียนมือกันมา
//    (วาง sub ไว้ท้ายสุด) เป็นรูปที่เอนจินไม่เคยผลิตให้ตระกูลหมัดสวน/สะท้อนเลย บั๊กนี้จึงหลบเทส
//    ทั้งชุดของงานย่อย 2 มาได้ · ห้ามแทนด้วย log เขียนมือ ไม่งั้นช่องโหว่เดิมกลับมาทันที
test('บีตปิดเกมอยู่ที่หมัดที่ปิดไฟต์จริง ไม่ใช่หมัดแม่ที่ถูก log ทีหลัง (log จากไฟต์จริง)', () => {
  // 🔥 ฟีนิกซ์ตาย → คืนชีพ → ตีสวนบาฮามุทตาย = จบไฟต์ · เอนจิน push หมัดสวนก่อนหมัดแม่เสมอ
  const r = simulateBattle([{ id: 'phoenix', rarity: 'legendary', element: 'fist', grade: 0 }],
                           [{ id: 'bahamut', rarity: 'legendary', element: 'fist', grade: 0 }], 7)
  const mh = Object.fromEntries(Object.entries(r.units).map(([uid, s]) => [uid, Math.round(s.maxHp) || 1]))
  const bs = buildBeats(r.log, mh)

  const fins = bs.filter(b => b.kind === 'finish')
  assert.equal(fins.length, 1, 'finish มีใบเดียวเสมอ')
  const at = bs.findIndex(b => b.kind === 'finish')
  assert.equal(bs[at].dead, true, 'ใบที่ถือบีตปิดเกมต้องเป็นหมัดที่ฆ่าจริง')
  assert.equal(bs[at].attacker, 'A0', 'คือหมัดสวนของฟีนิกซ์')
  assert.equal(bs[at].sub, true)

  const parent = bs[at + 1]
  assert.equal(parent.t, 'attack', 'ถัดไปคือหมัดแม่ที่ถูก log ทีหลัง')
  assert.equal(parent.dead, false, 'หมัดแม่ไม่ได้ฆ่าใคร (และดาเมจติดลบเพราะฟีนิกซ์ฟื้นเลือด)')
  assert.equal(parent.kind, 'sub', 'อยู่บีตเดียวกัน ⇒ ยกเวลาให้ใบที่ปิดไฟต์')
  assert.equal(beatDuration(parent), 0, 'ห้ามมีหมัดกินเวลาต่อท้ายบีตปิดเกม')
})

test('หมัดสวนที่ล้างทีมศัตรู ได้บีตปิดเกม (รูปเดียวกับที่เอนจินผลิต)', () => {
  const log = [
    pas({ effect: 'revive', fxKind: 'revive' }),
    atk({ side: 'A', attacker: 'A0', target: 'B0', dmg: 99, targetHpAfter: 0, dead: true, sub: true }),
    atk({ side: 'B', attacker: 'B0', target: 'A0', dmg: -9, targetHpAfter: 40, dead: false }),
    { t: 'end', winner: 'A', rounds: 3, hpPctA: 0.4, hpPctB: 0 },
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[1].kind, 'finish')
  assert.equal(bs[2].kind, 'sub')
})

// 🔒 กับดักของกฎนี้ — วัดจาก log จริง (bahamut vs cerberus ซีด 5308871522): หมัดลูกของ "บีตก่อนหน้า"
//    ใส่ลายเซ็นเดียวกับหมัดสวนได้เป๊ะ (sub + ผู้ตีเป็นเป้าของหมัดแม่) ตัวแยกคือหมัดแม่ฆ่าเองหรือเปล่า
test('หมัดหลักใบท้ายที่ฆ่าเอง ต้องคงบีตปิดเกมไว้ แม้ก่อนหน้าจะเป็นหมัดลูกของบีตก่อน', () => {
  const log = [
    atk({ side: 'B', attacker: 'B0', target: 'A2', dmg: 23, targetHpAfter: 40 }),
    atk({ side: 'B', attacker: 'B0', target: 'A2', dmg: 9, targetHpAfter: 31, sub: true }),
    atk({ side: 'A', attacker: 'A2', target: 'B0', dmg: 22, targetHpAfter: 0, dead: true }),
    { t: 'end', winner: 'A', rounds: 4, hpPctA: 0.3, hpPctB: 0 },
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[2].kind, 'finish', 'หมัดที่ฆ่าจริงคือใบท้าย ห้ามย้ายบีตไปไหน')
  assert.equal(bs[1].kind, 'sub')
})

test('ไฟต์ที่จบเพราะหมดรอบ บีตปิดเกมอยู่ที่หมัดสุดท้าย ไม่กระโดดย้อนไปหาศพก่อนหน้า', () => {
  const log = [
    atk({ side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 50 }),
    atk({ side: 'B', attacker: 'B0', target: 'A1', dmg: 99, targetHpAfter: 0, dead: true, sub: true }),
    atk({ side: 'A', attacker: 'A0', target: 'B0', dmg: 5, targetHpAfter: 60 }),
    { t: 'end', winner: 'A', rounds: 30, hpPctA: 0.4, hpPctB: 0.6 },   // ไม่มีฝั่งไหนถูกล้างทีม
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[2].kind, 'finish', 'ไม่มีหมัดปิดไฟต์ ⇒ ใบสุดท้ายถือบีตไว้ตามเดิม')
  assert.equal(bs[1].kind, 'sub')
  assert.equal(bs[1].kill, true, 'ศพก่อนหน้ายังเป็นการตายอยู่ แค่ไม่ใช่จังหวะปิดเกม')
})

// ── ประกาศสกิล ────────────────────────────────────────────────────

test('สกิลครั้งแรกได้หยุด SKILL_PAUSE · ครั้งซ้ำเงียบ 0ms', () => {
  const log = [atk(), pas(), atk(), pas(), atk(), pas({ effect: 'dodge' })]
  const bs = buildBeats(log, MH)
  assert.equal(bs[1].kind, 'skill')
  assert.equal(Math.round(beatDuration(bs[1])), SKILL_PAUSE)
  assert.equal(bs[3].kind, 'skillQuiet')
  assert.equal(beatDuration(bs[3]), 0)
  assert.equal(bs[5].kind, 'skill', 'สกิลคนละตัว = ครั้งแรกของมันเอง')
})

test('สกิลของคนละตัวที่ effect เดียวกัน นับแยกกัน', () => {
  const bs = buildBeats([atk(), pas({ uid: 'A0' }), pas({ uid: 'A1' }), pas({ uid: 'A0' })], MH)
  assert.deepEqual(kinds(bs).slice(1), ['skill', 'skill', 'skillQuiet'])
})

test('จังหวะเป็น-ตาย ได้โมเมนต์เต็มเสมอ แม้เป็นครั้งซ้ำ', () => {
  const log = [atk(), pas({ effect: 'revive' }), pas({ effect: 'revive' }), pas({ effect: 'saveAlly' })]
  const bs = buildBeats(log, MH)
  for (const i of [1, 2, 3]) {
    assert.equal(bs[i].kind, 'skillMoment', `beat ${i}`)
    assert.equal(Math.round(beatDuration(bs[i])), BEAT * KO_MULT)
  }
})

test('ยกแรก: ทุกตัวเวลา 0 ยกเว้นตัวท้ายกลุ่มที่ถือเวลาค้างไว้คนเดียว', () => {
  const log = [
    pas({ uid: 'A0', effect: 'teamAtk', fxKind: 'aura' }),
    pas({ uid: 'A1', effect: 'teamCrit', fxKind: 'aura' }),
    atk(),
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[0].kind, 'openQuiet')
  assert.equal(beatDuration(bs[0]), 0)
  assert.equal(bs[1].kind, 'openGroup')
  assert.equal(Math.round(beatDuration(bs[1])), OPEN_GROUP_MS)
})

test('🔑 สกิล onAttack ของตัวที่ตีคนแรก ต้องไม่ถูกกลืนเข้ายกแรก (บั๊ก 6)', () => {
  // engine push event ของ runOnAttack ก่อน log ของหมัดเสมอ
  const log = [
    pas({ uid: 'B0', effect: 'teamAtk', fxKind: 'aura' }),      // ยกแรกจริง
    pas({ uid: 'A0', effect: 'cleave', fxKind: 'cleave' }),     // โปรกตอนตีหมัดแรก ไม่ใช่ยกแรก
    atk(),
  ]
  const bs = buildBeats(log, MH)
  assert.equal(bs[0].kind, 'openGroup', 'aura = ยกแรก และเป็นตัวท้ายกลุ่ม')
  assert.equal(bs[1].kind, 'skill', 'cleave ต้องได้ประกาศตอนโปรกจริง')
})

test('ไม่มี passive ก่อนหมัดแรกเลย → ไม่มี openGroup และไม่ throw', () => {
  const bs = buildBeats([atk(), atk({ dmg: 99, targetHpAfter: 0, dead: true })], MH)
  assert.equal(kinds(bs).filter(k => k === 'openGroup').length, 0)
})

// ── danger / survive ───────────────────────────────────────────────

test('danger/survive ไล่ตามเวลาจริง ไม่ใช่ตามอันดับ', () => {
  const log = [atk({ dmg: 80, targetHpAfter: 20 }), atk({ dmg: 15, targetHpAfter: 5 })]
  const bs = buildBeats(log, MH)
  assert.equal(bs[0].danger, true)
  assert.equal(bs[0].survive, false)
  assert.equal(bs[1].survive, true, 'ตกผ่าน 10% ครั้งแรก')
})

// ── scaleTiming / กดค้างเร่ง ───────────────────────────────────────

test('กดค้างเร่ง: ย่อเฉพาะหมัดปกติ — โมเมนต์ห้ามย่อ (ไม่งั้นเป็นปุ่มข้าม)', () => {
  const log = [atk(), atk({ dmg: 99, targetHpAfter: 0, dead: true })]
  const bs = buildBeats(log, MH)
  assert.ok(beatDuration(bs[0], { ff: true }) < beatDuration(bs[0]), 'หมัดปกติต้องย่อ')
  assert.equal(beatDuration(bs[1], { ff: true }), beatDuration(bs[1]), 'finish ห้ามย่อ')
  for (const k of ['ko', 'finish', 'skillMoment']) assert.equal(FF_SCALE[k], 1, k)
})

test('pace คูณทุกเฟสเท่ากัน และไม่แก้ beat เดิม', () => {
  const b = buildBeats([atk()], MH)[0]
  const before = { ...b.timing }
  const t = scaleTiming(b, { pace: 1.25 })
  assert.equal(Math.round(t.windup), Math.round(before.windup * 1.25))
  assert.deepEqual(b.timing, before, 'ต้องไม่ mutate')
})

// ── สัญญาโครงสร้าง ─────────────────────────────────────────────────

test('1 event = 1 beat เสมอ (index ต้องตรงกับ log)', () => {
  const log = [pas({ fxKind: 'aura', effect: 'teamAtk' }), atk(), atk({ sub: true }), { t: 'round', n: 2 }, { t: 'end' }]
  assert.equal(buildBeats(log, MH).length, log.length)
})

test('deterministic: log เดิม → beat เหมือนเดิมทุกฟิลด์', () => {
  const log = [pas({ fxKind: 'aura', effect: 'teamAtk' }), atk(), pas(), atk({ dmg: 99, targetHpAfter: 0, dead: true })]
  assert.deepEqual(buildBeats(log, MH), buildBeats(log, MH))
})

test('input พัง (null / ไม่ใช่ array / event เป็น null) ต้องไม่ throw', () => {
  assert.deepEqual(buildBeats(null, null), [])
  assert.deepEqual(buildBeats(undefined, MH), [])
  const bs = buildBeats([null, atk(), undefined], MH)
  assert.equal(bs.length, 3)
  assert.equal(totalDuration(bs) > 0, true)
})

test('totalDuration: ไฟต์ตัวอย่างอยู่ในงบที่สเปกอ้างไว้', () => {
  // 20 หมัดปกติ + 2 ko + 1 finish + ยกแรก + สกิลครั้งแรก 1 ตัว
  const log = [pas({ fxKind: 'aura', effect: 'teamAtk' })]
  for (let i = 0; i < 20; i++) log.push(atk())
  log.push(pas())
  log.push(atk({ dmg: 99, targetHpAfter: 0, dead: true }))
  log.push(atk({ dmg: 99, targetHpAfter: 0, dead: true, target: 'B1' }))
  log.push(atk({ dmg: 99, targetHpAfter: 0, dead: true, target: 'B1' }))
  const want = 20 * BEAT + 2 * BEAT * KO_MULT + BEAT * FINISH_MULT + OPEN_GROUP_MS + SKILL_PAUSE
  assert.equal(Math.round(totalDuration(buildBeats(log, MH))), want)
})

test('🔑 beat.kind (เวลา) ต้องไม่ทับ fxKind (ชนิดผล) ที่ passive ส่งมา', () => {
  const log = [atk(), pas({ effect: 'duoRegen', fxKind: 'heal', amount: 12, hpPct: 74 })]
  const bs = buildBeats(log, MH)
  assert.equal(bs[1].kind, 'skill', 'kind = เวลา')
  assert.equal(bs[1].fxKind, 'heal', 'ชนิดผลต้องรอดมาถึง renderer')
  assert.equal(bs[1].amount, 12, 'เลข +N ต้องรอดมาด้วย')
})

test('เพ็ทหลาย part ที่ยิงติดกัน = จังหวะเดียว (ใบสุดท้ายถือเวลาคนเดียว)', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'stackAtk' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'healLowestAlly' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.deepEqual([b[1].kind, b[2].kind, b[3].kind], ['skillQuiet', 'skillQuiet', 'skill'])
  const held = [b[1], b[2], b[3]].reduce((s, x) => s + x.timing.hitstop, 0)
  assert.equal(held, SKILL_PAUSE)      // รวมกันแล้วยังหยุดแค่ครั้งเดียว ไม่ใช่ 3 เท่า
})

test('สอง part ที่ effect เดียวกันของเพ็ทตัวเดียว ต้องไม่ถูกกลืนหายไปเงียบๆ', () => {
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.equal(b[2].kind, 'skill')     // ใบสุดท้ายของก้อนยังได้ประกาศ
})

test('🔑 คีย์ตัวดักซ้ำต้องไม่ผูกกับตำแหน่งดิบในก้อน — พาร์ตข้างเคียงหาย/โผล่ ไม่ทำให้ effect เดิมดูเหมือนใหม่', () => {
  // จำลอง 🐍 อูโรโบรอส (P2c): parts [regenSelf, stackAtk] บน onRound · regenSelf ข้ามตัวเองเวลาเลือดเต็ม
  // รอบแรก: เลือดพร่อง ⇒ ก้อนมีทั้งคู่ [regenSelf, stackAtk] — stackAtk อยู่ตำแหน่งดิบที่ 1
  // รอบสอง: เลือดเต็มแล้ว (regenSelf ข้าม) ⇒ ก้อนเหลือ [stackAtk] เดี่ยวๆ — ตำแหน่งดิบขยับเป็น 0
  // ถ้าคีย์ผูกกับตำแหน่งดิบ stackAtk รอบสองจะได้คีย์ใหม่ (ตำแหน่ง 0 ≠ 1) แล้วดูเหมือนประกาศครั้งแรก
  // อีกรอบ ทั้งที่จริงเป็น "ครั้งซ้ำ" — ได้หยุด 200ms ที่ไม่ควรมี
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf' },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'stackAtk' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'stackAtk' },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 80 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.equal(b[4].kind, 'skillQuiet', 'stackAtk เดี่ยวรอบสอง = ครั้งซ้ำ ไม่ใช่ครั้งแรก')
})

test('duoRegen ไม่เข้าก้อนของเพ็ทใบนั้น — คู่หู 🐳🦭 ต้องได้โมเมนต์ของตัวเอง', () => {
  // ของจริง: runOnRound ยิง duoRegen บน "ตัวที่ได้รับเลือด" ก่อน แล้วค่อยยิงพาสสีฟของเพ็ทใบนั้นเอง
  // ⇒ uid ซ้ำกันติดกัน · ถ้าจัดก้อนด้วย uid เฉยๆ duoRegen จะถูกลดเป็น skillQuiet แล้วป้าย 💧 หายไป
  const log = [
    { t: 'attack', side: 'A', attacker: 'A0', target: 'B0', dmg: 10, targetHpAfter: 90 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'duoRegen', fxKind: 'heal', amount: 5, hpPct: 60 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'regenSelf', fxKind: 'heal', amount: 4, hpPct: 64 },
    { t: 'attack', side: 'B', attacker: 'B0', target: 'A0', dmg: 10, targetHpAfter: 90 },
  ]
  const b = buildBeats(log, { A0: 100, B0: 100 })
  assert.equal(b[1].kind, 'skill', 'duoRegen ต้องได้ประกาศของตัวเอง')
  assert.equal(b[2].kind, 'skill', 'พาสสีฟของเพ็ทเองก็ยังได้ประกาศ')
  assert.equal(b[1].timing.hitstop + b[2].timing.hitstop, SKILL_PAUSE * 2)
})

test('duoRegen ครั้งซ้ำยังเงียบเหมือนเดิม (กันออกจากก้อน ≠ ประกาศทุกรอบ)', () => {
  const duo = { t: 'passive', uid: 'A1', side: 'A', effect: 'duoRegen', fxKind: 'heal', amount: 5, hpPct: 60 }
  const log = [atk(), { ...duo }, atk(), { ...duo }]
  const b = buildBeats(log, MH)
  assert.equal(b[1].kind, 'skill')
  assert.equal(b[3].kind, 'skillQuiet')
})

test('duoRegen ของคนละตัวยังแยกกันเหมือนเดิม (คีย์ก้อนต้องพ่วง uid ด้วย)', () => {
  const log = [
    atk(),
    { t: 'passive', uid: 'A0', side: 'A', effect: 'duoRegen', fxKind: 'heal', amount: 5, hpPct: 60 },
    { t: 'passive', uid: 'A1', side: 'A', effect: 'duoRegen', fxKind: 'heal', amount: 5, hpPct: 60 },
  ]
  const b = buildBeats(log, MH)
  assert.deepEqual([b[1].kind, b[2].kind], ['skill', 'skill'], 'คนละตัว = คนละก้อน คนละคีย์ ต่างได้ประกาศของตัวเอง')
})

// ── สัญญาข้ามไฟล์: OPENING_EFFECTS ต้องครบทุก effect ของ hook aura/setup ────────────
// battleBeats.js ไม่ import อะไรโดยตั้งใจ (pure ล้วน) ⇒ ตรวจให้ตัวเองไม่ได้ · เทสนี้จึงเป็นตัวคุมแทน
// ถ้าตกหล่นตัวใดตัวหนึ่ง openCutOf() จะตัดกลุ่มยกแรกที่ตัวนั้น แล้วป้ายออร่าเลิกขึ้นพร้อมกัน
// (เกิดจริงตอน P2a เพิ่ม aura 3 ตัว + hook setup แล้วลืมมาเติมที่นี่)
test('OPENING_EFFECTS: ครบทุก effect ที่ประกาศเป็นออร่าในทะเบียนป้าย', () => {
  for (const eff of [...TEAM_AURA_EFFECTS, ...FOE_AURA_EFFECTS]) {
    assert.ok(OPENING_EFFECTS.has(eff), `${eff} เป็นออร่าแต่ไม่อยู่ใน OPENING_EFFECTS`)
  }
})

test('OPENING_EFFECTS: ครบทุก part ในทะเบียนเพ็ทที่ hook เป็น aura/setup', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const part of partsOf(p)) {
      if (part.hook !== 'aura' && part.hook !== 'setup') continue
      assert.ok(OPENING_EFFECTS.has(part.effect), `${id}: ${part.effect} (${part.hook}) ไม่อยู่ใน OPENING_EFFECTS`)
    }
  }
})

test('OPENING_EFFECTS: hook setup ต้องอยู่ด้วย — เอนจิน log runSetup ก่อน aura ทุกใบ', () => {
  // hook `setup` ยังไม่มีทะเบียนรวมแบบ TEAM_AURA_EFFECTS (มี effect เดียวคือ stealStats) และยังไม่มีเพ็ทถือ
  // ⇒ เทสสองตัวข้างบนยังคลุมไม่ถึง · พอ P3 ให้ 🐭 ถือ stealStats จริง เทส "ทะเบียนเพ็ท" จะคลุมแทนเอง
  assert.ok(OPENING_EFFECTS.has('stealStats'))
})
