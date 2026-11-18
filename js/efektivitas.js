/* ================= EFEKTIVITAS UNIT (kartu Beranda, v1.0.42) =================
 * Kartu baru di Beranda, di antara kartu Overtime dan Liter/Jam.
 *
 * RUMUS (disepakati dengan Han, 17 Nov 2026):
 *  - Persen harian = HM hari itu / (jam normal + lembur mentah mandor).
 *      Contoh: HM 2 dari 8 jam (7 normal + 1 lembur mandor) = 25%.
 *  - Jam normal: Senin-Kamis 7, Jumat 6,5, Sabtu 5,5.
 *  - Lembur mandor = angka MENTAH dari "Lembur Aktual (Mandor)" (lemburAktualJam),
 *    BUKAN "OT Aktual Final" (x2 - 0,5). Tanggal tanpa data mandor = 0 jam,
 *    dan dihitung jumlahnya supaya ditampilkan sebagai keterangan di modal.
 *  - MINGGU & TANGGAL MERAH (v1.0.43): tidak ada jam pokok (semua jam kerja
 *    = lembur), jadi penyebut = lembur hitungan app (dari Absen, kolom e.lembur,
 *    dijumlah semua entri di tanggal itu - sama seperti kartu Overtime). Data
 *    mandor TIDAK dipakai & TIDAK dituntut di hari ini; konfirmasi mandor
 *    hanya untuk Senin-Sabtu. Kalau lembur app kosong/0 (absen belum diisi)
 *    hari itu dilewati karena penyebutnya 0.
 *  - Hasil periode = RATA-RATA persen harian (bukan total HM / total jam).
 *
 * ATURAN HARI YANG DIHITUNG (data dari ENTRIES = sumber yang sama dengan Rekap):
 *  - Tanggal yang SEMUA entrinya unit Libur/Cuti  -> dilewati.
 *  - Unit Standby                                  -> dihitung, HM 0 (= 0%).
 *  - Tanggal tanpa HM valid & tanpa Standby         -> dilewati
 *    (mis. lupa isi HM, supaya rata-rata tidak turun karena data kosong).
 *  - Minggu/merah dengan lembur app 0 (mis. Standby)  -> dilewati.
 *  - Beberapa entri di 1 tanggal (unit ke-2)       -> HM dijumlahkan, jam kerja
 *    dihitung SEKALI per tanggal (sama seperti kartu Overtime/Total HM).
 *  - Persen tidak dibatasi 100% (HM bisa lebih besar dari jam kerja).
 *  - Tanggal setelah hari ini tidak dihitung.
 *
 * PENYIMPANAN: hanya pilihan periode, di key SQLite 'v2_efektivitas_periode'
 * (lewat LS.get/LS.set) -> otomatis ikut backup & restore. Tidak ada data lama
 * yang diubah; modul ini hanya MEMBACA ENTRIES & LEMBUR_AKTUAL.
 */
const EF_KEY = 'v2_efektivitas_periode';
const EF_HARI_SINGKAT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function efPeriodeDefault(){
  // tahun:'' = "tahun berjalan" (otomatis ikut tahun saat ini, tidak beku di 1 tahun)
  return {mode:'tahun', tahun:'', bulan:todayIso().slice(0,7), dari:'', sampai:''};
}
function efGetPeriode(){
  const d = efPeriodeDefault();
  const p = LS.get(EF_KEY, null);
  if(!p || typeof p !== 'object') return d;
  return Object.assign(d, p);
}
function efSimpanPeriode(p){ LS.set(EF_KEY, p); }

/* Ubah pilihan periode -> {dari, sampai, label, invalid}. */
function efRange(p){
  if(p.mode === 'bulan' && /^\d{4}-\d{2}$/.test(p.bulan||'')){
    return {dari:p.bulan+'-01', sampai:p.bulan+'-31', label:monthLabelId(p.bulan), invalid:false};
  }
  if(p.mode === 'custom'){
    if(p.dari && p.sampai && p.dari <= p.sampai){
      return {dari:p.dari, sampai:p.sampai, label:fmtTanggalRingkas(p.dari)+' - '+fmtTanggalRingkas(p.sampai), invalid:false};
    }
    return {dari:'', sampai:'', label:'Rentang belum diisi', invalid:true};
  }
  const y = /^\d{4}$/.test(p.tahun||'') ? p.tahun : String(new Date().getFullYear());
  return {dari:y+'-01-01', sampai:y+'-12-31', label:'Tahun '+y, invalid:false};
}

