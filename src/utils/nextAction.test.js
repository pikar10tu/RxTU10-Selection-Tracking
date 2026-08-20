import test from 'node:test'
import assert from 'node:assert/strict'
import { nextAction, BATTLE_TEAM_SIZE } from './nextAction.js'

const TODAY = '2026-07-30'
const NOW = 1_800_000_000_000
const ctx = { today: TODAY, now: NOW }

// ผู้ใช้ที่ผ่านทุกกฎแล้ว = การ์ดต้องหาย (ใช้เป็นฐานแล้วถอยทีละกฎ)
function allDone() {
  return {
    // dailyQuest.date===today && quiz>0 คือสัญญาณเดียวที่ QuizView เขียนจริง — ครอบทั้งกฎ 1 (ทำข้อสอบวันนี้) และกฎ 4 (เควส)
    dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: true },
    pets: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    activePets: ['p1', 'p2', 'p3'],
    farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, { seedId: 's' }] },
    expedition: { missionId: 'm1' },
  }
}

test('ไม่เข้าเงื่อนไขไหนเลย → null (ซ่อนการ์ด)', () => {
  assert.equal(nextAction(allDone(), ctx), null)
})

test('userData ว่าง/undefined → null (ไม่ throw)', () => {
  assert.equal(nextAction(undefined, ctx), null)
  assert.equal(nextAction(null, ctx), null)
})

test('กฎ 1: dailyQuest เป็นของเมื่อวาน → quiz-today (ยังไม่ได้ทำข้อสอบวันนี้)', () => {
  const u = { ...allDone(), dailyQuest: { date: '2026-07-29', quiz: 5, farm: 3, gacha: 2, claimed: true } }
  assert.equal(nextAction(u, ctx).key, 'quiz-today')
  assert.equal(nextAction(u, ctx).to, '/quiz')
})

test('กฎ 1: dailyQuest.date วันนี้ + quiz>0 → ไม่ได้ quiz-today (ทำข้อสอบวันนี้แล้วจริง)', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 1, farm: 0, gacha: 0, claimed: false } }
  assert.notEqual(nextAction(u, ctx).key, 'quiz-today')
})

test('กฎ 2: ยังไม่มีเพ็ท → first-pet', () => {
  const u = { ...allDone(), pets: [] }
  assert.equal(nextAction(u, ctx).key, 'first-pet')
  assert.equal(nextAction(u, ctx).to, '/shop')
})

test('กฎ 3: ทีมไม่ครบ → team', () => {
  const u = { ...allDone(), activePets: ['p1', null, null] }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'team')
  assert.match(a.title, new RegExp(String(BATTLE_TEAM_SIZE)))
})

test('กฎ 4: เควสวันนี้ยังไม่กดรับ → quest (เปิด sheet ไม่ใช่ route)', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: false } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'quest')
  assert.equal(a.sheet, 'quest')
  assert.equal(a.to, undefined)
})

test('กฎ 4: เควสครบแล้วแต่ยังไม่กดรับ → quest (ข้อความ "ครบแล้ว")', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: false } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'quest')
  assert.equal(a.sheet, 'quest')
  assert.match(a.title, /ครบแล้ว/)
  assert.equal(a.cta, 'ไปกดรับ')
})

test('กฎ 4: เควสยังไม่ครบ claimed false → quest (ข้อความ "ยังไม่ครบ")', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 2, farm: 1, gacha: 0, claimed: false } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'quest')
  assert.equal(a.sheet, 'quest')
  assert.match(a.title, /ยังไม่ครบ/)
  assert.equal(a.cta, 'ดูเควส')
})

test('กฎ 5: มีแปลงว่างในช่วงที่ปลดล็อกแล้ว → farm-empty', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, null] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 5: array สั้นกว่า plotsUnlocked = ช่องที่เหลือถือว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 3, plots: [{ seedId: 's' }] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 5: แปลงที่ยังไม่ปลดล็อก ไม่นับว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 1, plots: [{ seedId: 's' }, null, null] } }
  // allDone() ผ่านทุกกฎ · แปลงปลดล็อกเพียง 1 ม่ายอาร์ด + มีพืช ⇒ ไม่มี empty plot ⇒ null
  assert.equal(nextAction(u, ctx), null)
})

