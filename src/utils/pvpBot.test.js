// src/utils/pvpBot.test.js
// เทสบอทสำรอง — สเกลตามพลังทีมผู้เล่น ไม่ใช่ตามเรต
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { botTeamOf, botTeamForPower, getFallbackBots, BOT_POWER_RATIOS } from './pvpBot.js'
import { teamPower } from './pvpCoins.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'
import { BATTLE_SLOTS } from '../data/residence.js'

test('botTeamOf: คืนทีมเต็มช่อง + deterministic ต่อ seed', () => {
  const a = botTeamOf('rare', 3, 42)
  assert.equal(a.length, BATTLE_SLOTS)
  assert.deepEqual(a, botTeamOf('rare', 3, 42))
})

test('botTeamOf: เกรดสูงกว่า = พลังมากกว่า', () => {
  assert.ok(teamPower(botTeamOf('rare', 5, 7)) > teamPower(botTeamOf('rare', 0, 7)))
})

test('botTeamForPower: พลังใกล้เป้าหมายกว่าตัวเลือกสุดขอบ', () => {
  const target = teamPower(botTeamOf('rare', 3, 11))
  const got = botTeamForPower(target, 11)
  const diff = Math.abs(teamPower(got) - target)
  assert.ok(diff <= Math.abs(teamPower(botTeamOf('common', 0, 11)) - target))
  assert.ok(diff <= Math.abs(teamPower(botTeamOf('legendary', 5, 11)) - target))
})

test('botTeamForPower: deterministic ต่อ seed', () => {
  assert.deepEqual(botTeamForPower(5000, 3), botTeamForPower(5000, 3))
})

test('botTeamForPower: target 0 หรือมหาศาล ไม่พัง', () => {
  assert.equal(botTeamForPower(0, 1).length, BATTLE_SLOTS)
  assert.equal(botTeamForPower(1e12, 1).length, BATTLE_SLOTS)
})

test('getFallbackBots: คืนตามจำนวนที่ขอ + uid ไม่ซ้ำ', () => {
  const bots = getFallbackBots(5000, 1000, 42, 3)
  assert.equal(bots.length, 3)
  assert.equal(new Set(bots.map(b => b.uid)).size, 3)
  assert.ok(bots.every(b => b.isBot === true && b.team.length === BATTLE_SLOTS))
})

test('getFallbackBots: ขอ 0 ตัว = ไม่มีบอทเลย (กระดานคนจริงเต็มแล้ว)', () => {
  assert.deepEqual(getFallbackBots(5000, 1000, 42, 0), [])
  assert.deepEqual(getFallbackBots(5000, 1000, 42, -1), [])
})

test('getFallbackBots: ตัวแรกอ่อนกว่าเรา ตัวสองแกร่งกว่าเรา (ตามพลัง ไม่ใช่เรต)', () => {
  const myPower = teamPower(botTeamOf('rare', 3, 5))
  const [easy, hard] = getFallbackBots(myPower, 1000, 42, 2)
  assert.ok(teamPower(easy.team) < myPower)
  assert.ok(teamPower(hard.team) > myPower)
  assert.equal(easy.label, 'อ่อน')
  assert.equal(hard.label, 'แกร่ง')
})

test('getFallbackBots: เรตบอทไม่ต่ำกว่าพื้น แม้เรตเราจะต่ำมาก', () => {
  const bots = getFallbackBots(5000, PVP_RATING_FLOOR, 42, 2)
  assert.ok(bots.every(b => b.rating >= PVP_RATING_FLOOR))
})

test('getFallbackBots: ขอมากกว่าจำนวนอัตราส่วนที่มี ก็ไม่พัง', () => {
  const bots = getFallbackBots(5000, 1000, 42, BOT_POWER_RATIOS.length + 3)
  assert.ok(bots.length <= BOT_POWER_RATIOS.length)
  assert.equal(new Set(bots.map(b => b.uid)).size, bots.length)
})
