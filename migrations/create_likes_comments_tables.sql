-- Migration: Create likes and comments tables
-- Date: 2026-05-08

-- ====================== CREATE AIME TABLE ======================
CREATE TABLE IF NOT EXISTS `aime` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_etudiant` int NOT NULL,
  `id_offre_stage` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_like` (`id_etudiant`,`id_offre_stage`),
  KEY `id_offre_stage` (`id_offre_stage`),
  CONSTRAINT `aime_ibfk_1` FOREIGN KEY (`id_etudiant`) REFERENCES `etudiant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `aime_ibfk_2` FOREIGN KEY (`id_offre_stage`) REFERENCES `offre_stage` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ====================== UPDATE COMMENTAIRE TABLE ======================
ALTER TABLE `commentaire` 
  ADD CONSTRAINT `commentaire_ibfk_1` FOREIGN KEY (`id_etudiant`) REFERENCES `etudiant` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `commentaire_ibfk_2` FOREIGN KEY (`id_offre_stage`) REFERENCES `offre_stage` (`id`) ON DELETE CASCADE;
