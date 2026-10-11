const CourierProvider = require('./CourierProvider');

// Couriers sellers can pick from (they may also type another name).
// trackingUrlTemplate: add a courier's public tracking page here, with {number} where the
// tracking number goes, and "Track with courier" links will be built automatically.
// Left empty on purpose until each courier's real tracking URL is confirmed.
const KNOWN_COURIERS = [
  { name: 'Pronto Lanka', trackingUrlTemplate: '' },
  { name: 'Domex', trackingUrlTemplate: '' },
  { name: 'Koombiyo Delivery', trackingUrlTemplate: '' },
  { name: 'Prompt Xpress', trackingUrlTemplate: '' },
  { name: 'Certis Lanka', trackingUrlTemplate: '' },
  { name: 'Sri Lanka Post', trackingUrlTemplate: '' },
];

// Builds a tracking link from a known courier's template, or returns ''.
function trackingUrlFromTemplate(courierName, trackingNumber) {
  const courier = KNOWN_COURIERS.find((known) => known.name.toLowerCase() === String(courierName).toLowerCase());
  if (!courier || !courier.trackingUrlTemplate) return '';
  return courier.trackingUrlTemplate.replace('{number}', encodeURIComponent(trackingNumber));
}

// The seller handles the courier themselves and types in what the courier gave them.
class ManualCourierProvider extends CourierProvider {
  get id() {
    return 'manual';
  }

  // Nothing is booked; we just keep what the seller entered. A link typed by the seller wins,
  // otherwise one is built from the courier's template (if known).
  async createShipment(subOrder, { courierName, trackingNumber, trackingUrl }) {
    return {
      courierName,
      trackingNumber,
      trackingUrl: trackingUrl || trackingUrlFromTemplate(courierName, trackingNumber),
    };
  }
}

module.exports = { ManualCourierProvider, KNOWN_COURIERS };
