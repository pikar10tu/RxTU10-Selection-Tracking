// เทส passive — pure ทั้งหมด · รัน: node --test src/utils/battlePassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAuras, runOnStart, runOnRound, runOnAttack, runOnHit, runOnDeath, runOnKill, passiveFor,
} from './battlePassives.js'
import { PET_PASSIVES, passiveValueAt, passiveText, effectText, PASSIVE_MAX_LEVEL, STATUS_ICON, STATUS_TEXT } from '../data/petPassives.js'
import { PETS } from '../data/index.js'
import { simulateBattle } from './battleEngine.js'
import { buildBeats, beatDuration } from './battleBeats.js'

const u = (id, over = {}) => ({ id, uid: over.uid || 'A0', side: 'A', atk: 100, maxHp: 1000, hp: 1000, element: 'fist', ...over })
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)] }

// ── data integrity ──────────────────────────────────────────
test('เพ็ททุกตัวในแค็ตตาล็อกมี passive ครบ ไม่มีตัวไหนตกหล่น', () => {
  const missing = PETS.filter(p => !PET_PASSIVES[p.id]).map(p => p.id)
  assert.deepEqual(missing, [], 'เพ็ทที่ยังไม่มี passive')
})

test('passive ทุกอันมีฟิลด์ครบและ hook ที่รู้จัก', () => {
  const HOOKS = ['aura', 'onStart', 'onRound', 'onAttack', 'onHit', 'onKill', 'onDeath']
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.ok(p.name && p.icon && p.effect && p.desc, `${id} ฟิลด์ไม่ครบ`)
    assert.ok(HOOKS.includes(p.hook), `${id} hook ไม่รู้จัก: ${p.hook}`)
  }
})

test('ชื่อ passive ไม่ซ้ำกัน (ผู้เล่นต้องแยกออกว่าใครเป็นใคร)', () => {
  const names = Object.values(PET_PASSIVES).map(p => p.name)
  assert.equal(new Set(names).size, names.length)
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
  assert.equal(t.atkStacks, 3, 'เพดาน 3 ชั้น')
  assert.ok(t.atk > base)
})

test('killChain (kirin): ตีต่อได้จนถึงเพดาน แล้วหยุด (ไม่วนไม่รู้จบ)', () => {
  const k = u('kirin')
  assert.equal(runOnKill(k, 0).extraAttack, true)
  assert.equal(runOnKill(k, 1).extraAttack, true)
  assert.equal(runOnKill(k, 2).extraAttack, false)
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
  assert.ok(passiveText(p, 1).includes(String(passiveValueAt(p, 1).pct)))
  assert.ok(passiveText(p, 3).includes(String(passiveValueAt(p, 3).pct)))
  assert.notEqual(passiveText(p, 1), passiveText(p, 3), 'ขั้นต่างกันข้อความต้องต่างกัน')
})

test('passiveValueAt: ขั้นนอกช่วงถูก clamp · ขั้น 1 = ค่าตั้งต้นเป๊ะ', () => {
  const p = PET_PASSIVES.fox
  assert.deepEqual(passiveValueAt(p, 1), p.value)
  assert.deepEqual(passiveValueAt(p, 0), passiveValueAt(p, 1))
  assert.deepEqual(passiveValueAt(p, 99), passiveValueAt(p, PASSIVE_MAX_LEVEL))
})

test('🪨 ขั้น 3 ต้องไม่หลุดเพดานความสมเหตุสมผล (เผื่อดันเจี้ยนหิน)', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    const v = passiveValueAt(p, PASSIVE_MAX_LEVEL)
    if (p.effect === 'dodge') assert.ok(v.pct <= 25, `${id} หลบ ${v.pct}% สูงเกินจนไฟต์ยืด`)
    if (p.effect === 'damageReduction') assert.ok(v.pct <= 35, `${id} ลดดาเมจ ${v.pct}% สูงเกิน`)
    if (p.effect === 'guardian') assert.ok(v.pct <= 100, `${id} รับแทน ${v.pct}% เกิน 100% เป็นไปไม่ได้`)
    if (p.effect === 'revive') assert.ok(v.pct <= 70, `${id} ฟื้น ${v.pct}% สูงเกิน`)
    if (p.effect === 'multiStrike') assert.ok(v.chance <= 60, `${id} โอกาสตีซ้ำ ${v.chance}% สูงเกิน`)
  }
})

test('🪨 killChain/cheatDeath/saveAlly ต้องอัพขั้นแล้วค่าไม่ขยับ (โตแล้วพัง)', () => {
  for (const id of ['kirin', 'cat', 'genie']) {
    const p = PET_PASSIVES[id]
    assert.deepEqual(passiveValueAt(p, PASSIVE_MAX_LEVEL), passiveValueAt(p, 1), `${id} ไม่ควรอัพได้`)
  }
})

test('ขั้น 3 ต้องแรงกว่าขั้น 1 จริงสำหรับตัวที่อัพได้ (ไม่งั้นหินไร้ความหมาย)', () => {
  const upgradable = Object.entries(PET_PASSIVES)
    .filter(([, p]) => Object.values(p.step || {}).some(x => x > 0))
  assert.ok(upgradable.length >= 20, `อัพได้แค่ ${upgradable.length} ตัว น้อยเกินไป`)
  for (const [id, p] of upgradable) {
    const a = passiveValueAt(p, 1), b = passiveValueAt(p, PASSIVE_MAX_LEVEL)
    assert.ok(Object.keys(p.step).some(k => b[k] > a[k]), `${id} ขั้น 3 ไม่แรงขึ้นเลย`)
  }
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
