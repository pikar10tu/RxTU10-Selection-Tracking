// ════════════════════════════════════════════════════════════
//  User document schema — single source of truth for defaults,
//  new-account seeding, and read-time normalization + migrations.
//
//  Why: fields used to be defaulted ad-hoc with `userData?.x || default`
//  scattered across the app, and migrations lived inline in the snapshot
//  handler. Centralising here means a view never crashes on a missing
//  field, and one-time migrations have a single home.
// ════════════════════════════════════════════════════════════

import { getPetDef } from './index.js'

// NEUTRAL defaults for an existing account that happens to be missing a
// field. NOTE: coins defaults to 0 here (safe) — the 2000 welcome bonus is
// applied only when SEEDING a brand-new account (see newUserDoc).
export const USER_DEFAULTS = {
  customPhoto: null,
  coins: 0,
  pets: [],
  activePets: [null, null, null],
  pvpVictories: 0,
  studentId: null,
  nickname: null,
  realName: null,
  track: null,
  quizHigh: 0,
  drugHigh: 0,
  ctHigh: 0,
  quizCoinDate: null,   // ⚠️ deprecated 11 ก.ค. (ปลดเพดานเหรียญควิซ) — ไม่มีใครเขียนแล้ว อย่าใช้เป็นเงื่อนไข
  quizCoinsToday: 0,    // ⚠️ deprecated เช่นกัน
  studyCoinDate: null,  // YYYY-MM-DD of last study (SRS) coin earning (daily cap)
  studyCoinsToday: 0,   // study coins earned today (capped)
  towerFloor: 1,
  towerBest: 0,
  towerLastReset: null,
  lastDaily: null,
  contact: { phone: '', ig: '', line: '' },
  likes: 0,
  likedBy: {},
  totalSpent: 0,
  pityClaimedRounds: 0,
  quizDoneTotal: 0,        // lifetime: ข้อสอบที่ทำ (achievement)
  studyReviewedTotal: 0,   // lifetime: แฟลชการ์ดที่ทบทวน (achievement)
  farmSalesTotal: 0,       // lifetime: เหรียญจากการขายฟาร์ม (achievement)
  achievementCount: 0,     // denormalized count ของ achievements subcollection
  // ── v2 fields ──
  role: 'student',                            // 'student' | 'academic' | 'instructor' | 'admin'
  tags: [],                                   // admin-assigned badges
  residence: { level: 1, upgradedAt: null },  // ที่อยู่อาศัย (prestige/coin sink)
  farm: { plots: [], plotCount: 4, inventory: {}, lastTick: null, plotsUnlocked: 1 },
  study: { cards: {}, qcards: {} },           // SRS: cards = แฟลชการ์ดตัวยา · qcards = ข้อสอบที่เคยตอบผิด
  dailyQuest: { date: null, quiz: 0, farm: 0, gacha: 0, claimed: false },
  freeGachaTickets: 0,
  welcomeGiftV1: false,   // one-time: ส่งจดหมายของขวัญต้อนรับแล้ว (กัน client ส่งซ้ำ)
  welcomeBoxSeen: false,  // เห็น Welcome box ต้อนรับแล้ว (กัน popup เด้งซ้ำ)
  // ── gacha (Phase B) ──
  gachaPity: 0,            // จำนวน pull ตั้งแต่ legendary ล่าสุด (soft 76 / hard 100)
  gachaTarget: null,       // species id ของ legendary ที่เลือกเป็นเป้า (null = ไม่เลือก → new-first)
  gachaGuaranteed: false,  // true = legendary ครั้งหน้าการันตีตัวเป้า (จาก lose 50/50)
  incomeBuffUntil: null,
  incomeBuffFrom: null,    // ms เริ่มบัฟ (คู่กับ incomeBuffUntil) — รองรับสแตคต่อเวลา
  // ── PvP (สนามประลอง) ──
  pvp: { rating: 1000, wins: 0, losses: 0, seasonId: null },
  pvpAttackDate: null,   // YYYY-MM-DD (local) รีโควต้าบุกรายวัน
  pvpAttacksUsed: 0,     // จำนวนบุกที่ใช้ไปวันนี้ (รวมคน+บอท)
  // ── Expedition (ส่งผจญภัย) ──
  expedition: null,   // { petIds:[3], party:[{id,rarity,element,grade}], missionId, durationId, startedAt, endsAt } | null (1 สายต่อครั้ง)
  minigames: {},   // { [key]: { best, plays } } — คะแนนมินิเกม (ดู data/minigames.js)
  petsMigratedV2: false,                      // one-time: เพ็ทเก่า → species-based model ใหม่ (เกรด I-V)
  seenIntro: false,                           // one-time: เคยดูทัวร์แนะนำแอพแล้ว
  seenStudyCoach: false,                      // one-time: เคยดูวิธีใช้แฟลชการ์ดแล้ว
  // ── onboarding / identity (first-run) ──
  consent: { accepted: false, version: null, at: null },  // PDPA
  onboarded: false,        // ผ่าน wizard ผูกตัวตนแล้ว
  accountType: null,       // 'student' | 'guest'
  guestReason: null,       // เหตุผลเข้าชม (เฉพาะ guest)
  guestStatus: null,       // null | 'pending' | 'approved' | 'rejected'
}

