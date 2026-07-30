import { DOMAIN_KEYS } from '../data/domains.js'
import { getCategories } from './questionCategories.js'

// buildMeta — pure: สรุปข้อมูลคลังให้หน้า quiz home ใช้โดยไม่ต้องโหลดทั้งคลัง
//  publishedTotal = จำนวนข้อที่เผยแพร่ · categories = หมวดย่อยไม่ซ้ำ · domains = นับต่อ domain ใหญ่
export function buildMeta(questions) {
  const pub = questions.filter(q => q && q.isPublished === true)
  const cats = [...new Set(pub.flatMap(q => getCategories(q)))]
  cats.sort((a, b) => a.localeCompare(b, 'th'))
  const domains = Object.fromEntries(DOMAIN_KEYS.map(k => [k, 0]))
  for (const q of pub) {
    if (q.domain in domains) domains[q.domain]++
  }
  // นับชุดข้อสอบย้อนหลัง (published เท่านั้น) — 1 ข้ออยู่หลายชุดนับทุกชุด
  const examCounts = {}
  for (const q of pub) {
    for (const name of (Array.isArray(q.examSets) ? q.examSets : [])) {
      if (name) examCounts[name] = (examCounts[name] || 0) + 1
    }
  }
  const examSets = Object.entries(examCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  return { publishedTotal: pub.length, categories: cats, domains, examSets }
}
