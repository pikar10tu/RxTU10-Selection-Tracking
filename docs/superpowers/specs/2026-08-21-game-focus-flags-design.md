# ปรับโฟกัสระบบเกม — เพ็ท+ฟาร์มเป็นหลัก ซ่อน Expedition/มินิเกม — Design

วันที่ 21 ส.ค. 2026 · สถานะ: อนุมัติแล้ว (user 21 ส.ค.) · HEAD ตอนออกแบบ `04dba9b`

## ปัญหา

**หน้าจอรกระจาย คนเล่นไม่รู้จะทำอะไร** (user ระบุเอง 21 ส.ค.)

ฝั่งเกมโตมาเป็น ~12 ระบบ: เพ็ท · ฟาร์ม · บ้าน/idle · กาชา · หอคอย · Arena/PvP ·
Expedition · มินิเกม 3 ตัว · เควสรายวัน · แอชชีฟเมนต์ · เมล
ทุกอันมีทางเข้าของตัวเองกระจายอยู่ใน Home / Play / PetHub

**ไม่ใช่ปัญหา** balance เศรษฐกิจ · ไม่ใช่ภาระ maintenance · ไม่ใช่เรื่องแย่งเวลาอ่านหนังสือ
→ ทางแก้จึงอยู่ที่ **IA และการจัดลำดับเมนู ไม่ใช่การลบโค้ดหรือจูนตัวเลข**

## ขอบเขต

**ทำ:** ซ่อน Expedition + มินิเกม 3 ตัว ออกจากสายตานักศึกษาด้วย feature flag ที่แอดมินเปิด-ปิดได้

**ไม่ทำ (ตัดออกโดยตั้งใจ):**
- ไม่ลบโค้ด ไม่ลบเทส ไม่แตะ schema — `expedition` / `minigames` บน user doc คงไว้ครบ
- ไม่แตะตัวเลขเศรษฐกิจใดๆ
- ไม่ย้ายหอคอย/Arena (ดู §3)
- ไม่ทำหน้า Play ใหม่ — โครงเดิมรองรับอยู่แล้ว

## 1. กลไก — สวิตช์แบบเดียวกับที่มีอยู่

`config/app` มี `maintenance` และ `pvpOpen` อยู่แล้ว (`useAppConfig.js`) เพิ่มอีกสองตัว:

```js
expeditionOpen: false   // ส่งผจญภัย
arcadeOpen:     false   // มินิเกม 3 ตัว (2048 / Stacker / Capsule Rush)
```

- **ดีฟอลต์ปิด** — doc หาย/โหลดไม่ทัน = ปิด (safe default เดียวกับ `pvpOpen`)
- แอดมินกดเปิด-ปิดได้จากหน้า Admin **ทันที ไม่ต้อง deploy** (live ผ่าน `onSnapshot`)
- **แอดมินเห็นเสมอแม้ปิด** — เอาไว้เทสก่อนเปิดจริง (แพทเทิร์นเดียวกับ `pvpOpen || isAdmin` ใน `PetHubView.vue:28`)
- คะแนน/ของเก่าของนักศึกษาไม่หาย เปิดกลับมาแล้วอยู่ครบ

### ⚠️ ตัวฝึก CrCl ต้องไม่พัง

`CrClTrainerView` เก็บยอดใต้ **`minigames.crcl`** และใช้ `minigameCore.js` ร่วมกับ arcade
แต่เข้าทาง `/study/crcl` คนละเส้นกับ `/play/games/*`

→ **`arcadeOpen` คุมแค่ 3 เกมใน registry `data/minigames.js` เท่านั้น ห้ามแตะโครง `minigameCore` /
`useMinigameBoard` / ฟิลด์ `minigames.*`** · CrCl เป็นฝั่งเรียน ซึ่งเป็นคุณค่าหลักของแอป ห้ามกระทบ

## 2. จุดที่หายไปจากสายตา

