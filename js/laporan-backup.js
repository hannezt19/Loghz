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
    <div class="field-sub" style="margin:10px 0;">Ringkasan harian kedua wilayah (kolom Utara/Selatan berdampingan): kondisi (ikon), suhu, jam &amp; probabilitas potensi hujan, curah hujan, kelembapan, UV maks, angin (kecepatan &amp; arah). Excel menambahkan total hujan harian &amp; angin kencang, ditambah sheet kedua "Detail Per Jam" untuk semua jam tiap hari.</div>
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
 * Kelembapan & UV Maks dimasukkan di sini (bukan di XLSX_EXTRA) supaya ikut
 * tercetak di PDF juga, bukan cuma Excel. */
const WEATHER_EXPORT_GROUPS = [
  { key:'tanggal', label:'Tanggal', sub:null },
  { key:'kondisi', label:'Kondisi', sub:['U','S'] },
  { key:'suhu', label:'Suhu', sub:['U','S'] },
  { key:'jam', label:'Jam Potensi Hujan', sub:['U','S'] },
  { key:'prob', label:'Probabilitas', sub:['U','S'] },
  { key:'hujan', label:'Curah Hujan (mm)', sub:['U','S'] },
  { key:'kelembapan', label:'Kelembapan (%)', sub:['U','S'] },
  { key:'uv', label:'UV Maks', sub:['U','S'] },
  { key:'angin', label:'Angin (km/j)', sub:['U','S'] },
  { key:'arahangin', label:'Arah Angin', sub:['U','S'] }
];
/* Khusus PDF: kolom Tanggal dipersingkat (26.8.26) supaya ada ruang untuk 2 kolom
 * baru (Kelembapan, UV Maks) tanpa bikin tabel landscape kelewat sempit. Excel
 * tetap pakai tanggal lengkap (WEATHER_EXPORT_GROUPS asli, tidak diubah). */
