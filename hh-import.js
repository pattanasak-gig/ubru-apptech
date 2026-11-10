/* =====================================================================
   UBRU AppTech System — hh-import.js  นำเข้ายอดรายเดือน + ข้อมูลอ้างอิงที่ดึงจากชีต (DEC-136)
   Gig 10 พ.ย. 2569: "ดำเนินการเลย … ตรวจสอบทุกชีตและส่วนที่เกี่ยวข้องให้ครบ" (เตรียมเลิกใช้ชีต)
   (เลิกใช้ชีตแล้ว DEC-137 · หน้านำเข้าถอดออก)
   ขั้นตอนที่ใช้: sql/027 เพิ่มแท็บอ่านทั้งแผ่น 10 · 11 · pmu → "ซิงก์กับชีต" อ่านสำเนาเก็บใน hh.tab.meta
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

// หน้านำเข้า (hhImportPage) ใช้ครั้งเดียว 10 พ.ย. 2569 นำเข้าครบ 420 แถวแล้ว ถอดออกเมื่อเลิกใช้ชีต (DEC-137) · ฟังก์ชันแปลง/เทียบด้านบนเก็บไว้เป็นหลักฐานวิธีนำเข้า (มีชุดทดสอบ)

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
  const extra = st.k === 'pmu' && vals.length ? hhPmuCompare(vals) : st.k === '10' && vals.length ? '<div class="banner info" style="margin-bottom:8px">ยอดรายเดือนในแท็บนี้นำเข้าระบบแล้ว (10 พ.ย. 2569) ดูได้ที่ <a href="#hh/income">แดชบอร์ดรายได้</a></div>' : st.k === '11' ? '<div class="banner info" style="margin-bottom:8px">เก็บสำเนาไว้ดูเท่านั้น ไม่นำเข้าเป็นผลจริง (แท็บนี้มีค่าของเดือนที่ยังไม่ถึง)</div>' : '';
  view.innerHTML = hhShell('ref', `<div class="card"><div class="cardhead"><h4>ข้อมูลอ้างอิง ${qBtn('ข้อมูลอ้างอิง', '<p>สำเนาแท็บจาก Google Sheet ชุดสุดท้ายก่อนเลิกใช้ชีต (10 พ.ย. 2569) เก็บไว้ดูอย่างเดียว</p>')}</h4>${T && T.tab.meta ? `<span class="muted">สำเนาจากชีตเดิม ${thDate(T.tab.meta.read_at)}</span>` : ''}</div>${chips}${extra}
    ${vals.length ? `<div class="tscroll" style="max-height:70vh;overflow:auto"><table><tbody>${vals.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="muted">ไม่มีสำเนาของแท็บนี้</div>'}</div>`);
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
