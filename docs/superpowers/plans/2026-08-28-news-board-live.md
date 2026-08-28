# กระดานข่าวมีชีวิตชีวา — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้กระดานข่าวหน้า Home มีข่าวไหลเข้าตลอดจากกิจกรรมจริงในเกม โดยใช้ read น้อยลงกว่าเดิม

**Architecture:** สองเลน — ข่าวไหลเร็วเกาะไปกับแถว `roster/current` ของเจ้าตัว (`ev` สูงสุด 3 รายการ พ่วงไปกับ write ที่เกิดอยู่แล้ว) ส่วนข่าว "ครั้งแรก/ที่หนึ่งของรุ่น" ลง collection `news` เหมือนเดิม · ตรรกะรวมฟีดทั้งหมดอยู่ใน `utils/newsFeed.js` ที่เป็นฟังก์ชันล้วนและมีเทส · `NewsBoard.vue` แค่เรียกใช้

**Tech Stack:** Vue 3 SFC + Pinia + Firestore · เทส `node --test` (ไม่มี runner กลาง) · build ตรวจด้วย `npm run build`

**สเปก:** `docs/superpowers/specs/2026-08-28-news-board-live-design.md`

## Global Constraints

- ฟอนต์ทุกจุดใน `.vue`/`.css` ต้อง ≥ `.7rem` — ตรวจ `grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น
- **CLAUDE.md ข้อ 9:** หยิบค่าที่ต้องใช้ (ชั้น/เลเวล/เกรด/คะแนน/เรต) เก็บเป็นตัวแปร **ก่อน** เรียก `patchUser` เสมอ
- **CLAUDE.md ข้อ 8:** ห้ามใช้ `v-html` ใน NewsBoard — ใช้ `{{ }}` อย่างเดียว
- ห้ามใช้ `backdrop-filter`/blur ในอนิเมชัน (iOS Safari paint)
- แถว roster: `ev` ต่อท้าย **หลัง** `h` เสมอ (ลำดับคีย์คงที่ = `rosterRowChanged` เทียบ JSON ได้ตรง)
- ข่าวยิงแบบ best-effort — ล้มเหลว = `console.warn` เงียบ ห้าม toast ห้าม retry ห้ามบล็อกการเล่น
- ห้ามอ่าน Firestore เพิ่มเพื่อเช็คอันดับ — ไม่มี `rosterRows` ในมือ = ไม่ยิงข่าวนั้น
- commit รูปแบบ `Area: อะไร (ทำไม)` ไทยปนอังกฤษ

---

### Task 1: `utils/newsFeed.js` — แกนตรรกะฟีด

**Files:**
- Create: `src/utils/newsFeed.js`
- Test: `src/utils/newsFeed.test.js`

**Interfaces:**
- Consumes: `MINIGAMES` จาก `src/data/minigames.js`, `TA_MODES` จาก `src/utils/timeAttack.js`
- Produces:
  - `EVENT_MAX = 3`, `FEED_MAX = 10`, `PER_USER_MAX = 2`, `EVENT_TTL_MS`
  - `pushEvent(list, ev) -> array`
  - `rankOfScore(rows, myUid, pick, score) -> number` (อันดับ 1-based ของคะแนนนี้ในรุ่น)
  - `buildFeed(rows, newsDocs, { now, myUid }) -> [{ id, icon, text, t }]`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน** — `src/utils/newsFeed.test.js`

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { pushEvent, rankOfScore, buildFeed, EVENT_MAX } from './newsFeed.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

test('pushEvent ต่อหน้าสุด ตัดเหลือ EVENT_MAX', () => {
  let list = []
  for (let i = 1; i <= 5; i++) list = pushEvent(list, { k: 'tw', v: i * 10, t: NOW + i })
  assert.equal(list.length, EVENT_MAX)
  assert.equal(list[0].v, 50)
  assert.equal(list[2].v, 30)
})

test('pushEvent entry เสีย = ไม่แตะของเดิม', () => {
  const prev = [{ k: 'tw', v: 10, t: NOW }]
  assert.deepEqual(pushEvent(prev, null), prev)
  assert.deepEqual(pushEvent(prev, { v: 1 }), prev)   // ไม่มี k
})

test('rankOfScore นับเฉพาะคนอื่นที่คะแนนสูงกว่า', () => {
  const rows = { a: { m: { g2048: 900 } }, b: { m: { g2048: 500 } }, me: { m: { g2048: 100 } } }
  const pick = (r) => r?.m?.g2048 || 0
  assert.equal(rankOfScore(rows, 'me', pick, 1000), 1)
  assert.equal(rankOfScore(rows, 'me', pick, 600), 2)
  assert.equal(rankOfScore(rows, 'me', pick, 10), 3)
})

test('buildFeed เรียงใหม่→เก่า และประกอบชื่อจากแถว', () => {
  const rows = {
    a: { n: 'มายด์', ev: [{ k: 'tw', v: 40, t: NOW - 1000 }] },
    b: { n: 'บีม', ev: [{ k: 'qz', v: 10, t: NOW - 10 }] },
  }
  const feed = buildFeed(rows, [], { now: NOW, myUid: null })
  assert.equal(feed.length, 2)
  assert.match(feed[0].text, /บีม/)
  assert.match(feed[1].text, /มายด์ ไต่หอคอยถึงชั้น 40/)
})

test('buildFeed ตัดข่าวเลน roster ที่เกิน 7 วัน แต่ไม่ตัด doc เลน news', () => {
  const rows = { a: { n: 'มายด์', ev: [{ k: 'tw', v: 40, t: NOW - 8 * DAY }] } }
  const docs = [{ id: 'n1', msg: 'ประกาศเก่า', icon: '📢', ts: { toDate: () => new Date(NOW - 30 * DAY) } }]
  const feed = buildFeed(rows, docs, { now: NOW, myUid: null })
  assert.equal(feed.length, 1)
  assert.equal(feed[0].text, 'ประกาศเก่า')
})

test('buildFeed จำกัด 2 บรรทัดต่อคน และตัดเหลือ 10', () => {
  const rows = {
    a: { n: 'มายด์', ev: [
      { k: 'tw', v: 30, t: NOW - 1 }, { k: 'tw', v: 20, t: NOW - 2 }, { k: 'tw', v: 10, t: NOW - 3 },
    ] },
  }
  const feed = buildFeed(rows, [], { now: NOW, myUid: null })
  assert.equal(feed.length, 2)
})

test('buildFeed ใช้คำว่า "คุณ" กับข่าวของตัวเอง', () => {
  const rows = { me: { n: 'ปาล์ม', ev: [{ k: 'hs', v: 5, t: NOW }] } }
  assert.match(buildFeed(rows, [], { now: NOW, myUid: 'me' })[0].text, /^คุณ /)
})

test('buildFeed ทนข้อมูลพัง: ev ไม่ใช่ array / k ไม่รู้จัก / ไม่มีชื่อ', () => {
  const rows = {
    a: { n: 'มายด์', ev: 'พัง' },
    b: { ev: [{ k: 'zz', v: 1, t: NOW }] },
    c: { ev: [{ k: 'tw', v: 12, t: NOW }] },
  }
  const feed = buildFeed(rows, [], { now: NOW, myUid: null })
  assert.equal(feed.length, 1)
  assert.match(feed[0].text, /^\? /)
})

test('buildFeed ประกอบข้อความได้ครบทุกชนิด', () => {
  const kinds = [
    { k: 'tw', v: 40 }, { k: 'pg', v: 5 }, { k: 'qz', v: 20 },
    { k: 'mg', g: 'g2048', v: 2 }, { k: 'ta', g: 'ta4', v: 3 },
    { k: 'hs', v: 7 }, { k: 'fo', v: 3200 }, { k: 'pv', v: 4 },
  ]
  for (const e of kinds) {
    const rows = { a: { n: 'มายด์', ev: [{ ...e, t: NOW }] } }
    const feed = buildFeed(rows, [], { now: NOW, myUid: null })
    assert.equal(feed.length, 1, `ชนิด ${e.k} ประกอบข้อความไม่ได้`)
    assert.ok(feed[0].text.length > 5 && feed[0].icon, `ชนิด ${e.k} ข้อความ/ไอคอนว่าง`)
  }
})
```

