<template>
  <!-- ซ่อนทั้งแถบถ้าไม่มีข่าว (และโหลดเสร็จแล้ว) -->
  <div v-if="loading || items.length" class="news">
    <!-- collapsed: บรรทัดเดียวสลับข่าวเองทุก 3.5 วิ · กดเพื่อกาง log -->
    <button class="news-latest" :aria-expanded="open" @click="open = !open">
      <span class="news-icon"><Emoji :char="open || !current ? '📢' : current.icon" /></span>
      <span class="news-latest-msg">
        <template v-if="loading">กำลังโหลดข่าว…</template>
        <template v-else-if="open">กระดานข่าว</template>
        <span v-else :key="current.id" class="news-tick">{{ current.text }}</span>
      </span>
      <span class="news-chevron" :class="{ open }" aria-hidden="true">▾</span>
    </button>

    <!-- expanded: log เต็มพร้อมเวลา (accordion กางในหน้า) -->
    <ul v-if="open && items.length" class="news-list">
      <li v-for="n in items" :key="n.id" class="news-item">
        <span class="news-icon"><Emoji :char="n.icon" /></span>
        <div class="news-body">
          <div class="news-msg">{{ n.text }}</div>
          <div class="news-time">{{ timeAgo(n.t, now) }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
/**
 * กระดานข่าวหน้า Home — รวม 2 เลน (ดู utils/newsFeed.js)
 *   เลน roster: ข่าวไหลเร็วจาก rows.<uid>.ev — roster เป็น 1 read ที่จออื่นได้ใช้ต่อทั้งเซสชัน
 *   เลน news:   ข่าว "ครั้งแรก/ที่หนึ่งของรุ่น" + ประกาศแอดมิน — เหลือ 5 doc (เดิม 10)
 * รวมแล้ว 6 read ต่อการเข้า Home (เดิม 10) ทั้งที่ข่าวเยอะกว่าเดิมหลายเท่า
 *
 * ⚠️ ใช้ {{ }} เท่านั้น ห้าม v-html — ข้อความในเลน news มาจากผู้เล่น (CLAUDE.md ข้อ 8)
 */
import Emoji from '../shared/Emoji.vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useUsageStore } from '../../stores/usage.js'
import { useMembersStore } from '../../stores/members.js'
import { useAuthStore } from '../../stores/auth.js'
import { buildFeed, timeAgo } from '../../utils/newsFeed.js'
import { prefersReducedMotion } from '../../utils/motionPref.js'

const usage = useUsageStore()
const members = useMembersStore()
const auth = useAuthStore()

const newsDocs = ref([])
const loading = ref(true)
const open = ref(false)     // collapsed by default — กดบรรทัดเพื่อกาง log
const idx = ref(0)          // บรรทัดที่โชว์อยู่ตอนพับ
const now = ref(Date.now()) // ให้ "x นาทีที่แล้ว" ขยับตามเวลาจริง

const items = computed(() => buildFeed(members.rosterRows || {}, newsDocs.value,
  { now: now.value, myUid: auth.currentUser?.uid || null }))

const current = computed(() => items.value[idx.value % (items.value.length || 1)] || null)

// ── ตัวสลับบรรทัด ──
// ใช้แค่ opacity/transform (ดู style) — ห้าม backdrop-filter/blur เด็ดขาด (iOS Safari paint)
let timer = null
const reduced = prefersReducedMotion()

function stop() { if (timer) { clearInterval(timer); timer = null } }
function start() {
  stop()
  // ไม่สลับเมื่อ: ผู้ใช้ปิดอนิเมชัน · กางกระดานอยู่ · แท็บไม่ได้อยู่หน้าจอ · มีข่าวเดียว
  if (reduced || open.value || document.hidden || items.value.length < 2) return
  timer = setInterval(() => {
    idx.value = (idx.value + 1) % items.value.length
    now.value = Date.now()
  }, 3500)
}

onMounted(async () => {
  document.addEventListener('visibilitychange', start)
  try {
    await members.loadRoster()
    const snap = await getDocs(query(collection(db, 'news'), orderBy('ts', 'desc'), limit(5)))
    usage.track(snap.size)
    newsDocs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('[news]', e)
  } finally {
    loading.value = false
    start()
  }
})

onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', start) })

watch(open, (v) => { if (v) { stop(); now.value = Date.now() } else start() })
</script>

<style scoped>
.news { background: #fff; border: 2px solid var(--ink); border-radius: 18px; padding: 10px 14px; margin-bottom: 14px; box-shadow: var(--pop); }
/* collapsed: บรรทัดล่าสุด (กดเพื่อกาง) */
.news-latest { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 10px; }
.news-latest-msg { flex: 1; min-width: 0; text-align: left; font-size: .8rem; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.news-chevron { flex-shrink: 0; color: rgba(0,0,0,.4); font-size: .9rem; transition: transform .2s; }
.news-chevron.open { transform: rotate(180deg); }
.news-list { list-style: none; margin: 10px 0 0; padding: 8px 0 0; border-top: 1px solid rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; overscroll-behavior: contain; }
.news-item { display: flex; gap: 10px; align-items: flex-start; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,.05); }
.news-item:last-child { border-bottom: none; padding-bottom: 0; }
.news-icon { font-size: 1.2rem; flex-shrink: 0; }
.news-body { flex: 1; min-width: 0; }
.news-msg { font-size: .8rem; color: rgba(0,0,0,.75); line-height: 1.4; word-break: break-word; }
.news-time { font-size: .7rem; color: rgba(0,0,0,.4); margin-top: 2px; }

/* สลับบรรทัดเอง — opacity/transform เท่านั้น ห้าม backdrop-filter/blur (iOS Safari paint) */
.news-tick { display: inline-block; animation: news-in .2s ease-out; }
@keyframes news-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
</style>
