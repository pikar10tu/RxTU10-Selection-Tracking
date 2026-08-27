<!-- TeamPicker — จัดทีม (= activePets, 3 ช่องคงที่ = BATTLE_SLOTS) ใช้ร่วมหอคอย+สนามประลอง+หน้าเพ็ท
     โมเดล "ช่องคือเคอร์เซอร์" (ref: Epic Seven / Summoners War / Honkai Star Rail / FEH):
       · แตะช่อง = ย้ายเคอร์เซอร์ไปช่องนั้น (แค่นั้น ไม่เด้งโมดัล)
       · แตะการ์ดในคลัง = ลงช่องที่เคอร์เซอร์อยู่ — ทีมเต็มก็ยังกดได้ = สลับตัวทันที
       · ปุ่ม ⋯ มุมช่อง = เปิดหน้าข้อมูลเพ็ท (ดู/วิวัฒน์/ถอด)
     เดิมแตะช่อง = เปิดโมดัล แต่แตะคลัง = สลับเข้า/ออก ทั้งที่หน้าตาเป็นปุ่มเหมือนกัน → ผู้เล่นงง
     และทีมเต็มแล้วคลังจะจางกดไม่ได้ทั้งแถบ โดยไม่บอกว่าต้องไปถอดตัวเก่าก่อน
     ตรรกะช่องอยู่ที่ utils/teamSlots.js (pure + มีเทส) — ที่นี่เหลือแค่ผูกสาย -->
<template>
  <BottomSheet :open="open" icon="⚔️" title="จัดทีมต่อสู้" @update:open="$emit('update:open', $event)">
    <div
      class="tp-slots" role="radiogroup" aria-label="ช่องทีมต่อสู้"
      :style="{ gridTemplateColumns: `repeat(${battleSlots}, 78px)` }"
    >
      <div v-for="(id, i) in slots" :key="i" class="tp-slotwrap">
        <button
          type="button" class="tp-slot" :class="{ filled: id, cur: cursor === i }"
          role="radio" :aria-checked="cursor === i"
          :aria-label="id ? `ช่อง ${i + 1} · ${defOf(id).name} — เลือกช่องนี้` : `ช่อง ${i + 1} ว่าง — เลือกช่องนี้`"
          @click="cursor = i"
        >
          <PetThumb v-if="id" :pet="slotPetOf(id)" />
          <span v-else class="tp-empty">+</span>
        </button>
        <span class="tp-slotno">{{ slotNo(i) }}</span>
        <button
          v-if="id" type="button" class="tp-more"
          :aria-label="`ดูข้อมูล ${defOf(id).name}`" @click.stop="detailId = id"
        >⋯</button>
      </div>
    </div>

    <div class="tp-status">
      <template v-if="teamFull">
        เลือกช่อง <b>{{ slotNo(cursor) }}</b> อยู่ · แตะตัวข้างล่างเพื่อสลับเข้าแทน
      </template>
      <template v-else>
        กำลังเลือกให้ช่อง <b>{{ slotNo(cursor) }}</b> · แตะตัวข้างล่างได้เลย
      </template>
    </div>
    <div class="tp-status sub">ตัวซ้ายสุดออกตีก่อน · เอาออกจากทีมที่ปุ่ม ⋯</div>

    <div class="tp-pool">
      <button
        v-for="p in sortedOwned" :key="p.id"
        class="tp-pet" :class="{ active: slotNoOf(p.id) > 0, away: expeditionIds.has(p.id) }"
        :style="{ borderColor: rarityColor(p.id) }"
        :aria-label="`${defOf(p.id).name} — ใส่ลงช่อง ${slotNo(cursor)}`"
        @click="pick(p.id)"
      >
        <span v-if="expeditionIds.has(p.id)" class="tp-away"><Emoji char="🗺️" /></span>
        <span v-else-if="slotNoOf(p.id) > 0" class="tp-inteam">{{ slotNo(slotNoOf(p.id) - 1) }}</span>
        <span class="tp-el"><Emoji :char="elEmoji(p.id)" /></span>
        <span class="tp-emoji"><Emoji :char="defOf(p.id).emoji" /></span>
        <span class="tp-name">{{ defOf(p.id).name }}</span>
        <PetStatLine :pet="p" />
      </button>
      <div v-if="!owned.length" class="tp-none">
        ยังไม่มีเพ็ท — ไปอัญเชิญตัวแรกก่อนนะ
        <RouterLink to="/shop" class="tp-none-cta">ไปอัญเชิญเลย →</RouterLink>
      </div>
    </div>

    <PetDetailModal :pet-id="detailId" @close="detailId = null" />
  </BottomSheet>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import BottomSheet from '../shared/BottomSheet.vue'
