// arenaRivals — pure: จัดอันดับแต้มประลองของทั้งรุ่น (การ์ด "อันดับในรุ่น" หน้าสนามประลอง)
//
// โครงตาม towerRivals.js แต่กรองด้วย "เคยลงสนามจริง" (ชนะ+แพ้ > 0) แทน towerBest >= 1
// เพราะทุกคนใน roster มีเรตเริ่มต้น 1000 เท่ากันหมด ⇒ ไม่กรอง = กระดานเป็นแถว 1000 ยาวเหยียด
// ⚠️ ไม่มี Firestore read เพิ่ม — คำนวณจาก rosterRows ที่หน้าสนามโหลดไว้แล้ว 1 read
//
// เทส: node --test src/utils/arenaRivals.test.js

/** จำนวนแถวเหนือ/ใต้ตัวเราในหน้าต่าง around */
export const AROUND_RADIUS = 2
/** จำนวนแถวหัวตารางที่การ์ดโชว์เสมอ — มากกว่าหอคอย (3) เพราะการ์ดนี้มีที่ว่างพอ */
export const TOP_COUNT = 10

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const fights = (u) => num(u?.wins) + num(u?.losses)

/**
 * @param {Array<{uid,nickname,rating,wins,losses}>} others  จาก rosterRows (ไม่รวมตัวเรา)
 * @param {{uid,nickname,rating,wins,losses}} me             ค่าสดจาก useArena (soft-reset แล้ว)
 * @returns {{top,around,all,myRank,total,chaseName,chaseGap}}
 *          แถว = { uid, nickname, rating, wins, losses, rank, isMe }
 */
export function arenaRanking(others, me) {
  const map = new Map()
  for (const u of (others || [])) if (u && u.uid) map.set(u.uid, u)
  if (me && me.uid) map.set(me.uid, me)   // ค่าสดทับของซ้ำที่มาจาก roster

  const ranked = [...map.values()]
    .filter(u => fights(u) > 0)
    .sort((a, b) => (num(b.rating) - num(a.rating))
      || String(a.nickname).localeCompare(String(b.nickname)))

  const meUid = me?.uid
  const all = ranked.map((u, i) => ({
    uid: u.uid,
    nickname: u.nickname,
    rating: num(u.rating),
    wins: num(u.wins),
    losses: num(u.losses),
    rank: i + 1,
    isMe: u.uid === meUid,
  }))

  const myIdx = all.findIndex(u => u.isMe)
  const chase = myIdx > 0 ? all[myIdx - 1] : null

  // หน้าต่างรอบตัวเรา — หนีบให้อยู่ในกระดาน แต่ **ไม่แพดแถวปลอม**
  // (คนอันดับ 1 เห็น 3 แถว ไม่ใช่ 5 แถวที่มีช่องว่างข้างบน)
  const around = myIdx < 0 ? [] : all.slice(
    Math.max(0, myIdx - AROUND_RADIUS),
    Math.min(all.length, myIdx + AROUND_RADIUS + 1),
  )

  return {
    top: all.slice(0, TOP_COUNT),
    around,
    all,
    myRank: myIdx >= 0 ? myIdx + 1 : null,
    total: all.length,
    chaseName: chase ? chase.nickname : null,
    chaseGap: chase ? chase.rating - num(me?.rating) : 0,
  }
}
