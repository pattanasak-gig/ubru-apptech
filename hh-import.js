/* =====================================================================
   UBRU AppTech System — hh-import.js  นำเข้ายอดรายเดือน + ข้อมูลอ้างอิงที่ดึงจากชีต (DEC-136)
   Gig 10 พ.ย. 2569: "ดำเนินการเลย … ตรวจสอบทุกชีตและส่วนที่เกี่ยวข้องให้ครบ" (เตรียมเลิกใช้ชีต)
   ขั้นตอน: sql/027 เพิ่มแท็บอ่านทั้งแผ่น 10 · 11 · pmu → "ซิงก์กับชีต" อ่านสำเนาเก็บใน hh.tab.meta
            → หน้านี้แปลงแท็บ 10 (รายได้เสริม + ต้นทุนลด รายครัวเรือนรายเดือน) ลง hh.report_month เมื่อ admin กดนำเข้า
   ไม่ลบแถวที่มีในระบบแต่ไม่มีในชีต (แสดงให้เห็นเท่านั้น) · ไม่เขียนกลับชีต
   ===================================================================== */
const RP10_START = '2026-04';   // ด.1 = เม.ย. 2569 (หัวแท็บ 10: "1 = เม.ย. 69, 4 = ก.ค. 69")
const RP10_NOTE = 'นำเข้าจากแท็บ 10 ติดตามผลตอบแทนรายเดือน';
const rp10Month = n => { const [y, m] = RP10_START.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n - 1, 1)); return d.toISOString().slice(0, 10); };
const rp10Num = v => { const t = String(v ?? '').trim().replace(/,/g, ''); return t === '' ? null : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };
// แปลงสำเนาแท็บ 10 (อาร์เรย์ 2 มิติของค่าที่แสดง) → แถวรายครัวเรือนรายเดือน
//   ช่องว่างทั้งคู่ = ยังไม่มีข้อมูลเดือนนั้น (ไม่นำเข้า) · 0 = มีข้อมูลและเป็นศูนย์ (นำเข้า)
//   กลุ่ม: ด.1–3 ไม่มีกลุ่ม · ด.4–6 ใช้ "กลุ่มรายงาน ก.ค.–ก.ย." · ตั้งแต่ ด.7 ใช้ "กลุ่ม ต.ค." (กลุ่มล่าสุด)
function rp10Parse(values, codeRe) {
  const V = values || [], hi = V.findIndex(r => String((r || [])[0] ?? '').trim() === 'รหัสครัวเรือน');
  if (hi < 0) return { error: 'ไม่พบแถวหัวตารางที่ขึ้นต้นด้วย "รหัสครัวเรือน"' };
  const H = V[hi].map(h => String(h ?? '').trim()), col = h => H.indexOf(h), find = p => H.findIndex(h => h.startsWith(p));
  const months = []; for (let n = 1; n <= 18; n++) { const a = col(`ด.${n} รายได้เสริม (บาท)`), b = col(`ด.${n} ต้นทุนลด (บาท)`); if (a >= 0 && b >= 0) months.push({ n, a, b, month: rp10Month(n) }); }
  const gA = find('กลุ่มรายงาน ก.ค.'), gB = find('กลุ่ม ต.ค.'), re = new RegExp(codeRe || '^BSF-[0-9]+$');
  const rows = [], bad = [], skipped = [], grpOf = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() || null : null);
  for (const r of V.slice(hi + 1)) {
    const code = String((r || [])[0] ?? '').trim(); if (!code) continue;
    if (!re.test(code)) { skipped.push(code); continue; }
    for (const m of months) {
      const ex = rp10Num(r[m.a]), cut = rp10Num(r[m.b]); if (ex === null && cut === null) continue;
      if (Number.isNaN(ex) || Number.isNaN(cut)) { bad.push(`${code} ด.${m.n}`); continue; }
      rows.push({ hh_code: code, month: m.month, n: m.n, extra_income: ex, cost_cut: cut, grp: m.n <= 3 ? null : m.n <= 6 ? grpOf(r, gA) : grpOf(r, gB) });
    }
  }
  // ยอดสะสมบนหัวแท็บ (ใช้ตรวจว่าอ่านครบ): ค่าอยู่ใต้ป้ายในแถวถัดไป
  const head = {}; for (const [k, lab] of [['total', 'รวมผลตอบแทนสะสม'], ['ex', 'รวมรายได้เสริมสะสม'], ['cut', 'รวมต้นทุนที่ลดได้สะสม']]) {
    for (let i = 0; i < hi; i++) { const j = (V[i] || []).findIndex(c => String(c ?? '').trim() === lab); if (j >= 0) { head[k] = rp10Num((V[i + 1] || [])[j]); break; } }
  }
  return { rows, months: months.length, bad, skipped, head };
}
// เทียบกับ hh.report_month ในระบบ
function rp10Diff(parsed, existing) {
  const ex = Object.fromEntries(existing.map(x => [x.hh_code + '|' + String(x.month).slice(0, 10), x]));
  const same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(+a - +b) < 0.005);
  const add = [], upd = [], keep = [];
  for (const r of parsed) {
    const e = ex[r.hh_code + '|' + r.month];
    if (!e) add.push(r);
    else if (!same(e.extra_income, r.extra_income) || !same(e.cost_cut, r.cost_cut) || String(e.grp ?? '') !== String(r.grp ?? '')) upd.push({ ...r, id: e.id, old: e });
    else keep.push(r);
  }
  const inSheet = new Set(parsed.map(r => r.hh_code + '|' + r.month));
  return { add, upd, keep, onlySys: existing.filter(x => !inSheet.has(x.hh_code + '|' + String(x.month).slice(0, 10))) };
}

