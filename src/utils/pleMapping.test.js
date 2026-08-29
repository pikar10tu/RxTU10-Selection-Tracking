// เทส pleMapping — สะพานหมวดเก่า (free text) → หมวดใหม่ (pleGroup/pleSub)
// รัน: node --test src/utils/pleMapping.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_GROUP_MAP, LEGACY_SUB_MAP, inferGroup, inferSub, categoriesFor,
  pleFields, plePatch, migrationPlan, coverageByGroup,
} from './pleMapping.js'
import { PLE_GROUPS, isPleGroupKey, groupLabel, subsOf, isValidSub } from '../data/plecc.js'

// ── ความสมบูรณ์ของตารางแมพ ──
test('ทุก key ในตารางแมพกลุ่ม ต้องมีอยู่จริงใน plecc.js', () => {
  for (const [name, key] of Object.entries(LEGACY_GROUP_MAP)) {
    assert.ok(isPleGroupKey(key), `${name} → ${key} ไม่มีในทะเบียนกลุ่ม`)
  }
})
test('ทุกโรคย่อยในตารางแมพ ต้องอยู่ในกลุ่มที่ชื่อนั้นถูกแมพไป', () => {
  for (const [name, sub] of Object.entries(LEGACY_SUB_MAP)) {
    const key = LEGACY_GROUP_MAP[name]
    assert.ok(key, `${name} มีโรคย่อยแต่ไม่มีกลุ่ม`)
    assert.ok(isValidSub(key, sub), `${name} → ${sub} ไม่อยู่ในกลุ่ม ${key}`)
  }
})
test('ไม่มีโรคย่อยซ้ำชื่อกันข้ามกลุ่ม (กันเดาผิดกลุ่ม)', () => {
  const seen = new Map()
  for (const g of PLE_GROUPS) {
    for (const s of g.subs) {
      assert.ok(!seen.has(s), `โรคย่อย "${s}" ซ้ำใน ${seen.get(s)} กับ ${g.key}`)
      seen.set(s, g.key)
    }
  }
})

// ── inferGroup / inferSub ──
test('แมพชื่อหมวดเดิมได้ตรงกลุ่ม', () => {
  assert.equal(inferGroup(['เบาหวาน (Diabetes mellitus)']), 'endo')
  assert.equal(inferGroup(['โรคติดเชื้อ']), 'id')
  assert.equal(inferGroup(['กฎหมายยาและการโฆษณา']), 'other')
  assert.equal(inferGroup(['Titration']), 'sci_analysis')
})
test('ชื่อที่ไม่รู้จัก → null (ไม่เดามั่ว)', () => {
  assert.equal(inferGroup(['หมวดที่ไม่เคยมี']), null)
  assert.equal(inferGroup([]), null)
  assert.equal(inferGroup(null), null)
})
test('มีหลายหมวด → เอาตัวแรกที่รู้จัก', () => {
  assert.equal(inferGroup(['ไม่รู้จัก', 'โรคไต']), 'renal')
})
test('ช่องว่างหัวท้ายไม่ทำให้แมพพลาด', () => {
  assert.equal(inferGroup(['  โรคไต  ']), 'renal')
})
test('หมวดที่สะกดผิดในทะเบียนจริง (ภูมิคุัมกัน) ยังแมพได้', () => {
  assert.equal(inferGroup(['โรคระบบภูมิคุัมกัน']), 'immu')
  assert.equal(inferGroup(['โรคระบบภูมิคุ้มกัน']), 'immu')
})
test('inferSub ต้องอยู่ในกลุ่มที่ส่งมา ไม่งั้นทิ้ง', () => {
  assert.equal(inferSub(['โรคหืด'], 'pulm'), 'Asthma')
  assert.equal(inferSub(['โรคหืด'], 'endo'), null)   // ข้ามกลุ่ม → ไม่เอา
})
test('หมวดกว้างๆ ไม่เดาโรคย่อยให้', () => {
  assert.equal(inferSub(['โรคติดเชื้อ'], 'id'), null)
  assert.equal(inferSub(['โรคผิวหนัง'], 'derm'), null)
})

// ── categoriesFor ──
test('categoriesFor คืน [ป้ายกลุ่ม, โรคย่อย]', () => {
  assert.deepEqual(categoriesFor('endo', 'Obesity'), ['Endocrine (ต่อมไร้ท่อ)', 'Obesity'])
})
test('categoriesFor ไม่มีโรคย่อย → เหลือป้ายกลุ่มอย่างเดียว', () => {
  assert.deepEqual(categoriesFor('endo', null), ['Endocrine (ต่อมไร้ท่อ)'])
})
test('categoriesFor ทิ้งโรคย่อยที่ไม่ได้อยู่ในกลุ่ม', () => {
  assert.deepEqual(categoriesFor('endo', 'Asthma'), ['Endocrine (ต่อมไร้ท่อ)'])
})
test('categoriesFor กลุ่มมั่ว → array ว่าง', () => {
  assert.deepEqual(categoriesFor('ไม่มีกลุ่มนี้', null), [])
})
test('กลุ่มไทยล้วนใช้ชื่อไทย ไม่มีวงเล็บซ้อน', () => {
  assert.deepEqual(categoriesFor('other', 'กฎหมาย (Law)'), ['ระบบอื่น', 'กฎหมาย (Law)'])
  assert.deepEqual(categoriesFor('sci_chem', null), ['เภสัชเคมี'])
})

