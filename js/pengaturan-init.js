/* ================= PENGATURAN (layar gabungan Cadangan Data) =================
 * 1 pintu drawer -> layar list (Backup/Restore/Riwayat/Jadwal/Akun). Tiap baris
 * membuka sub-tampilan di dalam modal yang sama (bukan modal baru), lalu tombol
 * kembali (←) memanggil openPengaturanScreen() lagi. Pola ini konsisten dengan
 * flow tampilkanPreviewRestore/jalankanRestore yang sudah ada sebelumnya.
 */
function labelTierBackup(tier){ return {harian:'Harian', mingguan:'Mingguan', bulanan:'Bulanan', tahunan:'Tahunan'}[tier] || (tier||'-'); }

function openPengaturanScreen(){
  closeDrawer();
  const tgl = BACKUP_META.lastBackupAt ? new Date(BACKUP_META.lastBackupAt).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-';
  const akunLabel = BACKUP_META.dropboxAccountName;
  openModal(`
    <div class="mhead"><h2>Pengaturan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${BACKUP_META.lastSkippedBackup ? `
    <div class="card" style="background:#FDECEA;border:1px solid #F5C6C3;margin-bottom:12px;">
      <div style="font-weight:700;color:#B3261E;">${ic('warning')} Auto-backup (${BACKUP_META.lastSkippedBackup.tier}) dilewati</div>
      <div class="field-sub" style="margin-top:4px;">${new Date(BACKUP_META.lastSkippedBackup.at).toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})} — data tiba-tiba cuma ${BACKUP_META.lastSkippedBackup.jumlahSekarang} (sebelumnya ${BACKUP_META.lastSkippedBackup.jumlahTerakhirBaik}). Backup lama TIDAK ditimpa demi keamanan. Segera cek aplikasi — kalau memang ada masalah, restore dari backup terakhir yang baik di tab Restore.</div>
    </div>
    ` : ''}
    ${BACKUP_META.lastBackupError ? `
    <div class="card" style="background:#FDECEA;border:1px solid #F5C6C3;margin-bottom:12px;">
      <div style="font-weight:700;color:#B3261E;">${ic('warning')} Backup otomatis terakhir gagal</div>
      <div class="field-sub" style="margin-top:4px;">${new Date(BACKUP_META.lastBackupError.at).toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})} — coba tap Backup di bawah untuk backup manual.</div>
    </div>
    ` : ''}
    ${(!BACKUP_META.lastBackupError && BACKUP_META.lastCloudError) ? `
    <div class="card" style="background:#FFF4E5;border:1px solid #FFDDA8;margin-bottom:12px;">
      <div style="font-weight:700;color:#8A5A00;">${ic('warning')} Upload ke Dropbox terakhir gagal</div>
      <div class="field-sub" style="margin-top:4px;">${new Date(BACKUP_META.lastCloudError.at).toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})} — data tetap tersimpan di HP. Kemungkinan sesi akun Dropbox terputus, coba buka tab Akun untuk sambungkan ulang.</div>
    </div>
    ` : ''}
    <div class="dgroup" style="padding-left:0;">Cadangan Data</div>
    <div class="pgt-row" onclick="jalankanBackupCepat()"><span class="pgt-l">Backup</span><span class="pgt-r">HP + Dropbox</span></div>
    <div class="pgt-row" onclick="openPengaturanRestore()"><span class="pgt-l">Restore</span><span class="pgt-r">-<span class="pgt-chev">›</span></span></div>
    <div class="pgt-row" onclick="openPengaturanRiwayat()"><span class="pgt-l">Riwayat</span><span class="pgt-r">${tgl}<span class="pgt-chev">›</span></span></div>
    <div class="pgt-row" onclick="openPengaturanJadwal()"><span class="pgt-l">Jadwal</span><span class="pgt-r">${BACKUP_META.autoEnabled!==false?'Aktif':'Nonaktif'}<span class="pgt-chev">›</span></span></div>
    <div class="dgroup" style="padding-left:0;">Akun</div>
    <div class="pgt-row" style="border-bottom:none;" onclick="openPengaturanAkun()"><span class="pgt-l">Akun</span><span class="pgt-r">${akunLabel?escapeHtml(akunLabel):'Belum tersambung'}<span class="pgt-chev">›</span></span></div>
  `);
}

