-- Migration: Support d'un commentaire d'entreprise dans la table commentaire
-- Date: 2026-05-08

ALTER TABLE commentaire
  DROP FOREIGN KEY commentaire_ibfk_1,
  DROP FOREIGN KEY commentaire_ibfk_2;

ALTER TABLE commentaire
  MODIFY COLUMN id_etudiant int NULL,
  ADD COLUMN id_entreprise int NULL AFTER id_etudiant;

ALTER TABLE commentaire
  ADD CONSTRAINT commentaire_ibfk_1 FOREIGN KEY (id_etudiant) REFERENCES etudiant(id) ON DELETE CASCADE,
  ADD CONSTRAINT commentaire_ibfk_3 FOREIGN KEY (id_entreprise) REFERENCES entreprise(id) ON DELETE CASCADE,
  ADD CONSTRAINT commentaire_ibfk_2 FOREIGN KEY (id_offre_stage) REFERENCES offre_stage(id) ON DELETE CASCADE;
