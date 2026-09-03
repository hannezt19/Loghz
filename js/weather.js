/* ================= CUACA HARI INI (BMKG - data resmi Indonesia, gratis tanpa API key) =================
 * v1.0.34: pindah dari Open-Meteo ke BMKG (data.bmkg.go.id) supaya lebih akurat untuk
 * wilayah Indonesia. BMKG TIDAK menerima koordinat lat/lon — lokasi ditentukan lewat
 * KODE WILAYAH tingkat 4 (kelurahan/desa) sesuai Kepmendagri 100.1.1-6117/2022.
 * Ganti kode di bawah ini jika titik representatif kebun berubah/pindah desa.
 * Cara cari kode wilayah baru: https://www.emsifa.com/api-wilayah-indonesia/ (utk nama
 * wilayah) lalu cocokkan ke https://data.bmkg.go.id/prakiraan-cuaca/ (utk format adm4).
 * WAJIB (syarat BMKG): tetap tampilkan "Sumber: BMKG" di UI & laporan — lihat
 * WEATHER_SOURCE_LABEL di bawah, dipakai di beranda-rekap.js & laporan-backup.js. */
const WEATHER_POINTS = {
  utara:   { label:'Wilayah Utara',   adm4:'18.02.13.2001' },
  selatan: { label:'Wilayah Selatan', adm4:'18.02.13.2003' }
};
const WEATHER_SOURCE_LABEL = 'BMKG';
const WEATHER_MAX_AGE = 30*60*1000; // 30 menit (BMKG membatasi 60 request/menit/IP, jadi ini masih sangat aman)
let WEATHER = LS.get('v2_weather_cache', null); // {ts, utara:{...}, selatan:{...}}
let WEATHER_LOG = LS.get('v2_weather_log', []); // [{date, utara:{...}, selatan:{...}}]
let weatherLoading = false;
let weatherLastError = null; // pesan error fetch terakhir, null kalau update terakhir berhasil
function saveWeatherLog(){ LS.set('v2_weather_log', WEATHER_LOG); }
/* Kode cuaca BMKG (field "weather" di respons API) — BEDA dari kode WMO yang dipakai
 * Open-Meteo dulu. Referensi resmi: https://data.bmkg.go.id/prakiraan-cuaca/
 * Beberapa dataset BMKG lain (mis. CSV per-kecamatan) memakai varian +100 untuk kode
 * yang sama (0/100, 1/101, dst) — normalizeBmkgCode() menangani keduanya sekaligus
 * supaya kalau suatu saat endpoint berubah varian, mapping ini tidak ikut rusak. */
const BMKG_WEATHER_MAP = {
  0:['Cerah','☀️'], 1:['Cerah Berawan','🌤️'], 2:['Cerah Berawan','🌤️'],
  3:['Berawan','☁️'], 4:['Berawan Tebal','☁️'],
  5:['Udara Kabur','🌫️'], 10:['Asap','🌫️'], 45:['Kabut','🌫️'],
  60:['Hujan Ringan','🌦️'], 61:['Hujan Sedang','🌧️'], 63:['Hujan Lebat','🌧️'],
  80:['Hujan Lokal','🌧️'], 95:['Hujan Petir','⛈️'], 97:['Hujan Petir','⛈️']
};
function normalizeBmkgCode(code){
  if(code===null || code===undefined || code==='') return null;
  const n = Number(code);
  if(isNaN(n)) return null;
  return n>=100 ? n-100 : n;
}
function weatherInfo(code, descFallback){
  const n = normalizeBmkgCode(code);
  const found = BMKG_WEATHER_MAP[n];
  if(found) return found;
  // Kode tidak dikenali (BMKG kadang pakai kode di luar dokumentasi publik) -
  // pakai teks asli dari BMKG (weather_desc) kalau tersedia, jangan tampilkan "Tidak Diketahui".
  return [descFallback || 'Tidak Diketahui', '🌡️'];
}
/* Kategori kondisi cuaca untuk kolom Kondisi di cetak PDF (5 kategori) - dipakai bareng
 * oleh weatherCategoryLabel() di peta.js untuk menampilkan teks singkat.
 * descFallback: teks weather_desc asli dari BMKG, dipakai untuk menebak kategori kalau
 * kode angkanya tidak dikenali (lihat komentar weatherInfo() di atas). */
