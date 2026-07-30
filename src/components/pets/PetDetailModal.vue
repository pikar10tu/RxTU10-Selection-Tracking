<template>
  <!-- Teleport ไป body: #main-content (position:fixed) = stacking context → z-index สู้ #bottom-nav (z200) ไม่ได้ถ้า render ในนี้ (ดู CLAUDE.md) -->
  <Teleport to="body">
  <div v-if="pet" class="pd-ov" @click.self="$emit('close')">
    <div class="pd-box">
      <div class="pd-hero" :style="{ background: `linear-gradient(135deg, ${rc}, ${rc}aa)` }">
        <button class="pd-x" aria-label="ปิด" @click="$emit('close')">✕</button>
        <div class="pd-emoji"><Emoji :char="pet.emoji" /></div>
        <div class="pd-name">{{ pet.name }}</div>
        <div class="pd-tags">
          <span class="pd-tag"><Emoji :char="ELEMENTS[elDef]?.emoji || '✊'" /> {{ EL_NAME[elDef] || elDef }}</span>
          <span class="pd-tag">ตัวซ้ำ {{ pet.copies || 0 }}</span>
        </div>
      </div>

      <!-- active team toggle -->
      <button class="pd-active" :class="{ on: isActive }" :disabled="busy" @click="toggleActive">
        <template v-if="isActive"><Emoji char="⭐" /> อยู่ในทีมต่อสู้ · กดเพื่อเอาออก</template>
        <template v-else><Emoji char="➕" /> ใส่ในทีมต่อสู้ ({{ activeList.length }}/{{ battleSlots }})</template>
      </button>

      <!-- stats -->
      <div class="pd-stats">
        <div class="pd-stat"><span><Emoji char="⚔️" /></span><b>{{ atk }}</b><small>ATK</small></div>
        <div class="pd-stat"><span><Emoji char="❤️" /></span><b>{{ hp }}</b><small>HP</small></div>
        <div class="pd-stat"><span><Emoji char="💰" /></span><b>{{ income }}</b><small>/วัน</small></div>
      </div>

      <!-- แกนพลัง: ความหายาก / เกรด+วิวัฒน์ (ศักยภาพถอดออก P2 — pet build depth ไปที่ passive P3) -->
      <div class="pd-axes">
        <div class="pd-axis">
          <span class="pd-axis-k">ความหายาก</span>
          <span class="pd-axis-v pd-rarity" :style="{ background: RARITY[pet.rarity]?.color }">{{ RARITY[pet.rarity]?.label }}</span>
        </div>
        <div class="pd-axis">
          <span class="pd-axis-k">เกรด</span>
          <span class="pd-axis-v">
            <b class="pd-grade-badge">{{ GRADE_LABELS[gradeNow] || '0' }}</b>
            <button v-if="gradeNow < MAX_GRADE" class="pd-btn" :class="{ ok: canUp }" :disabled="!canUp || busy" @click="evolve">วิวัฒน์ → {{ GRADE_LABELS[gradeNow + 1] }}</button>
            <span v-else class="pd-max">สูงสุดแล้ว</span>
          </span>
        </div>
        <!-- FIX (fable): คงข้อมูล cost/copies เดิมไว้ (spec Part 3 สั่งคง progress copies) -->
        <div v-if="gradeNow < MAX_GRADE && upCost" class="pd-axis-cost">
          ใช้ {{ upCost.copies }} copies + {{ upCost.coins.toLocaleString() }} เหรียญ · มี {{ pet.copies || 0 }} copies
        </div>
      </div>

      <!-- ทักษะเฉพาะ — ยังไม่เปิด (ดู economy-battle-master-plan §5.5) -->
      <div class="pd-section">
        <div class="pd-sec-head"><Emoji char="✨" /> ทักษะเฉพาะ <span class="pd-soon">เร็วๆ นี้</span></div>
        <div class="pd-note">สัตว์เลี้ยงแต่ละตัวจะมีทักษะพิเศษในการต่อสู้ กำลังจะมาเร็วๆ นี้</div>
      </div>

    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { RARITY, GRADE_LABELS, getPetDef, ELEMENTS, EL_NAME } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'
