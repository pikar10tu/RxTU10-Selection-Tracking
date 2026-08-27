import test from 'node:test'
import assert from 'node:assert/strict'
import { shuffle, shuffleChoices } from './quizShuffle.js'

test('shuffle ไม่แตะ array เดิม และคงสมาชิกครบ', () => {
  const src = [1, 2, 3, 4, 5]
  const out = shuffle(src)
  assert.deepEqual(src, [1, 2, 3, 4, 5], 'ต้นฉบับต้องไม่ถูกแก้')
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5])
})

test('shuffleChoices สลับตัวเลือกแล้ว answer ยังชี้ข้อความเดิม', () => {
  const q = { id: 'q1', question: 'อะไร', choices: ['ก', 'ข', 'ค', 'ง'], answer: 2 }
  for (let i = 0; i < 50; i++) {
    const s = shuffleChoices(q)
    assert.equal(s.choices[s.answer], 'ค', 'เฉลยต้องยังเป็นข้อความเดิมเสมอ')
    assert.equal(s.choices.length, 4)
    assert.deepEqual([...s.choices].sort(), ['ก', 'ข', 'ค', 'ง'])
    assert.equal(s.id, 'q1', 'ฟิลด์อื่นต้องติดไปด้วย')
    assert.deepEqual(q.choices, ['ก', 'ข', 'ค', 'ง'], 'ต้นฉบับต้องไม่ถูกแก้')
  }
})
