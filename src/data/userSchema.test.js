import { test } from 'node:test'
import assert from 'node:assert/strict'
import { USER_DEFAULTS, normalizeUserData, WELCOME_GIFT_COINS, WELCOME_GIFT_TICKETS, hydratePet, slimPet, photoRefreshPatch } from './userSchema.js'

test('USER_DEFAULTS has gacha fields', () => {
  assert.equal(USER_DEFAULTS.gachaPity, 0)
  assert.equal(USER_DEFAULTS.gachaTarget, null)
  assert.equal(USER_DEFAULTS.gachaGuaranteed, false)
})

test('normalizeUserData fills gacha defaults on a sparse doc', () => {
  const d = normalizeUserData({ coins: 5 })
  assert.equal(d.gachaPity, 0)
  assert.equal(d.gachaTarget, null)
  assert.equal(d.gachaGuaranteed, false)
})

test('normalizeUserData keeps existing gacha values', () => {
  const d = normalizeUserData({ gachaPity: 42, gachaTarget: 'bahamut', gachaGuaranteed: true })
  assert.equal(d.gachaPity, 42)
  assert.equal(d.gachaTarget, 'bahamut')
  assert.equal(d.gachaGuaranteed, true)
})

test('USER_DEFAULTS มี welcome gift flags = false', () => {
  assert.equal(USER_DEFAULTS.welcomeGiftV1, false)
  assert.equal(USER_DEFAULTS.welcomeBoxSeen, false)
})

test('ค่าคงที่ของขวัญต้อนรับ = 15000 / 50', () => {
  assert.equal(WELCOME_GIFT_COINS, 15000)
  assert.equal(WELCOME_GIFT_TICKETS, 50)
})

test('normalizeUserData เติม welcome flags บน doc บางตา', () => {
  const d = normalizeUserData({ coins: 5 })
  assert.equal(d.welcomeGiftV1, false)
  assert.equal(d.welcomeBoxSeen, false)
})

test('normalizeUserData คงค่า welcome flags เดิม', () => {
  const d = normalizeUserData({ welcomeGiftV1: true, welcomeBoxSeen: true })
  assert.equal(d.welcomeGiftV1, true)
  assert.equal(d.welcomeBoxSeen, true)
})

// ── ทีมสู้: activePets ยาว 3 (Active team = 3 คงที่) ──
test('default activePets ยาว 3', () => {
  assert.equal(USER_DEFAULTS.activePets.length, 3)
})
test('normalize: activePets เดิม 2 ช่อง → pad เป็น 3', () => {
  const d = normalizeUserData({ activePets: ['cat', 'fox'] })
  assert.deepEqual(d.activePets, ['cat', 'fox', null])
})
test('normalize: activePets ยาวเกิน (4) → ตัดเหลือ 3', () => {
  const d = normalizeUserData({ activePets: ['a', 'b', 'c', 'd'] })
  assert.equal(d.activePets.length, 3)
  assert.deepEqual(d.activePets, ['a', 'b', 'c'])
})
test('normalize: legacy activePet → slot 0 (ยาว 3)', () => {
  const d = normalizeUserData({ activePet: 'cat' })
  assert.deepEqual(d.activePets, ['cat', null, null])
})

// ── PvP (สนามประลอง) ──
test('normalizeUserData: pvp defaults ครบ', () => {
  const d = normalizeUserData({})
  assert.equal(d.pvp.rating, 1000)
  assert.equal(d.pvp.wins, 0)
  assert.equal(d.pvp.seasonId, null)
  assert.equal(d.pvpAttacksUsed, 0)
  assert.equal(d.pvpAttackDate, null)
})
test('normalizeUserData: pvp บางส่วน merge กับ default', () => {
  const d = normalizeUserData({ pvp: { rating: 1234 } })
  assert.equal(d.pvp.rating, 1234)
  assert.equal(d.pvp.wins, 0) // เติม default
})

// ── Expedition (ส่งผจญภัย) ──
test('normalizeUserData: expedition default = null', () => {
  assert.equal(normalizeUserData({}).expedition, null)
})
test('normalizeUserData: expedition object คงไว้', () => {
  const exp = { petIds: ['a', 'b', 'c'], missionId: 'forest', durationId: 'short', startedAt: 1, endsAt: 2, party: [] }
  assert.deepEqual(normalizeUserData({ expedition: exp }).expedition, exp)
})
test('normalizeUserData: expedition ชนิดผิด (array/number) → null', () => {
  assert.equal(normalizeUserData({ expedition: [] }).expedition, null)
  assert.equal(normalizeUserData({ expedition: 5 }).expedition, null)
})

// ── Farm plot-unlock (ระบบปลดแปลง) ──
test('USER_DEFAULTS.farm.plotsUnlocked = 1 (เริ่ม 1 แปลง)', () => {
  assert.equal(USER_DEFAULTS.farm.plotsUnlocked, 1)
})
test('normalizeUserData: doc ไม่มี plotsUnlocked → เติม 1 (คนเก่ารีเซ็ตเหลือ 1)', () => {
  const d = normalizeUserData({ farm: { plots: [], inventory: {} } })
  assert.equal(d.farm.plotsUnlocked, 1)
})
test('normalizeUserData: คงค่า plotsUnlocked เดิมถ้ามี', () => {
  const d = normalizeUserData({ farm: { plotsUnlocked: 5 } })
  assert.equal(d.farm.plotsUnlocked, 5)
})

