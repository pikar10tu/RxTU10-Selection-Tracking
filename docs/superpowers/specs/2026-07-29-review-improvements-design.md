# ปรับปรุงระบบตรวจข้อสอบ (Peer Review v3) — Design Spec

**วันที่:** 2026-07-29
**สถานะ:** อนุมัติดีไซน์แล้ว (user เคาะผ่าน brainstorm) → รอเขียน implementation plan
**ที่มา:** ทีมวิชาการเริ่มใช้งานจริงแล้ว user เก็บ feedback จากหน้างานมา 5 ข้อ (29 ก.ค. 2026) + ข้อเสนอจากการอ่านโค้ดอีก 3 ข้อที่ user เลือกเข้ารอบนี้
**ของเดิม:** `2026-06-29-question-peer-review-design.md` (เฟส 1) · แผน v2 `plans/2026-07-03-review-workflow-v2.md`

---

## 1. เป้าหมาย / Why

ระบบตรวจใช้งานจริงแล้ว ปัญหาที่เจอหน้างานคือ **ผู้ตรวจอธิบายเพิ่มไม่ได้** · **ไม่รู้ว่าใครตรวจ** · **ข้อค้างที่ 1 เสียงเยอะ ไม่ครบสองสักที** · **ติดแท็กกลุ่มโรคได้ทีละอัน** · และ **หลายคนเจอข้อเดียวกันตลอดเพราะคิวไม่ได้สุ่มจริง**

รอบนี้แก้ทั้ง 5 ข้อ + ปิดหนี้เชิงโครงสร้าง 3 ข้อที่จะกัดตอนคลังโต (ต้นทุน read, กดพลาดแล้วแก้ไม่ได้, ทีมไม่เห็นความคืบหน้ารวม)

---

## 2. สรุปสิ่งที่จะทำ (8 ข้อ)

| # | เรื่อง | แก่นของงาน |
|---|--------|-------------|
| 1 | หมายเหตุผู้ตรวจ | field `reviewNote` บนข้อ — ช่องเดียว ต่อเติมได้ นักศึกษาเห็นท้ายเฉลย |
| 2 | ใครตรวจข้อนี้ | โชว์ชื่อผู้ตรวจ + กดดูเหตุผลรายข้อ ในคลังข้อสอบ (ทีมวิชาการเท่านั้น) |
| 3 | คิวสุ่มถ่วงน้ำหนัก | ขัดแย้ง ×8 · ค้าง 1 เสียง ×4 · ยังไม่มีใครตรวจ ×1 |
| 4 | กลุ่มโรคหลายค่า | `category: string` → `categories: string[]` ทั้งระบบ |
| 5 | ตรวจชนกัน | นับเสียงที่ 3 ด้วย (ไม่ทิ้ง) + แก้ toast เคสส่งซ้ำ |
| 6 | สถานะ `half` + คุมต้นทุน read | แยก "ตรวจแล้ว 1 คน" ออกจาก `pending` → โหลดคิวแบบต้นทุนคงที่ |
| 7 | แก้ผลตรวจที่เพิ่งส่ง | ปุ่มแก้ข้อล่าสุดในเซสชัน (ทรานแซกชันย้ายเสียง −1/+1) |
| 8 | แถบความคืบหน้ารวม | ตัวนับสถานะใน `reviewMeta/main` อัปเดตด้วย `increment()` (0 read เพิ่ม) |

---

## 3. โครงข้อมูล (Firestore)

### 3.1 `questions/{qid}` — เพิ่ม/เปลี่ยน 2 ฟิลด์

| ฟิลด์ | ชนิด | หมายเหตุ |
|-------|------|----------|
| `reviewNote` | `string` | หมายเหตุผู้ตรวจ — **นักศึกษาเห็น** (แสดงท้าย `explanation`) · `cleanText(_, LIMITS.reviewNote)` |
| `categories` | `string[]` | กลุ่มโรค/หัวข้อ หลายค่า (สูงสุด `MAX_CATEGORIES = 5`) |

