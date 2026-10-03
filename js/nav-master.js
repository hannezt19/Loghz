/* ================= NAVIGATION ================= */
/* Daftar nama Vendor/Operator/Mandor digabung jadi 1 (bukan dipisah per
 * kategori) - dari nama itu sendiri Han sudah tahu itu vendor/operator/mandor,
 * jadi tidak perlu sistem menyimpan kategorinya. Dipakai sebagai saran (mirip
 * lokasiSuggest) di field "Nama" pada Jenis Layanan Antar/Jemput Tenaga,
 * Drone, dan Operator. */
let NAMA_LIST = LS.get('v2_nama_list', []); // [{id, nama}]
function saveNamaList(){ LS.set('v2_nama_list', NAMA_LIST); }
const TITLES = {
  beranda:['BERANDA', 'Ringkasan'],
  hari:['HARI INI', ()=>fmtLabel(todayIso())],
  proker:['PROKER', 'Program Kerja'],
  peta:['PETA', 'Lokasi Kerja'],
  rekap:['REKAP', 'Riwayat & Laporan']
};
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.getElementById('screens').classList.toggle('no-pad', name==='peta');
  document.querySelectorAll('#bottomnav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  const t = TITLES[name];
  document.getElementById('tb-eyebrow').textContent = t[0];
  document.getElementById('tb-title').textContent = typeof t[1]==='function' ? t[1]() : t[1];
  document.getElementById('tb-badge').textContent = USER.mainBt ? btLabel(USER.mainBt) : '-';
  if(name==='beranda'){ renderBeranda(); fetchWeatherIfNeeded(); }
  if(name==='hari') renderHari();
  if(name==='proker') renderProker();
  if(name==='rekap') renderRekap();
  if(name==='peta') renderPeta();
}
function btLabel(id){ const u = UNITS.find(x=>x.id===id); return u ? u.kode : '-'; }

/* ================= DRAWER ================= */
function openDrawer(){
  document.getElementById('dw-name').textContent = USER.name || 'Nama belum diisi';
  document.getElementById('dw-unit').textContent = 'Unit default: '+(USER.mainBt ? btLabel(USER.mainBt) : '-');
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('drawer').classList.add('show');
}
function closeDrawer(){
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
}

/* ================= MODAL HELPER ================= */
function openModal(html){
  document.getElementById('modalSheet').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('show'); }