// ── Pet Hydration (PetSlim v2 model) ──
test('hydratePet: slim {id,grade,copies} → เติม name/emoji/rarity/element จาก catalog', () => {
  const h = hydratePet({ id: 'cat', grade: 2, copies: 3 })
  assert.equal(h.rarity, 'common')      // cat = common ใน catalog
  assert.equal(h.element, 'scissors')   // cat = scissors
  assert.equal(h.grade, 2); assert.equal(h.copies, 3)
  assert.ok(h.name && h.emoji)
})
test('hydratePet: fat doc → catalog ทับ identity (แก้ desync) เก็บ grade/copies', () => {
  const h = hydratePet({ id: 'cat', grade: 1, copies: 0, rarity: 'legendary', name: 'ของเก่า', emoji: '👾', element: 'fist', instId: 'x', potential: [{}] })
  assert.equal(h.rarity, 'common')      // catalog ทับ 'legendary' เก่า
  assert.equal(h.element, 'scissors')
  assert.equal(h.instId, undefined)     // vestigial ถูกตัด
  assert.equal(h.potential, undefined)
  assert.deepEqual(Object.keys(h).sort(), ['copies','element','emoji','grade','id','name','rarity'])
})
test('hydratePet: catalog id หาย → fallback placeholder ไม่พัง', () => {
  const h = hydratePet({ id: 'ghost_removed', grade: 0, copies: 0 })
  assert.equal(h.rarity, 'common'); assert.equal(h.element, 'scissors'); assert.ok(h.emoji)
})
test('slimPet: เหลือแค่ id/grade/copies', () => {
  assert.deepEqual(slimPet({ id: 'cat', grade: 2, copies: 3, name: 'x', emoji: 'y', rarity: 'z', element: 'w', instId: 'q' }), { id: 'cat', grade: 2, copies: 3 })
})
test('normalizeUserData: doc migrated → pets ถูก hydrate (rarity จาก catalog)', () => {
  const d = normalizeUserData({ petsMigratedV2: true, pets: [{ id: 'cat', grade: 0, copies: 0 }] })
  assert.equal(d.pets[0].rarity, 'common'); assert.ok(d.pets[0].emoji)
})
test('FIX B1: doc ยังไม่ migrate → pets คงดิบ (ไม่ hydrate — migratePets ต้องใช้ rarity/instId เดิม)', () => {
  const d = normalizeUserData({ pets: [{ id: 'cat', rarity: 'legendary', instId: 'x', grade: 1 }] })
  assert.equal(d.pets[0].rarity, 'legendary')   // ไม่ถูก catalog ทับ
  assert.equal(d.pets[0].instId, 'x')           // instId ยังอยู่ให้ migratePets ใช้
})
test('FIX F1: doc migrated ที่มี entry null/ไม่มี id → filter ทิ้ง ไม่พัง/ไม่มี undefined', () => {
  const d = normalizeUserData({ petsMigratedV2: true, pets: [null, { grade: 1 }, { id: 'cat', grade: 0, copies: 0 }] })
  assert.equal(d.pets.length, 1); assert.equal(d.pets[0].id, 'cat')
})

test('normalizeUserData เติม timeAttack ให้ user เก่าที่ยังไม่มีฟิลด์', () => {
  const d = normalizeUserData({})
  assert.deepEqual(d.timeAttack, { best4: 0, best15: 0 })
})

test('normalizeUserData คงสถิติเดิมและเติมคีย์ที่ขาด', () => {
  const d = normalizeUserData({ timeAttack: { best4: 30 } })
  assert.equal(d.timeAttack.best4, 30)
  assert.equal(d.timeAttack.best15, 0)
})

// ── photoRefreshPatch — รูป Google ต้องตามเจ้าตัวไปเรื่อยๆ ──
//    เดิม googlePhoto ถูกเขียนครั้งเดียวตอนสมัคร (newUserDoc) แล้วไม่เคยอัปเดตอีก
//    ใครเปลี่ยนรูป Google หลังจากนั้น URL เดิมตาย → หน้าเพื่อน/หอคอยตกไปเป็นตัวอักษรย่อ
test('photoRefreshPatch: รูปเปลี่ยน → ได้ patch', () => {
  const p = photoRefreshPatch({ photoURL: 'https://lh3/new' }, { googlePhoto: 'https://lh3/old' })
  assert.deepEqual(p, { googlePhoto: 'https://lh3/new' })
})

test('photoRefreshPatch: รูปเดิม → null (ไม่เขียนซ้ำทุกครั้งที่ล็อกอิน)', () => {
  assert.equal(photoRefreshPatch({ photoURL: 'https://lh3/x' }, { googlePhoto: 'https://lh3/x' }), null)
})

test('photoRefreshPatch: doc เก่ายังไม่มีฟิลด์ → เติมให้', () => {
  assert.deepEqual(photoRefreshPatch({ photoURL: 'https://lh3/x' }, {}), { googlePhoto: 'https://lh3/x' })
})

test('photoRefreshPatch: Auth ไม่ส่งรูปมา → null (ห้ามลบรูปเดิมทิ้ง)', () => {
  assert.equal(photoRefreshPatch({ photoURL: null }, { googlePhoto: 'https://lh3/x' }), null)
  assert.equal(photoRefreshPatch({}, { googlePhoto: 'https://lh3/x' }), null)
  assert.equal(photoRefreshPatch(null, { googlePhoto: 'https://lh3/x' }), null)
})
