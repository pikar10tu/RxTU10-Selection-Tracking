import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CROPS, getCrop, DEFAULT_STAGES, STAGE_CUTS, stageEmoji } from './crops.js'

const tomato = getCrop('tomato')     // ไม่มี stages → ใช้ค่าเริ่มต้น

test('ระยะ 1 = ต้นอ่อน เมื่อ progress ต่ำกว่าจุดตัดแรก', () => {
  assert.equal(stageEmoji(tomato, 0), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, 0.32), DEFAULT_STAGES[0])
})

test('ระยะ 2 = ต้นโต ตั้งแต่จุดตัดแรกถึงก่อนจุดตัดสอง (ขอบเขตนับเข้าระยะถัดไป)', () => {
  assert.equal(stageEmoji(tomato, STAGE_CUTS[0]), DEFAULT_STAGES[1])
  assert.equal(stageEmoji(tomato, 0.69), DEFAULT_STAGES[1])
})

test('ตั้งแต่จุดตัดสองขึ้นไป = อีโมจิพืชจริง (รวมค่าที่เกิน 1)', () => {
  assert.equal(stageEmoji(tomato, STAGE_CUTS[1]), tomato.emoji)
  assert.equal(stageEmoji(tomato, 1), tomato.emoji)
  assert.equal(stageEmoji(tomato, 5), tomato.emoji)
})

test('อินพุตพัง → ไม่ throw และตกที่ระยะ 1', () => {
  assert.equal(stageEmoji(tomato, -1), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, NaN), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, undefined), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, 'abc'), DEFAULT_STAGES[0])
})

test('crop ว่าง → คืนสตริงว่าง ไม่ throw', () => {
  assert.equal(stageEmoji(null, 0.5), '')
  assert.equal(stageEmoji(undefined, 0.5), '')
})

test('พืชที่มี stages ของตัวเอง ใช้ค่านั้นแทนค่าเริ่มต้น', () => {
  const tree = getCrop('moneytree')
  assert.deepEqual(tree.stages, ['🌱', '🌲'])
  assert.equal(stageEmoji(tree, 0.5), '🌲')
  assert.equal(stageEmoji(tree, 1), tree.emoji)

  const lotus = getCrop('lotus')
  assert.deepEqual(lotus.stages, ['🌱', '🍃'])
  assert.equal(stageEmoji(lotus, 0.5), '🍃')
})

test('stages ที่ไม่ครบ 2 ระยะ → fallback ค่าเริ่มต้น (ไม่พัง)', () => {
  const broken = { emoji: '🍅', stages: ['🌱'] }
  assert.equal(stageEmoji(broken, 0.1), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(broken, 0.5), DEFAULT_STAGES[1])
  assert.equal(stageEmoji({ emoji: '🍅', stages: [] }, 0.5), DEFAULT_STAGES[1])
  assert.equal(stageEmoji({ emoji: '🍅', stages: 'ไม่ใช่ array' }, 0.5), DEFAULT_STAGES[1])
})

test('ทุกพืชในคลังคืนอีโมจิเสมอ ไม่มีตัวไหนได้ค่าว่าง', () => {
  for (const c of CROPS) {
    for (const p of [0, 0.4, 0.8, 1]) {
      assert.ok(stageEmoji(c, p).length > 0, `${c.id} ที่ progress ${p} ต้องมีอีโมจิ`)
    }
  }
})
