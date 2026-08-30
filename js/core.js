/* ================= DATA LAYER ================= */
// LS (get/set) sekarang disediakan oleh js/db.js (SQLite), bukan localStorage
// lagi. Definisi lama dihapus di sini supaya tidak menimpa LS dari db.js.
function uid(){ return 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function todayIso(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Rapikan nama sopir non-inti (input manual/bebas ketik) supaya "daud",
 * "DAUD", dan "Daud" semua konsisten jadi "Daud" — huruf awal tiap kata
 * kapital, sisanya kecil. Dipakai saat input DAN untuk migrasi data lama. */
function toTitleCaseNama(s){
  return String(s==null?'':s).trim().replace(/\s+/g,' ').toLowerCase().replace(/(^|\s)\S/g, c=>c.toUpperCase());
}
const ICON_PATHS = {
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/><path d="M10 11v6M14 11v6"/>',
  warning: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2 2.8-2.8z"/>',
  hammer: '<path d="M14 6l4 4-8.5 8.5a2 2 0 01-2.8 0l-1.2-1.2a2 2 0 010-2.8L14 6z"/><path d="M13 5l6 6M3 21l4-4"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z"/><path d="M13.5 6.5l4 4"/>',
  coffee: '<path d="M3 8h14v6a5 5 0 01-5 5H8a5 5 0 01-5-5V8z"/><path d="M17 9h1a3 3 0 010 6h-1"/><path d="M6 3c0 1 1 1 1 2s-1 1-1 2M10 3c0 1 1 1 1 2s-1 1-1 2"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3v4a5 5 0 005 5 5 5 0 005-5V3M7 21v-4a5 5 0 015-5 5 5 0 015 5v4"/>',
  map: '<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  document: '<path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 000-2l2-1.5-2-3.4-2.4 1a8 8 0 00-1.7-1L15 3h-4l-.3 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.97 7.97 0 000 2l-2 1.5 2 3.4 2.4-1a8 8 0 001.7 1L11 21h4l.3-2.6a8 8 0 001.7-1l2.4 1 2-3.4-2-1.5z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 015 5v1"/>',
  splitfwd: '<path d="M6 3v6a4 4 0 004 4h4"/><path d="M11 10l3 3-3 3"/>',
  splitback: '<path d="M18 3v6a4 4 0 01-4 4H10"/><path d="M13 10l-3 3 3 3"/>',
  download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  truck: '<path d="M3 7h11v9H3z"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  sync: '<path d="M4 12a8 8 0 0113.7-5.7L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 01-13.7 5.7L4 16"/><path d="M4 20v-4h4"/>',
  notepad: '<path d="M4 6h9M4 12h9M4 18h5"/><path d="M17 14l3 3-5 5h-3v-3z"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h6"/>',
  barchart: '<path d="M4 20V10M10 20V4M16 20v-7"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 15.2c2.6.3 4.5 2 4.5 4.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>'
};
function ic(name, size){
  size = size || 18;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;display:inline-block;">${ICON_PATHS[name]||''}</svg>`;
}
function fmtLabel(iso){
  if(!iso) return '-';
  const d = new Date(iso+'T00:00:00');
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jumat",'Sabtu'][d.getDay()];
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()];
  return hari+', '+d.getDate()+' '+bulan+' '+d.getFullYear();
}
/* Format tanggal ringkas d.m.yy (contoh: 26.8.26) - dipakai khusus di kolom Tanggal
 * PDF Laporan Cuaca Lengkap supaya hemat ruang untuk kolom Kelembapan & UV Maks. */
function fmtTanggalRingkas(iso){
  if(!iso) return '-';
  const d = new Date(iso+'T00:00:00');
  return d.getDate()+'.'+(d.getMonth()+1)+'.'+String(d.getFullYear()).slice(-2);
}
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window._toastT); window._toastT=setTimeout(()=>t.classList.remove('show'),2200); }

