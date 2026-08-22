# หอคอย Vertical Progress Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนแถบความคืบหน้าหอคอยจากแถบแนวนอน + ชิป 6 ก้อน เป็นเส้นทางแนวตั้งซิกแซก 100 ชั้นที่เลื่อนได้ มีเพื่อนปักหมุดอยู่บนเส้นทาง และอนิเมชันไต่ขึ้นหลังชนะ โดยไม่แตะกลไกเกมเลย

**Architecture:** แตก `TowerView.vue` เป็น view + `TowerPath.vue` (เส้นทาง, ไม่รู้จัก store) + `FloorSheet.vue` (แผงรายละเอียดชั้น) + `towerCrowd.js` (ตรรกะล้วน เทสได้). เรนเดอร์ครบ 100 แถวเป็น DOM จริงแล้วพึ่ง `content-visibility: auto` ให้เบราว์เซอร์ข้าม layout/paint นอกจอ — ไม่ virtualize ไม่ผูก scroll listener. อนิเมชันทั้งหมดเป็น `transform`/`opacity` ยกเว้น `clip-path` จุดเดียว

**Tech Stack:** Vue 3 `<script setup>` + scoped CSS · ไม่มี dependency ใหม่ · เทส `node --test`

**Spec:** `docs/superpowers/specs/2026-08-22-tower-vertical-path-design.md`

## Global Constraints

ทุก task อยู่ใต้ข้อบังคับเหล่านี้ทั้งหมด:

- **ฟอนต์ขั้นต่ำ `.7rem`** — ห้ามมี `font-size` ต่ำกว่านี้ใน `.vue`/`.css` ใดๆ · ตรวจ `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/` ต้องไม่เจออะไร
- **overlay/modal/sheet `position:fixed` ใต้ `<RouterView>` ต้อง `<Teleport to="body">` เสมอ** (CLAUDE.md ข้อ 6 — บั๊กนี้วนกลับมา ≥5 รอบ) · ใช้ `components/shared/BottomSheet.vue` ซึ่งจัดการให้แล้ว **ห้ามเขียน overlay เอง**
- **อนิเมตเฉพาะ `transform` / `opacity`** — ห้าม animate `box-shadow`, `filter`, `background`, `width`/`height`/`top`/`left` · ข้อยกเว้นเดียวคือ `clip-path` ใน Task 5
- **ห้าม `filter: drop-shadow` บนอะไรที่ขยับ**
- **ห้ามผูก `scroll` event listener** — `IntersectionObserver` / `ResizeObserver` ใช้ได้
- **ห้ามแตะ** `data/towerFloors.js`, `composables/useTower.js`, `utils/battleEngine.js`, `firestore.rules`, `data/userSchema.js` — ตัวเลขเกมต้องเท่าเดิมทุกตัว
- **ห้ามเพิ่มการอ่าน Firestore** — ทุกอย่างคำนวณจาก `roster/current` ที่โหลดอยู่แล้ว
- คอมเมนต์เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · scoped style
- commit ทุก task ต้องลงท้ายด้วย `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- ไม่มี lint/test runner กลาง — ตรวจด้วย `npm run build` เสมอ

### ค่าคงที่ที่ใช้ร่วมกันทั้งงาน

```
ROW_H   = 60    ความสูงแถว (px) — ต้องเท่ากันทุกแถวเป๊ะ ไม่งั้น contain-intrinsic-size เพี้ยน
NODE_W  = 108   ความกว้างปุ่มโหนด (px)
NODE_H  = 44    ความสูงปุ่มโหนด (px) — touch target ขั้นต่ำ
MARKER  = 30    ขนาด marker ผู้เล่น (px)
PAD     = 8%    ระยะจากขอบกล่องถึงขอบนอกของโหนด
```

---

## Task 1: `utils/towerCrowd.js` — ตรรกะปักหมุดเพื่อน

**Files:**
- Create: `src/utils/towerCrowd.js`
- Test: `src/utils/towerCrowd.test.js`

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces:
  - `CROWD_SHOWN: number` (= 3)
  - `buildFloorCrowd(rows: Object, meUid: string) => Map<number, {shown: Friend[], extra: number, all: Friend[]}>`
  - `Friend = { uid: string, name: string, photo: string|null }`

**พื้นหลัง:** `roster/current` เป็น doc ก้อนเดียวที่ทุกจออ่าน 1 read · โครง `{ rows: { [uid]: row } }`
โดย row ใช้คีย์ย่อ: `n` = ชื่อเล่น · `p` = googlePhoto (อาจเป็น null) · `tb` = towerBest · `g` = guestStatus
ดู `src/utils/roster.js` ฟังก์ชัน `buildRosterRow`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/towerCrowd.test.js`:

```js
// เทส buildFloorCrowd — pure function แปลง roster rows → เพื่อนปักหมุดรายชั้น
// รัน: node --test src/utils/towerCrowd.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFloorCrowd, CROWD_SHOWN } from './towerCrowd.js'

const row = (n, tb, extra = {}) => ({ n, tb, p: null, s: '001', t: 'sci', g: null, ...extra })

test('จัดกลุ่มตาม towerBest — คนละชั้นอยู่คนละคีย์', () => {
  const m = buildFloorCrowd({ a: row('เอ', 5), b: row('บี', 9) }, 'me')
  assert.equal(m.size, 2)
  assert.equal(m.get(5).all.length, 1)
  assert.equal(m.get(9).all[0].name, 'บี')
})

test('กองกันเกิน CROWD_SHOWN → shown ตัดที่ 3, extra นับที่เหลือ', () => {
  const rows = {}
  for (let i = 0; i < 7; i++) rows['u' + i] = row('คน' + i, 12)
  const c = buildFloorCrowd(rows, 'me')
  assert.equal(CROWD_SHOWN, 3)
  assert.equal(c.get(12).shown.length, 3)
  assert.equal(c.get(12).extra, 4)
  assert.equal(c.get(12).all.length, 7)
})

test('กองกันพอดี 3 คน → extra เป็น 0 ไม่ติดลบ', () => {
  const rows = { a: row('เอ', 4), b: row('บี', 4), c: row('ซี', 4) }
  const c = buildFloorCrowd(rows, 'me')
  assert.equal(c.get(4).shown.length, 3)
  assert.equal(c.get(4).extra, 0)
})

test('ตัวเองไม่โผล่ในราง (มี marker แยกอยู่แล้ว)', () => {
  const m = buildFloorCrowd({ me: row('ฉัน', 20), a: row('เอ', 20) }, 'me')
  assert.equal(m.get(20).all.length, 1)
  assert.equal(m.get(20).all[0].uid, 'a')
})

test('guest ติดมาด้วย — รางนับทุกคนใน roster ไม่ใช่เฉพาะนักศึกษา', () => {
  const m = buildFloorCrowd({ g1: row('เกสต์', 7, { g: 'pending', s: null }) }, 'me')
  assert.equal(m.get(7).all.length, 1)
  assert.equal(m.get(7).all[0].name, 'เกสต์')
})

test('tb = 0 / ไม่มี tb / tb ติดลบ → ไม่ปักหมุด', () => {
  const m = buildFloorCrowd({ a: row('เอ', 0), b: { n: 'บี' }, c: row('ซี', -3) }, 'me')
  assert.equal(m.size, 0)
})

test('rows ว่าง / undefined / null → Map ว่าง ไม่ throw', () => {
  assert.equal(buildFloorCrowd({}, 'me').size, 0)
  assert.equal(buildFloorCrowd(undefined, 'me').size, 0)
  assert.equal(buildFloorCrowd(null, 'me').size, 0)
})

test('แถวที่เป็น null ใน rows ไม่ทำให้พัง', () => {
  const m = buildFloorCrowd({ a: null, b: row('บี', 3) }, 'me')
  assert.equal(m.size, 1)
})

test('ลำดับคงที่แม้สลับลำดับ key ขาเข้า (กันวงกระพริบสลับที่ตอน re-render)', () => {
  const a = buildFloorCrowd({ z: row('ซี', 6), a: row('เอ', 6), m: row('เอ็ม', 6) }, 'me')
  const b = buildFloorCrowd({ m: row('เอ็ม', 6), z: row('ซี', 6), a: row('เอ', 6) }, 'me')
  assert.deepEqual(a.get(6).all.map(f => f.uid), b.get(6).all.map(f => f.uid))
})

test('tb เป็นทศนิยม → ปัดลงเป็นชั้นจำนวนเต็ม', () => {
  const m = buildFloorCrowd({ a: row('เอ', 8.9) }, 'me')
  assert.equal(m.get(8).all.length, 1)
})

test('photo มาจาก row.p · ไม่มีก็เป็น null (ให้ view ไป fallback เป็น letterAvatar)', () => {
  const m = buildFloorCrowd({ a: row('เอ', 2, { p: 'https://x/y.jpg' }), b: row('บี', 2) }, 'me')
  const byUid = Object.fromEntries(m.get(2).all.map(f => [f.uid, f.photo]))
  assert.equal(byUid.a, 'https://x/y.jpg')
  assert.equal(byUid.b, null)
})

test('ไม่มีชื่อ → ใช้ "?" ไม่ใช่ undefined', () => {
  const m = buildFloorCrowd({ a: { tb: 3 } }, 'me')
  assert.equal(m.get(3).all[0].name, '?')
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/utils/towerCrowd.test.js`
Expected: FAIL — `Cannot find module './towerCrowd.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/towerCrowd.js`:

