# แฟลชการ์ดอธิบายตัวเองได้ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้คนเปิดแฟลชการ์ดรู้ว่าต้องนึกอะไรออกบ้างและกลไกใช้ยังไง โดยไม่แตะ SM-2/เด็ค/เศรษฐกิจ — พร้อมแก้บั๊กที่ทำให้ปุ่ม "เริ่มทบทวน" ข้ามคิว SRS ไปเข้าโหมดสุ่มเสมอ

**Architecture:** งานทั้งหมดอยู่ใน `src/views/StudyView.vue` (template + สเตต `mode` เดิม) บวกฟิลด์ flag 1 ตัวใน `userSchema.js` และหัวข้อช่วยเหลือใน `guide.js` · จอสอนทำเป็น **โหมดในหน้า ไม่ใช่ overlay** เพื่อเลี่ยงกับดัก Teleport (CLAUDE.md ข้อ 6) · ไม่มี pure util ใหม่ ⇒ ตรวจด้วย `npm run build` + เทสจอจริง

**Tech Stack:** Vue 3 (script setup) + Pinia + Firebase Firestore · เทสเดิม 123 ตัวต้องยังผ่าน (ไม่ควรถูกแตะ)

**Spec:** `docs/superpowers/specs/2026-07-31-flashcard-guidance-design.md`

## Global Constraints

- คอมเมนต์ในโค้ดและ commit message เป็นไทยปนอังกฤษ · รูปแบบ commit: `Area: อะไร (ทำไม)`
- โทนข้อความผู้ใช้ยึด `docs/voice-guide.md` — เป็นกันเอง บอกว่าทำอะไรได้อะไร ไม่หวือหวา ไม่ตะโกน
- single-file component + `<style scoped>` · ภาษาภาพ sticker: ขอบ `2px solid var(--ink)` + `box-shadow: var(--pop)` + `:active { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink) }` · ใช้ตัวแปรธีม `var(--primary)` / `var(--primary-light)` **ห้าม hardcode สีธีม**
- เขียน user doc ผ่าน `auth.patchUser(optimistic, server)` เท่านั้น
- ฟิลด์ใหม่ต้องประกาศใน `src/data/userSchema.js` (`USER_DEFAULTS`)
- **ห้ามแตะ `src/utils/sm2.js` · `DRUGS` · `COIN_PER_CARD` · `STUDY_DAILY_CAP` · `grade()` · `startSession()` (นอกจากจุดที่ระบุ) · `NEW_PER_SESSION` · `MATURE_DAYS`**
- **ห้ามเปลี่ยนค่า `q` ที่ปุ่มให้คะแนนส่งเข้า `grade()`** (1 / 3 / 4 / 5) — เปลี่ยนแล้วตาราง SRS เพี้ยนทั้งระบบ
- จอสอน **ห้ามทำเป็น `position:fixed` overlay** — `StudyView` อยู่ใต้ `<RouterView>` จะติดกับดักข้อ 6 (ต้อง Teleport) · ทำเป็นค่าใน `mode` แทน
- ไม่แตะ `firestore.rules` (ฝั่ง `users/{userId}` ไม่มี `hasOnly` ⇒ เพิ่มฟิลด์ได้เลย)

---

## File Structure

| ไฟล์ | ความรับผิดชอบ |
|------|----------------|
| `src/views/StudyView.vue` | แก้บั๊กปุ่มเริ่ม · บรรทัด "ลองนึกให้ได้" · ป้ายเฉลย · ปุ่มให้คะแนน + โน้ต · โหมด `coach` · ลิงก์ดูวิธีใช้ซ้ำ |
| `src/data/userSchema.js` | `seenStudyCoach: false` |
| `src/data/guide.js` | เขียนหัวข้อ `study` ใหม่ |

---

## Task 1: แก้บั๊กปุ่มเริ่มทบทวน + ทำให้การ์ดบอกว่าต้องนึกอะไร

