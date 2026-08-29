# กติกาสร้างไฟล์ JSON ข้อสอบ — RxTU10

ส่งหน้านี้ให้คนที่ช่วยแปลงข้อสอบเก่าเป็นไฟล์ JSON (จะให้คนอ่านเองหรือวางเป็น prompt ให้ AI ก็ได้)
ไฟล์ที่ทำตามนี้จะนำเข้าระบบได้เลยโดยไม่ต้องมาแก้ทีหลัง

> อัปเดตล่าสุด 29 ส.ค. 2026 · ตารางกลุ่มโรคสร้างจาก `src/data/plecc.js` โดยตรง

---

## วางอันนี้เป็น prompt ได้เลย

```text
คุณคือผู้ช่วยแปลงข้อสอบเภสัชศาสตร์เป็นไฟล์ JSON สำหรับนำเข้าเว็บ RxTU10

ตอบกลับเป็น JSON array อย่างเดียวเท่านั้น ห้ามมีคำอธิบายนำ ห้ามครอบด้วย code fence

รูปแบบต่อ 1 ข้อ:
{
  "question": "โจทย์",
  "choices": ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4", "ตัวเลือก 5"],
  "answer": 0,
  "pleGroup": "endo",
  "pleSub": "Diabetes mellitus",
  "explanation": "เหตุผลว่าทำไมข้อนี้ถูก",
  "examSets": ["ชื่อชุดข้อสอบ"]
}

กฎเหล็ก:
1. "answer" คือ **ลำดับที่ของตัวเลือกที่ถูก โดยเริ่มนับจาก 0**
   ตัวเลือกแรก = 0, ตัวที่สอง = 1, ตัวที่สาม = 2 …
   ห้ามใส่เป็น "ก" "ข" "A" "B" หรือข้อความคำตอบ
2. "pleGroup" ต้องเป็นรหัสจากตารางกลุ่มโรคที่ให้ไว้ **เท่านั้น** ห้ามคิดรหัสใหม่
3. "pleSub" ต้องเป็นโรคย่อยที่อยู่ใต้ pleGroup นั้น **สะกดตรงเป๊ะทุกตัวอักษร**
   ถ้าไม่ชัดว่าเป็นโรคย่อยไหน ให้ตัดฟิลด์ "pleSub" ออกไปเลย ดีกว่าเดา
4. "explanation" กับ "examSets" ไม่บังคับ ตัดออกได้
5. ห้ามใส่ฟิลด์อื่นนอกจากที่ระบุไว้ โดยเฉพาะ id, categories, domain,
   isPublished, createdAt, qhash — ระบบเติมให้เอง ใส่มาจะถูกทิ้ง
6. ห้ามใส่ HTML หรือ markdown ในข้อความ (ไม่มี <b>, **ตัวหนา**, ตาราง)
7. ความยาว: โจทย์ไม่เกิน 500 ตัวอักษร · ตัวเลือกละไม่เกิน 200 · คำอธิบายไม่เกิน 1000
   (เกินจะถูกตัดท้ายทิ้งเงียบๆ)
8. ตัวเลือกต้องมีอย่างน้อย 2 ตัว (ข้อสอบสภาฯ ใช้ 5 ตัว) ห้ามมีตัวเลือกซ้ำกัน
   และห้ามมีตัวเลือกที่เป็นข้อความว่าง
9. ข้อที่ต้องดูรูปภาพ กราฟ หรือตารางถึงจะตอบได้ **ให้ข้ามไป** ระบบยังไม่รองรับรูป
10. ถ้าไม่มั่นใจเฉลย ให้ใส่มาตามที่คิดว่าถูกที่สุด แล้วเขียนกำกับใน explanation ว่า
    "ยังไม่มั่นใจ" — มีทีมวิชาการตรวจทุกข้ออยู่แล้ว ไม่ต้องกลัวผิด

ตัวอย่างที่ถูกต้อง:
[
  {
    "question": "ผู้ป่วยเบาหวานชนิดที่ 2 รายใหม่ ไม่มีข้อห้าม ยาใดเป็นทางเลือกแรก",
    "choices": ["Metformin", "Glibenclamide", "Insulin glargine", "Pioglitazone", "Sitagliptin"],
    "answer": 0,
    "pleGroup": "endo",
    "pleSub": "Diabetes mellitus",
    "explanation": "Metformin เป็น first-line ตามแนวทางเมื่อไม่มีข้อห้ามใช้"
  }
]

ตารางกลุ่มโรค (ใช้ได้เฉพาะรหัสในนี้):
<<< วางตารางจากหัวข้อถัดไปตรงนี้ >>>
```

