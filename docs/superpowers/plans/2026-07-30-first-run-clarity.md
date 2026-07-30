# นาทีแรกเข้าใจง่าย — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้นักศึกษาที่เปิดแอพครั้งแรกรู้ว่าตัวเองควรทำอะไร และไม่ถูกกลไกเกม 9 ระบบถล่มใส่ — ด้วยการ์ด "ทำอะไรต่อ" บน Home, ทัวร์ 3 จอ, ล็อกศัพท์ให้เหลือชุดเดียว, และเติมหัวข้อช่วยเหลือที่ขาด

**Architecture:** ตรรกะการเลือก "งานถัดไป" อยู่ใน pure util ตัวเดียว (`nextAction.js`) ที่เทสด้วย `node --test` ได้ — view เป็นแค่ชั้นแสดงผล · ทัวร์ใช้ flag `seenIntro` บน user doc ตามแพทเทิร์น `seenV2Notice` ของ `MigrationWelcome` · **ไม่เพิ่ม Firestore read และไม่แก้ `firestore.rules`** (ฝั่ง `users/{userId}` ไม่มี `hasOnly` จึงเพิ่มฟิลด์ได้เลย)

**Tech Stack:** Vue 3 (script setup) + Pinia + Firebase Firestore · ไม่มี test runner กลาง — pure util เทสด้วย `node --test`, view ตรวจด้วย `npm run build`

**Spec:** `docs/superpowers/specs/2026-07-30-first-run-clarity-design.md`

## Global Constraints

- ข้อความจากผู้ใช้ทุกช่องต้องผ่าน `cleanText(str, LIMITS.xxx)` จาก `utils/text.js` ก่อนเขียน Firestore เสมอ (งานนี้ไม่มีช่องกรอกใหม่ จึงไม่มีจุดที่ต้องใช้ — อย่าเพิ่มช่องกรอก)
- คอมเมนต์ในโค้ดและ commit message เป็นไทยปนอังกฤษ · รูปแบบ commit: `Area: อะไร (ทำไม)`
- โทนข้อความผู้ใช้ยึด `docs/voice-guide.md` — เป็นกันเอง อธิบายว่าทำอะไรได้อะไร ไม่หวือหวา ไม่ตะโกน
- single-file component + `<style scoped>` · สีธีมหลัก indigo `#4f46e5` · ขอบ `2px solid var(--ink)` + `box-shadow: var(--pop)` + `:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink) }` (ภาษาภาพ sticker ของโปรเจกต์)
- **เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น** — คืน boolean, caller เป็นคน toast เอง
- `overlay/modal` ที่ `position:fixed` **ใต้ `<RouterView>`** ต้องห่อ `<Teleport to="body">` (กับดักข้อ 6 ใน CLAUDE.md) — งานนี้ mount ทัวร์ที่ **ระดับ root ใน `App.vue`** ซึ่งเป็น sibling ของ `#bottom-nav` อยู่แล้ว **จึงไม่ต้อง Teleport** (แบบเดียวกับ `MigrationWelcome`)
- **ห้ามแตะชื่อฟิลด์/คีย์/ชื่อฟังก์ชันในโค้ด** (`pet.copies`, `rarity: 'legendary'`, `pickLegendary`, `dailyQuest.gacha`) — งานล็อกศัพท์แก้เฉพาะ **ข้อความที่ผู้ใช้เห็น**
- **ไม่แตะ** `firestore.rules` · `data/pets` catalog · ระบบเกมใดๆ · IA/routing · ป้าย "เร็วๆ นี้" ที่มีอยู่
- ห้ามเพิ่ม Firestore read ใน `nextAction` — รับ `userData` ที่โหลดมาแล้วเท่านั้น

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|------|----------------|
| `src/utils/nextAction.js` **(ใหม่)** | ตรรกะเลือกงานถัดไป 1 อย่าง (pure) |
| `src/utils/nextAction.test.js` **(ใหม่)** | เทส `node --test` ครอบทุกกฎ + ลำดับ |
| `src/components/home/NextActionCard.vue` **(ใหม่)** | แสดงผลการ์ด 1 ใบ |
| `src/components/onboarding/IntroTour.vue` **(ใหม่)** | ทัวร์ 3 จอนาทีแรก |
| `src/views/HomeView.vue` | เสียบการ์ด + เปิด sheet เควสเมื่อการ์ดสั่ง |
| `src/App.vue` | เสียบ `IntroTour` |
| `src/data/userSchema.js` | `seenIntro: false` |
| `src/data/guide.js` | +6 หัวข้อช่วยเหลือ |
| `src/views/ArenaView.vue` · `ExpeditionView.vue` · `PetHubView.vue` · `CapsuleRushView.vue` | ปุ่ม ℹ️ ที่ยังไม่มี |
| `PetDetailModal.vue` · `ProfileModal.vue` · `SpendCopiesModal.vue` · `DailyQuestCard.vue` · `WelcomeBox.vue` · `ShopView.vue` · `utils/mailbox.js` | ล็อกศัพท์ |
| `CLAUDE.md` | ลบการอ้าง `data/potential.js` ที่ถูกลบไปแล้ว |

---

## Task 1: `nextAction` pure util (TDD)

**Files:**
- Create: `src/utils/nextAction.js`
- Test: `src/utils/nextAction.test.js`

**Interfaces:**
- Consumes: `questNotClaimed(dq, today)` จาก `src/utils/dailyQuest.js` (คืน `true` เมื่อวันนี้ยังไม่กดรับรางวัล — คืน `true` ด้วยเมื่อ `dq` เป็น `null`)
- Produces: `nextAction(userData, ctx) → Action | null` · `BATTLE_TEAM_SIZE = 3` · `Action = { key, icon, title, sub, cta, to? , sheet? }`

- [ ] **Step 1: เขียนเทสที่ต้องแดงก่อน**

