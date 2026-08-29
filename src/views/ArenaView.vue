<!-- src/views/ArenaView.vue -->
<!-- สนามประลอง PvP — แต้มประลอง, กระดานคู่ต่อสู้ 5 ช่อง, บุก, จัดทีม
     สนามปิด = เด้งกลับ /play ทันที (นักศึกษาไม่เห็นหน้านี้เลย)
     admin: เข้าและบุกได้เสมอแม้ pvpOpen=false (ทดสอบก่อนเปิดจริง) -->
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
      <ArenaStatus
        :rating="rating" :wins="wins" :losses="losses" :attacks-left="attacksLeft"
        :my-rank="rivals.myRank" :total="rivals.total" :team="myTeam"
        @pick="pickOpen = true"
      />

      <!-- กระดานคู่ต่อสู้ -->
      <div class="ar-board-head">
        <span class="ar-board-hint">ตีเสร็จได้คู่ใหม่ทันที</span>
        <button class="ar-refresh" :disabled="busy || refreshLeft > 0" @click="onRefresh">
          <Emoji char="🔄" /> {{ refreshLeft > 0 ? `อีก ${Math.ceil(refreshLeft / 60000)} นาที` : 'เปลี่ยนคู่' }}
        </button>
      </div>
      <div class="ar-list">
        <div v-for="opp in opponents" :key="opp.uid" class="ar-opp">
          <span class="ar-opp-info">
            <span class="ar-opp-name">
              <Emoji :char="opp.isBot ? '🤖' : '🧑'" /> {{ opp.isBot ? ('หุ่นซ้อม' + (opp.label ? ' · ' + opp.label : '')) : (opp.nickname || '?') }}
            </span>
            <span class="ar-opp-rt">
              {{ (opp.rating || 0).toLocaleString() }} แต้ม<span v-if="opp.isBot"> · ฝึกซ้อม</span>
              <span class="ar-opp-coin"><Emoji char="🪙" /> {{ coinPreview(opp).toLocaleString() }}</span>
            </span>
          </span>
          <span class="ar-opp-team">
            <PetThumb v-for="(p, i) in oppPreview(opp)" :key="i" :pet="p" />
          </span>
          <button class="ar-fight" :disabled="!canFight || busy || attacksLeft <= 0" @click="onFight(opp)">
            <Emoji char="⚔️" /> บุก
          </button>
        </div>
      </div>

      <PvpHistory />
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
import TeamPicker from '../components/battle/TeamPicker.vue'
import BattleReplay from '../components/battle/BattleReplay.vue'
import PvpHistory from '../components/battle/PvpHistory.vue'
import ArenaStatus from '../components/battle/ArenaStatus.vue'
import { arenaRanking } from '../utils/arenaRivals.js'
import { PVP_RATING_START } from '../utils/pvpRating.js'
import PetThumb from '../components/shared/PetThumb.vue'
import HelpButton from '../components/help/HelpButton.vue'

const authStore = useAuthStore()
const members = useMembersStore()
const { pvpOpen } = useAppConfig()
const { rating, wins, losses, attacksLeft, myTeam, opponents, fight, refreshBoard, refreshLeft, coinPreview } = useArena()

const pickOpen = ref(false)
const replay = ref(null)
const busy = ref(false)

// admin บุกได้เสมอ (ทดสอบก่อนเปิดจริง) เหมือน shopOpen
const canFight = computed(() => pvpOpen.value || authStore.isAdmin)

// สนามปิด (ไม่ใช่แอดมิน) = กันเข้าตรงผ่าน URL → เด้งกลับ /play (configLoaded แล้วเสมอเมื่อ view นี้ render)
const router = useRouter()
onMounted(() => { if (!canFight.value) router.replace('/play') })
watch(canFight, (ok) => { if (!ok) router.replace('/play') })   // admin ปิดสนามระหว่างมีคนอยู่ในหน้า

const oppPreview = (opp) => opp.team   // roster/บอท ให้ทีมมาพร้อมแล้ว

// อันดับแต้มประลองทั้งรุ่น — อ่าน rosterRows ดิบ (rosterUsers key ด้วย studentId แล้วตก guest)
// ค่าสดของเราจาก useArena ทับแถวตัวเองใน roster ซึ่งอาจเก่ากว่าหนึ่งไฟต์
// ⚠️ ไม่มี Firestore read เพิ่ม — roster โหลดไว้แล้วตอน onMounted
const rivals = computed(() => {
  const meUid = authStore.currentUser?.uid || 'me'
  const others = Object.entries(members.rosterRows || {})
    .filter(([uid, r]) => r && uid !== meUid)
    .map(([uid, r]) => ({
      uid,
      nickname: r.n || '?',
      rating: typeof r.r === 'number' ? r.r : PVP_RATING_START,
      wins: r.pw || 0,
      losses: r.pl || 0,
    }))
  return arenaRanking(others, {
    uid: meUid,
    nickname: authStore.userData?.nickname || 'ฉัน',
    rating: rating.value, wins: wins.value, losses: losses.value,
  })
})

async function onFight(opp) {
  if (busy.value) return
  busy.value = true
  try { const r = await fight(opp); if (r) replay.value = r }
  finally { busy.value = false }
}

async function onRefresh() {
  if (busy.value) return
  busy.value = true
  try { await refreshBoard() } finally { busy.value = false }
}

onMounted(() => { members.loadRoster() })
</script>

<style scoped>
.ar-head { display: flex; align-items: center; justify-content: space-between; }
.ar-head-r { display: flex; align-items: center; gap: 8px; }
.ar-back { font-size: .8rem; color: var(--muted); text-decoration: none; }
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
.ar-board-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ar-board-hint { font-size: .72rem; color: rgba(0,0,0,.5); }
.ar-refresh { border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 6px 12px; font-family: inherit; font-weight: 800; font-size: .74rem; cursor: pointer; box-shadow: var(--pop); display: inline-flex; align-items: center; gap: 5px; }
.ar-refresh:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ar-refresh:disabled { opacity: .5; cursor: default; }
.ar-opp-coin { margin-left: 6px; font-weight: 800; color: #b45309; }
</style>
