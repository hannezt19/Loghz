/* ================= CATATAN MANDOR (halaman privat, akses tersembunyi) =================
 * Diakses lewat tekan-tahan (long-press) ±2 detik pada judul modal
 * "Export / Cetak Laporan" (lihat wireLongPressExportTitle() di bawah, dipasang
 * ulang setiap openExportSheet() dipanggil dari js/peta.js). Sengaja TIDAK ada
 * tombol/ikon apa pun yang terlihat di layar untuk fitur ini, dan tidak ada
 * animasi/getar saat ditekan - supaya orang lain yang pegang HP tidak
 * penasaran ada apa di situ.
 *
 * Data disimpan di key SQLite 'v2_catatan_mandor' lewat LS.get/LS.set - pola
 * yang sama seperti semua data lain di app ini - sehingga OTOMATIS ikut ke
 * sistem backup/restore yang sudah ada (LS.getAll/setAll bersifat generik,
 * baca semua key), tanpa perlu registrasi tambahan apa pun.
 *
 * 2 jenis entri:
 *  - 'catatan' : lengkap (jam datang, jam pergi dari/sampai, teks, foto opsional)
 *  - 'briefing': ringkas (tanggal + teks saja) - buat poin briefing yang diulang-ulang
 *
 * Foto TIDAK PERNAH disimpan sebagai file terpisah di penyimpanan HP - selalu
 * dikompres lebih dulu lalu diubah jadi base64 (data URL) dan disimpan DI
 * DALAM baris data ini sendiri (field `fotos`), persis seperti field teks
 * lain. Jadi tidak akan pernah muncul di Galeri atau bisa dibuka lewat File
 * Manager - yang ada di penyimpanan HP cuma satu file database app ini.
 */
let CATATAN_MANDOR = LS.get('v2_catatan_mandor', []); // [{id, tipe:'catatan'|'briefing', tanggal, jamDatang, jamPergiDari, jamPergiSampai, teks, fotos:[dataUrl,...], dicatatPada}]
function saveCatatanMandor(){ LS.set('v2_catatan_mandor', CATATAN_MANDOR); }

