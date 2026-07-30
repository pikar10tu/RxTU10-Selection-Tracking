<template>
  <div class="tab-content">
    <div class="page-title"><Emoji char="⚙️" /> Admin</div>

    <!-- guard: admin only -->
    <div v-if="!authStore.isAdmin" class="admin-denied">
      เฉพาะแอดมินเท่านั้น
    </div>

    <template v-else>
      <!-- ───── โหมดซ่อมบำรุง (config/app.maintenance) ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🚧" /> โหมดซ่อมบำรุง</span></div>
        <div class="admin-hint">
          ปกติเว็บเปิดให้ทั้งชั้นปีใช้ · กดปิดเพื่อเข้าโหมดซ่อมบำรุง (เห็นเฉพาะแอดมิน/ทีมวิชาการ) เผื่อเว็บล่มหรือชนลิมิต Firebase — มีผลทันที ไม่ต้อง deploy
        </div>
        <div class="maint-toggle">
          <span class="maint-state" :class="maintenance ? 'off' : 'on'">
            {{ maintenance ? '🔒 ปิดซ่อมบำรุง (เฉพาะทีมงาน)' : '🟢 เปิดให้ทุกคนใช้' }}
          </span>
          <button
            class="btn-mini" :class="maintenance ? 'btn-gold' : 'btn-gray'"
            :disabled="savingMaint" @click="toggleMaintenance"
          >
            {{ savingMaint ? '...' : (maintenance ? 'เปิดเว็บอีกครั้ง' : 'ปิดซ่อมบำรุง') }}
          </button>
        </div>
      </section>

      <!-- ───── สนามประลอง (PvP open/close gate) ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="⚔️" /> สนามประลอง (PvP)</span></div>
        <div class="admin-hint">
          เปิดให้ทั้งชั้นปีเริ่มบุกกันได้ — ก่อนเปิด ทุกคนเข้าไปจัดทีม/เห็นแต้มได้ แต่ยังบุกไม่ได้ · มีผลทันที ไม่ต้อง deploy
        </div>
        <div class="maint-toggle">
          <span class="maint-state" :class="pvpOpen ? 'on' : 'off'">
            {{ pvpOpen ? '🟢 เปิดให้บุกแล้ว' : '🔒 ยังไม่เปิด (จัดทีม/ดูแต้มได้)' }}
          </span>
          <button
            class="btn-mini" :class="pvpOpen ? 'btn-gray' : 'btn-gold'"
            :disabled="savingPvp" @click="togglePvp"
          >
            {{ savingPvp ? '...' : (pvpOpen ? 'ปิดสนาม' : 'เปิดสนาม ⚔️') }}
          </button>
        </div>
      </section>

      <!-- ───── ตรวจข้อสอบ (วิชาการ) ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🔍" /> ตรวจข้อสอบ (วิชาการ)</span></div>
        <div class="admin-hint">
          สุ่มป้อนข้อให้ทีมวิชาการ+อาจารย์ช่วยตรวจความถูกต้อง — ดูได้ว่าใครตรวจไปกี่ข้อ
        </div>
        <RouterLink to="/review" class="btn-mini btn-gold" style="display:inline-block;text-decoration:none;margin-top:4px">
          ไปหน้าตรวจข้อสอบ 🔍
        </RouterLink>
        <div class="admin-hint" style="margin-top:10px">
          ซิงก์ = เติมสถานะตรวจให้ข้อเก่า (ครั้งแรกต้องกด ไม่งั้นหน้า /review มองไม่เห็นข้อพวกนั้น)
          + คำนวณตัวนับ "ใครตรวจกี่ข้อ" ใหม่ · กดซ้ำได้ ปลอดภัย
        </div>
        <button class="btn-mini" :disabled="reviewSyncBusy" @click="syncReviewSystem">
          {{ reviewSyncBusy ? 'กำลังซิงก์…' : '🔄 ซิงก์ระบบตรวจ' }}
        </button>
      </section>

      <!-- ───── การใช้ Firestore (ประมาณการ) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="📊" /> การใช้ Firestore วันนี้</span>
          <button class="btn-mini" @click="usage.loadToday()">↻ โหลด</button>
        </div>
        <div class="admin-hint">
          ค่า<strong>ประมาณการ</strong>ในแอป (นับเฉพาะ getDocs ใหญ่ + การเขียนหลัก ไม่นับ listener echo)
          — ตัวจริงดูที่ Cloud Monitoring เตือนทางอีเมล
        </div>

        <div v-if="usageBanner" class="usage-banner" :class="usageLevel">
          {{ usageBanner }}
        </div>

        <div v-if="usage.today" class="usage-gauges">
          <div class="usage-row">
            <span class="usage-lbl">อ่าน (reads)</span>
            <span class="usage-num">{{ usage.today.reads.toLocaleString() }} / {{ READ_LIMIT.toLocaleString() }}</span>
          </div>
          <div class="usage-bar"><i :style="{ width: pct(usage.today.reads, READ_LIMIT), background: barColor(usage.today.reads, READ_LIMIT) }"></i></div>
          <div class="usage-row">
            <span class="usage-lbl">เขียน (writes)</span>
            <span class="usage-num">{{ usage.today.writes.toLocaleString() }} / {{ WRITE_LIMIT.toLocaleString() }}</span>
          </div>
          <div class="usage-bar"><i :style="{ width: pct(usage.today.writes, WRITE_LIMIT), background: barColor(usage.today.writes, WRITE_LIMIT) }"></i></div>
        </div>
        <div v-else class="admin-empty">กดปุ่ม ↻ โหลด เพื่อดูค่า</div>
      </section>

      <!-- ───── สถิติการสู้ (หอคอย) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="⚔️" /> สถิติการสู้ (หอคอย)</span>
          <button class="btn-mini" :disabled="loadingBattle" @click="loadBattleStats">
            {{ loadingBattle ? 'กำลังโหลด…' : '↻ โหลด' }}
          </button>
        </div>
        <div class="admin-hint">win% ราย species จากการเล่นจริง — ไว้จูนตัวเลขสมดุล (เขียว ≥60 / แดง ≤40)</div>
        <table v-if="battleStats.length" class="bstat">
          <thead><tr><th>ตัว</th><th>สู้</th><th>ชนะ%</th><th>ดาเมจ/ไฟต์</th><th>K/D</th></tr></thead>
          <tbody>
            <tr v-for="s in battleStats" :key="s.id">
              <td><Emoji :char="s.emoji" /> {{ s.name }}</td>
              <td>{{ s.battles }}</td>
              <td :class="{ hi: s.winPct >= 60, lo: s.winPct <= 40 }">{{ s.winPct }}%</td>
              <td>{{ s.avgDmg }}</td>
              <td>{{ s.kills }}/{{ s.deaths }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="admin-empty">กดปุ่ม ↻ โหลด เพื่อดูสถิติ</div>
      </section>

      <!-- ───── รีเซตหอคอย (ลาดเดอร์รายเดือน) ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🏯" /> รีเซตหอคอย</span></div>
        <div class="admin-hint">ลาดเดอร์รายเดือน — ตั้งชั้นหอคอยทุกคนกลับชั้น 1 (โบนัสหายจนไต่ใหม่ · ไม่แตะเพ็ท/เหรียญ)</div>
        <button class="btn-mini" :disabled="resettingTower" @click="resetTower">
          {{ resettingTower ? 'กำลังรีเซต…' : 'รีเซตชั้นหอคอยทุกคน' }}
        </button>
      </section>

      <!-- ───── คำขอ guest (รออนุมัติ) ───── -->
      <section v-if="pendingGuests.length" class="admin-card">
        <div class="admin-card-head"><span><Emoji char="📨" /> คำขอเข้าชม (รออนุมัติ)</span></div>
        <ul class="role-list">
          <li v-for="g in pendingGuests" :key="g.uid" class="role-row">
            <div class="role-top">
              <div class="role-info">
                <div class="role-name">{{ g.nickname }}</div>
                <div class="role-sub">{{ g.email }}</div>
                <div class="gq-reason">{{ g.guestReason }}</div>
              </div>
              <div class="role-actions">
                <button class="btn-mini btn-gold" @click="setGuestStatus(g, 'approved')">✓ อนุมัติ</button>
                <button class="btn-mini btn-gray" @click="setGuestStatus(g, 'rejected')">✗ ปฏิเสธ</button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- ───── ทีมวิชาการ (role management) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="🎓" /> ทีมวิชาการ</span>
          <button class="btn-mini" :disabled="members.loading" @click="reload">
            {{ members.loading ? '...' : '↻ โหลด' }}
          </button>
        </div>
        <div class="admin-hint">
          ตั้งสิทธิ์ให้เพื่อนเป็น “ทีมวิชาการ” เพื่อเพิ่ม/แก้ไขข้อสอบได้
        </div>

        <input
          v-model="search"
          class="admin-search"
          type="text"
          placeholder="ค้นหาชื่อ / รหัส / อีเมล…"
        />

        <div v-if="members.loading" class="admin-empty">กำลังโหลด…</div>
        <div v-else-if="!filtered.length" class="admin-empty">ไม่พบสมาชิก</div>

        <ul v-else class="role-list">
          <li v-for="m in filtered" :key="m.uid" class="role-row">
            <div class="role-top">
              <div class="role-info">
                <div class="role-name">
                  {{ m.nickname }}
                  <span v-if="m.realName" class="role-real">· {{ m.realName }}</span>
                </div>
                <div class="role-sub">{{ m.studentId || '—' }} · {{ m.email || m.uid.slice(0, 8) }}</div>
              </div>
              <span class="role-badge" :class="'role-' + m.role">{{ roleLabel(m.role) }}</span>
              <div class="role-actions">
                <button v-if="m.studentId" class="btn-mini btn-gray" title="แก้การผูกตัวตน" @click="resetLink(m)"><Emoji char="🔧" /></button>
                <button
                  v-if="m.role !== 'academic'"
                  class="btn-mini btn-gold"
                  :disabled="savingUid === m.uid || m.role === 'admin'"
                  @click="setRole(m, 'academic')"
                >+ วิชาการ</button>
                <button
                  v-else
                  class="btn-mini btn-gray"
                  :disabled="savingUid === m.uid"
                  @click="setRole(m, 'student')"
                >− เอาออก</button>
                <button
                  v-if="m.accountType === 'guest' && m.guestStatus === 'approved' && m.role !== 'instructor'"
                  class="btn-mini btn-gold"
                  :disabled="savingUid === m.uid || m.role === 'admin'"
                  @click="setRole(m, 'instructor')"
                ><Emoji char="🩺" /> อาจารย์</button>
                <button
                  v-else-if="m.role === 'instructor'"
                  class="btn-mini btn-gray"
                  :disabled="savingUid === m.uid"
                  @click="setRole(m, 'student')"
                >− ถอนอาจารย์</button>
                <button class="btn-mini btn-gray" title="ปรับเหรียญ/เลเวลบ้าน" @click="openEcon(m)"><Emoji char="💰" /></button>
                <button class="btn-mini btn-gray" @click="editTagsUid = editTagsUid === m.uid ? null : m.uid"><Emoji char="🏷️" /></button>
              </div>
            </div>
            <!-- econ editor: ปรับเหรียญ + เลเวลบ้าน (แอดมินเท่านั้น — rules อนุญาต) -->
            <div v-if="editEconUid === m.uid" class="econ-editor">
              <label class="econ-field">
                <span><Emoji char="🪙" /> เหรียญ</span>
                <input v-model.number="econCoins" type="number" inputmode="numeric" min="0" max="50000000" />
              </label>
              <label class="econ-field">
                <span><Emoji char="🏠" /> เลเวลบ้าน (1–12)</span>
                <input v-model.number="econLevel" type="number" inputmode="numeric" min="1" max="12" />
              </label>
              <button class="btn-mini btn-gold" :disabled="savingUid === m.uid" @click="saveEcon(m)">บันทึก</button>
            </div>
            <!-- tag editor -->
            <div v-if="editTagsUid === m.uid" class="tag-editor">
              <button
                v-for="t in TAG_LIST" :key="t.id"
                class="tag-toggle" :class="{ on: hasTag(m, t.id) }"
                :style="hasTag(m, t.id) ? { background: t.color, borderColor: t.color } : {}"
                @click="toggleTag(m, t.id)"
              ><Emoji :char="t.emoji" /> {{ t.label }}</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- ───── กระดานข่าว ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="📢" /> กระดานข่าว</span></div>
        <div class="admin-hint">โพสต์ประกาศ — ทุกคนจะเห็นบนหน้า Home</div>
        <div class="news-form">
          <input v-model="newsIcon" class="news-icon-in" maxlength="2" />
          <input v-model="newsMsg" :maxlength="LIMITS.news" class="admin-search" style="margin:0;flex:1" placeholder="ข้อความข่าว…" @keyup.enter="postNews" />
          <button class="btn-mini btn-gold" :disabled="postingNews || !newsMsg.trim()" @click="postNews">โพสต์</button>
        </div>
        <ul v-if="newsList.length" class="news-admin-list">
          <li v-for="n in newsList" :key="n.id" class="news-admin-row">
            <span><Emoji :char="n.icon" /> {{ n.msg }}</span>
            <button class="news-del" @click="delNews(n.id)"><Emoji char="🗑️" /></button>
          </li>
        </ul>
        <button class="btn-mini btn-gray" :disabled="clearingNews || !newsList.length" @click="clearAllNews">
          <Emoji char="🧹" /> เคลียร์ข่าวทั้งหมด
        </button>
      </section>

      <!-- ───── ส่งจดหมายถึงสมาชิก (Mailbox broadcast) ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="📬" /> ส่งจดหมายถึงสมาชิก</span></div>
        <div class="admin-hint">ส่งประกาศ/ของขวัญเข้ากล่องจดหมาย — ใส่เหรียญ &gt; 0 ผู้รับจะกดรับเองที่หน้า Home (ไม่ใส่ = ประกาศเฉยๆ)</div>
        <div class="bc-form">
          <input v-model="bcTitle" :maxlength="LIMITS.news" class="admin-search" style="margin:0" placeholder="หัวข้อจดหมาย…" />
          <textarea v-model="bcBody" :maxlength="LIMITS.feedback" class="bc-body" rows="2" placeholder="เนื้อหา (ไม่บังคับ)…"></textarea>
          <div class="bc-row">
            <label class="bc-field">
              <span>เหรียญแนบ</span>
              <input v-model.number="bcCoins" type="number" inputmode="numeric" min="0" max="100000" class="bc-coins" />
            </label>
            <label class="bc-field">
              <span>ส่งถึง</span>
              <select v-model="bcTarget" class="bc-target" aria-label="เลือกผู้รับ">
                <option value="all">ทั้งรุ่น</option>
                <option value="sci">เฉพาะสาย Sci</option>
                <option value="care">เฉพาะสาย Care</option>
              </select>
            </label>
          </div>
          <select v-model="bcAchievement" class="admin-search" style="margin:0">
            <option value="">— ไม่แนบ achievement —</option>
            <option v-for="(a, id) in ACHIEVEMENTS" :key="id" :value="id">{{ a.icon }} {{ a.title }}</option>
          </select>
          <button class="btn-mini btn-gold bc-send" :disabled="bcSending || !bcTitle.trim()" @click="sendBroadcast">
            {{ bcSending ? 'กำลังส่ง…' : 'ส่งจดหมาย' }}
          </button>
        </div>
      </section>

      <!-- ───── เคลีย emoji จากชื่อในฐานข้อมูล ───── -->
      <section class="admin-card">
        <div class="admin-card-head"><span><Emoji char="🧹" /> เคลีย emoji จากชื่อ</span></div>
        <div class="admin-hint">ตัด emoji ท้ายชื่อเล่นที่ค้างในฐานข้อมูล — เขียนทับเฉพาะ doc ที่มี emoji จริง (ชื่อสะอาดอยู่แล้วไม่ถูกแตะ)</div>
        <button class="btn-mini btn-gold" :disabled="cleaning" @click="cleanupNicknames">
          {{ cleaning ? 'กำลังเคลีย…' : 'เคลีย emoji จากชื่อในฐานข้อมูล' }}
        </button>
      </section>

      <!-- ───── รายงานการโกง (cheat logs) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="🚨" /> รายงานการโกง</span>
          <button class="btn-mini" :disabled="loadingLogs" @click="loadCheatLogs">
            {{ loadingLogs ? '...' : '↻ โหลด' }}
          </button>
        </div>
        <div class="admin-hint">ค่าผิดปกติที่ระบบตรวจพบ (กันได้แค่หยาบๆ — ดูประกอบการพิจารณา)</div>
        <div v-if="!cheatLogs.length" class="admin-empty">ยังไม่มีรายงาน <Emoji char="🎉" /></div>
        <ul v-else class="log-list">
          <li v-for="g in cheatLogs" :key="g.id" class="log-row">
            <div class="log-main"><b>{{ g.name }}</b> · <span class="log-reason">{{ g.reason }}</span></div>
            <div class="log-detail">{{ g.detail }}</div>
            <div class="log-ts">{{ fmtTs(g.ts) }}</div>
          </li>
        </ul>
      </section>

      <!-- ───── รายงานข้อมูลยา (drug reports) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="📋" /> รายงานข้อมูลยา</span>
          <button class="btn-mini" :disabled="loadingReports" @click="loadDrugReports">
            {{ loadingReports ? '...' : '↻ โหลด' }}
          </button>
        </div>
        <div class="admin-hint">ผู้ใช้แจ้งว่าข้อมูลยาผิด/ไม่ตรง — ตรวจแก้แล้วกด ✓ เพื่อปิด</div>
        <div v-if="!drugReports.length" class="admin-empty">ยังไม่มีรายงาน <Emoji char="🎉" /></div>
        <ul v-else class="log-list">
          <li v-for="r in drugReports" :key="r.id" class="rep-row">
            <div class="rep-top"><b>{{ r.drug }}</b><button class="rep-done" @click="resolveDoc('drugReports', r.id)">✓ ปิด</button></div>
            <div class="rep-cur">{{ r.currentClass }}<template v-if="r.currentDose"> · {{ r.currentDose }}</template></div>
            <div class="rep-note"><Emoji char="💬" /> {{ r.note }}</div>
            <div class="log-ts">{{ r.reporterName || 'ไม่ระบุ' }} · {{ fmtTs(r.ts) }}</div>
          </li>
        </ul>
      </section>

      <!-- ───── ข้อเสนอแนะพัฒนา (feedback) ───── -->
      <section class="admin-card">
        <div class="admin-card-head">
          <span><Emoji char="💡" /> ข้อเสนอแนะพัฒนา</span>
          <button class="btn-mini" :disabled="loadingFeedback" @click="loadFeedback">
            {{ loadingFeedback ? '...' : '↻ โหลด' }}
          </button>
        </div>
        <div class="admin-hint">ไอเดีย/ปัญหาที่ผู้ใช้ส่งมาเพื่อพัฒนาแอป</div>
        <div v-if="!feedback.length" class="admin-empty">ยังไม่มีข้อเสนอแนะ</div>
        <ul v-else class="log-list">
          <li v-for="f in feedback" :key="f.id" class="rep-row">
            <div class="rep-top"><span class="fb-cat">{{ fbCatLabel(f.category) }}</span><button class="rep-done" @click="resolveDoc('feedback', f.id)">✓ ปิด</button></div>
            <div class="rep-note">{{ f.message }}</div>
            <div class="log-ts">{{ f.reporterName || 'ไม่ระบุ' }} · {{ fmtTs(f.ts) }}</div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, updateDoc, setDoc, collection, getDocs, query, orderBy, limit, addDoc, deleteDoc, serverTimestamp, writeBatch, deleteField, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useMembersStore } from '../stores/members.js'
