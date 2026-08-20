<template>
  <component :is="comingSoon ? 'div' : 'RouterLink'" :to="comingSoon ? undefined : to"
    class="qmc" :class="{ soon: comingSoon }" :aria-disabled="comingSoon ? 'true' : undefined">
    <span class="qmc-emoji"><Emoji :char="emoji" /></span>
    <span class="qmc-text">
      <b>{{ title }}</b>
      <small>{{ subtitle }}</small>
    </span>
    <span v-if="comingSoon" class="qmc-soon">เร็วๆ นี้</span>
    <span v-else class="qmc-go">›</span>
  </component>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
defineProps({
  emoji:      { type: String, required: true },
  title:      { type: String, required: true },
  subtitle:   { type: String, default: '' },
  to:         { type: String, default: null },
  comingSoon: { type: Boolean, default: false },
})
</script>

<style scoped>
.qmc { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; background: var(--primary-light); border: 2px solid var(--ink); box-shadow: var(--pop); text-decoration: none; transition: transform .12s, box-shadow .12s; }
.qmc:not(.soon):active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.qmc.soon { background: #f1f5f9; border-color: #94a3b8; box-shadow: none; opacity: .75; cursor: default; }
.qmc-emoji { font-size: 1.6rem; flex-shrink: 0; }
.qmc-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.qmc-text b { font-size: .9rem; color: #3730a3; }
.qmc-text small { font-size: .7rem; color: #6366f1; }
.qmc.soon .qmc-text b { color: #475569; }
.qmc.soon .qmc-text small { color: #64748b; }
.qmc-go { font-size: 1.4rem; color: #6366f1; flex-shrink: 0; }
.qmc-soon { font-size: .7rem; font-weight: 800; color: #fff; background: #94a3b8; padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
</style>
