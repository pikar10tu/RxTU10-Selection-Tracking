<!-- BattleReplay v2 — event-driven (dispatch ตาม event.t) · melee/ranged · ป้ายสาย/crit/ตาย ·
     UI: ป้ายฝั่ง + badge สาย + กรอบสีแยกข้าง = ดูรู้เรื่องว่าใครฝั่งไหน/ตีใคร/แพ้ทางมั้ย
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
      <!-- ป้ายบอกว่ากำลังดูค่าชุดไหนอยู่ — โผล่เฉพาะไฟต์ทดสอบในห้องแล็บ (fpsMeter/?fps=1)
           เทียบท่าชน 4 แบบติดกันแล้วจำไม่ได้ว่ากำลังดูอันไหน = เทสเสียเปล่าทั้งรอบ -->
      <div v-if="showFps" class="br-lab-tag">{{ labTag }}</div>
      <div v-if="showFps" class="br-fps" :class="{ bad: fpsWorst > 33, warn: fpsWorst > fpsDropAt && fpsWorst <= 33 }">{{ fpsWorst }}ms</div>

      <div class="br-side foe-label"><i class="dot foe"></i> ศัตรู</div>
      <div class="br-team">
        <div v-for="(p, i) in data.botTeam" :key="'B'+i" :ref="el => setEl('B'+i, el)"
             class="br-unit foe" @click="inspect('B'+i)">
          <span class="br-el"><Emoji :char="elEmoji(p)" /></span>
          <span v-if="skillIcon(p)" class="br-skill-dot"><Emoji :char="skillIcon(p)" /></span>
          <span v-if="statusOf('B'+i).length" class="br-status">
            <b v-for="st in statusOf('B'+i)" :key="st.key" :class="{ dbf: !st.buff }"><Emoji :char="st.icon" /></b>
          </span>
          <span v-if="chipOn['B'+i]" class="br-chip" :class="{ out: chipOn['B'+i].out }">
            <Emoji :char="chipOn['B'+i].icon" /> {{ chipOn['B'+i].name }}
          </span>
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
          <span v-if="skillIcon(p)" class="br-skill-dot"><Emoji :char="skillIcon(p)" /></span>
          <span v-if="statusOf('A'+i).length" class="br-status">
            <b v-for="st in statusOf('A'+i)" :key="st.key" :class="{ dbf: !st.buff }"><Emoji :char="st.icon" /></b>
          </span>
          <span v-if="chipOn['A'+i]" class="br-chip" :class="{ out: chipOn['A'+i].out }">
            <Emoji :char="chipOn['A'+i].icon" /> {{ chipOn['A'+i].name }}
          </span>
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

      <!-- สปอตไลต์สกิล — หรี่ฉากแล้วชูแบนเนอร์ให้อ่านก่อน ผลค่อยลงทีหลัง
           🚫 ห้ามใช้ backdrop-filter/blur ตรงนี้เด็ดขาด — เป็นตัวฆ่าเฟรมบน iOS Safari (ดูเคสกระตุก v3)
           อยู่ "ใต้" fx layer เพื่อให้เลข/ประกายของผลที่ลงตามมาไม่ถูกฉากหรี่กลบ -->
      <div v-if="spot" class="br-spot" :class="{ out: spotOut }" :style="spotStyle" aria-hidden="true">
        <div class="br-spot-dim"></div>
        <div class="br-spot-card">
          <div class="br-spot-top">
            <span class="br-spot-icon"><Emoji :char="spot.icon" /></span>
            <span class="br-spot-name">{{ spot.name }}</span>
          </div>
          <div v-if="spot.desc" class="br-spot-desc">{{ spot.desc }}</div>
        </div>
      </div>

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

        <!-- ป้ายตรงนี้ต้องตรงกับสิ่งที่ตัวนับ "นับจริง": เกณฑ์สะดุดคำนวณจากคาบเฟรมของจอเครื่องนี้ ไม่ใช่ 60fps ตายตัว
             และทุกตัวเลขหยุดนิ่งตั้งแต่ไฟต์จบ (stopFps snapshot) — ไม่ใช่ค่าที่ยังวิ่งอยู่ตอนกำลังอ่าน -->
        <div v-if="showFps" class="br-fps-sum">
          เฟรมแย่สุด <b>{{ Math.round(fpsPeak) }}ms</b> ·
          สะดุด (ช้ากว่า {{ Math.round(fpsDropAt) }}ms) <b>{{ fpsDrop }}</b> เฟรม ·
          ต่ำกว่า 30fps <b :class="{ bad: fpsOver33 > 0 }">{{ fpsOver33 }}</b> เฟรม
          <div class="br-fps-note">
            จอเครื่องนี้ ~{{ fpsBase ? Math.round(fpsBase) : '—' }}ms/เฟรม · นับเฉพาะช่วงที่ไฟต์กำลังเล่น
          </div>
        </div>

        <div class="br-modal-btns">
          <button class="br-btn sm" @click="resultOpen = false"><Emoji char="👀" /> ดูสนาม</button>
          <button class="br-btn" @click="$emit('close')">ปิด</button>
        </div>
      </div>
    </div>

    <!-- inspect popover — pause + ดูสเตตัส combat จริง + ช่อง passive (รอบนี้ยังว่าง '—') -->
    <div v-if="inspectUid && insp" class="br-inspect" @click.self="closeInspect">
      <div class="br-card">
        <div class="br-card-emoji"><Emoji :char="insp.def.emoji" /></div>
        <div class="br-card-name">{{ insp.def.name }}</div>
        <div class="br-card-row"><span>สาย</span><b><Emoji :char="insp.elEmoji" /> {{ insp.elName }}</b></div>
        <div class="br-card-row"><span>ระดับ</span><b>{{ rarityLabel(insp.def.rarity) }} · เกรด {{ GRADE_LABELS[Math.min(5, Math.max(0, insp.grade || 0))] }}</b></div>
        <div class="br-card-row"><span>พลังโจมตี</span><b>{{ insp.atk }}</b></div>
        <div class="br-card-row"><span>พลังชีวิต</span><b>{{ insp.hpNow }} / {{ insp.hpMax }}</b></div>
        <div class="br-card-pass"><span>ทักษะเฉพาะ</span><b>{{ insp.passive ? insp.passive.name : 'ตัวนี้ยังไม่มี' }}</b></div>
        <!-- เดิมโชว์แค่ชื่อ เปิดมาก็ยังไม่รู้อยู่ดีว่าสกิลทำอะไร — passiveText() เติมเลขจริงของขั้นให้แล้ว -->
        <div v-if="insp.passive" class="br-card-passdesc">{{ passiveText(insp.passive) }}</div>
        <button class="br-btn sm" @click="closeInspect">ปิด</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { useEscapeKey } from '../../composables/useEscapeKey.js'
import Emoji from '../shared/Emoji.vue'
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { getPetDef, atkStyleOf, projectileOf, passiveOf, sparkOf, ELEMENTS, EL_NAME, GRADE_LABELS } from '../../data/index.js'
import {
  passiveText, STATUS_ICON, STATUS_TEXT, STATUS_MAX,
  TEAM_AURA_EFFECTS, FOE_AURA_EFFECTS, SELF_STATUS_EFFECTS,
} from '../../data/petPassives.js'
import { RARITY } from '../../data/index.js'
import { buildCombatant } from '../../data/battle.js'
import { computeBattleSummary } from '../../utils/battleSummary.js'
import { fluentFile } from '../../utils/emoji.js'
import { createBattleFx } from '../../utils/battleFx.js'
import { buildBeats, scaleTiming, BEAT } from '../../utils/battleBeats.js'
import { buildBeatsLegacy, legacyImpact } from '../../utils/battleBeatsLegacy.js'
import { readPrefs, fxFlags, paceMult, FX_LABEL, PACE_LABEL } from '../../utils/battleReplayPrefs.js'
import { createFrameMeter, FALLBACK_BASE, DROP_RATIO } from '../../utils/frameMeter.js'
import { prefersReducedMotion } from '../../utils/motionPref.js'

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
  // แตะการ์ด/ปุ่ม = คนละเจตนา (เปิด inspect / พัก) · รวม .br-ctrl ด้วย เพราะ padding รอบปุ่มพักไม่ใช่ตัวปุ่ม
  // แต่คนเล็งจะกดปุ่มพัก แล้วพลาดไปโดนขอบ → กลายเป็นเริ่มกดค้างเร่งแทน
  if (e.target.closest && e.target.closest('.br-unit, .br-btn, .br-ctrl')) return
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
let pausedBeforeInspect = false  // คนกด ⏸️ เองอยู่ก่อนแล้วหรือเปล่า — ปิด inspect แล้วต้องคืนสถานะนั้น ไม่ใช่เล่นต่อดื้อ ๆ
// สปอตไลต์สกิล — แบนเนอร์ที่ขึ้นก่อน แล้วผลค่อยลง (ชั้น spotlight ของ battleBeats)
const spot = ref(null)           // { icon, name, desc } · null = ไม่มีสปอตไลต์อยู่
const spotOut = ref(false)       // true = กำลังเลื่อนออก (เฟสผลลง)
// ความยาวอนิเมชันผูกกับ beat.timing จริง (ไม่ใช่ค่าคงที่ใน CSS) — ไม่งั้นพอ pace ไม่ใช่ ×1
// แบนเนอร์จะยังเลื่อนเข้าไม่เสร็จตอนช่วงค้างอ่านหมดแล้ว
const spotStyle = ref({})
const introPhase = ref(null)   // 'ready' | 'go' | null (null = เริ่มเล่น log แล้ว)
const resultOpen = ref(false)
useEscapeKey(resultOpen, () => { resultOpen.value = false })    // modal สรุปโชว์อยู่
useEscapeKey(() => !!inspectUid.value, () => closeInspect())     // ปิด inspect แล้วไฟต์ต้องเดินต่อเหมือนกดปุ่มปิด
const resultReady = ref(false)   // จบไฟต์+ผ่านจังหวะรอแล้ว — ใช้โชว์ปุ่มลอย "ดูสรุป" ตอน peek
let resultTimer = null
let introTimer = null
let gen = 0                      // generation guard — reset/skip เพิ่มค่า เพื่อให้ promise chain ค้างจาก wait() รู้ตัวว่าโดนยกเลิก
let timer = null
let stepGen = -1                 // gen ของ beat chain ที่กำลังวิ่ง (-1 = ว่าง) — กันเปิดสายซ้อน ดู step()
                                 // ⚠️ ประกาศไว้บนสุดโดยตั้งใจ: reset() แตะตัวนี้ และ reset() ถูกเรียกจาก watch(immediate) ด้านล่าง