import { useUsageStore } from '../stores/usage.js'
import { useAppConfig } from '../composables/useAppConfig.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import Emoji from '../components/shared/Emoji.vue'
import { cleanText, LIMITS, stripTrailingEmoji } from '../utils/text.js'
import { buildBroadcastMail } from '../utils/mailbox.js'
import { TAG_LIST } from '../data/tags.js'
import { getPetDef } from '../data/index.js'
import { ACHIEVEMENTS } from '../data/achievements.js'
import { usageStatus, DAILY_READ_LIMIT, DAILY_WRITE_LIMIT } from '../utils/usageMeter.js'
import { computeStatus, reviewStatusKey, tallyReviewCounts } from '../utils/questionReview.js'
import { getCategories } from '../utils/questionCategories.js'

const authStore = useAuthStore()
const members   = useMembersStore()
const usage     = useUsageStore()
const { maintenance, pvpOpen } = useAppConfig()
const { toast } = useToast()
const { confirm } = useConfirm()

// ซิงก์ระบบตรวจข้อสอบ: เติม reviewStatus ให้ข้อเก่า (ก่อนมีระบบตรวจ — query หน้า /review
// มองไม่เห็นข้อที่ไม่มี field นี้) + ซ่อมสถานะที่ drift (รวมข้อค้าง 1 เสียง pending → half)
// + ล้าง reviewVerdicts โครงเก่า + เติม categories ให้ข้อเก่าที่มีแค่ category เดี่ยว
// + เติม rand ให้ข้อที่ยังไม่มี (ข้อที่ไม่มี field นี้จะไม่ถูก orderBy('rand') ที่ /review ใช้
//   เลือกคิว pending คืนมาเลย — มองไม่เห็นถาวรถ้าไม่ซ่อม · ไม่ re-roll ข้อที่มี rand เป็นตัวเลขอยู่แล้ว)
// + rebuild ตัวนับ leaderboard และตัวนับ progress จาก reviewedBy/สถานะทั้งคลัง · idempotent กดซ้ำได้
const reviewSyncBusy = ref(false)
async function syncReviewSystem() {
  if (reviewSyncBusy.value) return
  reviewSyncBusy.value = true
  try {
    const snap = await getDocs(collection(db, 'questions'))
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // ข้อที่ต้องแก้: สถานะไม่ตรงกับที่คำนวณได้ (รวมข้อค้าง 1 เสียงที่ยังเป็น pending → half)
    // หรือยังมี map โครงเก่า หรือยังไม่มี categories ทั้งที่มี category เดี่ยว
    const stale = all.filter(q =>
      (q.reviewStatus || null) !== computeStatus(q)
      || q.reviewVerdicts !== undefined
      || (!Array.isArray(q.categories) && !!q.category)
      || typeof q.rand !== 'number')
    for (let i = 0; i < stale.length; i += 500) {
      const batch = writeBatch(db)
      for (const q of stale.slice(i, i + 500)) {
        const patch = {
          reviewStatus: computeStatus(q),
          reviewPass: q.reviewPass || 0,
          reviewFail: q.reviewFail || 0,
          reviewVerdicts: deleteField(),
        }
        if (!Array.isArray(q.categories) && q.category) patch.categories = getCategories(q)
        if (typeof q.rand !== 'number') patch.rand = Math.random()
        batch.update(doc(db, 'questions', q.id), patch)
      }
      await batch.commit()
    }
    // ตัวนับใหม่จากคลังจริง — ชื่อคงของเดิมไว้ (ชื่อมาจาก snapshot ตอน submit)
    // progress คำนวณใหม่ทั้งก้อน = ซ่อม drift จากการสร้างข้อใหม่/import/ล้างผลตรวจ/นำออก
    const progress = { pending: 0, half: 0, passed: 0, failed: 0, conflict: 0, retired: 0 }
    for (const q of all) {
      const key = reviewStatusKey(q)
      if (key in progress) progress[key]++
    }
    // ทรานแซกชัน: อ่าน+เขียน reviewMeta/main แบบอะตอมมิก กันชนกับ ReviewView ที่ merge
    // ชื่อผู้ตรวจ (names) เข้า doc เดียวกันตอน submit — ไม่งั้น setDoc ทับทั้งก้อนช่วงกลาง
    // ทับชื่อที่เพิ่ง merge เข้ามาหาย (rules ไม่ได้กันช่องนี้ให้ ต้องอะตอมมิกเอง)
    // หมายเหตุ: counts/progress คำนวณจาก snapshot ตอนเริ่มฟังก์ชัน — เสียงที่ submit
    // ระหว่างซิงก์กำลังรันจะยังไม่ถูกนับ (self-heals เมื่อกดซิงก์รอบถัดไป, ยอมรับได้)
    const metaRef = doc(db, 'reviewMeta', 'main')
    await runTransaction(db, async (tx) => {
      const cur = await tx.get(metaRef)
      tx.set(metaRef, {
        counts: tallyReviewCounts(all),
        names: cur.exists() ? (cur.data().names || {}) : {},
        progress,
      })
    })
    usage.track(snap.size + 1, stale.length + 1)
    toast(`ซิงก์แล้ว — อัปเดต ${stale.length} ข้อ · ความคืบหน้าตั้งต้นใหม่แล้ว`, 'success')
  } catch (e) { console.error('[review sync]', e); toast('ซิงก์ไม่สำเร็จ', 'error') }
  finally { reviewSyncBusy.value = false }
}

