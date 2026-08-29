// ════════════════════════════════════════════════════════════
//  สะพานระหว่างหมวดเก่า (categories = free text) กับหมวดใหม่ (pleGroup/pleSub)
//  pure ทั้งไฟล์ — I/O อยู่ที่ AdminView (ปุ่มแมพ) / QuestionsView / ReviewView
//
//  โมเดลใหม่บนข้อ:
//    pleGroup   = key จาก data/plecc.js       ← แหล่งความจริง
//    pleSub     = ชื่อโรคย่อย (null ได้)       ← แหล่งความจริง
//    categories = ระบบเขียนให้เองจาก 2 ตัวบน  ← ค่า derive ได้เสมอ
//
//  🔑 ที่ categories ต้อง derive ได้ ไม่ใช่แค่ความสวยงาม — มันคือกลไกกันพัง:
//     client เก่าที่เปิดหน้าตรวจค้างไว้ยัง submit categories ชุดเก่าทับได้
//     แต่แตะ pleGroup/pleSub ไม่ได้ (ไม่มีในโค้ดมัน) ⇒ แหล่งความจริงรอดเสมอ
//     แล้วปุ่มซิงก์ของแอดมิน re-derive categories กลับมาให้ถูกในรอบถัดไป
// ════════════════════════════════════════════════════════════
import { groupByKey, groupLabel, isPleGroupKey, isValidSub } from '../data/plecc.js'
import { getCategories } from './questionCategories.js'