**Files:**
- Modify: `src/views/StudyView.vue`

**Interfaces:**
- Consumes: `startSession(free = false)`, `flipped`, `current`, `preview(q)`, `grade(q)` (ของเดิมทั้งหมด)
- Produces: — (งานนี้เป็น template + style ล้วน)

- [ ] **Step 1: แก้บั๊ก A — ปุ่มหลักส่ง event เข้าไปเป็น `free`**

ที่ `src/views/StudyView.vue` บรรทัด ~39 เปลี่ยน

```html
      <button class="sv-start" :disabled="!queueSize" @click="startSession">
```

เป็น

```html
      <button class="sv-start" :disabled="!queueSize" @click="startSession()">
```

**ทำไม:** Vue ส่ง native event เป็นอาร์กิวเมนต์แรกเมื่อผูก method โดยไม่ใส่วงเล็บ ⇒ `free` = `PointerEvent` ซึ่ง truthy ⇒ ปุ่มหลักเข้าสาขาสุ่ม 20 ใบทั้งเด็คมาตลอด ไม่เคยใช้คิว SRS เลย · ปุ่มฝึกอิสระ (`startSession(true)`) ถูกอยู่แล้ว ห้ามแตะ

- [ ] **Step 2: แก้บั๊ก B — ข้อความปุ่มฝึกอิสระที่ไม่ตรงพฤติกรรม**

บรรทัด ~43 เปลี่ยนข้อความ `ฝึกอิสระ (ไม่บันทึกความคืบหน้า)` เป็น `ฝึกอิสระ (สุ่มทั้งเด็ค · นับความคืบหน้าตามปกติ)`

```html
      <button v-if="!queueSize" class="sv-freebtn" @click="startSession(true)">ฝึกอิสระ (สุ่มทั้งเด็ค · นับความคืบหน้าตามปกติ) <Emoji char="🎲" /></button>
```

**ทำไม:** `grade()` ไม่เคยเช็ก `free` ⇒ ฝึกอิสระบันทึก SRS + เลื่อนตาราง + ให้เหรียญตามปกติ · รอบนี้แก้ข้อความให้ตรงความจริงเท่านั้น **ห้ามแก้ `grade()` ให้ข้ามการบันทึก** (เปลี่ยนกลไก + ตัดทางได้เหรียญ — user ต้องเป็นคนตัดสิน)

- [ ] **Step 3: ป้ายบนการ์ดให้ตรงกับของจริง**

บรรทัด ~76 เปลี่ยน

```html
        <div class="sv-card-tag">{{ flipped ? 'กลุ่ม / กลไก' : 'ตัวยา' }}</div>
```

เป็น

```html
        <div class="sv-card-tag">{{ flipped ? 'เฉลย' : 'ตัวยา' }}</div>
```

(ด้านหลังมี 3 ก้อน — กลุ่มยา ข้อบ่งใช้ ขนาด — ไม่ใช่แค่กลุ่ม/กลไก)

- [ ] **Step 4: บรรทัด "ลองนึกให้ได้" บนหน้าการ์ดก่อนพลิก**

แทนบรรทัด ~87 (`<div v-else class="sv-card-hint">แตะเพื่อดูเฉลย</div>`) ด้วยบล็อกนี้ — เก็บ hint เดิมไว้ด้านล่างสุด:

```html
        <div v-else class="sv-recall">
          <div class="sv-recall-lead">ลองนึกให้ได้ก่อนเปิด</div>
          <div class="sv-recall-items">กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่</div>
          <div class="sv-card-hint">แตะเพื่อดูเฉลย</div>
        </div>
```

รายการ 3 อย่างเป็นข้อความคงที่ เพราะทุกการ์ดในเด็คมีสามฟิลด์นี้เท่ากันหมด (ไม่ต้อง derive จากข้อมูล)

เพิ่มสไตล์ใน `<style scoped>` ถัดจากกฎ `.sv-card-hint` เดิม:

