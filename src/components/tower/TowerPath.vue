<!--
  TowerPath — เส้นทางไต่หอคอยแนวตั้งซิกแซก 100 ชั้น
  รับ props ล้วน ไม่รู้จัก store ใดๆ (เทสง่าย + ตอนทำ P3 passive ไม่ต้องแตะไฟล์นี้)

  perf doctrine (จากบทเรียน BattleReplay ที่เคยกระตุกบน iOS):
    • เรนเดอร์ครบ 100 แถวเป็น DOM จริง แล้วพึ่ง content-visibility:auto ให้เบราว์เซอร์
      ข้าม layout+paint ของแถวนอกจอเอง — ไม่ virtualize เพราะต้องผูก scroll listener
      ซึ่งบน iOS momentum scroll เสี่ยงเรนเดอร์ไม่ทันเป็นช่องว่างขาว
    • ทุกแถวสูง ROW_H เท่ากันเป๊ะ → contain-intrinsic-size ตรงจริง = ไม่มี scrollbar กระตุก
    • ห้ามผูก scroll event · IntersectionObserver / ResizeObserver ใช้ได้ (ไม่ยิงตอน scroll)
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
             X ต้องพึ่งความกว้างกล่อง (ระยะขอบเป็น %) จึงวัดครั้งเดียวด้วย ResizeObserver
             X กับ Y ต้องอยู่ใน transform เดียวกัน ไม่งั้นตอน Task 5 marker จะวาร์บแนวนอน -->
        <div class="tp-marker" :class="{ climbing, snap }" :style="markerStyle" aria-hidden="true">
          <span class="tp-marker-in"><Emoji char="🧗" /></span>
        </div>

        <div v-if="burstFloor" class="tp-burst" :class="isLeft(burstFloor) ? 'l' : 'r'"
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

const ROW_H  = 60
const NODE_W = 108
const MARKER = 30
const PAD    = 0.08     // = 8% ต้องตรงกับ --tp-pad ใน CSS ข้างล่าง
const GAP    = 6        // ระยะห่างระหว่างขอบโหนดกับ marker

const props = defineProps({
  floor: { type: Number, required: true },
  best:  { type: Number, required: true },
  max:   { type: Number, required: true },
  crowd: { type: Map, default: () => new Map() },   // ใช้จริงใน Task 3
})
defineEmits(['pick'])

const boxEl = ref(null)
const boxW  = ref(0)

// ชั้นสูงอยู่บน → ไล่ลงมาชั้น 1
const rows = computed(() => Array.from({ length: props.max }, (_, i) => props.max - i))

const isMilestone = (n) => TOWER_BONUS_FLOORS.includes(n)
const isLeft      = (n) => n % 2 === 1
const zoneColor   = (n) => floorZone(n).color

function rowClass(n) {
  return [
    isLeft(n) ? 'l' : 'r',
    n <= props.best ? 'done' : n === props.floor ? 'now' : 'lock',
    {
      first: n === props.max, last: n === 1,          // ← คงไว้ ห้ามทำหาย (ดู Task 2)
      pop: n === popFloor.value, fill: n === fillFloor.value,
      fillUp: fillFloor.value > 0 && n === fillFloor.value + 1,
    },
  ]
}

// พื้นโหนดที่ผ่านแล้ว = สีโซนจาง (ต่อท้าย 40 = alpha ~25% แบบเดียวกับแถบเดิมที่ถูกแทนที่)
function nodeStyle(n) {
  return n <= props.best ? { background: zoneColor(n) + '40' } : null
}

