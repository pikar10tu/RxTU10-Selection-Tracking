// src/data/petPassives.js
// Passive ประจำตัวเพ็ท — data ล้วน ไม่มีตรรกะ (ตรรกะอยู่ utils/battlePassives.js)
// สเปก: docs/superpowers/specs/2026-08-27-passive-v1-design.md
//
// 🔒 กฎเหล็ก: passive ไม่เพิ่มจำนวน "จังหวะหมัด" (beat) — เพิ่มได้แค่ FX กับตัวเลข
//    ยกเว้น killChain ตัวเดียวที่เพิ่ม beat ได้ จึงต้องมีเพดาน
//
// 🧩 โครงข้อมูล: พาสสีฟ 1 ตัว = `parts: [{ hook, effect, value, step, tag? }]`
//    เพ็ทตัวเดียวมีได้หลายผล (บากุ = รับแทน + ฟื้นเอง) · ลำดับใน parts = ลำดับที่ event โผล่บนจอ
//    `tag` ใส่เมื่อสอง part ใช้ชื่อคีย์ชนกัน แล้วอ้างในข้อความว่า {tag.pct}
//    ❌ ห้ามกลับไปเขียน hook/effect ไว้ระดับบนสุดอีก — มีเทสกันไว้ใน petPassives.test.js
//
// 📝 `desc` เป็น "แม่แบบ" ใส่ตัวเลขด้วย {pct} {count} {max} {below} {chance} {duoPct} {duoRegen} {times}
//    ห้ามพิมพ์ตัวเลขลงไปตรงๆ เด็ดขาด — ค่าจริงมาจาก `value`/`step` แล้ว passiveText() เป็นคนเติมให้
//    (ไม่งั้นพอจูนเลขหรือผู้เล่นอัพขั้น คำอธิบายจะโกหกทันทีโดยไม่มีใครรู้)
//
// 🪨 เผื่อ "ดันเจี้ยนหินพาสซีฟ" ที่วางแผนไว้: อัพได้ 3 ขั้น · ค่าขั้นถัดไป = value + step
//    ⚠️ step ตั้งให้ "ขั้น 3 ราว 1.5–1.8 เท่าของขั้น 1" ไม่ใช่ 3 เท่า เพราะ
//       (1) หลายอันเป็น % ที่ชนเพดานความสมเหตุสมผล (guardian 50%×3 = 150% เป็นไปไม่ได้)
//       (2) dodge/damageReduction ที่สูงเกินทำให้ไฟต์ยืดจนน่าเบื่อ (ชนงบเวลาที่มีเทสคุมอยู่)
//       (3) step: 0 = "อัพขั้นไม่เพิ่มค่านี้" ใช้กับตัวที่โตแล้วพัง (killChain เพิ่ม beat · จำนวนครั้งของ cheatDeath)

export const PASSIVE_MAX_LEVEL = 3

