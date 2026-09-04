// battle-differential — พิสูจน์ว่า "เกมไม่เปลี่ยน" ด้วยการยิงไฟต์ล็อกซีดเทียบกับ base tree
//
// 🔑 ใช้ทุกครั้งที่แก้เอนจิน/พาสสีฟแล้วอ้างว่า "พฤติกรรมเหมือนเดิม" — แข็งแรงกว่า sim
//    เพราะเทียบ log ทีละไบต์ ไม่ใช่เทียบค่าเฉลี่ยที่กลบความต่างเล็กๆ ได้
//
// รัน: node scripts/battle-differential.mjs <base-sha>
//   <base-sha> ปกติคือจุดที่บรานช์ปัจจุบันแยกจาก master — หาได้จาก `git merge-base master HEAD`
//
// Exit code: 0 = ไม่มีไฟต์ไหนต่าง (ผ่าน) · 1 = มีไฟต์ต่างอย่างน้อย 1 ไฟต์ (เกมเปลี่ยนพฤติกรรม)
//            2 = เรียกสคริปต์ผิด (ไม่ได้ใส่ base sha)
// สิ่งที่นับว่า "ต่าง": winner + log + units (สเตตัสหลัง aura = ตัวหารหลอดเลือดของรีเพลย์) + rounds
// บรรทัด "ℹ️ จังหวะ" ท้ายผลเป็นข้อมูลประกอบล้วน **ไม่มีผลกับ exit code** — ดูเหตุผลที่ cmp()
//
// ประชากรที่ทดสอบ: ตอนนี้เพ็ททุกตัวใน PETS มี PET_PASSIVES ครบ (27/27) — ไม่มีตัวไหนถูกกรองออก
// ถ้าวันไหนมีเพ็ทลงทะเบียนแล้วยังไม่มี passive (เช่นระหว่างพัฒนา P3) สคริปต์จะพิมพ์ WARNING
// เตือนชื่อเพ็ทที่ถูกตัดออกก่อนรันเทียบ — อย่าเห็น "ต่างกัน 0" แล้ววางใจโดยไม่เช็ค warning นั้นก่อน
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = process.argv[2]
if (!BASE) { console.error('ใส่ base sha ด้วย: node scripts/battle-differential.mjs <sha>'); process.exit(2) }

const dir = mkdtempSync(join(tmpdir(), 'rxtu-diff-'))
let exitCode = 0

