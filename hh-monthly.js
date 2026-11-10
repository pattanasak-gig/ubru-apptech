/* =====================================================================
   UBRU AppTech System — hh-monthly.js  บันทึกยอดรายเดือน (รายได้เสริม + ต้นทุนลด) แทนแท็บ 10 ที่เลิกใช้ (DEC-138)
   Gig 10 พ.ย. 2569: "ทั้งสองแบบ" + "ถ้ากรอกแบบละเอียดต้องรวมเป็นรายเดือนให้อัตโนมัติ และเลือกบันทึกยอดรวมเฉพาะเดือนได้
     ไม่กรอกรายละเอียดไม่ต้องคำนวณ แต่บังคับให้ไปกรอกยอดรวม"
   กติกา: 1 ครัวเรือน 1 เดือน มียอดรายเดือน 1 แถว (hh.report_month) ซึ่งแดชบอร์ดใช้
     · เดือนที่มี "บันทึกแยกรายการ" → ระบบรวมให้อัตโนมัติ (source = 'ledger') และล็อกช่องในหน้านี้
         รายได้เสริม = จ. รายได้จากโครงการ + (ง. รายได้เดิมที่เกี่ยวข้อง − ฐาน ง.) · ต้นทุนลด = (ฐาน ก. − ก.) ตามสูตรเดิม (lgGain)
     · เดือนที่ไม่มีรายละเอียด → กรอกยอดรวมเองในหน้านี้ (source = 'manual') · ยังไม่กรอก = ขึ้นรายชื่อที่ต้องกรอก
     · ยกเลิกรายละเอียดของเดือนนั้น → ล้างยอดที่รวมไว้ (กลับเป็นต้องกรอกยอดรวม) · ลบแถวจริงทำได้เฉพาะ super admin (ฐานข้อมูล)
   ===================================================================== */
const MF_NOTE_LEDGER = 'รวมอัตโนมัติจากบันทึกแยกรายการ';
const mfRound = v => Math.round(v * 100) / 100;
// ยอดรายเดือนจากแถวบันทึกแยกรายการ (lgRows) — ฟังก์ชันล้วน ทดสอบได้
const mfFromLedger = r => ({ extra_income: mfRound(r.g.proj + r.g.rel), cost_cut: mfRound(r.g.cut) });
const mfRec = (code, month) => ((S._hh.rp || {}).months || []).find(x => x.hh_code === code && String(x.month).slice(0, 7) === month) || null;
const mfHas = x => !!x && (x.extra_income != null || x.cost_cut != null);
// กลุ่มรายงานล่าสุดของครัวเรือน (ใช้ต่อกับเดือนใหม่)
const mfGrp = code => { const xs = ((S._hh.rp || {}).months || []).filter(x => x.hh_code === code && x.grp).sort((a, b) => String(b.month).localeCompare(String(a.month))); return xs.length ? xs[0].grp : null; };

// รวมรายละเอียด → ยอดรายเดือน · คืนจำนวนแถวที่เปลี่ยน
//   only = [{code, month}] → รวมเดือนนั้น (กดบันทึกในหน้า "บันทึกแยกรายการ" หรือหน้า "รับหนอน/บริการ" ที่กรอกต้นทุน/รายได้)
//   ไม่ระบุ only → รวมใหม่เฉพาะเดือนที่เคยรวมจากรายละเอียดแล้ว (source = 'ledger') เช่น หลังแก้ค่าฐาน
//   รายละเอียดที่มีอยู่ก่อนกติกานี้ (ยังไม่เคยรวม) จะไม่ถูกรวมเองจนกว่าจะเปิดแล้วกดบันทึก
async function lgToMonthly(codes, only) {
  const H = S._hh; if (!H || !H.rp || !H.lg) return 0;
  const pj = H.link.project_id, same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(+a - +b) < 0.005);
  const inCodes = c => !codes || codes.includes(c), isOnly = r => (only || []).some(o => o.code === r.code && o.month === r.month);
  const led = lgRows().filter(r => inCodes(r.code)), keys = new Set(led.map(r => r.code + '|' + r.month));
  let n = 0;
  for (const r of led) {
    const v = mfFromLedger(r), e = mfRec(r.code, r.month);
    if (e && e.source === 'sheet10') continue;   // ยอดตามรายงานที่ส่งแล้ว (นำเข้าจากชีต) ไม่แทนที่
    if (!isOnly(r) && !(e && e.source === 'ledger')) continue;
    if (e && e.source === 'ledger' && same(e.extra_income, v.extra_income) && same(e.cost_cut, v.cost_cut)) continue;
    const patch = { ...v, source: 'ledger', note: MF_NOTE_LEDGER };
    if (e) await api.update('hh.report_month', e.id, patch); else await api.insert('hh.report_month', { project_id: pj, hh_code: r.code, month: r.month + '-01', grp: mfGrp(r.code), ...patch });
    n++;
  }
  // รายละเอียดถูกยกเลิก → ล้างยอดที่รวมไว้ ให้กลับไปกรอกยอดรวม
  for (const e of (H.rp.months || []).filter(x => x.source === 'ledger' && inCodes(x.hh_code) && !keys.has(x.hh_code + '|' + String(x.month).slice(0, 7)) && mfHas(x))) {
    await api.update('hh.report_month', e.id, { extra_income: null, cost_cut: null, source: 'manual', note: 'ยกเลิกรายละเอียดแล้ว ต้องกรอกยอดรวม' }); n++;
  }
  if (n) H.rp = await rpLoad(pj);
  return n;
}
// เดือนที่รวมจากรายละเอียดแล้ว แต่ยอดไม่ตรงกับรายละเอียดปัจจุบัน
function mfOutOfSync() {
  const H = S._hh; if (!H.rp || !H.lg) return [];
  return lgRows().filter(r => { const e = mfRec(r.code, r.month), v = mfFromLedger(r); return e && e.source === 'ledger' && (Math.abs((+e.extra_income || 0) - v.extra_income) > 0.005 || Math.abs((+e.cost_cut || 0) - v.cost_cut) > 0.005); });
}