```js
// towerCrowd — pure: roster rows → เพื่อนที่ปักหมุดรายชั้นบนเส้นทางหอคอย
//
// อ่านจาก `roster/current`.rows **ดิบ** (ไม่ใช่ members.rosterUsers ซึ่ง key ด้วย studentId
// แล้วตกเพื่อนที่เป็น guest ทั้งหมด — ดู roster.js:rosterToMembers ที่แยก guest ไปอีกอาเรย์)
//
// ตรรกะล้วน ไม่แตะ Firestore/Vue — เทส `node --test src/utils/towerCrowd.test.js`

/** จำนวนวงที่โชว์บนราง ที่เหลือยุบเป็นป้าย +N */
export const CROWD_SHOWN = 3

/**
 * @param {Object} rows   `roster/current`.rows = { [uid]: row }
 *                        row.n ชื่อเล่น · row.p googlePhoto · row.tb towerBest
 * @param {string} meUid  uid ตัวเอง — ตัดออกจากราง (ตัวเองมี marker แยกอยู่แล้ว)
 * @returns {Map<number, {shown: Friend[], extra: number, all: Friend[]}>}
 *          Friend = { uid, name, photo }
 */
export function buildFloorCrowd(rows, meUid) {
  const byFloor = new Map()
  for (const [uid, row] of Object.entries(rows || {})) {
    if (!row || uid === meUid) continue
    const tb = Math.floor(row.tb || 0)
    if (tb < 1) continue                       // ยังไม่เคยชนะสักชั้น = ไม่ปักหมุด
    const list = byFloor.get(tb)
    const friend = { uid, name: row.n || '?', photo: row.p || null }
    if (list) list.push(friend)
    else byFloor.set(tb, [friend])
  }

  const out = new Map()
  for (const [floor, list] of byFloor) {
    // เรียงตามชื่อ (uid เป็นตัวตัดสินสำรอง) → ลำดับคงที่ข้าม render
    // ไม่งั้นลำดับจะตามลำดับคีย์ของ object ที่ Firestore ส่งมา ซึ่งอาจสลับได้ = วงกระพริบสลับที่
    list.sort((a, b) => a.name.localeCompare(b.name, 'th') || a.uid.localeCompare(b.uid))
    out.set(floor, {
      shown: list.slice(0, CROWD_SHOWN),
      extra: Math.max(0, list.length - CROWD_SHOWN),
      all: list,
    })
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/towerCrowd.test.js`
Expected: PASS ทั้ง 12 เทส (`# pass 12` / `# fail 0`)

- [ ] **Step 5: commit**

```bash
git add src/utils/towerCrowd.js src/utils/towerCrowd.test.js
git commit -m "Tower: towerCrowd ตรรกะปักหมุดเพื่อนรายชั้น (อ่าน rosterRows ดิบ กัน guest ตกหล่น)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `TowerPath.vue` — เส้นทางแบบ static + สลับเข้า TowerView

**Files:**
- Create: `src/components/tower/TowerPath.vue`
- Modify: `src/views/TowerView.vue` (ลบบล็อก `.tw-climb` + CSS ของมัน, ใส่ `<TowerPath>` แทน)

**Interfaces:**
- Consumes: ยังไม่ใช้อะไรจาก Task 1 (crowd ต่อใน Task 3)
- Produces:
  - `<TowerPath :floor="Number" :best="Number" :max="Number" :crowd="Map" @pick="(n:Number) => …" />`
  - ค่าคงที่ในไฟล์: `ROW_H = 60`
  - **prop `crowd` รับมาแล้วแต่ยังไม่ใช้ใน task นี้** — Task 3 จะใช้ · ประกาศไว้ก่อนเพื่อไม่ต้องแก้ interface ทีหลัง

**สิ่งที่ต้องเข้าใจก่อนลงมือ:**

1. **แถวเรียงจากชั้นสูงลงต่ำ** — `rows = [100, 99, …, 1]` ชั้น 100 อยู่บนสุด ชั้น 1 ล่างสุด
2. **ซ้าย/ขวาตัดสินจาก `n % 2`** ไม่ใช่จาก index — เลขคี่ = ซ้าย เลขคู่ = ขวา · ผูกกับเลขชั้นเพื่อให้ตำแหน่งไม่ขยับเมื่อ `floor` เปลี่ยน
3. **`content-visibility: auto` บังคับ `contain: paint`** ซึ่ง**คลิปทุกอย่างที่ล้นขอบแถว** → เส้นเชื่อมต้องแบ่งเป็นครึ่งบน (`::before`) + ครึ่งล่าง (`::after`) ที่อยู่ในกรอบแถวทั้งคู่ ห้ามวาดเส้นเดียวคร่อมสองแถว
4. **ทิศของ gradient สลับกับทิศของเส้นที่เห็น** — ใน `linear-gradient` แถบสีตั้งฉากกับแกน ดังนั้น `to bottom right` (แกน `\`) วาดเส้นที่เห็นเป็น `/` และ `to bottom left` วาดเส้น `\` · เขียนตามตารางข้างล่างตรงๆ อย่าเดาเอง

- [ ] **Step 1: สร้าง `src/components/tower/TowerPath.vue`**

```vue
<!--
  TowerPath — เส้นทางไต่หอคอยแนวตั้งซิกแซก 100 ชั้น
  รับ props ล้วน ไม่รู้จัก store ใดๆ (เทสง่าย + ตอนทำ P3 passive ไม่ต้องแตะไฟล์นี้)

  perf doctrine (จากบทเรียน BattleReplay ที่เคยกระตุกบน iOS):
    • เรนเดอร์ครบ 100 แถวเป็น DOM จริง แล้วพึ่ง content-visibility:auto ให้เบราว์เซอร์
      ข้าม layout+paint ของแถวนอกจอเอง — ไม่ virtualize เพราะต้องผูก scroll listener
      ซึ่งบน iOS momentum scroll เสี่ยงเรนเดอร์ไม่ทันเป็นช่องว่างขาว
    • ทุกแถวสูง ROW_H เท่ากันเป๊ะ → contain-intrinsic-size ตรงจริง = ไม่มี scrollbar กระตุก
    • ห้ามผูก scroll event · IntersectionObserver / ResizeObserver ใช้ได้ (ไม่ยิงตอน scroll)
-->
<template>
  <div class="tp">
    <div class="tp-head">
      <span>
        <span class="tp-floor">ชั้น {{ floor }}</span><span class="tp-of"> / {{ max }}</span>
      </span>
      <span class="tp-head-r">
        <span class="tp-best">สูงสุด {{ best }}</span>
        <button v-if="offscreen" class="tp-recenter" @click="centerOnCurrent(true)">
          ↓ ไปชั้นฉัน
        </button>
      </span>
    </div>

    <div ref="boxEl" class="tp-box" role="list"
         :aria-label="`เส้นทางหอคอย ${max} ชั้น ตอนนี้อยู่ชั้น ${floor}`">
      <div class="tp-inner">
        <div v-for="n in rows" :key="n" class="tp-row" :class="rowClass(n)"
             :style="lineStyle(n)" role="listitem">
          <button class="tp-node" :class="{ milestone: isMilestone(n) }"
                  :style="nodeStyle(n)"
                  :aria-label="labelOf(n)"
                  :aria-current="n === floor ? 'step' : null"
                  :data-current="n === floor ? '' : null"
                  @click="$emit('pick', n)">
            <span v-if="isMilestone(n)" class="tp-coin"><Emoji char="🪙" /></span>
            <span class="tp-ico"><Emoji :char="iconOf(n)" /></span>
            <span class="tp-n">{{ n }}</span>
          </button>
        </div>

        <!-- marker ผู้เล่น: absolute นอกแถว → ไม่โดน paint containment ของแถวคลิป
             X ต้องพึ่งความกว้างกล่อง (ระยะขอบเป็น %) จึงวัดครั้งเดียวด้วย ResizeObserver
             X กับ Y ต้องอยู่ใน transform เดียวกัน ไม่งั้นตอน Task 5 marker จะวาร์บแนวนอน -->
        <div class="tp-marker" :style="markerStyle" aria-hidden="true">
          <span class="tp-marker-in"><Emoji char="🧗" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { floorZone, TOWER_BONUS_FLOORS } from '../../data/towerFloors.js'

