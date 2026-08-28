<!--
  TowerPath — เส้นทางไต่หอคอย 100 ชั้น เรียงเป็นคอลัมน์เดียวไต่ตรงขึ้นไปบนโครงหอคอย
  รับ props ล้วน ไม่รู้จัก store ใดๆ (เทสง่าย + ตอนทำ P3 passive ไม่ต้องแตะไฟล์นี้)

  perf doctrine (จากบทเรียน BattleReplay ที่เคยกระตุกบน iOS):
    • เรนเดอร์ครบ 100 แถวเป็น DOM จริง แล้วพึ่ง content-visibility:auto ให้เบราว์เซอร์
      ข้าม layout+paint ของแถวนอกจอเอง — ไม่ virtualize เพราะต้องผูก scroll listener
      ซึ่งบน iOS momentum scroll เสี่ยงเรนเดอร์ไม่ทันเป็นช่องว่างขาว
    • ทุกแถวสูง ROW_H เท่ากันเป๊ะ → contain-intrinsic-size ตรงจริง = ไม่มี scrollbar กระตุก
    • ห้ามผูก scroll event · IntersectionObserver ใช้ได้ (ไม่ยิงตอน scroll)

  เดิมเป็นซิกแซกซ้าย-ขวา · เปลี่ยนเป็นคอลัมน์เดียว 23 ส.ค. — ทำให้ทริกที่เปราะสองอันหายไป:
    • เส้นเชื่อมเคยเป็นเส้นทแยงที่วาดด้วย linear-gradient มุมเอียง แล้วต้องแบ่งครึ่งบน/ล่าง
      คนละ pseudo-element เพราะ contain:paint คลิปของที่ล้นขอบแถว → ตอนนี้เป็นเส้นตรง
      (ยังแบ่งสองครึ่งอยู่ เพราะสองครึ่งคนละช่วงการเดินทาง = คนละสี ดู lineStyle)
    • marker เคยต้องวัดความกว้างกล่องด้วย ResizeObserver เพื่อหาแกน X (ระยะขอบเป็น %)
      → ตอนนี้ X คงที่จาก 50% จัดด้วย CSS ล้วน transform เหลือถือแค่ Y
-->

<template>
  <div class="tp">
    <div class="tp-head">
      <span>
        <span class="tp-floor">ชั้น {{ floor }}</span><span class="tp-of"> / {{ max }}</span>
      </span>
      <span class="tp-head-r">
        <span class="tp-best">สูงสุด {{ best }}</span>
        <button v-if="offscreen" class="tp-recenter" @click="centerOnCurrent(true)">
          ↓ ไปชั้นฉัน
        </button>
      </span>
    </div>

    <div ref="boxEl" class="tp-box" @click.capture="onBoxClick">
      <div class="tp-inner" role="list"
           :aria-label="`เส้นทางหอคอย ${max} ชั้น ตอนนี้อยู่ชั้น ${floor}`">
        <div v-for="n in rows" :key="n" class="tp-row" :class="rowClass(n)"
             :style="lineStyle(n)" role="listitem">
          <button class="tp-node" :class="{ milestone: isMilestone(n) }"
                  :style="nodeStyle(n)"
                  :aria-label="labelOf(n)"
                  :aria-current="n === floor ? 'step' : null"
                  :data-current="n === floor ? '' : null"
                  @click="$emit('pick', n)">
            <span v-if="isMilestone(n)" class="tp-coin"><Emoji char="🪙" /></span>
            <span class="tp-ico"><Emoji :char="iconOf(n)" /></span>
            <span class="tp-n">{{ n }}</span>
          </button>
          <button v-if="crowdOf(n)" class="tp-rail"
                  :aria-label="`เพื่อน ${crowdOf(n).all.length} คนอยู่ชั้น ${n}`"
                  @click="$emit('pick', n)">
            <img v-for="f in crowdOf(n).shown" :key="f.uid" class="tp-face"
                 :src="f.photo || letterAvatar(f.name, 52)" :alt="''"
                 width="26" height="26" loading="lazy" decoding="async"
                 @error="fallbackAvatar($event, f.name, 52)" />
            <span v-if="crowdOf(n).extra" class="tp-more">+{{ crowdOf(n).extra }}</span>
          </button>
        </div>

        <!-- marker ผู้เล่น: absolute นอกแถว → ไม่โดน paint containment ของแถวคลิป
             X คงที่จาก 50% จัดด้วย CSS · transform ถือแค่ Y ที่ต้องอนิเมต -->
        <div class="tp-marker" :class="{ climbing, snap }" :style="markerStyle" aria-hidden="true">
          <span class="tp-marker-in"><Emoji char="🧗" /></span>
        </div>

        <div v-if="burstFloor" class="tp-burst"
             :style="{ transform: `translate3d(0, ${(max - burstFloor) * ROW_H}px, 0)` }"
             aria-hidden="true">
          <span class="tp-ring"></span>
          <span class="tp-gain">+{{ burstBonus.toLocaleString() }}/วัน</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Emoji from '../shared/Emoji.vue'
