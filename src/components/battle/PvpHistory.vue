<!-- src/components/battle/PvpHistory.vue -->
<!-- ประวัติสนามประลอง 2 แท็บ — ค่าเริ่มต้นที่ "ตั้งรับ" (ของที่ไม่เคยเห็นมาก่อน น่าดูกว่า)
     อ่านจาก roster ที่โหลดอยู่แล้วทั้งหมด ⇒ ไม่มี read เพิ่ม
     ⚠️ ฝั่งตั้งรับห้ามโชว์เหรียญและห้ามให้รางวัล — ผู้บุกเป็นคนจดผลเอง (ดูสเปก) -->
<template>
  <div class="ph">
    <div class="ph-head">
      <span class="ph-title"><Emoji char="📜" /> ประวัติ</span>
      <div class="ph-tabs" role="tablist">
        <button class="ph-tab" :class="{ on: tab === 'def' }" role="tab" :aria-selected="tab === 'def'"
          @click="tab = 'def'">ตั้งรับ</button>
        <button class="ph-tab" :class="{ on: tab === 'atk' }" role="tab" :aria-selected="tab === 'atk'"
          @click="tab = 'atk'">เราไปบุก</button>
      </div>
    </div>

    <template v-if="tab === 'def'">
      <div v-if="!defense.length" class="ph-empty">ยังไม่มีใครมาบุกเลย — ทีมที่จัดไว้กำลังเฝ้าอยู่</div>
      <div v-for="(r, i) in defense" :key="'d' + i" class="ph-row">
        <span class="ph-who"><Emoji char="🛡️" /> {{ r.name }} บุกเรา</span>
        <span class="ph-res" :class="r.won ? 'ok' : 'no'">{{ r.won ? 'เรารอด' : 'เราแพ้' }}</span>
        <span class="ph-ago">{{ agoLabel(r.t, now) }}</span>
      </div>
    </template>

    <template v-else>
      <div v-if="!attacks.length" class="ph-empty">ยังไม่ได้ออกบุกใครเลย — เลือกสักคนจากกระดานด้านบน</div>
      <div v-for="(r, i) in attacks" :key="'a' + i" class="ph-row">
        <span class="ph-who"><Emoji char="⚔️" /> บุก {{ r.name }}</span>
        <span class="ph-res" :class="r.won ? 'ok' : 'no'">{{ r.won ? 'ชนะ' : 'แพ้' }}</span>
        <span v-if="r.coin" class="ph-coin">+{{ r.coin.toLocaleString() }}<Emoji char="🪙" /></span>
        <span class="ph-ago">{{ agoLabel(r.t, now) }}</span>
      </div>
    </template>

    <div class="ph-note">เก็บ 5 รายการล่าสุดของแต่ละคน · ทั้งรุ่นเห็นประวัติของกันและกันได้</div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useMembersStore } from '../../stores/members.js'
import { myAttacks, defenseLog, agoLabel } from '../../utils/pvpHistory.js'

const auth = useAuthStore()
const members = useMembersStore()

const tab = ref('def')
const now = Date.now()   // แช่ไว้ตอน mount — ป้ายเวลาไม่ต้องเดินสด (เลี่ยง re-render ทั้งลิสต์)

const uid = computed(() => auth.currentUser?.uid)
const attacks = computed(() => myAttacks(members.rosterRows || {}, uid.value))
const defense = computed(() => defenseLog(members.rosterRows || {}, uid.value))
</script>

<style scoped>
.ph { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; margin-top: 14px; }
.ph-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.ph-title { font-size: .88rem; font-weight: 800; }
.ph-tabs { display: flex; gap: 6px; }
.ph-tab { border: 2px solid var(--ink); background: #fff; border-radius: 999px; padding: 4px 12px; font-family: inherit; font-weight: 800; font-size: .72rem; cursor: pointer; }
.ph-tab.on { background: var(--primary); color: #fff; }
.ph-row { display: flex; align-items: center; gap: 6px; padding: 7px 0; border-top: 1px dashed rgba(0,0,0,.12); font-size: .76rem; }
.ph-who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.ph-res { font-weight: 800; flex-shrink: 0; }
.ph-res.ok { color: #15803d; }
.ph-res.no { color: #b91c1c; }
.ph-coin { font-weight: 800; color: #b45309; flex-shrink: 0; }
.ph-ago { color: rgba(0,0,0,.45); font-size: .7rem; flex-shrink: 0; }
.ph-empty { text-align: center; color: rgba(0,0,0,.45); font-size: .76rem; padding: 16px 8px; line-height: 1.6; }
.ph-note { margin-top: 10px; font-size: .7rem; color: rgba(0,0,0,.4); line-height: 1.5; }
</style>
