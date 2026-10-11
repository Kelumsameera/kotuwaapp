// The interface every courier integration follows. Today only the manual provider exists:
// the seller types the courier name and tracking number themselves.
// To connect a real courier API later (e.g. Pronto, Domex, Koombiyo): create a class that
// extends this one, implement the methods, and register it in couriers/index.js.
// Nothing else in the app needs to change.
class CourierProvider {
  // A short id stored on the sub-order, e.g. "manual" or "pronto".
  get id() {
    throw new Error('Courier provider must define an id');
  }

  // Books a pickup for a parcel. Returns { trackingNumber, trackingUrl } (or what is known).
  async createShipment(subOrder, details) { // eslint-disable-line no-unused-vars
    throw new Error('Courier provider must implement createShipment()');
  }

  // Asks the courier for the latest status of a parcel. Returns { status, note } or null.
  async fetchStatus(trackingNumber) { // eslint-disable-line no-unused-vars
    return null;
  }
}

module.exports = CourierProvider;
