# ฟาร์มมีชีวิต — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ฟาร์มดูมีชีวิต — พืชเปลี่ยนภาพตามระยะการโต, แปลงเป็นฉากดิน/ฟ้า, เก็บเกี่ยวแล้วผลลอยเข้ากล่องผลผลิต, ขายแล้วเหรียญพุ่งเข้าตัวนับที่หัวฟาร์มพร้อมเลขวิ่ง — โดยไม่แตะกลไกเกมแม้แต่ตัวเลขเดียว

**Architecture:** ตรรกะระยะการโตเป็น pure function ใน `data/crops.js` (มีเทส `node --test`) · หน้าตาเป็น CSS ใน `FarmGrid.vue` · อนิเมชันของที่ลอยอยู่ในโมดูล JS ล้วนแยกไฟล์ (`utils/farmfx.js`) ที่แปะชั้นเอฟเฟกต์ไว้ที่ `document.body` และขับด้วย WAAPI — Vue ไม่ต้อง re-render ระหว่างอนิเมชัน · ตัวเลขเหรียญวิ่งด้วย composable เล็กๆ แยกไฟล์

**Tech Stack:** Vue 3 (script setup, SFC + scoped style) · Vite · Web Animations API · `node --test` สำหรับ pure utils · ไม่เพิ่ม dependency ใหม่แม้แต่ตัวเดียว

**สเปก:** `docs/superpowers/specs/2026-08-22-farm-visual-life-design.md`

## Global Constraints

ทุก task ต้องเคารพข้อเหล่านี้ทั้งหมด:

- **ห้ามแตะกลไกเกม** — `useFarm.js`, `firestore.rules`, `data/userSchema.js`, ราคา/เวลาโต/ผลผลิตใน `crops.js` ห้ามเปลี่ยนค่า
- **ห้ามแตะ** `utils/battlefx.js` และ `components/battle/BattleReplay.vue` (เคสกระตุก iOS เพิ่งปิด อย่าไปยุ่ง — ให้ลอกแนวคิดได้ แต่ห้ามแก้/ห้าม import)
- **ฟอนต์ขั้นต่ำ `.7rem`** ห้ามมี `font-size` ต่ำกว่านี้ในไฟล์ `.vue`/`.css` ใดๆ (ภาษาไทยมีสระบน-ล่าง ต่ำกว่านี้อ่านไม่ออกบนมือถือจริง)
- **overlay/ชั้นลอยที่ `position:fixed` ต้องอยู่ระดับ `body`** ไม่ใช่ใน component — `#main-content` เป็น `position:fixed` = สร้าง stacking context ทำให้ z-index ข้างในสู้ `#bottom-nav` ไม่ได้ (CLAUDE.md ข้อ 6 · บั๊กนี้วนกลับมา ≥5 รอบแล้ว)
- **`prefers-reduced-motion: reduce` ต้องใช้งานได้ครบทุกฟีเจอร์** — ข้ามอนิเมชัน แต่ผลลัพธ์ของเกมต้องถูกต้องเหมือนกันทุกกรณี
- คอมเมนต์เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · single-file component + scoped style
- `npm run build` ต้องผ่านก่อน commit ทุก task

---

### Task 1: ตรรกะระยะการโต (pure function + เทส)

**Files:**
- Modify: `src/data/crops.js` (เพิ่มท้ายไฟล์ + เติมฟิลด์ `stages` ให้ 2 พืช)
- Create: `src/data/crops.test.js`

**Interfaces:**
- Consumes: `CROPS`, `getCrop` ที่มีอยู่แล้วใน `data/crops.js`
- Produces:
  - `export const DEFAULT_STAGES = ['🌱','🌿']`
  - `export const STAGE_CUTS = [0.33, 0.70]`
  - `export function stageEmoji(crop, progress) → string` — `crop` = object จาก `CROPS` (หรือ `null`), `progress` = 0..1, คืนอีโมจิ 1 ตัว (คืน `''` ถ้า `crop` ว่าง)

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/data/crops.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CROPS, getCrop, DEFAULT_STAGES, STAGE_CUTS, stageEmoji } from './crops.js'

const tomato = getCrop('tomato')     // ไม่มี stages → ใช้ค่าเริ่มต้น

test('ระยะ 1 = ต้นอ่อน เมื่อ progress ต่ำกว่าจุดตัดแรก', () => {
  assert.equal(stageEmoji(tomato, 0), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, 0.32), DEFAULT_STAGES[0])
})

test('ระยะ 2 = ต้นโต ตั้งแต่จุดตัดแรกถึงก่อนจุดตัดสอง (ขอบเขตนับเข้าระยะถัดไป)', () => {
  assert.equal(stageEmoji(tomato, STAGE_CUTS[0]), DEFAULT_STAGES[1])
  assert.equal(stageEmoji(tomato, 0.69), DEFAULT_STAGES[1])
})

test('ตั้งแต่จุดตัดสองขึ้นไป = อีโมจิพืชจริง (รวมค่าที่เกิน 1)', () => {
  assert.equal(stageEmoji(tomato, STAGE_CUTS[1]), tomato.emoji)
  assert.equal(stageEmoji(tomato, 1), tomato.emoji)
  assert.equal(stageEmoji(tomato, 5), tomato.emoji)
})

test('อินพุตพัง → ไม่ throw และตกที่ระยะ 1', () => {
  assert.equal(stageEmoji(tomato, -1), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, NaN), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, undefined), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(tomato, 'abc'), DEFAULT_STAGES[0])
})

