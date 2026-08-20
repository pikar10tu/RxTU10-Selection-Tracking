<template>
  <!-- ซ่อนทั้งแถบถ้าไม่มีข่าว (และโหลดเสร็จแล้ว) -->
  <div v-if="loading || items.length" class="news">
    <!-- collapsed: บรรทัดล่าสุด · กดเพื่อกาง log -->
    <button class="news-latest" :aria-expanded="open" @click="open = !open">
      <span class="news-icon"><Emoji char="📢" /></span>
      <span class="news-latest-msg">
        <template v-if="loading">กำลังโหลดข่าว…</template>
        <template v-else-if="open">กระดานข่าว</template>
        <template v-else>{{ items[0].msg }}</template>
      </span>
      <span class="news-chevron" :class="{ open }" aria-hidden="true">▾</span>
    </button>

    <!-- expanded: log เต็มพร้อมเวลา (accordion กางในหน้า) -->
    <ul v-if="open && items.length" class="news-list">
      <li v-for="n in items" :key="n.id" class="news-item">
        <span class="news-icon"><Emoji :char="n.icon || '📢'" /></span>
        <div class="news-body">
          <div class="news-msg">{{ n.msg }}</div>
          <div class="news-time">{{ fmt(n.ts) }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, onMounted } from 'vue'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useUsageStore } from '../../stores/usage.js'

const usage = useUsageStore()
const items = ref([])
const loading = ref(true)
const open = ref(false)   // collapsed by default — กดบรรทัดล่าสุดเพื่อกาง log

onMounted(async () => {
  try {
    const snap = await getDocs(query(collection(db, 'news'), orderBy('ts', 'desc'), limit(10)))
    usage.track(snap.size)
    items.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('[news]', e)
  } finally {
    loading.value = false
  }
})

function fmt(ts) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : ''
}
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
</style>
