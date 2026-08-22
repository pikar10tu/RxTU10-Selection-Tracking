<template>
  <div class="tab-content">
    <div class="page-title tw-head">
      <span><Emoji char="🏯" /> หอคอย</span>
      <span class="tw-head-r">
        <HelpButton topic="tower" />
        <RouterLink to="/play/pets" class="tw-back">‹ กลับ</RouterLink>
      </span>
    </div>

    <template v-if="authStore.isLoggedIn">
      <TowerPath :floor="displayFloor" :best="displayBest" :max="TOWER_MAX" :crowd="crowd"
                 @pick="sheetFloor = $event" />

      <!-- การ์ดชั้นปัจจุบัน -->
      <div class="tw-card">
        <div class="tw-zone" :class="{ 'tw-zone-royal': zone.royal }" :style="{ background: zoneBg }">
          <div class="tw-zone-art"><Emoji :char="zone.art" /></div>
          <div class="tw-zone-txt">
            <div class="tw-zone-name">{{ zone.name }}</div>
            <div class="tw-zone-floor">ชั้น {{ floor }} <span class="tw-zone-best">· สูงสุด {{ best }}</span></div>
          </div>
        </div>
        <div v-if="zone.royal" class="tw-max-cue">
          <div class="tw-max-cue-l1">พลังบอทช่วงนี้ตันแล้ว (เกรด V ทุกตัว)</div>
          <div class="tw-max-cue-l2">แพ้ชนะวัดที่ธาตุกับการจัดทีม — ✊ ข่ม ✌️ · ✌️ ข่ม ✋ · ✋ ข่ม ✊</div>
        </div>
        <div class="tw-bonus"><Emoji char="🪙" /> โบนัสรายได้ตอนนี้ +{{ bonus.toLocaleString() }}/วัน<span v-if="best >= BONUS_CAP_FLOOR" class="tw-bonus-cap"> (เต็มเพดานแล้ว)</span></div>

        <div class="tw-row">
          <span class="tw-label">ศัตรู</span>
          <span class="tw-team">
            <button v-for="(p, i) in botTeam" :key="i" class="tw-mon" @click="scout = p">
              <PetThumb :pet="p" />
            </button>
          </span>
        </div>
        <div class="tw-vs"><Emoji char="⚔️" /> VS</div>
        <div class="tw-row">
          <span class="tw-label">ทีมคุณ</span>
          <span class="tw-team">
            <template v-if="team.length">
              <button v-for="(p, i) in team" :key="i" class="tw-mon" @click="detailId = p.id">
                <PetThumb :pet="p" />
              </button>
            </template>
            <span v-else class="tw-empty">ยังไม่ได้จัดทีม</span>
          </span>
        </div>

        <div class="tw-actions">
          <button class="tw-edit" @click="pickOpen = true"><Emoji char="🛡️" /> จัดทีม</button>
          <button class="tw-fight" :disabled="busy || !team.length" @click="onFight">
            <Emoji char="⚔️" /> {{ busy ? 'กำลังสู้…' : `สู้ชั้น ${floor}` }}
          </button>
        </div>
        <div v-if="floor >= TOWER_MAX && best >= TOWER_MAX" class="tw-clear"><Emoji char="🏆" /> พิชิตหอคอยครบแล้ว!</div>
      </div>

      <!-- การ์ดเทียบเพื่อน — social hook รอง, best-effort ไม่มีข้อมูล = ซ่อนทั้งใบ -->
      <div v-if="rivals && rivals.total > 0 && !(rivals.total === 1 && rivals.myRank === 1)" class="tw-rival">
        <div class="tw-rival-head">
          <span><Emoji char="🏁" /> เพื่อนร่วมไต่</span>
          <span class="tw-rival-rank">
            <template v-if="rivals.myRank === null">ยังไม่ติดอันดับ — เริ่มไต่เลย!</template>
            <template v-else-if="rivals.myRank === 1">คุณอยู่อันดับ 1 จาก {{ rivals.total }} <Emoji char="🎉" /></template>
            <template v-else>คุณอยู่อันดับ {{ rivals.myRank }} จาก {{ rivals.total }}</template>
          </span>
        </div>
        <ol class="tw-rival-list">
          <li v-for="(u, i) in rivals.top" :key="i" class="tw-rival-row" :class="{ 'tw-rival-me': u.isMe }">
            <span class="tw-rival-medal">{{ medal(i) }}</span>
            <span class="tw-rival-name">{{ u.nickname }}<span v-if="u.isMe" class="tw-rival-badge">คุณ</span></span>
            <span class="tw-rival-floor">ชั้น {{ u.floor }}</span>
          </li>
        </ol>
        <div v-if="rivals.chaseName && rivals.chaseGap > 0" class="tw-rival-chase"><Emoji char="🔥" /> ตามหลัง {{ rivals.chaseName }} อยู่ {{ rivals.chaseGap }} ชั้น!</div>
      </div>
    </template>
    <div v-else class="tw-login">เข้าสู่ระบบเพื่อเล่น</div>

    <TeamPicker v-model:open="pickOpen" />
    <BattleReplay :data="replay" theme="tower" @close="onReplayClose" />
    <PetDetailModal :pet-id="detailId" @close="detailId = null" />
    <FloorSheet :floor="sheetFloor" :crowd="crowd" :current-floor="floor"
                @close="sheetFloor = null" @fight="onSheetFight" />

    <!-- scout ศัตรู (read-only) — Teleport ไป body: #main-content stacking context, z-index สู้ #bottom-nav ไม่ได้ (ดู CLAUDE.md) -->
    <Teleport to="body">
    <div v-if="scout" class="tw-scout" @click.self="scout = null">
      <div class="tw-scout-box">
        <div class="tw-scout-emoji"><Emoji :char="defOf(scout.id).emoji" /></div>
        <div class="tw-scout-name">{{ defOf(scout.id).name }}</div>
        <div class="tw-scout-row"><span>ธาตุ</span><b><Emoji :char="elEmoji(scout)" /> {{ elName(scout) }}</b></div>
        <div class="tw-scout-row"><span>ระดับ</span><b>{{ rarityLabel(scout) }} · เกรด {{ GRADE_LABELS[Math.min(5, Math.max(0, scout.grade || 0))] }}</b></div>
        <div class="tw-scout-row"><span>พลังโจมตี</span><b>{{ scoutStat.atk }}</b></div>
        <div class="tw-scout-row"><span>พลังชีวิต</span><b>{{ scoutStat.hp }}</b></div>
        <button class="tw-scout-x" @click="scout = null">ปิด</button>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { RouterLink } from 'vue-router'
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useTower } from '../composables/useTower.js'
import { towerRanking } from '../utils/towerRivals.js'
import { buildFloorCrowd } from '../utils/towerCrowd.js'
import { getPetDef, ELEMENTS, RARITY, EL_NAME, GRADE_LABELS } from '../data/index.js'
import { floorZone, BONUS_CAP_FLOOR } from '../data/towerFloors.js'
import { buildCombatant } from '../data/battle.js'
import TeamPicker from '../components/battle/TeamPicker.vue'
import BattleReplay from '../components/battle/BattleReplay.vue'
import PetDetailModal from '../components/pets/PetDetailModal.vue'
import PetThumb from '../components/shared/PetThumb.vue'
import HelpButton from '../components/help/HelpButton.vue'
import TowerPath from '../components/tower/TowerPath.vue'
import FloorSheet from '../components/tower/FloorSheet.vue'

