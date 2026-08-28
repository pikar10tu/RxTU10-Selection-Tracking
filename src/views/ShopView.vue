<template>
  <div class="tab-content">
    <div class="shop-head">
      <div class="page-title" style="margin-bottom:0"><Emoji char="🛒" /> Shop</div>
      <span class="shop-coins">{{ coins.toLocaleString() }} <Emoji char="🪙" /></span>
      <HelpButton topic="summon" />
    </div>

    <!-- ร้านค้าปิดปรับปรุง (ยังไม่เปิดให้นักศึกษา) — flip SHOP_OPEN=true เมื่อพร้อม; admin เห็นร้านปกติไว้ทดสอบ -->
    <template v-if="!shopOpen">
      <div class="shop-maint">
        <div class="shop-maint-emoji"><Emoji char="🚧" /></div>
        <div class="shop-maint-title">ร้านค้ากำลังปรับปรุง</div>
        <div class="shop-maint-msg">กำลังจัดของให้พร้อม เดี๋ยวเปิดให้ช้อปเร็วๆ นี้!</div>
      </div>
    </template>

    <template v-else-if="authStore.isLoggedIn">
      <div class="shop-tabs">
        <button class="shop-tab" :class="{ on: tab === 'gacha' }" @click="tab = 'gacha'"><Emoji char="🎰" /> อัญเชิญ</button>
        <button class="shop-tab" :class="{ on: tab === 'lab' }" @click="tab = 'lab'"><Emoji char="🧪" /> ห้องทดลอง</button>
      </div>

      <LabTab v-if="tab === 'lab'" />
      <template v-else>
      <div class="shop-storage">
        <Emoji char="🐾" /> สัตว์เลี้ยง {{ pets.length }}/{{ PETS.length }} ชนิด
      </div>

      <!-- banner -->
      <div class="banner">
        <div class="banner-top">
          <div class="banner-title"><Emoji char="🎰" /> อัญเชิญสัตว์เลี้ยง</div>
          <div class="banner-pity">การันตี legendary อีก {{ pityLeft }} ครั้ง</div>
        </div>

        <button class="target-row" @click="pickerOpen = true">
          <template v-if="targetPet">
            <span class="target-emoji"><Emoji :char="targetPet.emoji" /></span>
            <span class="target-text">เป้าหมาย: <b>{{ targetPet.name }}</b></span>
          </template>
          <span v-else class="target-text">เลือกเป้าหมาย legendary (ยังไม่เลือก = ตัวที่ยังไม่มีก่อน)</span>
          <span class="target-edit">เปลี่ยน</span>
        </button>
        <div v-if="guaranteed && targetPet" class="banner-guar"><Emoji char="✅" /> รอบหน้าได้ {{ targetPet.name }} แน่นอน</div>

        <div class="banner-rates">
          <span v-for="r in rateList" :key="r.key" :style="{ color: r.color }">{{ r.label }} {{ r.pct }}%</span>
        </div>

        <div v-if="tickets > 0" class="ticket-note"><Emoji char="🎟️" /> ตั๋วอัญเชิญ: {{ tickets }} ใบ (ใช้ตั๋วก่อนอัตโนมัติ)</div>
        <div class="pull-row">
          <button class="pull-btn" :class="{ ok: pay1.pay === 'ticket' || coins >= PULL_COST }" :disabled="buying" @click="pull(1)">
            สุ่ม 1<br>
            <small v-if="pay1.pay === 'ticket'">{{ pay1.amount }}<Emoji char="🎟️" /></small>
            <small v-else>{{ PULL_COST.toLocaleString() }}<Emoji char="🪙" /></small>
          </button>
          <button class="pull-btn" :class="{ ok: pay10.pay === 'ticket' || coins >= TEN_PULL_COST }" :disabled="buying" @click="pull(10)">
            สุ่ม 10<br>
            <small v-if="pay10.pay === 'ticket'">{{ pay10.amount }}<Emoji char="🎟️" /></small>
            <small v-else>{{ TEN_PULL_COST.toLocaleString() }}<Emoji char="🪙" /></small>
          </button>
        </div>
      </div>
      <div class="shop-note">สุ่ม 10 ได้ 11 ตัว · ได้ตัวเดิมซ้ำ → +1 ตัวซ้ำ (ใช้วิวัฒน์หรือหลอม)</div>
      </template>
    </template>
    <div v-else class="shop-login">เข้าสู่ระบบเพื่อช้อป</div>

    <!-- target picker -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="ov" @click.self="pickerOpen = false">
        <div class="picker">
          <div class="picker-head">เลือกเป้าหมาย legendary</div>
          <div class="picker-hint">กดการ์ด = ตั้งเป้า · กด ℹ️ = ดูรายละเอียด</div>
          <div class="picker-grid">
            <div v-for="p in legendaries" :key="p.id" class="picker-cell" :class="{ on: p.id === target }" @click="chooseTarget(p.id)">
              <button class="picker-info" @click.stop="infoPet = p" aria-label="ดูรายละเอียด"><Emoji char="ℹ️" /></button>
              <span class="picker-emoji"><Emoji :char="p.emoji" /></span>
              <span class="picker-name">{{ p.name }}</span>
              <span v-if="pets.find((x) => x.id === p.id)" class="picker-have">มีแล้ว</span>
            </div>
          </div>
          <button class="picker-clear" @click="chooseTarget(target)">{{ target ? 'ล้างเป้าหมาย' : 'ปิด' }}</button>
        </div>
      </div>
    </Teleport>

    <!-- legendary info (flavor) -->
    <Teleport to="body">
      <div v-if="infoPet" class="ov" @click.self="infoPet = null">
        <div class="info-box">
          <button class="info-x" aria-label="ปิด" @click="infoPet = null">✕</button>
          <div class="info-emoji"><Emoji :char="infoPet.emoji" /></div>
          <div class="info-name">{{ infoPet.name }}</div>
          <div class="info-rarity" :style="{ background: rarityColor(infoPet.rarity) }">{{ RARITY[infoPet.rarity]?.label }}</div>
          <div class="info-flavor">“{{ infoPet.flavor }}”</div>
          <div v-if="passiveOf(infoPet)" class="info-passive">
            <b><Emoji :char="passiveOf(infoPet).icon" /> {{ passiveOf(infoPet).name }}</b> — {{ passiveText(passiveOf(infoPet)) }}
          </div>
          <button class="info-target" @click="chooseTarget(infoPet.id); infoPet = null">ตั้งเป็นเป้าหมาย</button>
        </div>
      </div>
    </Teleport>

    <!-- reveal: anticipate (ลุ้น) → show (เผย) -->
    <Teleport to="body">
      <div v-if="reveal" class="rv-ov" :class="[`r-${reveal.best}`, reveal.phase]" @click.self="closeReveal">
        <!-- จังหวะลุ้น: ลูกแก้วเรืองแสงสี rarity สูงสุด -->
        <div v-if="reveal.phase === 'anticipate'" class="anti" role="button" tabindex="0"
          aria-label="ข้ามการอัญเชิญ" :style="{ '--glow': rarityColor(reveal.best) }"
          @click="skipReveal" @keydown.enter.prevent="skipReveal" @keydown.space.prevent="skipReveal">
          <div class="orb"><span class="orb-core"></span></div>
          <div class="anti-txt">กำลังอัญเชิญ…</div>
          <div class="anti-skip">แตะเพื่อข้าม</div>
        </div>
        <!-- จังหวะเผย -->
        <div v-else class="rv-box" :class="{ legend: reveal.best === 'legendary' }" @click.stop>
          <div v-if="reveal.best === 'legendary'" class="legend-rays" aria-hidden="true"></div>
          <div class="rv-inner">
            <div class="rv-label">คุณได้รับ!</div>
            <div class="rv-grid" :class="{ single: !reveal.multi }">
              <div v-for="(s, i) in reveal.summary" :key="i" class="rv-cell"
                :style="{ borderColor: rarityColor(s.rarity), '--rc': rarityColor(s.rarity), animationDelay: (reveal.multi ? i * 65 : 0) + 'ms' }">
                <span class="rv-emoji"><Emoji :char="s.emoji" /></span>
                <span class="rv-nm">{{ s.name }}</span>
                <span class="rv-badge" :style="{ background: rarityColor(s.rarity) }">{{ s.isNew ? 'ใหม่!' : '+1' }}</span>
              </div>
            </div>
            <button class="rv-ok" @click="closeReveal">เยี่ยม!</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useEscapeKey } from '../composables/useEscapeKey.js'
