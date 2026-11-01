/* =====================================================================
   UBRU AppTech System — carbon-tree.js  ก๊าซที่หลีกเลี่ยงได้ + เทียบการดูดซับของต้นไม้ (DEC-124)
   ตามแชทคาร์บอน CARBON-TREE-R01/R02 (วิธีเดียวกับบทความวิจัย):
     A = กก. × EF ฝังกลบ (lf_main 0.571 · lf_alt 0.7933 ขอบบน/อนุมาน) · B = A − ขนส่ง · C = B − การเลี้ยงหนอน
     ต้นไม้ N = E ÷ k (k = 15 หลัก · 12 เทียบ) = จำนวนต้นที่ต้องใช้ดูดซับเป็นเวลา 1 ปี · M เดือน = E ÷ (k ÷ 12)
     ประโยคหลักใช้ชุดที่ได้ต้นไม้น้อยที่สุด (C · 0.571 · 15) "ไม่น้อยกว่า" · ขอบบน A · 0.7933 · 12 "ราว"
     ตัวเลขที่ประชาชนเห็นปัดลงเสมอ · ค่าติดลบเก็บจริง แสดง 0 พร้อมข้อความ · ห้ามแปลงค่าติดลบเป็นต้นไม้
   ใช้ร่วม: หน้าคาร์บอน · แดชบอร์ด · หน้าสาธารณะ · รายงานแหล่ง/PDF · ลิงก์สาธารณะ (ต้องมี esc, thDay จาก common.js)
   ===================================================================== */
const CT_NEG = 'การปล่อยจากการขนส่งเท่ากับหรือมากกว่าการปล่อยที่หลีกเลี่ยงได้';
const CT_STAR = '* ค่า 0.7933 เป็นค่าของการฝังกลบขยะมูลฝอยชุมชนโดยรวม ไม่ใช่ของเศษอาหารโดยเฉพาะ และบัญชีต้นทางไม่ได้ระบุว่ารวมก๊าซมีเทนจากการย่อยสลายหรือไม่ (อนุมานจากค่าของบ่อที่นำมีเทนไปใช้ซึ่งเท่ากับ 0.0175) จึงใช้เป็นขอบบนของช่วงเท่านั้น';
const CT_SRC_NOTE = 'ตัวเลขนี้เป็นการปล่อยก๊าซเรือนกระจกที่หลีกเลี่ยงได้โดยประมาณเพื่อการสื่อสาร ใช้ประกอบรายงานความยั่งยืนได้โดยแสดงแยกจากบัญชีก๊าซเรือนกระจกขององค์กร ห้ามนำไปหักออกจากบัญชี ห้ามนำไปรวมกับตัวเลขที่ศูนย์หรือเทศบาลรายงาน และไม่ใช่คาร์บอนเครดิต';
const CT_ALLOC_NOTE = 'แบ่งค่าขนส่งของเที่ยวตามสัดส่วนน้ำหนัก เพราะระบบไม่ได้บันทึกลำดับจุดรับรายเที่ยว ISO 14083:2023 แนะนำให้แบ่งตามกิจกรรมการขนส่ง (น้ำหนัก × ระยะทาง) ซึ่งจะใช้ได้เมื่อระบบบันทึกลำดับจุดรับรายเที่ยวแล้ว';

