// src/Entreprise/offreStageEntrepriseRouter.js
/**
 * Routeur pour la gestion des offres de stage par les entreprises
 * CRUD + Commentaires + Statistiques + Notifications
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const { createStudentNotification } = require('../utils/notifications');

// ====================== CONFIGURATION ======================

const getDbPool = (req) => req.app.get('dbPool');

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024', (err, user) => {
    if (err || !user?.id) {
      return res.status(403).json({ success: false, message: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// ====================== RÉCUPÉRER LES DOMAINES (publique) ======================
// Cette route est volontairement publique pour permettre au frontend
// d'afficher les domaines même si l'utilisateur n'a pas de token valide.
router.get('/domaines', async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [domaines] = await pool.execute('SELECT id, nom FROM domaine ORDER BY nom');

    return res.status(200).json({ success: true, data: domaines });
  } catch (error) {
    console.error('Erreur récupération domaines:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des domaines' });
  }
});

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `offre-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|txt|jpg|jpeg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && 
        allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés : PDF, DOC, DOCX, TXT, JPG, PNG, GIF, WEBP'));
    }
  }
});

// ====================== VALIDATION ======================
const validateOffreData = (data) => {
  const errors = [];

  if (!data.titre?.trim() || data.titre.trim().length < 3) {
    errors.push('Le titre doit contenir au moins 3 caractères');
  }
  if (!data.description?.trim() || data.description.trim().length < 10) {
    errors.push('La description doit contenir au moins 10 caractères');
  }
  if (!data.duree?.trim()) errors.push('La durée est obligatoire');
  if (!data.date_debut || !data.date_fin) {
    errors.push('Les dates de début et fin sont obligatoires');
  } else {
    const debut = new Date(data.date_debut);
    const fin = new Date(data.date_fin);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (debut < today) errors.push('La date de début ne peut pas être dans le passé');
    if (fin <= debut) errors.push('La date de fin doit être postérieure à la date de début');
  }
  if (!data.id_domaine || isNaN(parseInt(data.id_domaine))) {
    errors.push('Le domaine est obligatoire');
  }

  return errors;
};

// ====================== ROUTES ======================

// Lister toutes les offres de l'entreprise
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT o.*, d.nom as domaine_nom,
             COALESCE(likes.count, 0) as likes_count,
             COALESCE(comments.count, 0) as comments_count
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      LEFT JOIN (SELECT id_offre_stage, COUNT(*) as count FROM aime GROUP BY id_offre_stage) likes 
        ON o.id = likes.id_offre_stage
      LEFT JOIN (SELECT id_offre_stage, COUNT(*) as count FROM commentaire GROUP BY id_offre_stage) comments 
        ON o.id = comments.id_offre_stage
      WHERE o.id_entreprise = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, data: offres });
  } catch (error) {
    console.error('Erreur récupération offres:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Détail d'une offre
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT o.*, d.nom as domaine_nom
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      WHERE o.id = ? AND o.id_entreprise = ?
    `, [req.params.id, req.user.id]);

    if (offres.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée ou accès refusé' });
    }

    res.json({ success: true, data: offres[0] });
  } catch (error) {
    console.error('Erreur détail offre:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une nouvelle offre
router.post('/', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file?.filename || null;

  const errors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Erreurs de validation', errors });
  }

  let connection;
  try {
    const pool = getDbPool(req);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, fichier, id_entreprise, id_domaine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, req.user.id, id_domaine]
    );

    const offreId = result.insertId;

    // Notifications
    const [entreprise] = await connection.execute('SELECT nom FROM entreprise WHERE id = ?', [req.user.id]);
    const nomEntreprise = entreprise[0]?.nom || 'Une entreprise';

    const [students] = await connection.execute('SELECT id FROM etudiant');

    for (const student of students) {
      await createStudentNotification({
        id_etudiant: student.id,
        titre: 'Nouvelle offre de stage',
        message: `${nomEntreprise} a publié une nouvelle offre : "${titre.trim()}"`,
        type: 'offre'
      });
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Offre créée avec succès',
      offre: { id: offreId, titre: titre.trim() }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erreur création offre:', error);

    if (req.file) {
      fs.unlinkSync(path.join(__dirname, '../../uploads', req.file.filename));
    }

    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'offre' });
  } finally {
    if (connection) connection.release();
  }
});

// Modifier une offre
router.put('/:id', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { id } = req.params;
  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file?.filename || null;

  const errors = validateOffreData({ titre, description, duree, date_debut, date_fin, id_domaine });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Erreurs de validation', errors });
  }

  let connection;
  try {
    const pool = getDbPool(req);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      'SELECT fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // Suppression ancien fichier
    if (fichier && existing[0].fichier) {
      const oldPath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await connection.execute(
      `UPDATE offre_stage 
       SET titre = ?, description = ?, duree = ?, date_debut = ?, date_fin = ?, 
           fichier = COALESCE(?, fichier), id_domaine = ?
       WHERE id = ? AND id_entreprise = ?`,
      [titre.trim(), description.trim(), duree.trim(), date_debut, date_fin, fichier, id_domaine, id, req.user.id]
    );

    // Notifications aux candidats
    const [entreprise] = await connection.execute('SELECT nom FROM entreprise WHERE id = ?', [req.user.id]);
    const [candidats] = await connection.execute(
      'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?', [id]
    );

    for (const c of candidats) {
      await createStudentNotification({
        id_etudiant: c.id_etudiant,
        titre: 'Offre modifiée',
        message: `L'offre "${titre.trim()}" a été mise à jour.`,
        type: 'offre'
      });
    }

    await connection.commit();
    res.json({ success: true, message: 'Offre modifiée avec succès' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erreur modification offre:', error);
    if (req.file) fs.unlinkSync(path.join(__dirname, '../../uploads', req.file.filename));
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// Supprimer une offre
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  let connection;
  try {
    const pool = getDbPool(req);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [offre] = await connection.execute(
      'SELECT titre, fichier FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (offre.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // Suppression fichier
    if (offre[0].fichier) {
      const filePath = path.join(__dirname, '../../uploads', offre[0].fichier);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Notifications
    const [candidats] = await connection.execute(
      'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?', [id]
    );

    await connection.execute('DELETE FROM offre_stage WHERE id = ? AND id_entreprise = ?', [id, req.user.id]);

    const [entreprise] = await connection.execute('SELECT nom FROM entreprise WHERE id = ?', [req.user.id]);

    for (const c of candidats) {
      await createStudentNotification({
        id_etudiant: c.id_etudiant,
        titre: 'Offre supprimée',
        message: `L'offre "${offre[0].titre}" a été supprimée par ${entreprise[0]?.nom || 'l\'entreprise'}.`,
        type: 'alerte'
      });
    }

    await connection.commit();
    res.json({ success: true, message: 'Offre supprimée avec succès' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erreur suppression offre:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  } finally {
    if (connection) connection.release();
  }
});

// ====================== COMMENTAIRES ======================
router.get('/:id/commentaires', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [comments] = await pool.execute(`
      SELECT c.id, c.contenu, c.created_at,
             COALESCE(e.nom, ent.nom) as auteur,
             CASE WHEN c.id_etudiant IS NOT NULL THEN 'etudiant' ELSE 'entreprise' END as type_auteur
      FROM commentaire c
      LEFT JOIN etudiant e ON c.id_etudiant = e.id
      LEFT JOIN entreprise ent ON c.id_entreprise = ent.id
      WHERE c.id_offre_stage = ?
      ORDER BY c.created_at DESC
    `, [req.params.id]);

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Erreur commentaires:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/:id/commentaires', authenticateToken, async (req, res) => {
  const { contenu } = req.body;
  const { id } = req.params;

  if (!contenu?.trim() || contenu.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Le commentaire doit contenir au moins 3 caractères' });
  }

  try {
    const pool = getDbPool(req);

    const [offreExists] = await pool.execute(
      'SELECT id FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (offreExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    const [result] = await pool.execute(
      `INSERT INTO commentaire (contenu, id_offre_stage, id_entreprise, created_at)
       VALUES (?, ?, ?, NOW())`,
      [contenu.trim(), id, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Commentaire ajouté', id: result.insertId });
  } catch (error) {
    console.error('Erreur post commentaire:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====================== STATISTIQUES ======================
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [stats] = await pool.execute(`
      SELECT 
        COALESCE(COUNT(DISTINCT a.id), 0) as likes,
        COALESCE(COUNT(DISTINCT c.id), 0) as comments
      FROM offre_stage o
      LEFT JOIN aime a ON a.id_offre_stage = o.id
      LEFT JOIN commentaire c ON c.id_offre_stage = o.id
      WHERE o.id = ?
    `, [req.params.id]);

    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer notifications pour l'étudiant connecté
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [notifications] = await pool.execute(`
      SELECT n.*, e.nom AS entreprise_nom, u.nom AS universite_nom
      FROM notification n
      LEFT JOIN entreprise e ON n.id_entreprise = e.id
      LEFT JOIN universite u ON n.id_universite = u.id
      WHERE (n.id_etudiant = ? OR n.target = 'all_students')
      ORDER BY n.created_at DESC
      LIMIT 100;
    `, [req.user.id]);

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Erreur notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;