import { floorZone, TOWER_BONUS_FLOORS, getTowerBonus } from '../../data/towerFloors.js'
import { letterAvatar, fallbackAvatar } from '../../utils/avatar.js'
import { prefersReducedMotion } from '../../utils/motionPref.js'

const ROW_H  = 60
const MARKER = 30

const props = defineProps({
  floor: { type: Number, required: true },
  best:  { type: Number, required: true },
  max:   { type: Number, required: true },
  crowd: { type: Map, default: () => new Map() },   // ใช้จริงใน Task 3
})
defineEmits(['pick'])

const boxEl = ref(null)

// ชั้นสูงอยู่บน → ไล่ลงมาชั้น 1
const rows = computed(() => Array.from({ length: props.max }, (_, i) => props.max - i))

const isMilestone = (n) => TOWER_BONUS_FLOORS.includes(n)
const zoneColor   = (n) => floorZone(n).color

// เส้นชั้นที่ยังไม่ผ่าน — ink โปร่งแทนเทา #e2e8f0 เดิม
// เทาเย็นถูกเลือกไว้ตอนพื้นหลังเป็น --bg เรียบ พอพื้นเป็นไล่เฉดสีโซน+โครงหอคอย มันจมหาย
// การ "ทำให้เข้มลง" ทำงานได้ทุกแถบสี ต่างจากการ "ทาสีเทาทับ"
const LOCK_LINE = 'rgba(36, 27, 51, .16)'

function rowClass(n) {
  return [
    n <= props.best ? 'done' : n === props.floor ? 'now' : 'lock',
    {
      first: n === props.max, last: n === 1,          // ← คงไว้ ห้ามทำหาย (ดู Task 2)
      pop: n === popFloor.value, fill: n === fillFloor.value,
      fillUp: fillFloor.value > 0 && n === fillFloor.value + 1,
    },
  ]
}

// พื้นโหนดที่ผ่านแล้ว = สีโซนผสมขาว 25% แบบ**ทึบ**
// เดิมเป็น alpha (สีโซน + '40') ซึ่งคงที่เพราะพื้นหลังเรียบสีเดียว
// พอพื้นหลังเป็นไล่เฉด สีที่มองเห็นจะเพี้ยนไปทีละชั้นตามฉากหลัง + คอนทราสต์ตัวเลขตก
const tint = (hex) => '#' + [1, 3, 5]
  .map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * .25 + 191.25).toString(16).padStart(2, '0'))
  .join('')

function nodeStyle(n) {
  return n <= props.best ? { background: tint(zoneColor(n)) } : null
}

// สีเส้นเชื่อม 2 ครึ่ง แยกกันเพราะคนละช่วงการเดินทาง:
//   ครึ่งบน (::before) = ช่วง n ↔ n+1 → ผ่านแล้วเมื่อพิชิตชั้น n สำเร็จ    → n <= best
//   ครึ่งล่าง (::after) = ช่วง n ↔ n-1 → ผ่านแล้วเมื่อพิชิตชั้น n-1 สำเร็จ → n <= best + 1
function lineStyle(n) {
  return {
    '--tp-up': n <= props.best     ? zoneColor(n) : LOCK_LINE,
    '--tp-dn': n <= props.best + 1 ? zoneColor(n) : LOCK_LINE,
  }
}

const iconOf = (n) => (n <= props.best ? '✅' : n === props.floor ? '⚔️' : '🔒')

