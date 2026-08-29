import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRosterRow, rosterRowChanged, buildRosterFromUsers,
  rosterToMembers, rosterTeam, rosterOpponents, petSpeciesOf,
} from './roster.js'
import { currentSeasonId } from './pvpSeason.js'

const user = (over = {}) => ({
  uid: 'u1', studentId: '6512345678', nickname: 'ปิ๊ก 🌟', track: 'sci',
  residence: { level: 7 }, googlePhoto: 'https://lh3/x', customPhoto: 'data:image/png;base64,AAAA', photoMini: 'data:image/jpeg;base64,MINI',
  guestStatus: null, towerBest: 43, pvp: { rating: 1120, seasonId: currentSeasonId() },
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
  // data URL เดียวที่ยอมให้อยู่ในแถวคือ pm (ตัวจิ๋วที่ utils/photo.js คุมขนาดไว้แล้ว)
  // — customPhoto ตัวเต็มหลุดเข้ามาเมื่อไหร่ = doc ทั้งรุ่นบวมจนชนเพดาน 1 MiB
  const { pm, ...rest } = r
  assert.equal(JSON.stringify(rest).includes('base64'), false, 'ห้ามมี data URL อื่นหลุดเข้าแถว')
})

test('แถวต้องไม่พา customPhoto ตัวเต็มมาด้วย แม้ user doc จะมี', () => {
  const r = buildRosterRow(user({ customPhoto: 'data:image/png;base64,' + 'A'.repeat(20000) }))
  assert.equal(JSON.stringify(r).length < 2000, true, 'แถวต้องเล็ก — ทั้งรุ่นโหลด doc นี้ทุกเซสชัน')
})

test('buildRosterRow เก็บ m เฉพาะเกมที่ best > 0', () => {
  assert.deepEqual(buildRosterRow(user()).m, { g2048: 8192 })
  assert.deepEqual(buildRosterRow(user({ minigames: {} })).m, {})
})

test('buildRosterRow tm = [{i,g}] ข้าม slot ว่าง และ cap ที่ 3', () => {
  // ⚠️ ต้องเป็น array ของ object ไม่ใช่ array ซ้อน array — Firestore ไม่รับ nested array
  assert.deepEqual(buildRosterRow(user()).tm, [{ i: 'fox', g: 3 }, { i: 'owl', g: 0 }])
  // ต้องเป็น species id จริง — id ที่กู้ไม่ได้ถูกตัดทิ้งตั้งแต่ต้นทาง (ดูเทสท้ายไฟล์)
  const four = user({
    activePets: ['cat', 'wolf', 'shark', 'panda'],
    pets: [{ id: 'cat', grade: 1 }, { id: 'wolf', grade: 2 }, { id: 'shark', grade: 3 }, { id: 'panda', grade: 4 }],
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

// ── ปุ่ม "สร้าง roster ใหม่" ต้องไม่ล้างของที่ไม่ได้อยู่ใน user doc (h = ประวัติบุก · ev = ข่าวกระดาน) ──

test('buildRosterFromUsers พ่วง h/ev ของแถวเดิมมาให้ (กดปุ่มแอดมินแล้วประวัติต้องไม่หาย)', () => {
  const prevRows = {
    u1: { n: 'ปิ๊ก', h: [{ u: 'bob', w: 1, c: 250, t: 111 }], ev: [{ k: 'tw', v: 40, t: 123 }] },
  }
  const rows = buildRosterFromUsers([{ uid: 'u1', data: user() }], prevRows)
  assert.deepEqual(rows.u1.h, prevRows.u1.h)
  assert.deepEqual(rows.u1.ev, prevRows.u1.ev)
})

test('buildRosterFromUsers: ไม่ส่ง prevRows = ทำงานเหมือนเดิม (ไม่มีคีย์ h/ev โผล่มาเปล่าๆ)', () => {
  const rows = buildRosterFromUsers([{ uid: 'u1', data: user() }])
  assert.equal('h' in rows.u1, false)
  assert.equal('ev' in rows.u1, false)
})

test('buildRosterFromUsers: คนที่ไม่มีแถวเดิมยังสร้างได้ปกติ', () => {
  const rows = buildRosterFromUsers(
    [{ uid: 'u1', data: user() }, { uid: 'u2', data: user({ uid: 'u2', studentId: '6500000000' }) }],
    { u1: { h: [{ u: 'bob', w: 1, c: 250, t: 111 }] } },
  )
  assert.deepEqual(Object.keys(rows).sort(), ['u1', 'u2'])
  assert.equal('h' in rows.u2, false)
})

test('buildRosterFromUsers: แถวเดิมของคนที่ไม่มี user doc แล้ว ต้องไม่ถูกอุ้มกลับมา', () => {
  const rows = buildRosterFromUsers([{ uid: 'u1', data: user() }], { gone: { n: 'ผี', h: [{ u: 'x', w: 1, c: 1, t: 1 }] } })
  assert.deepEqual(Object.keys(rows), ['u1'])
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

test('buildRosterRow: เรตข้ามซีซั่นต้องถูกบีบก่อนขึ้นบอร์ด (ไม่ใช่เรตดิบของเดือนก่อน)', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    pvp: { rating: 1600, wins: 9, losses: 1, seasonId: '2000-01' },   // ซีซั่นเก่าแน่ๆ
  })
  assert.ok(row.r < 1600, 'เรตบนบอร์ดยังเป็นของเดือนก่อน')
  assert.equal(row.r, 1300)   // soft reset: 1000 + (1600-1000)×0.5
})

test('buildRosterRow: เรตในซีซั่นปัจจุบันไม่ถูกแตะ', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    pvp: { rating: 1600, wins: 9, losses: 1, seasonId: currentSeasonId() },
  })
  assert.equal(row.r, 1600)
})

