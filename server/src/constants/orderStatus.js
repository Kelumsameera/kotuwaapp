const { ROLES } = require('./roles');

// Every status a sub-order (one seller's part of an order) can have.
const ORDER_STATUS = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  DELIVERY_FAILED: 'delivery_failed',
  RETURN_REQUESTED: 'return_requested',
  RETURNED: 'returned',
};

const ALL_ORDER_STATUSES = Object.values(ORDER_STATUS);

const PAYMENT_METHODS = ['cod'];
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'failed'];

// A failed delivery can be tried again this many times in total, then it goes back to the seller.
const MAX_DELIVERY_ATTEMPTS = 2;

const { SUPER_ADMIN, SELLER, RIDER, CUSTOMER } = ROLES;
const S = ORDER_STATUS;

// THE status rules: from each status, which next statuses are allowed, and which roles may make the move.
// Every status change in the app goes through deliveryService.changeStatus(), which checks this table.
const TRANSITIONS = {
  [S.PLACED]: {
    [S.CONFIRMED]: [SELLER, SUPER_ADMIN],
    [S.CANCELLED]: [SELLER, CUSTOMER, SUPER_ADMIN],
  },
  [S.CONFIRMED]: {
    [S.PACKED]: [SELLER, SUPER_ADMIN],
    [S.CANCELLED]: [SELLER, CUSTOMER, SUPER_ADMIN],
  },
  [S.PACKED]: {
    [S.SHIPPED]: [SELLER, SUPER_ADMIN],
    [S.CANCELLED]: [SELLER, SUPER_ADMIN],
  },
  [S.SHIPPED]: {
    [S.OUT_FOR_DELIVERY]: [SELLER, RIDER, SUPER_ADMIN],
  },
  [S.OUT_FOR_DELIVERY]: {
    [S.DELIVERED]: [SELLER, RIDER, SUPER_ADMIN],
    [S.DELIVERY_FAILED]: [SELLER, RIDER, SUPER_ADMIN],
  },
  [S.DELIVERY_FAILED]: {
    // Try again (only while attempts are left) …
    [S.OUT_FOR_DELIVERY]: [SELLER, RIDER, SUPER_ADMIN],
    // … or give up and send the parcel back to the seller.
    [S.RETURNED]: [SELLER, SUPER_ADMIN],
  },
  [S.DELIVERED]: {
    [S.RETURN_REQUESTED]: [CUSTOMER],
  },
  [S.RETURN_REQUESTED]: {
    [S.RETURNED]: [SELLER, SUPER_ADMIN],
    // Return refused: back to delivered (a note explaining why is required).
    [S.DELIVERED]: [SELLER, SUPER_ADMIN],
  },
  [S.CANCELLED]: {},
  [S.RETURNED]: {},
};

// Returns the statuses a role may move a sub-order to from its current status.
function nextStatusesFor(currentStatus, role) {
  const moves = TRANSITIONS[currentStatus] || {};
  return Object.keys(moves).filter((nextStatus) => moves[nextStatus].includes(role));
}

// Statuses where the parcel is still on its way (used for "COD pending" and delay reports).
const OPEN_STATUSES = [S.PLACED, S.CONFIRMED, S.PACKED, S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERY_FAILED];

module.exports = {
  ORDER_STATUS,
  ALL_ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  MAX_DELIVERY_ATTEMPTS,
  TRANSITIONS,
  OPEN_STATUSES,
  nextStatusesFor,
};