// สถิติการสู้ราย species (อ่านทั้ง collection — admin คนเดียว cost ไม่สำคัญ)
const battleStats = ref([])
const loadingBattle = ref(false)
async function loadBattleStats() {
  loadingBattle.value = true
  try {
    const snap = await getDocs(collection(db, 'battleStats'))
    usage.track(snap.size)
    battleStats.value = snap.docs.map(d => {
      const x = d.data(), def = getPetDef(d.id) || { emoji: '❓', name: d.id }
      const battles = x.battles || 0
      return {
        id: d.id, emoji: def.emoji, name: def.name, battles,
        winPct: battles ? Math.round((x.wins || 0) / battles * 100) : 0,
        avgDmg: battles ? Math.round((x.dmgDealt || 0) / battles) : 0,
        kills: x.kills || 0, deaths: x.deaths || 0,
      }
    }).sort((a, b) => b.winPct - a.winPct)
  } catch (e) { console.error('[loadBattleStats]', e) }
  finally { loadingBattle.value = false }
}

// ── รีเซตชั้นหอคอยทุกคน (ลาดเดอร์รายเดือน) — batch ทุก user doc, เฉพาะ 2 field หอคอย ──
const resettingTower = ref(false)
async function resetTower() {
  if (resettingTower.value) return
  const ok = await confirm('รีเซตชั้นหอคอยของผู้เล่นทุกคน?\n• towerFloor→1, towerBest→0\n• โบนัสรายได้หอคอยจะหายจนกว่าจะไต่ใหม่\n• เพ็ท/ทีม/เหรียญไม่ถูกแตะ')
  if (!ok) return
  resettingTower.value = true
  try {
    const snap = await getDocs(collection(db, 'users'))
    let batch = writeBatch(db), n = 0, total = 0
    for (const d of snap.docs) {
      batch.set(d.ref, { towerFloor: 1, towerBest: 0 }, { merge: true })
      n++; total++
      if (n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0 }  // chunk กันเกิน 500
    }
    if (n > 0) await batch.commit()
    usage.track(snap.size, total)
    toast(`รีเซตหอคอย ${total} คนแล้ว`, 'success')
  } catch (e) { console.error('[resetTower]', e); toast('รีเซตไม่สำเร็จ', 'error') }
  finally { resettingTower.value = false }
}

