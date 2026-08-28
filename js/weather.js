/* ================= CUACA HARI INI (Open-Meteo, gratis tanpa API key) =================
 * Koordinat TETAP (bukan GPS) — mewakili 2 wilayah kebun (Utara & Selatan).
 * Ganti angka di sini jika titik representatif berubah. */
const WEATHER_POINTS = {
  utara:   { label:'Wilayah Utara',   lat:-4.667307, lon:105.285845 },
  selatan: { label:'Wilayah Selatan', lat:-4.745238, lon:105.289477 }
};
const WEATHER_RAIN_THRESHOLD = 50; // persen probabilitas hujan dianggap "berpotensi hujan"
const WEATHER_MAX_AGE = 30*60*1000; // 30 menit
const WEATHER_STRIP_HOURS = [6,9,12,15,18];
let WEATHER = LS.get('v2_weather_cache', null); // {ts, utara:{...}, selatan:{...}}
let WEATHER_LOG = LS.get('v2_weather_log', []); // [{date, utara:{...}, selatan:{...}}]
let weatherLoading = false;
function saveWeatherLog(){ LS.set('v2_weather_log', WEATHER_LOG); }
function weatherInfo(code){
  const map = {
    0:['Cerah','☀️'],1:['Cerah Berawan','🌤️'],2:['Berawan Sebagian','⛅'],3:['Mendung','☁️'],
    45:['Berkabut','🌫️'],48:['Berkabut','🌫️'],
    51:['Gerimis Ringan','🌦️'],53:['Gerimis','🌦️'],55:['Gerimis Lebat','🌦️'],
    56:['Gerimis Beku','🌦️'],57:['Gerimis Beku','🌦️'],
    61:['Hujan Ringan','🌧️'],63:['Hujan','🌧️'],65:['Hujan Lebat','🌧️'],
    66:['Hujan Beku','🌧️'],67:['Hujan Beku','🌧️'],
    71:['Salju Ringan','❄️'],73:['Salju','❄️'],75:['Salju Lebat','❄️'],77:['Butiran Salju','❄️'],
    80:['Hujan Lokal Ringan','🌦️'],81:['Hujan Lokal','🌦️'],82:['Hujan Lokal Lebat','🌧️'],
    85:['Hujan Salju Ringan','🌨️'],86:['Hujan Salju Lebat','🌨️'],
    95:['Badai Petir','⛈️'],96:['Badai Petir + Es','⛈️'],99:['Badai Petir + Es','⛈️']
  };
  return map[code] || ['Tidak Diketahui','🌡️'];
}
/* Kategori kondisi cuaca untuk kolom Kondisi di cetak PDF (5 kategori, dipetakan dari
 * weathercode Open-Meteo yang sama dengan weatherInfo()) - dipakai bareng oleh
 * weatherCategoryLabel() untuk menampilkan teks singkat (bukan emoji/ikon). */
