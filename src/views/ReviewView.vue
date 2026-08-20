<template>
  <div class="tab-content">
    <div class="rv-head">
      <div class="rv-title"><Emoji char="🔍" /> ตรวจข้อสอบ</div>
      <RouterLink to="/questions" class="rv-back">คลังข้อสอบ ›</RouterLink>
    </div>

    <div v-if="!authStore.isQuestionEditor" class="rv-denied">
      เฉพาะแอดมินหรือทีมวิชาการเท่านั้น
    </div>

    <template v-else>
      <!-- ── แถบสรุปคิว ── -->
      <div class="rv-summary">
        <div v-if="progress.total" class="rv-sum-line">
          <Emoji char="📋" /> ผ่านแล้ว <b>{{ progress.passed }}</b> · ค้าง 1 เสียง <b>{{ progress.half }}</b> ·
          รอตรวจ <b>{{ progress.pending }}</b><span v-if="progress.conflict"> · ขัดแย้ง <b>{{ progress.conflict }}</b></span><span v-if="progress.failed"> · ไม่ผ่าน <b>{{ progress.failed }}</b></span>
        </div>
        <div v-else class="rv-sum-line">ยังไม่มีตัวเลขสรุป — รอแอดมินกด "🔄 ซิงก์ระบบตรวจ" ในหน้า Admin ครั้งแรกก่อน</div>
        <div v-if="progress.total" class="rv-bar"><div class="rv-bar-fill" :style="{ width: progress.pct + '%' }"></div></div>
        <div class="rv-sum-mine">คิวรอบนี้ของคุณ: <b>{{ myQueueCount }}</b> ข้อ</div>
      </div>

      <div v-if="loading" class="rv-empty">กำลังโหลดคลังข้อสอบ…</div>

      <!-- ── การ์ดข้อปัจจุบัน ── -->
      <section v-else-if="current" class="rv-card">
        <div class="rv-card-tags">
          <span v-if="current.domain" class="rv-cat">{{ domainLabel(current.domain) || current.domain }}</span>
          <span v-for="c in getCategories(current)" :key="c" class="rv-cat rv-cat-sub">{{ c }}</span>
          <span v-if="!current.isPublished" class="rv-draft">ร่าง</span>
          <span v-if="currentStatus === 'conflict'" class="rv-conflict-badge">⚠️ ขัดแย้ง — คุณคือผู้ตัดสิน</span>
        </div>

        <div class="rv-q">{{ current.question }}</div>
        <ul class="rv-choices">
          <li v-for="(c, i) in current.choices" :key="i" :class="{ correct: i === current.answer }">
            <span class="rv-c-letter">{{ LETTERS[i] }}</span><span class="rv-c-text">{{ c }}</span>
            <span v-if="i === current.answer" class="rv-c-mark">✓ เฉลย</span>
          </li>
        </ul>
        <div v-if="current.explanation" class="rv-exp"><Emoji char="💡" /> {{ current.explanation }}</div>

        <!-- รีวิวเดิม 2 ฉบับ (โชว์เฉพาะข้อ conflict ให้คนที่ 3 ตัดสิน — ข้ออื่นซ่อนกันอคติ) -->
        <div v-if="currentStatus === 'conflict' && priorReviews.length" class="rv-priors">
          <div class="rv-priors-head">ผลตรวจก่อนหน้า ({{ priorReviews.length }})</div>
          <div v-for="p in priorReviews" :key="p.id" class="rv-prior">
            <div class="rv-prior-top">
              <span class="rv-prior-verdict" :class="p.verdict">{{ VERDICT_LABEL[p.verdict] || p.verdict }}</span>
              <b>{{ p.reviewerName || 'ไม่ระบุ' }}</b>
            </div>
            <div class="rv-prior-reason">{{ p.reason }}</div>
            <div v-if="p.ref" class="rv-prior-ref">เรฟ: {{ p.ref }}</div>
          </div>
        </div>

        <!-- ── ฟอร์มตรวจ ── -->
        <div class="rv-form">
          <div class="rv-verdicts">
            <button
              v-for="v in VERDICTS" :key="v.key"
              type="button" class="rv-vbtn" :class="[v.key, { on: verdict === v.key }]"
              @click="verdict = v.key"
            >{{ v.label }}</button>
          </div>

          <label class="rv-label">หมวด / กลุ่มโรค (เลือกได้หลายกลุ่ม — ใช้ทำสถิติรายหัวข้อ)</label>
          <TopicSelect v-model="topics" />

          <label class="rv-label">เหตุผล (บังคับเมื่อ "ต้องแก้ / ผิด")</label>
          <textarea v-model="reason" :maxlength="LIMITS.reviewReason" class="rv-input" rows="3" placeholder="อธิบายว่าทำไมตัดสินแบบนี้…"></textarea>

          <label class="rv-label">เรฟอ้างอิง (ไม่บังคับ)</label>
          <input v-model="refText" :maxlength="LIMITS.reviewRef" class="rv-input" placeholder="ลิงก์ / ชื่อหนังสือ / แนวทาง…" />

          <label class="rv-label">
            หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย — ไม่บังคับ)
            <span v-if="hadNote" class="rv-note-hint">มีหมายเหตุจากผู้ตรวจคนก่อน — ต่อเติมหรือขัดเกลาได้</span>
          </label>
          <textarea v-model="note" :maxlength="LIMITS.reviewNote" class="rv-input" rows="3" placeholder="ข้อควรระวัง / จุดที่คนมักเข้าใจผิด…"></textarea>

          <div class="rv-actions">
            <button class="rv-btn rv-gray" :disabled="submitting" @click="skip">ข้ามข้อนี้</button>
            <button class="rv-btn rv-primary" :disabled="!canSubmit || submitting" @click="submit">
              {{ submitting ? 'กำลังส่ง…' : 'ส่งผลตรวจ' }}
            </button>
          </div>
        </div>
      </section>

      <div v-else-if="myQueueCount" class="rv-empty">
        <Emoji char="⏭️" /> ข้ามไว้ {{ myQueueCount }} ข้อ — ยังไม่ได้ตรวจ
        <button class="rv-btn rv-gray rv-unskip" @click="unskipAll">ดูข้อที่ข้ามอีกรอบ</button>
      </div>
      <div v-else class="rv-empty rv-done">
        <Emoji char="🎉" /> ตรวจครบคิวรอบนี้แล้ว — กดโหลดรอบใหม่เพื่อสุ่มข้อชุดถัดไป
        <button class="rv-btn rv-gray rv-unskip" :disabled="loading" @click="load">โหลดรอบใหม่</button>
      </div>

      <!-- ── แถบแก้ผลตรวจที่เพิ่งส่ง (session เดียว หายเมื่อรีโหลด) ── -->
      <div v-if="lastSubmit" class="rv-last">
        <div class="rv-last-top">
          <span>เพิ่งส่ง: <b>{{ VERDICT_LABEL[lastSubmit.verdict] }}</b> — {{ lastSubmit.questionText }}</span>
          <button v-if="!amending" class="rv-mini" @click="openAmend">แก้ผลตรวจ</button>
        </div>
        <div v-if="amending" class="rv-last-form">
          <div class="rv-verdicts">
            <button
              v-for="vv in VERDICTS" :key="vv.key"
              type="button" class="rv-vbtn" :class="[vv.key, { on: amendVerdict === vv.key }]"
              @click="amendVerdict = vv.key"
            >{{ vv.label }}</button>
          </div>
          <textarea v-model="amendReason" :maxlength="LIMITS.reviewReason" class="rv-input" rows="2" placeholder="เหตุผล (บังคับเมื่อไม่ผ่าน)"></textarea>
          <input v-model="amendRef" :maxlength="LIMITS.reviewRef" class="rv-input" placeholder="เรฟอ้างอิง (ไม่บังคับ)" />
          <div class="rv-actions">
            <button class="rv-btn rv-gray" :disabled="submitting" @click="amending = false">ยกเลิก</button>
            <button class="rv-btn rv-primary" :disabled="!canAmend || submitting" @click="submitAmend">บันทึกการแก้</button>
          </div>
        </div>
      </div>

      <!-- ── leaderboard ── -->
      <section class="rv-board">
        <div class="rv-board-head"><Emoji char="🏅" /> ใครตรวจไปกี่ข้อ</div>
        <div v-if="!leaderboard.length" class="rv-empty rv-board-empty">ยังไม่มีใครตรวจ</div>
        <ol v-else class="rv-board-list">
          <li v-for="row in leaderboard" :key="row.uid" class="rv-board-row" :class="{ me: row.uid === myUid }">
            <span class="rv-board-name">{{ row.name }}<span v-if="row.uid === myUid" class="rv-you"> (คุณ)</span></span>
            <span class="rv-board-count">{{ row.count }} ข้อ</span>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { collection, getDocs, getDoc, doc, runTransaction, arrayUnion, increment, deleteField, serverTimestamp, query, where, orderBy, startAt, limit } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useUsageStore } from '../stores/usage.js'
