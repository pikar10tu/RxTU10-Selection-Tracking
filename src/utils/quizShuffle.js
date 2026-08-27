/**
 * สลับข้อ/สลับตัวเลือกของข้อสอบ — ใช้ร่วมโดย QuizView และ TimeAttackView
 * เทส: node --test src/utils/quizShuffle.test.js
 */

/** สลับลำดับ — คืน array ใหม่ ไม่แตะต้นฉบับ (Fisher–Yates) */
export function shuffle(arr) {
  const a = (arr || []).slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

/**
 * สลับตำแหน่งตัวเลือกในข้อหนึ่ง + remap index เฉลยให้ตรงตำแหน่งใหม่
 * (กันคนจำว่า "เฉลยคือข้อ ก" จากการทำซ้ำ — ให้จำเนื้อหาแทน)
 */
export function shuffleChoices(q) {
  const order = shuffle(q.choices.map((_, i) => i))
  return {
    ...q,
    choices: order.map(i => q.choices[i]),
    answer: order.indexOf(q.answer),
  }
}
