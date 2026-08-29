/* ================= PROGRAM KERJA (modul baru, data terpisah total) =================
 * Mencatat jadwal & realisasi kerja SEMUA driver (bukan cuma Han) untuk
 * menganalisa keadilan pembagian lembur. 3 sub-tab: Program (rencana) →
 * Aktual (realisasi) → Rekap. Key data: v2_program_rencana, v2_program_aktual
 * — LIHAT KONSEP-PROGRAM-KERJA.md untuk spesifikasi lengkap. */
let pkSubTab = 'program';         // 'program' | 'aktual' | 'rekap'
let pkTanggalMulai = todayIso();  // rentang berlaku untuk baris Program yang mau ditambah/dilihat
let pkTanggalSampai = todayIso();
let pkAktualTanggal = todayIso(); // Aktual selalu per 1 tanggal spesifik (realisasi harian)
let pkRekapMode = 'bulan';        // 'bulan' | 'tahun'
let pkRekapBulan = todayIso().slice(0,7);
let pkRekapTahun = todayIso().slice(0,4);
let pkRekapHanyaLL = false;
let pkRekapExpandedDrivers = new Set(); // accordion: nama driver yang sedang dibuka di "Total Jam per Driver"
let pkRekapExpandedDates = new Set();   // accordion: tanggal yang sedang dibuka di "Rincian per Tanggal"
function togglePkRekapDriver(nama){
  if(pkRekapExpandedDrivers.has(nama)) pkRekapExpandedDrivers.delete(nama); else pkRekapExpandedDrivers.add(nama);
  renderProker();
}
function togglePkRekapDate(tgl){
  if(pkRekapExpandedDates.has(tgl)) pkRekapExpandedDates.delete(tgl); else pkRekapExpandedDates.add(tgl);
  renderProker();
}

function setPkSubTab(tab){ pkSubTab = tab; renderProker(); }
function setPkTanggalMulai(val){ pkTanggalMulai = val; renderProker(); }
function setPkTanggalSampai(val){ pkTanggalSampai = val; renderProker(); }
function setPkAktualTanggal(val){ pkAktualTanggal = val; renderProker(); }
/* Semua baris Program yang rentangnya mencakup tanggal tertentu (dipakai Aktual & Rekap) */
function pkProgramRowsForDate(tanggal){
  return PROGRAM_RENCANA.filter(r=>r.tanggalMulai<=tanggal && r.tanggalSampai>=tanggal);
}
function pkExpandDates(tanggalMulai, tanggalSampai){
  const dates = [];
  if(!tanggalMulai || !tanggalSampai) return dates;
  let d = new Date(tanggalMulai+'T00:00:00');
  const end = new Date(tanggalSampai+'T00:00:00');
  let guard = 0;
  while(d<=end && guard<3660){
    dates.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
    d.setDate(d.getDate()+1);
    guard++;
  }
  return dates;
}

/* Entry point tab bottom-nav "Proker" (posisi 3) — dipanggil dari showScreen('proker')
 * di nav-master.js. Halaman ini tetap terhubung ke drawer: No Unit, Jenis Layanan &
 * Tipe (termasuk Jenis Drone), dan Shift Operator (lewat drawer + link Kelola Driver
 * di bawah), sama seperti sebelum dipindah keluar dari tab Rekap. */
function renderProker(){
  const host = document.getElementById('screen-proker');
  host.innerHTML = renderProgramKerjaHtml();
}
function renderProgramKerjaHtml(){
  const chipRow = `
    <div style="display:flex;gap:8px;margin:2px 0 4px;">
      <button class="chip ${pkSubTab==='program'?'active':''}" onclick="setPkSubTab('program')">Program</button>
      <button class="chip ${pkSubTab==='aktual'?'active':''}" onclick="setPkSubTab('aktual')">Aktual</button>
      <button class="chip ${pkSubTab==='rekap'?'active':''}" onclick="setPkSubTab('rekap')">Rekap</button>
    </div>`;
  const driverNotice = DRIVER_LIST.length===0 ? `<div class="card" style="border-color:var(--primary);"><div class="field-sub">Belum ada Driver terdaftar. Tambahkan dulu lewat menu &middot; <b onclick="openKelolaDriver()" style="cursor:pointer;color:var(--primary);">Kelola Driver</b>.</div></div>` : '';
  if(pkSubTab==='rekap'){
    // Sticky sampai sebelum "Total Jam per Driver": chip Program/Aktual/Rekap dan
    // semua kontrol filter Rekap ikut menempel di atas saat discroll — supaya
    // tidak perlu scroll balik ke atas untuk ganti bulan/filter.
    return `
      <div style="position:sticky;top:0;z-index:5;background:var(--surface);margin:0 -16px;padding:1px 16px 8px;">
        ${chipRow}
        ${driverNotice}
        ${renderPkRekapFilters()}
      </div>
      ${renderPkRekapBody()}
    `;
  }
  return `
    ${chipRow}
    ${driverNotice}
    ${pkSubTab==='program' ? renderPkProgramTab() : renderPkAktualTab()}
  `;
}