// สีเส้นเชื่อม 2 ครึ่ง แยกกันเพราะคนละช่วงการเดินทาง:
//   ครึ่งบน (::before) = ช่วง n ↔ n+1 → ผ่านแล้วเมื่อพิชิตชั้น n สำเร็จ    → n <= best
//   ครึ่งล่าง (::after) = ช่วง n ↔ n-1 → ผ่านแล้วเมื่อพิชิตชั้น n-1 สำเร็จ → n <= best + 1
function lineStyle(n) {
  return {
    '--tp-up': n <= props.best     ? zoneColor(n) : '#e2e8f0',
    '--tp-dn': n <= props.best + 1 ? zoneColor(n) : '#e2e8f0',
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
// X = กึ่งกลาง marker ที่วางชิดด้านนอกโหนดฝั่งเดียวกัน
const markerStyle = computed(() => {
  const w = boxW.value
  const y = (props.max - props.floor) * ROW_H + (ROW_H - MARKER) / 2
  const off = PAD * w + NODE_W + GAP
  const x = isLeft(props.floor) ? off : w - off - MARKER
  return { transform: `translate3d(${Math.round(x)}px, ${y}px, 0)` }
})

// ── scroll ให้ชั้นปัจจุบันอยู่กลางกล่อง ──────────────────
// คำนวณตรงจากสูตร ไม่ใช้ scrollIntoView → ตั้งได้ก่อนเฟรมแรก ไม่มีอาการวาบจากชั้นบนสุด
function reduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
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

let ro = null
onMounted(() => {
  boxW.value = boxEl.value?.clientWidth || 0
  centerOnCurrent(false)
  attachObserver()
  if (typeof ResizeObserver !== 'undefined' && boxEl.value) {
    // ยิงตอน mount + ตอนหมุนจอ — ไม่ยิงตอน scroll
    ro = new ResizeObserver(([e]) => { boxW.value = e.contentRect.width })
    ro.observe(boxEl.value)
  }
})
onBeforeUnmount(() => { io?.disconnect(); ro?.disconnect() })

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
.tp-inner { position: relative; }

/* ── แถว ────────────────────────────────────────────────
   --tp-pad ต้องตรงกับค่า PAD ใน <script setup> (marker พึ่งค่าเดียวกัน)
   content-visibility: auto → ข้าม layout+paint ของแถวนอกจอ
   ⚠️ มันบังคับ contain:paint ด้วย = คลิปทุกอย่างที่ล้นขอบแถว
      เส้นเชื่อมจึงต้องแบ่งครึ่งบน/ครึ่งล่างให้อยู่ในกรอบตัวเอง ห้ามวาดคร่อมสองแถว */
.tp-row {
  --tp-pad: 8%;
  position: relative;
  height: 60px;
  display: flex; align-items: center;
  content-visibility: auto;
  contain-intrinsic-size: auto 60px;
}
.tp-row.l { justify-content: flex-start; padding-left: var(--tp-pad); }
.tp-row.r { justify-content: flex-end;   padding-right: var(--tp-pad); }

/* ── เส้นเชื่อมทแยง ─────────────────────────────────────
   แถบสีใน linear-gradient ตั้งฉากกับแกน → ทิศแกนสลับกับเส้นที่เห็น:
     to bottom right (แกน \) → เห็นเป็นเส้น /
     to bottom left  (แกน /) → เห็นเป็นเส้น \
   กล่องแต่ละครึ่งกินจากกลางโหนด (var(--tp-pad) + ครึ่งความกว้างโหนด) ถึงกึ่งกลางแถว 50% */
.tp-row::before, .tp-row::after { content: ''; position: absolute; pointer-events: none; }
.tp-row::before { top: 0;   height: 50%; }
.tp-row::after  { top: 50%; height: 50%; }

.tp-row.l::before, .tp-row.l::after { left: calc(var(--tp-pad) + 54px); right: 50%; }
.tp-row.r::before, .tp-row.r::after { left: 50%; right: calc(var(--tp-pad) + 54px); }

/* ซ้าย-ครึ่งบน: กึ่งกลางแถวอยู่มุมบนขวา → โหนดมุมล่างซ้าย = เส้น / */
.tp-row.l::before {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 2px), var(--tp-up) calc(50% - 2px),
    var(--tp-up) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ซ้าย-ครึ่งล่าง: โหนดมุมบนซ้าย → กึ่งกลางแถวมุมล่างขวา = เส้น \ */
.tp-row.l::after {
  background-image: linear-gradient(to bottom left,
    transparent calc(50% - 2px), var(--tp-dn) calc(50% - 2px),
    var(--tp-dn) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ขวา-ครึ่งบน: กึ่งกลางแถวมุมบนซ้าย → โหนดมุมล่างขวา = เส้น \ */
.tp-row.r::before {
  background-image: linear-gradient(to bottom left,
    transparent calc(50% - 2px), var(--tp-up) calc(50% - 2px),
    var(--tp-up) calc(50% + 2px), transparent calc(50% + 2px));
}
/* ขวา-ครึ่งล่าง: โหนดมุมบนขวา → กึ่งกลางแถวมุมล่างซ้าย = เส้น / */
.tp-row.r::after {
  background-image: linear-gradient(to bottom right,
    transparent calc(50% - 2px), var(--tp-dn) calc(50% - 2px),
    var(--tp-dn) calc(50% + 2px), transparent calc(50% + 2px));
}
/* แถวบนสุดไม่มีชั้นเหนือขึ้นไป · แถวล่างสุดไม่มีชั้นใต้ลงมา
   ใช้คลาสไม่ใช้ :first-child/:last-child — .tp-inner มี .tp-marker เป็นลูกตัวสุดท้ายด้วย
   ทำให้ :last-child ไม่เคย match แถวไหนเลย (เส้นชั้น 1 ห้อยลงไปในที่ว่าง) */
.tp-row.first::before { display: none; }
.tp-row.last::after   { display: none; }

/* ── โหนด ───────────────────────────────────────────────
   ขนาดคงที่ทุกสถานะ → เปลี่ยนสถานะไม่ทำให้เกิด layout shift */
.tp-node {
  position: relative; z-index: 1;
  width: 108px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  border: 2px solid var(--ink); border-radius: 12px;
  background: #f1f5f9; box-shadow: var(--pop);
  font-family: inherit; cursor: pointer;
}
.tp-node:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.tp-ico { font-size: 1rem; line-height: 1; }
.tp-n   { font-size: .78rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }

.tp-row.lock .tp-node { opacity: .6; }
.tp-row.now  .tp-node { background: var(--gold); border-width: 3px; box-shadow: 4px 4px 0 var(--ink); }
.tp-row.now .tp-node:active { box-shadow: 0 0 0 var(--ink); }
.tp-node.milestone { outline: 2px dashed var(--gold); outline-offset: 2px; }
.tp-coin { position: absolute; top: -8px; right: -6px; font-size: .72rem; line-height: 1; }

/* ── รางเพื่อน ──────────────────────────────────────────
   อยู่ฝั่งตรงข้ามโหนดเสมอ → ไม่มีทางทับโหนด
   รางทั้งรางเป็นปุ่มเดียว emit('pick', n) ตัวเดียวกับโหนด — เปิดแผงเดียวกัน */
.tp-rail {
  position: absolute; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center;
  border: none; background: none; padding: 2px; cursor: pointer;
}
.tp-row.l .tp-rail { right: var(--tp-pad); }
.tp-row.r .tp-rail { left:  var(--tp-pad); }
.tp-rail:active { transform: translateY(-50%) scale(.94); }

.tp-face {
  width: 26px; height: 26px; flex-shrink: 0;
  border-radius: 999px; border: 2px solid #fff; background: #cbd5e1;
  object-fit: cover; display: block;
}
.tp-face + .tp-face { margin-left: -9px; }
.tp-more {
  margin-left: 4px; padding: 1px 6px; border-radius: 999px;
  background: var(--ink); color: #fff;
  font-size: .72rem; font-weight: 800; line-height: 1.5;
}

/* ── marker ผู้เล่น ─────────────────────────────────────
   absolute ที่ .tp-inner → ไม่โดน paint containment ของแถว
   transform เดียวถือทั้ง X และ Y (Task 5 จะใส่ transition ที่นี่) */
.tp-marker {
  position: absolute; top: 0; left: 0;
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

/* marker: X กับ Y อยู่ใน transform เดียวกันจึงขยับพร้อมกัน (ไม่วาร์บแนวนอน)
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

@media (prefers-reduced-motion: reduce) {
  .tp-row.pop .tp-node,
  .tp-row.fill::before,
  .tp-row.fillUp::after,
  .tp-marker.climbing .tp-marker-in { animation: none; }
  .tp-marker { transition: none; }
}

/* ── วงแหวนปลดล็อกหมุดโบนัส ────────────────────────────
   วางทับแถวของหมุดนั้น จัดฝั่งเดียวกับโหนด · pointer-events:none ไม่ขวางการกด
   ห้าม animate box-shadow/filter ที่นี่ — วงแหวนใช้ border + transform/opacity เท่านั้น */
.tp-burst {
  position: absolute; top: 0; left: 0; right: 0; height: 60px;
  display: flex; align-items: center; pointer-events: none; z-index: 2;
}
.tp-burst.l { justify-content: flex-start; padding-left: calc(8% + 30px); }
.tp-burst.r { justify-content: flex-end;   padding-right: calc(8% + 30px); }

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

@media (prefers-reduced-motion: reduce) {
  .tp-ring, .tp-gain { animation: none; opacity: 0; }
}
</style>
