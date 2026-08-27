<!-- src/views/ExpeditionView.vue -->
<!-- ส่งผจญภัย — 3 สถานะ: idle (เลือกมิชชัน/เพ็ท/เวลา) | active (countdown) | ready (เก็บรางวัล)
     Consumes: useExpedition, expeditionState, MISSIONS/DURATIONS/REWARD_TYPES/EXPEDITION_PARTY_SIZE,
               ELEMENTS/getPetDef, PetThumb, Emoji -->
<template>
  <div class="tab-content">
    <div class="page-title ex-head">
      <span><Emoji char="🗺️" /> ส่งผจญภัย</span>
      <span class="ex-head-r">
        <HelpButton topic="expedition" />
        <RouterLink to="/play/pets" class="ex-back">‹ กลับ</RouterLink>
      </span>
    </div>

    <template v-if="authStore.isLoggedIn">
      <!-- ── ว่าง: เลือกมิชชัน + เพ็ท + เวลา ── -->
      <template v-if="state === 'idle'">
        <div class="ex-sec">เลือกมิชชัน</div>
        <div class="ex-missions">
          <button v-for="m in MISSIONS" :key="m.id" class="ex-mis" :class="{ on: missionId === m.id }" @click="missionId = m.id">
            <span class="ex-mis-emoji"><Emoji :char="m.emoji" /></span>
            <span class="ex-mis-name">{{ m.name }}</span>
            <span class="ex-mis-el">สาย <Emoji :char="elEmoji(m.element)" /></span>
          </button>
        </div>

        <div class="ex-sec">เลือกเพ็ท {{ picked.length }}/{{ PARTY_SIZE }} <span class="ex-sec-note">(นอกทีมต่อสู้)</span></div>
        <div class="ex-pool">
          <button
            v-for="p in eligiblePets" :key="p.id"
            class="ex-pet" :class="{ on: picked.includes(p.id), match: curMission && defEl(p.id) === curMission.element }"
            :disabled="!picked.includes(p.id) && picked.length >= PARTY_SIZE"
            @click="togglePet(p.id)"
          >
            <PetThumb :pet="unitOf(p)" />
            <span v-if="curMission && defEl(p.id) === curMission.element" class="ex-pet-bonus">สายตรง</span>
          </button>
          <div v-if="!eligiblePets.length" class="ex-none">ไม่มีเพ็ทนอกทีม — ปลดเพ็ทออกจากทีมต่อสู้ก่อนนะ</div>
        </div>

        <div class="ex-sec">เลือกระยะเวลา</div>
        <div class="ex-durs">
          <button v-for="d in DURATIONS" :key="d.id" class="ex-dur" :class="{ on: durationId === d.id }" @click="durationId = d.id">
            <b>{{ d.label }}</b><span>{{ d.hours }} ชม.</span>
          </button>
        </div>

        <button class="ex-go" :disabled="!canSend || busy" @click="onSend">
          <Emoji char="🚀" /> ส่งผจญภัย
        </button>
      </template>

      <!-- ── กำลังไป: countdown ── -->
      <template v-else-if="state === 'active'">
        <div class="ex-card ex-active">
          <div class="ex-active-mis"><Emoji :char="curActiveMission?.emoji || '🗺️'" /> {{ curActiveMission?.name || 'ผจญภัย' }}</div>
          <div class="ex-party">
            <PetThumb v-for="(u, i) in exp.party" :key="i" :pet="u" />
          </div>
          <div class="ex-count"><Emoji char="⏳" /> เหลืออีก {{ remainText }}</div>
        </div>
      </template>

      <!-- ── กลับแล้ว: กดเก็บ ── -->
      <template v-else>
        <div class="ex-card ex-ready">
          <div class="ex-ready-h"><Emoji char="🎉" /> คณะกลับมาแล้ว!</div>
          <div class="ex-party">
            <PetThumb v-for="(u, i) in exp.party" :key="i" :pet="u" />
          </div>
          <button class="ex-go" :disabled="busy" @click="onClaim"><Emoji char="🎁" /> เก็บรางวัล</button>
        </div>
      </template>
    </template>
    <div v-else class="ex-login">เข้าสู่ระบบเพื่อเล่น</div>

    <!-- สรุปรางวัล -->
    <Teleport to="body">
      <div v-if="result" class="ex-ov" @click.self="result = null">
        <div class="ex-rv">
          <div class="ex-rv-h"><Emoji char="🎁" /> ได้รับรางวัล</div>
          <div v-for="(r, i) in result" :key="i" class="ex-rv-row">
            <Emoji :char="REWARD_TYPES[r.type]?.emoji || '🎁'" />
            <span>{{ REWARD_TYPES[r.type]?.label || r.type }}</span>
            <b>+{{ r.amount.toLocaleString() }}</b>
          </div>
          <div v-if="!result.length" class="ex-rv-row ex-rv-empty">รอบนี้ไม่ได้ของพิเศษ — ลองส่งเพ็ทที่มีสายตรงมิชชันนะ</div>
          <button class="ex-go" @click="result = null">เยี่ยม!</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useEscapeKey } from '../composables/useEscapeKey.js'
