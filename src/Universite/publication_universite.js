// src/Universite/universitePublicationRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

console.log('Universite Publication Stage routes loaded');

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// Middleware d'authentification JWT
const { verifyToken: authenticateToken } = require('../middlewares/auth');


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

// ====================== RÉCUPÉRER TOUTES LES OFFRES DE L'UNIVERSITÉ ======================
// Récupérer les offres — token facultatif : si token présent, renvoie les offres de l'université connectée, sinon renvoie les offres publiques
router.get('/', async (req, res) => {
  console.log('📋 [PUBLICATION UNIVERSITE] Récupération des offres (auth optional)');

  // Vérifier présence du token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  try {
    const pool = getDbPool(req);

    if (token) {
      // tenter de vérifier le token
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024');

        req.user = user;
        console.log('📋 [PUBLICATION UNIVERSITE] Requête authentifiée, universite ID:', user.id);
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
          WHERE o.id_universite = ?
          ORDER BY o.created_at DESC
        `, [user.id]);

        return res.status(200).json({ success: true, data: offres });
      } catch (err) {
        console.warn('⚠️ [PUBLICATION UNIVERSITE] Token invalide — tombons en public');
        // continuer en mode public
      }
    }

    // Mode public : renvoyer les offres publiques
    const [offresPublic] = await pool.execute(`
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
        d.nom as domaine_nom,
        u.nom as universite_nom
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      LEFT JOIN universite u ON o.id_universite = u.id
      ORDER BY o.created_at DESC
      LIMIT 100
    `);

    return res.status(200).json({ success: true, data: offresPublic });
  } catch (error) {
    console.error('💥 [PUBLICATION UNIVERSITE] Erreur récupération offres:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des offres' });
  }
});

// ====================== CRÉER UNE NOUVELLE OFFRE ======================
router.post(['/', '/publication_universite'], authenticateToken, upload.single('fichier'), async (req, res) => {
  console.log('🏢 [PUBLICATION UNIVERSITE] Création d\'une nouvelle offre');

  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;

  if (!titre || !description || !duree || !date_debut || !date_fin || !id_domaine) {
    console.warn('⚠️ [PUBLICATION UNIVERSITE] Champs manquants');
    return res.status(400).json({ success: false, message: 'Tous les champs obligatoires doivent être remplis' });
  }

  try {
    const pool = getDbPool(req);
    const [result] = await pool.execute(
      `INSERT INTO offre_stage (titre, description, duree, date_debut, date_fin, fichier, id_universite, id_domaine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre, description, duree, date_debut, date_fin, fichier, req.user.id, id_domaine]
    );

    console.log('✅ [PUBLICATION UNIVERSITE] Offre créée avec succès - ID:', result.insertId);

    // Notification aux entreprises partenaires
    try {
      const { createNotification } = require('../Entreprise/notificationentreprise');
      const [univInfo] = await pool.execute('SELECT nom FROM universite WHERE id = ?', [req.user.id]);
      const univNom = univInfo.length > 0 ? univInfo[0].nom : 'Une université';

      // Récupérer les entreprises partenaires (demandes acceptées)
      const [partenaires] = await pool.execute(
        `SELECT DISTINCT id_entreprise FROM demande_partenariat 
         WHERE id_universite = ? AND statut = 'Acceptée' AND id_entreprise IS NOT NULL`,
        [req.user.id]
      );

      for (const p of partenaires) {
        await createNotification({
          id_entreprise: p.id_entreprise,
          id_universite: req.user.id,
          titre: 'Nouvelle offre de stage universitaire',
          message: `${univNom} a publié une nouvelle offre : "${titre}"`,
          type: 'offre',
          created_by: 'universite'
        });
      }

      // NOTIFIER LES ÉTUDIANTS DE L'UNIVERSITÉ
      try {
        const { createStudentNotification } = require('../utils/notifications');
        const [students] = await pool.execute('SELECT id FROM etudiant');
        for (const s of students) {
          await createStudentNotification({
            id_etudiant: s.id,
            id_universite: req.user.id,
            titre: 'Nouveau stage à l\'université 💼',
            message: `Votre université a publié un nouveau stage : "${titre}"`,
            type: 'offre'
          });
        }
      } catch (sErr) {
        console.error('Erreur notification étudiants (univ):', sErr);
      }
    } catch (notifError) {
      console.error('Erreur notification publication université:', notifError);
    }

    res.status(201).json({ success: true, message: 'Offre de stage créée avec succès', data: { id: result.insertId } });
  } catch (error) {
    console.error('💥 [PUBLICATION UNIVERSITE] Erreur création offre:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la création de l\'offre' });
  }
});

