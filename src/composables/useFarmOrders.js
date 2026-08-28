import { computed, ref } from 'vue'
import { increment } from 'firebase/firestore'
import { useAuthStore } from '../stores/auth.js'
import { useToast } from './useToast.js'
import { useRosterSync } from './useRosterSync.js'
import { reportCheat } from './useGuard.js'
import { cropsForLevel } from '../data/crops.js'
import { createdAtMs, implausibleDelivery } from '../utils/farmPlausibility.js'
import {
  REFILL_MS, REROLL_MS, MAX_KINDS, buildOrder, canDeliver, normalizeOrders, dueSlots,
} from '../data/farmOrders.js'

/**
 * บอร์ดออเดอร์ผูกกับผู้ใช้ที่ล็อกอินอยู่
 *   farm.orders = [ {id,items,reward} | {at} ] × 5
 * Firestore แก้ array ทีละ index ไม่ได้ → เขียนทั้ง array ทุกครั้ง (เหมือน farm.plots)
 */
export function useFarmOrders() {
  const auth = useAuthStore()
  const { toast } = useToast()
  const { syncRosterRow } = useRosterSync()

  const level     = computed(() => auth.userData?.residence?.level || 1)
  const inventory = computed(() => auth.userData?.farm?.inventory || {})
  const orders    = computed(() => normalizeOrders(auth.userData?.farm?.orders, Date.now()))
  const busyId    = ref(null)     // กันกดส่งซ้ำระหว่างรอเขียน

  function cloneOrders() { return orders.value.map(o => ({ ...o })) }

  // เขียนครั้งเดียวจบเสมอ — แยกเขียนแล้วเน็ตหลุดกลางคัน = หักของแต่ไม่ได้เงิน
  // salesGain บวกเข้า farmSalesTotal เดิม (เหมือน useFarm.commit) เพื่อไม่ให้ achievement การขายฟาร์มนิ่งไป
  async function commit(next, { inventory: newInv, coinDelta = 0, salesGain = 0 } = {}) {
    const farm = { ...(auth.userData?.farm || {}), orders: next }
    if (newInv) farm.inventory = newInv
    const optimistic = { farm }
    if (coinDelta) optimistic.coins = (auth.userData?.coins || 0) + coinDelta
    if (salesGain) optimistic.farmSalesTotal = (auth.userData?.farmSalesTotal || 0) + salesGain
    const patch = { 'farm.orders': next }
    if (newInv) patch['farm.inventory'] = newInv
    if (coinDelta) patch.coins = increment(coinDelta)
    if (salesGain) patch.farmSalesTotal = increment(salesGain)
    return auth.patchUser(optimistic, patch)
  }

  /** เติมใบใหม่ให้ทุกช่องที่ถึงเวลา · ไม่มีช่องถึงเวลา = ไม่เขียนอะไรเลย */
  async function refillDue() {
    if (!auth.userData) return false   // onboarding gate ปกติกันไว้แล้ว แต่กันเผื่อหลุดมาได้จากที่อื่น
    const now = Date.now()
    const due = dueSlots(orders.value, now)
    if (!due.length) return false
    const crops = cropsForLevel(level.value)
    if (!crops.length) return false
    const next = cloneOrders()
    let filled = 0
    for (const i of due) {
      const o = buildOrder(now + i, crops, now)   // seed ต่างกันต่อช่อง → ใบไม่ซ้ำกัน
      if (o) { next[i] = o; filled++ }
    }
    if (!filled) return false
    return commit(next)
  }

  async function deliver(i) {
    const o = orders.value[i]
    if (!o?.items || busyId.value) return false
    if (!canDeliver(o, inventory.value)) { toast('ผลผลิตยังไม่พอส่งออเดอร์นี้', 'info'); return false }

    // กับดัก: บันทึกอย่างเดียว ห้ามขวางผู้เล่นไม่ว่ากรณีใด
    const bad = implausibleDelivery(o.items, {
      createdMs: createdAtMs(auth.userData?.createdAt),
      plotsUnlocked: auth.userData?.farm?.plotsUnlocked,
      now: Date.now(),
    })
    if (bad.length) {
      reportCheat('order-delivery-impossible', bad.map(b => `${b.cropId}=${b.need}/max${b.max}`).join(' '))
    }

    busyId.value = o.id
    const inv = { ...inventory.value }
    for (const [id, qty] of Object.entries(o.items)) {
      const left = (Number(inv[id]) || 0) - Number(qty)
      if (left > 0) inv[id] = left; else delete inv[id]
    }
    const next = cloneOrders()
    next[i] = { at: Date.now() + REFILL_MS }
    const gain = Number(o.reward?.coins) || 0

    const ok = await commit(next, { inventory: inv, coinDelta: gain, salesGain: gain })
    busyId.value = null
    if (ok) toast(`ส่งออเดอร์แล้ว +${gain.toLocaleString()} เหรียญ`, 'success')
    else toast('ส่งออเดอร์ไม่สำเร็จ', 'error')
    // ข่าวกระดาน: ออเดอร์ครบ 3 ชนิด = ออเดอร์ใหญ่
    // ใช้เกณฑ์เชิงโครงสร้าง ไม่ผูกกับเหรียญ เพราะเหรียญเฟ้อตามเลเวลบ้าน (พืชแพงขึ้น)
    if (ok && Object.keys(o.items || {}).length >= MAX_KINDS) {
      syncRosterRow({ event: { k: 'fo', v: gain, t: Date.now() } })
    }
    return ok
  }

  async function reroll(i) {
    const o = orders.value[i]
    if (!o?.items || busyId.value) return false
    busyId.value = o.id
    const next = cloneOrders()
    next[i] = { at: Date.now() + REROLL_MS }
    const ok = await commit(next)
    busyId.value = null
    if (ok) toast('ทิ้งออเดอร์แล้ว รอใบใหม่', 'info')
    else toast('ทิ้งออเดอร์ไม่สำเร็จ', 'error')
    return ok
  }

  return { orders, inventory, busyId, refillDue, deliver, reroll }
}
