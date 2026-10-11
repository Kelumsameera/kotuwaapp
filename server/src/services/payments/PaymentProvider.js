// The interface every payment method follows. Cash on Delivery is the first one.
// To add PayHere later: create payhereProvider.js extending this class, implement the
// methods, and register it in payments/index.js. No order code needs to change.
class PaymentProvider {
  // The method name stored on orders, e.g. "cod" or "payhere".
  get method() {
    throw new Error('Payment provider must define a method name');
  }

  // Called inside the checkout transaction, before the order is saved.
  // May fill in payment details on the order and sub-orders. Returns { paymentStatus }.
  async createPayment(order, subOrders, session) { // eslint-disable-line no-unused-vars
    throw new Error('Payment provider must implement createPayment()');
  }

  // Handles a callback from an online gateway (not used by Cash on Delivery).
  async handleCallback(req) { // eslint-disable-line no-unused-vars
    throw new Error('This payment method has no callbacks');
  }

  // Gives money back to the customer.
  async refund(order, amount) { // eslint-disable-line no-unused-vars
    throw new Error('Payment provider must implement refund()');
  }
}

module.exports = PaymentProvider;