export const PET_PASSIVES = {
  // ── Legendary ───────────────────────────────────────────────
  bahamut: {
    name: 'ลมหายใจราชัน', icon: '🔥',
    parts: [{ hook: 'onStart', effect: 'aoeOpener', value: { pct: 12 }, step: { pct: 4 } }],
    desc: 'เริ่มสู้ สาดเปลวไฟใส่ศัตรูทุกตัว {pct}% ของพลังโจมตี',
    short: 'เริ่มสู้ ยิงศัตรูทุกตัว {pct}% ของพลังโจมตี',
  },
  kirin: {
    name: 'อสูรกระหายเลือด', icon: '👹',
    // ⚠️ step 0 โดยตั้งใจ — killChain เป็นตัวเดียวที่เพิ่ม beat จริง ให้อัพได้ = ไฟต์ยืดตามขั้น
    parts: [{ hook: 'onKill', effect: 'killChain', value: { max: 2 }, step: { max: 0 } }],
    desc: 'น็อกศัตรูแล้วได้ตีต่อทันที (สูงสุด {max} ครั้งต่อรอบ)',
    short: 'น็อกแล้วได้ตีต่อ สูงสุด {max} ครั้ง/รอบ',
  },
  trex: {
    name: 'สัญชาตญาณนักล่า', icon: '🦖',
    parts: [{ hook: 'onAnyDeath', effect: 'stackAtk', value: { pct: 12, max: 3 }, step: { pct: 4, max: 0 } }],
    desc: 'ศัตรูล้ม 1 ตัว (ใครล้มก็ได้) พลังโจมตี +{pct}% ถาวร (สะสมได้ {max} ชั้น)',
    short: 'ศัตรูล้ม 1 ตัว พลังโจมตี +{pct}% (สะสม {max} ชั้น)',
  },
  ouroboros: {
    name: 'วัฏจักรนิรันดร์', icon: '🐍',
    parts: [{ hook: 'onRound', effect: 'regenSelf', value: { pct: 4 }, step: { pct: 1.5 } }],
    desc: 'ฟื้นเลือดตัวเอง {pct}% ของเลือดสูงสุดทุกต้นรอบ',
    short: 'ฟื้นเลือดตัวเอง {pct}% ทุกต้นรอบ',
  },
  simurgh: {
    name: 'โฉบเด็ดชีพ', icon: '🦅',
    parts: [{ hook: 'onAttack', effect: 'targetLowest', value: {}, step: {} }],
    desc: 'เล็งศัตรูที่เลือดน้อยที่สุดเสมอ',
    short: 'เล็งศัตรูที่เลือดน้อยที่สุดเสมอ',
  },
  phoenix: {
    name: 'เกิดใหม่จากเถ้า', icon: '🔥',
    // 🔴 P2c-1 Task 6: เพิ่ม counterPct — ตีสวนผู้สังหารหลังคืนชีพ · step: 0 เพราะยังไม่มีเพ็ทไหนขึ้นขั้นได้จริง
    //    (ดันเจี้ยนหินยังไม่มา) แต่ pct หลักยังอัพได้ตามเดิม (ดู step ของ pct ด้านบน)
    parts: [{ hook: 'onDeath', effect: 'revive', value: { pct: 35, counterPct: 150 },
              step: { pct: 10, counterPct: 0 } }],
    desc: 'ตายครั้งแรกแล้วฟื้นด้วยเลือด {pct}% แล้วตีสวนผู้สังหาร {counterPct}% ของพลังโจมตี',
    short: 'ฟื้นด้วยเลือด {pct}% + ตีสวน {counterPct}%',
  },
  whale: {
    name: 'พรมหาสมุทร', icon: '💧',
    parts: [{ hook: 'aura', effect: 'teamHp', value: { pct: 10 }, step: { pct: 3 } }],
    desc: 'เลือดสูงสุดของทั้งทีม +{pct}%',
    short: 'เลือดสูงสุดทั้งทีม +{pct}%',
  },
  qilin: {
    name: 'ปราการพิทักษ์', icon: '🛡️',
    parts: [{ hook: 'onHit', effect: 'guardian', value: { pct: 50 }, step: { pct: 8 } }],
    desc: 'รับดาเมจแทนเพื่อนที่เลือดน้อยที่สุด {pct}%',
    short: 'รับดาเมจแทนเพื่อนที่เลือดน้อยสุด {pct}%',
  },
  mammoth: {
    name: 'เกราะปฐพี', icon: '🪨',
    parts: [{ hook: 'onHit', effect: 'damageReduction', value: { pct: 20 }, step: { pct: 5 } }],
    desc: 'ลดดาเมจที่ตัวเองได้รับ {pct}%',
    short: 'ลดดาเมจที่ตัวเองได้รับ {pct}%',
  },

  // ── Epic ────────────────────────────────────────────────────
  dragon: {
    name: 'ลมหายใจเพลิง', icon: '🔥',
    parts: [{ hook: 'onAttack', effect: 'cleave', value: { count: 2, pct: 50 }, step: { count: 0, pct: 10 } }],
    desc: 'เปลวไฟลามโดนศัตรู {count} ตัว · ตัวรองโดน {pct}% ของดาเมจ',
    short: 'ไฟลามโดนศัตรู {count} ตัว · ตัวรองโดน {pct}%',
  },
  cerberus: {
    name: 'ตรีเขี้ยวอสูร', icon: '🦷',
    parts: [{ hook: 'onAttack', effect: 'cleave', value: { count: 3, pct: 40 }, step: { count: 0, pct: 8 } }],
    desc: 'พุ่งขย้ำทีเดียว เขี้ยวโดนศัตรู {count} ตัว · ตัวรองโดน {pct}% ของดาเมจ',
    short: 'เขี้ยวโดนศัตรู {count} ตัว · ตัวรองโดน {pct}%',
  },
  unicorn: {
    name: 'เขาศักดิ์สิทธิ์', icon: '✨',
    parts: [{ hook: 'onRound', effect: 'healLowestAlly', value: { pct: 5 }, step: { pct: 2 } }],
    desc: 'ฟื้นเลือดเพื่อนที่บอบช้ำที่สุด {pct}% ทุกต้นรอบ',
    short: 'ฟื้นเลือดเพื่อนที่บอบช้ำสุด {pct}% ทุกต้นรอบ',
  },
  fairy: {
    name: 'ละอองเวทมนตร์', icon: '✨',
    parts: [{ hook: 'aura', effect: 'teamCrit', value: { pct: 8 }, step: { pct: 3 } }],
    desc: 'โอกาสคริติคอลของทั้งทีม +{pct}%',
    short: 'โอกาสคริติคอลทั้งทีม +{pct}%',
  },
  panda: {
    name: 'ลมปราณฟื้นฟู', icon: '🎋',
    parts: [{ hook: 'onRound', effect: 'regenSelf', value: { pct: 5 }, step: { pct: 2 } }],
    desc: 'ฟื้นเลือดตัวเอง {pct}% ของเลือดสูงสุดทุกต้นรอบ',
    short: 'ฟื้นเลือดตัวเอง {pct}% ทุกต้นรอบ',
  },
  genie: {
    name: 'พรคุ้มครอง', icon: '🧞',
    parts: [{ hook: 'onDeath', effect: 'saveAlly', value: { times: 1 }, step: { times: 0 } }],
    desc: 'กันเพื่อนไม่ให้ตาย {times} ครั้ง (เหลือเลือด 1)',
    short: 'กันเพื่อนไม่ให้ตาย {times} ครั้ง (เหลือเลือด 1)',
  },

  // ── Rare ────────────────────────────────────────────────────
  wolf: {
    name: 'สัญชาตญาณฝูง', icon: '🐺',
    parts: [{ hook: 'aura', effect: 'teamAtkElement', value: { pct: 4, element: 'fist' }, step: { pct: 1.5 } }],
    desc: 'เพื่อนสายจู่โจมทุกตัว พลังโจมตี +{pct}%',
    short: 'เพื่อนสายจู่โจมทุกตัว +{pct}%',
  },
  shark: {
    name: 'เขี้ยวกระหาย', icon: '🦈',
    parts: [{ hook: 'onAttack', effect: 'execute', value: { pct: 25, below: 30 }, step: { pct: 8, below: 3 } }],
    desc: 'ตีแรงขึ้น {pct}% กับศัตรูที่เลือดต่ำกว่า {below}%',
    short: 'ตีแรงขึ้น {pct}% กับศัตรูที่เลือดต่ำกว่า {below}%',
  },
  fox: {
    name: 'เงาลวงตา', icon: '🦊',
    parts: [{ hook: 'onHit', effect: 'dodge', value: { pct: 12 }, step: { pct: 3 } }],
    desc: 'โอกาสหลบการโจมตี {pct}%',
    short: 'โอกาสหลบ {pct}%',
  },
  rabbit: {
    name: 'ฝีเท้าสายลม', icon: '🐰',
    parts: [{ hook: 'onAttack', effect: 'multiStrike', value: { chance: 30, pct: 60 }, step: { chance: 8, pct: 5 } }],
    desc: 'โอกาส {chance}% กระโดดตีสองทีรวดเดียว (ทีละ {pct}% ของดาเมจ)',
    short: 'โอกาส {chance}% ตีสองทีรวด (ทีละ {pct}% ของดาเมจ)',
  },
  owl: {
    name: 'นัยน์ตาหยั่งรู้', icon: '🦉',
    parts: [{ hook: 'aura', effect: 'enemyVuln', value: { pct: 6 }, step: { pct: 2 } }],
    desc: 'ศัตรูทุกตัวรับดาเมจเพิ่ม {pct}%',
    short: 'ศัตรูทุกตัวรับดาเมจเพิ่ม {pct}%',
    // ⚠️ aura ที่ลงฝั่งตรงข้าม ป้ายไปโผล่บน "ตัวที่โดน" ⇒ ข้อความมุมเจ้าของอ่านกลับด้านทันที
    //    ("ศัตรูทุกตัวรับดาเมจเพิ่ม" บนเพ็ทของเราเอง = เหมือนบอกว่าเราได้เปรียบ ซึ่งตรงข้ามกับความจริง)
    shortOn: 'รับดาเมจเพิ่ม {pct}%',
  },
  seal: {
    name: 'ยอดนักซัพพอร์ต', icon: '💧',
    parts: [{
      hook: 'aura', effect: 'teamAtk',
      value: { pct: 6, duoWith: 'whale', duoPct: 10, duoRegen: 3 },
      step: { pct: 2, duoPct: 3, duoRegen: 1 },
    }],
    desc: 'พลังโจมตีทีม +{pct}% · เข้าคู่กับคุณวาฬเป็น +{duoPct}% และทีมฟื้นเลือด {duoRegen}%/รอบ',
    short: 'พลังโจมตีทีม +{pct}% (คู่กับ 🐳 เป็น +{duoPct}%)',
  },

  // ── Common ──────────────────────────────────────────────────
  hedgehog: {
    name: 'เกราะหนาม', icon: '🦔',
    parts: [{ hook: 'onHit', effect: 'thorns', value: { pct: 8 }, step: { pct: 3 } }],
    desc: 'สะท้อน {pct}% ของดาเมจที่รับกลับไปที่ผู้โจมตี',
    short: 'สะท้อน {pct}% ของดาเมจกลับไปที่ผู้โจมตี',
  },
  hamster: {
    name: 'พลังกักตุน', icon: '🐹',
    parts: [{ hook: 'onAttack', effect: 'atkWhenFull', value: { pct: 15 }, step: { pct: 5 } }],
    desc: 'ตอนเลือดเต็ม พลังโจมตี +{pct}%',
    short: 'ตอนเลือดเต็ม พลังโจมตี +{pct}%',
  },
  mouse: {
    name: 'ปราดเปรียว', icon: '🐭',
    parts: [{ hook: 'onHit', effect: 'dodge', value: { pct: 8 }, step: { pct: 2 } }],
    desc: 'โอกาสหลบการโจมตี {pct}%',
    short: 'โอกาสหลบ {pct}%',
  },
  cat: {
    // 🔴 P2c-1 Task 5: สถานะหลายชั้นตัวแรกของเกม — รอดตายด้วย cheatDeath เหมือนเดิม 1 ครั้ง
    //    แล้วได้สถานะ "ทนต่อ" ทนหมัดถึงตายอีก {grit} ครั้ง (เหลือเลือด 1 ทุกครั้ง) พร้อม atk +{atkPct}%
    //    ระหว่างมีสถานะ · รวมแล้วทนหมัดถึงตายได้ 3 ครั้ง (1 จาก cheatDeath + 2 จาก grit)
    name: 'เก้าชีวิต', icon: '🐱',
    parts: [{ hook: 'onDeath', effect: 'cheatDeath', value: { times: 1, grit: 2, atkPct: 50 },
              step: { times: 0, grit: 0, atkPct: 0 } }],
    desc: 'รอดตายได้ {times} ครั้ง แล้วทนต่ออีก {grit} หมัด · ระหว่างนั้นพลังโจมตี +{atkPct}%',
    short: 'รอดตาย {times} ครั้ง แล้วทนต่ออีก {grit} หมัด (+{atkPct}%)',
  },
  butterfly: {
    // ⚠️ เดิมเป็น teamHealOpener (ฟื้นทีมตอนเริ่ม) — วัดแล้วได้ +0.0% เป๊ะ เพราะตอนเริ่มสู้
    //    ทุกตัวเลือดเต็มอยู่แล้ว การฟื้นจึงไม่เกิดอะไรขึ้นเลย ผู้เล่นไม่มีวันรู้ว่าตัวเองมี passive
    //    ลองเป็น teamRegen 2%/รอบ แล้ววัดได้ +53% — แรงเกินเพราะฟื้นทั้งทีมทุกรอบมันทบต้น
    //    ลงตัวที่ "รุ่นอ่อนของ unicorn" ตามแพทเทิร์นเดียวกับ dodge/damageReduction ที่ common ใช้
    name: 'ละอองเยียวยา', icon: '🦋',
    parts: [{ hook: 'onRound', effect: 'healLowestAlly', value: { pct: 2 }, step: { pct: 1 } }],
    desc: 'ฟื้นเลือดเพื่อนที่บอบช้ำที่สุด {pct}% ทุกต้นรอบ',
    short: 'ฟื้นเลือดเพื่อนที่บอบช้ำสุด {pct}% ทุกต้นรอบ',
  },
  turtle: {
    name: 'กระดองศิลา', icon: '🐢',
    parts: [{ hook: 'onHit', effect: 'damageReduction', value: { pct: 12 }, step: { pct: 4 } }],
    desc: 'ลดดาเมจที่ตัวเองได้รับ {pct}%',
    short: 'ลดดาเมจที่ตัวเองได้รับ {pct}%',
  },
}

