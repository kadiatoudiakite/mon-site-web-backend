// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_stagetrack',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000
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