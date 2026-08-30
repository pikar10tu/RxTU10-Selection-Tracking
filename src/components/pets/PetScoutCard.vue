<!-- PetScoutCard — การ์ดสอดแนมเพ็ท (สเตตัส + ทักษะเฉพาะ) ใช้ร่วมหอคอย/แผ่นชั้น/สนามประลอง
     ก่อนหน้านี้การ์ดแบบนี้เขียนซ้ำ 3 ที่ (tw-scout · br-card · PetStatPopup) และไม่มีที่ไหนบอกพาสสีฟเลย
     ยกเว้น br-card — ผู้เล่นจึงจัดทีมสู้ศัตรูโดยไม่รู้ว่าอีกฝั่งมีสกิลอะไร
     ⚠️ BattleReplay ไม่ใช้ตัวนี้ — การ์ดในนั้นมีบัฟสดเพิ่มและอยู่ใต้กฎ perf ของสนามรบ
     ⚠️ ATK/HP ที่โชว์เป็น "ค่าดิบ" ยังไม่ผ่าน aura — ตรงกับเลขที่รีเพลย์เปิดมาตอน READY-GO
        (แล้วผู้เล่นจะได้เห็นมันขยับตอนสกิลทำงานจริงในไฟต์) -->
<template>
  <!-- Teleport ไป body: #main-content เป็น stacking context (CLAUDE.md ข้อ 6)
       z410 เพราะถูกเปิดจากในแผ่นชั้นหอคอยซึ่งเป็น BottomSheet z400 (CLAUDE.md ข้อ 12)
       ห้ามหยิบ z240 ของ tw-scout เดิมมาใช้ — ตัวนั้นเปิดจากหน้าเปล่าเลยรอด -->
  <Teleport to="body">
    <div v-if="pet" class="psc-ov" @click.self="$emit('close')">
      <div class="psc-box">
        <div class="psc-emoji"><Emoji :char="def.emoji" /></div>
        <div class="psc-name">{{ def.name }}</div>
        <div class="psc-row"><span>สาย</span><b><Emoji :char="elEmoji" /> {{ elName }}</b></div>
        <div class="psc-row"><span>ระดับ</span><b>{{ rarityLabel }} · เกรด {{ gradeLabel }}</b></div>
        <div class="psc-row"><span>พลังโจมตี</span><b>{{ stat.atk }}</b></div>
        <div class="psc-row"><span>พลังชีวิต</span><b>{{ stat.hp }}</b></div>

        <div class="psc-sep"></div>
        <template v-if="passive">
          <div class="psc-skill"><Emoji :char="passive.icon" /> {{ passive.name }}</div>
          <div class="psc-skill-desc">{{ passiveText(passive, pet.passiveLv) }}</div>
        </template>
        <div v-else class="psc-skill-desc">ตัวนี้ยังไม่มีทักษะเฉพาะ</div>

        <button class="psc-x" @click="$emit('close')">ปิด</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { getPetDef, passiveOf, RARITY, GRADE_LABELS, ELEMENTS, EL_NAME } from '../../data/index.js'
import { passiveText } from '../../data/petPassives.js'
import { buildCombatant } from '../../data/battle.js'
import { useEscapeKey } from '../../composables/useEscapeKey.js'

const props = defineProps({ pet: { type: Object, default: null } })   // null = ปิด
const emit = defineEmits(['close'])
useEscapeKey(() => !!props.pet, () => emit('close'))

const def = computed(() => getPetDef(props.pet?.id) || { emoji: '❓', name: '?', element: 'scissors', rarity: 'common' })
const passive = computed(() => passiveOf(def.value))
const elEmoji = computed(() => ELEMENTS[def.value.element]?.emoji || '✊')
const elName = computed(() => EL_NAME[def.value.element] || def.value.element)
const rarityLabel = computed(() => RARITY[props.pet?.rarity || def.value.rarity]?.label || def.value.rarity)
const gradeLabel = computed(() => GRADE_LABELS[Math.min(GRADE_LABELS.length - 1, Math.max(0, props.pet?.grade || 0))])
const stat = computed(() => {
  if (!props.pet) return { atk: 0, hp: 0 }
  const c = buildCombatant(props.pet)
  return { atk: Math.round(c.atk), hp: Math.round(c.maxHp) }
})
</script>

<style scoped>
/* ⚠️ พื้นการ์ดเข้ม #1e293b — ตัวอักษรต้องสว่างทั้งหมด ห้าม rgba(0,0,0,…) (CLAUDE.md ข้อ 13) */
.psc-ov { position: fixed; inset: 0; z-index: 410; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.psc-box { background: #1e293b; color: #fff; border: 2px solid #fff; border-radius: 18px; padding: 16px 18px; width: 268px; display: flex; flex-direction: column; gap: 7px; max-height: 88vh; overflow-y: auto; }
.psc-emoji { font-size: 2.8rem; text-align: center; }
.psc-name { text-align: center; font-weight: 800; font-size: 1.1rem; margin-bottom: 4px; }
.psc-row { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; }
.psc-row span { color: rgba(255,255,255,.6); }
.psc-sep { height: 1px; background: rgba(255,255,255,.16); margin: 4px 0 2px; }
.psc-skill { font-size: .84rem; font-weight: 800; color: #fde68a; }
.psc-skill-desc { font-size: .76rem; line-height: 1.5; color: #cbd5e1; }
.psc-x { margin-top: 10px; border: 2px solid #fff; background: rgba(255,255,255,.14); color: #fff; border-radius: 12px; padding: 9px; font-family: inherit; font-weight: 800; cursor: pointer; }
</style>
