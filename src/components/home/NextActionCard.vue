<!-- src/components/home/NextActionCard.vue — บอกว่า "ตอนนี้ทำอะไร" ทีละ 1 อย่าง -->
<template>
  <component
    :is="action.to ? RouterLink : 'button'"
    v-if="action"
    :to="action.to"
    :type="action.to ? undefined : 'button'"
    class="na-card"
    @click="onClick"
  >
    <span class="na-ico"><Emoji :char="action.icon" /></span>
    <span class="na-txt">
      <b class="na-title">{{ action.title }}</b>
      <small class="na-sub">{{ action.sub }}</small>
    </span>
    <span class="na-cta">{{ action.cta }} ›</span>
  </component>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { nextAction } from '../../utils/nextAction.js'
import { useAppConfig } from '../../composables/useAppConfig.js'

const emit = defineEmits(['sheet'])
const auth = useAuthStore()
const { expeditionOpen } = useAppConfig()

// คำนวณสดจาก userData ที่มีอยู่ในหน่วยความจำ — ไม่มีต้นทุน read
// วันที่ใช้นิพจน์เดียวกับที่ทั้งโปรเจกต์ใช้อยู่ (HomeView:70, StudyView:243, ฯลฯ) — ไม่มี helper กลาง
const action = computed(() => nextAction(
  auth.userData,
  {
    today: new Date().toISOString().slice(0, 10),
    now: Date.now(),
    expeditionOpen: expeditionOpen.value,
  },
))

function onClick() {
  if (action.value?.sheet) emit('sheet', action.value.sheet)
}
</script>

<style scoped>
.na-card { display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; text-align: left; text-decoration: none; background: var(--primary-light); border: 2px solid var(--ink); border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: var(--pop); cursor: pointer; font-family: inherit; transition: transform .12s, box-shadow .12s; }
.na-card:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.na-ico { font-size: 1.7rem; flex-shrink: 0; }
.na-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.na-title { font-size: .92rem; color: var(--ink); line-height: 1.3; }
.na-sub { font-size: .72rem; color: rgba(0,0,0,.55); line-height: 1.4; }
.na-cta { flex-shrink: 0; font-size: .74rem; font-weight: 800; color: var(--primary); }
</style>
