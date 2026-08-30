/* ================= MASTER DATA: DRIVER (Program Kerja) =================
 * Daftar nama driver inti, termasuk Han sendiri. Dipakai sebagai pilihan
 * "Sopir" di sub-tab Program & Aktual — beda dari master lain, driver
 * TIDAK dipakai di form entri pribadi (ENTRIES) sama sekali. */
function openKelolaDriver(){
  closeDrawer();
  renderKelolaDriverModal();
}
function renderKelolaDriverModal(){
  openModal(`
    <div class="mhead"><h2>Kelola Driver</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:10px;">Daftar driver inti untuk modul Program Kerja — termasuk nama Anda sendiri kalau ingin ikut dianalisa keadilan lemburnya. Tap nama untuk ganti nama.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="newDriverNama" placeholder="mis. Yulius Putak" style="margin-bottom:0;">
      <button class="pill-btn" onclick="addDriver()">+ Tambah</button>
    </div>
    <div class="card card-flat">
      ${DRIVER_LIST.length===0 ? '<div class="empty-note">Belum ada driver. Tambahkan di atas.</div>' :
        DRIVER_LIST.map(d=>`<div class="list-row"><span onclick="editDriver('${d.id}')" style="cursor:pointer;">${escapeHtml(d.nama)}</span><button class="icon-btn" onclick="deleteDriver('${d.id}')">${ic('trash')}</button></div>`).join('')}
    </div>
  `);
}
function addDriver(){
  const val = document.getElementById('newDriverNama').value.trim();
  if(!val){ toast('Isi nama driver dulu'); return; }
  if(DRIVER_LIST.some(d=>d.nama.toLowerCase()===val.toLowerCase())){ toast('Driver ini sudah ada'); return; }
  DRIVER_LIST.push({id:uid(), nama:val});
  saveDriverList();
  renderKelolaDriverModal();
  toast('Driver ditambahkan');
}
function editDriver(id){
  const d = DRIVER_LIST.find(x=>x.id===id);
  if(!d) return;
  const typed = prompt('Ganti nama driver:', d.nama);
  if(typed==null) return;
  const val = typed.trim();
  if(!val) return;
  d.nama = val;
  saveDriverList();
  renderKelolaDriverModal();
}
function deleteDriver(id){
  if(!confirm('Hapus driver ini? Program/Aktual lama yang memakai nama ini tidak berubah — hanya master-nya yang hilang.')) return;
  DRIVER_LIST = DRIVER_LIST.filter(d=>d.id!==id);
  saveDriverList();
  renderKelolaDriverModal();
  toast('Driver dihapus');
}

/* ================= MASTER DATA: JAM OTOMATIS PER LAYANAN/SUB-LAYANAN =================
 * Dipakai untuk mengisi Overtime otomatis di sub-tab Aktual — tetap bisa
 * ditimpa manual per hari kalau kondisi lapangan beda dari jam standar.
 *
 * Sejak revisi Agustus 2026: untuk Layanan yang punya sub-tipe (Tipe/Jenis
 * Drone/Shift — lihat pkTipeOptionsFor()), jam otomatis dikunci per
 * KOMBINASI {layanan, tipe}, karena rata-rata jam kerja tiap sub-layanan
 * beda (mis. Operator Shift Pagi vs Siang). Layanan yang TIDAK punya
 * sub-tipe tetap dikunci per Layanan saja (tipe disimpan '').
 * PIKET_JAM_LAYANAN: [{layanan, tipe, jam}] */
function pkJamOtomatis(layanan, tipe){
  const hasTipe = !!pkTipeLabelFor(layanan);
  const key = hasTipe ? (tipe||'') : '';
  const m = PIKET_JAM_LAYANAN.find(x=>x.layanan===layanan && (x.tipe||'')===key);
  return m ? m.jam : 0;
}
/* Migrasi (Agustus 2026): PIKET_JAM_LAYANAN lama cuma dikunci per Layanan
 * (tanpa field tipe). Untuk 4 Layanan yang sekarang punya sub-tipe, nilai
 * jam lama disalin jadi nilai AWAL ke setiap sub-tipenya (supaya tidak
 * hilang) — user tinggal sesuaikan satu-satu di drawer kalau perlu beda.
 * Baris lama (tanpa tipe, layanan yang kini punya sub-tipe) dihapus supaya
 * tidak nyangkut/duplikat dengan baris baru per-tipe. Dipanggil sekali
 * tiap boot, aman dipanggil berkali-kali (idempoten). */
