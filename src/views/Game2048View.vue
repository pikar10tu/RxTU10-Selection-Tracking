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

    <div class="g-hint">ปัดนิ้ว 4 ทิศ · บนคอมแตะกระดานก่อน แล้วใช้ปุ่มลูกศร</div>

    <template #gameover>
      <div v-if="over" ref="overEl" class="g-over">
        <div class="g-over-score">จบเกม! ได้ <b>{{ score.toLocaleString() }}</b> คะแนน</div>
        <div v-if="saveState === 'saved'" class="g-over-coin">+{{ earned.toLocaleString() }} <Emoji char="🪙" /></div>
        <div v-else-if="saveState === 'saving'" class="g-over-coin">กำลังบันทึก…</div>
        <button v-else-if="saveState === 'failed'" class="g-retry" @click="saveResult">
          บันทึกไม่สำเร็จ — กดลองอีกครั้ง
        </button>
        <button class="g-btn" @click="reset">เล่นอีกครั้ง</button>
      </div>
    </template>
  </MinigameShell>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import MinigameShell from '../components/minigame/MinigameShell.vue'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useNewsPost } from '../composables/useNewsPost.js'
import { rankOfScore } from '../utils/newsFeed.js'
import { newBoard, move, spawn, isGameOver } from '../utils/game2048.js'
import { grantCoins } from '../utils/minigameCore.js'
import { useRosterSync } from '../composables/useRosterSync.js'
import { getMinigame } from '../data/minigames.js'
import { reportCheat } from '../composables/useGuard.js'

const auth = useAuthStore()
const members = useMembersStore()
const { postNews, myName } = useNewsPost()
const { syncRosterRow } = useRosterSync()
const GAME = getMinigame('g2048')

// เพดานรางวัลแยกจากเพดานจับโกง — maxPlausibleScore (100k) ใช้จับคะแนนที่เป็นไปไม่ได้
// ส่วนเหรียญจริงหนีบไว้ให้อยู่ระดับเดียวกับเกมอื่น (Capsule Rush 2.5k · Stacker 4k)
const REWARD_CAP = 3000

const board = ref(newBoard())
const score = ref(0)
const over = ref(false)
const earned = ref(0)
const saveState = ref('idle')   // idle | saving | saved | failed
const overEl = ref(null)
const best = computed(() => auth.userData?.minigames?.g2048?.best || 0)

watch(over, v => {
  if (v) nextTick(() => overEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
})

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
  const { coins: rawCoins, flagged } = grantCoins(score.value, GAME)
  const coins = Math.min(rawCoins, REWARD_CAP)
  earned.value = coins
  if (flagged) reportCheat('minigame_score_impossible:g2048', `g2048: ${score.value}`)
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
  // best ใหม่ → อัปแถวตัวเองในบอร์ด (เขียนเฉพาะตอนค่าเปลี่ยนจริง) + ข่าวกระดานถ้าติดอันดับรุ่น
  // อันดับคำนวณจาก rosterRows ที่กระดานบนจอนี้โหลดไว้แล้ว — ไม่มี roster ในมือ = ไม่ยิงข่าว (ห้ามอ่านเพิ่ม)
  if (ok) {
    const rows = members.rosterRows || {}
    const rank = Object.keys(rows).length
      ? rankOfScore(rows, auth.currentUser?.uid, (r) => r?.m?.g2048 || 0, newBest)
      : 0
    if (rank === 1) {
      postNews({ type: 'record1', icon: '🎮', msg: `${myName()} ขึ้นเป็นที่ 1 ของรุ่นใน 2048 ด้วย ${newBest.toLocaleString()} คะแนน` })
      syncRosterRow()
    } else {
      syncRosterRow({ event: (rank === 2 || rank === 3) ? { k: 'mg', g: 'g2048', v: rank, t: Date.now() } : null })
    }
  }
}

onMounted(() => reset())
</script>

<style scoped>
.g-score { text-align: center; font-size: .95rem; margin-bottom: 10px; }
.g-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 360px;
  margin: 0 auto; padding: 8px; background: rgba(0,0,0,.08); border: 2px solid var(--ink);
  border-radius: 14px; touch-action: none; }
.g-board:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
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
.g-retry { all: unset; cursor: pointer; color: #dc2626; font-weight: 700; margin: 6px 0 12px; display: block; }
.g-btn { all: unset; cursor: pointer; background: var(--primary); color: #fff; font-weight: 800;
  padding: 12px 28px; border-radius: 14px; }
</style>
