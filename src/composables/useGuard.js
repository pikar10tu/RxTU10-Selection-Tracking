import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { MAX_RESIDENCE_LEVEL } from '../data/residence.js'
import { createdAtMs, implausibleStock } from '../utils/farmPlausibility.js'

// Rough, honor-based integrity trip-wire (client-only app — can't truly prevent
// console tampering; this catches impossible values that slip through and logs
// them for the admin). Firestore rules are the real deterrent.

export const COIN_CEILING = 50_000_000

const _reported = new Set() // de-dupe within a session

/** Fire-and-forget cheat report to /cheatLogs (admin-readable). */
export async function reportCheat(reason, detail = '') {
  const auth = useAuthStore()
  if (!auth.currentUser) return
  if (_reported.has(reason)) return
  _reported.add(reason)
  try {
    await addDoc(collection(db, 'cheatLogs'), {
      uid: auth.currentUser.uid,
      name: auth.userData?.nickname || auth.userData?.name || auth.currentUser.email || '?',
      reason,
      detail: String(detail).slice(0, 300),
      ua: navigator.userAgent.slice(0, 200),
      ts: serverTimestamp(),
    })
  } catch (e) {
    // logging must never throw into the app
    console.warn('[guard] could not write cheat log', e?.code)
  }
}

/** Check the loaded userData for impossible values and report once. */
export function runIntegrityCheck(userData) {
  if (!userData) return
  const coins = userData.coins || 0
  if (coins > COIN_CEILING) reportCheat('coins-over-ceiling', `coins=${coins}`)
  if (coins < 0)            reportCheat('coins-negative', `coins=${coins}`)

  const lvl = userData.residence?.level
  if (typeof lvl === 'number' && (lvl > MAX_RESIDENCE_LEVEL || lvl < 1)) {
    reportCheat('residence-out-of-range', `level=${lvl}`)
  }

  // ผลผลิตในกล่องเกินกว่าที่จะปลูกทันตลอดอายุบัญชี → บันทึกไว้ให้แอดมินดู (ไม่ขวางผู้เล่น)
  const badStock = implausibleStock(userData.farm?.inventory, {
    createdMs: createdAtMs(userData.createdAt),
    plotsUnlocked: userData.farm?.plotsUnlocked,
    now: Date.now(),
  })
  if (badStock.length) {
    reportCheat('farm-stock-impossible', badStock.map(b => `${b.cropId}=${b.have}/max${b.max}`).join(' '))
  }
}

export function useGuard() {
  return { reportCheat, runIntegrityCheck }
}
