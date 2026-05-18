-- Script de vérification et correction du schéma de la table notification

-- 1. Vérifier que la table existe
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification';

-- 2. Afficher la structure de la table
DESCRIBE notification;

-- 3. Afficher les colonnes en détail
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
ORDER BY ORDINAL_POSITION;

-- 4. Afficher les clés étrangères
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification' AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 5. Afficher les index
SHOW INDEX FROM notification;

-- 6. Compter les notifications pour chaque étudiant
SELECT 
    id_etudiant,
    COUNT(*) as nb_notifications,
    SUM(CASE WHEN statut = 'non_lu' THEN 1 ELSE 0 END) as non_lues
FROM notification
GROUP BY id_etudiant
ORDER BY nb_notifications DESC;

-- 7. Afficher quelques notifications récentes
SELECT 
    id,
    id_etudiant,
    id_entreprise,
    id_universite,
    titre,
    type,
    statut,
    created_at
FROM notification
ORDER BY created_at DESC
LIMIT 20;
