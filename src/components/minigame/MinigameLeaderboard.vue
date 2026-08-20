<template>
  <div class="mlb">
    <div class="mlb-head">🏆 อันดับ {{ game?.name }}</div>
    <div v-if="loading && !rows.length" class="mlb-empty">กำลังโหลด…</div>
    <div v-else-if="!rows.length" class="mlb-empty">ยังไม่มีใครทำคะแนน — เป็นคนแรกเลย!</div>
    <div v-else class="mlb-list">
      <div v-for="(r, i) in rows" :key="r.uid" class="mlb-row" :class="{ me: r.isMe }">
        <span class="mlb-rank">{{ medal(i) }}</span>
        <span class="mlb-nick">{{ r.nickname }}<span v-if="r.isMe" class="mlb-you"> (คุณ)</span></span>
        <span class="mlb-best">{{ r.best.toLocaleString() }} {{ game?.scoreLabel }}</span>
      </div>
    </div>
    <div class="mlb-foot">แสดงเฉพาะผู้ที่ทำคะแนนแล้ว · สูงสุด 50 อันดับ</div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useMinigameBoard } from '../../composables/useMinigameBoard.js'
import { getMinigame } from '../../data/minigames.js'

const props = defineProps({ gameKey: { type: String, required: true } })
const game = getMinigame(props.gameKey)
const { rows, loading, load } = useMinigameBoard(props.gameKey)
onMounted(load)

const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)
</script>

<style scoped>
.mlb { padding: 4px 2px; }
.mlb-head { font-weight: 800; font-size: 1rem; margin-bottom: 8px; }
.mlb-empty { text-align: center; color: rgba(0,0,0,.45); padding: 24px 0; font-size: .85rem; }
.mlb-list { display: flex; flex-direction: column; gap: 4px; }
.mlb-row { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 12px; background: rgba(0,0,0,.03); font-size: .82rem; }
.mlb-row.me { background: rgba(79,70,229,.12); font-weight: 700; }
.mlb-rank { text-align: center; font-weight: 800; }
.mlb-nick { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mlb-you { color: #4f46e5; font-size: .72rem; }
.mlb-best { font-weight: 800; color: #4f46e5; }
.mlb-foot { text-align: center; font-size: .7rem; color: rgba(0,0,0,.4); padding-top: 8px; }
</style>
