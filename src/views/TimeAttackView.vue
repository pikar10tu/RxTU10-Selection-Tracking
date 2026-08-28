<!-- src/views/TimeAttackView.vue -->
<!-- Time Attack — ข้อสอบจับเวลา 4/15 นาที + กระดานอันดับในรุ่น
     spec: docs/superpowers/specs/2026-08-28-time-attack-design.md

     หลักการ: เวลาคือทรัพยากร ⇒ ระหว่างเล่นไม่มีอะไรให้อ่านนอกจากโจทย์
              คำอธิบาย/เฉลยทั้งหมดยกไปไว้จอผล -->
<template>
  <div class="tab-content">
    <div class="ta-head">
      <button class="ta-back" aria-label="ย้อนกลับ" @click="onBack">‹</button>
      <span class="ta-head-title"><Emoji char="⏱️" /> Time Attack</span>
      <HelpButton topic="timeAttack" style="margin-left:auto" />
    </div>

    <div v-if="!auth.isLoggedIn" class="ta-empty">เข้าสู่ระบบเพื่อเล่น</div>

    <!-- ── เลือกโหมด ── -->
    <template v-else-if="stage === 'pick'">
      <div class="ta-intro">ตอบให้ได้มากที่สุดก่อนหมดเวลา · ตอบแล้วไปข้อถัดไปทันที เฉลยทั้งหมดรอดูตอนจบ</div>

      <div class="ta-modes">
        <button v-for="m in TA_MODES" :key="m.key" class="ta-mode" :disabled="starting" @click="startRun(m)">
          <span class="ta-mode-emoji"><Emoji :char="m.emoji" /></span>
          <span class="ta-mode-text">
            <b>{{ m.label }}</b>
            <small>{{ m.tagline }}</small>
          </span>
          <span class="ta-mode-best">
            <span class="ta-mode-best-n">{{ bestOf(m) }}</span>
            <span class="ta-mode-best-l">สถิติเดิม</span>
          </span>
        </button>
      </div>
      <div v-if="starting" class="ta-loading">กำลังเตรียมข้อสอบ…</div>

      <div class="ta-boards">
        <TaBoard v-for="m in TA_MODES" :key="m.key" :mode-key="m.key" />
      </div>

      <div class="ta-hint">
        ตอบถูกได้เหรียญ +{{ QUIZ_COIN_PER_CORRECT }}/ข้อ เท่าโหมดปกติ ·
        ข้อที่ตอบผิดจะถูกเก็บไปไว้ในโหมด "ข้อที่เคยผิด" ให้อัตโนมัติ
      </div>
    </template>

    <!-- ── กำลังเล่น ── -->
    <template v-else-if="stage === 'play'">
      <div class="ta-bar">
        <button class="ta-quit" aria-label="ออกจากรอบนี้" @click="finish('quit')">✕</button>
        <span class="ta-clock" :class="{ hurry: leftMs <= 10000 }">{{ clockLabel(leftMs) }}</span>
        <span class="ta-score">ถูก {{ correct }} / ตอบไป {{ answered }}</span>
      </div>

      <div v-if="!cur" class="ta-wait">กำลังโหลดข้อถัดไป… <small>(เวลายังเดินอยู่นะ)</small></div>
      <template v-else>
        <div class="ta-q">{{ cur.question }}</div>
        <div class="ta-choices">
          <button
            v-for="(c, i) in cur.choices" :key="i"
            class="ta-choice" :class="choiceClass(i)"
            :disabled="locked" @click="pick(i)"
          >
            <span class="ta-letter">{{ LETTERS[i] }}</span><span class="ta-ctext">{{ c }}</span>
          </button>
        </div>
      </template>
    </template>

    <!-- ── ผล ── -->
    <template v-else-if="stage === 'result'">
      <div class="ta-result">
        <div class="ta-res-emoji">{{ resultEmoji }}</div>
        <div class="ta-res-title">{{ endReasonText }}</div>
        <div class="ta-res-score">{{ correct }}<span> ข้อ</span></div>
        <div class="ta-res-sub">ตอบไป {{ answered }} ข้อ · แม่น {{ accuracy }}%</div>
        <div v-if="isNewBest" class="ta-res-best"><Emoji char="🎉" /> สถิติใหม่! (เดิม {{ prevBest }} ข้อ)</div>
        <div v-else class="ta-res-prev">สถิติเดิมของคุณ {{ prevBest }} ข้อ</div>
        <div v-if="coinsEarned" class="ta-res-coins">+{{ coinsEarned.toLocaleString() }} <Emoji char="🪙" /></div>
      </div>

      <div class="ta-res-actions">
        <button class="ta-again" :disabled="starting" @click="startRun(mode)">เล่นอีกรอบ</button>
        <button class="ta-tohome" @click="stage = 'pick'">กลับหน้าเลือกโหมด</button>
      </div>

      <TaBoard v-if="mode" :mode-key="mode.key" class="ta-res-board" />

      <template v-if="missed.length">
        <div class="ta-miss-head"><Emoji char="📖" /> ข้อที่ตอบผิด ({{ missed.length }}) — ดูเฉลยได้เต็มที่ ไม่มีเวลาจับแล้ว</div>
        <div v-for="(m, i) in missed" :key="i" class="ta-miss">
          <div class="ta-miss-q">{{ m.q.question }}</div>
          <div class="ta-miss-line no">คุณตอบ: {{ m.q.choices[m.picked] }}</div>
          <div class="ta-miss-line ok">เฉลย: {{ m.q.choices[m.q.answer] }}</div>
          <div v-if="m.q.explanation" class="ta-miss-exp"><Emoji char="💡" /> {{ m.q.explanation }}</div>
        </div>
      </template>
      <div v-else-if="answered" class="ta-miss-none"><Emoji char="🏆" /> ตอบถูกหมดทุกข้อ!</div>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import HelpButton from '../components/help/HelpButton.vue'
