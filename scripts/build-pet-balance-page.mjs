// build-pet-balance-page — สร้างหน้าเพจ "โต๊ะบาลานซ์เพ็ท" (artifact ที่ลิงก์อยู่ในพาแนลแอดมิน)
// ต้องรัน scripts/export-pet-data.mjs ก่อน · บรีฟส่งต่อ AI อ่านจาก docs/
//
// รัน: node scripts/export-pet-data.mjs && node scripts/build-pet-balance-page.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const at = (rel) => new URL(rel, import.meta.url)
const { pets, meta } = JSON.parse(readFileSync(at('../docs/pet-data.json'), 'utf8'))
const BRIEF = readFileSync(at('../docs/pet-balance-brief-2026-08-31.md'), 'utf8')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const HOOK_TH = { onStart: 'ตอนเริ่มไฟต์', onRound: 'ต้นรอบ', onAttack: 'ตอนออกหมัด', onHit: 'ตอนโดนตี', onDeath: 'ตอนจะตาย', onKill: 'ตอนน็อกศัตรู', aura: 'ออร่า (ติดตลอด)' }
const RAR = { common: '#94a3b8', rare: '#60a5fa', epic: '#c084fc', legendary: '#fbbf24' }

// จัดกลุ่มข้อสังเกต (เขียนมือ — มาจากตัวเลขที่วัดได้)
const FINDINGS = [
  { tag: 'พังจริง', tone: 'hot', head: '🐘 บากุ — พาสสีฟตำนานที่ทำให้แพ้',
    body: 'ปราการพิทักษ์ วัดได้ <b>−3.1%</b> เทียบทีมที่ไม่มีพาสสีฟเลย และรั้งท้ายสุดในการปะทะบนร่างเดียวกัน (39.3%) การรับดาเมจแทนไม่ได้ลดดาเมจรวม แค่ย้ายไปกองที่บากุ ⇒ บากุตายก่อน แล้วทีมก็เสียตัวรับไปเฉยๆ ตัวนี้ต้องแก้กลไก ไม่ใช่แค่ขยับเลข' },
  { tag: 'แทบไม่มีผล', tone: 'hot', head: '🦅 กริฟฟิน · 🦈 ฉลาม · 🦖 ทีเร็กซ์ · 🐹 แฮมสเตอร์ — ติดแล้วเหมือนไม่ติด',
    body: 'โฉบเด็ดชีพ <b>+0.3%</b> · เขี้ยวกระหาย <b>+1.3%</b> · พลังกักตุน <b>+3.7%</b> · สัญชาตญาณนักล่า <b>+4.3%</b> สามตัวแรกเป็นพาสสีฟ “ตอนได้เปรียบอยู่แล้ว” — เล็งตัวเลือดน้อย/ตีตัวใกล้ตาย/แรงขึ้นหลังฆ่า ล้วนออกฤทธิ์ตอนที่เกมเกือบตัดสินไปแล้ว 2 ตัวในนี้เป็นระดับตำนาน' },
  { tag: 'บันไดพัง', tone: 'hot', head: 'ผีเสื้อ common แรงกว่าตำนาน 5 ใน 9 ตัว',
    body: 'เมื่อวางทุกตัวบน “ร่างเดียวกัน” (ตัด atk/hp ตามระดับออก) ผีเสื้อได้ 52.8% ขณะที่ บาฮามุท 46.1 · ทีเร็กซ์ 44.7 · กริฟฟิน 42.5 · บากุ 39.3 บันไดความหายากยังตั้งอยู่ได้เพราะสเตตัสดิบ ไม่ใช่เพราะพาสสีฟ' },
  { tag: 'แรงเกิน', tone: 'hot', head: 'ฟื้นเลือดต้นรอบ = ปุ่มชนะ',
    body: 'แพนด้า <b>+49.5%</b> · ยูนิคอร์น +44.1 · อูโรโบรอส +39.7 · ผีเสื้อ +37.8 ฟื้นทุกต้นรอบมันทบต้น พอไฟต์ยาวขึ้นก็ยิ่งได้เปรียบ (ทั้ง 4 ตัวยืดไฟต์ราว +1 หมัด) กลุ่มนี้มีตั้งแต่ common ถึง legendary ทั้งที่ผลใกล้เคียงกัน' },
  { tag: 'ซ้ำกัน', tone: 'warn', head: '6 คู่ที่เป็นพาสสีฟเดียวกันคนละเลข',
    body: 'ฟื้นตัวเอง (แพนด้า/อูโรโบรอส) · ฟื้นเพื่อน (ยูนิคอร์น/ผีเสื้อ) · หลบ (จิ้งจอก/หนู) · ลดดาเมจ (แมมมอธ/เต่า) · ลามหลายเป้า (มังกร/เซอร์เบอรัส) · กันตาย (ฟีนิกซ์/แมว/จินนี่) เท่ากับ 13 ตัวจาก 27 ใช้กลไกซ้ำกัน — เวลาคิด flavor ใหม่ควรแยกให้เห็นว่ามัน “คนละเรื่อง” หรือยุบรวม' },
  { tag: 'จังหวะ', tone: 'cool', head: '🐕 เซอร์เบอรัสโดนครบทีมศัตรูทุกหมัด',
    body: 'ตรีเขี้ยวอสูรตั้งไว้ 3 เป้า ซึ่ง <b>เท่ากับทั้งทีมศัตรูพอดี</b> เพราะทีมมีแค่ 3 ช่อง ⇒ ทุกหมัดโดนครบทุกตัว ไม่มีวันพลาด เป็นเหตุผลที่มันขึ้นอันดับ 2 ทั้งที่เป็นแค่เอพิค (มังกร 2 เป้า ก็คือ 2 ใน 3 ของทีมศัตรูแล้ว) กลุ่มนี้ยังทำให้ไฟต์จบเร็วขึ้นด้วย เซอร์เบอรัส −3.6 หมัด · มังกร −2.4' },
]