/* --- Backup: tap langsung eksekusi tingkat "harian" secara manual (menjalankan
 * rotasi harian di luar jadwalnya, dengan toast & tawaran share/unduh) --- */
async function jalankanBackupCepat(){
  await jalankanBackupTier('harian', false);
  openPengaturanScreen(); // refresh supaya status Akun & tanggal Riwayat langsung ke-update
}

/* --- Restore --- */
function openPengaturanRestore(){
  openModal(`
    <div class="mhead"><button class="mclose" onclick="openPengaturanScreen()" style="margin-right:4px;">←</button><h2 style="display:inline;">Restore</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="card">
      <div style="font-weight:800;font-size:13.5px;">Dari Dropbox</div>
      <div class="field-sub" style="margin:4px 0 10px;">Ambil backup terakhir dari akun yang tersambung. Cocok dipakai saat pindah / install ulang di HP baru.</div>
      <button class="btn-block outline" onclick="pulihkanDariDropbox()">${ic('sync')} Pulihkan dari Dropbox</button>
    </div>
    <div class="card">
      <div style="font-weight:800;font-size:13.5px;">Dari file di HP</div>
      <div class="field-sub" style="margin:4px 0 10px;">Pilih file backup (.json) yang tersimpan lokal di HP ini.</div>
      <button class="btn-block outline" onclick="triggerRestoreFile()">${ic('download')} Pilih File dari HP</button>
    </div>
  `);
}
function triggerRestoreFile(){
  document.getElementById('restoreFileInput').click();
}
/* Cari & ambil file backup terbaru dari App folder Dropbox akun yang login, lalu masuk
 * ke alur preview/konfirmasi yang sama seperti restore dari file lokal
 * (tampilkanPreviewRestore -> jalankanRestore). */
async function pulihkanDariDropbox(){
  try{
    toast('Mencari backup di Dropbox...');
    const token = await getDropboxAccessToken(true);
    const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      body: JSON.stringify({ path:'' })
    });
    const listData = await listRes.json();
    if(!listRes.ok) throw new Error('HTTP '+listRes.status);
    const files = (listData.entries||[]).filter(f => f['.tag']==='file' && /^LogHz_Backup_.*\.json$/i.test(f.name));
    if(!files.length){ toast('Tidak ditemukan backup di Dropbox akun ini'); return; }
    // Semua tingkat (harian/mingguan/bulanan/tahunan) full snapshot yang sama
    // isinya (bukan potongan per periode) - jadi cukup ambil yang PALING BARU
    // diubah di antara semuanya, tidak perlu user pilih tingkat mana dulu.
    files.sort((a,b) => new Date(b.server_modified) - new Date(a.server_modified));
    const target = files[0];
    const dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+token, 'Dropbox-API-Arg': JSON.stringify({ path: target.path_lower }) }
    });
    if(!dlRes.ok) throw new Error('HTTP '+dlRes.status);
    const parsed = await dlRes.json();
    if(!parsed || typeof parsed.data !== 'object'){ toast('File backup di Dropbox tidak valid'); return; }
    BACKUP_META.dropboxLastPath = target.path_lower;
    saveBackupMeta();
    tampilkanPreviewRestore(parsed, 'Dropbox — '+target.name);
  }catch(err){
    console.error('Gagal mengambil backup dari Dropbox:', err);
    toast('Gagal mengambil backup dari Dropbox');
  }
}

