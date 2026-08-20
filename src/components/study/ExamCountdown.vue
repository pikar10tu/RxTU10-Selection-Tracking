<template>
  <div v-if="next" class="ec-wrap">
    <div class="ec-card">
      <span class="ec-emoji"><Emoji :char="next.emoji || '🎯'" /></span>
      <div class="ec-body">
        <div class="ec-label">{{ next.label }}</div>
        <div class="ec-date">{{ fmtRange(next) }}</div>
      </div>
      <div class="ec-count">
        <template v-if="next.days > 0"><b>{{ next.days }}</b><small>เหลือ (วัน)</small></template>
        <b v-else class="ec-today">วันนี้!</b>
      </div>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { EXAMS } from '../../data/exams.js'
import { upcomingExams } from '../../utils/countdown.js'

// อัปเดตทุก 1 นาที เผื่อเปิดค้างข้ามเที่ยงคืน (ตัวเลขวันจะ refresh)
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60000) })
onUnmounted(() => clearInterval(timer))

// โชว์ bubble เดียว = วันสอบที่ใกล้ที่สุด (CC1/CC2 ติดกัน → รวบเหลืออันใกล้สุด)
const next = computed(() => upcomingExams(EXAMS, now.value)[0])

function fmtDate(iso) {
  // th-TH-u-ca-gregory = เดือนภาษาไทย แต่ปีเป็น ค.ศ. (ไม่ใช่ พ.ศ.)
  return new Date(iso).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' })
}

// สอบหลายวัน (มี dateEnd) → "12–13 ธันวาคม 2026" (ยุบเดือน/ปีถ้าเดือนเดียวกัน) · ไม่มี dateEnd → วันเดียว
function fmtRange(e) {
  if (!e.dateEnd) return fmtDate(e.date)
  const s = new Date(e.date), en = new Date(e.dateEnd)
  if (s.getMonth() === en.getMonth() && s.getFullYear() === en.getFullYear()) {
    return `${s.toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric' })}–${fmtDate(e.dateEnd)}`
  }
  return `${fmtDate(e.date)} – ${fmtDate(e.dateEnd)}`
}
</script>

<style scoped>
.ec-wrap { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.ec-card { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, var(--primary), #6366f1); color: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 12px 14px; }
.ec-emoji { font-size: 1.6rem; flex-shrink: 0; }
.ec-body { flex: 1; min-width: 0; }
.ec-label { font-weight: 800; font-size: .9rem; }
.ec-date { font-size: .7rem; opacity: .85; margin-top: 2px; }
.ec-count { text-align: center; flex-shrink: 0; line-height: 1; min-width: 52px; }
.ec-count b { font-size: 1.8rem; font-weight: 800; font-family: var(--font-display); font-variant-numeric: tabular-nums; }
.ec-count small { display: block; font-size: .7rem; opacity: .85; margin-top: 3px; }
.ec-today { font-size: 1.15rem; }
</style>