function weatherIconCategory(code){
  if([0,1].includes(code)) return 'cerah';
  if([2,3,45,48].includes(code)) return 'berawan';
  if([51,53,55,56,57,61,71,73,75,77,80,85,86].includes(code)) return 'hujan_ringan';
  if([63,65,66,67,82].includes(code)) return 'hujan_lebat';
  if([95,96,99].includes(code)) return 'badai';
  return 'berawan';
}
function jamLabel(h){ return String(h).padStart(2,'0')+'.00'; }
/* Ambil & ringkas data 1 wilayah dari respons Open-Meteo (data harian ini saja) */
function ringkasCuacaWilayah(data){
  const hourly = data.hourly || {};
  const times = hourly.time || [];
  const todayStr = todayIso();
  const idxToday = times.map((t,i)=>({t,i})).filter(x=>x.t.startsWith(todayStr));
  let bestIdx = -1, bestProb = -1;
  idxToday.forEach(x=>{
    const p = hourly.precipitation_probability ? hourly.precipitation_probability[x.i] : 0;
    if(p > bestProb){ bestProb = p; bestIdx = x.i; }
  });
  const isRain = bestProb >= WEATHER_RAIN_THRESHOLD;
  let repHour=null, repTemp=null, repCode=null, repMm=null;
  if(bestIdx>-1){
    repHour = parseInt(times[bestIdx].slice(11,13),10);
    repTemp = hourly.temperature_2m ? hourly.temperature_2m[bestIdx] : null;
    repCode = hourly.weathercode ? hourly.weathercode[bestIdx] : null;
    repMm = hourly.precipitation ? hourly.precipitation[bestIdx] : null;
  }
  if(!isRain && idxToday.length){
    // wakil "terik": jam dengan suhu tertinggi hari ini
    let hotIdx = idxToday[0].i;
    idxToday.forEach(x=>{ if((hourly.temperature_2m[x.i]||0) > (hourly.temperature_2m[hotIdx]||0)) hotIdx = x.i; });
    repHour = parseInt(times[hotIdx].slice(11,13),10);
    repTemp = hourly.temperature_2m ? hourly.temperature_2m[hotIdx] : null;
    repCode = hourly.weathercode ? hourly.weathercode[hotIdx] : null;
    repMm = 0;
  }
  const strip = WEATHER_STRIP_HOURS.map(h=>{
    let match = idxToday.find(x=>parseInt(times[x.i].slice(11,13),10)===h);
    if(!match) return { hour:h, code:null };
    return { hour:h, code: hourly.weathercode ? hourly.weathercode[match.i] : null };
  });
  /* Rincian tiap jam hari ini (dipakai layar Detail Cuaca) */
  const hours = idxToday.map(x=>{
    const i = x.i;
    return {
      hour: parseInt(times[i].slice(11,13),10),
      temp: hourly.temperature_2m ? hourly.temperature_2m[i] : null,
      feels: hourly.apparent_temperature ? hourly.apparent_temperature[i] : null,
      code: hourly.weathercode ? hourly.weathercode[i] : null,
      precipProb: hourly.precipitation_probability ? hourly.precipitation_probability[i] : null,
      precipMm: hourly.precipitation ? hourly.precipitation[i] : null,
      humidity: hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null,
      dewPoint: hourly.dew_point_2m ? hourly.dew_point_2m[i] : null,
      wind: hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null,
      windDir: hourly.wind_direction_10m ? hourly.wind_direction_10m[i] : null,
      gust: hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i] : null,
      cloud: hourly.cloud_cover ? hourly.cloud_cover[i] : null,
      visibility: hourly.visibility ? hourly.visibility[i] : null
    };
  });
  /* Ringkasan harian tambahan (kelembapan rata-rata & angin kencang tertinggi hari ini) */
  const humidityVals = idxToday.map(x=>hourly.relative_humidity_2m?hourly.relative_humidity_2m[x.i]:null).filter(v=>v!==null&&v!==undefined);
  const humidityAvg = humidityVals.length ? humidityVals.reduce((a,b)=>a+b,0)/humidityVals.length : null;
  const gustVals = idxToday.map(x=>hourly.wind_gusts_10m?hourly.wind_gusts_10m[x.i]:null).filter(v=>v!==null&&v!==undefined);
  const windMaxGust = gustVals.length ? Math.max(...gustVals) : null;
  /* Angin rata-rata harian: kecepatan dirata-rata biasa; arah dirata-rata pakai
   * komponen vektor (sin/cos) supaya tidak salah (mis. rata-rata 350° & 10° harus ~0°,
   * bukan 180°), dibobot pakai kecepatan tiap jam supaya jam angin kencang lebih dominan. */
  const windValsToday = idxToday.map(x=>({
    spd: hourly.wind_speed_10m ? hourly.wind_speed_10m[x.i] : null,
    dir: hourly.wind_direction_10m ? hourly.wind_direction_10m[x.i] : null
  })).filter(v=>v.spd!==null && v.spd!==undefined);
  const windAvg = windValsToday.length ? windValsToday.reduce((a,b)=>a+b.spd,0)/windValsToday.length : null;
  let windDirAvg = null;
  const windDirVals = windValsToday.filter(v=>v.dir!==null && v.dir!==undefined);
  if(windDirVals.length){
    let sx=0, sy=0;
    windDirVals.forEach(v=>{ const rad=v.dir*Math.PI/180; const w=Math.max(v.spd,0.1); sx += Math.cos(rad)*w; sy += Math.sin(rad)*w; });
    let deg = Math.atan2(sy,sx)*180/Math.PI;
    if(deg<0) deg += 360;
    windDirAvg = deg;
  }
  return {
    tmax: data.daily && data.daily.temperature_2m_max ? data.daily.temperature_2m_max[0] : null,
    tmin: data.daily && data.daily.temperature_2m_min ? data.daily.temperature_2m_min[0] : null,
    isRain, rainProb: bestProb<0?0:bestProb, rainHour: repHour, rainMm: repMm||0,
    repTemp, repCode, strip,
    uvIndexMax: data.daily && data.daily.uv_index_max ? data.daily.uv_index_max[0] : null,
    precipSum: data.daily && data.daily.precipitation_sum ? data.daily.precipitation_sum[0] : null,
    humidityAvg, windMaxGust, windAvg, windDirAvg,
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}`+
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weathercode,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility`+
    `&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum&timezone=auto&forecast_days=1`;
  const resp = await fetch(url);
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const data = await resp.json();
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
  }catch(err){
    console.warn('Gagal ambil data cuaca:', err && err.message ? err.message : err);
  }finally{
    weatherLoading = false;
    renderBerandaIfActive();
  }
}
function renderBerandaIfActive(){
  const host = document.getElementById('screen-beranda');
  if(host && host.classList.contains('active')) renderBeranda();
}

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
  const info = weatherInfo(h.code);
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
      ${baris('Suhu terasa', (h.feels!==null?Math.round(h.feels):'-')+'&deg;')}
      ${heatIdx!==null?baris('Indeks panas', Math.round(heatIdx)+'&deg;'):''}
      ${baris('Probabilitas hujan', Math.round(h.precipProb||0)+'%')}
      ${baris('Curah hujan', (h.precipMm||0).toFixed(1)+' mm')}
      ${baris('Angin', Math.round(h.wind||0)+' km/j')}
      ${baris('Arah angin', formatArahAngin(h.windDir))}
      ${baris('Angin kencang', Math.round(h.gust||0)+' km/j')}
      ${baris('Kelembapan', Math.round(h.humidity||0)+'%')}
      ${baris('Titik embun', (h.dewPoint!==null?Math.round(h.dewPoint):'-')+'&deg;')}
      ${baris('Tutupan awan', Math.round(h.cloud||0)+'%')}
      ${baris('Jarak pandang', (h.visibility!==null?(h.visibility/1000).toFixed(1):'-')+' km')}
    </table>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--on-surface-variant);margin-top:14px;">
      <span>Suhu maks/min hari ini: ${w.tmax!==null?Math.round(w.tmax):'-'}&deg;/${w.tmin!==null?Math.round(w.tmin):'-'}&deg;</span>
      <span>UV maks: ${w.uvIndexMax!==null&&w.uvIndexMax!==undefined?w.uvIndexMax.toFixed(1):'-'}</span>
    </div>
    <div class="section-eyebrow" style="margin-top:16px;">Tren 7 Hari &middot; Curah Hujan</div>
    ${renderTrenMingguanCuaca(region)}
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