const authStore = useAuthStore()
const membersStore = useMembersStore()
const { floor, best, team, botTeam, bonus, fight, TOWER_MAX } = useTower()
const defOf = (id) => getPetDef(id) || { emoji: '❓', name: '?' }

onMounted(() => { membersStore.loadRoster().catch(() => {}) })  // best-effort, 1 read

const meUid = computed(() => authStore.currentUser?.uid || '')
// เพื่อนปักหมุดรายชั้น — อ่าน rosterRows ดิบ (rosterUsers key ด้วย studentId แล้วตก guest)
const crowd = computed(() => buildFloorCrowd(membersStore.rosterRows, meUid.value))

// แถบเทียบเพื่อน — best-effort ทั้งชุด: ไม่มีข้อมูล/total 0 → คืน null (การ์ดซ่อนทั้งใบ)
// อ่าน rosterRows ดิบให้ตรงกับเส้นทางหอคอย — เดิมอ่าน rosterUsers ซึ่ง key ด้วย studentId
// จึงตกเพื่อนที่เป็น guest ทำให้หน้าเดียวกันนับเพื่อนได้ไม่เท่ากันสองที่
const rivals = computed(() => {
  const me = meUid.value || 'me'
  const others = Object.entries(membersStore.rosterRows || {})
    .filter(([uid, r]) => r && uid !== me)
    .map(([uid, r]) => ({ uid, nickname: r.n || '?', towerBest: r.tb || 0 }))
  if (!others.length) return null
  const u = authStore.userData || {}
  const r = towerRanking(others, { uid: me, nickname: u.nickname || 'ฉัน', towerBest: best.value })
  return r.total > 0 ? r : null
})
const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