- [ ] **Step 2: รันให้เห็นว่าพัง**

Run: `node --test src/utils/newsFeed.test.js`
Expected: FAIL — `Cannot find module './newsFeed.js'`

- [ ] **Step 3: เขียน `src/utils/newsFeed.js`**

```js
/**
 * ฟีดกระดานข่าว — ตรรกะล้วน ไม่แตะ Firestore/Vue
 *
 * สองเลน: (1) `ev` ในแถว roster ของเจ้าตัว = ข่าวไหลเร็ว เกาะไปกับ write ที่เกิดอยู่แล้ว
 *          (2) collection `news` = ข่าว "ครั้งแรก/ที่หนึ่งของรุ่น" ที่ควรอยู่ยาว
 *
 * เก็บแค่รหัส+ตัวเลข ไม่เก็บข้อความไทย ⇒ แก้สำนวนทีหลังได้โดยไม่ต้องย้อนแก้ข้อมูล
 * ชื่อคนก็ไม่เก็บ — ดึงจาก rows[uid].n ตอนอ่าน ⇒ เปลี่ยนชื่อเล่นแล้วข่าวเก่าเปลี่ยนตาม
 *
 * spec: docs/superpowers/specs/2026-08-28-news-board-live-design.md
 * เทส: node --test src/utils/newsFeed.test.js
 */
import { MINIGAMES } from '../data/minigames.js'
import { TA_MODES } from './timeAttack.js'

/** เก็บกี่ข่าวต่อคน — ⚠️ เพิ่มแล้วต้องคำนวณขนาด doc ใหม่ (3×~30B×105คน ≈ 9.5KB จากลิมิต 1MB) */
export const EVENT_MAX = 3
/** กี่บรรทัดบนกระดาน */
export const FEED_MAX = 10
/** กันคนเดียวยึดกระดาน — เก็บ 3 แต่โชว์ได้ 2 */
export const PER_USER_MAX = 2
/** ข่าวเลน roster เก่ากว่านี้ = ไม่โชว์ (ev ไม่มีวันหมดอายุเอง คนเลิกเล่นจะค้างหัวกระดานถาวร) */
export const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000

const gameName = (key) => MINIGAMES.find(g => g.key === key)?.name || 'มินิเกม'
const taLabel  = (key) => TA_MODES.find(m => m.key === key)?.label || 'Time Attack'
const GRADE_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

/**
 * ทะเบียนชนิดข่าว — เพิ่มชนิดใหม่ที่นี่ที่เดียว
 * text(who, e) : who = ชื่อที่จะขึ้นต้นประโยค ('คุณ' ถ้าเป็นตัวเอง) · e = { k, v, g, t }
 */
const KINDS = {
  tw: { icon: '🏰', text: (who, e) => `${who} ไต่หอคอยถึงชั้น ${e.v}` },
  pg: { icon: '🐾', text: (who, e) => `${who} อัปเกรดเพ็ทถึงเกรด ${GRADE_ROMAN[e.v] || e.v}` },
  qz: { icon: '📚', text: (who, e) => `${who} ตอบควิซถูกรวด ${e.v} ข้อ` },
  mg: { icon: '🎮', text: (who, e) => `${who} ทำคะแนน ${gameName(e.g)} ขึ้นอันดับ ${e.v} ของรุ่น` },
  ta: { icon: '⏱️', text: (who, e) => `${who} ทำสถิติ Time Attack ${taLabel(e.g)} ขึ้นอันดับ ${e.v} ของรุ่น` },
  hs: { icon: '🏠', text: (who, e) => `${who} อัปเกรดบ้านเป็นเลเวล ${e.v}` },
  fo: { icon: '🌾', text: (who, e) => `${who} ส่งออเดอร์ฟาร์มชิ้นใหญ่ ได้ ${Number(e.v).toLocaleString()} เหรียญ` },
  pv: { icon: '⚔️', text: (who, e) => `${who} ขึ้นอันดับ ${e.v} ของสนามประลอง` },
}

/** ต่อข่าวใหม่ไว้หน้าสุด แล้วตัดท้ายให้เหลือ EVENT_MAX — คู่แฝดของ pushHistory */
export function pushEvent(list, ev) {
  const prev = Array.isArray(list) ? list : []
  if (!ev || !ev.k || !KINDS[ev.k]) return prev      // ข่าวเสีย = ไม่แตะของเดิม
  return [ev, ...prev].slice(0, EVENT_MAX)
}

/**
 * อันดับของ "คะแนนนี้" ในรุ่น (1-based) — นับเฉพาะคนอื่นที่ทำได้สูงกว่า
 * ใช้คะแนนที่เพิ่งทำได้เป็นตัวตั้ง ไม่ใช่ค่าในแถวตัวเอง เพราะแถวตัวเองยังไม่ถูกเขียน ณ จุดที่เรียก
 */
export function rankOfScore(rows, myUid, pick, score) {
  let better = 0
  for (const [uid, row] of Object.entries(rows || {})) {
    if (uid === myUid) continue
    if ((Number(pick(row)) || 0) > (Number(score) || 0)) better++
  }
  return better + 1
}

const tsToMs = (ts) => {
  if (!ts) return 0
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime()
  if (ts instanceof Date) return ts.getTime()
  return Number(ts) || 0
}

/**
 * รวมสองเลนเป็นฟีดเดียว
 * @param rows      members.rosterRows ({ [uid]: row }) — ⚠️ ต้องเป็น rosterRows ไม่ใช่ rosterUsers (rosterUsers ตก guest)
 * @param newsDocs  doc จาก collection news ([{ id, msg, icon, ts }])
 */
export function buildFeed(rows, newsDocs, { now = Date.now(), myUid = null } = {}) {
  const items = []

  for (const [uid, row] of Object.entries(rows || {})) {
    const evs = Array.isArray(row?.ev) ? row.ev : []
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i]
      const def = KINDS[e?.k]
      if (!def) continue                                   // ชนิดจากเวอร์ชันใหม่กว่า = ข้ามเงียบ
      const t = Number(e.t) || 0
      if (!t || now - t > EVENT_TTL_MS) continue
      const who = uid === myUid ? 'คุณ' : (row?.n || '?')
      items.push({ id: `${uid}:${i}:${t}`, uid, icon: def.icon, text: def.text(who, e), t })
    }
  }

  for (const d of newsDocs || []) {
    if (!d?.msg) continue
    items.push({ id: `news:${d.id}`, uid: d.uid || null, icon: d.icon || '📢', text: d.msg, t: tsToMs(d.ts) })
  }

  items.sort((a, b) => b.t - a.t)

  const perUser = {}
  const out = []
  for (const it of items) {
    if (it.uid) {
      const n = (perUser[it.uid] || 0) + 1
      if (n > PER_USER_MAX) continue
      perUser[it.uid] = n
    }
    out.push(it)
    if (out.length >= FEED_MAX) break
  }
  return out
}

/** "12 นาทีที่แล้ว" — ข่าวไหลเร็ว คนอ่านต้องรู้ว่าสดแค่ไหน ไม่ใช่วันที่เต็ม */
export function timeAgo(t, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - (Number(t) || 0)) / 1000))
  if (s < 60) return 'เมื่อกี้'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/newsFeed.test.js`
