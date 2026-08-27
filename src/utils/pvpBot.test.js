// src/utils/pvpBot.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { botPowerFor, getPvpBot, getPvpBots, BOT_RATING_SPREAD } from './pvpBot.js'
import { PVP_RATING_FLOOR } from './pvpRating.js'

test('botPowerFor: เรตสูง เกรด/tier สูงกว่าเรตต่ำ', () => {
  assert.ok(botPowerFor(2000).grade >= botPowerFor(800).grade)
})
test('getPvpBot: คืน 4 ตัว + isBot + rating = เรตผู้เล่น', () => {
  const b = getPvpBot(1000, 12345)
  assert.equal(b.team.length, 3)
  assert.equal(b.isBot, true)
  assert.equal(b.rating, 1000)
  b.team.forEach(p => { assert.ok(p.id && p.rarity && p.element); assert.ok(p.grade >= 0 && p.grade <= 5) })
})
test('getPvpBot: deterministic (seed เดิม → ทีมเดิม)', () => {
  assert.deepEqual(getPvpBot(1000, 7), getPvpBot(1000, 7))
})

test('getPvpBots: คืน 2 ตัว อ่อน+แกร่ง คร่อมเรตผู้เล่น', () => {
  const [easy, hard] = getPvpBots(1000, 42)
  assert.equal(easy.uid, 'bot-easy')
  assert.equal(hard.uid, 'bot-hard')
  assert.equal(easy.label, 'อ่อน')
  assert.equal(hard.label, 'แกร่ง')
  assert.equal(easy.isBot, true)
  assert.equal(hard.isBot, true)
  assert.equal(easy.rating, 1000 - BOT_RATING_SPREAD)
  assert.equal(hard.rating, 1000 + BOT_RATING_SPREAD)
  assert.ok(easy.team.length > 0 && hard.team.length > 0)
})

test('getPvpBots: บอทอ่อนไม่ต่ำกว่า floor', () => {
  const [easy] = getPvpBots(150, 42)   // 150 - 300 < floor
  assert.equal(easy.rating, PVP_RATING_FLOOR)
})

test('getPvpBots: deterministic ต่อ seed (ทีมเดิม)', () => {
  const a = getPvpBots(1200, 7), b = getPvpBots(1200, 7)
  assert.deepEqual(a[0].team, b[0].team)
  assert.deepEqual(a[1].team, b[1].team)
})

test('getPvpBots: บอทแกร่งไม่อ่อนกว่าบอทอ่อน (พลังตามเรต)', () => {
  const [easy, hard] = getPvpBots(1400, 3)
  assert.ok(botPowerFor(hard.rating).grade >= botPowerFor(easy.rating).grade)
})
