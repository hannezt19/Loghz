/* ================= PETA ================= */
/* Gambar peta disimpan di IndexedDB (jatah jauh lebih besar dari localStorage, cocok untuk gambar beresolusi tinggi) */
const PETA_DB_NAME = 'jadwalbt_peta_db';
const PETA_STORE = 'images';
function petaDbOpen(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(PETA_DB_NAME, 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore(PETA_STORE); };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function petaDbGet(key){
  const db = await petaDbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(PETA_STORE, 'readonly');
    const req = tx.objectStore(PETA_STORE).get(key);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}
async function petaDbSet(key, val){
  const db = await petaDbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(PETA_STORE, 'readwrite');
    tx.objectStore(PETA_STORE).put(val, key);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}
let PETA_IMAGE = null;
let petaImageLoaded = false;
async function loadPetaImage(){
  try{ PETA_IMAGE = await petaDbGet('main'); }
  catch(e){ PETA_IMAGE = null; }
  petaImageLoaded = true;
  const activeBtn = document.querySelector('#bottomnav button.active');
  if(activeBtn && activeBtn.dataset.tab==='peta') renderPeta();
}
loadPetaImage();
let PETA_BLOCKS = LS.get('v2_peta_blocks', []);  // [{id, label, points:[{x,y},...], date}]
function savePetaBlocks(){ LS.set('v2_peta_blocks', PETA_BLOCKS); }
let petaDrawing = false;
let petaDrawPoints = [];
/* ----- Cari Nama di Peta: highlight poligon merah + akses ke Cetak Riwayat
 * per Nama. Kolom pencarian ini TERPISAH TOTAL dari kolom Nama di modal
 * Cetak (disepakati supaya tidak saling memengaruhi/membingungkan) - cuma 1
 * nama per pencarian (bukan daftar dipisah koma seperti di Cetak). ----- */
let petaCariNamaAktif = false;
let petaCariNamaQuery = '';
function togglePetaCariNama(){
  petaCariNamaAktif = !petaCariNamaAktif;
  if(!petaCariNamaAktif) petaCariNamaQuery = '';
  renderPeta();
}
/* FIX: dulu tiap ketik 1 huruf memanggil renderPeta() penuh (mengganti ulang
 * SELURUH innerHTML layar Peta, termasuk kotak input itu sendiri) - input-nya
 * ikut dibuat ulang tiap kali, jadi fokus & keyboard hilang-muncul tiap
 * huruf. Sekarang cuma warna poligon yang di-update langsung lewat DOM,
 * kotak input & sisa layar tidak disentuh sama sekali. */
function onPetaCariNamaInput(el){
  petaCariNamaQuery = el.value;
  refreshNamaDatalist(el.value);
  const highlightSet = blokTerhighlightUntukNama(petaCariNamaQuery);
  document.querySelectorAll('#petaFullWrap polygon[data-blok]').forEach(poly=>{
    const on = highlightSet.has(poly.getAttribute('data-blok'));
    poly.setAttribute('fill', on ? 'rgba(211,47,47,0.38)' : 'rgba(46,125,50,0.14)');
    poly.setAttribute('stroke', on ? '#D32F2F' : '#2E7D32');
    poly.setAttribute('stroke-width', on ? '0.25' : '0.15');
  });
}
/* Nama disimpan sebagai 1 field, tapi kadang ditulis beberapa nama sekaligus
 * dipisah koma dalam 1 kotak yang sama (mis. "Wayan , Karmani") - supaya
 * pencarian & cetak tetap ketemu tiap nama yang disebut, bukan cuma yang
 * cocok PERSIS dengan seluruh isi kotak, di sini dipecah dulu per koma. */
function splitNamaKoma(s){
  return String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function blokTerhighlightUntukNama(nama){
  const set = new Set();
  if(!nama) return set;
  const q = nama.toLowerCase();
  ENTRIES.forEach(e=>{
    [...pasanganArrGetForDisplay(e,'lokasi','nama'), ...pasanganArrGetForDisplay(e,'lokasi2','nama2'), ...pasanganArrGetForDisplay(e,'lokasi3','nama3')].forEach(p=>{
      if(p.lokasi && splitNamaKoma(p.nama).some(n=>n.toLowerCase()===q)) set.add(p.lokasi);
    });
  });
  return set;
}
function renderPeta(){
  const host = document.getElementById('screen-peta');
  if(!petaImageLoaded){
    host.innerHTML = `<div class="empty-note" style="padding-top:40px;">Memuat gambar peta...</div>`;
    return;
  }
  if(!PETA_IMAGE){
    host.innerHTML = `
      <div class="card" style="margin-top:8px;">
        <div class="empty-note">Belum ada gambar peta. Upload gambar peta kebun (dari galeri HP) untuk mulai menandai blok kerja.</div>
        <input type="file" accept="image/*" id="petaFileInput" style="display:none;" onchange="handlePetaUpload(event)">
        <button class="btn-block" onclick="document.getElementById('petaFileInput').click()">${ic('camera')} Upload Gambar Peta</button>
      </div>`;
    return;
  }
  const svgPoints = petaDrawPoints.map(p=>p.x+','+p.y).join(' ');
  const highlightSet = petaCariNamaAktif ? blokTerhighlightUntukNama(petaCariNamaQuery) : new Set();
  host.innerHTML = `
    <div id="petaFullWrap" style="position:relative;width:100%;height:100%;overflow:hidden;">
      <div id="petaImgWrap" style="position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;" onclick="handlePetaTap(event)" ontouchstart="petaTouchStart(event)" ontouchmove="petaTouchMove(event)" ontouchend="petaTouchEnd(event)">
        <div id="petaImgInner" style="transform-origin:0 0;position:relative;">
          <img src="${PETA_IMAGE}" style="width:100%;display:block;pointer-events:none;" id="petaImgEl">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
            ${PETA_BLOCKS.map(b=>{
              const on = highlightSet.has(b.label);
              return `<polygon data-blok="${escapeHtml(b.label)}" points="${b.points.map(p=>p.x+','+p.y).join(' ')}" fill="${on?'rgba(211,47,47,0.38)':'rgba(46,125,50,0.14)'}" stroke="${on?'#D32F2F':'#2E7D32'}" stroke-width="${on?'0.25':'0.15'}" vector-effect="non-scaling-stroke"></polygon>`;
            }).join('')}
            ${petaDrawing && petaDrawPoints.length>0 ? `<polyline points="${svgPoints}" fill="none" stroke="#1565C0" stroke-width="0.15" stroke-dasharray="1.2,0.8" vector-effect="non-scaling-stroke"></polyline>
              ${petaDrawPoints.map(p=>`<circle class="peta-drawdot" cx="${p.x}" cy="${p.y}" r="0.9" fill="#1565C0" stroke="#fff" stroke-width="0.3" vector-effect="non-scaling-stroke"></circle>`).join('')}` : ''}
          </svg>
        </div>
      </div>

      ${petaCariNamaAktif ? `
      <div style="position:absolute;left:10px;right:10px;top:10px;background:var(--surface);border-radius:12px;padding:5px 10px;box-shadow:0 3px 12px rgba(0,0,0,.3);z-index:45;">
        <input type="text" list="namaSuggest" placeholder="Ketik nama untuk highlight blok" value="${escapeHtml(petaCariNamaQuery)}" style="margin-bottom:0;height:38px;" oninput="onPetaCariNamaInput(this)" onfocus="refreshNamaDatalist(this.value)">
      </div>
      ` : ''}

      ${!petaDrawing ? `
      <div style="position:fixed;left:16px;bottom:calc(78px + env(safe-area-inset-bottom, 20px));display:flex;gap:8px;align-items:center;z-index:45;">
        <button onclick="togglePetaCariNama()" title="${petaCariNamaAktif?'Tutup pencarian':'Cari Nama'}" style="width:56px;height:56px;border-radius:50%;background:${petaCariNamaAktif?'var(--secondary)':'var(--surface)'};color:${petaCariNamaAktif?'#fff':'var(--on-surface)'};border:none;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
          ${petaCariNamaAktif
            ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
            : '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'}
        </button>
        ${petaCariNamaAktif ? `<button class="pill-btn" style="box-shadow:0 3px 10px rgba(0,0,0,.25);" onclick="openPetaCetakModal()">${ic('document',16)} Cetak</button>` : ''}
      </div>
      ` : ''}

      ${!petaDrawing ? `
      <button onclick="startPetaDraw()" title="Gambar Blok Baru" style="position:fixed;right:16px;bottom:calc(78px + env(safe-area-inset-bottom, 20px));width:56px;height:56px;border-radius:50%;background:var(--primary);color:#fff;border:none;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:45;">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
      </button>
      ` : `
      <div style="position:fixed;left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom, 20px));background:var(--surface);border-radius:16px;padding:12px 14px;box-shadow:0 3px 12px rgba(0,0,0,.3);z-index:45;">
        <div class="field-sub" style="margin-bottom:8px;">Menggambar blok: ${petaDrawPoints.length} titik. Tap tiap sudut, lalu Simpan.</div>
        <div style="display:flex;gap:8px;">
          <button class="pill-btn sm outline" style="flex:1;justify-content:center;" onclick="undoPetaPoint()">${ic('undo')} Undo</button>
          <button class="pill-btn sm" style="flex:1;justify-content:center;" onclick="finishPetaDraw()">Simpan</button>
          <button class="pill-btn sm outline" style="flex:1;justify-content:center;" onclick="cancelPetaDraw()">Batal</button>
        </div>
      </div>
      `}
    </div>
  `;
  applyPetaTransform();
}
function handlePetaUpload(evt){
  const file = evt.target.files[0];
  if(!file) return;
  toast('Memproses gambar...');
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = async function(){
      // Resize ke maksimal 3600px sisi terpanjang -- cukup detail untuk zoom 8x pada peta blok yang rapat
      const maxDim = 3600;
      let w = img.width, h = img.height;
      if(w > maxDim || h > maxDim){
        const scale = maxDim / Math.max(w,h);
        w = Math.round(w*scale); h = Math.round(h*scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      PETA_IMAGE = canvas.toDataURL('image/jpeg', 0.85);
      try{
        await petaDbSet('main', PETA_IMAGE);
        toast('Gambar peta disimpan');
        petaZoom = {scale:1, panX:0, panY:0};
      }catch(err){
        toast('Gagal simpan gambar: '+(err&&err.message?err.message:'penyimpanan penuh'));
      }
      renderPeta();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
let petaZoom = {scale:1, panX:0, panY:0};
let petaTouchState = null;
let petaJustDragged = false;
function applyPetaTransform(){
  const inner = document.getElementById('petaImgInner');
  if(inner) inner.style.transform = `translate(${petaZoom.panX}px, ${petaZoom.panY}px) scale(${petaZoom.scale})`;
  const wrap = document.getElementById('petaImgWrap');
  const dots = document.querySelectorAll('.peta-drawdot');
  if(wrap && dots.length){
    const rectWidth = wrap.getBoundingClientRect().width || 350;
    const desiredScreenRadiusPx = 7;
    const r = ((desiredScreenRadiusPx * 100 / rectWidth) / petaZoom.scale).toFixed(3);
    dots.forEach(c=>{ c.setAttribute('r', r); });
  }
}
function resetPetaZoom(){
  petaZoom = {scale:1, panX:0, panY:0};
  applyPetaTransform();
}
function clampPan(){
  const wrap = document.getElementById('petaImgWrap');
  if(!wrap) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const maxX = w*(petaZoom.scale-1), maxY = h*(petaZoom.scale-1);
  petaZoom.panX = Math.min(0, Math.max(-maxX, petaZoom.panX));
  petaZoom.panY = Math.min(0, Math.max(-maxY, petaZoom.panY));
}
function petaTouchStart(e){
  const wrap = document.getElementById('petaImgWrap');
  const rect = wrap.getBoundingClientRect();
  if(e.touches.length===2){
    const [t1,t2] = e.touches;
    const dist = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
    const midX = (t1.clientX+t2.clientX)/2 - rect.left;
    const midY = (t1.clientY+t2.clientY)/2 - rect.top;
    petaTouchState = {mode:'pinch', startDist:dist, startScale:petaZoom.scale, midX, midY, startPanX:petaZoom.panX, startPanY:petaZoom.panY};
  } else if(e.touches.length===1){
    petaTouchState = {mode:'pan', startX:e.touches[0].clientX, startY:e.touches[0].clientY, startPanX:petaZoom.panX, startPanY:petaZoom.panY, moved:false};
  }
}
function petaTouchMove(e){
  if(!petaTouchState) return;
  if(petaTouchState.mode==='pinch' && e.touches.length===2){
    e.preventDefault();
    const [t1,t2] = e.touches;
    const dist = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
    const newScale = Math.min(12, Math.max(1, petaTouchState.startScale * (dist/petaTouchState.startDist)));
    const contentX = (petaTouchState.midX - petaTouchState.startPanX) / petaTouchState.startScale;
    const contentY = (petaTouchState.midY - petaTouchState.startPanY) / petaTouchState.startScale;
    petaZoom.scale = newScale;
    petaZoom.panX = petaTouchState.midX - contentX*newScale;
    petaZoom.panY = petaTouchState.midY - contentY*newScale;
    clampPan();
    applyPetaTransform();
  } else if(petaTouchState.mode==='pan' && e.touches.length===1){
    const dx = e.touches[0].clientX - petaTouchState.startX;
    const dy = e.touches[0].clientY - petaTouchState.startY;
    if(Math.abs(dx)>5 || Math.abs(dy)>5) petaTouchState.moved = true;
    if(petaZoom.scale>1){
      e.preventDefault();
      petaZoom.panX = petaTouchState.startPanX + dx;
      petaZoom.panY = petaTouchState.startPanY + dy;
      clampPan();
      applyPetaTransform();
    }
  }
}
function petaTouchEnd(e){
  if(petaTouchState && (petaTouchState.mode==='pinch' || (petaTouchState.mode==='pan' && petaTouchState.moved))){
    petaJustDragged = true;
    setTimeout(()=>{ petaJustDragged = false; }, 200);
  }
  petaTouchState = null;
}
function petaTapCoords(evt){
  const wrap = document.getElementById('petaImgWrap');
  const img = document.getElementById('petaImgEl');
  const rect = wrap.getBoundingClientRect();
  const imgRenderedHeight = (img && img.naturalWidth) ? (rect.width * img.naturalHeight / img.naturalWidth) : rect.height;
  const localX = (evt.clientX - rect.left - petaZoom.panX) / petaZoom.scale;
  const localY = (evt.clientY - rect.top - petaZoom.panY) / petaZoom.scale;
  return {
    x: +(localX / rect.width * 100).toFixed(2),
    y: +(localY / imgRenderedHeight * 100).toFixed(2)
  };
}
function startPetaDraw(){
  petaDrawing = true;
  petaDrawPoints = [];
  renderPeta();
}
function cancelPetaDraw(){
  petaDrawing = false;
  petaDrawPoints = [];
  renderPeta();
}
function undoPetaPoint(){
  if(petaDrawPoints.length>0){ petaDrawPoints.pop(); renderPeta(); }
}
function finishPetaDraw(){
  if(petaDrawPoints.length < 3){ toast('Minimal 3 titik untuk membentuk area'); return; }
  const typed = prompt('Nama blok ini?');
  if(!typed){ return; }
  // Auto-rapikan format (2 angka + 2 huruf kapital + 2 angka, mis. "20 BS 12")
  // - sama seperti field Lokasi di Hari Ini - supaya nama blok konsisten dan
  // bisa dicocokkan dengan akurat untuk fitur Riwayat.
  const label = fmtBlokKode(typed);
  PETA_BLOCKS.push({id:uid(), label, points: petaDrawPoints.slice(), date: todayIso()});
  savePetaBlocks();
  if(!BLOKS.some(b=>b.kode.toLowerCase()===label.toLowerCase())){
    BLOKS.push({id:uid(), kode:label});
    saveBloks();
  }
  petaDrawing = false;
  petaDrawPoints = [];
  renderPeta();
  toast('Blok ditambahkan');
}
function pointInPolygon(pt, points){
  let inside = false;
  for(let i=0,j=points.length-1; i<points.length; j=i++){
    const xi=points[i].x, yi=points[i].y, xj=points[j].x, yj=points[j].y;
    const intersect = ((yi>pt.y)!==(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
function handlePetaTap(evt){
  if(petaJustDragged) return;
  const pt = petaTapCoords(evt);
  if(petaDrawing){
    petaDrawPoints.push(pt);
    renderPeta();
    return;
  }
  const hit = PETA_BLOCKS.find(b=>pointInPolygon(pt, b.points));
  if(hit){
    showPetaBlock(hit.id);
  }
}
let _petaActiveBlockId = null;
/* Blok punya Riwayat HANYA kalau namanya format "2 angka + 2 huruf kapital +
 * 2 angka" (mis. "20 BS 12") - format ganjil (mis. "23/10U") dilewati saja,
 * tidak dipaksa dicocokkan. */
function isBlokFormatValid(label){
  return /^\d{2} [A-Z]{2} \d{2}$/.test(label||'');
}
/* Riwayat 1 blok = semua entri Hari Ini yang field Lokasi/Lokasi Muat/Lokasi
 * Bongkar-nya SAMA PERSIS dengan nama blok ini (case-sensitive, karena sudah
 * dirapikan konsisten lewat fmtBlokKode di kedua sisi - Hari Ini maupun waktu
 * blok dibuat/diedit). Terbaru dulu. */
const LAYANAN_SUFFIXES = ['','2','3']; // utama, ke-2, ke-3
function riwayatUntukBlok(label){
  return ENTRIES
    .filter(e => LAYANAN_SUFFIXES.some(sfx =>
      pasanganArrGetForDisplay(e,'lokasi'+sfx,'nama'+sfx).some(p=>p.lokasi===label) ||
      e[sfx?('lokasiMuat'+sfx):'lokasiMuat']===label || e[sfx?('lokasiBongkar'+sfx):'lokasiBongkar']===label
    ))
    .sort((a,b)=>b.date.localeCompare(a.date))
    .map(e=>{
      // Tentukan slot mana (utama/ke-2/ke-3) yang BENAR-BENAR cocok dengan
      // blok ini, supaya jenis layanan & detail (mis. tonase) yang ditampilkan
      // sesuai layanan yang tepat, bukan asal ambil yang pertama.
      let jenis = e.jenisLayanan, tonase = e.tonaseKg;
      const pasanganPerSlot = LAYANAN_SUFFIXES.map(sfx=>pasanganArrGetForDisplay(e,'lokasi'+sfx,'nama'+sfx).filter(p=>p.lokasi===label));
      const slotCocok = LAYANAN_SUFFIXES.find((sfx,i)=> pasanganPerSlot[i].length>0 || e[sfx?('lokasiMuat'+sfx):'lokasiMuat']===label || e[sfx?('lokasiBongkar'+sfx):'lokasiBongkar']===label);
      if(slotCocok!==undefined && slotCocok!==''){
        jenis = e['jenisLayanan'+slotCocok] || e.jenisLayanan;
        tonase = e['tonaseKg'+slotCocok];
      }
      const detail = (jenis==='Muat Tebu' && tonase) ? (fmtThousandsLive(String(tonase))+' kg') : '';
      // Nama yang ditampilkan HANYA yang benar-benar BERPASANGAN dengan lokasi
      // ini - bukan gabungan semua nama di entri itu - supaya tidak tertukar
      // kalau entrinya punya beberapa lokasi sekaligus.
      const namaCocok = pasanganPerSlot.flat().map(p=>p.nama).filter(Boolean);
      return {date:e.date, btId:e.btId, jenis, detail, nama:namaCocok.join(', ')};
    });
}
function fmtTglSingkat(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function showPetaBlock(id){
  const b = PETA_BLOCKS.find(x=>x.id===id);
  if(!b) return;
  _petaActiveBlockId = id;
  const formatValid = isBlokFormatValid(b.label);
  const riwayat = formatValid ? riwayatUntukBlok(b.label) : [];
  openModal(`
    <div class="mhead"><h2>${ic('map')} ${escapeHtml(b.label)}</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <button class="pill-btn" style="margin-bottom:14px;" onclick="usePetaBlockAsLokasi('${b.id}')">+ Lokasi Hari Ini</button>
    ${formatValid ? `
    <div class="section-eyebrow">Riwayat</div>
    <div style="max-height:110px;overflow-y:auto;border:1px solid var(--outline-variant);border-radius:12px;padding:6px 12px;margin-bottom:16px;">
      ${riwayat.length===0 ? '' : riwayat.map(r=>`<div style="font-size:11px;color:var(--on-surface-variant);padding:4px 0;border-bottom:1px solid var(--outline-variant);">${fmtTglSingkat(r.date)} &middot; ${escapeHtml(btLabel(r.btId))} &middot; ${escapeHtml(r.jenis||'-')}${r.detail?' &middot; '+escapeHtml(r.detail):''}${r.nama?' &middot; '+escapeHtml(r.nama):''}</div>`).join('')}
    </div>
    ` : ''}
    <div style="display:flex;gap:8px;">
      <button class="pill-btn outline" style="flex:2;justify-content:center;" onclick="editPetaBlockName('${b.id}')">${ic('edit')} Edit Nama</button>
      <button class="pill-btn outline" style="flex:1;justify-content:center;color:var(--secondary);border-color:var(--secondary);" onclick="deletePetaBlock('${b.id}');closeModal();">Hapus</button>
    </div>
  `);
}
function editPetaBlockName(id){
  const b = PETA_BLOCKS.find(x=>x.id===id);
  if(!b) return;
  const typed = prompt('Ganti nama blok:', b.label);
  if(!typed) return;
  b.label = fmtBlokKode(typed); // auto-rapikan format, sama seperti waktu blok dibuat
  savePetaBlocks();
  toast('Nama blok diperbarui');
  showPetaBlock(id);
}
/* Kalau hari ini cuma ada 1 unit, langsung terapkan seperti biasa - tidak
 * perlu tanya apa-apa. Kalau ada lebih dari 1 (unit utama + tambahan), tanya
 * dulu mau ditambahkan ke unit yang mana - supaya lokasi tidak salah nyasar
 * ke unit utama padahal pekerjaannya sedang di unit tambahan (bug yang
 * dilaporkan sebelumnya). */
function usePetaBlockAsLokasi(id){
  const semuaUnit = [getTodayEntry(), ...getSecondaryUnitsToday()];
  if(semuaUnit.length<=1){ terapkanLokasiKeEntry(id, semuaUnit[0].id); return; }
  openPetaPilihUnitModal(id, semuaUnit);
}
function openPetaPilihUnitModal(blockId, semuaUnit){
  const b = PETA_BLOCKS.find(x=>x.id===blockId);
  if(!b) return;
  openModal(`
    <div class="mhead"><h2>Pilih Unit</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:12px;">Lokasi "${escapeHtml(b.label)}" mau ditambahkan ke unit mana hari ini?</div>
    ${semuaUnit.map(e=>`
      <button class="pill-btn outline" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="terapkanLokasiKeEntry('${blockId}','${e.id}')">
        ${escapeHtml(btLabel(e.btId)||'(belum pilih unit)')}${e.jenisLayanan?' &middot; '+escapeHtml(e.jenisLayanan):''}
      </button>
    `).join('')}
  `);
}
function terapkanLokasiKeEntry(blockId, entryId){
  const b = PETA_BLOCKS.find(x=>x.id===blockId);
  const e = ENTRIES.find(x=>x.id===entryId);
  if(!b || !e) return;
  if(e.jenisLayanan==='Muat Tebu' && e.muatTipe==='Bibit'){
    if(!e.lokasiMuat){ e.lokasiMuat = b.label; toast('Lokasi Muat diisi: '+b.label); }
    else { e.lokasiBongkar = b.label; toast('Lokasi Bongkar diisi: '+b.label); }
    saveEntries();
  } else {
    // Ditambahkan sebagai pasangan baru {lokasi, nama:''} - BUKAN menimpa
    // yang sudah ada. Nama-nya dikosongkan dulu (bisa diisi manual di Hari
    // Ini kalau memang ada vendor/mandor tertentu di lokasi ini) - pasangan
    // kosong yang belum terisi apa pun tidak ikut disimpan supaya tidak
    // menumpuk baris kosong tiap tombol ini ditekan berkali-kali.
    const arr = pasanganArrGetForDisplay(e, 'lokasi', 'nama').filter(p=>p.lokasi||p.nama);
    arr.push({lokasi:b.label, nama:''});
    e.lokasiPasanganArr = arr;
    e.lokasi = arr[0].lokasi||'';
    e.nama = arr[0].nama||'';
    saveEntries();
    toast('Lokasi ditambahkan: '+b.label);
  }
  closeModal();
}
function deletePetaBlock(id){
  if(!confirm('Hapus blok ini?')) return;
  PETA_BLOCKS = PETA_BLOCKS.filter(b=>b.id!==id);
  savePetaBlocks();
  renderPeta();
  toast('Blok dihapus');
}

/* ----- Cetak Riwayat per Nama - TERPISAH TOTAL dari kolom cari-nama di atas
 * peta (tidak saling mengisi otomatis, sesuai kesepakatan): periode Semua/
 * Custom, dan Nama sendiri (kosong = semua nama, boleh isi beberapa dipisah
 * koma). Hasilnya PDF teks (tabel), bukan gambar peta. ----- */
function openPetaCetakModal(){
  openModal(`
    <div class="mhead"><h2>Cetak Riwayat per Nama</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="section-eyebrow">Periode</div>
    <div class="chk-row"><input type="radio" name="cnPeriode" value="semua" checked onchange="togglePetaCetakCustomRange(false)"><label style="margin-left:6px;">Semua periode</label></div>
    <div class="chk-row"><input type="radio" name="cnPeriode" value="custom" onchange="togglePetaCetakCustomRange(true)"><label style="margin-left:6px;">Rentang tanggal custom</label></div>
    <div id="cnCustomRange" style="display:none;margin:8px 0;">
      <label class="flabel">Dari tanggal</label><input type="date" id="cnDari" value="${todayIso()}">
      <label class="flabel">Sampai tanggal</label><input type="date" id="cnSampai" value="${todayIso()}">
    </div>
    <div class="section-eyebrow">Nama <span style="font-weight:400;color:var(--on-surface-variant);">(opsional)</span></div>
    <input type="text" id="cnNama" placeholder="Kosongkan untuk semua nama, atau ketik dipisah koma">
    <div class="field-sub" style="margin-bottom:14px;">Boleh isi lebih dari 1 nama, dipisah koma (mis. "Budi, Vendor A"). Tidak nyambung dengan kolom pencarian di peta - isi ulang di sini kalau perlu.</div>
    <button class="btn-block" onclick="cetakRiwayatNama()">${ic('document')} Cetak</button>
  `);
}
function togglePetaCetakCustomRange(show){
  const el = document.getElementById('cnCustomRange');
  if(el) el.style.display = show ? 'block' : 'none';
}
/* Kumpulkan baris riwayat lintas semua entri, dari pasangan Lokasi&Nama
 * (layanan utama maupun kedua) - HANYA pasangan yang benar-benar punya Nama
 * terisi (lokasi tanpa nama tidak relevan untuk laporan "per nama" ini). */
function namaCetakRows(namaFilterLower, dariIso, sampaiIso){
  const rows = [];
  ENTRIES.forEach(e=>{
    if(dariIso && e.date<dariIso) return;
    if(sampaiIso && e.date>sampaiIso) return;
    const cekSlot = (lokasiField, namaField, jenis) => {
      pasanganArrGetForDisplay(e, lokasiField, namaField).forEach(p=>{
        if(!p.lokasi || !p.nama) return;
        const namaDiBaris = splitNamaKoma(p.nama);
        if(namaFilterLower.length>0 && !namaDiBaris.some(n=>namaFilterLower.includes(n.toLowerCase()))) return;
        rows.push({date:e.date, btId:e.btId, jenis, nama:p.nama, blok:p.lokasi});
      });
    };
    cekSlot('lokasi','nama', e.jenisLayanan);
    cekSlot('lokasi2','nama2', e.jenisLayanan2||e.jenisLayanan);
    cekSlot('lokasi3','nama3', e.jenisLayanan3||e.jenisLayanan);
  });
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return rows;
}
async function cetakRiwayatNama(){
  if(!window.jspdf){ toast('Library PDF belum siap'); return; }
  const mode = document.querySelector('#modalSheet input[name=cnPeriode]:checked').value;
  const dari = mode==='custom' ? document.getElementById('cnDari').value : null;
  const sampai = mode==='custom' ? document.getElementById('cnSampai').value : null;
  const namaRaw = document.getElementById('cnNama').value.trim();
  const namaFilterLower = namaRaw ? namaRaw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
  const rows = namaCetakRows(namaFilterLower, dari, sampai);
  if(rows.length===0){ toast('Tidak ada data yang cocok'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'portrait'});
  doc.setFontSize(14); doc.setFont(undefined,'bold');
  doc.text('Riwayat per Nama', 14, 16);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  const periodeLabel = mode==='custom' ? (fmtLabel(dari)+' - '+fmtLabel(sampai)) : 'Semua periode';
  const namaLabel = namaFilterLower.length ? namaRaw : 'Semua nama';
  doc.text('Periode: '+periodeLabel+'  |  Nama: '+namaLabel, 14, 22);
  doc.autoTable({
    startY: 28,
    head: [['Tanggal','No Unit','Jenis Layanan','Nama','Blok']],
    body: rows.map(r=>[fmtLabel(r.date), btLabel(r.btId), r.jenis||'-', r.nama, r.blok]),
    styles:{fontSize:8},
    headStyles:{fillColor:[46,90,166]}
  });
  const pdfBlob = doc.output('blob');
  const result = await saveOrShareBlob(pdfBlob, 'riwayat-nama-'+todayIso()+'.pdf');
  toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
  closeModal();
}
const ALL_EXPORT_HEADERS = ['Tanggal','No Unit','Jenis Layanan','Detail','Lokasi','Absen Berangkat','Absen Pulang','Istirahat','HM Awal','HM Akhir','HM Terpakai','BBM (L)','Lembur (j)','Lembur Final','BU/TU','BS/TS','Catatan','Catatan Khusus'];
function slugCol(h){ return h.toLowerCase().replace(/[^a-z0-9]+/g,'-'); }
/* Grup checklist kolom cetak: kolom cuaca (BU/TU + BS/TS) digabung jadi 1 ceklis "Cuaca" */
function buildExportCheckGroups(){
  const groups = [];
  ALL_EXPORT_HEADERS.forEach(h=>{
    if(h==='BU/TU'){ groups.push({label:'Cuaca', headers:['BU/TU','BS/TS']}); }
    else if(h==='BS/TS'){ /* sudah masuk grup Cuaca di atas */ }
    else groups.push({label:h, headers:[h]});
  });
  return groups;
}
function openExportSheet(){
  openModal(`
    <div class="mhead"><h2 id="exportSheetTitle">Export / Cetak Laporan</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="section-eyebrow">Periode</div>
    <div class="chk-row"><input type="radio" name="exp-mode" id="exp-mode-month" value="month" checked onchange="updateExpModeUI()"><label for="exp-mode-month" style="margin-left:6px;">Bulan ini</label></div>
    <div class="chk-row"><input type="radio" name="exp-mode" id="exp-mode-all" value="all" onchange="updateExpModeUI()"><label for="exp-mode-all" style="margin-left:6px;">Semua periode</label></div>
    <div class="chk-row"><input type="radio" name="exp-mode" id="exp-mode-custom" value="custom" onchange="updateExpModeUI()"><label for="exp-mode-custom" style="margin-left:6px;">Rentang tanggal custom</label></div>
    <div id="exp-customRange" style="display:none;margin:8px 0;">
      <label class="flabel">Dari tanggal</label><input type="date" id="exp-dateFrom">
      <label class="flabel">Sampai tanggal</label><input type="date" id="exp-dateTo">
    </div>
    <div class="section-eyebrow section-eyebrow-row" style="margin-top:14px;">Kolom yang Dicetak
      <button class="pill-btn sm" type="button" onclick="toggleAllExportCols()">Pilih/Batal Semua</button>
    </div>
    <div class="card card-flat" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;">
      ${buildExportCheckGroups().map(g=>`<div class="chk-row"><input type="checkbox" class="exp-col-chk" id="exp-col-${slugCol(g.label)}" checked><label for="exp-col-${slugCol(g.label)}" style="margin-left:6px;">${escapeHtml(g.label)}</label></div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn-block" style="flex:1;" onclick="doExport('pdf')">${ic('document')} PDF</button>
      <button class="btn-block outline" style="flex:1;" onclick="doExport('xlsx')">${ic('barchart')} Excel</button>
    </div>
  `);
  wireLongPressExportTitle();
}
function toggleAllExportCols(){
  const boxes = document.querySelectorAll('.exp-col-chk');
  const anyUnchecked = Array.from(boxes).some(b=>!b.checked);
  boxes.forEach(b=>b.checked = anyUnchecked);
}
function getSelectedColumns(){
  const selected = [];
  buildExportCheckGroups().forEach(g=>{
    const el = document.getElementById('exp-col-'+slugCol(g.label));
    const checked = el ? el.checked : true;
    if(checked) g.headers.forEach(h=>selected.push(h));
  });
  return selected;
}
function updateExpModeUI(){
  const mode = document.querySelector('input[name="exp-mode"]:checked').value;
  document.getElementById('exp-customRange').style.display = mode==='custom' ? 'block' : 'none';
}
function getWeatherLogForDate(dateIso){
  return WEATHER_LOG.find(w=>w.date===dateIso) || null;
}
function cuacaCellText(wRegion){
  if(!wRegion) return '-';
  const kondisi = wRegion.isRain ? 'Hujan' : 'Cerah';
  const suhu = wRegion.repTemp!==null && wRegion.repTemp!==undefined ? Math.round(wRegion.repTemp)+'\u00b0' : '-';
  const jam = (wRegion.rainHour!==null && wRegion.rainHour!==undefined) ? jamLabel(wRegion.rainHour) : '';
  return (kondisi+' '+suhu+' '+jam).trim();
}
function getExportRows(){
  const mode = document.querySelector('input[name="exp-mode"]:checked').value;
  let rows;
  if(mode==='all'){ rows = ENTRIES.slice(); }
  else if(mode==='custom'){
    const from = document.getElementById('exp-dateFrom').value;
    const to = document.getElementById('exp-dateTo').value;
    rows = ENTRIES.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to));
  } else {
    const mk = todayIso().slice(0,7);
    rows = ENTRIES.filter(e=>e.date.startsWith(mk));
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  const headers = getSelectedColumns();
  const detailUntukLayanan = (e, jenis, suffix) => {
    const fk = (name)=>name+suffix;
    if(jenis==='Antar/Jemput Tenaga') return [e[fk('tipeAntar')], e[fk('kegiatan')]].filter(Boolean).join(' / ');
    if(jenis==='Muat Tebu') return [e[fk('muatTipe')], e[fk('tonaseKg')]?e[fk('tonaseKg')]+' kg':''].filter(Boolean).join(' / ');
    if(jenis==='Drone') return e[fk('droneJenis')]||'';
    if(jenis==='Operator') return e[fk('shift')]||'';
    return '';
  };
  const lokasiUntukLayanan = (e, jenis, suffix) => {
    const fk = (name)=>name+suffix;
    if(jenis==='Muat Tebu') return [e[fk('lokasiMuat')],e[fk('lokasiBongkar')]].filter(Boolean).join(' -> ');
    // Kalau lokasinya lebih dari 1 (1 kegiatan mencakup beberapa blok), yang
    // dicetak cuma yang PERTAMA sebagai wakil - biar laporan tetap ringkas.
    return lokasiArrGetForDisplay(e, fk('lokasi'))[0] || '';
  };
  /* 1 hari kerja = 1 s/d 3 "kegiatan" (Jenis Layanan utama/ke-2/ke-3, unit
   * sama). Setiap kegiatan sekarang tercetak sebagai BARIS TABEL SENDIRI
   * (bukan digabung \n dalam 1 sel seperti sebelumnya) - supaya tiap kegiatan
   * (mis. Operator siang, Antar Mekanik 3 blok, Jemput Vendor) kebaca jelas
   * satu-satu. Hari Libur/Cuti/Standby (tidak ada kegiatan sama sekali) tetap
   * jadi 1 baris kosong (tanda "-"). */
  const kegiatanUntukEntry = (e) => {
    if(isSystemUnitId(e.btId)) return [{jenisLabel:'-', detail:'-', lokasi:'-'}];
    const slots = LAYANAN_SUFFIXES.filter(sfx => sfx==='' ? e.jenisLayanan : (e['adaLayanan'+sfx] && e['jenisLayanan'+sfx]));
    if(slots.length===0) return [{jenisLabel:'-', detail:'-', lokasi:'-'}];
    return slots.map(sfx=>{
      const jenis = e['jenisLayanan'+sfx];
      return {
        jenisLabel: jenisLayananArahLabel(jenis, e, sfx) || '-',
        detail: detailUntukLayanan(e, jenis, sfx) || '-',
        lokasi: lokasiUntukLayanan(e, jenis, sfx) || '-'
      };
    });
  };
  /* Kolom yang levelnya "1x per hari" (bukan per kegiatan) - dicetak sama di
   * setiap baris kegiatan hari itu, lalu baris ke-2/3-nya dikosongkan lewat
   * loop di bawah supaya TAMPIL menyatu (gaya yang sama seperti kolom Tanggal
   * yang sudah dari dulu dikosongkan kalau tanggalnya sama dengan baris
   * sebelumnya) - bukan sungguhan digabung sebagai 1 sel PDF/Excel, tapi
   * hasilnya di layar terlihat sama seperti sel gabung. */
  const MERGE_PER_HARI_COLS = ['Absen Berangkat','Absen Pulang','Istirahat','HM Awal','HM Akhir','HM Terpakai','BBM (L)','Lembur (j)','Lembur Final','Catatan','Catatan Khusus','BU/TU','BS/TS'];
  const data = [];
  rows.forEach(e=>{
    const isSys = isSystemUnitId(e.btId);
    const ha=parseFloat(e.hmAwal), hb=parseFloat(e.hmAkhir);
    const hmTerpakai = (!isNaN(ha)&&!isNaN(hb)&&hb>=ha) ? (hb-ha).toFixed(1) : '-';
    const wlog = getWeatherLogForDate(e.date);
    /* Hari Libur/Cuti/Standby: tidak ada kerja sama sekali, jadi semua kolom
     * kerja "-" (BUKAN nilai bawaan seperti jam istirahat default atau angka
     * 0 di BBM/Lembur yang menyesatkan seolah memang terisi). Cuaca &
     * Catatan tetap tampil apa adanya seperti biasa. */
    const perHari = {
      'Absen Berangkat': isSys ? '-' : (e.absenBerangkat||(e.menginap?'Menginap':'-')),
      'Absen Pulang': isSys ? '-' : (e.absenPulang||(e.menginap?'Menginap':'-')),
      'Istirahat': (isSys || e.isSecondary) ? '-' : (e.istirahat ? ((e.istMulai||'-')+'-'+(e.istSelesai||'-')) : 'Lembur'),
      'HM Awal': isSys ? '-' : (e.hmAwal||'-'), 'HM Akhir': isSys ? '-' : (e.hmAkhir||'-'), 'HM Terpakai': isSys ? '-' : hmTerpakai,
      'BBM (L)': isSys ? '-' : fmtLiterID((parseFloat(e.bbmLiter)||0)/1000),
      'Lembur (j)': (isSys || e.isSecondary) ? '-' : (e.lembur||'0'),
      'Lembur Final': (isSys || e.isSecondary) ? '-' : computeLemburFinal(e).toFixed(1),
      'BU/TU': cuacaCellText(wlog && wlog.utara), 'BS/TS': cuacaCellText(wlog && wlog.selatan),
      'Catatan': e.catatan||'', 'Catatan Khusus': e.catatanKhusus||''
    };
    kegiatanUntukEntry(e).forEach(k=>{
      data.push(Object.assign({
        'Tanggal': fmtLabel(e.date), 'No Unit': btLabel(e.btId),
        'Jenis Layanan': k.jenisLabel, 'Detail': k.detail, 'Lokasi': k.lokasi
      }, perHari, {
        _dateIso: e.date, /* dipakai untuk highlight Minggu/libur nasional & garis penyatu antar baris 1 hari yang sama - bukan kolom cetak */
        _menginap: !!e.menginap, /* dipakai untuk sorot biru baris tugas menginap - bukan kolom cetak */
        _groupKey: e.id /* dipakai untuk kosongkan kolom "1x per hari" di baris kegiatan ke-2/3 - bukan kolom cetak */
      }));
    });
  });
  const totalHm = rows.reduce((s,e)=>{ const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir); return s+((!isNaN(a)&&!isNaN(b)&&b>=a)?(b-a):0); },0);
  const totalLembur = rows.reduce((s,e)=>s+(parseFloat(e.lembur)||0),0);
  const totalLemburFinal = rows.reduce((s,e)=>s+computeLemburFinal(e),0);
  const totalBbm = rows.reduce((s,e)=>s+(parseFloat(e.bbmLiter)||0),0)/1000; // ml -> liter
  const uniqueDates = Array.from(new Set(rows.map(e=>e.date)));
  const totalRainUtara = uniqueDates.reduce((s,d)=>{ const w=getWeatherLogForDate(d); return s+(w&&w.utara?(w.utara.rainMm||0):0); },0);
  const totalRainSelatan = uniqueDates.reduce((s,d)=>{ const w=getWeatherLogForDate(d); return s+(w&&w.selatan?(w.selatan.rainMm||0):0); },0);
  // Baris kegiatan ke-2/ke-3 dalam 1 entri yang sama: kosongkan kolom "1x per
  // hari" (termasuk No Unit KALAU sama dengan baris sebelumnya - beda unit
  // antar entri tetap ditulis masing-masing, tidak ikut dikosongkan).
  for(let i=data.length-1;i>0;i--){
    if(data[i]._groupKey===data[i-1]._groupKey){
      MERGE_PER_HARI_COLS.forEach(col=>{ if(col in data[i]) data[i][col] = ''; });
      if(data[i]['No Unit']===data[i-1]['No Unit']) data[i]['No Unit'] = '';
    }
  }
  for(let i=data.length-1;i>0;i--){
    if(data[i]['Tanggal']===data[i-1]['Tanggal']) data[i]['Tanggal'] = '';
  }
  return {headers, rows:data, totalHm, totalLembur, totalLemburFinal, totalBbm, totalRainUtara, totalRainSelatan};
}
function exportFileLabel(){
  const mode = document.querySelector('input[name="exp-mode"]:checked').value;
  if(mode==='all') return 'semua-periode';
  if(mode==='custom'){
    const from = document.getElementById('exp-dateFrom').value || 'awal';
    const to = document.getElementById('exp-dateTo').value || 'akhir';
    return from+'_sd_'+to;
  }
  return todayIso().slice(0,7);
}
const BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function reportTitleLines(){
  const modeEl = document.querySelector('input[name="exp-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'month';
  let periodLabel;
  if(mode==='all'){
    periodLabel = 'Semua Periode';
  } else if(mode==='custom'){
    const from = document.getElementById('exp-dateFrom').value;
    const to = document.getElementById('exp-dateTo').value;
    const fmtShort = (iso)=>{ if(!iso) return '-'; const d=new Date(iso+'T00:00:00'); return d.getDate()+' '+BULAN_NAMA[d.getMonth()]+' '+d.getFullYear(); };
    periodLabel = fmtShort(from)+' s/d '+fmtShort(to);
  } else {
    const d = new Date();
    periodLabel = BULAN_NAMA[d.getMonth()]+'-'+d.getFullYear();
  }
  return ['Laporan Operasional Bulanan', periodLabel, 'Disusun oleh: '+(USER.name||'Pengguna')];
}
/* Label teks singkat untuk kolom Kondisi di cetak PDF - MENGGANTI pendekatan ikon
 * vektor sebelumnya (drawWeatherIconVector, sudah dihapus) yang tercetak jadi blok
 * warna solid di sel sempit (~9mm) pada sebagian device/PDF viewer. Teks jauh lebih
 * aman: tidak ada risiko ukuran meleset, dan tetap ringkas & terbaca di kolom sempit.
 * 5 kategori sama seperti weatherIconCategory(). */
function weatherCategoryLabel(category){
  const map = { cerah:'Cerah', berawan:'Berawan', hujan_ringan:'H.Ringan', hujan_lebat:'H.Lebat', badai:'Badai' };
  return map[category] || 'Berawan';
}
async function doExport(fmt){
  const {headers, rows, totalHm, totalLembur, totalLemburFinal, totalBbm, totalRainUtara, totalRainSelatan} = getExportRows();
  if(headers.length===0){ toast('Pilih minimal satu kolom dulu'); return; }
  if(rows.length===0){ toast('Tidak ada data pada periode ini'); return; }
  /* Ambil data libur nasional/Minggu untuk rentang tanggal yang tercakup di rows ini —
   * dipakai sama-sama oleh highlight PDF & penanda "(Libur)" di Excel. */
  const isoDates = rows.map(r=>r._dateIso).filter(Boolean).sort();
  const holidaySet = isoDates.length ? await getHolidaySetForRange(isoDates[0], isoDates[isoDates.length-1]) : new Set();
  const totalRow = headers.map((h,i)=>{
    if(i===0) return 'TOTAL';
    if(h==='HM Terpakai') return totalHm.toFixed(1);
    if(h==='BBM (L)') return fmtLiterID(totalBbm);
    if(h==='Lembur (j)') return totalLembur.toFixed(1);
    if(h==='Lembur Final') return totalLemburFinal.toFixed(1);
    if(h==='BU/TU') return totalRainUtara.toFixed(1)+' mm';
    if(h==='BS/TS') return totalRainSelatan.toFixed(1)+' mm';
    return '';
  });
  if(fmt==='xlsx'){
    if(!window.XLSX){ toast('Library Excel belum siap'); return; }
    /* Community edition SheetJS (dipakai app ini) tidak bisa menulis warna latar sel
     * di .xlsx — jadi highlight hijau PDF disederhanakan jadi penanda teks "(Libur)"
     * di kolom Tanggal untuk versi Excel. */
    const rowsForXlsx = rows.map(r=>{
      if(!headers.includes('Tanggal') || !r['Tanggal'] || !r._dateIso) return r;
      if(!isHolidayHighlightDate(r._dateIso, holidaySet)) return r;
      return Object.assign({}, r, {'Tanggal': r['Tanggal']+' (Libur)'});
    });
    const sheetData = [headers, ...rowsForXlsx.map(r=>headers.map(h=>r[h])), totalRow];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = headers.map(h=>({wch: Math.max(h.length,12)}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const result = await saveOrShareBlob(blob, 'rekap-'+exportFileLabel()+'.xlsx');
    toast(result==='shared'?'Excel siap dibagikan':'Excel diunduh');
    closeModal();
    return;
  }
  if(!window.jspdf){ toast('Library PDF belum siap'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});
  const titleLines = reportTitleLines();
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(titleLines[0], 10, 12);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(titleLines[1], 10, 19);
  doc.text(titleLines[2], 10, 25);
  if(typeof doc.autoTable === 'function'){
    doc.autoTable({
      columns: headers.map(h=>({header:h, dataKey:h})),
      body: rows,
      foot: [totalRow],
      startY: 31, styles:{fontSize:8, cellPadding:2}, headStyles:{fillColor:[76,140,60]},
      footStyles:{fillColor:[240,230,210], textColor:[30,20,0], fontStyle:'bold'}, theme:'grid',
      didParseCell: function(data){
        if(data.section==='body'){
          const raw = data.row.raw || {};
          if(raw._dateIso && isHolidayHighlightDate(raw._dateIso, holidaySet)){
            data.cell.styles.fillColor = [211,242,211];
          } else if(raw._menginap){
            // Sorot biru lembut untuk baris tugas menginap (luar kota) - cuma kalau
            // baris itu tidak sedang disorot hijau (libur/Minggu) supaya tidak rebutan warna.
            data.cell.styles.fillColor = [206,226,250];
          }
          // Kalau tanggal baris ini SAMA dengan baris sebelumnya (mis. beberapa
          // unit dicatat di hari yang sama), garis pembatas ATAS dihilangkan
          // di semua kolom - supaya grup 1 hari itu terlihat menyatu sampai
          // kolom Catatan, bukan kelihatan seperti baris-baris terpisah.
          const prevRaw = rows[data.row.index - 1];
          if(prevRaw && raw._dateIso && prevRaw._dateIso === raw._dateIso){
            const lw = data.cell.styles.lineWidth;
            const d = (typeof lw==='number') ? lw : 0.1;
            data.cell.styles.lineWidth = { top:0, right:d, bottom:d, left:d };
          }
        }
      }
    });
  }
  const pdfBlob = doc.output('blob');
  const result = await saveOrShareBlob(pdfBlob, 'rekap-'+exportFileLabel()+'.pdf');
  toast(result==='shared'?'PDF siap dibagikan':'PDF diunduh');
  closeModal();
}
