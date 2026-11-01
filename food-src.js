/* =====================================================================
   UBRU AppTech System — food-src.js  รายงานแหล่งกำเนิดเศษอาหาร (DEC-122)
   ใช้คืนข้อมูลให้แหล่งกำเนิด: สรุปทุกแหล่ง (#src) · หน้ารายงานต่อแหล่ง (#src/<id>) แดชบอร์ด + ตารางรอบ + พิมพ์/PDF + CSV
   คาร์บอนรายแหล่ง (DEC-113): หลีกเลี่ยงการฝังกลบ = กก. × EF ฝังกลบ (ค่าหลัก) · หักการเลี้ยงหนอน = กก. × EF กระบวนการ (ค่าหลัก)
     ค่าขนส่งไม่แบ่งลงรายแหล่ง (DEC-113 ข้อ ข) → ตัวเลขรายแหล่งยังไม่หักขนส่ง (ภาพรวมที่หักแล้วอยู่หน้า "คาร์บอน")
   โหลดโดย food/index.html หลัง common.js
   ===================================================================== */
const srcPrim = (factors, c) => factors.find(f => f.category === c && f.is_primary) || null;
// รวมรายการรายแหล่ง: กก. · รอบ · คะแนนเฉลี่ย · ช่วงวันที่ · คาร์บอน
function srcGroup(items, lf, pr) {
  const m = {};
  for (const i of items) {
    const g = m[i.source_id] = m[i.source_id] || { id: i.source_id, name: i.source_name, type: i.source_type_name || '', kg: 0, pk: new Set(), q: [], first: null, last: null, items: [] };
    g.kg += +i.weight_kg || 0; g.pk.add(i.pickup_id); if (i.quality != null) g.q.push(+i.quality); g.items.push(i);
    if (!g.first || i.pickup_date < g.first) g.first = i.pickup_date; if (!g.last || i.pickup_date > g.last) g.last = i.pickup_date;
  }
  return Object.values(m).map(g => ({ ...g, pickups: g.pk.size, avgQ: g.q.length ? g.q.reduce((a, b) => a + b, 0) / g.q.length : null,
    av: lf ? g.kg * lf.value : null, pc: pr ? g.kg * pr.value : null, net: lf ? g.kg * lf.value - (pr ? g.kg * pr.value : 0) : null })).sort((a, b) => b.kg - a.kg);
}
async function srcData(sourceId) {
  const st = S._sr = S._sr || { project: '', from: '', to: '' };
  const eq = { status: 'active', pickup_status: 'active', ...scopeEq() }; if (st.project) eq.project_id = st.project; if (sourceId) eq.source_id = sourceId;
  const o = { eq, order: ['pickup_date'] }; if (st.from) o.gte = { pickup_date: st.from }; if (st.to) o.lte = { pickup_date: st.to };
  const [items, factors] = await Promise.all([api.list('food.v_pickup_item', o), api.list('food.carbon_factor', { eq: { status: 'active' }, order: ['sort_order'] }).catch(() => [])]);
  return { st, items, factors, lf: srcPrim(factors, 'landfill'), pr: srcPrim(factors, 'process') };
}
const srcFilters = st => `<div class="row">${projectFilter('S._sr.project', st.project)}<label style="margin:0">ตั้งแต่ <input type="date" value="${st.from}" onchange="S._sr.from=this.value;render()" style="width:auto"></label><label style="margin:0">ถึง <input type="date" value="${st.to}" onchange="S._sr.to=this.value;render()" style="width:auto"></label></div>`;
const srcMethod = (lf, pr) => `<div class="banner" style="margin-top:8px"><b>วิธีคิด</b> · หลีกเลี่ยงการฝังกลบ = เศษอาหาร (กก.) × ${lf ? `${fmt(lf.value, 4)} ${esc(lf.unit)} (${esc(lf.code)} · ${esc(lf.source || '')})` : '<span style="color:var(--danger)">ยังไม่ได้เลือกค่าหลัก</span>'} · หักการเลี้ยงหนอน = กก. × ${pr ? `${fmt(pr.value, 4)} ${esc(pr.unit)} (${esc(pr.code)})` : '-'} · <b>ยังไม่หักการขนส่ง</b> เพราะรถหนึ่งเที่ยวรับหลายแหล่ง (ภาพรวมที่หักขนส่งแล้วดูหน้า <a href="#carbon">คาร์บอน</a>)</div>`;

