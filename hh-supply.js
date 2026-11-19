/* =====================================================================
   UBRU AppTech System — hh-supply.js  รายงานการรับหนอนและอาหารหมัก (DEC-140)
   สรุปจาก hh.service (1 แถว = ครัวเรือนมารับ 1 ครั้ง): รายเดือน · รายครัวเรือน · การใช้ประโยชน์ (ข้อ 1–2 ของแบบฟอร์ม)
   หนอนรวม = ค่าที่ชั่งแยก + ค่าประมาณจากน้ำหนักรวม (แยกแสดงยอดประมาณ) · ช่องว่าง = ไม่ได้ชั่ง ไม่นับเป็น 0 ในจำนวนรอบที่ชั่ง
   ===================================================================== */
const supR = n => Math.round(n * 100) / 100;
const supMonthOf = r => String(r.service_date).slice(0, 7);
// รวมยอดในช่วงเดือน from–to (YYYY-MM · ว่าง = ไม่จำกัด) · แถวต้องเป็นสถานะใช้งาน
function supAgg(rows, from, to) {
  const rs = (rows || []).filter(r => r.status !== 'inactive' && (!from || supMonthOf(r) >= from) && (!to || supMonthOf(r) <= to));
  const blank = () => ({ n: 0, hhSet: new Set(), total: 0, larvae: 0, larvaeEst: 0, compost: 0, nTotal: 0, nLarvae: 0, nCompost: 0, last: null });
  const add = (a, r) => { a.n++; a.hhSet.add(r.hh_code); const t = r.total_kg, l = r.larvae_kg, c = r.compost_kg;
    if (t != null) { a.total += +t; a.nTotal++; } if (l != null) { a.larvae += +l; a.nLarvae++; if (r.larvae_est) a.larvaeEst += +l; } if (c != null) { a.compost += +c; a.nCompost++; }
    const d = String(r.service_date).slice(0, 10); if (!a.last || d > a.last) a.last = d; };
  const fin = a => { const { hhSet, ...x } = a; return { ...x, hh: hhSet.size, total: supR(a.total), larvae: supR(a.larvae), larvaeEst: supR(a.larvaeEst), compost: supR(a.compost) }; };
  const tot = blank(), M = {}, HH = {};
  const use = { forms: 0, outcome: {}, feedKg: 0, animals: {}, frass: {}, want: { yes: 0, no: 0 } }, aniSeen = new Set();
  for (const r of rs) {
    add(tot, r); add(M[supMonthOf(r)] = M[supMonthOf(r)] || blank(), r); add(HH[r.hh_code] = HH[r.hh_code] || blank(), r);
    if (r.outcome) { use.forms++; use.outcome[r.outcome] = (use.outcome[r.outcome] || 0) + 1; if (r.feed_kg != null) use.feedKg += +r.feed_kg; }
    for (const x of Array.isArray(r.animals) ? r.animals : []) { const nm = x.a === 'อื่น ๆ' && String(x.name || '').trim() ? `อื่น ๆ (${String(x.name).trim()})` : x.a, k = nm + '|' + r.hh_code; if (x.a && !aniSeen.has(k)) { aniSeen.add(k); use.animals[nm] = (use.animals[nm] || 0) + 1; } }
    for (const x of Array.isArray(r.frass_use) ? r.frass_use : []) use.frass[x] = (use.frass[x] || 0) + 1;
    if (r.want_more === true) use.want.yes++; else if (r.want_more === false) use.want.no++;
  }
  use.feedKg = supR(use.feedKg);
  return { rows: rs, tot: fin(tot), months: Object.keys(M).sort().map(m => ({ m, ...fin(M[m]) })), byHH: Object.keys(HH).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).map(code => ({ code, ...fin(HH[code]) })), use };
}

