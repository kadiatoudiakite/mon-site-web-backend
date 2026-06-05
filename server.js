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

// CORS
app.use(cors({
  origin: true, // Accepte toutes les origines en développement
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Headers de sécurité
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/uploads', express.static('uploads'));
app.set('dbPool', pool);

// ==================== ROUTES UNIVERSITÉ ====================
app.use('/api/entreprises', require('./src/Universite/creation_entreprise'));
app.use('/api/universites', require('./src/Universite/connexion_universite'));
app.use('/api/universites', require('./src/Universite/publication_universite'));
app.use('/api/universites/supervision', require('./src/Universite/supervisionUniversite'));
app.use('/api/universites/analyse', require('./src/Universite/analyse_universite'));
app.use('/api/universites/etudiants/analyse', require('./src/Universite/analyse_etudiant'));
app.use('/api/universites/partenariat', require('./src/Universite/partenariat'));
app.use('/api/universites/candidatures', require('./src/Universite/candidature'));
app.use('/api/admin', require('./src/Universite/creation_admin'));

// ==================== ROUTES ENTREPRISE ====================
app.use('/api/entreprises/auth', require('./src/Entreprise/connexionentrepriseRoutes'));
app.use('/api/connexion', require('./src/Entreprise/connexionentrepriseRoutes'));

app.use('/api/entreprises/profil', require('./src/Entreprise/profilentreprise.js'));
app.use('/api/profil-entreprise', require('./src/Entreprise/profilentreprise.js'));

// Routes Publications (IMPORTANT : une seule déclaration)
const publicationRouter = require('./src/Entreprise/offreStageEntrepriseRouter');

app.use('/api/entreprises/offres', publicationRouter);
app.use('/api/publications', publicationRouter);   // ← Route utilisée par ton frontend

app.use('/api/entreprises/candidatures', require('./src/Entreprise/gestionCandidatures'));

// ==================== AUTRES ROUTES ====================
app.use('/api/messagerie', require('./src/Universite/messagerie'));
app.use('/api/notifications', require('./src/Entreprise/notificationentreprise'));
app.use('/api/universites/notifications', require('./src/Universite/NotificationUniversite'));
app.use('/api/etudiants/notifications', require('./src/Etudiant/NotificationEtudiant'));

app.use('/api/etudiants', require('./src/Etudiant/connexion'));
app.use('/api/etudiants/offres', require('./src/Etudiant/offre'));
app.use('/api/etudiants/entreprises', require('./src/Etudiant/entreprise'));
app.use('/api/etudiants/stages', require('./src/Etudiant/mes_stage'));
app.use('/api/etudiants/docs', require('./src/Etudiant/rapport.js'));
app.use('/api/etudiants/profil', require('./src/Etudiant/profil'));
app.use('/api/etudiants/status', require('./src/Etudiant/candidature'));
app.use('/api/rapports', require('./src/Rapport/rapport'));

// Route racine
app.get('/', (req, res) => {
  res.json({ message: 'Serveur StageTrack démarré avec succès !', status: 'OK' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('💥 ERREUR SERVEUR:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée : ${req.method} ${req.url}`
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur StageTrack démarré sur http://localhost:${PORT}`);
});