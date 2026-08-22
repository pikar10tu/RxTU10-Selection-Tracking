// towerCrowd — pure: roster rows → เพื่อนที่ปักหมุดรายชั้นบนเส้นทางหอคอย
//
// อ่านจาก `roster/current`.rows **ดิบ** (ไม่ใช่ members.rosterUsers ซึ่ง key ด้วย studentId
// แล้วตกเพื่อนที่เป็น guest ทั้งหมด — ดู roster.js:rosterToMembers ที่แยก guest ไปอีกอาเรย์)
//
// ตรรกะล้วน ไม่แตะ Firestore/Vue — เทส `node --test src/utils/towerCrowd.test.js`

/** จำนวนวงที่โชว์บนราง ที่เหลือยุบเป็นป้าย +N */
export const CROWD_SHOWN = 3

/**
 * @param {Object} rows   `roster/current`.rows = { [uid]: row }
 *                        row.n ชื่อเล่น · row.p googlePhoto · row.tb towerBest
 * @param {string} meUid  uid ตัวเอง — ตัดออกจากราง (ตัวเองมี marker แยกอยู่แล้ว)
 * @returns {Map<number, {shown: Friend[], extra: number, all: Friend[]}>}
 *          Friend = { uid, name, photo }
 */
export function buildFloorCrowd(rows, meUid) {
  const byFloor = new Map()
  for (const [uid, row] of Object.entries(rows || {})) {
    if (!row || uid === meUid) continue
    const tb = Math.floor(row.tb || 0)
    if (tb < 1) continue                       // ยังไม่เคยชนะสักชั้น = ไม่ปักหมุด
    const list = byFloor.get(tb)
    const friend = { uid, name: row.n || '?', photo: row.p || null }
    if (list) list.push(friend)
    else byFloor.set(tb, [friend])
  }

  const out = new Map()
  for (const [floor, list] of byFloor) {
    // เรียงตามชื่อ (uid เป็นตัวตัดสินสำรอง) → ลำดับคงที่ข้าม render
    // ไม่งั้นลำดับจะตามลำดับคีย์ของ object ที่ Firestore ส่งมา ซึ่งอาจสลับได้ = วงกระพริบสลับที่
    list.sort((a, b) => a.name.localeCompare(b.name, 'th') || a.uid.localeCompare(b.uid))
    out.set(floor, {
      shown: list.slice(0, CROWD_SHOWN),
      extra: Math.max(0, list.length - CROWD_SHOWN),
      all: list,
    })
  }
  return out
}
