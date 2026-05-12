const pool = require('./config/db');

async function setup() {
  try {
    // Ajouter UNC
    await pool.execute("INSERT INTO universite (nom, prenom, email, mot_de_passe) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE nom=VALUES(nom)", 
      ['UNC - Université Gamal Abdel Nasser de Conakry', 'Admin', 'unc@gmail.com', '123']
    );
    console.log('✅ UNC ajouté');

    // S'assurer qu'il y a des domaines
    const [domaines] = await pool.execute("SELECT COUNT(*) as count FROM domaine");
    if (domaines[0].count === 0) {
      await pool.execute("INSERT INTO domaine (nom) VALUES ('Informatique'), ('Banque'), ('Assurance'), ('Santé'), ('Éducation')");
      console.log('✅ Domaines par défaut ajoutés');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err);
    process.exit(1);
  }
}

setup();
