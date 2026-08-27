// teamSlots — ตรรกะ "ช่องคือเคอร์เซอร์" ของหน้าจัดทีม (pure ล้วน ไม่แตะ Vue/store)
//
// โมเดล: ช่องทีมเป็นตัวชี้เป้า ส่วนคลังไม่เคยถูกปิดการใช้งาน
// (แพทเทิร์นเดียวกับ Epic Seven / Summoners War / Honkai Star Rail / FEH)
// ผู้เล่นจึงไม่มีทางเจอสถานะ "กดอะไรก็ไม่ได้" และไม่ต้องจำว่าแตะตรงไหนแปลว่าอะไร
//
// ⚠️ ของเดิมมีแต่ `cur.push(id)` ต่อท้าย → เรียงลำดับทีมไม่ได้เลย
//    ทั้งที่ data/guide.js เขียนไว้เองว่า "ตัวซ้ายสุดได้ออกตีก่อน" — ไกด์โกหกมาตลอด
//    การสลับที่ใน placeAt() คือสิ่งที่ทำให้ไกด์เป็นเรื่องจริงขึ้นมา
//
// เทส: node --test src/utils/teamSlots.test.js

const clampIdx = (i, n) => Math.max(0, Math.min(n - 1, Number.isFinite(i) ? Math.trunc(i) : 0))

/** activePets (อาจสั้น/ยาว/มีรู) → อาเรย์ยาว maxSlots เสมอ ช่องว่าง = null */
export function toSlots(activeIds, maxSlots) {
  const out = []
  const src = Array.isArray(activeIds) ? activeIds : []
  for (let i = 0; i < maxSlots; i++) out.push(src[i] ?? null)
  return out
}

/** ช่องว่างช่องแรก · เต็มหมด = -1 */
export function firstEmpty(slots) {
  const i = (slots || []).findIndex(s => !s)
  return i
}

/** ช่องว่างถัดไปจาก `from` (เดินหน้าก่อน แล้ววนกลับต้น) · ไม่มีช่องว่างเลย = คืน `from` เดิม */
export function nextEmpty(slots, from) {
  const n = (slots || []).length
  if (!n) return from
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (!slots[i]) return i
  }
  return from
}

/**
 * วาง `id` ลงช่อง `cursor` แล้วคืนสถานะใหม่ (ไม่แก้ของเดิม)
 *
 * - ช่องนั้นมีตัวอื่นอยู่ → ตัวเดิมหลุดออกจากทีม (ไม่ไปโผล่ช่องอื่น)
 * - `id` อยู่ช่องอื่นอยู่แล้ว → สลับที่กัน = จัดลำดับทีม ไม่ใช่ทำสำเนา
 * - `id` อยู่ช่อง cursor เองอยู่แล้ว → ไม่เปลี่ยนอะไร (กันการกดซ้ำแล้วหลุด)
 * - `id` ว่าง (null) → ถอดตัวในช่องนั้นออก
 *
 * cursor ใหม่ = ช่องว่างถัดไป · ทีมเต็มแล้วก็อยู่ช่องเดิม (ผู้เล่นกดสลับตัวต่อได้เรื่อย ๆ)
 *
 * @returns {{slots: (string|null)[], cursor: number}}
 */
export function placeAt(slots, cursor, id, maxSlots) {
  const next = toSlots(slots, maxSlots)
  const c = clampIdx(cursor, maxSlots)

  if (!id) {
    next[c] = null
    return { slots: next, cursor: c }
  }
  if (next[c] === id) return { slots: next, cursor: c }   // กดซ้ำ = ไม่มีอะไรเกิดขึ้น

  const at = next.indexOf(id)
  if (at >= 0) { next[at] = next[c]; next[c] = id }        // สลับที่ (ช่องเดิมรับตัวที่ถูกเบียด)
  else next[c] = id                                       // ตัวใหม่ทับลงไป ตัวเดิมหลุดออก

  return { slots: next, cursor: nextEmpty(next, c) }
}
