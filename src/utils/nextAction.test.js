import test from 'node:test'
import assert from 'node:assert/strict'
import { nextAction, BATTLE_TEAM_SIZE } from './nextAction.js'

const TODAY = '2026-07-30'
const NOW = 1_800_000_000_000
const ctx = { today: TODAY, now: NOW }

// ผู้ใช้ที่ผ่านทุกกฎแล้ว = การ์ดต้องหาย (ใช้เป็นฐานแล้วถอยทีละกฎ)
function allDone() {
  return {
    studyReviewedTotal: 10,
    study: { cards: { a: { nextReviewDate: NOW + 999_999 } } },
    quizCoinDate: TODAY,
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

test('กฎ 1: ยังไม่เคยทบทวนเลย → study-new', () => {
  const u = { ...allDone(), studyReviewedTotal: 0 }
  assert.equal(nextAction(u, ctx).key, 'study-new')
  assert.equal(nextAction(u, ctx).to, '/study')
})

test('กฎ 1 ครอบเคสฟิลด์หายด้วย (คนใหม่จริงๆ ไม่มีฟิลด์เลย)', () => {
  assert.equal(nextAction({}, ctx).key, 'study-new')
})

test('กฎ 2: มีการ์ดครบกำหนด → study-due พร้อมจำนวนในหัวข้อ', () => {
  const u = { ...allDone(), study: { cards: {
    a: { nextReviewDate: NOW - 1 }, b: { nextReviewDate: NOW }, c: { nextReviewDate: NOW + 1 },
  } } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'study-due')
  assert.match(a.title, /2/)            // a และ b ครบกำหนด (<= now) · c ยังไม่ถึง
})

test('กฎ 3: วันนี้ยังไม่ทำข้อสอบ → quiz-today', () => {
  const u = { ...allDone(), quizCoinDate: '2026-07-29' }
  assert.equal(nextAction(u, ctx).key, 'quiz-today')
  assert.equal(nextAction(u, ctx).to, '/quiz')
})

test('กฎ 4: เควสวันนี้ยังไม่กดรับ → quest (เปิด sheet ไม่ใช่ route)', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: false } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'quest')
  assert.equal(a.sheet, 'quest')
  assert.equal(a.to, undefined)
})

test('กฎ 5: ยังไม่มีเพ็ท → first-pet', () => {
  const u = { ...allDone(), pets: [] }
  assert.equal(nextAction(u, ctx).key, 'first-pet')
  assert.equal(nextAction(u, ctx).to, '/shop')
})

test('กฎ 6: ทีมไม่ครบ → team', () => {
  const u = { ...allDone(), activePets: ['p1', null, null] }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'team')
  assert.match(a.title, new RegExp(String(BATTLE_TEAM_SIZE)))
})

test('กฎ 7: มีแปลงว่างในช่วงที่ปลดล็อกแล้ว → farm-empty', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, null] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 7: array สั้นกว่า plotsUnlocked = ช่องที่เหลือถือว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 3, plots: [{ seedId: 's' }] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 7: แปลงที่ยังไม่ปลดล็อก ไม่นับว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 1, plots: [{ seedId: 's' }, null, null] } }
  assert.notEqual(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 8: ไม่มีสายผจญภัยอยู่ → expedition', () => {
  const u = { ...allDone(), expedition: null }
  assert.equal(nextAction(u, ctx).key, 'expedition')
})

test('ลำดับ: การเรียนชนะเกมเสมอ (เข้าหลายกฎพร้อมกัน)', () => {
  const u = { ...allDone(), studyReviewedTotal: 0, pets: [], activePets: [], expedition: null,
    quizCoinDate: '2026-07-29', farm: { plotsUnlocked: 2, plots: [null, null] } }
  assert.equal(nextAction(u, ctx).key, 'study-new')
})

test('ลำดับ: ควิซชนะเควส · เควสชนะเพ็ท', () => {
  const base = { ...allDone(), quizCoinDate: '2026-07-29',
    dailyQuest: { date: TODAY, quiz: 0, farm: 0, gacha: 0, claimed: false }, pets: [] }
  assert.equal(nextAction(base, ctx).key, 'quiz-today')
  assert.equal(nextAction({ ...base, quizCoinDate: TODAY }, ctx).key, 'quest')
})

test('ไม่มี today ใน ctx → ข้ามกฎที่ต้องใช้วันที่ ไม่ throw', () => {
  const u = { ...allDone(), quizCoinDate: '2026-07-29' }
  const a = nextAction(u, { now: NOW })
  assert.equal(a, null)
})
