<!-- src/components/home/ExpeditionCard.vue -->
<!-- การ์ดเตือนสถานะส่งผจญภัย — โชว์เฉพาะตอน active/ready (idle = ซ่อน) -->
<template>
  <RouterLink v-if="state !== 'idle'" to="/expedition" class="exc" :class="state">
    <span class="exc-emoji"><Emoji :char="state === 'ready' ? '🎉' : '🗺️'" /></span>
    <span class="exc-txt">
      <b>ส่งผจญภัย</b>
      <span class="exc-sub">{{ state === 'ready' ? 'คณะกลับมาแล้ว — กดเก็บรางวัล' : `กำลังผจญภัย · เหลือ ${remainText}` }}</span>
    </span>
    <span class="exc-go">›</span>
  </RouterLink>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { RouterLink } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useExpedition } from '../../composables/useExpedition.js'
import { expeditionState } from '../../utils/expedition.js'

const { exp } = useExpedition()
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

const state = computed(() => expeditionState(exp.value, now.value))
const remainText = computed(() => {
  const ms = Math.max(0, (exp.value?.endsAt || 0) - now.value)
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`
})
</script>

<style scoped>
.exc { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 11px 13px; margin-top: 4px; }
.exc.ready { background: rgba(34,197,94,.12); border-color: #16a34a; }
.exc-emoji { font-size: 1.4rem; }
.exc-txt { display: flex; flex-direction: column; min-width: 0; }
.exc-txt b { font-size: .85rem; }
.exc-sub { font-size: .7rem; color: rgba(0,0,0,.55); }
.exc-go { margin-left: auto; font-size: 1.2rem; color: rgba(0,0,0,.3); }
</style>
