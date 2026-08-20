import { computed } from 'vue'
import { increment, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from './useToast.js'
import { useRosterSync } from './useRosterSync.js'
import { useConfirm } from './useConfirm.js'
import {
  getTier, nextTier as nextTierOf, upgradeCostFrom, isMaxResidence,
} from '../data/residence.js'

/**
 * Residence (ที่อยู่อาศัย) logic bound to the logged-in user.
 * Reads `userData.residence.level`, drives the upgrade action with an
 * optimistic local update + Firestore write (increment coins, bump level).
 */
export function useResidence() {
  const auth = useAuthStore()
  const { toast } = useToast()
  const { syncRosterRow } = useRosterSync()
  const { confirm } = useConfirm()

  const level       = computed(() => auth.userData?.residence?.level || 1)
  const currentTier = computed(() => getTier(level.value))
  const next        = computed(() => nextTierOf(level.value))
  const isMax       = computed(() => isMaxResidence(level.value))
  const coins       = computed(() => auth.userData?.coins || 0)
  const canAfford   = computed(() => !isMax.value && coins.value >= (upgradeCostFrom(level.value) || Infinity))

  async function upgrade() {
    if (!auth.currentUser) return
    if (isMax.value) { toast('ที่อยู่อาศัยระดับสูงสุดแล้ว', 'info'); return }

    const cost = upgradeCostFrom(level.value)
    if (coins.value < cost) {
      toast(`เหรียญไม่พอ ต้องการ ${cost.toLocaleString()} เหรียญ`, 'error')
      return
    }

    const target = next.value
    const ok = await confirm(
      `อัปเกรดเป็น ${target.art} ${target.tierName}\n` +
      `ราคา ${cost.toLocaleString()}🪙 · คงเหลือ ${(coins.value - cost).toLocaleString()}🪙\n` +
      `รายได้/วัน → ${target.dailyIncome.toLocaleString()}🪙`
    )
    if (!ok) return

    const newLevel = level.value + 1
    const saved = await auth.patchUser(
      {
        coins: coins.value - cost,
        residence: { ...(auth.userData?.residence || {}), level: newLevel, upgradedAt: new Date() },
      },
      {
        coins: increment(-cost),
        'residence.level': newLevel,
        'residence.upgradedAt': serverTimestamp(),
      },
    )
    if (saved) syncRosterRow()   // เลเวลบ้านโชว์ในหน้าเพื่อน → อัปแถวตัวเอง
    toast(saved ? `อัปเกรดเป็น ${target.art} ${target.tierName} แล้ว!` : 'อัปเกรดไม่สำเร็จ', saved ? 'success' : 'error')
  }

  return { level, currentTier, next, isMax, coins, canAfford, upgrade }
}
