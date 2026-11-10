/* =====================================================================
   UBRU AppTech System — hh-calc.js  ช่อง "อัตโนมัติ" ที่ระบบคำนวณเองหลังเลิกใช้ชีต (DEC-137)
   แต่เดิมชีตเป็นผู้คำนวณ (สูตรในชีต) แล้วซิงก์ค่ามา · เลิกใช้ชีตแล้ว ระบบต้องคำนวณเองเมื่อข้อมูลต้นทางเปลี่ยน
   สูตรถอดจากชีตจริง 10 พ.ย. 2569 (อ่านสูตรรายช่อง) · อ้างคอลัมน์ด้วยตัวอักษรเดียวกับชีต แล้วแปลงเป็นหัวคอลัมน์ผ่านลำดับคอลัมน์ (hh.col.col_index)
   เขียนเฉพาะช่องที่ hh.col ระบุว่าเป็นสูตร (is_formula) · คำนวณในหน่วยความจำทุกครั้งที่โหลด ไม่เขียนกลับฐานข้อมูล
   ค่า "ว่าง" = null (เหมือนค่าที่ซิงก์มา)
   ===================================================================== */
const hhColL = s => [...String(s)].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);   // A → 1 · AB → 28
const hcBlank = v => v === null || v === undefined || String(v).trim() === '';
const hcNumOrNull = v => { if (typeof v === 'number') return isFinite(v) ? v : null; const t = String(v ?? '').trim().replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
const hcN = v => hcNumOrNull(v) ?? 0;                                                       // N() ของชีต: ไม่ใช่ตัวเลข = 0
const hcRound = (x, d = 0) => { const p = 10 ** d; return Math.sign(x) * Math.round(Math.abs(x) * p + 1e-9) / p; };   // ROUND ของชีต (ปัดครึ่งออกจากศูนย์)
const hcText = v => (hcBlank(v) ? null : v);

function hhCalc(byKey) {
  const T = byKey || {}, out = { changed: 0, cells: {} };
  const colsOf = k => { const m = {}, f = {}; for (const c of ((T[k] || {}).cols || [])) { m[c.col_index] = c.header; f[c.header] = !!c.is_formula; } return { h: L => m[hhColL(L)], f }; };
  const C = {}; for (const k of ['01', '02', '03', '04', '05', '06', '07']) C[k] = colsOf(k);
  const rows = k => ((T[k] || {}).rows || []);
  const get = (k, r, L) => { const h = C[k].h(L); return h ? (r.data || {})[h] : null; };
  const set = (k, r, L, v) => {
    const h = C[k].h(L); if (!h || !C[k].f[h]) return;
    const old = (r.data || {})[h], nv = v === '' || v === undefined ? null : v;
    const same = (old ?? null) === nv || (hcNumOrNull(old) !== null && hcNumOrNull(nv) !== null && Math.abs(hcNumOrNull(old) - hcNumOrNull(nv)) < 1e-9 && typeof nv === 'number');
    if (!same) { out.changed++; (out.cells[k] = out.cells[k] || []).push({ code: r.hh_code, header: h, old, value: nv }); }
    r.data = r.data || {}; r.data[h] = nv;
  };
  // ทะเบียน 01 (รหัสแรกที่พบ เหมือน MATCH)
  const reg = {}; for (const r of rows('01')) if (!(r.hh_code in reg)) reg[r.hh_code] = r;
  const look = (code, L) => { const r = reg[code]; return r ? get('01', r, L) : undefined; };   // undefined = ไม่พบรหัส
  const lookDash = (code, L) => { const v = look(code, L); return hcBlank(v) || String(v).trim() === '-' ? '–' : v; };   // IF(lookup="","–",lookup) · ทะเบียนที่พิมพ์ "-" ชีตแสดง "–" (ตรวจกับค่าจริง 10 พ.ย. 2569)
  const sumIf = (k, code, L) => rows(k).filter(r => r.hh_code === code).reduce((a, r) => a + hcN(get(k, r, L)), 0);
  const nameOr = code => { const v = look(code, 'F'); return v === undefined ? '⚠ ไม่พบรหัส' : hcText(v); };

  // 02–05: ชื่อจากทะเบียน
  for (const k of ['02', '03', '04', '05']) for (const r of rows(k)) set(k, r, 'B', nameOr(r.hh_code));
  // 03: ค่าอาหาร/เดือน = ปริมาณ × ราคา เฉพาะเมื่อยังว่าง (ในชีตบางแถวพิมพ์ยอดเอง เช่น BSF-004) → ช่องนี้แก้เองได้ · ตรวจสอบความสอดคล้อง
  const h03H = C['03'].h('H'); if (h03H) C['03'].f[h03H] = true;
  for (const r of rows('03')) {
    const F = get('03', r, 'F'), G = get('03', r, 'G');
    if (!hcBlank(F) && !hcBlank(G) && hcBlank(get('03', r, 'H'))) set('03', r, 'H', hcN(F) * hcN(G));
    const H = get('03', r, 'H');
    set('03', r, 'I', hcBlank(F) || hcBlank(G) || hcBlank(H) ? null : Math.abs(hcN(F) * hcN(G) - hcN(H)) <= Math.max(20, hcN(H) * 0.1) ? '✓ สอดคล้อง' : '⚠ ตรวจสอบ: ปริมาณ×ราคา = ' + Math.round(hcN(F) * hcN(G)).toLocaleString('en-US'));
  }
  // 04: ค่าปุ๋ย/เดือน = ค่าปุ๋ย/ปี ÷ 12 (ปัดเป็นบาท)
  for (const r of rows('04')) { const J = get('04', r, 'J'); set('04', r, 'I', hcBlank(J) ? null : hcRound(hcN(J) / 12, 0)); }
  // 01: รวมจากแท็บย่อย · คงเหลือ · พื้นที่รวม · ความพร้อม · ค่าสถิติ (เดิมใช้ในแท็บ 90)
  for (const r of rows('01')) {
    const code = r.hh_code, Y = sumIf('02', code, 'D');
    set('01', r, 'Y', Y);
    const AA = get('01', r, 'AA'); set('01', r, 'AB', hcBlank(Y) && hcBlank(AA) ? null : hcN(Y) - hcN(AA));
    set('01', r, 'AK', ['AG', 'AH', 'AI', 'AJ'].reduce((a, L) => a + (hcNumOrNull(get('01', r, L)) ?? 0), 0));
    const BD = sumIf('03', code, 'H'), BE = sumIf('04', code, 'I');
    set('01', r, 'BD', BD); set('01', r, 'BE', BE); set('01', r, 'BF', BD + BE); set('01', r, 'BG', sumIf('05', code, 'F'));
    const rd = ['BL', 'BM', 'BN'].map(L => hcNumOrNull(get('01', r, L))).filter(v => v !== null);
    set('01', r, 'BO', rd.length ? hcRound(rd.reduce((a, b) => a + b, 0) / rd.length, 1) : null);
    const ck = String(get('01', r, 'B') ?? '') === 'ข้อมูลครบ' && String(get('01', r, 'D') ?? '') !== 'C' ? 1 : 0;
    set('01', r, 'CK', ck);
    set('01', r, 'CL', ck === 1 && hcN(Y) > 0 ? Y : null);
    set('01', r, 'CM', ck === 1 && hcN(AA) > 0 ? AA : null);
    set('01', r, 'CN', ck === 1 ? hcN(BD + BE) : null);
    const Q = get('01', r, 'Q'); set('01', r, 'CO', ck === 1 && hcN(Q) > 0 ? Q : null);
  }
  // 06: ข้อมูลจากทะเบียน · สัญญาณเกณฑ์ · จำนวนเกณฑ์ที่ผ่าน
  const SIG06 = [['E', 'BP'], ['F', 'X'], ['G', 'BJ'], ['H', 'AC'], ['I', 'BR'], ['J', 'BS'], ['K', 'BU'], ['L', 'AN'], ['M', 'T'], ['N', 'BO']];
  for (const r of rows('06')) {
    const code = r.hh_code; set('06', r, 'B', nameOr(code));
    set('06', r, 'C', hcText(look(code, 'N') ?? null)); set('06', r, 'D', hcText(look(code, 'D') ?? null));
    for (const [L, src] of SIG06) set('06', r, L, lookDash(code, src));
    set('06', r, 'AA', ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].filter(L => String(get('06', r, L) ?? '') === 'ผ่าน').length);
  }
  // 07: ตรวจสิทธิ์จากผลคัดกรอง · ข้อมูลจากทะเบียน · ความครบถ้วน · การเปลี่ยนแปลงจากรอบ 1
  const scr = {}; for (const r of rows('06')) if (!(r.hh_code in scr)) scr[r.hh_code] = get('06', r, 'AB');
  const R1 = '1 ก่อนพัฒนา';
  for (const r of rows('07')) {
    const code = r.hh_code;
    set('07', r, 'D', !(code in scr) ? '⚠ ไม่พบในชีตคัดกรอง' : String(scr[code] ?? '') === 'ใช่' ? '✓ ผ่านคัดกรอง' : `⚠ ยังไม่ผ่านคัดกรอง (${scr[code] ?? ''})`);
    for (const [L, src] of [['E', 'F'], ['F', 'N'], ['G', 'D'], ['H', 'X'], ['I', 'V'], ['J', 'W'], ['K', 'BJ']]) set('07', r, L, lookDash(code, src));
    const d = ['N', 'P', 'R'].map(L => get('07', r, L)), ev = ['O', 'Q', 'S'].map(L => get('07', r, L)), cnt = d.filter(v => hcNumOrNull(v) !== null).length;
    set('07', r, 'T', cnt === 0 ? '⚠ ยังไม่ได้ให้ระดับ' : d.some((v, i) => !hcBlank(v) && hcBlank(ev[i])) ? '⚠ ให้ระดับแล้วแต่ยังไม่มีหลักฐาน' : cnt < 3 ? '⚠ ให้ระดับไม่ครบ 3 มิติ' : '✓ ครบถ้วน');
    const isR1 = String(get('07', r, 'B') ?? '') === R1, base = rows('07').filter(x => x.hh_code === code && String(get('07', x, 'B') ?? '') === R1);
    for (const [L, D] of [['U', 'N'], ['V', 'P'], ['W', 'R']]) {
      const v = get('07', r, D);
      set('07', r, L, isR1 || hcBlank(v) ? null : hcN(v) - base.reduce((a, x) => a + hcN(get('07', x, D)), 0));   // = SUMIFS ของชีต (ไม่มีรอบ 1 = ลบด้วย 0)
    }
  }
  // ช่องที่ผู้ใช้กรอกเองได้ (ระบบเติมให้เมื่อว่าง) → ไม่ล็อกในฟอร์ม
  for (const c of ((T['03'] || {}).cols || [])) if (c.header === h03H) c.is_formula = false;
  return out;
}
