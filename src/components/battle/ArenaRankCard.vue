<!-- ArenaRankCard — กระดานอันดับแต้มประลองในหน้า (top 10 + หน้าต่างรอบตัวเรา)
     แถวบางๆ ไม่มีขอบรายแถว — ตั้งใจให้เบากว่าการ์ดคู่ต่อสู้ที่เป็นของ "กดได้"
     ไม่มี Firestore read เพิ่ม — rivals คำนวณจาก rosterRows ที่ ArenaView โหลดไว้แล้ว -->
<template>
  <div v-if="rivals && rivals.total" class="arc">
    <div class="arc-head">
      <span class="arc-title"><Emoji char="🏆" /> อันดับในรุ่น</span>
      <span class="arc-my">{{ rivals.myRank ? `อันดับ ${rivals.myRank} จาก ${rivals.total}` : `ทั้งหมด ${rivals.total} คน` }}</span>
    </div>
    <div v-if="rivals.chaseName" class="arc-chase">
      ไล่ {{ rivals.chaseName }} อีก {{ rivals.chaseGap.toLocaleString() }} แต้ม
    </div>

    <div class="arc-rows">
      <template v-for="(r, i) in rows" :key="r.kind === 'gap' ? 'gap' + i : r.uid">
        <div v-if="r.kind === 'gap'" class="arc-gap">⋯</div>
        <div v-else class="arc-row" :class="{ me: r.isMe }">
          <span class="arc-medal">{{ medal(r.rank) }}</span>
          <span class="arc-name">{{ r.nickname }}<span v-if="r.isMe" class="arc-you">คุณ</span></span>
          <span class="arc-wl">{{ r.wins }}–{{ r.losses }}</span>
          <span class="arc-rt">{{ r.rating.toLocaleString() }}</span>
        </div>
      </template>
      <div v-if="!rivals.myRank" class="arc-none">คุณยังไม่ติดอันดับ — บุกสัก 1 ครั้งก็ขึ้นแล้ว</div>
    </div>

    <button class="arc-all" @click="open = true">ดูอันดับทั้งหมด ({{ rivals.total }})</button>
    <ArenaRankSheet v-model:open="open" :rows="rivals.all" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import ArenaRankSheet from './ArenaRankSheet.vue'
import { TOP_COUNT } from '../../utils/arenaRivals.js'

const props = defineProps({
  rivals: { type: Object, default: null },   // ผลของ arenaRanking()
})

const open = ref(false)
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank))

// หัวตาราง TOP_COUNT แถว + หน้าต่างรอบตัวเรา · ตัวคั่น ⋯ เฉพาะตอนมีช่องว่างจริง
// ⚠️ ต้องกันแถวซ้ำ: ถ้าเราอยู่ในหัวตารางอยู่แล้ว หน้าต่าง around จะทับกันพอดี
const rows = computed(() => {
  const r = props.rivals
  if (!r) return []
  const out = r.top.map(u => ({ ...u, kind: 'row' }))
  const extra = r.around.filter(u => u.rank > TOP_COUNT)
  if (!extra.length) return out
  if (extra[0].rank > TOP_COUNT + 1) out.push({ kind: 'gap' })
  return out.concat(extra.map(u => ({ ...u, kind: 'row' })))
})
</script>

<style scoped>
.arc { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; margin-top: 16px; }
.arc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.arc-title { font-size: .88rem; font-weight: 800; }
.arc-my { font-size: .72rem; font-weight: 700; color: var(--muted); white-space: nowrap; }
.arc-chase { font-size: .74rem; color: var(--muted); margin-top: 2px; }

.arc-rows { margin-top: 8px; display: flex; flex-direction: column; }
.arc-row { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 9px; }
.arc-row.me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.arc-medal { font-size: .86rem; flex-shrink: 0; min-width: 24px; text-align: center; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.arc-name { font-size: .8rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arc-you { margin-left: 6px; font-size: .7rem; font-weight: 800; color: var(--primary); }
.arc-wl { font-size: .72rem; font-weight: 700; color: var(--muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.arc-rt { font-size: .82rem; font-weight: 800; flex-shrink: 0; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
.arc-gap { text-align: center; color: rgba(0,0,0,.35); font-size: .8rem; line-height: 1; padding: 2px 0; }
.arc-none { font-size: .74rem; color: var(--muted); text-align: center; padding: 8px 4px 2px; line-height: 1.5; }

.arc-all { margin-top: 10px; width: 100%; border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 8px 12px; font-family: inherit; font-weight: 800; font-size: .76rem; cursor: pointer; box-shadow: var(--pop); }
.arc-all:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
</style>