test('crop ว่าง → คืนสตริงว่าง ไม่ throw', () => {
  assert.equal(stageEmoji(null, 0.5), '')
  assert.equal(stageEmoji(undefined, 0.5), '')
})

test('พืชที่มี stages ของตัวเอง ใช้ค่านั้นแทนค่าเริ่มต้น', () => {
  const tree = getCrop('moneytree')
  assert.deepEqual(tree.stages, ['🌱', '🌲'])
  assert.equal(stageEmoji(tree, 0.5), '🌲')
  assert.equal(stageEmoji(tree, 1), tree.emoji)

  const lotus = getCrop('lotus')
  assert.deepEqual(lotus.stages, ['🌱', '🍃'])
  assert.equal(stageEmoji(lotus, 0.5), '🍃')
})

test('stages ที่ไม่ครบ 2 ระยะ → fallback ค่าเริ่มต้น (ไม่พัง)', () => {
  const broken = { emoji: '🍅', stages: ['🌱'] }
  assert.equal(stageEmoji(broken, 0.1), DEFAULT_STAGES[0])
  assert.equal(stageEmoji(broken, 0.5), DEFAULT_STAGES[1])
  assert.equal(stageEmoji({ emoji: '🍅', stages: [] }, 0.5), DEFAULT_STAGES[1])
  assert.equal(stageEmoji({ emoji: '🍅', stages: 'ไม่ใช่ array' }, 0.5), DEFAULT_STAGES[1])
})

