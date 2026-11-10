/* =====================================================================
   UBRU AppTech System — pub-innov.js  หน้าสาธารณะ: นวัตกรชุมชน + ครัวเรือนเป้าหมาย (DEC-135)
   สำหรับผู้บริหาร: กราฟ + แผนที่เป็นหลัก · ระดับปัจจุบันของนวัตกร · รายมิติดูแยก
   ข้อมูลจาก hh.public_innov() (sql/026) ซึ่งปิดบังตาม PDPA ที่ฐานข้อมูลแล้ว:
     ใช้รหัสครัวเรือนแทนชื่อ · ตำแหน่ง = จุดอ้างอิงระดับหมู่บ้าน · แสดงเฉพาะครัวเรือนที่ยินยอม
   โหลดโดย index.html · เส้นทาง #innov (นวัตกร) · #innov/hh (ครัวเรือน)
   ===================================================================== */
const PI_TARGET = { 4: 2, 3: 6, 2: 10, 1: 12 };   // เป้าหมายรายระดับตามรายงานความก้าวหน้า 6 เดือน
const PI_NAME = { 1: 'Co-Ordinator', 2: 'Co-Creator', 3: 'Trainer', 4: 'Change Agent' };
const PI_COL = { 1: '#C5E1A5', 2: '#7CB342', 3: '#388E3C', 4: '#1B5E20' };
const PI_RCOL = ['#90A4AE', '#9CCC65', '#43A047', '#1B5E20', '#0D47A1'];
const PI_DIM = ['มิติ 1 ความรู้และเทคโนโลยี', 'มิติ 2 การจัดกระบวนการเรียนรู้', 'มิติ 3 เครือข่ายความร่วมมือ'];
const piLvl = a => (Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every(v => v != null) ? Math.max(...a.slice(0, 3).map(Number)) : null);
const piChip = v => (v == null ? '<span class="inv-lv none">–</span>' : `<span class="inv-lv l${v}">${v}</span>`);
const piRoundName = n => ({ 1: 'รอบ 1 ก่อนพัฒนา', 2: 'รอบ 2 ระหว่างพัฒนา', 3: 'รอบ 3 ให้ระดับ' }[n] || 'รอบ ' + n);

async function pageInnovPublic(view) {
  let J; try { J = await api.rpc('hh.public_innov', {}); } catch (e) { J = null; }
  if (!J) return view.innerHTML = `<div class="card"><h3 style="margin-top:0">นวัตกรชุมชน</h3><div class="banner warn">ยังเปิดดูไม่ได้ ระบบกำลังเตรียมข้อมูลเผยแพร่</div><a href="#">‹ กลับหน้าหลัก</a></div>`;
  const tab = location.hash.startsWith('#innov/hh') ? 'hh' : 'innov';
  const inv = (J.innov || []).map(x => { const nos = Object.keys(x.rounds || {}).map(Number).filter(n => piLvl(x.rounds[n]) != null).sort((a, b) => a - b), latest = nos.length ? nos[nos.length - 1] : null;
    return { ...x, nos, latest, cur: latest ? piLvl(x.rounds[latest]) : null, base: piLvl((x.rounds || {})[1]) }; });
  const sel = inv.filter(x => x.sel), allRounds = [...new Set(inv.flatMap(x => x.nos))].sort((a, b) => a - b);
  const st = S._pi = S._pi || { rounds: null, tambon: '', lv: 0 }; if (!st.rounds) st.rounds = allRounds.slice();
  S._piData = { J, inv, sel, allRounds };
  const c = J.consent || {}, upd = J.updated ? thDate(J.updated) : '-';
  const pdpa = `<div class="muted" style="font-size:13px;margin-top:8px">ปฏิบัติตาม PDPA: แสดงเฉพาะครัวเรือนที่เจ้าของข้อมูลยินยอม (ยินยอม ${fmtInt(c.yes || 0)} · ไม่ยินยอม ${fmtInt(c.no || 0)} · ยังไม่ระบุ ${fmtInt(c.unknown || 0)} จาก ${fmtInt(c.total || 0)} ครัวเรือน) · ใช้รหัสครัวเรือนแทนชื่อ · จุดบนแผนที่เป็นจุดอ้างอิงระดับหมู่บ้าน (ปัดเศษประมาณ 1 กม.) ไม่ใช่ที่ตั้งบ้าน</div>`;
  const head = `<div class="card"><div class="cardhead"><div><h3 style="margin:0">นวัตกรชุมชนและครัวเรือนเป้าหมาย</h3><div class="muted">${esc(J.project || '')} · ข้อมูล ณ ${esc(upd)}</div></div><a class="small" href="#">‹ หน้าหลัก</a></div>
    <div class="hh-groups" style="margin-top:10px"><a href="#innov" class="${tab === 'innov' ? 'active' : ''}">นวัตกรชุมชน (${fmtInt(sel.length)})</a><a href="#innov/hh" class="${tab === 'hh' ? 'active' : ''}">ครัวเรือนเป้าหมาย (${fmtInt((J.households || []).length)})</a></div>${pdpa}</div>`;
  view.innerHTML = head + (tab === 'innov' ? piInnovHtml(sel, allRounds, st) : piHhHtml(J, inv));
  if (tab === 'innov') piInnovDraw(sel, inv, allRounds, st); else piHhDraw(J, inv);
}

