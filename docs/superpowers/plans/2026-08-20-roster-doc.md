# `config/roster` — เลิกอ่านทั้ง collection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุกจอของนักศึกษาอ่าน `config/roster` 1 read แทนการ `getDocs` ทั้ง collection `users` (N reads/คน → N²/รอบ)

**Architecture:** doc เดียว `config/roster` เก็บแถวย่อของทุกคน key ด้วย uid · ตรรกะ map/เทียบทั้งหมดเป็น pure function ใน `src/utils/roster.js` (เทส `node --test`) · แต่ละคนเขียนแถวตัวเองผ่าน dot-notation `rows.<uid>` เมื่อสถิติที่ขึ้นบอร์ดเปลี่ยนจริง · rules กันเขียนทับกันด้วย `affectedKeys().hasOnly([uid])` · `AdminView` ยังใช้เส้นทางอ่าน doc เต็มเหมือนเดิม ไม่แตะ

**Tech Stack:** Vue 3 (script setup) · Pinia · Firebase Firestore v9 modular · `node --test`

**Spec:** `docs/superpowers/specs/2026-08-20-roster-doc-design.md` — อ่านก่อนเริ่ม

## Global Constraints

- **ห้าม fallback ไป `getDocs(collection(db,'users'))` ในเส้นทางของนักศึกษาเด็ดขาด** — ถ้า roster ไม่มี ให้แสดงสถานะว่างและบอกให้แอดมินกดสร้าง · fallback เงียบๆ คือสิ่งที่เผาโควตาโดยไม่มีใครรู้ตัว = ปัญหาเดิมที่กำลังแก้อยู่
- **`loadFbUsers` / `fbUsers` / `guestUsers` เป็นของ `AdminView` เท่านั้นหลังงานนี้** — view ของนักศึกษาห้ามเรียก
- เขียน roster ด้วย **dot-notation `rows.<uid>`** ผ่าน `updateDoc` เท่านั้น — ห้าม `setDoc` ทั้งก้อนจากฝั่งนักศึกษา (จะลบแถวคนอื่น และ rules จะปฏิเสธ)
- **ไม่เก็บ `customPhoto` ในแถว** — data URL ก้อนใหญ่ · แคชเดิม `slimForCache` ก็ drop อยู่แล้ว พฤติกรรมไม่เปลี่ยน
- เขียนแถวเมื่อ **`rosterRowChanged` เป็น true เท่านั้น** · เขียนล้มเหลว = `console.warn` เงียบ ห้าม toast ห้าม retry วน
- คีย์แถวย่อคงที่: `s n t l p g tb r m tm` — ห้ามเปลี่ยนชื่อคีย์ภายหลังโดยไม่ทำ migration
- แก้ `firestore.rules` แล้ว **ต้อง `firebase deploy --only firestore:rules`** ไม่งั้นไม่มีผล (CLAUDE.md กับดักข้อ 3)
- คอมเมนต์/commit เป็นไทยปนอังกฤษ · commit รูปแบบ `Area: อะไร (ทำไม)` · ปิดท้าย `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- ตรวจงาน: `node --test src/utils/roster.test.js` + `npm run build`

---

### Task 1: ตรรกะ roster (pure + เทส)

**Files:**
- Create: `src/utils/roster.js`
- Create: `src/utils/roster.test.js`
- Read (อ้างอิง ห้ามแก้): `src/utils/petTeam.js` · `src/data/minigames.js` · `src/utils/pvpRating.js` · `src/data/residence.js`

**Interfaces:**
- Consumes: `MINIGAMES` (array ของ `{key,…}`) จาก `../data/minigames.js` · `getPetDef(id)` จาก `../data/index.js` · `stripTrailingEmoji` จาก `./text.js` · `BATTLE_SLOTS` (=3) จาก `../data/residence.js` · `PVP_RATING_START` (=1000) จาก `./pvpRating.js`
- Produces (ให้ Task 2–5 ใช้):
  - `buildRosterRow(userData) => {s,n,t,l,p,g,tb,r,m,tm}`
  - `rosterRowChanged(oldRow, newRow) => boolean`
  - `buildRosterFromUsers(docs: [{uid, data}]) => { [uid]: row }`
  - `rosterToMembers(rows) => { byStudentId: {[studentId]: member}, guests: member[] }` โดย `member = {uid, studentId, nickname, track, residence:{level}, googlePhoto, guestStatus, towerBest, pvp:{rating}, minigames:{[key]:{best}}, activePetsTeam}`
  - `rosterTeam(row) => [{id, rarity, element, grade}]` (รูปเดียวกับ `resolveBattleTeam`)
  - `rosterOpponents(rows, meUid) => [{uid, nickname, rating, team}]`

- [ ] **Step 1: เขียนเทสที่ยังไม่ผ่าน**

สร้าง `src/utils/roster.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRosterRow, rosterRowChanged, buildRosterFromUsers,
  rosterToMembers, rosterTeam, rosterOpponents,
} from './roster.js'

const user = (over = {}) => ({
  uid: 'u1', studentId: '6512345678', nickname: 'ปิ๊ก 🌟', track: 'sci',
  residence: { level: 7 }, googlePhoto: 'https://lh3/x', customPhoto: 'data:image/png;base64,AAAA',
  guestStatus: null, towerBest: 43, pvp: { rating: 1120 },
  minigames: { g2048: { best: 8192, plays: 3 }, stacker: { best: 0, plays: 1 } },
  activePets: ['fox', null, 'owl'], pets: [{ id: 'fox', grade: 3 }, { id: 'owl', grade: 0 }],
  ...over,
})

test('buildRosterRow map ฟิลด์ครบ และไม่เอา customPhoto ติดไปด้วย', () => {
  const r = buildRosterRow(user())
  assert.equal(r.s, '6512345678')
  assert.equal(r.n, 'ปิ๊ก', 'ต้องผ่าน stripTrailingEmoji')
  assert.equal(r.t, 'sci')
  assert.equal(r.l, 7)
  assert.equal(r.p, 'https://lh3/x')
  assert.equal(r.g, null)
  assert.equal(r.tb, 43)
  assert.equal(r.r, 1120)
  assert.equal(r.customPhoto, undefined)
  assert.equal(JSON.stringify(r).includes('base64'), false, 'ห้ามมี data URL หลุดเข้าแถว')
})