Expected: PASS ทุกเคส

- [ ] **Step 5: commit**

```bash
git add src/utils/newsFeed.js src/utils/newsFeed.test.js
git commit -m "News: แกนตรรกะฟีดกระดานข่าว (รวม 2 เลน + ตัดอายุ 7 วัน + จำกัด 2 บรรทัด/คน)"
```

---

### Task 2: ต่อ `ev` เข้าแถว roster

**Files:**
- Modify: `src/utils/roster.js` (`buildRosterRow` — เพิ่ม `ev` ต่อท้ายหลัง `h`)
- Modify: `src/composables/useRosterSync.js` (`syncRosterRow({ history, event })`)
- Test: `src/utils/roster.test.js` (เพิ่ม 2 เคส)

**Interfaces:**
- Consumes: `pushEvent` จาก Task 1
- Produces: `syncRosterRow({ event })` — จุดยิงข่าวทุกจุดใน Task 4–6 เรียกผ่านตัวนี้

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน** — ต่อท้าย `src/utils/roster.test.js`

```js
test('buildRosterRow พ่วง ev เดิมไว้ (ไม่งั้นข่าวหายทุกครั้งที่ sync)', () => {
  const prev = { ev: [{ k: 'tw', v: 40, t: 123 }] }
  assert.deepEqual(buildRosterRow(user(), prev).ev, prev.ev)
})

test('มี ev อยู่แล้วและไม่มีอะไรเปลี่ยน → ไม่ต้องเขียน', () => {
  const prev = buildRosterRow(user(), { ev: [{ k: 'tw', v: 40, t: 123 }] })
  assert.equal(rosterRowChanged(prev, buildRosterRow(user(), prev)), false)
})
```

