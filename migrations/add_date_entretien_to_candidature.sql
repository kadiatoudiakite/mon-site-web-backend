-- Ajouter la colonne date_entretien à la table candidature si elle n'existe pas
ALTER TABLE `candidature` ADD COLUMN `date_entretien` DATETIME NULL DEFAULT NULL AFTER `date_candidature`;
