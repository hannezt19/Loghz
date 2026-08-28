/* ================= NAVIGATION ================= */
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
  openModal(`
    <div class="mhead"><h2>Kelola No Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newUnitKode" placeholder="mis. BT.14" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addUnit()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${unitAsli.length===0 ? '<div class="empty-note">Belum ada unit. Tambahkan di atas.</div>' :
        unitAsli.map(u=>`<div class="list-row"><span>${escapeHtml(u.kode)}</span><button class="icon-btn" onclick="deleteUnit('${u.id}')">${ic('trash')}</button></div>`).join('')}
    </div>
    <div class="field-sub" style="margin:12px 0 4px;">Bawaan aplikasi (tidak bisa dihapus)</div>
    <div class="card card-flat">
      ${unitSistem.map(u=>`<div class="list-row"><span style="color:var(--on-surface-variant);font-style:italic;">${escapeHtml(u.kode)}</span></div>`).join('')}
    </div>
  `);
}
function addUnit(){
  const val = document.getElementById('newUnitKode').value.trim();
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
function deleteUnit(id){
  if(isSystemUnitId(id)){ toast('Unit bawaan ini tidak bisa dihapus'); return; }
  if(!confirm('Hapus unit ini? Data entri lama yang memakai unit ini tidak akan terhapus, tapi labelnya akan hilang.')) return;
  UNITS = UNITS.filter(u=>u.id!==id);
  saveUnits();
  renderKelolaUnitModal();
  toast('Unit dihapus');
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
function openKelolaJenis(){
  closeDrawer();
  renderKelolaJenisModal();
}
function renderKelolaJenisModal(){
  openModal(`
    <div class="mhead"><h2>Kelola Jenis Layanan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:10px;">4 jenis pertama (Antar/Jemput Tenaga, Muat Tebu, Drone, Operator) punya field khusus otomatis. Jenis tambahan akan pakai field Lokasi biasa.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newJenisKode" placeholder="mis. Perawatan Jalan" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addJenis()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${JENIS_LAYANAN_LIST.map(j=>`<div class="list-row"><span>${escapeHtml(j)}</span><button class="icon-btn" onclick="deleteJenis('${escapeHtml(j)}')">${ic('trash')}</button></div>`).join('')}
    </div>
  `);
}
function addJenis(){
  const val = document.getElementById('newJenisKode').value.trim();
  if(!val){ toast('Isi nama jenis layanan dulu'); return; }
  if(JENIS_LAYANAN_LIST.some(j=>j.toLowerCase()===val.toLowerCase())){ toast('Jenis ini sudah ada'); return; }
  JENIS_LAYANAN_LIST.push(val);
  saveJenisList();
  renderKelolaJenisModal();
  toast('Jenis layanan ditambahkan');
}
function deleteJenis(val){
  if(!confirm('Hapus jenis layanan ini?')) return;
  JENIS_LAYANAN_LIST = JENIS_LAYANAN_LIST.filter(j=>j!==val);
  saveJenisList();
  renderKelolaJenisModal();
  toast('Jenis layanan dihapus');
}

/* ================= KELOLA TIPE ANTAR ================= */
function openKelolaTipeAntar(){
  closeDrawer();
  renderKelolaTipeAntarModal();
}
function renderKelolaTipeAntarModal(){
  openModal(`
    <div class="mhead"><h2>Kelola Tipe (Antar/Jemput)</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newTipeAntarKode" placeholder="mis. Tebang" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addTipeAntar()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${TIPE_ANTAR_LIST.length===0 ? '<div class="empty-note">Belum ada tipe. Tambahkan di atas.</div>' :
        TIPE_ANTAR_LIST.map(t=>`<div class="list-row"><span>${escapeHtml(t)}</span><button class="icon-btn" onclick="deleteTipeAntar('${escapeHtml(t)}')">${ic('trash')}</button></div>`).join('')}
    </div>
  `);
}
function addTipeAntar(){
  const val = document.getElementById('newTipeAntarKode').value.trim();
  if(!val){ toast('Isi nama tipe dulu'); return; }
  if(TIPE_ANTAR_LIST.some(t=>t.toLowerCase()===val.toLowerCase())){ toast('Tipe ini sudah ada'); return; }
  TIPE_ANTAR_LIST.push(val);
  saveTipeAntarList();
  renderKelolaTipeAntarModal();
  toast('Tipe ditambahkan');
}
function deleteTipeAntar(val){
  if(!confirm('Hapus tipe ini?')) return;
  TIPE_ANTAR_LIST = TIPE_ANTAR_LIST.filter(t=>t!==val);
  saveTipeAntarList();
  renderKelolaTipeAntarModal();
  toast('Tipe dihapus');
}

/* ================= KELOLA KEGIATAN ================= */
function openKelolaKegiatan(){
  closeDrawer();
  renderKelolaKegiatanModal();
}
function renderKelolaKegiatanModal(){
  openModal(`
    <div class="mhead"><h2>Kelola Kegiatan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newKegiatanKode" placeholder="mis. Pemupukan" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addKegiatan()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${KEGIATAN_LIST.length===0 ? '<div class="empty-note">Belum ada kegiatan. Tambahkan di atas.</div>' :
        KEGIATAN_LIST.map(k=>`<div class="list-row"><span>${escapeHtml(k)}</span><button class="icon-btn" onclick="deleteKegiatan('${escapeHtml(k)}')">${ic('trash')}</button></div>`).join('')}
    </div>
  `);
}
function addKegiatan(){
  const val = document.getElementById('newKegiatanKode').value.trim();
  if(!val){ toast('Isi nama kegiatan dulu'); return; }
  if(KEGIATAN_LIST.some(k=>k.toLowerCase()===val.toLowerCase())){ toast('Kegiatan ini sudah ada'); return; }
  KEGIATAN_LIST.push(val);
  saveKegiatanList();
  renderKelolaKegiatanModal();
  toast('Kegiatan ditambahkan');
}
function deleteKegiatan(val){
  if(!confirm('Hapus kegiatan ini?')) return;
  KEGIATAN_LIST = KEGIATAN_LIST.filter(k=>k!==val);
  saveKegiatanList();
  renderKelolaKegiatanModal();
  toast('Kegiatan dihapus');
}

