/* =====================================================================
   UBRU AppTech System — hh-innov.js  นวัตกรชุมชน: การคัดเลือกควบคู่การประเมิน (DEC-128)
   Gig 4 พ.ย. 2569: "ต้องการการเลือกนวัตกรควบคู่ไปกับการประเมิน และแสดงระดับของนวัตกร … แยกออกมาอีกเมนู"
   ข้อมูล (ซิงก์จากชีตครัวเรือน ชีตยังเป็นหลัก):
     06 คัดกรองนวัตกร  เกณฑ์ 6 ข้อ → "สรุปศักยภาพนวัตกร" (ใช่ = ได้รับเลือก · รอพิจารณา · ไม่)
     07 ประเมินนวัตกร  3 มิติ × ระดับ 1–4 · รอบ 1 ก่อนพัฒนา (ระดับฐานเดิม) · รอบ 2 ระหว่างพัฒนา · รอบ 3 ประเมินเพื่อให้ระดับ (ระดับทางการ)
     08 เกณฑ์อ้างอิง  คำอธิบายระดับ (มาตรฐานกลาง บพท.)
   ระบบคำนวณสรุปพัฒนาการเอง (แทนชีต 09 ซึ่งยังมีเพียงแถวตัวอย่าง): ระดับรายมิติแต่ละรอบ · การเปลี่ยนแปลงจากรอบ 1 · ผลรวม 3 มิติ (3–12) แบบชีต 09
   ไม่สร้างระดับรวมขึ้นเอง: แสดงระดับรายมิติ + ผลรวม ตามโครงสร้างชีต 09 (เกณฑ์ 08 ไม่ได้กำหนดวิธีรวมระดับ)
   โหลดโดย food/index.html หลัง hh-map.js (ใช้ hhRoundNo · HH_LEVEL_COLORS)
   ===================================================================== */
const INV_ROUNDS = [[1, 'รอบ 1 ก่อนพัฒนา'], [2, 'รอบ 2 ระหว่างพัฒนา'], [3, 'รอบ 3 ให้ระดับ']];
const INV_SCR = [['ใช่', 'ได้รับเลือก', '#2E7D32'], ['รอพิจารณา', 'รอพิจารณา', '#F9A825'], ['ไม่', 'ไม่ผ่าน', '#9E9E9E'], ['', 'ยังไม่คัดกรอง', '#CFD8DC']];

// ---------------------------------------------------------------------
// ฟังก์ชันล้วน (ใช้ทั้งหน้าจอและเทสต์)
// ---------------------------------------------------------------------
// ระดับ 1–4 จากค่าในชีต (ไม่ใช่ตัวเลข/นอกช่วง = null)
const invLv = v => { const t = String(v ?? '').trim(); if (!/^\d+(\.\d+)?$/.test(t)) return null; const n = +t; return n >= 1 && n <= 4 ? n : null; };
// สรุปพัฒนาการจากรอบต่าง ๆ: rounds = { 1: [d1,d2,d3], 2: [...], 3: [...] } (ค่า null = ยังไม่ให้ระดับ)
function invDev(rounds, nd = 3) {
  const nos = Object.keys(rounds).map(Number).filter(n => (rounds[n] || []).length >= nd && rounds[n].slice(0, nd).every(v => v != null)).sort((a, b) => a - b);   // DEC-133: รอบที่คะแนนครบ 3 มิติเท่านั้น
  const latest = nos.length ? nos[nos.length - 1] : null, base = rounds[1] || null, cur = latest ? rounds[latest] : null;
  const full = a => a && a.length >= nd && a.slice(0, nd).every(v => v != null);
  const sum = a => (full(a) ? a.slice(0, nd).reduce((x, y) => x + y, 0) : null);
  const delta = latest && latest > 1 && base ? cur.slice(0, nd).map((v, i) => (v != null && base[i] != null ? v - base[i] : null)) : Array(nd).fill(null);
  return { nos, latest, cur, base, sumBase: sum(base), sumCur: sum(cur), sumOfficial: sum(rounds[3]), delta, sumDelta: latest && latest > 1 && sum(base) != null && sum(cur) != null ? sum(cur) - sum(base) : null, complete: full(cur) };
}
// สถานะของครัวเรือนในกระบวนการ: คัดกรอง → เลือก → ประเมินรอบ 1–3
function invStage(scr, latest) {
  const s = String(scr ?? '').trim();
  if (latest === 3) return { k: 'r3', l: 'ได้ระดับทางการ (รอบ 3)', c: '#1B5E20' };
  if (latest === 2) return { k: 'r2', l: 'ระหว่างพัฒนา (รอบ 2)', c: '#388E3C' };
  if (latest === 1) return { k: 'r1', l: 'ระดับฐานเดิม (รอบ 1)', c: '#7CB342' };
  if (s === 'ใช่') return { k: 'sel', l: 'ได้รับเลือก · ยังไม่ประเมิน', c: '#F9A825' };
  if (s === 'รอพิจารณา') return { k: 'wait', l: 'รอพิจารณา', c: '#FFB300' };
  if (s === 'ไม่') return { k: 'no', l: 'ไม่ผ่านคัดกรอง', c: '#9E9E9E' };
  return { k: 'none', l: 'ยังไม่คัดกรอง', c: '#CFD8DC' };
}
// คำอธิบายระดับจากแท็บ 08: แถว [ระดับ, มิติ 1, มิติ 2, มิติ 3] · รายการเกณฑ์คัดเลือก "1. …"
function invRubric(values) {
  const lv = {}, crit = {};
  for (const r of values || []) {
    const a = String((r || [])[0] ?? '').trim();
    if (/^[1-4]$/.test(a) && r.length >= 4) lv[+a] = r.slice(1, 4).map(x => String(x ?? '').trim());
    const m = a.match(/^([1-6])\.\s*(.+)$/); if (m && !(r || [])[1]) crit[+m[1]] = m[2].trim();
  }
  return { lv, crit };
}