test('buildRosterRow เก็บ m เฉพาะเกมที่ best > 0', () => {
  assert.deepEqual(buildRosterRow(user()).m, { g2048: 8192 })
  assert.deepEqual(buildRosterRow(user({ minigames: {} })).m, {})
})

test('buildRosterRow tm = [id, grade] ข้าม slot ว่าง และ cap ที่ 3', () => {
  assert.deepEqual(buildRosterRow(user()).tm, [['fox', 3], ['owl', 0]])
  const four = user({
    activePets: ['a', 'b', 'c', 'd'],
    pets: [{ id: 'a', grade: 1 }, { id: 'b', grade: 2 }, { id: 'c', grade: 3 }, { id: 'd', grade: 4 }],
  })
  assert.equal(buildRosterRow(four).tm.length, 3, 'cap ที่ BATTLE_SLOTS')
})

test('buildRosterRow ทน field หาย → ค่าตั้งต้นที่ปลอดภัย', () => {
  const r = buildRosterRow({ uid: 'u9' })
  assert.equal(r.l, 1)
  assert.equal(r.tb, 0)
  assert.equal(r.r, 1000, 'PVP_RATING_START')
  assert.deepEqual(r.m, {})
  assert.deepEqual(r.tm, [])
})

test('rosterRowChanged: ค่าเท่าเดิม → false (ไม่ต้องเขียน)', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user())
  assert.equal(rosterRowChanged(a, b), false)
})

test('rosterRowChanged: best มินิเกมขยับ → true', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user({ minigames: { g2048: { best: 9000 } } }))
  assert.equal(rosterRowChanged(a, b), true)
})

test('rosterRowChanged: เหรียญเปลี่ยนแต่ฟิลด์บอร์ดเท่าเดิม → false', () => {
  const a = buildRosterRow(user({ coins: 100 }))
  const b = buildRosterRow(user({ coins: 999999 }))
  assert.equal(rosterRowChanged(a, b), false, 'coins ไม่ได้อยู่ในแถว จึงต้องไม่ทำให้เขียน')
})

test('rosterRowChanged: ยังไม่มีแถวเดิม (คนใหม่) → true', () => {
  assert.equal(rosterRowChanged(undefined, buildRosterRow(user())), true)
})

test('rosterRowChanged: เปลี่ยนทีมเพ็ท → true', () => {
  const a = buildRosterRow(user())
  const b = buildRosterRow(user({ activePets: ['owl', null, null] }))
  assert.equal(rosterRowChanged(a, b), true)
})

test('buildRosterFromUsers ข้าม doc ที่ไม่มีทั้ง studentId และ nickname', () => {
  const rows = buildRosterFromUsers([
    { uid: 'u1', data: user() },
    { uid: 'ghost', data: { coins: 5 } },
    { uid: 'g1', data: user({ uid: 'g1', studentId: null, nickname: 'แขก', guestStatus: 'approved' }) },
  ])
  assert.deepEqual(Object.keys(rows).sort(), ['g1', 'u1'])
})

test('rosterToMembers แยกนักศึกษา/guest ตาม g', () => {
  const rows = {
    u1: buildRosterRow(user()),
    g1: buildRosterRow(user({ uid: 'g1', studentId: null, nickname: 'แขก', guestStatus: 'approved' })),
  }
  const { byStudentId, guests } = rosterToMembers(rows)
  assert.deepEqual(Object.keys(byStudentId), ['6512345678'])
  assert.equal(byStudentId['6512345678'].uid, 'u1')
  assert.equal(byStudentId['6512345678'].residence.level, 7)
  assert.equal(byStudentId['6512345678'].minigames.g2048.best, 8192)
  assert.equal(guests.length, 1)
  assert.equal(guests[0].guestStatus, 'approved')
})

test('rosterTeam คืนรูปเดียวกับ resolveBattleTeam (rarity/element มาจาก catalog)', () => {
  const t = rosterTeam(buildRosterRow(user()))
  assert.equal(t.length, 2)
  for (const p of t) {
    assert.ok(typeof p.id === 'string')
    assert.ok(typeof p.rarity === 'string')
    assert.ok(typeof p.element === 'string')
    assert.ok(Number.isFinite(p.grade))
  }
  assert.equal(t[0].grade, 3)
})

test('rosterOpponents: ตัดตัวเองออก + ตัดคนไม่มีทีม + เติม team ให้พร้อมสู้', () => {
  const rows = {
    me:   buildRosterRow(user({ uid: 'me' })),
    a:    buildRosterRow(user({ uid: 'a' })),
    noTeam: buildRosterRow(user({ uid: 'noTeam', activePets: [], pets: [] })),
  }
  const out = rosterOpponents(rows, 'me')
  assert.deepEqual(out.map(o => o.uid), ['a'])
  assert.equal(out[0].rating, 1120)
  assert.ok(Array.isArray(out[0].team) && out[0].team.length > 0)
})
```

- [ ] **Step 2: รันเทสให้เห็นว่าพัง**

Run: `node --test src/utils/roster.test.js`
Expected: FAIL — `Cannot find module './roster.js'`

- [ ] **Step 3: เขียน implementation**

สร้าง `src/utils/roster.js`:

```js
/**
 * `config/roster` — doc สรุปรวมของทั้งรุ่น เพื่อให้ทุกจออ่าน 1 read
 * แทนการ getDocs(collection(db,'users')) ซึ่งเป็น N reads ต่อคน → N² ต่อรอบ
 *
 * โครง: { rows: { [uid]: row }, updatedAt }
 * row  = { s,n,t,l,p,g,tb,r,m,tm } — คีย์ย่อเพราะทุกคนอ่าน doc นี้ทุกเซสชัน
 *
 * ตรรกะล้วน ไม่แตะ Firestore/Vue — เทส `node --test src/utils/roster.test.js`
 * spec: docs/superpowers/specs/2026-08-20-roster-doc-design.md
 */
