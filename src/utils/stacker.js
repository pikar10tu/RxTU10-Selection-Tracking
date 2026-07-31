// ════════════════════════════════════════════════════════════
//  Stacker — กติกาล้วน (ไม่แตะ DOM/timer) เทสด้วย node --test
//  หน่วยทุกอย่างเป็น "คอลัมน์" (ทศนิยมได้) · เวลาเป็นวินาที ฉีด dt เข้ามา
//  state = { x, w, dir, speed, rows: [{ x, w }] }  · rows[0] = ฐาน
// ════════════════════════════════════════════════════════════
export const COLS = 12
const START_SPEED = 3       // คอลัมน์/วินาที
const SPEED_STEP = 0.35     // เร่งขึ้นทุกแถวที่วางสำเร็จ
const SPEED_MAX = 11

export function newStack(startW = 6) {
  const x = (COLS - startW) / 2
  return { x, w: startW, dir: 1, speed: START_SPEED, rows: [{ x, w: startW }] }
}

// เลื่อนบล็อกที่กำลังวิ่ง · ชนขอบแล้วกลับทิศ (หนีบไว้ในกระดานเสมอ)
export function stepBlock(state, dt) {
  let x = state.x + state.dir * state.speed * dt
  let dir = state.dir
  const maxX = COLS - state.w
  if (x <= 0) { x = 0; dir = 1 }
  else if (x >= maxX) { x = maxX; dir = -1 }
  return { ...state, x, dir }
}

// วางบล็อก — ตัดส่วนที่ยื่นเกินแถวล่าง · ไม่ทับเลย = จบเกม
export function dropBlock(state) {
  const below = state.rows[state.rows.length - 1]
  const start = Math.max(state.x, below.x)
  const end = Math.min(state.x + state.w, below.x + below.w)
  const w = end - start
  if (w <= 0) return { state, gameOver: true }
  const rows = [...state.rows, { x: start, w }]
  return {
    state: {
      ...state,
      rows, w, x: start,
      dir: 1,
      speed: Math.min(SPEED_MAX, state.speed + SPEED_STEP),
    },
    gameOver: false,
  }
}