import Emoji from '../components/shared/Emoji.vue'
import { RouterLink } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useExpedition } from '../composables/useExpedition.js'
import { useToast } from '../composables/useToast.js'
import { expeditionState } from '../utils/expedition.js'
import { MISSIONS, DURATIONS, REWARD_TYPES, EXPEDITION_PARTY_SIZE } from '../data/expeditions.js'
import { ELEMENTS, getPetDef } from '../data/index.js'
import PetThumb from '../components/shared/PetThumb.vue'
import HelpButton from '../components/help/HelpButton.vue'

const authStore = useAuthStore()
const { exp, eligiblePets, mission, send, claim } = useExpedition()
const { toast } = useToast()
const PARTY_SIZE = EXPEDITION_PARTY_SIZE

// ticker 1 วิ สำหรับ countdown
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

// state หลัก: idle | active | ready
const state = computed(() => expeditionState(exp.value, now.value))

// idle selections
const missionId = ref(MISSIONS[0]?.id || null)
const durationId = ref(DURATIONS[0]?.id || null)
const picked = ref([])
const busy = ref(false)
const result = ref(null)
useEscapeKey(result, () => { result.value = null })

// มิชชันที่เลือกตอน idle
const curMission = computed(() => mission(missionId.value))
// มิชชันของ expedition ที่กำลังไป (active/ready state)
const curActiveMission = computed(() => mission(exp.value?.missionId))

// idle: ส่งได้เมื่อ เลือกเพ็ทครบ + เลือกมิชชัน + เลือกเวลา
const canSend = computed(() => picked.value.length === PARTY_SIZE && missionId.value && durationId.value)

// helper: emoji สาย
const elEmoji = (el) => ELEMENTS[el]?.emoji || '✊'
// helper: สายของเพ็ทจาก def
const defEl = (id) => getPetDef(id)?.element || 'scissors'
// สร้าง battle unit shape {id,rarity,element,grade} จาก pet instance
const unitOf = (p) => ({
  id: p.id,
  rarity: p.rarity || getPetDef(p.id)?.rarity || 'common',
  element: defEl(p.id),
  grade: p.grade || 0,
})

// toggle เพ็ทใน picked list (กัน exceed PARTY_SIZE)
function togglePet(id) {
  const at = picked.value.indexOf(id)
  if (at >= 0) picked.value.splice(at, 1)
  else { if (picked.value.length >= PARTY_SIZE) return; picked.value.push(id) }
}

// countdown text (h ชม. / m นาที / s วิ)
const remainText = computed(() => {
  const ms = Math.max(0, (exp.value?.endsAt || 0) - now.value)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return h > 0 ? `${h} ชม. ${m} นาที` : (m > 0 ? `${m} นาที ${s} วิ` : `${s} วิ`)
})

// ส่งคณะ
async function onSend() {
  if (busy.value) return
  busy.value = true
  try { if (await send(picked.value, missionId.value, durationId.value)) { picked.value = []; toast('ส่งคณะออกเดินทางแล้ว 🚀', 'success') } }
  finally { busy.value = false }
}