/* --- Riwayat: model "ditimpa" cuma menyimpan 1 backup terakhir, jadi ini status, bukan daftar panjang --- */
function openPengaturanRiwayat(){
  const tgl = BACKUP_META.lastBackupAt ? new Date(BACKUP_META.lastBackupAt).toLocaleString('id-ID') : null;
  openModal(`
    <div class="mhead"><button class="mclose" onclick="openPengaturanScreen()" style="margin-right:4px;">←</button><h2 style="display:inline;">Riwayat</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${tgl ? `
      <div class="card card-flat">
        <div class="field-sub">Backup terakhir</div>
        <div style="font-weight:800;font-size:15px;margin-top:2px;">${tgl}</div>
        <div class="field-sub" style="margin-top:4px;">Tingkat: ${escapeHtml(labelTierBackup(BACKUP_META.lastMethod))} &middot; ${BACKUP_META.uploadedToCloud?'Sudah di Dropbox':'Belum di-upload ke Dropbox'}</div>
      </div>
      <button class="btn-block outline" onclick="bagikanUlangBackup()">${ic('download')} Bagikan / Unduh Ulang File Ini</button>
      <button class="btn-block outline" style="margin-top:8px;" onclick="uploadUlangKeDropboxManual()">${ic('sync')} Upload ke Dropbox</button>
    ` : `
      <div class="field-sub">Belum ada backup yang pernah dibuat di HP ini.</div>
    `}
  `);
}

/* --- Jadwal: sekarang cuma saklar aktif/nonaktif + status 4 tingkat berlapis
 * (harian/mingguan/bulanan/tahunan) - tidak ada lagi pilihan interval/tanggal
 * manual, karena keempatnya sekarang SELALU jalan bersamaan (disepakati
 * setelah insiden kehilangan data 6 Sep 2026), bukan salah satu saja. */
