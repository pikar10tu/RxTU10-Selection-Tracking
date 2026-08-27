/**
 * ดึงโจทย์สุ่มจากคลัง — ใช้ร่วมโดย QuizView (ทั่วไป/Zen) และ TimeAttackView
 *
 * วิธีสุ่ม: ทุกข้อมีฟิลด์ `rand` (0..1) → เปิดหน้าต่างที่ `startAt(Math.random())`
 * ถ้าได้ไม่ครบ (ชนปลายช่วง) ค่อยวนกลับไปดึงจากต้นแล้วผสมด้วย `quizSample`
 * ⇒ ไม่ต้องอ่านคลังทั้งก้อน · 1 query = n reads
 *
 * ⚠️ ต้องมี composite index: isPublished + rand (และ isPublished + examSets CONTAINS + rand)
 */
import { collection, getDocs, query, where, orderBy, startAt, limit } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useUsageStore } from '../stores/usage.js'
import { quizSample } from '../utils/quizSample.js'

export function useQuestionFeed() {
  const usage = useUsageStore()

  /**
   * @param n       จำนวนข้อที่ขอ (ได้จริงอาจน้อยกว่าถ้าคลัง/หมวดมีไม่พอ)
   * @param domain  '__all' = ทุกหมวด
   * @param examSet ชื่อชุดย้อนหลัง (สลับกับ domain — ใส่แล้ว domain ถูกมองข้าม)
   */
  async function fetchQuestions(n, { domain = '__all', examSet = null } = {}) {
    const R = Math.random()
    const base = [where('isPublished', '==', true)]
    // ชุดย้อนหลังมาก่อน (สลับกับหมวด) — ใช้ composite index isPublished+examSets(CONTAINS)+rand
    if (examSet) base.push(where('examSets', 'array-contains', examSet))
    else if (domain && domain !== '__all') base.push(where('domain', '==', domain))
    const col = collection(db, 'questions')
    const firstSnap = await getDocs(query(col, ...base, orderBy('rand'), startAt(R), limit(n)))
    usage.track(firstSnap.size)
    const first = firstSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    let wrap = []
    if (first.length < n) {
      const wrapSnap = await getDocs(query(col, ...base, orderBy('rand'), limit(n)))
      usage.track(wrapSnap.size)
      wrap = wrapSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    }
    return quizSample(first, wrap, n).filter(q => Array.isArray(q.choices) && q.choices.length >= 2)
  }

  return { fetchQuestions }
}
