const crypto = require('crypto');
const request = require('supertest');
const createApp = require('../src/app');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const SubOrder = require('../src/models/SubOrder');
const Cart = require('../src/models/Cart');
const StockMovement = require('../src/models/StockMovement');
const ShippingRate = require('../src/models/ShippingRate');
const PlatformSettings = require('../src/models/PlatformSettings');
const { testOutbox } = require('../src/config/mailer');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createUser, createLoggedInUser, loginAs } = require('./helpers/auth');
const { createShopFor, createCategory, createListedProduct } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

const KANDY_ADDRESS = {
  fullName: 'Kumari Silva',
  phone: '0771234567',
  addressLine1: '10 Lake Road',
  city: 'Kandy',
  district: 'kandy',
  postalCode: '20000',
};

// Two approved shops, each with one product (Rs 1,000.00, 500 g, stock 5), in a 10 % category.
async function twoShopsWithProducts() {
  const category = await createCategory({ commissionPercent: 10 });
  const shopA = await createShopFor(await createUser('seller'), 'approved');
  const shopB = await createShopFor(await createUser('seller'), 'approved');
  const productA = await createListedProduct(shopA, category, { weightGrams: 500 });
  const productB = await createListedProduct(shopB, category, { weightGrams: 500 });
  return { category, shopA, shopB, productA, productB };
}

// A logged-in customer with a saved Kandy address. Returns { agent, user, addressId }.
async function customerWithAddress() {
  const { agent, user } = await createLoggedInUser(app, 'customer');
  const response = await agent.post('/api/users/me/addresses').set(...CSRF).send(KANDY_ADDRESS);
  return { agent, user, addressId: response.body.addresses[0].id };
}

// Puts a product's first variant in the customer's cart.
function addToCart(agent, product, quantity) {
  return agent
    .post('/api/cart/items')
    .set(...CSRF)
    .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity });
}

// Previews, then places the order with the previewed total.
async function checkout(agent, addressId, idempotencyKey = crypto.randomUUID()) {
  const preview = await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId });
  return agent.post('/api/checkout/place-order').set(...CSRF).send({
    addressId,
    paymentMethod: 'cod',
    expectedTotal: preview.body.checkout?.grandTotal ?? 0,
    idempotencyKey,
  });
}

