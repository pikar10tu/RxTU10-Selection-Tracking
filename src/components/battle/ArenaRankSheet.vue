<!-- ArenaRankSheet — กระดานอันดับแต้มประลองเต็มทั้งรุ่น
     ข้อมูลมาจาก arenaRanking().all ที่หน้าสนามคำนวณไว้แล้ว → **ไม่มี Firestore read เพิ่ม**
     BottomSheet ห่อ Teleport to body ให้แล้ว (ไม่งั้น #bottom-nav จะทับก้นแผ่น — CLAUDE.md ข้อ 6)
     เปิดจากการ์ดในหน้า ไม่ได้เปิดจากใน overlay อื่น ⇒ ใช้ชั้นฐาน 400 ของ BottomSheet ได้ (ข้อ 12) -->
<template>
  <BottomSheet :open="open" icon="🏆" title="อันดับสนามประลอง" @update:open="$emit('update:open', $event)">
    <ol class="ars-list">
      <li
        v-for="r in rows" :key="r.uid"
        :ref="el => { if (r.isMe) meEl = el }"
        class="ars-row" :class="{ me: r.isMe }"
      >
        <span class="ars-medal">{{ medal(r.rank) }}</span>
        <span class="ars-name">{{ r.nickname }}<span v-if="r.isMe" class="ars-badge">คุณ</span></span>
        <span class="ars-wl">{{ r.wins }}–{{ r.losses }}</span>
        <span class="ars-rt">{{ r.rating.toLocaleString() }}</span>
      </li>
      <li v-if="!rows.length" class="ars-empty">ยังไม่มีใครลงสนามเลย — เป็นคนแรกสิ!</li>
    </ol>
  </BottomSheet>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import BottomSheet from '../shared/BottomSheet.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },   // [{ uid, nickname, rating, wins, losses, rank, isMe }]
})
defineEmits(['update:open'])

const meEl = ref(null)
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank))

// เปิดแผ่นมา → เลื่อนมาที่แถวตัวเองเลย (ทั้งรุ่น 50+ คน ไม่งั้นต้องไถหาเองทุกครั้ง)
// nextTick รอ v-if ของ BottomSheet วาดเสร็จก่อน ไม่งั้น ref ยังเป็น null
watch(() => props.open, async (o) => {
  if (!o) return
  await nextTick()
  meEl.value?.scrollIntoView({ block: 'center' })
})
</script>

<style scoped>
.ars-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ars-row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 10px; }
.ars-row.me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.ars-medal { font-size: .95rem; flex-shrink: 0; min-width: 26px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.ars-name { font-size: .84rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.ars-badge { margin-left: 6px; font-size: .7rem; font-weight: 800; color: var(--primary); }
.ars-wl { font-size: .74rem; font-weight: 700; color: var(--muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.ars-rt { font-size: .84rem; font-weight: 800; color: var(--ink); flex-shrink: 0; min-width: 46px; text-align: right; font-variant-numeric: tabular-nums; }
.ars-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .8rem; padding: 20px 8px; }
</style>
