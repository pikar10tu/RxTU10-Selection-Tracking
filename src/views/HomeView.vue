<template>
  <div class="tab-content">
    <header class="home-head">
      <div class="home-head-badge"><Emoji char="🧪" /></div>
      <div class="home-head-txt">
        <h1 class="home-head-title">RxTU10</h1>
        <p class="home-head-sub">เภสัช มธ. รุ่น 10 · หน้าหลัก</p>
      </div>
      <!-- ปุ่มจดหมาย + เควส มุมขวา (จุดแดงเมื่อมีของค้าง) -->
      <div v-if="authStore.isLoggedIn" class="home-head-actions">
        <HeaderIconButton icon="📬" :dot="mailbox.attention > 0" label="กล่องจดหมาย" @click="showMail = true" />
        <HeaderIconButton icon="🎯" :dot="questPending" label="เควสต์ประจำวัน" @click="showQuest = true" />
      </div>
    </header>

    <template v-if="authStore.isLoggedIn">
      <!-- นับถอยหลังสู่วันสอบ (ย้ายมาจาก Study — ข้อมูลสรุปรายวัน เห็นทันทีเปิดแอป) -->
      <ExamCountdown />
      <!-- งานถัดไปที่ควรทำ — โชว์ทีละอย่าง ซ่อนตัวเองเมื่อไม่มีอะไรค้าง -->
      <NextActionCard @sheet="onCardSheet" />
      <!-- ที่อยู่อาศัย (residence) — แกน prestige/coin-sink (ขยับขึ้นใต้ countdown) -->
      <ResidenceCard />

      <!-- เหรียญ + รับรายได้รายวัน (ส่วนตัว เห็นเฉพาะเจ้าของ) -->
      <DailyCard />
      <!-- สถานะส่งผจญภัย (โชว์เฉพาะตอนกำลังไป/กลับมาแล้ว) -->
      <ExpeditionCard />

      <!-- เครื่องมือผู้ดูแล — เฉพาะแอดมิน (Shop ไป nav, Pets ไป Play แล้ว) -->
      <RouterLink v-if="authStore.isAdmin" to="/admin" class="home-admin-btn">
        <Emoji char="⚙️" /> แผงผู้ดูแลระบบ
      </RouterLink>

      <!-- กล่องจดหมาย / เควส — bottom-sheet เปิดจากปุ่ม header -->
      <BottomSheet v-model:open="showMail" icon="📬" title="กล่องจดหมาย">
        <template #actions>
          <button class="mb-refresh" aria-label="รีเฟรชจดหมาย" :disabled="mailbox.loading" @click="mailbox.load({ force: true })">↻</button>
        </template>
        <MailboxCard />
      </BottomSheet>
      <BottomSheet v-model:open="showQuest" icon="🎯" title="เควสต์ประจำวัน">
        <DailyQuestCard />
      </BottomSheet>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import { RouterLink } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useMailbox } from '../stores/mailbox.js'
import { questNotClaimed } from '../utils/dailyQuest.js'
import ResidenceCard from '../components/residence/ResidenceCard.vue'
import DailyCard from '../components/home/DailyCard.vue'
import ExpeditionCard from '../components/home/ExpeditionCard.vue'
import DailyQuestCard from '../components/home/DailyQuestCard.vue'
import MailboxCard from '../components/home/MailboxCard.vue'
import NextActionCard from '../components/home/NextActionCard.vue'
import ExamCountdown from '../components/study/ExamCountdown.vue'
import BottomSheet from '../components/shared/BottomSheet.vue'
import HeaderIconButton from '../components/home/HeaderIconButton.vue'

const authStore = useAuthStore()
const mailbox = useMailbox()

const showMail = ref(false)
const showQuest = ref(false)

// จุดแดงเควส = วันนี้ยังไม่กดรับรางวัล
const questPending = computed(() =>
  questNotClaimed(authStore.userData?.dailyQuest, new Date().toISOString().slice(0, 10))
)

// โหลดจดหมายตั้งแต่เข้า Home เพื่อให้จุดแดงโชว์ได้โดยไม่ต้องเปิดแผงก่อน
onMounted(() => { if (authStore.isLoggedIn) mailbox.load() })

// การ์ดงานถัดไปสั่งเปิด bottom-sheet ได้ (เควสไม่มีหน้าแยก)
function onCardSheet(name) { if (name === 'quest') showQuest.value = true }
</script>

<style scoped>
/* ── header: display font + sticker badge ── */
.home-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.home-head-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
.mb-refresh { border: none; background: rgba(0,0,0,.06); border-radius: 8px; width: 28px; height: 28px; font-size: .8rem; cursor: pointer; color: rgba(0,0,0,.55); }
.mb-refresh:disabled { opacity: .5; }
.home-head-badge {
  width: 50px; height: 50px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.7rem; border-radius: 16px;
  background: var(--gold); border: 2px solid var(--ink); box-shadow: var(--pop);
  transform: rotate(-6deg);
}
.home-head-txt { min-width: 0; }
.home-head-title {
  font-family: var(--font-display); font-weight: 400;
  font-size: 1.85rem; line-height: 1; color: var(--ink); margin: 0;
  letter-spacing: .5px;
}
.home-head-sub { font-size: .68rem; color: var(--muted); margin: 4px 0 0; font-weight: 600; }

/* ── ปุ่มเครื่องมือผู้ดูแล (แอดมินเท่านั้น) — โทนเทา ไม่แย่งความสนใจ ── */
.home-admin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
  padding: 11px;
  border-radius: 14px;
  background: #f3f4f6;
  border: 1.5px solid #d1d5db;
  color: var(--muted);
  font-weight: 700;
  font-size: 0.82rem;
  text-decoration: none;
  transition: background .12s;
}
.home-admin-btn:active { background: #e5e7eb; }
</style>
