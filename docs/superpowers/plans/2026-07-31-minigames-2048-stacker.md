# มินิเกม 2048 + Stacker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มมินิเกม 2 ตัวลงแพลตฟอร์มเดิม โดยตรรกะเกมทั้งหมดเป็น pure function ที่เทสด้วย `node --test` ได้ และไม่แตะเฟรมเวิร์กมินิเกมเลย

**Architecture:** `src/utils/game2048.js` และ `src/utils/stacker.js` เก็บกติกาล้วน (ไม่แตะ DOM/canvas/Firestore) · view รับอินพุต → เรียกฟังก์ชัน → เรนเดอร์ + ต่อกับ `MinigameShell` / `grantCoins` / `patchUser` ตามแพทเทิร์น `CapsuleRushView.vue`

**Tech Stack:** Vue 3 (script setup) + Pinia + Firebase · เทส pure util ด้วย `node --test`

**Spec:** `docs/superpowers/specs/2026-07-31-minigames-2048-stacker-design.md`

## Global Constraints

- คอมเมนต์ในโค้ด/commit เป็นไทยปนอังกฤษ · commit `Area: อะไร (ทำไม)`
- โทนข้อความผู้ใช้ยึด `docs/voice-guide.md` · single-file component + `<style scoped>`
- **ใช้ `var(--primary)` / `var(--ink)` เสมอ — ห้าม hardcode `#4f46e5`** (สีธีมเก่า · ธีมจริงคือ `--primary: #6d3bf5` ที่ `style.css:509`) · `CapsuleRushView.vue` ยัง hardcode อยู่ **อย่าลอกมา**
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น
- **ห้ามแตะ** `src/components/minigame/MinigameShell.vue` · `MinigameLeaderboard.vue` · `src/utils/minigameCore.js` · `CapsuleRushView.vue` · `firestore.rules` · entry `pillCrush` ใน registry
- ตรรกะเกมห้ามอ้าง DOM/`window`/`Date.now()` — รับ `rng`/`dt` เข้ามาเพื่อให้เทสได้
- พื้นที่เล่นที่รับการปัดนิ้วต้อง `touch-action: none` (กันหน้าเลื่อนตาม) · ต้องหยุดลูป/timer ใน `onBeforeUnmount`

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|------|----------------|
| `src/utils/game2048.js` **(ใหม่)** | กติกา 2048 ล้วน |
| `src/utils/game2048.test.js` **(ใหม่)** | `node --test` |
| `src/views/Game2048View.vue` **(ใหม่)** | กระดาน + ปัดนิ้ว + บันทึกผล |
| `src/utils/stacker.js` **(ใหม่)** | กติกา Stacker ล้วน |
| `src/utils/stacker.test.js` **(ใหม่)** | `node --test` |
| `src/views/StackerView.vue` **(ใหม่)** | แถวบล็อก + แตะวาง + บันทึกผล |
| `src/data/minigames.js` | +2 entries |
| `src/router/index.js` | +2 routes |

---

## Task 1: ตรรกะ 2048 (TDD)

**Files:**
- Create: `src/utils/game2048.js`, `src/utils/game2048.test.js`

**Interfaces:**
- Consumes: —
- Produces: `SIZE = 4` · `newBoard(rng?) → number[16]` · `move(board, dir) → { board, gained, moved }` (`dir` = `'left'|'right'|'up'|'down'`) · `spawn(board, rng?) → number[16]` · `isGameOver(board) → boolean`

- [ ] **Step 1: เขียนเทสก่อน**

