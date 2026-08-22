import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_SLOTS, REFILL_MS, REROLL_MS, REWARD_PCT, VARIETY_PCT,
  orderReward, canDeliver, missingItems,
} from './farmOrders.js'

test('ค่าคงที่ตรงตามดีไซน์', () => {
  assert.equal(ORDER_SLOTS, 5)
  assert.equal(REFILL_MS, 30 * 60 * 1000)
  assert.equal(REROLL_MS, 2 * 60 * 60 * 1000)
  assert.equal(REWARD_PCT, 150)
  assert.equal(VARIETY_PCT, 10)
})

test('รางวัล 1 ชนิด = ราคาขายรวม x1.5', () => {
  // มะเขือเทศ sellPrice 320 × 3 = 960 → ×1.5 = 1440
  assert.deepEqual(orderReward({ tomato: 3 }), { coins: 1440 })
})

test('รางวัล 2 ชนิด = x1.6 (โบนัสความหลากหลาย +10%)', () => {
  // ผักกาด 45×5 = 225 · มะเขือเทศ 320×2 = 640 · รวม 865 → ×1.6 = 1384
  assert.deepEqual(orderReward({ lettuce: 5, tomato: 2 }), { coins: 1384 })
})

test('รางวัล 3 ชนิด = x1.7 และปัดเป็นจำนวนเต็ม', () => {
  // 45 + 320 + 1300 = 1665 → ×1.7 = 2830.5 → ปัดขึ้น 2831
  assert.deepEqual(orderReward({ lettuce: 1, tomato: 1, corn: 1 }), { coins: 2831 })
})

test('รางวัล: cropId ที่ไม่มีในคลังถูกข้าม ไม่ throw', () => {
  assert.deepEqual(orderReward({ tomato: 3, ไม่มีจริง: 99 }), { coins: 1440 })
})

test('รางวัล: items ว่าง/undefined → 0 เหรียญ', () => {
  assert.deepEqual(orderReward({}), { coins: 0 })
  assert.deepEqual(orderReward(undefined), { coins: 0 })
  assert.deepEqual(orderReward({ tomato: 0 }), { coins: 0 })
})

test('canDeliver: ของครบพอดี → true', () => {
  assert.equal(canDeliver({ items: { tomato: 3 } }, { tomato: 3 }), true)
  assert.equal(canDeliver({ items: { tomato: 3 } }, { tomato: 10, corn: 1 }), true)
})

test('canDeliver: ขาดแม้ชิ้นเดียว → false', () => {
  assert.equal(canDeliver({ items: { tomato: 3 } }, { tomato: 2 }), false)
  assert.equal(canDeliver({ items: { tomato: 1, corn: 1 } }, { tomato: 5 }), false)
})

test('canDeliver: อินพุตพัง → false ไม่ throw', () => {
  assert.equal(canDeliver({ items: { tomato: 1 } }, {}), false)
  assert.equal(canDeliver({ items: { tomato: 1 } }, undefined), false)
  assert.equal(canDeliver({ items: {} }, { tomato: 5 }), false)
  assert.equal(canDeliver(null, { tomato: 5 }), false)
  assert.equal(canDeliver(undefined, undefined), false)
})

test('missingItems: คืนเฉพาะชนิดที่ขาด พร้อมจำนวนที่ขาดจริง', () => {
  assert.deepEqual(missingItems({ items: { tomato: 3, corn: 2 } }, { tomato: 1, corn: 5 }), { tomato: 2 })
  assert.deepEqual(missingItems({ items: { tomato: 3 } }, { tomato: 3 }), {})
  assert.deepEqual(missingItems({ items: { tomato: 2 } }, {}), { tomato: 2 })
  assert.deepEqual(missingItems(null, {}), {})
})
