// เทสตัวช่วยอ่านรูปข้อมูลพาสสีฟ — pure · รัน: node --test src/data/petPassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PET_PASSIVES, partsOf, partsAt, partAt, partWithEffect,
  passiveValueAt, passiveText, effectText,
} from './petPassives.js'

test('partsOf: รูปใหม่คืน parts ตรงๆ', () => {
  const p = { parts: [{ hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1 } }] }
  assert.equal(partsOf(p).length, 1)
  assert.equal(partsOf(p)[0].effect, 'regenSelf')
})

test('partsOf: รูปเก่าไม่ถูกรองรับอีกแล้ว — คืนลิสต์ว่าง', () => {
  const old = { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }
  assert.deepEqual(partsOf(old), [])
})

test('ทะเบียนต้องไม่มี hook/effect ระดับบนสุดหลงเหลือ (สองแหล่งความจริง = พังเงียบ)', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    assert.equal(p.hook, undefined, `${id} ยังมี hook ระดับบนสุด`)
    assert.equal(p.effect, undefined, `${id} ยังมี effect ระดับบนสุด`)
    assert.ok(Array.isArray(p.parts), `${id} ไม่มี parts`)
  }
})

test('partsOf: ไม่มีอะไรเลยคืนลิสต์ว่าง ไม่ throw', () => {
  assert.deepEqual(partsOf(null), [])
  assert.deepEqual(partsOf({}), [])
})

test('partsAt: คืนทุก part ที่ hook ตรง ตามลำดับที่เขียนไว้', () => {
  const p = { parts: [
    { hook: 'onRound', effect: 'regenSelf', value: { pct: 3 } },
    { hook: 'onRound', effect: 'stackAtk', value: { pct: 5, max: 4 } },
    { hook: 'onHit', effect: 'dodge', value: { pct: 9 } },
  ] }
  assert.deepEqual(partsAt(p, 'onRound').map(x => x.effect), ['regenSelf', 'stackAtk'])
  assert.deepEqual(partsAt(p, 'onHit').map(x => x.effect), ['dodge'])
  assert.deepEqual(partsAt(p, 'aura'), [])
})

test('partAt / partWithEffect', () => {
  const p = { parts: [
    { hook: 'onRound', effect: 'regenSelf', value: { pct: 3 } },
    { hook: 'onRound', effect: 'stackAtk', value: { pct: 5, max: 4 } },
  ] }
  assert.equal(partAt(p, 'onRound').effect, 'regenSelf')
  assert.equal(partAt(p, 'onKill'), null)
  assert.equal(partWithEffect(p, 'stackAtk').value.max, 4)
  assert.equal(partWithEffect(p, 'dodge'), null)
})

test('passiveValueAt: รับ part ตรงๆ ได้ และไต่ขั้นตาม step', () => {
  const part = { hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }
  assert.equal(passiveValueAt(part, 1).pct, 12)
  assert.equal(passiveValueAt(part, 3).pct, 18)
})

test('passiveText: หลาย part ที่คีย์ไม่ชนกัน เติมได้ครบทุกช่อง', () => {
  const p = {
    parts: [
      { hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1 } },
      { hook: 'onKill', effect: 'stackAtk', value: { max: 3 }, step: { max: 0 } },
    ],
    desc: 'ฟื้น {pct}% ทุกรอบ · สะสมได้ {max} ชั้น',
  }
  assert.equal(passiveText(p, 1), 'ฟื้น 4% ทุกรอบ · สะสมได้ 3 ชั้น')
  assert.equal(passiveText(p, 3), 'ฟื้น 6% ทุกรอบ · สะสมได้ 3 ชั้น')
})

test('passiveText: คีย์ชนกันแยกด้วย tag — {tag.key}', () => {
  const p = {
    parts: [
      { hook: 'onHit', effect: 'guardian', tag: 'guard', value: { pct: 50 }, step: { pct: 8 } },
      { hook: 'onRound', effect: 'regenSelf', tag: 'regen', value: { pct: 3 }, step: { pct: 1 } },
    ],
    desc: 'รับแทน {guard.pct}% · ฟื้นเอง {regen.pct}%/รอบ',
  }
  assert.equal(passiveText(p, 1), 'รับแทน 50% · ฟื้นเอง 3%/รอบ')
  assert.equal(passiveText(p, 2), 'รับแทน 58% · ฟื้นเอง 4%/รอบ')
})

test('effectText: รับออปชัน effect ได้โดยผลยังเหมือนเดิมในรอบนี้ (P3 ค่อยใช้จริง)', () => {
  const p = {
    parts: [
      { hook: 'onHit', effect: 'guardian', tag: 'guard', value: { pct: 50 } },
      { hook: 'onRound', effect: 'regenSelf', tag: 'regen', value: { pct: 3 } },
    ],
    short: 'รับแทน {guard.pct}%',
  }
  // วันนี้ทุกตัวมี short เดียว ⇒ ส่ง effect เข้าไปต้องไม่ทำให้ข้อความเปลี่ยน (กันพฤติกรรมเปลี่ยนใน P1)
  assert.equal(effectText(p, 1, { effect: 'regenSelf' }), 'รับแทน 50%')
  assert.equal(effectText(p, 1), 'รับแทน 50%')
})

test('เพ็ททุกตัวในทะเบียนมีอย่างน้อย 1 part และทุก part มี hook+effect', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    const parts = partsOf(p)
    assert.ok(parts.length >= 1, `${id} ไม่มี part เลย`)
    for (const part of parts) {
      assert.ok(part.hook, `${id} มี part ที่ไม่มี hook`)
      assert.ok(part.effect, `${id} มี part ที่ไม่มี effect`)
    }
  }
})
