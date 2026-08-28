<template>
  <div class="lab">
    <!-- ยอด copies -->
    <div class="lab-bal">
      <div v-for="r in RARITIES" :key="r" class="lab-bal-cell" :style="{ borderColor: rarityColor(r) }">
        <span class="lab-bal-n" :style="{ color: rarityColor(r) }">{{ copyTotal(r) }}</span>
        <span class="lab-bal-l">{{ RARITY[r]?.label }}</span>
      </div>
    </div>

    <!-- fusion -->
    <div class="lab-card">
      <div class="lab-card-h"><Emoji char="🧪" /> หลอมไต่ระดับ</div>
      <div v-for="src in FUSE_SRC" :key="src" class="lab-fuse">
        <span class="lab-fuse-txt">{{ RARITY[src]?.label }} → {{ RARITY[nextRarity(src)]?.label }}</span>
        <span class="lab-fuse-cost">{{ FUSION_COST[src] }} ตัวซ้ำ</span>
        <button class="lab-btn" :class="{ ok: copyTotal(src) >= FUSION_COST[src] }"
          :disabled="busy || copyTotal(src) < FUSION_COST[src]"
          @click="openFusion(src)">หลอม</button>
      </div>
    </div>

    <!-- redeem -->
    <div class="lab-card">
      <div class="lab-card-h"><Emoji char="🪙" /> แลกเป็นเหรียญ</div>
      <div v-for="r in RARITIES" :key="r" class="lab-fuse">
        <span class="lab-fuse-txt">{{ RARITY[r]?.label }}</span>
        <span class="lab-fuse-cost">{{ REDEEM_COIN[r].toLocaleString() }}/ตัวซ้ำ</span>
        <button class="lab-btn" :class="{ ok: copyTotal(r) > 0 }"
          :disabled="busy || copyTotal(r) === 0"
          @click="openRedeem(r)">แลก</button>
      </div>
    </div>

    <!-- spend picker -->
    <SpendCopiesModal v-if="pending" :rarity="pending.rarity" :mode="pending.mode" :required="pending.required"
      @confirm="onConfirm" @cancel="pending = null" />

    <!-- fusion reveal -->
    <Teleport to="body">
      <div v-if="reveal" class="ov" @click.self="reveal = null">
        <div class="rv-box" :class="{ legend: reveal.rarity === 'legendary' }" :style="{ '--rc': rarityColor(reveal.rarity) }">
          <div class="rv-label">หลอมสำเร็จ!</div>
          <div class="rv-emoji-wrap">
            <span class="fuse-aura" aria-hidden="true"></span>
            <div class="rv-emoji"><Emoji :char="reveal.emoji" /></div>
          </div>
          <div class="rv-nm">{{ reveal.name }}</div>
          <div class="rv-badge" :style="{ background: rarityColor(reveal.rarity) }">{{ reveal.isNew ? 'ใหม่!' : '+1 ตัวซ้ำ' }}</div>
          <button class="rv-ok" @click="reveal = null">เยี่ยม!</button>
        </div>
      </div>
    </Teleport>

    <!-- redeem coin-burst -->
    <Teleport to="body">
      <div v-if="coinBurst" class="cb-ov" aria-hidden="true">
        <div class="cb">
          <span v-for="i in 6" :key="i" class="cb-coin" :style="{ '--i': i }"><Emoji char="🪙" /></span>
          <div class="cb-amt">+{{ coinBurst.toLocaleString() }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useEscapeKey } from '../../composables/useEscapeKey.js'