// ── ส่งจดหมายถึงสมาชิก (Mailbox broadcast) ──
const bcTitle = ref('')
const bcBody = ref('')
const bcCoins = ref(0)
const bcTarget = ref('all')   // all | sci | care
const bcAchievement = ref('') // achievement id ที่เลือกแนบ, '' = ไม่แนบ
const bcSending = ref(false)

async function sendBroadcast() {
  const title = cleanText(bcTitle.value, LIMITS.news)
  if (!title || bcSending.value) return
  const coins = Math.max(0, Math.min(Number(bcCoins.value) || 0, 100000))
  bcSending.value = true
  try {
    // โหลดสมาชิกสด (force) เพื่อให้ได้ uid ครบ ไม่อิง cache
    await members.loadFbUsers({ force: true })
    const all = [...Object.values(members.fbUsers), ...members.guestUsers]
    const targets = bcTarget.value === 'all' ? all : all.filter(u => u.track === bcTarget.value)
    const uids = [...new Set(targets.map(u => u.uid).filter(Boolean))]
    if (!uids.length) { toast('ไม่พบผู้รับ', 'error'); return }
    const label = bcTarget.value === 'sci' ? 'สาย Sci' : bcTarget.value === 'care' ? 'สาย Care' : 'ทั้งรุ่น'
    const ok = await confirm(`ส่งจดหมาย "${title}" ถึง ${label} (${uids.length} คน)${coins ? ` พร้อมเหรียญ ${coins.toLocaleString()}` : ''}?`)
    if (!ok) return
    const body = cleanText(bcBody.value, LIMITS.feedback)
    // chunk ละ 450 (< 500 ops/batch ของ Firestore)
    for (let i = 0; i < uids.length; i += 450) {
      const chunk = uids.slice(i, i + 450)
      const batch = writeBatch(db)
      for (const uid of chunk) {
        batch.set(doc(collection(db, 'users', uid, 'mail')),
          buildBroadcastMail({ title, body, coins, achievement: bcAchievement.value ? { id: bcAchievement.value } : undefined }, serverTimestamp()))
      }
      await batch.commit()
      usage.track(0, chunk.length)
    }
    toast(`ส่งจดหมายถึง ${uids.length} คนแล้ว`, 'success')
    bcTitle.value = ''; bcBody.value = ''; bcCoins.value = 0; bcAchievement.value = ''
  } catch (e) {
    console.error('[broadcast]', e); toast('ส่งจดหมายไม่สำเร็จ', 'error')
  } finally { bcSending.value = false }
}

