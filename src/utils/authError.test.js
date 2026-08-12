import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPopupClosedCode, shouldWarnPopupClosed, POPUP_ABORT_MS } from './authError.js'

// ── isPopupClosedCode ──
test('code ที่แปลว่า popup ปิดโดยไม่ได้ล็อกอิน', () => {
  assert.equal(isPopupClosedCode('auth/popup-closed-by-user'), true)
  assert.equal(isPopupClosedCode('auth/cancelled-popup-request'), true)
})

test('code อื่นไม่นับ (ต้องไหลไปทาง error ปกติ)', () => {
  assert.equal(isPopupClosedCode('auth/popup-blocked'), false)
  assert.equal(isPopupClosedCode('auth/network-request-failed'), false)
  assert.equal(isPopupClosedCode(undefined), false)
})

// ── shouldWarnPopupClosed ──
test('popup ตายเร็วกว่าเกณฑ์ → เตือน (ระบบพัง ไม่ใช่คนกดปิด)', () => {
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', 200), true)
  assert.equal(shouldWarnPopupClosed('auth/cancelled-popup-request', 0), true)
})

test('ผู้ใช้กดปิดเอง (ช้ากว่าเกณฑ์) → เงียบ', () => {
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', 4000), false)
})

test('ที่เกณฑ์พอดีถือว่าคนกดปิด — ไม่เตือน', () => {
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', POPUP_ABORT_MS), false)
})

test('code อื่นไม่เตือนผ่านทางนี้ แม้จะเร็ว (มีทาง error ปกติอยู่แล้ว)', () => {
  assert.equal(shouldWarnPopupClosed('auth/popup-blocked', 10), false)
})

test('เวลาเพี้ยน/ไม่รู้ → เงียบไว้ก่อน (กันเตือนหลอก)', () => {
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', NaN), false)
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', undefined), false)
  assert.equal(shouldWarnPopupClosed('auth/popup-closed-by-user', Infinity), false)
})
