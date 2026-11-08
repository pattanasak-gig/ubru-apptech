/* =====================================================================
   UBRU AppTech System — hh-report.js  ค่าตามรายงาน (แท็บ 10) + ระดับนวัตกรรายคน (DEC-132)
   hh.report_month: รายได้เสริม + ต้นทุนลด รายเดือน ตามชีต 10 · แสดงในแดชบอร์ดรายได้เมื่อเลือก "ตามรายงาน (ชีต 10)"
   hh.innov_level:  ระดับรายคน 1–4 ต่อรอบ (นับระดับสูงสุดที่แสดงออกจริง ตามรายงาน 6 เดือน) · กรอกในหน้านวัตกรชุมชน
   ===================================================================== */
async function rpLoad(projectId) {
  try {
    const [months, levels] = await Promise.all([api.list('hh.report_month', { eq: { project_id: projectId }, order: ['month'] }), api.list('hh.innov_level', { eq: { project_id: projectId } })]);
    const lv = {}; for (const x of levels) (lv[x.hh_code] = lv[x.hh_code] || {})[x.round] = x;
    return { months, levels: lv };
  } catch (e) { console.warn('hh.report_month / hh.innov_level (sql/025) missing:', e && e.message); return null; }
}
// แถวรายครัวเรือนรายเดือน รูปแบบเดียวกับ lgRows (ใช้แดชบอร์ดเดิม): จ. = รายได้เสริม · ต้นทุนลด = ต้นทุนลด
function rpRows() {
  const H = S._hh; if (!H.rp) return [];
  return H.rp.months.map(m => { const reg = H.reg.find(x => x.hh_code === m.hh_code), ex = +m.extra_income || 0, cut = +m.cost_cut || 0;
    return { m, code: m.hh_code, month: String(m.month).slice(0, 7), src: 'report', grp: m.grp,
      sums: { e_direct: 0, e_indirect: 0, e_other: 0, i_related: 0, i_project: ex, i_other: 0, self_qty: 0, income: ex, expense: 0, net: ex },
      base: { e_direct: null, i_related: null }, g: { proj: ex, cut, rel: 0, total: ex + cut, noBaseE: false, noBaseI: false },
      reg, moo: reg ? String(H.roleVal(reg, '01', 'moo') ?? '').trim() : '', tambon: reg ? String(H.roleVal(reg, '01', 'tambon') ?? '').trim() : '', name: reg ? H.roleVal(reg, '01', 'name') || '' : '' }; });
}
// ระดับรายคน · เป้าหมายรายระดับตามสไลด์รายงาน 6 เดือน (รวม 30 คน · ระดับ 3–4 ไม่น้อยกว่า 8 คนตามสัญญา)
const RP_LV_TARGET = { 4: 2, 3: 6, 2: 10, 1: 12 };
const RP_LV_NAME = { 1: 'Co-Ordinator', 2: 'Co-Creator', 3: 'Trainer', 4: 'Change Agent' };
const rpLevel = (code, round) => { const x = ((S._hh.rp || {}).levels || {})[code]; return x && x[round] ? x[round].level : null; };
async function rpLevelSet(code, round, level) {
  const H = S._hh; if (!H.rp) return toastErr('ยังไม่ได้รัน sql/025', 'รันไฟล์ 025 ใน SQL Editor ก่อน');
  const cur = ((H.rp.levels || {})[code] || {})[round], val = cur && cur.level === level ? null : level;   // กดซ้ำ = ล้าง
  try {
    if (cur) await api.update('hh.innov_level', cur.id, { level: val }); else await api.insert('hh.innov_level', { project_id: H.link.project_id, hh_code: code, round, level: val });
    H.rp = await rpLoad(H.link.project_id); render();
  } catch (e) { fail(e, 'บันทึกระดับไม่สำเร็จ'); }
}
// การ์ดสรุประดับรายคนของรอบที่เลือก (หน้านวัตกรชุมชน)
function rpLevelCard(sel) {
  const H = S._hh, st = S._inv; if (!H.rp) return '<div class="card"><div class="banner warn">ยังไม่มีส่วนระดับรายคน (รัน sql/025)</div></div>';
  const r = st.lvRound || 2, n = l => sel.filter(x => rpLevel(x.code, r) === l).length, none = sel.filter(x => rpLevel(x.code, r) == null).length, hi = n(3) + n(4);
  return `<div class="card"><div class="cardhead"><h4>ระดับนวัตกรรายคน ${qBtn('ระดับรายคน', '<p>นับระดับสูงสุดที่แสดงออกจริง ระดับสูงต้องทำบทบาทของระดับต่ำกว่าได้ด้วย (รายงานความก้าวหน้า 6 เดือน)</p><p>Co-Ordinator (1) · Co-Creator (2) · Trainer (3) · Change Agent (4)</p><p>เก็บในระบบ ไม่ซิงก์ลงชีต (ชีต 07 ไม่มีคอลัมน์นี้) · คะแนน 3 มิติยังบันทึกที่ชีต 07 ตามเดิม</p>')}</h4>
    <div class="lg-chips">${[1, 2, 3].map(x => `<button type="button" class="lg-chip ${r === x ? 'on' : ''}" onclick="S._inv.lvRound=${x};render()">รอบ ${x}</button>`).join('')}<button type="button" class="lg-chip ${st.lvEdit ? 'on' : ''}" onclick="S._inv.lvEdit=!S._inv.lvEdit;render()">${st.lvEdit ? 'เสร็จ' : 'กรอกระดับรายคน'}</button></div></div>
    <div class="kpis">${[4, 3, 2, 1].map(l => `<div class="kpi"><div class="l">ระดับ ${l} · ${RP_LV_NAME[l]}</div><div class="v">${fmtInt(n(l))} <span class="muted" style="font-size:14px">คน</span></div><div class="muted">เป้าหมาย ${RP_LV_TARGET[l]} คน</div></div>`).join('')}<div class="kpi"><div class="l">ระดับ 3–4 รวม (เป้า ≥ 8)</div><div class="v" style="color:${hi >= 8 ? '#2E7D32' : '#C62828'}">${fmtInt(hi)}</div></div></div>
    ${none ? `<div class="muted" style="margin-top:6px">ยังไม่ให้ระดับรอบ ${r}: ${fmtInt(none)} คน ${st.lvEdit ? '' : '· กด "กรอกระดับรายคน" แล้วกดเลข 1–4 ในตารางด้านล่าง'}</div>` : ''}</div>`;
}
// ช่องระดับรายคนในตาราง: แสดงผล หรือปุ่ม 1–4 เมื่ออยู่ในโหมดกรอก
function rpLevelCell(code) {
  const st = S._inv, r = st.lvRound || 2, v = rpLevel(code, r);
  if (!st.lvEdit) return v == null ? '<span class="muted">–</span>' : invChip(v);
  return `<span class="nowrap" onclick="event.stopPropagation()">${[1, 2, 3, 4].map(l => `<button type="button" class="lg-q ${v === l ? 'on' : ''}" style="min-width:34px;${v === l ? 'background:var(--brand);color:#fff' : ''}" onclick="rpLevelSet('${esc(code)}',${r},${l})">${l}</button>`).join('')}</span>`;
}
