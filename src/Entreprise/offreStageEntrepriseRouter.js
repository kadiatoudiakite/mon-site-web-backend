// src/Entreprise/offreStageEntrepriseRouter.js
/**
 * Rôle : Routeur pour la gestion principale des offres de stage (CRUD).
 * Contient les routes pour récupérer, créer, modifier et supprimer les offres.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// Import de la fonction centralisée de notification
const { createStudentNotification } = require('../utils/notifications'); // Ajustez le chemin si nécessaire

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

    if (dateDebut < today) errors.push('La date de début ne peut pas être dans le passé');
    if (dateFin <= dateDebut) errors.push('La date de fin doit être postérieure à la date de début');
  }
  if (!data.id_domaine || isNaN(parseInt(data.id_domaine))) {
    errors.push('Le domaine est obligatoire et doit être valide');
  }

  return errors;
};

// Configuration multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    else cb(new Error('Type de fichier non autorisé. Seuls PDF, DOC, DOCX, TXT, images sont acceptés.'));
  }
});

// ====================== RÉCUPÉRER TOUTES LES OFFRES ======================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT o.id, o.titre, o.description, o.duree, o.date_debut, o.date_fin, 
             o.fichier, o.id_domaine, o.created_at, o.statut,
             d.nom as domaine_nom,
             COALESCE(likes.count, 0) as likes_count,
             COALESCE(comments.count, 0) as comments_count
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      LEFT JOIN (SELECT id_offre_stage, COUNT(*) as count FROM aime GROUP BY id_offre_stage) likes ON o.id = likes.id_offre_stage
      LEFT JOIN (SELECT id_offre_stage, COUNT(*) as count FROM commentaire GROUP BY id_offre_stage) comments ON o.id = comments.id_offre_stage
      WHERE o.id_entreprise = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.status(200).json({ success: true, data: offres });
  } catch (error) {
    console.error('Erreur récupération offres:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====================== CRÉER UNE NOUVELLE OFFRE ======================
router.post('/', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;

  const validationErrors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: 'Erreurs de validation', errors: validationErrors });
  }

  try {
    const pool = getDbPool(req);
    const entrepriseId = req.user.id;

    // Vérifier domaine
    const [domaineCheck] = await pool.execute('SELECT id FROM domaine WHERE id = ?', [id_domaine]);
    if (domaineCheck.length === 0) {
      return res.status(400).json({ success: false, message: 'Domaine invalide' });
    }

    const [result] = await pool.execute(
      `INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, fichier, id_entreprise, id_domaine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, entrepriseId, id_domaine]
    );

    const offreId = result.insertId;

    // ====================== NOTIFICATIONS ======================
    try {
      const [ent] = await pool.execute('SELECT nom FROM entreprise WHERE id = ?', [entrepriseId]);
      const entrepriseNom = ent.length > 0 ? ent[0].nom : 'Une entreprise';

      // 1. Notification à tous les étudiants
      const [students] = await pool.execute(
        'SELECT id FROM etudiant'
      );

      for (const student of students) {
        await createStudentNotification({
          id_etudiant: student.id,
          id_entreprise: entrepriseId,
          titre: 'Nouvelle opportunité de stage !',
          message: `${entrepriseNom} a publié une nouvelle offre : "${titre.trim()}"`,
          type: 'offre'
        });
      }

      // 2. Notification aux universités partenaires (optionnel)
      const [partenaires] = await pool.execute(`
        SELECT DISTINCT id_universite 
        FROM demande_partenariat 
        WHERE id_entreprise = ? AND statut = 'Acceptée'
      `, [entrepriseId]);

      // Vous pouvez garder ou supprimer selon vos besoins
      // (utilisez createNotification pour université si vous avez une fonction dédiée)

    } catch (notifError) {
      console.error('Erreur lors des notifications de création offre:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Offre créée avec succès',
      offre: { id: offreId, titre: titre.trim(), ...req.body, fichier }
    });

  } catch (error) {
    console.error('Erreur création offre:', error.message);
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la création' });
  }
});

// ====================== MODIFIER UNE OFFRE ======================
router.put('/:id', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { id } = req.params;
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;
  const entrepriseId = req.user.id;

  const validationErrors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: 'Erreurs de validation', errors: validationErrors });
  }

  try {
    const pool = getDbPool(req);

    const [existing] = await pool.execute(
      'SELECT fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?', 
      [id, entrepriseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // Suppression ancien fichier si nouveau upload
    if (fichier && existing[0].fichier) {
      const oldPath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const [result] = await pool.execute(
      `UPDATE offre_stage SET titre = ?, description = ?, duree = ?, date_debut = ?, 
       date_fin = ?, fichier = COALESCE(?, fichier), id_domaine = ?
       WHERE id = ? AND id_entreprise = ?`,
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, id_domaine, id, entrepriseId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // ====================== NOTIFICATIONS ======================
    try {
      const [ent] = await pool.execute('SELECT nom FROM entreprise WHERE id = ?', [entrepriseId]);
      const entrepriseNom = ent.length > 0 ? ent[0].nom : 'Une entreprise';

      const [postulants] = await pool.execute(
        'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?',
        [id]
      );

      for (const p of postulants) {
        await createStudentNotification({
          id_etudiant: p.id_etudiant,
          id_entreprise: entrepriseId,
          titre: 'Offre de stage mise à jour',
          message: `L'offre "${titre.trim()}" à laquelle vous avez postulé a été modifiée par ${entrepriseNom}.`,
          type: 'offre'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification modification offre:', notifError);
    }

    res.json({ success: true, message: 'Offre modifiée avec succès' });

  } catch (error) {
    console.error('Erreur modification offre:', error.message);
    if (req.file) {
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====================== SUPPRIMER UNE OFFRE ======================
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const entrepriseId = req.user.id;

  try {
    const pool = getDbPool(req);

    const [existing] = await pool.execute(
      'SELECT titre, fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, entrepriseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    const titreOffre = existing[0].titre;

    // Suppression fichier
    if (existing[0].fichier) {
      const filePath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const [postulants] = await pool.execute(
      'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, entrepriseId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // ====================== NOTIFICATIONS ======================
    try {
      const [ent] = await pool.execute('SELECT nom FROM entreprise WHERE id = ?', [entrepriseId]);
      const entrepriseNom = ent.length > 0 ? ent[0].nom : 'Une entreprise';

      for (const p of postulants) {
        await createStudentNotification({
          id_etudiant: p.id_etudiant,
          id_entreprise: entrepriseId,
          titre: 'Offre de stage supprimée',
          message: `${entrepriseNom} a retiré l'offre "${titreOffre}" à laquelle vous aviez postulé.`,
          type: 'alerte'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification suppression offre:', notifError);
    }

    res.json({ success: true, message: 'Offre supprimée avec succès' });

  } catch (error) {
    console.error('Erreur suppression offre:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression' });
  }
});

module.exports = router;