import TaBoard from '../components/study/TaBoard.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { collection, addDoc, doc, writeBatch, increment, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useUsageStore } from '../stores/usage.js'
import { useToast } from '../composables/useToast.js'
import { useQuestionFeed } from '../composables/useQuestionFeed.js'
import { useRosterSync } from '../composables/useRosterSync.js'
import { useNewsPost } from '../composables/useNewsPost.js'
import { rankOfScore } from '../utils/newsFeed.js'
import { shuffleChoices } from '../utils/quizShuffle.js'
import { DOMAIN_KEYS } from '../data/domains.js'
import { bumpDailyQuest } from '../utils/dailyQuest.js'
import { tallyAnswers } from '../utils/questionStats.js'
import { applyQuizResults, buildQcardsPatch } from '../utils/srsQuestions.js'
import { QUIZ_COIN_PER_CORRECT } from '../data/index.js'
import {
  TA_MODES, TA_BATCH, TA_REFILL_AT, TA_FLASH_MS, TA_TICK_MS, TA_EMPTY_STREAK_MAX,
  remainingMs, clockLabel, newBest,
} from '../utils/timeAttack.js'

const auth = useAuthStore()
const members = useMembersStore()
const usage = useUsageStore()
const router = useRouter()
const { toast } = useToast()
const { fetchQuestions } = useQuestionFeed()
const { syncRosterRow } = useRosterSync()
const { postNews, myName } = useNewsPost()

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

const stage = ref('pick')      // pick | play | result
const starting = ref(false)
const mode = ref(null)         // โหมดที่กำลังเล่น (entry จาก TA_MODES)
const queue = ref([])          // โจทย์ที่รอเสิร์ฟ
const cur = ref(null)
const picked = ref(null)
const locked = ref(false)
const correct = ref(0)
const answered = ref(0)
const answers = ref([])        // { id, domain, correct } — ใช้ต่อที่ examSessions/SRS
const missed = ref([])         // { q, picked } — เฉลยที่ยกไปโชว์ตอนจบ
const leftMs = ref(0)
const endReason = ref('time')  // time | quit | empty
const coinsEarned = ref(0)
const isNewBest = ref(false)
const prevBest = ref(0)