สร้าง `src/utils/game2048.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { SIZE, newBoard, move, spawn, isGameOver } from './game2048.js'

// helper: สร้างกระดานจาก 4 แถว (อ่านง่ายกว่า array 16 ช่อง)
const B = (...rows) => rows.flat()

test('เลื่อนซ้าย: ไทล์ชิดขอบ ไม่มีรวม', () => {
  const r = move(B([0,0,2,0],[0,4,0,0],[0,0,0,0],[0,0,0,8]), 'left')
  assert.deepEqual(r.board.slice(0,4), [2,0,0,0])
  assert.deepEqual(r.board.slice(4,8), [4,0,0,0])
  assert.deepEqual(r.board.slice(12,16), [8,0,0,0])
  assert.equal(r.gained, 0)
  assert.equal(r.moved, true)
})

test('รวมคู่เท่ากัน ได้คะแนนเท่าค่าใหม่', () => {
  const r = move(B([2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [4,0,0,0])
  assert.equal(r.gained, 4)
})

test('ห้ามรวมซ้ำในตาเดียว — [2,2,4,0] ต้องได้ [4,4,0,0] ไม่ใช่ [8,...]', () => {
  const r = move(B([2,2,4,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [4,4,0,0])
  assert.equal(r.gained, 4)
})

test('สี่ตัวเท่ากันรวมเป็นสองคู่', () => {
  const r = move(B([4,4,4,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.deepEqual(r.board.slice(0,4), [8,8,0,0])
  assert.equal(r.gained, 16)
})

test('เลื่อนขวา: รวมจากฝั่งขวาก่อน', () => {
  const r = move(B([2,2,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'right')
  assert.deepEqual(r.board.slice(0,4), [0,0,2,4])
  assert.equal(r.gained, 4)
})

test('เลื่อนขึ้น/ลง ทำงานตามคอลัมน์', () => {
  const up = move(B([0,0,0,0],[2,0,0,0],[2,0,0,0],[0,0,0,0]), 'up')
  assert.equal(up.board[0], 4)
  assert.equal(up.gained, 4)
  const down = move(B([2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]), 'down')
  assert.equal(down.board[12], 4)
})

test('ตาที่กระดานไม่เปลี่ยน → moved = false และไม่ได้คะแนน', () => {
  const r = move(B([2,4,8,16],[0,0,0,0],[0,0,0,0],[0,0,0,0]), 'left')
  assert.equal(r.moved, false)
  assert.equal(r.gained, 0)
})

test('spawn ลงเฉพาะช่องว่าง และเป็น 2 หรือ 4', () => {
  const board = B([2,2,2,2],[2,2,2,2],[2,2,2,0],[2,2,2,2])   // ว่างช่องเดียว index 11
  const out = spawn(board, () => 0)
  assert.ok(out[11] === 2 || out[11] === 4)
  assert.equal(out.filter(v => v === 0).length, 0)
})

test('spawn: rng ต่ำ = 2 · rng สูง = 4 (4 ออก 10%)', () => {
  const board = new Array(16).fill(0)
  assert.equal(spawn(board, () => 0)[0], 2)
  assert.equal(spawn(board, () => 0.99)[15], 4)   // rng .99 → Math.floor(.99*16)=15 → ช่องสุดท้าย
})

test('newBoard เริ่มด้วยไทล์ 2 ตัว', () => {
  const b = newBoard(() => 0.5)
  assert.equal(b.length, SIZE * SIZE)
  assert.equal(b.filter(v => v !== 0).length, 2)
})

test('isGameOver: กระดานเต็มแต่ยังรวมได้ = ยังไม่จบ', () => {
  assert.equal(isGameOver(B([2,2,4,8],[4,8,16,32],[2,4,8,16],[4,8,16,32])), false)
})

test('isGameOver: กระดานเต็มและไม่มีคู่ติดกัน = จบ', () => {
  assert.equal(isGameOver(B([2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2])), true)
})

test('isGameOver: ยังมีช่องว่าง = ยังไม่จบ', () => {
  assert.equal(isGameOver(B([2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,0])), false)
})
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `node --test src/utils/game2048.test.js`
Expected: FAIL — `Cannot find module './game2048.js'`

- [ ] **Step 3: เขียนโมดูล**

สร้าง `src/utils/game2048.js`:

```js
// ════════════════════════════════════════════════════════════
//  2048 — กติกาล้วน (ไม่แตะ DOM/canvas/Firestore) เทสด้วย node --test
//  กระดาน = array 16 ช่อง (0 = ว่าง) เรียงซ้าย→ขวา บนลงล่าง
//  rng ฉีดเข้ามาได้เพื่อให้เทสคุมผลสุ่มได้
// ════════════════════════════════════════════════════════════
export const SIZE = 4

// เลื่อน+รวมหนึ่งแถวไปทางซ้าย — คืนแถวใหม่กับคะแนนที่ได้
//  ไทล์ที่เพิ่งรวมห้ามรวมซ้ำในตาเดียวกัน (ข้าม index ถัดไปหลังรวม)
function slideRow(row) {
  const tight = row.filter(v => v !== 0)
  const out = []
  let gained = 0
  for (let i = 0; i < tight.length; i++) {
    if (tight[i] === tight[i + 1]) {
      const merged = tight[i] * 2
      out.push(merged)
      gained += merged
      i++                       // กินตัวถัดไปไปแล้ว ห้ามใช้ซ้ำ
    } else {
      out.push(tight[i])
    }
  }
  while (out.length < SIZE) out.push(0)
  return { row: out, gained }
}

// ดึง index ของหนึ่งเส้น (แถวหรือคอลัมน์) ตามทิศที่จะเลื่อน
//  เลื่อนขวา/ลง = อ่านกลับด้าน เพื่อให้ใช้ slideRow (ซ้าย) ตัวเดียวได้
function lineIndices(dir, i) {
  const idx = []
  for (let j = 0; j < SIZE; j++) {
    if (dir === 'left' || dir === 'right') idx.push(i * SIZE + j)
    else idx.push(j * SIZE + i)
  }
  return (dir === 'right' || dir === 'down') ? idx.reverse() : idx
}

