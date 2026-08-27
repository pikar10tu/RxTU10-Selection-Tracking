// towerRivals — pure: จัดอันดับ towerBest ของทั้งรุ่น + ระยะไล่ตาม (การ์ด "อันดับหอคอย")
//
// เดิมคืนแค่ top 3 → คนอันดับ 25 จาก 52 มองแล้วไม่รู้สึกอะไร เพราะไม่เห็นคนที่ไล่ทันจริง ๆ
// ตอนนี้คืน `around` (หน้าต่าง ±2 รอบตัวเรา) กับ `all` (ทุกคน สำหรับกระดานเต็ม) เพิ่ม
// ⚠️ ไม่มี Firestore read เพิ่ม — ทั้งหมดคำนวณจาก roster ที่หน้าหอคอยโหลดไว้แล้ว 1 read
//
// เทส: node --test src/utils/towerRivals.test.js

/** จำนวนแถวเหนือ/ใต้ตัวเราในหน้าต่าง around */
export const AROUND_RADIUS = 2
/** จำนวนแถวหัวตารางที่การ์ดโชว์เสมอ */
export const TOP_COUNT = 3

/**
 * @param {Array<{uid,nickname,towerBest}>} others  รายชื่อจาก roster
 * @param {{uid,nickname,towerBest}} me              ค่าสดของผู้เล่นปัจจุบัน (auth)
 * @returns {{top,around,all,myRank,total,chaseName,chaseGap}}
 *          แถว = { uid, nickname, floor, rank, isMe }
 */
export function towerRanking(others, me) {
  const map = new Map()
  for (const u of (others || [])) if (u && u.uid) map.set(u.uid, u)
  if (me && me.uid) map.set(me.uid, me)   // ค่าสดทับของซ้ำที่มาจาก roster

  const ranked = [...map.values()]
    .filter(u => (u.towerBest || 0) >= 1)        // ยังไม่เคยชนะสักชั้น = ไม่ขึ้นกระดาน
    .sort((a, b) => (b.towerBest - a.towerBest) || String(a.nickname).localeCompare(String(b.nickname)))

  const meUid = me?.uid
  const all = ranked.map((u, i) => ({
    uid: u.uid,
    nickname: u.nickname,
    floor: u.towerBest,
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
    chaseGap: chase ? chase.floor - (me?.towerBest || 0) : 0,
  }
}
