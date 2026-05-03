// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_NAME,
  waitForConnections : true,
  connectionLimit    : 10,       // suffisant pour tester
  queueLimit         : 0,
  connectTimeout     : 10000     // 10 secondes max
};

const pool = mysql.createPool(dbConfig);

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('→ MySQL connecté avec succès →', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('Erreur connexion MySQL :', err.message);
    console.log('Le serveur continuera sans DB. Vérifiez la configuration MySQL.');
  }
})();

module.exports = pool;