/* ================= PENGATURAN AKUN ================= */
function openSettingAkun(){
  closeDrawer();
  openModal(`
    <div class="mhead"><h2>Pengaturan Akun</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Nama Kamu</label>
    <input type="text" id="setNama" value="${escapeHtml(USER.name)}" placeholder="mis. Yohanes">
    <label class="flabel">Unit Default</label>
    <select id="setUnit">
      <option value="">- Pilih unit -</option>
      ${UNITS.map(u=>`<option value="${u.id}" ${USER.mainBt===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
    </select>
    <button class="btn-block" onclick="saveSettingAkun()">Simpan</button>
  `);
}
function saveSettingAkun(){
  USER.name = document.getElementById('setNama').value.trim();
  USER.mainBt = document.getElementById('setUnit').value;
  saveUser();
  closeModal();
  toast('Pengaturan akun disimpan');
  showScreen(document.querySelector('#bottomnav button.active').dataset.tab);
}

/* ================= KELOLA UNIT ================= */
function openKelolaUnit(){
  closeDrawer();
  renderKelolaUnitModal();
}
function renderKelolaUnitModal(){
  const unitAsli = UNITS.filter(u=>!u.isSystem);
  const unitSistem = UNITS.filter(u=>u.isSystem);
  const orphans = findOrphanUnitIds();
  openModal(`
    <div class="mhead"><h2>Kelola No Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newUnitKode" placeholder="mis. BT.14" style="margin-bottom:0;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();">
      <button class="pill-btn" onclick="addUnit()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${unitAsli.length===0 ? '<div class="empty-note">Belum ada unit. Tambahkan di atas.</div>' :
        unitAsli.map(u=>`<div class="list-row" style="cursor:pointer;" onclick="openUnitEditModal('${u.id}')"><span>${escapeHtml(u.kode)}</span>${ic('edit',16)}</div>`).join('')}
    </div>
    <div class="field-sub" style="margin:8px 0 12px;">Tap sebuah unit untuk mengubah nama atau menghapusnya.</div>
    ${orphans.length>0 ? `<div class="card card-flat" style="border:1px solid var(--secondary);cursor:pointer;margin-bottom:12px;" onclick="openOrphanUnitList()"><div class="field-sub" style="color:var(--secondary);font-weight:700;">${orphans.length} unit lama datanya masih ada tapi labelnya hilang &middot; tap untuk pulihkan</div></div>` : ''}
    <div class="field-sub" style="margin:12px 0 4px;">Bawaan aplikasi (tidak bisa dihapus)</div>
    <div class="card card-flat">
      ${unitSistem.map(u=>`<div class="list-row"><span style="color:var(--on-surface-variant);font-style:italic;">${escapeHtml(u.kode)}</span></div>`).join('')}
    </div>
  `);
}

/* ================= UNIT YATIM (label hilang) =================
 * Sebelum ada dialog konfirmasi kustom, "Hapus Unit" pakai confirm() bawaan
 * browser dan langsung menghapus definisi unit dari UNITS - TANPA memindah
 * data lama. Akibatnya semua data yang dulu memakai unit itu (ENTRIES.btId,
 * SERVIS.btId, HM_RESETS.btId, BBM_SUSULAN.btId, PROGRAM_RENCANA.unitId,
 * PROGRAM_AKTUAL.unitId, USER.mainBt) TETAP menyimpan ID unit itu, cuma
 * tidak ketemu lagi definisinya di UNITS sehingga labelnya tampil "-".
 * Fungsi di bawah mencari semua ID "yatim" begini supaya bisa dipulihkan
 * (buat ulang unit dengan ID persis sama -> label langsung kembali) atau
 * digabung ke unit yang sudah ada sekarang. */
function findOrphanUnitIds(){
  const known = new Set(UNITS.map(u=>u.id));
  const found = {};
  function ensure(id){
    if(!found[id]) found[id] = {entries:0,servis:0,hmresets:0,bbm:0,rencana:0,aktual:0,mainBt:false,sampleDates:[]};
    return found[id];
  }
  function hit(id, type, date){
    if(!id || known.has(id)) return;
    const f = ensure(id);
    f[type]++;
    if(date && f.sampleDates.length<3 && !f.sampleDates.includes(date)) f.sampleDates.push(date);
  }
  ENTRIES.forEach(e=>hit(e.btId,'entries',e.date));
  SERVIS.forEach(s=>hit(s.btId,'servis',s.date));
  HM_RESETS.forEach(h=>hit(h.btId,'hmresets',h.date));
  BBM_SUSULAN.forEach(b=>hit(b.btId,'bbm',b.tanggal));
  PROGRAM_RENCANA.forEach(r=>hit(r.unitId,'rencana',r.tanggalMulai));
  PROGRAM_AKTUAL.forEach(a=>hit(a.unitId,'aktual',a.tanggal));
  if(USER.mainBt && !known.has(USER.mainBt)) ensure(USER.mainBt).mainBt = true;
  return Object.keys(found).map(id=>({id, ...found[id]}));
}
function orphanTotalCount(o){ return o.entries+o.servis+o.hmresets+o.bbm+o.rencana+o.aktual+(o.mainBt?1:0); }
function openOrphanUnitList(){ renderOrphanUnitList(); }
function renderOrphanUnitList(){
  const orphans = findOrphanUnitIds();
  openModal(`
    <div class="mhead"><h2>Unit Lama (Label Hilang)</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${orphans.length===0 ? '<div class="empty-note">Tidak ada lagi - semua data sudah punya label unit.</div>' : `
    <div class="field-sub" style="margin-bottom:12px;">ID unit ini dulu terhapus, tapi datanya masih tersimpan utuh. "Pulihkan" untuk kasih nama lagi (data langsung kembali ketemu labelnya), atau "Gabungkan" untuk pindahkan ke unit yang sudah ada sekarang.</div>
    ${orphans.map(o=>`
      <div class="card card-flat" style="margin-bottom:10px;">
        <div style="font-weight:700;margin-bottom:4px;">${orphanTotalCount(o)} data${o.mainBt?' &middot; termasuk unit default akun':''}</div>
        <div class="field-sub" style="margin-bottom:8px;">${[o.entries&&o.entries+' Hari Ini',o.rencana&&o.rencana+' Program',o.aktual&&o.aktual+' Aktual',o.servis&&o.servis+' Servis',o.bbm&&o.bbm+' BBM Susulan',o.hmresets&&o.hmresets+' Reset HM'].filter(Boolean).join(' &middot; ')}${o.sampleDates.length?'<br>Contoh tanggal: '+o.sampleDates.map(fmtTanggalSingkat).join(', '):''}</div>
        <div style="display:flex;gap:8px;">
          <button class="pill-btn sm" onclick="promptRestoreOrphanUnit('${o.id}')">Pulihkan Sebagai Unit Baru</button>
          <button class="pill-btn sm outline" onclick="openOrphanMergePicker('${o.id}')">Gabungkan</button>
        </div>
      </div>
    `).join('')}
    `}
  `);
}
function promptRestoreOrphanUnit(id){ renderRestoreOrphanUnitModal(id); }
function renderRestoreOrphanUnitModal(id){
  openModal(`
    <div class="mhead"><h2>Pulihkan Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Nama unit ini dulu apa? (lihat contoh tanggal di layar sebelumnya untuk bantu ingat)</label>
    <input type="text" id="restoreUnitKode" placeholder="mis. BT.12" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();">
    <div class="field-sub" style="margin-bottom:14px;">Unit akan dibuat ulang dengan ID yang sama persis seperti dulu, jadi semua data lama otomatis langsung ketemu labelnya lagi - tidak ada yang perlu dipindah manual.</div>
    <button class="pill-btn" style="width:100%;justify-content:center;" onclick="restoreOrphanUnit('${id}')">Pulihkan</button>
  `);
}
function restoreOrphanUnit(id){
  const val = document.getElementById('restoreUnitKode').value.trim().toUpperCase();
  if(!val){ toast('Isi nama unit dulu'); return; }
  if(UNITS.some(u=>u.kode.toLowerCase()===val.toLowerCase())){ toast('Unit ini sudah ada - pakai "Gabungkan" saja'); return; }
  const idxSistem = UNITS.findIndex(u=>u.isSystem);
  const baru = {id, kode:val};
  if(idxSistem<0) UNITS.push(baru); else UNITS.splice(idxSistem, 0, baru);
  saveUnits();
  closeModal();
  toast('Unit dipulihkan, label lama kembali');
  showScreen(document.querySelector('#bottomnav button.active').dataset.tab);
}
function openOrphanMergePicker(id){ renderOrphanMergePicker(id); }
function renderOrphanMergePicker(id){
  const target = UNITS.filter(u=>!u.isSystem);
  if(target.length===0){
    openModal(`<div class="mhead"><h2>Gabungkan Unit Lama</h2><button class="mclose" onclick="closeModal()">&times;</button></div><div class="empty-note">Belum ada unit untuk dijadikan tujuan. Tambahkan unit dulu lewat "+ Tambah".</div>`);
    return;
  }
  openModal(`
    <div class="mhead"><h2>Gabungkan Unit Lama</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Pindahkan semua datanya ke:</label>
    <select id="orphanMergeTarget">${target.map(t=>`<option value="${t.id}">${escapeHtml(t.kode)}</option>`).join('')}</select>
    <div class="field-sub" style="margin:10px 0 16px;">Tindakan ini tidak bisa dibatalkan.</div>
    <button class="pill-btn" style="width:100%;justify-content:center;" onclick="mergeUnitInto('${id}', document.getElementById('orphanMergeTarget').value)">Gabungkan Sekarang</button>
  `);
}
function addUnit(){
  const val = document.getElementById('newUnitKode').value.trim().toUpperCase();
  if(!val){ toast('Isi nomor unit dulu'); return; }
  if(UNITS.some(u=>u.kode.toLowerCase()===val.toLowerCase())){ toast('Unit ini sudah ada'); return; }
  // Sisipkan sebelum unit sistem (Libur/Standby) supaya unit sistem selalu tetap di posisi paling akhir penyimpanan
  const idxSistem = UNITS.findIndex(u=>u.isSystem);
  const baru = {id:uid(), kode:val};
  if(idxSistem<0) UNITS.push(baru); else UNITS.splice(idxSistem, 0, baru);
  saveUnits();
  renderKelolaUnitModal();
  toast('Unit ditambahkan');
}

/* ----- Edit 1 unit (dibuka dari tap baris di Kelola Unit) -----
 * Rename di sini TIDAK memutus data lama sama sekali, karena semua data
 * (ENTRIES, Program Kerja, Servis, dst) menyimpan referensi lewat `id` unit,
 * bukan teks kodenya. Jadi kalau cuma salah ketik (mis. "bt 12" -> "BT.12"),
 * cukup ganti nama di sini - TIDAK PERLU hapus+tambah baru. */
function openUnitEditModal(id){ renderUnitEditModal(id); }
function renderUnitEditModal(id){
  const u = UNITS.find(x=>x.id===id);
  if(!u) return;
  openModal(`
    <div class="mhead"><h2>Edit Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">No Unit</label>
    <input type="text" id="editUnitKode" value="${escapeHtml(u.kode)}" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();">
    <div class="field-sub" style="margin-bottom:14px;">Salah ketik? Ganti namanya saja di sini - semua data lama (Hari Ini, Program Kerja, Servis, BBM, dll) otomatis tetap ikut, tidak perlu hapus lalu buat baru.</div>
    <label class="flabel">Kapasitas Tangki BBM (Liter)</label>
    <input type="number" id="editUnitKapasitas" value="${u.kapasitas || 200}">
    <div class="field-sub" style="margin-bottom:14px;">Dipakai untuk perkiraan sisa BBM di fitur Cek Indikator BBM.</div>
    <button class="pill-btn" style="width:100%;justify-content:center;margin-bottom:16px;" onclick="saveUnitKode('${u.id}')">Simpan</button>
    <div style="border-top:1px solid var(--outline-variant);padding-top:14px;">
      <div class="field-sub" style="font-weight:700;color:var(--secondary);margin-bottom:8px;">Zona Bahaya</div>
      <button class="icon-btn" style="color:var(--secondary);" onclick="openDeleteUnitConfirm('${u.id}')">${ic('trash')} Hapus Unit Ini</button>
    </div>
  `);
}
function saveUnitKode(id){
  const val = document.getElementById('editUnitKode').value.trim().toUpperCase();
  if(!val){ toast('Isi nomor unit dulu'); return; }
  if(UNITS.some(x=>x.id!==id && x.kode.toLowerCase()===val.toLowerCase())){ toast('Nama ini sudah dipakai unit lain'); return; }
  const u = UNITS.find(x=>x.id===id);
  if(!u) return;
  u.kode = val;
  const kapEl = document.getElementById('editUnitKapasitas');
  if(kapEl && kapEl.value && !isNaN(parseFloat(kapEl.value))) u.kapasitas = parseFloat(kapEl.value);
  saveUnits();
  renderKelolaUnitModal();
  toast('Unit diperbarui');
}

/* ----- Dialog konfirmasi hapus unit (menggantikan confirm() bawaan browser) -----
 * 2 pilihan: Gabungkan dulu ke unit lain (migrasi semua data lama supaya
 * TIDAK jadi yatim), atau Hapus Permanen (perilaku lama - data lama tidak
 * terhapus, tapi labelnya hilang karena tidak terhubung ke unit manapun). */
function openDeleteUnitConfirm(id){ renderDeleteUnitConfirm(id); }
function renderDeleteUnitConfirm(id){
  const u = UNITS.find(x=>x.id===id);
  if(!u) return;
  openModal(`
    <div class="mhead"><h2>Hapus "${escapeHtml(u.kode)}"?</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:16px;">Pilih salah satu:</div>
    <button class="pill-btn" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="openMergeUnitPicker('${u.id}')">Gabungkan ke Unit Lain</button>
    <div class="field-sub" style="margin-bottom:16px;">Semua data lama yang memakai "${escapeHtml(u.kode)}" dipindah ke unit tujuan, baru "${escapeHtml(u.kode)}" dihapus. Cocok kalau unit ini duplikat/salah ketik.</div>
    <button class="icon-btn" style="width:100%;justify-content:center;color:var(--secondary);border:1px solid var(--secondary);margin-bottom:8px;" onclick="deleteUnitConfirmed('${u.id}')">${ic('trash')} Hapus Permanen (Tanpa Pindah Data)</button>
    <div class="field-sub">Data lama TIDAK terhapus, tapi labelnya jadi "-" karena tidak terhubung ke unit manapun lagi. Cocok kalau unit ini memang sudah tidak dipakai sama sekali.</div>
  `);
}
function deleteUnitConfirmed(id){
  if(isSystemUnitId(id)){ toast('Unit bawaan ini tidak bisa dihapus'); return; }
  UNITS = UNITS.filter(u=>u.id!==id);
  saveUnits();
  closeModal();
  toast('Unit dihapus');
}

/* ----- Gabungkan unit: pindahkan semua rujukan dari unit lama ke unit tujuan,
 * baru hapus unit lama. Ini yang dipakai untuk kasus "salah ketik BT 12,
 * sudah kadung buat unit baru BT.12, data lama masih nempel di yang salah". */
function openMergeUnitPicker(id){ renderMergeUnitPicker(id); }
function renderMergeUnitPicker(id){
  const u = UNITS.find(x=>x.id===id);
  if(!u) return;
  const target = UNITS.filter(x=>x.id!==id && !x.isSystem);
  if(target.length===0){
    openModal(`
      <div class="mhead"><h2>Gabungkan "${escapeHtml(u.kode)}"</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
      <div class="empty-note">Belum ada unit lain untuk dijadikan tujuan. Tambahkan unit tujuannya dulu lewat "+ Tambah".</div>
    `);
    return;
  }
  openModal(`
    <div class="mhead"><h2>Gabungkan "${escapeHtml(u.kode)}"</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Pindahkan semua data "${escapeHtml(u.kode)}" ke:</label>
    <select id="mergeTargetUnit">
      ${target.map(t=>`<option value="${t.id}">${escapeHtml(t.kode)}</option>`).join('')}
    </select>
    <div class="field-sub" style="margin:10px 0 16px;">Setelah digabung, "${escapeHtml(u.kode)}" akan dihapus dan semua data lamanya tercatat sebagai unit tujuan. Tindakan ini tidak bisa dibatalkan.</div>
    <button class="pill-btn" style="width:100%;justify-content:center;" onclick="mergeUnitInto('${u.id}', document.getElementById('mergeTargetUnit').value)">Gabungkan Sekarang</button>
  `);
}
/* Pindahkan semua rujukan unit lama -> unit tujuan di SELURUH data app
 * (ENTRIES/Hari Ini, Servis, Reset HM, BBM Susulan, Program Kerja, unit
 * default akun), lalu hapus unit lama. */
function mergeUnitInto(oldId, newId){
  if(!oldId || !newId || oldId===newId) return;
  let n = 0;
  ENTRIES.forEach(e=>{ if(e.btId===oldId){ e.btId=newId; n++; } }); saveEntries();
  SERVIS.forEach(s=>{ if(s.btId===oldId){ s.btId=newId; n++; } }); saveServis();
  HM_RESETS.forEach(h=>{ if(h.btId===oldId){ h.btId=newId; n++; } }); saveHmResets();
  BBM_SUSULAN.forEach(b=>{ if(b.btId===oldId){ b.btId=newId; n++; } }); saveBbmSusulan();
  PROGRAM_RENCANA.forEach(r=>{ if(r.unitId===oldId){ r.unitId=newId; n++; } }); saveProgramRencana();
  PROGRAM_AKTUAL.forEach(a=>{ if(a.unitId===oldId){ a.unitId=newId; n++; } }); saveProgramAktual();
  if(USER.mainBt===oldId){ USER.mainBt=newId; saveUser(); }
  UNITS = UNITS.filter(u=>u.id!==oldId);
  saveUnits();
  closeModal();
  toast('Digabungkan, '+n+' data lama ikut pindah');
  showScreen(document.querySelector('#bottomnav button.active').dataset.tab);
}

/* ================= KELOLA BLOK ================= */
function openKelolaBlok(){
  closeDrawer();
  renderKelolaBlokModal();
}
function renderKelolaBlokModal(){
  openModal(`
    <div class="mhead"><h2>Kelola No Blok</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newBlokKode" placeholder="mis. 11 TS 22" oninput="this.value=fmtBlokKode(this.value)" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addBlok()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${BLOKS.length===0 ? '<div class="empty-note">Belum ada blok. Tambahkan di atas.</div>' :
        `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:14px;">
          ${BLOKS.map(b=>`<div class="list-row" style="padding:9px 0;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.kode)}</span><button class="icon-btn" onclick="deleteBlok('${b.id}')">${ic('trash')}</button></div>`).join('')}
        </div>`}
    </div>
  `);
}
function addBlok(){
  const val = document.getElementById('newBlokKode').value.trim();
  if(!val){ toast('Isi nomor blok dulu'); return; }
  if(BLOKS.some(b=>b.kode.toLowerCase()===val.toLowerCase())){ toast('Blok ini sudah ada'); return; }
  BLOKS.push({id:uid(), kode:val});
  saveBloks();
  renderKelolaBlokModal();
  toast('Blok ditambahkan');
}
function deleteBlok(id){
  if(!confirm('Hapus blok ini?')) return;
  BLOKS = BLOKS.filter(b=>b.id!==id);
  saveBloks();
  renderKelolaBlokModal();
  toast('Blok dihapus');
}
/* ================= KELOLA NAMA (Vendor/Operator/Mandor) =================
 * 1 daftar saja untuk semuanya - lihat catatan di deklarasi NAMA_LIST di
 * atas kenapa tidak dipisah per kategori. */
