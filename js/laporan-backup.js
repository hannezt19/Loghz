/* ================= LAPORAN CUACA LENGKAP (drawer) ================= */
function openWeatherExportSheet(){
  closeDrawer();
  openModal(`
    <div class="mhead"><h2>Laporan Cuaca Lengkap</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="section-eyebrow">Periode</div>
    <div class="chk-row"><input type="radio" name="wexp-mode" id="wexp-mode-month" value="month" checked onchange="updateWExpModeUI()"><label for="wexp-mode-month" style="margin-left:6px;">Bulan ini</label></div>
    <div class="chk-row"><input type="radio" name="wexp-mode" id="wexp-mode-all" value="all" onchange="updateWExpModeUI()"><label for="wexp-mode-all" style="margin-left:6px;">Semua periode</label></div>
    <div class="chk-row"><input type="radio" name="wexp-mode" id="wexp-mode-custom" value="custom" onchange="updateWExpModeUI()"><label for="wexp-mode-custom" style="margin-left:6px;">Rentang tanggal custom</label></div>
    <div id="wexp-customRange" style="display:none;margin:8px 0;">
      <label class="flabel">Dari tanggal</label><input type="date" id="wexp-dateFrom">
      <label class="flabel">Sampai tanggal</label><input type="date" id="wexp-dateTo">
    </div>
    <div class="field-sub" style="margin:10px 0;">Ringkasan harian kedua wilayah (kolom Utara/Selatan berdampingan): kondisi (ikon), suhu, jam potensi hujan &amp; kategorinya, curah hujan, kelembapan, angin (kecepatan &amp; arah). Excel menambahkan total hujan harian &amp; angin maks, ditambah sheet kedua "Detail Per Jam" untuk semua jam tiap hari. Sumber data: BMKG.</div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn-block" style="flex:1;" onclick="doWeatherExport('pdf')">${ic('document')} PDF</button>
      <button class="btn-block outline" style="flex:1;" onclick="doWeatherExport('xlsx')">${ic('barchart')} Excel</button>
    </div>
  `);
}
function updateWExpModeUI(){
  const mode = document.querySelector('input[name="wexp-mode"]:checked').value;
  document.getElementById('wexp-customRange').style.display = mode==='custom' ? 'block' : 'none';
}
/* Definisi kelompok kolom Laporan Cuaca Lengkap - dipakai bareng oleh PDF & Excel
 * supaya label header di atas kolom bisa digabung/rata-tengah membentang di atas
 * 2 sub-kolom U (Utara) / S (Selatan), bukan diulang panjang per wilayah.
 * Kelembapan dimasukkan di sini (bukan di XLSX_EXTRA) supaya ikut tercetak di
 * PDF juga, bukan cuma Excel.
 * v1.0.34 (migrasi ke BMKG): kolom "Probabilitas" (%) diganti "Kategori Hujan"
 * (teks, mis. Hujan Ringan/Hujan Lebat) karena BMKG tidak menyediakan data
 * probabilitas hujan (bukan model ensemble). Kolom "UV Maks" dihapus karena
 * BMKG tidak punya data indeks UV sama sekali. */
const WEATHER_EXPORT_GROUPS = [
  { key:'tanggal', label:'Tanggal', sub:null },
  { key:'kondisi', label:'Kondisi', sub:['U','S'] },
  { key:'suhu', label:'Suhu', sub:['U','S'] },
  { key:'jam', label:'Jam Potensi Hujan', sub:['U','S'] },
  { key:'kategori', label:'Kategori Hujan', sub:['U','S'] },
  { key:'hujan', label:'Curah Hujan (mm)', sub:['U','S'] },
  { key:'kelembapan', label:'Kelembapan (%)', sub:['U','S'] },
  { key:'angin', label:'Angin (km/j)', sub:['U','S'] },
  { key:'arahangin', label:'Arah Angin', sub:['U','S'] }
];
/* Khusus PDF: kolom Tanggal dipersingkat (26.8.26) supaya ada ruang untuk kolom
 * Kelembapan tanpa bikin tabel landscape kelewat sempit. Excel tetap pakai tanggal
 * lengkap (WEATHER_EXPORT_GROUPS asli, tidak diubah). */
