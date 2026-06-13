const pool = require('../config/db');

(async () => {
  try {
    const [rows] = await pool.query('SELECT VERSION() AS version');
    console.log('MySQL version:', rows[0].version);
    process.exit(0);
  } catch (err) {
    console.error('Erreur version MySQL:', err.message);
    process.exit(1);
  }
})();
