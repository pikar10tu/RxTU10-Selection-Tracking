<template>
  <!-- Teleport ไป body: #main-content (position:fixed) = stacking context → z-index สู้ #bottom-nav (z200) ไม่ได้ถ้า render ในนี้ (ดู CLAUDE.md) -->
  <Teleport to="body">
  <div v-if="member" class="pf-ov" @click.self="$emit('close')">
    <div class="pf-box">
      <!-- Tier 1: hero (residence art = the flex background) -->
      <div class="pf-hero" :style="heroStyle">
        <button class="pf-x" @click="$emit('close')">✕</button>
        <div class="pf-hero-art"><Emoji :char="tier.art" /></div>
        <img class="pf-avatar" :src="avatar" :alt="member.nickname" @error="(e) => fallbackAvatar(e, member?.nickname)" />
        <div v-if="member.realName" class="pf-real">{{ member.realName }}</div>
        <div class="pf-name">{{ member.nickname }}</div>
        <div class="pf-residence"><Emoji :char="tier.art" /> {{ tier.tierName }} · Lv.{{ lvl }}</div>
        <div class="pf-chips">
          <span class="pf-chip" :style="{ background: trackColor }">{{ trackLabel }}</span>
        </div>
        <div class="pf-chips" style="margin-top:5px"><TagChips :member="member" /></div>
      </div>

      <div class="pf-ach"><AchievementGrid :uid="member?.uid" /></div>

      <!-- Tier 2: stat strip (max 3, no coins) -->
      <div class="pf-stats">
        <div class="pf-stat"><span><Emoji char="⚔️" /></span><b>{{ member.pvpVictories || 0 }}</b><small>PvP ชนะ</small></div>
        <div class="pf-stat"><span><Emoji char="🏯" /></span><b>{{ member.towerBest || 0 }}</b><small>หอคอย</small></div>
        <div class="pf-stat"><span><Emoji char="🐾" /></span><b>{{ (member.pets || []).length }}</b><small>สัตว์เลี้ยง</small></div>
      </div>

      <!-- Tier 3: active team (tap to see stats) -->
      <div class="pf-team-label"><Emoji char="⭐" /> ทีมต่อสู้</div>
      <div v-if="showcase.length" class="pf-showcase">
        <button v-for="(p, i) in showcase" :key="p.id || i" class="pf-pet" @click="petPopup = p">
          <PetThumb :pet="p" />
        </button>
      </div>
      <div v-else class="pf-team-empty">ยังไม่ได้ตั้งทีม</div>

      <PetStatPopup :pet="petPopup" @close="petPopup = null" />

      <!-- Tier 4: contact (only filled rows) -->
      <div v-if="hasContact" class="pf-contact">
        <div v-if="member.contact?.phone"><span><Emoji char="📞" /></span>{{ member.contact.phone }}</div>
        <div v-if="member.contact?.ig"><span><Emoji char="📷" /></span>{{ member.contact.ig }}</div>
        <div v-if="member.contact?.line"><span><Emoji char="💬" /></span>{{ member.contact.line }}</div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { getTier } from '../../data/residence.js'
import { letterAvatar, fallbackAvatar } from '../../utils/avatar.js'
import TagChips from '../shared/TagChips.vue'
import AchievementGrid from '../shared/AchievementGrid.vue'
import PetStatPopup from '../pets/PetStatPopup.vue'
import PetThumb from '../shared/PetThumb.vue'

const props = defineProps({ member: { type: Object, default: null } })
defineEmits(['close'])

const petPopup = ref(null)

const lvl  = computed(() => props.member?.residence?.level || 1)
const tier = computed(() => getTier(lvl.value))

const avatar = computed(() =>
  props.member?.customPhoto || props.member?.googlePhoto ||
  letterAvatar(props.member?.nickname)
)
const heroStyle = computed(() => ({
  background: `linear-gradient(135deg, ${tier.value.frameColor}, ${tier.value.frameColor}99)`,
}))

