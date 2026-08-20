<template>
  <div class="farm-shop">
    <div class="fs-head"><Emoji char="🛒" /> ร้านค้าฟาร์ม</div>
    <div class="fs-status">
      แปลงที่ปลด <b>{{ farm.plotsUnlocked.value }}</b> / {{ farm.ceiling.value }}
      <span class="fs-cap">· เพดานตามเลเวลบ้าน</span>
    </div>

    <div v-if="info.reason === 'maxed'" class="fs-msg done">ปลดครบทุกแปลงแล้ว <Emoji char="🎉" /></div>
    <div v-else-if="info.reason === 'atCeiling'" class="fs-msg">
      ปลดครบเพดานบ้านแล้ว — อัปเกรดบ้านเพื่อปลดแปลงเพิ่ม (ตอนนี้เพดาน {{ farm.ceiling.value }} แปลง)
    </div>
    <template v-else>
      <button class="fs-buy" :disabled="info.reason === 'notEnoughCoins'" @click="farm.unlockPlot()">
        ปลดแปลงที่ {{ info.nextPlot }} · <Emoji char="🪙" /> {{ info.cost.toLocaleString() }}
      </button>
      <div v-if="info.reason === 'notEnoughCoins'" class="fs-warn">
        เหรียญไม่พอ (มี {{ coins.toLocaleString() }} เหรียญ)
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useFarm } from '../../composables/useFarm.js'

const auth = useAuthStore()
const farm = useFarm()
const info = computed(() => farm.nextPlot.value)
const coins = computed(() => auth.userData?.coins || 0)
</script>

<style scoped>
.farm-shop { background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 16px; padding: 14px; margin-top: 12px; }
.fs-head { font-weight: 800; font-size: 1rem; margin-bottom: 6px; }
.fs-status { font-size: .72rem; color: rgba(0,0,0,.6); margin-bottom: 10px; }
.fs-status b { color: var(--ink); }
.fs-cap { color: rgba(0,0,0,.4); }
.fs-buy { border: none; background: linear-gradient(135deg,#84cc16,#16a34a); color: #fff; font-weight: 800; font-size: .84rem; padding: 10px 14px; border-radius: 10px; cursor: pointer; font-family: inherit; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.fs-buy:disabled { opacity: .45; cursor: not-allowed; }
.fs-buy:not(:disabled):active { transform: translateY(1px); }
.fs-warn { font-size: .7rem; color: #dc2626; margin-top: 6px; text-align: center; }
.fs-msg { font-size: .74rem; color: rgba(0,0,0,.55); background: rgba(0,0,0,.04); border-radius: 10px; padding: 10px 12px; text-align: center; }
.fs-msg.done { color: #15803d; background: rgba(34,197,94,.12); font-weight: 700; }
</style>
