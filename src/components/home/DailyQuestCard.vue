<template>
  <div class="dq-body">
    <div class="dq-tasks">
      <div class="dq-task" :class="{ done: q.quiz >= GOALS.quiz }">
        <span class="dq-task-l"><Emoji char="📝" /> ทำข้อสอบ</span>
        <span class="dq-task-n">{{ Math.min(q.quiz, GOALS.quiz) }}/{{ GOALS.quiz }}</span>
      </div>
      <div class="dq-task" :class="{ done: q.farm >= GOALS.farm }">
        <span class="dq-task-l"><Emoji char="🌱" /> ปลูกพืช</span>
        <span class="dq-task-n">{{ Math.min(q.farm, GOALS.farm) }}/{{ GOALS.farm }}</span>
      </div>
      <div class="dq-task" :class="{ done: q.gacha >= GOALS.gacha }">
        <span class="dq-task-l"><Emoji char="🎰" /> อัญเชิญเพ็ท</span>
        <span class="dq-task-n">{{ Math.min(q.gacha, GOALS.gacha) }}/{{ GOALS.gacha }}</span>
      </div>
    </div>

    <button v-if="!claimed" class="dq-claim" :class="{ ready: claimable }" :disabled="!claimable || claiming" @click="claimReward">
      {{ claiming ? 'กำลังรับ…' : (claimable ? `รับรางวัล — รายได้ ×1.5 + ตั๋วฟรี ×${QUEST_TICKETS}` : 'ทำให้ครบเพื่อรับรางวัล') }}
    </button>
    <div v-else class="dq-claimed"><Emoji char="✅" /> รับรางวัลแล้ววันนี้</div>

    <div v-if="buffActive" class="dq-buff"><Emoji char="⚡" /> รายได้ ×1.5 · เหลือ {{ buffRemain }}</div>
    <div v-if="tickets > 0" class="dq-ticket"><Emoji char="🎟️" /> ตั๋วอัญเชิญฟรี ×{{ tickets }} (ใช้ที่ร้านค้า)</div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'
import { QUEST_GOALS, BUFF_MS, QUEST_TICKETS, questClaimable } from '../../utils/dailyQuest.js'

const auth = useAuthStore()
const { toast } = useToast()
const GOALS = QUEST_GOALS

const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

const today = () => new Date().toISOString().slice(0, 10)
const q = computed(() => {
  const dq = auth.userData?.dailyQuest
  return (dq && dq.date === today()) ? dq : { date: today(), quiz: 0, study: 0, gacha: 0, claimed: false }
})
const claimed = computed(() => q.value.claimed)
const claimable = computed(() => questClaimable(auth.userData?.dailyQuest, today()))
const tickets = computed(() => auth.userData?.freeGachaTickets || 0)
const buffActive = computed(() => (auth.userData?.incomeBuffUntil || 0) > now.value)
const buffRemain = computed(() => {
  const s = Math.max(0, Math.ceil(((auth.userData?.incomeBuffUntil || 0) - now.value) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}ชม ${m}น` : `${m}น`
})

const claiming = ref(false)
async function claimReward() {
  if (claiming.value || !claimable.value) return
  claiming.value = true
  const t = Date.now()
  const curUntil = auth.userData?.incomeBuffUntil || 0
  const active = curUntil > t
  // สแตค: บัฟยัง active → ต่อเวลา +24ชม. จากปลายเดิม (คงเวลาเริ่มเดิม)
  //       บัฟหมดแล้ว → เริ่มบัฟใหม่สดจากตอนนี้
  const from  = active ? (auth.userData?.incomeBuffFrom || t) : t
  const until = (active ? curUntil : t) + BUFF_MS
  const dq = { ...auth.userData.dailyQuest, claimed: true }
  const ok = await auth.patchUser(
    { dailyQuest: dq, freeGachaTickets: tickets.value + QUEST_TICKETS, incomeBuffUntil: until, incomeBuffFrom: from },
    { 'dailyQuest.claimed': true, freeGachaTickets: increment(QUEST_TICKETS), incomeBuffUntil: until, incomeBuffFrom: from },
  )
  toast(ok ? `รับรางวัลแล้ว! รายได้ ×1.5 24 ชม. + ตั๋วอัญเชิญฟรี ×${QUEST_TICKETS}` : 'รับรางวัลไม่สำเร็จ', ok ? 'success' : 'error')
  claiming.value = false
}
</script>

<style scoped>
.dq-body { display: flex; flex-direction: column; }
.dq-tasks { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; }
.dq-task { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; font-weight: 700; color: rgba(0,0,0,.65); padding: 7px 10px; border: 2px solid rgba(0,0,0,.1); border-radius: 10px; }
.dq-task.done { border-color: var(--mint, #34d399); background: rgba(52,211,153,.12); color: var(--ink); }
.dq-task-n { font-variant-numeric: tabular-nums; }
.dq-claim { width: 100%; border: 2px solid var(--ink); border-radius: 12px; padding: 11px; font-family: inherit; font-size: .85rem; font-weight: 800; color: #fff; background: #c9c2d4; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.dq-claim.ready { background: var(--gold); box-shadow: var(--pop); }
.dq-claim.ready:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.dq-claim:disabled { cursor: default; }
.dq-claimed { text-align: center; font-size: .8rem; font-weight: 700; color: #15803d; }
.dq-buff { margin-top: 10px; font-size: .72rem; font-weight: 700; color: #b45309; background: rgba(251,191,36,.15); border-radius: 8px; padding: 6px 10px; }
.dq-ticket { margin-top: 8px; font-size: .72rem; font-weight: 700; color: var(--primary); }
</style>
