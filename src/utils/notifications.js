const { createNotification } = require('./notificationHelper');

const createStudentNotification = async ({
  id_etudiant,
  id_entreprise = null,
  id_universite = null,
  titre,
  message,
  type = 'candidature',
  created_by_type = 'system',
  created_by_id = null
}) => {
  if (!id_etudiant) return;
  try {
    await createNotification({
      target: 'etudiant',
      id_etudiant,
      id_entreprise,
      id_universite,
      titre,
      message,
      type,
      created_by_type,
      created_by_id
    });
  } catch (err) {
    console.error('Erreur création notification étudiant:', err);
  }
};

module.exports = { createStudentNotification, createNotification };