test('buildRosterRow: ไม่มี pvp เลย = เรตเริ่มต้น', () => {
  assert.equal(buildRosterRow({ uid: 'u1', nickname: 'เทส' }).r, 1000)
})

// ── id เพ็ทใน roster เป็น instId ของคนที่ยังไม่ migrate (วัดจากของจริง 27 ส.ค.: 13 ทีม ใช้ได้แค่ 19/38 ตัว) ──

test('petSpeciesOf: species id ตรงๆ ผ่านทันที', () => {
  assert.equal(petSpeciesOf('bahamut'), 'bahamut')
})

test('petSpeciesOf: กู้ species จาก instId แบบ species_timestamp_rand', () => {
  assert.equal(petSpeciesOf('bahamut_1772192074378_ptd6'), 'bahamut')
  assert.equal(petSpeciesOf('kirin_1772723692155_qls6'), 'kirin')
})

test('petSpeciesOf: instId ล้วนไม่มี species นำหน้า = กู้ไม่ได้', () => {
  assert.equal(petSpeciesOf('1771936427893_s3vjsn'), null)
})

test('petSpeciesOf: prefix ที่ไม่ใช่สปีชีส์จริง = กู้ไม่ได้ (celestial ถูกถอดออกจากแค็ตตาล็อกแล้ว)', () => {
  assert.equal(petSpeciesOf('celestial_1772280785098_6qnt'), null)
  assert.equal(petSpeciesOf(null), null)
})

test('buildRosterRow: activePets เป็น instId (ยังไม่ migrate) ต้อง map กลับเป็น species จาก pets[].instId', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    activePets: ['1771936427893_s3vjsn', 'kirin_1772723692155_qls6'],
    pets: [
      { id: 'bahamut', instId: '1771936427893_s3vjsn', grade: 4 },
      { id: 'kirin', instId: 'kirin_1772723692155_qls6', grade: 2 },
    ],
  })
  assert.deepEqual(row.tm, [{ i: 'bahamut', g: 4 }, { i: 'kirin', g: 2 }])
})

