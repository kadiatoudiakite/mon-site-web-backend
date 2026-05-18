const pool = require('../../config/db');

const createStudentNotification = async ({
  id_etudiant,
  id_entreprise,
  id_universite = null,
  titre,
  message,
  type = 'candidature'
}) => {
  if (!id_etudiant) return;

  try {
    await pool.query(`
      INSERT INTO notification 
        (id_etudiant, id_entreprise, id_universite, titre, message, type, statut)
      VALUES (?, ?, ?, ?, ?, ?, 'non_lu')
    `, [id_etudiant, id_entreprise, id_universite, titre, message, type]);
  } catch (err) {
    console.error('Erreur création notification étudiant:', err);
  }
};

module.exports = { createStudentNotification };
