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

  let n = 0, bad = 0
  const cmp = (A, B, seed) => {
    n++
    const a = here.simulateBattle(A, B, seed)
    const b = base.simulateBattle(A, B, seed)
    if (JSON.stringify({ w: a.winner, l: a.log }) !== JSON.stringify({ w: b.winner, l: b.log })) {
      bad++
      if (bad <= 3) console.error('ต่างกันที่ซีด', seed, A.map(x => x.id).join('+'), 'vs', B.map(x => x.id).join('+'))
    }
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
  exitCode = bad === 0 ? 0 : 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}

process.exit(exitCode)
