import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useUsageStore } from '../stores/usage.js'
import { cleanText } from '../utils/text.js'

/** ความยาวสูงสุดของข้อความข่าว — ต้องตรงกับ firestore.rules (msg.size() <= 140) */
export const NEWS_MSG_MAX = 140

/** ชนิดที่ rules ยอมให้ผู้เล่นโพสต์ — เพิ่มที่นี่แล้วต้องเพิ่มใน firestore.rules ด้วย (แล้ว deploy) */
export const NEWS_TYPES = ['achievement', 'legendary', 'tower100', 'record1']

/**
 * เลน "ข่าวอยู่ยาว" ของกระดานข่าว — ครั้งแรก/ที่หนึ่งของรุ่นเท่านั้น
 *
 * เลนนี้เป็น 1 write ต่อข่าวและ**ไม่มีเพดานต่อคน** จึงต้องยิงจากเหตุการณ์ที่เกิดยากจริง
 * ข่าวประจำวันให้ไปเลน roster (`syncRosterRow({ event })`) ที่คนหนึ่งกินได้มากสุด 3 ช่อง
 *
 * ⚠️ คีย์ต้องเป็น ['msg','icon','type','uid','ts'] เป๊ะ — rules ใช้ hasOnly()
 * ⚠️ ข้อความไปโผล่บนจอคนอื่น จึงต้องผ่าน cleanText เสมอ (ฝั่งอ่านใช้ {{ }} ห้าม v-html)
 * ล้มเหลว = เงียบ ไม่ toast ไม่ retry (ข่าวหายไม่กระทบการเล่น)
 *
 * spec: docs/superpowers/specs/2026-08-28-news-board-live-design.md
 */
export function useNewsPost() {
  async function postNews({ type, icon = '📢', msg }) {
    const auth = useAuthStore()
    const uid = auth.currentUser?.uid
    const text = cleanText(msg, NEWS_MSG_MAX)
    if (!uid || !text || !NEWS_TYPES.includes(type)) return false
    try {
      await addDoc(collection(db, 'news'), { msg: text, icon, type, uid, ts: serverTimestamp() })
      useUsageStore().track(0, 1)
      return true
    } catch (e) { console.warn('[news post]', e?.code || e); return false }
  }

  /** ชื่อที่ใช้ขึ้นต้นข่าว — ข่าวเลนนี้เก็บเป็นข้อความสำเร็จรูป จึงต้องฝังชื่อไปเลย */
  function myName() {
    const u = useAuthStore().userData
    return u?.nickname || u?.name?.split(' ')[0] || 'เพื่อนเรา'
  }

  return { postNews, myName }
}