let seen = new Set()           // id ที่เคยเข้าคิวแล้ว — กันข้อซ้ำในรอบเดียว
let emptyStreak = 0            // ดึงแล้วไม่ได้ข้อใหม่ติดกันกี่ครั้ง
let failStreak = 0             // ดึงแล้ว throw ติดกันกี่ครั้ง (เน็ตล่ม) — กันวนยิงรัว
let exhausted = false          // คลังหมดจริง (หรือโหลดล้มเหลวจนต้องตัดจบ)
let loadFailed = false         // แยกสาเหตุ: คลังหมด vs เน็ตล่ม (ข้อความบนจอผลคนละอัน)
let fetching = false
let waiting = false            // คิวหมดแต่ยังโหลดอยู่
let endAt = 0
let tickTimer = null
let flashTimer = null

const bestOf = (m) => auth.userData?.timeAttack?.[m.bestField] || 0
const accuracy = computed(() => answered.value ? Math.round((correct.value / answered.value) * 100) : 0)
const resultEmoji = computed(() => accuracy.value >= 80 ? '🏆' : accuracy.value >= 50 ? '😊' : '📚')
const endReasonText = computed(() => ({
  time:  'หมดเวลา!',
  quit:  'จบรอบแล้ว',
  empty: 'ทำครบทุกข้อในคลังแล้ว!',
  error: 'โหลดข้อถัดไปไม่สำเร็จ — จบรอบให้ตรงนี้ (คะแนนที่ทำไว้ยังนับให้)',
}[endReason.value] || 'จบรอบแล้ว'))

function clearTimers() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = null }
}
onUnmounted(clearTimers)

/** ดึงล็อตถัดไปแบบไม่ block — นาฬิกาต้องไม่มีวันหยุดรอเน็ต */
async function topUp() {
  if (fetching || exhausted) return
  fetching = true
  try {
    const rows = await fetchQuestions(TA_BATCH)
    const fresh = rows.filter(q => q?.id && !seen.has(q.id))
    for (const q of fresh) seen.add(q.id)
    if (!fresh.length) {
      // หน้าต่างสุ่มวนมาเจอของเดิมหมด — ยังไม่ฟันธงว่าคลังหมด ต้องพลาดติดกันหลายครั้ง
      emptyStreak++
      if (emptyStreak >= TA_EMPTY_STREAK_MAX) exhausted = true
    } else {
      emptyStreak = 0
      queue.value.push(...fresh.map(shuffleChoices))
    }
    failStreak = 0
  } catch (e) {
    console.error('[ta feed]', e)
    // serveNext เรียก topUp ซ้ำเมื่อคิวว่าง ⇒ เน็ตล่มแล้วจะวนยิงรัวถ้าไม่ตัดจบ
    if (++failStreak >= 3) { exhausted = true; loadFailed = true }
  } finally {
    fetching = false
    if (waiting && stage.value === 'play') serveNext()   // คิวเคยหมดระหว่างรอ
  }
}

/** หยิบข้อถัดไปขึ้นจอ */
function serveNext() {
  if (stage.value !== 'play') return
  if (!queue.value.length) {
    if (exhausted) { finish(loadFailed ? 'error' : 'empty'); return }
    waiting = true
    cur.value = null
    topUp()
    return
  }
  waiting = false
  cur.value = queue.value.shift()
  picked.value = null
  locked.value = false
  if (queue.value.length <= TA_REFILL_AT) topUp()   // เติมล่วงหน้า ไม่ await
}

function pick(i) {
  if (locked.value || !cur.value) return
  locked.value = true
  picked.value = i
  answered.value++
  const ok = i === cur.value.answer
  if (ok) correct.value++
  else missed.value.push({ q: cur.value, picked: i })
  answers.value.push({ id: cur.value.id, domain: cur.value.domain || null, correct: ok })
  flashTimer = setTimeout(() => { flashTimer = null; serveNext() }, TA_FLASH_MS)
}

function choiceClass(i) {
  if (picked.value === null) return ''
  if (i === cur.value.answer) return 'correct'
  if (i === picked.value) return 'wrong'
  return 'dim'
}

