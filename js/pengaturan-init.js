/* ================= PENGATURAN (layar gabungan Cadangan Data) =================
 * 1 pintu drawer -> layar list (Backup/Restore/Riwayat/Jadwal/Akun). Tiap baris
 * membuka sub-tampilan di dalam modal yang sama (bukan modal baru), lalu tombol
 * kembali (←) memanggil openPengaturanScreen() lagi. Pola ini konsisten dengan
 * flow tampilkanPreviewRestore/jalankanRestore yang sudah ada sebelumnya.
 */
function labelMetode(m){ return m==='cloud' ? 'Dropbox' : 'Lokal (HP)'; }
function metodeDefaultBackup(){ return BACKUP_META.autoMethod || 'lokal'; }

function openPengaturanScreen(){
  closeDrawer();
  const tgl = BACKUP_META.lastBackupAt ? new Date(BACKUP_META.lastBackupAt).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-';
  const akunLabel = BACKUP_META.dropboxAccountName;
  const jadwalLabel = BACKUP_META.scheduleMode==='tanggal'
    ? ('Tgl '+(BACKUP_META.scheduleDate||5))
    : ((BACKUP_META.scheduleInterval||BACKUP_AUTO_DAYS)+' hari');
  openModal(`
    <div class="mhead"><h2>Pengaturan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
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
    <div class="pgt-row" onclick="jalankanBackupCepat()"><span class="pgt-l">Backup</span><span class="pgt-r">${labelMetode(metodeDefaultBackup())}</span></div>
    <div class="pgt-row" onclick="openPengaturanRestore()"><span class="pgt-l">Restore</span><span class="pgt-r">-<span class="pgt-chev">›</span></span></div>
    <div class="pgt-row" onclick="openPengaturanRiwayat()"><span class="pgt-l">Riwayat</span><span class="pgt-r">${tgl}<span class="pgt-chev">›</span></span></div>
    <div class="pgt-row" onclick="openPengaturanJadwal()"><span class="pgt-l">Jadwal</span><span class="pgt-r">${jadwalLabel}<span class="pgt-chev">›</span></span></div>
    <div class="dgroup" style="padding-left:0;">Akun</div>
    <div class="pgt-row" style="border-bottom:none;" onclick="openPengaturanAkun()"><span class="pgt-l">Akun</span><span class="pgt-r">${akunLabel?escapeHtml(akunLabel):'Belum tersambung'}<span class="pgt-chev">›</span></span></div>
  `);
}

/* --- Backup: tap langsung eksekusi pakai metode default (diatur di tab Jadwal), tanpa dialog --- */
async function jalankanBackupCepat(){
  await buatBackupSekarang(metodeDefaultBackup(), false);
  openPengaturanScreen(); // refresh supaya status Akun (dropboxAccountName) & tanggal Riwayat langsung ke-update
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
        <div class="field-sub" style="margin-top:4px;">Metode: ${labelMetode(BACKUP_META.lastMethod)} &middot; ${BACKUP_META.uploadedToCloud?'Sudah di Dropbox':'Belum di-upload ke Dropbox'}</div>
      </div>
      <button class="btn-block outline" onclick="bagikanUlangBackup()">${ic('download')} Bagikan / Unduh Ulang File Ini</button>
      <button class="btn-block outline" style="margin-top:8px;" onclick="uploadUlangKeDropboxManual()">${ic('sync')} Upload ke Dropbox</button>
    ` : `
      <div class="field-sub">Belum ada backup yang pernah dibuat di HP ini.</div>
    `}
  `);
}

