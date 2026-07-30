// ════════════════════════════════════════════════════════════
//  งานถัดไปที่ควรทำ — pure
//  โชว์ทีละ 1 อย่างบน Home · ลิสต์คือปัญหาเดิม (ระบบ 9 อย่างกองกันจนคนใหม่ไม่รู้จะเริ่มไหน)
//  กฎเรียงตามลำดับ เจอข้อแรกที่เข้าเงื่อนไข = ใช้อันนั้น แล้วหยุด
//  การเรียนมาก่อนเกมทุกข้อ (user เคาะ 30 ก.ค.) — แอพนี้คือแอพเตรียมสอบ เกมเป็นรางวัล
//  ห้ามอ่าน Firestore ที่นี่: รับ userData ที่โหลดมาแล้วเท่านั้น (การ์ดนี้ต้องไม่มีต้นทุน read)
// ════════════════════════════════════════════════════════════
import { questNotClaimed, questClaimable } from './dailyQuest.js'

export const BATTLE_TEAM_SIZE = 3

// นับการ์ดที่ครบกำหนดทบทวน — study.cards เก็บ nextReviewDate เป็น epoch ms (ดู StudyView)
function dueCount(userData, now) {
  const cards = userData?.study?.cards || {}
  return Object.values(cards).filter(c => (c?.nextReviewDate || 0) <= now).length
}

// มีแปลงว่างในช่วงที่ปลดล็อกแล้วไหม
//  โครง farm.plots ตาม useFarm.js: null = ว่าง · array อาจสั้นกว่า plotsUnlocked ⇒ ช่องที่ยังไม่มี = ว่าง
function hasEmptyPlot(userData) {
  const farm = userData?.farm || {}
  const unlocked = farm.plotsUnlocked || 0
  const plots = farm.plots || []
  for (let i = 0; i < unlocked; i++) if (!plots[i]) return true
  return false
}

// คืนงานถัดไป 1 อย่าง หรือ null = ซ่อนการ์ด (ไม่ใช่การ์ดว่าง)
//  ctx.today = 'YYYY-MM-DD' (ไม่ส่ง = ข้ามกฎที่อิงวันที่) · ctx.now = epoch ms (ฉีดเพื่อเทส)
export function nextAction(userData, ctx = {}) {
  if (!userData) return null
  const { today = null, now = Date.now() } = ctx

  // 1) ยังไม่เคยทบทวนเลย — คนใหม่ยังไม่มีการ์ดใน study.cards ให้ due จับได้
  if (!(userData.studyReviewedTotal > 0)) {
    return {
      key: 'study-new', icon: '📚', title: 'เริ่มทบทวนแฟลชการ์ดชุดแรก',
      sub: 'ทบทวนได้เหรียญ และจำได้ดีกว่าอ่านรวบทีเดียว', cta: 'ไปทบทวน', to: '/study',
    }
  }
  // 2) มีการ์ดครบกำหนดค้างอยู่
  const due = dueCount(userData, now)
  if (due > 0) {
    return {
      key: 'study-due', icon: '📚', title: `ทบทวน ${due} ใบที่ครบกำหนด`,
      sub: 'ทบทวนตามรอบช่วยให้จำได้นานขึ้น', cta: 'ไปทบทวน', to: '/study',
    }
  }
  // 3) วันนี้ยังไม่ทำข้อสอบ — dailyQuest.quiz คือสัญญาณเดียวที่ QuizView เขียนจริง
  //    (quizCoinDate ตายตั้งแต่ปลดเพดานเหรียญควิซ 11 ก.ค. — ไม่มีใครเขียนแล้ว อย่าเอากลับมาใช้)
  const dq = userData.dailyQuest
  if (today && !(dq?.date === today && (dq.quiz || 0) > 0)) {
    return {
      key: 'quiz-today', icon: '📝', title: 'ทำข้อสอบวันนี้',
      sub: 'ตอบถูกได้เหรียญทุกข้อ ทำมากได้มาก', cta: 'ไปทำข้อสอบ', to: '/quiz',
    }
  }
  // 4) ยังไม่มีเพ็ท
  const pets = userData.pets || []
  if (!pets.length) {
    return {
      key: 'first-pet', icon: '🥚', title: 'อัญเชิญเพ็ทตัวแรก',
      sub: 'เพ็ทเพิ่มรายได้รายวัน และใช้ลงสนามต่อสู้', cta: 'ไปร้านค้า', to: '/shop',
    }
  }
  // 5) ทีมต่อสู้ไม่ครบ
  const active = (userData.activePets || []).filter(Boolean)
  if (active.length < BATTLE_TEAM_SIZE) {
    return {
      key: 'team', icon: '⭐', title: `จัดทีมต่อสู้ให้ครบ ${BATTLE_TEAM_SIZE} ตัว`,
      sub: `ตอนนี้ ${active.length}/${BATTLE_TEAM_SIZE} — ทีมไม่ครบเสียเปรียบตอนสู้`,
      cta: 'ไปจัดทีม', to: '/play/pets',
    }
  }
  // 6) เควสวันนี้ยังไม่ได้กดรับรางวัล — เปิด bottom-sheet บน Home ไม่ใช่เปลี่ยนหน้า
  //    แยกข้อความ 2 สถานะ: ทำครบแล้วรอกดรับ vs ยังทำไม่ครบ (questNotClaimed จริงทั้งสองแบบ)
  if (today && questNotClaimed(dq, today)) {
    return questClaimable(dq, today)
      ? {
          key: 'quest', icon: '🎯', title: 'เควสวันนี้ครบแล้ว — ยังไม่ได้กดรับรางวัล',
          sub: 'กดรับเลยจะได้รายได้ ×1.5 กับตั๋วอัญเชิญฟรี', cta: 'ไปกดรับ', sheet: 'quest',
        }
      : {
          key: 'quest', icon: '🎯', title: 'เควสประจำวันยังไม่ครบ',
          sub: 'ทำครบรับรายได้ ×1.5 กับตั๋วอัญเชิญฟรี', cta: 'ดูเควส', sheet: 'quest',
        }
  }
  // 7) มีแปลงฟาร์มว่าง
  if (hasEmptyPlot(userData)) {
    return {
      key: 'farm-empty', icon: '🌱', title: 'มีแปลงฟาร์มว่างอยู่',
      sub: 'ปลูกทิ้งไว้ แล้วกลับมาเก็บขายเป็นเหรียญ', cta: 'ไปปลูก', to: '/play/farm',
    }
  }
  // 8) ส่งผจญภัยได้ — มาถึงบรรทัดนี้ได้แปลว่าทีมครบ 3 แล้ว (กฎ 5 คืนค่าไปก่อนถ้าไม่ครบ)
  if (!userData.expedition) {
    return {
      key: 'expedition', icon: '🧭', title: 'ส่งเพ็ทไปผจญภัย',
      sub: 'ส่งทิ้งไว้ตามเวลา กลับมารับของรางวัล', cta: 'ไปส่ง', to: '/play/pets',
    }
  }
  return null
}