```css
.sv-recall { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.sv-recall-lead { font-size: .68rem; color: rgba(0,0,0,.45); }
.sv-recall-items { font-size: .8rem; font-weight: 800; color: var(--primary); line-height: 1.4; }
```

- [ ] **Step 5: อธิบายปุ่มให้คะแนน**

แทนบล็อกปุ่ม (บรรทัด ~90–95) ด้วย — **ค่า `q` ใน `grade()` ต้องเท่าเดิมเป๊ะ**:

```html
      <div v-if="flipped" class="sv-grade-wrap">
        <div class="sv-grade-note">ตอบตามจริง — ปุ่มที่เลือกกำหนดว่าการ์ดนี้จะกลับมาเมื่อไหร่</div>
        <div class="sv-grades">
          <button class="sv-grade again" @click="grade(1)"><b>ลืม</b><i>นึกไม่ออก</i><small>&lt; 1 วัน</small></button>
          <button class="sv-grade hard"  @click="grade(3)"><b>ยาก</b><i>ต้องคิดนาน</i><small>{{ preview(3) }}</small></button>
          <button class="sv-grade good"  @click="grade(4)"><b>จำได้</b><i>นึกออกปกติ</i><small>{{ preview(4) }}</small></button>
          <button class="sv-grade easy"  @click="grade(5)"><b>ง่าย</b><i>ตอบได้ทันที</i><small>{{ preview(5) }}</small></button>
        </div>
      </div>
```

เพิ่มสไตล์ (วางถัดจากกฎ `.sv-grade` เดิม · `<i>` ต้องไม่เอียงและต้องเล็กพอไม่ให้ตัดคำบนจอ 360px):

```css
.sv-grade-note { font-size: .68rem; color: rgba(0,0,0,.5); text-align: center; margin-bottom: 7px; line-height: 1.4; }
/* ปุ่มพื้นสีจัด + .sv-grade ตั้ง color:#fff อยู่แล้ว ⇒ ลดน้ำหนักด้วย opacity เหมือน .sv-grade small
   ห้ามใส่ color เทาเข้ม จะอ่านไม่ออกบนพื้นแดง/เขียว/น้ำเงิน */
.sv-grade i { font-style: normal; font-size: .58rem; opacity: .85; line-height: 1.25; }
```

> ถ้ากฎเดิมจัดวางลูกของ `.sv-grades` ด้วย flex column อยู่แล้ว บรรทัดที่สามจะไหลตามเอง — อ่านกฎ `.sv-grade` เดิมก่อนแล้วเพิ่มเฉพาะที่ขาด อย่ารื้อของเดิม

- [ ] **Step 6: ข้อความรอพลิกให้ตรงกับความจริง**

บรรทัด ~96 `<div v-else class="sv-flip-spacer">เลือกระดับความจำหลังเปิดเฉลย</div>` — เปลี่ยนข้อความเป็น `เปิดเฉลยก่อน แล้วค่อยเลือกว่านึกได้แค่ไหน`

- [ ] **Step 7: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

Run: `grep -n "@click=\"startSession\"" src/views/StudyView.vue`
Expected: ไม่มีผลลัพธ์ (ต้องเหลือแต่ `startSession()` และ `startSession(true)`)

Run: `grep -n "grade(1)\|grade(3)\|grade(4)\|grade(5)" src/views/StudyView.vue`
Expected: เจอครบ 4 บรรทัด ค่าเดิมทั้งหมด

- [ ] **Step 8: Commit**

```bash
git add src/views/StudyView.vue
git commit -m "Study: แก้ปุ่มเริ่มทบทวนที่เข้าโหมดสุ่มเสมอ + บอกว่าต้องนึกอะไร (SRS ไม่เคยถูกใช้จริง)"
```

---

## Task 2: จอสอนวิธีใช้ 3 ขั้น (โหมดในหน้า)

**Files:**
- Modify: `src/views/StudyView.vue`, `src/data/userSchema.js`