async function startRun(m) {
  if (starting.value || !m) return
  starting.value = true
  try {
    // ล้าง state รอบก่อน
    clearTimers()
    mode.value = m
    queue.value = []
    cur.value = null; picked.value = null; locked.value = false
    correct.value = 0; answered.value = 0
    answers.value = []; missed.value = []
    coinsEarned.value = 0; isNewBest.value = false; prevBest.value = 0
    seen = new Set(); emptyStreak = 0; failStreak = 0
    exhausted = false; loadFailed = false; fetching = false; waiting = false
    endReason.value = 'time'

    await topUp()                       // ล็อตแรกต้องรอ — ไม่งั้นนาฬิกาเดินโดยไม่มีโจทย์
    if (!queue.value.length) { toast('ยังไม่มีข้อสอบให้ทำ', 'error'); return }

    stage.value = 'play'
    endAt = Date.now() + m.ms
    leftMs.value = m.ms
    // ⚠️ คำนวณจากเวลาปลายทางทุก tick — ห้ามสะสม (มือถือ throttle setInterval ตอนสลับแอป)
    tickTimer = setInterval(() => {
      leftMs.value = remainingMs(endAt, Date.now())
      if (leftMs.value <= 0) finish('time')
    }, TA_TICK_MS)
    serveNext()
  } finally {
    starting.value = false
  }
}

/** จบรอบ: หยุดนาฬิกา → ขึ้นจอผลทันที → ค่อยบันทึกเบื้องหลัง (ผู้เล่นไม่ต้องรอเน็ต) */
async function finish(reason) {
  if (stage.value !== 'play') return
  endReason.value = reason
  clearTimers()
  stage.value = 'result'

  const m = mode.value
  // แช่ผลของรอบนี้ไว้ก่อนทุก await — กด "เล่นอีกรอบ" ระหว่างกำลังเขียนแล้ว state จะถูกรีเซ็ตกลางคัน
  const snapAnswers = answers.value.slice()
  const snapAnswered = answered.value
  const snapCorrect = correct.value
  const grant = snapCorrect * QUIZ_COIN_PER_CORRECT
  coinsEarned.value = grant

  // ⚠️ CLAUDE.md ข้อ 9 — หยิบค่าก่อนเรียก patchUser (หลังเรียกแล้ว userData เปลี่ยนทันที)
  const before = auth.userData?.timeAttack?.[m.bestField] || 0
  const { best, isNew } = newBest(before, snapCorrect)
  prevBest.value = before
  isNewBest.value = isNew

  if (!auth.currentUser || !snapAnswered) return

  // 1) บันทึกรอบนี้ลง examSessions — ฟิลด์ mode ทำให้แยกออกจากควิซปกติได้ภายหลัง
  try {
    usage.track(0, 1)
    const domainStats = Object.fromEntries(DOMAIN_KEYS.map(k => [k, { c: 0, t: 0 }]))
    domainStats.none = { c: 0, t: 0 }
    for (const a of snapAnswers) {
      const bucket = (a.domain && domainStats[a.domain]) ? a.domain : 'none'
      domainStats[bucket].t++
      if (a.correct) domainStats[bucket].c++
    }
    await addDoc(collection(db, 'examSessions'), {
      userId: auth.currentUser.uid,
      nickname: auth.userData?.nickname || null,
      total: snapAnswered,
      correct: snapCorrect,
      pct: snapAnswered ? Math.round((snapCorrect / snapAnswered) * 100) : 0,
      domain: null, examSet: null, category: null,
      mode: m.key,
      domainStats,
      ts: serverTimestamp(),
    })
  } catch (e) { console.error('[ta session]', e) }

  // 2) สถิติรายข้อ (non-fatal เหมือน QuizView)
  try {
    const tally = tallyAnswers(snapAnswers)
    const qids = Object.keys(tally)
    if (qids.length) {
      const batch = writeBatch(db)
      for (const qid of qids) {
        batch.set(doc(db, 'questionStats', qid),
          { a: increment(tally[qid].a), c: increment(tally[qid].c) }, { merge: true })
      }
      await batch.commit()
      usage.track(0, qids.length)
    }
  } catch (e) { console.error('[ta questionStats]', e) }

  // 3) user doc: เหรียญ + สถิติดีสุด + กองข้อที่เคยผิด + เควสรายวัน
  const today = new Date().toISOString().slice(0, 10)
  const dq = bumpDailyQuest(auth.userData?.dailyQuest, 'quiz', today, snapAnswered)
  // ตอบผิดในโหมดนี้ = เข้ากอง "ข้อที่เคยผิด" เหมือนควิซปกติ (variant 'normal')
  const { set: qcSet, remove: qcRemove } = applyQuizResults({
    qcards: auth.userData?.study?.qcards,
    answers: snapAnswers,
    variant: 'normal',
    now: Date.now(),
    missingIds: [],
  })
  const { optimisticStudy, server: qcServer } = buildQcardsPatch({
    study: auth.userData?.study, set: qcSet, remove: qcRemove, deleteSentinel: deleteField(),
  })
  const touchedQcards = Object.keys(qcServer).length > 0

  const ok = await auth.patchUser(
    {
      coins: (auth.userData?.coins || 0) + grant,
      timeAttack: { ...(auth.userData?.timeAttack || {}), [m.bestField]: best },
      quizDoneTotal: (auth.userData?.quizDoneTotal || 0) + snapAnswered,
      dailyQuest: dq,
      ...(touchedQcards ? { study: optimisticStudy } : {}),
    },
    {
      ...(grant ? { coins: increment(grant) } : {}),
      // dot-notation — เขียนทั้งก้อนจะทับสถิติของอีกโหมด
      [`timeAttack.${m.bestField}`]: best,
      quizDoneTotal: increment(snapAnswered),
      dailyQuest: dq,
      ...qcServer,   // dot-notation เท่านั้น — ห้ามส่ง study ทั้งก้อน ไม่งั้นทับ study.cards
    },
  )
  if (!ok) { toast('บันทึกผลไม่สำเร็จ — ลองใหม่อีกครั้ง', 'error'); return }
  if (grant) toast(`ได้ ${grant.toLocaleString()}🪙 จาก Time Attack`, 'success')
  // สถิติใหม่เท่านั้นที่ต้องขึ้นกระดาน · ที่ 1 ของรุ่นไปเลนข่าวอยู่ยาว อันดับ 2-3 อยู่เลน roster
  // อันดับคำนวณจาก rosterRows ที่กระดานบนจอนี้โหลดไว้แล้ว — ไม่มีในมือ = ไม่ยิงข่าว (ห้ามอ่านเพิ่ม)
  if (isNew) {
    const rows = members.rosterRows || {}
    const rank = Object.keys(rows).length
      ? rankOfScore(rows, auth.currentUser?.uid, (r) => r?.[m.rowKey] || 0, best)
      : 0
    if (rank === 1) {
      postNews({ type: 'record1', icon: '⏱️', msg: `${myName()} ขึ้นเป็นที่ 1 ของรุ่นใน Time Attack ${m.label} ด้วย ${best} ข้อ` })
      syncRosterRow()
    } else {
      syncRosterRow({ event: (rank === 2 || rank === 3) ? { k: 'ta', g: m.key, v: rank, t: Date.now() } : null })
    }
  }
}