async function pageSources(view) {
  const id = location.hash.split('/')[1];
  if (id) return pageSource(view, id);
  const { st, items, lf, pr } = await srcData();
  const gs = srcGroup(items, lf, pr), tk = sum(gs, 'kg');
  S._srRows = gs.map(g => ({ แหล่งกำเนิด: g.name, ประเภท: g.type, รอบ: g.pickups, เศษอาหาร_กก: +g.kg.toFixed(2), คะแนนคัดแยกเฉลี่ย: g.avgQ == null ? '' : +g.avgQ.toFixed(2), หลีกเลี่ยงฝังกลบ_kgCO2e: g.av == null ? '' : +g.av.toFixed(2), หักการเลี้ยงหนอน_kgCO2e: g.pc == null ? '' : +g.pc.toFixed(2), สุทธิไม่รวมขนส่ง_kgCO2e: g.net == null ? '' : +g.net.toFixed(2), ครั้งแรก: g.first, ครั้งล่าสุด: g.last }));
  view.innerHTML = `${scopeSelector()}<div class="card"><div class="cardhead"><h4>รายงานแหล่งกำเนิดเศษอาหาร (${fmtInt(gs.length)}) ${helpBtn('src')}</h4><button class="small secondary" onclick="exportCsv(S._srRows,'แหล่งกำเนิด')">ส่งออก CSV</button></div>${srcFilters(st)}
      <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">เศษอาหารจากแหล่งกำเนิด</div><div class="v">${fmt(tk)} กก.</div></div>
        <div class="kpi"><div class="l">แหล่งกำเนิดที่ส่งมอบ</div><div class="v">${fmtInt(gs.length)}</div></div>
        <div class="kpi"><div class="l">หลีกเลี่ยงการฝังกลบ (kgCO2e)</div><div class="v">${lf ? fmt2(tk * lf.value) : '-'}</div></div>
        <div class="kpi"><div class="l">สุทธิหลังหักการเลี้ยงหนอน (ไม่รวมขนส่ง)</div><div class="v">${lf ? fmt2(tk * lf.value - (pr ? tk * pr.value : 0)) : '-'}</div></div></div>
      ${srcMethod(lf, pr)}</div>
    ${gs.length ? `<div class="card"><div class="cardhead"><h4>เศษอาหารและก๊าซที่หลีกเลี่ยงได้ รายแหล่ง</h4></div><div style="position:relative;height:${Math.max(160, 46 * Math.min(gs.length, 15) + 60)}px"><canvas id="srcChart" aria-label="กราฟรายแหล่งกำเนิด"></canvas></div></div>` : ''}
    <div class="card"><div class="cardhead"><h4>ทุกแหล่งกำเนิด</h4><span class="muted">กดชื่อเพื่อเปิดรายงานของแหล่งนั้น</span></div><div class="tscroll"><table data-sort="data"><thead><tr><th>แหล่งกำเนิด</th><th>ประเภท</th><th class="num">รอบ</th><th class="num">เศษอาหาร กก.</th><th class="num">คะแนนคัดแยก</th><th class="num">หลีกเลี่ยงฝังกลบ kgCO2e</th><th class="num">หักเลี้ยงหนอน</th><th class="num">สุทธิ*</th><th>ครั้งล่าสุด</th></tr></thead><tbody>
      ${gs.map(g => `<tr><td><a href="#src/${g.id}">${esc(g.name)}</a></td><td>${esc(g.type)}</td><td class="num">${fmtInt(g.pickups)}</td><td class="num">${fmt2(g.kg)}</td><td class="num">${g.avgQ == null ? '-' : fmt(g.avgQ, 2)}</td><td class="num">${g.av == null ? '-' : fmt2(g.av)}</td><td class="num">${g.pc == null ? '-' : fmt2(g.pc)}</td><td class="num">${g.net == null ? '-' : fmt2(g.net)}</td><td class="nowrap">${thDay(g.last)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>'}
      </tbody></table></div><div class="muted" style="margin-top:6px">* สุทธิ = หลีกเลี่ยงการฝังกลบ − การเลี้ยงหนอน · ยังไม่หักการขนส่ง</div></div>`;
  const top = gs.slice(0, 15);
  if (top.length && window.Chart) mkChart($('#srcChart'), { type: 'bar', data: { labels: top.map(g => g.name), datasets: [{ label: 'เศษอาหาร (กก.)', data: top.map(g => +g.kg.toFixed(2)), backgroundColor: PALETTE[0], xAxisID: 'x' }, ...(lf ? [{ label: 'หลีกเลี่ยงการฝังกลบ (kgCO2e)', data: top.map(g => +g.av.toFixed(2)), backgroundColor: '#2E7D32', xAxisID: 'x' }] : [])] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt2(c.parsed.x)}` } } }, scales: { x: { beginAtZero: true } } } });
}

