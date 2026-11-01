/* =====================================================================
   UBRU AppTech System — src-report.js  เนื้อรายงานแหล่งกำเนิดเศษอาหาร (DEC-122 · DEC-124)
   ใช้ร่วม: รายงานพิมพ์/PDF ในหน้าเศษอาหาร (food-src.js) และหน้าลิงก์สาธารณะ src/?t=รหัส (ไม่ต้องล็อกอิน)
   d = { source:{name,type,address}, project:{code,name,leader_name,contact_email}, items:[{date,kg,quality,transport}], factors:[...], scopeNote, link, issuer }
   ตัวเลขทุกตัวปัดลง (เผยแพร่ให้แหล่งกำเนิด) · ค่าขนส่งของแหล่ง = ค่าขนส่งของเที่ยวแบ่งตามน้ำหนัก (ต้องใช้ carbon-tree.js)
   ===================================================================== */
const SRC_REPORT_CSS = 'h1{font-size:20px;margin:0}h2{font-size:16px;margin:18px 0 6px}.rp table{width:100%;border-collapse:collapse;margin:6px 0}.rp th,.rp td{border:1px solid #999;padding:4px 6px;text-align:left}.rp td.n,.rp th.n,.rp td.num,.rp th.num{text-align:right}.rp .k{display:flex;flex-wrap:wrap;gap:8px}.rp .k div{border:1px solid #999;border-radius:6px;padding:6px 10px;min-width:150px}.rp .k b{display:block;font-size:18px}.rp .m{color:#444;font-size:12px}.rp .contact{margin-top:16px;padding:8px 10px;border:1px solid #999;border-radius:6px}.rp .say{margin:10px 0;padding:10px 12px;border-left:4px solid #2E7D32;background:#f1f8e9}.rp .ct-foot{color:#333}';
function srcReportStats(items, lf) {
  const kg = items.reduce((a, i) => a + Number(i.kg), 0), q = items.filter(i => i.quality != null).map(i => Number(i.quality));
  const mm = {}; for (const i of items) { const k = String(i.date).slice(0, 7); const m = mm[k] = mm[k] || { k, kg: 0, n: 0, q: [], t: 0 }; m.kg += Number(i.kg); m.n++; m.t += Number(i.transport) || 0; if (i.quality != null) m.q.push(Number(i.quality)); }
  return { kg, n: items.length, avgQ: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null, av: lf ? kg * lf.value : null, first: items.length ? items[0].date : null, last: items.length ? items[items.length - 1].date : null, months: Object.values(mm).sort((a, b) => a.k.localeCompare(b.k)) };
}
function srcReportBody(d) {
  const fx = ctFactors(d.factors), lf = fx.lfMain, la = fx.lfAlt, pr = fx.pr, kM = fx.treeMain ? +fx.treeMain.value : null;
  const s = srcReportStats(d.items, lf ? { value: +lf.value } : null), pj = d.project || {};
  const hasT = d.items.length > 0 && d.items.every(i => i.transport != null);
  const one = i => { const kg = +i.kg; return { a: lf ? kg * lf.value : 0, aa: la ? kg * la.value : null, t: +i.transport || 0, p: pr ? kg * pr.value : 0 }; };
  const set = ctSet({ name: d.source.name, kg: s.kg, a: lf ? s.kg * lf.value : 0, aAlt: la ? s.kg * la.value : null, t: d.items.reduce((x, i) => x + (+i.transport || 0), 0), p: pr ? s.kg * pr.value : 0, first: s.first, last: s.last });
  const C = r => r.a - r.t - r.p;
  const kv = (l, v) => `<div>${l}<b>${v}</b></div>`;
  const t12 = [['A', 'ไม่หักอะไร'], ['B', 'หักการขนส่ง'], ['C', 'หักการขนส่งและการเลี้ยงหนอน']].flatMap(([L, lb]) => [['main', lf, ''], ['alt', la, '*']].filter(([w]) => set[L][w] != null).map(([w, f, st]) => `<tr><td>${L} · ${lb}</td><td>${f ? fmtEf(f.value) + st : '-'}</td><td class="n">${ctCell(set[L][w])}</td><td class="n">${ctTreeCell(set[L][w], kM)}</td><td class="n">${ctTreeCell(set[L][w], fx.treeAlt ? +fx.treeAlt.value : null)}</td></tr>`)).join('');
  return `<div class="rp"><h1>รายงานการส่งมอบเศษอาหารเพื่อเลี้ยงหนอนโปรตีน BSF</h1>
    <div>${esc(d.issuer || CONFIG.SYSTEM_NAME)}${pj.name ? ' · ' + esc(pj.name) : ''}</div>
    <h2>${esc(d.source.name)}</h2><div class="m">${esc(d.source.type || '')}${d.source.address ? ' · ' + esc(d.source.address) : ''}</div>
    <div class="m">ช่วงข้อมูล ${s.first ? `${thDay(s.first)} – ${thDay(s.last)}` : '-'}${d.scopeNote ? ' · ' + esc(d.scopeNote) : ''} · ออกรายงาน ${thDate(new Date().toISOString())}</div>
    <h2>สรุป</h2><div class="k">${kv('เศษอาหารที่ส่งมอบ', ctNum(ctFloor(s.kg, 2), 2) + ' กก.')}${kv('จำนวนครั้งที่เข้ารับ', fmtInt(s.n) + ' ครั้ง')}${kv('คะแนนคัดแยกเฉลี่ย', s.avgQ == null ? '-' : ctNum(ctFloor(s.avgQ, 2), 2) + ' / 5')}
      ${kv('หลีกเลี่ยงการฝังกลบ (A)', la ? ctRange(set.A.main, set.A.alt, '*') : ctCO2Text(set.A.main))}${kv(hasT ? 'หักการขนส่งและการเลี้ยงหนอนแล้ว (C)' : 'หักการเลี้ยงหนอนแล้ว (ยังไม่หักการขนส่ง)', set.C.main > 0 ? 'ไม่น้อยกว่า ' + ctCO2Text(set.C.main) : '0 kgCO2e')}${kM && set.C.main > 0 && set.C.main / kM >= 0.1 ? kv('เทียบต้นไม้ดูดซับ 1 ปี', ctTreeLabel(set.C.main / kM) + ' ต้น') : ''}</div>
    ${lf ? `<div class="say">${esc(ctSourceSentence(set, fx, '*'))}</div>` : ''}${hasT ? '' : '<div class="m">ยังไม่หักการขนส่ง (ฐานข้อมูลยังไม่มีค่าขนส่งรายแหล่ง)</div>'}
    <h2>รายเดือน</h2><table><thead><tr><th>เดือน</th><th class="n">ครั้ง</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนเฉลี่ย</th><th class="n">หลีกเลี่ยง A (kgCO2e)</th><th class="n">ขนส่ง</th><th class="n">C (kgCO2e)</th></tr></thead><tbody>${s.months.map(m => { const r = one({ kg: m.kg, transport: m.t }); return `<tr><td>${thMonth(m.k + '-01')}</td><td class="n">${fmtInt(m.n)}</td><td class="n">${ctF2(m.kg)}</td><td class="n">${m.q.length ? ctNum(ctFloor(m.q.reduce((a, b) => a + b, 0) / m.q.length, 2), 2) : '-'}</td><td class="n">${ctF2(r.a)}</td><td class="n">${hasT ? ctF2(r.t) : '-'}</td><td class="n">${ctCell(C(r))}</td></tr>`; }).join('') || '<tr><td colspan="7">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    <h2>รายละเอียดการเข้ารับ</h2><table><thead><tr><th>วันที่</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนคัดแยก</th><th class="n">หลีกเลี่ยง A (kgCO2e)</th><th class="n">ขนส่งที่แบ่งให้</th><th class="n">C (kgCO2e)</th></tr></thead><tbody>${d.items.map(i => { const r = one(i); return `<tr><td>${thDay(i.date)}</td><td class="n">${ctF2(i.kg)}</td><td class="n">${i.quality ?? '-'}</td><td class="n">${ctF2(r.a)}</td><td class="n">${hasT ? ctF2(r.t) : '-'}</td><td class="n">${ctCell(C(r))}</td></tr>`; }).join('') || '<tr><td colspan="6">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>
    ${fx.ready ? `<h2>ตัวเลขทั้ง 12 ค่า</h2><table><thead><tr><th>ระดับ</th><th>ค่าฝังกลบ</th><th class="n">kgCO2e</th><th class="n">ต้นไม้ (k ${kM})</th><th class="n">ต้นไม้ (k ${fx.treeAlt.value})</th></tr></thead><tbody>${t12}</tbody></table><div class="m">ต้นไม้ = จำนวนต้นไม้ที่ต้องใช้ดูดซับเป็นเวลา 1 ปี · ตัวเลขปัดลง${set.B.main <= 0 || set.C.main <= 0 ? ` · † = ${CT_NEG} (แสดง 0)` : ''}</div>` : ''}
    <h2>วิธีคิดและแหล่งอ้างอิง</h2>${ctFootnote(fx, { star: true, source: true, alloc: hasT })}
    ${pj.name || pj.leader_name || pj.contact_email ? `<div class="contact"><b>ติดต่อ</b><br>${pj.name ? `โครงการวิจัย: ${esc(pj.name)}<br>` : ''}${pj.leader_name ? `หัวหน้าโครงการวิจัย: ${esc(pj.leader_name)}<br>` : ''}${pj.contact_email ? `อีเมล: ${esc(pj.contact_email)}` : ''}</div>` : ''}
    ${d.link ? `<div class="m" style="margin-top:8px">ดูรายงานล่าสุดออนไลน์: ${esc(d.link)}</div>` : ''}</div>`;
}
const srcShareUrl = token => (CREDIT.url || location.origin + '/') + 'src/?t=' + token;
