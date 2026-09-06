// ════════════════════════════════════════════════════════════
//  รายชื่อสมาชิกฝั่งแอดมิน — ตัดสินว่า user doc ไปอยู่ช่องไหน/คีย์อะไร (pure)
//  ใช้โดย stores/members.js (loadFbUsers) เท่านั้น
// ════════════════════════════════════════════════════════════

// ช่องของ doc นี้: 'guest' (แถว triage) หรือ 'member' (สมาชิกทั่วไป)
// 🔴 doc ที่ไม่ใช่ guest และ **ไม่มี studentId** ต้องเป็น 'member' ด้วย
//    เดิมเงื่อนไขในสโตร์เป็น `else if (n.studentId)` ⇒ ตกทั้งสองช่องแล้วหายเงียบ
//    ใครหลุดได้บ้าง: `utils/onboarding.js:31` ปล่อยเข้าแอปด้วย `onboarded === true`
//    เพียงอย่างเดียว (ไม่บังคับผูกรหัส และไม่ต้องเป็น guest) ⇒ คนกลุ่มนี้ใช้แอปได้ครบ
//    แต่ไม่มีตัวตนฝั่งแอดมิน: ไม่อยู่ในรายชื่อผู้รับ broadcast + ไม่โผล่ในลิสต์จัดการสิทธิ์
//    (เจอ 6 ก.ย. 2026 ตอนไล่เคส "ส่งประกาศ Pre-CC1 แล้วแอดมินไม่ได้รับจดหมาย")
export function memberBucket(u) {
  return (u?.accountType === 'guest' || u?.track === 'guest') ? 'guest' : 'member'
}

// คีย์ใน map fbUsers — studentId ถ้ามี ไม่งั้น uid (ห้ามคืนค่าว่าง ไม่งั้น doc ทับกัน)
// ปลอดภัยเพราะผู้อ่าน fbUsers ทุกคนใช้ Object.values() ไม่มีใคร lookup ด้วยรหัส
export function memberKey(u, uid) {
  return u?.studentId || uid
}
