<!-- BattleReplay v2 — event-driven (dispatch ตาม event.t) · melee/ranged · ป้ายธาตุ/crit/ตาย ·
     UI: ป้ายฝั่ง + badge ธาตุ + กรอบสีแยกข้าง = ดูรู้เรื่องว่าใครฝั่งไหน/ตีใคร/แพ้ทางมั้ย
     controls: พัก + กดค้างเร่ง (ปุ่มข้าม/เร็วถูกลบ Task 6 — heavy/finish ไม่ย่อแม้กดค้าง) · แตะตัว = pause + inspect (ช่อง passive รอ §5.5 master plan)
     จังหวะขับด้วย beat.timing (battleBeats.js) แทน baseDelay คงที่ (Task 4) — ปุ่มเร็วเดิมถูกลบ
     ⚠️ ทุก emoji ผ่าน <Emoji> (Fluent self-host) — อย่าใส่ emoji ดิบในเทมเพลต (เป็น tofu บนบางเครื่อง) -->
<template>
  <!-- Teleport ไป body: #main-content (position:fixed) = stacking context → z420 สู้ #bottom-nav (z200) ไม่ได้ถ้า render ในนี้
       → nav โผล่ทะลุก้นจอสู้. ย้ายทั้งชุด (peek/result/inspect เป็นลูกข้างใน z คงเดิม) ไป root (ดู CLAUDE.md) -->
  <Teleport to="body">
  <div v-if="data" class="br-ov" :class="'br-theme-' + theme">
    <div class="br-box" ref="boxRef"
         @pointerdown="onHoldStart" @pointerup="onHoldEnd"
         @pointercancel="onHoldEnd" @pointerleave="onHoldEnd">
      <div v-if="introPhase" class="br-intro" @click="skipIntro">
        <span class="br-intro-txt" :class="introPhase">{{ introPhase === 'ready' ? 'READY?' : 'GO!' }}</span>
      </div>
      <div class="br-round" v-if="!done">รอบ {{ round }}</div>
      <div v-if="showFps" class="br-fps" :class="{ bad: fpsWorst > 33, warn: fpsWorst > 16 && fpsWorst <= 33 }">{{ fpsWorst }}ms</div>

      <div class="br-side foe-label"><i class="dot foe"></i> ศัตรู</div>
      <div class="br-team">
        <div v-for="(p, i) in data.botTeam" :key="'B'+i" :ref="el => setEl('B'+i, el)"
             class="br-unit foe" @click="inspect('B'+i)">
          <span class="br-el"><Emoji :char="elEmoji(p)" /></span>
          <span class="br-face"><Emoji :char="defOf(p.id).emoji" /></span>
          <div class="br-hp">
            <div class="br-hp-ghost" :style="{ transform: 'scaleX(' + hpPct('B'+i) / 100 + ')' }"></div>
            <div class="br-hp-fill" :style="{ transform: 'scaleX(' + hpPct('B'+i) / 100 + ')' }"></div>
            <span v-for="(t, ti) in ticksFor('B'+i)" :key="ti" class="br-tick" :style="{ left: t + '%' }"></span>
          </div>
          <div class="br-stats"><span class="br-atk">{{ atkOf('B'+i) }}</span><span class="br-hpn foe">{{ curHp('B'+i) }}</span></div>
        </div>
      </div>

      <div class="br-vs"><Emoji char="⚔️" /> {{ data.vsLabel ?? ('ชั้น ' + data.cleared) }}</div>

      <div class="br-team">
        <div v-for="(p, i) in data.playerTeam" :key="'A'+i" :ref="el => setEl('A'+i, el)"
             class="br-unit me" @click="inspect('A'+i)">
          <span class="br-el"><Emoji :char="elEmoji(p)" /></span>
          <span class="br-face"><Emoji :char="defOf(p.id).emoji" /></span>
          <div class="br-hp">
            <div class="br-hp-ghost" :style="{ transform: 'scaleX(' + hpPct('A'+i) / 100 + ')' }"></div>
            <div class="br-hp-fill mine" :style="{ transform: 'scaleX(' + hpPct('A'+i) / 100 + ')' }"></div>
            <span v-for="(t, ti) in ticksFor('A'+i)" :key="ti" class="br-tick" :style="{ left: t + '%' }"></span>
          </div>
          <div class="br-stats"><span class="br-atk">{{ atkOf('A'+i) }}</span><span class="br-hpn me">{{ curHp('A'+i) }}</span></div>
        </div>
      </div>
      <div class="br-side me-label"><i class="dot me"></i> ทีมคุณ</div>

      <!-- fx pool layer (pops/callouts/koPuff/projectile) — พิกัดสัมพัทธ์กับ .br-box -->
      <div class="br-fx-layer" ref="fxLayerEl"></div>

      <div class="br-ctrl" v-if="!done">
        <button class="br-btn sm" @click="togglePause"><Emoji :char="paused ? '▶️' : '⏸️'" /> {{ paused ? 'เล่น' : 'พัก' }}</button>
      </div>
      <div v-if="ffActive" class="br-ff"><Emoji char="⏩" /> เร่ง</div>
      <div v-if="holdHint" class="br-hold-hint">กดค้างเพื่อเร่ง</div>
    </div>

    <!-- peek สนามหลังจบ: ปุ่มลอยกลับเข้าหน้าสรุป + ปิด (มีปุ่มปิดตรงนี้ด้วย ไม่ต้องกดดูสรุปกลับก่อน) -->
    <div v-if="resultReady && !resultOpen" class="br-peek-bar">
      <button class="br-btn sm br-peek-btn" @click="resultOpen = true"><Emoji char="📋" /> ดูสรุป</button>
      <button class="br-btn sm" @click="$emit('close')">ปิด</button>
    </div>

    <!-- modal สรุปผล — แตะนอกกล่อง = peek สนาม (ไม่ใช่ปิดทิ้ง กันกดพลาด) -->
    <div v-if="resultOpen && summary" class="br-result-ov" @click.self="resultOpen = false">
      <div class="br-modal">
        <div class="br-result" :class="{ win: data.won }">{{ data.won ? (data.winText ?? `ชนะ! ขึ้นชั้น ${data.cleared + 1}`) : (data.loseText ?? 'แพ้ ลองใหม่ได้เลย') }}</div>
        <div v-if="data.won && (data.rewardText ?? data.cleared != null)" class="br-reward"><Emoji char="🎁" /> {{ data.rewardText ?? ('ได้รับ: ขึ้นชั้น ' + (data.cleared + 1)) }}</div>

        <div class="br-sum-team">
          <div class="br-sum-head"><i class="dot me"></i> ทีมคุณ</div>
          <div v-for="u in summary.teamA" :key="u.uid" class="br-sum-row" :class="{ mvp: summary.mvp.A === u.uid, win: data.won, dead: u.dead }">
            <span v-if="summary.mvp.A === u.uid" class="br-mvp">MVP</span>
            <span class="br-sum-face"><Emoji :char="defOf(u.id).emoji" /></span>
            <span class="br-sum-dmg"><Emoji char="⚔️" />{{ u.dmgDealt }}</span>
            <span class="br-sum-dmg taken"><Emoji char="🛡️" />{{ u.dmgTaken }}</span>
          </div>
        </div>

        <div class="br-sum-team">
          <div class="br-sum-head"><i class="dot foe"></i> ศัตรู</div>
          <div v-for="u in summary.teamB" :key="u.uid" class="br-sum-row" :class="{ mvp: summary.mvp.B === u.uid, win: !data.won, dead: u.dead }">
            <span v-if="summary.mvp.B === u.uid" class="br-mvp">MVP</span>
            <span class="br-sum-face"><Emoji :char="defOf(u.id).emoji" /></span>
            <span class="br-sum-dmg"><Emoji char="⚔️" />{{ u.dmgDealt }}</span>
            <span class="br-sum-dmg taken"><Emoji char="🛡️" />{{ u.dmgTaken }}</span>
          </div>
        </div>

        <div v-if="showFps" class="br-fps-sum">
          เฟรมแย่สุด <b>{{ Math.round(fpsPeak) }}ms</b> ·
          หลุด 60fps <b>{{ fpsOver16 }}</b> เฟรม ·
          ต่ำกว่า 30fps <b :class="{ bad: fpsOver33 > 0 }">{{ fpsOver33 }}</b> เฟรม
        </div>

        <div class="br-modal-btns">
          <button class="br-btn sm" @click="resultOpen = false"><Emoji char="👀" /> ดูสนาม</button>
          <button class="br-btn" @click="$emit('close')">ปิด</button>
        </div>
      </div>
    </div>

    <!-- inspect popover — pause + ดูสเตตัส combat จริง + ช่อง passive (รอบนี้ยังว่าง '—') -->
    <div v-if="inspectUid && insp" class="br-inspect" @click.self="inspectUid = null">
      <div class="br-card">
        <div class="br-card-emoji"><Emoji :char="insp.def.emoji" /></div>
        <div class="br-card-name">{{ insp.def.name }}</div>
        <div class="br-card-row"><span>ธาตุ</span><b><Emoji :char="insp.elEmoji" /> {{ insp.elName }}</b></div>
        <div class="br-card-row"><span>ระดับ</span><b>{{ rarityLabel(insp.def.rarity) }} · เกรด {{ GRADE_LABELS[Math.min(5, Math.max(0, insp.grade || 0))] }}</b></div>
        <div class="br-card-row"><span>พลังโจมตี</span><b>{{ insp.atk }}</b></div>
        <div class="br-card-row"><span>พลังชีวิต</span><b>{{ insp.hpNow }} / {{ insp.hpMax }}</b></div>
        <div class="br-card-pass"><span>Passive</span><b>{{ insp.passive ? insp.passive.name : 'เร็วๆ นี้' }}</b></div>
        <button class="br-btn sm" @click="inspectUid = null">ปิด</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { useEscapeKey } from '../../composables/useEscapeKey.js'
