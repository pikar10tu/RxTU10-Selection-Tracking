<template>
  <div v-if="section" class="help-ov" @click.self="closeHelp">
    <div class="help-box">
      <div class="help-head">
        <span><Emoji :char="section.icon" /> {{ section.title }}</span>
        <button class="help-x" aria-label="ปิด" @click="closeHelp">✕</button>
      </div>
      <div class="help-scroll">
        <span v-if="section.soon" class="help-soon">เร็วๆ นี้</span>
        <div class="help-body">
          <p v-for="(line, j) in section.body" :key="j">{{ line }}</p>
        </div>
        <table v-if="section.table === 'residence'" class="help-tbl">
          <thead><tr><th>Lv</th><th>ที่อยู่อาศัย</th><th>รายได้/วัน</th></tr></thead>
          <tbody>
            <tr v-for="t in residenceRows" :key="t.level" :class="{ masked: t.level > revealUpTo }">
              <td>{{ t.level }}</td>
              <template v-if="t.level <= revealUpTo">
                <td><Emoji :char="t.art" /> {{ t.tierName }}</td>
                <td>{{ t.dailyIncome.toLocaleString() }}</td>
              </template>
              <template v-else>
                <td><Emoji char="🔒" /> ลับ</td>
                <td>????</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed } from 'vue'
import { GUIDE } from '../../data/guide.js'
import { useHelp } from '../../composables/useHelp.js'
import { useAuthStore } from '../../stores/auth.js'
import { RESIDENCE_TIERS, MAX_RESIDENCE_LEVEL } from '../../data/residence.js'

const { helpTopic, closeHelp } = useHelp()
const auth = useAuthStore()
const section = computed(() => helpTopic.value ? GUIDE[helpTopic.value] : null)
const residenceRows = computed(() => RESIDENCE_TIERS.filter(t => t.level <= MAX_RESIDENCE_LEVEL))
// เปิดเผยแค่ถึงเลเวลถัดไปของผู้เล่น (กันสปอยบ้านสูงๆ) — ที่เหลือ mask เป็น ????
const myLevel = computed(() => auth.userData?.residence?.level || 1)
const revealUpTo = computed(() => Math.min(myLevel.value + 1, MAX_RESIDENCE_LEVEL))
</script>

<style scoped>
.help-ov { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
.help-box { background: #fff; width: 100%; max-width: 480px; max-height: 85dvh; border: 2px solid var(--ink); border-bottom: none; border-radius: 18px 18px 0 0; display: flex; flex-direction: column; animation: help-up .2s ease; }
@keyframes help-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.help-head { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid rgba(0,0,0,.07); }
.help-head span:first-child { font-family: var(--font-display); font-weight: 400; font-size: 1.25rem; color: var(--ink); }
.help-x { border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 40px; height: 40px; font-size: .9rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.help-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px calc(22px + env(safe-area-inset-bottom, 0px)); }
.help-soon { display: inline-block; font-size: .7rem; font-weight: 700; color: #b45309; background: rgba(251,191,36,.18); padding: 2px 7px; border-radius: 999px; margin-bottom: 8px; }
.help-body { margin: 0 0 12px; display: flex; flex-direction: column; gap: 10px; }
.help-body p { margin: 0; font-size: .82rem; color: rgba(0,0,0,.65); line-height: 1.6; }
.help-tbl { width: 100%; border-collapse: collapse; font-size: .72rem; }
.help-tbl th, .help-tbl td { border: 1px solid rgba(0,0,0,.1); padding: 5px 8px; text-align: left; }
.help-tbl th { background: rgba(0,0,0,.04); font-weight: 700; }
.help-tbl td:last-child, .help-tbl th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.help-tbl tr.masked td { color: rgba(0,0,0,.32); letter-spacing: .04em; }
</style>