สร้าง `src/utils/nextAction.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextAction, BATTLE_TEAM_SIZE } from './nextAction.js'

const TODAY = '2026-07-30'
const NOW = 1_800_000_000_000
const ctx = { today: TODAY, now: NOW }

// ผู้ใช้ที่ผ่านทุกกฎแล้ว = การ์ดต้องหาย (ใช้เป็นฐานแล้วถอยทีละกฎ)
function allDone() {
  return {
    studyReviewedTotal: 10,
    study: { cards: { a: { nextReviewDate: NOW + 999_999 } } },
    quizCoinDate: TODAY,
    dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: true },
    pets: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    activePets: ['p1', 'p2', 'p3'],
    farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, { seedId: 's' }] },
    expedition: { missionId: 'm1' },
  }
}

test('ไม่เข้าเงื่อนไขไหนเลย → null (ซ่อนการ์ด)', () => {
  assert.equal(nextAction(allDone(), ctx), null)
})

test('userData ว่าง/undefined → null (ไม่ throw)', () => {
  assert.equal(nextAction(undefined, ctx), null)
  assert.equal(nextAction(null, ctx), null)
})

test('กฎ 1: ยังไม่เคยทบทวนเลย → study-new', () => {
  const u = { ...allDone(), studyReviewedTotal: 0 }
  assert.equal(nextAction(u, ctx).key, 'study-new')
  assert.equal(nextAction(u, ctx).to, '/study')
})

test('กฎ 1 ครอบเคสฟิลด์หายด้วย (คนใหม่จริงๆ ไม่มีฟิลด์เลย)', () => {
  assert.equal(nextAction({}, ctx).key, 'study-new')
})

test('กฎ 2: มีการ์ดครบกำหนด → study-due พร้อมจำนวนในหัวข้อ', () => {
  const u = { ...allDone(), study: { cards: {
    a: { nextReviewDate: NOW - 1 }, b: { nextReviewDate: NOW }, c: { nextReviewDate: NOW + 1 },
  } } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'study-due')
  assert.match(a.title, /2/)            // a และ b ครบกำหนด (<= now) · c ยังไม่ถึง
})

test('กฎ 3: วันนี้ยังไม่ทำข้อสอบ → quiz-today', () => {
  const u = { ...allDone(), quizCoinDate: '2026-07-29' }
  assert.equal(nextAction(u, ctx).key, 'quiz-today')
  assert.equal(nextAction(u, ctx).to, '/quiz')
})

test('กฎ 4: เควสวันนี้ยังไม่กดรับ → quest (เปิด sheet ไม่ใช่ route)', () => {
  const u = { ...allDone(), dailyQuest: { date: TODAY, quiz: 5, farm: 3, gacha: 2, claimed: false } }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'quest')
  assert.equal(a.sheet, 'quest')
  assert.equal(a.to, undefined)
})

test('กฎ 5: ยังไม่มีเพ็ท → first-pet', () => {
  const u = { ...allDone(), pets: [] }
  assert.equal(nextAction(u, ctx).key, 'first-pet')
  assert.equal(nextAction(u, ctx).to, '/shop')
})

test('กฎ 6: ทีมไม่ครบ → team', () => {
  const u = { ...allDone(), activePets: ['p1', null, null] }
  const a = nextAction(u, ctx)
  assert.equal(a.key, 'team')
  assert.match(a.title, new RegExp(String(BATTLE_TEAM_SIZE)))
})

test('กฎ 7: มีแปลงว่างในช่วงที่ปลดล็อกแล้ว → farm-empty', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 2, plots: [{ seedId: 's' }, null] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 7: array สั้นกว่า plotsUnlocked = ช่องที่เหลือถือว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 3, plots: [{ seedId: 's' }] } }
  assert.equal(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 7: แปลงที่ยังไม่ปลดล็อก ไม่นับว่าว่าง', () => {
  const u = { ...allDone(), farm: { plotsUnlocked: 1, plots: [{ seedId: 's' }, null, null] } }
  assert.notEqual(nextAction(u, ctx).key, 'farm-empty')
})

test('กฎ 8: ไม่มีสายผจญภัยอยู่ → expedition', () => {
  const u = { ...allDone(), expedition: null }
  assert.equal(nextAction(u, ctx).key, 'expedition')
})

test('ลำดับ: การเรียนชนะเกมเสมอ (เข้าหลายกฎพร้อมกัน)', () => {
  const u = { ...allDone(), studyReviewedTotal: 0, pets: [], activePets: [], expedition: null,
    quizCoinDate: '2026-07-29', farm: { plotsUnlocked: 2, plots: [null, null] } }
  assert.equal(nextAction(u, ctx).key, 'study-new')
})

test('ลำดับ: ควิซชนะเควส · เควสชนะเพ็ท', () => {
  const base = { ...allDone(), quizCoinDate: '2026-07-29',
    dailyQuest: { date: TODAY, quiz: 0, farm: 0, gacha: 0, claimed: false }, pets: [] }
  assert.equal(nextAction(base, ctx).key, 'quiz-today')
  assert.equal(nextAction({ ...base, quizCoinDate: TODAY }, ctx).key, 'quest')
})

test('ไม่มี today ใน ctx → ข้ามกฎที่ต้องใช้วันที่ ไม่ throw', () => {
  const u = { ...allDone(), quizCoinDate: '2026-07-29' }
  const a = nextAction(u, { now: NOW })
  assert.equal(a, null)
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าแดง**

Run: `node --test src/utils/nextAction.test.js`
Expected: FAIL — `Cannot find module './nextAction.js'`

- [ ] **Step 3: เขียนโมดูล**

สร้าง `src/utils/nextAction.js`:

```js
// ════════════════════════════════════════════════════════════
//  งานถัดไปที่ควรทำ — pure
//  โชว์ทีละ 1 อย่างบน Home · ลิสต์คือปัญหาเดิม (ระบบ 9 อย่างกองกันจนคนใหม่ไม่รู้จะเริ่มไหน)
//  กฎเรียงตามลำดับ เจอข้อแรกที่เข้าเงื่อนไข = ใช้อันนั้น แล้วหยุด
//  การเรียนมาก่อนเกมทุกข้อ (user เคาะ 30 ก.ค.) — แอพนี้คือแอพเตรียมสอบ เกมเป็นรางวัล
//  ห้ามอ่าน Firestore ที่นี่: รับ userData ที่โหลดมาแล้วเท่านั้น (การ์ดนี้ต้องไม่มีต้นทุน read)
// ════════════════════════════════════════════════════════════
import { questNotClaimed } from './dailyQuest.js'

