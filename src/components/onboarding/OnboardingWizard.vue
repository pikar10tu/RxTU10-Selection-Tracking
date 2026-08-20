<template>
  <div class="ow-ov">
    <div class="ow-box">
      <!-- แสดงอีเมลที่กำลังใช้เสมอ -->
      <div class="ow-email">
        <Emoji char="📧" /> เข้าสู่ระบบด้วย <b>{{ auth.currentUser?.email }}</b>
        <div class="ow-email-warn">ถ้านี่ไม่ใช่อีเมลที่ต้องการ <a href="#" @click.prevent="auth.logout()">ออกแล้วเข้าใหม่</a> ด้วยอีเมลที่ถูก</div>
      </div>

      <!-- ขั้น 1: เลือกประเภท -->
      <template v-if="step === 'type'">
        <div class="ow-title">ยินดีต้อนรับ! คุณคือใคร?</div>
        <button class="ow-choice" @click="goStudent">
          <span class="ow-choice-ico"><Emoji char="🎓" /></span>
          <span><b>ฉันเป็นนักศึกษาเภสัช มธ. รุ่น 10</b><small>ผูกด้วยรหัสนักศึกษา</small></span>
        </button>
        <button class="ow-choice" @click="step = 'guest'">
          <span class="ow-choice-ico"><Emoji char="👤" /></span>
          <span><b>ฉันเป็นผู้เยี่ยมชม</b><small>กรอกชื่อเล่น รอแอดมินอนุมัติ</small></span>
        </button>
      </template>

      <!-- ขั้น 2a: นักศึกษากรอกรหัส -->
      <template v-else-if="step === 'student'">
        <button class="ow-back" @click="resetStudent">‹ กลับ</button>
        <div class="ow-title">กรอกรหัสนักศึกษา</div>
        <input v-model="sid" class="ow-input" inputmode="numeric" placeholder="รหัสนักศึกษา" @keyup.enter="checkStudent" />
        <div v-if="sErr" class="ow-err"><Emoji char="⚠️" /> {{ sErr }}</div>

        <!-- การ์ดยืนยันตัวตน -->
        <div v-if="matched" class="ow-confirm">
          <div class="ow-confirm-h">นี่คือคุณใช่ไหม?</div>
          <div class="ow-confirm-nick">{{ matched.nickname }}</div>
          <div class="ow-confirm-sub">{{ matched.realName }} · {{ trackLabel(matched.track) }}</div>
          <div class="ow-confirm-mail"><Emoji char="📧" /> {{ auth.currentUser?.email }}</div>
        </div>

        <button v-if="!matched" class="ow-btn" :disabled="busy" @click="checkStudent">
          {{ busy ? 'กำลังตรวจ…' : 'ตรวจสอบรหัส' }}
        </button>
        <button v-else class="ow-btn" :disabled="busy" @click="confirmStudent">
          {{ busy ? 'กำลังบันทึก…' : 'ใช่ ยืนยัน →' }}
        </button>
      </template>

      <!-- ขั้น 2b: guest -->
      <template v-else-if="step === 'guest'">
        <button class="ow-back" @click="step = 'type'">‹ กลับ</button>
        <div class="ow-title">สมัครเป็นผู้เยี่ยมชม</div>
        <input v-model="gNick" class="ow-input" :maxlength="LIMITS.nickname" placeholder="ชื่อเล่นที่อยากให้เรียก" />
        <textarea v-model="gReason" class="ow-input ow-ta" rows="3" :maxlength="LIMITS.guestReason" placeholder="เข้ามาด้วยเหตุผลอะไรนะ? (เช่น เพื่อนรุ่นพี่ชวนมาดู)"></textarea>
        <div v-if="gErr" class="ow-err"><Emoji char="⚠️" /> {{ gErr }}</div>
        <button class="ow-btn" :disabled="busy" @click="submitGuest">
          {{ busy ? 'กำลังส่ง…' : 'ส่งคำขอ →' }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useMembersStore } from '../../stores/members.js'
import { validateGuest, matchRoster } from '../../utils/onboarding.js'
import { LIMITS } from '../../utils/text.js'
import { useToast } from '../../composables/useToast.js'

const auth = useAuthStore()
const members = useMembersStore()
const { toast } = useToast()

const step = ref('type')
const busy = ref(false)

