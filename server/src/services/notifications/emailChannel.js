const NotificationChannel = require('./NotificationChannel');
const { sendMail } = require('../../config/mailer');

// Sends notifications by email through Nodemailer.
class EmailChannel extends NotificationChannel {
  get name() {
    return 'email';
  }

  // Email works for any user who has an email address.
  canSendTo(user) {
    return Boolean(user && user.email);
  }

  // Sends the rendered message as an email.
  async send(user, message) {
    await sendMail({ to: user.email, subject: message.subject, html: message.html, text: message.text });
  }
}

module.exports = EmailChannel;