export const BATTLE_TEAM_SIZE = 3

// นับการ์ดที่ครบกำหนดทบทวน — study.cards เก็บ nextReviewDate เป็น epoch ms (ดู StudyView)
function dueCount(userData, now) {
  const cards = userData?.study?.cards || {}
  return Object.values(cards).filter(c => (c?.nextReviewDate || 0) <= now).length
}

// มีแปลงว่างในช่วงที่ปลดล็อกแล้วไหม
//  โครง farm.plots ตาม useFarm.js: null = ว่าง · array อาจสั้นกว่า plotsUnlocked ⇒ ช่องที่ยังไม่มี = ว่าง
function hasEmptyPlot(userData) {
  const farm = userData?.farm || {}
  const unlocked = farm.plotsUnlocked || 0
  const plots = farm.plots || []
  for (let i = 0; i < unlocked; i++) if (!plots[i]) return true
  return false
}

// คืนงานถัดไป 1 อย่าง หรือ null = ซ่อนการ์ด (ไม่ใช่การ์ดว่าง)
//  ctx.today = 'YYYY-MM-DD' (ไม่ส่ง = ข้ามกฎที่อิงวันที่) · ctx.now = epoch ms (ฉีดเพื่อเทส)
export function nextAction(userData, ctx = {}) {
  if (!userData) return null
  const { today = null, now = Date.now() } = ctx

  // 1) ยังไม่เคยทบทวนเลย — คนใหม่ยังไม่มีการ์ดใน study.cards ให้ due จับได้
  if (!(userData.studyReviewedTotal > 0)) {
    return {
      key: 'study-new', icon: '📚', title: 'เริ่มทบทวนแฟลชการ์ดชุดแรก',
      sub: 'ทบทวนได้เหรียญ และจำได้ดีกว่าอ่านรวบทีเดียว', cta: 'ไปทบทวน', to: '/study',
    }
  }
  // 2) มีการ์ดครบกำหนดค้างอยู่
  const due = dueCount(userData, now)
  if (due > 0) {
    return {
      key: 'study-due', icon: '📚', title: `ทบทวน ${due} ใบที่ครบกำหนด`,
      sub: 'ทบทวนตามรอบช่วยให้จำได้นานขึ้น', cta: 'ไปทบทวน', to: '/study',
    }
  }
  // 3) วันนี้ยังไม่ทำข้อสอบ
  if (today && userData.quizCoinDate !== today) {
    return {
      key: 'quiz-today', icon: '📝', title: 'ทำข้อสอบวันนี้',
      sub: 'ตอบถูกได้เหรียญทุกข้อ ทำมากได้มาก', cta: 'ไปทำข้อสอบ', to: '/quiz',
    }
  }
  // 4) เควสวันนี้ยังไม่ได้กดรับรางวัล — เปิด bottom-sheet บน Home ไม่ใช่เปลี่ยนหน้า
  if (today && questNotClaimed(userData.dailyQuest, today)) {
    return {
      key: 'quest', icon: '🎯', title: 'เควสประจำวันยังไม่ครบ',
      sub: 'ทำครบรับรายได้ ×1.5 กับตั๋วอัญเชิญฟรี', cta: 'ดูเควส', sheet: 'quest',
    }
  }
  // 5) ยังไม่มีเพ็ท
  const pets = userData.pets || []
  if (!pets.length) {
    return {
      key: 'first-pet', icon: '🥚', title: 'อัญเชิญเพ็ทตัวแรก',
      sub: 'เพ็ทเพิ่มรายได้รายวัน และใช้ลงสนามต่อสู้', cta: 'ไปร้านค้า', to: '/shop',
    }
  }
  // 6) ทีมต่อสู้ไม่ครบ
  const active = (userData.activePets || []).filter(Boolean)
  if (active.length < BATTLE_TEAM_SIZE) {
    return {
      key: 'team', icon: '⭐', title: `จัดทีมต่อสู้ให้ครบ ${BATTLE_TEAM_SIZE} ตัว`,
      sub: `ตอนนี้ ${active.length}/${BATTLE_TEAM_SIZE} — ทีมไม่ครบเสียเปรียบตอนสู้`,
      cta: 'ไปจัดทีม', to: '/play/pets',
    }
  }
  // 7) มีแปลงฟาร์มว่าง
  if (hasEmptyPlot(userData)) {
    return {
      key: 'farm-empty', icon: '🌱', title: 'มีแปลงฟาร์มว่างอยู่',
      sub: 'ปลูกทิ้งไว้ แล้วกลับมาเก็บขายเป็นเหรียญ', cta: 'ไปปลูก', to: '/play/farm',
    }
  }
  // 8) ส่งผจญภัยได้ — มาถึงบรรทัดนี้ได้แปลว่าทีมครบ 3 แล้ว (กฎ 6 คืนค่าไปก่อนถ้าไม่ครบ)
  if (!userData.expedition) {
    return {
      key: 'expedition', icon: '🧭', title: 'ส่งเพ็ทไปผจญภัย',
      sub: 'ส่งทิ้งไว้ตามเวลา กลับมารับของรางวัล', cta: 'ไปส่ง', to: '/play/pets',
    }
  }
  return null
}
```

- [ ] **Step 4: รันเทสให้เขียว**

Run: `node --test src/utils/nextAction.test.js`
Expected: PASS ทุกเทส output สะอาด

- [ ] **Step 5: Commit**

```bash
git add src/utils/nextAction.js src/utils/nextAction.test.js
git commit -m "Home: util nextAction เลือกงานถัดไปทีละอย่าง (คนใหม่ต้องรู้ว่าเริ่มที่ไหน)"
```

---

## Task 2: การ์ด "ทำอะไรต่อ" บน Home

**Files:**
- Create: `src/components/home/NextActionCard.vue`
- Modify: `src/views/HomeView.vue`

**Interfaces:**
- Consumes: `nextAction(userData, ctx)` จาก Task 1 · `useAuthStore().userData`
- **วันที่รูปแบบ `YYYY-MM-DD`:** โปรเจกต์นี้**ไม่มี helper กลาง** — ใช้นิพจน์ `new Date().toISOString().slice(0, 10)` ซ้ำ inline อยู่แล้วอย่างน้อย 8 จุด (`views/HomeView.vue:70`, `views/StudyView.vue:243`, `views/QuizView.vue:437`, `views/ShopView.vue:203`, `composables/useFarm.js:92`, `composables/useArena.js:19`, `components/home/DailyQuestCard.vue:45`) ⇒ **ใช้นิพจน์เดียวกันนี้** ตามแพทเทิร์นเดิม **ห้ามสร้าง util วันที่ใหม่ในงานนี้** (การรวบให้เป็น helper เดียวเป็น refactor ข้ามระบบ อยู่นอกขอบเขต — จดไว้ใน ROADMAP ได้ถ้าอยากทำภายหลัง)
- Produces: —

- [ ] **Step 1: สร้างคอมโพเนนต์**

สร้าง `src/components/home/NextActionCard.vue`:

```vue
<!-- src/components/home/NextActionCard.vue — บอกว่า "ตอนนี้ทำอะไร" ทีละ 1 อย่าง -->
<template>
  <component
    :is="action.to ? RouterLink : 'button'"
    v-if="action"
    :to="action.to"
    :type="action.to ? undefined : 'button'"
    class="na-card"
    @click="onClick"
  >
    <span class="na-ico"><Emoji :char="action.icon" /></span>
    <span class="na-txt">
      <b class="na-title">{{ action.title }}</b>
      <small class="na-sub">{{ action.sub }}</small>
    </span>
    <span class="na-cta">{{ action.cta }} ›</span>
  </component>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { nextAction } from '../../utils/nextAction.js'