// ---------------------------------------------------------------------
// ข้อมูลของทุกครัวเรือนในทะเบียน
// ---------------------------------------------------------------------
function invDimNames() {
  const H = S._hh; return [1, 2, 3].map(i => { const h = H.role('07', 'dim' + i); return h ? h.replace(/\s*\(1-4\)\s*$/, '') : 'มิติ ' + i; });
}
function invRows() {
  const H = S._hh, T7 = H.byKey['07'], nd = 3;
  return H.reg.map(r => {
    const code = r.hh_code, s6 = typeof hhLast === 'function' ? hhLast(code, '06') : null, scr = s6 ? String(H.roleVal(s6, '06', 'screen_result') ?? '').trim() : '';
    const rounds = {}, rows7 = {};
    for (const x of T7 ? T7.rows.filter(y => y.hh_code === code) : []) {
      const no = hhRoundNo(H.roleVal(x, '07', 'round')); if (!no) continue;
      rounds[no] = [1, 2, 3].map(i => invLv(H.roleVal(x, '07', 'dim' + i))); rows7[no] = x;
    }
    const dev = invDev(rounds, nd), st = invStage(scr, dev.latest);
    return { code, reg: r, name: H.roleVal(r, '01', 'name') || '', tambon: String(H.roleVal(r, '01', 'tambon') ?? '').trim(), group: String(H.roleVal(r, '01', 'group') ?? '').trim(),
      s6, scr, passed: s6 ? H.roleVal(s6, '06', 'criteria_passed') : null, strength: s6 ? String(H.roleVal(s6, '06', 'strength') ?? '').trim() : '', rounds, rows7, dev, st, ...invPerson(rounds, dev, rows7) };
  });
}
// DEC-133 ระดับรายคน = ค่าสูงสุดของ 3 มิติในรอบนั้น (สไลด์ Progress 6M: นับระดับสูงสุดที่แสดงออกจริง) · ไม่กรอกมือ
const invLvl = a => (a && a.length >= 3 && a.slice(0, 3).every(v => v != null) ? Math.max(...a.slice(0, 3)) : null);
function invPerson(rounds, dev, rows7) {
  const lvBase = invLvl(rounds[1]), lvCur = invLvl(dev.cur), b = rounds[1], lr = dev.latest ? rows7[dev.latest] : null;
  const warn = !!(dev.latest > 1 && dev.cur && b && dev.cur.some((v, i) => v != null && b[i] != null && v < b[i]));
  return { lvBase, lvCur, lvDev: dev.latest > 1 && lvBase != null && lvCur != null ? lvCur - lvBase : null, warn, pmua: lr ? String((lr.data || {})['สถานะนำเข้า PMUA'] ?? '').trim() : '' };
}
const invChip = v => (v == null ? '<span class="inv-lv none">–</span>' : `<span class="inv-lv l${Math.floor(v)}">${v}</span>`);
const invDelta = v => (v == null ? '' : v > 0 ? `<span style="color:#2E7D32;font-weight:600">+${v}</span>` : v < 0 ? `<span style="color:#C62828;font-weight:600">${v}</span>` : '<span class="muted">0</span>');

