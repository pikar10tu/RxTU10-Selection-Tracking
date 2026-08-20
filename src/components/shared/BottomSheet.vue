<!--
  <BottomSheet> — แผงสไลด์ขึ้นจากล่าง (รียูสแพทเทิร์นจาก HelpModal)
  ใช้: <BottomSheet :open="x" @update:open="x=$event" icon="📬" title="กล่องจดหมาย">
         <template #actions> ...ปุ่มเสริมบนหัว... </template>
         ...เนื้อหา...
       </BottomSheet>
  ปิดเมื่อคลิกพื้นหลังหรือปุ่ม ✕
-->
<template>
  <!-- Teleport ไป body: #main-content เป็น position:fixed = สร้าง stacking context
       ทำให้ sheet (z400) ที่ render ข้างในสู้ #bottom-nav (z200) ที่ root ไม่ได้ → nav ทับก้น sheet
       ย้ายมาระดับ root (เหมือน Farm modal/ConfirmModal) z-index จึงมีผลจริง -->
  <Teleport to="body">
    <div v-if="open" class="sheet-ov" @click.self="close">
      <div class="sheet-box">
        <div class="sheet-head">
          <span class="sheet-title"><Emoji :char="icon" /> {{ title }}</span>
          <span class="sheet-actions"><slot name="actions" /></span>
          <button class="sheet-x" aria-label="ปิด" @click="close">✕</button>
        </div>
        <div class="sheet-scroll">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import Emoji from './Emoji.vue'
import { useEscapeKey } from '../../composables/useEscapeKey.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:open'])
function close() { emit('update:open', false) }
useEscapeKey(() => props.open, close)
</script>

<style scoped>
.sheet-ov { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
.sheet-box { background: #fff; width: 100%; max-width: 480px; max-height: 85dvh; border: 2px solid var(--ink); border-bottom: none; border-radius: 18px 18px 0 0; display: flex; flex-direction: column; animation: sheet-up .2s ease; }
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.sheet-head { display: flex; align-items: center; gap: 8px; padding: 16px; border-bottom: 1px solid rgba(0,0,0,.07); }
.sheet-title { font-family: var(--font-display); font-weight: 400; font-size: 1.25rem; color: var(--ink); margin-right: auto; }
.sheet-actions { display: flex; align-items: center; gap: 6px; }
.sheet-x { border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 40px; height: 40px; font-size: .9rem; cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.sheet-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px calc(22px + env(safe-area-inset-bottom, 0px)); }
</style>
