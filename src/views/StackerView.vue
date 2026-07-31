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