// ====================== MODIFIER UNE OFFRE ======================
router.put('/:id', authenticateToken, upload.single('fichier'), async (req, res) => {
  const { id } = req.params;
  console.log('✏️ [PUBLICATION UNIVERSITE] Modification offre ID:', id);

  const { titre, description, duree, date_debut, date_fin, id_domaine } = req.body;
  const fichier = req.file ? req.file.filename : null;

  console.log('   Titre:', titre);
  console.log('   Fichier:', fichier);

  if (!titre || !description || !duree || !date_debut || !date_fin || !id_domaine) {
    console.warn('⚠️ [PUBLICATION UNIVERSITE] Champs manquants');
    return res.status(400).json({
      success: false,
      message: 'Tous les champs obligatoires doivent être remplis'
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier que l'offre appartient à l'université
    const [existing] = await pool.execute(
      'SELECT id, fichier FROM offre_stage WHERE id = ? AND id_universite = ?',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      console.warn('❌ [PUBLICATION UNIVERSITE] Offre non trouvée ou non autorisée');
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée ou vous n\'avez pas les droits pour la modifier'
      });
    }

    // Supprimer l'ancien fichier si un nouveau est uploadé
    if (req.file && existing[0].fichier) {
      const oldFilePath = path.join(__dirname, '../../uploads', existing[0].fichier);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log('🗑️ [PUBLICATION UNIVERSITE] Ancien fichier supprimé:', existing[0].fichier);
      }
    }

    // Mettre à jour l'offre
    await pool.execute(
      `UPDATE offre_stage SET
        titre = ?, description = ?, duree = ?, date_debut = ?, date_fin = ?,
        fichier = COALESCE(?, fichier), id_domaine = ?
       WHERE id = ? AND id_universite = ?`,
      [titre, description, duree, date_debut, date_fin, fichier, id_domaine, id, req.user.id]
    );

    // Notifier les étudiants qui ont postulé à cette offre
    try {
      const { createNotification } = require('../Entreprise/notificationentreprise');
      const [univInfo] = await pool.execute('SELECT nom FROM universite WHERE id = ?', [req.user.id]);
      const univNom = univInfo.length > 0 ? univInfo[0].nom : 'Votre université';

      const [etudiantsPostulants] = await pool.execute(
        'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?',
        [id]
      );

      for (const etudiant of etudiantsPostulants) {
        if (etudiant.id_etudiant) {
          await createNotification({
            id_etudiant: etudiant.id_etudiant,
            id_universite: req.user.id,
            titre: 'Mise à jour d\'offre de stage',
            message: `L'offre "${titre.trim()}" (à laquelle vous avez postulé) a été modifiée par ${univNom}.`,
            type: 'offre',
            created_by: 'universite'
          });
        }
      }
    } catch (notifError) {
      console.error('Erreur notification modification offre universitaire:', notifError);
    }

    console.log('✅ [PUBLICATION UNIVERSITE] Offre modifiée avec succès');
    res.status(200).json({
      success: true,
      message: 'Offre de stage modifiée avec succès'
    });
  } catch (error) {
    console.error('💥 [PUBLICATION UNIVERSITE] Erreur modification offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la modification de l\'offre'
    });
  }
});