function openKelolaNama(){
  closeDrawer();
  renderKelolaNamaModal();
}
function renderKelolaNamaModal(){
  openModal(`
    <div class="mhead"><h2>Kelola Nama</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:10px;">Untuk vendor, operator, atau mandor - satu daftar saja, tidak perlu dipilih kategorinya.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newNamaOrang" placeholder="mis. Budi / Vendor A" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addNamaOrang()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${NAMA_LIST.length===0 ? '<div class="empty-note">Belum ada nama. Tambahkan di atas.</div>' :
        `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:14px;">
          ${NAMA_LIST.map(n=>`<div class="list-row" style="padding:9px 0;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n.nama)}</span><button class="icon-btn" onclick="deleteNamaOrang('${n.id}')">${ic('trash')}</button></div>`).join('')}
        </div>`}
    </div>
  `);
}
function addNamaOrang(){
  const val = document.getElementById('newNamaOrang').value.trim();
  if(!val){ toast('Isi nama dulu'); return; }
  if(NAMA_LIST.some(n=>n.nama.toLowerCase()===val.toLowerCase())){ toast('Nama ini sudah ada'); return; }
  NAMA_LIST.push({id:uid(), nama:val});
  saveNamaList();
  renderKelolaNamaModal();
  toast('Nama ditambahkan');
}
function deleteNamaOrang(id){
  if(!confirm('Hapus nama ini?')) return;
  NAMA_LIST = NAMA_LIST.filter(n=>n.id!==id);
  saveNamaList();
  renderKelolaNamaModal();
  toast('Nama dihapus');
}
/* ================= KELOLA JENIS LAYANAN / TIPE (ANTAR-JEMPUT) / KEGIATAN =================
 * Satu mesin yang sama untuk ketiga daftar. Fitur:
 * - Ganti nama (ikon pensil): nama baru ikut diterapkan ke SEMUA catatan lama
 *   (Hari Ini/Rekap, Program Kerja, jam otomatis & singkatan), jadi riwayat
 *   tidak terpecah jadi dua nama.
 * - Penanda "dipakai N kali" di tiap item.
 * - Hapus hanya mencabut item dari daftar PILIHAN. Catatan lama TIDAK diubah
 *   dan tetap tampil di Rekap & cetak.
 * - 5 Jenis Layanan inti dikunci (tidak bisa diganti nama/dihapus) karena
 *   logika app (form, Program Kerja, cetak) mengenali mereka lewat namanya. */