- [ ] **Step 2: รันให้เห็นว่าพัง**

Run: `node --test src/utils/roster.test.js`
Expected: FAIL — `ev` เป็น `undefined`

- [ ] **Step 3: แก้ `src/utils/roster.js`**

แก้ JSDoc ของ `prev` ให้ครอบ `ev` แล้วต่อบรรทัดสุดท้ายของ return (หลัง `h`):

```js
    // h ต่อท้ายเสมอ (ตำแหน่งคงที่ = rosterRowChanged เทียบ JSON ได้ตรง ไม่ยิงเขียนเปล่า)
    ...(prev?.h?.length ? { h: prev.h } : {}),
    // ev ต่อหลัง h ด้วยเหตุผลเดียวกัน · ข่าวกระดาน (ดู utils/newsFeed.js)
    ...(prev?.ev?.length ? { ev: prev.ev } : {}),
```

- [ ] **Step 4: แก้ `src/composables/useRosterSync.js`**

```js
import { pushEvent } from '../utils/newsFeed.js'

  /**
   * @param opts.history รายการประวัติบุก 1 รายการ ({u,w,c,t}) หรือ null
   * @param opts.event   ข่าวกระดาน 1 รายการ ({k,v,g?,t}) หรือ null — พ่วงไปกับ write ที่เกิดอยู่แล้ว
   */
  async function syncRosterRow({ history = null, event = null } = {}) {
    …
    if (history) next.h = pushHistory(prev?.h, history)
    if (event) next.ev = pushEvent(prev?.ev, event)
    if (!rosterRowChanged(prev, next)) return
```

- [ ] **Step 5: รันเทสให้ผ่าน + build**

Run: `node --test src/utils/roster.test.js && npm run build`
Expected: PASS + build สำเร็จ

- [ ] **Step 6: commit**

```bash
git add src/utils/roster.js src/utils/roster.test.js src/composables/useRosterSync.js
git commit -m "News: แถว roster พก ev ได้ + syncRosterRow({event}) (ข่าวเกาะไปกับ write เดิม ไม่เพิ่ม write)"
```

---

### Task 3: เลน `news` — ตัวโพสต์ + rules

**Files:**
- Create: `src/composables/useNewsPost.js`
- Modify: `firestore.rules:184-196`

**Interfaces:**
- Produces: `useNewsPost().postNews({ type, icon, msg })` — Task 5, 6 เรียกใช้

- [ ] **Step 1: เขียน `src/composables/useNewsPost.js`**

```js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useUsageStore } from '../stores/usage.js'
import { cleanText } from '../utils/text.js'

/** ความยาวสูงสุดของข้อความข่าว — ต้องตรงกับ firestore.rules (msg.size() <= 140) */
export const NEWS_MSG_MAX = 140

/** ชนิดที่ rules ยอมให้ผู้เล่นโพสต์ — เพิ่มที่นี่แล้วต้องเพิ่มใน firestore.rules ด้วย */
export const NEWS_TYPES = ['achievement', 'legendary', 'tower100', 'record1']

/**
 * เลน "ข่าวอยู่ยาว" ของกระดานข่าว — ครั้งแรก/ที่หนึ่งของรุ่นเท่านั้น
 * เลนนี้เป็น 1 write ต่อข่าวและไม่มีเพดานต่อคน จึงต้องยิงจากเหตุการณ์ที่เกิดยากจริง
 * ข่าวประจำวันให้ไปเลน roster (`syncRosterRow({event})`) แทน
 *
 * ⚠️ คีย์ต้องเป็น ['msg','icon','type','uid','ts'] เป๊ะ — rules ใช้ hasOnly()
 * ล้มเหลว = เงียบ ไม่ toast ไม่ retry (ข่าวหายไม่กระทบการเล่น)
 */
export function useNewsPost() {
  async function postNews({ type, icon = '📢', msg }) {
    const auth = useAuthStore()
    const uid = auth.currentUser?.uid
    const text = cleanText(String(msg || ''), NEWS_MSG_MAX)
    if (!uid || !text || !NEWS_TYPES.includes(type)) return false
    try {
      await addDoc(collection(db, 'news'), { msg: text, icon, type, uid, ts: serverTimestamp() })
      useUsageStore().track(0, 1)
      return true
    } catch (e) { console.warn('[news post]', e?.code || e); return false }
  }
  return { postNews }
}
```