// ====================== SUPPRIMER UNE OFFRE ======================
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  console.log('🗑️ [PUBLICATION UNIVERSITE] Suppression offre ID:', id);

  try {
    const pool = getDbPool(req);

    // Récupérer le fichier et les infos avant suppression
    const [offre] = await pool.execute(
      'SELECT fichier, titre FROM offre_stage WHERE id = ? AND id_universite = ?',
      [id, req.user.id]
    );

    if (offre.length === 0) {
      console.warn('❌ [PUBLICATION UNIVERSITE] Offre non trouvée ou non autorisée');
      return res.status(404).json({
        success: false,
        message: 'Offre non trouvée ou vous n\'avez pas les droits pour la supprimer'
      });
    }

    const titreOffre = offre[0].titre || 'Une offre';

    // Récupérer les étudiants qui ont postulé
    const [etudiantsPostulants] = await pool.execute(
      'SELECT id_etudiant FROM candidature WHERE id_offre_stage = ?',
      [id]
    );

    // Supprimer l'offre
    await pool.execute(
      'DELETE FROM offre_stage WHERE id = ? AND id_universite = ?',
      [id, req.user.id]
    );

    // Notification aux étudiants ayant postulé
    try {
      const { createNotification } = require('../Entreprise/notificationentreprise');
      const [univInfo] = await pool.execute('SELECT nom FROM universite WHERE id = ?', [req.user.id]);
      const univNom = univInfo.length > 0 ? univInfo[0].nom : 'Votre université';

      for (const etudiant of etudiantsPostulants) {
        if (etudiant.id_etudiant) {
          await createNotification({
            id_etudiant: etudiant.id_etudiant,
            id_universite: req.user.id,
            titre: 'Offre de stage retirée',
            message: `${univNom} a retiré l'offre : "${titreOffre}" à laquelle vous aviez postulé.`,
            type: 'alerte',
            created_by: 'universite'
          });
        }
      }
    } catch (notifError) {
      console.error('Erreur notification suppression offre universitaire:', notifError);
    }

    // Supprimer le fichier si existe
    if (offre[0].fichier) {
      const filePath = path.join(__dirname, '../../uploads', offre[0].fichier);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ [PUBLICATION UNIVERSITE] Fichier supprimé:', offre[0].fichier);
      }
    }

    console.log('✅ [PUBLICATION UNIVERSITE] Offre supprimée avec succès');
    res.status(200).json({
      success: true,
      message: 'Offre de stage supprimée avec succès'
    });
  } catch (error) {
    console.error('💥 [PUBLICATION UNIVERSITE] Erreur suppression offre:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de l\'offre'
    });
  }
});

// ====================== RÉCUPÉRER LES STATISTIQUES D'UNE OFFRE ======================
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;

  console.log('📊 [PUBLICATION UNIVERSITE] Récupération statistiques offre ID:', id);

  try {
    const pool = getDbPool(req);

    // Vérifier que l'offre existe
    const [offre] = await pool.execute(
      'SELECT id FROM offre_stage WHERE id = ?',
      [id]
    );

    if (offre.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    // Récupérer le nombre de likes
    const [likes] = await pool.execute(
      'SELECT COUNT(*) as count FROM aime WHERE id_offre_stage = ?',
      [id]
    );

    // Récupérer le nombre de commentaires
    const [comments] = await pool.execute(
      'SELECT COUNT(*) as count FROM commentaire WHERE id_offre_stage = ?',
      [id]
    );

    console.log('✅ [PUBLICATION UNIVERSITE] Stats récupérées - Likes:', likes[0].count, 'Commentaires:', comments[0].count);
    res.status(200).json({
      success: true,
      data: {
        likes: likes[0].count || 0,
        comments: comments[0].count || 0
      }
    });
  } catch (error) {
    console.error('💥 [PUBLICATION UNIVERSITE] Erreur récupération stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
});

// ====================== TÉLÉCHARGER UN FICHIER ======================
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../uploads', filename);

  console.log('📥 [PUBLICATION UNIVERSITE] Téléchargement/fetch fichier:', filename);

  if (!fs.existsSync(filePath)) {
    console.warn('❌ [PUBLICATION UNIVERSITE] Fichier non trouvé:', filename);
    return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
  }

  // Serve the file so browser can display inline when supported (images, pdfs...)
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('💥 [PUBLICATION UNIVERSITE] Erreur envoi fichier:', err.message);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du fichier' });
    }
  });
});

module.exports = router;