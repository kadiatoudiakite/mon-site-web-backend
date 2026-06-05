const pool = require('../config/db');

(async () => {
  try {
    const [rows] = await pool.query("SELECT id, photo FROM etudiant WHERE photo IS NOT NULL AND photo <> '' LIMIT 20");
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();
