const pool = require('../config/db');

(async () => {
  try {
    const [r] = await pool.query("UPDATE notification SET id_entreprise = NULL WHERE type = 'offre' AND id_etudiant IS NOT NULL");
    console.log('updated', r.affectedRows);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
