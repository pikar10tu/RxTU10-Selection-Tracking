// ════════════════════════════════════════════════════════════
//  2048 — กติกาล้วน (ไม่แตะ DOM/canvas/Firestore) เทสด้วย node --test
//  กระดาน = array 16 ช่อง (0 = ว่าง) เรียงซ้าย→ขวา บนลงล่าง
//  rng ฉีดเข้ามาได้เพื่อให้เทสคุมผลสุ่มได้
// ════════════════════════════════════════════════════════════
export const SIZE = 4

// เลื่อน+รวมหนึ่งแถวไปทางซ้าย — คืนแถวใหม่กับคะแนนที่ได้
//  ไทล์ที่เพิ่งรวมห้ามรวมซ้ำในตาเดียวกัน (ข้าม index ถัดไปหลังรวม)
function slideRow(row) {
  const tight = row.filter(v => v !== 0)
  const out = []
  let gained = 0
  for (let i = 0; i < tight.length; i++) {
    if (tight[i] === tight[i + 1]) {
      const merged = tight[i] * 2
      out.push(merged)
      gained += merged
      i++                       // กินตัวถัดไปไปแล้ว ห้ามใช้ซ้ำ
    } else {
      out.push(tight[i])
    }
  }
  while (out.length < SIZE) out.push(0)
  return { row: out, gained }
}

// ดึง index ของหนึ่งเส้น (แถวหรือคอลัมน์) ตามทิศที่จะเลื่อน
//  เลื่อนขวา/ลง = อ่านกลับด้าน เพื่อให้ใช้ slideRow (ซ้าย) ตัวเดียวได้
function lineIndices(dir, i) {
  const idx = []
  for (let j = 0; j < SIZE; j++) {
    if (dir === 'left' || dir === 'right') idx.push(i * SIZE + j)
    else idx.push(j * SIZE + i)
  }
  return (dir === 'right' || dir === 'down') ? idx.reverse() : idx
}

// เลื่อนทั้งกระดาน · moved = กระดานเปลี่ยนจริงไหม (ใช้ตัดสินว่าจะ spawn ไหม)
export function move(board, dir) {
  const out = board.slice()
  let gained = 0
  for (let i = 0; i < SIZE; i++) {
    const idx = lineIndices(dir, i)
    const { row, gained: g } = slideRow(idx.map(k => board[k]))
    gained += g
    idx.forEach((k, j) => { out[k] = row[j] })
  }
  const moved = out.some((v, k) => v !== board[k])
  return { board: out, gained, moved }
}

// วางไทล์ใหม่ในช่องว่างสุ่ม — 2 ที่ 90% · 4 ที่ 10%
export function spawn(board, rng = Math.random) {
  const empty = []
  board.forEach((v, k) => { if (v === 0) empty.push(k) })
  if (!empty.length) return board.slice()
  const out = board.slice()
  const at = empty[Math.floor(rng() * empty.length)]
  out[at] = rng() < 0.9 ? 2 : 4
  return out
}

export function newBoard(rng = Math.random) {
  return spawn(spawn(new Array(SIZE * SIZE).fill(0), rng), rng)
}

// จบเกมเมื่อไม่มีช่องว่าง และไม่มีคู่ติดกัน (แนวนอน/แนวตั้ง) ที่รวมได้
export function isGameOver(board) {
  if (board.some(v => v === 0)) return false
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r * SIZE + c]
      if (c + 1 < SIZE && v === board[r * SIZE + c + 1]) return false
      if (r + 1 < SIZE && v === board[(r + 1) * SIZE + c]) return false
    }
  }
  return true
}
