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

// Validation des données d'offre
const validateOffreData = (data) => {
  const errors = [];

  if (!data.titre || data.titre.trim().length < 3) {
    errors.push('Le titre doit contenir au moins 3 caractères');
  }

  if (!data.description || data.description.trim().length < 10) {
    errors.push('La description doit contenir au moins 10 caractères');
  }

  if (!data.duree || data.duree.trim().length === 0) {
    errors.push('La durée est obligatoire');
  }

  if (!data.date_debut || !data.date_fin) {
    errors.push('Les dates de début et fin sont obligatoires');
  } else {
    const parseLocalDate = (str) => {
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const dateDebut = parseLocalDate(data.date_debut);
    const dateFin = parseLocalDate(data.date_fin);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateDebut < today) {
      errors.push('La date de début ne peut pas être dans le passé');
    }

    if (dateFin <= dateDebut) {
      errors.push('La date de fin doit être postérieure à la date de début');
    }
  }

  if (!data.id_domaine || isNaN(parseInt(data.id_domaine))) {
    errors.push('Le domaine est obligatoire et doit être valide');
  }

  return errors;
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

// ====================== RÉCUPÉRER UNE OFFRE SPÉCIFIQUE ======================
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log('📄 [PUBLICATION] Récupération offre ID:', id);

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
      WHERE o.id = ? AND o.id_entreprise = ?
    `, [id, req.user.id]);

    if (offres.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée ou accès non autorisé'
      });
    }

    console.log('✅ [PUBLICATION] Offre récupérée');
    res.status(200).json({
      success: true,
      data: offres[0]
    });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur récupération offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'offre'
    });
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
        o.statut,
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
  const validationErrors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (validationErrors.length > 0) {
    console.warn('⚠️ [PUBLICATION] Erreurs de validation:', validationErrors);
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: validationErrors
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier que le domaine existe
    const [domaineCheck] = await pool.execute('SELECT id FROM domaine WHERE id = ?', [id_domaine]);
    if (domaineCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Domaine invalide'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, fichier, id_entreprise, id_domaine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, req.user.id, id_domaine]
    );

    console.log('✅ [PUBLICATION] Offre créée avec succès - ID:', result.insertId);
    res.status(201).json({
      success: true,
      message: 'Offre créée avec succès',
      offre: {
        id: result.insertId,
        titre: titre.trim(),
        description: description.trim(),
        duree: duree.trim(),
        date_debut,
        date_fin,
        fichier,
        id_domaine: parseInt(id_domaine)
      }
    });

  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur création offre:', error.message);

    // Supprimer le fichier uploadé en cas d'erreur
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

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

  // Validation
  const validationErrors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (validationErrors.length > 0) {
    console.warn('⚠️ [PUBLICATION] Erreurs de validation:', validationErrors);
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: validationErrors
    });
  }

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

    // Vérifier que le domaine existe
    const [domaineCheck] = await pool.execute('SELECT id FROM domaine WHERE id = ?', [id_domaine]);
    if (domaineCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Domaine invalide'
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
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, id_domaine, id, req.user.id]
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

    // Supprimer le fichier uploadé en cas d'erreur
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

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

// Gestionnaire d'erreurs multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux. Taille maximale: 10MB'
      });
    }
  }

  if (error.message.includes('Type de fichier non autorisé')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error('💥 [PUBLICATION] Erreur multer:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur lors du traitement du fichier'
  });
});

module.exports = router;