const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

const getDbPool = (req) => req.app.get('dbPool');

const getEntrepriseIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'stagetrack_secret_key_2024');
    return decoded.role === 'entreprise' ? decoded.id : null;
  } catch (error) {
    return null;
  }
};

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
        id_entreprise,
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
      'SELECT nom_entreprise, email_entreprise, domaine, description, id_universite, id_entreprise FROM demande_partenariat WHERE id = ?',
      [id]
    );

    if (demandes.length === 0) {
      return res.status(404).json({ success: false, message: 'Demande non trouvée' });
    }

    const demande = demandes[0];
    if (demande.id_universite !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    await pool.execute(
      'UPDATE demande_partenariat SET statut = ? WHERE id = ?',
      [statut, id]
    );

    const [univRows] = await pool.execute('SELECT nom FROM universite WHERE id = ?', [req.user.id]);
    const universiteName = univRows.length > 0 ? univRows[0].nom : 'votre université';

    let entrepriseId = demande.id_entreprise;
    if (!entrepriseId) {
      const [entrepriseMatch] = await pool.execute(
        'SELECT id FROM entreprise WHERE email = ? LIMIT 1',
        [demande.email_entreprise]
      );
      if (entrepriseMatch.length > 0) {
        entrepriseId = entrepriseMatch[0].id;
      }
    }

    if (entrepriseId) {
      try {
        const notificationModule = require('../Entreprise/notificationentreprise');
        await notificationModule.createNotification({
          id_entreprise: entrepriseId,
          id_universite: req.user.id,
          titre: 'Statut de votre demande de partenariat',
          message: `Votre demande de partenariat auprès de ${universiteName} a été ${statut.toLowerCase()}.`,
          type: 'partenariat'
        });
      } catch (notifError) {
        console.error('Erreur notification statut partenariat:', notifError);
      }
    }

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
  const idEntrepriseFromToken = getEntrepriseIdFromToken(req);

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
      'SELECT id, nom FROM universite WHERE id = ?',
      [idUniversite]
    );

    if (uniExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Université non trouvée'
      });
    }

    let entrepriseId = idEntrepriseFromToken;
    if (!entrepriseId) {
      const [entrepriseMatches] = await pool.execute(
        'SELECT id FROM entreprise WHERE email = ? LIMIT 1',
        [email.trim()]
      );
      if (entrepriseMatches.length > 0) {
        entrepriseId = entrepriseMatches[0].id;
      }
    }

    await pool.execute(
      `INSERT INTO demande_partenariat 
       (nom_entreprise, email_entreprise, domaine, description, id_universite${entrepriseId ? ', id_entreprise' : ''}) 
       VALUES (?, ?, ?, ?, ?${entrepriseId ? ', ?' : ''})`,
      entrepriseId
        ? [name.trim(), email.trim(), domain.trim(), description.trim(), idUniversite, entrepriseId]
        : [name.trim(), email.trim(), domain.trim(), description.trim(), idUniversite]
    );

    const universiteName = uniExists[0].nom || 'votre université';

    // Notification pour l'université
    try {
      const notificationModule = require('../Entreprise/notificationentreprise');
      await notificationModule.createNotification({
        id_universite: idUniversite,
        id_entreprise: entrepriseId || null,
        titre: 'Nouvelle demande de partenariat',
        message: `L'entreprise ${name} souhaite établir un partenariat avec ${universiteName}.`,
        type: 'partenariat'
      });

      if (entrepriseId) {
        await notificationModule.createNotification({
          id_entreprise: entrepriseId,
          id_universite: idUniversite,
          titre: 'Demande de partenariat envoyée',
          message: `Votre demande à ${universiteName} a bien été envoyée. Vous recevrez une réponse dès que l'université aura traité votre demande.`,
          type: 'partenariat'
        });
      }
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