import { computed, ref } from 'vue'
import Emoji from '../components/shared/Emoji.vue'
import HelpButton from '../components/help/HelpButton.vue'
import LabTab from '../components/shop/LabTab.vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/useToast.js'
import { PETS, RARITY, passiveOf } from '../data/index.js'
import { passiveText } from '../data/petPassives.js'
import { bumpDailyQuest } from '../utils/dailyQuest.js'
import { rollMany, resolvePullPayment, GACHA_RATES, PULL_COST, TEN_PULL_COST, TEN_PULL_N, HARD_PITY } from '../utils/gacha.js'
import { mergeRolls } from '../utils/gachaMerge.js'
import { useNewsPost } from '../composables/useNewsPost.js'

const authStore = useAuthStore()
const { toast } = useToast()

// ร้านค้าเปิดให้นักศึกษาแล้ว (21 มิ.ย. 2026) — flip false เพื่อปิดปรับปรุง (admin เห็นร้านปกติเสมอ)
const SHOP_OPEN = true
const shopOpen = computed(() => SHOP_OPEN || authStore.isAdmin)
const { postNews, myName } = useNewsPost()
const tab = ref('gacha') // 'gacha' | 'lab'

const coins   = computed(() => authStore.userData?.coins || 0)
const pets    = computed(() => authStore.userData?.pets || [])
const tickets = computed(() => authStore.userData?.freeGachaTickets || 0)
const pity    = computed(() => authStore.userData?.gachaPity || 0)
const target  = computed(() => authStore.userData?.gachaTarget || null)
const guaranteed = computed(() => !!authStore.userData?.gachaGuaranteed)

