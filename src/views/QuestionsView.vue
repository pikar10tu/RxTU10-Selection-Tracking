<template>
  <div class="tab-content">
    <div class="qz-head">
      <div class="qz-title"><Emoji char="📝" /> คลังข้อสอบ</div>
      <span class="qz-count">{{ filtered.length }}/{{ list.length }} ข้อ</span>
    </div>

    <div v-if="!authStore.isQuestionEditor" class="qz-denied">
      เฉพาะแอดมินหรือทีมวิชาการเท่านั้น
    </div>

    <template v-else>
      <!-- ── แท็บงาน (in-component tabs — state ร่วมกัน ไม่ต้องอ่านคลังซ้ำ) ── -->
      <div class="qz-tabs">
        <button class="qz-tab" :class="{ on: activeTab === 'edit' }" @click="activeTab = 'edit'">✍️ เพิ่ม/แก้</button>
        <button class="qz-tab" :class="{ on: activeTab === 'bank' }" @click="activeTab = 'bank'">📚 คลัง</button>
        <button class="qz-tab" :class="{ on: activeTab === 'check' }" @click="activeTab = 'check'">🔍 ตรวจสอบ</button>
      </div>

      <!-- ── ✍️ แท็บ เพิ่ม/แก้ : นำเข้า JSON ── -->
      <template v-if="activeTab === 'edit'">
      <!-- ── นำเข้าหลายข้อ (bulk JSON import) ── -->
      <details class="qz-import">
        <summary class="qz-import-sum"><Emoji char="📥" /> นำเข้าข้อสอบหลายข้อ (JSON)</summary>
        <div class="qz-import-body">
          <div class="qz-import-file">
            <input ref="fileEl" type="file" accept=".json,application/json" hidden @change="onFile" />
            <button type="button" class="qz-pick" @click="fileEl?.click()"><Emoji char="📂" /> เลือกไฟล์ .json จากเครื่อง</button>
            <span class="qz-pick-hint">หรือวาง JSON ด้านล่าง</span>
          </div>

          <textarea
            v-model="importText" class="qz-input qz-import-ta" rows="6" spellcheck="false"
            placeholder='วาง JSON ที่นี่ — array ของข้อสอบ เช่น [ { "question": "...", "choices": ["ก","ข"], "answer": 0 } ]'
          ></textarea>

          <details class="qz-fmt">
            <summary>ดูรูปแบบ JSON</summary>
            <pre class="qz-fmt-pre">{{ FORMAT_EXAMPLE }}</pre>
            <p class="qz-fmt-note">
              <code>answer</code> = ลำดับตัวเลือกที่ถูก เริ่มที่ 0 · <code>choices</code> 2–6 ตัว ·
              <code>category</code>/<code>explanation</code> ไม่บังคับ ·
              <code>categories</code> = array ชื่อหมวด/กลุ่มโรค เช่น <code>["เบาหวาน","ไต"]</code> (หรือ <code>category</code> เดี่ยว) · ไม่บังคับ · สูงสุด 5 กลุ่ม ·
              <code>examSets</code> = array ชื่อชุด เช่น <code>["PLE-CC1 ชุด 1"]</code> (หรือ <code>examSet</code> เดี่ยว) · ไม่บังคับ ·
              ทุกข้อนำเข้าเป็น <b>“ร่าง”</b> ต้องไปกดเผยแพร่ทีหลัง
            </p>
          </details>

          <div v-if="importError" class="qz-import-err"><Emoji char="⚠️" /> {{ importError }}</div>
          <div v-else-if="importText.trim()" class="qz-import-hint">
            พร้อมนำเข้า <b>{{ importCount }}</b> ข้อ<span v-if="importSkipped"> · ข้าม {{ importSkipped }} ข้อ (ผิดรูปแบบ)</span>
          </div>

          <div class="qz-import-sets">
            <span class="qz-import-sets-label">ตั้งชุดให้ทุกข้อในไฟล์ (ข้อที่มีชุดของตัวเองใน JSON ใช้ของตัวเอง)</span>
            <ExamSetSelect v-model="fileSets" />
          </div>

          <button class="qz-btn qz-primary qz-import-btn" :disabled="importing || !importCount" @click="runImport">
            {{ importing ? 'กำลังนำเข้า…' : (importCount ? `📥 นำเข้า ${importCount} ข้อ` : '📥 นำเข้า') }}
          </button>

          <button class="qz-btn qz-maint qz-import-btn" :disabled="backfilling" @click="backfillRand">
            {{ backfilling ? 'กำลังเติม…' : '🔧 เติม rand/qhash ให้ข้อเก่า' }}
          </button>
          <button class="qz-btn qz-maint qz-import-btn" :disabled="recomputingMeta" @click="recomputeMeta">
            {{ recomputingMeta ? 'กำลังคำนวณ…' : '🔄 คำนวณ meta ใหม่' }}
          </button>
        </div>
      </details>
      </template>

      <!-- ── 🔍 แท็บ ตรวจสอบ : ข้อถูกแจ้ง + ตรวจข้อซ้ำ ── -->
      <template v-if="activeTab === 'check'">
      <!-- ── ข้อที่ถูกแจ้งว่าผิด (questionReports) ── -->
      <details v-if="authStore.isAcademic" class="qz-reports" @toggle="onReportsToggle">
        <summary class="qz-reports-sum"><Emoji char="🚩" /> ข้อที่ถูกแจ้งว่าผิด<span v-if="reportsOpen"> ({{ reports.length }})</span></summary>
        <div class="qz-reports-body">
          <div v-if="reportsLoading" class="qz-empty">กำลังโหลด…</div>
          <div v-else-if="!reportGroups.length" class="qz-empty">ยังไม่มีข้อที่ถูกแจ้ง <Emoji char="🎉" /></div>
          <div v-else class="qz-report-list">
            <div v-for="g in reportGroups" :key="g.questionId" class="qz-report-card">
              <div class="qz-report-top">
                <span class="qz-report-badge">ถูกแจ้ง {{ g.count }} ครั้ง</span>
                <span v-if="!questionExists(g.questionId)" class="qz-report-deleted">ข้อถูกลบแล้ว</span>
              </div>
              <div class="qz-report-q">{{ reportQuestionText(g) }}</div>
              <ul class="qz-report-reasons">
                <li v-for="r in g.reports" :key="r.id">
                  <b>{{ r.reason }}</b><span v-if="r.note"> — {{ r.note }}</span>
                  <span class="qz-report-meta"> · {{ r.reportedByName || 'ไม่ระบุ' }} · {{ fmtTime(r.createdAt) }}</span>
                </li>
              </ul>
              <div class="qz-report-actions">
                <button class="qz-mini" :disabled="!questionExists(g.questionId)" @click="editReported(g)">แก้ไขข้อนี้</button>
                <button class="qz-mini" :disabled="resolvingId === g.questionId" @click="resolveReports(g, 'valid')">✓ ผิดจริง (ให้รางวัล)</button>
                <button class="qz-mini qz-danger" :disabled="resolvingId === g.questionId" @click="resolveReports(g, 'invalid')">✕ ไม่ผิด</button>
              </div>
            </div>
          </div>
        </div>
      </details>

      <!-- ── ตรวจข้อซ้ำในคลัง (Phase 6) ── -->
      <details class="qz-reports" @toggle="dupOpen = $event.target.open">
        <summary class="qz-reports-sum"><Emoji char="🔁" /> ตรวจข้อซ้ำในคลัง<span v-if="dupOpen"> ({{ duplicateGroups.length }} กลุ่ม)</span></summary>
        <div class="qz-reports-body">
          <p class="qz-dup-note">เทียบโจทย์ที่เหมือนกัน (ตัดช่องว่าง/ตัวพิมพ์) จากรายการที่โหลดอยู่ — ลบข้อที่ซ้ำซ้อนทิ้งได้</p>
          <div v-if="!list.length" class="qz-empty">ยังไม่ได้โหลดข้อสอบ — กด ↻ โหลด ก่อน</div>
          <div v-else-if="!duplicateGroups.length" class="qz-empty">ไม่พบข้อซ้ำ <Emoji char="🎉" /></div>
          <div v-else class="qz-report-list">
            <div v-for="(g, gi) in duplicateGroups" :key="gi" class="qz-report-card">
              <div class="qz-report-top"><span class="qz-report-badge">ซ้ำ {{ g.length }} ข้อ</span></div>
              <div class="qz-dup-q">{{ g[0].question }}</div>
              <ul class="qz-dup-items">
                <li v-for="q in g" :key="q.id">
                  <span class="qz-report-meta">{{ q.isPublished ? 'เผยแพร่' : 'ร่าง' }} · {{ q.createdByName || 'ไม่ระบุ' }} · {{ fmtTime(q.createdAt) }}</span>
                  <span class="qz-dup-acts">
                    <button class="qz-mini" @click="edit(q)">แก้</button>
                    <button class="qz-mini qz-danger" @click="remove(q)">ลบ</button>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </details>
      </template>

      <!-- ── ✍️ แท็บ เพิ่ม/แก้ : ฟอร์มข้อสอบ ── -->
      <template v-if="activeTab === 'edit'">
      <!-- ── editor ── -->
      <section class="qz-card">
        <div class="qz-card-head"><Emoji :char="draft.id ? '✏️' : '➕'" /> {{ draft.id ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบใหม่' }}</div>

        <label class="qz-label">โจทย์</label>
        <textarea v-model="draft.question" :maxlength="LIMITS.question" class="qz-input" rows="3" placeholder="พิมพ์คำถาม…"></textarea>

        <label class="qz-label">ตัวเลือก (กดวงกลมเพื่อเลือกข้อที่ถูก)</label>
        <div v-for="(c, i) in draft.choices" :key="i" class="qz-choice">
          <button
            class="qz-radio" :class="{ on: draft.answer === i }"
            type="button" @click="draft.answer = i"
            :title="draft.answer === i ? 'ข้อที่ถูก' : 'ตั้งเป็นข้อที่ถูก'"
          >{{ draft.answer === i ? '✓' : LETTERS[i] }}</button>
          <input v-model="draft.choices[i]" :maxlength="LIMITS.choice" class="qz-input qz-choice-in" :placeholder="`ตัวเลือก ${LETTERS[i]}`" />
          <button class="qz-del-choice" type="button" :disabled="draft.choices.length <= 2" @click="removeChoice(i)">✕</button>
        </div>
        <button class="qz-add-choice" type="button" :disabled="draft.choices.length >= 6" @click="draft.choices.push('')">+ เพิ่มตัวเลือก</button>

        <label class="qz-label">หมวด / กลุ่มโรค (เลือกได้หลายกลุ่ม)</label>
        <TopicSelect v-model="draft.categories" />

        <label class="qz-label">ชุดข้อสอบย้อนหลัง (ไม่บังคับ — 1 ข้ออยู่ได้หลายชุด)</label>
        <ExamSetSelect v-model="draft.examSets" />

        <label class="qz-label">หมวดใหญ่ (domain)</label>
        <select v-model="draft.domain" class="qz-input">
          <option :value="null">— ไม่ระบุ —</option>
          <option v-for="d in DOMAINS" :key="d.key" :value="d.key">{{ d.label }}</option>
        </select>

        <label class="qz-label">คำอธิบายเฉลย (ไม่บังคับ)</label>
        <textarea v-model="draft.explanation" :maxlength="LIMITS.explanation" class="qz-input" rows="2" placeholder="อธิบายว่าทำไมข้อนี้ถูก…"></textarea>

        <label class="qz-label">หมายเหตุผู้ตรวจ (นักศึกษาเห็นท้ายเฉลย — ไม่บังคับ)</label>
        <textarea v-model="draft.reviewNote" :maxlength="LIMITS.reviewNote" class="qz-input" rows="2" placeholder="ข้อควรระวัง / จุดที่คนมักเข้าใจผิด…"></textarea>

        <label class="qz-check">
          <input type="checkbox" v-model="draft.isPublished" />
          เผยแพร่ให้นักศึกษาเห็น (ติ๊กออก = ร่าง เห็นเฉพาะทีมวิชาการ)
        </label>

        <div v-if="draft.id && editReviews.length" class="qz-reviews">
          <div class="qz-reviews-head"><Emoji char="🔍" /> ผลตรวจจากทีมวิชาการ ({{ editReviews.length }})</div>
          <div v-for="r in editReviews" :key="r.id" class="qz-review">
            <b>{{ r.reviewerName || 'ไม่ระบุ' }}</b> — {{ VERDICT_LABEL[r.verdict] || r.verdict }}
            <div v-if="r.reason" class="qz-review-reason">{{ r.reason }}</div>
            <div v-if="r.ref" class="qz-review-ref">เรฟ: {{ r.ref }}</div>
          </div>
          <div class="qz-reviews-hint">แก้โจทย์/ตัวเลือก/เฉลย/คำอธิบายแล้วบันทึก → ผลตรวจถูกล้าง ข้อกลับเข้าคิวตรวจใหม่อัตโนมัติ</div>
        </div>
        <div class="qz-actions">
          <button v-if="draft.id" class="qz-btn qz-gray" @click="resetDraft">ยกเลิก</button>
          <button class="qz-btn qz-primary" :disabled="!valid || saving" @click="save">
            {{ saving ? 'กำลังบันทึก…' : (draft.id ? 'บันทึกการแก้ไข' : 'เพิ่มข้อสอบ') }}
          </button>
        </div>
        <button v-if="draft.id && authStore.isAdmin" class="qz-mini" style="margin-top:8px" @click="resetReviewState">
          🔍 ล้างผลตรวจข้อนี้ (ส่งกลับเข้าคิว peer-review)
        </button>
        <button v-if="draft.id && !isDraftRetired" class="qz-mini" style="margin-top:8px" @click="retireQuestion">
          🗑️ นำออกจากการใช้งาน (ไม่ลบ — เก็บไว้ นำกลับมาได้)
        </button>
        <button v-if="draft.id && isDraftRetired" class="qz-mini" style="margin-top:8px" @click="unretireQuestion">
          ↩️ นำกลับมาใช้ (กลับเข้าคิวตรวจใหม่)
        </button>
      </section>
      </template>

      <!-- ── 📚 แท็บ คลัง : ค้นหา/กรอง/รายการ/batch ── -->
      <template v-if="activeTab === 'bank'">
      <!-- ── list ── -->
      <div class="qz-list-head">
        <span>รายการข้อสอบ</span>
        <button class="qz-mini" :disabled="loading" @click="load">{{ loading ? '...' : '↻ โหลด' }}</button>
      </div>

      <!-- ── ค้นหา / กรอง ── -->
      <div v-if="list.length" class="qz-overview">
        <Emoji char="📊" /> ทั้งหมด <b>{{ bank.total }}</b> ข้อ · เผยแพร่ <b>{{ bank.published }}</b> · ร่าง <b>{{ bank.draft }}</b>
        <span class="qz-ov-dom">
          <template v-for="k in DOMAIN_KEYS" :key="k">
            <span v-if="bank.byDomain[k]"> · {{ domainLabel(k) || k }} {{ bank.byDomain[k] }}</span>
          </template>
          <span v-if="bank.byDomain.none"> · ไม่ระบุ {{ bank.byDomain.none }}</span>
        </span>
      </div>

      <div v-if="list.length" class="qz-filters">
        <input v-model="search" class="qz-input qz-search" type="text" aria-label="ค้นหาข้อสอบ" spellcheck="false" placeholder="🔍 ค้นหาโจทย์ / หมวด…" />
        <div class="qz-filter-row">
          <select v-model="statusFilter" class="qz-select" aria-label="กรองตามสถานะ">
            <option value="all">ทุกสถานะ</option>
            <option value="published">เผยแพร่</option>
            <option value="draft">ร่าง</option>
          </select>
          <select v-model="catFilter" class="qz-select" aria-label="กรองตามหมวด">
            <option value="__all">ทุกหมวด</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="domainFilter" class="qz-select" aria-label="กรองตาม domain">
            <option value="__all">ทุก domain</option>
            <option v-for="d in DOMAINS" :key="d.key" :value="d.key">{{ d.label }}</option>
            <option value="__none">ไม่ระบุหมวด</option>
          </select>
        </div>
        <select v-model="reviewFilter" class="qz-input qz-filter-rv" aria-label="กรองตามสถานะตรวจ">
          <option value="">สถานะตรวจ: ทั้งหมด</option>
          <option value="pending">รอตรวจ</option>
          <option value="half">ตรวจแล้ว 1 คน</option>
          <option value="passed">ผ่านตรวจ</option>
          <option value="conflict">ขัดแย้ง</option>
          <option value="failed">ไม่ผ่าน</option>
          <option value="retired">นำออก</option>
        </select>
      </div>

      <!-- ── เลือกหลายข้อ + batch ── -->
      <div v-if="filtered.length" class="qz-batch">
        <label class="qz-selall">
          <input type="checkbox" :checked="allFilteredSelected" @change="toggleSelectAllFiltered" />
          เลือกทั้งหมดในผลกรอง ({{ filtered.length }})
        </label>
        <button v-if="selected.size" class="qz-mini" @click="clearSelection">ล้างที่เลือก</button>
      </div>
      <div v-if="selected.size" class="qz-batch-actions">
        <span class="qz-selcount">เลือก {{ selected.size }} ข้อ →</span>
        <button class="qz-mini" :disabled="batchBusy" @click="batchPublish(true)">เผยแพร่</button>
        <button class="qz-mini" :disabled="batchBusy" @click="batchPublish(false)">ถอนเป็นร่าง</button>
        <button class="qz-mini qz-danger" :disabled="batchBusy" @click="batchDelete">ลบ</button>
      </div>
      <div v-if="selected.size" class="qz-batch-tag">
        <ExamSetSelect v-model="batchSets" />
        <button class="qz-mini" :disabled="batchBusy || !batchSets.length" @click="batchTag">เพิ่มชุดให้ {{ selected.size }} ข้อที่เลือก</button>
      </div>
      <button
        v-if="filteredDraftIds.length"
        class="qz-btn qz-primary qz-pubfiltered" :disabled="batchBusy"
        @click="publishAllFilteredDrafts"
      >
        {{ batchBusy ? 'กำลังทำ…' : `🚀 เผยแพร่ร่างที่กรองอยู่ทั้งหมด (${filteredDraftIds.length})` }}
      </button>

      <div v-if="loading" class="qz-empty">กำลังโหลด…</div>
      <div v-else-if="!list.length" class="qz-empty">ยังไม่มีข้อสอบ — เพิ่มข้อแรกได้เลย</div>
      <div v-else-if="!filtered.length" class="qz-empty">ไม่พบข้อสอบตามเงื่อนไข</div>
      <ul v-else class="qz-list">
        <li v-for="q in visible" :key="q.id" class="qz-item" :class="{ sel: selected.has(q.id), open: expandedId === q.id }">
          <div class="qz-row" role="button" tabindex="0" :aria-expanded="expandedId === q.id" @click="toggleExpand(q.id)" @keydown.enter.space.prevent="toggleExpand(q.id)">
            <input class="qz-check-item" type="checkbox" :checked="selected.has(q.id)" @click.stop @change="toggleSelect(q.id)" />
            <span class="qz-badge" :class="q.isPublished ? 'pub' : 'draft'">{{ q.isPublished ? 'เผยแพร่' : 'ร่าง' }}</span>
            <span class="qz-badge rv" :class="reviewStatusKey(q)">{{ REVIEW_STATUS_LABEL[reviewStatusKey(q)] }}</span>
            <span v-if="q.domain" class="qz-cat">{{ domainLabel(q.domain) || q.domain }}</span>
            <span v-if="problemPct(q.id) !== null" class="qz-badge-stat low">
              <Emoji char="🔴" /> {{ problemPct(q.id) }}%
            </span>
            <span v-if="reportCountMap[q.id]" class="qz-badge-stat rep">
              <Emoji char="🚩" /> {{ reportCountMap[q.id] }}
            </span>
            <span class="qz-row-q">{{ q.question }}</span>
            <span class="qz-chev" :class="{ open: expandedId === q.id }">▸</span>
          </div>
          <div v-if="expandedId === q.id" class="qz-detail">
            <div class="qz-detail-q">{{ q.question }}</div>
            <span v-for="c in getCategories(q)" :key="c" class="qz-cat qz-cat-sm">{{ c }}</span>
            <ul class="qz-choices">
              <li v-for="(c, i) in q.choices" :key="i" :class="{ correct: i === q.answer }">
                <span class="qz-c-letter">{{ LETTERS[i] }}</span>{{ c }}
              </li>
            </ul>
            <div v-if="q.explanation" class="qz-exp"><Emoji char="💡" /> {{ q.explanation }}</div>
            <div v-if="q.reviewNote" class="qz-note"><Emoji char="📝" /> {{ q.reviewNote }}</div>
            <div class="qz-audit">
              <div class="qz-audit-row"><b>เพิ่มโดย:</b> {{ q.createdByName || 'ไม่ระบุ' }}<span v-if="q.source === 'import'"> · นำเข้า</span> · {{ fmtTime(q.createdAt) || '—' }}</div>
              <div class="qz-audit-row"><b>สถานะตรวจ:</b> {{ REVIEW_STATUS_LABEL[reviewStatusKey(q)] }}</div>
              <div v-if="detailReviewsLoading" class="qz-audit-row">กำลังโหลดผลตรวจ…</div>
              <template v-else-if="detailReviews.length">
                <div class="qz-audit-head">ผลตรวจรอบปัจจุบัน ({{ detailReviews.length }})</div>
                <div v-for="r in detailReviews" :key="r.id" class="qz-audit-rev">
                  <b>{{ r.reviewerName || 'ไม่ระบุ' }}</b> — {{ VERDICT_LABEL[r.verdict] || r.verdict }}
                  <span v-if="r.reason" class="qz-audit-reason">· {{ r.reason }}</span>
                </div>
              </template>
            </div>
            <QuestionComments :questionId="q.id" />
            <div class="qz-detail-actions">
              <button class="qz-mini" @click="edit(q)">แก้ไข</button>
              <button class="qz-mini qz-danger" @click="remove(q)">ลบ</button>
            </div>
          </div>
        </li>
      </ul>
      <button v-if="filtered.length > visible.length" class="qz-btn qz-gray qz-more" @click="visibleCount += PAGE">
        แสดงเพิ่ม ({{ filtered.length - visible.length }} เหลือ)
      </button>
      </template>
    </template>
  </div>
</template>

<script setup>
import Emoji from '../components/shared/Emoji.vue'
import QuestionComments from '../components/questions/QuestionComments.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, limit, serverTimestamp, writeBatch, setDoc, deleteField, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { useAuthStore } from '../stores/auth.js'
import { useUsageStore } from '../stores/usage.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import { cleanText, LIMITS } from '../utils/text.js'
import { bankStats } from '../utils/questionBankStats.js'
import { parseImport } from '../utils/importQuestions.js'
import { qhash, groupDuplicates } from '../utils/qhash.js'
import { planImportWrites, stampFileSets } from '../utils/importTagging.js'
import { keepKnownSets } from '../utils/examSets.js'
import { useExamSets } from '../composables/useExamSets.js'
import { buildMeta } from '../utils/questionsMeta.js'
import { filterQuestions, distinctCategories } from '../utils/questionsFilter.js'
import { getCategories, normalizeCategories } from '../utils/questionCategories.js'
import { groupReports, resolvePayload } from '../utils/questionReport.js'
import { buildReportRewardMail } from '../utils/mailbox.js'
import { pctCorrect, isProblem } from '../utils/questionStats.js'
import { reviewContentChanged, REVIEW_RESET, reviewStatusKey, REVIEW_STATUS_LABEL, VERDICT_LABEL } from '../utils/questionReview.js'
import { REPORT_REWARD, QUESTION_STAT_MIN_ATTEMPTS, QUESTION_STAT_PROBLEM_PCT } from '../data/index.js'
import { DOMAINS, DOMAIN_KEYS, domainLabel } from '../data/domains.js'
import TopicSelect from '../components/questions/TopicSelect.vue'
import ExamSetSelect from '../components/questions/ExamSetSelect.vue'

const authStore = useAuthStore()
const usage = useUsageStore()
const { toast } = useToast()
const { confirm } = useConfirm()

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

const list = ref([])
const activeTab = ref('edit')   // แท็บงานในหน้า: edit (เพิ่ม/แก้) | bank (คลัง) | check (ตรวจสอบ)
const loading = ref(false)
const saving = ref(false)

// ── ค้นหา / กรอง / แบ่งหน้า / เลือกหลายข้อ (admin UX) ──
const PAGE = 50
const search = ref('')
const statusFilter = ref('all')   // all | published | draft
const catFilter = ref('__all')
const domainFilter = ref('__all')
const reviewFilter = ref('')      // '' | pending | half | passed | conflict | failed | retired
const visibleCount = ref(PAGE)
const selected = ref(new Set())   // เก็บ id ที่เลือก (Vue 3 track Set ได้)
const batchBusy = ref(false)
const batchSets = ref([])   // ชุดที่จะ tag ให้ข้อที่เลือก
const expandedId = ref(null)
const detailReviews = ref([])          // reviews ของข้อที่กางอยู่ (รอบปัจจุบัน)
const detailReviewsLoading = ref(false)
async function toggleExpand(id) {
  if (expandedId.value === id) { expandedId.value = null; return }
  expandedId.value = id
  detailReviews.value = []
  const q = list.value.find(x => x.id === id)
  if (!q || !(q.reviewedBy?.length)) return
  detailReviewsLoading.value = true
  try {
    const snap = await getDocs(collection(db, 'questions', id, 'reviews'))
    usage.track(snap.size)
    if (expandedId.value !== id) return   // FIX (fable): กางข้ออื่นไปแล้วระหว่าง await — ทิ้งผลเก่า
    detailReviews.value = snap.docs.filter(d => (q.reviewedBy || []).includes(d.id)).map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[detail reviews]', e) }
  finally { detailReviewsLoading.value = false }
}

const categories = computed(() => distinctCategories(list.value))
const filtered = computed(() => {
  let r = filterQuestions(list.value, {
    search: search.value, status: statusFilter.value, category: catFilter.value,
  })
  if (domainFilter.value === '__none') r = r.filter(q => !q.domain)
  else if (domainFilter.value !== '__all') r = r.filter(q => q.domain === domainFilter.value)
  // กรองสถานะตรวจ — ต้องอยู่ท้ายสุดเพื่อให้นับ filtered.length ถูก (count บนหัว + batch ใช้ filtered)
  if (reviewFilter.value) r = r.filter(q => reviewStatusKey(q) === reviewFilter.value)
  return r
})
const visible = computed(() => filtered.value.slice(0, visibleCount.value))
const bank = computed(() => bankStats(list.value))
const filteredDraftIds = computed(() => filtered.value.filter(q => !q.isPublished).map(q => q.id))
const allFilteredSelected = computed(() =>
  filtered.value.length > 0 && filtered.value.every(q => selected.value.has(q.id)))

// กรองใหม่ → รีเซ็ตจำนวนที่โชว์ (กัน DOM ค้างเยอะ)
watch([search, statusFilter, catFilter, domainFilter, reviewFilter], () => { visibleCount.value = PAGE })

function toggleSelect(id) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}
function toggleSelectAllFiltered() {
  if (allFilteredSelected.value) filtered.value.forEach(q => selected.value.delete(q.id))
  else filtered.value.forEach(q => selected.value.add(q.id))
}
function clearSelection() { selected.value.clear() }

// commit ids เป็น batch ละ 500 (ลิมิต Firestore) · fn(batch, ref) สั่งงานต่อ doc
async function commitInChunks(ids, fn) {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const batch = writeBatch(db)
    for (const id of chunk) fn(batch, doc(db, 'questions', id))
    await batch.commit()
    usage.track(0, chunk.length)
  }
}

async function afterBatch(msg) {
  clearSelection()
  await load()
  await recomputeMeta() // สถานะเผยแพร่เปลี่ยน → meta (publishedTotal/หมวด) ต้องคำนวณใหม่
  toast(msg, 'success')
}

async function batchPublish(value) {
  const ids = [...selected.value]
  if (!ids.length || batchBusy.value) return
  batchBusy.value = true
  try {
    await commitInChunks(ids, (b, ref) => b.update(ref, { isPublished: value, updatedAt: serverTimestamp() }))
    await afterBatch(`${value ? 'เผยแพร่' : 'ถอนเป็นร่าง'} ${ids.length} ข้อแล้ว`)
  } catch (e) { console.error('[batch publish]', e); toast('ทำไม่สำเร็จ', 'error') }
  finally { batchBusy.value = false }
}

// batch-tag: arrayUnion ชุดเข้าทุกข้อที่เลือก — ไม่แตะ review keys → ไม่ล้างผลตรวจ
async function batchTag() {
  const ids = [...selected.value]
  if (!ids.length || !batchSets.value.length || batchBusy.value) return
  batchBusy.value = true
  try {
    await commitInChunks(ids, (b, ref) => b.update(ref, { examSets: arrayUnion(...batchSets.value), updatedAt: serverTimestamp() }))
    batchSets.value = []
    await afterBatch(`เพิ่มชุดให้ ${ids.length} ข้อแล้ว`)
  } catch (e) { console.error('[batch tag]', e); toast('เพิ่มชุดไม่สำเร็จ', 'error') }
  finally { batchBusy.value = false }
}

// แอดมินสั่งล้างผลตรวจ (รีวิวพลาด/อยากให้ตรวจใหม่โดยไม่แก้เนื้อหา) — ทางที่ถูกต้องแทนการ
// ลบ review subdoc ตรงๆ ซึ่งทิ้ง aggregate ค้าง · ตัวนับ leaderboard ไม่ลด (เครดิตผู้ตรวจเดิมยังอยู่
// subdoc เก่าถูกกรองออกจากจอ conflict ด้วย reviewedBy และถูกเขียนทับเมื่อตรวจรอบใหม่)
async function resetReviewState() {
  const id = draft.value.id
  if (!id || !(await confirm('ล้างผลตรวจข้อนี้ให้กลับเข้าคิว peer-review ใหม่?'))) return
  try {
    await updateDoc(doc(db, 'questions', id), { ...REVIEW_RESET, reviewVerdicts: deleteField() })
    usage.track(0, 1)
    const idx = list.value.findIndex(q => q.id === id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx], ...REVIEW_RESET }
    toast('ล้างผลตรวจแล้ว — ข้อนี้กลับเข้าคิวตรวจใหม่', 'success')
  } catch (e) { console.error('[review reset]', e); toast('ล้างไม่สำเร็จ', 'error') }
}

async function batchDelete() {
  const ids = [...selected.value]
  if (!ids.length || batchBusy.value) return
  if (!(await confirm(`ลบข้อสอบที่เลือก ${ids.length} ข้อ? (ลบถาวร)`))) return
  batchBusy.value = true
  try {
    await commitInChunks(ids, (b, ref) => b.delete(ref))
    await afterBatch(`ลบ ${ids.length} ข้อแล้ว`)
  } catch (e) { console.error('[batch delete]', e); toast('ลบไม่สำเร็จ', 'error') }
  finally { batchBusy.value = false }
}

// ปุ่มลัด: เผยแพร่ "ร่างที่กรองอยู่" ทั้งหมด — จบงานหลัง import คลิกเดียว
async function publishAllFilteredDrafts() {
  const ids = filteredDraftIds.value
  if (!ids.length || batchBusy.value) return
  if (!(await confirm(`เผยแพร่ร่างที่กรองอยู่ทั้งหมด ${ids.length} ข้อ?`))) return
  batchBusy.value = true
  try {
    await commitInChunks(ids, (b, ref) => b.update(ref, { isPublished: true, updatedAt: serverTimestamp() }))
    await afterBatch(`เผยแพร่ ${ids.length} ข้อแล้ว`)
  } catch (e) { console.error('[publish drafts]', e); toast('เผยแพร่ไม่สำเร็จ', 'error') }
  finally { batchBusy.value = false }
}