// เลื่อนทั้งกระดาน · moved = กระดานเปลี่ยนจริงไหม (ใช้ตัดสินว่าจะ spawn ไหม)
export function move(board, dir) {
  const out = board.slice()
  let gained = 0
  for (let i = 0; i < SIZE; i++) {
    const idx = lineIndices(dir, i)
    const { row, gained: g } = slideRow(idx.map(k => board[k]))
    gained += g
    idx.forEach((k, j) => { out[k] = row[j] })
  }
  const moved = out.some((v, k) => v !== board[k])
  return { board: out, gained, moved }
}

// วางไทล์ใหม่ในช่องว่างสุ่ม — 2 ที่ 90% · 4 ที่ 10%
export function spawn(board, rng = Math.random) {
  const empty = []
  board.forEach((v, k) => { if (v === 0) empty.push(k) })
  if (!empty.length) return board.slice()
  const out = board.slice()
  const at = empty[Math.floor(rng() * empty.length)]
  out[at] = rng() < 0.9 ? 2 : 4
  return out
}

export function newBoard(rng = Math.random) {
  return spawn(spawn(new Array(SIZE * SIZE).fill(0), rng), rng)
}

// จบเกมเมื่อไม่มีช่องว่าง และไม่มีคู่ติดกัน (แนวนอน/แนวตั้ง) ที่รวมได้
export function isGameOver(board) {
  if (board.some(v => v === 0)) return false
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r * SIZE + c]
      if (c + 1 < SIZE && v === board[r * SIZE + c + 1]) return false
      if (r + 1 < SIZE && v === board[(r + 1) * SIZE + c]) return false
    }
  }
  return true
}
```

> ระวัง: `spawn` เรียก `rng()` สองครั้ง (เลือกช่อง แล้วเลือกค่า) — เทส `rng: () => 0` จึงได้ช่องแรกและค่า 2

- [ ] **Step 4: รันให้เขียว**

Run: `node --test src/utils/game2048.test.js`
Expected: PASS ทุกเทส output สะอาด

- [ ] **Step 5: Commit**

```bash
git add src/utils/game2048.js src/utils/game2048.test.js
git commit -m "Minigame: ตรรกะ 2048 เป็น pure function (เลื่อน/รวม/สุ่มไทล์/จบเกม)"
```

---

## Task 2: หน้าเกม 2048 + ลงทะเบียน

**Files:**
- Create: `src/views/Game2048View.vue`
- Modify: `src/data/minigames.js`, `src/router/index.js`

**Interfaces:**
- Consumes: `newBoard/move/spawn/isGameOver` (Task 1) · `MinigameShell` · `grantCoins` · `getMinigame`
- Produces: route `/play/games/2048` · registry key `g2048`

- [ ] **Step 1: ลงทะเบียนเกม**

ใน `src/data/minigames.js` เพิ่ม entry **ก่อน** `pillCrush` (ให้เกมที่เล่นได้อยู่บนสุด) — **ห้ามแตะ entry เดิม**:

```js
  {
    key: 'g2048',
    name: '2048',
    emoji: '🔢',
    route: '/play/games/2048',
    coinPerPoint: 1,          // คะแนน 2048 เป็นหลักพัน-หมื่น จึงให้ 1:1
    maxPlausibleScore: 100000, // ตัวจับโกง ไม่ใช่เพดานรางวัล — ต่อถึงไทล์ 2048 (ชนะเกม) ก็ราว 20k แล้ว
                               // ใครเล่นต่อถึง 4096/8192 ยังไม่ควรโดนธง · เกินแสน = ผิดปกติจริง
    scoreLabel: 'คะแนน',
    tagline: 'เลื่อนรวมเลขให้ถึง 2048',
    status: 'live',
  },
```

ใน `src/router/index.js` เพิ่มถัดจาก route `capsule-rush`:

```js
    { path: '/play/games/2048', name: 'g2048', component: () => import('../views/Game2048View.vue') },