test('ทุกพืชในคลังคืนอีโมจิเสมอ ไม่มีตัวไหนได้ค่าว่าง', () => {
  for (const c of CROPS) {
    for (const p of [0, 0.4, 0.8, 1]) {
      assert.ok(stageEmoji(c, p).length > 0, `${c.id} ที่ progress ${p} ต้องมีอีโมจิ`)
    }
  }
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าไม่ผ่าน**

Run: `node --test src/data/crops.test.js`
Expected: FAIL — `stageEmoji is not a function` / `DEFAULT_STAGES` เป็น `undefined`

- [ ] **Step 3: เติมฟิลด์ `stages` ให้ 2 พืชใน `CROPS`**

แก้เฉพาะ 2 บรรทัดนี้ใน `src/data/crops.js` (เพิ่มฟิลด์ `stages` เท่านั้น — **ห้ามแตะ `seedCost` / `growMinutes` / `sellPrice`**):

```js
  { id: 'lotus',    name: 'บัวหลวง',    emoji: '🪷', tier: 'legendary', unlockLevel: 11, seedCost: 2000,  growMinutes: 240,  sellPrice: 5600, stages: ['🌱','🍃'] },
  { id: 'moneytree', name: 'ต้นไม้เงินตรา', emoji: '🌳', tier: 'legendary', unlockLevel: 12, seedCost: 15000, growMinutes: 4320, sellPrice: 70000, stages: ['🌱','🌲'] },
```

- [ ] **Step 4: เขียน `stageEmoji` (โค้ดน้อยสุดที่ทำให้เทสผ่าน)**

ต่อท้าย `src/data/crops.js`:

```js
// ════════════════════════════════════════════════════════════
//  ระยะการโต — แสดงผลล้วนๆ ไม่กระทบเวลาโต/ผลผลิต/ราคา
//  พืชเปลี่ยนภาพระหว่างรอ: ต้นอ่อน → ต้นโต → ผลจริง
//  พืชที่ระยะกลางแบบร่วมดูแปลก ใส่ `stages: ['a','b']` ทับรายตัวได้ในข้อมูลด้านบน
//  ⚠️ อีโมจิที่ใช้ต้องมีไฟล์ใน public/emoji/fluent/ ไม่งั้น <Emoji> จะ fallback
//     ไปใช้ฟอนต์เครื่อง (หน้าตาไม่ตรงกันแต่ละเครื่อง) — เพิ่มตัวใหม่ต้องรัน
//     `node scripts/fetch-fluent.mjs` (ต้องต่อเน็ต)
// ════════════════════════════════════════════════════════════

/** ระยะกลางที่ใช้ร่วมกันทุกพืช (ต้นอ่อน → ต้นโต) */
export const DEFAULT_STAGES = ['🌱', '🌿']

/** จุดตัดความคืบหน้าที่เปลี่ยนระยะ — ขอบเขตนับเข้าระยะถัดไป */
export const STAGE_CUTS = [0.33, 0.70]

/** อีโมจิที่ควรแสดงตามความคืบหน้า (0..1) · อินพุตพังแค่ไหนก็ไม่ throw */
export function stageEmoji(crop, progress) {
  if (!crop) return ''
  const n = Number(progress)
  const p = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
  if (p >= STAGE_CUTS[1]) return crop.emoji
  const own = Array.isArray(crop.stages) && crop.stages.length >= 2 ? crop.stages : DEFAULT_STAGES
  return p >= STAGE_CUTS[0] ? own[1] : own[0]
}
```

- [ ] **Step 5: รันเทสให้ผ่าน + เช็กว่าเทสเดิมไม่พัง**

Run: `node --test src/data/crops.test.js src/data/farmPlots.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 6: ยืนยันว่ารูปอีโมจิที่ใช้มีครบ (ไม่ต้องต่อเน็ต)**

Run: `cd public/emoji/fluent && for f in 1f331 1f33f 1f332 1f343; do [ -f "$f.svg" ] && echo "มี $f" || echo "ขาด $f"; done`
Expected: "มี" ทั้ง 4 ตัว (🌱 🌿 🌲 🍃) · ถ้าขาดตัวไหนต้องรัน `node scripts/fetch-fluent.mjs` ก่อน

- [ ] **Step 7: Commit**

```bash
git add src/data/crops.js src/data/crops.test.js
git commit -m "Crops: ระยะการโตเป็น pure function + เทส (เตรียมให้พืชเปลี่ยนภาพระหว่างรอ)"
```

---

### Task 2: ให้แปลงใช้ภาพตามระยะ + preload รูปกันภาพวูบ

**Files:**
- Modify: `src/components/farm/FarmGrid.vue` (template บรรทัด ~21, script setup)

**Interfaces:**
- Consumes: `stageEmoji`, `DEFAULT_STAGES` จาก Task 1 · `fluentFile(emoji)` จาก `src/utils/emoji.js` (มีอยู่แล้ว คืน path สัมพัทธ์ต่อ `BASE_URL` หรือ `''`)
- Produces: `stageChar(plot) → string` (ใช้ภายในไฟล์นี้เท่านั้น)

- [ ] **Step 1: เปลี่ยน import ใน `<script setup>`**

เดิม:
```js
import { getCrop } from '../../data/crops.js'
```
เป็น:
```js
import { getCrop, stageEmoji, DEFAULT_STAGES } from '../../data/crops.js'
import { fluentFile } from '../../utils/emoji.js'
```

- [ ] **Step 2: เพิ่มฟังก์ชัน `stageChar` ต่อจาก `stat()` ใน `<script setup>`**

```js
// อีโมจิที่แสดงในแปลง = ระยะการโต (พร้อมเก็บ → progress = 1 → คืนผลจริงอยู่แล้ว)
function stageChar(plot) { const s = stat(plot); return stageEmoji(s.crop, s.progress) }
```

- [ ] **Step 3: ใช้ `stageChar` ใน template**

ในบล็อก `<!-- planted -->` เปลี่ยนบรรทัด `.plot-emoji` จาก:
```html
<div class="plot-emoji" :class="{ ripe: stat(plot).ready }" :style="emojiStyle(plot)"><Emoji :char="stat(plot).crop.emoji" /></div>
```
เป็น:
```html
<div class="plot-emoji" :class="{ ripe: stat(plot).ready }" :style="emojiStyle(plot)"><Emoji :char="stageChar(plot)" /></div>
```

- [ ] **Step 4: preload รูประยะตอนเปิดหน้า**

`<Emoji>` ตั้ง `loading="lazy"` ไว้ → ตอนพืชสลับระยะครั้งแรกภาพจะวูบ · แก้ด้วยการโหลดล่วงหน้าใน `onMounted` ที่มีอยู่แล้ว (แก้ของเดิม อย่าเพิ่ม `onMounted` ซ้อน):

```js
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  // preload รูประยะการโต — <Emoji> เป็น lazy img ไม่งั้นตอนสลับระยะครั้งแรกภาพจะวูบ
  // (แพทเทิร์นเดียวกับ preload projectile ของ battle commit b6a996c)
  const chars = new Set(DEFAULT_STAGES)
  for (const c of seedChoices.value) for (const s of (c.stages || [])) chars.add(s)
  for (const ch of chars) {
    const f = fluentFile(ch)
    if (f) { const img = new Image(); img.src = import.meta.env.BASE_URL + f }
  }
})
```

- [ ] **Step 5: build ผ่าน**

Run: `npm run build`
Expected: build สำเร็จ ไม่มี error

- [ ] **Step 6: ดูของจริงในเบราว์เซอร์**

Run: `npm run dev` แล้วเปิดหน้า `/play/farm`
Expected: ปลูกผักกาด (5 นาที) แล้วดูช่วงแรกเป็น 🌱 · ผ่านไป ~2 นาทีเป็น 🌿 · ใกล้สุกเป็น 🥬 · ตอนพร้อมเก็บเป็น 🥬 เต็มขนาดพร้อมเรืองแสงเหมือนเดิม
(เร่งดูเร็วๆ ได้โดยเปิด DevTools แล้วดูแปลงที่ปลูกค้างไว้อยู่แล้ว หรือปลูกผักกาดหลายแปลงเว้นระยะเวลากัน)

- [ ] **Step 7: Commit**

```bash
git add src/components/farm/FarmGrid.vue
git commit -m "Farm: พืชเปลี่ยนภาพตามระยะการโต + preload รูปกันภาพวูบ (เดิมเป็นอีโมจิเดิมตั้งแต่ปลูกยันเก็บ)"
```

---

### Task 3: แปลงเป็นฉากดิน/ฟ้า (A+) + ลบ CSS ที่ตายแล้ว

**Files:**
- Modify: `src/components/farm/FarmGrid.vue` (เฉพาะ `<style scoped>`)

**Interfaces:**
- Consumes: คลาสเดิมทั้งหมด (`.plot` `.plot.empty` `.plot.ready` `.plot-emoji` `.plot-name` `.plot-bar` `.plot-time`)
- Produces: ไม่มี export — งาน CSS ล้วน · **ห้ามแก้ template หรือ script ใน task นี้**

- [ ] **Step 1: ยืนยันว่า CSS 3 คลาสนี้ตายจริงก่อนลบ**

Run: `grep -rn "plot-mini\|plot-actions\|plot-fertcost" src/`
Expected: เจอเฉพาะใน `<style scoped>` ของ `FarmGrid.vue` เท่านั้น (ไม่มี template ไหนใช้ — เหลือจากระบบรดน้ำ/ปุ๋ยที่ไม่เคยมีจริง) · **ถ้าเจอในไฟล์อื่นหรือใน template ห้ามลบ ให้หยุดแล้วรายงาน**

- [ ] **Step 2: ลบ 3 บรรทัดที่ตายแล้ว**

ลบทิ้งจาก `<style scoped>`:
```css
.plot-actions { display: flex; gap: 4px; }
.plot-mini { border: none; background: rgba(0,0,0,.06); border-radius: 7px; padding: 3px 6px; font-size: .72rem; cursor: pointer; display: flex; align-items: center; gap: 1px; }
.plot-mini:disabled { opacity: .35; }
.plot-fertcost { font-size: .7rem; color: #b45309; }
```

- [ ] **Step 3: เปลี่ยน `.plot` เป็นฉากดิน/ฟ้า**

แทนที่กฎ `.plot` เดิมด้วย (คงทุก property ที่เกี่ยวกับเลย์เอาต์ไว้เหมือนเดิม เปลี่ยนแค่พื้นหลัง/ขอบ):

```css
.plot { position: relative; overflow: hidden; border-radius: 12px; background: linear-gradient(180deg, #e9f4ff 0%, #eef7e6 52%, #b07f52 52%, #8a5c36 100%); border: 1px solid rgba(120,90,50,.28); box-shadow: inset 0 -6px 10px -6px rgba(80,55,25,.35); min-height: 110px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; transition: border-color .25s, box-shadow .25s; }
/* จุดดินจางๆ ให้พื้นล่างไม่เรียบเป็นแผ่นสี */
.plot::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 48%; pointer-events: none; background: radial-gradient(circle at 22% 30%, rgba(0,0,0,.12) 0 3px, transparent 4px), radial-gradient(circle at 72% 62%, rgba(0,0,0,.1) 0 2px, transparent 3px); }
.plot.empty { background: rgba(120,90,50,.05); border-style: dashed; box-shadow: none; }
.plot.empty::before { display: none; }
```

- [ ] **Step 4: ให้เนื้อหาลอยเหนือชั้นจุดดิน + ปรับสีตัวหนังสือให้อ่านออกบนพื้นเข้ม**

แทนที่กฎเหล่านี้:

```css
.plot-emoji { position: relative; z-index: 1; font-size: 1.8rem; line-height: 1; transform-origin: center bottom; transition: transform .4s cubic-bezier(.34,1.56,.64,1); filter: drop-shadow(0 2px 2px rgba(0,0,0,.22)); }
.plot-name { position: relative; z-index: 1; font-size: .72rem; color: #fff; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
.plot-bar { position: relative; z-index: 1; width: 100%; height: 6px; background: rgba(255,255,255,.4); border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.15); }
.plot-time { position: relative; z-index: 1; font-size: .7rem; color: #fff; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
.plot-btn.harvest { position: relative; z-index: 1; border: none; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; font-weight: 800; font-size: .7rem; padding: 5px 8px; border-radius: 8px; cursor: pointer; font-family: inherit; }
```

- [ ] **Step 5: สถานะพร้อมเก็บ — คงเรืองแสงไว้ แต่ไม่ทับฉาก**

แทนที่กฎ `.plot.ready` เดิม (เดิมทับ `background` ทั้งแปลงเป็นสีเขียว ซึ่งจะกลบฉากดิน/ฟ้าหายไป):

```css
.plot.ready { border-color: rgba(34,197,94,.6); box-shadow: 0 0 0 1px rgba(34,197,94,.35), 0 5px 16px -5px rgba(34,197,94,.6); animation: plotGlow 1.8s ease-in-out infinite; }
```

คีย์เฟรม `plotGlow` และ `ripeBob` เดิมคงไว้ทั้งคู่ ไม่ต้องแก้

- [ ] **Step 6: ยืนยันว่าบล็อก reduced-motion ยังครบ**

ตรวจว่าท้าย `<style scoped>` ยังมีบล็อกนี้อยู่ครบ (ห้ามลบ):
```css
@media (prefers-reduced-motion: reduce) {
  .plot.ready { animation: none; }
  .plot-emoji.ripe { animation: none; }
  .plot-emoji, .plot-fill, .plot, .inv-item, .plot-empty { transition: none; }
}
```

- [ ] **Step 7: ตรวจฟอนต์ + CSS ตาย + build**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/ ; grep -rn "plot-mini\|plot-actions\|plot-fertcost" src/ ; npm run build`
Expected: สอง grep แรกไม่เจออะไรเลย · build ผ่าน

- [ ] **Step 8: ดูของจริง**

Run: `npm run dev` → `/play/farm`
Expected: แปลงที่ปลูกแล้วมีเส้นขอบฟ้า ต้นไม้ยืนบนดิน · ชื่อพืช/เวลาเป็นตัวขาวอ่านออกชัด · แปลงว่างยังเป็นกรอบประจุดจางๆ แบบเดิม · แปลงที่พร้อมเก็บยังเรืองแสงเขียวและยังเห็นฉากอยู่ · ตำแหน่งปุ่ม/แถบ % ไม่ขยับจากเดิม

- [ ] **Step 9: Commit**

```bash
git add src/components/farm/FarmGrid.vue
git commit -m "Farm: แปลงเป็นฉากดิน/ฟ้า + ลบ CSS ที่ตายแล้ว (ต้นไม้เคยดูลอยอยู่ในกล่อง)"
```

---

### Task 4: ชั้นเอฟเฟกต์ `utils/farmfx.js`

**Files:**
- Create: `src/utils/farmfx.js`

**Interfaces:**
- Consumes: `fluentFile(emoji)` จาก `src/utils/emoji.js`
- Produces:
  - `export function flyTo({ emoji, from, to, count = 1, size = 26, onArrive })` — `from`/`to` เป็น `DOMRect` (จาก `getBoundingClientRect()`), `onArrive` เรียก **ครั้งเดียว** ตอนชิ้นสุดท้ายถึงปลายทาง
  - `export function cancelFarmFx()` — ยกเลิกของที่ลอยค้างและถอดชั้นเอฟเฟกต์ออกจาก DOM

- [ ] **Step 1: เขียนโมดูล**

สร้าง `src/utils/farmfx.js`:

```js
// farmfx.js — เอฟเฟกต์ "ยิงของจากจุด A ไปจุด B" ของหน้าฟาร์ม (JS ล้วน ไม่พึ่ง Vue)
// doctrine:
//   • ชั้นเอฟเฟกต์แปะที่ document.body เท่านั้น — #main-content เป็น position:fixed
//     = สร้าง stacking context ของที่อยู่ข้างในสู้ #bottom-nav ไม่ได้ (CLAUDE.md ข้อ 6)
//   • ขับด้วย WAAPI เปลี่ยนแค่ transform/opacity (แนวคิดเดียวกับ battlefx.js แต่แยกไฟล์
//     ไม่ import และไม่แก้ของ battle — เคสกระตุก iOS ของนั้นเพิ่งปิด)
//   • ของที่ลอยเป็น element ชั่วคราวนอก Vue → Vue ไม่ต้อง re-render ระหว่างอนิเมชัน
//   • prefers-reduced-motion = ไม่สร้างอะไรเลย เรียก onArrive ทันที (ผลลัพธ์ต้องเหมือนกัน)
import { fluentFile } from './emoji.js'

const BASE = import.meta.env.BASE_URL
const MAX_PIECES = 6          // กันสั่งลอยทีละเยอะจนมือถือเก่ากระตุก

let layer = null
const live = new Set()        // WAAPI ที่ยังวิ่งอยู่ (ไว้ cancel ตอนออกจากหน้า)

function prefersReduced() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function ensureLayer() {
  if (layer && layer.isConnected) return layer
  layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '900',
  })
  document.body.appendChild(layer)
  return layer
}

/** สร้างชิ้นที่จะลอย — ใช้รูป Fluent ถ้ามี ไม่งั้น fallback เป็นตัวอักษร */
function makePiece(emoji, size) {
  const file = fluentFile(emoji)
  let el
  if (file) {
    el = document.createElement('img')
    el.src = BASE + file
    el.style.width = `${size}px`
    el.style.height = `${size}px`
  } else {
    el = document.createElement('span')
    el.textContent = emoji
    el.style.fontSize = `${size}px`
    el.style.lineHeight = '1'
  }
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', willChange: 'transform, opacity' })
  return el
}

/**
 * ยิงของจาก from ไป to
 * @param emoji อีโมจิที่จะลอย · from/to = DOMRect · count จำนวนชิ้น (cap ที่ MAX_PIECES)
 * @param onArrive เรียกครั้งเดียวตอนชิ้นสุดท้ายถึงปลายทาง (ถูก cancel = ไม่เรียก)
 */
export function flyTo({ emoji, from, to, count = 1, size = 26, onArrive }) {
  if (!emoji || !from || !to || prefersReduced()) { onArrive?.(); return }
  const host = ensureLayer()
  const n = Math.max(1, Math.min(MAX_PIECES, Math.floor(count) || 1))
  const x0 = from.left + from.width / 2 - size / 2
  const y0 = from.top + from.height / 2 - size / 2
  const x1 = to.left + to.width / 2 - size / 2
  const y1 = to.top + to.height / 2 - size / 2
  let arrived = 0

  for (let i = 0; i < n; i++) {
    const el = makePiece(emoji, size)
    host.appendChild(el)
    const driftX = (Math.random() - 0.5) * 26
    const driftY = -18 - Math.random() * 22
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${x0 + driftX}px, ${y0 + driftY}px) scale(1.15)`, opacity: 1, offset: .28 },
      { transform: `translate(${x1}px, ${y1}px) scale(.55)`, opacity: .9 },
    ], { duration: 620, delay: i * 55, easing: 'cubic-bezier(.34,.85,.4,1)', fill: 'forwards' })
    live.add(anim)
    anim.finished
      .then(() => { if (++arrived === n) onArrive?.() })
      .catch(() => {})                       // ถูก cancel → ไม่เรียก onArrive
      .finally(() => { live.delete(anim); el.remove() })
  }
}

