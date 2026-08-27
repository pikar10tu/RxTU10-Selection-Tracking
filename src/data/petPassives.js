// src/data/petPassives.js
// Passive ประจำตัวเพ็ท — data ล้วน ไม่มีตรรกะ (ตรรกะอยู่ utils/battlePassives.js)
// สเปก: docs/superpowers/specs/2026-08-27-passive-v1-design.md
//
// 🔒 กฎเหล็ก: passive ไม่เพิ่มจำนวน "จังหวะหมัด" (beat) — เพิ่มได้แค่ FX กับตัวเลข
//    ยกเว้น killChain ตัวเดียวที่เพิ่ม beat ได้ จึงต้องมีเพดาน
//
// ⚠️ ตัวเลขทั้งหมดเป็น placeholder ที่ "มีเหตุผล" ไม่ใช่ค่าที่จูนแล้ว (user สั่งจูนทีหลัง)
//    common/rare ตั้งไว้อนุรักษ์นิยมเพราะทำครบทุกความหายากพร้อมกัน = ความเสี่ยงบาลานซ์สูง

export const PET_PASSIVES = {
  // ── Legendary ───────────────────────────────────────────────
  bahamut: {
    name: 'ลมหายใจราชัน', icon: '🔥',
    hook: 'onStart', effect: 'aoeOpener', value: { pct: 12 },
    desc: 'เริ่มสู้ สาดเปลวไฟใส่ศัตรูทุกตัว',
  },
  kirin: {
    name: 'อสูรกระหายเลือด', icon: '👹',
    hook: 'onKill', effect: 'killChain', value: { max: 2 },
    desc: 'น็อกศัตรูแล้วได้ตีต่อทันที (สูงสุด 2 ครั้งต่อเทิร์น)',
  },
  trex: {
    name: 'สัญชาตญาณนักล่า', icon: '🦖',
    hook: 'onKill', effect: 'stackAtk', value: { pct: 12, max: 3 },
    desc: 'ทุกครั้งที่ล้มศัตรู พลังโจมตีเพิ่มขึ้นถาวร (สะสมได้ 3 ชั้น)',
  },
  ouroboros: {
    name: 'วัฏจักรนิรันดร์', icon: '🐍',
    hook: 'onRound', effect: 'regenSelf', value: { pct: 4 },
    desc: 'ฟื้นเลือดตัวเองทุกต้นรอบ',
  },
  simurgh: {
    name: 'โฉบเด็ดชีพ', icon: '🦅',
    hook: 'onAttack', effect: 'targetLowest', value: {},
    desc: 'เล็งศัตรูที่เลือดน้อยที่สุดเสมอ',
  },
  phoenix: {
    name: 'เกิดใหม่จากเถ้า', icon: '🔥',
    hook: 'onDeath', effect: 'revive', value: { pct: 35 },
    desc: 'ตายครั้งแรกแล้วฟื้นกลับมาสู้ต่อ',
  },
  whale: {
    name: 'พรมหาสมุทร', icon: '💧',
    hook: 'aura', effect: 'teamHp', value: { pct: 10 },
    desc: 'เพิ่มเลือดสูงสุดให้ทั้งทีม',
  },
  qilin: {
    name: 'ปราการพิทักษ์', icon: '🛡️',
    hook: 'onHit', effect: 'guardian', value: { pct: 50 },
    desc: 'รับดาเมจแทนเพื่อนที่เลือดน้อยที่สุดครึ่งหนึ่ง',
  },
  mammoth: {
    name: 'เกราะปฐพี', icon: '🪨',
    hook: 'onHit', effect: 'damageReduction', value: { pct: 20 },
    desc: 'ลดดาเมจที่ตัวเองได้รับ',
  },

  // ── Epic ────────────────────────────────────────────────────
  dragon: {
    name: 'ลมหายใจเพลิง', icon: '🔥',
    hook: 'onAttack', effect: 'cleave', value: { count: 2, pct: 50 },
    desc: 'เปลวไฟลามโดนศัตรู 2 ตัว',
  },
  cerberus: {
    name: 'ตรีเขี้ยวอสูร', icon: '🦷',
    hook: 'onAttack', effect: 'cleave', value: { count: 3, pct: 40 },
    desc: 'พุ่งเข้าขย้ำทีเดียว เขี้ยวโดนศัตรู 3 ตัว',
  },
  unicorn: {
    name: 'เขาศักดิ์สิทธิ์', icon: '✨',
    hook: 'onRound', effect: 'healLowestAlly', value: { pct: 5 },
    desc: 'ฟื้นเลือดเพื่อนที่บอบช้ำที่สุดทุกต้นรอบ',
  },
  fairy: {
    name: 'ละอองเวทมนตร์', icon: '✨',
    hook: 'aura', effect: 'teamCrit', value: { pct: 8 },
    desc: 'เพิ่มโอกาสคริทั้งทีม',
  },
  panda: {
    name: 'ลมปราณฟื้นฟู', icon: '🎋',
    hook: 'onRound', effect: 'regenSelf', value: { pct: 5 },
    desc: 'ฟื้นเลือดตัวเองทุกต้นรอบ',
  },
  genie: {
    name: 'พรคุ้มครอง', icon: '🧞',
    hook: 'onDeath', effect: 'saveAlly', value: {},
    desc: 'กันเพื่อนไม่ให้ตาย 1 ครั้ง (เหลือเลือด 1)',
  },

  // ── Rare ────────────────────────────────────────────────────
  wolf: {
    name: 'สัญชาตญาณฝูง', icon: '🐺',
    hook: 'aura', effect: 'teamAtkPerElement', value: { pct: 4, element: 'fist' },
    desc: 'ยิ่งมีเพื่อนสายพลัง พลังโจมตีทั้งทีมยิ่งสูง',
  },
  shark: {
    name: 'เขี้ยวกระหาย', icon: '🦈',
    hook: 'onAttack', effect: 'execute', value: { pct: 25, below: 30 },
    desc: 'ตีแรงขึ้นกับศัตรูที่เลือดน้อย',
  },
  fox: {
    name: 'เงาลวงตา', icon: '🦊',
    hook: 'onHit', effect: 'dodge', value: { pct: 12 },
    desc: 'มีโอกาสหลบการโจมตี',
  },
  rabbit: {
    name: 'ฝีเท้าสายลม', icon: '🐰',
    hook: 'onAttack', effect: 'multiStrike', value: { chance: 30, pct: 60 },
    desc: 'บางครั้งกระโดดตีสองทีรวดเดียว',
  },
  owl: {
    name: 'นัยน์ตาหยั่งรู้', icon: '🦉',
    hook: 'aura', effect: 'enemyVuln', value: { pct: 6 },
    desc: 'อ่านจุดอ่อนศัตรู ทำให้ศัตรูรับดาเมจเพิ่ม',
  },
  seal: {
    name: 'ยอดนักซัพพอร์ต', icon: '💧',
    hook: 'aura', effect: 'teamAtk', value: { pct: 6, duoWith: 'whale', duoPct: 10, duoRegen: 3 },
    desc: 'เพิ่มพลังโจมตีทีม · เข้าคู่กับคุณวาฬจะแรงขึ้นและฟื้นเลือดให้ทีมด้วย',
  },

  // ── Common ──────────────────────────────────────────────────
  hedgehog: {
    name: 'เกราะหนาม', icon: '🦔',
    hook: 'onHit', effect: 'thorns', value: { pct: 8 },
    desc: 'สะท้อนดาเมจส่วนหนึ่งกลับไปที่ผู้โจมตี',
  },
  hamster: {
    name: 'พลังกักตุน', icon: '🐹',
    hook: 'onAttack', effect: 'atkWhenFull', value: { pct: 15 },
    desc: 'ตีแรงขึ้นตอนเลือดยังเต็ม',
  },
  mouse: {
    name: 'ปราดเปรียว', icon: '🐭',
    hook: 'onHit', effect: 'dodge', value: { pct: 8 },
    desc: 'มีโอกาสหลบการโจมตี',
  },
  cat: {
    name: 'เก้าชีวิต', icon: '🐱',
    hook: 'onDeath', effect: 'cheatDeath', value: {},
    desc: 'รอดตายครั้งแรกด้วยเลือด 1',
  },
  butterfly: {
    // ⚠️ เดิมเป็น teamHealOpener (ฟื้นทีมตอนเริ่ม) — วัดแล้วได้ +0.0% เป๊ะ เพราะตอนเริ่มสู้
    //    ทุกตัวเลือดเต็มอยู่แล้ว การฟื้นจึงไม่เกิดอะไรขึ้นเลย ผู้เล่นไม่มีวันรู้ว่าตัวเองมี passive
    //    เปลี่ยนเป็นออร่าฟื้นทีมทุกรอบ — ตรงกับชื่อเดิม (ละอองเยียวยา) และวัดผลได้จริง
    //    ลองเป็น teamRegen 2%/รอบ แล้ววัดได้ +53% — แรงเกินเพราะฟื้นทั้งทีมทุกรอบมันทบต้น
    //    ลงตัวที่ "รุ่นอ่อนของ unicorn" ตามแพทเทิร์นเดียวกับ dodge/damageReduction ที่ common ใช้
    name: 'ละอองเยียวยา', icon: '🦋',
    hook: 'onRound', effect: 'healLowestAlly', value: { pct: 2 },
    desc: 'ฟื้นเลือดเพื่อนที่บอบช้ำที่สุดทีละนิดทุกรอบ',
  },
  turtle: {
    name: 'กระดองศิลา', icon: '🐢',
    hook: 'onHit', effect: 'damageReduction', value: { pct: 12 },
    desc: 'ลดดาเมจที่ตัวเองได้รับ',
  },
}
