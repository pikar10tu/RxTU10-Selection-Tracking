<template>
  <div class="tab-content">
    <div class="sv-head">
      <div class="sv-head-row">
        <div class="sv-title"><Emoji char="📚" /> เตรียมสอบ</div>
        <HelpButton topic="study" />
      </div>
      <div class="sv-sub">ทำข้อสอบ + ทบทวนกลุ่มยา ({{ DECK.length }} ตัวยา)</div>
    </div>

    <template v-if="!authStore.isLoggedIn">
      <div class="sv-empty">เข้าสู่ระบบเพื่อเริ่มทบทวน</div>
    </template>

    <!-- ── HOME ── -->
    <template v-else-if="mode === 'home'">
      <!-- ── ส่วนทำข้อสอบ (ฮับโหมด) ── -->
      <SectionTitle><Emoji char="📝" /> ทำข้อสอบ</SectionTitle>
      <div class="sv-modes">
        <QuizModeCard emoji="🗓️" title="ข้อสอบประจำวัน" subtitle="ชุดเดียวกันทั้งรุ่น 3 ข้อ แข่งเก็บคะแนน" coming-soon />
        <QuizModeCard emoji="📝" title="ทั่วไป" subtitle="เลือกหมวด + จำนวนข้อ (5/10/15/20) ได้เหรียญ" to="/quiz" />
        <QuizModeCard emoji="♾️" title="Zen" subtitle="ทำเรื่อยๆ ไม่จำกัด ฝึกจนพอใจ" to="/quiz?mode=zen" />
        <QuizModeCard emoji="🔁" title="ข้อที่เคยผิด" :subtitle="redoSubtitle" to="/quiz?mode=redo" />
        <QuizModeCard emoji="⏱️" title="Time Attack" subtitle="แข่งกับเวลา 4 / 15 นาที" coming-soon />
        <QuizModeCard emoji="🧮" title="ฝึกคำนวณ CrCl" subtitle="ฝึกสูตร Cockcroft-Gault · ทำกี่ข้อก็ได้" to="/study/crcl" />
      </div>

      <!-- ── ส่วนทบทวน flashcard ── -->
      <div class="sv-section-flash"><SectionTitle><Emoji char="📚" /> ทบทวน flashcard</SectionTitle></div>
      <div class="sv-stats">
        <div class="sv-stat due"><span class="sv-stat-n">{{ dueCount }}</span><span class="sv-stat-l">ครบกำหนด</span></div>
        <div class="sv-stat new"><span class="sv-stat-n">{{ newCount }}</span><span class="sv-stat-l">ยังไม่เคยเรียน</span></div>
        <div class="sv-stat mast"><span class="sv-stat-n">{{ masteredCount }}</span><span class="sv-stat-l">แม่นแล้ว</span></div>
      </div>

      <div class="sv-progress">
        <div class="sv-progress-bar"><div class="sv-progress-fill" :style="{ width: seenPct + '%' }"></div></div>
        <div class="sv-progress-txt">เรียนไปแล้ว {{ seenCount }}/{{ DECK.length }} ตัว</div>
      </div>

      <button class="sv-start" :disabled="!queueSize" @click="beginReview()">
        {{ queueSize ? `เริ่มทบทวน ${queueSize} ใบ` : '🎉 วันนี้ทบทวนครบแล้ว!' }}
      </button>
      <div v-if="!queueSize" class="sv-allclear">กลับมาใหม่พรุ่งนี้ หรือกดด้านล่างเพื่อฝึกแบบสุ่ม</div>
      <button v-if="!queueSize" class="sv-freebtn" @click="startSession(true)">ฝึกอิสระ (สุ่มทั้งเด็ค · นับความคืบหน้าตามปกติ) <Emoji char="🎲" /></button>

      <div class="sv-caphint">ทบทวนได้เหรียญ +{{ COIN_PER_CARD }}/ใบ (สูงสุด {{ STUDY_DAILY_CAP }}<Emoji char="🪙" />/วัน)</div>
      <button class="sv-howto" @click="openCoach()"><Emoji char="💡" /> ดูวิธีใช้แฟลชการ์ดอีกครั้ง</button>

      <!-- ทางเข้าจัดการคลังข้อสอบ — เฉพาะทีมวิชาการ -->
      <RouterLink v-if="authStore.isQuestionEditor" to="/questions" class="sv-quizlink sv-acadlink">
        <span class="sv-quizlink-emoji"><Emoji char="🛠️" /></span>
        <span class="sv-quizlink-text">
          <b>จัดการคลังข้อสอบ</b>
          <small>เพิ่ม/แก้/เผยแพร่ข้อสอบ · เฉพาะทีมวิชาการ</small>
        </span>
        <span class="sv-quizlink-go">›</span>
      </RouterLink>

      <RouterLink v-if="authStore.isQuestionEditor" to="/review" class="sv-quizlink sv-acadlink">
        <span class="sv-quizlink-emoji"><Emoji char="🔍" /></span>
        <span class="sv-quizlink-text">
          <b>ตรวจข้อสอบ (วิชาการ)</b>
          <small>ระบบสุ่มข้อให้ช่วยตรวจความถูกต้อง · เฉพาะทีมวิชาการ</small>
        </span>
        <span class="sv-quizlink-go">›</span>
      </RouterLink>
    </template>

    <!-- ── COACH: วิธีใช้แฟลชการ์ด (โหมดในหน้า ไม่ใช่ overlay — StudyView อยู่ใต้ RouterView ดู CLAUDE.md ข้อ 6) ── -->
    <template v-else-if="mode === 'coach'">
      <div class="sv-coach">
        <div class="sv-coach-dots">
          <span v-for="n in 3" :key="n" class="sv-coach-dot" :class="{ on: n === coachStep }"></span>
        </div>

        <template v-if="coachStep === 1">
          <div class="sv-coach-ico"><Emoji char="🤔" /></div>
          <div class="sv-coach-title">พยายามนึกก่อน</div>
          <p class="sv-coach-body">เห็นชื่อยาแล้วอย่าเพิ่งเปิดเฉลย — ลองนึกให้ได้ก่อน การพยายามนึกคือสิ่งที่ทำให้จำได้จริง ไม่ใช่การอ่านซ้ำ</p>
        </template>

        <template v-else-if="coachStep === 2">
          <div class="sv-coach-ico"><Emoji char="🔍" /></div>
          <div class="sv-coach-title">เปิดแล้วเทียบ</div>
          <p class="sv-coach-body">พลิกการ์ดแล้วดูว่านึกได้ครบไหม — กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่</p>
        </template>

        <template v-else>
          <div class="sv-coach-ico"><Emoji char="🎯" /></div>
          <div class="sv-coach-title">ตอบตามจริง</div>
          <p class="sv-coach-body">ปุ่มที่กดเป็นตัวกำหนดว่าการ์ดใบนี้จะกลับมาให้ทบทวนเมื่อไหร่ · ตอบเกินจริงตอนนี้ = ไปลืมเอาตอนสอบ</p>
        </template>

        <button class="sv-start" @click="coachStep < 3 ? coachStep++ : finishCoach()">
          {{ coachStep < 3 ? 'ต่อไป →' : (coachThenStart ? 'เริ่มทบทวนเลย' : 'เข้าใจแล้ว') }}
        </button>
        <button class="sv-coach-skip" @click="finishCoach()">ข้ามไปก่อน</button>
      </div>
    </template>

    <!-- ── REVIEW ── -->
    <template v-else-if="mode === 'review'">
      <div class="sv-rev-top">
        <button class="sv-quit" @click="endSession">✕</button>
        <div class="sv-rev-bar"><div class="sv-rev-fill" :style="{ width: revPct + '%' }"></div></div>
        <span class="sv-rev-count">{{ doneInSession }}/{{ sessionTotal }}</span>
      </div>

      <div class="sv-card" :class="{ flipped }" @click="!flipped && (flipped = true)">
        <div class="sv-card-tag">{{ flipped ? 'เฉลย' : 'ตัวยา' }}</div>
        <div class="sv-card-front">{{ current?.n }}</div>
        <template v-if="flipped">
          <div class="sv-card-divider"></div>
          <div class="sv-card-back">{{ current?.a }}</div>
          <div class="sv-card-detail">
            <div class="sv-detail-row"><span class="sv-detail-k"><Emoji char="💊" /> ข้อบ่งใช้</span><span class="sv-detail-v">{{ current?.ind }}</span></div>
            <div class="sv-detail-row"><span class="sv-detail-k"><Emoji char="📐" /> ขนาด (ผู้ใหญ่)</span><span class="sv-detail-v">{{ current?.dose }}</span></div>
          </div>
          <button class="sv-report" @click.stop="openReport(current)"><Emoji char="🚩" /> แจ้งข้อมูลผิด</button>
        </template>
        <div v-else class="sv-recall">
          <div class="sv-recall-lead">ลองนึกให้ได้ก่อนเปิด</div>
          <div class="sv-recall-items">กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่</div>
          <div class="sv-card-hint">แตะเพื่อดูเฉลย</div>
        </div>
      </div>

      <div v-if="flipped" class="sv-grade-wrap">
        <div class="sv-grade-note">ตอบตามจริง — ปุ่มที่เลือกกำหนดว่าการ์ดนี้จะกลับมาเมื่อไหร่</div>
        <div class="sv-grades">
          <button class="sv-grade again" @click="grade(1)"><b>ลืม</b><i>นึกไม่ออก</i><small>&lt; 1 วัน</small></button>
          <button class="sv-grade hard"  @click="grade(3)"><b>ยาก</b><i>ต้องคิดนาน</i><small>{{ preview(3) }}</small></button>
          <button class="sv-grade good"  @click="grade(4)"><b>จำได้</b><i>นึกออกปกติ</i><small>{{ preview(4) }}</small></button>
          <button class="sv-grade easy"  @click="grade(5)"><b>ง่าย</b><i>ตอบได้ทันที</i><small>{{ preview(5) }}</small></button>
        </div>
      </div>
      <div v-else class="sv-flip-spacer">เปิดเฉลยก่อน แล้วค่อยเลือกว่านึกได้แค่ไหน</div>
    </template>

    <!-- ── DONE ── -->
    <template v-else-if="mode === 'done'">
      <div class="sv-done">
        <div class="sv-done-emoji"><Emoji char="🎓" /></div>
        <div class="sv-done-title">จบรอบทบทวน!</div>
        <div class="sv-done-line">ทบทวนไป <b>{{ sessionTotal }}</b> ใบ · จำได้ <b>{{ sessionCorrect }}</b> ใบ</div>
        <div v-if="sessionCoins" class="sv-done-coins">+{{ sessionCoins.toLocaleString() }} <Emoji char="🪙" /></div>
        <button class="sv-start" @click="mode = 'home'">กลับหน้าหลัก</button>
      </div>
    </template>

    <!-- ── REPORT modal ── — Teleport ไป body: #main-content stacking context, z-index สู้ #bottom-nav ไม่ได้ (ดู CLAUDE.md) -->
    <Teleport to="body">
    <div v-if="reportOpen" class="sv-rep-ov" @click.self="reportOpen = false">
      <div class="sv-rep-box">
        <div class="sv-rep-head">
          <span><Emoji char="🚩" /> แจ้งข้อมูลผิด</span>
          <button class="sv-rep-x" @click="reportOpen = false">✕</button>
        </div>
        <div class="sv-rep-drug">{{ reportTarget?.n }} — {{ reportTarget?.a }}</div>
        <textarea
          v-model="reportText"
          :maxlength="LIMITS.report"
          class="sv-rep-input"
          rows="4"
          placeholder="ระบุสิ่งที่ผิด/ควรแก้ เช่น ขนาดยา ข้อบ่งใช้ หรือกลุ่มยาไม่ตรง…"
        ></textarea>
        <button class="sv-rep-send" :disabled="!reportText.trim() || reportBusy" @click="sendReport">
          {{ reportBusy ? 'กำลังส่ง…' : 'ส่งรายงาน' }}
        </button>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import SectionTitle from '../components/shared/SectionTitle.vue'