function efHmValid(e){
  const a = parseFloat(e.hmAwal), b = parseFloat(e.hmAkhir);
  return (!isNaN(a) && !isNaN(b) && b >= a) ? (b - a) : null;
}

/* Hitung semua hari dalam rentang [dari, sampai]. */
function efHitung(dari, sampai){
  const batas = todayIso();
  const akhir = sampai > batas ? batas : sampai;
  const perTanggal = {};
  ENTRIES.forEach(e=>{
    if(!e || !e.date) return;
    if(e.date < dari || e.date > akhir) return;
    (perTanggal[e.date] = perTanggal[e.date] || []).push(e);
  });
  const hari = [];
  Object.keys(perTanggal).sort().forEach(tgl=>{
    const list = perTanggal[tgl];
    const kerja = list.filter(e=>e.btId !== UNIT_LIBUR_ID && e.btId !== UNIT_CUTI_ID);
    if(kerja.length === 0) return;                       // semua entri Libur/Cuti -> dilewati
    const adaStandby = kerja.some(e=>e.btId === UNIT_STANDBY_ID);
    let hm = 0, adaHm = false;
    kerja.forEach(e=>{
      if(e.btId === UNIT_STANDBY_ID) return;
      const v = efHmValid(e);
      if(v !== null){ hm += v; adaHm = true; }
    });
    if(!adaStandby && !adaHm) return;                    // HM tidak terisi -> dilewati
    const merah = list.some(e=>e.liburMerah);
    const normal = normalJamKerja(tgl, merah);           // 0 untuk Minggu & tanggal merah
    const libur = normal <= 0;
    let dasar, lembur, adaMandor, sumberApp = false;
    if(libur){
      // Minggu/merah: tanpa jam pokok & tanpa data mandor -> pakai lembur hitungan app
      dasar = 0;
      lembur = kerja.reduce((s,e)=>s+(parseFloat(e.lembur)||0), 0);
      adaMandor = true;                                  // tidak dituntut konfirmasi mandor
      sumberApp = true;
    } else {
      dasar = normal;
      const lm = lemburAktualJam(tgl);                   // null kalau belum ada data mandor
      lembur = (lm !== null && lm > 0) ? lm : 0;
      adaMandor = (lm !== null);
    }
    const jam = dasar + lembur;
    if(jam <= 0) return;                                 // penyebut 0 (Minggu/merah tanpa lembur app)
    hari.push({tgl, hm, dasar, lembur, jam, rasio:hm/jam, adaMandor, sumberApp});
  });
  const n = hari.length;
  const rata = n ? hari.reduce((s,d)=>s+d.rasio, 0) / n : null;
  const hariTanpaMandor = hari.filter(d=>!d.adaMandor).length;
  // rincian per bulan (rata-rata persen harian di bulan itu), terbaru di atas
  const bln = {};
  hari.forEach(d=>{ const k = d.tgl.slice(0,7); (bln[k] = bln[k] || []).push(d); });
  const perBulan = Object.keys(bln).sort().reverse().map(k=>({
    key:k, jumlahHari:bln[k].length,
    rata:bln[k].reduce((s,d)=>s+d.rasio, 0) / bln[k].length
  }));
  return {hari, jumlahHari:n, rata, hariTanpaMandor, perBulan};
}

function efFmtPersen(r){ return (r === null || r === undefined || isNaN(r)) ? '-' : (r*100).toFixed(1)+'%'; }

const EF_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;display:inline-block;"><path d="M3.5 18A8.5 8.5 0 0 1 20.5 18"/><path d="M12 18l4-5"/><circle cx="12" cy="18" r="1"/></svg>';

/* Kartu untuk Beranda. Dibungkus try/catch: kalau ada masalah, kartu ini saja
 * yang hilang - Beranda dan fitur lain tetap jalan seperti biasa. */