import { useToast } from '../composables/useToast.js'
import { cleanText, LIMITS } from '../utils/text.js'
import { domainLabel } from '../data/domains.js'
import { computeStatus, nextReviewQueue, buildLeaderboard, VERDICT_LABEL, pickWeighted } from '../utils/questionReview.js'
import { getCategories, normalizeCategories } from '../utils/questionCategories.js'
import { quizSample } from '../utils/quizSample.js'
import TopicSelect from '../components/questions/TopicSelect.vue'
import { useConfirm } from '../composables/useConfirm.js'

const authStore = useAuthStore()
const usage = useUsageStore()
const { toast } = useToast()
const { confirm } = useConfirm()

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']
const VERDICTS = [
  { key: 'correct', label: '✅ ถูกต้อง' },
  { key: 'fix',     label: '🛠️ ต้องแก้' },
  { key: 'wrong',   label: '❌ ผิด' },
]
const list = ref([])
const loading = ref(false)
const submitting = ref(false)
const skippedIds = ref(new Set())
const verdict = ref(null)
const reason = ref('')
const refText = ref('')
const priorReviews = ref([])
const topics = ref([])        // หมวด/กลุ่มโรคของข้อปัจจุบัน (ตั้งต้นจากของเดิม แก้ได้ระหว่างตรวจ)
const note = ref('')          // หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย) — ต่อเติมจากของเดิมได้
const hadNote = ref(false)    // ข้อนี้มีหมายเหตุจากคนก่อนไหม (ใช้โชว์ป้ายเตือนไม่ให้ลบทิ้ง)

