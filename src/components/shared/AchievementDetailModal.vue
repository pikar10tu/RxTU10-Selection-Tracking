<!-- popup รายละเอียด achievement — mirror PetStatPopup (fixed overlay, ไม่ต้อง Teleport) -->
<template>
  <div v-if="item" class="ad-ov" @click.self="$emit('close')">
    <div class="ad-box">
      <button class="ad-x" aria-label="ปิด" @click="$emit('close')">✕</button>
      <div class="ad-icon"><Emoji :char="item.icon" /></div>
      <div class="ad-title">{{ item.label }}</div>
      <div v-if="item.flavor" class="ad-flavor">&#8220;{{ item.flavor }}&#8221;</div>
      <div class="ad-rows">
        <div class="ad-row">
          <span class="ad-row-k">เงื่อนไข</span>
          <span class="ad-row-v">{{ item.desc || '—' }}</span>
        </div>
        <div v-if="fmtDate(item.earnedAt)" class="ad-row">
          <span class="ad-row-k">ปลดล็อกเมื่อ</span>
          <span class="ad-row-v">{{ fmtDate(item.earnedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Emoji from './Emoji.vue'
defineProps({ item: { type: Object, default: null } })
defineEmits(['close'])

// รองรับ Firestore Timestamp / Date / ms · คืน '' ถ้าพัง (ซ่อนแถววันที่)
function fmtDate(ts) {
  if (!ts) return ''
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime())
  if (!ms || Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.ad-ov { position: fixed; inset: 0; z-index: 260; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.ad-box { position: relative; background: #fff; width: 100%; max-width: 320px; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); padding: 24px 18px 18px; text-align: center; max-height: 88vh; overflow-y: auto; }
.ad-x { position: absolute; left: 10px; top: 10px; border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ad-icon { font-size: 3.2rem; line-height: 1; }
.ad-title { font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; color: var(--ink); margin-top: 8px; }
.ad-flavor { font-size: .8rem; color: #6366f1; font-style: italic; margin-top: 6px; line-height: 1.4; }
.ad-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; text-align: left; }
.ad-row { background: #f8fafc; border: 1px solid rgba(0,0,0,.05); border-radius: 10px; padding: 8px 11px; }
.ad-row-k { display: block; font-size: .7rem; font-weight: 700; color: #64748b; }
.ad-row-v { font-size: .82rem; color: #1e293b; line-height: 1.35; }
</style>
