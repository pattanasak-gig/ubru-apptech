/* =====================================================================
   UBRU AppTech System — hh-service.js  การเข้ารับบริการจากศูนย์ (DEC-129 · ตรงแบบฟอร์มกรอกด้วยมือ DEC-140)
   บันทึกทีละครัวเรือนบนมือถือ: รับหนอน/มูล/เศษอาหารหมัก + ผลการใช้หนอนรอบก่อน + ต้นทุน/รายได้เดือนที่แล้ว
   เงินลงบัญชีรายรับรายจ่าย hh.ledger_* (ไม่เก็บซ้ำ) · ตาราง hh.service (sql/024) · ใช้งานโดยเจ้าของโครงการและ admin
   ตัวเลือกอยู่ใน SV ที่เดียว · ช่วงวันของระยะ (SV.stage) เป็นค่าตั้งต้นรอยืนยันจากศูนย์
   ===================================================================== */
const SV = {
  outcome: [['feed_all', 'ให้สัตว์ทั้งหมด'], ['feed_part', 'ให้บางส่วน เลี้ยงต่อบางส่วน'], ['keep_all', 'เลี้ยงต่อทั้งหมด'], ['dead_all', 'ตายทั้งหมด']],
  feeds: ['เศษอาหารครัวเรือน', 'ผัก', 'ผลไม้', 'รำ', 'อาหารสำเร็จรูป', 'เนื้อสัตว์', 'อื่น ๆ'],
  animals: [['เป็ดเนื้อ', 'เป็ด (ตัว)'], ['เป็ดไข่', 'เป็ด (ตัว)'], ['ไก่ไข่', 'ไก่ไข่ (ตัว)'], ['ไก่พื้นบ้าน', 'ไก่เนื้อ/พื้นเมือง (ตัว)'], ['ไก่ชน', 'ไก่เนื้อ/พื้นเมือง (ตัว)'], ['ปลานิล', 'ปลา (ตัว)'], ['ปลาดุก', 'ปลา (ตัว)'], ['ปลาช่อน', 'ปลา (ตัว)'], ['กบ', 'กบ (ตัว)'], ['อื่น ๆ', 'สัตว์อื่น (ระบุ)']],
  alive: ['ยังอยู่ครบ', 'ตายบางส่วน', 'แบ่งเป็นอาหารสัตว์บางส่วน'],
  loss: ['ตายระหว่างเลี้ยง', 'ตายหลังผสมพันธุ์', 'หลุดออกธรรมชาติ'],
  stage: [['ยังเป็นหนอน', 0], ['กำลังเข้าระยะดักแด้', 10], ['ดักแด้', 15], ['พ่อแม่พันธุ์', 25], ['เริ่มวางไข่', 30], ['ระยะอนุบาล', 35]],
  frass: ['แปลงผัก', 'นาข้าว', 'ไม้ผล', 'ไม้ยืนต้น', 'ขาย', 'ไม่ได้ใช้']
};
const SV_L = { feed: 'อาหารสัตว์สำเร็จรูป', fert: 'ปุ๋ยเคมี', egg: 'ขายไข่หนอน BSF', lc: 'ขายหนอน BSF (ให้ศูนย์ฯ)', lo: 'ขายหนอน BSF (ให้รายอื่น)', fr: 'ขายมูลหนอน BSF', an: 'ขายผลผลิตสัตว์ (ไข่/เนื้อ รวม)', pl: 'ขายผลผลิตพืช (ผัก/ผลไม้/พืชยืนต้น รวม)' };
const svStage = days => { let s = SV.stage[0][0]; for (const [l, d] of SV.stage) if (days >= d) s = l; return s; };
const svDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const svKgOf = r => (r ? (r.larvae_kg ?? r.total_kg) : null);
const SV_BY = { staff: 'เจ้าหน้าที่', household: 'ครัวเรือน' };   // DEC-140 ผู้กรอกแบบฟอร์ม
const SV_OTHER = 'อื่น ๆ:';   // อาหารที่ให้หนอน "อื่น ๆ ____" เก็บเป็นรายการขึ้นต้นด้วยคำนี้ใน larva_feeds
// ลำดับรอบของแต่ละครัวเรือนตามวันที่รับ (รอบที่ 1, 2, …) · แถวต้องเรียงตามวันที่แล้ว
function svRoundNos(rows) { const c = {}, o = {}; for (const r of rows) { c[r.hh_code] = (c[r.hh_code] || 0) + 1; o[r.id] = c[r.hh_code]; } return o; }
const svNum = v => { const t = String(v ?? '').replace(/,/g, '').trim(); if (t === '') return null; const n = +t; return isNaN(n) || n < 0 ? null : n; };
const svR2 = n => Math.round(n * 100) / 100;
const svD = d => thDate(d).replace(/\s*\d\d:\d\d$/, '');

