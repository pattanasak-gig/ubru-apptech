/* =====================================================================
   UBRU AppTech System — hh-map.js  แผนที่ครัวเรือน + เส้นทางถึงศูนย์ + รูปครัวเรือน (DEC-126)
   Gig 4 พ.ย. 2569: จุดศูนย์ = ฟาร์มศูนย์ในระบบ (1A) · แสดงทั้งระยะตามถนนและเส้นตรง (2C)
     สีของจุดเลือกได้หลายเกณฑ์และปรับได้ (HH_CM) · รูปโรงเรือน/ผลิตภัณฑ์ 3 รูปต่อครัวเรือน (admin + ผู้บันทึกที่สังกัดโครงการ · ไม่ซิงก์ลงชีต)
   ข้อมูล: hh.route (ระยะ/เส้นทางที่คำนวณแล้ว) · hh.photo (รูป) — sql/022 · คำนวณเส้นทางด้วย OSRM ตอนกดปุ่มเท่านั้น (≤1 คำขอ/วินาที)
   โหลดโดย food/index.html หลัง hh.js (ฟังก์ชัน hhMap ในไฟล์นี้แทนของเดิม)
   ===================================================================== */
const HH_LEVEL_COLORS = { 1: '#C5E1A5', 2: '#7CB342', 3: '#388E3C', 4: '#1B5E20' };
const HH_NONE = '#9E9E9E';
// จุดศูนย์: ฟาร์มของโครงการของไฟล์ครัวเรือนที่มีพิกัด (ชื่อมีคำว่า "ศูนย์" ก่อน)
function hhCenter() {
  const pj = S._hh.link.project_id;
  const fs = (S.farms || []).filter(f => f.project_id === pj && f.status !== 'inactive' && f.lat != null && f.lng != null);
  const f = fs.find(x => /ศูนย์/.test(x.name)) || fs[0];
  return f ? { lat: +f.lat, lng: +f.lng, name: f.name } : null;
}
// ระยะเส้นตรง (เมตร) สูตรฮาเวอร์ไซน์ รัศมีโลก 6,371 กม.
function hhLine(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180, dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const hhPos = r => { const H = S._hh, la = hhNumv(H.roleVal(r, '01', 'lat')), lo = hhNumv(H.roleVal(r, '01', 'lng')); return isNaN(la) || isNaN(lo) ? null : { lat: la, lng: lo }; };
const hhSame = (a, b) => Math.abs(a - b) < 5e-7;
// ต้องคำนวณใหม่เมื่อยังไม่มี หรือพิกัดบ้าน/ศูนย์เปลี่ยน
const HH_ROUTE_SRC = 'osrm_full';   // เส้นทางเต็มตามถนน (รุ่นแรกเก็บแบบย่อ 'osrm' ซึ่งลากตัดมุม → คำนวณใหม่)
function hhRouteStale(code, p, c) { const rt = (S._hh.routes || {})[code]; return !rt || rt.source !== HH_ROUTE_SRC || !hhSame(+rt.from_lat, p.lat) || !hhSame(+rt.from_lng, p.lng) || !hhSame(+rt.to_lat, c.lat) || !hhSame(+rt.to_lng, c.lng); }

// ---------------------------------------------------------------------
// เกณฑ์สีของจุด (ปรับหรือเพิ่มได้ที่นี่ที่เดียว) · ค่าอ่านผ่าน "บทบาทคอลัมน์" (ตั้งค่าคอลัมน์) จึงไม่ผูกกับชื่อหัวคอลัมน์ในชีต
//   type: cat = ตามค่า · level = ระดับ 1–4 (สีเขียวอ่อน→เข้ม)
// ---------------------------------------------------------------------
const hhRoundNo = v => { const m = String(v ?? '').match(/\d+/); return m ? +m[0] : 0; };
// แถวแท็บ 07 ของครัวเรือนตามรอบที่เลือก ('' = รอบล่าสุด)
function hh07(code, round) {
  const H = S._hh, T = H.byKey['07']; if (!T) return null;
  const rs = T.rows.filter(r => r.hh_code === code); if (!rs.length) return null;
  if (round) return rs.find(r => String(H.roleVal(r, '07', 'round') ?? '').trim() === round) || null;
  return rs.slice().sort((a, b) => hhRoundNo(H.roleVal(b, '07', 'round')) - hhRoundNo(H.roleVal(a, '07', 'round')) || String(H.roleVal(b, '07', 'assess_date') ?? '').localeCompare(String(H.roleVal(a, '07', 'assess_date') ?? '')))[0];
}
// คะแนนมิติที่ตั้งบทบาทไว้ (dim1–dim3) · ครบ = ทุกมิติที่ตั้งบทบาทมีคะแนน
const hhDimKeys = () => ['dim1', 'dim2', 'dim3'].filter(k => S._hh.role('07', k));
const hhDims = r => { const ks = hhDimKeys(); if (!r || !ks.length) return null; const v = ks.map(k => hhNumv(S._hh.roleVal(r, '07', k))); return v.every(n => !isNaN(n)) ? v : null; };
const hhLast = (code, tab) => { const T = S._hh.byKey[tab]; if (!T) return null; const rs = T.rows.filter(r => r.hh_code === code); return rs[rs.length - 1] || null; };
const HH_CM = [
  { key: 'group', label: 'กลุ่มหลัก (A/B/C)', type: 'cat', colors: HH_COLORS, get: code => { const r = S._hh.reg.find(x => x.hh_code === code); return r ? String(S._hh.roleVal(r, '01', 'group') ?? '').trim() : ''; } },
  { key: 'screen', label: 'ผลคัดกรองนวัตกร (แท็บ 06)', type: 'cat', get: code => { const r = hhLast(code, '06'); return r ? String(S._hh.roleVal(r, '06', 'screen_result') ?? '').trim() : ''; } },
  { key: 'lv_max', label: 'ระดับนวัตกรรายคน: ค่าสูงสุด 3 มิติ (แท็บ 07)', type: 'level', round: true, get: (code, st) => { const d = hhDims(hh07(code, st.round)); return d ? Math.max(1, Math.min(4, Math.floor(Math.max(...d)))) : ''; }, note: 'ตามสไลด์ Progress 6M: นับระดับสูงสุดที่แสดงออกจริง (DEC-133)' },
  { key: 'lv_avg', label: 'ระดับนวัตกร: ค่าเฉลี่ย 3 มิติ (แท็บ 07)', type: 'level', round: true, get: (code, st) => { const d = hhDims(hh07(code, st.round)); return d ? Math.max(1, Math.min(4, Math.floor(d.reduce((a, b) => a + b, 0) / d.length))) : ''; }, note: 'ค่าเฉลี่ยของคะแนนมิติ 1–3 (คะแนน 1–4) ปัดลงเป็นระดับ · ต้องมีคะแนนครบทุกมิติที่ตั้งบทบาทคอลัมน์ไว้' },
  { key: 'lv_min', label: 'ระดับนวัตกร: มิติที่ต่ำสุด (แท็บ 07)', type: 'level', round: true, get: (code, st) => { const d = hhDims(hh07(code, st.round)); return d ? Math.max(1, Math.min(4, Math.floor(Math.min(...d)))) : ''; }, note: 'ใช้คะแนนมิติที่ต่ำที่สุดเป็นระดับ (เกณฑ์เข้ม: ต้องผ่านทุกมิติ)' },
  ...[1, 2, 3].filter(i => !S._hh || S._hh.role('07', 'dim' + i)).map(i => ({ key: 'dim' + i, label: `มิติ ${i} (แท็บ 07)`, type: 'level', round: true, get: (code, st) => { const r = hh07(code, st.round); const n = r ? hhNumv(S._hh.roleVal(r, '07', 'dim' + i)) : NaN; return isNaN(n) ? '' : Math.max(1, Math.min(4, Math.floor(n))); } })),
  { key: 'round', label: 'รอบการประเมินล่าสุด (แท็บ 07)', type: 'cat', get: code => { const r = hh07(code, ''); return r ? String(S._hh.roleVal(r, '07', 'round') ?? '').trim() : ''; } },
  { key: 'col', label: 'คอลัมน์อื่น…', type: 'auto' }
];
// คอลัมน์ที่เลือกได้ในโหมด "คอลัมน์อื่น" (ไม่รวมคอลัมน์ข้อมูลส่วนบุคคลและพิกัด)
function hhColChoices() {
  const H = S._hh, out = [];
  for (const k of ['01', '06', '07', '09']) { const T = H.byKey[k]; if (!T) continue; for (const c of T.cols) if (!c.sensitive && !['lat', 'lng', 'code', 'name', 'national_id', 'phone'].includes(c.role)) out.push({ v: k + '|' + c.header, l: `${T.tab.label} · ${c.header}` }); }
  return out;
}
function hhColValue(code, st) {
  const [k, h] = String(st.col || '').split('|'); if (!k || !h) return '';
  const r = k === '01' ? S._hh.reg.find(x => x.hh_code === code) : k === '07' ? hh07(code, st.round) : hhLast(code, k);
  return r ? String((r.data || {})[h] ?? '').trim() : '';
}
// คำนวณค่า + สีของทุกครัวเรือนตามเกณฑ์ที่เลือก · คืน { val(code), color(code), legend:[{label,color,n}] }
function hhColoring(codes, st) {
  const m = HH_CM.find(x => x.key === st.cm) || HH_CM[0];
  const raw = Object.fromEntries(codes.map(c => [c, m.key === 'col' ? hhColValue(c, st) : m.get(c, st)]));
  let colorOf, legend;
  const vals = Object.values(raw).filter(v => v !== '' && v != null);
  const nums = vals.map(v => hhNumv(v)), allNum = vals.length && nums.every(n => !isNaN(n));
  if (m.type === 'level' || (m.type === 'auto' && allNum && new Set(nums).size <= 4 && nums.every(n => n >= 1 && n <= 4 && Number.isInteger(n)))) {
    colorOf = v => (v === '' ? HH_NONE : HH_LEVEL_COLORS[Math.max(1, Math.min(4, Math.floor(hhNumv(v))))] || HH_NONE);
    legend = [1, 2, 3, 4].map(l => ({ label: 'ระดับ ' + l, color: HH_LEVEL_COLORS[l], n: vals.filter(v => Math.floor(hhNumv(v)) === l).length }));
  } else if (m.type === 'auto' && allNum && new Set(nums).size > 8) {   // ตัวเลขต่อเนื่อง → 4 ช่วงเท่ากัน
    const lo = Math.min(...nums), hi = Math.max(...nums), w = (hi - lo) / 4 || 1, bin = n => Math.min(3, Math.floor((n - lo) / w));
    colorOf = v => (v === '' ? HH_NONE : HH_LEVEL_COLORS[bin(hhNumv(v)) + 1]);
    legend = [0, 1, 2, 3].map(b => ({ label: `${fmt(lo + b * w, 1)}–${fmt(b === 3 ? hi : lo + (b + 1) * w, 1)}`, color: HH_LEVEL_COLORS[b + 1], n: nums.filter(n => bin(n) === b).length }));
  } else {   // ตามค่า: 8 ค่าที่พบบ่อยที่สุด + อื่น ๆ
    const cnt = {}; for (const v of vals) cnt[v] = (cnt[v] || 0) + 1;
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(e => e[0]);
    const pal = {}; top.forEach((v, i) => { pal[v] = (m.colors && m.colors[v]) || PALETTE[i % PALETTE.length]; });
    colorOf = v => (v === '' ? HH_NONE : pal[v] || '#455A64');
    legend = top.map(v => ({ label: v, color: pal[v], n: cnt[v] }));
    const other = vals.filter(v => !pal[v]).length; if (other) legend.push({ label: 'อื่น ๆ', color: '#455A64', n: other });
  }
  const none = codes.length - vals.length; if (none) legend.push({ label: m.type === 'level' ? 'ยังไม่ได้รับเลือก/ไม่มีข้อมูล' : 'ไม่มีข้อมูล', color: HH_NONE, n: none });
  return { m, val: c => raw[c] ?? '', color: c => colorOf(raw[c] ?? ''), legend };
}

// ---------------------------------------------------------------------
// แผนที่ครัวเรือน
// ---------------------------------------------------------------------
const HH_MAP_KEY = 'hhMapState';
function hhMapState() {
  if (!S._hhm) { let saved = {}; try { saved = JSON.parse(localStorage.getItem(HH_MAP_KEY) || '{}') || {}; } catch (e) { saved = {}; } S._hhm = { group: '', tambon: '', cm: 'group', round: '', col: '', routes: false, ...saved }; }
  return S._hhm;
}
function hhMapSet(k, v) { const st = hhMapState(); st[k] = v; try { localStorage.setItem(HH_MAP_KEY, JSON.stringify({ cm: st.cm, round: st.round, col: st.col, routes: st.routes })); } catch (e) { /* เบราว์เซอร์ปิดที่เก็บข้อมูล */ } render(); }
function hhMap(view) {
  const H = S._hh, st = hhMapState(), c = hhCenter();
  const rows = H.reg.filter(r => (!st.group || String(H.roleVal(r, '01', 'group') ?? '') === st.group) && (!st.tambon || String(H.roleVal(r, '01', 'tambon') ?? '') === st.tambon));
  const uniq = role => [...new Set(H.reg.map(r => String(H.roleVal(r, '01', role) ?? '').trim()).filter(Boolean))].sort();
  const col = hhColoring(rows.map(r => r.hh_code), st), cm = col.m;
  const rounds = H.byKey['07'] ? [...new Set(H.byKey['07'].rows.map(r => String(H.roleVal(r, '07', 'round') ?? '').trim()).filter(Boolean))].sort((a, b) => hhRoundNo(a) - hhRoundNo(b)) : [];
  const hasRoutes = H.routes !== null && H.routes !== undefined;
  const todo = c && hasRoutes ? rows.filter(r => { const p = hhPos(r); return p && hhRouteStale(r.hh_code, p, c); }) : [];
  const info = d => ({ road: d && d.road_m != null ? d.road_m / 1000 : null, min: d && d.road_s != null ? d.road_s / 60 : null });
  const sel = (label, k, opts, cur) => `<select aria-label="${esc(label)}" style="width:auto;max-width:100%" onchange="hhMapSet('${k}',this.value)">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const distQ = qBtn('ระยะทางถึงศูนย์', `<p>ปลายทาง: ${c ? esc(c.name) + ` (${fmt(c.lat, 6)}, ${fmt(c.lng, 6)})` : 'ยังไม่มีพิกัดศูนย์'}</p><p>ระยะตามถนน = เส้นทางรถยนต์ที่สั้นที่สุดตามข้อมูลถนน OpenStreetMap (บริการ OSRM) เที่ยวเดียวจากบ้านถึงศูนย์ พร้อมเวลาขับรถโดยประมาณ</p><p>ระยะเส้นตรง = ระยะทางบนผิวโลกระหว่างสองพิกัด (สูตรฮาเวอร์ไซน์) ใช้เทียบความใกล้–ไกล</p><p>ระบบคำนวณเฉพาะเมื่อกดปุ่ม "คำนวณเส้นทาง" แล้วเก็บผลไว้ ครัวเรือนที่พิกัดเปลี่ยนหลังซิงก์จะขึ้นรายการให้คำนวณใหม่</p>`);
  const colorQ = qBtn('สีของจุด', `<p>เลือกเกณฑ์สีได้จากช่อง "สีตาม" · ระดับ 1–4 ใช้สีเขียวอ่อนถึงเข้ม · สีเทา = ยังไม่ได้รับเลือกหรือไม่มีข้อมูล</p>${cm.note ? `<p>${esc(cm.note)}</p>` : ''}<p>เกณฑ์ที่อ่านจากแท็บ 07 เลือกรอบการประเมินได้ (ค่าเริ่มต้น = รอบล่าสุดของแต่ละครัวเรือน)</p><p>"คอลัมน์อื่น…" ใช้คอลัมน์ใดก็ได้ของแท็บ 01 06 07 09 (ไม่รวมข้อมูลส่วนบุคคล) · ถ้าหัวคอลัมน์ในชีตเปลี่ยน ให้ตั้งบทบาทคอลัมน์ใหม่ที่ "ตั้งค่าคอลัมน์" โดยไม่ต้องแก้โปรแกรม</p>`);
  view.innerHTML = hhShell('map', `<div class="card">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        ${sel('กรองตามกลุ่ม', 'group', [['', 'ทุกกลุ่ม'], ...uniq('group').map(g => [g, 'กลุ่ม ' + g])], st.group)}
        ${sel('กรองตามตำบล', 'tambon', [['', 'ทุกตำบล'], ...uniq('tambon').map(g => [g, 'ต.' + g])], st.tambon)}
        <label style="margin:0">สีตาม ${sel('เกณฑ์สีของจุด', 'cm', HH_CM.map(x => [x.key, x.label]), cm.key)}</label>${colorQ}
        ${cm.round || (cm.key === 'col' && String(st.col).startsWith('07|')) ? sel('รอบการประเมิน', 'round', [['', 'รอบล่าสุด'], ...rounds.map(r => [r, r])], st.round) : ''}
        ${cm.key === 'col' ? sel('คอลัมน์ที่ใช้กำหนดสี', 'col', [['', '— เลือกคอลัมน์ —'], ...hhColChoices().map(x => [x.v, x.l])], st.col) : ''}
      </div>
      <div class="legend" style="margin-top:8px">${col.legend.map(l => `<span><i class="dot" style="background:${l.color}"></i>${esc(String(l.label))} (${fmtInt(l.n)})</span>`).join('')}<span><i class="dot" style="background:#C62828;border-radius:3px"></i>ศูนย์</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
        <label class="chk" style="margin:0"><input type="checkbox" ${st.routes ? 'checked' : ''} onchange="hhMapSet('routes',this.checked)"> แสดงเส้นทางทุกครัวเรือนไปศูนย์</label>${distQ}
        ${hasRoutes && c && todo.length && canWrite() ? `<button class="small secondary" onclick="hhRouteCalc()">คำนวณเส้นทาง (${fmtInt(todo.length)} ครัวเรือน)</button>` : ''}
        ${!hasRoutes ? '<span class="muted">ฐานข้อมูลยังไม่มีส่วนเส้นทาง (sql/022)</span>' : !c ? '<span class="muted">ยังไม่มีพิกัดศูนย์: ใส่พิกัดฟาร์มศูนย์ที่ จัดการ → ฟาร์ม</span>' : ''}
      </div></div>
    <div id="map"></div><div class="muted" id="hhMapNote" style="margin-top:6px"></div>
    <div class="card" style="margin-top:12px"><div class="cardhead"><h4>ระยะทางจากครัวเรือนถึงศูนย์ (${fmtInt(rows.length)})</h4><button class="small secondary" onclick="exportCsv(S._hhDistCsv,'ระยะทางครัวเรือน')">ส่งออก CSV</button></div><div id="hhDist"></div></div>`);
  // แผนที่: ศูนย์ · จุดครัวเรือน · เส้นทาง (ชั้นแยก เปิด/ปิดได้)
  const map = L.map('map'); addBaseLayer(map); const g = L.featureGroup().addTo(map), rl = L.featureGroup(); let miss = 0; S._hhMarkers = {};
  if (c) L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#C62828', fillOpacity: 1, pane: 'markerPane' }).bindTooltip(esc(c.name), { direction: 'top', offset: [0, -8] }).bindPopup(`<b>${esc(c.name)}</b><br>จุดปลายทางของทุกเส้นทาง`).addTo(g);
  for (const r of rows) {
    const p = hhPos(r); if (!p) { miss++; continue; }
    const code = r.hh_code, clr = col.color(code), d = (H.routes || {})[code];
    if (st.routes && d && d.path && d.path.coordinates && d.source === HH_ROUTE_SRC) { hhDrawRoute(rl, d.path, p, c, clr === HH_NONE ? '#607D8B' : clr, 3); }
    else if (st.routes && c) L.polyline([[p.lat, p.lng], [c.lat, c.lng]], { color: '#90A4AE', weight: 1.5, dashArray: '4 6' }).addTo(rl);   // ยังไม่คำนวณ: เส้นประ (เส้นตรง)
    S._hhMarkers[code] = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 1.5, fillColor: clr, fillOpacity: .95 }).bindPopup(() => hhPopup(r, col, c), { maxWidth: 300 }).addTo(g);
  }
  if (st.routes) rl.addTo(map);
  fitAll(map, g);
  $('#hhMapNote').textContent = `แสดง ${rows.length - miss} ครัวเรือน${miss ? ` · ${miss} ครัวเรือนยังไม่มีพิกัด` : ''}${st.routes ? ' · เส้นทึบ = ตามถนน · เส้นประ = ยังไม่ได้คำนวณ (แสดงเส้นตรง) · เส้นจุดสั้น = ช่วงจากถนนถึงพิกัดบ้าน/ศูนย์' : ''} · แผนที่นี้แสดงเฉพาะในเมนูครัวเรือน AppTech`;
  // ตารางระยะทาง (เรียงตามระยะตามถนน)
  const T = rows.map(r => { const p = hhPos(r), d = info((H.routes || {})[r.hh_code]); return { r, p, ...d, line: p && c ? hhLine(p, c) / 1000 : null, stale: p && c && hasRoutes ? hhRouteStale(r.hh_code, p, c) : false, photos: ((H.photos || {})[r.hh_code] || []).length }; })
    .sort((a, b) => (a.road ?? a.line ?? 1e9) - (b.road ?? b.line ?? 1e9));
  const km = v => (v == null ? '-' : fmt(v, 1));
  const withRoad = T.filter(x => x.road != null && !x.stale).map(x => x.road).sort((a, b) => a - b);
  const med = withRoad.length ? (withRoad.length % 2 ? withRoad[(withRoad.length - 1) / 2] : (withRoad[withRoad.length / 2 - 1] + withRoad[withRoad.length / 2]) / 2) : null;
  S._hhDistCsv = T.map(x => ({ รหัส: x.r.hh_code, ชื่อ: H.roleVal(x.r, '01', 'name') || '', กลุ่ม: H.roleVal(x.r, '01', 'group') || '', ตำบล: H.roleVal(x.r, '01', 'tambon') || '', [cm.key === 'col' ? (String(st.col).split('|')[1] || 'ค่า') : cm.label]: col.val(x.r.hh_code), ระยะตามถนน_กม: x.road == null ? '' : +x.road.toFixed(2), เวลาขับรถ_นาที: x.min == null ? '' : Math.round(x.min), ระยะเส้นตรง_กม: x.line == null ? '' : +x.line.toFixed(2), ต้องคำนวณใหม่: x.stale ? 'ใช่' : '', จำนวนรูป: x.photos }));
  $('#hhDist').innerHTML = `<div class="muted" style="margin-bottom:6px">${withRoad.length ? `ตามถนน: เฉลี่ย ${km(withRoad.reduce((a, b) => a + b, 0) / withRoad.length)} กม. · มัธยฐาน ${km(med)} กม. · ใกล้สุด ${km(withRoad[0])} · ไกลสุด ${km(withRoad[withRoad.length - 1])} กม. (${fmtInt(withRoad.length)} ครัวเรือน)` : 'ยังไม่มีระยะตามถนน กด "คำนวณเส้นทาง"'}</div>
    <div class="tscroll"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>กลุ่ม</th><th>ตำบล</th><th>${esc(cm.key === 'col' ? (String(st.col).split('|')[1] || 'ค่า') : cm.label.replace(/ \(แท็บ.*\)$/, ''))}</th><th class="num">ตามถนน (กม.)</th><th class="num">เวลา (นาที)</th><th class="num">เส้นตรง (กม.)</th><th class="num">รูป</th><th></th></tr></thead><tbody>
    ${T.map(x => `<tr><td class="nowrap"><a href="#hh/h/${encodeURIComponent(x.r.hh_code)}">${esc(x.r.hh_code)}</a></td><td>${esc(H.roleVal(x.r, '01', 'name') || '')}</td><td>${esc(H.roleVal(x.r, '01', 'group') || '')}</td><td>${esc(H.roleVal(x.r, '01', 'tambon') || '')}</td><td><i class="dot" style="background:${col.color(x.r.hh_code)}"></i> ${esc(String(col.val(x.r.hh_code) || '-'))}</td><td class="num">${km(x.road)}${x.stale && x.road != null ? ' <span title="ต้องคำนวณเส้นทางใหม่" style="color:var(--warn)">*</span>' : ''}</td><td class="num">${x.min == null ? '-' : fmtInt(x.min)}</td><td class="num">${km(x.line)}</td><td class="num">${fmtInt(x.photos)}</td><td>${x.p ? `<button class="small secondary" onclick="hhFocus('${esc(x.r.hh_code)}')">ดูบนแผนที่</button>` : '<span class="muted">ไม่มีพิกัด</span>'}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">ไม่มีครัวเรือนตามตัวกรอง</td></tr>'}
    </tbody></table></div>${T.some(x => x.stale && x.road != null) ? '<div class="muted">* ต้องคำนวณเส้นทางใหม่ (พิกัดบ้านหรือศูนย์เปลี่ยน หรือเป็นเส้นทางรุ่นแรกที่เก็บรูปเส้นแบบย่อ) · ระยะทางที่แสดงยังถูกต้อง · กด "คำนวณเส้นทาง" เพื่อให้เส้นบนแผนที่ตรงตามถนน</div>' : ''}`;
}
// เส้นทางตามถนน + เส้นจุดเชื่อมจากจุดที่ OSRM จับลงถนน ไปยังพิกัดจริงของบ้านและศูนย์
function hhDrawRoute(layer, path, p, c, color, weight) {
  L.geoJSON(path, { style: { color, weight, opacity: .8 } }).addTo(layer);
  const cs = path.coordinates; if (!cs || cs.length < 2) return;
  const a = cs[0], b = cs[cs.length - 1], dot = { color: '#607D8B', weight: 1.5, dashArray: '2 4', opacity: .9 };
  if (p) L.polyline([[p.lat, p.lng], [a[1], a[0]]], dot).addTo(layer);
  if (c) L.polyline([[b[1], b[0]], [c.lat, c.lng]], dot).addTo(layer);
}
// แผนที่ในหน้าข้อมูลครัวเรือน: บ้าน + ศูนย์ + เส้นทางตามถนน (ถ้าคำนวณแล้ว) · ซูมพอดีทั้งเส้น
function hhMiniMap(reg, p) {
  const H = S._hh, c = hhCenter(), d = (H.routes || {})[reg.hh_code], m = L.map('hhMini'); addBaseLayer(m);
  const g = L.featureGroup().addTo(m), clr = HH_COLORS[String(H.roleVal(reg, '01', 'group') ?? '')] || '#455A64';
  if (c && d && d.path && d.path.coordinates && d.source === HH_ROUTE_SRC) hhDrawRoute(g, d.path, p, c, '#1F3A5F', 4);
  if (c) L.circleMarker([c.lat, c.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#C62828', fillOpacity: 1 }).bindTooltip(esc(c.name), { direction: 'top', offset: [0, -8] }).addTo(g);
  L.circleMarker([p.lat, p.lng], { radius: 10, color: '#fff', weight: 2, fillColor: clr, fillOpacity: .95 }).bindTooltip(esc(reg.hh_code), { direction: 'top', offset: [0, -8] }).addTo(g);
  if (c) m.fitBounds(g.getBounds().pad(0.12)); else m.setView([p.lat, p.lng], 16);
  const note = $('#hhMiniNote'); if (note && c) note.textContent = `ถึง${c.name}: ${d && d.road_m != null && d.source === HH_ROUTE_SRC ? `ตามถนน ${fmt(d.road_m / 1000, 1)} กม. · ประมาณ ${fmtInt(d.road_s / 60)} นาที · ` : ''}เส้นตรง ${fmt(hhLine(p, c) / 1000, 1)} กม.${d && d.source === HH_ROUTE_SRC ? '' : ' · ยังไม่ได้คำนวณเส้นทางตามถนน (กดที่แผนที่ครัวเรือน)'}`;
}
function hhFocus(code) { const m = (S._hhMarkers || {})[code]; if (!m) return; $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); m._map.setView(m.getLatLng(), 15); m.openPopup(); }
function hhPopup(r, col, c) {
  const H = S._hh, code = r.hh_code, d = (H.routes || {})[code], p = hhPos(r), ps = ((H.photos || {})[code] || []);
  const lineKm = p && c ? hhLine(p, c) / 1000 : null;
  return `<b>${esc(code)}</b> ${esc(H.roleVal(r, '01', 'name') || '')}<br>กลุ่ม ${esc(H.roleVal(r, '01', 'group') || '-')} · ต.${esc(H.roleVal(r, '01', 'tambon') || '-')}<br>${esc(col.m.key === 'col' ? 'ค่า' : col.m.label.replace(/ \(แท็บ.*\)$/, ''))}: <b>${esc(String(col.val(code) || '-'))}</b>
    <br>ถึงศูนย์: ${d && d.road_m != null ? `ตามถนน ${fmt(d.road_m / 1000, 1)} กม. · ${fmtInt(d.road_s / 60)} นาที · ` : ''}เส้นตรง ${lineKm == null ? '-' : fmt(lineKm, 1)} กม.
    ${ps.length ? `<div class="photos" style="margin-top:6px">${ps.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt="${esc(x.caption || 'รูปของครัวเรือน ' + code)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px" onerror="photoMissing(this)"></a>`).join('')}</div>` : ''}
    <div style="margin-top:6px"><a href="#hh/h/${encodeURIComponent(code)}">เปิดข้อมูลครัวเรือน ›</a></div>`;
}
// คำนวณเส้นทางตามถนน (OSRM) ทีละครัวเรือน ห่างกัน 1.1 วินาที ตามเงื่อนไขของบริการสาธิต แล้วเก็บผล
async function hhRouteCalc() {
  const H = S._hh, c = hhCenter(); if (!c) return toastErr('ยังไม่มีพิกัดศูนย์', 'ใส่พิกัดฟาร์มศูนย์ที่ จัดการ → ฟาร์ม');
  const st = hhMapState();
  const todo = H.reg.filter(r => (!st.group || String(H.roleVal(r, '01', 'group') ?? '') === st.group) && (!st.tambon || String(H.roleVal(r, '01', 'tambon') ?? '') === st.tambon)).map(r => ({ r, p: hhPos(r) })).filter(x => x.p && hhRouteStale(x.r.hh_code, x.p, c));
  if (!todo.length) return toast('เส้นทางเป็นปัจจุบันแล้ว');
  if (!confirm(`คำนวณเส้นทางตามถนน ${todo.length} ครัวเรือน ใช้เวลาประมาณ ${Math.ceil(todo.length * 1.2)} วินาที\nระหว่างนี้อย่าปิดหน้านี้`)) return;
  let ok = 0, bad = 0;
  for (const [i, x] of todo.entries()) {
    toast(`กำลังคำนวณเส้นทาง ${i + 1}/${todo.length} (${x.r.hh_code})`);
    const rec = { project_id: H.link.project_id, hh_code: x.r.hh_code, from_lat: +x.p.lat.toFixed(6), from_lng: +x.p.lng.toFixed(6), to_lat: +c.lat.toFixed(6), to_lng: +c.lng.toFixed(6), line_m: Math.round(hhLine(x.p, c) * 10) / 10, road_m: null, road_s: null, path: null, source: HH_ROUTE_SRC, computed_at: new Date().toISOString(), note: null };
    try {
      const res = await fetch(`${CONFIG.ROUTING_URL}/route/v1/driving/${x.p.lng},${x.p.lat};${c.lng},${c.lat}?overview=full&geometries=geojson&steps=false`);
      if (!res.ok) throw new Error('บริการเส้นทาง OSRM ตอบ ' + res.status);
      const j = await res.json(); if (j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error('บริการเส้นทาง OSRM หาเส้นทางไม่ได้: ' + (j.message || j.code));
      Object.assign(rec, { road_m: Math.round(j.routes[0].distance * 10) / 10, road_s: Math.round(j.routes[0].duration), path: j.routes[0].geometry }); ok++;
    } catch (e) { rec.note = String(e.message || e).slice(0, 200); bad++; }
    try { const old = (H.routes || {})[x.r.hh_code]; if (old) await api.update('hh.route', old.id, rec); else await api.insert('hh.route', rec); } catch (e) { bad++; console.warn('save route failed', x.r.hh_code, e); }
    if (i < todo.length - 1) await new Promise(r => setTimeout(r, 1100));
  }
  await hhLoad(true); render();
  toast(`คำนวณเส้นทางแล้ว ${ok} ครัวเรือน${bad ? ` · ไม่สำเร็จ ${bad} (เก็บระยะเส้นตรงไว้ ลองกดอีกครั้งภายหลัง)` : ''}`, !!bad);
}

// ---------------------------------------------------------------------
// รูปโรงเรือนและผลิตภัณฑ์ของครัวเรือน (สูงสุด 3 รูป) — แสดงในหน้าข้อมูลครัวเรือนและป๊อปอัปแผนที่
// ---------------------------------------------------------------------
function hhPhotoSection(code) {
  const H = S._hh;
  if (H.photos === null || H.photos === undefined) return '<div class="card"><h4 style="margin-top:0">รูปโรงเรือนและผลิตภัณฑ์</h4><div class="muted">ฐานข้อมูลยังไม่มีส่วนรูปครัวเรือน (sql/022)</div></div>';
  const ps = ((H.photos || {})[code] || []).slice().sort((a, b) => a.seq - b.seq), can = canWrite();
  const q = qBtn('รูปของครัวเรือน', '<p>เก็บรูปโรงเรือน กระบะเลี้ยง และผลิตภัณฑ์ได้ไม่เกิน 3 รูปต่อครัวเรือน รูปแสดงในหน้านี้และในป๊อปอัปเมื่อกดจุดบนแผนที่ครัวเรือน</p><p>รูปเก็บใน Google Drive ของศูนย์ และเปิดดูได้ผ่านลิงก์ หากในรูปมีใบหน้าบุคคลหรือชื่อสถานที่ ควรปิดบังก่อนอัปโหลด</p><p>รูปไม่ถูกซิงก์ลงชีตครัวเรือน</p>');
  const file = (fn, label, cls = 'small') => `<label class="btn ${cls}" style="margin:0;cursor:pointer">${label}<input type="file" accept="image/*" style="display:none" onchange="if(this.files[0])${fn}(this.files[0]);this.value=''"></label>`;
  return `<div class="card"><div class="cardhead"><h4>รูปโรงเรือนและผลิตภัณฑ์ (${ps.length}/3) ${q}</h4>${can && ps.length < 3 ? file(`hhPhotoAdd.bind(null,'${esc(code)}')`, '＋ เพิ่มรูป') : ''}</div>
    ${ps.length ? `<div class="photos">${ps.map(x => `<div style="text-align:center;max-width:180px"><a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt="${esc(x.caption || 'รูปของครัวเรือน ' + code)}" style="width:160px;height:120px;object-fit:cover;border-radius:8px" onerror="photoMissing(this)"></a><div class="muted" style="margin:4px 0">${esc(x.caption || 'ไม่มีคำอธิบาย')}</div>${can ? `<div class="row" style="justify-content:center;gap:4px">${file(`hhPhotoReplace.bind(null,'${x.id}')`, 'แทนที่', 'small secondary')}<button class="small secondary" onclick="hhPhotoCaption('${x.id}')">คำอธิบาย</button><button class="small secondary" onclick="hhPhotoDel('${x.id}')">ลบ</button></div>` : ''}</div>`).join('')}</div>` : '<div class="muted">ยังไม่มีรูป</div>'}</div>`;
}
async function hhPhotoUp(file, code) {
  const H = S._hh, org = orgOf(H.link.org_id);
  const endpoint = org.photo_endpoint_url || setting('default_photo_endpoint_url') || '';
  toast('กำลังส่งรูป…');
  const ph = await compressImage(file);
  return api.uploadPhoto(endpoint, { ...ph, org_code: org.code, label: 'household', filename: `hh_${String(code).replace(/[^\w-]+/g, '_')}_${Date.now()}.jpg` });
}
async function hhPhotoAdd(code, file) {
  try {
    const H = S._hh, used = ((H.photos || {})[code] || []).map(x => x.seq), seq = [1, 2, 3].find(s => !used.includes(s));
    if (!seq) return toastErr('ครัวเรือนนี้มีรูปครบ 3 รูปแล้ว', 'ลบหรือแทนที่รูปเดิมก่อน');
    const up = await hhPhotoUp(file, code);
    await api.insert('hh.photo', { project_id: H.link.project_id, hh_code: code, seq, storage_kind: 'gdrive', file_id: up.file_id, url: up.url, taken_at: new Date().toISOString() });
    toast('เพิ่มรูปแล้ว'); await hhLoad(true); render();
  } catch (e) { fail(e, 'เพิ่มรูปไม่สำเร็จ'); }
}
async function hhPhotoReplace(id, file) {
  try { const x = hhPhotoById(id); if (!x) return; const up = await hhPhotoUp(file, x.hh_code); await api.update('hh.photo', id, { file_id: up.file_id, url: up.url, taken_at: new Date().toISOString() }); toast('แทนที่รูปแล้ว'); await hhLoad(true); render(); }
  catch (e) { fail(e, 'แทนที่รูปไม่สำเร็จ'); }
}
async function hhPhotoCaption(id) {
  const x = hhPhotoById(id); if (!x) return;
  const t = prompt('คำอธิบายรูป (เช่น โรงเรือน กระบะเลี้ยง ผลิตภัณฑ์)', x.caption || ''); if (t === null) return;
  try { await api.update('hh.photo', id, { caption: t.trim() || null }); toast('บันทึกคำอธิบายแล้ว'); await hhLoad(true); render(); } catch (e) { fail(e); }
}
async function hhPhotoDel(id) {
  if (!confirm('ลบรูปนี้ออกจากครัวเรือน? (ไฟล์ใน Google Drive ยังอยู่)')) return;
  try { await api.update('hh.photo', id, { status: 'inactive' }); toast('ลบรูปแล้ว'); await hhLoad(true); render(); } catch (e) { fail(e); }
}
const hhPhotoById = id => Object.values(S._hh.photos || {}).flat().find(x => x.id === id);
