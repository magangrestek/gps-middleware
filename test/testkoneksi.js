// testkoneksi.js
require('dotenv').config();
const { initDb } = require('../src/config/config');

(async () => {
  try {
    const pool = await initDb();
    // Mendapatkan koneksi dari pool untuk menguji koneksi
    const connection = await pool.getConnection();
    console.log('Koneksi database berhasil!');
    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Gagal menguji koneksi database:', error);
    process.exit(1);
  }
})();
