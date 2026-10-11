const { ManualCourierProvider, KNOWN_COURIERS } = require('./manualProvider');

// Every courier integration. Add new ProntoProvider() etc. here later.
const providers = [new ManualCourierProvider()];

// Returns the courier provider to use. Today every shipment uses the manual one.
function getCourierProvider(id = 'manual') {
  return providers.find((provider) => provider.id === id) || providers[0];
}

// Courier names for the seller's dropdown.
function listCourierNames() {
  return KNOWN_COURIERS.map((courier) => courier.name);
}

module.exports = { getCourierProvider, listCourierNames };
