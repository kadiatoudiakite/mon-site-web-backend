-- Migration: ajouter id_etudiant à la table notification
ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS id_etudiant INT DEFAULT NULL;

ALTER TABLE notification
  ADD INDEX idx_notification_id_etudiant (id_etudiant);

ALTER TABLE notification
  ADD CONSTRAINT fk_notification_etudiant
    FOREIGN KEY (id_etudiant) REFERENCES etudiant(id) ON DELETE SET NULL;