const bar = (v) => {
  const mid = 50, span = 18 // แกน 32–68%
  const pct = Math.max(0, Math.min(100, (v - (mid - span)) / (span * 2) * 100))
  const zero = 50
  const left = Math.min(pct, zero), w = Math.abs(pct - zero)
  return { left, w, over: v >= mid }
}

const cards = pets.map(p => {
  const g0 = p.grades[0], g5 = p.grades[5]
  const pv = p.passive
  return `
<article class="pet" data-id="${p.id}" data-rar="${p.rarity}" data-el="${p.element}" data-rr="${p.sim.rrFlat}" data-lift="${p.sim.lift}" data-coins="${g5.coins}">
  <header class="pet-h">
    <span class="pet-face" aria-hidden="true">${p.emoji}</span>
    <div class="pet-id">
      <h3>${esc(p.name)}</h3>
      <code>${p.id}</code>
    </div>
    <div class="pet-chips">
      <span class="chip rar rar-${p.rarity}"><i></i>${esc(p.rarityTh)}</span>
      <span class="chip el">${p.elEmoji} ${esc(p.elementTh)}</span>
    </div>
  </header>

  <p class="flavor">${esc(p.flavor)}</p>

  <div class="statline">
    <div class="st"><span class="st-k">โจมตี</span><span class="st-v">${g0.atk}<em>→${g5.atk}</em></span></div>
    <div class="st"><span class="st-k">เลือด</span><span class="st-v">${g0.hp}<em>→${g5.hp}</em></span></div>
    <div class="st"><span class="st-k">เหรียญ/วัน</span><span class="st-v">${g0.coins}<em>→${g5.coins}</em></span></div>
  </div>
  <details class="grades">
    <summary>ตารางทุกเกรด (I–V)</summary>
    <table class="gt">
      <thead><tr><th>เกรด</th><th>โจมตี</th><th>เลือด</th><th>เหรียญ/วัน</th><th>ผจญภัย</th></tr></thead>
      <tbody>${p.grades.map(g => `<tr><td>${g.g === 0 ? '—' : ['', 'I', 'II', 'III', 'IV', 'V'][g.g]}</td><td>${g.atk}</td><td>${g.hp}</td><td>${g.coins}</td><td>${g.exp}</td></tr>`).join('')}</tbody>
    </table>
  </details>

  ${pv ? `<div class="pas">
    <div class="pas-h">
      <span class="pas-ico" aria-hidden="true">${pv.icon}</span>
      <b>${esc(pv.name)}</b>
      <span class="tag">${esc(HOOK_TH[pv.hook] || pv.hook)}</span>
      <code class="tag-code">${pv.effect}</code>
    </div>
    <ol class="lv">
      ${pv.lv.map(l => `<li><span class="lv-n">ขั้น ${l.l}</span><span>${esc(l.text)}</span></li>`).join('')}
    </ol>
  </div>` : ''}

  <div class="meas">
    <div class="m"><span class="m-k">ผลจริง</span><span class="m-v ${p.sim.lift >= 25 ? 'hot' : p.sim.lift <= 5 ? 'cool' : ''}">${p.sim.lift > 0 ? '+' : ''}${p.sim.lift}%</span></div>
    <div class="m"><span class="m-k">ร่างเท่ากัน</span><span class="m-v ${p.sim.rrFlat >= 54 ? 'hot' : p.sim.rrFlat <= 45 ? 'cool' : ''}">${p.sim.rrFlat}%</span></div>
    <div class="m"><span class="m-k">ติด/ไฟต์</span><span class="m-v">${p.sim.fires}</span></div>
    <div class="m"><span class="m-k">หมัด±</span><span class="m-v">${p.sim.dbeat > 0 ? '+' : ''}${p.sim.dbeat}</span></div>
  </div>
</article>`
}).join('\n')

