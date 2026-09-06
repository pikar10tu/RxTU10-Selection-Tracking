import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { R_SCI, R_CARE, RN } from '../data/students.js'
import { normalizeUserData } from '../data/userSchema.js'
import { readCache, slimForCache, MEMBERS_CACHE_KEY, MEMBERS_CACHE_TTL } from '../utils/membersCache.js'
import { useUsageStore } from './usage.js'
import { stripTrailingEmoji } from '../utils/text.js'
import { rosterToMembers } from '../utils/roster.js'
import { memberBucket, memberKey } from '../utils/memberIndex.js'

export const useMembersStore = defineStore('members', () => {
    const fbUsers    = ref({})   // { studentId (หรือ uid ถ้ายังไม่ผูกรหัส): userObject }
    const students   = ref([])   // all students from static data
    const guestUsers = ref([])
    const loading    = ref(false)
    const fbSkipped  = ref(0)    // จำนวน user doc ที่ข้ามในรอบล่าสุด (doc เปล่า ไม่มีทั้งรหัสและชื่อเล่น)
                                 // ⚠️ ค่าจริงเฉพาะรอบที่ยิง Firestore — hydrate จาก cache ไม่รู้เลขนี้

    // ── เส้นทาง roster (ทุกจอของนักศึกษา) — 1 read ต่อเซสชัน ──
    // แยกจาก fbUsers/loadFbUsers ที่เป็นของ AdminView เท่านั้น (ต้องการ doc เต็ม)
    const rosterRows    = ref({})   // { uid: row } — ดิบ ใช้โดย Arena/sync
    const rosterUsers   = ref({})   // { studentId: member }
    const rosterGuests  = ref([])
    const rosterReady   = ref(false)
    const rosterMissing = ref(false) // doc ยังไม่ถูกสร้าง → ให้ UI บอกแอดมินกดสร้าง
    const rosterLoading = ref(false)

    // Build student list from static data (runs once)
    function initStudents() {
        const parse = (s, track) => { const [nick, rest] = s.split(' ('); return { nickname: stripTrailingEmoji(nick), id: rest.replace(')', ''), track } }
        const sci  = R_SCI.map(s  => parse(s, 'sci'))
        const care = R_CARE.map(s => parse(s, 'care'))
        const names = RN.split(/(?=นาย|นางสาว)/).filter(n => n.trim()).map(n => n.replace(/^นาย|^นางสาว/, '').trim())
        // ⚠️ RN ถูกเขียนเรียงตาม id ascending ของทุกคน (Sci+Care รวม) มาตั้งแต่ต้น
        //    → จึงต้อง sort all ตาม id ก่อน แล้วค่อย map ชื่อด้วย index ให้ตรงลำดับ
        //    ถ้าแก้ลำดับ RN หรือเอา sort ออก ชื่อจริงจะเลื่อนผิดคนทั้งหมด (ดู v1 app.js)
        const all = [...sci, ...care].sort((a, b) => a.id.localeCompare(b.id))
        all.forEach((s, i) => { s.realName = names[i] || 'ไม่ระบุ' })
        students.value = all
    }

    // อ่าน cache localStorage → hydrate in-memory ถ้าสด + shape ถูก (คืน true = ใช้ได้)
    function hydrateFromCache() {
        try {
            const hit = readCache(localStorage.getItem(MEMBERS_CACHE_KEY), Date.now(), MEMBERS_CACHE_TTL)
            if (!hit) return false
            fbUsers.value    = hit.fbUsers
            guestUsers.value = hit.guestUsers
            return true
        } catch { return false }
    }

    function writeCache() {
        try {
            const slim = slimForCache(fbUsers.value, guestUsers.value)
            localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), ...slim }))
        } catch { /* localStorage เต็ม/ปิด — ไม่เป็นไร รอบหน้าค่อยยิง Firestore */ }
    }

    // คำขอที่กำลังบินอยู่ — คนที่เรียกซ้อนต้อง "รอคิวเดิม" ไม่ใช่เด้งกลับมือเปล่า
    // (useRosterSync รอตัวนี้ก่อนเขียน ถ้าเด้งกลับทั้งที่ยังไม่มีข้อมูล มันจะข้ามการเขียนไปเฉยๆ)
    let rosterInflight = null
    function loadRoster({ force = false } = {}) {
        if (rosterInflight) return rosterInflight
        if (!force && rosterReady.value) return Promise.resolve()
        rosterInflight = runLoadRoster().finally(() => { rosterInflight = null })
        return rosterInflight
    }

    async function runLoadRoster() {
        rosterLoading.value = true
        try {
            const snap = await getDoc(doc(db, 'roster', 'current'))
            useUsageStore().track(1)
            if (!snap.exists()) {
                // ⚠️ ห้าม fallback ไป getDocs ทั้ง collection — นั่นคือปัญหาที่กำลังแก้อยู่
                rosterMissing.value = true
                return
            }
            rosterMissing.value = false
            const rows = snap.data()?.rows || {}
            rosterRows.value = rows
            const { byStudentId, guests } = rosterToMembers(rows)
            rosterUsers.value  = byStudentId
            rosterGuests.value = guests
            rosterReady.value  = true
        } catch (e) {
            console.error('[roster]', e)
        } finally {
            rosterLoading.value = false
        }
    }

    // ── โปรไฟล์รายคน (ของหนัก: pets/contact) — อ่านตอนกดดูเท่านั้น + จำในเซสชัน ──
    const profiles = ref({})
    async function loadProfile(uid) {
        if (!uid) return null
        if (profiles.value[uid]) return profiles.value[uid]
        try {
            const snap = await getDoc(doc(db, 'users', uid))
            useUsageStore().track(1)
            if (!snap.exists()) return null
            const full = normalizeUserData(snap.data())
            profiles.value = { ...profiles.value, [uid]: { ...full, uid } }
            return profiles.value[uid]
        } catch (e) {
            console.error('[profile]', e)
            return null
        }
    }

    // ⚠️ อ่าน users ทั้ง collection = N reads — **เฉพาะ AdminView เท่านั้น**
    //    (triage guest / econ editor ต้องเห็น doc เต็ม) · จอของนักศึกษาใช้ loadRoster()
    //    ถ้าเผลอเรียกจากจอนักศึกษา ต้นทุนจะกลับไปเป็น O(N²) เหมือนเดิม
    // { force } = true → ข้าม cache ยิง Firestore สดเสมอ (ปุ่ม ↻ / Admin triage)
    async function loadFbUsers({ force = false } = {}) {
        if (loading.value) return
        // in-memory มีแล้ว + ไม่ force → ข้าม (กันยิงซ้ำในเซสชันเดียว)
        if (!force && Object.keys(fbUsers.value).length) return
        // cache ข้ามเซสชันสด + ไม่ force → hydrate ไม่ยิง Firestore
        if (!force && hydrateFromCache()) return
        loading.value = true
        try {
            const snap = await getDocs(collection(db, 'users'))
            useUsageStore().track(snap.size) // ตัวถ่วง read หลัก — นับเข้าตัวประมาณการ
            const newFb = {}
            const guests = []
            let skipped = 0
            snap.forEach(d => {
                const x = d.data()
                // doc เปล่าจริงๆ (ยังไม่ผ่าน onboarding เลย) — ข้ามได้ แต่ต้องนับให้เห็น
                if (!x.studentId && !x.nickname) { skipped++; return }
                // normalize first → canonical defaults + deep-defaulted nested
                // objects, then keep only the light subset the member views need.
                const n = normalizeUserData(x)
                const light = {
                    uid: d.id,
                    studentId: n.studentId,
                    nickname: stripTrailingEmoji(n.nickname || n.name?.split(' ')[0]) || '?',
                    realName: n.realName,
                    email: n.email,
                    role: n.role,
                    track: n.track,
                    accountType: n.accountType,
                    guestStatus: n.guestStatus,
                    guestReason: n.guestReason,
                    coins: n.coins,
                    pets: n.pets,
                    activePets: n.activePets,
                    residence: n.residence,
                    founder: n.founder === true,
                    tags: n.tags,
                    pvpVictories: n.pvpVictories,
                    towerBest: n.towerBest,
                    pvp: n.pvp,
                    minigames: n.minigames,
                    quizHigh: n.quizHigh,
                    drugHigh: n.drugHigh,
                    googlePhoto: n.googlePhoto,
                    customPhoto: n.customPhoto,
                    contact: n.contact,
                    likes: n.likes,
                    likedBy: n.likedBy,
                }
                // 🔴 ห้ามกลับไปเป็น `else if (n.studentId)` — คนที่ผ่าน onboarding แต่ยังไม่ผูกรหัส
                //    จะตกทั้งสองช่องแล้วหายเงียบ (ไม่ได้รับ broadcast + ไม่โผล่ในแผงแอดมิน)
                //    ดูเหตุผลเต็มใน utils/memberIndex.js
                if (memberBucket(n) === 'guest') guests.push(light)
                else newFb[memberKey(n, d.id)] = light
            })
            fbUsers.value    = newFb
            guestUsers.value = guests
            fbSkipped.value  = skipped
            writeCache() // เก็บ light subset ไว้ใช้ข้ามเซสชัน
        } catch (e) {
            console.error('[members]', e)
        } finally {
            loading.value = false
        }
    }

    return {
        fbUsers, students, guestUsers, loading, fbSkipped, initStudents, loadFbUsers,   // ← AdminView เท่านั้น
        rosterRows, rosterUsers, rosterGuests, rosterReady, rosterMissing, rosterLoading, loadRoster,
        profiles, loadProfile,
    }
})
