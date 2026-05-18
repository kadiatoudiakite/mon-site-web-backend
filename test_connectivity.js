#!/usr/bin/env node

/**
 * Script de test de connectivité du serveur StageTrack
 * Lance des tests pour vérifier que le serveur est accessible depuis le réseau
 */

const http = require('http');
const os = require('os');

const PORT = 5000;

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorer les adresses IPv6 et loopback
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

function testConnection(host, port, label) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}`, {
      timeout: 3000,
      headers: {
        'Authorization': 'Bearer test'
      }
    }, (res) => {
      console.log(`✅ ${label}: ACCESSIBLE (http://${host}:${port})`);
      resolve(true);
    }).on('error', (err) => {
      console.log(`❌ ${label}: NON ACCESSIBLE (http://${host}:${port})`);
      console.log(`   Erreur: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🧪 Test de connectivité du serveur StageTrack\n');
  console.log(`Port attendu: ${PORT}\n`);
  
  // Test localhost
  console.log('📍 Tests de connectivité:');
  await testConnection('localhost', PORT, 'localhost');
  await testConnection('127.0.0.1', PORT, '127.0.0.1');
  
  // Test 0.0.0.0
  await testConnection('0.0.0.0', PORT, '0.0.0.0 (toutes les interfaces)');
  
  // Test sur les IPs locales
  const ips = getLocalIPs();
  if (ips.length === 0) {
    console.log('⚠️  Aucune adresse IP locale trouvée');
  } else {
    console.log(`\n📡 Adresses IP locales disponibles:\n`);
    for (const ip of ips) {
      await testConnection(ip, PORT, `Réseau local (${ip})`);
    }
  }
  
  console.log('\n📋 Configuration du mobile:\n');
  console.log('Si vous utilisez Expo, utilisez l\'IP suivante:');
  if (ips.length > 0) {
    console.log(`   API_URL = http://${ips[0]}:${PORT}/api`);
  } else {
    console.log('   API_URL = http://<votre-ip-locale>:${PORT}/api');
  }
  
  console.log('\n💡 Pour que le serveur écoute sur 0.0.0.0:');
  console.log('   1. Vérifier que server.js contient: app.listen(PORT, \'0.0.0.0\', ...)');
  console.log('   2. Vérifier que le CORS est bien configuré');
  console.log('   3. Redémarrer le serveur\n');
}

main().catch(console.error);