- **`category` (string) เดิมไม่ลบ ไม่เขียนต่อ** — อ่านผ่าน helper เท่านั้น ข้อเก่าจึงใช้งานได้ทันทีไม่ต้องรอ migrate
- ค่าสถานะ `reviewStatus` เพิ่ม `'half'` (ดู §4.1)
- ไม่มีฟิลด์ใหม่อื่น — ตัวนับ `reviewPass`/`reviewFail`/`reviewedBy` คงเดิม

### 3.2 `reviewMeta/main` — เพิ่มก้อน `progress`

```
{
  counts: { uid: number },        // เดิม — leaderboard
  names:  { uid: string  },       // เดิม — ชื่อ snapshot
  progress: { pending, half, passed, failed, conflict, retired }   // ใหม่ ทั้งหมดเป็น number
}
```

`progress` อัปเดตด้วย `increment(±1)` ในทรานแซกชันเดียวกับการส่ง/แก้ผลตรวจ (`[oldStatus]: -1`, `[newStatus]: +1`) ⇒ **ไม่มี read เพิ่มเลย** · ค่าอาจ drift ได้จากทางอื่น (สร้างข้อใหม่ / import / แก้เนื้อหาแล้วรีเซ็ต / นำออก) → **ปุ่ม "🔄 ซิงก์ระบบตรวจ" ใน Admin คำนวณใหม่ทั้งก้อนให้ตรงเป๊ะ** (self-healing แบบเดียวกับ `counts` ที่ทำอยู่แล้ว)

**key ของ `progress` = ค่าจาก `reviewStatusKey(q)`** (คือ `computeStatus` + `'retired'` ทับเมื่อข้อถูกนำออก) · ทรานแซกชันตอนตรวจไม่มีทางแตะ `retired` เพราะข้อ `retired` ไม่เข้าคิวอยู่แล้ว — ยอดของ `retired` มาจากการซิงก์เท่านั้น

### 3.3 `LIMITS` (utils/text.js) — เพิ่ม 1 ค่า

```js
reviewNote: 1000,   // เท่ากับ explanation
```

### 3.4 firestore.rules (ต้อง `firebase deploy --only firestore:rules`)

**ก) `reviewSubmitKeys()` เพิ่ม 2 key** — ผู้ตรวจติดแท็กหมวด/เขียนหมายเหตุระหว่างส่งผลตรวจได้:
```
['reviewedBy','reviewPass','reviewFail','reviewStatus','reviewVerdicts','category','categories','reviewNote']
```

**ข) เพิ่ม `isReviewAmend(qid)`** — แก้ผลตรวจของตัวเอง (ข้อ 7): แตะเฉพาะ `reviewSubmitKeys` · uid **อยู่ใน** `reviewedBy` เดิมแล้ว · `reviewedBy` ก่อน/หลังเท่ากัน (ไม่เพิ่มคน) · **เสียงรวมเท่าเดิม** (`pass+fail` ไม่เปลี่ยน) · และมี `reviews/{uid}` ของตัวเองในทรานแซกชันเดียวกัน (`existsAfter`)
```
allow update: if canEditQuestions()
  && (isAdmin() || reviewUntouched() || isReviewSubmit(id) || isReviewAmend(id) || isReviewReset());
```

**ค) `match /reviews/{reviewerUid}` — ยอมให้เจ้าของแก้ `verdict` ได้แล้ว** (เดิมล็อกไว้กัน desync กับตัวนับ) เพราะตอนนี้การแก้ไปพร้อมกับ `isReviewAmend` ที่ย้ายตัวนับให้ในทรานแซกชันเดียว · ยังบังคับ `reviewerUid` ห้ามเปลี่ยน (กันสวมชื่อ)

> ตามสไตล์ trust-based ของโปรเจกต์: rules กันการปั่นแบบหยาบ (เพิ่มเสียงให้ตัวเอง / ตรวจแทนคนอื่น / แก้ผลคนอื่น) ไม่พยายามพิสูจน์ว่า delta ตัวนับตรงกับ verdict ใหม่เป๊ะ — ความถูกต้องละเอียดมาจากทรานแซกชันฝั่ง client + ปุ่มซิงก์