function openPengaturanJadwal(){
  const rot = BACKUP_META.rotasi || {};
  const barisTier = (tier, label, keterangan) => {
    const info = rot[tier] || {};
    const terakhir = tier==='tahunan'
      ? (info.lastYear ? ('Tahun '+info.lastYear) : 'Belum pernah')
      : (info.lastDate ? new Date(info.lastDate+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : 'Belum pernah');
    return `
      <div class="card card-flat" style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:800;font-size:13.5px;">${label}</span>
          <span class="field-sub">${terakhir}</span>
        </div>
        <div class="field-sub" style="margin-top:2px;">${keterangan}</div>
      </div>`;
  };
  openModal(`
    <div class="mhead"><button class="mclose" onclick="openPengaturanScreen()" style="margin-right:4px;">←</button><h2 style="display:inline;">Jadwal</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="chk-row" style="margin-bottom:14px;"><input type="checkbox" id="chk-auto-backup" ${BACKUP_META.autoEnabled!==false?'checked':''} onchange="toggleAutoBackupEnabled(this.checked)"><label for="chk-auto-backup" style="margin-left:6px;">Aktifkan backup otomatis berlapis</label></div>
    <div class="field-sub" style="margin-bottom:12px;">Dicek tiap app dibuka & tiap 1 jam selama app terbuka. Semua tingkat di bawah jalan otomatis bersamaan (tidak perlu pilih salah satu) — tiap kali jalan, disimpan ke HP dan diupload ke Dropbox (kalau tersambung).</div>
    ${barisTier('harian','Harian (3 slot berputar)','Ditimpa tiap hari sekali.')}
    ${barisTier('mingguan','Mingguan (3 slot berputar)','Ditimpa tiap hari Minggu sekali.')}
    ${barisTier('bulanan','Bulanan (3 slot berputar)','Ditimpa tiap tanggal 1 sekali.')}
    ${barisTier('tahunan','Tahunan (permanen)','File baru tiap pergantian tahun - tidak pernah ditimpa/dihapus otomatis.')}
    <div class="field-sub" style="margin-top:8px;">Kalau data tiba-tiba kosong/anjlok drastis, backup tingkat itu otomatis DILEWATI (bukan menimpa file lama) — akan muncul peringatan di layar Pengaturan sampai kamu lihat sendiri.</div>
  `);
}
async function toggleAutoBackupEnabled(checked){
  BACKUP_META.autoEnabled = checked;
  await saveBackupMeta();
  toast(checked ? 'Backup otomatis diaktifkan' : 'Backup otomatis dinonaktifkan');
}

/* --- Auto-backup berlapis: dijalankan senyap tiap app dibuka & tiap 1 jam
 * selama app dibiarkan terbuka. Tiap tingkat dicek independen di sini; rem
 * darurat & penulisan file sebenarnya ada di dalam jalankanBackupTier(). */
async function checkBackupBerlapis(){
  if(BACKUP_META.autoEnabled===false) return;
  const adaData = Array.isArray(ENTRIES) && ENTRIES.length > 0;
  if(!adaData) return; // belum ada data sama sekali (mis. baru instal) - belum ada yang perlu dibackup
  const now = new Date();
  const todayStr = todayIso();
  const rot = BACKUP_META.rotasi;
  if(rot.harian.lastDate !== todayStr) await jalankanBackupTier('harian', true);
  if(now.getDay()===0 && rot.mingguan.lastDate !== todayStr) await jalankanBackupTier('mingguan', true);
  if(now.getDate()===1 && rot.bulanan.lastDate !== todayStr) await jalankanBackupTier('bulanan', true);
  if(rot.tahunan.lastYear !== now.getFullYear()) await jalankanBackupTier('tahunan', true);
}

/* --- Akun: putus akun butuh konfirmasi ganda (ketik nama app) supaya tidak kepencet tidak sengaja --- */
const PENGATURAN_KONFIRM_KATA = 'Log Hz';
async function openPengaturanAkun(){
  const sudahTersambung = !!BACKUP_META.dropboxRefreshToken;
  const akunLabel = BACKUP_META.dropboxAccountName;
  openModal(`
    <div class="mhead"><button class="mclose" onclick="openPengaturanScreen()" style="margin-right:4px;">←</button><h2 style="display:inline;">Akun</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${sudahTersambung ? `
      <div class="card card-flat"><div class="field-sub">Tersambung sebagai</div><div style="font-weight:800;font-size:15px;margin-top:2px;">${escapeHtml(akunLabel||'Dropbox')}</div></div>
      <div class="field-sub" style="margin:14px 0 6px;">Ketik <b>${PENGATURAN_KONFIRM_KATA}</b> untuk memutuskan akun ini.</div>
      <input type="text" id="inp-konfirm-putus" placeholder="${PENGATURAN_KONFIRM_KATA}" style="text-align:center;" oninput="cekKonfirmasiPutus()">
      <button class="btn-block" id="btn-putus-akun" style="background:#B3261E;opacity:.4;" disabled onclick="konfirmasiPutuskanAkun()">Putuskan Akun</button>
    ` : `
      <div class="field-sub" style="margin-bottom:12px;">Belum tersambung ke Dropbox.</div>
      <button class="btn-block outline" onclick="sambungkanDropboxDariAkun()">${ic('sync')} Sambungkan ke Dropbox</button>
    `}
  `);
}
/* Tombol koneksi manual di layar Akun — beda dari dulu (Google bisa langsung minta
 * login di tengah proses backup/restore), Dropbox login lewat browser sistem butuh
 * app "berpindah keluar-masuk", jadi lebih jelas kalau user mulai dari sini dulu. */
async function sambungkanDropboxDariAkun(){
  try{
    toast('Membuka Dropbox untuk login...');
    await mulaiSambungkanDropbox();
  }catch(err){
    console.error('Gagal sambungkan Dropbox:', err);
    toast('Gagal sambungkan Dropbox: ' + (err && err.message ? err.message : err));
  }
}
function cekKonfirmasiPutus(){
  const val = (document.getElementById('inp-konfirm-putus').value||'').trim();
  const btn = document.getElementById('btn-putus-akun');
  const ok = val === PENGATURAN_KONFIRM_KATA;
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '.4';
}
async function konfirmasiPutuskanAkun(){
  await putuskanAkunDropbox();
  toast('Akun Dropbox diputuskan dari app ini');
  openPengaturanScreen();
}

/* Helper lama (hariBerlaluSejak, tanggalJatuhTempoTerakhir, checkAutoBackupBulanan)
 * sudah dihapus - digantikan checkBackupBerlapis() di atas (lihat bagian Jadwal). */
function restoreDataFile(evt){
  const file = evt.target.files[0];
  evt.target.value = '';
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    let parsed;
    try{
      parsed = JSON.parse(e.target.result);
    }catch(err){
      toast('File backup tidak valid');
      return;
    }
    if(!parsed || typeof parsed.data !== 'object'){
      toast('File backup tidak valid');
      return;
    }
    tampilkanPreviewRestore(parsed, 'file di HP');
  };
  reader.readAsText(file);
}
function tampilkanPreviewRestore(parsed, sumber){
  const tgl = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('id-ID') : 'Tidak diketahui';
  const jumlahEntri = parsed.jumlahEntri!==undefined ? parsed.jumlahEntri : (parsed.data && parsed.data.v2_entries ? parsed.data.v2_entries.length : '-');
  window._pendingRestoreData = parsed;
  openModal(`
    <div class="mhead"><h2>Timpa Data Sekarang?</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="card card-flat">
      <div class="field-sub">Isi file backup ${sumber?('dari '+escapeHtml(sumber)):'ini'}</div>
      <div style="font-weight:800;font-size:15px;margin-top:2px;">Dibuat: ${tgl}</div>
      <div class="field-sub" style="margin-top:4px;">Berisi ${jumlahEntri} catatan kerja &middot; Versi app: ${escapeHtml(parsed.version||'-')}</div>
    </div>
    <div class="field-sub" style="margin:14px 0;color:#B3261E;font-weight:700;">⚠ Semua data yang ada di HP ini SEKARANG akan ditimpa total dan tidak bisa dikembalikan. Pastikan ini benar-benar file yang Anda maksud.</div>
    <button class="btn-block" style="background:#B3261E;" onclick="jalankanRestore()">Ya, Timpa & Pulihkan</button>
    <button class="btn-block outline" style="margin-top:10px;" onclick="openPengaturanRestore()">Batal</button>
  `);
}
async function jalankanRestore(){
  const parsed = window._pendingRestoreData;
  if(!parsed) return;
  let restoreOk = false;
  try{
    await LS.setAll(parsed.data);
    if(parsed.petaImage){
      try{ await petaDbSet('main', parsed.petaImage); }catch(e){}
    }
    restoreOk = true;
  }catch(err){
    console.error('Gagal memulihkan data:', err);
    toast('Gagal memulihkan data');
  }
  // Tahap 1 fix #2: apa pun hasilnya (berhasil ATAUPUN gagal), tutup koneksi
  // SQLite lama lalu buka ulang (reconnect) di sini juga — supaya koneksi
  // tidak "nyangkut" di sisi native dan location.reload() di bawah tidak
  // gagal dengan error "Connection ... already exists". Ini juga sekaligus
  // memuat ulang cache dari SQLite (loadAllIntoCache di db.js), jadi kalau
  // reload sempat lambat/gagal, state di memori tetap sudah segar.
  try{
    await DB.reconnect();
    if(restoreOk){
      // segarkan variabel global penting di sini juga (jaga-jaga kalau
      // reload/setTimeout di bawah tidak sempat jalan, mis. app dibackground)
      UNITS = LS.get('v2_units', []);
      ENTRIES = LS.get('v2_entries', []);
      CATATAN_MANDOR = LS.get('v2_catatan_mandor', []);
    }
  }catch(err){
    console.error('Gagal reconnect database setelah restore:', err);
  }
  if(restoreOk){
    closeModal();
    toast('Data berhasil dipulihkan, memuat ulang...');
    setTimeout(()=>{ location.reload(); }, 900);
  }
}
function isNativeApp(){ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onloadend = ()=>resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
async function saveOrShareBlob(blob, filename){
  if(isNativeApp() && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem){
    try{
      const { Filesystem } = window.Capacitor.Plugins;
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({ path: filename, data: base64, directory: 'CACHE', recursive: true });
      if(window.Capacitor.Plugins.Share){
        await window.Capacitor.Plugins.Share.share({ title: filename, url: written.uri, dialogTitle: 'Simpan atau bagikan file' });
        return 'shared';
      }
      return 'saved-native';
    }catch(err){
      const msg = err && err.message ? err.message : JSON.stringify(err);
      if(!/cancel/i.test(msg)) alert('Gagal simpan: '+msg);
    }
  }
  try{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel='noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  }catch(err){
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return 'opened';
  }
}

/* ================= TOMBOL BACK SISTEM (ANDROID) ================= */
function anyOverlayOpen(){
  return document.getElementById('modalOverlay').classList.contains('show') || document.getElementById('drawerOverlay').classList.contains('show');
}
function closeAnyOverlay(){
  if(document.getElementById('modalOverlay').classList.contains('show')){ closeModal(); return true; }
  if(document.getElementById('drawerOverlay').classList.contains('show')){ closeDrawer(); return true; }
  return false;
}
function setupBackButton(){
  if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App)) return;
  const { App } = window.Capacitor.Plugins;
  App.addListener('backButton', () => {
    if(closeAnyOverlay()) return;
    const activeTab = document.querySelector('#bottomnav button.active');
    if(activeTab && activeTab.dataset.tab !== 'beranda'){
      showScreen('beranda');
      return;
    }
    App.exitApp();
  });
}
setupBackButton();