async function svLoad() {
  const H = S._hh;
  try { S._sv = await api.list('hh.service', { eq: { project_id: H.link.project_id, status: 'active' }, order: ['service_date'] }); } catch (e) { console.warn('hh.service (sql/024) missing:', e && e.message); S._sv = null; }
  if (S._svShare === undefined) { S._svShare = null; try { const p = Object.fromEntries((await api.list('bsf.param', {})).map(x => [x.key, +x.value])); if (p.larvae_per_feed_high && p.frass_per_feed_high) S._svShare = p.larvae_per_feed_high / (p.larvae_per_feed_high + p.frass_per_feed_high); } catch (e) { /* ไม่มีค่า = ไม่แสดงปุ่มประมาณ */ } }
  if (S._svBatches === undefined) { try { S._svBatches = await api.list('bsf.batch', { eq: { status: 'active' }, order: ['code', false], limit: 30 }); } catch (e) { S._svBatches = []; } }
}
function svSearch(q) {
  const H = S._hh, t = String(q || '').trim().toLowerCase(), el = $('#svHits'); if (!el) return; if (!t) return el.innerHTML = '';
  el.innerHTML = H.reg.filter(r => [r.hh_code, H.roleVal(r, '01', 'name'), H.roleVal(r, '01', 'tambon')].some(v => String(v ?? '').toLowerCase().includes(t))).slice(0, 8).map(r => `<a class="lg-hit" href="#hh/service/${encodeURIComponent(r.hh_code)}"><b>${esc(r.hh_code)}</b> ${esc(H.roleVal(r, '01', 'name') || '')} <span class="muted">ต.${esc(H.roleVal(r, '01', 'tambon') || '-')}</span></a>`).join('') || '<div class="muted">ไม่พบครัวเรือน</div>';
}
async function hhServicePage(view, code, id) {
  const H = S._hh;
  if (!hhCanAdmin()) return view.innerHTML = hhShell('service', '<div class="card">เฉพาะเจ้าของโครงการและ admin</div>');
  await svLoad();
  if (!S._sv) return view.innerHTML = hhShell('service', '<div class="card"><div class="banner warn">ฐานข้อมูลยังไม่มีส่วนการเข้ารับบริการ (sql/024)</div></div>');
  code = code ? decodeURIComponent(code) : ''; const reg = code ? H.reg.find(r => r.hh_code === code) : null;
  const recent = [...new Set(S._sv.slice().reverse().map(r => r.hh_code))].slice(0, 6), nm = c => { const r = H.reg.find(x => x.hh_code === c); return r ? H.roleVal(r, '01', 'name') || '' : ''; };
  const pick = `<select aria-label="เลือกครัวเรือนจากรายชื่อ" style="margin-top:6px" onchange="if(this.value)go('#hh/service/'+encodeURIComponent(this.value))"><option value="">— หรือเลือกจากรายชื่อ (${fmtInt(H.reg.length)} ครัวเรือน) —</option>${H.reg.slice().sort((a, b) => String(a.hh_code).localeCompare(String(b.hh_code), 'th', { numeric: true })).map(r => `<option value="${esc(r.hh_code)}" ${r.hh_code === code ? 'selected' : ''}>${esc(r.hh_code)} · ${esc(H.roleVal(r, '01', 'name') || '')}</option>`).join('')}</select>`;
  const search = `<div class="card"><h4 style="margin:0 0 6px">${reg ? 'เปลี่ยนครัวเรือน' : 'ขั้นที่ 1 · เลือกครัวเรือนตามรหัสในแบบฟอร์ม'}</h4><input type="search" id="svQ" aria-label="ค้นหาครัวเรือน" placeholder="พิมพ์ รหัส (เช่น 012) · ชื่อ · ตำบล" autocomplete="off" oninput="svSearch(this.value)"><div id="svHits" class="lg-hits"></div>${pick}${recent.length ? `<div class="lg-chips lg-recent" style="margin-top:6px">${recent.map(c => `<a class="lg-chip" href="#hh/service/${encodeURIComponent(c)}">${esc(c)} · ${esc(nm(c))}</a>`).join('')}</div>` : ''}</div>`;
  if (!reg) { const last = S._sv.slice().reverse().slice(0, 15), no = svRoundNos(S._sv), m = typeof supAgg === 'function' ? supAgg(S._sv, todayISO().slice(0, 7), todayISO().slice(0, 7)).tot : null;
    const intro = `<div class="card"><h4 style="margin:0 0 4px">บันทึกการรับหนอนและอาหารหมัก</h4><div class="muted">1 แบบฟอร์ม = 1 ครัวเรือน 1 ครั้งที่มารับ · บันทึกรอบวันนี้ หรือกรอกแบบฟอร์มย้อนหลังตามวันที่ในแบบฟอร์มได้</div><ol style="margin:6px 0 0 18px;padding:0"><li>เลือกครัวเรือน (ด้านล่าง)</li><li>ใส่ <b>วันที่รับ</b> และ <b>ผู้กรอก</b> ตามหัวแบบฟอร์ม</li><li>กรอกข้อ 1–5 ตามแบบฟอร์ม แล้วกด <b>บันทึก</b> ที่แถบล่าง</li></ol>${m ? `<div class="kpis" style="margin-top:10px"><div class="kpi"><div class="l">เดือนนี้: รอบที่รับ</div><div class="v">${fmtInt(m.n)}</div></div><div class="kpi"><div class="l">ครัวเรือนที่มารับ</div><div class="v">${fmtInt(m.hh)}</div></div><div class="kpi"><div class="l">หนอน+มูล (กก.)</div><div class="v">${fmt(m.total, 1)}</div></div><div class="kpi"><div class="l">อาหารหมัก (กก.)</div><div class="v">${fmt(m.compost, 1)}</div></div></div>` : ''}<div style="margin-top:6px"><a href="#hh/supply">ดูรายงานการรับหนอน/อาหารหมักทั้งหมด ›</a></div></div>`;
    return view.innerHTML = hhShell('service', intro + search + (last.length ? `<div class="card"><h4 style="margin:0 0 6px">บันทึกล่าสุด <span class="muted" style="font-weight:400">กดแถวเพื่อเปิดแก้</span></h4><div class="tscroll"><table><thead><tr><th>วันที่รับ</th><th>ครัวเรือน</th><th class="num">รอบที่</th><th class="num">หนอน+มูล</th><th class="num">หนอน</th><th class="num">อาหารหมัก</th><th>ผู้กรอก</th></tr></thead><tbody>${last.map(r => `<tr onclick="go('#hh/service/${esc(r.hh_code)}/${r.id}')" style="cursor:pointer"><td>${svD(r.service_date)}</td><td>${esc(r.hh_code)} <span class="muted">${esc(nm(r.hh_code))}</span></td><td class="num">${no[r.id] || ''}</td><td class="num">${r.total_kg ?? '–'}</td><td class="num">${r.larvae_kg ?? '–'}${r.larvae_est ? '*' : ''}</td><td class="num">${r.compost_kg ?? '–'}</td><td>${esc(SV_BY[r.filled_by] || '')}</td></tr>`).join('')}</tbody></table></div><div class="muted">* หนอนเป็นค่าประมาณจากน้ำหนักรวม · หน่วย กก.</div></div>` : '')); }
  const mine = S._sv.filter(r => r.hh_code === code), rec = id ? mine.find(r => r.id === id) : null;
  S._svf = { code, id: rec ? rec.id : null, date: rec ? String(rec.service_date).slice(0, 10) : todayISO(), backfill: rec ? rec.is_backfill : false, larvae_kg: rec?.larvae_kg ?? null, total_kg: rec?.total_kg ?? null, compost_kg: rec?.compost_kg ?? null, larvae_est: !!rec?.larvae_est, batch_id: rec?.batch_id || '', photo_file_id: rec?.photo_file_id || null, photo_url: rec?.photo_url || null,
    outcome: rec?.outcome || '', feed_kg: rec?.feed_kg ?? null, keep_kg: rec?.keep_kg ?? null, keep_days: rec?.keep_days ?? 0, larva_feeds: (rec?.larva_feeds || []).filter(x => !String(x).startsWith(SV_OTHER)), feeds_other: ((rec?.larva_feeds || []).find(x => String(x).startsWith(SV_OTHER)) || '').slice(SV_OTHER.length).trim(),
    animals: (rec?.animals || []).map(x => ({ ...x })), alive_status: rec?.alive_status || '', loss_reasons: rec?.loss_reasons || [], stage: rec?.stage || '', want_more: rec?.want_more ?? null, frass_use: rec?.frass_use || [], note: rec?.note || '', money: {},
    filled_by: rec?.filled_by || '', mmonth: rec?.money_month ? String(rec.money_month).slice(0, 7) : '' };
  svMoneyFill();
  view.innerHTML = hhShell('service', `${search}<div id="svBody"></div><div class="lg-bar" id="svBar"></div><div style="height:90px"></div>`);
  svDraw();
}
const svMonthDef = () => lgShift(S._svf.date.slice(0, 7), -1);   // ปกติ = เดือนก่อนวันที่รับ ("เดือนที่แล้ว" ในแบบฟอร์ม)
const svMonth = () => S._svf.mmonth || svMonthDef();
function svMMonth(v) { const f = S._svf; if (!v) return; f.mmonth = v === svMonthDef() ? '' : v; svMoneyFill(); svDraw(); }
const svItem = k => (S._hh.lg ? S._hh.lg.items.find(i => i.name === SV_L[k] && i.status !== 'inactive') : null);
function svLedgerRec() { const f = S._svf, L = S._hh.lg; return L ? L.months.find(m => m.hh_code === f.code && lgMonthKey(m.month) === svMonth()) || null : null; }
function svMoneyFill() { const f = S._svf, L = S._hh.lg, r = svLedgerRec(); f.money = {}; if (!L || !r) return; for (const k of Object.keys(SV_L)) { const it = svItem(k), l = it && (L.byMonth[r.id] || []).find(x => x.item_id === it.id); if (l && l.amount != null) f.money[k] = +l.amount; } }
function svPrev() { const f = S._svf; const a = S._sv.filter(r => r.hh_code === f.code && r.id !== f.id && String(r.service_date).slice(0, 10) <= f.date); return a[a.length - 1] || null; }
const svChip = (on, l, js) => `<button type="button" class="lg-chip ${on ? 'on' : ''}" onclick="${js}">${esc(l)}</button>`;
const svOne = (k, list) => `<div class="lg-chips">${list.map(x => { const v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return svChip(S._svf[k] === v, l, `svPick('${k}','${esc(v)}')`); }).join('')}</div>`;
const svMany = (k, list) => `<div class="lg-chips">${list.map(v => svChip((S._svf[k] || []).includes(v), v, `svTog('${k}','${esc(v)}')`)).join('')}</div>`;
function svPick(k, v) { const f = S._svf; f[k] = f[k] === v ? '' : v; if (k === 'outcome' && v === 'feed_part' && !f.alive_status) f.alive_status = 'แบ่งเป็นอาหารสัตว์บางส่วน'; svDraw(); }
function svTog(k, v) { const a = S._svf[k] = S._svf[k] || [], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); svDraw(); }
function svAnimal(a) { const L = S._svf.animals, i = L.findIndex(x => x.a === a); if (i >= 0) L.splice(i, 1); else L.push({ a, n: null, kg: null }); svDraw(); }
function svSet(k, v) { S._svf[k] = svNum(v); if (k === 'larvae_kg') S._svf.larvae_est = false; svBar(); }
function svStep(k, d) { const f = S._svf; f[k] = Math.max(0, svR2((+f[k] || 0) + d)); const e = $('#sv_' + k); if (e) e.value = f[k]; svBar(); }
const svKg = (k, l, hint) => `<label style="margin:8px 0 2px">${esc(l)}${hint ? ` <span class="muted">${esc(hint)}</span>` : ''}</label><div class="lg-ctl"><input id="sv_${k}" type="text" inputmode="decimal" placeholder="กก." value="${S._svf[k] ?? ''}" style="width:92px;min-height:44px;text-align:right" oninput="svSet('${k}',this.value)"><button type="button" class="lg-q" onclick="svStep('${k}',1)">+1</button><button type="button" class="lg-q" onclick="svStep('${k}',-1)">−1</button><button type="button" class="lg-q" onclick="svStep('${k}',0.1)">+0.1</button><button type="button" class="lg-q" onclick="svStep('${k}',-0.1)">−0.1</button></div>`;
const svFrac = (k, base) => (base ? `<div class="lg-chips" style="margin-top:4px">${[[.25, '¼'], [.5, '½'], [.75, '¾'], [1, 'ทั้งหมด']].map(([p, l]) => svChip(false, l, `svFracSet('${k}',${svR2(base * p)})`)).join('')}</div>` : '');
function svFracSet(k, v) { S._svf[k] = v; const e = $('#sv_' + k); if (e) e.value = v; svBar(); }
const svMoney = (k, l, hint) => { const m = S._svf.money; return svItem(k) ? `<label style="margin:8px 0 2px">${esc(l)}${hint ? ` <span class="muted">${esc(hint)}</span>` : ''}</label><div class="lg-ctl"><input id="svm_${k}" type="text" inputmode="decimal" placeholder="บาท" value="${m[k] ?? ''}" style="width:100px;min-height:44px;text-align:right" oninput="svMoneySet('${k}',this.value)">${[100, 500, 1000].map(s => `<button type="button" class="lg-q" onclick="svMoneyAdd('${k}',${s})">+${fmtInt(s)}</button>`).join('')}</div>` : ''; };
function svMoneySet(k, v) { const n = svNum(v); if (n == null) delete S._svf.money[k]; else S._svf.money[k] = n; svBar(); }
function svMoneyAdd(k, s) { const m = S._svf.money; m[k] = (+m[k] || 0) + s; const e = $('#svm_' + k); if (e) e.value = m[k]; svBar(); }
function svNoBuy(k) { S._svf.money[k] = 0; const e = $('#svm_' + k); if (e) e.value = 0; svBar(); }
function svDate(v) { const f = S._svf; if (!v) return; if (v > todayISO()) return toast('วันที่รับเป็นวันในอนาคตไม่ได้', true); f.date = v; svMoneyFill(); svDraw(); }
function svEst() { const f = S._svf; if (f.total_kg == null || !S._svShare) return toast('ใส่น้ำหนักหนอน+มูลก่อน', true); f.larvae_kg = svR2(f.total_kg * S._svShare); f.larvae_est = true; svDraw(); }
async function svPhoto(file) { if (!file) return; try { const up = await hhPhotoUp(file, S._svf.code); S._svf.photo_file_id = up.file_id; S._svf.photo_url = up.url; toast('แนบรูปแล้ว'); svDraw(); } catch (e) { fail(e, 'แนบรูปไม่สำเร็จ'); } }
function svDraw() {
  const H = S._hh, f = S._svf, el = $('#svBody'); if (!el) return;
  const reg = H.reg.find(r => r.hh_code === f.code), mine = S._sv.filter(r => r.hh_code === f.code), prev = svPrev(), days = prev ? svDays(prev.service_date, f.date) : null, pk = svKgOf(prev), d = reg.data || {};
  const need = [H.roleVal(reg, '01', 'larvae_need'), H.roleVal(reg, '01', 'manure_need')];
  const no = f.id ? mine.findIndex(r => r.id === f.id) + 1 : mine.filter(r => String(r.service_date).slice(0, 10) <= f.date).length + 1;
  const dup = mine.find(r => r.id !== f.id && String(r.service_date).slice(0, 10) === f.date);
  const head = `<div class="card"><div class="cardhead"><div><h4 style="margin:0">${esc(f.code)} · ${esc(H.roleVal(reg, '01', 'name') || '')}</h4><div class="muted">ต.${esc(H.roleVal(reg, '01', 'tambon') || '-')} · รับมาแล้ว <b>${fmtInt(mine.length)}</b> รอบ</div></div>${f.id ? `<a class="small" href="#hh/service/${encodeURIComponent(f.code)}">＋ รอบใหม่</a>` : ''}</div>
    ${mine.length ? `<div class="lg-chips lg-recent" style="margin-top:6px">${mine.map((r, i) => `<a class="lg-chip ${r.id === f.id ? 'on' : ''}" href="#hh/service/${encodeURIComponent(f.code)}/${r.id}">รอบ ${i + 1} · ${svD(r.service_date)}</a>`).join('')}</div>` : ''}
    <div style="margin-top:10px"><b>${f.id ? 'แก้' : 'บันทึก'}รอบที่ ${no}</b> <span class="muted">(ระบบนับจากวันที่รับ)</span></div>
    <label style="margin:8px 0 2px">วันที่รับ <span class="muted">ตามแบบฟอร์ม · ย้อนหลังได้</span></label><div class="lg-chips">${svChip(f.date === todayISO(), 'วันนี้', `svDate('${todayISO()}')`)}<label class="lg-chip">วันที่ <input type="date" aria-label="วันที่รับ" value="${f.date}" max="${todayISO()}" style="width:auto;min-height:32px;padding:2px 6px" onchange="svDate(this.value)"></label></div>
    ${dup ? `<div class="banner warn" style="margin-top:6px">ครัวเรือนนี้มีบันทึกวันที่ ${svD(dup.service_date)} แล้ว ถ้าเป็นแบบฟอร์มเดียวกัน <a href="#hh/service/${encodeURIComponent(f.code)}/${dup.id}">เปิดรอบนั้นแก้</a> แทนการบันทึกซ้ำ</div>` : ''}
    <label style="margin:8px 0 2px">ผู้กรอกแบบฟอร์ม</label><div class="lg-chips">${Object.entries(SV_BY).map(([k, l]) => svChip(f.filled_by === k, l, `svPick('filled_by','${k}')`)).join('')}</div>
    ${prev ? `<div style="margin-top:8px">รอบก่อน ${svD(prev.service_date)} (${days} วันก่อน) · หนอน+มูล <b>${prev.total_kg ?? '–'}</b> · หนอน <b>${prev.larvae_kg ?? '–'}${prev.larvae_est ? ' (ประมาณ)' : ''}</b> · อาหารหมัก <b>${prev.compost_kg ?? '–'}</b> กก.</div>` : `<div class="banner warn" style="margin-top:8px">ยังไม่มีรอบก่อนวันที่นี้ในระบบ · ถ้าครัวเรือนเคยมารับก่อนหน้านี้ ควรบันทึกแบบฟอร์มรอบเก่าก่อน (เปลี่ยนวันที่เป็นวันที่รับรอบนั้น) ลำดับรอบและข้อ 1 จะได้ถูกต้อง</div>`}
    <details style="margin-top:8px" ${f.backfill ? 'open' : ''}><summary class="muted" style="cursor:pointer">รอบเก่าที่ไม่มีแบบฟอร์ม (รู้แค่น้ำหนักที่รับ)?</summary><div class="lg-chips" style="margin-top:6px">${svChip(f.backfill, 'กรอกเฉพาะน้ำหนักที่รับ', 'S._svf.backfill=!S._svf.backfill;svDraw()')}</div><div class="muted" style="margin-top:4px">มีแบบฟอร์มย้อนหลังครบทุกข้อ ไม่ต้องกดปุ่มนี้ เปลี่ยนวันที่แล้วกรอกข้อ 1–5 ได้เลย</div></details></div>`;
  const feeding = ['feed_all', 'feed_part'].includes(f.outcome), keeping = ['feed_part', 'keep_all'].includes(f.outcome);
  if (keeping && !f.stage && days != null) f.stage = svStage(days);
  const use = f.backfill ? '' : `<div class="card lg-grp lg-inc"><h4 style="margin:0 0 6px">1 · หนอนรอบก่อนใช้ทำอะไร</h4>${prev ? '' : '<div class="muted" style="margin-bottom:4px">มารับครั้งแรก ข้ามข้อ 1–2 ได้</div>'}${svOne('outcome', SV.outcome)}
    ${feeding ? `${svKg('feed_kg', 'ให้เป็นอาหารสัตว์ (กก. โดยประมาณ)')}${svFrac('feed_kg', pk)}` : ''}${f.outcome === 'feed_part' ? `${svKg('keep_kg', 'เก็บไว้เลี้ยงต่อ (กก. โดยประมาณ)')}${svFrac('keep_kg', pk)}` : ''}
    ${feeding ? `<label style="margin:10px 0 2px">เลี้ยงต่อกี่วันก่อนให้สัตว์: <b id="svKd">${f.keep_days}</b> วัน</label><input type="range" min="0" max="30" value="${f.keep_days}" style="width:100%" oninput="S._svf.keep_days=+this.value;$('#svKd').textContent=this.value" onchange="svDraw()">
      ${f.keep_days > 1 ? `<label style="margin:8px 0 2px">อาหารที่ให้หนอน (เลือกได้หลายข้อ)</label>${svMany('larva_feeds', SV.feeds)}${f.larva_feeds.includes('อื่น ๆ') ? `<input aria-label="อาหารอื่น ๆ ระบุ" placeholder="อื่น ๆ ระบุ" value="${esc(f.feeds_other)}" style="margin-top:4px" oninput="S._svf.feeds_other=this.value">` : ''}` : ''}
      <label style="margin:10px 0 2px">สัตว์ที่ให้หนอน (เลือกได้หลายข้อ)</label><div class="lg-chips">${SV.animals.map(([a]) => svChip(f.animals.some(x => x.a === a), a, `svAnimal('${a}')`)).join('')}</div>
      ${f.animals.map((x, i) => { const h = (SV.animals.find(y => y[0] === x.a) || [])[1], s = d[h]; return `<div class="lg-ctl" style="margin-top:4px"><span style="min-width:84px">${esc(x.a)}</span><input type="text" inputmode="numeric" placeholder="${s ? 'ทะเบียน ' + esc(String(s)) : 'ตัว'}" value="${x.n ?? ''}" style="width:84px;min-height:40px;text-align:right" oninput="S._svf.animals[${i}].n=svNum(this.value)"><span class="muted">ตัว</span><input type="text" inputmode="decimal" placeholder="กก." value="${x.kg ?? ''}" style="width:72px;min-height:40px;text-align:right" oninput="S._svf.animals[${i}].kg=svNum(this.value)"><span class="muted">กก.</span>${x.a === 'อื่น ๆ' ? `<input aria-label="สัตว์อื่น ระบุ" placeholder="ระบุชนิด" value="${esc(x.name || '')}" style="width:110px;min-height:40px" oninput="S._svf.animals[${i}].name=this.value">` : ''}</div>`; }).join('')}` : ''}
    ${keeping ? `<label style="margin:10px 0 2px">สภาพหนอนที่เลี้ยงต่อ</label>${svOne('alive_status', SV.alive)}${f.alive_status === 'ตายบางส่วน' ? svMany('loss_reasons', SV.loss) : ''}
      <label style="margin:10px 0 2px">ระยะตอนนี้ ${days != null ? `<span class="muted">ระบบเลือกจาก ${days} วันหลังรับ แก้ได้</span>` : ''}</label>${svOne('stage', SV.stage.map(x => x[0]))}
      <label style="margin:10px 0 2px">ต้องการรับเพิ่มรอบการเลี้ยง</label><div class="lg-chips">${svChip(f.want_more === true, 'ต้องการ', 'S._svf.want_more=true;svDraw()')}${svChip(f.want_more === false, 'ไม่ต้องการ', 'S._svf.want_more=false;svDraw()')}</div>` : ''}</div>`;
  const frass = f.backfill ? '' : `<div class="card lg-grp lg-inc"><h4 style="margin:0 0 6px">2 · ใช้ประโยชน์จากมูล</h4>${svMany('frass_use', SV.frass)}${f.frass_use.includes('ขาย') ? svMoney('fr', 'ขายมูล เดือนที่แล้ว') : ''}</div>`;
  const sv = lgSurvey(f.code) || {}, ml = lgMonthLabel(svMonth());
  const cost = f.backfill ? '' : `<div class="card lg-grp lg-exp"><h4 style="margin:0 0 6px">3 · ต้นทุนเดือน ${ml}</h4><div class="lg-chips" style="margin-bottom:4px"><label class="lg-chip">เดือนตามแบบฟอร์ม <input type="month" aria-label="เดือนของต้นทุนและรายได้" value="${svMonth()}" max="${todayISO().slice(0, 7)}" style="width:auto;min-height:32px;padding:2px 6px" onchange="svMMonth(this.value)"></label></div><div class="muted">ปกติ = เดือนก่อนวันที่รับ · ใช้กับข้อ 2–4 · ยอดลงบันทึกรายรับรายจ่ายของเดือนนี้</div>
    ${svMoney('feed', 'ซื้ออาหารสัตว์', sv.e_feed != null ? 'เดิม ' + lgBaht(sv.e_feed) + ' บาท/เดือน' : '')}<div class="lg-chips" style="margin-top:4px">${svChip(false, 'ไม่ได้ซื้อแล้ว', "svNoBuy('feed')")}</div>
    ${svMoney('fert', 'ซื้อปุ๋ย', sv.e_fert != null ? 'เดิม ' + lgBaht(sv.e_fert) + ' บาท/เดือน' : '')}<div class="lg-chips" style="margin-top:4px">${svChip(false, 'ไม่ได้ซื้อแล้ว', "svNoBuy('fert')")}</div><div class="muted" style="margin-top:6px">เว้นว่าง = ไม่ได้ถาม ไม่นับเข้าต้นทุนลด</div></div>
    <div class="card lg-grp lg-inc"><h4 style="margin:0 0 6px">4 · รายได้เดือน ${ml}</h4>${svMoney('egg', 'ขายไข่หนอน')}${svMoney('lc', 'ขายหนอนให้ศูนย์ฯ')}${svMoney('lo', 'ขายหนอนให้รายอื่น')}${svMoney('an', 'ขายผลผลิตสัตว์ (ไข่/เนื้อ)', 'ยอดขายจริง')}${svMoney('pl', 'ขายผลผลิตพืช', 'ผัก/ผลไม้/พืชยืนต้น')}</div>`;
  const recv = `<div class="card lg-grp lg-qty"><h4 style="margin:0 0 6px">${f.backfill ? 'น้ำหนักที่รับในรอบนั้น' : '5 · รับรอบนี้'}</h4>${need[0] || need[1] ? `<div class="muted">ต้องการตามสำรวจ: หนอน ${esc(String(need[0] ?? '-'))} กก./เดือน · มูล ${esc(String(need[1] ?? '-'))} กก./รอบ</div>` : ''}
    ${svKg('total_kg', 'หนอน+มูลชั่งรวม (กก.)')}${svKg('larvae_kg', 'หนอน (กก.)', f.larvae_est ? 'ค่าประมาณ' : 'ถ้าชั่งแยก · ไม่ได้ชั่งเว้นว่าง หรือกดประมาณ')}
    ${S._svShare ? `<div class="lg-chips" style="margin-top:4px">${svChip(false, `ประมาณหนอน ${Math.round(S._svShare * 100)}% ของน้ำหนักรวม`, 'svEst()')}</div>` : ''}${svKg('compost_kg', 'อาหารหมักที่รับในรอบนี้ (กก.)')}
    ${(S._svBatches || []).length ? `<label style="margin:8px 0 2px">รุ่นที่แจก (ไม่บังคับ)</label><select onchange="S._svf.batch_id=this.value"><option value="">—</option>${S._svBatches.map(x => `<option value="${x.id}" ${x.id === f.batch_id ? 'selected' : ''}>${esc(x.code)}</option>`).join('')}</select>` : ''}
    <label style="margin:10px 0 2px">รูปการรับ <span class="muted">ควรมีรูปเป็นหลักฐาน แต่ไม่บังคับ</span></label>${f.photo_url ? `<div><a href="${esc(f.photo_url)}" target="_blank" rel="noopener">ดูรูปที่แนบ</a></div>` : ''}<input type="file" accept="image/*" capture="environment" onchange="svPhoto(this.files[0])">
    <label style="margin:8px 0 2px">หมายเหตุ (ไม่บังคับ)</label><input value="${esc(f.note)}" oninput="S._svf.note=this.value">
    ${f.id ? `<div style="margin-top:10px"><button class="small secondary" onclick="svDelete()">ยกเลิกรอบนี้</button></div>` : ''}</div>`;
  el.innerHTML = head + use + frass + cost + recv; svBar();
}
function svBar() {
  const el = $('#svBar'); if (!el) return; const f = S._svf, L = S._hh.lg; let line = '';
  if (L && !f.backfill) { const r = svLedgerRec(), ids = {}; for (const k of Object.keys(SV_L)) { const it = svItem(k); if (it) ids[it.id] = k; }
    const lines = (r ? L.byMonth[r.id] || [] : []).filter(l => !(ids[l.item_id] && f.money[ids[l.item_id]] != null)); for (const [id, k] of Object.entries(ids)) if (f.money[k] != null) lines.push({ item_id: id, amount: f.money[k] });
    const g = lgGain(lgSums(lines, L.itemById), lgBaseOf(f.code)); line = `<span>${lgMonthLabel(svMonth())}: รายได้เพิ่ม + ต้นทุนลด </span><b style="color:${lgStatus(g.total).c}">${lgBaht(g.total)} / ${lgBaht(LG_TARGET)}</b>`; }
  el.innerHTML = `<div class="lg-bar-in"><div class="lg-bar-row">${line ? `<div>${line}</div>` : '<span></span>'}<button onclick="svSave()">บันทึก</button></div></div>`;
}
async function svLedgerSave() {
  const H = S._hh, L = H.lg, f = S._svf; if (!L) return; const ks = Object.keys(f.money).filter(k => svItem(k)); if (!ks.length) return;
  const r = svLedgerRec(), mid = r ? r.id : (await api.insert('hh.ledger_month', { project_id: H.link.project_id, hh_code: f.code, month: svMonth() + '-01', channel: 'center', note: 'จากหน้ารับบริการ' })).id;
  for (const k of ks) { const it = svItem(k), o = (L.byMonth[mid] || []).find(x => x.item_id === it.id), rec = { amount: f.money[k], qty: null, price: null };
    if (o) await api.update('hh.ledger_line', o.id, rec); else await api.insert('hh.ledger_line', { month_id: mid, item_id: it.id, ...rec }); }
  H.lg = await lgLoad(H.link.project_id);
  if (typeof lgToMonthly === 'function') await lgToMonthly([f.code], [{ code: f.code, month: svMonth() }]);   // DEC-138 ต้นทุน/รายได้ที่กรอกในหน้ารับหนอน = รายละเอียด → รวมเป็นยอดของเดือนนั้น
}
async function svSave() {
  const H = S._hh, f = S._svf;
  if (f.date > todayISO()) return toast('วันที่รับเป็นวันในอนาคตไม่ได้', true);
  const rec = { service_date: f.date, larvae_kg: f.larvae_kg, total_kg: f.total_kg, compost_kg: f.compost_kg, larvae_est: f.larvae_est, batch_id: f.batch_id || null, is_backfill: !!f.backfill, photo_file_id: f.photo_file_id, photo_url: f.photo_url, note: f.note || null };
  const feeds = f.larva_feeds.slice(); if (feeds.includes('อื่น ๆ') && String(f.feeds_other || '').trim()) feeds.push(SV_OTHER + ' ' + String(f.feeds_other).trim());
  if (!f.backfill) Object.assign(rec, { outcome: f.outcome || null, feed_kg: f.feed_kg, keep_kg: f.keep_kg, keep_days: f.keep_days || null, larva_feeds: feeds, animals: f.animals, alive_status: f.alive_status || null, loss_reasons: f.loss_reasons, stage: f.stage || null, want_more: f.want_more, frass_use: f.frass_use });
  // DEC-140 (sql/029): ผู้กรอก + เดือนของเงิน · ถ้ายังไม่ได้รัน 029 บันทึกส่วนอื่นได้ก่อน
  const has029 = S._sv.some(r => 'filled_by' in r), extra = { filled_by: f.filled_by || null, money_month: f.backfill || !f.mmonth ? null : f.mmonth + '-01' };
  for (const [k, v] of Object.entries(extra)) if (has029 || v != null) rec[k] = v;
  if (rec.larvae_kg == null && rec.total_kg == null && rec.compost_kg == null && !rec.outcome && !Object.keys(f.money).length) return toast('ยังไม่มีข้อมูลให้บันทึก', true);
  const put = r => (f.id ? api.update('hh.service', f.id, r) : api.insert('hh.service', { project_id: H.link.project_id, hh_code: f.code, ...r }));
  let note = '';
  try {
    try { await put(rec); } catch (e) { if (has029 || !/filled_by|money_month/.test(String(e && e.message))) throw e; delete rec.filled_by; delete rec.money_month; await put(rec); note = ' (ยังไม่เก็บผู้กรอก/เดือน รอรัน sql/029)'; }
    if (!f.backfill) await svLedgerSave();
    toast(`บันทึก ${f.code} แล้ว${note}`); go('#hh/service');
  } catch (e) { fail(e, 'บันทึกไม่สำเร็จ'); }
}
async function svDelete() { if (!confirm('ยกเลิกรอบนี้?')) return; try { await api.update('hh.service', S._svf.id, { status: 'inactive' }); toast('ยกเลิกแล้ว'); go('#hh/service/' + encodeURIComponent(S._svf.code)); } catch (e) { fail(e); } }
