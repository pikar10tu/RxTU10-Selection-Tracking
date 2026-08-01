<!-- src/views/CrClTrainerView.vue — ฝึกคำนวณ CrCl (Cockcroft-Gault) ทำต่อเนื่อง
     ตรรกะทั้งหมดอยู่ใน utils/crcl.js · หน้านี้เก็บยอดสะสมเงียบๆ ไม่แสดงบนจอ -->
<template>
  <div class="tab-content cr-wrap">
    <div class="page-title cr-head">
      <button class="cr-back" @click="$router.push('/study')">‹ กลับ</button>
      <span><Emoji char="🧮" /> ฝึกคำนวณ CrCl</span>
    </div>

    <button class="cr-formula-btn" @click="toggleFormula">
      {{ showFormula ? 'ซ่อนสูตร' : 'ดูสูตร' }}
    </button>
    <div v-if="showFormula" class="cr-formula">
      <div class="cr-formula-main">CrCl = (140 − อายุ) × น้ำหนัก(kg) ÷ (72 × Scr)</div>
      <div class="cr-formula-note">ถ้าเป็นผู้หญิง คูณ 0.85 · ผลลัพธ์หน่วย mL/min</div>
    </div>

    <div class="cr-card">
      <div class="cr-row"><span>เพศ</span><b>{{ p.female ? 'หญิง' : 'ชาย' }}</b></div>
      <div class="cr-row"><span>อายุ</span><b>{{ p.age }} ปี</b></div>
      <div class="cr-row"><span>น้ำหนัก</span><b>{{ p.weightKg }} kg</b></div>
      <div class="cr-row"><span>Scr</span><b>{{ p.scr.toFixed(1) }} mg/dL</b></div>
    </div>

    <div class="cr-answer">
      <input
        ref="inputEl" v-model="input" class="cr-input" inputmode="decimal"
        placeholder="CrCl (mL/min)" :readonly="checked" @keyup.enter="onEnter"
      />
      <button v-if="!checked" class="cr-btn" :disabled="!input.trim()" @click="check">ตรวจคำตอบ</button>
      <button v-else class="cr-btn" @click="next">ข้อถัดไป →</button>
    </div>

    <div v-if="checked" class="cr-result" :class="{ ok: lastOk }">
      <div class="cr-result-head">{{ lastOk ? '✅ ถูกต้อง' : '❌ ยังไม่ถูก' }}</div>
      <div class="cr-result-ans">เฉลย <b>{{ expected.toFixed(1) }}</b> mL/min</div>
      <div class="cr-result-work">
        ({{ 140 - p.age }} × {{ p.weightKg }}) ÷ (72 × {{ p.scr.toFixed(1) }}){{ p.female ? ' × 0.85' : '' }}
      </div>
    </div>

    <div class="cr-session">รอบนี้ทำไปแล้ว <b>{{ sDone }}</b> ข้อ · ถูก <b>{{ sCorrect }}</b></div>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { cockcroftGault, makeProblem, isClose } from '../utils/crcl.js'

const LS_KEY = 'rxtu10:crcl:showFormula'
const FLUSH_EVERY = 10        // เขียน Firestore ทุกกี่ข้อ (โหมดต่อเนื่อง เขียนทุกข้อแพงเกินจำเป็น)

const auth = useAuthStore()
const inputEl = ref(null)

const p = ref(makeProblem())
const input = ref('')
const checked = ref(false)
const lastOk = ref(false)
const showFormula = ref(localStorage.getItem(LS_KEY) === '1')

// ตัวนับ "เฉพาะรอบนี้" — ยอดสะสมไม่แสดงบนจอเด็ดขาด (ตามที่สั่ง)
const sDone = ref(0)
const sCorrect = ref(0)

const expected = computed(() => cockcroftGault(p.value))

// ยอดที่ยังไม่ได้เขียนลงฐาน — flush ทุก FLUSH_EVERY ข้อ และตอนออกจากหน้า
let pendingDone = 0
let pendingCorrect = 0

function toggleFormula() {
  showFormula.value = !showFormula.value
  localStorage.setItem(LS_KEY, showFormula.value ? '1' : '0')
}

function check() {
  if (checked.value) return
  const ans = parseFloat(input.value.replace(',', '.'))
  lastOk.value = isClose(ans, expected.value)
  checked.value = true
  sDone.value += 1
  pendingDone += 1
  if (lastOk.value) { sCorrect.value += 1; pendingCorrect += 1 }
  if (pendingDone >= FLUSH_EVERY) flush()
}