const pendingTimers = new Set()  // เก็บ timer id จาก wait() ทั้งหมด — clear ตอน reset/skip/unmount กัน promise chain ค้างมาเขียน state เก่าทับ
const pendingRafs = new Set()    // เช่นเดียวกันแต่เป็น rAF (ใช้เลื่อนอนิเมชันการ์ดไป 1 เฟรม ใน applyImpact)
function wait(ms) { return new Promise(r => { const t = setTimeout(r, ms); pendingTimers.add(t) }) }
// setTimeout ที่ยกเลิกได้แบบเดียวกับ wait() — สำหรับงานที่ไม่ต้อง await (ถอดคลาส flash)
function later(fn, ms) { const t = setTimeout(() => { pendingTimers.delete(t); fn() }, ms); pendingTimers.add(t); return t }
// รอให้เพนต์ของเฟรมปัจจุบันลงจอก่อนค่อยทำงาน (เรียกจากใน task ของ timer → callback ไปตกเฟรมถัดไป)
function nextFrame(fn) { const r = requestAnimationFrame(() => { pendingRafs.delete(r); fn() }); pendingRafs.add(r); return r }
function clearPending() {
  pendingTimers.forEach(clearTimeout); pendingTimers.clear()
  pendingRafs.forEach(cancelAnimationFrame); pendingRafs.clear()
}
let maxHp = {}, unitAtk = {}     // uid → maxHp / atk (static ต่อ unit จาก buildCombatant)
const els = {}                   // uid → DOM el (วัดตำแหน่ง melee/ranged)
function setEl(uid, el) { if (el) els[uid] = el }

// ── ไฮไลต์ (Phase 2b): classList ตรงบน els[uid] แทน reactive ref (acting/winding/flashing) ──
// ตัด Vue reactivity ออกจาก path ที่วิ่งทุกหมัด — toggle class ตรงถูกกว่า set ref แล้วรอ re-render
function highlight(uid, cls, on = true) { const el = els[uid]; if (el) el.classList[on ? 'add' : 'remove'](cls) }
function clearHighlights() { Object.values(els).forEach(el => el && el.classList.remove('windup', 'acting', 'flash', 'spotlit')) }
// dead ก็ imperative classList เหมือนกัน (ไม่ใช่ reactive :class แล้ว) — กัน Vue re-render เขียนทับ flash/acting/windup ตอน hp เปลี่ยน (Task 9 finding #1)
function setDead(uid) { highlight(uid, 'dead', (hp.value[uid] ?? 100) <= 0) }

// ── fx pool (Phase 2a): pops/callouts/koPuff/projectile ออกจาก Vue reactivity → plain WAAPI pool ──
const fxLayerEl = ref(null)      // ref บน .br-fx-layer
const boxRef = ref(null)         // ref บน .br-box (จุดอ้างอิงพิกัด)
let fx = null
let attachedLayer = null           // .br-fx-layer element ที่ fx ผูกอยู่ตอนนี้ — เทียบกันจับ layer remount (overlay v-if สร้าง DOM ใหม่ทุกไฟต์)
function ensureFx() {
  if (!boxRef.value || !fxLayerEl.value) return
  if (!fx || attachedLayer !== fxLayerEl.value) {
    if (fx) fx.destroy()                                  // layer เปลี่ยน (ไฟต์ใหม่ remount .br-fx-layer) → ทิ้งของเก่า (listener/pool) ก่อนสร้างใหม่
    fx = createBattleFx()
    fx.attach({ boxEl: boxRef.value, layerEl: fxLayerEl.value, getEl: uid => els[uid] || null })
    attachedLayer = fxLayerEl.value
  }
  // ⚠️ ต้องอยู่นอก if — ยิงไฟต์ใหม่ "โดยไม่ปิด overlay" (ปุ่มยิงซ้ำในห้องแล็บ) จะได้ layer เดิม
  // ของเดิม set flag เฉพาะตอน attach ครั้งแรก → เปลี่ยน preset แล้วกดยิงซ้ำจะยังเล่นด้วยค่าเก่าทั้งไฟต์
  fx.setFlags(fxFlags(prefs.value.fx))
}

// ── การ์ดสไตล์ Hearthstone: ATK/HP เป็นเลข + หลอดเลือดขีดทุก 50 HP ──
function atkOf(uid) { return unitAtk[uid] ?? 0 }
function curHp(uid) { return Math.round((maxHp[uid] || 0) * (hp.value[uid] ?? 100) / 100) }
function ticksFor(uid) {
  const max = maxHp[uid] || 1, out = []
  for (let h = 50; h < max; h += 50) out.push((h / max) * 100)  // % ตำแหน่งขีดทุก 50 HP
  return out
}

// ── ป้ายสถานะบนการ์ด (สเปก §5) ──
//
// 🔒 กฎเหล็กข้อเดียวของฟีเจอร์นี้: **ห้ามแก้ป้ายขณะการ์ดมีอนิเมชันวิ่งอยู่**
//    (เปลี่ยน paint กลางอากาศ = re-raster ทั้งการ์ด — ข้อบังคับ v3)
//    ทำได้เพราะ aura ทั้ง 5 กับ onHit ทั้ง 6 "ไม่เคยเปลี่ยน" ระหว่างไฟต์เลย
//    ⇒ computed ตัวนี้ขึ้นกับ props.data อย่างเดียว = คำนวณตอนไฟต์เริ่ม แล้วนิ่งยาว
//    (ตัวที่เปลี่ยนได้ — 🧿 ใช้แล้วหมด, ⬆️ สแต็ก — ยังไม่ทำรอบนี้ ดู §5.5 ของสเปก)
//
// ต้นทุน: span static ในการ์ดที่ถูก promote เป็น layer อยู่แล้ว ⇒ 0 layer เพิ่ม 0 ต้นทุนต่อเฟรม
// (แพทเทิร์นเดียวกับ .br-skill-dot ที่ใช้อยู่จริงในโปรดักชันแล้ว)
const statusMap = computed(() => {
  const out = {}
  const teams = { A: props.data?.playerTeam || [], B: props.data?.botTeam || [] }
  const auraOf = (team) => {
    const mine = new Set(), theirs = new Set()
    for (const p of team) {
      const eff = passiveOf(getPetDef(p?.id))?.effect
      if (!eff) continue
      if (TEAM_AURA_EFFECTS.has(eff)) mine.add(eff)
      else if (FOE_AURA_EFFECTS.has(eff)) theirs.add(eff)
    }
    return { mine, theirs }
  }
  const a = auraOf(teams.A), b = auraOf(teams.B)
  for (const side of ['A', 'B']) {
    const own = side === 'A' ? a : b
    const foe = side === 'A' ? b : a
    teams[side].forEach((p, i) => {
      const list = [], seen = new Set()
      const push = (eff, buff) => {
        if (!eff || seen.has(eff) || !STATUS_ICON[eff]) return
        seen.add(eff)
        list.push({ key: eff, icon: STATUS_ICON[eff], label: STATUS_TEXT[eff] || '', buff })
      }
      const selfEff = passiveOf(getPetDef(p?.id))?.effect
      if (selfEff && SELF_STATUS_EFFECTS.has(selfEff)) push(selfEff, true)
      for (const eff of own.mine) push(eff, true)      // บัฟจากทีมตัวเอง (รวมของตัวเองด้วย)
      for (const eff of foe.theirs) push(eff, false)   // ดีบัฟที่ศัตรูแผ่ใส่
      out[side + i] = list.slice(0, STATUS_MAX)
    })
  }
  return out
})
function statusOf(uid) { return statusMap.value[uid] || [] }

