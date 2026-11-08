/* =====================================================================
   UBRU AppTech System — hh-detail.js  หน้าครัวเรือนแบบแถบส่วน + จัดหมวดคอลัมน์ + ช่วยกรอก (DEC-131)
   Gig 8 พ.ย. 2569: "เอาข้อมูลรายละเอียดบุคคลมาเรียงยาว ดูและใช้งานยากมาก" · "ทำตามที่เสนอ"
   ไม่เพิ่มคอลัมน์ในฐานข้อมูล ไม่แตะชีต: หมวดคำนวณจากลำดับคอลัมน์ของชีต · คอลัมน์ใหม่ในชีตไปอยู่หมวด "อื่น ๆ"
   โหลดหลัง hh.js (ฟังก์ชัน hhDetail ในไฟล์นี้แทนของเดิม)
   ===================================================================== */
// หมวดของแท็บ 01: [ชื่อหมวด, หัวคอลัมน์แรกของหมวด] เรียงตามชีต · หมวดสุดท้ายจบที่ HH_SEC01_END
const HH_SEC01 = [['ข้อมูลบุคคลและที่ตั้ง', 'รหัสครัวเรือน'], ['ครัวเรือนและอาชีพ', 'สมาชิกครัวเรือน (คน)'], ['รายได้และรายจ่าย', 'รายได้รวม/เดือน (อัตโนมัติ)'], ['การผลิตและพื้นที่', 'กิจกรรมการผลิต'],
  ['สัตว์ที่เลี้ยง', 'ไก่ไข่ (ตัว)'], ['เศษอาหารและต้นทุน', 'เศษอาหารในครัวเรือน (กก./วัน)'], ['ความพร้อมและบทบาท BSF', 'Pain Point'], ['ความยินยอม', 'ความยินยอม PDPA'], ['ค่าสถิติของชีต', 'นับสถิติครัวเรือน']];