/** ค่าของ part นั้นที่ขั้นนั้น (ขั้น 1 = ค่าตั้งต้น) · clamp ขั้นไว้ 1..PASSIVE_MAX_LEVEL
 *  รับ `node` เป็น **part** เดี่ยว (`{value, step}`) เท่านั้น — ไม่ใช่ passive ทั้งตัว
 *  ⚠️ ตั้งแต่ P1 ถอดสะพานรูปเก่าทิ้งแล้ว: ถ้าส่ง passive ทั้งตัวเข้ามา (มี `parts` แต่ไม่มี `value`/`step`
 *     ที่ระดับบนสุด) ฟังก์ชันนี้จะไม่ throw แต่คืน `{}` เงียบๆ — ต้องดึง part ออกมาก่อนด้วย partAt/partsOf/partsAt */
export function passiveValueAt(node, level = 1) {
  if (!node) return {}
  const lv = Math.max(1, Math.min(PASSIVE_MAX_LEVEL, Math.round(level || 1)))
  const out = { ...(node.value || {}) }
  for (const [k, inc] of Object.entries(node.step || {})) {
    if (typeof out[k] === 'number' && inc) out[k] = Math.round((out[k] + inc * (lv - 1)) * 10) / 10
  }
  return out
}

// ════════════════════════════════════════════════════════════════════
//  ตัวช่วยอ่านรูปข้อมูล — ตรรกะทุกที่ต้องอ่านผ่านตัวช่วยพวกนี้ ห้ามแตะ p.hook/p.effect ตรงๆ
//
//  🔑 เพ็ทตัวเดียวมีได้หลายผล (บากุ = รับแทน + ฟื้นเอง) ⇒ เก็บเป็น parts[]
//  ⚠️ ระหว่าง P1 ตัวช่วยเคย "ห่อ" รูปเก่า {hook, effect} ให้เป็น 1 part ชั่วคราว
//     เพื่อให้ย้ายผู้อ่านทีละไฟล์ได้โดยเทสไม่แดง — สะพานนั้นถูกถอดทิ้งแล้วในงานย่อยสุดท้ายของ P1
// ════════════════════════════════════════════════════════════════════

