import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lungeKeyframes, squashKeyframes, targetReactsIn, LUNGE_POSE } from './battleMotion.js'
import { MOTION_STYLES } from './battleReplayPrefs.js'
import { TIER_TIMING, scaleTiming, FF_SCALE } from './battleBeats.js'

const TIERS = ['chip', 'solid', 'heavy', 'finish']
const STYLES = Object.keys(MOTION_STYLES)
const VEC = { x: 0, y: 140 }        // ระยะจริงระหว่างแถวศัตรูกับแถวเรา ~140px บนกล่อง 440px

// จำลองทุกค่าจังหวะที่เกิดขึ้นได้จริง: pace 3 ระดับ × กดค้างเร่ง/ไม่เร่ง
function allTimings(tier) {
  const out = []
  for (const pace of [1.25, 1, 0.8]) for (const ff of [false, true]) {
    out.push({ label: `pace ${pace}${ff ? ' +เร่ง' : ''}`, t: scaleTiming({ tier, timing: TIER_TIMING[tier] }, { pace, ff }) })
  }
  return out
}

test('offset ของ keyframes ห้ามถอยหลัง — ทุกแบบ × ทุกชั้น × ทุกจังหวะ', () => {
  // WAAPI โยน TypeError ทิ้งทั้งอนิเมชันถ้า offset ไม่เรียงขึ้น = การ์ดนิ่งสนิทโดยไม่มีอะไรฟ้อง
  for (const s of STYLES) for (const tier of TIERS) for (const { label, t } of allTimings(tier)) {
    const kf = lungeKeyframes(s, tier, t, VEC)
    if (!kf) continue
    const offs = kf.map(k => k.offset)
    assert.ok(offs.every(o => o !== undefined), `${s}/${tier}/${label}: มีเฟรมที่ไม่ระบุ offset`)
    assert.equal(offs[0], 0, `${s}/${tier}/${label}: ต้องเริ่มที่ 0`)
    assert.equal(offs[offs.length - 1], 1, `${s}/${tier}/${label}: ต้องจบที่ 1`)
    for (let i = 1; i < offs.length; i++) {
      assert.ok(offs[i] >= offs[i - 1], `${s}/${tier}/${label}: offset ถอยหลังที่เฟรม ${i} (${offs[i - 1]} → ${offs[i]})`)
      assert.ok(offs[i] <= 1, `${s}/${tier}/${label}: offset เกิน 1`)
    }
  }
})

test('เฟรมแรกกับเฟรมสุดท้ายต้องเป็นท่าพัก — ไม่งั้นการ์ดค้างเบี้ยวหลัง fill:none คืนค่า', () => {
  for (const s of STYLES) for (const tier of TIERS) {
    const kf = lungeKeyframes(s, tier, scaleTiming({ tier, timing: TIER_TIMING[tier] }, {}), VEC)
    if (!kf) continue
    assert.equal(kf[0].transform, 'translate(0,0) scale(1)', `${s}/${tier}`)
    assert.equal(kf[kf.length - 1].transform, 'translate(0,0) scale(1)', `${s}/${tier}`)
  }
})

test('แบบ A ให้ keyframes เดิมเป๊ะ (ของที่ deploy ไปแล้วต้องไม่ขยับ)', () => {
  const t = TIER_TIMING.heavy
  const total = t.windup + t.motion + t.hitstop + t.tail
  const P = LUNGE_POSE.heavy
  assert.deepEqual(lungeKeyframes('A', 'heavy', t, VEC), [
    { transform: 'translate(0,0) scale(1)', offset: 0 },
    { transform: `translate(0, ${P.pull.toFixed(1)}px) scale(${P.psx}, ${P.psy})`, offset: t.windup / total },
    { transform: `translate(0.0px, 140.0px) scale(${P.sx}, ${P.sy})`, offset: (t.windup + t.motion) / total },
    { transform: `translate(0.0px, 140.0px) scale(${P.sx}, ${P.sy})`, offset: (t.windup + t.motion + t.hitstop) / total },
    { transform: 'translate(0,0) scale(1)', offset: 1 },
  ])
  // ชั้นถากในแบบ A ต้องไม่แตะการ์ดเลย — นี่คือของที่ทำให้ 55% ของหมัดถูกสุด
  assert.equal(lungeKeyframes('A', 'chip', TIER_TIMING.chip, VEC), null)
})

