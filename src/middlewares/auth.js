const jwt = require('jsonwebtoken');

// Middleware d'authentification pour vérifier le JWT
const verifyToken = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [AUTH] Token manquant ou format invalide');
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant ou invalide'
      });
    }

    const token = authHeader.substring(7); // Retirer "Bearer "
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'stagetrack_secret_key_2024'
    );

    console.log('✅ [AUTH] Token valide - Université ID:', decoded.id);
    
    // Ajouter les infos du token à la requête
    req.user = decoded;
    next();

  } catch (error) {
    console.error('❌ [AUTH] Erreur vérification token:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

// Middleware pour restreindre l'accès au Super Admin uniquement
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    console.warn(`⚠️ [AUTH] Accès refusé - Role: ${req.user ? req.user.role : 'aucun'}`);
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au Super Administrateur'
    });
  }
  next();
};

module.exports = { verifyToken, requireSuperAdmin };