/** ทุก part ของ passive — `parts` เป็นทางเดียว ไม่รองรับ hook/effect ระดับบนสุดอีกแล้ว
 *  (เคยรองรับชั่วคราวตอนย้ายโครง P1 · เก็บสองรูปไว้พร้อมกัน = สองแหล่งความจริง แล้วพังเงียบ) */
export function partsOf(p) {
  return Array.isArray(p?.parts) ? p.parts : []
}

/** ทุก part ที่ hook ตรง — ตามลำดับที่เขียนไว้ใน parts (ลำดับมีผลกับลำดับ event บนจอ) */
export const partsAt = (p, hook) => partsOf(p).filter(x => x.hook === hook)

/** part แรกที่ hook ตรง (ใช้ตอนที่ hook นั้นมีได้ part เดียวโดยธรรมชาติ) */
export const partAt = (p, hook) => partsOf(p).find(x => x.hook === hook) || null

/** part ที่ให้ผลนั้น */
export const partWithEffect = (p, effect) => partsOf(p).find(x => x.effect === effect) || null

/** ค่ารวมของทุก part สำหรับเติมข้อความ — คีย์ล้วน (part แรกที่มีคีย์นั้นชนะ)
 *  + คีย์แบบ `tag.key` สำหรับ part ที่คีย์ชนกัน (บากุมี pct สองตัว) */
