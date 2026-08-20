<!-- PetStatLine — แถบสเตตัสย่อ เกรด · ⚔️ATK · ❤️HP (ใช้เลข combat จริง = buildCombatant)
     ใช้ทุกที่ที่โชว์เพ็ทแบบย่อ (คลังจัดทีม/หน้าเพ็ท/หอคอย) ให้เลขตรงกับที่ใช้สู้จริง -->
<template>
  <div class="psl">
    <span v-if="grade" class="psl-g">{{ gradeLabel }}</span>
    <span class="psl-atk"><Emoji char="⚔️" />{{ stat.atk }}</span>
    <span class="psl-hp"><Emoji char="❤️" />{{ stat.hp }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from './Emoji.vue'
import { getPetDef, GRADE_LABELS } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'

// pet = instance ({ id/species, rarity, grade }) — element ดึงจาก def (per-species)
const props = defineProps({ pet: { type: Object, default: null } })

const grade = computed(() => props.pet?.grade || 0)
const gradeLabel = computed(() => GRADE_LABELS[Math.min(grade.value, GRADE_LABELS.length - 1)] || grade.value)
const stat = computed(() => {
  const p = props.pet || {}
  const def = getPetDef(p.id || p.species) || {}
  const c = buildCombatant({ rarity: p.rarity || def.rarity, element: p.element || def.element, grade: p.grade })
  return { atk: Math.round(c.atk), hp: Math.round(c.maxHp) }
})
</script>

<style scoped>
.psl { display: inline-flex; align-items: center; gap: 5px; font-size: .7rem; font-weight: 800; line-height: 1; }
.psl-g { background: #1e293b; color: #fff; padding: 1px 5px; border-radius: 999px; }
.psl-atk, .psl-hp { display: inline-flex; align-items: center; gap: 1px; }
.psl-atk { color: #d97706; }
.psl-hp { color: #dc2626; }
</style>
