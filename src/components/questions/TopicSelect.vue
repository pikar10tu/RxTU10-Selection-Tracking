<!-- src/components/questions/TopicSelect.vue — เลือกหมวด/กลุ่มโรคได้หลายค่า (สูงสุด MAX_CATEGORIES) -->
<template>
  <div class="ts">
    <!-- หมวดที่เลือกไว้ (ชิป) -->
    <div v-if="modelValue.length" class="ts-chips">
      <span v-for="name in modelValue" :key="name" class="ts-chip">
        {{ name }}
        <button type="button" class="ts-chip-x" @click="removeTopic(name)" aria-label="ถอดหมวดนี้">✕</button>
      </span>
    </div>

    <select class="ts-input" :value="''" :disabled="full" @change="onSelect">
      <option value="">{{ full ? `เลือกได้สูงสุด ${MAX_CATEGORIES} หมวด` : '+ เลือกหมวด / กลุ่มโรค…' }}</option>
      <option v-for="t in available" :key="t" :value="t">{{ t }}</option>
      <option value="__add">➕ เพิ่มหัวข้อใหม่…</option>
    </select>

    <div v-if="adding" class="ts-add">
      <input v-model="newName" :maxlength="LIMITS.category" class="ts-input" placeholder="ชื่อหัวข้อใหม่ เช่น ยาปฏิชีวนะ" @keydown.enter.prevent="confirmAdd" />
      <button type="button" class="ts-btn" :disabled="busy || !newName.trim()" @click="confirmAdd">เพิ่ม</button>
      <button type="button" class="ts-btn ts-cancel" @click="cancelAdd">ยกเลิก</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTopics } from '../../composables/useTopics.js'
import { useToast } from '../../composables/useToast.js'
import { LIMITS } from '../../utils/text.js'
import { MAX_CATEGORIES } from '../../utils/questionCategories.js'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const { topics, loadTopics, addTopic } = useTopics()
const { toast } = useToast()
const adding = ref(false)
const newName = ref('')
const busy = ref(false)

onMounted(loadTopics)

const full = computed(() => props.modelValue.length >= MAX_CATEGORIES)
// หัวข้อที่ยังไม่ถูกเลือก (ค่าที่เลือกแล้วไม่ต้องโผล่ซ้ำ)
const available = computed(() => topics.value.filter(t => !props.modelValue.includes(t)))

function add(name) {
  if (!name || props.modelValue.includes(name) || full.value) return
  emit('update:modelValue', [...props.modelValue, name])
}
function removeTopic(name) {
  emit('update:modelValue', props.modelValue.filter(n => n !== name))
}
function onSelect(e) {
  const v = e.target.value
  e.target.value = ''                    // reset ไม่ให้ค้างค่าใน select
  if (v === '__add') { adding.value = true; return }
  add(v)
}
function cancelAdd() { adding.value = false; newName.value = '' }

async function confirmAdd() {
  if (busy.value) return
  busy.value = true
  try {
    const name = await addTopic(newName.value)
    if (!name) { toast('ชื่อหัวข้อใช้ไม่ได้ ลองพิมพ์ใหม่', 'error'); return }   // cleanText strip จนว่าง
    add(name)
    cancelAdd()
  } catch (e) { console.error('[topic add]', e); toast('เพิ่มหัวข้อไม่สำเร็จ', 'error') }
  finally { busy.value = false }
}
</script>

<style scoped>
.ts-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.ts-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--primary-light, #eef2ff); color: #4f46e5; border-radius: 999px; padding: 4px 6px 4px 11px; font-size: .74rem; font-weight: 700; }
.ts-chip-x { border: none; background: rgba(0,0,0,.08); border-radius: 50%; width: 18px; height: 18px; cursor: pointer; color: #4f46e5; font-size: .66rem; line-height: 1; }
.ts-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; background: #fff; }
.ts-input:focus { outline: none; box-shadow: var(--pop); }
.ts-input:disabled { background: #f1f5f9; color: rgba(0,0,0,.45); }
.ts-add { display: flex; gap: 6px; margin-top: 6px; }
.ts-add .ts-input { flex: 1; }
.ts-btn { flex-shrink: 0; border: 2px solid var(--ink); border-radius: 9px; padding: 6px 12px; font-family: inherit; font-size: .75rem; font-weight: 800; background: var(--primary); color: #fff; cursor: pointer; }
.ts-btn:disabled { background: #cbd5e1; cursor: default; }
.ts-cancel { background: #fff; color: var(--ink); }
</style>
