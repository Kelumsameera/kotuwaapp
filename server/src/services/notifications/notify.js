const EmailChannel = require('./emailChannel');
const { renderTemplate } = require('./templates');

// The channels that are switched on. Add new SmsChannel() / WhatsAppChannel() here later.
const activeChannels = [new EmailChannel()];

// Sends a notification to a user on every active channel, in the user's chosen language.
// A failing channel is logged but never breaks the request that triggered it.
async function notify(user, templateKey, data = {}) {
  const language = user.preferredLanguage || 'en';
  const message = renderTemplate(templateKey, language, { name: user.name, ...data });

  for (const channel of activeChannels) {
    if (!channel.canSendTo(user)) continue;

    try {
      await channel.send(user, message);
    } catch (error) {
      console.error(`Notification "${templateKey}" via ${channel.name} failed:`, error.message);
    }
  }
}

module.exports = { notify };
