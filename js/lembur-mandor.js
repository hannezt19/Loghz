/* ================= LEMBUR AKTUAL (versi mandor) =================
 * Angka lembur yang dibuatkan mandor (mis. 1.00, 2.00, 7.00) disimpan PER TANGGAL
 * di LEMBUR_AKTUAL = {'2026-08-03': 1.5, ...}, terpisah dari catatan harian, jadi
 * tanggal yang tidak tercatat di app pun tetap bisa diisi. Dipakai untuk:
 *  - menyandingkan dengan Lembur (j) hasil hitungan app (selisih),
 *  - kolom "OT Aktual" & "OT Aktual Final" di cetak Riwayat Lengkap (Rekap).
 * OT Aktual Final memakai rumus yang SAMA dengan Lembur Final (x2 - 0,5 di hari kerja
 * biasa, x2 di Minggu/libur) - lihat computeLemburFinal() di masterdata.js.
 * Gambar tabel mandor dibaca otomatis (OCR offline, Tesseract.js) lalu ditampilkan
 * sebagai PREVIEW yang bisa dikoreksi dulu sebelum disimpan. */
let LEMBUR_AKTUAL = {};
let lmBulan = '';       // 'YYYY-MM' yang sedang dilihat
let lmDraft = [];       // hasil baca gambar yang belum disimpan: [{date, jam, koreksi, ganda}]

function saveLemburAktual(){ return LS.set('v2_lembur_aktual', LEMBUR_AKTUAL); }
/* 1 desimal kalau kelipatan 0,1 (seperti kolom Lembur lain), selain itu 2 desimal. */
function lmFmt(x){
  return (Math.abs(x*10 - Math.round(x*10)) < 1e-9) ? x.toFixed(1) : x.toFixed(2);
}
function lemburAktualJam(dateIso){
  const v = LEMBUR_AKTUAL[dateIso];
  if(v===undefined || v===null || v==='' || isNaN(Number(v))) return null;
  return Number(v);
}
function lemburAktualFinal(jam, dateIso, liburMerah){
  if(isNaN(jam) || jam<=0) return 0;
  const normal = normalJamKerja(dateIso, liburMerah);
  const f = normal>0 ? (jam*2 - 0.5) : (jam*2);
  return f<0 ? 0 : f;
}
/* Lembur (j) hasil hitungan app untuk 1 tanggal (jumlah entri utama hari itu); null kalau tidak ada catatan. */
function lmAppLembur(dateIso){
  const list = ENTRIES.filter(e=>e.date===dateIso && !e.isSecondary && !isSystemUnitId(e.btId));
  if(list.length===0) return null;
  return list.reduce((s,e)=>s+(parseFloat(e.lembur)||0),0);
}
function lmNamaBulan(ym){
  const b = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return b[parseInt(ym.slice(5,7),10)-1]+' '+ym.slice(0,4);
}
function lmGeserBulan(ym, delta){
  let y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10)+delta;
  while(m<1){ m+=12; y--; }
  while(m>12){ m-=12; y++; }
  return y+'-'+String(m).padStart(2,'0');
}
function lmHariLabel(dateIso){
  const d = new Date(dateIso+'T00:00:00');
  return ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]+' '+d.getDate();
}
function lmParseJam(str){
  const t = String(str==null?'':str).trim().replace(',','.');
  if(t==='') return {kosong:true};
  if(!/^\d+(\.\d+)?$/.test(t)) return {salah:true};
  const v = parseFloat(t);
  if(v>24) return {salah:true};
  return {nilai:v};
}
function lmSelisihHtml(jam, app){
  if(jam===null || jam===undefined) return '<span style="color:var(--on-surface-variant);">-</span>';
  const sel = jam - (app===null ? 0 : app);
  if(Math.abs(sel) < 0.05) return '<span style="color:#2E7D32;">&#10003;</span>';
  const teks = (sel>0?'+':'')+lmFmt(sel);
  return '<span style="color:#B26A00;">'+teks+'</span>';
}

/* ---------- Membaca teks hasil OCR menjadi {tanggal, jam} ----------
 * Baris yang dicari: tanggal (bulan/hari/tahun, seperti di tabel mandor; atau
 * hari/bulan/tahun kalau angka pertama > 12; atau tahun-bulan-hari) diikuti angka
 * jam lembur. Jam mulai/selesai di baris yang sama diabaikan. OCR kadang
 * menghilangkan titik desimal (7.00 -> 700): angka bulat >= 100 dibagi 100 dan
 * ditandai "koreksi" supaya diperiksa di preview. */
function lmParseTeks(teks){
  const hasil = [];
  let barisDiabaikan = 0;
  String(teks||'').split(/\r?\n/).forEach(line=>{
    const m = line.match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
    if(!m) return;
    let y, mo, d;
    if(m[1].length===4){ y=+m[1]; mo=+m[2]; d=+m[3]; }
    else if(m[3].length===4){
      y=+m[3];
      const a=+m[1], b=+m[2];
      if(a>12){ d=a; mo=b; } else { mo=a; d=b; }
    } else { barisDiabaikan++; return; }
    const tgl = new Date(y, mo-1, d);
    if(isNaN(tgl) || tgl.getFullYear()!==y || tgl.getMonth()!==mo-1 || tgl.getDate()!==d || y<2020 || y>2100){ barisDiabaikan++; return; }
    const date = y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const sisa = line.slice(m.index+m[0].length);
    const h = sisa.match(/(\d+(?:[.,]\d+)?)/);
    if(!h){ barisDiabaikan++; return; }
    const mentah = h[1];
    let jam = parseFloat(mentah.replace(',','.'));
    let koreksi = false;
    if(/^\d+$/.test(mentah) && jam>=100){ jam = jam/100; koreksi = true; }
    hasil.push({date, jam:String(jam), koreksi});
  });
  // tanggal ganda: pakai yang terakhir terbaca, tandai
  const peta = {};
  hasil.forEach(r=>{ if(peta[r.date]){ r.ganda = true; } peta[r.date] = r; });
  const unik = Object.values(peta).sort((a,b)=>a.date.localeCompare(b.date));
  return {baris: unik, barisDiabaikan};
}

/* ---------- OCR (Tesseract.js, semua berkas ada di dalam app, tanpa internet) ---------- */
function lmUrlAbs(rel){ return new URL(rel, document.baseURI).href; }
function lmMuatTesseract(){
  return new Promise((resolve, reject)=>{
    if(window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = 'vendor/tesseract/tesseract.min.js';
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('Pustaka pembaca gambar (OCR) belum terpasang di versi app ini'));
    document.head.appendChild(s);
  });
}
/* Perkecil gambar yang terlalu besar (screenshot HP) supaya proses baca tidak lama. */
async function lmSiapkanGambar(file){
  try{
    const bmp = await createImageBitmap(file);
    const maxW = 1800;
    if(bmp.width<=maxW){ if(bmp.close) bmp.close(); return file; }
    const skala = maxW/bmp.width;
    const c = document.createElement('canvas');
    c.width = maxW; c.height = Math.round(bmp.height*skala);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if(bmp.close) bmp.close();
    return await new Promise(res=>c.toBlob(b=>res(b||file), 'image/png'));
  }catch(e){ return file; }
}
async function lmJalankanOcr(gambar, onProgress){
  await lmMuatTesseract();
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: lmUrlAbs('vendor/tesseract/worker.min.js'),
    corePath: lmUrlAbs('vendor/tesseract/tesseract-core-lstm.wasm.js'),
    langPath: lmUrlAbs('vendor/tesseract/lang'),
    // Data bahasa dikirim TIDAK terkompresi (eng.traineddata, tanpa .gz): alat pengemas Android
    // (AAPT) membuang akhiran .gz dari nama berkas aset, sehingga eng.traineddata.gz tidak
    // ditemukan (404) di dalam APK.
    gzip: false,
    cacheMethod: 'none',
    logger: m=>{ if(m && m.status==='recognizing text' && onProgress) onProgress(Math.round((m.progress||0)*100)); }
  });
  try{
    const { data } = await worker.recognize(gambar);
    return data.text;
  } finally {
    try{ await worker.terminate(); }catch(e){}
  }
}