// ข้อที่เพิ่งส่งในเซสชันนี้ — ให้กดแก้ได้ถ้ากดพลาด (หายเมื่อรีโหลดหน้า)
const lastSubmit = ref(null)     // { qid, qhash, verdict, reason, ref, questionText }
const amending = ref(false)      // กำลังเปิดฟอร์มแก้อยู่ไหม
const amendVerdict = ref(null)
const amendReason = ref('')
const amendRef = ref('')

const myUid = computed(() => authStore.currentUser?.uid || null)

const HALF_LIMIT = 200      // ข้อค้าง 1 เสียง + ขัดแย้ง — ดึงมาให้ครบ (ปกติมีไม่เยอะ)
const PENDING_WINDOW = 40   // ข้อที่ยังไม่มีใครตรวจ — สุ่มหน้าต่างเล็กพอ ต้นทุนคงที่

const currentId = ref(null)
// คิวข้อที่ต้องให้ฉันตรวจ ลบข้อที่กด "ข้าม" ในเซสชันนี้
const queue = computed(() =>
  nextReviewQueue(list.value, myUid.value).filter(q => !skippedIds.value.has(q.id)))
// ข้อปัจจุบัน = ข้อที่สุ่มไว้ (ตรึงไว้จนกว่าจะส่ง/ข้าม — ห้ามผูกกับ queue[0] ไม่งั้นข้อจะเด้งเอง)
const current = computed(() => queue.value.find(q => q.id === currentId.value) || null)

// สุ่มข้อถัดไปตามน้ำหนัก: ขัดแย้ง ×8 · ค้าง 1 เสียง ×4 · ยังไม่มีใครตรวจ ×1
function pickNext() {
  const q = pickWeighted(queue.value)
  currentId.value = q ? q.id : null
}
const currentStatus = computed(() => current.value ? computeStatus(current.value) : null)

// ความคืบหน้าทั้งคลัง — มาจากตัวนับใน reviewMeta (ไม่เปลือง read)
// half/conflict เป็นเลขสดจากคิวที่โหลดมาจริงได้ก็จริง แต่ใช้ค่าจาก meta ให้เป็นชุดเดียวกันทั้งแถบ
const progress = computed(() => {
  const p = meta.value.progress || {}
  const num = k => Math.max(0, p[k] || 0)
  const passed = num('passed'), failed = num('failed')
  const half = num('half'), conflict = num('conflict'), pending = num('pending')
  const total = passed + failed + half + conflict + pending
  return { passed, failed, half, conflict, pending, total, pct: total ? Math.round((passed / total) * 100) : 0 }
})
// จำนวนข้อที่ต้องให้ฉันตรวจ "ในคิวรอบนี้" (เท่าที่โหลดมา ไม่ใช่ทั้งคลัง)
const myQueueCount = computed(() => nextReviewQueue(list.value, myUid.value).length)

// เหตุผลบังคับเฉพาะ verdict ที่ไม่ผ่าน — "ถูกต้อง" ไม่ต้องพิมพ์ (ลด friction กันเหตุผลขยะ)
const canSubmit = computed(() => !!verdict.value && (verdict.value === 'correct' || !!reason.value.trim()))

// ตัดโจทย์ให้สั้นไว้โชว์ในแถบ "เพิ่งส่ง" — เติม … เฉพาะตอนตัดจริง กันจุดไข่ปลาโผล่ต่อท้ายข้อความสั้น
function truncate60(text) {
  const t = text || ''
  return t.length > 60 ? t.slice(0, 60) + '…' : t
}

function openAmend() {
  amendVerdict.value = lastSubmit.value?.verdict || null
  amendReason.value = lastSubmit.value?.reason || ''
  amendRef.value = lastSubmit.value?.ref || ''
  amending.value = true
}
// เหตุผลบังคับเฉพาะผลที่ไม่ผ่าน (เหมือนฟอร์มหลัก)
const canAmend = computed(() =>
  !!amendVerdict.value && (amendVerdict.value === 'correct' || !!amendReason.value.trim()))

// leaderboard จาก reviewMeta doc (ตัวนับ + ชื่อ snapshot ตอน submit) — 1 read
// ไม่ต้องอ่านทั้งคลัง/users collection และไม่พึ่ง members store (บางคนไม่มี studentId)
const meta = ref({ counts: {}, names: {} })
const leaderboard = computed(() => buildLeaderboard(meta.value.counts || {}, meta.value.names || {}))

onMounted(() => {
  if (!authStore.isQuestionEditor) return
  load()
})

