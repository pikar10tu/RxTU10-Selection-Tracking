// ════════════════════════════════════════════════════════════
//  Minigame registry — แหล่งข้อมูลเดียวของทุกมินิเกม
//  Play landing เรนเดอร์การ์ดจากที่นี่ · เกมอ่าน coinPerPoint/maxPlausibleScore
//  เพิ่มเกมใหม่ = เพิ่ม entry ที่นี่ (status:'live' ต้องมี route)
// ════════════════════════════════════════════════════════════

export const MINIGAMES = [
  {
    key: 'capsuleRush',
    name: 'Capsule Rush',
    emoji: '💊',
    route: '/play/games/capsule-rush',
    coinPerPoint: 5,          // เหรียญ/คะแนน
    maxPlausibleScore: 500,   // เกินนี้ = clamp เหรียญ + log cheat (กันเงินเฟ้อ ไม่ใช่ cap รายวัน)
    scoreLabel: 'คะแนน',
    tagline: 'พาเพ็ทบินลอดชั้นวางยา',
    status: 'live',
  },
  {
    key: 'g2048',
    name: '2048',
    emoji: '🔢',
    route: '/play/games/2048',
    coinPerPoint: 1,          // คะแนน 2048 เป็นหลักพัน-หมื่น จึงให้ 1:1
    maxPlausibleScore: 100000, // ตัวจับโกง ไม่ใช่เพดานรางวัลที่ตั้งใจ — ต่อถึงไทล์ 2048 ก็ราว 20k แล้ว
                               // ใครเล่นต่อถึง 4096/8192 ยังไม่ควรโดนธง · เกินแสน = ผิดปกติจริง
    scoreLabel: 'คะแนน',
    tagline: 'เลื่อนรวมเลขให้ถึง 2048',
    status: 'live',
  },
  {
    key: 'stacker',
    name: 'Stacker',
    emoji: '🧱',
    route: '/play/games/stacker',
    coinPerPoint: 20,       // ชั้นเป็นหน่วยหยาบ (เล่นดี ~15–25 ชั้น) จึงให้ต่อชั้นสูง
    maxPlausibleScore: 200, // ตัวจับโกง ไม่ใช่เพดานรางวัล — ความเร็วตันที่ราวชั้น 23 แล้วไม่ยากขึ้นอีก
                            // คนเก่งจึงไปได้ไกลกว่า 60 ชั้น · เกิน 200 ค่อยถือว่าผิดปกติ
    scoreLabel: 'ชั้น',
    tagline: 'วางบล็อกให้ตรง ซ้อนให้สูงที่สุด',
    status: 'live',
  },
  {
    key: 'pillCrush',
    name: 'Pill Crush',
    emoji: '🍬',
    scoreLabel: 'คะแนน',
    tagline: 'เรียงเม็ดยา 3 สี ตะลุยด่าน',
    status: 'soon',
  },
]

export function getMinigame(key) {
  return MINIGAMES.find(g => g.key === key)
}