import { MINIGAMES } from '../data/minigames.js'
import { getPetDef } from '../data/index.js'
import { stripTrailingEmoji } from './text.js'
import { BATTLE_SLOTS } from '../data/residence.js'
import { PVP_RATING_START } from './pvpRating.js'

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** userData (doc เต็ม) → แถวย่อสำหรับ roster */
export function buildRosterRow(u) {
  const d = u || {}

  // มินิเกม: เก็บเฉพาะเกมที่เคยทำคะแนนได้จริง — กันแถวบวมด้วยศูนย์
  const m = {}
  for (const g of MINIGAMES) {
    const best = num(d.minigames?.[g.key]?.best, 0)
    if (best > 0) m[g.key] = best
  }

  // ทีมสู้: [petId, grade] — rarity/element ดึงจาก catalog ตอนอ่าน จึงไม่ต้องเก็บ
  const pets = Array.isArray(d.pets) ? d.pets : []
  const tm = (Array.isArray(d.activePets) ? d.activePets : [])
    .filter(Boolean)
    .slice(0, BATTLE_SLOTS)
    .map((id) => {
      const inst = pets.find(p => (p?.id || p?.species) === id) || {}
      return [id, num(inst.grade, 0)]
    })

  return {
    s:  d.studentId ?? null,
    n:  stripTrailingEmoji(d.nickname || d.name?.split(' ')[0] || '') || '?',
    t:  d.track ?? null,
    l:  num(d.residence?.level, 1),
    p:  d.googlePhoto ?? null,      // ⚠️ ไม่เอา customPhoto — data URL ก้อนใหญ่
    g:  d.guestStatus ?? null,
    tb: num(d.towerBest, 0),
    r:  num(d.pvp?.rating, PVP_RATING_START),
    m,
    tm,
  }
}

/** เทียบสองแถว — true = ต้องเขียน · ใช้ JSON เพราะแถวเป็น plain data ตื้น คีย์เรียงคงที่จาก buildRosterRow */
export function rosterRowChanged(oldRow, newRow) {
  if (!oldRow) return true
  return JSON.stringify(oldRow) !== JSON.stringify(newRow)
}

/** สร้าง rows ทั้งก้อนจาก users ทั้ง collection (ใช้เฉพาะปุ่มแอดมิน) */
export function buildRosterFromUsers(docs) {
  const rows = {}
  for (const { uid, data } of docs || []) {
    if (!data) continue
    if (!data.studentId && !data.nickname) continue   // ตรรกะเดิมของ members store
    rows[uid] = buildRosterRow(data)
  }
  return rows
}

/** แถวย่อ → รูปที่ view เดิมคุ้นเคย (คล้าย light subset ของ fbUsers) */
function toMember(uid, row) {
  const minigames = {}
  for (const [k, best] of Object.entries(row.m || {})) minigames[k] = { best }
  return {
    uid,
    studentId: row.s,
    nickname: row.n,
    track: row.t,
    residence: { level: row.l },
    googlePhoto: row.p,
    guestStatus: row.g,
    towerBest: row.tb,
    pvp: { rating: row.r },
    minigames,
    activePetsTeam: rosterTeam(row),
  }
}

/** rows → { byStudentId, guests } · guest = แถวที่มี g (ไม่ใช่ null) */
export function rosterToMembers(rows) {
  const byStudentId = {}
  const guests = []
  for (const [uid, row] of Object.entries(rows || {})) {
    const mem = toMember(uid, row)
    if (row.g || row.t === 'guest') guests.push(mem)
    else if (row.s) byStudentId[row.s] = mem
  }
  return { byStudentId, guests }
}

/** [id,grade] → รูปเดียวกับ resolveBattleTeam (utils/petTeam.js) */
export function rosterTeam(row) {
  return (row?.tm || []).map(([id, grade]) => {
    const def = getPetDef(id) || {}
    return {
      id,
      rarity:  def.rarity  || 'common',
      element: def.element || 'scissors',
      grade:   num(grade, 0),
    }
  })
}

/** คู่ต่อสู้ที่บุกได้ — มีทีม + ไม่ใช่ตัวเอง · team resolve มาให้แล้ว (เหมือนบอท) */
export function rosterOpponents(rows, meUid) {
  const out = []
  for (const [uid, row] of Object.entries(rows || {})) {
    if (uid === meUid) continue
    if (!row?.tm?.length) continue
    out.push({ uid, nickname: row.n, rating: num(row.r, PVP_RATING_START), team: rosterTeam(row) })
  }
  return out
}
```

- [ ] **Step 4: รันเทสให้ผ่าน**

Run: `node --test src/utils/roster.test.js`
Expected: PASS ทั้ง 13 เทส (`# pass 13` / `# fail 0`)

- [ ] **Step 5: Commit**