function labelOf(n) {
  const state = n <= props.best ? 'ผ่านแล้ว' : n === props.floor ? 'กำลังท้าทาย' : 'ยังไม่ปลดล็อก'
  const c = props.crowd?.get(n)
  return `ชั้น ${n} ${state}` + (c ? ` เพื่อน ${c.all.length} คนอยู่ชั้นนี้` : '')
}
const crowdOf = (n) => props.crowd?.get(n) || null

// ── marker ──────────────────────────────────────────────
// Y = แถวของชั้นนั้น + จัดกึ่งกลางแนวตั้งในแถว
// X ไม่อยู่ที่นี่แล้ว — คอลัมน์เดียวทำให้มันคงที่ จัดด้วย CSS `left: calc(50% - …)`
// transform จึงถือแค่ Y ซึ่งเป็นค่าเดียวที่ต้องอนิเมตตอนไต่
const markerStyle = computed(() => ({
  transform: `translate3d(0, ${(props.max - props.floor) * ROW_H + (ROW_H - MARKER) / 2}px, 0)`,
}))

// ── scroll ให้ชั้นปัจจุบันอยู่กลางกล่อง ──────────────────
// คำนวณตรงจากสูตร ไม่ใช้ scrollIntoView → ตั้งได้ก่อนเฟรมแรก ไม่มีอาการวาบจากชั้นบนสุด
function reduceMotion() {
  return prefersReducedMotion()
}
function centerOnCurrent(smooth = false) {
  const box = boxEl.value
  if (!box) return
  const y = (props.max - props.floor) * ROW_H - box.clientHeight / 2 + ROW_H / 2
  box.scrollTo({
    top: Math.max(0, y),
    behavior: smooth && !reduceMotion() ? 'smooth' : 'auto',
  })
}

// ── ปุ่ม "ไปชั้นฉัน" — โผล่เมื่อชั้นปัจจุบันหลุดจอ ────────
// ⚠️ โหนดปัจจุบันเปลี่ยน element เมื่อ floor เปลี่ยน → ต้อง re-observe ทุกครั้ง
//    (บั๊กแบบเดียวกับ FX re-attach ใน BattleReplay ที่เคยทำเอฟเฟกต์หายตั้งแต่ไฟต์ที่ 2)
const offscreen = ref(false)
let io = null
function attachObserver() {
  io?.disconnect()
  io = null
  offscreen.value = false
  const box = boxEl.value
  if (!box || typeof IntersectionObserver === 'undefined') return
  const el = box.querySelector('[data-current]')
  if (!el) return
  io = new IntersectionObserver(
    ([e]) => { offscreen.value = !e.isIntersecting },
    { root: box, threshold: 0.5 },
  )
  io.observe(el)
}

onMounted(() => {
  centerOnCurrent(false)
  attachObserver()
})
onBeforeUnmount(() => { io?.disconnect() })

// ── ซีเควนซ์ไต่ขึ้นหนึ่งขั้น ─────────────────────────────
// ขับด้วยการที่ prop floor เพิ่มขึ้น (TowerView หน่วงไว้จนปิด BattleReplay แล้วค่อยปล่อย)
const climbing  = ref(false)
const popFloor  = ref(0)     // ชั้นที่เพิ่งผ่าน — เด้งตอนพลิกเป็น ✅
const fillFloor = ref(0)     // ชั้นที่เส้นเชื่อมกำลังไล่สี
const snap      = ref(false) // ตัด transition หนึ่งเฟรมตอนสั่งข้ามอนิเมชัน

// วงแหวนปลดล็อกหมุดโบนัส — element ชั่วคราว สร้างตอนเล่นแล้วลบทิ้ง ไม่ค้างใน DOM
const burstFloor = ref(0)
const burstBonus = computed(() => getTowerBonus(burstFloor.value))

let timers = []
const at = (ms, fn) => timers.push(setTimeout(fn, ms))
function clearTimers() { timers.forEach(clearTimeout); timers = [] }

