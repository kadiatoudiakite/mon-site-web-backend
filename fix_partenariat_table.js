const pool = require('./config/db');

async function fixTable() {
    try {
        console.log('🔍 Analyse de la structure de demande_partenariat...');
        
        // Vérifier si la colonne existe déjà
        const [columns] = await pool.query("SHOW COLUMNS FROM demande_partenariat LIKE 'id_entreprise'");
        
        if (columns.length === 0) {
            console.log('➕ Ajout de la colonne id_entreprise...');
            await pool.query("ALTER TABLE demande_partenariat ADD COLUMN id_entreprise INT DEFAULT NULL AFTER description");
            console.log('✅ Colonne id_entreprise ajoutée.');
        } else {
            console.log('ℹ️ La colonne id_entreprise existe déjà.');
        }
        
        // Vérifier la contrainte FK
        try {
            const [constraints] = await pool.query(`
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = 'demande_partenariat' 
                AND COLUMN_NAME = 'id_entreprise' 
                AND REFERENCED_TABLE_NAME = 'entreprise'
            `);
            
            if (constraints.length === 0) {
                console.log('➕ Ajout de la contrainte de clé étrangère...');
                await pool.query(`
                    ALTER TABLE demande_partenariat 
                    ADD CONSTRAINT fk_dp_entreprise 
                    FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE SET NULL
                `);
                console.log('✅ Contrainte FK ajoutée.');
            } else {
                console.log('ℹ️ La contrainte FK existe déjà.');
            }
        } catch (fkErr) {
            console.warn('⚠️ Impossible de vérifier/ajouter la contrainte FK:', fkErr.message);
        }

        console.log('🎉 Table demande_partenariat opérationnelle !');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erreur critique:', err.message);
        process.exit(1);
    }
}

fixTable();
