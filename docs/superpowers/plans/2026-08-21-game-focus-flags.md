# ปรับโฟกัสระบบเกม (feature flag ซ่อน Expedition/มินิเกม) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ซ่อน Expedition + มินิเกม 3 ตัว ออกจากสายตานักศึกษาด้วยสวิตช์ที่แอดมินเปิด-ปิดได้ทันที เหลือหน้า Play ที่ถามคำถามเดียว "เลี้ยงเพ็ท หรือ ทำฟาร์ม"

**Architecture:** กฎการอ่าน flag เป็น pure function ใน `src/utils/featureFlags.js` (เทส `node --test`) · `useAppConfig` เป็นตัวต่อสาย Firestore `config/app` เข้ากับ ref แบบเดียวกับ `pvpOpen` ที่มีอยู่ · ทางเข้าถูกซ่อนที่ UI **และ** ถูกกันที่ router guard · ไม่ลบโค้ด ไม่แตะ schema

**Tech Stack:** Vue 3 (script setup) · vue-router (hash mode) · Pinia · Firebase Firestore v9 modular · `node --test`

**Spec:** `docs/superpowers/specs/2026-08-21-game-focus-flags-design.md` — อ่านก่อนเริ่ม

## Global Constraints

- **ห้ามแตะ `minigameCore.js` / `useMinigameBoard.js` / ฟิลด์ `minigames.*` บน user doc** — ตัวฝึก CrCl (ฝั่งเรียน) เก็บยอดใต้ `minigames.crcl` และใช้โครงเดียวกัน · `arcadeOpen` คุมเฉพาะ route + UI ของ 3 เกมใน `data/minigames.js`
- **ห้ามลบโค้ด ห้ามลบเทส ห้ามแตะ `userSchema.js`** — งานนี้คือซ่อน ไม่ใช่ตัด · เปิดกลับมาต้องได้ข้อมูลเดิมครบ
- **ห้ามแตะตัวเลขเศรษฐกิจ** ใดๆ (เหรียญ/ราคา/รางวัล) — ปัญหาที่แก้คือความรก ไม่ใช่ balance
- **ดีฟอลต์ปิดเสมอ** — `config/app` หายหรือยังโหลดไม่เสร็จ = ปิด (safe default เดียวกับ `pvpOpen`)
- **แอดมินเห็นเสมอแม้ปิด** — แพทเทิร์นเดียวกับ `pvpOpen || authStore.isAdmin` ใน `PetHubView.vue:28`
- **เปิดเมื่อค่าเป็น boolean `true` เท่านั้น** — `"true"` / `1` / `"yes"` ต้องนับเป็นปิด
- **ปิด Expedition = ส่งใหม่ไม่ได้ แต่เก็บของที่ส่งไปแล้วได้เสมอ** — guard ต้องปล่อยผ่านถ้า `userData.expedition` ไม่ว่าง · **ห้ามแตะ `HomeView.vue` และ `ExpeditionCard.vue`**
- คอมเมนต์/commit เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · ปิดท้าย `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- ตรวจงาน: `node --test src/utils/featureFlags.test.js src/utils/nextAction.test.js` + `npm run build`

---

### Task 1: ตรรกะ feature flag (pure + เทส)

**Files:**
- Create: `src/utils/featureFlags.js`
- Create: `src/utils/featureFlags.test.js`

**Interfaces:**
- Consumes: ไม่มี (pure ล้วน ไม่ import อะไรเลย)
- Produces (ให้ Task 2–4 ใช้):
  - `FEATURE_KEYS: string[]` = `['pvpOpen', 'expeditionOpen', 'arcadeOpen']`
  - `isFeatureOpen(configData: object|null|undefined, key: string, opts?: { isAdmin?: boolean }) => boolean`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/featureFlags.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { isFeatureOpen, FEATURE_KEYS } from './featureFlags.js'

test('config หาย/ยังไม่โหลด → ทุก key ปิด (safe default)', () => {
  for (const k of FEATURE_KEYS) {
    assert.equal(isFeatureOpen(null, k), false, `${k} ต้องปิดเมื่อ config เป็น null`)
    assert.equal(isFeatureOpen(undefined, k), false)
    assert.equal(isFeatureOpen({}, k), false, `${k} ต้องปิดเมื่อไม่มีฟิลด์`)
  }
})

test('เปิดเฉพาะ key ที่ตั้งไว้ ไม่ลามไปตัวอื่น', () => {
  const cfg = { arcadeOpen: true }
  assert.equal(isFeatureOpen(cfg, 'arcadeOpen'), true)
  assert.equal(isFeatureOpen(cfg, 'expeditionOpen'), false)
  assert.equal(isFeatureOpen(cfg, 'pvpOpen'), false)
})

test('ต้องเป็น boolean true เท่านั้น — ค่าที่พิมพ์ผิดใน console ห้ามเปิดฟีเจอร์', () => {
  for (const bad of ['true', 'yes', 1, 'TRUE', [], {}, 'false', 0, null]) {
    assert.equal(isFeatureOpen({ arcadeOpen: bad }, 'arcadeOpen'), false,
      `ค่า ${JSON.stringify(bad)} ต้องนับเป็นปิด`)
  }
  assert.equal(isFeatureOpen({ arcadeOpen: true }, 'arcadeOpen'), true)
})

test('แอดมินเห็นเสมอแม้ flag ปิด (ไว้เทสก่อนเปิดจริง)', () => {
  assert.equal(isFeatureOpen(null, 'arcadeOpen', { isAdmin: true }), true)
  assert.equal(isFeatureOpen({ arcadeOpen: false }, 'arcadeOpen', { isAdmin: true }), true)
  assert.equal(isFeatureOpen({ arcadeOpen: false }, 'arcadeOpen', { isAdmin: false }), false)
})

test('key ที่ไม่รู้จัก → ปิดเสมอ แม้ config จะตั้งค่าไว้', () => {
  assert.equal(isFeatureOpen({ somethingElse: true }, 'somethingElse'), false)
  assert.equal(isFeatureOpen({ somethingElse: true }, 'somethingElse', { isAdmin: true }), false,
    'แอดมินก็ไม่ควรเปิด key ที่ไม่มีอยู่จริง — กันพิมพ์ชื่อ flag ผิดแล้วเงียบ')
})

test('FEATURE_KEYS ครบและไม่ซ้ำ', () => {
  assert.deepEqual([...FEATURE_KEYS].sort(), ['arcadeOpen', 'expeditionOpen', 'pvpOpen'])
  assert.equal(new Set(FEATURE_KEYS).size, FEATURE_KEYS.length)
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าพัง**

Run: `node --test src/utils/featureFlags.test.js`
Expected: FAIL — `Cannot find module './featureFlags.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/featureFlags.js`:

