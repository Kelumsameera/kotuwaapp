const env = require('../../config/env');
const { translate, escapeHtml } = require('./translate');
const { formatMoney } = require('../../utils/money');

// Fonts that render Sinhala and Tamil correctly in most email apps.
const FONT_STACK = "'Noto Sans', 'Noto Sans Sinhala', 'Noto Sans Tamil', 'Iskoola Pota', 'Latha', Arial, sans-serif";

// Wraps email content in a simple, UTF-8 HTML layout.
function wrapInLayout(language, innerHtml) {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans&family=Noto+Sans+Sinhala&family=Noto+Sans+Tamil&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:${FONT_STACK};color:#18181b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;line-height:1.6;">
    ${innerHtml}
    <p style="margin-top:32px;font-size:12px;color:#71717a;">${translate(language, 'email.footer')}</p>
  </div>
</body>
</html>`;
}

// Builds a big clickable button for links in emails.
function button(url, label) {
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;">${label}</a></p>`;
}

// The same translation twice: HTML-safe (for the email body) and plain (for subject/text).
function both(language, key, values) {
  return {
    html: translate(language, key, values),
    text: translate(language, key, values, { html: false }),
  };
}

// Builds an email that has a greeting, a message, a button link and an expiry note.
function buildLinkEmail(language, keyPrefix, { name, url }) {
  const greeting = both(language, 'email.greeting', { name });
  const body = translate(language, `${keyPrefix}.body`);
  const buttonLabel = translate(language, `${keyPrefix}.button`);
  const expires = translate(language, `${keyPrefix}.expires`);

  return {
    subject: translate(language, `${keyPrefix}.subject`, {}, { html: false }),
    html: wrapInLayout(language, `<p>${greeting.html}</p><p>${body}</p>${button(url, buttonLabel)}<p style="font-size:13px;color:#52525b;">${expires}</p>`),
    text: `${greeting.text}\n\n${body}\n\n${url}\n\n${expires}`,
  };
}

// Builds an email that only has a greeting and a message.
function buildMessageEmail(language, keyPrefix, { name }) {
  const greeting = both(language, 'email.greeting', { name });
  const body = translate(language, `${keyPrefix}.body`);

  return {
    subject: translate(language, `${keyPrefix}.subject`, {}, { html: false }),
    html: wrapInLayout(language, `<p>${greeting.html}</p><p>${body}</p>`),
    text: `${greeting.text}\n\n${body}`,
  };
}

// Builds a "your X is now <status>" email, with the reason when there is one.
function buildStatusEmail(language, keyPrefix, data) {
  const greeting = both(language, 'email.greeting', data);
  const body = translate(language, `${keyPrefix}.${data.status}`);
  const reason = data.reason ? both(language, `${keyPrefix}.reason`, data) : null;

  return {
    subject: translate(language, `${keyPrefix}.subject`, data, { html: false }),
    html: wrapInLayout(language, `<p>${greeting.html}</p><p>${body}</p>${reason ? `<p>${reason.html}</p>` : ''}`),
    text: [greeting.text, body, reason?.text].filter(Boolean).join('\n\n'),
  };
}

// The name of an ordered item in the email's language, e.g. "Batik Sarong (L)".
function itemLabel(item, language) {
  const name = item.name?.[language] || item.name?.en || item.sku;
  const options = [item.options?.size, item.options?.color].filter(Boolean).join(' · ');
  return options ? `${name} (${options})` : name;
}