function blankDraft() {
  return { id: null, question: '', choices: ['', '', '', ''], answer: 0, categories: [], reviewNote: '', explanation: '', isPublished: false, domain: null, examSets: [] }
}
const draft = ref(blankDraft())
// รีวิวของข้อที่กำลังแก้ (ประกาศก่อน resetDraft — กัน TDZ ถ้าอนาคตมีใครเรียกตอน setup)
const editReviews = ref([])
function resetDraft() { draft.value = blankDraft(); editReviews.value = [] }

const valid = computed(() => {
  const d = draft.value
  const filled = d.choices.filter(c => c.trim()).length
  return d.question.trim() && filled >= 2 && d.choices[d.answer]?.trim()
})

function removeChoice(i) {
  if (draft.value.choices.length <= 2) return
  draft.value.choices.splice(i, 1)
  // keep answer pointing at a valid index
  if (draft.value.answer >= draft.value.choices.length) draft.value.answer = draft.value.choices.length - 1
  else if (draft.value.answer > i) draft.value.answer--
}

onMounted(() => {
  if (!authStore.isQuestionEditor) return
  load()
  loadStats()
  loadExamSets()
  if (authStore.isAcademic) loadReports()
})

// ── bulk JSON import ──
const FORMAT_EXAMPLE = `[
  {
    "question": "ยาใดเป็น first-line ของ ...",
    "choices": ["ก", "ข", "ค", "ง"],
    "answer": 2,
    "category": "ยาปฏิชีวนะ",
    "explanation": "เพราะ ..."
  }
]`
const importText = ref('')
const importing = ref(false)
const fileEl = ref(null)
const { sets: examSetOptions, loadExamSets } = useExamSets()
const fileSets = ref([])   // ชุดที่จะ stamp ทั้งไฟล์

