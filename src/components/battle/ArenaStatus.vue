<!-- src/components/battle/ArenaStatus.vue -->
<!-- แผงสถานะสนามประลอง — พื้นเข้มใบเดียวในหน้า จึงเด่นสุดโดยไม่ต้องแข่งกับใคร
     ไล่สีตระกูลเดียวกับ .tower-arena ใน style.css เพื่อให้อ่านเป็นพี่น้องกับหอคอย
     ⚠️ พื้นเข้ม — ตัวอักษรรองต้องเป็นขาวโปร่ง ห้ามก๊อป rgba(0,0,0,..) จากการ์ดพื้นขาว (CLAUDE.md ข้อ 13) -->
<template>
  <div class="as">
    <div class="as-top">
      <span class="as-score">
        <b class="as-num">{{ rating.toLocaleString() }}</b>
        <span class="as-unit">แต้มประลอง</span>
      </span>
      <span class="as-rank">{{ rankLabel }}</span>
    </div>

    <div class="as-line2">
      <span class="as-wl">ชนะ {{ wins }} · แพ้ {{ losses }}</span>
      <!-- ป้ายซีซั่น: applySeasonReset ล้างชนะ/แพ้ทุกต้นเดือนอย่างเงียบๆ ถ้าไม่บอกก็เหมือนสถิติหายเฉยๆ -->
      <span class="as-season">ซีซั่น {{ seasonLabel }}</span>
    </div>

    <div class="as-quota">
      <span class="as-dots" role="img" :aria-label="`บุกได้อีก ${attacksLeft} จาก ${max} ครั้ง`">
        <i v-for="i in max" :key="i" class="as-dot" :class="{ used: i > attacksLeft }" />
      </span>
      <span class="as-quota-txt">
        {{ attacksLeft > 0 ? `บุกได้อีก ${attacksLeft} ครั้งวันนี้` : 'โควตาวันนี้หมดแล้ว พรุ่งนี้เริ่มใหม่' }}
      </span>
    </div>

    <div class="as-sep" />

    <div class="as-team">
      <span class="as-team-l">
        <span class="as-team-cap">ทีมเฝ้าบ้าน</span>
        <span v-if="team.length" class="as-thumbs">
          <PetThumb v-for="(p, i) in team" :key="i" :pet="p" />
        </span>
        <!-- ⚠️ ข้อความนี้ตรงตามโค้ดจริง: rosterOpponents() ข้ามแถวที่ tm ว่าง
             ⇒ ไม่จัดทีม = ไม่โผล่บนกระดานของใครเลย ห้ามเขียนว่า "จะโดนบุกแล้วแพ้ฟรี" -->
        <span v-else class="as-team-empty">ยังไม่ได้ตั้งทีม — ตอนนี้ยังไม่มีใครบุกเราได้</span>
      </span>
      <button class="as-pick" :class="{ hot: !team.length }" @click="$emit('pick')">
        <Emoji char="🛡️" /> จัดทีม
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from '../shared/Emoji.vue'
import PetThumb from '../shared/PetThumb.vue'
import { PVP_DAILY_ATTACKS } from '../../utils/pvpRating.js'
import { currentSeasonId } from '../../utils/pvpSeason.js'

const props = defineProps({
  rating: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  attacksLeft: { type: Number, default: 0 },
  myRank: { type: Number, default: null },
  total: { type: Number, default: 0 },
  team: { type: Array, default: () => [] },   // หน่วยรบจาก resolveBattleTeam
})
defineEmits(['pick'])

const max = PVP_DAILY_ATTACKS

const rankLabel = computed(() =>
  props.myRank ? `อันดับ ${props.myRank} จาก ${props.total}` : 'ยังไม่ติดอันดับ')

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
// currentSeasonId() คืน 'YYYY-MM' — แปลงเป็นชื่อเดือนไทยย่อ
const seasonLabel = computed(() => {
  const id = currentSeasonId()
  return TH_MONTH[Number(id.slice(5, 7)) - 1] || id
})
</script>

<style scoped>
.as {
  position: relative;
  background: linear-gradient(160deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%);
  border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop);
  padding: 14px 16px; margin-bottom: 16px; color: #fff; overflow: hidden;
}
/* ลายจางแบบเดียวกับ .tower-arena — ให้พื้นไม่แบนจนดูเป็นกล่องสี */
.as::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M20 0l20 20-20 20L0 20z'/%3E%3C/g%3E%3C/svg%3E");
}
.as > * { position: relative; }

.as-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.as-score { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.as-num { font-size: 1.7rem; font-weight: 800; line-height: 1.1; }
.as-unit { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.75); }
.as-rank { font-size: .76rem; font-weight: 800; color: #fff; background: rgba(255,255,255,.18); border-radius: 999px; padding: 3px 10px; white-space: nowrap; flex-shrink: 0; }

.as-line2 { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.as-wl { font-size: .76rem; font-weight: 700; color: rgba(255,255,255,.8); }
.as-season { font-size: .7rem; font-weight: 700; color: rgba(255,255,255,.62); border: 1px solid rgba(255,255,255,.3); border-radius: 999px; padding: 1px 8px; }

.as-quota { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.as-dots { display: inline-flex; gap: 4px; }
.as-dot { width: 10px; height: 10px; border-radius: 50%; background: #fde68a; border: 1.5px solid rgba(0,0,0,.25); }
.as-dot.used { background: transparent; border-color: rgba(255,255,255,.45); }
.as-quota-txt { font-size: .74rem; font-weight: 700; color: rgba(255,255,255,.8); }

.as-sep { height: 1px; background: rgba(255,255,255,.22); margin: 12px 0 10px; }

.as-team { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.as-team-l { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.as-team-cap { font-size: .72rem; font-weight: 800; color: rgba(255,255,255,.7); }
.as-thumbs { display: flex; gap: 5px; }
.as-thumbs > * { width: 40px; flex-shrink: 0; }
.as-team-empty { font-size: .74rem; font-weight: 700; color: #fde68a; line-height: 1.45; }

.as-pick { border: 2px solid var(--ink); background: #fff; color: var(--ink); border-radius: 11px; padding: 9px 13px; font-family: inherit; font-weight: 800; font-size: .78rem; cursor: pointer; box-shadow: var(--pop); display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
.as-pick:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.as-pick.hot { background: #fde68a; }
</style>