const WEATHER_EXPORT_GROUPS_PDF = WEATHER_EXPORT_GROUPS.map(g=> g.key==='tanggal' ? {...g, key:'tanggal_pdf'} : g);
/* Kolom tambahan khusus Excel (tidak dipakai di PDF supaya tabel PDF tetap muat dicetak) */
const WEATHER_EXPORT_GROUPS_XLSX_EXTRA = [
  { key:'totalhujan', label:'Total Hujan Harian (mm)', sub:['U','S'] },
  { key:'anginkencang', label:'Angin Kencang Maks (km/j)', sub:['U','S'] }
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
  const uvFmt = (x)=>(x.uvIndexMax!==null&&x.uvIndexMax!==undefined)?x.uvIndexMax.toFixed(1):'-';
  const totalHujanHarianVal = (x)=>(x.precipSum!==null&&x.precipSum!==undefined)?x.precipSum:(x.rainMm||0);
  const anginKencangFmt = (x)=>(x.windMaxGust!==null&&x.windMaxGust!==undefined)?Math.round(x.windMaxGust)+' km/j':'-';
  const rows = logs.map(w=>{
    const u = w.utara||{}, s = w.selatan||{};
    return {
      tanggal: fmtLabel(w.date), tanggal_pdf: fmtTanggalRingkas(w.date),
      kondisi_u: weatherInfo(u.repCode)[1], kondisi_s: weatherInfo(s.repCode)[1],
      suhu_u: suhuFmt(u), suhu_s: suhuFmt(s),
      jam_u: u.isRain? jamLabel(u.rainHour):'-', jam_s: s.isRain? jamLabel(s.rainHour):'-',
      prob_u: (u.rainProb!==undefined?Math.round(u.rainProb):0)+'%', prob_s: (s.rainProb!==undefined?Math.round(s.rainProb):0)+'%',
      hujan_u: (u.rainMm||0).toFixed(1), hujan_s: (s.rainMm||0).toFixed(1),
      angin_u: anginFmt(u), angin_s: anginFmt(s),
      arahangin_u: formatArahAngin(u.windDirAvg), arahangin_s: formatArahAngin(s.windDirAvg),
      kelembapan_u: kelembapanFmt(u), kelembapan_s: kelembapanFmt(s),
      uv_u: uvFmt(u), uv_s: uvFmt(s),
      totalhujan_u: totalHujanHarianVal(u).toFixed(1), totalhujan_s: totalHujanHarianVal(s).toFixed(1),
      anginkencang_u: anginKencangFmt(u), anginkencang_s: anginKencangFmt(s),
      _utaraIsRain: !!u.isRain, _selatanIsRain: !!s.isRain,
      _utaraKategori: weatherIconCategory(u.repCode), _selatanKategori: weatherIconCategory(s.repCode)
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
          weatherInfo(h.code)[0],
          h.temp!==null&&h.temp!==undefined?Math.round(h.temp):'',
          h.feels!==null&&h.feels!==undefined?Math.round(h.feels):'',
          heatIdx!==null?Math.round(heatIdx):'',
          h.precipProb!==null&&h.precipProb!==undefined?Math.round(h.precipProb):'',
          h.precipMm!==null&&h.precipMm!==undefined?h.precipMm.toFixed(1):'',
          h.humidity!==null&&h.humidity!==undefined?Math.round(h.humidity):'',
          h.dewPoint!==null&&h.dewPoint!==undefined?Math.round(h.dewPoint):'',
          h.wind!==null&&h.wind!==undefined?Math.round(h.wind):'',
          formatArahAngin(h.windDir),
          h.gust!==null&&h.gust!==undefined?Math.round(h.gust):'',
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
    const bodyAoa = rows.map(r=>flatKeysXlsx.map(k=>r[k]));
    const sheetData = [headRow1, headRow2, ...bodyAoa, totalRowXlsx];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!merges'] = merges;
    ws['!cols'] = flatKeysXlsx.map(()=>({wch: 10}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuaca');
    /* Sheet 2 "Detail Per Jam": rincian tiap jam, tiap wilayah, tiap hari pada periode terpilih. */
    const jamHeader = ['Tanggal','Wilayah','Jam','Kondisi','Suhu (\u00b0C)','Suhu Terasa (\u00b0C)','Indeks Panas (\u00b0C)','Probabilitas Hujan (%)','Curah Hujan (mm)','Kelembapan (%)','Titik Embun (\u00b0C)','Angin (km/j)','Arah Angin','Angin Kencang (km/j)','Tutupan Awan (%)','Jarak Pandang (km)'];
    const jamRows = buildWeatherHourlyRows(logs);
    const sheetJamData = jamRows.length
      ? [jamHeader, ...jamRows]
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
        if(data.section==='body' && (data.column.dataKey==='kondisi_u' || data.column.dataKey==='kondisi_s')){
          const raw = data.row.raw || {};
          const kategori = data.column.dataKey==='kondisi_u' ? raw._utaraKategori : raw._selatanKategori;
          data.cell.text = [weatherCategoryLabel(kategori)];
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

/* ================= GOOGLE DRIVE (Tahap 2) =================
 * Dipanggil langsung lewat Capacitor.Plugins.GoogleAuth (bridge native), TANPA vendor
 * paket JS npm-nya — cukup plugin native ter-install via build-apk.yml + `cap sync`.
 * PENTING: clientId di bawah WAJIB tipe "Web application" dari Google Cloud Console,
 * BUKAN Android Client ID (Android Client ID dipakai Play Services di belakang layar
 * lewat kecocokan package name + SHA-1, tidak pernah ditulis di kode).
 */
const GOOGLE_WEB_CLIENT_ID = '933433627637-pbr39bv7eo5ku7r8se7qgj7j8ckrnap6.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let _googleAuthInitialized = false;

async function ensureGoogleAuthInit(){
  if(_googleAuthInitialized) return;
  if(!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.GoogleAuth){
    throw new Error('Plugin GoogleAuth tidak terdeteksi di APK ini (perlu build ulang dengan plugin terpasang)');
  }
  await window.Capacitor.Plugins.GoogleAuth.initialize({
    clientId: GOOGLE_WEB_CLIENT_ID,
    scopes: [GOOGLE_DRIVE_SCOPE],
    forceCodeForRefreshToken: false
  });
  _googleAuthInitialized = true;
}

/**
 * Ambil access token siap pakai untuk panggil Drive API.
 * - Coba `refresh()` dulu (SENYAP, tanpa UI) — ini pakai akun Google yang tersimpan
 *   di level Android (Play Services), bukan di memori app, jadi tetap jalan walau
 *   app baru dibuka lagi / dipakai dari auto-backup di background.
 * - Kalau gagal (belum pernah login sama sekali / akses dicabut) dan interactive=true,
 *   baru munculkan UI signIn(). Kalau interactive=false (dipanggil dari auto-backup
 *   senyap), langsung lempar error supaya pemanggil bisa fallback ke Lokal.
 */
/**
 * Kalau BACKUP_META.googleEmail belum ada (mis. token didapat lewat refresh()
 * senyap tanpa pernah lewat signIn() interaktif), ambil email dari endpoint
 * userinfo Google pakai token yang sudah ada — sekali saja, lalu simpan.
 */
async function pastikanEmailGoogleTersimpan(token){
  if(BACKUP_META.googleEmail || !token) return;
  try{
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if(res.ok){
      const info = await res.json();
      if(info && info.email){
        BACKUP_META.googleEmail = info.email;
        await saveBackupMeta();
      }
    }
  }catch(e){ console.warn('Gagal ambil email akun Google:', e); }
}
async function getGoogleAccessToken(interactive){
  await ensureGoogleAuthInit();
  try{
    const r = await window.Capacitor.Plugins.GoogleAuth.refresh();
    if(r && r.accessToken){
      await pastikanEmailGoogleTersimpan(r.accessToken);
      return r.accessToken;
    }
  }catch(e){
    // belum pernah login di HP ini, atau sesi kedaluwarsa — lanjut ke signIn kalau boleh interaktif
  }
  if(!interactive){
    throw new Error('Belum tersambung ke akun Google (perlu login manual dulu)');
  }
  const result = await window.Capacitor.Plugins.GoogleAuth.signIn();
  if(result && result.email){
    BACKUP_META.googleEmail = result.email;
    await saveBackupMeta();
  }
  const token = result && result.authentication && result.authentication.accessToken;
  if(!token) throw new Error('Tidak dapat access token dari login');
  await pastikanEmailGoogleTersimpan(token); // jaga-jaga kalau result.email kosong tapi token valid
  return token;
}

/**
 * Nama folder Drive tempat semua file backup bulanan disimpan. Folder ini dibuat
 * TAMPAK di root My Drive user (bukan App Data folder tersembunyi), supaya user
 * bisa lihat/buka sendiri lewat aplikasi Google Drive biasa.
 */
const GOOGLE_DRIVE_FOLDER_NAME = 'Log Hz Backup';

/** Nama file backup bulan berjalan, format LogHz_Backup_YYYY-MM.json (1 file per bulan). */
function getDriveBackupFilename(date){
  const d = date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return 'LogHz_Backup_' + yyyy + '-' + mm + '.json';
}

/** Escape tanda kutip tunggal supaya aman dipakai di query pencarian Drive API. */
function escapeDriveQueryValue(v){
  return String(v).replace(/'/g, "\\'");
}

/**
 * Cari folder "Log Hz Backup" di Drive (by name, lewat Drive API search — bukan ID
 * yang disimpan lokal). Kalau sudah ada, pakai itu (supaya tidak ada folder duplikat).
 * Kalau belum ada sama sekali, baru buat folder baru.
 */
async function cariFolderBackupDriveSaja(token){
  const q = "name='" + escapeDriveQueryValue(GOOGLE_DRIVE_FOLDER_NAME) + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const res = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&spaces=drive', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  if(!res.ok) throw new Error('Gagal mencari folder Drive: HTTP ' + res.status + ': ' + JSON.stringify(data));
  if(data.files && data.files.length > 0) return data.files[0].id;
  return null;
}
async function cariAtauBuatFolderBackupDrive(token){
  const found = await cariFolderBackupDriveSaja(token);
  if(found) return found; // folder sudah ada, pakai yang ini (tidak bikin duplikat)
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: GOOGLE_DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
  });
  const createData = await createRes.json();
  if(!createRes.ok) throw new Error('Gagal membuat folder Drive: HTTP ' + createRes.status + ': ' + JSON.stringify(createData));
  return createData.id;
}

/**
 * Cari file backup bulan berjalan DI DALAM folder tertentu, by nama file persis
 * (bukan file ID yang disimpan lokal) — supaya tetap akurat walau app di-reinstall
 * atau data lokal (BACKUP_META) hilang.
 */
async function cariFileBackupBulanIni(token, folderId, filename){
  const q = "name='" + escapeDriveQueryValue(filename) + "' and '" + folderId + "' in parents and trashed=false";
  const res = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&spaces=drive', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  if(!res.ok) throw new Error('Gagal mencari file backup di Drive: HTTP ' + res.status + ': ' + JSON.stringify(data));
  if(data.files && data.files.length > 0) return data.files[0].id;
  return null;
}

/**
 * Upload/timpa file backup bulan berjalan ke Drive, di dalam folder "Log Hz Backup".
 * Logic (memperbaiki bug lama yang cuma andalkan driveFileId tersimpan lokal):
 * 1. Cari/buat folder "Log Hz Backup" by NAMA (bukan ID lokal) — tidak bikin folder duplikat.
 * 2. Di dalam folder itu, cari file bulan berjalan by NAMA FILE + FOLDER.
 * 3. Ketemu -> PATCH (timpa) file itu. Tidak ketemu -> POST (buat baru) di folder itu.
 */
async function uploadBackupToDrive(blob, interactive){
  const token = await getGoogleAccessToken(interactive);
  const folderId = await cariAtauBuatFolderBackupDrive(token);
  const filename = getDriveBackupFilename();
  const existingFileId = await cariFileBackupBulanIni(token, folderId, filename);

  const text = await blob.text();
  const metadata = { name: filename, mimeType: 'application/json' };
  const isUpdate = !!existingFileId;
  if(!isUpdate){
    // parents hanya boleh diisi saat CREATE; saat update lewat multipart, field ini diabaikan Drive API
    metadata.parents = [folderId];
  }

  const boundary = 'logbookhz_boundary_' + Date.now();
  const delimiter = '\r\n--' + boundary + '\r\n';
  const closeDelim = '\r\n--' + boundary + '--';
  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    text +
    closeDelim;

  const url = isUpdate
    ? 'https://www.googleapis.com/upload/drive/v3/files/' + existingFileId + '?uploadType=multipart&fields=id'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';

  const res = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'multipart/related; boundary="' + boundary + '"'
    },
    body: body
  });
  const data = await res.json();
  if(!res.ok){
    if(res.status===404 && isUpdate){
      // File yang barusan ketemu ternyata sudah hilang lagi (race condition langka) — coba ulang dari awal
      return uploadBackupToDrive(blob, interactive);
    }
    throw new Error('HTTP ' + res.status + ': ' + JSON.stringify(data));
  }
  // driveFileId & driveFolderId cuma disimpan sebagai catatan/tampilan terakhir,
  // BUKAN dipakai lagi sebagai acuan pencarian (acuan utama tetap nama file + folder di atas)
  BACKUP_META.driveFileId = data.id;
  BACKUP_META.driveFolderId = folderId;
  return data.id;
}

/** Upload ulang manual dari file backup lokal yang sudah ada — dipanggil dari Riwayat Backup. */
async function uploadUlangKeDriveManual(){
  try{
    const base64 = await bacaBackupFilePersisten();
    if(!base64){ toast('Tidak ada file backup lokal untuk diupload'); return; }
    toast('Mengunggah ke Google Drive...');
    const blob = await (await fetch('data:application/json;base64,'+base64)).blob();
    await uploadBackupToDrive(blob, true);
    BACKUP_META.uploadedToCloud = true;
    await saveBackupMeta();
    toast('Berhasil diupload ke Google Drive');
    openPengaturanRiwayat();
  }catch(err){
    console.error('Upload manual ke Drive gagal:', err);
    toast('Gagal upload ke Drive');
  }
}

/* Aksi murni putus akun — pemanggilnya (UI konfirmasi) yang mengurus render ulang & toast. */
async function putuskanAkunGoogle(){
  try{
    await ensureGoogleAuthInit();
    await window.Capacitor.Plugins.GoogleAuth.signOut();
  }catch(e){ console.warn('signOut GoogleAuth:', e); }
  BACKUP_META.googleEmail = null;
  BACKUP_META.driveFileId = null;
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
        await uploadBackupToDrive(blob, !silent); // interaktif kalau bukan auto-backup senyap
        uploadedToCloud = true;
      }catch(err){
        console.error('Gagal upload ke Drive, tetap simpan Lokal:', err);
        if(!silent) toast('Gagal upload ke Drive — backup tetap tersimpan di HP');
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
    const labelMetode = uploadedToCloud ? 'Google Drive' : 'Lokal';
    toast(silent ? ('Backup otomatis bulanan berhasil dibuat ('+labelMetode+')') : 'Backup berhasil dibuat ('+labelMetode+')');
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