/** ยกเลิกทุกอย่างที่ค้าง + ถอดชั้นออกจาก DOM (เรียกตอนออกจากหน้าฟาร์ม) */
export function cancelFarmFx() {
  for (const a of live) a.cancel()
  live.clear()
  layer?.remove()
  layer = null
}
```

- [ ] **Step 2: build ผ่าน**

Run: `npm run build`
Expected: build สำเร็จ (ไฟล์ยังไม่มีใครเรียก — bundler อาจ tree-shake ทิ้ง ถือว่าปกติ)

- [ ] **Step 3: ทดลองยิงจริงในเบราว์เซอร์**

Run: `npm run dev` → เปิด `/play/farm` → เปิด DevTools Console แล้ววาง:
```js
const m = await import('/src/utils/farmfx.js')
const a = document.querySelector('.plot').getBoundingClientRect()
const b = document.querySelector('.inv-head').getBoundingClientRect()
m.flyTo({ emoji: '🍅', from: a, to: b, count: 3 })
```
Expected: เห็นมะเขือเทศ 3 ลูกลอยจากแปลงแรกไปที่หัวกล่องผลผลิต แล้วหายไป · **สำคัญ: ต้องลอยทับ bottom-nav ได้ ไม่ใช่ลอดอยู่ใต้** · เช็ก Elements ว่าหลังอนิเมชันจบไม่มี element ค้างในชั้น (`document.body.lastElementChild` ต้องว่าง ไม่มี `<img>` ค้าง)

- [ ] **Step 4: ทดสอบ reduced-motion**

ใน DevTools → Rendering → เลือก "Emulate CSS prefers-reduced-motion: reduce" แล้วรันคำสั่งเดิมพร้อม `onArrive`:
```js
m.flyTo({ emoji: '🍅', from: a, to: b, count: 3, onArrive: () => console.log('ถึงแล้ว') })
```
Expected: ไม่มีอะไรลอย และเห็น "ถึงแล้ว" ใน console ทันที

- [ ] **Step 5: Commit**

```bash
git add src/utils/farmfx.js
git commit -m "FarmFx: ชั้นเอฟเฟกต์ยิงของจากจุดหนึ่งไปอีกจุด (แปะที่ body กันกับดัก stacking context)"
```

---

### Task 5: ชิปเหรียญบนหัวฟาร์ม + เลขวิ่ง

**Files:**
- Create: `src/composables/useCountUp.js`
- Modify: `src/components/farm/FarmGrid.vue` (template หัวการ์ด + script + style)

**Interfaces:**
- Consumes: `coins` computed ที่มีอยู่แล้วใน `FarmGrid.vue`
- Produces:
  - `export function useCountUp(source, { duration = 700 } = {}) → Ref<number>` — `source` เป็น ref/computed ของตัวเลข
  - `coinChipEl` — template ref ของชิปเหรียญ (Task 6 ใช้เป็นปลายทางให้เหรียญพุ่งเข้า)

- [ ] **Step 1: เขียน composable**

สร้าง `src/composables/useCountUp.js`:

```js
import { ref, watch, onUnmounted } from 'vue'

