// battleFx.js — motion layer ของ BattleReplay (plain JS ไม่พึ่ง Vue)
// doctrine: pool element promote ถาวร reuse · ขับด้วย WAAPI transform/opacity เท่านั้น · promise resolve เสมอ · one-way (Vue→fx)
import { fluentFile } from './emoji.js'
import { fxFlags, REDUCED_FLAGS } from './battleReplayPrefs.js'

const BASE = import.meta.env.BASE_URL

export function createBattleFx() {
  let boxEl = null, layer = null, getEl = () => null, rate = 1
  const anims = new Set()               // active WAAPI (สำหรับ cancelAll)
  let centers = {}, boxRect = null
  let flags = fxFlags(undefined)                    // ค่าเริ่มต้นจาก DEFAULT_PREFS จนกว่า component จะเรียก setFlags
  const reducedMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const reduced = () => !!(reducedMQ && reducedMQ.matches)
  // อ่าน flag ผ่านตัวนี้เสมอ — reduced-motion ทับ preset ที่ user เลือกได้ตลอด
  const F = (k) => (reduced() ? REDUCED_FLAGS[k] : flags[k])
  function setFlags(f) { flags = { ...flags, ...(f || {}) } }

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
    const a = el.animate(keyframes, { duration: opts.duration / rate, easing: opts.easing || 'ease-out', fill: opts.fill || 'none' })
    anims.add(a)
    return a.finished.catch(() => {}).finally(() => anims.delete(a))
  }

  function attach({ boxEl: b, layerEl, getEl: g }) {
    boxEl = b; layer = layerEl; getEl = g
    buildPools()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
  }
  function reset() { invalidateCenters(); cancelAll() }
  function cancelAll() {
    for (const a of anims) a.cancel()          // reject → run() กลืนแล้ว
    anims.clear()
    dangerOn.clear()                           // สถานะค้าง ต้องล้างด้วย ไม่งั้นไฟต์ใหม่จะ reuse element ไม่ได้
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

  const pool = { pop: [], call: [], puff: [], ring: [], burst: [], proj: [], dash: [], jab: [], danger: [] }
  let popIdx = 0, callIdx = 0, puffIdx = 0, jabIdx = 0
  const dangerOn = new Map()      // uid → element ที่กำลังเต้นอยู่

  function buildPools() {
    for (let i = 0; i < 4; i++) pool.pop.push(mkEl('brfx-pop'))
    for (let i = 0; i < 2; i++) pool.call.push(mkEl('brfx-call'))
    for (let i = 0; i < 2; i++) { const e = mkImg('brfx-puff'); imgSrc(e, '💀'); pool.puff.push(e) }
    pool.ring = [mkEl('brfx-ring')]
    pool.burst = [mkImg('brfx-burst'), mkImg('brfx-burst')]
    pool.burst.forEach(e => imgSrc(e, '💥'))
    pool.proj = [mkImg('brfx-proj'), mkImg('brfx-proj')]
    pool.dash = [mkImg('brfx-dash')]
    pool.jab = [mkImg('brfx-jab'), mkImg('brfx-jab')]
    pool.jab.forEach(e => imgSrc(e, '💥'))
    for (let i = 0; i < 8; i++) pool.danger.push(mkEl('brfx-danger'))   // สูงสุด 8 ตัวต่อไฟต์ (4v4)
    hideAllPools()
  }
  function hideAllPools() {
    for (const arr of Object.values(pool)) for (const e of arr) { e.style.opacity = '0'; e.getAnimations?.().forEach(a => a.cancel()) }
  }

  // ── effect methods (pooled ephemeral, imperative fire-and-forget) ──
  const POP_TIER_CLS = { chip: 'tier-chip', solid: 'tier-solid', heavy: 'tier-heavy', finish: 'tier-finish' }
  function pop(uid, { dmg, crit, eff, tier }) {
    const el = pool.pop[popIdx = (popIdx + 1) % pool.pop.length]
    el.getAnimations?.().forEach(a => a.cancel())
    el.textContent = '-' + dmg
    const tierCls = POP_TIER_CLS[tier]
    el.className = 'brfx brfx-pop' + (tierCls ? ' ' + tierCls : '')
      + (crit ? ' crit' : eff === 'super' ? ' super' : eff === 'weak' ? ' weak' : '')
    const dx = Math.round(Math.random() * 28 - 14)
    const base = baseXform(uid, dx, -6); if (!base) return
    el.style.opacity = '1'
    // ชั้นสูงให้เลขอยู่นานกว่า — คงหลักการเดิมว่าไม่หารด้วย rate (อ่านเลขทันเสมอ)
    const ms = tier === 'finish' ? 1100 : tier === 'heavy' ? 900 : tier === 'chip' ? 420 : 620
    const rise = tier === 'finish' ? 26 : tier === 'heavy' ? 30 : tier === 'chip' ? 14 : 22
    const spring = tier !== 'chip'
    const kf = spring ? [
      { transform: base + ' translateY(0) scale(.3)', opacity: 0, offset: 0 },
      { transform: base + ' translateY(-6px) scale(1.35)', opacity: 1, offset: .28 },
      { transform: base + ' translateY(-12px) scale(1)', opacity: 1, offset: .45 },
      { transform: base + ` translateY(-${rise}px) scale(1)`, opacity: 0, offset: 1 },
    ] : [
      { transform: base + ' translateY(0)', opacity: 0, offset: 0 },
      { transform: base + ' translateY(-4px)', opacity: 1, offset: .2 },
      { transform: base + ` translateY(-${rise}px)`, opacity: 0, offset: 1 },
    ]
    const a = el.animate(kf, { duration: ms, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { if (el.textContent === '-' + dmg) el.style.opacity = '0' })
  }

  function callout(uid, kind) {              // kind: 'super' | 'weak' | 'survive'
    const el = pool.call[callIdx = (callIdx + 1) % pool.call.length]
    el.getAnimations?.().forEach(a => a.cancel())
    el.className = 'brfx brfx-call ' + kind
    el.textContent = kind === 'super' ? 'แพ้ทาง! ⚡' : kind === 'survive' ? 'รอด!' : 'ต้านทาน 🛡️'
    const base = baseXform(uid, 0, -16); if (!base) return
    el.style.opacity = '1'
    const a = el.animate([
      { transform: base + ' translateY(0)', opacity: 1 },
      { transform: base + ' translateY(-24px)', opacity: 0 },
    ], { duration: 750, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { el.style.opacity = '0' })
  }

  function koPuff(uid) {
    const el = pool.puff[puffIdx = (puffIdx + 1) % pool.puff.length]
    el.getAnimations?.().forEach(a => a.cancel())
    const base = baseXform(uid, 0, 0); if (!base) return
    el.style.opacity = '1'
    const a = el.animate([
      { transform: base + ' translateY(0) scale(.6)', opacity: 1 },
      { transform: base + ' translateY(-16px) scale(1.25)', opacity: 0 },
    ], { duration: 500, easing: 'ease-out', fill: 'forwards' })
    a.finished.catch(() => {}).then(() => { el.style.opacity = '0' })
  }

  let burstIdx = 0
  function ring(uid, phase, ms) {
    const el = pool.ring[0]
    el.getAnimations?.().forEach(a => a.cancel())
    el.className = 'brfx brfx-ring ' + phase
    const base = baseXform(uid, 0, 0); if (!base) return Promise.resolve()
    el.style.transform = base
    return run(el, [
      { transform: base + ' scale(.85)', opacity: 0 },
      { transform: base + ' scale(1.05)', opacity: 1, offset: .4 },
      { transform: base + ' scale(1)', opacity: phase === 'windup' ? .9 : 1 },
    ], { duration: ms || (phase === 'windup' ? 250 : 120), easing: 'ease-out', fill: 'forwards' })
      .then(() => { if (phase === 'acting') { el.style.opacity = '0' } })
  }
  function burst(uid, size) {
    if (!F('burst')) return Promise.resolve()
    const el = pool.burst[burstIdx = (burstIdx + 1) % pool.burst.length]
    el.getAnimations?.().forEach(a => a.cancel())
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
    const el = pool.jab[jabIdx = (jabIdx + 1) % pool.jab.length]
    el.getAnimations?.().forEach(x => x.cancel())
    el.style.opacity = '1'
    // reduced-motion: ไม่วิ่งข้ามจอ แค่กะพริบที่เป้า (ยังบอกได้ว่าหมัดลงตรงไหน)
    const sx = reduced() ? b.x : a.x, sy = reduced() ? b.y : a.y
    const mx = b.x - (b.x - a.x) * 0.3, my = b.y - (b.y - a.y) * 0.3   // หยุดที่ 70% ของทาง
    const ex = reduced() ? b.x : mx, ey = reduced() ? b.y : my
    return run(el, [
      { transform: `translate(${sx}px, ${sy}px) scale(.3) translateZ(0)`, opacity: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.85) translateZ(0)`, opacity: 1, offset: .7 },
      { transform: `translate(${ex}px, ${ey}px) scale(.6) translateZ(0)`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out', fill: 'forwards' }).then(() => { el.style.opacity = '0' })
  }

  // ── การ์ดพุ่ง: 1 animation ครอบ windup+motion+hitstop+tail ทั้งก้อน (ข้อบังคับ v3 — 1 promotion/หมัด) ──
  // ท่าต่อชั้น: pull = ถอยหลังกี่ px · psx/psy = สเกลตอนย่อ · sx/sy = สเกลตอนพุ่งถึง (ยืดตามทิศ)
  const LUNGE_POSE = {
    solid:  { pull: 14, psx: 1.06, psy: 0.90, sx: 0.90, sy: 1.18 },
    heavy:  { pull: 24, psx: 1.12, psy: 0.94, sx: 0.82, sy: 1.30 },
    finish: { pull: 28, psx: 1.16, psy: 0.92, sx: 0.80, sy: 1.34 },
  }
  function lunge(el, fromUid, toUid, timing, tier) {
    if (!F('cardLunge') || !el) return Promise.resolve()
    const P = LUNGE_POSE[tier]; if (!P) return Promise.resolve()      // chip ไม่มีท่า = ไม่พุ่ง
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const total = timing.windup + timing.motion + timing.hitstop + timing.tail
    if (total <= 0) return Promise.resolve()
    const dx = (b.x - a.x).toFixed(1), dy = (b.y - a.y).toFixed(1)
    const o1 = timing.windup / total
    const o2 = (timing.windup + timing.motion) / total
    const o3 = (timing.windup + timing.motion + timing.hitstop) / total
    const hit = `translate(${dx}px, ${dy}px) scale(${P.sx}, ${P.sy})`
    // เฟรม o2→o3 ซ้ำท่าเดิม = การ์ดหยุดนิ่งช่วง hitstop โดยไม่ต้องแตกเป็น animation ที่สอง
    const kf = [
      { transform: 'translate(0,0) scale(1)', offset: 0 },
      { transform: `translate(0, ${P.pull}px) scale(${P.psx}, ${P.psy})`, offset: o1 },
      { transform: hit, offset: o2 },
      { transform: hit, offset: o3 },
      { transform: 'translate(0,0) scale(1)', offset: 1 },
    ]
    el.style.zIndex = '7'                        // static ก่อนเริ่ม ไม่อยู่ใน keyframes (ข้อบังคับ v3)
    const anim = el.animate(kf, { duration: total, easing: 'ease-in-out', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => {
      anims.delete(anim); el.style.zIndex = ''; el.style.transform = ''
    })
  }

  // ── เป้าบีบตัวแล้วดีดกลับ — ชั้น heavy/finish เท่านั้น (preset high) ──
  function squashTarget(el, tier, ms = 400) {
    if (!F('targetSquash') || !el) return Promise.resolve()
    const amt = tier === 'finish' ? 0.5 : 0.36
    const anim = el.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${(1 + amt * 0.5).toFixed(3)}, ${(1 - amt).toFixed(3)})`, offset: .3 },
      { transform: `scale(${(1 - amt * 0.3).toFixed(3)}, ${(1 + amt * 0.4).toFixed(3)})`, offset: .6 },
      { transform: 'scale(1)' },
    ], { duration: ms, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); el.style.transform = '' })
  }

  // ── จอสั่น — ของแพงที่สุดในไฟล์นี้ (transform ทั้ง .br-box = re-raster เต็มจอ) ──
  // เปิดเฉพาะ preset high และเรียกได้เฉพาะชั้น heavy/finish เท่านั้น (§6.2 ของสเปก)
  function shake(px, times, rot = false) {
    if (!F('screenShake') || !boxEl) return Promise.resolve()
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
  function ko(uid, el, ms = 520) {
    koPuff(uid)
    if (!F('ko') || !el) return Promise.resolve()
    const anim = el.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: 'translate(70px,-60px) rotate(150deg) scale(.6)', opacity: 0 },
    ], { duration: ms, easing: 'ease-in', fill: 'none' })
    anims.add(anim)
    return anim.finished.catch(() => {}).finally(() => { anims.delete(anim); el.style.transform = '' })
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

  let projIdx = 0
  function projectile(fromUid, toUid, char, ms) {
    const a = centerOf(fromUid), b = centerOf(toUid); if (!a || !b) return Promise.resolve()
    const el = pool.proj[projIdx = (projIdx + 1) % pool.proj.length]
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
  return {
    attach, reset, cancelAll, setRate, setFlags, destroy, centerOf, invalidateCenters,
    pop, callout, koPuff, ring, burst, projectile, dash,
    jab, lunge, squashTarget, shake, ko, dangerRing,
  }
}