export const STARTER_COINS = 2000
export const WELCOME_GIFT_COINS = 15000
export const WELCOME_GIFT_TICKETS = 50

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

// เก็บ instance แบบ slim — identity มาจาก catalog ตอนอ่าน (hydratePet)
export function slimPet(p) {
  return { id: p?.id, grade: p?.grade || 0, copies: p?.copies || 0 }
}

// เติม name/emoji/rarity/element จาก catalog (catalog เป็นเจ้าของ = แก้ desync)
// รับได้ทั้ง slim/fat/def หาย (fallback placeholder ไม่ให้ view พัง)
export function hydratePet(p) {
  const def = getPetDef(p?.id) || {}
  return {
    id: p?.id,
    grade: p?.grade || 0,
    copies: p?.copies || 0,
    name:    def.name    ?? p?.name    ?? '?',
    emoji:   def.emoji   ?? p?.emoji   ?? '❓',
    rarity:  def.rarity  ?? p?.rarity  ?? 'common',
    element: def.element ?? p?.element ?? 'scissors',
  }
}

/** Build the Firestore doc for a brand-new account (welcome bonus + identity). */
export function newUserDoc(user, createdAt) {
  return {
    ...USER_DEFAULTS,
    coins: STARTER_COINS,
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    googlePhoto: user.photoURL,
    createdAt,
  }
}

/**
 * Normalize a raw Firestore user doc into a complete, safe-to-render object:
 * fills every known default, repairs wrong types, deep-defaults nested
 * objects, and runs one-time migrations. Returns null for null/undefined.
 */
export function normalizeUserData(data) {
  if (!data) return null
  const d = { ...USER_DEFAULTS, ...data }

  // migration: legacy single `activePet` → `activePets` slot 0 (once)
  if (data.activePet && !(data.activePets || []).some(Boolean)) {
    d.activePets = [data.activePet, null, null]
  }

  // arrays must be arrays
  d.pets       = Array.isArray(d.pets) ? d.pets : []
  // ⚠️ FIX B1 (fable): hydrate เฉพาะ doc ที่ migrate V2 แล้ว — doc ยังไม่ migrate ต้องอ่าน "ดิบ"
  //    เพราะ migratePets (auth.js) อ่าน p.rarity (refund rarity-nerf) + p.instId (map activePets) ที่ hydrate จะทับ/ตัดทิ้ง
  //    FIX F1: filter entry null/ไม่มี id ทิ้ง กัน {id:undefined} → updateDoc throw (config ไม่ ignoreUndefined)
  if (d.petsMigratedV2 === true) d.pets = d.pets.filter(p => p && p.id).map(hydratePet)
  d.tags       = Array.isArray(d.tags) ? d.tags : []
  // ทีม 3 ตัว: ยาว 3 เสมอ (pad null / ตัดส่วนเกิน)
  const TEAM_SIZE = 3
  d.activePets = (Array.isArray(d.activePets) ? d.activePets : []).slice(0, TEAM_SIZE)
  while (d.activePets.length < TEAM_SIZE) d.activePets.push(null)

  // deep-default nested objects so a missing sub-field can't crash a view
  d.contact   = { ...USER_DEFAULTS.contact,   ...(isObj(data.contact)   ? data.contact   : {}) }
  d.residence = { ...USER_DEFAULTS.residence, ...(isObj(data.residence) ? data.residence : {}) }
  d.farm      = { ...USER_DEFAULTS.farm,      ...(isObj(data.farm)      ? data.farm      : {}) }
  d.study     = { ...USER_DEFAULTS.study,     ...(isObj(data.study)     ? data.study     : {}) }
  d.dailyQuest = { ...USER_DEFAULTS.dailyQuest, ...(isObj(data.dailyQuest) ? data.dailyQuest : {}) }
  d.pvp        = { ...USER_DEFAULTS.pvp,        ...(isObj(data.pvp)        ? data.pvp        : {}) }
  d.expedition = isObj(data.expedition) ? data.expedition : null
  d.likedBy   = isObj(data.likedBy) ? data.likedBy : {}
  d.minigames = isObj(data.minigames) ? { ...data.minigames } : {}

  return d
}