async function pageSource(view, id) {
  const src = (S.sources || []).find(s => s.id === id) || {};
  const { st, items, lf, pr } = await srcData(id);
  const g = srcGroup(items, lf, pr)[0] || { name: src.name || '-', kg: 0, pickups: 0, avgQ: null, av: lf ? 0 : null, pc: pr ? 0 : null, net: lf ? 0 : null, first: null, last: null, items: [] };
  const pids = [...new Set(items.map(i => i.pickup_id))];
  const pk = pids.length ? await api.list('food.v_pickup', { in: { id: pids } }) : [];
  const pkOf = pid => pk.find(p => p.id === pid) || {};
  const mm = {}; for (const i of items) { const k = String(i.pickup_date).slice(0, 7); const m = mm[k] = mm[k] || { k, kg: 0, n: new Set(), q: [] }; m.kg += +i.weight_kg; m.n.add(i.pickup_id); if (i.quality != null) m.q.push(+i.quality); }
  const months = Object.values(mm).sort((a, b) => a.k.localeCompare(b.k));
  const qd = [1, 2, 3, 4, 5].map(q => items.filter(i => +i.quality === q).length);
  S._srOne = { src, g, items, months, lf, pr, st, pkOf };
  S._srCsv = items.map(i => ({ วันที่: i.pickup_date, เวลา: i.pickup_time || '', ฟาร์มปลายทาง: i.farm_name, โครงการ: i.project_code, เศษอาหาร_กก: i.weight_kg, คะแนนคัดแยก: i.quality ?? '', หลีกเลี่ยงฝังกลบ_kgCO2e: lf ? +(i.weight_kg * lf.value).toFixed(2) : '', หมายเหตุ: i.note || '' }));
  view.innerHTML = `${scopeSelector()}<div class="card"><div class="cardhead"><div><h4 style="margin:0">${esc(g.name || src.name)}</h4><div class="muted">${esc(g.type || '')}${src.address ? ' · ' + esc(src.address) : ''}${src.contact ? ' · ติดต่อ ' + esc(src.contact) : ''}</div></div><div class="row"><button class="small" onclick="printSourceReport()">พิมพ์ / PDF</button><button class="small secondary" onclick="exportCsv(S._srCsv,'แหล่ง_${esc((g.name || '').replace(/[^\\wก-๙]+/g, '_'))}')">CSV</button></div></div>
      ${srcFilters(st)}
      <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">เศษอาหารที่ส่งมอบ</div><div class="v">${fmt(g.kg)} กก.</div></div>
        <div class="kpi"><div class="l">จำนวนครั้งที่เข้ารับ</div><div class="v">${fmtInt(g.pickups)}</div></div>
        <div class="kpi"><div class="l">เฉลี่ยต่อครั้ง</div><div class="v">${g.pickups ? fmt(g.kg / g.pickups) + ' กก.' : '-'}</div></div>
        <div class="kpi"><div class="l">คะแนนคัดแยกเฉลี่ย (เต็ม 5)</div><div class="v">${g.avgQ == null ? '-' : fmt(g.avgQ, 2)}</div></div>
        <div class="kpi"><div class="l">ก๊าซที่หลีกเลี่ยงได้ (kgCO2e)</div><div class="v" style="color:#2E7D32">${g.av == null ? '-' : fmt2(g.av)}</div></div>
        <div class="kpi"><div class="l">สุทธิหลังหักการเลี้ยงหนอน</div><div class="v">${g.net == null ? '-' : fmt2(g.net)}</div></div></div>
      <div class="muted" style="margin-top:6px">ช่วงข้อมูล ${g.first ? `${thDay(g.first)} – ${thDay(g.last)}` : '-'}${st.project || st.from || st.to ? ' (ตามตัวกรอง)' : ''}</div>
      ${srcMethod(lf, pr)}</div>
    ${months.length ? `<div class="grid-dash"><div class="card"><h4 style="margin-top:0">รายเดือน</h4><div style="position:relative;height:260px"><canvas id="srcMonth" aria-label="กราฟรายเดือนของแหล่ง"></canvas></div></div>
      <div class="card"><h4 style="margin-top:0">คะแนนคัดแยก (จำนวนครั้ง)</h4>${[5, 4, 3, 2, 1].map(q => hbar(`${q} ${(typeof QUALITY !== 'undefined' && QUALITY[q]) || ''}`, qd[q - 1], Math.max(...qd, 1), q >= 4 ? '#2E7D32' : q === 3 ? '#F9A825' : '#C62828', fmtInt(qd[q - 1]))).join('')}<div class="muted">ไม่ได้ให้คะแนน ${fmtInt(items.filter(i => i.quality == null).length)} ครั้ง</div></div></div>` : ''}
    <div class="card"><div class="cardhead"><h4>รายละเอียดการเข้ารับ (${fmtInt(items.length)})</h4></div><div class="tscroll"><table><thead><tr><th>วันที่</th><th>ฟาร์มปลายทาง</th><th class="num">กก.</th><th class="num">คะแนน</th><th class="num">หลีกเลี่ยง kgCO2e</th><th>รูป</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${items.slice().reverse().map(i => { const p = pkOf(i.pickup_id); return `<tr><td class="nowrap"><a href="#pickup/${i.pickup_id}">${thDay(i.pickup_date)}</a>${i.pickup_time ? ' ' + String(i.pickup_time).slice(0, 5) : ''}</td><td>${esc(i.farm_name)}<div class="muted">${esc(i.project_code || '')}</div></td><td class="num">${fmt2(i.weight_kg)}</td><td class="num">${i.quality ?? '-'}</td><td class="num">${lf ? fmt2(i.weight_kg * lf.value) : '-'}</td><td>${p.photo_count ? `📷 ${fmtInt(p.photo_count)}` : ''}</td><td class="muted">${esc(i.note || '')}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">ไม่มีการเข้ารับในช่วงที่เลือก</td></tr>'}
      </tbody></table></div></div>
    <div class="row"><a class="btn secondary" style="text-decoration:none" href="#src">‹ ทุกแหล่งกำเนิด</a></div>`;
  if (months.length && window.Chart) mkChart($('#srcMonth'), { data: { labels: months.map(m => thMonth(m.k + '-01')), datasets: [
    { type: 'bar', label: 'เศษอาหาร (กก.)', data: months.map(m => +m.kg.toFixed(2)), backgroundColor: PALETTE[0], yAxisID: 'y' },
    ...(lf ? [{ type: 'line', label: 'หลีกเลี่ยงการฝังกลบ (kgCO2e)', data: months.map(m => +(m.kg * lf.value).toFixed(2)), borderColor: '#2E7D32', backgroundColor: '#2E7D32', tension: .2, yAxisID: 'y2' }] : [])] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt2(c.parsed.y)}` } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'กก.' } }, y2: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'kgCO2e' } } } } });
}