/* ----- Sub-tab: PROGRAM (rencana) ----- */
function pkTandaLiburLembur(tanggal){
  const t = PROGRAM_TANDA_LL.find(x=>x.tanggal===tanggal);
  return t ? !!t.tandaLiburLembur : false;
}
function togglePkTandaLiburLembur(tanggal, checked){
  let t = PROGRAM_TANDA_LL.find(x=>x.tanggal===tanggal);
  if(!t){ t = {tanggal, tandaLiburLembur:checked}; PROGRAM_TANDA_LL.push(t); }
  else t.tandaLiburLembur = checked;
  saveProgramTandaLL();
  renderProker();
}
function addPkRencanaRow(){
  if(!pkTanggalMulai || !pkTanggalSampai){ toast('Isi Tanggal Mulai & Tanggal Sampai dulu'); return; }
  if(pkTanggalSampai < pkTanggalMulai){ toast('Tanggal Sampai tidak boleh sebelum Tanggal Mulai'); return; }
  const r = {id:uid(), tanggalMulai:pkTanggalMulai, tanggalSampai:pkTanggalSampai, unitId:'', sopir:'', isInti:true, layanan:'', tipe:''};
  PROGRAM_RENCANA.push(r);
  saveProgramRencana();
  renderProker();
  openPkRencanaEdit(r.id);
}
function updatePkRencanaField(rowId, field, val){
  const r = PROGRAM_RENCANA.find(x=>x.id===rowId);
  if(!r) return;
  r[field] = val;
  if(field==='layanan') r.tipe = ''; // ganti Layanan -> reset Tipe (opsi Tipe lama mungkin sudah tidak relevan)
  saveProgramRencana();
  renderProker();
}
function setPkRencanaSopirFromDriver(rowId, val){
  const r = PROGRAM_RENCANA.find(x=>x.id===rowId);
  if(!r) return;
  if(val==='__LAINNYA__'){ r.sopir=''; r.isInti=false; }
  else { const d=DRIVER_LIST.find(x=>x.id===val); r.sopir=d?d.nama:''; r.isInti=true; }
  saveProgramRencana();
  renderProker();
}
function setPkRencanaSopirManual(rowId, val){
  const r = PROGRAM_RENCANA.find(x=>x.id===rowId);
  if(!r) return;
  r.sopir = val; r.isInti=false;
  saveProgramRencana();
  renderProker();
}
function addPkRencanaShiftLain(rowId){
  const r = PROGRAM_RENCANA.find(x=>x.id===rowId);
  if(!r) return;
  PROGRAM_RENCANA.push({id:uid(), tanggalMulai:r.tanggalMulai, tanggalSampai:r.tanggalSampai, unitId:r.unitId, sopir:'', isInti:true, layanan:r.layanan, tipe:r.tipe||''});
  saveProgramRencana();
  renderProker();
  toast('Shift lain ditambahkan untuk unit & rentang yang sama');
}
function deletePkRencanaRow(rowId){
  if(!confirm('Hapus baris program ini? Aktual yang terhubung ke baris ini juga ikut terhapus.')) return;
  PROGRAM_RENCANA = PROGRAM_RENCANA.filter(x=>x.id!==rowId);
  PROGRAM_AKTUAL = PROGRAM_AKTUAL.filter(x=>x.rencanaId!==rowId);
  saveProgramRencana();
  saveProgramAktual();
  renderProker();
}
/* Baris ringkas di tabel Program (tap untuk buka form edit kecil) */
function renderPkRencanaRowCompact(r){
  return `
    <div class="pk-row" onclick="openPkRencanaEdit('${r.id}')">
      <span>${r.unitId?escapeHtml(btLabel(r.unitId)):'<span class="empty-note" style="padding:0;">-</span>'}</span>
      <span>${escapeHtml(r.sopir||'-')}${!r.isInti && r.sopir ? ' <span class="badge-noninti">(non-inti)</span>' : ''}</span>
      <span>${escapeHtml(pkSubLayananLabel(r.layanan, r.tipe))}</span>
      <span class="pk-row-actions">
        <button class="icon-btn" title="Shift lain (unit &amp; rentang sama)" onclick="event.stopPropagation();addPkRencanaShiftLain('${r.id}')">${ic('plus')}</button>
        <button class="icon-btn" title="Hapus" onclick="event.stopPropagation();deletePkRencanaRow('${r.id}')">${ic('trash')}</button>
      </span>
    </div>
  `;
}
/* Form edit kecil (modal) untuk 1 baris Program — tanggal mulai/sampai, unit, sopir, layanan, hapus */
function openPkRencanaEdit(rowId){ renderPkRencanaEditModal(rowId); }
function updatePkRencanaFieldModal(rowId, field, val){ updatePkRencanaField(rowId, field, val); renderPkRencanaEditModal(rowId); }
function setPkRencanaSopirFromDriverModal(rowId, val){ setPkRencanaSopirFromDriver(rowId, val); renderPkRencanaEditModal(rowId); }
function setPkRencanaSopirManualModal(rowId, val){ setPkRencanaSopirManual(rowId, val); renderPkRencanaEditModal(rowId); }
function renderPkRencanaEditModal(rowId){
  const r = PROGRAM_RENCANA.find(x=>x.id===rowId);
  if(!r) return;
  const driverSelectVal = r.isInti ? ((DRIVER_LIST.find(d=>d.nama===r.sopir)||{}).id || '') : '__LAINNYA__';
  openModal(`
    <div class="mhead"><h2>Edit Program</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:8px;">Berlaku: ${fmtLabel(r.tanggalMulai)}${r.tanggalSampai!==r.tanggalMulai ? ' &ndash; '+fmtLabel(r.tanggalSampai) : ''} &middot; ubah rentang tanggal lewat Tanggal Mulai/Sampai di atas tabel Program.</div>
    <label class="flabel">No Unit</label>
    <select onchange="updatePkRencanaFieldModal('${r.id}','unitId',this.value)">
      <option value="">- Pilih -</option>
      ${UNITS.filter(u=>!u.isSystem).map(u=>`<option value="${u.id}" ${r.unitId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
    </select>
    <label class="flabel">Sopir</label>
    <select onchange="setPkRencanaSopirFromDriverModal('${r.id}', this.value)">
      <option value="">- Pilih -</option>
      ${DRIVER_LIST.map(d=>`<option value="${d.id}" ${driverSelectVal===d.id?'selected':''}>${escapeHtml(d.nama)}</option>`).join('')}
      <option value="__LAINNYA__" ${driverSelectVal==='__LAINNYA__'?'selected':''}>Lainnya (ketik nama)</option>
    </select>
    ${driverSelectVal==='__LAINNYA__' ? `<input type="text" placeholder="Ketik nama sopir" value="${escapeHtml(r.isInti?'':r.sopir)}" onchange="setPkRencanaSopirManualModal('${r.id}', this.value)">` : ''}
    ${!r.isInti && r.sopir ? `<div class="field-sub" style="color:var(--secondary);font-weight:700;">Non-inti (input manual)</div>` : ''}
    <label class="flabel">Layanan</label>
    <select onchange="updatePkRencanaFieldModal('${r.id}','layanan',this.value)">
      <option value="">- Pilih -</option>
      ${JENIS_LAYANAN_LIST.map(j=>`<option value="${j}" ${r.layanan===j?'selected':''}>${escapeHtml(j)}</option>`).join('')}
    </select>
    ${pkTipeLabelFor(r.layanan) ? `
    <label class="flabel">${escapeHtml(pkTipeLabelFor(r.layanan))}</label>
    <select onchange="updatePkRencanaFieldModal('${r.id}','tipe',this.value)">
      <option value="">- Pilih -</option>
      ${pkTipeOptionsFor(r.layanan).map(t=>`<option value="${escapeHtml(t)}" ${r.tipe===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}
    </select>
    ` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
      <button class="pill-btn sm outline" onclick="addPkRencanaShiftLain('${r.id}');closeModal();">+ Shift lain</button>
      <button class="icon-btn" style="color:var(--secondary);" onclick="deletePkRencanaRow('${r.id}');closeModal();">${ic('trash')} Hapus</button>
    </div>
  `);
}
function renderPkProgramTab(){
  const rangeEntries = PROGRAM_RENCANA.filter(r=>r.tanggalMulai===pkTanggalMulai && r.tanggalSampai===pkTanggalSampai);
  return `
    <label class="flabel">Tanggal Mulai</label>
    <input type="date" value="${pkTanggalMulai}" onchange="setPkTanggalMulai(this.value)">
    <label class="flabel">Tanggal Sampai (program berlaku s/d tanggal ini)</label>
    <input type="date" value="${pkTanggalSampai}" onchange="setPkTanggalSampai(this.value)">
    <div class="section-eyebrow section-eyebrow-row">Program ${fmtLabel(pkTanggalMulai)}${pkTanggalSampai!==pkTanggalMulai ? ' &ndash; '+fmtLabel(pkTanggalSampai) : ''}<button class="pill-btn sm" onclick="addPkRencanaRow()">+ Tambah</button></div>
    ${rangeEntries.length===0 ? '<div class="card"><div class="empty-note">Belum ada program untuk rentang tanggal ini. Tap "+ Tambah" untuk mulai.</div></div>' : `
      <div class="pk-table">
        <div class="pk-row pk-row-head"><span>No Unit</span><span>Sopir</span><span>Layanan</span><span></span></div>
        ${rangeEntries.map(r=>renderPkRencanaRowCompact(r)).join('')}
      </div>
      <div class="field-sub">Tap baris untuk mengedit atau mengubah rentang tanggalnya.</div>
    `}
  `;
}

/* ----- Sub-tab: AKTUAL (realisasi) ----- */
function getPkAktualFor(rencanaId, tanggal){
  return PROGRAM_AKTUAL.find(a=>a.rencanaId===rencanaId && a.tanggal===tanggal) || null;
}
function ensurePkAktualRow(rencanaId, tanggal){
  let a = PROGRAM_AKTUAL.find(x=>x.rencanaId===rencanaId && x.tanggal===tanggal);
  if(!a){
    const r = PROGRAM_RENCANA.find(x=>x.id===rencanaId);
    if(!r) return null;
    a = {id:uid(), rencanaId, tanggal, unitId:r.unitId, sopir:r.sopir, isInti:r.isInti, layanan:r.layanan, tipe:r.tipe||'', overtimeJam:pkJamOtomatis(r.layanan, r.tipe), overtimeManual:null};
    PROGRAM_AKTUAL.push(a);
  }
  return a;
}
function prunePkAktualIfSameAsProgram(rencanaId, tanggal){
  const idx = PROGRAM_AKTUAL.findIndex(x=>x.rencanaId===rencanaId && x.tanggal===tanggal);
  if(idx<0) return;
  const a = PROGRAM_AKTUAL[idx];
  const r = PROGRAM_RENCANA.find(x=>x.id===rencanaId);
  if(!r) return;
  const sama = a.unitId===r.unitId && a.sopir===r.sopir && a.isInti===r.isInti && a.layanan===r.layanan && (a.tipe||'')===(r.tipe||'') &&
    (a.overtimeManual===null || a.overtimeManual===undefined || a.overtimeManual===pkJamOtomatis(r.layanan, r.tipe));
  if(sama) PROGRAM_AKTUAL.splice(idx,1);
}
function updatePkAktual(rencanaId, tanggal, field, val){
  const a = ensurePkAktualRow(rencanaId, tanggal);
  if(!a) return;
  a[field] = val;
  if(field==='layanan'){
    a.tipe = ''; // ganti Layanan -> reset Tipe (opsi Tipe lama mungkin sudah tidak relevan)
    if(a.overtimeManual===null || a.overtimeManual===undefined) a.overtimeJam = pkJamOtomatis(a.layanan, a.tipe);
  }
  if(field==='tipe'){
    if(a.overtimeManual===null || a.overtimeManual===undefined) a.overtimeJam = pkJamOtomatis(a.layanan, a.tipe);
  }
  prunePkAktualIfSameAsProgram(rencanaId, tanggal);
  saveProgramAktual();
  renderProker();
}
function updatePkAktualSopir(rencanaId, tanggal, val){
  const a = ensurePkAktualRow(rencanaId, tanggal);
  if(!a) return;
  if(val==='__LAINNYA__'){ a.sopir=''; a.isInti=false; }
  else { const d=DRIVER_LIST.find(x=>x.id===val); a.sopir=d?d.nama:''; a.isInti=true; }
  prunePkAktualIfSameAsProgram(rencanaId, tanggal);
  saveProgramAktual();
  renderProker();
}
function updatePkAktualOvertime(rencanaId, tanggal, val){
  const a = ensurePkAktualRow(rencanaId, tanggal);
  if(!a) return;
  const num = parseFloat(val);
  a.overtimeManual = isNaN(num) ? null : num;
  a.overtimeJam = isNaN(num) ? pkJamOtomatis(a.layanan, a.tipe) : num;
  prunePkAktualIfSameAsProgram(rencanaId, tanggal);
  saveProgramAktual();
  renderProker();
}
/* Baris ringkas di tabel Aktual (tap untuk buka form edit kecil) */
function renderPkAktualRowCompact(r, tanggal){
  const a = getPkAktualFor(r.id, tanggal);
  const unitId = a ? a.unitId : r.unitId;
  const sopir = a ? a.sopir : r.sopir;
  const isInti = a ? a.isInti : r.isInti;
  const layanan = a ? a.layanan : r.layanan;
  const tipe = a ? a.tipe : r.tipe;
  const overtime = a && a.overtimeManual!=null ? a.overtimeManual : pkJamOtomatis(layanan, tipe);
  return `
    <div class="pk-row pk-row-aktual" onclick="openPkAktualEdit('${r.id}','${tanggal}')">
      <span>${unitId?escapeHtml(btLabel(unitId)):'-'}</span>
      <span>${escapeHtml(sopir||'-')}${!isInti && sopir ? ' <span class="badge-noninti">(non-inti)</span>' : ''}</span>
      <span>${escapeHtml(pkSubLayananLabel(layanan, tipe))}${a?' <span class="badge-noninti" style="color:var(--primary);">(diubah)</span>':''}</span>
      <span>${(parseFloat(overtime)||0).toFixed(1)}j</span>
      <span class="pk-row-actions"></span>
    </div>
  `;
}
/* Form edit kecil (modal) untuk 1 baris Aktual — unit, sopir, layanan, tipe, overtime */
function openPkAktualEdit(rencanaId, tanggal){ renderPkAktualEditModal(rencanaId, tanggal); }
function updatePkAktualModal(rencanaId, tanggal, field, val){ updatePkAktual(rencanaId, tanggal, field, val); renderPkAktualEditModal(rencanaId, tanggal); }
function updatePkAktualSopirModal(rencanaId, tanggal, val){ updatePkAktualSopir(rencanaId, tanggal, val); renderPkAktualEditModal(rencanaId, tanggal); }
function updatePkAktualOvertimeModal(rencanaId, tanggal, val){ updatePkAktualOvertime(rencanaId, tanggal, val); renderPkAktualEditModal(rencanaId, tanggal); }
function renderPkAktualEditModal(rencanaId, tanggal){
  const r = PROGRAM_RENCANA.find(x=>x.id===rencanaId);
  if(!r) return;
  const a = getPkAktualFor(rencanaId, tanggal);
  const unitId = a ? a.unitId : r.unitId;
  const sopir = a ? a.sopir : r.sopir;
  const isInti = a ? a.isInti : r.isInti;
  const layanan = a ? a.layanan : r.layanan;
  const tipe = a ? a.tipe : r.tipe;
  const overtime = a && a.overtimeManual!=null ? a.overtimeManual : pkJamOtomatis(layanan, tipe);
  openModal(`
    <div class="mhead"><h2>Edit Aktual</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:8px;">Program asli (${fmtLabel(tanggal)}): ${escapeHtml(btLabel(r.unitId))} &middot; ${escapeHtml(r.sopir||'-')} &middot; ${escapeHtml(pkSubLayananLabel(r.layanan, r.tipe))}${a?' <b style="color:var(--primary);">(sudah diubah)</b>':''}</div>
    <label class="flabel">No Unit</label>
    <select onchange="updatePkAktualModal('${r.id}','${tanggal}','unitId',this.value)">
      ${UNITS.filter(u=>!u.isSystem).map(u=>`<option value="${u.id}" ${unitId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
    </select>
    <label class="flabel">Sopir</label>
    <select onchange="updatePkAktualSopirModal('${r.id}','${tanggal}', this.value)">
      <option value="">- Pilih -</option>
      ${DRIVER_LIST.map(d=>`<option value="${d.id}" ${(isInti && d.nama===sopir)?'selected':''}>${escapeHtml(d.nama)}</option>`).join('')}
      <option value="__LAINNYA__" ${!isInti?'selected':''}>Lainnya (ketik nama)</option>
    </select>
    ${!isInti ? `<input type="text" placeholder="Ketik nama sopir" value="${escapeHtml(sopir||'')}" onchange="updatePkAktualModal('${r.id}','${tanggal}','sopir',this.value)">` : ''}
    <label class="flabel">Layanan</label>
    <select onchange="updatePkAktualModal('${r.id}','${tanggal}','layanan',this.value)">
      ${JENIS_LAYANAN_LIST.map(j=>`<option value="${j}" ${layanan===j?'selected':''}>${escapeHtml(j)}</option>`).join('')}
    </select>
    ${pkTipeLabelFor(layanan) ? `
    <label class="flabel">${escapeHtml(pkTipeLabelFor(layanan))}</label>
    <select onchange="updatePkAktualModal('${r.id}','${tanggal}','tipe',this.value)">
      <option value="">- Pilih -</option>
      ${pkTipeOptionsFor(layanan).map(t=>`<option value="${escapeHtml(t)}" ${tipe===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}
    </select>
    ` : ''}
    <label class="flabel">Jam</label>
    <input type="text" inputmode="numeric" value="${overtime}" onchange="updatePkAktualOvertimeModal('${r.id}','${tanggal}', this.value)">
    <div class="field-sub">Otomatis dari ${pkTipeLabelFor(layanan) ? 'Layanan + '+escapeHtml(pkTipeLabelFor(layanan)) : 'Layanan'}: ${pkJamOtomatis(layanan, tipe)} jam &middot; bisa ditimpa manual di atas.</div>
  `);
}
function renderPkAktualTab(){
  const programHariIni = pkProgramRowsForDate(pkAktualTanggal);
  const header = `
    <label class="flabel">Tanggal</label><input type="date" value="${pkAktualTanggal}" onchange="setPkAktualTanggal(this.value)">
    <div class="chk-row"><input type="checkbox" id="pk-tandaLL" ${pkTandaLiburLembur(pkAktualTanggal)?'checked':''} onchange="togglePkTandaLiburLembur('${pkAktualTanggal}', this.checked)"><label for="pk-tandaLL" style="margin-left:6px;">Tanggal Libur/Lembur (dipakai filter Rekap)</label></div>
  `;
  if(programHariIni.length===0){
    return header + `<div class="card"><div class="empty-note">Belum ada Program yang berlaku di tanggal ini. Isi Program dulu di sub-tab Program.</div></div>`;
  }
  return header + `
    <div class="section-eyebrow">Aktual ${fmtLabel(pkAktualTanggal)}</div>
    <div class="pk-table">
      <div class="pk-row pk-row-head pk-row-aktual"><span>No Unit</span><span>Sopir</span><span>Layanan</span><span>OT</span><span></span></div>
      ${programHariIni.map(r=>renderPkAktualRowCompact(r, pkAktualTanggal)).join('')}
    </div>
    <div class="field-sub">Tap baris untuk mengoreksi realisasi hari ini &middot; kalau tidak disentuh, dianggap sesuai Program.</div>
  `;
}

/* ----- Sub-tab: REKAP (dalam modul Program Kerja) ----- */
function pkEffectiveRowsForDate(tanggal){
  const tandaLL = pkTandaLiburLembur(tanggal);
  return pkProgramRowsForDate(tanggal).map(r=>{
    const a = getPkAktualFor(r.id, tanggal);
    if(a) return {tanggal, unitId:a.unitId, sopir:a.sopir, isInti:a.isInti, layanan:a.layanan, tipe:a.tipe||'', overtimeJam:(a.overtimeManual!=null?a.overtimeManual:pkJamOtomatis(a.layanan, a.tipe)), tandaLiburLembur:tandaLL};
    return {tanggal, unitId:r.unitId, sopir:r.sopir, isInti:r.isInti, layanan:r.layanan, tipe:r.tipe||'', overtimeJam:pkJamOtomatis(r.layanan, r.tipe), tandaLiburLembur:tandaLL};
  });
}
function pkDatesInPeriode(prefix){
  const dates = new Set();
  PROGRAM_RENCANA.forEach(r=>{
    pkExpandDates(r.tanggalMulai, r.tanggalSampai).forEach(dt=>{ if(dt.startsWith(prefix)) dates.add(dt); });
  });
  return Array.from(dates).sort();
}
function pkRekapRows(){
  const prefix = pkRekapMode==='bulan' ? pkRekapBulan : String(pkRekapTahun);
  let rows = [];
  pkDatesInPeriode(prefix).forEach(d=>{ rows = rows.concat(pkEffectiveRowsForDate(d)); });
  if(pkRekapHanyaLL) rows = rows.filter(r=>r.tandaLiburLembur);
  return rows;
}
function setPkRekapMode(m){ pkRekapMode=m; renderProker(); }
function setPkRekapBulan(v){ pkRekapBulan=v; renderProker(); }
function setPkRekapTahun(v){ pkRekapTahun=v; renderProker(); }
function setPkRekapHanyaLL(v){ pkRekapHanyaLL=v; renderProker(); }
/* Bagian filter Rekap yang di-sticky-kan (dipanggil dari renderProgramKerjaHtml) —
 * radio Per Bulan/Tahun, dropdown periode, checkbox Hanya Libur & Lembur, tombol export. */
function renderPkRekapFilters(){
  return `
    <div style="display:flex;gap:10px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div class="chk-row"><input type="radio" name="pk-rekap-mode" ${pkRekapMode==='bulan'?'checked':''} onchange="setPkRekapMode('bulan')"><label style="margin-left:6px;">Per Bulan</label></div>
        <div class="chk-row"><input type="radio" name="pk-rekap-mode" ${pkRekapMode==='tahun'?'checked':''} onchange="setPkRekapMode('tahun')"><label style="margin-left:6px;">Per Tahun</label></div>
        ${pkRekapMode==='bulan'
          ? `<input type="month" value="${pkRekapBulan}" onchange="setPkRekapBulan(this.value)">`
          : `<input type="number" inputmode="numeric" value="${pkRekapTahun}" onchange="setPkRekapTahun(this.value)">`}
        <div class="chk-row"><input type="checkbox" id="pk-rekap-ll" ${pkRekapHanyaLL?'checked':''} onchange="setPkRekapHanyaLL(this.checked)"><label for="pk-rekap-ll" style="margin-left:6px;">Hanya Libur &amp; Lembur</label></div>
      </div>
      <button title="Export / Cetak" onclick="openPkPrintFilterModal()" style="flex-shrink:0;background:var(--surface-container);border:none;border-radius:12px;width:46px;height:46px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--on-surface);margin-top:2px;">${ic('document',22)}</button>
    </div>
  `;
}
/* Bagian isi Rekap yang ikut discroll (mulai dari "Total Jam per Driver" ke bawah). */
function renderPkRekapBody(){
  const rows = pkRekapRows();
  const totals = {};
  rows.forEach(r=>{ const key = r.sopir||'(kosong)'; totals[key] = (totals[key]||0) + (parseFloat(r.overtimeJam)||0); });
  const totalArr = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const byDate = rows.reduce((g,r)=>{ (g[r.tanggal]=g[r.tanggal]||[]).push(r); return g; }, {});
  const dateGroups = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0]));
  return `
    <div class="section-eyebrow" style="margin-top:0;">Total Jam per Driver</div>
    <div class="card card-flat" style="padding:2px 14px;">
      ${totalArr.length===0 ? '<div class="empty-note">Belum ada data.</div>' :
        totalArr.map(([nama,jam])=>{
          const expanded = pkRekapExpandedDrivers.has(nama);
          const namaJs = escapeHtml(nama).replace(/'/g,"\\'");
          const driverRows = rows.filter(r=>(r.sopir||'(kosong)')===nama).slice().sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
          return `
          <div class="pk-accordion-item" style="border-bottom:1px solid var(--outline-variant);">
            <div class="list-row" style="cursor:pointer;border-bottom:none;padding:12px 0;" onclick="togglePkRekapDriver('${namaJs}')">
              <span style="display:flex;align-items:center;gap:6px;min-width:0;">
                <span style="display:inline-block;flex-shrink:0;transition:transform .2s;transform:rotate(${expanded?180:0}deg);color:var(--on-surface-variant);">${ic('chevron',16)}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nama)}</span>
              </span>
              <b style="flex-shrink:0;">${jam.toFixed(1)} jam</b>
            </div>
            ${expanded ? `
            <div style="padding:0 0 10px 22px;">
              ${driverRows.map(r=>`<div class="list-row" style="padding:7px 0;border-bottom:1px dashed var(--outline-variant);"><span style="font-size:12.5px;color:var(--on-surface-variant);">${fmtLabel(r.tanggal).split(', ')[1]} &middot; ${escapeHtml(btLabel(r.unitId))} &middot; ${escapeHtml(pkSubLayananLabel(r.layanan, r.tipe))}</span><span style="font-size:12.5px;">${(parseFloat(r.overtimeJam)||0).toFixed(1)} j</span></div>`).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}
    </div>
    <div class="section-eyebrow">Rincian per Tanggal</div>
    ${dateGroups.length===0 ? '<div class="card"><div class="empty-note">Tidak ada entri pada periode ini.</div></div>' :
      dateGroups.map(([tgl,list])=>{
        const expanded = pkRekapExpandedDates.has(tgl);
        const totalJamTgl = list.reduce((s,r)=>s+(parseFloat(r.overtimeJam)||0),0);
        return `
        <div class="card" style="cursor:pointer;padding:14px;" onclick="togglePkRekapDate('${tgl}')">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="display:flex;align-items:center;gap:8px;font-weight:800;min-width:0;">
              <span style="display:inline-block;flex-shrink:0;transition:transform .2s;transform:rotate(${expanded?180:0}deg);color:var(--on-surface-variant);">${ic('chevron',16)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${fmtLabel(tgl)}</span>
            </span>
            <span class="field-sub" style="flex-shrink:0;">${list.length} entri &middot; ${totalJamTgl.toFixed(1)} j</span>
          </div>
          ${expanded ? `
          <div style="margin-top:8px;" onclick="event.stopPropagation()">
            ${list.map(r=>`<div class="list-row"><span>${escapeHtml(btLabel(r.unitId))} &middot; ${escapeHtml(r.sopir||'-')} &middot; ${escapeHtml(pkSubLayananLabel(r.layanan, r.tipe))}</span><span>${(parseFloat(r.overtimeJam)||0).toFixed(1)} j</span></div>`).join('')}
          </div>` : ''}
        </div>
      `;}).join('')}
  `;
}

/* ================= FILTER SEBELUM CETAK (v1.0.32) =================
 * Tap tombol Export/Cetak di Rekap SELALU buka dialog ini dulu (rentang
 * tanggal + pilih sopir) sebelum PDF/Excel benar-benar dibuat. Dipisah
 * total dari filter Bulan/Tahun di sub-tab Rekap (yang itu cuma untuk
 * tampilan layar, bukan lagi dipakai sebagai sumber data cetak). */
let pkPrintFilter = null; // {mulai, sampai, selected:Set<namaSopir>} — diisi saat modal pertama dibuka

/* Daftar nama sopir untuk checklist filter: inti (ada di DRIVER_LIST) dulu
 * alfabetis, baru non-inti (nama manual yang pernah dipakai di baris
 * Program/Aktual) alfabetis di bawahnya. */
function pkAllDriverNamesForFilter(){
  const set = new Set();
  DRIVER_LIST.forEach(d=>{ if(d.nama) set.add(d.nama); });
  PROGRAM_RENCANA.forEach(r=>{ if(r.sopir) set.add(r.sopir); });
  PROGRAM_AKTUAL.forEach(a=>{ if(a.sopir) set.add(a.sopir); });
  const intiNames = new Set(DRIVER_LIST.map(d=>d.nama));
  const collator = (a,b)=>a.localeCompare(b,'id');
  const inti = Array.from(set).filter(nm=>intiNames.has(nm)).sort(collator);
  const nonInti = Array.from(set).filter(nm=>!intiNames.has(nm)).sort(collator);
  return { inti, nonInti };
}
function openPkPrintFilterModal(){
  if(!pkPrintFilter){
    const { inti, nonInti } = pkAllDriverNamesForFilter();
    pkPrintFilter = {
      mulai: todayIso().slice(0,8)+'01', // awal bulan berjalan, default yang wajar
      sampai: todayIso(),
      selected: new Set(inti.concat(nonInti)) // default semua sopir tercentang
    };
  }
  renderPkPrintFilterModal();
}
function setPkPrintMulai(val){ pkPrintFilter.mulai = val; renderPkPrintFilterModal(); }
function setPkPrintSampai(val){ pkPrintFilter.sampai = val; renderPkPrintFilterModal(); }
function togglePkPrintDriver(nama, checked){
  if(checked) pkPrintFilter.selected.add(nama); else pkPrintFilter.selected.delete(nama);
  renderPkPrintFilterModal();
}
function togglePkPrintSelectAll(){
  const { inti, nonInti } = pkAllDriverNamesForFilter();
  const all = inti.concat(nonInti);
  pkPrintFilter.selected = (pkPrintFilter.selected.size >= all.length) ? new Set() : new Set(all);
  renderPkPrintFilterModal();
}
function pkPrintCheckboxRow(nama){
  const namaJs = nama.replace(/'/g,"\\'");
  const namaAttr = escapeHtml(nama).replace(/"/g,'&quot;');
  const checked = pkPrintFilter.selected.has(nama);
  return `<div class="chk-row"><input type="checkbox" ${checked?'checked':''} onchange="togglePkPrintDriver('${namaJs}', this.checked)"><label style="margin-left:6px;" onclick="event.preventDefault();this.previousElementSibling.click();">${namaAttr}</label></div>`;
}
function renderPkPrintFilterModal(){
  const { inti, nonInti } = pkAllDriverNamesForFilter();
  const totalOpsi = inti.length + nonInti.length;
  openModal(`
    <div class="mhead"><h2>Filter Cetak Proker</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Mulai</label>
    <input type="date" value="${pkPrintFilter.mulai}" onchange="setPkPrintMulai(this.value)">
    <label class="flabel">Sampai dengan</label>
    <input type="date" value="${pkPrintFilter.sampai}" onchange="setPkPrintSampai(this.value)">
    <div class="section-eyebrow section-eyebrow-row">Pilih Sopir<button class="pill-btn sm outline" onclick="togglePkPrintSelectAll()">${pkPrintFilter.selected.size>=totalOpsi && totalOpsi>0 ? 'Batal Semua' : 'Pilih Semua'}</button></div>
    ${totalOpsi===0 ? '<div class="card"><div class="empty-note">Belum ada data sopir sama sekali (dari Driver maupun baris Program).</div></div>' : `
    <div class="card card-flat" style="padding:2px 14px;max-height:280px;overflow-y:auto;">
      ${inti.map(pkPrintCheckboxRow).join('')}
      ${nonInti.length>0 ? `<div class="field-sub" style="font-weight:700;margin:8px 0 2px;">Non-inti</div>${nonInti.map(pkPrintCheckboxRow).join('')}` : ''}
    </div>`}
    <div class="field-sub" style="margin:8px 0 14px;">${pkPrintFilter.selected.size} sopir dipilih &middot; sel tanpa aktivitas dikosongkan di PDF, baris Minggu/libur nasional otomatis disorot hijau.</div>
    <button class="btn-block" onclick="confirmPkPrintFilter()">${ic('document')} Lanjutkan</button>
  `);
}
function confirmPkPrintFilter(){
  if(!pkPrintFilter.mulai || !pkPrintFilter.sampai){ toast('Isi tanggal Mulai & Sampai dengan dulu'); return; }
  if(pkPrintFilter.sampai < pkPrintFilter.mulai){ toast('Tanggal Sampai dengan tidak boleh sebelum Mulai'); return; }
  if(pkPrintFilter.selected.size===0){ toast('Pilih minimal 1 sopir dulu'); return; }
  openPkExportSheet();
}

/* Popup pilih format cetak (PDF/Excel), tampil SETELAH filter dikonfirmasi */
function openPkExportSheet(){
  openModal(`
    <div class="mhead"><h2>Export / Cetak Program Kerja</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:14px;">${fmtLabel(pkPrintFilter.mulai)} &ndash; ${fmtLabel(pkPrintFilter.sampai)} &middot; ${pkPrintFilter.selected.size} sopir dipilih</div>
    <div style="display:flex;gap:10px;">
      <button class="btn-block" style="flex:1;" onclick="doPkExport('pdf')">${ic('document')} PDF</button>
      <button class="btn-block outline" style="flex:1;" onclick="doPkExport('xlsx')">${ic('barchart')} Excel</button>
    </div>
    <button class="pill-btn sm outline" style="margin-top:12px;" onclick="openPkPrintFilterModal()">&larr; Ubah filter</button>
  `);
}

/* ----- Data sumber Excel (masih format flat: Tanggal | No Unit | Sopir | Layanan | OT), disaring sesuai filter ----- */
function pkExportRowsFiltered(dateList, selectedSet){
  let rows = [];
  dateList.forEach(d=>{ rows = rows.concat(pkEffectiveRowsForDate(d).filter(r=>selectedSet.has(r.sopir))); });
  rows.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const data = rows.map(r=>({
    'Tanggal': fmtLabel(r.tanggal), 'No Unit': btLabel(r.unitId), 'Sopir': r.sopir||'-', 'Layanan': pkSubLayananLabel(r.layanan, r.tipe), 'Overtime (jam)': (parseFloat(r.overtimeJam)||0).toFixed(1)
  }));
  for(let i=data.length-1;i>0;i--){ if(rows[i].tanggal===rows[i-1].tanggal) data[i]['Tanggal']=''; }
  return data;
}

/* ================= SUMBER DATA LIBUR NASIONAL (cache per tahun) =================
 * API gratis tanpa key: https://api-hari-libur.vercel.app/api?year=YYYY. Hasil
 * fetch disimpan per tahun (key v2_holiday_cache_<tahun>) supaya kalau API
 * sedang down, cetak PDF tetap jalan pakai cache terakhir alih-alih gagal
 * total. Response: {status,code,data:[{date,description}],message}. */
async function pkFetchHolidayYear(year){
  const cacheKey = 'v2_holiday_cache_'+year;
  const cached = LS.get(cacheKey, null);
  try{
    const resp = await fetch('https://api-hari-libur.vercel.app/api?year='+year);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const json = await resp.json();
    const dates = Array.isArray(json && json.data) ? json.data.map(x=>x.date).filter(Boolean) : [];
    LS.set(cacheKey, {fetchedAt:Date.now(), dates});
    return dates;
  }catch(e){
    console.warn('Gagal ambil data libur nasional '+year+', pakai cache terakhir:', e && e.message ? e.message : e);
    return (cached && Array.isArray(cached.dates)) ? cached.dates : [];
  }
}
async function pkGetHolidaySetForRange(mulai, sampai){
  const yStart = parseInt(mulai.slice(0,4),10);
  const yEnd = parseInt(sampai.slice(0,4),10);
  const set = new Set();
  for(let y=yStart; y<=yEnd; y++){
    const dates = await pkFetchHolidayYear(y);
    dates.forEach(d=>set.add(d));
  }
  return set;
}
/* Baris disorot hijau kalau Minggu ATAU libur nasional — Sabtu SENGAJA selalu
 * normal/putih (sesuai permintaan Han), walau kebetulan ada cuti bersama yang
 * jatuh di hari Sabtu. */
function pkIsHighlightDate(dateIso, holidaySet){
  const day = new Date(dateIso+'T00:00:00').getDay();
  if(day===6) return false;
  return day===0 || holidaySet.has(dateIso);
}
/* Label tanggal ringkas untuk kolom Tanggal PDF: "Sen 26/8" */
function pkTanggalPdfLabel(iso){
  const d = new Date(iso+'T00:00:00');
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
  return hari+' '+d.getDate()+'/'+(d.getMonth()+1);
}
/* Isi kompak 1 sel Unit+Singkatan — unit sistem (Libur/Standby) cukup nama
 * unitnya saja, unit biasa digabung dengan Singkatan Layanan (kalau ada). */
function pkCellUnitSingkatan(row){
  if(!row || !row.unitId) return '';
  if(isSystemUnitId(row.unitId)) return btLabel(row.unitId);
  const unitLabel = btLabel(row.unitId);
  const sing = pkSingkatanLayanan(row.layanan, row.tipe);
  return [unitLabel, sing].filter(Boolean).join(' ');
}
/* Ambil sel gabungan untuk 1 sopir di 1 tanggal dari daftar baris efektif
 * tanggal itu (pkEffectiveRowsForDate). Kalau sopir yang sama kebetulan punya
 * lebih dari 1 baris di tanggal yang sama (mis. 2 shift), digabung jadi 1 sel
 * (label dipisah " / ", jam OT dijumlah) supaya tabel tetap 2 kolom per sopir. */
function pkCellFor(rowsForDate, namaSopir){
  const matches = rowsForDate.filter(r=>r.sopir===namaSopir);
  if(matches.length===0) return null;
  const label = matches.map(pkCellUnitSingkatan).filter(Boolean).join(' / ');
  const ot = matches.reduce((s,r)=>s+(parseFloat(r.overtimeJam)||0),0);
  return { label, ot };
}

/* ================= PDF PIVOT PROKER (v1.0.32) =================
 * Tabel digambar manual (bukan autoTable) supaya bisa: 2 kolom compact per
 * sopir (Unit+Singkatan | OT), highlight baris per tanggal, DAN pagination
 * horizontal (sopir dipecah ke halaman berikutnya kalau tidak muat) sekaligus
 * vertikal (tanggal lanjut ke halaman berikutnya, header diulang). Tanpa
 * judul besar / legenda / footer — sesuai permintaan (dokumen pribadi). */
function pkBuildPivotPdf(dateList, driverNames, holidaySet){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 8, marginTop = 10, marginBottom = 8;
  const dateColW = 17, unitColW = 22, otColW = 10; // dateColW dipersempit (v1.0.33) - sisa ruang otomatis nambah jumlah sopir per halaman lewat perChunk di bawah
  const groupW = unitColW + otColW;
  const usableW = pageW - marginX*2 - dateColW;
  const perChunk = Math.max(1, Math.floor(usableW / groupW));
  const chunks = [];
  for(let i=0;i<driverNames.length;i+=perChunk) chunks.push(driverNames.slice(i, i+perChunk));

  // Pra-hitung baris efektif per tanggal (dipakai bareng lintas chunk) & total OT per sopir se-rentang filter
  const rowsByDate = {};
  const totals = {};
  driverNames.forEach(nm=>{ totals[nm]=0; });
  dateList.forEach(d=>{
    const rows = pkEffectiveRowsForDate(d);
    rowsByDate[d] = rows;
    driverNames.forEach(nm=>{
      const cell = pkCellFor(rows, nm);
      if(cell) totals[nm] += cell.ot;
    });
  });

  const rowH = 6.2, headH1 = 9, headH2 = 6, totalRowH = 7.5;

  chunks.forEach((chunkDrivers, chunkIdx)=>{
    if(chunkIdx>0) doc.addPage();
    let y = marginTop;
    const tableW = dateColW + groupW*chunkDrivers.length;
    function drawHeader(){
      doc.setDrawColor(190,190,190);
      doc.setFillColor(78,127,224);
      doc.setTextColor(255,255,255);
      doc.setFont(undefined,'bold');
      doc.rect(marginX, y, dateColW, headH1+headH2, 'FD');
      doc.setFontSize(8);
      doc.text('Tanggal', marginX+dateColW/2, y+(headH1+headH2)/2+1.3, {align:'center'});
      let x = marginX+dateColW;
      chunkDrivers.forEach(nm=>{
        doc.rect(x, y, groupW, headH1, 'FD');
        doc.setFontSize(7.3);
        doc.text(nm, x+groupW/2, y+headH1/2+1.1, {align:'center', maxWidth:groupW-2});
        doc.rect(x, y+headH1, unitColW, headH2, 'FD');
        doc.rect(x+unitColW, y+headH1, otColW, headH2, 'FD');
        doc.setFontSize(7);
        doc.text('Unit', x+unitColW/2, y+headH1+headH2-1.7, {align:'center'});
        doc.text('OT', x+unitColW+otColW/2, y+headH1+headH2-1.7, {align:'center'});
        x += groupW;
      });
      y += headH1+headH2;
      doc.setTextColor(20,20,20);
      doc.setFont(undefined,'normal');
    }
    drawHeader();
    dateList.forEach(dt=>{
      if(y+rowH > pageH-marginBottom){ doc.addPage(); y = marginTop; drawHeader(); }
      if(pkIsHighlightDate(dt, holidaySet)){
        doc.setFillColor(211,242,211);
        doc.rect(marginX, y, tableW, rowH, 'F');
      }
      doc.setDrawColor(200,200,200);
      doc.rect(marginX, y, dateColW, rowH);
      doc.setFontSize(7.2);
      doc.text(pkTanggalPdfLabel(dt), marginX+1.5, y+rowH-2);
      const rowsForDate = rowsByDate[dt];
      let x = marginX+dateColW;
      chunkDrivers.forEach(nm=>{
        doc.rect(x, y, unitColW, rowH);
        doc.rect(x+unitColW, y, otColW, rowH);
        const cell = pkCellFor(rowsForDate, nm);
        if(cell){
          doc.setFontSize(6.5);
          doc.text(cell.label, x+1, y+rowH-2, {maxWidth:unitColW-2});
          doc.setFontSize(7.2);
          doc.text(cell.ot.toFixed(1), x+unitColW+otColW-1.2, y+rowH-2, {align:'right'});
        }
        x += groupW;
      });
      y += rowH;
    });
    if(y+totalRowH > pageH-marginBottom){ doc.addPage(); y = marginTop; drawHeader(); }
    doc.setFillColor(234,241,255);
    doc.rect(marginX, y, tableW, totalRowH, 'F');
    doc.setDrawColor(200,200,200);
    doc.rect(marginX, y, dateColW, totalRowH);
    doc.setFont(undefined,'bold');
    doc.setFontSize(7.5);
    doc.text('TOTAL OT', marginX+1.5, y+totalRowH-2.5);
    let x2 = marginX+dateColW;
    chunkDrivers.forEach(nm=>{
      doc.rect(x2, y, unitColW, totalRowH);
      doc.rect(x2+unitColW, y, otColW, totalRowH);
      doc.text((totals[nm]||0).toFixed(1), x2+unitColW+otColW-1.2, y+totalRowH-2.5, {align:'right'});
      x2 += groupW;
    });
    doc.setFont(undefined,'normal');
  });

  return doc;
}

async function doPkExport(fmt){
  if(!pkPrintFilter){ toast('Filter belum diisi'); return; }
  const dateList = pkExpandDates(pkPrintFilter.mulai, pkPrintFilter.sampai);
  if(dateList.length===0){ toast('Rentang tanggal tidak valid'); return; }
  const { inti, nonInti } = pkAllDriverNamesForFilter();
  const driverNames = inti.concat(nonInti).filter(nm=>pkPrintFilter.selected.has(nm));
  if(driverNames.length===0){ toast('Pilih minimal 1 sopir dulu'); return; }

  if(fmt==='xlsx'){
    if(!window.XLSX){ toast('Library Excel belum siap'); return; }
    const data = pkExportRowsFiltered(dateList, pkPrintFilter.selected);
    if(data.length===0){ toast('Tidak ada data pada filter ini'); return; }
    const headers = ['Tanggal','No Unit','Sopir','Layanan','Overtime (jam)'];
    const sheetData = [headers, ...data.map(r=>headers.map(h=>r[h]))];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = headers.map(h=>({wch: Math.max(h.length,14)}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Program Kerja');
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const result = await saveOrShareBlob(blob, 'program-kerja-'+pkPrintFilter.mulai+'_'+pkPrintFilter.sampai+'.xlsx');
    toast(result==='shared'?'Excel siap dibagikan':'Excel diunduh');
    closeModal();
    return;
  }

  if(!window.jspdf){ toast('Library PDF belum siap'); return; }
  toast('Menyiapkan PDF…');
  const holidaySet = await pkGetHolidaySetForRange(pkPrintFilter.mulai, pkPrintFilter.sampai);
  const doc = pkBuildPivotPdf(dateList, driverNames, holidaySet);
  const pdfBlob = doc.output('blob');
  const result = await saveOrShareBlob(pdfBlob, 'program-kerja-'+pkPrintFilter.mulai+'_'+pkPrintFilter.sampai+'.pdf');
  toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
  closeModal();
}