/* --- Jadwal: interval hari ATAU tanggal tetap tiap bulan, + metode default --- */
function openPengaturanJadwal(){
  // Tahap 1 fix #3: tandai bahwa user sudah pernah membuka menu Jadwal —
  // dipakai checkAutoBackupBulanan() sebagai salah satu syarat sebelum
  // auto-backup boleh jalan senyap (supaya tidak jalan sebelum user tahu
  // menu ini ada, mis. langsung setelah instal pertama).
  if(!BACKUP_META.jadwalPernahDibuka){
    BACKUP_META.jadwalPernahDibuka = true;
    saveBackupMeta();
  }
  const mode = BACKUP_META.scheduleMode || 'interval';
  const interval = BACKUP_META.scheduleInterval || BACKUP_AUTO_DAYS;
  const tanggal = BACKUP_META.scheduleDate || 5;
  const metode = metodeDefaultBackup();
  const opsiHari = [7,14,30,60,90];
  const opsiTgl = [1,5,15,25];
  openModal(`
    <div class="mhead"><button class="mclose" onclick="openPengaturanScreen()" style="margin-right:4px;">←</button><h2 style="display:inline;">Jadwal</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="chk-row"><input type="checkbox" id="chk-auto-backup" ${BACKUP_META.autoEnabled!==false?'checked':''}><label for="chk-auto-backup" style="margin-left:6px;">Aktifkan backup otomatis</label></div>
    <div class="radio-card ${mode==='interval'?'active':''}" onclick="pilihModeJadwal('interval')">
      <input type="radio" name="jmode" ${mode==='interval'?'checked':''}>
      <div>
        <div style="font-weight:700;font-size:13.5px;">Tiap beberapa hari</div>
        <div class="field-sub">Dicek tiap app dibuka, jalan senyap kalau sudah lewat interval.</div>
        <select id="sel-interval" style="margin-top:8px;" onclick="event.stopPropagation()">
          ${opsiHari.map(h=>`<option value="${h}" ${h===interval?'selected':''}>${h} hari</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="radio-card ${mode==='tanggal'?'active':''}" onclick="pilihModeJadwal('tanggal')">
      <input type="radio" name="jmode" ${mode==='tanggal'?'checked':''}>
      <div>
        <div style="font-weight:700;font-size:13.5px;">Tanggal tetap tiap bulan</div>
        <div class="field-sub">Backup senyap saat app dibuka pada/setelah tanggal ini.</div>
        <select id="sel-tanggal" style="margin-top:8px;" onclick="event.stopPropagation()">
          ${opsiTgl.map(t=>`<option value="${t}" ${t===tanggal?'selected':''}>Tanggal ${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="dgroup" style="padding-left:0;">Metode Otomatis &amp; Manual</div>
    <select id="sel-metode" style="margin-bottom:6px;">
      <option value="lokal" ${metode==='lokal'?'selected':''}>Lokal (HP)</option>
      <option value="cloud" ${metode==='cloud'?'selected':''}>Dropbox</option>
    </select>
    <div class="field-sub" style="margin-bottom:10px;">Dipakai untuk backup otomatis maupun tombol "Backup" cepat.</div>
    <div id="jadwal-konfirm-area"></div>
    <button class="btn-block" style="margin-top:8px;" onclick="konfirmasiSimpanJadwal()">Simpan</button>
  `);
}
function pilihModeJadwal(mode){
  document.querySelectorAll('#modalSheet .radio-card').forEach(el=>el.classList.remove('active'));
  const idx = mode==='interval' ? 0 : 1;
  document.querySelectorAll('#modalSheet .radio-card')[idx].classList.add('active');
  document.querySelectorAll('#modalSheet input[name=jmode]').forEach((el,i)=>el.checked=(i===idx));
}
function konfirmasiSimpanJadwal(){
  const mode = document.querySelectorAll('#modalSheet input[name=jmode]')[0].checked ? 'interval' : 'tanggal';
  const interval = parseInt(document.getElementById('sel-interval').value, 10);
  const tanggal = parseInt(document.getElementById('sel-tanggal').value, 10);
  const metode = document.getElementById('sel-metode').value;
  const label = mode==='interval' ? ('Tiap '+interval+' hari') : ('Tanggal '+tanggal+' tiap bulan');
  document.getElementById('jadwal-konfirm-area').innerHTML = `
    <div class="card card-flat" style="margin-top:4px;">
      <div class="field-sub">Simpan jadwal berikut?</div>
      <div style="font-weight:800;font-size:14px;margin-top:2px;">${label} &middot; ${labelMetode(metode)}</div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn-block outline" style="margin:0;flex:1;" onclick="document.getElementById('jadwal-konfirm-area').innerHTML=''">Batal</button>
        <button class="btn-block" style="margin:0;flex:1;" onclick="simpanJadwal('${mode}',${interval},${tanggal},'${metode}')">Ya, Simpan</button>
      </div>
    </div>
  `;
}
async function simpanJadwal(mode, interval, tanggal, metode){
  BACKUP_META.autoEnabled = document.getElementById('chk-auto-backup').checked;
  BACKUP_META.scheduleMode = mode;
  BACKUP_META.scheduleInterval = interval;
  BACKUP_META.scheduleDate = tanggal;
  BACKUP_META.autoMethod = metode;
  await saveBackupMeta(); // tunggu benar-benar tersimpan ke SQLite dulu, baru kasih tahu user "sudah tersimpan"
  toast('Jadwal disimpan');
  openPengaturanScreen();
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

/* --- Auto-backup: dijalankan senyap tiap app dibuka, sesuai mode jadwal yang dipilih --- */
function hariBerlaluSejak(iso){
  if(!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000*60*60*24);
}
function tanggalJatuhTempoTerakhir(tanggal){
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), tanggal, 0,0,0);
  if(d.getTime() > now.getTime()){
    d = new Date(now.getFullYear(), now.getMonth()-1, tanggal, 0,0,0);
  }
  return d.getTime();
}
function checkAutoBackupBulanan(){
  if(BACKUP_META.autoEnabled===false) return;
  // Tahap 1 fix #3: jangan auto-backup senyap kalau (a) belum ada data
  // tersimpan sama sekali (mis. baru instal), atau (b) user belum pernah
  // membuka menu Jadwal sekalipun (jadi belum sempat lihat/atur pengaturan
  // backup-nya). Kalau salah satu belum terpenuhi, auto-backup di-skip dulu
  // (pending) — akan otomatis jalan begitu keduanya terpenuhi di kunjungan
  // berikutnya.
  const adaData = Array.isArray(ENTRIES) && ENTRIES.length > 0;
  if(!adaData || !BACKUP_META.jadwalPernahDibuka) return;
  const mode = BACKUP_META.scheduleMode || 'interval';
  let jatuhTempo;
  if(mode==='tanggal'){
    const tanggal = BACKUP_META.scheduleDate || 5;
    const target = tanggalJatuhTempoTerakhir(tanggal);
    jatuhTempo = !BACKUP_META.lastBackupAt || new Date(BACKUP_META.lastBackupAt).getTime() < target;
  } else {
    const interval = BACKUP_META.scheduleInterval || BACKUP_AUTO_DAYS;
    jatuhTempo = !BACKUP_META.lastBackupAt || hariBerlaluSejak(BACKUP_META.lastBackupAt) >= interval;
  }
  if(jatuhTempo){
    buatBackupSekarang(BACKUP_META.autoMethod || 'lokal', true);
  }
}
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
    PETA_BLOCKS = LS.get('v2_peta_blocks', []);
    DRIVER_LIST = LS.get('v2_program_driver', []);
    PROGRAM_RENCANA = LS.get('v2_program_rencana', []);
    PROGRAM_AKTUAL = LS.get('v2_program_aktual', []);
    PIKET_JAM_LAYANAN = LS.get('v2_piket_jam_layanan', []);
    PROGRAM_TANDA_LL = LS.get('v2_program_tanda_ll', []);
    PK_DRONE_TIPE_LIST = LS.get('v2_pk_dronetipe', ['ZPK','Prevatone']);
    PK_SHIFT_LIST = LS.get('v2_pk_shift', ['Pagi','Siang']);
    LAYANAN_SINGKATAN = LS.get('v2_layanan_singkatan', {});
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
      scheduleMode:'interval', scheduleInterval:BACKUP_AUTO_DAYS, scheduleDate:5, autoMethod:'lokal',
      jadwalPernahDibuka:false
    });
    WEATHER = LS.get('v2_weather_cache', null);
    WEATHER_LOG = LS.get('v2_weather_log', []);
  }catch(err){
    console.error('Gagal inisialisasi database:', err);
    alert('Gagal memuat database: ' + (err && err.message ? err.message : err) + '\n\nApp tetap dibuka, tapi data mungkin tidak lengkap. Coba tutup & buka ulang app.');
  }
  sembunyikanLoadingAwal();
  showScreen('beranda');
  fetchWeatherIfNeeded();
  checkAutoBackupBulanan();
}
bootApp();