const pickOpen = ref(false)
const replay = ref(null)
const busy = ref(false)
const detailId = ref(null)
const scout = ref(null)
const sheetFloor = ref(null)

// path หน่วงตามหลัง store: patchUser ใน fight() ขยับ floor ทันทีตั้งแต่ replay ยังไม่เปิด
// ถ้าไม่หน่วง marker จะไปถึงที่ใหม่ก่อนคนดูจะเห็น = ไม่มีอนิเมชันไต่ให้ดู
const holdPath    = ref(false)
const displayFloor = ref(floor.value)
const displayBest  = ref(best.value)

watch([floor, best], ([f, b]) => {
  if (holdPath.value) return
  displayFloor.value = f
  displayBest.value  = b
})

// ปล่อยค่าที่หน่วงไว้ → TowerPath เห็น floor เพิ่มขึ้น แล้วเล่นซีเควนซ์ไต่เอง
function releasePath() {
  holdPath.value     = false
  displayFloor.value = floor.value
  displayBest.value  = best.value
}

const zone = computed(() => floorZone(floor.value))
const zoneBg = computed(() => zone.value.royal
  ? 'linear-gradient(135deg, var(--ink) 0%, #5b21b6 100%)'
  : `linear-gradient(135deg, ${zone.value.color}, ${zone.value.color}bb)`)
const elEmoji = (p) => ELEMENTS[p?.element]?.emoji || '✊'
const elName = (p) => EL_NAME[p?.element] || p?.element
const rarityLabel = (p) => RARITY[p?.rarity]?.label || p?.rarity
const scoutStat = computed(() => {
  if (!scout.value) return { atk: 0, hp: 0 }
  const c = buildCombatant(scout.value)
  return { atk: Math.round(c.atk), hp: Math.round(c.maxHp) }
})

async function onFight() {
  if (busy.value) return
  busy.value = true
  holdPath.value = true          // ต้องตั้งก่อน await — patchUser ข้างใน fight() ขยับ floor ทันที
  try {
    const r = await fight()
    if (r) replay.value = r      // ทั้งชนะและแพ้มี replay → ปล่อย path ตอนปิด replay
    else releasePath()           // fight() คืน null (ยังไม่ได้จัดทีม) → ปล่อยเลย
  } catch (e) {
    releasePath()
    throw e
  } finally {
    busy.value = false
  }
}

function onReplayClose() {
  replay.value = null
  releasePath()
}

// กด "สู้ชั้นนี้" ในแผง → ปิดแผงแล้วยิงศึกเลย (ปุ่มโผล่เฉพาะตอนเป็นชั้นปัจจุบันอยู่แล้ว)
function onSheetFight() {
  sheetFloor.value = null
  onFight()
}
</script>

<style scoped>
.tw-head { display: flex; align-items: center; justify-content: space-between; }
.tw-head-r { display: flex; align-items: center; gap: 8px; }
.tw-back { font-size: .8rem; color: var(--muted); text-decoration: none; }