import Emoji from '../shared/Emoji.vue'
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { getPetDef, atkStyleOf, projectileOf, passiveOf, ELEMENTS, EL_NAME, GRADE_LABELS } from '../../data/index.js'
import { RARITY } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'
import { computeBattleSummary } from '../../utils/battleSummary.js'
import { fluentFile } from '../../utils/emoji.js'
import { createBattleFx } from '../../utils/battleFx.js'
import { buildBeats, scaleTiming } from '../../utils/battleBeats.js'
import { readPrefs, fxFlags, paceMult } from '../../utils/battleReplayPrefs.js'

const props = defineProps({
  data: { type: Object, default: null },
  theme: { type: String, default: 'tower' },   // 'arena' | 'tower' — พื้นหลังสนาม
})
defineEmits(['close'])

const BASE_URL = import.meta.env.BASE_URL

// เวลาทั้งหมดมาจาก beat.timing แล้ว — เหลือแค่เวลา "รอบนอกไฟต์"
// resultDelayMs 900 (เดิม 500) = ให้หมัดน็อกชั้น finish ได้ลงจอดก่อนเปิด modal สรุป
const REPLAY_CFG = { resultDelayMs: 900 }

const defOf = (id) => getPetDef(id) || { emoji: '❓' }
const elEmoji = (p) => ELEMENTS[p?.element]?.emoji || '✊'

const idx = ref(0)
const round = ref(1)
const paused = ref(false)
const prefs = ref(readPrefs())          // อ่านครั้งเดียวตอน mount — พาเนล Admin เขียนก่อนเปิด replay อยู่แล้ว
const ffActive = ref(false)             // โหมดเร่ง (กดค้าง) — Task 6 เป็นคนสลับ
const pace = computed(() => paceMult(prefs.value.pace))
// speed/cycleSpeed/ปุ่ม "เร็ว ×N" ถูกลบทั้งชุด (Task 4) — เวลามาจาก beat.timing แล้ว