const WEATHER_EXPORT_GROUPS_PDF = WEATHER_EXPORT_GROUPS.map(g=> g.key==='tanggal' ? {...g, key:'tanggal_pdf'} : g);
/* Kolom tambahan khusus Excel (tidak dipakai di PDF supaya tabel PDF tetap muat dicetak).
 * "Angin Maks" = kecepatan angin tertinggi yang tercatat hari itu (BUKAN hembusan/gust —
 * BMKG tidak menyediakan data gust, beda dari Open-Meteo yang dipakai sebelumnya). */
const WEATHER_EXPORT_GROUPS_XLSX_EXTRA = [
  { key:'totalhujan', label:'Total Hujan Harian (mm)', sub:['U','S'] },
  { key:'anginmaks', label:'Angin Maks (km/j)', sub:['U','S'] }
];
function weatherFlatKeys(groups){
  const keys = [];
  (groups || WEATHER_EXPORT_GROUPS).forEach(g=>{
    if(!g.sub) keys.push(g.key);
    else g.sub.forEach(s=>keys.push(g.key+'_'+s.toLowerCase()));
  });
  return keys;
}
function getWeatherExportRows(){
  const mode = document.querySelector('input[name="wexp-mode"]:checked').value;
  let logs = WEATHER_LOG.slice();
  if(mode==='custom'){
    const from = document.getElementById('wexp-dateFrom').value;
    const to = document.getElementById('wexp-dateTo').value;
    logs = logs.filter(w=>(!from||w.date>=from)&&(!to||w.date<=to));
  } else if(mode==='month'){
    const mk = todayIso().slice(0,7);
    logs = logs.filter(w=>w.date.startsWith(mk));
  }
  logs.sort((a,b)=>a.date.localeCompare(b.date));
  const suhuFmt = (x)=>(x.tmin!==null&&x.tmin!==undefined?Math.round(x.tmin):'-')+'-'+(x.tmax!==null&&x.tmax!==undefined?Math.round(x.tmax):'-')+'\u00b0';
  const anginFmt = (x)=>(x.windAvg!==null&&x.windAvg!==undefined)?Math.round(x.windAvg)+' km/j':'-';
  const kelembapanFmt = (x)=>(x.humidityAvg!==null&&x.humidityAvg!==undefined)?Math.round(x.humidityAvg)+'%':'-';
  const totalHujanHarianVal = (x)=>(x.precipSum!==null&&x.precipSum!==undefined)?x.precipSum:(x.rainMm||0);
  const anginMaksFmt = (x)=>(x.windMaxSpeed!==null&&x.windMaxSpeed!==undefined)?Math.round(x.windMaxSpeed)+' km/j':'-';
  const rows = logs.map(w=>{
    const u = w.utara||{}, s = w.selatan||{};
    return {
      tanggal: fmtLabel(w.date), tanggal_pdf: fmtTanggalRingkas(w.date),
      kondisi_u: weatherInfo(u.repCode)[1], kondisi_s: weatherInfo(s.repCode)[1],
      suhu_u: suhuFmt(u), suhu_s: suhuFmt(s),
      jam_u: u.isRain? jamLabel(u.rainHour):'-', jam_s: s.isRain? jamLabel(s.rainHour):'-',
      kategori_u: u.isRain? (u.rainKategori||'-') : 'Tidak hujan', kategori_s: s.isRain? (s.rainKategori||'-') : 'Tidak hujan',
      hujan_u: (u.rainMm||0).toFixed(1), hujan_s: (s.rainMm||0).toFixed(1),
      angin_u: anginFmt(u), angin_s: anginFmt(s),
      arahangin_u: formatArahAngin(u.windDirAvg), arahangin_s: formatArahAngin(s.windDirAvg),
      kelembapan_u: kelembapanFmt(u), kelembapan_s: kelembapanFmt(s),
      totalhujan_u: totalHujanHarianVal(u).toFixed(1), totalhujan_s: totalHujanHarianVal(s).toFixed(1),
      anginmaks_u: anginMaksFmt(u), anginmaks_s: anginMaksFmt(s),
      _utaraIsRain: !!u.isRain, _selatanIsRain: !!s.isRain,
      _utaraKategori: weatherIconCategory(u.repCode, u.repDesc), _selatanKategori: weatherIconCategory(s.repCode, s.repDesc),
      _dateIso: w.date /* dipakai untuk highlight Minggu/libur nasional di PDF & penanda di Excel */
    };
  });
  const totalRainUtara = logs.reduce((sum,w)=>sum+((w.utara&&w.utara.rainMm)||0),0);
  const totalRainSelatan = logs.reduce((sum,w)=>sum+((w.selatan&&w.selatan.rainMm)||0),0);
  const totalCurahHarianUtara = logs.reduce((sum,w)=>sum+totalHujanHarianVal(w.utara||{}),0);
  const totalCurahHarianSelatan = logs.reduce((sum,w)=>sum+totalHujanHarianVal(w.selatan||{}),0);
  return {rows, logs, totalRainUtara, totalRainSelatan, totalCurahHarianUtara, totalCurahHarianSelatan};
}
function exportFileLabelCuaca(){
  const mode = document.querySelector('input[name="wexp-mode"]:checked').value;
  if(mode==='all') return 'semua-periode';
  if(mode==='custom'){
    const from = document.getElementById('wexp-dateFrom').value || 'awal';
    const to = document.getElementById('wexp-dateTo').value || 'akhir';
    return from+'_sd_'+to;
  }
  return todayIso().slice(0,7);
}
function buildWeatherTotalRow(flatKeys, totals){
  return flatKeys.map(k=>{
    if(k==='tanggal' || k==='tanggal_pdf') return 'TOTAL';
    if(k==='hujan_u') return totals.totalRainUtara.toFixed(1);
    if(k==='hujan_s') return totals.totalRainSelatan.toFixed(1);
    if(k==='totalhujan_u') return totals.totalCurahHarianUtara.toFixed(1);
    if(k==='totalhujan_s') return totals.totalCurahHarianSelatan.toFixed(1);
    return '';
  });
}
/* Bangun baris-baris untuk sheet "Detail Per Jam" (Excel saja) — 1 baris per jam per wilayah.
 * Hari-hari lama (sebelum fitur ini aktif) tidak punya rincian per jam tersimpan, otomatis dilewati. */
