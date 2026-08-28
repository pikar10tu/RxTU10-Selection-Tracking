import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lungeKeyframes, squashKeyframes, targetReactsIn, lungesIn, shakeFor,
  LUNGE, DEPTH, SQUASH, SHAKE,
} from './battleMotion.js'
import { timingOf } from './battleBeats.js'

const VEC = { x: 60, y: -120 }
const HIT_KINDS = ['hit', 'ko', 'finish']
const num = (s, re) => Number(String(s).match(re)?.[1] ?? NaN)

// ── ข้อบังคับ v3: offset ต้องเรียงขึ้นเสมอ ───────────────────────────
// WAAPI โยนทั้งอนิเมชันทิ้ง "เงียบๆ" ถ้า offset ถอยหลัง = การ์ดนิ่งสนิททั้งไฟต์
// โดยไม่มี error ให้เห็นบนมือถือ → ต้องมีเทสจับ ไม่ใช่ไล่อ่านเอา
test('offset ของ keyframes ต้องไม่ถอยหลัง ทุก kind ทุก weight', () => {
  for (const kind of HIT_KINDS) {
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      const kf = lungeKeyframes(kind, w, timingOf(kind), VEC)
      assert.ok(kf, `${kind}/${w} ต้องได้ keyframes`)
      let prev = -1
      for (const f of kf) {
        assert.ok(f.offset >= prev, `${kind}/${w} offset ถอยหลัง: ${f.offset} < ${prev}`)
        prev = f.offset
      }
      assert.equal(kf[0].offset, 0)
      assert.equal(kf[kf.length - 1].offset, 1)
    }
  }
})

test('offset ไม่ถอยหลังแม้ timing ถูกย่อด้วยกดค้างเร่ง (tail สั้นกว่า backMs)', () => {
  const t = timingOf('hit')
  const tiny = { windup: t.windup * 0.45, motion: t.motion * 0.45, hitstop: t.hitstop * 0.45, tail: t.tail * 0.45 }
  const kf = lungeKeyframes('hit', 0.5, tiny, VEC)
  let prev = -1
  for (const f of kf) { assert.ok(f.offset >= prev); prev = f.offset }
})

// ── ข้อที่ user สั่งตรงๆ: การ์ดทุกใบต้องขยับ ────────────────────────

test('🔑 ทุก kind ที่เป็นหมัดจริง ต้องได้ keyframes ไม่ใช่ null', () => {
  // กัน chipReach:0 กลับมาเงียบๆ — ของเดิม 41.8% ของหมัดทั้งไฟต์การ์ดไม่ขยับเลย
  for (const kind of HIT_KINDS) {
    assert.ok(lungeKeyframes(kind, 0, timingOf(kind), VEC), `${kind} ที่ weight 0 ก็ต้องขยับ`)
  }
})

test('🔑 weight ต่างกัน → ระยะพุ่งต้องเท่ากันเป๊ะ (weight คุมแค่ความลึก)', () => {
  const t = timingOf('hit')
  const at = (w) => {
    const kf = lungeKeyframes('hit', w, t, VEC)
    const hit = kf.find(f => f.transform.includes('translate(') && !f.transform.startsWith('translate(0,'))
    return { x: num(hit.transform, /translate\((-?[\d.]+)px/), y: num(hit.transform, /,\s*(-?[\d.]+)px\)/) }
  }
  const a = at(0), b = at(1)
  assert.equal(a.x, b.x, 'ระยะแนวนอนต้องเท่ากัน')
  assert.equal(a.y, b.y, 'ระยะแนวตั้งต้องเท่ากัน')
  assert.equal(a.x, Number((VEC.x * LUNGE.reach).toFixed(1)))
})