function hhImportPage(view) {
  const H = S._hh;
  if (!hhCanAdmin()) return view.innerHTML = hhShell('import', '<div class="card">เฉพาะ admin</div>');
  if (!H.rp) return view.innerHTML = hhShell('import', '<div class="card"><div class="banner warn">ฐานข้อมูลยังไม่มีตารางยอดรายเดือน (รัน sql/025)</div></div>');
  const T = H.byKey['10'], vals = T && T.tab.meta ? T.tab.meta.values || [] : [];
  const how = '<ol style="margin:6px 0 0;padding-left:20px"><li>รัน sql/027 ใน SQL Editor (ครั้งเดียว)</li><li>ไปที่ <a href="#hh/sync">ซิงก์กับชีต</a> กด "ตรวจกับชีต" แล้วกด "อัปเดตตามนี้"</li><li>กลับมาหน้านี้ แล้วกด "นำเข้า"</li></ol>';
  if (!T) return view.innerHTML = hhShell('import', `<div class="card"><h4 style="margin-top:0">นำเข้ายอดรายเดือน</h4><div class="banner warn">ยังไม่มีแท็บติดตามผลตอบแทนในระบบ</div>${how}</div>`);
  if (!vals.length) return view.innerHTML = hhShell('import', `<div class="card"><h4 style="margin-top:0">นำเข้ายอดรายเดือน</h4><div class="banner warn">ยังไม่ได้อ่านแท็บติดตามผลตอบแทนจากชีต</div>${how}</div>`);
  const P = rp10Parse(vals, H.link.code_pattern);
  if (P.error) return view.innerHTML = hhShell('import', `<div class="card"><div class="banner warn">${esc(P.error)} (หัวตารางในชีตถูกแก้?)</div></div>`);
  const reg = new Set(H.reg.map(r => r.hh_code)), notReg = [...new Set(P.rows.filter(r => !reg.has(r.hh_code)).map(r => r.hh_code))];
  const rows = P.rows.filter(r => reg.has(r.hh_code)), D = S._rp10 = rp10Diff(rows, H.rp.months);
  const sum = (a, k) => a.reduce((s, r) => s + (+r[k] || 0), 0);
  const tot = { ex: sum(rows, 'extra_income'), cut: sum(rows, 'cost_cut') }; tot.total = tot.ex + tot.cut;
  const chk = (lab, mine, head) => `<tr><td>${lab}</td><td class="num">${lgBaht(mine)}</td><td class="num">${head == null || Number.isNaN(head) ? '-' : lgBaht(head)}</td><td>${head == null || Number.isNaN(head) ? '<span class="muted">ไม่มีค่าบนหัวแท็บ</span>' : Math.abs(mine - head) < 1 ? '<b style="color:#2E7D32">✓ ตรง</b>' : '<b style="color:#C62828">✗ ไม่ตรง</b>'}</td></tr>`;
  const ms = [...new Set(rows.map(r => r.month))].sort();
  const st = k => { const a = D.add.filter(r => r.month === k).length, u = D.upd.filter(r => r.month === k).length, s = D.keep.filter(r => r.month === k).length; return [a ? `ใหม่ ${a}` : '', u ? `<b style="color:#E65100">เปลี่ยน ${u}</b>` : '', s ? `ตรงแล้ว ${s}` : ''].filter(Boolean).join(' · '); };
  const todo = D.add.length + D.upd.length;
  view.innerHTML = hhShell('import', `<div class="card"><div class="cardhead"><h4>นำเข้ายอดรายเดือน ${qBtn('นำเข้ายอดรายเดือน', `<p>อ่านยอด "รายได้เสริม" และ "ต้นทุนลด" รายครัวเรือนรายเดือนจากสำเนาแท็บติดตามผลตอบแทน (อ่านจากชีตเมื่อ ${esc(thDate(T.tab.meta.read_at))}) แล้วบันทึกลงระบบ ใช้ในแดชบอร์ดรายได้ (แหล่งข้อมูล "ยอดรายเดือน")</p><p>ช่องว่างทั้งสองช่อง = ยังไม่มีข้อมูลเดือนนั้น ไม่นำเข้า · 0 = มีข้อมูลและเป็นศูนย์ นำเข้า</p><p>กลุ่มรายงาน: เดือน ก.ค.–ก.ย. ใช้กลุ่มรายงาน ก.ค.–ก.ย. · ตั้งแต่ ต.ค. ใช้กลุ่ม ต.ค.</p><p>กดนำเข้าซ้ำได้ ระบบเพิ่มเฉพาะเดือนใหม่และแก้เฉพาะค่าที่เปลี่ยน ไม่ลบข้อมูลในระบบ</p>`)}</h4><span class="muted">สำเนาจากชีต ${esc(thDate(T.tab.meta.read_at))}</span></div>
      <div class="kpis"><div class="kpi hero"><div class="l">รอนำเข้า</div><div class="v">${fmtInt(todo)} รายการ</div><div class="muted" style="color:#dbeafe">ใหม่ ${fmtInt(D.add.length)} · เปลี่ยน ${fmtInt(D.upd.length)}</div></div>
        <div class="kpi"><div class="l">ตรงกับระบบแล้ว</div><div class="v">${fmtInt(D.keep.length)}</div></div>
        <div class="kpi"><div class="l">ครัวเรือนในแท็บ</div><div class="v">${fmtInt(new Set(rows.map(r => r.hh_code)).size)}</div><div class="muted">${fmtInt(ms.length)} เดือนที่มีข้อมูล</div></div></div>
      ${notReg.length ? `<div class="banner warn" style="margin-top:8px">รหัสที่ไม่มีในทะเบียน ไม่นำเข้า: ${esc(notReg.join(', '))}</div>` : ''}
      ${P.bad.length ? `<div class="banner warn" style="margin-top:8px">ช่องที่ไม่ใช่ตัวเลข ไม่นำเข้า: ${esc(P.bad.slice(0, 20).join(', '))}${P.bad.length > 20 ? ' …' : ''}</div>` : ''}
      ${D.onlySys.length ? `<div class="banner info" style="margin-top:8px">มีในระบบแต่ไม่มีในแท็บ ${fmtInt(D.onlySys.length)} รายการ (ระบบเก็บไว้ ไม่ลบ)</div>` : ''}
      <div class="row" style="margin-top:10px">${todo ? `<button onclick="rp10Import()">นำเข้า ${fmtInt(todo)} รายการ</button>` : '<span class="muted">ข้อมูลในระบบตรงกับแท็บครบแล้ว ไม่มีอะไรต้องนำเข้า</span>'}<a class="btn secondary" style="text-decoration:none" href="#hh/income" onclick="S._lgd={...(S._lgd||{}),src:'report'}">ดูแดชบอร์ดรายได้ ›</a></div></div>
    <div class="card"><div class="cardhead"><h4>ตรวจยอดรวมกับหัวแท็บ</h4></div><div class="tscroll"><table><thead><tr><th></th><th class="num">คำนวณจากแถว</th><th class="num">หัวแท็บ</th><th>ผล</th></tr></thead><tbody>
      ${chk('รายได้เสริมสะสม', tot.ex, P.head.ex)}${chk('ต้นทุนลดสะสม', tot.cut, P.head.cut)}${chk('ผลตอบแทนสะสม', tot.total, P.head.total)}</tbody></table></div></div>
    <div class="card"><div class="cardhead"><h4>รายเดือน</h4></div><div class="tscroll"><table><thead><tr><th>เดือน</th><th class="num">ครัวเรือน</th><th class="num">รายได้เสริมรวม</th><th class="num">ต้นทุนลดรวม</th><th class="num">เฉลี่ย/ครัวเรือน</th><th class="num">≥ ${lgBaht(LG_TARGET)}</th><th>เทียบระบบ</th></tr></thead><tbody>
      ${ms.map(k => { const a = rows.filter(r => r.month === k), t = sum(a, 'extra_income') + sum(a, 'cost_cut'), n = a[0].n; return `<tr><td class="nowrap">${esc(lgMonthLabel(k.slice(0, 7)))} <span class="muted">(ด.${n})</span></td><td class="num">${fmtInt(a.length)}</td><td class="num">${lgBaht(sum(a, 'extra_income'))}</td><td class="num">${lgBaht(sum(a, 'cost_cut'))}</td><td class="num"><b>${lgBaht(t / a.length)}</b></td><td class="num">${fmtInt(a.filter(r => r.extra_income + r.cost_cut >= LG_TARGET).length)}</td><td>${st(k)}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${D.upd.length ? `<details style="margin-top:8px"><summary>ค่าที่เปลี่ยน (${fmtInt(D.upd.length)})</summary><div class="tscroll"><table><thead><tr><th>รหัส</th><th>เดือน</th><th class="num">รายได้เสริม ระบบ → แท็บ</th><th class="num">ต้นทุนลด ระบบ → แท็บ</th><th>กลุ่ม</th></tr></thead><tbody>${D.upd.map(r => `<tr><td>${esc(r.hh_code)}</td><td>${esc(lgMonthLabel(r.month.slice(0, 7)))}</td><td class="num">${lgBaht(r.old.extra_income)} → ${lgBaht(r.extra_income)}</td><td class="num">${lgBaht(r.old.cost_cut)} → ${lgBaht(r.cost_cut)}</td><td>${esc(r.old.grp ?? '-')} → ${esc(r.grp ?? '-')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</div>`);
}
async function rp10Import() {
  const H = S._hh, D = S._rp10; if (!D) return;
  const n = D.add.length + D.upd.length; if (!n || !confirm(`นำเข้ายอดรายเดือน ${n} รายการ (ใหม่ ${D.add.length} · แก้ ${D.upd.length})?\nระบบไม่ลบข้อมูลเดิม และไม่เขียนกลับชีต`)) return;
  const pj = H.link.project_id;
  try {
    toast('กำลังนำเข้า…');
    for (let i = 0; i < D.add.length; i += 100) await api.insertMany('hh.report_month', D.add.slice(i, i + 100).map(r => ({ project_id: pj, hh_code: r.hh_code, month: r.month, extra_income: r.extra_income, cost_cut: r.cost_cut, grp: r.grp, source: 'sheet10', note: RP10_NOTE })));
    for (const r of D.upd) await api.update('hh.report_month', r.id, { extra_income: r.extra_income, cost_cut: r.cost_cut, grp: r.grp });
    H.rp = await rpLoad(pj); toast(`นำเข้าแล้ว ${n} รายการ`); render();
  } catch (e) { H.rp = await rpLoad(pj); fail(e, 'นำเข้าไม่สำเร็จ (ส่วนที่นำเข้าแล้วยังอยู่ กดนำเข้าอีกครั้งเพื่อทำต่อ)'); render(); }
}

// ---------------------------------------------------------------------
// ข้อมูลอ้างอิง: สำเนาแท็บที่อ่านทั้งแผ่นจากชีต (ดูอย่างเดียว)
// ---------------------------------------------------------------------
const HH_REF_TABS = [['08', 'เกณฑ์ประเมินนวัตกร'], ['10', 'ติดตามผลตอบแทนรายเดือน'], ['11', 'ผลตอบแทน 12 เดือน (สำหรับกรอก PMUA)'], ['pmu', 'ข้อมูลจาก PMU']];
// ระดับจากข้อความ PMU: "นวัตกรระดับ 2" → 2 · "ผู้ใช้ทั่วไป" → 0
const pmuLv = t => { const s = String(t ?? '').trim(), m = s.match(/ระดับ\s*(\d)/); return m ? +m[1] : /ทั่วไป/.test(s) ? 0 : null; };
function pmuParse(values) {
  const V = values || [], hi = V.findIndex(r => String((r || [])[0] ?? '').trim() === 'ชื่อครัวเรือน');
  if (hi < 0) return [];
  return V.slice(hi + 1).filter(r => String((r || [])[0] ?? '').trim()).map(r => {
    const t = String(r[1] ?? ''), m = t.match(/ก่อน:\s*(.+?)\s+หลัง:\s*(.+?)\s*\)/);
    return { name: String(r[0]).trim(), before: m ? m[1].trim() : '', after: m ? m[2].trim() : '', lvBefore: m ? pmuLv(m[1]) : null, lvAfter: m ? pmuLv(m[2]) : null, place: String(r[2] ?? '').trim(), biz: String(r[3] ?? '').trim(), product: String(r[4] ?? '').trim() };
  });
}
function hhRefPage(view) {
  const H = S._hh, st = S._hhref = S._hhref || { k: '08' }, avail = HH_REF_TABS.filter(([k]) => H.byKey[k]);
  if (!H.byKey[st.k]) st.k = (avail[0] || ['08'])[0];
  const T = H.byKey[st.k], vals = T && T.tab.meta ? T.tab.meta.values || [] : [];
  const chips = `<div class="lg-chips" style="margin-bottom:8px">${avail.map(([k, l]) => `<button type="button" class="lg-chip ${k === st.k ? 'on' : ''}" onclick="S._hhref.k='${k}';render()">${esc(l)}</button>`).join('')}</div>`;
  const extra = st.k === 'pmu' && vals.length ? hhPmuCompare(vals) : st.k === '10' && vals.length ? '<div class="banner info" style="margin-bottom:8px">ยอดรายเดือนในแท็บนี้นำเข้าระบบที่ <a href="#hh/import">นำเข้ายอดรายเดือน</a></div>' : st.k === '11' ? '<div class="banner info" style="margin-bottom:8px">เก็บสำเนาไว้ดูเท่านั้น ไม่นำเข้าเป็นผลจริง (แท็บนี้มีค่าของเดือนที่ยังไม่ถึง)</div>' : '';
  view.innerHTML = hhShell('ref', `<div class="card"><div class="cardhead"><h4>ข้อมูลอ้างอิง ${qBtn('ข้อมูลอ้างอิง', '<p>สำเนาแท็บที่ระบบอ่านจากชีตทั้งแผ่นทุกครั้งที่กด "อัปเดตตามนี้" ในหน้าซิงก์ ใช้ดูอย่างเดียว ระบบไม่เขียนกลับ</p>')}</h4>${T && T.tab.meta ? `<span class="muted">อ่านจากชีต ${thDate(T.tab.meta.read_at)}</span>` : ''}</div>${chips}${extra}
    ${vals.length ? `<div class="tscroll" style="max-height:70vh;overflow:auto"><table><tbody>${vals.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="muted">ยังไม่ได้อ่านแท็บนี้จากชีต: ไปที่ <a href="#hh/sync">ซิงก์กับชีต</a> กด "ตรวจกับชีต" แล้ว "อัปเดตตามนี้"</div>`}</div>`);
}
// เทียบระดับตามข้อมูล PMU กับระดับในระบบ (จับคู่ด้วยชื่อ-สกุล ตัดช่องว่าง)
function hhPmuCompare(vals) {
  const H = S._hh, P = pmuParse(vals), norm = s => String(s ?? '').replace(/\s+/g, '');
  const byName = {}; for (const r of H.reg) byName[norm(H.roleVal(r, '01', 'name'))] = r.hh_code;
  const rows = P.map(p => { const code = byName[norm(p.name)] || ''; return { ...p, code, sel: code ? hhIsInnov(code) : null, cur: code ? hhCurLv(code) : '' }; });
  const cnt = (a, f) => [0, 1, 2, 3, 4].map(l => a.filter(x => f(x) === l).length);
  const pa = cnt(rows, x => x.lvAfter), sys = cnt(rows.filter(x => x.code), x => (x.sel ? +x.cur || null : 0));
  const unmatched = rows.filter(x => !x.code).length, diff = rows.filter(x => x.code && ((x.sel ? +x.cur || 0 : 0) !== (x.lvAfter ?? -1))).length;
  const lvl = l => (l === 0 ? 'ผู้ใช้ทั่วไป' : 'ระดับ ' + l);
  return `<div class="banner info" style="margin-bottom:8px">ข้อมูล PMU ${fmtInt(rows.length)} ราย · จับคู่รหัสได้ ${fmtInt(rows.length - unmatched)} ราย${unmatched ? ` · จับคู่ไม่ได้ ${fmtInt(unmatched)} ราย (ชื่อสะกดต่างกัน)` : ''} · ระดับ "หลัง" ของ PMU ต่างจากระดับปัจจุบันในระบบ ${fmtInt(diff)} ราย</div>
    <div class="tscroll" style="margin-bottom:8px"><table style="min-width:0"><thead><tr><th></th>${[0, 1, 2, 3, 4].map(l => `<th class="num">${lvl(l)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>PMU (หลัง)</td>${pa.map(v => `<td class="num">${fmtInt(v)}</td>`).join('')}</tr>
      <tr><td>ระบบ (ระดับปัจจุบัน)</td>${sys.map(v => `<td class="num">${fmtInt(v)}</td>`).join('')}</tr></tbody></table></div>
    <details style="margin-bottom:8px"><summary>รายคน</summary><div class="tscroll"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>PMU ก่อน</th><th>PMU หลัง</th><th>ในระบบ</th><th>ประเภทธุรกิจ · สินค้า</th></tr></thead><tbody>
      ${rows.map(x => { const mine = x.code ? (x.sel ? (x.cur ? 'ระดับ ' + x.cur : 'นวัตกร ยังไม่ประเมิน') : 'ไม่ใช่นวัตกร') : '-', d = x.code && ((x.sel ? +x.cur || 0 : 0) !== (x.lvAfter ?? -1)); return `<tr><td>${x.code ? `<a href="#hh/h/${encodeURIComponent(x.code)}/inv">${esc(x.code)}</a>` : '<span class="muted">ไม่พบ</span>'}</td><td>${esc(x.name)}</td><td>${esc(x.before)}</td><td>${esc(x.after)}</td><td${d ? ' style="color:#C62828;font-weight:600"' : ''}>${esc(mine)}</td><td>${esc([x.biz, x.product].filter(Boolean).join(' · '))}</td></tr>`; }).join('')}
    </tbody></table></div></details>`;
}
