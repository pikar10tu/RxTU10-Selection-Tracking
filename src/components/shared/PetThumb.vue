<!-- PetThumb — การ์ดเพ็ทสไตล์ Hearthstone: ธาตุ↖ · เกรด↗ · ATK↙ · HP↘ (เลข combat จริง)
     ใช้ที่ active pet slots + member card · เติมเต็มกล่องพ่อแม่ (parent คุมขนาด ≥56px) -->
<template>
  <div class="ptc" :class="{ bordered }" :style="bordered ? { borderColor: rarityColor } : null">
    <span class="ptc-el"><Emoji :char="elEmoji" /></span>
    <span v-if="grade" class="ptc-gr">{{ gradeLabel }}</span>
    <span class="ptc-face"><Emoji :char="def.emoji" /></span>
    <span class="ptc-atk">{{ stat.atk }}</span>
    <span class="ptc-hp">{{ stat.hp }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from './Emoji.vue'
import { getPetDef, RARITY, ELEMENTS, GRADE_LABELS } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'

const props = defineProps({
  pet: { type: Object, default: null },     // instance ({id/species, rarity, grade})
  bordered: { type: Boolean, default: true },
})

const def = computed(() => getPetDef(props.pet?.id || props.pet?.species) || { emoji: '❓', element: 'scissors', rarity: 'common' })
const grade = computed(() => props.pet?.grade || 0)
const gradeLabel = computed(() => GRADE_LABELS[Math.min(grade.value, GRADE_LABELS.length - 1)] || grade.value)
const elEmoji = computed(() => ELEMENTS[def.value.element]?.emoji || '✊')
const rarityColor = computed(() => RARITY[props.pet?.rarity || def.value.rarity]?.color || '#cbd5e1')
const stat = computed(() => {
  const p = props.pet || {}
  const c = buildCombatant({ rarity: p.rarity || def.value.rarity, element: def.value.element, grade: p.grade })
  return { atk: Math.round(c.atk), hp: Math.round(c.maxHp) }
})
</script>

<style scoped>
.ptc { position: relative; width: 100%; aspect-ratio: 1; border-radius: 12px; background: rgba(0,0,0,.04); display: flex; align-items: center; justify-content: center; }
.ptc.bordered { border: 2px solid #cbd5e1; }
.ptc-face { font-size: 1.7rem; line-height: 1; }
.ptc-el { position: absolute; top: 2px; left: 3px; font-size: .7rem; line-height: 1; }
.ptc-gr { position: absolute; top: -5px; right: -5px; background: #1e293b; color: #fff; font-size: .7rem; font-weight: 800; padding: 0 4px; border-radius: 999px; border: 1.5px solid #fff; line-height: 1.5; }
.ptc-atk, .ptc-hp { position: absolute; bottom: 1px; font-size: .7rem; font-weight: 800; color: #fff; min-width: 13px; text-align: center; padding: 1px 3px; border-radius: 999px; line-height: 1.25; }
.ptc-atk { left: 1px; background: #f59e0b; }   /* ATK ↙ = amber */
.ptc-hp { right: 1px; background: #dc2626; }    /* HP ↘ = red */
</style>
