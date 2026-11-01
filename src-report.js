/* =====================================================================
   UBRU AppTech System — src-report.js  เนื้อรายงานแหล่งกำเนิดเศษอาหาร (DEC-122 · DEC-124)
   ใช้ร่วม: รายงานพิมพ์/PDF ในหน้าเศษอาหาร (food-src.js) และหน้าลิงก์สาธารณะ src/?t=รหัส (ไม่ต้องล็อกอิน)
   d = { source:{name,type,address}, project:{code,name,leader_name,contact_email}, items:[{date,kg,quality,transport}], factors:[...], scopeNote, link, issuer, print }
   หน้าเว็บ: ตัวเลขหลัก + ปุ่ม ? + ลิงก์หน้าความรู้ · PDF (print): ไม่มีปุ่ม ใส่ภาคผนวกวิธีคิดแบบย่อแทน · ตัวเลขทุกตัวปัดลง
   ===================================================================== */
const SRC_REPORT_CSS = 'h1{font-size:20px;margin:0}h2{font-size:16px;margin:18px 0 6px}.rp table{width:100%;border-collapse:collapse;margin:6px 0}.rp th,.rp td{border:1px solid #999;padding:4px 6px;text-align:left}.rp td.n,.rp th.n,.rp td.num,.rp th.num{text-align:right}.rp .k{display:flex;flex-wrap:wrap;gap:8px}.rp .k div{border:1px solid #999;border-radius:6px;padding:6px 10px;min-width:130px}.rp .k b{display:block;font-size:18px}.rp .m{color:#444;font-size:12px}.rp .contact{margin-top:16px;padding:8px 10px;border:1px solid #999;border-radius:6px}'
  + '.rp .ct-hero{border:1px solid #999;border-radius:8px;padding:10px 12px;margin:12px 0}.rp .ct-lbl{color:#444;font-size:13px}.rp .ct-big{font-size:24px;font-weight:700;color:#1B5E20}.rp .ct-sub{color:#444;font-size:13px}.rp .ct-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.rp .ct-card{border:1px solid #999;border-radius:6px;padding:6px 10px;min-width:200px}.rp .ct-v{font-size:16px;font-weight:700}.rp .ct-note{margin-top:8px;color:#444;font-size:12px}.rp .ct-appx{margin-top:12px;font-size:12px;color:#333}.rp .ct-appx ul{margin:4px 0;padding-left:18px}';
