# `roster/current` — เลิกอ่านทั้ง collection (แก้ Firestore O(N²)) — Design

วันที่ 20 ส.ค. 2026 · สถานะ: อนุมัติแล้ว (user 20 ส.ค.) · HEAD ตอนออกแบบ `f69db89`

## ปัญหา

`stores/members.js` โหลดรายชื่อด้วย `getDocs(collection(db,'users'))` = **อ่านทุก doc ในรุ่น**
แคช localStorage 8 ชม. แชร์กันทุกหน้า → 1 คนเปิดแอป = N reads · N คนเปิด = **N² reads ต่อรอบ**

83 คนตอนนี้ ≈ 15k reads/วัน จากโควตาฟรี 50k · **170 คน = ทะลุโควตา** (ออดิต 13 ส.ค. ข้อ 1 🔴)

ผู้อ่านทั้งหมดของ `fbUsers`: `MembersView` (ไดเรกทอรีทั้งรุ่น) · `ArenaView`/`useArena` (พูลคู่ต่อสู้) ·
`TowerView` (แถบเทียบเพื่อน) · `useMinigameBoard` (บอร์ดทุกเกม) · `AdminView` (triage, `force:true`)

## ทางที่เลือกและทางที่ไม่เลือก

**เลือก: doc สรุปรวม `roster/current`** — ทุกจออ่าน 1 read ไม่ว่ากี่คน

**ไม่เลือก: ให้แต่ละบอร์ดยิง `orderBy().limit(N)`** — ต้นทุนคงที่จริง แต่แก้ได้แค่ครึ่งเดียว:
- `TowerView` ต้องการ **"อันดับ 12 จาก 40 คน" + คนที่ตามหลังอยู่** — top-N query ให้ไม่ได้
- `MembersView` เป็นไดเรกทอรีทั้งรุ่น = N โดยธรรมชาติ ซึ่งเป็น**ตัวกินโควตาหลัก** — query ช่วยไม่ได้เลย
- สุดท้ายต้องมาทำ roster ทับอยู่ดี

## 0. ทำไมไม่ใช่ `config/roster`

`firestore.rules:122` มี `match /config/{doc} { allow read: if true }` = **อ่านได้โดยไม่ต้องล็อกอิน**
และ rules ของ Firestore รวมกันแบบ **OR** — match ที่แคบกว่า**เพิ่ม**สิทธิ์ได้ ลดไม่ได้
→ วาง roster ใต้ `config/` = เปิดรายชื่อ + รหัสนักศึกษา + รูป + แท็บเรียนของทั้งรุ่นให้คนนอกอ่าน

ของเดิมใต้ `config/` (maintenance flag, topics, examSets, questionsMeta) ไม่มีข้อมูลส่วนบุคคล จึงไม่เป็นไร
**roster มี** → ต้องอยู่ collection ของตัวเองที่บังคับ `request.auth != null` ได้จริง

## 1. โครงสร้าง `roster/current`

```js
{
  rows: {
    "<uid>": {
      s:  "6512345678",              // studentId
      n:  "ปิ๊ก",                     // nickname (ผ่าน stripTrailingEmoji แล้ว)
      t:  "sci",                     // track
      l:  7,                         // residence.level
      p:  "https://lh3…",            // googlePhoto
      g:  null,                      // guestStatus (null = นักศึกษา)
      tb: 43,                        // towerBest
      r:  1120,                      // pvp.rating
      m:  { g2048: 8192 },           // minigames.<key>.best — เก็บเฉพาะที่ > 0
      tm: [["fox",3],["cat",1]],     // ทีมสู้: [petId, grade] สูงสุด 3 ตัว
    }
  },
  updatedAt: <serverTimestamp>
}
```

**คีย์ย่อ** ด้วยเหตุผลเดียวกับ `study.qcards` — doc นี้ถูกอ่านโดยทุกคนทุกเซสชัน
ขนาด ≈ 300 B/แถว × 170 คน ≈ **51KB** (เพดาน doc 1MB · เพดาน field ซ้อน 20 ระดับ — ไม่ใกล้)

### ทำไม `tm` ถึงจำเป็น
`ArenaView` ไม่ได้ใช้แค่เรต — มันต้อง**สู้กับทีมเพ็ทจริงของคู่ต่อสู้** (`opp.pets`, `opp.activePets`)
แต่ `resolveBattleTeam(ids, pets)` (`utils/petTeam.js:7`) ใช้จาก instance แค่ **`grade`** —
`rarity`/`element` ดึงจาก catalog ผ่าน `getPetDef(id)` อยู่แล้ว
→ เก็บแค่ `[id, grade]` 3 คู่ (~50 B) ก็สร้างทีมคู่ต่อสู้ได้ครบ **ไม่ต้องอ่าน doc ใครเลย**
→ `hasTeam` เดิม (`activePets.some(Boolean)`) กลายเป็น `row.tm?.length > 0`