**Interfaces:**
- Consumes: `mode` ref เดิม (`'home' | 'review' | 'done'`) · `startSession()` · `authStore.patchUser`
- Produces: ฟิลด์ `seenStudyCoach: boolean` บน `users/{uid}` · ค่าใหม่ `'coach'` ของ `mode`

- [ ] **Step 1: ประกาศ flag ใน schema กลาง**

ใน `src/data/userSchema.js` เพิ่มใน `USER_DEFAULTS` ถัดจาก `seenIntro`:

```js
  seenStudyCoach: false,                      // one-time: เคยดูวิธีใช้แฟลชการ์ดแล้ว
```

- [ ] **Step 2: สเตตของจอสอน**

ใน `<script setup>` ของ `StudyView.vue` เพิ่มถัดจาก `const mode = ref('home')` (แก้คอมเมนต์ท้ายบรรทัดให้มี `coach` ด้วย):

```js
const coachStep = ref(1)          // 1..3
const coachThenStart = ref(false) // จบจอสอนแล้วเข้าเซสชันต่อไหม (ครั้งแรกเท่านั้น · เปิดดูซ้ำ = กลับหน้าหลัก)

// เข้าเซสชันปกติ — คนที่ยังไม่เคยเห็นวิธีใช้ ให้ดูจอสอนก่อนแล้วค่อยเข้าเซสชันต่อ
function beginReview() {
  if (!authStore.userData?.seenStudyCoach) {
    coachStep.value = 1
    coachThenStart.value = true
    mode.value = 'coach'
    return
  }
  startSession()
}

// เปิดดูวิธีใช้ซ้ำจากหน้าหลัก — จบแล้วกลับหน้าหลัก ไม่เข้าเซสชัน
function openCoach() {
  coachStep.value = 1
  coachThenStart.value = false
  mode.value = 'coach'
}

// จบ/ข้ามจอสอน — ประทับ flag ครั้งเดียว แล้วไปต่อตามเส้นทางที่มา
async function finishCoach() {
  const wasFirstRun = coachThenStart.value
  if (wasFirstRun) startSession()
  else mode.value = 'home'
  if (!authStore.userData?.seenStudyCoach) {
    await authStore.patchUser({ seenStudyCoach: true }, { seenStudyCoach: true })
  }
}
```

> `startSession()` ตั้ง `mode = 'review'` ให้เองอยู่แล้ว จึงไม่ต้องเซ็ตซ้ำ · เรียก `startSession()` **ก่อน** `await` เพื่อไม่ให้ผู้ใช้ค้างมองจอสอนระหว่างรอเขียน Firestore (เน็ตมหาลัยช้า — โปรเจกต์นี้บังคับ long-polling)

- [ ] **Step 3: ปุ่มเริ่มทบทวนเรียกเส้นทางใหม่ + ลิงก์ดูซ้ำ**

บรรทัดปุ่มเริ่ม (ที่ Task 1 แก้เป็น `startSession()`) เปลี่ยนเป็น `beginReview()`:

```html
      <button class="sv-start" :disabled="!queueSize" @click="beginReview()">
```

เพิ่มลิงก์ใต้บรรทัด `.sv-caphint` (ยังอยู่ในบล็อก `mode === 'home'`):

```html
      <button class="sv-howto" @click="openCoach()"><Emoji char="💡" /> ดูวิธีใช้แฟลชการ์ดอีกครั้ง</button>
```

```css
.sv-howto { display: block; margin: 10px auto 0; background: none; border: none; font-family: inherit; font-size: .74rem; color: var(--primary); text-decoration: underline; cursor: pointer; padding: 6px; }
```

- [ ] **Step 4: เทมเพลตจอสอน**

เพิ่มบล็อกนี้ **ก่อน** บล็อก `<!-- ── REVIEW ── -->` (เป็นสาขาหนึ่งของ `mode` — ต้องเป็น `v-else-if` ที่ต่อจากสาขา home และห้ามมีอะไรคั่นระหว่างสาขา ไม่งั้น chain พัง):

