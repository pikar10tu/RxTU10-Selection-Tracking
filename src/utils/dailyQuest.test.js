// เทส dailyQuest — pure (bump/reset/complete/claimable/mult)
// รัน: node --test src/utils/dailyQuest.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  questGoals, BUFF_MS, bumpDailyQuest, questComplete, questClaimable, questIncomeMult,
} from './dailyQuest.js'

const T = '2026-06-19'

test('bump: doc ว่าง → เริ่มวันนี้ +1', () => {
  const dq = bumpDailyQuest(undefined, 'quiz', T)
  assert.deepEqual(dq, { date: T, quiz: 1, farm: 0, gacha: 0, pvp: 0, claimed: false })
})

test('bump: +n สะสมในวันเดียว', () => {
  let dq = bumpDailyQuest({ date: T, quiz: 2, farm: 0, gacha: 0, claimed: false }, 'quiz', T, 3)
  assert.equal(dq.quiz, 5)
})

test('bump: ข้ามวัน → รีเซ็ตก่อนนับ (รวม claimed)', () => {
  const old = { date: '2026-06-18', quiz: 9, farm: 9, gacha: 9, claimed: true }
  const dq = bumpDailyQuest(old, 'farm', T)
  assert.deepEqual(dq, { date: T, quiz: 0, farm: 1, gacha: 0, pvp: 0, claimed: false })
})

test('questComplete: ครบทั้ง 3 (quiz5/farm3/gacha2) + วันตรง', () => {
  assert.equal(questComplete({ date: T, quiz: 5, farm: 3, gacha: 2, claimed: false }, T), true)
  assert.equal(questComplete({ date: T, quiz: 5, farm: 2, gacha: 2, claimed: false }, T), false)
  assert.equal(questComplete({ date: T, quiz: 5, farm: 3, gacha: 1, claimed: false }, T), false)
  assert.equal(questComplete({ date: '2026-06-18', quiz: 9, farm: 9, gacha: 9 }, T), false) // คนละวัน
})

test('questClaimable: ครบและยังไม่รับ', () => {
  assert.equal(questClaimable({ date: T, quiz: 5, farm: 3, gacha: 2, claimed: false }, T), true)
  assert.equal(questClaimable({ date: T, quiz: 5, farm: 3, gacha: 2, claimed: true }, T), false)
})

test('questGoals: ช่องที่ 3 สลับตาม pvpOpen', () => {
  assert.deepEqual(questGoals(true),  { quiz: 5, farm: 3, pvp: 1 })
  assert.deepEqual(questGoals(false), { quiz: 5, farm: 3, gacha: 2 })
  assert.deepEqual(questGoals(), questGoals(false))   // ลืมส่ง = พฤติกรรมเดิม ไม่ใช่เควสทำไม่ได้
})

test('questComplete เมื่อ pvpOpen เปิด: ใช้ pvp ตัดสิน gacha ไม่มีผล', () => {
  const base = { date: T, quiz: 5, farm: 3, gacha: 0, pvp: 0, claimed: false }
  assert.equal(questComplete(base, T, true), false)
  assert.equal(questComplete({ ...base, gacha: 9 }, T, true), false)   // เปิดกาชารัวก็ไม่ครบ
  assert.equal(questComplete({ ...base, pvp: 1 }, T, true), true)
})

test('questComplete เมื่อ pvpOpen ปิด: ใช้ gacha ตัดสิน pvp ไม่มีผล', () => {
  const base = { date: T, quiz: 5, farm: 3, gacha: 0, pvp: 9, claimed: false }
  assert.equal(questComplete(base, T, false), false)
  assert.equal(questComplete({ ...base, gacha: 2 }, T, false), true)
})

test('questClaimable ส่ง pvpOpen ต่อให้ questComplete', () => {
  const dq = { date: T, quiz: 5, farm: 3, gacha: 0, pvp: 1, claimed: false }
  assert.equal(questClaimable(dq, T, true), true)
  assert.equal(questClaimable(dq, T, false), false)
  assert.equal(questClaimable({ ...dq, claimed: true }, T, true), false)
})

test('bump ช่อง pvp ได้ และข้ามวันแล้วรีเซ็ต', () => {
  assert.equal(bumpDailyQuest({ date: T, quiz: 1, farm: 0, gacha: 0, pvp: 0 }, 'pvp', T).pvp, 1)
  assert.equal(bumpDailyQuest({ date: '2026-06-18', pvp: 5 }, 'pvp', T).pvp, 1)
})

test('questIncomeMult: buff active/หมดอายุ', () => {
  const now = 1_000_000
  assert.equal(questIncomeMult({ incomeBuffUntil: now + 1000 }, now), 1.5)
  assert.equal(questIncomeMult({ incomeBuffUntil: now - 1000 }, now), 1)
  assert.equal(questIncomeMult({}, now), 1)
  assert.equal(questIncomeMult(null, now), 1)
})

test('BUFF_MS = 24 ชม.', () => {
  assert.equal(BUFF_MS, 24 * 60 * 60 * 1000)
})
