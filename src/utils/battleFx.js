// battleFx.js — motion layer ของ BattleReplay (plain JS ไม่พึ่ง Vue)
// doctrine: pool element promote ถาวร reuse · ขับด้วย WAAPI transform/opacity เท่านั้น · promise resolve เสมอ · one-way (Vue→fx)
import { fluentFile } from './emoji.js'
import { fxFlags, REDUCED_FLAGS } from './battleReplayPrefs.js'
import { lungeKeyframes, squashKeyframes, targetReactsIn, shakeFor } from './battleMotion.js'
import { prefersReducedMotion } from './motionPref.js'

const BASE = import.meta.env.BASE_URL

export function createBattleFx() {
  let boxEl = null, layer = null, getEl = () => null, rate = 1
  const anims = new Set()               // active WAAPI (สำหรับ cancelAll)
  let centers = {}, boxRect = null
  let flags = fxFlags(undefined)                    // ค่าเริ่มต้นจาก DEFAULT_PREFS จนกว่า component จะเรียก setFlags
  let ignoreReduced = false                         // ⚠️ ห้องแล็บเท่านั้น: เทียบบนเครื่องที่เปิด Reduce Motion ไว้
  const reduced = () => !ignoreReduced && prefersReducedMotion()
  // อ่าน flag ผ่านตัวนี้เสมอ — reduced-motion ทับ preset ที่ user เลือกได้ตลอด
  const F = (k) => (reduced() ? REDUCED_FLAGS[k] : flags[k])
  function setFlags(f) { flags = { ...flags, ...(f || {}) } }
  function setReducedOverride(v) { ignoreReduced = !!v }

  // ── centers cache (ย้ายมาจาก BattleReplay) ──
  function invalidateCenters() { centers = {}; boxRect = null }
  function centerOf(uid) {
    const c = centers[uid]; if (c) return c
    const el = getEl(uid); if (!el || !boxEl) return null
    if (!boxRect) boxRect = boxEl.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const v = { x: r.left - boxRect.left + r.width / 2, y: r.top - boxRect.top + r.height / 2 }
    centers[uid] = v; return v
  }
  function onResize() { invalidateCenters() }

  // ── WAAPI helper: resolve เสมอ (cancel = reject → กลืน) ──
  function run(el, keyframes, opts) {
    // delay หารด้วย rate เหมือน duration — ไม่งั้นตอนกดค้างเร่ง ป้ายที่เข้าคิวจะไม่เร่งตาม
    const a = el.animate(keyframes, {
      duration: opts.duration / rate, delay: (opts.delay || 0) / rate,
      easing: opts.easing || 'ease-out', fill: opts.fill || 'none',
    })
    anims.add(a)
    return a.finished.catch(() => {}).finally(() => anims.delete(a))
  }

  function attach({ boxEl: b, layerEl, getEl: g }) {
    boxEl = b; layer = layerEl; getEl = g
    buildPools()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
  }
  function reset() { invalidateCenters(); cancelAll(); stackAt.clear() }
  function cancelAll() {
    for (const a of anims) a.cancel()          // reject → run() กลืนแล้ว
    anims.clear()
    dangerOn.clear()                           // สถานะค้าง ต้องล้างด้วย ไม่งั้นไฟต์ใหม่จะ reuse element ไม่ได้
    stackAt.clear()
    hideAllPools()
  }
  function setRate(s) { rate = s || 1 }
  function destroy() {
    cancelAll()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    if (layer) layer.innerHTML = ''
  }

  // ── pool infra ──
  function mkEl(cls) { const e = document.createElement('div'); e.className = 'brfx ' + cls; layer.appendChild(e); return e }
  function mkImg(cls) { const e = document.createElement('img'); e.className = 'brfx ' + cls; e.setAttribute('aria-hidden', 'true'); e.loading = 'eager'; e.decoding = 'sync'; layer.appendChild(e); return e }
  function imgSrc(el, char) { const f = fluentFile(char); el.src = f ? BASE + f : '' }
  // ตั้งตำแหน่งฐานด้วย transform (translateZ promote) — dx/dy = offset ในหน่วย px, bake ใน translate
  function baseXform(uid, dx = 0, dy = 0) { const c = centerOf(uid); return c ? `translate(${(c.x + dx).toFixed(1)}px, ${(c.y + dy).toFixed(1)}px) translateZ(0)` : null }

  const pool = { pop: [], call: [], puff: [], ring: [], burst: [], proj: [], dash: [], jab: [], danger: [], sweep: [] }
  const idx = { pop: 0, call: 0, puff: 0, jab: 0, sweep: 0, burst: 0, proj: 0 }
  const dangerOn = new Map()      // uid → element ที่กำลังเต้นอยู่

  // ── เลือกช่องในพูลแบบ "ไม่แย่งของที่ยังวิ่งอยู่" ──
  // ⚠️ ของเดิมเป็น round-robin ล้วน · พูล pop มี 4 ช่อง แต่วัดจาก log จริงได้ว่ามีเลขลอย
  //    พร้อมกันสูงสุด 6 ตัวใน 900ms ⇒ เลขที่ยังไม่จางถูกดึงไปใช้ที่การ์ดอื่น = เลขกระโดดข้ามจอ
  //    (นี่คือครึ่งหนึ่งของอาการ "ป้ายขึ้นมั่ว" ที่ user รายงาน 28 ส.ค.)
  function take(name) {
    const arr = pool[name]
    for (let k = 1; k <= arr.length; k++) {
      const i = (idx[name] + k) % arr.length
      const busy = arr[i].getAnimations?.().some(a => a.playState === 'running')
      if (!busy) { idx[name] = i; return arr[i] }
    }
    idx[name] = (idx[name] + 1) % arr.length     // เต็มจริงๆ — ยอมยึดตัวที่เก่าสุด
    return arr[idx[name]]
  }

  // ── will-change เฉพาะตอนมีอนิเมชันวิ่ง ──
  // ⚠️ ของเดิม .brfx ตั้ง will-change ถาวร ⇒ ทุกชิ้นในพูลเป็น compositor layer ตลอดเวลา
  //    แอนดรอยด์กลางๆ fps ตกตอนพูลขึ้นจาก 24 → 31 ชิ้น · รอบนี้พูลใหญ่ขึ้นเป็น 39
  //    ถ้ายังตั้งถาวรจะยิ่งแย่ → ใส่ตอนใช้ เคลียร์ตอนจบ = layer ที่ active จริงน้อยกว่าเดิมด้วยซ้ำ
  function lift(el) { el.style.willChange = 'transform, opacity' }
  function drop(el) { el.style.willChange = '' }
  /** ยิง WAAPI บน pool element + จัดการ will-change/opacity ให้ครบ (ใช้แทน el.animate ตรงๆ) */
  function fire(el, kf, opts) {
    lift(el)
    const a = el.animate(kf, opts)
    anims.add(a)
    return a.finished.catch(() => {}).finally(() => { anims.delete(a); drop(el); el.style.opacity = '0' })
  }

  function buildPools() {
    // พูล pop/call ใหญ่ขึ้นตามที่วัดจริง (pop พีค 6 ตัวใน 900ms · call ซ้อนได้จาก super/weak/survive/น็อก)
    for (let i = 0; i < 10; i++) pool.pop.push(mkEl('brfx-pop'))
    for (let i = 0; i < 4; i++) pool.call.push(mkEl('brfx-call'))
    for (let i = 0; i < 2; i++) { const e = mkImg('brfx-puff'); imgSrc(e, '💀'); pool.puff.push(e) }
    pool.ring = [mkEl('brfx-ring')]
    pool.burst = [mkImg('brfx-burst'), mkImg('brfx-burst')]
    pool.burst.forEach(e => imgSrc(e, '💥'))
    pool.proj = [mkImg('brfx-proj'), mkImg('brfx-proj')]
    pool.dash = [mkImg('brfx-dash')]
    pool.jab = [mkImg('brfx-jab'), mkImg('brfx-jab')]
    pool.jab.forEach(e => imgSrc(e, '💥'))
    for (let i = 0; i < 8; i++) pool.danger.push(mkEl('brfx-danger'))   // สูงสุด 8 ตัวต่อไฟต์ (4v4)
    for (let i = 0; i < 3; i++) pool.sweep.push(mkImg('brfx-sweep'))    // cleave มากสุด 3 เป้า
    hideAllPools()
  }
  function hideAllPools() {
    for (const arr of Object.values(pool)) for (const e of arr) {
      e.style.opacity = '0'; e.style.willChange = ''
      e.getAnimations?.().forEach(a => a.cancel())
    }
  }

  // ── effect methods (pooled ephemeral, imperative fire-and-forget) ──

  // เลขซ้อนบนการ์ดเดียวกัน (cleave/multiStrike ลงพร้อมกัน) — ซ้อน "ขึ้นเป็นชั้น" ไม่ใช่สุ่มกระจาย
  // ⚠️ ของเดิมใช้ Math.random()*28-14 สุ่มเยื้องซ้ายขวาทุกครั้ง = อ่านเป็น "มั่ว" ตรงๆ
  const stackAt = new Map()       // uid → จำนวนเลขที่ยังลอยอยู่บนการ์ดนั้น
  const STACK_STEP = 15, STACK_WRAP = 3

  /**
   * @param {Object} o { dmg, crit, eff, weight, kind, heal }
   *   weight 0..1 คุมขนาด/อายุ/ระยะลอยแบบต่อเนื่อง — ไม่มีขั้นบันไดตามชั้นอีกแล้ว
   */
  function pop(uid, o) {
    const { dmg, crit, eff, heal } = o || {}
    const w = Math.max(0, Math.min(1, o?.weight ?? 0.4))
    const el = take('pop')
    el.getAnimations?.().forEach(a => a.cancel())
    el.textContent = (heal ? '+' : '-') + dmg
    el.className = 'brfx brfx-pop'
      + (heal ? ' heal' : crit ? ' crit' : eff === 'super' ? ' super' : eff === 'weak' ? ' weak' : '')
    // ขนาดต่อเนื่อง — CSS .tier-* 4 คลาสถูกลบแล้ว ขนาดมาจากที่นี่ที่เดียว
    el.style.fontSize = (0.86 + w * 1.0).toFixed(2) + 'rem'

    const n = stackAt.get(uid) || 0
    const dy = -6 - (n % STACK_WRAP) * STACK_STEP
    const base = baseXform(uid, 0, dy); if (!base) return
    stackAt.set(uid, n + 1)

    el.style.opacity = '1'
    // ไม่หารด้วย rate — อ่านเลขทันเสมอแม้กดค้างเร่ง (หลักการเดิม)
    const ms = 620 + w * 420
    const rise = 16 + w * 26
    const kf = [
      { transform: base + ' translateY(0) scale(.4)', opacity: 0, offset: 0 },
      { transform: base + ' translateY(-7px) scale(1.28)', opacity: 1, offset: .26 },
      { transform: base + ' translateY(-12px) scale(1)', opacity: 1, offset: .44 },
      { transform: base + ` translateY(-${rise.toFixed(0)}px) scale(1)`, opacity: 0, offset: 1 },
    ]
    lift(el)
    const a = el.animate(kf, { duration: ms, easing: 'ease-out', fill: 'forwards' })
    anims.add(a)
    a.finished.catch(() => {}).finally(() => {
      anims.delete(a); drop(el); el.style.opacity = '0'
      stackAt.set(uid, Math.max(0, (stackAt.get(uid) || 1) - 1))
    })
  }

  function callout(uid, kind) {              // kind: 'super' | 'weak' | 'survive'
    const el = take('call')
    el.getAnimations?.().forEach(a => a.cancel())
    el.className = 'brfx brfx-call ' + kind
    // คู่คำที่ user เลือก 28 ส.ค.: แพ้ทาง / ชนะทาง (เดิมใช้ 'ต้านทาน' ซึ่งไม่เข้าคู่กับ 'แพ้ทาง')
    el.textContent = kind === 'super' ? 'แพ้ทาง! ⚡' : kind === 'survive' ? 'รอด!' : 'ชนะทาง 🛡️'
    const base = baseXform(uid, 0, -16); if (!base) return
    el.style.opacity = '1'
    const a = el.animate([
      { transform: base + ' translateY(0)', opacity: 1 },
      { transform: base + ' translateY(-24px)', opacity: 0 },
    ], { duration: 750, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { el.style.opacity = '0' })
  }

  function koPuff(uid) {
    const el = take('puff')
    el.getAnimations?.().forEach(a => a.cancel())
    const base = baseXform(uid, 0, 0); if (!base) return
    el.style.opacity = '1'
    const a = el.animate([
      { transform: base + ' translateY(0) scale(.6)', opacity: 1 },
      { transform: base + ' translateY(-16px) scale(1.25)', opacity: 0 },
    ], { duration: 500, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { el.style.opacity = '0' })
  }

  // ── วงแหวนเงื้อ: ต้องดับเมื่อ "เงื้อจบ" ไม่ใช่ค้างอยู่จนกว่าจะมีคนเงื้อใหม่ ──
  // เดิมจบที่ opacity .9 + fill:'forwards' แล้วดับเฉพาะ phase 'acting' ซึ่งไม่มี call site เหลือแล้ว
  // → แหวนทองค้างบนการ์ดที่ไม่ได้ทำอะไร (ชั้น chip ~57% ของ beat ไม่เรียกตัวนี้เลย) ยาวหลายวินาที
  //   บางทีค้างบนการ์ดที่ตายไปแล้ว และค้างยาวถึงหน้าสรุป → "แหวนที่ติดตลอด" ไม่ได้บอกอะไรเลย
  // แก้: เติมเฟรมวูบดับท้าย keyframes (บานออก+จาง) จบที่ opacity 0 พร้อมจังหวะที่หมัดถูกปล่อย
  //      — จบด้วย opacity 0 ทำให้ fill:'forwards' ค้างค่า 0 เอง ไม่ต้องพึ่ง el.style ตามหลัง
  //      (⚠️ el.style.opacity สู้ค่าที่ animation fill:'forwards' ค้างไว้ไม่ได้ — นี่คือเหตุผลที่ของเดิมถึงดับไม่ลงแม้จะเข้า branch)
  function ring(uid, phase, ms) {
    const el = pool.ring[0]
    el.getAnimations?.().forEach(a => a.cancel())
    el.className = 'brfx brfx-ring ' + phase
    const base = baseXform(uid, 0, 0); if (!base) return Promise.resolve()
    el.style.transform = base
    return run(el, [
      { transform: base + ' scale(.85)', opacity: 0, offset: 0 },
      { transform: base + ' scale(1.05)', opacity: 1, offset: .35 },
      { transform: base + ' scale(1)', opacity: .9, offset: .78 },
      { transform: base + ' scale(1.15)', opacity: 0, offset: 1 },
    ], { duration: ms || 250, easing: 'ease-out', fill: 'forwards' })
  }
  // char = ประกายประจำตัวของผู้ตี (null = 💥 กลาง) — ไม่เพิ่ม element ใหม่ แค่สลับ src บนตัวเดิมในพูล
  function burst(uid, size, char) {
    if (!F('burst')) return Promise.resolve()
    const el = take('burst')
    el.getAnimations?.().forEach(a => a.cancel())
    // ⚠️ imgSrc ตั้ง src='' ถ้า emoji ไม่มี asset → ดาวหายทั้งดวง จึงเช็ค fluentFile ก่อนสลับ
    imgSrc(el, (char && fluentFile(char)) ? char : '💥')
    const base = baseXform(uid, 0, 0); if (!base) return Promise.resolve()
    if (size) { el.style.width = size + 'px'; el.style.height = size + 'px' }   // ทับ .brfx-burst ที่ตั้ง 2rem ไว้
    el.style.opacity = '1'
    return run(el, [
      { transform: base + ' scale(.4)', opacity: 1 },
      { transform: base + ' scale(1.4)', opacity: 0 },
    ], { duration: 280, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }

  // ── ชั้น chip: ประกายเล็กระหว่างทาง ไม่แตะการ์ดเลย (นี่คือเหตุผลที่ชั้น 1 ราคาเกือบศูนย์) ──
  function jab(fromUid, toUid, ms = 110) {
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = take('jab')
    el.getAnimations?.().forEach(x => x.cancel())
    el.style.opacity = '1'
    // ⚠️ เดิมประกายบินจากการ์ดผู้ตีไปหาเป้า 70% ของทาง — user รายงาน 27 ส.ค. ว่า "ยังเห็นเป็น range attack"
    //    ถูกแล้ว เพราะชั้น chip = 55% ของหมัดทั้งหมด ⇒ เกินครึ่งของไฟต์ดูเหมือนยิงไกลทั้งที่ทุกตัวเป็น melee
    //    แก้เป็น "ประกายที่จุดปะทะ" — ขยับสั้นๆ ช่วง 82%→95% ของทาง อ่านเป็นหมัดลง ไม่ใช่กระสุน
    //    (ยังใช้ element/animation เท่าเดิม ราคาไม่เปลี่ยน · การ์ดยังไม่ขยับตามข้อตกลงชั้น chip)
    const at = (f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    const s0 = reduced() ? b : at(0.82), s1 = reduced() ? b : at(0.95)
    const sx = s0.x, sy = s0.y
    const ex = s1.x, ey = s1.y
    return run(el, [
      { transform: `translate(${sx}px, ${sy}px) scale(.3) translateZ(0)`, opacity: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.85) translateZ(0)`, opacity: 1, offset: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.6) translateZ(0)`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }

  // ── การ์ดพุ่ง: 1 animation ครอบ windup+motion+hitstop+tail ทั้งก้อน (ข้อบังคับ v3 — 1 promotion/หมัด) ──
  // รูปร่าง keyframes (ระยะที่พุ่งถึง/จังหวะกลับ/เด้ง/เอียง) อยู่ใน battleMotion.js เพราะเป็น pure = เทสได้
  // ที่นี่เหลือแค่ "หา element + วัดพิกัด + ยิง WAAPI + เก็บกวาด"
  function lunge(el, fromUid, toUid, timing, kind, weight) {
    if (!F('cardLunge') || !el) return Promise.resolve()
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const kf = lungeKeyframes(kind, weight, timing, { x: b.x - a.x, y: b.y - a.y })
    if (!kf) return Promise.resolve()            // kind นี้ไม่ให้การ์ดขยับ (หมัดลูก — อยู่ในหมัดหลักแล้ว)
    const total = timing.windup + timing.motion + timing.hitstop + timing.tail
    el.style.zIndex = '7'                        // static ก่อนเริ่ม ไม่อยู่ใน keyframes (ข้อบังคับ v3)
    const anim = el.animate(kf, { duration: total, easing: 'ease-in-out', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => {
      anims.delete(anim); el.style.zIndex = ''; el.style.transform = ''
    })
  }

  // ── เป้าถูกกระแทกถอย + บีบตัวแล้วดีดกลับ — ชั้นไหนบ้างขึ้นกับท่าชน (แบบ A = heavy/finish เท่านั้น เหมือนเดิม) ──
  // ชั้นไหนที่การ์ดเป้า "มีปฏิกิริยา" ภายใต้ preset+ท่าชนปัจจุบัน — ฝั่ง BattleReplay ใช้ตัดสินใจว่าต้องรอเฟรมมั้ย
  // (เดิม hardcode heavy/finish ไว้สองที่ พอแบบ B/C/D ให้ชั้น solid ถอยด้วย ก็ต้องมีที่เดียวที่ตอบคำถามนี้)
  function targetReacts(kind) {
    return F('targetSquash') && targetReactsIn(kind)
  }
  // ⚠️ คืน null เมื่อไม่ได้เล่นอะไร (flag ปิด / ไม่มี el / ท่าชนไม่แตะชั้นนี้) — ห้ามคืน Promise.resolve()
  //    เพราะ promise ที่ resolve แล้วยัง truthy → ฝั่งเรียกแยกไม่ออกว่า "รออนิเมชัน" กับ "ไม่มีอนิเมชันให้รอ"
  //    ผลคือ preset mid/low (targetSquash:false) จะถอด flash ทิ้งใน microtask ถัดไป = เฟรมเดียวกับที่เพิ่งใส่
  function squashTarget(el, kind, weight, ms = 400, fromUid, toUid) {
    if (!F('targetSquash') || !el) return null
    // ทิศกระแทก = แนวเดียวกับที่ผู้ตีพุ่งเข้ามา (นี่คือครึ่งที่ขาดไปของคำว่า "ชน")
    let unit = null
    if (fromUid && toUid) {
      const a = centerOf(fromUid), b = centerOf(toUid)
      if (a && b) { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; unit = { x: (b.x - a.x) / l, y: (b.y - a.y) / l } }
    }
    const kf = squashKeyframes(kind, weight, unit)
    if (!kf) return null
    const anim = el.animate(kf, { duration: ms, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); el.style.transform = '' })
  }

  // ── จอสั่น — ของแพงที่สุดในไฟล์นี้ (transform ทั้ง .br-box = re-raster เต็มจอ) ──
  // เปิดเฉพาะ preset high และเรียกได้เฉพาะชั้น heavy/finish เท่านั้น (§6.2 ของสเปก)
  function shake(kind) {
    if (!F('screenShake') || !boxEl) return Promise.resolve()
    const cfg = shakeFor(kind)
    if (!cfg) return Promise.resolve()          // 🔒 หมัดปกติ/หมัดลูกไม่สั่นจอเด็ดขาด
    const [px, times] = cfg
    const rot = kind === 'finish'
    const kf = [{ transform: 'translate(0,0)' }]
    for (let i = 0; i < times; i++) {
      kf.push({ transform: `translate(${px}px, ${-px}px)${rot ? ' rotate(.6deg)' : ''}` })
      kf.push({ transform: `translate(${-px}px, ${px}px)${rot ? ' rotate(-.6deg)' : ''}` })
    }
    kf.push({ transform: 'translate(0,0)' })
    const anim = boxEl.animate(kf, { duration: 90 * times + 60, easing: 'ease-out', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); boxEl.style.transform = '' })
  }

  // ── น็อก: การ์ดหมุนกระเด็นออก + ควัน (แทน koPuff เดิมสำหรับชั้น finish) ──
  // opacity ในเฟรมนี้ไม่ผิดกฎ "การ์ด: transform เท่านั้น" — ตัวที่ห้ามจริงๆ คือ zIndex/paint (border, class)
  // เพราะทำให้หลุด accelerated path (ดู doctrine บรรทัด 2 ของไฟล์นี้: "ขับด้วย WAAPI transform/opacity เท่านั้น")
  // ส่วน opacity เป็น compositor-only เหมือน transform เลยยัง 1 animation/1 promotion ปกติ
  // ⚠️ คืน null เมื่อไม่ได้เล่นอะไร — เหตุผลเดียวกับ squashTarget() ด้านบน (reduced-motion ปิด ko ด้วย)
  function ko(uid, el, ms = 520) {
    koPuff(uid)
    if (!F('ko') || !el) return null
    // เฟรมสุดท้ายจบที่ .25 ไม่ใช่ 0 — เพราะสภาพพักของการ์ดที่ตายคือ .dead { opacity:.25 }
    // ถ้าจบที่ 0 การ์ดจะจางหายสนิทแล้ว "เด้งกลับมาโผล่ที่ 25%" ในช่องเดิมทันทีที่ fill:'none' คืนค่า
    el.style.zIndex = '8'                      // static ก่อนเริ่ม เคลียร์ตอนจบ (แพทเทิร์นเดียวกับ lunge) — ไม่งั้นการ์ดกระเด็นลอดใต้การ์ดข้างๆ
    const anim = el.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: 'translate(70px,-60px) rotate(150deg) scale(.6)', opacity: .25 },
    ], { duration: ms, easing: 'ease-in', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => {
      anims.delete(anim); el.style.zIndex = ''; el.style.transform = ''
    })
  }

  // ── โซนอันตราย: วงแหวนเต้นค้างบน FX pool (ห้ามทำบนการ์ด = layer ค้างถาวร ตามข้อบังคับ v3) ──
  function dangerRing(uid, on) {
    if (on) {
      if (dangerOn.has(uid)) return
      const free = pool.danger.find(e => !Array.from(dangerOn.values()).includes(e))
      if (!free) return
      const base = baseXform(uid, 0, 0); if (!base) return
      free.style.transform = base
      free.style.opacity = '1'
      free.getAnimations?.().forEach(a => a.cancel())
      // infinite ได้เพราะเป็น pool element ที่ promote ถาวรอยู่แล้ว + animate แค่ opacity
      const anim = free.animate(
        [{ opacity: .15 }, { opacity: .75 }, { opacity: .15 }],
        { duration: 900, iterations: Infinity, easing: 'ease-in-out' })
      anims.add(anim)          // โดน cancelAll() เก็บกวาดตอน reset/ไฟต์ใหม่
      dangerOn.set(uid, free)
      return
    }
    const el = dangerOn.get(uid)
    if (!el) return
    el.getAnimations?.().forEach(a => a.cancel())
    el.style.opacity = '0'
    dangerOn.delete(uid)
  }
  // ดับวงแหวนอันตรายทุกวง — ใช้ตอน "ไฟต์จบ" (§5.2 ของสเปก: ปิดเมื่อตายหรือจบไฟต์)
  // ตัวที่รอดด้วยเลือด ≤25% ไม่เคยถูกสั่งปิด เพราะ dangerRing(uid,false) เรียกเฉพาะตอนตาย
  // → เดิมวงแหวน iterations:Infinity เต้นค้างยาวผ่านหน้าสรุปและตอน peek สนาม จนกว่าจะ reset()
  function dangerClearAll() { for (const uid of Array.from(dangerOn.keys())) dangerRing(uid, false) }

  function projectile(fromUid, toUid, char, ms) {
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = take('proj')
    el.getAnimations?.().forEach(x => x.cancel()); imgSrc(el, char); el.style.opacity = '1'
    return run(el, [
      { transform: `translate(${a.x}px, ${a.y}px) translateZ(0)` },
      { transform: `translate(${b.x}px, ${b.y}px) translateZ(0)` },
    ], { duration: ms || 280, easing: 'linear', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }
  function dash(fromUid, toUid, char) {        // plan B melee: sprite เพ็ทพุ่งเข้าฟาดแล้ว fade
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = pool.dash[0]
    el.getAnimations?.().forEach(x => x.cancel()); imgSrc(el, char); el.style.opacity = '1'
    return run(el, [
      { transform: `translate(${a.x}px, ${a.y}px) scale(1) translateZ(0)`, opacity: .9 },
      { transform: `translate(${b.x}px, ${b.y}px) scale(1.3) translateZ(0)`, opacity: 1, offset: .7 },
      { transform: `translate(${b.x}px, ${b.y}px) scale(.9) translateZ(0)`, opacity: 0 },
    ], { duration: 250, easing: 'cubic-bezier(.2,.7,.3,1.1)', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }
  // ── passive: อีโมจิลงหลายการ์ด ──
  // pooled ephemeral · transform+opacity เท่านั้น · ไม่แตะการ์ด (ข้อบังคับ v3)
  // ⚠️ ป้ายชื่อสกิลแบบ "ลอยเหนือหัว" ถูกถอดออก 28 ส.ค. — พูล 2 ช่องถูกยึดจนป้ายไปโผล่ผิดการ์ด
  //    ตอนนี้ชื่อสกิลเป็นชิปเกาะบนการ์ดใน BattleReplay.vue (showChip) ซึ่งไม่มีพูลให้แย่งกัน
  /** ยิงอีโมจิเดียวกันลงหลายการ์ดไล่กันทีละ stagger ms (cleave · aoe · คลื่นทีม · ละออง) */
  function sweep(uids, char, stagger = 70) {
    if (!F('burst')) return Promise.resolve()
    const list = (uids || []).slice(0, pool.sweep.length)
    return Promise.all(list.map((uid, i) => {
      const base = baseXform(uid, 0, 0); if (!base) return Promise.resolve()
      const el = take('sweep')
      el.getAnimations?.().forEach(a => a.cancel())
      imgSrc(el, (char && fluentFile(char)) ? char : '✨')
      el.style.opacity = '1'
      return run(el, [
        { transform: base + ' scale(.5)', opacity: 0, offset: 0 },
        { transform: base + ' scale(1.15)', opacity: 1, offset: .35 },
        { transform: base + ' scale(1.3)', opacity: 0, offset: 1 },
      ], { duration: 420, delay: i * stagger, easing: 'ease-out', fill: 'forwards' })
        .then(() => { el.style.opacity = '0' })
    }))
  }

  return {
    attach, reset, cancelAll, setRate, setFlags, setReducedOverride, destroy, centerOf, invalidateCenters,
    sweep,
    pop, callout, koPuff, ring, burst, projectile, dash,
    jab, lunge, squashTarget, targetReacts, shake, ko, dangerRing, dangerClearAll,
  }
}
