const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'stagetrack'
    });

    const [rows] = await connection.query('DESCRIBE notification');
    console.log(rows);
    connection.end();
}

main().catch(console.error);