// student
const sid = ref('')
const sErr = ref('')
const matched = ref(null)
function goStudent() { step.value = 'student'; if (!members.students.length) members.initStudents() }
function resetStudent() { step.value = 'type'; sid.value = ''; sErr.value = ''; matched.value = null }
function checkStudent() {
  sErr.value = ''
  const m = matchRoster(sid.value, members.students)
  if (!m) { sErr.value = 'ไม่พบรหัสนี้ ลองใหม่อีกครั้ง'; matched.value = null; return }
  matched.value = m
}
async function confirmStudent() {
  if (busy.value) return
  busy.value = true
  const r = await auth.linkStudent(sid.value)
  busy.value = false
  if (r.ok) return // gate เลื่อนเอง
  if (r.reason === 'notfound') sErr.value = 'ไม่พบรหัสนี้ ลองใหม่อีกครั้ง'
  else sErr.value = 'รหัสนี้ถูกใช้ไปแล้ว — ถ้าเป็นของคุณ ทักแอดมิน'
  matched.value = null
}

// guest
const gNick = ref('')
const gReason = ref('')
const gErr = ref('')
async function submitGuest() {
  gErr.value = ''
  const v = validateGuest({ nickname: gNick.value, reason: gReason.value })
  if (!v.ok) { gErr.value = v.error; return }
  busy.value = true
  const ok = await auth.registerGuest(gNick.value, gReason.value)
  busy.value = false
  if (!ok) { gErr.value = 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'; toast('ส่งคำขอไม่สำเร็จ', 'error') }
  // สำเร็จ → guestStatus=pending → gate ไป GuestPendingScreen
}

const TRACK = { sci: 'สาย Sci', care: 'สาย Care' }
const trackLabel = (t) => TRACK[t] || 'สมาชิก'
</script>

<style scoped>
.ow-ov { position: fixed; inset: 0; z-index: 320; background: linear-gradient(160deg,#eef2ff,#fff); display:flex; align-items:center; justify-content:center; padding:18px; overflow-y:auto; }
.ow-box { background:#fff; width:100%; max-width:400px; border:2px solid var(--ink); border-radius:20px; box-shadow:var(--pop-lg); padding:22px; max-height:92vh; overflow-y:auto; }
.ow-email { font-size:.74rem; color:rgba(0,0,0,.6); background:#f1f5f9; border-radius:12px; padding:10px 12px; margin-bottom:16px; }
.ow-email b { color:var(--ink); word-break:break-all; }
.ow-email-warn { font-size: .7rem; margin-top:4px; color:rgba(0,0,0,.5); }
.ow-email-warn a { color:#b45309; }
.ow-title { font-family:var(--font-display); font-weight:400; font-size:1.3rem; color:var(--ink); margin-bottom:14px; }
.ow-choice { display:flex; gap:12px; align-items:center; width:100%; text-align:left; background:#fff; border:2px solid var(--ink); border-radius:14px; padding:14px; margin-bottom:12px; box-shadow:var(--pop); cursor:pointer; transition:transform .12s,box-shadow .12s; }
.ow-choice:active { transform:translate(2px,2px); box-shadow:0 0 0 var(--ink); }
.ow-choice-ico { font-size:1.6rem; }
.ow-choice b { display:block; font-size:.88rem; color:var(--ink); }
.ow-choice small { font-size: .7rem; color:var(--muted); }
.ow-back { background:none; border:none; color:var(--muted); font-size:.8rem; cursor:pointer; margin-bottom:8px; padding:0; }
.ow-input { width:100%; border:2px solid var(--ink); border-radius:12px; padding:12px; font-family:inherit; font-size:.9rem; margin-bottom:10px; box-sizing:border-box; }
.ow-ta { resize:vertical; }
.ow-err { font-size:.76rem; color:#dc2626; margin-bottom:10px; }
.ow-confirm { border:2px dashed var(--ink); border-radius:14px; padding:14px; text-align:center; margin-bottom:12px; background:#f8fafc; }
.ow-confirm-h { font-size:.72rem; color:var(--muted); }
.ow-confirm-nick { font-size:1.3rem; font-weight:800; color:var(--ink); margin:4px 0; }
.ow-confirm-sub { font-size:.8rem; color:rgba(0,0,0,.6); }
.ow-confirm-mail { font-size:.7rem; color:rgba(0,0,0,.5); margin-top:6px; word-break:break-all; }
.ow-btn { width:100%; border:2px solid var(--ink); border-radius:12px; padding:13px; font-family:inherit; font-size:.92rem; font-weight:800; color:#fff; background:var(--gold); box-shadow:var(--pop); cursor:pointer; transition:transform .12s,box-shadow .12s; }
.ow-btn:disabled { opacity:.5; cursor:not-allowed; }
.ow-btn:active:not(:disabled) { transform:translate(2px,2px); box-shadow:0 0 0 var(--ink); }
</style>
