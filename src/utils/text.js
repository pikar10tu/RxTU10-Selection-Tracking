// ════════════════════════════════════════════════════════════
//  Clean + cap user-entered text before persisting to Firestore.
//  - trim whitespace
//  - strip control characters (keep TAB and newline)
//  - hard-limit length so one field can't bloat the user doc toward the
//    1 MB Firestore limit or break the UI with a giant string.
//  Plain text only — Vue's {{ }} already HTML-escapes on render, so this is
//  about abuse/bloat, not XSS.
// ════════════════════════════════════════════════════════════

// Drop C0/C1 control characters, keeping only TAB (9) and LF (10).
// Done char-by-char to avoid embedding raw control chars in source.
function stripControls(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    const isControl = (code < 32 && code !== 9 && code !== 10) || code === 127 || (code >= 128 && code <= 159)
    if (!isControl) out += s[i]
  }
  return out
}

export function cleanText(str, max = 500) {
  return stripControls(String(str ?? '')).trim().slice(0, max)
}

// ตัด emoji ตกแต่งท้ายชื่อเล่นออก (roster format "ชื่อ <emoji> (รหัส)" + เผื่อ user ที่ตั้ง emoji เอง)
// รองรับ variation-selector / ZWJ-sequence / skin-tone modifier · ตัดเฉพาะท้ายสุด ไม่แตะ emoji กลางชื่อ
// ใช้ทั้งตอนแสดงผล (members store) และ cleanup ค่าใน DB (admin tool)
export function stripTrailingEmoji(s) {
  return (s || '').replace(/\s*(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)+\s*$/u, '').trim()
}

// Length caps — single source of truth; mirror these in input maxlength attrs.
export const LIMITS = {
  contact: 40,
  nickname: 30,
  guestReason: 200,
  news: 280,
  feedback: 1000,
  report: 1000,
  question: 500,
  choice: 200,
  category: 60,
  explanation: 1000,
  comment: 1000,
  reviewReason: 1000,
  reviewRef: 300,
  reviewerName: 60,
  reviewNote: 1000,
}
