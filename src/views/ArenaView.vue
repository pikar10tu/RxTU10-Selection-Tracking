<!-- src/views/ArenaView.vue -->
<!-- สนามประลอง PvP — แต้มประลอง, พูลคู่ต่อสู้, บุก, จัดทีม
     ก่อน pvpOpen: ดูได้ + จัดทีมได้ แต่ปุ่มบุก disabled (banner แจ้ง)
     admin: บุกได้เสมอแม้ pvpOpen=false (ทดสอบก่อนเปิดจริง) -->
<template>
  <div class="tab-content">
    <div class="page-title ar-head">
      <span><Emoji char="⚔️" /> สนามประลอง</span>
      <span class="ar-head-r">
        <HelpButton topic="arena" />
        <RouterLink to="/play/pets" class="ar-back">‹ กลับ</RouterLink>
      </span>
    </div>

    <template v-if="authStore.isLoggedIn">
      <!-- สรุปแต้ม -->
      <div class="ar-card ar-me">
        <div class="ar-rating"><Emoji char="🏆" /> แต้มประลอง <b>{{ rating.toLocaleString() }}</b></div>
        <div class="ar-sub">ชนะ {{ wins }} · แพ้ {{ losses }} · โจมตีได้อีก <b>{{ attacksLeft }}</b> ครั้งวันนี้</div>
        <button class="ar-edit" @click="pickOpen = true"><Emoji char="🛡️" /> จัดทีม</button>
      </div>

      <!-- ก่อนเปิด: เห็น/จัดทีมได้ แต่ยังบุกไม่ได้ -->
      <div v-if="!canFight" class="ar-locked">
        <Emoji char="🔜" /> สนามประลองยังไม่เปิด — จัดทีมรอไว้ก่อนได้เลย เปิดพร้อมกันเร็ว ๆ นี้
      </div>

      <!-- พูลคู่ต่อสู้ -->
      <div class="ar-list">
        <div v-for="opp in opponents" :key="opp.uid" class="ar-opp">
          <span class="ar-opp-info">
            <span class="ar-opp-name">
              <Emoji :char="opp.isBot ? '🤖' : '🧑'" /> {{ opp.isBot ? 'หุ่นซ้อม' : (opp.nickname || '?') }}
            </span>
            <span class="ar-opp-rt">{{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span></span>
          </span>
          <span class="ar-opp-team">
            <PetThumb v-for="(p, i) in oppPreview(opp)" :key="i" :pet="p" />
          </span>
          <button class="ar-fight" :disabled="!canFight || busy || attacksLeft <= 0" @click="onFight(opp)">
            <Emoji char="⚔️" /> บุก
          </button>
        </div>
      </div>
    </template>
    <div v-else class="ar-login">เข้าสู่ระบบเพื่อเล่น</div>

    <TeamPicker v-model:open="pickOpen" />
    <BattleReplay :data="replay" theme="arena" @close="replay = null" />
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { RouterLink, useRouter } from 'vue-router'
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useAppConfig } from '../composables/useAppConfig.js'
import { useArena } from '../composables/useArena.js'
import { resolveBattleTeam } from '../utils/petTeam.js'
import TeamPicker from '../components/battle/TeamPicker.vue'
import BattleReplay from '../components/battle/BattleReplay.vue'
import PetThumb from '../components/shared/PetThumb.vue'
import HelpButton from '../components/help/HelpButton.vue'

const authStore = useAuthStore()
const members = useMembersStore()
const { pvpOpen } = useAppConfig()
const { rating, wins, losses, attacksLeft, opponents, fight } = useArena()

const pickOpen = ref(false)
const replay = ref(null)
const busy = ref(false)

// admin บุกได้เสมอ (ทดสอบก่อนเปิดจริง) เหมือน shopOpen
const canFight = computed(() => pvpOpen.value || authStore.isAdmin)

// สนามปิด (ไม่ใช่แอดมิน) = กันเข้าตรงผ่าน URL → เด้งกลับ /play (configLoaded แล้วเสมอเมื่อ view นี้ render)
const router = useRouter()
onMounted(() => { if (!canFight.value) router.replace('/play') })
watch(canFight, (ok) => { if (!ok) router.replace('/play') })   // admin ปิดสนามระหว่างมีคนอยู่ในหน้า

const oppPreview = (opp) => opp.isBot ? opp.team : resolveBattleTeam(opp.activePets, opp.pets)

async function onFight(opp) {
  if (busy.value) return
  busy.value = true
  try { const r = await fight(opp); if (r) replay.value = r }
  finally { busy.value = false }
}

onMounted(() => { members.loadFbUsers() })
</script>

<style scoped>
.ar-head { display: flex; align-items: center; justify-content: space-between; }
.ar-head-r { display: flex; align-items: center; gap: 8px; }
.ar-back { font-size: .8rem; color: var(--muted); text-decoration: none; }
.ar-card { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 14px 16px; margin-bottom: 12px; }
.ar-rating { font-size: 1rem; font-weight: 700; }
.ar-rating b { color: var(--primary); font-size: 1.15rem; }
.ar-sub { font-size: .72rem; color: rgba(0,0,0,.55); margin-top: 4px; }
.ar-edit { margin-top: 10px; border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 9px 14px; font-family: inherit; font-weight: 800; font-size: .78rem; cursor: pointer; box-shadow: var(--pop); display: inline-flex; align-items: center; gap: 5px; }
.ar-edit:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ar-locked { background: rgba(251,191,36,.14); border: 2px dashed #f59e0b; border-radius: 12px; padding: 12px 14px; font-size: .78rem; font-weight: 700; color: #b45309; margin-bottom: 12px; text-align: center; }
.ar-list { display: flex; flex-direction: column; gap: 8px; }
.ar-opp { display: flex; align-items: center; gap: 8px; background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 8px 10px; }
.ar-opp-info { display: flex; flex-direction: column; gap: 2px; min-width: 84px; }
.ar-opp-name { font-size: .78rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.ar-opp-rt { font-size: .7rem; color: rgba(0,0,0,.5); }
.ar-opp-team { display: flex; gap: 3px; flex: 1; justify-content: center; }
.ar-opp-team :deep(.pet-thumb), .ar-opp-team > * { width: 34px; }
.ar-fight { border: 2px solid var(--ink); border-radius: 11px; padding: 9px 12px; font-family: inherit; font-weight: 800; font-size: .76rem; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.ar-fight:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ar-fight:disabled { background: #cbd5e1; cursor: default; box-shadow: none; }
.ar-login { text-align: center; color: rgba(0,0,0,.4); padding: 30px 0; font-size: .85rem; }
</style>