// เลือกไฟล์ .json จากเครื่อง → เทเนื้อหาลง textarea (parse/preview เหมือนวางเอง)
async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    importText.value = await file.text()
    const { rows, error } = parseImport(importText.value)
    if (error) toast(error, 'error')
    else toast(`อ่านไฟล์แล้ว · พบ ${rows.length} ข้อ`, 'success')
  } catch (err) {
    console.error('[questions import file]', err)
    toast('อ่านไฟล์ไม่สำเร็จ', 'error')
  } finally {
    e.target.value = '' // reset ให้เลือกไฟล์เดิมซ้ำได้
  }
}
const importParsed = computed(() => parseImport(importText.value))
const importCount = computed(() => importParsed.value.rows.length)
const importSkipped = computed(() => importParsed.value.skipped.length)
const importError = computed(() => (importText.value.trim() ? importParsed.value.error : null))

async function runImport() {
  if (importing.value) return
  const { rows: rawRows, skipped, error } = parseImport(importText.value)
  if (error) { toast(error, 'error'); return }
  if (!rawRows.length) { toast('ไม่มีข้อที่นำเข้าได้', 'error'); return }
  importing.value = true
  try {
    await loadExamSets()   // FIX: กัน race — โหลด config/examSets ให้ครบก่อนอ่าน known (ไม่งั้น strip แท็กเงียบ)
    const known = examSetOptions.value.map(s => s.name)
    // เตือนชื่อชุดที่ผู้ใช้ขอแต่ไม่อยู่ใน config (ถูกตัดทิ้งเพื่อกัน fragmentation)
    const knownSet = new Set(known)
    const requested = new Set([...fileSets.value, ...rawRows.flatMap(r => Array.isArray(r.examSets) ? r.examSets : [])])
    const dropped = [...requested].filter(s => s && !knownSet.has(s))
    if (dropped.length) console.warn('[questions import] ชื่อชุดไม่อยู่ใน config ถูกตัดทิ้ง:', dropped)
    // 1) stamp ชุดทั้งไฟล์ให้ข้อที่ยังไม่มีชุด → 2) คัดเฉพาะชื่อชุดที่รู้จัก (กัน fragmentation)
    const stamped = stampFileSets(rawRows, keepKnownSets(fileSets.value, known))
    const rows = stamped.map(r => ({ ...r, examSets: keepKnownSets(r.examSets, known) }))
    // 3) วางแผนเขียน: ข้อใหม่ = fresh, ข้อซ้ำคลัง+มีชุด = tagUpdate (arrayUnion เข้า doc เดิม)
    const existing = list.value.map(q => ({ id: q.id, qhash: (typeof q.qhash === 'string' ? q.qhash : qhash(q.question)) }))
    const { fresh, tagUpdates } = planImportWrites(rows, existing)
    if (!fresh.length && !tagUpdates.length) { toast('ทุกข้อซ้ำคลังและไม่มีชุดใหม่ให้เพิ่ม', 'error'); return }
    const meta = {
      createdBy: authStore.currentUser?.uid || null,
      createdByName: authStore.userData?.nickname || authStore.userData?.name || null,
      source: 'import',
      ...REVIEW_RESET,
    }
    // เขียน fresh (chunk 500) — ข้อใหม่พร้อม examSets
    const col = collection(db, 'questions')
    for (let i = 0; i < fresh.length; i += 500) {
      const batch = writeBatch(db)
      for (const r of fresh.slice(i, i + 500)) {
        batch.set(doc(col), { ...r, ...meta, qhash: qhash(r.question), rand: Math.random(), createdAt: serverTimestamp() })
      }
      await batch.commit()
    }
    // arrayUnion tag เข้า doc เดิม (chunk 500) — ไม่แตะ review keys → ไม่ล้างผลตรวจ
    for (let i = 0; i < tagUpdates.length; i += 500) {
      const batch = writeBatch(db)
      for (const t of tagUpdates.slice(i, i + 500)) {
        batch.update(doc(db, 'questions', t.id), { examSets: arrayUnion(...t.addSets), updatedAt: serverTimestamp() })
      }
      await batch.commit()
    }
    if (skipped.length) console.warn('[questions import] ข้ามข้อ:', skipped)
    const parts = [`นำเข้าใหม่ ${fresh.length} ข้อ`]
    if (tagUpdates.length) parts.push(`เพิ่มแท็กข้อเดิม ${tagUpdates.length} ข้อ`)
    if (skipped.length) parts.push(`ผิดรูปแบบ ${skipped.length} ข้อ`)
    toast(parts.join(' · '), 'success')
    importText.value = ''
    fileSets.value = []
    await load()
    await recomputeMeta()
  } catch (e) {
    console.error('[questions import]', e)
    toast('นำเข้าไม่สำเร็จ', 'error')
  } finally {
    importing.value = false
  }
}