// ปัดลง d ตำแหน่ง (toPrecision กันเศษทศนิยมของเลขฐานสอง เช่น 68.52 × 100 = 6851.999…)
const ctFloor = (x, d = 0) => { const m = 10 ** d; return Math.floor(Number((Number(x) * m).toPrecision(12))) / m; };
const ctNum = (x, d) => Number(x).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const ctF2 = x => (x == null || x === '' || isNaN(Number(x)) ? '-' : ctNum(ctFloor(x, 2), 2));   // ทศนิยม 2 ตำแหน่ง ปัดลง (ตารางหน้าสาธารณะ)
// kgCO2e: ต่ำกว่า 1,000 → kg ทศนิยม 2 · ตั้งแต่ 1,000 → ตัน ทศนิยม 2 (ปัดลงทั้งคู่) · unit: 'long' = คำเต็ม, 'short' = tCO2e
function ctCO2(kg, unit = 'long') {
  const v = Number(kg) || 0;
  if (Math.abs(v) >= 1000) return { n: ctNum(ctFloor(v / 1000, 2), 2), u: unit === 'long' ? 'ตันคาร์บอนไดออกไซด์เทียบเท่า' : 'tCO2e', t: true };
  return { n: ctNum(ctFloor(v, 2), 2), u: 'kgCO2e', t: false };
}
const ctCO2Text = (kg, unit) => { const c = ctCO2(kg, unit); return `${c.n} ${c.u}`; };
// ช่วง 2 ค่า ใช้หน่วยเดียวกันตามค่าที่มากกว่า
function ctRange(lo, hi, star = '') {
  const big = Math.max(Number(lo) || 0, Number(hi) || 0) >= 1000;
  const f = v => big ? ctNum(ctFloor(v / 1000, 2), 2) : ctNum(ctFloor(v, 2), 2);
  return `${f(lo)}–${f(hi)}${star} ${big ? 'ตันคาร์บอนไดออกไซด์เทียบเท่า' : 'kgCO2e'}`;
}
// จำนวนต้นไม้ (ปัดลง): ต่ำกว่า 10 → ทศนิยม 1 · 10–999 → จำนวนเต็ม · ตั้งแต่ 1,000 → หลักร้อย
function ctTreeNum(n) {
  n = Number(n) || 0;
  if (n < 10) return ctNum(ctFloor(n, 1), 1);
  if (n < 1000) return ctNum(ctFloor(n, 0), 0);
  return ctNum(Math.floor(Number(n.toPrecision(12)) / 100) * 100, 0);
}
const ctTreeLabel = n => (Number(n) >= 1000 ? 'ไม่น้อยกว่า ' : '') + ctTreeNum(n);
// เดือน (ปัดลง): ต่ำกว่า 1 → "ไม่ถึง 1 เดือน" · ตั้งแต่ 12 → "X ปี Y เดือน"
function ctMonths(m) {
  const f = Math.floor(Number((Number(m) || 0).toPrecision(12)));
  if (f < 1) return 'ไม่ถึง 1 เดือน';
  if (f < 12) return `${f} เดือน`;
  return `${Math.floor(f / 12)} ปี${f % 12 ? ` ${f % 12} เดือน` : ''}`;
}
// วลีต้นไม้ตามเกณฑ์ R02 ข้อ 2: N ≥ 1 → ต้นก่อน ตามด้วยเวลา · 0.1 ≤ N < 1 → เวลาก่อน (N ต้น) · N < 0.1 → เวลาอย่างเดียว · E ≤ 0 → null
function ctTreePhrase(E, k, withTime = true) {
  E = Number(E); k = Number(k);
  if (!(E > 0) || !(k > 0)) return null;
  const N = E / k, time = `เท่ากับที่ต้นไม้ 1 ต้นดูดซับได้ใน ${ctMonths(E / (k / 12))}`;
  if (N >= 1) return `เท่ากับต้นไม้ไม่น้อยกว่า ${ctTreeNum(N)} ต้นดูดซับเป็นเวลา 1 ปี${withTime ? ` หรือ${time}` : ''}`;
  if (N >= 0.1) return `${time} (${ctTreeNum(N)} ต้น)`;
  return time;
}

// ค่าตามบทบาท (report_role) · ถ้ายังไม่มีบทบาท (ก่อนรัน 021) ใช้ค่าหลักเดิม
function ctFactors(factors) {
  const F = (factors || []).filter(f => f.status === undefined || f.status === 'active');
  const role = r => F.find(f => f.report_role === r) || null;
  const prim = c => F.find(f => f.category === c && f.is_primary) || null;
  return { lfMain: role('lf_main') || prim('landfill'), lfAlt: role('lf_alt'), treeMain: role('tree_main'), treeAlt: role('tree_alt'), pr: prim('process'),
    fuel: F.filter(f => f.category === 'fuel' && f.is_primary), fe: prim('fuel_economy'), ready: !!(role('lf_main') && role('lf_alt') && role('tree_main') && role('tree_alt')) };
}
// ชุดค่า A/B/C จากผลรวม: { kg, a, aAlt, t, p, first, last }
function ctSet(x) {
  const kg = +x.kg || 0, a = +x.a || 0, aAlt = x.aAlt == null ? null : +x.aAlt, t = +x.t || 0, p = +x.p || 0;
  return { kg, t, p, first: x.first || null, last: x.last || null, name: x.name || '',
    A: { main: a, alt: aAlt }, B: { main: a - t, alt: aAlt == null ? null : aAlt - t }, C: { main: a - t - p, alt: aAlt == null ? null : aAlt - t - p } };
}
const ctPeriod = s => (s.first ? (s.first === s.last ? thDay(s.first) : `ตั้งแต่ ${thDay(s.first)} ถึง ${thDay(s.last)}`) : '-');

