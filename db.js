/**
 * db.js
 * Lapisan penyimpanan SQLite untuk Logbook Tebu (basis JadwalBT).
 *
 * DESAIN (disepakati dengan Han, Agustus 2026):
 * - Dipakai pola "kv_store": tiap kunci data (v2_entries, v2_units, dst)
 *   disimpan sebagai 1 baris (key TEXT, value TEXT berisi JSON) di SQLite.
 *   Ini BUKAN skema relasional penuh seperti Logbook V5 lama — pilihan
 *   sengaja diambil supaya seluruh kode JadwalBT (2000+ baris, sudah
 *   teruji & dipakai harian) TIDAK perlu ditulis ulang. Yang berubah cuma
 *   "rumah" penyimpanannya: dari localStorage (batas ~5-10MB, rawan
 *   dibersihkan sistem Android) ke SQLite (jauh lebih longgar & stabil).
 * - Kalau nanti salah satu tabel (misal v2_entries) benar-benar butuh query
 *   per-baris yang rumit, BARU dipertimbangkan pecah jadi tabel relasional
 *   sungguhan untuk kunci itu saja — bukan migrasi total di awal.
 *
 * Pola inisialisasi koneksi SQLite di bawah ini SAMA PERSIS dengan yang
 * sudah terbukti jalan di Logbook V5 (menyelesaikan bug
 * "SQLiteConnection is not a constructor") — sengaja dipakai ulang, jangan
 * diubah tanpa alasan kuat.
 *
 * --- Tahap 1 (Agustus 2026) ---
 * Fix bug restore: koneksi SQLite native (via plugin capacitor-community/sqlite)
 * hidup di level PROSES NATIVE Android, bukan di webview. Jadi kalau webview
 * di-reload (mis. location.reload() dipanggil dari kode JS setelah restore)
 * tapi proses native app-nya sendiri TIDAK ikut restart, koneksi lama masih
 * tercatat di sisi native. Panggilan createConnection() berikutnya lalu gagal
 * dengan error "CreateConnection: Connection ... already exists" — akibatnya
 * loadAllIntoCache() tidak sempat jalan, dan data yang terbaca setelah itu
 * jadi sisa cache lama (kelihatan seperti field tertentu, mis. v2_units,
 * "tidak ikut kepulihkan", padahal sebenarnya SEMUA data yang terpengaruh,
 * bukan v2_units doang — setAllCache() di bawah memang generik menulis SEMUA
 * key, jadi tidak ada daftar tabel khusus yang perlu diedit di situ).
 * Perbaikan: init() sekarang cek dulu apakah koneksi untuk nama DB ini sudah
 * ada (isConnection) — kalau ada, PAKAI ULANG (retrieveConnection) alih-alih
 * bikin baru. Ditambah close()/reconnect() eksplisit yang dipanggil dari alur
 * restore di index.html, supaya koneksi benar-benar ditutup-buka ulang tanpa
 * user perlu keluar-masuk app manual.
 */

const DB_NAME = "log_hz.db";
const DB_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