const ROW_H  = 60
const NODE_W = 108
const MARKER = 30
const PAD    = 0.08     // = 8% ต้องตรงกับ --tp-pad ใน CSS ข้างล่าง
const GAP    = 6        // ระยะห่างระหว่างขอบโหนดกับ marker

const props = defineProps({
  floor: { type: Number, required: true },
  best:  { type: Number, required: true },
  max:   { type: Number, required: true },
  crowd: { type: Map, default: () => new Map() },   // ใช้จริงใน Task 3
})
defineEmits(['pick'])

const boxEl = ref(null)
const boxW  = ref(0)

// ชั้นสูงอยู่บน → ไล่ลงมาชั้น 1
const rows = computed(() => Array.from({ length: props.max }, (_, i) => props.max - i))

const isMilestone = (n) => TOWER_BONUS_FLOORS.includes(n)
const isLeft      = (n) => n % 2 === 1
const zoneColor   = (n) => floorZone(n).color

function rowClass(n) {
  return [
    isLeft(n) ? 'l' : 'r',
    n <= props.best ? 'done' : n === props.floor ? 'now' : 'lock',
  ]
}

// พื้นโหนดที่ผ่านแล้ว = สีโซนจาง (ต่อท้าย 40 = alpha ~25% แบบเดียวกับแถบเดิมที่ถูกแทนที่)
function nodeStyle(n) {
  return n <= props.best ? { background: zoneColor(n) + '40' } : null
}

// สีเส้นเชื่อม 2 ครึ่ง แยกกันเพราะคนละช่วงการเดินทาง:
//   ครึ่งบน (::before) = ช่วง n ↔ n+1 → ผ่านแล้วเมื่อพิชิตชั้น n สำเร็จ    → n <= best
//   ครึ่งล่าง (::after) = ช่วง n ↔ n-1 → ผ่านแล้วเมื่อพิชิตชั้น n-1 สำเร็จ → n <= best + 1
function lineStyle(n) {
  return {
    '--tp-up': n <= props.best     ? zoneColor(n) : '#e2e8f0',
    '--tp-dn': n <= props.best + 1 ? zoneColor(n) : '#e2e8f0',
  }
}

const iconOf = (n) => (n <= props.best ? '✅' : n === props.floor ? '⚔️' : '🔒')

function labelOf(n) {
  const state = n <= props.best ? 'ผ่านแล้ว' : n === props.floor ? 'กำลังท้าทาย' : 'ยังไม่ปลดล็อก'
  const c = props.crowd?.get(n)
  return `ชั้น ${n} ${state}` + (c ? ` เพื่อน ${c.all.length} คนอยู่ชั้นนี้` : '')
}

// ── marker ──────────────────────────────────────────────
// Y = แถวของชั้นนั้น + จัดกึ่งกลางแนวตั้งในแถว
// X = กึ่งกลาง marker ที่วางชิดด้านนอกโหนดฝั่งเดียวกัน
const markerStyle = computed(() => {
  const w = boxW.value
  const y = (props.max - props.floor) * ROW_H + (ROW_H - MARKER) / 2
  const off = PAD * w + NODE_W + GAP
  const x = isLeft(props.floor) ? off : w - off - MARKER
  return { transform: `translate3d(${Math.round(x)}px, ${y}px, 0)` }
})

// ── scroll ให้ชั้นปัจจุบันอยู่กลางกล่อง ──────────────────
// คำนวณตรงจากสูตร ไม่ใช้ scrollIntoView → ตั้งได้ก่อนเฟรมแรก ไม่มีอาการวาบจากชั้นบนสุด
function reduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
function centerOnCurrent(smooth = false) {
  const box = boxEl.value
  if (!box) return
  const y = (props.max - props.floor) * ROW_H - box.clientHeight / 2 + ROW_H / 2
  box.scrollTo({
    top: Math.max(0, y),
    behavior: smooth && !reduceMotion() ? 'smooth' : 'auto',
  })
}

// ── ปุ่ม "ไปชั้นฉัน" — โผล่เมื่อชั้นปัจจุบันหลุดจอ ────────
// ⚠️ โหนดปัจจุบันเปลี่ยน element เมื่อ floor เปลี่ยน → ต้อง re-observe ทุกครั้ง
//    (บั๊กแบบเดียวกับ FX re-attach ใน BattleReplay ที่เคยทำเอฟเฟกต์หายตั้งแต่ไฟต์ที่ 2)
const offscreen = ref(false)
let io = null
function attachObserver() {
  io?.disconnect()
  io = null
  offscreen.value = false
  const box = boxEl.value
  if (!box || typeof IntersectionObserver === 'undefined') return
  const el = box.querySelector('[data-current]')
  if (!el) return
  io = new IntersectionObserver(
    ([e]) => { offscreen.value = !e.isIntersecting },
    { root: box, threshold: 0.5 },
  )
  io.observe(el)
}

let ro = null
onMounted(() => {
  boxW.value = boxEl.value?.clientWidth || 0
  centerOnCurrent(false)
  attachObserver()
  if (typeof ResizeObserver !== 'undefined' && boxEl.value) {
    // ยิงตอน mount + ตอนหมุนจอ — ไม่ยิงตอน scroll
    ro = new ResizeObserver(([e]) => { boxW.value = e.contentRect.width })
    ro.observe(boxEl.value)
  }
})
onBeforeUnmount(() => { io?.disconnect(); ro?.disconnect() })

watch(() => props.floor, () => { nextTick(attachObserver) })
</script>

<style scoped>
.tp {
  background: #fff; border: 2px solid var(--ink); border-radius: 16px;
  box-shadow: var(--pop); margin-bottom: 12px; overflow: hidden;
}

.tp-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 9px 12px; border-bottom: 2px solid var(--ink); background: #fff;
}
.tp-floor { font-weight: 800; font-size: .9rem; color: var(--ink); }
.tp-of    { font-weight: 700; font-size: .78rem; color: var(--muted); }
.tp-head-r { display: flex; align-items: center; gap: 8px; }
.tp-best  { font-size: .72rem; font-weight: 700; color: var(--muted); }
.tp-recenter {
  border: 1.5px solid var(--ink); background: var(--gold); border-radius: 999px;
  padding: 4px 9px; font-family: inherit; font-size: .72rem; font-weight: 800;
  color: var(--ink); cursor: pointer; white-space: nowrap;
}
.tp-recenter:active { transform: translate(1px, 1px); }

.tp-box {
  height: clamp(300px, 45vh, 440px);
  overflow-y: auto;
  overscroll-behavior: contain;   /* กันเลื่อนทะลุไปดันหน้าหลัก */
  background: var(--bg);
}
.tp-inner { position: relative; }

/* ── แถว ────────────────────────────────────────────────
   --tp-pad ต้องตรงกับค่า PAD ใน <script setup> (marker พึ่งค่าเดียวกัน)
   content-visibility: auto → ข้าม layout+paint ของแถวนอกจอ
   ⚠️ มันบังคับ contain:paint ด้วย = คลิปทุกอย่างที่ล้นขอบแถว
      เส้นเชื่อมจึงต้องแบ่งครึ่งบน/ครึ่งล่างให้อยู่ในกรอบตัวเอง ห้ามวาดคร่อมสองแถว */
.tp-row {
  --tp-pad: 8%;
  position: relative;
  height: 60px;
  display: flex; align-items: center;
  content-visibility: auto;
  contain-intrinsic-size: auto 60px;
}
.tp-row.l { justify-content: flex-start; padding-left: var(--tp-pad); }
.tp-row.r { justify-content: flex-end;   padding-right: var(--tp-pad); }

/* ── เส้นเชื่อมทแยง ─────────────────────────────────────
   แถบสีใน linear-gradient ตั้งฉากกับแกน → ทิศแกนสลับกับเส้นที่เห็น:
     to bottom right (แกน \) → เห็นเป็นเส้น /
     to bottom left  (แกน /) → เห็นเป็นเส้น \
   กล่องแต่ละครึ่งกินจากกลางโหนด (var(--tp-pad) + ครึ่งความกว้างโหนด) ถึงกึ่งกลางแถว 50% */
.tp-row::before, .tp-row::after { content: ''; position: absolute; pointer-events: none; }
.tp-row::before { top: 0;   height: 50%; }
.tp-row::after  { top: 50%; height: 50%; }