import PetDetailModal from '../pets/PetDetailModal.vue'
import PetStatLine from '../shared/PetStatLine.vue'
import PetThumb from '../shared/PetThumb.vue'
import { useRosterSync } from '../../composables/useRosterSync.js'
import { useToast } from '../../composables/useToast.js'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { getPetDef, RARITY, ELEMENTS } from '../../data/index.js'
import { BATTLE_SLOTS } from '../../data/residence.js'
import { toSlots, firstEmpty, placeAt } from '../../utils/teamSlots.js'

const props = defineProps({ open: { type: Boolean, default: false } })
defineEmits(['update:open'])

const SLOT_NO = ['①', '②', '③', '④', '⑤']
const slotNo = (i) => SLOT_NO[i] || String((i || 0) + 1)

const auth = useAuthStore()
const { syncRosterRow } = useRosterSync()
const { toast } = useToast()
const detailId = ref(null)
const cursor = ref(0)
const owned = computed(() => auth.userData?.pets || [])
// เพ็ทที่กำลังออกผจญภัย — เอาเข้าทีมไม่ได้จนกว่าจะกลับ (แต่ยังกดได้ เพื่อเด้งเหตุผลบอก)
const expeditionIds = computed(() => new Set(auth.userData?.expedition?.petIds || []))
const battleSlots = computed(() => BATTLE_SLOTS)
const ownedIds = computed(() => new Set(owned.value.map(p => p.id)))
// active เฉพาะตัวที่ยังครอบครอง ตัดให้ยาวไม่เกิน battleSlots
const activeIds = computed(() =>
  (auth.userData?.activePets || []).filter(id => id && ownedIds.value.has(id)).slice(0, battleSlots.value))
const slots = computed(() => toSlots(activeIds.value, battleSlots.value))
const teamFull = computed(() => activeIds.value.length >= battleSlots.value)
/** ตัวนี้อยู่ช่องที่เท่าไหร่ (1-based) · 0 = ไม่ได้อยู่ในทีม */
const slotNoOf = (id) => slots.value.indexOf(id) + 1

// เปิดแผ่นมา → เคอร์เซอร์ไปช่องว่างช่องแรก (เต็มแล้ว = ช่อง 1)
watch(() => props.open, (o) => {
  if (!o) return
  const e = firstEmpty(slots.value)
  cursor.value = e >= 0 ? e : 0
}, { immediate: true })

const defOf = (id) => getPetDef(id) || { emoji: '❓', name: '?', rarity: 'common', element: 'scissors' }
const slotPetOf = (id) => owned.value.find(p => p.id === id) || { id }
const rarityColor = (id) => RARITY[defOf(id).rarity]?.color || '#94a3b8'
const elEmoji = (id) => ELEMENTS[defOf(id).element]?.emoji || '✊'

// เรียง legendary→common → เกรดสูงก่อน → ชื่อ (เหมือนหน้าเพ็ท)
const RANK = { legendary: 0, epic: 1, rare: 2, common: 3 }
const sortedOwned = computed(() => owned.value.slice().sort((a, b) => {
  const da = defOf(a.id), db = defOf(b.id)
  return (RANK[da.rarity] - RANK[db.rarity]) || ((b.grade || 0) - (a.grade || 0)) || (da.name || '').localeCompare(db.name || '')
}))

async function save(next) {
  await auth.patchUser({ activePets: next }, { activePets: next })
  syncRosterRow()   // ทีมเปลี่ยน → คู่ต่อสู้ใน Arena ต้องเห็นทีมใหม่
}

function pick(id) {
  if (expeditionIds.value.has(id)) {
    toast(`${defOf(id).name} กำลังออกผจญภัย — รอกลับมาก่อนถึงจะจัดลงทีมได้`, 'info')
    return
  }
  const res = placeAt(slots.value, cursor.value, id, battleSlots.value)
  // เก็บลง activePets แบบไม่มีรู — engine อ่านทีมเป็น index (A0/A1/A2) ตัวจริงจึงต้องเรียงติดกัน
  const compact = res.slots.filter(Boolean)
  // ⚠️ ช่องว่างจริงหลังยุบ = ท้ายสุดของ compact เสมอ จะเอา res.cursor มาใช้ตรงๆ ไม่ได้
  //    (res.cursor คิดจากอาเรย์ที่ยังมีรู — ถ้าเผลอใช้ เคอร์เซอร์จะไปชี้ช่องที่มีตัวอยู่)
  cursor.value = compact.length < battleSlots.value ? compact.length : res.cursor
  save(compact)
}
</script>

<style scoped>
.tp-slots { display: grid; gap: 8px; margin-bottom: 4px; justify-content: center; }
.tp-slotwrap { position: relative; }
.tp-slot { width: 100%; padding: 0; font-family: inherit; aspect-ratio: 1; border: 2px dashed rgba(0,0,0,.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; background: #f8fafc; cursor: pointer; }
.tp-slot.filled { border: none; background: none; }
.tp-empty { color: rgba(0,0,0,.25); font-size: 1.6rem; }
/* เคอร์เซอร์ = ช่องที่กำลังเล็ง · ใช้ outline เพราะไม่กินพื้นที่ layout จึงไม่ดันการ์ดข้างๆ ขยับ */
.tp-slot.cur { outline: 3px solid var(--primary); outline-offset: 2px; border-color: var(--primary); animation: tp-pulse 1.4s ease-in-out infinite; }
@keyframes tp-pulse { 0%, 100% { outline-color: var(--primary); } 50% { outline-color: rgba(79,70,229,.35); } }
@media (prefers-reduced-motion: reduce) { .tp-slot.cur { animation: none; } }
.tp-slotno { position: absolute; top: -6px; left: -4px; font-size: .78rem; color: var(--ink); background: #fff; border-radius: 999px; line-height: 1; padding: 1px; pointer-events: none; }
.tp-more { position: absolute; bottom: -6px; right: -6px; width: 26px; height: 26px; border-radius: 999px; border: 2px solid var(--ink); background: #fff; color: var(--ink); font-family: inherit; font-size: .8rem; font-weight: 800; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--pop); }
.tp-more:active { transform: translate(1px,1px); box-shadow: 0 0 0 var(--ink); }

.tp-status { font-size: .74rem; color: rgba(0,0,0,.6); text-align: center; margin-top: 10px; }
.tp-status b { color: var(--primary); }
.tp-status.sub { font-size: .7rem; color: rgba(0,0,0,.4); margin: 2px 0 12px; }

.tp-pool { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.tp-pet { position: relative; border: 2px solid #ddd; border-radius: 12px; background: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 14px 2px 6px; font-family: inherit; transition: transform .1s; }
.tp-pet:active { transform: scale(.95); }
.tp-pet.active { background: #eef2ff; box-shadow: inset 0 0 0 2px var(--primary); }
.tp-emoji { font-size: 1.7rem; line-height: 1; }
.tp-name { font-size: .7rem; font-weight: 700; color: rgba(0,0,0,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
/* ออกผจญภัย = จางบอกว่าใช้ไม่ได้ตอนนี้ แต่ยังกดได้ (กดแล้วเด้งเหตุผล ไม่ใช่เงียบเหมือน :disabled เดิม) */
.tp-pet.away { opacity: .45; }
.tp-away { position: absolute; top: 2px; right: 3px; font-size: .7rem; line-height: 1; }
.tp-inteam { position: absolute; top: 1px; right: 3px; font-size: .8rem; line-height: 1; color: var(--primary); }
.tp-el { position: absolute; top: 2px; left: 3px; font-size: .72rem; line-height: 1; }
.tp-none { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; font-size: .76rem; color: rgba(0,0,0,.4); padding: 16px 0; }
.tp-none-cta { border: 2px solid var(--ink); background: var(--primary); color: #fff; border-radius: 11px; padding: 9px 18px; font-weight: 800; font-size: .8rem; text-decoration: none; box-shadow: var(--pop); }
</style>