test('กฎ 6: ไม่มีสายผจญภัยอยู่ + ฟีเจอร์เปิด → expedition', () => {
  // ต้องส่ง expeditionOpen ตั้งแต่ 21 ส.ค. — ปิดอยู่ = ข้ามกฎนี้ทั้งข้อ (ดูเทสท้ายไฟล์)
  const u = { ...allDone(), expedition: null }
  assert.equal(nextAction(u, { ...ctx, expeditionOpen: true }).key, 'expedition')
})

test('ลำดับ: ควิซชนะการเรียนแฟลชการ์ด (เข้าหลายกฎพร้อมกัน)', () => {
  const u = { ...allDone(), pets: [], activePets: [], expedition: null,
    dailyQuest: { date: '2026-07-29', quiz: 5, farm: 3, gacha: 2, claimed: true },
    farm: { plotsUnlocked: 2, plots: [null, null] } }
  assert.equal(nextAction(u, ctx).key, 'quiz-today')
})

test('ลำดับ: ควิซชนะทุกอย่างที่เหลือ (ยังไม่ทำข้อสอบวันนี้ ต่อให้ไม่มีเพ็ทด้วย)', () => {
  const base = { ...allDone(),
    dailyQuest: { date: '2026-07-29', quiz: 0, farm: 0, gacha: 0, claimed: false }, pets: [] }
  assert.equal(nextAction(base, ctx).key, 'quiz-today')
})

test('ลำดับ: บัญชีใหม่ไม่มีเพ็ท → first-pet ชนะเควส (แม้เควสวันนี้ยังไม่ครบ/ยังไม่กดรับ)', () => {
  const u = { ...allDone(),
    dailyQuest: { date: TODAY, quiz: 5, farm: 0, gacha: 0, claimed: false }, pets: [] }
  assert.equal(nextAction(u, ctx).key, 'first-pet')
})

test('ลำดับ: ทีมไม่ครบชนะแปลงว่างและผจญภัยว่าง', () => {
  const u = { ...allDone(), activePets: ['p1', null], farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, null] }, expedition: null }
  assert.equal(nextAction(u, ctx).key, 'team')
})

test('ไม่มี today ใน ctx → ข้ามกฎที่ต้องใช้วันที่ ไม่ throw', () => {
  const u = { ...allDone() }
  const a = nextAction(u, { now: NOW })
  assert.equal(a, null)
})

test('ไม่แนะนำแฟลชการ์ดอีกแล้ว (ถอดออก 31 ก.ค.)', () => {
  // ผู้ใช้ที่ทำข้อสอบแล้ว, มีเพ็ท, ทีมครบ, เควสครบและกดรับแล้ว, ฟาร์มเต็ม, ส่งผจญภัยแล้ว
  // = ทุกกฎหลัก = ต้องได้ null ไม่ใช่แนะนำแฟลชการ์ด
  const u = {
    dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: true },
    pets: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    activePets: ['p1', 'p2', 'p3'],
    farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, { seedId: 's' }] },
    expedition: { missionId: 'm1' },
  }
  const result = nextAction(u, ctx)
  assert.equal(result, null, 'ต้องได้ null เมื่อทุกกฎหลักเป็นจริง (ไม่ได้ study-new/study-due)')
})

// ── ปิด Expedition แล้วต้องไม่เสนอให้ส่งผจญภัย (21 ส.ค.) ──
// allDone() คืน user ที่ expedition: { missionId: 'm1' } อยู่แล้ว จึงต้อง override เป็น null
// ให้ตกมาถึงกฎข้อ 6 (ส่งผจญภัย) ซึ่งเป็นกฎสุดท้าย
function readyForExpedition() {
  return { ...allDone(), expedition: null }
}

test('ctx ไม่ได้เปิด expedition → ไม่เสนอส่งผจญภัย', () => {
  assert.equal(nextAction(readyForExpedition(), ctx), null)
})

test('ctx.expeditionOpen = true → เสนอส่งผจญภัยเหมือนเดิม', () => {
  const a = nextAction(readyForExpedition(), { ...ctx, expeditionOpen: true })
  assert.equal(a?.key, 'expedition')
  assert.equal(a?.to, '/play/pets')
})

test('expeditionOpen ต้องเป็น boolean true เท่านั้น', () => {
  assert.equal(nextAction(readyForExpedition(), { ...ctx, expeditionOpen: 'true' }), null)
  assert.equal(nextAction(readyForExpedition(), { ...ctx, expeditionOpen: 1 }), null)
})