- [ ] **Step 2: แก้ `firestore.rules`** — เปลี่ยนบรรทัด type เดียว

```
      allow create: if (request.auth != null
            && request.resource.data.type in ['achievement','legendary','tower100','record1']
```

คอมเมนต์หัวบล็อกแก้เป็น: `// ── News feed — admin posts anything; logged-in users may post
    //    achievement / legendary / tower100 / record1 only (field+length guarded) ──`

- [ ] **Step 3: ตรวจ build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 4: commit**

```bash
git add src/composables/useNewsPost.js firestore.rules
git commit -m "News: เลนข่าวอยู่ยาว — useNewsPost + rules เปิด type legendary/tower100/record1 (ยังคุมคีย์+ความยาวเหมือนเดิม)"
```

---

### Task 4: จุดยิงข่าวที่ไม่เพิ่ม write (หอคอย/สนาม/บ้าน/เพ็ท)

**Files:**
- Modify: `src/composables/useTower.js:66`
- Modify: `src/composables/useArena.js:111`
- Modify: `src/composables/useResidence.js:59`
- Modify: `src/components/pets/PetDetailModal.vue:157`

**Interfaces:**
- Consumes: `syncRosterRow({ event })` (Task 2), `rankOfScore` (Task 1), `useNewsPost().postNews` (Task 3)

- [ ] **Step 1: หอคอย** — `useTower.js` ใน `if (won)` แทน `syncRosterRow()` เดิม

`cleared` ถูกหยิบไว้ก่อน `patchUser` อยู่แล้ว (บรรทัด 46) — ใช้ตัวนั้น ห้ามอ่าน `floor.value` ซ้ำ

```js
      // ชั้น 100 ไปเลนข่าวอยู่ยาว (และไม่ยิง tw ซ้ำ) · ชั้นลงท้าย 0 อื่นๆ อยู่เลน roster
      const evt = cleared === TOWER_MAX ? null
        : (cleared % 10 === 0 ? { k: 'tw', v: cleared, t: Date.now() } : null)
      syncRosterRow({ event: evt })
      if (cleared === TOWER_MAX) {
        const me = auth.userData?.nickname || auth.userData?.name?.split(' ')[0] || 'เพื่อนเรา'
        postNews({ type: 'tower100', icon: '🏰', msg: `${me} พิชิตหอคอยชั้น ${TOWER_MAX} สำเร็จ` })
      }
```

เพิ่ม import `import { useNewsPost } from './useNewsPost.js'` และ `const { postNews } = useNewsPost()` ข้างๆ `useRosterSync()`

- [ ] **Step 2: สนามประลอง** — `useArena.js` แทนบล็อก `syncRosterRow({ history: … })`

⚠️ `base.rating` และ `newRating` ต้องหยิบก่อน `patchUser` (มีอยู่แล้วในฟังก์ชัน)

```js
    // อันดับในรุ่น: เทียบอันดับของเรตเก่ากับเรตใหม่จาก rosterRows ที่ถืออยู่แล้ว (ไม่มี read เพิ่ม)
    const rows = members.rosterRows || {}
    const pickR = (r) => r?.r ?? PVP_RATING_START
    const prevRank = rankOfScore(rows, uid, pickR, base.rating)
    const newRank  = rankOfScore(rows, uid, pickR, newRating)
    const rankEvt = (newRank < prevRank && newRank <= 10) ? { k: 'pv', v: newRank, t: Date.now() } : null
    syncRosterRow({
      history: opp.isBot ? null : { u: opp.uid, w: won ? 1 : 0, c: coin, t: Date.now() },
      event: rankEvt,
    })
```

- [ ] **Step 3: บ้าน** — `useResidence.js` `newLevel` หยิบไว้ก่อน `patchUser` อยู่แล้ว

```js
    if (saved) syncRosterRow({ event: { k: 'hs', v: newLevel, t: Date.now() } })
```

- [ ] **Step 4: เพ็ท** — `PetDetailModal.vue` ต้องหยิบเกรดใหม่ก่อน `patchUser`

ในฟังก์ชันที่จบด้วย `syncRosterRow()` (บรรทัด 157) — หาเกรดสูงสุดของเพ็ทที่ถูกแก้จาก `newPets` ซึ่งคำนวณเสร็จก่อน `patchUser` อยู่แล้ว:

```js
  const topGrade = Math.max(0, ...newPets.map(p => Number(p?.grade) || 0))
  const prevTop = Math.max(0, ...(auth.userData?.pets || []).map(p => Number(p?.grade) || 0))
  …
  // เกรด IV/V เท่านั้นที่เป็นข่าว และต้องเป็นการขยับขึ้นจริง
  const gradeEvt = (topGrade > prevTop && topGrade >= 4) ? { k: 'pg', v: topGrade, t: Date.now() } : null
  syncRosterRow({ event: gradeEvt })
```

⚠️ `prevTop` ต้องอ่าน **ก่อน** `await auth.patchUser(...)` (CLAUDE.md ข้อ 9)

