# ออเดอร์ฟาร์ม — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บอร์ดออเดอร์ 5 ช่องในหน้าฟาร์ม — ส่งพืชตามที่ขอแลกเหรียญ ช่องที่ว่างเติมใบใหม่เองตามเวลา (ส่ง 30 นาที / ปฏิเสธ 2 ชม.) พร้อมกับดักบันทึกค่าที่เป็นไปไม่ได้ต่อยอดจากระบบ `cheatLogs` เดิม

**Architecture:** ตรรกะทั้งหมดเป็น pure function ในไฟล์ข้อมูล (`data/farmOrders.js`, `utils/farmPlausibility.js`) เทสได้ด้วย `node --test` · composable `useFarmOrders` ทำหน้าที่เดียวคือแปลงเจตนาเป็นการเขียน Firestore ครั้งเดียวจบผ่าน `auth.patchUser` · component เป็นแค่ชั้นแสดงผล ไม่มีตรรกะเกม

**Tech Stack:** Vue 3 (script setup, SFC + scoped style) · Vite · Firestore ผ่าน `stores/auth.js` · `node --test` สำหรับ pure utils · ไม่เพิ่ม dependency ใหม่

**สเปก:** `docs/superpowers/specs/2026-08-22-farm-orders-design.md`

## Global Constraints

- **ห้ามแตะ** `src/composables/useFarm.js` · `firestore.rules` · `src/utils/battleFx.js` · `src/components/battle/BattleReplay.vue`
- **ฟอนต์ขั้นต่ำ `.7rem`** ห้ามมี `font-size` ต่ำกว่านี้ในไฟล์ `.vue`/`.css` ใดๆ (ภาษาไทยมีสระบน-ล่าง ต่ำกว่านี้อ่านไม่ออกบนมือถือจริง)
- **การเขียน user doc ต้องผ่าน `auth.patchUser(optimistic, server)` เท่านั้น** — คืน boolean, caller เป็นคน toast เอง
- **`overflow-x` อยู่ที่รางเลื่อนเท่านั้น ห้ามให้ทั้งหน้าเลื่อนแนวนอนได้**
- **กับดักจับโกงต้องบันทึกอย่างเดียว ห้ามขวางผู้เล่น** ไม่ว่ากรณีใด
- `prefers-reduced-motion: reduce` ต้องใช้งานได้ครบทุกฟีเจอร์
- คอมเมนต์ไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · single-file component + scoped style
- `npm run build` ต้องผ่านก่อน commit ทุก task · ไม่เพิ่ม dependency ใหม่

**หมายเหตุการแปลงค่าจากสเปก:** สเปกเขียนตัวคูณเป็น `REWARD_MULT 1.5` / `VARIETY_BONUS 0.10`
แผนนี้ใช้เป็น **จำนวนเต็มเปอร์เซ็นต์** (`REWARD_PCT 150` / `VARIETY_PCT 10`) แล้วหาร 100 ตอนท้ายครั้งเดียว —
ค่าเท่ากันเป๊ะ แต่เลี่ยง float drift (`1.5 + 0.1*2` ในจาวาสคริปต์ได้ `1.7000000000000002` ซึ่งทำให้เทสที่ปัดเศษเปราะ)

---

### Task 1: แกนคำนวณออเดอร์ — รางวัล + เช็คของ

**Files:**
- Create: `src/data/farmOrders.js`
- Test: `src/data/farmOrders.test.js`

**Interfaces:**
- Consumes: `getCrop(id)` จาก `src/data/crops.js` (คืน object พืชหรือ `null`) · แต่ละพืชมี `{ id, name, emoji, growMinutes, sellPrice }`
- Produces:
  - `ORDER_SLOTS = 5` · `REFILL_MS` · `REROLL_MS` · `REWARD_PCT = 150` · `VARIETY_PCT = 10` · `MAX_KINDS = 3` · `KIND_WEIGHTS = [45, 35, 20]`
  - `orderReward(items) → { coins }` — `items` = `{ cropId: qty }`
  - `canDeliver(order, inventory) → boolean` — `order` = `{ id, items, reward }`
  - `missingItems(order, inventory) → { cropId: จำนวนที่ขาด }`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/data/farmOrders.test.js`:

```js
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
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/data/farmOrders.test.js`
Expected: FAIL — `Cannot find module './farmOrders.js'`

- [ ] **Step 3: เขียนโค้ดน้อยสุดที่ทำให้ผ่าน**

สร้าง `src/data/farmOrders.js`:

```js
// ════════════════════════════════════════════════════════════
//  ออเดอร์ฟาร์ม (Farm Orders) — บอร์ด 5 ช่อง เติมใบใหม่เองตามเวลา
// ════════════════════════════════════════════════════════════
//  ส่งพืชตามที่ขอ → ได้เหรียญมากกว่าเอาไปขายเอง · ปฏิเสธใบที่ไม่ถูกใจได้
//  แต่ช่องจะรอนานกว่า · ไม่มีการรีเซ็ตรายวัน ใบที่ยังไม่ส่งค้างอยู่ได้เรื่อยๆ
//  ตัวเลขทั้งหมดจูนได้ที่นี่ ไม่ต้องแตะตรรกะ
// ════════════════════════════════════════════════════════════
import { getCrop } from './crops.js'

