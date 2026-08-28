import test from 'node:test'
import assert from 'node:assert/strict'
import { pushEvent, rankOfScore, buildFeed, timeAgo, EVENT_MAX } from './newsFeed.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

test('pushEvent ต่อหน้าสุด ตัดเหลือ EVENT_MAX', () => {
  let list = []
  for (let i = 1; i <= 5; i++) list = pushEvent(list, { k: 'tw', v: i * 10, t: NOW + i })
  assert.equal(list.length, EVENT_MAX)
  assert.equal(list[0].v, 50)
  assert.equal(list[2].v, 30)
})

test('pushEvent entry เสีย = ไม่แตะของเดิม', () => {
  const prev = [{ k: 'tw', v: 10, t: NOW }]
  assert.deepEqual(pushEvent(prev, null), prev)
  assert.deepEqual(pushEvent(prev, { v: 1 }), prev)        // ไม่มี k
  assert.deepEqual(pushEvent(prev, { k: 'zz', v: 1 }), prev) // k ไม่รู้จัก
})

test('rankOfScore นับเฉพาะคนอื่นที่คะแนนสูงกว่า', () => {
  const rows = { a: { m: { g2048: 900 } }, b: { m: { g2048: 500 } }, me: { m: { g2048: 100 } } }
  const pick = (r) => r?.m?.g2048 || 0
  assert.equal(rankOfScore(rows, 'me', pick, 1000), 1)
  assert.equal(rankOfScore(rows, 'me', pick, 600), 2)
  assert.equal(rankOfScore(rows, 'me', pick, 10), 3)
})

test('buildFeed เรียงใหม่→เก่า และประกอบชื่อจากแถว', () => {
  const rows = {
    a: { n: 'มายด์', ev: [{ k: 'tw', v: 40, t: NOW - 1000 }] },
    b: { n: 'บีม', ev: [{ k: 'qz', v: 10, t: NOW - 10 }] },
  }
  const feed = buildFeed(rows, [], { now: NOW, myUid: null })
  assert.equal(feed.length, 2)
  assert.match(feed[0].text, /บีม/)
  assert.match(feed[1].text, /มายด์ ไต่หอคอยถึงชั้น 40/)
})

test('buildFeed ตัดข่าวเลน roster ที่เกิน 7 วัน แต่ไม่ตัด doc เลน news', () => {
  const rows = { a: { n: 'มายด์', ev: [{ k: 'tw', v: 40, t: NOW - 8 * DAY }] } }
  const docs = [{ id: 'n1', msg: 'ประกาศเก่า', icon: '📢', ts: { toDate: () => new Date(NOW - 30 * DAY) } }]
  const feed = buildFeed(rows, docs, { now: NOW, myUid: null })
  assert.equal(feed.length, 1)
  assert.equal(feed[0].text, 'ประกาศเก่า')
})

test('buildFeed จำกัด 2 บรรทัดต่อคน', () => {
  const rows = {
    a: { n: 'มายด์', ev: [
      { k: 'tw', v: 30, t: NOW - 1 }, { k: 'tw', v: 20, t: NOW - 2 }, { k: 'tw', v: 10, t: NOW - 3 },
    ] },
  }
  assert.equal(buildFeed(rows, [], { now: NOW, myUid: null }).length, 2)
})

test('buildFeed ตัดเหลือ 10 บรรทัด', () => {
  const rows = {}
  for (let i = 0; i < 20; i++) rows[`u${i}`] = { n: `คน${i}`, ev: [{ k: 'tw', v: 10, t: NOW - i }] }
  assert.equal(buildFeed(rows, [], { now: NOW, myUid: null }).length, 10)
})

test('buildFeed ใช้คำว่า "คุณ" กับข่าวของตัวเอง', () => {
  const rows = { me: { n: 'ปาล์ม', ev: [{ k: 'hs', v: 5, t: NOW }] } }
  assert.match(buildFeed(rows, [], { now: NOW, myUid: 'me' })[0].text, /^คุณ /)
})

test('buildFeed ทนข้อมูลพัง: ev ไม่ใช่ array / k ไม่รู้จัก / ไม่มีชื่อ', () => {
  const rows = {
    a: { n: 'มายด์', ev: 'พัง' },
    b: { ev: [{ k: 'zz', v: 1, t: NOW }] },
    c: { ev: [{ k: 'tw', v: 12, t: NOW }] },
    d: { n: 'นิว' },
  }
  const feed = buildFeed(rows, [], { now: NOW, myUid: null })
  assert.equal(feed.length, 1)
  assert.match(feed[0].text, /^\? /)
})

test('buildFeed ประกอบข้อความได้ครบทุกชนิด', () => {
  const kinds = [
    { k: 'tw', v: 40 }, { k: 'pg', v: 5 }, { k: 'qz', v: 20 },
    { k: 'mg', g: 'g2048', v: 2 }, { k: 'ta', g: 'ta4', v: 3 },
    { k: 'hs', v: 7 }, { k: 'fo', v: 3200 }, { k: 'pv', v: 4 },
  ]
  for (const e of kinds) {
    const rows = { a: { n: 'มายด์', ev: [{ ...e, t: NOW }] } }
    const feed = buildFeed(rows, [], { now: NOW, myUid: null })
    assert.equal(feed.length, 1, `ชนิด ${e.k} ประกอบข้อความไม่ได้`)
    assert.ok(feed[0].text.length > 5 && feed[0].icon, `ชนิด ${e.k} ข้อความ/ไอคอนว่าง`)
  }
})

test('buildFeed ไม่พังเมื่อไม่มีข้อมูลเลย', () => {
  assert.deepEqual(buildFeed(null, null, {}), [])
})

test('timeAgo อ่านออกทุกช่วง', () => {
  assert.equal(timeAgo(NOW - 5_000, NOW), 'เมื่อกี้')
  assert.equal(timeAgo(NOW - 12 * 60_000, NOW), '12 นาทีที่แล้ว')
  assert.equal(timeAgo(NOW - 3 * 3_600_000, NOW), '3 ชั่วโมงที่แล้ว')
  assert.equal(timeAgo(NOW - 2 * DAY, NOW), '2 วันที่แล้ว')
})
