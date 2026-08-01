import test from 'node:test'
import assert from 'node:assert/strict'
import { cockcroftGault, makeProblem, isClose, TOLERANCE_MIN, PLAUSIBLE_MIN, PLAUSIBLE_MAX } from './crcl.js'

test('Cockcroft-Gault ผู้ชาย: (140-40)×70 / (72×1.0) = 97.22', () => {
  const v = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  assert.ok(Math.abs(v - 97.222) < 0.01, `ได้ ${v}`)
})

test('ผู้หญิงคูณ 0.85', () => {
  const m = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  const f = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: true })
  assert.ok(Math.abs(f - m * 0.85) < 1e-9)
})

test('Scr สูงขึ้น → CrCl ต่ำลง · อายุมากขึ้น → CrCl ต่ำลง', () => {
  const base = cockcroftGault({ age: 40, weightKg: 70, scr: 1.0, female: false })
  assert.ok(cockcroftGault({ age: 40, weightKg: 70, scr: 2.0, female: false }) < base)
  assert.ok(cockcroftGault({ age: 80, weightKg: 70, scr: 1.0, female: false }) < base)
})

test('isClose: ตอบตรงเป๊ะ = ถูก', () => {
  assert.equal(isClose(97.2, 97.222), true)
})

test('isClose: ในช่วง 2% = ถูก · นอกช่วง = ผิด', () => {
  assert.equal(isClose(100, 100), true)
  assert.equal(isClose(101.9, 100), true)    // +1.9% → ยอมรับ
  assert.equal(isClose(98.1, 100), true)     // −1.9% → ยอมรับ
  assert.equal(isClose(103, 100), false)     // +3% → ไม่ยอมรับ
  assert.equal(isClose(96, 100), false)
})

test(`isClose: CrCl ต่ำมากใช้ floor ${TOLERANCE_MIN} mL/min แทน 2%`, () => {
  // เฉลย 10 → 2% = 0.2 ซึ่งแคบเกินไป · floor 1 ต้องยอมรับ ±1
  assert.equal(isClose(10.9, 10), true)
  assert.equal(isClose(9.1, 10), true)
  assert.equal(isClose(11.5, 10), false)
})

test('isClose: คำตอบที่ไม่ใช่ตัวเลข = ผิด (ไม่ throw)', () => {
  assert.equal(isClose(NaN, 100), false)
  assert.equal(isClose(undefined, 100), false)
  assert.equal(isClose(Infinity, 100), false)
})

test('makeProblem: rng ต่ำสุด → ขอบล่างของทุกค่า', () => {
  const p = makeProblem(() => 0)
  assert.deepEqual(p, { age: 18, weightKg: 40, scr: 0.5, female: true })
})

test('makeProblem: rng สูงสุด → ขอบบนของทุกค่า', () => {
  const p = makeProblem(() => 0.999)
  assert.equal(p.age, 90)
  assert.equal(p.weightKg, 110)
  assert.equal(p.scr, 4)
  assert.equal(p.female, false)
})

test('makeProblem: Scr มีทศนิยมไม่เกิน 1 ตำแหน่งเสมอ', () => {
  for (let i = 0; i < 50; i++) {
    const { scr } = makeProblem()
    assert.equal(Math.round(scr * 10) / 10, scr, `scr ${scr} มีทศนิยมเกิน 1 ตำแหน่ง`)
  }
})

test(`makeProblem: CrCl ที่ได้ต้องอยู่ในช่วง [${PLAUSIBLE_MIN}, ${PLAUSIBLE_MAX}] เสมอ (คนไข้ต้องสมจริง)`, () => {
  for (let i = 0; i < 200; i++) {
    const p = makeProblem()
    const v = cockcroftGault(p)
    assert.ok(
      v >= PLAUSIBLE_MIN && v <= PLAUSIBLE_MAX,
      `CrCl ${v} หลุดช่วง จาก problem ${JSON.stringify(p)}`,
    )
  }
})
