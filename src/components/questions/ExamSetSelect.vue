<!-- src/components/questions/ExamSetSelect.vue -->
<template>
  <div class="es">
    <!-- ชุดที่เลือก (ชิป) -->
    <div v-if="modelValue.length" class="es-chips">
      <span v-for="name in modelValue" :key="name" class="es-chip">
        {{ labelOf(name) }}
        <button type="button" class="es-chip-x" @click="removeSet(name)" aria-label="ถอดชุดนี้">✕</button>
      </span>
    </div>

    <!-- เพิ่มจากรายการที่มี -->
    <select class="es-input" :value="''" @change="onSelect">
      <option value="">+ เลือกชุดข้อสอบย้อนหลัง…</option>
      <option v-for="s in available" :key="s.name" :value="s.name">{{ labelOf(s.name) }}</option>
      <option value="__add">➕ เพิ่มชุดใหม่…</option>
    </select>

    <!-- สร้างชุดใหม่ -->
    <div v-if="adding" class="es-add">
      <input v-model="newName" :maxlength="LIMITS.category" class="es-input" placeholder="ชื่อชุด เช่น PLE-CC1 ชุด 1" @keydown.enter.prevent="confirmAdd" />
      <input v-model="newYear" class="es-input es-year" inputmode="numeric" placeholder="ปี พ.ศ." @keydown.enter.prevent="confirmAdd" />
      <button type="button" class="es-btn" :disabled="busy || !newName.trim()" @click="confirmAdd">เพิ่ม</button>
      <button type="button" class="es-btn es-cancel" @click="cancelAdd">ยกเลิก</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useExamSets } from '../../composables/useExamSets.js'
import { useToast } from '../../composables/useToast.js'
import { examSetLabel } from '../../utils/examSets.js'
import { LIMITS } from '../../utils/text.js'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const { sets, loadExamSets, addExamSet } = useExamSets()
const { toast } = useToast()
const adding = ref(false)
const newName = ref('')
const newYear = ref('')
const busy = ref(false)

onMounted(loadExamSets)

// ชุดที่ยังไม่ถูกเลือก (ให้เลือกเพิ่ม)
const available = computed(() => sets.value.filter(s => !props.modelValue.includes(s.name)))

function labelOf(name) {
  const entry = sets.value.find(s => s.name === name)
  return entry ? examSetLabel(entry) : name   // ชุดที่ config โหลดไม่ทัน/ถูกลบ ยังโชว์ชื่อดิบ
}

function onSelect(e) {
  const v = e.target.value
  e.target.value = ''                    // reset ไม่ให้ค้างค่าใน select
  if (v === '__add') { adding.value = true; return }
  if (v && !props.modelValue.includes(v)) emit('update:modelValue', [...props.modelValue, v])
}

function removeSet(name) {
  emit('update:modelValue', props.modelValue.filter(n => n !== name))
}

function cancelAdd() { adding.value = false; newName.value = ''; newYear.value = '' }

async function confirmAdd() {
  if (busy.value) return
  busy.value = true
  try {
    const entry = await addExamSet(newName.value, newYear.value)
    if (!entry) { toast('ชื่อชุดใช้ไม่ได้ ลองพิมพ์ใหม่', 'error'); return }
    if (!props.modelValue.includes(entry.name)) emit('update:modelValue', [...props.modelValue, entry.name])
    cancelAdd()
  } catch (e) { console.error('[examSet add]', e); toast('เพิ่มชุดไม่สำเร็จ', 'error') }
  finally { busy.value = false }
}
</script>

<style scoped>
.es-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.es-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--primary-light, #eef2ff); color: #4f46e5; border-radius: 999px; padding: 4px 6px 4px 11px; font-size: .74rem; font-weight: 700; }
.es-chip-x { border: none; background: rgba(0,0,0,.08); border-radius: 50%; width: 18px; height: 18px; cursor: pointer; color: #4f46e5; font-size: .7rem; line-height: 1; }
.es-input { width: 100%; box-sizing: border-box; border: 2px solid var(--ink); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: .82rem; background: #fff; }
.es-input:focus { outline: none; box-shadow: var(--pop); }
.es-add { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.es-add .es-input { flex: 1; min-width: 120px; }
.es-year { flex: 0 0 90px; }
.es-btn { flex-shrink: 0; border: 2px solid var(--ink); border-radius: 9px; padding: 6px 12px; font-family: inherit; font-size: .75rem; font-weight: 800; background: var(--primary); color: #fff; cursor: pointer; }
.es-btn:disabled { background: #cbd5e1; cursor: default; }
.es-cancel { background: #fff; color: var(--ink); }
</style>