**ไม่แก้:** เสียงที่ 3 ไม่ต้องเพิ่ม guard อะไร — `isReviewSubmit` เดิมยอม +1 อยู่แล้ว ตรงกับที่ตัดสินใจว่า "นับเสียงที่ 3 ด้วย"

### 3.5 firestore.indexes.json (ต้อง `firebase deploy --only firestore:indexes`)

เพิ่ม 1 composite index สำหรับหน้าต่างสุ่มข้อที่ยังไม่มีใครตรวจ:
```json
{ "collectionGroup": "questions", "queryScope": "COLLECTION",
  "fields": [ { "fieldPath": "reviewStatus", "order": "ASCENDING" },
              { "fieldPath": "rand", "order": "ASCENDING" } ] }
```
(query `where reviewStatus in ['half','conflict']` เป็น single-field ไม่ต้องมี index · index เดิม `isPublished+category+rand` ไม่มีใคร query ใช้จริง — ปล่อยไว้ ไม่ต้องลบในรอบนี้)

---

## 4. ตรรกะล้วน — `utils/questionReview.js` (+ `.test.js`)

### 4.1 `computeStatus(question)` — เพิ่มค่า `'half'`

```
votes = reviewPass + reviewFail
0 votes            → 'pending'
1 vote             → 'half'        ★ ใหม่
≥2: pass > fail    → 'passed'
    fail > pass    → 'failed'
    เท่ากัน         → 'conflict'
```

ผลพลอยได้สำคัญ: `syncReviewSystem()` ใน Admin เทียบ `q.reviewStatus !== computeStatus(q)` อยู่แล้ว ⇒ **ข้อเก่าที่มี 1 เสียงจะถูกประทับ `half` ให้เองตอนกดปุ่มซิงก์ ไม่ต้องเขียนโค้ด backfill ใหม่**

`REVIEW_STATUS_LABEL` เพิ่ม `half: 'ตรวจแล้ว 1 คน'` · `needsReviewBy` / `REVIEW_RESET` / `reviewStatusKey` **ไม่ต้องแก้** (ยังใช้ `reviewedBy.length < 2 || status === 'conflict'` และรีเซ็ตกลับ `'pending'` เหมือนเดิม — ตรงกับ rules `isReviewReset` ที่บังคับ `'pending'`)

### 4.2 ถ่วงน้ำหนักคิว — ฟังก์ชันใหม่

```js
export function reviewWeight(q)                    // conflict → 8 · half → 4 · อื่นๆ → 1
export function pickWeighted(list, rnd = Math.random)   // คืน 1 item ตามน้ำหนัก (list ว่าง → null)
```
`rnd` ฉีดได้เพื่อเทสแบบ deterministic

### 4.3 หมวดหลายค่า — โมดูลใหม่ `utils/questionCategories.js` (+ `.test.js`)

```js
export const MAX_CATEGORIES = 5
export function getCategories(q)        // q.categories (array) ?? [q.category] ?? []  — กันค่าว่าง/ซ้ำ
export function normalizeCategories(arr)  // cleanText ทีละตัว + ตัดว่าง + unique + slice(0, MAX)
```
เป็นทางเข้าเดียวของการอ่าน/เขียนหมวด — ห้ามอ่าน `q.category` ตรงๆ ที่อื่นอีก

### 4.4 `reviewContentChanged()` — **ไม่แตะ**

ยังดูแค่ `question / choices / answer / explanation` ⇒ แก้ `reviewNote` หรือ `categories` **ไม่ล้างผลตรวจ** (ตั้งใจ: หมายเหตุกับแท็กเป็นงานของผู้ตรวจเอง ไม่ควรเด้งข้อกลับเข้าคิว)

---

## 5. หน้าตรวจ — `views/ReviewView.vue`

