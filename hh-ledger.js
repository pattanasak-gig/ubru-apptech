/* =====================================================================
   UBRU AppTech System — hh-ledger.js  รายรับรายจ่ายครัวเรือน (DEC-127)
   ตัวชี้วัดหลักโครงการ AppTech: รายได้เพิ่ม + ต้นทุนลด ≥ 5,000 บาท/ครัวเรือน/เดือน
     รายได้เพิ่ม + ต้นทุนลด = จ. รายได้โดยตรงจากโครงการ + (ฐาน ก. − ก. รายจ่ายที่โครงการลดได้โดยตรง) + (ง. รายได้เดิมที่เกี่ยวข้อง − ฐาน ง.)
     ไม่นับ ข. ค. ฉ. (บันทึกไว้ดูรายรับรายจ่ายรวมของครัวเรือน) · ช. ผลผลิต BSF ที่ใช้เอง = ปริมาณเป็นหลักฐาน ไม่คิดเงินซ้ำ
     ฐาน ก. = ค่าที่ admin กำหนด หรือข้อมูลสำรวจ (ค่าอาหารสัตว์รวม + ค่าปุ๋ยรวม ต่อเดือน แท็บ 01) · ฐาน ง. = ค่าที่ admin กำหนดเท่านั้น (ข้อมูลสำรวจแยกยอดรายได้รายหมวดไม่ได้)
       ยังไม่มีฐาน → ส่วนนั้นนับเป็น 0 และแสดงสถานะ "ยังไม่มีค่าฐาน" (ไม่นับเกินจริง)
   หน้า: #hh/ledger (บันทึก) · #hh/income (แดชบอร์ด) · #hh/items (รายการ · admin) — ข้อมูล sql/023 · โหลดโดย food/index.html หลัง hh.js
   ===================================================================== */
const LG_TARGET = 5000;
const LG_GROUPS = [
  { k: 'e_direct', label: 'ก. รายจ่ายที่โครงการลดได้โดยตรง', short: 'รายจ่ายลดได้', kind: 'exp' },
  { k: 'i_project', label: 'จ. รายได้โดยตรงจากโครงการ', short: 'รายได้จากโครงการ', kind: 'inc' },
  { k: 'i_related', label: 'ง. รายได้เดิมที่เกี่ยวข้อง', short: 'รายได้เดิมที่เกี่ยวข้อง', kind: 'inc' },
  { k: 'self_use', label: 'ช. ผลผลิต BSF ที่ใช้เอง (ปริมาณ)', short: 'ใช้เอง', kind: 'qty' },
  { k: 'e_indirect', label: 'ข. รายจ่ายที่เกี่ยวข้องทางอ้อม', short: 'รายจ่ายทางอ้อม', kind: 'exp' },
  { k: 'e_other', label: 'ค. รายจ่ายอื่นที่ไม่เกี่ยวข้อง', short: 'รายจ่ายอื่น', kind: 'exp' },
  { k: 'i_other', label: 'ฉ. รายได้อื่นที่ไม่เกี่ยวข้อง', short: 'รายได้อื่น', kind: 'inc' }
];
const LG_CHANNELS = [['visit', 'เยี่ยมบ้าน'], ['center', 'มาที่ศูนย์'], ['phone', 'โทรศัพท์'], ['other', 'อื่น ๆ']];
const lgMonthKey = d => String(d || '').slice(0, 7);
const lgMonthLabel = k => k ? thMonth(k + '-01') : '-';
const lgShift = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const lgThisMonth = () => todayISO().slice(0, 7);
const lgBaht = n => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 }));

// ---------------------------------------------------------------------
// คำนวณ (ฟังก์ชันล้วน ใช้ทั้งหน้าจอและเทสต์)
// ---------------------------------------------------------------------
// ผลรวมต่อหมวดของการบันทึก 1 เดือน · self_qty = ปริมาณที่ใช้เอง (กก.)
function lgSums(lines, itemById) {
  const s = { e_direct: 0, e_indirect: 0, e_other: 0, i_related: 0, i_project: 0, i_other: 0, self_qty: 0, e_feed: 0, e_fert: 0, n_feed: 0, n_fert: 0 };
  for (const l of lines) { const it = itemById[l.item_id]; if (!it || l.status === 'inactive') continue; if (it.grp === 'self_use') s.self_qty += +l.qty || 0; else s[it.grp] += +l.amount || 0; if (it.grp === 'e_direct') { const p = /ปุ๋ย/.test(String(it.name || '')) ? 'fert' : 'feed'; s['n_' + p]++; s['e_' + p] += +l.amount || 0; } }
  s.income = s.i_related + s.i_project + s.i_other; s.expense = s.e_direct + s.e_indirect + s.e_other; s.net = s.income - s.expense;
  return s;
}
// ค่าฐาน: ค่าที่ admin กำหนด > ข้อมูลสำรวจ (ก. เท่านั้น)
function lgBase(override, survey) {
  const eS = survey && survey.e_direct != null && !isNaN(survey.e_direct) ? survey.e_direct : null;
  return { e_fert: survey && survey.e_fert != null ? survey.e_fert : 0, e_direct: override && override.e_direct != null ? +override.e_direct : eS, e_src: override && override.e_direct != null ? 'กำหนดเอง' : eS != null ? 'ข้อมูลสำรวจ' : null,
           i_related: override && override.i_related != null ? +override.i_related : null, i_src: override && override.i_related != null ? 'กำหนดเอง' : null };
}
// รายได้เพิ่ม + ต้นทุนลด ของ 1 เดือน (มติ 3A) · ส่วนที่ยังไม่มีฐาน = 0 และติดธง
function lgGain(sums, base) {
  const proj = sums.i_project, fB = base.e_fert || 0, cut = base.e_direct != null ? (sums.n_feed ? base.e_direct - fB - sums.e_feed : 0) + (sums.n_fert ? fB - sums.e_fert : 0) : 0, rel = base.i_related != null ? sums.i_related - base.i_related : 0;
  return { proj, cut, rel, total: proj + cut + rel, noBaseE: base.e_direct == null, noBaseI: base.i_related == null };
}
const lgStatus = t => (t >= LG_TARGET ? { c: '#2E7D32', l: 'ถึงเป้า' } : t >= LG_TARGET * 0.6 ? { c: '#F9A825', l: 'ใกล้เป้า' } : { c: '#C62828', l: 'ยังห่างเป้า' });