/**
 * ตัวเลขที่ "วิ่งไล่" ค่าจริง
 *   • วิ่งเฉพาะตอนค่าเพิ่ม — ค่าลด (จ่ายเงินซื้อเมล็ด) เปลี่ยนทันที
 *     ไม่งั้นจะดูเหมือนเงินค่อยๆ ไหลออกซึ่งน่ากังวลโดยไม่จำเป็น
 *   • prefers-reduced-motion → เปลี่ยนทันทีทุกกรณี
 */
export function useCountUp(source, { duration = 700 } = {}) {
  const shown = ref(Number(source.value) || 0)
  let raf = 0

  const instant = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

  watch(source, (to) => {
    const target = Number(to) || 0
    stop()
    if (instant() || target <= shown.value) { shown.value = target; return }
    const start = shown.value
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)          // ease-out cubic
      shown.value = Math.round(start + (target - start) * eased)
      raf = k < 1 ? requestAnimationFrame(tick) : 0
    }
    raf = requestAnimationFrame(tick)
  })

  onUnmounted(stop)
  return shown
}
```

- [ ] **Step 2: แยกหัวการ์ดเป็น 2 บรรทัด แล้วใส่ชิปเหรียญ**

ใน `FarmGrid.vue` แทนที่บล็อก `.farm-head` เดิมทั้งบล็อก (เดิมชื่อฟาร์มกับข้อความบรรยายอยู่บรรทัดเดียวกัน — ต้องแยกเพื่อให้ชิปเหรียญมีที่อยู่):

```html
    <div class="farm-head">
      <span class="farm-title"><Emoji char="🌾" /> ฟาร์ม <HelpButton topic="farm" /></span>
      <span class="farm-coins" ref="coinChipEl"><Emoji char="🪙" /> {{ shownCoins.toLocaleString() }}</span>
    </div>
    <div class="farm-sub">{{ plotCount }} แปลง · ปลูกได้ {{ seedChoices.length }} ชนิด<template v-if="upcoming"> · ปลดล็อก Lv.{{ upcoming.level }} {{ upcomingEmojis }}</template></div>