describe('Placing an order', () => {
  test('one checkout is split into one sub-order per shop, with stock, COD and commission', async () => {
    const { shopA, shopB, productA, productB } = await twoShopsWithProducts();
    const { agent, user, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 2);
    await addToCart(agent, productB, 1);

    const response = await checkout(agent, addressId);
    expect(response.status).toBe(201);
    expect(response.body.orderNumber).toMatch(/^KT-\d{6}-000001$/);

    const order = await Order.findOne({ orderNumber: response.body.orderNumber });
    const subOrders = await SubOrder.find({ order: order._id }).sort({ subOrderNumber: 1 });
    expect(subOrders).toHaveLength(2);
    expect(subOrders.map((s) => String(s.shop)).sort()).toEqual([String(shopA._id), String(shopB._id)].sort());

    // Fallback delivery rate: Rs 400 for the first kg. Shop A: 2 × 500 g = 1 kg → Rs 400.
    const subA = subOrders.find((s) => String(s.shop) === String(shopA._id));
    expect(subA.itemsSubtotal).toBe(200000);
    expect(subA.shippingFee).toBe(40000);
    expect(subA.total).toBe(240000);
    expect(subA.commissionTotal).toBe(20000); // 10 % of items only, not of delivery
    expect(subA.sellerNet).toBe(220000);
    expect(subA.delivery.codAmount).toBe(240000);
    expect(subA.status).toBe('placed');
    expect(subA.trackingHistory[0]).toMatchObject({ status: 'placed', byRole: 'customer' });
    expect(subA.items[0].name.en).toBe(productA.name.en);

    expect(order.grandTotal).toBe(240000 + 140000);
    expect(order.paymentMethod).toBe('cod');
    expect(order.paymentStatus).toBe('pending');
    expect(String(order.customer)).toBe(String(user._id));

    // Stock taken through stockService, cart emptied.
    expect((await Product.findById(productA._id)).variants[0].stock).toBe(3);
    expect(await StockMovement.countDocuments({ reason: 'online_order', refId: order._id })).toBe(2);
    expect((await Cart.findOne({ user: user._id })).items).toHaveLength(0);
  });

  test('the customer and both sellers get emails', async () => {
    const { productA, productB } = await twoShopsWithProducts();
    const { agent, user, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 1);
    await addToCart(agent, productB, 1);
    testOutbox.length = 0;

    const response = await checkout(agent, addressId);
    const subjects = testOutbox.map((mail) => `${mail.to}: ${mail.subject}`);
    expect(subjects).toContain(`${user.email}: Order ${response.body.orderNumber} placed`);
    expect(testOutbox.filter((mail) => mail.subject.startsWith('New order'))).toHaveLength(2);
  });

  test('an empty cart or a cart with a sold-out item cannot be checked out', async () => {
    const { productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();

    expect((await checkout(agent, addressId)).status).toBe(400);

    await addToCart(agent, productA, 3);
    await Product.updateOne({ _id: productA._id }, { 'variants.0.stock': 1 });
    const response = await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CART_HAS_PROBLEMS');
  });

  test('if the total changed since the customer saw it, the order is refused', async () => {
    const { productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 1);

    const response = await agent.post('/api/checkout/place-order').set(...CSRF).send({
      addressId,
      paymentMethod: 'cod',
      expectedTotal: 1, // the customer "saw" Rs 0.01
      idempotencyKey: crypto.randomUUID(),
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TOTAL_CHANGED');
    expect(await Order.countDocuments()).toBe(0);
  });

  test('the same checkout sent twice creates only one order and takes stock once', async () => {
    const { productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 2);
    const key = crypto.randomUUID();

    const preview = await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId });
    const body = { addressId, paymentMethod: 'cod', expectedTotal: preview.body.checkout.grandTotal, idempotencyKey: key };
    const [first, second] = await Promise.all([
      agent.post('/api/checkout/place-order').set(...CSRF).send(body),
      agent.post('/api/checkout/place-order').set(...CSRF).send(body),
    ]);

    expect(first.body.orderNumber).toBe(second.body.orderNumber);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(productA._id)).variants[0].stock).toBe(3);
  });

  test('two customers racing for the last item: only one order succeeds', async () => {
    const { productA } = await twoShopsWithProducts();
    await Product.updateOne({ _id: productA._id }, { 'variants.0.stock': 1 });
    const alice = await customerWithAddress();
    const bob = await customerWithAddress();
    await addToCart(alice.agent, productA, 1);
    await addToCart(bob.agent, productA, 1);

    const results = await Promise.all([checkout(alice.agent, alice.addressId), checkout(bob.agent, bob.addressId)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await Product.findById(productA._id)).variants[0].stock).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });

  test("another customer's address cannot be used", async () => {
    const { productA } = await twoShopsWithProducts();
    const alice = await customerWithAddress();
    const bob = await customerWithAddress();
    await addToCart(bob.agent, productA, 1);

    const response = await bob.agent.post('/api/checkout/preview').set(...CSRF).send({ addressId: alice.addressId });
    expect(response.status).toBe(404);
  });

  test('only Cash on Delivery is accepted for now', async () => {
    const { productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 1);
    const response = await agent.post('/api/checkout/place-order').set(...CSRF).send({
      addressId,
      paymentMethod: 'card',
      expectedTotal: 140000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(response.status).toBe(400);
  });
});

describe('Delivery fees', () => {
  test('shop rate for the district beats shop default, which beats admin rates', async () => {
    const { shopA, productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 3); // 1.5 kg → 2 started kg

    const fee = async () => (await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId })).body.checkout.groups[0].shippingFee;

    await ShippingRate.create({ shop: null, district: null, baseFee: 30000, extraPerKg: 5000 });
    expect(await fee()).toBe(35000);

    await ShippingRate.create({ shop: null, district: 'kandy', baseFee: 20000, extraPerKg: 5000 });
    expect(await fee()).toBe(25000);

    await ShippingRate.create({ shop: shopA._id, district: null, baseFee: 15000, extraPerKg: 1000 });
    expect(await fee()).toBe(16000);

    await ShippingRate.create({ shop: shopA._id, district: 'kandy', baseFee: 10000, extraPerKg: 0 });
    expect(await fee()).toBe(10000);
  });

  test("free shipping when the shop's items reach the threshold (shop setting beats platform)", async () => {
    const { shopA, productA } = await twoShopsWithProducts();
    const { agent, addressId } = await customerWithAddress();
    await addToCart(agent, productA, 2); // Rs 2,000
    const fee = async () => (await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId })).body.checkout.groups[0].shippingFee;

    await PlatformSettings.create({ key: 'platform', freeShippingThreshold: 150000 });
    expect(await fee()).toBe(0);

    shopA.freeShippingThreshold = 500000;
    await shopA.save();
    expect(await fee()).toBe(40000);
  });
});