// ---------------------------------------------------------------------
// หน้า #hh/innov
// ---------------------------------------------------------------------
function hhInnovPage(view) {
  const H = S._hh;
  if (!H.byKey['06'] && !H.byKey['07']) return view.innerHTML = hhShell('innov', '<div class="card">ยังไม่มีข้อมูลคัดกรองและประเมินนวัตกร</div>');
  const st = S._inv = S._inv || { f: 'yes', tambon: '', q: '', round: 0, lvRound: 0 };
  const all = invRows(), dn = invDimNames();
  const cnt = k => all.filter(r => r.scr === k).length, sel = all.filter(r => r.scr === 'ใช่');
  const assessed = sel.filter(r => r.dev.latest), official = sel.filter(r => r.dev.latest === 3), byRound = n => sel.filter(r => r.dev.latest === n).length;
  const curRound = Math.max(0, ...sel.map(r => r.dev.latest || 0)), selNoAssess = sel.filter(r => !r.dev.latest), assessNoSel = all.filter(r => r.dev.latest && r.dev.latest >= curRound && r.scr !== 'ใช่');   // DEC-134: ผู้ที่ออกไปแล้วและมีแค่รอบเก่า = ประวัติ ไม่เตือน
  const screened = all.filter(r => r.scr).length;
  // ตัวกรองตาราง
  const t = st.q.trim().toLowerCase();
  const list = all.filter(r => (st.f === 'all' || (st.f === 'yes' ? r.scr === 'ใช่' : st.f === 'wait' ? r.scr === 'รอพิจารณา' : st.f === 'no' ? r.scr === 'ไม่' : !r.scr))
    && (!st.tambon || r.tambon === st.tambon) && (!t || [r.code, r.name, r.tambon].some(v => String(v).toLowerCase().includes(t))));
  const tambons = [...new Set(all.map(r => r.tambon).filter(Boolean))].sort();
  const chip = (k, l, n) => `<button type="button" class="lg-chip ${st.f === k ? 'on' : ''}" onclick="S._inv.f='${k}';render()">${l} (${fmtInt(n)})</button>`;
  const lvAt = r => (st.round ? r.rounds[st.round] || null : r.dev.cur);
  S._invCsv = list.map(r => { const o = { รหัส: r.code, ชื่อ: r.name, ตำบล: r.tambon, กลุ่ม: r.group, เกณฑ์ที่ผ่าน: r.passed ?? '', สรุปคัดกรอง: r.scr, มิติเด่น: r.strength, สถานะ: r.st.l };
    for (const [n] of INV_ROUNDS) [1, 2, 3].forEach(i => { o[`ร${n}_ม${i}`] = (r.rounds[n] || [])[i - 1] ?? ''; });
    o['รวมรอบ1'] = r.dev.sumBase ?? ''; o['รวมล่าสุด'] = r.dev.sumCur ?? ''; o['เปลี่ยนแปลงรวม'] = r.dev.sumDelta ?? ''; o['ระดับฐาน (รอบ 1)'] = r.lvBase ?? ''; o['ระดับล่าสุด'] = r.lvCur ?? ''; o['รอบที่ใช้'] = r.dev.latest ?? ''; o['พัฒนาการระดับ'] = r.lvDev ?? ''; o['ต่ำกว่ารอบ 1'] = r.warn ? 'ใช่' : ''; o['สถานะ PMUA'] = r.pmua; return o; });
  const helpQ = qBtn('กระบวนการนวัตกรชุมชน', `<p><b>1. คัดเลือก</b> ตรวจเกณฑ์ 6 ข้อ แล้วสรุปศักยภาพนวัตกร: "ใช่" = ได้รับเลือก</p><p><b>2. ประเมินสมรรถนะ</b> (แท็บ 07) 3 มิติ แต่ละมิติระดับ 1–4 ตามเกณฑ์อ้างอิง (แท็บ 08) · รอบ 1 ก่อนพัฒนา = ระดับฐานเดิม · รอบ 2 ระหว่างพัฒนา = ระดับชั่วคราว · รอบ 3 = ระดับทางการสำหรับรายงาน บพท. และนำเข้า AppTech PMUA</p><p><b>3. สรุปพัฒนาการ</b> ระบบคำนวณจากแท็บ 07 เอง: ระดับรายมิติ ผลรวม 3 มิติ (3–12) และการเปลี่ยนแปลงจากรอบ 1</p><p><b>ระดับรายคน</b> = ค่าสูงสุดของมิติ 1–3 ในรอบล่าสุดที่คะแนนครบ 3 มิติ (สไลด์ Progress 6M: นับระดับสูงสุดที่แสดงออกจริง) · ระดับฐาน = ค่าสูงสุดของรอบ 1 · ระบบคำนวณเอง ไม่กรอกมือ</p><p class="muted">⚠ = มีมิติในรอบล่าสุดต่ำกว่ารอบ 1 ให้ตรวจผลประเมินอีกครั้ง · ไม่กำหนดโควตาระดับล่วงหน้า (ข้อกำหนด บพท. ในแท็บ 08)</p>`);
  view.innerHTML = hhShell('innov', `<div class="card"><div class="cardhead"><h4>นวัตกรชุมชน · คัดเลือกและประเมิน ${helpQ}</h4><button class="small secondary" onclick="exportCsv(S._invCsv,'นวัตกรชุมชน')">ส่งออก CSV</button></div>
    <div class="kpis">
      <div class="kpi hero"><div class="l">ได้รับเลือกเป็นนวัตกร</div><div class="v">${fmtInt(sel.length)} ครัวเรือน</div><div class="muted">จากที่คัดกรองแล้ว ${fmtInt(screened)} · รอพิจารณา ${fmtInt(cnt('รอพิจารณา'))}</div></div>
      <div class="kpi"><div class="l">ประเมินแล้วอย่างน้อย 1 รอบ</div><div class="v">${fmtInt(assessed.length)} / ${fmtInt(sel.length)}</div><div class="muted">รอบ 1: ${fmtInt(byRound(1))} · รอบ 2: ${fmtInt(byRound(2))} · รอบ 3: ${fmtInt(byRound(3))}</div></div>
      <div class="kpi"><div class="l">ได้ระดับทางการ (รอบ 3)</div><div class="v">${fmtInt(official.length)} / ${fmtInt(sel.length)}</div><div class="muted">ใช้รายงาน บพท.</div></div></div>
    ${selNoAssess.length ? `<div class="banner warn" style="margin-top:8px">ได้รับเลือกแต่ยังไม่ประเมิน ${fmtInt(selNoAssess.length)} ครัวเรือน: ${selNoAssess.slice(0, 12).map(r => `<a href="javascript:void 0" onclick="invDetail('${esc(r.code)}')">${esc(r.code)}</a>`).join(' · ')}${selNoAssess.length > 12 ? ' …' : ''}</div>` : ''}
    ${assessNoSel.length ? `<div class="banner warn" style="margin-top:8px">มีผลประเมินแต่สรุปคัดกรองไม่ใช่ "ใช่" ${fmtInt(assessNoSel.length)} ครัวเรือน (ตรวจข้อมูล): ${assessNoSel.slice(0, 12).map(r => `<a href="javascript:void 0" onclick="invDetail('${esc(r.code)}')">${esc(r.code)}</a>`).join(' · ')}</div>` : ''}</div>
    ${invLevelCard(sel, all)}
    <div class="grid-dash">
      <div class="card"><div class="cardhead"><h4>ระดับรายมิติของนวัตกร · ${st.round ? esc(INV_ROUNDS[st.round - 1][1]) : 'รอบล่าสุด'}</h4>
        <select aria-label="รอบการประเมิน" style="width:auto" onchange="S._inv.round=+this.value;render()"><option value="0">รอบล่าสุด</option>${INV_ROUNDS.map(([n, l]) => `<option value="${n}" ${st.round === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="chartbox"><canvas id="invLv"></canvas></div></div>
      <div class="card"><div class="cardhead"><h4>ระดับเฉลี่ยรายมิติ แยกรอบ</h4></div><div class="chartbox"><canvas id="invDev"></canvas></div></div></div>
    <div class="card"><div class="cardhead"><h4>รายครัวเรือน <span class="muted">กดแถวเพื่อดูเกณฑ์ หลักฐาน และคำอธิบายระดับ</span></h4></div>
      <div class="lg-chips">${chip('yes', 'ได้รับเลือก', sel.length)}${chip('wait', 'รอพิจารณา', cnt('รอพิจารณา'))}${chip('no', 'ไม่ผ่าน', cnt('ไม่'))}${chip('none', 'ยังไม่คัดกรอง', all.length - screened)}${chip('all', 'ทั้งหมด', all.length)}</div>
      <div class="row" style="gap:8px;margin:8px 0;flex-wrap:wrap"><input type="search" aria-label="ค้นหานวัตกร" placeholder="ชื่อ · รหัส · ตำบล" value="${esc(st.q)}" style="max-width:260px" oninput="S._inv.q=this.value;clearTimeout(S._invT);S._invT=setTimeout(()=>{render();const e=document.querySelector('[aria-label=ค้นหานวัตกร]');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},300)">
        <select aria-label="ตำบล" style="width:auto" onchange="S._inv.tambon=this.value;render()"><option value="">ทุกตำบล</option>${tambons.map(x => `<option ${x === st.tambon ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="tscroll"><table><thead><tr><th>ครัวเรือน</th><th>ตำบล</th><th class="num">ระดับฐาน (รอบ 1)</th><th class="num">ระดับล่าสุด</th><th class="num">รอบ</th><th class="num">พัฒนาการ</th>${dn.map((d, i) => `<th class="num" title="${esc(d)}">ม.${i + 1}</th>`).join('')}<th>สถานะ PMUA</th><th>สถานะ</th></tr></thead><tbody>
        ${list.map(r => { const lv = r.dev.cur || [null, null, null];
          return `<tr onclick="invDetail('${esc(r.code)}')" style="cursor:pointer"><td class="nowrap">${r.warn ? '<b title="มีมิติในรอบล่าสุดต่ำกว่ารอบ 1" style="color:#C62828">⚠ </b>' : ''}<b>${esc(r.code)}</b> ${esc(r.name)}</td><td>${esc(r.tambon)}</td><td class="num">${invChip(r.lvBase)}</td><td class="num">${invChip(r.lvCur)}</td><td class="num">${r.dev.latest || '–'}</td><td class="num">${invDelta(r.lvDev)}</td>${lv.map((v, i) => `<td class="num nowrap">${invChip(v)} ${invDelta(r.dev.delta[i])}</td>`).join('')}<td>${esc(r.pmua || '–')}</td><td class="nowrap"><i class="dot" style="background:${r.st.c}"></i> ${esc(r.st.l)}</td></tr>`; }).join('') || `<tr><td colspan="${8 + dn.length}" class="muted">ไม่มีครัวเรือนตามตัวกรอง</td></tr>`}
      </tbody></table></div>
      <div class="muted" style="margin-top:4px">ระดับ: ${[1, 2, 3, 4].map(l => invChip(l)).join(' ')} · ระดับรายคน = ค่าสูงสุดของ 3 มิติ · ม.1–3 แสดงคะแนนรอบล่าสุดและการเปลี่ยนแปลงจากรอบ 1 · ⚠ = ต่ำกว่ารอบ 1 · ${dn.map((d, i) => `ม.${i + 1} ${esc(d.replace(/^มิติ\s*\d+\s*/, ''))}`).join(' · ')}</div></div>`);
  if (!window.Chart) return;
  // กราฟ 1: จำนวนนวัตกรในแต่ละระดับ แยกมิติ (เฉพาะผู้ได้รับเลือก)
  const lvs = (st.round ? all.filter(x => invLvl(x.rounds[st.round]) != null) : sel).map(lvAt).filter(Boolean);   // DEC-134
  mkChart($('#invLv'), { type: 'bar', data: { labels: dn.map((d, i) => 'ม.' + (i + 1)), datasets: [1, 2, 3, 4].map(l => ({ label: 'ระดับ ' + l, data: [0, 1, 2].map(i => lvs.filter(a => a[i] === l).length), backgroundColor: HH_LEVEL_COLORS[l] })) },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: c => dn[c[0].dataIndex] } } }, scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } } } });
  // กราฟ 2: ระดับเฉลี่ยของแต่ละมิติในแต่ละรอบ (เฉพาะรอบที่มีข้อมูล)
  const avgOf = (n, i) => { const v = all.map(r => (r.rounds[n] || [])[i]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 : null; };
  const rs = INV_ROUNDS.filter(([n]) => sel.some(r => (r.rounds[n] || []).some(v => v != null)));
  mkChart($('#invDev'), { type: 'bar', data: { labels: dn.map((d, i) => 'ม.' + (i + 1)), datasets: rs.map(([n, l], k) => ({ label: l, data: [0, 1, 2].map(i => avgOf(n, i)), backgroundColor: ['#9CCC65', '#43A047', '#1B5E20'][n - 1] })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: c => dn[c[0].dataIndex] } } }, scales: { y: { min: 0, max: 4, ticks: { stepSize: 1 } } } } });
}

