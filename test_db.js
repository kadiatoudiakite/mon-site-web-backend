const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    const [rows] = await pool.execute('SHOW TABLES LIKE "offre_stage"');
    console.log('Table offre_stage exists:', rows.length > 0);

    if (rows.length > 0) {
      const [columns] = await pool.execute('DESCRIBE offre_stage');
      console.log('Table structure:');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type}`));
    }

    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();