// src/Entreprise/profilentreprise.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

console.log('✅ Profil Entreprise routes loaded');

// Helper pour récupérer le pool
const getDbPool = (req) => req.app.get('dbPool');

// ====================== RÉCUPÉRER LE PROFIL ======================
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
        e.created_at,
        d.nom AS domaine_nom
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      WHERE e.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Entreprise non trouvée"
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('💥 Erreur récupération profil entreprise:', error.message);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération du profil"
    });
  }
});

// ====================== METTRE À JOUR LE PROFIL ======================
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const tokenUserId = req.user && req.user.id;

  const {
    nom,
    sigle,
    logo,
    commune,
    quartier,
    telephone,
    email,
    description,
    domaine_id
  } = req.body;

  // Sécurité : Seule l'entreprise propriétaire peut modifier son profil
  if (!tokenUserId || parseInt(tokenUserId) !== parseInt(id)) {
    return res.status(403).json({
      success: false,
      message: "Vous n'êtes pas autorisé à modifier ce profil"
    });
  }

  // Validation des champs obligatoires
  if (!nom || !domaine_id) {
    return res.status(400).json({
      success: false,
      message: "Le nom et le domaine sont obligatoires"
    });
  }

  try {
    const pool = getDbPool(req);

    // Vérifier si l'entreprise existe
    const [existing] = await pool.execute(
      'SELECT id, email FROM entreprise WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Entreprise non trouvée"
      });
    }

    const currentEmail = existing[0].email;

    // Vérifier si le nouvel email est déjà utilisé
    if (email && email.toLowerCase() !== currentEmail.toLowerCase()) {
      const [duplicate] = await pool.execute(
        'SELECT id FROM entreprise WHERE email = ? AND id != ?',
        [email.toLowerCase(), id]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Cet email est déjà utilisé par une autre entreprise"
        });
      }
    }

    // Mise à jour
    await pool.execute(`
      UPDATE entreprise 
      SET 
        nom = ?,
        sigle = ?,
        logo = ?,
        commune = ?,
        quartier = ?,
        telephone = ?,
        email = ?,
        description = ?,
        domaine_id = ?
      WHERE id = ?
    `, [
      nom.trim(),
      sigle?.trim() || null,
      logo?.trim() || null,
      commune?.trim() || null,
      quartier?.trim() || null,
      telephone?.trim() || null,
      email ? email.toLowerCase().trim() : currentEmail,
      description?.trim() || null,
      domaine_id,
      id
    ]);

    // Récupérer le profil mis à jour
    const [updatedRows] = await pool.execute(`
      SELECT 
        e.id, e.nom, e.sigle, e.logo, e.commune, e.quartier,
        e.telephone, e.email, e.description, e.domaine_id,
        e.id_universite,
        d.nom AS domaine_nom
      FROM entreprise e
      LEFT JOIN domaine d ON e.domaine_id = d.id
      WHERE e.id = ?
    `, [id]);

    res.status(200).json({
      success: true,
      message: "Profil mis à jour avec succès",
      data: updatedRows[0]
    });

  } catch (error) {
    console.error('💥 Erreur mise à jour profil:', error.message);
    
    // Gestion des erreurs de contrainte d'unicité (MySQL)
    if (error.code === 'ER_DUP_ENTRY') {
      const message = error.message.includes('email') 
        ? "Cet email est déjà utilisé par une autre entreprise"
        : "Ce nom d'entreprise est déjà utilisé";
        
      return res.status(409).json({
        success: false,
        message: message
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la mise à jour du profil"
    });
  }
});

// ====================== CHANGEMENT DE MOT DE PASSE ======================
router.put('/:id/password', verifyToken, async (req, res) => {
  const { id } = req.params;
  const tokenUserId = req.user && req.user.id;

  const { motDePasseActuel, nouveauMotDePasse, confirmationMotDePasse } = req.body;

  if (!tokenUserId || parseInt(tokenUserId) !== parseInt(id)) {
    return res.status(403).json({ success: false, message: "Accès refusé" });
  }

  if (!motDePasseActuel || !nouveauMotDePasse || !confirmationMotDePasse) {
    return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires" });
  }

  if (nouveauMotDePasse !== confirmationMotDePasse) {
    return res.status(400).json({ success: false, message: "Les nouveaux mots de passe ne correspondent pas" });
  }

  if (nouveauMotDePasse.length < 8) {
    return res.status(400).json({ success: false, message: "Le mot de passe doit contenir au moins 8 caractères" });
  }

  try {
    const pool = getDbPool(req);

    const [rows] = await pool.execute(
      'SELECT mot_de_passe FROM entreprise WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Entreprise non trouvée" });
    }

    if (rows[0].mot_de_passe !== motDePasseActuel) {
      return res.status(401).json({ success: false, message: "Mot de passe actuel incorrect" });
    }

    await pool.execute(
      'UPDATE entreprise SET mot_de_passe = ? WHERE id = ?',
      [nouveauMotDePasse, id]
    );

    res.status(200).json({
      success: true,
      message: "Mot de passe modifié avec succès"
    });

  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du changement de mot de passe"
    });
  }
});

module.exports = router;