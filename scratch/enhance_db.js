const pool = require('../config/db');
async function update() {
  try {
    // Add status to offers
    await pool.query("ALTER TABLE offre_stage ADD COLUMN statut ENUM('Ouverte', 'Clôturée', 'Pourvue') DEFAULT 'Ouverte'");
    // Add view counter to offers
    await pool.query("ALTER TABLE offre_stage ADD COLUMN vue_compteur INT DEFAULT 0");
    
    // Add comments to candidacy table for feedback
    await pool.query("ALTER TABLE candidature ADD COLUMN commentaire_entreprise TEXT DEFAULT NULL");
    
    console.log('✅ Database successfully enhanced for full management and analysis.');
    process.exit(0);
  } catch(e) { 
    console.error('❌ Error during database enhancement:', e.message); 
    process.exit(1); 
  }
}
update();