function migratePkJamLayananIfNeeded(){
  let changed = false;
  const layananDenganTipe = JENIS_LAYANAN_LIST.filter(j=>pkTipeLabelFor(j));
  layananDenganTipe.forEach(layanan=>{
    const opsiTipe = pkTipeOptionsFor(layanan);
    const legacy = PIKET_JAM_LAYANAN.find(x=>x.layanan===layanan && !x.tipe);
    if(legacy && opsiTipe.length>0){
      opsiTipe.forEach(tipe=>{
        if(!PIKET_JAM_LAYANAN.some(x=>x.layanan===layanan && x.tipe===tipe)){
          PIKET_JAM_LAYANAN.push({layanan, tipe, jam:legacy.jam});
          changed = true;
        }
      });
      PIKET_JAM_LAYANAN = PIKET_JAM_LAYANAN.filter(x=>x!==legacy);
      changed = true;
    }
  });
  if(changed) savePiketJamLayanan();
}
function openKelolaJamLayanan(){
  closeDrawer();
  renderKelolaJamLayananModal();
}
function renderKelolaJamLayananModal(){
  openModal(`
    <div class="mhead"><h2>Jam Otomatis per Layanan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:10px;">Dipakai untuk mengisi Overtime otomatis di Program Kerja &middot; Aktual. Singkatan (maks. 6 karakter) dipakai di kolom Unit yang compact saat cetak PDF Proker. Tetap bisa ditimpa manual per hari.</div>
    ${JENIS_LAYANAN_LIST.length===0 ? '<div class="empty-note">Belum ada Jenis Layanan. Tambahkan dulu di Master Data &middot; Jenis Layanan.</div>' :
      JENIS_LAYANAN_LIST.map(j=>{
        const opsiTipe = pkTipeOptionsFor(j);
        const jsSafe = escapeHtml(j).replace(/'/g,"\\'");
        if(opsiTipe.length===0){
          return `
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
            <div style="flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(j)}</div>
            ${pkSingkatanInputHtml(j, jsSafe)}
            <input type="text" inputmode="numeric" style="width:56px;flex-shrink:0;" value="${pkJamOtomatis(j)}" onchange="setJamLayanan('${jsSafe}', '', this.value)">
          </div>`;
        }
        return `
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
          <div style="flex:1;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(j)}</div>
        </div>
        ${opsiTipe.map(t=>{
          const tSafe = escapeHtml(t).replace(/'/g,"\\'");
          return `
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;padding-left:12px;">
          <div style="flex:1;color:var(--on-surface-variant);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t)}</div>
          ${pkSingkatanInputHtml(j, jsSafe, t, tSafe)}
          <input type="text" inputmode="numeric" style="width:56px;flex-shrink:0;" value="${pkJamOtomatis(j,t)}" onchange="setJamLayanan('${jsSafe}', '${tSafe}', this.value)">
        </div>`;}).join('')}
      `;}).join('')}
  `);
}
/* Input Singkatan (maks. 6 karakter, dipaksa huruf besar) untuk 1 baris Jenis
 * Layanan / sub-tipe di modal Jam Otomatis per Layanan — dipakai di kedua
 * varian baris (dengan/tanpa sub-tipe) supaya markupnya tidak dobel.
 * Sejak revisi Agustus 2026 (v1.0.33): untuk Layanan yang punya sub-tipe,
 * Singkatan disimpan PER SUB-TIPE (bukan lagi 1 per Layanan induk) — supaya
 * PDF Proker bisa bedakan mis. ZPK vs Prevatone, Pagi vs Siang, dst. */
function pkSingkatanInputHtml(layanan, jsSafe, tipe, tipeSafe){
  const tipeArg = tipe ? tipeSafe : '';
  return `<input type="text" maxlength="6" placeholder="Singkatan" value="${escapeHtml(pkSingkatanLayanan(layanan, tipe||''))}" style="width:78px;flex-shrink:0;text-align:center;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()" onchange="setSingkatanLayanan('${jsSafe}', '${tipeArg}', this.value)">`;
}
/* Kunci penyimpanan LAYANAN_SINGKATAN: Layanan TANPA sub-tipe tetap dikunci
 * per nama Layanan saja (backward compatible, tidak perlu migrasi). Layanan
 * DENGAN sub-tipe dikunci gabungan "Layanan::Tipe", mirror pola yang sudah
 * dipakai PIKET_JAM_LAYANAN (lihat pkJamOtomatis di atas). */
function pkSingkatanKey(layanan, tipe){
  const hasTipe = !!pkTipeLabelFor(layanan);
  return hasTipe ? (layanan+'::'+(tipe||'')) : layanan;
}
function pkSingkatanLayanan(layanan, tipe){
  return LAYANAN_SINGKATAN[pkSingkatanKey(layanan, tipe)] || '';
}
function setSingkatanLayanan(layanan, tipe, val){
  const v = String(val||'').trim().toUpperCase().slice(0,6);
  LAYANAN_SINGKATAN[pkSingkatanKey(layanan, tipe)] = v;
  saveLayananSingkatan();
}
/* Migrasi (Agustus 2026, v1.0.33): LAYANAN_SINGKATAN lama cuma dikunci per
 * Layanan (tanpa tipe). Untuk 4 Layanan yang sekarang punya sub-tipe, nilai
 * Singkatan lama disalin jadi nilai AWAL ke tiap sub-tipenya (supaya tidak
 * hilang) — user tinggal sesuaikan satu-satu di drawer kalau perlu beda.
 * Key lama (tanpa tipe, untuk layanan yang kini punya sub-tipe) dihapus
 * supaya tidak nyangkut. Dipanggil sekali tiap boot, aman berkali-kali
 * (idempoten) — persis pola migratePkJamLayananIfNeeded() di atas. */
function migrateLayananSingkatanIfNeeded(){
  let changed = false;
  const layananDenganTipe = JENIS_LAYANAN_LIST.filter(j=>pkTipeLabelFor(j));
  layananDenganTipe.forEach(layanan=>{
    const opsiTipe = pkTipeOptionsFor(layanan);
    const legacy = LAYANAN_SINGKATAN[layanan];
    if(legacy && opsiTipe.length>0){
      opsiTipe.forEach(tipe=>{
        const key = layanan+'::'+tipe;
        if(!LAYANAN_SINGKATAN[key]){ LAYANAN_SINGKATAN[key] = legacy; changed = true; }
      });
      delete LAYANAN_SINGKATAN[layanan];
      changed = true;
    }
  });
  if(changed) saveLayananSingkatan();
}
function setJamLayanan(layanan, tipe, val){
  const num = parseFloat(val)||0;
  const hasTipe = !!pkTipeLabelFor(layanan);
  const key = hasTipe ? (tipe||'') : '';
  let m = PIKET_JAM_LAYANAN.find(x=>x.layanan===layanan && (x.tipe||'')===key);
  if(!m){ m={layanan, tipe:key, jam:num}; PIKET_JAM_LAYANAN.push(m); } else { m.jam=num; }
  savePiketJamLayanan();
}

/* ================= HARI INI ================= */
function getTodayEntry(){
  let e = ENTRIES.find(x=>x.date===todayIso() && !x.isSecondary);
  if(!e){
    e = {id:uid(), date:todayIso(), btId:USER.mainBt||'', hmAwal:'', hmAkhir:'', bbmLiter:'', lembur:'', catatan:'', sopir:'',
      jenisLayanan:'', tipeAntar:'', kegiatan:'', muatTipe:'', tonaseKg:'', lokasi:'', lokasiMuat:'', lokasiBongkar:'',
      droneJenis:'', shift:'', absenBerangkat:'', absenPulang:'', istirahat:true, istMulai:'11.00', istSelesai:'13.30', liburMerah:false};
    ENTRIES.push(e);
    saveEntries();
  }
  return e;
}
function selectWithCustom(id, list, currentVal, extraOnchange){
  const oc = `handleSelectCustom('${id}', this.value)${extraOnchange?(';'+extraOnchange):''}`;
  return `<select id="qf-${id}" onchange="${oc}">
    <option value="">- Pilih -</option>
    ${list.map(v=>`<option value="${escapeHtml(v)}" ${currentVal===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}
    <option value="__custom__">+ Lainnya (tulis sendiri)...</option>
  </select>`;
}
function handleSelectCustom(fieldKey, val){
  if(val==='__custom__'){
    const typed = prompt('Ketik nilai baru:');
    if(!typed){ renderHari(); return; }
    if(fieldKey==='jenisLayanan'){ if(!JENIS_LAYANAN_LIST.includes(typed)){ JENIS_LAYANAN_LIST.push(typed); saveJenisList(); } }
    else if(fieldKey==='tipeAntar'){ if(!TIPE_ANTAR_LIST.includes(typed)){ TIPE_ANTAR_LIST.push(typed); saveTipeAntarList(); } }
    else if(fieldKey==='kegiatan'){ if(!KEGIATAN_LIST.includes(typed)){ KEGIATAN_LIST.push(typed); saveKegiatanList(); } }
    else if(fieldKey==='muatTipe'){ if(!MUAT_TIPE_LIST.includes(typed)){ MUAT_TIPE_LIST.push(typed); saveMuatTipeList(); } }
    else if(fieldKey==='droneJenis'){ if(!DRONE_JENIS_LIST.includes(typed)){ DRONE_JENIS_LIST.push(typed); saveDroneJenisList(); } }
    else if(fieldKey==='shift'){ if(!SHIFT_LIST.includes(typed)){ SHIFT_LIST.push(typed); saveShiftList(); } }
    quickSave(fieldKey, typed);
  } else {
    quickSave(fieldKey, val);
  }
  renderHari();
}
function renderHari(){
  const host = document.getElementById('screen-hari');
  if(!USER.mainBt || UNITS.length===0){
    host.innerHTML = `<div class="card"><div class="empty-note">Kamu belum punya Unit default atau daftar unit masih kosong.<br><br>Buka menu ${ic('menu')} &rarr; Pengaturan Akun &amp; Kelola No Unit dulu ya.</div></div>`;
    return;
  }
  const e = getTodayEntry();
  const jenis = e.jenisLayanan;
  if(isSystemUnitId(e.btId)){
    // Mode Libur/Standby: tidak ada form kerja sama sekali. Cukup pilih
    // No Unit = Libur/Standby sebagai penanda hari itu tidak bekerja —
    // otomatis tidak ikut kehitung di HM/BBM/Overtime bulan ini karena
    // tidak ada field numerik yang terisi.
    host.innerHTML = `
      <div class="section-eyebrow">Truck &amp; Unit</div>
      <div class="card">
        <label class="flabel">No Unit</label>
        <div style="display:flex;gap:8px;">
          <select style="flex:4;" onchange="quickSave('btId', this.value)">
            ${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
          </select>
          <button class="pill-btn" style="flex:1;justify-content:center;padding:0;" onclick="addSecondaryUnit()" title="Tambah unit lain untuk hari ini">+</button>
        </div>
      </div>
      <div class="empty-note">${e.btId===UNIT_LIBUR_ID?'Libur — tidak bekerja hari ini.':'Standby — siaga, tidak ada unit jalan.'}</div>
      ${getSecondaryUnitsToday().map((se,i)=>renderSecondaryUnitCard(se, i+1)).join('')}
    `;
    return;
  }
  host.innerHTML = `
    <div class="section-eyebrow">Truck &amp; Unit</div>
    <div class="card">
      <label class="flabel">No Unit</label>
      <div style="display:flex;gap:8px;">
        <select style="flex:4;" onchange="quickSave('btId', this.value)">
          ${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
        </select>
        <button class="pill-btn" style="flex:1;justify-content:center;padding:0;" onclick="addSecondaryUnit()" title="Tambah unit lain untuk hari ini">+</button>
      </div>
    </div>

    <div class="section-eyebrow">Jenis Layanan</div>
    <div class="card">
      <label class="flabel">Jenis Layanan</label>
      ${selectWithCustom('jenisLayanan', JENIS_LAYANAN_LIST, jenis)}

      ${jenis==='Antar/Jemput Tenaga' ? `
        <div class="grid2" style="margin-top:8px;">
          <div><label class="flabel">Tipe</label>${selectWithCustom('tipeAntar', TIPE_ANTAR_LIST, e.tipeAntar)}</div>
          <div><label class="flabel">Kegiatan</label>${selectWithCustom('kegiatan', KEGIATAN_LIST, e.kegiatan)}</div>
        </div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSave('lokasi', this.value)" placeholder="mis. Blok 14 BU 31">
      ` : ''}

      ${jenis==='Muat Tebu' ? `
        <div style="margin-top:8px;"><label class="flabel">Tipe</label>${selectWithCustom('muatTipe', MUAT_TIPE_LIST, e.muatTipe)}</div>
        ${e.muatTipe==='Produksi' ? `
          <label class="flabel">Tonase (kg)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.tonaseKg))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="quickSave('tonaseKg', stripDots(this.value))">
          <label class="flabel">Lokasi</label>
          <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSave('lokasi', this.value)">
        ` : ''}
        ${e.muatTipe==='Bibit' ? `
        <div class="grid2">
          <div><label class="flabel">Lokasi Muat</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiMuat)}" onchange="quickSave('lokasiMuat', this.value)"></div>
          <div><label class="flabel">Lokasi Bongkar</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiBongkar)}" onchange="quickSave('lokasiBongkar', this.value)"></div>
        </div>` : ''}
      ` : ''}

      ${jenis==='Drone' ? `
        <div style="margin-top:8px;"><label class="flabel">Jenis Drone</label>${selectWithCustom('droneJenis', DRONE_JENIS_LIST, e.droneJenis)}</div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSave('lokasi', this.value)">
      ` : ''}

      ${jenis==='Operator' ? `
        <div style="margin-top:8px;"><label class="flabel">Shift</label>${selectWithCustom('shift', SHIFT_LIST, e.shift)}</div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSave('lokasi', this.value)">
      ` : ''}
      ${jenis && !['Antar/Jemput Tenaga','Muat Tebu','Drone','Operator'].includes(jenis) ? `
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSave('lokasi', this.value)">
      ` : ''}
      
    </div>

    <div class="section-eyebrow">Absen &amp; Istirahat</div>
    <div class="card">
      <div class="grid2">
        <div><label class="flabel">Absen Berangkat</label><input type="time" value="${escapeHtml(e.absenBerangkat)}" onchange="quickSave('absenBerangkat', this.value)"></div>
        <div><label class="flabel">Absen Pulang</label><input type="time" value="${escapeHtml(e.absenPulang)}" onchange="quickSave('absenPulang', this.value)"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="chip ${e.istirahat?'active':''}" onclick="quickSave('istirahat', true);">${ic('coffee')} Istirahat</button>
        <button class="chip ${!e.istirahat?'active':''}" onclick="quickSave('istirahat', false);">${ic('hourglass')} Lembur</button>
      </div>
      ${e.istirahat ? `
      <div class="grid2" style="margin-top:8px;">
        <div><label class="flabel">Istirahat Mulai</label><input type="text" inputmode="numeric" value="${escapeHtml(e.istMulai)}" placeholder="11.00" oninput="this.value=fmtJamTitikLive(this.value)" onchange="quickSave('istMulai', this.value)"></div>
        <div><label class="flabel">Istirahat Selesai</label><input type="text" inputmode="numeric" value="${escapeHtml(e.istSelesai)}" placeholder="13.30" oninput="this.value=fmtJamTitikLive(this.value)" onchange="quickSave('istSelesai', this.value)"></div>
      </div>` : ''}
      <div class="chk-row" style="margin-top:8px;"><input type="checkbox" id="qf-liburMerah" ${e.liburMerah?'checked':''} onchange="quickSave('liburMerah', this.checked)"><label for="qf-liburMerah" style="margin-left:6px;">${ic('calendar')} Tanggal Merah / Libur Nasional</label></div>
      <div class="field-sub" style="margin-top:4px;">Jam lembur dihitung otomatis dari Absen &amp; Istirahat di atas, tapi tetap bisa diedit manual di bawah.</div>
    </div>

    <div class="section-eyebrow">Hour Meter &amp; BBM</div>
    <div class="card">
      <div class="grid2">
        <div><label class="flabel">HM Awal</label><input type="text" inputmode="numeric" value="${escapeHtml(e.hmAwal)}" oninput="this.value=fmtHmLive(this.value)" onchange="quickSave('hmAwal', this.value);checkHmWarning('qf')" id="qf-hmA"></div>
        <div><label class="flabel">HM Akhir</label><input type="text" inputmode="numeric" class="${hmBad(e)?'field-error':''}" value="${escapeHtml(e.hmAkhir)}" oninput="this.value=fmtHmLive(this.value)" onchange="onHmAkhirChangeQf(this)" id="qf-hmB"></div>
        <div class="full" id="qf-hmWarning">${hmBad(e)?'<div class="field-sub" style="color:var(--danger);">'+ic('warning')+' HM Akhir lebih kecil dari HM Awal.</div>':''}</div>
        <div><label class="flabel">BBM (ml)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.bbmLiter))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="quickSave('bbmLiter', stripDots(this.value))"></div>
        <div><label class="flabel">Jam Lembur</label><input type="text" inputmode="decimal" value="${escapeHtml(e.lembur)}" onchange="quickSave('lembur', this.value)"></div>
      </div>
      <label class="flabel">Catatan (opsional)</label>
      <textarea rows="2" onchange="quickSave('catatan', this.value)">${escapeHtml(e.catatan)}</textarea>
    </div>

    ${getSecondaryUnitsToday().map((se,i)=>renderSecondaryUnitCard(se, i+1)).join('')}
  `;
}
function getSecondaryUnitsToday(){
  return ENTRIES.filter(x=>x.date===todayIso() && x.isSecondary);
}
function addSecondaryUnit(){
  const e = {id:uid(), date:todayIso(), btId:'', hmAwal:'', hmAkhir:'', bbmLiter:'', lembur:'', catatan:'', sopir:'',
    jenisLayanan:'', tipeAntar:'', kegiatan:'', muatTipe:'', tonaseKg:'', lokasi:'', lokasiMuat:'', lokasiBongkar:'',
    droneJenis:'', shift:'', isSecondary:true};
  ENTRIES.push(e);
  saveEntries();
  renderHari();
  toast('Unit tambahan ditambahkan');
}
function deleteSecondaryUnit(id){
  if(!confirm('Hapus unit tambahan ini?')) return;
  ENTRIES = ENTRIES.filter(x=>x.id!==id);
  saveEntries();
  renderHari();
  toast('Unit tambahan dihapus');
}
function quickSaveEntry(entryId, key, val){
  const idx = ENTRIES.findIndex(x=>x.id===entryId); if(idx<0) return;
  ENTRIES[idx][key] = val;
  recomputeLemburIfNeeded(ENTRIES[idx], key);
  saveEntries();
  toast('Tersimpan');
  renderHari();
}
/* Pembungkus khusus HM Akhir unit tambahan (poin 1): sama seperti onHmAkhirChangeQf()
 * tapi untuk entri unit tambahan (isSecondary) di layar Hari Ini. */
function onHmAkhirChangeQf2(entryId, el){
  const entry = ENTRIES.find(x=>x.id===entryId); if(!entry) return;
  const prevVal = entry.hmAkhir;
  const newVal = el.value;
  handleHmBaruInput(entry.btId, entry.date, newVal,
    ()=>{ quickSaveEntry(entryId, 'hmAkhir', newVal); },
    ()=>{ el.value = prevVal; checkHmWarning2(entryId); }
  );
}
function selectWithCustomHari(entryId, fieldKey, list, currentVal){
  return `<select onchange="handleSelectCustomHari('${entryId}','${fieldKey}', this.value)">
    <option value="">- Pilih -</option>
    ${list.map(v=>`<option value="${escapeHtml(v)}" ${currentVal===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}
    <option value="__custom__">+ Lainnya (tulis sendiri)...</option>
  </select>`;
}
function handleSelectCustomHari(entryId, fieldKey, val){
  if(val==='__custom__'){
    const typed = prompt('Ketik nilai baru:');
    if(!typed){ renderHari(); return; }
    if(fieldKey==='jenisLayanan'){ if(!JENIS_LAYANAN_LIST.includes(typed)){ JENIS_LAYANAN_LIST.push(typed); saveJenisList(); } }
    else if(fieldKey==='tipeAntar'){ if(!TIPE_ANTAR_LIST.includes(typed)){ TIPE_ANTAR_LIST.push(typed); saveTipeAntarList(); } }
    else if(fieldKey==='kegiatan'){ if(!KEGIATAN_LIST.includes(typed)){ KEGIATAN_LIST.push(typed); saveKegiatanList(); } }
    else if(fieldKey==='muatTipe'){ if(!MUAT_TIPE_LIST.includes(typed)){ MUAT_TIPE_LIST.push(typed); saveMuatTipeList(); } }
    else if(fieldKey==='droneJenis'){ if(!DRONE_JENIS_LIST.includes(typed)){ DRONE_JENIS_LIST.push(typed); saveDroneJenisList(); } }
    else if(fieldKey==='shift'){ if(!SHIFT_LIST.includes(typed)){ SHIFT_LIST.push(typed); saveShiftList(); } }
    quickSaveEntry(entryId, fieldKey, typed);
  } else {
    quickSaveEntry(entryId, fieldKey, val);
  }
}
function checkHmWarning2(entryId){
  const hmA = document.getElementById('qf2-hmA-'+entryId);
  const hmB = document.getElementById('qf2-hmB-'+entryId);
  const warnEl = document.getElementById('qf2-hmWarning-'+entryId);
  if(!hmA||!hmB) return;
  const a=parseFloat(hmA.value), b=parseFloat(hmB.value);
  const bad = !isNaN(a)&&!isNaN(b)&&b<a;
  hmB.classList.toggle('field-error', bad);
  if(warnEl) warnEl.innerHTML = bad ? '<div class="field-sub" style="color:var(--danger);">'+ic('warning')+' HM Akhir lebih kecil dari HM Awal.</div>' : '';
}
function renderSecondaryUnitCard(e, idx){
  const jenis = e.jenisLayanan;
  if(isSystemUnitId(e.btId)){
    return `
      <div class="section-eyebrow section-eyebrow-row">Unit Tambahan #${idx} &middot; ${e.btId===UNIT_LIBUR_ID?'Libur':'Standby'}<button class="icon-btn" onclick="deleteSecondaryUnit('${e.id}')">${ic('trash')}</button></div>
      <div class="card">
        <label class="flabel">No Unit</label>
        <select onchange="quickSaveEntry('${e.id}','btId', this.value)">
          <option value="">- Pilih -</option>
          ${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
        </select>
        <div class="empty-note" style="margin-top:8px;">${e.btId===UNIT_LIBUR_ID?'Libur — tidak bekerja.':'Standby — siaga, tidak jalan.'}</div>
      </div>
    `;
  }
  return `
    <div class="section-eyebrow section-eyebrow-row">Unit Tambahan #${idx}<button class="icon-btn" onclick="deleteSecondaryUnit('${e.id}')">${ic('trash')}</button></div>
    <div class="card">
      <label class="flabel">No Unit</label>
      <select onchange="quickSaveEntry('${e.id}','btId', this.value)">
        <option value="">- Pilih -</option>
        ${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
      </select>

      <label class="flabel" style="margin-top:8px;">Jenis Layanan</label>
      ${selectWithCustomHari(e.id,'jenisLayanan', JENIS_LAYANAN_LIST, jenis)}

      ${jenis==='Antar/Jemput Tenaga' ? `
        <div class="grid2" style="margin-top:8px;">
          <div><label class="flabel">Tipe</label>${selectWithCustomHari(e.id,'tipeAntar', TIPE_ANTAR_LIST, e.tipeAntar)}</div>
          <div><label class="flabel">Kegiatan</label>${selectWithCustomHari(e.id,'kegiatan', KEGIATAN_LIST, e.kegiatan)}</div>
        </div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSaveEntry('${e.id}','lokasi', this.value)">
      ` : ''}

      ${jenis==='Muat Tebu' ? `
        <div style="margin-top:8px;"><label class="flabel">Tipe</label>${selectWithCustomHari(e.id,'muatTipe', MUAT_TIPE_LIST, e.muatTipe)}</div>
        ${e.muatTipe==='Produksi' ? `
          <label class="flabel">Tonase (kg)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.tonaseKg))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="quickSaveEntry('${e.id}','tonaseKg', stripDots(this.value))">
          <label class="flabel">Lokasi</label>
          <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSaveEntry('${e.id}','lokasi', this.value)">
        ` : ''}
        ${e.muatTipe==='Bibit' ? `
        <div class="grid2">
          <div><label class="flabel">Lokasi Muat</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiMuat)}" onchange="quickSaveEntry('${e.id}','lokasiMuat', this.value)"></div>
          <div><label class="flabel">Lokasi Bongkar</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiBongkar)}" onchange="quickSaveEntry('${e.id}','lokasiBongkar', this.value)"></div>
        </div>` : ''}
      ` : ''}

      ${jenis==='Drone' ? `
        <div style="margin-top:8px;"><label class="flabel">Jenis Drone</label>${selectWithCustomHari(e.id,'droneJenis', DRONE_JENIS_LIST, e.droneJenis)}</div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSaveEntry('${e.id}','lokasi', this.value)">
      ` : ''}

      ${jenis==='Operator' ? `
        <div style="margin-top:8px;"><label class="flabel">Shift</label>${selectWithCustomHari(e.id,'shift', SHIFT_LIST, e.shift)}</div>
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSaveEntry('${e.id}','lokasi', this.value)">
      ` : ''}
      ${jenis && !['Antar/Jemput Tenaga','Muat Tebu','Drone','Operator'].includes(jenis) ? `
        <label class="flabel">Lokasi</label>
        <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="quickSaveEntry('${e.id}','lokasi', this.value)">
      ` : ''}

      <div class="grid2" style="margin-top:8px;">
        <div><label class="flabel">HM Awal</label><input type="text" inputmode="numeric" value="${escapeHtml(e.hmAwal)}" oninput="this.value=fmtHmLive(this.value)" onchange="quickSaveEntry('${e.id}','hmAwal', this.value);checkHmWarning2('${e.id}')" id="qf2-hmA-${e.id}"></div>
        <div><label class="flabel">HM Akhir</label><input type="text" inputmode="numeric" class="${hmBad(e)?'field-error':''}" value="${escapeHtml(e.hmAkhir)}" oninput="this.value=fmtHmLive(this.value)" onchange="onHmAkhirChangeQf2('${e.id}', this)" id="qf2-hmB-${e.id}"></div>
        <div class="full" id="qf2-hmWarning-${e.id}">${hmBad(e)?'<div class="field-sub" style="color:var(--danger);">'+ic('warning')+' HM Akhir lebih kecil dari HM Awal.</div>':''}</div>
        <div><label class="flabel">BBM (ml)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.bbmLiter))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="quickSaveEntry('${e.id}','bbmLiter', stripDots(this.value))"></div>
        <div><label class="flabel">Jam Lembur (manual)</label><input type="text" inputmode="decimal" value="${escapeHtml(e.lembur)}" onchange="quickSaveEntry('${e.id}','lembur', this.value)"></div>
      </div>
      <div class="field-sub" style="margin:-4px 0 8px;">Tanpa absen otomatis, supaya lembur tidak terhitung dobel dengan unit utama.</div>
      <label class="flabel">Catatan (opsional)</label>
      <textarea rows="2" onchange="quickSaveEntry('${e.id}','catatan', this.value)">${escapeHtml(e.catatan)}</textarea>
    </div>`;
}
function entryTipeLabel(e){
  if(!e.jenisLayanan) return '-';
  if(e.jenisLayanan==='Antar/Jemput Tenaga') return e.tipeAntar || e.jenisLayanan;
  if(e.jenisLayanan==='Muat Tebu') return e.muatTipe || e.jenisLayanan;
  if(e.jenisLayanan==='Drone') return e.droneJenis || e.jenisLayanan;
  if(e.jenisLayanan==='Operator') return e.shift || e.jenisLayanan;
  return e.jenisLayanan;
}
function lokasiSuggestions(){
  const set = new Set();
  ENTRIES.forEach(e=>{ [e.lokasi,e.lokasiMuat,e.lokasiBongkar].forEach(l=>{ if(l) set.add(l); }); });
  PETA_BLOCKS.forEach(b=>{ if(b.label) set.add(b.label); });
  BLOKS.forEach(b=>{ if(b.kode) set.add(b.kode); });
  return Array.from(set);
}
function refreshLokasiDatalist(filterText){
  const all = lokasiSuggestions();
  const q = String(filterText||'').toLowerCase().trim();
  let matches = q ? all.filter(l=>l.toLowerCase().includes(q)) : all.slice();
  matches.reverse();
  matches = matches.slice(0,7);
  const dl = document.getElementById('lokasiSuggest');
  if(dl) dl.innerHTML = matches.map(l=>`<option value="${escapeHtml(l)}">`).join('');
}
function fmtJamTitikLive(v){
  const digits = String(v||'').replace(/\D/g,'').slice(0,4);
  if(digits.length<=2) return digits;
  return digits.slice(0,2)+'.'+digits.slice(2);
}
function fmtBlokKode(v){
  const raw = String(v||'');
  const stripped = raw.replace(/\s+/g,'');
  if(stripped.length<2 || !/^\d{2}/.test(stripped)) return raw;
  let out = '';
  for(let i=0;i<stripped.length;i++){
    let ch = stripped[i];
    if(i>=2 && i<4) ch = ch.toUpperCase();
    out += ch;
    if((i===1 || i===3) && i+1<stripped.length) out += ' ';
  }
  return out;
}
function onLokasiInput(el){
  el.value = fmtBlokKode(el.value);
  refreshLokasiDatalist(el.value);
}
function onLokasiFocus(el){
  refreshLokasiDatalist(el.value);
  setTimeout(()=>{ el.scrollIntoView({behavior:'smooth', block:'center'}); }, 250);
}
function stripDots(v){ return v==null?'':String(v).replace(/\./g,''); }
function fmtThousandsLive(v){ const c=String(v||'').replace(/[^\d]/g,''); return c===''?'':c.replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function fmtHm1(v){ if(v===''||v==null) return ''; const n=parseFloat(String(v).replace(',','.')); return isNaN(n)?'':n.toFixed(1); }
/* Formatter khusus angka desimal (liter BBM, dst) gaya Indonesia: titik ribuan, koma
 * desimal. BEDA dari fmtThousandsLive() yang khusus untuk input live bilangan bulat
 * (HM/ml) dan akan MERUSAK angka desimal karena membuang titik sebagai "bukan digit"
 * (mis. "49.08" -> "4.908"). fmtLiterID() aman dipakai untuk nilai desimal apa pun,
 * termasuk yang sumbernya masih pakai titik desimal (titik atau koma di input string
 * sama-sama dianggap desimal lewat parseFloat setelah dinormalisasi). */
function fmtLiterID(v){
  const n = parseFloat(String(v==null?'':v).replace(',', '.'));
  if(isNaN(n)) return '0,00';
  return n.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtHmLive(v){
  const digits = String(v||'').replace(/\D/g,'').slice(0,5);
  if(digits==='') return '';
  if(digits.length===1) return digits;
  return digits.slice(0,-1)+'.'+digits.slice(-1);
}
function hmBad(e){ const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir); return !isNaN(a)&&!isNaN(b)&&b<a; }
function checkHmWarning(ctx){
  const hmA = document.getElementById((ctx==='qf'?'qf-hmA':'ed-hmA-'+ctx));
  const hmB = document.getElementById((ctx==='qf'?'qf-hmB':'ed-hmB-'+ctx));
  const warnEl = document.getElementById((ctx==='qf'?'qf-hmWarning':'ed-hmWarning-'+ctx));
  if(!hmA||!hmB) return;
  const a=parseFloat(hmA.value), b=parseFloat(hmB.value);
  const bad = !isNaN(a)&&!isNaN(b)&&b<a;
  hmB.classList.toggle('field-error', bad);
  if(warnEl) warnEl.innerHTML = bad ? '<div class="field-sub" style="color:var(--danger);">'+ic('warning')+' HM Akhir lebih kecil dari HM Awal.</div>' : '';
}
function parseHHMM(s){
  if(!s) return null;
  const parts = String(s).split(':');
  if(parts.length<2) return null;
  const h = parseInt(parts[0],10), m = parseInt(parts[1],10);
  if(isNaN(h)||isNaN(m)) return null;
  return h + m/60;
}
function parseJamTitik(s){
  if(!s) return null;
  const norm = String(s).trim().replace(',', '.').replace('.', ':');
  const parts = norm.split(':');
  if(parts.length<2) return null;
  const h = parseInt(parts[0],10), m = parseInt(parts[1],10);
  if(isNaN(h)||isNaN(m)) return null;
  return h + m/60;
}
function normalJamKerja(dateIso, liburMerah){
  if(liburMerah) return 0;
  const dow = new Date(dateIso+'T00:00:00').getDay();
  if(dow===0) return 0;      // Minggu
  if(dow===6) return 5.5;    // Sabtu
  if(dow===5) return 6.5;    // Jumat
  return 7;                  // Senin-Kamis
}
function computeLembur(e){
  const start = parseHHMM(e.absenBerangkat);
  const end = parseHHMM(e.absenPulang);
  if(start===null || end===null) return null;
  let worked = end - start;
  if(worked < 0) worked += 24;
  if(e.istirahat){
    const im = parseJamTitik(e.istMulai);
    const is = parseJamTitik(e.istSelesai);
    if(im!==null && is!==null){
      let istDur = is - im;
      if(istDur < 0) istDur += 24;
      worked -= istDur;
    }
  }
  const normal = normalJamKerja(e.date, e.liburMerah);
  let lembur = worked - normal;
  if(lembur < 0) lembur = 0;
  return lembur;
}
const LEMBUR_TRIGGER_KEYS = ['absenBerangkat','absenPulang','istirahat','istMulai','istSelesai','liburMerah','date'];
function recomputeLemburIfNeeded(entry, changedKey){
  if(!LEMBUR_TRIGGER_KEYS.includes(changedKey)) return;
  const val = computeLembur(entry);
  if(val!==null) entry.lembur = val.toFixed(1);
}
function computeLemburFinal(e){
  const lembur = parseFloat(e.lembur);
  if(isNaN(lembur) || lembur<=0) return 0;
  const normal = normalJamKerja(e.date, e.liburMerah);
  const final = normal>0 ? (lembur*2 - 0.5) : (lembur*2);
  return final<0 ? 0 : final;
}
function quickSave(key, val){
  const e = getTodayEntry();
  e[key] = val;
  recomputeLemburIfNeeded(e, key);
  saveEntries();
  toast('Tersimpan');
  if(LEMBUR_TRIGGER_KEYS.includes(key)) renderHari();
}
/* Pembungkus khusus HM Akhir entri harian utama (poin 1): cek dulu lewat
 * handleHmBaruInput() sebelum benar-benar quickSave(). Kalau user batal
 * ("Periksa Lagi"), field HM Akhir dikembalikan ke nilai lama. */
function onHmAkhirChangeQf(el){
  const e = getTodayEntry();
  const prevVal = e.hmAkhir;
  const newVal = el.value;
  handleHmBaruInput(e.btId, e.date, newVal,
    ()=>{ quickSave('hmAkhir', newVal); checkHmWarning('qf'); },
    ()=>{ el.value = prevVal; checkHmWarning('qf'); }
  );
}

/* ================= HM & SERVIS ================= */
function lastServisForBt(btId){
  const list = SERVIS.filter(s=>s.btId===btId && s.type==='berkala').sort((a,b)=>b.date.localeCompare(a.date));
  return list[0] || null;
}
function lastHmResetForBt(btId){
  const list = HM_RESETS.filter(r=>r.btId===btId).sort((a,b)=>b.date.localeCompare(a.date));
  return list[0] || null;
}
function currentHmForBt(btId){
  const reset = lastHmResetForBt(btId);
  const fromEntries = ENTRIES
    .filter(e=>e.btId===btId && e.hmAkhir!=='' && e.hmAkhir!=null && !isNaN(parseFloat(e.hmAkhir)) && (!reset || e.date>=reset.date))
    .map(e=>({date:e.date, id:e.id, hm:parseFloat(e.hmAkhir)}));
  const fromSusulan = BBM_SUSULAN
    .filter(s=>s.btId===btId && s.hm!=='' && s.hm!=null && !isNaN(parseFloat(s.hm)) && (!reset || s.tanggal>=reset.date))
    .map(s=>({date:s.tanggal, id:s.id, hm:parseFloat(s.hm)}));
  const valid = fromEntries.concat(fromSusulan);
  if(valid.length===0) return null;
  valid.sort((a,b)=>a.date.localeCompare(b.date) || (a.id>b.id?1:-1));
  return valid[valid.length-1].hm;
}
function getTimelineIsiBBM(btId){
  const reset = lastHmResetForBt(btId);
  const afterReset = d => !reset || d >= reset.date;
  const fromEntries = ENTRIES
    .filter(e=>e.btId===btId && (parseFloat(e.bbmLiter)||0)>0 && e.hmAkhir!=='' && e.hmAkhir!=null && !isNaN(parseFloat(e.hmAkhir)) && afterReset(e.date))
    .map(e=>({id:e.id, btId, tanggal:e.date, hm:parseFloat(e.hmAkhir), bbmMl:parseFloat(e.bbmLiter)||0, sumber:'entries'}));
  const fromSusulan = BBM_SUSULAN
    .filter(s=>s.btId===btId && afterReset(s.tanggal))
    .map(s=>({id:s.id, btId, tanggal:s.tanggal, hm:parseFloat(s.hm)||0, bbmMl:parseFloat(s.bbmMl)||0, sumber:'susulan'}));
  const timeline = fromEntries.concat(fromSusulan);
  timeline.sort((a,b)=>a.tanggal.localeCompare(b.tanggal) || (a.hm-b.hm) || (a.id>b.id?1:-1));
  let prevHm = null;
  timeline.forEach(t=>{
    t.hmTerpakai = (prevHm!==null && t.hm>=prevHm) ? (t.hm-prevHm) : null;
    prevHm = t.hm;
  });
  return timeline;
}
function hitungLiterPerJam(btId){
  const timeline = getTimelineIsiBBM(btId);
  const totalLiter = timeline.reduce((s,t)=>s+t.bbmMl,0)/1000;
  if(timeline.length<2) return {literPerJam:null, totalLiter, totalHm:0, cukupData:false, jumlahIsi:timeline.length};
  const totalHm = Math.max(0, timeline[timeline.length-1].hm - timeline[0].hm);
  const literPerJam = totalHm>0 ? (totalLiter/totalHm) : null;
  return {literPerJam, totalLiter, totalHm, cukupData:literPerJam!==null, jumlahIsi:timeline.length};
}
/* Ambang batas HM baru (poin 1): kalau nilai yang diketik user untuk HM Akhir
 * lebih kecil dari ini, dianggap indikasi meter HM unit tsb baru diganti/direset,
 * dan WAJIB dikonfirmasi dulu lewat popup sebelum data boleh tersimpan. */
const HM_BARU_AMBANG = 9.9;

/**
 * hmServiceStatus (poin 2): "sisa" (jam terpakai sejak servis terakhir) dihitung
 * dengan MEMPERHITUNGKAN setiap "Ganti HM baru" (HM_RESETS) yang terjadi SETELAH
 * servis terakhir tercatat — supaya progres/jadwal servis TIDAK reset ke 0 saat
 * meter diganti, melainkan tetap melanjutkan akumulasi jam sebelumnya lalu
 * menambah jalannya HM baru di atasnya. Setiap kali ada reset, dijumlahkan dulu
 * sisa jam dari segmen SEBELUM reset itu (pakai r.hmSebelumReset yang dicatat
 * saat reset dibuat), baru segmen berikutnya dihitung dari 0 (karena meter baru
 * dianggap mulai dari titik hampir-nol sesuai HM_BARU_AMBANG).
 */
function hmServiceStatus(btId){
  const last = lastServisForBt(btId);
  const current = currentHmForBt(btId);
  const baseHm = last ? (parseFloat(last.hm)||0) : null;
  if(baseHm===null || current===null) return {last, current, baseHm, sisa:null};
  const resetsRelevan = HM_RESETS
    .filter(r=>r.btId===btId && r.date>=last.date)
    .sort((a,b)=>a.date.localeCompare(b.date) || (a.id>b.id?1:-1));
  let sisa = 0;
  let segStart = baseHm;
  resetsRelevan.forEach(r=>{
    const hmSebelum = (r.hmSebelumReset!=null && !isNaN(r.hmSebelumReset)) ? r.hmSebelumReset : segStart;
    sisa += Math.max(0, hmSebelum - segStart);
    segStart = 0; // segmen baru (setelah meter diganti) dimulai dari hampir-nol
  });
  sisa += Math.max(0, current - segStart);
  return {last, current, baseHm, sisa};
}

/**
 * Dipanggil dari SEMUA titik input HM Akhir (entri harian utama, unit tambahan,
 * edit di Rekap, dan HM saat isi BBM Susulan) sebelum nilai benar-benar disimpan.
 * Kalau nilai >= HM_BARU_AMBANG, langsung lanjut simpan seperti biasa (tidak ada
 * perubahan perilaku). Kalau < HM_BARU_AMBANG, data DITAHAN dulu — tampil popup
 * konfirmasi wajib (poin 1). commitFn() baru dipanggil kalau user pilih
 * "Ya, Memang Benar"; revertFn() dipanggil kalau user pilih "Periksa Lagi"
 * (batalkan, biarkan user mengedit lagi, tidak ada yang tersimpan).
 */
function handleHmBaruInput(btId, tanggal, rawVal, commitFn, revertFn){
  const val = parseFloat(rawVal);
  if(rawVal===''||rawVal==null||isNaN(val)||!btId){
    commitFn();
    return;
  }
  const current = currentHmForBt(btId);
  /* Trigger konfirmasi HANYA kalau ini penurunan nyata dari HM terakhir
   * tercatat (indikasi meter diganti/direset), ATAU ini entri pertama yang
   * pernah ada untuk unit ini dan langsung sangat rendah. Value kecil yang
   * MASIH NAIK dari HM terakhir (mis. lanjutan wajar setelah meter baru
   * dipasang) tidak lagi memicu popup berulang. */
  const isPenurunan = current!==null && val < current;
  const isEntriPertamaRendah = current===null && val < HM_BARU_AMBANG;
  if(!isPenurunan && !isEntriPertamaRendah){
    commitFn();
    return;
  }
  window._hmBaruPending = {btId, tanggal: tanggal||todayIso(), val, commitFn, revertFn};
  openModal(renderHmBaruConfirmHtml());
}
function renderHmBaruConfirmHtml(){
  const p = window._hmBaruPending;
  return `
    <div class="mhead"><h2>${ic('warning')} Konfirmasi HM Baru</h2></div>
    <div class="field-sub" style="margin-bottom:10px;">
      HM Akhir yang kamu masukkan untuk <b>${escapeHtml(btLabel(p.btId))}</b> adalah <b>${p.val.toFixed(1)}</b> — sangat rendah dibanding biasanya, kemungkinan ini penanda meter HM unit ini baru diganti/direset.
    </div>
    <div class="field-sub" style="margin-bottom:16px;">Apakah ini memang benar? Kalau ya, ini akan dicatat sebagai <b>Ganti HM baru</b> khusus untuk ${escapeHtml(btLabel(p.btId))} saja (unit lain tidak terpengaruh) — dan jadwal servis unit ini akan tetap lanjut, tidak reset ke 0.</div>
    <div style="display:flex;gap:8px;">
      <button class="pill-btn outline" style="flex:1;justify-content:center;" onclick="batalkanHmBaru()">Periksa Lagi</button>
      <button class="btn-block" style="flex:1;margin:0;" onclick="konfirmasiHmBaru()">Ya, Memang Benar</button>
    </div>
  `;
}
function batalkanHmBaru(){
  const p = window._hmBaruPending;
  closeModal();
  window._hmBaruPending = null;
  if(p && p.revertFn) p.revertFn();
}
function konfirmasiHmBaru(){
  const p = window._hmBaruPending;
  window._hmBaruPending = null;
  if(!p){ closeModal(); return; }
  const hmSebelumReset = currentHmForBt(p.btId);
  HM_RESETS.push({id:uid(), btId:p.btId, date:p.tanggal, hmSebelumReset,
    note:'Ganti HM baru (dikonfirmasi user)'+(hmSebelumReset!=null?' — HM sebelumnya '+hmSebelumReset.toFixed(1):'')});
  saveHmResets();
  closeModal();
  toast('Ganti HM baru dicatat untuk '+btLabel(p.btId));
  p.commitFn();
}
function daysBetween(d1, d2){
  if(!d1 || !d2) return null;
  const a = new Date(d1+'T00:00:00'), b = new Date(d2+'T00:00:00');
  return Math.round((b-a)/86400000);
}
function fmtFullDate(iso){
  if(!iso) return '-';
  const bulanFull = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(iso+'T00:00:00');
  return d.getDate()+' '+bulanFull[d.getMonth()]+' '+d.getFullYear();
}
function openServisModal(){
  closeDrawer();
  resetSvcDraft('berkala');
  renderServisModal();
}
function resetSvcDraft(type){
  window._svcType = type;
  window._svcDraft = { date: todayIso(), hm:'', note:'',
    filterSolar:false, filterUdara:false, filterOli:false,
    jenisKerusakan:'', gejala:'', namaPart:'',
    tglDilaporkan:'', tglDicek:'', mekanikCek:'',
    tglMenunggu:'', tglMasukWorkshop:'', tglSelesai:'', mekanikPerbaikan:''
  };
}
function svcDraftSet(key, val){
  window._svcDraft[key] = val;
  renderServisModal();
}
function svcChg(mode, key){
  return mode==='draft' ? `svcDraftSet('${key}', this.value)` : `editServisField('${mode}','${key}',this.value)`;
}
function selectSvcCustom(mode, fieldKey, list, currentVal, listName){
  return `<select onchange="handleSvcSelectCustom('${mode}','${fieldKey}', this.value, '${listName}')">
    <option value="">- Pilih -</option>
    ${list.map(v=>`<option value="${escapeHtml(v)}" ${currentVal===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}
    <option value="__custom__">+ Lainnya (tulis sendiri)...</option>
  </select>`;
}
function handleSvcSelectCustom(mode, fieldKey, val, listName){
  if(val === '__custom__'){
    const typed = prompt('Ketik nilai baru:');
    if(!typed){ renderServisModal(); return; }
    if(listName==='jeniskerusakan'){ if(!JENIS_KERUSAKAN_LIST.includes(typed)){ JENIS_KERUSAKAN_LIST.push(typed); saveJenisKerusakanList(); } }
    else if(listName==='mekanik'){ if(!MEKANIK_LIST.includes(typed)){ MEKANIK_LIST.push(typed); saveMekanikList(); } }
    val = typed;
  }
  if(mode==='draft') svcDraftSet(fieldKey, val);
  else editServisField(mode, fieldKey, val);
}
function servisLainnyaFields(mode, data){
  const dt = daysBetween(data.tglMasukWorkshop, data.tglSelesai);
  const tot = daysBetween(data.tglDilaporkan, data.tglSelesai);
  return `
    <label class="flabel">Jenis Kerusakan</label>
    ${selectSvcCustom(mode, 'jenisKerusakan', JENIS_KERUSAKAN_LIST, data.jenisKerusakan||'', 'jeniskerusakan')}
    <label class="flabel">Gejala/Catatan</label>
    <textarea rows="2" onchange="${svcChg(mode,'gejala')}">${escapeHtml(data.gejala||'')}</textarea>
    <label class="flabel">Nama Part</label>
    <input type="text" value="${escapeHtml(data.namaPart||'')}" onchange="${svcChg(mode,'namaPart')}">
    <div class="section-eyebrow" style="margin-top:8px;">Kronologi</div>
    <label class="flabel">Dilaporkan</label>
    <input type="date" value="${data.tglDilaporkan||''}" onchange="${svcChg(mode,'tglDilaporkan')}">
    <label class="flabel">Dicek Workshop</label>
    <input type="date" value="${data.tglDicek||''}" onchange="${svcChg(mode,'tglDicek')}">
    <label class="flabel">Mekanik Pengecek</label>
    ${selectSvcCustom(mode, 'mekanikCek', MEKANIK_LIST, data.mekanikCek||'', 'mekanik')}
    <label class="flabel">Menunggu Part/Antre <span class="field-sub">(opsional, kalau langsung dikerjakan boleh dikosongkan)</span></label>
    <input type="date" value="${data.tglMenunggu||''}" onchange="${svcChg(mode,'tglMenunggu')}">
    <label class="flabel">Masuk Workshop <span class="field-sub">(mulai downtime)</span></label>
    <input type="date" value="${data.tglMasukWorkshop||''}" onchange="${svcChg(mode,'tglMasukWorkshop')}">
    <label class="flabel">Selesai</label>
    <input type="date" value="${data.tglSelesai||''}" onchange="${svcChg(mode,'tglSelesai')}">
    <label class="flabel">Mekanik Perbaikan</label>
    ${selectSvcCustom(mode, 'mekanikPerbaikan', MEKANIK_LIST, data.mekanikPerbaikan||'', 'mekanik')}
    <div class="field-sub" style="margin-top:8px;">Durasi Downtime: <b>${dt!==null?dt+' hari':'-'}</b> &middot; Durasi Total: <b>${tot!==null?tot+' hari':'-'}</b></div>
  `;
}
function renderServisListItem(s){
  if(s.type==='berkala'){
    const chips=[]; if(s.filterSolar) chips.push('Filter Solar'); if(s.filterUdara) chips.push('Filter Udara'); if(s.filterOli) chips.push('Filter Oli');
    return `<div class="card" style="margin-bottom:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div><div style="font-weight:700;">${ic('wrench')} ${fmtLabel(s.date)} &middot; HM ${escapeHtml(s.hm)}</div>${chips.length?`<div class="field-sub">${escapeHtml(chips.join(', '))}</div>`:''}${s.note?`<div class="field-sub">${escapeHtml(s.note)}</div>`:''}</div>
      <button class="icon-btn" onclick="deleteServis('${s.id}')">${ic('trash')}</button>
    </div>`;
  }
  const isLegacy = !('jenisKerusakan' in s);
  if(isLegacy){
    return `<div class="card" style="margin-bottom:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div><div style="font-weight:700;">${ic('hammer')} ${fmtLabel(s.date)} &middot; HM ${escapeHtml(s.hm||'-')} <span class="field-sub">(Lainnya)</span></div>${s.note?`<div class="field-sub">${escapeHtml(s.note)}</div>`:''}</div>
      <button class="icon-btn" onclick="deleteServis('${s.id}')">${ic('trash')}</button>
    </div>`;
  }
  const dt = daysBetween(s.tglMasukWorkshop, s.tglSelesai);
  const statusLabel = s.tglSelesai ? `Selesai${dt!==null?' ('+dt+' hari downtime)':''}` : (s.tglMasukWorkshop?'Di Workshop': (s.tglMenunggu?'Menunggu Part':(s.tglDicek?'Dicek Workshop':(s.tglDilaporkan?'Dilaporkan':'Draft'))));
  const expanded = expandedServisId===s.id;
  return `<div class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="toggleServisCase('${s.id}')">
      <div>
        <div style="font-weight:700;">${ic('hammer')} ${escapeHtml(s.jenisKerusakan||'Perbaikan')}</div>
        <div class="field-sub">${statusLabel}</div>
      </div>
      <span class="icon-btn">${ic('edit')}</span>
    </div>
    ${expanded ? `
      <div style="margin-top:12px;">
        ${servisLainnyaFields(s.id, s)}
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-block" style="flex:1;" onclick="toggleServisCase('${s.id}')">Selesai</button>
          <button class="pill-btn outline" onclick="exportServisCasePdf('${s.id}')">${ic('document')} Cetak</button>
          <button class="pill-btn outline" onclick="deleteServis('${s.id}')">Hapus</button>
        </div>
      </div>
    ` : ''}
  </div>`;
}
function toggleServisCase(id){
  expandedServisId = (expandedServisId===id) ? null : id;
  renderServisModal();
}
function editServisField(id, key, val){
  const idx = SERVIS.findIndex(s=>s.id===id); if(idx<0) return;
  SERVIS[idx][key] = val;
  if(key==='tglSelesai' || key==='tglDilaporkan') SERVIS[idx].date = SERVIS[idx].tglSelesai || SERVIS[idx].tglDilaporkan || SERVIS[idx].date;
  saveServis();
  toast('Tersimpan');
  expandedServisId = id;
  renderServisModal();
}
async function exportServisCasePdf(id){
  const s = SERVIS.find(x=>x.id===id); if(!s) return;
  if(!window.jspdf){ toast('Library PDF belum siap, coba lagi sesaat'); return; }
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'portrait'});
    doc.setFontSize(16); doc.setFont(undefined,'bold');
    doc.text('Laporan Kejadian Perbaikan', 14, 16);
    const info = [
      ['No Unit', btLabel(s.btId)],
      ['Jenis Kerusakan', s.jenisKerusakan||'-'],
      ['Gejala/Catatan', s.gejala||'-'],
      ['Nama Part', s.namaPart||'-'],
    ];
    if(typeof doc.autoTable !== 'function') throw new Error('Plugin tabel PDF belum siap. Tutup & buka ulang app, lalu coba lagi.');
    doc.autoTable({ body: info, startY: 24, styles:{fontSize:10, cellPadding:4}, columnStyles:{0:{fontStyle:'bold', cellWidth:50}}, theme:'grid' });
    const dt = daysBetween(s.tglMasukWorkshop, s.tglSelesai);
    const tot = daysBetween(s.tglDilaporkan, s.tglSelesai);
    const kron = [
      ['Dilaporkan', fmtFullDate(s.tglDilaporkan), ''],
      ['Dicek Workshop', fmtFullDate(s.tglDicek), s.mekanikCek||'-'],
      ['Menunggu Part/Antre', fmtFullDate(s.tglMenunggu), ''],
      ['Masuk Workshop (mulai downtime)', fmtFullDate(s.tglMasukWorkshop), ''],
      ['Selesai', fmtFullDate(s.tglSelesai), s.mekanikPerbaikan||'-'],
    ];
    doc.autoTable({
      head:[['Tahap','Tanggal','Mekanik']], body: kron,
      startY: doc.lastAutoTable.finalY+10, styles:{fontSize:10, cellPadding:4}, headStyles:{fillColor:[76,140,60]}, theme:'grid',
      foot: [['Durasi Downtime', dt!==null?dt+' hari':'-', ''], ['Durasi Total', tot!==null?tot+' hari':'-', '']],
      footStyles:{fillColor:[215,236,217], textColor:[38,48,59], fontStyle:'bold'}
    });
    const pdfBlob = doc.output('blob');
    const result = await saveOrShareBlob(pdfBlob, 'servis-'+s.id.slice(0,6)+'.pdf');
    toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
  }catch(err){
    console.error('Gagal membuat PDF servis:', err);
    alert('Gagal membuat PDF: ' + (err && err.message ? err.message : err));
  }
}
let expandedServisId = null;
function renderServisModal(){
  const bt = USER.mainBt;
  const svc = bt ? hmServiceStatus(bt) : null;
  const list = SERVIS.filter(s=>s.btId===bt).sort((a,b)=>b.date.localeCompare(a.date));
  const d = window._svcDraft || (resetSvcDraft('berkala'), window._svcDraft);
  openModal(`
    <div class="mhead"><h2>Servis</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${!bt ? '<div class="empty-note">Set unit default dulu di Pengaturan Akun.</div>' : `
    <div class="card card-flat">
      <label class="flabel">Ambang Batas Servis (jam)</label>
      <input type="number" id="svcInterval" value="${SETTINGS.serviceInterval}" onchange="SETTINGS.serviceInterval=parseFloat(this.value)||240;saveSettings();renderServisModal();">
      ${svc.sisa===null ? `<div class="field-sub">${svc.baseHm===null?'Belum ada catatan servis.':'Belum ada data HM saat ini.'}</div>` : `
        <div class="field-sub">Terpakai sejak servis terakhir: <b>${svc.sisa.toFixed(1)} jam</b> dari ${SETTINGS.serviceInterval} jam</div>
        <div style="position:relative;background:var(--outline-variant);border-radius:100px;height:10px;margin-top:6px;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(90deg, var(--success) 0%, var(--success) 80%, #E08900 80%, #E08900 95%, var(--maroon) 95%, var(--maroon) 100%);"></div>
          <div style="position:absolute;top:0;bottom:0;right:0;left:${Math.min(100, svc.sisa/SETTINGS.serviceInterval*100)}%;background:var(--outline-variant);"></div>
        </div>
      `}
    </div>
    <div class="section-eyebrow">Catat Servis Baru</div>
    <div class="card card-flat">
      <label class="flabel">Jenis</label>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="chip ${window._svcType!=='lainnya'?'active':''}" onclick="setSvcType('berkala')">${ic('wrench')} Servis Berkala (Ganti Oli)</button>
        <button class="chip ${window._svcType==='lainnya'?'active':''}" onclick="setSvcType('lainnya')">${ic('hammer')} Lainnya (Perbaikan)</button>
      </div>
      <div class="field-sub" style="margin:-6px 0 12px;">${window._svcType==='lainnya' ? 'Tidak mereset hitungan pengingat servis.' : 'Akan mereset hitungan pengingat servis (ambang batas jam).'}</div>
      ${window._svcType!=='lainnya' ? `
        <label class="flabel">Tanggal</label><input type="date" value="${d.date}" onchange="svcDraftSet('date', this.value)">
        <label class="flabel">HM Saat Servis</label><input type="text" inputmode="numeric" value="${escapeHtml(d.hm)}" placeholder="mis. 4200.0" oninput="this.value=fmtHmLive(this.value)" onchange="svcDraftSet('hm', this.value)">
        <div class="chk-row"><input type="checkbox" id="chkFilterSolar" ${d.filterSolar?'checked':''} onchange="svcDraftSet('filterSolar', this.checked)"><label for="chkFilterSolar" style="margin-left:6px;">Filter Solar</label></div>
        <div class="chk-row"><input type="checkbox" id="chkFilterUdara" ${d.filterUdara?'checked':''} onchange="svcDraftSet('filterUdara', this.checked)"><label for="chkFilterUdara" style="margin-left:6px;">Filter Udara</label></div>
        <div class="chk-row"><input type="checkbox" id="chkFilterOli" ${d.filterOli?'checked':''} onchange="svcDraftSet('filterOli', this.checked)"><label for="chkFilterOli" style="margin-left:6px;">Filter Oli</label></div>
        <label class="flabel">Catatan <span class="field-sub">(opsional)</span></label><input type="text" value="${escapeHtml(d.note)}" onchange="svcDraftSet('note', this.value)">
      ` : servisLainnyaFields('draft', d)}
      <button class="btn-block" onclick="addServis()">Simpan Servis</button>
    </div>
    <div class="section-eyebrow">Riwayat Servis ${escapeHtml(btLabel(bt))}</div>
    ${list.length===0 ? '<div class="card card-flat"><div class="empty-note">Belum ada riwayat servis.</div></div>' : list.map(renderServisListItem).join('')}
    `}
  `);
}
function setSvcType(t){
  resetSvcDraft(t);
  renderServisModal();
}
function addServis(){
  const d = window._svcDraft;
  if(window._svcType!=='lainnya'){
    if(!d.hm || isNaN(parseFloat(d.hm))){ toast('Isi HM saat servis dengan angka'); return; }
    SERVIS.push({id:uid(), btId:USER.mainBt, date:d.date, hm:parseFloat(d.hm).toFixed(1), note:d.note||'', type:'berkala',
      filterSolar:!!d.filterSolar, filterUdara:!!d.filterUdara, filterOli:!!d.filterOli});
  } else {
    if(!d.jenisKerusakan && !d.tglDilaporkan && !d.tglSelesai){ toast('Isi minimal Jenis Kerusakan atau salah satu tanggal'); return; }
    SERVIS.push({id:uid(), btId:USER.mainBt, type:'lainnya',
      date: d.tglSelesai || d.tglDilaporkan || todayIso(),
      jenisKerusakan:d.jenisKerusakan||'', gejala:d.gejala||'', namaPart:d.namaPart||'',
      tglDilaporkan:d.tglDilaporkan||'', tglDicek:d.tglDicek||'', mekanikCek:d.mekanikCek||'',
      tglMenunggu:d.tglMenunggu||'', tglMasukWorkshop:d.tglMasukWorkshop||'', tglSelesai:d.tglSelesai||'', mekanikPerbaikan:d.mekanikPerbaikan||''
    });
  }
  saveServis();
  toast('Servis dicatat');
  resetSvcDraft('berkala');
  renderServisModal();
}
function deleteServis(id){
  if(!confirm('Hapus catatan servis ini?')) return;
  SERVIS = SERVIS.filter(s=>s.id!==id);
  saveServis();
  renderServisModal();
}
function openGantiHmModal(){
  closeDrawer();
  renderGantiHmModal();
}
function renderGantiHmModal(){
  const bt = USER.mainBt;
  const current = bt ? currentHmForBt(bt) : null;
  const history = HM_RESETS.filter(r=>r.btId===bt).sort((a,b)=>b.date.localeCompare(a.date));
  openModal(`
    <div class="mhead"><h2>Ganti HM Manual</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    ${!bt ? '<div class="empty-note">Set unit default dulu di Pengaturan Akun.</div>' : `
    <div class="field-sub" style="margin-bottom:10px;">HM saat ini menurut catatan: <b>${current!==null?current.toFixed(1):'-'}</b></div>
    <label class="flabel">Tanggal Ganti</label><input type="date" id="gantiHmDate" value="${todayIso()}">
    <label class="flabel">HM Baru (setelah ganti meter)</label><input type="text" id="gantiHmVal" inputmode="numeric" placeholder="mis. 0" oninput="this.value=fmtHmLive(this.value)">
    <label class="flabel">Catatan</label><input type="text" id="gantiHmNote" placeholder="mis. Meter rusak, ganti unit baru">
    <button class="btn-block" onclick="saveGantiHm()">Simpan Perubahan HM</button>
    <div class="section-eyebrow">Riwayat Perubahan HM</div>
    <div class="card card-flat">
      ${history.length===0 ? '<div class="empty-note">Belum pernah ada perubahan HM.</div>' :
        history.map(r=>`<div class="list-row"><span>${fmtLabel(r.date)}<br><span class="field-sub">${escapeHtml(r.note||'')}</span></span><button class="icon-btn" onclick="deleteHmReset('${r.id}')">${ic('trash')}</button></div>`).join('')}
    </div>
    `}
  `);
}
function saveGantiHm(){
  const date = document.getElementById('gantiHmDate').value;
  const note = document.getElementById('gantiHmNote').value;
  const hmSebelumReset = currentHmForBt(USER.mainBt);
  HM_RESETS.push({id:uid(), btId:USER.mainBt, date, hmSebelumReset, note: note || 'Ganti HM manual'});
  saveHmResets();
  toast('Perubahan HM dicatat');
  renderGantiHmModal();
}
function deleteHmReset(id){
  if(!confirm('Hapus catatan perubahan HM ini? Ini cuma menghapus log, tidak mengubah data HM di entri harian.')) return;
  HM_RESETS = HM_RESETS.filter(r=>r.id!==id);
  saveHmResets();
  renderGantiHmModal();
}

/* ================= BERANDA ================= */