### 5.1 โหลดคิวแบบต้นทุนคงที่ (ข้อ 6)

แทน `where('reviewStatus','in',['pending','conflict'])` ที่อ่าน**ทุกข้อค้าง**ทุกครั้ง → 3 query ขนาน:

| ก้อน | query | limit |
|------|-------|-------|
| ค้าง/ขัดแย้ง | `where('reviewStatus','in',['half','conflict'])` | 200 |
| ยังไม่มีใครตรวจ | `where('reviewStatus','==','pending')` + `orderBy('rand')` + `startAt(Math.random())` | 40 |
| meta | `getDoc(reviewMeta/main)` | 1 |

- ก้อนที่ 2 ถ้าได้ไม่ครบ limit (สุ่มไปชนปลายลิสต์) → ยิงซ้ำ `startAt(0)` เติมส่วนที่ขาด — **ใช้ `utils/quizSample.js` ที่มี pattern first/wrap นี้อยู่แล้ว**
- รวม 2 ก้อนแรกเป็น `list` เดียว แล้วกรองด้วย `nextReviewQueue()` เหมือนเดิม (กันข้อตัวเอง/ตรวจซ้ำ/`retired`)
- **ผลลัพธ์:** เปิดหน้า ≈ 40–240 read คงที่ ไม่โตตามคลัง และ "ข้อค้าง 1 เสียง" ถูกดึงมาครบเสมอ ไม่ใช่แค่ที่บังเอิญติดหน้าต่างสุ่ม

### 5.2 เลือกข้อถัดไปแบบถ่วงน้ำหนัก (ข้อ 3)

เปลี่ยนจาก `current = queue[0]` (เรียง `createdAt` ใหม่→เก่า = ทุกคนเห็นข้อเดียวกันเป๊ะ) เป็น:
- `currentId` เป็น `ref` · `pickNext()` เรียก `pickWeighted(queue)` แล้วตรึงไว้จนกว่าจะส่ง/ข้าม
- เรียก `pickNext()` เมื่อ: โหลดเสร็จ · ส่งผลตรวจสำเร็จ · กดข้าม · กด "ดูข้อที่ข้ามอีกรอบ"
- ห้ามให้ `current` เป็น computed ของ `queue` ตรงๆ อีก (ไม่งั้นข้อจะเด้งเองเวลา list เปลี่ยน)

### 5.3 ฟอร์มตรวจ

- **หมวด/หัวข้อ → เลือกหลายค่า** ใช้ `TopicSelect` เวอร์ชัน multi (§7)
- **ช่องใหม่ "หมายเหตุผู้ตรวจ (นักศึกษาจะเห็นท้ายเฉลย)"** — ไม่บังคับ · ถ้าข้อนี้มีอยู่แล้ว **โหลดค่าเดิมมาใส่ในช่อง** พร้อมป้ายเล็ก *"มีหมายเหตุจากผู้ตรวจคนก่อน — ต่อเติมหรือขัดเกลาได้"* (กันลบทิ้งโดยไม่ตั้งใจ) · เขียนลง `reviewNote` เฉพาะเมื่อค่าเปลี่ยนจากเดิม
- ลำดับช่อง: ผลตัดสิน → หมวด → เหตุผล (ภายในทีม) → เรฟ → หมายเหตุผู้ตรวจ (นักศึกษาเห็น) — ป้ายกำกับต้องบอกชัดว่าอันไหนใครเห็น

### 5.4 ส่งผลตรวจ — ทรานแซกชัน (ข้อ 5)

