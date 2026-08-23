// frameMeter.js — คณิตของ "มาตรวัดเฟรม" ในพาเนลไฟต์ทดสอบ (BattleReplay)
// pure ล้วน: ไม่แตะ DOM/rAF/Date.now → เทสด้วย node --test ได้ตรงๆ (ตัว rAF อยู่ฝั่ง component)
//
// ⚠️ ทำไมต้องจูนศูนย์ก่อนนับ: ของเดิมใช้ `dt > 16` ตายตัว แต่จอ 60Hz มีคาบจริง ~16.67ms
//    → ทุกเฟรมบนเครื่องที่ลื่นสนิทก็ถูกนับว่า "หลุด 60fps" หมด ตัวเลขสอง preset เลยเท่ากันเป็นพันๆ
//    (และบนจอ 120Hz ProMotion เลข 16 หมายถึงคนละเรื่องไปเลย)
//    ตัวนี้จึงวัดคาบเฟรมจริงของจอเครื่องนั้นก่อน แล้วค่อยนับว่า "ช้ากว่าปกติ" เทียบกับคาบของมันเอง

export const CAL_FRAMES = 30        // เฟรมแรกที่เอาไปจูนศูนย์ (~0.5 วิ บนจอ 60Hz — ตกอยู่ในช่วง READY?/GO! พอดี)
export const DROP_RATIO = 1.5       // ช้ากว่าคาบปกติเกินกี่เท่า = นับว่าสะดุด
export const BAD_MS = 33            // เกณฑ์สัมบูรณ์ "ต่ำกว่า 30fps" — จงใจไม่ผูกกับจอ เพราะมันคือความแย่ที่คนรู้สึกได้จริง
export const FALLBACK_BASE = 16.7   // คาบสมมติระหว่างที่ยังจูนศูนย์ไม่เสร็จ (= จอ 60Hz)

/** มัธยฐาน — ทนต่อเฟรมกระตุกช่วง mount ได้ดีกว่าค่าเฉลี่ย (นี่คือเหตุผลที่ไม่ใช้ average) */
export function median(nums) {
  const a = [...nums].sort((x, y) => x - y)
  if (!a.length) return 0
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/**
 * ตัวนับเฟรม 1 ชุดต่อ 1 ไฟต์ — สร้างใหม่ทุกครั้งที่เริ่มไฟต์ (ไม่มี reset ในตัว จงใจ ให้ทิ้งแล้วสร้างใหม่)
 * @param {Object} [opt] ปรับได้เพื่อเทส
 */
export function createFrameMeter(opt = {}) {
  const calFrames = opt.calFrames ?? CAL_FRAMES
  const dropRatio = opt.dropRatio ?? DROP_RATIO
  const badMs = opt.badMs ?? BAD_MS
  const windowMs = opt.windowMs ?? 1000

  let last = 0, winStart = 0, winMax = 0
  const cal = []
  let base = 0, dropAt = 0
  let peak = 0, drop = 0, bad = 0, worst = 0

  return {
    /**
     * ป้อน timestamp ของ rAF เข้ามาทีละเฟรม
     * @returns {boolean} true = หน้าต่าง 1 วิ เพิ่งปิดรอบ (ฝั่ง component ค่อยเขียน ref ตอนนี้ทีเดียว — วินาทีละครั้ง ไม่ใช่ทุกเฟรม)
     */
    push(now) {
      if (!last) { last = now; winStart = now; return false }
      const dt = now - last
      last = now
      if (dt > peak) peak = dt
      if (dt > winMax) winMax = dt
      if (dt > badMs) bad++                       // เกณฑ์สัมบูรณ์ — นับตั้งแต่เฟรมแรก ไม่ต้องรอจูนศูนย์
      if (cal.length < calFrames) {
        cal.push(dt)
        if (cal.length === calFrames) { base = median(cal); dropAt = base * dropRatio }
      } else if (dt > dropAt) drop++              // ช่วงจูนศูนย์ไม่นับสะดุด (~30 เฟรมจากไฟต์ทั้งไฟต์ ≈ 2–3%)
      if (now - winStart > windowMs) { worst = winMax; winMax = 0; winStart = now; return true }
      return false
    },
    /** ค่าที่เอาไปโชว์ — dropAt ตกกลับเป็นค่าจอ 60Hz ระหว่างยังจูนศูนย์ไม่เสร็จ */
    stats() {
      return {
        base, dropAt: dropAt || FALLBACK_BASE * dropRatio,
        peak, drop, bad, worst, calibrating: cal.length < calFrames,
      }
    },
  }
}