// The item lines of a sub-order as HTML rows and plain-text lines.
function itemLines(items, language) {
  const rows = items.map((item) => ({
    label: `${item.quantity} × ${itemLabel(item, language)}`,
    amount: formatMoney(item.lineTotal),
  }));
  return {
    html: rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td style="text-align:right">${row.amount}</td></tr>`).join(''),
    text: rows.map((row) => `${row.label} — ${row.amount}`).join('\n'),
  };
}

// Customer email: every shop's items and delivery fee, and the total to pay in cash.
function buildOrderPlacedEmail(language, { name, order, groups }) {
  const prefix = 'email.orderPlaced';
  const greeting = both(language, 'email.greeting', { name });
  const body = translate(language, `${prefix}.body`, { orderNumber: order.orderNumber });
  const url = `${env.CLIENT_URL}/orders/${order.orderNumber}`;

  const htmlGroups = [];
  const textGroups = [];
  for (const group of groups) {
    const lines = itemLines(group.items, language);
    const delivery = `${translate(language, `${prefix}.delivery`)}: ${formatMoney(group.shippingFee)}`;
    const shopTotal = `${translate(language, `${prefix}.shopTotal`)}: ${formatMoney(group.total)}`;
    htmlGroups.push(
      `<h3 style="margin:16px 0 4px">${escapeHtml(group.shopName)}</h3><table style="width:100%;font-size:14px">${lines.html}</table><p style="margin:4px 0;font-size:14px">${delivery}<br>${shopTotal}</p>`
    );
    textGroups.push(`${group.shopName}\n${lines.text}\n${delivery}\n${shopTotal}`);
  }

  const grandTotal = `${translate(language, `${prefix}.grandTotal`)}: ${formatMoney(order.grandTotal)}`;
  const footer = translate(language, `${prefix}.footer`);

  return {
    subject: translate(language, `${prefix}.subject`, { orderNumber: order.orderNumber }, { html: false }),
    html: wrapInLayout(
      language,
      `<p>${greeting.html}</p><p>${body}</p>${htmlGroups.join('')}<p><strong>${grandTotal}</strong></p><p>${footer}</p>${button(url, translate(language, `${prefix}.button`))}`
    ),
    text: [greeting.text, body, ...textGroups, grandTotal, footer, url].join('\n\n'),
  };
}

// Seller email: the new sub-order's items, total and the cash to collect.
function buildNewSubOrderEmail(language, { name, subOrder }) {
  const prefix = 'email.newSubOrder';
  const greeting = both(language, 'email.greeting', { name });
  const body = translate(language, `${prefix}.body`);
  const lines = itemLines(subOrder.items, language);
  const total = `${translate(language, `${prefix}.total`)}: ${formatMoney(subOrder.total)}`;
  const cod = `${translate(language, `${prefix}.cod`)}: ${formatMoney(subOrder.delivery?.codAmount)}`;
  const url = `${env.CLIENT_URL}/seller/orders/${subOrder.subOrderNumber}`;

  return {
    subject: translate(language, `${prefix}.subject`, { subOrderNumber: subOrder.subOrderNumber }, { html: false }),
    html: wrapInLayout(
      language,
      `<p>${greeting.html}</p><p>${body}</p><table style="width:100%;font-size:14px">${lines.html}</table><p>${total}<br><strong>${cod}</strong></p>${button(url, translate(language, `${prefix}.button`))}`
    ),
    text: [greeting.text, body, lines.text, total, cod, url].join('\n\n'),
  };
}

// Customer email after every status change: what happened, any note, courier details and a link.
function buildOrderStatusEmail(language, { name, subOrder, note }) {
  const prefix = 'email.orderStatusChanged';
  const status = subOrder.status;
  const statusLabel = translate(language, `email.statusLabel.${status}`, {}, { html: false });
  const greeting = both(language, 'email.greeting', { name });
  const message = translate(language, `email.statusMessage.${status}`);
  const noteLine = note ? both(language, `${prefix}.note`, { note }) : null;
  const delivery = subOrder.delivery || {};
  const trackingLine =
    status === 'shipped' && delivery.trackingNumber
      ? both(language, `${prefix}.tracking`, { courier: delivery.courierName, number: delivery.trackingNumber })
      : null;
  const url = `${env.CLIENT_URL}/orders/${subOrder.orderNumber}`;

  const htmlParts = [`<p>${greeting.html}</p>`, `<p><strong>${escapeHtml(subOrder.subOrderNumber)}</strong>: ${message}</p>`];
  if (trackingLine) htmlParts.push(`<p>${trackingLine.html}</p>`);
  if (noteLine) htmlParts.push(`<p>${noteLine.html}</p>`);
  htmlParts.push(button(url, translate(language, `${prefix}.button`)));

  return {
    subject: translate(language, `${prefix}.subject`, { subOrderNumber: subOrder.subOrderNumber, status: statusLabel }, { html: false }),
    html: wrapInLayout(language, htmlParts.join('')),
    text: [greeting.text, `${subOrder.subOrderNumber}: ${message}`, trackingLine?.text, noteLine?.text, url].filter(Boolean).join('\n\n'),
  };
}

// Seller email when the customer cancels or asks for a return.
function buildSellerOrderUpdateEmail(language, { name, subOrder, note }) {
  const prefix = 'email.sellerOrderUpdate';
  const greeting = both(language, 'email.greeting', { name });
  const message = translate(language, `${prefix}.${subOrder.status}`);
  const reason = note ? both(language, `${prefix}.reason`, { note }) : null;
  const url = `${env.CLIENT_URL}/seller/orders/${subOrder.subOrderNumber}`;

  return {
    subject: translate(language, `${prefix}.subject`, { subOrderNumber: subOrder.subOrderNumber }, { html: false }),
    html: wrapInLayout(
      language,
      `<p>${greeting.html}</p><p>${message}</p>${reason ? `<p>${reason.html}</p>` : ''}${button(url, translate(language, `${prefix}.button`))}`
    ),
    text: [greeting.text, message, reason?.text, url].filter(Boolean).join('\n\n'),
  };
}

// Seller email listing items that newly ran low on stock.
function buildLowStockEmail(language, { name, shopName, items }) {
  const prefix = 'email.lowStockDigest';
  const greeting = both(language, 'email.greeting', { name });
  const body = translate(language, `${prefix}.body`);
  const rows = items.map((item) => {
    const label = itemLabel(item, language);
    const left = translate(language, `${prefix}.left`, { count: item.stock }, { html: false });
    return { label: `${label} [${item.sku}]`, left };
  });
  const url = `${env.CLIENT_URL}/seller/products`;

  return {
    subject: translate(language, `${prefix}.subject`, { shopName }, { html: false }),
    html: wrapInLayout(
      language,
      `<p>${greeting.html}</p><p>${body}</p><table style="width:100%;font-size:14px">${rows
        .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td style="text-align:right">${escapeHtml(row.left)}</td></tr>`)
        .join('')}</table>${button(url, translate(language, `${prefix}.button`))}`
    ),
    text: [greeting.text, body, rows.map((row) => `${row.label} — ${row.left}`).join('\n'), url].join('\n\n'),
  };
}

