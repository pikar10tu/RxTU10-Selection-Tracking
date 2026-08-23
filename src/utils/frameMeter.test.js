// node --test src/utils/frameMeter.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createFrameMeter, median, FALLBACK_BASE, DROP_RATIO } from './frameMeter.js'

/** ป้อนเฟรมต่อเนื่องด้วยคาบ ms คงที่ */
function feed(m, deltas, start = 1000) {
  let now = start
  m.push(now)                       // เฟรมแรก = จุดตั้งต้น ไม่มี dt
  for (const d of deltas) { now += d; m.push(now) }
  return now
}

test('median: คี่/คู่/ว่าง', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([]), 0)
  assert.equal(median([7]), 7)
})

test('จอ 60Hz ที่ลื่นสนิท: ไม่มีเฟรมสะดุดเลย (นี่คือบั๊ก dt>16 เดิม)', () => {
  const m = createFrameMeter({ calFrames: 10 })
  feed(m, Array(200).fill(16.67))
  const s = m.stats()
  assert.equal(s.drop, 0, 'คาบ 16.67ms บนจอ 60Hz ต้องไม่นับว่าสะดุด')
  assert.equal(s.bad, 0)
  assert.ok(Math.abs(s.base - 16.67) < 0.01)
  assert.ok(Math.abs(s.dropAt - 16.67 * DROP_RATIO) < 0.01)
})

test('จอ 120Hz ที่ลื่นสนิท: baseline ปรับตามจอเอง ไม่นับสะดุด', () => {
  const m = createFrameMeter({ calFrames: 10 })
  feed(m, Array(200).fill(8.33))
  const s = m.stats()
  assert.equal(s.drop, 0)
  assert.ok(Math.abs(s.base - 8.33) < 0.01)
  // เฟรม 20ms บนจอ 120Hz = สะดุดชัด แม้จะยังไม่ถึงเกณฑ์ 33ms
  assert.ok(20 > s.dropAt)
})

test('นับเฉพาะเฟรมที่ช้ากว่า 1.5× ของคาบจอ', () => {
  const m = createFrameMeter({ calFrames: 10 })
  // จูนศูนย์ 10 เฟรมที่ 16 → dropAt = 24
  feed(m, [...Array(10).fill(16), 20, 25, 16, 30, 16])
  const s = m.stats()
  assert.equal(s.base, 16)
  assert.equal(s.dropAt, 24)
  assert.equal(s.drop, 2, '25 กับ 30 เกิน 24 · 20 ไม่เกิน')
})

test('เกณฑ์ 33ms เป็นค่าสัมบูรณ์ — นับตั้งแต่เฟรมแรก ไม่รอจูนศูนย์', () => {
  const m = createFrameMeter({ calFrames: 10 })
  feed(m, [50, 16, 40, ...Array(10).fill(16)])
  const s = m.stats()
  assert.equal(s.bad, 2, '50 กับ 40 เกิน 33 ทั้งที่ยังอยู่ในช่วงจูนศูนย์')
})

test('มัธยฐานทนเฟรมกระตุกตอน mount (ค่าเฉลี่ยจะเพี้ยน)', () => {
  const m = createFrameMeter({ calFrames: 11 })
  feed(m, [300, 200, ...Array(9).fill(16), ...Array(50).fill(16)])
  const s = m.stats()
  assert.equal(s.base, 16, 'สอง outlier ต้องไม่ดันคาบฐานขึ้น')
  assert.equal(s.drop, 0)
})

test('peak = เฟรมแย่สุดทั้งไฟต์ · worst = แย่สุดในหน้าต่าง 1 วิล่าสุด', () => {
  const m = createFrameMeter({ calFrames: 5, windowMs: 100 })
  feed(m, [16, 16, 16, 16, 16, 80, 16, 16, 16, 16, 16, 16, 16])
  const s = m.stats()
  assert.equal(s.peak, 80)
  assert.ok(s.worst > 0, 'หน้าต่างต้องปิดรอบอย่างน้อยหนึ่งครั้ง')
})

test('push คืน true เฉพาะตอนหน้าต่างปิดรอบ (ฝั่ง component เขียน ref วินาทีละครั้ง)', () => {
  const m = createFrameMeter({ calFrames: 5, windowMs: 100 })
  let now = 0, rolls = 0
  m.push(now)
  for (let i = 0; i < 60; i++) { now += 16; if (m.push(now)) rolls++ }
  assert.ok(rolls >= 8 && rolls <= 10, 'เฟรม 16ms × 60 ≈ 960ms → ปิดรอบ ~9 ครั้งที่หน้าต่าง 100ms')
})

test('ยังจูนศูนย์ไม่เสร็จ: dropAt ตกกลับค่าจอ 60Hz + calibrating=true', () => {
  const m = createFrameMeter({ calFrames: 30 })
  feed(m, Array(5).fill(16))
  const s = m.stats()
  assert.equal(s.base, 0)
  assert.equal(s.calibrating, true)
  assert.ok(Math.abs(s.dropAt - FALLBACK_BASE * DROP_RATIO) < 1e-9)
})
