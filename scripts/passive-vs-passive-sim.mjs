// passive-vs-passive-sim — จัดอันดับ passive ด้วยการให้ปะทะกันเองครบทุกคู่ (round robin)
//
// 🔑 ต่างจาก passive-power-sim ตรงที่อันนี้ตอบคำถาม "ตัวไหนแรงกว่ากัน" ไม่ใช่ "ตัวนี้มีผลไหม"
//
// โหมดปกติ (`--flat`, ค่าตั้งต้น): จับทุกตัวใส่ร่าง **เอพิคเหมือนกันหมด** ⇒ ตัดข้อได้เปรียบจาก
//   สเตตัสตามระดับความหายากออก เหลือแต่ผลของ passive ล้วนๆ · 50% = เสมอ
//   ⚠️ อันนี้คือตัวที่บอกความจริงเรื่อง "บันไดความหายาก" — ถ้าไม่ตัดสเตตัสออก
//      ตำนานจะดูแรงเพราะ atk/hp ไม่ใช่เพราะ passive แล้วสรุปผิดทันที
// โหมด `--real`: ใช้ระดับจริงของแต่ละตัว ⇒ ได้ภาพ "ในเกมจริงใครแรง" (สเตตัส+passive รวมกัน)
//
// สาย fist/scissors/paper กระจายเท่ากันพอดี (9 ตัวต่อสาย) ⇒ ข้อได้เปรียบเป่ายิ้งฉุบหักล้างกันเองในตาราง
// สลับข้างทุกคู่ด้วย seed เดิม เพื่อหักอคติ "ฝั่งไหนได้ตีก่อน"
//
// รัน: node scripts/passive-vs-passive-sim.mjs [ไฟต์ต่อคู่ต่อข้าง] [--real]
//      node scripts/passive-vs-passive-sim.mjs 250
import { simulateBattle } from '../src/utils/battleEngine.js'
import { PETS } from '../src/data/index.js'
import { BATTLE_SLOTS } from '../src/data/residence.js'

const N = Number(process.argv[2]) || 250
const REAL = process.argv.includes('--real')
const GRADE = 3
const rarOf = (p) => (REAL ? p.rarity : 'epic')

const blank = (p) => ({ id: '__blank__', rarity: rarOf(p), element: p.element, grade: GRADE })
const teamOf = (p) => [
  { id: p.id, rarity: rarOf(p), element: p.element, grade: GRADE },
  ...Array.from({ length: BATTLE_SLOTS - 1 }, () => blank(p)),
]
const blankTeam = (p) => Array.from({ length: BATTLE_SLOTS }, () => blank(p))

const W = {}, G = {}
for (const p of PETS) { W[p.id] = 0; G[p.id] = 0 }

for (let i = 0; i < PETS.length; i++) {
  for (let j = i + 1; j < PETS.length; j++) {
    const a = PETS[i], b = PETS[j]
    const A = teamOf(a), B = teamOf(b)
    for (let s = 1; s <= N; s++) {
      const seed = s * 2654435761
      if (simulateBattle(A, B, seed).winner === 'A') W[a.id]++; else W[b.id]++
      if (simulateBattle(B, A, seed).winner === 'A') W[b.id]++; else W[a.id]++   // สลับข้าง
      G[a.id] += 2; G[b.id] += 2
    }
  }
}

// ไฟต์ยาว/สั้นลงกี่หมัด เทียบทีมเปล่าที่สเตตัสเท่ากัน — ใช้เฝ้างบเวลาบนจอ (ดู passive-pacing-sim)
const beatsOf = (A, B) => {
  let n = 0
  for (let s = 1; s <= 600; s++) n += simulateBattle(A, B, s * 2654435761).log.filter(e => e.t === 'attack' && !e.sub).length
  return n / 600
}
const baseBeat = {}, dbeat = {}
for (const p of PETS) {
  const k = rarOf(p) + '|' + p.element
  if (baseBeat[k] == null) baseBeat[k] = beatsOf(blankTeam(p), blankTeam(p))
  dbeat[p.id] = beatsOf(teamOf(p), blankTeam(p)) - baseBeat[k]
}

const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].length))
const rows = PETS.map(p => ({ ...p, rr: W[p.id] / G[p.id] * 100, dbeat: dbeat[p.id] }))
console.log(`\n═══ passive ปะทะ passive · ${BATTLE_SLOTS}v${BATTLE_SLOTS} · ทุกคู่ ${N * 2} ไฟต์ · ${REAL ? 'ระดับจริง' : 'ร่างเอพิคเท่ากันหมด'} ═══`)
console.log(pad('เพ็ท', 14) + pad('สาย', 10) + pad('ระดับ', 11) + pad('ชนะเฉลี่ย%', 12) + 'หมัด±')
for (const r of rows.slice().sort((a, b) => b.rr - a.rr)) {
  console.log(pad(r.name, 14) + pad(r.element, 10) + pad(rarOf(r), 11) + pad(r.rr.toFixed(1), 12) + (r.dbeat >= 0 ? '+' : '') + r.dbeat.toFixed(1))
}
console.log('\nJSON:')
console.log(JSON.stringify(rows.map(r => ({ id: r.id, rr: +r.rr.toFixed(1), dbeat: +r.dbeat.toFixed(1) }))))