// ── กดค้าง = เร่ง (ไม่ใช่ข้าม) ──
// กติกาที่ทำให้มันไม่ใช่ปุ่มข้าม: FF_SCALE ใน battleBeats ย่อเฉพาะ chip/solid — heavy/finish เล่นเต็มเสมอ
// ผลคือคนรีบก็ยังได้ดูคริกับหมัดน็อกครบ แล้วจบที่หน้าสรุปเหมือนกัน
const HOLD_MS = 400
const holdHint = ref(false)
let holdTimer = null, hintTimer = null
function onHoldStart(e) {
  if (done.value || inspectUid.value || introPhase.value) return           // ไฟต์จบ/เปิด inspect/ยังโชว์ READY-GO อยู่ = ไม่ใช่จังหวะกดค้างเร่ง
  if (e.target.closest && e.target.closest('.br-unit, .br-btn')) return   // แตะการ์ด/ปุ่ม = คนละเจตนา (เปิด inspect / พัก)
  // ผูก pointer capture กับกล่องสนามไว้ — กันเคส "ไฟต์จบกลางที่กดค้าง" ที่โมดัลสรุปลอยทับกล่องพอดี
  // ไม่ capture ไว้ pointerup ตอนปล่อยนิ้วจะไปตกที่โมดัล (topmost element ตอนนั้น) ไม่ใช่กล่อง → onHoldEnd ไม่ทำงาน → ffActive ค้าง true ข้ามไฟต์ถัดไป
  // (มี watch(done) ด้านล่างกันเหนียวอีกชั้น เผื่อ browser ไหนไม่รองรับ/ไม่ทำตาม capture)
  if (boxRef.value?.setPointerCapture) { try { boxRef.value.setPointerCapture(e.pointerId) } catch { /* บาง browser โยน ไม่ใช่สาระ */ } }
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => { ffActive.value = true; holdHint.value = false }, HOLD_MS)
}
function onHoldEnd(e) {
  clearTimeout(holdTimer)
  if (e?.pointerId != null && boxRef.value?.hasPointerCapture?.(e.pointerId)) {
    try { boxRef.value.releasePointerCapture(e.pointerId) } catch { /* เพิกเฉย */ }
  }
  if (!ffActive.value) {
    // แตะสั้นๆ โดยไม่ค้าง → บอกใบ้ว่ามีทางเร่งอยู่ (ค้นพบได้ตอนต้องการ ไม่ล่อตาตอนไม่ต้องการ)
    holdHint.value = true
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { holdHint.value = false }, 1500)
  }
  ffActive.value = false
}
const hp = ref({})
const inspectUid = ref(null)
const introPhase = ref(null)   // 'ready' | 'go' | null (null = เริ่มเล่น log แล้ว)
const resultOpen = ref(false)
useEscapeKey(resultOpen, () => { resultOpen.value = false })    // modal สรุปโชว์อยู่
const resultReady = ref(false)   // จบไฟต์+ผ่านจังหวะรอแล้ว — ใช้โชว์ปุ่มลอย "ดูสรุป" ตอน peek
let resultTimer = null
let introTimer = null
let gen = 0                      // generation guard — reset/skip เพิ่มค่า เพื่อให้ promise chain ค้างจาก wait() รู้ตัวว่าโดนยกเลิก
let timer = null
const pendingTimers = new Set()  // เก็บ timer id จาก wait() ทั้งหมด — clear ตอน reset/skip/unmount กัน promise chain ค้างมาเขียน state เก่าทับ
function wait(ms) { return new Promise(r => { const t = setTimeout(r, ms); pendingTimers.add(t) }) }
let maxHp = {}, unitAtk = {}     // uid → maxHp / atk (static ต่อ unit จาก buildCombatant)
const els = {}                   // uid → DOM el (วัดตำแหน่ง melee/ranged)
function setEl(uid, el) { if (el) els[uid] = el }

// ── ไฮไลต์ (Phase 2b): classList ตรงบน els[uid] แทน reactive ref (acting/winding/flashing) ──
// ตัด Vue reactivity ออกจาก path ที่วิ่งทุกหมัด — toggle class ตรงถูกกว่า set ref แล้วรอ re-render
function highlight(uid, cls, on = true) { const el = els[uid]; if (el) el.classList[on ? 'add' : 'remove'](cls) }
function clearHighlights() { Object.values(els).forEach(el => el && el.classList.remove('windup', 'acting', 'flash')) }
// dead ก็ imperative classList เหมือนกัน (ไม่ใช่ reactive :class แล้ว) — กัน Vue re-render เขียนทับ flash/acting/windup ตอน hp เปลี่ยน (Task 9 finding #1)
function setDead(uid) { highlight(uid, 'dead', (hp.value[uid] ?? 100) <= 0) }

// ── fx pool (Phase 2a): pops/callouts/koPuff/projectile ออกจาก Vue reactivity → plain WAAPI pool ──
const fxLayerEl = ref(null)      // ref บน .br-fx-layer
const boxRef = ref(null)         // ref บน .br-box (จุดอ้างอิงพิกัด)
let fx = null
let attachedLayer = null           // .br-fx-layer element ที่ fx ผูกอยู่ตอนนี้ — เทียบกันจับ layer remount (overlay v-if สร้าง DOM ใหม่ทุกไฟต์)
function ensureFx() {
  if (!boxRef.value || !fxLayerEl.value) return
  if (fx && attachedLayer === fxLayerEl.value) return    // attach แล้วกับ layer ปัจจุบัน — ข้าม
  if (fx) fx.destroy()                                    // layer เปลี่ยน (ไฟต์ใหม่ remount .br-fx-layer) → ทิ้งของเก่า (listener/pool) ก่อนสร้างใหม่
  fx = createBattleFx()
  fx.attach({ boxEl: boxRef.value, layerEl: fxLayerEl.value, getEl: uid => els[uid] || null })
  fx.setFlags(fxFlags(prefs.value.fx))
  attachedLayer = fxLayerEl.value
}

// ── การ์ดสไตล์ Hearthstone: ATK/HP เป็นเลข + หลอดเลือดขีดทุก 50 HP ──
function atkOf(uid) { return unitAtk[uid] ?? 0 }
function curHp(uid) { return Math.round((maxHp[uid] || 0) * (hp.value[uid] ?? 100) / 100) }
function ticksFor(uid) {
  const max = maxHp[uid] || 1, out = []
  for (let h = 50; h < max; h += 50) out.push((h / max) * 100)  // % ตำแหน่งขีดทุก 50 HP
  return out
}

const rawLog = computed(() => props.data?.result?.log || [])
// ⚠️ maxHp เป็น plain object ที่ buildMax() เขียนทับ ไม่ใช่ ref — beats จึงไม่ re-compute เองเมื่อ maxHp เปลี่ยน
// แต่ปลอดภัยเพราะ buildMax(d) ถูกเรียกก่อน reset() ในตัว watcher เดียวกันเสมอ และ rawLog เปลี่ยนพร้อมกัน (props.data ใหม่ทั้งก้อน) ซึ่ง trigger การ compute ใหม่อยู่แล้ว
const beats = computed(() => buildBeats(rawLog.value, maxHp))
const done = computed(() => idx.value >= beats.value.length)
const summary = computed(() => done.value
  ? computeBattleSummary(rawLog.value, props.data?.playerTeam || [], props.data?.botTeam || [])
  : null)

function buildMax(d) {
  maxHp = {}; unitAtk = {}
  const add = (p, uid) => { const c = buildCombatant(p); maxHp[uid] = Math.round(c.maxHp) || 1; unitAtk[uid] = Math.round(c.atk) }
  ;(d?.botTeam || []).forEach((p, i) => add(p, 'B' + i))
  ;(d?.playerTeam || []).forEach((p, i) => add(p, 'A' + i))
}