```bash
git add src/utils/roster.js src/utils/roster.test.js
git commit -F - <<'MSG'
Members: ตรรกะ config/roster เป็น pure function (แถวย่อ + map กลับให้ view)

เตรียมเลิกอ่าน users ทั้ง collection (N reads/คน → N²/รอบ, 170 คนทะลุโควตา)
แถวเก็บคีย์ย่อ {s,n,t,l,p,g,tb,r,m,tm} เพราะ doc นี้ทุกคนอ่านทุกเซสชัน
ไม่เก็บ customPhoto (data URL ก้อนใหญ่ · แคชเดิมก็ drop อยู่แล้ว)

tm เก็บแค่ [petId, grade] เพราะ resolveBattleTeam ใช้จาก instance แค่ grade
rarity/element มาจาก catalog → Arena สร้างทีมคู่ต่อสู้ได้โดยไม่อ่าน doc ใคร
rosterRowChanged ใช้ตัดการเขียนที่ไม่จำเป็นทิ้ง (เหรียญขยับไม่ทำให้เขียน)
เทส 13 ข้อ

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: rules + ปุ่มแอดมินสร้าง roster

ต้องมาก่อน Task 3/4 เพราะจอต่างๆ ต้องมี doc ให้อ่าน

**Files:**
- Modify: `firestore.rules` (เพิ่มบล็อก `match /config/roster`)
- Modify: `src/views/AdminView.vue` (ปุ่ม + ฟังก์ชัน)
- Test: `npm run build` + `firebase deploy --only firestore:rules`

**Interfaces:**
- Consumes: `buildRosterFromUsers(docs)` จาก `../utils/roster.js` (Task 1) · `collection, getDocs, doc, setDoc, serverTimestamp` จาก `firebase/firestore` (AdminView import ครบอยู่แล้ว) · `usage.track(reads, writes)` · `toast`
- Produces: doc `config/roster` มีข้อมูลจริง — Task 3 อ่านจากที่นี่

- [ ] **Step 1: เพิ่ม rules**

ใน `firestore.rules` แทรกบล็อกนี้ **ก่อน** `match /users/{userId}` (อยู่ในระดับเดียวกัน):

```
    // ── Roster — doc สรุปรวมของทั้งรุ่น ให้ทุกจออ่าน 1 read แทน getDocs ทั้ง users
    //    (ออดิต 13 ส.ค. ข้อ 1: N reads/คน → N²/รอบ · 170 คนทะลุโควตาฟรี)
    //    เขียน: แต่ละคนแก้ได้เฉพาะแถวของตัวเอง — affectedKeys กันเขียนทับกัน
    //    สร้าง/ลบทั้งก้อน: admin เท่านั้น (ปุ่ม "สร้าง roster ใหม่" ใน AdminView)
    match /config/roster {
      allow read:   if request.auth != null;
      allow update: if request.auth != null
        && request.resource.data.rows.diff(resource.data.rows)
             .affectedKeys().hasOnly([request.auth.uid]);
      allow create, delete: if isAdmin();
    }
```

⚠️ `config/{docId}` อาจมี match กว้างอยู่แล้วในไฟล์ — ตรวจด้วย `grep -n "match /config" firestore.rules`
ถ้ามี ให้วางบล็อก `config/roster` **ก่อน** ตัวกว้าง (Firestore ใช้ทุก match ที่ตรง แบบ OR — บล็อกเฉพาะเจาะจงจึงต้องมีเพื่อ "เพิ่มสิทธิ์" ไม่ใช่เพื่อ "จำกัด")

- [ ] **Step 2: เพิ่มปุ่มใน AdminView**

หาแถวปุ่มเครื่องมือแอดมิน (มีปุ่มลักษณะเดียวกันอยู่แล้ว) แล้วเพิ่ม:

```html
        <button class="ad-btn" :disabled="rebuildingRoster" @click="rebuildRoster">
          {{ rebuildingRoster ? 'กำลังสร้าง…' : '🔄 สร้าง roster ใหม่' }}
        </button>
```

ใน `<script setup>` เพิ่ม import และฟังก์ชัน:

```js
import { buildRosterFromUsers } from '../utils/roster.js'

