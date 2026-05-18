const mysql = require('mysql2/promise');
const pool = require('./config/db');

async function testNotificationSystem() {
  console.log('🧪 Test du système de notifications\n');
  
  try {
    // Test 1: Vérifier la table notification
    console.log('1️⃣  Vérification de la table notification...');
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'"
    );
    
    if (tables.length === 0) {
      console.error('❌ La table notification n\'existe pas!');
      return;
    }
    console.log('✅ Table notification trouvée\n');

    // Test 2: Afficher la structure
    console.log('2️⃣  Structure de la table notification:');
    const [columns] = await pool.query('DESCRIBE notification');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    console.log('');

    // Test 3: Compter les notifications
    console.log('3️⃣  Statistiques des notifications:');
    const [[stats]] = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN statut = "non_lu" THEN 1 ELSE 0 END) as non_lues FROM notification'
    );
    console.log(`   Total: ${stats.total} notifications`);
    console.log(`   Non lues: ${stats.non_lues}\n`);

    // Test 4: Afficher les notifications récentes
    console.log('4️⃣  Dernières notifications (10):');
    const [notifications] = await pool.query(
      `SELECT n.id, n.id_etudiant, n.titre, n.type, n.statut, n.created_at,
              e.nom AS entreprise_nom, u.nom AS universite_nom
       FROM notification n
       LEFT JOIN entreprise e ON n.id_entreprise = e.id
       LEFT JOIN universite u ON n.id_universite = u.id
       ORDER BY n.created_at DESC
       LIMIT 10`
    );
    
    if (notifications.length === 0) {
      console.log('   ⚠️  Aucune notification trouvée');
    } else {
      notifications.forEach(notif => {
        console.log(`   📬 ID: ${notif.id} | Étudiant: ${notif.id_etudiant} | Type: ${notif.type} | Statut: ${notif.statut}`);
        console.log(`      Titre: ${notif.titre}`);
        console.log(`      De: ${notif.entreprise_nom || notif.universite_nom || 'système'} | Date: ${notif.created_at}`);
      });
    }
    console.log('');

    // Test 5: Vérifier les notifications par étudiant
    console.log('5️⃣  Notifications par étudiant:');
    const [byStudent] = await pool.query(
      `SELECT 
        id_etudiant,
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'non_lu' THEN 1 ELSE 0 END) as non_lues
       FROM notification
       WHERE id_etudiant IS NOT NULL
       GROUP BY id_etudiant
       ORDER BY total DESC
       LIMIT 10`
    );
    
    if (byStudent.length === 0) {
      console.log('   ⚠️  Aucune notification pour les étudiants');
    } else {
      byStudent.forEach(row => {
        console.log(`   Étudiant ${row.id_etudiant}: ${row.total} total (${row.non_lues} non lues)`);
      });
    }
    console.log('');

    // Test 6: Vérifier les types de notifications
    console.log('6️⃣  Types de notifications utilisés:');
    const [types] = await pool.query(
      `SELECT type, COUNT(*) as count FROM notification GROUP BY type ORDER BY count DESC`
    );
    types.forEach(row => {
      console.log(`   ${row.type}: ${row.count}`);
    });
    console.log('');

    console.log('✅ Test complété avec succès\n');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Lancer le test
testNotificationSystem();