// อุ่น cache+decode asset combat ทั้งหมดก่อนเริ่มเล่น (intro หน่วง ~1.1s) — dash/pop/projectile swap src กลางไฟต์
// ไม่งั้น decoding="sync" ครั้งแรกของแต่ละรูป = บล็อกเฟรม
const preloadedImgs = []
function preloadCombat(d) {
  const chars = new Set(['⚡', '🛡️', '💀', '💥'])
  for (const p of [...(d?.playerTeam || []), ...(d?.botTeam || [])]) {
    const def = getPetDef(p?.id); if (!def) continue
    if (def.emoji) chars.add(def.emoji)                                  // หน้าเพ็ท (dash sprite)
    if (atkStyleOf(def) === 'ranged') chars.add(projectileOf(def))       // projectile
  }
  for (const c of chars) {
    const f = fluentFile(c); if (!f) continue
    const img = new Image(); img.decoding = 'sync'; img.src = BASE_URL + f
    if (img.decode) img.decode().catch(() => {})                         // force decode ล่วงหน้า
    preloadedImgs.push(img)
  }
}
function reset() {
  gen++                                                                     // ยกเลิก promise chain ค้างทุกตัว (applyAttack/step เช็ค gen ทุกจุด)
  prefs.value = readPrefs()     // อ่านใหม่ทุกไฟต์ — พาเนล Admin เปลี่ยนค่าแล้วยิงไฟต์ทดสอบต้องเห็นผลทันที
  clearTimeout(timer); clearTimeout(introTimer)
  clearTimeout(resultTimer); resultOpen.value = false; resultReady.value = false
  pendingTimers.forEach(clearTimeout); pendingTimers.clear()                // ตัด wait() ที่ค้างอยู่ทั้งหมด (windup/motion/hitstop)
  introPhase.value = null                                                   // กันค้างตอน replay ใหม่
  Object.values(els).forEach(el => { if (el) { el.style.transform = ''; el.style.transition = ''; el.style.zIndex = '' } })  // ล้าง lunge ค้างจากไฟต์ก่อน (component ถูก mount ค้างไว้ ใช้ซ้ำ)
  clearHighlights()                                                         // ล้างคลาส windup/acting/flash ค้าง
  idx.value = 0; round.value = 1
  paused.value = false; inspectUid.value = null
  ffActive.value = false; holdHint.value = false                             // เคลียร์โหมดเร่ง/คำใบ้ค้างจากไฟต์ก่อน
  clearTimeout(holdTimer); clearTimeout(hintTimer)
  const h = {}; Object.keys(maxHp).forEach(uid => { h[uid] = 100 }); hp.value = h
  Object.keys(maxHp).forEach(setDead)                                       // ทุกตัว hp=100 → setDead ถอด class dead ค้างจากไฟต์ก่อน
  // fx: DOM ของ .br-box/.br-fx-layer ต้องพร้อมก่อน attach — รอ nextTick (ครั้งแรกอาจยัง mount ไม่เสร็จตอน watch immediate ยิง)
  nextTick(() => { ensureFx(); fx?.reset() })                              // reset() ภายใน fx = invalidateCenters + cancelAll (ยกเลิก pop/callout/projectile ค้าง)
  runIntro()
  // log ว่าง = done ค้าง true ตั้งแต่แรก → watch(done) ไม่ยิงซ้ำ ต้องเปิดสรุปเองไม่งั้น overlay ไม่มีทางออก
  if (done.value) { resultReady.value = true; resultOpen.value = true }
  startFps()   // รีเซ็ตตัวนับ fps ทุกไฟต์ใหม่ (ไม่งั้นไฟต์ที่ 2+ ในพาเนล Admin จะสะสมทับไฟต์ก่อนหน้า)
}

// intro READY?→GO! ก่อนเริ่มเล่น log (แตะข้ามได้)
function runIntro() {
  introPhase.value = 'ready'
  introTimer = setTimeout(() => {
    introPhase.value = 'go'
    introTimer = setTimeout(() => { introPhase.value = null; step() }, 400)
  }, 700)
}
function skipIntro() {
  if (introPhase.value === null) return
  clearTimeout(introTimer)
  introPhase.value = null
  step()
}

// ── ตำแหน่ง/การเคลื่อนไหว ──
// centers cache ย้ายไป fx pool (battleFx.js createBattleFx().centerOf) — ใช้ fx.centerOf(uid) แทน
function defForUid(uid) {
  const i = parseInt(uid.slice(1), 10)
  const arr = uid[0] === 'A' ? props.data?.playerTeam : props.data?.botTeam
  return getPetDef(arr?.[i]?.id) || { emoji: '❓' }
}
// ── event dispatch — เพิ่ม handler ใหม่ที่นี่ (passive/heal/…) ──
const handlers = {
  round(e) { round.value = e.n },
  attack(e) { return applyAttack(e) },
  end() { clearHighlights() },
}

// impact: hp/pop/callout/burst/ko ตอนโดนตี — รับ g เช็ค gen กัน reset ระหว่างพุ่งมาเขียน state เก่าทับ
// t = scaled timing ของ beat นี้ (จาก applyAttack) — ใช้เป็นฐานเวลาให้ squashTarget/ko แทนเลขคงที่เดิม (420/520)
// เพื่อไม่ให้อนิเมชันการ์ดเป้าอยู่นานเกินจังหวะของ beat เอง (โดยเฉพาะ pace tight)
function applyImpact(beat, g, t) {
  if (g !== gen) return
  const tgtEl = els[beat.target]
  highlight(beat.target, 'flash')
  let targetAnim = null   // promise ของ squashTarget/ko บนการ์ดเป้า (ถ้ามี) — ผูกอายุ flash กับตัวนี้แทน timeout ตายตัว
  const postMs = Math.round(t.hitstop + t.tail)   // ช่วงหลังโดน = พอดีกับจังหวะที่การ์ดเป้ายังเด้ง/หมุนอยู่

  // ขนาดดาว/แรงสั่นตามชั้น — ชั้น chip/solid ห้ามสั่นจอเด็ดขาด (§6.2 ของสเปก)
  // beat.kill ตัด squashTarget ทิ้งเสมอ (ไม่ว่าจะชั้น heavy/finish) เพราะ ko() ด้านล่างครอบการ์ดตัวเดียวกันแล้ว
  // — ยิง animate() 2 ครั้งบนการ์ดใบเดียวกันผิดกฎ "1 หมัด 1 animation/การ์ด" (ข้อบังคับ v3, พบโดยผู้รีวิว Task 3)
  if (beat.tier === 'chip') { /* ชั้นถากไม่มีดาว ไม่มีสั่น */ }
  else if (beat.tier === 'solid') fx?.burst(beat.target, 34)
  else if (beat.tier === 'heavy') { fx?.burst(beat.target, 66); fx?.shake(5, 2); if (!beat.kill) targetAnim = fx?.squashTarget(tgtEl, 'heavy', postMs) }
  else { fx?.burst(beat.target, 92); fx?.shake(8, 3, true); if (!beat.kill) targetAnim = fx?.squashTarget(tgtEl, 'finish', postMs) }

  hp.value = { ...hp.value, [beat.target]: Math.max(0, Math.round((beat.targetHpAfter / (maxHp[beat.target] || 1)) * 100)) }
  setDead(beat.target)

  fx?.pop(beat.target, { dmg: beat.dmg, crit: beat.crit, eff: beat.eff, tier: beat.tier })
  if (beat.eff === 'super' || beat.eff === 'weak') fx?.callout(beat.target, beat.eff)

  // อนิเมชันน็อกผูกกับ beat.kill ไม่ใช่กับชั้น — 1 ไฟต์ตาย 4–5 ตัว แต่มีชั้น finish แค่หมัดเดียว
  if (beat.kill) { fx?.dangerRing(beat.target, false); targetAnim = fx?.ko(beat.target, tgtEl, postMs) }
  else {
    if (beat.danger) fx?.dangerRing(beat.target, true)
    if (beat.survive) fx?.callout(beat.target, 'survive')
  }

  // flash: การ์ดเป้ามี animate() ต่อ (squash/ko) ก็รอมันจบก่อนถอด flash กัน border-color ชนกลางอากาศ (ข้อบังคับ v3)
  // ไม่มี animation (chip/solid ไม่ตาย) → ใช้ timeout 250ms เดิม
  if (targetAnim) targetAnim.then(() => { if (g === gen) highlight(beat.target, 'flash', false) })
  else setTimeout(() => { if (g === gen) highlight(beat.target, 'flash', false) }, 250)
}