```js
/**
 * สวิตช์เปิด-ปิดฟีเจอร์ เก็บใน Firestore `config/app` (แอดมินกดจากหน้า Admin
 * มีผลทันที ไม่ต้อง deploy) · ตรรกะการอ่านอยู่ที่นี่เป็น pure function
 * เพราะ useAppConfig เป็น onSnapshot listener ซึ่งเทสตรงไม่ได้
 *
 * spec: docs/superpowers/specs/2026-08-21-game-focus-flags-design.md
 */

// ชื่อ flag ที่ระบบรู้จัก — key นอกลิสต์นี้ถือว่าปิดเสมอ (กันพิมพ์ชื่อผิดแล้วเงียบ)
export const FEATURE_KEYS = ['pvpOpen', 'expeditionOpen', 'arcadeOpen']

/**
 * @param {object|null|undefined} configData ข้อมูลดิบจาก config/app (null = doc หาย/ยังไม่โหลด)
 * @param {string} key ชื่อ flag ใน FEATURE_KEYS
 * @param {{ isAdmin?: boolean }} [opts] แอดมินเห็นเสมอ — ไว้เทสก่อนเปิดให้ทั้งรุ่น
 * @returns {boolean}
 */
export function isFeatureOpen(configData, key, { isAdmin = false } = {}) {
  if (!FEATURE_KEYS.includes(key)) return false
  if (isAdmin === true) return true
  // ต้องเป็น boolean true เป๊ะ — "true"/1/"yes" ที่พิมพ์ผิดใน console ห้ามเปิดฟีเจอร์ให้ทั้งรุ่น
  return configData?.[key] === true
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/featureFlags.test.js`
Expected: PASS ทั้ง 6 เทส (`# pass 6` / `# fail 0`)

- [ ] **Step 5: Commit**

