// passive-pacing-sim — วัดงบเวลาของ "โมเมนต์สกิล" จาก log จริง
//
// 🔑 เหตุที่ต้องมีสคริปต์นี้: ตอนทำ battleBeats ฉบับแรกเคย "เดา" สัดส่วนแล้วคำนวณงบเวลา
//    ได้ heavy 15% แต่ของจริง 53% → ไฟต์ยาว 33 วิ นานกว่าระบบเดิม
//    ก่อนจะจูนเลขจังหวะอะไรก็ตาม **รันอันนี้ก่อนเสมอ อย่าเดา**
//
// รัน: node scripts/passive-pacing-sim.mjs
//      node scripts/passive-pacing-sim.mjs 1000     (จำนวนไฟต์)

import { simulateBattle } from '../src/utils/battleEngine.js'
import { buildBeats, totalDuration } from '../src/utils/battleBeats.js'
import { buildCombatant } from '../src/data/battle.js'
import { PETS } from '../src/data/index.js'
import { BATTLE_SLOTS } from '../src/data/residence.js'

const N = Number(process.argv[2]) || 300
const CHROME = 1100 + 900          // intro READY?/GO! + ค้างสนามท้ายไฟต์ (เท่ากับที่เทสใช้)

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const randTeam = (rand) => Array.from({ length: BATTLE_SLOTS }, () => {
  const p = PETS[Math.floor(rand() * PETS.length)]
  return { id: p.id, rarity: p.rarity, element: p.element, grade: Math.floor(rand() * 6) }
})

const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)]
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
const s1 = (ms) => (ms / 1000).toFixed(1) + 's'

const ms = [], msChrome = [], pms = [], tier = { spotlight: 0, glance: 0, mute: 0, openGroup: 0 }
const byEffect = {}
for (let seed = 1; seed <= N; seed++) {
  const rand = rng(seed * 7919)
  const A = randTeam(rand), B = randTeam(rand)
  const maxHp = {}
  A.forEach((p, i) => { maxHp['A' + i] = Math.round(buildCombatant(p).maxHp) || 1 })
  B.forEach((p, i) => { maxHp['B' + i] = Math.round(buildCombatant(p).maxHp) || 1 })

  const beats = buildBeats(simulateBattle(A, B, seed).log, maxHp)
  for (const b of beats) {
    if (!b.pTier) continue
    tier[b.pTier]++
    byEffect[b.effect || '?'] = (byEffect[b.effect || '?'] || 0) + 1
  }
  const d = totalDuration(beats)
  ms.push(d)
  msChrome.push(d + CHROME)
  pms.push(beats.filter(b => b.pTier)
    .reduce((a, b) => a + b.timing.windup + b.timing.motion + b.timing.hitstop + b.timing.tail, 0))
}

console.log(`ทีม ${BATTLE_SLOTS}v${BATTLE_SLOTS} สุ่มสปีชีส์/เกรด 0–5 · ${N} ไฟต์\n`)
// เพดานคิดจาก "เวลาของ log" ล้วน ไม่รวม intro READY?/GO! กับช่วงค้างสนามท้ายไฟต์
// เพราะ CHROME เป็นค่าคงที่ 2 วิ ที่ไม่เกี่ยวกับฟีเจอร์นี้ — เอามารวมแล้วเพดานจะจับผิดตัว
console.log(`เวลาไฟต์   avg ${s1(avg(ms))}  p50 ${s1(q(ms, .5))}  p90 ${s1(q(ms, .9))}  max ${s1(Math.max(...ms))}`)
console.log(`  + intro/สรุป avg ${s1(avg(msChrome))}  p90 ${s1(q(msChrome, .9))}   (สิ่งที่ผู้เล่นนั่งดูจริง)`)
console.log(`passive กิน avg ${s1(avg(pms))}  p90 ${s1(q(pms, .9))}  max ${s1(Math.max(...pms))}\n`)
console.log('ชั้นของ passive (ครั้ง/ไฟต์):')
for (const [k, v] of Object.entries(tier)) console.log(`  ${k.padEnd(10)} ${(v / N).toFixed(2)}`)
console.log('\n5 effect ที่เกิดบ่อยสุด (ครั้ง/ไฟต์):')
for (const [k, v] of Object.entries(byEffect).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${k.padEnd(18)} ${(v / N).toFixed(2)}`)
}

// เพดานตามสเปก 2026-08-28-skill-moment — เกินเมื่อไหร่ = จังหวะบวมเกินที่ตกลงกันไว้
const capAvg = 21000, capP90 = 26000
const bad = avg(ms) > capAvg || q(ms, .9) > capP90
console.log(`\n${bad ? '❌ เกินเพดาน' : '✅ อยู่ในเพดาน'} (avg ≤ ${s1(capAvg)} · p90 ≤ ${s1(capP90)})`)
process.exit(bad ? 1 : 0)