// ---------- นวัตกรชุมชน ----------
function piInnovHtml(sel, allRounds, st) {
  const n = l => sel.filter(x => x.cur === l).length, hi = n(3) + n(4);
  const levelQ = qBtn('ระดับนวัตกรชุมชน', `<p>ประเมิน 3 มิติ แต่ละมิติระดับ 1–4 ตามมาตรฐานกลางของ บพท. · ระดับของนวัตกร = ระดับสูงสุดที่แสดงออกจริงใน 3 มิติ ของรอบประเมินล่าสุด</p><p>${[1, 2, 3, 4].map(l => `${piChip(l)} ${PI_NAME[l]}`).join(' · ')}</p><p>${PI_DIM.join(' · ')}</p>`);
  const tambons = [...new Set(sel.map(x => x.tambon).filter(Boolean))].sort();
  return `<div class="kpis" style="margin-top:12px"><div class="kpi hero"><div class="l">นวัตกรชุมชน</div><div class="v">${fmtInt(sel.length)} คน</div><div class="muted">${fmtInt(tambons.length)} ตำบล${sel.some(x => x.cur == null) ? ` · ยังไม่ประเมิน ${fmtInt(sel.filter(x => x.cur == null).length)} คน` : ''}</div></div>
      ${[4, 3, 2, 1].map(l => `<div class="kpi"><div class="l">${piChip(l)} ${PI_NAME[l]}</div><div class="v">${fmtInt(n(l))} <span class="muted" style="font-size:14px">คน</span></div><div class="muted">เป้าหมาย ${PI_TARGET[l]} คน</div></div>`).join('')}
      <div class="kpi"><div class="l">ระดับ 3–4 รวม</div><div class="v" style="color:${hi >= 8 ? '#2E7D32' : '#C62828'}">${fmtInt(hi)} ${hi >= 8 ? '✓' : ''}</div><div class="muted">เป้าตามสัญญา ≥ 8 คน</div></div></div>
    <div class="grid-dash" style="margin-top:12px">
      <div class="card"><div class="cardhead"><h4>จำนวนนวัตกรแต่ละระดับ เทียบรอบ ${levelQ}</h4></div>
        <div class="lg-chips">${allRounds.map(r => `<button type="button" class="lg-chip ${st.rounds.includes(r) ? 'on' : ''}" onclick="piRound(${r})">${esc(piRoundName(r))}</button>`).join('')}</div>
        <div class="chartbox"><canvas id="piRounds"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>ระดับปัจจุบันรายตำบล</h4></div><div class="chartbox"><canvas id="piTambon"></canvas></div></div></div>
    <div class="card"><div class="cardhead"><h4>แผนที่นวัตกรชุมชน</h4><button class="small secondary" onclick="piDimsAll()">ดูรายมิติทั้งหมด</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><select aria-label="ตำบล" style="width:auto" onchange="S._pi.tambon=this.value;render()"><option value="">ทุกตำบล</option>${tambons.map(t => `<option ${t === st.tambon ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <div class="lg-chips">${[0, 4, 3, 2, 1].map(l => `<button type="button" class="lg-chip ${st.lv === l ? 'on' : ''}" onclick="S._pi.lv=${l};render()">${l ? 'ระดับ ' + l : 'ทุกระดับ'}</button>`).join('')}</div></div>
      <div id="piMap" class="pi-map" style="height:clamp(320px,55vh,560px);border-radius:12px"></div>
      <div class="legend" style="margin-top:6px">${[1, 2, 3, 4].map(l => `<span><i class="dot" style="background:${PI_COL[l]}"></i>ระดับ ${l}</span>`).join('')}<span class="muted">ขนาดจุด = จำนวนนวัตกรในหมู่บ้าน · สี = ระดับสูงสุดในหมู่บ้าน</span></div></div>
    <details class="card"><summary style="cursor:pointer;font-weight:600">รายชื่อนวัตกร (รหัสครัวเรือน)</summary><div class="tscroll" style="margin-top:8px"><table><thead><tr><th>รหัส</th><th>ตำบล</th><th>หมู่</th><th class="num">ระดับปัจจุบัน</th><th>รอบ</th><th></th></tr></thead><tbody>
      ${piFilter(sel, st).sort((a, b) => (b.cur || 0) - (a.cur || 0) || a.code.localeCompare(b.code)).map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.tambon)}</td><td>${esc(x.moo)}</td><td class="num">${piChip(x.cur)}</td><td>${x.latest ? esc(piRoundName(x.latest)) : '–'}</td><td><button class="small secondary" onclick="piDims('${esc(x.code)}')">ดูรายมิติ</button></td></tr>`).join('')}
    </tbody></table></div></details>`;
}
const piFilter = (rows, st) => rows.filter(x => (!st.tambon || x.tambon === st.tambon) && (!st.lv || x.cur === st.lv));
function piRound(r) { const st = S._pi, i = st.rounds.indexOf(r); if (i >= 0) { if (st.rounds.length > 1) st.rounds.splice(i, 1); } else st.rounds.push(r); st.rounds.sort((a, b) => a - b); render(); }
function piInnovDraw(sel, inv, allRounds, st) {
  if (window.Chart) {
    // เทียบรอบ: ทุกคนที่ได้รับการประเมินครบ 3 มิติในรอบนั้น (ระดับรายคน = ค่าสูงสุดของรอบนั้น)
    const ds = st.rounds.map(r => ({ label: piRoundName(r), data: [1, 2, 3, 4].map(l => inv.filter(x => piLvl((x.rounds || {})[r]) === l).length), backgroundColor: PI_RCOL[r] || '#455A64' }));
    ds.push({ label: 'เป้าหมาย', data: [1, 2, 3, 4].map(l => PI_TARGET[l]), backgroundColor: 'rgba(198,40,40,0.06)', borderColor: '#C62828', borderWidth: 2 });   // แท่งโปร่งขอบแดง = เป้าหมายรายระดับ
    mkChart($('#piRounds'), { type: 'bar', data: { labels: [1, 2, 3, 4].map(l => `ระดับ ${l}`), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    const tb = [...new Set(sel.map(x => x.tambon).filter(Boolean))].sort();
    mkChart($('#piTambon'), { type: 'bar', data: { labels: tb.map(t => 'ต.' + t), datasets: [1, 2, 3, 4].map(l => ({ label: 'ระดับ ' + l, data: tb.map(t => sel.filter(x => x.tambon === t && x.cur === l).length), backgroundColor: PI_COL[l] })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
  }
  piMap('piMap', piFilter(sel, st), 'innov');
}
// แผนที่: จุดอ้างอิงระดับหมู่บ้าน (ไม่ใช่ที่ตั้งบ้าน) · หมู่บ้านที่ปัดพิกัดแล้วตรงกันรวมเป็นจุดเดียว · จำกัดการซูมไม่ให้ใกล้เกินระดับหมู่บ้าน
async function piMap(el, rows, kind) {
  if (!window.L || !$('#' + el)) return;
  const J = S._piData.J, vk = (t, m) => t + '|' + m, V = Object.fromEntries((J.villages || []).map(v => [vk(v.tambon, v.moo), v]));
  const map = L.map(el, { maxZoom: 14 }); await addBaseLayer(map); const g = L.featureGroup().addTo(map);
  const pts = {};
  for (const x of rows) { const v = V[vk(x.tambon, x.moo)]; if (!v || v.lat == null) continue; const k = v.lat + ',' + v.lng, P = pts[k] = pts[k] || { lat: v.lat, lng: v.lng, vil: {}, xs: [] }; P.vil[vk(v.tambon, v.moo)] = v; P.xs.push(x); }
  const vName = v => `${v.moo ? 'หมู่ ' + esc(v.moo) + ' ' : ''}ต.${esc(v.tambon)}`;
  for (const P of Object.values(pts)) {
    const xs = P.xs, top = kind === 'innov' ? Math.max(0, ...xs.map(x => x.cur || 0)) : 0, color = kind === 'innov' ? (PI_COL[top] || '#9E9E9E') : '#1F3A5F';
    const html = `<b>${Object.values(P.vil).map(vName).join(' · ')}</b><div class="muted" style="font-size:12px">จุดอ้างอิงระดับหมู่บ้าน ไม่ใช่ที่ตั้งบ้าน</div>` + (kind === 'innov'
      ? `<div style="margin-top:4px">นวัตกร ${xs.length} คน</div>${xs.slice().sort((a, b) => (b.cur || 0) - (a.cur || 0) || a.code.localeCompare(b.code)).map(x => `<div>${esc(x.code)} ${piChip(x.cur)} <a href="javascript:void 0" onclick="piDims('${esc(x.code)}')">รายมิติ ›</a></div>`).join('')}`
      : `<div style="margin-top:4px">ครัวเรือนเป้าหมาย ${xs.length} ครัวเรือน</div><div class="muted" style="font-size:12px">${esc(xs.map(x => x.code).join(', '))}</div>`);
    L.circleMarker([P.lat, P.lng], { radius: Math.min(24, 8 + xs.length * 2), color: '#fff', weight: 2, fillColor: color, fillOpacity: .9 }).bindPopup(html, { maxWidth: 280 }).bindTooltip(`${xs.length}`, { permanent: true, direction: 'center', className: 'pi-count' }).addTo(g);
  }
  if (g.getLayers().length) map.fitBounds(g.getBounds().pad(0.2), { maxZoom: 12 }); else fitAll(map, g);
}
// รายมิติของ 1 คน (ทุกรอบ)
function piDims(code) {
  const x = S._piData.inv.find(y => y.code === code); if (!x) return;
  openModal(`<h3 style="margin-top:0">${esc(code)} · ระดับปัจจุบัน ${piChip(x.cur)}</h3><div class="muted">ต.${esc(x.tambon)}${x.moo ? ' หมู่ ' + esc(x.moo) : ''} · ${x.latest ? esc(piRoundName(x.latest)) : 'ยังไม่ประเมิน'}${x.base != null && x.latest > 1 ? ` · เทียบรอบ 1: ${x.base} → ${x.cur}` : ''}</div><div style="height:260px;margin-top:8px"><canvas id="piDimOne"></canvas></div><div class="row" style="margin-top:10px"><button class="secondary" onclick="closeModal()">ปิด</button></div>`);
  if (window.Chart) mkChart($('#piDimOne'), { type: 'bar', data: { labels: PI_DIM.map((d, i) => 'ม.' + (i + 1)), datasets: x.nos.map(r => ({ label: piRoundName(r), data: x.rounds[r].slice(0, 3).map(Number), backgroundColor: PI_RCOL[r] || '#455A64' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: c => PI_DIM[c[0].dataIndex] } } }, scales: { y: { min: 0, max: 4, ticks: { stepSize: 1 } } } } });
}
// รายมิติทั้งหมด: ระดับเฉลี่ยรายมิติแยกรอบ
function piDimsAll() {
  const { inv, allRounds } = S._piData;
  // จำนวนคนแต่ละระดับ รายมิติ แยกรอบ (รูปแบบเดียวกับตารางในรายงานความก้าวหน้า)
  const dist = (r, i) => { const xs = inv.filter(x => piLvl((x.rounds || {})[r]) != null); return { n: xs.length, c: [1, 2, 3, 4].map(l => xs.filter(x => Number(x.rounds[r][i]) === l).length) }; };
  const tbl = `<div class="tscroll" style="margin-top:10px"><table style="min-width:0;width:100%"><thead><tr><th>รอบ</th><th>มิติ</th>${[1, 2, 3, 4].map(l => `<th class="num">${piChip(l)}</th>`).join('')}<th class="num">รวม (คน)</th></tr></thead><tbody>${allRounds.map(r => [0, 1, 2].map(i => { const d = dist(r, i); return `<tr><td class="nowrap">${i ? '' : 'รอบ ' + r}</td><td class="nowrap" title="${esc(PI_DIM[i])}">ม.${i + 1}</td>${d.c.map(v => `<td class="num">${v || '–'}</td>`).join('')}<td class="num">${fmtInt(d.n)}</td></tr>`; }).join('')).join('')}</tbody></table></div>`;
  openModal(`<h3 style="margin-top:0">รายมิติ แยกรอบ</h3><div class="muted">คิดจากนวัตกรที่ได้รับการประเมินครบ 3 มิติในแต่ละรอบ</div><div class="muted" style="font-size:13px;margin-top:6px">${PI_DIM.map((d, i) => 'ม.' + (i + 1) + ' ' + d.replace(/^มิติ \d /, '')).join(' · ')}</div><h4 style="margin:10px 0 0">จำนวนคนแต่ละระดับ</h4>${tbl}<h4 style="margin:12px 0 0">ระดับเฉลี่ย</h4><div style="height:260px;margin-top:8px"><canvas id="piDimAll"></canvas></div><div class="muted" style="font-size:13px">${PI_DIM.map((d, i) => 'ม.' + (i + 1) + ' ' + d.replace(/^มิติ \d /, '')).join(' · ')}</div><div class="row" style="margin-top:10px"><button class="secondary" onclick="closeModal()">ปิด</button></div>`);
  const avg = (r, i) => { const v = inv.filter(x => piLvl((x.rounds || {})[r]) != null).map(x => Number(x.rounds[r][i])); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : null; };
  if (window.Chart) mkChart($('#piDimAll'), { type: 'bar', data: { labels: PI_DIM.map((d, i) => 'ม.' + (i + 1)), datasets: allRounds.map(r => ({ label: piRoundName(r), data: [0, 1, 2].map(i => avg(r, i)), backgroundColor: PI_RCOL[r] || '#455A64' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: c => PI_DIM[c[0].dataIndex] } } }, scales: { y: { min: 0, max: 4, ticks: { stepSize: 1 } } } } });
}

// ---------- ครัวเรือนเป้าหมาย ----------
function piHhHtml(J, inv) {
  const H = J.households || [], tb = [...new Set(H.map(x => x.tambon).filter(Boolean))].sort();
  const invSet = new Set(inv.filter(x => x.sel).map(x => x.code));
  return `<div class="kpis" style="margin-top:12px"><div class="kpi hero"><div class="l">ครัวเรือนเป้าหมาย</div><div class="v">${fmtInt(H.length)} ครัวเรือน</div><div class="muted">${fmtInt(tb.length)} ตำบล</div></div>
      ${tb.map(t => `<div class="kpi"><div class="l">ต.${esc(t)}</div><div class="v">${fmtInt(H.filter(x => x.tambon === t).length)}</div><div class="muted">นวัตกร ${fmtInt(H.filter(x => x.tambon === t && invSet.has(x.code)).length)} คน</div></div>`).join('')}</div>
    <div class="grid-dash" style="margin-top:12px"><div class="card"><div class="cardhead"><h4>ครัวเรือนรายตำบล แยกกลุ่มเป้าหมาย ${qBtn('กลุ่มเป้าหมาย', '<p>A = ฟาร์มบูรณาการ (เลี้ยงสัตว์หรือทำเกษตรอยู่แล้ว) · B = ผู้ประกอบการชุมชน · C = แหล่งกำเนิดขยะอาหาร</p>')}</h4></div><div class="chartbox"><canvas id="piHhTambon"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>แผนที่ครัวเรือนเป้าหมาย</h4></div><div id="piHhMap" class="pi-map" style="height:clamp(300px,45vh,460px);border-radius:12px"></div><div class="muted" style="font-size:13px;margin-top:4px">ขนาดจุดและตัวเลข = จำนวนครัวเรือนในหมู่บ้าน</div></div></div>
    <details class="card"><summary style="cursor:pointer;font-weight:600">รายการครัวเรือน (รหัส)</summary><div class="tscroll" style="margin-top:8px"><table><thead><tr><th>รหัส</th><th>ตำบล</th><th>หมู่</th><th>กลุ่ม</th><th>นวัตกร</th></tr></thead><tbody>
      ${H.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.tambon)}</td><td>${esc(x.moo)}</td><td>${esc(x.group)}</td><td>${invSet.has(x.code) ? '✓' : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function piHhDraw(J, inv) {
  const H = J.households || [], tb = [...new Set(H.map(x => x.tambon).filter(Boolean))].sort(), gr = [...new Set(H.map(x => x.group).filter(Boolean))].sort(), GC = { A: '#2E7D32', B: '#F9A825', C: '#EF6C00' };
  if (window.Chart) mkChart($('#piHhTambon'), { type: 'bar', data: { labels: tb.map(t => 'ต.' + t), datasets: gr.map(g => ({ label: 'กลุ่ม ' + g, data: tb.map(t => H.filter(x => x.tambon === t && x.group === g).length), backgroundColor: GC[g] || '#455A64' })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
  piMap('piHhMap', H, 'hh');
}
