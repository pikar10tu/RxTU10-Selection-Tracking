import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FX_PRESETS, PACE_PRESETS, REDUCED_FLAGS, DEFAULT_PREFS, MOTION_STYLES,
  readPrefs, writePrefs, fxFlags, paceMult, motionStyle,
} from './battleReplayPrefs.js'

// localStorage ปลอมสำหรับ node (ไม่มี window)
function fakeStorage(seed) {
  const m = new Map(Object.entries(seed || {}))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    _dump: () => Object.fromEntries(m),
  }
}

test('preset ภาพไล่จากหนักไปเบาอย่างสอดคล้อง', () => {
  assert.deepEqual(FX_PRESETS.high, { cardLunge: true, targetSquash: true, screenShake: true, burst: true, ko: true })
  assert.deepEqual(FX_PRESETS.mid, { cardLunge: true, targetSquash: false, screenShake: false, burst: true, ko: true })
  assert.deepEqual(FX_PRESETS.low, { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true })
  // จอสั่นต้องอยู่ใน high เท่านั้น — §6.2 ของสเปกบังคับ
  assert.equal(FX_PRESETS.mid.screenShake, false)
  assert.equal(FX_PRESETS.low.screenShake, false)
})

test('reduced-motion ปิด motion ทุกตัว', () => {
  for (const v of Object.values(REDUCED_FLAGS)) assert.equal(v, false)
  // ต้องมีคีย์ครบเท่ากับ preset ปกติ ไม่งั้นโค้ดที่อ่าน flag จะได้ undefined
  assert.deepEqual(Object.keys(REDUCED_FLAGS).sort(), Object.keys(FX_PRESETS.high).sort())
})

test('ตัวคูณจังหวะตามสเปก', () => {
  assert.equal(PACE_PRESETS.grand, 1.25)
  assert.equal(PACE_PRESETS.normal, 1)
  assert.equal(PACE_PRESETS.tight, 0.8)
  assert.equal(paceMult('tight'), 0.8)
  assert.equal(paceMult('ไม่มีอันนี้'), 1)     // ชื่อมั่ว → normal
  assert.equal(paceMult(undefined), 1)
})

test('fxFlags ชื่อมั่ว → ตกกลับค่าเริ่มต้น', () => {
  assert.deepEqual(fxFlags('mid'), FX_PRESETS.mid)
  assert.deepEqual(fxFlags('ไม่มีอันนี้'), FX_PRESETS[DEFAULT_PREFS.fx])
  assert.deepEqual(fxFlags(undefined), FX_PRESETS[DEFAULT_PREFS.fx])
})

test('readPrefs: ไม่มีค่าเก็บไว้ → ค่าเริ่มต้น', () => {
  assert.deepEqual(readPrefs(fakeStorage()), DEFAULT_PREFS)
})

test('readPrefs: JSON เสีย → ค่าเริ่มต้น ไม่ throw', () => {
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': '{ไม่ใช่ json' })
  assert.deepEqual(readPrefs(s), DEFAULT_PREFS)
})

test('readPrefs: ค่าที่ไม่รู้จักถูกแทนที่ทีละฟิลด์', () => {
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ fx: 'ระเบิด', pace: 'tight', style: 'Z' }) })
  assert.deepEqual(readPrefs(s), { ...DEFAULT_PREFS, pace: 'tight' })
})

test('readPrefs: prefs รุ่นเก่าที่ยังไม่มี style/motionOverride → เติมค่าเริ่มต้นให้ ไม่ทิ้ง pace ที่เลือกไว้', () => {
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ fx: 'mid', pace: 'tight' }) })
  assert.deepEqual(readPrefs(s), { fx: 'mid', pace: 'tight', style: DEFAULT_PREFS.style, motionOverride: false })
})

test('writePrefs แล้ว readPrefs ได้ค่าเดิมกลับมา', () => {
  const s = fakeStorage()
  writePrefs({ fx: 'low', pace: 'grand', style: 'C', motionOverride: true }, s)
  assert.deepEqual(readPrefs(s), { fx: 'low', pace: 'grand', style: 'C', motionOverride: true })
})

test('ท่าชนครบ 4 แบบ และทุกแบบมีฟิลด์ที่ battleFx อ่านครบ', () => {
  assert.deepEqual(Object.keys(MOTION_STYLES), ['A', 'B', 'C', 'D'])
  for (const [name, s] of Object.entries(MOTION_STYLES)) {
    for (const k of ['label', 'hint', 'reach', 'pull', 'chipReach', 'spin', 'back', 'bounce', 'recoil', 'squash']) {
      assert.ok(s[k] !== undefined, `${name} ขาดฟิลด์ ${k}`)
    }
    assert.ok(['tail', 'snap', 'fast'].includes(s.back), `${name}.back ต้องเป็นค่าที่ lunge() รู้จัก`)
    for (const tier of ['solid', 'heavy', 'finish']) {
      assert.equal(typeof s.recoil[tier], 'number')
      assert.equal(typeof s.squash[tier], 'number')
    }
  }
})

test('แบบ A = พฤติกรรมเดิมเป๊ะ (ไม่มีอะไรขยับเพิ่มจากของที่ deploy ไปแล้ว)', () => {
  const A = MOTION_STYLES.A
  assert.equal(A.reach, 1)            // พุ่งทับกลางเป้า
  assert.equal(A.chipReach, 0)        // ชั้นถากไม่แตะการ์ด
  assert.equal(A.bounce, 0)
  assert.equal(A.spin, 0)
  assert.equal(A.back, 'tail')
  assert.equal(A.recoil.solid + A.recoil.heavy + A.recoil.finish, 0)
  assert.equal(A.squash.solid, 0)     // ชั้น solid ไม่เคยมีปฏิกิริยาที่การ์ดเป้า
  assert.equal(A.squash.heavy, 0.36)  // ค่าเดิมใน squashTarget()
  assert.equal(A.squash.finish, 0.5)
  assert.equal(DEFAULT_PREFS.style, 'A')   // ของที่ส่งถึงนักศึกษายังไม่เปลี่ยนจนกว่าจะเลือกแบบใหม่
})

test('motionStyle: ชื่อมั่ว/undefined → ตกกลับแบบเริ่มต้น ไม่คืน undefined', () => {
  assert.equal(motionStyle('C'), MOTION_STYLES.C)
  assert.equal(motionStyle('ไม่มีอันนี้'), MOTION_STYLES[DEFAULT_PREFS.style])
  assert.equal(motionStyle(undefined), MOTION_STYLES[DEFAULT_PREFS.style])
})

test('ไม่มี storage เลย (SSR/โหมดปิดคุกกี้) → ไม่ throw', () => {
  assert.deepEqual(readPrefs(null), DEFAULT_PREFS)
  assert.doesNotThrow(() => writePrefs({ fx: 'low', pace: 'tight' }, null))
})

test('storage โยน error ตอนเขียน (โควตาเต็ม/Safari private) → ไม่ throw', () => {
  const boom = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') } }
  assert.deepEqual(readPrefs(boom), DEFAULT_PREFS)
  assert.doesNotThrow(() => writePrefs({ fx: 'high', pace: 'normal' }, boom))
})
