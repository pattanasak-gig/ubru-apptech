/* =====================================================================
   UBRU AppTech System — bsf-plan.js  ตัวคำนวณแผนการผลิตกระบะเลี้ยง (DEC-119)
   ฟังก์ชันล้วน (ไม่แตะหน้าเว็บ/ฐานข้อมูล) ใช้ทั้ง bsf/index.html และ tests/bsf-plan-test.mjs
   ที่มาสูตร: ชีต "คำนวณอาหารและผลผลิต BSF.xlsx" (docs/bsf-feed-sheet-analysis-2569-11-01.md)
     หนอนต่อกระบะ = พื้นที่ (ตร.ซม.) × ความหนาแน่น · อาหารต่อวัน = หนอนต่อกระบะ × k(อายุ) ÷ 50,000 × จำนวนกระบะ
     หนอนที่ได้ = อาหาร × อัตราส่วน · มูล = อาหาร × อัตราส่วน · แสดงเป็นช่วง แบบน้อย (lo) – แบบมาก (hi)
   ===================================================================== */
const BSF_PARAM_DEFAULT = { tray_w_cm: 30, tray_l_cm: 45, eggs_per_tray_g: 2, larvae_per_g_egg: 28000, density_high: 8.5, density_low: 6.5, feed_unit_larvae: 50000,
  larvae_per_feed_high: 8 / 42.3, larvae_per_feed_low: 7 / 32, frass_per_feed_high: 6 / 42, frass_per_feed_low: 5 / 32, larva_g_day5: 0.005, feed_moisture_pct: 70, sample_n: 100 };
const BSF_K_DEFAULT = { 5: 2, 6: 3, 7: 4, 8: 5, 9: 5, 10: 5, 11: 5, 12: 5, 13: 4, 14: 2, 15: 1, 16: 1, 17: 0, 18: 0 };

// แถวจาก bsf.param → ออบเจกต์ค่า (ขาด = ค่าตั้งต้นจากชีต)
function bsfParams(rows) { const P = { ...BSF_PARAM_DEFAULT }; for (const r of rows || []) if (r && r.key in P && r.value != null && isFinite(+r.value)) P[r.key] = +r.value; return P; }
// แถวจาก bsf.plan_day → { age: { k, activity } }
function bsfPlanDays(rows) { const D = {}; if (rows && rows.length) for (const r of rows) D[r.age] = { k: r.k == null ? null : +r.k, activity: r.activity || '' }; else for (const [a, k] of Object.entries(BSF_K_DEFAULT)) D[a] = { k, activity: '' }; return D; }
const bsfKSum = D => Object.values(D).reduce((s, d) => s + (d.k || 0), 0);

// ต่อกระบะเลี้ยง 1 ใบ (เริ่มอายุ 5 วัน)
function bsfPerTray(P, D) {
  const area = P.tray_w_cm * P.tray_l_cm, ks = bsfKSum(D);
  const one = (den, rl, rf) => { const larvae = area * den, feed = larvae * ks / P.feed_unit_larvae; return { larvae, feed, larvae_kg: feed * rl, frass_kg: feed * rf, per_k: larvae / P.feed_unit_larvae }; };
  return { area, k_sum: ks, hi: one(P.density_high, P.larvae_per_feed_high, P.frass_per_feed_high), lo: one(P.density_low, P.larvae_per_feed_low, P.frass_per_feed_low) };
}
// อาหารตามแผนของวันอายุนั้น (กก.) สำหรับ n กระบะ · null = ไม่มีค่าตามแผน
function bsfFeedDay(P, D, age, trays) { const d = D[age]; if (!d || d.k == null) return null; const t = bsfPerTray(P, D); return { hi: t.hi.per_k * d.k * trays, lo: t.lo.per_k * d.k * trays }; }

// จากไข่ (ค่าสูงสุดทางทฤษฎี: ฟักและรอดทั้งหมด) · survival 0–1 ใช้ปรับได้
function bsfFromEggs(P, D, egg_g, survival = 1) {
  const t = bsfPerTray(P, D), count = egg_g * P.larvae_per_g_egg * survival;
  const side = s => { const trays = count / t[s].larvae; return { trays, feed: trays * t[s].feed, larvae_kg: trays * t[s].larvae_kg, frass_kg: trays * t[s].frass_kg }; };
  return { count, hi: side('hi'), lo: side('lo') };
}
// จากเป้าหนอน (กก.) → กระบะเลี้ยง · ไข่ขั้นต่ำ (ถ้ารอดทั้งหมด หรือใช้อัตรารอดที่ให้) · กระบะอนุบาล
function bsfFromTarget(P, D, kg, survival = 1) {
  const t = bsfPerTray(P, D);
  const side = s => { const trays = kg / t[s].larvae_kg, egg_g = trays * t[s].larvae / P.larvae_per_g_egg / survival; return { trays, feed: trays * t[s].feed, frass_kg: trays * t[s].frass_kg, egg_g, nursery_trays: egg_g / P.eggs_per_tray_g }; };
  return { hi: side('hi'), lo: side('lo') };
}
// อัตรารอดโดยประมาณจากรุ่นจริง: กระบะเลี้ยงหลังแบ่ง × หนอนต่อกระบะ ÷ หนอนจากไข่
function bsfSurvival(P, D, egg_g, trays_reared) { if (!(egg_g > 0) || !(trays_reared > 0)) return null; const t = bsfPerTray(P, D), n = egg_g * P.larvae_per_g_egg; return { hi: trays_reared * t.hi.larvae / n, lo: trays_reared * t.lo.larvae / n }; }

const bsfAddDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// กระบะของรุ่น ณ วันที่ (หลังรายการของวันนั้น): ตั้งต้น + แบ่ง − ออกก่อนเก็บเกี่ยว
function bsfTraysOn(trays_start, events, date) {
  return trays_start + (events || []).filter(e => e.status === 'active' && e.event_date <= date).reduce((s, e) => s + (e.kind === 'split' ? +e.trays_delta : e.kind === 'out' && !e.after_harvest ? -(+e.trays || 0) : 0), 0);
}
// ตารางการเลี้ยงรายวันของรุ่น: วันที่ · อายุ · กิจกรรม · อาหารตามแผน (ช่วง) · อาหารจริง · เหตุการณ์
function bsfSchedule(P, D, b, events, feeds, opt = {}) {
  const nursery = opt.nursery || 5, hmin = opt.hmin || 15, hmax = opt.hmax || 20;
  const evs = (events || []).filter(e => e.status === 'active'), fds = (feeds || []).filter(f => f.status === 'active');
  const harvest = evs.find(e => e.kind === 'harvest'), brood = evs.some(e => e.kind === 'out' && e.out_type === 'broodstock');
  const planMax = Math.max(...Object.keys(D).map(Number).filter(a => !brood ? D[a].k != null || a <= hmax : true), 0);
  const lastAge = harvest ? Math.round((new Date(harvest.event_date) - new Date(b.lay_date)) / 864e5) : Math.max(hmax, brood ? planMax : 0, opt.todayAge || 0);
  const rows = [];
  for (let age = 0; age <= lastAge; age++) {
    const date = bsfAddDays(b.lay_date, age), trays = bsfTraysOn(b.trays_start ?? b.trays, evs, date);
    const acts = []; if (D[age] && D[age].activity) acts.push(D[age].activity);
    if (age === nursery && !(D[age] && D[age].activity)) acts.push('ครบอนุบาล');
    if (!harvest && age >= hmin && age <= hmax) acts.push(age === hmin ? 'เริ่มเก็บเกี่ยวได้' : age === hmax ? 'ควรเก็บเกี่ยวภายในวันนี้' : 'ช่วงเก็บเกี่ยว');
    const plan = age >= nursery ? bsfFeedDay(P, D, age, Math.max(trays, 0)) : null;
    const actual = fds.filter(f => f.feed_date === date).reduce((s, f) => s + +f.kg, 0);
    rows.push({ age, date, trays, activity: acts.join(' · '), plan, actual: fds.some(f => f.feed_date === date) ? actual : null, events: evs.filter(e => e.event_date === date) });
  }
  return rows;
}
// วันให้อาหารหลัก (DEC-121): 1 = จันทร์ … 7 = อาทิตย์ · ค่าตั้งต้น จ พ ศ · ไม่บังคับวัน ใช้คิดปริมาณตามแผน
const bsfIsoDow = iso => { const d = new Date(iso + 'T00:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };
function bsfParseWeekdays(s) { const w = String(s == null || s === '' ? '1,3,5' : s).split(/[^0-9]+/).map(Number).filter(n => n >= 1 && n <= 7); return w.length ? [...new Set(w)].sort((a, b) => a - b) : [1, 3, 5]; }
// ปริมาณตามแผนของการให้ 1 ครั้ง (ต่อกระบะ): อาหารรายวันรวมตั้งแต่วันที่ให้ จนถึงก่อนวันให้หลักถัดไป
function bsfFeedPlan(P, D, lay, date, weekdays, nursery = 5) {
  const W = weekdays && weekdays.length ? weekdays : [1, 3, 5];
  let n = 1; while (n < 7 && !W.includes(bsfIsoDow(bsfAddDays(date, n)))) n++;
  let back = 0; while (back < 6 && !W.includes(bsfIsoDow(bsfAddDays(date, -back)))) back++;
  const age0 = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(lay + 'T00:00:00Z')) / 864e5); let lo = 0, hi = 0, any = false;
  for (let i = 0; i < n; i++) { const a = age0 + i; if (a < nursery) continue; const f = bsfFeedDay(P, D, a, 1); if (f) { lo += f.lo; hi += f.hi; any = true; } }
  return { age: age0, days: n, until: bsfAddDays(date, n - 1), isMain: W.includes(bsfIsoDow(date)), roundStart: bsfAddDays(date, -back), plan: any ? { lo, hi } : null };
}
if (typeof module !== 'undefined') module.exports = { BSF_PARAM_DEFAULT, BSF_K_DEFAULT, bsfParams, bsfPlanDays, bsfKSum, bsfPerTray, bsfFeedDay, bsfFromEggs, bsfFromTarget, bsfSurvival, bsfAddDays, bsfTraysOn, bsfSchedule, bsfIsoDow, bsfParseWeekdays, bsfFeedPlan };