function mergedValues(p, level) {
  const out = {}
  for (const part of partsOf(p)) {
    const v = passiveValueAt(part, level)
    for (const [k, val] of Object.entries(v)) {
      if (!(k in out)) out[k] = val
      if (part.tag) out[`${part.tag}.${k}`] = val
    }
  }
  return out
}

/** คำอธิบายที่เติมตัวเลขจริงของขั้นนั้นแล้ว — ห้ามพิมพ์ตัวเลขลง desc เอง */
export function passiveText(p, level = 1) {
  if (!p) return ''
  const v = mergedValues(p, level)
  return String(p.desc || '').replace(/\{([\w.]+)\}/g, (m, key) => (v[key] ?? m))
}

/** ข้อความ "ผล" สั้นๆ พร้อมเลขจริงของขั้นนั้น — ใช้ในรายการบัฟหน้า inspect
 *  ฝาแฝดของ passiveText แต่กินฟิลด์ `short` (สั้นกว่า desc · เขียนจากมุมเจ้าของสกิล)
 *  🔑 ทำไมต้องมี `short` แยกจาก STATUS_TEXT: STATUS_TEXT คีย์ด้วย *effect* แต่พาสสีฟคนละตัว
 *     ใช้ effect เดียวกันโดยให้ผลคนละอย่าง — ฟีนิกซ์ (revive ฟื้น 35%) กับแมว (cheatDeath เหลือเลือด 1)
 *     เคยอ่านได้ว่า "กันตายได้ 1 ครั้ง" เหมือนกันเป๊ะทั้งคู่ · หมาป่าได้แค่ "พลังโจมตีเพิ่ม" ที่ไม่บอกอะไรเลย
 *  ⚠️ ห้ามพิมพ์ตัวเลขลง short เอง — ใส่ {pct} {count} … แล้วให้ passiveValueAt เติมตามขั้น */
