<template>
  <div class="res-card" :style="{ borderColor: currentTier.frameColor }">
    <div class="res-head">
      <div class="res-art" :style="{ background: currentTier.frameColor + '22' }"><Emoji :char="currentTier.art" /></div>
      <div class="res-meta">
        <div class="res-name">
          {{ currentTier.tierName }}
          <span class="res-lv" :style="{ background: currentTier.frameColor }">Lv.{{ level }}</span>
        </div>
        <div class="res-income"><Emoji char="💰" /> รายได้/วัน <b>{{ currentTier.dailyIncome.toLocaleString() }}</b><Emoji char="🪙" /></div>
      </div>
      <HelpButton topic="residence" />
    </div>

    <!-- progress to next tier -->
    <template v-if="!isMax">
      <div class="res-next">
        เลเวลถัดไป: <Emoji :char="next.art" /> {{ next.tierName }}
        <span class="res-next-income">(+{{ (next.dailyIncome - currentTier.dailyIncome).toLocaleString() }}<Emoji char="🪙" />/วัน)</span>
      </div>
      <button
        class="res-upgrade"
        :class="{ ok: canAfford }"
        :style="canAfford ? { background: currentTier.frameColor } : {}"
        @click="upgrade"
      >
        <Emoji char="⬆️" /> อัปเกรด · {{ next.upgradeCost.toLocaleString() }}<Emoji char="🪙" />
      </button>
      <div v-if="!canAfford" class="res-need">
        ขาดอีก {{ (next.upgradeCost - coins).toLocaleString() }}<Emoji char="🪙" />
      </div>
    </template>
    <div v-else class="res-max"><Emoji char="🏰" /> ระดับสูงสุดแล้ว!</div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import HelpButton from '../help/HelpButton.vue'
import { useResidence } from '../../composables/useResidence.js'

const { level, currentTier, next, isMax, coins, canAfford, upgrade } = useResidence()
</script>

<style scoped>
.res-card {
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 18px;
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: var(--pop);
}
.res-head { display: flex; align-items: center; gap: 12px; }
.res-head :deep(.help-btn) { margin-left: auto; align-self: flex-start; }
.res-art {
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; border-radius: 14px; flex-shrink: 0;
}
.res-meta { flex: 1; min-width: 0; }
.res-name { font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.res-lv { color: #fff; font-size: .7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.res-income { font-size: .76rem; color: rgba(0,0,0,.55); margin-top: 2px; }
.res-income b { color: #b45309; }
.res-next { font-size: .72rem; color: rgba(0,0,0,.55); margin: 12px 0 8px; }
.res-next-income { color: #059669; font-weight: 700; }
.res-upgrade {
  width: 100%;
  border: 2px solid var(--ink); border-radius: 12px;
  padding: 11px; font-family: inherit; font-size: .86rem; font-weight: 800;
  color: #fff; background: #c9c2d4; cursor: pointer;
  transition: transform .12s, box-shadow .12s, opacity .12s;
}
.res-upgrade.ok { box-shadow: var(--pop); }
.res-upgrade.ok:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.res-upgrade:not(.ok) { opacity: .55; cursor: not-allowed; }
.res-need { text-align: center; font-size: .7rem; color: #ef4444; margin-top: 6px; }
.res-max { text-align: center; font-weight: 800; color: #f59e0b; padding: 12px 0 4px; }
</style>