// เก็บรางวัล + เปิด popup
async function onClaim() {
  if (busy.value) return
  busy.value = true
  try { const r = await claim(); if (r) result.value = r }
  finally { busy.value = false }
}
</script>

<style scoped>
.ex-head { display: flex; align-items: center; justify-content: space-between; }
.ex-head-r { display: flex; align-items: center; gap: 8px; }
.ex-back { font-size: .8rem; color: var(--muted); text-decoration: none; }
.ex-sec { font-size: .82rem; font-weight: 800; margin: 14px 0 8px; }
.ex-sec-note { font-size: .7rem; font-weight: 600; color: rgba(0,0,0,.45); }
/* มิชชัน grid 3 ช่อง */
.ex-missions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.ex-mis { all: unset; cursor: pointer; box-sizing: border-box; text-align: center; background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 10px 4px; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.ex-mis.on { background: #eef2ff; box-shadow: inset 0 0 0 2px var(--primary), var(--pop); }
.ex-mis-emoji { font-size: 1.5rem; }
.ex-mis-name { font-size: .7rem; font-weight: 800; }
.ex-mis-el { font-size: .7rem; color: rgba(0,0,0,.5); }
/* pool เพ็ท grid 4 ช่อง */
.ex-pool { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ex-pet { position: relative; all: unset; cursor: pointer; box-sizing: border-box; border: 2px solid #ddd; border-radius: 12px; background: #fff; display: flex; justify-content: center; padding: 8px 2px; }
.ex-pet.on { background: #eef2ff; box-shadow: inset 0 0 0 2px var(--primary); }
.ex-pet.match { border-color: var(--gold); }
.ex-pet:disabled { opacity: .4; cursor: not-allowed; }
.ex-pet-bonus { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: var(--gold); color: #1f2937; font-size: .7rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; border: 1.5px solid var(--ink); }
.ex-none { grid-column: 1 / -1; text-align: center; font-size: .76rem; color: rgba(0,0,0,.45); padding: 18px 0; }
/* ระยะเวลา grid 3 ช่อง */
.ex-durs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.ex-dur { all: unset; cursor: pointer; box-sizing: border-box; text-align: center; background: #fff; border: 2px solid var(--ink); border-radius: 12px; box-shadow: var(--pop); padding: 10px 4px; display: flex; flex-direction: column; gap: 2px; }
.ex-dur.on { background: #eef2ff; box-shadow: inset 0 0 0 2px var(--primary), var(--pop); }
.ex-dur b { font-size: .8rem; } .ex-dur span { font-size: .7rem; color: rgba(0,0,0,.5); }
/* ปุ่มหลัก */
.ex-go { display: block; width: 100%; margin-top: 16px; border: 2px solid var(--ink); border-radius: 13px; padding: 13px; font-family: inherit; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; }
.ex-go:disabled { background: #cbd5e1; box-shadow: none; cursor: default; }
/* การ์ด active/ready */
.ex-card { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 18px 16px; text-align: center; margin-top: 12px; }
.ex-active-mis, .ex-ready-h { font-size: 1rem; font-weight: 800; }
.ex-party { display: flex; justify-content: center; gap: 8px; margin: 14px 0; }
.ex-party :deep(.ptc), .ex-party > * { width: 52px; }
.ex-count { font-size: .82rem; font-weight: 700; color: var(--primary); }
.ex-login { text-align: center; color: rgba(0,0,0,.4); padding: 30px 0; font-size: .85rem; }
/* reward popup overlay */
.ex-ov { position: fixed; inset: 0; z-index: 420; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 24px; }
.ex-rv { background: #fff; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); padding: 22px; max-width: 300px; width: 100%; text-align: center; max-height: 88vh; overflow-y: auto; }
.ex-rv-h { font-weight: 800; font-size: 1rem; margin-bottom: 12px; }
.ex-rv-row { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: .9rem; font-weight: 700; padding: 5px 0; }
.ex-rv-row b { color: var(--primary); }
.ex-rv-empty { color: rgba(0,0,0,.5); font-weight: 600; font-size: .78rem; }
</style>