let expandedRowId = null;
let USER = LS.get('v2_user', {name:'', mainBt:''});
let UNITS = LS.get('v2_units', []);       // [{id, kode}]
let BLOKS = LS.get('v2_bloks', []);       // [{id, kode}]
let ENTRIES = LS.get('v2_entries', []);   // daily log entries
let SERVIS = LS.get('v2_servis', []);     // [{id, btId, date, hm, note}]
let HM_RESETS = LS.get('v2_hmresets', []); // [{id, btId, date, note}]
let SETTINGS = LS.get('v2_settings', {serviceInterval:240});
let JENIS_LAYANAN_LIST = LS.get('v2_jenis', ['Antar/Jemput Tenaga','Muat Tebu','Drone','Operator']);
let TIPE_ANTAR_LIST = LS.get('v2_tipeantar', ['Pekerja Kebun','Tebang','Tanam']);
let KEGIATAN_LIST = LS.get('v2_kegiatan', ['Pel. Umum','Pemupukan','Penyemprotan']);
let MUAT_TIPE_LIST = LS.get('v2_muattipe', ['Bibit','Produksi']);
let DRONE_JENIS_LIST = LS.get('v2_dronejenis', ['Penyemprotan','Pemetaan']);
let SHIFT_LIST = LS.get('v2_shift', ['Pagi','Siang','Malam']);
let JENIS_KERUSAKAN_LIST = LS.get('v2_jeniskerusakan', ['Rem','Mesin','Hidrolik','Kelistrikan','Ban/Roda']);
let MEKANIK_LIST = LS.get('v2_mekanik', []);
let BBM_SUSULAN = LS.get('v2_bbm_susulan', []); // [{id, btId, tanggal, hm, bbmMl, createdAt}]
/* ===== Modul Program Kerja (v1.0.26) — terpisah total dari ENTRIES.
 * Mencatat jadwal & realisasi kerja SEMUA driver (bukan cuma Han) untuk
 * analisa keadilan pembagian lembur. Lihat KONSEP-PROGRAM-KERJA.md. */
let DRIVER_LIST = LS.get('v2_program_driver', []);          // [{id, nama}]
let PROGRAM_RENCANA = LS.get('v2_program_rencana', []);     // [{id, tanggalMulai, tanggalSampai, unitId, sopir, isInti, layanan, tipe}]
let PROGRAM_AKTUAL = LS.get('v2_program_aktual', []);       // [{id, rencanaId, tanggal, unitId, sopir, isInti, layanan, tipe, overtimeJam, overtimeManual}]
let PIKET_JAM_LAYANAN = LS.get('v2_piket_jam_layanan', []); // [{layanan, jam}]
let PROGRAM_TANDA_LL = LS.get('v2_program_tanda_ll', []);   // [{tanggal, tandaLiburLembur}] — per tanggal, TERPISAH dari baris Program (baris Program kini bisa rentang tanggal)
/* Singkatan per Jenis Layanan (maks. 6 karakter), diatur di modal "Jam Otomatis
 * per Layanan" — dipakai untuk kolom Unit+Singkatan yang compact di PDF cetak
 * Proker (v1.0.32). Map sederhana {layanan: singkatan}, BUKAN per sub-tipe,
 * karena singkatan cukup mewakili nama Layanan itu sendiri (mis. "Putak"). */
let LAYANAN_SINGKATAN = LS.get('v2_layanan_singkatan', {});
/* Tipe/2 (kolom ke-2) khusus Program Kerja, per Jenis Layanan — SENGAJA
 * daftar terpisah dari TIPE_ANTAR_LIST/MUAT_TIPE_LIST/DRONE_JENIS_LIST/SHIFT_LIST
 * milik Hari Ini untuk Drone & Operator, karena nilainya beda kebutuhan
 * (Drone: bahan yang dipakai; Operator: cuma shift Pagi/Siang, tanpa Malam). */
