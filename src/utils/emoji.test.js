// เทส emoji helper — verify อัลกอริทึม codepoint ตรงกับชื่อไฟล์ของ Twemoji
// (jdecked/twemoji: hex พิมพ์เล็ก คั่นด้วย '-' ตัด VS16 ออกถ้าไม่ใช่ ZWJ sequence)
// รัน: node --test src/utils/emoji.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emojiCodepoint, fluentFile, emojifyHtml } from './emoji.js'

test('emoji ธรรมดา (surrogate pair) → hex ตัวเดียว', () => {
  assert.equal(emojiCodepoint('🐱'), '1f431') // cat face U+1F431
  assert.equal(emojiCodepoint('😀'), '1f600')
  assert.equal(emojiCodepoint('👍'), '1f44d')
})

test('VS16 (FE0F) ถูกตัดออกเมื่อไม่ใช่ ZWJ sequence', () => {
  assert.equal(emojiCodepoint('✌️'), '270c')  // victory hand + FE0F → 270c
  assert.equal(emojiCodepoint('🛠️'), '1f6e0') // hammer and wrench + FE0F
  assert.equal(emojiCodepoint('❤️'), '2764')  // red heart + FE0F
})

test('ZWJ sequence เก็บทุก codepoint รวม 200d (ไม่ตัด VS16)', () => {
  // family: man + ZWJ + woman + ZWJ + girl
  assert.equal(emojiCodepoint('👨‍👩‍👧'), '1f468-200d-1f469-200d-1f467')
})

test('ค่าว่าง → ""', () => {
  assert.equal(emojiCodepoint(''), '')
  assert.equal(emojiCodepoint(undefined), '')
})

test('fluentFile: path สัมพัทธ์ emoji/fluent/<cp>.svg, ว่าง → ""', () => {
  assert.equal(fluentFile('🐱'), 'emoji/fluent/1f431.svg')
  assert.equal(fluentFile('🛠️'), 'emoji/fluent/1f6e0.svg') // VS16 strip
  assert.equal(fluentFile(''), '')
})

// ── emojifyHtml: ผลลัพธ์ไปเข้า v-html (ConfirmModal) → ต้อง escape ข้อความก่อนเสมอ ──
// ข้อความที่ส่งเข้ามามีทั้งชื่อเล่นผู้ใช้ (AdminView) และโจทย์ข้อสอบ (QuestionsView)
test('escape แท็ก HTML ในข้อความ (กัน XSS ผ่าน v-html)', () => {
  const out = emojifyHtml('<img src=x onerror=alert(1)>')
  assert.ok(!out.includes('<img src=x'), 'ต้องไม่มีแท็กดิบหลุดออกไป')
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'))
})

test('escape ชื่อเล่นที่มี <script> (เคสจริง: นักศึกษาตั้งชื่อเอง → กล่องยืนยันของแอดมิน)', () => {
  const out = emojifyHtml('ล้างการผูกตัวตนของ <script>steal()</script>?')
  assert.ok(!out.includes('<script>'))
  assert.ok(out.includes('&lt;script&gt;steal()&lt;/script&gt;'))
})

test('escape & และ " ด้วย (กันหลุดออกจาก attribute)', () => {
  assert.equal(emojifyHtml('a & b'), 'a &amp; b')
  assert.equal(emojifyHtml('พิมพ์ "ยืนยัน"'), 'พิมพ์ &quot;ยืนยัน&quot;')
})

test('escape ไม่กระทบการแปลง emoji เป็น <img> (ยังทำงานเหมือนเดิม)', () => {
  const out = emojifyHtml('ขาย 🐱 แล้ว')
  assert.ok(out.includes('<img src="emoji/fluent/1f431.svg"'), out)
  assert.ok(out.startsWith('ขาย ') && out.endsWith(' แล้ว'))
})

test('base ถูกเติมหน้า path ตามเดิม', () => {
  assert.ok(emojifyHtml('🐱', '/rxtu10/').includes('src="/rxtu10/emoji/fluent/1f431.svg"'))
})

test('emoji ที่ไม่มีไฟล์ → คงตัวเดิม ไม่แตะ', () => {
  assert.equal(emojifyHtml(''), '')
  assert.equal(emojifyHtml('ไม่มี emoji เลย'), 'ไม่มี emoji เลย')
})

test('ข้อความปนทั้ง emoji และแท็ก → emoji แปลง แท็กถูก escape', () => {
  const out = emojifyHtml('<b>ขาย</b> 🐱')
  assert.ok(out.includes('&lt;b&gt;ขาย&lt;/b&gt;'))
  assert.ok(out.includes('<img src="emoji/fluent/1f431.svg"'))
})