```bash
git add src/utils/featureFlags.js src/utils/featureFlags.test.js
git commit -F - <<'MSG'
Config: ตรรกะ feature flag เป็น pure function (เตรียมซ่อน Expedition/มินิเกม)

useAppConfig เป็น onSnapshot listener เทสตรงไม่ได้ จึงแยกกฎการอ่าน flag
ออกมาเทสแยก · ดีฟอลต์ปิดเมื่อ doc หาย/ยังไม่โหลด (safe default เดียวกับ
pvpOpen) · เปิดเมื่อเป็น boolean true เท่านั้น — "true"/1/"yes" ที่พิมพ์ผิด
ใน console ห้ามเปิดฟีเจอร์ให้ทั้งรุ่น · key นอก FEATURE_KEYS ปิดเสมอ
กันพิมพ์ชื่อ flag ผิดแล้วเงียบ · แอดมินเห็นเสมอไว้เทสก่อนเปิดจริง

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: ต่อ flag เข้า useAppConfig

**Files:**
- Modify: `src/composables/useAppConfig.js`
- Test: `node --test src/utils/featureFlags.test.js` (ของเดิมต้องยังผ่าน) + `npm run build`

**Interfaces:**
- Consumes: `isFeatureOpen(configData, key, opts)` จาก `../utils/featureFlags.js` (Task 1)
- Produces (ให้ Task 3–5 ใช้): `useAppConfig()` คืน `{ maintenance, configLoaded, pvpOpen, expeditionOpen, arcadeOpen, rawConfig }` — ทั้งหมดเป็น `Ref` · `rawConfig` = ข้อมูลดิบจาก `config/app` (ให้ router guard เรียก `isFeatureOpen` เองพร้อม `isAdmin`)

- [ ] **Step 1: เพิ่ม ref และต่อสาย**

แก้ `src/composables/useAppConfig.js` — เพิ่ม import และ ref:

```js
import { isFeatureOpen } from '../utils/featureFlags.js'
```

เพิ่มต่อจากบรรทัด `const pvpOpen      = ref(false)`:

```js
const expeditionOpen = ref(false)  // ส่งผจญภัย — ปิดไว้ก่อน (โฟกัสเพ็ท+ฟาร์ม 21 ส.ค.)
const arcadeOpen     = ref(false)  // มินิเกม 3 ตัว — ไม่คุมตัวฝึก CrCl ที่ใช้โครงเดียวกัน
const rawConfig      = ref(null)   // ข้อมูลดิบ ให้ router guard เช็คพร้อม isAdmin เองได้
```

แทนที่ callback ของ `onSnapshot`:

```js
    (snap) => {
      const d = snap.data()
      rawConfig.value = d || null
      // missing doc → stay locked (safe default)
      maintenance.value = d ? d.maintenance !== false : true
      pvpOpen.value        = isFeatureOpen(d, 'pvpOpen')
      expeditionOpen.value = isFeatureOpen(d, 'expeditionOpen')
      arcadeOpen.value     = isFeatureOpen(d, 'arcadeOpen')
      configLoaded.value = true
    },
```

แก้บรรทัด return ท้ายไฟล์:

```js
export function useAppConfig() {
  return { maintenance, configLoaded, pvpOpen, expeditionOpen, arcadeOpen, rawConfig }
}
```

- [ ] **Step 2: ตรวจว่าไม่ทำ pvpOpen เดิมพัง**

Run: `grep -n "pvpOpen" src/composables/useAppConfig.js src/views/PetHubView.vue src/views/AdminView.vue`
Expected: `pvpOpen` ยังถูก expose และถูกใช้ที่ `PetHubView` (การ์ด Arena) กับ `AdminView` (ปุ่ม toggle) เหมือนเดิม — พฤติกรรมไม่เปลี่ยน เพราะ `isFeatureOpen(d,'pvpOpen')` ให้ผลเท่ากับ `d?.pvpOpen === true` ของเดิม

- [ ] **Step 3: เทส + build**

Run: `node --test src/utils/featureFlags.test.js && npm run build`
Expected: เทสผ่าน · build สำเร็จไม่มี error

- [ ] **Step 4: Commit**

```bash
git add src/composables/useAppConfig.js
git commit -F - <<'MSG'
Config: ต่อ expeditionOpen/arcadeOpen เข้า useAppConfig

ใช้ isFeatureOpen ตัวเดียวกันทั้ง 3 flag รวม pvpOpen เดิม (ผลลัพธ์เท่าเดิม
เพราะ d?.pvpOpen === true คือกฎเดียวกัน) · expose rawConfig เพิ่มเพื่อให้
router guard เรียก isFeatureOpen เองพร้อม isAdmin ได้ ไม่ต้องมี ref ซ้ำ
ต่อ flag

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: ซ่อนทางเข้าใน UI