function srcReportStats(items, lf) {
  const kg = items.reduce((a, i) => a + Number(i.kg), 0), q = items.filter(i => i.quality != null).map(i => Number(i.quality));
  const mm = {}; for (const i of items) { const k = String(i.date).slice(0, 7); const m = mm[k] = mm[k] || { k, kg: 0, n: 0, q: [], t: 0 }; m.kg += Number(i.kg); m.n++; m.t += Number(i.transport) || 0; if (i.quality != null) m.q.push(Number(i.quality)); }
  return { kg, n: items.length, avgQ: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null, av: lf ? kg * lf.value : null, first: items.length ? items[0].date : null, last: items.length ? items[items.length - 1].date : null, months: Object.values(mm).sort((a, b) => a.k.localeCompare(b.k)) };
}
function srcReportBody(d) {
  const fx = ctFactors(d.factors), lf = fx.lfMain, la = fx.lfAlt, pr = fx.pr, pj = d.project || {};
  const s = srcReportStats(d.items, lf ? { value: +lf.value } : null);
  const hasT = d.items.length > 0 && d.items.every(i => i.transport != null);
  const set = ctSet({ name: d.source.name, kg: s.kg, a: lf ? s.kg * lf.value : 0, aAlt: la ? s.kg * la.value : null, t: d.items.reduce((x, i) => x + (+i.transport || 0), 0), p: pr ? s.kg * pr.value : 0, first: s.first, last: s.last });
  const C = i => (lf ? i.kg * lf.value : 0) - (+i.transport || 0) - (pr ? i.kg * pr.value : 0);
  const kv = (l, v) => `<div>${l}<b>${v}</b></div>`;
  const esgQ = d.print ? '' : ctQ('ใช้ตัวเลขนี้ในรายงานขององค์กร', `<p>${CT_SRC_NOTE}</p><p>${ctKbLink('scope')}</p>`);
  return `<div class="rp"><h1>รายงานการส่งมอบเศษอาหารเพื่อเลี้ยงหนอนโปรตีน BSF</h1>
    <div>${esc(d.issuer || CONFIG.SYSTEM_NAME)}${pj.name ? ' · ' + esc(pj.name) : ''}</div>
    <h2>${esc(d.source.name)}</h2><div class="m">${esc(d.source.type || '')}${d.source.address ? ' · ' + esc(d.source.address) : ''}</div>
    <div class="m">ช่วงข้อมูล ${s.first ? `${thDay(s.first)} – ${thDay(s.last)}` : '-'}${d.scopeNote ? ' · ' + esc(d.scopeNote) : ''} · ออกรายงาน ${thDate(new Date().toISOString())}</div>
    <div class="k" style="margin-top:8px">${kv('เศษอาหารที่ส่งมอบ', ctNum(ctFloor(s.kg, 2), 2) + ' กก.')}${kv('จำนวนครั้งที่เข้ารับ', fmtInt(s.n) + ' ครั้ง')}${kv('คะแนนคัดแยกเฉลี่ย', s.avgQ == null ? '-' : ctNum(ctFloor(s.avgQ, 2), 2) + ' / 5')}</div>
    ${lf && fx.ready && s.kg > 0 ? ctHero(set, fx, { kind: 'source', isPublic: true, details: !d.print, links: !d.print, noQ: !!d.print }) : ''}
    ${hasT ? '' : '<div class="m">ยังไม่หักการขนส่ง (ฐานข้อมูลยังไม่มีค่าขนส่งรายแหล่ง)</div>'}
    <div class="m">ใช้ประกอบรายงานความยั่งยืนได้ แต่ห้ามนำไปหักออกจากบัญชีก๊าซเรือนกระจกขององค์กร ${esgQ}</div>
    <h2>รายเดือน</h2><table><thead><tr><th>เดือน</th><th class="n">ครั้ง</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนเฉลี่ย</th><th class="n">C (kgCO2e)</th></tr></thead><tbody>${s.months.map(m => `<tr><td>${thMonth(m.k + '-01')}</td><td class="n">${fmtInt(m.n)}</td><td class="n">${ctF2(m.kg)}</td><td class="n">${m.q.length ? ctNum(ctFloor(m.q.reduce((a, b) => a + b, 0) / m.q.length, 2), 2) : '-'}</td><td class="n">${ctCell(C({ kg: m.kg, transport: m.t }))}</td></tr>`).join('') || '<tr><td colspan="5">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    <h2>รายละเอียดการเข้ารับ</h2><table><thead><tr><th>วันที่</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนคัดแยก</th><th class="n">C (kgCO2e)</th></tr></thead><tbody>${d.items.map(i => `<tr><td>${thDay(i.date)}</td><td class="n">${ctF2(i.kg)}</td><td class="n">${i.quality ?? '-'}</td><td class="n">${ctCell(C(i))}</td></tr>`).join('') || '<tr><td colspan="4">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    <div class="m">C = หลีกเลี่ยงการฝังกลบ − ขนส่ง (แบ่งตามน้ำหนักของเที่ยว) − การเลี้ยงหนอน</div>
    ${d.print && fx.ready ? ctAppendix(fx, { source: true }) : ''}
    ${pj.name || pj.leader_name || pj.contact_email ? `<div class="contact"><b>ติดต่อ</b><br>${pj.name ? `โครงการวิจัย: ${esc(pj.name)}<br>` : ''}${pj.leader_name ? `หัวหน้าโครงการวิจัย: ${esc(pj.leader_name)}<br>` : ''}${pj.contact_email ? `อีเมล: ${esc(pj.contact_email)}` : ''}</div>` : ''}
    ${d.link ? `<div class="m" style="margin-top:8px">ดูรายงานล่าสุดออนไลน์: ${esc(d.link)}</div>` : ''}</div>`;
}
const srcShareUrl = token => (CREDIT.url || location.origin + '/') + 'src/?t=' + token;
