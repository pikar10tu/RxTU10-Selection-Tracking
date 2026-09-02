// passive-power-sim — วัดว่า passive แต่ละตัว "มีผลจริงแค่ไหน" ด้วยเอนจินตัวจริง
//
// 🔑 เหตุที่ต้องมีสคริปต์นี้: ตัวเลขในหัวเรื่อง passive เดาไม่ได้เลย
//    ตัวที่ฟังดูโหด (guardian รับดาเมจแทน 50%) วัดแล้วติดลบ · ตัวที่ฟังดูจิ๊บจ๊อย (ฟื้น 2%/รอบ) วัดแล้วบวก 38%
//    ก่อนจะจูนเลข passive อะไรก็ตาม **รันอันนี้ก่อนเสมอ อย่าเดา**
//
// วิธี: ทีม A = [เพ็ทที่จะวัด + เพื่อน "ไร้ passive" ให้ครบทีม] ปะทะ ทีม B = ไร้ passive ล้วน
//       เพื่อนไร้ passive = `id: '__blank__'` (id ที่ PET_PASSIVES ไม่รู้จัก ⇒ ไม่มี passive
//       แต่ยังได้สเตตัสจาก rarity/element/grade ตามปกติ) ตั้งให้ตรงกับเพ็ทที่วัดเป๊ะ
//       ⇒ ส่วนต่างจาก baseline = ผลของ passive ล้วนๆ ไม่ปนสเตตัส
//
// ⚠️ อ่านผลอย่างไร: นี่คือ "มี passive ตัวเดียวในทีม" — ทีมจริงมี passive ครบทุกช่องแล้วเบียดกันเอง
//    เลขจริงในเกมจะต่ำกว่านี้ทุกตัว · ใช้เทียบ **ลำดับก่อนหลัง** ได้ ใช้เป็นค่าสัมบูรณ์ไม่ได้
//
// รัน: node scripts/passive-power-sim.mjs [ไฟต์ต่อตัว] [ขั้นพาสสีฟ 1-3]
//      node scripts/passive-power-sim.mjs 1500 1
import { simulateBattle } from '../src/utils/battleEngine.js'
import { PETS } from '../src/data/index.js'
import { PET_PASSIVES, partsOf } from '../src/data/petPassives.js'
import { BATTLE_SLOTS } from '../src/data/residence.js'

const N = Number(process.argv[2]) || 1500
const LV = Number(process.argv[3]) || 1
const GRADE = 3

// 🔴 จำนวนช่องทีมมาจาก BATTLE_SLOTS เท่านั้น — เคยมี BATTLE_CFG.teamSize: 4 ค้างอยู่ใน data/battle.js
//    ไม่มีใครอ่าน แต่หลอกให้วัดผิดเป็น 4v4 มาแล้วทั้งรอบ (ลบทิ้งแล้ว 31 ส.ค. 2026)
const blank = (rarity, element) => ({ id: '__blank__', rarity, element, grade: GRADE })
const fill = (p, lead) => [lead, ...Array.from({ length: BATTLE_SLOTS - 1 }, () => blank(p.rarity, p.element))]
const mk = (p) => ({ id: p.id, rarity: p.rarity, element: p.element, grade: GRADE, passiveLv: LV })

function run(teamA, teamB, countUid) {
  let win = 0, fires = 0, beats = 0
  for (let s = 1; s <= N; s++) {
    const r = simulateBattle(teamA, teamB, s * 2654435761)
    if (r.winner === 'A') win++
    if (countUid) fires += r.log.filter(e => e.t === 'passive' && e.uid === countUid).length
    beats += r.log.filter(e => e.t === 'attack' && !e.sub).length   // sub = หมัดลูกใน beat เดียวกัน
  }
  return { wr: win / N, fires: fires / N, beats: beats / N }
}

// baseline ทีมเปล่า vs ทีมเปล่า — ควรอยู่ราว 50% ทุกช่อง (เช็คว่าเอนจินไม่เอนข้างไหน)
const base = {}, baseBeat = {}
for (const el of ['fist', 'scissors', 'paper']) {
  for (const rar of ['common', 'rare', 'epic', 'legendary']) {
    const t = Array.from({ length: BATTLE_SLOTS }, () => blank(rar, el))
    const r = run(t, t)
    base[rar + '|' + el] = r.wr
    baseBeat[rar + '|' + el] = r.beats
  }
}

const rows = []
for (const p of PETS) {
  const pas = PET_PASSIVES[p.id]
  if (!pas) continue
  const key = p.rarity + '|' + p.element
  const r = run(fill(p, mk(p)), Array.from({ length: BATTLE_SLOTS }, () => blank(p.rarity, p.element)), 'A0')
  const parts = partsOf(pas)
  rows.push({
    id: p.id, name: p.name, rarity: p.rarity, element: p.element,
    passive: pas.name, effect: parts.map(x => x.effect).join('+'), hook: parts.map(x => x.hook).join('+'),
    wr: r.wr * 100, lift: (r.wr - base[key]) * 100,
    fires: r.fires, dbeat: r.beats - baseBeat[key],
  })
}

const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].length))
console.log(`\n═══ ผลจริงของ passive · ${BATTLE_SLOTS}v${BATTLE_SLOTS} · ${N} ไฟต์/ตัว · เกรด ${GRADE} · ขั้น ${LV} ═══`)
console.log('baseline:', Object.entries(base).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(' · '), '\n')
console.log(pad('เพ็ท', 14) + pad('สาย', 10) + pad('ระดับ', 11) + pad('พาสสีฟ', 22) + pad('ชนะ%', 8) + pad('ส่วนต่าง', 10) + pad('ติด/ไฟต์', 10) + 'หมัด±')
for (const r of rows.slice().sort((a, b) => b.lift - a.lift)) {
  console.log(
    pad(r.name, 14) + pad(r.element, 10) + pad(r.rarity, 11) + pad(r.passive, 22) +
    pad(r.wr.toFixed(1), 8) + pad((r.lift >= 0 ? '+' : '') + r.lift.toFixed(1), 10) +
    pad(r.fires.toFixed(2), 10) + (r.dbeat >= 0 ? '+' : '') + r.dbeat.toFixed(1)
  )
}
console.log('\nJSON:')
console.log(JSON.stringify(rows.map(r => ({
  id: r.id, lift: +r.lift.toFixed(1), fires: +r.fires.toFixed(2), dbeat: +r.dbeat.toFixed(1),
}))))