.tp-row.l::before, .tp-row.l::after { left: calc(var(--tp-pad) + 54px); right: 50%; }
.tp-row.r::before, .tp-row.r::after { left: 50%; right: calc(var(--tp-pad) + 54px); }

/* ซ้าย-ครึ่งบน: กึ่งกลางแถวอยู่มุมบนขวา → โหนดมุมล่างซ้าย = เส้น / */
.tp-row.l::before {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 2px), var(--tp-up) calc(50% - 2px),
    var(--tp-up) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ซ้าย-ครึ่งล่าง: โหนดมุมบนซ้าย → กึ่งกลางแถวมุมล่างขวา = เส้น \ */
.tp-row.l::after {
  background-image: linear-gradient(to bottom left,
    transparent calc(50% - 2px), var(--tp-dn) calc(50% - 2px),
    var(--tp-dn) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ขวา-ครึ่งบน: กึ่งกลางแถวมุมบนซ้าย → โหนดมุมล่างขวา = เส้น \ */
.tp-row.r::before {
  background-image: linear-gradient(to bottom left,
    transparent calc(50% - 2px), var(--tp-up) calc(50% - 2px),
    var(--tp-up) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ขวา-ครึ่งล่าง: โหนดมุมบนขวา → กึ่งกลางแถวมุมล่างซ้าย = เส้น / */
.tp-row.r::after {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 2px), var(--tp-dn) calc(50% - 2px),
    var(--tp-dn) calc(50% + 2px), transparent calc(50% + 2px));
}
/* แถวบนสุดไม่มีชั้นเหนือขึ้นไป · แถวล่างสุดไม่มีชั้นใต้ลงมา */
.tp-row:first-child::before { display: none; }
.tp-row:last-child::after   { display: none; }

/* ── โหนด ───────────────────────────────────────────────
   ขนาดคงที่ทุกสถานะ → เปลี่ยนสถานะไม่ทำให้เกิด layout shift */
.tp-node {
  position: relative; z-index: 1;
  width: 108px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  border: 2px solid var(--ink); border-radius: 12px;
  background: #f1f5f9; box-shadow: var(--pop);
  font-family: inherit; cursor: pointer;
}
.tp-node:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.tp-ico { font-size: 1rem; line-height: 1; }
.tp-n   { font-size: .78rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }

.tp-row.lock .tp-node { opacity: .6; }
.tp-row.now  .tp-node { background: var(--gold); border-width: 3px; box-shadow: 4px 4px 0 var(--ink); }
.tp-node.milestone { outline: 2px dashed var(--gold); outline-offset: 2px; }
.tp-coin { position: absolute; top: -8px; right: -6px; font-size: .72rem; line-height: 1; }

/* ── marker ผู้เล่น ─────────────────────────────────────
   absolute ที่ .tp-inner → ไม่โดน paint containment ของแถว
   transform เดียวถือทั้ง X และ Y (Task 5 จะใส่ transition ที่นี่) */
.tp-marker {
  position: absolute; top: 0; left: 0;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.tp-marker-in {
  font-size: 1.35rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 999px; background: var(--gold); border: 2px solid var(--ink);
}
</style>
```

- [ ] **Step 2: แก้ `src/views/TowerView.vue` — template**

ลบบล็อก `<!-- แถบไต่ชั้น v2 ... -->` ทั้งก้อน (`<div class="tw-climb">` … `</div>` ปิดของมัน) แล้วใส่แทนที่:

```html
      <TowerPath :floor="floor" :best="best" :max="TOWER_MAX" @pick="() => {}" />
```

(`@pick` เป็น no-op ชั่วคราว — Task 4 จะต่อเข้า FloorSheet)

- [ ] **Step 3: แก้ `src/views/TowerView.vue` — script**

เพิ่ม import:

```js
import TowerPath from '../components/tower/TowerPath.vue'
```

แก้บรรทัด import ของ `towerFloors.js` ให้เหลือเฉพาะที่ยังใช้:

```js
import { floorZone, BONUS_CAP_FLOOR } from '../data/towerFloors.js'
```

ลบ computed/helper ที่ไม่มีคนเรียกแล้ว: `trackPct`, `climbFloors`, `isMilestone`

- [ ] **Step 4: แก้ `src/views/TowerView.vue` — ลบ CSS ที่ตายแล้ว**

ลบทุกกฎที่ขึ้นต้นด้วย selector เหล่านี้ออกจาก `<style scoped>`:
`.tw-climb`, `.tw-climb-head`, `.tw-climb-floor`, `.tw-climb-of`, `.tw-climb-best`,
`.tw-track-wrap`, `.tw-pin`, `.tw-track`, `.tw-track-fill`, `.tw-track-fill-inner`,
`.tw-track-crown`, `.tw-me`, `.tw-track-scale`, `.tw-scale-1`, `.tw-scale-70`, `.tw-scale-100`,
`.tw-climb-row`, `.tw-chip`, `.tw-chip-n`, `.tw-chip.cleared`, `.tw-chip.current`,
`.tw-chip.locked`, `.tw-chip.milestone`, `.tw-chip-coin`

- [ ] **Step 5: ตรวจว่าไม่มีซากอ้างอิงค้าง**

```bash
grep -nE "tw-climb|tw-track|tw-chip|tw-pin|tw-me|tw-scale|trackPct|climbFloors|isMilestone" src/views/TowerView.vue
```
Expected: ไม่มีผลลัพธ์ (exit 1)

```bash
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```
Expected: ไม่มีผลลัพธ์

- [ ] **Step 6: build**

Run: `npm run build`
Expected: สำเร็จ ไม่มี error/warning ใหม่

- [ ] **Step 7: ตรวจด้วยตาใน dev**

Run: `npm run dev` แล้วเปิด `/#/play/tower` (ต้องล็อกอิน)
ตรวจ:
- เส้นทางซิกแซกโผล่ ชั้น 100 บนสุด ชั้น 1 ล่างสุด
- **ชั้นปัจจุบันอยู่กลางกล่องตั้งแต่เฟรมแรก** ไม่วาบจากชั้น 100 แล้วค่อยไถลง
- เส้นทแยงต่อกันสนิทระหว่างแถว **ไม่ขาดตอนตรงรอยต่อ** (ถ้าขาด = ทิศ gradient สลับ ให้เทียบตารางในคอมเมนต์ CSS)
- เลื่อนขึ้น-ลงยาวๆ ด้วยนิ้ว → ไม่มีช่องว่างขาว ไม่กระตุก
- เลื่อนออกห่างชั้นปัจจุบัน → ปุ่ม "↓ ไปชั้นฉัน" โผล่ · กดแล้วเลื่อนกลับ · ปุ่มหายไป
- marker 🧗 อยู่ชิดด้านนอกโหนดชั้นปัจจุบัน ฝั่งเดียวกับโหนด
- หมุนจอแนวนอน → marker ยังอยู่ตำแหน่งถูก (ResizeObserver ทำงาน)
- โหนดที่ผ่านแล้วมีสีโซนไล่ 5 ช่วงตอนเลื่อนย้อนดู

- [ ] **Step 8: commit**

```bash
git add src/components/tower/TowerPath.vue src/views/TowerView.vue
git commit -m "Tower: เส้นทางไต่แนวตั้งซิกแซก 100 ชั้น แทนแถบแนวนอน+ชิป 6 ก้อน (เห็นทั้งหอในจอเดียว)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: เพื่อนบนเส้นทาง + แก้การ์ดเทียบเพื่อนให้นับตรงกัน

**Files:**
- Modify: `src/components/tower/TowerPath.vue` (เพิ่มรางเพื่อนในแถว)
- Modify: `src/views/TowerView.vue` (computed `crowd`, ส่ง prop, แก้ `rivals` ให้อ่าน `rosterRows`)

**Interfaces:**
- Consumes: `buildFloorCrowd(rows, meUid)` และ `CROWD_SHOWN` จาก Task 1 · `<TowerPath>` prop `crowd` จาก Task 2
- Produces: รางเพื่อน emit `pick(n)` **ตัวเดียวกับที่โหนด emit** (เปิดแผงเดียวกันใน Task 4)

**พื้นหลัง:** `membersStore.rosterRows` คือ `{ [uid]: row }` ดิบจาก `roster/current`
ต่างจาก `membersStore.rosterUsers` ที่ key ด้วย `studentId` แล้ว**ตกเพื่อนที่เป็น guest ทั้งหมด**
`utils/avatar.js` มี `letterAvatar(name, size)` (data-URI SVG ไม่ยิงเน็ต) กับ `fallbackAvatar(e, name, size)` (ใช้กับ `@error`)

- [ ] **Step 1: เพิ่มรางเพื่อนใน `TowerPath.vue` — template**

ใส่ต่อจาก `</button>` ของ `.tp-node` (ยังอยู่ใน `<div class="tp-row">` เดิม):

```html
          <button v-if="crowdOf(n)" class="tp-rail"
                  :aria-label="`เพื่อน ${crowdOf(n).all.length} คนอยู่ชั้น ${n}`"
                  @click="$emit('pick', n)">
            <img v-for="f in crowdOf(n).shown" :key="f.uid" class="tp-face"
                 :src="f.photo || letterAvatar(f.name, 52)" :alt="''"
                 width="26" height="26" loading="lazy" decoding="async"
                 @error="fallbackAvatar($event, f.name, 52)" />
            <span v-if="crowdOf(n).extra" class="tp-more">+{{ crowdOf(n).extra }}</span>
          </button>
```

- [ ] **Step 2: เพิ่ม script ของ `TowerPath.vue`**

เพิ่ม import:

```js
import { letterAvatar, fallbackAvatar } from '../../utils/avatar.js'
```

เพิ่ม helper (วางใกล้ `labelOf`):

```js
const crowdOf = (n) => props.crowd?.get(n) || null
```

- [ ] **Step 3: เพิ่ม CSS ของราง**

ต่อท้าย `<style scoped>` ก่อนบล็อก marker:

```css
/* ── รางเพื่อน ──────────────────────────────────────────
   อยู่ฝั่งตรงข้ามโหนดเสมอ → ไม่มีทางทับโหนด
   รางทั้งรางเป็นปุ่มเดียว emit('pick', n) ตัวเดียวกับโหนด — เปิดแผงเดียวกัน */
.tp-rail {
  position: absolute; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center;
  border: none; background: none; padding: 2px; cursor: pointer;
}
.tp-row.l .tp-rail { right: var(--tp-pad); }
.tp-row.r .tp-rail { left:  var(--tp-pad); }
.tp-rail:active { transform: translateY(-50%) scale(.94); }

.tp-face {
  width: 26px; height: 26px; flex-shrink: 0;
  border-radius: 999px; border: 2px solid #fff; background: #cbd5e1;
  object-fit: cover; display: block;
}
.tp-face + .tp-face { margin-left: -9px; }
.tp-more {
  margin-left: 4px; padding: 1px 6px; border-radius: 999px;
  background: var(--ink); color: #fff;
  font-size: .72rem; font-weight: 800; line-height: 1.5;
}
```

- [ ] **Step 4: `TowerView.vue` — เพิ่ม computed `crowd` และส่ง prop**

เพิ่ม import:

```js
import { buildFloorCrowd } from '../utils/towerCrowd.js'
```

เพิ่ม computed **เหนือ computed `rivals` เดิม** (Step 5 จะแก้ `rivals` ให้เรียก `meUid` —
วางไว้ใต้ `rivals` จะอ่านยากและสลับลำดับตอน refactor ทีหลังได้ง่าย):

```js
const meUid = computed(() => authStore.currentUser?.uid || '')
// เพื่อนปักหมุดรายชั้น — อ่าน rosterRows ดิบ (rosterUsers key ด้วย studentId แล้วตก guest)
const crowd = computed(() => buildFloorCrowd(membersStore.rosterRows, meUid.value))
```

แก้แท็ก `<TowerPath>` ให้ส่ง crowd:

```html
      <TowerPath :floor="floor" :best="best" :max="TOWER_MAX" :crowd="crowd" @pick="() => {}" />
```

- [ ] **Step 5: `TowerView.vue` — แก้ `rivals` ให้อ่านแหล่งเดียวกัน**

แทนที่ computed `rivals` เดิมทั้งก้อนด้วย:

```js
// แถบเทียบเพื่อน — best-effort ทั้งชุด: ไม่มีข้อมูล/total 0 → คืน null (การ์ดซ่อนทั้งใบ)
// อ่าน rosterRows ดิบให้ตรงกับเส้นทางหอคอย — เดิมอ่าน rosterUsers ซึ่ง key ด้วย studentId
// จึงตกเพื่อนที่เป็น guest ทำให้หน้าเดียวกันนับเพื่อนได้ไม่เท่ากันสองที่
const rivals = computed(() => {
  const me = meUid.value || 'me'
  const others = Object.entries(membersStore.rosterRows || {})
    .filter(([uid, r]) => r && uid !== me)
    .map(([uid, r]) => ({ uid, nickname: r.n || '?', towerBest: r.tb || 0 }))
  if (!others.length) return null
  const u = authStore.userData || {}
  const r = towerRanking(others, { uid: me, nickname: u.nickname || 'ฉัน', towerBest: best.value })
  return r.total > 0 ? r : null
})
```

- [ ] **Step 6: ตรวจว่าไม่มีใครอ้าง `rosterUsers` ใน TowerView แล้ว**

```bash
grep -n "rosterUsers" src/views/TowerView.vue
```
Expected: ไม่มีผลลัพธ์ (exit 1)

- [ ] **Step 7: build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 8: ตรวจด้วยตาใน dev**

- วงเพื่อนโผล่ที่ชั้นตาม `towerBest` ของแต่ละคน ฝั่งตรงข้ามโหนด
- ชั้นที่มีคนเยอะ → เห็น 3 วงซ้อนกัน + ป้าย `+N`
- **ตัวเองไม่โผล่ในราง** (มี marker 🧗 แยกอยู่แล้ว)
- คนที่ไม่มี googlePhoto → เห็นวงตัวอักษรย่อ ไม่ใช่รูปแตก
- เปิด DevTools → Network → เลื่อนเส้นทาง: รูปทยอยโหลดตอนเข้าจอ ไม่ใช่โหลดหมดตั้งแต่แรก
- ถ้าชั้นปัจจุบันบังเอิญมีเพื่อนอยู่ด้วย: **marker กับรางต้องไม่ทับกัน** — ลองย่อจอเหลือ 320px กว้าง (ช่องว่างแคบสุดตรงนี้)
- การ์ด "เพื่อนร่วมไต่" ด้านล่างยังทำงานปกติ และจำนวนคนสอดคล้องกับที่เห็นบนเส้นทาง

- [ ] **Step 9: commit**

```bash
git add src/components/tower/TowerPath.vue src/views/TowerView.vue
git commit -m "Tower: ปักหมุดเพื่อนบนเส้นทาง + การ์ดเทียบเพื่อนอ่าน rosterRows (เดิมตก guest)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `FloorSheet.vue` — แผงรายละเอียดชั้น

**Files:**
- Create: `src/components/tower/FloorSheet.vue`
- Modify: `src/views/TowerView.vue` (state `sheetFloor`, ต่อ `@pick`, ต่อ `@fight`)

**Interfaces:**
- Consumes: `@pick(n)` จาก `TowerPath` (Task 2/3) · `crowd` Map จาก Task 3
- Produces: `<FloorSheet :floor="Number|null" :crowd="Map" :current-floor="Number" @close="…" @fight="…" />`

**พื้นหลัง:**
- `components/shared/BottomSheet.vue` รับ `open` / `icon` / `title` และ emit `update:open` — **จัดการ `Teleport to="body"` + ปุ่มปิด + Escape ให้แล้ว** ห้ามเขียน overlay เอง (CLAUDE.md ข้อ 6)
- `getFloorTeam(n)` คืน `[{ id, rarity, element, grade }]` · `getTowerBonus(n)` คืนเหรียญ/วัน · `floorZone(n)` คืน `{ name, art, color, royal? }`
- `PetThumb` รับ `pet` (instance) และ**เติมเต็มกล่องพ่อแม่** — parent ต้องคุมขนาด

- [ ] **Step 1: สร้าง `src/components/tower/FloorSheet.vue`**

```vue
<!--
  FloorSheet — แผงรายละเอียดชั้นหอคอย (แตะโหนดหรือแตะรางเพื่อนก็เปิดอันนี้)
  ทุกอย่างคำนวณฝั่ง client จาก towerFloors.js — 0 Firestore read
  ใช้ BottomSheet ที่ Teleport ไป body ให้แล้ว (ห้ามเขียน overlay เอง — CLAUDE.md ข้อ 6)
-->
<template>
  <BottomSheet :open="floor !== null" :icon="zone.art"
               :title="`ชั้น ${floor ?? ''} · ${zone.name}`"
               @update:open="$emit('close')">
    <div class="fs">
      <div class="fs-bonus">
        <Emoji char="🪙" /> พิชิตถึงชั้นนี้ = โบนัสรายได้ +{{ bonus.toLocaleString() }}/วัน
      </div>

      <div class="fs-sec">ศัตรูที่รออยู่</div>
      <div class="fs-team">
        <div v-for="(p, i) in botTeam" :key="i" class="fs-mon"><PetThumb :pet="p" /></div>
      </div>

      <div v-if="friends.length" class="fs-sec">เพื่อนที่พิชิตถึงชั้นนี้ ({{ friends.length }})</div>
      <ul v-if="friends.length" class="fs-friends">
        <li v-for="f in friends" :key="f.uid" class="fs-friend">
          <img class="fs-face" :src="f.photo || letterAvatar(f.name, 52)" :alt="''"
               width="28" height="28" loading="lazy" decoding="async"
               @error="fallbackAvatar($event, f.name, 52)" />
          <span class="fs-name">{{ f.name }}</span>
        </li>
      </ul>

      <button v-if="floor === currentFloor" class="fs-fight" @click="$emit('fight')">
        <Emoji char="⚔️" /> สู้ชั้นนี้
      </button>
    </div>
  </BottomSheet>
</template>

<script setup>
import { computed } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'
import PetThumb from '../shared/PetThumb.vue'
import Emoji from '../shared/Emoji.vue'
import { letterAvatar, fallbackAvatar } from '../../utils/avatar.js'
import { floorZone, getFloorTeam, getTowerBonus } from '../../data/towerFloors.js'

const props = defineProps({
  floor:        { type: Number, default: null },     // null = ปิด
  crowd:        { type: Map,    default: () => new Map() },
  currentFloor: { type: Number, required: true },
})
defineEmits(['close', 'fight'])

// floor เป็น null ตอนปิด → fallback ชั้น 1 กัน floorZone/getFloorTeam พัง
const safe    = computed(() => props.floor ?? 1)
const zone    = computed(() => floorZone(safe.value))
const botTeam = computed(() => getFloorTeam(safe.value))
const bonus   = computed(() => getTowerBonus(safe.value))
const friends = computed(() => props.crowd?.get(safe.value)?.all || [])
</script>

<style scoped>
.fs { display: flex; flex-direction: column; gap: 10px; }
.fs-bonus {
  padding: 8px 10px; border-radius: 10px;
  background: #fffbeb; border: 1.5px solid var(--gold);
  font-size: .78rem; font-weight: 700; color: #b45309;
  display: flex; align-items: center; gap: 5px;
}
.fs-sec { font-size: .76rem; font-weight: 800; color: var(--muted); margin-top: 2px; }
.fs-team { display: flex; gap: 8px; }
.fs-mon { width: 58px; flex-shrink: 0; }

.fs-friends { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.fs-friend {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 9px 4px 4px; border-radius: 999px; background: #f1f5f9;
}
.fs-face { width: 28px; height: 28px; border-radius: 999px; background: #cbd5e1; object-fit: cover; display: block; }
.fs-name { font-size: .78rem; font-weight: 700; color: var(--ink); }

.fs-fight {
  margin-top: 4px; border: 2px solid var(--ink); border-radius: 12px;
  padding: 12px; min-height: 44px;
  font-family: inherit; font-size: .92rem; font-weight: 800;
  color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.fs-fight:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
</style>
```

- [ ] **Step 2: `TowerView.vue` — ต่อ state และ handler**

เพิ่ม import:

```js
import FloorSheet from '../components/tower/FloorSheet.vue'
```

เพิ่ม state (ใกล้ `pickOpen`):

```js
const sheetFloor = ref(null)
```

เพิ่มฟังก์ชัน (ใกล้ `onFight`):

```js
// กด "สู้ชั้นนี้" ในแผง → ปิดแผงแล้วยิงศึกเลย (ปุ่มโผล่เฉพาะตอนเป็นชั้นปัจจุบันอยู่แล้ว)
function onSheetFight() {
  sheetFloor.value = null
  onFight()
}
```

- [ ] **Step 3: `TowerView.vue` — ต่อ template**

แก้แท็ก `<TowerPath>`:

```html
      <TowerPath :floor="floor" :best="best" :max="TOWER_MAX" :crowd="crowd"
                 @pick="sheetFloor = $event" />
```

เพิ่มข้างๆ modal อื่นๆ ท้ายไฟล์ (ใกล้ `<PetDetailModal …>`):

```html
    <FloorSheet :floor="sheetFloor" :crowd="crowd" :current-floor="floor"
                @close="sheetFloor = null" @fight="onSheetFight" />
```

- [ ] **Step 4: build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 5: ตรวจด้วยตาใน dev**

- แตะโหนดชั้นใดก็ได้ (ผ่านแล้ว / ปัจจุบัน / ล็อก) → แผงเปิด แสดงชื่อโซนถูก
- **`#bottom-nav` ไม่ทับก้นแผง** (ถ้าทับ = BottomSheet ถูกแก้ผิด หรือมีคนเขียน overlay เอง)
- ทีมบอทในแผงตรงกับที่การ์ดสู้แสดง เมื่อเปิดแผงของชั้นปัจจุบัน
- แตะรางเพื่อน → เปิดแผงเดียวกัน มีรายชื่อครบทุกคน
- ชั้นที่มีเพื่อนเป็นสิบคน → รายชื่อเลื่อนได้ในแผง ไม่ล้น
- ปุ่ม "⚔️ สู้ชั้นนี้" โผล่**เฉพาะ**ชั้นปัจจุบัน · กดแล้วแผงปิดและเริ่มสู้จริง
- กด Escape / แตะพื้นหลัง / กด ✕ → แผงปิด
- แตะชั้น 1 กับชั้น 100 → ไม่ error (ขอบเขต)

- [ ] **Step 6: commit**

```bash
git add src/components/tower/FloorSheet.vue src/views/TowerView.vue
git commit -m "Tower: แผงรายละเอียดชั้น — ดูศัตรู/โบนัส/เพื่อนล่วงหน้าได้ทุกชั้น (0 read เพิ่ม)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: อนิเมชันไต่ขึ้นหลังชนะ

**Files:**
- Modify: `src/views/TowerView.vue` (หน่วง `displayFloor`/`displayBest` ระหว่าง replay)
- Modify: `src/components/tower/TowerPath.vue` (ซีเควนซ์ไต่)

**Interfaces:**
- Consumes: `<TowerPath>` props `floor`/`best` จาก Task 2 — เปลี่ยนแหล่งจาก `floor`/`best` (store) เป็น `displayFloor`/`displayBest` (หน่วง)
- Produces: `reduceMotion()` helper ใน `TowerPath.vue` (Task 6 ใช้ต่อ)

**ปัญหาลำดับเวลาที่ต้องแก้ (อ่านให้เข้าใจก่อนเขียน):**

`fight()` ใน `useTower.js` เรียก `auth.patchUser(...)` แบบ optimistic → `floor` ในสโตร์ขยับ**ทันที**
ตั้งแต่ BattleReplay ยังไม่ทันเปิดด้วยซ้ำ ถ้าปล่อยตามนั้น พอปิด replay มา marker จะอยู่ที่ใหม่เรียบร้อยแล้ว
ไม่มีอะไรให้ดู

**ห้ามพึ่งจังหวะของ Vue watcher มาช่วย** — ต้องตั้งธง `holdPath` **ก่อน** `await fight()`
เพราะ `patchUser` เสร็จแล้ว `replay.value = r` อาจอยู่ใน microtask chain เดียวกัน ทำให้เช็ค
"replay เปิดอยู่ไหม" ใน watcher ไม่ทัน

- [ ] **Step 1: `TowerView.vue` — เพิ่ม state หน่วง**

เพิ่มใกล้ `const busy = ref(false)`:

```js
// path หน่วงตามหลัง store: patchUser ใน fight() ขยับ floor ทันทีตั้งแต่ replay ยังไม่เปิด
// ถ้าไม่หน่วง marker จะไปถึงที่ใหม่ก่อนคนดูจะเห็น = ไม่มีอนิเมชันไต่ให้ดู
const holdPath    = ref(false)
const displayFloor = ref(floor.value)
const displayBest  = ref(best.value)

watch([floor, best], ([f, b]) => {
  if (holdPath.value) return
  displayFloor.value = f
  displayBest.value  = b
})

// ปล่อยค่าที่หน่วงไว้ → TowerPath เห็น floor เพิ่มขึ้น แล้วเล่นซีเควนซ์ไต่เอง
function releasePath() {
  holdPath.value     = false
  displayFloor.value = floor.value
  displayBest.value  = best.value
}
```

เพิ่ม `watch` เข้า import ของ vue:

```js
import { ref, computed, onMounted, watch } from 'vue'
```

- [ ] **Step 2: `TowerView.vue` — แก้ `onFight` และการปิด replay**

แทนที่ `onFight` เดิมด้วย:

```js
async function onFight() {
  if (busy.value) return
  busy.value = true
  holdPath.value = true          // ต้องตั้งก่อน await — patchUser ข้างใน fight() ขยับ floor ทันที
  try {
    const r = await fight()
    if (r) replay.value = r      // ทั้งชนะและแพ้มี replay → ปล่อย path ตอนปิด replay
    else releasePath()           // fight() คืน null (ยังไม่ได้จัดทีม) → ปล่อยเลย
  } catch (e) {
    releasePath()
    throw e
  } finally {
    busy.value = false
  }
}

function onReplayClose() {
  replay.value = null
  releasePath()
}
```

แก้ template ของ `BattleReplay`:

```html
    <BattleReplay :data="replay" theme="tower" @close="onReplayClose" />
```

- [ ] **Step 3: `TowerView.vue` — ให้ TowerPath กินค่าที่หน่วงแล้ว**

```html
      <TowerPath :floor="displayFloor" :best="displayBest" :max="TOWER_MAX" :crowd="crowd"
                 @pick="sheetFloor = $event" />
```

> หมายเหตุ: การ์ดสู้ ปุ่มสู้ และการ์ดเทียบเพื่อนยังใช้ `floor`/`best` สดเหมือนเดิม — หน่วงเฉพาะเส้นทาง

- [ ] **Step 4: `TowerPath.vue` — เพิ่มซีเควนซ์ไต่**

เพิ่ม state และฟังก์ชันใน `<script setup>` (วางต่อจากบล็อก marker):

```js
// ── ซีเควนซ์ไต่ขึ้นหนึ่งขั้น ─────────────────────────────
// ขับด้วยการที่ prop floor เพิ่มขึ้น (TowerView หน่วงไว้จนปิด BattleReplay แล้วค่อยปล่อย)
const climbing  = ref(false)
const popFloor  = ref(0)     // ชั้นที่เพิ่งผ่าน — เด้งตอนพลิกเป็น ✅
const fillFloor = ref(0)     // ชั้นที่เส้นเชื่อมกำลังไล่สี

let timers = []
const at = (ms, fn) => timers.push(setTimeout(fn, ms))
function clearTimers() { timers.forEach(clearTimeout); timers = [] }

function endClimb() {
  clearTimers()
  climbing.value  = false
  popFloor.value  = 0
  fillFloor.value = 0
}

function runClimb(from) {
  clearTimers()
  if (reduceMotion()) { endClimb(); centerOnCurrent(false); return }
  climbing.value = true
  centerOnCurrent(true)
  at(260,  () => { popFloor.value  = from })
  at(300,  () => { fillFloor.value = from })
  at(1200, endClimb)
}

watch(() => props.floor, (nf, of) => {
  nextTick(attachObserver)
  if (nf > of) runClimb(of)      // ไต่ขึ้นเท่านั้น — แพ้/รีเซตไม่อนิเมต
  else endClimb()
})

// แตะตรงไหนระหว่างไต่ = ข้ามไปสถานะปลายทางทันที (คนที่ตีรัวๆ ไม่ต้องรอ)
function onBoxClick(e) {
  if (!climbing.value) return
  e.stopPropagation()
  e.preventDefault()
  endClimb()
}

onBeforeUnmount(clearTimers)
```

**ลบ `watch` เดิมที่มีแค่ `nextTick(attachObserver)` ออก** — ถูกรวมเข้ากับ watch ตัวใหม่ข้างบนแล้ว
(ถ้าเหลือสองตัว observer จะถูก attach ซ้ำ)

- [ ] **Step 5: `TowerPath.vue` — ต่อคลาสเข้า template**

แก้ `.tp-box` ให้ดักคลิกตอนไต่:

```html
    <div ref="boxEl" class="tp-box" role="list" @click.capture="onBoxClick"
         :aria-label="`เส้นทางหอคอย ${max} ชั้น ตอนนี้อยู่ชั้น ${floor}`">
```

แก้ `.tp-row` ให้รับคลาสอนิเมชัน — เปลี่ยน `rowClass(n)` ใน script เป็น:

```js
function rowClass(n) {
  return [
    isLeft(n) ? 'l' : 'r',
    n <= props.best ? 'done' : n === props.floor ? 'now' : 'lock',
    { pop: n === popFloor.value, fill: n === fillFloor.value },
  ]
}
```

แก้ `.tp-marker` ให้รับคลาส `climbing`:

```html
        <div class="tp-marker" :class="{ climbing }" :style="markerStyle" aria-hidden="true">
```

- [ ] **Step 6: `TowerPath.vue` — เพิ่ม CSS อนิเมชัน**

ต่อท้าย `<style scoped>`:

```css
/* ── อนิเมชันไต่ขึ้น ────────────────────────────────────
   ทั้งหมดเป็น transform/opacity ยกเว้น clip-path จุดเดียว (กล่อง ~130x30px ทีละอัน)
   ห้ามเผลอใส่ box-shadow/filter/background เข้าไปใน keyframe เหล่านี้ */

/* โหนดที่เพิ่งผ่านเด้งตอนพลิกเป็น ✅ */
.tp-row.pop .tp-node { animation: tp-pop .34s cubic-bezier(.34, 1.5, .64, 1); }
@keyframes tp-pop {
  40%  { transform: scale(1.16); }
  100% { transform: scale(1); }
}

/* เส้นเชื่อมช่วงที่เพิ่งผ่านไล่สีจากล่างขึ้นบน
   ครึ่งบนของแถวที่เพิ่งผ่าน = ช่วงที่เชื่อมไปชั้นถัดขึ้นไป */
.tp-row.fill::before { animation: tp-fill .5s ease-out; }
@keyframes tp-fill {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* marker: X กับ Y อยู่ใน transform เดียวกันจึงขยับพร้อมกัน (ไม่วาร์บแนวนอน)
   หน่วง .34s ให้เกิดหลังโหนดเด้งกับเส้นไล่สี ตามลำดับในสเปก
   ⚠️ transition ต้องอยู่บน .tp-marker เฉยๆ **ห้ามใส่ไว้ใต้ .climbing**
      เพราะคลาส climbing กับค่า transform ใหม่ลงพร้อมกันในเฟรมเดียว —
      transition ที่เพิ่งถูกเพิ่มในเฟรมเดียวกับที่ค่าเปลี่ยน เบราว์เซอร์จะไม่อนิเมตให้
      (ต่างจาก @keyframes ที่ทริกเกอร์ได้ทันทีตอนคลาสถูกเพิ่ม) */
.tp-marker { transition: transform .5s cubic-bezier(.34, 1.3, .64, 1) .34s; }
.tp-marker.climbing .tp-marker-in { animation: tp-hop .5s cubic-bezier(.4, 0, .4, 1) .34s; }
@keyframes tp-hop {
  50%  { transform: translateY(-12px); }
  100% { transform: translateY(0); }
}
/* จอง compositor layer เฉพาะช่วงกำลังไต่ — ใส่ค้างไว้ = กินแรมตลอดเวลา */
.tp-marker.climbing, .tp-marker.climbing .tp-marker-in { will-change: transform; }

@media (prefers-reduced-motion: reduce) {
  .tp-row.pop .tp-node,
  .tp-row.fill::before,
  .tp-marker.climbing .tp-marker-in { animation: none; }
  .tp-marker { transition: none; }
}
```

- [ ] **Step 7: build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 8: ตรวจด้วยตาใน dev**

- ชนะหนึ่งชั้น → ปิด replay → **เห็น marker ไต่ขึ้นจริง** ไม่ใช่ไปถึงแล้วตั้งแต่แรก
- ลำดับถูก: เส้นทางเลื่อน → โหนดเก่าเด้งเป็น ✅ → เส้นไล่สี → marker กระโดดโค้ง
- marker **ไม่วาร์บแนวนอนก่อนแล้วค่อยไถลง** (ถ้าวาร์บ = X หลุดออกจาก transform)
- แพ้ → ปิด replay → **ไม่มีอนิเมชัน** และ marker อยู่ที่เดิม
- ยังไม่ได้จัดทีมแล้วกดสู้ → toast เตือน และ path ไม่ค้าง (`holdPath` ถูกปล่อย)
- แตะจอระหว่างไต่ → ข้ามไปสถานะปลายทางทันที และ**แผงชั้นไม่เปิดขึ้นมาด้วย**
- ชนะแล้วรีบกดสู้ต่อทันที → ไม่มีอนิเมชันค้างซ้อนกัน
- รีโหลดหน้า → **ไม่มีอนิเมชันหลอนตอนเปิด** (watcher ไม่ใช่ immediate)
- เปิด reduce-motion ใน OS (macOS: ตัวช่วยการเข้าถึง → จอภาพ → ลดการเคลื่อนไหว) → ชนะแล้วค่าอัปเดตทันทีไม่มีอนิเมชัน และตำแหน่งปลายทางตรงกับตอนเปิดอนิเมชัน

- [ ] **Step 9: commit**

```bash
git add src/components/tower/TowerPath.vue src/views/TowerView.vue
git commit -m "Tower: อนิเมชันไต่ขึ้นหลังชนะ (หน่วง path ระหว่าง replay ไม่งั้น marker ถึงก่อนคนดูเห็น)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: อนิเมชันปลดล็อกหมุดโบนัส + ตรวจงานรอบสุดท้าย

**Files:**
- Modify: `src/components/tower/TowerPath.vue`

**Interfaces:**
- Consumes: `runClimb()`, `endClimb()`, `climbing`, `reduceMotion()`, `isMilestone()`, `isLeft()`, `ROW_H` จาก Task 2/5
- Produces: ไม่มี — task ปิดงาน

**พื้นหลัง:** `TOWER_BONUS_FLOORS = [20, 40, 60, 70]` · `getTowerBonus(best)` คืนเหรียญ/วันจากชั้นสูงสุด
โบนัสตันที่ชั้น 70 (`BONUS_CAP_FLOOR`) — ชั้น 70 จึงเป็นหมุดสุดท้ายที่มีผลจริง

- [ ] **Step 1: เพิ่ม import ที่ยังขาด**

ใน `TowerPath.vue` แก้ import ของ `towerFloors.js`:

```js
import { floorZone, TOWER_BONUS_FLOORS, getTowerBonus } from '../../data/towerFloors.js'
```

- [ ] **Step 2: เพิ่ม state และ trigger ของวงแหวน**

เพิ่มใกล้ `fillFloor`:

```js
// วงแหวนปลดล็อกหมุดโบนัส — element ชั่วคราว สร้างตอนเล่นแล้วลบทิ้ง ไม่ค้างใน DOM
const burstFloor = ref(0)
const burstBonus = computed(() => getTowerBonus(burstFloor.value))
```

แก้ `endClimb` ให้ล้างด้วย:

```js
function endClimb() {
  clearTimers()
  climbing.value   = false
  popFloor.value   = 0
  fillFloor.value  = 0
  burstFloor.value = 0
}
```

แก้ `runClimb` ให้จุดวงแหวนเมื่อชั้นที่เพิ่งผ่านเป็นหมุด:

```js
function runClimb(from) {
  clearTimers()
  if (reduceMotion()) { endClimb(); centerOnCurrent(false); return }
  climbing.value = true
  centerOnCurrent(true)
  at(260,  () => { popFloor.value  = from })
  at(300,  () => { fillFloor.value = from })
  if (isMilestone(from)) at(860, () => { burstFloor.value = from })
  at(1900, endClimb)          // ยืดจาก 1200 ให้วงแหวน (700ms ที่ t=860) เล่นจบก่อนถูกล้าง
}
```

- [ ] **Step 3: เพิ่ม template ของวงแหวน**

ใส่ต่อจาก `<div class="tp-marker" …>…</div>` (ยังอยู่ใน `.tp-inner`):

```html
        <div v-if="burstFloor" class="tp-burst" :class="isLeft(burstFloor) ? 'l' : 'r'"
             :style="{ transform: `translate3d(0, ${(max - burstFloor) * ROW_H}px, 0)` }"
             aria-hidden="true">
          <span class="tp-ring"></span>
          <span class="tp-gain">+{{ burstBonus.toLocaleString() }}/วัน</span>
        </div>
```

- [ ] **Step 4: เพิ่ม CSS ของวงแหวน**

ต่อท้าย `<style scoped>`:

```css
/* ── วงแหวนปลดล็อกหมุดโบนัส ────────────────────────────
   วางทับแถวของหมุดนั้น จัดฝั่งเดียวกับโหนด · pointer-events:none ไม่ขวางการกด
   ห้าม animate box-shadow/filter ที่นี่ — วงแหวนใช้ border + transform/opacity เท่านั้น */
.tp-burst {
  position: absolute; top: 0; left: 0; right: 0; height: 60px;
  display: flex; align-items: center; pointer-events: none; z-index: 2;
}
.tp-burst.l { justify-content: flex-start; padding-left: calc(8% + 30px); }
.tp-burst.r { justify-content: flex-end;   padding-right: calc(8% + 30px); }

.tp-ring {
  position: absolute; width: 48px; height: 48px; border-radius: 999px;
  border: 3px solid var(--gold);
  animation: tp-ring .7s ease-out forwards;
}
@keyframes tp-ring {
  from { transform: scale(.4); opacity: 1; }
  to   { transform: scale(2.2); opacity: 0; }
}

.tp-gain {
  position: relative;
  padding: 3px 9px; border-radius: 999px;
  background: var(--gold); border: 2px solid var(--ink);
  font-size: .74rem; font-weight: 800; color: var(--ink); white-space: nowrap;
  animation: tp-gain .9s ease-out forwards;
}
@keyframes tp-gain {
  from { transform: translateY(6px); opacity: 0; }
  35%  { transform: translateY(-6px); opacity: 1; }
  to   { transform: translateY(-20px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .tp-ring, .tp-gain { animation: none; opacity: 0; }
}
```

- [ ] **Step 5: build + ตรวจกฎทั้งหมด**

```bash
npm run build
```
Expected: สำเร็จ

```bash
node --test src/utils/towerCrowd.test.js
```
Expected: `# fail 0`

```bash
grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/
```
Expected: ไม่มีผลลัพธ์

ตรวจว่าไม่มีการอนิเมตคุณสมบัติต้องห้ามหลุดเข้าไป:
```bash
grep -nE "transition:[^;]*(box-shadow|filter|background|width|height|top|left)" src/components/tower/*.vue
```
Expected: ไม่มีผลลัพธ์

ตรวจว่าไม่มีใครเขียน overlay เองแทนที่จะใช้ BottomSheet:
```bash
grep -n "position: *fixed" src/components/tower/*.vue
```
Expected: ไม่มีผลลัพธ์

ตรวจว่าไม่ได้ไปแตะไฟล์กลไกเกมเลยตลอดงาน (`48296c5` = commit สเปก = จุดตั้งต้นของงานนี้):
```bash
git diff --name-only 48296c5..HEAD -- src/data/towerFloors.js src/composables/useTower.js src/utils/battleEngine.js firestore.rules src/data/userSchema.js
```
Expected: ไม่มีผลลัพธ์

- [ ] **Step 6: ตรวจด้วยตาใน dev — รอบสุดท้ายทั้งหน้า**

ตั้ง `towerFloor` เป็น 20 ชั่วคราวใน Firestore console (หรือไต่จนถึง) แล้วชนะชั้น 20:
- เห็นวงแหวนทองระเบิดออกที่โหนดชั้น 20 + ป้าย `+N/วัน` ลอยขึ้นแล้วจาง
- ตัวเลขในป้ายตรงกับโบนัสจริงที่แสดงบนการ์ดสู้
- ชนะชั้นที่**ไม่ใช่**หมุด → ไม่มีวงแหวน

ไล่เช็คทั้งหน้าอีกรอบ:
- เส้นทาง / รางเพื่อน / แผงชั้น / อนิเมชันไต่ ยังทำงานครบเหมือน Task 2–5
- `#bottom-nav` ไม่ทับอะไรทั้งสิ้น
- เลื่อนเส้นทางยาวๆ หลังชนะหลายรอบ → ไม่มีอนิเมชันค้าง ไม่มี element วงแหวนตกค้างใน DOM
  (เปิด DevTools → Elements → ค้นหา `tp-burst` ตอนไม่ได้เล่น ต้องไม่เจอ)
- **เทสบนมือถือจริง** — เกณฑ์สุดท้ายของคำว่า "ไม่แลค" คือเครื่องของ user

- [ ] **Step 7: commit**

```bash
git add src/components/tower/TowerPath.vue
git commit -m "Tower: วงแหวนปลดล็อกหมุดโบนัส + ป้ายโบนัสที่ได้เพิ่ม (จบงาน vertical path)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## หลังจบทุก task

- ยังไม่ push — รอ user เทสจอจริงก่อน (แพทเทิร์นเดิมของโปรเจกต์นี้)
- ไม่ต้องแตะ `firestore.rules` เลยตลอดงานนี้ จึงไม่ต้อง `firebase deploy`
- ไม่มีปุ่มแอดมินที่ต้องกดหลัง deploy สำหรับงานนี้ (ต่างจาก roster/topic registry)
  แต่ **ถ้า `roster/current` ยังไม่เคยถูกสร้าง เพื่อนจะไม่โผล่บนเส้นทาง** — แอดมินต้องกด "สร้าง roster ใหม่" ครั้งเดียว
