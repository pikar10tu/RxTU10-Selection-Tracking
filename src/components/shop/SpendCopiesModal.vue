<template>
  <Teleport to="body">
    <div class="ov" @click.self="$emit('cancel')">
      <div class="sc-box">
        <div class="sc-head">
          เลือก {{ rarityLabel }} จ่ายตัวซ้ำ
        </div>
        <div class="sc-sub">
          <template v-if="mode === 'fusion'">เลือกแล้ว {{ total }}/{{ required }}</template>
          <template v-else>เลือก {{ total }} copies · ได้ <b>{{ coinValue.toLocaleString() }}</b> <Emoji char="🪙" /></template>
        </div>

        <div v-if="!candidates.length" class="sc-empty">ไม่มี copies ระดับนี้</div>
        <div v-else class="sc-list">
          <div v-for="p in candidates" :key="p.id" class="sc-row">
            <span class="sc-emoji"><Emoji :char="p.emoji" /></span>
            <span class="sc-name">{{ p.name }} <small>({{ p.copies }})</small></span>
            <div class="sc-step">
              <button class="sc-pm" :aria-label="`ลด ${p.name}`" :disabled="(alloc[p.id] || 0) <= 0" @click="setN(p, (alloc[p.id] || 0) - 1)">−</button>
              <span class="sc-n">{{ alloc[p.id] || 0 }}</span>
              <button class="sc-pm" :aria-label="`เพิ่ม ${p.name}`" :disabled="(alloc[p.id] || 0) >= p.copies" @click="setN(p, (alloc[p.id] || 0) + 1)">+</button>
              <button class="sc-max" :aria-label="`ใส่ ${p.name} สูงสุด`" :disabled="(alloc[p.id] || 0) >= p.copies" @click="setN(p, p.copies)">สูงสุด</button>
            </div>
          </div>
        </div>

        <div v-if="mode === 'fusion' && available < required" class="sc-warn">copies ไม่พอ ({{ available }}/{{ required }})</div>

        <div class="sc-actions">
          <button v-if="mode === 'fusion'" class="sc-auto" @click="auto">auto เติม</button>
          <button class="sc-cancel" @click="$emit('cancel')">ยกเลิก</button>
          <button class="sc-ok" :class="{ ready: canConfirm }" :disabled="!canConfirm" @click="confirm">ยืนยัน</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { useAuthStore } from '../../stores/auth.js'
import { RARITY } from '../../data/index.js'
import { REDEEM_COIN } from '../../utils/lab.js'

const props = defineProps({
  rarity: { type: String, required: true },
  mode: { type: String, required: true },
  required: { type: Number, default: 0 },
})
const emit = defineEmits(['confirm', 'cancel'])
const auth = useAuthStore()

const candidates = computed(() => (auth.userData?.pets || []).filter((p) => p.rarity === props.rarity && (p.copies || 0) > 0))
const available = computed(() => candidates.value.reduce((s, p) => s + (p.copies || 0), 0))
const rarityLabel = computed(() => RARITY[props.rarity]?.label || props.rarity)

const alloc = ref({}) // id -> n
const total = computed(() => candidates.value.reduce((s, p) => s + (alloc.value[p.id] || 0), 0))
const coinValue = computed(() => total.value * (REDEEM_COIN[props.rarity] || 0))

function setN(p, n) {
  const clamped = Math.max(0, Math.min(n, p.copies || 0))
  alloc.value = { ...alloc.value, [p.id]: clamped }
}
function auto() {
  let need = props.required
  const next = {}
  for (const p of [...candidates.value].sort((a, b) => (b.copies || 0) - (a.copies || 0))) {
    if (need <= 0) break
    const take = Math.min(p.copies || 0, need)
    next[p.id] = take
    need -= take
  }
  alloc.value = next
}
const canConfirm = computed(() => props.mode === 'fusion' ? total.value === props.required : total.value >= 1)
function confirm() {
  const allocation = candidates.value
    .map((p) => ({ id: p.id, n: alloc.value[p.id] || 0 }))
    .filter((a) => a.n > 0)
  emit('confirm', allocation)
}
</script>

<style scoped>
.ov { position: fixed; inset: 0; z-index: 410; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 20px; overscroll-behavior: contain; }
.sc-box { background: #fff; border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop-lg); padding: 18px; width: 100%; max-width: 360px; max-height: 82vh; display: flex; flex-direction: column; }
.sc-head { font-weight: 800; text-align: center; }
.sc-sub { font-size: .72rem; color: rgba(0,0,0,.6); text-align: center; margin: 4px 0 12px; }
.sc-empty { text-align: center; color: rgba(0,0,0,.4); padding: 20px 0; }
.sc-list { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.sc-row { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 11px; padding: 7px 10px; }
.sc-emoji { font-size: 1.4rem; }
.sc-name { flex: 1; min-width: 0; font-size: .8rem; font-weight: 700; }
.sc-name small { color: rgba(0,0,0,.45); font-weight: 600; }
.sc-step { display: flex; align-items: center; gap: 8px; }
.sc-pm { width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; font-weight: 800; font-size: 1.05rem; cursor: pointer; }
.sc-pm:disabled { opacity: .35; cursor: default; }
.sc-max { min-height: 40px; padding: 0 12px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; font-family: inherit; font-weight: 800; font-size: .72rem; cursor: pointer; }
.sc-max:disabled { opacity: .35; cursor: default; }
.sc-n { min-width: 18px; text-align: center; font-weight: 800; }
.sc-warn { font-size: .66rem; color: #dc2626; text-align: center; margin-top: 8px; }
.sc-actions { display: flex; gap: 8px; margin-top: 14px; }
.sc-auto { border: 2px solid var(--ink); border-radius: 10px; padding: 9px 10px; font-family: inherit; font-weight: 800; font-size: .72rem; background: #fff; cursor: pointer; }
.sc-cancel { flex: 1; border: 2px solid var(--ink); border-radius: 10px; padding: 9px; font-family: inherit; font-weight: 800; background: #fff; cursor: pointer; }
.sc-ok { flex: 1; border: 2px solid var(--ink); border-radius: 10px; padding: 9px; font-family: inherit; font-weight: 800; color: #fff; background: #c9c2d4; cursor: pointer; }
.sc-ok.ready { background: var(--primary); box-shadow: var(--pop); }
.sc-ok:disabled { cursor: default; }
</style>
