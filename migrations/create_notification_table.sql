-- Script de création de la table notification
CREATE TABLE IF NOT EXISTS notification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_universite INT DEFAULT NULL,
    id_entreprise INT DEFAULT NULL,
    id_etudiant INT DEFAULT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'candidature', 'partenariat', 'systeme', 'offre', 'message', 'alerte'
    statut ENUM('non_lu', 'lu') DEFAULT 'non_lu',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notification_id_universite (id_universite),
    KEY idx_notification_id_entreprise (id_entreprise),
    KEY idx_notification_id_etudiant (id_etudiant),
    CONSTRAINT fk_notification_universite FOREIGN KEY (id_universite) REFERENCES universite(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_entreprise FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_etudiant FOREIGN KEY (id_etudiant) REFERENCES etudiant(id) ON DELETE SET NULL
);