import HelpButton from '../components/help/HelpButton.vue'
import QuizModeCard from '../components/study/QuizModeCard.vue'
import { ref, computed } from 'vue'
import { increment, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from '../composables/useToast.js'
import { DRUGS } from '../data/index.js'
import { sm2Update, newSrsCard } from '../utils/sm2.js'
import { dueCount as qcardsDueCount } from '../utils/srsQuestions.js'   // ชนกับ dueCount ของแฟลชการ์ดตัวยาด้านล่าง
import { cleanText, LIMITS } from '../utils/text.js'

const authStore = useAuthStore()
const { toast } = useToast()

const DECK = DRUGS
const NEW_PER_SESSION = 5
const MATURE_DAYS = 21
const COIN_PER_CARD = 5
const STUDY_DAILY_CAP = 150   // เพดานเหรียญจากการทบทวน/วัน (กันฟาร์ม "ฝึกอิสระ" วนไม่จำกัด)

// ── persistent SRS state: userData.study.cards keyed by drug name ──
const study = computed(() => authStore.userData?.study || { cards: {} })
const cards = computed(() => study.value.cards || {})

// ── กองข้อสอบที่เคยตอบผิด (คนละกองกับแฟลชการ์ดตัวยา) — นับจาก user doc ที่โหลดอยู่แล้ว = 0 reads ──
const redoDue = computed(() => qcardsDueCount(study.value.qcards, Date.now()))
const redoSubtitle = computed(() => redoDue.value
  ? `ครบกำหนดทบทวน ${redoDue.value} ข้อ · ตอบใหม่จนถูก 3 ครั้งติดแล้วหลุดกอง`
  : 'ยังไม่มีข้อค้าง — ตอบผิดเมื่อไหร่จะเก็บมาที่นี่')

const isDue = (c) => (c?.nextReviewDate || 0) <= Date.now()
const dueList   = computed(() => DECK.filter(d => cards.value[d.n] && isDue(cards.value[d.n])))
const newList   = computed(() => DECK.filter(d => !cards.value[d.n]))
const dueCount  = computed(() => dueList.value.length)
const newCount  = computed(() => newList.value.length)
const seenCount = computed(() => DECK.filter(d => cards.value[d.n]).length)
const seenPct   = computed(() => Math.round((seenCount.value / DECK.length) * 100))
const masteredCount = computed(() =>
  DECK.filter(d => (cards.value[d.n]?.interval || 0) >= MATURE_DAYS).length
)
const queueSize = computed(() => dueCount.value + Math.min(newCount.value, NEW_PER_SESSION))

// ── session state ──
const mode = ref('home')          // home | coach | review | done
const queue = ref([])             // array of drug names left to review
const flipped = ref(false)
const sessionTotal = ref(0)
const sessionCorrect = ref(0)
const sessionCoins = ref(0)
const rewarded = ref(new Set())   // card ids already rewarded this session

const coachStep = ref(1)          // 1..3
const coachThenStart = ref(false) // จบจอสอนแล้วเข้าเซสชันต่อไหม (ครั้งแรกเท่านั้น · เปิดดูซ้ำ = กลับหน้าหลัก)

// เข้าเซสชันปกติ — คนที่ยังไม่เคยเห็นวิธีใช้ ให้ดูจอสอนก่อนแล้วค่อยเข้าเซสชันต่อ
function beginReview() {
  if (!authStore.userData?.seenStudyCoach) {
    coachStep.value = 1
    coachThenStart.value = true
    mode.value = 'coach'
    return
  }
  startSession()
}

// เปิดดูวิธีใช้ซ้ำจากหน้าหลัก — จบแล้วกลับหน้าหลัก ไม่เข้าเซสชัน
function openCoach() {
  coachStep.value = 1
  coachThenStart.value = false
  mode.value = 'coach'
}

// จบ/ข้ามจอสอน — ประทับ flag ครั้งเดียว แล้วไปต่อตามเส้นทางที่มา
async function finishCoach() {
  const wasFirstRun = coachThenStart.value
  if (wasFirstRun) {
    startSession()
    if (mode.value === 'coach') mode.value = 'home'   // คิวว่างระหว่างเปิดจอสอน → อย่าค้างบนจอสอน
  }
  else mode.value = 'home'
  if (!authStore.userData?.seenStudyCoach) {
    await authStore.patchUser({ seenStudyCoach: true }, { seenStudyCoach: true })
  }
}

const current = computed(() => DECK.find(d => d.n === queue.value[0]) || null)
const doneInSession = computed(() => sessionTotal.value - queue.value.length)
const revPct = computed(() => sessionTotal.value ? Math.round((doneInSession.value / sessionTotal.value) * 100) : 0)

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

function startSession(free = false) {
  let ids
  if (free) {
    ids = shuffle(DECK.map(d => d.n)).slice(0, 20)
  } else {
    const due = shuffle(dueList.value.map(d => d.n))
    const fresh = shuffle(newList.value.map(d => d.n)).slice(0, NEW_PER_SESSION)
    ids = [...due, ...fresh]
  }
  if (!ids.length) return
  queue.value = ids
  sessionTotal.value = ids.length
  sessionCorrect.value = 0
  sessionCoins.value = 0
  rewarded.value = new Set()
  flipped.value = false
  mode.value = 'review'
}

// human label for the next interval at a given quality (preview on buttons)
function preview(q) {
  const c = cards.value[current.value?.n] || newSrsCard(current.value?.n)
  const { interval } = sm2Update(c, q)
  if (interval <= 1) return '1 วัน'
  if (interval < 30) return `${interval} วัน`
  const m = Math.round(interval / 30)
  return `${m} เดือน`
}

async function grade(q) {
  const drug = current.value
  if (!drug) return
  const id = drug.n
  const prev = cards.value[id] || newSrsCard(id)
  const u = sm2Update(prev, q)
  const updated = {
    cardId: id,
    easeFactor: u.easeFactor,
    interval: u.interval,
    repetitions: u.repetitions,
    nextReviewDate: u.nextReviewDate.getTime(),   // store as epoch ms
    lapses: (prev.lapses || 0) + (q < 3 ? 1 : 0),
    totalReviews: (prev.totalReviews || 0) + 1,
    lastReviewDate: Date.now(),
  }

  // first time this card is graded in the session → reward (daily-capped) + count
  let reward = 0
  let dailyTotal = null
  let reviewedInc = 0
  const today = new Date().toISOString().slice(0, 10)
  if (!rewarded.value.has(id)) {
    rewarded.value.add(id)
    reviewedInc = 1
    const earnedToday = authStore.userData?.studyCoinDate === today ? (authStore.userData?.studyCoinsToday || 0) : 0
    reward = Math.max(0, Math.min(COIN_PER_CARD, STUDY_DAILY_CAP - earnedToday))
    dailyTotal = earnedToday + reward
    sessionCoins.value += reward
    if (q >= 3) sessionCorrect.value++
  }

  // advance queue: drop the card; if forgotten, requeue near the end to relearn
  const rest = queue.value.slice(1)
  queue.value = q < 3 ? [...rest, id] : rest
  flipped.value = false

  const newCards = { ...cards.value, [id]: updated }
  await commit(newCards, reward, today, dailyTotal, reviewedInc)

  if (!queue.value.length) finishSession()
}

function finishSession() {
  mode.value = 'done'
  if (sessionCoins.value) toast(`ทบทวนจบ +${sessionCoins.value}🪙`, 'success')
}

function endSession() {
  if (queue.value.length && doneInSession.value > 0) finishSession()
  else mode.value = 'home'
}

async function commit(newCards, reward, today, dailyTotal, reviewedInc = 0) {
  const newStudy = { ...study.value, cards: newCards, lastStudied: Date.now() }
  const optimistic = { study: newStudy }
  const patch = { study: newStudy }
  if (reward) {
    optimistic.coins = (authStore.userData?.coins || 0) + reward
    optimistic.studyCoinDate = today
    optimistic.studyCoinsToday = dailyTotal
    patch.coins = increment(reward)
    patch.studyCoinDate = today
    patch.studyCoinsToday = dailyTotal
  }
  if (reviewedInc > 0) {
    optimistic.studyReviewedTotal = (authStore.userData?.studyReviewedTotal || 0) + reviewedInc
    patch.studyReviewedTotal = increment(reviewedInc)
  }
  const ok = await authStore.patchUser(optimistic, patch)
  if (!ok) toast('บันทึกการทบทวนไม่สำเร็จ', 'error')
}

// ── report wrong drug data → Firestore `drugReports` (admin reviews later) ──
const reportOpen = ref(false)
const reportTarget = ref(null)
const reportText = ref('')
const reportBusy = ref(false)

function openReport(drug) {
  reportTarget.value = drug
  reportText.value = ''
  reportOpen.value = true
}

async function sendReport() {
  const note = cleanText(reportText.value, LIMITS.report)
  const d = reportTarget.value
  if (!note || !d || reportBusy.value) return
  reportBusy.value = true
  try {
    await addDoc(collection(db, 'drugReports'), {
      drug: d.n,
      currentClass: d.a,
      currentInd: d.ind || null,
      currentDose: d.dose || null,
      note,
      reporterUid: authStore.currentUser?.uid || null,
      reporterName: authStore.userData?.nickname || authStore.userData?.name || null,
      status: 'open',
      ts: serverTimestamp(),
    })
    reportOpen.value = false
    toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยตรวจสอบ 🙏', 'success')
  } catch (e) {
    console.error('[drugReport]', e)
    toast('ส่งรายงานไม่สำเร็จ', 'error')
  } finally {
    reportBusy.value = false
  }
}
</script>

<style scoped>
.sv-head { margin-bottom: 14px; }
.sv-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sv-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.sv-sub { font-size: .7rem; color: rgba(0,0,0,.45); margin-top: 2px; }
.sv-empty { text-align: center; color: rgba(0,0,0,.4); padding: 36px 0; font-size: .85rem; }

/* home */
.sv-section-flash { margin-top: 22px; padding-top: 18px; border-top: 1px dashed var(--border); }
.sv-modes { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
.sv-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
.sv-stat { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 14px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.sv-stat-n { font-size: 1.5rem; font-weight: 800; line-height: 1; }
.sv-stat-l { font-size: .7rem; color: rgba(0,0,0,.5); font-weight: 600; }
.sv-stat.due  .sv-stat-n { color: #d97706; }
.sv-stat.new  .sv-stat-n { color: #2563eb; }
.sv-stat.mast .sv-stat-n { color: #16a34a; }
.sv-progress { margin-bottom: 18px; }
.sv-progress-bar { height: 8px; background: rgba(0,0,0,.08); border-radius: 999px; overflow: hidden; }
.sv-progress-fill { height: 100%; background: linear-gradient(90deg,#84cc16,#16a34a); transition: width .4s; }
.sv-progress-txt { font-size: .7rem; color: rgba(0,0,0,.5); margin-top: 5px; text-align: center; }
.sv-start { width: 100%; border: 2px solid var(--ink); border-radius: 14px; padding: 16px; font-family: inherit; font-size: .95rem; font-weight: 800; color: #fff; background: var(--primary); box-shadow: var(--pop); cursor: pointer; transition: transform .12s, box-shadow .12s; }
.sv-start:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.sv-start:disabled { background: #cbd5e1; cursor: default; color: #fff; box-shadow: none; }
.sv-allclear { text-align: center; font-size: .7rem; color: rgba(0,0,0,.45); margin-top: 12px; }
.sv-freebtn { width: 100%; margin-top: 8px; border: 1px solid rgba(0,0,0,.12); background: #fff; border-radius: 12px; padding: 11px; font-family: inherit; font-size: .8rem; font-weight: 700; color: #475569; cursor: pointer; }
.sv-caphint { text-align: center; font-size: .7rem; color: rgba(0,0,0,.4); margin-top: 10px; }
.sv-howto { display: block; margin: 10px auto 0; background: none; border: none; font-family: inherit; font-size: .74rem; color: var(--primary); text-decoration: underline; cursor: pointer; padding: 6px; }
.sv-quizlink { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding: 14px; border-radius: 16px; background: var(--primary-light); border: 2px solid var(--ink); box-shadow: var(--pop); text-decoration: none; transition: transform .12s, box-shadow .12s; }
.sv-quizlink:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.sv-quizlink-emoji { font-size: 1.6rem; }
.sv-quizlink-text { flex: 1; display: flex; flex-direction: column; }
.sv-quizlink-text b { font-size: .88rem; color: #3730a3; }
.sv-quizlink-text small { font-size: .7rem; color: #6366f1; }
.sv-quizlink-go { font-size: 1.4rem; color: #6366f1; }
/* ทางเข้าทีมวิชาการ — โทนอำพัน แยกจากปุ่มทำข้อสอบของนักศึกษา */
.sv-acadlink { background: #fff7ed; border-color: #b45309; margin-top: 10px; }
.sv-acadlink .sv-quizlink-text b { color: #9a3412; }
.sv-acadlink .sv-quizlink-text small,
.sv-acadlink .sv-quizlink-go { color: #c2680c; }

/* coach */
.sv-coach { background: #fff; border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop); padding: 22px 18px; text-align: center; margin-top: 10px; }
.sv-coach-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
.sv-coach-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.15); }
.sv-coach-dot.on { background: var(--primary); }
.sv-coach-ico { font-size: 2.4rem; margin-bottom: 6px; }
.sv-coach-title { font-family: var(--font-display); font-weight: 400; font-size: 1.25rem; color: var(--ink); margin-bottom: 8px; }
.sv-coach-body { font-size: .84rem; color: rgba(0,0,0,.65); line-height: 1.6; margin: 0 0 16px; }
.sv-coach-skip { background: none; border: none; color: var(--muted); font-size: .76rem; margin-top: 10px; padding: 8px; cursor: pointer; font-family: inherit; }

/* review */
.sv-rev-top { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.sv-quit { border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; flex-shrink: 0; font-size: .85rem; }
.sv-rev-bar { flex: 1; height: 7px; background: rgba(0,0,0,.08); border-radius: 999px; overflow: hidden; }
.sv-rev-fill { height: 100%; background: linear-gradient(90deg,#4f46e5,#6366f1); transition: width .3s; }
.sv-rev-count { font-size: .7rem; font-weight: 700; color: rgba(0,0,0,.5); flex-shrink: 0; }
.sv-card { background: #fff; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); min-height: 240px; padding: 26px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; cursor: pointer; }
.sv-card.flipped { cursor: default; }
.sv-card-tag { font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6366f1; background: #eef2ff; padding: 3px 10px; border-radius: 999px; }
.sv-card-front { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
.sv-card-divider { width: 40px; height: 2px; background: rgba(0,0,0,.1); border-radius: 2px; }
.sv-card-back { font-size: 1.05rem; font-weight: 600; color: #4338ca; }
.sv-card-detail { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.sv-detail-row { display: flex; flex-direction: column; gap: 2px; background: #f8fafc; border: 1px solid rgba(0,0,0,.05); border-radius: 10px; padding: 8px 11px; text-align: left; }
.sv-detail-k { font-size: .7rem; font-weight: 700; color: #64748b; }
.sv-detail-v { font-size: .78rem; color: #1e293b; line-height: 1.35; }
.sv-report { margin-top: 4px; border: none; background: none; color: #ef4444; font-family: inherit; font-size: .7rem; font-weight: 600; cursor: pointer; padding: 4px; }
.sv-report:active { opacity: .6; }
.sv-card-hint { font-size: .7rem; color: rgba(0,0,0,.35); margin-top: 4px; }
.sv-recall { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.sv-recall-lead { font-size: .7rem; color: rgba(0,0,0,.45); }
.sv-recall-items { font-size: .8rem; font-weight: 800; color: var(--primary); line-height: 1.4; }
.sv-grades { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }
.sv-grade { border: 2px solid var(--ink); border-radius: 12px; padding: 12px 4px; font-family: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #fff; box-shadow: var(--pop); transition: transform .1s, box-shadow .1s; }
.sv-grade:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.sv-grade b { font-size: .82rem; }
.sv-grade small { font-size: .7rem; opacity: .9; }
.sv-grade-wrap { margin-top: 16px; }
.sv-grade-note { font-size: .7rem; color: rgba(0,0,0,.5); text-align: center; margin-bottom: 7px; line-height: 1.4; }
.sv-grade i { font-style: normal; font-size: .7rem; opacity: .85; line-height: 1.25; }
.sv-grade.again { background: #ef4444; }
.sv-grade.hard  { background: #f59e0b; }
.sv-grade.good  { background: #22c55e; }
.sv-grade.easy  { background: #3b82f6; }
.sv-grade:active { transform: scale(.96); }
.sv-flip-spacer { margin-top: 18px; text-align: center; font-size: .7rem; color: rgba(0,0,0,.35); }

/* done */
.sv-done { text-align: center; padding: 30px 0; }
.sv-done-emoji { font-size: 3rem; }
.sv-done-title { font-size: 1.3rem; font-weight: 800; margin: 8px 0; }
.sv-done-line { font-size: .85rem; color: rgba(0,0,0,.6); margin-bottom: 6px; }
.sv-done-coins { font-size: 1.1rem; font-weight: 800; color: #d97706; margin-bottom: 20px; }
.sv-done .sv-start { max-width: 260px; margin: 0 auto; }

/* report modal */
.sv-rep-ov { position: fixed; inset: 0; z-index: 240; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 18px; }
.sv-rep-box { background: #fff; width: 100%; max-width: 380px; border-radius: 18px; padding: 16px; max-height: 88vh; overflow-y: auto; }
.sv-rep-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: .92rem; margin-bottom: 10px; }
.sv-rep-x { border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; }
.sv-rep-drug { font-size: .74rem; color: #475569; background: #f1f5f9; border-radius: 10px; padding: 8px 11px; margin-bottom: 10px; }
.sv-rep-input { width: 100%; box-sizing: border-box; border: 1px solid rgba(0,0,0,.12); border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: .82rem; resize: vertical; }
.sv-rep-input:focus { outline: 2px solid #6366f1aa; border-color: transparent; }
.sv-rep-send { width: 100%; margin-top: 10px; border: none; border-radius: 12px; padding: 12px; font-family: inherit; font-size: .85rem; font-weight: 800; color: #fff; background: linear-gradient(135deg,#ef4444,#dc2626); cursor: pointer; }
.sv-rep-send:disabled { background: #cbd5e1; cursor: default; }
</style>
