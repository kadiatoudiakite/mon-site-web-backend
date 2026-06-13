const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

// Nouvelle route : analyse centrée étudiants
router.get('/etudiants', verifyToken, async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const universiteId = req.user.id;

    // Évolution mensuelle des inscriptions étudiants
    const [etudiantsMois] = await pool.execute(`
      SELECT DATE_FORMAT(e.created_at, '%b') as mois, COUNT(DISTINCT e.id) as total
      FROM etudiant e
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `);

    // Répartition par filière
    const [filieres] = await pool.execute(`
      SELECT f.nom as filiere, COUNT(DISTINCT e.id) as total
      FROM filiere f
      JOIN etudiant e ON f.id = e.id_filiere
      GROUP BY f.id
    `);


    // Répartition par domaine (domaine des offres auxquelles les étudiants ont candidaté)
    const [domaines] = await pool.execute(`
      SELECT d.nom as domaine, COUNT(DISTINCT c.id_etudiant) as total
      FROM domaine d
      JOIN offre_stage o ON d.id = o.id_domaine
      JOIN candidature c ON o.id = c.id_offre_stage
      GROUP BY d.id
    `);

    // Évolution des placements étudiants (par mois)
    const [placementsMois] = await pool.execute(`
      SELECT DATE_FORMAT(c.date_candidature, '%b') as mois, COUNT(DISTINCT c.id_etudiant) as total
      FROM candidature c
      WHERE c.statut = 'Acceptée'
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `);

    res.json({
      success: true,
      data: {
        evolution: etudiantsMois,
        filieres,
        domaines,
        placements: placementsMois
      }
    });
  } catch (error) {
    console.error('💥 Erreur analyse étudiants:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ANALYSES POUR L'UNIVERSITÉ (FILTRÉES PAR UNIVERSITÉ) ====================

router.get('/globale', verifyToken, async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const universiteId = req.user.id;

    // 1. ANALYSE ENTREPRISES (toutes les entreprises du système)
    const [entreprises] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT e.id) as total,
        COUNT(DISTINCT e.domaine_id) as total_domaines
      FROM entreprise e
    `);

    const [domainesEntreprise] = await pool.execute(`
      SELECT d.nom, COUNT(DISTINCT e.id) as count
      FROM domaine d
      JOIN entreprise e ON d.id = e.domaine_id
      GROUP BY d.id
    `);

    // 2. ANALYSE ÉTUDIANTS (tous les étudiants inscrits sur la plateforme)
    const [etudiants] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT e.id) as total,
        SUM(CASE WHEN e.sexe = 'M' THEN 1 ELSE 0 END) as hommes,
        SUM(CASE WHEN e.sexe = 'F' THEN 1 ELSE 0 END) as femmes
      FROM etudiant e
    `);

    const [placements] = await pool.execute(`
      SELECT COUNT(DISTINCT c.id_etudiant) as etudiants_places
      FROM candidature c
      WHERE c.statut = 'Acceptée'
    `);

    const [filieresStats] = await pool.execute(`
      SELECT f.nom, COUNT(DISTINCT e.id) as total
      FROM filiere f
      JOIN etudiant e ON f.id = e.id_filiere
      GROUP BY f.id
    `);

    // 3. ANALYSE OFFRES (toutes les offres du système)
    const [offres] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN id_entreprise IS NOT NULL THEN 1 ELSE 0 END) as offres_entreprises,
        SUM(CASE WHEN id_universite IS NOT NULL THEN 1 ELSE 0 END) as offres_universites
      FROM offre_stage
    `);

    const [offresMois] = await pool.execute(`
      SELECT DATE_FORMAT(created_at, '%b') as mois, COUNT(*) as total
      FROM offre_stage
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `);

    // 4. ANALYSE CANDIDATURES (toutes les candidatures du système)
    const [candidaturesStats] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN c.statut = 'Acceptée' THEN 1 ELSE 0 END) as acceptes,
        SUM(CASE WHEN c.statut = 'Refusée' THEN 1 ELSE 0 END) as refuses,
        SUM(CASE WHEN c.statut IN ('En attente', 'Vue') THEN 1 ELSE 0 END) as en_attente
      FROM candidature c
    `);

    const acceptanceRate = candidaturesStats[0].total > 0
      ? Math.round((candidaturesStats[0].acceptes / candidaturesStats[0].total) * 100)
      : 0;

    const [candidaturesParMois] = await pool.execute(`
      SELECT DATE_FORMAT(c.date_candidature, '%b') as mois, COUNT(*) as total
      FROM candidature c
      GROUP BY mois
      ORDER BY FIELD(mois, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
    `);

    // 5. Notifications pour cette université
    const [notificationsSummary] = await pool.execute(`
      SELECT statut, COUNT(*) as count
      FROM notification
      WHERE id_universite = ?
      GROUP BY statut
    `, [universiteId]);
    const notifObj = notificationsSummary.reduce((acc, n) => ({ ...acc, [n.statut]: n.count }), {});

    res.json({
      success: true,
      data: {
        entreprises: {
          total: entreprises[0].total,
          domaines: domainesEntreprise,
          nbDomaines: entreprises[0].total_domaines
        },
        etudiants: {
          total: etudiants[0].total,
          hommes: etudiants[0].hommes,
          femmes: etudiants[0].femmes,
          placements: placements[0].etudiants_places,
          filieres: filieresStats
        },
        offres: {
          total: offres[0].total,
          parType: { entreprise: offres[0].offres_entreprises, universite: offres[0].offres_universites },
          evolution: offresMois
        },
        candidatures: {
          total: candidaturesStats[0].total,
          acceptes: candidaturesStats[0].acceptes,
          refuses: candidaturesStats[0].refuses,
          en_attente: candidaturesStats[0].en_attente,
          acceptanceRate,
          evolution: candidaturesParMois
        },
        notifications: {
          summary: notifObj
        }
      }
    });

  } catch (error) {
    console.error('💥 Erreur analyse globale université:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Récupérer toutes les candidatures avec détails pour cette université
router.get('/candidatures-globales', verifyToken, async (req, res) => {
  try {
    const pool = req.app.get('dbPool');
    const universiteId = req.user.id;
    const [rows] = await pool.execute(`
      SELECT 
        c.id,
        c.date_candidature,
        c.statut,
        c.cv_fichier,
        c.lettre_motivation,
        CONCAT(e.nom, ' ', e.prenom) as nom,
        e.email,
        e.id as etudiant_id,
        f.nom as filiere,
        o.titre as poste,
        d.nom as domaine_nom,
        COALESCE(ent.nom, 'Université (Interne)') as entreprise_nom,
        ent.id as entreprise_id
      FROM candidature c
      JOIN etudiant e ON c.id_etudiant = e.id
      JOIN offre_stage o ON c.id_offre_stage = o.id
      LEFT JOIN filiere f ON e.id_filiere = f.id
      LEFT JOIN domaine d ON o.id_domaine = d.id
      LEFT JOIN entreprise ent ON o.id_entreprise = ent.id
      ORDER BY c.date_candidature DESC
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('💥 Erreur récupération candidatures globales:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;