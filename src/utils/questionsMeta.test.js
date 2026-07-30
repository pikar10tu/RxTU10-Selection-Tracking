// เทส buildMeta — สรุป { publishedTotal, categories, domains } จากรายการข้อสอบ (นับเฉพาะ isPublished)
// รัน: node --test src/utils/questionsMeta.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMeta } from './questionsMeta.js'
import { DOMAIN_KEYS } from '../data/domains.js'

test('นับเฉพาะข้อที่ isPublished', () => {
  const m = buildMeta([
    { isPublished: true, category: 'ยา' },
    { isPublished: false, category: 'ยา' },
    { isPublished: true, category: 'หัวใจ' },
  ])
  assert.equal(m.publishedTotal, 2)
})

test('categories = หมวดไม่ซ้ำของข้อที่เผยแพร่ เรียง ก-ฮ ตัดค่าว่าง', () => {
  const m = buildMeta([
    { isPublished: true, category: 'หัวใจ' },
    { isPublished: true, category: 'ยา' },
    { isPublished: true, category: 'ยา' },
    { isPublished: true, category: '' },
    { isPublished: true },
    { isPublished: false, category: 'ไต' },
  ])
  assert.deepEqual(m.categories, ['ยา', 'หัวใจ'])
})

test('คลังว่าง → publishedTotal 0, categories [], domains ครบ 0', () => {
  assert.deepEqual(buildMeta([]), {
    publishedTotal: 0,
    categories: [],
    domains: Object.fromEntries(DOMAIN_KEYS.map(k => [k, 0])),
    examSets: [],
  })
})

test('domains = นับข้อ published ต่อ domain (มีครบทุก key เป็น 0 ถ้าไม่มี)', () => {
  const m = buildMeta([
    { isPublished: true,  domain: 'care' },
    { isPublished: true,  domain: 'care' },
    { isPublished: true,  domain: 'sci'  },
    { isPublished: false, domain: 'law'  },   // ไม่นับ (ร่าง)
    { isPublished: true,  domain: 'xyz'  },   // ไม่นับ (ไม่ใช่ domain ที่รู้จัก)
    { isPublished: true },                      // ไม่มี domain → ไม่นับเข้า key ใด
  ])
  assert.deepEqual(m.domains, { care: 2, sci: 1, law: 0 })
})

test('domains มี key ครบตาม DOMAIN_KEYS เสมอ', () => {
  const m = buildMeta([])
  assert.deepEqual(Object.keys(m.domains).sort(), [...DOMAIN_KEYS].sort())
})

// ── examSets ──
const q = (over = {}) => ({ isPublished: true, question: 'Q', choices: ['a', 'b'], answer: 0, ...over })

test('examSets: นับต่อชื่อชุด จากข้อ published เท่านั้น', () => {
  const m = buildMeta([
    q({ examSets: ['ชุด A'] }),
    q({ examSets: ['ชุด A'] }),
    q({ examSets: ['ชุด A'], isPublished: false }),   // draft ไม่นับ
  ])
  assert.deepEqual(m.examSets, [{ name: 'ชุด A', count: 2 }])
})

test('examSets: 1 ข้ออยู่หลายชุด → นับทุกชุด', () => {
  const m = buildMeta([q({ examSets: ['ชุด A', 'ชุด B'] })])
  assert.deepEqual(
    [...m.examSets].sort((a, b) => a.name.localeCompare(b.name)),
    [{ name: 'ชุด A', count: 1 }, { name: 'ชุด B', count: 1 }],
  )
})

test('examSets: ข้อไม่มีชุด/ไม่ใช่ array → ไม่พัง, ไม่นับ', () => {
  const m = buildMeta([q(), q({ examSets: null }), q({ examSets: [] })])
  assert.deepEqual(m.examSets, [])
})

test('examSets: เรียงตามชื่อ (th)', () => {
  const m = buildMeta([q({ examSets: ['ข'] }), q({ examSets: ['ก'] })])
  assert.deepEqual(m.examSets.map(s => s.name), ['ก', 'ข'])
})

test('categories ของ meta รวมทุกค่าจากข้อที่มีหลายหมวด', () => {
  const m = buildMeta([
    { isPublished: true, categories: ['เบาหวาน', 'ไต'] },
    { isPublished: true, category: 'ไต' },
    { isPublished: false, categories: ['ไม่นับ'] },
  ])
  assert.deepEqual(m.categories, ['เบาหวาน', 'ไต'].sort((a, b) => a.localeCompare(b, 'th')))
})