โครงเดิมคงไว้ (อ่านสด → เช็ก `qhash` → กันส่งซ้ำ → เขียน 3 จุด) ปรับ 3 อย่าง:
1. **เสียงที่ 3 นับปกติ ไม่บล็อก** — `computeStatus` รองรับอยู่แล้ว (3 เสียงไม่มีทางเสมอ → ตัดสินได้เสมอ · ข้อที่เคย 2-0 แล้วมีเสียงสวนก็ยังตามเสียงข้างมาก) · ถ้าตอนอ่านสดพบว่าข้อปิดไปแล้ว (`passed`/`failed`) ให้ส่งต่อไปตามปกติแต่ toast ว่า *"มีคนตรวจข้อนี้พร้อมกัน — นับเสียงคุณเป็นเสียงที่ 3 ด้วยแล้ว"* จะได้ไม่งงว่าทำไมข้อหลุดคิวทันที
2. **เคสส่งซ้ำ (`already`)** — เปลี่ยน toast จาก `'ส่งผลตรวจแล้ว ขอบคุณ!'` (success) เป็น *"คุณตรวจข้อนี้ไปแล้ว"* โทน info · ไม่บวก `progress`/`counts`
3. **เขียน `progress`** ใน `tx.set(reviewMeta/main, …)` ก้อนเดิม: `progress: { [oldStatus]: increment(-1), [newStatus]: increment(1) }` (คำนวณ `oldStatus` จาก snapshot สดในทรานแซกชัน)

พร้อมกันนี้เขียน `categories` (ถ้าเปลี่ยน) และ `reviewNote` (ถ้าเปลี่ยน) ลงไปในก้อน `qPatch` เดิม

> ⚠️ **กับดัก:** `isReviewSubmit`/`isReviewAmend` ใช้ `affectedKeys().hasOnly(reviewSubmitKeys())` ⇒ **ห้ามเผลอใส่ `updatedAt` หรือฟิลด์อื่นใน `qPatch` ของเส้นทางตรวจ** ไม่งั้น rules ปฏิเสธทั้งก้อน (โค้ดปัจจุบันไม่ได้ใส่ — อย่าไปเติม)

### 5.5 แก้ผลตรวจที่เพิ่งส่ง (ข้อ 7)

- หลังส่งสำเร็จ เก็บ `lastSubmit = { qid, qhash, verdict, reason, ref }` ใน state และแสดงแถบใต้การ์ดข้อถัดไป: *"เพิ่งส่ง: ✅ ถูกต้อง — [แก้ผลตรวจ]"* (หายไปเมื่อ reload หน้า)
- กดแล้วเปิดฟอร์มย่อ (ผลตัดสิน + เหตุผล + เรฟ) → ยืนยัน → ทรานแซกชัน:
  - อ่านสด: ถ้า `qhash` เปลี่ยน หรือ uid ไม่อยู่ใน `reviewedBy` แล้ว → ยกเลิกพร้อม toast (ข้อถูกแก้/ถูกล้างผลตรวจไปแล้ว)
  - `newPass = pass − (oldPass?1:0) + (newPass?1:0)` (fail เช่นกัน) — **เสียงรวมเท่าเดิม**
  - `tx.set(reviews/{uid}, {...})` ทับ (verdict/reason/ref/ts ใหม่ · `reviewerName` คงเดิม)
  - `tx.update(question, { reviewPass, reviewFail, reviewStatus })`
  - `tx.set(reviewMeta/main, { progress: { [old]: -1, [new]: +1 } }, { merge:true })` — **`counts` ไม่แตะ** (ไม่ใช่การตรวจข้อใหม่)
- ปุ่มนี้จำกัดเฉพาะข้อล่าสุดในเซสชัน (ฝั่ง UI) · rules ยอมให้เจ้าของแก้ผลตรวจตัวเองข้อไหนก็ได้ (ง่ายกว่าและไม่เป็นอันตราย — แอดมินยังมีปุ่มล้างผลตรวจอยู่)
- ปรับข้อความกล่องยืนยันตอนส่ง จาก *"ส่งแล้วแก้เองไม่ได้ — ถ้ากดพลาดให้แจ้งแอดมิน"* เป็น *"ส่งแล้วยังกดแก้ได้จากแถบด้านล่างก่อนออกจากหน้านี้"*

### 5.6 แถบสรุป (ข้อ 8)

แทนบรรทัด "เหลือต้องตรวจ N ข้อ" ด้วยแถบความคืบหน้าคลัง:

