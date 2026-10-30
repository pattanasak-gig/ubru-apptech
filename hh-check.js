// =====================================================================
// ครัวเรือน AppTech — ตรวจความสอดคล้องของข้อมูล (DEC-117)
//   ใช้ร่วมกัน: หน้าเว็บแท็บ "ตรวจความสอดคล้อง" และสคริปต์ทำรายงานให้ทีม (tests/hh-report.mjs)
//   อินพุต model = { tabs: { '01': { headers, rows:[{key, code, data}], formulaHeaders, missingKeys }, ... }, options: { '01': { header: [ตัวเลือก] } } }
//   ผลลัพธ์ = [{ level: 'error'|'warn'|'info', tab, code, field, rule, msg }]  · รายงานอ้างเฉพาะรหัสครัวเรือน ไม่แสดงข้อมูลส่วนบุคคล
// =====================================================================
(function (root) {
  const TAB_LABEL = { '01': 'ทะเบียนครัวเรือน', '02': 'รายได้ตามแหล่ง', '03': 'ต้นทุนอาหารสัตว์', '04': 'ต้นทุนปุ๋ย', '05': 'หนี้สิน', '06': 'คัดกรองนวัตกร', '07': 'ประเมินนวัตกร', '09': 'สรุปพัฒนาการ' };
  const REQUIRED_01 = ['วันที่สำรวจ', 'กลุ่มหลัก', 'ชื่อ-สกุล', 'เพศ', 'อายุ (ปี)', 'เลขบัตรประชาชน', 'โทรศัพท์', 'บ้านเลขที่', 'หมู่', 'ตำบล', 'ละติจูด', 'ลองจิจูด', 'สมาชิกครัวเรือน (คน)', 'อาชีพหลัก', 'ความยินยอม PDPA'];
  const MULTI = { '02': ['แหล่งรายได้'], '03': ['ชนิดสัตว์'], '04': ['พืช/การใช้'], '05': ['ประเภทหนี้', 'แหล่งเงินกู้'] };
  const NUMERIC_RE = /\((คน|ปี|บาท|ไร่|ตร\.ม\.|ตัว|กก\.[^)]*|%|1-5|1-4)\)|\/เดือน$|\/รอบ$|\/ปี$|รอบผลิต\/ปี|^ชาย$|^หญิง$/;
  const blank = v => v === null || v === undefined || String(v).trim() === '';
  const num = v => { if (typeof v === 'number') return v; const t = String(v ?? '').trim().replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };
  const digits = v => String(v ?? '').replace(/\D/g, '');
  function thaiIdValid(id) {
    const d = digits(id); if (d.length !== 13) return false;
    let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (13 - i);
    return (11 - (s % 11)) % 10 === +d[12];
  }
  function distM(a, b) { const R = 6371000, r = x => x * Math.PI / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

  function hhCheck(model) {
    const out = [], T = model.tabs || {}, OPT = model.options || {};
    const add = (level, tab, code, field, rule, msg) => out.push({ level, tab, tab_label: TAB_LABEL[tab] || tab, code: code || '', field: field || '', rule, msg });
    // ---- โครงสร้าง ----
    for (const [k, t] of Object.entries(T)) {
      if (t.missingKeys && t.missingKeys.length) add('error', k, '', t.missingKeys.join(', '), 'header', `ไม่พบคอลัมน์ ${t.missingKeys.join(', ')} ในแถวหัวตาราง (หัวตารางถูกพิมพ์ทับหรือเปลี่ยนชื่อ) ระบบซิงก์แท็บนี้ไม่ได้`);
    }
    const reg = T['01']; if (!reg) return out;
    const codes01 = new Set(); const seen01 = {};
    for (const r of reg.rows) { seen01[r.code] = (seen01[r.code] || 0) + 1; codes01.add(r.code); }
    Object.entries(seen01).filter(([, n]) => n > 1).forEach(([c, n]) => add('error', '01', c, 'รหัสครัวเรือน', 'dup_code', `รหัสซ้ำ ${n} แถวในทะเบียน (รหัสต้องไม่ซ้ำ เพราะใช้เชื่อมทุกแท็บ)`));
    // ---- รหัสในแท็บลูกต้องมีในทะเบียน · ครัวเรือนที่ยังไม่มีแถวในแท็บลูก ----
    for (const k of ['02', '03', '04', '05', '06', '07', '09']) {
      const t = T[k]; if (!t || !t.rows) continue;
      const has = new Set();
      for (const r of t.rows) { has.add(r.code); if (!codes01.has(r.code)) add('error', k, r.code, 'รหัสครัวเรือน', 'orphan_code', 'รหัสนี้ไม่มีในทะเบียนครัวเรือน (01) — สะกดผิดหรือยังไม่ได้ลงทะเบียน'); }
      if (['02', '03', '04', '05', '06'].includes(k)) {
        const miss = [...codes01].filter(c => !has.has(c));
        if (miss.length) add('info', k, miss.join(', '), '', 'no_child_rows', `${miss.length} ครัวเรือนยังไม่มีแถวในแท็บนี้ (ถ้าไม่มีรายการจริง ไม่ต้องกรอก)`);
      }
    }
    // ---- ทะเบียน 01 รายครัวเรือน ----
    const ids = {}, phones = {}, pts = [];
    for (const r of reg.rows) {
      const d = r.data, c = r.code, status = String(d['สถานะข้อมูล'] ?? '').trim();
      if (status && !['รอสำรวจ', 'ข้อมูลครบ', 'ต้องยืนยัน'].includes(status)) add('warn', '01', c, 'สถานะข้อมูล', 'status_value', `สถานะ "${status}" ไม่อยู่ในรายการ (รอสำรวจ/ข้อมูลครบ/ต้องยืนยัน)`);
      if (blank(status)) add('warn', '01', c, 'สถานะข้อมูล', 'status_blank', 'ยังไม่ระบุสถานะข้อมูล — แท็บสถิติจะไม่นับครัวเรือนนี้');
      if (status === 'ข้อมูลครบ') { const miss = REQUIRED_01.filter(h => h in d && blank(d[h])); if (miss.length) add('warn', '01', c, miss.join(', '), 'complete_but_blank', `สถานะ "ข้อมูลครบ" แต่ยังว่าง: ${miss.join(', ')}`); }
      const pd = String(d['ความยินยอม PDPA'] ?? '').trim();
      if (pd && pd !== 'ยินยอม') add('error', '01', c, 'ความยินยอม PDPA', 'pdpa', `ความยินยอม PDPA = "${pd}" — ห้ามใช้ข้อมูลส่วนบุคคลของครัวเรือนนี้จนกว่าจะได้รับความยินยอม`);
      const g = String(d['กลุ่มหลัก'] ?? '').trim();
      if (g && !['A', 'B', 'C'].includes(g)) add('warn', '01', c, 'กลุ่มหลัก', 'group_value', `กลุ่มหลัก "${g}" ไม่ใช่ A/B/C`);
      if (g && g === String(d['กลุ่มรอง'] ?? '').trim()) add('warn', '01', c, 'กลุ่มรอง', 'group_same', 'กลุ่มรองซ้ำกับกลุ่มหลัก (ใส่กลุ่มรองเฉพาะกรณีคาบเกี่ยว)');
      if (g === 'C' && blank(d['ประเภทกิจการ (กลุ่ม C)'])) add('warn', '01', c, 'ประเภทกิจการ (กลุ่ม C)', 'group_c', 'กลุ่ม C แต่ยังไม่ระบุประเภทกิจการ');
      if (g === 'B' && blank(d['ผลิตภัณฑ์ BSF ที่สนใจ (กลุ่ม B)'])) add('info', '01', c, 'ผลิตภัณฑ์ BSF ที่สนใจ (กลุ่ม B)', 'group_b', 'กลุ่ม B แต่ยังไม่ระบุผลิตภัณฑ์ที่สนใจ');
      // วันที่สำรวจ
      const sd = d['วันที่สำรวจ'];
      if (!blank(sd) && !/^25\d\d-\d\d-\d\d$/.test(String(sd).trim())) add('warn', '01', c, 'วันที่สำรวจ', 'date_format', `รูปแบบวันที่ "${sd}" ไม่ตรงแบบ 25xx-ดด-วว (พ.ศ.)`);
      // พิกัด
      const la = num(d['ละติจูด']), lo = num(d['ลองจิจูด']);
      if (!blank(d['ละติจูด']) || !blank(d['ลองจิจูด'])) {
        if (isNaN(la) || isNaN(lo)) add('error', '01', c, 'ละติจูด/ลองจิจูด', 'coord_nan', 'พิกัดไม่ใช่ตัวเลข หรือกรอกไม่ครบทั้งสองช่อง');
        else if (la > 90 || (la > 97 && lo < 21)) add('error', '01', c, 'ละติจูด/ลองจิจูด', 'coord_swap', 'ละติจูดกับลองจิจูดน่าจะสลับช่องกัน');
        else if (la < 5.5 || la > 20.5 || lo < 97 || lo > 106) add('error', '01', c, 'ละติจูด/ลองจิจูด', 'coord_out', `พิกัด ${la}, ${lo} อยู่นอกประเทศไทย`);
        else if (la < 14.5 || la > 16.3 || lo < 104.0 || lo > 105.7) add('warn', '01', c, 'ละติจูด/ลองจิจูด', 'coord_far', `พิกัด ${la}, ${lo} อยู่นอกพื้นที่ จ.อุบลราชธานี`);
        else { pts.push({ c, lat: la, lng: lo }); const dec = String(d['ละติจูด']).split('.')[1] || ''; if (dec.length < 4) add('info', '01', c, 'ละติจูด/ลองจิจูด', 'coord_precision', `ทศนิยมพิกัดเพียง ${dec.length} ตำแหน่ง (ความคลาดเคลื่อนเกิน 10 ม.) ควรใช้อย่างน้อย 5–6 ตำแหน่ง`); }
      }
      // ตัวเลข
      for (const h of reg.headers) {
        if (!h || !NUMERIC_RE.test(h) || (reg.formulaHeaders || []).includes(h)) continue;
        const v = d[h]; if (blank(v)) continue;
        const n = num(v);
        if (isNaN(n)) add('warn', '01', c, h, 'not_number', `ค่า "${v}" ไม่ใช่ตัวเลข (ช่องนี้ใช้คำนวณ)`);
        else if (n < 0) add('error', '01', c, h, 'negative', `ค่าติดลบ ${n}`);
        else if (/\(1-5\)/.test(h) && (n < 1 || n > 5)) add('warn', '01', c, h, 'range_1_5', `ค่า ${n} อยู่นอกช่วง 1–5`);
      }
      const mem = num(d['สมาชิกครัวเรือน (คน)']), m = num(d['ชาย']), f = num(d['หญิง']), lab = num(d['แรงงานหลัก (คน)']), dep = num(d['ผู้พึ่งพิง (คน)']);
      if (!isNaN(mem) && !isNaN(m) && !isNaN(f) && m + f !== mem) add('warn', '01', c, 'สมาชิก/ชาย/หญิง', 'members_sum', `ชาย ${m} + หญิง ${f} = ${m + f} ไม่เท่าสมาชิก ${mem}`);
      if (!isNaN(mem) && !isNaN(lab) && lab > mem) add('warn', '01', c, 'แรงงานหลัก (คน)', 'labour_gt', `แรงงานหลัก ${lab} มากกว่าสมาชิก ${mem}`);
      if (!isNaN(mem) && !isNaN(lab) && !isNaN(dep) && lab + dep > mem) add('warn', '01', c, 'แรงงานหลัก/ผู้พึ่งพิง', 'labour_dep', `แรงงาน ${lab} + ผู้พึ่งพิง ${dep} มากกว่าสมาชิก ${mem}`);
      const age = num(d['อายุ (ปี)']); if (!isNaN(age) && (age < 15 || age > 100)) add('warn', '01', c, 'อายุ (ปี)', 'age_range', `อายุ ${age} ปี ผิดปกติ`);
      // เลขบัตร · โทรศัพท์
      const nid = d['เลขบัตรประชาชน'];
      if (!blank(nid)) { if (!thaiIdValid(nid)) add('error', '01', c, 'เลขบัตรประชาชน', 'national_id', 'เลขบัตรประชาชนไม่ถูกต้อง (ไม่ครบ 13 หลัก หรือเลขตรวจสอบหลักสุดท้ายไม่ตรง)'); else (ids[digits(nid)] = ids[digits(nid)] || []).push(c); }
      const ph = d['โทรศัพท์'];
      if (!blank(ph)) { const p = digits(ph); if (!/^0\d{8,9}$/.test(p)) add('warn', '01', c, 'โทรศัพท์', 'phone', 'เบอร์โทรศัพท์ไม่ครบ 9–10 หลัก หรือไม่ขึ้นต้นด้วย 0'); else (phones[p] = phones[p] || []).push(c); }
      // รายได้รวมจากแท็บ 02
      if (status === 'ข้อมูลครบ' && 'รายได้รวม/เดือน (อัตโนมัติ)' in d && !(num(d['รายได้รวม/เดือน (อัตโนมัติ)']) > 0)) add('warn', '01', c, 'รายได้รวม/เดือน (อัตโนมัติ)', 'income_zero', 'รายได้รวมเป็น 0 หรือว่าง (ยังไม่มีรายการในแท็บรายได้ หรือรหัสไม่ตรง)');
      if (status === 'ข้อมูลครบ' && blank(d['รายจ่ายครัวเรือนรวม/เดือน'])) add('warn', '01', c, 'รายจ่ายครัวเรือนรวม/เดือน', 'expense_blank', 'ยังไม่กรอกรายจ่ายครัวเรือน (ใช้คำนวณคงเหลือและดุลครัวเรือน)');
      // ตัวเลือก dropdown
      for (const [h, opts] of Object.entries(OPT['01'] || {})) { const v = d[h]; if (!blank(v) && Array.isArray(opts) && opts.length && !opts.map(String).includes(String(v).trim())) add('warn', '01', c, h, 'not_in_options', `ค่า "${v}" ไม่อยู่ในตัวเลือกของช่องนี้`); }
    }
    Object.entries(ids).filter(([, a]) => a.length > 1).forEach(([, a]) => add('error', '01', a.join(', '), 'เลขบัตรประชาชน', 'dup_national_id', `เลขบัตรประชาชนซ้ำกัน ${a.length} ครัวเรือน`));
    Object.entries(phones).filter(([, a]) => a.length > 1).forEach(([, a]) => add('info', '01', a.join(', '), 'โทรศัพท์', 'dup_phone', `เบอร์โทรศัพท์เดียวกัน ${a.length} ครัวเรือน (ตรวจว่าเป็นครอบครัวเดียวกันหรือกรอกซ้ำ)`));
    // พิกัดใกล้กันผิดปกติ: รวมเป็นกลุ่ม (ห่างกันไม่เกิน 30 ม.) · กลุ่มใหญ่ = น่าจะเป็นจุดนัดสำรวจ ไม่ใช่บ้าน
    const parent = pts.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i])), minD = {};
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dm = distM(pts[i], pts[j]); if (dm < 30) { parent[find(i)] = find(j); const k = [pts[i].c, pts[j].c].sort().join('|'); minD[k] = dm; } }
    const cl = {}; pts.forEach((p, i) => { (cl[find(i)] = cl[find(i)] || []).push(p.c); });
    Object.values(cl).filter(g => g.length > 1).forEach(g => {
      const ds = Object.entries(minD).filter(([k]) => g.includes(k.split('|')[0])).map(([, d]) => d), mn = Math.min(...ds);
      add('warn', '01', g.sort().join(', '), 'ละติจูด/ลองจิจูด', 'coord_near', g.length >= 3
        ? `${g.length} ครัวเรือนมีพิกัดอยู่ในรัศมีราว 30 ม. ของกัน — น่าจะเป็นพิกัดจุดนัดสำรวจ (เช่น ศาลา/บ้านผู้นำ) ไม่ใช่บ้านแต่ละหลัง`
        : `พิกัดห่างกันเพียง ${mn.toFixed(0)} ม.${mn < 3 ? ' (แทบเป็นจุดเดียวกัน น่าจะคัดลอกซ้ำ)' : ''} — ตรวจว่าเป็นบ้านติดกันจริงหรือไม่`);
    });
    // ---- แท็บลูก 02–05 ----
    for (const [k, hs] of Object.entries(MULTI)) {
      const t = T[k]; if (!t) continue; let n = 0; const ex = [];
      for (const r of t.rows) for (const h of hs) if (String(r.data[h] ?? '').includes(',')) { n++; if (ex.length < 200) ex.push(r.code); break; }
      if (n) add('info', k, ex.join(', '), hs.join(', '), 'multi_value', `${n} แถวใส่หลายรายการในช่องเดียว (เช่น "ไก่ไข่, เป็ด") ยอดเงินจึงแยกตามหมวดไม่ได้ — สถิติรายหมวดของแท็บ 90 ต่ำกว่าความจริง · ถ้าต้องการยอดรายหมวด ให้แยกเป็น 1 แถวต่อ 1 รายการ`);
    }
    const amt = { '02': 'รายได้ต่อเดือน (บาท)', '03': 'ค่าอาหาร/เดือน (บาท)', '04': 'ค่าปุ๋ย/ปี (บาท)', '05': 'ยอดคงค้าง (บาท)' };
    for (const [k, h] of Object.entries(amt)) {
      const t = T[k]; if (!t) continue;
      for (const r of t.rows) { const v = r.data[h]; if (blank(v)) add('warn', k, r.code, h, 'amount_blank', `มีแถวแต่ยังไม่กรอก ${h}`); else if (isNaN(num(v))) add('warn', k, r.code, h, 'not_number', `ค่า "${v}" ไม่ใช่ตัวเลข`); else if (num(v) < 0) add('error', k, r.code, h, 'negative', 'ค่าติดลบ'); }
    }
    if (T['03']) for (const r of T['03'].rows) { const ck = String(r.data['ตรวจสอบ (อัตโนมัติ)'] ?? ''); if (ck.includes('⚠')) add('warn', '03', r.code, 'ปริมาณ/ราคา/ค่าอาหาร', 'feed_check', `ปริมาณ × ราคา ไม่สอดคล้องกับค่าอาหาร (${ck.replace('⚠', '').trim()})`); }
    if (T['05']) for (const r of T['05'].rows) { const bal = num(r.data['ยอดคงค้าง (บาท)']), mo = num(r.data['ผ่อน/เดือน (บาท)']), rate = num(r.data['ดอกเบี้ย (%)']); if (bal > 0 && isNaN(mo)) add('info', '05', r.code, 'ผ่อน/เดือน (บาท)', 'debt_month', 'มียอดคงค้างแต่ไม่ระบุยอดผ่อน/เดือน'); if (!isNaN(rate) && rate > 60) add('warn', '05', r.code, 'ดอกเบี้ย (%)', 'rate', `ดอกเบี้ย ${rate}% ต่อปีผิดปกติ (หรือกรอกเป็นต่อเดือน?)`); }
    // ---- 06 คัดกรอง ----
    const screen = {};
    if (T['06']) for (const r of T['06'].rows) {
      const d = r.data, sum = String(d['สรุปศักยภาพนวัตกร'] ?? '').trim(); screen[r.code] = sum;
      let passed = 0, given = 0;
      for (let i = 1; i <= 6; i++) { const res = String(d['ผลตรวจเกณฑ์ ' + i] ?? '').trim(); if (res) given++; if (res === 'ผ่าน') passed++; if (res && res !== 'รอข้อมูล' && blank(d['หลักฐานเกณฑ์ ' + i])) add('warn', '06', r.code, 'หลักฐานเกณฑ์ ' + i, 'evidence', `ให้ผลเกณฑ์ ${i} แล้วแต่ยังไม่มีหลักฐาน`); }
      if (given && given < 6) add('warn', '06', r.code, 'ผลตรวจเกณฑ์', 'criteria_incomplete', `ตรวจเกณฑ์ไปแล้ว ${given} จาก 6 ข้อ`);
      if (!given && sum) add('warn', '06', r.code, 'สรุปศักยภาพนวัตกร', 'summary_without_criteria', 'สรุปศักยภาพแล้วแต่ยังไม่ได้ตรวจเกณฑ์');
      if (given === 6 && !sum) add('info', '06', r.code, 'สรุปศักยภาพนวัตกร', 'summary_blank', 'ตรวจครบ 6 เกณฑ์แล้ว ยังไม่ได้สรุปศักยภาพ');
      if (sum === 'ใช่' && passed <= 2) add('warn', '06', r.code, 'สรุปศักยภาพนวัตกร', 'summary_low', `สรุป "ใช่" แต่ผ่านเพียง ${passed} เกณฑ์ — ควรมีเหตุผลในหมายเหตุ`);
      if (sum === 'ใช่' && passed <= 2 && blank(d['หมายเหตุ'])) add('warn', '06', r.code, 'หมายเหตุ', 'summary_reason', 'สรุป "ใช่" ทั้งที่ผ่านน้อย และยังไม่มีเหตุผลในหมายเหตุ');
      if (sum === 'ไม่' && passed >= 5) add('info', '06', r.code, 'สรุปศักยภาพนวัตกร', 'summary_high', `สรุป "ไม่" แต่ผ่าน ${passed} เกณฑ์ — ตรวจทานอีกครั้ง`);
      if (sum && blank(d['วันที่คัดกรอง'])) add('warn', '06', r.code, 'วันที่คัดกรอง', 'screen_date', 'สรุปแล้วแต่ยังไม่ระบุวันที่คัดกรอง');
      const n6 = num(d['จำนวนเกณฑ์ที่ผ่าน (อัตโนมัติ)']); if (!isNaN(n6) && n6 !== passed) add('warn', '06', r.code, 'จำนวนเกณฑ์ที่ผ่าน (อัตโนมัติ)', 'passed_mismatch', `สูตรนับได้ ${n6} แต่ผลตรวจที่กรอกผ่าน ${passed} (มีช่องว่าง/สะกดต่างจาก "ผ่าน"?)`);
    }
    // ---- 07 ประเมิน ----
    if (T['07']) for (const r of T['07'].rows) {
      if (screen[r.code] !== 'ใช่') add('warn', '07', r.code, 'รหัสครัวเรือน', 'not_screened', `ประเมินแล้วแต่ผลคัดกรองเป็น "${screen[r.code] || 'ไม่พบ'}" (ต้องผ่านคัดกรองก่อน)`);
      const comp = String(r.data['ตรวจความครบถ้วน (อัตโนมัติ)'] ?? ''); if (comp.includes('⚠')) add('warn', '07', r.code, 'ตรวจความครบถ้วน', 'assess_incomplete', comp.replace('⚠', '').trim());
      if (blank(r.data['วันที่ประเมิน'])) add('warn', '07', r.code, 'วันที่ประเมิน', 'assess_date', 'ยังไม่ระบุวันที่ประเมิน');
      for (const h of ['มิติ 1 ความรู้และเทคโนโลยี (1-4)', 'มิติ 2 การจัดกระบวนการเรียนรู้ (1-4)', 'มิติ 3 เครือข่ายความร่วมมือ (1-4)']) { const v = num(r.data[h]); if (!blank(r.data[h]) && (isNaN(v) || v < 1 || v > 4)) add('error', '07', r.code, h, 'level_range', `ระดับ "${r.data[h]}" ต้องเป็น 1–4`); }
    }
    return out;
  }
  const RULE_TITLE = { header: 'หัวตารางผิด', dup_code: 'รหัสครัวเรือนซ้ำ', orphan_code: 'รหัสที่ไม่มีในทะเบียน', no_child_rows: 'ครัวเรือนที่ยังไม่มีแถวในแท็บนี้',
  status_value: 'สถานะข้อมูลไม่อยู่ในรายการ', status_blank: 'ยังไม่ระบุสถานะข้อมูล', complete_but_blank: 'สถานะ "ข้อมูลครบ" แต่ยังมีช่องสำคัญว่าง', pdpa: 'ไม่มีความยินยอม PDPA',
  group_value: 'กลุ่มหลักไม่ใช่ A/B/C', group_same: 'กลุ่มรองซ้ำกับกลุ่มหลัก', group_c: 'กลุ่ม C ไม่ระบุประเภทกิจการ', group_b: 'กลุ่ม B ไม่ระบุผลิตภัณฑ์ที่สนใจ',
  date_format: 'รูปแบบวันที่ไม่สม่ำเสมอ', coord_nan: 'พิกัดไม่ใช่ตัวเลข', coord_swap: 'ละติจูด/ลองจิจูดสลับช่อง', coord_out: 'พิกัดนอกประเทศไทย', coord_far: 'พิกัดนอก จ.อุบลราชธานี',
  coord_precision: 'ทศนิยมพิกัดน้อยเกินไป', coord_near: 'พิกัดใกล้กันผิดปกติ (คัดลอกซ้ำ หรือเป็นจุดนัดสำรวจ)', not_number: 'ช่องตัวเลขมีข้อความ', negative: 'ค่าติดลบ', range_1_5: 'ค่าความพร้อมนอกช่วง 1–5',
  members_sum: 'ชาย + หญิง ไม่เท่าจำนวนสมาชิก', labour_gt: 'แรงงานหลักมากกว่าสมาชิก', labour_dep: 'แรงงาน + ผู้พึ่งพิง มากกว่าสมาชิก', age_range: 'อายุผิดปกติ',
  national_id: 'เลขบัตรประชาชนไม่ถูกต้อง', dup_national_id: 'เลขบัตรประชาชนซ้ำ', phone: 'เบอร์โทรศัพท์ไม่ถูกรูปแบบ', dup_phone: 'เบอร์โทรศัพท์ซ้ำกัน',
  income_zero: 'รายได้รวมเป็น 0', expense_blank: 'ยังไม่กรอกรายจ่ายครัวเรือน', not_in_options: 'ค่าไม่อยู่ในตัวเลือก', multi_value: 'หลายรายการในช่องเดียว',
  amount_blank: 'มีแถวแต่ไม่กรอกยอดเงิน', feed_check: 'ปริมาณ × ราคา ไม่สอดคล้องกับค่าอาหาร', debt_month: 'มียอดคงค้างแต่ไม่ระบุยอดผ่อน', rate: 'อัตราดอกเบี้ยผิดปกติ (น่าจะกรอกยอดเงินในช่อง %)',
  evidence: 'ให้ผลเกณฑ์แล้วแต่ไม่มีหลักฐาน', criteria_incomplete: 'ตรวจเกณฑ์ไม่ครบ 6 ข้อ', summary_without_criteria: 'สรุปศักยภาพก่อนตรวจเกณฑ์', summary_blank: 'ตรวจครบแล้วยังไม่สรุปศักยภาพ',
  summary_low: 'สรุป "ใช่" แต่ผ่านเกณฑ์น้อย', summary_reason: 'สรุป "ใช่" ทั้งที่ผ่านน้อย และไม่มีเหตุผล', summary_high: 'สรุป "ไม่" แต่ผ่านเกณฑ์มาก', screen_date: 'ไม่ระบุวันที่คัดกรอง',
  passed_mismatch: 'จำนวนเกณฑ์ที่ผ่านไม่ตรงกับผลที่กรอก', not_screened: 'ประเมินทั้งที่ยังไม่ผ่านคัดกรอง', assess_incomplete: 'การประเมินไม่ครบถ้วน', assess_date: 'ไม่ระบุวันที่ประเมิน', level_range: 'ระดับไม่อยู่ในช่วง 1–4' };
  root.hhCheck = hhCheck; root.HH_TAB_LABEL = TAB_LABEL; root.HH_RULE_TITLE = RULE_TITLE; root.hhThaiIdValid = thaiIdValid;
})(typeof window !== 'undefined' ? window : globalThis);
