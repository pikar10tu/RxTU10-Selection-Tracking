// src/composables/useArena.js
// PvP สนามประลอง — orchestration core: เรต/โควต้า/พูลคู่/บุก+เขียนผล
import { computed } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useToast } from './useToast.js'
import { simulateBattle } from '../utils/battleEngine.js'
import { resolveBattleTeam } from '../utils/petTeam.js'
import { rosterOpponents } from '../utils/roster.js'
import { useRosterSync } from './useRosterSync.js'
import {
  nextRating, BOT_RATING_MULT, PVP_DAILY_ATTACKS, PVP_WIN_COIN, PVP_BOT_COIN,
} from '../utils/pvpRating.js'
import { currentSeasonId, applySeasonReset } from '../utils/pvpSeason.js'
import { getPvpBots } from '../utils/pvpBot.js'
import { pickHumanOpponents } from '../utils/pvpMatch.js'
import { hashStr } from '../utils/seededRng.js'

// คีย์วันที่รายวัน (UTC) — ใช้ toISOString ให้ตรงกับ daily-reset อื่นของแอป
// (quizCoinDate/studyCoinDate/dailyQuest ใช้ UTC เหมือนกันหมด → คงไว้เพื่อความสอดคล้อง)
const todayStr = () => new Date().toISOString().slice(0, 10)

export function useArena() {
  const auth = useAuthStore()
  const members = useMembersStore()
  const { toast } = useToast()
  const { syncRosterRow } = useRosterSync()

  // เรต/สถิติ "ตามซีซั่นปัจจุบัน" — preview soft-reset ก่อนเขียนจริง (เผื่อข้ามเดือน)
  const seasonPvp = computed(() => applySeasonReset(auth.userData?.pvp, currentSeasonId()))
  const rating    = computed(() => seasonPvp.value.rating)
  const wins      = computed(() => seasonPvp.value.wins)
  const losses    = computed(() => seasonPvp.value.losses)

  // โควต้าบุกวันนี้: รีเมื่อ pvpAttackDate != วันนี้
  const attacksLeft = computed(() => {
    const used = auth.userData?.pvpAttackDate === todayStr()
      ? (auth.userData?.pvpAttacksUsed || 0)
      : 0
    return Math.max(0, PVP_DAILY_ATTACKS - used)
  })

  // ทีมของเรา (activePets slots → battle units)
  const myTeam = computed(() =>
    resolveBattleTeam(auth.userData?.activePets, auth.userData?.pets))

  // พูลคู่ต่อสู้ = สุ่ม 5 คนจริงย่านเรตใกล้ + บอท 2 ตัว (อ่อน/แกร่ง)
  // seed = วันที่+uid → นิ่งทั้งวัน (refresh หน้าไม่สุ่มใหม่) · ข้ามวันได้พูลใหม่ · คนละคนได้คนละพูล
  // roster ให้ทีมมาพร้อมสู้แล้ว (เหมือนบอท) จึงไม่ต้องอ่าน doc คู่ต่อสู้เลย
  const opponents = computed(() => {
    const seed = hashStr(todayStr() + (auth.currentUser?.uid || ''))
    const humans = pickHumanOpponents(
      rosterOpponents(members.rosterRows || {}, auth.currentUser?.uid),
      rating.value, seed,
    )
    return [...humans, ...getPvpBots(rating.value, seed)]
  })

  // เขียนผลการสู้เข้า user doc (optimistic + server patch)
  async function applyResult(opp, won) {
    const season = currentSeasonId()
    const base = applySeasonReset(auth.userData?.pvp, season)
    const mult = opp.isBot ? BOT_RATING_MULT : 1
    const newRating = nextRating(base.rating, opp.rating, won, { mult })
    const nextPvp = {
      rating: newRating,
      wins: base.wins + (won ? 1 : 0),
      losses: base.losses + (won ? 0 : 1),
      seasonId: season,
    }
    const today = todayStr()
    const usedBefore = auth.userData?.pvpAttackDate === today
      ? (auth.userData?.pvpAttacksUsed || 0)
      : 0
    // เหรียญ: ชนะคนจริง = PVP_WIN_COIN, ชนะบอท = PVP_BOT_COIN, แพ้ = 0
    const coin = won ? (opp.isBot ? PVP_BOT_COIN : PVP_WIN_COIN) : 0
    const ok = await auth.patchUser(
      {
        pvp: nextPvp, pvpAttackDate: today, pvpAttacksUsed: usedBefore + 1,
        ...(coin ? { coins: (auth.userData?.coins || 0) + coin } : {}),
      },
      {
        pvp: nextPvp, pvpAttackDate: today, pvpAttacksUsed: usedBefore + 1,
        ...(coin ? { coins: increment(coin) } : {}),
      },
    )
    // patchUser คืน false เมื่อเขียน Firestore ล้มเหลว (+rollback optimistic แล้ว)
    // → คืน ok=false ให้ fight() ไม่โชว์ replay ลวง
    syncRosterRow()   // เรตเปลี่ยน → อัปแถวตัวเองในบอร์ด
    return { ok, newRating, delta: newRating - base.rating, coin }
  }

  // บุก: ตรวจสอบโควต้า+ทีม → จำลองการสู้ → เขียนผล → คืน replayData
  async function fight(opp) {
    if (attacksLeft.value <= 0) {
      toast('โควต้าโจมตีวันนี้หมดแล้ว พรุ่งนี้มาใหม่นะ', 'info')
      return null
    }
    if (!myTeam.value.length) {
      toast('จัดทีมก่อนนะ (อย่างน้อย 1 ตัว)', 'info')
      return null
    }
    // ทั้งบอทและคนจริงมี team resolve มาให้แล้ว (คนจริงมาจาก roster row tm)
    const oppTeam = opp.team
    if (!oppTeam?.length) {
      toast('คู่ต่อสู้ยังไม่ได้จัดทีม', 'info')
      return null
    }
    const result = simulateBattle(myTeam.value, oppTeam, Date.now())
    const won = result.winner === 'A'
    const { ok, delta, coin } = await applyResult(opp, won)
    // เขียนผลไม่สำเร็จ → toast error + ไม่โชว์ replay (เหมือน useFarm/useDaily)
    if (!ok) { toast('บันทึกผลประลองไม่สำเร็จ', 'error'); return null }
    // บอทมี 2 ตัว (อ่อน/แกร่ง) — ต้องบอกให้ชัดว่าเพิ่งสู้กับตัวไหน
    const name = opp.isBot ? `หุ่นซ้อม${opp.label ? ' (' + opp.label + ')' : ''}` : (opp.nickname || 'คู่ต่อสู้')
    const sign = delta >= 0 ? '+' : ''
    return {
      result, playerTeam: myTeam.value, botTeam: oppTeam, won, opp,
      vsLabel: `VS ${name}`,
      winText: `ชนะ! ${sign}${delta} แต้มประลอง`,
      loseText: `แพ้ ${delta} แต้มประลอง`,
      rewardText: coin ? `ได้รับ: ${coin.toLocaleString()} เหรียญ` : '',
    }
  }

  return { rating, wins, losses, attacksLeft, myTeam, opponents, fight }
}