function weatherIconCategory(code, descFallback){
  const n = normalizeBmkgCode(code);
  if(n===0 || n===1 || n===2) return 'cerah';
  if(n===3 || n===4 || n===5 || n===10 || n===45) return 'berawan';
  if(n===60 || n===61) return 'hujan_ringan';
  if(n===63 || n===80) return 'hujan_lebat';
  if(n===95 || n===97) return 'badai';
  if(descFallback){
    const d = descFallback.toLowerCase();
    if(d.includes('petir')) return 'badai';
    if(d.includes('lebat')) return 'hujan_lebat';
    if(d.includes('hujan')) return 'hujan_ringan';
    if(d.includes('cerah') && !d.includes('berawan')) return 'cerah';
  }
  return 'berawan';
}
function jamLabel(h){ return String(h).padStart(2,'0')+'.00'; }
/* Cari slot data (dari w.hours) yang jamnya PALING DEKAT dengan jam sekarang
 * (real-time, dihitung ulang tiap kali dipanggil — BUKAN disimpan di cache).
 * Dipakai supaya ikon & suhu utama di kartu Cuaca Hari Ini selalu mengikuti
 * jam berjalan, terpisah dari "rep" (slot terpanas/hujan terderas) yang
 * dipakai untuk baris peringatan di bawahnya. */
function currentWeatherSlot(hours){
  if(!hours || !hours.length) return null;
  const nowHour = new Date().getHours();
  return hours.reduce((best,s)=> Math.abs(s.hour-nowHour) < Math.abs(best.hour-nowHour) ? s : best, hours[0]);
}
/* Titik Embun (Dew Point) - rumus Magnus, dihitung manual karena BMKG tidak
 * menyediakan field ini langsung (beda dari Open-Meteo dulu yang punya dew_point_2m). */
function hitungTitikEmbun(tempC, humidity){
  if(tempC===null || tempC===undefined || humidity===null || humidity===undefined || humidity<=0) return null;
  const a=17.27, b=237.7;
  const alpha = ((a*tempC)/(b+tempC)) + Math.log(humidity/100);
  return (b*alpha)/(a-alpha);
}
/* Suhu Terasa (Apparent Temperature) - rumus Steadman/BOM, dihitung manual karena
 * BMKG tidak menyediakan field ini langsung. windKmh dikonversi ke m/s di dalam rumus. */
function hitungSuhuTerasa(tempC, humidity, windKmh){
  if(tempC===null || tempC===undefined || humidity===null || humidity===undefined) return null;
  const e = (humidity/100) * 6.105 * Math.exp((17.27*tempC)/(237.7+tempC));
  const windMs = (windKmh||0)/3.6;
  return tempC + 0.33*e - 0.70*windMs - 4.0;
}
/* Kode cuaca yang dianggap "hujan" (dipakai buat nentuin isRain & wakil/representative slot).
 * Dicek pakai normalizeBmkgCode() supaya varian +100 ikut tercakup. */
const BMKG_RAIN_CODES = [60,61,63,80,95,97];
function isKodeHujan(code){
  const n = normalizeBmkgCode(code);
  return n!==null && BMKG_RAIN_CODES.includes(n);
}
/* Ambil & ringkas data 1 wilayah dari respons BMKG (data.cuaca = array 3 hari,
 * tiap hari berisi beberapa slot per-3-jam). Hanya slot HARI INI yang dipakai,
 * sisanya (H+1, H+2) diabaikan supaya perilaku sama seperti sebelumnya. */