function next() {
  p.value = makeProblem()
  input.value = ''
  checked.value = false
  nextTick(() => inputEl.value?.focus())
}

function onEnter() { checked.value ? next() : (input.value.trim() && check()) }

// เขียนยอดสะสมแบบ batch · รีเซ็ต pending ก่อน await กันนับซ้ำถ้าถูกเรียกซ้อน
async function flush() {
  const d = pendingDone
  const c = pendingCorrect
  if (!d) return
  pendingDone = 0
  pendingCorrect = 0
  const cur = auth.userData?.minigames?.crcl || { best: 0, correct: 0 }
  const ok = await auth.patchUser(
    {
      minigames: {
        ...auth.userData?.minigames,
        // best = "จำนวนข้อที่ทำสะสม" (ไม่ใช่คะแนนสูงสุด) — ใช้ชื่อนี้เพื่อให้ buildMinigameBoard
        // เปิดกระดานได้ทันทีวันหลังโดยไม่ต้องแตะแคชสมาชิก · ยอดนี้ไม่แสดงบนจอที่ไหนเลย
        crcl: { best: (cur.best || 0) + d, correct: (cur.correct || 0) + c },
      },
    },
    { 'minigames.crcl.best': increment(d), 'minigames.crcl.correct': increment(c) },
  )
  // เขียนไม่สำเร็จ → คืนยอดกลับเข้า pending ให้ flush รอบหน้า (หรือตอนออกจากหน้า) ลองใหม่
  if (!ok) { pendingDone += d; pendingCorrect += c }
}

onMounted(() => inputEl.value?.focus())
onBeforeUnmount(() => { flush() })   // fire-and-forget: ออกจากหน้าแล้วยอดที่ค้างต้องไม่หาย
</script>

<style scoped>
.cr-wrap { max-width: 480px; margin: 0 auto; }
.cr-head { display: flex; align-items: center; gap: 10px; }
.cr-back { all: unset; cursor: pointer; font-weight: 700; color: var(--primary); padding: 6px 4px; }
.cr-formula-btn { all: unset; cursor: pointer; display: block; margin: 0 auto 8px; font-size: .78rem;
  color: var(--primary); text-decoration: underline; padding: 6px; }
.cr-formula { background: var(--primary-light); border: 2px solid var(--ink); border-radius: 12px;
  padding: 12px; margin-bottom: 12px; text-align: center; }
.cr-formula-main { font-weight: 800; font-size: .84rem; color: var(--ink); line-height: 1.5; }
.cr-formula-note { font-size: .72rem; color: rgba(0,0,0,.55); margin-top: 5px; }
.cr-card { background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop);
  padding: 14px 16px; margin-bottom: 14px; }
.cr-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0;
  font-size: .86rem; color: rgba(0,0,0,.6); }
.cr-row b { font-size: 1rem; color: var(--ink); }
.cr-answer { display: flex; gap: 8px; }
.cr-input { flex: 1; min-width: 0; border: 2px solid var(--ink); border-radius: 12px; padding: 12px;
  font-family: inherit; font-size: 1rem; box-sizing: border-box; }
.cr-input[readonly] { background: #f1f5f9; }   /* readonly ไม่ใช่ disabled — disabled จะไม่ยิง keyup ทำให้ Enter ข้อถัดไปตาย */
.cr-btn { flex-shrink: 0; all: unset; cursor: pointer; background: var(--primary); color: #fff;
  font-weight: 800; padding: 12px 18px; border-radius: 12px; text-align: center; }
.cr-btn:disabled { background: #cbd5e1; cursor: default; }
.cr-result { margin-top: 14px; border: 2px dashed rgba(0,0,0,.2); border-radius: 12px; padding: 12px;
  background: #fef2f2; }
.cr-result.ok { background: #f0fdf4; }
.cr-result-head { font-weight: 800; font-size: .92rem; }
.cr-result-ans { font-size: .88rem; margin-top: 4px; }
.cr-result-work { font-size: .76rem; color: rgba(0,0,0,.55); margin-top: 4px; overflow-wrap: anywhere; }
.cr-session { text-align: center; font-size: .76rem; color: rgba(0,0,0,.45); margin-top: 16px; }
</style>
