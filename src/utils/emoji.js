// ════════════════════════════════════════════════════════════
//  Emoji helper — แสดง emoji เป็น "รูปเดียวกันทุกเครื่อง"
//  (iOS / Android / Windows render emoji ต่างกัน → ใช้ภาพชุดเดียว)
//  ใช้ Fluent Emoji (Microsoft, สไตล์ Color SVG) self-host ใน public/emoji/fluent/
//  ดาวน์โหลด subset เฉพาะที่ใช้ด้วย scripts/fetch-fluent.mjs (jsDelivr เสิร์ฟ repo
//  >50MB ไม่ได้) · ไฟล์ตั้งชื่อตาม codepoint ให้ตรงกับ emojiCodepoint()
//  License: Fluent Emoji = MIT (เครดิตใน README)
// ════════════════════════════════════════════════════════════

const ZWJ = '‍'   // zero-width joiner
const VS16 = /️/g // variation selector-16

// อัลกอริทึมเดียวกับ twemoji.toCodePoint (รองรับ surrogate pair)
function toCodePoint(str, sep = '-') {
  const r = []
  let c = 0, p = 0, i = 0
  while (i < str.length) {
    c = str.charCodeAt(i++)
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16))
      p = 0
    } else if (c >= 0xd800 && c <= 0xdbff) {
      p = c
    } else {
      r.push(c.toString(16))
    }
  }
  return r.join(sep)
}

/** emoji string → codepoint สำหรับชื่อไฟล์ (ตัด VS16 ออกถ้าไม่ใช่ ZWJ sequence) */
export function emojiCodepoint(emoji) {
  if (!emoji) return ''
  const e = emoji.indexOf(ZWJ) < 0 ? emoji.replace(VS16, '') : emoji
  return toCodePoint(e)
}

/** emoji string → path ไฟล์ Fluent (สัมพัทธ์ต่อ BASE_URL) · '' ถ้า input ว่าง */
export function fluentFile(emoji) {
  const cp = emojiCodepoint(emoji)
  return cp ? `emoji/fluent/${cp}.svg` : ''
}

// emoji ดิบ (base pictographic + VS16/ZWJ/skin-tone) — เดียวกับ scripts/fetch-fluent
const EMOJI_RE = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu

// escape ก่อนประกอบ HTML — ผลลัพธ์ของ emojifyHtml ไปเข้า v-html โดยตรง
// (ConfirmModal.vue) และข้อความที่ส่งเข้ามามีทั้งชื่อเล่นที่ผู้ใช้ตั้งเอง (AdminView)
// และโจทย์ข้อสอบที่ import เข้ามา (QuestionsView) — ไม่ escape = XSS ในเบราว์เซอร์
// แอดมิน ซึ่งเขียน role ได้ทุก doc ตาม rules · cleanText() ไม่ได้ escape ให้ (จงใจ —
// ดูคอมเมนต์ utils/text.js ที่อ้างว่า {{ }} escape ให้แล้ว ซึ่งไม่จริงในเส้นทาง v-html)
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/**
 * แปลง emoji ดิบในสตริง → <img> Fluent (เหมือนกันทุกเครื่อง) สำหรับใช้กับ v-html
 * เช่น ข้อความใน ConfirmModal ที่ประกอบเป็น string ไว้ก่อน (ฝัง <Emoji> ไม่ได้)
 * `base` = import.meta.env.BASE_URL · emoji ที่ไม่มีไฟล์จะคงตัวเดิม (fallback เครื่อง)
 * ⚠️ ข้อความถูก escape ก่อนเสมอ — เอาต์พุตปลอดภัยพอที่จะใส่ v-html ได้
 */
export function emojifyHtml(text, base = '') {
  // escape ก่อน แล้วค่อยหา emoji — การ escape ไม่แตะ codepoint ของ emoji
  // (& < > " ไม่ใช่ Extended_Pictographic) จึงไม่กระทบผลการ match
  return escapeHtml(String(text)).replace(EMOJI_RE, (m) => {
    const f = fluentFile(m)
    if (!f) return m
    return `<img src="${base}${f}" alt="${m}" aria-hidden="true" `
      + `style="width:1em;height:1em;vertical-align:-.125em;object-fit:contain;display:inline-block">`
  })
}