const legendaries = PETS.filter((p) => p.rarity === 'legendary')
const targetPet = computed(() => legendaries.find((p) => p.id === target.value) || null)
const pityLeft  = computed(() => Math.max(0, HARD_PITY - pity.value))
const pay1  = computed(() => resolvePullPayment(1, tickets.value))
const pay10 = computed(() => resolvePullPayment(10, tickets.value))

const reveal = ref(null)       // { summary, multi }
const pickerOpen = ref(false)
useEscapeKey(pickerOpen, () => { pickerOpen.value = false })
const infoPet = ref(null)
useEscapeKey(infoPet, () => { infoPet.value = null })      // legendary ที่กดดู flavor ใน picker
const buying = ref(false)

const rarityColor = (r) => RARITY[r]?.color || '#94a3b8'
const ownedLegendaryIds = () => pets.value.filter((p) => p.rarity === 'legendary').map((p) => p.id)

// reveal animation: จังหวะ "ลุ้น" (anticipate, สีลูกแก้ว = rarity สูงสุด) → "เผย" (show)
const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 }
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let revealTimer = null
function showReveal(summary, multi) {
  const best = summary.reduce((b, s) => (RANK[s.rarity] > RANK[b] ? s.rarity : b), 'common')
  clearTimeout(revealTimer)
  reveal.value = { summary, multi, best, phase: reduceMotion() ? 'show' : 'anticipate' }
  if (reveal.value.phase === 'anticipate') {
    revealTimer = setTimeout(() => { if (reveal.value) reveal.value = { ...reveal.value, phase: 'show' } }, 1300)
  }
}
function skipReveal() { clearTimeout(revealTimer); if (reveal.value) reveal.value = { ...reveal.value, phase: 'show' } }
function closeReveal() { clearTimeout(revealTimer); reveal.value = null }