// ── เคลีย emoji ท้ายชื่อเล่นที่ค้างในฐานข้อมูล (one-time, อ่านค่าดิบจาก Firestore) ──
// เขียนทับเฉพาะ doc ที่ stripTrailingEmoji แล้วต่างจากเดิม + ไม่ทำให้ชื่อกลายเป็นว่าง (ข้าม emoji ล้วน)
const cleaning = ref(false)
async function cleanupNicknames() {
  if (cleaning.value) return
  if (!await confirm('เคลีย emoji ท้ายชื่อเล่นที่ค้างในฐานข้อมูล? (เขียนทับเฉพาะ doc ที่มี emoji จริง)')) return
  cleaning.value = true
  try {
    const snap = await getDocs(collection(db, 'users'))
    const dirty = []
    snap.forEach(d => {
      const raw = d.data().nickname
      if (typeof raw !== 'string') return
      const clean = stripTrailingEmoji(raw)
      if (clean && clean !== raw) dirty.push({ ref: d.ref, clean })
    })
    if (!dirty.length) { toast('ไม่มีชื่อที่ต้องเคลีย', 'info'); return }
    for (let i = 0; i < dirty.length; i += 450) {
      const chunk = dirty.slice(i, i + 450)
      const batch = writeBatch(db)
      for (const { ref: r, clean } of chunk) batch.update(r, { nickname: clean })
      await batch.commit()
    }
    usage.track(snap.size, dirty.length)
    await members.loadFbUsers({ force: true })
    toast(`เคลีย emoji จากชื่อ ${dirty.length} คนแล้ว`, 'success')
  } catch (e) {
    console.error('[cleanup nicknames]', e); toast('เคลียไม่สำเร็จ', 'error')
  } finally { cleaning.value = false }
}