export function effectText(p, level = 1, { onTarget = false, effect = null } = {}) {
  if (!p) return ''
  const v = mergedValues(p, level)
  const tpl = (onTarget && p.shortOn) || p.short || p.desc || ''
  return String(tpl).replace(/\{([\w.]+)\}/g, (m, key) => (v[key] ?? m))
}

// ════════════════════════════════════════════════════════════════════
//  ป้ายสถานะบนการ์ดในหน้าต่อสู้ (สเปก 2026-08-28-battle-rhythm-redesign §5)
//
//  🔑 ป้ายบอก "ได้อะไร" ไม่ใช่ "ใครให้" — จึงใช้ไอคอนของ *ผล* ไม่ใช่ไอคอนประจำตัวสัตว์
//     (user สั่งตรงๆ 28 ส.ค.: "ปรับสัญลักษณ์บัฟให้เหมาะกับสกิล ไม่จำเป็นต้องหน้าตาเหมือนเจ้าของสกิล")
//  🔑 ป้ายไปอยู่ที่ "ปลายทางของผล" ไม่ใช่ที่เจ้าของสกิล — นกฮูกอยู่ทีมศัตรู แต่ 🎯 โผล่บนทีมเรา
//
//  ✅ ไอคอนทุกตัวมีไฟล์ Fluent ครบแล้วใน public/emoji/fluent/ (เช็ค 28 ส.ค.)
//     ถ้าเพิ่มตัวใหม่ ต้องรัน `node scripts/fetch-fluent.mjs` ไม่งั้น <Emoji> ตกกลับเป็น emoji ของเครื่อง
//     (🪨 ของ mammoth เป็นเคสนั้นอยู่ตอนนี้ — ไม่พัง แต่หน้าตาไม่เหมือนกันทุกเครื่อง)
// ════════════════════════════════════════════════════════════════════
export const STATUS_ICON = {
  teamHp: '❤️', teamAtk: '⚔️', teamAtkElement: '⚔️', teamCrit: '💥', enemyVuln: '🎯',
  guardian: '🛡️', damageReduction: '🧱', dodge: '💨', thorns: '⚡',
  revive: '🧿', saveAlly: '🧿', cheatDeath: '🧿', stackAtk: '⬆️',
  duoRegen: '💧',
  // ── P2 ──
  elementTrinity: '🔺', teamLifesteal: '🩸', teamDamageReduction: '🧱', atkOnHit: '💢',
  berserk: '🔥', giantSlayer: '🗡️', healOnAttack: '💞', stealStats: '🫳',
  // ── P2b ──
  // ⚠️ ไม่ใช่ 💢 ของ atkOnHit — สองอันหน้าตาเดียวกันบนการ์ดเดียวอ่านไม่ออก (ดูเทสไอคอนไม่ซ้ำท้ายไฟล์)
  // ⚠️ ไม่ใช่ 🛡️ ของ guardian ด้วยเหตุผลเดียวกัน — armorStack กับ guardian คนละความหมาย
  //    (guardian = เพื่อนรับแทนให้, armorStack = เกราะของตัวเองกันหมัดทั้งดอก) จึงเลือกไอคอนคนละตัว
  infect: '🦠', taunt: '📢', armorStack: '🏰',
  // infectBurst ไม่ต้องมีป้ายของตัวเอง — เป็น fxKind: 'damage' (event ระเบิดครั้งเดียว ไม่ใช่สถานะติดตัว)
  // ไอคอนตอนระเบิดมาจาก p.icon ของพาสสีฟไวรัสเอง (ดู ev() ใน battlePassives.js) ไม่ผ่านทะเบียนนี้เลย
  // ป้าย 'infect' ด้านบนคือตัวแทนสถานะที่ยืนพักอยู่บนการ์ด — เทสความครบท้ายไฟล์ยกเว้น infectBurst ไว้ตรงๆ
  // 🔴 P2c-1 Task 5 (แมว): 'grit' *ไม่* ได้ทะเบียนป้ายที่นี่โดยตั้งใจ — ต่างจาก armorStack/taunt/infect
  //    ที่แค่ "ยังไม่มีใครใช้" (พร้อมติดป้ายทันทีวันที่มีเพ็ทใช้ effect นั้นจริง) 'grit' ไม่มีวันเป็น
  //    part.effect เลยแม้แต่วันเดียว — มันคือ runtime state ที่เกิดจากการกิน cheatDeath (ดู
  //    battlePassives.js runOnDeath) ⇒ ใส่ป้ายไว้ที่นี่จะเป็น dead config ตลอดกาล ไม่ใช่ของที่รอวันใช้
  //    (รีวิว 5 ก.ย. ชี้ประเด็นนี้ แล้ว user เคาะให้เอาออก) ไอคอนตอนเกิด event ใช้ p.icon ของแมวเอง
  //    ตรงแพทเทิร์นเดียวกับ infectBurst/infectSpread ด้านล่าง — badge ถาวรที่อ่าน runtime จริง (ถ้าจะทำ)
  //    ต้องผ่าน liveBuffs() ไม่ใช่ buffSources() (buffSources คำนวณก่อนไฟต์เริ่ม ป้ายจะโกหกว่ามีสถานะ
  //    ตั้งแต่ยังไม่เคยกิน cheatDeath เลย) — ของค้างที่ถูกบันทึกแยกไว้แล้ว ไม่ใช่งานของ task นี้
}

