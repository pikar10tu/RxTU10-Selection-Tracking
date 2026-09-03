// เทสตัวช่วยอ่านรูปข้อมูลพาสสีฟ — pure · รัน: node --test src/data/petPassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PET_PASSIVES, PASSIVE_MAX_LEVEL, STATUS_TEXT, partsOf, partsAt, partAt, partWithEffect,
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

// ── กติกาการเขียนคำอธิบาย (user สั่ง 3 ก.ย. 2026) ────────────────────────
//  "อธิบายตรงๆ พร้อมแจ้งตัวเลขเลย · ไม่เอาคำไม่ทางการ"
//  เทส 3 ตัวข้างล่างคือกติกานั้นในรูปที่ทำงานเอง — เพ็ทใหม่ของ P2/P3 จะถูกจับด้วยกฎเดียวกัน

test('คำอธิบายทุกตัวต้องเติมค่าครบทุกช่อง ไม่มี {…} หลุดไปถึงจอ', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (let lv = 1; lv <= PASSIVE_MAX_LEVEL; lv++) {
      for (const [label, txt] of [
        ['desc', passiveText(p, lv)],
        ['short', effectText(p, lv)],
        ['shortOn', p.shortOn ? effectText(p, lv, { onTarget: true }) : ''],
      ]) {
        assert.ok(!/\{[\w.]+\}/.test(txt), `${id} ขั้น ${lv} ${label} เหลือช่องไม่ถูกเติม: ${txt}`)
      }
    }
  }
})

test('desc ต้องแจ้งตัวเลขทุกตัวที่ข้อมูลมี (ค่าที่ไม่ถูกพูดถึง = ผู้เล่นไม่มีทางรู้)', () => {
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    const said = new Set([...String(p.desc || '').matchAll(/\{([\w.]+)\}/g)].map(m => m[1].split('.').pop()))
    for (const part of partsOf(p)) {
      for (const [k, v] of Object.entries(part.value || {})) {
        if (typeof v !== 'number') continue      // duoWith/element เป็นชื่อ ไม่ใช่ค่าที่ต้องบอก
        assert.ok(said.has(k), `${id} desc ไม่ได้บอกค่า ${k} (=${v}) → "${p.desc}"`)
      }
    }
  }
})

test('ห้ามใช้คำย่อ/คำไม่ทางการในข้อความที่ผู้เล่นเห็น', () => {
  // 'คริ' ที่ไม่ได้ตามด้วย 'ติคอล' = คำย่อ · 'เทิร์น' ทั้งเกมใช้คำว่า 'รอบ'
  const BANNED = [/คริ(?!ติคอล)/, /เทิร์น/]
  const seen = []
  for (const [id, p] of Object.entries(PET_PASSIVES)) {
    for (const [label, txt] of [['name', p.name], ['desc', p.desc], ['short', p.short], ['shortOn', p.shortOn]]) {
      if (txt) seen.push([`${id}.${label}`, txt])
    }
  }
  for (const [k, v] of Object.entries(STATUS_TEXT)) seen.push([`STATUS_TEXT.${k}`, v])
  for (const [where, txt] of seen) {
    for (const re of BANNED) assert.ok(!re.test(txt), `${where} ใช้คำไม่ทางการ: "${txt}"`)
  }
})