function endClimb() {
  clearTimers()
  if (climbing.value) {           // ← คงไว้จาก Task 5 fix ห้ามทำหาย (แตะ = ข้ามทันที)
    // ปิด transition หนึ่งเฟรมให้ marker กระโดดไปตำแหน่งปลายทางทันที ไม่ไถลต่ออีก .84s
    // ต้อง rAF ซ้อนสองชั้น: ชั้นแรกรอให้ DOM patch ของ Vue (microtask) ลงและเบราว์เซอร์
    // คำนวณสไตล์ใหม่โดยไม่มี transition · ชั้นสองคือเฟรมถัดไปที่ปลอดภัยจะคืน transition
    snap.value = true
    requestAnimationFrame(() => requestAnimationFrame(() => { snap.value = false }))
  }
  climbing.value   = false
  popFloor.value   = 0
  fillFloor.value  = 0
  burstFloor.value = 0
}

function runClimb(from) {
  clearTimers()
  if (reduceMotion()) { endClimb(); centerOnCurrent(false); return }
  climbing.value = true
  // ⚠️ ต้องตั้งพร้อม climbing ในแพตช์เดียวกัน ห้ามหน่วงด้วย setTimeout
  //    สีเส้น (--tp-up) เปลี่ยนตั้งแต่ t=0 เพราะผูกกับ best ที่ปล่อยพร้อมกัน
  //    ถ้า clip มาทีหลัง จะเห็นสีเต็มก่อนแล้วโดนลบทิ้งค่อยไล่ใหม่ = ดูเหมือนจอกระตุก
  //    การหน่วง 300ms ย้ายไปเป็น animation-delay ใน CSS แทน
  fillFloor.value = from          // ← คงไว้จาก Task 5 fix: ต้องอยู่แพตช์เดียวกับ climbing
  burstFloor.value = 0            // กันค่าค้างจากรอบก่อนถ้าไต่รอบใหม่ก่อน endClimb เดิมยิง
  centerOnCurrent(true)
  at(260,  () => { popFloor.value = from })
  if (isMilestone(from)) at(860, () => { burstFloor.value = from })
  at(1900, endClimb)          // ยืดจาก 1200 ให้วงแหวน (700ms ที่ t=860) เล่นจบก่อนถูกล้าง
}

watch(() => props.floor, (nf, of) => {
  nextTick(attachObserver)
  if (nf > of) runClimb(of)      // ไต่ขึ้นเท่านั้น — แพ้/รีเซตไม่อนิเมต
  else endClimb()
})

// แตะตรงไหนระหว่างไต่ = ข้ามไปสถานะปลายทางทันที (คนที่ตีรัวๆ ไม่ต้องรอ)
function onBoxClick(e) {
  if (!climbing.value) return
  e.stopPropagation()
  e.preventDefault()
  endClimb()
}

onBeforeUnmount(clearTimers)
</script>

<style scoped>
.tp {
  background: #fff; border: 2px solid var(--ink); border-radius: 16px;
  box-shadow: var(--pop); margin-bottom: 12px; overflow: hidden;
}

.tp-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 9px 12px; border-bottom: 2px solid var(--ink); background: #fff;
}
.tp-floor { font-weight: 800; font-size: .9rem; color: var(--ink); }
.tp-of    { font-weight: 700; font-size: .78rem; color: var(--muted); }
.tp-head-r { display: flex; align-items: center; gap: 8px; }
.tp-best  { font-size: .72rem; font-weight: 700; color: var(--muted); }
.tp-recenter {
  border: 1.5px solid var(--ink); background: var(--gold); border-radius: 999px;
  padding: 4px 9px; font-family: inherit; font-size: .72rem; font-weight: 800;
  color: var(--ink); cursor: pointer; white-space: nowrap;
}
.tp-recenter:active { transform: translate(1px, 1px); }

.tp-box {
  height: clamp(300px, 45vh, 440px);
  overflow-y: auto;
  overscroll-behavior: contain;   /* กันเลื่อนทะลุไปดันหน้าหลัก */
  background: var(--bg);
}