/** ความหมายสั้นๆ ของป้าย — ใช้ใน aria-label และหน้า inspect */
export const STATUS_TEXT = {
  teamHp: 'เลือดสูงสุดเพิ่ม', teamAtk: 'พลังโจมตีเพิ่ม', teamAtkElement: 'พลังโจมตีเพิ่ม',
  teamCrit: 'โอกาสคริติคอลเพิ่ม', enemyVuln: 'รับดาเมจเพิ่ม',
  guardian: 'มีเพื่อนรับแทนให้', damageReduction: 'ลดดาเมจที่ได้รับ', dodge: 'มีโอกาสหลบ',
  thorns: 'ตีแล้วเจ็บกลับ', revive: 'ตายแล้วฟื้นคืนชีพได้ 1 ครั้ง', saveAlly: 'กันเพื่อนตายได้ 1 ครั้ง',
  cheatDeath: 'รอดตายด้วยเลือด 1 ได้ 1 ครั้ง', stackAtk: 'ยิ่งฆ่ายิ่งแรง',
  duoRegen: 'ทีมฟื้นเลือดทุกรอบ',
  // ── P2 ──
  elementTrinity: 'ทีมครบสายจึงแรงขึ้น', teamLifesteal: 'ตีแล้วดูดเลือด',
  teamDamageReduction: 'ทั้งทีมลดดาเมจที่ได้รับ', atkOnHit: 'ยิ่งโดนตียิ่งแรง',
  berserk: 'ยิ่งเลือดหายยิ่งแรง', giantSlayer: 'ยิ่งเป้าตัวใหญ่ยิ่งแรง',
  healOnAttack: 'ตีแล้วฟื้นเลือดเพื่อน', stealStats: 'ขโมยพลังจากศัตรู',
  // ── P2b ──
  infect: 'ติดเชื้อ ยิ่งโดนตียิ่งเจ็บ', taunt: 'บังคับให้ศัตรูตีตัวเอง', armorStack: 'มีเกราะกันหมัดเต็มใบ',
  // 'grit' ไม่มีคำอธิบายป้ายที่นี่โดยตั้งใจ — เหตุผลเดียวกับที่ไม่มีใน STATUS_ICON ด้านบน
}