| ที่ | เดิม | หลังปิด |
|---|---|---|
| `HomeView.vue:27` | `<ExpeditionCard />` | **ไม่แตะ** — ดู §2.1 |
| `nextAction.js:75` | เสนอ "ส่งเพ็ทไปผจญภัย" เป็นข้อ 6 | ข้ามข้อนี้เมื่อปิด |
| `PlayView.vue:26–37` | 2 การ์ดใหญ่ + **section มินิเกม** | เหลือ **2 การ์ดใหญ่ล้วน — เพ็ท / ฟาร์ม** |
| `PetHubView.vue:35` | เพ็ท · ร้าน · หอคอย · Arena · **Expedition** | เหลือ 4 |
| Route ตรง | เข้า `/expedition`, `/play/games/*` ได้ | **เด้งกลับ `/play`** |

**หน้า Play เหลือคำถามเดียว: "วันนี้จะเลี้ยงเพ็ท หรือทำฟาร์ม"**

Route guard สำคัญเท่าการซ่อนการ์ด — ไม่งั้นลิงก์เก่าที่นักศึกษา bookmark ไว้ยังพาเข้าได้

### 2.1 คนที่กำลังส่งเพ็ทไปอยู่ตอนปิด ต้องเก็บรางวัลได้

ปิดฟีเจอร์ตอนมีคนส่งเพ็ทไปแล้ว = รางวัลที่ส่งไปหายเปล่า (เพ็ทไม่ได้ถูกล็อกจากการต่อสู้ —
ตรวจแล้วไม่มีที่ไหนอ่าน `expedition` มากันทีม — แต่ของที่รออยู่จะเก็บไม่ได้)

**กฎ:** ปิด = **ส่งใหม่ไม่ได้ แต่เก็บของที่ส่งไปแล้วได้เสมอ**

- `ExpeditionCard` (Home) **ไม่ต้องแก้เลย** — มันมี `v-if="state !== 'idle'"` อยู่แล้ว
  จึงโผล่เฉพาะคนที่มีสายค้าง และหายเองถาวรหลังเก็บของ (เพราะทางเข้า "ส่งใหม่" ถูกซ่อนหมดแล้ว)
- **Route guard ปล่อยผ่าน** ถ้า `userData.expedition` ไม่ว่าง (เข้าไปกดเก็บได้) · ว่างเมื่อไหร่ค่อยเด้ง
- ทางเข้า "ส่งใหม่" ใน `PetHubView` ถูกซ่อน → ไม่มีใครเริ่มสายใหม่ได้

ผลลัพธ์: หน้าจอสะอาดสำหรับทุกคนที่ไม่มีสายค้าง และไม่มีใครเสียของ

## 3. หอคอย/Arena อยู่ต่อ ไม่ย้าย

ทั้งคู่อยู่ใน `PetHubView` อยู่แล้ว = ถอยจากหน้าแรกไปหนึ่งชั้นแล้ว
และเป็น**ปลายทางที่ทำให้การเลี้ยงเพ็ทมีความหมาย** — ถ้าซ่อนอีกจะเหลือคำถามว่า "เลี้ยงเพ็ทไปทำไม"

(Arena ยังคุมด้วย `pvpOpen` ของเดิม ไม่แตะ)

## 4. ตรรกะ gate แยกเป็น pure function

`useAppConfig` เป็น Firestore listener → เทสตรงยาก
ย้ายกฎการอ่าน flag ออกมาเป็น `utils/featureFlags.js`:

```js
FEATURE_KEYS = ['pvpOpen', 'expeditionOpen', 'arcadeOpen']
isFeatureOpen(configData, key, { isAdmin = false } = {}) => boolean
```

กฎ:
- `configData` เป็น `null`/`undefined` (doc หาย หรือยังโหลดไม่เสร็จ) → **ปิด**
- เปิดเมื่อค่าเป็น boolean `true` **เท่านั้น** — string `"true"`, `1`, `"yes"` ไม่นับ
  (กันแอดมินพิมพ์ค่าผิดใน console แล้วเปิดโดยไม่ตั้งใจ)
- `isAdmin === true` → เปิดเสมอ ไม่ว่า flag เป็นอะไร

