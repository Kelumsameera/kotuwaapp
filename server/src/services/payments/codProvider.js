const PaymentProvider = require('./PaymentProvider');

// Cash on Delivery: nothing is charged now. Each sub-order's full total
// (items + delivery) is collected in cash by whoever delivers it.
class CodProvider extends PaymentProvider {
  get method() {
    return 'cod';
  }

  // Marks how much cash each delivery must collect. The order stays "pending" until delivered.
  async createPayment(order, subOrders) {
    for (const subOrder of subOrders) {
      subOrder.delivery.codAmount = subOrder.total;
    }
    return { paymentStatus: 'pending' };
  }

  // Cash refunds are handled by hand (bank transfer by the admin), so nothing happens here.
  async refund() {
    return { refunded: false, manual: true };
  }
}

module.exports = CodProvider;
