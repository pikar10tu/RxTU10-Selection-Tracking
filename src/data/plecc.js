// ════════════════════════════════════════════════════════════
//  กลุ่มโรค/หมวดข้อสอบตามเกณฑ์สภาเภสัชกรรม (PLE-CC๑) — แหล่งความจริงเดียว
//  แพทเทิร์นเดียวกับ data/domains.js · ใช้ใน: questions.pleGroup/pleSub,
//  picker หน้าเพิ่มข้อ/ตรวจข้อ, ปุ่มแมพหมวดของแอดมิน
//
//  ที่มา: ประกาศศูนย์สอบความรู้ผู้ขอขึ้นทะเบียนฯ ที่ ๕/๒๕๖๖ ภาคผนวก ๑
//         "กลุ่มโรคและโรคย่อยและยา ของการจัดสอบ PLE-CC๑" (๑๔ ก.ย. ๒๕๖๖)
//         กลุ่ม ๑–๑๕ = ฝั่งผู้ป่วย (care) · กลุ่ม ๑๖ ระบบอื่น = กฎหมาย (law)
//
//  ⚠️ กลุ่ม `sci_*` **ไม่ได้มาจากประกาศสภาฯ** — ภาคผนวก ๑ แจกแจงเฉพาะฝั่งผู้ป่วย
//     แต่สัดส่วนข้อสอบจริงคือ ผู้ป่วย ๕๐ : ผลิตภัณฑ์ ๔๐ : สังคม/กฎหมาย ๑๐
//     ฝั่งผลิตภัณฑ์จึงต้องมีที่อยู่ → เราตั้งเอง 6 กลุ่มตามสาขาวิชามาตรฐาน
//     (user เคาะแล้ว 29 ส.ค. 2026) · แก้ได้อิสระ ไม่ผูกกับเอกสารสภาฯ
//
//  ⚠️ ห้ามแก้ `key` ที่ปล่อยไปแล้ว — มันถูกเก็บลง questions.pleGroup ใน Firestore
//     เปลี่ยนชื่อ en/th ได้ (เป็นแค่ label) แต่ต้องกดปุ่มซิงก์ให้ categories re-derive
// ════════════════════════════════════════════════════════════

