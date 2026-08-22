import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAUSIBILITY_SLACK, createdAtMs, maxPossibleHarvest, implausibleStock, implausibleDelivery,
} from './farmPlausibility.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

test('createdAtMs รับได้ทุกรูปแบบที่ Firestore คืนมา', () => {
  assert.equal(createdAtMs(12345), 12345)
  assert.equal(createdAtMs({ toMillis: () => 999 }), 999)
  assert.equal(createdAtMs({ seconds: 5 }), 5000)
  assert.equal(createdAtMs(new Date(4242)), 4242)
})

test('createdAtMs: ไม่มีข้อมูล → null (จะได้ไม่รายงานใคร)', () => {
  assert.equal(createdAtMs(null), null)
  assert.equal(createdAtMs(undefined), null)
  assert.equal(createdAtMs('ไม่ใช่เวลา'), null)
  assert.equal(createdAtMs({}), null)
})

test('maxPossibleHarvest: อายุ 2 วัน 3 แปลง พืชโต 3 วัน → 0', () => {
  // ต้นไม้เงินตรา growMinutes 4320 = 3 วัน
  const max = maxPossibleHarvest('moneytree', { createdMs: NOW - 2 * DAY, plotsUnlocked: 3, now: NOW })
  assert.equal(max, 0)
})

test('maxPossibleHarvest: อายุ 7 วัน 2 แปลง พืชโต 3 วัน → 4', () => {
  const max = maxPossibleHarvest('moneytree', { createdMs: NOW - 7 * DAY, plotsUnlocked: 2, now: NOW })
  assert.equal(max, 4)   // floor(7/3) = 2 รอบ × 2 แปลง
})

test('maxPossibleHarvest: ข้อมูลไม่พอ → Infinity (ไม่รายงาน)', () => {
  const ctx = { createdMs: null, plotsUnlocked: 3, now: NOW }
  assert.equal(maxPossibleHarvest('tomato', ctx), Infinity)
  assert.equal(maxPossibleHarvest('tomato', { createdMs: NOW - DAY, plotsUnlocked: 3, now: null }), Infinity)
  assert.equal(maxPossibleHarvest('ไม่มีพืชนี้', { createdMs: NOW - DAY, plotsUnlocked: 3, now: NOW }), Infinity)
})

test('maxPossibleHarvest: plotsUnlocked เพี้ยน/ศูนย์ → คิดเป็น 1 แปลง (ไม่ทำให้ max=0 แล้วรายงานมั่ว)', () => {
  const base = { createdMs: NOW - 10 * DAY, now: NOW }
  const one = maxPossibleHarvest('moneytree', { ...base, plotsUnlocked: 1 })
  assert.equal(maxPossibleHarvest('moneytree', { ...base, plotsUnlocked: 0 }), one)
  assert.equal(maxPossibleHarvest('moneytree', { ...base, plotsUnlocked: -5 }), one)
  assert.equal(maxPossibleHarvest('moneytree', { ...base, plotsUnlocked: undefined }), one)
})

test('implausibleStock: มีของเกินที่เป็นไปได้แบบชัดเจน → รายงาน', () => {
  const ctx = { createdMs: NOW - 2 * DAY, plotsUnlocked: 3, now: NOW }
  const bad = implausibleStock({ moneytree: 5 }, ctx)
  assert.equal(bad.length, 1)
  assert.equal(bad[0].cropId, 'moneytree')
  assert.equal(bad[0].have, 5)
  assert.equal(bad[0].max, 0)
})

test('implausibleStock: เล่นเยอะแต่สมเหตุสมผล → ไม่รายงาน', () => {
  // อายุ 30 วัน 12 แปลง ผักกาดโต 5 นาที → เพดานมหาศาล
  const ctx = { createdMs: NOW - 30 * DAY, plotsUnlocked: 12, now: NOW }
  assert.deepEqual(implausibleStock({ lettuce: 500 }, ctx), [])
})

test('implausibleStock: เกินเพดานแต่ยังไม่ถึง SLACK เท่า → ไม่รายงาน', () => {
  const ctx = { createdMs: NOW - 7 * DAY, plotsUnlocked: 2, now: NOW }
  const max = maxPossibleHarvest('moneytree', ctx)      // = 4
  assert.deepEqual(implausibleStock({ moneytree: max * PLAUSIBILITY_SLACK }, ctx), [])
  assert.equal(implausibleStock({ moneytree: max * PLAUSIBILITY_SLACK + 1 }, ctx).length, 1)
})

test('implausibleStock: ไม่มี createdAt → ไม่รายงานเด็ดขาด', () => {
  const ctx = { createdMs: null, plotsUnlocked: 1, now: NOW }
  assert.deepEqual(implausibleStock({ moneytree: 99999 }, ctx), [])
})

test('implausibleStock: กล่องว่าง/อินพุตพัง → [] ไม่ throw', () => {
  const ctx = { createdMs: NOW - DAY, plotsUnlocked: 1, now: NOW }
  assert.deepEqual(implausibleStock({}, ctx), [])
  assert.deepEqual(implausibleStock(undefined, ctx), [])
  assert.deepEqual(implausibleStock({ tomato: 0 }, ctx), [])
})

test('implausibleDelivery: ใช้เกณฑ์เดียวกัน แต่รายงานเป็น need', () => {
  const ctx = { createdMs: NOW - 2 * DAY, plotsUnlocked: 3, now: NOW }
  const bad = implausibleDelivery({ moneytree: 2 }, ctx)
  assert.equal(bad.length, 1)
  assert.equal(bad[0].need, 2)
  assert.equal(bad[0].max, 0)
  assert.deepEqual(implausibleDelivery({ lettuce: 3 }, ctx), [])
})
