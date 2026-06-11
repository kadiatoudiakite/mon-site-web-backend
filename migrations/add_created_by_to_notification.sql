-- Ajouter le champ created_by pour suivre qui a créé la notification
-- Cela permet d'éviter qu'un utilisateur reçoive ses propres notifications

ALTER TABLE notification 
ADD COLUMN created_by VARCHAR(50) DEFAULT NULL 
AFTER type;

-- Ajouter un commentaire pour expliquer le champ
ALTER TABLE notification 
MODIFY COLUMN created_by VARCHAR(50) DEFAULT NULL 
COMMENT 'Type de l''utilisateur qui a créé la notification: entreprise, universite, etudiant, systeme';
