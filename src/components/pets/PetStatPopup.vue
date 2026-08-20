<template>
  <!-- Teleport ไป body: #main-content (position:fixed) = stacking context → z-index สู้ #bottom-nav (z200) ไม่ได้ถ้า render ในนี้ (ดู CLAUDE.md) -->
  <Teleport to="body">
  <div v-if="pet" class="ps-ov" @click.self="$emit('close')">
    <div class="ps-box">
      <div class="ps-hero" :style="{ background: `linear-gradient(135deg, ${rc}, ${rc}aa)` }">
        <button class="ps-x" aria-label="ปิด" @click="$emit('close')">✕</button>
        <div class="ps-emoji"><Emoji :char="pet.emoji" /></div>
        <div class="ps-name">{{ pet.name }}</div>
        <div class="ps-tags">
          <span class="ps-tag">{{ rarityLabel }}</span>
          <span class="ps-tag" v-if="pet.grade > 0">เกรด {{ GRADE_LABELS[Math.min(pet.grade, GRADE_LABELS.length - 1)] }}</span>
        </div>
      </div>

      <div class="ps-stats">
        <div class="ps-stat"><span><Emoji char="⚔️" /></span><b>{{ atk }}</b><small>ATK</small></div>
        <div class="ps-stat"><span><Emoji char="❤️" /></span><b>{{ hp }}</b><small>HP</small></div>
        <div class="ps-stat"><span><Emoji char="💰" /></span><b>{{ income }}</b><small>/วัน</small></div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { RARITY, GRADE_LABELS, getPetDef } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'
import { petDailyCoins } from '../../utils/petUtils.js'
import { useEscapeKey } from '../../composables/useEscapeKey.js'

const props = defineProps({ pet: { type: Object, default: null } })
const emit = defineEmits(['close'])
useEscapeKey(() => !!props.pet, () => emit('close'))

const rc = computed(() => RARITY[props.pet?.rarity]?.color || '#94a3b8')
const rarityLabel = computed(() => RARITY[props.pet?.rarity]?.label || props.pet?.rarity)
// เลข combat จริง (= ที่ใช้สู้) — element จาก def
const combat = computed(() => {
  const p = props.pet; if (!p) return { atk: 0, maxHp: 0 }
  return buildCombatant({ rarity: p.rarity, element: getPetDef(p.id)?.element || p.element, grade: p.grade })
})
const atk = computed(() => Math.round(combat.value.atk))
const hp = computed(() => Math.round(combat.value.maxHp))
const income = computed(() => props.pet ? petDailyCoins(props.pet) : 0)
</script>

<style scoped>
.ps-ov { position: fixed; inset: 0; z-index: 250; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.ps-box { background: #fff; width: 100%; max-width: 320px; border-radius: 20px; overflow: hidden; max-height: 88vh; overflow-y: auto; }
.ps-hero { position: relative; padding: 20px 16px 14px; text-align: center; color: #fff; }
.ps-x { position: absolute; left: 10px; top: 10px; border: none; background: rgba(255,255,255,.25); color: #fff; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ps-emoji { font-size: 3rem; }
.ps-name { font-size: 1.1rem; font-weight: 800; }
.ps-tags { display: flex; gap: 5px; justify-content: center; margin-top: 6px; }
.ps-tag { background: rgba(255,255,255,.25); font-size: .7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.ps-stats { display: flex; }
.ps-stat { flex: 1; text-align: center; padding: 13px 4px; border-right: 1px solid rgba(0,0,0,.06); }
.ps-stat:last-child { border-right: none; }
.ps-stat b { display: block; font-size: 1.1rem; font-weight: 800; }
.ps-stat small { font-size: .7rem; color: rgba(0,0,0,.45); }
.ps-substats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 6px 14px; font-size: .7rem; color: rgba(0,0,0,.55); font-weight: 600; }
.ps-pot { padding: 10px 16px 16px; border-top: 1px solid rgba(0,0,0,.06); }
.ps-pot-head { font-weight: 800; font-size: .76rem; margin-bottom: 6px; }
.ps-pot-list { display: flex; flex-wrap: wrap; gap: 5px; }
.ps-aff { background: #f4edff; color: #7c3aed; font-size: .7rem; font-weight: 800; padding: 3px 8px; border-radius: 8px; }
</style>
