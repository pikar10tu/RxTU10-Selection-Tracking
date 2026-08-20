<template>
  <div class="mailbox-body">
    <div v-if="mailbox.loading && !mailbox.mails.length" class="mb-empty">กำลังโหลด…</div>
    <div v-else-if="!mailbox.mails.length" class="mb-empty">ยังไม่มีจดหมาย</div>
    <ul v-else class="mb-list">
      <li
        v-for="m in mailbox.mails" :key="m.id"
        class="mb-item" :class="{ unread: !m.read }"
        role="button" tabindex="0"
        :aria-label="`จดหมาย: ${m.title}${m.read ? '' : ' (ยังไม่อ่าน)'}`"
        @click="mailbox.markRead(m.id)"
        @keydown.enter.prevent="mailbox.markRead(m.id)"
        @keydown.space.prevent="mailbox.markRead(m.id)"
      >
        <span class="mb-ico"><Emoji :char="typeIcon(m)" /></span>
        <div class="mb-body">
          <div class="mb-item-title">{{ m.title }}</div>
          <div v-if="m.body" class="mb-item-text">{{ m.body }}</div>
          <div class="mb-meta">{{ fromLabel(m.from) }} · {{ fmtTime(m.createdAt) }}</div>
        </div>
        <div class="mb-action">
          <button
            v-if="hasReward(m)"
            class="mb-claim" :class="{ done: m.claimed }"
            :disabled="m.claimed || claimingId === m.id"
            @click.stop="onClaim(m)"
          >
            <template v-if="m.claimed">รับแล้ว ✓</template>
            <template v-else>
              รับ
              <template v-if="rewardCoins(m) > 0">{{ rewardCoins(m).toLocaleString() }}<Emoji char="🪙" /></template>
              <template v-if="rewardTickets(m) > 0"> +{{ rewardTickets(m) }}<Emoji char="🎟️" /></template>
            </template>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import Emoji from '../shared/Emoji.vue'
import { ref } from 'vue'
import { useMailbox } from '../../stores/mailbox.js'
import { useToast } from '../../composables/useToast.js'
import { canClaim, rewardCoins, rewardTickets } from '../../utils/mailbox.js'

const mailbox = useMailbox()
const { toast } = useToast()
const claimingId = ref(null)

// mailbox.load() ย้ายไป HomeView onMounted แล้ว (ให้จุดแดงโชว์โดยไม่ต้องเปิดแผง)

function hasReward(m) { return rewardCoins(m) > 0 || rewardTickets(m) > 0 }
function typeIcon(m) { return m.type === 'reward' ? '🎁' : m.type === 'gift' ? '🎁' : '📢' }
function fromLabel(from) {
  return from === 'system' ? 'ระบบ' : from === 'daily' ? 'รายวัน' : from === 'admin' ? 'แอดมิน' : 'เพื่อน'
}
function fmtTime(t) {
  const ms = t?.toMillis ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : new Date(t).getTime())
  if (!ms || Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

async function onClaim(m) {
  if (claimingId.value || !canClaim(m)) return
  claimingId.value = m.id
  try {
    const res = await mailbox.claim(m.id)
    if (res === false) { toast('รับรางวัลไม่สำเร็จ', 'error'); return }
    const parts = []
    if (res.coins > 0) parts.push(`${res.coins.toLocaleString()} เหรียญ`)
    if (res.tickets > 0) parts.push(`${res.tickets} ตั๋ว`)
    if (parts.length) toast(`รับ ${parts.join(' + ')} แล้ว`, 'success')
    else toast('จดหมายนี้รับไปแล้ว', 'info')
  } finally { claimingId.value = null }
}
</script>

<style scoped>
.mailbox-body { display: flex; flex-direction: column; }
.mb-empty { font-size: .76rem; color: rgba(0,0,0,.4); text-align: center; padding: 12px 0; }
.mb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mb-item { display: flex; align-items: flex-start; gap: 10px; border: 1px solid rgba(0,0,0,.1); border-radius: 12px; padding: 10px; background: #fff; cursor: pointer; }
.mb-item.unread { background: #eef2ff; border-color: rgba(79,70,229,.3); }
.mb-ico { font-size: 1.3rem; flex-shrink: 0; }
.mb-body { flex: 1; min-width: 0; }
.mb-item-title { font-weight: 800; font-size: .8rem; color: #1e293b; }
.mb-item-text { font-size: .72rem; color: rgba(0,0,0,.6); line-height: 1.4; margin-top: 2px; }
.mb-meta { font-size: .7rem; color: rgba(0,0,0,.4); margin-top: 4px; }
.mb-action { flex-shrink: 0; }
.mb-claim { border: none; border-radius: 9px; padding: 7px 11px; font-family: inherit; font-size: .72rem; font-weight: 800; color: #fff; background: var(--mint); cursor: pointer; white-space: nowrap; }
.mb-claim.done { background: rgba(0,0,0,.12); color: rgba(0,0,0,.5); cursor: default; }
.mb-claim:disabled { cursor: default; }
</style>