function ringkasCuacaWilayah(data){
  const allSlots = [].concat.apply([], data.cuaca || []);
  const todayStr = todayIso();
  const slotsToday = allSlots.map(raw=>{
    const dt = raw.local_datetime || raw.datetime || '';
    return {
      dateStr: dt.slice(0,10),
      hour: parseInt(dt.slice(11,13),10),
      code: raw.weather,
      desc: raw.weather_desc || raw.weather_desc_en || null,
      t: (raw.t!==undefined && raw.t!==null) ? raw.t : null,
      hu: (raw.hu!==undefined && raw.hu!==null) ? raw.hu : null,
      ws: (raw.ws!==undefined && raw.ws!==null) ? raw.ws : null, // km/jam
      windDir: (raw.wd_deg!==undefined && raw.wd_deg!==null) ? raw.wd_deg : null,
      cloud: (raw.tcc!==undefined && raw.tcc!==null) ? raw.tcc : null,
      precipMm: (raw.tp!==undefined && raw.tp!==null) ? raw.tp : null, // curah hujan per slot 3 jam
      visibility: (raw.vs!==undefined && raw.vs!==null) ? raw.vs : null // meter
    };
  }).filter(s=>s.dateStr===todayStr && !isNaN(s.hour)).sort((a,b)=>a.hour-b.hour);

  // Wakil (representative) slot hari ini: kalau ada hujan, ambil slot hujan dengan
  // curah tertinggi; kalau tidak ada hujan sama sekali, ambil slot dengan suhu tertinggi.
  const rainSlots = slotsToday.filter(s=>isKodeHujan(s.code));
  const isRain = rainSlots.length > 0;
  let rep = null;
  if(isRain){
    rep = rainSlots.reduce((best,s)=> (s.precipMm||0) > (best.precipMm||0) ? s : best, rainSlots[0]);
  } else if(slotsToday.length){
    rep = slotsToday.reduce((best,s)=> (s.t!==null && s.t > (best.t===null?-999:best.t)) ? s : best, slotsToday[0]);
  }
  const repDesc = rep ? (rep.desc || weatherInfo(rep.code)[0]) : '-';

  const tVals = slotsToday.map(s=>s.t).filter(v=>v!==null);
  const tmax = tVals.length ? Math.max(...tVals) : null;
  const tmin = tVals.length ? Math.min(...tVals) : null;

  const huVals = slotsToday.map(s=>s.hu).filter(v=>v!==null);
  const humidityAvg = huVals.length ? huVals.reduce((a,b)=>a+b,0)/huVals.length : null;

  const wsVals = slotsToday.map(s=>s.ws).filter(v=>v!==null);
  const windAvg = wsVals.length ? wsVals.reduce((a,b)=>a+b,0)/wsVals.length : null;
  const windMaxSpeed = wsVals.length ? Math.max(...wsVals) : null; // pengganti "gust" (BMKG tidak punya data hembusan puncak, ini kecepatan tertinggi tercatat)

  /* Angin rata-rata harian: arah dirata-rata pakai komponen vektor (sin/cos) supaya
   * tidak salah (mis. rata-rata 350° & 10° harus ~0°, bukan 180°), dibobot kecepatan. */
  let windDirAvg = null;
  const windDirData = slotsToday.filter(s=>s.windDir!==null && s.ws!==null);
  if(windDirData.length){
    let sx=0, sy=0;
    windDirData.forEach(s=>{ const rad=s.windDir*Math.PI/180; const w=Math.max(s.ws,0.1); sx += Math.cos(rad)*w; sy += Math.sin(rad)*w; });
    let deg = Math.atan2(sy,sx)*180/Math.PI;
    if(deg<0) deg += 360;
    windDirAvg = deg;
  }

  const precipSum = slotsToday.reduce((sum,s)=>sum+(s.precipMm||0), 0);

  /* Rincian tiap slot hari ini (dipakai layar Detail Cuaca). Suhu Terasa & Titik Embun
   * dihitung manual (lihat komentar fungsinya) karena BMKG tidak menyediakan langsung. */
  const hours = slotsToday.map(s=>({
    hour: s.hour,
    temp: s.t,
    feels: hitungSuhuTerasa(s.t, s.hu, s.ws),
    code: s.code,
    desc: s.desc,
    precipMm: s.precipMm,
    humidity: s.hu,
    dewPoint: hitungTitikEmbun(s.t, s.hu),
    wind: s.ws,
    windDir: s.windDir,
    cloud: s.cloud,
    visibility: s.visibility
  }));

  return {
    tmax, tmin,
    isRain, rainHour: rep ? rep.hour : null, rainMm: rep ? (rep.precipMm||0) : 0,
    rainKategori: rep ? (rep.desc || weatherInfo(rep.code)[0]) : '-',
    repTemp: rep ? rep.t : null, repCode: rep ? rep.code : null, repDesc,
    precipSum, humidityAvg, windMaxSpeed, windAvg, windDirAvg,
    hours
  };
}
/* Konversi derajat arah angin (meteorologi: arah DARI mana angin bertiup) ke mata angin Indonesia. */
const ARAH_ANGIN_PANJANG = ['Utara','Timur Laut','Timur','Tenggara','Selatan','Barat Daya','Barat','Barat Laut'];
const ARAH_ANGIN_SINGKAT = ['U','TL','T','TG','S','BD','B','BL'];
function derajatKeArahAngin(deg, singkat){
  if(deg===null || deg===undefined || isNaN(deg)) return '-';
  const idx = Math.round(deg/45) % 8;
  return (singkat ? ARAH_ANGIN_SINGKAT : ARAH_ANGIN_PANJANG)[idx];
}
function formatArahAngin(deg){
  if(deg===null || deg===undefined || isNaN(deg)) return '-';
  return derajatKeArahAngin(deg, true)+' ('+Math.round(deg)+'\u00b0)';
}
/* Indeks Panas (Heat Index) dihitung manual dari suhu+kelembapan (rumus NOAA).
 * Hanya relevan saat cukup panas & lembap, di luar itu dikembalikan null. */