function buildWeatherHourlyRows(logs){
  const rows = [];
  logs.forEach(w=>{
    [['utara','Utara'],['selatan','Selatan']].forEach(([key,label])=>{
      const wd = w[key];
      if(!wd || !wd.hours || !wd.hours.length) return;
      wd.hours.forEach(h=>{
        const heatIdx = hitungIndeksPanas(h.temp, h.humidity);
        rows.push([
          fmtLabel(w.date), label, jamLabel(h.hour),
          weatherInfo(h.code, h.desc)[0],
          h.temp!==null&&h.temp!==undefined?Math.round(h.temp):'',
          h.feels!==null&&h.feels!==undefined?Math.round(h.feels):'',
          heatIdx!==null?Math.round(heatIdx):'',
          h.precipMm!==null&&h.precipMm!==undefined?h.precipMm.toFixed(1):'',
          h.humidity!==null&&h.humidity!==undefined?Math.round(h.humidity):'',
          h.dewPoint!==null&&h.dewPoint!==undefined?Math.round(h.dewPoint):'',
          h.wind!==null&&h.wind!==undefined?Math.round(h.wind):'',
          formatArahAngin(h.windDir),
          h.cloud!==null&&h.cloud!==undefined?Math.round(h.cloud):'',
          h.visibility!==null&&h.visibility!==undefined?(h.visibility/1000).toFixed(1):''
        ]);
      });
    });
  });
  return rows;
}
async function doWeatherExport(fmt){
  const {rows, logs, totalRainUtara, totalRainSelatan, totalCurahHarianUtara, totalCurahHarianSelatan} = getWeatherExportRows();
  if(rows.length===0){ toast('Tidak ada data cuaca pada periode ini'); return; }
  const totals = {totalRainUtara, totalRainSelatan, totalCurahHarianUtara, totalCurahHarianSelatan};
  /* Libur nasional/Minggu untuk rentang tanggal laporan ini — dipakai bareng oleh
   * highlight PDF & penanda "(Libur)" di Excel. */
  const isoDatesW = rows.map(r=>r._dateIso).filter(Boolean).sort();
  const holidaySetW = isoDatesW.length ? await getHolidaySetForRange(isoDatesW[0], isoDatesW[isoDatesW.length-1]) : new Set();
  if(fmt==='xlsx'){
    if(!window.XLSX){ toast('Library Excel belum siap'); return; }
    /* Sheet 1 "Cuaca": ringkasan harian lengkap (kolom dasar + kolom tambahan khusus Excel).
     * Baris header 1: label kelompok, baris header 2: sub-kolom U/S. Kolom Tanggal digabung
     * vertikal (2 baris), kolom tiap kelompok digabung horizontal (2 kolom). */
    const xlsxGroups = WEATHER_EXPORT_GROUPS.concat(WEATHER_EXPORT_GROUPS_XLSX_EXTRA);
    const flatKeysXlsx = weatherFlatKeys(xlsxGroups);
    const totalRowXlsx = buildWeatherTotalRow(flatKeysXlsx, totals);
    const headRow1 = [], headRow2 = [];
    const merges = [];
    let col = 0;
    xlsxGroups.forEach(g=>{
      if(!g.sub){
        headRow1.push(g.label); headRow2.push('');
        merges.push({s:{r:0,c:col}, e:{r:1,c:col}});
        col += 1;
      } else {
        headRow1.push(g.label); g.sub.forEach(()=>headRow1.push(''));
        g.sub.forEach(s=>headRow2.push(s));
        merges.push({s:{r:0,c:col}, e:{r:0,c:col+g.sub.length-1}});
        col += g.sub.length;
      }
    });
    /* Community edition SheetJS tidak bisa menulis warna latar sel di .xlsx — jadi
     * highlight hijau PDF disederhanakan jadi penanda teks "(Libur)" di kolom Tanggal. */
    const bodyAoa = rows.map(r=>flatKeysXlsx.map(k=>{
      if(k==='tanggal' && r._dateIso && isHolidayHighlightDate(r._dateIso, holidaySetW)) return r[k]+' (Libur)';
      return r[k];
    }));
    const sheetData = [headRow1, headRow2, ...bodyAoa, totalRowXlsx];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!merges'] = merges;
    ws['!cols'] = flatKeysXlsx.map(()=>({wch: 10}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuaca');
    /* Sheet 2 "Detail Per Jam": rincian tiap jam, tiap wilayah, tiap hari pada periode terpilih. */
    const jamHeader = ['Tanggal','Wilayah','Jam','Kondisi','Suhu (\u00b0C)','Suhu Terasa* (\u00b0C)','Indeks Panas (\u00b0C)','Curah Hujan (mm)','Kelembapan (%)','Titik Embun* (\u00b0C)','Angin (km/j)','Arah Angin','Tutupan Awan (%)','Jarak Pandang (km)'];
    const jamCatatan = ['*Suhu Terasa & Titik Embun dihitung dari suhu & kelembapan, bukan data langsung BMKG. Sumber data lain: BMKG.'];
    const jamRows = buildWeatherHourlyRows(logs);
    const sheetJamData = jamRows.length
      ? [jamHeader, ...jamRows, [], jamCatatan]
      : [jamHeader, ['Tidak ada data per jam pada periode ini (data lama sebelum fitur ini aktif tidak menyimpan rincian per jam)']];
    const wsJam = XLSX.utils.aoa_to_sheet(sheetJamData);
    wsJam['!cols'] = jamHeader.map(()=>({wch: 13}));
    XLSX.utils.book_append_sheet(wb, wsJam, 'Detail Per Jam');
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const result = await saveOrShareBlob(blob, 'laporan-cuaca-'+exportFileLabelCuaca()+'.xlsx');
    toast(result==='shared'?'Excel siap dibagikan':'Excel diunduh');
    closeModal();
    return;
  }
  /* PDF: ringkasan harian dengan kolom dasar + Kelembapan + UV Maks — rincian
   * per jam tidak dicetak di PDF karena jumlah barisnya bisa sangat banyak; tersedia di Excel.
   * Kolom Tanggal dipersingkat (26.8.26) lewat WEATHER_EXPORT_GROUPS_PDF supaya ada ruang. */
  const flatKeys = weatherFlatKeys(WEATHER_EXPORT_GROUPS_PDF);
  const totalRow = buildWeatherTotalRow(flatKeys, totals);
  if(!window.jspdf){ toast('Library PDF belum siap'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Laporan Cuaca Harian', 10, 12);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('Wilayah Utara & Selatan', 10, 19);
  if(typeof doc.autoTable === 'function'){
    /* Baris head 1 = label kelompok membentang (colSpan) rata tengah; baris head 2 = sub-kolom U/S.
     * Kolom Kondisi diisi teks label singkat (bukan emoji) lewat willDrawCell - emoji tidak
     * didukung font default jsPDF (dulu tercetak simbol acak), dan ikon vektor sebelumnya
     * berisiko tercetak jadi blok warna solid di sebagian device/PDF viewer. Teks paling aman. */
    const headRow1 = [], headRow2 = [];
    WEATHER_EXPORT_GROUPS_PDF.forEach(g=>{
      if(!g.sub){
        headRow1.push({content:g.label, rowSpan:2, styles:{valign:'middle', halign:'center'}});
      } else {
        headRow1.push({content:g.label, colSpan:g.sub.length, styles:{halign:'center'}});
        g.sub.forEach(s=>headRow2.push({content:s, styles:{halign:'center'}}));
      }
    });
    doc.autoTable({
      columns: flatKeys.map(k=>({dataKey:k})),
      head: [headRow1, headRow2],
      body: rows,
      foot: [totalRow],
      startY: 25, styles:{fontSize:7, cellPadding:1.3, halign:'center'}, headStyles:{fillColor:[76,140,60]},
      footStyles:{fillColor:[240,230,210], textColor:[30,20,0], fontStyle:'bold'}, theme:'grid',
      columnStyles: { tanggal_pdf:{halign:'left'}, kondisi_u:{cellWidth:13}, kondisi_s:{cellWidth:13} },
      willDrawCell: function(data){
        if(data.section==='body'){
          const raw = data.row.raw || {};
          if(raw._dateIso && isHolidayHighlightDate(raw._dateIso, holidaySetW)){
            data.cell.styles.fillColor = [211,242,211];
          }
          if(data.column.dataKey==='kondisi_u' || data.column.dataKey==='kondisi_s'){
            const kategori = data.column.dataKey==='kondisi_u' ? raw._utaraKategori : raw._selatanKategori;
            data.cell.text = [weatherCategoryLabel(kategori)];
          }
        }
      }
    });
  }
  const pdfBlob = doc.output('blob');
  const result = await saveOrShareBlob(pdfBlob, 'laporan-cuaca-'+exportFileLabelCuaca()+'.pdf');
  toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
  closeModal();
}
/* ================= BACKUP & RESTORE ================= */
/* ================= BACKUP & RESTORE (v2 — lokal + placeholder cloud) ================= */
const BACKUP_FOLDER = 'backups';
const BACKUP_FILENAME = 'backup-terakhir.json'; // model "ditimpa": selalu 1 file, ditimpa tiap backup
const BACKUP_AUTO_DAYS = 30;
let BACKUP_META = LS.get('v2_backup_meta', {
  lastBackupAt:null, lastMethod:null, autoEnabled:true,
  scheduleMode:'interval', scheduleInterval:BACKUP_AUTO_DAYS, scheduleDate:5, autoMethod:'lokal',
  jadwalPernahDibuka:false
});

/* ================= DROPBOX (Tahap 2, migrasi dari Google Drive) =================
 * Login pakai OAuth 2.0 + PKCE (tanpa client secret, aman dipakai di app publik/mobile).
 * Alurnya: buka browser sistem (bukan WebView app) ke halaman login Dropbox lewat
 * window.open(url,'_system') -> user login & approve -> Dropbox redirect balik ke app
 * lewat skema URL custom (com.hz.loghz://oauth2redirect) -> plugin Capacitor App
 * menangkap ini lewat event 'appUrlOpen' -> kode ditukar jadi token lewat fetch biasa.
 * Tidak perlu plugin native tambahan (beda dari GoogleAuth dulu) — cukup @capacitor/app
 * yang memang sudah dipasang, plus 1 baris intent-filter di AndroidManifest (lihat
 * build-apk.yml) supaya Android tahu skema URL ini harus dibuka balik ke app ini.
 *
 * Akses dibatasi ke "App folder" (folder khusus app ini di Dropbox user, dibuat otomatis
 * oleh Dropbox sendiri saat App key di bawah didaftarkan dengan tipe akses "App folder"
 * di Dropbox App Console) — jadi app ini tidak pernah bisa melihat/mengubah file lain
 * di Dropbox user, mirip prinsipnya dengan scope drive.file yang dipakai Google dulu.
 */
const DROPBOX_APP_KEY = 'kldfi6lxkxoy0l0';
const DROPBOX_REDIRECT_URI = 'com.hz.loghz://oauth2redirect';

/** String acak untuk PKCE code_verifier (43-128 karakter sesuai spesifikasi Dropbox/OAuth). */
function dropboxRandomString(len){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for(let i=0;i<len;i++) out += chars[arr[i] % chars.length];
  return out;
}
/** code_challenge = base64url(SHA-256(code_verifier)), sesuai metode S256. */
async function dropboxCodeChallenge(verifier){
  const enc = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  let bin = '';
  new Uint8Array(digest).forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

/* Promise yang "menggantung" selagi menunggu user login di browser & kembali ke app
 * lewat deep link — diselesaikan (resolve/reject) oleh listener appUrlOpen di bawah. */
let _dropboxAuthPending = null;

/** Mulai proses sambungkan akun Dropbox: buka browser sistem ke halaman login Dropbox. */
async function mulaiSambungkanDropbox(){
  if(!DROPBOX_APP_KEY || DROPBOX_APP_KEY.indexOf('GANTI_DENGAN') === 0){
    throw new Error('DROPBOX_APP_KEY belum diisi di kode (js/laporan-backup.js)');
  }
  const verifier = dropboxRandomString(64);
  const challenge = await dropboxCodeChallenge(verifier);
  LS.set('dbx_pkce_verifier', verifier);
  const authUrl = 'https://www.dropbox.com/oauth2/authorize'
    + '?client_id=' + encodeURIComponent(DROPBOX_APP_KEY)
    + '&response_type=code'
    + '&redirect_uri=' + encodeURIComponent(DROPBOX_REDIRECT_URI)
    + '&code_challenge=' + encodeURIComponent(challenge)
    + '&code_challenge_method=S256'
    + '&token_access_type=offline';
  return new Promise((resolve, reject) => {
    _dropboxAuthPending = { resolve, reject };
    window.open(authUrl, '_system');
  });
}

/** Ambil info akun (untuk ditampilkan di layar Akun) — kegagalan di sini tidak fatal. */
async function pastikanNamaAkunDropboxTersimpan(accessToken){
  try{
    const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    if(res.ok){
      const info = await res.json();
      BACKUP_META.dropboxAccountName = info.email || (info.name && info.name.display_name) || 'Tersambung';
      await saveBackupMeta();
    }
  }catch(e){ console.warn('Gagal ambil info akun Dropbox:', e); }
}

/**
 * Dipasang sekali saat app dibuka (lihat setupDropboxDeepLink() di bawah). Menangkap
 * balikan dari browser setelah user login/approve di Dropbox, menukar kode otorisasi
 * jadi refresh token (disimpan) + access token (dipakai sekali untuk ambil nama akun).
 */
function setupDropboxDeepLink(){
  if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App)) return;
  const { App } = window.Capacitor.Plugins;
  App.addListener('appUrlOpen', async (data) => {
    const url = data && data.url;
    if(!url || url.indexOf(DROPBOX_REDIRECT_URI) !== 0) return;
    try{
      const params = new URLSearchParams(url.split('?')[1] || '');
      if(params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
      const code = params.get('code');
      if(!code) throw new Error('Tidak dapat kode otorisasi dari Dropbox');
      const verifier = LS.get('dbx_pkce_verifier', null);
      if(!verifier) throw new Error('Sesi login Dropbox kedaluwarsa, coba sambungkan lagi');
      const body = new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY,
        redirect_uri: DROPBOX_REDIRECT_URI,
        code_verifier: verifier
      });
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const tok = await res.json();
      if(!res.ok) throw new Error(tok.error_description || tok.error || ('HTTP ' + res.status));
      BACKUP_META.dropboxRefreshToken = tok.refresh_token;
      await saveBackupMeta();
      if(tok.access_token) await pastikanNamaAkunDropboxTersimpan(tok.access_token);
      if(_dropboxAuthPending){ _dropboxAuthPending.resolve(true); _dropboxAuthPending = null; }
      if(document.getElementById('modalSheet') && typeof openPengaturanAkun === 'function') openPengaturanAkun();
      toast('Berhasil tersambung ke Dropbox');
    }catch(err){
      console.error('Gagal proses login Dropbox:', err);
      if(_dropboxAuthPending){ _dropboxAuthPending.reject(err); _dropboxAuthPending = null; }
      toast('Gagal sambungkan Dropbox: ' + (err && err.message ? err.message : err));
    }
  });
}
setupDropboxDeepLink();

/**
 * Ambil access token siap pakai untuk panggil Dropbox API.
 * - Kalau sudah punya refresh token tersimpan, tukar jadi access token baru (senyap,
 *   tanpa UI) — refresh token Dropbox pada dasarnya tidak kedaluwarsa selama tidak
 *   dicabut user, beda dari sesi token Google yang dulu terbatas.
 * - Kalau belum tersambung sama sekali dan interactive=true, baru buka alur login
 *   (browser). Kalau interactive=false (auto-backup senyap), langsung lempar error
 *   supaya pemanggil bisa fallback ke Lokal.
 */
async function getDropboxAccessToken(interactive){
  const refreshToken = BACKUP_META.dropboxRefreshToken;
  if(refreshToken){
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: DROPBOX_APP_KEY
    });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const data = await res.json();
    if(res.ok && data.access_token) return data.access_token;
    console.warn('Refresh token Dropbox ditolak, kemungkinan sudah dicabut:', data);
    BACKUP_META.dropboxRefreshToken = null;
    await saveBackupMeta();
  }
  if(!interactive) throw new Error('Belum tersambung ke akun Dropbox (perlu sambungkan dulu)');
  await mulaiSambungkanDropbox();
  if(!BACKUP_META.dropboxRefreshToken) throw new Error('Login Dropbox belum selesai');
  return getDropboxAccessToken(false);
}

