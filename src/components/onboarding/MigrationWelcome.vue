<template>
  <div v-if="show" class="mw-ov">
    <div class="mw-box">
      <div class="mw-confetti"><Emoji char="🎉" /></div>
      <div class="mw-title">อัปเดตใหม่!</div>
      <div class="mw-sub">RxTU10 ปรับระบบครั้งใหญ่ — นี่คือสิ่งที่เปลี่ยนไปสำหรับคุณ</div>

      <div class="mw-list">
        <div class="mw-item">
          <span class="mw-emoji"><Emoji :char="tier.art" /></span>
          <div>
            <b>ที่อยู่อาศัยของคุณ: {{ tier.tierName }} (Lv.{{ level }})</b>
            <div class="mw-note">ความมั่งคั่งเดิมของคุณถูกแปลงเป็นเลเวลที่อยู่อาศัยแล้ว — ยิ่งอัปสูง รายได้ต่อวันยิ่งเยอะ</div>
          </div>
        </div>
        <div v-if="isFounder" class="mw-item">
          <span class="mw-emoji"><Emoji char="🏅" /></span>
          <div>
            <b>ป้าย "ผู้บุกเบิก"</b>
            <div class="mw-note">มอบให้เฉพาะคนที่อยู่กับเราตั้งแต่วันแรก — หาไม่ได้อีกแล้ว</div>
          </div>
        </div>
        <div class="mw-item">
          <span class="mw-emoji"><Emoji char="🐾" /></span>
          <div>
            <b>สัตว์เลี้ยงปลอดภัยทุกตัว</b>
            <div class="mw-note">สัตว์เลี้ยงทุกตัวเก็บได้หมด ตัวซ้ำใช้อัปเกรด</div>
          </div>
        </div>
        <div class="mw-item">
          <span class="mw-emoji"><Emoji char="💰" /></span>
          <div>
            <b>ระบบรายได้ใหม่</b>
            <div class="mw-note">รับรายได้รายวันจากบ้าน + สัตว์เลี้ยง · เหรียญเป็นข้อมูลส่วนตัวแล้ว</div>
          </div>
        </div>
      </div>

      <button class="mw-btn primary" @click="dismiss()">เริ่มเล่นเลย!</button>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useAuthStore } from '../../stores/auth.js'
import { getTier } from '../../data/residence.js'

const auth = useAuthStore()

const dismissed = ref(false)
const show = computed(() =>
  !dismissed.value &&
  auth.userData?.migratedV2 === true &&
  !auth.userData?.seenV2Notice
)

const level     = computed(() => auth.userData?.residence?.level || 1)
const tier      = computed(() => getTier(level.value))
const isFounder = computed(() => auth.userData?.founder === true)

async function dismiss() {
  dismissed.value = true
  // persist the once-flag so it never shows again
  if (auth.currentUser) {
    auth.setUserDataOptimistic({ seenV2Notice: true })
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { seenV2Notice: true })
    } catch (e) {
      console.error('[migration welcome]', e)
    }
  }
}
</script>

<style scoped>
.mw-ov {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 0, 0, .55);
  display: flex; align-items: center; justify-content: center; padding: 18px;
}
.mw-box {
  background: #fff; width: 100%; max-width: 380px;
  border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg);
  padding: 22px; text-align: center;
  max-height: 88vh; overflow-y: auto;
}
.mw-confetti { font-size: 2.4rem; }
.mw-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; color: var(--ink); margin-top: 4px; }
.mw-sub { font-size: .76rem; color: rgba(0,0,0,.5); margin: 4px 0 16px; }
.mw-list { display: flex; flex-direction: column; gap: 12px; text-align: left; margin-bottom: 18px; }
.mw-item { display: flex; gap: 10px; align-items: flex-start; }
.mw-emoji { font-size: 1.5rem; flex-shrink: 0; }
.mw-item b { font-size: .84rem; }
.mw-note { font-size: .7rem; color: rgba(0,0,0,.5); line-height: 1.45; margin-top: 2px; }
.mw-btn {
  width: 100%; border: 2px solid var(--ink); border-radius: 12px; padding: 12px;
  font-family: inherit; font-size: .88rem; font-weight: 800; cursor: pointer;
  box-shadow: var(--pop); transition: transform .12s, box-shadow .12s;
}
.mw-btn.primary { background: var(--gold); color: #fff; }
.mw-btn:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
</style>