function efektivitasCardHtml(){
  try{
    const r = efRange(efGetPeriode());
    let nilai = '-', sub = r.label;
    if(!r.invalid){
      const h = efHitung(r.dari, r.sampai);
      if(h.jumlahHari > 0){ nilai = efFmtPersen(h.rata); sub = r.label+' · '+h.jumlahHari+' hari'; }
      else sub = r.label+' · belum ada data';
    }
    return `
        <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;cursor:pointer;" onclick="openEfektivitasModal()">
          <div class="field-sub">Efektivitas Unit</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:var(--primary);opacity:.65;">${EF_ICON}</span><span style="font-size:18px;font-weight:800;">${nilai}</span></div>
          <div style="font-size:10px;color:var(--on-surface-variant);font-weight:600;margin-top:1px;">${escapeHtml(sub)}</div>
        </div>`;
  }catch(err){
    console.error('Kartu Efektivitas Unit gagal:', err);
    return '';
  }
}

/* ---------- Modal: pilih periode + rincian ---------- */
function openEfektivitasModal(){
  closeDrawer();
  renderEfektivitasModal();
}
function efTahunTersedia(){
  const set = new Set([String(new Date().getFullYear())]);
  ENTRIES.forEach(e=>{ if(e && e.date) set.add(e.date.slice(0,4)); });
  return Array.from(set).sort().reverse();
}
function efSetMode(m){
  const p = efGetPeriode(); p.mode = m; efSimpanPeriode(p);
  efSegarkan();
}
function efSetField(k, v){
  const p = efGetPeriode(); p[k] = v; efSimpanPeriode(p);
  efSegarkan();
}
function efSegarkan(){
  renderEfektivitasModal();
  if(typeof renderBeranda === 'function') renderBeranda(); // kartu di belakang ikut berubah
}
function renderEfektivitasModal(){
  const p = efGetPeriode();
  const r = efRange(p);
  const h = r.invalid ? null : efHitung(r.dari, r.sampai);

  const tahunOpts = ['<option value="">Tahun berjalan ('+new Date().getFullYear()+')</option>']
    .concat(efTahunTersedia().map(y=>`<option value="${y}" ${p.tahun===y?'selected':''}>${y}</option>`)).join('');
  const kontrol =
    p.mode === 'bulan'
      ? `<label class="flabel">Bulan</label><input type="month" value="${escapeHtml(p.bulan)}" onchange="efSetField('bulan', this.value)">`
    : p.mode === 'custom'
      ? `<label class="flabel">Dari tanggal</label><input type="date" value="${escapeHtml(p.dari)}" onchange="efSetField('dari', this.value)">
         <label class="flabel" style="margin-top:8px;">Sampai tanggal</label><input type="date" value="${escapeHtml(p.sampai)}" onchange="efSetField('sampai', this.value)">`
      : `<label class="flabel">Tahun</label><select onchange="efSetField('tahun', this.value)">${tahunOpts}</select>`;

  let hasilHtml;
  if(!h){
    hasilHtml = `<div class="card"><div class="empty-note">Isi tanggal Dari dan Sampai dulu (Dari tidak boleh setelah Sampai).</div></div>`;
  } else if(h.jumlahHari === 0){
    hasilHtml = `<div class="card"><div class="empty-note">Belum ada hari yang bisa dihitung di periode ini.</div></div>`;
  } else {
    const ket = h.hariTanpaMandor > 0
      ? `<div class="field-sub" style="margin-top:6px;">${h.hariTanpaMandor} hari Senin&ndash;Sabtu belum ada data lembur mandor (dihitung hanya jam normal).</div>`
      : `<div class="field-sub" style="margin-top:6px;">Semua hari Senin&ndash;Sabtu sudah memakai data lembur mandor.</div>`;
    const bulanHtml = h.perBulan.length > 1 ? `
      <div class="section-eyebrow">Rincian per Bulan</div>
      ${h.perBulan.map(b=>{
        const lebar = Math.max(0, Math.min(100, Math.round(b.rata*100)));
        return `<div style="display:grid;grid-template-columns:104px 1fr 58px;align-items:center;gap:8px;padding:5px 0;">
          <div><div style="font-size:12px;font-weight:700;">${monthLabelId(b.key)}</div><div class="field-sub" style="font-size:10px;">${b.jumlahHari} hari</div></div>
          <div style="background:var(--surface-container);border-radius:4px;height:14px;overflow:hidden;"><div style="background:#4E7FE0;height:100%;width:${lebar}%;"></div></div>
          <div style="font-size:12px;font-weight:800;text-align:right;">${efFmtPersen(b.rata)}</div>
        </div>`;
      }).join('')}` : '';
    const hariHtml = h.jumlahHari <= 35 ? `
      <div class="section-eyebrow">Rincian Harian</div>
      <div style="max-height:34vh;overflow-y:auto;">
      ${h.hari.slice().reverse().map(d=>{
        const dt = new Date(d.tgl+'T00:00:00');
        const lbl = EF_HARI_SINGKAT[dt.getDay()]+' '+dt.getDate()+'/'+(dt.getMonth()+1);
        const jamTxt = d.sumberApp
          ? lmFmt(d.lembur)+' lembur app'
          : d.dasar+(d.lembur>0?' + '+lmFmt(d.lembur):'')+(d.adaMandor?'':' *');
        return `<div style="display:grid;grid-template-columns:70px 1fr 56px;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--outline-variant);">
          <div style="font-size:12px;font-weight:700;">${lbl}</div>
          <div style="font-size:11px;color:var(--on-surface-variant);">HM ${d.hm.toFixed(1)} &divide; (${jamTxt}) j</div>
          <div style="font-size:12px;font-weight:800;text-align:right;">${efFmtPersen(d.rasio)}</div>
        </div>`;
      }).join('')}
      </div>
      ${h.hariTanpaMandor>0?'<div class="field-sub" style="font-size:10px;margin-top:4px;">* belum ada data lembur mandor</div>':''}${h.hari.some(d=>d.sumberApp)?'<div class="field-sub" style="font-size:10px;margin-top:2px;">Minggu/tanggal merah: tanpa jam pokok, memakai lembur hitungan app.</div>':''}` : '';
    hasilHtml = `
      <div class="card" style="text-align:center;">
        <div class="field-sub">Rata-rata efektivitas &middot; ${escapeHtml(r.label)}</div>
        <div style="font-size:34px;font-weight:800;color:var(--primary);margin-top:2px;">${efFmtPersen(h.rata)}</div>
        <div class="field-sub">dari ${h.jumlahHari} hari yang dihitung</div>
        ${ket}
      </div>
      ${bulanHtml}
      ${hariHtml}`;
  }

  openModal(`
    <div class="mhead"><h2>Efektivitas Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="section-eyebrow">Periode</div>
    <div class="chk-row"><input type="radio" name="ef-mode" id="ef-m-tahun" ${p.mode==='tahun'?'checked':''} onchange="efSetMode('tahun')"><label for="ef-m-tahun" style="margin-left:6px;">Per tahun</label></div>
    <div class="chk-row"><input type="radio" name="ef-mode" id="ef-m-bulan" ${p.mode==='bulan'?'checked':''} onchange="efSetMode('bulan')"><label for="ef-m-bulan" style="margin-left:6px;">Per bulan</label></div>
    <div class="chk-row"><input type="radio" name="ef-mode" id="ef-m-custom" ${p.mode==='custom'?'checked':''} onchange="efSetMode('custom')"><label for="ef-m-custom" style="margin-left:6px;">Rentang tanggal</label></div>
    <div style="margin:6px 0 12px;">${kontrol}</div>
    ${hasilHtml}
    <div class="section-eyebrow">Cara Hitung</div>
    <div class="field-sub">Tiap hari: HM &divide; (jam normal + lembur mandor). Jam normal: Sen&ndash;Kam 7, Jum 6,5, Sab 5,5. Lembur mandor memakai angka mentah (sebelum &times;2 &minus; 0,5). Minggu &amp; tanggal merah tidak ada jam pokok: penyebut = lembur hitungan app (dari Absen), tanpa data mandor. Hasil periode = rata-rata persen harian. Hari Libur/Cuti dan hari tanpa HM tidak dihitung; Standby dihitung 0%. Beberapa unit di tanggal yang sama: HM dijumlahkan, jam kerja dihitung sekali.</div>
  `);
}