const rawLog = computed(() => props.data?.result?.log || [])
// ⚠️ maxHp เป็น plain object ที่ buildMax() เขียนทับ ไม่ใช่ ref — beats จึงไม่ re-compute เองเมื่อ maxHp เปลี่ยน
// แต่ปลอดภัยเพราะ buildMax(d) ถูกเรียกก่อน reset() ในตัว watcher เดียวกันเสมอ และ rawLog เปลี่ยนพร้อมกัน (props.data ใหม่ทั้งก้อน) ซึ่ง trigger การ compute ใหม่อยู่แล้ว
// prefs.legacyBeats = สวิตช์ในห้องแล็บ (localStorage เครื่องเดียว) — ดู battleBeatsLegacy.js
const beats = computed(() => (prefs.value.legacyBeats ? buildBeatsLegacy : buildBeats)(rawLog.value, maxHp))
const done = computed(() => idx.value >= beats.value.length)
const summary = computed(() => done.value
  ? computeBattleSummary(rawLog.value, props.data?.playerTeam || [], props.data?.botTeam || [])
  : null)

function buildMax(d) {
  maxHp = {}; unitAtk = {}
  const add = (p, uid) => { const c = buildCombatant(p); maxHp[uid] = Math.round(c.maxHp) || 1; unitAtk[uid] = Math.round(c.atk) }
  ;(d?.botTeam || []).forEach((p, i) => add(p, 'B' + i))
  ;(d?.playerTeam || []).forEach((p, i) => add(p, 'A' + i))
  if (import.meta.env.DEV) warnTeamMismatch(d)
}

// ── กันเคส "ทีมที่วาด ≠ ทีมที่ engine สู้ด้วย" (dev เท่านั้น) ──
// เกิดจริง 24 ส.ค.: useTower อ่าน botTeam (computed ผูกกับ floor) อีกรอบ "หลัง" patchUser ขยับชั้นแล้ว
// → ชนะชั้น 1 (บอท 1 ตัว) แต่จอวาดการ์ดศัตรู 2 ใบของชั้น 2 · log มีแค่ B0 → ตี B0 ตายแล้วจบทันที
// อาการฝั่งผู้เล่นคือ "ศัตรูมีสองตัว ตีตายตัวเดียวเกมจบเลย" ซึ่งอ่านไม่ออกเลยว่าเป็นบั๊กที่ไหน
// เช็คนี้ไม่มีทางเป็น false positive ฝั่ง "log อ้าง uid ที่ไม่มีการ์ด" · ส่วนฝั่ง "การ์ดที่ log ไม่เคยแตะ"
// เป็นได้จริงถ้าไฟต์จบเร็วมากจนสล็อตท้ายไม่ทันออกตี จึงเตือนเฉยๆ ไม่ throw
function warnTeamMismatch(d) {
  const uids = new Set()
  for (const e of (d?.result?.log || [])) {
    if (e?.t !== 'attack') continue
    if (e.attacker) uids.add(e.attacker)
    if (e.target) uids.add(e.target)
  }
  if (!uids.size) return
  const known = new Set(Object.keys(maxHp))
  const ghost = [...uids].filter(u => !known.has(u))
  const idle = [...known].filter(u => !uids.has(u))
  if (ghost.length) console.error('[BattleReplay] log อ้างถึงตัวที่ไม่มีการ์ดวาดไว้:', ghost.join(', '), '— ทีมที่ส่งเข้ามาไม่ใช่ทีมที่ engine สู้ด้วย')
  else if (idle.length) console.warn('[BattleReplay] มีการ์ดที่ไม่เคยปรากฏใน log เลย:', idle.join(', '), '— ปกติได้ถ้าไฟต์จบเร็วมาก แต่ถ้าเป็นฝั่งที่แพ้ทั้งทีม แปลว่าทีมที่วาดผิดตัว')
}

