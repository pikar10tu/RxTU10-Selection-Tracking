// เทส memberIndex — การจัดช่อง/คีย์ของ user doc ในรายชื่อฝั่งแอดมิน
// รัน: node --test src/utils/memberIndex.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memberBucket, memberKey } from './memberIndex.js'

test('memberBucket: guest ดูจาก accountType หรือ track เดิม', () => {
  assert.equal(memberBucket({ accountType: 'guest' }), 'guest')
  assert.equal(memberBucket({ track: 'guest' }), 'guest')
  assert.equal(memberBucket({ accountType: 'guest', studentId: '6512345678' }), 'guest')
})

test('memberBucket: นักศึกษาที่ผูกรหัสแล้ว → member', () => {
  assert.equal(memberBucket({ studentId: '6512345678', track: 'sci' }), 'member')
})

// 🔴 เคสที่เป็นต้นเหตุจริง — คนที่ผ่าน onboarding แต่ยังไม่มีรหัส และไม่ใช่ guest
test('memberBucket: ไม่มี studentId และไม่ใช่ guest → ยังเป็น member (ห้ามหายเงียบ)', () => {
  assert.equal(memberBucket({ nickname: 'อุ้ม', onboarded: true }), 'member')
  assert.equal(memberBucket({ nickname: 'อุ้ม', studentId: null, accountType: null, track: null }), 'member')
})

test('memberBucket: doc ว่าง/undefined → member (สโตร์กรอง doc ขยะไปก่อนแล้ว)', () => {
  assert.equal(memberBucket({}), 'member')
  assert.equal(memberBucket(undefined), 'member')
})

test('memberKey: มี studentId → ใช้ studentId', () => {
  assert.equal(memberKey({ studentId: '6512345678' }, 'uid-a'), '6512345678')
})

test('memberKey: ไม่มี studentId → ตกไปใช้ uid (ไม่ใช่ค่าว่าง)', () => {
  assert.equal(memberKey({ studentId: null, nickname: 'อุ้ม' }, 'uid-a'), 'uid-a')
  assert.equal(memberKey({ studentId: '' }, 'uid-a'), 'uid-a')
  assert.equal(memberKey(undefined, 'uid-a'), 'uid-a')
})

test('memberKey: คนไม่มีรหัส 2 คนต้องไม่ทับกัน (คีย์เป็น uid คนละตัว)', () => {
  const a = memberKey({ nickname: 'อุ้ม' }, 'uid-a')
  const b = memberKey({ nickname: 'บีม' }, 'uid-b')
  assert.notEqual(a, b)
})
