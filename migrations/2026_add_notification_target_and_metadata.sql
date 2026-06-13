-- Migration: ajoute colonnes target et created_by_* à la table notification
-- Exécuter sur une copie de la base avant en production.

-- Option A: si la table n'existe pas, créer une table conforme
-- CREATE TABLE IF NOT EXISTS notification (
--   id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
--   id_universite INT DEFAULT NULL,
--   id_entreprise INT DEFAULT NULL,
--   id_etudiant INT DEFAULT NULL,
--   target ENUM('universite','entreprise','etudiant','all_universities','all_companies','all_students','system') NOT NULL DEFAULT 'system',
--   titre VARCHAR(255) NOT NULL,
--   message TEXT NOT NULL,
--   type VARCHAR(50) DEFAULT 'info',
--   statut ENUM('non_lu','lu') DEFAULT 'non_lu',
--   created_by_type ENUM('universite','entreprise','etudiant','system') DEFAULT 'system',
--   created_by_id INT DEFAULT NULL,
--   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   KEY idx_notification_univ (id_universite, statut),
--   KEY idx_notification_entreprise (id_entreprise, statut),
--   KEY idx_notification_etudiant (id_etudiant, statut),
--   KEY idx_notification_target (target),
--   KEY idx_notification_created_by (created_by_type, created_by_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Option B: si la table existe déjà, ajouter colonnes et indexes
ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS id_etudiant INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target ENUM('universite','entreprise','etudiant','all_universities','all_companies','all_students','system') NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_by_type ENUM('universite','entreprise','etudiant','system') DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_by_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indexes (ajouter si non existants)
CREATE INDEX IF NOT EXISTS idx_notification_target ON notification (target);
CREATE INDEX IF NOT EXISTS idx_notification_etudiant ON notification (id_etudiant);
CREATE INDEX IF NOT EXISTS idx_notification_entreprise ON notification (id_entreprise);
CREATE INDEX IF NOT EXISTS idx_notification_univ ON notification (id_universite);
CREATE INDEX IF NOT EXISTS idx_notification_created_by ON notification (created_by_type, created_by_id);

-- Foreign keys: ajoutez seulement si les tables référencées existent et les valeurs sont cohérentes.
-- ALTER TABLE notification ADD CONSTRAINT fk_notification_etudiant FOREIGN KEY (id_etudiant) REFERENCES etudiant(id) ON DELETE SET NULL;
-- ALTER TABLE notification ADD CONSTRAINT fk_notification_entreprise FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE SET NULL;
-- ALTER TABLE notification ADD CONSTRAINT fk_notification_univ FOREIGN KEY (id_universite) REFERENCES universite(id) ON DELETE SET NULL;

-- Fin de migration