```

- [ ] **Step 3: ต่อ composable ใน `<script setup>`**

เพิ่ม import:
```js
import { useCountUp } from '../../composables/useCountUp.js'
```
เพิ่มต่อจากบรรทัด `const coins = computed(...)` ที่มีอยู่:
```js
const shownCoins = useCountUp(coins)      // เลขวิ่งตอนได้เหรียญเพิ่ม
const coinChipEl = ref(null)              // ปลายทางให้เหรียญพุ่งเข้า (ใช้ใน Task 6)
```

- [ ] **Step 4: CSS ของชิปเหรียญ + หัวการ์ดสองบรรทัด**

แทนที่ 3 กฎนี้ใน `<style scoped>`:
```css
.farm-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.farm-title { font-weight: 800; font-size: 1rem; }
.farm-sub { font-size: .7rem; color: rgba(0,0,0,.45); margin-bottom: 12px; }
```
แล้วเพิ่มกฎใหม่:
```css
.farm-coins { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-size: .82rem; color: #b45309; background: linear-gradient(160deg,#fff,rgba(245,158,11,.14)); border: 1px solid rgba(180,83,9,.22); border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
```

- [ ] **Step 5: build + ดูของจริง**

Run: `npm run build` แล้ว `npm run dev` → `/play/farm`
Expected: หัวการ์ดมีชื่อ "🌾 ฟาร์ม" ซ้าย ชิปเหรียญขวา · ข้อความ "N แปลง · ปลูกได้ M ชนิด" ย้ายลงบรรทัดถัดไป · ขายผลผลิตแล้วเลขในชิปนับขึ้นแบบวิ่ง (ยังไม่มีเหรียญลอย — Task 6) · ซื้อเมล็ดแล้วเลขลดทันทีไม่วิ่ง

- [ ] **Step 6: ตรวจฟอนต์ + Commit**

Run: `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: ไม่เจออะไร

```bash
git add src/composables/useCountUp.js src/components/farm/FarmGrid.vue
git commit -m "Farm: ชิปเหรียญบนหัวฟาร์ม + เลขวิ่งตอนได้เพิ่ม (เดิมต้องเปิดโมดัลถึงจะรู้ว่ามีกี่เหรียญ)"
```

---

### Task 6: ต่อเอฟเฟกต์เข้ากับเก็บเกี่ยวและขาย

**Files:**
- Modify: `src/components/farm/FarmGrid.vue` (template + script + style)

**Interfaces:**
- Consumes: `flyTo`, `cancelFarmFx` (Task 4) · `coinChipEl` (Task 5) · `farm.harvest/sell/sellAll` จาก `useFarm()` (ห้ามแก้ `useFarm.js`)
- Produces: ไม่มี export

- [ ] **Step 1: เพิ่ม import และ ref ที่ต้องใช้ใน `<script setup>`**

```js
import { flyTo, cancelFarmFx } from '../../utils/farmfx.js'
```
และเพิ่ม ref:
```js
const plotEls  = ref([])        // element ของแต่ละแปลง (ต้นทางของผลผลิตที่ลอย)
const invHeadEl = ref(null)     // หัวกล่องผลผลิต (ปลายทาง)
const basketPop = ref(false)    // ให้กล่องผลผลิตเด้งตอนของถึง
```

- [ ] **Step 2: ผูก ref เข้ากับ template**

แปลง — เพิ่ม `:ref` ใน `v-for` (callback ref เก็บ element ลง array ตาม index):
```html
      <div v-for="(plot, i) in plots" :key="i" class="plot" :class="{ ready: stat(plot).ready, empty: !plot }" :ref="el => { if (el) plotEls[i] = el }">
```

หัวกล่องผลผลิต — เพิ่ม ref กับคลาสเด้ง:
```html
      <div class="inv-head" ref="invHeadEl" :class="{ pop: basketPop }">
```

ปุ่มเก็บเกี่ยว — เรียกฟังก์ชันใหม่แทนการเรียก `farm.harvest(i)` ตรงๆ:
```html
            <button class="plot-btn harvest" @click="onHarvest(i, plot)"><Emoji char="✅" /> เก็บเกี่ยว</button>
```

ปุ่มขายรายชิ้น — ส่ง event เข้าไปด้วยเพื่อจับตำแหน่งปุ่ม:
```html
        <button v-for="it in invList" :key="it.id" class="inv-item" @click="confirmSell(it, $event)">
```

ปุ่มขายทั้งหมด:
```html
        <button v-if="invList.length" class="inv-sellall" @click="confirmSellAll($event)">ขายทั้งหมด</button>
```

- [ ] **Step 3: เขียน `onHarvest`**

เพิ่มใน `<script setup>`:

```js
// เก็บเกี่ยว: ต้องจับตำแหน่งแปลง "ก่อน" เรียก harvest เพราะ patchUser เป็น optimistic update
// → พอเรียกเสร็จแปลงจะว่างทันที rect ที่ได้หลังจากนั้นจะเป็นของแปลงเปล่า
function onHarvest(i, plot) {
  const st = stat(plot)
  if (!st.ready) { farm.harvest(i); return }        // ไม่พร้อม = ให้ useFarm เป็นคน toast บอกเอง
  const from = plotEls.value[i]?.getBoundingClientRect()
  const to   = invHeadEl.value?.getBoundingClientRect()
  const char = st.crop?.emoji
  farm.harvest(i)
  if (from && to && char) {
    flyTo({ emoji: char, from, to, count: 1, onArrive: popBasket })
  }
}

// กล่องผลผลิตเด้งรับของ
let popTimer = null
function popBasket() {
  basketPop.value = true
  clearTimeout(popTimer)
  popTimer = setTimeout(() => { basketPop.value = false }, 380)
}
```

- [ ] **Step 4: แก้ `confirmSell` / `confirmSellAll` ให้ยิงเหรียญ**

แทนที่ 2 ฟังก์ชันเดิมทั้งบล็อก:

```js
// ยืนยันก่อนขาย (กันกดพลาด)
// ⚠️ จับ rect ของปุ่มแบบ synchronous ก่อน await confirm — หลัง await แล้ว
//    currentTarget จะเป็น null และรายการอาจหายไปจาก DOM แล้ว
async function confirmSell(it, ev) {
  const from = ev?.currentTarget?.getBoundingClientRect()
  const total = (it.sellPrice * it.qty).toLocaleString()
  if (!await confirm(`ขาย ${it.name} ×${it.qty} = +${total} เหรียญ?`)) return
  await farm.sell(it.id)
  shootCoins(from)
}

async function confirmSellAll(ev) {
  const from = ev?.currentTarget?.getBoundingClientRect()
  const total = invList.value.reduce((s, it) => s + it.sellPrice * it.qty, 0)
  if (!await confirm(`ขายผลผลิตทั้งหมด รวม +${total.toLocaleString()} เหรียญ?`)) return
  await farm.sellAll()
  shootCoins(from)
}

// เหรียญพุ่งเข้าชิปเหรียญบนหัวฟาร์ม
// (ขายให้เสร็จก่อนแล้วค่อยยิง — ความถูกต้องของ state สำคัญกว่าการจับจังหวะให้ตรงเป๊ะ
//  เลขในชิปวิ่ง ~700ms เหรียญลอย ~620ms สองอย่างซ้อนกันพอดีอยู่แล้ว)
function shootCoins(from) {
  const to = coinChipEl.value?.getBoundingClientRect()
  if (from && to) flyTo({ emoji: '🪙', from, to, count: 4, size: 22 })
}
```

- [ ] **Step 5: เก็บกวาดตอนออกจากหน้า**

แก้ `onUnmounted` เดิม:
```js
onUnmounted(() => { clearInterval(timer); clearTimeout(popTimer); cancelFarmFx() })
```

- [ ] **Step 6: CSS ให้กล่องผลผลิตเด้ง**

เพิ่มใน `<style scoped>`:
```css
.inv-head.pop { animation: basketPop .38s cubic-bezier(.34,1.56,.64,1); }
@keyframes basketPop {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}
```
และเพิ่ม `.inv-head.pop` เข้าไปในบล็อก reduced-motion ที่มีอยู่:
```css
@media (prefers-reduced-motion: reduce) {
  .plot.ready { animation: none; }
  .plot-emoji.ripe { animation: none; }
  .inv-head.pop { animation: none; }
  .plot-emoji, .plot-fill, .plot, .inv-item, .plot-empty { transition: none; }
}
```

- [ ] **Step 7: build + ตรวจฟอนต์**

Run: `npm run build ; grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: build ผ่าน · grep ไม่เจออะไร

- [ ] **Step 8: เทสของจริงครบวง**

Run: `npm run dev` → `/play/farm`
ตรวจทีละข้อ:
1. ปลูกผักกาด (5 นาที) → รอสุก → กดเก็บเกี่ยว → **ผลลอยจากแปลงไปที่หัวกล่องผลผลิต แล้วกล่องเด้ง**
2. กดขายรายชิ้น → ยืนยัน → **เหรียญ 4 เหรียญพุ่งจากปุ่มไปที่ชิปเหรียญ + เลขวิ่งขึ้น**
3. กด "ขายทั้งหมด" → ยืนยัน → เหรียญพุ่งจากปุ่มขายทั้งหมด
4. **ของที่ลอยต้องอยู่เหนือ bottom-nav ไม่ใช่ลอดใต้** (จุดนี้คือบั๊กที่วนกลับมา 5 รอบ)
5. เปิด DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" → ทำข้อ 1–3 ซ้ำ → **ไม่มีอะไรลอย แต่ผลผลิต/เหรียญ/ตัวเลขต้องถูกต้องครบเหมือนกัน**
6. กดเก็บเกี่ยวแล้วเปลี่ยนหน้าไป `/play` ทันทีระหว่างของกำลังลอย → ต้องไม่มี element ค้างบนจอ และไม่มี error ใน console
7. เปิด DevTools ย่อจอเป็นมือถือ (375px) → เช็กว่าชิปเหรียญไม่ดันหัวการ์ดจนล้น

- [ ] **Step 9: Commit**

```bash
git add src/components/farm/FarmGrid.vue
git commit -m "Farm: เก็บเกี่ยวผลลอยเข้ากล่อง + ขายแล้วเหรียญพุ่งเข้าชิป (เดิมมีแค่ toast ตัวหนังสือ)"
```

---

## ปิดงาน

- [ ] **รันเทสทั้งหมดที่มีในโปรเจกต์**

Run: `node --test src/data/crops.test.js src/data/farmPlots.test.js src/utils/petUtils.test.js src/utils/idleIncome.test.js src/utils/dailyQuest.test.js`
Expected: ผ่านทั้งหมด

- [ ] **build สุดท้าย**

Run: `npm run build`
Expected: ผ่าน

- [ ] **ตรวจว่าไม่ได้เผลอแตะไฟล์ต้องห้าม**

Run: `git diff --name-only master@{u}..HEAD 2>/dev/null || git log --oneline --name-only -6`
Expected: มีแค่ `src/data/crops.js` `src/data/crops.test.js` `src/utils/farmfx.js` `src/composables/useCountUp.js` `src/components/farm/FarmGrid.vue` และไฟล์ docs — **ห้ามมี** `useFarm.js` `firestore.rules` `userSchema.js` `battlefx.js` `BattleReplay.vue`

- [ ] **ส่งให้ user เทสจอจริงบนมือถือก่อน deploy** — deploy ด้วย `git push origin master` (GitHub Actions build+publish ให้เอง) · ไม่ต้อง `firebase deploy` เพราะงานนี้ไม่แตะ rules เลย