/* ----- Trigger tersembunyi ----- */
let _cmLongPressTimer = null;
function wireLongPressExportTitle(){
  const el = document.getElementById('exportSheetTitle');
  if(!el) return;
  const start = ()=>{ _cmLongPressTimer = setTimeout(()=>{ _cmLongPressTimer=null; openCatatanMandorList(); }, 2000); };
  const cancel = ()=>{ if(_cmLongPressTimer){ clearTimeout(_cmLongPressTimer); _cmLongPressTimer=null; } };
  el.addEventListener('touchstart', start, {passive:true});
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

/* ----- Kompresi foto: selalu diperkecil sebelum disimpan sebagai base64,
 * supaya database app tidak membengkak. maxDim 1280px, kualitas JPEG 0.6 -
 * cukup jelas untuk bukti, jauh lebih ringan dari foto kamera asli. ----- */
function compressImageFile(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w>maxDim || h>maxDim){
          if(w>h){ h = Math.round(h*maxDim/w); w = maxDim; } else { w = Math.round(w*maxDim/h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=>reject(new Error('Gagal memuat gambar'));
      img.src = reader.result;
    };
    reader.onerror = ()=>reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}
function fmtCmTimestamp(iso){
  if(!iso) return '-';
  const d = new Date(iso);
  const pad = n=>String(n).padStart(2,'0');
  const localIso = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  return fmtLabel(localIso)+' - '+pad(d.getHours())+':'+pad(d.getMinutes());
}

/* ----- Halaman daftar ----- */
function openCatatanMandorList(){ renderCatatanMandorList(); }
function renderCatatanMandorList(){
  const sorted = CATATAN_MANDOR.slice().sort((a,b)=> (b.tanggal+b.dicatatPada).localeCompare(a.tanggal+a.dicatatPada));
  openModal(`
    <div class="mhead"><h2>Catatan Mandor</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button class="btn-block" style="flex:1;" onclick="openCatatanMandorForm(null,'catatan')">${ic('plus')} Catatan</button>
      <button class="pill-btn outline" style="flex:1;justify-content:center;" onclick="openCatatanMandorForm(null,'briefing')">${ic('clipboard')} Briefing</button>
    </div>
    ${sorted.length>0 ? `<button class="pill-btn sm outline" style="width:100%;justify-content:center;margin-bottom:14px;" onclick="doCmExport()">${ic('document')} Export PDF</button>` : ''}
    ${sorted.length===0 ? '<div class="card"><div class="empty-note">Belum ada catatan.</div></div>' :
      sorted.map(c=>renderCatatanMandorCard(c)).join('')}
  `);
}
function renderCatatanMandorCard(c){
  const jamText = c.tipe==='catatan' ? [
    c.jamDatang ? 'Datang '+c.jamDatang : '',
    c.jamPergiDari ? 'Pergi '+c.jamPergiDari+(c.jamPergiSampai?'\u2013'+c.jamPergiSampai:'') : ''
  ].filter(Boolean).join(' &middot; ') : '';
  return `
    <div class="card card-flat" style="margin-bottom:10px;cursor:pointer;" onclick="openCatatanMandorForm('${c.id}', null)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="min-width:0;">
          ${c.tipe==='briefing' ? '<span style="display:inline-block;color:var(--secondary);font-weight:700;font-size:10px;border:1px solid var(--secondary);border-radius:100px;padding:1px 7px;margin-bottom:3px;">Briefing</span><br>' : ''}
          <span style="font-weight:800;">${fmtLabel(c.tanggal)}</span>
          ${jamText ? `<div class="field-sub">${jamText}</div>` : ''}
        </div>
        <div style="flex-shrink:0;">${ic('edit')}</div>
      </div>
      ${c.teks ? `<div class="field-sub" style="margin-top:6px;white-space:normal;">${escapeHtml(c.teks)}</div>` : ''}
      ${(c.fotos && c.fotos.length) ? `<div class="field-sub" style="margin-top:6px;">${ic('camera')} ${c.fotos.length} foto terlampir</div>` : ''}
    </div>`;
}

/* ----- Form tambah/edit (edit dilakukan di atas SALINAN dulu di _cmDraft,
 * baru benar-benar ditulis ke CATATAN_MANDOR + disimpan saat tombol "Simpan"
 * ditekan - supaya draft yang belum jadi tidak ikut mengotori data). ----- */
let _cmDraft = null;
let _cmDraftIsNew = false;
function openCatatanMandorForm(id, tipeBaru){
  _cmDraft = null;
  if(id){
    const existing = CATATAN_MANDOR.find(x=>x.id===id);
    if(existing){ _cmDraft = JSON.parse(JSON.stringify(existing)); _cmDraftIsNew = false; }
  }
  if(!_cmDraft){
    _cmDraft = {id:uid(), tipe:tipeBaru||'catatan', tanggal:todayIso(), jamDatang:'', jamPergiDari:'', jamPergiSampai:'', teks:'', fotos:[], dicatatPada:''};
    _cmDraftIsNew = true;
  }
  renderCatatanMandorForm();
}
function updateCmDraftField(field, val){ _cmDraft[field] = val; }
function cmAddFotoClicked(){ const el = document.getElementById('cmFotoInput'); if(el) el.click(); }
async function handleCmFotoSelected(evt){
  const file = evt.target.files && evt.target.files[0];
  evt.target.value = '';
  if(!file) return;
  toast('Memproses foto...');
  try{
    const dataUrl = await compressImageFile(file, 1280, 0.6);
    _cmDraft.fotos = _cmDraft.fotos || [];
    _cmDraft.fotos.push(dataUrl);
    renderCatatanMandorForm();
  }catch(err){
    toast('Gagal memproses foto');
  }
}
function cmRemoveFoto(idx){ _cmDraft.fotos.splice(idx,1); renderCatatanMandorForm(); }
function saveCmDraft(){
  if(_cmDraft.tipe==='briefing' && !_cmDraft.teks.trim()){ toast('Isi dulu poin briefingnya'); return; }
  if(_cmDraft.tipe==='catatan' && !_cmDraft.jamDatang && !_cmDraft.jamPergiDari && !_cmDraft.teks.trim()){ toast('Isi minimal salah satu jam atau catatan kejadian'); return; }
  if(!_cmDraft.dicatatPada) _cmDraft.dicatatPada = new Date().toISOString(); // cuma diisi SEKALI, saat pertama kali disimpan - tidak ikut berubah kalau nanti diedit lagi
  const idx = CATATAN_MANDOR.findIndex(x=>x.id===_cmDraft.id);
  if(idx>=0) CATATAN_MANDOR[idx] = _cmDraft; else CATATAN_MANDOR.push(_cmDraft);
  saveCatatanMandor();
  toast('Tersimpan');
  openCatatanMandorList();
}
function renderCatatanMandorForm(){
  const c = _cmDraft;
  const isBriefing = c.tipe==='briefing';
  openModal(`
    <div class="mhead"><h2>${isBriefing?'Briefing':(_cmDraftIsNew?'Catatan Baru':'Edit Catatan')}</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <label class="flabel">Tanggal</label>
    <input type="date" value="${c.tanggal}" onchange="updateCmDraftField('tanggal',this.value)">

    ${!isBriefing ? `
    <label class="flabel">Jam Datang</label>
    <input type="time" value="${c.jamDatang||''}" onchange="updateCmDraftField('jamDatang',this.value)">

    <div style="border-top:1px solid var(--outline-variant);margin-top:10px;padding-top:10px;">
      <label class="flabel">Jam Pergi</label>
      <div class="grid2">
        <div><label class="flabel" style="font-weight:400;">Dari</label><input type="time" value="${c.jamPergiDari||''}" onchange="updateCmDraftField('jamPergiDari',this.value)"></div>
        <div><label class="flabel" style="font-weight:400;">Sampai <span style="color:var(--on-surface-variant);">(opsional)</span></label><input type="time" value="${c.jamPergiSampai||''}" onchange="updateCmDraftField('jamPergiSampai',this.value)"></div>
      </div>
      <div class="field-sub">Isi "Sampai" cuma kalau dia sempat kembali. Kalau pergi dan tidak balik lagi hari itu, biarkan kosong.</div>
    </div>
    ` : ''}

    <label class="flabel" style="margin-top:10px;">${isBriefing?'Isi briefing':'Catatan kejadian'}</label>
    <textarea rows="${isBriefing?2:3}" onchange="updateCmDraftField('teks',this.value)">${escapeHtml(c.teks||'')}</textarea>
    ${isBriefing ? '<div class="field-sub">Tanpa jam &amp; foto - cukup buat catat poin berulang secara ringkas.</div>' : ''}

    ${!isBriefing ? `
    <label class="flabel" style="margin-top:10px;">Foto <span style="font-weight:400;color:var(--on-surface-variant);">(opsional, boleh lebih dari 1)</span></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
      ${(c.fotos||[]).map((f,i)=>`
        <div style="width:56px;height:56px;border-radius:12px;overflow:hidden;position:relative;">
          <img src="${f}" style="width:100%;height:100%;object-fit:cover;display:block;">
          <button type="button" class="icon-btn" style="position:absolute;top:-4px;right:-4px;background:var(--surface-container);width:20px;height:20px;padding:0;border-radius:50%;font-size:12px;line-height:1;" onclick="cmRemoveFoto(${i})" aria-label="Hapus foto">&times;</button>
        </div>`).join('')}
      <div style="width:56px;height:56px;border-radius:12px;border:1px dashed var(--outline);display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="cmAddFotoClicked()">${ic('plus')}</div>
    </div>
    <input type="file" accept="image/*" id="cmFotoInput" style="display:none;" onchange="handleCmFotoSelected(event)">
    ` : ''}

    ${c.dicatatPada ? `<div class="field-sub" style="margin-top:10px;">Dicatat pada ${fmtCmTimestamp(c.dicatatPada)} (otomatis, tidak bisa diubah)</div>` : ''}

    <button class="btn-block" style="width:100%;margin-top:14px;" onclick="saveCmDraft()">Simpan</button>
    ${!_cmDraftIsNew ? `<button class="icon-btn" style="width:100%;justify-content:center;color:var(--secondary);margin-top:10px;" onclick="openCmDeleteConfirm()">${ic('trash')} Hapus Catatan Ini</button>` : ''}
  `);
}

/* ----- Hapus (dialog konfirmasi kustom, bukan confirm() bawaan - permanen,
 * tidak ada arsip/recycle bin). ----- */
function openCmDeleteConfirm(){
  if(!_cmDraft || _cmDraftIsNew) return;
  const fotoCount = (_cmDraft.fotos||[]).length;
  openModal(`
    <div class="mhead"><h2>Hapus Catatan Ini?</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:16px;">Tindakan ini permanen dan tidak bisa dibatalkan.${fotoCount?' '+fotoCount+' foto yang terlampir ikut terhapus.':''}</div>
    <button class="icon-btn" style="width:100%;justify-content:center;color:var(--secondary);border:1px solid var(--secondary);" onclick="confirmDeleteCmDraft()">${ic('trash')} Hapus Permanen</button>
  `);
}
function confirmDeleteCmDraft(){
  CATATAN_MANDOR = CATATAN_MANDOR.filter(x=>x.id!==_cmDraft.id);
  saveCatatanMandor();
  toast('Catatan dihapus');
  openCatatanMandorList();
}

/* ----- Export PDF khusus log ini (kronologis + foto). ----- */
async function doCmExport(){
  if(!window.jspdf){ toast('Library PDF belum siap'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'portrait'});
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 12;
  let y = 16;
  doc.setFontSize(14); doc.setFont(undefined,'bold');
  doc.text('Catatan Mandor', marginX, y); y += 6;
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  doc.text('Dicetak '+fmtCmTimestamp(new Date().toISOString()), marginX, y); y += 9;

  const sorted = CATATAN_MANDOR.slice().sort((a,b)=> (a.tanggal+a.dicatatPada).localeCompare(b.tanggal+b.dicatatPada));
  sorted.forEach(c=>{
    const jamText = c.tipe==='catatan' ? [
      c.jamDatang?'Datang '+c.jamDatang:'',
      c.jamPergiDari?'Pergi '+c.jamPergiDari+(c.jamPergiSampai?'-'+c.jamPergiSampai:''):''
    ].filter(Boolean).join('   ') : '';
    const teksLines = doc.splitTextToSize(c.teks||'-', pageW-marginX*2);
    const blockH = 6 + (jamText?5:0) + teksLines.length*4.2 + 6;
    if(y + blockH > pageH-14){ doc.addPage(); y = 16; }
    doc.setFontSize(10); doc.setFont(undefined,'bold');
    doc.text((c.tipe==='briefing'?'[Briefing] ':'')+fmtLabel(c.tanggal), marginX, y); y += 5;
    doc.setFont(undefined,'normal'); doc.setFontSize(9);
    if(jamText){ doc.text(jamText, marginX, y); y += 5; }
    doc.text(teksLines, marginX, y); y += teksLines.length*4.2 + 2;
    (c.fotos||[]).forEach(f=>{
      const imgW = 60, imgH = 45;
      if(y + imgH > pageH-14){ doc.addPage(); y = 16; }
      try{ doc.addImage(f, 'JPEG', marginX, y, imgW, imgH); }catch(e){}
      y += imgH + 4;
    });
    y += 3;
    doc.setDrawColor(220);
    doc.line(marginX, y, pageW-marginX, y);
    y += 6;
  });

  const pdfBlob = doc.output('blob');
  const result = await saveOrShareBlob(pdfBlob, 'catatan-mandor-'+todayIso()+'.pdf');
  toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
}