const rateList = ['legendary', 'epic', 'rare', 'common'].map((k) => ({ key: k, pct: GACHA_RATES[k], color: RARITY[k]?.color, label: RARITY[k]?.label }))

async function pull(n) {
  if (buying.value) return
  const { rolls, pay, amount } = resolvePullPayment(n, tickets.value)
  if (pay === 'coin' && coins.value < amount) { toast(`เหรียญไม่พอ! ต้องการ ${amount.toLocaleString()}`, 'error'); return }

  const state = { pity: pity.value, target: target.value, guaranteed: guaranteed.value, ownedLegendaryIds: ownedLegendaryIds() }
  const { results, nextState } = rollMany(rolls, state, PETS)
  const { pets: newPets, summary } = mergeRolls(pets.value, results, PETS)
  const today = new Date().toISOString().slice(0, 10)
  const dq = bumpDailyQuest(authStore.userData?.dailyQuest, 'gacha', today, 1)

  buying.value = true
  // NOTE: gachaTarget ไม่เขียนที่นี่ — เป็นของ chooseTarget() (กัน stale-target write)
  const base = { pets: newPets, dailyQuest: dq, gachaPity: nextState.pity, gachaGuaranteed: nextState.guaranteed }
  const optimistic = {
    ...base,
    ...(pay === 'ticket'
      ? { freeGachaTickets: tickets.value - amount }
      : { coins: coins.value - amount, totalSpent: (authStore.userData?.totalSpent || 0) + amount }),
  }
  const server = {
    ...base,
    ...(pay === 'ticket'
      ? { freeGachaTickets: increment(-amount) }
      : { coins: increment(-amount), totalSpent: increment(amount) }),
  }
  const ok = await authStore.patchUser(optimistic, server)
  buying.value = false
  if (ok) {
    showReveal(summary, rolls > 1)
    // ข่าวกระดาน (เลนอยู่ยาว): เปิด 10 ครั้งได้ legendary 2 ตัว = ข่าวเดียว ยิงตัวแรกที่เจอ
    const leg = results.find((r) => r.rarity === 'legendary')
    if (leg) {
      const petName = PETS.find((p) => p.id === leg.id)?.name || 'เพ็ทระดับตำนาน'
      postNews({ type: 'legendary', icon: '✨', msg: `${myName()} เปิดแคปซูลได้ ${petName}` })
    }
  }
  else toast('สุ่มไม่สำเร็จ', 'error')
}

async function chooseTarget(id) {
  const next = target.value === id ? null : id
  await authStore.patchUser({ gachaTarget: next }, { gachaTarget: next })
  pickerOpen.value = false
}
</script>

