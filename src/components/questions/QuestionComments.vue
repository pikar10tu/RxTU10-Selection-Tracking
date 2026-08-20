<template>
  <div class="qc">
    <div v-if="loading" class="qc-empty">กำลังโหลด…</div>
    <template v-else>
      <ul v-if="comments.length" class="qc-list">
        <li v-for="c in comments" :key="c.id" class="qc-item">
          <div class="qc-meta">
            <span class="qc-author">{{ c.authorName }}</span>
            <span class="qc-role">{{ roleIcon(c.authorRole) }}</span>
            <span class="qc-time">{{ fmtTime(c.createdAt) }}</span>
            <button v-if="c.authorUid === uid" class="qc-del" title="ลบคอมเมนต์" @click="removeComment(c)">✕</button>
          </div>
          <div class="qc-text">{{ c.text }}</div>
        </li>
      </ul>
      <div v-else class="qc-empty">ยังไม่มีคอมเมนต์ — เริ่มสนทนาได้เลย</div>
    </template>
    <div class="qc-form">
      <textarea v-model="draft" :maxlength="LIMITS.comment" rows="2" class="qc-input" placeholder="พิมพ์คอมเมนต์ถึงทีม…"></textarea>
      <button class="qc-send" :disabled="sending || !draft.trim()" @click="send">ส่ง</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useAuthStore } from '../../stores/auth.js'
import { useToast } from '../../composables/useToast.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { LIMITS } from '../../utils/text.js'
import { buildComment, sortComments } from '../../utils/questionComments.js'

const props = defineProps({ questionId: { type: String, required: true } })
const authStore = useAuthStore()
const { toast } = useToast()
const { confirm } = useConfirm()

const comments = ref([])
const loading = ref(true)
const sending = ref(false)
const draft = ref('')
const uid = computed(() => authStore.currentUser?.uid)

const colRef = () => collection(db, 'questions', props.questionId, 'comments')

async function load() {
  loading.value = true
  try {
    const snap = await getDocs(query(colRef(), orderBy('createdAt', 'asc')))
    comments.value = sortComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  } catch (e) {
    console.error('[comments load]', e); toast('โหลดคอมเมนต์ไม่สำเร็จ', 'error')
  } finally { loading.value = false }
}

async function send() {
  const payload = buildComment({
    text: draft.value, uid: uid.value,
    name: authStore.userData?.nickname,
    role: authStore.userData?.role || 'student',
  })
  if (!payload) return
  sending.value = true
  try {
    const added = await addDoc(colRef(), { ...payload, createdAt: serverTimestamp() })
    comments.value.push({ id: added.id, ...payload, createdAt: Date.now() })
    draft.value = ''
  } catch (e) {
    console.error('[comment send]', e); toast('ส่งคอมเมนต์ไม่สำเร็จ', 'error')
  } finally { sending.value = false }
}

async function removeComment(c) {
  if (!(await confirm('ลบคอมเมนต์นี้?'))) return
  try {
    await deleteDoc(doc(db, 'questions', props.questionId, 'comments', c.id))
    comments.value = comments.value.filter(x => x.id !== c.id)
  } catch (e) { console.error('[comment del]', e); toast('ลบไม่สำเร็จ', 'error') }
}

function roleIcon(r) {
  return r === 'admin' ? '👑' : r === 'academic' ? '🎓' : r === 'instructor' ? '🩺' : ''
}
function fmtTime(t) {
  const ms = (t && t.seconds) ? t.seconds * 1000 : (typeof t === 'number' ? t : null)
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

onMounted(load)
</script>

<style scoped>
.qc { margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; }
.qc-list { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 0 0 8px; padding: 0; }
.qc-item { background: rgba(0,0,0,.03); border-radius: 10px; padding: 7px 9px; }
.qc-meta { display: flex; align-items: center; gap: 6px; font-size: .7rem; color: var(--muted); }
.qc-author { font-weight: 800; color: var(--ink); }
.qc-time { margin-left: auto; }
.qc-del { border: none; background: none; cursor: pointer; color: var(--muted); font-size: .72rem; padding: 0 2px; }
.qc-text { font-size: .8rem; margin-top: 3px; white-space: pre-wrap; word-break: break-word; }
.qc-empty { font-size: .72rem; color: var(--muted); padding: 6px 0; }
.qc-form { display: flex; gap: 6px; align-items: flex-end; }
.qc-input { flex: 1; resize: vertical; border: 1.5px solid var(--border); border-radius: 10px; padding: 6px 8px; font: inherit; font-size: .8rem; }
.qc-send { flex-shrink: 0; border: none; background: var(--primary); color: #fff; font-weight: 700; border-radius: 10px; padding: 8px 14px; cursor: pointer; font-size: .78rem; }
.qc-send:disabled { opacity: .5; }
</style>