```
📋 ผ่านแล้ว 320 · ค้าง 1 เสียง 45 · รอตรวจ 180 · ขัดแย้ง 3        [คิวของคุณ: 62 ข้อ]
```
- ตัวเลขคลังมาจาก `reviewMeta/main.progress` (ที่โหลดมาแล้ว 1 read) · **"คิวของคุณ"** = `nextReviewQueue(list).length` จากที่โหลดมาจริง — ระบุให้ชัดว่าเป็นจำนวนในหน้าต่างที่ดึงมา ไม่ใช่ทั้งคลัง (ใช้คำว่า "คิวรอบนี้")
- มีแถบ progress bar บาง ๆ สัดส่วน passed/ทั้งหมด ให้ทีมเห็นว่าเดินหน้าจริง

---

## 6. คลังข้อสอบ — `views/QuestionsView.vue`

### 6.1 ใครตรวจข้อนี้ (ข้อ 2)

- `load()` เพิ่ม `getDoc(reviewMeta/main)` (**+1 read ต่อการเข้าหน้า**) เก็บ `names`
- ในแผงรายละเอียดที่กางออก (`qz-audit`) เพิ่มบรรทัด **"ตรวจโดย: ก, ข"** map จาก `q.reviewedBy` (มีบน doc อยู่แล้ว → ไม่มี read เพิ่ม) · ไม่มีใครตรวจ → "ยังไม่มีใครตรวจ"
- ปุ่ม **"ดูเหตุผล"** ข้างบรรทัดนั้น → `getDocs(questions/{id}/reviews)` เฉพาะข้อที่กด (**1 read/ข้อ ตอนกด** cache ไว้ในหน้า) แสดง **ชื่อ · ผลตัดสิน · เหตุผล · เรฟ · เวลา** (ใช้สไตล์การ์ด `rv-prior` จาก ReviewView)
- กรองเฉพาะรีวิวของรอบปัจจุบัน (`reviewedBy.includes(d.id)`) เหมือนที่ ReviewView ทำ — กัน subdoc ค้างจากรอบก่อนรีเซ็ต

### 6.2 หมวดหลายค่า (ข้อ 4)

- ฟอร์มแก้/สร้างข้อ: `TopicSelect` → multi (`draft.categories`)
- แถวรายการ + แผงรายละเอียด: แสดงชิปหลายอันจาก `getCategories(q)`
- dropdown ตัวกรองหมวด: `distinctCategories()` รวมจากทุกค่าใน `categories`
- ฟอร์มแก้ข้อเพิ่ม **ช่อง "หมายเหตุผู้ตรวจ"** ด้วย (แก้/ลบได้จากที่นี่) — ไม่ทำให้ผลตรวจรีเซ็ต (§4.4)

### 6.3 utils ที่ต้องตามแก้

| ไฟล์ | แก้อะไร |
|------|---------|
| `utils/questionsFilter.js` | `distinctCategories` รวมทุกค่า · `filterQuestions` แมตช์ด้วย `getCategories(q).includes(cat)` · ช่องค้นหารวมทุกหมวดเข้า haystack |
| `utils/questionsMeta.js` | `categories` ของ meta รวมจาก `getCategories()` ของข้อที่เผยแพร่ |
| `utils/importQuestions.js` | รับทั้ง `categories` (array) และ `category` (string เดี่ยว) → normalize เป็น array — **มิเรอร์ pattern `examSets`/`examSet` ที่มีอยู่แล้ว** · อัปเดตกล่องช่วยเหลือรูปแบบ JSON ในหน้า import ด้วย |
| `utils/questionReport.js` | snapshot ใช้ `getCategories().join(', ')` |

---

## 7. คอมโพเนนต์ — `components/questions/TopicSelect.vue` → multi

