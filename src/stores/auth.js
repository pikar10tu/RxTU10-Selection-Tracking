import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    signInWithPopup, signInWithRedirect, getRedirectResult,
    signOut, onAuthStateChanged,
} from 'firebase/auth'
import {
    doc, getDoc, setDoc, updateDoc, onSnapshot, writeBatch,
    serverTimestamp, increment,
} from 'firebase/firestore'
import { auth, db, provider, ADMIN_EMAIL, SNAPSHOT_DELAY, CONSENT_VERSION } from '../firebase/config.js'
import { incomeBonusFromTags, effectiveTags } from '../data/tags.js'
import { newUserDoc, normalizeUserData, slimPet } from '../data/userSchema.js'
import { buildWelcomeGiftMail } from '../utils/mailbox.js'
import { useToast } from '../composables/useToast.js'
import { useUsageStore } from './usage.js'
import { migratePets } from '../utils/petMigration.js'
import { PETS, getPetDef } from '../data/index.js'
import { matchRoster } from '../utils/onboarding.js'
import { useMembersStore } from './members.js'
import { cleanText, LIMITS } from '../utils/text.js'
import { isPopupClosedCode, shouldWarnPopupClosed } from '../utils/authError.js'

export const useAuthStore = defineStore('auth', () => {
    // ── State ──
    const currentUser = ref(null)
    const userData    = ref(null)
    const loading     = ref(true)
    let   _unsub      = null

    // ── Getters ──
    const isLoggedIn = computed(() => !!currentUser.value)
    // ADMIN_EMAIL is the bootstrap super-admin (can never be locked out);
    // a 'admin' role on the user doc also grants admin.
    const isAdmin    = computed(() =>
        currentUser.value?.email === ADMIN_EMAIL || userData.value?.role === 'admin')
    // Academic team (admin OR academic) — gates question editing.
    const isAcademic = computed(() =>
        isAdmin.value || userData.value?.role === 'academic')
    // Instructor — อาจารย์ (เข้ามาเป็น guest) ที่แก้คลังข้อสอบได้ แต่ไม่ใช่ isAcademic
    // (จึงเสกจดหมาย/แจกเหรียญ/broadcast/ตัดสิน report ไม่ได้)
    const isInstructor = computed(() => userData.value?.role === 'instructor')
    // Gate แก้คลังข้อสอบ + คอมเมนต์ (ทีมวิชาการ OR อาจารย์)
    const isQuestionEditor = computed(() => isAcademic.value || isInstructor.value)
    const isLinked   = computed(() => !!userData.value?.studentId)
    // daily-income bonus % from tags (e.g. supporter +20%)
    const incomeBonusPct = computed(() => incomeBonusFromTags(effectiveTags(userData.value)))

    // ── Actions ──
    // ⚠️ POPUP-FIRST ทุกอุปกรณ์ (รวมมือถือ) — อย่าเปลี่ยนกลับไปใช้ redirect เป็นค่าหลัก
    // เหตุผล: host (pikar10tu.github.io / *.web.app) คนละโดเมนกับ authDomain
    // (rxtu10dashboard.firebaseapp.com) → signInWithRedirect ต้องส่ง credential ข้ามโดเมนกลับมา
    // ซึ่งพึ่ง third-party storage/cookie; Safari (ITP) บนไอโฟน + Chrome แอนดรอยด์บล็อกอันนี้
    // → ล็อกอินสำเร็จแต่เด้งกลับหน้า login (getRedirectResult ว่าง). popup เลี่ยงปัญหานี้เพราะ
    // ทำ flow ใน popup เดียวกัน. ปุ่มกด = user gesture จึงไม่โดน popup-blocker บนมือถือยุคใหม่.
    // redirect เหลือไว้เป็น fallback เฉพาะตอน popup ใช้ไม่ได้ (webview/บล็อก) เท่านั้น.
    // หมายเหตุ: ไม่เรียก ensureDoc ที่นี่ — onAuthStateChanged ใน init() สร้าง doc ให้
    // (กันกรณี auth สำเร็จแต่ Firestore เชื่อมไม่ได้ จะได้ไม่ขึ้น error หลอก)
    async function login() {
        const { toast } = useToast()
        provider.setCustomParameters({ prompt: 'select_account' })
        const t0 = Date.now()
        try {
            await signInWithPopup(auth, provider)
        } catch (e) {
            // popup ปิดโดยไม่ได้ล็อกอิน — Firebase ให้ code เดียวกันทั้งกรณีผู้ใช้กดปิดเอง
            // และกรณี popup ตายเอง (เช่น handler เช็คโดเมนไม่ผ่าน) แยกด้วยเวลา ดู utils/authError.js
            if (isPopupClosedCode(e.code)) {
                // ผู้ใช้กดปิดเอง → เงียบไว้ ไม่ต้อง fallback (จะงงว่าทำไมเด้งออก)
                if (shouldWarnPopupClosed(e.code, Date.now() - t0)) {
                    console.error('[login popup ปิดเร็วผิดปกติ]', e.code, e)
                    toast('เปิดหน้าล็อกอินไม่สำเร็จ — ลองใหม่อีกครั้ง ถ้ายังไม่ได้ รบกวนแจ้งแอดมิน', 'error', 6000)
                }
                return
            }
            // popup เปิดไม่ได้จริง (โดนบล็อก/อยู่ใน webview ที่ไม่รองรับ) → ลอง redirect แทน
            if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
                try { await signInWithRedirect(auth, provider); return }
                catch (e2) {
                    console.error('[login redirect fallback]', e2.code, e2)
                    toast(`Login ไม่สำเร็จ: ${e2.code || e2.message || e2}`, 'error', 6000)
                    return
                }
            }
            console.error('[login popup]', e.code, e)
            toast(`Login ไม่สำเร็จ: ${e.code || e.message || e}`, 'error', 6000)
        }
    }

    async function logout() {
        if (_unsub) { _unsub(); _unsub = null }
        await signOut(auth)
        currentUser.value = null
        userData.value    = null
    }

    async function ensureDoc(user) {
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
            await setDoc(ref, newUserDoc(user, serverTimestamp()))
        }
    }

    // Block snapshot guard (matches existing app's __blockSnapshot pattern)
    // กัน onSnapshot ที่ยังตามหลังการเขียนไม่ทัน มาเขียนทับ optimistic state ~1.5s
    //
    // ⚠️ เดิมทิ้ง snapshot ที่มาระหว่างบล็อกไปเลย → อัปเดตที่ "ไม่ได้มาจากเรา"
    // (แอดมินเติมเหรียญ / เปิดอีกแท็บ / จดหมายเข้า) ที่บังเอิญมาในช่วงนั้นหายถาวร
    // จนกว่าจะมีการเปลี่ยนแปลงครั้งถัดไป · ตอนนี้พักไว้แล้ว apply ตอนปลดบล็อกแทน
    let _blockSnapshot = false
    let _pendingSnapshot = null    // snapshot ล่าสุดที่มาระหว่างบล็อก (เก็บแค่ตัวใหม่สุดพอ)
    let _blockTimer = null

    function blockSnapshot(ms = SNAPSHOT_DELAY) {
        _blockSnapshot = true
        if (_blockTimer) clearTimeout(_blockTimer)
        _blockTimer = setTimeout(unblockSnapshot, ms)
    }

    /** ปลดบล็อก แล้ว apply snapshot ที่พักไว้ (ถ้ามี) — ตอนนี้ของจริงรวมการเขียนของเราแล้ว */
    function unblockSnapshot() {
        _blockSnapshot = false
        if (_blockTimer) { clearTimeout(_blockTimer); _blockTimer = null }
        const raw = _pendingSnapshot
        _pendingSnapshot = null
        if (raw !== null) applySnapshot(raw)
    }

    function applySnapshot(raw) {
        userData.value = normalizeUserData(raw)
        runPetMigrationIfNeeded()
        runWelcomeGiftIfNeeded()
    }

    // Optimistic update — write local state immediately, Firestore confirms async
    function setUserDataOptimistic(patch) {
        userData.value = { ...userData.value, ...patch }
    }

    /**
     * Canonical user-doc write: block the snapshot, apply the optimistic local
     * patch, then persist to Firestore. `optimistic` = plain local values;
     * `server` = the Firestore patch (may use increment()/serverTimestamp()).
     * If `server` is omitted, `optimistic` is written as-is.
     * Returns true on success, false on failure (caller decides how to toast).
     */
    async function patchUser(optimistic, server) {
        if (!currentUser.value) return false
        const prev = userData.value   // เก็บไว้ rollback ถ้าเขียนไม่สำเร็จ
        blockSnapshot()
        setUserDataOptimistic(optimistic)
        try {
            const payload = server ?? optimistic
            // slim เฉพาะที่เขียนลง Firestore — pets เก็บแค่ {id,grade,copies}, identity มาจาก catalog ตอนอ่าน (normalizeUserData)
            // FIX F1 (fable): filter entry ไม่มี id ทิ้ง กัน {id:undefined} → updateDoc throw "Unsupported field value: undefined"
            const toWrite = Array.isArray(payload.pets) ? { ...payload, pets: payload.pets.filter(p => p && p.id).map(slimPet) } : payload
            await updateDoc(doc(db, 'users', currentUser.value.uid), toWrite)
            useUsageStore().track(0, 1) // เส้นทางเขียนหลักของแอป — นับเข้าตัวประมาณการ
            return true
        } catch (e) {
            console.error('[patchUser]', e)
            // เขียนล้มเหลว → คืน state เดิม (กัน UI โชว์ผลลวงจน snapshot รอบหน้าค่อยแก้)
            userData.value = prev
            // ปลดบล็อกทันที ให้ snapshot ของจริงไหลกลับมาได้เลย · ทิ้งตัวที่พักไว้เพราะ
            // rollback คืนค่าก่อนเขียนให้แล้ว (เท่ากับสถานะเซิร์ฟเวอร์ที่ไม่เคยรับการเขียนนี้)
            _pendingSnapshot = null
            unblockSnapshot()
            return false
        }
    }

    // One-time migration: เพ็ทเก่า → species-based model ใหม่ (เกรด I-V)
    // guard ด้วยตัวแปร module-scope กันยิงซ้ำระหว่าง snapshot (รอ patchUser อยู่)
    let _petMigrating = false
    async function runPetMigrationIfNeeded() {
        const u = userData.value
        if (!u || u.petsMigratedV2 === true || _petMigrating) return
        _petMigrating = true
        try {
            const ids = new Set(PETS.map(p => p.id))
            const { pets, activePets, refundCoins } = migratePets(
                [...(u.pets || []), ...(u.petsVault || [])], u.activePets, ids, getPetDef,
            )
            await patchUser(
                { pets, activePets, petsVault: [], petsMigratedV2: true, coins: (u.coins || 0) + refundCoins },
                { pets, activePets, petsVault: [], petsMigratedV2: true, ...(refundCoins ? { coins: increment(refundCoins) } : {}) },
            )
            if (refundCoins) {
                const { toast } = useToast()
                toast(`อัปเดตคลังเพ็ทรุ่นใหม่ — คืนเหรียญ ${refundCoins.toLocaleString()}`, 'success')
            }
        } catch (e) {
            console.error('[pet migration]', e)
        } finally {
            _petMigrating = false
        }
    }

    // One-time: ส่งจดหมายของขวัญต้อนรับ (doc id ตายตัว 'welcome-v1' — rules ตรวจแม่แบบเป๊ะ)
    // batch เขียน 2 docs atomic: สร้างจดหมาย + ตั้ง flag กันส่งซ้ำ
    let _welcomeGifting = false
    async function runWelcomeGiftIfNeeded() {
        const u = userData.value
        if (!u || u.welcomeGiftV1 === true || _welcomeGifting) return
        const uid = currentUser.value?.uid
        if (!uid) return
        _welcomeGifting = true
        try {
            const batch = writeBatch(db)
            batch.set(doc(db, 'users', uid, 'mail', 'welcome-v1'), buildWelcomeGiftMail(serverTimestamp()))
            batch.update(doc(db, 'users', uid), { welcomeGiftV1: true })
            await batch.commit()
        } catch (e) {
            console.error('[welcome gift]', e)
        } finally {
            _welcomeGifting = false
        }
    }

    // ── Onboarding actions ──
    // ยอมรับ consent → persist consent block (ค่าเดียวที่ต้องเขียนจริงสำหรับคนเก่า)
    async function acceptConsent() {
        return patchUser(
            { consent: { accepted: true, version: CONSENT_VERSION, at: Date.now() } },
            { consent: { accepted: true, version: CONSENT_VERSION, at: serverTimestamp() } },
        )
    }

    // ผูกตัวตนนักศึกษา: match roster (client) → จอง claims/{id} (atomic) → เขียน identity
    //  คืน reason 'notfound' (ไม่อยู่ roster) / 'taken' (รหัสถูกจองแล้ว)
    async function linkStudent(studentId) {
        if (!currentUser.value) return { ok: false, reason: 'taken' }
        const members = useMembersStore()
        if (!members.students.length) members.initStudents()
        const m = matchRoster(studentId, members.students)
        if (!m) return { ok: false, reason: 'notfound' }

        const claimRef = doc(db, 'claims', m.id)
        try {
            const existing = await getDoc(claimRef)
            if (existing.exists()) {
                if (existing.data().uid !== currentUser.value.uid) return { ok: false, reason: 'taken' }
                // claim เป็นของเราอยู่แล้ว (retry หลัง patchUser รอบก่อนล้มเหลว) → ข้ามไปเขียน identity ต่อ
            } else {
                // create-only (rules ปฏิเสธถ้ามีอยู่แล้ว = ตัวกันซ้ำจริง)
                await setDoc(claimRef, { uid: currentUser.value.uid, at: serverTimestamp() })
            }
        } catch (e) {
            console.error('[linkStudent claim]', e)
            return { ok: false, reason: 'taken' }
        }

        const identity = {
            studentId: m.id, nickname: m.nickname, realName: m.realName,
            track: m.track, accountType: 'student', onboarded: true,
        }
        const ok = await patchUser(identity, identity)
        return { ok }
    }

    // สมัคร guest → pending (รอ admin อนุมัติ)
    async function registerGuest(nickname, reason) {
        const nick = cleanText(nickname, LIMITS.nickname)
        const why  = cleanText(reason, LIMITS.guestReason)
        if (!nick || !why) return false
        const patch = {
            nickname: nick, guestReason: why,
            accountType: 'guest', guestStatus: 'pending', onboarded: true,
        }
        return patchUser(patch, patch)
    }

    // ── Auth listener (call once in main.js) ──
    function init() {
        // จบ flow ของ signInWithRedirect เมื่อกลับมาที่หน้าเว็บ
        // (surface error เท่านั้น; onAuthStateChanged จัดการ state เอง)
        getRedirectResult(auth).catch((e) => {
            console.error('[getRedirectResult]', e.code, e)
            const { toast } = useToast()
            toast(`Login ไม่สำเร็จ: ${e.code || e.message || e}`, 'error', 6000)
        })
        onAuthStateChanged(auth, async (user) => {
            currentUser.value = user
            if (user) {
                // อย่าให้ ensureDoc ที่ล้มเหลวค้างหน้า "กำลังโหลด..." ตลอดไป
                try { await ensureDoc(user) }
                catch (e) { console.error('[ensureDoc]', e) }
                if (_unsub) _unsub()
                _unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (_blockSnapshot) { _pendingSnapshot = snap.data() ?? null; return }
                    applySnapshot(snap.data())
                }, (err) => {
                    // listener ตาย (rules ปฏิเสธ / เน็ตมหาลัยบล็อก) — เดิมเงียบสนิท
                    // แอปจะค้างข้อมูลเก่าโดยไม่มีสัญญาณอะไรเลย
                    console.error('[user snapshot]', err.code, err)
                    const { toast } = useToast()
                    toast('การเชื่อมต่อข้อมูลหลุด — ลองรีเฟรชหน้า', 'error', 6000)
                })
            } else {
                if (_unsub) { _unsub(); _unsub = null }
                _pendingSnapshot = null           // กันข้อมูลบัญชีก่อนหน้าหลุดมาตอนปลดบล็อก
                if (_blockTimer) { clearTimeout(_blockTimer); _blockTimer = null }
                _blockSnapshot = false
                userData.value = null
            }
            loading.value = false
        })
    }

    return {
        currentUser, userData, loading,
        isLoggedIn, isAdmin, isAcademic, isInstructor, isQuestionEditor, isLinked, incomeBonusPct,
        login, logout, ensureDoc,
        blockSnapshot, setUserDataOptimistic, patchUser,
        acceptConsent, linkStudent, registerGuest,
        init,
    }
})
