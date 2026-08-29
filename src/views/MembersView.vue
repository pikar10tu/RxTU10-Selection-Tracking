<template>
  <div class="tab-content">
    <div class="mv-head">
      <div class="mv-title"><Emoji char="👥" /> สมาชิก</div>
      <div class="mv-head-r">
        <span class="mv-count">{{ registeredCount }}/{{ roster.length }} เข้าระบบแล้ว</span>
        <button class="mv-refresh" :disabled="members.rosterLoading" title="โหลดข้อมูลล่าสุด" @click="refresh">↻</button>
      </div>
    </div>

    <div v-if="members.rosterMissing" class="mv-empty-roster">
      ยังไม่มีข้อมูลรายชื่อ — ให้แอดมินกด "🔄 สร้าง roster ใหม่" ในหน้า Admin หนึ่งครั้ง
    </div>

    <input v-model="search" class="mv-search" type="text" placeholder="🔍 ค้นหาชื่อเล่น / ชื่อจริง / รหัส…" />

    <div class="mv-filters">
      <button v-for="f in FILTERS" :key="f.key" class="mv-filter" :class="{ on: track === f.key }" @click="track = f.key">
        {{ f.label }}
      </button>
    </div>

    <button
      v-if="approvedGuests.length"
      class="mv-guest-toggle" :class="{ on: showGuests }"
      @click="showGuests = !showGuests"
    >
      <Emoji char="👤" /> {{ showGuests ? '← กลับไปดูนักศึกษา' : `ผู้เยี่ยมชม (${approvedGuests.length})` }}
    </button>

    <div class="mv-sort">
      <label class="mv-sort-label" for="mv-sort-sel">เรียงตาม</label>
      <select id="mv-sort-sel" v-model="sortKey" class="mv-sort-sel">
        <option value="studentId">รหัสนักศึกษา</option>
        <option value="nickname">ชื่อเล่น</option>
        <option value="level">เลเวลบ้าน</option>
      </select>
    </div>

    <div v-if="members.loading" class="mv-empty">กำลังโหลด…</div>
    <div v-else-if="!list.length" class="mv-empty">ไม่พบสมาชิก</div>

    <div v-else class="mv-grid">
      <button
        v-for="m in list" :key="m.uid"
        class="mv-card" :class="{ off: !m.registered }"
        @click="m.registered && (selected = m)"
      >
        <div class="mv-av-wrap" :style="{ '--ring': trackColor(m.track) }">
          <img class="mv-avatar" :src="avatarOf(m)" :alt="m.nickname" loading="lazy" referrerpolicy="no-referrer" @error="(e) => fallbackAvatar(e, m.nickname)" />
          <span v-if="m.registered" class="mv-lv" :style="{ background: tierColor(m) }">{{ m.residence?.level || 1 }}</span>
        </div>
        <div class="mv-nick">{{ m.nickname }}</div>
        <div v-if="m.uid === myUid" class="mv-you">คุณ</div>
        <div class="mv-track" :style="{ color: trackColor(m.track) }">{{ trackLabel(m.track) }}</div>
        <div v-if="m.studentId" class="mv-sid">{{ m.studentId }}</div>
        <div v-if="!m.registered" class="mv-off-tag">ยังไม่เข้าระบบ</div>
      </button>
    </div>

    <ProfileModal :member="selected" @close="selected = null" />
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { ref, computed, onMounted } from 'vue'
import { useMembersStore } from '../stores/members.js'
import { useRosterSync } from '../composables/useRosterSync.js'
import { useAuthStore } from '../stores/auth.js'
import { getTier } from '../data/residence.js'
import { avatarUrl, fallbackAvatar } from '../utils/avatar.js'
import { sortMembers } from '../utils/sortMembers.js'
import ProfileModal from '../components/members/ProfileModal.vue'

const members = useMembersStore()
const { syncRosterRow } = useRosterSync()
const auth = useAuthStore()
const myUid = computed(() => auth.currentUser?.uid)
const search = ref('')
const track = ref('all')
const selected = ref(null)
const sortKey = ref('studentId')

// โหลด roster แล้วซ่อมแถวตัวเองถ้ายังไม่มี/เพี้ยน — ปิดช่องว่างของคนที่เพิ่งผูกตัวตนเสร็จ
// (syncRosterRow เขียนเฉพาะตอนค่าต่างจริง จึงไม่ใช่ write เพิ่มในกรณีปกติ)
onMounted(async () => { await members.loadRoster(); syncRosterRow() })
// ↻ บังคับโหลดสด (roster อาจ stale ถ้าเพื่อนเพิ่งทำคะแนน) — ยังเป็น 1 read
const refresh = () => members.loadRoster({ force: true })

// merge the full static roster (83) with logged-in user data (by studentId)
const roster = computed(() => {
  const fb = members.rosterUsers || {}
  return (members.students || []).map(s => {
    const u = fb[s.id]
    // realName มาจากรายชื่อ static เสมอ (ไม่ได้เก็บใน roster — ประหยัดและไม่มีวันเพี้ยน)
    if (u) return { ...u, realName: s.realName, registered: true }
    return {
      uid: 'static_' + s.id, studentId: s.id,
      nickname: s.nickname, realName: s.realName, track: s.track,
      residence: { level: 1 }, pets: [], registered: false,
    }
  })
})

