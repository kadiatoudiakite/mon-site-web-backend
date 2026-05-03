const pool = require('../config/db');
async function insert() {
  try {
    // 1. Update university 1
    await pool.query('UPDATE universite SET nom = "Université de Conakry", logo = "https://via.placeholder.com/100?text=UC" WHERE id = 1');
    
    // 2. Insert a university offer
    await pool.query('INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, id_domaine, id_universite) VALUES ("Stage Assistant RH", "Aider le service RH de l\'université", "3 mois", "2024-06-01", "2024-09-01", 1, 1)');
    
    // 3. Insert a company offer
    await pool.query('INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, id_domaine, id_entreprise) VALUES ("Développeur React Native", "Stage de développement mobile", "6 mois", "2024-07-01", "2024-12-31", 1, 23)');
    
    console.log('Sample data inserted successfully');
    process.exit(0);
  } catch(e) { 
    console.error(e); 
    process.exit(1); 
  }
}
insert();