const backfilling = ref(false)
// เติม rand + qhash ให้ข้อเก่าที่ยังไม่มี field
//  - rand จำเป็นก่อน quiz windowed query (orderBy('rand') ไม่คืน doc ที่ไม่มี rand)
//  - qhash จำเป็นก่อนใช้ตรวจซ้ำ/กันซ้ำ import (ข้อเก่าก่อน Phase 6 ยังไม่มี)
async function backfillRand() {
  if (backfilling.value) return
  if (!(await confirm('เติมค่า rand + qhash ให้ข้อสอบเก่าที่ยังไม่มี? (ทำครั้งเดียวก่อนใช้ควิซแบบใหม่/ตรวจซ้ำ)'))) return
  backfilling.value = true
  try {
    const snap = await getDocs(query(collection(db, 'questions'), orderBy('createdAt', 'desc')))
    usage.track(snap.size)
    // เติมเฉพาะ field ที่ขาด — ไม่ re-roll rand ของข้อที่มีอยู่แล้ว
    const missing = snap.docs.filter(d => {
      const data = d.data()
      return typeof data.rand !== 'number' || typeof data.qhash !== 'string'
    })
    for (let i = 0; i < missing.length; i += 500) {
      const batch = writeBatch(db)
      for (const d of missing.slice(i, i + 500)) {
        const data = d.data()
        const patch = {}
        if (typeof data.rand !== 'number') patch.rand = Math.random()
        if (typeof data.qhash !== 'string') patch.qhash = qhash(data.question || '')
        batch.update(d.ref, patch)
      }
      await batch.commit()
    }
    toast(`เติม rand/qhash แล้ว ${missing.length} ข้อ`, 'success')
  } catch (e) {
    console.error('[backfill rand/qhash]', e); toast('เติมไม่สำเร็จ', 'error')
  } finally { backfilling.value = false }
}

// ── ตรวจซ้ำในคลัง (Phase 6): จัดกลุ่มข้อที่ qhash ชนกัน โชว์ให้ลบ ──
const dupOpen = ref(false)
const duplicateGroups = computed(() => groupDuplicates(list.value))

const recomputingMeta = ref(false)
// อ่านทั้งคลังครั้งเดียว (admin เท่านั้น = ถูก) → เขียน config/questionsMeta
// ให้หน้า quiz home ใช้แทนการ getDocs ทั้งคลัง
async function recomputeMeta() {
  if (recomputingMeta.value) return
  recomputingMeta.value = true
  try {
    const snap = await getDocs(collection(db, 'questions'))
    usage.track(snap.size)
    const meta = buildMeta(snap.docs.map(d => d.data()))
    await setDoc(doc(db, 'config', 'questionsMeta'), { ...meta, updatedAt: serverTimestamp() })
    toast(`อัปเดต meta: เผยแพร่ ${meta.publishedTotal} ข้อ, ${meta.categories.length} หมวด`, 'success')
  } catch (e) {
    console.error('[recompute meta]', e); toast('อัปเดต meta ไม่สำเร็จ', 'error')
  } finally { recomputingMeta.value = false }
}

