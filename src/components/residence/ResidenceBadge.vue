<template>
  <span class="res-badge" :style="{ background: tier.frameColor + '22', color: tier.frameColor }">
    Lv.{{ lvl }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { getTier } from '../../data/residence.js'

const props = defineProps({ level: { type: Number, default: 1 } })
const lvl  = computed(() => props.level || 1)
const tier = computed(() => getTier(lvl.value))
</script>

<style scoped>
.res-badge {
  font-size: .7rem; font-weight: 800; padding: 2px 7px;
  border-radius: 999px; white-space: nowrap;
}
</style>