### ไม่เก็บอะไร และเพราะอะไร
- **`customPhoto`** — เป็น data URL ก้อนใหญ่ · แคชเดิม `slimForCache` (`membersCache.js:11`) ก็ drop ทิ้งอยู่แล้ว
  บอร์ด/ลิสต์จึงโชว์ `googlePhoto` มาตลอด → **พฤติกรรมไม่เปลี่ยน**
- **`pets` เต็ม, `contact`, `likedBy`, `achievements`** — ใช้เฉพาะใน `ProfileModal` ที่เปิดทีละคน
  → กดดูโปรไฟล์ใครค่อยอ่าน `users/{uid}` 1 read แล้วจำไว้ในเซสชัน

## 2. ใครเขียน เมื่อไหร่

**เขียนแถวตัวเองเมื่อสถิติที่ขึ้นบอร์ดเปลี่ยนจริงเท่านั้น** (user เลือก 20 ส.ค.)

```js
// utils/roster.js — pure ทั้งหมด
buildRosterRow(userData) => row
rosterRowChanged(oldRow, newRow) => boolean   // deep-equal เฉพาะฟิลด์ในแถว
```

`composables/useRosterSync.js` เป็น**จุดเดียว**ที่เขียน — เรียก `syncRosterRow()` หลัง:
จบมินิเกม · จบไฟต์หอคอย · จบ PvP · อัปเลเวลบ้าน · เปลี่ยนชื่อเล่น/รูป/ทีมเพ็ท

เทียบก่อนเขียนเสมอ — **ค่าไม่เปลี่ยน = ไม่ยิง Firestore**
(ทำ 2048 ได้ 9 คะแนน ไม่ถึง best เดิม → เงียบ)

เขียนด้วย dot-notation `rows.<uid>` ผ่าน `updateDoc` → ไม่แตะแถวคนอื่น
ล้มเหลว = **เงียบ** (`console.warn` ไม่ toast) — สถิติบอร์ดพลาดรอบเดียวไม่กระทบการเล่น รอบหน้าเขียนทับเอง

### rules

```
match /roster/current {
  allow read:   if request.auth != null;
  allow update: if request.auth != null
    && request.resource.data.rows.diff(resource.data.rows)
         .affectedKeys().hasOnly([request.auth.uid]);
  allow create, delete: if isAdmin();
}
```

`affectedKeys().hasOnly([uid])` = เขียนได้เฉพาะคีย์ตัวเอง คนอื่นเขียนทับไม่ได้

## 3. แต่ละจอเปลี่ยนยังไง

| จอ | ก่อน | หลัง |
|---|---|---|
| `MembersView` ลิสต์ทั้งรุ่น | N reads | **1** |
| `ProfileModal` (กดดูใคร) | 0 (โหลดไว้แล้ว) | **1 ต่อคนที่กด** · จำในเซสชัน กดซ้ำ = 0 |
| `useMinigameBoard` ทุกเกม | N (แชร์แคช) | **0** (roster ก้อนเดิม) |
| `TowerView` แถบเทียบเพื่อน | N | **0** — อันดับ/ยอดรวม/คนที่ตามหลัง **ได้ครบเหมือนเดิม** |
| `useArena` พูลคู่ต่อสู้ | N | **0** — สร้างทีมคู่ต่อสู้จาก `tm` |
| `AdminView` triage/econ | N (`force:true`) | **ไม่แตะ** — แอดมินคนเดียว ต้องเห็น doc ดิบครบ |

`registered` (ในลิสต์ = "เข้าระบบแล้ว") เดิมเช็คจาก "มี doc ใน `fbUsers` ไหม"
→ เปลี่ยนเป็น "มีแถวใน roster ไหม" — ตรรกะเดียวกัน

### แยกสองเส้นทางใน `members.js` ให้ชัด (สำคัญ — AdminView จะพังถ้าไม่แยก)

`AdminView` ใช้ `members.fbUsers` / `members.guestUsers` อยู่ ซึ่งเป็น**ข้อมูล doc เต็ม**
(triage guest, econ editor, ตรวจ role) — ถ้าเปลี่ยน ref เดิมให้กลายเป็นแถว roster ผอมๆ AdminView จะพัง

store จึงมี **สอง** เส้นทางแยกกัน ไม่ปนกัน:

| | ref | ใครใช้ | ต้นทุน |
|---|---|---|---|
| `loadRoster()` | `roster` (ใหม่) | ทุกจอของนักศึกษา | 1 read |
| `loadFbUsers({force})` | `fbUsers`, `guestUsers` (ของเดิม ไม่แตะ) | **AdminView เท่านั้น** | N reads |
| `loadProfile(uid)` | `profiles` (ใหม่, cache ในเซสชัน) | `ProfileModal` | 1 read/คน |

`loadFbUsers` **ห้ามถูกเรียกจาก view ของนักศึกษาอีก** — ลบการเรียกออกจาก
`MembersView` / `ArenaView` / `TowerView` / `useMinigameBoard` ให้หมด
(ไม่งั้นแคช 8 ชม. ก็ยังเต็มเหมือนเดิม แล้วงานนี้จะไม่ประหยัดอะไรเลย)

## 4. ตอนเปิดใช้ + คนที่ยังไม่เคยเขียนแถว

