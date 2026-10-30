// =====================================================================
// เมนู "ครัวเรือน AppTech" (DEC-116 ข้อ 2B · DEC-117) — แท็บในโมดูลเดิม เห็นเฉพาะผู้มีสิทธิ์ (super/admin/ผู้บันทึกที่สังกัดโครงการของไฟล์)
//   ข้อมูลเป็นสำเนาของ Google Sheet "ข้อมูลครัวเรือน โครงการ BSF" (hh.row เก็บทุกคอลัมน์) · ชีตเป็นหลักในช่วงเปลี่ยนผ่าน
//   ซิงก์แบบกดปุ่ม (ระบบหลังบ้าน hh_sync): ตรวจ → อัปเดต · ไม่อัตโนมัติ
//   หน้าย่อย: #hh (ภาพรวม) · #hh/t/<แท็บ> · #hh/h/<รหัส> · #hh/map · #hh/check · #hh/sync · #hh/ref · #hh/cols
// =====================================================================
const HH_SUB = [['', 'ภาพรวม'], ['t/01', 'ทะเบียน'], ['t/02', 'รายได้'], ['t/03', 'อาหารสัตว์'], ['t/04', 'ปุ๋ย'], ['t/05', 'หนี้สิน'], ['t/06', 'คัดกรองนวัตกร'], ['t/07', 'ประเมินนวัตกร'], ['t/09', 'สรุปพัฒนาการ'], ['ref', 'เกณฑ์ 08'], ['map', 'แผนที่ครัวเรือน'], ['check', 'ตรวจความสอดคล้อง'], ['sync', 'ซิงก์กับชีต']];
const HH_LONG = /หมายเหตุ|หลักฐาน|Pain|Gain|ทักษะ|คุณลักษณะ|จุดแข็ง|สิ่งที่ต้องพัฒนา|แผนพัฒนา|เรื่องที่เคยถ่ายทอด|เครือข่ายความร่วมมือ|ผลผลิตหลัก|ช่องทาง/;
const HH_COLORS = { A: '#2E7D32', B: '#F9A825', C: '#EF6C00', '': '#455A64' };
const hhCanAdmin = () => isSuper() || (S.me && S.me.role === 'admin');
const hhBlank = v => v === null || v === undefined || String(v).trim() === '';
const hhNumv = v => { if (typeof v === 'number') return v; const t = String(v ?? '').trim().replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };
const hhMask = (v, h) => { const s = String(v ?? ''); if (!s) return ''; return /บัตร/.test(h) ? s.replace(/\d(?=[\d-]{4})/g, '•') : s.replace(/\d(?=\d{3})/g, '•'); };

