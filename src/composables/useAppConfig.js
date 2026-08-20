import { ref } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { isFeatureOpen } from '../utils/featureFlags.js'

// ════════════════════════════════════════════════════════════
//  Launch gate via Firestore — `config/app { maintenance: bool }`
//
//  Why: the gate used to be hardcoded in App.vue, so opening/closing the
//  app to the whole class required a redeploy. Reading it from Firestore
//  (live via onSnapshot) lets an admin flip it instantly from the Admin tab.
//
//  Default LOCKED (maintenance = true) until the config loads / if the doc
//  is missing — safe failure mode (only admin/academic get in by accident).
//  The doc is PUBLIC-read (just a boolean) so the listener also works before
//  login and survives a desktop popup login without a page reload.
// ════════════════════════════════════════════════════════════

const maintenance  = ref(true)
const pvpOpen      = ref(false)   // สนามประลองเปิดให้ทุกคนบุกหรือยัง (admin toggle)
const expeditionOpen = ref(false)  // ส่งผจญภัย — ปิดไว้ก่อน (โฟกัสเพ็ท+ฟาร์ม 21 ส.ค.)
const arcadeOpen     = ref(false)  // มินิเกม 3 ตัว — ไม่คุมตัวฝึก CrCl ที่ใช้โครงเดียวกัน
const rawConfig      = ref(null)   // ข้อมูลดิบ ให้ router guard เช็คพร้อม isAdmin เองได้
const configLoaded = ref(false)
let _started = false

export function initAppConfig() {
  if (_started) return
  _started = true
  onSnapshot(
    doc(db, 'config', 'app'),
    (snap) => {
      const d = snap.data()
      rawConfig.value = d || null
      // missing doc → stay locked (safe default)
      maintenance.value = d ? d.maintenance !== false : true
      // ทุก flag ผ่านกฎเดียวกันใน utils/featureFlags.js — default ปิด จนกว่า admin เปิด
      pvpOpen.value        = isFeatureOpen(d, 'pvpOpen')
      expeditionOpen.value = isFeatureOpen(d, 'expeditionOpen')
      arcadeOpen.value     = isFeatureOpen(d, 'arcadeOpen')
      configLoaded.value = true
    },
    (e) => { console.error('[appConfig]', e); configLoaded.value = true },
  )
}

export function useAppConfig() {
  return { maintenance, configLoaded, pvpOpen, expeditionOpen, arcadeOpen, rawConfig }
}
