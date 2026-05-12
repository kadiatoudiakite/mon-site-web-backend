// src/Universite/entrepriseRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

console.log('Entreprise routes loaded');

// Récupérer le pool depuis l'app
const getDbPool = (req) => req.app.get('dbPool');

// ====================== CRÉER UNE NOUVELLE ENTREPRISE ======================
router.post('/', verifyToken, async (req, res) => {
  const { nom, email, domaine_id } = req.body;
  const id_universite = req.user.id;

  console.log('🏢 Tentative de création entreprise par université ID:', id_universite);

  // Validation
  if (!nom || !email || !domaine_id) {
    return res.status(400).json({
      success: false,
      message: 'Nom, email et domaine sont obligatoires'
    });
  }

  try {
    const pool = getDbPool(req);

    // ====================== VÉRIFICATION DU DOMAINE ======================
    const [domaineCheck] = await pool.execute('SELECT id FROM domaine WHERE id = ?', [domaine_id]);
    if (domaineCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Domaine invalide'
      });
    }

    // ====================== VÉRIFICATION DOUBLONS ======================
    const [existing] = await pool.execute(
      'SELECT id FROM entreprise WHERE email = ? OR nom = ?',
      [email.toLowerCase().trim(), nom.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cette entreprise existe déjà (nom ou email)'
      });
    }

    // ====================== GÉNÉRATION AUTOMATIQUE DU MOT DE PASSE ======================
    const generatePassword = (length = 12) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#';
      let password = '';

      for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      return password;
    };

    const plainPassword = generatePassword(12);

    console.log('🔑 Mot de passe généré :', plainPassword);

    // ====================== INSERTION EN BASE ======================
    const [result] = await pool.execute(
      `INSERT INTO entreprise 
      (nom, email, mot_de_passe, domaine_id, id_universite, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        nom.trim(),
        email.toLowerCase().trim(),
        plainPassword,
        parseInt(domaine_id),
        id_universite
      ]
    );

    console.log('✅ Entreprise créée avec succès ! ID =', result.insertId);

    // ====================== VÉRIFICATION DE LA CRÉATION ======================
    const [verification] = await pool.execute(
      'SELECT id, nom, email, domaine_id, id_universite, created_at FROM entreprise WHERE id = ?',
      [result.insertId]
    );

    if (verification.length === 0) {
      console.error('💥 VÉRIFICATION ÉCHOUÉE: Entreprise non trouvée après création');
      return res.status(500).json({
        success: false,
        message: 'Erreur de vérification: entreprise créée mais non retrouvée'
      });
    }

    const entrepriseCreee = verification[0];
    console.log('✅ VÉRIFICATION RÉUSSIE: Entreprise confirmée en base:', entrepriseCreee);

    // ====================== RÉPONSE ======================
    res.status(201).json({
      success: true,
      message: 'Entreprise créée avec succès et vérifiée en base de données',
      entreprise: {
        id: entrepriseCreee.id,
        nom: entrepriseCreee.nom,
        email: entrepriseCreee.email,
        mot_de_passe: plainPassword,
        domaine_id: entrepriseCreee.domaine_id,
        id_universite: entrepriseCreee.id_universite,
        created_at: entrepriseCreee.created_at
      }
    });

  } catch (error) {
    console.error('💥 Erreur création entreprise:', error);

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de l’entreprise'
    });
  }
});

// ====================== RÉCUPÉRER TOUTES LES ENTREPRISES ======================
router.get('/', async (req, res) => {
  console.log('📋 [ENTREPRISE] Récupération de toutes les entreprises');

  try {
    const pool = getDbPool(req);
    const [entreprises] = await pool.execute(`
      SELECT
        e.id,
        e.nom,
        e.sigle,
        e.logo,
        e.commune,
        e.quartier,
        e.telephone,
        e.email,
        e.description,
        e.domaine_id,
        e.id_universite,
        d.nom as domaine_nom,
        (SELECT COUNT(*) FROM offre_stage WHERE id_entreprise = e.id) as nb_publications,
        e.created_at
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      ORDER BY e.created_at DESC
    `);

    console.log('✅ [ENTREPRISE] Récupérées:', entreprises.length, 'entreprises');
    res.status(200).json({
      success: true,
      data: entreprises
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération entreprises:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des entreprises'
    });
  }
});

// ====================== RÉCUPÉRER LES DOMAINES ======================
router.get('/domaines/all', async (req, res) => {
  console.log('📂 [ENTREPRISE] Récupération des domaines');

  try {
    const pool = getDbPool(req);
    const [domaines] = await pool.execute('SELECT * FROM domaine ORDER BY nom');

    console.log('✅ [ENTREPRISE] Domaines récupérés:', domaines.length);
    res.status(200).json({
      success: true,
      data: domaines
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération domaines:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des domaines'
    });
  }
});

// ====================== RÉCUPÉRER UNE ENTREPRISE PAR ID ======================
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(`
      SELECT
        e.id,
        e.nom,
        e.sigle,
        e.logo,
        e.commune,
        e.quartier,
        e.telephone,
        e.email,
        e.description,
        e.domaine_id,
        e.id_universite,
        d.nom as domaine_nom,
        e.created_at
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      WHERE e.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur récupération entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ====================== METTRE À JOUR UNE ENTREPRISE ======================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nom, sigle, logo, commune, quartier, telephone,
    email, description, domaine_id, id_universite
  } = req.body;

  try {
    const pool = getDbPool(req);

    const [existing] = await pool.execute('SELECT id FROM entreprise WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    await pool.execute(`
      UPDATE entreprise SET
        nom = ?, sigle = ?, logo = ?, commune = ?, quartier = ?,
        telephone = ?, email = ?, description = ?, domaine_id = ?, id_universite = ?
      WHERE id = ?
    `, [nom, sigle, logo, commune, quartier, telephone, email, description, domaine_id, id_universite, id]);

    res.status(200).json({
      success: true,
      message: 'Entreprise mise à jour avec succès'
    });

  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur mise à jour entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour'
    });
  }
});

// ====================== SUPPRIMER UNE ENTREPRISE ======================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = getDbPool(req);
    const [result] = await pool.execute('DELETE FROM entreprise WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Entreprise supprimée avec succès'
    });

  } catch (error) {
    console.error('💥 [ENTREPRISE] Erreur suppression entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
});

// ====================== RÉCUPÉRER LES OFFRES D'UNE ENTREPRISE ======================
router.get('/:id/offres', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = getDbPool(req);
    const [offres] = await pool.execute(`
      SELECT o.*, d.nom as domaine_nom 
      FROM offre_stage o
      LEFT JOIN domaine d ON o.id_domaine = d.id
      WHERE o.id_entreprise = ?
      ORDER BY o.created_at DESC
    `, [id]);
    
    res.status(200).json({ success: true, data: offres });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

console.log('Router exported');
module.exports = router;