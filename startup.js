#!/usr/bin/env node

/**
 * Script de démarrage du serveur StageTrack
 * Démarre le serveur et affiche les informations de connexion
 */

require('dotenv').config();
const os = require('os');

// Afficher l'environnement
console.log('\n');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🚀 DÉMARRAGE DU SERVEUR STAGETRACK                      ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Afficher les informations système
console.log('📋 Informations système:');
console.log(`   Node.js: ${process.version}`);
console.log(`   Plateforme: ${os.platform()} ${os.arch()}`);
console.log(`   Hostname: ${os.hostname()}`);
console.log('');

// Afficher les adresses IP
console.log('📡 Adresses IP disponibles:');
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4') {
      const type = iface.internal ? '(local)' : '(réseau)';
      console.log(`   ${name}: ${iface.address} ${type}`);
    }
  }
}
console.log('');

// Afficher la configuration
const PORT = process.env.PORT || 5000;
console.log('⚙️  Configuration:');
console.log(`   PORT: ${PORT}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Défini' : '⚠️  Non défini'}`);
console.log('');

// Afficher les URLs d'accès
console.log('🌐 URLs d\'accès:');
console.log(`   Local: http://localhost:${PORT}`);
console.log(`   Réseau: http://0.0.0.0:${PORT}`);

const localIPs = [];
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIPs.push(iface.address);
    }
  }
}

if (localIPs.length > 0) {
  localIPs.forEach(ip => {
    console.log(`   Mobile/Expo: http://${ip}:${PORT}`);
  });
}
console.log('');

console.log('📚 Routes principales:');
console.log(`   POST   http://localhost:${PORT}/api/etudiants/login`);
console.log(`   GET    http://localhost:${PORT}/api/etudiants/notifications`);
console.log(`   GET    http://localhost:${PORT}/api/etudiants/offres`);
console.log(`   POST   http://localhost:${PORT}/api/etudiants/stages/postuler`);
console.log('');

console.log('⚡ Démarrage du serveur...\n');

// Démarrer le serveur
require('./server');

// Afficher les informations une fois démarré
setTimeout(() => {
  console.log('');
  console.log('✅ Serveur prêt à recevoir des connexions!');
  console.log('');
  console.log('💡 Conseil: Pour tester les notifications:');
  console.log(`   curl http://localhost:${PORT}/api/etudiants/notifications \\`);
  console.log(`     -H "Authorization: Bearer <votre_token>"`);
  console.log('');
}, 1000);
