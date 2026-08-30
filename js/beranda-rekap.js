/* ================= RINGKASAN HM & LEMBUR (30 hari rolling) ================= */
function ringkasanHmLemburData(){
  const days = [];
  for(let i=29;i>=0;i--){
    const d = new Date(todayIso()+'T00:00:00'); d.setDate(d.getDate()-i);
    const iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const entriesHari = ENTRIES.filter(e=>e.date===iso);
    const hm = entriesHari.reduce((s,e)=>{ const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir); return s+((!isNaN(a)&&!isNaN(b)&&b>=a)?(b-a):0); },0);
    const lembur = entriesHari.reduce((s,e)=>s+(parseFloat(e.lembur)||0),0); // jam lembur mentah dari absensi, bukan hasil x2-0.5
    days.push({iso, hm, lembur});
  }
  return days;
}
function openRingkasanHmLembur(){
  closeDrawer();
  openModal(renderRingkasanHmLemburHtml());
}
function renderRingkasanHmLemburHtml(){
  const days = ringkasanHmLemburData();
  const maxHm = Math.max(1, ...days.map(d=>d.hm));
  const maxLembur = Math.max(1, ...days.map(d=>d.lembur));
  const totalHm = days.reduce((s,d)=>s+d.hm,0);
  const totalLembur = days.reduce((s,d)=>s+d.lembur,0);
  const rows = days.slice().reverse().map(d=>{ // terbaru di atas
    const dTgl = new Date(d.iso+'T00:00:00');
    const label = dTgl.getDate()+'/'+(dTgl.getMonth()+1);
    const hmPct = d.hm>0 ? Math.max(8, Math.round(d.hm/maxHm*100)) : 0;
    const lemburPct = d.lembur>0 ? Math.max(8, Math.round(d.lembur/maxLembur*100)) : 0;
    return `<div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;gap:4px;padding:3px 0;">
      <div style="display:flex;justify-content:flex-end;">${d.hm>0?`<div style="background:#4E7FE0;color:#fff;font-size:11px;font-weight:700;padding:3px 6px;border-radius:4px 0 0 4px;width:${hmPct}%;text-align:right;min-width:22px;">${d.hm.toFixed(1)}</div>`:''}</div>
      <div style="text-align:center;font-size:10.5px;color:var(--on-surface-variant);">${label}</div>
      <div style="display:flex;">${d.lembur>0?`<div style="background:#E8A33D;color:#fff;font-size:11px;font-weight:700;padding:3px 6px;border-radius:0 4px 4px 0;width:${lemburPct}%;min-width:22px;">${d.lembur.toFixed(1)}</div>`:''}</div>
    </div>`;
  }).join('');
  return `
    <div class="mhead"><h2>Ringkasan HM &amp; Lembur</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:8px;">30 hari terakhir (bergerak mengikuti tanggal hari ini)</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px;padding:0 2px;">
      <span style="color:#4E7FE0;">HM &middot; total ${totalHm.toFixed(1)} j</span>
      <span style="color:#E8A33D;">Lembur &middot; total ${totalLembur.toFixed(1)} j</span>
    </div>
    <div style="max-height:60vh;overflow-y:auto;">${rows}</div>
  `;
}
function openBbmDetailModal(){
  window._bbmFilterBt = USER.mainBt;
  window._bbmShowSusulanForm = false;
  renderBbmDetailModal();
}
function renderBbmDetailModal(){
  const list = unitsForSelect().filter(u=>!u.isSystem);
  const filterBt = window._bbmFilterBt;
  const timeline = filterBt ? getTimelineIsiBBM(filterBt) : list.reduce((acc,u)=>acc.concat(getTimelineIsiBBM(u.id)),[]);
  const sorted = timeline.slice().sort((a,b)=>b.tanggal.localeCompare(a.tanggal) || (b.hm-a.hm));
  openModal(`
    <div class="mhead"><h2>Detail BBM</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;">
      <button class="pill-btn sm ${!filterBt?'':'outline'}" onclick="window._bbmFilterBt='';renderBbmDetailModal()">Semua</button>
      ${list.map(u=>`<button class="pill-btn sm ${filterBt===u.id?'':'outline'}" onclick="window._bbmFilterBt='${u.id}';renderBbmDetailModal()">${escapeHtml(u.kode)}</button>`).join('')}
    </div>
    ${sorted.length===0 ? `<div class="empty-note">Belum ada data isi BBM.</div>` : sorted.map(t=>`
      <div class="card" style="margin-bottom:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700;">${escapeHtml(btLabel(t.btId))} &middot; ${fmtLabel(t.tanggal)}${t.sumber==='susulan'?' <span style="background:var(--maroon);color:#fff;font-size:9px;padding:2px 6px;border-radius:6px;">SUSULAN</span>':''}</div>
          <div class="field-sub">HM ${t.hm} &middot; ${(t.bbmMl/1000).toFixed(1)} L${t.hmTerpakai!==null?' &middot; '+t.hmTerpakai.toFixed(1)+' jam sejak isi sebelumnya':''}</div>
        </div>
        ${t.sumber==='susulan'?`<button class="icon-btn" onclick="hapusBbmSusulan('${t.id}');renderBbmDetailModal()">${ic('trash')}</button>`:''}
      </div>
    `).join('')}
    <button class="pill-btn outline" style="width:100%;margin-top:6px;" onclick="window._bbmShowSusulanForm=true;renderBbmDetailModal()">+ Tambah Data Susulan</button>
    ${window._bbmShowSusulanForm ? renderSusulanForm() : ''}
  `);
}
function renderSusulanForm(){
  const list = unitsForSelect().filter(u=>!u.isSystem);
  const d = window._susulanDraft || (window._susulanDraft = {btId:list[0]?list[0].id:'', tanggal:todayIso(), hm:'', bbmMl:''});
  return `
    <div class="card" style="margin-top:10px;">
      <div style="font-weight:700;margin-bottom:8px;">Data Susulan</div>
      <label class="flabel">Unit BT</label>
      <select onchange="window._susulanDraft.btId=this.value">
        ${list.map(u=>`<option value="${u.id}" ${d.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}
      </select>
      <label class="flabel">Tanggal</label>
      <input type="date" value="${d.tanggal}" onchange="window._susulanDraft.tanggal=this.value">
      <label class="flabel">HM saat isi</label>
      <input type="text" inputmode="numeric" value="${escapeHtml(d.hm)}" oninput="this.value=fmtHmLive(this.value)" onchange="window._susulanDraft.hm=this.value">
      <label class="flabel">BBM (ml)</label>
      <input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(d.bbmMl))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="window._susulanDraft.bbmMl=stripDots(this.value)">
      <button class="btn-block" onclick="simpanSusulanDraft()">Simpan</button>
    </div>
  `;
}
function simpanSusulanDraft(){
  const d = window._susulanDraft;
  if(!d.btId || !d.tanggal || d.hm===''||d.hm==null || d.bbmMl===''||d.bbmMl==null){ toast('Lengkapi semua field'); return; }
  handleHmBaruInput(d.btId, d.tanggal, d.hm,
    ()=>{
      tambahBbmSusulan(d.btId, d.tanggal, d.hm, parseFloat(d.bbmMl)||0);
      window._susulanDraft = null;
      window._bbmShowSusulanForm = false;
      toast('Data susulan tersimpan');
      renderBbmDetailModal();
      renderBerandaIfActive();
    },
    ()=>{ renderBbmDetailModal(); }
  );
}
function openLiterJamDetailModal(){
  const units = unitsForSelect().filter(u=>!u.isSystem);
  // Poin 4: ranking cuma menampilkan 7 unit paling irit (Liter/Jam terendah ke
  // tertinggi) yang datanya sudah cukup dihitung — bukan semua unit.
  const ranking = units.map(u=>({u, r:hitungLiterPerJam(u.id)}))
    .filter(row=>row.r.cukupData)
    .sort((a,b)=>a.r.literPerJam-b.r.literPerJam)
    .slice(0,7);
  openModal(`
    <div class="mhead"><h2>Ranking Liter/Jam</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:8px;">7 unit paling irit (Liter/Jam terendah)</div>
    ${ranking.length===0 ? '<div class="empty-note">Belum ada unit dengan data cukup untuk ranking.</div>' : ''}
    ${ranking.map((row,i)=>`
      <div class="card" style="margin-bottom:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;">#${i+1} ${escapeHtml(row.u.kode)}${row.u.id===USER.mainBt?' <span style="background:var(--primary);color:#fff;font-size:9px;padding:2px 6px;border-radius:6px;">ANDA</span>':''}</div>
          <div class="field-sub">${row.r.cukupData ? row.r.totalLiter.toFixed(0)+' L &middot; '+row.r.totalHm.toFixed(1)+' jam' : 'Belum cukup data'}</div>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--primary);">${row.r.cukupData?row.r.literPerJam.toFixed(2):'-'}</div>
      </div>
    `).join('')}
  `);
}
/* Laman "Pencapaian Servis" (poin: progres servis untuk semua unit) — dibuka
 * dari tap kartu Progres Servis di beranda, menggantikan pintasan langsung ke
 * modal Servis unit utama. Menampilkan bar progres tiap unit terdaftar,
 * diurutkan dari yang paling mendekati/lewat jadwal servis di atas. Tap salah
 * satu unit membuka riwayat & catat servis untuk unit tersebut. */
function openPencapaianServisScreen(){
  const units = unitsForSelect().filter(u=>!u.isSystem);
  const rows = units.map(u=>{
    const svc = hmServiceStatus(u.id);
    const interval = serviceIntervalForBt(u.id);
    const info = svcStatusInfo(svc, interval);
    return {u, svc, interval, ...info};
  }).sort((a,b)=>{
    if(a.svc.sisa===null && b.svc.sisa===null) return 0;
    if(a.svc.sisa===null) return 1;
    if(b.svc.sisa===null) return -1;
    return b.svcPct-a.svcPct;
  });
  openModal(`
    <div class="mhead"><h2>Pencapaian Servis</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div class="field-sub" style="margin-bottom:10px;">Progres tiap unit menuju ambang batas servis masing-masing</div>
    ${rows.length===0 ? '<div class="empty-note">Belum ada unit terdaftar.</div>' : rows.map(row=>`
      <div class="card card-flat" style="margin-bottom:10px;cursor:pointer;" onclick="openServisModalForUnit('${row.u.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">${escapeHtml(row.u.kode)}${row.u.id===USER.mainBt?' <span style="background:var(--primary);color:#fff;font-size:9px;padding:2px 6px;border-radius:6px;">UTAMA</span>':''}</div>
          <span style="color:var(--on-surface-variant);font-size:15px;opacity:.5;">&rsaquo;</span>
        </div>
        ${row.svc.sisa===null ? `<div class="field-sub" style="margin-top:4px;">${row.svc.baseHm===null?'Belum ada catatan servis.':'Belum ada data HM saat ini.'}</div>` : `
          <div style="position:relative;background:var(--outline-variant);border-radius:100px;height:10px;margin-top:8px;overflow:hidden;">
            <div style="position:absolute;inset:0;background:linear-gradient(90deg, var(--success) 0%, var(--success) 80%, #E08900 80%, #E08900 95%, var(--maroon) 95%, var(--maroon) 100%);"></div>
            <div style="position:absolute;top:0;bottom:0;right:0;left:${Math.min(100, row.svcPct)}%;background:var(--outline-variant);"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="font-size:12px;font-weight:700;color:${row.statusColor};">${row.statusText}</span>
            <span class="field-sub">${row.svc.sisa.toFixed(1)} / ${row.interval} jam</span>
          </div>
        `}
      </div>
    `).join('')}
  `);
}
function renderBeranda(){
  const host = document.getElementById('screen-beranda');
  if(!USER.mainBt || UNITS.length===0){
    host.innerHTML = `<div class="card"><div class="empty-note">Selamat datang! Buka menu ${ic('menu')} &rarr; Pengaturan Akun &amp; Kelola No Unit dulu untuk mulai.</div></div>`;
    return;
  }
  const bt = USER.mainBt;
  const svc = hmServiceStatus(bt);
  const monthKey = todayIso().slice(0,7);
  const monthEntries = ENTRIES.filter(e=>e.date.startsWith(monthKey));
  const belumIsiHariIni = !ENTRIES.some(e=>e.date===todayIso() && e.btId===bt);
  const totalHmBulan = monthEntries.reduce((s,e)=>{ const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir); return s+((!isNaN(a)&&!isNaN(b)&&b>=a)?(b-a):0); },0);
  const totalLemburBulan = monthEntries.reduce((s,e)=>s+(parseFloat(e.lembur)||0),0);
  const allValid = ENTRIES.filter(e=>{ const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir); return !isNaN(a)&&!isNaN(b)&&b>=a; });
  const lifetimeHm = allValid.reduce((s,e)=>s+(parseFloat(e.hmAkhir)-parseFloat(e.hmAwal)),0);
  const lifetimeBbmMl = ENTRIES.reduce((s,e)=>s+(parseFloat(e.bbmLiter)||0),0);
  const lifetimeBbmL = lifetimeBbmMl/1000; // data mentah disimpan dalam ml, dikonversi ke liter untuk rasio
  const lifetimeRasio = lifetimeBbmL>0 ? (lifetimeHm/lifetimeBbmL) : null;
  const bbmBulan = monthEntries.reduce((s,e)=>s+(parseFloat(e.bbmLiter)||0),0)/1000; // ml -> liter
  const timelineBt = getTimelineIsiBBM(bt);
  const isiTerakhirBt = timelineBt.length ? timelineBt[timelineBt.length-1] : null;
  const hariSejakIsi = isiTerakhirBt ? Math.round((new Date(todayIso())-new Date(isiTerakhirBt.tanggal))/86400000) : null;
  const bbmBulanBt = timelineBt.filter(t=>t.tanggal.startsWith(monthKey)).reduce((s,t)=>s+t.bbmMl,0)/1000;
  const unitLainList = unitsForSelect().filter(u=>!u.isSystem && u.id!==bt);
  const bbmBulanLain = unitLainList.reduce((s,u)=>s+getTimelineIsiBBM(u.id).filter(t=>t.tanggal.startsWith(monthKey)).reduce((ss,t)=>ss+t.bbmMl,0),0)/1000;
  const literJam = hitungLiterPerJam(bt);

  // 15 hari terakhir (HM + Lembur, stacked)
  const days15 = [];
  for(let i=14;i>=0;i--){
    const d = new Date(todayIso()+'T00:00:00'); d.setDate(d.getDate()-i);
    const iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const e = ENTRIES.find(x=>x.date===iso);
    const a=e?parseFloat(e.hmAwal):NaN, b=e?parseFloat(e.hmAkhir):NaN;
    const hm = (!isNaN(a)&&!isNaN(b)&&b>=a)?(b-a):0;
    const lembur = e?(parseFloat(e.lembur)||0):0;
    days15.push({iso, hm, lembur});
  }
  const maxTotal15 = Math.max(1, ...days15.map(d=>d.hm+d.lembur));

  const recent = ENTRIES.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);

  let statusColor = 'var(--success)', statusText = 'Kondisi normal';
  let svcPct = 0;
  const svcInterval = serviceIntervalForBt(bt);
  ({statusColor, statusText, svcPct} = svcStatusInfo(svc, svcInterval));

  host.innerHTML = `
    <div class="card" style="background:var(--primary);color:#fff;border:none;">
      <div class="field-sub" style="color:rgba(255,255,255,.85);">${fmtLabel(todayIso())}</div>
      <div style="font-size:18px;font-weight:800;margin-top:2px;">${escapeHtml(USER.name||'Halo!')}</div>
    </div>

    ${belumIsiHariIni ? `
    <div class="card" style="background:var(--primary-container);border-color:var(--primary-container);display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="showScreen('hari')">
      <div style="background:#fff;border-radius:100px;width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--primary);">${ic('plus',18)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;color:var(--on-primary-container);font-size:14px;">Belum ada catatan hari ini</div>
        <div style="font-size:12px;color:var(--on-primary-container);opacity:.8;margin-top:1px;">Ketuk untuk isi HM &amp; BBM sekarang</div>
      </div>
      <div style="color:var(--on-primary-container);font-size:18px;opacity:.7;">&rsaquo;</div>
    </div>` : ''}

    <div class="section-eyebrow">Cuaca Hari Ini</div>
    <div style="display:flex;gap:10px;">
      ${['utara','selatan'].map(key=>{
        const w = WEATHER ? WEATHER[key] : null;
        const label = WEATHER_POINTS[key].label;
        if(!w){
          return `<div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;min-width:0;">
            <div class="field-sub">${weatherLoading?'Memuat…':label+' belum ada data'}</div>
            ${!weatherLoading?`<button class="pill-btn sm outline" onclick="fetchWeatherIfNeeded(true)">Muat Cuaca</button>`:''}
          </div>`;
        }
        const info = weatherInfo(w.repCode, w.repDesc);
        const curSlot = currentWeatherSlot(w.hours);
        const curInfo = curSlot ? weatherInfo(curSlot.code, curSlot.desc) : info;
        const bgTop = w.isRain ? 'background:rgba(179,38,30,0.12);' : '';
        const border = w.isRain ? 'border-color:#F0C4BE;' : '';
        const warnColor = w.isRain ? '#B3261E' : 'var(--success)';
        const warnText = w.isRain ? `${weatherInfo(w.repCode)[1]} ${w.rainKategori} sekitar ${jamLabel(w.rainHour)}` : 'Tidak ada potensi hujan';
        const subText = w.isRain ? `Curah hujan ${w.rainMm.toFixed(1)} mm (per 3 jam)` : `Curah hujan hari ini ${(w.precipSum||0).toFixed(1)} mm`;
        return `<div class="card" style="flex:1;padding:0;overflow:hidden;min-width:0;${border}">
          <div style="padding:14px 14px 10px;${bgTop}">
            <div style="font-size:11px;font-weight:700;color:${w.isRain?'#7A2618':'var(--on-surface-variant)'};text-transform:uppercase;letter-spacing:.05em;">${label}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <div style="font-size:26px;line-height:1;flex-shrink:0;">${curInfo[1]}</div>
              <div style="min-width:0;">
                <div style="font-weight:800;font-size:14px;">${curSlot&&curSlot.temp!==null?Math.round(curSlot.temp):'-'}&deg;<span style="font-weight:600;font-size:10px;color:var(--on-surface-variant);"> &middot; pukul ${curSlot?jamLabel(curSlot.hour):'-'}</span></div>
                <div style="font-size:11px;color:var(--on-surface-variant);">${escapeHtml(curInfo[0])}</div>
                <div style="font-size:10px;color:var(--on-surface-variant);margin-top:1px;">Min/Maks hari ini: ${w.tmin!==null?Math.round(w.tmin):'-'}&deg;/${w.tmax!==null?Math.round(w.tmax):'-'}&deg;</div>
              </div>
            </div>
            <div style="margin-top:8px;">
              <div style="font-size:11px;font-weight:800;color:${warnColor};">${warnText}</div>
              <div style="font-size:10px;color:var(--on-surface-variant);margin-top:1px;">${subText}</div>
            </div>
          </div>
          <div style="padding:10px 14px 12px;">
            <button class="pill-btn sm outline" style="width:100%;" onclick="openWeatherDetailModal('${key}')">Detail per jam</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;font-size:10px;color:var(--on-surface-variant);margin:2px 2px 8px;">
      <span>${WEATHER?`Diperbarui ${new Date(WEATHER.ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`:''} &middot; sumber ${WEATHER_SOURCE_LABEL}</span>
      ${!weatherLoading?`<button class="icon-btn" style="width:22px;height:22px;" title="Refresh cuaca" onclick="fetchWeatherIfNeeded(true)">${ic('sync',14)}</button>`:''}
    </div>

    <div class="section-eyebrow">Progres Servis</div>
    <div style="display:flex;gap:10px;align-items:stretch;">
      <div class="card" style="flex:1.3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;position:relative;cursor:pointer;" onclick="openPencapaianServisScreen()">
        <span style="position:absolute;top:10px;right:10px;color:var(--on-surface-variant);font-size:15px;opacity:.5;">&rsaquo;</span>
        ${svc.sisa===null ? `<div class="empty-note">${svc.baseHm===null?'Belum ada catatan servis.':'Belum ada data HM saat ini.'}</div>` : `
          <div style="position:relative;width:92px;height:92px;flex-shrink:0;">
            <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg);">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--outline-variant)" stroke-width="12"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="${statusColor}" stroke-width="12"
                stroke-linecap="round"
                stroke-dasharray="${(2*Math.PI*42*svcPct/100).toFixed(1)} ${(2*Math.PI*42).toFixed(1)}"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
              <div style="font-size:19px;font-weight:800;color:${statusColor};">${svcPct.toFixed(0)}%</div>
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-weight:700;color:${statusColor};">${statusText}</div>
            <div class="field-sub" style="margin-top:2px;">${svc.sisa.toFixed(1)} / ${svcInterval} jam</div>
          </div>
        `}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
        <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;cursor:pointer;" onclick="openRingkasanHmLembur()">
          <div class="field-sub">Overtime</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:var(--primary);opacity:.65;">${ic('hourglass',24)}</span><span style="font-size:18px;font-weight:800;">${totalLemburBulan.toFixed(1)} j</span></div>
          <div style="font-size:10px;color:var(--on-surface-variant);font-weight:600;margin-top:1px;">Bulan ini</div>
        </div>
        <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;cursor:pointer;" onclick="openLiterJamDetailModal()">
          <div class="field-sub">Liter/Jam</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:var(--primary);opacity:.65;">${ic('sync',24)}</span><span style="font-size:18px;font-weight:800;">${literJam.cukupData?literJam.literPerJam.toFixed(2):'-'}</span></div>
          <div style="font-size:10px;color:var(--on-surface-variant);font-weight:600;margin-top:1px;">Lifetime &middot; makin kecil makin hemat</div>
        </div>
      </div>
    </div>

    <div class="section-eyebrow">Ringkasan</div>
    <div class="grid2">
      <div class="card" style="cursor:pointer;" onclick="openBbmDetailModal()"><div class="field-sub">Total BBM</div><div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:var(--primary);opacity:.65;">${ic('truck',26)}</span><span style="font-size:20px;font-weight:800;">${fmtThousandsLive(String(Math.round(bbmBulanBt+bbmBulanLain)))} L</span></div><div style="font-size:10px;color:var(--on-surface-variant);font-weight:600;margin-top:1px;">${btLabel(bt)} ${bbmBulanBt.toFixed(0)}L &middot; lain ${bbmBulanLain.toFixed(0)}L${hariSejakIsi!==null?' &middot; isi '+hariSejakIsi+'h lalu':''}</div></div>
      <div class="card" style="cursor:pointer;" onclick="openRingkasanHmLembur()"><div class="field-sub">Total HM</div><div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:var(--primary);opacity:.65;">${ic('gear',26)}</span><span style="font-size:20px;font-weight:800;">${totalHmBulan.toFixed(1)}</span></div><div style="font-size:10px;color:var(--on-surface-variant);font-weight:600;margin-top:1px;">Bulan ini</div></div>
    </div>

    <div class="section-eyebrow section-eyebrow-row">HM &amp; Lembur 15 Hari Terakhir
      <span style="display:flex;align-items:center;gap:10px;font-size:12px;font-weight:600;color:var(--on-surface-variant);">
        <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:2px;background:#4E7FE0;display:inline-block;"></span>HM</span>
        <span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:2px;background:#E8A33D;display:inline-block;"></span>Lembur</span>
      </span>
    </div>
    <div class="card">
      <div style="display:flex;align-items:flex-end;gap:3px;height:90px;">
        ${days15.map(d=>{
          const hmH = Math.max(d.hm>0?4:0, d.hm/maxTotal15*70);
          const lemburH = Math.max(d.lembur>0?4:0, d.lembur/maxTotal15*70);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;display:flex;flex-direction:column-reverse;">
            <div style="width:100%;background:#4E7FE0;border-radius:${d.lembur>0?'0':'4px 4px'} 0 0;height:${hmH}px;"></div>
            ${d.lembur>0?`<div style="width:100%;background:#E8A33D;border-radius:4px 4px 0 0;height:${lemburH}px;"></div>`:''}
          </div>
          <div class="field-sub" style="font-size:10.5px;">${d.iso.slice(8,10)}</div>
        </div>`;}).join('')}
      </div>
    </div>

    <div class="section-eyebrow">Log Terakhir</div>
    <div class="card" style="padding:12px 8px;">
      ${recent.length===0 ? '<div class="empty-note">Belum ada catatan.</div>' :
        recent.map(e=>{
          const a=parseFloat(e.hmAwal), b=parseFloat(e.hmAkhir);
          const hmUsed = (!isNaN(a)&&!isNaN(b)&&b>=a) ? (b-a).toFixed(1) : '-';
          const d = new Date(e.date+'T00:00:00');
          const shortDate = d.getDate()+'-'+(d.getMonth()+1)+'-'+String(d.getFullYear()).slice(2);
          return `<div class="field-sub" style="font-size:12.5px;display:grid;grid-template-columns:1.1fr 0.9fr 0.9fr 0.9fr 1.3fr;gap:4px;padding:9px 4px;border-bottom:1px solid var(--outline-variant);">
            <span>${shortDate}</span><span>${escapeHtml(btLabel(e.btId))}</span><span>${hmUsed}j</span><span>${escapeHtml(e.lembur||'0')}j OT</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(entryTipeLabel(e))}</span>
          </div>`;
        }).join('')}
    </div>
  `;
}
function toggleEditRow(id){
  expandedRowId = (expandedRowId===id) ? null : id;
  renderRekap();
}
function selectWithCustomEdit(entryId, fieldKey, list, currentVal){
  return `<select onchange="handleEditSelectCustom('${entryId}','${fieldKey}', this.value)">
    <option value="">- Pilih -</option>
    ${list.map(v=>`<option value="${escapeHtml(v)}" ${currentVal===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}
    <option value="__custom__">+ Lainnya (tulis sendiri)...</option>
  </select>`;
}
function handleEditSelectCustom(entryId, fieldKey, val){
  if(val==='__custom__'){
    const typed = prompt('Ketik nilai baru:');
    if(!typed){ expandedRowId=entryId; renderRekap(); return; }
    if(fieldKey==='jenisLayanan'){ if(!JENIS_LAYANAN_LIST.includes(typed)){ JENIS_LAYANAN_LIST.push(typed); saveJenisList(); } }
    else if(fieldKey==='tipeAntar'){ if(!TIPE_ANTAR_LIST.includes(typed)){ TIPE_ANTAR_LIST.push(typed); saveTipeAntarList(); } }
    else if(fieldKey==='kegiatan'){ if(!KEGIATAN_LIST.includes(typed)){ KEGIATAN_LIST.push(typed); saveKegiatanList(); } }
    else if(fieldKey==='muatTipe'){ if(!MUAT_TIPE_LIST.includes(typed)){ MUAT_TIPE_LIST.push(typed); saveMuatTipeList(); } }
    else if(fieldKey==='droneJenis'){ if(!DRONE_JENIS_LIST.includes(typed)){ DRONE_JENIS_LIST.push(typed); saveDroneJenisList(); } }
    else if(fieldKey==='shift'){ if(!SHIFT_LIST.includes(typed)){ SHIFT_LIST.push(typed); saveShiftList(); } }
    editEntryField(entryId, fieldKey, typed);
  } else {
    editEntryField(entryId, fieldKey, val);
  }
}
function editEntryField(entryId, key, val){
  const idx = ENTRIES.findIndex(x=>x.id===entryId); if(idx<0) return;
  if(key==='hmAwal' || key==='hmAkhir'){
    val = val===''?'':parseFloat(val).toFixed(1);
  }
  ENTRIES[idx][key] = val;
  recomputeLemburIfNeeded(ENTRIES[idx], key);
  saveEntries();
  toast('Tersimpan');
  expandedRowId = entryId;
  renderRekap();
}
/* Pembungkus khusus HM Akhir saat edit baris di Rekap (poin 1): sama seperti
 * onHmAkhirChangeQf() di masterdata.js, tapi commit-nya lewat editEntryField(). */
function onHmAkhirChangeEdit(entryId, el){
  const entry = ENTRIES.find(x=>x.id===entryId); if(!entry) return;
  const prevVal = entry.hmAkhir;
  const newVal = el.value;
  handleHmBaruInput(entry.btId, entry.date, newVal,
    ()=>{ editEntryField(entryId, 'hmAkhir', newVal); checkHmWarning(entryId); },
    ()=>{ el.value = prevVal; checkHmWarning(entryId); }
  );
}
function toggleSecondaryFlag(entryId){
  const idx = ENTRIES.findIndex(x=>x.id===entryId); if(idx<0) return;
  const e = ENTRIES[idx];
  if(e.isSecondary){
    e.isSecondary = false;
    if(!e.istMulai) e.istMulai = '11.00';
    if(!e.istSelesai) e.istSelesai = '13.30';
    if(e.istirahat===undefined) e.istirahat = true;
    toast('Dijadikan entri utama — isi Absen supaya lembur terhitung otomatis');
  } else {
    e.isSecondary = true;
    e.absenBerangkat = '';
    e.absenPulang = '';
    toast('Dijadikan entri tambahan — Absen dikosongkan, isi Jam Lembur manual');
  }
  saveEntries();
  expandedRowId = entryId;
  renderRekap();
}
function deleteRow(id){
  if(!confirm('Hapus entri ini?')) return;
  ENTRIES = ENTRIES.filter(x=>x.id!==id);
  saveEntries();
  toast('Entri dihapus');
  renderRekap();
}
function missingDays(){
  const today = todayIso();
  const dates = new Set(ENTRIES.map(e=>e.date));
  const days = [];
  for(let i=1;i<=30;i++){
    const d = new Date(today+'T00:00:00'); d.setDate(d.getDate()-i);
    const iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(!dates.has(iso)) days.push(iso);
  }
  return days;
}
function findDuplicateDates(){
  const count = {};
  ENTRIES.forEach(e=>{ const k=e.date+'|'+e.btId; count[k]=(count[k]||0)+1; });
  return new Set(Object.keys(count).filter(k=>count[k]>1));
}
function openBackfill(dateIso){
  if(!USER.mainBt || UNITS.length===0){ toast('Isi Pengaturan Akun & Kelola No Unit dulu'); return; }
  const alreadyHasEntry = ENTRIES.some(x=>x.date===dateIso);
  const e = {id:uid(), date:dateIso, btId:USER.mainBt, hmAwal:'', hmAkhir:'', bbmLiter:'', lembur:'', catatan:'',
    jenisLayanan:'', tipeAntar:'', kegiatan:'', muatTipe:'', tonaseKg:'', lokasi:'', lokasiMuat:'', lokasiBongkar:'',
    droneJenis:'', shift:''};
  if(alreadyHasEntry){
    e.isSecondary = true;
  } else {
    e.absenBerangkat = ''; e.absenPulang = ''; e.istirahat = true; e.istMulai = '11.00'; e.istSelesai = '13.30'; e.liburMerah = false;
  }
  ENTRIES.push(e);
  saveEntries();
  toast(alreadyHasEntry ? 'Baris baru ditambahkan (tanpa absen, karena tanggal ini sudah ada entri lain)' : 'Baris baru ditambahkan, silakan diisi');
  expandedRowId = e.id;
  showScreen('rekap');
}
/* ================= REKAP (Rekap Pribadi) =================
 * Tab bottom-nav "Rekap": histori ENTRIES milik Han sendiri.
 * Program Kerja (modul terpisah, lihat KONSEP-PROGRAM-KERJA.md) kini
 * punya tab tersendiri "Proker" — lihat program-kerja.js / renderProker(). */
function renderRekap(){
  const host = document.getElementById('screen-rekap');
  host.innerHTML = renderRekapPribadiHtml();
}
function renderRekapPribadiHtml(){
  const missing = missingDays();
  const dupDates = findDuplicateDates();
  const sorted = ENTRIES.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div style="position:sticky;top:0;z-index:5;background:var(--surface);padding-top:1px;margin:0 -16px;padding-left:16px;padding-right:16px;">
      <button class="btn-block" onclick="openExportSheet()">${ic('download')} Export Laporan</button>

      ${missing.length>0 ? `
      <div class="section-eyebrow">Belum Diisi (30 Hari Terakhir)</div>
      <div class="card" style="border-color:var(--primary);">
        <div class="field-sub" style="margin-bottom:8px;">Tap tanggal untuk isi cepat.</div>
        <div style="display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;padding-bottom:2px;">
          ${missing.map(d=>`<button class="chip" style="flex:0 0 auto;" onclick="openBackfill('${d}')">${fmtLabel(d).split(', ')[1]}</button>`).join('')}
        </div>
      </div>` : ''}
      <div style="height:10px;"></div>
    </div>

    <div class="section-eyebrow section-eyebrow-row">Riwayat Lengkap<button class="pill-btn sm" onclick="openBackfill(todayIso())">+ Tambah</button></div>
    ${sorted.length===0 ? '<div class="card"><div class="empty-note">Belum ada riwayat.</div></div>' :
      sorted.map(e=>{
        const isDup = dupDates.has(e.date+'|'+e.btId);
        return `
        <div class="card" style="${isDup?'border-color:var(--danger);':''}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <button class="icon-btn" style="flex-shrink:0;padding:4px;" onclick="toggleEditRow('${e.id}')" aria-label="Edit">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;">${fmtLabel(e.date)}</div>
              <div class="field-sub">${escapeHtml(btLabel(e.btId))}${e.jenisLayanan?' &middot; '+escapeHtml(entryTipeLabel(e)):''} &middot; HM ${escapeHtml(e.hmAwal||'-')}&rarr;${escapeHtml(e.hmAkhir||'-')} &middot; ${escapeHtml(fmtThousandsLive(e.bbmLiter||'0'))} ml</div>
              ${isDup?'<div class="field-sub" style="color:var(--danger);font-weight:700;">'+ic('warning')+' Ada entri lain di tanggal &amp; unit yang sama</div>':''}
            </div>
          </div>
          <div id="editrow-${e.id}" style="display:${expandedRowId===e.id?'block':'none'};margin-top:12px;">
            ${isSystemUnitId(e.btId) ? `
            <div class="grid2">
              <div><label class="flabel">No Unit</label><select onchange="editEntryField('${e.id}','btId',this.value)">${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}</select></div>
              <div><label class="flabel">Tanggal</label><input type="date" value="${e.date}" onchange="editEntryField('${e.id}','date',this.value)"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn-block" style="flex:1;" onclick="toggleEditRow('${e.id}')">Selesai</button>
              <button class="pill-btn outline" onclick="deleteRow('${e.id}')">Hapus</button>
            </div>
            ` : `
            <div class="grid2">
              <div><label class="flabel">No Unit</label><select onchange="editEntryField('${e.id}','btId',this.value)">${unitsForSelect().map(u=>`<option value="${u.id}" ${e.btId===u.id?'selected':''}>${escapeHtml(u.kode)}</option>`).join('')}</select></div>
              <div><label class="flabel">Tanggal</label><input type="date" value="${e.date}" onchange="editEntryField('${e.id}','date',this.value)"></div>
            </div>
            <button class="pill-btn sm outline" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="toggleSecondaryFlag('${e.id}')">${e.isSecondary ? ic('splitback')+' Jadikan Entri Utama (pakai absen)' : ic('splitfwd')+' Jadikan Entri Tambahan (tanpa absen, lembur manual)'}</button>

            <div class="section-eyebrow" style="margin-top:8px;">Jenis Layanan</div>
            <label class="flabel">Jenis Layanan</label>
            ${selectWithCustomEdit(e.id,'jenisLayanan', JENIS_LAYANAN_LIST, e.jenisLayanan)}

            ${e.jenisLayanan==='Antar/Jemput Tenaga' ? `
              <div class="grid2" style="margin-top:8px;">
                <div><label class="flabel">Tipe</label>${selectWithCustomEdit(e.id,'tipeAntar', TIPE_ANTAR_LIST, e.tipeAntar)}</div>
                <div><label class="flabel">Kegiatan</label>${selectWithCustomEdit(e.id,'kegiatan', KEGIATAN_LIST, e.kegiatan)}</div>
              </div>
              <label class="flabel">Lokasi</label>
              <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="editEntryField('${e.id}','lokasi',this.value)">
            ` : ''}

            ${e.jenisLayanan==='Muat Tebu' ? `
              <div style="margin-top:8px;"><label class="flabel">Tipe</label>${selectWithCustomEdit(e.id,'muatTipe', MUAT_TIPE_LIST, e.muatTipe)}</div>
              ${e.muatTipe==='Produksi' ? `
                <label class="flabel">Tonase (kg)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.tonaseKg))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="editEntryField('${e.id}','tonaseKg',stripDots(this.value))">
                <label class="flabel">Lokasi</label>
                <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="editEntryField('${e.id}','lokasi',this.value)">
              ` : ''}
              ${e.muatTipe==='Bibit' ? `
              <div class="grid2">
                <div><label class="flabel">Lokasi Muat</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiMuat)}" onchange="editEntryField('${e.id}','lokasiMuat',this.value)"></div>
                <div><label class="flabel">Lokasi Bongkar</label><input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasiBongkar)}" onchange="editEntryField('${e.id}','lokasiBongkar',this.value)"></div>
              </div>` : ''}
            ` : ''}

            ${e.jenisLayanan==='Drone' ? `
              <div style="margin-top:8px;"><label class="flabel">Jenis Drone</label>${selectWithCustomEdit(e.id,'droneJenis', DRONE_JENIS_LIST, e.droneJenis)}</div>
              <label class="flabel">Lokasi</label>
              <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="editEntryField('${e.id}','lokasi',this.value)">
            ` : ''}

            ${e.jenisLayanan==='Operator' ? `
              <div style="margin-top:8px;"><label class="flabel">Shift</label>${selectWithCustomEdit(e.id,'shift', SHIFT_LIST, e.shift)}</div>
              <label class="flabel">Lokasi</label>
              <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="editEntryField('${e.id}','lokasi',this.value)">
            ` : ''}
            ${e.jenisLayanan && !['Antar/Jemput Tenaga','Muat Tebu','Drone','Operator'].includes(e.jenisLayanan) ? `
              <label class="flabel">Lokasi</label>
              <input type="text" list="lokasiSuggest" oninput="onLokasiInput(this)" onfocus="onLokasiFocus(this)" value="${escapeHtml(e.lokasi)}" onchange="editEntryField('${e.id}','lokasi',this.value)">
            ` : ''}

            ${!e.isSecondary ? `
            <div class="section-eyebrow" style="margin-top:8px;">Absen &amp; Istirahat</div>
            <div class="grid2">
              <div><label class="flabel">Absen Berangkat</label><input type="time" value="${escapeHtml(e.absenBerangkat)}" onchange="editEntryField('${e.id}','absenBerangkat',this.value)"></div>
              <div><label class="flabel">Absen Pulang</label><input type="time" value="${escapeHtml(e.absenPulang)}" onchange="editEntryField('${e.id}','absenPulang',this.value)"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button class="chip ${e.istirahat?'active':''}" onclick="editEntryField('${e.id}','istirahat',true)">${ic('coffee')} Istirahat</button>
              <button class="chip ${!e.istirahat?'active':''}" onclick="editEntryField('${e.id}','istirahat',false)">${ic('hourglass')} Lembur</button>
            </div>
            ${e.istirahat ? `
            <div class="grid2" style="margin-top:8px;">
              <div><label class="flabel">Istirahat Mulai</label><input type="text" inputmode="numeric" value="${escapeHtml(e.istMulai)}" placeholder="11.00" oninput="this.value=fmtJamTitikLive(this.value)" onchange="editEntryField('${e.id}','istMulai',this.value)"></div>
              <div><label class="flabel">Istirahat Selesai</label><input type="text" inputmode="numeric" value="${escapeHtml(e.istSelesai)}" placeholder="13.30" oninput="this.value=fmtJamTitikLive(this.value)" onchange="editEntryField('${e.id}','istSelesai',this.value)"></div>
            </div>` : ''}
            <div class="chk-row" style="margin-top:8px;"><input type="checkbox" id="ed-liburMerah-${e.id}" ${e.liburMerah?'checked':''} onchange="editEntryField('${e.id}','liburMerah',this.checked)"><label for="ed-liburMerah-${e.id}" style="margin-left:6px;">${ic('calendar')} Tanggal Merah / Libur Nasional</label></div>
            ` : `
            <div class="field-sub" style="margin-top:10px;">Ini entri tambahan (tanggal ini sudah ada entri lain) — tanpa absen otomatis, Jam Lembur di bawah diisi manual.</div>
            `}

            <div class="section-eyebrow" style="margin-top:8px;">Hour Meter &amp; BBM</div>
            <div class="grid2">
              <div><label class="flabel">HM Awal</label><input type="text" inputmode="numeric" id="ed-hmA-${e.id}" value="${escapeHtml(e.hmAwal)}" oninput="this.value=fmtHmLive(this.value)" onchange="editEntryField('${e.id}','hmAwal',this.value);checkHmWarning('${e.id}')"></div>
              <div><label class="flabel">HM Akhir</label><input type="text" inputmode="numeric" id="ed-hmB-${e.id}" class="${hmBad(e)?'field-error':''}" value="${escapeHtml(e.hmAkhir)}" oninput="this.value=fmtHmLive(this.value)" onchange="onHmAkhirChangeEdit('${e.id}', this)"></div>
              <div class="full" id="ed-hmWarning-${e.id}">${hmBad(e)?'<div class="field-sub" style="color:var(--danger);">'+ic('warning')+' HM Akhir lebih kecil dari HM Awal.</div>':''}</div>
              <div><label class="flabel">BBM (ml)</label><input type="text" inputmode="numeric" value="${escapeHtml(fmtThousandsLive(e.bbmLiter))}" oninput="this.value=fmtThousandsLive(this.value)" onchange="editEntryField('${e.id}','bbmLiter',stripDots(this.value))"></div>
              <div><label class="flabel">Jam Lembur</label><input type="text" value="${escapeHtml(e.lembur)}" onchange="editEntryField('${e.id}','lembur',this.value)"></div>
            </div>
            <label class="flabel">Catatan</label>
            <textarea rows="2" onchange="editEntryField('${e.id}','catatan',this.value)">${escapeHtml(e.catatan)}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn-block" style="flex:1;" onclick="toggleEditRow('${e.id}')">Selesai</button>
              <button class="pill-btn outline" onclick="deleteRow('${e.id}')">Hapus</button>
            </div>
            `}
          </div>
        </div>`;
      }).join('')}
  `;
}