/* ================= INIT (SQLite) =================
 * Saat script ini pertama kali di-parse, database belum siap (proses SQLite
 * selalu async) — jadi semua variabel global (USER, UNITS, ENTRIES, dst) di
 * atas tadi ke-load dengan nilai DEFAULT (cache masih kosong). Begitu
 * DB.init() selesai, kita muat ulang semua variabel itu dari cache yang
 * sudah terisi, baru tampilkan layar pertama. Layar loading sederhana
 * ditampilkan selama proses ini (biasanya sangat cepat, di bawah 1 detik).
 */
function tampilkanLoadingAwal(){
  const el = document.createElement('div');
  el.id = 'bootLoading';
  el.style.cssText = 'position:fixed;inset:0;background:var(--surface);display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:12px;';
  el.innerHTML = '<div style="width:36px;height:36px;border:3px solid var(--outline);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="font-size:13px;color:var(--on-surface-variant);">Memuat data…</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(el);
}
function sembunyikanLoadingAwal(){
  const el = document.getElementById('bootLoading');
  if(el) el.remove();
}

async function bootApp(){
  tampilkanLoadingAwal();
  try{
    await DB.init();
    // muat ulang semua variabel global dari cache SQLite yang sudah terisi
    USER = LS.get('v2_user', {name:'', mainBt:''});
    UNITS = LS.get('v2_units', []);
    BLOKS = LS.get('v2_bloks', []);
    ENTRIES = LS.get('v2_entries', []);
    SERVIS = LS.get('v2_servis', []);
    HM_RESETS = LS.get('v2_hmresets', []);
    SETTINGS = LS.get('v2_settings', {serviceInterval:240});
    JENIS_LAYANAN_LIST = LS.get('v2_jenis', ['Antar/Jemput Tenaga','Muat Tebu','Drone','Operator']);
    TIPE_ANTAR_LIST = LS.get('v2_tipeantar', ['Pekerja Kebun','Tebang','Tanam']);
    KEGIATAN_LIST = LS.get('v2_kegiatan', ['Pel. Umum','Pemupukan','Penyemprotan']);
    MUAT_TIPE_LIST = LS.get('v2_muattipe', ['Bibit','Produksi']);
    DRONE_JENIS_LIST = LS.get('v2_dronejenis', ['Penyemprotan','Pemetaan']);
    SHIFT_LIST = LS.get('v2_shift', ['Pagi','Siang','Malam']);
    JENIS_KERUSAKAN_LIST = LS.get('v2_jeniskerusakan', ['Rem','Mesin','Hidrolik','Kelistrikan','Ban/Roda']);
    MEKANIK_LIST = LS.get('v2_mekanik', []);
    BBM_SUSULAN = LS.get('v2_bbm_susulan', []); // WAJIB: sebelumnya terlewat dari refresh, menyebabkan data Susulan tampak hilang & berisiko tertimpa kosong setiap app dibuka ulang
    PETA_BLOCKS = LS.get('v2_peta_blocks', []);
    DRIVER_LIST = LS.get('v2_program_driver', []);
    PROGRAM_RENCANA = LS.get('v2_program_rencana', []);
    PROGRAM_AKTUAL = LS.get('v2_program_aktual', []);
    PIKET_JAM_LAYANAN = LS.get('v2_piket_jam_layanan', []);
    PROGRAM_TANDA_LL = LS.get('v2_program_tanda_ll', []);
    PK_DRONE_TIPE_LIST = LS.get('v2_pk_dronetipe', ['ZPK','Prevatone']);
    PK_SHIFT_LIST = LS.get('v2_pk_shift', ['Pagi','Siang']);
    LAYANAN_SINGKATAN = LS.get('v2_layanan_singkatan', {});
    CATATAN_MANDOR = LS.get('v2_catatan_mandor', []);
    migratePkDataIfNeeded(); // konversi baris Program lama (v1.0.26, tanggal tunggal) ke skema rentang v1.0.27
    migratePkJamLayananIfNeeded(); // konversi jam otomatis lama (per-Layanan) ke per-sub-tipe (Agustus 2026)
    migrateLayananSingkatanIfNeeded(); // konversi Singkatan lama (per-Layanan) ke per-sub-tipe (v1.0.33)
    migrateSopirCasingIfNeeded(); // rapikan kapitalisasi nama sopir non-inti lama (v1.0.38)
    ensureSystemUnits();
    // Sebelumnya BACKUP_META/WEATHER/WEATHER_LOG TIDAK ikut disegarkan di sini,
    // jadi selalu memakai nilai default (dari `let` di atas, dieksekusi sebelum
    // DB.init() selesai) walaupun data aslinya sudah benar tersimpan di SQLite.
    BACKUP_META = LS.get('v2_backup_meta', {
      lastBackupAt:null, lastMethod:null, autoEnabled:true,
      lastKnownDataCount:null, lastSkippedBackup:null,
      rotasi: {
        harian:  { idx:0, lastDate:null },
        mingguan:{ idx:0, lastDate:null },
        bulanan: { idx:0, lastDate:null },
        tahunan: { lastYear:null }
      }
    });
    migrateBackupMetaIfNeeded(); // FIX: v2_backup_meta lama (sebelum sistem berlapis) tidak punya field `rotasi` sama sekali - LS.get() cuma pakai default kalau KEY-nya belum ada sama sekali, jadi user yang sudah pernah backup sebelum update ini tetap dapat objek lama tanpa `rotasi`, bikin checkBackupBerlapis() error "Cannot read properties of undefined (reading 'harian')". Migrasi ini menambal field yang kurang tanpa menghapus riwayat yang sudah ada.
    WEATHER = LS.get('v2_weather_cache', null);
    WEATHER_LOG = LS.get('v2_weather_log', []);
  }catch(err){
    console.error('Gagal inisialisasi database:', err);
    alert('Gagal memuat database: ' + (err && err.message ? err.message : err) + '\n\nApp tetap dibuka, tapi data mungkin tidak lengkap. Coba tutup & buka ulang app.');
  }
  sembunyikanLoadingAwal();
  showScreen('beranda');
  fetchWeatherIfNeeded();
  checkBackupBerlapis();
  // Dicek ulang tiap 1 jam selama app dibiarkan terbuka (bukan cuma sekali
  // waktu app baru dibuka dari kondisi tertutup total) - supaya tingkat
  // harian/mingguan/bulanan/tahunan benar-benar bisa diandalkan jalan sendiri
  // walau app cuma di-resume dari recent-apps, tidak pernah ditutup total.
  setInterval(checkBackupBerlapis, 60*60*1000);
}
bootApp();
