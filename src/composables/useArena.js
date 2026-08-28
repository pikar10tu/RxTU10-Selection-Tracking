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
import { rankOfScore } from '../utils/newsFeed.js'
import { useRosterSync } from './useRosterSync.js'
import {
  nextRating, BOT_RATING_MULT, PVP_DAILY_ATTACKS, PVP_RATING_START,
} from '../utils/pvpRating.js'
import { currentSeasonId, applySeasonReset } from '../utils/pvpSeason.js'
import { getFallbackBots } from '../utils/pvpBot.js'
import { pickHumanOpponents, BOARD_SIZE } from '../utils/pvpMatch.js'
import { teamPower, coinForResult } from '../utils/pvpCoins.js'
import { boardSeed, canRefresh, refreshLeftMs } from '../utils/pvpBoard.js'

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

  // พลังทีมเรา — ฐานของทั้งการจ่ายเหรียญและการเล็งบอท
  const myPower = computed(() => teamPower(myTeam.value))

  // nonce ของกระดาน: ขยับเมื่อบุกจบ 1 ครั้ง หรือกดปุ่มรี · เก็บใน user doc ไม่ใช่ใน component
  // ⇒ โหลดหน้าใหม่ได้กระดานเดิม (ไม่งั้นกด F5 รัวๆ = รีฟรีไม่จำกัด cooldown ไร้ความหมาย)
  const boardNonce = computed(() => auth.userData?.pvpBoardNonce || 0)

  // กระดาน 5 ช่อง = เท่าโควตาบุก/วัน · คนจริงก่อน บอทเติมเฉพาะช่องที่ขาด
  // roster ให้ทีมมาพร้อมสู้แล้ว (เหมือนบอท) จึงไม่ต้องอ่าน doc คู่ต่อสู้เลย
  const opponents = computed(() => {
    const uid = auth.currentUser?.uid
    const seed = boardSeed(todayStr(), uid, boardNonce.value)
    const humans = pickHumanOpponents(
      rosterOpponents(members.rosterRows || {}, uid), rating.value, seed,
    )
    const bots = getFallbackBots(myPower.value, rating.value, seed, BOARD_SIZE - humans.length)
    return [...humans, ...bots]
  })

  // เหรียญที่จะได้ถ้าชนะคนนี้ — โชว์บนการ์ดให้เลือกได้ว่าจะเล่นปลอดภัยหรือกล้าเสี่ยง
  const coinPreview = (opp) => coinForResult(myPower.value, teamPower(opp?.team), true)

  // cooldown ปุ่มรีเฟรช (ms ที่เหลือ · 0 = กดได้)
  const refreshLeft = computed(() => refreshLeftMs(auth.userData?.pvpRefreshAt, Date.now()))

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
    // เหรียญตามส่วนต่างพลังทีม · แพ้ให้คนแกร่งกว่ายังได้ปลอบใจ (ดู pvpCoins)
    const coin = coinForResult(myPower.value, teamPower(opp.team), won)
    // ⚠️ CLAUDE.md ข้อ 9 — หยิบค่าก่อนเรียก patchUser (หลังเรียกแล้ว computed จะเป็นค่าใหม่ทันที)
    const nextNonce = (auth.userData?.pvpBoardNonce || 0) + 1   // บุกจบ = กระดานชุดใหม่
    const ok = await auth.patchUser(
      {
        pvp: nextPvp, pvpAttackDate: today, pvpAttacksUsed: usedBefore + 1,
        pvpBoardNonce: nextNonce,
        ...(coin ? { coins: (auth.userData?.coins || 0) + coin } : {}),
      },
      {
        // ใช้ค่าตรงๆ ไม่ใช้ increment() — ให้ตรงกับ optimistic เป๊ะ กัน seed กระดานกระพริบ
        pvp: nextPvp, pvpAttackDate: today, pvpAttacksUsed: usedBefore + 1,
        pvpBoardNonce: nextNonce,
        ...(coin ? { coins: increment(coin) } : {}),
      },
    )
    // patchUser คืน false เมื่อเขียน Firestore ล้มเหลว (+rollback optimistic แล้ว)
    // → คืน ok=false ให้ fight() ไม่โชว์ replay ลวง
    // เรตเปลี่ยน → อัปแถวตัวเองในบอร์ด · พ่วงประวัติการบุกไปในการเขียนครั้งเดียวกัน
    // บอทข้าม: ไม่มีแถวใน roster และไม่มีใครต้องเห็นฝั่งตั้งรับของบอท
    // ข่าวกระดาน: อันดับเรตในรุ่นดีขึ้นและติด 10 อันดับแรก — เทียบจาก rosterRows ที่ถืออยู่แล้ว (ไม่มี read เพิ่ม)
    const rows = members.rosterRows || {}
    const uid = auth.currentUser?.uid || null
    const pickRating = (r) => r?.r ?? PVP_RATING_START
    const prevRank = rankOfScore(rows, uid, pickRating, base.rating)
    const newRank  = rankOfScore(rows, uid, pickRating, newRating)
    syncRosterRow({
      history: opp.isBot ? null : { u: opp.uid, w: won ? 1 : 0, c: coin, t: Date.now() },
      event: (newRank < prevRank && newRank <= 10) ? { k: 'pv', v: newRank, t: Date.now() } : null,
    })
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

  // กดรีเฟรชกระดานเอง — ฟรีแต่มี cooldown (การรีที่ได้จากการบุกจ่ายด้วยโควตาไปแล้ว)
  async function refreshBoard() {
    if (!canRefresh(auth.userData?.pvpRefreshAt, Date.now())) {
      const min = Math.ceil(refreshLeft.value / 60000)
      toast(`เปลี่ยนคู่ต่อสู้ได้อีกครั้งในอีก ${min} นาที`, 'info')
      return false
    }
    const now = Date.now()
    const nextNonce = (auth.userData?.pvpBoardNonce || 0) + 1
    const patch = { pvpBoardNonce: nextNonce, pvpRefreshAt: now }
    const ok = await auth.patchUser(patch, patch)
    if (!ok) toast('เปลี่ยนคู่ต่อสู้ไม่สำเร็จ', 'error')
    return ok
  }

  return {
    rating, wins, losses, attacksLeft, myTeam, opponents, fight,
    refreshBoard, refreshLeft, coinPreview,
  }
}