**Files:**
- Modify: `src/views/PlayView.vue` (template บรรทัด ~26–37, script)
- Modify: `src/views/PetHubView.vue` (template บรรทัด ~35–42, script)
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `useAppConfig()` → `{ expeditionOpen, arcadeOpen }` (Task 2) · `useAuthStore()` → `isAdmin`
- Produces: ไม่มี — จอปลายทาง

- [ ] **Step 1: PlayView — ซ่อน section มินิเกม**

ใน `src/views/PlayView.vue` ครอบ section มินิเกมทั้งก้อน (ตั้งแต่คอมเมนต์ `<!-- ── มินิเกม` ถึง `</div>` ที่ปิด `.soon-grid`) ด้วย `<template v-if>`:

```html
      <!-- ── มินิเกม (จาก registry data/minigames.js) — ซ่อนเมื่อ arcadeOpen ปิด ── -->
      <template v-if="arcadeOpen || authStore.isAdmin">
        <SectionTitle><Emoji char="🎮" /> มินิเกม</SectionTitle>
        <div class="soon-grid">
          <template v-for="g in games" :key="g.key">
            <RouterLink v-if="g.status === 'live'" :to="g.route" class="mg-card">
              <span class="mg-emoji"><Emoji :char="g.emoji" /></span>
              <span class="mg-name">{{ g.name }}</span>
              <span class="mg-best">สถิติ {{ bestOf(g.key).toLocaleString() }}</span>
            </RouterLink>
            <SoonCard v-else :emoji="g.emoji" :label="g.name" />
          </template>
        </div>
      </template>
```

เปลี่ยน `v-if="arcadeVisible"` ในบล็อกข้างบนเป็น `v-if="arcadeOpen || authStore.isAdmin"`
เพื่อใช้สำนวนเดียวกับที่ `PetHubView.vue:28` ใช้กับ Arena อยู่แล้ว (`pvpOpen || authStore.isAdmin`)
— ไม่ต้องสร้าง computed เพิ่ม

ใน `<script setup>` เพิ่มต่อจาก `const authStore = useAuthStore()`:

```js
import { useAppConfig } from '../composables/useAppConfig.js'
const { arcadeOpen } = useAppConfig()   // แอดมินเห็นเสมอ — ไว้เทสก่อนเปิดให้ทั้งรุ่น
```

- [ ] **Step 2: PetHubView — ซ่อนการ์ด Expedition**

ใน `src/views/PetHubView.vue` เปลี่ยน `<RouterLink to="/expedition" class="game-card">` เป็น:

```html
      <RouterLink v-if="expeditionOpen || authStore.isAdmin" to="/expedition" class="game-card">
```

ใน `<script setup>` แก้บรรทัด 59 ที่มีอยู่แล้ว (`const { pvpOpen } = useAppConfig()`) เป็น:

```js
const { pvpOpen, expeditionOpen } = useAppConfig()
```

ไม่ต้องเพิ่ม import อะไร — ไฟล์นี้มี `useAppConfig` และ `authStore` ครบแล้ว

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 4: ทดลองจริงใน dev (ล็อกอินเป็นนักศึกษาถ้าทำได้)**

Run: `npm run dev`
1. เปิด `#/play` — ต้องเหลือ **การ์ดใหญ่ 2 ใบ (เพ็ท / ฟาร์ม)** ไม่มี section มินิเกม
   (ถ้าล็อกอินเป็นแอดมินจะยังเห็น — ถูกต้องแล้ว ตั้งใจให้เห็น)
2. เปิด `#/play/pets` — ต้องเหลือ 4 การ์ด ไม่มี "ส่งผจญภัย"
3. เปิด `#/study/crcl` — **ตัวฝึก CrCl ต้องยังทำงานปกติ** (นี่คือจุดที่เสี่ยงพังที่สุด)

- [ ] **Step 5: Commit**

