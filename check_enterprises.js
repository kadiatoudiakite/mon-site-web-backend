const mysql = require('mysql2/promise');

async function checkDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_stagetrack'
    });

    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM entreprise');
    console.log('Nombre d\'entreprises en base:', rows[0].count);

    const [recent] = await connection.execute('SELECT id, nom, email, created_at FROM entreprise ORDER BY created_at DESC LIMIT 5');
    console.log('Dernières entreprises:');
    recent.forEach(e => {
      console.log(`  ${e.id}: ${e.nom} (${e.email}) - ${e.created_at}`);
    });

    await connection.end();
  } catch (error) {
    console.error('Erreur de connexion à la base:', error.message);
  }
}

checkDB();