const TRACK = { sci: ['Sci', '#22c55e'], care: ['Care', '#3b82f6'], guest: ['Guest', '#9ca3af'] }
const isGuest = computed(() => props.member?.accountType === 'guest' || props.member?.track === 'guest')
const trackLabel = computed(() => (isGuest.value ? 'ผู้เยี่ยมชม' : (TRACK[props.member?.track]?.[0]) || 'สมาชิก'))
const trackColor = computed(() => (isGuest.value ? (TRACK.guest[1]) : (TRACK[props.member?.track]?.[1]) || '#6366f1'))

// active team only: resolve activePets (species id, with instId fallback for not-yet-migrated members)
const showcase = computed(() => {
  const pets = props.member?.pets || []
  const ids = (props.member?.activePets || []).map(x => (typeof x === 'string' ? x : x?.instId)).filter(Boolean)
  return ids.map(id => pets.find(p => p.id === id || p.instId === id)).filter(Boolean)
})
const hasContact = computed(() => {
  const c = props.member?.contact || {}
  return !!(c.phone || c.ig || c.line)
})
</script>

<style scoped>
.pf-ov { position: fixed; inset: 0; z-index: 220; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.pf-box { background: #fff; width: 100%; max-width: 400px; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); overflow: hidden; max-height: 88vh; overflow-y: auto; }
.pf-hero { position: relative; padding: 22px 16px 16px; text-align: center; color: #fff; overflow: hidden; }
.pf-hero-art { position: absolute; right: -10px; top: -10px; font-size: 5rem; opacity: .25; }
.pf-x { position: absolute; left: 12px; top: 12px; border: none; background: rgba(255,255,255,.25); color: #fff; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.pf-avatar { width: 72px; height: 72px; border-radius: 50%; border: 3px solid rgba(255,255,255,.7); object-fit: cover; background: #fff; }
.pf-real {
  font-family: var(--font-display); font-weight: 400;
  font-size: 1.3rem; margin-top: 8px; padding: 0 14px;
  line-height: 1.25;
}
.pf-name { font-size: .82rem; font-weight: 600; opacity: .85; margin-top: 1px; }
.pf-chips { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; margin-top: 10px; }
.pf-chip { font-size: .7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; color: #fff; }
.pf-chip.founder { background: rgba(0,0,0,.3); }
.pf-residence {
  font-size: .72rem; font-weight: 700; margin-top: 6px; opacity: .95; padding: 0 14px;
  line-height: 1.3;
}
.pf-ach { padding: 12px 16px 0; }
.pf-stats { display: flex; }
.pf-stat { flex: 1; text-align: center; padding: 14px 4px; border-right: 1px solid rgba(0,0,0,.06); }
.pf-stat:last-child { border-right: none; }
.pf-stat span { font-size: 1rem; }
.pf-stat b { display: block; font-size: 1.1rem; font-weight: 800; }
.pf-stat small { font-size: .7rem; color: rgba(0,0,0,.45); }
.pf-team-label { font-size: .7rem; font-weight: 800; color: var(--muted, #9b8fb0); text-align: center; padding: 12px 0 0; border-top: 1px solid rgba(0,0,0,.06); }
.pf-team-empty { text-align: center; font-size: .7rem; color: rgba(0,0,0,.35); padding: 8px 0 14px; }
.pf-showcase { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 10px 12px 12px; max-height: 180px; overflow-y: auto; }
.pf-pet { width: 58px; padding: 0; border: none; background: none; cursor: pointer; font-family: inherit; }
.pf-pet:active { transform: scale(.92); }
.pf-contact { padding: 12px 16px 16px; border-top: 1px solid rgba(0,0,0,.06); display: flex; flex-direction: column; gap: 6px; font-size: .78rem; color: rgba(0,0,0,.65); }
.pf-contact div { display: flex; gap: 8px; align-items: center; }
</style>
