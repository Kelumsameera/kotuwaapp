const nodemailer = require('nodemailer');
const env = require('./env');

// In tests, sent emails are kept here so tests can read links from them.
const testOutbox = [];

// Builds the Nodemailer transport. Without SMTP settings, emails are printed to the console.
function createTransport() {
  if (env.isTest || !env.SMTP_HOST) {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

const transport = createTransport();

// Sends one email and, in dev/test mode, records or prints it.
async function sendMail({ to, subject, html, text }) {
  const message = { from: env.EMAIL_FROM, to, subject, html, text };
  await transport.sendMail(message);

  if (env.isTest) {
    testOutbox.push(message);
  } else if (!env.SMTP_HOST) {
    console.log(`\n--- EMAIL (dev, not sent) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n-----------------------------\n`);
  }
}

module.exports = { sendMail, testOutbox };