```bash
git add src/views/PlayView.vue src/views/PetHubView.vue
git commit -F - <<'MSG'
Play/PetHub: ซ่อนทางเข้ามินิเกมและส่งผจญภัย (โฟกัสเพ็ท+ฟาร์ม)

หน้า Play เหลือคำถามเดียว "วันนี้จะเลี้ยงเพ็ท หรือทำฟาร์ม" ตามที่ user
ระบุปัญหาว่าหน้าจอรกจนคนเล่นไม่รู้จะทำอะไร · PetHub เหลือ 4 การ์ด
แอดมินยังเห็นทั้งคู่ไว้เทสก่อนเปิดจริง

ไม่แตะ minigameCore/useMinigameBoard/ฟิลด์ minigames.* เพราะตัวฝึก CrCl
ฝั่งเรียนใช้โครงเดียวกันและเก็บยอดใต้ minigames.crcl

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: กันที่ router (ลิงก์ตรง/bookmark เก่า)

**Files:**
- Modify: `src/router/index.js`
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `useAppConfig()` → `{ rawConfig, configLoaded }` (Task 2) · `isFeatureOpen(configData, key, opts)` (Task 1) · `useAuthStore()` → `isAdmin`, `userData`
- Produces: ไม่มี — เป็น guard ปลายทาง

- [ ] **Step 1: เพิ่ม guard**

ใน `src/router/index.js` เพิ่ม import ท้ายกลุ่ม import และ guard ต่อจาก `export const router = createRouter({...})` **ก่อน** บล็อก `router.onError`:

```js
import { useAppConfig } from '../composables/useAppConfig.js'
import { useAuthStore } from '../stores/auth.js'
import { isFeatureOpen } from '../utils/featureFlags.js'
```

```js
// ── กันเข้าฟีเจอร์ที่ปิดอยู่ผ่านลิงก์ตรง/bookmark เก่า ──
// (เรียก useAuthStore() ใน guard ได้ เพราะ main.js:24-25 ทำ app.use(pinia) ก่อน app.use(router))
// ซ่อนการ์ดใน UI อย่างเดียวไม่พอ — URL เก่ายังพาเข้าได้
// ⚠️ Expedition: ปิด = "ส่งใหม่ไม่ได้" แต่คนที่ส่งเพ็ทไปแล้วต้องเข้ามากดเก็บของได้เสมอ
const GATED = {
  expedition:      'expeditionOpen',
  'capsule-rush':  'arcadeOpen',
  g2048:           'arcadeOpen',
  stacker:         'arcadeOpen',
}

router.beforeEach((to) => {
    const key = GATED[to.name]
    if (!key) return true

    const auth = useAuthStore()
    const { rawConfig, configLoaded } = useAppConfig()

    // config ยังไม่โหลด → ปล่อยผ่าน แล้วให้ UI จัดการ
    // (เด้งตอนนี้จะเด้งผิดทุกครั้งที่ refresh ค้างอยู่บนหน้านั้น)
    if (!configLoaded.value) return true

    if (isFeatureOpen(rawConfig.value, key, { isAdmin: auth.isAdmin })) return true

    // มีสายผจญภัยค้างอยู่ → เข้าไปกดเก็บของได้ แม้ฟีเจอร์ปิดแล้ว
    if (key === 'expeditionOpen' && auth.userData?.expedition) return true

    return { path: '/play' }
})
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 3: ทดลองจริงใน dev**

Run: `npm run dev`
1. ล็อกอินเป็น**นักศึกษา** (ไม่ใช่แอดมิน) แล้วพิมพ์ `#/play/games/2048` ตรงๆ → ต้องเด้งไป `#/play`
2. พิมพ์ `#/expedition` ตรงๆ ตอนไม่มีสายค้าง → เด้งไป `#/play`
3. ถ้ามีบัญชีที่กำลังส่งผจญภัยอยู่ ลอง `#/expedition` → **ต้องเข้าได้** และกดเก็บของได้
4. ล็อกอินเป็น**แอดมิน** → เข้าทั้งสอง URL ได้ปกติ
5. อยู่บนหน้าที่ถูก gate แล้วกด refresh → ต้องไม่เด้งมั่วตอน config ยังโหลดไม่เสร็จ

- [ ] **Step 4: Commit**