// ---------------------------------------------------------------------
// โหลดข้อมูล (เรียกจาก hhLoad) · ยังไม่รัน sql/023 = null
// ---------------------------------------------------------------------
async function lgLoad(projectId) {
  try {
    const [items, months, lines, base] = await Promise.all([
      api.list('hh.ledger_item', { eq: { project_id: projectId }, order: ['sort_order'] }),
      api.list('hh.ledger_month', { eq: { project_id: projectId, status: 'active' }, order: ['month'] }),
      api.list('hh.ledger_line', { eq: { project_id: projectId, status: 'active' } }),
      api.list('hh.baseline', { eq: { project_id: projectId } })]);
    const itemById = Object.fromEntries(items.map(i => [i.id, i])), byMonth = {};
    for (const l of lines) (byMonth[l.month_id] = byMonth[l.month_id] || []).push(l);
    return { items, itemById, months, lines, byMonth, base: Object.fromEntries(base.map(b => [b.hh_code, b])) };
  } catch (e) { console.warn('hh.ledger_* (sql/023) missing:', e && e.message); return null; }
}
// ค่าฐานจากข้อมูลสำรวจในชีต (แท็บ 01: ค่าอาหารสัตว์รวม/เดือน + ค่าปุ๋ยรวม/เดือน)
function lgSurvey(code) {
  const H = S._hh, r = H.reg.find(x => x.hh_code === code); if (!r) return null;
  const f = hhNumv(H.roleVal(r, '01', 'feed_cost')), z = hhNumv(H.roleVal(r, '01', 'fert_cost'));
  return { e_feed: isNaN(f) ? null : f, e_fert: isNaN(z) ? null : z, e_direct: isNaN(f) && isNaN(z) ? null : (isNaN(f) ? 0 : f) + (isNaN(z) ? 0 : z) };
}
const lgBaseOf = code => lgBase((S._hh.lg.base || {})[code], lgSurvey(code));
// แถวสรุปรายครัวเรือนรายเดือน (เฉพาะเดือนที่บันทึก)
function lgRows() {
  const H = S._hh, L = H.lg; if (!L) return [];
  return L.months.map(m => { const sums = lgSums(L.byMonth[m.id] || [], L.itemById), base = lgBaseOf(m.hh_code), g = lgGain(sums, base), reg = H.reg.find(x => x.hh_code === m.hh_code);
    return { m, code: m.hh_code, month: lgMonthKey(m.month), sums, base, g, reg, moo: reg ? String(H.roleVal(reg, '01', 'moo') ?? '').trim() : '', tambon: reg ? String(H.roleVal(reg, '01', 'tambon') ?? '').trim() : '', name: reg ? H.roleVal(reg, '01', 'name') || '' : '' }; });
}
const lgVillage = r => `${r.moo ? 'ม.' + r.moo + ' ' : ''}ต.${r.tambon || '-'}`;
const lgNeed = () => `<div class="card"><h4 style="margin-top:0">รายรับรายจ่ายครัวเรือน</h4><div class="banner warn">ฐานข้อมูลยังไม่มีส่วนรายรับรายจ่าย (sql/023)</div></div>`;