async function load() {
  loading.value = true
  try {
    const snap = await getDocs(query(collection(db, 'questions'), orderBy('createdAt', 'desc')))
    usage.track(snap.size)
    list.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[questions load]', e); toast('โหลดข้อสอบไม่สำเร็จ', 'error') }
  finally { loading.value = false }
}

async function save() {
  if (!valid.value || saving.value) return
  saving.value = true
  const d = draft.value
  const payload = {
    question: cleanText(d.question, LIMITS.question),
    choices: d.choices.map(c => cleanText(c, LIMITS.choice)).filter(Boolean),
    answer: d.answer,
    categories: normalizeCategories(d.categories),
    reviewNote: cleanText(d.reviewNote, LIMITS.reviewNote) || null,
    explanation: cleanText(d.explanation, LIMITS.explanation) || null,
    isPublished: !!d.isPublished,
    domain: d.domain || null,
    examSets: Array.isArray(d.examSets) ? d.examSets : [],
    qhash: qhash(cleanText(d.question, LIMITS.question)), // กันซ้ำ + อัปเดตเมื่อแก้โจทย์
    updatedAt: serverTimestamp(),
  }
  // clamp answer in case trailing empty choices were dropped
  if (payload.answer >= payload.choices.length) payload.answer = 0
  try {
    if (d.id) {
      // เนื้อหาที่ผลตรวจผูกอยู่เปลี่ยน (โจทย์/ตัวเลือก/เฉลย/คำอธิบาย) → ล้างผลตรวจ
      // ให้กลับเข้าคิว peer-review ใหม่ — toggle publish/หมวดไม่ล้าง (ไม่ทิ้งงานผู้ตรวจฟรี)
      const before = list.value.find(q => q.id === d.id)
      if (reviewContentChanged(before, payload)) {
        // แก้เนื้อหา = ตั้งใจนำกลับมาใช้ — ล้างทั้งผลตรวจและสถานะนำออก ให้วนเข้าคิวตรวจใหม่
        Object.assign(payload, REVIEW_RESET, { reviewVerdicts: deleteField(), retired: deleteField() })
      }
      await updateDoc(doc(db, 'questions', d.id), payload)
      toast(payload.isPublished && payload.examSets.length ? 'บันทึกแล้ว · กด 🔄 คำนวณ meta ใหม่ ให้ชุดขึ้นในควิซ' : 'บันทึกการแก้ไขแล้ว', 'success')
    } else {
      await addDoc(collection(db, 'questions'), {
        ...payload,
        ...REVIEW_RESET,   // ประทับ reviewStatus:'pending' — หน้า /review query จาก field นี้
        rand: Math.random(),
        createdBy: authStore.currentUser?.uid || null,
        createdByName: authStore.userData?.nickname || authStore.userData?.name || null,
        createdAt: serverTimestamp(),
      })
      toast(payload.isPublished && payload.examSets.length ? 'เพิ่มข้อสอบแล้ว · กด 🔄 คำนวณ meta ใหม่ ให้ชุดขึ้นในควิซ' : 'เพิ่มข้อสอบแล้ว', 'success')
    }
    resetDraft()
    await load()
  } catch (e) { console.error('[questions save]', e); toast('บันทึกไม่สำเร็จ', 'error') }
  finally { saving.value = false }
}

// โหลดรีวิวของข้อที่กำลังแก้ — โชว์เหตุผลผู้ตรวจให้คนแก้เห็น (วงจร ตรวจ→รู้ผล→แก้ ครบรอบ)
async function loadEditReviews(q) {
  editReviews.value = []
  if (!q.reviewedBy?.length) return
  try {
    const snap = await getDocs(collection(db, 'questions', q.id, 'reviews'))
    usage.track(snap.size)
    // เฉพาะรีวิวรอบปัจจุบัน (กรองด้วย reviewedBy — subdoc รอบก่อน reset อาจค้าง)
    editReviews.value = snap.docs.filter(d => (q.reviewedBy || []).includes(d.id)).map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { console.error('[edit reviews]', e) }
}

const isDraftRetired = computed(() => {
  const q = list.value.find(x => x.id === draft.value.id)
  return !!q?.retired
})

// นำออก = ปลดระวาง: ถอนเผยแพร่ + ไม่เข้าคิวตรวจ (needsReviewBy กรอง retired) — ไม่ลบ ไม่แตะผลตรวจเดิม
async function retireQuestion() {
  const id = draft.value.id
  if (!id || !(await confirm('นำข้อนี้ออกจากการใช้งาน? (ถอนเผยแพร่ + ไม่เข้าคิวตรวจ — นำกลับมาได้ทีหลัง)'))) return
  try {
    await updateDoc(doc(db, 'questions', id), { retired: true, isPublished: false, updatedAt: serverTimestamp() })
    usage.track(0, 1)
    const idx = list.value.findIndex(q => q.id === id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx], retired: true, isPublished: false }
    toast('นำออกแล้ว — นำกลับมาได้จากปุ่มเดิม', 'success')
  } catch (e) { console.error('[retire]', e); toast('ทำไม่สำเร็จ', 'error') }
}

// นำกลับ = ล้างผลตรวจกลับเข้าคิว (ยังเป็นร่าง — ให้ทีมตรวจก่อนค่อยเผยแพร่เอง)
async function unretireQuestion() {
  const id = draft.value.id
  if (!id || !(await confirm('นำข้อนี้กลับมาใช้? (ล้างผลตรวจเดิม กลับเข้าคิวตรวจใหม่ — ยังเป็นร่างจนกว่าจะเผยแพร่)'))) return
  try {
    await updateDoc(doc(db, 'questions', id), { retired: deleteField(), ...REVIEW_RESET, reviewVerdicts: deleteField(), updatedAt: serverTimestamp() })
    usage.track(0, 1)
    const idx = list.value.findIndex(q => q.id === id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx], retired: false, ...REVIEW_RESET }
    toast('นำกลับมาแล้ว — ข้อนี้เข้าคิวตรวจใหม่', 'success')
  } catch (e) { console.error('[unretire]', e); toast('ทำไม่สำเร็จ', 'error') }
}

