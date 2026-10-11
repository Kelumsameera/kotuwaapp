// Every status a sub-order (one seller's part of an order) can have.
// The allowed moves between them are added with the delivery flow in phase 5.
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

module.exports = { ORDER_STATUS, ALL_ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES };
