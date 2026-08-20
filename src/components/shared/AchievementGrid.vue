<template>
  <div class="ach-grid-wrap">
    <div class="ach-grid-head">ความสำเร็จ <span v-if="items.length" class="ach-count">{{ items.length }}</span></div>
    <div v-if="loading" class="ach-empty">กำลังโหลด…</div>
    <div v-else-if="!items.length" class="ach-empty">ยังไม่มีความสำเร็จ — เริ่มเล่นเพื่อปลดล็อก!</div>
    <div v-else class="ach-grid">
      <button v-for="a in items" :key="a.docId" type="button" class="ach-item" :title="a.desc" @click="selected = a">
        <span class="ach-item-icon"><Emoji :char="a.icon" /></span>
        <span class="ach-item-title">{{ a.label }}</span>
      </button>
    </div>
    <AchievementDetailModal :item="selected" @close="selected = null" />
  </div>
</template>

<script setup>
import Emoji from './Emoji.vue'
import AchievementDetailModal from './AchievementDetailModal.vue'
import { ref, watch } from 'vue'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useUsageStore } from '../../stores/usage.js'
import { getAchievement } from '../../data/achievements.js'
import { achievementTitle as titleOf } from '../../utils/achievements.js'

const props = defineProps({ uid: { type: String, default: null } })
const usage = useUsageStore()
const items = ref([])
const loading = ref(false)
const selected = ref(null)

async function load(uid) {
  if (!uid) { items.value = []; return }
  loading.value = true
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'achievements'), orderBy('earnedAt', 'desc')))
    usage.track(snap.size)
    items.value = snap.docs.map(d => {
      const data = d.data()
      const def = getAchievement(data.achId) || { title: data.achId, icon: '🏅', desc: '', flavor: '' }
      return {
        docId: d.id, icon: def.icon, desc: def.desc, flavor: def.flavor || '',
        earnedAt: data.earnedAt || null, label: titleOf(def, data.date || null),
      }
    })
  } catch (e) { console.error('[achievement grid]', e) }
  finally { loading.value = false }
}

watch(() => props.uid, load, { immediate: true })
</script>

<style scoped>
.ach-grid-wrap { margin-top: 14px; }
.ach-grid-head { font-size: .8rem; font-weight: 800; color: var(--ink); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.ach-count { font-size: .7rem; background: var(--primary); color: #fff; border-radius: 999px; padding: 1px 7px; }
.ach-empty { font-size: .72rem; color: rgba(0,0,0,.4); }
.ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
.ach-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px; border: 2px solid var(--ink); border-radius: 12px; background: #fff; box-shadow: var(--pop); text-align: center; font-family: inherit; cursor: pointer; transition: transform .1s, box-shadow .1s; }
.ach-item:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ach-item-icon { font-size: 1.5rem; }
.ach-item-title { font-size: .7rem; font-weight: 700; color: var(--ink); line-height: 1.2; }
</style>
