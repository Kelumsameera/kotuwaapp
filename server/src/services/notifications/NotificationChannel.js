// The interface every notification channel follows (email now; SMS and WhatsApp later).
// To add a channel: create a class that extends this one, implement send(), and register it in notify.js.
class NotificationChannel {
  // A short name such as "email" or "sms".
  get name() {
    throw new Error('Channel must define a name');
  }

  // Returns true if this channel can reach the user (e.g. SMS needs a phone number).
  canSendTo(user) { // eslint-disable-line no-unused-vars
    return false;
  }

  // Sends one rendered message: { subject, html, text } to the user.
  async send(user, message) { // eslint-disable-line no-unused-vars
    throw new Error('Channel must implement send()');
  }
}

module.exports = NotificationChannel;