import { petDailyCoins } from '../../utils/petUtils.js'
import { BATTLE_SLOTS } from '../../data/residence.js'
import { gradeUpCost, canUpgrade, MAX_GRADE } from '../../utils/petGrade.js'

const props = defineProps({ petId: { type: String, default: null } })
defineEmits(['close'])

const auth = useAuthStore()
const { toast } = useToast()
const { confirm } = useConfirm()
const busy = ref(false)

const pets = computed(() => auth.userData?.pets || [])

// ── Active team ──
const battleSlots = computed(() => BATTLE_SLOTS)
// only count active pets that are still owned — a species removed from the
// collection can leave a ghost id in activePets and inflate the count.
const activeList = computed(() => {
  const owned = new Set(pets.value.map(p => p.id))
  return (auth.userData?.activePets || []).filter(id => id && owned.has(id))
})
const isActive = computed(() => pet.value && activeList.value.includes(pet.value.id))
async function toggleActive() {
  if (busy.value || !pet.value) return
  const cur = activeList.value
  let next
  if (isActive.value) next = cur.filter(id => id !== pet.value.id)
  else {
    if (cur.length >= battleSlots.value) { toast(`ทีมต่อสู้เต็ม (${battleSlots.value}) — เอาตัวอื่นออกก่อน`, 'info'); return }
    next = [...cur, pet.value.id]
  }
  busy.value = true
  const ok = await auth.patchUser({ activePets: next })
  if (!ok) toast('ตั้งทีมไม่สำเร็จ', 'error')
  busy.value = false
}
const pet = computed(() => pets.value.find(p => p.id === props.petId) || null)

const rc = computed(() => RARITY[pet.value?.rarity]?.color || '#94a3b8')
const elDef = computed(() => getPetDef(pet.value?.id)?.element || pet.value?.element || 'scissors')

const gradeNow = computed(() => pet.value?.grade || 0)
const upCost = computed(() => pet.value ? gradeUpCost(pet.value) : null)
const canUp = computed(() => pet.value && canUpgrade(pet.value, auth.userData?.coins || 0))

// เลข combat จริง (= ที่ใช้สู้) — element ดึงจาก def (per-species), grade V = ×2
const combat = computed(() => {
  const p = pet.value; if (!p) return { atk: 0, maxHp: 0 }
  return buildCombatant({ rarity: p.rarity, element: getPetDef(p.id)?.element || p.element, grade: p.grade })
})
const atk = computed(() => Math.round(combat.value.atk))
const hp = computed(() => Math.round(combat.value.maxHp))
const income = computed(() => pet.value ? petDailyCoins(pet.value) : 0)

async function commit(newPets, coinDelta = 0) {
  // reconcile the active team: drop any species no longer owned so a
  // consumed pet can't linger as a ghost in activePets.
  const owned = new Set(newPets.map(p => p.id))
  const curActive = (auth.userData?.activePets || []).filter(Boolean)
  const nextActive = curActive.filter(id => owned.has(id))
  const activeChanged = nextActive.length !== curActive.length

  const optimistic = {
    pets: newPets,
    ...(activeChanged ? { activePets: nextActive } : {}),
    ...(coinDelta ? { coins: (auth.userData?.coins || 0) + coinDelta } : {}),
  }
  const patch = { pets: newPets }
  if (activeChanged) patch.activePets = nextActive
  if (coinDelta) patch.coins = increment(coinDelta)
  // throw on failure so the calling action's try/catch shows its error toast
  if (!(await auth.patchUser(optimistic, patch))) throw new Error('user patch failed')
}

