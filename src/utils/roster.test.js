import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRosterRow, rosterRowChanged, buildRosterFromUsers,
  rosterToMembers, rosterTeam, rosterOpponents,
} from './roster.js'

const user = (over = {}) => ({
  uid: 'u1', studentId: '6512345678', nickname: 'ปิ๊ก 🌟', track: 'sci',
  residence: { level: 7 }, googlePhoto: 'https://lh3/x', customPhoto: 'data:image/png;base64,AAAA',
  guestStatus: null, towerBest: 43, pvp: { rating: 1120 },
  minigames: { g2048: { best: 8192, plays: 3 }, stacker: { best: 0, plays: 1 } },
  activePets: ['fox', null, 'owl'], pets: [{ id: 'fox', grade: 3 }, { id: 'owl', grade: 0 }],
  ...over,
})

test('buildRosterRow map ฟิลด์ครบ และไม่เอา customPhoto ติดไปด้วย', () => {
  const r = buildRosterRow(user())
  assert.equal(r.s, '6512345678')
  assert.equal(r.n, 'ปิ๊ก', 'ต้องผ่าน stripTrailingEmoji')
  assert.equal(r.t, 'sci')
  assert.equal(r.l, 7)
  assert.equal(r.p, 'https://lh3/x')
  assert.equal(r.g, null)
  assert.equal(r.tb, 43)
  assert.equal(r.r, 1120)
  assert.equal(r.customPhoto, undefined)
  assert.equal(JSON.stringify(r).includes('base64'), false, 'ห้ามมี data URL หลุดเข้าแถว')
})

test('buildRosterRow เก็บ m เฉพาะเกมที่ best > 0', () => {
  assert.deepEqual(buildRosterRow(user()).m, { g2048: 8192 })
  assert.deepEqual(buildRosterRow(user({ minigames: {} })).m, {})
})

test('buildRosterRow tm = [{i,g}] ข้าม slot ว่าง และ cap ที่ 3', () => {
  // ⚠️ ต้องเป็น array ของ object ไม่ใช่ array ซ้อน array — Firestore ไม่รับ nested array
  assert.deepEqual(buildRosterRow(user()).tm, [{ i: 'fox', g: 3 }, { i: 'owl', g: 0 }])
  const four = user({
    activePets: ['a', 'b', 'c', 'd'],
    pets: [{ id: 'a', grade: 1 }, { id: 'b', grade: 2 }, { id: 'c', grade: 3 }, { id: 'd', grade: 4 }],
  })
  assert.equal(buildRosterRow(four).tm.length, 3, 'cap ที่ BATTLE_SLOTS')
})

// Firestore ไม่รองรับ array ซ้อน array — setDoc จะ throw ทั้ง doc
// เจอจริงตอนกดปุ่มสร้าง roster ครั้งแรก (tm เคยเป็น [[id, grade]])
// เช็คทั้งแถวแบบ recursive เพื่อกันฟิลด์ใหม่ในอนาคตพลาดซ้ำ
function assertNoNestedArrays(v, path = 'row') {
  if (Array.isArray(v)) {
    for (const [i, el] of v.entries()) {
      assert.equal(Array.isArray(el), false, `${path}[${i}] เป็น array ซ้อน array — Firestore รับไม่ได้`)
      assertNoNestedArrays(el, `${path}[${i}]`)
    }
    return
  }
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) assertNoNestedArrays(val, `${path}.${k}`)
  }
}

test('ทั้งแถวต้องไม่มี array ซ้อน array (Firestore setDoc จะ throw ทั้ง doc)', () => {
  assertNoNestedArrays(buildRosterRow(user()))
  assertNoNestedArrays(buildRosterFromUsers([{ uid: 'u1', data: user() }]))
})

test('buildRosterRow ทน field หาย → ค่าตั้งต้นที่ปลอดภัย', () => {
  const r = buildRosterRow({ uid: 'u9' })
  assert.equal(r.l, 1)
  assert.equal(r.tb, 0)
  assert.equal(r.r, 1000, 'PVP_RATING_START')
  assert.deepEqual(r.m, {})
  assert.deepEqual(r.tm, [])
})

test('rosterRowChanged: ค่าเท่าเดิม → false (ไม่ต้องเขียน)', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user())
  assert.equal(rosterRowChanged(a, b), false)
})

test('rosterRowChanged: best มินิเกมขยับ → true', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user({ minigames: { g2048: { best: 9000 } } }))
  assert.equal(rosterRowChanged(a, b), true)
})

test('rosterRowChanged: เหรียญเปลี่ยนแต่ฟิลด์บอร์ดเท่าเดิม → false', () => {
  const a = buildRosterRow(user({ coins: 100 }))
  const b = buildRosterRow(user({ coins: 999999 }))
  assert.equal(rosterRowChanged(a, b), false, 'coins ไม่ได้อยู่ในแถว จึงต้องไม่ทำให้เขียน')
})

test('rosterRowChanged: ยังไม่มีแถวเดิม (คนใหม่) → true', () => {
  assert.equal(rosterRowChanged(undefined, buildRosterRow(user())), true)
})

test('rosterRowChanged: เปลี่ยนทีมเพ็ท → true', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user({ activePets: ['owl', null, null] }))
  assert.equal(rosterRowChanged(a, b), true)
})

test('buildRosterFromUsers ข้าม doc ที่ไม่มีทั้ง studentId และ nickname', () => {
  const rows = buildRosterFromUsers([
    { uid: 'u1', data: user() },
    { uid: 'ghost', data: { coins: 5 } },
    { uid: 'g1', data: user({ uid: 'g1', studentId: null, nickname: 'แขก', guestStatus: 'approved' }) },
  ])
  assert.deepEqual(Object.keys(rows).sort(), ['g1', 'u1'])
})

test('rosterToMembers แยกนักศึกษา/guest ตาม g', () => {
  const rows = {
    u1: buildRosterRow(user()),
    g1: buildRosterRow(user({ uid: 'g1', studentId: null, nickname: 'แขก', guestStatus: 'approved' })),
  }
  const { byStudentId, guests } = rosterToMembers(rows)
  assert.deepEqual(Object.keys(byStudentId), ['6512345678'])
  assert.equal(byStudentId['6512345678'].uid, 'u1')
  assert.equal(byStudentId['6512345678'].residence.level, 7)
  assert.equal(byStudentId['6512345678'].minigames.g2048.best, 8192)
  assert.equal(guests.length, 1)
  assert.equal(guests[0].guestStatus, 'approved')
})

test('rosterTeam คืนรูปเดียวกับ resolveBattleTeam (rarity/element มาจาก catalog)', () => {
  const t = rosterTeam(buildRosterRow(user()))
  assert.equal(t.length, 2)
  for (const p of t) {
    assert.ok(typeof p.id === 'string')
    assert.ok(typeof p.rarity === 'string')
    assert.ok(typeof p.element === 'string')
    assert.ok(Number.isFinite(p.grade))
  }
  assert.equal(t[0].grade, 3)
})

test('rosterOpponents: ตัดตัวเองออก + ตัดคนไม่มีทีม + เติม team ให้พร้อมสู้', () => {
  const rows = {
    me:   buildRosterRow(user({ uid: 'me' })),
    a:    buildRosterRow(user({ uid: 'a' })),
    noTeam: buildRosterRow(user({ uid: 'noTeam', activePets: [], pets: [] })),
  }
  const out = rosterOpponents(rows, 'me')
  assert.deepEqual(out.map(o => o.uid), ['a'])
  assert.equal(out[0].rating, 1120)
  assert.ok(Array.isArray(out[0].team) && out[0].team.length > 0)
})
