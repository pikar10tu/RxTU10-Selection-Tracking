// export-pet-data — รวมทุกอย่างของเพ็ท 27 ตัวเป็น JSON ก้อนเดียว
// (แคตตาล็อก + สเตตัสทุกเกรด + พาสสีฟทุกขั้นพร้อมข้อความจริง + ผลวัดจากเอนจิน)
// ใช้เป็นวัตถุดิบของ scripts/build-pet-balance-page.mjs
//
// รัน: node scripts/export-pet-data.mjs [ไฟล์ออก]   (ค่าตั้งต้น docs/pet-data.json)
import { writeFileSync } from 'node:fs'
import { PETS, RARITY, EL_NAME, ELEMENTS } from '../src/data/index.js'
import { PET_PASSIVES, passiveValueAt, passiveText, effectText, PASSIVE_MAX_LEVEL } from '../src/data/petPassives.js'
import { combatStats, petDailyCoins, expWeight, COMBAT_BASE, COMBAT_GRADE, ELEMENT_BIAS, RARITY_DAILY_BASE, GRADE_MULTI_V2, RARITY_WEIGHT } from '../src/data/petPower.js'
import { GACHA_RATES, SOFT_PITY, HARD_PITY, SOFT_PITY_STEP } from '../src/utils/gacha.js'

// ⚠️ 4 ตารางข้างล่างเป็น **ผลวัดที่ก๊อปมาวาง** ไม่ได้คำนวณสด — วัดที่ 3v3 เกรด III ขั้น 1 (31 ส.ค. 2026)
//    แก้เลข passive เมื่อไหร่ ต้องรัน 2 สคริปต์นี้แล้วเอา JSON ท้ายผลมาแทนที่:
//      node scripts/passive-power-sim.mjs 1500      → lift / fires / dbeat
//      node scripts/passive-vs-passive-sim.mjs 250  → rrFlat

const lift = {"bahamut":6.7,"kirin":18.5,"trex":4.3,"ouroboros":39.7,"simurgh":0.3,"phoenix":39.5,"whale":36.9,"qilin":-3.1,"mammoth":33.5,"dragon":39.5,"cerberus":44.7,"unicorn":44.1,"fairy":14.3,"panda":49.5,"genie":16.7,"wolf":22.3,"shark":1.3,"fox":12.7,"rabbit":8.5,"owl":27.7,"seal":27.7,"hedgehog":7.3,"hamster":3.7,"mouse":6.7,"cat":23.3,"butterfly":37.8,"turtle":21}
const fires = {"bahamut":1,"kirin":0.98,"trex":1.32,"ouroboros":11.7,"simurgh":2.74,"phoenix":0.79,"whale":1,"qilin":4.68,"mammoth":7.65,"dragon":2.99,"cerberus":2.87,"unicorn":11.21,"fairy":1,"panda":16.33,"genie":0.67,"wolf":1,"shark":0.77,"fox":0.65,"rabbit":1.54,"owl":1,"seal":1,"hedgehog":3.55,"hamster":1.18,"mouse":0.42,"cat":0.79,"butterfly":16.84,"turtle":7.36}
const rrFlat = {"bahamut":46.1,"kirin":50,"trex":44.7,"ouroboros":57.6,"simurgh":42.5,"phoenix":57.7,"whale":53.2,"qilin":39.3,"mammoth":50.9,"dragon":58.9,"cerberus":64.2,"unicorn":59.1,"fairy":46.8,"panda":65.8,"genie":44.1,"wolf":54.2,"shark":43.7,"fox":47.3,"rabbit":44.7,"owl":47.7,"seal":47.7,"hedgehog":45.8,"hamster":44.4,"mouse":45.5,"cat":49.8,"butterfly":52.8,"turtle":45.5}
const _rrRealUnused = {"bahamut":71.9,"kirin":73.2,"trex":69.7,"ouroboros":77.3,"simurgh":68.9,"phoenix":75.8,"whale":77.4,"qilin":69.8,"mammoth":74.6,"dragon":66.8,"cerberus":71.8,"unicorn":65.1,"fairy":58.5,"panda":76.2,"genie":58.9,"wolf":41.7,"shark":28.7,"fox":29.9,"rabbit":28.4,"owl":31.5,"seal":31.5,"hedgehog":17.8,"hamster":17.6,"mouse":16.4,"cat":17.7,"butterfly":17.8,"turtle":15}
const dbeat = {"bahamut":-0.3,"kirin":-0.4,"trex":-0.1,"ouroboros":1,"simurgh":0,"phoenix":1,"whale":1.1,"qilin":-0.1,"mammoth":1,"dragon":-2.4,"cerberus":-3.6,"unicorn":1,"fairy":-0.6,"panda":1.3,"genie":0.5,"wolf":-1.5,"shark":0,"fox":0.4,"rabbit":-0.3,"owl":-1.3,"seal":-1.3,"hedgehog":-0.2,"hamster":-0.2,"mouse":0.3,"cat":0.7,"butterfly":1,"turtle":0.7}

const r1 = (n) => Math.round(n * 10) / 10
const pets = PETS.map(p => {
  const pas = PET_PASSIVES[p.id] || null
  const grades = [0, 1, 2, 3, 4, 5].map(g => {
    const c = combatStats({ ...p, grade: g })
    return { g, atk: r1(c.atk), hp: r1(c.maxHp), power: r1(c.atk * c.maxHp / 100), coins: petDailyCoins({ ...p, grade: g }), exp: r1(expWeight({ ...p, grade: g })) }
  })
  return {
    id: p.id, emoji: p.emoji, name: p.name, rarity: p.rarity, rarityTh: RARITY[p.rarity].label,
    element: p.element, elementTh: EL_NAME[p.element], elEmoji: ELEMENTS[p.element].emoji,
    beats: EL_NAME[ELEMENTS[p.element].beats], flavor: p.flavor, spark: p.projectile || null,
    grades,
    passive: pas ? {
      name: pas.name, icon: pas.icon, hook: pas.hook, effect: pas.effect,
      value: pas.value, step: pas.step,
      lv: [1, 2, 3].map(l => ({ l, text: passiveText(pas, l), v: passiveValueAt(pas, l) })),
      short: effectText(pas, 1), rawDesc: pas.desc,
    } : null,
    sim: { lift: lift[p.id], fires: fires[p.id], rrFlat: rrFlat[p.id], dbeat: dbeat[p.id] },
  }
})

const meta = {
  COMBAT_BASE, COMBAT_GRADE, ELEMENT_BIAS, RARITY_DAILY_BASE, GRADE_MULTI_V2, RARITY_WEIGHT,
  GACHA_RATES, SOFT_PITY, HARD_PITY, SOFT_PITY_STEP, PASSIVE_MAX_LEVEL,
}
writeFileSync(process.argv[2] || new URL('../docs/pet-data.json', import.meta.url), JSON.stringify({ pets, meta }, null, 1))
console.log('ok', pets.length)