เปลี่ยนเป็นรับ/ส่ง **array** (`modelValue: Array`) แบบเดียวกับ `ExamSetSelect.vue` ที่มีอยู่แล้ว:
- ชิปของที่เลือกไว้ + กด × ถอดออก
- dropdown เลือกเพิ่ม (ค่าที่เลือกแล้วไม่โผล่ซ้ำ) + `➕ เพิ่มหัวข้อใหม่…` เหมือนเดิม
- เต็ม `MAX_CATEGORIES` แล้ว → dropdown disabled พร้อมข้อความบอก
- ค่าเดิมที่ไม่อยู่ในลิสต์กลาง (ข้อเก่าพิมพ์อิสระ) ต้องยังแสดง/คงอยู่ได้ (เงื่อนไขเดิมของคอมโพเนนต์)

**ผู้ใช้:** ReviewView + QuestionsView (ทั้งสองที่เป็น array หมด ไม่มีโหมด single หลงเหลือ)

---

## 8. ฝั่งนักศึกษา — `views/QuizView.vue`

ใต้บรรทัด `explanation` (QuizView.vue:81) เพิ่ม:
```
📝 หมายเหตุจากผู้ตรวจ: {{ current.reviewNote }}
```
- แสดงเมื่อมีค่าเท่านั้น · สไตล์แยกจากเฉลยให้เห็นว่าเป็นคนละก้อน (โทนน้ำเงินอ่อน ต่างจากเฉลยที่เป็นเหลือง)
- **ไม่แสดงชื่อผู้ตรวจ** (ตามที่เคาะ: ชื่อเห็นเฉพาะทีมวิชาการ)
- ไม่ต้องแก้ rules — `reviewNote` อยู่บน question doc ที่นักศึกษาอ่านได้อยู่แล้วเมื่อ `isPublished`

---

## 9. Admin — `views/AdminView.vue` (`syncReviewSystem`)

ปุ่ม "🔄 ซิงก์ระบบตรวจ" เดิม (อ่านทั้งคลัง 1 รอบ) เพิ่มงานอีก 2 อย่างในลูปเดิม — ยัง idempotent:
1. ข้อที่ยังไม่มี `categories` แต่มี `category` → เขียน `categories: [category]`
2. คำนวณ `progress` ใหม่ทั้งก้อนจากคลังจริง แล้ว `setDoc` ทับ (แก้ drift)

`reviewStatus` → `'half'` ของข้อเก่าเกิดขึ้นเองจากการเทียบ `computeStatus` ที่มีอยู่แล้ว **ไม่ต้องเขียนโค้ดเพิ่ม**

> ⚠️ **หลัง deploy รอบนี้ ต้องกด "🔄 ซิงก์ระบบตรวจ" ใน Admin หนึ่งครั้ง** ก่อนใช้งานจริง (ประทับ `half` + เติม `categories` + ตั้งต้น `progress`) — ไม่กดแล้วข้อค้าง 1 เสียงจะไม่ถูกเร่ง และแถบความคืบหน้าจะว่าง

---

## 10. เรื่องการตรวจชนกัน — สรุปพฤติกรรมสุดท้าย (ข้อ 5)

| สถานการณ์ | ระบบทำอะไร |
|-----------|-------------|
| 2 คนกดส่งข้อเดียวกันพร้อมกัน | `runTransaction` serialize ให้ — คนหลังอ่านค่าที่คนแรกเขียนแล้ว ตัวนับ/สถานะถูกต้องเสมอ |
| คนที่ 3 กดส่งทั้งที่ข้อปิดไปแล้ว | **นับเสียงด้วย** (ตามที่เคาะ) + toast บอกว่าเป็นเสียงที่ 3 · เสียงข้างมากตัดสิน สถานะไม่พลิกมั่ว |
| คนเดิมกดส่งซ้ำจากอีกเครื่อง | ตรวจพบจาก `reviewedBy` → ไม่เขียนซ้ำ + toast *"คุณตรวจข้อนี้ไปแล้ว"* (เดิมบอกว่าสำเร็จ = หลอก) |
| ข้อถูกแก้เนื้อหาระหว่างตรวจอยู่ | `qhash` ไม่ตรง → ปฏิเสธ + โหลดคิวใหม่ (เดิมมีอยู่แล้ว คงไว้) |
| 2 คนแก้ `reviewNote` เกือบพร้อมกัน | คนหลังทับ — ยอมรับได้ (ทีมเล็ก · คนที่ 2 เห็นของเดิมในช่องอยู่แล้วก่อนพิมพ์) |
| โอกาสเจอข้อเดียวกัน | ลดลงมากจากคิวสุ่มถ่วงน้ำหนัก (เดิมเรียง `createdAt` = ทุกคนได้ข้อเดียวกันเป๊ะ) |