// try/finally ครอบตั้งแต่ extract เป็นต้นไป — ลบ temp dir แม้พังตอน git archive/tar หรือ import
// (ไม่ใช่แค่ throw กลางลูป cmp() — นั่นคือจุดที่พังจริงตอน debug บน Windows)
// 🔒 ห้ามเรียก process.exit() ข้างในบล็อกนี้ — process.exit() ตัดจบทันทีโดยไม่รัน finally
//    (เทสแล้ว: try{process.exit(0)}finally{...} ไม่พิมพ์ฝั่ง finally เลย) เก็บผลไว้ที่ exitCode
//    แล้วค่อย process.exit(exitCode) หลัง try/finally จบ เพื่อให้ rmSync รันแน่นอนทุกกรณี
try {
  // Windows: GNU tar ที่มากับ Git for Windows (MSYS build) เข้าใจ path แบบ "C:\Users\..." ผิด
  // ว่าเป็น remote spec สไตล์ ssh ("host:path") เพราะมี ":" ตามด้วย "\" — เลย fail ด้วย
  // "Cannot open ... No such file or directory" แม้โฟลเดอร์มีจริง ใช้ "/" แทนแก้ได้
  // (path แบบ C:/Users/... ไม่โดน parse เป็น remote) — dir ตัวจริงยังเป็น Windows-style ไว้ให้ import ด้านล่างใช้
  const tarDir = dir.replace(/\\/g, '/')
  execSync(`git archive ${BASE} src | tar -x -C "${tarDir}"`, { stdio: 'inherit' })

  const here = await import('../src/utils/battleEngine.js')
  const base = await import(pathToFileURL(join(dir, 'src/utils/battleEngine.js')).href)
  const hereBeats = await import('../src/utils/battleBeats.js')
  const baseBeats = await import(pathToFileURL(join(dir, 'src/utils/battleBeats.js')).href)
  const { PETS } = await import('../src/data/index.js')
  const { BATTLE_SLOTS } = await import('../src/data/residence.js')
  const { PET_PASSIVES } = await import('../src/data/petPassives.js')

  const ids = PETS.filter(p => PET_PASSIVES[p.id])
  if (ids.length !== PETS.length) {
    const excluded = PETS.filter(p => !PET_PASSIVES[p.id]).map(p => p.id)
    console.warn(`⚠️  WARNING: ${excluded.length} เพ็ทไม่มี PET_PASSIVES เลยถูกตัดออกจากการเทียบ: ${excluded.join(', ')}`)
    console.warn(`   ผล "ต่างกัน 0" ด้านล่างครอบคลุมแค่ ${ids.length}/${PETS.length} เพ็ท ไม่ใช่ทั้งหมด`)
  }
  const mk = (p) => ({ id: p.id, rarity: p.rarity, element: p.element, grade: 3 })

  // ตัวหารของหลอดเลือดที่ BattleReplay ใช้จริง (result.units หลัง aura) — ป้อนให้ buildBeats เหมือนกันเป๊ะ
  const mhOf = (r) => Object.fromEntries(Object.entries(r.units || {}).map(([uid, s]) => [uid, Math.round(s.maxHp) || 1]))
  const durOf = (bs) => bs.reduce((s, b) => s + b.timing.windup + b.timing.motion + b.timing.hitstop + b.timing.tail, 0)

  // เก็บ "ชุด id ของทั้งสองทีม" ของทุกไฟต์ที่ผลต่างกัน — ใช้ตอบว่า "ที่เปลี่ยนคือตัวที่เราตั้งใจแก้
  // เท่านั้นจริงไหม" ด้วยคำถามที่ถูกกว่าการนับว่าใครอยู่ในไฟต์ที่ต่างบ้าง (ทีมมีเพื่อนร่วมทีมคงที่
  // qilin/genie เสมอ นับแบบนั้นใครๆ ก็ติดโผ) — คำถามที่ถูกคือ "มีไฟต์ที่ต่างกัน โดยไม่มีตัวนี้อยู่เลย
  // กี่ไฟต์" ถ้าตอบ 0 แปลว่าตัวนั้นอยู่ในทุกไฟต์ที่ต่าง = ตัวการจริง ส่วนตัวที่เป็นแค่เพื่อนร่วมทีม/
  // คู่ต่อสู้ที่บังเอิญโดนจับคู่ จะมีไฟต์ที่ต่างกันแบบไม่มีมันอยู่เสมอ (>0)
  const badFights = []
  let n = 0, bad = 0, beatBad = 0, durBad = 0
  const cmp = (A, B, seed) => {
    n++
    const a = here.simulateBattle(A, B, seed)
    const b = base.simulateBattle(A, B, seed)
    // 🔑 เทียบ units กับ rounds ด้วย ไม่ใช่แค่ winner+log:
    //    units = สเตตัสหลัง aura ที่รีเพลย์ใช้เป็น "ตัวหาร" ของหลอดเลือด ⇒ เพี้ยนเมื่อไหร่หลอดผิดสัดส่วน
    //    ทั้งที่ log เหมือนเดิมทุกไบต์ (ช่องโหว่จริงของสคริปต์รุ่นแรก) · rounds ไปโผล่ในหน้าสรุปผล
    if (JSON.stringify({ w: a.winner, l: a.log, u: a.units, r: a.rounds })
        !== JSON.stringify({ w: b.winner, l: b.log, u: b.units, r: b.rounds })) {
      bad++
      if (bad <= 3) console.error('ต่างกันที่ซีด', seed, A.map(x => x.id).join('+'), 'vs', B.map(x => x.id).join('+'))
      badFights.push(new Set([...A, ...B].map(u => u.id)))
    }
    // ── ข้อมูลประกอบ (ไม่มีผลกับ exit code) ── จังหวะ/เวลาเล่าเรื่องของรีเพลย์
    // ✅ อัปเดต P2c-1: บั๊ก "🦖 ทีเร็กซ์ ได้ stackAtk สองใบติดกันต่อการล้ม 1 ตัว" (battleEngine
    //    เรียก runOnKill ซ้ำเมื่อศัตรูยังเหลือ) **แก้แล้วในเฟสนี้** — ไม่ใช่ของค้างที่ยกให้ P2c อีกต่อไป
    //    kind/duration ที่ต่างกันตอนนี้ = "พฤติกรรมที่แก้แล้ว" เทียบกับ "พฤติกรรมบั๊กเดิมของ base"
    //    นั่นแหละคือสิ่งที่การเทียบนี้ตั้งใจจะแสดง ไม่ใช่สัญญาณว่ามีอะไรเหลือให้ไล่ตาม
    //    🔴 ต้นเหตุของ kind/duration ต่างกัน **ไม่ใช่** แค่ "chip SKILL_PAUSE ย้ายไปอยู่คนละ event"
    //    (ส่วนนั้นมีจริงแต่หักลบกันเองเป็น net-zero เสมอ — ดูสูตร ev. ด้านล่าง) ต้นเหตุจริงที่ทำให้
    //    เวลารวมต่างกันคือ: การเรียกซ้ำเคย apply `killer.atk *= 1+pct/100` สองรอบต่อการฆ่า 1 ครั้ง
    //    (ATK พองจาก +12% เป็น ~+25% ต่อคีย์นั้น) ดาเมจที่พองนี้เปลี่ยนได้ว่าหมัดไหนน็อกใครลง
    //    ⇒ เปลี่ยนลำดับการตาย/จำนวนยกทั้งไฟต์ (วัดจริง 8/10 ไฟต์ที่ duration ต่างกัน มี rounds ต่างด้วย
    //    และ 3/10 ถึงกับเปลี่ยนผู้ชนะ) ⇒ 'ko'/'finish' ไปติดคนละ attack event กันข้ามเวอร์ชัน (finish
    //    หนักกว่า ko มาก: BEAT×4 vs BEAT×2) — นี่คือของจริงที่ควรเกิด เพราะบั๊กเดิมไม่ใช่แค่ log ผิด
    //    มันคือ trex แรงเกินจริงมาตั้งแต่ ส.ค. ⇒ แก้แล้วผลการต่อสู้บางไฟต์เปลี่ยนถูกต้องแล้ว
    //    ที่นี่รายงานเฉยๆ ห้ามทำให้แดง (informational เท่านั้น ไม่กระทบ exit code)
    const bsA = hereBeats.buildBeats(a.log, mhOf(a))
    const bsB = baseBeats.buildBeats(b.log, mhOf(b))
    if (JSON.stringify(bsA.map(x => x.kind)) !== JSON.stringify(bsB.map(x => x.kind))) beatBad++
    if (Math.abs(durOf(bsA) - durOf(bsB)) > 1e-6) durBad++
  }

  // ทุกคู่เพ็ท × 3 ซีด — ทีมเติมด้วย 🛡️ กับ 🧞 ให้ guardian/saveAlly ได้ทำงานด้วย
  for (const p of ids) for (const q of ids) for (let s = 1; s <= 3; s++) {
    cmp([mk(p), mk(PETS.find(x => x.id === 'qilin')), mk(PETS.find(x => x.id === 'genie'))].slice(0, BATTLE_SLOTS),
        [mk(q), mk(PETS.find(x => x.id === 'qilin')), mk(PETS.find(x => x.id === 'genie'))].slice(0, BATTLE_SLOTS),
        s * 2654435761)
  }
  // 3v3 สุ่มอีก 400 ไฟต์ ให้เจอส่วนผสมที่ลูปคู่ไม่ครอบคลุม
  let seed = 12345
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 0; i < 400; i++) {
    const team = () => Array.from({ length: BATTLE_SLOTS }, () => mk(ids[Math.floor(rnd() * ids.length)]))
    cmp(team(), team(), Math.floor(rnd() * 1e9))
  }

  console.log(`เทียบ ${n} ไฟต์ · ต่างกัน ${bad}`)
  if (bad) {
    const allPets = new Set()
    for (const s of badFights) for (const id of s) allPets.add(id)
    // ต่อเพ็ทแต่ละตัว: จำนวนไฟต์ที่ต่างกัน "โดยไม่มีตัวนี้อยู่เลย" — 0 = อยู่ในทุกไฟต์ที่ต่าง (ตัวการจริง)
    const withoutCount = (id) => badFights.reduce((n, s) => n + (s.has(id) ? 0 : 1), 0)
    const rows = [...allPets].map(id => [id, withoutCount(id)])
      .sort((a, b) => a[1] - b[1]).map(([id, n]) => `${id} ${n}`)
    console.log('เพ็ทที่อยู่ในไฟต์ที่ต่าง (เรียงตาม "ไฟต์ที่ต่างโดยไม่มีตัวนี้" — 0 = อยู่ในทุกไฟต์ที่ต่าง):')
    console.log('  ' + rows.join(' · '))
  }
  console.log(`ℹ️  จังหวะ (ไม่นับเป็นเงื่อนไขผ่าน): kind ต่างกัน ${beatBad} ไฟต์ · เวลารวมต่างกัน ${durBad} ไฟต์`)
  // ต้นเหตุของตัวเลขนี้ (P2c-1): ATK ที่เคยพองจากบั๊ก runOnKill เรียกซ้ำ เปลี่ยนลำดับการตาย/จำนวนยก
  // จริงในบางไฟต์ (ไม่ใช่แค่ chip ย้ายที่ — นั่น net-zero) ดูรายละเอียดที่คอมเมนต์ใน cmp() ด้านบน
  exitCode = bad === 0 ? 0 : 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}

process.exit(exitCode)
