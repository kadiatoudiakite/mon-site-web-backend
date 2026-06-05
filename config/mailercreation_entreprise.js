const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Create a transporter. If MAIL_USER / MAIL_PASS are defined, use them.
 * Otherwise, fall back to an Ethereal test account (useful during development).
 */
async function getTransporter() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;
  if (MAIL_USER && MAIL_PASS) {
    return nodemailer.createTransport({
      host: MAIL_HOST || 'smtp.gmail.com',
      port: Number(MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASS,
      },
    });
  }
  // Fallback to Ethereal (no real email sent, preview URL provided)
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

/**
 * Send an email containing the login credentials for a newly created enterprise.
 *
 * @param {string} toEmail - Destination email address.
 * @param {string} password - Auto‑generated password.
 * @param {Object} details - Additional details (nom, id, email).
 */
async function sendCreationMail(toEmail, password, details) {
  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from: `"StageTrack" <${process.env.MAIL_USER || 'no-reply@stagetrack.local'}>`,
      to: toEmail,
      subject: 'Votre compte entreprise a été créé',
      html: `
        <h2>Bienvenue ${details.nom || ''} !</h2>
        <p>Votre compte sur <strong>StageTrack</strong> a été créé avec succès.</p>
        <p><strong>Identifiants de connexion :</strong></p>
        <ul style="list-style:none; padding:0;">
          <li><strong>Email :</strong> ${details.email}</li>
          <li><strong>Mot de passe :</strong> ${password}</li>
        </ul>
        <p>Vous pouvez dès à présent vous connecter à l’adresse suivante :</p>
  
        <hr/>
        <p style="font-size:0.85em;color:#666;">© ${new Date().getFullYear()} StageTrack – Tous droits réservés.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    console.log('📧 Email envoyé à', toEmail);
  } catch (err) {
    console.error('⚠️ Erreur d\'envoi d\'email de création :', err);
    throw err;
  }
}

module.exports = { sendCreationMail };