- [ ] **Step 5: ตรวจ build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 6: commit**

```bash
git add src/composables/useTower.js src/composables/useArena.js src/composables/useResidence.js src/components/pets/PetDetailModal.vue
git commit -m "News: ยิงข่าวหอคอย/สนาม/บ้าน/เพ็ท (เกาะ write เดิมทั้งหมด ไม่มี write เพิ่ม)"
```

---

### Task 5: จุดยิงข่าวอันดับ (มินิเกม + Time Attack)

**Files:**
- Modify: `src/views/Game2048View.vue`, `src/views/StackerView.vue`, `src/views/CapsuleRushView.vue`
- Modify: `src/views/TimeAttackView.vue`

**Interfaces:**
- Consumes: `rankOfScore` (Task 1), `syncRosterRow({event})` (Task 2), `postNews` (Task 3)

- [ ] **Step 1: มินิเกมทั้ง 3 จอ** — แทน `if (ok) syncRosterRow()`

ทั้ง 3 จอโครงเดียวกัน ต่างแค่ `GKEY`/ชื่อ · `newBest` มีอยู่แล้วในฟังก์ชันและถูกคำนวณก่อน `patchUser`
(2048 = `'g2048'` · Stacker = `'stacker'` · CapsuleRush = `'capsuleRush'` — ยืนยันคีย์จาก `data/minigames.js`)

```js
  if (ok) {
    // อันดับในรุ่นจาก rosterRows ที่กระดานบนจอนี้โหลดไว้แล้ว — ไม่มี read เพิ่ม
    // ไม่มี roster ในมือ = ไม่ยิงข่าว (ห้ามอ่านเพิ่มเพื่อเช็คอันดับ)
    const rows = members.rosterRows || {}
    const rank = Object.keys(rows).length
      ? rankOfScore(rows, auth.currentUser?.uid, r => r?.m?.[GKEY] || 0, newBest)
      : 0
    if (rank === 1) {
      const me = auth.userData?.nickname || auth.userData?.name?.split(' ')[0] || 'เพื่อนเรา'
      postNews({ type: 'record1', icon: '🎮', msg: `${me} ขึ้นเป็นที่ 1 ของรุ่นใน ${GNAME} ด้วย ${newBest.toLocaleString()} คะแนน` })
      syncRosterRow()
    } else {
      syncRosterRow({ event: rank === 2 || rank === 3 ? { k: 'mg', g: GKEY, v: rank, t: Date.now() } : null })
    }
  }
```

⚠️ อันดับ 1 ไปเลน news ไม่ยิง `mg` ซ้ำ (สเปก: อันดับ 2–3 อยู่เลน roster)
เพิ่ม import `useMembersStore`, `rankOfScore`, `useNewsPost` ในแต่ละจอตามที่ยังไม่มี

- [ ] **Step 2: Time Attack** — `TimeAttackView.vue:372` แทน `if (isNew) syncRosterRow()`

`best`/`isNew`/`m.rowKey` หยิบไว้ก่อน `patchUser` อยู่แล้ว (บรรทัด 293)

```js
  if (isNew) {
    const rows = members.rosterRows || {}
    const rank = Object.keys(rows).length
      ? rankOfScore(rows, auth.currentUser?.uid, r => r?.[m.rowKey] || 0, best)
      : 0
    if (rank === 1) {
      const me = auth.userData?.nickname || auth.userData?.name?.split(' ')[0] || 'เพื่อนเรา'
      postNews({ type: 'record1', icon: '⏱️', msg: `${me} ขึ้นเป็นที่ 1 ของรุ่นใน Time Attack ${m.label} ด้วย ${best} ข้อ` })
      syncRosterRow()
    } else {
      syncRosterRow({ event: rank === 2 || rank === 3 ? { k: 'ta', g: m.key, v: rank, t: Date.now() } : null })
    }
  }
```

- [ ] **Step 3: ตรวจ build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 4: commit**

```bash
git add src/views/Game2048View.vue src/views/StackerView.vue src/views/CapsuleRushView.vue src/views/TimeAttackView.vue
git commit -m "News: ข่าวอันดับมินิเกม/Time Attack (ที่ 1 ลงเลน news, 2-3 เลน roster, ไม่มี read เพิ่ม)"
```

---

### Task 6: ควิซ + ฟาร์ม + กาชา

**Files:**
- Modify: `src/views/QuizView.vue` (นับ streak + ยิงตอนจบรอบ)
- Modify: `src/composables/useFarmOrders.js` (ส่งออเดอร์ 3 ชนิด)
- Modify: `src/views/ShopView.vue` (legendary)

- [ ] **Step 1: ควิซ — นับ streak**

ใกล้ `const correct = ref(0)` (บรรทัด 256) เพิ่ม:

```js
const streak = ref(0)       // ถูกติดกันตอนนี้ (ในหน่วยความจำ ปิดแอปแล้วหาย — ตั้งใจ ไม่แตะ schema)
const bestStreak = ref(0)   // ยาวสุดของรอบนี้
```

ใน `pick()` (บรรทัด 446) แก้:

```js
  if (isCorrect) { correct.value++; streak.value++; if (streak.value > bestStreak.value) bestStreak.value = streak.value }
  else streak.value = 0
```