.tw-card { background: #fff; border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop); overflow: hidden; }
.tw-zone { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: #fff; }
.tw-zone-art { font-size: 2rem; }
.tw-zone-name { font-family: var(--font-display); font-size: 1.3rem; line-height: 1; }
.tw-zone-floor { font-size: .78rem; font-weight: 700; margin-top: 3px; }
.tw-zone-best { opacity: .8; font-weight: 600; }
.tw-zone-royal { border-bottom: 2px solid var(--gold); }
.tw-zone-royal .tw-zone-name { color: var(--gold); }
.tw-zone-royal .tw-zone-art { filter: drop-shadow(0 0 6px rgba(255,176,32,.7)); }
.tw-max-cue { margin: 10px 16px 0; padding: 8px 10px; border-radius: 10px; background: var(--primary-light); border: 1.5px dashed var(--primary); font-size: .74rem; font-weight: 700; color: var(--ink); line-height: 1.45; }
.tw-max-cue-l1 { font-weight: 800; }
.tw-max-cue-l2 { font-weight: 600; }
.tw-bonus { font-size: .76rem; color: #b45309; font-weight: 700; padding: 10px 16px 0; }
.tw-bonus-cap { font-weight: 600; color: var(--muted); }
.tw-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; }
.tw-label { font-size: .7rem; color: var(--muted); width: 48px; flex-shrink: 0; }
.tw-team { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; }
.tw-mon { border: none; background: none; padding: 0; cursor: pointer; width: 54px; }
.tw-mon:active { transform: scale(.92); }
.tw-empty { font-size: .76rem; color: var(--muted); }
.tw-vs { text-align: center; font-weight: 800; font-size: .72rem; color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 4px; }
.tw-actions { display: flex; gap: 8px; padding: 6px 16px 16px; }
.tw-edit { border: 2px solid var(--ink); background: #fff; border-radius: 12px; padding: 12px; min-height: 44px; font-family: inherit; font-size: .82rem; font-weight: 800; cursor: pointer; box-shadow: var(--pop); display: flex; align-items: center; gap: 4px; }
.tw-edit:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.tw-fight { flex: 1; border: 2px solid var(--ink); border-radius: 12px; padding: 12px; min-height: 44px; font-family: inherit; font-size: .92rem; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
.tw-fight:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.tw-fight:disabled { background: #cbd5e1; cursor: default; box-shadow: none; }
.tw-clear { text-align: center; padding: 0 0 14px; font-weight: 800; color: #f59e0b; }
.tw-login { text-align: center; color: var(--muted); padding: 30px 0; font-size: .85rem; }

.tw-rival { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); margin-top: 12px; padding: 12px 14px; }
.tw-rival-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
.tw-rival-head > span:first-child { font-family: var(--font-display); font-size: 1.05rem; color: var(--ink); flex-shrink: 0; }
.tw-rival-rank { font-size: .72rem; font-weight: 700; color: var(--muted); text-align: right; }
.tw-rival-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.tw-rival-row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 10px; }
.tw-rival-row.tw-rival-me { background: var(--primary-light); outline: 1.5px solid var(--primary); }
.tw-rival-medal { font-size: 1rem; flex-shrink: 0; }
.tw-rival-name { font-size: .84rem; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.tw-rival-badge { display: inline-block; font-size: .7rem; font-weight: 800; color: #fff; background: var(--primary); padding: 1px 6px; border-radius: 999px; margin-left: 5px; vertical-align: middle; }
.tw-rival-floor { font-size: .8rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.tw-rival-chase { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: #ffeef1; border: 1.5px solid var(--accent); font-size: .76rem; font-weight: 700; color: var(--ink); }

.tw-scout { position: fixed; inset: 0; z-index: 240; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.tw-scout-box { background: #1e293b; color: #fff; border: 2px solid #fff; border-radius: 18px; padding: 16px 18px; width: 240px; display: flex; flex-direction: column; gap: 7px; max-height: 88vh; overflow-y: auto; }
.tw-scout-emoji { font-size: 2.8rem; text-align: center; }
.tw-scout-name { text-align: center; font-weight: 800; font-size: 1.1rem; margin-bottom: 4px; }
.tw-scout-row { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; }
.tw-scout-row span { color: rgba(255,255,255,.6); }
.tw-scout-x { margin-top: 10px; border: 2px solid #fff; background: rgba(255,255,255,.14); color: #fff; border-radius: 12px; padding: 9px; font-family: inherit; font-weight: 800; cursor: pointer; }
</style>
