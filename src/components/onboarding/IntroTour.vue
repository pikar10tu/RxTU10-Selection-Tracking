<!-- src/components/onboarding/IntroTour.vue — ทัวร์ 3 จอครั้งแรกที่เข้าแอพ
     mount ระดับ root ใน App.vue (sibling ของ #bottom-nav) → ไม่ต้อง Teleport -->
<template>
  <div v-if="show" class="it-ov">
    <div class="it-box">
      <div class="it-dots">
        <span v-for="n in 3" :key="n" class="it-dot" :class="{ on: n === step }"></span>
      </div>

      <template v-if="step === 1">
        <div class="it-ico"><Emoji char="📚" /></div>
        <div class="it-title">แอพเตรียมสอบของรุ่นเรา</div>
        <p class="it-body">ทบทวนแฟลชการ์ดกับทำข้อสอบเก็บไว้ที่นี่ที่เดียว — ทำแล้วได้เหรียญติดตัวด้วย</p>
      </template>

      <template v-else-if="step === 2">
        <div class="it-ico"><Emoji char="🪙" /></div>
        <div class="it-title">เหรียญเอาไปทำอะไร</div>
        <p class="it-body">อัปบ้านให้รายได้ต่อวันเพิ่มขึ้น · อัญเชิญเพ็ทมาลงสนามต่อสู้ · ปลูกฟาร์มเก็บขาย</p>
        <p class="it-body it-body-dim">ไม่ต้องรีบเล่นครบทุกอย่าง ค่อยๆ เปิดดูได้</p>
      </template>

      <template v-else>
        <div class="it-ico"><Emoji char="🚀" /></div>
        <div class="it-title">เริ่มที่การทบทวนก่อน</div>
        <p class="it-body">สงสัยอะไรกดปุ่ม ℹ️ ที่มุมของแต่ละหน้าได้เลย มีคำอธิบายให้ทุกหน้า</p>
      </template>

      <button class="it-btn" @click="next">{{ step < 3 ? 'ต่อไป →' : 'ไปทบทวนเลย' }}</button>
      <button class="it-skip" @click="finish(false)">ข้ามไปก่อน</button>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()

const step = ref(1)
const dismissed = ref(false)
const show = computed(() => !dismissed.value && auth.isLoggedIn && !auth.userData?.seenIntro)

function next() {
  if (step.value < 3) { step.value += 1; return }
  finish(true)
}

// ปิดทัวร์ + ประทับ flag (ไม่ toast — ผู้ใช้ไม่ได้ขออะไร) · goStudy=true เฉพาะตอนกดจบจอสุดท้าย
async function finish(goStudy) {
  dismissed.value = true
  await auth.patchUser({ seenIntro: true }, { seenIntro: true })
  if (goStudy) router.push('/study')
}
</script>

<style scoped>
.it-ov { position: fixed; inset: 0; z-index: 330; background: linear-gradient(160deg,#eef2ff,#fff); display: flex; align-items: center; justify-content: center; padding: 18px; }
.it-box { background: #fff; width: 100%; max-width: 400px; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); padding: 24px 22px; text-align: center; }
.it-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 16px; }
.it-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.15); }
.it-dot.on { background: #4f46e5; }
.it-ico { font-size: 2.6rem; margin-bottom: 8px; }
.it-title { font-family: var(--font-display); font-weight: 400; font-size: 1.3rem; color: var(--ink); margin-bottom: 10px; }
.it-body { font-size: .84rem; color: rgba(0,0,0,.65); line-height: 1.6; margin: 0 0 10px; }
.it-body-dim { font-size: .76rem; color: rgba(0,0,0,.45); }
.it-btn { width: 100%; border: 2px solid var(--ink); border-radius: 12px; padding: 13px; margin-top: 6px; font-family: inherit; font-size: .92rem; font-weight: 800; color: #fff; background: var(--gold); box-shadow: var(--pop); cursor: pointer; transition: transform .12s, box-shadow .12s; }
.it-btn:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.it-skip { background: none; border: none; color: var(--muted); font-size: .78rem; margin-top: 10px; padding: 8px; cursor: pointer; }
</style>