```html
    <!-- ── COACH: วิธีใช้แฟลชการ์ด (โหมดในหน้า ไม่ใช่ overlay — StudyView อยู่ใต้ RouterView ดู CLAUDE.md ข้อ 6) ── -->
    <template v-else-if="mode === 'coach'">
      <div class="sv-coach">
        <div class="sv-coach-dots">
          <span v-for="n in 3" :key="n" class="sv-coach-dot" :class="{ on: n === coachStep }"></span>
        </div>

        <template v-if="coachStep === 1">
          <div class="sv-coach-ico"><Emoji char="🤔" /></div>
          <div class="sv-coach-title">พยายามนึกก่อน</div>
          <p class="sv-coach-body">เห็นชื่อยาแล้วอย่าเพิ่งเปิดเฉลย — ลองนึกให้ได้ก่อน การพยายามนึกคือสิ่งที่ทำให้จำได้จริง ไม่ใช่การอ่านซ้ำ</p>
        </template>

        <template v-else-if="coachStep === 2">
          <div class="sv-coach-ico"><Emoji char="🔍" /></div>
          <div class="sv-coach-title">เปิดแล้วเทียบ</div>
          <p class="sv-coach-body">พลิกการ์ดแล้วดูว่านึกได้ครบไหม — กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่</p>
        </template>

        <template v-else>
          <div class="sv-coach-ico"><Emoji char="🎯" /></div>
          <div class="sv-coach-title">ตอบตามจริง</div>
          <p class="sv-coach-body">ปุ่มที่กดเป็นตัวกำหนดว่าการ์ดใบนี้จะกลับมาให้ทบทวนเมื่อไหร่ · ตอบเกินจริงตอนนี้ = ไปลืมเอาตอนสอบ</p>
        </template>

        <button class="sv-start" @click="coachStep < 3 ? coachStep++ : finishCoach()">
          {{ coachStep < 3 ? 'ต่อไป →' : (coachThenStart ? 'เริ่มทบทวนเลย' : 'เข้าใจแล้ว') }}
        </button>
        <button class="sv-coach-skip" @click="finishCoach()">ข้ามไปก่อน</button>
      </div>
    </template>
```

เพิ่มสไตล์:

```css
.sv-coach { background: #fff; border: 2px solid var(--ink); border-radius: 18px; box-shadow: var(--pop); padding: 22px 18px; text-align: center; margin-top: 10px; }
.sv-coach-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
.sv-coach-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.15); }
.sv-coach-dot.on { background: var(--primary); }
.sv-coach-ico { font-size: 2.4rem; margin-bottom: 6px; }
.sv-coach-title { font-family: var(--font-display); font-weight: 400; font-size: 1.25rem; color: var(--ink); margin-bottom: 8px; }
.sv-coach-body { font-size: .84rem; color: rgba(0,0,0,.65); line-height: 1.6; margin: 0 0 16px; }
.sv-coach-skip { background: none; border: none; color: var(--muted); font-size: .76rem; margin-top: 10px; padding: 8px; cursor: pointer; font-family: inherit; }
```

- [ ] **Step 5: ตรวจงาน**

Run: `npm run build`
Expected: build ผ่าน

Run: `grep -n "mode === 'coach'\|beginReview\|openCoach\|finishCoach\|seenStudyCoach" src/views/StudyView.vue src/data/userSchema.js`
Expected: เจอครบทุกตัว — `seenStudyCoach` ต้องอยู่ทั้งใน `userSchema.js` และใน `StudyView.vue`

Run: `grep -n "position: fixed" src/views/StudyView.vue`
Expected: เจอเฉพาะกฎของโมดัลแจ้งข้อมูลผิด (`.sv-rep-ov`) ที่ห่อ `<Teleport>` อยู่แล้ว — **จอสอนต้องไม่มี `position:fixed`**

