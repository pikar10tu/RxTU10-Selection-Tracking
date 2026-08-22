import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_SLOTS, REFILL_MS, REROLL_MS, REWARD_PCT, VARIETY_PCT,
  orderReward, canDeliver, missingItems, qtyBracket, buildOrder, normalizeOrders, dueSlots,
} from './farmOrders.js'
import { CROPS, cropsForLevel, getCrop } from './crops.js'

const ALL = CROPS

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

test('buildOrder: seed เดิม + พืชเดิม → ผลลัพธ์เหมือนเดิมทุกฟิลด์', () => {
  const a = buildOrder(42, ALL, 1000)
  const b = buildOrder(42, ALL, 1000)
  assert.deepEqual(a, b)
})

test('buildOrder: seed ต่างกันได้ผลต่างกัน (อย่างน้อย 1 ใน 20 seed)', () => {
  const first = JSON.stringify(buildOrder(1, ALL, 1000).items)
  let differs = false
  for (let s = 2; s <= 20; s++) {
    if (JSON.stringify(buildOrder(s, ALL, 1000).items) !== first) { differs = true; break }
  }
  assert.ok(differs, 'seed ต่างกันควรได้ออเดอร์ต่างกันบ้าง')
})

test('buildOrder: ขอเฉพาะพืชที่ส่งเข้าไปเท่านั้น', () => {
  const only = cropsForLevel(1)                       // Lv.1 = ผักกาด + มะเขือเทศ
  const allowed = new Set(only.map(c => c.id))
  for (let s = 0; s < 200; s++) {
    for (const id of Object.keys(buildOrder(s, only, 1000).items)) {
      assert.ok(allowed.has(id), `seed ${s} หลุดพืชที่ยังไม่ปลดล็อก: ${id}`)
    }
  }
})

test('buildOrder: จำนวนชิ้นอยู่ในช่วงของ bracket ตามเวลาโตเสมอ', () => {
  for (let s = 0; s < 300; s++) {
    for (const [id, qty] of Object.entries(buildOrder(s, ALL, 1000).items)) {
      const b = qtyBracket(getCrop(id))
      assert.ok(qty >= b.min && qty <= b.max, `${id} ×${qty} หลุดช่วง ${b.min}-${b.max}`)
    }
  }
})

test('buildOrder: 1..3 ชนิด และไม่มีชนิดซ้ำในใบเดียว', () => {
  for (let s = 0; s < 300; s++) {
    const items = buildOrder(s, ALL, 1000).items
    const keys = Object.keys(items)
    assert.ok(keys.length >= 1 && keys.length <= 3, `seed ${s} ได้ ${keys.length} ชนิด`)
    assert.equal(new Set(keys).size, keys.length)
  }
})

test('buildOrder: ปลดล็อกพืชแค่ 1 ชนิด → ยังสร้างได้ ไม่ค้าง ไม่ throw', () => {
  const one = [getCrop('lettuce')]
  for (let s = 0; s < 50; s++) {
    const o = buildOrder(s, one, 1000)
    assert.deepEqual(Object.keys(o.items), ['lettuce'])
  }
})

test('buildOrder: crops ว่าง → null (ไม่ throw)', () => {
  assert.equal(buildOrder(1, [], 1000), null)
  assert.equal(buildOrder(1, undefined, 1000), null)
})

test('buildOrder: id ต่างกันเมื่อ seed ต่างกัน (ใช้กันกดส่งซ้ำ)', () => {
  assert.notEqual(buildOrder(1, ALL, 5000).id, buildOrder(2, ALL, 5000).id)
})

test('buildOrder: reward ตรงกับ orderReward ของ items ที่ได้', () => {
  const o = buildOrder(7, ALL, 1000)
  assert.deepEqual(o.reward, orderReward(o.items))
})

test('normalizeOrders: อินพุตพังทุกแบบ → array ยาว 5 เสมอ', () => {
  for (const raw of [undefined, null, [], 'ไม่ใช่ array', [null, null], new Array(9).fill(null)]) {
    const out = normalizeOrders(raw, 1000)
    assert.equal(out.length, ORDER_SLOTS, `raw=${JSON.stringify(raw)}`)
  }
})

test('normalizeOrders: ช่องที่หายไปกลายเป็นช่องพร้อมใช้ทันที (at = now)', () => {
  const out = normalizeOrders([], 1000)
  assert.deepEqual(out[0], { at: 1000 })
  assert.equal(dueSlots(out, 1000).length, ORDER_SLOTS)
})

test('normalizeOrders: เก็บออเดอร์เดิมไว้ครบ และแปลง reward ที่หายเป็น 0', () => {
  const out = normalizeOrders([{ id: 'x1', items: { tomato: 2 }, reward: { coins: 999 } }, { at: 77 }], 1000)
  assert.deepEqual(out[0], { id: 'x1', items: { tomato: 2 }, reward: { coins: 999 } })
  assert.deepEqual(out[1], { at: 77 })
  assert.deepEqual(normalizeOrders([{ id: 'x2', items: { tomato: 1 } }], 1000)[0].reward, { coins: 0 })
})

test('dueSlots: เฉพาะช่องว่างที่ถึงเวลาแล้ว · ช่องที่มีออเดอร์ไม่ถูกนับ', () => {
  const orders = [
    { at: 900 },                                        // ถึงเวลา
    { at: 1500 },                                       // ยังไม่ถึง
    { id: 'a', items: { tomato: 1 }, reward: { coins: 1 } },  // มีออเดอร์อยู่
    { at: 1000 },                                       // ถึงเวลาพอดี
    { at: 2000 },
  ]
  assert.deepEqual(dueSlots(orders, 1000), [0, 3])
  assert.deepEqual(dueSlots([], 1000), [])
  assert.deepEqual(dueSlots(undefined, 1000), [])
})