test('buildRosterRow: id ที่กู้ไม่ได้เลยถูกตัดทิ้ง (ไม่ปล่อยเป็นเพ็ทผี common/scissors)', () => {
  const row = buildRosterRow({
    uid: 'u1', nickname: 'เทส',
    activePets: ['bahamut', '1772103420786_yx5j1n', 'kirin'],
    pets: [{ id: 'bahamut', grade: 3 }, { id: 'kirin', grade: 1 }],
  })
  assert.deepEqual(row.tm.map(t => t.i), ['bahamut', 'kirin'])
})

test('rosterTeam: แถวเก่าที่มี instId ค้างใน Firestore ต้องกู้ได้ตอนอ่าน', () => {
  // แถวที่เขียนไว้ก่อนแก้จะยังเป็น instId จนกว่าเจ้าตัวจะ sync ใหม่/แอดมินสร้าง roster ใหม่
  const team = rosterTeam({ tm: [{ i: 'phoenix_1772192547567_2vyf', g: 3 }, { i: '1771928463354_ubjiai', g: 5 }] })
  assert.deepEqual(team.map(p => p.id), ['phoenix'])
  assert.equal(team[0].rarity, 'legendary')
  assert.equal(team[0].grade, 3)
})

test('rosterOpponents: คนที่กู้ทีมไม่ได้เลย ต้องไม่ถูกเอามาเป็นคู่ต่อสู้', () => {
  const rows = {
    ghost: { n: 'ทิว', r: 1000, tm: [{ i: '1772103420786_yx5j1n', g: 5 }] },
    ok:    { n: 'สุ่น', r: 1000, tm: [{ i: 'kirin_1772192470783_1o42', g: 2 }] },
  }
  const out = rosterOpponents(rows, 'me')
  assert.deepEqual(out.map(o => o.nickname), ['สุ่น'])
  assert.deepEqual(out[0].team.map(p => p.id), ['kirin'])
})

test('buildRosterRow คง h เดิมไว้ (ไม่งั้น sync ครั้งถัดไปล้างประวัติทิ้ง)', () => {
  const prev = { n: 'ปิ๊ก', h: [{ u: 'bob', w: 1, c: 250, t: 111 }] }
  const r = buildRosterRow(user(), prev)
  assert.deepEqual(r.h, prev.h)
})

test('buildRosterRow ไม่ใส่คีย์ h เลยถ้าไม่เคยมีประวัติ (กันแถวบวมด้วย array ว่าง)', () => {
  assert.equal('h' in buildRosterRow(user()), false)
  assert.equal('h' in buildRosterRow(user(), { n: 'ปิ๊ก' }), false)
  assert.equal('h' in buildRosterRow(user(), { n: 'ปิ๊ก', h: [] }), false)
})

test('buildRosterRow เรียกซ้ำด้วยแถวที่ตัวเองสร้าง ได้ผลเท่าเดิม (rosterRowChanged ต้องไม่ยิงเขียนเปล่า)', () => {
  const prev = buildRosterRow(user(), { h: [{ u: 'bob', w: 1, c: 250, t: 111 }] })
  const next = buildRosterRow(user(), prev)
  assert.equal(rosterRowChanged(prev, next), false, 'คีย์ต้องเรียงเหมือนเดิมด้วย (เทียบด้วย JSON.stringify)')
})

test('buildRosterRow ใส่ ta4/ta15 เฉพาะที่ > 0 (กันแถวบวมด้วยศูนย์)', () => {
  const r = buildRosterRow(user({ timeAttack: { best4: 23, best15: 0 } }))
  assert.equal(r.ta4, 23)
  assert.equal('ta15' in r, false)
  const empty = buildRosterRow(user())
  assert.equal('ta4' in empty, false)
  assert.equal('ta15' in empty, false)
})

test('buildRosterRow ทน timeAttack เพี้ยน/ไม่ใช่ตัวเลข', () => {
  assert.equal('ta4' in buildRosterRow(user({ timeAttack: null })), false)
  assert.equal('ta4' in buildRosterRow(user({ timeAttack: { best4: 'มั่ว' } })), false)
})

test('buildRosterRow พ่วง ev เดิมไว้ (ไม่งั้นข่าวหายทุกครั้งที่ sync)', () => {
  const prev = { ev: [{ k: 'tw', v: 40, t: 123 }] }
  assert.deepEqual(buildRosterRow(user(), prev).ev, prev.ev)
})