const JENIS_INTI = ['Antar/Jemput Tenaga','Loading','Drone','Operator','Ekstra Pagi'];
const KELOLA_CFG = {
  jenis:     {judul:'Kelola Jenis Layanan', kata:'jenis layanan', placeholder:'mis. Perawatan Jalan', kosong:'Belum ada jenis layanan.'},
  tipeAntar: {judul:'Kelola Tipe (Antar/Jemput)', kata:'tipe', placeholder:'mis. Tebang', kosong:'Belum ada tipe. Tambahkan di atas.'},
  kegiatan:  {judul:'Kelola Kegiatan', kata:'kegiatan', placeholder:'mis. Pemupukan', kosong:'Belum ada kegiatan. Tambahkan di atas.'},
  ekstraTipe:{judul:'Kelola Tipe (Ekstra Pagi)', kata:'tipe', placeholder:'mis. Ngupu', kosong:'Belum ada tipe. Tambahkan di atas.'}
};
function kelolaList(kind){ return kind==='jenis' ? JENIS_LAYANAN_LIST : (kind==='tipeAntar' ? TIPE_ANTAR_LIST : (kind==='ekstraTipe' ? EKSTRA_TIPE_LIST : KEGIATAN_LIST)); }
function kelolaSetList(kind, arr){
  if(kind==='jenis'){ JENIS_LAYANAN_LIST = arr; saveJenisList(); }
  else if(kind==='tipeAntar'){ TIPE_ANTAR_LIST = arr; saveTipeAntarList(); }
  else if(kind==='ekstraTipe'){ EKSTRA_TIPE_LIST = arr; saveEkstraTipeList(); }
  else { KEGIATAN_LIST = arr; saveKegiatanList(); }
}
function kelolaTerkunci(kind, val){ return kind==='jenis' && (JENIS_INTI.includes(val) || isEkstraPagi(val)); }
/* Hitung berapa kali sebuah nama dipakai di catatan (Hari Ini/Rekap + Program Kerja). */
function kelolaHitungPakai(kind, val){
  let n = 0;
  if(kind==='jenis'){
    ENTRIES.forEach(e=>['jenisLayanan','jenisLayanan2','jenisLayanan3'].forEach(k=>{ if(e[k]===val) n++; }));
    PROGRAM_RENCANA.forEach(r=>{ if(r.layanan===val) n++; });
    PROGRAM_AKTUAL.forEach(a=>{ if(a.layanan===val) n++; if(a.lanjutLayanan===val) n++; });
  } else if(kind==='tipeAntar'){
    ENTRIES.forEach(e=>['tipeAntar','tipeAntar2','tipeAntar3'].forEach(k=>{ if(e[k]===val) n++; }));
    PROGRAM_RENCANA.forEach(r=>{ if(r.layanan==='Antar/Jemput Tenaga' && r.tipe===val) n++; });
    PROGRAM_AKTUAL.forEach(a=>{
      if(a.layanan==='Antar/Jemput Tenaga' && a.tipe===val) n++;
      if(a.lanjutLayanan==='Antar/Jemput Tenaga' && a.lanjutTipe===val) n++;
    });
  } else if(kind==='ekstraTipe'){
    ENTRIES.forEach(e=>['ekstraTipe','ekstraTipe2','ekstraTipe3'].forEach(k=>{ if(e[k]===val) n++; }));
  } else {
    ENTRIES.forEach(e=>['kegiatan','kegiatan2','kegiatan3'].forEach(k=>{ if(e[k]===val) n++; }));
  }
  return n;
}
/* Terapkan nama baru ke semua catatan lama + pengaturan terkait. */
function kelolaTerapkanGantiNama(kind, oldVal, newVal){
  if(kind==='jenis'){
    ENTRIES.forEach(e=>['jenisLayanan','jenisLayanan2','jenisLayanan3'].forEach(k=>{ if(e[k]===oldVal) e[k]=newVal; }));
    PROGRAM_RENCANA.forEach(r=>{ if(r.layanan===oldVal) r.layanan=newVal; });
    PROGRAM_AKTUAL.forEach(a=>{ if(a.layanan===oldVal) a.layanan=newVal; if(a.lanjutLayanan===oldVal) a.lanjutLayanan=newVal; });
    PIKET_JAM_LAYANAN.forEach(x=>{ if(x.layanan===oldVal) x.layanan=newVal; });
    if(Object.prototype.hasOwnProperty.call(LAYANAN_SINGKATAN, oldVal)){
      LAYANAN_SINGKATAN[newVal] = LAYANAN_SINGKATAN[oldVal];
      delete LAYANAN_SINGKATAN[oldVal];
    }
    saveEntries(); saveProgramRencana(); saveProgramAktual(); savePiketJamLayanan(); saveLayananSingkatan();
  } else if(kind==='tipeAntar'){
    const L = 'Antar/Jemput Tenaga';
    ENTRIES.forEach(e=>['tipeAntar','tipeAntar2','tipeAntar3'].forEach(k=>{ if(e[k]===oldVal) e[k]=newVal; }));
    PROGRAM_RENCANA.forEach(r=>{ if(r.layanan===L && r.tipe===oldVal) r.tipe=newVal; });
    PROGRAM_AKTUAL.forEach(a=>{
      if(a.layanan===L && a.tipe===oldVal) a.tipe=newVal;
      if(a.lanjutLayanan===L && a.lanjutTipe===oldVal) a.lanjutTipe=newVal;
    });
    PIKET_JAM_LAYANAN.forEach(x=>{ if(x.layanan===L && x.tipe===oldVal) x.tipe=newVal; });
    const kOld = L+'::'+oldVal, kNew = L+'::'+newVal;
    if(Object.prototype.hasOwnProperty.call(LAYANAN_SINGKATAN, kOld)){
      LAYANAN_SINGKATAN[kNew] = LAYANAN_SINGKATAN[kOld];
      delete LAYANAN_SINGKATAN[kOld];
    }
    saveEntries(); saveProgramRencana(); saveProgramAktual(); savePiketJamLayanan(); saveLayananSingkatan();
  } else if(kind==='ekstraTipe'){
    ENTRIES.forEach(e=>['ekstraTipe','ekstraTipe2','ekstraTipe3'].forEach(k=>{ if(e[k]===oldVal) e[k]=newVal; }));
    saveEntries();
  } else {
    ENTRIES.forEach(e=>['kegiatan','kegiatan2','kegiatan3'].forEach(k=>{ if(e[k]===oldVal) e[k]=newVal; }));
    saveEntries();
  }
}
function openKelolaJenis(){ closeDrawer(); renderKelolaModal('jenis'); }
function openKelolaTipeAntar(){ closeDrawer(); renderKelolaModal('tipeAntar'); }
function openKelolaKegiatan(){ closeDrawer(); renderKelolaModal('kegiatan'); }
function openKelolaEkstraTipe(){ closeDrawer(); renderKelolaModal('ekstraTipe'); }
function renderKelolaModal(kind){
  const cfg = KELOLA_CFG[kind];
  const list = kelolaList(kind);
  const lockSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;display:inline-block;"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  const rows = list.map((v,i)=>{
    const terkunci = kelolaTerkunci(kind, v);
    const n = kelolaHitungPakai(kind, v);
    const info = n>0 ? `<div class="field-sub" style="margin:0;">dipakai ${n} kali</div>` : '';
    const aksi = terkunci
      ? `<span style="color:var(--on-surface-variant);padding:0 8px;" title="Jenis inti - dikunci">${lockSvg}</span>`
      : `<button class="icon-btn" title="Ganti nama" onclick="kelolaGantiNama('${kind}',${i})">${ic('edit')}</button><button class="icon-btn" title="Hapus dari daftar" onclick="kelolaHapus('${kind}',${i})">${ic('trash')}</button>`;
    return `<div class="list-row"><span style="min-width:0;"><div>${escapeHtml(v)}</div>${info}</span><span style="display:flex;gap:2px;align-items:center;">${aksi}</span></div>`;
  }).join('');
  openModal(`
    <div class="mhead"><h2>${cfg.judul}</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${kind==='jenis' ? '<div class="field-sub" style="margin-bottom:10px;">5 jenis inti (Antar/Jemput Tenaga, Loading, Drone, Operator, Ekstra Pagi) dikunci karena punya field khusus otomatis. Jenis tambahan memakai field Lokasi biasa.</div>' : ''}
    <div class="field-sub" style="margin-bottom:10px;">Ganti nama (pensil) ikut memperbarui semua catatan lama. Hapus hanya mencabut dari daftar pilihan &mdash; catatan lama tetap tersimpan dan tampil.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="kelolaBaru" placeholder="${cfg.placeholder}" style="margin-bottom:0;">
      <button class="pill-btn" onclick="kelolaTambah('${kind}')">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${list.length===0 ? `<div class="empty-note">${cfg.kosong}</div>` : rows}
    </div>
  `);
}
function kelolaTambah(kind){
  const cfg = KELOLA_CFG[kind];
  const val = document.getElementById('kelolaBaru').value.trim();
  if(!val){ toast('Isi nama '+cfg.kata+' dulu'); return; }
  const list = kelolaList(kind);
  if(list.some(x=>x.toLowerCase()===val.toLowerCase())){ toast('Sudah ada'); return; }
  kelolaSetList(kind, list.concat([val]));
  renderKelolaModal(kind);
  toast('Ditambahkan');
}
function kelolaGantiNama(kind, idx){
  const cfg = KELOLA_CFG[kind];
  const list = kelolaList(kind);
  const oldVal = list[idx];
  if(oldVal===undefined) return;
  if(kelolaTerkunci(kind, oldVal)){ toast('Jenis inti tidak bisa diganti nama'); return; }
  const typed = prompt('Ganti nama '+cfg.kata+' "'+oldVal+'" menjadi:', oldVal);
  if(typed===null) return;
  const newVal = typed.trim();
  if(!newVal || newVal===oldVal) return;
  if(list.some((x,i)=>i!==idx && x.toLowerCase()===newVal.toLowerCase())){ toast('Nama itu sudah ada di daftar'); return; }
  const n = kelolaHitungPakai(kind, oldVal);
  if(n>0 && !confirm('Ganti "'+oldVal+'" menjadi "'+newVal+'"?\n\n'+n+' catatan lama ikut diperbarui ke nama baru.')) return;
  kelolaTerapkanGantiNama(kind, oldVal, newVal);
  kelolaSetList(kind, list.map((x,i)=>i===idx ? newVal : x));
  renderKelolaModal(kind);
  toast('Nama diganti'+(n>0?' ('+n+' catatan diperbarui)':''));
}
function kelolaHapus(kind, idx){
  const cfg = KELOLA_CFG[kind];
  const list = kelolaList(kind);
  const val = list[idx];
  if(val===undefined) return;
  if(kelolaTerkunci(kind, val)){ toast('Jenis inti tidak bisa dihapus'); return; }
  const n = kelolaHitungPakai(kind, val);
  const pesan = n>0
    ? 'Hapus "'+val+'" dari daftar pilihan?\n\nDipakai di '+n+' catatan. Catatan lama TETAP tersimpan dan tetap tampil di Rekap & cetak; hanya tidak muncul lagi sebagai pilihan baru.\n\n(Kalau hanya salah ketik, lebih aman pakai Ganti nama.)'
    : 'Hapus '+cfg.kata+' "'+val+'"?';
  if(!confirm(pesan)) return;
  kelolaSetList(kind, list.filter((x,i)=>i!==idx));
  renderKelolaModal(kind);
  toast('Dihapus dari daftar');
}

/* Daftar pilihan dropdown + nilai yang SEDANG tersimpan di catatan, walau nilai itu
 * sudah dihapus dari daftar Kelola. Tanpa ini dropdown catatan lama tampil
 * "- Pilih -" seolah datanya hilang, padahal data aslinya masih ada. */
function opsiDenganNilaiSekarang(list, currentVal){
  const out = list.slice();
  if(currentVal && !out.includes(currentVal)) out.push(currentVal);
  return out;
}
