import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarUrl, letterAvatar } from './avatar.js'

test('customPhoto ชนะทุกอย่าง (จอที่อ่าน user doc เต็ม)', () => {
  assert.equal(
    avatarUrl({ customPhoto: 'FULL', photoMini: 'MINI', googlePhoto: 'G' }, 'นัท'),
    'FULL',
  )
})

test('ไม่มีตัวเต็ม → ใช้ตัวจิ๋ว (จอที่อ่าน roster) ไม่ตกไป googlePhoto', () => {
  assert.equal(avatarUrl({ photoMini: 'MINI', googlePhoto: 'G' }, 'นัท'), 'MINI')
})

test('อัปรูปเองไม่เคยทำ → googlePhoto', () => {
  assert.equal(avatarUrl({ googlePhoto: 'G' }, 'นัท'), 'G')
})

test('ไม่มีรูปเลย → ตัวอักษรย่อตามชื่อ', () => {
  assert.equal(avatarUrl({}, 'นัท'), letterAvatar('นัท'))
  assert.equal(avatarUrl(null, 'นัท'), letterAvatar('นัท'))
})

test('ไม่ส่งชื่อมา → ใช้ nickname บน object', () => {
  assert.equal(avatarUrl({ nickname: 'ปิ๊ก' }), letterAvatar('ปิ๊ก'))
})

test('size ส่งต่อไปถึงตัวอักษรย่อ (หอคอยใช้ 52)', () => {
  assert.equal(avatarUrl({}, 'นัท', 52), letterAvatar('นัท', 52))
})
