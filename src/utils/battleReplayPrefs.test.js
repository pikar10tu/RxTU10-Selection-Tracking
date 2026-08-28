import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FX_PRESETS, PACE_PRESETS, REDUCED_FLAGS, DEFAULT_PREFS,
  readPrefs, writePrefs, fxFlags, paceMult,
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
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ fx: 'ระเบิด', pace: 'tight' }) })
  assert.deepEqual(readPrefs(s), { ...DEFAULT_PREFS, pace: 'tight' })
})

test('prefs รุ่นเก่าที่มี style/motionOverride ค้างอยู่ → ทิ้งฟิลด์ที่เลิกใช้ แต่ไม่ทิ้ง pace ที่เลือกไว้', () => {
  // ⚠️ เครื่องที่เคยเทสท่าชน A/B/C/D จะมีค่าเก่าค้างใน localStorage — ต้องอ่านผ่านได้ ไม่ throw
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ fx: 'mid', pace: 'tight', style: 'C', motionOverride: true }) })
  assert.deepEqual(readPrefs(s), { fx: 'mid', pace: 'tight', legacyBeats: false })
})

test('writePrefs แล้ว readPrefs ได้ค่าเดิมกลับมา', () => {
  const s = fakeStorage()
  writePrefs({ fx: 'low', pace: 'grand', legacyBeats: true }, s)
  assert.deepEqual(readPrefs(s), { fx: 'low', pace: 'grand', legacyBeats: true })
})

test('legacyBeats: ค่าเริ่มต้นที่ส่งถึงนักศึกษาต้องเป็นจังหวะใหม่', () => {
  assert.equal(DEFAULT_PREFS.legacyBeats, false)
  // ต้องเป็น true เป๊ะเท่านั้นถึงจะเปิดโหมดเดิม — ค่าขยะไม่ควรพาไปโหมดเดิมโดยบังเอิญ
  const s = fakeStorage({ 'rxtu10.battleReplayPrefs': JSON.stringify({ legacyBeats: 'yes' }) })
  assert.equal(readPrefs(s).legacyBeats, false)
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
