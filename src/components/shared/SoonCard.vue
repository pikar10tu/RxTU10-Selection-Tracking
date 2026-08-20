<template>
  <div class="soon-card">
    <span class="soon-emoji"><Emoji :char="emoji" /></span>
    <span class="soon-name">{{ label }}</span>
    <span class="soon-tag">เร็วๆ นี้</span>
  </div>
</template>

<script setup>
import Emoji from './Emoji.vue'
defineProps({ emoji: String, label: String })
</script>

<style scoped>
/* ยกจาก PlayView .soon-card — แพทเทิร์น "เร็วๆ นี้" กลางของทั้งแอป */
.soon-card {
  background: #fff;
  border: 2px dashed var(--ink);
  border-radius: 16px;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: .6;
}
.soon-emoji { font-size: 1.6rem; }
.soon-name { font-size: .8rem; font-weight: 700; }
.soon-tag {
  font-size: .7rem;
  color: #b45309;
  background: rgba(251,191,36,.18);
  padding: 2px 7px;
  border-radius: 999px;
}
</style>
