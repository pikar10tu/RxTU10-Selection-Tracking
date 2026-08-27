import test from 'node:test'
import assert from 'node:assert/strict'
import { pushHistory, myAttacks, defenseLog, agoLabel, HISTORY_MAX } from './pvpHistory.js'

const e = (u, w, c, t) => ({ u, w, c, t })

test('pushHistory ใหม่สุดอยู่หน้า และตัดที่ 5', () => {
  let list = []
  for (let i = 1; i <= 7; i++) list = pushHistory(list, e('x' + i, 1, 10, i))
  assert.equal(list.length, HISTORY_MAX)
  assert.equal(list[0].u, 'x7', 'ใหม่สุดต้องอยู่หน้า')
  assert.equal(list[4].u, 'x3', 'เก่าสุดที่เหลือคือรายการที่ 3')
})

test('pushHistory รับ list ที่ไม่ใช่ array ได้ (แถวเก่าที่ยังไม่มี h)', () => {
  assert.deepEqual(pushHistory(undefined, e('a', 1, 5, 1)), [e('a', 1, 5, 1)])
  assert.deepEqual(pushHistory(null, e('a', 0, 0, 2)), [e('a', 0, 0, 2)])
})

test('pushHistory entry ที่ไม่มี u ถูกปฏิเสธ (กันแถวเสีย)', () => {
  const list = [e('a', 1, 5, 1)]
  assert.deepEqual(pushHistory(list, { w: 1 }), list)
  assert.deepEqual(pushHistory(list, null), list)
})

const rows = {
  me:  { n: 'ฉัน',  h: [e('bob', 1, 250, 300), e('ann', 0, 40, 200)] },
  bob: { n: 'บ๊อบ', h: [e('me', 1, 120, 400), e('ann', 1, 90, 100)] },
  ann: { n: 'แอน',  h: [e('me', 0, 30, 500)] },
  cat: { n: 'แคท' },
}

test('myAttacks เติมชื่อเป้าหมายจากแถวของเขา และคงลำดับเดิม', () => {
  const r = myAttacks(rows, 'me')
  assert.equal(r.length, 2)
  assert.deepEqual(r[0], { uid: 'bob', name: 'บ๊อบ', won: true, coin: 250, t: 300 })
  assert.equal(r[1].name, 'แอน')
  assert.equal(r[1].won, false)
})

test('myAttacks แถวที่ไม่มี h คืน array ว่าง', () => {
  assert.deepEqual(myAttacks(rows, 'cat'), [])
  assert.deepEqual(myAttacks(undefined, 'me'), [])
})

test('defenseLog เก็บเฉพาะคนที่บุกเรา เรียงใหม่สุดก่อน และกลับด้านผล', () => {
  const r = defenseLog(rows, 'me')
  assert.equal(r.length, 2)
  assert.equal(r[0].uid, 'ann', 't=500 ใหม่สุด')
  assert.equal(r[0].won, true, 'แอนบุกแล้วแพ้ (w:0) ⇒ ฝั่งเรารอด')
  assert.equal(r[0].name, 'แอน')
  assert.equal(r[1].uid, 'bob')
  assert.equal(r[1].won, false, 'บ๊อบบุกแล้วชนะ (w:1) ⇒ ฝั่งเราแพ้')
})

test('defenseLog ไม่นับแถวของตัวเอง และไม่มีเหรียญติดมา', () => {
  const self = { me: { n: 'ฉัน', h: [e('me', 1, 999, 900)] } }
  assert.deepEqual(defenseLog(self, 'me'), [])
  assert.equal('coin' in defenseLog(rows, 'me')[0], false, 'ฝั่งตั้งรับห้ามโชว์เหรียญของผู้บุก')
})

test('defenseLog ตัดที่ max', () => {
  const many = {}
  for (let i = 0; i < 30; i++) many['u' + i] = { n: 'u' + i, h: [e('me', 1, 0, i)] }
  assert.equal(defenseLog(many, 'me').length, 10)
  assert.equal(defenseLog(many, 'me', 3).length, 3)
})

test('agoLabel อ่านง่ายทุกช่วง', () => {
  const now = 1_000_000_000
  assert.equal(agoLabel(now - 30_000, now), 'เมื่อกี้')
  assert.equal(agoLabel(now - 12 * 60_000, now), '12 นาทีที่แล้ว')
  assert.equal(agoLabel(now - 3 * 3_600_000, now), '3 ชม.ที่แล้ว')
  assert.equal(agoLabel(now - 2 * 86_400_000, now), '2 วันก่อน')
  assert.equal(agoLabel(0, now), '')
  assert.equal(agoLabel(now + 60_000, now), 'เมื่อกี้', 'นาฬิกาเครื่องเพี้ยน = ห้ามโชว์เวลาติดลบ')
})