// อ่าน users ทั้ง collection ครั้งเดียว (แอดมินคนเดียว = ถูก) → เขียน config/roster
// ให้ทุกจอของนักศึกษาอ่าน 1 read แทน · แพทเทิร์นเดียวกับปุ่ม "คำนวณ meta ใหม่" ของคลังข้อสอบ
const rebuildingRoster = ref(false)
async function rebuildRoster() {
  if (rebuildingRoster.value) return
  rebuildingRoster.value = true
  try {
    const snap = await getDocs(collection(db, 'users'))
    usage.track(snap.size)
    const rows = buildRosterFromUsers(snap.docs.map(d => ({ uid: d.id, data: d.data() })))
    await setDoc(doc(db, 'config', 'roster'), { rows, updatedAt: serverTimestamp() })
    usage.track(0, 1)
    toast(`สร้าง roster แล้ว ${Object.keys(rows).length} คน`, 'success')
  } catch (e) {
    console.error('[rebuild roster]', e); toast('สร้าง roster ไม่สำเร็จ', 'error')
  } finally { rebuildingRoster.value = false }
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 4: Deploy rules แล้วกดปุ่มจริง**

Run: `firebase deploy --only firestore:rules`
Expected: `rules file firestore.rules compiled successfully` + `released rules`

จากนั้นเปิดแอป → Admin → กด **"🔄 สร้าง roster ใหม่"** → ต้องขึ้น toast บอกจำนวนคน
ตรวจใน Firebase console ว่า `config/roster` มี `rows` ครบทุกคน และ **ไม่มี data URL** อยู่ในนั้น

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/views/AdminView.vue
git commit -F - <<'MSG'
Admin: ปุ่มสร้าง config/roster + rules กันเขียนทับแถวกัน

roster เป็น doc รวมที่ทุกจอจะอ่าน 1 read แทน getDocs ทั้ง users
สร้างทั้งก้อนจากปุ่มแอดมิน (อ่านทั้ง collection ครั้งเดียว = ถูก เพราะแอดมิน
คนเดียวกด) แพทเทิร์นเดียวกับ "คำนวณ meta ใหม่" ของคลังข้อสอบ

rules: อ่านได้ทุกคนที่ล็อกอิน · update ได้เฉพาะแถวตัวเองผ่าน
affectedKeys().hasOnly([uid]) กันนักศึกษาเขียนทับแถวเพื่อน · create/delete
ทั้งก้อน admin เท่านั้น

⚠️ ต้อง firebase deploy --only firestore:rules และกดปุ่ม 1 ครั้งหลัง deploy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: members store อ่าน roster (+ โปรไฟล์ทีละคน)

**Files:**
- Modify: `src/stores/members.js`
- Test: `npm run build`

**Interfaces:**
- Consumes: `rosterToMembers(rows)`, `rosterOpponents(rows, meUid)` จาก `../utils/roster.js` (Task 1) · doc `config/roster` (Task 2) · `doc, getDoc` จาก `firebase/firestore` · `normalizeUserData` จาก `../data/userSchema.js`
- Produces (ให้ Task 4/5 ใช้):
  - `rosterRows` (ref, `{[uid]: row}`) · `rosterUsers` (ref, `{[studentId]: member}`) · `rosterGuests` (ref, `member[]`) · `rosterReady` (ref bool) · `rosterMissing` (ref bool — doc ไม่มี ต้องให้แอดมินกดสร้าง)
  - `loadRoster({ force }) => Promise<void>`
  - `loadProfile(uid) => Promise<object|null>` (cache ในเซสชันผ่าน `profiles` ref)
  - ของเดิมคงไว้ไม่แตะ: `fbUsers`, `guestUsers`, `loadFbUsers`, `students`, `initStudents`

- [ ] **Step 1: เพิ่มเส้นทาง roster ใน store**

ใน `src/stores/members.js` เพิ่ม import:

```js
import { doc, getDoc } from 'firebase/firestore'
import { rosterToMembers } from '../utils/roster.js'
```

(บรรทัด import firestore เดิมเป็น `import { collection, getDocs } from 'firebase/firestore'` — รวมเป็นบรรทัดเดียวได้)

เพิ่ม state + ฟังก์ชันต่อจาก `const loading = ref(false)`:

```js
    // ── เส้นทาง roster (ทุกจอของนักศึกษา) — 1 read ต่อเซสชัน ──
    // แยกจาก fbUsers/loadFbUsers ที่เป็นของ AdminView เท่านั้น (ต้องการ doc เต็ม)
    const rosterRows   = ref({})
    const rosterUsers  = ref({})   // { studentId: member }
    const rosterGuests = ref([])
    const rosterReady  = ref(false)
    const rosterMissing = ref(false)  // doc ยังไม่ถูกสร้าง → ให้ UI บอกแอดมินกดสร้าง
    const rosterLoading = ref(false)

    async function loadRoster({ force = false } = {}) {
        if (rosterLoading.value) return
        if (!force && rosterReady.value) return
        rosterLoading.value = true
        try {
            const snap = await getDoc(doc(db, 'config', 'roster'))
            useUsageStore().track(1)
            if (!snap.exists()) {
                // ⚠️ ห้าม fallback ไป getDocs ทั้ง collection — นั่นคือปัญหาที่กำลังแก้อยู่
                rosterMissing.value = true
                return
            }
            rosterMissing.value = false
            const rows = snap.data()?.rows || {}
            rosterRows.value = rows
            const { byStudentId, guests } = rosterToMembers(rows)
            rosterUsers.value  = byStudentId
            rosterGuests.value = guests
            rosterReady.value  = true
        } catch (e) {
            console.error('[roster]', e)
        } finally {
            rosterLoading.value = false
        }
    }

    // ── โปรไฟล์รายคน (ของหนัก: pets/contact) — อ่านตอนกดดูเท่านั้น + จำในเซสชัน ──
    const profiles = ref({})
    async function loadProfile(uid) {
        if (!uid) return null
        if (profiles.value[uid]) return profiles.value[uid]
        try {
            const snap = await getDoc(doc(db, 'users', uid))
            useUsageStore().track(1)
            if (!snap.exists()) return null
            const full = normalizeUserData(snap.data())
            profiles.value = { ...profiles.value, [uid]: { ...full, uid } }
            return profiles.value[uid]
        } catch (e) {
            console.error('[profile]', e)
            return null
        }
    }
```

- [ ] **Step 2: ประกาศออกจาก store**

แก้บรรทัด return ท้ายไฟล์:

```js
    return {
        fbUsers, students, guestUsers, loading, initStudents, loadFbUsers,   // ← AdminView เท่านั้น
        rosterRows, rosterUsers, rosterGuests, rosterReady, rosterMissing, rosterLoading, loadRoster,
        profiles, loadProfile,
    }
```

- [ ] **Step 3: เตือนไว้บน `loadFbUsers` ว่าเป็นของแอดมิน**

เพิ่มคอมเมนต์เหนือ `async function loadFbUsers`:

```js
    // ⚠️ อ่าน users ทั้ง collection = N reads — **เฉพาะ AdminView เท่านั้น**
    //    (triage guest / econ editor ต้องเห็น doc เต็ม) · จอของนักศึกษาใช้ loadRoster()
    //    ถ้าเผลอเรียกจากจอนักศึกษา ต้นทุนจะกลับไปเป็น O(N²) เหมือนเดิม
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/stores/members.js
git commit -F - <<'MSG'
Members: เพิ่มเส้นทาง loadRoster (1 read) + loadProfile ทีละคน

แยกสองเส้นทางชัดเจน: loadRoster/rosterUsers สำหรับจอของนักศึกษา (1 read)
กับ loadFbUsers/fbUsers ของเดิมที่เหลือไว้ให้ AdminView เท่านั้น เพราะ triage
guest กับ econ editor ต้องเห็น doc เต็ม — ถ้าเปลี่ยน ref เดิมให้ผอมลง AdminView พัง

ของหนัก (pets/contact/likedBy) ไม่อยู่ในแถว roster → loadProfile(uid) อ่าน
ทีละคนตอนกดดูโปรไฟล์ แล้วจำในเซสชัน กดซ้ำไม่เสีย read
roster ไม่มี = ตั้ง rosterMissing ให้ UI บอกแอดมินกดสร้าง — ไม่ fallback ไป
getDocs ทั้ง collection เงียบๆ เพราะนั่นคือปัญหาที่กำลังแก้

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: จอของนักศึกษาย้ายมาอ่าน roster

**Files:**
- Modify: `src/views/MembersView.vue` (บรรทัด ~79–99)
- Modify: `src/components/members/ProfileModal.vue`
- Modify: `src/views/TowerView.vue` (บรรทัด ~155–166)
- Modify: `src/composables/useMinigameBoard.js`
- Modify: `src/composables/useArena.js` (บรรทัด ~45–51)
- Modify: `src/views/ArenaView.vue` (บรรทัด ~84)
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `rosterUsers`, `rosterGuests`, `rosterRows`, `rosterMissing`, `loadRoster`, `loadProfile` จาก members store (Task 3) · `rosterOpponents(rows, meUid)` จาก `../utils/roster.js` (Task 1)
- Produces: ไม่มี — จอปลายทาง

- [ ] **Step 1: MembersView**

แทนที่ 3 จุด:

```js
onMounted(() => members.loadRoster())
// ↻ บังคับโหลดสด (roster อาจ stale ถ้าเพื่อนเพิ่งทำคะแนน)
const refresh = () => members.loadRoster({ force: true })
```

```js
const roster = computed(() => {
  const fb = members.rosterUsers || {}
  return (members.students || []).map(s => {
    const u = fb[s.id]
    // realName มาจากรายชื่อ static เสมอ (ไม่ได้เก็บใน roster — ประหยัดและไม่มีวันเพี้ยน)
    if (u) return { ...u, realName: s.realName, registered: true }
    return {
      uid: 'static_' + s.id, studentId: s.id,
      nickname: s.nickname, realName: s.realName, track: s.track,
      residence: { level: 1 }, pets: [], registered: false,
    }
  })
})

const approvedGuests = computed(() =>
  (members.rosterGuests || []).filter(g => g.guestStatus === 'approved').map(g => ({ ...g, registered: true })))
```

เพิ่มแถบแจ้งเตือนใต้หัวข้อ เมื่อ roster ยังไม่ถูกสร้าง:

```html
      <div v-if="members.rosterMissing" class="mv-empty-roster">
        ยังไม่มีข้อมูลรายชื่อ — ให้แอดมินกด "🔄 สร้าง roster ใหม่" ในหน้า Admin หนึ่งครั้ง
      </div>
```

```css
.mv-empty-roster { font-size: .78rem; line-height: 1.5; color: #92400e; background: #fffbeb;
  border: 1px solid #fde68a; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; }
```

- [ ] **Step 2: ProfileModal โหลดของหนักตอนเปิด**

แถวใน roster ไม่มี `pets`/`contact` แล้ว — ต้องดึง doc คนนั้นตอนเปิด

เพิ่มใน `<script setup>`:

```js
import { watch } from 'vue'
import { useMembersStore } from '../../stores/members.js'
const members = useMembersStore()

// roster เก็บแค่แถวย่อ — ของหนัก (pets/contact) โหลดตอนเปิดโปรไฟล์เท่านั้น (1 read/คน จำในเซสชัน)
const full = ref(null)
watch(() => props.member?.uid, async (uid) => {
  full.value = null
  if (!uid || String(uid).startsWith('static_')) return
  full.value = await members.loadProfile(uid)
}, { immediate: true })

// ใช้ค่าจาก doc เต็มถ้าโหลดมาแล้ว ไม่งั้น fallback แถวย่อ (ชื่อ/รูป/เลเวลมีอยู่แล้ว)
const view = computed(() => ({ ...(props.member || {}), ...(full.value || {}) }))
```

แล้วแทนที่การอ้าง `member.` / `member?.` ในเทมเพลตทั้งหมดด้วย `view.` / `view?.`
(ยกเว้น `v-if="member"` ที่คุมการแสดงผลของ overlay — คงไว้)

Run ตรวจว่าไม่มีตกหล่น: `grep -n "member\." src/components/members/ProfileModal.vue`
Expected: เหลือเฉพาะใน `<script setup>` (`props.member`) ไม่มีในเทมเพลต

- [ ] **Step 3: TowerView**

```js
onMounted(() => { membersStore.loadRoster().catch(() => {}) })  // best-effort, 1 read

const rivals = computed(() => {
  const others = Object.values(membersStore.rosterUsers || {})
    .map(u => ({ uid: u.uid, nickname: u.nickname, towerBest: u.towerBest || 0 }))
  if (!others.length) return null
  const u = authStore.userData || {}
  const me = { uid: authStore.currentUser?.uid || 'me', nickname: u.nickname || 'ฉัน', towerBest: best.value }
  const r = towerRanking(others, me)
  return r.total > 0 ? r : null
})
```

- [ ] **Step 4: useMinigameBoard**

```js
export function useMinigameBoard(key) {
  const members = useMembersStore()
  const auth = useAuthStore()
  const { rosterUsers, rosterLoading } = storeToRefs(members)

  const rows = computed(() => {
    const u = auth.userData
    const me = u && u.studentId
      ? {
          uid: u.uid, studentId: u.studentId, nickname: u.nickname, track: u.track,
          googlePhoto: u.googlePhoto, customPhoto: u.customPhoto,
          best: u.minigames?.[key]?.best || 0,
        }
      : null
    return buildMinigameBoard(rosterUsers.value, me, key)
  })

  return { rows, loading: rosterLoading, load: () => members.loadRoster() }
}
```

`buildMinigameBoard` อ่าน `u.minigames?.[key]?.best` — `rosterToMembers` คืนรูปนั้นให้แล้ว จึงไม่ต้องแก้ `minigameCore.js`

- [ ] **Step 5: useArena — คู่ต่อสู้จาก roster**

เพิ่ม import:

```js
import { rosterOpponents } from '../utils/roster.js'
```

แทนที่ `opponents` computed:

```js
  // พูลคู่ต่อสู้ = คนจริงเรตใกล้ 4 คน + บอท 1 ตัว
  // roster ให้ทีมมาพร้อมสู้แล้ว (เหมือนบอท) จึงไม่ต้องอ่าน doc คู่ต่อสู้เลย
  const opponents = computed(() => {
    const pool = rosterOpponents(members.rosterRows || {}, auth.currentUser?.uid)
    const humans = pool
      .slice()
      .sort((a, b) => Math.abs(a.rating - rating.value) - Math.abs(b.rating - rating.value))
      .slice(0, 4)
    const bot = getPvpBot(rating.value, Math.floor(Date.now() / 3600000))
    return [...humans, bot]
  })
```

แก้จุดสร้างทีมคู่ต่อสู้ (บรรทัด ~98) — ตอนนี้ทุกฝ่ายมี `team` มาแล้ว:

```js
    const oppTeam = opp.team
```

และให้ `ArenaView` โหลด roster แทน: `onMounted(() => { members.loadRoster() })`

- [ ] **Step 6: ArenaView preview**

```js
const oppPreview = (opp) => opp.team
```

- [ ] **Step 7: ตรวจว่าไม่มีจอนักศึกษาเรียก loadFbUsers เหลืออยู่**

Run: `grep -rn "loadFbUsers" src/ --include=*.vue --include=*.js | grep -v "stores/members.js"`
Expected: **เหลือเฉพาะ `src/views/AdminView.vue`** (3 จุด) เท่านั้น

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 9: ทดลองจริงใน dev**

Run: `npm run dev`
1. หน้าเพื่อน — รายชื่อครบ ชื่อจริง/เลเวล/แท็บ Sci-Care ถูก · กดดูโปรไฟล์ใครสักคน เพ็ท+ช่องทางติดต่อต้องขึ้น
2. หอคอย — แถบเทียบเพื่อนขึ้นอันดับ/ยอดรวม/คนที่ตามหลัง ครบเหมือนเดิม
3. บอร์ดมินิเกม — อันดับถูก รูปโปรไฟล์ขึ้น
4. Arena — คู่ต่อสู้ 4 คน + บอท 1 · ทีมเพ็ทของคู่ต่อสู้แสดงถูก · กดสู้แล้วจบไฟต์ได้
5. เปิด DevTools → Network กรอง `Listen`/`firestore` — เข้าหน้าเพื่อนต้อง**ไม่**มีการดึงเอกสารเป็นร้อยรายการอีก

- [ ] **Step 10: Commit**

```bash
git add src/views/MembersView.vue src/components/members/ProfileModal.vue src/views/TowerView.vue src/composables/useMinigameBoard.js src/composables/useArena.js src/views/ArenaView.vue
git commit -F - <<'MSG'
Members/Tower/Arena/Board: อ่าน roster 1 read แทน users ทั้ง collection

หน้าเพื่อน หอคอย บอร์ดมินิเกม และ Arena เลิกเรียก loadFbUsers ทั้งหมด
(เหลือเฉพาะ AdminView) — จาก N reads ต่อคนต่อ 8 ชม. เหลือ 1 read ต่อเซสชัน

ProfileModal โหลด doc คนนั้นตอนเปิด (1 read จำในเซสชัน) เพราะ pets/contact
ไม่ได้อยู่ในแถวย่อ · realName ใน MembersView มาจากรายชื่อ static เสมอ
Arena ได้ทีมคู่ต่อสู้จาก roster โดยตรง ทำให้ opp.team ใช้ได้ทั้งคนจริงและบอท
เลิกต้องแยกเคส

roster ไม่มี → หน้าเพื่อนขึ้นข้อความให้แอดมินกดสร้าง ไม่เงียบ ไม่ fallback

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 5: เขียนแถวตัวเองเมื่อสถิติบอร์ดเปลี่ยน

**Files:**
- Create: `src/composables/useRosterSync.js`
- Modify: `src/views/Game2048View.vue` · `src/views/StackerView.vue` · `src/views/CapsuleRushView.vue` · `src/views/TowerView.vue` · `src/views/ArenaView.vue` · `src/views/MeView.vue` · `src/composables/useResidence.js` · `src/components/pets/PetDetailModal.vue` · `src/components/battle/TeamPicker.vue`
- Test: `npm run build` + ทดลองใน `npm run dev`

**Interfaces:**
- Consumes: `buildRosterRow(userData)`, `rosterRowChanged(oldRow, newRow)` จาก `../utils/roster.js` (Task 1) · `rosterRows`, `loadRoster` จาก members store (Task 3) · `updateDoc, doc, serverTimestamp` จาก `firebase/firestore`
- Produces: `useRosterSync() => { syncRosterRow: () => Promise<void> }`

- [ ] **Step 1: สร้าง composable**

สร้าง `src/composables/useRosterSync.js`:

```js
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useUsageStore } from '../stores/usage.js'
import { buildRosterRow, rosterRowChanged } from '../utils/roster.js'

/**
 * เขียนแถวของตัวเองลง `config/roster` — **จุดเดียว**ที่ฝั่งนักศึกษาเขียน doc นี้
 *
 * เรียกหลังกิจกรรมที่ทำให้สถิติบนบอร์ดเปลี่ยน (จบมินิเกม/หอคอย/PvP/อัปบ้าน/
 * เปลี่ยนชื่อ-รูป-ทีมเพ็ท) — ภายในเทียบกับแถวเดิมก่อน **ไม่เปลี่ยน = ไม่ยิง Firestore**
 * (ทำ 2048 ได้ 9 คะแนนไม่ถึง best เดิม → เงียบ)
 *
 * ล้มเหลว = เงียบ (`console.warn`) ไม่ toast ไม่ retry — doc นี้รับได้ ~1 เขียน/วินาที
 * ถ้าชนกันตอนทั้งชั้นเล่นพร้อมกัน สถิติพลาดรอบเดียวไม่กระทบการเล่น รอบหน้าเขียนทับเอง
 *
 * ⚠️ เขียนด้วย dot-notation `rows.<uid>` เท่านั้น — setDoc ทั้งก้อนจะลบแถวคนอื่น
 * และ rules (`affectedKeys().hasOnly([uid])`) จะปฏิเสธอยู่ดี
 */
export function useRosterSync() {
  const auth = useAuthStore()
  const members = useMembersStore()

  async function syncRosterRow() {
    const uid = auth.currentUser?.uid
    const u = auth.userData
    if (!uid || !u) return
    if (!u.studentId && !u.nickname) return      // ตรรกะเดียวกับตอนสร้าง roster
    if (members.rosterMissing) return             // ยังไม่มี doc — รอแอดมินกดสร้างก่อน

    const next = buildRosterRow({ ...u, uid })
    if (!rosterRowChanged(members.rosterRows?.[uid], next)) return

    try {
      await updateDoc(doc(db, 'config', 'roster'), {
        [`rows.${uid}`]: next,
        updatedAt: serverTimestamp(),
      })
      useUsageStore().track(0, 1)
      members.rosterRows = { ...members.rosterRows, [uid]: next }   // กันเขียนซ้ำในเซสชันเดียว
    } catch (e) {
      console.warn('[roster sync]', e?.code || e)
    }
  }

  return { syncRosterRow }
}
```

- [ ] **Step 2: เดินสายจุดเรียก**

ในแต่ละไฟล์เพิ่ม:

```js
import { useRosterSync } from '../composables/useRosterSync.js'
const { syncRosterRow } = useRosterSync()
```

แล้วเรียก `syncRosterRow()` (ไม่ต้อง `await` — best-effort) **หลัง** `patchUser` สำเร็จ ที่จุดเหล่านี้:

จุดเรียกทั้งหมด (ยืนยันจากโค้ดจริงแล้ว — ไม่ต้องไปค้นเอง):

| ไฟล์ : บรรทัด | เรียกหลัง | ทำให้ฟิลด์ไหนเปลี่ยน |
|---|---|---|
| `Game2048View.vue` | จบเกม หลัง `patchUser` บันทึกคะแนน | `m.g2048` |
| `StackerView.vue` | จบเกม หลัง `patchUser` บันทึกคะแนน | `m.stacker` |
| `CapsuleRushView.vue` | จบเกม หลัง `patchUser` บันทึกคะแนน | `m.capsuleRush` |
| `TowerView.vue` | จบไฟต์ที่ผ่านชั้น หลังอัป `towerBest` | `tb` |
| `ArenaView.vue` | จบไฟต์ PvP หลัง `applyResult` | `r` |
| `MeView.vue` | บันทึกโปรไฟล์สำเร็จ (~บรรทัด 178) | `n`, `p` |
| `useResidence.js:46` | หลัง `upgrade()` และ `saved === true` | `l` |
| `PetDetailModal.vue:106` และ `:142` | หลังเปลี่ยน `activePets` สำเร็จ | `tm` |
| `TeamPicker.vue:86` | หลัง `save(next)` | `tm` |

หาบรรทัดจริงในแต่ละไฟล์ด้วย: `grep -n "patchUser" <ไฟล์>`

หมายเหตุ: `PetsView.vue` **ไม่ต้องแก้** — มันไม่ได้เขียน `activePets` เอง
คนเขียนคือ `PetDetailModal` กับ `TeamPicker` · และการเปลี่ยน `customPhoto`
ไม่ทำให้ roster เปลี่ยน (ไม่ได้อยู่ในแถว) `rosterRowChanged` จะ no-op ให้เอง —
เรียกทิ้งไว้ได้ ไม่เสีย write

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: สำเร็จไม่มี error

- [ ] **Step 4: ทดลองจริงใน dev**

Run: `npm run dev`
1. เล่น 2048 ทำคะแนน**สูงกว่าเดิม** → จบเกม → เปิด Firebase console ดู `config/roster` แถวตัวเอง `m.g2048` ต้องอัปเดต
2. เล่นอีกรอบได้คะแนน**ต่ำกว่าเดิม** → จบเกม → เปิด DevTools Network **ต้องไม่มี write ไป roster** (เพราะ best ไม่เปลี่ยน)
3. เปลี่ยนชื่อเล่นในหน้า Me → roster แถวตัวเอง `n` เปลี่ยน
4. เปิดบัญชีอื่น (หรือ incognito) → บอร์ดมินิเกมต้องเห็นคะแนนใหม่ของบัญชีแรก
5. ลองยิงเขียนแถวคนอื่นจาก DevTools console — ต้องโดน rules ปฏิเสธ:
```js
// ควรได้ permission-denied
firebase.firestore().doc('config/roster').update({ 'rows.someoneElseUid': { tb: 999 } })
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useRosterSync.js src/views/Game2048View.vue src/views/StackerView.vue src/views/CapsuleRushView.vue src/views/TowerView.vue src/views/ArenaView.vue src/views/MeView.vue src/composables/useResidence.js src/components/pets/PetDetailModal.vue src/components/battle/TeamPicker.vue
git commit -F - <<'MSG'
Roster: เขียนแถวตัวเองเมื่อสถิติที่ขึ้นบอร์ดเปลี่ยนจริง

useRosterSync เป็นจุดเดียวที่ฝั่งนักศึกษาเขียน config/roster · เทียบกับแถวเดิม
ก่อนเสมอ ค่าไม่เปลี่ยนไม่ยิง Firestore (ทำมินิเกมได้คะแนนต่ำกว่า best เดิม =
เงียบ) ซึ่งเป็นตัวคุม write contention หลัก เพราะ doc เดียวรับได้ ~1 เขียน/วินาที

เขียน dot-notation rows.<uid> เท่านั้น (setDoc ทั้งก้อนจะลบแถวคนอื่น และ rules
ปฏิเสธอยู่แล้ว) · ล้มเหลว = console.warn เงียบ ไม่ toast ไม่ retry เพราะสถิติ
บอร์ดพลาดรอบเดียวไม่กระทบการเล่น รอบหน้าเขียนทับเอง

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## เช็คหลังทำครบ 5 tasks

- [ ] `node --test src/utils/roster.test.js` ผ่านทั้งหมด
- [ ] เทสทั้งโปรเจกต์ยังผ่าน: `for f in src/utils/*.test.js; do node --test "$f" || echo "FAIL $f"; done`
- [ ] `npm run build` สำเร็จ
- [ ] `grep -rn "loadFbUsers" src/ --include=*.vue --include=*.js | grep -v "stores/members.js"` → **เหลือเฉพาะ AdminView**
- [ ] `config/roster` ใน console ไม่มี data URL (`customPhoto`) ปนอยู่
- [ ] เขียนแถวคนอื่นจาก DevTools → `permission-denied`
- [ ] rules deploy แล้ว (`firebase deploy --only firestore:rules`)
- [ ] **หลัง deploy ขึ้น Pages ต้องกด "🔄 สร้าง roster ใหม่" ใน Admin 1 ครั้ง** ไม่งั้นหน้าเพื่อนจะว่าง