// โหลดข้อมูลทั้งชุดของไฟล์ (ครั้งเดียวต่อการเปลี่ยนแปลง) · ~500 แถว
async function hhLoad(force) {
  if (S._hh && !force) return S._hh;
  const base = (S.hhLinks || [])[0]; if (!base) return null;
  const link = (await api.list('hh.link', { eq: { id: base.id } }))[0] || base;   // สถานะซิงก์ล่าสุดต้องสด
  const tabs = await api.list('hh.tab', { eq: { link_id: link.id }, order: ['sort_order'] });
  const ids = tabs.map(t => t.id);
  const [cols, rows, logs] = await Promise.all([
    ids.length ? api.list('hh.col', { in: { tab_id: ids }, order: ['col_index'] }) : [],
    api.list('hh.row', { eq: { project_id: link.project_id }, order: ['row_key'] }),
    api.list('hh.sync_log', { eq: { link_id: link.id }, order: ['run_at', false], limit: 10 }).catch(() => [])]);
  const byKey = {}, model = { tabs: {}, options: {} };
  for (const t of tabs) {
    const cs = cols.filter(c => c.tab_id === t.id && c.present !== false).sort((a, b) => a.col_index - b.col_index);
    const rs = rows.filter(r => r.tab_id === t.id && r.status === 'active');
    byKey[t.tab_key] = { tab: t, cols: cs, rows: rs };
    if (t.kind !== 'reference') {
      model.tabs[t.tab_key] = { headers: cs.map(c => c.header), formulaHeaders: cs.filter(c => c.is_formula).map(c => c.header), missingKeys: [], rows: rs.map(r => ({ key: r.row_key, code: r.hh_code, data: r.data || {} })) };
      model.options[t.tab_key] = Object.fromEntries(cs.filter(c => Array.isArray(c.options) && c.options.length).map(c => [c.header, c.options]));
    }
  }
  const reg = byKey['01'] ? byKey['01'].rows : [];
  const role = (k, r) => { const c = (byKey[k] ? byKey[k].cols : []).find(x => x.role === r); return c ? c.header : null; };
  S._hh = { link, tabs, byKey, model, logs: (logs || []).slice(0, 10), role, reg, roleVal: (row, k, r) => { const h = role(k, r); return h ? (row.data || {})[h] : null; } };
  return S._hh;
}
function hhShell(sub, body) {
  const H = S._hh; const last = H && H.link.last_sync_at ? `ซิงก์ล่าสุด ${thDate(H.link.last_sync_at)}` : 'ยังไม่เคยซิงก์กับชีต';
  return `<div class="card"><div class="cardhead"><h4>ครัวเรือน AppTech ${helpBtn('hh')}</h4><span class="muted">${esc(H ? H.link.name : '')} · ${last}</span></div>
    <div class="subtabs" style="flex-wrap:wrap">${HH_SUB.filter(([k]) => k !== 'cols' || hhCanAdmin()).map(([k, l]) => `<a href="#hh${k ? '/' + k : ''}" class="${sub === k ? 'active' : ''}">${l}</a>`).join('')}${hhCanAdmin() ? `<a href="#hh/cols" class="${sub === 'cols' ? 'active' : ''}">ตั้งค่าคอลัมน์</a>` : ''}</div></div>${body}`;
}
async function pageHH(view) {
  const parts = location.hash.replace(/^#hh\/?/, '').split('/'), sub = parts[0] || '';
  let H; try { H = await hhLoad(); } catch (e) { const f = friendlyError(e); return view.innerHTML = `<div class="card"><h3 style="margin-top:0">ครัวเรือน AppTech</h3><div class="banner warn">${esc(f.title)}</div><div class="muted" style="margin-top:6px">${esc(f.hint)} (เจ้าของโครงการต้องรัน sql/014_household.sql และเพิ่มสคีมา hh ใน Exposed schemas ก่อน)</div></div>`; }
  if (!H) return view.innerHTML = `<div class="card">บัญชีนี้ไม่มีสิทธิ์ข้อมูลครัวเรือน (เฉพาะ super admin · admin · ผู้บันทึกที่สังกัดโครงการ บพท.69_AppTech)</div>`;
  if (!H.reg.length && !['sync', 'cols', 'ref'].includes(sub)) return view.innerHTML = hhShell(sub, `<div class="card"><h4 style="margin-top:0">ยังไม่มีข้อมูลครัวเรือนในระบบ</h4><div>ขั้นแรก ดึงข้อมูลจากชีตเข้าระบบที่แท็บ <a href="#hh/sync">ซิงก์กับชีต</a> → "ตรวจกับชีต" → "อัปเดตตามนี้"${hhCanAdmin() ? '' : ' (admin เป็นผู้กดอัปเดต)'}</div></div>`);
  if (sub === 't') return hhTabPage(view, parts[1] || '01');
  if (sub === 'h') return hhDetail(view, decodeURIComponent(parts[1] || ''));
  if (sub === 'map') return hhMap(view);
  if (sub === 'check') return hhCheckPage(view);
  if (sub === 'sync') return hhSyncPage(view);
  if (sub === 'ref') return hhRefPage(view);
  if (sub === 'cols') return hhColsPage(view);
  return hhOverview(view);
}

// ---------------------------------------------------------------------
// ภาพรวม (แทนแท็บ 90): นับเฉพาะสถานะ "ข้อมูลครบ" และไม่ใช่กลุ่ม C · รายหมวดนับเป็น "จำนวนครัวเรือน" (DEC-116 ข้อ 4A)
// ---------------------------------------------------------------------
function hhOverview(view) {
  const H = S._hh, rv = (r, role) => H.roleVal(r, '01', role);
  const all = H.reg, st = r => String(rv(r, 'status') ?? '').trim(), grp = r => String(rv(r, 'group') ?? '').trim();
  const use = all.filter(r => st(r) === 'ข้อมูลครบ' && grp(r) !== 'C');
  const cnt = (arr, f) => { const m = {}; for (const r of arr) { const k = f(r) || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; } return m; };
  const nums = (arr, role) => arr.map(r => hhNumv(rv(r, role))).filter(n => !isNaN(n));
  const sumR = (arr, role) => nums(arr, role).reduce((a, b) => a + b, 0);
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const inc = nums(use, 'income').filter(n => n > 0), exp = nums(use, 'expense').filter(n => n > 0), mem = nums(use, 'members').filter(n => n > 0);
  const base = sumR(use, 'baseline'), expT = exp.reduce((a, b) => a + b, 0);
  const bal = use.map(r => hhNumv(rv(r, 'income')) - hhNumv(rv(r, 'expense'))).filter(n => !isNaN(n));
  const splitCnt = (k, role) => { const t = H.byKey[k]; if (!t) return {}; const h = H.role(k, role); const m = {}, seen = {}; for (const r of t.rows) { if (!h) break; for (const x of String((r.data || {})[h] ?? '').split(',').map(s => s.trim()).filter(Boolean)) { const kk = x + '|' + r.hh_code; if (seen[kk]) continue; seen[kk] = 1; m[x] = (m[x] || 0) + 1; } } return m; };
  const srcCnt = splitCnt('02', 'income_source'), aniCnt = splitCnt('03', 'animal'), cropCnt = splitCnt('04', 'crop');
  const scr = H.byKey['06'] ? cnt(H.byKey['06'].rows, r => String((r.data || {})[H.role('06', 'screen_result')] ?? '').trim()) : {};
  const rounds = H.byKey['07'] ? cnt(H.byKey['07'].rows, r => String((r.data || {})[H.role('07', 'round')] ?? '').trim()) : {};
  const kv = (l, v, note) => `<tr><td>${l}</td><td class="num"><b>${v}</b></td><td class="muted">${note || ''}</td></tr>`;
  const sec = (t, rows) => `<div class="card"><div class="cardhead"><h4>${t}</h4></div><table><tbody>${rows}</tbody></table></div>`;
  const groups = cnt(all, grp), tambons = cnt(use, r => String(rv(r, 'tambon') ?? '').trim()), status = cnt(all, st);
  view.innerHTML = hhShell('', `
    <div class="kpis"><div class="kpi hero"><div class="l">ครัวเรือนที่ลงทะเบียน</div><div class="v">${fmtInt(all.length)}</div></div><div class="kpi"><div class="l">ข้อมูลครบ (ใช้คำนวณสถิติ)</div><div class="v">${fmtInt(use.length)}</div></div><div class="kpi"><div class="l">สมาชิกรวม (คน)</div><div class="v">${fmtInt(mem.reduce((a, b) => a + b, 0))}</div></div><div class="kpi"><div class="l">รายได้มัธยฐาน (บาท/เดือน)</div><div class="v">${fmt(median(inc), 0)}</div></div><div class="kpi"><div class="l">Baseline อาหารสัตว์+ปุ๋ย (บาท/เดือน)</div><div class="v">${fmt(base, 0)}</div></div></div>
    <div class="muted" style="margin:6px 0 10px">นับเฉพาะครัวเรือนสถานะ "ข้อมูลครบ" และไม่ใช่กลุ่ม C (ตามแท็บ 90 ของชีต) · รายหมวดนับเป็นจำนวนครัวเรือน เพราะหลายแถวใส่หลายรายการในช่องเดียว (ยอดเงินแยกหมวดไม่ได้)</div>
    <div class="grid-dash">
      <div class="card"><div class="cardhead"><h4>กลุ่มเป้าหมาย (กลุ่มหลัก)</h4></div><div class="chartbox"><canvas id="hhG"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>ครัวเรือนตามตำบล</h4></div><div class="chartbox"><canvas id="hhT"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>แหล่งรายได้ (จำนวนครัวเรือนที่มี)</h4></div><div class="chartbox"><canvas id="hhS"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>สัตว์ที่เลี้ยง (จำนวนครัวเรือนที่มี)</h4></div><div class="chartbox"><canvas id="hhA"></canvas></div></div>
    </div>
    <div class="grid-dash" style="margin-top:14px">
      ${sec('1. การลงทะเบียน', Object.entries(status).map(([k, v]) => kv('สถานะ: ' + esc(k), fmtInt(v))).join('') + Object.entries(groups).sort().map(([k, v]) => kv('กลุ่มหลัก ' + esc(k), fmtInt(v))).join('') + kv('สมาชิกเฉลี่ย/ครัวเรือน', fmt(mem.length ? mem.reduce((a, b) => a + b, 0) / mem.length : null, 1), `${fmtInt(mem.length)} ครัวเรือนที่กรอก`))}
      ${sec('2. รายได้ (บาท/เดือน)', kv('รวมทั้งกลุ่ม', fmt(inc.reduce((a, b) => a + b, 0), 0)) + kv('มัธยฐาน ★', fmt(median(inc), 0), 'แนะนำใช้รายงาน') + kv('เฉลี่ย', fmt(inc.length ? inc.reduce((a, b) => a + b, 0) / inc.length : null, 0), 'ระวังค่าผิดปกติ') + kv('ต่ำสุด – สูงสุด', inc.length ? `${fmt(Math.min(...inc), 0)} – ${fmt(Math.max(...inc), 0)}` : '-') + Object.entries(cnt(use, r => String(rv(r, 'income_regularity') ?? '').trim())).map(([k, v]) => kv('ความสม่ำเสมอ: ' + esc(k), fmtInt(v) + ' ราย')).join(''))}
      ${sec('3. Baseline ต้นทุนที่ BSF ทดแทนได้ (บาท/เดือน)', kv('ค่าอาหารสัตว์รวม', fmt(sumR(use, 'feed_cost'), 0)) + kv('ค่าปุ๋ยรวม', fmt(sumR(use, 'fert_cost'), 0)) + kv('Baseline รวม', fmt(base, 0), 'ฐานวัดผลการลดต้นทุน') + kv('รายจ่ายครัวเรือนรวม', fmt(expT, 0)) + kv('สัดส่วน Baseline ต่อรายจ่าย', expT ? (base / expT * 100).toFixed(1) + '%' : '-') + kv('ประหยัดได้หากทดแทน 30% / 50%', `${fmt(base * .3, 0)} / ${fmt(base * .5, 0)}`, 'ต่อเดือน') + kv('ต่อปี 30% / 50%', `${fmt(base * .3 * 12, 0)} / ${fmt(base * .5 * 12, 0)}`))}
      ${sec('4. ดุลครัวเรือน หนี้สิน และความต้องการ BSF', kv('ขาดดุล / สมดุล / เกินดุล', `${bal.filter(n => n < 0).length} / ${bal.filter(n => n === 0).length} / ${bal.filter(n => n > 0).length}`, 'ราย') + kv('รายจ่ายมัธยฐาน', fmt(median(exp), 0)) + kv('ภาระผ่อนหนี้รวม/เดือน', fmt(sumR(use, 'debt_payment'), 0)) + kv('ต้องการหนอน BSF (กก./เดือน)', fmt(sumR(use, 'larvae_need'), 0)) + kv('ต้องการมูล BSF (กก./รอบ)', fmt(sumR(use, 'manure_need'), 0)) + Object.entries(cropCnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => kv('ใช้ปุ๋ยกับ: ' + esc(k), fmtInt(v) + ' ราย')).join(''))}
      ${sec('5. นวัตกรชุมชน', Object.entries(scr).map(([k, v]) => kv('ผลคัดกรอง: ' + esc(k), fmtInt(v) + ' ราย')).join('') + (Object.keys(rounds).length ? Object.entries(rounds).map(([k, v]) => kv('ประเมินรอบ ' + esc(k), fmtInt(v) + ' ราย')).join('') : kv('การประเมิน (แท็บ 07)', 'ยังไม่มี')))}
    </div>`);
  const bar = (el, m, color, horizontal) => { const e = Object.entries(m).sort((a, b) => b[1] - a[1]); if (e.length && $(el)) mkChart($(el), { type: 'bar', data: { labels: e.map(x => x[0]), datasets: [{ label: 'ครัวเรือน', data: e.map(x => x[1]), backgroundColor: color }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: { [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 } } } } }); };
  const ge = Object.entries(groups); if (ge.length) mkChart($('#hhG'), { type: 'doughnut', data: { labels: ge.map(g => 'กลุ่ม ' + g[0]), datasets: [{ data: ge.map(g => g[1]), backgroundColor: ge.map(g => HH_COLORS[g[0]] || '#455A64') }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  bar('#hhT', tambons, PALETTE[0]); bar('#hhS', srcCnt, PALETTE[1], true); bar('#hhA', aniCnt, PALETTE[3], true);
}

// ---------------------------------------------------------------------
// ตารางรายแท็บ + ตัวกรอง (แทนแท็บ 91) + เพิ่ม/แก้
// ---------------------------------------------------------------------
function hhTabPage(view, key) {
  const H = S._hh, T = H.byKey[key]; if (!T) return view.innerHTML = hhShell('t/' + key, '<div class="card">ไม่พบแท็บนี้ (ซิงก์กับชีตก่อน)</div>');
  const f = S._hhf = S._hhf || {}; const st = f[key] = f[key] || { q: '', group: '', tambon: '', status: '', imin: '', imax: '' };
  const cols = T.cols.filter(c => c.in_list); const listCols = cols.length ? cols : T.cols.slice(0, 6);
  const reg = Object.fromEntries(H.reg.map(r => [r.hh_code, r]));
  const rv = (code, role) => reg[code] ? H.roleVal(reg[code], '01', role) : null;
  let rows = T.rows;
  const q = st.q.trim().toLowerCase();
  if (q) rows = rows.filter(r => r.hh_code.toLowerCase().includes(q) || Object.entries(r.data || {}).some(([h, v]) => !T.cols.find(c => c.header === h && c.sensitive) && String(v ?? '').toLowerCase().includes(q)));
  if (st.group) rows = rows.filter(r => String(rv(r.hh_code, 'group') ?? '').trim() === st.group);
  if (st.tambon) rows = rows.filter(r => String(rv(r.hh_code, 'tambon') ?? '').trim() === st.tambon);
  if (st.status) rows = rows.filter(r => String(rv(r.hh_code, 'status') ?? '').trim() === st.status);
  if (st.imin !== '' || st.imax !== '') rows = rows.filter(r => { const n = hhNumv(rv(r.hh_code, 'income')); return !isNaN(n) && (st.imin === '' || n >= +st.imin) && (st.imax === '' || n <= +st.imax); });
  const uniq = role => [...new Set(H.reg.map(r => String(H.roleVal(r, '01', role) ?? '').trim()).filter(Boolean))].sort();
  const sel = (k, label, opts) => `<select style="width:auto" onchange="S._hhf['${key}'].${k}=this.value;render()"><option value="">${label}</option>${opts.map(o => `<option ${o === st[k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const cell = (r, c) => { const v = (r.data || {})[c.header]; if (c.sensitive) return `<span class="mono">${esc(hhMask(v, c.header))}</span>`; const s = String(v ?? ''); return esc(s.length > 60 ? s.slice(0, 60) + '…' : s); };
  const data = rows.map(r => ({ _r: r, code: r.row_key, ...Object.fromEntries(listCols.map(c => [c.header, (r.data || {})[c.header]])) }));
  const tbl = pagedTable('hhTbl' + key, data, [{ label: 'รหัส', key: 'code', cls: 'nowrap' }, ...listCols.map(c => ({ label: c.header + (c.is_formula ? ' ⓕ' : ''), key: c.header })), { label: '' }],
    d => `<tr><td class="nowrap"><a href="#hh/h/${encodeURIComponent(d._r.hh_code)}">${esc(d.code)}</a></td>${listCols.map(c => `<td${hhNumv(d[c.header]) === hhNumv(d[c.header]) && !isNaN(hhNumv(d[c.header])) ? ' class="num"' : ''}>${cell(d._r, c)}</td>`).join('')}<td><button class="small secondary" onclick="hhEdit('${key}','${d._r.id}')">แก้</button></td></tr>`, { resetPage: false });
  view.innerHTML = hhShell('t/' + key, `<div class="card"><div class="cardhead"><h4>${esc(T.tab.label)} (${fmtInt(rows.length)}${rows.length !== T.rows.length ? ' จาก ' + fmtInt(T.rows.length) : ''})</h4><div class="row"><button class="small secondary" onclick="hhExport('${key}')">ส่งออก CSV</button><button class="small" onclick="hhEdit('${key}')">＋ เพิ่ม${key === '01' ? 'ครัวเรือน' : 'แถว'}</button></div></div>
    <div class="row" style="margin-bottom:6px"><input type="search" placeholder="ค้นหารหัส/ข้อความ…" value="${esc(st.q)}" style="flex:1;min-width:160px" onchange="S._hhf['${key}'].q=this.value;render()">${sel('group', 'ทุกกลุ่ม', uniq('group'))}${sel('tambon', 'ทุกตำบล', uniq('tambon'))}${sel('status', 'ทุกสถานะ', uniq('status'))}
      <label style="margin:0">รายได้ <input type="number" placeholder="ต่ำสุด" value="${esc(st.imin)}" style="width:110px" onchange="S._hhf['${key}'].imin=this.value;render()"> – <input type="number" placeholder="สูงสุด" value="${esc(st.imax)}" style="width:110px" onchange="S._hhf['${key}'].imax=this.value;render()"></label></div>
    <div class="muted" style="margin-bottom:6px">ⓕ = คอลัมน์สูตรในชีต (ระบบแสดงอย่างเดียว) · ตัวกรองกลุ่ม/ตำบล/สถานะ/รายได้ ใช้ข้อมูลจากทะเบียน · ข้อมูลส่วนบุคคลแสดงแบบปิดบัง เปิดดูได้ในหน้ารายครัวเรือน · เลือกคอลัมน์ที่แสดงได้ที่ "ตั้งค่าคอลัมน์"</div>
    <div class="tscroll">${tbl}</div></div>`);
}
function hhExport(key) {
  const H = S._hh, T = H.byKey[key];
  exportCsv(T.rows.map(r => Object.fromEntries([['รหัสแถว', r.row_key], ...T.cols.map(c => [c.header, (r.data || {})[c.header] ?? ''])])), 'household_' + key);
}
function hhEdit(key, id) {
  const H = S._hh, T = H.byKey[key], r = id ? T.rows.find(x => x.id === id) : null, d = r ? (r.data || {}) : {};
  const keyHs = T.tab.key_headers || ['รหัสครัวเรือน'];
  const field = c => {
    const v = d[c.header], fid = 'hf_' + c.col_index, isKey = keyHs.includes(c.header);
    if (c.is_formula) return `<div><label>${esc(c.header)} <span class="muted">(สูตรในชีต)</span></label><input value="${esc(v ?? '')}" readonly style="background:#f3f4f6"></div>`;
    if (isKey && c.header === 'รหัสครัวเรือน' && key !== '01') return `<div><label>${esc(c.header)} *</label><select id="${fid}" ${r ? 'disabled' : ''}>${H.reg.map(x => `<option ${x.hh_code === (r ? r.hh_code : '') ? 'selected' : ''}>${esc(x.hh_code)}</option>`).join('')}</select></div>`;
    if (isKey && r) return `<div><label>${esc(c.header)} <span class="muted">(กุญแจ แก้ไม่ได้)</span></label><input value="${esc(v ?? '')}" readonly style="background:#f3f4f6"></div>`;
    if (Array.isArray(c.options) && c.options.length) { const opts = c.options.map(String); const extra = !hhBlank(v) && !opts.includes(String(v)) ? [String(v)] : []; return `<div><label>${esc(c.header)}${isKey ? ' *' : ''}</label><select id="${fid}"><option value="">—</option>${opts.concat(extra).map(o => `<option ${String(v ?? '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`; }
    if (HH_LONG.test(c.header)) return `<div style="grid-column:1/-1"><label>${esc(c.header)}</label><textarea id="${fid}" rows="2">${esc(v ?? '')}</textarea></div>`;
    return `<div><label>${esc(c.header)}${isKey ? ' *' : ''}</label><input id="${fid}" value="${esc(v ?? '')}" ${key === '01' && c.header === 'รหัสครัวเรือน' ? 'placeholder="เช่น BSF-062" autocapitalize="characters"' : ''}></div>`;
  };
  openModal(`<h3 style="margin-top:0">${r ? 'แก้' : 'เพิ่ม'} ${esc(T.tab.label)}${r ? ' · ' + esc(r.row_key) : ''}</h3><div class="muted" style="margin-bottom:8px">บันทึกแล้วยังไม่ลงชีตทันที · ไปที่ "ซิงก์กับชีต" เพื่อส่งค่าที่แก้ลงชีต (ชีตยังเป็นหลัก)</div>
    <div class="fgrid" style="max-height:60vh;overflow:auto">${T.cols.map(field).join('')}</div>
    <div class="row" style="margin-top:12px"><button id="hfSave">บันทึก</button><button class="secondary" onclick="closeModal()">ยกเลิก</button></div>`);
  $('#hfSave').onclick = async () => {
    const nd = { ...d };
    for (const c of T.cols) { if (c.is_formula) continue; const el = $('#hf_' + c.col_index); if (!el) continue; const val = el.value.trim(); nd[c.header] = val === '' ? null : (hhNumv(val) === hhNumv(val) && !isNaN(hhNumv(val)) && !/^0\d/.test(val) && !/บัตร|โทร/.test(c.header) ? hhNumv(val) : val); }
    const code = String(key === '01' ? nd['รหัสครัวเรือน'] ?? '' : (r ? r.hh_code : nd['รหัสครัวเรือน'] ?? '')).trim();
    if (!new RegExp(H.link.code_pattern).test(code)) return needField(key === '01' ? '#hf_1' : '#hf_1', 'รหัสครัวเรือนต้องเป็นรูปแบบ BSF-ตัวเลข');
    if (key === '01' && !r && H.reg.some(x => x.hh_code === code)) return needField('#hf_1', 'รหัสนี้มีในทะเบียนแล้ว (รหัสต้องไม่ซ้ำ)');
    let rowKey = r ? r.row_key : keyHs.map(h => String(h === 'รหัสครัวเรือน' ? code : (nd[h] ?? '')).trim()).join('|');
    if (!r) { if (keyHs.some(h => hhBlank(h === 'รหัสครัวเรือน' ? code : nd[h]))) return toast('กรอกช่องที่มี * ให้ครบ', true); let n = 1, base = rowKey; while (T.rows.some(x => x.row_key === rowKey)) { n++; rowKey = base + '#' + n; } }
    try {
      if (r) await api.update('hh.row', r.id, { data: nd });
      else await api.insert('hh.row', { tab_id: T.tab.id, row_key: rowKey, hh_code: code, data: nd });
      closeModal(); toast('บันทึกแล้ว · ส่งลงชีตได้ที่ "ซิงก์กับชีต"'); await hhLoad(true); render();
    } catch (e) { fail(e, 'บันทึกไม่สำเร็จ'); }
  };
}

// ---------------------------------------------------------------------
// รายครัวเรือน: รวมทุกแท็บของรหัสนี้
// ---------------------------------------------------------------------
function hhDetail(view, code) {
  const H = S._hh, reg = H.reg.find(r => r.hh_code === code);
  if (!reg) return view.innerHTML = hhShell('t/01', `<div class="card">ไม่พบรหัส ${esc(code)} ในทะเบียน</div>`);
  const show = S._hhShow = S._hhShow || {};
  const kvs = (T, r) => `<table><tbody>${T.cols.filter(c => !hhBlank((r.data || {})[c.header])).map(c => { const v = (r.data || {})[c.header]; const sv = c.sensitive && !show[code] ? hhMask(v, c.header) : v; return `<tr><td class="muted" style="width:40%">${esc(c.header)}${c.is_formula ? ' ⓕ' : ''}</td><td>${esc(sv)}</td></tr>`; }).join('')}</tbody></table>`;
  const name = H.roleVal(reg, '01', 'name');
  const others = Object.values(H.byKey).filter(t => t.tab.tab_key !== '01' && t.tab.kind !== 'reference').map(t => {
    const rs = t.rows.filter(r => r.hh_code === code);
    return `<div class="card"><div class="cardhead"><h4>${esc(t.tab.label)} (${rs.length})</h4><button class="small" onclick="hhEdit('${t.tab.tab_key}')">＋ เพิ่ม</button></div>${rs.map(r => `<div style="border-top:1px solid var(--line);padding-top:6px;margin-top:6px"><div class="row" style="justify-content:space-between"><b>${esc(r.row_key)}</b><button class="small secondary" onclick="hhEdit('${t.tab.tab_key}','${r.id}')">แก้</button></div>${kvs(t, r)}</div>`).join('') || '<div class="muted">ไม่มีแถว</div>'}</div>`;
  }).join('');
  const la = hhNumv(H.roleVal(reg, '01', 'lat')), lo = hhNumv(H.roleVal(reg, '01', 'lng'));
  view.innerHTML = hhShell('t/01', `<div class="card"><div class="cardhead"><h4>${esc(code)} · ${esc(name || '')}</h4><div class="row"><button class="small secondary" onclick="S._hhShow['${esc(code)}']=!S._hhShow['${esc(code)}'];render()">${show[code] ? 'ซ่อน' : 'แสดง'}ข้อมูลส่วนบุคคล</button><button class="small" onclick="hhEdit('01','${reg.id}')">แก้ทะเบียน</button></div></div>
    ${!isNaN(la) && !isNaN(lo) ? '<div id="hhMini" style="height:220px;border-radius:10px;margin-bottom:8px"></div>' : ''}${kvs(H.byKey['01'], reg)}</div><div class="grid-dash">${others}</div>`);
  if (!isNaN(la) && !isNaN(lo)) { const m = L.map('hhMini'); addBaseLayer(m); m.setView([la, lo], 16); L.circleMarker([la, lo], { radius: 10, color: '#fff', weight: 2, fillColor: HH_COLORS[String(H.roleVal(reg, '01', 'group') ?? '')] || '#455A64', fillOpacity: .95 }).addTo(m); }
}

// ---------------------------------------------------------------------
// แผนที่ครัวเรือน (เฉพาะเมนูนี้)
// ---------------------------------------------------------------------
function hhMap(view) {
  const H = S._hh, st = S._hhm = S._hhm || { group: '', tambon: '' };
  const rows = H.reg.filter(r => (!st.group || String(H.roleVal(r, '01', 'group') ?? '') === st.group) && (!st.tambon || String(H.roleVal(r, '01', 'tambon') ?? '') === st.tambon));
  const uniq = role => [...new Set(H.reg.map(r => String(H.roleVal(r, '01', role) ?? '').trim()).filter(Boolean))].sort();
  view.innerHTML = hhShell('map', `<div class="card legend" style="padding:8px 12px;justify-content:space-between"><span class="row"><select style="width:auto" onchange="S._hhm.group=this.value;render()"><option value="">ทุกกลุ่ม</option>${uniq('group').map(g => `<option ${g === st.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select><select style="width:auto" onchange="S._hhm.tambon=this.value;render()"><option value="">ทุกตำบล</option>${uniq('tambon').map(g => `<option ${g === st.tambon ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></span>
    <span class="legend">${Object.entries(HH_COLORS).filter(([k]) => k).map(([k, c]) => `<span><i class="dot" style="background:${c}"></i>กลุ่ม ${k}</span>`).join('')}</span></div><div id="map"></div><div class="muted" id="hhMapNote" style="margin-top:6px"></div>`);
  const map = L.map('map'); addBaseLayer(map); const g = L.featureGroup().addTo(map); let miss = 0;
  for (const r of rows) {
    const la = hhNumv(H.roleVal(r, '01', 'lat')), lo = hhNumv(H.roleVal(r, '01', 'lng')); if (isNaN(la) || isNaN(lo)) { miss++; continue; }
    const grp = String(H.roleVal(r, '01', 'group') ?? '');
    L.circleMarker([la, lo], { radius: 8, color: '#fff', weight: 1.5, fillColor: HH_COLORS[grp] || '#455A64', fillOpacity: .95 })
      .bindPopup(`<b>${esc(r.hh_code)}</b> ${esc(H.roleVal(r, '01', 'name') || '')}<br>กลุ่ม ${esc(grp)} · ต.${esc(H.roleVal(r, '01', 'tambon') || '')}<br><a href="#hh/h/${encodeURIComponent(r.hh_code)}">เปิดข้อมูลครัวเรือน ›</a>`).addTo(g);
  }
  fitAll(map, g);
  $('#hhMapNote').textContent = `แสดง ${rows.length - miss} ครัวเรือน${miss ? ` · ${miss} ครัวเรือนยังไม่มีพิกัด` : ''} · แผนที่นี้แสดงเฉพาะในเมนูครัวเรือน AppTech (ไม่แสดงบนหน้าสาธารณะ)`;
}

// ---------------------------------------------------------------------
// ตรวจความสอดคล้อง (กฎเดียวกับรายงานให้ทีม: web/hh-check.js)
// ---------------------------------------------------------------------
function hhCheckPage(view) {
  const H = S._hh, st = S._hhc = S._hhc || { level: '' };
  const issues = hhCheck(H.model); const shown = issues.filter(i => !st.level || i.level === st.level);
  const L = { error: 'ต้องแก้', warn: 'ควรตรวจ', info: 'ข้อสังเกต' }, C = { error: '#fee2e2', warn: '#fef3c7', info: '#e0f2fe' };
  const by = {}; shown.forEach(i => { const k = i.level + '|' + i.tab + '|' + i.rule; (by[k] = by[k] || []).push(i); });
  const order = { error: 0, warn: 1, info: 2 };
  S._hhIssues = issues.map(i => ({ ระดับ: L[i.level], แท็บ: i.tab + ' ' + i.tab_label, รหัส: i.code, ช่อง: i.field, เรื่อง: HH_RULE_TITLE[i.rule] || i.rule, รายละเอียด: i.msg }));
  view.innerHTML = hhShell('check', `<div class="card"><div class="cardhead"><h4>ตรวจความสอดคล้องของข้อมูล ${helpBtn('hh-check')}</h4><button class="small secondary" onclick="exportCsv(S._hhIssues,'household_check')">ส่งออก CSV (ส่งให้ทีม)</button></div>
    <div class="kpis">${['error', 'warn', 'info'].map(l => `<div class="kpi" style="cursor:pointer;${st.level === l ? 'outline:2px solid var(--brand)' : ''}" onclick="S._hhc.level=S._hhc.level==='${l}'?'':'${l}';render()"><div class="l">${L[l]}</div><div class="v">${fmtInt(issues.filter(i => i.level === l).length)}</div></div>`).join('')}</div>
    <div class="muted" style="margin-top:6px">ตรวจจากข้อมูลในระบบ (ซิงก์ล่าสุด) · ต้องแก้ = ผิดชัดเจน · ควรตรวจ = น่าสงสัย ให้ทีมยืนยัน · ข้อสังเกต = ไม่ผิด แต่ควรรู้ · กดการ์ดเพื่อกรอง · แก้ในชีตแล้วกดซิงก์ใหม่ ผลจะหายไป</div></div>
    ${Object.values(by).sort((a, b) => order[a[0].level] - order[b[0].level] || a[0].tab.localeCompare(b[0].tab)).map(g => `<div class="card"><div class="cardhead"><h4><span class="pill" style="background:${C[g[0].level]}">${L[g[0].level]}</span> แท็บ ${esc(g[0].tab)} ${esc(g[0].tab_label)} — ${esc(HH_RULE_TITLE[g[0].rule] || g[0].rule)} (${g.length})</h4></div>
      <div class="tscroll"><table><thead><tr><th>รหัสครัวเรือน</th><th>ช่อง</th><th>รายละเอียด</th></tr></thead><tbody>${g.slice(0, 200).map(i => `<tr><td>${i.code.split(', ').map(c => /^BSF-\d+$/.test(c) ? `<a href="#hh/h/${encodeURIComponent(c)}">${esc(c)}</a>` : esc(c)).join(', ')}</td><td>${esc(i.field)}</td><td>${esc(i.msg)}</td></tr>`).join('')}</tbody></table></div></div>`).join('') || '<div class="card">ไม่พบปัญหา</div>'}`);
}

// ---------------------------------------------------------------------
// ซิงก์กับชีต (กดปุ่ม): ตรวจ → เลือกค่าที่ขัดแย้ง → อัปเดต
// ---------------------------------------------------------------------
function hhSyncPage(view) {
  const H = S._hh, P = S._hhPlan;
  const head = `<div class="card"><div class="cardhead"><h4>ซิงก์กับ Google Sheet ${helpBtn('hh-sync')}</h4><a class="small" href="https://docs.google.com/spreadsheets/d/${esc(H.link.spreadsheet_id)}" target="_blank" rel="noopener">เปิดชีต ›</a></div>
    <div>ชีตเป็นหลักในช่วงเปลี่ยนผ่าน · ระบบไม่ซิงก์อัตโนมัติ · กด <b>ตรวจกับชีต</b> เพื่อดูว่าฝั่งไหนเปลี่ยนอะไร แล้ว${hhCanAdmin() ? ' กด <b>อัปเดตตามนี้</b>' : ' ให้ admin กดอัปเดต'}</div>
    <ul style="margin:6px 0 0;padding-left:20px" class="muted"><li>ช่องที่เปลี่ยนฝั่งเดียว → อัปเดตตามฝั่งที่เปลี่ยน (ชีต → ระบบ หรือ ระบบ → ชีต)</li><li>ช่องที่เปลี่ยนทั้งสองฝั่งต่างกัน = ขัดแย้ง → เลือกเองรายช่อง (ไม่เลือก = ใช้ค่าในชีต)</li><li>ช่องสูตรในชีตไม่ถูกเขียนทับ · แถวที่ลบในชีต ระบบปิดใช้งาน (ไม่ลบทิ้ง)</li></ul>
    <div class="row" style="margin-top:10px"><button id="hhPrev">ตรวจกับชีต</button>${P && hhCanAdmin() ? '<button id="hhApply" class="secondary">อัปเดตตามนี้</button>' : ''}</div></div>`;
  const planHtml = !P ? '' : `<div class="card"><div class="cardhead"><h4>ผลการ${P.mode === 'apply' ? 'อัปเดต' : 'ตรวจ'} (${thDate(P.at)})</h4></div>${P.warnings && P.warnings.length ? `<div class="banner warn">${P.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="tscroll"><table><thead><tr><th>แท็บ</th><th class="num">แถวในชีต</th><th class="num">ใหม่จากชีต</th><th class="num">ชีต → ระบบ</th><th class="num">ระบบ → ชีต</th><th class="num">ใหม่จากระบบ</th><th class="num">หายจากชีต</th><th class="num">ขัดแย้ง</th><th class="num">ไม่เปลี่ยน</th></tr></thead><tbody>
    ${P.tabs.map(t => t.kind === 'reference' ? `<tr><td>${esc(t.tab_key)} ${esc(t.label)}</td><td colspan="8" class="muted">ตารางเกณฑ์ ${t.reference_rows} แถว (อ่านอย่างเดียว)</td></tr>` : `<tr><td>${esc(t.tab_key)} ${esc(t.label)}${(t.duplicate_keys || []).length ? `<div class="muted">รหัสซ้ำในแท็บ: ${esc(t.duplicate_keys.join(', '))}</div>` : ''}</td><td class="num">${t.sheet_rows}</td><td class="num">${t.new_from_sheet}</td><td class="num">${t.update_from_sheet}</td><td class="num">${t.update_to_sheet}</td><td class="num">${t.new_to_sheet}</td><td class="num">${t.removed_in_sheet}</td><td class="num">${t.conflicts ? `<b style="color:var(--danger)">${t.conflicts}</b>` : 0}</td><td class="num">${t.unchanged}</td></tr>`).join('')}</tbody></table></div>
    ${P.tabs.some(t => (t.samples || []).length) ? `<details style="margin-top:8px"><summary>ตัวอย่างแถวที่เปลี่ยน</summary>${P.tabs.filter(t => (t.samples || []).length).map(t => `<div style="margin-top:6px"><b>${esc(t.label)}</b>${t.samples.map(s => `<div class="muted">${esc(s.code)}: ${s.from_sheet.length ? 'ชีต → ระบบ: ' + esc(s.from_sheet.join(', ')) : ''}${s.to_sheet.length ? ' · ระบบ → ชีต: ' + esc(s.to_sheet.join(', ')) : ''}</div>`).join('')}</div>`).join('')}</details>` : ''}</div>
    ${P.conflicts && P.conflicts.length ? `<div class="card"><div class="cardhead"><h4>ข้อขัดแย้ง (${P.conflicts.length}) — เลือกค่าที่ถูกต้องรายช่อง</h4></div><div class="tscroll"><table><thead><tr><th>แท็บ</th><th>แถว</th><th>ช่อง</th><th>ค่าในชีต</th><th>ค่าในระบบ</th><th>ใช้ค่า</th></tr></thead><tbody>${P.conflicts.map((c, i) => { const k = c.tab_key + '\u0002' + c.key + '\u0001' + c.header; const pick = (S._hhChoice || {})[k] || 'sheet'; return `<tr><td>${esc(c.tab_label)}</td><td>${esc(c.key)}</td><td>${esc(c.header)}</td><td>${esc(c.sheet ?? '(ว่าง)')}</td><td>${esc(c.system ?? '(ว่าง)')}</td><td class="nowrap"><label class="pick-opt" style="display:inline;padding:0"><input type="radio" name="hc${i}" ${pick === 'sheet' ? 'checked' : ''} onchange="hhPick(${i},'sheet')"> ชีต</label> <label class="pick-opt" style="display:inline;padding:0"><input type="radio" name="hc${i}" ${pick === 'system' ? 'checked' : ''} onchange="hhPick(${i},'system')"> ระบบ</label></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`;
  const logs = `<div class="card"><div class="cardhead"><h4>ประวัติการซิงก์</h4></div><table><thead><tr><th>เมื่อ</th><th>แบบ</th><th>โดย</th><th>สรุป</th></tr></thead><tbody>${(H.logs || []).map(l => `<tr><td class="nowrap">${thDate(l.run_at)}</td><td>${l.mode === 'apply' ? 'อัปเดต' : 'ตรวจ'}</td><td>${esc((l.summary || {}).by || '')}</td><td class="muted">${((l.summary || {}).tabs || []).filter(t => t.new_from_sheet || t.update_from_sheet || t.update_to_sheet || t.new_to_sheet || t.removed_in_sheet || t.conflicts).map(t => `${t.tab}: ${[t.new_from_sheet && 'ใหม่ ' + t.new_from_sheet, t.update_from_sheet && 'ชีต→ระบบ ' + t.update_from_sheet, t.update_to_sheet && 'ระบบ→ชีต ' + t.update_to_sheet, t.new_to_sheet && 'เพิ่มลงชีต ' + t.new_to_sheet, t.removed_in_sheet && 'หาย ' + t.removed_in_sheet, t.conflicts && 'ขัดแย้ง ' + t.conflicts].filter(Boolean).join(' · ')}`).join(' | ') || 'ไม่มีการเปลี่ยนแปลง'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">ยังไม่มี</td></tr>'}</tbody></table></div>`;
  view.innerHTML = hhShell('sync', head + planHtml + logs);
  const run = async (mode, btn) => {
    btn.disabled = true; btn.textContent = mode === 'apply' ? 'กำลังอัปเดต… (อาจใช้ 1–2 นาที)' : 'กำลังตรวจ…';
    try {
      const r = await api.engine('hh_sync', { link_id: H.link.id, mode, choices: S._hhChoice || {} });
      S._hhPlan = { ...r, at: new Date().toISOString() };
      if (mode === 'apply') { S._hhChoice = {}; toast('อัปเดตแล้ว'); await hhLoad(true); } else await hhLoad(true);
      render();
    } catch (e) { fail(e, mode === 'apply' ? 'อัปเดตไม่สำเร็จ' : 'ตรวจไม่สำเร็จ'); btn.disabled = false; btn.textContent = mode === 'apply' ? 'อัปเดตตามนี้' : 'ตรวจกับชีต'; }
  };
  $('#hhPrev').onclick = e => run('preview', e.target);
  if ($('#hhApply')) $('#hhApply').onclick = e => { if (confirm('อัปเดตระบบและชีตตามผลตรวจล่าสุด? (ช่องที่ขัดแย้งใช้ค่าที่เลือกไว้)')) run('apply', e.target); };
}
function hhPick(i, v) { const c = S._hhPlan.conflicts[i]; S._hhChoice = S._hhChoice || {}; S._hhChoice[c.tab_key + '\u0002' + c.key + '\u0001' + c.header] = v; }

// ---------------------------------------------------------------------
// เกณฑ์ 08 · ตั้งค่าคอลัมน์
// ---------------------------------------------------------------------
function hhRefPage(view) {
  const T = S._hh.byKey['08'], vals = T && T.tab.meta ? T.tab.meta.values || [] : [];
  view.innerHTML = hhShell('ref', `<div class="card"><div class="cardhead"><h4>เกณฑ์อ้างอิง (แท็บ 08)</h4>${T && T.tab.meta ? `<span class="muted">อ่านจากชีต ${thDate(T.tab.meta.read_at)}</span>` : ''}</div>${vals.length ? `<div class="tscroll"><table><tbody>${vals.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="muted">ยังไม่มี (ซิงก์กับชีตก่อน)</div>'}</div>`);
}
const HH_ROLE_LABEL = { code: 'รหัส', name: 'ชื่อ', status: 'สถานะ', group: 'กลุ่มหลัก', group2: 'กลุ่มรอง', tambon: 'ตำบล', lat: 'ละติจูด', lng: 'ลองจิจูด', members: 'สมาชิก', income: 'รายได้รวม', expense: 'รายจ่าย', feed_cost: 'ค่าอาหารสัตว์', fert_cost: 'ค่าปุ๋ย', baseline: 'Baseline', debt_payment: 'ผ่อนหนี้', larvae_need: 'ต้องการหนอน', manure_need: 'ต้องการมูล', income_regularity: 'ความสม่ำเสมอรายได้', income_source: 'แหล่งรายได้', animal: 'ชนิดสัตว์', crop: 'พืช', screen_result: 'สรุปคัดกรอง', round: 'รอบประเมิน', national_id: 'เลขบัตร', phone: 'โทรศัพท์' };
function hhColsPage(view) {
  if (!hhCanAdmin()) return view.innerHTML = hhShell('cols', '<div class="card">เฉพาะ admin</div>');
  const H = S._hh, st = S._hhcol = S._hhcol || { tab: '01' }, T = H.byKey[st.tab];
  view.innerHTML = hhShell('cols', `<div class="card"><div class="cardhead"><h4>ตั้งค่าคอลัมน์</h4><select style="width:auto" onchange="S._hhcol.tab=this.value;render()">${Object.values(H.byKey).filter(t => t.tab.kind !== 'reference').map(t => `<option value="${t.tab.tab_key}" ${t.tab.tab_key === st.tab ? 'selected' : ''}>${t.tab.tab_key} ${esc(t.tab.label)}</option>`).join('')}</select></div>
    <div class="muted">ระบบสร้างรายชื่อคอลัมน์จากหัวตารางของชีตทุกครั้งที่ซิงก์ (ทีมเพิ่ม/ย้ายคอลัมน์ในชีตได้) · "บทบาท" ใช้ในสถิติ แผนที่ และตัวกรอง — ถ้าเปลี่ยนชื่อหัวคอลัมน์ในชีต ให้ตั้งบทบาทใหม่ที่นี่ · "แสดงในตาราง" = คอลัมน์ในหน้ารายการ · "ส่วนบุคคล" = ปิดบังในตาราง</div>
    <div class="tscroll"><table><thead><tr><th>#</th><th>หัวคอลัมน์</th><th>สูตร</th><th>บทบาท</th><th>แสดงในตาราง</th><th>ส่วนบุคคล</th></tr></thead><tbody>${(T ? T.cols : []).map(c => `<tr><td>${c.col_index}</td><td>${esc(c.header)}</td><td>${c.is_formula ? 'ⓕ' : ''}</td><td><select onchange="hhColSet('${c.id}','role',this.value||null)"><option value="">—</option>${Object.entries(HH_ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${c.role === k ? 'selected' : ''}>${l}</option>`).join('')}${c.role && !HH_ROLE_LABEL[c.role] ? `<option selected>${esc(c.role)}</option>` : ''}</select></td><td><input type="checkbox" ${c.in_list ? 'checked' : ''} onchange="hhColSet('${c.id}','in_list',this.checked)"></td><td><input type="checkbox" ${c.sensitive ? 'checked' : ''} onchange="hhColSet('${c.id}','sensitive',this.checked)"></td></tr>`).join('') || '<tr><td colspan="6" class="muted">ยังไม่มี (ซิงก์กับชีตก่อน)</td></tr>'}</tbody></table></div></div>`);
}
async function hhColSet(id, k, v) { try { await api.update('hh.col', id, { [k]: v }); await hhLoad(true); toast('บันทึกแล้ว'); } catch (e) { fail(e); } }
