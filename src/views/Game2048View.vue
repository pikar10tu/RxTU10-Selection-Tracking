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
  if (score.value <= 0) { saveState.value = 'saved'; earned.value = 0; return }
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