async function evolve() {
  if (busy.value || !pet.value || !upCost.value) return
  const p = pet.value
  if (!canUp.value) { toast('copies หรือเหรียญของคุณไม่พอ', 'info'); return }
  if (!(await confirm(`วิวัฒน์ ${p.name || 'เพ็ท'} เป็นเกรด ${GRADE_LABELS[(p.grade || 0) + 1]}?\nใช้ ${upCost.value.copies} copies + ${upCost.value.coins.toLocaleString()} เหรียญ`))) return
  const newPets = pets.value.map(x => x.id === p.id
    ? { ...x, grade: (x.grade || 0) + 1, copies: (x.copies || 0) - upCost.value.copies } : x)
  busy.value = true
  try { await commit(newPets, -upCost.value.coins); toast(`วิวัฒน์สำเร็จ! ได้เกรด ${GRADE_LABELS[(p.grade || 0) + 1]}`, 'success') }
  catch (e) { console.error('[evolve]', e); toast('วิวัฒน์ไม่สำเร็จ', 'error') }
  finally { busy.value = false }
}
</script>

<style scoped>
.pd-ov { position: fixed; inset: 0; z-index: 230; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.pd-box { background: #fff; width: 100%; max-width: 380px; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); overflow: hidden; max-height: 90vh; overflow-y: auto; }
.pd-hero { position: relative; padding: 20px 16px 16px; text-align: center; color: #fff; }
.pd-x { position: absolute; left: 12px; top: 12px; border: none; background: rgba(255,255,255,.25); color: #fff; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.pd-emoji { font-size: 3.4rem; }
.pd-name { font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; margin-top: 2px; }
.pd-tags { display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.pd-tag { background: rgba(255,255,255,.25); font-size: .58rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.pd-active { display: block; width: calc(100% - 28px); margin: 12px 14px 0; border: 2px solid var(--ink); border-radius: 11px; padding: 9px; font-family: inherit; font-size: .78rem; font-weight: 800; cursor: pointer; background: #fff; color: var(--ink); box-shadow: var(--pop); transition: transform .12s, box-shadow .12s; }
.pd-active.on { background: var(--gold); color: #fff; }
.pd-active:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pd-active:disabled { opacity: .6; box-shadow: none; }
.pd-stats { display: flex; }
.pd-stat { flex: 1; text-align: center; padding: 14px 4px; border-right: 1px solid rgba(0,0,0,.06); }
.pd-stat:last-child { border-right: none; }
.pd-stat span { font-size: 1.1rem; }
.pd-stat b { display: block; font-size: 1.15rem; font-weight: 800; }
.pd-stat small { font-size: .6rem; color: rgba(0,0,0,.45); }
.pd-substats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 8px 14px 0; font-size: .64rem; color: rgba(0,0,0,.55); font-weight: 600; }
.pd-section { padding: 14px 16px; border-top: 1px solid rgba(0,0,0,.06); margin-top: 8px; }
.pd-sec-head { font-weight: 800; font-size: .82rem; margin-bottom: 8px; }
.pd-note { font-size: .68rem; color: rgba(0,0,0,.5); margin-bottom: 8px; }
.pd-note.small { font-size: .58rem; margin: 6px 0 0; }
.pd-soon { font-size: .54rem; font-weight: 700; color: #b45309; background: rgba(251,191,36,.18); padding: 2px 7px; border-radius: 999px; margin-left: 6px; vertical-align: middle; }
.pd-btn { width: 100%; border: 2px solid var(--ink); border-radius: 11px; padding: 10px; font-family: inherit; font-size: .82rem; font-weight: 800; color: #fff; background: #c9c2d4; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.pd-btn.ok { background: var(--primary); box-shadow: var(--pop); }
.pd-btn:disabled { opacity: .5; cursor: default; box-shadow: none; }
.pd-btn.ok:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pd-axes { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; padding: 0 16px; }
.pd-axis { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 11px; border: 2px solid var(--ink); border-radius: 12px; }
.pd-axis-k { font-size: .72rem; font-weight: 800; color: #64748b; }
.pd-axis-v { display: inline-flex; align-items: center; gap: 8px; font-size: .82rem; font-weight: 800; }
.pd-rarity { color: #fff; padding: 2px 12px; border-radius: 999px; font-size: .74rem; }
.pd-grade-badge { background: #1e293b; color: #fff; min-width: 26px; text-align: center; padding: 2px 8px; border-radius: 8px; }
.pd-max { font-size: .72rem; color: #15803d; font-weight: 800; }
.pd-axis-cost { font-size: .68rem; color: rgba(0,0,0,.55); text-align: right; margin: -4px 4px 0; }
</style>