/** aura ที่แผ่ใส่ "ทีมตัวเอง" — ป้ายลงทุกใบในทีมนั้น */
export const TEAM_AURA_EFFECTS = new Set(['teamHp', 'teamAtk', 'teamAtkElement', 'teamCrit',
  'elementTrinity', 'teamLifesteal', 'teamDamageReduction'])
/** aura ที่แผ่ใส่ "ทีมศัตรู" — ป้ายลงฝั่งตรงข้าม (ดีบัฟ) ⚠️ เฉพาะ effect ที่มาจาก part hook 'aura' เท่านั้น
 *  (aurasOf() ใน battleBuffs.js หาแค่ partsAt(p, 'aura') — เป็นค่า % คงที่ที่แผ่ทั้งทีมศัตรูตั้งแต่ต้นไฟต์) */
export const FOE_AURA_EFFECTS = new Set(['enemyVuln'])
/** สถานะติดตัวที่ไม่ต้องพึ่งใคร — ป้ายลงเฉพาะเจ้าตัว */
export const SELF_STATUS_EFFECTS = new Set([
  'guardian', 'damageReduction', 'dodge', 'thorns', 'revive', 'saveAlly', 'cheatDeath', 'stackAtk',
  'atkOnHit', 'berserk', 'giantSlayer', 'stealStats', 'healOnAttack',
  // ── P2b ── สถานะติดตัวเจ้าของสกิลเอง (คนละกลุ่มกับ infect ด้านล่าง ที่ลงบน "ตัวที่ถูกตี" แทน)
  'taunt', 'armorStack',
  // 'grit' ไม่อยู่ในกลุ่มนี้ (หรือกลุ่มไหนเลย) โดยตั้งใจ — ดูเหตุผลยาวที่คอมเมนต์ของ STATUS_ICON ด้านบน
])
/** ดีบัฟที่ลงบน "ตัวที่ถูกเล็ง" ทีละตัว ไม่ใช่ทั้งทีมพร้อมกัน — ต่างจาก FOE_AURA_EFFECTS ตรงที่
 *  ไม่ได้มาจาก part hook 'aura' (ค่าคงที่ตั้งแต่ต้นไฟต์) แต่มาจาก hook 'onAttack' ที่สะสมชั้นระหว่างไฟต์
 *  ลงบนตัวเป้าโดยตรง (state จริงอยู่ที่ psOf(target).infect ไม่ใช่ค่าคงที่จาก part) ⇒ aurasOf() หาไม่เจอ
 *  P2c ต้องอ่านชั้นสแตคจาก state runtime นั้นเอง ไม่ใช่ผ่าน buffSources/aurasOf ของกลุ่มสองกลุ่มบน */
export const FOE_STATUS_EFFECTS = new Set(['infect'])
/** สูงสุดกี่ป้ายต่อการ์ด — วัดจากทีมสุ่ม 5,000 คู่: เฉลี่ย 1.09 · ชนเพดาน 3 แค่ 4.7% */
export const STATUS_MAX = 3
