// เทสที่มาของบัฟ + สถานะสด — pure ทั้งหมด · รัน: node --test src/utils/battleBuffs.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buffSources, liveBuffs, badgesOf } from './battleBuffs.js'
import { STATUS_MAX, PET_PASSIVES } from '../data/petPassives.js'

const p = (id, over = {}) => ({ id, rarity: 'legendary', element: 'fist', grade: 0, ...over })
const find = (list, effect) => list.find(b => b.effect === effect)

test('บัฟจากทีมตัวเอง: คุณวาฬในทีม → ❤️ ขึ้นทุกใบฝั่งเรา พร้อมชื่อเจ้าของ', () => {
  const s = buffSources([p('whale'), p('turtle')], [p('mouse')])
  for (const uid of ['A0', 'A1']) {
    const b = find(s[uid], 'teamHp')
    assert.ok(b, `${uid} ควรได้ teamHp`)
    assert.equal(b.ownerUid, 'A0')
    assert.equal(b.skillName, 'พรมหาสมุทร')
    assert.equal(b.ownerName, 'คุณวาฬ')
    assert.equal(b.buff, true)
    assert.equal(b.foeSide, false)
    assert.match(b.label, /10/)          // effectText เติมเลขจริงให้แล้ว
  }
  assert.equal(find(s.B0, 'teamHp'), undefined, 'aura ต้องไม่ข้ามไปทีมศัตรู')
})

test('ดีบัฟข้ามฝั่ง: นกฮูกอยู่ทีมศัตรู → 🎯 ขึ้นบนทีมเรา ติดธง foeSide', () => {
  const s = buffSources([p('turtle')], [p('owl')])
  const b = find(s.A0, 'enemyVuln')
  assert.ok(b)
  assert.equal(b.buff, false)
  assert.equal(b.foeSide, true)
  assert.equal(b.ownerUid, 'B0')
  assert.equal(b.ownerName, 'นกฮูก')
  // ⚠️ ข้อความต้องเป็นมุม "ผู้รับ" — มุมเจ้าของ ("ศัตรูทุกตัวรับดาเมจเพิ่ม") อ่านกลับด้านทันที
  assert.equal(b.label, 'รับดาเมจเพิ่ม 6%')
  assert.equal(find(s.B0, 'enemyVuln'), undefined, 'เจ้าของ aura ไม่ควรติดดีบัฟของตัวเอง')
})

test('สถานะติดตัว: ขึ้นเฉพาะเจ้าตัว และ self = true', () => {
  const s = buffSources([p('fox'), p('turtle')], [p('mouse')])
  const b = find(s.A0, 'dodge')
  assert.ok(b)
  assert.equal(b.self, true)
  assert.equal(find(s.A1, 'dodge'), undefined, 'เพื่อนไม่ควรได้ dodge ไปด้วย')
})

test('คู่หู 🐳🦭: duoRegen ขึ้นครบทีมเมื่อมีทั้งคู่ · ไม่ขึ้นเมื่อมีตัวเดียว', () => {
  const both = buffSources([p('whale'), p('seal')], [p('mouse')])
  assert.ok(find(both.A0, 'duoRegen'), 'A0 ควรได้ duoRegen')
  assert.ok(find(both.A1, 'duoRegen'), 'A1 ควรได้ duoRegen')
  const solo = buffSources([p('seal'), p('turtle')], [p('mouse')])
  assert.equal(find(solo.A0, 'duoRegen'), undefined, 'ไม่มีวาฬ = ไม่มีคู่หู')
})

test('key ไม่ซ้ำในลิสต์เดียว (สอง passive ที่ให้ effect เดียวกันต้องอยู่ได้ทั้งคู่)', () => {
  const s = buffSources([p('fox'), p('mouse')], [p('turtle')])   // dodge ทั้งคู่ แต่คนละตัว
  const keys = [...s.A0, ...s.A1].map(b => b.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('liveBuffs: stacks นับตาม idx — ก่อนถึง beat = 0 · หลัง 2 beat = 2', () => {
  const s = buffSources([p('trex')], [p('mouse'), p('mouse')])
  const beats = [
    { t: 'attack', attacker: 'A0', target: 'B0' },
    { t: 'passive', uid: 'A0', effect: 'stackAtk', amount: 1 },
    { t: 'attack', attacker: 'A0', target: 'B1' },
    { t: 'passive', uid: 'A0', effect: 'stackAtk', amount: 2 },
  ]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'stackAtk').stacks, 0)
  assert.equal(find(liveBuffs(s.A0, beats, 1), 'stackAtk').stacks, 1)
  assert.equal(find(liveBuffs(s.A0, beats, 3), 'stackAtk').stacks, 2)
  assert.equal(find(liveBuffs(s.A0, beats, 3), 'stackAtk').maxStacks, 3)
})

test('liveBuffs: spent — เห็น event revive แล้วต้องเป็น true', () => {
  const s = buffSources([p('phoenix')], [p('mouse')])
  const beats = [{ t: 'attack', attacker: 'B0', target: 'A0' },
                 { t: 'passive', uid: 'A0', effect: 'revive', fxKind: 'revive' }]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'revive').spent, false)
  assert.equal(find(liveBuffs(s.A0, beats, 1), 'revive').spent, true)
})

test('liveBuffs: saveAlly ของเพื่อนถูกใช้ → นับที่ "เจ้าของ" ไม่ใช่คนที่ถูกช่วย', () => {
  const s = buffSources([p('genie'), p('turtle')], [p('mouse')])
  const beats = [{ t: 'passive', uid: 'A0', effect: 'saveAlly', targets: ['A1'], fxKind: 'save' }]
  assert.equal(find(liveBuffs(s.A0, beats, 0), 'saveAlly').spent, true)
})

test('badgesOf: ตัดที่มาทิ้ง + ไม่เกิน STATUS_MAX', () => {
  const s = buffSources([p('whale'), p('fairy'), p('wolf'), p('fox')], [p('owl')])
  const b = badgesOf(s.A3, STATUS_MAX)
  assert.ok(b.length <= STATUS_MAX)
  assert.deepEqual(Object.keys(b[0]).sort(), ['buff', 'icon', 'key', 'label'])
})

test('badgesOf: effect ซ้ำไม่ขึ้นสองป้าย (🦊+🐭 หลบเหมือนกัน)', () => {
  const s = buffSources([p('fox'), p('mouse')], [p('turtle')])
  const b = badgesOf([...s.A0, ...s.A1], STATUS_MAX)
  assert.equal(b.filter(x => x.key === 'dodge').length, 1)
})

test('บัฟ: พาสสีฟ 2 ผลต้องได้ป้ายครบทั้งสองใบ', () => {
  PET_PASSIVES.__dual = {
    name: 'ทดสอบสองป้าย', icon: '🧪',
    parts: [
      { hook: 'onHit', effect: 'damageReduction', value: { pct: 10 }, step: { pct: 0 } },
      { hook: 'onHit', effect: 'dodge', value: { pct: 5 }, step: { pct: 0 } },
    ],
    desc: 'ทดสอบ', short: 'ทดสอบ',
  }
  try {
    const src = buffSources([{ id: '__dual' }], [])
    const effects = (src.A0 || []).map(b => b.effect)
    assert.ok(effects.includes('damageReduction'), 'ป้ายแรกหาย')
    assert.ok(effects.includes('dodge'), 'ป้ายที่สองหาย')
  } finally {
    delete PET_PASSIVES.__dual
  }
})