/** Path file backup bulan berjalan di dalam App folder Dropbox, format /LogHz_Backup_YYYY-MM.json. */
function getDropboxBackupFilename(date){
  const d = date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return '/LogHz_Backup_' + yyyy + '-' + mm + '.json';
}

/** Upload/timpa file backup bulan berjalan ke Dropbox (path langsung, tidak perlu cari folder/ID). */
async function uploadBackupToDropbox(blob, interactive){
  const token = await getDropboxAccessToken(interactive);
  const path = getDropboxBackupFilename();
  const text = await blob.text();
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true })
    },
    body: text
  });
  const data = await res.json();
  if(!res.ok) throw new Error('HTTP ' + res.status + ': ' + JSON.stringify(data));
  BACKUP_META.dropboxLastPath = path;
  return path;
}

/** Upload ulang manual dari file backup lokal yang sudah ada — dipanggil dari Riwayat Backup. */
async function uploadUlangKeDropboxManual(){
  try{
    const base64 = await bacaBackupFilePersisten();
    if(!base64){ toast('Tidak ada file backup lokal untuk diupload'); return; }
    toast('Mengunggah ke Dropbox...');
    const blob = await (await fetch('data:application/json;base64,'+base64)).blob();
    await uploadBackupToDropbox(blob, true);
    BACKUP_META.uploadedToCloud = true;
    await saveBackupMeta();
    toast('Berhasil diupload ke Dropbox');
    openPengaturanRiwayat();
  }catch(err){
    console.error('Upload manual ke Dropbox gagal:', err);
    toast('Gagal upload ke Dropbox');
  }
}

