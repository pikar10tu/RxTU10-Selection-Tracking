// เทส pvpBoard — pure: seed กระดาน + cooldown ปุ่มรีเฟรช
// รัน: node --test src/utils/pvpBoard.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boardSeed, refreshLeftMs, canRefresh, PVP_REFRESH_COOLDOWN_MS } from './pvpBoard.js'

test('boardSeed: input เดิม = seed เดิม (โหลดหน้าใหม่ไม่รีโรล)', () => {
  assert.equal(boardSeed('2026-08-27', 'me', 3), boardSeed('2026-08-27', 'me', 3))
})

test('boardSeed: nonce ขยับ = seed เปลี่ยน', () => {
  assert.notEqual(boardSeed('2026-08-27', 'me', 3), boardSeed('2026-08-27', 'me', 4))
})

test('boardSeed: ข้ามวัน = seed เปลี่ยน · คนละคน = seed เปลี่ยน', () => {
  assert.notEqual(boardSeed('2026-08-27', 'me', 0), boardSeed('2026-08-28', 'me', 0))
  assert.notEqual(boardSeed('2026-08-27', 'me', 0), boardSeed('2026-08-27', 'you', 0))
})

test('boardSeed: uid/nonce หายไป ไม่พัง', () => {
  assert.ok(Number.isInteger(boardSeed('2026-08-27', null, undefined)))
})

test('refreshLeftMs: เพิ่งกด = เหลือเต็ม cooldown', () => {
  assert.equal(refreshLeftMs(1000, 1000), PVP_REFRESH_COOLDOWN_MS)
})

test('refreshLeftMs: ครบพอดี = 0 (ขอบเวลาต้องกดได้)', () => {
  assert.equal(refreshLeftMs(1000, 1000 + PVP_REFRESH_COOLDOWN_MS), 0)
})

test('refreshLeftMs: ยังไม่เคยกด (lastAt ว่าง) = 0', () => {
  assert.equal(refreshLeftMs(0, 5000), 0)
  assert.equal(refreshLeftMs(undefined, 5000), 0)
})

test('refreshLeftMs: นาฬิกาเครื่องเดินถอยหลัง ต้องไม่ล็อกนานกว่า cooldown', () => {
  const left = refreshLeftMs(9_000_000, 1_000_000)   // now < lastAt
  assert.ok(left <= PVP_REFRESH_COOLDOWN_MS)
})

test('canRefresh: สอดคล้องกับ refreshLeftMs', () => {
  assert.equal(canRefresh(1000, 1000), false)
  assert.equal(canRefresh(1000, 1000 + PVP_REFRESH_COOLDOWN_MS), true)
})
