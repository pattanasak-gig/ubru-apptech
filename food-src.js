/* =====================================================================
   UBRU AppTech System — food-src.js  รายงานแหล่งกำเนิดเศษอาหาร (DEC-122)
   ใช้คืนข้อมูลให้แหล่งกำเนิด: สรุปทุกแหล่ง (#src) · หน้ารายงานต่อแหล่ง (#src/<id>) แดชบอร์ด + ตารางรอบ + พิมพ์/PDF + CSV
   คาร์บอนรายแหล่ง (DEC-113): หลีกเลี่ยงการฝังกลบ = กก. × EF ฝังกลบ (ค่าหลัก) · หักการเลี้ยงหนอนโปรตีน BSF = กก. × EF กระบวนการ (ค่าหลัก)
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
const srcMethod = (lf, pr) => `<div class="banner" style="margin-top:8px"><b>วิธีคิด</b> · หลีกเลี่ยงการฝังกลบ = เศษอาหาร (กก.) × ${lf ? `${fmt(lf.value, 4)} ${esc(lf.unit)} (${esc(lf.code)} · ${esc(lf.source || '')})` : '<span style="color:var(--danger)">ยังไม่ได้เลือกค่าหลัก</span>'} · หักการเลี้ยงหนอนโปรตีน BSF = กก. × ${pr ? `${fmt(pr.value, 4)} ${esc(pr.unit)} (${esc(pr.code)})` : '-'} · <b>ยังไม่หักการขนส่ง</b> เพราะรถหนึ่งเที่ยวรับหลายแหล่ง (ภาพรวมที่หักขนส่งแล้วดูหน้า <a href="#carbon">คาร์บอน</a>)</div>`;

async function pageSources(view) {
  const id = location.hash.split('/')[1];
  if (id) return pageSource(view, id);
  const { st, items, lf, pr } = await srcData();
  const gs = srcGroup(items, lf, pr), tk = sum(gs, 'kg');
  S._srRows = gs.map(g => ({ แหล่งกำเนิด: g.name, ประเภท: g.type, รอบ: g.pickups, เศษอาหาร_กก: +g.kg.toFixed(2), คะแนนคัดแยกเฉลี่ย: g.avgQ == null ? '' : +g.avgQ.toFixed(2), หลีกเลี่ยงฝังกลบ_kgCO2e: g.av == null ? '' : +g.av.toFixed(2), 'หักการเลี้ยงหนอนโปรตีน_BSF_kgCO2e': g.pc == null ? '' : +g.pc.toFixed(2), สุทธิไม่รวมขนส่ง_kgCO2e: g.net == null ? '' : +g.net.toFixed(2), ครั้งแรก: g.first, ครั้งล่าสุด: g.last }));
  view.innerHTML = `${scopeSelector()}<div class="card"><div class="cardhead"><h4>รายงานแหล่งกำเนิดเศษอาหาร (${fmtInt(gs.length)}) ${helpBtn('src')}</h4><button class="small secondary" onclick="exportCsv(S._srRows,'แหล่งกำเนิด')">ส่งออก CSV</button></div>${srcFilters(st)}
      <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">เศษอาหารจากแหล่งกำเนิด</div><div class="v">${fmt(tk)} กก.</div></div>
        <div class="kpi"><div class="l">แหล่งกำเนิดที่ส่งมอบ</div><div class="v">${fmtInt(gs.length)}</div></div>
        <div class="kpi"><div class="l">หลีกเลี่ยงการฝังกลบ (kgCO2e)</div><div class="v">${lf ? fmt2(tk * lf.value) : '-'}</div></div>
        <div class="kpi"><div class="l">สุทธิหลังหักการเลี้ยงหนอนโปรตีน BSF (ไม่รวมขนส่ง)</div><div class="v">${lf ? fmt2(tk * lf.value - (pr ? tk * pr.value : 0)) : '-'}</div></div></div>
      ${srcMethod(lf, pr)}</div>
    ${gs.length ? `<div class="card"><div class="cardhead"><h4>เศษอาหารและก๊าซที่หลีกเลี่ยงได้ รายแหล่ง</h4></div><div style="position:relative;height:${Math.max(160, 46 * Math.min(gs.length, 15) + 60)}px"><canvas id="srcChart" aria-label="กราฟรายแหล่งกำเนิด"></canvas></div></div>` : ''}
    <div class="card"><div class="cardhead"><h4>ทุกแหล่งกำเนิด</h4><span class="muted">กดชื่อเพื่อเปิดรายงานของแหล่งนั้น</span></div><div class="tscroll"><table data-sort="data"><thead><tr><th>แหล่งกำเนิด</th><th>ประเภท</th><th class="num">รอบ</th><th class="num">เศษอาหาร กก.</th><th class="num">คะแนนคัดแยก</th><th class="num">หลีกเลี่ยงฝังกลบ kgCO2e</th><th class="num">หักเลี้ยงหนอนโปรตีน BSF</th><th class="num">สุทธิ*</th><th>ครั้งล่าสุด</th></tr></thead><tbody>
      ${gs.map(g => `<tr><td><a href="#src/${g.id}">${esc(g.name)}</a></td><td>${esc(g.type)}</td><td class="num">${fmtInt(g.pickups)}</td><td class="num">${fmt2(g.kg)}</td><td class="num">${g.avgQ == null ? '-' : fmt(g.avgQ, 2)}</td><td class="num">${g.av == null ? '-' : fmt2(g.av)}</td><td class="num">${g.pc == null ? '-' : fmt2(g.pc)}</td><td class="num">${g.net == null ? '-' : fmt2(g.net)}</td><td class="nowrap">${thDay(g.last)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>'}
      </tbody></table></div><div class="muted" style="margin-top:6px">* สุทธิ = หลีกเลี่ยงการฝังกลบ − การเลี้ยงหนอนโปรตีน BSF · ยังไม่หักการขนส่ง</div></div>`;
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
  let shares = []; if (isAdmin()) { try { shares = await api.list('food.source_share', { eq: { source_id: id }, order: ['created_at', false] }); } catch (e) { shares = null; } }
  const mm = {}; for (const i of items) { const k = String(i.pickup_date).slice(0, 7); const m = mm[k] = mm[k] || { k, kg: 0, n: new Set(), q: [] }; m.kg += +i.weight_kg; m.n.add(i.pickup_id); if (i.quality != null) m.q.push(+i.quality); }
  const months = Object.values(mm).sort((a, b) => a.k.localeCompare(b.k));
  const qd = [1, 2, 3, 4, 5].map(q => items.filter(i => +i.quality === q).length);
  S._srOne = { src, g, items, months, lf, pr, st, pkOf, shares };
  const pjc = srcProject(src, items, st);
  S._srCsv = items.map(i => ({ วันที่: i.pickup_date, เวลา: i.pickup_time || '', ฟาร์มปลายทาง: i.farm_name, โครงการ: i.project_code, เศษอาหาร_กก: i.weight_kg, คะแนนคัดแยก: i.quality ?? '', หลีกเลี่ยงฝังกลบ_kgCO2e: lf ? +(i.weight_kg * lf.value).toFixed(2) : '', หมายเหตุ: i.note || '' }));
  view.innerHTML = `${scopeSelector()}<div class="card"><div class="cardhead"><div><h4 style="margin:0">${esc(g.name || src.name)}</h4><div class="muted">${esc(g.type || '')}${src.address ? ' · ' + esc(src.address) : ''}${src.contact ? ' · ติดต่อ ' + esc(src.contact) : ''}</div></div><div class="row"><button class="small" onclick="printSourceReport()">พิมพ์ / PDF</button><button class="small secondary" onclick="exportCsv(S._srCsv,'แหล่ง_${esc((g.name || '').replace(/[^\\wก-๙]+/g, '_'))}')">CSV</button></div></div>
      ${srcFilters(st)}
      <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">เศษอาหารที่ส่งมอบ</div><div class="v">${fmt(g.kg)} กก.</div></div>
        <div class="kpi"><div class="l">จำนวนครั้งที่เข้ารับ</div><div class="v">${fmtInt(g.pickups)}</div></div>
        <div class="kpi"><div class="l">เฉลี่ยต่อครั้ง</div><div class="v">${g.pickups ? fmt(g.kg / g.pickups) + ' กก.' : '-'}</div></div>
        <div class="kpi"><div class="l">คะแนนคัดแยกเฉลี่ย (เต็ม 5)</div><div class="v">${g.avgQ == null ? '-' : fmt(g.avgQ, 2)}</div></div>
        <div class="kpi"><div class="l">ก๊าซที่หลีกเลี่ยงได้ (kgCO2e)</div><div class="v" style="color:#2E7D32">${g.av == null ? '-' : fmt2(g.av)}</div></div>
        <div class="kpi"><div class="l">สุทธิหลังหักการเลี้ยงหนอนโปรตีน BSF</div><div class="v">${g.net == null ? '-' : fmt2(g.net)}</div></div></div>
      <div class="muted" style="margin-top:6px">ช่วงข้อมูล ${g.first ? `${thDay(g.first)} – ${thDay(g.last)}` : '-'}${st.project || st.from || st.to ? ' (ตามตัวกรอง)' : ''}</div>
      ${srcMethod(lf, pr)}
      <div class="muted" style="margin-top:6px">ท้ายรายงาน: ${pjc.name ? `โครงการวิจัย ${esc(pjc.name)}` : '<b>ยังไม่มีโครงการ</b>'} · หัวหน้าโครงการ ${pjc.leader_name ? esc(pjc.leader_name) : '<b style="color:var(--warn)">ยังไม่ได้ใส่</b>'} · อีเมล ${pjc.contact_email ? esc(pjc.contact_email) : '<b style="color:var(--warn)">ยังไม่ได้ใส่</b>'}${isAdmin() ? ' · แก้ที่ <a href="#admin/project">จัดการ → โครงการวิจัย</a>' : ''}</div></div>
    ${srcShareSection(id, shares, st)}
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

// โครงการที่แสดงท้ายรายงาน: ตามตัวกรอง → โครงการหลักของแหล่ง → โครงการที่ส่งมอบมากที่สุด (เหมือน food.public_source_report)
function srcProject(src, items, st) {
  if (st.project) return projOf(st.project);
  if (src.project_id) return projOf(src.project_id);
  const m = {}; for (const i of items) m[i.project_id] = (m[i.project_id] || 0) + Number(i.weight_kg); const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  return top ? projOf(top[0]) : {};
}
// รายงานพิมพ์/PDF สำหรับส่งให้แหล่งกำเนิด (หน้าต่างใหม่ · กดพิมพ์หรือบันทึกเป็น PDF)
function printSourceReport() {
  const { src, g, items, lf, pr, st, shares } = S._srOne || {}; if (!g) return;
  const pj = srcProject(src, items, st), link = (shares || []).find(x => x.status === 'active' && (!x.project_id || x.project_id === st.project));
  const body = srcReportBody({ source: { name: g.name, type: g.type, address: src.address }, project: pj, items: items.map(i => ({ date: i.pickup_date, kg: Number(i.weight_kg), quality: i.quality })), lf, pr, issuer: orgOf(src.org_id).name || setting('system_name') || CONFIG.SYSTEM_NAME, scopeNote: st.project || st.from || st.to ? 'ตามตัวกรองที่เลือก' : '', link: link ? srcShareUrl(link.token) : '' });
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานการส่งมอบเศษอาหาร · ${esc(g.name)}</title><style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=swap');body{font:14px/1.6 "Noto Sans Thai",system-ui,sans-serif;margin:24px;color:#000}${SRC_REPORT_CSS}@media print{button{display:none}}</style></head><body><button onclick="window.print()">พิมพ์ / บันทึก PDF</button>${body}</body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('เบราว์เซอร์กันหน้าต่างใหม่ กรุณาอนุญาตป๊อปอัป', true); w.document.write(withCredit(html)); w.document.close();
}
// ลิงก์สาธารณะต่อแหล่ง (admin · DEC-122): สร้าง · คัดลอก · ยกเลิก
function srcShareSection(id, shares, st) {
  if (!isAdmin()) return '';
  if (shares === null) return '<div class="card"><h4 style="margin-top:0">ลิงก์สำหรับแหล่งกำเนิด</h4><div class="banner warn">ฐานข้อมูลยังไม่มีส่วนลิงก์ (sql/019) · ระหว่างนี้ใช้ "พิมพ์ / PDF"</div></div>';
  const act = shares.filter(x => x.status === 'active');
  return `<div class="card"><div class="cardhead"><h4>ลิงก์สำหรับแหล่งกำเนิด (เปิดได้โดยไม่ต้องล็อกอิน) ${helpBtn('src-share')}</h4><button class="small" onclick="srcShareNew('${id}')">＋ สร้างลิงก์${st.project ? ' (เฉพาะโครงการ ' + esc(projOf(st.project).code || '') + ')' : ''}</button></div>
    <div class="muted">ใครมีลิงก์ก็เปิดรายงานของแหล่งนี้ได้ (เห็นเฉพาะแหล่งนี้) · ส่งให้แหล่งกำเนิดทางไลน์/อีเมล · ยกเลิกเมื่อไม่ต้องการให้เปิดได้แล้ว</div>
    ${act.length ? `<div class="tscroll" style="margin-top:6px"><table><thead><tr><th>ลิงก์</th><th>ขอบเขต</th><th class="num">เปิดดู</th><th>สร้าง</th><th></th></tr></thead><tbody>${act.map(x => `<tr><td><input readonly value="${esc(srcShareUrl(x.token))}" style="min-width:220px" onclick="this.select()"></td><td>${x.project_id ? esc(projOf(x.project_id).code || '') : 'ทุกโครงการ'}</td><td class="num">${fmtInt(x.view_count || 0)}${x.last_viewed_at ? `<div class="muted">${thDate(x.last_viewed_at)}</div>` : ''}</td><td class="nowrap">${thDay(x.created_at)}</td><td class="nowrap"><button class="small" onclick="srcShareCopy('${x.token}')">คัดลอก</button> <a class="btn secondary small" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(srcShareUrl(x.token))}">เปิด</a> <button class="small secondary" onclick="srcShareOff('${x.id}')">ยกเลิก</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted" style="margin-top:6px">ยังไม่มีลิงก์</div>'}</div>`;
}
async function srcShareNew(sourceId) { const st = S._sr || {}; try { const r = await api.insert('food.source_share', { source_id: sourceId, project_id: st.project || null }); await srcShareCopy(r.token, true); render(); } catch (e) { fail(e, 'สร้างลิงก์ไม่สำเร็จ'); } }
async function srcShareCopy(token, created) { const u = srcShareUrl(token); try { await navigator.clipboard.writeText(u); toast((created ? 'สร้างลิงก์แล้ว · ' : '') + 'คัดลอกลิงก์แล้ว วางส่งให้แหล่งกำเนิดได้เลย'); } catch (e) { toast((created ? 'สร้างลิงก์แล้ว · ' : '') + 'คัดลอกเองจากช่องลิงก์'); } }
async function srcShareOff(id) { if (!confirm('ยกเลิกลิงก์นี้? (คนที่มีลิงก์จะเปิดรายงานไม่ได้อีก)')) return; try { await api.update('food.source_share', id, { status: 'inactive' }); toast('ยกเลิกลิงก์แล้ว'); render(); } catch (e) { fail(e); } }