export const ORDER_SLOTS = 5
export const REFILL_MS = 30 * 60 * 1000        // รอหลังส่งสำเร็จ
export const REROLL_MS = 2 * 60 * 60 * 1000    // รอหลังปฏิเสธ (แพงกว่า กันรีโรลรัวจนได้ใบคุ้มสุดเสมอ)

// ── รางวัล: คิดเป็นจำนวนเต็มเปอร์เซ็นต์แล้วหาร 100 ครั้งเดียวตอนท้าย
//    (1.5 + 0.1*2 ในจาวาสคริปต์ = 1.7000000000000002 → ปัดเศษเพี้ยน) ──
export const REWARD_PCT = 150    // % ของราคาขายรวม
export const VARIETY_PCT = 10    // +% ต่อชนิดที่เกินชนิดแรก
export const MAX_KINDS = 3
export const KIND_WEIGHTS = [45, 35, 20]   // น้ำหนักสุ่มจำนวนชนิด 1 / 2 / 3

/** รางวัลของออเดอร์ — โครงเป็น object เผื่อเติมของอย่างอื่นทีหลังโดยไม่ต้องแก้ทั้งเส้นทาง */
export function orderReward(items) {
  const entries = Object.entries(items || {}).filter(([, q]) => Number(q) > 0)
  if (!entries.length) return { coins: 0 }
  let base = 0
  for (const [id, qty] of entries) {
    const c = getCrop(id)
    if (c) base += c.sellPrice * Number(qty)
  }
  const pct = REWARD_PCT + VARIETY_PCT * (entries.length - 1)
  return { coins: Math.round(base * pct / 100) }
}

/** ผลผลิตในกล่องพอส่งออเดอร์นี้ไหม */
export function canDeliver(order, inventory) {
  const items = order?.items
  if (!items || !Object.keys(items).length) return false
  const inv = inventory || {}
  for (const [id, qty] of Object.entries(items)) {
    if ((Number(inv[id]) || 0) < Number(qty)) return false
  }
  return true
}

