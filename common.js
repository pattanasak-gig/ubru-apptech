/* =====================================================================
   UBRU AppTech System — common.js  ส่วนที่ทุกโมดูลใช้ร่วมกัน (DEC-106 ข้อ 3)
   โหลดโดย index.html (หน้าหลัก) และ <โมดูล>/index.html · ไม่มีขั้นตอน build
   ประกอบด้วย: CONFIG · ตัวช่วย UI · ข้อความผิดพลาดภาษาไทย (DEC-097) · ชั้นข้อมูล (Supabase จริง / สาธิต)
               คิวพักข้อมูลใน IndexedDB (รองรับรูป) · ตาราง/ฟอร์มจัดการข้อมูลทั่วไป · รูป · เครดิต
   ===================================================================== */

// =====================================================================
// CONFIG — ค่าที่เจ้าของโครงการแก้ได้ที่นี่ที่เดียว (ห้ามใส่ secret key ในไฟล์นี้)
// =====================================================================
const CREDIT = {
  short: 'UBRU AppTech System © 2569 ผศ.พัฒนศักดิ์ ปทุมวัน มหาวิทยาลัยราชภัฏอุบลราชธานี · ศูนย์การเรียนรู้และถ่ายทอดเทคโนโลยี BSF · พัฒนาร่วมกับ Claude (Anthropic)',
  url: 'https://pattanasak-gig.github.io/ubru-apptech/',
  updated: '26 ตุลาคม 2569'
};
// คีย์ Esri (ArcGIS Location Platform · บัญชี pattanasak_ubru · คีย์ ubwast-web · referrer pattanasak-gig.github.io) ใช้ร่วมกับ UBWast — โควตา 2,000,000 tiles/เดือนรวมกัน (DEC-106)
const ESRI_API_KEY = 'AAPTaz2yquT3mlhd2KhO06JTObQ..5rwTSeqqDn5CZE5c_TFew0ZOqIYDnUL0n6f_CwMe1mydOLm94XyZpTdGpwqP4ICukNktygiAAgqKr1meMxiXzq_UbJrSCupTJjxJSxnoZ1IEntrrj-KQpbnjUdPd_ZgKX1lxGr4IqNmJABAftrlqtnWoDsM5j8rQ0AntYTCjDYi4Vu6oIF3OShnQicYxwSoDAuNLYMqrFgkpdSsEAK01XEFYzslf3YMrgc1vvJ8Ca2miOUbz9FOqtzg-UIQMgUYLAT1_KkeQUgaP';
const CONFIG = {
  SYSTEM_NAME: 'UBRU AppTech System',
  SUPABASE_URL: 'https://leufewpqqvdixktnmusc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_FgATIHmG2SAgNqd17aMtCg_x3TXp9eV',   // กุญแจสาธารณะ (ตั้งใจฝังในหน้าเว็บ) สิทธิ์จริงบังคับที่ RLS
  LOGIN_EMAIL_DOMAIN: 'apptech.local',    // ต้องตรงกับ LOGIN_EMAIL_DOMAIN ในระบบหลังบ้าน Apps Script
  ENGINE_URL: 'https://script.google.com/macros/s/AKfycbxbEeBA1gb2nuB6ixMUVcqheoSLkzZrf8EI4uxan_DFVhJjWrlCYmgcMCSOtRpGwXEHlg/exec',   // Web app URL ของ apps-script/engine (deploy เวอร์ชัน 1 · 25 ต.ค. 2569 22:26)
  ESRI_KEY_EXPIRES: '2027-10-22',
  DEMO: false,                            // true = โหมดสาธิต ใช้ข้อมูลตัวอย่างในเครื่อง ไม่ต่อ Supabase (หรือเปิดด้วย ?demo=1)
  MAP_FALLBACK: { lat: 15.0, lng: 100.0, zoom: 6 },   // มุมมองเมื่อยังไม่มีพิกัดใด (ค่ากลางประเทศ ไม่ผูกเมือง)
  TILES: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19 },
  TILES_FALLBACK: { url: 'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/streets/static/tile/{z}/{y}/{x}?token=' + ESRI_API_KEY, attribution: 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> · © Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors', maxZoom: 19, tileSize: 512, zoomOffset: -1 },
  TILES_SATELLITE: { url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + ESRI_API_KEY, attribution: 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> · Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community', maxZoom: 19 },
  ROUTING_URL: 'https://router.project-osrm.org',   // OSRM สาธิต: ไม่เชิงพาณิชย์ ≤1 คำขอ/วินาที ไม่รับประกัน · เรียกเฉพาะตอน admin กด แล้วเก็บผล
  PHOTO_MAX_PX: 1280, PHOTO_QUALITY: 0.8,
  QUEUE_WARN_DAYS: 3                      // เตือนเมื่อมีรายการค้างส่งนานเกินนี้ (กัน Safari ลบข้อมูลเว็บที่ไม่แตะ 7 วัน)
};

// =====================================================================
// สถานะรวม + ตัวช่วยพื้นฐาน
// =====================================================================
const S = { me: null, cache: {}, orgs: [], projects: [], settings: [], scopeOrg: null, charts: [], _crud: {} };
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (n == null || n === '' || isNaN(Number(n)) ? '-' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d }));
const fmtInt = n => fmt(n, 0);
const thDate = iso => iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const thDay = d => d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const thMonth = d => d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }) : '-';
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const IS_DEMO = CONFIG.DEMO || /[?&]demo=1/.test(location.search);
const sum = (rows, k) => rows.reduce((s, r) => s + (+r[k] || 0), 0);
function go(hash) { location.hash = hash; }
function isNetworkError(e) { return !navigator.onLine || /fetch|network|Failed|load failed|timeout/i.test(String(e && (e.message || e))); }

function toast(msg, isErr) {
  const t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg;
  $('#toastHost').appendChild(t); setTimeout(() => t.remove(), isErr ? 5000 : 2500);
}
// ---- ข้อความผิดพลาดภาษาไทย + วิธีแก้ (แนว DEC-097) ----
const ERR_RULES = [   // [ตรวจจับ, หัวข้อ, ทำอย่างไร, ชนิด]
  [/Failed to fetch|Load failed|NetworkError|network error|ERR_INTERNET|ERR_NETWORK|ERR_CONNECTION|timed? ?out|AbortError/i, 'เชื่อมต่อไม่ได้', 'ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่ · ถ้ากำลังบันทึกรอบเข้ารับ ระบบเก็บไว้ในเครื่องให้แล้ว ดูที่ปุ่ม "รอส่ง" จะส่งเองเมื่อมีสัญญาณ'],
  [/Invalid login credentials|invalid_credentials|invalid_grant/i, 'ชื่อล็อกอินหรือรหัสผ่านไม่ถูกต้อง', 'พิมพ์ชื่อล็อกอินเป็นตัวพิมพ์เล็กทั้งหมด · รหัสผ่านไม่มีช่องว่าง ตรวจปุ่ม Caps Lock · ลืมรหัสผ่าน → ให้ admin กด "รีเซ็ต" ที่บัญชีผู้ใช้'],
  [/JWT|token is expired|expired|invalid claim|session.*missing|Auth session|refresh_token|not authenticated|ไม่ได้ล็อกอิน|ตัวตนไม่ถูกต้อง|\b401\b/i, 'หมดเวลาการใช้งาน ต้องเข้าสู่ระบบใหม่', 'กดเมนู "บัญชี" → ออกจากระบบ แล้วเข้าสู่ระบบอีกครั้ง · รายการที่ยังไม่ได้ส่งยังอยู่ในปุ่ม "รอส่ง" ไม่หาย', 'session'],
  [/rate limit|too many|\b429\b/i, 'ลองบ่อยเกินไป', 'รอประมาณ 1 นาทีแล้วลองใหม่'],
  [/row-level security|\b42501\b|permission denied|not allowed|\b403\b|ไม่มีสิทธิ์/i, 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้', 'เช่น แก้ข้อมูลขององค์กรอื่น หรือรายการที่ผู้บันทึกทำไม่ได้ (ยกเลิกรอบ/รายการ/รูป) · ถ้าควรทำได้ ให้ admin ตรวจบทบาทของบัญชีท่านที่ จัดการ → บัญชีผู้ใช้'],
  [/already been registered|users?_email|username.*(exists|duplicate)|ชื่อล็อกอิน.*(ซ้ำ|มีอยู่)/i, 'ชื่อล็อกอินนี้มีผู้ใช้แล้ว', 'ตั้งชื่อล็อกอินอื่น เช่น เติมเลขต่อท้าย · ถ้าเป็นบัญชีเดิมที่ปิดไป ให้เปิดใช้งานบัญชีเดิมแทน'],
  [/duplicate key|\b23505\b|already exists|unique/i, 'ข้อมูลซ้ำ มีรายการนี้อยู่แล้ว', 'ค้นหารายการเดิมแล้วแก้ไขแทนการเพิ่มใหม่ · ถ้ารายการเดิมถูกปิดใช้งานอยู่ ให้กด "แก้" แล้วเปลี่ยนสถานะเป็นใช้งาน'],
  [/null value in column|\b23502\b|not-null|ต้องไม่ว่าง/i, 'กรอกข้อมูลไม่ครบ', 'ช่องที่มีเครื่องหมาย * ต้องกรอกทุกช่อง แล้วกดบันทึกอีกครั้ง'],
  [/still referenced|violates foreign key.*(delete|update)|\b23503\b.*referenced/i, 'ลบไม่ได้ เพราะมีข้อมูลอื่นใช้รายการนี้อยู่', 'เช่น ฟาร์ม/แหล่งกำเนิดเศษอาหารที่มีรอบเข้ารับแล้ว · ให้ "ปิดใช้งาน" รายการนั้นแทนการลบ ข้อมูลเดิมจะยังอยู่ครบ'],
  [/foreign key|\b23503\b|ไม่พบ(ฟาร์ม|แหล่ง|รอบ|โครงการ|องค์กร|รถ)ที่เลือก/i, 'รายการที่เลือกไม่มีอยู่แล้ว', 'ฟาร์ม/แหล่ง/โครงการที่เลือกอาจถูกปิดไปเมื่อสักครู่ · กดรีเฟรชหน้า (ลากหน้าจอลง หรือกด F5) แล้วเลือกใหม่'],
  [/check constraint|\b23514\b|quality|weight_kg|อนาคต/i, 'ค่าที่กรอกไม่อยู่ในเกณฑ์', 'น้ำหนักต้องไม่ติดลบ · คะแนนคัดแยกต้องเป็น 1–5 · วันที่เข้ารับต้องไม่เป็นวันในอนาคต · พิกัดต้องอยู่ในช่วง -90…90 และ -180…180'],
  [/value too long|\b22001\b|ยาวเกิน/i, 'ข้อความยาวเกินกำหนด', 'ย่อข้อความให้สั้นลง (ชื่อไม่เกิน 200 ตัวอักษร)'],
  [/invalid input syntax|\b22P02\b|numeric field overflow|\b22003\b|out of range/i, 'รูปแบบข้อมูลไม่ถูกต้อง', 'ช่องตัวเลขต้องเป็นตัวเลขล้วน (ไม่มีตัวอักษร เครื่องหมาย , หรือหน่วย)'],
  [/PGRST116|multiple \(or no\) rows|Cannot coerce|0 rows/i, 'ไม่พบรายการที่จะบันทึก', 'รายการนี้อาจถูกลบไปแล้ว หรือบัญชีของท่านไม่มีสิทธิ์แก้ไข · รีเฟรชหน้าแล้วลองใหม่'],
  [/PGRST106|Invalid schema/i, 'ฐานข้อมูลยังไม่เปิดสคีมาให้หน้าเว็บ', 'เจ้าของโครงการต้องเพิ่ม core และ food ใน Supabase → Integrations → Data API → Settings → Exposed schemas'],
  [/schema cache|PGRST20[0-9]|Could not find the (table|column|function)/i, 'ฐานข้อมูลยังไม่ได้อัปเดตให้ตรงกับหน้าเว็บรุ่นนี้', 'เจ้าของโครงการต้องรันไฟล์ SQL ฉบับล่าสุดใน Supabase → SQL Editor (ดูลำดับไฟล์ใน README) แล้วกด F5 · ส่วนอื่นของระบบใช้ได้ตามปกติ'],
  [/Unexpected token|not valid JSON|<!DOCTYPE|JSON\.parse|BAD_JSON|ระบบหลังบ้านตอบผิดพลาด/i, 'ระบบหลังบ้าน/ตัวรับรูปตอบกลับไม่ถูกต้อง', 'ลิงก์ระบบหลังบ้านอาจผิด หมดอายุ หรือ deploy โดยไม่ได้เลือก "ทุกคน (Anyone)" · แจ้งเจ้าของโครงการ'],
  [/ENGINE_URL|ยังไม่ได้ตั้งค่าระบบหลังบ้าน/i, 'ยังไม่ได้เชื่อมระบบหลังบ้าน', 'การเพิ่มบัญชี รีเซ็ตรหัส และส่งรูป ต้องรอเจ้าของโครงการติดตั้งระบบหลังบ้าน (ขั้นที่ 4) · ข้อมูลอื่นบันทึกได้ตามปกติ'],
  [/quota|storage.*(full|exceeded)|exceeded|insufficient.*space|Drive/i, 'ที่เก็บรูป (Google Drive) รับไฟล์ไม่ได้', 'พื้นที่ Drive อาจเต็ม หรือสิทธิ์ของสคริปต์หมดอายุ · แจ้งเจ้าของโครงการ'],
  [/Password should|weak_password|password.*(short|length)|รหัสผ่านต้อง/i, 'รหัสผ่านไม่ผ่านเกณฑ์', 'ใช้ 6–30 ตัว เฉพาะตัวอักษรอังกฤษและตัวเลข ไม่มีช่องว่าง'],
  [/Email not confirmed|not confirmed/i, 'บัญชียังไม่ได้เปิดใช้', 'แจ้งเจ้าของโครงการให้เปิดบัญชีนี้'],
  [/User not found|ไม่พบบัญชี/i, 'ไม่พบบัญชีนี้', 'ตรวจชื่อล็อกอินอีกครั้ง หรือให้ admin ดูที่ บัญชีผู้ใช้'],
  [/\b50[234]\b|Service Unavailable|Bad Gateway|upstream|ECONNRESET|server error|\b500\b/i, 'ระบบปลายทางไม่ตอบชั่วคราว', 'รอ 1–2 นาทีแล้วลองใหม่ · ถ้าเกิน 10 นาทียังไม่ได้ แจ้งเจ้าของโครงการ'],
  [/QuotaExceededError|IndexedDB|localStorage|exceeded the quota/i, 'พื้นที่เก็บข้อมูลในเครื่องเต็ม', 'ไปปุ่ม "รอส่ง" แล้วกดส่งเมื่อมีสัญญาณ หรือลดจำนวนรูปต่อรอบ'],
  [/geolocation|GPS|position/i, 'อ่านตำแหน่ง GPS ไม่ได้', 'เปิดสิทธิ์ "ตำแหน่ง" ให้เบราว์เซอร์ (ตั้งค่า → ไซต์ → ตำแหน่ง) · ออกไปที่โล่งแล้วลองใหม่ · หรือพิมพ์พิกัดเองจากแอปแผนที่'],
  [/image|รูป|photo|canvas|decode/i, 'จัดการรูปไม่สำเร็จ', 'ไฟล์อาจไม่ใช่รูป หรือใหญ่/เสียหาย · ถ่ายใหม่จากกล้อง หรือเลือกไฟล์ .jpg/.png อื่น'],
  [/OpenStreetMap|Overpass|บริการแผนที่|บริการเส้นทาง|OSRM/i, 'บริการแผนที่ภายนอกไม่ตอบ', 'บริการฟรีของ OpenStreetMap มีช่วงหนาแน่น · รอ 1–2 นาทีแล้วกดใหม่ (ข้อมูลที่บันทึกแล้วไม่หาย)'],
];
const HAS_THAI = /[฀-๿]/;
function friendlyError(e, ctx) {
  const msg = String(e && (e.message || e.error || e) || ''); const code = String((e && (e.code || e.status)) || '');
  const probe = msg + ' ' + code + ' ' + String((e && e.details) || '');
  const out = { title: '', hint: '', raw: msg, kind: '' };
  if (!navigator.onLine) { out.title = 'ไม่มีสัญญาณอินเทอร์เน็ต'; out.hint = ERR_RULES[0][2]; out.kind = 'offline'; }
  else { for (const r of ERR_RULES) if (r[0].test(probe)) { out.title = r[1]; out.hint = r[2]; out.kind = r[3] || ''; break; } }
  if (!out.title) {
    if (HAS_THAI.test(msg)) { out.title = msg; out.hint = ''; out.raw = ''; }
    else { out.title = 'เกิดข้อผิดพลาดที่ระบบไม่รู้จัก'; out.hint = 'ลองใหม่อีกครั้ง · ถ้ายังไม่ได้ ถ่ายภาพหน้าจอข้อความนี้ (ไม่ให้เห็นรหัสผ่าน) ส่งให้ admin หรือเจ้าของโครงการ'; }
  }
  if (HAS_THAI.test(msg) && out.title !== msg) out.raw = msg;
  if (ctx) out.title = ctx + ': ' + out.title;
  return out;
}
let _errToast = null;
function toastErr(title, hint, raw) {
  if (_errToast) _errToast.remove();
  const t = document.createElement('div'); t.className = 'toast err'; t.setAttribute('role', 'alert');
  t.innerHTML = `<div class="t">${esc(title)}</div>${hint ? `<div class="h">${esc(hint)}</div>` : ''}${raw ? `<div class="r">${esc(raw)}</div>` : ''}<button class="x" type="button" aria-label="ปิดข้อความ" onclick="this.parentNode.remove()">×</button>`;
  $('#toastHost').appendChild(t); _errToast = t; setTimeout(() => { if (t.isConnected) t.remove(); }, hint ? 12000 : 7000);
}
function fail(e, ctx) {
  const f = friendlyError(e, ctx); console.warn('[AppTech]', ctx || '', e);
  toastErr(f.title, f.hint, f.raw && f.raw !== f.title ? f.raw : '');
  if (f.kind === 'session' && S.me && api.name === 'supabase') sessionLost();
}
async function sessionLost() { try { await api.logout(); } catch (_) {} S.me = null; S.cache = {}; S._loginNote = 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่ · รายการที่ยังไม่ได้ส่งเก็บไว้ในปุ่ม "รอส่ง" ไม่หาย'; go('#'); render(); }
function needField(sel, msg) {
  document.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (el) { el.classList.add('invalid'); el.addEventListener('input', () => el.classList.remove('invalid'), { once: true }); el.addEventListener('change', () => el.classList.remove('invalid'), { once: true }); try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); } catch (_) {} }
  toastErr('ยังบันทึกไม่ได้', msg); return false;
}
const gpsErrorText = err => ({ 1: 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง: กดอนุญาตเมื่อเบราว์เซอร์ถาม หรือเปิดที่ ตั้งค่า → ไซต์ → ตำแหน่ง', 2: 'หาตำแหน่งไม่พบ: ออกไปที่โล่ง เปิด GPS ของเครื่อง แล้วลองใหม่', 3: 'รอสัญญาณ GPS นานเกินไป: ลองใหม่อีกครั้งหรือขยับไปที่โล่ง' }[err && err.code] || ('อ่าน GPS ไม่ได้: ' + (err && err.message || '')));
window.addEventListener('unhandledrejection', ev => { ev.preventDefault(); fail(ev.reason || {}); });
window.addEventListener('error', ev => { if (ev.message) { console.error(ev.error || ev.message); toastErr('เกิดข้อผิดพลาดในหน้าเว็บ', 'รีเฟรชหน้า (F5 หรือลากหน้าจอลง) แล้วลองใหม่ · ถ้ายังเกิดซ้ำ ถ่ายภาพหน้าจอส่งเจ้าของโครงการ', ev.message); } });
window.addEventListener('offline', () => toastErr('ไม่มีสัญญาณอินเทอร์เน็ต', 'ยังบันทึกรอบเข้ารับต่อได้ ระบบจะเก็บไว้ในเครื่อง (ปุ่ม "รอส่ง") และส่งเองเมื่อสัญญาณกลับมา'));
window.addEventListener('online', () => { toast('สัญญาณกลับมาแล้ว กำลังส่งรายการที่รออยู่'); Queue.sync().then(() => { if (typeof render === 'function') render(); }); });

// =====================================================================
// ชั้นข้อมูล A: Supabase จริง — ชื่อตาราง/view ระบุเป็น 'สคีมา.ชื่อ' เช่น 'food.v_pickup' (ค่าเริ่มต้น food)
// =====================================================================
const splitName = name => { const i = name.indexOf('.'); return i < 0 ? ['food', name] : [name.slice(0, i), name.slice(i + 1)]; };
const SupaBackend = () => {
  const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);
  const from = name => { const [sc, t] = splitName(name); return sb.schema(sc).from(t); };
  const unwrap = r => { if (r.error) { const er = new Error(r.error.message || JSON.stringify(r.error)); er.code = r.error.code; er.status = r.error.status || r.status; er.details = r.error.details; er.hint = r.error.hint; throw er; } return r.data; };
  const readJson = async (r, what) => { let txt = ''; try { txt = await r.text(); return JSON.parse(txt); } catch (_) { const er = new Error(what + ' ตอบกลับไม่ใช่ JSON (HTTP ' + r.status + ')'); er.code = 'BAD_JSON'; er.details = txt.slice(0, 120); throw er; } };
  const applyOpts = (qb, o = {}) => {
    for (const [k, v] of Object.entries(o.eq || {})) qb = v === null ? qb.is(k, null) : qb.eq(k, v);
    for (const [k, v] of Object.entries(o.neq || {})) qb = qb.neq(k, v);
    for (const [k, v] of Object.entries(o.in || {})) qb = qb.in(k, v);
    for (const [k, v] of Object.entries(o.gte || {})) qb = qb.gte(k, v);
    for (const [k, v] of Object.entries(o.lte || {})) qb = qb.lte(k, v);
    if (o.order) qb = qb.order(o.order[0], { ascending: o.order[1] !== false });
    if (o.order2) qb = qb.order(o.order2[0], { ascending: o.order2[1] !== false });
    qb = qb.limit(o.limit || 5000);
    return qb;
  };
  return {
    name: 'supabase',
    async session() { return unwrap(await sb.auth.getSession()).session; },
    async login(username, password) {
      const email = username.includes('@') ? username : `${username.trim().toLowerCase()}@${CONFIG.LOGIN_EMAIL_DOMAIN}`;
      unwrap(await sb.auth.signInWithPassword({ email, password }));
      return this.me();
    },
    async logout() { await sb.auth.signOut(); },
    async me() {
      const sess = await this.session(); if (!sess) return null;
      const rows = unwrap(await from('core.app_user').select('*').eq('id', sess.user.id));
      return rows[0] || null;
    },
    async changePassword(pw) { unwrap(await sb.auth.updateUser({ password: pw })); },
    async list(name, o) { return unwrap(await applyOpts(from(name).select(o?.select || '*'), o)); },
    async insert(name, row) { return unwrap(await from(name).insert(row).select().single()); },
    async insertMany(name, rows) { if (!rows.length) return []; return unwrap(await from(name).insert(rows).select()); },
    async update(name, id, patch, pk = 'id') { return unwrap(await from(name).update(patch).eq(pk, id).select().single()); },
    async remove(name, id) { unwrap(await from(name).delete().eq('id', id)); },
    async engine(action, payload) {
      if (!CONFIG.ENGINE_URL) throw new Error('ยังไม่ได้ตั้งค่า ENGINE_URL (ระบบหลังบ้าน Apps Script ขั้นที่ 4)');
      const sess = await this.session(); if (!sess) throw new Error('ไม่ได้ล็อกอิน');
      const r = await fetch(CONFIG.ENGINE_URL, { method: 'POST', body: JSON.stringify({ action, token: sess.access_token, ...payload }) });
      const j = await readJson(r, 'ระบบหลังบ้าน'); if (!j.ok) throw new Error(j.error || 'ระบบหลังบ้านตอบผิดพลาด'); return j;
    },
    async uploadPhoto(endpointUrl, payload) {
      const url = endpointUrl || CONFIG.ENGINE_URL;
      if (!url) throw new Error('ยังไม่ได้ตั้งค่าที่เก็บรูป (ENGINE_URL)');
      const sess = await this.session(); if (!sess) throw new Error('ไม่ได้ล็อกอิน');
      const r = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'upload_photo', token: sess.access_token, ...payload }) });
      const j = await readJson(r, 'ตัวรับรูป'); if (!j.ok) throw new Error(j.error || 'ส่งรูปไม่สำเร็จ'); return j;
    }
  };
};

