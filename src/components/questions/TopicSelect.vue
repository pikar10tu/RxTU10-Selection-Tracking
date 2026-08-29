<!-- src/components/questions/TopicSelect.vue — เลือกกลุ่มโรค/หมวดตามเกณฑ์สภาฯ (2 ชั้น)
     v-model = { group, sub }  (group = key จาก data/plecc.js · sub = ชื่อโรคย่อย หรือ null)

     ⚠️ เดิมเป็นช่องพิมพ์หัวข้อใหม่อิสระ ซึ่งเป็นต้นเหตุที่ทะเบียนงอกเป็น 82 หมวดซ้ำซ้อน
        (29 ส.ค. 2026) — ตอนนี้เลือกได้เฉพาะจากทะเบียนตายตัวเท่านั้น ห้ามเติมช่องพิมพ์กลับมา
        ถ้าต้องเพิ่มกลุ่ม/โรคย่อยจริง ให้ไปแก้ที่ data/plecc.js แล้ว deploy -->
<template>
  <div class="ts">
    <!-- ค่าที่เลือกอยู่ (ชิป) -->
    <div v-if="group" class="ts-chips">
      <span class="ts-chip">
        {{ groupLabel(group) }}
        <span v-if="inferred" class="ts-guess" title="ระบบเดาให้จากหมวดเดิม ยังไม่มีคนยืนยัน">เดาให้</span>
      </span>
      <span v-if="sub" class="ts-chip ts-chip-sub">{{ sub }}</span>
    </div>

    <label class="ts-lbl">กลุ่มโรค / หมวด <span class="ts-req">*</span></label>
    <select class="ts-input" :value="group || ''" @change="onGroup">
      <option value="">— เลือกกลุ่ม —</option>
      <optgroup v-for="d in DOMAIN_ORDER" :key="d.key" :label="d.label">
        <option v-for="g in groupsOfDomain(d.key)" :key="g.key" :value="g.key">
          {{ g.n ? `${g.n}. ` : '' }}{{ groupLabel(g.key) }}
        </option>
      </optgroup>
    </select>

    <template v-if="group">
      <label class="ts-lbl">โรคย่อย <span class="ts-opt">(ไม่บังคับ)</span></label>
      <select class="ts-input" :value="sub || ''" @change="onSub">
        <option value="">— ไม่ระบุโรคย่อย —</option>
        <option v-for="s in subs" :key="s" :value="s">{{ s }}</option>
      </select>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { groupLabel, groupsOfDomain, subsOf, isValidSub, isPleGroupKey } from '../../data/plecc.js'

// modelValue = { group, sub, inferred? } — inferred เป็นแค่ป้ายบอกผู้ใช้ ไม่ถูกเขียนลง Firestore
const props = defineProps({ modelValue: { type: Object, default: () => ({ group: null, sub: null }) } })
const emit = defineEmits(['update:modelValue'])

// เรียง Care ก่อนเสมอ — เป็นฝั่งที่ข้อสอบเยอะสุด (สัดส่วนสภาฯ 50:40:10)
const DOMAIN_ORDER = [
  { key: 'care', label: 'ด้านผู้ป่วย (Care) — ตามภาคผนวก ๑ สภาฯ' },
  { key: 'sci', label: 'ด้านผลิตภัณฑ์ (Sci)' },
  { key: 'law', label: 'ด้านกฎหมาย (Law)' },
]

const group = computed(() => (isPleGroupKey(props.modelValue?.group) ? props.modelValue.group : null))
const sub = computed(() => (isValidSub(group.value, props.modelValue?.sub) ? (props.modelValue?.sub || null) : null))
const inferred = computed(() => !!props.modelValue?.inferred && !!group.value)
const subs = computed(() => subsOf(group.value))

// เปลี่ยนกลุ่ม = ล้างโรคย่อยทิ้งเสมอ (โรคย่อยของกลุ่มเก่าไม่มีทางถูกในกลุ่มใหม่)
// และล้าง inferred ด้วย — พอคนเลือกเองแล้วมันไม่ใช่ค่าที่ระบบเดาอีกต่อไป
function onGroup(e) {
  const g = e.target.value || null
  emit('update:modelValue', { group: isPleGroupKey(g) ? g : null, sub: null, inferred: false })
}
function onSub(e) {
  emit('update:modelValue', { group: group.value, sub: e.target.value || null, inferred: false })
}
</script>

<style scoped>
.ts-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.ts-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--primary-light, #eef2ff); color: #4f46e5; border-radius: 999px; padding: 4px 11px; font-size: .74rem; font-weight: 700; }
.ts-chip-sub { background: #f1f5f9; color: #334155; }
.ts-guess { background: #fef3c7; color: #92400e; border-radius: 999px; padding: 1px 7px; font-size: .7rem; font-weight: 800; }
.ts-lbl { display: block; font-size: .74rem; font-weight: 800; color: #334155; margin: 8px 0 4px; }
.ts-lbl:first-of-type { margin-top: 0; }
.ts-req { color: #dc2626; }
.ts-opt { font-weight: 600; color: rgba(0,0,0,.45); }
.ts-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; background: #fff; }
.ts-input:focus { outline: none; box-shadow: var(--pop); }
</style>