// โหลดคิว 2 ก้อนแยกกัน — ต้นทุน read คงที่ไม่โตตามขนาดคลัง
//  ก้อน A: ข้อค้าง 1 เสียง + ขัดแย้ง → ดึงมาให้ครบ (นี่คือข้อที่เราอยากเร่งให้จบ)
//  ก้อน B: ข้อที่ยังไม่มีใครตรวจ → สุ่มหน้าต่างด้วย field rand (pattern เดียวกับ QuizView)
//  ข้อเก่าก่อนระบบตรวจไม่มี field reviewStatus จะไม่ติด query —
//  แอดมินต้องกด "🔄 ซิงก์ระบบตรวจ" ในหน้า Admin หนึ่งครั้งก่อนเริ่มใช้
async function load() {
  loading.value = true
  try {
    const col = collection(db, 'questions')
    const R = Math.random()
    const [halfSnap, firstSnap, metaSnap] = await Promise.all([
      getDocs(query(col, where('reviewStatus', 'in', ['half', 'conflict']), limit(HALF_LIMIT))),
      getDocs(query(col, where('reviewStatus', '==', 'pending'), orderBy('rand'), startAt(R), limit(PENDING_WINDOW))),
      getDoc(doc(db, 'reviewMeta', 'main')),
    ])
    let reads = halfSnap.size + firstSnap.size + 1
    // สุ่มไปชนปลายลิสต์ → วนอ่านต้นลิสต์เติมให้เต็มหน้าต่าง
    let wrap = []
    if (firstSnap.size < PENDING_WINDOW) {
      const wrapSnap = await getDocs(query(col, where('reviewStatus', '==', 'pending'), orderBy('rand'), limit(PENDING_WINDOW)))
      wrap = wrapSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      reads += wrapSnap.size
    }
    usage.track(reads)
    const pending = quizSample(firstSnap.docs.map(d => ({ id: d.id, ...d.data() })), wrap, PENDING_WINDOW)
    list.value = [...halfSnap.docs.map(d => ({ id: d.id, ...d.data() })), ...pending]
    if (metaSnap.exists()) meta.value = metaSnap.data()
    pickNext()
  } catch (e) { console.error('[review load]', e); toast('โหลดข้อสอบไม่สำเร็จ', 'error') }
  finally { loading.value = false }
}

// เปลี่ยนข้อปัจจุบัน → ล้างฟอร์ม + โหลดรีวิวเดิมถ้าเป็นข้อ conflict (ให้คนที่ 3 เห็น)
watch(current, async (q) => {
  verdict.value = null; reason.value = ''; refText.value = ''; priorReviews.value = []
  topics.value = getCategories(q)
  note.value = q?.reviewNote || ''
  hadNote.value = !!q?.reviewNote
  if (q && currentStatus.value === 'conflict') {
    try {
      const snap = await getDocs(collection(db, 'questions', q.id, 'reviews'))
      if (current.value?.id !== q.id) return   // เลื่อนข้อไปแล้วระหว่างรอเน็ต — ทิ้งผลชุดนี้ กันโชว์รีวิวผิดข้อ
      usage.track(snap.size)
      // กรองเฉพาะรีวิวของรอบปัจจุบัน — subdoc รอบก่อน reset (แก้เนื้อหาแล้ว) ยังค้างอยู่
      priorReviews.value = snap.docs.filter(d => (q.reviewedBy || []).includes(d.id))
        .map(d => ({ id: d.id, ...d.data() }))
    } catch (e) { console.error('[review priors]', e) }
  }
}, { immediate: true })

function skip() {
  if (!current.value) return
  const next = new Set(skippedIds.value)
  next.add(current.value.id)
  skippedIds.value = next   // Set ใหม่ → computed queue เลื่อนไปข้อถัดไป
  pickNext()
}
function unskipAll() { skippedIds.value = new Set(); pickNext() }

// ขยับตัวนับ progress ในเครื่อง 1 ข้อ จากสถานะเดิมไปสถานะใหม่ — ใช้ร่วมกันทั้ง submit()/submitAmend()
// ไม่เปลี่ยน from ถ้า from === to (คืน clone เฉยๆ) — caller เป็นคนตัดสินใจว่าจะเรียกเมื่อไหร่
function bumpedProgress(from, to) {
  const p = { ...(meta.value.progress || {}) }
  if (from !== to) {
    p[from] = Math.max(0, (p[from] || 0) - 1)
    p[to] = (p[to] || 0) + 1
  }
  return p
}

