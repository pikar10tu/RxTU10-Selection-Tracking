<template>
  <Transition name="balloon">
    <div v-if="current" class="ach-balloon" role="status" aria-live="polite" @click="dismiss">
      <span class="ach-balloon-icon"><Emoji :char="current.icon" /></span>
      <div class="ach-balloon-txt">
        <div class="ach-balloon-head"><Emoji char="🎉" /> ปลดล็อกความสำเร็จ!</div>
        <div class="ach-balloon-title">{{ current.title }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import Emoji from './Emoji.vue'
import { computed, watch } from 'vue'
import { useAchievementBalloon } from '../../composables/useAchievementBalloon.js'

const { queue, dismiss } = useAchievementBalloon()
const current = computed(() => queue.value[0] || null)

let timer = null
watch(current, (c) => {
  clearTimeout(timer)
  if (c) timer = setTimeout(dismiss, 4000)   // auto-dismiss 4s
})
</script>

<style scoped>
.ach-balloon {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
  z-index: 500; display: flex; align-items: center; gap: 12px;
  background: var(--gold, #fbbf24); border: 2px solid var(--ink); border-radius: 16px;
  box-shadow: var(--pop); padding: 10px 16px; max-width: 92vw; cursor: pointer;
}
.ach-balloon-icon { font-size: 1.8rem; }
.ach-balloon-head { font-size: .7rem; font-weight: 800; color: rgba(0,0,0,.55); }
.ach-balloon-title { font-size: .95rem; font-weight: 800; color: var(--ink); }
.balloon-enter-active, .balloon-leave-active { transition: transform .3s ease, opacity .3s ease; }
.balloon-enter-from, .balloon-leave-to { transform: translate(-50%, -120%); opacity: 0; }
</style>
