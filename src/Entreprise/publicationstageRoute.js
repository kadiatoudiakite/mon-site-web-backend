// src/Entreprise/publicationstageRoute.js
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
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

  jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt_ici', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls PDF, DOC, DOCX, TXT, JPG, JPEG, PNG, GIF, WEBP sont acceptés.'));
    }
  }
});

// ====================== RÉCUPÉRER TOUTES LES OFFRES DE L'ENTREPRISE ======================
router.get('/', authenticateToken, async (req, res) => {
  console.log('📋 [PUBLICATION] Récupération des offres pour entreprise ID:', req.user.id);

  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT
        o.id,
        o.titre,
        o.description,
        o.duree,
        o.date_debut,
        o.date_fin,
        o.fichier,
        o.id_domaine,
        o.created_at,
        d.nom as domaine_nom
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      WHERE o.id_entreprise = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    console.log('✅ [PUBLICATION] Récupérées:', offres.length, 'offres');
    res.status(200).json({
      success: true,
      data: offres
    });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur récupération offres:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des offres'
    });
  }
});

// ====================== CRÉER UNE NOUVELLE OFFRE ======================
router.post('/', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;

  console.log('🏢 [PUBLICATION] Création d\'une nouvelle offre');
  console.log('   Titre:', titre);
  console.log('   Entreprise ID:', req.user.id);
  console.log('   Fichier:', fichier);

  // Validation
  if (!titre || !description || !duree || !date_debut || !date_fin || !id_domaine) {
    console.warn('⚠️ [PUBLICATION] Champs manquants');
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont obligatoires'
    });
  }

  try {
    const pool = getDbPool(req);

    const [result] = await pool.execute(
      `INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, fichier, id_entreprise, id_domaine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre, description, duree, date_debut, date_fin, fichier, req.user.id, id_domaine]
    );

    console.log('✅ [PUBLICATION] Offre créée avec succès - ID:', result.insertId);
    res.status(201).json({
      success: true,
      message: 'Offre créée avec succès',
      offre: {
        id: result.insertId,
        titre,
        description,
        duree,
        date_debut,
        date_fin,
        fichier,
        id_domaine: parseInt(id_domaine)
      }
    });

  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur création offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de l\'offre'
    });
  }
});

// ====================== MODIFIER UNE OFFRE ======================
router.put('/:id', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { id } = req.params;
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;

  console.log('✏️ [PUBLICATION] Modification offre ID:', id);

  try {
    const pool = getDbPool(req);

    // Vérifier que l'offre appartient à l'entreprise
    const [existing] = await pool.execute(
      'SELECT id, fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée ou accès non autorisé'
      });
    }

    // Supprimer l'ancien fichier si un nouveau est uploadé
    if (fichier && existing[0].fichier) {
      const oldFilePath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    const [result] = await pool.execute(
      `UPDATE offre_stage SET
       titre = ?, description = ?, duree = ?, date_debut = ?, date_fin = ?,
       fichier = COALESCE(?, fichier), id_domaine = ?
       WHERE id = ? AND id_entreprise = ?`,
      [titre, description, duree, date_debut, date_fin, fichier, id_domaine, id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée'
      });
    }

    console.log('✅ [PUBLICATION] Offre modifiée avec succès');
    res.status(200).json({
      success: true,
      message: 'Offre modifiée avec succès'
    });

  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur modification offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la modification de l\'offre'
    });
  }
});

// ====================== SUPPRIMER UNE OFFRE ======================
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log('🗑️ [PUBLICATION] Suppression offre ID:', id);

  try {
    const pool = getDbPool(req);

    // Récupérer le fichier avant suppression
    const [existing] = await pool.execute(
      'SELECT fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée ou accès non autorisé'
      });
    }

    // Supprimer le fichier
    if (existing[0].fichier) {
      const filePath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const [result] = await pool.execute(
      'DELETE FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée'
      });
    }

    console.log('✅ [PUBLICATION] Offre supprimée avec succès');
    res.status(200).json({
      success: true,
      message: 'Offre supprimée avec succès'
    });

  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur suppression offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de l\'offre'
    });
  }
});

// ====================== TÉLÉCHARGER UN FICHIER ======================
router.get('/download/:filename', authenticateToken, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads', filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ success: false, message: 'Fichier non trouvé' });
  }
});

module.exports = router;