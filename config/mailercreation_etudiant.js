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
 * Send an email containing a 6-digit verification code to a registering student.
 *
 * @param {string} toEmail - Destination email address.
 * @param {string} code - Generated 6-digit confirmation code.
 */
async function sendVerificationCodeMail(toEmail, code) {
  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from: `"StageTrack" <${process.env.MAIL_USER || 'no-reply@stagetrack.local'}>`,
      to: toEmail,
      subject: 'Code de validation - Inscription StageTrack',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">StageTrack</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Votre plateforme de gestion des stages</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          
          <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-top: 0;">Vérification de votre adresse e-mail</h2>
          <p style="line-height: 1.6; font-size: 15px; color: #475569;">Bonjour,</p>
          <p style="line-height: 1.6; font-size: 15px; color: #475569;">Merci de vous inscrire sur <strong>StageTrack</strong>. Pour confirmer que cette adresse e-mail est correcte et finaliser la création de votre compte étudiant, veuillez saisir le code de vérification ci-dessous :</p>
          
          <div style="background-color: #f5f3ff; border: 2px dashed #818cf8; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #4f46e5; font-family: 'Courier New', Courier, monospace;">${code}</span>
          </div>
          
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Ce code est confidentiel et est valable pendant <strong>15 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.</p>
          
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
          
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">© ${new Date().getFullYear()} StageTrack – Tous droits réservés.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    console.log('📧 Code de vérification envoyé à', toEmail);
  } catch (err) {
    console.error('⚠️ Erreur d\'envoi d\'email de validation :', err);
    throw err;
  }
}

module.exports = { sendVerificationCodeMail };
