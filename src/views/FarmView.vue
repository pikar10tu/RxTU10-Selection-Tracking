<template>
  <div class="tab-content">
    <div class="page-title fv-head">
      <RouterLink to="/play" class="fv-back" aria-label="กลับ">‹</RouterLink>
      <span><Emoji char="🌱" /> โหมดฟาร์ม</span>
      <span class="fv-spacer"></span>
    </div>

    <FarmGrid />
    <FarmOrders />
    <FarmShop />
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import FarmGrid from '../components/farm/FarmGrid.vue'
import FarmOrders from '../components/farm/FarmOrders.vue'
import FarmShop from '../components/farm/FarmShop.vue'
</script>

<style scoped>
.fv-head { display: flex; align-items: center; gap: 8px; }
.fv-back { text-decoration: none; color: var(--ink); font-size: 1.6rem; font-weight: 800; line-height: 1; width: 24px; }
.fv-spacer { width: 24px; }
</style>