ปุ่มแอดมิน **"🔄 สร้าง roster ใหม่"** ใน `AdminView` — อ่าน `users` ทั้ง collection ครั้งเดียว
(แอดมินคนเดียว = ถูก) แล้ว `setDoc('roster/current')` ทั้งก้อน

แพทเทิร์นเดียวกับ `config/questionsMeta` + ปุ่ม "🔄 คำนวณ meta ใหม่" ที่มีอยู่แล้ว (`QuestionsView.vue:702`)

**ถ้า `roster/current` ไม่มี → แสดงสถานะว่างพร้อมข้อความให้แอดมินกดสร้าง
ห้าม fallback ไปอ่านทั้ง collection เงียบๆ** — fallback แบบนั้นคือสิ่งที่เผาโควตาโดยไม่มีใครรู้ตัว
ซึ่งเป็นปัญหาเดิมที่กำลังแก้อยู่พอดี

⚠️ **ต้องกดปุ่มนี้ 1 ครั้งหลัง deploy** (เหมือนตอน past-exam ที่ต้องกด "คำนวณ meta ใหม่")

## 5. โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/utils/roster.js` **ใหม่** | pure: `buildRosterRow` `rosterRowChanged` `buildRosterFromUsers` `rosterToMembers` `rosterToBoardUsers` `rosterTeam` |
| `src/utils/roster.test.js` **ใหม่** | `node --test` |
| `src/composables/useRosterSync.js` **ใหม่** | จุดเดียวที่เขียนแถว (เทียบก่อนเขียน + เงียบเมื่อล้มเหลว) |
| `src/stores/members.js` | อ่าน `roster/current` แทน `getDocs(collection)` + เพิ่ม `loadProfile(uid)` |
| `firestore.rules` | บล็อก `roster/current` |
| `src/views/AdminView.vue` | ปุ่ม "🔄 สร้าง roster ใหม่" |
| จุดเรียก sync | `Game2048View` `StackerView` `CapsuleRushView` `TowerView` `ArenaView` `MeView` `PetsView` |

ตรรกะทั้งหมดอยู่ใน `roster.js` (pure, เทสได้) · store/view เรียกใช้อย่างเดียว —
แนวเดียวกับ `minigameCore.js` / `srsQuestions.js`

## 6. เทส (`node --test`)

1. `buildRosterRow` map ฟิลด์ครบและตัด `customPhoto` ทิ้ง
2. `buildRosterRow` เก็บ `m` เฉพาะเกมที่ best > 0 (ไม่มีเกมไหนเลย → `m` เป็น `{}`)
3. `buildRosterRow` `tm` = `[id, grade]` สูงสุด 3 คู่ · ข้าม slot ที่เป็น null
4. `rosterRowChanged` ค่าเท่าเดิม → `false` (ไม่เขียน)
5. `rosterRowChanged` best มินิเกมขยับ → `true`
6. `rosterRowChanged` เหรียญเปลี่ยนแต่ฟิลด์บอร์ดเท่าเดิม → `false`
7. `rosterRowChanged` แถวเดิมไม่มี (คนใหม่) → `true`
8. `buildRosterFromUsers` ข้าม doc ที่ไม่มีทั้ง `studentId` และ `nickname` (ตรรกะเดิมของ store)
9. `rosterToMembers` แยกนักศึกษา/guest ตาม `g` และคง `registered` ถูก
10. `rosterTeam` คืนรูปเดียวกับ `resolveBattleTeam` (id/rarity/element/grade จาก catalog)
11. `rosterToBoardUsers` คืนรูปที่ `buildMinigameBoard` รับได้ (มี `uid/studentId/nickname/track/googlePhoto/minigames`)

## 7. ความเสี่ยงที่รู้ตัว

| ความเสี่ยง | ท่าที |
|---|---|
| **write contention** — doc เดียวรับ ~1 เขียน/วินาที | "เปลี่ยนจริงเท่านั้น" ตัดการเขียนส่วนใหญ่ทิ้ง · ชนแล้วเงียบ ไม่ retry วน · สถิติพลาดรอบเดียวไม่เป็นไร |
| **นักศึกษาแก้แถวตัวเองผ่าน DevTools** (`tb: 999`) | rules กันได้แค่ "เขียนเฉพาะแถวตัวเอง" ไม่ตรวจค่า · **เท่ากับระดับความเชื่อใจเดิมของแอป** (coins/towerBest บน user doc ก็โกงได้ rules มีแค่ light guard) — ไม่ได้แย่ลง |
| **แถวค้างของคนที่ลบบัญชี** | ปุ่มสร้าง roster ใหม่ล้างให้ · แอดมินลบ doc ได้ |
| **doc โตเกิน 1MB** | 170 คน ≈ 51KB · ถึงเพดานต้องมี ~3,300 คน — ไม่ใช่ปัญหาของแอปรุ่น |
| **`ProfileModal` อ่านทีละคน** | เปิด 20 โปรไฟล์ = 21 reads เทียบกับ 83 เดิม — ยังถูกกว่ามาก และจำในเซสชัน |
