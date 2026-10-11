const CodProvider = require('./codProvider');
const { badRequest } = require('../../utils/AppError');

// Every payment method the shop accepts. Add new PayhereProvider() here later.
const providers = [new CodProvider()];

// Returns the provider for a method name like "cod".
function getPaymentProvider(method) {
  const provider = providers.find((candidate) => candidate.method === method);
  if (!provider) throw badRequest('PAYMENT_METHOD_UNAVAILABLE', 'This payment method is not available.');
  return provider;
}

module.exports = { getPaymentProvider };
