const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

const getDbPool = (req) => req.app.get('dbPool');

// ======================
// ROUTES UNIVERSITÉ (Authentifiées)
// ======================

// Récupérer les demandes de l'université connectée
router.get('/mes-demandes', verifyToken, async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(
      `SELECT 
        id,
        nom_entreprise,
        email_entreprise,
        domaine,
        description,
        statut,
        date_demande 
       FROM demande_partenariat 
       WHERE id_universite = ? 
       ORDER BY date_demande DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur fetch mes-demandes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'une demande (Acceptée / Refusée)
router.put('/:id/statut', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;

  if (!['Acceptée', 'Refusée'].includes(statut)) {
    return res.status(400).json({
      success: false,
      message: 'Statut invalide. Doit être "Acceptée" ou "Refusée"'
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier que la demande existe et appartient à l'université connectée
    const [demandes] = await pool.execute(
      'SELECT id_universite FROM demande_partenariat WHERE id = ?',
      [id]
    );

    if (demandes.length === 0) {
      return res.status(404).json({ success: false, message: 'Demande non trouvée' });
    }

    if (demandes[0].id_universite !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    await pool.execute(
      'UPDATE demande_partenariat SET statut = ? WHERE id = ?',
      [statut, id]
    );

    res.json({
      success: true,
      message: `Demande ${statut.toLowerCase()} avec succès`
    });

  } catch (error) {
    console.error('Erreur update statut:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ======================
// ROUTES PUBLIQUES
// ======================

// Soumettre une nouvelle demande de partenariat
router.post('/demande', async (req, res) => {
  const { name, email, domain, description, universiteId } = req.body;

  // Validation
  if (!name?.trim() || !email?.trim() || !domain?.trim() || !description?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont obligatoires'
    });
  }

  const idUniversite = parseInt(universiteId, 10);
  if (Number.isNaN(idUniversite)) {
    return res.status(400).json({
      success: false,
      message: 'ID université invalide'
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier que l'université existe
    const [uniExists] = await pool.execute(
      'SELECT id FROM universite WHERE id = ?',
      [idUniversite]
    );

    if (uniExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Université non trouvée'
      });
    }

    await pool.execute(
      `INSERT INTO demande_partenariat 
       (nom_entreprise, email_entreprise, domaine, description, id_universite) 
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.trim(), domain.trim(), description.trim(), idUniversite]
    );

    // Notification pour l'université
    try {
      const notificationModule = require('./notificationentreprise');
      await notificationModule.createNotification({
        id_universite: idUniversite,
        titre: 'Nouvelle demande de partenariat',
        message: `L'entreprise ${name} souhaite établir un partenariat avec votre université.`,
        type: 'partenariat'
      });
    } catch (notifError) {
      console.error('Erreur notification partenariat:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Demande de partenariat envoyée avec succès'
    });

  } catch (error) {
    console.error('Erreur création demande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer la liste des universités (pour le formulaire public)
router.get('/all', async (req, res) => {
  try {
    const pool = getDbPool(req);
    const [rows] = await pool.execute(
      'SELECT id, nom FROM universite ORDER BY nom ASC'
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur fetch universités:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;