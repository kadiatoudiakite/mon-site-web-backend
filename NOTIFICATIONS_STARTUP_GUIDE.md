## 🚀 GUIDE DE DÉMARRAGE - SYSTÈME DE NOTIFICATIONS

### ⚠️ PROBLÈME IDENTIFIÉ

❌ Le serveur n'écoutait que sur `localhost`, pas sur `0.0.0.0`
- Le téléphone mobile ne pouvait pas accéder au serveur via l'IP du réseau
- L'erreur "Network request failed" était due à l'inaccessibilité du serveur

### ✅ SOLUTION APPLIQUÉE

1. **server.js** - Changé le port d'écoute:
   ```javascript
   // AVANT:
   app.listen(PORT, () => { ... })
   
   // APRÈS:
   app.listen(PORT, '0.0.0.0', () => { ... })
   ```

2. **CORS amélioré** - Configuration plus permissive:
   ```javascript
   app.use(cors({
     origin: function(origin, callback) {
       callback(null, true); // Accepter toutes les origines
     },
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
     allowedHeaders: ['Content-Type', 'Authorization']
   }));
   ```

3. **Meilleure gestion d'erreur mobile** - Logs détaillés et timeout:
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 10000);
   // ... (timeout de 10 secondes)
   ```

---

## 🎯 DÉMARRAGE DU SERVEUR

### Option 1: Démarrage normal
```bash
cd c:\Users\admin\Desktop\backend-stagetrack
npm start
```

### Option 2: Démarrage avec script de startup (recommandé)
```bash
cd c:\Users\admin\Desktop\backend-stagetrack
node startup.js
```

Le script affichera:
- ✅ Les adresses IP disponibles
- ✅ Les URLs d'accès (local + réseau + mobile)
- ✅ Les routes principales
- ✅ Les informations de débogage

### Option 3: Vérifier la connectivité
```bash
cd c:\Users\admin\Desktop\backend-stagetrack
node test_connectivity.js
```

---

## 📱 CONFIGURATION MOBILE (Expo)

L'URL de l'API est détectée automatiquement par Expo:
```typescript
// app/(config)/config.ts
const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
return `http://${localhost}:5000/api`;
```

**Vérifiez dans les logs de l'app:**
```
🔍 DEBUG Notifications:
   URL: http://192.168.X.X:5000/api/etudiants/notifications
   Token exists: true
   Token length: 195
```

---

## ✅ VÉRIFICATION DE LA CONNEXION

### 1️⃣ Vérifier que le serveur écoute sur 0.0.0.0
```bash
# Linux/Mac:
netstat -an | grep 5000

# Windows:
netstat -ano | findstr :5000
```

Vous devriez voir:
```
LISTENING 0.0.0.0:5000
```

### 2️⃣ Tester la requête avec curl
```bash
# Récupérer un token d'abord
TOKEN=$(curl -s -X POST http://localhost:5000/api/etudiants/login \
  -H "Content-Type: application/json" \
  -d '{"email":"etudiant@test.fr","motdepasse":"password"}' | jq -r '.token')

# Tester les notifications
curl http://localhost:5000/api/etudiants/notifications \
  -H "Authorization: Bearer $TOKEN"
```

### 3️⃣ Tester depuis le téléphone/émulateur
```bash
# Trouver votre IP locale:
# Linux/Mac: ifconfig | grep "inet "
# Windows: ipconfig | findstr "IPv4"

# Exemple: 192.168.1.100
curl http://192.168.1.100:5000/api/etudiants/notifications \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 DÉBOGAGE

### Les logs du serveur devraient afficher:

```
✅ [AUTH] Token valide - Étudiant ID: 1
📥 Récupération notifications pour étudiant ID: 1
✅ Notifications trouvées: 3
```

### Les logs du mobile devraient afficher:

```
🔍 DEBUG Notifications:
   URL: http://192.168.137.198:5000/api/etudiants/notifications
   Token exists: true
   Token length: 195
📡 Envoi de la requête fetch...
📡 Response status: 200
✅ Notifications reçues: 3
```

---

## ❌ RÉSOLUTION DES ERREURS

### "Network request failed"
```
✅ Cause: Serveur n'écoute pas sur 0.0.0.0
✅ Solution: Relancer le serveur (app.listen(PORT, '0.0.0.0', ...))
```

### "Token invalide ou expiré"
```
✅ Cause: Token expiré ou pas de token
✅ Solution: Se reconnecter pour obtenir un nouveau token
```

### "Timeout: la requête a pris trop longtemps"
```
✅ Cause: Serveur lent ou réseau lent
✅ Solution: Vérifier la connexion réseau ou augmenter le timeout (actuellement 10s)
```

### "Aucun token trouvé"
```
✅ Cause: Pas connecté
✅ Solution: Se connecter d'abord, puis accéder aux notifications
```

---

## 📊 STATISTIQUES

Après le démarrage, vérifiez les notifications:

```bash
node test_notifications.js
```

Affichera:
- ✅ Structure de la table notification
- ✅ Total de notifications (exemple: 11)
- ✅ Non lues (exemple: 0)
- ✅ Par étudiant
- ✅ Par type (candidature, offre, message, etc)

---

## 🎬 FLUX COMPLET

1. **Démarrer le serveur:**
   ```bash
   node startup.js
   ```

2. **Lancer l'app mobile (Expo):**
   ```bash
   npm start
   # Ou: expo start
   ```

3. **Connexion:**
   - Email: etudiant@test.fr
   - Mot de passe: password

4. **Voir les notifications:**
   - Aller à l'onglet "Notifications"
   - Les notifications s'affichent automatiquement
   - 🔄 Refresh manuel ou auto-refresh toutes les 30s

---

## 🎯 ACTIONS QUI CRÉENT LES NOTIFICATIONS

### Étudiant
- ✅ Postule à une offre → Notification pour entreprise + université + étudiant

### Entreprise
- ✅ Change le statut de candidature → Notification pour étudiant + université

### Université
- ✅ Change le statut de candidature → Notification pour étudiant + entreprise
- ✅ Publie une offre → Notifications pour étudiants + entreprises partenaires

---

## 📞 SUPPORT

Si ça ne marche toujours pas:

1. Vérifier les logs du serveur (erreurs rouges)
2. Vérifier la console de l'app mobile
3. Vérifier que le PORT 5000 n'est pas utilisé par autre chose
4. Vérifier la connexion WiFi (mobile et ordateur doivent être sur le même réseau)
5. Exécuter `node test_connectivity.js` pour diagnostiquer
6. Redémarrer le serveur et l'app mobile

---

**Last Updated: 16 May 2026**