// windup → motion → impact → hitstop → tail ตาม beat.timing
// การ์ดพุ่ง = 1 animation ครอบทั้ง beat (ยิงแล้วไม่ await — เราเดินเวลาด้วย wait() แยก) ตามข้อบังคับ v3
async function applyAttack(beat) {
  const g = gen
  const t = scaleTiming(beat, { pace: pace.value, ff: ffActive.value })
  const def = defForUid(beat.attacker)
  const ranged = atkStyleOf(def) === 'ranged'

  if (beat.tier !== 'chip') {
    highlight(beat.attacker, 'windup')                       // เปลี่ยน class ให้เสร็จ "ก่อน" สั่ง animate (ข้อบังคับ v3)
    fx?.ring(beat.attacker, 'windup', t.windup)
    if (!ranged) fx?.lunge(els[beat.attacker], beat.attacker, beat.target, t, beat.tier)
    await wait(t.windup); if (g !== gen) return
    highlight(beat.attacker, 'windup', false)
  }
  highlight(beat.attacker, 'acting')

  if (ranged) fx?.projectile(beat.attacker, beat.target, projectileOf(def), t.motion)
  else if (beat.tier === 'chip') fx?.jab(beat.attacker, beat.target, t.motion)
  // melee ชั้นอื่น: การ์ดพุ่งอยู่แล้วจาก lunge() ด้านบน ไม่ต้องยิงอะไรเพิ่ม

  await wait(t.motion); if (g !== gen) return
  applyImpact(beat, g, t)
  await wait(t.hitstop); if (g !== gen) return
  // acting ถอดหลัง tail เท่านั้น — fx.lunge() ของผู้โจมตียังพุ่งอยู่ตลอด windup+motion+hitstop+tail (1 animation ครอบทั้ง beat)
  // ถอด class ระหว่างที่มันยังวิ่งอยู่ = border-color เปลี่ยนกลางอากาศ ชน re-raster (ข้อบังคับ v3, พบโดยผู้รีวิว)
  await wait(t.tail); if (g !== gen) return
  highlight(beat.attacker, 'acting', false)
}

async function step() {
  clearTimeout(timer)
  if (paused.value) return
  if (idx.value >= beats.value.length) { clearHighlights(); return }
  const g = gen
  const b = beats.value[idx.value]
  const h = handlers[b.t]
  if (h) await h(b)          // attack = รอครบทั้ง beat จริง · round = sync · type ที่ไม่รู้จัก = ข้ามเงียบ
  if (g !== gen) return
  idx.value++
  // ช่องว่างระหว่างหมัดอยู่ใน beat.timing.tail แล้ว — ไม่มี baseDelay อีกต่อไป
  if (idx.value < beats.value.length) timer = setTimeout(step, 0)
  else clearHighlights()
}

function togglePause() {
  paused.value = !paused.value
  if (!paused.value) { clearTimeout(timer); step() }   // เคลียร์ timer ค้างก่อนเล่นต่อ (กันรันซ้อน)
}
function inspect(uid) { paused.value = true; clearTimeout(timer); inspectUid.value = uid }

function hpPct(uid) { return hp.value[uid] ?? 100 }

// ── inspect helpers ──
function rarityLabel(r) { return RARITY[r]?.label || r }
const insp = computed(() => {
  const uid = inspectUid.value; if (!uid) return null
  const i = parseInt(uid.slice(1), 10)
  const arr = uid[0] === 'A' ? props.data?.playerTeam : props.data?.botTeam
  const p = arr?.[i] || {}
  const c = buildCombatant(p)
  const def = getPetDef(p.id) || { emoji: '❓', name: '?', element: 'scissors', rarity: 'common' }
  return {
    def, grade: p.grade || 0, atk: Math.round(c.atk), hpMax: Math.round(c.maxHp),
    hpNow: Math.round(c.maxHp * (hp.value[uid] ?? 100) / 100), passive: passiveOf(def),
    elEmoji: ELEMENTS[def.element]?.emoji || '✊', elName: EL_NAME[def.element] || def.element,
  }
})

watch(() => props.data, (d) => { if (d) { buildMax(d); preloadCombat(d); reset() } }, { immediate: true })
// ตีจบ → เว้น ~0.5 วิ ให้เห็นสนามจบ แล้วเปิด modal สรุป (เช็ก resultReady กันตั้งซ้ำ — reset() เปิดเองทันทีถ้า log ว่างตั้งแต่แรก)
watch(done, (v) => {
  if (!v) return
  // นิ้วอาจยังกดค้างอยู่ตอนไฟต์จบพอดี (โมดัลสรุปลอยทับกล่องสนาม) — เคลียร์โหมดเร่ง/คำใบ้ทันทีกันค้างข้ามไฟต์ถัดไป
  // (ปกติ pointerup จะตกที่กล่องเดิมเพราะ setPointerCapture ไว้ใน onHoldStart แล้ว แต่กันเหนียวอีกชั้น)
  clearTimeout(holdTimer); clearTimeout(hintTimer)
  ffActive.value = false; holdHint.value = false
  if (resultReady.value) return
  resultTimer = setTimeout(() => { resultReady.value = true; resultOpen.value = true }, REPLAY_CFG.resultDelayMs)
}, { immediate: true })
// layout เปลี่ยน (หมุนจอ/ปรับขนาด) = center ที่ cache ไว้ใน fx ใช้ไม่ได้ ต้องวัดใหม่
function onResize() { fx?.invalidateCenters() }
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)