/* ---------- Layar per bulan (lihat & edit data tersimpan) ---------- */
function openLemburAktual(){
  if(typeof closeDrawer==='function') closeDrawer();
  if(!lmBulan) lmBulan = todayIso().slice(0,7);
  renderLemburAktual();
}
function lmHariDalamBulan(ym){
  const y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10);
  const n = new Date(y, m, 0).getDate();
  const out = [];
  for(let d=1; d<=n; d++) out.push(ym+'-'+String(d).padStart(2,'0'));
  return out;
}
function lmRingkasanBulan(ym){
  let totalAktual=0, totalApp=0, terisi=0, beda=0;
  lmHariDalamBulan(ym).forEach(date=>{
    const j = lemburAktualJam(date);
    if(j===null) return;
    const app = lmAppLembur(date);
    terisi++;
    totalAktual += j;
    totalApp += (app===null?0:app);
    if(Math.abs(j-(app===null?0:app)) >= 0.05) beda++;
  });
  return {totalAktual, totalApp, terisi, beda, selisih: totalAktual-totalApp};
}
function lmRingkasanHtml(r){
  const warna = Math.abs(r.selisih)<0.05 ? '#2E7D32' : '#B26A00';
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div class="field-sub" style="margin:0;">Total OT Aktual</div><div style="font-weight:800;font-size:18px;">${lmFmt(r.totalAktual)} j</div></div>
      <div><div class="field-sub" style="margin:0;">Total Lembur app (hari yang sama)</div><div style="font-weight:800;font-size:18px;">${lmFmt(r.totalApp)} j</div></div>
      <div><div class="field-sub" style="margin:0;">Selisih (Aktual &minus; App)</div><div style="font-weight:800;font-size:18px;color:${warna};">${(r.selisih>0.049?'+':'')+lmFmt(r.selisih)} j</div></div>
      <div><div class="field-sub" style="margin:0;">Hari terisi / berbeda</div><div style="font-weight:800;font-size:18px;">${r.terisi} / ${r.beda}</div></div>
    </div>`;
}
function renderLemburAktual(){
  const hari = lmHariDalamBulan(lmBulan);
  const baris = hari.map(date=>{
    const j = lemburAktualJam(date);
    const app = lmAppLembur(date);
    const minggu = new Date(date+'T00:00:00').getDay()===0;
    return `
      <div style="display:grid;grid-template-columns:64px 1fr 92px 64px;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--outline-variant);${minggu?'background:#EEF7EE;':''}">
        <div style="font-weight:700;font-size:13px;">${lmHariLabel(date)}</div>
        <div style="text-align:right;" id="lm-app-${date}">${app===null?'<span style="color:var(--on-surface-variant);">-</span>':lmFmt(app)}</div>
        <input type="text" inputmode="decimal" id="lm-in-${date}" value="${j===null?'':escapeHtml(lmFmt(j))}" style="margin-bottom:0;min-height:38px;padding:6px 8px;text-align:right;" onchange="lmSimpanHari('${date}', this.value)">
        <div style="text-align:right;font-weight:700;" id="lm-sel-${date}">${lmSelisihHtml(j, app)}</div>
      </div>`;
  }).join('');
  openModal(`
    <div class="mhead"><h2>Lembur Aktual (Mandor)</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <button class="icon-btn" onclick="lmGantiBulan(-1)" title="Bulan sebelumnya">&#9664;</button>
      <div style="font-weight:800;">${lmNamaBulan(lmBulan)}</div>
      <button class="icon-btn" onclick="lmGantiBulan(1)" title="Bulan berikutnya">&#9654;</button>
    </div>
    <div class="card card-flat" id="lm-ringkasan">${lmRingkasanHtml(lmRingkasanBulan(lmBulan))}</div>
    <input type="file" accept="image/*" id="lmFile" style="display:none;" onchange="lmPilihGambar(event)">
    <button class="btn-block" onclick="document.getElementById('lmFile').click()">Upload Gambar (baca otomatis)</button>
    <div class="field-sub" style="margin:10px 0 6px;">Angka bisa diketik/diperbaiki langsung di kolom Aktual (tersimpan otomatis). Kosongkan kolom untuk menghapus. Selisih = Aktual &minus; Lembur app.</div>
    <div style="display:grid;grid-template-columns:64px 1fr 92px 64px;gap:6px;font-size:12px;font-weight:700;color:var(--on-surface-variant);padding:4px 0;">
      <div>Tanggal</div><div style="text-align:right;">App (j)</div><div style="text-align:right;">Aktual (j)</div><div style="text-align:right;">Selisih</div>
    </div>
    ${baris}
  `);
}
function lmGantiBulan(delta){
  lmBulan = lmGeserBulan(lmBulan, delta);
  renderLemburAktual();
}
function lmSimpanHari(date, nilai){
  const p = lmParseJam(nilai);
  const el = document.getElementById('lm-in-'+date);
  if(p.salah){
    toast('Angka tidak valid (0 - 24, pakai titik/koma)');
    const j0 = lemburAktualJam(date);
    if(el) el.value = j0===null ? '' : lmFmt(j0);
    return;
  }
  if(p.kosong) delete LEMBUR_AKTUAL[date];
  else LEMBUR_AKTUAL[date] = p.nilai;
  saveLemburAktual();
  const j = lemburAktualJam(date);
  if(el) el.value = j===null ? '' : lmFmt(j);
  const sel = document.getElementById('lm-sel-'+date);
  if(sel) sel.innerHTML = lmSelisihHtml(j, lmAppLembur(date));
  const ring = document.getElementById('lm-ringkasan');
  if(ring) ring.innerHTML = lmRingkasanHtml(lmRingkasanBulan(lmBulan));
  toast('Tersimpan');
}

/* ---------- Upload gambar -> baca -> preview ---------- */
async function lmPilihGambar(ev){
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!file) return;
  openModal(`
    <div class="mhead"><h2>Membaca Gambar...</h2></div>
    <div class="field-sub" id="lm-progres" style="margin:14px 0;">Menyiapkan pembaca gambar (pertama kali bisa beberapa detik)...</div>
  `);
  try{
    const gambar = await lmSiapkanGambar(file);
    const teks = await lmJalankanOcr(gambar, pct=>{
      const el = document.getElementById('lm-progres');
      if(el) el.textContent = 'Membaca tulisan di gambar... '+pct+'%';
    });
    const hasil = lmParseTeks(teks);
    if(hasil.baris.length===0){
      openModal(`
        <div class="mhead"><h2>Tidak Ada Data Terbaca</h2><button class="mclose" onclick="renderLemburAktual()">&times;</button></div>
        <div class="field-sub" style="margin:10px 0;">Tidak ada baris dengan tanggal dan angka lembur yang bisa dibaca. Pastikan gambar tajam dan tabelnya terlihat penuh (tanggal di kolom kiri, angka lembur di sebelahnya), lalu coba lagi. Atau isi manual di layar bulanan.</div>
        <button class="btn-block" onclick="renderLemburAktual()">Kembali</button>
      `);
      return;
    }
    lmDraft = hasil.baris;
    lmDraftDiabaikan = hasil.barisDiabaikan;
    renderLmPreview();
  }catch(err){
    console.error('OCR gagal:', err);
    openModal(`
      <div class="mhead"><h2>Gagal Membaca Gambar</h2><button class="mclose" onclick="renderLemburAktual()">&times;</button></div>
      <div class="field-sub" style="margin:10px 0;color:#B3261E;">${escapeHtml(err && err.message ? err.message : String(err))}</div>
      <div class="field-sub" style="margin:10px 0;">Anda tetap bisa mengisi manual di layar bulanan.</div>
      <button class="btn-block" onclick="renderLemburAktual()">Kembali</button>
    `);
  }
}
let lmDraftDiabaikan = 0;
function lmDraftCatatan(r){
  const cat = [];
  if(r.koreksi) cat.push('titik desimal dikoreksi, cek');
  if(r.ganda) cat.push('tanggal terbaca ganda');
  const p = lmParseJam(r.jam);
  if(p.salah || p.kosong) cat.push('angka tidak valid, tidak disimpan');
  const lama = lemburAktualJam(r.date);
  if(lama!==null && p.nilai!==undefined && Math.abs(lama-p.nilai)>=0.05) cat.push('menimpa tersimpan '+lmFmt(lama));
  if(lmAppLembur(r.date)===null) cat.push('tidak ada catatan app');
  if(p.nilai!==undefined && (Math.round(p.nilai*2)/2)!==p.nilai) cat.push('bukan kelipatan 0,5');
  return cat;
}
function lmDraftRingkasanHtml(){
  let valid=0, cocok=0, perlu=0;
  lmDraft.forEach(r=>{
    const p = lmParseJam(r.jam);
    if(p.nilai===undefined) { perlu++; return; }
    valid++;
    const app = lmAppLembur(r.date);
    if(Math.abs(p.nilai-(app===null?0:app))<0.05) cocok++;
    if(lmDraftCatatan(r).length>0) perlu++;
  });
  return `<b>${lmDraft.length}</b> tanggal terbaca &middot; <b style="color:#2E7D32;">${cocok}</b> cocok dengan app &middot; <b style="color:#B26A00;">${valid-cocok}</b> berbeda &middot; <b>${perlu}</b> perlu dicek${lmDraftDiabaikan>0?' &middot; '+lmDraftDiabaikan+' baris dilewati':''}`;
}
function renderLmPreview(){
  const baris = lmDraft.map((r,i)=>{
    const app = lmAppLembur(r.date);
    const p = lmParseJam(r.jam);
    const cat = lmDraftCatatan(r);
    return `
      <div id="lm-pv-${i}" style="padding:4px 0;border-bottom:1px solid var(--outline-variant);${cat.length?'background:#FFF8E6;':''}">
        <div style="display:grid;grid-template-columns:64px 1fr 92px 54px 28px;gap:6px;align-items:center;">
          <div style="font-weight:700;font-size:13px;">${lmHariLabel(r.date)}</div>
          <div style="text-align:right;">${app===null?'<span style="color:var(--on-surface-variant);">-</span>':lmFmt(app)}</div>
          <input type="text" inputmode="decimal" value="${escapeHtml(p.nilai!==undefined?lmFmt(p.nilai):r.jam)}" style="margin-bottom:0;min-height:38px;padding:6px 8px;text-align:right;" onchange="lmDraftUbah(${i}, this.value)">
          <div style="text-align:right;font-weight:700;" id="lm-pv-sel-${i}">${lmSelisihHtml(p.nilai===undefined?null:p.nilai, app)}</div>
          <button class="icon-btn" style="padding:2px;" title="Buang baris ini" onclick="lmDraftBuang(${i})">&times;</button>
        </div>
        <div class="field-sub" style="margin:2px 0 0;color:#B26A00;font-size:11px;" id="lm-pv-cat-${i}">${cat.length?escapeHtml(cat.join(' · ')):''}</div>
      </div>`;
  }).join('');
  openModal(`
    <div class="mhead"><h2>Periksa Hasil Baca</h2><button class="mclose" onclick="renderLemburAktual()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:8px;">Cocokkan dengan gambar. Angka bisa diperbaiki langsung di kolom Aktual, baris yang salah bisa dibuang (&times;). Belum tersimpan sebelum Anda tekan Simpan.</div>
    <div class="card card-flat" id="lm-pv-ringkas" style="font-size:13px;">${lmDraftRingkasanHtml()}</div>
    <div style="display:grid;grid-template-columns:64px 1fr 92px 54px 28px;gap:6px;font-size:12px;font-weight:700;color:var(--on-surface-variant);padding:4px 0;">
      <div>Tanggal</div><div style="text-align:right;">App (j)</div><div style="text-align:right;">Aktual (j)</div><div style="text-align:right;">Selisih</div><div></div>
    </div>
    ${baris}
    <button class="btn-block" style="margin-top:14px;" onclick="lmDraftSimpan()">Simpan</button>
    <button class="btn-block outline" style="margin-top:10px;" onclick="renderLemburAktual()">Batal</button>
  `);
}
function lmDraftUbah(i, nilai){
  const r = lmDraft[i];
  if(!r) return;
  r.jam = String(nilai).trim();
  r.koreksi = false; // sudah diperiksa/diubah user
  const p = lmParseJam(r.jam);
  const app = lmAppLembur(r.date);
  const cat = lmDraftCatatan(r);
  const sel = document.getElementById('lm-pv-sel-'+i);
  if(sel) sel.innerHTML = lmSelisihHtml(p.nilai===undefined?null:p.nilai, app);
  const c = document.getElementById('lm-pv-cat-'+i);
  if(c) c.textContent = cat.join(' · ');
  const row = document.getElementById('lm-pv-'+i);
  if(row) row.style.background = cat.length ? '#FFF8E6' : '';
  const ring = document.getElementById('lm-pv-ringkas');
  if(ring) ring.innerHTML = lmDraftRingkasanHtml();
}
function lmDraftBuang(i){
  lmDraft.splice(i,1);
  if(lmDraft.length===0){ renderLemburAktual(); return; }
  renderLmPreview();
}
function lmDraftSimpan(){
  let n = 0;
  lmDraft.forEach(r=>{
    const p = lmParseJam(r.jam);
    if(p.nilai===undefined) return;
    LEMBUR_AKTUAL[r.date] = p.nilai;
    n++;
  });
  if(n===0){ toast('Tidak ada angka valid untuk disimpan'); return; }
  saveLemburAktual();
  // tampilkan bulan yang paling banyak terisi dari hasil baca
  const hitung = {};
  lmDraft.forEach(r=>{ const ym = r.date.slice(0,7); hitung[ym] = (hitung[ym]||0)+1; });
  lmBulan = Object.keys(hitung).sort((a,b)=>hitung[b]-hitung[a])[0] || lmBulan;
  lmDraft = [];
  renderLemburAktual();
  toast(n+' tanggal disimpan');
}