// =====================================================================
// ชั้นข้อมูล B: โหมดสาธิต (ข้อมูลตัวอย่างในหน่วยความจำ เลียนแบบ RLS และ view ของ core/food)
// =====================================================================
const DemoBackend = () => {
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const now = () => new Date().toISOString();
  const D = { 'core.org': [], 'core.project': [], 'core.app_user': [], 'core.app_setting': [], 'food.source_type': [], 'food.farm': [], 'food.source': [], 'food.vehicle': [], 'food.pickup': [], 'food.pickup_item': [], 'food.pickup_photo': [], 'food.route': [], 'food.route_stop': [], 'food.carbon_factor': [] };
  const add = (t, row) => { const r = { id: uid(), status: 'active', created_at: now(), updated_at: now(), ...row }; D[t].push(r); return r; };
  const o1 = add('core.org', { code: 'DEMO', name: 'ศูนย์สาธิต (ตัวอย่าง)', max_recorders: 10 });
  const o2 = add('core.org', { code: 'DEMO2', name: 'หน่วยงานสาธิต สอง', max_recorders: 10 });
  const users = [
    add('core.app_user', { username: 'owner', display_name: 'เจ้าของโครงการ (สาธิต)', role: 'super_admin', org_id: null }),
    add('core.app_user', { username: 'demo-admin', display_name: 'admin สาธิต', role: 'admin', org_id: o1.id }),
    add('core.app_user', { username: 'demo-rec1', display_name: 'ผู้บันทึก สาธิต 1', role: 'recorder', org_id: o1.id }),
    add('core.app_user', { username: 'demo2-admin', display_name: 'admin สาธิต สอง', role: 'admin', org_id: o2.id })
  ];
  const p68 = add('core.project', { org_id: o1.id, code: 'P68', name: 'โครงการตัวอย่าง ปี 68', year_be: 2568, is_public: true });
  const pBsf = add('core.project', { org_id: o1.id, code: 'BSF', name: 'ศูนย์เรียนรู้ตัวอย่าง', year_be: 2569, is_public: true });
  add('core.project', { org_id: o2.id, code: 'X', name: 'โครงการของหน่วยงานสอง', year_be: 2569, is_public: false });
  ['ตลาด', 'ร้านอาหาร', 'หน่วยงาน/สถานศึกษา', 'ครัวเรือน', 'อื่น ๆ'].forEach((n, i) => add('food.source_type', { name: n, sort_order: i + 1 }));
  const stOf = n => D['food.source_type'].find(s => s.name === n).id;
  D['core.app_setting'].push({ key: 'system_name', value: 'UBRU AppTech System (สาธิต)', description: 'ชื่อระบบ' }, { key: 'max_photos_per_pickup', value: '3', description: 'รูปสูงสุดต่อรอบ' }, { key: 'default_photo_endpoint_url', value: '', description: '' }, { key: 'default_photo_folder_id', value: '', description: '' }, { key: 'quality_labels', value: '1=ต้องปรับปรุง,5=ดีเยี่ยม', description: '' });
  const f1 = add('food.farm', { org_id: o1.id, project_id: p68.id, name: 'ฟาร์มตัวอย่าง ก', lat: 15.23, lng: 104.86 });
  const f2 = add('food.farm', { org_id: o1.id, project_id: p68.id, name: 'ฟาร์มตัวอย่าง ข', lat: 15.25, lng: 104.83 });
  const f3 = add('food.farm', { org_id: o1.id, project_id: pBsf.id, name: 'ศูนย์เรียนรู้ตัวอย่าง', lat: 15.24, lng: 104.9 });
  const s1 = add('food.source', { org_id: o1.id, source_type_id: stOf('ตลาด'), name: 'ตลาดตัวอย่าง ถัง 1', lat: 15.228, lng: 104.857 });
  const s2 = add('food.source', { org_id: o1.id, source_type_id: stOf('ตลาด'), name: 'ตลาดตัวอย่าง ถัง 2', lat: 15.228, lng: 104.857 });
  const s3 = add('food.source', { org_id: o1.id, source_type_id: stOf('ร้านอาหาร'), name: 'ร้านอาหารตัวอย่าง ก', lat: 15.235, lng: 104.85 });
  const s4 = add('food.source', { org_id: o1.id, source_type_id: stOf('ร้านอาหาร'), name: 'ร้านอาหารตัวอย่าง ข', lat: 15.24, lng: 104.87, project_id: p68.id });   // ผูกโครงการ P68
  add('food.source', { org_id: o1.id, source_type_id: stOf('หน่วยงาน/สถานศึกษา'), name: 'โรงเรียนตัวอย่าง (ยังไม่เคยรับ)', project_id: pBsf.id });   // ผูกโครงการ BSF
  add('food.source', { org_id: o2.id, name: 'แหล่งกำเนิดเศษอาหารของหน่วยงานสอง' });
  const v1 = add('food.vehicle', { org_id: o1.id, name: 'กระบะตัวอย่าง', plate_no: 'ตัวอย่าง-1', fuel_type: 'ดีเซล' });
  // รอบเข้ารับตัวอย่าง 12 สัปดาห์ย้อนหลัง (ตัวเลขสุ่มแบบคงที่ เพื่อให้แดชบอร์ดมีข้อมูล)
  const rnd = (seed => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; })(7);
  for (let w = 12; w >= 0; w--) {
    const d = new Date(); d.setDate(d.getDate() - w * 7);
    const dateISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const pk = add('food.pickup', { org_id: o1.id, farm_id: w % 2 ? f1.id : f2.id, pickup_date: dateISO, pickup_time: '16:00', vehicle_id: w % 3 ? v1.id : null, entry_source: w > 8 ? 'sheet' : 'app', created_by: users[2].id });
    [[s1, 20 + rnd() * 20], [s2, rnd() > .5 ? 10 + rnd() * 15 : null], [s3, 8 + rnd() * 25], [s4, rnd() > .6 ? 5 + rnd() * 12 : null]].forEach(([s, kg]) => { if (kg != null) add('food.pickup_item', { org_id: o1.id, pickup_id: pk.id, source_id: s.id, weight_kg: Math.round(kg * 100) / 100, quality: 3 + Math.floor(rnd() * 3) }); });
    if (w === 1) add('food.pickup_photo', { org_id: o1.id, pickup_id: pk.id, url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dbeafe"/><text x="200" y="160" font-size="28" text-anchor="middle" fill="#1e3a5f">รูปตัวอย่าง</text></svg>') });
  }
  const pkBsf = add('food.pickup', { org_id: o1.id, farm_id: f3.id, pickup_date: todayISO(), pickup_time: '09:30', entry_source: 'app', created_by: users[1].id });
  add('food.pickup_item', { org_id: o1.id, pickup_id: pkBsf.id, source_id: s3.id, weight_kg: 12.5, quality: 5 });
  const pkOv = add('food.pickup', { org_id: o1.id, farm_id: f1.id, project_id: pBsf.id, pickup_date: todayISO(), pickup_time: '11:00', entry_source: 'app', created_by: users[2].id });   // รอบที่เลือกโครงการเอง (ฟาร์ม ก แต่นับเข้า BSF)
  add('food.pickup_item', { org_id: o1.id, pickup_id: pkOv.id, source_id: s1.id, weight_kg: 8, quality: 4 });

  const rt1 = add('food.route', { org_id: o1.id, name: 'สายตัวอย่าง ตลาด–ฟาร์ม ก', farm_id: f1.id, vehicle_id: v1.id, start_name: 'ศูนย์สาธิต', start_lat: 15.235, lng: null, start_lng: 104.84, via: [], schedule_note: 'ทุกอังคาร' });
  add('food.route_stop', { org_id: o1.id, route_id: rt1.id, seq: 1, source_id: s1.id }); add('food.route_stop', { org_id: o1.id, route_id: rt1.id, seq: 2, source_id: s3.id });
  // DEC-113 ข้อมูลสาธิตคาร์บอน: ค่าสัมประสิทธิ์ชุดเดียวกับ sql/009_carbon.sql · เส้นทางหลักของฟาร์ม ก · รถกระบะ 11 กม./ลิตร
  [{"code": "FUEL_DIESEL", "category": "fuel", "fuel_code": "diesel", "name": "ดีเซล (รถยนต์บนถนน)", "value": 2.7403, "unit": "kgCO2e/ลิตร", "method": "การเผาไหม้เชื้อเพลิงในรถยนต์ (CO2 + CH4 + N2O, GWP AR5)", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · Mobile combustion: On-road vehicles · Diesel · อ้าง IPCC 2006 Vol.2 Ch.3 Table 3.2.1–3.2.2", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 11, "note": null}, {"code": "FUEL_DIESEL_B7", "category": "fuel", "fuel_code": "diesel_b7", "name": "ดีเซล B7 (รถยนต์บนถนน)", "value": 2.5504, "unit": "kgCO2e/ลิตร", "method": "การเผาไหม้ส่วนเชื้อเพลิงฟอสซิล (Scope 1) · CO2 จากไบโอดีเซล 0.1151 kgCO2/ลิตร รายงานแยก ไม่รวมในค่านี้", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Diesel B7: Report in Scope 1 (แชทบทความตรวจถึงหน้าแล้วเช่นกัน)", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 12, "note": null}, {"code": "FUEL_DIESEL_B20", "category": "fuel", "fuel_code": "diesel_b20", "name": "ดีเซล B20 (รถยนต์บนถนน)", "value": 2.1976, "unit": "kgCO2e/ลิตร", "method": "Scope 1 · CO2 จากไบโอดีเซล 0.3288 รายงานแยก", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Diesel B20: Report in Scope 1", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 13, "note": null}, {"code": "FUEL_GASOLINE", "category": "fuel", "fuel_code": "gasoline", "name": "เบนซิน (รถมีเครื่องฟอกไอเสีย)", "value": 2.2703, "unit": "kgCO2e/ลิตร", "method": "การเผาไหม้ในรถยนต์", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Motor Gasoline - oxidation catalyst", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 14, "note": null}, {"code": "FUEL_E10", "category": "fuel", "fuel_code": "gasohol_e10", "name": "แก๊สโซฮอล์ E10", "value": 2.0444, "unit": "kgCO2e/ลิตร", "method": "Scope 1 · CO2 จากเอทานอล 0.1497 รายงานแยก", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Gasohol E10 (oxidation catalyst): Report in Scope 1", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 15, "note": null}, {"code": "FUEL_E20", "category": "fuel", "fuel_code": "gasohol_e20", "name": "แก๊สโซฮอล์ E20", "value": 1.8184, "unit": "kgCO2e/ลิตร", "method": "Scope 1 · CO2 จากเอทานอล 0.2994 รายงานแยก", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Gasohol E20 (oxidation catalyst): Report in Scope 1", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 16, "note": null}, {"code": "FUEL_E85", "category": "fuel", "fuel_code": "gasohol_e85", "name": "แก๊สโซฮอล์ E85", "value": 0.3496, "unit": "kgCO2e/ลิตร", "method": "Scope 1 · CO2 จากเอทานอล 1.2723 รายงานแยก", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · Gasohol E85 (oxidation catalyst): Report in Scope 1", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 17, "note": null}, {"code": "FUEL_LPG", "category": "fuel", "fuel_code": "lpg", "name": "LPG (รถยนต์)", "value": 1.7273, "unit": "kgCO2e/ลิตร", "method": "การเผาไหม้ในรถยนต์", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · LPG (liter)", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 18, "note": null}, {"code": "FUEL_CNG", "category": "fuel", "fuel_code": "cng", "name": "CNG/NGV (รถยนต์)", "value": 2.254, "unit": "kgCO2e/กก.", "method": "การเผาไหม้ในรถยนต์ · หน่วยเป็นกิโลกรัม (รถต้องระบุ กม. ต่อ กก.)", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 9 · On-road vehicles · CNG (kg)", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 19, "note": null}, {"code": "FUEL_ELECTRIC", "category": "fuel", "fuel_code": "electric", "name": "ไฟฟ้า (รถไฟฟ้า ชาร์จจากสายส่ง)", "value": 0.4999, "unit": "kgCO2e/kWh", "method": "ไฟฟ้าจากระบบสายส่ง (CFO Scope 2) · รถต้องระบุ กม. ต่อ kWh", "source": "อบก. (TGO) ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประเมินคาร์บอนฟุตพริ้นท์ขององค์กร", "source_detail": "UPDATE 2569 (ก.พ. 2569) หน้า 11 · Electricity, grid mix 2016–2018 · Thai National LCI Database (TIIS-MTEC-NSTDA) · CFO Scope 2", "source_url": "https://thaicarbonlabel.tgo.or.th/admin/uploadfiles/emission/ts_578cd2cb78.pdf", "verified": true, "is_primary": true, "sort_order": 20, "note": null}, {"code": "FUEL_DIESEL_KIT2026", "category": "fuel", "fuel_code": "diesel", "name": "ดีเซล ตามที่ Kitpakornsanti et al. (2026) ใช้", "value": 3.0729, "unit": "kgCO2e/ลิตร", "method": "ค่าที่บทความ JEM ใช้ประมาณการขนส่ง · สูงกว่าค่าเผาไหม้ของ อบก. จึงอาจรวมการผลิตเชื้อเพลิงต้นน้ำ (อนุมาน ยังไม่พิสูจน์)", "source": "Kitpakornsanti, K., Klomking, M., Promakotr, R., Buajanpho, Y., Seefa, T., Sirikhun, J., Junggoth, R., & Limsakul, A. (2026). Development of a food waste management model for restaurants based on circular economy principles: A case study of Sakon Nakhon City Municipality. Journal of Environmental and Sustainable Management, 22(1), 44–67", "source_detail": "ชื่อเอกสารยืนยันโดยแชทบทความ (GHG-COLLECT-01-A1) · ยังไม่ได้เปิดตาราง/หน้าที่มีค่านี้ · ยังไม่ทราบว่ามาจากตาราง อบก. ฉบับใด", "source_url": "https://doi.org/10.14456/jesm.2026.3", "verified": false, "is_primary": false, "sort_order": 21, "note": "ยังไม่ยืนยัน — ใช้เทียบเคียงเท่านั้น"}, {"code": "LF_LESS_WM07", "category": "landfill", "fuel_code": null, "name": "ฝังกลบเศษอาหาร — วิธี LESS-WM-07 ของ อบก. (ค่าหลัก)", "value": 0.571, "unit": "kgCO2e/กก. เศษอาหาร", "method": "ค่าที่ อบก. ใช้ในวิธีคำนวณ \"การนำขยะอินทรีย์ประเภทเศษอาหารไปใช้เป็นอาหารสัตว์\" ซึ่งระบุหนอนแมลงวันลายเป็นสัตว์ที่ใช้ได้ · กรณีฐาน = หลุมฝังกลบไม่มีระบบจัดการ ลึกกว่า 5 เมตร · GWP CH4 = 28", "source": "อบก. (TGO) วิธีการคำนวณ LESS-WM-07 การนำขยะอินทรีย์ประเภทเศษอาหารไปใช้เป็นอาหารสัตว์ Version 5", "source_detail": "ไฟล์ Excel แผ่น \"อ้างอิง\" ลำดับ 2 EF_swd food · ที่มา T-VER-TOOL-02-02 Version 1 การคำนวณการปล่อยก๊าซเรือนกระจกจากหลุมฝังกลบขยะมูลฝอยชุมชน", "source_url": "https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/2100-2021-05-20-06-54-06.html", "verified": true, "is_primary": true, "sort_order": 31.0, "note": "บ่อเทศบาลที่เป็นแบบถูกหลักสุขาภิบาลอาจปล่อยต่างจากค่านี้"}, {"code": "LF_TH_LCI", "category": "landfill", "fuel_code": null, "name": "ฝังกลบขยะมูลฝอยชุมชนแบบถูกหลักสุขาภิบาล — Thai National LCI (ต่อ กก. ขยะรวม)", "value": 0.7933, "unit": "kgCO2e/กก. ขยะมูลฝอยชุมชน", "method": "ค่าวัฏจักรชีวิตของการฝังกลบขยะมูลฝอยชุมชนรวม แบบถูกหลักสุขาภิบาล (LCIA IPCC 2013 GWP100a) ไม่ใช่ค่าเฉพาะเศษอาหาร", "source": "อบก. (TGO) ค่า Emission Factor แบ่งตามประเภทกลุ่มอุตสาหกรรม (CFP) UPDATE กรกฎาคม 2565 · Thai National LCI Database, TIIS-MTEC-NSTDA", "source_detail": "หน้า 50 · ลำดับ 575 การฝังกลบขยะมูลฝอยชุมชนแบบถูกหลักสุขาภิบาล · Update_Mar2021 · ลำดับข้างเคียง: 573 การคัดแยก 0.0159 · 574 เทกอง 1.0388 · 576 ฝังกลบติดตั้งระบบนำก๊าซมีเทนมาใช้ 0.0175", "source_url": "https://rasen.mahidol.ac.th/wp-content/uploads/2024/08/EF-CFP.pdf", "verified": true, "is_primary": false, "sort_order": 32, "note": "แก้ไข 29 ต.ค. 2569 ตามแชทบทความ: เดิมระบุผิดว่าเป็นลำดับ 573 ฝังกลบเศษอาหาร · Hutangkoon et al. (2026) อ้างค่านี้เป็นค่าเศษอาหาร แต่บัญชีของ อบก. เป็นค่าขยะรวม — ใช้เทียบเท่านั้น"}, {"code": "LF_HUTANGKOON2026", "category": "landfill", "fuel_code": null, "name": "ฝังกลบถูกหลักสุขาภิบาล — กรณีไฮเปอร์มาร์เก็ต กรุงเทพฯ", "value": 1.4667, "unit": "kgCO2e/กก. เศษอาหาร", "method": "ประเมินวัฏจักรชีวิต (CML2001) ฝังกลบถูกหลักสุขาภิบาล รวมการขนส่งไป–กลับ 35.6 กม. ของกรณีศึกษา", "source": "Hutangkoon, T., Yuangyai, C., Puttongsiri, T., Filimonau, V., & Koiwanit, J. (2026). Carbon Footprint Assessment of Food Waste Disposal Methods in a Thai Hypermarket's Fresh Food Department. Resources, 15(4), 54", "source_detail": "Abstract และส่วนผล: sanitary landfill 1.4667 kg CO2 eq./kg food waste", "source_url": "https://doi.org/10.3390/resources15040054", "verified": true, "is_primary": false, "sort_order": 33.0, "note": "ค่านี้รวมการขนส่งของกรณีศึกษาไว้แล้ว"}, {"code": "LF_TGO_CFP_IPCC", "category": "landfill", "fuel_code": null, "name": "ฝังกลบเศษอาหาร (กองขยะแบบตื้น) — ตาราง CFP อบก. ลำดับ 728", "value": 2.53, "unit": "kgCO2e/กก. เศษอาหาร", "method": "ค่าจาก IPCC 2006 Guidelines Vol.5 Waste สำหรับกองขยะแบบตื้นที่ไม่มีการจัดการ", "source": "อบก. (TGO) ค่า Emission Factor แบ่งตามประเภทกลุ่มอุตสาหกรรม (CFP) UPDATE กรกฎาคม 2565", "source_detail": "หน้า 60 · หมวด 24 กลุ่มการฝังกลบขยะ · ลำดับ 728 เศษอาหาร · 2006 IPCC Volume 5: Waste · Update_09Apr15 · ตรงกับข้อกำหนดการคำนวณคาร์บอนฟุตพริ้นท์ขององค์กร พิมพ์ครั้งที่ 8 (ก.ค. 2565) ภาคผนวก 6 ข้อ 6.6 ตารางที่ 2 หน้า 61–62 กรณีกองขยะแบบตื้น · ยืนยันโดยแชทบทความ (GHG-COLLECT-01-A1)", "source_url": "https://rasen.mahidol.ac.th/wp-content/uploads/2024/08/EF-CFP.pdf", "verified": true, "is_primary": false, "sort_order": 34, "note": "ใช้กับกองขยะตื้นที่ไม่มีการจัดการ ไม่ใช่หลุมฝังกลบถูกหลักสุขาภิบาล"}, {"code": "LF_SAIPHET_LOW", "category": "landfill", "fuel_code": null, "name": "ฝังกลบถูกหลักสุขาภิบาล เทศบาลไทย (ค่าต่ำ: N1 0.74)", "value": 0.74, "unit": "kgCO2e/กก. เศษอาหาร", "method": "วิธี T-VER (TGO, 2021) · ต่อตันขยะอาหารของเทศบาลต่อปี · รวมการขนส่ง + การบำบัด", "source": "Saiphet & Kunta (2023). Municipal Food Waste Management and Its Greenhouse Gas Emission in Thailand: A Case Study of 8 Municipalities. Environmental Research, Engineering and Management 79(3), 60–74", "source_detail": "หน้า 69 ตารางที่ 4 (หน้า 69–70) · เทศบาลที่ฝังกลบถูกหลักสุขาภิบาล 3 แห่ง: C1 0.80 · C2 0.75 · N1 0.74 (หมักปุ๋ย 0.15–0.17 · เผา 0.59 · ภาพรวม 0.65) · ยืนยันโดยแชทบทความ (GHG-COLLECT-01-A1)", "source_url": "https://doi.org/10.5755/j01.erem.79.3.33014", "verified": true, "is_primary": false, "sort_order": 35, "note": "ค่านี้รวมการขนส่งของเทศบาลแล้ว ถ้าใช้คู่กับค่าขนส่งของระบบจะนับการขนส่งซ้ำ — ใช้เทียบเท่านั้น"}, {"code": "LF_SAIPHET_HIGH", "category": "landfill", "fuel_code": null, "name": "ฝังกลบถูกหลักสุขาภิบาล เทศบาลไทย (ค่าสูง: C1 0.80)", "value": 0.8, "unit": "kgCO2e/กก. เศษอาหาร", "method": "วิธี T-VER (TGO, 2021) · ต่อตันขยะอาหารของเทศบาลต่อปี · รวมการขนส่ง + การบำบัด", "source": "Saiphet & Kunta (2023). Municipal Food Waste Management and Its Greenhouse Gas Emission in Thailand: A Case Study of 8 Municipalities. Environmental Research, Engineering and Management 79(3), 60–74", "source_detail": "หน้า 69 ตารางที่ 4 (หน้า 69–70) · C1: ขยะอาหาร 54,383 ตัน/ปี · ขนส่ง 4,774 + บำบัด 38,570 = 43,344 tCO2-eq ⇒ 0.80 · ยืนยันโดยแชทบทความ (GHG-COLLECT-01-A1)", "source_url": "https://doi.org/10.5755/j01.erem.79.3.33014", "verified": true, "is_primary": false, "sort_order": 36, "note": "ค่านี้รวมการขนส่งของเทศบาลแล้ว ถ้าใช้คู่กับค่าขนส่งของระบบจะนับการขนส่งซ้ำ — ใช้เทียบเท่านั้น"}, {"code": "PR_BSF_MERTENAT2019", "category": "process", "fuel_code": null, "name": "การเลี้ยงหนอน BSF — งานวิจัยต่างประเทศ (อินโดนีเซีย)", "value": 0.035, "unit": "kgCO2e/กก. เศษอาหาร", "method": "LCA โรงบำบัดขยะอินทรีย์ด้วยหนอน BSF: 35 kgCO2eq ต่อตันขยะเปียก รวมการหมักกากต่อ (68% ของค่า) และไฟฟ้าจากถ่านหิน 1.17 kgCO2e/kWh", "source": "Mertenat, A., Diener, S., & Zurbrügg, C. (2019). Black Soldier Fly biowaste treatment – Assessment of global warming potential. Waste Management, 84, 173–181", "source_detail": "หัวข้อ 3.2 และ Fig. 5 · โรงงานนำร่องสุราบายา อินโดนีเซีย · หน่วยฟังก์ชัน 1 ตันขยะอินทรีย์ (น้ำหนักเปียก)", "source_url": "https://doi.org/10.1016/j.wasman.2018.11.040", "verified": true, "is_primary": true, "sort_order": 41.0, "note": "ค่าอ้างอิงจากงานวิจัยต่างประเทศ (Eawag สวิตเซอร์แลนด์ ศึกษาที่อินโดนีเซีย) ระบบ ขนาด และแหล่งไฟฟ้าต่างจากฟาร์มในไทย"}, {"code": "PR_LESS_WM07_ZERO", "category": "process", "fuel_code": null, "name": "การเลี้ยงหนอน BSF — ตามวิธี LESS-WM-07 (ไม่คิดการปล่อย)", "value": 0.0, "unit": "kgCO2e/กก. เศษอาหาร", "method": "LESS-WM-07 กำหนดการปล่อยจากการดำเนินโครงการ = 0 และไม่พิจารณาการปล่อยของไส้เดือนและหนอนแมลงวันลาย", "source": "อบก. (TGO) วิธีการคำนวณ LESS-WM-07 Version 5", "source_detail": "ไฟล์ Excel แผ่น \"อ้างอิง\" สมการ D4 = 0 และหมายเหตุข้อ 3", "source_url": "https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/2100-2021-05-20-06-54-06.html", "verified": true, "is_primary": false, "sort_order": 42.0, "note": null}, {"code": "FE_10", "category": "fuel_economy", "fuel_code": null, "name": "รถกระบะดีเซล 10 กม./ลิตร (สมมติฐานค่าต่ำ)", "value": 10.0, "unit": "กม./ลิตร", "method": "สมมติฐาน ใช้วิเคราะห์ความอ่อนไหว", "source": "สมมติฐานตามคำสั่ง GHG-COLLECT-01 (รถกระบะดีเซล 10–14 กม./ลิตร)", "source_detail": null, "source_url": null, "verified": false, "is_primary": false, "sort_order": 51.0, "note": "สมมติฐาน ไม่ใช่ค่าวัดจริง"}, {"code": "FE_12", "category": "fuel_economy", "fuel_code": null, "name": "รถกระบะดีเซล 12 กม./ลิตร (สมมติฐานค่ากลาง)", "value": 12.0, "unit": "กม./ลิตร", "method": "ค่ากึ่งกลางของช่วง 10–14 ใช้กับรถที่ยังไม่ระบุ กม./ลิตร", "source": "สมมติฐานตามคำสั่ง GHG-COLLECT-01 (รถกระบะดีเซล 10–14 กม./ลิตร)", "source_detail": null, "source_url": null, "verified": false, "is_primary": true, "sort_order": 52.0, "note": "สมมติฐาน ไม่ใช่ค่าวัดจริง"}, {"code": "FE_14", "category": "fuel_economy", "fuel_code": null, "name": "รถกระบะดีเซล 14 กม./ลิตร (สมมติฐานค่าสูง)", "value": 14.0, "unit": "กม./ลิตร", "method": "สมมติฐาน ใช้วิเคราะห์ความอ่อนไหว", "source": "สมมติฐานตามคำสั่ง GHG-COLLECT-01 (รถกระบะดีเซล 10–14 กม./ลิตร)", "source_detail": null, "source_url": null, "verified": false, "is_primary": false, "sort_order": 53.0, "note": "สมมติฐาน ไม่ใช่ค่าวัดจริง"}].forEach((f, i) => add('food.carbon_factor', { ...f, sort_order: f.sort_order || i }));
  D['core.app_setting'].push({ key: 'carbon_default_fuel', value: 'diesel_b7', description: 'เชื้อเพลิงตั้งต้น' });
  { const F = D['food.carbon_factor'], byCode = c => F.find(f => f.code === c); const b7 = byCode('FUEL_DIESEL_B7'), e10 = byCode('FUEL_E10');   // DEC-114 = sql/012
    add('food.carbon_factor', { ...(({ id, ...x }) => x)(b7), code: 'FUEL_DIESEL_B7_PREMIUM', fuel_code: 'diesel_b7_premium', name: 'ดีเซลพรีเมียม B7', sort_order: 12, note: 'อบก. ไม่แยกค่าดีเซลพรีเมียม จึงใช้ค่าของ B7 ซึ่งเป็นสูตรผสมเดียวกัน' });
    add('food.carbon_factor', { ...(({ id, ...x }) => x)(e10), code: 'FUEL_GASOHOL91', fuel_code: 'gasohol_91', name: 'แก๊สโซฮอล์ 91 (E10)', sort_order: 17, note: 'อบก. ไม่แยกค่าตามค่าออกเทน 91/95 จึงใช้ค่าของ E10' });
    for (const [c, n, o] of [['FUEL_DIESEL_B7', 'ดีเซล B7 (ดีเซลหมุนเร็วทั่วไปหน้าปั๊ม)', 11], ['FUEL_DIESEL_B20', 'ดีเซล B20', 13], ['FUEL_DIESEL', 'ดีเซลไม่ผสมไบโอดีเซล (B0)', 14], ['FUEL_GASOLINE', 'เบนซิน 95 (ไม่ผสมเอทานอล)', 15], ['FUEL_E10', 'แก๊สโซฮอล์ 95 (E10)', 16], ['FUEL_E20', 'แก๊สโซฮอล์ E20', 18], ['FUEL_E85', 'แก๊สโซฮอล์ E85', 19]]) Object.assign(byCode(c), { name: n, sort_order: o }); }
  Object.assign(rt1, { path_distance_m: 8200, path_duration_s: 900, path_source: 'สาธิต', round_trip: true }); f1.main_route_id = rt1.id; Object.assign(v1, { fuel_code: 'diesel_b7', km_per_liter: 11, vehicle_type: 'pickup' });
  add('food.route', { org_id: o1.id, name: 'สายตัวอย่าง ร้าน ข–ฟาร์ม ข', farm_id: f2.id, start_name: 'ศูนย์สาธิต', start_lat: 15.235, start_lng: 104.84, via: [] });
  let me = null;
  const byId = (t, id) => D[t].find(r => r.id === id) || {};
  const userName = id => (D['core.app_user'].find(u => u.id === id) || {}).display_name || null;
  const itemsOf = pid => D['food.pickup_item'].filter(i => i.pickup_id === pid && i.status === 'active');
  const r2 = n => Math.round(n * 100) / 100;
  const avg = arr => { const a = arr.filter(x => x != null); return a.length ? r2(a.reduce((s, x) => s + x, 0) / a.length) : null; };
  const projOf = p => byId('core.project', p.project_id || byId('food.farm', p.farm_id).project_id);
  const pubProj = pj => pj.is_public && pj.status === 'active';
  // DEC-113 คาร์บอน (จำลองตรรกะเดียวกับ food.v_carbon_base)
  const demoCarbonRows = () => {
    const F = D['food.carbon_factor'].filter(f => f.status === 'active');
    const prim = (c, fc) => F.find(f => f.category === c && f.is_primary && (fc === undefined || f.fuel_code === fc));
    const lf = prim('landfill'), pr = prim('process'), fe = prim('fuel_economy');
    const fuelDefault = ((D['core.app_setting'].find(s => s.key === 'carbon_default_fuel') || {}).value) || DEFAULT_FUEL;
    return D['food.pickup'].filter(p => p.status === 'active').map(p => {
      const f = byId('food.farm', p.farm_id), rid = p.route_id || f.main_route_id || null, r = rid ? byId('food.route', rid) : {};
      const kg = itemsOf(p.id).reduce((s, i) => s + +i.weight_kg, 0);
      const km_source = p.fuel_liters != null ? 'liters' : p.distance_km != null ? 'typed' : (p.route_id && r.path_distance_m != null) ? 'route' : (!p.route_id && r.path_distance_m != null) ? 'main_route' : 'none';
      const km = p.distance_km != null ? +p.distance_km : r.path_distance_m != null ? Math.round(r.path_distance_m / 10) / 100 : null;
      const vid = p.vehicle_id || r.vehicle_id || null, v = vid ? byId('food.vehicle', vid) : {};
      const fuel_code = v.fuel_code || fuelDefault, kmpl = v.km_per_liter || (fe ? fe.value : null), ef = prim('fuel', fuel_code);
      const liters = p.fuel_liters != null ? +p.fuel_liters : (km != null && kmpl > 0 ? km / kmpl : null);
      const kmpl_assumed = p.fuel_liters == null && !v.km_per_liter;
      const tr = liters != null && ef ? liters * ef.value : null, av = lf ? kg * lf.value : null, pc = pr ? kg * pr.value : null;
      return { pickup_id: p.id, org_id: p.org_id, project_id: p.project_id || f.project_id, farm_id: p.farm_id, farm_name: f.name, pickup_date: p.pickup_date, route_id: rid, route_name: r.name || null, round_trip: !!r.round_trip, vehicle_id: vid, vehicle_name: v.name || null, kg, km, km_source, fuel_code, kmpl, kmpl_assumed, liters, ef_fuel: ef ? ef.value : null, ef_landfill: lf ? lf.value : null, ef_process: pr ? pr.value : null, e_transport: tr, e_avoided: av, e_process: pc, e_net: av == null ? null : av - (tr || 0), e_net_after_process: av == null ? null : av - (tr || 0) - (pc || 0), t_fixed: kmpl_assumed ? null : tr, t_km_ef_assumed: kmpl_assumed && km != null && ef ? km * ef.value : null, is_estimated: km_source === 'main_route' || kmpl_assumed };
    });
  };
  const views = {
    'food.v_pickup': () => D['food.pickup'].map(p => { const f = byId('food.farm', p.farm_id), pj = projOf(p), its = itemsOf(p.id); return { ...p, org_code: byId('core.org', p.org_id).code, farm_name: f.name, project_id: pj.id, project_code: pj.code, project_name: pj.name, project_overridden: !!p.project_id && p.project_id !== f.project_id, vehicle_name: p.vehicle_id ? byId('food.vehicle', p.vehicle_id).name : null, created_by_name: userName(p.created_by), updated_by_name: userName(p.updated_by), items: its.length, total_kg: r2(sum(its, 'weight_kg')), avg_quality: avg(its.map(i => i.quality)), photo_count: D['food.pickup_photo'].filter(x => x.pickup_id === p.id && x.status === 'active').length }; }),
    'food.v_pickup_item': () => D['food.pickup_item'].map(i => { const p = byId('food.pickup', i.pickup_id), f = byId('food.farm', p.farm_id), pj = projOf(p), s = byId('food.source', i.source_id); return { ...i, pickup_date: p.pickup_date, pickup_time: p.pickup_time, farm_id: p.farm_id, farm_name: f.name, project_id: pj.id, project_code: pj.code, source_name: s.name, source_type_id: s.source_type_id, source_type_name: s.source_type_id ? byId('food.source_type', s.source_type_id).name : null, pickup_status: p.status, created_by_name: userName(i.created_by) }; }),
    'food.v_farm_summary': () => D['food.farm'].map(f => { const pj = byId('core.project', f.project_id); const ps = D['food.pickup'].filter(p => p.farm_id === f.id && p.status === 'active'); const its = ps.flatMap(p => itemsOf(p.id)); const ds = ps.map(p => p.pickup_date).sort(); return { farm_id: f.id, org_id: f.org_id, farm_name: f.name, project_id: f.project_id, project_code: pj.code, project_name: pj.name, lat: f.lat, lng: f.lng, status: f.status, pickups: ps.length, total_kg: r2(sum(its, 'weight_kg')), first_date: ds[0] || null, last_date: ds[ds.length - 1] || null }; }),
    'food.v_source_summary': () => D['food.source'].map(s => { const its = D['food.pickup_item'].filter(i => i.source_id === s.id && i.status === 'active' && byId('food.pickup', i.pickup_id).status === 'active'); const ds = its.map(i => byId('food.pickup', i.pickup_id).pickup_date).sort(); return { source_id: s.id, org_id: s.org_id, source_name: s.name, source_type_id: s.source_type_id, source_type_name: s.source_type_id ? byId('food.source_type', s.source_type_id).name : null, lat: s.lat, lng: s.lng, status: s.status, pickups: new Set(its.map(i => i.pickup_id)).size, total_kg: r2(sum(its, 'weight_kg')), avg_quality: avg(its.map(i => i.quality)), first_date: ds[0] || null, last_date: ds[ds.length - 1] || null }; }),
    'food.v_monthly': () => { const out = {}; for (const p of D['food.pickup']) { if (p.status !== 'active') continue; const pj = projOf(p); const k = p.org_id + pj.id + p.pickup_date.slice(0, 7); out[k] = out[k] || { org_id: p.org_id, project_id: pj.id, project_code: pj.code, month_start: p.pickup_date.slice(0, 7) + '-01', pickups: 0, total_kg: 0 }; out[k].pickups++; out[k].total_kg = r2(out[k].total_kg + sum(itemsOf(p.id), 'weight_kg')); } return Object.values(out); },
    'food.v_route': () => D['food.route'].map(r => { const f = byId('food.farm', r.farm_id); return { ...r, round_trip: !!r.round_trip, farm_name: f.name, farm_lat: f.lat, farm_lng: f.lng, vehicle_name: r.vehicle_id ? byId('food.vehicle', r.vehicle_id).name : null, path_km: r.path_distance_m != null ? Math.round(r.path_distance_m / 100) / 10 : null, stops: D['food.route_stop'].filter(x => x.route_id === r.id).length }; }),
    'food.v_route_stop': () => D['food.route_stop'].map(x => { const src = byId('food.source', x.source_id); return { ...x, source_name: src.name, lat: src.lat, lng: src.lng, source_type_name: src.source_type_id ? byId('food.source_type', src.source_type_id).name : null }; }),
    'food.v_public_total': () => D['core.project'].filter(pubProj).map(pj => { const o = byId('core.org', pj.org_id); const ps = D['food.pickup'].filter(p => p.status === 'active' && byId('food.farm', p.farm_id).status === 'active' && projOf(p).id === pj.id); const its = ps.flatMap(p => itemsOf(p.id)); const ds = ps.map(p => p.pickup_date).sort(); return { org_code: o.code, org_name: o.name, project_code: pj.code, project_name: pj.name, year_be: pj.year_be, pickups: ps.length, farms: new Set(ps.map(p => p.farm_id)).size, sources: new Set(its.map(i => i.source_id)).size, total_kg: r2(sum(its, 'weight_kg')), first_date: ds[0] || null, last_date: ds[ds.length - 1] || null }; }),
    'food.v_public_monthly': () => views['food.v_monthly']().filter(m => pubProj(byId('core.project', m.project_id))).map(m => ({ org_code: byId('core.org', m.org_id).code, project_code: m.project_code, month_start: m.month_start, pickups: m.pickups, total_kg: m.total_kg })),
    'food.v_public_source': () => { const out = {}; for (const i of views['food.v_pickup_item']()) { const p = byId('food.pickup', i.pickup_id); if (i.status !== 'active' || p.status !== 'active') continue; const pj = projOf(p); if (!pubProj(pj)) continue; const k = pj.id + i.source_id; out[k] = out[k] || { org_code: byId('core.org', p.org_id).code, project_code: pj.code, source_name: i.source_name, source_type_name: i.source_type_name, _p: new Set(), _q: [], total_kg: 0, first_date: null, last_date: null }; const x = out[k]; x._p.add(p.id); x._q.push(i.quality); x.total_kg = r2(x.total_kg + i.weight_kg); x.first_date = !x.first_date || p.pickup_date < x.first_date ? p.pickup_date : x.first_date; x.last_date = !x.last_date || p.pickup_date > x.last_date ? p.pickup_date : x.last_date; } return Object.values(out).map(x => ({ ...x, pickups: x._p.size, avg_quality: avg(x._q), _p: undefined, _q: undefined })); },
    'food.v_pickup_carbon': () => demoCarbonRows().filter(r => !me || me.role !== 'recorder' || !me.project_id || r.project_id === me.project_id),
    'food.v_public_carbon': () => { const out = {}; for (const r of demoCarbonRows()) { const pj = byId('core.project', r.project_id); if (!pubProj(pj)) continue; const k = pj.code + '|' + r.farm_name; const g = out[k] = out[k] || { org_code: byId('core.org', pj.org_id).code, project_code: pj.code, farm_name: r.farm_name, pickups: 0, kg: 0, km: 0, liters: 0, e_transport: 0, e_avoided: 0, e_process: 0, e_net: 0, e_net_after_process: 0, t_fixed: 0, t_km_ef_assumed: 0, pickups_estimated: 0, pickups_no_distance: 0, first_date: null, last_date: null }; g.pickups++; for (const x of ['kg', 'km', 'liters', 'e_transport', 'e_avoided', 'e_process', 'e_net', 'e_net_after_process', 't_fixed', 't_km_ef_assumed']) g[x] += +r[x] || 0; if (r.is_estimated) g.pickups_estimated++; if (r.km_source === 'none') g.pickups_no_distance++; if (!g.first_date || r.pickup_date < g.first_date) g.first_date = r.pickup_date; if (!g.last_date || r.pickup_date > g.last_date) g.last_date = r.pickup_date; } return Object.values(out); },
    'food.v_public_carbon_factor': () => D['food.carbon_factor'].filter(f => f.status === 'active'),
    'food.v_public_farm': () => { const out = {}; for (const p of D['food.pickup']) { const f = byId('food.farm', p.farm_id); const pj = projOf(p); if (p.status !== 'active' || f.status !== 'active' || !pubProj(pj)) continue; const k = pj.id + f.id; out[k] = out[k] || { org_code: byId('core.org', f.org_id).code, project_code: pj.code, farm_name: f.name, lat: f.lat, lng: f.lng, pickups: 0, total_kg: 0, first_date: null, last_date: null }; const x = out[k]; x.pickups++; x.total_kg = r2(x.total_kg + sum(itemsOf(p.id), 'weight_kg')); x.first_date = !x.first_date || p.pickup_date < x.first_date ? p.pickup_date : x.first_date; x.last_date = !x.last_date || p.pickup_date > x.last_date ? p.pickup_date : x.last_date; } return Object.values(out); }
  };
  const PUBLIC = ['food.v_public_total', 'food.v_public_monthly', 'food.v_public_source', 'food.v_public_farm', 'food.v_public_carbon', 'food.v_public_carbon_factor'];
  const GLOBAL = ['food.source_type', 'core.app_setting', 'food.carbon_factor'];
  const scope = (name, rows) => {
    if (PUBLIC.includes(name)) return rows;
    if (!me) throw new Error('ไม่ได้ล็อกอิน');
    if (me.role === 'super_admin' || GLOBAL.includes(name)) return rows;
    if (name === 'core.app_user') return rows.filter(r => r.id === me.id || (me.role === 'admin' && r.org_id === me.org_id));
    if (name === 'core.org') return rows.filter(r => r.id === me.org_id);
    return rows.filter(r => r.org_id === me.org_id);
  };
  const filt = (rows, o = {}) => {
    let out = rows.filter(r => Object.entries(o.eq || {}).every(([k, v]) => r[k] === v) && Object.entries(o.neq || {}).every(([k, v]) => r[k] !== v) && Object.entries(o.in || {}).every(([k, v]) => v.includes(r[k])) && Object.entries(o.gte || {}).every(([k, v]) => r[k] >= v) && Object.entries(o.lte || {}).every(([k, v]) => r[k] <= v));
    const srt = (k, asc) => { out = out.slice().sort((a, b) => ((a[k] ?? '') > (b[k] ?? '') ? 1 : (a[k] ?? '') < (b[k] ?? '') ? -1 : 0) * (asc === false ? -1 : 1)); };
    if (o.order2) srt(o.order2[0], o.order2[1]); if (o.order) srt(o.order[0], o.order[1]);
    if (o.limit) out = out.slice(0, o.limit);
    return out.map(r => ({ ...r }));
  };
  return {
    name: 'demo',
    async session() { return me ? { user: { id: me.id }, access_token: 'demo' } : null; },
    async login(username, password) { const u = D['core.app_user'].find(x => x.username === username.trim().toLowerCase()); if (!u || password !== 'demo') throw new Error('ชื่อล็อกอินหรือรหัสผ่านไม่ถูกต้อง (สาธิต: รหัสผ่านคือ demo)'); me = u; return { ...u }; },
    async logout() { me = null; },
    async me() { return me ? { ...me } : null; },
    async changePassword() { },
    async list(name, o) { const rows = views[name] ? views[name]() : D[name]; if (!rows) throw new Error('สาธิต: ไม่รู้จัก ' + name); return filt(scope(name, rows), o); },
    async insert(name, row) {
      if (!me) throw new Error('ไม่ได้ล็อกอิน');
      const r = { ...row };
      if (['food.farm', 'food.source', 'food.vehicle', 'food.pickup', 'food.route', 'core.project'].includes(name) && !r.org_id) r.org_id = me.org_id;
      if (name === 'food.pickup_item' || name === 'food.pickup_photo') r.org_id = byId('food.pickup', r.pickup_id).org_id;
      if (name === 'food.route_stop') r.org_id = byId('food.route', r.route_id).org_id;
      if (['food.farm', 'food.source', 'food.vehicle', 'food.route', 'food.carbon_factor'].includes(name) && me.role === 'recorder') throw new Error('permission denied: row-level security');
      if (name === 'food.pickup' && r.pickup_date > todayISO()) throw new Error('วันที่เข้ารับเป็นวันในอนาคต ตรวจวันที่อีกครั้ง');
      if (name === 'food.pickup') { const fp = byId('food.farm', r.farm_id).project_id; if (me.role !== 'super_admin' || !r.project_id) r.project_id = fp; if (me.role === 'recorder' && me.project_id && me.project_id !== r.project_id) throw new Error('ฟาร์มนี้อยู่นอกโครงการที่บัญชีของคุณสังกัด ให้ admin ตรวจสอบ'); const vpj = r.vehicle_id ? byId('food.vehicle', r.vehicle_id).project_id : null; if (vpj && vpj !== r.project_id) throw new Error('รถที่เลือกอยู่คนละโครงการกับรอบนี้'); }   // DEC-112
      if (name === 'food.pickup_item') { const pk = byId('food.pickup', r.pickup_id), spj = byId('food.source', r.source_id).project_id; if (spj && pk.project_id && spj !== pk.project_id) throw new Error('แหล่งกำเนิดที่เลือกอยู่คนละโครงการกับรอบนี้'); }
      if (name === 'food.pickup_item' && D['food.pickup_item'].some(i => i.pickup_id === r.pickup_id && i.source_id === r.source_id)) throw new Error('duplicate key: แหล่งกำเนิดเศษอาหารนี้มีในรอบแล้ว');
      if (name === 'food.pickup_photo') { const mx = parseInt((D['core.app_setting'].find(s => s.key === 'max_photos_per_pickup') || {}).value || '3'); if (D['food.pickup_photo'].filter(x => x.pickup_id === r.pickup_id && x.status === 'active').length >= mx) throw new Error(`รอบนี้มีรูปครบ ${mx} รูปแล้ว ให้ admin ยกเลิกรูปเก่าก่อนจึงเพิ่มได้`); }
      r.created_by = me.id; r.updated_by = me.id;
      return { ...add(name, r) };
    },
    async insertMany(name, rows) { const out = []; for (const r of rows) out.push(await this.insert(name, r)); return out; },
    async update(name, id, patch, pk = 'id') {
      const r = D[name].find(x => x[pk] === id); if (!r) throw new Error('ไม่พบข้อมูล');
      if (me.role === 'recorder' && patch.status === 'inactive') throw new Error('ผู้บันทึกยกเลิกไม่ได้ ต้องให้ admin ทำ');
      if (name === 'food.carbon_factor') { if (!['admin', 'super_admin'].includes(me.role)) throw new Error('permission denied: row-level security'); if (patch.is_primary) D['food.carbon_factor'].forEach(f => { if (f.id !== id && f.category === r.category && (f.fuel_code || '') === ((patch.fuel_code !== undefined ? patch.fuel_code : r.fuel_code) || '')) f.is_primary = false; }); }
      if (name === 'food.pickup' && ('farm_id' in patch || 'project_id' in patch)) { const fp = byId('food.farm', patch.farm_id || r.farm_id).project_id; if (me.role !== 'super_admin' || !patch.project_id) patch.project_id = fp; }   // DEC-112 ล็อกตามฟาร์ม
      Object.assign(r, patch, { updated_at: now(), updated_by: me.id }); return { ...r };
    },
    async remove(name, id) { const i = D[name].findIndex(r => r.id === id); if (i >= 0) D[name].splice(i, 1); },
    async engine(action, payload) {
      const pw = (code, custom) => custom ? String(custom) : (String(code || 'app').toLowerCase() + String(Math.floor(1000 + Math.random() * 9000)));
      if (action === 'create_user') { const oid = me.role === 'super_admin' ? payload.org_id : me.org_id; const org = byId('core.org', oid); const cnt = D['core.app_user'].filter(u => u.org_id === oid && u.role === 'recorder' && u.status === 'active').length; if (payload.role === 'recorder' && cnt >= org.max_recorders) throw new Error(`บัญชีผู้บันทึกขององค์กรนี้ครบเพดาน ${org.max_recorders} บัญชีแล้ว`); const u = add('core.app_user', { username: payload.username, display_name: payload.display_name, role: payload.role, org_id: oid }); return { ok: true, account: { ...u, password: pw(org.code, payload.password) } }; }
      if (action === 'reset_password') { const t = byId('core.app_user', payload.user_id); return { ok: true, username: t.username, role: t.role, password: pw(t.org_id ? byId('core.org', t.org_id).code : 'app', payload.password) }; }
      if (action === 'whoami') return { ok: true, me };
      if (action === 'resolve_link') { await new Promise(r => setTimeout(r, 300)); return { ok: true, url: 'https://www.google.com/maps/place/demo/@15.240311,104.823275,17z' }; }   // สาธิต: คืนพิกัดตัวอย่าง
      throw new Error('สาธิต: ไม่รองรับ ' + action);
    },
    async uploadPhoto(endpointUrl, payload) { return { ok: true, file_id: 'demo-' + Date.now(), url: 'data:' + (payload.mime || 'image/jpeg') + ';base64,' + payload.data, size: payload.data.length * 3 / 4 }; }
  };
};
const api = IS_DEMO ? DemoBackend() : SupaBackend();

// =====================================================================
// คิวพักข้อมูลในเครื่อง — IndexedDB (รองรับรูปหลายใบ ไม่ติดเพดาน 5 MiB ของ localStorage · DEC-106)
//   รายการ: { id, kind, payload, label, status: 'pending'|'error', error, created_at }
//   โมดูลลงทะเบียนวิธีส่งด้วย Queue.handlers[kind] = async payload => {...}
// =====================================================================
const Queue = {
  DB: 'apptech_queue', STORE: 'items', handlers: {}, syncing: false,
  _open() { return new Promise((res, rej) => { const rq = indexedDB.open(this.DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(this.STORE, { keyPath: 'id' }); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); },
  async _tx(mode, fn) { const db = await this._open(); return new Promise((res, rej) => { const tx = db.transaction(this.STORE, mode); const st = tx.objectStore(this.STORE); const out = fn(st); tx.oncomplete = () => { db.close(); res(out && out.result !== undefined ? out.result : out); }; tx.onerror = () => { db.close(); rej(tx.error); }; }); },
  async all() { try { const r = await this._tx('readonly', st => st.getAll()); return (r || []).sort((a, b) => a.created_at.localeCompare(b.created_at)); } catch (e) { console.warn('queue', e); return []; } },
  async push(item) { const it = { id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), status: 'pending', created_at: new Date().toISOString(), ...item }; await this._tx('readwrite', st => st.put(it)); await this.refreshBadge(); return it; },
  async save(it) { await this._tx('readwrite', st => st.put(it)); },
  async remove(id) { await this._tx('readwrite', st => st.delete(id)); await this.refreshBadge(); },
  async refreshBadge() { const items = await this.all(); const n = items.length; const c = $('#queueCount'), b = $('#btnQueue'); if (c) c.textContent = n; if (b) b.classList.toggle('hidden', n === 0);
    const old = items.find(i => (Date.now() - new Date(i.created_at)) / 86400000 >= CONFIG.QUEUE_WARN_DAYS); if (old && !sessionStorage.getItem('apptech_queue_warned')) { sessionStorage.setItem('apptech_queue_warned', '1'); toastErr('มีรายการค้างส่งนานกว่า ' + CONFIG.QUEUE_WARN_DAYS + ' วัน', 'ไปที่ปุ่ม "รอส่ง" แล้วกด "ส่งตอนนี้" เมื่อมีสัญญาณ · ข้อมูลในเครื่องอาจถูกเบราว์เซอร์ลบถ้าไม่เปิดแอปนาน'); } },
  async sync() {
    if (this.syncing || !navigator.onLine || !S.me) return;
    this.syncing = true; let sent = 0;
    try {
      for (const it of await this.all()) {
        const h = this.handlers[it.kind]; if (!h) continue;
        try { await h(it.payload); await this.remove(it.id); sent++; }
        catch (e) { const f = friendlyError(e); it.status = 'error'; it.error = f.title + (f.hint ? ' — ' + f.hint : ''); await this.save(it); if (isNetworkError(e)) break; }
      }
    } finally { this.syncing = false; await this.refreshBadge(); }
    if (sent) toast(`ส่งข้อมูลที่ค้างแล้ว ${sent} รายการ`);
  }
};
async function pageQueue(view) {
  const items = await Queue.all();
  view.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">รายการรอส่ง (${items.length})</h3><button onclick="Queue.sync().then(render)" ${navigator.onLine ? '' : 'disabled'}>ส่งตอนนี้</button></div>
    <div class="muted">${navigator.onLine ? 'มีสัญญาณ' : 'ไม่มีสัญญาณ'} · ระบบจะส่งให้เองเมื่อสัญญาณกลับมา · รายการที่ค้างนานควรส่งก่อนปิดแอป</div>
    <table><thead><tr><th>รายการ</th><th>สถานะ</th><th></th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.label || i.kind)}<div class="muted">${thDate(i.created_at)}</div></td><td>${i.status === 'error' ? `<span style="color:var(--danger)">${esc(i.error)}</span>` : 'รอส่ง'}</td><td><button class="small danger" onclick="if(confirm('ลบรายการนี้ออกจากคิว? ข้อมูลจะหาย')){Queue.remove('${i.id}').then(render)}">ลบ</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">ไม่มีรายการค้าง</td></tr>'}</tbody></table></div>`;
}

// =====================================================================
// โหลดข้อมูลส่วนกลาง (core) และตัวช่วยขอบเขตองค์กร
// =====================================================================
async function loadCore(force) {
  if (S.cache.coreLoaded && !force) return;
  const [orgs, projects, settings] = await Promise.all([api.list('core.org', { order: ['code'] }), api.list('core.project', { order: ['code'] }), api.list('core.app_setting', { order: ['key'] })]);
  S.orgs = orgs; S.projects = projects; S.settings = settings; S.cache.coreLoaded = true;
  const sysName = setting('system_name'); if (sysName) { const t = $('#title'); if (t) t.textContent = sysName; document.title = sysName; }
  if (!S.scopeOrg) S.scopeOrg = S.me.org_id || (orgs[0] && orgs[0].id) || null;
}
const setting = k => (S.settings.find(s => s.key === k) || {}).value || '';
const orgOf = id => S.orgs.find(o => o.id === id) || {};
const projOf = id => S.projects.find(p => p.id === id) || {};
const scopeEq = () => (S.scopeOrg ? { org_id: S.scopeOrg } : {});
const isSuper = () => S.me && S.me.role === 'super_admin';
const isAdmin = () => S.me && (S.me.role === 'admin' || isSuper());
const roleLabel = r => ({ super_admin: 'super admin', admin: 'admin', recorder: 'ผู้บันทึก' }[r] || r);
function scopeSelector() {
  if (!isSuper() || S.orgs.length < 2) return '';   // องค์กรเดียว = ไม่ต้องเลือก (DEC-109)
  return `<div class="card row"><label style="margin:0">องค์กรที่กำลังดู</label><select style="max-width:360px" onchange="S.scopeOrg=this.value||null;render()">${S.orgs.map(o => `<option value="${o.id}" ${o.id === S.scopeOrg ? 'selected' : ''}>${esc(o.code)} · ${esc(o.name)}</option>`).join('')}</select></div>`;
}

// =====================================================================
// หน้าร่วม: ล็อกอิน · บัญชี
// =====================================================================
function pageLogin(view, afterHash = '#home') {
  view.innerHTML = `<div class="card login">
    <h2 style="margin-top:0">เข้าสู่ระบบ</h2>
    ${IS_DEMO ? `<div class="banner info">โหมดสาธิต: ชื่อล็อกอิน owner · demo-admin · demo-rec1 · demo2-admin รหัสผ่าน demo</div>` : ''}${S._loginNote ? `<div class="banner warn">${esc(S._loginNote)}</div>` : ''}${!navigator.onLine ? '<div class="banner warn">ไม่มีสัญญาณอินเทอร์เน็ต: ต้องมีสัญญาณจึงเข้าสู่ระบบได้</div>' : ''}
    <label>ชื่อล็อกอิน</label><input id="u" autocomplete="username" autocapitalize="none">
    <label>รหัสผ่าน</label><input id="p" type="password" autocomplete="current-password">
    <div style="margin-top:14px"><button id="btnLogin" style="width:100%">เข้าสู่ระบบ</button></div>
    <p class="muted">ลืมรหัสผ่าน: ติดต่อ admin หรือเจ้าของโครงการเพื่อรีเซ็ต (ระบบไม่มีการส่งอีเมล)</p>
  </div>`;
  const doLogin = async () => {
    const b = $('#btnLogin'); b.disabled = true;
    if (!$('#u').value.trim()) { b.disabled = false; return needField('#u', 'กรอกชื่อล็อกอิน'); }
    if (!$('#p').value) { b.disabled = false; return needField('#p', 'กรอกรหัสผ่าน'); }
    try { S.me = await api.login($('#u').value, $('#p').value); if (!S.me) throw new Error('บัญชีนี้ยังไม่ได้ผูกกับระบบ ให้เจ้าของโครงการตรวจบัญชีในตาราง core.app_user'); if (S.me.status !== 'active') { await api.logout(); S.me = null; throw new Error('บัญชีนี้ถูกปิดใช้งาน ติดต่อ admin เพื่อเปิดใช้งาน'); } S._loginNote = ''; go(afterHash); render(); }
    catch (e) { fail(e, 'เข้าสู่ระบบไม่สำเร็จ'); } finally { b.disabled = false; }
  };
  $('#btnLogin').onclick = doLogin; $('#p').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
}
function pageMe(view) {
  view.innerHTML = `<div class="card"><h3 style="margin-top:0">บัญชีของฉัน</h3>
    <div>${esc(S.me.display_name)} <span class="pill">${roleLabel(S.me.role)}</span></div>
    <div class="muted">ชื่อล็อกอิน ${esc(S.me.username)}${S.me.org_id ? ' · ' + esc(orgOf(S.me.org_id).name || '') : ''}</div>
    <h4>เปลี่ยนรหัสผ่าน</h4>
    <label>รหัสผ่านใหม่ (6–30 ตัว อังกฤษ/ตัวเลข)</label><input id="pw1" type="password"><label>พิมพ์ซ้ำ</label><input id="pw2" type="password">
    <div class="row" style="margin-top:12px"><button onclick="changePw()">บันทึกรหัสผ่าน</button><button class="danger" onclick="logout()">ออกจากระบบ</button></div>
    <p class="muted">${IS_DEMO ? 'โหมดสาธิต' : 'เชื่อมต่อ ' + esc(CONFIG.SUPABASE_URL)} · ระบบหลังบ้าน: ${CONFIG.ENGINE_URL ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า'} · ฉบับ ${esc(CREDIT.updated)}</p></div>`;
}
async function changePw() { const a = $('#pw1').value, b = $('#pw2').value; if (!/^[A-Za-z0-9]{6,30}$/.test(a)) return needField('#pw1', 'รหัสผ่านใหม่ต้องยาว 6–30 ตัว เฉพาะตัวอักษรอังกฤษและตัวเลข'); if (a !== b) return needField('#pw2', 'ช่อง "พิมพ์ซ้ำ" ไม่ตรงกับรหัสผ่านใหม่'); try { await api.changePassword(a); toast('เปลี่ยนรหัสผ่านแล้ว'); } catch (e) { fail(e); } }
async function logout() { await api.logout(); S.me = null; S.cache = {}; S.scopeOrg = null; go('#'); render(); }

// =====================================================================
// หน้าต่าง · ป้ายช่องกรอก · ตารางเรียงได้ · ส่งออก CSV
// =====================================================================
let _lblSeq = 0;
function bindLabels(root) {
  root.querySelectorAll('label:not([for])').forEach(l => {
    if (l.querySelector('input,select,textarea')) return;
    let el = l.nextElementSibling; if (el && !el.matches('input,select,textarea')) el = el.querySelector('input,select,textarea');
    if (!el) return; if (!el.id) el.id = 'fld_' + (++_lblSeq); l.htmlFor = el.id;
  });
}
function openModal(html) { closeModal(); const d = document.createElement('div'); d.className = 'modal-bg'; d.id = 'modal'; d.innerHTML = `<div class="modal">${html}</div>`; d.onclick = e => { if (e.target === d) closeModal(); }; document.body.appendChild(d); bindLabels(d); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
const sortVal = v => { if (v == null) return ''; const t = String(v).trim(); const num = Number(t.replace(/[,\s%]/g, '')); return t !== '' && !isNaN(num) ? num : t; };
const sortCmp = (a, b, dir) => { const x = sortVal(a), y = sortVal(b); let r; if (typeof x === 'number' && typeof y === 'number') r = x - y; else if (x === '' || y === '') r = x === '' ? 1 : -1; else r = String(x).localeCompare(String(y), 'th', { numeric: true }); return dir === 'desc' ? -r : r; };
function makeSortable(root) {
  for (const table of root.querySelectorAll('table')) {
    if (table.dataset.sort || !table.tHead || !table.tBodies[0] || table.tBodies[0].rows.length < 2) continue;
    table.dataset.sort = 'dom';
    for (const th of table.tHead.rows[0].cells) {
      if (!th.textContent.trim() || th.querySelector('button,input')) continue;
      th.classList.add('sortable'); th.setAttribute('role', 'button'); th.tabIndex = 0; th.setAttribute('aria-sort', 'none'); th.title = 'กดเพื่อเรียงตามคอลัมน์นี้';
      th.onclick = () => sortTableDom(table, th); th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortTableDom(table, th); } };
    }
  }
}
function sortTableDom(table, th) {
  const dir = th.getAttribute('aria-sort') === 'ascending' ? 'desc' : 'asc'; const idx = th.cellIndex;
  for (const c of th.parentNode.cells) c.setAttribute('aria-sort', c === th ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const body = table.tBodies[0]; const rows = [...body.rows].filter(r => !(r.cells.length === 1 && r.cells[0].colSpan > 1));
  const key = r => { const c = r.cells[idx]; return c ? (c.dataset.sortValue ?? c.textContent) : ''; };
  rows.sort((a, b) => sortCmp(key(a), key(b), dir)).forEach(r => body.appendChild(r));
}
// ---- ตารางแบ่งหน้า 20 รายการ (เปลี่ยนหน้า/เรียง เฉพาะตาราง ไม่โหลดทั้งหน้า) ----
//   pagedTable(id, rows, cols, rowFn)  cols: [{ label, key, cls }]  rowFn(r) → '<tr>…</tr>'
const Pager = { st: {}, data: {}, SIZE: 20 };
function pagedTable(id, rows, cols, rowFn, opts = {}) {
  Pager.data[id] = { rows, cols, rowFn, opts };
  const st = Pager.st[id] = Pager.st[id] || { page: 0, sort: null };
  if (opts.resetPage) st.page = 0;
  return `<div id="${id}" class="pgtbl">${pagedInner(id)}</div>`;
}
function pagedInner(id) {
  const { rows, cols, rowFn, opts } = Pager.data[id]; const st = Pager.st[id]; const size = opts.size || Pager.SIZE;
  let list = rows;
  if (st.sort) list = [...rows].sort((a, b) => sortCmp(a[st.sort.key], b[st.sort.key], st.sort.dir));
  const pages = Math.max(1, Math.ceil(list.length / size)); st.page = Math.min(Math.max(0, st.page), pages - 1);
  const slice = list.slice(st.page * size, (st.page + 1) * size);
  const head = cols.map(c => c.key ? `<th class="sortable ${c.cls || ''}" role="button" tabindex="0" title="กดเพื่อเรียงตามคอลัมน์นี้" aria-sort="${st.sort && st.sort.key === c.key ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}" onclick="pageSort('${id}','${c.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pageSort('${id}','${c.key}')}">${c.label}</th>` : `<th class="${c.cls || ''}">${c.label}</th>`).join('');
  const pager = list.length ? `<div class="row" style="justify-content:center;margin-top:8px"><button type="button" class="small secondary" ${st.page === 0 ? 'disabled' : ''} onclick="pageTo('${id}',${st.page - 1})">‹ ก่อนหน้า</button><span class="muted">หน้า ${st.page + 1}/${pages} · ${fmtInt(list.length)} รายการ</span><button type="button" class="small secondary" ${st.page >= pages - 1 ? 'disabled' : ''} onclick="pageTo('${id}',${st.page + 1})">ถัดไป ›</button></div>` : '';
  return `<div style="overflow:auto"><table data-sort="data"><thead><tr>${head}</tr></thead><tbody>${slice.map(rowFn).join('') || `<tr><td colspan="${cols.length}" class="muted">${opts.empty || 'ยังไม่มีข้อมูล'}</td></tr>`}</tbody></table></div>${pager}`;
}
function pageTo(id, n) { Pager.st[id].page = n; const el = document.getElementById(id); if (el) { el.innerHTML = pagedInner(id); el.scrollIntoView({ block: 'nearest' }); } }
function pageSort(id, key) { const st = Pager.st[id]; st.sort = { key, dir: st.sort && st.sort.key === key && st.sort.dir === 'asc' ? 'desc' : 'asc' }; st.page = 0; const el = document.getElementById(id); if (el) el.innerHTML = pagedInner(id); }

function exportCsv(rows, name) {
  if (!rows || !rows.length) return toast('ไม่มีข้อมูลให้ส่งออก', true);
  const cols = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
  const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${name}_${todayISO()}.csv`; a.click();
}

// =====================================================================
// ตาราง + ฟอร์มจัดการข้อมูลทั่วไป (ฟาร์ม แหล่งกำเนิดเศษอาหาร รถ โครงการ ...) — spec ใน SPECS ของโมดูล
//   col: { key, label, type: text|number|select|status|textarea|latlng, required, nullable, options: () => [{value,label}], hide, readonly }
// =====================================================================
const SPECS = {};
function crudState(table, patch) { Object.assign(S._crud[table], patch); render(); }
function crudSort(table, key) { const st = S._crud[table]; const dir = st.sort && st.sort.key === key && st.sort.dir === 'asc' ? 'desc' : 'asc'; crudState(table, { sort: { key, dir }, page: 0 }); }
// =====================================================================
// คาร์บอน (DEC-113) — ใช้ร่วมกันระหว่างแดชบอร์ดผู้ล็อกอินและหน้าสาธารณะ
//   ขนส่ง = ลิตร × EF เชื้อเพลิง · ฝังกลบที่หลีกเลี่ยงได้ = กก. × EF ฝังกลบ · สุทธิ = หลีกเลี่ยง − ขนส่ง (และแบบหักการเลี้ยงหนอน)
// =====================================================================
// DEC-114 ชื่อตามหน้าปั๊มในไทย · ลำดับ = ลำดับในช่องเลือก (ดีเซล B7 เป็นค่าเริ่มต้น)
const FUEL_LABELS = { diesel_b7: 'ดีเซล B7 (ดีเซลหมุนเร็วทั่วไปหน้าปั๊ม)', diesel_b7_premium: 'ดีเซลพรีเมียม B7', diesel_b20: 'ดีเซล B20', diesel: 'ดีเซลไม่ผสมไบโอดีเซล (B0)', gasoline: 'เบนซิน 95 (ไม่ผสมเอทานอล)', gasohol_e10: 'แก๊สโซฮอล์ 95 (E10)', gasohol_91: 'แก๊สโซฮอล์ 91 (E10)', gasohol_e20: 'แก๊สโซฮอล์ E20', gasohol_e85: 'แก๊สโซฮอล์ E85', lpg: 'LPG', cng: 'CNG/NGV', electric: 'ไฟฟ้า' };
const DEFAULT_FUEL = 'diesel_b7';
const VEHICLE_TYPES = { pickup: 'รถกระบะ', truck6: 'รถบรรทุก 6 ล้อ', compactor: 'รถอัดท้าย', van: 'รถตู้', tricycle: 'รถสามล้อ', motorcycle: 'รถจักรยานยนต์พ่วง', other: 'อื่น ๆ' };
const CARBON_CATS = { fuel: 'เชื้อเพลิงรถ', landfill: 'ฝังกลบเศษอาหาร (หลีกเลี่ยงได้)', process: 'กระบวนการเลี้ยงหนอน (หักออก)', fuel_economy: 'อัตราสิ้นเปลือง (สมมติฐาน)' };
const fmt2 = n => (n == null || n === '' || isNaN(Number(n)) ? '-' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const CARBON_KEYS = ['pickups', 'kg', 'km', 'liters', 'e_transport', 'e_avoided', 'e_process', 'e_net', 'e_net_after_process', 't_fixed', 't_km_ef_assumed', 'pickups_estimated', 'pickups_no_distance'];
// รวมแถวต่อรอบ (v_pickup_carbon) เป็นกลุ่ม · แถวสาธารณะ (v_public_carbon) รวมไว้แล้ว
function carbonGroup(rows, keyFn, labelFn) {
  const m = {};
  for (const r of rows) {
    const k = keyFn(r); const g = m[k] = m[k] || { label: labelFn(r), first: null, last: null, ...Object.fromEntries(CARBON_KEYS.map(x => [x, 0])) };
    if ('pickup_id' in r) { g.pickups++; g.kg += +r.kg || 0; g.km += +r.km || 0; g.liters += +r.liters || 0; g.e_transport += +r.e_transport || 0; g.e_avoided += +r.e_avoided || 0; g.e_process += +r.e_process || 0; g.e_net += +r.e_net || 0; g.e_net_after_process += +r.e_net_after_process || 0; g.t_fixed += +r.t_fixed || 0; g.t_km_ef_assumed += +r.t_km_ef_assumed || 0; if (r.is_estimated) g.pickups_estimated++; if (r.km_source === 'none') g.pickups_no_distance++; const d = r.pickup_date; if (d) { if (!g.first || d < g.first) g.first = d; if (!g.last || d > g.last) g.last = d; } }
    else { for (const x of CARBON_KEYS) g[x] += +r[x] || 0; if (r.first_date && (!g.first || r.first_date < g.first)) g.first = r.first_date; if (r.last_date && (!g.last || r.last_date > g.last)) g.last = r.last_date; }
  }
  return Object.values(m).sort((a, b) => b.kg - a.kg);
}
// groups: กลุ่มฟาร์ม/เส้นทาง · factors: ค่าสัมประสิทธิ์ที่ใช้งาน · sources: [{name, kg}] · monthly: กลุ่มรายเดือน (ไม่บังคับ)
function carbonReport({ groups, factors, sources = [], monthly = null, groupTitle = 'รายฟาร์มและเส้นทาง', firstCol = 'ฟาร์ม · เส้นทาง' }) {
  const T = carbonGroup(groups, () => 'all', () => 'รวม')[0] || { label: 'รวม', ...Object.fromEntries(CARBON_KEYS.map(x => [x, 0])) };
  const prim = c => factors.find(f => f.category === c && f.is_primary) || null;
  const lf = prim('landfill'), pr = prim('process'), fe = prim('fuel_economy');
  const byCat = c => factors.filter(f => f.category === c).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const cite = f => f ? `${esc(f.code)} = ${fmt(f.value, 4)} ${esc(f.unit)}` : '<span style="color:var(--danger)">ยังไม่ได้เลือกค่าหลัก</span>';
  const badge = f => `${f.is_primary ? '<span class="pill">ค่าหลัก</span> ' : ''}${f.verified ? '<span class="pill" style="background:#dcfce7">ยืนยันจากต้นฉบับ</span>' : '<span class="pill" style="background:#fef3c7">ยังไม่ยืนยัน / สมมติฐาน</span>'}`;
  const row = g => `<tr><td>${esc(g.label)}</td><td class="num">${fmtInt(g.pickups)}</td><td class="num">${fmt2(g.kg)}</td><td class="num">${g.km ? fmt2(g.km) : '-'}</td><td class="num">${g.liters ? fmt2(g.liters) : '-'}</td><td class="num">${fmt2(g.e_transport)}</td><td class="num">${fmt2(g.e_avoided)}</td><td class="num"><b>${fmt2(g.e_net)}</b></td><td class="num">${fmt2(g.e_net_after_process)}</td><td class="num">${g.pickups_no_distance ? `<span style="color:var(--danger)">${fmtInt(g.pickups_no_distance)}</span>` : 0} / ${fmtInt(g.pickups_estimated)}</td></tr>`;
  const head = first => `<thead><tr><th>${first}</th><th class="num">รอบ</th><th class="num">เศษอาหาร (กก.)</th><th class="num">ระยะทาง (กม.)</th><th class="num">เชื้อเพลิง (ลิตร)</th><th class="num">ขนส่ง</th><th class="num">หลีกเลี่ยงการฝังกลบ</th><th class="num">สุทธิ</th><th class="num">สุทธิ หักเลี้ยงหนอน</th><th class="num" title="รอบที่ไม่มีระยะทาง / รอบที่ใช้ค่าประมาณ">ไม่มีระยะ/ประมาณ</th></tr></thead>`;
  const kmpls = byCat('fuel_economy').map(f => +f.value).filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b);
  const sens = byCat('landfill').map(f => { const av = T.kg * f.value; return `<tr><td>${esc(f.name)}<div class="muted">${esc(f.code)} · ${fmt(f.value, 4)} ${esc(f.unit)} ${f.verified ? '' : '· ยังไม่ยืนยัน'}</div>${f.note ? `<div class="muted" style="color:#92400e">${esc(f.note)}</div>` : ''}</td><td class="num">${fmt2(av)}</td>${kmpls.map(k => { const tr = T.t_fixed + T.t_km_ef_assumed / k; return `<td class="num"><b>${fmt2(av - tr)}</b><div class="muted">หักหนอน ${fmt2(av - tr - (pr ? T.kg * pr.value : 0))}</div></td>`; }).join('')}</tr>`; }).join('');
  const srcRows = sources.filter(s => +s.kg > 0).sort((a, b) => b.kg - a.kg).map(s => `<tr><td>${esc(s.name)}</td><td class="num">${fmt2(s.kg)}</td><td class="num">${lf ? fmt2(s.kg * lf.value) : '-'}</td><td class="num">${pr ? fmt2(s.kg * pr.value) : '-'}</td><td class="num">${lf ? fmt2(s.kg * lf.value - (pr ? s.kg * pr.value : 0)) : '-'}</td></tr>`).join('');
  const facTable = Object.keys(CARBON_CATS).map(c => byCat(c).length ? `<tr><th colspan="4" style="background:#f8fafc">${esc(CARBON_CATS[c])}</th></tr>` + byCat(c).map(f => `<tr><td>${esc(f.name)}<div>${badge(f)}</div>${f.fuel_code ? `<div class="muted">${esc(FUEL_LABELS[f.fuel_code] || f.fuel_code)}</div>` : ''}</td><td class="num nowrap">${fmt(f.value, 4)}<div class="muted">${esc(f.unit)}</div></td><td>${esc(f.method || '')}${f.note ? `<div class="muted">หมายเหตุ: ${esc(f.note)}</div>` : ''}</td><td>${esc(f.source)}${f.source_detail ? `<div class="muted">${esc(f.source_detail)}</div>` : ''}${f.source_url ? `<div><a href="${esc(f.source_url)}" target="_blank" rel="noopener">เปิดแหล่งอ้างอิง</a></div>` : ''}</td></tr>`).join('') : '').join('');
  const period = T.first ? `${thDay(T.first)} – ${thDay(T.last)}` : '-';
  return `<div class="card"><div class="cardhead"><h4>การลดก๊าซเรือนกระจกจากการนำเศษอาหารมาเลี้ยงหนอน BSF (kgCO2e)</h4></div>
    <div class="muted">ช่วงข้อมูล ${period} · ${fmtInt(T.pickups)} รอบ · ตัวเลขทศนิยม 2 ตำแหน่ง · 1,000 kgCO2e = 1 tCO2e</div>
    <div class="kpis" style="margin-top:8px"><div class="kpi hero"><div class="l">ลดการปล่อยสุทธิ (ไม่หักการเลี้ยงหนอน)</div><div class="v">${fmt2(T.e_net)}</div></div><div class="kpi"><div class="l">หลีกเลี่ยงการฝังกลบ</div><div class="v">${fmt2(T.e_avoided)}</div></div><div class="kpi"><div class="l">ปล่อยจากการขนส่ง</div><div class="v">${fmt2(T.e_transport)}</div></div><div class="kpi"><div class="l">สุทธิ หักการเลี้ยงหนอน</div><div class="v">${fmt2(T.e_net_after_process)}</div></div><div class="kpi"><div class="l">เศษอาหารที่นำมาใช้ (กก.)</div><div class="v">${fmt2(T.kg)}</div></div></div>
    <div class="banner" style="margin-top:8px"><b>วิธีคิด</b> · หลีกเลี่ยงการฝังกลบ = กก. × ${cite(lf)} · ขนส่ง = ลิตร × EF เชื้อเพลิงของรถ (ลิตร = ลิตรจริง หรือ กม. ÷ กม./ลิตร) · สุทธิ = หลีกเลี่ยง − ขนส่ง · หักการเลี้ยงหนอน = กก. × ${cite(pr)}${pr && !String(pr.code).includes('LESS') ? ' <b>(ค่าอ้างอิงจากงานวิจัยต่างประเทศ)</b>' : ''}</div>
    ${T.pickups_no_distance ? `<div class="banner warn" style="margin-top:8px">${fmtInt(T.pickups_no_distance)} จาก ${fmtInt(T.pickups)} รอบยังไม่มีระยะทาง (ฟาร์มยังไม่มี "เส้นทางหลัก" และรอบไม่ได้ระบุเส้นทาง/กม./ลิตร) ค่าขนส่งของรอบเหล่านี้จึงเป็น 0 — ตัวเลขสุทธิสูงกว่าความจริง · admin กำหนดได้ที่ จัดการ → ฟาร์ม → เส้นทางหลัก</div>` : ''}
    ${T.pickups_estimated ? `<div class="muted" style="margin-top:6px">${fmtInt(T.pickups_estimated)} รอบใช้ค่าประมาณ (ระยะทางจากเส้นทางหลักของฟาร์ม หรือรถที่ยังไม่ระบุ กม./ลิตร ใช้ค่าสมมติ ${fe ? fmt(fe.value) + ' ' + esc(fe.unit) : '-'})</div>` : ''}</div>
    <div class="card"><div class="cardhead"><h4>${esc(groupTitle)}</h4></div><div class="tscroll"><table>${head(esc(firstCol))}<tbody>${groups.length ? carbonGroup(groups, g => g._key || g.label, g => g._label || g.label).map(row).join('') : '<tr><td colspan="10" class="muted">ยังไม่มีข้อมูล</td></tr>'}${row({ ...T, label: 'รวม' }).replace('<tr>', '<tr style="font-weight:600;background:#f8fafc">')}</tbody></table></div></div>
    ${monthly ? `<div class="card"><div class="cardhead"><h4>รายเดือน</h4></div><div class="tscroll"><table>${head('เดือน')}<tbody>${monthly.map(row).join('')}</tbody></table></div></div>` : ''}
    <div class="card"><div class="cardhead"><h4>รายแหล่งกำเนิดเศษอาหาร (ฝังกลบที่หลีกเลี่ยงได้)</h4></div><div class="muted">ค่าขนส่งไม่แบ่งลงรายแหล่ง (คิดรายเส้นทาง) · ใช้ค่าหลัก ${cite(lf)}</div><div class="tscroll"><table><thead><tr><th>แหล่งกำเนิดเศษอาหาร</th><th class="num">กก.</th><th class="num">หลีกเลี่ยงการฝังกลบ</th><th class="num">หักเลี้ยงหนอน</th><th class="num">หลีกเลี่ยง − หักหนอน</th></tr></thead><tbody>${srcRows || '<tr><td colspan="5" class="muted">ยังไม่มีข้อมูล</td></tr>'}</tbody></table></div></div>
    <div class="card"><div class="cardhead"><h4>เทียบวิธีคำนวณ (ความอ่อนไหวของผล)</h4></div><div class="muted">ผลสุทธิเมื่อเปลี่ยนค่าฝังกลบ (แถว) และอัตราสิ้นเปลืองของรถที่ยังไม่ระบุ กม./ลิตร (คอลัมน์) · รถที่ระบุ กม./ลิตร หรือกรอกลิตรจริง ไม่เปลี่ยน · ตัวเลขล่าง = หักการเลี้ยงหนอนด้วยค่าหลัก</div>
      <div class="tscroll"><table><thead><tr><th>ค่าฝังกลบ</th><th class="num">หลีกเลี่ยงการฝังกลบ</th>${kmpls.map(k => `<th class="num">สุทธิ @ ${fmt(k)} กม./ลิตร</th>`).join('')}</tr></thead><tbody>${sens}</tbody></table></div></div>
    <div class="card"><div class="cardhead"><h4>ค่าสัมประสิทธิ์และแหล่งอ้างอิง</h4></div><div class="muted">ทุกค่าแสดงแหล่งที่มา · "ยืนยันจากต้นฉบับ" = เปิดเอกสารต้นฉบับแล้ว · ค่าที่ยังไม่ยืนยันแสดงไว้เพื่อเทียบเคียงเท่านั้น ไม่ใช้เป็นค่าหลัก</div><div class="tscroll"><table><thead><tr><th>รายการ</th><th class="num">ค่า</th><th>วิธีคิด / เหตุผล</th><th>อ้างอิง</th></tr></thead><tbody>${facTable}</tbody></table></div></div>
    <div class="card"><div class="cardhead"><h4>ขอบเขตและสมมติฐาน</h4></div><ol style="margin:0;padding-left:20px">
      <li>ขอบเขต: (1) การขนส่ง จากจุดเริ่มต้นของเส้นทาง → แหล่งกำเนิดเศษอาหาร → ฟาร์ม (รวมขากลับเมื่อเส้นทางตั้งเป็นไป–กลับ) · (2) การฝังกลบที่หลีกเลี่ยงได้ เมื่อเศษอาหารที่รับมาถูกนำไปเลี้ยงหนอนแทนการนำไปฝังกลบรวมกับขยะอื่น</li>
      <li>ระยะทาง: ลิตรที่ใช้จริง &gt; กม. ที่บันทึกในรอบ &gt; เส้นทางที่เลือกในรอบ &gt; เส้นทางหลักของฟาร์ม (ประมาณ) · ระยะทางของเส้นทางคำนวณตามถนนจริง (OSRM)</li>
      <li>ทุกเที่ยวคิดเต็มเส้นทาง ทั้งรถของฟาร์มและรถรับจ้าง ใช้หลักเดียวกัน (ประเภทรถ เชื้อเพลิง กม./ลิตร)</li>
      <li>รถที่ยังไม่ระบุ กม./ลิตร ใช้ค่าสมมติ ${fe ? fmt(fe.value) : '-'} กม./ลิตร (ตารางเทียบแสดงผลที่ค่าอื่น) · รถที่ไม่ระบุเชื้อเพลิง ใช้ค่าตั้งต้นของระบบ</li>
      <li>ค่าการปล่อยจากการเลี้ยงหนอนในไทยยังไม่มี · ${pr ? `ค่าที่ใช้หัก: ${esc(pr.source)}${pr.note ? ' — ' + esc(pr.note) : ''}` : '-'} · วิธี LESS-WM-07 ของ อบก. ไม่คิดการปล่อยของหนอนแมลงวันลาย (= 0) จึงแสดงทั้งแบบหักและไม่หัก</li>
      <li>ค่าฝังกลบหลัก ${lf ? esc(lf.code) + ' ' + fmt(lf.value, 4) : '-'} เป็นกรณีหลุมฝังกลบไม่มีระบบจัดการ ลึกกว่า 5 เมตร (ตาม อบก.) · บ่อที่ถูกหลักสุขาภิบาลอาจให้ค่าต่างออกไป ดูตารางเทียบวิธีคำนวณ</li>
      <li>ไม่รวมการปล่อยจากการแปรรูปผลผลิต การใช้ไฟฟ้าในฟาร์ม และประโยชน์จากการทดแทนอาหารสัตว์/ปุ๋ย</li></ol></div>`;
}
async function crudSection(spec) {
  const rows = await api.list(spec.table, { eq: spec.eq || {}, order: spec.order || [spec.cols[0].key] });
  spec._rows = rows; if (SPECS[spec.table]) SPECS[spec.table]._rows = rows;   // crudForm อ่านจาก SPECS[table] แม้หน้าจะส่ง spec สำเนาเข้ามา (MIS-018)
  const id = 'sec_' + spec.table.replace('.', '_');
  const st = S._crud[spec.table] = S._crud[spec.table] || { page: 0, size: 20, q: '' };
  const keys = spec.searchKeys || spec.cols.filter(c => !c.type || c.type === 'textarea').map(c => c.key);
  const q = (st.q || '').trim().toLowerCase();
  let filtered = q ? rows.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q))) : rows;
  if (st.sort) { const c = spec.cols.find(x => x.key === st.sort.key); const lab = c && c.type === 'select' ? (r => (c.options().find(o => o.value === r[c.key]) || {}).label || '') : (r => r[st.sort.key]); filtered = [...filtered].sort((a, b) => sortCmp(lab(a), lab(b), st.sort.dir)); }
  const pages = Math.max(1, Math.ceil(filtered.length / st.size)); st.page = Math.min(st.page, pages - 1);
  const slice = filtered.slice(st.page * st.size, (st.page + 1) * st.size);
  const cell = (r, c) => c.type === 'select' ? esc((c.options().find(o => o.value === r[c.key]) || {}).label || (r[c.key] == null && c.nullLabel ? c.nullLabel : '')) : c.type === 'status' ? (r[c.key] === 'active' ? '<span class="pill">ใช้งาน</span>' : '<span class="pill" style="background:#fee2e2">ปิด</span>') : c.type === 'bool' ? (r[c.key] ? 'ใช่' : 'ไม่') : c.type === 'latlng' ? (r.lat != null ? `${r.lat}, ${r.lng}` : '<span class="muted">ยังไม่มี</span>') : esc(r[c.key] ?? '');
  return `<div class="card" id="${id}"><div class="row" style="justify-content:space-between"><h4 style="margin:0">${spec.title} (${fmtInt(rows.length)})${spec.help ? ' ' + helpBtn(spec.help) : ''}</h4><div class="row">${spec.extraBtn || ''}${spec.noAdd ? '' : `<button class="small" onclick="crudForm('${spec.table}')">＋ เพิ่ม</button>`}</div></div>
    ${spec.intro ? `<div class="muted" style="margin:4px 0 8px">${spec.intro}</div>` : ''}
    ${rows.length > 10 ? `<div class="row" style="margin:6px 0"><input type="search" aria-label="ค้นหาใน${esc(spec.title)}" placeholder="ค้นหา…" value="${esc(st.q || '')}" style="flex:1;min-width:160px" onchange="crudState('${spec.table}',{q:this.value,page:0})"></div>` : ''}
    <div style="overflow:auto"><table data-sort="data"><thead><tr>${spec.cols.filter(c => !c.hide).map(c => `<th class="sortable" role="button" tabindex="0" aria-sort="${st.sort && st.sort.key === c.key ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}" onclick="crudSort('${spec.table}','${c.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();crudSort('${spec.table}','${c.key}')}">${c.label}</th>`).join('')}<th></th></tr></thead><tbody>${slice.map(r => `<tr>${spec.cols.filter(c => !c.hide).map(c => `<td>${cell(r, c)}</td>`).join('')}<td style="white-space:nowrap"><button class="small secondary" onclick="crudForm('${spec.table}','${r.id || r.key}')">แก้</button>${spec.rowBtns ? spec.rowBtns(r) : ''}</td></tr>`).join('') || `<tr><td colspan="${spec.cols.length + 1}" class="muted">${q ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}</td></tr>`}</tbody></table></div>
    ${filtered.length > st.size ? `<div class="row" style="justify-content:center;margin-top:8px"><button class="small secondary" ${st.page === 0 ? 'disabled' : ''} onclick="crudState('${spec.table}',{page:${st.page - 1}})">‹ ก่อนหน้า</button><span class="muted">หน้า ${st.page + 1}/${pages} · ${fmtInt(filtered.length)} รายการ</span><button class="small secondary" ${st.page >= pages - 1 ? 'disabled' : ''} onclick="crudState('${spec.table}',{page:${st.page + 1}})">ถัดไป ›</button></div>` : ''}</div>`;
}
function crudForm(table, id) {
  const spec = SPECS[table]; const r = id ? spec._rows.find(x => (x.id || x.key) === id) : (spec.prefill ? spec.prefill() : {});
  const field = c => {
    if (c.type === 'select') return `<select id="c_${c.key}">${(c.nullable ? `<option value="">${esc(c.nullLabel || '—')}</option>` : '') + c.options().map(o => `<option value="${o.value}" ${o.value === r[c.key] ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    if (c.type === 'status') return `<select id="c_${c.key}"><option value="active" ${r[c.key] !== 'inactive' ? 'selected' : ''}>ใช้งาน</option><option value="inactive" ${r[c.key] === 'inactive' ? 'selected' : ''}>ปิดใช้งาน</option></select>`;
    if (c.type === 'bool') return `<select id="c_${c.key}"><option value="true" ${r[c.key] !== false ? 'selected' : ''}>ใช่</option><option value="false" ${r[c.key] === false ? 'selected' : ''}>ไม่</option></select>`;
    if (c.type === 'textarea') return `<textarea id="c_${c.key}" rows="2">${esc(r[c.key] ?? '')}</textarea>`;
    if (c.type === 'latlng') return latlngField(r.lat, r.lng, 'c_');
    return `<input id="c_${c.key}" type="${c.type === 'number' ? 'number' : 'text'}" ${c.type === 'number' ? 'step="any"' : 'maxlength="200"'} value="${esc(r[c.key] ?? '')}" ${c.readonly && id ? 'readonly' : ''}>`;
  };
  openModal(`<h3 style="margin-top:0">${id ? 'แก้ไข' : 'เพิ่ม'} ${spec.title}</h3>${spec.cols.filter(c => !(c.readonly && id) && !(c.onlyEdit && !id) && !c.noForm).map(c => `<label>${c.label}${c.required ? ' *' : ''}</label>` + field(c)).join('')}
    <div class="row" style="margin-top:12px"><button id="c_save">บันทึก</button><button class="secondary" onclick="closeModal()">ยกเลิก</button></div>`);
  $('#c_save').onclick = async () => {
    const patch = {};
    for (const c of spec.cols) {
      if (c.type === 'latlng') { const la = $('#c_lat'), ln = $('#c_lng'); if (!la) continue; const a = la.value === '' ? null : parseFloat(la.value), b = ln.value === '' ? null : parseFloat(ln.value); if ((a == null) !== (b == null)) return needField(a == null ? la : ln, 'กรอกพิกัดให้ครบทั้งละติจูดและลองจิจูด หรือเว้นว่างทั้งคู่'); patch.lat = a; patch.lng = b; continue; }
      const el = $('#c_' + c.key); if (!el) continue; let v = el.value;
      if (c.type === 'number') v = v === '' ? null : parseFloat(v);
      if (c.type === 'bool') v = v === 'true';
      if (v === '' && (c.nullable || c.type === 'select')) v = null;
      if (c.required && (v == null || v === '')) return needField(el, (c.type === 'select' ? 'เลือก "' : 'กรอก "') + c.label + '" ก่อนบันทึก');
      if (c.type === 'number' && v != null && isNaN(v)) return needField(el, '"' + c.label + '" ต้องเป็นตัวเลข');
      patch[c.key] = v;
    }
    if (spec.beforeSave) { const err = spec.beforeSave(patch, r); if (err) return toastErr('ยังบันทึกไม่ได้', err); }
    const b = $('#c_save'); b.disabled = true;
    try { if (id) await api.update(spec.table, r[spec.pk || 'id'], patch, spec.pk || 'id'); else await api.insert(spec.table, { ...(spec.defaults ? spec.defaults() : {}), ...patch }); closeModal(); toast('บันทึกแล้ว'); S.cache = {}; render(); } catch (e) { fail(e, (id ? 'แก้ไข' : 'เพิ่ม') + spec.title + 'ไม่สำเร็จ'); b.disabled = false; }
  };
}
// ---- พิกัด: รับ "15.240311, 104.823275" · ลิงก์ Google Maps เต็ม · ลิงก์ย่อ maps.app.goo.gl (แกะผ่านระบบหลังบ้าน) ----
function parseLatLng(text) {
  const t = String(text || '').trim(); if (!t) return null;
  const ok = (a, b) => (isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) ? { lat: +(+a).toFixed(6), lng: +(+b).toFixed(6) } : null;
  let m;
  if ((m = t.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/))) return ok(m[1], m[2]);          // ลิงก์เต็มแบบ /place/...!3dLAT!4dLNG
  if ((m = t.match(/[@/](-?\d+\.\d+),(-?\d+\.\d+)/))) return ok(m[1], m[2]);                // .../@LAT,LNG,17z
  if ((m = t.match(/[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i))) return ok(m[1], m[2]);   // ?q=LAT,LNG
  if ((m = t.match(/^\s*(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)\s*$/))) return ok(m[1], m[2]);         // "LAT, LNG"
  return null;
}
async function applyLatLng(srcSel, latSel, lngSel) {
  const raw = $(srcSel).value.trim(); if (!raw) return toastErr('ยังไม่ได้วาง', 'วางตัวเลขพิกัด เช่น 15.240311, 104.823275 หรือวางลิงก์จาก Google Maps');
  let p = parseLatLng(raw);
  if (!p && /^https?:\/\//i.test(raw)) {
    toast('กำลังแกะลิงก์…');
    try { const r = await api.engine('resolve_link', { url: raw }); p = parseLatLng(r.url); if (!p) throw new Error('ลิงก์นี้ไม่มีพิกัด (ลองเปิดลิงก์ในเบราว์เซอร์ แล้วคัดลอกตัวเลขพิกัดจากช่องค้นหาแทน)'); }
    catch (e) { return fail(e, 'แกะลิงก์ไม่สำเร็จ'); }
  }
  if (!p) return toastErr('อ่านพิกัดไม่ได้', 'รูปแบบที่รับได้: "15.240311, 104.823275" · ลิงก์ Google Maps (เต็มหรือย่อ) · ใน Google Maps: กดค้างที่จุด → ตัวเลขพิกัดจะขึ้นด้านบน → แตะเพื่อคัดลอก');
  $(latSel).value = p.lat; $(lngSel).value = p.lng; toast(`ได้พิกัด ${p.lat}, ${p.lng}`);
}
const latlngField = (lat, lng, pre = 'c_') => `<div class="row"><input id="${pre}src" placeholder="วางพิกัด 15.240311, 104.823275 หรือลิงก์ Google Maps" style="flex:1;min-width:220px" onkeydown="if(event.key==='Enter'){event.preventDefault();applyLatLng('#${pre}src','#${pre}lat','#${pre}lng')}"><button type="button" class="small secondary" onclick="applyLatLng('#${pre}src','#${pre}lat','#${pre}lng')">ใช้ค่านี้</button><button type="button" class="small secondary" onclick="fillGps('#${pre}lat','#${pre}lng')">ใช้ GPS</button></div>
  <div class="row" style="margin-top:6px"><input id="${pre}lat" type="number" step="any" placeholder="ละติจูด" value="${esc(lat ?? '')}" style="flex:1"><input id="${pre}lng" type="number" step="any" placeholder="ลองจิจูด" value="${esc(lng ?? '')}" style="flex:1"></div>
  <div class="muted">ใน Google Maps: กดค้างที่จุด → ตัวเลขพิกัดขึ้นด้านบน → คัดลอกมาวางทั้งก้อน หรือกด "แชร์" แล้ววางลิงก์ · หรือยืนที่จุดนั้นแล้วกด "ใช้ GPS"</div>`;
function fillGps(latSel = '#c_lat', lngSel = '#c_lng') {
  if (!navigator.geolocation) return toastErr('เครื่องนี้ไม่รองรับ GPS', 'พิมพ์พิกัดเองจากแอปแผนที่');
  toast('กำลังอ่านตำแหน่ง…');
  navigator.geolocation.getCurrentPosition(p => { $(latSel).value = p.coords.latitude.toFixed(6); $(lngSel).value = p.coords.longitude.toFixed(6); toast(`ได้พิกัดแล้ว (±${Math.round(p.coords.accuracy)} ม.)`); }, err => toastErr('อ่านตำแหน่ง GPS ไม่ได้', gpsErrorText(err)), { enableHighAccuracy: true, timeout: 15000 });
}

// =====================================================================
// บัญชีผู้ใช้ (ผ่านระบบหลังบ้าน) · ใบส่งมอบ
// =====================================================================
function userForm(orgId) {
  const superRole = isSuper() ? `<label>บทบาท</label><select id="u_role"><option value="recorder">ผู้บันทึก</option><option value="admin">admin</option></select>` : '';
  const code = (orgOf(orgId).code || 'app').toLowerCase();
  const projOpts = S.projects.filter(p => p.org_id === orgId && p.status === 'active').map(p => `<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');
  openModal(`<h3 style="margin-top:0">เพิ่มบัญชี</h3><label>ชื่อล็อกอิน (a-z 0-9 . _ - เช่น ${esc(code)}-rec2)</label><input id="u_name" autocapitalize="none"><label>ชื่อแสดง</label><input id="u_disp" maxlength="200">${superRole}<label>โครงการวิจัยที่สังกัด</label><select id="u_project"><option value="">ทุกโครงการ (ไม่จำกัด)</option>${projOpts}</select><div class="hint">ผู้บันทึกที่สังกัดโครงการ จะเห็นและบันทึกได้เฉพาะฟาร์มของโครงการนั้น · admin เห็นทั้งหมด ค่านี้เป็นค่าเริ่มต้นตัวกรอง</div><label>รหัสผ่าน (ว่าง = สุ่มแบบจำง่าย รหัสองค์กร + เลข 4 หลัก · ตั้งเอง 6–30 ตัว อังกฤษ/ตัวเลข)</label><input id="u_pw" autocapitalize="none" autocomplete="off" maxlength="30">
    <div class="row" style="margin-top:12px"><button id="u_save">สร้างบัญชี</button><button class="secondary" onclick="closeModal()">ยกเลิก</button></div><div class="muted">รหัสผ่านแสดงครั้งเดียว ให้พิมพ์ใบส่งมอบหรือจดส่งต่อผู้ใช้</div>`);
  $('#u_save').onclick = async () => {
    const b = $('#u_save'); b.disabled = true; b.textContent = 'กำลังสร้าง…';
    const reset = () => { b.disabled = false; b.textContent = 'สร้างบัญชี'; };
    const uname = $('#u_name').value.trim().toLowerCase(); if (!uname) { reset(); return needField('#u_name', 'กรอกชื่อล็อกอิน เช่น ' + code + '-rec2'); }
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(uname)) { reset(); return needField('#u_name', 'ชื่อล็อกอินใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว ไม่มีช่องว่างและภาษาไทย'); }
    if (!$('#u_disp').value.trim()) { reset(); return needField('#u_disp', 'กรอกชื่อแสดง (ชื่อ-สกุล หรือชื่อตำแหน่ง)'); }
    const upw = $('#u_pw').value.trim(); if (upw && !/^[A-Za-z0-9]{6,30}$/.test(upw)) { reset(); return needField('#u_pw', 'รหัสผ่านต้องยาว 6–30 ตัว เฉพาะตัวอักษรอังกฤษและตัวเลข หรือเว้นว่าง'); }
    try { const r = await api.engine('create_user', { username: uname, display_name: $('#u_disp').value.trim(), role: isSuper() ? $('#u_role').value : 'recorder', org_id: orgId, password: upw || undefined });
      const pj = $('#u_project').value; if (pj && r.account && r.account.id) { try { await api.update('core.app_user', r.account.id, { project_id: pj }); } catch (e) { toast('สร้างบัญชีแล้ว แต่ผูกโครงการไม่สำเร็จ: ' + friendlyError(e).title + ' (ตั้งได้ที่ปุ่ม "โครงการ" ในตาราง)', true); } }
      showCredentials([r.account], { org: orgOf(orgId).name, code: orgOf(orgId).code }); } catch (e) { fail(e, 'สร้างบัญชีไม่สำเร็จ'); reset(); }
  };
}
async function resetPw(userId, username, role) {
  openModal(`<h3 style="margin-top:0">รีเซ็ตรหัสผ่าน ${esc(username)}</h3>
    <label class="pick-opt"><input type="radio" name="pwMode" value="auto" checked onchange="$('#pwCustomBox').classList.add('hidden')"> <span><b>สุ่มแบบจำง่าย</b> — รหัสองค์กร + ตัวเลข 4 หลัก</span></label>
    <label class="pick-opt"><input type="radio" name="pwMode" value="custom" onchange="$('#pwCustomBox').classList.remove('hidden')"> <span><b>ตั้งเอง</b> — 6–30 ตัว อังกฤษ/ตัวเลข</span></label>
    <div id="pwCustomBox" class="hidden" style="margin-left:30px"><label for="pwCustom">รหัสผ่านใหม่</label><input id="pwCustom" autocapitalize="none" autocomplete="off" maxlength="30"></div>
    <div class="row" style="margin-top:12px"><button id="pwGo">รีเซ็ต</button><button class="secondary" onclick="closeModal()">ยกเลิก</button></div><div class="muted">รหัสเดิมจะใช้ไม่ได้ทันที · รหัสใหม่แสดงครั้งเดียว</div>`);
  $('#pwGo').onclick = async () => {
    const mode = document.querySelector('input[name=pwMode]:checked').value; const custom = mode === 'custom' ? $('#pwCustom').value.trim() : '';
    if (mode === 'custom' && !/^[A-Za-z0-9]{6,30}$/.test(custom)) return needField('#pwCustom', 'รหัสผ่านต้องยาว 6–30 ตัว เฉพาะตัวอักษรอังกฤษและตัวเลข');
    const b = $('#pwGo'); b.disabled = true; b.textContent = 'กำลังรีเซ็ต…';
    try { const r = await api.engine('reset_password', { user_id: userId, password: custom || undefined }); showCredentials([{ username: r.username, password: r.password, role: r.role || role }], { org: orgOf(S.scopeOrg).name, code: orgOf(S.scopeOrg).code }); } catch (e) { fail(e, 'รีเซ็ตรหัสผ่านไม่สำเร็จ'); b.disabled = false; b.textContent = 'รีเซ็ต'; }
  };
}
function showCredentials(accs, ctx = {}) {
  S._lastCreds = { accs, ctx };
  openModal(`<h3 style="margin-top:0">บัญชีที่สร้าง/รีเซ็ต — แสดงครั้งเดียว</h3>${ctx.org ? `<div class="muted">${esc(ctx.org)} (${esc(ctx.code)})</div>` : ''}${accs.map(a => `<div class="card"><div>ชื่อล็อกอิน: <b class="mono">${esc(a.username)}</b></div><div>รหัสผ่าน: <b class="mono">${esc(a.password)}</b></div>${a.role ? `<div class="muted">${roleLabel(a.role)}</div>` : ''}</div>`).join('')}
    <div class="banner warn">กด "พิมพ์ใบส่งมอบ" หรือจดก่อนปิด ระบบจะไม่แสดงรหัสผ่านนี้อีก (ลืม → รีเซ็ตได้) · <b>ห้ามถ่ายภาพหน้านี้ส่งในแชต/ไลน์/อีเมล</b></div><div class="row"><button class="secondary" onclick="printCredentials()">พิมพ์ใบส่งมอบ</button><button onclick="closeModal();S.cache={};render()">ปิด</button></div>`);
}
function printCredentials() {
  const { accs, ctx } = S._lastCreds || { accs: [] }; const sys = setting('system_name') || CONFIG.SYSTEM_NAME;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบส่งมอบบัญชี</title><style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700&display=swap');body{font:15px/1.6 "Noto Sans Thai",system-ui,sans-serif;margin:24px;color:#000}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#eee}.mono{font-family:Consolas,monospace;font-size:16px}ol{padding-left:22px}@media print{button{display:none}}</style></head><body>
    <button onclick="window.print()">พิมพ์ / บันทึก PDF</button><h1>${esc(sys)} — ใบส่งมอบบัญชีผู้ใช้</h1><div>${ctx.org ? `${esc(ctx.org)} (${esc(ctx.code)}) · ` : ''}ออกเมื่อ ${thDate(new Date().toISOString())} · เว็บ: ${esc(CREDIT.url)}</div>
    <table><thead><tr><th>บทบาท</th><th>ชื่อล็อกอิน</th><th>รหัสผ่านตั้งต้น</th><th>มอบให้ (ชื่อ-สกุล)</th><th>ลงชื่อรับ</th></tr></thead><tbody>${accs.map(a => `<tr><td>${roleLabel(a.role || '')}</td><td class="mono">${esc(a.username)}</td><td class="mono">${esc(a.password)}</td><td></td><td></td></tr>`).join('')}</tbody></table>
    <h3>วิธีเริ่มใช้งาน</h3><ol><li>เปิดเว็บด้านบนบนโทรศัพท์ → เลือก "บันทึกการเข้ารับเศษอาหาร" → เข้าสู่ระบบด้วยชื่อและรหัสผ่านในตาราง</li><li>เมนู "บัญชี" มุมขวาบน → เปลี่ยนรหัสผ่านเป็นของตนเอง</li><li>ผู้บันทึก: กดปุ่ม "＋ บันทึกรอบเข้ารับ" → เลือกฟาร์ม วันที่ → กรอกน้ำหนักและคะแนนคัดแยกต่อแหล่งกำเนิดเศษอาหาร → ถ่ายรูป → บันทึก (ไม่มีสัญญาณก็บันทึกได้ ระบบส่งให้เองภายหลัง)</li><li>ลืมรหัสผ่าน: แจ้ง admin ให้กด "รีเซ็ตรหัส"</li></ol>
    <p><b>เอกสารนี้มีรหัสผ่าน</b> เก็บเป็นความลับ ห้ามถ่ายภาพส่งในแชต/ไลน์/อีเมล · ทำลายหลังผู้ใช้เปลี่ยนรหัสผ่านแล้ว</p></body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('เบราว์เซอร์กันหน้าต่างใหม่ กรุณาอนุญาตป๊อปอัป', true); w.document.write(withCredit(html)); w.document.close();
}

// =====================================================================
// รูป: ย่อก่อนส่ง · แสดงรูปที่เปิดไม่ได้
// =====================================================================
async function compressImage(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, CONFIG.PHOTO_MAX_PX / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', CONFIG.PHOTO_QUALITY); URL.revokeObjectURL(img.src);
  return { mime: 'image/jpeg', data: dataUrl.split(',')[1], filename: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' };
}
function photoMissing(img) { const d = document.createElement('div'); d.className = 'photo-missing'; d.innerHTML = '<b>รูปนี้เปิดไม่ได้</b><span>ไฟล์อาจถูกลบหรือปิดแชร์ใน Google Drive</span>'; img.replaceWith(d); }

// =====================================================================
// ช่วยเหลือ (?) — โมดูลกำหนด HELP = { key: { title, steps: [], note } }
// =====================================================================
function helpBtn(key) { return `<button type="button" class="infobtn" aria-label="วิธีใช้" title="วิธีใช้ส่วนนี้" onclick="showHelp('${key}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg></button>`; }
const helpBody = h => `${h.why ? `<div class="muted" style="margin-bottom:6px">${esc(h.why)}</div>` : ''}<ol style="padding-left:22px;margin:6px 0">${(h.steps || []).map(s => `<li style="margin:4px 0">${esc(s)}</li>`).join('')}</ol>${h.done ? `<div class="banner info"><b>เมื่อสำเร็จจะเห็น:</b> ${esc(h.done)}</div>` : ''}${h.note ? `<div class="banner warn">${esc(h.note)}</div>` : ''}`;
function showHelp(key) { const h = (window.HELP || {})[key]; if (!h) return toast('ยังไม่มีคำอธิบายส่วนนี้', true); openModal(`<h3 style="margin-top:0">${esc(h.title)}</h3>${helpBody(h)}<div class="row"><button onclick="closeModal()">ปิด</button></div>`); }

// =====================================================================
// เครดิต · เกี่ยวกับระบบ · เอกสารพิมพ์
// =====================================================================
function renderCredit() { const f = $('#credit'); if (f) f.innerHTML = `${esc(CREDIT.short)} · <a href="#about">เกี่ยวกับระบบ</a>`; }
const PRINT_CREDIT_CSS = '.pgwrap{width:100%;border-collapse:collapse;border:0;margin:0}.pgwrap>thead>tr>td,.pgwrap>tbody>tr>td,.pgwrap>tfoot>tr>td{border:0;padding:0}.pgcredit{margin-top:14px;text-align:center;font-size:9pt;color:#555;border-top:1px solid #ccc;padding-top:3px}@media print{.pgcredit{position:fixed;bottom:0;left:0;right:0;margin:0;background:#fff}}';
function withCredit(doc) {
  const credit = `<div class="pgcredit">${esc(CREDIT.short)} · ${esc(CREDIT.url)}</div>`;
  return doc.replace('</style>', PRINT_CREDIT_CSS + '</style>')
    .replace(/<body([^>]*)>/, '<body$1><table class="pgwrap"><tfoot><tr><td><div style="height:12mm"></div></td></tr></tfoot><tbody><tr><td>')
    .replace(/<\/body>(?![\s\S]*<\/body>)/, '</td></tr></tbody></table>' + credit + '</body>');
}
function pageAbout(view) {
  view.innerHTML = `<div class="card" style="max-width:860px;margin:0 auto">
    <h2 style="margin-top:0">เกี่ยวกับระบบ</h2>
    <p><b>UBRU AppTech System</b> คือระบบบริหารจัดการของศูนย์การเรียนรู้และถ่ายทอดเทคโนโลยี BSF มหาวิทยาลัยราชภัฏอุบลราชธานี โมดูลแรกคือ "บันทึกการเข้ารับเศษอาหาร" ใช้บันทึกปริมาณเศษอาหารที่ฟาร์มเข้ารับจากแหล่งกำเนิดเศษอาหารต่าง ๆ พร้อมคุณภาพการคัดแยก และเผยแพร่ยอดรวมต่อสาธารณะ ใช้งานผ่านเว็บบนมือถือและคอมพิวเตอร์โดยไม่ต้องติดตั้งโปรแกรม</p>
    <h3>โครงการวิจัยที่เกี่ยวข้อง</h3>
    <p>ข้อมูลส่วนแรกมาจากโครงการ "การจัดการขยะอาหารอย่างครบวงจร" (บพท. ปี 2568) และต่อยอดสู่ศูนย์การเรียนรู้และถ่ายทอดเทคโนโลยี BSF ปี 2569</p>
    <h3>การพัฒนา</h3>
    <p>ออกแบบและเขียนโค้ดร่วมกับ Claude (Anthropic) ผ่าน Claude Code โดยเจ้าของโครงการเป็นผู้กำหนดความต้องการ ตัดสินใจ ตรวจสอบตัวเลขกับข้อมูลจริง และตรวจรับทุกขั้นตอน</p>
    <h3>ข้อมูลและบริการที่ใช้</h3>
    <p>แผนที่ © OpenStreetMap contributors (ODbL) · ภาพดาวเทียม Esri · ฐานข้อมูล Supabase · ระบบหลังบ้าน Google Apps Script · ที่เก็บรูป Google Drive · โฮสติ้ง GitHub Pages · ฟอนต์ Noto Sans Thai (Google Fonts) · ไลบรารี Leaflet และ Chart.js</p>
    <h3>ติดต่อ</h3>
    <p>ผศ.พัฒนศักดิ์ ปทุมวัน · <a href="mailto:pattanasak.p@ubru.ac.th">pattanasak.p@ubru.ac.th</a></p>
    <p class="muted">ฉบับระบบ: ${esc(CREDIT.updated)}</p>
    <div class="row" style="margin-top:12px"><a class="btn secondary" style="text-decoration:none" href="#">กลับ</a></div></div>`;
}

// =====================================================================
// แผนที่พื้นหลัง (Leaflet) — ใช้เมื่อหน้ามี Leaflet
// =====================================================================
let _tilesOk = null;
async function tilesAvailable() {
  if (_tilesOk !== null) return _tilesOk;
  if (location.protocol === 'file:') return (_tilesOk = false);
  try { const probe = CONFIG.TILES.url.replace('{z}', '1').replace('{x}', '1').replace('{y}', '0'); const r = await fetch(probe, { referrerPolicy: 'origin' }); _tilesOk = r.ok; } catch { _tilesOk = false; }
  return _tilesOk;
}
async function addBaseLayer(map, withSat = true) {
  const opt = t => ({ maxZoom: t.maxZoom || 19, attribution: t.attribution, referrerPolicy: 'origin', tileSize: t.tileSize || 256, zoomOffset: t.zoomOffset || 0 });
  const useMain = !CONFIG.TILES_FALLBACK || await tilesAvailable();
  const t = useMain ? CONFIG.TILES : CONFIG.TILES_FALLBACK;
  const street = L.tileLayer(t.url, opt(t)).addTo(map);
  if (withSat) { const sat = L.tileLayer(CONFIG.TILES_SATELLITE.url, opt(CONFIG.TILES_SATELLITE)); L.control.layers({ 'แผนที่': street, 'ดาวเทียม': sat }, null, { position: 'topright' }).addTo(map); }
}
function fitAll(map, group) { if (group && group.getLayers().length) map.fitBounds(group.getBounds().pad(0.15)); else map.setView([CONFIG.MAP_FALLBACK.lat, CONFIG.MAP_FALLBACK.lng], CONFIG.MAP_FALLBACK.zoom); }

// =====================================================================
// กราฟ (Chart.js) — สีชุดเดียวทั้งระบบ
// =====================================================================
const PALETTE = ['#1F3A5F', '#2E7D32', '#F9A825', '#EF6C00', '#6A1B9A', '#0097A7', '#C62828', '#5D4037', '#455A64', '#7CB342'];
function mkChart(el, cfg) { const c = new Chart(el, cfg); S.charts.push(c); el.setAttribute('role', 'img'); return c; }
function destroyCharts() { S.charts.forEach(c => c.destroy()); S.charts = []; }
const hbar = (label, value, max, color, right, href) => `<div class="hbar"><div class="hbar-l">${href ? `<a href="${href}">${label}</a>` : label}</div><div class="hbar-track"><div class="hbar-fill" style="width:${max > 0 ? Math.max(1, 100 * value / max) : 0}%;background:${color}"></div></div><div class="hbar-r">${right}</div></div>`;