// ── usage gauge (ประมาณการในแอป) ──
const READ_LIMIT = DAILY_READ_LIMIT
const WRITE_LIMIT = DAILY_WRITE_LIMIT
const usageLevel = computed(() => usageStatus(usage.today?.reads || 0, usage.today?.writes || 0))
const usageBanner = computed(() => {
  if (!usage.today) return ''
  if (usageLevel.value === 'danger') return '🔴 ใกล้ชนลิมิตฟรีมาก! พิจารณาลดการอ่าน หรือเปิด Blaze (ยังมี quota ฟรีเดิม)'
  if (usageLevel.value === 'warn')   return '🟡 การใช้งานสูงกว่าปกติ — จับตาดูไว้ (ค่านี้ undercount จริง)'
  return ''
})
const pct = (v, max) => `${Math.min(100, Math.round((v / max) * 100))}%`
const barColor = (v, max) => {
  const s = usageStatus(max === READ_LIMIT ? v : 0, max === WRITE_LIMIT ? v : 0)
  return s === 'danger' ? '#ef4444' : s === 'warn' ? '#f59e0b' : '#22c55e'
}

// ── maintenance toggle (config/app.maintenance) ──
const savingMaint = ref(false)
async function toggleMaintenance() {
  const next = !maintenance.value
  savingMaint.value = true
  try {
    await setDoc(doc(db, 'config', 'app'), { maintenance: next }, { merge: true })
    toast(next ? 'เข้าโหมดซ่อมบำรุงแล้ว — เห็นเฉพาะทีมงาน' : 'เปิดเว็บให้ทุกคนแล้ว', 'success')
  } catch (e) {
    console.error('[admin maintenance]', e)
    toast('เปลี่ยนสถานะไม่สำเร็จ', 'error')
  } finally {
    savingMaint.value = false
  }
}

// ── เปิด/ปิด สนามประลอง (config/app.pvpOpen) ──
const savingPvp = ref(false)
async function togglePvp() {
  const next = !pvpOpen.value
  savingPvp.value = true
  try {
    await setDoc(doc(db, 'config', 'app'), { pvpOpen: next }, { merge: true })
    toast(next ? 'เปิดสนามประลองแล้ว' : 'ปิดสนามประลองแล้ว', 'success')
  } catch (e) {
    console.error('[admin pvpOpen]', e)
    toast('เปลี่ยนสถานะไม่สำเร็จ', 'error')
  } finally {
    savingPvp.value = false
  }
}

const search     = ref('')
const savingUid  = ref(null)
const editTagsUid = ref(null)
const editEconUid = ref(null)   // แถวที่กำลังเปิดแผงปรับเหรียญ/เลเวลบ้าน
const econCoins  = ref(0)
const econLevel  = ref(1)

function hasTag(m, id) { return (m.tags || []).includes(id) }
async function toggleTag(m, id) {
  const next = hasTag(m, id) ? (m.tags || []).filter(t => t !== id) : [...(m.tags || []), id]
  try {
    await updateDoc(doc(db, 'users', m.uid), { tags: next })
    m.tags = next
    toast(`อัปเดตแท็ก ${m.nickname}`, 'success')
  } catch (e) {
    console.error('[admin toggleTag]', e)
    toast('บันทึกแท็กไม่สำเร็จ', 'error')
  }
}

const cheatLogs = ref([])
const loadingLogs = ref(false)

onMounted(() => {
  if (authStore.isAdmin) { reload(); loadCheatLogs(); loadNews(); loadDrugReports(); loadFeedback(); usage.loadToday() }
})

// ── Drug reports + dev feedback ──
const drugReports = ref([])
const loadingReports = ref(false)
const feedback = ref([])
const loadingFeedback = ref(false)

async function loadDrugReports() {
  loadingReports.value = true
  try {
    const snap = await getDocs(query(collection(db, 'drugReports'), orderBy('ts', 'desc'), limit(50)))
    drugReports.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[admin drugReports]', e) }
  finally { loadingReports.value = false }
}
async function loadFeedback() {
  loadingFeedback.value = true
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('ts', 'desc'), limit(50)))
    feedback.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[admin feedback]', e) }
  finally { loadingFeedback.value = false }
}
async function resolveDoc(coll, id) {
  try {
    await deleteDoc(doc(db, coll, id))
    if (coll === 'drugReports') drugReports.value = drugReports.value.filter(x => x.id !== id)
    else if (coll === 'feedback') feedback.value = feedback.value.filter(x => x.id !== id)
    toast('ปิดรายการแล้ว', 'success')
  } catch (e) { console.error('[admin resolve]', e); toast('ลบไม่สำเร็จ', 'error') }
}
const fbCatLabel = (c) => ({ idea: '💡 ไอเดีย', bug: '🐞 ปัญหา', other: '📝 อื่นๆ' }[c] || '📝 อื่นๆ')

async function loadCheatLogs() {
  loadingLogs.value = true
  try {
    const snap = await getDocs(query(collection(db, 'cheatLogs'), orderBy('ts', 'desc'), limit(50)))
    cheatLogs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('[admin cheatLogs]', e)
  } finally {
    loadingLogs.value = false
  }
}
function fmtTs(ts) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

// ── News board ──
const newsIcon = ref('📢')
const newsMsg = ref('')
const newsList = ref([])
const postingNews = ref(false)