<style scoped>
.shop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.shop-coins { font-size: 1rem; font-weight: 800; color: #b45309; }
.shop-storage { font-size: .72rem; color: rgba(0,0,0,.55); margin-bottom: 14px; }
.shop-note { font-size: .7rem; color: rgba(0,0,0,.4); text-align: center; margin-top: 14px; }
.shop-login { text-align: center; color: rgba(0,0,0,.4); padding: 30px 0; }
.shop-maint { text-align: center; padding: 48px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.shop-maint-emoji { font-size: 3rem; }
.shop-maint-title { font-size: 1.2rem; font-weight: 800; color: var(--ink); }
.shop-maint-msg { font-size: .82rem; color: rgba(0,0,0,.55); max-width: 280px; line-height: 1.6; }

.banner { background: #fff; border: 2px solid var(--ink); border-radius: 16px; padding: 14px; box-shadow: var(--pop); }
.banner-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.banner-title { font-weight: 800; font-size: .95rem; }
.banner-pity { font-size: .7rem; color: #b45309; font-weight: 700; }
.target-row { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px; border: 2px dashed var(--ink); border-radius: 11px; padding: 8px 10px; background: var(--primary-light); font-family: inherit; font-size: .72rem; cursor: pointer; text-align: left; }
.target-emoji { font-size: 1.4rem; }
.target-text { flex: 1; min-width: 0; }
.target-edit { font-weight: 800; color: var(--primary); font-size: .7rem; }
.banner-guar { margin-top: 6px; font-size: .7rem; font-weight: 700; color: #059669; }
.banner-rates { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; font-size: .7rem; font-weight: 700; }
.ticket-note { font-size: .7rem; font-weight: 800; color: #b45309; margin-bottom: 8px; }
.pull-row { display: flex; gap: 8px; }
.pull-btn { flex: 1; border: 2px solid var(--ink); border-radius: 11px; padding: 10px; font-family: inherit; font-weight: 800; font-size: .85rem; color: #fff; background: #c9c2d4; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.pull-btn small { font-size: .7rem; font-weight: 700; }
.pull-btn.ok { background: var(--primary); box-shadow: var(--pop); }
.pull-btn.ok:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.pull-btn:disabled { opacity: .6; }
.ov { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 20px; overscroll-behavior: contain; }
.picker { background: #fff; border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop-lg); padding: 18px; width: 100%; max-width: 360px; max-height: 80vh; overflow-y: auto; }
.picker-head { font-weight: 800; margin-bottom: 12px; text-align: center; }
.picker-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.picker-cell { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 11px; padding: 8px 4px; background: #fff; cursor: pointer; font-family: inherit; }
.picker-cell.on { background: var(--gold); }
.picker-info { position: absolute; top: 2px; right: 2px; border: none; background: transparent; padding: 2px; font-size: .7rem; line-height: 1; cursor: pointer; opacity: .65; }
.picker-info:active { opacity: 1; }
.picker-hint { font-size: .7rem; color: rgba(0,0,0,.45); text-align: center; margin-bottom: 8px; }
.picker-emoji { font-size: 1.6rem; }
.picker-name { font-size: .7rem; font-weight: 700; }
.picker-have { font-size: .7rem; color: #059669; font-weight: 800; }
.picker-clear { width: 100%; margin-top: 12px; border: 2px solid var(--ink); border-radius: 11px; padding: 9px; font-family: inherit; font-weight: 800; background: #fff; cursor: pointer; }
.info-box { position: relative; background: #fff; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); padding: 24px 20px 20px; text-align: center; max-width: 320px; width: 100%; }
.info-x { position: absolute; right: 12px; top: 12px; border: none; background: rgba(0,0,0,.08); border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.info-emoji { font-size: 3.4rem; }
.info-name { font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; margin-top: 2px; }
.info-rarity { display: inline-block; color: #fff; font-size: .7rem; font-weight: 800; padding: 2px 10px; border-radius: 999px; margin-top: 6px; }
.info-flavor { font-size: .8rem; color: rgba(0,0,0,.65); line-height: 1.6; margin: 12px 4px; font-style: italic; }
.info-passive { font-size: .7rem; color: rgba(0,0,0,.45); background: rgba(0,0,0,.04); border-radius: 9px; padding: 7px; }
.info-target { width: 100%; margin-top: 14px; border: 2px solid var(--ink); border-radius: 11px; padding: 10px; font-family: inherit; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; }
/* ── reveal: ลุ้น (anticipate) → เผย (show) ── */
.rv-ov { position: fixed; inset: 0; z-index: 410; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(10,8,20,.74); overscroll-behavior: contain; }
.rv-ov.anticipate { cursor: pointer; }

.anti { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.orb { position: relative; width: 128px; height: 128px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 42%, #fff 0%, var(--glow) 52%, rgba(0,0,0,.42) 108%);
  box-shadow: 0 0 58px 8px var(--glow), inset 0 0 22px rgba(255,255,255,.55);
  animation: orb-pulse .62s ease-in-out infinite alternate; }
.orb::before { content: ''; position: absolute; inset: -32px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0 16%, var(--glow) 24%, transparent 33% 66%, var(--glow) 76%, transparent 84%);
  opacity: .5; filter: blur(2px); animation: orb-spin 2.4s linear infinite; }
.orb-core { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.92); box-shadow: 0 0 20px #fff; animation: orb-core .62s ease-in-out infinite alternate; }
.anti-txt { color: #fff; font-family: var(--font-display); font-weight: 400; font-size: 1.3rem; letter-spacing: .03em; text-shadow: 0 0 16px var(--glow); }
.anti-skip { color: rgba(255,255,255,.5); font-size: .7rem; }

.rv-box { position: relative; background: #fff; border: 2px solid var(--ink); border-radius: 22px; box-shadow: var(--pop-lg); padding: 22px; text-align: center; max-width: 340px; width: 100%; overflow: hidden; animation: rv-pop .34s cubic-bezier(.2,1.3,.45,1); }
.rv-box.legend { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold), 0 0 40px 4px rgba(245,158,11,.5), var(--pop-lg); }
.rv-inner { position: relative; z-index: 1; }
.legend-rays { position: absolute; left: 50%; top: 42%; width: 220%; height: 220%; transform: translate(-50%,-50%); z-index: 0; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, rgba(245,158,11,.5) 0deg 7deg, transparent 7deg 22deg);
  animation: ray-spin 9s linear infinite, ray-fade 2.4s ease-out both; }
.rv-label { font-size: .8rem; color: rgba(0,0,0,.5); margin-bottom: 10px; }
.rv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.rv-grid.single { grid-template-columns: 1fr; }
.rv-cell { position: relative; border: 2px solid var(--ink); border-radius: 11px; padding: 8px 2px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff; animation: cell-in .42s cubic-bezier(.2,1.3,.45,1) both; }
.rv-grid.single .rv-cell { animation: cell-pop .52s cubic-bezier(.2,1.45,.4,1) both; box-shadow: 0 0 22px -2px var(--rc); }
.rv-grid.single .rv-emoji { font-size: 3.4rem; }
.rv-emoji { font-size: 1.7rem; }
.rv-nm { font-size: .7rem; font-weight: 700; }
.rv-grid.single .rv-nm { font-size: .9rem; }
.rv-badge { color: #fff; font-size: .7rem; font-weight: 800; padding: 1px 5px; border-radius: 999px; }
.rv-ok { position: relative; z-index: 1; display: block; width: 100%; margin-top: 16px; border: 2px solid var(--ink); border-radius: 12px; padding: 11px; font-family: inherit; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; }

@keyframes orb-pulse { from { transform: scale(.92); } to { transform: scale(1.08); box-shadow: 0 0 80px 14px var(--glow), inset 0 0 22px rgba(255,255,255,.6); } }
@keyframes orb-core { from { transform: scale(.78); opacity: .78; } to { transform: scale(1.16); opacity: 1; } }
@keyframes orb-spin { to { transform: rotate(360deg); } }
@keyframes rv-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes cell-in { from { transform: translateY(14px) scale(.82); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes cell-pop { 0% { transform: scale(.4); opacity: 0; } 62% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
@keyframes ray-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
@keyframes ray-fade { from { opacity: .85; } to { opacity: .4; } }

@media (prefers-reduced-motion: reduce) {
  .orb, .orb::before, .orb-core, .rv-box, .rv-cell, .legend-rays { animation: none !important; }
}

.shop-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.shop-tab { flex: 1; border: 2px solid var(--ink); border-radius: 11px; padding: 9px; font-family: inherit; font-weight: 800; font-size: .82rem; background: #fff; color: var(--ink); cursor: pointer; }
.shop-tab.on { background: var(--gold); }
</style>
