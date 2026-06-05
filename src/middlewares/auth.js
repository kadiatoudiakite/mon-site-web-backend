require('dotenv').config();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const logger = require('../utils/logger');

// Middleware d'authentification pour vérifier le JWT
const verifyToken = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('⚠️ [AUTH] Token manquant ou format invalide');
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant ou invalide'
      });
    }

    const token = authHeader.substring(7); // Retirer "Bearer "
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    logger.info('✅ [AUTH] Token valide - Université ID:', decoded.id);
    
    // Ajouter les infos du token à la requête
    req.user = decoded;
    next();

  } catch (error) {
    logger.error('❌ [AUTH] Erreur interne:', error);
    
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

// Middleware pour restreindre l'accès au Super Admin uniquement
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    logger.warn(`⚠️ [AUTH] Accès refusé - Role: ${req.user ? req.user.role : 'aucun'}`);
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au Super Administrateur'
    });
  }
  next();
};

module.exports = { verifyToken, requireSuperAdmin };