```bash
git add src/router/index.js
git commit -F - <<'MSG'
Router: กันเข้าฟีเจอร์ที่ปิดอยู่ผ่านลิงก์ตรง (ซ่อนการ์ดอย่างเดียวไม่พอ)

URL เก่าที่นักศึกษา bookmark ไว้ยังพาเข้ามินิเกม/ส่งผจญภัยได้ทั้งที่ปิดแล้ว
เด้งกลับ /play แทน · แอดมินผ่านได้ไว้เทสก่อนเปิดจริง

Expedition ปล่อยผ่านถ้ามี userData.expedition ค้างอยู่ — ปิดฟีเจอร์ต้องแปลว่า
"ส่งใหม่ไม่ได้" ไม่ใช่ "ของที่ส่งไปแล้วหายเปล่า" · config ยังโหลดไม่เสร็จ
ก็ปล่อยผ่าน ไม่งั้น refresh ค้างบนหน้านั้นจะเด้งผิดทุกครั้ง

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 5: การ์ด "ทำอะไรต่อ" เลิกเสนอส่งผจญภัย

**Files:**
- Modify: `src/utils/nextAction.js` (บรรทัด ~74–80)
- Modify: `src/utils/nextAction.test.js` (เพิ่มเทส)
- Modify: `src/components/home/NextActionCard.vue` (บรรทัด ~32–35)
- Test: `node --test src/utils/nextAction.test.js` + `npm run build`

**Interfaces:**
- Consumes: `nextAction(userData, ctx)` — `ctx` มี `{ today, now }` อยู่แล้ว เพิ่ม `expeditionOpen: boolean` · `useAppConfig()` → `expeditionOpen` (Task 2)
- Produces: ไม่มี — เป็น task สุดท้าย

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

เพิ่มท้าย `src/utils/nextAction.test.js` (ดูรูปแบบ `ctx` และ helper ที่ไฟล์นี้ใช้อยู่ก่อน แล้วเขียนให้เข้ากัน):

```js
// ── ปิด Expedition แล้วต้องไม่เสนอให้ส่งผจญภัย (21 ส.ค.) ──
// สร้าง user ที่ "ทำอย่างอื่นครบหมดแล้ว เหลือแค่ยังไม่ส่งผจญภัย"
function readyForExpedition() {
  return { ...allDone(), expedition: null }
}

test('ctx ไม่ได้เปิด expedition → ไม่เสนอส่งผจญภัย', () => {
  assert.equal(nextAction(readyForExpedition(), ctx), null)
})

test('ctx.expeditionOpen = true → เสนอส่งผจญภัยเหมือนเดิม', () => {
  const a = nextAction(readyForExpedition(), { ...ctx, expeditionOpen: true })
  assert.equal(a?.key, 'expedition')
  assert.equal(a?.to, '/play/pets')
})

test('expeditionOpen ต้องเป็น boolean true เท่านั้น', () => {
  assert.equal(nextAction(readyForExpedition(), { ...ctx, expeditionOpen: 'true' }), null)
  assert.equal(nextAction(readyForExpedition(), { ...ctx, expeditionOpen: 1 }), null)
})
```

`allDone()` เป็น helper ที่มีอยู่แล้วในไฟล์นี้ (บรรทัด 10) — มันคืน user ที่ `expedition: { missionId: 'm1' }`
อยู่แล้ว จึงต้อง override เป็น `null` เพื่อให้เข้าเงื่อนไขกฎข้อ 6 ซึ่งโค้ดด้านบนทำไว้แล้ว

- [ ] **Step 2: รันเทสให้เห็นว่าพัง**

Run: `node --test src/utils/nextAction.test.js`
Expected: FAIL — เทส "ไม่เสนอส่งผจญภัย" พัง เพราะตอนนี้ยังคืน `key: 'expedition'` อยู่

- [ ] **Step 3: แก้ implementation**

ใน `src/utils/nextAction.js` แก้กฎข้อ 6:

```js
  // 6) ส่งผจญภัยได้ — มาถึงบรรทัดนี้ได้แปลว่าทีมครบ 3 แล้ว (กฎ 3 คืนค่าไปก่อนถ้าไม่ครบ)
  //    ข้ามทั้งข้อเมื่อฟีเจอร์ปิดอยู่ — ไม่งั้นการ์ดจะชวนไปหน้าที่ทางเข้าถูกซ่อนไปแล้ว
  if (ctx.expeditionOpen === true && !userData.expedition) {
    return {
      key: 'expedition', icon: '🧭', title: 'ส่งเพ็ทไปผจญภัย',
      sub: 'ส่งทิ้งไว้ตามเวลา กลับมารับของรางวัล', cta: 'ไปส่ง', to: '/play/pets',
    }
  }
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/nextAction.test.js`
Expected: PASS ทั้งหมด (เทสเดิม 19 ข้อ + ใหม่ 3 = 22)

- [ ] **Step 5: ส่ง flag เข้า ctx จาก NextActionCard**

ใน `src/components/home/NextActionCard.vue`:

```js
import { useAppConfig } from '../../composables/useAppConfig.js'
const { expeditionOpen } = useAppConfig()

