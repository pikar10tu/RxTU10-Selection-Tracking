import test from 'node:test'
import assert from 'node:assert/strict'
import { makePhotoMini, MINI_MAX_CHARS, MINI_QUALITIES, MINI_SIZE } from './photo.js'

// encoder ปลอม: ยิ่งคุณภาพสูงยิ่งยาว — เลียนแบบพฤติกรรม JPEG พอให้เทสตรรกะไล่คุณภาพ
const fakeEncode = (lenAtFullQuality) => {
  const calls = []
  const fn = async (src, size, q) => {
    calls.push({ src, size, q })
    return 'x'.repeat(Math.round(lenAtFullQuality * q))
  }
  fn.calls = calls
  return fn
}

test('รูปเล็กอยู่แล้ว → ใช้คุณภาพสูงสุด เรียก encode ครั้งเดียว', async () => {
  const enc = fakeEncode(1000)
  const out = await makePhotoMini('data:image/jpeg;base64,AAA', enc)
  assert.equal(out.length, 600)
  assert.equal(enc.calls.length, 1)
  assert.equal(enc.calls[0].q, MINI_QUALITIES[0])
  assert.equal(enc.calls[0].size, MINI_SIZE)
})

test('รูปหนัก → ไล่ลดคุณภาพจนลอดเพดาน', async () => {
  const enc = fakeEncode(6000)          // q .6 → 3600 เกิน · q .45 → 2700 ผ่าน
  const out = await makePhotoMini('data:image/jpeg;base64,AAA', enc)
  assert.ok(out.length <= MINI_MAX_CHARS)
  assert.equal(enc.calls.length, 2)
})

test('หนักเกินทุกระดับ → null (ยอมไม่มีรูปจิ๋ว ดีกว่าทำ roster บวม)', async () => {
  const enc = fakeEncode(100000)
  assert.equal(await makePhotoMini('data:image/jpeg;base64,AAA', enc), null)
  assert.equal(enc.calls.length, MINI_QUALITIES.length)
})

test('ไม่มีรูปเข้ามา → null และไม่เรียก encode เลย', async () => {
  const enc = fakeEncode(10)
  assert.equal(await makePhotoMini(null, enc), null)
  assert.equal(await makePhotoMini('', enc), null)
  assert.equal(enc.calls.length, 0)
})

test('encode คืน null (โหลดรูปไม่ได้) → ไม่พัง คืน null', async () => {
  assert.equal(await makePhotoMini('data:bad', async () => null), null)
})
