<template>
  <div class="tab-content">
    <div class="pt-head">
      <button class="pt-back" aria-label="กลับ" @click="$router.push('/play/pets')">‹</button>
      <span><Emoji char="🐾" /> สัตว์เลี้ยง</span>
      <HelpButton topic="pets" style="margin-left:auto" />
    </div>

    <template v-if="authStore.isLoggedIn">
      <div class="pt-team">
        <div class="pt-team-head">
          <span><Emoji char="⚔️" /> ทีมต่อสู้ ({{ teamSlots.filter(Boolean).length }}/{{ battleSlots }})</span>
          <button class="pt-team-edit" @click="pickOpen = true">จัดทีม</button>
        </div>
        <div class="pt-team-slots" :style="{ gridTemplateColumns: `repeat(${battleSlots}, 78px)` }">
          <div v-for="(id, i) in teamSlots" :key="i" class="pt-team-slot" :class="{ filled: id }" @click="id ? sel = id : pickOpen = true">
            <PetThumb v-if="id" :pet="teamPetOf(id)" />
            <span v-else class="pt-team-empty">+</span>
          </div>
        </div>
      </div>

      <div class="pt-summary">
        <div><b>{{ pets.length }}</b>/{{ PETS.length }} <small>ชนิด</small></div>
        <div><b>{{ totalIncome.toLocaleString() }}</b><small><Emoji char="🪙" />/วัน</small></div>
        <div><b>{{ species }}</b><small>สายพันธุ์</small></div>
      </div>
      <div class="pt-hint">แตะตัวไหนก็ได้เพื่อดูรายละเอียด · วิวัฒน์</div>

      <div v-if="!sorted.length" class="pt-empty">
        ยังไม่มีสัตว์เลี้ยง — ไปกดอัญเชิญตัวแรกกันเถอะ <Emoji char="🥚" />
        <RouterLink to="/shop" class="pt-empty-cta">ไปอัญเชิญเลย →</RouterLink>
      </div>

      <div v-else class="pt-grid">
        <button
          v-for="p in sorted" :key="p.id"
          class="pt-cell" :style="{ borderColor: rarityColor(p.rarity) }"
          @click="sel = p.id"
        >
          <span v-if="activeSet.has(p.id)" class="pt-cell-team">ทีม</span>
          <span v-if="p.copies > 0" class="pt-cell-copies">×{{ p.copies }}</span>
          <span class="pt-cell-el"><Emoji :char="ELEMENTS[defOf(p.id).element]?.emoji || '✊'" /></span>
          <span class="pt-cell-emoji"><Emoji :char="p.emoji" /></span>
          <span class="pt-cell-name">{{ p.name }}</span>
          <span v-if="clampGrade(p.grade) > 0" class="pt-cell-grade">{{ GRADE_LABELS[clampGrade(p.grade)] }}</span>
        </button>
      </div>
    </template>
    <div v-else class="pt-empty">เข้าสู่ระบบก่อนนะ</div>

    <PetDetailModal :pet-id="sel" @close="sel = null" />
    <TeamPicker v-model:open="pickOpen" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Emoji from '../components/shared/Emoji.vue'
import HelpButton from '../components/help/HelpButton.vue'
import { useAuthStore } from '../stores/auth.js'
import { RARITY, PETS, ELEMENTS, GRADE_LABELS } from '../data/index.js'
import { petDailyCoins } from '../utils/petUtils.js'
import { clampGrade } from '../data/petPower.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import PetDetailModal from '../components/pets/PetDetailModal.vue'
import TeamPicker from '../components/battle/TeamPicker.vue'
import PetThumb from '../components/shared/PetThumb.vue'

const authStore = useAuthStore()
const sel = ref(null)
const pickOpen = ref(false)

const pets = computed(() => authStore.userData?.pets || [])
const battleSlots = computed(() => BATTLE_SLOTS)
const teamSlots = computed(() => {
  const owned = new Set(pets.value.map(p => p.id))
  const a = (authStore.userData?.activePets || []).filter(id => id && owned.has(id)).slice(0, battleSlots.value)
  while (a.length < battleSlots.value) a.push(null)
  return a
})
const defOf = (id) => PETS.find(p => p.id === id) || { emoji: '❓' }
const teamPetOf = (id) => pets.value.find(p => p.id === id) || { id }
const totalIncome = computed(() => pets.value.reduce((s, p) => s + petDailyCoins(p), 0))
const species = computed(() => new Set(pets.value.map(p => p.id)).size)
const activeSet = computed(() => {
  const owned = new Set(pets.value.map(p => p.id))
  return new Set((authStore.userData?.activePets || []).filter(id => owned.has(id)))
})

const rarityColor = (r) => RARITY[r]?.color || '#94a3b8'
const RANK = { legendary: 0, epic: 1, rare: 2, common: 3 }
const sorted = computed(() => pets.value.slice().sort((a, b) =>
  (RANK[a.rarity] - RANK[b.rarity]) || ((b.grade || 0) - (a.grade || 0)) || a.name.localeCompare(b.name)
))
</script>

<style scoped>
.pt-head { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; color: var(--ink); margin-bottom: 14px; }
.pt-back { border: 2px solid var(--ink); background: #fff; width: 40px; height: 40px; border-radius: 10px; font-size: 1.2rem; cursor: pointer; line-height: 1; box-shadow: var(--pop); }
.pt-back:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pt-team { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px; margin-bottom: 10px; }
.pt-team-head { display: flex; align-items: center; justify-content: space-between; font-size: .8rem; font-weight: 800; margin-bottom: 8px; }
.pt-team-edit { border: 2px solid var(--ink); background: #fff; border-radius: 10px; padding: 5px 12px; font-family: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; box-shadow: var(--pop); }
.pt-team-edit:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pt-team-slots { display: grid; gap: 8px; justify-content: center; }
.pt-team-slot { aspect-ratio: 1; border: 2px dashed rgba(0,0,0,.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; background: #f8fafc; }
.pt-team-slot.filled { border: none; background: none; cursor: pointer; }
.pt-team-empty { color: rgba(0,0,0,.25); font-size: 1.4rem; }
.pt-summary { display: flex; background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); overflow: hidden; margin-bottom: 10px; }
.pt-summary > div { flex: 1; text-align: center; padding: 12px 4px; border-right: 1px solid var(--border, #efe7fb); }
.pt-summary > div:last-child { border-right: none; }
.pt-summary b { font-size: 1.05rem; font-weight: 800; }
.pt-summary small { display: block; font-size: .7rem; color: rgba(0,0,0,.45); }
.pt-hint { font-size: .7rem; color: rgba(0,0,0,.5); margin-bottom: 12px; }
.pt-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; color: rgba(0,0,0,.45); padding: 30px 16px; font-size: .85rem; }
.pt-empty-cta { border: 2px solid var(--ink); background: var(--primary); color: #fff; border-radius: 12px; padding: 11px 20px; font-weight: 800; font-size: .85rem; text-decoration: none; box-shadow: var(--pop); }
.pt-empty-cta:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pt-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.pt-cell {
  position: relative; background: #fff; border: 2px solid var(--ink); border-radius: 14px;
  padding: 12px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; font-family: inherit; box-shadow: var(--pop);
  transition: transform .1s, box-shadow .1s;
}
.pt-cell:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pt-cell-emoji { font-size: 1.8rem; line-height: 1; }
.pt-cell-name { font-size: .7rem; font-weight: 700; color: rgba(0,0,0,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pt-cell-copies { position: absolute; bottom: 2px; left: 4px; font-size: .7rem; font-weight: 800; color: rgba(0,0,0,.4); }
.pt-cell-el { position: absolute; top: 4px; left: 4px; font-size: .7rem; background: rgba(0,0,0,.06); border-radius: 7px; padding: 1px 3px; line-height: 1; }
.pt-cell-grade { position: absolute; bottom: -5px; right: -5px; background: #1e293b; color: #fff; font-size: .7rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; border: 2px solid #fff; line-height: 1.3; }
.pt-cell-team { position: absolute; top: -5px; right: -5px; background: var(--primary); color: #fff; font-size: .7rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; border: 2px solid #fff; }
</style>