async function submit() {
  if (!canSubmit.value || submitting.value || !current.value || !myUid.value) return
  const lbl = VERDICT_LABEL[verdict.value] || verdict.value
  if (!(await confirm(`ยืนยันส่งผลตรวจ: "${lbl}"?\nส่งแล้วยังกดแก้ได้จากแถบด้านล่างก่อนออกจากหน้านี้`))) return
  submitting.value = true
  const q = current.value
  const uid = myUid.value
  const u = authStore.userData || {}
  const reviewerName = cleanText(u.realName || u.nickname || u.name || 'ไม่ระบุ', LIMITS.reviewerName)   // snapshot ชื่อจริง
  const v = verdict.value
  const isPass = v === 'correct'
  let newPass = 0, newFail = 0, newStatus = 'pending', already = false
  let wasResolved = false      // ข้อปิดไปแล้วตอนเราส่ง = เราเป็นเสียงที่ 3
  let oldStatusLocal = 'pending'   // สถานะก่อนหน้า — Task 13 ใช้ขยับแถบความคืบหน้าในเครื่อง
  let committedCats = null, committedNote = null   // ค่าที่ "เขียนจริง" ไปยัง Firestore รอบที่ commit สำเร็จ — ใช้ sync local ให้ตรงเป๊ะ
  try {
    // transaction: อ่านค่าสดก่อนคำนวณ → reviewStatus บน doc เชื่อถือได้แม้ 2 คนส่งพร้อมกัน
    // (จำเป็น เพราะ load() query จาก reviewStatus ตรงๆ — ถ้าค่าเพี้ยนข้อจะหลุดคิวถาวร)
    await runTransaction(db, async (tx) => {
      already = false
      oldStatusLocal = 'pending'   // reset ทุกรอบที่ callback รัน กันค่าเก่าจากรอบก่อนหน้าค้าง (ทรานแซกชันรีทรายได้)
      const qRef = doc(db, 'questions', q.id)
      const snap = await tx.get(qRef)
      if (!snap.exists()) { already = true; return }   // ข้อถูกลบระหว่างตรวจ
      const cur = snap.data()
      // ข้อถูกแก้เนื้อหาไประหว่างเราดูอยู่ (qhash เปลี่ยน) — verdict เราตัดสินจากเวอร์ชันเก่า ห้ามนับ
      if ((cur.qhash || null) !== (q.qhash || null)) throw new Error('__stale')
      if ((cur.reviewedBy || []).includes(uid)) { already = true; return }   // เคยส่งไปแล้ว (เช่น จากอีกเครื่อง)
      const oldStatus = computeStatus(cur)
      oldStatusLocal = oldStatus
      newPass = (cur.reviewPass || 0) + (isPass ? 1 : 0)
      newFail = (cur.reviewFail || 0) + (isPass ? 0 : 1)
      newStatus = computeStatus({ reviewPass: newPass, reviewFail: newFail })
      wasResolved = oldStatus === 'passed' || oldStatus === 'failed'   // ข้อปิดไปแล้ว = เราเป็นเสียงที่ 3
      // 1) รายละเอียดเต็มใน subcollection (doc id = uid → กันตรวจซ้ำ)
      tx.set(doc(db, 'questions', q.id, 'reviews', uid), {
        reviewerUid: uid,
        reviewerName,
        verdict: v,
        reason: cleanText(reason.value, LIMITS.reviewReason),
        ref: cleanText(refText.value, LIMITS.reviewRef),
        ts: serverTimestamp(),
      })
      // 2) aggregate บนข้อ — ห้ามใส่ field นอก reviewSubmitKeys (rules ใช้ hasOnly จะปฏิเสธทั้งก้อน)
      const qPatch = {
        reviewedBy: arrayUnion(uid),
        reviewPass: newPass,
        reviewFail: newFail,
        reviewStatus: newStatus,
        reviewVerdicts: deleteField(),   // ล้าง map โครงเก่า (ถ้ามี)
      }
      const newCats = normalizeCategories(topics.value)
      if (JSON.stringify(newCats) !== JSON.stringify(getCategories(cur))) qPatch.categories = newCats
      const newNote = cleanText(note.value, LIMITS.reviewNote)
      const baseNote = cleanText(q.reviewNote || '', LIMITS.reviewNote)   // ค่าที่เราโหลดมาเห็นตอนเปิดข้อ
      if (newNote !== baseNote) {
        // ล้างช่องทิ้ง = ลบโน้ตจริง แต่ถ้ามีคนเพิ่งเขียนโน้ตใหม่หลังเราโหลด (cur ต่างจาก baseline ที่เราเห็น) อย่าลบของเขา
        if (newNote || baseNote === (cur.reviewNote || '')) qPatch.reviewNote = newNote || null
      }
      // เก็บค่าที่ "เขียนจริง" ไว้ sync local ทีหลัง — ถ้า key ไหนไม่ได้แตะ ให้ยึดค่าปัจจุบันบน doc (cur) แทน กันจอเพี้ยนจากเซิร์ฟเวอร์
      committedCats = 'categories' in qPatch ? newCats : getCategories(cur)
      committedNote = 'reviewNote' in qPatch ? qPatch.reviewNote : (cur.reviewNote || null)
      tx.update(qRef, qPatch)
      // 3) ตัวนับ leaderboard + ชื่อ snapshot + ความคืบหน้าคลัง (collection แยก นักศึกษาอ่านไม่ได้)
      const metaPatch = { counts: { [uid]: increment(1) }, names: { [uid]: reviewerName } }
      // สถานะไม่เปลี่ยน (เช่น passed 2-0 + เสียงที่ 3) = ไม่ต้องขยับแถบ — และห้ามส่ง progress: {} เข้าไป
      // เพราะ tx.set(merge) เจอ empty map จะดันเข้า field mask ทำให้ progress ทั้งก้อนถูกล้างทิ้ง (ไม่ใช่ "เว้นไว้เฉยๆ")
      // (ต้องไม่ใส่ increment ซ้ำ key เดียวกันในก้อนเดียว ไม่งั้นตัวหลังทับตัวแรก = ตัวเลขเพี้ยน — เคสนี้ oldStatus !== newStatus เสมอเมื่อเข้าเงื่อนไข)
      if (oldStatus !== newStatus) {
        metaPatch.progress = { [oldStatus]: increment(-1), [newStatus]: increment(1) }
      }
      tx.set(doc(db, 'reviewMeta', 'main'), metaPatch, { merge: true })
    })
    usage.track(1, already ? 0 : 3)
    // อัปเดต local ให้คิว/leaderboard เลื่อนทันที (ไม่ reload) — ใช้ค่าที่ "เขียนจริง" เป๊ะ ไม่คำนวณซ้ำจากฟอร์ม
    const idx = list.value.findIndex(x => x.id === q.id)
    if (idx >= 0) {
      const patch = already ? {} : {
        reviewPass: newPass, reviewFail: newFail, reviewStatus: newStatus,
        categories: committedCats,
        reviewNote: committedNote,
      }
      list.value[idx] = { ...q, reviewedBy: [...(q.reviewedBy || []), uid], ...patch }
    }
    if (!already) {
      meta.value = {
        counts: { ...(meta.value.counts || {}), [uid]: ((meta.value.counts || {})[uid] || 0) + 1 },
        names: { ...(meta.value.names || {}), [uid]: reviewerName },
        progress: bumpedProgress(oldStatusLocal, newStatus),
      }
      lastSubmit.value = {
        qid: q.id, qhash: q.qhash || null, verdict: v,
        reason: reason.value, ref: refText.value,
        questionText: truncate60(q.question),
      }
      // ข้อใหม่แล้ว — ปิดฟอร์มแก้ที่อาจค้างเปิดจากข้อก่อนหน้า กันเผลอบันทึกเวอร์ดิกต์เก่าทับข้อใหม่
      amending.value = false
      amendVerdict.value = null; amendReason.value = ''; amendRef.value = ''
    }
    if (already) {
      toast('คุณตรวจข้อนี้ไปแล้ว', 'info')
    } else if (wasResolved) {
      toast('มีคนตรวจข้อนี้พร้อมกัน — นับเสียงคุณเป็นเสียงที่ 3 ด้วยแล้ว', 'success')
    } else {
      toast('ส่งผลตรวจแล้ว ขอบคุณ!', 'success')
    }
    pickNext()
  } catch (e) {
    if (e.message === '__stale') {
      toast('ข้อนี้เพิ่งถูกแก้เนื้อหา — โหลดคิวใหม่ให้แล้ว', 'error')
      load()
    } else { console.error('[review submit]', e); toast('ส่งไม่สำเร็จ', 'error') }
  } finally { submitting.value = false }
}