// ---------------------------------------------------------------------
// รายละเอียด 1 ครัวเรือน: เกณฑ์คัดเลือก 6 ข้อ + ระดับรายมิติทุกรอบ + คำอธิบายระดับ (08)
// ---------------------------------------------------------------------
function invDetail(code) {
  const H = S._hh, r = invRows().find(x => x.code === code); if (!r) return;
  const T8 = H.byKey['08'], rb = invRubric(T8 && T8.tab.meta ? T8.tab.meta.values : []), dn = invDimNames();
  const d6 = r.s6 ? r.s6.data || {} : {}, cols6 = H.byKey['06'] ? H.byKey['06'].cols.map(c => c.header) : [];
  const crit = [1, 2, 3, 4, 5, 6].map(i => ({ i, res: d6[cols6.find(h => new RegExp('^ผลตรวจเกณฑ์\\s*' + i + '$').test(h))], ev: d6[cols6.find(h => new RegExp('^หลักฐานเกณฑ์\\s*' + i + '$').test(h))] }));
  const resC = v => { const s = String(v ?? '').trim(); return s === 'ผ่าน' ? '#2E7D32' : s === 'ไม่ผ่าน' ? '#C62828' : '#9E9E9E'; };
  const latestRow = r.dev.latest ? r.rows7[r.dev.latest] : null, ld = latestRow ? latestRow.data || {} : {};
  const ev7 = (row, i) => { const d = row ? row.data || {} : {}; const h = Object.keys(d).find(k => new RegExp('^หลักฐานมิติ\\s*' + i + '$').test(k)); return h ? d[h] : null; };
  const txt = h => { const v = ld[h]; return v == null || String(v).trim() === '' ? '' : `<p style="margin:4px 0"><b>${esc(h)}:</b> ${esc(String(v))}</p>`; };
  const canEdit = typeof hhEdit === 'function';
  const nextRound = INV_ROUNDS.find(([n]) => !r.rounds[n]);
  openModal(`<h3 style="margin-top:0">${esc(r.code)} · ${esc(r.name)}</h3><div class="muted">ต.${esc(r.tambon || '-')} · กลุ่ม ${esc(r.group || '-')} · <i class="dot" style="background:${r.st.c}"></i>${esc(r.st.l)} · <a href="#hh/h/${encodeURIComponent(r.code)}" onclick="closeModal()">ข้อมูลครัวเรือน ›</a></div>
    <h4 style="margin:14px 0 6px">1 · คัดเลือก ${r.s6 ? `<span class="muted">เกณฑ์ผ่าน ${esc(String(r.passed ?? '-'))}/6 · สรุป <b>${esc(r.scr || '-')}</b>${r.strength ? ' · มิติเด่น ' + esc(r.strength) : ''}</span>` : '<span class="muted">ยังไม่มีข้อมูลคัดกรอง</span>'}</h4>
    ${r.s6 ? `<div class="tscroll"><table><tbody>${crit.map(c => `<tr><td style="white-space:nowrap"><i class="dot" style="background:${resC(c.res)}"></i> ${c.i}. ${esc(rb.crit[c.i] || 'เกณฑ์ ' + c.i)}</td><td><b>${esc(String(c.res ?? '–'))}</b></td><td class="muted">${esc(String(c.ev ?? ''))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${canEdit ? `<div class="row" style="margin-top:6px;gap:6px">${r.s6 ? `<button class="small secondary" onclick="closeModal();hhEdit('06','${r.s6.id}')">แก้ผลคัดกรอง</button>` : `<button class="small secondary" onclick="closeModal();hhEdit('06',null,{'รหัสครัวเรือน':'${esc(r.code)}'})">เพิ่มผลคัดกรอง</button>`}</div>` : ''}
    <h4 style="margin:16px 0 6px">2 · ระดับสมรรถนะ 3 มิติ <span class="muted" style="font-weight:400">รอบ 1 ก่อนพัฒนา · รอบ 2 ระหว่างพัฒนา · รอบ 3 ให้ระดับ</span></h4>
    <div style="margin-bottom:6px">ระดับรายคน (ค่าสูงสุด 3 มิติ): ${INV_ROUNDS.map(([n]) => `รอบ ${n} ${invChip(invLvl(r.rounds[n]))}`).join(' · ')}${r.warn ? ' · <b style="color:#C62828">⚠ มีมิติต่ำกว่ารอบ 1</b>' : ''}</div>
    <div class="tscroll"><table><thead><tr><th>มิติ</th>${INV_ROUNDS.map(([n, l]) => `<th class="num" title="${esc(l)}">รอบ ${n}</th>`).join('')}<th class="num" title="รอบล่าสุด − รอบ 1">เปลี่ยน</th></tr></thead><tbody>
      ${dn.map((d, i) => `<tr><td><b>ม.${i + 1}</b> <span style="font-size:13px">${esc(d.replace(/^มิติ\s*\d+\s*/, ''))}</span></td>${INV_ROUNDS.map(([n]) => `<td class="num" title="${esc(String(ev7(r.rows7[n], i + 1) ?? ''))}">${invChip((r.rounds[n] || [])[i] ?? null)}</td>`).join('')}<td class="num">${invDelta(r.dev.delta[i])}</td></tr>`).join('')}
      <tr><td><b>รวม 3 มิติ</b> <span class="muted" style="font-size:13px">(3–12)</span></td>${INV_ROUNDS.map(([n]) => { const a = r.rounds[n]; return `<td class="num"><b>${a && a.every(v => v != null) ? a.reduce((x, y) => x + y, 0) : '–'}</b></td>`; }).join('')}<td class="num">${invDelta(r.dev.sumDelta)}</td></tr></tbody></table></div>
    ${r.dev.cur ? `<div style="margin-top:8px">${dn.map((d, i) => { const v = r.dev.cur[i], desc = v != null && rb.lv[Math.floor(v)] ? rb.lv[Math.floor(v)][i] : ''; const ev = ev7(latestRow, i + 1);
        return `<div class="inv-desc">${invChip(v)} <b>${esc(d)}</b>${desc ? `<div>${esc(desc)}</div>` : ''}${ev ? `<div class="muted">หลักฐาน: ${esc(String(ev))}</div>` : ''}</div>`; }).join('')}<div class="muted" style="font-size:13px">คำอธิบายระดับจากเกณฑ์อ้างอิง (แท็บ 08) · ระดับของ${esc(INV_ROUNDS[r.dev.latest - 1][1])}</div></div>` : '<div class="muted">ยังไม่มีผลประเมิน</div>'}
    ${['จุดแข็ง', 'สิ่งที่ต้องพัฒนา', 'แผนพัฒนาเบื้องต้น', 'สถานะนำเข้า PMUA', 'หมายเหตุ'].map(txt).join('')}
    <div class="row" style="margin-top:12px;gap:6px;flex-wrap:wrap">${canEdit && latestRow ? `<button class="small secondary" onclick="closeModal();hhEdit('07','${latestRow.id}')">แก้ผลประเมินรอบล่าสุด</button>` : ''}${canEdit && nextRound && (r.scr === 'ใช่' || r.dev.latest) ? `<button class="small" onclick="closeModal();hhEdit('07',null,{'รหัสครัวเรือน':'${esc(r.code)}','รอบการประเมิน':'${esc(invRoundOption(nextRound[0]))}'})">＋ ประเมิน${esc(nextRound[1])}</button>` : ''}<button class="small secondary" onclick="closeModal()">ปิด</button></div>
    `);
}
// ค่าในรายการเลือก "รอบการประเมิน" ของแท็บ 07 ที่ตรงกับเลขรอบ (ใช้ค่าจากชีต ไม่พิมพ์เอง)
function invRoundOption(n) {
  const H = S._hh, h = H.role('07', 'round'), c = H.byKey['07'] ? H.byKey['07'].cols.find(x => x.header === h) : null;
  return ((c && c.options) || []).map(String).find(o => hhRoundNo(o) === n) || INV_ROUNDS[n - 1][1];
}
// สรุปสั้นในหน้าข้อมูลครัวเรือน
function hhInnovMini(code) {
  const r = invRows().find(x => x.code === code); if (!r || (!r.scr && !r.dev.latest)) return '';
  return `<div class="card"><div class="cardhead"><h4>นวัตกรชุมชน</h4><a class="small" href="javascript:void 0" onclick="invDetail('${esc(code)}')">ดูเกณฑ์และระดับ ›</a></div>
    <div><i class="dot" style="background:${r.st.c}"></i> ${esc(r.st.l)}${r.lvCur != null ? ` · ระดับ ${invChip(r.lvCur)}` : ''}${r.dev.cur ? ' · ' + r.dev.cur.map((v, i) => `ม.${i + 1} ${invChip(v)}`).join(' ') + (r.dev.sumCur != null ? ` · รวม ${r.dev.sumCur}` : '') : ''}</div></div>`;
}

// ---------------------------------------------------------------------
// สรุปพัฒนาการ (แท็บ 09) คำนวณจาก 01/06/07 ตามคอลัมน์ของชีต 09 · ไม่กรอกเอง (DEC-131)
// ---------------------------------------------------------------------
function hhDevRows() {
  const H = S._hh;
  return invRows().filter(r => r.scr || r.dev.latest).map(r => {
    const o = { 'รหัสครัวเรือน': r.code, 'ชื่อ-สกุล': r.name, 'ตำบล': r.tambon, 'กลุ่ม': r.group, 'สรุปคัดกรอง': r.scr || '–', 'มิติเด่น': r.strength || '–' };
    const sum = a => (a && a.every(v => v != null) ? a.reduce((x, y) => x + y, 0) : null);
    [1, 2, 3].forEach(i => { const g = n => (r.rounds[n] || [])[i - 1] ?? null; o[`ม.${i} รอบก่อน`] = g(1); o[`ม.${i} ระหว่าง`] = g(2); o[`ม.${i} ให้ระดับ`] = g(3); o[`ม.${i} พัฒนาการ`] = g(3) != null && g(1) != null ? g(3) - g(1) : null; });
    o['รวมระดับก่อน'] = sum(r.rounds[1]); o['รวมระดับสุดท้าย'] = sum(r.rounds[3]); o['พัฒนาการรวม'] = o['รวมระดับก่อน'] != null && o['รวมระดับสุดท้าย'] != null ? o['รวมระดับสุดท้าย'] - o['รวมระดับก่อน'] : null;
    o['สถานะการประเมิน'] = r.st.l; const lr = r.dev.latest ? r.rows7[r.dev.latest] : null; o['สถานะ PMUA'] = lr ? (lr.data || {})['สถานะนำเข้า PMUA'] || '–' : '–';
    return o;
  });
}
function hhDevPage(view) {
  const rows = hhDevRows(); S._devCsv = rows;
  const c = v => (v == null ? '<span class="muted">–</span>' : esc(String(v)));
  view.innerHTML = hhShell('t/09', `<div class="card"><div class="cardhead"><h4>สรุปพัฒนาการ (${fmtInt(rows.length)}) ${qBtn('สรุปพัฒนาการ', '<p>ระบบคำนวณจากแท็บ 01 คัดกรอง 06 และประเมิน 07 ตามรูปแบบสรุปพัฒนาการเดิม จึงไม่ต้องกรอกเอง</p><p>พัฒนาการ = ระดับรอบ 3 (ให้ระดับ) − รอบ 1 (ก่อนพัฒนา) · แก้ระดับได้ที่เมนูนวัตกรชุมชนหรือประเมินนวัตกร</p><p>ส่งออก CSV ได้ คอลัมน์เรียงเหมือนแบบสรุปพัฒนาการเดิม</p>')}</h4><button class="small secondary" onclick="exportCsv(S._devCsv,'สรุปพัฒนาการ')">ส่งออก CSV</button></div>
    <div class="tscroll"><table><thead><tr><th>ครัวเรือน</th><th>คัดกรอง</th>${[1, 2, 3].map(i => `<th class="num">ม.${i} ก่อน</th><th class="num">ระหว่าง</th><th class="num">ให้ระดับ</th><th class="num">พัฒนาการ</th>`).join('')}<th class="num">รวมก่อน</th><th class="num">รวมสุดท้าย</th><th>สถานะ</th></tr></thead><tbody>
    ${rows.map(o => `<tr onclick="invDetail('${esc(o['รหัสครัวเรือน'])}')" style="cursor:pointer"><td class="nowrap"><b>${esc(o['รหัสครัวเรือน'])}</b> ${esc(o['ชื่อ-สกุล'])}</td><td>${esc(o['สรุปคัดกรอง'])}</td>${[1, 2, 3].map(i => `<td class="num">${o[`ม.${i} รอบก่อน`] == null ? '–' : invChip(o[`ม.${i} รอบก่อน`])}</td><td class="num">${o[`ม.${i} ระหว่าง`] == null ? '–' : invChip(o[`ม.${i} ระหว่าง`])}</td><td class="num">${o[`ม.${i} ให้ระดับ`] == null ? '–' : invChip(o[`ม.${i} ให้ระดับ`])}</td><td class="num">${invDelta(o[`ม.${i} พัฒนาการ`])}</td>`).join('')}<td class="num">${c(o['รวมระดับก่อน'])}</td><td class="num">${c(o['รวมระดับสุดท้าย'])}</td><td class="nowrap">${esc(o['สถานะการประเมิน'])}</td></tr>`).join('') || '<tr><td colspan="17" class="muted">ยังไม่มีข้อมูลคัดกรองหรือประเมิน</td></tr>'}
    </tbody></table></div></div>`);
}

// การ์ดนับระดับรายคน (DEC-133): ล่าสุด หรือรอบที่เลือก · คนละ 1 ค่า · เทียบเป้าหมายตามสไลด์และสัญญา
function invLevelCard(sel, all) {
  const st = S._inv, r = st.lvRound || 0, lv = x => (r ? invLvl(x.rounds[r]) : x.lvCur);
  const pop = r ? (all || sel).filter(x => invLvl(x.rounds[r]) != null) : sel;   // DEC-134: รายรอบนับทุกคนที่ประเมินในรอบนั้น (ประวัติจริง) · ล่าสุดนับผู้ได้รับเลือกปัจจุบัน
  const n = l => pop.filter(x => lv(x) === l).length, none = r ? 0 : sel.filter(x => lv(x) == null).length, hi = n(3) + n(4), warn = sel.filter(x => x.warn).length;
  const T = typeof RP_LV_TARGET !== 'undefined' ? RP_LV_TARGET : {}, NM = typeof RP_LV_NAME !== 'undefined' ? RP_LV_NAME : {};
  return `<div class="card"><div class="cardhead"><h4>ระดับนวัตกรรายคน ${qBtn('ระดับรายคน', '<p>ระดับรายคน = ค่าสูงสุดของมิติ 1–3 ในรอบล่าสุดที่คะแนนครบ 3 มิติ ถ้ารอบล่าสุดยังไม่ครบ ใช้รอบก่อนหน้า</p><p>จับคู่ด้วยรหัสครัวเรือน + เลขรอบ (ตัวเลขตัวแรกของคอลัมน์ B) ลำดับแถวไม่มีผล · นับคนละ 1 ค่า</p><p>Co-Ordinator (1) · Co-Creator (2) · Trainer (3) · Change Agent (4)</p>')}</h4>
    <div class="lg-chips">${[[0, 'ล่าสุด'], [1, 'รอบ 1'], [2, 'รอบ 2'], [3, 'รอบ 3']].map(([k, l]) => `<button type="button" class="lg-chip ${r === k ? 'on' : ''}" onclick="S._inv.lvRound=${k};render()">${l}</button>`).join('')}</div></div>
    <div class="kpis">${[4, 3, 2, 1].map(l => `<div class="kpi"><div class="l">ระดับ ${l}${NM[l] ? ' · ' + NM[l] : ''}</div><div class="v">${fmtInt(n(l))} <span class="muted" style="font-size:14px">คน</span></div>${T[l] != null ? `<div class="muted">เป้าหมาย ${T[l]} คน</div>` : ''}</div>`).join('')}<div class="kpi"><div class="l">ระดับ 3–4 รวม (เป้า ≥ 8)</div><div class="v" style="color:${hi >= 8 ? '#2E7D32' : '#C62828'}">${fmtInt(hi)}</div><div class="muted">รวมทุกระดับ ${fmtInt(pop.length - none)} คน</div></div></div>
    ${none ? `<div class="muted" style="margin-top:6px">ยังไม่มีคะแนนครบ 3 มิติ${r ? ' ในรอบ ' + r : ''}: ${fmtInt(none)} คน</div>` : ''}${warn && !r ? `<div class="banner warn" style="margin-top:6px">มี ${fmtInt(warn)} คนที่บางมิติในรอบล่าสุดต่ำกว่ารอบ 1 (แถวที่มี ⚠ ในตาราง) ตรวจผลประเมินอีกครั้ง</div>` : ''}</div>`;
}