/* Aksi murni putus akun — pemanggilnya (UI konfirmasi) yang mengurus render ulang & toast. */
async function putuskanAkunDropbox(){
  try{
    const token = await getDropboxAccessToken(false);
    await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    });
  }catch(e){ /* tidak masalah kalau gagal cabut di sisi Dropbox, tetap putuskan lokal di bawah */ }
  BACKUP_META.dropboxRefreshToken = null;
  BACKUP_META.dropboxAccountName = null;
  await saveBackupMeta();
}
async function saveBackupMeta(){ return LS.set('v2_backup_meta', BACKUP_META); }

async function buildBackupPayload(){
  const data = LS.getAll();
  let petaImage = null;
  try{ petaImage = await petaDbGet('main'); }catch(e){ petaImage = null; }
  const backup = {
    app: 'LogHM',
    version: (document.getElementById('dw-version') && document.getElementById('dw-version').textContent || '').trim(),
    exportedAt: new Date().toISOString(),
    jumlahEntri: (data && data.v2_entries && Array.isArray(data.v2_entries)) ? data.v2_entries.length : 0,
    data: data,
    petaImage: petaImage
  };
  const json = JSON.stringify(backup);
  return { backup, blob: new Blob([json], {type:'application/json'}) };
}
/* Tulis file backup ke folder privat aplikasi (persisten, tidak hilang saat 'clear cache') */
async function writeBackupFilePersisten(blob){
  if(!isNativeApp() || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Filesystem) return null;
  try{
    const { Filesystem } = window.Capacitor.Plugins;
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: BACKUP_FOLDER+'/'+BACKUP_FILENAME, data: base64, directory: 'DATA', recursive: true });
    return written.uri || null;
  }catch(err){
    console.warn('Gagal simpan backup persisten:', err && err.message ? err.message : err);
    return null;
  }
}
async function bacaBackupFilePersisten(){
  if(!isNativeApp() || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Filesystem) return null;
  try{
    const { Filesystem } = window.Capacitor.Plugins;
    const res = await Filesystem.readFile({ path: BACKUP_FOLDER+'/'+BACKUP_FILENAME, directory: 'DATA' });
    return res.data; // base64
  }catch(err){ return null; }
}
/* Jalankan backup — dipanggil dari popup manual atau auto-backup bulanan (silent=true) */
async function buatBackupSekarang(method, silent){
  try{
    if(!silent) toast('Menyiapkan backup...');
    const { blob } = await buildBackupPayload();
    const uriPersisten = await writeBackupFilePersisten(blob);

    let uploadedToCloud = false;
    if(method==='cloud'){
      try{
        await uploadBackupToDropbox(blob, !silent); // interaktif kalau bukan auto-backup senyap
        uploadedToCloud = true;
        BACKUP_META.lastCloudError = null; // upload kali ini sukses, hapus jejak error lama
      }catch(err){
        console.error('Gagal upload ke Dropbox, tetap simpan Lokal:', err);
        if(!silent) toast('Gagal upload ke Dropbox — backup tetap tersimpan di HP');
        // FIX: sebelumnya error ini ditelan diam-diam kalau silent=true (auto-backup),
        // jadi kalau sesi akun cloud putus, app akan terus "gagal diam-diam" tiap
        // bulan tanpa Anda pernah tahu. Sekarang jejaknya disimpan supaya tampil sebagai
        // peringatan di layar Pengaturan, walau backup keseluruhan tetap dianggap sukses
        // (karena Lokal berhasil).
        BACKUP_META.lastCloudError = { at: new Date().toISOString(), msg: (err && err.message) || String(err) };
      }
    }

    // tetap tawarkan share/unduh manual (kecuali auto-backup silent, cukup simpan persisten saja)
    if(!silent){
      await saveOrShareBlob(blob, 'backup-loghm-'+todayIso()+'.json');
    }
    BACKUP_META.lastBackupAt = new Date().toISOString();
    BACKUP_META.lastMethod = method;
    BACKUP_META.lastFileUri = uriPersisten;
    BACKUP_META.uploadedToCloud = uploadedToCloud;
    BACKUP_META.lastBackupError = null; // backup kali ini sukses, hapus jejak error lama
    await saveBackupMeta();
    const labelMetode = uploadedToCloud ? 'Dropbox' : 'Lokal';
    const gagalCloud = method==='cloud' && !uploadedToCloud;
    toast(silent
      ? (gagalCloud ? 'Backup otomatis tersimpan di HP — upload ke Dropbox gagal' : ('Backup otomatis bulanan berhasil dibuat ('+labelMetode+')'))
      : (gagalCloud ? 'Backup tersimpan di HP — upload ke Dropbox gagal' : 'Backup berhasil dibuat ('+labelMetode+')'));
  }catch(err){
    console.error('Gagal membuat backup:', err);
    toast('Gagal membuat backup');
    // Simpan jejaknya (bukan cuma toast sekilas) supaya kelihatan di layar Pengaturan
    // walau user tidak sempat lihat toast-nya — terutama untuk backup otomatis senyap.
    BACKUP_META.lastBackupError = { at: new Date().toISOString(), msg: (err && err.message) || String(err) };
    try{ await saveBackupMeta(); }catch(e2){ /* penyimpanan meta pun gagal, sudah tidak ada yang bisa dilakukan lagi */ }
  }
}
async function bagikanUlangBackup(){
  const base64 = await bacaBackupFilePersisten();
  if(!base64){ toast('File backup tidak ditemukan di HP ini'); return; }
  try{
    const blob = await (await fetch('data:application/json;base64,'+base64)).blob();
    await saveOrShareBlob(blob, 'backup-loghm-'+todayIso()+'.json');
  }catch(err){ toast('Gagal membuka file backup'); }
}