// ── FPS/frame-time meter — เปิดด้วย ?fps=1 ท้าย URL หรือ data.fpsMeter (พาเนล Admin) ──
// worst = frame time แย่สุดใน ~1 วิ · over16/over33 = จำนวนเฟรมสะสมทั้งไฟต์ที่หลุด 60fps / ต่ำกว่า 30fps
// ⚠️ over16 นับรวม over33 ด้วย (ไม่ใช่ else-if แยกกลุ่ม) — ไม่งั้นป้าย "หลุด 60fps" จะนับไม่ครบตอนมีเฟรมแย่ถึงขั้น <30fps ปนอยู่
const showFps = computed(() => new URLSearchParams(location.search).has('fps') || props.data?.fpsMeter === true)
const fpsWorst = ref(0)
const fpsOver16 = ref(0)
const fpsOver33 = ref(0)
const fpsPeak = ref(0)
let fpsRaf = 0, fpsLast = 0, fpsMax = 0, fpsWindowStart = 0
function fpsLoop(now) {
  if (fpsLast) {
    const dt = now - fpsLast
    if (dt > fpsMax) fpsMax = dt
    if (dt > fpsPeak.value) fpsPeak.value = dt
    if (dt > 16) fpsOver16.value++
    if (dt > 33) fpsOver33.value++
    if (now - fpsWindowStart > 1000) { fpsWorst.value = Math.round(fpsMax); fpsMax = 0; fpsWindowStart = now }
  } else { fpsWindowStart = now }
  fpsLast = now
  fpsRaf = requestAnimationFrame(fpsLoop)
}
function startFps() {
  if (!showFps.value) return
  // รีเซ็ตตัวนับทุกครั้งที่เรียก (ทุกไฟต์ใหม่ผ่าน reset()) — ไม่เช็ก fpsRaf ก่อนรีเซ็ต ไม่งั้นไฟต์ที่ 2+ จะสะสมทับไฟต์ก่อนหน้า (loop เดิมยังวิ่งอยู่จาก mount แรก)
  // แค่กันไม่ให้เปิด rAF loop ซ้อนกัน 2 ลูป (ถ้ามีอยู่แล้วก็ปล่อยวิ่งต่อ ไม่ต้อง cancel+restart)
  fpsLast = 0; fpsMax = 0; fpsWindowStart = 0
  fpsPeak.value = 0; fpsOver16.value = 0; fpsOver33.value = 0
  if (!fpsRaf) fpsRaf = requestAnimationFrame(fpsLoop)
}
watch(showFps, (v) => { if (v) startFps() }, { immediate: true })

onUnmounted(() => {
  clearTimeout(timer); clearTimeout(introTimer); clearTimeout(resultTimer)
  clearTimeout(holdTimer); clearTimeout(hintTimer)
  pendingTimers.forEach(clearTimeout); pendingTimers.clear()
  window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize)
  if (fpsRaf) cancelAnimationFrame(fpsRaf)
  fx?.destroy(); fx = null; attachedLayer = null
})
</script>