// รายงานพิมพ์/PDF สำหรับส่งให้แหล่งกำเนิด (หน้าต่างใหม่ · กดพิมพ์หรือบันทึกเป็น PDF)
function printSourceReport() {
  const { src, g, items, months, lf, pr, st } = S._srOne || {}; if (!g) return;
  const sys = setting('system_name') || CONFIG.SYSTEM_NAME, pj = st.project ? projOf(st.project) : null;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานการส่งมอบเศษอาหาร · ${esc(g.name)}</title><style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=swap');body{font:14px/1.6 "Noto Sans Thai",system-ui,sans-serif;margin:24px;color:#000}h1{font-size:20px;margin:0}h2{font-size:16px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #999;padding:4px 6px;text-align:left}td.n,th.n{text-align:right}.k{display:flex;flex-wrap:wrap;gap:8px}.k div{border:1px solid #999;border-radius:6px;padding:6px 10px;min-width:150px}.k b{display:block;font-size:18px}.m{color:#444;font-size:12px}@media print{button{display:none}}</style></head><body>
    <button onclick="window.print()">พิมพ์ / บันทึก PDF</button>
    <h1>รายงานการส่งมอบเศษอาหารเพื่อเลี้ยงหนอนแมลงวันลาย (BSF)</h1>
    <div>${esc(sys)}${pj && pj.name ? ' · ' + esc(pj.name) : ''}</div>
    <h2>${esc(g.name)}</h2><div class="m">${esc(g.type || '')}${src.address ? ' · ' + esc(src.address) : ''}</div>
    <div class="m">ช่วงข้อมูล ${g.first ? `${thDay(g.first)} – ${thDay(g.last)}` : '-'} · ออกรายงาน ${thDate(new Date().toISOString())}</div>
    <h2>สรุป</h2><div class="k"><div>เศษอาหารที่ส่งมอบ<b>${fmt2(g.kg)} กก.</b></div><div>จำนวนครั้งที่เข้ารับ<b>${fmtInt(g.pickups)} ครั้ง</b></div><div>คะแนนคัดแยกเฉลี่ย<b>${g.avgQ == null ? '-' : fmt(g.avgQ, 2) + ' / 5'}</b></div><div>ก๊าซเรือนกระจกที่หลีกเลี่ยงได้<b>${g.av == null ? '-' : fmt2(g.av) + ' kgCO2e'}</b></div></div>
    <h2>รายเดือน</h2><table><thead><tr><th>เดือน</th><th class="n">ครั้ง</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนเฉลี่ย</th><th class="n">หลีกเลี่ยงการฝังกลบ (kgCO2e)</th></tr></thead><tbody>${months.map(m => `<tr><td>${thMonth(m.k + '-01')}</td><td class="n">${fmtInt(m.n.size)}</td><td class="n">${fmt2(m.kg)}</td><td class="n">${m.q.length ? fmt(m.q.reduce((a, b) => a + b, 0) / m.q.length, 2) : '-'}</td><td class="n">${lf ? fmt2(m.kg * lf.value) : '-'}</td></tr>`).join('')}</tbody></table>
    <h2>รายละเอียดการเข้ารับ</h2><table><thead><tr><th>วันที่</th><th class="n">เศษอาหาร (กก.)</th><th class="n">คะแนนคัดแยก</th><th class="n">หลีกเลี่ยง (kgCO2e)</th></tr></thead><tbody>${items.map(i => `<tr><td>${thDay(i.pickup_date)}</td><td class="n">${fmt2(i.weight_kg)}</td><td class="n">${i.quality ?? '-'}</td><td class="n">${lf ? fmt2(i.weight_kg * lf.value) : '-'}</td></tr>`).join('')}</tbody></table>
    <h2>วิธีคิดและแหล่งอ้างอิง</h2><div class="m">ก๊าซที่หลีกเลี่ยงได้ = เศษอาหาร (กก.) × ${lf ? `${fmt(lf.value, 4)} ${esc(lf.unit)} — ${esc(lf.source || lf.code)}` : 'ยังไม่ได้เลือกค่า'} · คิดจากการนำเศษอาหารไปเลี้ยงหนอนแทนการฝังกลบ · ยังไม่หักการปล่อยจากการขนส่ง${pr ? ` และการเลี้ยงหนอน (${fmt(pr.value, 4)} ${esc(pr.unit)} — ${esc(pr.source || pr.code)})` : ''} · ตัวเลขทศนิยม 2 ตำแหน่ง · 1,000 kgCO2e = 1 tCO2e · คะแนนคัดแยก 1–5 (5 = คัดแยกดีเยี่ยม)</div>
    </body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('เบราว์เซอร์กันหน้าต่างใหม่ กรุณาอนุญาตป๊อปอัป', true); w.document.write(withCredit(html)); w.document.close();
}
