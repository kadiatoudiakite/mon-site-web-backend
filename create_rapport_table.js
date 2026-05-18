const pool = require('./config/db');

const createRapportTable = async () => {
    const sql = `
    CREATE TABLE IF NOT EXISTS rapport (
        id INT AUTO_INCREMENT PRIMARY KEY,

        -- Relations
        id_etudiant INT NOT NULL,
        id_entreprise INT NOT NULL,
        id_offre_stage INT NULL,

        -- Informations du rapport
        titre VARCHAR(255) NOT NULL,
        description TEXT NULL,

        -- Fichier du rapport
        fichier_rapport VARCHAR(500) NOT NULL,

        -- Informations académiques
        encadreur_entreprise VARCHAR(255) NULL,
        encadreur_universite VARCHAR(255) NULL,

        -- Dates
        date_debut_stage DATE NULL,
        date_fin_stage DATE NULL,
        date_soumission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Statut du rapport
        statut ENUM(
            'en_attente',
            'soumis',
            'valide',
            'rejete',
            'corriger'
        ) DEFAULT 'en_attente',

        -- Commentaire de validation
        commentaire_validation TEXT NULL,

        -- Note du rapport
        note DECIMAL(5,2) NULL,

        -- Suivi
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        -- Clés étrangères (Adaptées à la structure réelle)
        CONSTRAINT fk_rapport_etudiant
            FOREIGN KEY (id_etudiant)
            REFERENCES etudiant(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_rapport_entreprise
            FOREIGN KEY (id_entreprise)
            REFERENCES entreprise(id)
            ON DELETE CASCADE,

        CONSTRAINT fk_rapport_offre
            FOREIGN KEY (id_offre_stage)
            REFERENCES offre_stage(id)
            ON DELETE SET NULL
    );`;

    try {
        await pool.query(sql);
        console.log('✅ Table "rapport" créée ou déjà existante.');
    } catch (err) {
        console.error('❌ Erreur lors de la création de la table rapport:', err);
    } finally {
        process.exit();
    }
};

createRapportTable();