const DB = (() => {
  let db = null;
  let sqlite = null;
  let cache = {}; // isi kv_store di-load penuh ke memori sekali saat boot
  let ready = false;

  /** Pastikan elemen <jeep-sqlite> (dipakai fallback web/dev) cuma ditambahkan sekali,
   *  supaya init() aman dipanggil ulang lewat reconnect() tanpa numpuk elemen. */
  function ensureJeepSqliteEl() {
    let el = document.querySelector("jeep-sqlite");
    if (!el) {
      el = document.createElement("jeep-sqlite");
      document.body.appendChild(el);
    }
    return el;
  }

  async function init() {
    const { Capacitor } = window;
    const isNative = Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();

    sqlite = new window.capacitorCapacitorSQLite.SQLiteConnection(window.Capacitor.Plugins.CapacitorSQLite);

    if (!isNative) {
      // Fallback web (dev/testing di browser biasa): perlu <jeep-sqlite> + initWebStore
      ensureJeepSqliteEl();
      await customElements.whenDefined("jeep-sqlite");
      await sqlite.initWebStore();
    }

    // Tahap 1 fix: cek dulu apakah koneksi untuk DB ini sudah ada di sisi native
    // (bisa terjadi kalau init() dipanggil lagi setelah webview reload tapi proses
    // native belum restart). Kalau sudah ada, pakai ulang koneksinya — JANGAN
    // createConnection() lagi (itu yang memicu error "already exists").
    let isConn = false;
    try {
      isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    } catch (e) {
      isConn = false; // plugin lama / belum siap — anggap belum ada koneksi
    }
    db = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);

    await db.open();
    await db.execute(SCHEMA_SQL);

    await loadAllIntoCache();
    ready = true;
    return db;
  }

  /**
   * Tutup koneksi SQLite yang sedang aktif (kalau ada). Dipanggil sebelum
   * reconnect(), atau bisa juga dipanggil sendiri kalau suatu saat perlu
   * lepas koneksi tanpa langsung buka ulang.
   */
  async function close() {
    try {
      const isConn = sqlite ? (await sqlite.isConnection(DB_NAME, false)).result : false;
      if (isConn) {
        await sqlite.closeConnection(DB_NAME, false);
      }
    } catch (e) {
      console.warn("Gagal menutup koneksi SQLite (mungkin memang sudah tertutup):", e && e.message ? e.message : e);
    }
    db = null;
    ready = false;
  }

  /**
   * Tutup koneksi lama lalu buka ulang dari nol + muat ulang cache dari SQLite.
   * Dipakai setelah proses restore (berhasil ATAUPUN gagal) supaya app tidak
   * "nyangkut" pada koneksi lama dan pembacaan berikutnya selalu dapat data
   * terbaru — tanpa mengharuskan user keluar-masuk app secara manual.
   */
  async function reconnect() {
    await close();
    return init();
  }

  async function loadAllIntoCache() {
    const res = await db.query("SELECT key, value FROM kv_store");
    const rows = res.values || [];
    cache = {};
    for (const row of rows) {
      try {
        cache[row.key] = JSON.parse(row.value);
      } catch (e) {
        cache[row.key] = null;
      }
    }
  }

  /**
   * Tulis 1 key ke SQLite. Mengembalikan Promise supaya pemanggil BISA
   * menunggu selesainya kalau perlu (dipakai oleh setAllCache/Restore) -
   * tapi pemanggil biasa (set() sehari-hari) tetap boleh mengabaikan
   * Promise ini (fire-and-forget), jadi UI tetap instan seperti sebelumnya.
   */
  function persistKey(key, val) {
    const json = JSON.stringify(val);
    return db.run(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, json]
    ).catch((err) => {
      console.error("Gagal menyimpan '" + key + "' ke database:", err);
      // Sengaja tidak alert ke user di sini (bisa berisik kalau ada retry
      // otomatis) — kalau perlu diagnostik, cek konsol / logcat.
    });
  }

  function get(key, def) {
    if (Object.prototype.hasOwnProperty.call(cache, key) && cache[key] !== undefined && cache[key] !== null) {
      return cache[key];
    }
    return def;
  }

  function set(key, val) {
    cache[key] = val; // update memori langsung (sinkron, UI tetap instan)
    // Kembalikan Promise-nya (bukan `true`) supaya pemanggil yang PENTING
    // (mis. pengaturan Backup/Akun) bisa `await` sampai tulisan ke SQLite
    // benar-benar selesai. Pemanggil biasa tetap boleh abaikan Promise ini
    // (fire-and-forget) — perilakunya identik dengan sebelumnya.
    if (ready) return persistKey(key, val);
    return Promise.resolve(true);
  }

  function isReady() {
    return ready;
  }

  /** Ambil salinan semua data (key-value) untuk keperluan Backup. */
  function getAllCache() {
    return JSON.parse(JSON.stringify(cache));
  }

  /**
   * Tulis banyak key sekaligus (dipakai saat Restore backup).
   * PENTING: ini di-await sampai SEMUA tulisan ke SQLite benar-benar
   * selesai sebelum return - beda dengan set() biasa yang fire-and-forget.
   * Tanpa ini, reload() yang dipanggil sesudah restore bisa "balapan"
   * dengan tulisan yang belum kelar, sehingga data lama yang terbaca lagi
   * (restore kelihatan seperti tidak bekerja).
   *
   * CATATAN Tahap 1: fungsi ini SUDAH generik menulis SEMUA key yang ada
   * di objek backup (termasuk v2_units) — tidak ada daftar tabel khusus
   * yang perlu ditambah di sini. Kalau v2_units tidak kembali setelah
   * restore, penyebabnya ada di reconnect koneksi setelahnya (lihat init()
   * dan reconnect() di atas), bukan di fungsi ini.
   */
  async function setAllCache(obj) {
    if (!obj || typeof obj !== "object") return false;
    const tasks = [];
    for (const key of Object.keys(obj)) {
      cache[key] = obj[key]; // update memori langsung, sinkron
      if (ready) tasks.push(persistKey(key, obj[key]));
    }
    await Promise.all(tasks);
    return true;
  }

  return { init, get, set, isReady, getAllCache, setAllCache, close, reconnect };
})();

// LS dipertahankan sebagai nama yang sama persis dipakai di seluruh kode
// JadwalBT (const LS = {...} yang lama DIHAPUS dari index.html, digantikan
// definisi ini) — supaya tidak ada satu pun baris lain yang perlu diubah.
const LS = {
  get: DB.get,
  set: DB.set,
  getAll: DB.getAllCache,
  setAll: DB.setAllCache,
};