export const PLE_GROUPS = [
  // ── ฝั่งผู้ป่วย (care) — ภาคผนวก ๑ ข้อ ๑–๑๕ ──
  { key: 'msk', domain: 'care', n: 1, en: 'Musculoskeleton (Rheumatology)', th: 'กระดูกและข้อ', subs: [
    'Osteoarthritis', 'Osteoporosis', 'Rheumatoid arthritis', 'Gout'] },
  { key: 'cvs', domain: 'care', n: 2, en: 'Cardiovascular', th: 'หัวใจและหลอดเลือด', subs: [
    'Hypertension', 'Stable Heart Failure', 'Coronary artery disease', 'Dyslipidemias',
    'Venous thromboembolism'] },
  { key: 'derm', domain: 'care', n: 3, en: 'Dermatologic', th: 'ผิวหนัง', subs: [
    'Urticaria angioedema', 'Superficial fungal infections', 'Acne', 'Eczema', 'Herpes',
    'Wound', 'Seborrheic dermatitis', 'Psoriasis'] },
  { key: 'endo', domain: 'care', n: 4, en: 'Endocrine', th: 'ต่อมไร้ท่อ', subs: [
    'Diabetes mellitus', 'Hypothyroidism, hyperthyroidism', 'Obesity'] },
  { key: 'gi', domain: 'care', n: 5, en: 'Gastrointestinal', th: 'ทางเดินอาหาร', subs: [
    'Gastroesophageal reflux disease', 'Nausea and vomiting', 'Dyspepsia, Peptic ulcer disease',
    'Diarrhea and constipation, hemorrhoid', 'Stress ulcer disease', 'Hepatitis B virus',
    'Inflammatory bowel disease'] },
  { key: 'heme', domain: 'care', n: 6, en: 'Hematologic', th: 'โลหิตวิทยา', subs: [
    'Anemia', 'Hemolytic anemia (G6PD deficiency, thalassemia)'] },
  { key: 'immu', domain: 'care', n: 7, en: 'Immunologic', th: 'การแพ้และภูมิคุ้มกันวิทยา', subs: [
    'Allergic rhinitis', 'Hypersensitivity reactions', 'Systemic lupus erythematosus',
    'การให้วัคซีนสร้างเสริมภูมิคุ้มกันโรคเบื้องต้น (EPI Thailand)'] },
  { key: 'id', domain: 'care', n: 8, en: 'Infectious diseases', th: 'โรคติดเชื้อ', subs: [
    'HIV infection without opportunistic infections', 'Parasitic infections (หิด เหา พยาธิ)',
    'Sexually transmitted diseases & vaginitis', 'Tuberculosis',
    'Upper respiratory tract infections', 'Cystitis (lower urinary tract infection)', 'Pneumonia'] },
  { key: 'neuro', domain: 'care', n: 9, en: 'Neurologic', th: 'ระบบประสาท', subs: [
    'Headache (migraine, tension)', 'Epilepsy, status epilepticus', 'Pain management', 'Stroke',
    'Peripheral neuropathy', 'Parkinson disease', 'Dementia, Alzheimer disease'] },
  { key: 'psych', domain: 'care', n: 10, en: 'Psychiatric', th: 'จิตเวช', subs: [
    'Drug and alcohol abuse', 'Tobacco dependence and cessation', 'Anxiety/depression', 'Insomnia'] },
  { key: 'pulm', domain: 'care', n: 11, en: 'Pulmonary', th: 'ปอด', subs: [
    'Asthma', 'Chronic obstructive pulmonary disease'] },
  { key: 'gu', domain: 'care', n: 12, en: 'Gynaecologic/Genitourinary', th: 'ปัสสาวะและสืบพันธุ์', subs: [
    'Dysmenorrhea', 'Oral contraceptive', 'Hormonal replacement therapy', 'Urinary incontinence'] },
  { key: 'eye', domain: 'care', n: 13, en: 'Eye disorder', th: 'ตา', subs: [
    'Conjunctivitis', 'Hordeolum (กุ้งยิง)', 'Contact Lens', 'ริดสีดวงตา ต้อหิน ต้อกระจก แผลที่ตา'] },
  { key: 'onco', domain: 'care', n: 14, en: 'Oncologic', th: 'มะเร็งวิทยา', subs: [
    'Lung cancer', 'Breast cancer', 'Cervical cancer', 'Colon cancer'] },
  { key: 'renal', domain: 'care', n: 15, en: 'Renal', th: 'ไต', subs: [
    'Acute kidney injury (AKI)', 'Chronic kidney diseases (CKD)', 'Fluid and electrolyte disorder'] },

  // ── ฝั่งกฎหมาย (law) — ภาคผนวก ๑ ข้อ ๑๖ "ระบบอื่น" ──
  { key: 'other', domain: 'law', n: 16, en: null, th: 'ระบบอื่น', subs: ['กฎหมาย (Law)'] },

  // ── ฝั่งผลิตภัณฑ์ (sci) — ⚠️ เราตั้งเอง ไม่ได้มาจากประกาศสภาฯ ──
  { key: 'sci_analysis', domain: 'sci', n: null, en: null, th: 'เภสัชวิเคราะห์และการควบคุมคุณภาพ', subs: [
    'การควบคุมคุณภาพ (QC)', 'Titration', 'Impurity', 'Uniformity of dosage unit'] },
  { key: 'sci_tech', domain: 'sci', n: null, en: null, th: 'เทคโนโลยีเภสัชกรรมและรูปแบบยาเตรียม', subs: [
    'รูปแบบยาเตรียมและเภสัชตำรับ', 'ระบบนำส่งยา', 'GMP และการเก็บบันทึก', 'เภสัชกรรมอุตสาหการ'] },
  { key: 'sci_chem', domain: 'sci', n: null, en: null, th: 'เภสัชเคมี', subs: [
    'กรด-เบสและการแตกตัวของยา', 'โครงสร้างยากับการออกฤทธิ์'] },
  { key: 'sci_pharm', domain: 'sci', n: null, en: null, th: 'เภสัชวิทยาและเภสัชจลนศาสตร์', subs: [
    'เภสัชจลนศาสตร์', 'เภสัชพลศาสตร์', 'อันตรกิริยาระหว่างยา', 'Pharmacogenetics'] },
  { key: 'sci_herb', domain: 'sci', n: null, en: null, th: 'เภสัชเวทและสมุนไพร', subs: [
    'สมุนไพรและผลิตภัณฑ์ธรรมชาติ'] },
  { key: 'sci_social', domain: 'sci', n: null, en: null, th: 'เภสัชกรรมสังคมและระบาดวิทยา', subs: [
    'Pharmacovigilance', 'ระบาดวิทยา (Epidemiology)', 'เศรษฐศาสตร์และการบริหารเภสัชกิจ'] },
]

export const PLE_GROUP_KEYS = PLE_GROUPS.map(g => g.key)
export const isPleGroupKey = (k) => PLE_GROUP_KEYS.includes(k)
export const groupByKey = (k) => PLE_GROUPS.find(g => g.key === k) || null

// ป้ายกลุ่มที่โชว์ผู้ใช้ + เก็บลง categories — "อังกฤษ (ไทย)" ตามที่เอกสารสภาฯ เขียน
// กลุ่มที่ไม่มีชื่ออังกฤษ (ระบบอื่น + sci ของเรา) ใช้ชื่อไทยล้วน
export function groupLabel(keyOrGroup) {
  const g = typeof keyOrGroup === 'string' ? groupByKey(keyOrGroup) : keyOrGroup
  if (!g) return null
  return g.en && g.th ? `${g.en} (${g.th})` : (g.en || g.th)
}

// โรคย่อยของกลุ่ม (array ว่างถ้าไม่รู้จักกลุ่ม)
export const subsOf = (k) => groupByKey(k)?.subs || []

// โรคย่อยนี้อยู่ในกลุ่มนี้จริงไหม — กันค่าที่ค้างจากการสลับกลุ่มแล้วลืมล้างโรคย่อย
export const isValidSub = (k, sub) => !sub || subsOf(k).includes(sub)

// กลุ่มที่อยู่ใต้ domain (care/sci/law) — ใช้จัด <optgroup> ใน picker
export const groupsOfDomain = (d) => PLE_GROUPS.filter(g => g.domain === d)
