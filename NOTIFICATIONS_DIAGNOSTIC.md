📋 DIAGNOSTIC COMPLET DU SYSTÈME DE NOTIFICATIONS
================================================

✅ CHECKLIST DE VÉRIFICATION:

1. BASE DE DONNÉES
   ❓ Exécuter: mysql> SOURCE migrations/create_notification_table.sql;
   ❓ Ou: mysql> SOURCE migrations/verify_notification_schema.sql;
   
   Colonnes attendues:
   - id (INT, PRIMARY KEY, AUTO_INCREMENT)
   - id_universite (INT, NULL, FOREIGN KEY)
   - id_entreprise (INT, NULL, FOREIGN KEY)
   - id_etudiant (INT, NULL, FOREIGN KEY)
   - titre (VARCHAR 255, NOT NULL)
   - message (TEXT, NOT NULL)
   - type (VARCHAR 50, DEFAULT 'info')
   - statut (ENUM 'non_lu'/'lu', DEFAULT 'non_lu')
   - created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

2. BACKEND ROUTES
   ✅ GET /api/etudiants/notifications
      - Récupère les notifications de l'étudiant connecté
      - Require: Token JWT valide
      - Response: { success: true, data: [...], count: X, etudiantId: Y }
   
   ✅ PUT /api/etudiants/notifications/marquer-lu/:id
      - Marque une notification comme lue
      - Require: Token JWT valide
      - Response: { success: true, message: '...' }
   
   ✅ PUT /api/etudiants/notifications/marquer-tout-lu
      - Marque toutes les notifications comme lues
      - Require: Token JWT valide
      - Response: { success: true, message: '...' }
   
   ✅ DELETE /api/etudiants/notifications/:id
      - Supprime une notification
      - Require: Token JWT valide
      - Response: { success: true, message: '...' }
   
   ✅ GET /api/etudiants/notifications/unread-count
      - Compte les notifications non lues
      - Require: Token JWT valide
      - Response: { success: true, count: X }

3. MOBILE APP
   ✅ URL API: http://{HOST_IP}:5000/api
      - Détectée automatiquement par Expo
      - Debug: Affichée dans console.log
   
   ✅ Token stocké dans AsyncStorage
      - Clé: 'token'
      - Récupéré automatiquement avant chaque requête
   
   ✅ Routes disponibles:
      - GET /etudiants/notifications
      - PUT /etudiants/notifications/marquer-lu/{id}
      - PUT /etudiants/notifications/marquer-tout-lu
      - DELETE /etudiants/notifications/{id}

4. CRÉATIONS DE NOTIFICATIONS (Actions qui génèrent des notifications)
   ✅ Candidature à une offre
      Source: src/Etudiant/mes_stage.js
      Cible: id_entreprise (notification entreprise)
             id_universite (notification université)
             id_etudiant (notification étudiant)
      Type: 'candidature'
   
   ✅ Décision sur candidature (Entreprise)
      Source: src/Entreprise/gestionCandidatures.js
      Cible: id_etudiant (notification étudiant)
             id_universite (notification université)
      Type: 'candidature'
   
   ✅ Décision sur candidature (Université)
      Source: src/Universite/candidature.js
      Cible: id_etudiant (notification étudiant)
             id_entreprise (notification entreprise)
      Type: 'candidature'
   
   ✅ Publication d'offre (Entreprise)
      Source: src/Entreprise/publicationstageRoute.js
      Cible: id_etudiant (notifications étudiants)
             id_universite (notifications universités partenaires)
      Type: 'offre'
   
   ✅ Publication d'offre (Université)
      Source: src/Universite/publication_universite.js
      Cible: id_etudiant (notifications étudiants)
             id_entreprise (notifications entreprises partenaires)
      Type: 'offre'

5. TEST LOCAL
   Commande: node test_notifications.js
   
   Affiche:
   - ✅ Vérification que la table existe
   - ✅ Structure de la table
   - ✅ Statistiques (total, non lues)
   - ✅ Dernières notifications
   - ✅ Distribution par étudiant
   - ✅ Types de notifications utilisés

6. DÉBOGAGE
   Mobile (console.log):
   🔍 DEBUG Notifications:
      URL: http://XX.XX.XX.XX:5000/api/etudiants/notifications
      Token exists: true/false
      Token length: XXX
   📡 Response status: 200/401/500
   ✅ Notifications reçues: XXX

   Backend (console.log):
   📥 Récupération notifications pour étudiant ID: X
   ✅ Notifications trouvées: XXX
   ✅ [AUTH] Token valide - Université ID: X

7. ERREURS COURANTES
   ❌ "Network request failed"
      → Vérifier que le serveur backend écoute sur 0.0.0.0:5000
      → Vérifier que l'IP détectée par Expo est correcte
      → Vérifier la connexion réseau
   
   ❌ "Token invalide ou expiré"
      → Vérifier que le token est stocké dans AsyncStorage
      → Se reconnecter pour obtenir un nouveau token
   
   ❌ "Notification non trouvée"
      → Vérifier que l'ID de notification existe
      → Vérifier que la notification appartient à l'utilisateur
   
   ❌ "No notifications"
      → Vérifier que des notifications ont été créées
      → Vérifier que id_etudiant est défini dans la base de données
      → Exécuter test_notifications.js pour voir les données

8. COMMANDES MYSQL UTILES
   -- Voir toutes les notifications
   SELECT * FROM notification ORDER BY created_at DESC;
   
   -- Voir les notifications d'un étudiant
   SELECT * FROM notification WHERE id_etudiant = 1 ORDER BY created_at DESC;
   
   -- Voir les notifications non lues
   SELECT * FROM notification WHERE statut = 'non_lu' ORDER BY created_at DESC;
   
   -- Marquer tout comme lu
   UPDATE notification SET statut = 'lu' WHERE id_etudiant = 1;
   
   -- Supprimer les anciennes notifications (> 30 jours)
   DELETE FROM notification WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

9. FLUX DE DONNÉES
   ÉTUDIANT POSTULE → Candidature créée
   ↓
   Notification créée avec id_etudiant
   ↓
   Mobile: GET /api/etudiants/notifications
   ↓
   Query DB: SELECT * FROM notification WHERE id_etudiant = ?
   ↓
   Response avec titre, message, statut, type
   ↓
   Affichage dans l'app mobile

10. POINTS IMPORTANTS
   ✅ La clé étrangère ON DELETE SET NULL pour id_etudiant permet de garder les notifications même si l'étudiant est supprimé
   ✅ Les index sur id_etudiant, id_entreprise, id_universite permettent des requêtes rapides
   ✅ Les LEFT JOIN avec entreprise et universite permettent d'afficher les noms
   ✅ Le champ statut ENUM évite les valeurs invalides
   ✅ created_at DEFAULT CURRENT_TIMESTAMP fixe la date automatiquement

---
Pour lancer le test: node test_notifications.js
Pour vérifier la DB: mysql < migrations/verify_notification_schema.sql
