const request = require('supertest');
const createApp = require('../src/app');
const SubOrder = require('../src/models/SubOrder');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const Earning = require('../src/models/Earning');
const PlatformSettings = require('../src/models/PlatformSettings');
const AuditLog = require('../src/models/AuditLog');
const { releaseDueEarnings } = require('../src/services/earningsService');
const { testOutbox } = require('../src/config/mailer');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { placeTestOrder, sellerSteps, TO_OUT_FOR_DELIVERY } = require('./helpers/orders');

const app = createApp();

// A tiny but real PNG, as a drawn signature would be sent.
const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// Reads the sub-order straight from the database.
const loadSubOrder = (subOrderNumber) => SubOrder.findOne({ subOrderNumber });
const stockOf = async (product) => (await Product.findById(product._id)).variants[0].stock;

describe('Seller delivers it themselves', () => {
  test('placed → … → delivered: timeline, cash, earning, payment and emails', async () => {
    const order = await placeTestOrder(app);
    testOutbox.length = 0;

    await sellerSteps(order.seller, order.subOrderNumber, [
      ...TO_OUT_FOR_DELIVERY,
      { status: 'delivered', cashCollected: true, note: 'Handed to Kumari' },
    ]);

    const subOrder = await loadSubOrder(order.subOrderNumber);
    expect(subOrder.trackingHistory.map((event) => event.status)).toEqual([
      'placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered',
    ]);
    expect(subOrder.trackingHistory.every((event) => event.at && event.byRole)).toBe(true);
    expect(subOrder.delivery.codCollected).toBe(true);
    expect(subOrder.delivery.method).toBe('self');

    const earning = await Earning.findOne({ subOrder: subOrder._id });
    expect(earning).toMatchObject({ status: 'pending', net: subOrder.sellerNet });
    const daysUntilRelease = (earning.releaseAt - subOrder.delivery.deliveredAt) / 86400000;
    expect(daysUntilRelease).toBeCloseTo(7);

    expect((await Order.findOne({ orderNumber: order.orderNumber })).paymentStatus).toBe('paid');

    // One email to the customer per change.
    const customerMails = testOutbox.filter((mail) => mail.to === order.customerUser.email);
    expect(customerMails).toHaveLength(5);
    expect(customerMails.at(-1).subject).toBe(`${order.subOrderNumber}: Delivered`);
  });

  test("status emails use the customer's own language", async () => {
    const order = await placeTestOrder(app, { customerOverrides: { preferredLanguage: 'si' } });
    testOutbox.length = 0;
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }]);
    expect(testOutbox[0].subject).toBe(`${order.subOrderNumber}: තහවුරු කළා`);
  });

  test('statuses cannot be skipped or changed backwards', async () => {
    const order = await placeTestOrder(app);
    const skip = await order.seller.patch(`/api/seller/orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'delivered' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_STATUS_CHANGE');

    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }]);
    const back = await order.seller.patch(`/api/seller/orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'placed' });
    expect(back.status).toBe(409);
  });

  test('the same change sent twice at the same moment happens only once', async () => {
    const order = await placeTestOrder(app);
    const url = `/api/seller/orders/${order.subOrderNumber}/status`;
    const results = await Promise.all([
      order.seller.patch(url).set(...CSRF).send({ status: 'confirmed' }),
      order.seller.patch(url).set(...CSRF).send({ status: 'confirmed' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await loadSubOrder(order.subOrderNumber)).trackingHistory).toHaveLength(2);
  });
});

describe('Shipping with a courier', () => {
  test('needs the courier name and tracking number, and saves an https tracking link', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }, { status: 'packed' }]);
    const url = `/api/seller/orders/${order.subOrderNumber}/status`;

    const missing = await order.seller.patch(url).set(...CSRF).send({ status: 'shipped', method: 'courier', courierName: 'Domex' });
    expect(missing.body.error.code).toBe('TRACKING_REQUIRED');

    const badLink = await order.seller
      .patch(url)
      .set(...CSRF)
      .send({ status: 'shipped', method: 'courier', courierName: 'Domex', trackingNumber: 'DX1', trackingUrl: 'javascript:alert(1)' });
    expect(badLink.status).toBe(400);

    const shipped = await order.seller.patch(url).set(...CSRF).send({
      status: 'shipped',
      method: 'courier',
      courierName: 'Domex',
      trackingNumber: 'DX12345',
      trackingUrl: 'https://track.example.lk/DX12345',
    });
    expect(shipped.body.order.delivery).toMatchObject({ method: 'courier', courierName: 'Domex', trackingNumber: 'DX12345' });

    const customerView = await order.customer.get(`/api/orders/${order.orderNumber}`);
    expect(customerView.body.order.subOrders[0].delivery.trackingUrl).toBe('https://track.example.lk/DX12345');
  });

  test('a method switched off by the admin (or the shop) cannot be used', async () => {
    const order = await placeTestOrder(app);
    await PlatformSettings.updateOne({ key: 'platform' }, { deliveryMethods: { selfDelivery: true, courier: false } });
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }, { status: 'packed' }]);

    const response = await order.seller
      .patch(`/api/seller/orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'shipped', method: 'courier', courierName: 'Domex', trackingNumber: 'DX1' });
    expect(response.body.error.code).toBe('DELIVERY_METHOD_NOT_ALLOWED');

    order.shop.deliveryMethods = { selfDelivery: false, courier: true };
    await order.shop.save();
    const self = await order.seller.patch(`/api/seller/orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'shipped', method: 'self' });
    expect(self.body.error.code).toBe('DELIVERY_METHOD_NOT_ALLOWED');
  });
});

