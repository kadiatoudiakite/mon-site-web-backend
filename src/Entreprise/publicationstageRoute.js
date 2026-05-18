// src/Entreprise/publicationstageRoute.js
/**
 * Rôle : Routeur principal de la publication. Il regroupe les routes statiques
 * (domaines, téléchargement) et intègre les deux autres fichiers de routes
 * pour conserver la compatibilité et tout regrouper.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const router = express.Router();

console.log('Publication Stage routes loaded');

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// Middleware d'authentification JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token invalide' });
    }
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'Token invalide : identifiant utilisateur manquant' });
    }
    req.user = user;
    next();
  });
};

// ====================== RÉCUPÉRER LES DOMAINES ======================
router.get('/domaines', authenticateToken, async (req, res) => {
  console.log('🏷️ [PUBLICATION] Récupération des domaines');

  try {
    const pool = getDbPool(req);
    const [domaines] = await pool.execute('SELECT id, nom FROM domaine ORDER BY nom');

    console.log('✅ [PUBLICATION] Domaines récupérés:', domaines.length);
    res.status(200).json({
      success: true,
      data: domaines
    });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur récupération domaines:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des domaines'
    });
  }
});

// ====================== TÉLÉCHARGER UN FICHIER ======================
router.get('/download/:filename', authenticateToken, async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads', filename);

  try {
    const pool = getDbPool(req);

    // Vérifier que le fichier appartient à une offre de l'entreprise connectée
    const [rows] = await pool.execute(
      'SELECT id FROM offre_stage WHERE fichier = ? AND id_entreprise = ? LIMIT 1',
      [filename, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé à ce fichier' });
    }

    if (fs.existsSync(filePath)) {
      res.download(filePath, (err) => {
        if (err) {
          console.error('💥 [PUBLICATION] Erreur téléchargement:', err);
          res.status(500).json({ success: false, message: 'Erreur lors du téléchargement' });
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur vérification fichier:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors du téléchargement' });
  }
});

// ====================== IMPORT DES AUTRES ROUTEURS ======================
const publicationOffresRouter = require('./publicationOffresRouter');
const offreStageEntrepriseRouter = require('./offreStageEntrepriseRouter');

// On utilise les routeurs avec les routes dynamiques en dernier pour éviter les conflits de routes (ex: /:id)
router.use('/', publicationOffresRouter); // /:id/commentaires, /:id/stats
router.use('/', offreStageEntrepriseRouter); // /, /:id (doit venir en tout dernier)

module.exports = router;