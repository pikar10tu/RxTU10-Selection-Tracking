import { ref, computed, onScopeDispose } from 'vue'
import { increment, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from './useToast.js'
import { residenceDailyIncome } from '../data/residence.js'
import { totalPetDaily } from '../utils/petUtils.js'
import { getTowerBonus } from '../data/towerFloors.js'
import { questIncomeMult, BUFF_MS } from '../utils/dailyQuest.js'
import { accruedCoins, effectiveLastMs } from '../utils/idleIncome.js'

const DAY_MS = 24 * 60 * 60 * 1000
const BUFF_MULT = 1.5   // ต้องตรงกับ questIncomeMult

// เวลาที่ "กดเก็บสำเร็จ" ครั้งล่าสุดในเซสชันนี้ (module-scope = ใช้ร่วมทุก instance)
// แนวกันที่สองไม่ให้บาร์เต็มใหม่ถ้า lastDaily ใน doc หาย/ย้อนหลังด้วยเหตุใดก็ตาม
// (ตัวหลักแก้ที่ auth.js — snapshot อ่านแบบ serverTimestamps:'estimate')
// ผูก uid ไว้ด้วย: สลับบัญชีในแท็บเดิมต้องไม่เอาเวลาของคนก่อนหน้ามากั้น
let _lastClaim = { uid: null, ms: 0 }

/**
 * Idle income: residence + stored-pet income accrues hourly, capped at 24h.
 *   ratePerDay = (residence dailyIncome + Σ petDaily × residence pet-bonus%) × supporter bonus × buff
 *   accrued    = ratePerDay × min(elapsed, 24h) / 24h   (collect anytime)
 * Beyond 24h it stops accruing (the overflow is lost → come back daily!).
 * `lastDaily` on the user doc = last collection time.
 */
export function useDaily() {
  const auth = useAuthStore()
  const { toast } = useToast()

  const level      = computed(() => auth.userData?.residence?.level || 1)
  const baseIncome = computed(() => residenceDailyIncome(level.value))
  const petIncome  = computed(() => totalPetDaily(auth.userData?.pets))
  const towerBonus = computed(() => getTowerBonus(auth.userData?.towerBest || 0))
  const bonusPct   = computed(() => auth.incomeBonusPct)

  // live clock (ticks for the accrual bar/amount)
  const now = ref(Date.now())
  const timer = setInterval(() => { now.value = Date.now() }, 1000)
  onScopeDispose(() => clearInterval(timer))

  const buffMult   = computed(() => questIncomeMult(auth.userData, now.value))
  const buffActive = computed(() => buffMult.value > 1)
  // เรท/วัน ก่อนบัฟ — ใช้คิดรายได้สะสมแบบแยกช่วงบัฟ (ดู accruedCoins)
  const baseRatePerDay = computed(() => Math.round((baseIncome.value + petIncome.value + towerBonus.value) * (1 + bonusPct.value / 100)))
  // เรท/วัน ปัจจุบัน (รวมบัฟ) — สำหรับโชว์บน UI เท่านั้น
  const ratePerDay = computed(() => Math.round(baseRatePerDay.value * buffMult.value))
  const ratePerHour = computed(() => Math.round(ratePerDay.value / 24))

  /** เวลาเก็บล่าสุดจาก user doc (ms) — null ถ้าไม่มี/อ่านไม่ออก */
  function docLastMs() {
    const l = auth.userData?.lastDaily
    if (!l) return null
    let ms = null
    if (typeof l.toMillis === 'function') ms = l.toMillis()
    else if (typeof l.toDate === 'function') ms = l.toDate().getTime()
    else ms = new Date(l).getTime()
    return Number.isFinite(ms) ? ms : null
  }

  function lastMs() {
    const mine = _lastClaim.uid === auth.currentUser?.uid ? _lastClaim.ms : 0
    const eff = effectiveLastMs(docLastMs(), mine)
    return eff === null ? now.value - DAY_MS : eff   // never collected → start full
  }

  const elapsedMs   = computed(() => Math.max(0, Math.min(DAY_MS, now.value - lastMs())))
  const fillPct     = computed(() => Math.min(100, (elapsedMs.value / DAY_MS) * 100))
  // คิดบัฟ ×1.5 เฉพาะช่วงที่บัฟ active จริง (ไม่ย้อนหลังทั้งก้อน)
  // legacy fallback: user เก่าที่มีแต่ incomeBuffUntil → เดา from = until − 24ชม.
  const accrued     = computed(() => {
    const until = auth.userData?.incomeBuffUntil || 0
    const from  = auth.userData?.incomeBuffFrom || (until ? until - BUFF_MS : 0)
    return accruedCoins({
      baseRatePerDay: baseRatePerDay.value, lastMs: lastMs(), now: now.value,
      buffFrom: from, buffUntil: until, buffMult: BUFF_MULT,
    })
  })
  const isFull      = computed(() => elapsedMs.value >= DAY_MS)
  const remainingMs = computed(() => Math.max(0, DAY_MS - elapsedMs.value))

  async function claim() {
    if (!auth.currentUser) return
    const amount = accrued.value
    if (amount < 1) { toast('ยังไม่มีรายได้สะสม รออีกหน่อยนะ', 'info'); return }
    // จดเวลาเก็บไว้ก่อน (synchronous) → บาร์เป็น 0 ทันทีตั้งแต่กดครั้งแรก
    // กันทั้งกดรัวๆ และ snapshot ที่มาทีหลังแล้วทำ lastDaily หาย
    const prevClaim = _lastClaim
    _lastClaim = { uid: auth.currentUser.uid, ms: Date.now() }
    const ok = await auth.patchUser(
      { coins: (auth.userData?.coins || 0) + amount, lastDaily: new Date() },
      { coins: increment(amount), lastDaily: serverTimestamp() },
    )
    if (!ok) _lastClaim = prevClaim   // เขียนไม่สำเร็จ = ยังไม่ได้เก็บ คืนสิทธิ์ให้กดใหม่
    toast(ok ? `เก็บรายได้ +${amount.toLocaleString()} เหรียญ` : 'เก็บรายได้ไม่สำเร็จ', ok ? 'success' : 'error')
  }

  return {
    baseIncome, petIncome, towerBonus, bonusPct, buffActive, buffMult, ratePerDay, ratePerHour,
    accrued, fillPct, isFull, remainingMs, claim,
  }
}