// ---------------------------------------------------------------------
// หน้าบันทึก #hh/ledger[/รหัส[/YYYY-MM]]
// ---------------------------------------------------------------------
function hhLedgerPage(view, code, month) {
  const H = S._hh, L = H.lg; if (!L) return view.innerHTML = hhShell('ledger', lgNeed());
  code = code ? decodeURIComponent(code) : ''; const reg = code ? H.reg.find(r => r.hh_code === code) : null;
  const recent = [...new Set(L.months.slice().sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))).map(m => m.hh_code))].slice(0, 6);
  const search = `<div class="card"><div class="cardhead"><h4>1 · เลือกครัวเรือน</h4>${qBtn('การค้นหาครัวเรือน', '<p>พิมพ์บางส่วนของชื่อ รหัส หมู่ หรือตำบล แล้วเลือกจากรายการ</p><p>ครัวเรือนที่บันทึกล่าสุดแสดงเป็นปุ่มด้านล่าง กดได้ทันที</p>')}</div>
    <input type="search" id="lgQ" aria-label="ค้นหาครัวเรือน" placeholder="ชื่อ · รหัส · หมู่ · ตำบล" autocomplete="off" oninput="lgSearch(this.value)" value="">
    <div id="lgHits" class="lg-hits"></div>
    ${recent.length ? `<div class="muted" style="margin-top:6px">บันทึกล่าสุด</div><div class="lg-chips lg-recent">${recent.map(c => { const r = H.reg.find(x => x.hh_code === c); return `<a class="lg-chip" href="#hh/ledger/${encodeURIComponent(c)}">${esc(c)} · ${esc(r ? H.roleVal(r, '01', 'name') || '' : '')}</a>`; }).join('')}</div>` : ''}</div>`;
  if (!reg) return view.innerHTML = hhShell('ledger', search + (code ? `<div class="card">ไม่พบรหัส ${esc(code)}</div>` : ''));
  const mine = L.months.filter(m => m.hh_code === code), done = new Set(mine.map(m => lgMonthKey(m.month)));
  month = /^\d{4}-\d{2}$/.test(month || '') ? month : lgThisMonth();
  const rec = mine.find(m => lgMonthKey(m.month) === month) || null;
  const prev = mine.filter(m => lgMonthKey(m.month) < month).sort((a, b) => String(b.month).localeCompare(String(a.month)))[0] || null;
  // สถานะฟอร์ม: จากการบันทึกเดิมของเดือนนี้ (แก้) หรือว่าง (ใหม่)
  const f = S._lgForm = { code, month, recId: rec ? rec.id : null, channel: rec ? rec.channel : (S._lgCh || 'visit'), note: rec ? rec.note || '' : '', vals: {} };
  for (const l of rec ? (L.byMonth[rec.id] || []) : []) f.vals[l.item_id] = { amount: l.amount, qty: l.qty, price: l.price, id: l.id };
  for (const it of L.items) if (it.mode === 'qty_price') { const v = f.vals[it.id] = f.vals[it.id] || {}; if (v.price == null) v.price = it.default_price ?? lgLastPrice(it.id); }   // ราคาตั้งต้น/ล่าสุด ไม่ต้องพิมพ์ซ้ำ
  const base = lgBaseOf(code), name = H.roleVal(reg, '01', 'name') || '';
  const monthChips = [0, -1, -2].map(n => lgShift(lgThisMonth(), n)).map(k => `<a class="lg-chip ${k === month ? 'on' : ''}" href="#hh/ledger/${encodeURIComponent(code)}/${k}">${lgMonthLabel(k)}${done.has(k) ? ' ✓' : ''}</a>`).join('');
  const items = L.items.filter(i => i.status === 'active');
  const grpCard = g => { const its = items.filter(i => i.grp === g.k); if (!its.length) return '';
    return `<div class="card lg-grp lg-${g.kind}"><h4 style="margin:0 0 6px">${esc(g.label)}</h4>${its.map(lgItemRow).join('')}</div>`; };
  view.innerHTML = hhShell('ledger', `${search}
    <div class="card"><div class="cardhead"><div><h4 style="margin:0">${esc(code)} · ${esc(name)}</h4><div class="muted">${esc(lgVillage({ moo: String(H.roleVal(reg, '01', 'moo') ?? '').trim(), tambon: String(H.roleVal(reg, '01', 'tambon') ?? '').trim() }))}</div></div><a class="small" href="#hh/h/${encodeURIComponent(code)}">ข้อมูลครัวเรือน ›</a></div>
      <div class="lg-base">ค่าฐานก่อนเข้าร่วม: ก. ${base.e_direct == null ? '<b style="color:var(--warn)">ยังไม่มี</b>' : lgBaht(base.e_direct) + ' บาท/เดือน'} <span class="muted">(${esc(base.e_src || '-')})</span> · ง. ${base.i_related == null ? '<b style="color:var(--warn)">ยังไม่กำหนด</b>' : lgBaht(base.i_related) + ' บาท/เดือน'} <button class="small secondary" onclick="lgBaseForm('${esc(code)}')">แก้ค่าฐาน</button>${qBtn('ค่าฐานก่อนเข้าร่วม', '<p>ก. รายจ่ายที่โครงการลดได้โดยตรง ใช้ค่าที่กำหนดเอง หรือข้อมูลสำรวจในชีต (ค่าอาหารสัตว์รวม + ค่าปุ๋ยรวม ต่อเดือน)</p><p>ง. รายได้เดิมที่เกี่ยวข้อง ต้องกำหนดเอง เพราะข้อมูลสำรวจแยกยอดรายได้รายหมวดไม่ได้ ระหว่างที่ยังไม่กำหนด ส่วนนี้นับเป็น 0 (ไม่นับเกินจริง)</p>')}</div></div>
    <div class="card"><h4 style="margin:0 0 6px">2 · เดือนและช่องทาง</h4>
      <div class="lg-chips">${monthChips}<label class="lg-chip" style="cursor:pointer">เลือกเดือน <input type="month" value="${month}" max="${lgThisMonth()}" style="width:auto;min-height:32px;padding:2px 6px" onchange="if(this.value)go('#hh/ledger/${encodeURIComponent(code)}/'+this.value)"></label></div>
      <div class="lg-chips" style="margin-top:6px">${LG_CHANNELS.map(([k, l]) => `<button type="button" class="lg-chip ${f.channel === k ? 'on' : ''}" onclick="lgChannel('${k}',this)">${l}</button>`).join('')}</div>
      <div class="row" style="margin-top:6px;gap:6px">${rec ? `<span class="pill">แก้ไขการบันทึกเดือน ${lgMonthLabel(month)}</span>` : `<span class="pill" style="background:#e0f2fe">บันทึกใหม่ เดือน ${lgMonthLabel(month)}</span>`}${!rec && prev ? `<button class="small secondary" onclick="lgCopyPrev('${prev.id}')">ใช้รายการเดือน ${lgMonthLabel(lgMonthKey(prev.month))}</button>` : ''}</div></div>
    <div class="lg-sep">นับเข้าเป้า 5,000 บาท (ก. จ. ง.) และผลผลิตที่ใช้เอง</div>
    ${LG_GROUPS.slice(0, 4).map(grpCard).join('')}
    <div class="lg-sep">บันทึกเพื่อดูรายรับรายจ่ายทั้งหมด (ไม่นับเข้าเป้า)</div>
    ${LG_GROUPS.slice(4).map(grpCard).join('')}
    <div class="card"><label for="lgNote" style="margin:0">หมายเหตุ (ไม่บังคับ)</label><input id="lgNote" value="${esc(f.note)}" oninput="S._lgForm.note=this.value"></div>
    <div class="lg-bar" id="lgBar"></div>
    ${rec && hhCanAdmin() ? `<div class="row" style="margin:8px 0 80px"><button class="small secondary" onclick="lgDelete('${rec.id}')">ยกเลิกการบันทึกเดือนนี้</button></div>` : '<div style="height:80px"></div>'}`);
  lgBar();
}
// แถวรายการ 1 แถว: บาท (ปุ่มเพิ่มเร็ว) · ปริมาณ × ราคา · ปริมาณอย่างเดียว
function lgItemRow(it) {
  const v = (S._lgForm.vals[it.id] || {}), id = it.id;
  const num = (k, val, ph, w) => `<input type="text" inputmode="decimal" aria-label="${esc(it.name)} ${ph}" placeholder="${ph}" value="${val == null ? '' : esc(String(+val))}" style="width:${w}px;min-height:40px;text-align:right" oninput="lgSet('${id}','${k}',this.value)" id="lg_${k}_${id}">`;
  const quick = (k, steps) => steps.map(s => `<button type="button" class="lg-q" onclick="lgAdd('${id}','${k}',${s})">+${fmtInt(s)}</button>`).join('');
  const clear = `<button type="button" class="lg-q" aria-label="ล้างค่า ${esc(it.name)}" onclick="lgClear('${id}')">×</button>`;
  let ctl, qs;
  if (it.mode === 'qty_price') ctl = `${num('qty', v.qty, it.unit || 'ปริมาณ', 72)}<span class="muted">${esc(it.unit || '')} ×</span>${num('price', v.price ?? it.default_price ?? lgLastPrice(it.id), 'ราคา', 64)}<span class="muted">= <b id="lg_amt_${id}">${v.qty != null && (v.price ?? it.default_price) != null ? lgBaht(v.qty * (v.price ?? it.default_price)) : '-'}</b> ฿</span>`, qs = quick('qty', [1, 5, 10]);
  else if (it.mode === 'qty_only') ctl = `${num('qty', v.qty, it.unit || 'ปริมาณ', 80)}<span class="muted">${esc(it.unit || '')}</span>`, qs = quick('qty', [1, 5, 10]);
  else ctl = `${num('amount', v.amount, 'บาท', 96)}`, qs = quick('amount', [100, 500, 1000]);
  return `<div class="lg-row"><div class="lg-name">${esc(it.name)}${it.public_name ? `<div class="muted" style="font-size:12px">ภายนอก: ${esc(it.public_name)}</div>` : ''}</div><div class="lg-ctl">${ctl}<span class="lg-qs">${qs}${clear}</span></div></div>`;
}
// ราคาล่าสุดที่เคยกรอกของรายการนี้ (ช่วยไม่ต้องพิมพ์ซ้ำ)
function lgLastPrice(itemId) { const ls = (S._hh.lg.lines || []).filter(l => l.item_id === itemId && l.price != null).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))); return ls[0] ? ls[0].price : null; }
const lgN = v => { const t = String(v ?? '').replace(/,/g, '').trim(); return t === '' ? null : (isNaN(+t) || +t < 0 ? NaN : +t); };
function lgSet(id, k, val) { const f = S._lgForm, v = f.vals[id] = f.vals[id] || {}; const n = lgN(val); v[k] = isNaN(n) ? v[k] : n; lgRow(id); lgBar(); }
function lgAdd(id, k, step) { const f = S._lgForm, v = f.vals[id] = f.vals[id] || {}; v[k] = Math.round(((+v[k] || 0) + step) * 100) / 100; const el = $(`#lg_${k}_${id}`); if (el) el.value = v[k]; lgRow(id); lgBar(); }
function lgClear(id) { const v = S._lgForm.vals[id] = S._lgForm.vals[id] || {}; for (const k of ['amount', 'qty', 'price']) { if (k !== 'price') v[k] = null; const el = $(`#lg_${k}_${id}`); if (el && k !== 'price') el.value = ''; } lgRow(id); lgBar(); }
function lgRow(id) { const it = S._hh.lg.itemById[id], v = S._lgForm.vals[id] || {}; if (it && it.mode === 'qty_price') { const pEl = $(`#lg_price_${id}`), price = v.price ?? lgN(pEl && pEl.value); v.price = price; const a = $(`#lg_amt_${id}`); if (a) a.textContent = v.qty != null && price != null ? lgBaht(v.qty * price) : '-'; } }
function lgChannel(k, btn) { S._lgForm.channel = k; S._lgCh = k; btn.parentElement.querySelectorAll('.lg-chip').forEach(b => b.classList.toggle('on', b === btn)); }
function lgCopyPrev(monthId) {
  const L = S._hh.lg, f = S._lgForm;
  for (const l of L.byMonth[monthId] || []) f.vals[l.item_id] = { amount: l.amount, qty: l.qty, price: l.price, id: (f.vals[l.item_id] || {}).id };
  for (const it of L.items) { for (const k of ['amount', 'qty', 'price']) { const el = $(`#lg_${k}_${it.id}`); const v = (f.vals[it.id] || {})[k]; if (el && v != null) el.value = +v; } lgRow(it.id); }
  lgBar(); toast('ดึงรายการเดือนก่อนแล้ว แก้เฉพาะตัวเลขที่เปลี่ยน แล้วกดบันทึก');
}
// ค่าในฟอร์ม → เส้นสมมติของบรรทัด (ใช้คำนวณแถบสรุป)
function lgFormLines() {
  const L = S._hh.lg, out = [];
  for (const [id, v] of Object.entries(S._lgForm.vals)) { const it = L.itemById[id]; if (!it) continue;
    const amount = it.mode === 'qty_price' ? (v.qty != null && v.price != null ? v.qty * v.price : v.amount ?? null) : it.mode === 'qty_only' ? null : v.amount;
    if (amount == null && v.qty == null) continue; out.push({ item_id: id, amount, qty: v.qty }); }
  return out;
}
function lgBar() {
  const el = $('#lgBar'); if (!el) return;
  const s = lgSums(lgFormLines(), S._hh.lg.itemById), b = lgBaseOf(S._lgForm.code), g = lgGain(s, b), st = lgStatus(g.total), pct = Math.max(0, Math.min(100, g.total / LG_TARGET * 100));
  el.innerHTML = `<div class="lg-bar-in"><div class="lg-bar-top"><span>รายได้เพิ่ม + ต้นทุนลด</span><b style="color:${st.c}">${lgBaht(g.total)} / ${lgBaht(LG_TARGET)} บาท</b>${qBtn('วิธีคิดเทียบเป้า', `<p>จ. รายได้จากโครงการ ${lgBaht(g.proj)} บาท</p><p>+ ต้นทุนที่ลดลง (ฐาน ก. ${b.e_direct == null ? 'ยังไม่มี' : lgBaht(b.e_direct)} − ก. เดือนนี้ ${lgBaht(s.e_direct)}) = ${g.noBaseE ? '0 (ยังไม่มีค่าฐาน)' : lgBaht(g.cut)} บาท</p><p>+ รายได้เดิมที่เพิ่มขึ้น (ง. เดือนนี้ ${lgBaht(s.i_related)} − ฐาน ง. ${b.i_related == null ? 'ยังไม่กำหนด' : lgBaht(b.i_related)}) = ${g.noBaseI ? '0 (ยังไม่กำหนดค่าฐาน)' : lgBaht(g.rel)} บาท</p><p class="muted">ไม่นับ ข. ค. ฉ. และผลผลิตที่ใช้เอง (นับผ่านต้นทุนที่ลดลงแล้ว)</p>`)}</div>
    <div class="lg-prog"><div style="width:${pct}%;background:${st.c}"></div></div>
    <div class="lg-bar-row"><span>รายรับ ${lgBaht(s.income)} · รายจ่าย ${lgBaht(s.expense)} · คงเหลือ ${lgBaht(s.net)}</span><button onclick="lgSave()">บันทึก</button></div></div>`;
}
async function lgSave() {
  const H = S._hh, L = H.lg, f = S._lgForm;
  try {
    let monthId = f.recId;
    if (monthId) await api.update('hh.ledger_month', monthId, { channel: f.channel, note: f.note || null });
    else monthId = (await api.insert('hh.ledger_month', { project_id: H.link.project_id, hh_code: f.code, month: f.month + '-01', channel: f.channel, note: f.note || null })).id;
    const old = Object.fromEntries((L.byMonth[f.recId] || []).map(l => [l.item_id, l]));
    for (const it of L.items) {
      const v = f.vals[it.id] || {}, has = it.mode === 'amount' ? v.amount != null : it.mode === 'qty_price' ? (v.qty != null && v.qty > 0) || v.amount > 0 : v.qty != null && v.qty > 0, o = old[it.id];
      const rec = { amount: it.mode === 'amount' ? v.amount : it.mode === 'qty_price' && v.qty != null && v.price != null ? Math.round(v.qty * v.price * 100) / 100 : it.mode === 'qty_price' ? v.amount ?? null : null, qty: it.mode === 'amount' ? null : v.qty, price: it.mode === 'qty_price' ? v.price ?? null : null };
      if (has && o) await api.update('hh.ledger_line', o.id, rec);
      else if (has) await api.insert('hh.ledger_line', { month_id: monthId, item_id: it.id, ...rec });
      else if (o) await api.update('hh.ledger_line', o.id, { status: 'inactive' });
    }
    toast(`บันทึก ${f.code} เดือน ${lgMonthLabel(f.month)} แล้ว`);
    H.lg = await lgLoad(H.link.project_id); render();
  } catch (e) { fail(e, 'บันทึกรายรับรายจ่ายไม่สำเร็จ'); }
}
async function lgDelete(monthId) {
  if (!confirm('ยกเลิกการบันทึกเดือนนี้ของครัวเรือนนี้? (ตัวเลขของเดือนนี้จะไม่ถูกนับในแดชบอร์ด)')) return;
  try { await api.update('hh.ledger_month', monthId, { status: 'inactive' }); toast('ยกเลิกแล้ว'); S._hh.lg = await lgLoad(S._hh.link.project_id); render(); } catch (e) { fail(e); }
}
// ค้นหาครัวเรือน (พิมพ์บางส่วน → เลือก)
function lgSearch(q) {
  const H = S._hh, t = String(q || '').trim().toLowerCase(), el = $('#lgHits'); if (!el) return;
  if (!t) return el.innerHTML = '';
  const hits = H.reg.filter(r => [r.hh_code, H.roleVal(r, '01', 'name'), 'ม.' + (H.roleVal(r, '01', 'moo') ?? ''), H.roleVal(r, '01', 'moo'), H.roleVal(r, '01', 'tambon')].some(v => String(v ?? '').toLowerCase().includes(t))).slice(0, 8);
  el.innerHTML = hits.map(r => `<a class="lg-hit" href="#hh/ledger/${encodeURIComponent(r.hh_code)}"><b>${esc(r.hh_code)}</b> ${esc(H.roleVal(r, '01', 'name') || '')} <span class="muted">${esc(lgVillage({ moo: String(H.roleVal(r, '01', 'moo') ?? '').trim(), tambon: String(H.roleVal(r, '01', 'tambon') ?? '').trim() }))}</span></a>`).join('') || '<div class="muted">ไม่พบครัวเรือน</div>';
}
function lgBaseForm(code) {
  const b = (S._hh.lg.base || {})[code] || {}, sv = lgSurvey(code);
  openModal(`<h3 style="margin-top:0">ค่าฐานก่อนเข้าร่วม · ${esc(code)}</h3>
    <label for="lgBE">ก. รายจ่ายที่โครงการลดได้โดยตรง (บาท/เดือน)</label><input id="lgBE" inputmode="decimal" value="${b.e_direct ?? ''}" placeholder="${sv && sv.e_direct != null ? 'ว่าง = ใช้ข้อมูลสำรวจ ' + lgBaht(sv.e_direct) : 'ว่าง = ยังไม่มี'}">
    <label for="lgBI">ง. รายได้เดิมที่เกี่ยวข้อง (บาท/เดือน)</label><input id="lgBI" inputmode="decimal" value="${b.i_related ?? ''}" placeholder="ว่าง = ยังไม่กำหนด (ไม่นับส่วนนี้)">
    <label for="lgBN">ที่มาของค่า (ไม่บังคับ)</label><input id="lgBN" value="${esc(b.note || '')}" placeholder="เช่น สัมภาษณ์ 1 ต.ค. 2569">
    <div class="row" style="margin-top:10px"><button onclick="lgBaseSave('${esc(code)}')">บันทึก</button><button class="secondary" onclick="closeModal()">ยกเลิก</button></div>`);
}
async function lgBaseSave(code) {
  const H = S._hh, e = lgN($('#lgBE').value), i = lgN($('#lgBI').value);
  if (isNaN(e) || isNaN(i)) return toastErr('ตัวเลขไม่ถูกต้อง', 'ใส่ตัวเลขที่ไม่ติดลบ หรือเว้นว่าง');
  try { const old = (H.lg.base || {})[code], rec = { e_direct: e, i_related: i, note: $('#lgBN').value.trim() || null };
    if (old) await api.update('hh.baseline', old.id, rec); else await api.insert('hh.baseline', { project_id: H.link.project_id, hh_code: code, ...rec });
    closeModal(); toast('บันทึกค่าฐานแล้ว'); H.lg = await lgLoad(H.link.project_id); render(); } catch (e2) { fail(e2); }
}