- [ ] **Step 6: Commit**

```bash
git add src/views/StudyView.vue src/data/userSchema.js
git commit -m "Study: จอสอนวิธีใช้แฟลชการ์ดครั้งแรก + ลิงก์ดูซ้ำ (คนไม่เคยใช้ SRS ไม่รู้ว่าปุ่มแปลว่าอะไร)"
```

---

## Task 3: เขียนหัวข้อช่วยเหลือ `study` ใหม่

**Files:**
- Modify: `src/data/guide.js`

**Interfaces:**
- Consumes: รูปแบบ entry `{ icon, title, body[] }` (ดูหัวไฟล์)
- Produces: —

- [ ] **Step 1: แทนที่ `body` ของหัวข้อ `study`**

หัวข้อเดิมอธิบายภาพรวมแต่ไม่ได้สอนวิธีใช้การ์ด · แทน `body` ด้วย 4 บรรทัดนี้ (คง `icon` และ `title` เดิม):

```js
    body: [
      'ทบทวนกลุ่มยาแบบเว้นช่วง — ระบบนัดวันให้เองว่าใบไหนควรกลับมาทบทวนเมื่อไหร่ ทบทวนได้เหรียญด้วย',
      'วิธีใช้: เห็นชื่อยาแล้วลองนึกให้ได้ก่อน (กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่) แล้วค่อยแตะเปิดเฉลยมาเทียบ',
      'จากนั้นกดตามที่นึกได้จริง — ลืม (นึกไม่ออก) · ยาก (ต้องคิดนาน) · จำได้ (นึกออกปกติ) · ง่าย (ตอบได้ทันที)',
      'ตอบตามจริงสำคัญมาก เพราะปุ่มที่กดกำหนดว่าใบนั้นจะกลับมาเมื่อไหร่ — ตอบเกินจริงตอนนี้จะไปลืมเอาตอนสอบ',
    ],
```

> ⚠️ `HelpModal` เรนเดอร์ `body` ด้วย `{{ line }}` = **plain text ไม่ตีความ markdown** ⇒ ห้ามใส่ `**ตัวหนา**` หรือ markup ใดๆ ในข้อความ (จะโผล่ดาวจริงบนจอ) · ข้อความข้างบนเขียนถูกแล้ว ลอกไปตรงๆ ได้

- [ ] **Step 2: ตรวจงาน**

Run: `grep -c "title:" src/data/guide.js`
Expected: `14` (จำนวนหัวข้อเท่าเดิม — งานนี้แก้เนื้อหา ไม่เพิ่ม/ลบหัวข้อ)

Run: `grep -n '\*\*' src/data/guide.js`
Expected: ไม่มีผลลัพธ์ (ไม่มี markdown หลงเหลือ)

Run: `npm run build`
Expected: build ผ่าน

- [ ] **Step 3: Commit**

```bash
git add src/data/guide.js
git commit -m "Help: หัวข้อทบทวนสอนวิธีใช้การ์ดจริง (นึกก่อน → เปิดเทียบ → ตอบตามจริง)"
```

---

## หลังทำครบทุก Task

- [ ] **รันเทสเดิมทั้งหมด (ต้องไม่ถูกกระทบ)**

Run: `node --test src/utils/nextAction.test.js src/utils/questionReview.test.js src/utils/questionCategories.test.js src/utils/questionsFilter.test.js src/utils/questionsMeta.test.js src/utils/importQuestions.test.js src/utils/questionReport.test.js`
Expected: PASS ทั้งหมด (123 ตัว) — งานนี้ไม่ควรแตะ util ใดๆ

- [ ] **Build**

Run: `npm run build`
Expected: build ผ่าน ไม่มี error

- [ ] **Deploy**

```bash
git push origin master     # GitHub Pages — งานนี้ไม่แก้ rules จึงไม่ต้อง firebase deploy
```

- [ ] **สิ่งที่ user ต้องเทสบนจอจริง**