test('weight มากขึ้น → เงื้อลึกขึ้น (แต่ยังเป็นท่าเดียวกัน)', () => {
  const t = timingOf('hit')
  const pullOf = (w) => {
    const kf = lungeKeyframes('hit', w, t, VEC)
    return num(kf[1].transform, /translate\(0,\s*([\d.]+)px/)
  }
  assert.ok(pullOf(1) > pullOf(0))
  assert.equal(pullOf(0), Number(LUNGE.pullBase.toFixed(1)))
})

test('kind ที่แรงกว่าเงื้อลึกกว่า ที่ weight เท่ากัน — แต่ระยะยังเท่าเดิม', () => {
  const pullOf = (kind) => {
    const kf = lungeKeyframes(kind, 0.5, timingOf(kind), VEC)
    return num(kf[1].transform, /translate\(0,\s*([\d.]+)px/)
  }
  assert.ok(pullOf('finish') > pullOf('ko'))
  assert.ok(pullOf('ko') > pullOf('hit'))
  assert.equal(DEPTH.hit, 1)
})

test('หมัดลูกไม่ขยับการ์ด (มันอยู่ในหมัดหลักที่กำลังพุ่งอยู่แล้ว)', () => {
  assert.equal(lungesIn('sub'), false)
  assert.equal(lungeKeyframes('sub', 0.5, timingOf('hit'), VEC), null)
})

test('kind ที่ไม่ใช่หมัด / timing ศูนย์ → null ไม่ throw', () => {
  for (const k of ['skill', 'skillMoment', 'openGroup', 'ไม่มีอันนี้', null, undefined]) {
    assert.equal(lungeKeyframes(k, 0.5, timingOf('hit'), VEC), null, String(k))
  }
  assert.equal(lungeKeyframes('hit', 0.5, { windup: 0, motion: 0, hitstop: 0, tail: 0 }, VEC), null)
})

test('vec ที่ขาด/เป็นศูนย์ ต้องไม่ทำให้เกิด NaN ใน transform', () => {
  for (const v of [null, undefined, { x: 0, y: 0 }, {}]) {
    const kf = lungeKeyframes('hit', 0.5, timingOf('hit'), v)
    assert.ok(kf)
    for (const f of kf) assert.ok(!f.transform.includes('NaN'), `${JSON.stringify(v)} → ${f.transform}`)
  }
})

test('เอียงเข้าหาเป้าตามทิศจริง — ตีขึ้นบนกับตีลงล่างต้องคนละทาง', () => {
  const t = timingOf('hit')
  const up = lungeKeyframes('hit', .5, t, { x: 0, y: -100 })
  const down = lungeKeyframes('hit', .5, t, { x: 0, y: 100 })
  const yOf = (kf) => num(kf[2].transform, /,\s*(-?[\d.]+)px\)/)
  assert.ok(yOf(up) < 0 && yOf(down) > 0)
})

// ── การ์ดเป้า ───────────────────────────────────────────────────────

test('การ์ดเป้ามีปฏิกิริยาทุกหมัดจริง (เดิมชั้น solid ไม่มีเลย)', () => {
  for (const kind of HIT_KINDS) assert.equal(targetReactsIn(kind), true, kind)
  assert.equal(targetReactsIn('sub'), false)
  assert.equal(targetReactsIn('skill'), false)
})

test('squash: แรงขึ้นตาม weight · offset เรียงขึ้น · ไม่มี NaN', () => {
  const amtOf = (w) => {
    const kf = squashKeyframes('hit', w, { x: 0.5, y: -0.87 })
    return num(kf[1].transform, /scale\(([\d.]+)/)
  }
  assert.ok(amtOf(1) > amtOf(0))
  const kf = squashKeyframes('hit', 0.5, null)
  let prev = -1
  for (const f of kf) { if (f.offset != null) { assert.ok(f.offset >= prev); prev = f.offset } }
  for (const f of kf) assert.ok(!f.transform.includes('NaN'))
  assert.ok(SQUASH.amtBase > 0)
})

test('squash คืน null สำหรับ kind ที่ไม่ใช่หมัด', () => {
  for (const k of ['sub', 'skill', 'openGroup', null]) assert.equal(squashKeyframes(k, .5, null), null, String(k))
})

// ── จอสั่น ─────────────────────────────────────────────────────────

test('🔒 จอสั่นเฉพาะโมเมนต์ — หมัดปกติและหมัดลูกห้ามสั่นเด็ดขาด', () => {
  assert.equal(shakeFor('hit'), null)
  assert.equal(shakeFor('sub'), null)
  assert.equal(shakeFor('skill'), null)
  assert.equal(shakeFor('ไม่มีอันนี้'), null)
  assert.equal(shakeFor(undefined), null)
  assert.deepEqual(shakeFor('ko'), SHAKE.ko)
  assert.deepEqual(shakeFor('finish'), SHAKE.finish)
  assert.ok(SHAKE.finish[0] > SHAKE.ko[0], 'ปิดเกมต้องแรงกว่า KO')
})

// ── deterministic ───────────────────────────────────────────────────

test('input เดิม → keyframes เหมือนเดิมเป๊ะ (ไม่มีสุ่มในนี้)', () => {
  const t = timingOf('ko')
  assert.deepEqual(lungeKeyframes('ko', .6, t, VEC), lungeKeyframes('ko', .6, t, VEC))
  assert.deepEqual(squashKeyframes('ko', .6, { x: 1, y: 0 }), squashKeyframes('ko', .6, { x: 1, y: 0 }))
})
