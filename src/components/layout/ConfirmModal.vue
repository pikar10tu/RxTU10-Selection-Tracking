<template>
  <div class="modal-ov" :class="{ active: visible }" style="overscroll-behavior:contain"
    @click.self="cancel">
    <div class="modal-box" style="max-width:300px;text-align:center"
      role="dialog" aria-modal="true" aria-label="ยืนยันการทำรายการ">
      <div style="font-size:1.3rem;margin-bottom:8px" aria-hidden="true"><Emoji char="🤔" /></div>
      <div style="font-weight:700;font-size:1rem;margin-bottom:18px" v-html="msgHtml"></div>
      <div style="display:flex;gap:8px">
        <button ref="okBtn" class="btn-gold" style="flex:1" @click="ok">ยืนยัน</button>
        <button class="btn-gray" style="flex:1" @click="cancel">ยกเลิก</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed, ref, watch, nextTick } from 'vue'
import { useConfirm } from '../../composables/useConfirm.js'
import { emojifyHtml } from '../../utils/emoji.js'
import { useEscapeKey } from '../../composables/useEscapeKey.js'
const { visible, message, ok, cancel } = useConfirm()
useEscapeKey(visible, cancel)   // เดิมใช้ @keydown.esc ซึ่งทำงานเฉพาะตอนมีโฟกัสในกล่อง

// focus management: ย้าย focus เข้าปุ่มยืนยันตอนเปิด, คืน focus ให้ element เดิมตอนปิด
const okBtn = ref(null)
let lastFocused = null
watch(visible, (v) => {
  if (v) {
    lastFocused = document.activeElement
    nextTick(() => okBtn.value?.focus())
  } else if (lastFocused?.focus) {
    lastFocused.focus()
    lastFocused = null
  }
})
const msgHtml = computed(() =>
    message.value.split('\n')
        .map(l => `<div>${emojifyHtml(l, import.meta.env.BASE_URL)}</div>`)
        .join('')
)
</script>
