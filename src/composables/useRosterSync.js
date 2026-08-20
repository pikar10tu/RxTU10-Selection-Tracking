import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useUsageStore } from '../stores/usage.js'
import { buildRosterRow, rosterRowChanged } from '../utils/roster.js'

/**
 * เขียนแถวของตัวเองลง `roster/current` — **จุดเดียว**ที่ฝั่งนักศึกษาเขียน doc นี้
 *
 * เรียกหลังกิจกรรมที่ทำให้สถิติบนบอร์ดเปลี่ยน (จบมินิเกม/หอคอย/PvP/อัปบ้าน/
 * เปลี่ยนชื่อ-รูป-ทีมเพ็ท) — ภายในเทียบกับแถวเดิมก่อน **ไม่เปลี่ยน = ไม่ยิง Firestore**
 * (ทำ 2048 ได้ 9 คะแนนไม่ถึง best เดิม → เงียบ)
 *
 * ล้มเหลว = เงียบ (`console.warn`) ไม่ toast ไม่ retry — doc นี้รับได้ ~1 เขียน/วินาที
 * ถ้าชนกันตอนทั้งชั้นเล่นพร้อมกัน สถิติพลาดรอบเดียวไม่กระทบการเล่น รอบหน้าเขียนทับเอง
 *
 * ⚠️ เขียนด้วย dot-notation `rows.<uid>` เท่านั้น — setDoc ทั้งก้อนจะลบแถวคนอื่น
 * และ rules (`affectedKeys().hasOnly([uid])`) จะปฏิเสธอยู่ดี
 */
export function useRosterSync() {
  const auth = useAuthStore()
  const members = useMembersStore()

  async function syncRosterRow() {
    const uid = auth.currentUser?.uid
    const u = auth.userData
    if (!uid || !u) return
    if (!u.studentId && !u.nickname) return       // ตรรกะเดียวกับตอนสร้าง roster
    if (members.rosterMissing) return              // ยังไม่มี doc — รอแอดมินกดสร้างก่อน

    const next = buildRosterRow({ ...u, uid })
    if (!rosterRowChanged(members.rosterRows?.[uid], next)) return

    try {
      await updateDoc(doc(db, 'roster', 'current'), {
        [`rows.${uid}`]: next,
        updatedAt: serverTimestamp(),
      })
      useUsageStore().track(0, 1)
      members.rosterRows = { ...members.rosterRows, [uid]: next }   // กันเขียนซ้ำในเซสชันเดียว
    } catch (e) {
      console.warn('[roster sync]', e?.code || e)
    }
  }

  return { syncRosterRow }
}
