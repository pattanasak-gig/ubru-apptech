/* =====================================================================
   UBRU AppTech System — src-report.js  เนื้อรายงานแหล่งกำเนิดเศษอาหาร (DEC-122)
   ใช้ร่วม: รายงานพิมพ์/PDF ในหน้าเศษอาหาร (food-src.js) และหน้าลิงก์สาธารณะ src/?t=รหัส (ไม่ต้องล็อกอิน)
   d = { source:{name,type,address}, project:{code,name,leader_name,contact_email}, items:[{date,kg,quality}], lf, pr, scopeNote, link, issuer }
   ===================================================================== */
const SRC_REPORT_CSS = 'h1{font-size:20px;margin:0}h2{font-size:16px;margin:18px 0 6px}.rp table{width:100%;border-collapse:collapse;margin:6px 0}.rp th,.rp td{border:1px solid #999;padding:4px 6px;text-align:left}.rp td.n,.rp th.n{text-align:right}.rp .k{display:flex;flex-wrap:wrap;gap:8px}.rp .k div{border:1px solid #999;border-radius:6px;padding:6px 10px;min-width:150px}.rp .k b{display:block;font-size:18px}.rp .m{color:#444;font-size:12px}.rp .contact{margin-top:16px;padding:8px 10px;border:1px solid #999;border-radius:6px}';
function srcReportStats(items, lf) {
  const kg = items.reduce((a, i) => a + Number(i.kg), 0), q = items.filter(i => i.quality != null).map(i => Number(i.quality));
  const mm = {}; for (const i of items) { const k = String(i.date).slice(0, 7); const m = mm[k] = mm[k] || { k, kg: 0, n: 0, q: [] }; m.kg += Number(i.kg); m.n++; if (i.quality != null) m.q.push(Number(i.quality)); }
  return { kg, n: items.length, avgQ: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null, av: lf ? kg * lf.value : null, first: items.length ? items[0].date : null, last: items.length ? items[items.length - 1].date : null, months: Object.values(mm).sort((a, b) => a.k.localeCompare(b.k)) };
}
function srcReportBody(d) {
  const lf = d.lf, pr = d.pr, s = srcReportStats(d.items, lf), pj = d.project || {};
  return `<div class="rp"><h1>รายงานการส่งมอบเศษอาหารเพื่อเลี้ยงหนอนโปรตีน BSF</h1>
    <div>${esc(d.issuer || CONFIG.SYSTEM_NAME)}${pj.name ? ' · ' + esc(pj.name) : ''}</div>
    <h2>${esc(d.source.name)}</h2><div class="m">${esc(d.source.type || '')}${d.source.address ? ' · ' + esc(d.source.address) : ''}</div>
    <div class="m">ช่วงข้อมูล ${s.first ? `${thDay(s.first)} – ${thDay(s.last)}` : '-'}${d.scopeNote ? ' · ' + esc(d.scopeNote) : ''} · ออกรายงาน ${thDate(new Date().toISOString())}</div>
    <h2>สรุป</h2><div class="k"><div>เศษอาหารที่ส่งมอบ<b>${fmt2(s.kg)} กก.</b></div><div>จำนวนครั้งที่เข้ารับ<b>${fmtInt(s.n)} ครั้ง</b></div><div>คะแนนคัดแยกเฉลี่ย<b>${s.avgQ == null ? '-' : fmt(s.avgQ, 2) + ' / 5'}</b></div><div>ก๊าซเรือนกระจกที่หลีกเลี่ยงได้<b>${s.av == null ? '-' : fmt2(s.av) + ' kgCO2e'}</b></div></div>
    <h2>รายเดือน</h2><table><thead><tr><th>เดือน</th><th class="n">ครั้ง</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนเฉลี่ย</th><th class="n">หลีกเลี่ยงการฝังกลบ (kgCO2e)</th></tr></thead><tbody>${s.months.map(m => `<tr><td>${thMonth(m.k + '-01')}</td><td class="n">${fmtInt(m.n)}</td><td class="n">${fmt2(m.kg)}</td><td class="n">${m.q.length ? fmt(m.q.reduce((a, b) => a + b, 0) / m.q.length, 2) : '-'}</td><td class="n">${lf ? fmt2(m.kg * lf.value) : '-'}</td></tr>`).join('') || '<tr><td colspan="5">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    <h2>รายละเอียดการเข้ารับ</h2><table><thead><tr><th>วันที่</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนคัดแยก</th><th class="n">หลีกเลี่ยง (kgCO2e)</th></tr></thead><tbody>${d.items.map(i => `<tr><td>${thDay(i.date)}</td><td class="n">${fmt2(i.kg)}</td><td class="n">${i.quality ?? '-'}</td><td class="n">${lf ? fmt2(i.kg * lf.value) : '-'}</td></tr>`).join('') || '<tr><td colspan="4">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    <h2>วิธีคิดและแหล่งอ้างอิง</h2><div class="m">ก๊าซที่หลีกเลี่ยงได้ = เศษอาหาร (กก.) × ${lf ? `${fmt(lf.value, 4)} ${esc(lf.unit)} — ${esc(lf.source || lf.code)}` : 'ยังไม่ได้เลือกค่า'} · คิดจากการนำเศษอาหารไปเลี้ยงหนอนแทนการฝังกลบ · ยังไม่หักการปล่อยจากการขนส่ง${pr ? ` และการเลี้ยงหนอน (${fmt(pr.value, 4)} ${esc(pr.unit)} — ${esc(pr.source || pr.code)})` : ''} · ทศนิยม 2 ตำแหน่ง · 1,000 kgCO2e = 1 tCO2e · คะแนนคัดแยก 1–5 (5 = คัดแยกดีเยี่ยม)</div>
    ${pj.name || pj.leader_name || pj.contact_email ? `<div class="contact"><b>ติดต่อ</b><br>${pj.name ? `โครงการวิจัย: ${esc(pj.name)}<br>` : ''}${pj.leader_name ? `หัวหน้าโครงการวิจัย: ${esc(pj.leader_name)}<br>` : ''}${pj.contact_email ? `อีเมล: ${esc(pj.contact_email)}` : ''}</div>` : ''}
    ${d.link ? `<div class="m" style="margin-top:8px">ดูรายงานล่าสุดออนไลน์: ${esc(d.link)}</div>` : ''}</div>`;
}
const srcShareUrl = token => (CREDIT.url || location.origin + '/') + 'src/?t=' + token;