describe('Cancelling', () => {
  test('the customer can cancel before packing (with a reason); stock comes back', async () => {
    const order = await placeTestOrder(app);
    expect(await stockOf(order.product)).toBe(3);
    const url = `/api/orders/sub-orders/${order.subOrderNumber}/status`;

    expect((await order.customer.patch(url).set(...CSRF).send({ status: 'cancelled' })).status).toBe(400);

    const cancelled = await order.customer.patch(url).set(...CSRF).send({ status: 'cancelled', note: 'Ordered by mistake' });
    expect(cancelled.status).toBe(200);
    expect(await stockOf(order.product)).toBe(5);
    expect((await Order.findOne({ orderNumber: order.orderNumber })).paymentStatus).toBe('failed');
    expect(testOutbox.some((mail) => mail.subject === `Customer update on ${order.subOrderNumber}`)).toBe(true);
  });

  test('the customer cannot cancel once packed', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }, { status: 'packed' }]);
    const response = await order.customer
      .patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'cancelled', note: 'Too late?' });
    expect(response.status).toBe(403);
  });

  test("a customer cannot touch someone else's order", async () => {
    const order = await placeTestOrder(app);
    const stranger = await createLoggedInUser(app, 'customer');
    const response = await stranger.agent
      .patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'cancelled', note: 'Not mine' });
    expect(response.status).toBe(404);
  });
});

describe('Failed deliveries', () => {
  test('a reason is required, 2 attempts at most, then the parcel goes back to the seller', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, TO_OUT_FOR_DELIVERY);
    const url = `/api/seller/orders/${order.subOrderNumber}/status`;

    expect((await order.seller.patch(url).set(...CSRF).send({ status: 'delivery_failed' })).body.error.code).toBe('REASON_REQUIRED');

    await sellerSteps(order.seller, order.subOrderNumber, [
      { status: 'delivery_failed', failReason: 'Nobody home' },
      { status: 'out_for_delivery' },
      { status: 'delivery_failed', failReason: 'Phone switched off' },
    ]);

    const third = await order.seller.patch(url).set(...CSRF).send({ status: 'out_for_delivery' });
    expect(third.body.error.code).toBe('NO_ATTEMPTS_LEFT');

    const subOrder = await loadSubOrder(order.subOrderNumber);
    expect(subOrder.delivery.attempts).toBe(2);
    expect(subOrder.delivery.failReasons).toEqual(['Nobody home', 'Phone switched off']);

    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'returned', note: 'Back at shop' }]);
    expect(await stockOf(order.product)).toBe(5);
  });
});

