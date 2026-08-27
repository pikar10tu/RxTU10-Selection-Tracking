<!-- TowerRankSheet — กระดานอันดับหอคอยเต็มทั้งรุ่น
     ข้อมูลมาจาก towerRanking().all ที่หน้าหอคอยคำนวณไว้แล้ว → **ไม่มี Firestore read เพิ่ม**
     BottomSheet ห่อ Teleport to body ให้แล้ว (ไม่งั้น #bottom-nav จะทับก้นแผ่น — CLAUDE.md ข้อ 6) -->
<template>
  <BottomSheet :open="open" icon="🏆" title="อันดับหอคอย" @update:open="$emit('update:open', $event)">
    <ol ref="listEl" class="trs-list">
      <li
        v-for="r in rows" :key="r.uid"
        :ref="el => { if (r.isMe) meEl = el }"
        class="trs-row" :class="{ me: r.isMe }"
      >
        <span class="trs-medal">{{ medal(r.rank) }}</span>
        <span class="trs-name">{{ r.nickname }}<span v-if="r.isMe" class="trs-badge">คุณ</span></span>
        <span class="trs-floor">ชั้น {{ r.floor }}</span>
      </li>
      <li v-if="!rows.length" class="trs-empty">ยังไม่มีใครไต่ถึงชั้น 1 เลย — เป็นคนแรกสิ!</li>
    </ol>
  </BottomSheet>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },   // [{ uid, nickname, floor, rank, isMe }]
})
defineEmits(['update:open'])

const listEl = ref(null)
const meEl = ref(null)

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank))

// เปิดแผ่นมา → เลื่อนมาที่แถวตัวเองเลย (กระดาน 50+ คน ถ้าไม่เลื่อนให้ ต้องไถหาเองทุกครั้ง)
// nextTick รอ v-if ของ BottomSheet วาดเสร็จก่อน ไม่งั้น ref ยังเป็น null
watch(() => props.open, async (o) => {
  if (!o) return
  await nextTick()
  meEl.value?.scrollIntoView({ block: 'center' })
})
</script>

<style scoped>
.trs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.trs-row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 10px; }
.trs-row.me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.trs-medal { font-size: .95rem; flex-shrink: 0; min-width: 26px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.trs-name { font-size: .84rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.trs-badge { display: inline-block; font-size: .7rem; font-weight: 800; color: #fff; background: var(--primary); padding: 1px 6px; border-radius: 999px; margin-left: 5px; vertical-align: middle; }
.trs-floor { font-size: .8rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.trs-empty { font-size: .78rem; color: var(--muted); text-align: center; padding: 20px 0; }
</style>