// ---------------------------------------------------------------------
// แดชบอร์ด #hh/income
// ---------------------------------------------------------------------
function hhIncomePage(view) {
  const H = S._hh, L = H.lg; if (!L) return view.innerHTML = hhShell('income', lgNeed());
  const st = S._lgd = S._lgd || { level: 'all', key: '', from: lgShift(lgThisMonth(), -11), to: lgThisMonth(), src: H.rp && H.rp.months.length ? 'report' : 'ledger' };   // DEC-136 เริ่มที่ยอดรายเดือนเมื่อมีข้อมูล
  const all = (st.src === 'report' && H.rp ? rpRows() : lgRows()).filter(r => r.month >= st.from && r.month <= st.to);   // DEC-132: เลือกแหล่งข้อมูล
  const inScope = r => st.level === 'all' || !st.key ? true : st.level === 'tambon' ? r.tambon === st.key : st.level === 'moo' ? lgVillage(r) === st.key : r.code === st.key;
  const rows = all.filter(inScope);
  const regScope = H.reg.filter(r => inScope({ code: r.hh_code, tambon: String(H.roleVal(r, '01', 'tambon') ?? '').trim(), moo: String(H.roleVal(r, '01', 'moo') ?? '').trim() }));
  const months = [...new Set(rows.map(r => r.month))].sort(), last = months[months.length - 1] || null;
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const lastRows = rows.filter(r => r.month === last), reach = lastRows.filter(r => r.g.total >= LG_TARGET).length;
  const missing = last ? regScope.filter(r => !lastRows.some(x => x.code === r.hh_code)) : regScope;
  const noBase = [...new Set(rows.filter(r => r.g.noBaseE || r.g.noBaseI).map(r => r.code))].length;
  const opts = (lv) => lv === 'tambon' ? [...new Set(H.reg.map(r => String(H.roleVal(r, '01', 'tambon') ?? '').trim()).filter(Boolean))].sort().map(t => [t, 'ต.' + t])
    : lv === 'moo' ? [...new Set(H.reg.map(r => lgVillage({ moo: String(H.roleVal(r, '01', 'moo') ?? '').trim(), tambon: String(H.roleVal(r, '01', 'tambon') ?? '').trim() })))].sort().map(v => [v, v])
    : lv === 'hh' ? H.reg.map(r => [r.hh_code, `${r.hh_code} · ${H.roleVal(r, '01', 'name') || ''}`]) : [];
  S._lgCsv = rows.map(r => ({ เดือน: r.month, รหัส: r.code, ชื่อ: r.name, หมู่บ้าน: lgVillage(r), 'ก_รายจ่ายลดได้': r.sums.e_direct, 'ข_รายจ่ายทางอ้อม': r.sums.e_indirect, 'ค_รายจ่ายอื่น': r.sums.e_other, 'ง_รายได้เดิมที่เกี่ยวข้อง': r.sums.i_related, 'จ_รายได้จากโครงการ': r.sums.i_project, 'ฉ_รายได้อื่น': r.sums.i_other, 'ช_ใช้เอง_กก': r.sums.self_qty, ฐาน_ก: r.base.e_direct ?? '', ฐาน_ง: r.base.i_related ?? '', ต้นทุนลด: r.g.cut, รายได้เดิมเพิ่ม: r.g.rel, รายได้เพิ่มรวมต้นทุนลด: r.g.total, ถึงเป้า: r.g.total >= LG_TARGET ? 'ใช่' : '' }));
  // ตารางย่อย: ระดับถัดไป
  const next = st.level === 'all' ? 'tambon' : st.level === 'tambon' ? 'moo' : st.level === 'moo' ? 'hh' : 'month';
  const keyOf = r => next === 'tambon' ? r.tambon || '-' : next === 'moo' ? lgVillage(r) : next === 'hh' ? r.code : r.month;
  const grp = {}; for (const r of rows) { const k = keyOf(r); const x = grp[k] = grp[k] || { k, rows: [], hh: new Set() }; x.rows.push(r); x.hh.add(r.code); }
  const lab = k => next === 'tambon' ? 'ต.' + k : next === 'hh' ? `${k} · ${(rows.find(r => r.code === k) || {}).name || ''}` : next === 'month' ? lgMonthLabel(k) : k;
  const drill = k => next === 'month' ? '' : `onclick="S._lgd.level='${next}';S._lgd.key='${esc(k).replace(/'/g, "\\'")}';render()" style="cursor:pointer"`;
  const table = Object.values(grp).map(x => ({ ...x, t: avg(x.rows.map(r => r.g.total)), p: avg(x.rows.map(r => r.g.proj)), c: avg(x.rows.map(r => r.g.cut)), e: avg(x.rows.map(r => r.g.rel)), hit: x.rows.filter(r => r.g.total >= LG_TARGET).length / x.rows.length })).sort((a, b) => (next === 'month' ? a.k.localeCompare(b.k) : b.t - a.t));
  const scopeLabel = st.level === 'all' || !st.key ? 'ทั้งโครงการ' : st.level === 'tambon' ? 'ต.' + st.key : st.key;
  const formulaQ = qBtn('รายได้เพิ่ม + ต้นทุนลด', `<p>= จ. รายได้โดยตรงจากโครงการ + (ฐาน ก. − ก. รายจ่ายที่โครงการลดได้โดยตรง) + (ง. รายได้เดิมที่เกี่ยวข้อง − ฐาน ง.)</p><p>ค่าเฉลี่ยคิดจากครัวเรือนที่บันทึกในเดือนนั้น · เป้าหมายโครงการ ${lgBaht(LG_TARGET)} บาท/ครัวเรือน/เดือน</p><p>ส่วนที่ยังไม่มีค่าฐานนับเป็น 0 (ไม่นับเกินจริง) · ต้นทุนเทียบแยกอาหารสัตว์กับปุ๋ย นับเฉพาะส่วนที่กรอกแล้ว (กรอก 0 = ไม่ได้ซื้อ) · ไม่นับ ข. ค. ฉ. และผลผลิต BSF ที่ใช้เอง</p>`);
  view.innerHTML = hhShell('income', `<div class="card"><div class="cardhead"><h4>แดชบอร์ดรายได้ครัวเรือน · ${esc(scopeLabel)} ${formulaQ}</h4><button class="small secondary" onclick="exportCsv(S._lgCsv,'รายรับรายจ่ายครัวเรือน')">ส่งออก CSV</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <select aria-label="ระดับการดู" style="width:auto" onchange="S._lgd.level=this.value;S._lgd.key='';render()">${[['all', 'ทั้งโครงการ'], ['tambon', 'ตำบล'], ['moo', 'หมู่บ้าน'], ['hh', 'ครัวเรือน']].map(([k, l]) => `<option value="${k}" ${st.level === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${st.level !== 'all' ? `<select aria-label="เลือก" style="width:auto;max-width:260px" onchange="S._lgd.key=this.value;render()"><option value="">ทั้งหมด</option>${opts(st.level).map(([v, l]) => `<option value="${esc(v)}" ${v === st.key ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
        <label style="margin:0">ตั้งแต่ <input type="month" value="${st.from}" style="width:auto" onchange="S._lgd.from=this.value;render()"></label><label style="margin:0">ถึง <input type="month" value="${st.to}" style="width:auto" onchange="S._lgd.to=this.value;render()"></label>
        <select aria-label="แหล่งข้อมูล" style="width:auto" onchange="S._lgd.src=this.value;render()"><option value="report" ${st.src === 'report' ? 'selected' : ''} ${H.rp ? '' : 'disabled'}>ยอดรายเดือน (รายได้เสริม + ต้นทุนลด)</option><option value="ledger" ${st.src === 'report' ? '' : 'selected'}>บันทึกแยกรายการ</option></select>
        ${st.level !== 'all' ? '<button class="small secondary" onclick="S._lgd.level=\'all\';S._lgd.key=\'\';render()">‹ ทั้งโครงการ</button>' : ''}</div></div>
    ${st.src === 'report' ? '<div class="banner info" style="margin:0 0 8px">ยอดรายเดือน: รายได้เสริม + ต้นทุนลด ของแต่ละครัวเรือน (ยอดรวมต่อเดือน ไม่แยกรายการ) · "จ." = รายได้เสริม</div>' : ''}
    ${!rows.length ? `<div class="card"><p class="muted" style="margin:0 0 12px">ยังไม่มีการบันทึกในช่วงที่เลือก</p><div><a class="btn" style="text-decoration:none" href="#hh/ledger">＋ บันทึกรายรับรายจ่าย</a></div></div>` : `
    <div class="kpis">
      <div class="kpi hero"><div class="l">เฉลี่ยต่อครัวเรือน เดือน ${lgMonthLabel(last)}</div><div class="v" style="color:${lgStatus(avg(lastRows.map(r => r.g.total))).c}">${lgBaht(avg(lastRows.map(r => r.g.total)))} บาท</div><div class="muted">เป้า ${lgBaht(LG_TARGET)} บาท/เดือน</div></div>
      <div class="kpi"><div class="l">ถึงเป้าในเดือน ${lgMonthLabel(last)}</div><div class="v">${fmtInt(reach)} / ${fmtInt(lastRows.length)}</div><div class="muted">ครัวเรือนที่บันทึก</div></div>
      <div class="kpi"><div class="l">บันทึกแล้วเดือน ${lgMonthLabel(last)}</div><div class="v">${fmtInt(lastRows.length)} / ${fmtInt(regScope.length)}</div><div class="muted">ครัวเรือนในขอบเขต</div></div>
      <div class="kpi"><div class="l">รายได้จากโครงการรวม (จ.)</div><div class="v">${lgBaht(rows.reduce((a, r) => a + r.sums.i_project, 0))} บาท</div><div class="muted">${lgMonthLabel(months[0])} – ${lgMonthLabel(last)}</div></div></div>
    ${noBase ? `<div class="banner warn" style="margin-top:8px">${fmtInt(noBase)} ครัวเรือนยังไม่มีค่าฐานบางส่วน ส่วนนั้นนับเป็น 0 · กำหนดได้ที่หน้าบันทึก → "แก้ค่าฐาน"</div>` : ''}
    <div class="grid-dash" style="margin-top:12px">
      <div class="card"><div class="cardhead"><h4>รายได้เพิ่ม + ต้นทุนลด เฉลี่ยต่อครัวเรือน (บาท/เดือน)</h4></div><div class="chartbox"><canvas id="lgTrend"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>องค์ประกอบ (เฉลี่ยต่อครัวเรือน)</h4></div><div class="chartbox"><canvas id="lgParts"></canvas></div></div>
      ${st.src === 'report' ? '' : '<div class="card"><div class="cardhead"><h4>รายรับ–รายจ่ายรวม (บาท)</h4></div><div class="chartbox"><canvas id="lgFlow"></canvas></div></div>'}
      <div class="card"><div class="cardhead"><h4>ยังไม่บันทึกเดือน ${lgMonthLabel(last)} (${fmtInt(missing.length)})</h4></div><div class="lg-chips" style="max-height:220px;overflow:auto">${missing.map(r => `<a class="lg-chip" href="#hh/ledger/${encodeURIComponent(r.hh_code)}/${last || lgThisMonth()}">${esc(r.hh_code)} · ${esc(H.roleVal(r, '01', 'name') || '')}</a>`).join('') || '<span class="muted">บันทึกครบแล้ว</span>'}</div></div></div>
    <div class="card"><div class="cardhead"><h4>${next === 'tambon' ? 'รายตำบล' : next === 'moo' ? 'รายหมู่บ้าน' : next === 'hh' ? 'รายครัวเรือน' : 'รายเดือน'} ${next !== 'month' ? '<span class="muted">กดแถวเพื่อดูละเอียด</span>' : ''}</h4></div><div class="tscroll"><table><thead><tr><th>${next === 'month' ? 'เดือน' : 'ชื่อ'}</th><th class="num">ครัวเรือน</th><th class="num">เดือนที่บันทึก</th><th class="num">รายได้เพิ่ม+ต้นทุนลด/เดือน</th><th class="num">จ. จากโครงการ</th><th class="num">ต้นทุนลด</th><th class="num">รายได้เดิมเพิ่ม</th><th class="num">เดือนที่ถึงเป้า</th></tr></thead><tbody>
      ${table.map(x => { const s = lgStatus(x.t); return `<tr ${drill(x.k)}><td><i class="dot" style="background:${s.c}"></i> ${esc(lab(x.k))}</td><td class="num">${fmtInt(x.hh.size)}</td><td class="num">${fmtInt(x.rows.length)}</td><td class="num"><b>${lgBaht(x.t)}</b></td><td class="num">${lgBaht(x.p)}</td><td class="num">${lgBaht(x.c)}</td><td class="num">${lgBaht(x.e)}</td><td class="num">${fmt(x.hit * 100, 0)}%</td></tr>`; }).join('')}
      </tbody></table></div><div class="muted" style="margin-top:4px"><i class="dot" style="background:#2E7D32"></i>ถึงเป้า ≥ ${lgBaht(LG_TARGET)} · <i class="dot" style="background:#F9A825"></i>ใกล้เป้า ≥ ${lgBaht(LG_TARGET * 0.6)} · <i class="dot" style="background:#C62828"></i>ยังห่างเป้า</div></div>`}`);
  if (!rows.length || !window.Chart) return;
  const lab2 = months.map(lgMonthLabel), by = k => months.map(mo => { const rs = rows.filter(r => r.month === mo); return Math.round(avg(rs.map(k)) || 0); });
  mkChart($('#lgTrend'), { data: { labels: lab2, datasets: [{ type: 'line', label: 'เฉลี่ยต่อครัวเรือน', data: by(r => r.g.total), borderColor: '#1F3A5F', backgroundColor: '#1F3A5F', tension: .2 }, { type: 'line', label: 'เป้า 5,000', data: months.map(() => LG_TARGET), borderColor: '#2E7D32', borderDash: [6, 4], pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } });
  mkChart($('#lgParts'), { type: 'bar', data: { labels: lab2, datasets: [{ label: 'จ. รายได้จากโครงการ', data: by(r => r.g.proj), backgroundColor: '#2E7D32' }, { label: 'ต้นทุนที่ลดลง', data: by(r => r.g.cut), backgroundColor: '#7CB342' }, { label: 'รายได้เดิมที่เพิ่มขึ้น', data: by(r => r.g.rel), backgroundColor: '#F9A825' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } } });
  const tot = k => months.map(mo => Math.round(rows.filter(r => r.month === mo).reduce((a, r) => a + r.sums[k], 0)));
  if ($('#lgFlow')) mkChart($('#lgFlow'), { type: 'bar', data: { labels: lab2, datasets: [{ label: 'รายรับ', data: tot('income'), backgroundColor: '#1F3A5F' }, { label: 'รายจ่าย', data: tot('expense'), backgroundColor: '#C62828' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } });
}
// สรุปสั้นในหน้าข้อมูลครัวเรือน
function hhLedgerMini(code) {
  const H = S._hh; if (!H.lg) return '';
  const rs = lgRows().filter(r => r.code === code).sort((a, b) => a.month.localeCompare(b.month)), last = rs[rs.length - 1];
  return `<div class="card"><div class="cardhead"><h4>รายรับรายจ่าย</h4><a class="btn small" style="text-decoration:none" href="#hh/ledger/${encodeURIComponent(code)}">＋ บันทึก</a></div>
    ${last ? `<div>เดือน ${lgMonthLabel(last.month)}: รายได้เพิ่ม + ต้นทุนลด <b style="color:${lgStatus(last.g.total).c}">${lgBaht(last.g.total)} บาท</b> (เป้า ${lgBaht(LG_TARGET)}) · บันทึกแล้ว ${fmtInt(rs.length)} เดือน · <a href="#hh/income" onclick="S._lgd={...(S._lgd||{}),level:'hh',key:'${esc(code)}',from:'${rs[0].month}',to:'${last.month}'}">ดูแนวโน้ม ›</a></div>` : '<div class="muted">ยังไม่มีการบันทึก</div>'}</div>`;
}
// รายการตามหมวด (admin)
function hhItemsPage(view) {
  const H = S._hh; if (!H.lg) return view.innerHTML = hhShell('items', lgNeed());
  if (!hhCanAdmin()) return view.innerHTML = hhShell('items', '<div class="card">เฉพาะ admin</div>');
  SPECS['hh.ledger_item'] = { table: 'hh.ledger_item', title: 'รายการรายรับรายจ่าย', order: ['sort_order'], eq: { project_id: H.link.project_id }, defaults: () => ({ project_id: H.link.project_id }), searchKeys: ['name'],
    intro: 'รายการที่แสดงในหน้าบันทึก แยกตามหมวด · "บาท" = กรอกจำนวนเงิน · "ปริมาณ × ราคา" = กรอกปริมาณ ระบบคูณราคาให้ · "ปริมาณอย่างเดียว" = ผลผลิตที่ใช้เอง ไม่คิดเงิน · ชื่อภายนอกใช้เมื่อแสดงต่อภายนอก เช่น วัสดุบำรุงดิน · ปิดใช้งานแทนการลบ',
    cols: [{ key: 'grp', label: 'หมวด', type: 'select', required: true, options: () => LG_GROUPS.map(g => ({ value: g.k, label: g.label })) }, { key: 'name', label: 'ชื่อรายการ', required: true }, { key: 'public_name', label: 'ชื่อเมื่อแสดงต่อภายนอก', nullable: true }, { key: 'mode', label: 'วิธีกรอก', type: 'select', required: true, options: () => [{ value: 'amount', label: 'บาท' }, { value: 'qty_price', label: 'ปริมาณ × ราคา' }, { value: 'qty_only', label: 'ปริมาณอย่างเดียว (ไม่คิดเงิน)' }] }, { key: 'unit', label: 'หน่วยของปริมาณ', nullable: true }, { key: 'default_price', label: 'ราคาตั้งต้นต่อหน่วย (บาท)', type: 'number', nullable: true }, { key: 'sort_order', label: 'ลำดับ', type: 'number' }, { key: 'status', label: 'สถานะ', type: 'status' }] };
  crudSection(SPECS['hh.ledger_item']).then(html => { view.innerHTML = hhShell('items', html); }).catch(e => fail(e));
}