```

- [ ] **Step 2: สร้างหน้าเกม**

สร้าง `src/views/Game2048View.vue`:

```vue
<!-- src/views/Game2048View.vue — 2048 · ตรรกะอยู่ใน utils/game2048.js ทั้งหมด -->
<template>
  <MinigameShell game-key="g2048" :best="best">
    <div class="g-score">คะแนน <b>{{ score.toLocaleString() }}</b></div>

    <div
      class="g-board" @touchstart.passive="onTouchStart" @touchend="onTouchEnd"
      tabindex="0" @keydown="onKey"
    >
      <div v-for="(v, i) in board" :key="i" class="g-cell" :class="'v' + (v > 2048 ? 'max' : v)">
        {{ v || '' }}
      </div>
    </div>

    <div class="g-hint">ปัดนิ้ว 4 ทิศ (หรือใช้ปุ่มลูกศร)</div>

    <template #gameover>
      <div v-if="over" class="g-over">
        <div class="g-over-score">จบเกม! ได้ <b>{{ score.toLocaleString() }}</b> คะแนน</div>
        <div v-if="earned" class="g-over-coin">+{{ earned.toLocaleString() }} <Emoji char="🪙" /></div>
        <div v-if="saveState === 'failed'" class="g-fail">บันทึกไม่สำเร็จ — ลองใหม่อีกครั้งได้เลย</div>
        <button class="g-btn" @click="reset">เล่นอีกครั้ง</button>
      </div>
    </template>
  </MinigameShell>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import MinigameShell from '../components/minigame/MinigameShell.vue'
import { ref, computed, onMounted } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { newBoard, move, spawn, isGameOver } from '../utils/game2048.js'
import { grantCoins } from '../utils/minigameCore.js'
import { getMinigame } from '../data/minigames.js'
import { reportCheat } from '../composables/useGuard.js'

const auth = useAuthStore()
const GAME = getMinigame('g2048')

const board = ref(newBoard())
const score = ref(0)
const over = ref(false)
const earned = ref(0)
const saveState = ref('idle')   // idle | saving | saved | failed
const best = computed(() => auth.userData?.minigames?.g2048?.best || 0)

function reset() {
  board.value = newBoard()
  score.value = 0
  over.value = false
  earned.value = 0
  saveState.value = 'idle'
}

function doMove(dir) {
  if (over.value) return
  const r = move(board.value, dir)
  if (!r.moved) return                 // ตาที่ไม่เปลี่ยนอะไร = ไม่เกิดไทล์ใหม่
  board.value = spawn(r.board)
  score.value += r.gained
  if (isGameOver(board.value)) { over.value = true; saveResult() }
}

// ── อินพุต ──
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
function onKey(e) {
  const dir = KEYS[e.key]
  if (dir) { e.preventDefault(); doMove(dir) }
}
let sx = 0, sy = 0
function onTouchStart(e) { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY }
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - sx
  const dy = e.changedTouches[0].clientY - sy
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return    // แตะเฉยๆ ไม่นับเป็นปัด
  doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

async function saveResult() {
  if (score.value <= 0) { saveState.value = 'saved'; return }
  saveState.value = 'saving'
  const { coins, flagged } = grantCoins(score.value, GAME)
  earned.value = coins
  if (flagged) reportCheat('minigame_score_impossible', `g2048: ${score.value}`)
  const cur = auth.userData?.minigames?.g2048 || { best: 0, plays: 0 }
  const newBest = Math.max(cur.best, score.value)
  const ok = await auth.patchUser(
    {
      coins: (auth.userData?.coins || 0) + coins,
      minigames: { ...auth.userData?.minigames, g2048: { best: newBest, plays: cur.plays + 1 } },
    },
    {
      coins: increment(coins),
      'minigames.g2048.best': newBest,
      'minigames.g2048.plays': increment(1),
    },
  )
  saveState.value = ok ? 'saved' : 'failed'
}

onMounted(() => reset())
</script>

<style scoped>
.g-score { text-align: center; font-size: .95rem; margin-bottom: 10px; }
.g-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 360px;
  margin: 0 auto; padding: 8px; background: rgba(0,0,0,.08); border: 2px solid var(--ink);
  border-radius: 14px; touch-action: none; outline: none; }