// แก้ผลตรวจของตัวเอง — ย้ายเสียงข้ามฝั่ง เสียงรวมเท่าเดิม (rules: isReviewAmend)
async function submitAmend() {
  const ls = lastSubmit.value
  if (!canAmend.value || submitting.value || !ls || !myUid.value) return
  if (!(await confirm(`แก้ผลตรวจเป็น "${VERDICT_LABEL[amendVerdict.value]}"?`))) return
  submitting.value = true
  const uid = myUid.value
  const v = amendVerdict.value
  const isPass = v === 'correct'
  // จับค่าฟอร์ม ณ ตอนกดยืนยัน — กันกรณีพิมพ์ต่อระหว่างรอเน็ต แล้ว "เพิ่งส่ง" ในเครื่องเพี้ยนไปจากที่เซิร์ฟเวอร์ได้จริง
  const committedReason = cleanText(amendReason.value, LIMITS.reviewReason)
  const committedRef = cleanText(amendRef.value, LIMITS.reviewRef)
  // ค่าที่ transaction คำนวณ ไว้ใช้ sync local หลังสำเร็จ — ต้อง reset ทุกรอบ callback รัน (ทรานแซกชันรีทรายได้)
  let newPass = 0, newFail = 0, newStatus = 'pending', oldStatus = 'pending'
  try {
    await runTransaction(db, async (tx) => {
      const qRef = doc(db, 'questions', ls.qid)
      const snap = await tx.get(qRef)
      if (!snap.exists()) throw new Error('__gone')
      const cur = snap.data()
      if ((cur.qhash || null) !== (ls.qhash || null)) throw new Error('__stale')
      if (!(cur.reviewedBy || []).includes(uid)) throw new Error('__gone')
      const revRef = doc(db, 'questions', ls.qid, 'reviews', uid)
      const revSnap = await tx.get(revRef)
      const oldVerdict = revSnap.exists() ? revSnap.data().verdict : ls.verdict
      const oldIsPass = oldVerdict === 'correct'
      oldStatus = computeStatus(cur)
      newPass = (cur.reviewPass || 0) - (oldIsPass ? 1 : 0) + (isPass ? 1 : 0)
      newFail = (cur.reviewFail || 0) - (oldIsPass ? 0 : 1) + (isPass ? 0 : 1)
      newStatus = computeStatus({ reviewPass: newPass, reviewFail: newFail })
      tx.set(revRef, {
        reviewerUid: uid,
        reviewerName: revSnap.data()?.reviewerName ?? null,
        verdict: v,
        reason: committedReason,
        ref: committedRef,
        ts: serverTimestamp(),
      })
      tx.update(qRef, { reviewPass: newPass, reviewFail: newFail, reviewStatus: newStatus })
      // counts ไม่แตะ — ไม่ใช่การตรวจข้อใหม่ · progress ขยับเฉพาะเมื่อสถานะเปลี่ยนจริง
      if (oldStatus !== newStatus) {
        tx.set(doc(db, 'reviewMeta', 'main'),
          { progress: { [oldStatus]: increment(-1), [newStatus]: increment(1) } }, { merge: true })
      }
    })
    // 2 อ่านเสมอ (question + review เดิม) · เขียน 2 หรือ 3 แล้วแต่ว่าสถานะขยับหรือเปล่า (ข้าม reviewMeta ถ้าไม่ขยับ)
    usage.track(2, oldStatus !== newStatus ? 3 : 2)
    toast('แก้ผลตรวจแล้ว', 'success')
    // sync local ให้ตรงเซิร์ฟเวอร์ — กันป้าย "ขัดแย้ง" บนแถบสรุปคิวค้างเลขเก่าถ้าข้อนี้ยังอยู่ใน list ระหว่างเซสชัน
    const idx = list.value.findIndex(x => x.id === ls.qid)
    if (idx >= 0) list.value[idx] = { ...list.value[idx], reviewPass: newPass, reviewFail: newFail, reviewStatus: newStatus }
    // แถบความคืบหน้า (Task 13) ต้องขยับด้วย — เซิร์ฟเวอร์อัปเดต progress เฉพาะตอนสถานะเปลี่ยนจริง (ดูเงื่อนไขใน transaction ด้านบน) ต้องเช็กเงื่อนไขเดียวกัน
    if (oldStatus !== newStatus) {
      meta.value = { ...meta.value, progress: bumpedProgress(oldStatus, newStatus) }
    }
    lastSubmit.value = { ...ls, verdict: v, reason: committedReason, ref: committedRef }
    amending.value = false
  } catch (e) {
    // __stale/__gone = แก้ไม่ได้แล้วจริงๆ (เนื้อหาเปลี่ยน/ผลตรวจถูกล้าง) → ปิดแถบ + โหลดคิวใหม่กันสถานะเครื่องค้าง
    // (list.value[idx] ยังมี uid ใน reviewedBy จาก submit() เดิม ทั้งที่เซิร์ฟเวอร์ไม่นับเสียงนี้แล้ว — ต้อง reload ให้ตรง)
    // ข้อผิดพลาดชั่วคราว (เน็ตหลุด/permission เด้งแป๊บเดียว) ต้อง "ไม่" ล้างแถบ — ไม่งั้นกดพลาดแล้วต้องไปตามแอดมิน ผิดจุดประสงค์ฟีเจอร์นี้
    if (e.message === '__stale') {
      toast('ข้อนี้เพิ่งถูกแก้เนื้อหา — แก้ผลตรวจไม่ได้แล้ว', 'error')
      lastSubmit.value = null
      load()
    } else if (e.message === '__gone') {
      toast('ข้อนี้หรือผลตรวจของคุณไม่อยู่แล้ว — แก้ไม่ได้', 'error')
      lastSubmit.value = null
      load()
    } else {
      console.error('[review amend]', e)
      toast('แก้ไม่สำเร็จ — ลองอีกครั้ง', 'error')
    }
  } finally { submitting.value = false }
}
</script>

