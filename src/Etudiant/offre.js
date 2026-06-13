const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// GET /api/etudiants/offres - Liste toutes les offres avec les vrais compteurs
router.get('/', async (req, res) => {
  const etudiantId = req.query.etudiantId || 1; // On simule l'ID 1 si non fourni
  try {
    const [rows] = await pool.query(`
      SELECT 
        os.*, 
        e.nom as entreprise_nom,
        e.logo as entreprise_logo, 
        CONCAT(u.prenom, ' ', u.nom) as universite_nom,
        u.logo as universite_logo,
        d.nom as domaine_nom,
        (SELECT COUNT(*) FROM aime WHERE id_offre_stage = os.id) as likes_count,
        (SELECT COUNT(*) FROM commentaire WHERE id_offre_stage = os.id) as comments_count,
        (SELECT COUNT(*) FROM aime WHERE id_offre_stage = os.id AND id_etudiant = ?) as is_liked,
        (SELECT COUNT(*) FROM candidature WHERE id_offre_stage = os.id AND id_etudiant = ?) as has_applied
      FROM offre_stage os
      LEFT JOIN entreprise e ON os.id_entreprise = e.id
      LEFT JOIN universite u ON os.id_universite = u.id
      LEFT JOIN domaine d ON os.id_domaine = d.id
      ORDER BY os.created_at DESC
    `, [etudiantId, etudiantId]);
    
    // Transformer is_liked et has_applied en boolean, et vérifier fermeture automatique
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const data = rows.map(row => {
      // Vérifier si le statut est déjà fermé ou pourvu
      const statutClosed = row.statut === 'Clôturée' || row.statut === 'Pourvue';
      
      // Vérifier si la date_fin est dépassée pour fermeture automatique
      const dateFin = row.date_fin ? new Date(row.date_fin) : null;
      if (dateFin) {
        dateFin.setHours(0, 0, 0, 0);
      }
      const dateExpired = dateFin && dateFin < today;
      
      // L'offre est fermée si le statut l'indique OU si la date est expirée
      const is_closed = statutClosed || dateExpired;
      
      return {
        ...row,
        is_liked: !!row.is_liked,
        has_applied: !!row.has_applied,
        is_closed: is_closed,
        is_expired_by_date: dateExpired
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur fetch offres:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/etudiants/offres/like - Liker/Déliker une offre
router.post('/like', async (req, res) => {
    const { etudiantId, offreId } = req.body;
    if (!etudiantId || !offreId) return res.status(400).json({ message: 'Données manquantes' });

    try {
        // Vérifier si déjà aimé
        const [existing] = await pool.query('SELECT id FROM aime WHERE id_etudiant = ? AND id_offre_stage = ?', [etudiantId, offreId]);
        
        if (existing.length > 0) {
            // Retirer le like
            await pool.query('DELETE FROM aime WHERE id_etudiant = ? AND id_offre_stage = ?', [etudiantId, offreId]);
            res.json({ success: true, action: 'removed' });
        } else {
            // Ajouter le like
            await pool.query('INSERT INTO aime (id_etudiant, id_offre_stage) VALUES (?, ?)', [etudiantId, offreId]);
            res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// POST /api/etudiants/offres/commentaire - Ajouter un commentaire
router.post('/commentaire', async (req, res) => {
    const { etudiantId, offreId, contenu } = req.body;
    if (!etudiantId || !offreId || !contenu) return res.status(400).json({ message: 'Données manquantes' });

    try {
        await pool.query('INSERT INTO commentaire (id_etudiant, id_offre_stage, contenu) VALUES (?, ?, ?)', [etudiantId, offreId, contenu]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// GET /api/etudiants/offres/:offreId/commentaires - Voir tous les commentaires d'une offre
router.get('/:offreId/commentaires', async (req, res) => {
    const { offreId } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT c.*, CONCAT(e.prenom, ' ', e.nom) as etudiant_nom, e.photo as etudiant_photo 
            FROM commentaire c
            JOIN etudiant e ON c.id_etudiant = e.id
            WHERE c.id_offre_stage = ?
            ORDER BY c.created_at ASC
        `, [offreId]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
