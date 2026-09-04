// เทสตัวช่วยอ่านรูปข้อมูลพาสสีฟ — pure · รัน: node --test src/data/petPassives.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PET_PASSIVES, PASSIVE_MAX_LEVEL, STATUS_ICON, STATUS_TEXT,
  TEAM_AURA_EFFECTS, SELF_STATUS_EFFECTS, FOE_AURA_EFFECTS, FOE_STATUS_EFFECTS,
  partsOf, partsAt, partAt, partWithEffect, passiveValueAt, passiveText, effectText,
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

test('effect ใหม่ของ P2 ต้องมีไอคอน คำอธิบายป้าย และอยู่ในกลุ่มป้ายที่ถูกต้องครบ (มินิชิปใน P2c อ่านจากตรงนี้)', () => {
  for (const k of ['elementTrinity', 'teamLifesteal', 'teamDamageReduction', 'atkOnHit',
                   'berserk', 'giantSlayer', 'healOnAttack', 'stealStats']) {
    assert.ok(STATUS_ICON[k], `${k} ไม่มีไอคอน`)
    assert.ok(STATUS_TEXT[k], `${k} ไม่มีคำอธิบายป้าย`)
    const inTeam = TEAM_AURA_EFFECTS.has(k)
    const inSelf = SELF_STATUS_EFFECTS.has(k)
    // buffSources() หาป้ายจากสองกลุ่มนี้เท่านั้น — ไม่อยู่กลุ่มไหนเลย = ป้ายไม่มีวันขึ้นจอ
    assert.ok(inTeam || inSelf, `${k} ไม่อยู่ในกลุ่มป้ายไหนเลย (buffSources จะไม่มีวันเจอ)`)
    // อยู่สองกลุ่มพร้อมกัน = อาจขึ้นป้ายซ้ำสอง จึงต้องเลือกกลุ่มเดียว
    assert.ok(!(inTeam && inSelf), `${k} อยู่ทั้งสองกลุ่มพร้อมกัน (ต้องเลือกกลุ่มเดียว)`)
  }
})

// ── P2b: infect/taunt/armorStack (สเปก 2026-09-04-passive-v2-p2b-hard-three) ──────────
//  taunt/armorStack เป็นสถานะติดตัวเจ้าของสกิลเอง ⇒ SELF_STATUS_EFFECTS เหมือนกลุ่มเดิม
//  infect ต่างจากทุกตัวก่อนหน้า: เป็นดีบัฟที่ "ลงบนศัตรูที่ถูกตี" ทีละตัว ไม่ใช่ aura คงที่ทั้งทีมตั้งแต่ต้นไฟต์
//  (FOE_AURA_EFFECTS ใช้ไม่ได้ — aurasOf() หาแค่ part hook 'aura' แต่ infect มาจาก hook 'onAttack' ที่สะสม
//   ชั้นระหว่างไฟต์ลง state ของเป้าโดยตรง) จึงต้องมีกลุ่มใหม่ FOE_STATUS_EFFECTS ให้ P2c อ่านต่อ
test('P2b: infect/taunt/armorStack ต้องมีไอคอน คำอธิบายป้าย และอยู่ในกลุ่มป้ายที่ถูกต้องครบ', () => {
  const ALL_GROUPS = [TEAM_AURA_EFFECTS, SELF_STATUS_EFFECTS, FOE_AURA_EFFECTS, FOE_STATUS_EFFECTS]
  for (const k of ['infect', 'taunt', 'armorStack']) {
    assert.ok(STATUS_ICON[k], `${k} ไม่มีไอคอน`)
    assert.ok(STATUS_TEXT[k], `${k} ไม่มีคำอธิบายป้าย`)
    const memberships = ALL_GROUPS.filter(g => g.has(k)).length
    assert.equal(memberships, 1, `${k} ต้องอยู่ในกลุ่มป้ายพอดี 1 กลุ่ม (เจอ ${memberships})`)
  }
  // ⚠️ infect ต้องลงกลุ่มดีบัฟที่ลงบนเป้าเจาะจง ไม่ใช่กลุ่ม aura คงที่ (ดูเหตุผลด้านบนหัวเทส)
  assert.ok(FOE_STATUS_EFFECTS.has('infect'), 'infect ต้องอยู่ใน FOE_STATUS_EFFECTS ไม่ใช่ FOE_AURA_EFFECTS')
  assert.ok(!FOE_AURA_EFFECTS.has('infect'), 'infect ไม่ใช่ aura คงที่ — aurasOf() จะไม่มีวันเจอ')
  assert.ok(SELF_STATUS_EFFECTS.has('taunt'), 'taunt เป็นสถานะติดตัวเจ้าของสกิลเอง')
  assert.ok(SELF_STATUS_EFFECTS.has('armorStack'), 'armorStack เป็นสถานะติดตัวเจ้าของสกิลเอง')
})

