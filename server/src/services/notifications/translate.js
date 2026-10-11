const { LANGUAGES } = require('../../constants/roles');

const dictionaries = {
  en: require('../../locales/en.json'),
  si: require('../../locales/si.json'),
  ta: require('../../locales/ta.json'),
};

// Reads a nested key like "email.verifyEmail.subject" from one dictionary.
function readKey(dictionary, key) {
  return key.split('.').reduce((node, part) => (node ? node[part] : undefined), dictionary);
}

// Escapes text so values like a user's name are safe inside email HTML.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Returns the translated text for a key, falling back to English, and fills {{placeholders}}.
// Values are HTML-escaped unless { html: false } (for subjects and plain-text emails).
function translate(language, key, values = {}, { html = true } = {}) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const text = readKey(dictionaries[lang], key) ?? readKey(dictionaries.en, key) ?? key;

  return text.replace(/{{(\w+)}}/g, (match, name) => {
    if (values[name] === undefined) return '';
    return html ? escapeHtml(values[name]) : String(values[name]);
  });
}

module.exports = { translate, escapeHtml };
