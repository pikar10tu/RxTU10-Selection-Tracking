<!--
  FloorSheet — แผงรายละเอียดชั้นหอคอย (แตะโหนดหรือแตะรางเพื่อนก็เปิดอันนี้)
  ทุกอย่างคำนวณฝั่ง client จาก towerFloors.js — 0 Firestore read
  ใช้ BottomSheet ที่ Teleport ไป body ให้แล้ว (ห้ามเขียน overlay เอง — CLAUDE.md ข้อ 6)
-->
<template>
  <BottomSheet :open="floor !== null" :icon="zone.art"
               :title="`ชั้น ${floor ?? ''} · ${zone.name}`"
               @update:open="$emit('close')">
    <div class="fs">
      <div class="fs-bonus">
        <Emoji char="🪙" /> พิชิตถึงชั้นนี้ = โบนัสรายได้ +{{ bonus.toLocaleString() }}/วัน
      </div>

      <div class="fs-sec">ศัตรูที่รออยู่</div>
      <div class="fs-team">
        <div v-for="(p, i) in botTeam" :key="i" class="fs-mon"><PetThumb :pet="p" /></div>
      </div>

      <div v-if="friends.length" class="fs-sec">เพื่อนที่พิชิตถึงชั้นนี้ ({{ friends.length }})</div>
      <ul v-if="friends.length" class="fs-friends">
        <li v-for="f in friends" :key="f.uid" class="fs-friend">
          <img class="fs-face" :src="f.photo || letterAvatar(f.name, 52)" :alt="''"
               width="28" height="28" loading="lazy" decoding="async"
               @error="fallbackAvatar($event, f.name, 52)" />
          <span class="fs-name">{{ f.name }}</span>
        </li>
      </ul>

      <button v-if="floor === currentFloor" class="fs-fight" @click="$emit('fight')">
        <Emoji char="⚔️" /> สู้ชั้นนี้
      </button>
    </div>
  </BottomSheet>
</template>

<script setup>
import { computed } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'
import PetThumb from '../shared/PetThumb.vue'
import Emoji from '../shared/Emoji.vue'
import { letterAvatar, fallbackAvatar } from '../../utils/avatar.js'
import { floorZone, getFloorTeam, getTowerBonus } from '../../data/towerFloors.js'

const props = defineProps({
  floor:        { type: Number, default: null },     // null = ปิด
  crowd:        { type: Map,    default: () => new Map() },
  currentFloor: { type: Number, required: true },
})
defineEmits(['close', 'fight'])

// floor เป็น null ตอนปิด → fallback ชั้น 1 กัน floorZone/getFloorTeam พัง
const safe    = computed(() => props.floor ?? 1)
const zone    = computed(() => floorZone(safe.value))
const botTeam = computed(() => getFloorTeam(safe.value))
const bonus   = computed(() => getTowerBonus(safe.value))
const friends = computed(() => props.crowd?.get(safe.value)?.all || [])
</script>

<style scoped>
.fs { display: flex; flex-direction: column; gap: 10px; }
.fs-bonus {
  padding: 8px 10px; border-radius: 10px;
  background: #fffbeb; border: 1.5px solid var(--gold);
  font-size: .78rem; font-weight: 700; color: #b45309;
  display: flex; align-items: center; gap: 5px;
}
.fs-sec { font-size: .76rem; font-weight: 800; color: var(--muted); margin-top: 2px; }
.fs-team { display: flex; gap: 8px; }
.fs-mon { width: 58px; flex-shrink: 0; }

.fs-friends { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.fs-friend {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 9px 4px 4px; border-radius: 999px; background: #f1f5f9;
}
.fs-face { width: 28px; height: 28px; border-radius: 999px; background: #cbd5e1; object-fit: cover; display: block; }
.fs-name { font-size: .78rem; font-weight: 700; color: var(--ink); }

.fs-fight {
  margin-top: 4px; border: 2px solid var(--ink); border-radius: 12px;
  padding: 12px; min-height: 44px;
  font-family: inherit; font-size: .92rem; font-weight: 800;
  color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.fs-fight:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
</style>