<style scoped>
.br-ov { position: fixed; inset: 0; z-index: 420; background: #0f172a; display: flex; align-items: center; justify-content: center; padding: 16px; }
/* Tower = ดันเจี้ยน/หอคอย: หินม่วง-น้ำเงินเข้ม + เรืองคบเพลิงอุ่นมุมล่าง (คงโทนเดิมแต่มีมิติ) */
.br-theme-tower {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(76,29,149,.55), transparent 60%),
    radial-gradient(80% 55% at 50% 100%, rgba(217,119,6,.22), transparent 70%),
    linear-gradient(180deg, #1e1b4b, #0f172a 70%);
}
/* Arena = โคลอสเซียม: ฟ้าเย็นด้านบน → หินทรายอุ่นเข้มด้านล่าง + ลายเสาแนวตั้งจางๆ (คุมเข้มพอให้ตัวขาวอ่านออก) */
.br-theme-arena {
  background:
    radial-gradient(100% 70% at 50% 10%, rgba(59,130,246,.28), transparent 55%),
    linear-gradient(180deg, #3b2f1a 0%, #2a1f12 60%, #17100a 100%),
    repeating-linear-gradient(90deg, rgba(255,220,150,.05) 0 2px, transparent 2px 46px);
}
/* touch-action:none + กันเลือกข้อความ/callout ของ iOS — กล่องนี้รับ pointerdown ค้างเป็น input เกม (เร่ง)
   ไม่งั้นกดค้าง ~400ms บนข้อความ (เช่น "รอบ 1") อาจเด้งเมนู copy/แว่นขยายของ Safari มาแทรกกลางค้าง */
.br-box { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 8px; position: relative;
  touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
/* hitstop เดิม scale ทั้ง box = re-raster เต็มจอ @DPR3 ทุก crit (แพงสุด คุ้มน้อยสุด แค่เด้ง 1.2%) → ตัดทิ้ง
   crit ยังสื่อผ่านเลขใหญ่/ทอง + จังหวะ freeze (extra delay ใน step) ที่ยังอยู่ */
.br-round { text-align: center; color: #fff; font-weight: 800; font-size: .82rem; letter-spacing: .06em; margin-bottom: 2px; }

/* FPS meter (?fps=1) — เขียว=ลื่น เหลือง=หลุด 60fps แดง=ต่ำกว่า 30fps (กระตุกชัด) */
.br-fps { position: absolute; top: 2px; right: 4px; z-index: 11; font-size: .7rem; font-weight: 800; font-variant-numeric: tabular-nums;
  color: #34d399; background: rgba(0,0,0,.55); border-radius: 7px; padding: 2px 6px; pointer-events: none; }
.br-fps.warn { color: #fbbf24; }
.br-fps.bad { color: #f87171; }
.br-fps-sum { text-align: center; font-size: .72rem; color: rgba(255,255,255,.72); font-variant-numeric: tabular-nums;
  border-top: 1px solid rgba(255,255,255,.15); padding-top: 7px; margin-top: 2px; }
.br-fps-sum b { color: #fde68a; }
.br-fps-sum b.bad { color: #f87171; }

.br-side { display: flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 800; color: rgba(255,255,255,.8); padding: 0 2px; }
.br-side .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
.dot.foe { background: #f87171; }
.dot.me { background: #34d399; }
.me-label { margin-top: 2px; }

.br-team { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
/* ไม่ตั้ง will-change ถาวร — melee lunge วิ่งผ่าน fx.lunge (WAAPI el.animate ตรง ไม่ใช่ CSS transition)
   browser promote เฉพาะช่วง animation รัน แล้ว release เอง (fill:none คืน layer ทันทีที่จบ) — ไม่มี transition: transform บน .br-unit แล้ว
   เดิม promote ถาวรทั้ง 8 การ์ด = layer เปล่าค้างตลอด → WebKit thrash */
.br-unit { position: relative; aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: rgba(255,255,255,.06); border: 2px solid transparent; border-radius: 16px; transition: border-color .15s; cursor: pointer; }
.br-unit.foe { border-color: rgba(248,113,113,.35); }
.br-unit.me  { border-color: rgba(52,211,153,.4); }
.br-face { font-size: 2rem; line-height: 1; }
.br-el { position: absolute; top: 3px; left: 3px; font-size: .8rem; background: rgba(0,0,0,.45); border-radius: 8px; padding: 1px 3px; line-height: 1; }
/* Phase 2b: ตัด card lift/shake/glow (::after) ทิ้ง — ไฮไลต์เหลือแค่ border-color (ถูก, ไม่ re-raster)
   windup/acting เดิม telegraph ย้ายไป fx.ring (brfx-ring, plain DOM/WAAPI นอก Vue reactivity) แล้ว */
.br-unit.acting, .br-unit.windup { border-color: #fde68a; }
.br-unit.flash { border-color: #f87171; }
.br-unit.dead { opacity: .25; filter: grayscale(1); }

.br-hp { position: relative; width: 84%; height: 7px; background: rgba(0,0,0,.35); border-radius: 999px; overflow: hidden; }
/* เลือด: scaleX (composite) แทน transition width (layout ทุกเฟรม) — origin ซ้าย · promote เฉพาะตอน transition รัน (ไม่ตั้ง will-change ถาวร) */
.br-hp-fill { position: relative; width: 100%; height: 100%; background: #ef4444; border-radius: 999px; transform-origin: left center; transition: transform .1s linear; }
.br-hp-fill.mine { background: #34d399; }
/* หลอดผี: อยู่ใต้หลอดจริง หดตามหลัง → ช่องขาวที่โผล่ = ดาเมจที่เพิ่งกิน */
.br-hp-ghost { position: absolute; inset: 0; background: #fff; opacity: .75; border-radius: 999px;
  transform-origin: left center; transition: transform .45s ease-out .16s; }
.br-tick { position: absolute; top: 0; width: 1px; height: 100%; background: rgba(255,255,255,.55); }
.br-stats { display: flex; justify-content: space-between; align-items: center; gap: 3px; width: 88%; margin-top: 3px; }
.br-atk, .br-hpn { font-size: .72rem; font-weight: 800; color: #fff; line-height: 1; padding: 2px 6px; border-radius: 999px; min-width: 18px; text-align: center; }
.br-atk { background: #f59e0b; }       /* ATK = amber (Hearthstone-ish) */
.br-hpn.foe { background: #ef4444; }    /* HP ศัตรู = แดง */
.br-hpn.me { background: #16a34a; }     /* HP ทีมคุณ = เขียว */

/* pop/call/puff/proj (เลขดาเมจ, callout ธาตุ, 💀, projectile) ย้ายไป fx pool (.brfx- ท้ายไฟล์ ไม่ scoped) แล้ว —
   CSS เดิม (br-pop, br-call, br-puff, br-proj และตัวแปรย่อย) + keyframes br-pop-rise, br-rise, br-fly ตัดทิ้ง (ไม่มี markup ใช้แล้ว) */

.br-vs { text-align: center; color: rgba(255,255,255,.85); font-weight: 800; font-size: .82rem; letter-spacing: .04em; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 3px 0; }

.br-ctrl { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.br-btn { border: 2px solid #fff; background: rgba(255,255,255,.14); color: #fff; border-radius: 12px; padding: 10px 22px; font-family: inherit; font-weight: 800; cursor: pointer; transition: background .12s; }
.br-btn:active { background: rgba(255,255,255,.28); }
.br-btn.sm { padding: 9px 14px; font-size: .82rem; }

/* ป้ายบอกสถานะเร่ง — เกาะมุมบนซ้ายของกล่อง ไม่บังสนาม */
.br-ff { position: absolute; top: 2px; left: 4px; z-index: 11; font-size: .72rem; font-weight: 800;
  color: #fde68a; background: rgba(0,0,0,.55); border-radius: 7px; padding: 2px 7px; pointer-events: none; }
.br-hold-hint { position: absolute; left: 50%; transform: translateX(-50%); bottom: 46px; z-index: 11;
  font-size: .72rem; font-weight: 700; color: rgba(255,255,255,.75); background: rgba(0,0,0,.45);
  border-radius: 999px; padding: 4px 10px; pointer-events: none; animation: br-hint-in .2s ease; }
@keyframes br-hint-in { from { opacity: 0 } to { opacity: 1 } }

.br-result { font-size: 1.2rem; font-weight: 800; color: #fff; }
.br-result.win { color: #34d399; }

.br-inspect { position: fixed; inset: 0; z-index: 430; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
.br-card { background: #1e293b; color: #fff; border: 2px solid #fff; border-radius: 18px; padding: 16px 18px; width: 250px; display: flex; flex-direction: column; gap: 7px; }
.br-card-emoji { font-size: 2.8rem; text-align: center; }
.br-card-name { text-align: center; font-weight: 800; font-size: 1.1rem; margin-bottom: 4px; }
.br-card-row, .br-card-pass { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; }
.br-card-row span, .br-card-pass span { color: rgba(255,255,255,.6); }
.br-card-pass { border-top: 1px solid rgba(255,255,255,.15); margin-top: 4px; padding-top: 7px; }
.br-card .br-btn { margin-top: 10px; }

.br-intro { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.br-intro-txt { font-weight: 900; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,.6); letter-spacing: .05em; }
.br-intro-txt.ready { font-size: 2.2rem; animation: br-ready .7s ease; }
.br-intro-txt.go { font-size: 3.4rem; color: #fde68a; animation: br-go .4s ease; }
@keyframes br-ready { from { opacity: 0; transform: scale(.7) } to { opacity: 1; transform: scale(1) } }
@keyframes br-go { from { opacity: 0; transform: scale(1.6) } to { opacity: 1; transform: scale(1) } }

.br-reward { text-align: center; color: #fde68a; font-weight: 800; font-size: .8rem; }
.br-sum-team { background: rgba(255,255,255,.06); border-radius: 12px; padding: 8px; }
.br-sum-head { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,.8); font-weight: 800; font-size: .72rem; margin-bottom: 6px; }
.br-sum-head .dot { width: 8px; height: 8px; border-radius: 999px; }
.br-sum-row { position: relative; display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 9px; border: 2px solid transparent; }
.br-sum-row.dead { opacity: .45; }
.br-sum-row.mvp.win { border-color: #fbbf24; background: rgba(251,191,36,.12); }
.br-sum-row.mvp:not(.win) { border-color: #c084fc; background: rgba(192,132,252,.12); }
.br-mvp { position: absolute; top: -8px; left: 8px; font-size: .7rem; font-weight: 900; color: #1e293b; background: #fbbf24; padding: 1px 5px; border-radius: 999px; }
.br-sum-row.mvp:not(.win) .br-mvp { background: #c084fc; color: #fff; }
.br-sum-face { font-size: 1.3rem; }
.br-sum-dmg { font-size: .7rem; font-weight: 800; color: #fde68a; display: inline-flex; align-items: center; gap: 2px; }
.br-sum-dmg.taken { color: #fca5a5; margin-left: auto; }

/* modal สรุปผล — ทับสนามที่มืดลง เลื่อนในตัวเองได้ ไม่โดน bottom-nav/safe-area บัง */
.br-result-ov { position: fixed; inset: 0; z-index: 425; background: rgba(15, 23, 42, .72);
  display: flex; align-items: center; justify-content: center;
  padding: 16px; padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
.br-modal { width: 100%; max-width: 380px; background: #1e293b; border: 2px solid rgba(255,255,255,.25);
  border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 8px;
  max-height: calc(100dvh - 72px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  animation: br-modal-in .25s ease; }
.br-modal .br-result { text-align: center; }
@keyframes br-modal-in { from { opacity: 0; transform: scale(.92) translateY(10px) } to { opacity: 1; transform: none } }
.br-modal-btns { display: flex; gap: 8px; justify-content: center; margin-top: 4px; }
/* แถบปุ่มลอยตอน peek สนาม (ดูสรุป + ปิด) — เกาะล่างกลาง เหนือ safe-area */
.br-peek-bar { position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 424; display: flex; gap: 8px; }
.br-peek-btn { background: #4f46e5; border-color: #fff; box-shadow: 0 6px 20px rgba(0, 0, 0, .45); }

/* reduced-motion: คงจังหวะ 4 ชั้น ขนาดเลข และ hitstop ไว้ครบ — ตัดเฉพาะของที่เคลื่อนไหว
   หลอดผีไม่แตะที่นี่โดยตั้งใจ — มัน "ไล่ตามหลัง" ด้วยแค่การ transition แถบบางๆ ไม่ถึง 0.5 วิ
   ไม่ใช่การเคลื่อนไหวแบบที่ prefers-reduced-motion กันไว้ (จอสั่น/หมุน/พุ่งข้ามจอ) แถมยังบอกดาเมจ
   ที่เพิ่งกิน — ตัดออกจะเสียข้อมูล ไม่ใช่แค่ลดความหวือหวา จึงปล่อยให้ทำงานปกติทั้งสอง mode */
@media (prefers-reduced-motion: reduce) {
  .br-intro-txt.ready, .br-intro-txt.go { animation: none; }
  .br-modal { animation: none; }
  .br-hold-hint { animation: none; }
}
</style>

<style>
/* FX pool styles — ไม่ scoped (element สร้าง imperative ไม่มี data-v-*) · namespace .brfx-* กันชน global */
.br-fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.brfx { position: absolute; left: 0; top: 0; will-change: transform; }
.brfx-call { font-weight: 800; font-size: .7rem; white-space: nowrap; padding: 2px 6px; border-radius: 7px; }
.brfx-call.super { background: #ef4444; color: #fff; }
.brfx-call.weak { background: rgba(203,213,225,.95); color: #334155; }
.brfx-puff { width: 1.2rem; height: 1.2rem; }
.brfx-burst { width: 2rem; height: 2rem; }
.brfx-proj { width: 1.4rem; height: 1.4rem; }
.brfx-dash { width: 2rem; height: 2rem; }
.brfx-ring { width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 18px; }
.brfx-ring.windup { box-shadow: 0 0 0 3px #fde68a, 0 0 18px 4px rgba(253,230,138,.55); }
.brfx-ring.acting { box-shadow: 0 0 0 3px #fde68a, 0 6px 16px rgba(0,0,0,.4); }

/* ยุคเดิม (call site ที่ยังไม่ส่ง tier — battleFx.js ไม่แปะ tier class เลยเมื่อ tier undefined แล้ว
   ตกลงมาที่กฎกลุ่มนี้ตรงๆ) — Task 4 ส่ง tier ครบทุกจุดเรียกแล้วค่อยลบทิ้งได้ */
.brfx-pop { font-weight: 900; font-size: 1.5rem; color: #fecaca; -webkit-text-stroke: 3px rgba(15,23,42,.85); paint-order: stroke fill; white-space: nowrap; }
.brfx-pop.crit { color: #fbbf24; font-size: 2rem; }
.brfx-pop.weak { color: #cbd5e1; font-size: 1.1rem; }
.brfx-pop.super { color: #fca5a5; }

/* ชั้น = เจ้าของขนาด — นี่คือช่องทางหลักที่ผู้เล่นอ่านน้ำหนักของหมัดออกขณะดูเร็วๆ
   มาทีหลังด้วย specificity เท่ากัน (สองคลาสเท่ากับ .crit/.weak ด้านบน) จึงชนะเรื่องขนาดด้วยลำดับประกาศ
   ส่วนสีปล่อยให้ crit/super/weak คุมต่อ (ไม่แตะ color ในกลุ่มนี้เลย) */
.brfx-pop.tier-chip   { font-size: .9rem; }
.brfx-pop.tier-solid  { font-size: 1.15rem; }
.brfx-pop.tier-heavy  { font-size: 1.7rem; }
.brfx-pop.tier-finish { font-size: 2.3rem; }

.brfx-call.survive { background: #34d399; color: #06371f; }

.brfx-jab { width: 1.1rem; height: 1.1rem; }

/* วงแหวนโซนอันตราย — เต้นด้วย opacity ล้วนบน pool element ที่ promote ถาวรแล้ว */
.brfx-danger {
  width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 18px;
  box-shadow: 0 0 0 3px #ef4444, 0 0 16px 3px rgba(239, 68, 68, .5);
}
</style>