function hitungIndeksPanas(tempC, humidity){
  if(tempC===null || tempC===undefined || humidity===null || humidity===undefined || tempC < 27) return null;
  const T = tempC*9/5+32;
  const R = humidity;
  const HI = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R
    - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R
    + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
  return (HI-32)*5/9;
}
async function fetchCuacaWilayah(point){
  const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${point.adm4}`;
  const resp = await fetch(url);
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const data = await resp.json();
  if(!data || !Array.isArray(data.cuaca)) throw new Error('Format data BMKG tidak dikenali (cek kode wilayah adm4)');
  return ringkasCuacaWilayah(data);
}
function simpanWeatherLogHariIni(){
  const tgl = todayIso();
  if(WEATHER_LOG.some(w=>w.date===tgl)) return; // sudah tersimpan, jangan timpa
  // Catatan: rincian per-jam (hours) IKUT disimpan (sebelumnya dibuang) supaya
  // Laporan Cuaca Lengkap bisa menampilkan detail per jam, bukan cuma ringkasan harian.
  WEATHER_LOG.push({ date: tgl, utara: WEATHER.utara, selatan: WEATHER.selatan });
  saveWeatherLog();
}
async function fetchWeatherIfNeeded(force){
  const now = Date.now();
  if(!force && WEATHER && (now - WEATHER.ts) < WEATHER_MAX_AGE) return;
  if(weatherLoading) return;
  weatherLoading = true;
  if(force) renderBerandaIfActive();
  try{
    const [utara, selatan] = await Promise.all([
      fetchCuacaWilayah(WEATHER_POINTS.utara),
      fetchCuacaWilayah(WEATHER_POINTS.selatan)
    ]);
    WEATHER = { ts: now, utara, selatan };
    LS.set('v2_weather_cache', WEATHER);
    simpanWeatherLogHariIni();
    weatherLastError = null; // fetch berhasil - bersihkan status gagal sebelumnya kalau ada
  }catch(err){
    // FIX: dulu cuma console.warn (tidak kelihatan sama sekali di APK rilis) -
    // sekarang disimpan supaya renderBeranda() bisa menunjukkan ke user bahwa
    // ini masih data lama karena update terakhir gagal, bukan diam-diam gagal.
    // TypeError generik dari fetch() browser/WebView (pesannya biasanya cuma
    // "Failed to fetch") hampir selalu berarti diblokir CORS atau memang tidak
    // ada koneksi internet saat itu - dikasih keterangan supaya lebih jelas.
    const raw = (err && err.message) ? err.message : 'Gagal mengambil data cuaca';
    weatherLastError = (err instanceof TypeError) ? raw+' (kemungkinan diblokir CORS atau tidak ada internet)' : raw;
    console.warn('Gagal ambil data cuaca:', weatherLastError);
  }finally{
    weatherLoading = false;
    renderBerandaIfActive();
  }
}
function renderBerandaIfActive(){
  const host = document.getElementById('screen-beranda');
  if(host && host.classList.contains('active')) renderBeranda();
}
/* FIX: sebelumnya pengulang ini cuma renderBerandaIfActive() (gambar ulang
 * pakai data LAMA supaya slot jam maju) - TIDAK PERNAH benar-benar mengecek/
 * mengambil data baru. Akibatnya kalau app cuma dibiarkan terbuka/di-resume
 * dari recent-apps (bukan dibuka ulang dari kondisi tertutup total, dan tidak
 * pernah pindah-lalu-balik ke tab Beranda), cuaca tidak pernah ter-refresh
 * sama sekali walau sudah berhari-hari - "Diperbarui" & curah hujan jadi
 * kelihatan beku. Sekarang fetchWeatherIfNeeded() dipanggil juga di sini -
 * fungsi itu sendiri sudah pintar (cuma benar-benar fetch kalau data sudah
 * lebih tua dari WEATHER_MAX_AGE), lalu tetap render ulang setelahnya supaya
 * slot jam tetap maju walau kebetulan belum waktunya fetch baru. */
setInterval(()=>{ fetchWeatherIfNeeded(); renderBerandaIfActive(); }, 5*60*1000);

/* ================= DETAIL CUACA PER JAM ================= */
let weatherDetailState = null; // {region, idx}
function openWeatherDetailModal(region){
  const w = WEATHER ? WEATHER[region] : null;
  if(!w || !w.hours || !w.hours.length){ toast('Data jam belum tersedia, coba muat ulang cuaca'); return; }
  const nowH = new Date().getHours();
  let idx = w.hours.findIndex(h=>h.hour===nowH);
  if(idx<0) idx = 0;
  weatherDetailState = { region, idx };
  openModal(renderWeatherDetailHtml());
}
function selectWeatherHour(idx){
  weatherDetailState.idx = idx;
  const sheet = document.getElementById('modalSheet');
  if(sheet) sheet.innerHTML = renderWeatherDetailHtml();
}
function renderWeatherDetailHtml(){
  const {region, idx} = weatherDetailState;
  const w = WEATHER[region];
  const label = WEATHER_POINTS[region].label;
  const h = w.hours[idx];
  const info = weatherInfo(h.code, h.desc);
  const heatIdx = hitungIndeksPanas(h.temp, h.humidity);
  const stripHtml = w.hours.map((hh,i)=>{
    const active = i===idx;
    return `<div onclick="selectWeatherHour(${i})" style="flex:0 0 auto;text-align:center;padding:8px 10px;border-radius:10px;cursor:pointer;${active?'background:var(--primary);color:#fff;':'background:var(--surface-container);'}">
      <div style="font-size:11px;${active?'color:rgba(255,255,255,.85);':'color:var(--on-surface-variant);'}">${String(hh.hour).padStart(2,'0')}</div>
      <div style="font-size:16px;margin:2px 0;">${weatherInfo(hh.code)[1]}</div>
      <div style="font-size:12px;font-weight:800;">${hh.temp!==null?Math.round(hh.temp):'-'}&deg;</div>
    </div>`;
  }).join('');
  const baris = (lbl,val)=>`<tr><td style="padding:6px 0;color:var(--on-surface-variant);border-bottom:1px solid var(--outline-variant);">${lbl}</td><td style="text-align:right;padding:6px 0;font-weight:700;border-bottom:1px solid var(--outline-variant);">${val}</td></tr>`;
  return `
    <div class="mhead"><h2>Detail Cuaca &middot; ${escapeHtml(label)}</h2><button class="mclose" onclick="closeModal()">&times;</button></div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding:4px 2px 12px;">${stripHtml}</div>
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Jam ${jamLabel(h.hour)} &middot; ${escapeHtml(info[0])}</div>
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      ${baris('Suhu', (h.temp!==null?Math.round(h.temp):'-')+'&deg;')}
      ${baris('Suhu terasa*', (h.feels!==null?Math.round(h.feels):'-')+'&deg;')}
      ${heatIdx!==null?baris('Indeks panas', Math.round(heatIdx)+'&deg;'):''}
      ${baris('Curah hujan (per 3 jam)', (h.precipMm||0).toFixed(1)+' mm')}
      ${baris('Angin', Math.round(h.wind||0)+' km/j')}
      ${baris('Arah angin', formatArahAngin(h.windDir))}
      ${baris('Kelembapan', Math.round(h.humidity||0)+'%')}
      ${baris('Titik embun*', (h.dewPoint!==null?Math.round(h.dewPoint):'-')+'&deg;')}
      ${baris('Tutupan awan', Math.round(h.cloud||0)+'%')}
      ${baris('Jarak pandang', (h.visibility!==null?(h.visibility/1000).toFixed(1):'-')+' km')}
    </table>
    <div style="font-size:10px;color:var(--on-surface-variant);margin-top:4px;">*dihitung dari suhu &amp; kelembapan, bukan data langsung BMKG</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--on-surface-variant);margin-top:14px;">
      <span>Suhu maks/min hari ini: ${w.tmax!==null?Math.round(w.tmax):'-'}&deg;/${w.tmin!==null?Math.round(w.tmin):'-'}&deg;</span>
      <span>Prakiraan curah hujan hari ini: ${w.precipSum!==null&&w.precipSum!==undefined?w.precipSum.toFixed(1):'0.0'} mm</span>
    </div>
    <div class="section-eyebrow" style="margin-top:16px;">Tren 7 Hari &middot; Curah Hujan</div>
    ${renderTrenMingguanCuaca(region)}
    <div style="text-align:center;font-size:10px;color:var(--on-surface-variant);margin-top:10px;">Sumber: ${WEATHER_SOURCE_LABEL}</div>
  `;
}
function renderTrenMingguanCuaca(region){
  const logs = WEATHER_LOG.filter(w=>w[region]).slice(-7);
  if(logs.length < 2) return `<div class="field-sub" style="margin-top:6px;">Belum cukup histori (data terkumpul tiap hari app dibuka)</div>`;
  const maxMm = Math.max(1, ...logs.map(l=>(l[region].precipSum!==undefined&&l[region].precipSum!==null)?l[region].precipSum:(l[region].rainMm||0)));
  const bars = logs.map(l=>{
    const mm = (l[region].precipSum!==undefined&&l[region].precipSum!==null)?l[region].precipSum:(l[region].rainMm||0);
    const tinggi = Math.max(4, Math.round((mm/maxMm)*50));
    const d = new Date(l.date+'T00:00:00');
    const dayLabel = d.getDate()+'/'+(d.getMonth()+1);
    return `<div style="flex:1;text-align:center;min-width:0;">
      <div style="height:50px;display:flex;align-items:flex-end;justify-content:center;">
        <div title="${mm.toFixed(1)} mm" style="width:65%;height:${tinggi}px;background:var(--primary);border-radius:3px 3px 0 0;"></div>
      </div>
      <div style="font-size:9px;color:var(--on-surface-variant);margin-top:3px;">${dayLabel}</div>
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:4px;margin-top:8px;">${bars}</div>`;
}