const HH_SEC01_END = 'สมาชิกสถิติ';
const HH_RAW = /บัตร|โทร|รหัส|วันที่|เลขที่|ละติจูด|ลองจิจูด|สูตร/;
// แบ่งคอลัมน์เป็นหมวด: แท็บ 01 ตามหมวดข้างบน · แท็บอื่นหมวดเดียว · ช่องสูตรอัตโนมัติไปหมวดท้าย
function hhSections(T) {
  const cols = T.cols.slice().sort((a, b) => a.col_index - b.col_index), out = [], other = [], auto = [];
  if (T.tab.tab_key === '01') {
    const at = h => cols.findIndex(c => c.header === h), end = at(HH_SEC01_END), starts = HH_SEC01.map(([t, h]) => [t, at(h)]).filter(x => x[1] >= 0);
    cols.forEach((c, i) => { if (end >= 0 && i > end) return other.push(c); const s = starts.filter(x => x[1] <= i).pop(); if (!s) return other.push(c); let g = out.find(x => x.t === s[0]); if (!g) out.push(g = { t: s[0], cols: [] }); g.cols.push(c); });
  } else { for (const c of cols) (c.is_formula ? auto : other).push(c); if (other.length) out.push({ t: 'ข้อมูล', cols: other.splice(0) }); }
  if (other.length) out.push({ t: 'อื่น ๆ', cols: other });
  if (auto.length) out.push({ t: 'ข้อมูลอัตโนมัติจากชีต', cols: auto, closed: true });
  if (T.tab.tab_key === '01') { const s = out.find(x => x.t === 'ค่าสถิติของชีต'); if (s) s.closed = true; }
  return out;
}
// แสดงค่า: ตัวเลขจัดรูปแบบ (ยกเว้นรหัส วันที่ พิกัด เลขที่)
function hhFmtVal(v, header) {
  if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v ?? '').trim())) { if (HH_RAW.test(header)) return String(v); const n = Number(v); return Number.isInteger(n) ? fmtInt(n) : fmt(n, 2); }
  return String(v ?? '');
}
function hhKv(T, r, code) {
  const show = (S._hhShow || {})[code], empty = S._hhEmpty, d = r.data || {};
  return hhSections(T).map(s => {
    const items = s.cols.filter(c => empty || !hhBlank(d[c.header])); if (!items.length) return '';
    return `<details class="kvs" ${s.closed ? '' : 'open'}><summary>${esc(s.t)} <span class="muted">(${items.length})</span></summary><div class="kvg">${items.map(c => { const v = d[c.header], sv = hhBlank(v) ? '–' : c.sensitive && !show ? hhMask(v, c.header) : hhFmtVal(v, c.header);
      return `<div class="kv${HH_LONG.test(c.header) || String(sv).length > 60 ? ' wide' : ''}"><span class="k">${esc(c.header.replace(/\s*\(อัตโนมัติ\)$/, ''))}${c.is_formula ? ' ⓕ' : ''}</span><span class="v">${esc(sv)}</span></div>`; }).join('')}</div></details>`;
  }).join('');
}
const HH_DTABS = [['sum', 'สรุป'], ['01', 'ทะเบียน'], ['02', 'รายได้'], ['03', 'อาหารสัตว์'], ['04', 'ปุ๋ย'], ['05', 'หนี้สิน'], ['inv', 'นวัตกร'], ['ledger', 'รายรับรายจ่าย'], ['svc', 'รับหนอน'], ['photo', 'รูป']];
async function hhDetail(view, code, tab) {
  const H = S._hh, reg = H.reg.find(r => r.hh_code === code);
  if (!reg) return view.innerHTML = hhShell('detail', `<div class="card">ไม่พบรหัส ${esc(code)} ในทะเบียน</div>`);
  tab = HH_DTABS.some(x => x[0] === tab) ? tab : ['06', '07', '09'].includes(tab) ? 'inv' : 'sum';
  if (tab === 'svc' && typeof svLoad === 'function') await svLoad();
  S._hhShow = S._hhShow || {};
  const rv = role => H.roleVal(reg, '01', role), ec = esc(code), url = t => `#hh/h/${encodeURIComponent(code)}/${t}`;
  const head = `<div class="card"><div class="cardhead"><div><h4 style="margin:0">${ec} · ${esc(rv('name') || '')}</h4><div class="muted">กลุ่ม ${esc(rv('group') || '-')} · ${rv('moo') ? 'ม.' + esc(rv('moo')) + ' ' : ''}ต.${esc(rv('tambon') || '-')} · ${esc(rv('status') || '')}</div></div>
    <div class="row" style="gap:6px"><button class="small secondary" onclick="S._hhShow['${ec}']=!S._hhShow['${ec}'];render()">${S._hhShow[code] ? 'ซ่อน' : 'แสดง'}ข้อมูลส่วนบุคคล</button>${hhCanAdmin() ? `<a class="btn small" style="text-decoration:none" href="#hh/service/${encodeURIComponent(code)}">＋ รับหนอน</a>` : ''}</div></div>
    <div class="subtabs" style="margin:8px 0 0">${HH_DTABS.map(([k, l]) => `<a href="${url(k)}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</div></div>`;
  const emptyBtn = `<label class="lg-chip" style="cursor:pointer"><input type="checkbox" ${S._hhEmpty ? 'checked' : ''} onchange="S._hhEmpty=this.checked;render()" style="width:auto;min-height:0"> แสดงช่องว่าง</label>`;
  const rowsOf = key => { const T = H.byKey[key]; if (!T) return '<div class="card muted">ยังไม่มีแท็บนี้ในระบบ (ซิงก์กับชีตก่อน)</div>'; const rs = T.rows.filter(r => r.hh_code === code);
    return `<div class="card"><div class="cardhead"><h4>${esc(T.tab.label)} (${rs.length})</h4><div class="row" style="gap:6px">${emptyBtn}${key === '01' ? `<button class="small" onclick="hhEdit('01','${reg.id}')">แก้ทะเบียน</button>` : `<button class="small" onclick="hhEdit('${key}',null,{'รหัสครัวเรือน':'${ec}'})">＋ เพิ่ม</button>`}</div></div>
      ${rs.map(r => `<div class="hh-rec">${rs.length > 1 || key === '07' ? `<div class="row" style="justify-content:space-between"><b>${esc(r.row_key)}</b></div>` : ''}${hhKv(T, r, code)}${key === '01' ? '' : `<div style="margin-top:6px"><button class="small secondary" onclick="hhEdit('${key}','${r.id}')">แก้</button></div>`}</div>`).join('') || '<div class="muted">ยังไม่มีข้อมูล</div>'}</div>`; };
  let body = '';
  if (tab === 'sum') {
    const k = (l, v, u) => `<div class="kpi"><div class="l">${l}</div><div class="v" style="font-size:22px">${hhBlank(v) ? '–' : esc(hhFmtVal(v, l))}${u && !hhBlank(v) ? ` <span class="muted" style="font-size:14px">${u}</span>` : ''}</div></div>`;
    const svN = Array.isArray(S._sv) ? S._sv.filter(r => r.hh_code === code).length : null;
    const la = hhNumv(rv('lat')), lo = hhNumv(rv('lng'));
    body = `<div class="kpis" style="margin-bottom:10px">${k('รายได้รวม/เดือน', rv('income'), 'บาท')}${k('ค่าอาหารสัตว์/เดือน', rv('feed_cost'), 'บาท')}${k('ค่าปุ๋ย/เดือน', rv('fert_cost'), 'บาท')}${k('สมาชิก', rv('members'), 'คน')}${svN != null ? k('รับหนอนแล้ว', svN, 'รอบ') : ''}</div>
      ${typeof hhInnovMini === 'function' ? hhInnovMini(code) : ''}${typeof hhLedgerMini === 'function' ? hhLedgerMini(code) : ''}
      ${!isNaN(la) && !isNaN(lo) ? `<details class="card" ontoggle="if(this.open&&!this._m){this._m=1;hhDetailMap('${ec}')}"><summary style="cursor:pointer;font-weight:600">แผนที่และเส้นทางถึงศูนย์</summary><div id="hhMini" class="hh-mini" style="margin-top:8px"></div><div class="muted" id="hhMiniNote"></div></details>` : ''}`;
  } else if (tab === 'inv') body = (typeof hhInnovMini === 'function' ? hhInnovMini(code) : '') + rowsOf('06') + rowsOf('07');
  else if (tab === 'ledger') body = typeof hhLedgerMini === 'function' ? hhLedgerMini(code) : '';
  else if (tab === 'photo') body = typeof hhPhotoSection === 'function' ? hhPhotoSection(code) : '';
  else if (tab === 'svc') { const rs = Array.isArray(S._sv) ? S._sv.filter(r => r.hh_code === code) : [];
    body = `<div class="card"><div class="cardhead"><h4>การรับหนอน (${rs.length} รอบ)</h4>${hhCanAdmin() ? `<a class="btn small" style="text-decoration:none" href="#hh/service/${encodeURIComponent(code)}">＋ บันทึกรอบใหม่</a>` : ''}</div>${rs.length ? `<div class="tscroll"><table><thead><tr><th>รอบ</th><th>วันที่</th><th class="num">หนอน+มูล</th><th class="num">หนอน</th><th class="num">หมัก</th><th>ใช้รอบก่อน</th></tr></thead><tbody>${rs.map((r, i) => `<tr><td>${i + 1}</td><td><a href="#hh/service/${encodeURIComponent(code)}/${r.id}">${esc(String(r.service_date).slice(0, 10))}</a></td><td class="num">${r.total_kg ?? '–'}</td><td class="num">${r.larvae_kg ?? '–'}${r.larvae_est ? '*' : ''}</td><td class="num">${r.compost_kg ?? '–'}</td><td>${esc(((typeof SV !== 'undefined' ? SV.outcome : []).find(x => x[0] === r.outcome) || [, ''])[1])}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">ยังไม่มีการบันทึก</div>'}</div>`; }
  else body = rowsOf(tab);
  view.innerHTML = hhShell('detail', head + body);
}
function hhDetailMap(code) { const H = S._hh, reg = H.reg.find(r => r.hh_code === code); const la = hhNumv(H.roleVal(reg, '01', 'lat')), lo = hhNumv(H.roleVal(reg, '01', 'lng')); if (typeof hhMiniMap === 'function') hhMiniMap(reg, { lat: la, lng: lo }); }
// ช่วยกรอก: คำแนะนำจากค่าที่เคยกรอกในคอลัมน์ · ค่าหลายค่าคั่นจุลภาค (เช่น ชนิดสัตว์) กดเลือกเป็นชิป
function hhHints(T, header) {
  const vals = T.rows.map(r => (r.data || {})[header]).filter(v => !hhBlank(v)).map(v => String(v).trim());
  const multi = vals.some(v => /,\s*/.test(v)) && vals.length >= 3;
  const toks = [...new Set((multi ? vals.flatMap(v => v.split(/\s*,\s*/)) : vals).map(s => s.trim()).filter(s => s && s.length <= 40))];
  const numeric = vals.length > 0 && vals.every(v => /^-?[\d,]+(\.\d+)?$/.test(v));
  return { multi, toks: toks.length <= 40 ? toks.sort((a, b) => a.localeCompare(b, 'th')) : [], numeric };
}
function hhTok(fid, tok) {
  const el = $('#' + fid); if (!el) return; const a = el.value.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean), i = a.indexOf(tok);
  if (i >= 0) a.splice(i, 1); else a.push(tok); el.value = a.join(', ');
  el.parentElement.querySelectorAll('.lg-chip').forEach(b => b.classList.toggle('on', a.includes(b.dataset.t)));
}