`useAppConfig` เรียกใช้ฟังก์ชันนี้แล้ว expose `expeditionOpen` / `arcadeOpen` เป็น ref
รูปแบบเดียวกับ `pvpOpen` ที่มีอยู่

## 5. หน้า Admin

เพิ่มสวิตช์สองอันในการ์ดเดียวกับที่มี `pvpOpen` อยู่ — รูปแบบปุ่ม/ป้ายสถานะเหมือนกันเป๊ะ
ข้อความสถานะ: `🟢 เปิดให้เล่นแล้ว` / `🔒 ซ่อนจากนักศึกษา (แอดมินยังเข้าได้)`

## 6. โครงสร้างไฟล์

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/utils/featureFlags.js` **ใหม่** | `FEATURE_KEYS`, `isFeatureOpen` (pure) |
| `src/utils/featureFlags.test.js` **ใหม่** | `node --test` |
| `src/composables/useAppConfig.js` | เพิ่ม ref `expeditionOpen` / `arcadeOpen` ผ่าน `isFeatureOpen` |
| `src/router/index.js` | guard เด้ง `/expedition` และ `/play/games/*` กลับ `/play` เมื่อปิด |
| `src/components/home/NextActionCard.vue` | ส่ง `expeditionOpen` เข้า `ctx` |
| `src/utils/nextAction.js` | ข้ามกฎข้อ 6 เมื่อ `ctx.expeditionOpen !== true` |
| `src/views/PlayView.vue` | `v-if` รอบ section มินิเกม |
| `src/views/PetHubView.vue` | `v-if` รอบการ์ด Expedition |
| `src/views/AdminView.vue` | สวิตช์ 2 อัน |

## 7. เทส (`node --test`)

**`featureFlags.test.js`**
1. `configData` เป็น null → ทุก key ปิด
2. `{ arcadeOpen: true }` → `arcadeOpen` เปิด · `expeditionOpen` ปิด
3. `"true"` / `1` / `"yes"` → **ปิด** (ต้องเป็น boolean `true` เท่านั้น)
4. `isAdmin: true` → เปิดแม้ flag เป็น false/ไม่มี
5. key ที่ไม่รู้จัก → ปิด

**`nextAction.test.js`** (เพิ่มในไฟล์เดิม)
6. ทีมครบ ยังไม่ส่งผจญภัย + `ctx.expeditionOpen !== true` → **ไม่**คืนข้อเสนอ `expedition`
7. เงื่อนไขเดียวกันแต่ `ctx.expeditionOpen === true` → คืน `key: 'expedition'` เหมือนเดิม

## 8. ความเสี่ยง

| ความเสี่ยง | ท่าที |
|---|---|
| **CrCl พังเพราะไปแตะโครงมินิเกม** | `arcadeOpen` คุมเฉพาะ route/UI ของ 3 เกม · ห้ามแตะ `minigameCore`/`useMinigameBoard`/ฟิลด์ `minigames.*` · เช็คด้วยการเข้า `/study/crcl` ตอนปิด arcade |
| ลิงก์เก่าที่ bookmark ไว้ยังเข้าได้ | route guard เด้งกลับ `/play` |
| **ปิดตอนมีคนส่งเพ็ทไปอยู่ → ของหาย** | guard ปล่อยผ่านถ้ามี `userData.expedition` · การ์ด Home โผล่เองอยู่แล้วเมื่อ state ไม่ใช่ idle (§2.1) |
| `roster` row ยังมีฟิลด์ `m` (best มินิเกม) | ปล่อยไว้ — ไม่มีใครแสดงตอนปิด และเปิดกลับมาใช้ได้ทันที ไม่ต้อง migrate |
| แอดมินเปิดโดยไม่ตั้งใจจากค่าที่พิมพ์ผิด | `isFeatureOpen` รับ boolean `true` เท่านั้น |
| หน้า Play ว่างเกินไปหลังตัด section | เหลือ 2 การ์ดใหญ่ซึ่งเป็นสิ่งที่ตั้งใจ — ถ้าจอโล่งเกินค่อยว่ากันหลังเห็นจอจริง |