test('แบบ B/C/D ทำให้ชั้นถากขยับ และหยุดก่อนถึงกลางเป้า (เห็นการ์ดทั้งคู่ตอนปะทะ)', () => {
  for (const s of ['B', 'C', 'D']) {
    assert.ok(lungeKeyframes(s, 'chip', TIER_TIMING.chip, VEC), `${s}: ชั้นถากต้องขยับ`)
    const kf = lungeKeyframes(s, 'heavy', TIER_TIMING.heavy, VEC)
    const hit = kf.find(k => k.transform.includes('140') || /translate\(0\.0px, (\d+)/.test(k.transform))
    const dist = parseFloat(kf[2].transform.match(/translate\(0\.0px, ([\d.]+)px/)[1])
    assert.ok(hit, `${s}: ต้องมีเฟรมปะทะ`)
    assert.ok(dist > 0 && dist < 140, `${s}: ต้องหยุดก่อนถึงกลางเป้า (ได้ ${dist} จาก 140)`)
  }
})

test('เอียงตัวตามทิศ: ตีลงซ้าย/ขวา เครื่องหมายองศาต้องกลับกัน (แบบ C เท่านั้นที่เอียง)', () => {
  const right = lungeKeyframes('C', 'heavy', TIER_TIMING.heavy, { x: 100, y: 140 })
  const left  = lungeKeyframes('C', 'heavy', TIER_TIMING.heavy, { x: -100, y: 140 })
  assert.ok(right[2].transform.includes('rotate(7.0deg)'))
  assert.ok(left[2].transform.includes('rotate(-7.0deg)'))
  // แบบอื่นไม่เอียงเลย
  for (const s of ['A', 'B', 'D']) {
    assert.ok(!lungeKeyframes(s, 'heavy', TIER_TIMING.heavy, VEC)[2].transform.includes('rotate'), s)
  }
})

test('แบบ snap/fast กลับเข้าที่แล้วนิ่งก่อน beat จบ · แบบ tail ลอยกลับยาวจนสุด', () => {
  // D (fast, tail 1070ms ของชั้น finish) → ต้องมีเฟรม "ถึงที่แล้ว" ก่อน offset 1 ชัดเจน
  const d = lungeKeyframes('D', 'finish', TIER_TIMING.finish, VEC)
  const settled = d[d.length - 2].offset
  assert.ok(settled < 0.75, `แบบ D ควรกลับเข้าที่เร็ว (ได้ offset ${settled})`)
  // A (tail) → เฟรมก่อนสุดท้ายคือจังหวะปะทะ ไม่ใช่จังหวะกลับถึงที่
  const a = lungeKeyframes('A', 'finish', TIER_TIMING.finish, VEC)
  assert.ok(a[a.length - 2].transform.includes('140.0px'))
})

test('ชั้นที่การ์ดเป้ามีปฏิกิริยา: แบบ A = heavy/finish เท่านั้น · B/C/D รวม solid ด้วย · ไม่มีแบบไหนแตะชั้นถาก', () => {
  assert.equal(targetReactsIn('A', 'solid'), false)
  assert.equal(targetReactsIn('A', 'heavy'), true)
  assert.equal(targetReactsIn('A', 'finish'), true)
  for (const s of STYLES) assert.equal(targetReactsIn(s, 'chip'), false, `${s}: ชั้นถากห้ามแตะการ์ดเป้า (แพงเกิน 55% ของหมัด)`)
  for (const s of ['B', 'C', 'D']) assert.equal(targetReactsIn(s, 'solid'), true, s)
})

test('squashKeyframes: ไม่มีปฏิกิริยา → null · มีแล้วต้องเริ่ม/จบที่ท่าพัก', () => {
  assert.equal(squashKeyframes('A', 'solid', { x: 0, y: 1 }), null)
  assert.equal(squashKeyframes('A', 'chip', { x: 0, y: 1 }), null)
  for (const s of STYLES) for (const tier of ['heavy', 'finish']) {
    const kf = squashKeyframes(s, tier, { x: 0, y: 1 })
    assert.equal(kf[0].transform, 'translate(0,0) scale(1)', `${s}/${tier}`)
    assert.equal(kf[kf.length - 1].transform, 'translate(0,0) scale(1)', `${s}/${tier}`)
  }
  // แบบ A ไม่กระแทกถอย (translate ต้องเป็น 0 ทุกเฟรม) — ของเดิมบีบอย่างเดียว
  for (const k of squashKeyframes('A', 'heavy', { x: 0, y: 1 })) {
    assert.ok(k.transform.startsWith('translate(0,0)') || k.transform.startsWith('translate(0.0px, 0.0px)'), k.transform)
  }
  // แบบ C กระแทกถอยตามแนวหมัดจริง
  assert.ok(squashKeyframes('C', 'heavy', { x: 0, y: 1 })[1].transform.startsWith('translate(0.0px, 20.0px)'))
})

test('ชื่อแบบมั่ว → ตกกลับแบบเริ่มต้น ไม่ throw', () => {
  assert.deepEqual(lungeKeyframes('ไม่มีอันนี้', 'heavy', TIER_TIMING.heavy, VEC),
    lungeKeyframes('A', 'heavy', TIER_TIMING.heavy, VEC))
})

test('ชั้นที่ไม่รู้จัก / เวลาเป็นศูนย์ → null ไม่ throw', () => {
  assert.equal(lungeKeyframes('B', 'ไม่มีชั้นนี้', TIER_TIMING.heavy, VEC), null)
  assert.equal(lungeKeyframes('B', 'heavy', { windup: 0, motion: 0, hitstop: 0, tail: 0 }, VEC), null)
  // FF_SCALE ต้องไม่ทำให้ heavy/finish หายไป (ข้อบังคับ: กดค้างไม่ย่อสองชั้นบน)
  assert.equal(FF_SCALE.heavy, 1)
  assert.equal(FF_SCALE.finish, 1)
})