ใน `reset` (บรรทัด 437) เพิ่ม `streak.value = 0; bestStreak.value = 0`

- [ ] **Step 2: ควิซ — ยิงข่าวตอนจบรอบ**

ท้าย `finish()` หลัง `if (grant) toast(...)`:

```js
  // ข่าวควิซ: ยิงครั้งเดียวต่อรอบที่ขั้นสูงสุดที่ถึง (10/20/30) — เป็น write เพิ่ม จึงคุมให้ถี่ต่ำ
  const tier = bestStreak.value >= 30 ? 30 : bestStreak.value >= 20 ? 20 : bestStreak.value >= 10 ? 10 : 0
  if (ok && tier) syncRosterRow({ event: { k: 'qz', v: tier, t: Date.now() } })
```

เพิ่ม `import { useRosterSync } from '../composables/useRosterSync.js'` + `const { syncRosterRow } = useRosterSync()`

- [ ] **Step 3: ฟาร์ม — ออเดอร์ครบ 3 ชนิด**

`useFarmOrders.js` ใน `deliver()` หลัง `if (ok) toast(...)` — `o.items` หยิบไว้ก่อน commit อยู่แล้ว

```js
    // ออเดอร์ครบ 3 ชนิด = ออเดอร์ใหญ่ (เกณฑ์เชิงโครงสร้าง ไม่ผูกกับเหรียญที่เฟ้อตามเลเวลบ้าน)
    if (ok && Object.keys(o.items || {}).length >= MAX_KINDS) {
      syncRosterRow({ event: { k: 'fo', v: gain, t: Date.now() } })
    }
```

เพิ่ม `MAX_KINDS` เข้า import จาก `../data/farmOrders.js` และ `useRosterSync`

- [ ] **Step 4: กาชา — legendary**

`ShopView.vue` ใน `pull()` หลัง `if (ok) showReveal(...)` — `results` มีอยู่แล้วก่อน `patchUser`

```js
  if (ok) {
    // เปิด 10 ครั้งได้ 2 ตัว = ข่าวเดียว (ยิงตัวแรกที่เจอ)
    const leg = results.find(r => PETS.find(p => p.id === (r.id || r.petId))?.rarity === 'legendary')
    if (leg) {
      const me = authStore.userData?.nickname || authStore.userData?.name?.split(' ')[0] || 'เพื่อนเรา'
      const petName = PETS.find(p => p.id === (leg.id || leg.petId))?.name || 'เพ็ทระดับตำนาน'
      postNews({ type: 'legendary', icon: '✨', msg: `${me} เปิดแคปซูลได้ ${petName}` })
    }
  }
```

⚠️ ตรวจรูปของ `results` จาก `rollMany()` ก่อนเขียน — ถ้าคืน `{ id }` ตรงๆ ให้ตัด `|| r.petId` ทิ้ง

- [ ] **Step 5: ตรวจ build + เทสเดิมทั้งหมด**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 6: commit**

```bash
git add src/views/QuizView.vue src/composables/useFarmOrders.js src/views/ShopView.vue
git commit -m "News: ข่าวควิซถูกรวด/ออเดอร์ฟาร์มใหญ่/เปิดได้ legendary"
```

---

### Task 7: `NewsBoard.vue` — กระดานที่ขยับเอง

**Files:**
- Modify: `src/components/home/NewsBoard.vue` (เขียนส่วน script ใหม่ คงโครง template/style เดิม)

**Interfaces:**
- Consumes: `buildFeed`, `timeAgo` (Task 1), `members.loadRoster()`, `members.rosterRows`

- [ ] **Step 1: เขียน script ใหม่**

```js
import Emoji from '../shared/Emoji.vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase/config.js'
import { useUsageStore } from '../../stores/usage.js'
import { useMembersStore } from '../../stores/members.js'
import { useAuthStore } from '../../stores/auth.js'
import { buildFeed, timeAgo } from '../../utils/newsFeed.js'

const usage = useUsageStore()
const members = useMembersStore()
const auth = useAuthStore()

const newsDocs = ref([])
const loading = ref(true)
const open = ref(false)
const idx = ref(0)          // บรรทัดที่โชว์อยู่ตอนพับ
const now = ref(Date.now()) // ให้ "x นาทีที่แล้ว" ขยับตามเวลาจริง

// เลน news เหลือแค่ข่าวใหญ่ → 5 พอ (เดิม 10) · roster เป็น 1 read ที่จออื่นได้ใช้ต่อ
const items = computed(() => buildFeed(members.rosterRows || {}, newsDocs.value,
  { now: now.value, myUid: auth.currentUser?.uid || null }))

const current = computed(() => items.value[idx.value % (items.value.length || 1)] || null)

let timer = null
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function tick() { if (items.value.length > 1) idx.value = (idx.value + 1) % items.value.length }
function start() {
  stop()
  if (reduced || open.value || document.hidden || items.value.length < 2) return
  timer = setInterval(() => { tick(); now.value = Date.now() }, 3500)
}
function stop() { if (timer) { clearInterval(timer); timer = null } }

onMounted(async () => {
  document.addEventListener('visibilitychange', start)
  try {
    await members.loadRoster()
    const snap = await getDocs(query(collection(db, 'news'), orderBy('ts', 'desc'), limit(5)))
    usage.track(snap.size)
    newsDocs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[news]', e) }
  finally { loading.value = false; start() }
})
onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', start) })
watch(open, (v) => { if (v) { stop(); now.value = Date.now() } else start() })
```

