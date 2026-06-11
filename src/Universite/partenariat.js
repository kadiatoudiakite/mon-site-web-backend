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
          type: 'partenariat',
          created_by: 'universite'
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
  const { name, email, domain, description } = req.body;
  const idEntrepriseFromToken = getEntrepriseIdFromToken(req);

  // Validation renforcée
  if (!name?.trim() || !email?.trim() || !domain?.trim() || !description?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont obligatoires'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Adresse email invalide'
    });
  }

  try {
    const pool = getDbPool(req);
    const SUPER_ADMIN_ID = 4; // ID fixe du Super Admin

    // Vérification que le super admin existe
    const [superAdminCheck] = await pool.execute(
      'SELECT id, nom FROM universite WHERE id = ? AND role = "super_admin"',
      [SUPER_ADMIN_ID]
    );

    if (superAdminCheck.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Configuration erreur : Super Admin introuvable (ID 4)"
      });
    }

    const universiteName = superAdminCheck[0].nom || 'Super Admin';

    let entrepriseId = idEntrepriseFromToken;
    if (!entrepriseId) {
      const [entrepriseMatches] = await pool.execute(
        'SELECT id FROM entreprise WHERE email = ? LIMIT 1',
        [email.trim().toLowerCase()]
      );
      if (entrepriseMatches.length > 0) {
        entrepriseId = entrepriseMatches[0].id;
      }
    }

    // Insertion
    const query = `
      INSERT INTO demande_partenariat 
      (nom_entreprise, email_entreprise, domaine, description, id_universite${entrepriseId ? ', id_entreprise' : ''}) 
      VALUES (?, ?, ?, ?, ?${entrepriseId ? ', ?' : ''})
    `;

    const values = entrepriseId
      ? [name.trim(), email.trim().toLowerCase(), domain.trim(), description.trim(), SUPER_ADMIN_ID, entrepriseId]
      : [name.trim(), email.trim().toLowerCase(), domain.trim(), description.trim(), SUPER_ADMIN_ID];

    await pool.execute(query, values);

    // Notifications
    try {
      const notificationModule = require('../Entreprise/notificationentreprise');

      await notificationModule.createNotification({
        id_universite: SUPER_ADMIN_ID,
        id_entreprise: entrepriseId || null,
        titre: 'Nouvelle demande de partenariat',
        message: `L'entreprise ${name.trim()} a soumis une demande de partenariat.`,
        type: 'partenariat',
        created_by: 'entreprise'
      });

      if (entrepriseId) {
        await notificationModule.createNotification({
          id_entreprise: entrepriseId,
          id_universite: SUPER_ADMIN_ID,
          titre: 'Demande envoyée',
          message: `Votre demande de partenariat auprès de ${universiteName} a été enregistrée avec succès.`,
          type: 'partenariat',
          created_by: 'entreprise'
        });
      }
    } catch (notifError) {
      console.error('Erreur notification:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Demande de partenariat envoyée avec succès'
    });

  } catch (error) {
    console.error('Erreur création demande:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur. Veuillez réessayer.' 
    });
  }
});
module.exports = router;