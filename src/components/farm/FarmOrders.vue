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
          <div class="fo-pay"><Emoji char="🪙" /> {{ o.reward.coins.toLocaleString() }}<span class="sr-only">เหรียญ</span></div>
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
let dead = false   // กัน interval ถูกสร้างหลัง unmount ไปแล้ว (await ค้างข้าม unmount)

onMounted(async () => {
  await board.refillDue()
  if (dead) return   // component หายไปแล้วระหว่างรอ await — อย่าสร้าง interval ที่ไม่มีใครเคลียร์
  timer = setInterval(async () => {
    now.value = Date.now()
    // ช่องไหนนับถอยหลังจบแล้วให้เติมใบใหม่ (refillDue ไม่เขียนถ้าไม่มีช่องถึงเวลา)
    await board.refillDue()
  }, 1000)
})
onUnmounted(() => { dead = true; clearInterval(timer) })

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