describe('Returns', () => {
  test('within the return period: customer asks, seller accepts, stock back, earning reversed', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered', cashCollected: true }]);

    const asked = await order.customer
      .patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'return_requested', note: 'Wrong colour' });
    expect(asked.status).toBe(200);

    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'returned' }]);
    expect(await stockOf(order.product)).toBe(5);
    expect((await Earning.findOne({}))?.status).toBe('reversed');
  });

  test('after the return period, a return cannot be requested', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered', cashCollected: true }]);
    await SubOrder.updateOne({ subOrderNumber: order.subOrderNumber }, { 'delivery.deliveredAt': new Date(Date.now() - 8 * 86400000) });

    const response = await order.customer
      .patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'return_requested', note: 'Late' });
    expect(response.body.error.code).toBe('RETURN_PERIOD_OVER');
  });

  test('a refused return goes back to delivered with a reason', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered', cashCollected: true }]);
    await order.customer.patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'return_requested', note: 'Changed mind' });

    const noReason = await order.seller.patch(`/api/seller/orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'delivered' });
    expect(noReason.body.error.code).toBe('REASON_REQUIRED');
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'delivered', note: 'Item was used' }]);
    expect(await Earning.countDocuments()).toBe(1);
  });
});

describe('Earnings release', () => {
  test('earnings become available only after the return period, and not while a return is open', async () => {
    const first = await placeTestOrder(app);
    await sellerSteps(first.seller, first.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered', cashCollected: true }]);

    expect(await releaseDueEarnings()).toBe(0);
    const eightDaysLater = new Date(Date.now() + 8 * 86400000);
    expect(await releaseDueEarnings(eightDaysLater)).toBe(1);
    expect((await Earning.findOne({})).status).toBe('available');

    const second = await placeTestOrder(app);
    await sellerSteps(second.seller, second.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered', cashCollected: true }]);
    await second.customer.patch(`/api/orders/sub-orders/${second.subOrderNumber}/status`).set(...CSRF).send({ status: 'return_requested', note: 'Broken' });
    expect(await releaseDueEarnings(eightDaysLater)).toBe(0);
  });
});

describe('Riders', () => {
  // Places an order, ships it, and assigns a fresh rider as the admin.
  async function assignedOrder() {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, TO_OUT_FOR_DELIVERY.slice(0, 3));
    const admin = await createLoggedInUser(app, 'super_admin');
    const rider = await createLoggedInUser(app, 'rider');
    const assign = await admin.agent
      .patch(`/api/admin/deliveries/${order.subOrderNumber}/rider`)
      .set(...CSRF)
      .send({ riderId: String(rider.user._id) });
    expect(assign.status).toBe(200);
    return { ...order, admin: admin.agent, rider: rider.agent, riderUser: rider.user };
  }

  test('the rider sees only their own deliveries; others get 404', async () => {
    const order = await assignedOrder();
    const otherRider = await createLoggedInUser(app, 'rider');

    const list = await order.rider.get('/api/rider/deliveries');
    expect(list.body.deliveries.map((d) => d.subOrderNumber)).toEqual([order.subOrderNumber]);
    expect(list.body.deliveries[0].dropoff.phone).toBe('0771234567');
    expect(JSON.stringify(list.body)).not.toMatch(/commission|sellerNet/);

    expect((await otherRider.agent.get('/api/rider/deliveries')).body.total).toBe(0);
    expect((await otherRider.agent.get(`/api/rider/deliveries/${order.subOrderNumber}`)).status).toBe(404);
    const steal = await otherRider.agent
      .patch(`/api/rider/deliveries/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'out_for_delivery' });
    expect(steal.status).toBe(404);

    expect(await AuditLog.countDocuments({ action: 'delivery.assign_rider' })).toBe(1);
  });

  test('to mark delivered, the rider must collect the cash and give proof', async () => {
    const order = await assignedOrder();
    const url = `/api/rider/deliveries/${order.subOrderNumber}/status`;
    await order.rider.patch(url).set(...CSRF).send({ status: 'out_for_delivery' });

    const noCash = await order.rider.patch(url).set(...CSRF).send({ status: 'delivered', signature: SIGNATURE });
    expect(noCash.body.error.code).toBe('CASH_REQUIRED');

    const noProof = await order.rider.patch(url).set(...CSRF).send({ status: 'delivered', cashCollected: true });
    expect(noProof.body.error.code).toBe('PROOF_REQUIRED');

    const fakeSignature = await order.rider.patch(url).set(...CSRF).send({ status: 'delivered', cashCollected: true, signature: 'data:image/png;base64,AAAA' });
    expect(fakeSignature.body.error.code).toBe('INVALID_SIGNATURE');

    const delivered = await order.rider.patch(url).set(...CSRF).send({ status: 'delivered', cashCollected: true, signature: SIGNATURE });
    expect(delivered.status).toBe(200);
    expect(delivered.body.delivery.proof.hasSignature).toBe(true);
    // The signature image itself is never sent back.
    expect(JSON.stringify(delivered.body)).not.toContain('base64');

    const history = (await loadSubOrder(order.subOrderNumber)).trackingHistory;
    expect(history.at(-1)).toMatchObject({ status: 'delivered', byRole: 'rider' });
  });

  test('a rider cannot do seller steps (like cancelling) or use seller and admin routes', async () => {
    const order = await assignedOrder();
    const cancel = await order.rider
      .patch(`/api/rider/deliveries/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'cancelled' });
    expect(cancel.status).toBe(400);
    expect((await order.rider.get('/api/seller/orders')).status).toBe(403);
    expect((await order.rider.get('/api/admin/deliveries')).status).toBe(403);
  });

  test('only active riders can be assigned', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }]);
    const admin = await createLoggedInUser(app, 'super_admin');
    const customer = await createLoggedInUser(app, 'customer');
    const response = await admin.agent
      .patch(`/api/admin/deliveries/${order.subOrderNumber}/rider`)
      .set(...CSRF)
      .send({ riderId: String(customer.user._id) });
    expect(response.body.error.code).toBe('INVALID_RIDER');
  });
});

describe('Who can change what', () => {
  test("seller B cannot change seller A's order (404)", async () => {
    const order = await placeTestOrder(app);
    const other = await placeTestOrder(app);
    const response = await other.seller.patch(`/api/seller/orders/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'confirmed' });
    expect(response.status).toBe(404);
  });

  test('a customer cannot confirm or ship (validation refuses those statuses)', async () => {
    const order = await placeTestOrder(app);
    const response = await order.customer
      .patch(`/api/orders/sub-orders/${order.subOrderNumber}/status`)
      .set(...CSRF)
      .send({ status: 'confirmed' });
    expect(response.status).toBe(400);
  });

  test('admin can fix any order and sees the delivery board; others are refused', async () => {
    const order = await placeTestOrder(app);
    const admin = await createLoggedInUser(app, 'super_admin');
    const fixed = await admin.agent.patch(`/api/admin/deliveries/${order.subOrderNumber}/status`).set(...CSRF).send({ status: 'confirmed' });
    expect(fixed.body.delivery.status).toBe('confirmed');
    expect(fixed.body.delivery.nextStatuses).toEqual(['packed', 'cancelled']);

    expect((await admin.agent.get('/api/admin/deliveries')).body.total).toBe(1);
    for (const role of ['seller', 'customer', 'rider', 'seller_cashier']) {
      const { agent } = await createLoggedInUser(app, role);
      expect((await agent.get('/api/admin/deliveries')).status).toBe(403);
      expect((await agent.get('/api/admin/deliveries-report')).status).toBe(403);
    }
  });
});