// infectBurst คือ event ระเบิดครั้งเดียว (fxKind: 'damage') ไม่ใช่สถานะติดตัวที่ค้างอยู่บนการ์ด
// ไอคอนตอนระเบิดมาจาก p.icon ของพาสสีฟไวรัสเอง (ev() ใน battlePassives.js) ไม่ผ่านทะเบียนป้ายนี้เลย
// จึง "ตั้งใจ" ไม่มีป้ายของตัวเอง — เทสนี้พูดสิ่งนั้นออกมาตรงๆ กันมีคนเห็นว่าขาดแล้วเผลอเติมทีหลัง
test('P2b: infectBurst ตั้งใจไม่มีป้ายของตัวเอง (เป็น FX ระเบิดครั้งเดียว ใช้ p.icon ไม่ใช่ STATUS_ICON)', () => {
  assert.equal(STATUS_ICON.infectBurst, undefined)
  assert.equal(STATUS_TEXT.infectBurst, undefined)
})

// ── กันไอคอนซ้ำ: ป้ายสองอันหน้าตาเดียวกันบนการ์ดเดียว = ผู้เล่นอ่านไม่ออกว่าได้อะไรมาสองอย่าง ──
// อนุญาตให้ซ้ำได้เฉพาะกลุ่มที่ตั้งใจให้ "ความหมายเดียวกัน" ใช้ไอคอนเดียวกันจริงๆ (คอมเมนต์อธิบายทีละกลุ่ม)
// การชนกันแบบอื่นที่ไม่อยู่ในลิสต์นี้ถือว่าไม่ตั้งใจ — เทสต้องแดง
const ALLOWED_ICON_DUPES = [
  // ฟื้น/กันตาย 1 ครั้งทั้งสามแบบ — ความหมายเดียวกันจากมุมผู้เล่น ("มีของกันตายอยู่")
  ['revive', 'saveAlly', 'cheatDeath'],
  // บัฟพลังโจมตีทีมทั้งสองแบบ (คงที่ / ต่อจำนวนเพื่อนสายจู่โจม) — ผลที่เห็นบนจอเหมือนกัน
  ['teamAtk', 'teamAtkPerElement'],
  // ลดดาเมจที่ได้รับทั้งสองแบบ (เฉพาะตัว / ทั้งทีม) — ความหมายเดียวกัน ต่างแค่ขอบเขต
  ['damageReduction', 'teamDamageReduction'],
]

test('ไอคอนป้ายต้องไม่ซ้ำกัน (ป้ายสองอันหน้าตาเดียวกันบนการ์ดเดียว = อ่านไม่ออก)', () => {
  const allowedPairKey = new Set()
  for (const group of ALLOWED_ICON_DUPES) {
    for (const a of group) for (const b of group) if (a !== b) allowedPairKey.add(`${a}|${b}`)
  }
  const seen = new Map()
  for (const [k, icon] of Object.entries(STATUS_ICON)) {
    if (seen.has(icon)) {
      const other = seen.get(icon)
      if (!allowedPairKey.has(`${k}|${other}`)) {
        assert.fail(`${k} ใช้ไอคอน ${icon} ซ้ำกับ ${other} โดยไม่ได้อยู่ในลิสต์ยกเว้น (ALLOWED_ICON_DUPES)`)
      }
      continue
    }
    seen.set(icon, k)
  }
  // ทุกกลุ่มยกเว้นต้องซ้ำกันจริงในทะเบียน ไม่งั้นลิสต์ยกเว้นค้างของที่ไม่มีจริงแล้วไม่มีใครรู้
  for (const group of ALLOWED_ICON_DUPES) {
    const icons = new Set(group.map(k => STATUS_ICON[k]))
    assert.equal(icons.size, 1, `กลุ่ม [${group.join(', ')}] ควรใช้ไอคอนเดียวกันจริง แต่ไม่ใช่ (${[...icons]})`)
  }
})
