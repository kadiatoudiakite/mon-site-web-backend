// src/Entreprise/publicationOffresRouter.js
/**
 * Rôle : Routeur pour les commentaires et statistiques des offres.
 */
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const getDbPool = (req) => req.app.get('dbPool');

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

// ====================== RÉCUPÉRER LES COMMENTAIRES D'UNE OFFRE ======================
router.get('/:id/commentaires', authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log('💬 [PUBLICATION] Récupération commentaires offre ID:', id);

  try {
    const pool = getDbPool(req);

    const [offre] = await pool.execute(
      'SELECT id FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (offre.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    const [comments] = await pool.execute(`
      SELECT
        c.id,
        c.contenu,
        c.created_at,
        c.id_etudiant,
        c.id_entreprise,
        e.nom AS etudiant_nom,
        ent.nom AS entreprise_nom
      FROM commentaire c
      LEFT JOIN etudiant e ON c.id_etudiant = e.id
      LEFT JOIN entreprise ent ON c.id_entreprise = ent.id
      WHERE c.id_offre_stage = ?
      ORDER BY c.created_at ASC
    `, [id]);

    const formattedComments = comments.map((comment) => ({
      ...comment,
      auteur: comment.id_entreprise ? comment.entreprise_nom : comment.etudiant_nom || 'Anonyme',
      auteur_type: comment.id_entreprise ? 'entreprise' : 'etudiant'
    }));

    res.status(200).json({
      success: true,
      data: formattedComments
    });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur récupération commentaires:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des commentaires'
    });
  }
});

// ====================== POSTER UN COMMENTAIRE D'ENTREPRISE ======================
router.post('/:id/commentaires', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { contenu } = req.body;

  if (!contenu || contenu.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Le contenu du commentaire est obligatoire' });
  }

  try {
    const pool = getDbPool(req);

    const [offre] = await pool.execute(
      'SELECT id, titre FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
    );

    if (offre.length === 0) {
      return res.status(404).json({ success: false, message: 'Offre non trouvée' });
    }

    await pool.execute(
      'INSERT INTO commentaire (id_entreprise, id_offre_stage, contenu) VALUES (?, ?, ?)',
      [req.user.id, id, contenu.trim()]
    );

    // Notification aux étudiants qui ont commenté cette offre
    try {
      const { createStudentNotification } = require('../utils/notifications');
      const [entrepriseInfo] = await pool.execute('SELECT nom FROM entreprise WHERE id = ?', [req.user.id]);
      const entrepriseNom = entrepriseInfo.length > 0 ? entrepriseInfo[0].nom : 'Une entreprise';
      const titreOffre = offre[0].titre || 'Une offre';

      // Récupérer les étudiants qui ont commenté
      const [students] = await pool.execute(
        'SELECT DISTINCT id_etudiant FROM commentaire WHERE id_offre_stage = ? AND id_etudiant IS NOT NULL',
        [id]
      );
      
      for (const s of students) {
        await createStudentNotification({
          id_etudiant: s.id_etudiant,
          id_entreprise: req.user.id,
          titre: 'Nouveau commentaire',
          message: `${entrepriseNom} a commenté sur "${titreOffre}" : "${contenu.substring(0, 50)}..."`,
          type: 'message'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification commentaire:', notifError);
    }

    res.status(201).json({ success: true, message: 'Commentaire ajouté avec succès' });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur ajout commentaire:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout du commentaire'
    });
  }
});

// ====================== RÉCUPÉRER LES STATISTIQUES D'UNE OFFRE ======================
router.get('/:id/stats', authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log('📊 [PUBLICATION] Récupération statistiques offre ID:', id);

  try {
    const pool = getDbPool(req);

    // Vérifier que l'offre appartient à l'entreprise
    const [offre] = await pool.execute(
      'SELECT id FROM offre_stage WHERE id = ? AND id_entreprise = ?',
      [id, req.user.id]
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

    console.log('✅ [PUBLICATION] Stats récupérées - Likes:', likes[0].count, 'Commentaires:', comments[0].count);
    res.status(200).json({
      success: true,
      data: {
        likes: likes[0].count || 0,
        comments: comments[0].count || 0
      }
    });
  } catch (error) {
    console.error('💥 [PUBLICATION] Erreur récupération stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;
