// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS amélioré pour supporter les connexions mobiles
app.use(cors({
  origin: function(origin, callback) {
    // Accepter toutes les origines en développement (mobile, web, localhost)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
}));

// Ajouter les headers de sécurité et de compatibilité
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Répondre aux pré-requêtes OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/uploads', express.static('uploads'));
app.set('dbPool', pool);

// ==================== ROUTES UNIVERSITÉ ====================
// On regroupe tout sous /api/universites pour éviter les 404
const univAuth = require('./src/Universite/connexion_universite');
const univPub = require('./src/Universite/publication_universite');
const univSup = require('./src/Universite/supervisionUniversite');

app.use('/api/entreprises', require('./src/Universite/creation_entreprise'));
app.use('/api/universites', univAuth); // Login, Profil, Domaines
app.use('/api/universites', univPub);  // CRUD Offres (supporte / et /publication_universite)
app.use('/api/universites/supervision', univSup); // Stats, Vue globale
app.use('/api/universites/analyse', require('./src/Universite/analyse_universite')); // Nouveau module d'analyse
app.use('/api/universites/etudiants/analyse', require('./src/Universite/analyse_etudiant')); // Analyse détaillée étudiants
app.use('/api/universites/partenariat', require('./src/Universite/partenariat')); // Gestion des partenariats
app.use('/api/universites/candidatures', require('./src/Universite/candidature')); // Gestion des candidatures
app.use('/api/admin', require('./src/Universite/creation_admin'));


// ==================== ROUTES ENTREPRISE ====================
app.use('/api/entreprises/auth', require('./src/Entreprise/connexionentrepriseRoutes'));
app.use('/api/connexion', require('./src/Entreprise/connexionentrepriseRoutes')); // Alias pour compatibilité
app.use('/api/entreprises/profil', require('./src/Entreprise/profilentreprise.js'));
app.use('/api/profil-entreprise', require('./src/Entreprise/profilentreprise.js')); // Alias pour compatibilité
app.use('/api/entreprises/offres', require('./src/Entreprise/publicationstageRoute'));
app.use('/api/publications', require('./src/Entreprise/publicationstageRoute')); // Alias pour compatibilité
app.use('/api/entreprises/candidatures', require('./src/Entreprise/gestionCandidatures'));
// ==================== ROUTES MESSAGERIE & NOTIFICATIONS ====================
app.use('/api/messagerie', require('./src/Universite/messagerie'));
app.use('/api/notifications', require('./src/Entreprise/notificationentreprise'));
app.use('/api/universites/notifications', require('./src/Universite/NotificationUniversite'));
app.use('/api/etudiants/notifications', require('./src/Etudiant/NotificationEtudiant'));
// ==================== ROUTES ÉTUDIANT ====================
app.use('/api/etudiants', require('./src/Etudiant/connexion'));
app.use('/api/etudiants/offres', require('./src/Etudiant/offre'));
app.use('/api/etudiants/entreprises', require('./src/Etudiant/entreprise'));
app.use('/api/etudiants/stages', require('./src/Etudiant/mes_stage'));
app.use('/api/etudiants/docs', require('./src/Etudiant/rapport.js'));
app.use('/api/etudiants/profil', require('./src/Etudiant/profil'));
app.use('/api/etudiants/status', require('./src/Etudiant/candidature'));
app.use('/api/rapports', require('./src/Rapport/rapport')); // Gestion des rapports

// Route racine de test
app.get('/', (req, res) => {
  res.json({ message: 'Serveur StageTrack démarré !', status: 'OK' });
});

// Middleware de gestion des erreurs pour toujours renvoyer du JSON
app.use((err, req, res, next) => {
  console.error('💥 ERREUR SERVEUR:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue sur le serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Gestion 404 en JSON
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée : ${req.method} ${req.url}`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur StageTrack démarré sur http://0.0.0.0:${PORT}`);
  console.log(`   Accessible localement: http://localhost:${PORT}`);
  console.log(`   Accessible sur le réseau: http://<votre-ip>:${PORT}`);
});