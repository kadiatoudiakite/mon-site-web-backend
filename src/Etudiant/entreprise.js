const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ==================== ROUTES ENTREPRISES ====================

// Récupérer la liste de toutes les entreprises
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id,
        e.nom,
        e.sigle,
        e.logo,
        e.commune,
        e.quartier,
        e.description,
        e.email,
        e.telephone,
        d.nom AS domaine_nom
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      ORDER BY e.nom ASC
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erreur récupération entreprises:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des entreprises"
    });
  }
});

// Récupérer la liste unifiée des entreprises et universités
router.get('/organismes', async (req, res) => {
    try {
        const [entreprises] = await pool.query(`
            SELECT id, nom, sigle, logo, 
            COALESCE(description, 'Entreprise partenaire proposant des opportunités de stage.') as description, 
            'entreprise' as type 
            FROM entreprise
        `);
        
        const [universites] = await pool.query(`
            SELECT id, CONCAT(prenom, ' ', nom) as nom, NULL as sigle, logo, 
            'Membre du corps professoral / Administration universitaire' as description, 
            'universite' as type 
            FROM universite
        `);
        
        const combined = [...entreprises, ...universites].sort((a, b) => a.nom.localeCompare(b.nom));
        
        res.json({ success: true, data: combined });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// Récupérer les offres d'un organisme spécifique (Entreprise ou Université)
router.get('/:id/offres', async (req, res) => {
  const { id } = req.params;
  const { type } = req.query; // 'entreprise' ou 'universite'
  const etudiantId = req.query.etudiantId || 1; // On simule l'ID 1 si non fourni

  try {
    let query = `
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
      WHERE `;
    
    if (type === 'entreprise') {
        query += `os.id_entreprise = ? `;
    } else {
        query += `os.id_universite = ? `;
    }
    
    query += `ORDER BY os.created_at DESC`;

    const [rows] = await pool.query(query, [etudiantId, etudiantId, id]);

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

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error(`Erreur offres organisme ${id}:`, error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des offres"
    });
  }
});

module.exports = router;