/* ── ฉากหลัง: โครงหอคอย + ไล่เฉดสีโซน ───────────────────
   วางบน .tp-inner (สูง 6,000px) ไม่ใช่ .tp-box — พื้นหลังของ scroll container
   ไม่เลื่อนตามเนื้อหา จะได้ฉากนิ่งแทนความรู้สึกว่ากำลังไต่

   ชั้นบน = โครงหอคอย SVG ไทล์ซ้ำแนวตั้ง สูง 120px = 2 แถวพอดี
            → แนวหินตรงกับเส้นแบ่งชั้นเสมอ ไม่ว่าเลื่อนไปอยู่ตรงไหน
            background-size 100% = ยืดเต็มความกว้างกล่องทุกขนาดจอ
   ชั้นล่าง = ไล่เฉดจากสีโซนทั้ง 5 (จุดหยุดตรงกับ ZONES ใน data/towerFloors.js)
            → หอคอยรับสีของโซนที่กำลังไต่ และแถบโซนกลายเป็นบรรยากาศในตัวเอง
   แถวไม่มีพื้นหลังของตัวเอง สีจาก parent จึงทะลุขึ้นมาได้ ไม่ชน contain:paint */
.tp-inner {
  position: relative;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='390' height='120' viewBox='0 0 390 120' preserveAspectRatio='none'%3E%3Cg stroke='%23241b33' fill='none' stroke-width='2'%3E%3Cpath d='M58 0v120M332 0v120' stroke-opacity='.17'/%3E%3Cpath d='M100 0v120M290 0v120' stroke-opacity='.07'/%3E%3Cpath d='M58 59h274M58 119h274' stroke-opacity='.12'/%3E%3Cpath d='M58 29h274M58 89h274' stroke-opacity='.05'/%3E%3Cpath d='M79 0v29M121 29v30M79 59v30M121 89v30M269 0v29M311 29v30M269 59v30M311 89v30' stroke-opacity='.05'/%3E%3C/g%3E%3Cg fill='%23241b33' fill-opacity='.07'%3E%3Cpath d='M70 36V20a9 9 0 0 1 18 0v16z'/%3E%3Cpath d='M302 96V80a9 9 0 0 1 18 0v16z'/%3E%3C/g%3E%3C/svg%3E")
      repeat-y center top / 100% 120px,
    linear-gradient(to top,
      #eef7dd 0%,  #eef7dd 17%,   /* 1–20   ลานประลอง */
      #e4f0fe 23%, #e4f0fe 37%,   /* 21–40  หอเวทเก่า */
      #f0e6fe 43%, #f0e6fe 52%,   /* 41–55  ปราการอสูร */
      #fdf2dc 58%, #fdf2dc 66%,   /* 56–69  ยอดหอคอยมังกร */
      #d9cfea 72%, #cbbfe2 100%); /* 70–100 บัลลังก์ราชันย์ */
}

/* ── แถว ────────────────────────────────────────────────
   content-visibility: auto → ข้าม layout+paint ของแถวนอกจอ
   ⚠️ มันบังคับ contain:paint ด้วย = คลิปทุกอย่างที่ล้นขอบแถว
      เส้นเชื่อมจึงต้องแบ่งครึ่งบน/ครึ่งล่างให้อยู่ในกรอบตัวเอง ห้ามวาดคร่อมสองแถว */
.tp-row {
  position: relative;
  height: 60px;
  display: flex; align-items: center; justify-content: center;
  content-visibility: auto;
  contain-intrinsic-size: auto 60px;
}

/* ── เส้นเชื่อมแนวตั้ง ───────────────────────────────────
   ยังแบ่งสองครึ่งอยู่ ไม่ใช่เพราะเรขาคณิต แต่เพราะสองครึ่งเป็นคนละช่วงการเดินทาง
   จึงเปลี่ยนสีคนละจังหวะ (ดู lineStyle) — และ contain:paint ก็บังคับอยู่แล้ว */
.tp-row::before, .tp-row::after {
  content: ''; position: absolute; pointer-events: none;
  left: 50%; width: 4px; margin-left: -2px;
}
.tp-row::before { top: 0;   height: 50%; background: var(--tp-up); }
.tp-row::after  { top: 50%; height: 50%; background: var(--tp-dn); }

/* แถวบนสุดไม่มีชั้นเหนือขึ้นไป · แถวล่างสุดไม่มีชั้นใต้ลงมา
   ใช้คลาสไม่ใช้ :first-child/:last-child — .tp-inner มี .tp-marker เป็นลูกตัวสุดท้ายด้วย
   ทำให้ :last-child ไม่เคย match แถวไหนเลย (เส้นชั้น 1 ห้อยลงไปในที่ว่าง) */
.tp-row.first::before { display: none; }
.tp-row.last::after   { display: none; }

/* ── โหนด ───────────────────────────────────────────────
   ขนาดคงที่ทุกสถานะ → เปลี่ยนสถานะไม่ทำให้เกิด layout shift */
/* ขอบขาว 4px รอบโหนด = ตัดโหนดออกจากฉากหลังที่มีทั้งสีและลวดลาย
   (เงาแข็งเดิม --pop อย่างเดียวไม่พอ พอพื้นไม่ใช่สีเรียบ ขอบ ink จะกลืนกับเส้นหอคอย)
   สองชั้น: halo ขาวก่อน แล้วเงาแข็งเหลื่อม 3px รอบ halo อีกที */
.tp-node {
  position: relative; z-index: 1;
  width: 108px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  border: 2px solid var(--ink); border-radius: 12px;
  background: #fff; box-shadow: 0 0 0 4px #fff, 3px 3px 0 4px var(--ink);
  font-family: inherit; cursor: pointer;
}
.tp-node:active { transform: translate(2px, 2px); box-shadow: 0 0 0 4px #fff; }
.tp-ico { font-size: 1rem; line-height: 1; }
.tp-n   { font-size: .78rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }

.tp-row.lock .tp-node { opacity: .6; }
.tp-row.now  .tp-node { background: var(--gold); border-width: 3px; }
.tp-row.now .tp-node:active { box-shadow: 0 0 0 4px #fff; }
.tp-node.milestone { outline: 2px dashed var(--gold); outline-offset: 2px; }
.tp-coin { position: absolute; top: -8px; right: -6px; font-size: .72rem; line-height: 1; }

/* ── รางเพื่อน ──────────────────────────────────────────
   ขวาโหนดตายตัว (54px = ครึ่งโหนด + 8px ระยะห่าง) — ตาไม่ต้องไล่หาสลับฝั่งแบบตอนซิกแซก
   รางทั้งรางเป็นปุ่มเดียว emit('pick', n) ตัวเดียวกับโหนด — เปิดแผงเดียวกัน
   overflow ของ .tp เป็น hidden อยู่แล้ว: ถ้ามีเพื่อนเยอะจนล้น จะโดนตัดที่ขอบการ์ด
   ไม่ดันความกว้าง (shown สูงสุด 3 + ป้าย +N = ~94px พอดีในจอ 360px) */
.tp-rail {
  position: absolute; top: 50%; left: calc(50% + 62px);
  transform: translateY(-50%);
  display: flex; align-items: center;
  border: none; background: none; padding: 2px; cursor: pointer;
}
.tp-rail:active { transform: translateY(-50%) scale(.94); }

.tp-face {
  width: 26px; height: 26px; flex-shrink: 0;
  border-radius: 999px; border: 2px solid #fff; background: #cbd5e1;
  object-fit: cover; display: block;
}
.tp-face + .tp-face { margin-left: -9px; }
.tp-more {
  margin-left: 4px; padding: 1px 6px; border-radius: 999px;
  background: var(--ink); color: #fff; box-shadow: 0 0 0 2px #fff;
  font-size: .72rem; font-weight: 800; line-height: 1.5;
}

/* ── marker ผู้เล่น ─────────────────────────────────────
   absolute ที่ .tp-inner → ไม่โดน paint containment ของแถว
   X คงที่: 90px = ครึ่งโหนด 54 + ระยะห่าง 6 + ความกว้าง marker 30 → ชิดซ้ายโหนดพอดี
   transform เหลือถือแค่ Y = ค่าเดียวที่ต้องอนิเมตตอนไต่ */
.tp-marker {
  position: absolute; top: 0; left: calc(50% - 90px);
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.tp-marker-in {
  font-size: 1.35rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 999px; background: var(--gold); border: 2px solid var(--ink);
}

/* ── อนิเมชันไต่ขึ้น ────────────────────────────────────
   ทั้งหมดเป็น transform/opacity ยกเว้น clip-path จุดเดียว (กล่อง ~130x30px ทีละอัน)
   ห้ามเผลอใส่ box-shadow/filter/background เข้าไปใน keyframe เหล่านี้ */

/* โหนดที่เพิ่งผ่านเด้งตอนพลิกเป็น ✅ */
.tp-row.pop .tp-node { animation: tp-pop .34s cubic-bezier(.34, 1.5, .64, 1); }
@keyframes tp-pop {
  40%  { transform: scale(1.16); }
  100% { transform: scale(1); }
}

/* เส้นเชื่อมช่วงที่เพิ่งผ่านไล่สีจากล่างขึ้นบน
   ⚠️ เส้นหนึ่งเส้นถูกวาดด้วย pseudo สองตัวคนละแถว (paint containment ตัดของที่ล้นขอบแถว)
      ครึ่งล่าง = ::before ของแถว from · ครึ่งบน = ::after ของแถว from+1
      ต้องอนิเมตทั้งคู่และไล่ต่อกัน ไม่งั้นครึ่งบนจะเด้งเป็นสีเต็มตั้งแต่ t=0
   หน่วงอยู่ที่นี่ ไม่ใช่ setTimeout + `backwards` ค้าง clip ไว้ตลอดช่วงหน่วง */
.tp-row.fill::before   { animation: tp-fill .25s ease-out .3s  backwards; }
.tp-row.fillUp::after  { animation: tp-fill .25s ease-out .55s backwards; }
@keyframes tp-fill {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* marker: transform ถือแค่ Y แล้ว (X เป็น CSS คงที่) — ไม่มีการวาร์บแนวนอนให้กังวลอีก
   หน่วง .34s ให้เกิดหลังโหนดเด้งกับเส้นไล่สี ตามลำดับในสเปก
   ⚠️ transition ต้องอยู่บน .tp-marker เฉยๆ **ห้ามใส่ไว้ใต้ .climbing**
      เพราะคลาส climbing กับค่า transform ใหม่ลงพร้อมกันในเฟรมเดียว —
      transition ที่เพิ่งถูกเพิ่มในเฟรมเดียวกับที่ค่าเปลี่ยน เบราว์เซอร์จะไม่อนิเมตให้
      (ต่างจาก @keyframes ที่ทริกเกอร์ได้ทันทีตอนคลาสถูกเพิ่ม) */
.tp-marker { transition: transform .5s cubic-bezier(.34, 1.3, .64, 1) .34s; }
.tp-marker.snap { transition: none; }
.tp-marker.climbing .tp-marker-in { animation: tp-hop .5s cubic-bezier(.4, 0, .4, 1) .34s; }
@keyframes tp-hop {
  50%  { transform: translateY(-12px); }
  100% { transform: translateY(0); }
}
/* จอง compositor layer เฉพาะช่วงกำลังไต่ — ใส่ค้างไว้ = กินแรมตลอดเวลา */
.tp-marker.climbing, .tp-marker.climbing .tp-marker-in { will-change: transform; }

/* ── วงแหวนปลดล็อกหมุดโบนัส ────────────────────────────
   วางทับแถวของหมุดนั้น จัดกึ่งกลางตรงกับโหนด · pointer-events:none ไม่ขวางการกด
   ป้าย +N/วัน ลอยขึ้นเหนือโหนด (keyframe tp-gain เลื่อนขึ้นอยู่แล้ว) — บังเลขชั้น
   ชั่วครู่ ~900ms ซึ่งรับได้ เพราะเป็นจังหวะฉลองที่คนกำลังมองอยู่พอดี
   ห้าม animate box-shadow/filter ที่นี่ — วงแหวนใช้ border + transform/opacity เท่านั้น */
.tp-burst {
  position: absolute; top: 0; left: 0; right: 0; height: 60px;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 2;
}

.tp-ring {
  position: absolute; width: 48px; height: 48px; border-radius: 999px;
  border: 3px solid var(--gold);
  animation: tp-ring .7s ease-out forwards;
}
@keyframes tp-ring {
  from { transform: scale(.4); opacity: 1; }
  to   { transform: scale(2.2); opacity: 0; }
}

.tp-gain {
  position: relative;
  padding: 3px 9px; border-radius: 999px;
  background: var(--gold); border: 2px solid var(--ink);
  font-size: .74rem; font-weight: 800; color: var(--ink); white-space: nowrap;
  animation: tp-gain .9s ease-out forwards;
}
@keyframes tp-gain {
  from { transform: translateY(6px); opacity: 0; }
  35%  { transform: translateY(-6px); opacity: 1; }
  to   { transform: translateY(-20px); opacity: 0; }
}

</style>
