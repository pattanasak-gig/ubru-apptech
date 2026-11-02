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

const fmtEf = v => Number(v).toLocaleString('th-TH', { maximumFractionDigits: 4 });
// ---------------------------------------------------------------------
// หน้าจอแบบกระชับ (UX ตรวจ 1 พ.ย. 2569): ตัวเลขหลัก 1 ตัว · การ์ด 2 ใบ · หมายเหตุสำคัญ 1–2 บรรทัด
//   ที่มา/สูตร → ปุ่ม ? (ป๊อปอัป) · ความรู้ยาว → หน้า kb/ แยกตามเรื่อง · ตาราง 12 ค่า → พับไว้
// ---------------------------------------------------------------------
const CT_BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src || '').replace(/carbon-tree\.js.*$/, '');
const CT_KB = [['method', 'วิธีคำนวณ'], ['factors', 'ค่าอ้างอิงและแหล่งที่มา'], ['sensitivity', 'เทียบวิธีคำนวณ'], ['trees', 'ต้นไม้เทียบเท่าคืออะไร'], ['scope', 'ขอบเขตและข้อจำกัด']];
const ctKb = h => CT_BASE + 'kb/#' + h;
const ctKbLink = (h, label) => `<a href="${ctKb(h)}" target="_blank" rel="noopener">${label || 'อ่านเพิ่ม: ' + (CT_KB.find(x => x[0] === h) || [h, h])[1]} ›</a>`;
// ปุ่ม ? ใช้ qBtn ของ common.js (ป๊อปอัปเดียวกันทั้งระบบ)
const ctQ = (title, html) => (typeof qBtn === 'function' ? qBtn(title, html, 'ที่มาของตัวเลข: ' + title) : '');
const ctCite = f => f ? `${fmtEf(f.value)} ${esc(f.unit)} — ${esc(f.code)}` : '-';
// เนื้อป๊อปอัปของแต่ละตัวเลข (สูตร + ตัวเลขจริงของตัวนั้น)
function ctPopTrees(s, fx) {
  const k = fx.treeMain ? +fx.treeMain.value : null, kA = fx.treeAlt ? +fx.treeAlt.value : null;
  return `<p>C ${ctNum(ctFloor(s.C.main, 2), 2)} kgCO2e ÷ ${k ?? '-'} กก./ต้น/ปี = ${k && s.C.main > 0 ? ctNum(ctFloor(s.C.main / k, 2), 2) : '0'} ต้น → แสดงแบบปัดลง</p>
    <p>${k ?? '-'} = ค่าสูงสุดของช่วง 9–15 กก./ต้น/ปี จึงได้จำนวนต้นน้อยที่สุด (บรรยายว่า "ไม่น้อยกว่า")</p>
    ${s.A.alt != null && kA ? `<p>ขอบบน: A ${ctNum(ctFloor(s.A.alt, 2), 2)}* ÷ ${kA} = ${ctNum(ctFloor(s.A.alt / kA, 2), 2)} ต้น</p>` : ''}
    <p class="muted">"ต้นไม้ N ต้น" = จำนวนต้นไม้ที่ต้องใช้ดูดซับเป็นเวลา 1 ปี ไม่ใช่การปลูกต้นไม้</p><p>${ctKbLink('trees')}</p>`;
}
function ctPopA(s, fx) {
  return `<p>A = เศษอาหาร × ค่าการปล่อยจากการฝังกลบ</p>
    <p>${ctNum(ctFloor(s.kg, 2), 2)} กก. × ${fx.lfMain ? fmtEf(fx.lfMain.value) : '-'} = ${ctCO2Text(s.A.main)}<br><span class="muted">${fx.lfMain ? esc(fx.lfMain.code) + ' · ' + esc(fx.lfMain.source || '') : ''}</span></p>
    ${s.A.alt != null ? `<p>${ctNum(ctFloor(s.kg, 2), 2)} กก. × ${fmtEf(fx.lfAlt.value)}* = ${ctCO2Text(s.A.alt)}<br><span class="muted">${esc(fx.lfAlt.code)} · ค่าของขยะมูลฝอยรวม (อนุมาน) ใช้เป็นขอบบนเท่านั้น</span></p>` : ''}
    <p>${ctKbLink('factors')}</p>`;
}
function ctPopC(s, fx) {
  return `<p>C = A − ขนส่ง − การเลี้ยงหนอน</p>
    <p>${ctNum(ctFloor(s.A.main, 2), 2)} − ${ctNum(ctFloor(s.t, 2), 2)} − ${ctNum(ctFloor(s.p, 2), 2)} = ${ctNum(ctFloor(s.C.main, 2), 2)} kgCO2e${s.C.main <= 0 ? ` → แสดง 0 (${CT_NEG})` : ''}</p>
    <p class="muted">ขนส่ง = ลิตร × ค่าการปล่อยของน้ำมัน · ลิตร = กม. ÷ กม./ลิตร${s.name ? ' · ค่าขนส่งของแหล่ง = ค่าขนส่งของเที่ยว × กก. ของแหล่ง ÷ กก. ทั้งเที่ยว' : ''}<br>การเลี้ยงหนอน = กก. × ${fx.pr ? fmtEf(fx.pr.value) : '-'} (${fx.pr ? esc(fx.pr.code) : '-'})</p>
    <p>${ctKbLink('method')}</p>`;
}
// ตัวเลขหลักตามเกณฑ์ R02 ข้อ 2: N ≥ 1 → จำนวนต้น · 0.1–1 → เวลา (N ต้น) · < 0.1 → เวลา
function ctBig(E, k, withTime = true) {
  if (!(E > 0) || !k) return { big: '0 ต้น', sub: CT_NEG };
  const N = E / k, M = ctMonths(E / (k / 12));
  if (N >= 1) return { big: `ไม่น้อยกว่า ${ctTreeNum(N)} ต้น`, sub: `ต้นไม้ที่ต้องใช้ดูดซับเป็นเวลา 1 ปี${withTime ? ` · หรือต้นไม้ 1 ต้นดูดซับ ${M}` : ''}` };
  if (N >= 0.1) return { big: `ต้นไม้ 1 ต้นดูดซับ ${M}`, sub: `(${ctTreeNum(N)} ต้น ถ้าดูดซับเป็นเวลา 1 ปี)` };
  return { big: `ต้นไม้ 1 ต้นดูดซับ ${M}`, sub: '' };
}
// กล่องตัวเลขหลัก · kind: 'overall' (ภาพรวม) | 'source' (รายแหล่ง) · isPublic: * แทน (อนุมาน)
function ctHero(s, fx, { kind = 'overall', subject = 'ศูนย์', isPublic = true, details = true, links = true, more = '', extra = '', noQ = false } = {}) {
  const Q = noQ ? () => '' : ctQ;
  if (!fx.ready) return '';
  const kM = +fx.treeMain.value, kA = +fx.treeAlt.value, star = isPublic ? '*' : ' (อนุมาน)', b = ctBig(s.C.main, kM, kind === 'source');
  const amount = kind === 'source' ? `ส่งเศษอาหาร ${ctNum(ctFloor(s.kg, 2), 2)} กก.` : `${subject}รับเศษอาหาร ${ctNum(ctFloor(s.kg / 1000, 2), 2)} ตัน`;
  const max = s.A.alt > 0 && kA ? ` · สูงสุดราว ${ctTreeNum(s.A.alt / kA)} ต้น${star}` : '';
  const aTxt = s.A.alt == null ? ctCO2Text(s.A.main, 'short') : ctRange(s.A.main, s.A.alt, star).replace(' ตันคาร์บอนไดออกไซด์เทียบเท่า', ' tCO2e');
  const neg = s.B.main <= 0 || s.C.main <= 0;
  return `<div class="card ct-hero">
    <div class="ct-lbl">ก๊าซเรือนกระจกที่หลีกเลี่ยงได้ เทียบการดูดซับของต้นไม้ ${Q('จำนวนต้นไม้', ctPopTrees(s, fx))}</div>
    <div class="ct-big">${b.big}</div>
    <div class="ct-sub">${b.sub ? b.sub + ' · ' : ''}${amount} · ${ctPeriod(s)}${max}</div>
    ${extra}<div class="ct-grid">
      <div class="ct-card"><div class="ct-lbl">ไม่หักการขนส่ง (A) ${Q('ไม่หักการขนส่ง (A)', ctPopA(s, fx))}</div><div class="ct-v">${aTxt}</div></div>
      <div class="ct-card main"><div class="ct-lbl">หักการขนส่งและการเลี้ยงหนอนแล้ว (C) ${Q('หักการขนส่งและการเลี้ยงหนอน (C)', ctPopC(s, fx))}</div><div class="ct-v">${s.C.main > 0 ? 'ไม่น้อยกว่า ' + ctCO2Text(s.C.main, 'short') : '0 kgCO2e'}</div></div>
    </div>
    <div class="ct-note">ค่าประมาณเพื่อการสื่อสาร ไม่ใช่การรับรองหรือคาร์บอนเครดิต · ตัวเลขปัดลง${s.A.alt != null ? `<br>${isPublic ? '*' : '(อนุมาน)'} ขอบบนใช้ค่าการฝังกลบขยะมูลฝอยรวม ไม่ใช่ของเศษอาหารโดยเฉพาะ` : ''}${neg ? `<br><b>${CT_NEG}</b> จึงแสดง 0` : ''}</div>
    ${details ? ct12(s, fx, star) : ''}
    ${links ? ctLinks() : ''}${more ? `<div style="margin-top:8px"><a href="${more}">ดูรายละเอียด ›</a></div>` : ''}</div>`;
}
// ตาราง 12 ค่า (+B) พับไว้
function ct12(s, fx, star = '*') {
  const kM = +fx.treeMain.value, kA = +fx.treeAlt.value;
  const rows = [['A', 'ไม่หักอะไร'], ['B', 'หักการขนส่ง'], ['C', 'หักการขนส่งและการเลี้ยงหนอน']].flatMap(([L, lb]) => [['main', fx.lfMain, ''], ['alt', fx.lfAlt, star]].filter(([w]) => s[L][w] != null).map(([w, f, st]) => `<tr><td>${L} · ${lb}</td><td class="num">${fmtEf(f.value)}${st}</td><td class="num">${ctCell(s[L][w])}</td><td class="num">${ctTreeCell(s[L][w], kM)}</td><td class="num">${ctTreeCell(s[L][w], kA)}</td></tr>`)).join('');
  return `<details class="ct-more"><summary>ตัวเลขทั้ง 12 ค่า</summary><div class="tscroll"><table><thead><tr><th>ระดับ</th><th class="num">ค่าฝังกลบ</th><th class="num">kgCO2e</th><th class="num">ต้นไม้ (${kM})</th><th class="num">ต้นไม้ (${kA})</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
const ctLinks = () => `<div class="ct-links">${CT_KB.map(([h, l]) => `<a class="ct-chip" href="${ctKb(h)}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>`;
// ภาคผนวกสั้นสำหรับ PDF (ป๊อปอัปพิมพ์ไม่ได้) · ค่าที่ใช้แบบย่อ 1 บรรทัดต่อค่า
function ctAppendix(fx, { source = false } = {}) {
  const fuel = (fx.fuel || []).find(f => /b7/i.test(f.fuel_code || '') && !/premium/i.test(f.fuel_code || '')) || (fx.fuel || [])[0];
  const li = (label, f, st = '') => f ? `<li>${label}: ${fmtEf(f.value)}${st} ${esc(f.unit)} — ${esc(f.source || f.code)}</li>` : '';
  return `<div class="ct-appx"><b>วิธีคิดโดยย่อ</b> A = เศษอาหาร × ค่าการปล่อยจากการฝังกลบ · C = A − ขนส่ง (แบ่งตามน้ำหนักของเที่ยว) − การเลี้ยงหนอน · ต้นไม้ = C ÷ ${fx.treeMain ? fmtEf(fx.treeMain.value) : '-'} กก./ต้น/ปี (จำนวนต้นที่ต้องใช้ดูดซับเป็นเวลา 1 ปี) · ตัวเลขปัดลง
    <ul>${li('ฝังกลบ', fx.lfMain)}${li('ฝังกลบ ขอบบน', fx.lfAlt, '*')}${li('น้ำมัน', fuel)}${li('การเลี้ยงหนอน', fx.pr)}${li('ต้นไม้', fx.treeMain)}${li('ต้นไม้ (ค่าเทียบ)', fx.treeAlt)}</ul>
    ${fx.lfAlt ? `<div>${CT_STAR}</div>` : ''}${source ? `<div>${CT_SRC_NOTE}</div>` : ''}<div>รายละเอียด: ${ctKb('method')}</div></div>`;
}
// ตารางเทียบวิธีคำนวณ (ความอ่อนไหว): ค่าฝังกลบทุกค่า × อัตราสิ้นเปลือง · T = { kg, t_fixed, t_km_ef_assumed } · F2 = ตัวจัดรูปเลข
function ctSensitivity(T, factors, F2 = ctF2) {
  const F = (factors || []).filter(f => f.status === undefined || f.status === 'active'), pr = F.find(f => f.category === 'process' && f.is_primary);
  const kmpls = F.filter(f => f.category === 'fuel_economy').map(f => +f.value).filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b);
  const rows = F.filter(f => f.category === 'landfill').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(f => { const av = T.kg * f.value; return `<tr><td>${esc(f.name)}<div class="muted">${esc(f.code)} · ${fmtEf(f.value)}${f.report_role ? ' · ใช้ในตัวเลขหลัก' : ''}</div></td><td class="num">${F2(av)}</td>${kmpls.map(k => { const tr = (+T.t_fixed || 0) + (+T.t_km_ef_assumed || 0) / k; return `<td class="num">${F2(av - tr - (pr ? T.kg * pr.value : 0))}</td>`; }).join('')}</tr>`; }).join('');
  return `<div class="tscroll"><table><thead><tr><th>ค่าฝังกลบ</th><th class="num">A</th>${kmpls.map(k => `<th class="num">C @ ${fmtEf(k)} กม./ลิตร</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><div class="muted">คอลัมน์เปลี่ยนเฉพาะรถที่ยังไม่ระบุ กม./ลิตร · รถที่ระบุ กม./ลิตร หรือกรอกลิตรจริง ใช้ค่าจริงเสมอ</div>`;
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
