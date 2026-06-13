-- Migration appliquée en plusieurs étapes pour compatibilité

ALTER TABLE notification ADD COLUMN IF NOT EXISTS id_etudiant INT DEFAULT NULL;

ALTER TABLE notification ADD COLUMN IF NOT EXISTS target ENUM('universite','entreprise','etudiant','all_universities','all_companies','all_students','system') NOT NULL DEFAULT 'system';

ALTER TABLE notification ADD COLUMN IF NOT EXISTS created_by_type ENUM('universite','entreprise','etudiant','system') DEFAULT 'system';

ALTER TABLE notification ADD COLUMN IF NOT EXISTS created_by_id INT DEFAULT NULL;

-- created_at peut déjà exister, on essaie seulement s'il n'existe pas
ALTER TABLE notification ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notification_target ON notification (target);
CREATE INDEX IF NOT EXISTS idx_notification_etudiant ON notification (id_etudiant);
CREATE INDEX IF NOT EXISTS idx_notification_entreprise ON notification (id_entreprise);
CREATE INDEX IF NOT EXISTS idx_notification_univ ON notification (id_universite);
CREATE INDEX IF NOT EXISTS idx_notification_created_by ON notification (created_by_type, created_by_id);

-- Note: FK addition commented out — ajoutez manuellement si vous validez la cohérence des données.
-- ALTER TABLE notification ADD CONSTRAINT fk_notification_etudiant FOREIGN KEY (id_etudiant) REFERENCES etudiant(id) ON DELETE SET NULL;