<style scoped>
.rv-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.rv-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.rv-back { font-size: .72rem; font-weight: 700; color: #4f46e5; text-decoration: none; }
.rv-denied, .rv-empty { text-align: center; color: rgba(0,0,0,.4); padding: 26px 0; font-size: .85rem; }
.rv-done { color: #15803d; font-weight: 700; }

.rv-summary { font-size: .76rem; color: var(--ink); background: var(--primary-light, #eef2ff); border-radius: 10px; padding: 9px 12px; margin-bottom: 12px; line-height: 1.5; }
.rv-summary b { font-weight: 800; }
.rv-sum-line { line-height: 1.5; }
.rv-bar { height: 7px; border-radius: 999px; background: rgba(0,0,0,.09); overflow: hidden; margin: 8px 0 6px; }
.rv-bar-fill { height: 100%; background: #22c55e; border-radius: 999px; transition: width .3s; }
.rv-sum-mine { font-size: .7rem; color: rgba(0,0,0,.5); }

.rv-card { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 14px; margin-bottom: 16px; }
.rv-card-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 9px; }
.rv-cat { font-size: .7rem; color: #4f46e5; font-weight: 700; }
.rv-cat-sub { color: rgba(0,0,0,.45); }
.rv-draft { font-size: .7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,.07); color: rgba(0,0,0,.5); }
.rv-conflict-badge { font-size: .7rem; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: #fff7ed; color: #c2410c; }
.rv-q { font-size: .92rem; font-weight: 700; color: var(--ink); line-height: 1.5; margin-bottom: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.rv-choices { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.rv-choices li { font-size: .8rem; color: rgba(0,0,0,.65); display: flex; gap: 8px; align-items: baseline; padding: 7px 10px; border-radius: 9px; background: #f8fafc; }
.rv-choices li.correct { background: rgba(34,197,94,.12); color: #15803d; font-weight: 700; }
.rv-c-letter { font-weight: 800; flex-shrink: 0; }
.rv-c-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.rv-c-mark { flex-shrink: 0; font-size: .7rem; font-weight: 800; color: #15803d; }
.rv-exp { margin-top: 9px; font-size: .74rem; color: #b45309; background: #fffbeb; border-radius: 8px; padding: 8px 10px; line-height: 1.45; }

.rv-priors { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 11px; }
.rv-priors-head { font-size: .7rem; font-weight: 800; color: #c2410c; margin-bottom: 7px; }
.rv-prior { background: #fffdf7; border: 1px solid rgba(0,0,0,.08); border-radius: 10px; padding: 9px 11px; margin-bottom: 7px; }
.rv-prior-top { display: flex; align-items: center; gap: 8px; font-size: .78rem; margin-bottom: 4px; }
.rv-prior-verdict { font-size: .7rem; font-weight: 800; padding: 1px 7px; border-radius: 999px; }
.rv-prior-verdict.correct { background: rgba(34,197,94,.15); color: #15803d; }
.rv-prior-verdict.fix { background: rgba(245,158,11,.16); color: #b45309; }
.rv-prior-verdict.wrong { background: rgba(239,68,68,.12); color: #dc2626; }
.rv-prior-reason { font-size: .76rem; color: rgba(0,0,0,.7); line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.rv-prior-ref { font-size: .7rem; color: rgba(0,0,0,.45); margin-top: 3px; overflow-wrap: anywhere; }

.rv-form { margin-top: 13px; border-top: 1px dashed var(--border); padding-top: 12px; }
.rv-verdicts { display: flex; gap: 7px; margin-bottom: 11px; }
.rv-vbtn { flex: 1; border: 2px solid var(--ink); border-radius: 11px; padding: 10px 6px; font-family: inherit; font-size: .78rem; font-weight: 800; background: #fff; color: var(--ink); cursor: pointer; transition: transform .1s; }
.rv-vbtn:active { transform: translate(1px,1px); }
.rv-vbtn.correct.on { background: #22c55e; border-color: #22c55e; color: #fff; }
.rv-vbtn.fix.on { background: #f59e0b; border-color: #f59e0b; color: #fff; }
.rv-vbtn.wrong.on { background: #ef4444; border-color: #ef4444; color: #fff; }
.rv-label { display: block; font-size: .7rem; font-weight: 700; color: #64748b; margin: 9px 0 5px; }
.rv-note-hint { display: block; font-weight: 700; color: #b45309; font-size: .7rem; margin-top: 2px; }
.rv-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; resize: vertical; }
.rv-input:focus { outline: none; box-shadow: var(--pop); }
.rv-actions { display: flex; gap: 8px; margin-top: 13px; }
.rv-btn { flex: 1; border: 2px solid var(--ink); border-radius: 11px; padding: 11px; font-family: inherit; font-size: .85rem; font-weight: 800; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.rv-primary { background: var(--primary); color: #fff; box-shadow: var(--pop); }
.rv-primary:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.rv-primary:disabled { background: #cbd5e1; cursor: default; box-shadow: none; }
.rv-gray { background: #fff; color: var(--ink); flex: 0 0 110px; }
.rv-unskip { flex: none; display: block; margin: 12px auto 0; padding: 9px 18px; font-size: .78rem; }

.rv-last { background: #fffdf7; border: 2px dashed rgba(0,0,0,.18); border-radius: 14px; padding: 11px 13px; margin-bottom: 16px; }
.rv-last-top { display: flex; align-items: center; gap: 10px; justify-content: space-between; font-size: .76rem; color: rgba(0,0,0,.65); line-height: 1.4; }
.rv-mini { flex-shrink: 0; border: 2px solid var(--ink); border-radius: 9px; padding: 5px 11px; font-family: inherit; font-size: .72rem; font-weight: 800; background: #fff; color: var(--ink); cursor: pointer; }
.rv-last-form { margin-top: 10px; }
.rv-last-form .rv-input { margin-bottom: 6px; }

.rv-board { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 14px; }
.rv-board-head { font-weight: 800; font-size: .9rem; margin-bottom: 10px; }
.rv-board-empty { padding: 14px 0; }
.rv-board-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; counter-reset: rank; }
.rv-board-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; border-radius: 9px; font-size: .82rem; }
.rv-board-row::before { counter-increment: rank; content: counter(rank); flex-shrink: 0; width: 20px; font-weight: 800; color: rgba(0,0,0,.35); font-size: .72rem; }
.rv-board-row.me { background: var(--primary-light, #eef2ff); }
.rv-board-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.rv-you { color: #4f46e5; font-weight: 800; }
.rv-board-count { flex-shrink: 0; font-weight: 800; color: var(--ink); font-size: .78rem; }
</style>
