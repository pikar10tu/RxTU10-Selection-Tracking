import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useUsageStore } from '../stores/usage.js'
import { buildRosterRow, rosterRowChanged } from '../utils/roster.js'
import { pushHistory } from '../utils/pvpHistory.js'
import { pushEvent } from '../utils/newsFeed.js'

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

  /**
   * @param opts.history รายการประวัติบุก 1 รายการ ({u,w,c,t}) หรือ null
   *        — พ่วงไปกับ write ที่เกิดหลังไฟต์อยู่แล้ว (เรตเปลี่ยน) ⇒ ไม่มี write เพิ่ม
   * @param opts.event ข่าวกระดาน 1 รายการ ({k,v,g?,t}) หรือ null (ดู utils/newsFeed.js)
   *        — พ่วงไปกับ write ที่เกิดอยู่แล้วเช่นกัน ⇒ ข่าวหอคอย/สนาม/บ้าน/เพ็ท/มินิเกม ไม่มี write เพิ่ม
   */
  async function syncRosterRow({ history = null, event = null } = {}) {
    const uid = auth.currentUser?.uid
    const u = auth.userData
    if (!uid || !u) return
    if (!u.studentId && !u.nickname) return       // ตรรกะเดียวกับตอนสร้าง roster
    if (members.rosterMissing) return              // ยังไม่มี doc — รอแอดมินกดสร้างก่อน

    const prev = members.rosterRows?.[uid]
    const next = buildRosterRow({ ...u, uid }, prev)   // prev = พ่วง h เดิมไว้ ไม่ให้ถูกล้างทุกครั้งที่ sync
    if (history) next.h = pushHistory(prev?.h, history)
    if (event) next.ev = pushEvent(prev?.ev, event)
    if (!rosterRowChanged(prev, next)) return

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