**ไม่ทำ:** ระบบจอง/ล็อกข้อ (กลุ่มเล็ก ล็อกค้างยุ่งกว่าเดิม) · realtime listener บนคิว (เปลืองอ่าน)

---

## 11. นอกขอบเขตรอบนี้ (ทำรอบหน้า)

- **โหมด "เผยแพร่เฉพาะข้อที่ผ่านวิชาการ"** — สวิตช์ใน Admin + ควิซหยิบเฉพาะ `passed` (สเปกเฟส 1 §8 วางไว้ รอคลังผ่านตรวจมากพอ)
- **"ผลตรวจของฉัน"** — ผู้ตรวจย้อนดูข้อที่ตัวเองตรวจแล้วสรุปออกมายังไง (`where reviewedBy array-contains me`)
- **ทางลัด "ต้องแก้ → เปิดแก้เลย"** deep link หน้าตรวจ ↔ คลังข้อสอบ
- สถิติรายวัน/สตรีคของผู้ตรวจ · หมายเหตุแยกรายผู้ตรวจ · workflow ส่งข้อ `failed` กลับให้คนแต่งแก้

---

## 12. ไฟล์ที่แตะ + การตรวจสอบ

| ไฟล์ | งาน |
|------|-----|
| `utils/questionReview.js` + `.test.js` | `computeStatus` เพิ่ม `half` · `reviewWeight` · `pickWeighted` · label ใหม่ |
| `utils/questionCategories.js` + `.test.js` | **ใหม่** — `getCategories` / `normalizeCategories` / `MAX_CATEGORIES` |
| `utils/text.js` | `LIMITS.reviewNote = 1000` |
| `utils/questionsFilter.js` + `.test.js` | หมวดหลายค่าในตัวกรอง/ค้นหา |
| `utils/questionsMeta.js` + `.test.js` | `categories` รวมจาก array |
| `utils/importQuestions.js` + `.test.js` | รับ `categories` array หรือ `category` เดี่ยว |
| `utils/questionReport.js` (+test) | snapshot หมวดหลายค่า |
| `components/questions/TopicSelect.vue` | เปลี่ยนเป็น multi (array) |
| `views/ReviewView.vue` | โหลดคิวใหม่ · สุ่มถ่วงน้ำหนัก · ช่องหมายเหตุ · แก้ผลตรวจ · แถบความคืบหน้า · toast |
| `views/QuestionsView.vue` | ชื่อผู้ตรวจ + แผงเหตุผล · หมวดหลายค่า · ช่อง `reviewNote` |
| `views/QuizView.vue` | แสดง `reviewNote` ท้ายเฉลย |
| `views/AdminView.vue` | ขยาย `syncReviewSystem` (categories + progress) |
| `firestore.rules` | `reviewSubmitKeys` +2 key · `isReviewAmend` · reviews.update ยอมแก้ verdict |
| `firestore.indexes.json` | index `reviewStatus + rand` |

**ตรวจงาน:** `node --test src/utils/*.test.js` เขียวทุกไฟล์ + `npm run build` ผ่าน + ทดลองใน dev
**Deploy:** `git push origin master` (Pages) + `firebase deploy --only firestore:rules,firestore:indexes` + **กดปุ่มซิงก์ระบบตรวจใน Admin 1 ครั้ง**
**เวิร์กโฟลว์:** subagent-driven (master + backup branch + ledger) เหมือนรอบก่อน ๆ