const ranked = pets.slice().sort((a, b) => b.sim.rrFlat - a.sim.rrFlat)
const chartRows = ranked.map(p => {
  const b = bar(p.sim.rrFlat)
  return `<div class="row" tabindex="0" data-tip="${esc(p.passive.name)} · ${esc(HOOK_TH[p.passive.hook])} · ติด ${p.sim.fires} ครั้ง/ไฟต์ · ผลจริง ${p.sim.lift > 0 ? '+' : ''}${p.sim.lift}%">
  <span class="row-n"><i class="dot" style="background:${RAR[p.rarity]}"></i>${p.emoji} ${esc(p.name)}</span>
  <span class="track"><span class="mid"></span><span class="fill ${b.over ? 'over' : 'under'}" style="left:${b.left}%;width:${b.w}%"></span></span>
  <span class="row-v ${b.over ? 'over' : 'under'}">${p.sim.rrFlat}</span>
</div>`
}).join('\n')

const tableRows = pets.map(p => `<tr>
<td class="tl">${p.emoji} ${esc(p.name)}</td><td><code>${p.id}</code></td>
<td><span class="dot" style="background:${RAR[p.rarity]}"></span>${esc(p.rarityTh)}</td><td>${esc(p.elementTh)}</td>
<td>${p.grades[0].atk}</td><td>${p.grades[0].hp}</td><td>${p.grades[5].atk}</td><td>${p.grades[5].hp}</td>
<td>${p.grades[0].coins}</td><td>${p.grades[5].coins}</td>
<td class="tl">${p.passive.icon} ${esc(p.passive.name)}</td><td><code>${p.passive.effect}</code></td><td>${esc(HOOK_TH[p.passive.hook])}</td>
<td class="${p.sim.lift >= 25 ? 'hot' : p.sim.lift <= 5 ? 'cool' : ''}">${p.sim.lift > 0 ? '+' : ''}${p.sim.lift}</td>
<td class="${p.sim.rrFlat >= 54 ? 'hot' : p.sim.rrFlat <= 45 ? 'cool' : ''}">${p.sim.rrFlat}</td>
<td>${p.sim.fires}</td><td>${p.sim.dbeat > 0 ? '+' : ''}${p.sim.dbeat}</td>
<td class="tl flav">${esc(p.flavor)}</td>
</tr>`).join('\n')

const findingCards = FINDINGS.map(f => `<article class="find ${f.tone}">
  <span class="find-tag">${esc(f.tag)}</span>
  <h3>${esc(f.head)}</h3>
  <p>${f.body}</p>
</article>`).join('\n')