const action = computed(() => nextAction(
  auth.userData,
  {
    today: new Date().toISOString().slice(0, 10),
    now: Date.now(),
    expeditionOpen: expeditionOpen.value,
  },
))
```

- [ ] **Step 6: เทส + build**

Run: `node --test src/utils/nextAction.test.js && npm run build`
Expected: เทสผ่าน · build สำเร็จ

- [ ] **Step 7: ทดลองจริงใน dev**

Run: `npm run dev` → เปิด `#/` ด้วยบัญชีนักศึกษาที่ทีมเพ็ทครบ 3 และยังไม่ส่งผจญภัย
Expected: การ์ด "ทำอะไรต่อ" **ต้องไม่ขึ้น "ส่งเพ็ทไปผจญภัย"** — ขึ้นข้อเสนออื่นหรือไม่ขึ้นเลย

- [ ] **Step 8: Commit**

```bash
git add src/utils/nextAction.js src/utils/nextAction.test.js src/components/home/NextActionCard.vue
git commit -F - <<'MSG'
Home: การ์ด "ทำอะไรต่อ" เลิกชวนส่งผจญภัยเมื่อฟีเจอร์ปิด

เดิมกฎข้อ 6 เสนอ "ส่งเพ็ทไปผจญภัย" เสมอ ซึ่งจะชวนไปหน้าที่ทางเข้าถูกซ่อน
ไปแล้ว · รับ ctx.expeditionOpen (boolean true เท่านั้น) แล้วข้ามทั้งข้อ
เมื่อปิด · เทส 3 ข้อคุมทั้งเปิด ปิด และค่าที่พิมพ์ผิด

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 6: สวิตช์ในหน้า Admin

**Files:**
- Modify: `src/views/AdminView.vue` (template ต่อจากการ์ด PvP บรรทัด ~47, script ต่อจาก `togglePvp` บรรทัด ~644)
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `useAppConfig()` → `{ expeditionOpen, arcadeOpen }` (Task 2) · `setDoc`, `doc`, `db`, `toast` — มีอยู่ในไฟล์แล้ว
- Produces: ไม่มี — เป็น task สุดท้าย

- [ ] **Step 1: เพิ่มการ์ดสวิตช์ใน template**

แทรกต่อจาก `</section>` ที่ปิดการ์ด "สนามประลอง (PvP)":

```html
      <!-- ───── โฟกัสเกม: ซ่อน/เปิด ฟีเจอร์รอง ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🎯" /> โฟกัสเกม</span></div>
        <div class="admin-hint">
          ปิดไว้ = นักศึกษาไม่เห็นทางเข้า (แอดมินยังเข้าได้ไว้เทส) · ของเก่าไม่หาย เปิดกลับมาอยู่ครบ ·
          มีผลทันที ไม่ต้อง deploy · <b>คนที่กำลังส่งผจญภัยอยู่ยังเข้าไปเก็บของได้เสมอ</b>
        </div>

        <div class="maint-toggle">
          <span class="maint-state" :class="expeditionOpen ? 'on' : 'off'">
            {{ expeditionOpen ? '🟢 ส่งผจญภัย: เปิดให้เล่นแล้ว' : '🔒 ส่งผจญภัย: ซ่อนจากนักศึกษา' }}
          </span>
          <button
            class="btn-mini" :class="expeditionOpen ? 'btn-gray' : 'btn-gold'"
            :disabled="savingFocus" @click="toggleFocus('expeditionOpen')"
          >
            {{ savingFocus ? '...' : (expeditionOpen ? 'ซ่อน' : 'เปิด 🗺️') }}
          </button>
        </div>

        <div class="maint-toggle" style="margin-top:8px">
          <span class="maint-state" :class="arcadeOpen ? 'on' : 'off'">
            {{ arcadeOpen ? '🟢 มินิเกม: เปิดให้เล่นแล้ว' : '🔒 มินิเกม: ซ่อนจากนักศึกษา' }}
          </span>
          <button
            class="btn-mini" :class="arcadeOpen ? 'btn-gray' : 'btn-gold'"
            :disabled="savingFocus" @click="toggleFocus('arcadeOpen')"
          >
            {{ savingFocus ? '...' : (arcadeOpen ? 'ซ่อน' : 'เปิด 🎮') }}
          </button>
        </div>

        <div class="admin-hint" style="margin-top:8px">
          ⚠️ มินิเกมที่ปิดคือ 2048 / Stacker / Capsule Rush เท่านั้น —
          <b>ตัวฝึกคำนวณ CrCl ในหน้าเตรียมสอบไม่ได้ถูกปิดด้วย</b>
        </div>
      </section>
