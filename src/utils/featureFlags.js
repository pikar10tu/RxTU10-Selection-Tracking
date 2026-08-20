/**
 * สวิตช์เปิด-ปิดฟีเจอร์ เก็บใน Firestore `config/app` (แอดมินกดจากหน้า Admin
 * มีผลทันที ไม่ต้อง deploy) · ตรรกะการอ่านอยู่ที่นี่เป็น pure function
 * เพราะ useAppConfig เป็น onSnapshot listener ซึ่งเทสตรงไม่ได้
 *
 * spec: docs/superpowers/specs/2026-08-21-game-focus-flags-design.md
 */

// ชื่อ flag ที่ระบบรู้จัก — key นอกลิสต์นี้ถือว่าปิดเสมอ (กันพิมพ์ชื่อผิดแล้วเงียบ)
export const FEATURE_KEYS = ['pvpOpen', 'expeditionOpen', 'arcadeOpen']

/**
 * @param {object|null|undefined} configData ข้อมูลดิบจาก config/app (null = doc หาย/ยังไม่โหลด)
 * @param {string} key ชื่อ flag ใน FEATURE_KEYS
 * @param {{ isAdmin?: boolean }} [opts] แอดมินเห็นเสมอ — ไว้เทสก่อนเปิดให้ทั้งรุ่น
 * @returns {boolean}
 */
export function isFeatureOpen(configData, key, { isAdmin = false } = {}) {
  if (!FEATURE_KEYS.includes(key)) return false
  if (isAdmin === true) return true
  // ต้องเป็น boolean true เป๊ะ — "true"/1/"yes" ที่พิมพ์ผิดใน console ห้ามเปิดฟีเจอร์ให้ทั้งรุ่น
  return configData?.[key] === true
}
