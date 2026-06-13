const pool = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME || 'db_stagetrack', table, column]
  );
  return rows[0].cnt > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [process.env.DB_NAME || 'db_stagetrack', table, indexName]
  );
  return rows[0].cnt > 0;
}

(async () => {
  try {
    console.log('Migration notifications: démarrage');
    // columns to add
    if (!await columnExists('notification', 'id_etudiant')) {
      console.log('Ajout colonne id_etudiant');
      await pool.query('ALTER TABLE notification ADD COLUMN id_etudiant INT DEFAULT NULL');
    } else console.log('Colonne id_etudiant existe');

    if (!await columnExists('notification', 'target')) {
      console.log('Ajout colonne target');
      await pool.query("ALTER TABLE notification ADD COLUMN target ENUM('universite','entreprise','etudiant','all_universities','all_companies','all_students','system') NOT NULL DEFAULT 'system'");
    } else console.log('Colonne target existe');

    if (!await columnExists('notification', 'created_by_type')) {
      console.log('Ajout colonne created_by_type');
      await pool.query("ALTER TABLE notification ADD COLUMN created_by_type ENUM('universite','entreprise','etudiant','system') DEFAULT 'system'");
    } else console.log('Colonne created_by_type existe');

    if (!await columnExists('notification', 'created_by_id')) {
      console.log('Ajout colonne created_by_id');
      await pool.query('ALTER TABLE notification ADD COLUMN created_by_id INT DEFAULT NULL');
    } else console.log('Colonne created_by_id existe');

    if (!await columnExists('notification', 'created_at')) {
      console.log('Ajout colonne created_at');
      await pool.query("ALTER TABLE notification ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
    } else console.log('Colonne created_at existe');

    // indexes
    if (!await indexExists('notification', 'idx_notification_target')) {
      console.log('Ajout index idx_notification_target');
      await pool.query('CREATE INDEX idx_notification_target ON notification (target)');
    } else console.log('Index idx_notification_target existe');

    if (!await indexExists('notification', 'idx_notification_etudiant')) {
      console.log('Ajout index idx_notification_etudiant');
      await pool.query('CREATE INDEX idx_notification_etudiant ON notification (id_etudiant)');
    } else console.log('Index idx_notification_etudiant existe');

    if (!await indexExists('notification', 'idx_notification_entreprise')) {
      console.log('Ajout index idx_notification_entreprise');
      await pool.query('CREATE INDEX idx_notification_entreprise ON notification (id_entreprise)');
    } else console.log('Index idx_notification_entreprise existe');

    if (!await indexExists('notification', 'idx_notification_univ')) {
      console.log('Ajout index idx_notification_univ');
      await pool.query('CREATE INDEX idx_notification_univ ON notification (id_universite)');
    } else console.log('Index idx_notification_univ existe');

    if (!await indexExists('notification', 'idx_notification_created_by')) {
      console.log('Ajout index idx_notification_created_by');
      await pool.query('CREATE INDEX idx_notification_created_by ON notification (created_by_type, created_by_id)');
    } else console.log('Index idx_notification_created_by existe');

    console.log('Migration notifications: terminée');
    process.exit(0);
  } catch (err) {
    console.error('Erreur migration notifications:', err.message);
    process.exit(1);
  }
})();