// ── ตารางแมพชื่อหมวดเดิม (82 หมวดในทะเบียน ณ 29 ส.ค. 2026) → key กลุ่มใหม่ ──
//  เทียบด้วยชื่อเป๊ะๆ หลัง normalize (ตัดช่องว่างหัวท้าย) — ไม่เดาจากคำใกล้เคียง
//  เพราะเดาผิดแล้วข้อไปโผล่ผิดกลุ่มเงียบๆ แย่กว่าปล่อยให้แอดมินเคาะมือ
export const LEGACY_GROUP_MAP = {
  // 1 Musculoskeleton
  'โรคกระดูกและกล้ามเนื้อ': 'msk', 'ระบบกล้ามเนื้อ': 'msk',
  'กระดูกพรุน': 'msk', 'กระดูกพรุน (Osteoporosis)': 'msk',
  'ข้อเข่าเสื่อม (Osteoarthritis)': 'msk', 'เกาต์ (Gout)': 'msk', 'Rheumatoid arthritis': 'msk',
  // 2 Cardiovascular
  'โรคหัวใจและหลอดเลือด': 'cvs', 'ความดันโลหิตสูง': 'cvs',
  'ภาวะหัวใจล้มเหลวและโรคหัวใจ': 'cvs', 'หัวใจล้มเหลว (Heart failure)': 'cvs',
  'ภาวะไขมันในเลือดผิดปกติ (Dyslipidemia)': 'cvs', 'ACE inhibitors': 'cvs',
  // 3 Dermatologic
  'โรคผิวหนัง': 'derm', 'สิว': 'derm',
  'ผื่นภูมิแพ้ผิวหนัง (Atopic dermatitis)': 'derm', 'ยาทาปฏิชีวนะ': 'derm',
  // 4 Endocrine
  'ระบบต่อมไร้ท่อ': 'endo', 'เบาหวาน': 'endo', 'เบาหวาน (Diabetes mellitus)': 'endo',
  'ไทรอยด์': 'endo', 'โรคอ้วนและการควบคุมน้ำหนัก': 'endo', 'ยากลุ่ม GLP-1 (incretin)': 'endo',
  // 5 Gastrointestinal
  'โรคทางเดินอาหาร': 'gi', 'โรคระบบทางเดินอาหาร': 'gi', 'ท้องผูก': 'gi',
  'แผลในกระเพาะอาหาร (Peptic ulcer)': 'gi', 'แผลในกระเพาะอาหาร (Peptic ulcer / H. pylori)': 'gi',
  'Stress ulcer prophylaxis': 'gi', 'ไวรัสตับอักเสบบี': 'gi',
  // 6 Hematologic
  'ภาวะขาดธาตุเหล็ก': 'heme', 'โลหิตจางจากขาดธาตุเหล็ก (Iron deficiency anemia)': 'heme',
  'Hematology': 'heme', 'ค่าทางห้องปฏิบัติการ (CBC)': 'heme',
  // 7 Immunologic — 'โรคระบบภูมิคุัมกัน' สะกดผิดในทะเบียนจริง (ไม้หันอากาศแทนไม้โท) เก็บทั้งสองแบบ
  'โรคระบบภูมิคุัมกัน': 'immu', 'โรคระบบภูมิคุ้มกัน': 'immu',
  'SLE': 'immu', 'วัคซีน (Immunization)': 'immu', 'อาการไม่พึงประสงค์และการแพ้ยา': 'immu',
  // 8 Infectious diseases
  'โรคติดเชื้อ': 'id', 'HIV และวัณโรค': 'id', 'วัณโรค': 'id', 'เอชไอวี/เอดส์ (HIV)': 'id',
  'พยาธิ': 'id', 'การติดเชื้อทางเดินปัสสาวะ': 'id', 'โรคติดเชื้อทางเดินหายใจในเด็ก': 'id',
  'พิษสุนัขบ้า': 'id', 'เริมที่อวัยวะเพศ (Genital herpes)': 'id',
  // 9 Neurologic
  'โรคระบบประสาท': 'neuro', 'ระบบประสาทและจิตเวช': 'neuro',
  'ไมเกรน': 'neuro', 'โรคหลอดเลือดสมอง': 'neuro',
  // 10 Psychiatric
  'โรคจิตเวช': 'psych', 'โรควิตกกังวล (GAD)': 'psych', 'Insomnia': 'psych',
  'ยากลุ่ม Benzodiazepines': 'psych', 'ยาต้านซึมเศร้า (SNRI)': 'psych',
  // 11 Pulmonary
  'โรคระบบทางเดินหายใจ': 'pulm', 'โรคหืด': 'pulm',
  // 12 Gynaecologic/Genitourinary
  'ระบบนรีเวชกรรม': 'gu', 'ยาคุมกำเนิด': 'gu', 'ภาวะกลั้นปัสสาวะไม่อยู่': 'gu',
  // 13 Eye
  'โรคตา': 'eye', 'ตากุ้งยิง (Hordeolum)': 'eye',
  // 15 Renal
  'โรคไต': 'renal', 'พิษต่อไตจาก NSAIDs': 'renal',
  // 16 ระบบอื่น (กฎหมาย)
  'กฎหมาย': 'other', 'กฎหมายยาและการโฆษณา': 'other',
  // sci — ฝั่งผลิตภัณฑ์ (กลุ่มที่เราตั้งเอง)
  'เภสัชวิเคราะห์': 'sci_analysis', 'QC': 'sci_analysis', 'Titration': 'sci_analysis',
  'Impurity': 'sci_analysis', 'Uniformity of dosage unit': 'sci_analysis',
  'เทคโนโลยีเภสัชกรรม': 'sci_tech', 'ระบบนำส่งยาผ่านผิวหนัง': 'sci_tech',
  'เภสัชกรรมอุตสาหการและเภสัชตำรับ': 'sci_tech', 'GMP และการเก็บบันทึก': 'sci_tech',
  'กรด-เบสและการแตกตัวของยา': 'sci_chem',
  'ยาคอร์ติโคสเตียรอยด์ (เภสัชวิทยา)': 'sci_pharm', 'Pharmacogenetics': 'sci_pharm',
  'ยาสมุนไพร': 'sci_herb',
  'Pharmacovigilance': 'sci_social', 'Epidemiology': 'sci_social',
}