function onBack() {
  if (stage.value === 'pick') router.back()
  else if (stage.value === 'play') finish('quit')
  else stage.value = 'pick'
}

// เผลอกดแท็บอื่นกลางรอบ = จบรอบให้ ไม่ปล่อยให้คะแนน 15 นาทีหายเปล่า
onBeforeRouteLeave(() => { if (stage.value === 'play') finish('quit') })

onMounted(() => { members.loadRoster() })
</script>

<style scoped>
.ta-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.ta-head-title { font-family: var(--font-display); font-weight: 400; font-size: 1.4rem; color: var(--ink); }
.ta-back { border: 2px solid var(--ink); background: #fff; border-radius: 10px; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; box-shadow: var(--pop); }
.ta-back:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-empty { text-align: center; color: rgba(0,0,0,.45); padding: 40px 16px; font-size: .85rem; line-height: 1.6; }
.ta-intro { font-size: .78rem; color: rgba(0,0,0,.6); line-height: 1.6; margin-bottom: 12px; }

.ta-modes { display: flex; flex-direction: column; gap: 10px; }
.ta-mode { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 14px; border-radius: 16px; background: var(--primary-light); border: 2px solid var(--ink); box-shadow: var(--pop); font-family: inherit; cursor: pointer; }
.ta-mode:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-mode:disabled { opacity: .6; cursor: default; }
.ta-mode-emoji { font-size: 1.6rem; flex-shrink: 0; }
.ta-mode-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ta-mode-text b { font-size: .95rem; color: #3730a3; }
.ta-mode-text small { font-size: .72rem; color: #6366f1; }
.ta-mode-best { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ta-mode-best-n { font-size: 1.1rem; font-weight: 800; color: #3730a3; }
.ta-mode-best-l { font-size: .7rem; color: #6366f1; }
.ta-loading { text-align: center; font-size: .78rem; color: rgba(0,0,0,.5); margin-top: 10px; }
.ta-boards { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.ta-hint { margin-top: 14px; font-size: .72rem; color: rgba(0,0,0,.5); line-height: 1.6; }

.ta-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.ta-quit { border: 2px solid var(--ink); background: #fff; border-radius: 10px; width: 32px; height: 32px; font-size: .95rem; cursor: pointer; box-shadow: var(--pop); flex-shrink: 0; }
.ta-clock { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.ta-clock.hurry { color: #dc2626; animation: ta-pulse .6s ease-in-out infinite; }
@keyframes ta-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.ta-score { margin-left: auto; font-size: .76rem; font-weight: 800; color: rgba(0,0,0,.6); }
.ta-wait { text-align: center; color: rgba(0,0,0,.45); padding: 40px 16px; font-size: .85rem; line-height: 1.7; }
.ta-wait small { display: block; font-size: .72rem; margin-top: 4px; }
.ta-q { font-size: .95rem; font-weight: 700; line-height: 1.7; margin-bottom: 14px; }
.ta-choices { display: flex; flex-direction: column; gap: 8px; }
.ta-choice { display: flex; align-items: flex-start; gap: 10px; text-align: left; width: 100%; padding: 12px; border: 2px solid var(--ink); border-radius: 14px; background: #fff; box-shadow: var(--pop); font-family: inherit; font-size: .84rem; line-height: 1.6; cursor: pointer; }
.ta-choice:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-choice.correct { background: #dcfce7; border-color: #15803d; }
.ta-choice.wrong { background: #fee2e2; border-color: #b91c1c; }
.ta-choice.dim { opacity: .5; }
.ta-letter { font-weight: 800; flex-shrink: 0; }
.ta-ctext { flex: 1; min-width: 0; }

.ta-result { text-align: center; padding: 20px 12px 12px; }
.ta-res-emoji { font-size: 3rem; }
.ta-res-title { font-size: .95rem; font-weight: 800; margin-top: 4px; }
.ta-res-score { font-family: var(--font-display); font-size: 3rem; font-weight: 800; color: var(--primary); line-height: 1.1; }
.ta-res-score span { font-size: 1.1rem; color: rgba(0,0,0,.5); }
.ta-res-sub { font-size: .8rem; color: rgba(0,0,0,.55); }
.ta-res-best { margin-top: 8px; font-size: .85rem; font-weight: 800; color: #15803d; }
.ta-res-prev { margin-top: 8px; font-size: .78rem; color: rgba(0,0,0,.45); }
.ta-res-coins { margin-top: 6px; font-size: 1rem; font-weight: 800; color: #b45309; }
.ta-res-actions { display: flex; gap: 8px; margin: 8px 0 16px; }
.ta-again, .ta-tohome { flex: 1; border: 2px solid var(--ink); border-radius: 12px; padding: 12px; font-family: inherit; font-weight: 800; font-size: .82rem; cursor: pointer; box-shadow: var(--pop); }
.ta-again { background: var(--primary); color: #fff; }
.ta-tohome { background: #fff; }
.ta-again:active:not(:disabled), .ta-tohome:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.ta-again:disabled { background: #cbd5e1; cursor: default; box-shadow: none; }
.ta-res-board { margin-bottom: 16px; }
.ta-miss-head { font-size: .82rem; font-weight: 800; margin-bottom: 8px; line-height: 1.6; }
.ta-miss { background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 12px; margin-bottom: 8px; }
.ta-miss-q { font-size: .84rem; font-weight: 700; line-height: 1.6; margin-bottom: 6px; }
.ta-miss-line { font-size: .78rem; line-height: 1.6; }
.ta-miss-line.no { color: #b91c1c; }
.ta-miss-line.ok { color: #15803d; font-weight: 700; }
.ta-miss-exp { margin-top: 6px; font-size: .76rem; color: rgba(0,0,0,.6); line-height: 1.6; }
.ta-miss-none { text-align: center; font-size: .85rem; font-weight: 800; color: #15803d; padding: 16px; }
</style>