describe('Who can see orders', () => {
  // Places one order for shops A and B and returns everything needed.
  async function placedOrder() {
    const shops = await twoShopsWithProducts();
    const customer = await customerWithAddress();
    await addToCart(customer.agent, shops.productA, 1);
    await addToCart(customer.agent, shops.productB, 1);
    const response = await checkout(customer.agent, customer.addressId);
    const subOrders = await SubOrder.find({ orderNumber: response.body.orderNumber }).populate('shop');
    return { ...shops, customer, orderNumber: response.body.orderNumber, subOrders };
  }

  test('a customer sees their own order, without commission, and not anyone else’s', async () => {
    const { customer, orderNumber } = await placedOrder();
    const stranger = await customerWithAddress();

    const own = await customer.agent.get(`/api/orders/${orderNumber}`);
    expect(own.status).toBe(200);
    expect(own.body.order.subOrders).toHaveLength(2);
    expect(JSON.stringify(own.body)).not.toMatch(/commission|sellerNet/);

    expect((await stranger.agent.get(`/api/orders/${orderNumber}`)).status).toBe(404);
    expect((await stranger.agent.get('/api/orders')).body.total).toBe(0);
  });

  test("each seller sees only their own sub-order, never the other shop's", async () => {
    const { subOrders, shopA } = await placedOrder();
    const subA = subOrders.find((s) => String(s.shop._id) === String(shopA._id));
    const subB = subOrders.find((s) => String(s.shop._id) !== String(shopA._id));
    const sellerA = await loginAs(app, { email: (await require('../src/models/User').findById(shopA.owner)).email });

    const list = await sellerA.get('/api/seller/orders');
    expect(list.body.orders.map((o) => o.subOrderNumber)).toEqual([subA.subOrderNumber]);
    expect(list.body.orders[0].commissionTotal).toBe(10000);
    expect(list.body.orders[0].shippingAddress.city).toBe('Kandy');

    expect((await sellerA.get(`/api/seller/orders/${subA.subOrderNumber}`)).status).toBe(200);
    expect((await sellerA.get(`/api/seller/orders/${subB.subOrderNumber}`)).status).toBe(404);
  });

  test('admin sees every order; other roles cannot use the admin order list', async () => {
    await placedOrder();
    const { agent: admin } = await createLoggedInUser(app, 'super_admin');
    expect((await admin.get('/api/admin/orders')).body.total).toBe(1);

    for (const role of ['seller', 'customer', 'rider', 'seller_cashier']) {
      const { agent } = await createLoggedInUser(app, role);
      expect((await agent.get('/api/admin/orders')).status).toBe(403);
    }
  });

  test.each(['seller', 'seller_cashier', 'rider', 'super_admin'])('%s cannot check out or list customer orders (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    expect((await agent.post('/api/checkout/preview').set(...CSRF).send({ addressId: '0'.repeat(24) })).status).toBe(403);
    expect((await agent.get('/api/orders')).status).toBe(403);
  });

  test('a cashier cannot see the seller order list (403)', async () => {
    const { shopA } = await twoShopsWithProducts();
    const { agent } = await createLoggedInUser(app, 'seller_cashier', { shop: shopA._id });
    expect((await agent.get('/api/seller/orders')).status).toBe(403);
  });

  test('anonymous visitors get 401', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).post('/api/checkout/preview').set(...CSRF).send({})).status).toBe(401);
  });
});

describe('Addresses', () => {
  test('the province is filled in from the district, and the first address is the default', async () => {
    const { agent } = await createLoggedInUser(app, 'customer');
    const response = await agent.post('/api/users/me/addresses').set(...CSRF).send(KANDY_ADDRESS);
    expect(response.body.addresses[0]).toMatchObject({ district: 'kandy', province: 'central', isDefault: true });
  });

  test("a user cannot change or delete someone else's address", async () => {
    const alice = await customerWithAddress();
    const bob = await createLoggedInUser(app, 'customer');
    expect((await bob.agent.patch(`/api/users/me/addresses/${alice.addressId}`).set(...CSRF).send({ city: 'Matale' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/users/me/addresses/${alice.addressId}`).set(...CSRF)).status).toBe(404);
  });

  test('an unknown district is refused', async () => {
    const { agent } = await createLoggedInUser(app, 'customer');
    const response = await agent.post('/api/users/me/addresses').set(...CSRF).send({ ...KANDY_ADDRESS, district: 'gotham' });
    expect(response.status).toBe(400);
  });
});

describe('Admin settings and delivery rates', () => {
  test('admin changes settings and default rates (audited); others are refused', async () => {
    const { agent: admin } = await createLoggedInUser(app, 'super_admin');
    const settings = await admin.patch('/api/admin/settings').set(...CSRF).send({ freeShippingThreshold: 500000 });
    expect(settings.body.settings.freeShippingThreshold).toBe(500000);

    const rates = await admin
      .put('/api/admin/shipping-rates')
      .set(...CSRF)
      .send({ rates: [{ district: null, baseFee: 35000, extraPerKg: 8000 }, { district: 'colombo', baseFee: 25000, extraPerKg: 5000 }] });
    expect(rates.body.rates).toHaveLength(2);

    const { agent: seller } = await createLoggedInUser(app, 'seller');
    expect((await seller.patch('/api/admin/settings').set(...CSRF).send({ returnPeriodDays: 1 })).status).toBe(403);
    expect((await seller.put('/api/admin/shipping-rates').set(...CSRF).send({ rates: [] })).status).toBe(403);
  });

  test('a seller sets their own rates only for their own shop', async () => {
    const { shopA } = await twoShopsWithProducts();
    const seller = await loginAs(app, { email: (await require('../src/models/User').findById(shopA.owner)).email });
    const response = await seller
      .put('/api/seller/shipping-rates')
      .set(...CSRF)
      .send({ rates: [{ district: null, baseFee: 20000, extraPerKg: 0 }] });
    expect(response.status).toBe(200);
    expect(await ShippingRate.countDocuments({ shop: shopA._id })).toBe(1);
    expect(await ShippingRate.countDocuments({ shop: null })).toBe(0);
  });
});
