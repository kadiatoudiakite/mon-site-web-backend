// SCRATCH SCRIPT to create partenariat table
const pool = require('./config/db');

const sql = `
CREATE TABLE IF NOT EXISTS demande_partenariat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom_entreprise VARCHAR(150) NOT NULL,
  email_entreprise VARCHAR(255) NOT NULL,
  domaine VARCHAR(100) NOT NULL,
  description TEXT,
  id_universite INT NOT NULL,
  id_entreprise INT DEFAULT NULL,
  statut ENUM('En attente', 'Acceptée', 'Refusée') DEFAULT 'En attente',
  date_demande TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_universite) REFERENCES universite(id) ON DELETE CASCADE,
  FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`;

async function createTable() {
  try {
    await pool.query(sql);
    console.log('✅ Table demande_partenariat créée avec succès');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur création table:', err);
    process.exit(1);
  }
}

createTable();