1. **บั๊กหลัก:** ปุ่ม "เริ่มทบทวน N ใบ" ต้องให้การ์ด **N ใบตามที่เขียนบนปุ่ม** (แถบ `x/y` ตอนทบทวนต้องตรงกับปุ่ม) ไม่ใช่ 20 ใบสุ่ม
2. บัญชีที่ยังไม่เคยเห็นจอสอน → กดเริ่มทบทวน → เจอจอสอน 3 ขั้น → จบแล้วเข้าเซสชันทันที · กด "ข้ามไปก่อน" ก็เข้าเซสชันเหมือนกัน
3. กดเริ่มทบทวนรอบสอง → ไม่เจอจอสอนอีก
4. ลิงก์ "ดูวิธีใช้แฟลชการ์ดอีกครั้ง" → เห็นจอสอน → จบแล้ว **กลับหน้าหลัก** ไม่ใช่เข้าเซสชัน
5. หน้าการ์ดก่อนพลิกเห็น "ลองนึกให้ได้ก่อนเปิด / กลุ่มยา · ข้อบ่งใช้ · ขนาดผู้ใหญ่" · พลิกแล้วป้ายเขียน "เฉลย"
6. ปุ่ม 4 ปุ่มมี 3 บรรทัด อ่านออกครบ **ไม่ตัดคำบนจอแคบ** (จุดเสี่ยงที่สุดของงานนี้)
7. ช่วงเวลาทบทวนหลังกดปุ่มยังเหมือนเดิมทุกประการ

---

## Self-Review (ผู้เขียนแผนตรวจเองแล้ว)

**ความครอบคลุมเทียบสเปก:** บั๊ก A → Task 1 Step 1 · บั๊ก B → Task 1 Step 2 · §1 หน้าการ์ด → Task 1 Step 3–4 ·
§2 ปุ่มให้คะแนน → Task 1 Step 5–6 · §3 จอสอน + flag + ลิงก์ดูซ้ำ → Task 2 · §4 หัวข้อ ℹ️ → Task 3 ·
การตัดสินใจของ controller ทั้ง 4 ข้อ → สะท้อนใน Task 1 Step 4 (โชว์เสมอ), Task 1 Step 5 (คง 4 ปุ่ม),
Task 2 Step 3 (ลิงก์ดูซ้ำ), Task 1 Step 4 (คำว่า "ขนาดผู้ใหญ่")

**Placeholder scan:** ไม่มี TBD/TODO · ทุกขั้นมีโค้ดจริงหรือคำสั่งจริง

**Type/ชื่อสอดคล้อง:** `beginReview` / `openCoach` / `finishCoach` / `coachStep` / `coachThenStart` /
`seenStudyCoach` สะกดตรงกันทุกจุดที่อ้างถึงข้าม Task · `mode` ใช้ค่า `'coach'` ตัวเดียวกันทั้งเทมเพลตและสคริปต์

**จุดที่จับได้ตอนตรวจเอง:** ร่างแรกของ Task 3 ใส่ `**ตัวหนา**` ในข้อความ guide ทั้งที่ `HelpModal` เรนเดอร์
`{{ line }}` เป็น plain text ⇒ ดาวจะโผล่บนจอ · **แก้ในโค้ดบล็อกให้ถูกตั้งแต่แรกแล้ว** (ไม่ทิ้งไว้ให้คนทำมาแก้เอง)
พร้อมคำเตือนห้ามใส่ markup กำกับ

**หมายเหตุลำดับ:** Task 1 Step 1 แก้ปุ่มเริ่มเป็น `startSession()` แล้ว Task 2 Step 3 เปลี่ยนบรรทัดเดิมนั้นอีกที
เป็น `beginReview()` — ตั้งใจ เพราะ Task 1 ต้องปิดบั๊กให้จบในตัวเองก่อน (ถ้า Task 2 ไม่ได้ทำต่อ ปุ่มก็ยังถูก)