function edit(q) {
  draft.value = {
    id: q.id,
    question: q.question || '',
    choices: (q.choices && q.choices.length >= 2) ? [...q.choices] : ['', ''],
    answer: q.answer || 0,
    categories: getCategories(q),
    reviewNote: q.reviewNote || '',
    explanation: q.explanation || '',
    isPublished: !!q.isPublished,
    domain: q.domain || null,
    examSets: Array.isArray(q.examSets) ? [...q.examSets] : [],
  }
  loadEditReviews(q) // โหลดเหตุผลผู้ตรวจ (ไม่ await — ไม่บล็อก UX)
  activeTab.value = 'edit'   // แก้จากแท็บคลัง/ตรวจสอบ → เด้งมาแท็บฟอร์มให้เห็นข้อที่กำลังแก้
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function remove(q) {
  if (!(await confirm(`ลบข้อสอบนี้?\n\n"${q.question}"`))) return
  try {
    await deleteDoc(doc(db, 'questions', q.id))
    list.value = list.value.filter(x => x.id !== q.id)
    selected.value.delete(q.id)
    if (draft.value.id === q.id) resetDraft()
    toast('ลบแล้ว', 'success')
  } catch (e) { console.error('[questions remove]', e); toast('ลบไม่สำเร็จ', 'error') }
}

// ── ข้อที่ถูกแจ้งว่าผิด (Phase 5) ──
const reportsOpen = ref(false)
const reports = ref([])              // open reports (flat)
const reportsLoading = ref(false)
const resolvingId = ref(null)        // questionId ที่กำลังปิด
const reportGroups = computed(() => groupReports(reports.value))

const statMap = ref({})              // { qid: { a, c } } — สถิติ %ถูกรายข้อ
const reportsLoaded = ref(false)     // กัน loadReports ซ้ำ (mount + กางแผง)

const reportCountMap = computed(() => {
  const m = {}
  for (const g of reportGroups.value) m[g.questionId] = g.count
  return m
})
function problemPct(qid) {
  const s = statMap.value[qid]
  return isProblem(s, QUESTION_STAT_MIN_ATTEMPTS, QUESTION_STAT_PROBLEM_PCT)
    ? pctCorrect(s.a, s.c) : null
}

async function loadStats() {
  try {
    const snap = await getDocs(collection(db, 'questionStats'))
    usage.track(snap.size)
    const m = {}
    snap.docs.forEach(d => { m[d.id] = d.data() })
    statMap.value = m
  } catch (e) { console.error('[questionStats load]', e) }
}

function questionExists(qid) { return list.value.some(x => x.id === qid) }
function reportQuestionText(g) {
  const q = list.value.find(x => x.id === g.questionId)
  return q?.question || g.snapshot?.question || '(ไม่พบโจทย์)'
}
function fmtTime(t) {
  const ms = t?.toMillis ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : new Date(t).getTime())
  if (!ms || Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

async function loadReports() {
  reportsLoading.value = true
  try {
    const snap = await getDocs(query(
      collection(db, 'questionReports'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(200),
    ))
    usage.track(snap.size)
    reports.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    reportsLoaded.value = true
  } catch (e) { console.error('[reports load]', e); toast('โหลดรายการที่ถูกแจ้งไม่สำเร็จ', 'error') }
  finally { reportsLoading.value = false }
}

function onReportsToggle(e) {
  reportsOpen.value = e.target.open
  if (e.target.open && !reportsLoaded.value) loadReports()
}

function editReported(g) {
  const q = list.value.find(x => x.id === g.questionId)
  if (q) edit(q)
  else toast('ข้อนี้ถูกลบไปแล้ว — แก้ไขไม่ได้', 'error')
}

async function resolveReports(g, verdict) {
  if (resolvingId.value) return
  resolvingId.value = g.questionId
  try {
    const batch = writeBatch(db)
    if (verdict === 'valid') {
      // ผิดจริง → mint mail รางวัลให้ผู้แจ้งแต่ละคน (auto-deliver) + ปิด report เป็น delivered
      for (const r of g.reports) {
        const mailRef = doc(collection(db, 'users', r.reportedBy, 'mail'))
        batch.set(mailRef, buildReportRewardMail(r, REPORT_REWARD, serverTimestamp()))
        batch.update(doc(db, 'questionReports', r.id), {
          ...resolvePayload('valid', REPORT_REWARD),
          rewardDelivered: true,                 // ส่งทันที (auto-mint)
          resolvedAt: serverTimestamp(),
        })
      }
    } else {
      for (const r of g.reports) {
        batch.update(doc(db, 'questionReports', r.id), {
          ...resolvePayload('invalid', REPORT_REWARD),
          resolvedAt: serverTimestamp(),
        })
      }
    }
    await batch.commit()
    usage.track(0, verdict === 'valid' ? g.reports.length * 2 : g.reports.length)
    reports.value = reports.value.filter(r => r.questionId !== g.questionId) // ตัดกลุ่มที่ปิดออก
    toast(verdict === 'valid'
      ? `ส่งรางวัล ${REPORT_REWARD} เหรียญให้ผู้แจ้ง ${g.reports.length} คนแล้ว`
      : 'ปิดรายการแล้ว (ไม่ผิด)', 'success')
  } catch (e) { console.error('[resolve report]', e); toast('ปิดรายการไม่สำเร็จ', 'error') }
  finally { resolvingId.value = null }
}
</script>

<style scoped>
.qz-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.qz-title { font-family: var(--font-display); font-weight: 400; font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.qz-count { font-size: .66rem; color: rgba(0,0,0,.45); font-weight: 600; }
.qz-denied, .qz-empty { text-align: center; color: rgba(0,0,0,.4); padding: 26px 0; font-size: .85rem; }

/* ── แท็บงาน (in-component tabs) ── */
.qz-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.qz-tab { flex: 1; border: 2px solid var(--ink); background: #fff; border-radius: 11px; padding: 9px 6px; font-family: inherit; font-size: .78rem; font-weight: 800; color: var(--ink); cursor: pointer; transition: transform .1s, box-shadow .1s; }
.qz-tab.on { background: var(--primary); color: #fff; box-shadow: var(--pop); }
.qz-tab:active { transform: translate(1px,1px); }

.qz-import { background: #fff; border: 2px dashed var(--ink); border-radius: 16px; padding: 4px 14px; margin-bottom: 16px; }
.qz-import[open] { padding-bottom: 14px; }
.qz-import-sum { cursor: pointer; font-weight: 800; font-size: .9rem; padding: 11px 0; list-style: none; user-select: none; }
.qz-import-sum::-webkit-details-marker { display: none; }
.qz-import-sum::before { content: '▸ '; color: #94a3b8; }
.qz-import[open] .qz-import-sum::before { content: '▾ '; }
.qz-import-body { display: flex; flex-direction: column; gap: 9px; }
.qz-import-file { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.qz-pick { border: 1px dashed rgba(0,0,0,.25); background: none; border-radius: 9px; padding: 8px 13px; font-family: inherit; font-size: .76rem; font-weight: 700; color: #4f46e5; cursor: pointer; }
.qz-pick:active { transform: translate(1px,1px); }
.qz-pick-hint { font-size: .7rem; color: rgba(0,0,0,.4); }
.qz-import-ta { font-family: 'Space Mono', ui-monospace, monospace; font-size: .74rem; line-height: 1.5; white-space: pre; overflow-wrap: normal; overflow-x: auto; }
.qz-fmt { font-size: .72rem; }
.qz-fmt > summary { cursor: pointer; color: #4f46e5; font-weight: 700; }
.qz-fmt-pre { margin: 8px 0 6px; padding: 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 9px; font-family: 'Space Mono', ui-monospace, monospace; font-size: .68rem; line-height: 1.5; overflow-x: auto; }
.qz-fmt-note { color: rgba(0,0,0,.55); line-height: 1.6; }
.qz-fmt-note code { background: rgba(0,0,0,.06); padding: 1px 5px; border-radius: 5px; font-size: .92em; }
.qz-import-hint { font-size: .74rem; color: #15803d; font-weight: 600; }
.qz-import-err { font-size: .74rem; color: #dc2626; font-weight: 600; background: #fef2f2; border-radius: 8px; padding: 7px 10px; line-height: 1.4; }
.qz-import-btn { width: 100%; }
.qz-maint { background: #fff; color: var(--ink); }

.qz-card { background: #fff; border: 2px solid var(--ink); border-radius: 16px; box-shadow: var(--pop); padding: 14px; margin-bottom: 16px; }
.qz-card-head { font-weight: 800; font-size: .92rem; margin-bottom: 10px; }
.qz-label { display: block; font-size: .68rem; font-weight: 700; color: #64748b; margin: 10px 0 5px; }
.qz-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; resize: vertical; }
.qz-input:focus { outline: none; box-shadow: var(--pop); }
.qz-choice { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
.qz-radio { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 2px solid rgba(0,0,0,.15); background: #fff; color: rgba(0,0,0,.45); font-weight: 800; font-size: .82rem; cursor: pointer; }
.qz-radio.on { background: #22c55e; border-color: #22c55e; color: #fff; }
.qz-choice-in { flex: 1; }
.qz-del-choice { flex-shrink: 0; border: none; background: rgba(0,0,0,.05); border-radius: 8px; width: 28px; height: 28px; cursor: pointer; color: #ef4444; }
.qz-del-choice:disabled { opacity: .3; cursor: default; }
.qz-add-choice { margin-top: 2px; border: 1px dashed rgba(0,0,0,.2); background: none; border-radius: 9px; padding: 7px 12px; font-family: inherit; font-size: .74rem; font-weight: 700; color: #475569; cursor: pointer; }
.qz-add-choice:disabled { opacity: .4; cursor: default; }
.qz-check { display: flex; align-items: center; gap: 8px; font-size: .74rem; color: rgba(0,0,0,.65); margin-top: 12px; cursor: pointer; }
.qz-actions { display: flex; gap: 8px; margin-top: 14px; }
.qz-btn { flex: 1; border: 2px solid var(--ink); border-radius: 11px; padding: 11px; font-family: inherit; font-size: .85rem; font-weight: 800; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.qz-primary { background: var(--primary); color: #fff; box-shadow: var(--pop); }
.qz-primary:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 0 0 0 var(--ink); }
.qz-primary:disabled { background: #cbd5e1; cursor: default; box-shadow: none; }
.qz-gray { background: #fff; color: var(--ink); flex: 0 0 90px; }

.qz-list-head { display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: .85rem; margin-bottom: 8px; }
.qz-mini { border: none; border-radius: 8px; padding: 5px 10px; font-family: inherit; font-size: .7rem; font-weight: 700; cursor: pointer; background: rgba(0,0,0,.06); color: rgba(0,0,0,.6); }
.qz-mini.qz-danger { background: rgba(239,68,68,.12); color: #dc2626; }
.qz-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.qz-item { background: #fff; border: 2px solid var(--ink); border-radius: 14px; box-shadow: var(--pop); padding: 12px; }
.qz-item.sel { background: var(--primary-light, #eef2ff); }
.qz-check-item { width: 17px; height: 17px; flex-shrink: 0; accent-color: var(--primary); }
.qz-row { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.qz-row-q { flex: 1; min-width: 0; font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qz-chev { flex-shrink: 0; color: var(--muted); font-size: 1rem; transition: transform .15s; }
.qz-chev.open { transform: rotate(90deg); }
.qz-detail { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
.qz-detail-q { font-size: .86rem; font-weight: 700; color: var(--ink); line-height: 1.45; margin-bottom: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
.qz-cat-sm { display: inline-block; margin-bottom: 6px; }
.qz-detail-actions { display: flex; gap: 6px; margin-top: 8px; }

/* ── header ภาพรวมคลัง ── */
.qz-overview { font-size: .72rem; color: var(--ink); background: var(--primary-light, #eef2ff); border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; line-height: 1.5; }
.qz-overview b { font-weight: 800; }
.qz-ov-dom { color: var(--muted); }

/* ── filters / batch ── */
.qz-filters { display: flex; flex-direction: column; gap: 7px; margin-bottom: 10px; }
.qz-search { font-size: .8rem; }
.qz-filter-row { display: flex; gap: 7px; }
.qz-select { flex: 1; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: .78rem; font-weight: 700; background: #fff; color: var(--ink); }
.qz-batch { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.qz-selall { display: flex; align-items: center; gap: 7px; font-size: .74rem; font-weight: 700; color: rgba(0,0,0,.6); cursor: pointer; }
.qz-selall input { width: 16px; height: 16px; accent-color: var(--primary); }
.qz-batch-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; background: #f8fafc; border-radius: 10px; padding: 8px 10px; }
.qz-batch-tag { display: flex; flex-direction: column; gap: 7px; margin: 8px 0 10px; padding: 9px 10px; background: #f8fafc; border-radius: 10px; }
.qz-selcount { font-size: .72rem; font-weight: 800; color: var(--ink); }
.qz-pubfiltered { width: 100%; margin-bottom: 12px; }
.qz-more { width: 100%; margin-top: 10px; }
.qz-badge { font-size: .58rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.qz-badge.pub { background: rgba(34,197,94,.15); color: #15803d; }
.qz-badge.draft { background: rgba(0,0,0,.07); color: rgba(0,0,0,.5); }
.qz-cat { font-size: .62rem; color: #4f46e5; font-weight: 700; }
.qz-badge-stat { flex-shrink: 0; font-size: .68rem; font-weight: 700; padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
.qz-badge-stat.low { background: #fef2f2; color: #b91c1c; }
.qz-badge-stat.rep { background: #fff7ed; color: #c2410c; }
.qz-choices { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.qz-choices li { font-size: .76rem; color: rgba(0,0,0,.6); display: flex; gap: 7px; align-items: baseline; padding: 4px 8px; border-radius: 7px; }
.qz-choices li.correct { background: rgba(34,197,94,.1); color: #15803d; font-weight: 700; }
.qz-c-letter { font-weight: 800; flex-shrink: 0; }
.qz-exp { margin-top: 8px; font-size: .72rem; color: #b45309; background: #fffbeb; border-radius: 8px; padding: 7px 10px; line-height: 1.4; }
.qz-note { margin-top: 7px; font-size: .74rem; color: #1e40af; background: #eff6ff; border-radius: 8px; padding: 8px 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }

/* ── ข้อที่ถูกแจ้งว่าผิด (Phase 5) ── */
.qz-reports { background: #fff; border: 2px dashed #f59e0b; border-radius: 16px; padding: 4px 14px; margin-bottom: 16px; }
.qz-reports[open] { padding-bottom: 14px; }
.qz-reports-sum { cursor: pointer; font-weight: 800; font-size: .9rem; padding: 11px 0; list-style: none; user-select: none; color: #b45309; }
.qz-reports-sum::-webkit-details-marker { display: none; }
.qz-reports-sum::before { content: '▸ '; color: #f59e0b; }
.qz-reports[open] .qz-reports-sum::before { content: '▾ '; }
.qz-reports-body { display: flex; flex-direction: column; gap: 10px; }
.qz-report-list { display: flex; flex-direction: column; gap: 10px; }
.qz-report-card { border: 1px solid rgba(0,0,0,.1); border-radius: 12px; padding: 11px; background: #fffdf7; }
.qz-report-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.qz-report-badge { font-size: .6rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(245,158,11,.16); color: #b45309; }
.qz-report-deleted { font-size: .6rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(239,68,68,.12); color: #dc2626; }
.qz-report-q { font-size: .82rem; font-weight: 700; color: #1e293b; margin-bottom: 7px; line-height: 1.4; }
.qz-report-reasons { list-style: none; margin: 0 0 9px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.qz-report-reasons li { font-size: .74rem; color: rgba(0,0,0,.7); line-height: 1.4; }
.qz-report-meta { color: rgba(0,0,0,.4); font-size: .68rem; }
.qz-report-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.qz-dup-note { font-size: .72rem; color: rgba(0,0,0,.5); line-height: 1.4; margin: 0 0 10px; }
.qz-dup-q { font-size: .82rem; font-weight: 700; color: #1e293b; margin-bottom: 8px; line-height: 1.4; }
.qz-dup-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.qz-dup-items li { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.qz-dup-acts { display: flex; gap: 6px; }

/* ── ป้ายสถานะตรวจ ── */
.qz-badge.rv.pending { background: #eef2ff; color: #4f46e5; }
.qz-badge.rv.half { background: rgba(245,158,11,.15); color: #b45309; }
.qz-badge.rv.passed { background: rgba(34,197,94,.15); color: #15803d; }
.qz-badge.rv.conflict { background: #fff7ed; color: #c2410c; }
.qz-badge.rv.failed { background: #fef2f2; color: #b91c1c; }
.qz-badge.rv.retired { background: rgba(0,0,0,.12); color: rgba(0,0,0,.55); }

/* ── ตัวกรองสถานะตรวจ ── */
.qz-filter-rv { margin-top: 6px; }

/* ── แผงเหตุผลผู้ตรวจ ── */
.qz-reviews { margin: 10px 0; border: 1px dashed var(--border); border-radius: 10px; padding: 10px 12px; background: #fffdf7; }
.qz-reviews-head { font-size: .72rem; font-weight: 800; color: #c2410c; margin-bottom: 6px; }
.qz-review { font-size: .78rem; margin-bottom: 7px; }
.qz-review-reason { color: rgba(0,0,0,.7); white-space: pre-wrap; overflow-wrap: anywhere; }
.qz-review-ref { font-size: .68rem; color: rgba(0,0,0,.45); overflow-wrap: anywhere; }
.qz-reviews-hint { font-size: .68rem; color: rgba(0,0,0,.5); margin-top: 4px; }

.qz-import-sets { display: flex; flex-direction: column; gap: 5px; }
.qz-import-sets-label { font-size: .7rem; font-weight: 700; color: #64748b; }

/* ── ประวัติข้อนี้ (audit, read-only) ── */
.qz-audit { margin-top: 10px; padding: 9px 11px; border: 1px dashed var(--border); border-radius: 10px; background: #fafafa; font-size: .72rem; color: rgba(0,0,0,.6); line-height: 1.55; }
.qz-audit-row b { color: rgba(0,0,0,.75); font-weight: 800; }
.qz-audit-head { font-weight: 800; color: #c2410c; margin-top: 5px; }
.qz-audit-rev { margin-top: 2px; }
.qz-audit-reason { color: rgba(0,0,0,.5); }
</style>