test('มี ev อยู่แล้วและไม่มีอะไรเปลี่ยน → ไม่ต้องเขียน (คีย์ต้องเรียงคงที่)', () => {
  const prev = buildRosterRow(user(), { h: [{ u: 'bob', w: 1, c: 5, t: 1 }], ev: [{ k: 'tw', v: 40, t: 123 }] })
  assert.equal(rosterRowChanged(prev, buildRosterRow(user(), prev)), false)
})

test('buildRosterRow pw/pl = ชนะ-แพ้ของซีซั่นปัจจุบัน ใส่เฉพาะเมื่อ > 0', () => {
  const season = currentSeasonId()
  const r = buildRosterRow(user({ pvp: { rating: 1120, wins: 12, losses: 8, seasonId: season } }))
  assert.equal(r.pw, 12)
  assert.equal(r.pl, 8)

  // ยังไม่เคยสู้ = ไม่มีคีย์เลย (กันแถวบวมด้วยศูนย์ เหมือน m/ta4 — ทั้งรุ่นโหลด doc นี้ทุกเซสชัน)
  const zero = buildRosterRow(user({ pvp: { rating: 1000, wins: 0, losses: 0, seasonId: season } }))
  assert.equal('pw' in zero, false)
  assert.equal('pl' in zero, false)
})

test('buildRosterRow pw/pl ต้องมาจาก applySeasonReset ก้อนเดียวกับ r', () => {
  // ข้ามเดือน: เรตถูกบีบเข้ากลาง ชนะ/แพ้ถูกล้าง
  // ถ้าคำนวณแยกกัน จะได้เรตของเดือนนี้คู่กับชนะ/แพ้ของเดือนก่อน = ตัวเลขคนละเรื่อง
  const r = buildRosterRow(user({ pvp: { rating: 1400, wins: 20, losses: 3, seasonId: '2000-01' } }))
  assert.equal(r.r, 1200, 'บีบครึ่ง: 1000 + (1400-1000)*0.5')
  assert.equal('pw' in r, false)
  assert.equal('pl' in r, false)
})

test('buildRosterRow pw/pl ต้องอยู่ก่อน h/ev — rosterRowChanged เทียบ JSON ตามลำดับคีย์', () => {
  const prev = { h: [{ u: 'x', w: 1, c: 5, t: 1 }], ev: [{ k: 'pv', v: 3, t: 1 }] }
  const row = buildRosterRow(user({ pvp: { rating: 1120, wins: 1, losses: 1, seasonId: currentSeasonId() } }), prev)
  const keys = Object.keys(row)
  assert.ok(keys.indexOf('pw') < keys.indexOf('h'), 'pw ต้องมาก่อน h')
  assert.ok(keys.indexOf('pl') < keys.indexOf('ev'), 'pl ต้องมาก่อน ev')
})

// ── รูปที่ผู้ใช้อัปเอง — ตัวจิ๋วเท่านั้นที่ขี่มากับแถว (ดู utils/photo.js) ──
test('buildRosterRow เอา photoMini ลงฟิลด์ pm แต่ยังไม่เอา customPhoto ตัวเต็ม', () => {
  const r = buildRosterRow(user())
  assert.equal(r.pm, 'data:image/jpeg;base64,MINI')
  assert.equal(r.customPhoto, undefined)
  assert.equal(r.p, 'https://lh3/x')     // รูป Google ยังอยู่ครบ ไม่ถูกแทนที่
})

test('buildRosterRow: ไม่เคยอัปรูปเอง → pm เป็น null ไม่ใช่ undefined (Firestore ไม่รับ undefined)', () => {
  assert.equal(buildRosterRow(user({ photoMini: undefined })).pm, null)
})

test('rosterToMembers ส่ง photoMini กลับออกมาให้ view ใช้', () => {
  const { byStudentId } = rosterToMembers({ u1: buildRosterRow(user()) })
  assert.equal(byStudentId['6512345678'].photoMini, 'data:image/jpeg;base64,MINI')
})