- [ ] **Step 2: แก้ template**

```html
  <div v-if="loading || items.length" class="news">
    <button class="news-latest" :aria-expanded="open" @click="open = !open">
      <span class="news-icon"><Emoji :char="open || !current ? '📢' : current.icon" /></span>
      <span class="news-latest-msg">
        <template v-if="loading">กำลังโหลดข่าว…</template>
        <template v-else-if="open">กระดานข่าว</template>
        <span v-else :key="current.id" class="news-tick">{{ current.text }}</span>
      </span>
      <span class="news-chevron" :class="{ open }" aria-hidden="true">▾</span>
    </button>

    <ul v-if="open && items.length" class="news-list">
      <li v-for="n in items" :key="n.id" class="news-item">
        <span class="news-icon"><Emoji :char="n.icon" /></span>
        <div class="news-body">
          <div class="news-msg">{{ n.text }}</div>
          <div class="news-time">{{ timeAgo(n.t, now) }}</div>
        </div>
      </li>
    </ul>
  </div>
```

⚠️ ใช้ `{{ }}` เท่านั้น ห้าม `v-html` (CLAUDE.md ข้อ 8) · ลบฟังก์ชัน `fmt()` เดิมทิ้ง

- [ ] **Step 3: เพิ่ม style ของอนิเมชัน** (ต่อท้าย `<style scoped>` เดิม)

```css
/* สลับบรรทัดเอง — opacity/transform เท่านั้น ห้าม backdrop-filter/blur (iOS Safari paint) */
.news-tick { display: inline-block; animation: news-in .2s ease-out; }
@keyframes news-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .news-tick { animation: none; } }
```

- [ ] **Step 4: ตรวจ build + กฎฟอนต์**

Run: `npm run build && grep -rnE "font-size:\s*\.[0-6][0-9]?rem" src/`
Expected: build สำเร็จ · grep ไม่เจออะไร

- [ ] **Step 5: commit**

```bash
git add src/components/home/NewsBoard.vue
git commit -m "News: กระดานสลับข่าวเองทุก 3.5 วิ + รวม 2 เลน + เวลาแบบ 'x นาทีที่แล้ว' (10 read → 6)"
```

---

### Task 8: ตรวจรวม + deploy

- [ ] **Step 1: รันเทสทั้งหมดที่เกี่ยวข้อง**

Run: `node --test src/utils/newsFeed.test.js src/utils/roster.test.js src/utils/pvpHistory.test.js`
Expected: PASS ทั้งหมด

- [ ] **Step 2: build**

Run: `npm run build`
Expected: สำเร็จ

- [ ] **Step 3: deploy rules** (⚠️ ขาดขั้นนี้ = เลน news ถูกปฏิเสธเงียบ)

Run: `firebase deploy --only firestore:rules`
Expected: `Deploy complete!`

- [ ] **Step 4: push**

```bash
git push origin master
```

GitHub Actions build+publish ไป Pages อัตโนมัติ — ตรวจว่า workflow ขึ้นเขียว

---

## Self-Review

**Spec coverage**
- 2 เลน + ตารางเปรียบเทียบ → Task 2 (roster) + Task 3 (news)
- รูปข้อมูล `ev` + ตำแหน่งหลัง `h` → Task 2 Step 3
- ตารางเหตุการณ์ 8 ชนิด → Task 4 (tw/pv/hs/pg) + Task 5 (mg/ta) + Task 6 (qz/fo)
- เลน news 3 type ใหม่ → Task 3 (rules) + Task 4 Step 1 (tower100) + Task 5 (record1) + Task 6 Step 4 (legendary)
- `buildFeed` 4 ขั้น (ประกอบ/ตัด 7 วัน/รวม news/จำกัด 2 ต่อคน) → Task 1 Step 3 + เทสครบทุกข้อ
- UI 3 ข้อ (สลับเอง/เวลาสัมพัทธ์/ไอคอนหมวด) → Task 7
- rules + deploy → Task 3 Step 2 + Task 8 Step 3
- กับดัก 1–8 → ฝังเป็น ⚠️ ในขั้นที่เกี่ยวข้อง (1→T2S3, 2→T2S3, 3→Global, 4→ยอมรับตามสเปก, 5→T7S2, 6→T4S4/T5, 7→T4S1, 8→T1S3 `if (!def) continue`)
- เทสตามสเปก → Task 1 Step 1 + Task 2 Step 1 ครบทุกหัวข้อ

**Placeholder scan:** ไม่มี TBD/TODO · ทุกขั้นมีโค้ดจริง · จุดเดียวที่ต้องตรวจของจริงคือรูปของ `results` จาก `rollMany()` (Task 6 Step 4) ซึ่งระบุวิธีตรวจไว้แล้ว

**Type consistency:** `pushEvent`/`rankOfScore`/`buildFeed`/`timeAgo` ชื่อและพารามิเตอร์ตรงกันทุกจุดที่เรียก · `syncRosterRow({ history, event })` ใช้รูปเดียวกันทั้ง Task 4–6 · คีย์ `ev` = `{k,v,g?,t}` เหมือนกันหมด · `postNews({type,icon,msg})` ตรงกับ `NEWS_TYPES` และ rules
