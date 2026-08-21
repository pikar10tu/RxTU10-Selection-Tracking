// รายชื่อหมวด/หัวข้อข้อสอบ (config/topics.list) — ทะเบียนกลางที่ dropdown TopicSelect อ่าน
// วิชาการเพิ่มหัวข้อใหม่ได้จาก TopicSelect — เก็บกลางใช้ร่วมหน้า Questions/Review
// ⚠️ ทะเบียนนี้ต้องรู้จัก "ทุกหมวดที่มีอยู่จริงบนข้อ" ไม่ใช่แค่ที่คนพิมพ์เพิ่มเอง —
//    หมวดที่มากับ bulk import เคยไม่ถูกลงทะเบียน ทำให้คนตรวจข้ออื่นเลือกหมวดนั้นไม่ได้
//    → ทุกทางที่เขียนหมวดลงข้อเรียก addTopics() ตามด้วยเสมอ (ดู unregisteredTopics)
import { ref } from 'vue'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useUsageStore } from '../stores/usage.js'
import { cleanText, LIMITS } from '../utils/text.js'
import { unregisteredTopics } from '../utils/questionCategories.js'

const topics = ref([])
let inflight = null    // getDoc ที่ค้างอยู่ — ผู้เรียกพร้อมกันรอก้อนเดียวกัน (ไม่งั้นเห็น list ว่างแล้วเขียนซ้ำ)
let loadedAt = 0       // เวลาที่โหลดสำเร็จล่าสุด (0 = ยังไม่เคย)
const TTL = 120000     // 2 นาที — เพื่อนเพิ่มหัวข้อใหม่ระหว่างที่เราเปิดจอค้างไว้ ต้องเห็นตามโดยไม่ต้องรีโหลด

export function useTopics() {
  const usage = useUsageStore()

  async function loadTopics(force = false) {
    if (!force && loadedAt && Date.now() - loadedAt < TTL) return
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'topics'))
        usage.track(1)
        if (snap.exists()) topics.value = snap.data().list || []
        loadedAt = Date.now()
      } catch (e) { console.error('[topics]', e) }
      finally { inflight = null }
    })()
    return inflight
  }

  // ลงทะเบียนหลายหัวข้อพร้อมกัน — เขียนเฉพาะชื่อที่ยังไม่มีในทะเบียน (ไม่มีของใหม่ = ไม่เขียนเลย)
  // คืน array ชื่อที่เพิ่งเพิ่มจริง · ผู้เรียกควรครอบ try/catch เอง (ล้มแล้วห้ามล้มงานหลัก)
  async function addTopics(names) {
    await loadTopics()
    const fresh = unregisteredTopics(topics.value, names)
    if (!fresh.length) return []
    await setDoc(doc(db, 'config', 'topics'), { list: arrayUnion(...fresh) }, { merge: true })
    usage.track(0, 1)
    topics.value = [...topics.value, ...fresh]
    return fresh
  }

  // ถอดหัวข้อออกจากทะเบียน — ใช้ตอนรวมหมวด (ต้นทางหมดข้อแล้ว) และตอนลบหมวดร้าง
  // ไม่แตะข้อสอบเลย · ผู้เรียกต้องมั่นใจก่อนว่าไม่มีข้อไหนติดหมวดนี้อยู่
  async function removeTopics(names) {
    const gone = [...new Set((Array.isArray(names) ? names : [])
      .map(n => (n || '').trim()).filter(Boolean))]
    if (!gone.length) return []
    await updateDoc(doc(db, 'config', 'topics'), { list: arrayRemove(...gone) })
    usage.track(0, 1)
    topics.value = topics.value.filter(t => !gone.includes(t))
    return gone
  }

  // เพิ่มหัวข้อเดียวจากช่องพิมพ์ — คืนชื่อที่ clean แล้ว (null ถ้าว่าง) · ชื่อซ้ำไม่เขียนซ้ำ
  async function addTopic(name) {
    const clean = cleanText(name, LIMITS.category)
    if (!clean) return null
    await addTopics([clean])
    return clean
  }

  return { topics, loadTopics, addTopic, addTopics, removeTopics }
}