let PK_DRONE_TIPE_LIST = LS.get('v2_pk_dronetipe', ['ZPK','Prevatone']);
let PK_SHIFT_LIST = LS.get('v2_pk_shift', ['Pagi','Siang']);
function savePkDroneTipeList(){ LS.set('v2_pk_dronetipe', PK_DRONE_TIPE_LIST); }
function savePkShiftList(){ LS.set('v2_pk_shift', PK_SHIFT_LIST); }
/* Label & daftar pilihan dropdown "Tipe" Program Kerja, tergantung Jenis Layanan yang dipilih.
 * Antar/Jemput Tenaga & Muat Tebu pakai daftar yang sama dengan Hari Ini (TIPE_ANTAR_LIST/
 * MUAT_TIPE_LIST) supaya konsisten; Drone & Operator pakai daftar sendiri (lihat di atas). */
function pkTipeLabelFor(layanan){
  if(layanan==='Antar/Jemput Tenaga') return 'Tipe';
  if(layanan==='Muat Tebu') return 'Tipe';
  if(layanan==='Drone') return 'Jenis Drone';
  if(layanan==='Operator') return 'Shift';
  return null;
}
function pkTipeOptionsFor(layanan){
  if(layanan==='Antar/Jemput Tenaga') return TIPE_ANTAR_LIST;
  if(layanan==='Muat Tebu') return MUAT_TIPE_LIST;
  if(layanan==='Drone') return PK_DRONE_TIPE_LIST;
  if(layanan==='Operator') return PK_SHIFT_LIST;
  return [];
}
function saveDriverList(){ LS.set('v2_program_driver', DRIVER_LIST); }
function saveProgramRencana(){ LS.set('v2_program_rencana', PROGRAM_RENCANA); }
function saveProgramAktual(){ LS.set('v2_program_aktual', PROGRAM_AKTUAL); }
function saveProgramTandaLL(){ LS.set('v2_program_tanda_ll', PROGRAM_TANDA_LL); }
/* Migrasi data lama (v1.0.26): baris Program dulu punya `tanggal` tunggal +
 * `tandaLiburLembur` per baris. Sejak v1.0.27, Program pakai rentang
 * tanggalMulai/tanggalSampai, dan tandaLiburLembur pindah ke PROGRAM_TANDA_LL
 * (per tanggal, independen dari baris). Dipanggil sekali tiap boot. */
function migratePkDataIfNeeded(){
  let changed = false, changedLL = false;
  PROGRAM_RENCANA.forEach(r=>{
    if(!r.tanggalMulai && r.tanggal){
      r.tanggalMulai = r.tanggal;
      r.tanggalSampai = r.tanggal;
      if(r.tandaLiburLembur && !PROGRAM_TANDA_LL.some(t=>t.tanggal===r.tanggal)){
        PROGRAM_TANDA_LL.push({tanggal:r.tanggal, tandaLiburLembur:true});
        changedLL = true;
      }
      delete r.tanggal;
      delete r.tandaLiburLembur;
      changed = true;
    }
  });
  if(changed) saveProgramRencana();
  if(changedLL) saveProgramTandaLL();
}
/* Migrasi: rapikan kapitalisasi nama sopir non-inti pada data LAMA yang sudah
 * kadung tersimpan beda kapital (mis. "daud" & "Daud" tercatat sebagai 2 nama
 * berbeda). Menyamakan semuanya ke Title Case lewat toTitleCaseNama() supaya
 * otomatis tergabung. Idempotent (aman dijalankan tiap boot). */
function migrateSopirCasingIfNeeded(){
  let changedR = false, changedA = false;
  PROGRAM_RENCANA.forEach(r=>{
    if(!r.isInti && r.sopir){
      const rapi = toTitleCaseNama(r.sopir);
      if(rapi!==r.sopir){ r.sopir = rapi; changedR = true; }
    }
  });
  PROGRAM_AKTUAL.forEach(a=>{
    if(!a.isInti && a.sopir){
      const rapi = toTitleCaseNama(a.sopir);
      if(rapi!==a.sopir){ a.sopir = rapi; changedA = true; }
    }
  });
  if(changedR) saveProgramRencana();
  if(changedA) saveProgramAktual();
}
function savePiketJamLayanan(){ LS.set('v2_piket_jam_layanan', PIKET_JAM_LAYANAN); }
function saveLayananSingkatan(){ LS.set('v2_layanan_singkatan', LAYANAN_SINGKATAN); }
/* Label yang ditampilkan di tabel ringkas (Program/Aktual/Rekap/Export):
 * sub-layanan (Tipe/Jenis Drone/Shift) saja, TANPA prefix nama Layanan.
 * Fallback ke nama Layanan kalau Layanan itu tidak punya sub-tipe. */