// ประโยค 6.1 / 6.2 (รายแหล่ง) · star = '*' หน้าประชาชน หรือ ' (อนุมาน)' หน้า admin
function ctSourceSentence(s, fx, star = '*') {
  const kMain = fx.treeMain ? +fx.treeMain.value : null;
  let out = `${s.name} ส่งเศษอาหารเลี้ยงหนอน BSF ${ctNum(ctFloor(s.kg, 2), 2)} กก. (${ctPeriod(s)}) หลีกเลี่ยงก๊าซเรือนกระจกจากการฝังกลบได้ `
    + (s.A.alt == null ? ctCO2Text(s.A.main) : ctRange(s.A.main, s.A.alt, star)) + ' หักการขนส่งและการเลี้ยงหนอนแล้ว';
  if (!(s.C.main > 0)) return out + `เหลือ 0 kgCO2e (${CT_NEG})`;
  const tp = kMain ? ctTreePhrase(s.C.main, kMain) : null;
  return out + `เหลือไม่น้อยกว่า ${ctCO2Text(s.C.main)}${tp ? ' ' + tp : ''}`;
}
// ประโยค 6.3 (ภาพรวม) · subject เช่น "ศูนย์" หรือ "โครงการนี้"
function ctOverallSentence(s, fx, subject = 'ศูนย์', star = '*') {
  const kMain = fx.treeMain ? +fx.treeMain.value : null, kAlt = fx.treeAlt ? +fx.treeAlt.value : null;
  const head = `${s.first ? `ตั้งแต่ ${thDay(s.first)} ถึง ${thDay(s.last)} ` : ''}${subject}รับเศษอาหาร ${ctNum(ctFloor(s.kg / 1000, 2), 2)} ตัน `;
  const max = s.A.alt != null && s.A.alt > 0 && kAlt ? ` (ถ้าไม่หักการขนส่ง และใช้ค่าของบ่อฝังกลบถูกหลักสุขาภิบาล${star} ได้สูงสุดราว ${ctTreeNum(s.A.alt / kAlt)} ต้น)` : '';
  if (!(s.C.main > 0)) return head + `หลังหักการขนส่งและการเลี้ยงหนอนแล้วเหลือ 0 kgCO2e (${CT_NEG})${max}`;
  const tp = kMain ? ctTreePhrase(s.C.main, kMain, false) : null;
  return head + `หลีกเลี่ยงก๊าซเรือนกระจกได้ไม่น้อยกว่า ${ctCO2Text(s.C.main)} หลังหักการขนส่งและการเลี้ยงหนอนแล้ว${tp ? ' ' + tp.replace(/^เท่ากับต้นไม้/, 'เท่ากับที่ต้นไม้') : ''}${max}`;
}
// ค่าเดียวในตาราง/การ์ด: ติดลบ → 0 พร้อมเครื่องหมาย
const ctCell = (E, floor = true) => (E == null ? '-' : E > 0 ? (floor ? ctF2(E) : Number(E).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : `0<span title="${CT_NEG}" style="color:var(--danger,#c00)">†</span>`);
const ctTreeCell = (E, k) => (E == null || !k ? '-' : E > 0 ? ctTreeLabel(E / k) : '-');

// การ์ด 2 ระดับ (A ไม่หักการขนส่ง · C หักการขนส่งและการเลี้ยงหนอน) + ตาราง 12 ค่า (+B) กดเปิดได้
function ctCards(s, fx, { star = '*', open = false } = {}) {
  const kM = fx.treeMain ? +fx.treeMain.value : null, kA = fx.treeAlt ? +fx.treeAlt.value : null;
  const aTxt = s.A.alt == null ? ctCO2Text(s.A.main, 'short') : ctRange(s.A.main, s.A.alt, star);
  const cTxt = s.C.main > 0 ? `ไม่น้อยกว่า ${ctCO2Text(s.C.main, 'short')}` : '0 kgCO2e';
  const rows = [['A', 'ไม่หักอะไร (หลีกเลี่ยงการฝังกลบ)'], ['B', 'หักการขนส่ง'], ['C', 'หักการขนส่งและการเลี้ยงหนอน']];
  const efName = (f, alt) => f ? `${fmtEf(f.value)}${alt ? star : ''}` : '-';
  return `<div class="kpis ct-cards" style="margin-top:8px">
      <div class="kpi"><div class="l">ไม่หักการขนส่ง (A)</div><div class="v" style="font-size:1.05em">${aTxt}</div><div class="muted">${s.A.main > 0 && kM ? `ต้นไม้ ${ctTreeLabel(s.A.main / kM)} ต้น · 1 ปี` : ''}</div></div>
      <div class="kpi hero"><div class="l">หักการขนส่งและการเลี้ยงหนอนแล้ว (C)</div><div class="v" style="font-size:1.05em">${cTxt}</div><div class="muted">${s.C.main > 0 && kM ? `ต้นไม้ ${ctTreeLabel(s.C.main / kM)} ต้น · 1 ปี` : CT_NEG}</div></div></div>
    <details ${open ? 'open' : ''} style="margin-top:8px"><summary>ตัวเลขทั้ง 12 ค่า (EF ฝังกลบ 2 ค่า × 3 ระดับ × การดูดซับ 2 ค่า)</summary>
      <div class="tscroll"><table><thead><tr><th>ระดับ</th><th>EF ฝังกลบ</th><th class="num">kgCO2e</th><th class="num">ต้นไม้ (k ${kM ?? '-'})</th><th class="num">ต้นไม้ (k ${kA ?? '-'})</th></tr></thead><tbody>
      ${rows.flatMap(([L, label]) => [['main', fx.lfMain, false], ['alt', fx.lfAlt, true]].filter(([w]) => s[L][w] != null).map(([w, f, alt]) => `<tr><td>${L} · ${label}</td><td class="nowrap">${efName(f, alt)}</td><td class="num">${ctCell(s[L][w])}</td><td class="num">${ctTreeCell(s[L][w], kM)}</td><td class="num">${ctTreeCell(s[L][w], kA)}</td></tr>`)).join('')}
      </tbody></table></div><div class="muted">ต้นไม้ = จำนวนต้นไม้ที่ต้องใช้ดูดซับเป็นเวลา 1 ปี · ตัวเลขปัดลง${s.B.main <= 0 || s.C.main <= 0 ? ` · † = ${CT_NEG} (แสดง 0)` : ''}</div></details>`;
}
const fmtEf = v => Number(v).toLocaleString('th-TH', { maximumFractionDigits: 4 });
// หมายเหตุท้ายหน้า (6.4) + ค่าที่ใช้พร้อมแหล่ง · opts.source = หมายเหตุรายงานรายแหล่ง (GHG-SRC) · opts.admin = หมายเหตุการแบ่งค่าขนส่ง
function ctFootnote(fx, { star = true, source = false, admin = false, alloc = false } = {}) {
  const cite = (f, label, extra = '') => f ? `<li>${label}: ${fmtEf(f.value)} ${esc(f.unit)}${extra} — ${esc(f.source || '')}${f.source_detail ? ` · ${esc(f.source_detail)}` : ''}${f.source_url ? ` <a href="${esc(f.source_url)}" target="_blank" rel="noopener">แหล่ง</a>` : ''}</li>` : '';
  const fuel = (fx.fuel || []).find(f => /b7/i.test(f.fuel_code || '') && !/premium/i.test(f.fuel_code || '')) || (fx.fuel || [])[0];
  return `<div class="ct-foot muted" style="margin-top:10px;font-size:.92em"><b>หมายเหตุ</b><ul style="margin:4px 0;padding-left:20px">
    <li>เป็นค่าประมาณเพื่อการสื่อสาร ไม่ใช่การรับรองหรือคาร์บอนเครดิต</li>
    <li>การดูดซับของต้นไม้ต่างกันตามชนิด อายุ และสภาพการปลูก · "ต้นไม้ N ต้น" = จำนวนต้นไม้ที่ต้องใช้ดูดซับเป็นเวลา 1 ปี</li>
    <li>เป็นการเทียบในหน่วยคาร์บอนไดออกไซด์เทียบเท่า · ตัวเลขปัดลงทุกค่า · ช่วงวันที่กำกับทุกตัวเลข</li>
    <li>A = เศษอาหาร × ค่าการปล่อยจากการฝังกลบ · B = A − การปล่อยจากการขนส่ง · C = B − การปล่อยจากการเลี้ยงหนอน · ค่าต่ำสุด (C · ${fx.lfMain ? fmtEf(fx.lfMain.value) : '-'} · ${fx.treeMain ? fmtEf(fx.treeMain.value) : '-'} กก./ต้น/ปี) ใช้บรรยายแบบ "ไม่น้อยกว่า"</li>
    ${source ? `<li>${CT_SRC_NOTE}</li>` : ''}
    ${alloc ? `<li>ค่าขนส่งของแต่ละแหล่ง = ค่าขนส่งของเที่ยว × น้ำหนักของแหล่ง ÷ น้ำหนักทั้งเที่ยว${admin ? ` · ${CT_ALLOC_NOTE}` : ''}</li>` : ''}
    </ul><b>ค่าที่ใช้</b><ul style="margin:4px 0;padding-left:20px">
    ${cite(fx.lfMain, 'ฝังกลบ (ค่าหลัก)')}${cite(fx.lfAlt, 'ฝังกลบ (ขอบบน)', admin ? ' · อนุมาน' : star ? '*' : '')}
    ${cite(fuel, 'เชื้อเพลิง')}${cite(fx.pr, 'การเลี้ยงหนอน')}${cite(fx.treeMain, 'การดูดซับของต้นไม้ (ค่าหลัก)')}${cite(fx.treeAlt, 'การดูดซับของต้นไม้ (ค่าเทียบ)')}
    </ul>${star && fx.lfAlt ? `<div>${CT_STAR}</div>` : ''}</div>`;
}
// กล่องสรุปภาพรวม (ประโยค 6.3 + การ์ด + ตาราง 12 ค่า + หมายเหตุ)
function ctOverallBox(s, fx, { subject = 'ศูนย์', isPublic = true } = {}) {
  if (!fx.ready) return '';
  const star = isPublic ? '*' : ' (อนุมาน)';
  return `<div class="card ct-box"><div class="cardhead"><h4>ก๊าซเรือนกระจกที่หลีกเลี่ยงได้ เทียบการดูดซับของต้นไม้</h4></div>
    <p style="margin:4px 0 0;font-size:1.05em">${esc(ctOverallSentence(s, fx, subject, star))}</p>
    ${ctCards(s, fx, { star })}
    ${ctFootnote(fx, { star: isPublic, admin: !isPublic })}</div>`;
}
// รวมแถวรายรอบ (v_pickup_carbon) หรือรายฟาร์ม (v_public_carbon) เป็นชุดภาพรวม
function ctSetFromRounds(rows, name = '') {
  let kg = 0, a = 0, aa = 0, t = 0, p = 0, alt = false, first = null, last = null;
  for (const r of rows || []) {
    kg += +r.kg || 0; a += +r.e_avoided || 0; t += +r.e_transport || 0; p += +r.e_process || 0;
    if (r.e_avoided_alt != null) { aa += +r.e_avoided_alt; alt = true; }
    const d1 = r.pickup_date || r.first_date, d2 = r.pickup_date || r.last_date;
    if (d1 && (!first || d1 < first)) first = d1; if (d2 && (!last || d2 > last)) last = d2;
  }
  return ctSet({ name, kg, a, aAlt: alt ? aa : null, t, p, first, last });
}
// รวมแถวรายแหล่ง (v_source_carbon รายรายการ หรือ v_public_source_carbon ที่รวมแล้ว) เป็นชุดต่อแหล่ง
function ctSetsFromSources(rows) {
  const m = {};
  for (const r of rows || []) {
    const k = r.source_id || r.source_name, g = m[k] = m[k] || { name: r.source_name, kg: 0, a: 0, aAlt: 0, alt: false, t: 0, p: 0, first: null, last: null };
    g.kg += +r.kg || 0; g.a += +r.a_main || 0; g.t += +r.e_transport || 0; g.p += +r.e_process || 0;
    if (r.a_alt != null) { g.aAlt += +r.a_alt; g.alt = true; }
    const d1 = r.pickup_date || r.first_date, d2 = r.pickup_date || r.last_date;
    if (d1 && (!g.first || d1 < g.first)) g.first = d1; if (d2 && (!g.last || d2 > g.last)) g.last = d2;
  }
  return Object.values(m).map(g => ctSet({ ...g, aAlt: g.alt ? g.aAlt : null }));
}