async function hhSupplyPage(view) {
  const H = S._hh; if (typeof svLoad === 'function') await svLoad();
  if (!Array.isArray(S._sv)) return view.innerHTML = hhShell('supply', '<div class="card"><div class="banner warn">ฐานข้อมูลยังไม่มีส่วนการเข้ารับบริการ (sql/024)</div></div>');
  const st = S._sup = S._sup || { from: '', to: '', all: false }, A = supAgg(S._sv, st.from, st.to), t = A.tot;
  const nm = c => { const r = H.reg.find(x => x.hh_code === c); return r ? H.roleVal(r, '01', 'name') || '' : ''; }, tb = c => { const r = H.reg.find(x => x.hh_code === c); return r ? H.roleVal(r, '01', 'tambon') || '' : ''; };
  const grpC = r => String(H.roleVal(r, '01', 'group') ?? '').trim() === 'C';
  const never = H.reg.filter(r => !grpC(r) && !A.byHH.some(x => x.code === r.hh_code));
  const ml = m => (typeof lgMonthLabel === 'function' ? lgMonthLabel(m) : m), kg = (v, n) => (n ? fmt(v, 2) : '–');
  const today = todayISO(), ago = d => Math.round((new Date(today) - new Date(d)) / 864e5);
  const rng = (st.from || st.to) ? `${st.from ? ml(st.from) : 'เริ่มต้น'} – ${st.to ? ml(st.to) : 'ปัจจุบัน'}` : 'ทั้งหมด';
  const chip = (on, l, js) => `<button type="button" class="lg-chip ${on ? 'on' : ''}" onclick="${js}">${esc(l)}</button>`, cm = today.slice(0, 7), m3 = typeof lgShift === 'function' ? lgShift(cm, -2) : cm;
  const filt = `<div class="card"><div class="cardhead"><h4>รายงานการรับหนอนและอาหารหมัก ${qBtn('ที่มาของตัวเลข', '<p>นับจากบันทึกในหน้า "รับหนอน/อาหารหมัก" (1 แถว = ครัวเรือนมารับ 1 ครั้ง) เฉพาะรายการที่ยังไม่ยกเลิก</p><p><b>หนอน</b> รวมทั้งค่าที่ชั่งแยกและค่าที่ประมาณจากน้ำหนักหนอน+มูล แสดงยอดประมาณแยกไว้ · ช่องที่ไม่ได้ชั่งไม่นับเป็น 0</p><p><b>การใช้ประโยชน์</b> มาจากข้อ 1–2 ของแบบฟอร์ม ซึ่งถามถึงหนอนรอบก่อน จึงนับเฉพาะแบบฟอร์มที่ตอบข้อ 1</p>')}</h4><a class="small" href="#hh/service">＋ บันทึกการรับ</a></div>
    <div class="lg-chips">${chip(!st.from && !st.to, 'ทั้งหมด', "S._sup.from='';S._sup.to='';render()")}${chip(st.from === m3 && st.to === cm, '3 เดือนล่าสุด', `S._sup.from='${m3}';S._sup.to='${cm}';render()`)}${chip(st.from === cm && st.to === cm, 'เดือนนี้', `S._sup.from='${cm}';S._sup.to='${cm}';render()`)}
      <label class="lg-chip">ตั้งแต่ <input type="month" aria-label="ตั้งแต่เดือน" value="${st.from}" max="${cm}" style="width:auto;min-height:32px;padding:2px 6px" onchange="S._sup.from=this.value;render()"></label><label class="lg-chip">ถึง <input type="month" aria-label="ถึงเดือน" value="${st.to}" max="${cm}" style="width:auto;min-height:32px;padding:2px 6px" onchange="S._sup.to=this.value;render()"></label></div>
    <div class="muted" style="margin-top:4px">ช่วง: ${esc(rng)}</div></div>`;
  const kpi = (l, v, sub) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${sub ? `<div class="muted" style="font-size:12px">${sub}</div>` : ''}</div>`;
  const kpis = `<div class="kpis">${kpi('รอบที่มารับ', fmtInt(t.n))}${kpi('ครัวเรือนที่มารับ', fmtInt(t.hh), `จาก ${fmtInt(H.reg.filter(r => !grpC(r)).length)} ครัวเรือน (ไม่รวมกลุ่ม C)`)}${kpi('หนอน+มูล (กก.)', kg(t.total, t.nTotal), `ชั่ง ${fmtInt(t.nTotal)} รอบ`)}${kpi('หนอน (กก.)', kg(t.larvae, t.nLarvae), t.larvaeEst ? `รวมค่าประมาณ ${fmt(t.larvaeEst, 2)} กก.` : `ชั่งแยก ${fmtInt(t.nLarvae)} รอบ`)}${kpi('อาหารหมัก (กก.)', kg(t.compost, t.nCompost), `รับ ${fmtInt(t.nCompost)} รอบ`)}${kpi('อาหารหมักเฉลี่ย/รอบ (กก.)', t.nCompost ? fmt(t.compost / t.nCompost, 1) : '–')}</div>`;
  if (!t.n) return view.innerHTML = hhShell('supply', filt + `<div class="card muted">ยังไม่มีบันทึกการรับในช่วงนี้ · เริ่มบันทึกที่ <a href="#hh/service">รับหนอน/อาหารหมัก</a></div>`);
  const mon = `<div class="card"><div class="cardhead"><h4>รายเดือน</h4></div><div class="chartbox"><canvas id="supC"></canvas></div><div class="tscroll" style="margin-top:8px"><table><thead><tr><th>เดือน</th><th class="num">รอบ</th><th class="num">ครัวเรือน</th><th class="num">หนอน+มูล</th><th class="num">หนอน</th><th class="num">อาหารหมัก</th></tr></thead><tbody>${A.months.map(m => `<tr><td>${esc(ml(m.m))}</td><td class="num">${fmtInt(m.n)}</td><td class="num">${fmtInt(m.hh)}</td><td class="num">${kg(m.total, m.nTotal)}</td><td class="num">${kg(m.larvae, m.nLarvae)}${m.larvaeEst ? '*' : ''}</td><td class="num">${kg(m.compost, m.nCompost)}</td></tr>`).join('')}<tr style="font-weight:600"><td>รวม</td><td class="num">${fmtInt(t.n)}</td><td class="num">${fmtInt(t.hh)}</td><td class="num">${kg(t.total, t.nTotal)}</td><td class="num">${kg(t.larvae, t.nLarvae)}${t.larvaeEst ? '*' : ''}</td><td class="num">${kg(t.compost, t.nCompost)}</td></tr></tbody></table></div><div class="muted">หน่วย กก. · * มีค่าประมาณรวมอยู่ · ครัวเรือนในแถวรวม = จำนวนไม่ซ้ำ</div></div>`;
  const hh = `<div class="card"><div class="cardhead"><h4>รายครัวเรือน (${fmtInt(A.byHH.length)})</h4><button class="small secondary" onclick="supCsv()">ส่งออก CSV รายรอบ</button></div><div class="tscroll"><table><thead><tr><th>ครัวเรือน</th><th>ตำบล</th><th class="num">รอบ</th><th>รับล่าสุด</th><th class="num">หนอน+มูล</th><th class="num">หนอน</th><th class="num">อาหารหมัก</th></tr></thead><tbody>${A.byHH.map(x => `<tr onclick="go('#hh/h/${encodeURIComponent(x.code)}/svc')" style="cursor:pointer"><td><b>${esc(x.code)}</b> <span class="muted">${esc(nm(x.code))}</span></td><td>${esc(tb(x.code))}</td><td class="num">${fmtInt(x.n)}</td><td>${svD(x.last)} <span class="muted">(${ago(x.last) ? fmtInt(ago(x.last)) + ' วันก่อน' : 'วันนี้'})</span></td><td class="num">${kg(x.total, x.nTotal)}</td><td class="num">${kg(x.larvae, x.nLarvae)}${x.larvaeEst ? '*' : ''}</td><td class="num">${kg(x.compost, x.nCompost)}</td></tr>`).join('')}</tbody></table></div>
    <details style="margin-top:8px"><summary style="cursor:pointer">ยังไม่มีบันทึกการรับในช่วงนี้ ${fmtInt(never.length)} ครัวเรือน <span class="muted">(ไม่รวมกลุ่ม C)</span></summary><div class="lg-chips" style="margin-top:6px">${never.map(r => `<a class="lg-chip" href="#hh/service/${encodeURIComponent(r.hh_code)}">${esc(r.hh_code)} · ${esc(H.roleVal(r, '01', 'name') || '')}</a>`).join('') || '<span class="muted">ครบทุกครัวเรือน</span>'}</div></details></div>`;
  const u = A.use, OL = Object.fromEntries((typeof SV !== 'undefined' ? SV.outcome : [])), row = (l, v, n) => `<tr><td>${l}</td><td class="num"><b>${v}</b></td><td class="muted">${n || ''}</td></tr>`;
  const usage = `<div class="card"><div class="cardhead"><h4>การใช้ประโยชน์หนอนและมูล (ข้อ 1–2 ของแบบฟอร์ม)</h4></div>${u.forms ? `<table><tbody>${row('แบบฟอร์มที่ตอบข้อ 1', fmtInt(u.forms) + ' ฉบับ')}${Object.entries(u.outcome).map(([k, v]) => row('หนอนรอบก่อน: ' + esc(OL[k] || k), fmtInt(v) + ' ฉบับ', fmtInt(Math.round(v / u.forms * 100)) + '%')).join('')}${row('ให้เป็นอาหารสัตว์รวม', fmt(u.feedKg, 2) + ' กก.', 'ค่าประมาณจากครัวเรือน')}${Object.entries(u.animals).sort((a, b) => b[1] - a[1]).map(([k, v]) => row('สัตว์ที่ได้กินหนอน: ' + esc(k), fmtInt(v) + ' ครัวเรือน')).join('')}${Object.entries(u.frass).sort((a, b) => b[1] - a[1]).map(([k, v]) => row('ใช้มูล: ' + esc(k), fmtInt(v) + ' ฉบับ')).join('')}${u.want.yes + u.want.no ? row('ต้องการรับเพิ่มรอบการเลี้ยง', `${fmtInt(u.want.yes)} / ${fmtInt(u.want.yes + u.want.no)}`, 'ต้องการ / ที่ตอบ') : ''}</tbody></table>` : '<div class="muted">ยังไม่มีแบบฟอร์มที่ตอบข้อ 1 ในช่วงนี้</div>'}</div>`;
  view.innerHTML = hhShell('supply', filt + kpis + `<div style="margin-top:12px"></div>` + mon + hh + usage);
  if ($('#supC')) mkChart($('#supC'), { type: 'bar', data: { labels: A.months.map(m => ml(m.m)), datasets: [{ label: 'หนอน+มูล', data: A.months.map(m => m.total), backgroundColor: PALETTE[3] }, { label: 'หนอน', data: A.months.map(m => m.larvae), backgroundColor: PALETTE[1] }, { label: 'อาหารหมัก', data: A.months.map(m => m.compost), backgroundColor: PALETTE[0] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'กก.' } } } } });
}
function supCsv() {
  const st = S._sup || {}, A = supAgg(S._sv, st.from, st.to), no = typeof svRoundNos === 'function' ? svRoundNos(S._sv) : {}, OL = Object.fromEntries((typeof SV !== 'undefined' ? SV.outcome : []));
  exportCsv(A.rows.map(r => ({ 'วันที่รับ': String(r.service_date).slice(0, 10), 'รหัสครัวเรือน': r.hh_code, 'รอบที่': no[r.id] || '', 'หนอน+มูล (กก.)': r.total_kg ?? '', 'หนอน (กก.)': r.larvae_kg ?? '', 'หนอนเป็นค่าประมาณ': r.larvae_est ? 'ใช่' : '', 'อาหารหมัก (กก.)': r.compost_kg ?? '', 'ผู้กรอก': (typeof SV_BY !== 'undefined' && SV_BY[r.filled_by]) || '', 'หนอนรอบก่อน': OL[r.outcome] || '', 'ให้อาหารสัตว์ (กก.)': r.feed_kg ?? '', 'กรอกเฉพาะน้ำหนัก': r.is_backfill ? 'ใช่' : '' })), 'รับหนอน-อาหารหมัก');
}
// สรุปสั้นสำหรับหน้าภาพรวม
function hhSupplyMini() {
  if (!Array.isArray(S._sv)) return '';
  const A = supAgg(S._sv, '', ''), t = A.tot, cm = todayISO().slice(0, 7), m = A.months.find(x => x.m === cm);
  const kv = (l, v, n) => `<tr><td>${l}</td><td class="num"><b>${v}</b></td><td class="muted">${n || ''}</td></tr>`;
  return `<div class="card"><div class="cardhead"><h4>6. การรับหนอนและอาหารหมัก</h4><a class="small" href="#hh/supply">รายงาน ›</a></div><table><tbody>${kv('รอบที่มารับทั้งหมด', fmtInt(t.n), `${fmtInt(t.hh)} ครัวเรือน`)}${kv('หนอน+มูลรวม (กก.)', fmt(t.total, 1))}${kv('หนอนรวม (กก.)', fmt(t.larvae, 1), t.larvaeEst ? `รวมค่าประมาณ ${fmt(t.larvaeEst, 1)}` : '')}${kv('อาหารหมักรวม (กก.)', fmt(t.compost, 1))}${kv('เดือนนี้', m ? `${fmtInt(m.n)} รอบ` : '0 รอบ', m ? `อาหารหมัก ${fmt(m.compost, 1)} กก.` : '')}</tbody></table></div>`;
}