// อุ่น cache+decode asset combat ทั้งหมดก่อนเริ่มเล่น (intro หน่วง ~1.1s) — dash/pop/projectile swap src กลางไฟต์
// ไม่งั้น decoding="sync" ครั้งแรกของแต่ละรูป = บล็อกเฟรม
const preloadedImgs = []
function preloadCombat(d) {
  const chars = new Set(['⚡', '🛡️', '💀', '💥', '✨'])
  for (const p of [...(d?.playerTeam || []), ...(d?.botTeam || [])]) {
    const def = getPetDef(p?.id); if (!def) continue
    if (def.emoji) chars.add(def.emoji)                                  // หน้าเพ็ท (dash sprite)
    const spark = sparkOf(def); if (spark) chars.add(spark)               // ประกายประจำตัวตอนตีโดน
    const pas = passiveOf(def); if (pas?.icon) chars.add(pas.icon)        // ไอคอน passive (ป้าย + sweep)
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
  clearPending()                                                            // ตัด wait()/later()/nextFrame() ที่ค้างอยู่ทั้งหมด (windup/motion/hitstop/flash)
  stepGen = -1                                                              // ไม่มี chain ของ gen ใหม่วิ่งอยู่ (chain เก่าคนละ gen แล้ว ปลดตัวเองไม่ได้ — ดู step())
  introPhase.value = null                                                   // กันค้างตอน replay ใหม่
  Object.values(els).forEach(el => { if (el) { el.style.transform = ''; el.style.transition = ''; el.style.zIndex = '' } })  // ล้าง lunge ค้างจากไฟต์ก่อน (component ถูก mount ค้างไว้ ใช้ซ้ำ)
  clearHighlights()                                                         // ล้างคลาส windup/acting/flash ค้าง
  idx.value = 0; round.value = 1
  paused.value = false; inspectUid.value = null; pausedBeforeInspect = false; clearSpot(); clearChips()
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
  // ตัวที่รอดมาด้วยเลือด ≤25% ไม่เคยถูกสั่งปิดวงแหวน (dangerRing(uid,false) เรียกเฉพาะตอนตาย)
  // → เดิมวงแหวน iterations:Infinity เต้นค้างผ่านหน้าสรุป/ตอน peek ยาวจนกว่าจะ reset() (§5.2 บอกให้ปิดตอนจบไฟต์)
  end() { clearHighlights(); fx?.dangerClearAll() },
  // passive — ชั้นมาจาก battleBeats (spotlight/glance/openGroup/mute) · เวลาเดินในตัว handler เอง
  passive(e) { return applyPassive(e) },
}

/** คำอธิบายสกิลของ event นี้ · ป้าย duo (รางวัลคนเก่ง) ไม่ใช่สกิลประจำตัวใคร → คืนค่าว่าง โชว์แค่ชื่อ */
function passiveDescOf(e) {
  const p = passiveOf(defForUid(e.uid))
  return p && p.name === e.name ? passiveText(p) : ''
}

// ── ประกาศสกิล: "หยุดที่เหตุ ปล่อยผลไหลตาม" (จังหวะที่ user ออกแบบเอง 28 ส.ค.) ──
//
//     0ms  ชิปชื่อสกิลเด้งขึ้นบนการ์ด            ◀ ไฟต์หยุด
//   200ms  ★ ไฟต์เดินต่อทันที — beat ถัดไปเริ่มเงื้อ
//          │ ชิปเริ่มเลือน (CHIP_OUT_MS)        ┐ ทั้งคู่วิ่งทับ beat ถัดไป
//          │ ผลของสกิลลง (เลข +N / ประกาย)      ┘ ไม่ถ่วงเวลาอะไรเลย
//
// 🔑 ตัวที่ทำให้มันไหลได้คือ "ไม่ await ตอน fade" — พอครบ hold แล้ว return ทันที
//
//   skillMoment → หรี่ฉาก + แบนเนอร์ + ผลลงทีหลัง (revive/cheatDeath/saveAlly เท่านั้น)
//   skill       → ครั้งแรกของสกิลนั้นในไฟต์: หยุด SKILL_PAUSE แล้วปล่อยไหล
//   skillQuiet  → ครั้งซ้ำ: ผลอย่างเดียว 0ms (ประกาศชื่อไปแล้วครั้งแรก)
//   openGroup   → ยกแรก ชิปขึ้นพร้อมกันทุกใบ (ตัวท้ายกลุ่มถือเวลาค้างไว้คนเดียว) แล้วจางพร้อมกัน
async function applyPassive(e) {
  if (!e?.uid) return
  const g = gen
  const t = scaleTiming(e, { pace: pace.value, ff: ffActive.value })

  if (e.kind === 'skillMoment') { await spotlightPassive(e, t, g); return }

  const hold = t.windup + t.motion + t.hitstop + t.tail

  if (e.kind === 'openQuiet' || e.kind === 'openGroup') {
    showChip(e.uid, e)                             // ยกแรก: ขึ้นค้างไว้ก่อน ยังไม่เลือน
    openChips.add(e.uid)
    if (hold > 0) {
      await wait(hold); if (g !== gen) return
      for (const uid of openChips) hideChip(uid)   // ตัวท้ายกลุ่มสั่งจางพร้อมกันทั้งชุด
      openChips.clear()
      for (const ev of openEvents) firePassiveFx(ev)
      openEvents.length = 0
    } else {
      openEvents.push(e)                           // ผลของยกแรกลงพร้อมกันตอนกลุ่มจบ
    }
    return
  }

  if (e.kind === 'skill') {
    showChip(e.uid, e)
    if (hold > 0) { await wait(hold); if (g !== gen) return }
    // ★ ไม่ await สองบรรทัดนี้ — ชิปเลือนและผลลง ทับ beat ถัดไปได้เลย
    hideChip(e.uid)
    firePassiveFx(e)
    return
  }

  // skillQuiet (ครั้งซ้ำ) — ผลอย่างเดียว ไม่มีชิป ไม่กินเวลา
  firePassiveFx(e)
}

// ── ชิปชื่อสกิลเกาะบนการ์ด ──
// ⚠️ ใช้ชิปแทนป้ายลอย (fx.banner) เพราะป้ายลอยใช้พูลแค่ 2 ช่อง แล้วถูกยึดไปโผล่ผิดการ์ด
//    (อาการเดียวกับเลขดาเมจที่ user รายงานว่า "ป้ายขึ้นมั่ว") · ชิปผูกกับการ์ดตรงๆ ไม่มีพูลให้ยึด
const chipOn = ref({})            // uid → { name, icon, out }
const openChips = new Set()       // uid ที่ถือชิปยกแรกอยู่ (จางพร้อมกันตอนกลุ่มจบ)
const openEvents = []             // event ยกแรกที่รอลงผลพร้อมกันตอนกลุ่มจบ
const CHIP_OUT_MS = 300

function showChip(uid, e) {
  chipOn.value = { ...chipOn.value, [uid]: { name: e.name || 'ทักษะเฉพาะ', icon: e.icon || '✨', out: false } }
}
function hideChip(uid) {
  const cur = chipOn.value[uid]; if (!cur) return
  chipOn.value = { ...chipOn.value, [uid]: { ...cur, out: true } }
  // ถอดออกจาก DOM หลังอนิเมชันจางจบ — later() ผูกกับ pendingTimers จึงถูกล้างตอน reset เสมอ
  later(() => {
    const now = chipOn.value[uid]
    if (!now || !now.out) return          // มีชิปใหม่ขึ้นมาทับแล้ว อย่าไปลบของใหม่
    const next = { ...chipOn.value }; delete next[uid]
    chipOn.value = next
  }, CHIP_OUT_MS)
}
function clearChips() { chipOn.value = {}; openChips.clear(); openEvents.length = 0 }

function clearSpot(uid) {
  spot.value = null
  spotOut.value = false
  if (uid) highlight(uid, 'spotlit', false)
  else Object.values(els).forEach(el => el && el.classList.remove('spotlit'))
}

/** ไทม์ไลน์สปอตไลต์: หรี่ฉาก+แบนเนอร์เข้า (windup) → ค้างอ่าน (hitstop) → ผลลง+แบนเนอร์ออก (tail) */
async function spotlightPassive(e, t, g) {
  spotStyle.value = {
    '--spot-delay': `${Math.round(t.windup * 0.43)}ms`,
    '--spot-in': `${Math.round(t.windup * 0.57)}ms`,
    '--spot-out': `${Math.round(t.tail) || 1}ms`,
  }
  spot.value = { icon: e.icon || '✨', name: e.name || 'ทักษะเฉพาะ', desc: passiveDescOf(e) }
  spotOut.value = false
  highlight(e.uid, 'spotlit')
  await wait(t.windup + t.motion); if (g !== gen) return clearSpot(e.uid)
  await wait(t.hitstop); if (g !== gen) return clearSpot(e.uid)
  // ── เฟสผล: แบนเนอร์เริ่มเลื่อนออกพร้อมกับที่ผลลงจริง ──
  // ⚠️ หลอดเลือด/เลขเด้ง ต้องอยู่ตรงนี้เท่านั้น ห้ามไปอัปตั้งแต่ต้นฟังก์ชัน
  //    ไม่งั้นเลือดจะขยับตั้งแต่แบนเนอร์ยังไม่ทันขึ้น = คนดูเห็น "ผล" ก่อน "เหตุ" ซึ่งเป็นสิ่งที่ฟีเจอร์นี้ตั้งใจแก้
  spotOut.value = true
  firePassiveFx(e)      // ป้ายเล็กเหนือหัวไม่ต้องแล้ว — แบนเนอร์ใหญ่ทำหน้าที่นั้นไปแล้ว
  await wait(t.tail); if (g !== gen) return clearSpot(e.uid)
  clearSpot(e.uid)
}

// FX ของ passive: ป้ายชื่อเหนือหัว + ประกายตามชนิดผล + ขยับหลอดเลือด
// ⚠️ ห้าม await อะไรในนี้ — ตัวเดินเวลาคือ applyPassive/spotlightPassive
// ป้ายชื่อไม่ได้อยู่ในนี้แล้ว — ชิปบนการ์ด (showChip) ทำหน้าที่นั้นแทน
function firePassiveFx(e) {
  const on = Array.isArray(e.targets) && e.targets.length ? e.targets : [e.uid]

  // ── หลอดเลือด: ฮีล/ฟื้น/รับแทน ทำให้เลือดเปลี่ยนโดยไม่มี attack event
  //    ถ้าไม่อัปเดตตรงนี้ หลอดจะค้างค่าเดิมทั้งที่เลขเด้งขึ้นแล้ว (ผู้เล่นเห็นขัดกันทันที)
  if (typeof e.hpPct === 'number' && on[0]) hp.value = { ...hp.value, [on[0]]: e.hpPct }
  if (e.guardUid && typeof e.guardHpPct === 'number') hp.value = { ...hp.value, [e.guardUid]: e.guardHpPct }
  // เลขเขียว +N ที่ตัวที่ได้รับ — ใช้เลือดจริงที่ฟื้นได้ ไม่ใช่ % ของสูตร
  // ⚠️ อ่าน fxKind (ชนิดผล) ไม่ใช่ kind — kind ของ beat คือ "เวลา" (skill/skillQuiet/openGroup/…)
  //    ทับชนิดผลไปตั้งแต่ f32b519 ⇒ ทั้งบล็อกนี้เงียบสนิท (user: "ตอนฮีล เลขไม่ขึ้น")
  if ((e.fxKind === 'heal' || e.fxKind === 'revive') && e.amount > 0) {
    fx?.pop(on[0], { dmg: e.amount, heal: true, weight: 0.45 })
  }

  switch (e.fxKind) {
    case 'damage':  fx?.sweep(on, e.icon, 60); break        // bahamut สาดไฟใส่ทุกตัว
    case 'cleave':  fx?.sweep(on, e.icon, 45); break        // เขี้ยว/เปลวไฟลงหลายใบในจังหวะเดียว
    case 'heal':    fx?.sweep(on, '✨', 70); break
    case 'guard':   fx?.ring(e.uid, 'windup', 320); break
    case 'revive':  fx?.sweep(on, e.icon, 0); break
    case 'save':    fx?.sweep(on, '🛡️', 0); break
    case 'thorns':  fx?.sweep(on, e.icon, 0); break
    case 'dodge':   fx?.callout(e.uid, 'weak'); break        // ใช้ป้ายเทาเดิม = "ไม่โดน"
    case 'chain':
    case 'buff':    fx?.ring(e.uid, 'windup', 260); break
    case 'aim':     fx?.ring(e.uid, 'windup', 200); break
    case 'aura':    break                                    // ตอนเริ่มไฟต์มีป้ายหลายอันพร้อมกัน ยิงประกายด้วยจะรกและหนัก
    case 'reduce':  break                                    // ป้ายชื่ออย่างเดียวพอ ไม่งั้นรกทุกหมัด
    default: break
  }
}

// เวลามาตรฐานของอนิเมชันการ์ดเป้าตามสเปก (§4 ชั้น 3–4) — postMs ใช้เป็น "เพดาน" ไม่ใช่ตัวค่าเอง
// เหตุที่เคยเอา postMs มาเป็นค่าตรงๆ คือกันอนิเมชันล้นออกนอก beat ตัวเอง ซึ่งเป็นเหตุผลของ "เพดาน" ไม่ใช่ "ค่าแทน"
// ปล่อยตามเดิม heavy ได้ 850ms / finish ได้ 1320ms — บีบ-ดีดกลับยาว 1.3 วิ อ่านเป็น "เนือย" ไม่ใช่ "หนัก"
const SQUASH_MS = 300          // เพดานอนิเมชันการ์ดเป้า (งบจริงมาจาก beat ผ่าน Math.min)
const KO_MS = 520
const FLASH_MS = 250            // อายุสูงสุดของกรอบแดงตอนโดน (เมื่อไม่มีอนิเมชันการ์ดให้ผูกอายุด้วย)
const FRAME_MS = 17             // งบ 1 เฟรมที่เลื่อนอนิเมชันการ์ดออกไป (ดู applyImpact) — ต้องหักจากงบเวลาที่เหลือของ beat

// impact: hp/pop/callout/burst/ko ตอนโดนตี — รับ g เช็ค gen กัน reset ระหว่างพุ่งมาเขียน state เก่าทับ
// t = scaled timing ของ beat นี้ (จาก applyAttack) — postMs = เวลาที่ beat นี้ยังเหลืออยู่หลัง impact
//
// ⚠️ ลำดับสำคัญมาก (สองข้อบังคับที่ต้องเป็นจริงพร้อมกัน):
//   1) หลอดเลือด/เลข/หลอดผี (Vue patch) ต้องลง "ก่อน" อนิเมชันการ์ดเป้าเริ่ม — ไม่งั้น patch + หลอดผี transition 450ms
//      + fx.shake() ที่ขยับ .br-box (บรรพบุรุษร่วม) จะซ้อนอยู่ในอนิเมชันการ์ดเดียวกัน = เฟรมแพงที่สุดของทั้งฟีเจอร์
//      และเกิดทุกหมัด heavy/finish → เลื่อนอนิเมชันการ์ดไป 1 เฟรม (nextFrame) ให้เพนต์ของ patch ลงจอก่อน
//   2) คลาส dead ต้องลง "ก่อน" ko() เริ่ม ไม่ใช่ระหว่างที่มันวิ่ง (ข้อบังคับ v3) — จึงย้ายไปอยู่ต้น nextFrame
//      ติดกับ ko() ในทาสก์เดียวกัน · ใส่เร็วกว่านั้นไม่ได้ เพราะ .dead { opacity:.25 } จะถูกเพนต์ 1 เฟรม
//      แล้วเฟรมแรกของ ko (opacity 1) เด้งกลับ = การ์ดกะพริบ
// เลือดยังหดที่จังหวะ impact เป๊ะเหมือนเดิม เลื่อนแค่อนิเมชันการ์ด ~17ms ซึ่งมองไม่ออก
function applyImpact(beat, g, t) {
  if (g !== gen) return
  const tgtEl = els[beat.target]
  const postMs = Math.round(t.hitstop + t.tail)   // ช่วงหลังโดน = เวลาที่เหลือของ beat นี้
  const cardMs = Math.max(0, postMs - FRAME_MS)   // งบของอนิเมชันการ์ดเป้า (หัก 1 เฟรมที่เลื่อนไป)
  const flashOff = () => { if (g === gen) highlight(beat.target, 'flash', false) }

  // ── 1) paint บนการ์ดเป้า + Vue patch ลงให้ครบก่อน (ยังไม่มีอนิเมชันการ์ดวิ่งตอนนี้) ──
  highlight(beat.target, 'flash')
  hp.value = { ...hp.value, [beat.target]: Math.max(0, Math.round((beat.targetHpAfter / (maxHp[beat.target] || 1)) * 100)) }

  // ── 2) ของที่ไม่ได้แตะการ์ดเป้า ยิงที่จังหวะ impact ตรงๆ (จังหวะที่คนดูรู้สึกว่า "โดน") ──
  //
  // 🔒 switch ที่ทุกกิ่งเขียนครบ ไม่มี else เปล่ารับของที่หลุดมา
  //    ⚠️ ของเดิมเป็น if/else chain ปลายทาง `else { burst(92); shake(8,3) }` แล้ว tier=null
  //       ของหมัดลูก cleave/multiStrike ตกมาที่นั่น ⇒ ได้เอฟเฟกต์ระดับหมัดปิดเกม
  //       **เฉลี่ย 11.5 ครั้ง/ไฟต์ สูงสุด 16** ยิงที่ 0ms รัวติดกัน — นี่คือ "ตีแรงบ้าง" ที่ user เจอ
  //    ถ้าวันหลังเพิ่ม kind ใหม่แล้วลืมเขียนกิ่ง จะได้ default (เงียบ) ซึ่งปลอดภัย ไม่ใช่ดังสุด
  const spark = sparkOf(defForUid(beat.attacker))
  const w = beat.weight ?? 0
  if (beat.legacyTier) {                          // โหมดเทียบจังหวะเดิม — ความดังตามชั้น
    const L = legacyImpact(beat.legacyTier)
    if (L.burst) fx?.burst(beat.target, L.burst, spark)
    if (L.shake) fx?.shake(L.shake)
  } else switch (beat.kind) {
    case 'finish':
      fx?.burst(beat.target, 92, spark); fx?.shake('finish'); break
    case 'ko':
      fx?.burst(beat.target, 66, spark); fx?.shake('ko'); break
    case 'hit':
      // ขนาดดาวไล่ต่อเนื่องตามความแรงจริง — ไม่มีขั้นบันไดตามชั้นอีกแล้ว · ไม่สั่นจอ
      fx?.burst(beat.target, Math.round(26 + w * 42), spark); break
    case 'sub':
      // หมัดลูกอยู่ในหมัดหลักที่กำลังพุ่งอยู่ — ประกายเล็กพอ ห้ามสั่นจอเด็ดขาด
      fx?.burst(beat.target, Math.round(22 + w * 24), spark); break
    default:
      break
  }

  fx?.pop(beat.target, { dmg: beat.dmg, crit: beat.crit, eff: beat.eff, weight: w })
  if (beat.eff === 'super' || beat.eff === 'weak') fx?.callout(beat.target, beat.eff)
  if (beat.kill) fx?.dangerRing(beat.target, false)
  else {
    if (beat.danger) fx?.dangerRing(beat.target, true)
    if (beat.survive) fx?.callout(beat.target, 'survive')
  }

  // ── 3) อนิเมชันการ์ดเป้า ──
  // beat.kill ตัด squashTarget ทิ้งเสมอ เพราะ ko() ครอบการ์ดใบเดียวกันแล้ว
  // — ยิง animate() 2 ครั้งบนการ์ดใบเดียวกันผิดกฎ "1 หมัด 1 animation/การ์ด" (ข้อบังคับ v3)
  // หมัดลูก (sub) ไม่มีงบเวลาของตัวเอง (cardMs = 0) → ไม่ต้องแตะการ์ดเลย
  const wantsCardAnim = beat.kill || (beat.kind !== 'sub' && (fx ? fx.targetReacts(beat.kind) : true))
  if (!wantsCardAnim) {
    setDead(beat.target)                        // ไม่มีอนิเมชันการ์ดตามมา = ใส่ได้เลย (ปกติ no-op เพราะยังไม่ตาย)
    later(flashOff, Math.min(FLASH_MS, Math.max(postMs, 120)))
    return
  }
  const myIdx = idx.value                       // beat ที่กำลังเล่นอยู่ตอนนี้ (idx ขยับตอนจบ beat เท่านั้น)
  nextFrame(() => {
    if (g !== gen) return                       // reset/ไฟต์ใหม่แทรกระหว่างรอเฟรม
    setDead(beat.target)                        // ต้องอยู่ตรงนี้เท่านั้น — ก่อน animate() และไม่เร็วกว่านั้น
    // ⚠️ rAF หยุดสนิทเมื่อแท็บถูกพับไปหลัง แต่ setTimeout ยังเดิน → กลับมาแล้วเฟรมนี้อาจมาช้าไปหลาย beat
    if (idx.value !== myIdx) { flashOff(); return }
    let targetAnim = null                       // null = ไม่มีอนิเมชันจริง (preset ปิด/ไม่มี el)
    if (beat.kill) targetAnim = fx?.ko(beat.target, tgtEl, Math.min(KO_MS, cardMs))
    else targetAnim = fx?.squashTarget(tgtEl, beat.kind, w, Math.min(SQUASH_MS, cardMs), beat.attacker, beat.target)
    if (targetAnim) targetAnim.then(flashOff)
    else later(flashOff, Math.min(FLASH_MS, Math.max(cardMs, 120)))
  })
}

// windup → motion → impact → hitstop → tail ตาม beat.timing
// การ์ดพุ่ง = 1 animation ครอบทั้ง beat (ยิงแล้วไม่ await — เราเดินเวลาด้วย wait() แยก) ตามข้อบังคับ v3
async function applyAttack(beat) {
  const g = gen
  const t = scaleTiming(beat, { pace: pace.value, ff: ffActive.value })
  const def = defForUid(beat.attacker)
  // ⚠️ ตอนนี้ atkStyleOf() คืน 'melee' เสมอ ⇒ ranged เป็น false ตลอด — สาขา ranged ด้านล่าง "หลับ" อยู่
  const ranged = atkStyleOf(def) === 'ranged'
  const w = beat.weight ?? 0

  // หมัดลูก: ไม่มีงบเวลาของตัวเอง (อยู่ในหมัดหลักที่กำลังพุ่งอยู่) → ลง impact แล้วออกทันที
  if (beat.kind === 'sub') { applyImpact(beat, g, t); return }

  // โหมดเทียบจังหวะเดิม: ชั้นถากไม่ขยับการ์ดเลย ใช้ประกายที่จุดปะทะแทน (พฤติกรรมเดิมเป๊ะ)
  const chipLegacy = beat.legacyTier === 'chip'
  const doLunge = () => { if (!ranged && !chipLegacy) fx?.lunge(els[beat.attacker], beat.attacker, beat.target, t, beat.kind, w) }

  if (t.windup > 0) {
    highlight(beat.attacker, 'windup')                       // เปลี่ยน class ให้เสร็จ "ก่อน" สั่ง animate (ข้อบังคับ v3)
    fx?.ring(beat.attacker, 'windup', t.windup)
    doLunge()
    await wait(t.windup); if (g !== gen) return
    highlight(beat.attacker, 'windup', false)
  } else {
    doLunge()
  }
  if (chipLegacy) fx?.jab(beat.attacker, beat.target, t.motion)
  // ⚠️ จุดสลับคลาส windup → acting นี้อยู่ "กลาง" fx.lunge() ที่ยังพุ่งอยู่บนการ์ดใบเดียวกัน
  // ปลอดภัยได้เพราะ .windup กับ .acting ตั้ง border-color ค่าเดียวกัน (#fde68a) เป๊ะ = ไม่มี paint เปลี่ยนจริง
  // ⛔ วันไหนแยกสีสองคลาสนี้ = เปลี่ยน paint ระหว่างการ์ดมี animation วิ่ง = ผิดข้อบังคับ v3 ทันที
  highlight(beat.attacker, 'acting')

  if (ranged) fx?.projectile(beat.attacker, beat.target, projectileOf(def), t.motion)

  await wait(t.motion); if (g !== gen) return
  applyImpact(beat, g, t)
  await wait(t.hitstop); if (g !== gen) return
  // acting ถอดหลัง tail เท่านั้น — fx.lunge() ยังพุ่งอยู่ตลอด windup+motion+hitstop+tail (1 animation ครอบทั้ง beat)
  await wait(t.tail); if (g !== gen) return
  highlight(beat.attacker, 'acting', false)
}

// ── กันเปิด beat chain ซ้อนกัน 2 สาย ──
// step() เช็ค paused แค่ตอนต้น พอเข้าไปใน await h(b) แล้ว beat ที่กำลังเล่นจะเล่นจนจบเสมอ
// ถ้าคนกด "พัก" แล้วกด "เล่น" ก่อน beat นั้นจบ togglePause จะเรียก step() ทั้งที่ idx ยังไม่ขยับ
// → beat เดิมเล่นซ้ำพร้อมกันอีกสาย: lunge 2 ตัวบนการ์ดผู้ตีใบเดียว (เคสต้องห้ามตรงๆ), squash/ko ซ้อน,
//   เลขดาเมจเด้ง 2 ที, idx เพิ่ม 2 ครั้ง (beat หายไปเงียบๆ 1 อัน) และทั้งสองสายแย่ง timer ตัวเดียวกัน
// เลือกใช้ re-entrancy guard ที่ต้นทาง (ไม่ใช่ให้ applyAttack คอยดู paused ทุกเฟส) เพราะ
//   ก) กันได้ทุกทางเข้า — togglePause, skipIntro, timer ของ step เอง ไม่ใช่เฉพาะ pause
//   ข) ไม่ต้องแตะ applyAttack ซึ่งเป็นที่อยู่ของ "1 animation ครอบทั้ง beat" — หยุดกลางคันคือแตกสัญญาข้อนั้น
// guard ผูกกับ gen ไม่ใช่ boolean เปล่า: chain เก่าที่โดน reset ตัดกลางทาง (wait() ถูก clear แล้วไม่ resolve ตลอดกาล)
// จะไม่ล็อกไฟต์ใหม่ไว้ และถ้ามันฟื้นมาทีหลังก็ปลด guard ของ gen ใหม่ไม่ได้ — gen guard ชนะเสมอ (stepGen ประกาศไว้ด้านบน)
async function step() {
  const g = gen
  if (stepGen === g) return          // มี chain ของ gen นี้วิ่งอยู่แล้ว
  clearTimeout(timer)
  if (paused.value) return
  if (idx.value >= beats.value.length) { clearHighlights(); return }
  stepGen = g
  try {
    const b = beats.value[idx.value]
    const h = handlers[b.t]
    // 🛡️ กันไฟต์ค้าง: FX ตัวใดตัวหนึ่งพัง ต้องข้ามหมัดนั้นแล้วเล่นต่อ ห้ามหยุดทั้งไฟต์
    //    เกิดจริง 27 ส.ค.: jab() มีตัวแปรที่ไม่ได้นิยาม → throw ทุกหมัดชั้น chip (55% ของหมัด)
    //    → applyAttack reject → step หลุดออกก่อน idx++ → กระดานค้างถาวรกลางไฟต์
    //    ผู้เล่นไม่มีทางกู้เองได้เลยนอกจากออกจากหน้า จึงต้องกันไว้ที่นี่ไม่ใช่แค่แก้ jab
    try { if (h) await h(b) }   // attack = รอครบทั้ง beat จริง · round = sync · type ที่ไม่รู้จัก = ข้ามเงียบ
    catch (e) { console.error('[replay] beat', idx.value, b?.t, e) }
  } finally {
    if (stepGen === g) stepGen = -1   // chain เก่าปลดของ gen ใหม่ไม่ได้
  }
  if (g !== gen) return
  idx.value++
  // ช่องว่างระหว่างหมัดอยู่ใน beat.timing.tail แล้ว — ไม่มี baseDelay อีกต่อไป
  if (idx.value < beats.value.length) timer = setTimeout(step, 0)
  else clearHighlights()
}

function togglePause() {
  paused.value = !paused.value
  // กด "เล่น" ระหว่าง beat ยังวิ่งอยู่ = ไม่ต้องทำอะไร step() จะเด้งออกที่ guard แล้วสายเดิมเดินต่อเอง
  if (!paused.value) { clearTimeout(timer); step() }   // เคลียร์ timer ค้างก่อนเล่นต่อ (กันรันซ้อน)
}
function inspect(uid) {
  pausedBeforeInspect = paused.value   // คนกด ⏸️ เองไว้ก่อนแล้ว → ปิดหน้าต่างแล้วต้อง "ยังพักอยู่"
  paused.value = true
  clearTimeout(timer)
  inspectUid.value = uid
}
// 🐞 เดิมปิดหน้าต่างแค่ `inspectUid = null` ไม่เคยคืน paused เลย → ไฟต์ค้างจนกว่าจะไปกด ▶️ เอง
function closeInspect() {
  inspectUid.value = null
  if (pausedBeforeInspect) return      // เขาตั้งใจพักไว้เอง อย่าไปเล่นต่อให้
  paused.value = false
  clearTimeout(timer)
  step()
}

/** ไอคอนสกิลของเพ็ทตัวนี้ (static ต่อไฟต์ — อ่านจาก def ไม่ใช่ state ที่วิ่งทุกเฟรม) */
const skillIcon = (p) => passiveOf(getPetDef(p?.id))?.icon || ''

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

// ── มาตรวัดเฟรม — เปิดด้วย ?fps=1 ท้าย URL หรือ data.fpsMeter (พาเนล Admin) ──
// ⚠️ ต้องประกาศ "เหนือ" watch(props.data, immediate) ด้านล่าง เพราะ reset() เรียก startFps()
//    ซึ่งอ่าน showFps — ถ้าอยู่ใต้ watch จะเข้า TDZ ทันทีที่มี call site ไหน mount มาพร้อม data
// คณิตทั้งหมดอยู่ใน utils/frameMeter.js (pure, มีเทส) — ที่นี่เหลือแค่ rAF + ต่อสาย ref
//
// สิ่งที่เปลี่ยนจากของเดิม (ตัวเลขเดิมชี้นำการตัดสินใจผิดทาง):
//   · เดิม `dt > 16` = ทุกเฟรมบนจอ 60Hz (คาบจริง 16.67ms) ถูกนับว่าหลุดหมด → สอง preset ได้ ~1,200 เท่ากัน = สัญญาณรบกวนล้วน
//     ตอนนี้จูนศูนย์หาคาบจริงของจอเครื่องนั้นก่อน (มัธยฐาน 30 เฟรมแรก) แล้วนับที่ 1.5× ของคาบนั้น
//   · เดิม loop ไม่เคยหยุด และตัวเลขถูกเรนเดอร์ "ในโมดัลสรุป" → เลขวิ่งขึ้นเรื่อยๆ ระหว่างคนอ่าน
//     พร้อม re-render ทั้ง component (การ์ด 8 ใบ + v-for ขีดหลอด + ตารางสรุป 2 ชุด) ทุกเฟรม
//     และ peak ยังกลืนเอาเฟรมกระตุกตอนโมดัลเด้งเข้ามาเป็น "เฟรมแย่สุดของไฟต์" อีก
//     ตอนนี้หยุดนับตอนไฟต์จบ แล้ว snapshot ค่าลง ref ทีเดียว — เลขในสรุป = เลขของไฟต์ที่เพิ่งเล่นจบ นิ่งสนิท
const showFps = computed(() => new URLSearchParams(location.search).has('fps') || props.data?.fpsMeter === true)
// ป้ายห้องแล็บ: บอกว่าไฟต์ที่กำลังดูอยู่นี้ใช้ค่าชุดไหน + เตือนถ้าเครื่องกำลังตัดการเคลื่อนไหวทิ้งอยู่
// (ไม่งั้น "ทุกแบบเหมือนกันหมด" จะถูกตีความว่าท่าชนไม่ต่างกัน ทั้งที่ระบบตัดทิ้งไปก่อนแล้ว)
const labTag = computed(() => {
  const p = prefs.value
  const cut = prefersReducedMotion()
  const beats = p.legacyBeats ? 'จังหวะเดิม 4 ชั้น' : `จังหวะใหม่ ${BEAT}ms`
  return `${beats} · ${FX_LABEL[p.fx] || p.fx} · ${PACE_LABEL[p.pace] || p.pace}${cut ? ' · ⚠️ Reduce Motion ตัดการเคลื่อนไหวอยู่' : ''}`
})
const fpsWorst = ref(0)     // เฟรมแย่สุดในหน้าต่าง ~1 วิ (ป้ายสดมุมจอ)
const fpsDropAt = ref(FALLBACK_BASE * DROP_RATIO)   // เกณฑ์ "สะดุด" ที่คำนวณจากจอเครื่องนี้
const fpsBase = ref(0)      // คาบเฟรมของจอเครื่องนี้ (0 = ยังจูนศูนย์ไม่เสร็จ)
const fpsPeak = ref(0)
const fpsDrop = ref(0)      // เฟรมสะสมทั้งไฟต์ที่ช้ากว่าคาบปกติ 1.5 เท่า
const fpsOver33 = ref(0)    // เฟรมสะสมทั้งไฟต์ที่ต่ำกว่า 30fps (เกณฑ์สัมบูรณ์ — จงใจไม่ผูกกับจอ)
let fpsRaf = 0
let meter = createFrameMeter()
function fpsLoop(now) {
  // push() คืน true เฉพาะตอนหน้าต่าง 1 วิ ปิดรอบ → เขียน ref วินาทีละครั้ง ไม่ใช่ทุกเฟรม
  if (meter.push(now)) { const s = meter.stats(); fpsWorst.value = Math.round(s.worst); fpsDropAt.value = s.dropAt }
  fpsRaf = requestAnimationFrame(fpsLoop)
}
function startFps() {
  if (!showFps.value || done.value) return     // ไฟต์ที่ log ว่าง (done ตั้งแต่ต้น) ไม่ต้องเปิดลูป
  meter = createFrameMeter()                   // ทิ้งของเก่าทั้งชุด ไม่สะสมข้ามไฟต์
  fpsWorst.value = 0; fpsBase.value = 0; fpsPeak.value = 0; fpsDrop.value = 0; fpsOver33.value = 0
  fpsDropAt.value = FALLBACK_BASE * DROP_RATIO
  if (!fpsRaf) fpsRaf = requestAnimationFrame(fpsLoop)
}
function stopFps() {
  if (fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0 }
  const s = meter.stats()                      // snapshot ครั้งเดียว = ตัวเลขในสรุปไม่ขยับอีกเลย
  fpsBase.value = s.base; fpsPeak.value = s.peak
  fpsDrop.value = s.drop; fpsOver33.value = s.bad
  fpsDropAt.value = s.dropAt; fpsWorst.value = Math.round(s.worst)
}

watch(() => props.data, (d) => { if (d) { buildMax(d); preloadCombat(d); reset() } }, { immediate: true })
// ตีจบ → เว้น ~0.5 วิ ให้เห็นสนามจบ แล้วเปิด modal สรุป (เช็ก resultReady กันตั้งซ้ำ — reset() เปิดเองทันทีถ้า log ว่างตั้งแต่แรก)
watch(done, (v) => {
  if (!v) return
  stopFps()                 // ตัวเลขที่โชว์ในสรุปต้องเป็นของ "ไฟต์ที่เพิ่งจบ" และห้ามขยับระหว่างคนอ่าน (ดูหมายเหตุมาตรวัดเฟรม)
  fx?.dangerClearAll()      // §5.2: วงแหวนอันตรายปิดเมื่อตายหรือจบไฟต์ — ครอบเคสจบแบบไม่มีหมัดสังหารปิดท้ายด้วย
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

watch(showFps, (v) => { if (v) startFps() }, { immediate: true })

onUnmounted(() => {
  clearTimeout(timer); clearTimeout(introTimer); clearTimeout(resultTimer)
  clearTimeout(holdTimer); clearTimeout(hintTimer)
  clearPending()
  window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize)
  if (fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0 }
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
/* ป้ายค่าชุดที่กำลังเทส — อยู่ใต้ "รอบ N" ไม่ทับ fps (ขวาบน) และไม่ทับป้ายเร่ง (ซ้ายบน) */
.br-lab-tag { text-align: center; font-size: .7rem; font-weight: 700; color: rgba(255,255,255,.6);
  margin: -4px 0 2px; pointer-events: none; }
.br-fps.warn { color: #fbbf24; }
.br-fps.bad { color: #f87171; }
.br-fps-sum { text-align: center; font-size: .72rem; color: rgba(255,255,255,.72); font-variant-numeric: tabular-nums;
  border-top: 1px solid rgba(255,255,255,.15); padding-top: 7px; margin-top: 2px; }
.br-fps-sum b { color: #fde68a; }
.br-fps-sum b.bad { color: #f87171; }
.br-fps-note { font-size: .7rem; color: rgba(255,255,255,.5); margin-top: 3px; }

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
   windup/acting เดิม telegraph ย้ายไป fx.ring (brfx-ring, plain DOM/WAAPI นอก Vue reactivity) แล้ว
   ⛔ สองคลาสนี้ต้องได้ border-color "ค่าเดียวกัน" เสมอ — จุดสลับคลาสใน applyAttack() อยู่กลาง fx.lunge()
      ที่ยังวิ่งอยู่ ถ้าแยกสีเมื่อไหร่ = paint เปลี่ยนกลางอนิเมชันการ์ด = ผิดข้อบังคับ v3 (ดูคอมเมนต์ที่ applyAttack) */
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

/* pop/call/puff/proj (เลขดาเมจ, callout สาย, 💀, projectile) ย้ายไป fx pool (.brfx- ท้ายไฟล์ ไม่ scoped) แล้ว —
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

/* ⚠️ การ์ด inspect พื้นเข้ม (#1e293b) — ตัวอักษรต้องสว่าง
   ของเดิมเป็น rgba(0,0,0,.62) = ดำบนกรมท่า contrast ~1.4:1 อ่านไม่ออกเลย
   (สไตล์นี้ถูกก๊อปมาจาก .br-spot-desc ซึ่งอยู่บนการ์ด 'พื้นขาว' จึงถูกที่นั่นแต่ผิดที่นี่)
   เกิดจริง 28 ส.ค. — user รายงานว่าตรงสกิลในหน้าข้อมูลเพ็ทอ่านยาก */
.br-card-passdesc { font-size: .74rem; line-height: 1.45; color: rgba(255,255,255,.78); margin: 2px 0 8px; text-align: left; }
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
</style>

<style>
/* FX pool styles — ไม่ scoped (element สร้าง imperative ไม่มี data-v-*) · namespace .brfx-* กันชน global */
.br-fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 6; }

/* ── สปอตไลต์สกิล ────────────────────────────────────────────
   z-index 4 = ใต้ fx layer (6) เพื่อให้เลข/ประกายของ "ผล" ที่ลงตามมาลอยเหนือฉากหรี่
   🚫 ห้าม backdrop-filter/blur — iOS Safari เพนต์ไม่ไหว (เคสกระตุกที่แก้ไป 4 รอบกว่าจะเจอ)
   ทุกอย่างขยับด้วย transform/opacity เท่านั้น */
.br-spot { position: absolute; inset: 0; z-index: 4; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.br-spot-dim { position: absolute; inset: 0; background: #0f172a; opacity: 0; will-change: opacity; animation: br-spot-dim-in var(--spot-delay, 180ms) ease-out forwards; }
.br-spot-card { position: relative; max-width: 84%; padding: 10px 16px; border-radius: 14px; text-align: center;
  background: rgba(255,255,255,.97); border: 2px solid #0f172a; box-shadow: 0 8px 0 rgba(0,0,0,.35);
  will-change: transform, opacity; animation: br-spot-in var(--spot-in, 240ms) cubic-bezier(.2,.9,.3,1.2) var(--spot-delay, 180ms) both; }
.br-spot-top { display: flex; align-items: center; justify-content: center; gap: 8px; }
.br-spot-icon { font-size: 1.5rem; line-height: 1; }
.br-spot-name { font-size: 1.05rem; font-weight: 800; color: #312e81; }
.br-spot-desc { margin-top: 3px; font-size: .76rem; line-height: 1.4; color: rgba(0,0,0,.7); }
.br-spot.out .br-spot-dim { animation: br-spot-dim-out var(--spot-out, 230ms) ease-in forwards; }
.br-spot.out .br-spot-card { animation: br-spot-out var(--spot-out, 230ms) ease-in forwards; }
@keyframes br-spot-dim-in  { to { opacity: .55; } }
@keyframes br-spot-dim-out { from { opacity: .55; } to { opacity: 0; } }
@keyframes br-spot-in  { from { opacity: 0; transform: translateY(14px) scale(.92); } to { opacity: 1; transform: none; } }
@keyframes br-spot-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-10px) scale(.96); } }
/* การ์ดเจ้าของสกิล — ยกขึ้นเหนือฉากหรี่ให้เห็นว่าใครเป็นคนออกท่า */
.br-unit.spotlit { z-index: 5; border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.35); }
/* fade สำรองของสปอตไลต์ (เดิมใช้ตอนเครื่องขอลดการเคลื่อนไหว — ตอนนี้ bypass แล้ว ดู utils/motionPref.js) */
@keyframes br-spot-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* จุดไอคอนสกิลมุมการ์ด — บอกว่าตัวนี้มีทักษะเฉพาะ (เดิมต้องไล่แตะทีละใบถึงจะรู้) */
.br-skill-dot { position: absolute; top: 2px; right: 4px; font-size: .72rem; line-height: 1; opacity: .85; pointer-events: none; }

/* ── ป้ายสถานะที่ติดอยู่บนการ์ดใบนี้ (สเปก §5) ──
   static ล้วน: ไม่มี will-change ไม่มี animation ไม่มี transition
   วาดตอนไฟต์เริ่มแล้วไม่แตะอีก ⇒ ไม่มีทางไปเปลี่ยน paint ระหว่างการ์ดพุ่ง (ข้อบังคับ v3) */
.br-status { position: absolute; left: 3px; bottom: 3px; display: flex; gap: 3px; pointer-events: none; z-index: 2; }
.br-status b { font-size: .72rem; line-height: 1; font-weight: 400; padding-bottom: 1px; border-bottom: 1.5px solid #34d399; }
.br-status b.dbf { border-bottom-color: #f87171; }

/* ── ชิปชื่อสกิลตอนโปรก ──
   ขึ้นเร็ว (110ms) ค้างระหว่าง SKILL_PAUSE แล้ว .out สั่งให้เลือน 300ms
   ⚠️ การเลือนเกิด "หลัง" ไฟต์เดินต่อแล้ว = ทับ beat ถัดไปโดยตั้งใจ (จังหวะที่ user ออกแบบ)
   อยู่บน fx layer ของตัวเอง (position:absolute + transform) จึงไม่ทำให้การ์ด re-raster */
.br-chip {
  position: absolute; left: 50%; top: -11px; white-space: nowrap; z-index: 6;
  background: #0d9488; color: #fff; font-size: .7rem; font-weight: 800;
  padding: 1px 7px; border-radius: 999px; pointer-events: none;
  box-shadow: 0 2px 6px rgba(0,0,0,.35);
  animation: br-chip-in .11s ease-out both;
}
.br-chip.out { animation: br-chip-out .3s ease-out both; }
@keyframes br-chip-in {
  from { opacity: 0; transform: translate(-50%, 5px) scale(.85); }
  to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
@keyframes br-chip-out {
  from { opacity: 1; transform: translate(-50%, 0) scale(1); }
  to   { opacity: 0; transform: translate(-50%, -9px) scale(.95); }
}
.brfx { position: absolute; left: 0; top: 0; will-change: transform; }
.brfx-call { font-weight: 800; font-size: .7rem; white-space: nowrap; padding: 2px 6px; border-radius: 7px; }
.brfx-call.super { background: #ef4444; color: #fff; }
.brfx-call.weak { background: rgba(203,213,225,.95); color: #334155; }
.brfx-puff { width: 1.2rem; height: 1.2rem; }
.brfx-burst { width: 2rem; height: 2rem; }
/* ป้ายชื่อ passive — เหนือหัวการ์ด (ไม่ใช่กลางจอ ตาม master plan §5.5) */
/* will-change: auto ทับ .brfx โดยตั้งใจ — WAAPI โปรโมต layer ให้เองระหว่างอนิเมชันวิ่งอยู่แล้ว
   การโปรโมตค้างไว้ตลอดไฟต์คือราคาที่แอนดรอยด์กลางๆ จ่ายฟรีๆ (เจอ fps drop หลังเพิ่มของวันนี้) */
.brfx-banner { font-weight: 800; font-size: .72rem; white-space: nowrap; padding: 3px 9px; border-radius: 9px;
  background: rgba(15,23,42,.92); color: #fde68a; border: 1px solid rgba(253,230,138,.55);
  transform-origin: 50% 100%; margin-left: -3.2rem; text-align: center; min-width: 6.4rem; will-change: auto; }
.brfx-sweep { width: 1.7rem; height: 1.7rem; will-change: auto; }
.brfx-proj { width: 1.4rem; height: 1.4rem; }
.brfx-dash { width: 2rem; height: 2rem; }
.brfx-ring { width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 18px; }
/* เหลือ phase เดียวคือ windup — กฎ .brfx-ring.acting ถูกลบพร้อม branch 'acting' ใน fx.ring() ที่ไม่มี call site แล้ว */
.brfx-ring.windup { box-shadow: 0 0 0 3px #fde68a, 0 0 18px 4px rgba(253,230,138,.55); }

/* ยุคเดิม (call site ที่ยังไม่ส่ง tier — battleFx.js ไม่แปะ tier class เลยเมื่อ tier undefined แล้ว
   ตกลงมาที่กฎกลุ่มนี้ตรงๆ) — Task 4 ส่ง tier ครบทุกจุดเรียกแล้วค่อยลบทิ้งได้ */
.brfx-pop { font-weight: 900; font-size: 1.5rem; color: #fecaca; -webkit-text-stroke: 3px rgba(15,23,42,.85); paint-order: stroke fill; white-space: nowrap; }
.brfx-pop.crit { color: #fbbf24; font-size: 2rem; }
.brfx-pop.weak { color: #cbd5e1; font-size: 1.1rem; }
.brfx-pop.super { color: #fca5a5; }
.brfx-pop.heal { color: #86efac; font-size: 1.15rem; }   /* ฟื้นเลือด — เขียวและเล็กกว่าดาเมจ ไม่แย่งสายตาหมัดจริง */

/* ชั้น = เจ้าของขนาด — นี่คือช่องทางหลักที่ผู้เล่นอ่านน้ำหนักของหมัดออกขณะดูเร็วๆ
   มาทีหลังด้วย specificity เท่ากัน (สองคลาสเท่ากับ .crit/.weak ด้านบน) จึงชนะเรื่องขนาดด้วยลำดับประกาศ
   ส่วนสีปล่อยให้ crit/super/weak คุมต่อ (ไม่แตะ color ในกลุ่มนี้เลย) */
/* ขนาดเลขมาจาก battleFx.pop() (0.86 + weight × 1.0 rem) แบบต่อเนื่อง — ไม่มีคลาสตามชั้นแล้ว */

.brfx-call.survive { background: #34d399; color: #06371f; }

.brfx-jab { width: 1.1rem; height: 1.1rem; }

/* วงแหวนโซนอันตราย — เต้นด้วย opacity ล้วนบน pool element ที่ promote ถาวรแล้ว */
.brfx-danger {
  width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 18px;
  box-shadow: 0 0 0 3px #ef4444, 0 0 16px 3px rgba(239, 68, 68, .5);
}
</style>