// ── pleFields ──
test('ข้อที่ migrate แล้ว อ่านจาก pleGroup ตรงๆ (inferred=false)', () => {
  const f = pleFields({ pleGroup: 'renal', pleSub: 'Chronic kidney diseases (CKD)', categories: ['อะไรก็ได้'] })
  assert.deepEqual(f, { group: 'renal', sub: 'Chronic kidney diseases (CKD)', inferred: false })
})
test('pleSub ที่ไม่อยู่ในกลุ่ม (กลุ่มถูกสลับแล้วลืมล้าง) → ทิ้ง sub', () => {
  const f = pleFields({ pleGroup: 'renal', pleSub: 'Asthma' })
  assert.deepEqual(f, { group: 'renal', sub: null, inferred: false })
})
test('ข้อที่ยังไม่ migrate → เดาจาก categories (inferred=true)', () => {
  const f = pleFields({ categories: ['โรคหืด'] })
  assert.deepEqual(f, { group: 'pulm', sub: 'Asthma', inferred: true })
})
test('ข้อเก่าที่มีแค่ category เดี่ยว ก็เดาได้', () => {
  assert.equal(pleFields({ category: 'โรคไต' }).group, 'renal')
})
test('เดาไม่ได้ → group null และ inferred=false (ไม่มีอะไรให้ยืนยัน)', () => {
  assert.deepEqual(pleFields({ categories: ['ไม่รู้จัก'] }), { group: null, sub: null, inferred: false })
  assert.deepEqual(pleFields({}), { group: null, sub: null, inferred: false })
  assert.deepEqual(pleFields(null), { group: null, sub: null, inferred: false })
})
test('pleGroup ที่เป็นค่าขยะ → ตกไปใช้ทางเดาแทน ไม่เชื่อค่าบน doc', () => {
  assert.equal(pleFields({ pleGroup: 'ขยะ', categories: ['โรคไต'] }).group, 'renal')
})

// ── plePatch ──
test('plePatch เขียนครบ 3 ฟิลด์เสมอ', () => {
  assert.deepEqual(plePatch('pulm', 'Asthma'),
    { pleGroup: 'pulm', pleSub: 'Asthma', categories: ['Pulmonary (ปอด)', 'Asthma'] })
})
test('plePatch ล้าง sub ที่ข้ามกลุ่มให้เป็น null', () => {
  assert.deepEqual(plePatch('pulm', 'Obesity'),
    { pleGroup: 'pulm', pleSub: null, categories: ['Pulmonary (ปอด)'] })
})
test('plePatch กลุ่มมั่ว → null (ผู้เรียกต้องไม่เขียนอะไรเลย)', () => {
  assert.equal(plePatch('ไม่มี', null), null)
})

// ── migrationPlan ──
test('migrationPlan คืนเฉพาะข้อที่ค่าเปลี่ยนจริง', () => {
  const bank = [
    { id: 'a', categories: ['โรคหืด'] },                                        // ต้องแมพ
    { id: 'b', pleGroup: 'pulm', pleSub: 'Asthma', categories: ['Pulmonary (ปอด)', 'Asthma'] }, // ตรงแล้ว
    { id: 'c', categories: ['หมวดประหลาด'] },                                    // แมพไม่ได้
  ]
  const p = migrationPlan(bank)
  assert.deepEqual(p.updates.map(u => u.id), ['a'])
  assert.deepEqual(p.unmapped.map(q => q.id), ['c'])
  assert.equal(p.total, 3)
})
test('migrationPlan ซ่อม categories ที่ถูก client เก่าเขียนทับ (pleGroup ยังถูก)', () => {
  const bank = [{ id: 'x', pleGroup: 'pulm', pleSub: 'Asthma', categories: ['โรคหืด'] }]
  const p = migrationPlan(bank)
  assert.equal(p.updates.length, 1)
  assert.deepEqual(p.updates[0].patch.categories, ['Pulmonary (ปอด)', 'Asthma'])
})
test('migrationPlan คลังว่าง → ไม่มีอะไรต้องทำ', () => {
  assert.deepEqual(migrationPlan([]), { updates: [], unmapped: [], total: 0 })
})

// ── coverageByGroup ──
test('นับข้อรายกลุ่ม แยก published', () => {
  const bank = [
    { pleGroup: 'renal', isPublished: true },
    { pleGroup: 'renal', isPublished: false },
    { categories: ['โรคหืด'], isPublished: true },
    { categories: ['ไม่รู้จัก'], isPublished: true },
  ]
  const c = coverageByGroup(bank)
  assert.deepEqual(c.renal, { total: 2, published: 1 })
  assert.deepEqual(c.pulm, { total: 1, published: 1 })
  assert.deepEqual(c.__none, { total: 1, published: 1 })
})

// ── ป้ายกลุ่มต้องไม่ชนกัน (categories ใช้ป้ายเป็นค่า → ชนกันแล้วฟิลเตอร์เพี้ยน) ──
test('ป้ายกลุ่มไม่ซ้ำกัน', () => {
  const labels = PLE_GROUPS.map(g => groupLabel(g.key))
  assert.equal(labels.length, new Set(labels).size)
  for (const l of labels) assert.ok(l && l.trim(), 'มีกลุ่มที่ไม่มีป้าย')
})
test('ทุกกลุ่มมีโรคย่อยอย่างน้อย 1 ตัว', () => {
  for (const g of PLE_GROUPS) assert.ok(subsOf(g.key).length > 0, `${g.key} ไม่มีโรคย่อย`)
})