import { ref, computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'
import { PETS, RARITY } from '../../data/index.js'
import { mergeRolls } from '../../utils/gachaMerge.js'
import { FUSION_COST, REDEEM_COIN, nextRarity, rarityCopyTotal, applyCopySpend, fuseRoll, redeemValue } from '../../utils/lab.js'
import SpendCopiesModal from './SpendCopiesModal.vue'

const auth = useAuthStore()
const { toast } = useToast()

const RARITIES = ['common', 'rare', 'epic', 'legendary']
const FUSE_SRC = ['common', 'rare', 'epic']
const pets = computed(() => auth.userData?.pets || [])
const copyTotal = (r) => rarityCopyTotal(pets.value, r)
const rarityColor = (r) => RARITY[r]?.color || '#94a3b8'

const pending = ref(null) // { mode, rarity, required }
const reveal = ref(null)  // summary entry
useEscapeKey(reveal, () => { reveal.value = null })
const coinBurst = ref(null) // จำนวนเหรียญที่เพิ่งแลก (trigger animation)
const busy = ref(false)
let cbTimer = null

function openFusion(src) { pending.value = { mode: 'fusion', rarity: src, required: FUSION_COST[src] } }
function openRedeem(r) { pending.value = { mode: 'redeem', rarity: r, required: 0 } }

async function onConfirm(allocation) {
  if (busy.value || !pending.value) return
  const { mode, rarity } = pending.value
  pending.value = null
  busy.value = true
  try {
    const petsAfter = applyCopySpend(pets.value, allocation)
    if (mode === 'fusion') {
      const id = fuseRoll(rarity, PETS)
      if (!id) { toast('หลอมไม่สำเร็จ', 'error'); return }
      const { pets: finalPets, summary } = mergeRolls(petsAfter, [{ id }], PETS)
      const ok = await auth.patchUser({ pets: finalPets }, { pets: finalPets })
      if (ok) reveal.value = summary[0]
      else toast('หลอมไม่สำเร็จ', 'error')
    } else {
      const gain = redeemValue(allocation, rarity)
      const ok = await auth.patchUser(
        { pets: petsAfter, coins: (auth.userData?.coins || 0) + gain },
        { pets: petsAfter, coins: increment(gain) },
      )
      if (ok) {
        toast(`ได้ ${gain.toLocaleString()} เหรียญ`, 'success')
        coinBurst.value = gain
        clearTimeout(cbTimer)
        cbTimer = setTimeout(() => { coinBurst.value = null }, 1100)
      } else toast('แลกไม่สำเร็จ', 'error')
    }
  } catch (e) {
    console.error('[lab]', e); toast('ทำรายการไม่สำเร็จ', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.lab { display: flex; flex-direction: column; gap: 12px; }
.lab-bal { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.lab-bal-cell { display: flex; flex-direction: column; align-items: center; border: 2px solid; border-radius: 11px; padding: 8px 2px; background: #fff; }
.lab-bal-n { font-size: 1.2rem; font-weight: 800; }
.lab-bal-l { font-size: .7rem; font-weight: 700; color: rgba(0,0,0,.5); }
.lab-card { background: #fff; border: 2px solid var(--ink); border-radius: 16px; padding: 12px; box-shadow: var(--pop); }
.lab-card-h { font-weight: 800; font-size: .9rem; margin-bottom: 10px; }
.lab-fuse { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid rgba(0,0,0,.06); }
.lab-fuse:first-of-type { border-top: none; }
.lab-fuse-txt { flex: 1; font-size: .78rem; font-weight: 700; }
.lab-fuse-cost { font-size: .7rem; color: rgba(0,0,0,.5); font-weight: 700; }
.lab-btn { border: 2px solid var(--ink); border-radius: 10px; padding: 7px 14px; font-family: inherit; font-weight: 800; font-size: .76rem; color: #fff; background: #c9c2d4; cursor: pointer; }
.lab-btn.ok { background: var(--primary); box-shadow: var(--pop); }
.lab-btn:disabled { opacity: .55; cursor: default; box-shadow: none; }
.ov { position: fixed; inset: 0; z-index: 410; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.rv-box { position: relative; overflow: hidden; background: #fff; border: 2px solid var(--ink); border-radius: 22px; box-shadow: var(--pop-lg); padding: 26px 22px; text-align: center; max-width: 300px; width: 100%; max-height: 88vh; overflow-y: auto; animation: rv-pop .34s cubic-bezier(.2,1.3,.45,1); }
.rv-box.legend { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold), 0 0 38px 4px rgba(245,158,11,.5), var(--pop-lg); }
.rv-label { font-size: .8rem; color: rgba(0,0,0,.5); }
.rv-emoji-wrap { position: relative; display: grid; place-items: center; width: 110px; height: 110px; margin: 10px auto; }
.fuse-aura { position: absolute; width: 108px; height: 108px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0 18%, var(--rc) 28%, transparent 38% 68%, var(--rc) 78%, transparent 88%);
  opacity: .5; filter: blur(1px); animation: fa-spin 1.1s linear infinite, fa-fade 1.6s ease-out both; }
.rv-emoji { position: relative; z-index: 1; font-size: 4rem; filter: drop-shadow(0 0 12px var(--rc)); animation: emoji-pop .5s cubic-bezier(.2,1.45,.4,1) both; }
.rv-nm { font-family: var(--font-display); font-weight: 400; font-size: 1.3rem; }
.rv-badge { display: inline-block; color: #fff; font-size: .7rem; font-weight: 800; padding: 3px 12px; border-radius: 999px; margin-top: 8px; }
.rv-ok { display: block; width: 100%; margin-top: 16px; border: 2px solid var(--ink); border-radius: 12px; padding: 11px; font-family: inherit; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; }

/* redeem coin-burst */
.cb-ov { position: fixed; inset: 0; z-index: 420; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.cb { position: relative; width: 0; height: 0; }
.cb-coin { position: absolute; font-size: 1.4rem; left: calc((var(--i) - 3.5) * 16px); top: 0; animation: cb-fly .95s ease-out forwards; animation-delay: calc(var(--i) * 40ms); }
.cb-amt { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; font-weight: 800; color: #b45309; font-size: 1.5rem; text-shadow: 0 1px 0 #fff, 0 0 10px rgba(245,158,11,.5); animation: cb-amt 1s ease-out forwards; }

@keyframes rv-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes emoji-pop { 0% { transform: scale(.3) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.18) rotate(4deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes fa-spin { to { transform: rotate(360deg); } }
@keyframes fa-fade { from { opacity: .6; } to { opacity: .28; } }
@keyframes cb-fly { 0% { opacity: 0; transform: translateY(12px) scale(.4); } 22% { opacity: 1; } 100% { opacity: 0; transform: translateY(-74px) scale(1.1); } }
@keyframes cb-amt { 0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(.7); } 28% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 100% { opacity: 0; transform: translateX(-50%) translateY(-22px); } }

</style>