const html = `<title>โต๊ะบาลานซ์เพ็ท RxTU10</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  --ground:#f4f3f7; --surface:#ffffff; --surface2:#faf9fd; --ink:#181924; --ink2:#494a5c;
  --muted:#7a7b8f; --line:#e6e4ee; --line2:#f0eef6;
  --accent:#4f46e5; --accent-soft:#eeecfe; --accent-ink:#4338ca;
  --hot:#cf4636; --cool:#0f9384; --warn:#b45309;
  --hot-soft:rgba(207,70,54,.10); --cool-soft:rgba(15,147,132,.10);
  --shadow:0 1px 2px rgba(24,25,36,.05), 0 6px 20px -12px rgba(24,25,36,.18);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --ground:#121218; --surface:#1b1b24; --surface2:#212130; --ink:#eceaf4; --ink2:#b5b3c6;
  --muted:#8a88a0; --line:#2e2e3c; --line2:#26262f;
  --accent:#9b95ff; --accent-soft:#262338; --accent-ink:#b3adff;
  --hot:#e8624c; --cool:#16a08d; --warn:#d9a441;
  --hot-soft:rgba(232,98,76,.14); --cool-soft:rgba(22,160,141,.14);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -14px rgba(0,0,0,.7);
}}
:root[data-theme="dark"]{
  --ground:#121218; --surface:#1b1b24; --surface2:#212130; --ink:#eceaf4; --ink2:#b5b3c6;
  --muted:#8a88a0; --line:#2e2e3c; --line2:#26262f;
  --accent:#9b95ff; --accent-soft:#262338; --accent-ink:#b3adff;
  --hot:#e8624c; --cool:#16a08d; --warn:#d9a441;
  --hot-soft:rgba(232,98,76,.14); --cool-soft:rgba(22,160,141,.14);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -14px rgba(0,0,0,.7);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:'Kanit','Noto Sans Thai','IBM Plex Sans Thai',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:15px; line-height:1.62; -webkit-text-size-adjust:100%;
}
code,.num{font-family:ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:1080px;margin:0 auto;padding:26px 16px 72px;display:flex;flex-direction:column;gap:34px}
h1,h2,h3{margin:0;text-wrap:balance;line-height:1.3}
p{margin:0}
a{color:var(--accent-ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}

/* ── head ── */
.eyebrow{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.head h1{font-size:clamp(1.55rem,5.4vw,2.3rem);font-weight:700;letter-spacing:-.01em;margin-top:6px}
.head .sub{color:var(--ink2);margin-top:8px;max-width:62ch}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin-top:20px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;box-shadow:var(--shadow)}
.tile b{display:block;font-size:1.5rem;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tile span{font-size:.78rem;color:var(--muted)}
.note{background:var(--surface2);border:1px dashed var(--line);border-radius:12px;padding:14px 16px;font-size:.86rem;color:var(--ink2)}
.note b{color:var(--ink)}

/* ── section ── */
section{display:flex;flex-direction:column;gap:14px}
.sec-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px}
.sec-h h2{font-size:1.12rem;font-weight:700}
.sec-h .hint{font-size:.8rem;color:var(--muted)}

/* ── chart ── */
.chart{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 14px;box-shadow:var(--shadow)}
.axis{display:grid;grid-template-columns:9.5rem 1fr 2.6rem;gap:10px;font-size:.72rem;color:var(--muted);padding-bottom:6px}
.axis .ax{display:flex;justify-content:space-between}
.row{display:grid;grid-template-columns:9.5rem 1fr 2.6rem;gap:10px;align-items:center;padding:2px 0;border-radius:6px}
.row:hover,.row:focus-visible{background:var(--surface2)}
.row-n{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.track{position:relative;height:15px;background:var(--line2);border-radius:4px}
.mid{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--muted);opacity:.5}
.fill{position:absolute;top:2px;bottom:2px;border-radius:4px}
.fill.over{background:var(--hot)}
.fill.under{background:var(--cool)}
.row-v{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:.8rem;text-align:right}
.row-v.over{color:var(--hot)}.row-v.under{color:var(--cool)}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.78rem;color:var(--ink2);margin-top:12px;padding-top:10px;border-top:1px solid var(--line2)}
.legend i{width:11px;height:11px;border-radius:3px;display:inline-block;margin-inline-end:6px;vertical-align:-1px}
#tip{position:fixed;z-index:50;pointer-events:none;background:var(--ink);color:var(--ground);font-size:.76rem;
  padding:7px 10px;border-radius:8px;max-width:280px;opacity:0;transition:opacity .12s;line-height:1.5}
#tip.on{opacity:1}

/* ── findings ── */
.finds{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.find{background:var(--surface);border:1px solid var(--line);border-inline-start:3px solid var(--muted);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:7px;box-shadow:var(--shadow)}
.find.hot{border-inline-start-color:var(--hot)}
.find.warn{border-inline-start-color:var(--warn)}
.find.cool{border-inline-start-color:var(--cool)}
.find-tag{font-size:.7rem;font-weight:700;letter-spacing:.04em;color:var(--muted);text-transform:none}
.find.hot .find-tag{color:var(--hot)} .find.warn .find-tag{color:var(--warn)} .find.cool .find-tag{color:var(--cool)}
.find h3{font-size:.95rem;font-weight:700}
.find p{font-size:.85rem;color:var(--ink2)}
.find b{color:var(--ink);font-weight:700}

/* ── controls ── */
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;top:0;z-index:20;
  background:var(--ground);padding:10px 0;margin:-10px 0}
.grp{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.grp>span{font-size:.74rem;color:var(--muted);margin-inline-end:2px}
button.f{font:inherit;font-size:.8rem;padding:5px 11px;border-radius:999px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink2);cursor:pointer;transition:.15s}
button.f:hover{border-color:var(--accent)}
button.f[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink);font-weight:600}

/* ── pet cards ── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.pet{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:11px;box-shadow:var(--shadow)}
.pet-h{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}
.pet-face{font-size:1.9rem;line-height:1}
.pet-id h3{font-size:1.02rem;font-weight:700}
.pet-id code{font-size:.72rem;color:var(--muted)}
.pet-chips{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
.chip{font-size:.74rem;padding:2px 9px;border-radius:999px;border:1px solid var(--line);color:var(--ink2);display:flex;align-items:center;gap:5px}
.chip i{width:7px;height:7px;border-radius:50%}
.rar-common i{background:#94a3b8}.rar-rare i{background:#60a5fa}.rar-epic i{background:#c084fc}.rar-legendary i{background:#fbbf24}
.rar-common{background:rgba(148,163,184,.13)}.rar-rare{background:rgba(96,165,250,.13)}
.rar-epic{background:rgba(192,132,252,.14)}.rar-legendary{background:rgba(251,191,36,.15)}
.flavor{font-size:.85rem;color:var(--ink2);background:var(--surface2);border-radius:9px;padding:9px 11px;border-inline-start:2px solid var(--line)}
.statline{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.st{background:var(--surface2);border-radius:9px;padding:7px 9px}
.st-k{display:block;font-size:.7rem;color:var(--muted)}
.st-v{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:.9rem;font-weight:600}
.st-v em{font-style:normal;color:var(--muted);font-weight:400;font-size:.8rem}
.grades summary{font-size:.78rem;color:var(--accent-ink);cursor:pointer;padding:2px 0}
.gt{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:6px;font-variant-numeric:tabular-nums}
.gt th{text-align:end;color:var(--muted);font-weight:500;padding:3px 4px;border-bottom:1px solid var(--line)}
.gt td{text-align:end;padding:3px 4px;border-bottom:1px solid var(--line2);font-family:ui-monospace,Menlo,monospace}
.gt th:first-child,.gt td:first-child{text-align:start}
.pas{border:1px solid var(--line);border-radius:11px;padding:10px 11px;background:var(--surface2)}
.pas-h{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px}
.pas-h b{font-size:.92rem}
.pas-ico{font-size:1.05rem}
.tag{font-size:.7rem;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.tag-code{font-size:.7rem;color:var(--accent-ink);background:var(--accent-soft);border-radius:5px;padding:1px 6px}
.lv{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.lv li{display:grid;grid-template-columns:3.1rem 1fr;gap:8px;font-size:.8rem;color:var(--ink2)}
.lv li:first-child{color:var(--ink)}
.lv-n{color:var(--muted);font-size:.74rem}
.meas{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;border-top:1px solid var(--line2);padding-top:9px;margin-top:auto}
.m{text-align:center}
.m-k{display:block;font-size:.68rem;color:var(--muted)}
.m-v{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;font-size:.86rem;font-weight:600}
.m-v.hot{color:var(--hot)}.m-v.cool{color:var(--cool)}

/* ── table ── */
.scroller{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
table.big{border-collapse:collapse;font-size:.78rem;white-space:nowrap;min-width:100%}
table.big th{position:sticky;top:0;background:var(--surface);color:var(--muted);font-weight:600;text-align:end;
  padding:9px 10px;border-bottom:1px solid var(--line);font-size:.72rem}
table.big td{text-align:end;padding:7px 10px;border-bottom:1px solid var(--line2);font-variant-numeric:tabular-nums}
table.big td.tl,table.big th.tl{text-align:start}
table.big tr:hover td{background:var(--surface2)}
table.big .flav{white-space:normal;min-width:22rem;color:var(--ink2)}
table.big code{font-size:.72rem;color:var(--muted)}
.hot{color:var(--hot)}.cool{color:var(--cool)}
table.big .dot{margin-inline-end:5px;vertical-align:0}

/* ── brief ── */
.lead{font-size:.88rem;color:var(--ink2);max-width:70ch}
.copybar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
button.cp{font:inherit;font-size:.86rem;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid var(--accent);
  background:var(--accent);color:#fff;cursor:pointer}
button.cp:hover{filter:brightness(1.07)}
button.cp.done{background:var(--cool);border-color:var(--cool)}
.cp-note{font-size:.78rem;color:var(--muted)}
pre.brief{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px;
  max-height:330px;overflow:auto;font-size:.76rem;line-height:1.7;white-space:pre-wrap;word-break:break-word;
  color:var(--ink2);box-shadow:var(--shadow);font-family:ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace}

/* ── ref ── */
.refs{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
.ref{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:13px 15px;box-shadow:var(--shadow)}
.ref h3{font-size:.86rem;font-weight:700;margin-bottom:8px}
.ref table{width:100%;border-collapse:collapse;font-size:.78rem;font-variant-numeric:tabular-nums}
.ref td{padding:3px 0;border-bottom:1px solid var(--line2)}
.ref td:last-child{text-align:end;font-family:ui-monospace,Menlo,monospace}
.ref p{font-size:.8rem;color:var(--ink2)}
footer{color:var(--muted);font-size:.78rem;border-top:1px solid var(--line);padding-top:16px}
@media (max-width:520px){
  .axis,.row{grid-template-columns:7.6rem 1fr 2.4rem}
  .row-n{font-size:.76rem}
  .grid{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">

<header class="head">
  <div class="eyebrow">RxTU10 · ข้อมูลสำหรับปรับสมดุล · 31 ส.ค. 2026</div>
  <h1>เพ็ททั้ง 27 ตัว พร้อมผลวัดของพาสสีฟ</h1>
  <p class="sub">ดึงจาก <code>data/index.js</code> + <code>data/petPassives.js</code> + <code>data/petPower.js</code> ตรงๆ ส่วนคอลัมน์ “ผลจริง” ไม่ได้ประเมินด้วยสายตา — รันเอนจินไฟต์ตัวจริง (<code>utils/battleEngine.js</code>) ตัวละ 1,500 ไฟต์ · ทีมละ 3 ตัวตาม <code>BATTLE_SLOTS</code></p>
  <div class="tiles">
    <div class="tile"><b>27</b><span>เพ็ท · พาสสีฟครบทุกตัว</span></div>
    <div class="tile"><b>22</b><span>กลไกไม่ซ้ำกัน (จาก 27)</span></div>
    <div class="tile"><b>26.5</b><span>ช่วงห่างแรงสุด−อ่อนสุด (%)</span></div>
    <div class="tile"><b>5</b><span>ตัวที่แทบไม่มีผล (≤5%)</span></div>
  </div>
</header>

<div class="note">
  <b>วัดยังไง</b> — จับเพ็ทที่จะวัดใส่ทีมกับ “เพื่อนไร้พาสสีฟ” อีก 2 ตัว แล้วสู้กับทีมไร้พาสสีฟ 3 ตัว (สนามจริงคือ 3v3)
  โดยเพื่อนทุกตัวถูกตั้งสเตตัสให้เท่ากับเพ็ทตัวนั้นเป๊ะ (ระดับ/สาย/เกรดเดียวกัน) — ส่วนต่างจาก 50% จึงเป็นผลของพาสสีฟล้วนๆ
  <br><b>ผลจริง</b> = ชนะเพิ่มกี่ % เทียบทีมเปล่า · <b>ร่างเท่ากัน</b> = จับทุกตัวใส่ร่างเอพิคเหมือนกันหมดแล้วให้ปะทะกันเองครบทุกคู่ (ตัดข้อได้เปรียบจากสเตตัสตามระดับออก) · <b>ติด/ไฟต์</b> = พาสสีฟทำงานกี่ครั้งต่อไฟต์ · <b>หมัด±</b> = ไฟต์ยาว/สั้นลงกี่หมัด
  <br>ทุกค่าคิดที่เกรด III ขั้นพาสสีฟ 1 · หินอัพขั้นพาสสีฟยังไม่มีในเกม
  <br><b>จะส่งต่อให้ AI ตัวอื่นช่วยเรียบเรียง</b> — มีบรีฟสำเร็จรูปให้กดคัดลอกอยู่ท้ายหน้า อธิบายระบบครบในข้อความเดียว
</div>

<section>
  <div class="sec-h"><h2>พาสสีฟตัวไหนแรงกว่ากันจริง</h2>
    <span class="hint">ทุกตัวใส่ร่างเดียวกัน · ปะทะกันเองครบทุกคู่ ตัวละ 13,000 ไฟต์</span></div>
  <div class="chart">
    <div class="axis"><span></span><span class="ax"><span>32%</span><span>50% เสมอ</span><span>68%</span></span><span></span></div>
    ${chartRows}
    <div class="legend">
      <span><i style="background:var(--hot)"></i>ชนะบ่อยกว่าเสมอ</span>
      <span><i style="background:var(--cool)"></i>แพ้บ่อยกว่าเสมอ</span>
      <span><i class="dot" style="background:#fbbf24;width:9px;height:9px;border-radius:50%"></i>สีจุด = ระดับความหายากในเกม</span>
    </div>
  </div>
</section>

<section>
  <div class="sec-h"><h2>สิ่งที่สะดุดตา</h2><span class="hint">6 เรื่องที่ตัวเลขชี้ให้เห็น</span></div>
  <div class="finds">${findingCards}</div>
</section>

<section>
  <div class="sec-h"><h2>รายตัว</h2><span class="hint">ตัวเลขทุกช่องแก้ได้ที่ไฟล์เดียว — flavor อยู่ใน data/index.js · พาสสีฟอยู่ใน data/petPassives.js</span></div>
  <div class="controls">
    <div class="grp"><span>ระดับ</span>
      <button class="f" data-filter="rar" data-v="all" aria-pressed="true">ทั้งหมด</button>
      <button class="f" data-filter="rar" data-v="legendary" aria-pressed="false">ตำนาน</button>
      <button class="f" data-filter="rar" data-v="epic" aria-pressed="false">เอพิค</button>
      <button class="f" data-filter="rar" data-v="rare" aria-pressed="false">หายาก</button>
      <button class="f" data-filter="rar" data-v="common" aria-pressed="false">ธรรมดา</button>
    </div>
    <div class="grp"><span>สาย</span>
      <button class="f" data-filter="el" data-v="all" aria-pressed="true">ทั้งหมด</button>
      <button class="f" data-filter="el" data-v="fist" aria-pressed="false">✊ จู่โจม</button>
      <button class="f" data-filter="el" data-v="scissors" aria-pressed="false">✌️ สมดุล</button>
      <button class="f" data-filter="el" data-v="paper" aria-pressed="false">✋ พิทักษ์</button>
    </div>
    <div class="grp"><span>เรียง</span>
      <button class="f" data-sort="rr" aria-pressed="true">พาสสีฟแรงสุด</button>
      <button class="f" data-sort="lift" aria-pressed="false">ผลจริง</button>
      <button class="f" data-sort="coins" aria-pressed="false">เหรียญ/วัน</button>
      <button class="f" data-sort="cat" aria-pressed="false">ตามแคตตาล็อก</button>
    </div>
  </div>
  <div class="grid" id="grid">${cards}</div>
</section>

<section>
  <div class="sec-h"><h2>ตารางรวม</h2><span class="hint">เลื่อนซ้าย–ขวาได้ · ลากไปวางในชีตได้เลย</span></div>
  <div class="scroller">
    <table class="big">
      <thead><tr>
        <th class="tl">เพ็ท</th><th class="tl">id</th><th class="tl">ระดับ</th><th class="tl">สาย</th>
        <th>โจมตี g0</th><th>เลือด g0</th><th>โจมตี V</th><th>เลือด V</th>
        <th>เหรียญ g0</th><th>เหรียญ V</th>
        <th class="tl">พาสสีฟ</th><th class="tl">effect</th><th class="tl">ทำงานตอน</th>
        <th>ผลจริง</th><th>ร่างเท่ากัน</th><th>ติด/ไฟต์</th><th>หมัด±</th>
        <th class="tl">flavor ปัจจุบัน</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</section>

<section>
  <div class="sec-h"><h2>ส่งต่อให้ AI ตัวอื่นช่วยเรียบเรียง</h2><span class="hint">กดปุ่มคัดลอก แล้ววางเป็นข้อความแรกในแชท</span></div>
  <p class="lead">ข้างล่างนี้เป็นบรีฟที่เขียนไว้ให้ AI ที่ไม่เคยเห็นโค้ดนี้เข้าใจระบบได้ครบในครั้งเดียว — กติกาการต่อสู้ · กฎเหล็กที่ห้ามละเมิด · โครงสร้างข้อมูล · กลไกที่โค้ดรองรับอยู่แล้ว · ข้อมูลปัจจุบันทั้ง 27 ตัว · ผลวัดพร้อมข้อจำกัดของมัน · โทนภาษา · และโจทย์ที่อยากได้กลับมา ไม่ต้องแนบอะไรเพิ่ม</p>
  <div class="copybar">
    <button class="cp" id="cpBrief">📋 คัดลอกบรีฟทั้งหมด</button>
    <span class="cp-note" id="cpMsg">${BRIEF.length.toLocaleString()} ตัวอักษร · พอดีกับแชทเดียว</span>
  </div>
  <pre id="brief" class="brief">${esc(BRIEF)}</pre>
</section>

<section>
  <div class="sec-h"><h2>สูตรที่ตัวเลขพวกนี้มาจาก</h2><span class="hint">ปรับที่ data/petPower.js กับ utils/gacha.js</span></div>
  <div class="refs">
    <div class="ref"><h3>สเตตัสฐานตามระดับ</h3>
      <table><tbody>
      ${Object.entries(meta.COMBAT_BASE).map(([k, v]) => `<tr><td>${k}</td><td>atk ${v.atk} · hp ${v.hp}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:8px">คูณด้วยเกรด <code>${meta.COMBAT_GRADE.join(' · ')}</code></p></div>
    <div class="ref"><h3>ตัวคูณตามสาย</h3>
      <table><tbody>
      ${Object.entries(meta.ELEMENT_BIAS).map(([k, v]) => `<tr><td>${k === 'fist' ? '✊ จู่โจม' : k === 'scissors' ? '✌️ สมดุล' : '✋ พิทักษ์'}</td><td>atk ×${v.atk} · hp ×${v.hp}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:8px">ได้เปรียบสาย ×1.20 · เสียเปรียบ ×0.83 · คริ 12% ×1.6 · แกว่ง ±22%</p></div>
    <div class="ref"><h3>รายได้ต่อวัน</h3>
      <table><tbody>
      ${Object.entries(meta.RARITY_DAILY_BASE).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:8px">คูณด้วยเกรด <code>${meta.GRADE_MULTI_V2.join(' · ')}</code> — ชันกว่าสายสู้มาก (เกรด V = 12 เท่า แต่พลังสู้แค่ 2 เท่า)</p></div>
    <div class="ref"><h3>อัญเชิญ</h3>
      <table><tbody>
      ${Object.entries(meta.GACHA_RATES).map(([k, v]) => `<tr><td>${k}</td><td>${v}%</td></tr>`).join('')}
      <tr><td>soft pity</td><td>${meta.SOFT_PITY} (+${meta.SOFT_PITY_STEP}%/ครั้ง)</td></tr>
      <tr><td>การันตี</td><td>${meta.HARD_PITY}</td></tr>
      </tbody></table></div>
  </div>
</section>

<footer>
  ตัวเลข “ผลจริง/ร่างเท่ากัน/ติดต่อไฟต์/หมัด±” มาจากการรันเอนจินจริงในเครื่อง ไม่ใช่ค่าประมาณ —
  แต่เป็นการวัด “พาสสีฟตัวเดียวในทีม” ทีมจริงมี 3 ช่องและมีพาสสีฟครบทั้ง 3 ตัว จะเบียดกันเองและได้ตัวเลขต่ำลงทุกตัว
  ลำดับก่อนหลังยังใช้อ้างอิงได้ · เกรด III ขั้นพาสสีฟ 1
</footer>
</div>

<div id="tip" role="status"></div>

<script>
// tooltip ของกราฟ
const tip = document.getElementById('tip')
const show = (el, x, y) => {
  tip.textContent = el.dataset.tip
  tip.classList.add('on')
  const r = tip.getBoundingClientRect()
  tip.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x + 12)) + 'px'
  tip.style.top = Math.max(8, y - r.height - 10) + 'px'
}
document.querySelectorAll('.row').forEach(row => {
  row.addEventListener('pointermove', e => show(row, e.clientX, e.clientY))
  row.addEventListener('pointerleave', () => tip.classList.remove('on'))
  row.addEventListener('focus', () => { const r = row.getBoundingClientRect(); show(row, r.left + 40, r.top) })
  row.addEventListener('blur', () => tip.classList.remove('on'))
})

// ตัวกรอง + เรียงการ์ด
const grid = document.getElementById('grid')
const all = [...grid.children]
const state = { rar: 'all', el: 'all', sort: 'rr' }
const num = (c, k) => parseFloat(c.dataset[k])
function apply() {
  const keep = all.filter(c =>
    (state.rar === 'all' || c.dataset.rar === state.rar) &&
    (state.el === 'all' || c.dataset.el === state.el))
  if (state.sort === 'cat') keep.sort((a, b) => all.indexOf(a) - all.indexOf(b))
  else keep.sort((a, b) => num(b, state.sort) - num(a, state.sort))
  grid.replaceChildren(...keep)
}
document.querySelectorAll('button.f').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.filter) {
    state[b.dataset.filter] = b.dataset.v
    document.querySelectorAll('button.f[data-filter="' + b.dataset.filter + '"]')
      .forEach(o => o.setAttribute('aria-pressed', String(o === b)))
  } else {
    state.sort = b.dataset.sort
    document.querySelectorAll('button.f[data-sort]').forEach(o => o.setAttribute('aria-pressed', String(o === b)))
  }
  apply()
}))
apply()

// คัดลอกบรีฟ
const cpBtn = document.getElementById('cpBrief'), cpMsg = document.getElementById('cpMsg')
cpBtn.addEventListener('click', async () => {
  const text = document.getElementById('brief').textContent
  try {
    await navigator.clipboard.writeText(text)
    cpBtn.textContent = '✓ คัดลอกแล้ว'
    cpBtn.classList.add('done')
    cpMsg.textContent = 'วางในแชทของ AI ตัวนั้นได้เลย'
    setTimeout(() => { cpBtn.textContent = '📋 คัดลอกบรีฟทั้งหมด'; cpBtn.classList.remove('done') }, 2600)
  } catch {
    const r = document.createRange(); r.selectNodeContents(document.getElementById('brief'))
    const s = getSelection(); s.removeAllRanges(); s.addRange(r)
    cpMsg.textContent = 'เบราว์เซอร์ไม่ให้คัดลอกอัตโนมัติ — เลือกข้อความให้แล้ว กดคัดลอกเองได้เลย'
  }
})
</script>
`
writeFileSync(at('../docs/pet-balance-page.html'), html)
console.log('bytes', html.length)
