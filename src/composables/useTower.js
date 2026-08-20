import { computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from './useToast.js'
import { useRosterSync } from './useRosterSync.js'
import { simulateBattle } from '../utils/battleEngine.js'
import { getFloorTeam, getTowerBonus, TOWER_MAX } from '../data/towerFloors.js'
import { resolveBattleTeam } from '../utils/petTeam.js'
import { doc, setDoc, increment, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { computeBattleStats } from '../utils/battleStats.js'
import { useUsageStore } from '../stores/usage.js'

export function useTower() {
  const auth = useAuthStore()
  const { toast } = useToast()
  const { syncRosterRow } = useRosterSync()

  const floor = computed(() => auth.userData?.towerFloor || 1)
  const best  = computed(() => auth.userData?.towerBest || 0)
  const team  = computed(() => resolveBattleTeam(auth.userData?.activePets, auth.userData?.pets))
  const botTeam = computed(() => getFloorTeam(floor.value))
  const bonus = computed(() => getTowerBonus(best.value))

  // best-effort: เขียนสถิติราย species (increment-only) — fail เงียบ ไม่ขวางการเล่น
  async function recordStats(result, playerTeam, won) {
    try {
      const stats = computeBattleStats(result.log, playerTeam, won)
      const ids = Object.keys(stats)
      if (!ids.length) return
      const batch = writeBatch(db)
      for (const id of ids) {
        const s = stats[id]
        batch.set(doc(db, 'battleStats', id), {
          battles: increment(s.battles), wins: increment(s.wins),
          kills: increment(s.kills), deaths: increment(s.deaths),
          dmgDealt: increment(s.dmgDealt), dmgTaken: increment(s.dmgTaken),
        }, { merge: true })
      }
      await batch.commit()
      useUsageStore().track(0, ids.length)
    } catch (e) { console.error('[battleStats]', e) }
  }

  async function fight() {
    if (!team.value.length) { toast('จัดทีมก่อนนะ (อย่างน้อย 1 ตัว)', 'info'); return null }
    const cleared = floor.value
    const seed = Date.now()
    const result = simulateBattle(team.value, botTeam.value, seed)
    const won = result.winner === 'A'
    await recordStats(result, team.value, won)
    if (won) {
      const nextFloor = Math.min(TOWER_MAX, cleared + 1)
      const nextBest = Math.max(best.value, cleared)
      await auth.patchUser(
        { towerFloor: nextFloor, towerBest: nextBest },
        { towerFloor: nextFloor, towerBest: nextBest },
      )
      syncRosterRow()   // อัปแถวตัวเองในบอร์ด (เขียนเฉพาะตอนค่าเปลี่ยนจริง)
    }
    return { result, botTeam: botTeam.value, playerTeam: team.value, won, cleared }
  }

  return { floor, best, team, botTeam, bonus, fight, TOWER_MAX }
}
