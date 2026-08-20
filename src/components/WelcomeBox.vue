<template>
  <Teleport to="body">
    <div v-if="show" class="wb-ov" @click.self="close">
      <div class="wb-box">
        <div class="wb-emoji"><Emoji char="🎉" /></div>
        <div class="wb-title">ยินดีต้อนรับสู่ RxTU10!</div>
        <div class="wb-sub">รับของขวัญต้อนรับของคุณได้เลย</div>
        <div class="wb-gifts">
          <div class="wb-gift"><Emoji char="🪙" /> {{ WELCOME_GIFT_COINS.toLocaleString() }} เหรียญ</div>
          <div class="wb-gift"><Emoji char="🎟️" /> ตั๋วอัญเชิญ {{ WELCOME_GIFT_TICKETS }} ใบ</div>
        </div>
        <div class="wb-hint">เปิด <b>กล่องจดหมาย</b> ที่หน้าหลักเพื่อกดรับ</div>
        <button class="wb-btn" @click="close">เริ่มเล่นเลย</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import Emoji from './shared/Emoji.vue'
import { useAuthStore } from '../stores/auth.js'
import { WELCOME_GIFT_COINS, WELCOME_GIFT_TICKETS } from '../data/userSchema.js'
import { useEscapeKey } from '../composables/useEscapeKey.js'

const auth = useAuthStore()
const show = computed(() => !!auth.userData?.welcomeGiftV1 && !auth.userData?.welcomeBoxSeen)

async function close() {
  await auth.patchUser({ welcomeBoxSeen: true }, { welcomeBoxSeen: true })
}
useEscapeKey(show, close)
</script>

<style scoped>
.wb-ov { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.wb-box { background: #fff; border: 2px solid var(--ink); border-radius: 20px; padding: 24px 20px; box-shadow: var(--pop); max-width: 320px; width: 100%; text-align: center; max-height: 88vh; overflow-y: auto; }
.wb-emoji { font-size: 3rem; }
.wb-title { font-size: 1.25rem; font-weight: 800; color: var(--ink); margin-top: 6px; }
.wb-sub { font-size: .82rem; color: rgba(0,0,0,.55); margin-top: 4px; }
.wb-gifts { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
.wb-gift { border: 2px dashed var(--ink); border-radius: 12px; padding: 10px; font-weight: 800; font-size: .95rem; background: var(--primary-light); }
.wb-hint { font-size: .74rem; color: rgba(0,0,0,.55); line-height: 1.5; margin-bottom: 14px; }
.wb-btn { width: 100%; border: 2px solid var(--ink); border-radius: 12px; padding: 11px; font-family: inherit; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; }
</style>