// guest ที่อนุมัติแล้วเท่านั้น (pending/rejected ไม่โชว์ให้สมาชิก)
const approvedGuests = computed(() =>
  (members.rosterGuests || []).filter(g => g.guestStatus === 'approved').map(g => ({ ...g, registered: true })))

const showGuests = ref(false)

const registeredCount = computed(() => roster.value.filter(m => m.registered).length)

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'sci', label: 'Sci' },
  { key: 'care', label: 'Care' },
]

const list = computed(() => {
  const q = search.value.trim().toLowerCase()
  let r = showGuests.value ? approvedGuests.value : roster.value
  if (!showGuests.value && track.value !== 'all') r = r.filter(m => m.track === track.value)
  if (q) r = r.filter(m => [m.nickname, m.realName, m.studentId].some(v => (v || '').toLowerCase().includes(q)))
  return sortMembers(r, sortKey.value, myUid.value)
})

const TRACK = { sci: ['Sci', '#22c55e'], care: ['Care', '#3b82f6'], guest: ['Guest', '#9ca3af'] }
const trackLabel = (t) => TRACK[t]?.[0] || 'สมาชิก'
const trackColor = (t) => TRACK[t]?.[1] || '#6366f1'
const tierColor = (m) => getTier(m.residence?.level || 1).frameColor
const avatarOf = (m) => avatarUrl(m, m.nickname)
</script>

<style scoped>
.mv-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.mv-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.mv-head-r { display: flex; align-items: center; gap: 8px; }
.mv-count { font-size: .7rem; color: rgba(0,0,0,.45); font-weight: 600; }
.mv-refresh {
  border: 2px solid var(--ink); background: #fff; border-radius: 999px;
  width: 28px; height: 28px; font-size: .9rem; line-height: 1; color: var(--ink);
  cursor: pointer; flex-shrink: 0; padding: 0;
}
.mv-refresh:active { transform: translate(1px,1px); }
.mv-refresh:disabled { opacity: .4; cursor: default; }
.mv-empty-roster { font-size: .78rem; line-height: 1.5; color: #92400e; background: #fffbeb;
  border: 1px solid #fde68a; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; }
.mv-search {
  width: 100%; box-sizing: border-box; padding: 10px 14px;
  border: 2px solid var(--ink); border-radius: 12px;
  font-family: inherit; font-size: .82rem; margin-bottom: 10px; background: #fff;
}
.mv-search:focus { outline: none; box-shadow: var(--pop); }
.mv-filters { display: flex; gap: 6px; margin-bottom: 14px; }
.mv-filter {
  border: 2px solid var(--ink); background: #fff; border-radius: 999px;
  padding: 6px 14px; font-family: inherit; font-size: .74rem; font-weight: 700;
  color: var(--ink); cursor: pointer; transition: .12s;
}
.mv-filter.on { background: var(--primary); color: #fff; border-color: var(--ink); }
.mv-guest-toggle { width:100%; margin:0 0 12px; border:2px solid var(--ink); border-radius:12px; padding:9px; background:#fff; font-family:inherit; font-size:.82rem; font-weight:700; color:var(--ink); box-shadow:var(--pop); cursor:pointer; }
.mv-guest-toggle.on { background:#eef2ff; }
.mv-guest-toggle:active { transform:translate(2px,2px); box-shadow:0 0 0 var(--ink); }
.mv-sort { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.mv-sort-label { font-size: .7rem; font-weight: 700; color: rgba(0,0,0,.5); }
.mv-sort-sel { border: 2px solid var(--ink); border-radius: 10px; padding: 5px 10px; font-family: inherit; font-size: .74rem; font-weight: 700; background: #fff; color: var(--ink); }
.mv-empty { text-align: center; color: rgba(0,0,0,.4); padding: 28px 0; font-size: .85rem; }
.mv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.mv-card {
  background: #fff; border: 2px solid var(--ink); border-radius: 16px;
  padding: 14px 8px 10px; display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0;
  cursor: pointer; font-family: inherit; box-shadow: var(--pop);
  transition: transform .12s, box-shadow .12s;
}
.mv-card:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.mv-card.off { opacity: .5; cursor: default; box-shadow: none; border-style: dashed; }
.mv-card.off:active { transform: none; box-shadow: none; }
.mv-av-wrap { position: relative; }
.mv-avatar {
  width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #eee;
  border: 3px solid var(--ring, #ddd); box-sizing: border-box;
}
.mv-lv {
  position: absolute; right: -3px; bottom: -3px;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  color: #fff; font-size: .7rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #fff;
}
.mv-nick {
  font-size: .8rem; font-weight: 700; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.mv-you { font-size: .7rem; font-weight: 800; color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 7px; }
.mv-track { font-size: .7rem; font-weight: 700; }
.mv-sid { font-size: .7rem; color: rgba(0,0,0,.5); font-variant-numeric: tabular-nums; }
.mv-off-tag { font-size: .7rem; color: rgba(0,0,0,.35); }
</style>