```

- [ ] **Step 2: เพิ่มฟังก์ชันใน script**

เพิ่มต่อจากฟังก์ชัน `togglePvp()`:

```js
// ── เปิด/ซ่อน ฟีเจอร์รอง (config/app.expeditionOpen / arcadeOpen) ──
const savingFocus = ref(false)
const FOCUS_LABEL = { expeditionOpen: 'ส่งผจญภัย', arcadeOpen: 'มินิเกม' }
async function toggleFocus(key) {
  const current = key === 'expeditionOpen' ? expeditionOpen.value : arcadeOpen.value
  const next = !current
  savingFocus.value = true
  try {
    await setDoc(doc(db, 'config', 'app'), { [key]: next }, { merge: true })
    toast(`${next ? 'เปิด' : 'ซ่อน'}${FOCUS_LABEL[key]}แล้ว`, 'success')
  } catch (e) {
    console.error('[admin focus]', key, e)
    toast('เปลี่ยนสถานะไม่สำเร็จ', 'error')
  } finally {
    savingFocus.value = false
  }
}
```

แก้บรรทัด 398 ที่มีอยู่แล้ว:

```js
const { maintenance, pvpOpen, expeditionOpen, arcadeOpen } = useAppConfig()
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 4: ทดลองจริงใน dev**

Run: `npm run dev` → เข้า `#/admin` ด้วยบัญชีแอดมิน
1. กด "เปิด 🎮" → ป้ายเปลี่ยนเป็น 🟢 → เปิด `#/play` (อีกแท็บ/บัญชีนักศึกษา) ต้องเห็น section มินิเกมกลับมา **ทันทีโดยไม่ต้อง refresh**
2. กด "ซ่อน" → หายไปทันทีเช่นกัน
3. ทำแบบเดียวกันกับส่งผจญภัย
4. เปิด Firebase console → `config/app` ต้องมี `expeditionOpen` / `arcadeOpen` เป็น boolean

- [ ] **Step 5: Commit**

```bash
git add src/views/AdminView.vue
git commit -F - <<'MSG'
Admin: สวิตช์โฟกัสเกม — เปิด/ซ่อน ส่งผจญภัยกับมินิเกม

กดแล้วมีผลทันทีผ่าน onSnapshot ไม่ต้อง deploy แบบเดียวกับ pvpOpen
เขียน config/app แบบ merge จึงไม่ทับ maintenance/pvpOpen ที่มีอยู่

เขียนกำกับในหน้าเลยว่ามินิเกมที่ปิดคือ 3 เกม arcade เท่านั้น ตัวฝึก CrCl
ในหน้าเตรียมสอบไม่ได้ถูกปิดด้วย — กันเข้าใจผิดตอนกดปิดแล้วนึกว่าพังฝั่งเรียน

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## เช็คหลังทำครบ 6 tasks

- [ ] `node --test src/utils/featureFlags.test.js src/utils/nextAction.test.js` ผ่านทั้งหมด
- [ ] เทสทั้งโปรเจกต์ยังผ่าน: `for f in src/utils/*.test.js src/data/*.test.js; do node --test "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
- [ ] `npm run build` สำเร็จ
- [ ] **`#/study/crcl` ยังทำงานปกติตอน arcade ปิด** (จุดเสี่ยงที่สุดของงานนี้)
- [ ] บัญชีนักศึกษา: `#/play` เหลือ 2 การ์ด · `#/play/pets` เหลือ 4 การ์ด · ลิงก์ตรงเด้งกลับ
- [ ] บัญชีแอดมิน: เข้าได้หมดทั้งที่ flag ปิด
- [ ] `grep -rn "minigameCore\|useMinigameBoard" src/ | grep -v test` — ไม่มีไฟล์ไหนถูกแก้ในงานนี้
- [ ] ยังไม่ push — รอ user เทสจอจริงก่อน
