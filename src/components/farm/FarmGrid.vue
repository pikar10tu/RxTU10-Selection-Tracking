<template>
  <div class="farm">
    <div class="farm-head">
      <span class="farm-title"><Emoji char="🌾" /> ฟาร์ม <HelpButton topic="farm" /></span>
      <span class="farm-sub">{{ plotCount }} แปลง · ปลูกได้ {{ seedChoices.length }} ชนิด<template v-if="upcoming"> · ปลดล็อก Lv.{{ upcoming.level }} {{ upcomingEmojis }}</template></span>
    </div>

    <!-- plots -->
    <div class="farm-grid">
      <div v-for="(plot, i) in plots" :key="i" class="plot" :class="{ ready: stat(plot).ready, empty: !plot }">
        <!-- empty -->
        <button v-if="!plot" class="plot-empty" @click="openPicker(i)">
          <span class="plot-plus">＋</span>
          <span class="plot-hint">ปลูก</span>
        </button>

        <!-- planted -->
        <template v-else>
          <div v-if="stat(plot).ready" class="plot-ready-tag">พร้อม!</div>
          <div class="plot-emoji" :class="{ ripe: stat(plot).ready }" :style="emojiStyle(plot)"><Emoji :char="stageChar(plot)" /></div>
          <div class="plot-name">{{ stat(plot).crop.name }}</div>

          <template v-if="stat(plot).ready">
            <button class="plot-btn harvest" @click="farm.harvest(i)"><Emoji char="✅" /> เก็บเกี่ยว</button>
          </template>
          <template v-else>
            <div class="plot-bar"><div class="plot-fill" :style="{ width: (stat(plot).progress * 100) + '%' }"></div></div>
            <div class="plot-time"><Emoji char="⏱" /> {{ fmt(stat(plot).remainingMs) }} · {{ Math.round(stat(plot).progress * 100) }}%</div>
          </template>
        </template>
      </div>
    </div>

    <!-- inventory / sell -->
    <div class="inv">
      <div class="inv-head">
        <span><Emoji char="🧺" /> ผลผลิต</span>
        <button v-if="invList.length" class="inv-sellall" @click="confirmSellAll">ขายทั้งหมด</button>
      </div>
      <div v-if="!invList.length" class="inv-empty">ยังไม่มีผลผลิต — ปลูกแล้วเก็บเกี่ยวมาขายได้เลย</div>
      <div v-else class="inv-list">
        <button v-for="it in invList" :key="it.id" class="inv-item" @click="confirmSell(it)">
          <span class="inv-emoji"><Emoji :char="it.emoji" /></span>
          <span class="inv-qty">×{{ it.qty }}</span>
          <span class="inv-sell">ขาย {{ (it.sellPrice * it.qty).toLocaleString() }}<Emoji char="🪙" /></span>
        </button>
      </div>
    </div>

    <SeedPicker
      :open="pickIndex !== null"
      :choices="farm.seedChoices.value"
      :coins="coins"
      @pick="onPick"
      @close="pickIndex = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Emoji from '../shared/Emoji.vue'
import HelpButton from '../help/HelpButton.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useFarm } from '../../composables/useFarm.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { getCrop, stageEmoji, DEFAULT_STAGES } from '../../data/crops.js'
import { fluentFile } from '../../utils/emoji.js'
import SeedPicker from './SeedPicker.vue'

const auth = useAuthStore()
const farm = useFarm()
const { confirm } = useConfirm()

const now = ref(Date.now())
let timer = null
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  // preload รูประยะการโต — <Emoji> เป็น lazy img ไม่งั้นตอนสลับระยะครั้งแรกภาพจะวูบ
  // (แพทเทิร์นเดียวกับ preload projectile ของ battle commit b6a996c)
  const chars = new Set(DEFAULT_STAGES)
  for (const c of seedChoices.value) {
    chars.add(c.emoji)
    for (const s of (c.stages || [])) chars.add(s)
  }
  for (const ch of chars) {
    const f = fluentFile(ch)
    if (f) { const img = new Image(); img.src = import.meta.env.BASE_URL + f }
  }
})
onUnmounted(() => clearInterval(timer))

const plots       = computed(() => farm.plots.value)
const plotCount   = computed(() => farm.plotCount.value)
const coins       = computed(() => auth.userData?.coins || 0)
const seedChoices = computed(() => farm.seedChoices.value)
const upcoming    = computed(() => farm.upcomingSeed.value)
const upcomingEmojis = computed(() => (upcoming.value?.crops || []).map(c => c.emoji).join(''))

const pickIndex = ref(null)
function openPicker(i) { pickIndex.value = i }
function onPick(seedId) { const i = pickIndex.value; pickIndex.value = null; if (i !== null) farm.plant(i, seedId) }

// reactive plot status (re-evaluates as `now` ticks)
function stat(plot) { return farm.status(plot, now.value) }

// อีโมจิที่แสดงในแปลง = ระยะการโต (พร้อมเก็บ → progress = 1 → คืนผลจริงอยู่แล้ว)
function stageChar(plot) { const s = stat(plot); return stageEmoji(s.crop, s.progress) }

// emoji โตขึ้นตาม progress (ต้นเล็ก → โตเต็มเมื่อพร้อม)
function emojiStyle(plot) {
  const s = stat(plot)
  if (s.ready) return {}
  const scale = 0.55 + 0.45 * s.progress
  return { transform: `scale(${scale.toFixed(2)})` }
}

