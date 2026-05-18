-- Migration: ajouter id_entreprise à la table demande_partenariat
ALTER TABLE demande_partenariat
ADD COLUMN IF NOT EXISTS id_entreprise INT DEFAULT NULL,
ADD CONSTRAINT IF NOT EXISTS fk_demande_partenariat_entreprise
  FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE SET NULL;