---

## ตารางกลุ่มโรค — ใช้ได้เฉพาะรหัสในนี้

รหัสในเครื่องหมาย `` ` `` คือค่าที่ต้องใส่ใน `pleGroup` · รายการใต้แต่ละกลุ่มคือค่าที่ใส่ใน `pleSub` ได้

### ด้านผู้ป่วย (Care) — 15 กลุ่มตามภาคผนวก ๑ ของประกาศสภาฯ

**`msk`** — Musculoskeleton (Rheumatology) (กระดูกและข้อ)
- `Osteoarthritis`
- `Osteoporosis`
- `Rheumatoid arthritis`
- `Gout`

**`cvs`** — Cardiovascular (หัวใจและหลอดเลือด)
- `Hypertension`
- `Stable Heart Failure`
- `Coronary artery disease`
- `Dyslipidemias`
- `Venous thromboembolism`

**`derm`** — Dermatologic (ผิวหนัง)
- `Urticaria angioedema`
- `Superficial fungal infections`
- `Acne`
- `Eczema`
- `Herpes`
- `Wound`
- `Seborrheic dermatitis`
- `Psoriasis`

**`endo`** — Endocrine (ต่อมไร้ท่อ)
- `Diabetes mellitus`
- `Hypothyroidism, hyperthyroidism`
- `Obesity`

**`gi`** — Gastrointestinal (ทางเดินอาหาร)
- `Gastroesophageal reflux disease`
- `Nausea and vomiting`
- `Dyspepsia, Peptic ulcer disease`
- `Diarrhea and constipation, hemorrhoid`
- `Stress ulcer disease`
- `Hepatitis B virus`
- `Inflammatory bowel disease`

**`heme`** — Hematologic (โลหิตวิทยา)
- `Anemia`
- `Hemolytic anemia (G6PD deficiency, thalassemia)`

**`immu`** — Immunologic (การแพ้และภูมิคุ้มกันวิทยา)
- `Allergic rhinitis`
- `Hypersensitivity reactions`
- `Systemic lupus erythematosus`
- `การให้วัคซีนสร้างเสริมภูมิคุ้มกันโรคเบื้องต้น (EPI Thailand)`

**`id`** — Infectious diseases (โรคติดเชื้อ)
- `HIV infection without opportunistic infections`
- `Parasitic infections (หิด เหา พยาธิ)`
- `Sexually transmitted diseases & vaginitis`
- `Tuberculosis`
- `Upper respiratory tract infections`
- `Cystitis (lower urinary tract infection)`
- `Pneumonia`

**`neuro`** — Neurologic (ระบบประสาท)
- `Headache (migraine, tension)`
- `Epilepsy, status epilepticus`
- `Pain management`
- `Stroke`
- `Peripheral neuropathy`
- `Parkinson disease`
- `Dementia, Alzheimer disease`

**`psych`** — Psychiatric (จิตเวช)
- `Drug and alcohol abuse`
- `Tobacco dependence and cessation`
- `Anxiety/depression`
- `Insomnia`

**`pulm`** — Pulmonary (ปอด)
- `Asthma`
- `Chronic obstructive pulmonary disease`

**`gu`** — Gynaecologic/Genitourinary (ปัสสาวะและสืบพันธุ์)
- `Dysmenorrhea`
- `Oral contraceptive`
- `Hormonal replacement therapy`
- `Urinary incontinence`

**`eye`** — Eye disorder (ตา)
- `Conjunctivitis`
- `Hordeolum (กุ้งยิง)`
- `Contact Lens`
- `ริดสีดวงตา ต้อหิน ต้อกระจก แผลที่ตา`

**`onco`** — Oncologic (มะเร็งวิทยา)
- `Lung cancer`
- `Breast cancer`
- `Cervical cancer`
- `Colon cancer`

**`renal`** — Renal (ไต)
- `Acute kidney injury (AKI)`
- `Chronic kidney diseases (CKD)`
- `Fluid and electrolyte disorder`

### ด้านผลิตภัณฑ์ (Sci) — กลุ่มที่ทีมเราตั้งเอง

**`sci_analysis`** — เภสัชวิเคราะห์และการควบคุมคุณภาพ
- `การควบคุมคุณภาพ (QC)`
- `Titration`
- `Impurity`
- `Uniformity of dosage unit`

**`sci_tech`** — เทคโนโลยีเภสัชกรรมและรูปแบบยาเตรียม
- `รูปแบบยาเตรียมและเภสัชตำรับ`
- `ระบบนำส่งยา`
- `GMP และการเก็บบันทึก`
- `เภสัชกรรมอุตสาหการ`

**`sci_chem`** — เภสัชเคมี
- `กรด-เบสและการแตกตัวของยา`
- `โครงสร้างยากับการออกฤทธิ์`

**`sci_pharm`** — เภสัชวิทยาและเภสัชจลนศาสตร์
- `เภสัชจลนศาสตร์`
- `เภสัชพลศาสตร์`
- `อันตรกิริยาระหว่างยา`
- `Pharmacogenetics`

**`sci_herb`** — เภสัชเวทและสมุนไพร
- `สมุนไพรและผลิตภัณฑ์ธรรมชาติ`

**`sci_social`** — เภสัชกรรมสังคมและระบาดวิทยา
- `Pharmacovigilance`
- `ระบาดวิทยา (Epidemiology)`
- `เศรษฐศาสตร์และการบริหารเภสัชกิจ`

### ด้านกฎหมาย (Law)

**`other`** — ระบบอื่น
- `กฎหมาย (Law)`

---

## สิ่งที่ระบบจัดการให้เอง — ไม่ต้องใส่มา

| ฟิลด์ | ระบบทำอะไร |
|---|---|
| `isPublished` | บังคับเป็น "ร่าง" เสมอ ทุกข้อที่นำเข้าต้องผ่านทีมวิชาการก่อนถึงเผยแพร่ |
| `categories` | สร้างจาก `pleGroup` + `pleSub` ให้เอง ใส่มาเองจะถูกทับ |
| `domain` | เดาจาก `pleGroup` ให้ (กลุ่ม Care → `care` · ระบบอื่น → `law` · `sci_*` → `sci`) |
| `qhash` `rand` `createdAt` `createdBy` | ระบบเติมตอนนำเข้า |
| สถานะตรวจ | ตั้งเป็น "รอตรวจ" ให้ทุกข้อ |

## ข้อควรรู้เพิ่ม

**ข้อซ้ำ** — ระบบเทียบโจทย์อัตโนมัติ ถ้าซ้ำกับข้อที่มีอยู่แล้วจะไม่เพิ่มซ้ำ แต่จะเอาชื่อชุดข้อสอบไปติดให้ข้อเดิมแทน ส่งไฟล์ที่มีข้อซ้ำมาได้ ไม่เสียหาย

**ชื่อชุดข้อสอบ (`examSets`)** — ต้องตรงกับชื่อชุดที่มีอยู่ในระบบแล้วเท่านั้น ชื่อที่ไม่รู้จักจะถูกตัดทิ้งเงียบๆ ถ้าจะตั้งชุดใหม่ ให้บอกคนดูแลเว็บเพิ่มชื่อชุดให้ก่อน หรือปล่อยว่างไว้แล้วค่อยติดป้ายทีหลังตอนนำเข้า (มีช่อง "ตั้งชุดให้ทุกข้อในไฟล์")

**กลุ่มโรคผิดหรือไม่ได้ใส่** — ข้อนั้นยังนำเข้าได้ปกติ ไม่หาย แต่จะไปกองอยู่ใน "ข้อที่รอดำเนินการ → ไม่มีกลุ่มโรค" ให้ทีมวิชาการมาเลือกกลุ่มให้ทีหลัง · หน้านำเข้าจะขึ้นเตือนบอกด้วยว่าข้อไหนมีปัญหา

**เช็กก่อนส่ง** — วาง JSON ลงช่องนำเข้าในหน้าคลังข้อสอบ ระบบจะบอกทันทีว่า "พร้อมนำเข้ากี่ข้อ · ข้ามกี่ข้อ" โดยยังไม่เขียนอะไรลงฐานข้อมูลจนกว่าจะกดปุ่มยืนยัน ลองวางดูได้ไม่เสียหาย

## สาเหตุที่ข้อถูกข้ามบ่อยที่สุด

1. `choices` มีตัวเลือกไม่ว่างน้อยกว่า 2 ตัว
2. `question` ว่างหรือมีแต่ช่องว่าง
3. `choices` ไม่ได้เป็น array (ส่งมาเป็นข้อความก้อนเดียว)
4. ไฟล์ทั้งก้อนไม่ใช่ JSON array — ต้องขึ้นต้นด้วย `[` และปิดด้วย `]`

> `answer` ที่เกินจำนวนตัวเลือกจะไม่ทำให้ข้อถูกข้าม แต่จะถูกรีเซ็ตเป็น 0 เงียบๆ
> ซึ่งแปลว่า **เฉลยผิด** — เป็นเหตุผลที่ต้องย้ำกฎข้อ 1 เรื่องการนับเริ่มจาก 0