// ยืนยันก่อนขาย (กันกดพลาด)
async function confirmSell(it) {
  const total = (it.sellPrice * it.qty).toLocaleString()
  if (await confirm(`ขาย ${it.name} ×${it.qty} = +${total} เหรียญ?`)) farm.sell(it.id)
}
async function confirmSellAll() {
  const total = invList.value.reduce((s, it) => s + it.sellPrice * it.qty, 0)
  if (await confirm(`ขายผลผลิตทั้งหมด รวม +${total.toLocaleString()} เหรียญ?`)) farm.sellAll()
}

// format remaining grow time (ms) → readable countdown
function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}ชม ${m}น`
  if (m > 0) return `${m}น ${sec}ว`
  return `${sec}ว`
}

const invList = computed(() =>
  Object.entries(farm.inventory.value)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => { const c = getCrop(id); return { id, qty, emoji: c?.emoji, name: c?.name, sellPrice: c?.sellPrice || 0 } })
)
</script>

<style scoped>
.farm { background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 16px; padding: 14px; }
.farm-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.farm-title { font-weight: 800; font-size: 1rem; }
.farm-sub { font-size: .7rem; color: rgba(0,0,0,.45); }
.farm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.plot { position: relative; overflow: hidden; border-radius: 12px; background: linear-gradient(160deg, rgba(150,110,70,.12), rgba(110,80,45,.08)); border: 1px solid rgba(120,90,50,.2); box-shadow: inset 0 -6px 10px -6px rgba(80,55,25,.25); min-height: 110px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; transition: background .25s, border-color .25s, box-shadow .25s; }
.plot.empty { background: rgba(120,90,50,.04); border-style: dashed; box-shadow: none; }
.plot.ready { background: linear-gradient(160deg, rgba(34,197,94,.16), rgba(22,163,74,.1)); border-color: rgba(34,197,94,.5); box-shadow: 0 0 0 1px rgba(34,197,94,.25), 0 4px 14px -4px rgba(34,197,94,.5); animation: plotGlow 1.8s ease-in-out infinite; }
.plot-empty { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 94px; color: rgba(0,0,0,.35); transition: color .2s, transform .2s; }
.plot-empty:hover { color: rgba(34,150,80,.75); transform: scale(1.04); }
.plot-plus { font-size: 1.6rem; }
.plot-hint { font-size: .7rem; }
.plot-ready-tag { position: absolute; top: 6px; right: 6px; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; font-weight: 800; font-size: .7rem; padding: 2px 7px; border-radius: 999px; box-shadow: 0 2px 5px rgba(22,163,74,.45); }
.plot-emoji { font-size: 1.8rem; line-height: 1; transform-origin: center bottom; transition: transform .4s cubic-bezier(.34,1.56,.64,1); }
.plot-emoji.ripe { animation: ripeBob 1.4s ease-in-out infinite; }
.plot-name { font-size: .7rem; color: rgba(0,0,0,.55); font-weight: 700; }
.plot-bar { width: 100%; height: 6px; background: rgba(0,0,0,.1); border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.12); }
.plot-fill { height: 100%; background: linear-gradient(90deg,#84cc16,#22c55e); border-radius: 999px; transition: width .8s linear; }
.plot-time { font-size: .7rem; color: rgba(0,0,0,.5); }
.plot-actions { display: flex; gap: 4px; }
.plot-mini { border: none; background: rgba(0,0,0,.06); border-radius: 7px; padding: 3px 6px; font-size: .72rem; cursor: pointer; display: flex; align-items: center; gap: 1px; }
.plot-mini:disabled { opacity: .35; }
.plot-fertcost { font-size: .7rem; color: #b45309; }
.plot-btn.harvest { border: none; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; font-weight: 800; font-size: .7rem; padding: 5px 8px; border-radius: 8px; cursor: pointer; font-family: inherit; }
.inv { margin-top: 14px; border-top: 1px dashed rgba(0,0,0,.12); padding-top: 12px; }
.inv-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: .82rem; margin-bottom: 8px; }
.inv-sellall { border: none; background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff; font-weight: 700; font-size: .7rem; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; }
.inv-empty { font-size: .7rem; color: rgba(0,0,0,.4); text-align: center; padding: 8px 0; }
.inv-list { display: flex; flex-wrap: wrap; gap: 6px; }
.inv-item { display: flex; align-items: center; gap: 5px; border: 1px solid rgba(180,83,9,.18); border-radius: 10px; padding: 6px 9px; background: linear-gradient(160deg,#fff,rgba(245,158,11,.07)); cursor: pointer; font-family: inherit; transition: transform .15s, box-shadow .15s; }
.inv-item:hover { box-shadow: 0 3px 10px -4px rgba(180,83,9,.4); transform: translateY(-1px); }
.inv-item:active { transform: scale(.97); }
.inv-emoji { font-size: 1.1rem; }
.inv-qty { font-weight: 800; font-size: .74rem; }
.inv-sell { font-size: .7rem; color: #b45309; font-weight: 700; }

@keyframes plotGlow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(34,197,94,.25), 0 4px 14px -4px rgba(34,197,94,.45); }
  50%      { box-shadow: 0 0 0 1px rgba(34,197,94,.45), 0 6px 20px -3px rgba(34,197,94,.7); }
}
@keyframes ripeBob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-3px) rotate(2deg); }
}
@media (prefers-reduced-motion: reduce) {
  .plot.ready { animation: none; }
  .plot-emoji.ripe { animation: none; }
  .plot-emoji, .plot-fill, .plot, .inv-item, .plot-empty { transition: none; }
}
</style>
