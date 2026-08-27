<!-- src/components/study/TaBoard.vue -->
<!-- กระดานอันดับ Time Attack — อ่านจาก roster ที่โหลดอยู่แล้ว ⇒ ไม่มี read เพิ่ม
     ⚠️ ใช้ rosterRows ไม่ใช่ rosterUsers (rosterUsers คีย์ด้วย studentId จึงตก guest ทั้งหมด) -->
<template>
  <div class="tb">
    <div class="tb-head">
      <span class="tb-title"><Emoji char="🏅" /> อันดับในรุ่น · {{ label }}</span>
    </div>
    <div v-if="members.rosterLoading && !board.top.length" class="tb-empty">กำลังโหลด…</div>
    <div v-else-if="!board.top.length" class="tb-empty">ยังไม่มีใครทำสถิติไว้ — เป็นคนแรกเลยไหม?</div>
    <template v-else>
      <div v-for="r in board.top" :key="r.uid" class="tb-row" :class="{ me: r.isMe }">
        <span class="tb-rank" :class="'r' + r.rank">{{ r.rank }}</span>
        <span class="tb-name">{{ r.name }}<span v-if="r.isMe" class="tb-you"> (คุณ)</span></span>
        <span class="tb-best">{{ r.best }} ข้อ</span>
      </div>
      <div v-if="board.mine" class="tb-row me tb-mine">
        <span class="tb-rank">{{ board.mine.rank }}</span>
        <span class="tb-name">{{ board.mine.name }}<span class="tb-you"> (คุณ)</span></span>
        <span class="tb-best">{{ board.mine.best }} ข้อ</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useMembersStore } from '../../stores/members.js'
import { taBoard, getTaMode } from '../../utils/timeAttack.js'

const props = defineProps({ modeKey: { type: String, required: true } })

const auth = useAuthStore()
const members = useMembersStore()

const mode = computed(() => getTaMode(props.modeKey))
const label = computed(() => mode.value?.label || '')

// overlay ค่าสดของเราทับแถว roster — เพิ่งจบรอบแล้ว roster อาจยังไม่ทัน sync
const me = computed(() => {
  const u = auth.userData
  if (!u || !auth.currentUser) return null
  return {
    uid: auth.currentUser.uid,
    name: u.nickname || u.name?.split(' ')[0] || 'ฉัน',
    photo: u.googlePhoto || null,
    best: u.timeAttack?.[mode.value?.bestField] || 0,
  }
})

const board = computed(() => taBoard(members.rosterRows || {}, me.value, mode.value?.rowKey || 'ta4'))
</script>

<style scoped>
.tb { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; }
.tb-head { margin-bottom: 8px; }
.tb-title { font-size: .84rem; font-weight: 800; }
.tb-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px dashed rgba(0,0,0,.12); font-size: .78rem; }
.tb-row.me { background: var(--primary-light); border-radius: 8px; padding-left: 6px; padding-right: 6px; }
.tb-mine { margin-top: 6px; border-top: 2px solid rgba(0,0,0,.18); }
.tb-rank { width: 24px; text-align: center; font-weight: 800; color: rgba(0,0,0,.45); flex-shrink: 0; font-size: .76rem; }
.tb-rank.r1 { color: #d97706; }
.tb-rank.r2 { color: #64748b; }
.tb-rank.r3 { color: #b45309; }
.tb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.tb-you { color: var(--primary); font-weight: 800; }
.tb-best { font-weight: 800; flex-shrink: 0; }
.tb-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .76rem; padding: 14px 8px; line-height: 1.6; }
</style>