// ── ตารางแมพชื่อหมวดเดิม → โรคย่อย (เฉพาะที่ชี้ชัดพอ) ──
//  หมวดกว้างๆ อย่าง "โรคติดเชื้อ" ไม่มีในนี้โดยตั้งใจ — เดาโรคย่อยให้ไม่ได้
export const LEGACY_SUB_MAP = {
  'กระดูกพรุน': 'Osteoporosis', 'กระดูกพรุน (Osteoporosis)': 'Osteoporosis',
  'ข้อเข่าเสื่อม (Osteoarthritis)': 'Osteoarthritis', 'เกาต์ (Gout)': 'Gout',
  'Rheumatoid arthritis': 'Rheumatoid arthritis',
  'ความดันโลหิตสูง': 'Hypertension', 'หัวใจล้มเหลว (Heart failure)': 'Stable Heart Failure',
  'ภาวะไขมันในเลือดผิดปกติ (Dyslipidemia)': 'Dyslipidemias',
  'สิว': 'Acne', 'ผื่นภูมิแพ้ผิวหนัง (Atopic dermatitis)': 'Eczema',
  'เริมที่อวัยวะเพศ (Genital herpes)': 'Sexually transmitted diseases & vaginitis',
  'เบาหวาน': 'Diabetes mellitus', 'เบาหวาน (Diabetes mellitus)': 'Diabetes mellitus',
  'ยากลุ่ม GLP-1 (incretin)': 'Diabetes mellitus',
  'ไทรอยด์': 'Hypothyroidism, hyperthyroidism',
  'โรคอ้วนและการควบคุมน้ำหนัก': 'Obesity',
  'ท้องผูก': 'Diarrhea and constipation, hemorrhoid',
  'แผลในกระเพาะอาหาร (Peptic ulcer)': 'Dyspepsia, Peptic ulcer disease',
  'แผลในกระเพาะอาหาร (Peptic ulcer / H. pylori)': 'Dyspepsia, Peptic ulcer disease',
  'Stress ulcer prophylaxis': 'Stress ulcer disease', 'ไวรัสตับอักเสบบี': 'Hepatitis B virus',
  'ภาวะขาดธาตุเหล็ก': 'Anemia', 'โลหิตจางจากขาดธาตุเหล็ก (Iron deficiency anemia)': 'Anemia',
  'SLE': 'Systemic lupus erythematosus',
  'วัคซีน (Immunization)': 'การให้วัคซีนสร้างเสริมภูมิคุ้มกันโรคเบื้องต้น (EPI Thailand)',
  'อาการไม่พึงประสงค์และการแพ้ยา': 'Hypersensitivity reactions',
  'เอชไอวี/เอดส์ (HIV)': 'HIV infection without opportunistic infections',
  'วัณโรค': 'Tuberculosis', 'พยาธิ': 'Parasitic infections (หิด เหา พยาธิ)',
  'การติดเชื้อทางเดินปัสสาวะ': 'Cystitis (lower urinary tract infection)',
  'โรคติดเชื้อทางเดินหายใจในเด็ก': 'Upper respiratory tract infections',
  'ไมเกรน': 'Headache (migraine, tension)', 'โรคหลอดเลือดสมอง': 'Stroke',
  'โรควิตกกังวล (GAD)': 'Anxiety/depression', 'ยาต้านซึมเศร้า (SNRI)': 'Anxiety/depression',
  'Insomnia': 'Insomnia', 'ยากลุ่ม Benzodiazepines': 'Insomnia',
  'โรคหืด': 'Asthma',
  'ยาคุมกำเนิด': 'Oral contraceptive', 'ภาวะกลั้นปัสสาวะไม่อยู่': 'Urinary incontinence',
  'ตากุ้งยิง (Hordeolum)': 'Hordeolum (กุ้งยิง)',
  'กฎหมาย': 'กฎหมาย (Law)', 'กฎหมายยาและการโฆษณา': 'กฎหมาย (Law)',
  'QC': 'การควบคุมคุณภาพ (QC)', 'Titration': 'Titration', 'Impurity': 'Impurity',
  'Uniformity of dosage unit': 'Uniformity of dosage unit',
  'ระบบนำส่งยาผ่านผิวหนัง': 'ระบบนำส่งยา', 'GMP และการเก็บบันทึก': 'GMP และการเก็บบันทึก',
  'เภสัชกรรมอุตสาหการและเภสัชตำรับ': 'เภสัชกรรมอุตสาหการ',
  'กรด-เบสและการแตกตัวของยา': 'กรด-เบสและการแตกตัวของยา',
  'Pharmacogenetics': 'Pharmacogenetics', 'Pharmacovigilance': 'Pharmacovigilance',
  'Epidemiology': 'ระบาดวิทยา (Epidemiology)',
  'ยาสมุนไพร': 'สมุนไพรและผลิตภัณฑ์ธรรมชาติ',
}

const norm = (s) => (s || '').trim()