describe('COD pending and the delivery report', () => {
  test('seller and admin see cash not yet collected', async () => {
    const order = await placeTestOrder(app);
    const summary = await order.seller.get('/api/seller/cod-summary');
    expect(summary.body.inTransit.amount).toBe(240000);

    // Delivered by courier, cash still with the courier.
    await sellerSteps(order.seller, order.subOrderNumber, [...TO_OUT_FOR_DELIVERY, { status: 'delivered' }]);
    const after = await order.seller.get('/api/seller/cod-summary');
    expect(after.body.deliveredNotCollected.amount).toBe(240000);

    await order.seller.post(`/api/seller/orders/${order.subOrderNumber}/cash-collected`).set(...CSRF);
    expect((await order.seller.get('/api/seller/cod-summary')).body.total).toBe(0);

    const admin = await createLoggedInUser(app, 'super_admin');
    const report = await admin.agent.get('/api/admin/deliveries-report?days=7');
    expect(report.body.report).toMatchObject({ deliveredCount: 1, firstAttemptSuccessPercent: 100 });
    expect(report.body.cod.total).toBe(0);
  });
});

describe('Public tracking', () => {
  test('order number + phone shows the timeline without personal details', async () => {
    const order = await placeTestOrder(app);
    await sellerSteps(order.seller, order.subOrderNumber, [{ status: 'confirmed' }]);

    for (const phone of ['0771234567', '+94 77 123 4567', '771234567']) {
      const response = await request(app).get('/api/track').query({ orderNumber: order.orderNumber, phone });
      expect(response.status).toBe(200);
      expect(response.body.tracking.parts[0].timeline.map((e) => e.status)).toEqual(['placed', 'confirmed']);
    }

    const body = JSON.stringify((await request(app).get('/api/track').query({ orderNumber: order.orderNumber, phone: '0771234567' })).body);
    expect(body).not.toMatch(/Lake Road|Kumari|0771234567|commission|lineTotal|unitPrice/);
  });

  test('a wrong phone or order number gives the same 404', async () => {
    const order = await placeTestOrder(app);
    const wrongPhone = await request(app).get('/api/track').query({ orderNumber: order.orderNumber, phone: '0719999999' });
    const wrongOrder = await request(app).get('/api/track').query({ orderNumber: 'KT-000000-000001', phone: '0771234567' });
    expect(wrongPhone.status).toBe(404);
    expect(wrongOrder.status).toBe(404);
    expect(wrongPhone.body.error.code).toBe(wrongOrder.body.error.code);
  });
});