// ---------------------------------------------------------------------
// หน้า #hh/monthly[/YYYY-MM]
// ---------------------------------------------------------------------
function hhMonthlyPage(view, month) {
  const H = S._hh;
  if (!H.rp) return view.innerHTML = hhShell('monthly', '<div class="card"><div class="banner warn">ฐานข้อมูลยังไม่มีตารางยอดรายเดือน (รัน sql/025)</div></div>');
  const now = lgThisMonth(); month = /^\d{4}-\d{2}$/.test(month || '') && month <= now ? month : lgShift(now, -1);
  const st = S._mf = S._mf && S._mf.month === month ? S._mf : { month, vals: {}, q: (S._mf || {}).q || '', tambon: (S._mf || {}).tambon || '', todo: (S._mf || {}).todo || false };
  const led = Object.fromEntries((H.lg ? lgRows() : []).filter(r => r.month === month).map(r => [r.code, r]));
  const prevM = lgShift(month, -1), tx = (r, role) => String(H.roleVal(r, '01', role) ?? '').trim();
  const rows = H.reg.map(r => { const code = r.hh_code, e = mfRec(code, month), p = mfRec(code, prevM), L = led[code];
    return { r, code, name: tx(r, 'name'), tambon: tx(r, 'tambon'), moo: tx(r, 'moo'), e, p, L, lock: !!e && (e.source === 'ledger' || e.source === 'sheet10'), rep: !!e && e.source === 'sheet10', done: mfHas(e) }; });
  const tambons = [...new Set(rows.map(x => x.tambon).filter(Boolean))].sort(), t = st.q.trim().toLowerCase();
  const list = rows.filter(x => (!st.tambon || x.tambon === st.tambon) && (!st.todo || !x.done) && (!t || [x.code, x.name, x.tambon, 'ม.' + x.moo].some(v => String(v).toLowerCase().includes(t))));
  const nDone = rows.filter(x => x.done).length, nLed = rows.filter(x => x.lock).length, oos = mfOutOfSync();
  const months = [0, -1, -2, -3].map(k => lgShift(now, k));
  const cnt = m => H.reg.filter(r => mfHas(mfRec(r.hh_code, m))).length;
  const val = (x, k) => { const v = !x.lock && st.vals[x.code] && st.vals[x.code][k] !== undefined ? st.vals[x.code][k] : x.e ? x.e[k] : null; return v == null ? '' : v; };
  const help = qBtn('บันทึกยอดรายเดือน', `<p>ทุกครัวเรือนต้องมียอด "รายได้เสริม" และ "ต้นทุนลด" ทุกเดือน แดชบอร์ดรายได้ใช้ยอดนี้เทียบเป้า ${lgBaht(LG_TARGET)} บาท/ครัวเรือน/เดือน</p><p><b>กรอกแบบละเอียด</b> แล้วกดบันทึกในหน้า "บันทึกแยกรายการ" → ระบบรวมเป็นยอดของเดือนนั้นให้อัตโนมัติและล็อกช่อง (แก้ที่หน้ารายละเอียด) · ต้นทุนและรายได้ที่กรอกในหน้า "รับหนอน/บริการ" นับเป็นรายละเอียดเช่นกัน<br>รายได้เสริม = จ. รายได้จากโครงการ + (ง. รายได้เดิมที่เกี่ยวข้อง − ฐาน ง.) · ต้นทุนลด = ฐาน ก. − ก. รายจ่ายที่โครงการลดได้</p><p><b>ไม่มีรายละเอียด</b> → กรอกยอดรวมเองในหน้านี้ (ไม่ต้องคำนวณ)</p><p>ยอดตามรายงานที่นำเข้าจากชีตเดิม (เม.ย.–ต.ค. 2569) ล็อกไว้ ไม่ถูกแทนที่ทั้งจากการกรอกและจากรายละเอียด เพื่อให้ตรงกับรายงานที่ส่งแล้ว</p><p>เดือนอนาคตบันทึกไม่ได้ · แถวที่กรอกเองแก้ได้ · ลบได้เฉพาะ super admin</p>`);
  view.innerHTML = hhShell('monthly', `<div class="card"><div class="cardhead"><h4>บันทึกยอดรายเดือน ${help}</h4><a class="small" href="#hh/income" onclick="S._lgd={...(S._lgd||{}),src:'report'}">แดชบอร์ดรายได้ ›</a></div>
      <div class="lg-chips">${months.map(m => `<a class="lg-chip ${m === month ? 'on' : ''}" href="#hh/monthly/${m}">${esc(lgMonthLabel(m))} <span class="muted">${fmtInt(cnt(m))}/${fmtInt(H.reg.length)}</span></a>`).join('')}<label style="margin:0">เดือนอื่น <input type="month" max="${now}" value="${month}" style="width:auto" onchange="if(this.value)location.hash='#hh/monthly/'+this.value"></label></div>
      <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">บันทึกแล้ว ${esc(lgMonthLabel(month))}</div><div class="v">${fmtInt(nDone)} / ${fmtInt(rows.length)}</div><div class="muted" style="color:#dbeafe">จากรายละเอียด ${fmtInt(nLed)} · ยอดรวม ${fmtInt(nDone - nLed)}</div></div>
        <div class="kpi"><div class="l">ยังไม่บันทึก</div><div class="v" style="color:${rows.length - nDone ? '#C62828' : '#2E7D32'}">${fmtInt(rows.length - nDone)}</div><div class="muted">ต้องกรอกยอดรวม หรือบันทึกแยกรายการ</div></div></div>
      ${oos.length ? `<div class="banner warn" style="margin-top:8px">ยอดรวม ${fmtInt(oos.length)} รายการยังไม่ตรงกับรายละเอียด (เช่น แก้ค่าฐานภายหลัง) <button class="small" onclick="mfResync()">รวมใหม่จากรายละเอียด</button></div>` : ''}
      <div class="row" style="gap:8px;margin:10px 0 6px;flex-wrap:wrap;align-items:center"><input type="search" aria-label="ค้นหาครัวเรือน" placeholder="ชื่อ · รหัส · หมู่ · ตำบล" value="${esc(st.q)}" style="max-width:240px" onchange="S._mf.q=this.value;render()">
        <select aria-label="ตำบล" style="width:auto" onchange="S._mf.tambon=this.value;render()"><option value="">ทุกตำบล</option>${tambons.map(x => `<option ${x === st.tambon ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <label class="chk" style="margin:0"><input type="checkbox" ${st.todo ? 'checked' : ''} onchange="S._mf.todo=this.checked;render()"> เฉพาะที่ยังไม่บันทึก</label>
        <button class="small secondary" onclick="mfCopyPrev()">เติมค่าเดือนก่อนในแถวที่ว่าง</button></div>
      <div class="tscroll"><table class="mf"><thead><tr><th>ครัวเรือน</th><th class="num">เดือนก่อน</th><th class="num">รายได้เสริม (บาท)</th><th class="num">ต้นทุนลด (บาท)</th><th class="num">รวม</th><th></th></tr></thead><tbody>
      ${list.map(x => { const ex = val(x, 'extra_income'), ct = val(x, 'cost_cut'), tot = (+ex || 0) + (+ct || 0), has = ex !== '' || ct !== '', s = lgStatus(tot);
        const inp = (k, v) => x.lock ? `<b>${lgBaht(v)}</b>` : `<input type="text" inputmode="decimal" aria-label="${k === 'extra_income' ? 'รายได้เสริม' : 'ต้นทุนลด'} ${esc(x.code)}" value="${esc(String(v))}" style="width:110px;text-align:right" onchange="mfSet('${esc(x.code)}','${k}',this.value)">`;
        return `<tr><td class="nowrap"><b>${esc(x.code)}</b> ${esc(x.name)}<div class="muted" style="font-size:12px">${x.moo ? 'ม.' + esc(x.moo) + ' ' : ''}ต.${esc(x.tambon)}${mfGrp(x.code) ? ' · กลุ่ม ' + esc(mfGrp(x.code)) : ''}</div></td>
          <td class="num muted" data-l="เดือนก่อน">${mfHas(x.p) ? `${lgBaht(x.p.extra_income)} / ${lgBaht(x.p.cost_cut)}` : '–'}</td><td class="num" data-l="รายได้เสริม (บาท)">${inp('extra_income', ex)}</td><td class="num" data-l="ต้นทุนลด (บาท)">${inp('cost_cut', ct)}</td>
          <td class="num nowrap" data-l="รวม">${has ? `<i class="dot" style="background:${s.c}"></i> ${lgBaht(tot)}` : '<span style="color:#C62828">ยังไม่บันทึก</span>'}</td>
          <td class="nowrap">${x.rep ? '<span class="muted" title="ยอดตามรายงานที่ส่งแล้ว นำเข้าจากชีตเดิม ระบบล็อกไว้">ตามรายงาน (ล็อก)</span>' : x.lock ? `<a class="small" href="#hh/ledger/${encodeURIComponent(x.code)}/${month}">จากรายละเอียด · แก้ ›</a>` : x.L ? `<a class="small" href="#hh/ledger/${encodeURIComponent(x.code)}/${month}" title="มีรายละเอียดที่ยังไม่เคยรวม เปิดแล้วกดบันทึกเพื่อรวมเป็นยอดเดือนนี้">มีรายละเอียด · กดบันทึกเพื่อรวมยอด ›</a>` : `<a class="small" href="#hh/ledger/${encodeURIComponent(x.code)}/${month}">กรอกแบบละเอียด ›</a>`}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">ไม่มีครัวเรือนตามตัวกรอง</td></tr>'}
      </tbody></table></div>
      <div class="lg-bar"><div class="card" style="margin:8px 0 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="mfDirty" class="muted">${mfDirtyText()}</span><button onclick="mfSave()">บันทึก</button></div></div></div>`);
}
function mfDirtyText() { const n = Object.keys((S._mf || {}).vals || {}).length; return n ? `แก้ไขแล้ว ${n} ครัวเรือน ยังไม่ได้บันทึก` : 'กรอกตัวเลขแล้วกดบันทึก (บันทึกทีเดียวได้หลายครัวเรือน)'; }
function mfSet(code, k, raw) {
  const t = String(raw ?? '').replace(/,/g, '').trim(), v = t === '' ? null : Number(t);
  if (t !== '' && !isFinite(v)) return toastErr('ตัวเลขไม่ถูกต้อง', 'ใส่ตัวเลข เช่น 1500 หรือเว้นว่าง');
  const o = S._mf.vals[code] = S._mf.vals[code] || {}; o[k] = v; const el = $('#mfDirty'); if (el) el.textContent = mfDirtyText();
}
function mfCopyPrev() {
  const H = S._hh, st = S._mf, prevM = lgShift(st.month, -1); let n = 0;
  for (const r of H.reg) { const code = r.hh_code, e = mfRec(code, st.month), p = mfRec(code, prevM);
    if (mfHas(e) || st.vals[code] || !mfHas(p)) continue; st.vals[code] = { extra_income: p.extra_income, cost_cut: p.cost_cut }; n++; }
  toast(n ? `เติมค่าเดือนก่อนแล้ว ${n} ครัวเรือน ตรวจแล้วกดบันทึก` : 'ไม่มีแถวว่างที่มีค่าเดือนก่อน'); render();
}
async function mfSave() {
  const H = S._hh, st = S._mf, codes = Object.keys(st.vals); if (!codes.length) return toast('ยังไม่มีอะไรเปลี่ยน');
  try {
    let n = 0;
    for (const code of codes) {
      const v = st.vals[code], e = mfRec(code, st.month), cur = { extra_income: e ? e.extra_income : null, cost_cut: e ? e.cost_cut : null, ...v };
      if (e) { if (e.source === 'ledger' || e.source === 'sheet10') continue; await api.update('hh.report_month', e.id, { extra_income: cur.extra_income, cost_cut: cur.cost_cut, source: 'manual' }); n++; }
      else if (cur.extra_income != null || cur.cost_cut != null) { await api.insert('hh.report_month', { project_id: H.link.project_id, hh_code: code, month: st.month + '-01', extra_income: cur.extra_income, cost_cut: cur.cost_cut, grp: mfGrp(code), source: 'manual' }); n++; }
    }
    st.vals = {}; H.rp = await rpLoad(H.link.project_id); toast(`บันทึกยอดรายเดือนแล้ว ${n} ครัวเรือน`); render();
  } catch (e) { H.rp = await rpLoad(H.link.project_id); fail(e, 'บันทึกไม่สำเร็จ (แถวที่บันทึกแล้วยังอยู่ กดบันทึกอีกครั้ง)'); render(); }
}
async function mfResync() { try { const n = await lgToMonthly(); toast(`รวมใหม่แล้ว ${n} รายการ`); render(); } catch (e) { fail(e, 'รวมใหม่ไม่สำเร็จ'); } }