// Seller email when the admin approves, rejects or pays a payout.
function buildPayoutEmail(language, { name, payout, reason }) {
  const prefix = 'email.payoutStatusChanged';
  const values = { amount: formatMoney(payout.amount), reference: payout.reference || '' };
  const greeting = both(language, 'email.greeting', { name });
  const message = both(language, `${prefix}.${payout.status}`, values);
  const reasonLine = reason ? both(language, `${prefix}.reason`, { reason }) : null;
  const url = `${env.CLIENT_URL}/seller/earnings`;

  return {
    subject: translate(language, `${prefix}.subject`, values, { html: false }),
    html: wrapInLayout(
      language,
      `<p>${greeting.html}</p><p>${message.html}</p>${reasonLine ? `<p>${reasonLine.html}</p>` : ''}${button(url, translate(language, `${prefix}.button`))}`
    ),
    text: [greeting.text, message.text, reasonLine?.text, url].filter(Boolean).join('\n\n'),
  };
}

// Every notification type and how to build it. New types (order status, etc.) are added here.
const TEMPLATES = {
  verifyEmail: (language, data) => buildLinkEmail(language, 'email.verifyEmail', data),
  resetPassword: (language, data) => buildLinkEmail(language, 'email.resetPassword', data),
  passwordChanged: (language, data) => buildMessageEmail(language, 'email.passwordChanged', data),
  shopStatusChanged: (language, data) => buildStatusEmail(language, 'email.shopStatusChanged', data),
  productStatusChanged: (language, data) => buildStatusEmail(language, 'email.productStatusChanged', data),
  orderPlaced: buildOrderPlacedEmail,
  newSubOrder: buildNewSubOrderEmail,
  orderStatusChanged: buildOrderStatusEmail,
  sellerOrderUpdate: buildSellerOrderUpdateEmail,
  lowStockDigest: buildLowStockEmail,
  payoutStatusChanged: buildPayoutEmail,
};

// Returns { subject, html, text } for a template in the given language.
function renderTemplate(templateKey, language, data) {
  const build = TEMPLATES[templateKey];
  if (!build) throw new Error(`Unknown notification template "${templateKey}"`);
  return build(language, data);
}

module.exports = { renderTemplate };
