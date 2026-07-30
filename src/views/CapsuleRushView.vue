<template>
  <MinigameShell game-key="capsuleRush" :best="best">
    <!-- pet picker ก่อนเริ่ม -->
    <div v-if="phase === 'pick'" class="cr-pick">
      <div class="cr-pick-title">เลือกเพ็ทที่จะบิน <HelpButton topic="minigames" /></div>
      <div class="cr-pick-grid">
        <button v-for="p in petChoices" :key="p.id" class="cr-pet" :class="{ sel: p.emoji === chosen }"
                @click="chosen = p.emoji">
          <Emoji :char="p.emoji" />
        </button>
        <button class="cr-pet" :class="{ sel: chosen === '💊' }" @click="chosen = '💊'"><Emoji char="💊" /></button>
      </div>
      <button class="cr-start" @click="begin">เริ่มเล่น</button>
      <p class="cr-hint">แตะจอเพื่อกระพือขึ้น · ลอดช่องชั้นวางยา</p>
    </div>

    <!-- canvas -->
    <div v-show="phase === 'play'" class="cr-stage" @pointerdown.prevent="flap">
      <canvas ref="canvasEl" :width="WORLD_W" :height="WORLD_H" class="cr-canvas" />
      <div class="cr-score">{{ score }}</div>
    </div>

    <!-- game-over slot -->
    <template #gameover>
      <div v-if="phase === 'over'" class="cr-over">
        <div class="cr-over-score">คะแนน {{ lastScore }}</div>
        <div v-if="saveState === 'saved'" class="cr-over-coin">+{{ earned.toLocaleString() }} 🪙</div>
        <div v-else-if="saveState === 'saving'" class="cr-over-coin">กำลังบันทึก…</div>
        <button v-else-if="saveState === 'failed'" class="cr-retry" @click="saveResult">
          บันทึกไม่สำเร็จ — ลองอีกครั้ง
        </button>
        <div class="cr-over-btns">
          <button class="cr-start" @click="begin">เล่นอีกครั้ง</button>
          <button class="cr-exit" @click="$router.push('/play')">ออก</button>
        </div>
      </div>
    </template>
  </MinigameShell>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { increment } from 'firebase/firestore'
import MinigameShell from '../components/minigame/MinigameShell.vue'
import Emoji from '../components/shared/Emoji.vue'
import HelpButton from '../components/help/HelpButton.vue'
import { useCapsuleRush } from '../composables/useCapsuleRush.js'
import { getMinigame } from '../data/minigames.js'
import { grantCoins } from '../utils/minigameCore.js'
import { fluentFile } from '../utils/emoji.js'
import { useAuthStore } from '../stores/auth.js'
import { reportCheat } from '../composables/useGuard.js'

const GAME = getMinigame('capsuleRush')
const auth = useAuthStore()
const canvasEl = ref(null)
const phase = ref('pick') // 'pick' | 'play' | 'over'
const lastScore = ref(0)
const earned = ref(0)
const saveState = ref('idle') // idle | saving | saved | failed

const best = computed(() => auth.userData?.minigames?.capsuleRush?.best || 0)
const petChoices = computed(() => (auth.userData?.pets || []).slice(0, 12))
const LS_KEY = 'rxtu10:capsuleRush:pet'
const chosen = ref(localStorage.getItem(LS_KEY)
  || auth.userData?.pets?.[0]?.emoji || '💊')

const { score, start, stop, flap, dispose, WORLD_W, WORLD_H } =
  useCapsuleRush(canvasEl, { onGameOver })

function loadSprite(emoji) {
  return new Promise((resolve) => {
    const f = fluentFile(emoji)
    if (!f) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // fallback → engine วาด fillText
    img.src = import.meta.env.BASE_URL + f
  })
}

async function begin() {
  localStorage.setItem(LS_KEY, chosen.value)
  phase.value = 'play'
  saveState.value = 'idle'
  const sprite = await loadSprite(chosen.value)
  start(sprite)
}

function onGameOver(finalScore) {
  lastScore.value = finalScore
  phase.value = 'over'
  saveResult()
}

async function saveResult() {
  const score = lastScore.value
  if (score <= 0) { saveState.value = 'saved'; earned.value = 0; return }
  saveState.value = 'saving'
  const { coins, flagged } = grantCoins(score, GAME)
  earned.value = coins
  if (flagged) reportCheat('minigame_score_impossible', `capsuleRush: ${score}`)

  const cur = auth.userData?.minigames?.capsuleRush || { best: 0, plays: 0 }
  const newBest = Math.max(cur.best, score)
  const ok = await auth.patchUser(
    {
      coins: (auth.userData?.coins || 0) + coins,
      minigames: { ...auth.userData?.minigames, capsuleRush: { best: newBest, plays: cur.plays + 1 } },
    },
    {
      coins: increment(coins),
      'minigames.capsuleRush.best': newBest,
      'minigames.capsuleRush.plays': increment(1),
    },
  )
  saveState.value = ok ? 'saved' : 'failed'
}

onBeforeUnmount(() => { stop(); dispose() })
</script>

<style scoped>
.cr-pick { text-align: center; padding: 16px 0; }
.cr-pick-title { font-weight: 700; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; }
.cr-pick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
.cr-pet { all: unset; cursor: pointer; font-size: 1.8rem; padding: 10px; border: 2px solid transparent;
  border-radius: 14px; background: rgba(0,0,0,.03); text-align: center; min-height: 44px; }
.cr-pet.sel { border-color: #4f46e5; background: rgba(79,70,229,.12); }
.cr-start { all: unset; cursor: pointer; background: #4f46e5; color: #fff; font-weight: 800;
  padding: 12px 28px; border-radius: 14px; }
.cr-exit { all: unset; cursor: pointer; padding: 12px 22px; border-radius: 14px; font-weight: 700;
  border: 2px solid var(--ink, #333); }
.cr-hint { font-size: .72rem; color: rgba(0,0,0,.45); margin-top: 12px; }
.cr-stage { position: relative; width: 100%; max-width: 400px; margin: 0 auto; touch-action: none; }
.cr-canvas { width: 100%; height: auto; border: 2px solid var(--ink, #333); border-radius: 14px;
  background: linear-gradient(160deg,#eff6ff,#dbeafe); display: block; }
.cr-score { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  font-size: 2rem; font-weight: 900; color: #1e293b; text-shadow: 0 2px 0 #fff; }
.cr-over { text-align: center; padding: 18px 0; }
.cr-over-score { font-size: 1.4rem; font-weight: 900; }
.cr-over-coin { font-size: 1.1rem; font-weight: 800; color: #b45309; margin: 6px 0 14px; }
.cr-retry { all: unset; cursor: pointer; color: #dc2626; font-weight: 700; margin: 8px 0 14px; }
.cr-over-btns { display: flex; gap: 10px; justify-content: center; }
</style>
