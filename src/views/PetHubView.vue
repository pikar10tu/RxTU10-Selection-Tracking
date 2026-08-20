<template>
  <div class="tab-content">
    <div class="page-title ph-head">
      <RouterLink to="/play" class="ph-back" aria-label="กลับ">‹</RouterLink>
      <span><Emoji char="🐾" /> โหมดเพ็ท</span>
      <HelpButton topic="pets" />
    </div>

    <div class="play-grid">
      <RouterLink to="/pets" class="game-card">
        <span class="gc-emoji"><Emoji char="🐾" /></span>
        <span class="gc-name">สัตว์เลี้ยง</span>
        <span class="gc-badge grow">คลัง · ห้องทดลอง</span>
      </RouterLink>

      <RouterLink to="/shop" class="game-card">
        <span class="gc-emoji"><Emoji char="🛒" /></span>
        <span class="gc-name">ร้านค้าเพ็ท</span>
        <span class="gc-badge grow">อัญเชิญ · ห้องทดลอง</span>
      </RouterLink>

      <RouterLink to="/tower" class="game-card">
        <span class="gc-emoji"><Emoji char="🏯" /></span>
        <span class="gc-name">ปีนหอคอย</span>
        <span class="gc-badge grow">ไต่ชั้น · ปลดโบนัส</span>
      </RouterLink>

      <RouterLink v-if="pvpOpen || authStore.isAdmin" to="/arena" class="game-card">
        <span class="gc-emoji"><Emoji char="⚔️" /></span>
        <span class="gc-name">สนามประลอง</span>
        <span class="gc-badge grow">PvP · แต้มประลอง</span>
      </RouterLink>
      <SoonCard v-else emoji="⚔️" label="สนามประลอง" />

      <RouterLink v-if="expeditionOpen || authStore.isAdmin" to="/expedition" class="game-card">
        <span class="gc-emoji"><Emoji char="🗺️" /></span>
        <span class="gc-name">ส่งผจญภัย</span>
        <span v-if="expState === 'ready'" class="gc-badge ready"><Emoji char="🎉" /> กลับมาแล้ว!</span>
        <span v-else-if="expState === 'active'" class="gc-badge plant"><Emoji char="⏳" /> กำลังไป</span>
        <span v-else class="gc-badge grow">ส่งเพ็ทหารางวัล</span>
      </RouterLink>

      <SoonCard emoji="🐲" label="บอสรวมรุ่น" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Emoji from '../components/shared/Emoji.vue'
import SoonCard from '../components/shared/SoonCard.vue'
import HelpButton from '../components/help/HelpButton.vue'
import { useAuthStore } from '../stores/auth.js'
import { useAppConfig } from '../composables/useAppConfig.js'
import { useExpedition } from '../composables/useExpedition.js'
import { expeditionState } from '../utils/expedition.js'

const authStore = useAuthStore()
const { pvpOpen, expeditionOpen } = useAppConfig()
const { exp } = useExpedition()

// coarse tick (5s) ให้ badge ส่งผจญภัยสด
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 5000) })
onUnmounted(() => clearInterval(timer))

const expState = computed(() => expeditionState(exp.value, now.value))
</script>

<style scoped>
.ph-head { display: flex; align-items: center; gap: 8px; }
.ph-back { text-decoration: none; color: var(--ink); font-size: 1.6rem; font-weight: 800; line-height: 1; width: 24px; }

/* การ์ดเกม (ยกจาก PlayView เดิม) */
.play-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.game-card { all: unset; cursor: pointer; box-sizing: border-box; background: #e2f7f0; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: transform .12s, box-shadow .12s; }
.game-card:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.gc-emoji { font-size: 1.6rem; }
.gc-name { font-size: .8rem; font-weight: 800; }
.gc-badge { font-size: .7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.gc-badge.ready { color: #15803d; background: rgba(34,197,94,.16); }
.gc-badge.plant { color: #b45309; background: rgba(251,191,36,.18); }
.gc-badge.grow  { color: rgba(0,0,0,.45); background: rgba(0,0,0,.05); }
</style>