function pkSubLayananLabel(layanan, tipe){
  if(tipe) return tipe;
  return layanan || '-';
}
function saveUser(){ LS.set('v2_user', USER); }
function saveUnits(){ LS.set('v2_units', UNITS); }

/* ===== Unit khusus "Libur" & "Standby" (bukan truk sungguhan) =====
 * Dipakai saat Han tidak bekerja sama sekali (Libur) atau siaga tanpa
 * unit jalan (mis. sakit/alasan lain) — Standby. Keduanya SELALU ada
 * di daftar No Unit, tidak bisa dihapus/diedit, dan selalu ditaruh
 * PALING BAWAH di tampilan (lihat unitsForSelect()/unitsForKelola()),
 * terlepas dari urutan penyimpanan aslinya. */
const UNIT_LIBUR_ID = 'SYS_LIBUR';
const UNIT_STANDBY_ID = 'SYS_STANDBY';
function isSystemUnitId(id){ return id===UNIT_LIBUR_ID || id===UNIT_STANDBY_ID; }
function ensureSystemUnits(){
  let changed = false;
  if(!UNITS.some(u=>u.id===UNIT_LIBUR_ID)){ UNITS.push({id:UNIT_LIBUR_ID, kode:'Libur', isSystem:true}); changed = true; }
  if(!UNITS.some(u=>u.id===UNIT_STANDBY_ID)){ UNITS.push({id:UNIT_STANDBY_ID, kode:'Standby', isSystem:true}); changed = true; }
  if(changed) saveUnits();
}
/* Daftar unit untuk ditampilkan (dropdown No Unit / list Kelola Unit):
 * unit asli dulu (urutan aslinya), baru Libur & Standby di paling bawah. */
function unitsForSelect(){
  const asli = UNITS.filter(u=>!u.isSystem);
  const sistem = UNITS.filter(u=>u.isSystem);
  return asli.concat(sistem);
}
function saveBloks(){ LS.set('v2_bloks', BLOKS); }
function saveEntries(){ LS.set('v2_entries', ENTRIES); }
function saveServis(){ LS.set('v2_servis', SERVIS); }
function saveHmResets(){ LS.set('v2_hmresets', HM_RESETS); }
function saveJenisKerusakanList(){ LS.set('v2_jeniskerusakan', JENIS_KERUSAKAN_LIST); }
function saveMekanikList(){ LS.set('v2_mekanik', MEKANIK_LIST); }
function saveBbmSusulan(){ LS.set('v2_bbm_susulan', BBM_SUSULAN); }
function tambahBbmSusulan(btId, tanggal, hm, bbmMl){
  const s = {id:uid(), btId, tanggal, hm:String(hm), bbmMl:String(bbmMl), createdAt:Date.now()};
  BBM_SUSULAN.push(s);
  saveBbmSusulan();
  return s;
}
function hapusBbmSusulan(id){
  BBM_SUSULAN = BBM_SUSULAN.filter(s=>s.id!==id);
  saveBbmSusulan();
}
function saveSettings(){ LS.set('v2_settings', SETTINGS); }
function saveJenisList(){ LS.set('v2_jenis', JENIS_LAYANAN_LIST); }
function saveTipeAntarList(){ LS.set('v2_tipeantar', TIPE_ANTAR_LIST); }
function saveKegiatanList(){ LS.set('v2_kegiatan', KEGIATAN_LIST); }
function saveMuatTipeList(){ LS.set('v2_muattipe', MUAT_TIPE_LIST); }
function saveDroneJenisList(){ LS.set('v2_dronejenis', DRONE_JENIS_LIST); }
function saveShiftList(){ LS.set('v2_shift', SHIFT_LIST); }