.g-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; background: rgba(0,0,0,.05); font-weight: 900; font-size: 1.25rem; color: var(--ink); }
.g-cell.v2 { background: #eee4da; } .g-cell.v4 { background: #ede0c8; }
.g-cell.v8 { background: #f2b179; color: #fff; } .g-cell.v16 { background: #f59563; color: #fff; }
.g-cell.v32 { background: #f67c5f; color: #fff; } .g-cell.v64 { background: #f65e3b; color: #fff; }
.g-cell.v128, .g-cell.v256, .g-cell.v512 { background: #edcf72; color: #fff; font-size: 1.05rem; }
.g-cell.v1024, .g-cell.v2048, .g-cell.vmax { background: var(--primary); color: #fff; font-size: .95rem; }
.g-hint { text-align: center; font-size: .72rem; color: rgba(0,0,0,.45); margin-top: 10px; }
.g-over { text-align: center; padding: 16px 0; }
.g-over-score { font-size: 1.15rem; font-weight: 800; }
.g-over-coin { font-size: 1.05rem; font-weight: 800; color: #b45309; margin: 6px 0 12px; }
.g-fail { font-size: .78rem; color: #dc2626; margin-bottom: 10px; }
.g-btn { all: unset; cursor: pointer; background: var(--primary); color: #fff; font-weight: 800;
  padding: 12px 28px; border-radius: 14px; }
</style>
```

> `reportCheat` มาจาก `../composables/useGuard.js` (ตรวจกับ `CapsuleRushView.vue:52` แล้ว — **ไม่มีไฟล์ `utils/cheat.js`** อย่าเดา path เอง)

- [ ] **Step 3: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `node --test src/utils/game2048.test.js`
Expected: PASS

Run: `grep -n "4f46e5" src/views/Game2048View.vue`
Expected: ไม่มีผลลัพธ์ (ห้ามใช้สีธีมเก่า)

- [ ] **Step 4: Commit**

```bash
git add src/views/Game2048View.vue src/data/minigames.js src/router/index.js
git commit -m "Minigame: เพิ่มเกม 2048 (ปัดนิ้วเล่น เก็บสถิติ+อันดับผ่านเฟรมเวิร์กเดิม)"
```

---

## Task 3: ตรรกะ Stacker (TDD)

**Files:**
- Create: `src/utils/stacker.js`, `src/utils/stacker.test.js`

**Interfaces:**
- Consumes: —
- Produces: `COLS = 12` · `newStack(startW?) → state` · `stepBlock(state, dt) → state` · `dropBlock(state) → { state, gameOver }`
  โดย `state = { x, w, dir, speed, rows: [{ x, w }] }` (`x` = คอลัมน์ซ้ายสุดของบล็อกที่กำลังวิ่ง · หน่วยเป็นคอลัมน์ ทศนิยมได้)

- [ ] **Step 1: เขียนเทสก่อน**

สร้าง `src/utils/stacker.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { COLS, newStack, stepBlock, dropBlock } from './stacker.js'

test('เริ่มเกม: มีฐาน 1 แถว บล็อกกว้างเท่าฐาน', () => {
  const s = newStack(6)
  assert.equal(s.rows.length, 1)
  assert.equal(s.rows[0].w, 6)
  assert.equal(s.w, 6)
})

test('stepBlock เลื่อนตามทิศและเวลา', () => {
  const s = { ...newStack(6), x: 0, dir: 1, speed: 2 }
  assert.equal(stepBlock(s, 0.5).x, 1)         // 2 คอลัมน์/วินาที × 0.5 วิ
})

test('stepBlock เด้งกลับที่ขอบซ้ายและขอบขวา', () => {
  const right = stepBlock({ ...newStack(6), x: COLS - 6, dir: 1, speed: 5 }, 1)
  assert.equal(right.dir, -1)
  assert.ok(right.x <= COLS - 6)
  const left = stepBlock({ ...newStack(6), x: 0, dir: -1, speed: 5 }, 1)
  assert.equal(left.dir, 1)
  assert.ok(left.x >= 0)
})

test('วางตรงเป๊ะ: ความกว้างไม่ลด และได้แถวเพิ่ม', () => {
  const s = { ...newStack(6), x: 3 }
  s.rows = [{ x: 3, w: 6 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, false)
  assert.equal(r.state.rows.length, 2)
  assert.equal(r.state.rows[1].w, 6)
  assert.equal(r.state.w, 6)
})

test('วางเยื้อง 2 คอลัมน์: ความกว้างลด 2 และเริ่มที่ขอบทับ', () => {
  const s = { ...newStack(6), x: 5 }
  s.rows = [{ x: 3, w: 6 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, false)
  assert.equal(r.state.rows[1].w, 4)
  assert.equal(r.state.rows[1].x, 5)
  assert.equal(r.state.w, 4)
})

test('วางไม่ทับเลย = จบเกม และไม่เพิ่มแถว', () => {
  const s = { ...newStack(4), x: 8 }
  s.rows = [{ x: 0, w: 4 }]
  const r = dropBlock(s)
  assert.equal(r.gameOver, true)
  assert.equal(r.state.rows.length, 1)
})

test('ยิ่งสูงยิ่งเร็ว', () => {
  const s = { ...newStack(6), x: 3 }
  s.rows = [{ x: 3, w: 6 }]
  assert.ok(dropBlock(s).state.speed > s.speed)
})
```

- [ ] **Step 2: รันให้เห็นว่าแดง**

Run: `node --test src/utils/stacker.test.js`
Expected: FAIL — `Cannot find module './stacker.js'`

- [ ] **Step 3: เขียนโมดูล**

สร้าง `src/utils/stacker.js`:

```js
// ════════════════════════════════════════════════════════════
//  Stacker — กติกาล้วน (ไม่แตะ DOM/timer) เทสด้วย node --test
//  หน่วยทุกอย่างเป็น "คอลัมน์" (ทศนิยมได้) · เวลาเป็นวินาที ฉีด dt เข้ามา
//  state = { x, w, dir, speed, rows: [{ x, w }] }  · rows[0] = ฐาน
// ════════════════════════════════════════════════════════════
export const COLS = 12
const START_SPEED = 3       // คอลัมน์/วินาที
const SPEED_STEP = 0.35     // เร่งขึ้นทุกแถวที่วางสำเร็จ
const SPEED_MAX = 11

export function newStack(startW = 6) {
  const x = (COLS - startW) / 2
  return { x, w: startW, dir: 1, speed: START_SPEED, rows: [{ x, w: startW }] }
}

// เลื่อนบล็อกที่กำลังวิ่ง · ชนขอบแล้วกลับทิศ (หนีบไว้ในกระดานเสมอ)
export function stepBlock(state, dt) {
  let x = state.x + state.dir * state.speed * dt
  let dir = state.dir
  const maxX = COLS - state.w
  if (x <= 0) { x = 0; dir = 1 }
  else if (x >= maxX) { x = maxX; dir = -1 }
  return { ...state, x, dir }
}

// วางบล็อก — ตัดส่วนที่ยื่นเกินแถวล่าง · ไม่ทับเลย = จบเกม
export function dropBlock(state) {
  const below = state.rows[state.rows.length - 1]
  const start = Math.max(state.x, below.x)
  const end = Math.min(state.x + state.w, below.x + below.w)
  const w = end - start
  if (w <= 0) return { state, gameOver: true }
  const rows = [...state.rows, { x: start, w }]
  return {
    state: {
      ...state,
      rows, w, x: start,
      dir: 1,
      speed: Math.min(SPEED_MAX, state.speed + SPEED_STEP),
    },
    gameOver: false,
  }
}
```

- [ ] **Step 4: รันให้เขียว**

Run: `node --test src/utils/stacker.test.js`
Expected: PASS ทุกเทส

- [ ] **Step 5: Commit**

```bash
git add src/utils/stacker.js src/utils/stacker.test.js
git commit -m "Minigame: ตรรกะ Stacker เป็น pure function (เลื่อน/เด้งขอบ/ตัดส่วนยื่น/จบเกม)"
```

---

## Task 4: หน้าเกม Stacker + ลงทะเบียน

**Files:**
- Create: `src/views/StackerView.vue`
- Modify: `src/data/minigames.js`, `src/router/index.js`

**Interfaces:**
- Consumes: `newStack/stepBlock/dropBlock/COLS` (Task 3) · `MinigameShell` · `grantCoins`
- Produces: route `/play/games/stacker` · registry key `stacker`

- [ ] **Step 1: ลงทะเบียนเกม**

ใน `src/data/minigames.js` เพิ่มถัดจาก entry `g2048` (ยังคง `pillCrush` ไว้ท้ายสุด):

```js
  {
    key: 'stacker',
    name: 'Stacker',
    emoji: '🧱',
    route: '/play/games/stacker',
    coinPerPoint: 20,       // ชั้นเป็นหน่วยหยาบ (เล่นดี ~15–25 ชั้น) จึงให้ต่อชั้นสูง
    maxPlausibleScore: 60,
    scoreLabel: 'ชั้น',
    tagline: 'วางบล็อกให้ตรง ซ้อนให้สูงที่สุด',
    status: 'live',
  },
```

ใน `src/router/index.js`:

```js
    { path: '/play/games/stacker', name: 'stacker', component: () => import('../views/StackerView.vue') },
```

- [ ] **Step 2: สร้างหน้าเกม**

สร้าง `src/views/StackerView.vue` — ลูปใช้ `requestAnimationFrame` และ**ต้องยกเลิกใน `onBeforeUnmount`**:

```vue
<!-- src/views/StackerView.vue — Stacker · ตรรกะอยู่ใน utils/stacker.js ทั้งหมด -->
<template>
  <MinigameShell game-key="stacker" :best="best">
    <div class="s-score">ชั้น <b>{{ score }}</b></div>

    <div class="s-stage" @pointerdown.prevent="onTap">
      <div class="s-grid">
        <!-- แถวที่วางแล้ว (ล่างสุดขึ้นบน) -->
        <div v-for="(row, i) in visibleRows" :key="'r' + i" class="s-row">
          <div class="s-blk placed" :style="blkStyle(row)"></div>
        </div>
        <!-- บล็อกที่กำลังวิ่ง -->
        <div v-if="!over" class="s-row">
          <div class="s-blk moving" :style="blkStyle(state)"></div>
        </div>
      </div>
    </div>

    <div class="s-hint">แตะเพื่อวางบล็อก</div>

    <template #gameover>
      <div v-if="over" class="s-over">
        <div class="s-over-score">จบเกม! ซ้อนได้ <b>{{ score }}</b> ชั้น</div>
        <div v-if="earned" class="s-over-coin">+{{ earned.toLocaleString() }} <Emoji char="🪙" /></div>
        <div v-if="saveState === 'failed'" class="s-fail">บันทึกไม่สำเร็จ — ลองใหม่อีกครั้งได้เลย</div>
        <button class="s-btn" @click="reset">เล่นอีกครั้ง</button>
      </div>
    </template>
  </MinigameShell>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import MinigameShell from '../components/minigame/MinigameShell.vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { COLS, newStack, stepBlock, dropBlock } from '../utils/stacker.js'
import { grantCoins } from '../utils/minigameCore.js'
import { getMinigame } from '../data/minigames.js'
import { reportCheat } from '../composables/useGuard.js'

const VISIBLE_ROWS = 10        // โชว์แถวล่าสุดเท่านี้ (กองสูงกว่านี้เลื่อนขึ้นไป)

const auth = useAuthStore()
const GAME = getMinigame('stacker')

const state = ref(newStack())
const over = ref(false)
const earned = ref(0)
const saveState = ref('idle')
const best = computed(() => auth.userData?.minigames?.stacker?.best || 0)
const score = computed(() => state.value.rows.length - 1)   // ฐานไม่นับเป็นคะแนน
const visibleRows = computed(() => state.value.rows.slice(-VISIBLE_ROWS).reverse())

function blkStyle(r) {
  return { left: (r.x / COLS * 100) + '%', width: (r.w / COLS * 100) + '%' }
}

let raf = 0
let last = 0
function loop(ts) {
  if (!last) last = ts
  const dt = Math.min(0.05, (ts - last) / 1000)   // หนีบ dt กันกระโดดตอนสลับแท็บ
  last = ts
  if (!over.value) state.value = stepBlock(state.value, dt)
  raf = requestAnimationFrame(loop)
}

function onTap() {
  if (over.value) return
  const r = dropBlock(state.value)
  state.value = r.state
  if (r.gameOver) { over.value = true; saveResult() }
}

function reset() {
  state.value = newStack()
  over.value = false
  earned.value = 0
  saveState.value = 'idle'
  last = 0
}

async function saveResult() {
  const s = score.value
  if (s <= 0) { saveState.value = 'saved'; return }
  saveState.value = 'saving'
  const { coins, flagged } = grantCoins(s, GAME)
  earned.value = coins
  if (flagged) reportCheat('minigame_score_impossible', `stacker: ${s}`)
  const cur = auth.userData?.minigames?.stacker || { best: 0, plays: 0 }
  const newBest = Math.max(cur.best, s)
  const ok = await auth.patchUser(
    {
      coins: (auth.userData?.coins || 0) + coins,
      minigames: { ...auth.userData?.minigames, stacker: { best: newBest, plays: cur.plays + 1 } },
    },
    {
      coins: increment(coins),
      'minigames.stacker.best': newBest,
      'minigames.stacker.plays': increment(1),
    },
  )
  saveState.value = ok ? 'saved' : 'failed'
}

onMounted(() => { raf = requestAnimationFrame(loop) })
onBeforeUnmount(() => cancelAnimationFrame(raf))    // กันลูปรั่วเมื่อออกจากหน้า
</script>

<style scoped>
.s-score { text-align: center; font-size: .95rem; margin-bottom: 10px; }
.s-stage { max-width: 360px; margin: 0 auto; border: 2px solid var(--ink); border-radius: 14px;
  background: linear-gradient(160deg, #eef2ff, #fff); padding: 8px; touch-action: none; cursor: pointer; }
.s-grid { display: flex; flex-direction: column-reverse; gap: 3px; min-height: 320px; justify-content: flex-start; }
.s-row { position: relative; height: 26px; }
.s-blk { position: absolute; top: 0; height: 100%; border-radius: 6px; border: 2px solid var(--ink); }
.s-blk.placed { background: var(--primary-light); }
.s-blk.moving { background: var(--primary); }
.s-hint { text-align: center; font-size: .72rem; color: rgba(0,0,0,.45); margin-top: 10px; }
.s-over { text-align: center; padding: 16px 0; }
.s-over-score { font-size: 1.15rem; font-weight: 800; }
.s-over-coin { font-size: 1.05rem; font-weight: 800; color: #b45309; margin: 6px 0 12px; }
.s-fail { font-size: .78rem; color: #dc2626; margin-bottom: 10px; }
.s-btn { all: unset; cursor: pointer; background: var(--primary); color: #fff; font-weight: 800;
  padding: 12px 28px; border-radius: 14px; }
</style>
```

- [ ] **Step 3: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `node --test src/utils/stacker.test.js src/utils/game2048.test.js`
Expected: PASS ทั้งสอง

Run: `grep -n "4f46e5" src/views/StackerView.vue`
Expected: ไม่มีผลลัพธ์

Run: `grep -c "key:" src/data/minigames.js`
Expected: `4` (capsuleRush + g2048 + stacker + pillCrush) — เดิมมี 2 · ยืนยันว่า `pillCrush` ยังอยู่ครบ

- [ ] **Step 4: Commit**

```bash
git add src/views/StackerView.vue src/data/minigames.js src/router/index.js
git commit -m "Minigame: เพิ่มเกม Stacker (แตะวางบล็อก เก็บสถิติ+อันดับผ่านเฟรมเวิร์กเดิม)"
```

---

## หลังทำครบทุก Task

- [ ] **รันเทส pure util ทั้งหมด**

Run: `node --test src/utils/game2048.test.js src/utils/stacker.test.js src/utils/nextAction.test.js src/utils/questionReview.test.js src/utils/questionCategories.test.js src/utils/questionsFilter.test.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js`
Expected: PASS ทั้งหมด

- [ ] **Build**

Run: `npm run build`
Expected: ผ่าน

- [ ] **Deploy**

```bash
git push origin master     # ไม่แก้ rules จึงไม่ต้อง firebase deploy
```

- [ ] **สิ่งที่ user ต้องเทสบนจอจริง**

1. หน้า Play เห็นการ์ดเกมใหม่ 2 ใบ (2048 · Stacker) และ Pill Crush ยังเป็น "เร็วๆ นี้" เหมือนเดิม
2. **2048:** ปัดนิ้วทั้ง 4 ทิศแล้ว**หน้าไม่เลื่อนตาม** · ปัดทิศที่ขยับไม่ได้ต้องไม่เกิดไทล์ใหม่ · คะแนนขึ้นตรงกับที่รวมได้
3. **Stacker:** บล็อกวิ่งลื่น · แตะแล้ววางตรงจุด · วางเยื้องแล้วบล็อกแคบลงจริง · ยิ่งสูงยิ่งเร็ว
4. ทั้งสองเกม: จบเกมแล้วเหรียญเข้า · สถิติส่วนตัวบนหัวเกมขยับ · เปิด 🏆 เห็นตัวเองในกระดาน
5. ออกจากหน้าเกมกลางคัน แล้วเข้าใหม่ — ไม่ค้าง ไม่กระตุก (ลูปถูกยกเลิกแล้ว)

---

## Self-Review (ผู้เขียนแผนตรวจเองแล้ว)

**ครอบคลุมสเปก:** เกม 2048 (กติกา/คะแนน/อินพุต/เศรษฐกิจ) → Task 1–2 · Stacker → Task 3–4 ·
"ไม่แตะเฟรมเวิร์ก" → ระบุใน Global Constraints และไม่มี task ไหนแก้ไฟล์เฟรมเวิร์ก ·
`touch-action: none` → อยู่ใน CSS ของทั้งสองหน้า · ยกเลิกลูป → `onBeforeUnmount` ใน Stacker
(2048 ไม่มีลูป จึงไม่ต้อง) · ห้าม hardcode สีธีมเก่า → มี grep ตรวจในทั้งสอง task

**Placeholder scan:** ไม่มี TBD/TODO · ทุกขั้นมีโค้ดจริง

**ชื่อ/ชนิดสอดคล้อง:** `g2048` / `stacker` เป็น key เดียวกันทั้ง registry, route name, `getMinigame()`,
`minigames.<key>.best`, และ dot-notation ใน `patchUser` · `dropBlock` คืน `{ state, gameOver }` เหมือนกัน
ทั้งในเทสและ view · `score` ของ Stacker = `rows.length - 1` สอดคล้องกับเทสที่ฐานไม่นับเป็นคะแนน

**จุดที่จับได้ตอนตรวจเอง:** ร่างแรกเดา path ของ `reportCheat` เป็น `../utils/cheat.js` ซึ่ง**ไม่มีไฟล์นั้นอยู่จริง**
(ของจริงคือ `../composables/useGuard.js` ตาม `CapsuleRushView.vue:52`) — ถ้าปล่อยไว้ build พังทันที · แก้ในแผนแล้ว
และ `grep -c "key:"` ตอนนี้ได้ 2 จึงตั้งค่าคาดหวังหลังเพิ่มเป็น 4