async function loadNews() {
  try {
    const snap = await getDocs(query(collection(db, 'news'), orderBy('ts', 'desc'), limit(20)))
    newsList.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[admin news]', e) }
}
async function postNews() {
  const msg = cleanText(newsMsg.value, LIMITS.news)
  if (!msg) return
  postingNews.value = true
  try {
    await addDoc(collection(db, 'news'), { icon: newsIcon.value || '📢', msg, ts: serverTimestamp() })
    newsMsg.value = ''
    await loadNews()
    toast('โพสต์ข่าวแล้ว', 'success')
  } catch (e) { console.error('[post news]', e); toast('โพสต์ไม่สำเร็จ', 'error') }
  finally { postingNews.value = false }
}
async function delNews(id) {
  try { await deleteDoc(doc(db, 'news', id)); newsList.value = newsList.value.filter(n => n.id !== id) }
  catch (e) { console.error('[del news]', e); toast('ลบไม่สำเร็จ', 'error') }
}

const clearingNews = ref(false)
async function clearAllNews() {
  if (!(await confirm('ลบข่าวทั้งหมดในกระดานข่าว?'))) return
  clearingNews.value = true
  try {
    const snap = await getDocs(collection(db, 'news'))
    let batch = writeBatch(db); let n = 0
    for (const d of snap.docs) {
      batch.delete(d.ref); n++
      if (n % 450 === 0) { await batch.commit(); batch = writeBatch(db) }
    }
    if (n % 450 !== 0) await batch.commit()
    usage.track(snap.size, n)
    await loadNews()
    toast(`ลบข่าวแล้ว ${n} รายการ`, 'success')
  } catch (e) { console.error('[clear news]', e); toast('ลบข่าวไม่สำเร็จ', 'error') }
  finally { clearingNews.value = false }
}

function reload() {
  members.loadFbUsers({ force: true }) // triage ต้องเห็นข้อมูลสด ข้าม cache เสมอ
}

function roleLabel(role) {
  return role === 'admin' ? '👑 แอดมิน' : role === 'academic' ? '🎓 วิชาการ' : role === 'instructor' ? '🩺 อาจารย์' : 'สมาชิก'
}

// flatten student fbUsers + guests into one sortable list
const allUsers = computed(() => {
  const list = [...Object.values(members.fbUsers || {}), ...(members.guestUsers || [])]
  return list.sort((a, b) => {
    const rank = r => (r === 'admin' ? 0 : r === 'academic' ? 1 : 2)
    return rank(a.role) - rank(b.role) || (a.studentId || '').localeCompare(b.studentId || '')
  })
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allUsers.value
  return allUsers.value.filter(m =>
    [m.nickname, m.realName, m.studentId, m.email].some(v => (v || '').toLowerCase().includes(q))
  )
})

const pendingGuests = computed(() =>
  (members.guestUsers || []).filter(g => g.guestStatus === 'pending'))

async function setGuestStatus(g, status) {
  try {
    await updateDoc(doc(db, 'users', g.uid), { guestStatus: status })
    g.guestStatus = status
    toast(status === 'approved' ? `อนุมัติ ${g.nickname} แล้ว` : `ปฏิเสธ ${g.nickname} แล้ว`, 'success')
  } catch (e) { console.error('[guest status]', e); toast('อัปเดตไม่สำเร็จ', 'error') }
}

// แก้การผูกผิด: ลบ claim + ล้าง identity → ผู้ใช้ผูกใหม่ตอน login ครั้งหน้า
async function resetLink(m) {
  if (!(await confirm(`ล้างการผูกตัวตนของ ${m.nickname}? เขาจะต้องผูกรหัสใหม่ตอนเข้าครั้งหน้า`))) return
  try {
    if (m.studentId) await deleteDoc(doc(db, 'claims', m.studentId))
    await updateDoc(doc(db, 'users', m.uid), {
      studentId: null, nickname: null, realName: null, track: null,
      accountType: null, onboarded: false,
    })
    toast(`ล้างการผูกของ ${m.nickname || m.email} แล้ว`, 'success')
    reload()
  } catch (e) { console.error('[resetLink]', e); toast('ล้างไม่สำเร็จ', 'error') }
}

async function setRole(m, role) {
  if (m.role === 'admin') return // never demote/alter an admin from here
  savingUid.value = m.uid
  try {
    await updateDoc(doc(db, 'users', m.uid), { role })
    m.role = role // optimistic local update (light object is reactive via store ref)
    toast(`ตั้ง ${m.nickname} เป็น ${roleLabel(role)} แล้ว`, 'success')
  } catch (e) {
    console.error('[admin setRole]', e)
    toast('บันทึกไม่สำเร็จ', 'error')
  } finally {
    savingUid.value = null
  }
}

// เปิด/ปิดแผงปรับเหรียญ-เลเวลบ้าน + เติมค่าปัจจุบันของคนนั้น (toggle ที่แถวเดิม = ปิด)
function openEcon(m) {
  if (editEconUid.value === m.uid) { editEconUid.value = null; return }
  econCoins.value = m.coins || 0
  econLevel.value = m.residence?.level || 1
  editEconUid.value = m.uid
}

async function saveEcon(m) {
  const coins = Math.max(0, Math.min(Number(econCoins.value) || 0, 50000000))
  const level = Math.max(1, Math.min(Math.round(Number(econLevel.value) || 1), 12))
  if (!(await confirm(`ตั้งเหรียญ ${coins.toLocaleString()} + เลเวลบ้าน ${level} ให้ ${m.nickname}?`))) return
  savingUid.value = m.uid
  try {
    // เขียน doc คนอื่นตรงๆ (rules: isAdmin เขียนได้) · 'residence.level' = dot-path กันทับ field อื่นใน residence
    await updateDoc(doc(db, 'users', m.uid), { coins, 'residence.level': level })
    m.coins = coins
    m.residence = { ...(m.residence || {}), level }   // optimistic บน light object
    editEconUid.value = null
    toast(`ตั้งเหรียญ/เลเวลบ้านให้ ${m.nickname} แล้ว`, 'success')
  } catch (e) {
    console.error('[admin saveEcon]', e)
    toast('บันทึกไม่สำเร็จ', 'error')
  } finally {
    savingUid.value = null
  }
}
</script>

<style scoped>
.admin-denied,
.admin-empty {
  text-align: center;
  color: rgba(0, 0, 0, .4);
  padding: 24px 0;
  font-size: .85rem;
}
/* ── broadcast (ส่งจดหมาย) ── */
.bc-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.bc-body { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; resize: vertical; }
.bc-row { display: flex; gap: 8px; }
.bc-field { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 700; color: #64748b; }
.bc-coins, .bc-target { box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: .82rem; font-weight: 700; background: #fff; color: var(--ink); width: 100%; }
.bc-send { width: 100%; }
.admin-card {
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 16px;
  box-shadow: var(--pop);
  padding: 14px;
  margin-bottom: 14px;
}
.admin-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 800;
  font-size: .95rem;
  margin-bottom: 4px;
}
.maint-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.maint-state { font-size: .8rem; font-weight: 700; }
.maint-state.on  { color: #15803d; }
.maint-state.off { color: #b45309; }
.admin-hint {
  font-size: .68rem;
  color: rgba(0, 0, 0, .45);
  margin-bottom: 10px;
}
.usage-banner {
  border: 2px solid var(--ink); border-radius: 10px; padding: 8px 12px;
  font-size: .74rem; font-weight: 700; margin-bottom: 10px;
}
.usage-banner.warn   { background: #fff7e6; }
.usage-banner.danger { background: #fee2e2; }
.usage-gauges { display: flex; flex-direction: column; gap: 4px; }
.usage-row { display: flex; justify-content: space-between; font-size: .72rem; font-weight: 700; }
.usage-lbl { color: rgba(0,0,0,.6); }
.usage-num { color: var(--ink); }
.usage-bar {
  height: 8px; border: 2px solid var(--ink); border-radius: 999px;
  background: #fff; overflow: hidden; margin-bottom: 6px;
}
.usage-bar i { display: block; height: 100%; transition: width .3s; }
.bstat { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: .8rem; }
.bstat th, .bstat td { text-align: left; padding: 5px 6px; border-bottom: 1px solid rgba(0,0,0,.08); }
.bstat th { color: rgba(0,0,0,.45); font-weight: 700; }
.bstat td.hi { color: #15803d; font-weight: 800; }
.bstat td.lo { color: #b91c1c; font-weight: 800; }
.admin-search {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 2px solid var(--ink);
  border-radius: 10px;
  font-family: inherit;
  font-size: .82rem;
  margin-bottom: 10px;
}
.admin-search:focus { outline: none; box-shadow: var(--pop); }
.role-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
  overflow-y: auto;
}
.role-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, .03);
}
.role-top { display: flex; align-items: center; gap: 8px; }
.tag-editor { display: flex; flex-wrap: wrap; gap: 5px; padding-top: 2px; }
.econ-editor { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; padding-top: 4px; }
.econ-field { display: flex; flex-direction: column; gap: 3px; font-size: .64rem; font-weight: 700; color: rgba(0,0,0,.55); }
.econ-field input { box-sizing: border-box; width: 130px; border: 2px solid var(--ink); border-radius: 8px; padding: 6px 8px; font-family: inherit; font-size: .82rem; font-weight: 700; background: #fff; color: var(--ink); }
.tag-toggle {
  border: 1px solid rgba(0,0,0,.15); background: #fff; color: rgba(0,0,0,.55);
  border-radius: 999px; padding: 4px 9px; font-family: inherit; font-size: .64rem;
  font-weight: 700; cursor: pointer;
}
.tag-toggle.on { color: #fff; }
.role-info { flex: 1; min-width: 0; }
.role-name {
  font-size: .82rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-real { font-weight: 400; color: rgba(0, 0, 0, .45); }
.role-sub { font-size: .64rem; color: rgba(0, 0, 0, .4); }
.gq-reason { font-size: .72rem; color: rgba(0, 0, 0, .55); margin-top: 4px; }
.role-badge {
  font-size: .6rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
}
.role-student  { background: rgba(0,0,0,.06);  color: rgba(0,0,0,.5); }
.role-academic { background: rgba(59,130,246,.15); color: #2563eb; }
.role-admin    { background: rgba(251,191,36,.18); color: #b45309; }
.role-instructor { background: #fff7ed; color: #9a3412; }
.role-actions { flex-shrink: 0; }
.btn-mini {
  border: 2px solid var(--ink);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: .72rem;
  font-weight: 700;
  cursor: pointer;
  background: #fff;
}
.btn-mini:disabled { opacity: .4; cursor: default; }
.btn-gold { background: var(--gold); color: #fff; }
.btn-gray { background: #fff; color: var(--ink); }
.log-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.log-row { padding: 8px 10px; border-radius: 10px; background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.18); }
.log-main { font-size: .8rem; }
.log-reason { color: #dc2626; font-weight: 700; font-size: .72rem; }
.log-detail { font-size: .66rem; color: rgba(0,0,0,.5); }
.log-ts { font-size: .58rem; color: rgba(0,0,0,.35); margin-top: 2px; }
.rep-row { padding: 9px 11px; border-radius: 10px; background: rgba(99,102,241,.05); border: 1px solid rgba(99,102,241,.15); }
.rep-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .82rem; }
.rep-done { border: none; background: rgba(34,197,94,.15); color: #15803d; border-radius: 8px; padding: 3px 9px; font-family: inherit; font-size: .64rem; font-weight: 700; cursor: pointer; flex-shrink: 0; }
.rep-cur { font-size: .66rem; color: rgba(0,0,0,.5); margin-top: 2px; }
.rep-note { font-size: .76rem; color: #1e293b; margin-top: 4px; line-height: 1.4; word-break: break-word; }
.fb-cat { font-size: .68rem; font-weight: 700; color: #4f46e5; }
.news-form { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
.news-icon-in { width: 42px; text-align: center; padding: 8px 0; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; font-family: inherit; font-size: 1rem; }
.news-admin-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.news-admin-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 9px; background: rgba(0,0,0,.03); font-size: .76rem; }
.news-admin-row span { flex: 1; word-break: break-word; }
.news-del { border: none; background: none; cursor: pointer; font-size: .9rem; flex-shrink: 0; }
</style>