/* ================= SUMBER DATA LIBUR NASIONAL (v2 — multi-sumber + fallback) =================
 * Dipakai BERSAMA oleh semua fitur cetak (Rekap Operasional, Laporan Cuaca, Program Kerja)
 * supaya highlight Minggu/libur nasional konsisten di semua PDF & Excel, bukan cuma satu fitur.
 * Cache per tahun disimpan lewat LS (key v2_holiday_cache_<tahun>) — kalau semua sumber gagal,
 * cetak tetap jalan pakai cache terakhir alih-alih gagal total.
 * Urutan sumber (berhenti begitu satu sumber sukses & tidak kosong):
 *  1. APIHariLibur_V2 (jsdelivr CDN, guangrei) — satu file berisi seluruh tahun berjalan,
 *     membedakan cuti bersama (holiday:true) dari sekadar perayaan (holiday:false).
 *  2. api-hari-libur.vercel.app (andifahruddinakas) — per tahun, sumber lama aplikasi ini.
 *  3. date.nager.at — API publik global, sangat stabil, tapi HANYA libur nasional resmi
 *     (tidak ada cuti bersama), dipakai sebagai jaring pengaman terakhir sebelum cache. */
const HOLIDAY_CDN_APIHARILIBUR = 'https://cdn.jsdelivr.net/gh/guangrei/APIHariLibur_V2/calendar.min.json';
async function fetchHolidayFromApiHariLiburV2(year){
  const resp = await fetch(HOLIDAY_CDN_APIHARILIBUR);
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const json = await resp.json();
  const prefix = String(year)+'-';
  return Object.keys(json)
    .filter(k=>k.startsWith(prefix) && json[k] && json[k].holiday===true)
    .sort();
}
async function fetchHolidayFromVercelApi(year){
  const resp = await fetch('https://api-hari-libur.vercel.app/api?year='+year);
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const json = await resp.json();
  const dates = Array.isArray(json && json.data) ? json.data.map(x=>x.date).filter(Boolean) : [];
  if(dates.length===0) throw new Error('Data kosong');
  return dates;
}
async function fetchHolidayFromNager(year){
  const resp = await fetch('https://date.nager.at/api/v3/PublicHolidays/'+year+'/ID');
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const json = await resp.json();
  const dates = Array.isArray(json) ? json.map(x=>x.date).filter(Boolean) : [];
  if(dates.length===0) throw new Error('Data kosong');
  return dates;
}
async function fetchHolidayYear(year){
  const cacheKey = 'v2_holiday_cache_'+year;
  const cached = LS.get(cacheKey, null);
  const sources = [fetchHolidayFromApiHariLiburV2, fetchHolidayFromVercelApi, fetchHolidayFromNager];
  for(const src of sources){
    try{
      const dates = await src(year);
      if(dates && dates.length>0){
        LS.set(cacheKey, {fetchedAt:Date.now(), dates});
        return dates;
      }
    }catch(e){
      console.warn('Sumber libur nasional gagal ('+(src.name||'?')+') untuk '+year+':', e && e.message ? e.message : e);
    }
  }
  console.warn('Semua sumber libur nasional gagal untuk '+year+', pakai cache terakhir bila ada.');
  return (cached && Array.isArray(cached.dates)) ? cached.dates : [];
}
async function getHolidaySetForRange(mulai, sampai){
  const yStart = parseInt(mulai.slice(0,4),10);
  const yEnd = parseInt(sampai.slice(0,4),10);
  const set = new Set();
  for(let y=yStart; y<=yEnd; y++){
    const dates = await fetchHolidayYear(y);
    dates.forEach(d=>set.add(d));
  }
  return set;
}
/* Baris disorot hijau kalau Minggu ATAU libur nasional/cuti bersama — Sabtu SENGAJA
 * selalu normal/putih (sesuai permintaan Han), walau kebetulan ada cuti bersama yang
 * jatuh di hari Sabtu. Dipakai bareng oleh semua fitur cetak. */
function isHolidayHighlightDate(dateIso, holidaySet){
  const day = new Date(dateIso+'T00:00:00').getDay();
  if(day===6) return false;
  return day===0 || holidaySet.has(dateIso);
}