/** ชนิดที่ยังขาด + ขาดกี่ชิ้น (ใช้ระบายสีชิปในบอร์ด) */
export function missingItems(order, inventory) {
  const out = {}
  const inv = inventory || {}
  for (const [id, qty] of Object.entries(order?.items || {})) {
    const short = Number(qty) - (Number(inv[id]) || 0)
    if (short > 0) out[id] = short
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/data/farmOrders.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: build ผ่าน + commit**

Run: `npm run build`
Expected: build สำเร็จ

```bash
git add src/data/farmOrders.js src/data/farmOrders.test.js
git commit -m "Orders: แกนคำนวณรางวัล + เช็คผลผลิต (pure + เทส)"
```

---

### Task 2: สร้างออเดอร์แบบสุ่มมี seed + จัดการช่อง

**Files:**
- Modify: `src/data/farmOrders.js` (ต่อท้าย)
- Modify: `src/data/farmOrders.test.js` (ต่อท้าย)

**Interfaces:**
- Consumes: `orderReward`, `ORDER_SLOTS`, `MAX_KINDS`, `KIND_WEIGHTS` จาก Task 1 · พืชแต่ละตัวมี `growMinutes`
- Produces:
  - `QTY_BRACKETS` · `qtyBracket(crop) → { maxMinutes, min, max }`
  - `buildOrder(seed, crops, now) → { id, items, reward } | null` — `crops` = array ของ object พืช, คืน `null` ถ้า `crops` ว่าง
  - `normalizeOrders(raw, now) → array ยาว ORDER_SLOTS เสมอ` — สมาชิกเป็น `{ id, items, reward }` (มีออเดอร์) หรือ `{ at }` (กำลังรอ)
  - `dueSlots(orders, now) → [index]` ของช่องที่ว่างและถึงเวลาเติมแล้ว

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

ต่อท้าย `src/data/farmOrders.test.js` (แก้บรรทัด import ด้านบนให้ดึงของใหม่มาด้วย):

```js
import { CROPS, cropsForLevel, getCrop } from './crops.js'
import { qtyBracket, buildOrder, normalizeOrders, dueSlots } from './farmOrders.js'

const ALL = CROPS

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
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/data/farmOrders.test.js`
Expected: FAIL — `qtyBracket is not a function` (เทสของ Task 1 ยังผ่านเหมือนเดิม)

- [ ] **Step 3: เขียน implementation**

ต่อท้าย `src/data/farmOrders.js`:

```js
// ── ตัวสุ่มแบบมี seed (mulberry32) — ไม่ใช่ crypto ใช้เพื่อให้เทสได้ว่า
//    seed เดิมต้องได้ออเดอร์เดิมเสมอ ──
function rng(seed) {
  let a = (Number(seed) || 0) >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// จำนวนชิ้นผูกกับเวลาโต ไม่ใช่สุ่มลอยๆ — กันออเดอร์อย่าง "ต้นไม้เงินตรา ×5" (กินเวลา 15 วัน)
export const QTY_BRACKETS = [
  { maxMinutes: 15,       min: 3, max: 8 },
  { maxMinutes: 180,      min: 2, max: 5 },
  { maxMinutes: 1440,     min: 1, max: 3 },
  { maxMinutes: Infinity, min: 1, max: 2 },
]

export function qtyBracket(crop) {
  const m = Number(crop?.growMinutes) || 0
  return QTY_BRACKETS.find(b => m <= b.maxMinutes) || QTY_BRACKETS[QTY_BRACKETS.length - 1]
}

/** สร้างออเดอร์ 1 ใบจาก seed · `crops` = พืชที่ปลดล็อกแล้วเท่านั้น · คืน null ถ้าไม่มีพืชให้เลือก */
export function buildOrder(seed, crops, now) {
  const list = (Array.isArray(crops) ? crops : []).filter(Boolean)
  if (!list.length) return null
  const rand = rng(seed)

  // จำนวนชนิด: สุ่มตามน้ำหนัก แล้ว clamp ด้วยจำนวนพืชที่มีจริง
  let roll = rand() * KIND_WEIGHTS.reduce((s, w) => s + w, 0)
  let kinds = 1
  for (let i = 0; i < KIND_WEIGHTS.length; i++) {
    if (roll < KIND_WEIGHTS[i]) { kinds = i + 1; break }
    roll -= KIND_WEIGHTS[i]
  }
  kinds = Math.min(kinds, MAX_KINDS, list.length)

  // เลือกพืชไม่ซ้ำ (หยิบออกจากกองทีละตัว)
  const pool = list.slice()
  const items = {}
  for (let i = 0; i < kinds; i++) {
    const crop = pool.splice(Math.floor(rand() * pool.length), 1)[0]
    const b = qtyBracket(crop)
    items[crop.id] = b.min + Math.floor(rand() * (b.max - b.min + 1))
  }

  return { id: `o${now}x${((Number(seed) || 0) >>> 0).toString(36)}`, items, reward: orderReward(items) }
}

/** ทำให้ array ช่องถูกรูปเสมอ — ช่องที่หายไป/เพี้ยนกลายเป็นช่องพร้อมใช้ทันที (คนเก่าได้บอร์ดเต็มเลย) */
export function normalizeOrders(raw, now) {
  const src = Array.isArray(raw) ? raw : []
  const ready = Number(now) || 0
  const out = []
  for (let i = 0; i < ORDER_SLOTS; i++) {
    const s = src[i]
    if (s && typeof s === 'object' && s.items && typeof s.items === 'object' && Object.keys(s.items).length) {
      out.push({ id: String(s.id || `o${i}`), items: { ...s.items }, reward: { coins: Number(s.reward?.coins) || 0 } })
    } else if (s && typeof s === 'object' && Number.isFinite(Number(s.at))) {
      out.push({ at: Number(s.at) })
    } else {
      out.push({ at: ready })
    }
  }
  return out
}

/** index ของช่องที่ว่างและถึงเวลาเติมใบใหม่แล้ว */
export function dueSlots(orders, now) {
  const list = Array.isArray(orders) ? orders : []
  const t = Number(now) || 0
  const out = []
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    if (s && !s.items && Number(s.at) <= t) out.push(i)
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/data/farmOrders.test.js`
Expected: PASS ทุกเคส (ทั้งของ Task 1 และ Task 2)

- [ ] **Step 5: build ผ่าน + commit**

Run: `npm run build`

```bash
git add src/data/farmOrders.js src/data/farmOrders.test.js
git commit -m "Orders: สร้างออเดอร์แบบสุ่มมี seed + จัดการช่อง (เทสได้ว่า seed เดิมได้ใบเดิม)"
```

---

### Task 3: กับดักจับค่าที่เป็นไปไม่ได้ + ต่อเข้าระบบเดิม

**Files:**
- Create: `src/utils/farmPlausibility.js`
- Test: `src/utils/farmPlausibility.test.js`
- Modify: `src/composables/useGuard.js` (เพิ่มการตรวจใน `runIntegrityCheck`)

**Interfaces:**
- Consumes: `growMs(cropId)` จาก `src/data/crops.js` (คืนมิลลิวินาที หรือ `0` ถ้าไม่รู้จักพืช) · `reportCheat(reason, detail)` ที่มีอยู่แล้วใน `useGuard.js` (fire-and-forget, dedupe ต่อ reason ต่อ session, ตัด detail ที่ 300 ตัวอักษร)
- Produces:
  - `PLAUSIBILITY_SLACK = 2`
  - `createdAtMs(createdAt) → number | null` — รับ Firestore Timestamp / number / Date / null
  - `maxPossibleHarvest(cropId, { createdMs, plotsUnlocked, now }) → number` (คืน `Infinity` เมื่อข้อมูลไม่พอ = ไม่มีวันรายงาน)
  - `implausibleStock(inventory, ctx) → [{ cropId, have, max }]`
  - `implausibleDelivery(items, ctx) → [{ cropId, need, max }]`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/farmPlausibility.test.js`:

```js
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
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/farmPlausibility.test.js`
Expected: FAIL — `Cannot find module './farmPlausibility.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/farmPlausibility.js`:

```js
// ════════════════════════════════════════════════════════════
//  farmPlausibility — เพดาน "เป็นไปได้ไหม" ของผลผลิตในฟาร์ม
// ════════════════════════════════════════════════════════════
//  ใช้คู่กับ cheatLogs (useGuard) — แอพนี้ client-only ป้องกันจริงไม่ได้
//  ที่ทำได้คือ "บันทึกค่าที่เป็นไปไม่ได้" ไว้ให้แอดมินดู
//
//  ⚠️ กติกาสำคัญ: บันทึกอย่างเดียว ห้ามขวางผู้เล่น — ถ้าเกณฑ์เพี้ยน
//     คนที่โดนคือนักศึกษาที่เล่นปกติ และแก้เองไม่ได้
//  ⚠️ เพดานหลวมโดยตั้งใจ: ไม่หักช่วงที่พืชยังไม่ปลดล็อก ไม่หักช่วงที่ไม่ได้เข้าเกม
//     แถมคูณ PLAUSIBILITY_SLACK เผื่ออีกชั้น → รายงานเฉพาะเคสที่อธิบายไม่ได้จริงๆ
//  ⚠️ ห้ามใช้เกณฑ์ที่อิงเหรียญ — AdminView แก้เหรียญรายคนได้ และของขวัญต้อนรับ
//     แจก 15,000 เหรียญ · ส่วนพืชไม่มีทางได้มาโดยไม่ปลูก
//  หมายเหตุ: ถ้าวันหนึ่งไป "เพิ่ม" growMinutes ของพืช เพดานจะแคบลงย้อนหลัง
//     ให้เผื่อใจว่าจะมีบันทึกโผล่มาสักพัก
// ════════════════════════════════════════════════════════════
import { growMs } from '../data/crops.js'

export const PLAUSIBILITY_SLACK = 2

/** createdAt จาก Firestore มาได้หลายรูป (Timestamp / number / Date / null) → ms หรือ null */
export function createdAtMs(createdAt) {
  if (createdAt == null) return null
  if (typeof createdAt === 'number') return Number.isFinite(createdAt) ? createdAt : null
  if (createdAt instanceof Date) { const t = createdAt.getTime(); return Number.isFinite(t) ? t : null }
  if (typeof createdAt.toMillis === 'function') {
    try { const t = createdAt.toMillis(); return Number.isFinite(t) ? t : null } catch { return null }
  }
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000
  return null
}

/** เพดานจำนวนที่เก็บเกี่ยวได้ตลอดอายุบัญชี · Infinity = ข้อมูลไม่พอ ห้ามรายงาน */
export function maxPossibleHarvest(cropId, { createdMs, plotsUnlocked, now } = {}) {
  const g = growMs(cropId)
  if (!g) return Infinity
  if (!Number.isFinite(createdMs) || !Number.isFinite(now) || now <= createdMs) return Infinity
  const plots = Math.max(1, Math.floor(Number(plotsUnlocked)) || 1)
  return Math.floor((now - createdMs) / g) * plots
}

function overCeiling(map, ctx, key) {
  const out = []
  for (const [cropId, raw] of Object.entries(map || {})) {
    const n = Number(raw) || 0
    if (n <= 0) continue
    const max = maxPossibleHarvest(cropId, ctx)
    if (Number.isFinite(max) && n > max * PLAUSIBILITY_SLACK) out.push({ cropId, [key]: n, max })
  }
  return out
}

/** ของในกล่องที่มากเกินกว่าจะเป็นไปได้ */
export function implausibleStock(inventory, ctx) { return overCeiling(inventory, ctx, 'have') }

/** ของที่กำลังส่งออเดอร์ซึ่งมากเกินกว่าจะเป็นไปได้ */
export function implausibleDelivery(items, ctx) { return overCeiling(items, ctx, 'need') }
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/farmPlausibility.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: ต่อเข้า `runIntegrityCheck` ที่มีอยู่**

ใน `src/composables/useGuard.js` เพิ่ม import:
```js
import { createdAtMs, implausibleStock } from '../utils/farmPlausibility.js'
```

แล้วเพิ่มท้ายฟังก์ชัน `runIntegrityCheck` (หลังบล็อกเช็ก `residence.level` เดิม — **อย่าลบของเดิม**):
```js
  // ผลผลิตในกล่องเกินกว่าที่จะปลูกทันตลอดอายุบัญชี → บันทึกไว้ให้แอดมินดู (ไม่ขวางผู้เล่น)
  const badStock = implausibleStock(userData.farm?.inventory, {
    createdMs: createdAtMs(userData.createdAt),
    plotsUnlocked: userData.farm?.plotsUnlocked,
    now: Date.now(),
  })
  if (badStock.length) {
    reportCheat('farm-stock-impossible', badStock.map(b => `${b.cropId}=${b.have}/max${b.max}`).join(' '))
  }
```

⚠️ `runIntegrityCheck` ถูกเรียกจาก `App.vue` ด้วย `watch(..., { immediate: true })` คือรันทุกครั้งที่ userData เปลี่ยน — `reportCheat` มี dedupe ต่อ reason ต่อ session อยู่แล้ว **ห้ามใส่ค่าที่เปลี่ยนไปมาลงใน reason** (จะกลายเป็นเขียนรัว) ให้อยู่ใน `detail` เท่านั้นตามโค้ดข้างบน

- [ ] **Step 6: build ผ่าน + commit**

Run: `npm run build`

```bash
git add src/utils/farmPlausibility.js src/utils/farmPlausibility.test.js src/composables/useGuard.js
git commit -m "Guard: บันทึกผลผลิตที่เป็นไปไม่ได้ลง cheatLogs (เพดานจากอายุบัญชี × แปลง)"
```

---

### Task 4: ต่อบอร์ดเข้ากับ user doc

**Files:**
- Modify: `src/data/userSchema.js` (เพิ่ม `orders: []` ใน `USER_DEFAULTS.farm`)
- Create: `src/composables/useFarmOrders.js`

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1–3 · `auth.patchUser(optimistic, server) → Promise<boolean>` · `useToast().toast(msg, type)` · `cropsForLevel(level)` จาก `data/crops.js`
- Produces: `useFarmOrders()` คืน
  - `orders` (computed, array ยาว 5) · `inventory` (computed) · `busyId` (ref, id ของออเดอร์ที่กำลังส่ง)
  - `refillDue() → Promise<boolean>` — คืน `false` ทันทีถ้าไม่มีช่องถึงเวลา (ไม่เขียน Firestore)
  - `deliver(i) → Promise<boolean>` · `reroll(i) → Promise<boolean>`

- [ ] **Step 1: เพิ่มฟิลด์ใน schema**

ใน `src/data/userSchema.js` แก้บรรทัด `farm:` ใน `USER_DEFAULTS` (เพิ่มแค่ `orders: []` ห้ามแตะค่าอื่น):
```js
  farm: { plots: [], plotCount: 4, inventory: {}, lastTick: null, plotsUnlocked: 1, orders: [] },
```
`normalizeUserData` มีบรรทัด `d.farm = { ...USER_DEFAULTS.farm, ...(isObj(data.farm) ? data.farm : {}) }` อยู่แล้ว → คนเก่าได้ `orders: []` อัตโนมัติ ไม่ต้องทำ migration

- [ ] **Step 2: เขียน composable**

สร้าง `src/composables/useFarmOrders.js`:

```js
import { computed, ref } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from './useToast.js'
import { reportCheat } from './useGuard.js'
import { cropsForLevel } from '../data/crops.js'
import { createdAtMs, implausibleDelivery } from '../utils/farmPlausibility.js'
import {
  REFILL_MS, REROLL_MS, buildOrder, canDeliver, normalizeOrders, dueSlots,
} from '../data/farmOrders.js'

/**
 * บอร์ดออเดอร์ผูกกับผู้ใช้ที่ล็อกอินอยู่
 *   farm.orders = [ {id,items,reward} | {at} ] × 5
 * Firestore แก้ array ทีละ index ไม่ได้ → เขียนทั้ง array ทุกครั้ง (เหมือน farm.plots)
 */
export function useFarmOrders() {
  const auth = useAuthStore()
  const { toast } = useToast()

  const level     = computed(() => auth.userData?.residence?.level || 1)
  const inventory = computed(() => auth.userData?.farm?.inventory || {})
  const orders    = computed(() => normalizeOrders(auth.userData?.farm?.orders, Date.now()))
  const busyId    = ref(null)     // กันกดส่งซ้ำระหว่างรอเขียน

  function cloneOrders() { return orders.value.map(o => ({ ...o })) }

  // เขียนครั้งเดียวจบเสมอ — แยกเขียนแล้วเน็ตหลุดกลางคัน = หักของแต่ไม่ได้เงิน
  async function commit(next, { inventory: newInv, coinDelta = 0 } = {}) {
    const farm = { ...(auth.userData?.farm || {}), orders: next }
    if (newInv) farm.inventory = newInv
    const optimistic = { farm }
    if (coinDelta) optimistic.coins = (auth.userData?.coins || 0) + coinDelta
    const patch = { 'farm.orders': next }
    if (newInv) patch['farm.inventory'] = newInv
    if (coinDelta) patch.coins = increment(coinDelta)
    return auth.patchUser(optimistic, patch)
  }

  /** เติมใบใหม่ให้ทุกช่องที่ถึงเวลา · ไม่มีช่องถึงเวลา = ไม่เขียนอะไรเลย */
  async function refillDue() {
    const now = Date.now()
    const due = dueSlots(orders.value, now)
    if (!due.length) return false
    const crops = cropsForLevel(level.value)
    if (!crops.length) return false
    const next = cloneOrders()
    let filled = 0
    for (const i of due) {
      const o = buildOrder(now + i, crops, now)   // seed ต่างกันต่อช่อง → ใบไม่ซ้ำกัน
      if (o) { next[i] = o; filled++ }
    }
    if (!filled) return false
    return commit(next)
  }

  async function deliver(i) {
    const o = orders.value[i]
    if (!o?.items || busyId.value) return false
    if (!canDeliver(o, inventory.value)) { toast('ผลผลิตยังไม่พอส่งออเดอร์นี้', 'info'); return false }

    // กับดัก: บันทึกอย่างเดียว ห้ามขวางผู้เล่นไม่ว่ากรณีใด
    const bad = implausibleDelivery(o.items, {
      createdMs: createdAtMs(auth.userData?.createdAt),
      plotsUnlocked: auth.userData?.farm?.plotsUnlocked,
      now: Date.now(),
    })
    if (bad.length) {
      reportCheat('order-delivery-impossible', bad.map(b => `${b.cropId}=${b.need}/max${b.max}`).join(' '))
    }

    busyId.value = o.id
    const inv = { ...inventory.value }
    for (const [id, qty] of Object.entries(o.items)) {
      const left = (Number(inv[id]) || 0) - Number(qty)
      if (left > 0) inv[id] = left; else delete inv[id]
    }
    const next = cloneOrders()
    next[i] = { at: Date.now() + REFILL_MS }
    const gain = Number(o.reward?.coins) || 0

    const ok = await commit(next, { inventory: inv, coinDelta: gain })
    busyId.value = null
    if (ok) toast(`ส่งออเดอร์แล้ว +${gain.toLocaleString()} เหรียญ`, 'success')
    else toast('ส่งออเดอร์ไม่สำเร็จ', 'error')
    return ok
  }

  async function reroll(i) {
    const o = orders.value[i]
    if (!o?.items || busyId.value) return false
    busyId.value = o.id
    const next = cloneOrders()
    next[i] = { at: Date.now() + REROLL_MS }
    const ok = await commit(next)
    busyId.value = null
    if (ok) toast('ทิ้งออเดอร์แล้ว รอใบใหม่', 'info')
    else toast('ทิ้งออเดอร์ไม่สำเร็จ', 'error')
    return ok
  }

  return { orders, inventory, busyId, refillDue, deliver, reroll }
}
```

- [ ] **Step 3: ตรวจว่าไม่ได้เผลอแตะ useFarm**

Run: `git diff --name-only`
Expected: มีแค่ `src/data/userSchema.js` และไฟล์ใหม่ `src/composables/useFarmOrders.js` — **ห้ามมี `useFarm.js`**

- [ ] **Step 4: เทสเดิมทั้งหมดยังผ่าน + build ผ่าน**

Run: `node --test src/data/farmOrders.test.js src/utils/farmPlausibility.test.js src/data/farmPlots.test.js && npm run build`
Expected: PASS ทั้งหมด + build สำเร็จ

- [ ] **Step 5: Commit**

```bash
git add src/data/userSchema.js src/composables/useFarmOrders.js
git commit -m "Orders: ต่อบอร์ดเข้ากับ user doc (เขียนครั้งเดียวจบ กันหักของแล้วไม่ได้เงิน)"
```

---

### Task 5: บอร์ดในหน้าฟาร์ม

**Files:**
- Create: `src/components/farm/FarmOrders.vue`
- Modify: `src/views/FarmView.vue`

**Interfaces:**
- Consumes: `useFarmOrders()` จาก Task 4 · `missingItems(order, inventory)` จาก Task 1 · `getCrop(id)` จาก `data/crops.js` · `useConfirm().confirm(msg) → Promise<boolean>` · `<Emoji :char="…" />` จาก `components/shared/Emoji.vue`
- Produces: ไม่มี export — เป็นปลายทาง

- [ ] **Step 1: เขียน component**

สร้าง `src/components/farm/FarmOrders.vue`:

```vue
<template>
  <div class="fo">
    <div class="fo-head">
      <span class="fo-title"><Emoji char="📋" /> ออเดอร์</span>
      <span class="fo-sub">{{ readyCount }} ใบที่ส่งได้</span>
    </div>

    <div class="fo-rail">
      <div v-for="(o, i) in orders" :key="o.id || ('w' + i)" class="fo-card" :class="{ waiting: !o.items }">
        <!-- ช่องกำลังรอใบใหม่ -->
        <div v-if="!o.items" class="fo-wait">
          <Emoji char="⏳" />
          <span>{{ fmt(o.at - now) }}</span>
        </div>

        <!-- ช่องที่มีออเดอร์ -->
        <template v-else>
          <div class="fo-items">
            <span
              v-for="(qty, id) in o.items"
              :key="id"
              class="fo-chip"
              :class="{ lack: missing(o)[id] }"
            >
              <Emoji :char="cropOf(id).emoji" />
              <span aria-hidden="true">×{{ qty }}</span>
              <span class="sr-only">{{ cropOf(id).name }} {{ qty }} ชิ้น</span>
            </span>
          </div>
          <div class="fo-pay"><Emoji char="🪙" /> {{ o.reward.coins.toLocaleString() }}</div>
          <div class="fo-btns">
            <button
              class="fo-send"
              :disabled="!ready(o) || !!busyId"
              @click="onDeliver(i, o)"
            >{{ ready(o) ? 'ส่ง' : 'ของไม่พอ' }}</button>
            <button class="fo-skip" :disabled="!!busyId" aria-label="ทิ้งออเดอร์ใบนี้" @click="onReroll(i, o)">✕</button>
          </div>
        </template>
      </div>
    </div>

    <div class="fo-dots"><span v-for="(o, i) in orders" :key="i" class="fo-dot" :class="{ on: !!o.items }"></span></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { useFarmOrders } from '../../composables/useFarmOrders.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { missingItems, canDeliver, REROLL_MS } from '../../data/farmOrders.js'
import { getCrop } from '../../data/crops.js'

const board = useFarmOrders()
const { confirm } = useConfirm()

const orders    = computed(() => board.orders.value)
const busyId    = computed(() => board.busyId.value)
const now       = ref(Date.now())
let timer = null

onMounted(async () => {
  await board.refillDue()
  timer = setInterval(async () => {
    now.value = Date.now()
    // ช่องไหนนับถอยหลังจบแล้วให้เติมใบใหม่ (refillDue ไม่เขียนถ้าไม่มีช่องถึงเวลา)
    await board.refillDue()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))

const cropOf = (id) => getCrop(id) || { name: id, emoji: '❓' }
const missing = (o) => missingItems(o, board.inventory.value)
const ready   = (o) => canDeliver(o, board.inventory.value)
const readyCount = computed(() => orders.value.filter(o => o.items && ready(o)).length)

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}ชม ${m}น`
  if (m > 0) return `${m}น ${s % 60}ว`
  return `${s}ว`
}

function listText(o) {
  return Object.entries(o.items).map(([id, q]) => `${cropOf(id).name} ×${q}`).join(' · ')
}

async function onDeliver(i, o) {
  if (await confirm(`ส่ง ${listText(o)} แลก ${o.reward.coins.toLocaleString()} เหรียญ?`)) board.deliver(i)
}
async function onReroll(i, o) {
  const hrs = Math.round(REROLL_MS / 3600000)
  if (await confirm(`ทิ้งออเดอร์ ${listText(o)}? ช่องนี้จะรอ ${hrs} ชั่วโมงก่อนได้ใบใหม่`)) board.reroll(i)
}
</script>

<style scoped>
.fo { background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 16px; padding: 14px; margin-top: 12px; }
.fo-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
.fo-title { font-weight: 800; font-size: 1rem; }
.fo-sub { font-size: .7rem; color: rgba(0,0,0,.45); }
/* overflow-x อยู่ที่รางเท่านั้น — ห้ามให้ทั้งหน้าเลื่อนแนวนอนได้ */
.fo-rail { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-bottom: 6px; }
.fo-card { flex: 0 0 172px; scroll-snap-align: start; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; min-height: 118px; border: 1px solid rgba(180,83,9,.2); border-radius: 12px; background: linear-gradient(160deg,#fff,rgba(245,158,11,.06)); padding: 10px; }
.fo-card.waiting { background: rgba(0,0,0,.03); border-style: dashed; }
.fo-wait { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 100%; color: rgba(0,0,0,.45); font-size: .75rem; font-weight: 700; }
.fo-items { display: flex; flex-wrap: wrap; gap: 5px; }
.fo-chip { display: inline-flex; align-items: center; gap: 3px; font-size: .78rem; font-weight: 700; background: rgba(0,0,0,.05); border-radius: 8px; padding: 3px 7px; }
.fo-chip.lack { background: rgba(220,38,38,.1); color: #b91c1c; }
.fo-pay { font-size: .82rem; font-weight: 800; color: #b45309; }
.fo-btns { display: flex; gap: 6px; }
.fo-send { flex: 1; border: none; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; font-weight: 800; font-size: .76rem; padding: 7px; border-radius: 9px; cursor: pointer; font-family: inherit; }
.fo-send:disabled { background: rgba(0,0,0,.12); color: rgba(0,0,0,.38); cursor: not-allowed; }
.fo-skip { border: 1px solid rgba(0,0,0,.14); background: #fff; color: rgba(0,0,0,.5); font-size: .74rem; padding: 7px 9px; border-radius: 9px; cursor: pointer; font-family: inherit; }
.fo-skip:disabled { opacity: .4; cursor: not-allowed; }
.fo-dots { display: flex; justify-content: center; gap: 4px; margin-top: 4px; }
.fo-dot { width: 5px; height: 5px; border-radius: 999px; background: rgba(0,0,0,.14); }
.fo-dot.on { background: #b45309; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) {
  .fo-rail { scroll-behavior: auto; }
}
</style>
```

- [ ] **Step 2: วางบอร์ดในหน้าฟาร์ม**

ใน `src/views/FarmView.vue` เพิ่ม import และวางระหว่าง `<FarmGrid />` กับ `<FarmShop />`:
```html
    <FarmGrid />
    <FarmOrders />
    <FarmShop />
```
```js
import FarmOrders from '../components/farm/FarmOrders.vue'
```

- [ ] **Step 3: ตรวจฟอนต์ + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/ ; npm run build`
Expected: grep ไม่เจออะไร · build ผ่าน

- [ ] **Step 4: เทสของจริงในเบราว์เซอร์**

Run: `npm run dev` → เปิด `/play/farm`
ตรวจทีละข้อ:
1. บอร์ดโผล่ระหว่างแปลงปลูกกับร้านค้า มีออเดอร์ครบ 5 ใบตั้งแต่เปิดครั้งแรก (คนเก่าก็ต้องได้ครบ)
2. ปัดรางซ้าย-ขวาได้ และ **ทั้งหน้าต้องไม่เลื่อนแนวนอน** (ลองปัดที่พื้นที่นอกราง)
3. ใบที่ผลผลิตไม่พอ → ชิปที่ขาดขึ้นแดง ปุ่มขึ้น "ของไม่พอ" กดไม่ได้
4. ปลูก+เก็บเกี่ยวให้ครบตามใบหนึ่ง → ปุ่มเปลี่ยนเป็น "ส่ง" → กด → ยืนยัน → ผลผลิตหักถูก เหรียญเพิ่มถูก ช่องเริ่มนับถอยหลัง 30 นาที
5. กด ✕ ทิ้งใบหนึ่ง → ยืนยัน → ช่องนับถอยหลัง 2 ชม.
6. เปิด DevTools → Network → **อยู่บนหน้าฟาร์มเฉยๆ ตอนไม่มีช่องถึงเวลา ต้องไม่มี write ไป Firestore** (มีแต่ตอนกดส่ง/ทิ้ง หรือตอนช่องเติมใบใหม่)
7. ย่อจอ 375px และ 320px → การ์ดไม่ล้น ตัวหนังสืออ่านออก
8. เปิด DevTools → Rendering → "prefers-reduced-motion: reduce" → ใช้งานได้ครบเหมือนเดิม

- [ ] **Step 5: Commit**

```bash
git add src/components/farm/FarmOrders.vue src/views/FarmView.vue
git commit -m "Orders: บอร์ดออเดอร์ในหน้าฟาร์ม (รางเลื่อนแนวนอน กันหน้าเลื่อนทั้งจอ)"
```

---

## ปิดงาน

- [ ] **รันเทสทั้งโปรเจกต์**

Run: `node --test src/data/farmOrders.test.js src/utils/farmPlausibility.test.js src/data/crops.test.js src/data/farmPlots.test.js src/utils/petUtils.test.js src/utils/idleIncome.test.js src/utils/dailyQuest.test.js`
Expected: ผ่านทั้งหมด เอาต์พุตสะอาด

- [ ] **build สุดท้าย**

Run: `npm run build`

- [ ] **ตรวจว่าไม่ได้เผลอแตะไฟล์ต้องห้าม**

Run: `git diff --name-only 2d9e613..HEAD`
Expected: มีแค่ `src/data/farmOrders.js` `src/data/farmOrders.test.js` `src/utils/farmPlausibility.js` `src/utils/farmPlausibility.test.js` `src/composables/useGuard.js` `src/composables/useFarmOrders.js` `src/data/userSchema.js` `src/components/farm/FarmOrders.vue` `src/views/FarmView.vue` — **ห้ามมี** `useFarm.js` `firestore.rules` `battleFx.js` `BattleReplay.vue`

- [ ] **ส่งให้ user เทสจอจริงบนมือถือก่อน deploy** — deploy ด้วย `git push origin master` (GitHub Actions build+publish ให้เอง) · ไม่ต้อง `firebase deploy` เพราะไม่แตะ rules