// เดากลุ่มจากชื่อหมวดเดิมของข้อ — คืน key แรกที่แมพได้ (null = แมพไม่ได้ ต้องให้คนเคาะ)
//  ข้อเก่ามีได้หลายหมวด: ตัวที่ชี้ชัดกว่ามักถูกใส่ทีหลัง แต่เราไม่เดาลำดับ — เอาตัวแรกที่รู้จัก
export function inferGroup(categories) {
  for (const c of (Array.isArray(categories) ? categories : [])) {
    const key = LEGACY_GROUP_MAP[norm(c)]
    if (key && isPleGroupKey(key)) return key
  }
  return null
}

// เดาโรคย่อยจากชื่อหมวดเดิม — ต้องอยู่ในกลุ่มที่ส่งมาด้วย ไม่งั้นทิ้ง (กันข้ามกลุ่ม)
export function inferSub(categories, groupKey) {
  for (const c of (Array.isArray(categories) ? categories : [])) {
    const sub = LEGACY_SUB_MAP[norm(c)]
    if (sub && isValidSub(groupKey, sub)) return sub
  }
  return null
}

// categories ที่ระบบเขียนให้เอง = [ป้ายกลุ่ม, โรคย่อย] — ตัดค่าว่าง/ซ้ำออก
export function categoriesFor(groupKey, sub) {
  const label = groupLabel(groupKey)
  if (!label) return []
  const out = [label]
  if (sub && isValidSub(groupKey, sub) && sub !== label) out.push(sub)
  return out
}

// อ่านหมวดปัจจุบันของข้อเป็น {group, sub} — ข้อที่ยัง migrate ไม่ถึงจะได้ค่า "เดาให้"
//  ใช้ prefill picker หน้าตรวจ/หน้าแก้ ⇒ คนตรวจแค่ยืนยัน ไม่ต้องเลือกใหม่ทุกข้อ
//  inferred=true บอก UI ได้ว่านี่คือค่าที่ระบบเดา ยังไม่ใช่ค่าที่มีคนยืนยัน
export function pleFields(question) {
  const stored = question?.pleGroup
  if (isPleGroupKey(stored)) {
    const sub = question?.pleSub
    return { group: stored, sub: isValidSub(stored, sub) ? (sub || null) : null, inferred: false }
  }
  const cats = getCategories(question)
  const group = inferGroup(cats)
  return { group, sub: group ? inferSub(cats, group) : null, inferred: !!group }
}

// patch ที่จะเขียนลง Firestore เมื่อเลือกหมวดใหม่ — เขียน 3 ฟิลด์พร้อมกันเสมอ
//  (categories ต้องตามเสมอ ไม่งั้น quiz filter/meta/หน้าคลังเห็นของเก่า)
export function plePatch(groupKey, sub) {
  if (!isPleGroupKey(groupKey)) return null
  const cleanSub = isValidSub(groupKey, sub) ? (sub || null) : null
  return { pleGroup: groupKey, pleSub: cleanSub, categories: categoriesFor(groupKey, cleanSub) }
}

// แผนแมพทั้งคลัง (pure) — คืนเฉพาะข้อที่ค่าเปลี่ยนจริง + กองที่แมพไม่ได้
//  ใช้โดยปุ่ม "แมพหมวดเข้าเกณฑ์สภาฯ" ใน AdminView
export function migrationPlan(questions) {
  const updates = []
  const unmapped = []
  for (const q of (questions || [])) {
    const { group, sub } = pleFields(q)
    if (!group) { unmapped.push(q); continue }
    const patch = plePatch(group, sub)
    const sameGroup = q.pleGroup === patch.pleGroup
    const sameSub = (q.pleSub || null) === patch.pleSub
    const sameCats = JSON.stringify(getCategories(q)) === JSON.stringify(patch.categories)
    if (sameGroup && sameSub && sameCats) continue
    updates.push({ id: q.id, patch })
  }
  return { updates, unmapped, total: (questions || []).length }
}

// สรุปความครอบคลุมรายกลุ่ม — {groupKey: {total, published}} · เตรียมไว้ให้ P2 ใช้ต่อ
export function coverageByGroup(questions) {
  const out = {}
  for (const q of (questions || [])) {
    const { group } = pleFields(q)
    const k = group || '__none'
    out[k] = out[k] || { total: 0, published: 0 }
    out[k].total++
    if (q?.isPublished === true) out[k].published++
  }
  return out
}

export { groupByKey }