const emit = defineEmits(['sheet'])
const auth = useAuthStore()

// คำนวณสดจาก userData ที่มีอยู่ในหน่วยความจำ — ไม่มีต้นทุน read
// วันที่ใช้นิพจน์เดียวกับที่ทั้งโปรเจกต์ใช้อยู่ (HomeView:70, StudyView:243, ฯลฯ) — ไม่มี helper กลาง
const action = computed(() => nextAction(
  auth.userData,
  { today: new Date().toISOString().slice(0, 10), now: Date.now() },
))

function onClick() {
  if (action.value?.sheet) emit('sheet', action.value.sheet)
}
</script>

<style scoped>
.na-card { display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; text-align: left; text-decoration: none; background: var(--primary-light, #eef2ff); border: 2px solid var(--ink); border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: var(--pop); cursor: pointer; font-family: inherit; transition: transform .12s, box-shadow .12s; }
.na-card:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.na-ico { font-size: 1.7rem; flex-shrink: 0; }
.na-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.na-title { font-size: .92rem; color: var(--ink); line-height: 1.3; }
.na-sub { font-size: .72rem; color: rgba(0,0,0,.55); line-height: 1.4; }
.na-cta { flex-shrink: 0; font-size: .74rem; font-weight: 800; color: #4f46e5; }
</style>
```

- [ ] **Step 2: เสียบเข้า HomeView**

ใน `src/views/HomeView.vue` เพิ่ม import:

```js
import NextActionCard from '../components/home/NextActionCard.vue'
```

แล้ววางการ์ด **ใต้ `<ExamCountdown />` เหนือ `<ResidenceCard />`** (คำตอบว่า "ทำอะไร" ต้องเป็นสิ่งแรกที่เห็น):

```html
      <!-- งานถัดไปที่ควรทำ — โชว์ทีละอย่าง ซ่อนตัวเองเมื่อไม่มีอะไรค้าง -->
      <NextActionCard @sheet="onCardSheet" />
```

เพิ่มฟังก์ชันในบล็อก `<script setup>` (ตัวแปร `showQuest` มีอยู่แล้วในไฟล์นี้):

```js
// การ์ดงานถัดไปสั่งเปิด bottom-sheet ได้ (เควสไม่มีหน้าแยก)
function onCardSheet(name) { if (name === 'quest') showQuest.value = true }
```

- [ ] **Step 3: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

Run: `node --test src/utils/nextAction.test.js`
Expected: PASS (ยืนยันว่าไม่ได้แก้ util โดยไม่ตั้งใจ)

- [ ] **Step 4: Commit**

```bash
git add src/components/home/NextActionCard.vue src/views/HomeView.vue
git commit -m "Home: การ์ดงานถัดไปบนสุดของหน้าแรก (ตอบคำถามว่าตอนนี้ควรทำอะไร)"
```

---

## Task 3: ทัวร์ 3 จอ นาทีแรก

**Files:**
- Create: `src/components/onboarding/IntroTour.vue`
- Modify: `src/data/userSchema.js`, `src/App.vue`

**Interfaces:**
- Consumes: `useAuthStore()` → `userData`, `currentUser`, `patchUser(optimistic, server)`
- Produces: ฟิลด์ `seenIntro: boolean` บน `users/{uid}`

- [ ] **Step 1: ประกาศฟิลด์ใน schema กลาง**

ใน `src/data/userSchema.js` เพิ่มใน `USER_DEFAULTS` ถัดจาก `petsMigratedV2`:

```js
  seenIntro: false,                           // one-time: เคยดูทัวร์แนะนำแอพแล้ว
```

- [ ] **Step 2: สร้างคอมโพเนนต์ทัวร์**

สร้าง `src/components/onboarding/IntroTour.vue`:

```vue
<!-- src/components/onboarding/IntroTour.vue — ทัวร์ 3 จอครั้งแรกที่เข้าแอพ
     mount ระดับ root ใน App.vue (sibling ของ #bottom-nav) → ไม่ต้อง Teleport -->
<template>
  <div v-if="show" class="it-ov">
    <div class="it-box">
      <div class="it-dots">
        <span v-for="n in 3" :key="n" class="it-dot" :class="{ on: n === step }"></span>
      </div>

      <template v-if="step === 1">
        <div class="it-ico"><Emoji char="📚" /></div>
        <div class="it-title">แอพเตรียมสอบของรุ่นเรา</div>
        <p class="it-body">ทบทวนแฟลชการ์ดกับทำข้อสอบเก็บไว้ที่นี่ที่เดียว — ทำแล้วได้เหรียญติดตัวด้วย</p>
      </template>

      <template v-else-if="step === 2">
        <div class="it-ico"><Emoji char="🪙" /></div>
        <div class="it-title">เหรียญเอาไปทำอะไร</div>
        <p class="it-body">อัปบ้านให้รายได้ต่อวันเพิ่มขึ้น · อัญเชิญเพ็ทมาลงสนามต่อสู้ · ปลูกฟาร์มเก็บขาย</p>
        <p class="it-body it-body-dim">ไม่ต้องรีบเล่นครบทุกอย่าง ค่อยๆ เปิดดูได้</p>
      </template>

      <template v-else>
        <div class="it-ico"><Emoji char="🚀" /></div>
        <div class="it-title">เริ่มที่การทบทวนก่อน</div>
        <p class="it-body">สงสัยอะไรกดปุ่ม ℹ️ ที่มุมของแต่ละหน้าได้เลย มีคำอธิบายให้ทุกหน้า</p>
      </template>

      <button class="it-btn" @click="next">{{ step < 3 ? 'ต่อไป →' : 'ไปทบทวนเลย' }}</button>
      <button class="it-skip" @click="finish(false)">ข้ามไปก่อน</button>
    </div>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()

const step = ref(1)
const dismissed = ref(false)
const show = computed(() => !dismissed.value && auth.isLoggedIn && !auth.userData?.seenIntro)

function next() {
  if (step.value < 3) { step.value += 1; return }
  finish(true)
}

// ปิดทัวร์ + ประทับ flag (ไม่ toast — ผู้ใช้ไม่ได้ขออะไร) · goStudy=true เฉพาะตอนกดจบจอสุดท้าย
async function finish(goStudy) {
  dismissed.value = true
  await auth.patchUser({ seenIntro: true }, { seenIntro: true })
  if (goStudy) router.push('/study')
}
</script>

<style scoped>
.it-ov { position: fixed; inset: 0; z-index: 330; background: linear-gradient(160deg,#eef2ff,#fff); display: flex; align-items: center; justify-content: center; padding: 18px; }
.it-box { background: #fff; width: 100%; max-width: 400px; border: 2px solid var(--ink); border-radius: 20px; box-shadow: var(--pop-lg); padding: 24px 22px; text-align: center; }
.it-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 16px; }
.it-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.15); }
.it-dot.on { background: #4f46e5; }
.it-ico { font-size: 2.6rem; margin-bottom: 8px; }
.it-title { font-family: var(--font-display); font-weight: 400; font-size: 1.3rem; color: var(--ink); margin-bottom: 10px; }
.it-body { font-size: .84rem; color: rgba(0,0,0,.65); line-height: 1.6; margin: 0 0 10px; }
.it-body-dim { font-size: .76rem; color: rgba(0,0,0,.45); }
.it-btn { width: 100%; border: 2px solid var(--ink); border-radius: 12px; padding: 13px; margin-top: 6px; font-family: inherit; font-size: .92rem; font-weight: 800; color: #fff; background: var(--gold); box-shadow: var(--pop); cursor: pointer; transition: transform .12s, box-shadow .12s; }
.it-btn:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.it-skip { background: none; border: none; color: var(--muted); font-size: .78rem; margin-top: 10px; padding: 8px; cursor: pointer; }
</style>
```

- [ ] **Step 3: เสียบเข้า App.vue**

ใน `src/App.vue` เพิ่ม import ถัดจาก `MigrationWelcome`:

```js
import IntroTour from './components/onboarding/IntroTour.vue'
```

และวางแท็กถัดจาก `<MigrationWelcome />` (ในบล็อก `<template v-else-if="authStore.isQuestionEditor || !maintenance">`):

```html
      <IntroTour />
```

- [ ] **Step 4: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `node --test src/utils/nextAction.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/IntroTour.vue src/data/userSchema.js src/App.vue
git commit -m "Onboarding: ทัวร์ 3 จอครั้งแรกเข้าแอพ (บอกว่าแอพนี้คืออะไรและเริ่มที่ไหน)"
```

---

## Task 4: ล็อกศัพท์ให้เหลือชุดเดียว

**Files:**
- Modify: `src/components/pets/PetDetailModal.vue`, `src/components/members/ProfileModal.vue`, `src/components/shop/SpendCopiesModal.vue`, `src/components/home/DailyQuestCard.vue`, `src/components/WelcomeBox.vue`, `src/views/ShopView.vue`, `src/utils/mailbox.js`

**Interfaces:**
- Consumes: —
- Produces: —

> **ห้ามแตะชื่อฟิลด์/คีย์/ฟังก์ชัน** — `pet.copies`, `dailyQuest.gacha`, `pickLegendary`, `rarity:'legendary'` คงเดิมทั้งหมด แก้เฉพาะข้อความที่ผู้ใช้เห็น
> rarity **ไม่ต้องแก้** — มีคำไทยผ่าน `rarityLabel()` อยู่แล้ว (`data/index.js:11` `label:"ตำนาน"`)

- [ ] **Step 1: "ทีม Active" → "ทีมต่อสู้" (4 จุด)**

- `src/components/members/ProfileModal.vue:30` — `⭐ ทีม Active` → `⭐ ทีมต่อสู้`
- `src/components/pets/PetDetailModal.vue:18` — `อยู่ในทีม Active · กดเพื่อเอาออก` → `อยู่ในทีมต่อสู้ · กดเพื่อเอาออก`
- `src/components/pets/PetDetailModal.vue:19` — `ตั้งเป็นทีม Active ({{ activeList.length }}/{{ battleSlots }})` → `ใส่ในทีมต่อสู้ ({{ activeList.length }}/{{ battleSlots }})`
- `src/components/pets/PetDetailModal.vue:98` — toast `ทีม Active เต็ม (${battleSlots.value}) — เอาตัวอื่นออกก่อน` → `ทีมต่อสู้เต็ม (${battleSlots.value}) — เอาตัวอื่นออกก่อน`

- [ ] **Step 2: `copies` → "ตัวซ้ำ" (2 จุด)**

- `src/components/pets/PetDetailModal.vue:12` — `<span class="pd-tag">copies {{ pet.copies || 0 }}</span>` → `<span class="pd-tag">ตัวซ้ำ {{ pet.copies || 0 }}</span>`
- `src/components/shop/SpendCopiesModal.vue:6` — `เลือก {{ rarityLabel }} จ่าย copies` → `เลือก {{ rarityLabel }} จ่ายตัวซ้ำ`

- [ ] **Step 3: "กาชา" → "อัญเชิญ" ในข้อความผู้ใช้**

- `src/components/home/DailyQuestCard.vue:13` — `🎰 เปิดกาชา` → `🎰 อัญเชิญเพ็ท`
- `src/components/home/DailyQuestCard.vue:24` — `🎟️ ตั๋วกาชาฟรี ×{{ tickets }} (ใช้ที่ร้านค้า)` → `🎟️ ตั๋วอัญเชิญฟรี ×{{ tickets }} (ใช้ที่ร้านค้า)`
- `src/components/home/DailyQuestCard.vue:76` — toast `... + ตั๋วกาชาฟรี ×${QUEST_TICKETS}` → `... + ตั๋วอัญเชิญฟรี ×${QUEST_TICKETS}`
- `src/components/WelcomeBox.vue:10` — `🎟️ ตั๋วกาชา {{ WELCOME_GIFT_TICKETS }} ใบ` → `🎟️ ตั๋วอัญเชิญ {{ WELCOME_GIFT_TICKETS }} ใบ`
- `src/views/ShopView.vue:51` — `🎟️ ตั๋วกาชา: {{ tickets }} ใบ (ใช้ตั๋วก่อนอัตโนมัติ)` → `🎟️ ตั๋วอัญเชิญ: {{ tickets }} ใบ (ใช้ตั๋วก่อนอัตโนมัติ)`
- `src/utils/mailbox.js:91` — ข้อความจดหมายต้อนรับ `... + ตั๋วกาชา ${WELCOME_GIFT_TICKETS} ใบ` → `... + ตั๋วอัญเชิญ ${WELCOME_GIFT_TICKETS} ใบ`

> **ตรวจแล้วว่าปลอดภัย:** `firestore.rules` ฝั่ง `users/{userId}/mail/welcome-v1` ตรวจแค่ `from`, `claimed`, และค่าใน `reward` (`coins == 15000`, `tickets == 50`) — **ไม่ได้ตรวจข้อความ `body`** ⇒ แก้คำในจดหมายไม่ทำให้สร้างจดหมายต้อนรับพัง
> คอมเมนต์ในโค้ดที่มีคำ "กาชา" (`utils/dailyQuest.js:4`, `utils/expedition.js:50`, `utils/gachaMerge.js:1`, `utils/mailbox.js:16`) **ไม่ต้องแก้** — ผู้ใช้ไม่เห็น
> คำ "กาชา" ใน `src/data/guide.js` (บรรทัด 11 และ 68) **ผู้ใช้เห็นผ่าน HelpModal แต่ไม่แก้ใน task นี้** — ไปแก้ใน Task 5 ที่แก้ไฟล์นั้นอยู่แล้ว (กันสอง task แย่งไฟล์เดียวกัน)

- [ ] **Step 4: ตรวจงาน**

Run: `grep -rn "ทีม Active" src/`
Expected: ไม่มีผลลัพธ์

Run: `grep -rn "จ่าย copies\|pd-tag\">copies\|ตั๋วกาชา\|เปิดกาชา" src/`
Expected: ไม่มีผลลัพธ์

Run: `npm run build`
Expected: build ผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/components/pets/PetDetailModal.vue src/components/members/ProfileModal.vue src/components/shop/SpendCopiesModal.vue src/components/home/DailyQuestCard.vue src/components/WelcomeBox.vue src/views/ShopView.vue src/utils/mailbox.js
git commit -m "Copy: ล็อกศัพท์ทีมต่อสู้/ตัวซ้ำ/อัญเชิญให้เหลือชุดเดียว (คำเดียวกันทั้งแอพ)"
```

---

## Task 5: เติมหัวข้อช่วยเหลือ + ปุ่ม ℹ️ + แก้เอกสาร

**Files:**
- Modify: `src/data/guide.js`, `src/views/ArenaView.vue`, `src/views/ExpeditionView.vue`, `src/views/PetHubView.vue`, `src/views/CapsuleRushView.vue`, `CLAUDE.md`

**Interfaces:**
- Consumes: `GUIDE` keyed by topic, รูปแบบ `{ icon, title, body[], soon?, table? }` (ดูหัวไฟล์ `data/guide.js`) · `<HelpButton topic="..." />`
- Produces: หัวข้อใหม่ 6 อัน — `arena` `expedition` `minigames` `summon` `grade` `element`

- [ ] **Step 1: เพิ่ม 6 หัวข้อใน `data/guide.js`**

เพิ่มต่อท้ายอ็อบเจกต์ `GUIDE` (ก่อนปิดปีกกา) — แต่ละหัวข้อตอบ 3 คำถาม: คืออะไร · ได้อะไร · เริ่มยังไง

```js
  arena: {
    icon: '⚔️', title: 'สนามประลอง',
    body: [
      'เอาทีมต่อสู้ 3 ตัวไปสู้กับทีมของเพื่อนในรุ่น ผลัดกันบุกเก็บแต้มสะสม',
      'ระบบจะจับคู่ให้เองจากคนที่พลังใกล้เคียงกัน ไม่ต้องรอเพื่อนออนไลน์ เพราะสู้กับทีมที่เขาจัดไว้',
      'จัดทีมให้ครบ 3 ตัวก่อนที่คลังเพ็ท แล้วกดบุกได้เลย',
    ],
  },
  expedition: {
    icon: '🧭', title: 'ส่งผจญภัย',
    body: [
      'ส่งเพ็ทออกไปทำภารกิจตามเวลาที่เลือก ระหว่างนั้นปิดแอพไปทำอย่างอื่นได้',
      'ครบเวลาแล้วกลับมากดรับของรางวัล — ได้เหรียญและมีโอกาสได้ตั๋วอัญเชิญ',
      'ส่งได้ครั้งละ 1 สาย ยิ่งเลือกเวลานานยิ่งได้เยอะ',
    ],
  },
  minigames: {
    icon: '🕹️', title: 'มินิเกม',
    body: [
      'เกมสั้นๆ เล่นแก้เบื่อ ทำคะแนนได้เหรียญตามคะแนนที่ทำได้',
      'มีกระดานคะแนนของรุ่นให้ดูว่าใครทำได้เท่าไร',
      'เล่นได้ไม่จำกัดรอบ แต่เหรียญคิดตามคะแนนจริง ไม่ใช่ตามจำนวนรอบที่เล่น',
    ],
  },
  summon: {
    icon: '🎰', title: 'อัญเชิญเพ็ท',
    body: [
      'ใช้เหรียญหรือตั๋วอัญเชิญสุ่มเพ็ทมาเข้าคลัง ตั๋วจะถูกใช้ก่อนเหรียญอัตโนมัติ',
      'ถ้าสุ่มไม่ได้ตัวหายากนานๆ ระบบมีตัวช่วยรับประกันให้ — ยิ่งสุ่มพลาดสะสม โอกาสยิ่งขยับขึ้น',
      'สุ่มได้ตัวที่มีอยู่แล้วจะกลายเป็น "ตัวซ้ำ" เก็บไว้ใช้วิวัฒน์ให้เพ็ทตัวนั้นแรงขึ้น',
    ],
  },
  grade: {
    icon: '🌟', title: 'เกรดเพ็ท',
    body: [
      'เกรดคือระดับความแข็งแรงของเพ็ทแต่ละตัว ไล่จาก I ขึ้นไปถึง V',
      'อัปเกรดด้วยการวิวัฒน์ — ใช้ตัวซ้ำของเพ็ทตัวนั้นบวกเหรียญ',
      'เกรดสูงขึ้น = พลังโจมตีและพลังชีวิตเพิ่ม ทั้งตอนสู้และตอนคิดรายได้รายวัน',
    ],
  },
  element: {
    icon: '🔥', title: 'ธาตุ',
    body: [
      'เพ็ททุกตัวมีธาตุประจำตัว และธาตุมีความสัมพันธ์แพ้ชนะกันเป็นวงจร',
      'เจอธาตุที่ตัวเองข่ม จะตีแรงขึ้น · เจอธาตุที่ข่มตัวเอง จะตีเบาลง',
      'เวลาจัดทีมลองผสมหลายธาตุไว้ จะรับมือคู่ต่อสู้ได้หลากหลายกว่าทีมธาตุเดียว',
    ],
  },
```

- [ ] **Step 2: แก้คำ "กาชา" ที่เหลืออยู่ใน `guide.js` (ผู้ใช้เห็นผ่าน HelpModal)**

- บรรทัด 11 (ในหัวข้อ `play`) — `คลังเพ็ท ร้านค้าเพ็ท (กาชา/ห้องทดลอง) ปีนหอคอย` → `คลังเพ็ท ร้านค้าเพ็ท (อัญเชิญ/ห้องทดลอง) ปีนหอคอย`
- บรรทัด 68 (title ของหัวข้อ `shop`) — `title: 'ร้านค้า · กาชา'` → `title: 'ร้านค้า · อัญเชิญ'`

- [ ] **Step 3: ใส่ปุ่ม ℹ️ ใน 4 view ที่ยังไม่มี**

รูปแบบที่โปรเจกต์ใช้ (ดู `src/views/TowerView.vue:6`): `<HelpButton topic="..." />` วางในหัวข้อของหน้า พร้อม `import HelpButton from '../components/help/HelpButton.vue'`

- `src/views/ArenaView.vue` → `topic="arena"`
- `src/views/ExpeditionView.vue` → `topic="expedition"`
- `src/views/PetHubView.vue` → `topic="pets"` (หัวข้อเพ็ทมีอยู่แล้ว — ไม่ต้องสร้างใหม่)
- `src/views/CapsuleRushView.vue` → `topic="minigames"`

อ่านหัวของแต่ละไฟล์ก่อนวาง แล้ววางให้เข้ากับโครงหัวข้อเดิมของหน้านั้น (บางหน้าใช้ `style="margin-left:auto"` เพื่อดันไปขวา — ดู `PetsView.vue:6`)

- [ ] **Step 4: แก้เอกสารที่เพี้ยนจากโค้ด**

ใน `CLAUDE.md` บรรทัด 77 ลบการอ้าง `data/potential.js` ที่ถูกลบไปแล้ว — แก้จาก

```
- ฟาร์ม `data/crops.js` (ปลดล็อกตามเลเวลบ้าน) · กาชา `data/shop.js` · ศักยภาพ `data/potential.js` (ยังไม่เปิด — 6/7 affix ยังหมัน)
```

เป็น

```
- ฟาร์ม `data/crops.js` (ปลดล็อกตามเลเวลบ้าน) · อัญเชิญเพ็ท `data/shop.js` (ระบบศักยภาพถอดออกแล้ว — pet build depth ไปที่ passive)
```

- [ ] **Step 5: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `grep -c "title:" src/data/guide.js`
Expected: `15` (เดิม 9 + ใหม่ 6)

Run: `grep -rn "potential.js" CLAUDE.md`
Expected: ไม่มีผลลัพธ์

Run: `grep -rn "กาชา" src/data/guide.js`
Expected: ไม่มีผลลัพธ์

- [ ] **Step 6: Commit**

```bash
git add src/data/guide.js src/views/ArenaView.vue src/views/ExpeditionView.vue src/views/PetHubView.vue src/views/CapsuleRushView.vue CLAUDE.md
git commit -m "Help: เติมคำอธิบาย 6 หัวข้อ + ปุ่ม ℹ️ 4 หน้า + แก้ CLAUDE.md ที่อ้างไฟล์ที่ลบแล้ว"
```

---

## หลังทำครบทุก Task

- [ ] **รันเทส pure util ทั้งหมด**

Run: `node --test src/utils/nextAction.test.js src/utils/questionReview.test.js src/utils/questionCategories.test.js src/utils/questionsFilter.test.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js`
Expected: PASS ทุกไฟล์

- [ ] **Build**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

- [ ] **Deploy**

```bash
git push origin master     # GitHub Pages (host หลัก) — ไม่ต้อง deploy rules เพราะงานนี้ไม่แก้ rules
```

- [ ] **สิ่งที่ user ต้องเทสบนจอจริง (มือถือ)**

1. บัญชีที่ยังไม่เคยเห็นทัวร์ → เข้าแอพต้องเจอทัวร์ 3 จอ · กด "ข้ามไปก่อน" ได้ · รีโหลดแล้วไม่โผล่ซ้ำ
2. กดจนจบจอ 3 → เด้งไป `/study`
3. Home: การ์ดงานถัดไปอยู่ **บนสุดใต้ตัวนับวันสอบ** · กดแล้วไปหน้าที่ถูก
4. ทำสิ่งที่การ์ดบอกให้ครบ → การ์ดต้องเปลี่ยนเป็นงานถัดไป **โดยไม่ต้องรีโหลด**
5. บัญชีที่ทำทุกอย่างครบแล้ว (ทบทวนหมด · ทำข้อสอบแล้ว · รับเควสแล้ว · ทีมครบ · ฟาร์มเต็ม · ส่งผจญภัยแล้ว) → **การ์ดต้องหายไปเลย ไม่ใช่การ์ดว่าง**
6. การ์ดที่เป็นเควส (`ดูเควส`) → กดแล้วเปิด bottom-sheet เควส ไม่ใช่เปลี่ยนหน้า
7. ปุ่ม ℹ️ ใน 4 หน้าใหม่ → กดแล้วเห็นคำอธิบายที่ตรงกับหน้านั้น
8. คำศัพท์: หาคำว่า "ทีม Active" / "copies" / "ตั๋วกาชา" ในแอพไม่เจออีก

---

## Self-Review (ผู้เขียนแผนตรวจเองแล้ว)

**ความครอบคลุมเทียบสเปก:** §1 การ์ดทำอะไรต่อ (กฎ 8 ข้อ + ลำดับ + ตำแหน่งบน Home + ไม่เพิ่ม read) → Task 1–2 · §2 ทัวร์ 3 จอ (flag `seenIntro` + mount root ไม่ Teleport + ข้ามได้ + ปุ่มจบไป `/study`) → Task 3 · §3 ล็อกศัพท์ (ทีม Active 4 · copies 2 · กาชา) → Task 4 · §4 เติม guide 6 หัวข้อ + ℹ️ 4 view + `CLAUDE.md:77` → Task 5 · ข้อจำกัดที่ยอมรับ 3 ข้อในสเปก → สะท้อนในโค้ด/คอมเมนต์ของ Task 1 และ Task 3

**Placeholder scan:** เจอ 1 จุดตอนตรวจ (`todayKey()` ใน Task 2) → ไปหาของจริงแล้วพบว่า**โปรเจกต์ไม่มี helper วันที่กลาง** ใช้ `new Date().toISOString().slice(0, 10)` inline ซ้ำ 8 จุด ⇒ แก้แผนให้ใส่นิพจน์จริงพร้อมอ้างไฟล์ตัวอย่าง และห้ามสร้าง util ใหม่ในงานนี้ (refactor ข้ามระบบ อยู่นอกขอบเขต)

**Type consistency:** `Action` ที่ Task 1 คืน (`{ key, icon, title, sub, cta, to?, sheet? }`) ตรงกับที่ `NextActionCard.vue` อ่านทุกคีย์ · `sheet: 'quest'` ที่ Task 1 ตั้ง ตรงกับ `onCardSheet(name)` ที่ Task 2 เทียบ · `seenIntro` สะกดเหมือนกันทั้ง Task 3 (schema, `patchUser`, computed `show`)

**จุดที่ต้องระวังตอนลงมือ (เขียนกำกับไว้ในแผนแล้ว):**
- Task 4 แก้ข้อความจดหมายต้อนรับ — ตรวจ rules แล้วว่าไม่ตรวจ `body` จึงปลอดภัย
- กฎ 8 (ผจญภัย) ไม่ต้องเช็กทีมครบซ้ำ เพราะกฎ 6 คืนค่าไปก่อนแล้ว — มีคอมเมนต์กำกับกันคนอ่านเข้าใจผิดว่าลืม
