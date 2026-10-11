const mongoose = require('mongoose');
const createApp = require('../src/app');
const Earning = require('../src/models/Earning');
const Payout = require('../src/models/Payout');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { sendLowStockDigests } = require('../src/services/lowStockService');
const { reverseEarning } = require('../src/services/earningsService');
const { runInTransaction } = require('../src/utils/transaction');
const { testOutbox } = require('../src/config/mailer');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const request = require('supertest');
const { CSRF, createLoggedInUser, lastEmailToken } = require('./helpers/auth');
const { createSellerWithShop, createCategory, createListedProduct } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

const BANK = { bankName: 'Bank of Ceylon', branch: 'Kandy', accountName: 'Nimal Perera', accountNumber: '1234567890' };

// Creates an earning directly (as if an order was delivered and its return period passed).
let earningCounter = 0;
function createEarning(shop, net, status = 'available') {
  earningCounter += 1;
  return Earning.create({
    shop: shop._id,
    subOrder: new mongoose.Types.ObjectId(),
    subOrderNumber: `KT-261011-${String(earningCounter).padStart(6, '0')}-1`,
    gross: net + 10000,
    commission: 10000,
    net,
    status,
    releaseAt: new Date(),
  });
}

// Logs in with an email and password and returns the agent (keeps cookies like a browser).
async function loginWith(email, password) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').set(...CSRF).send({ email, password });
  return { agent, status: response.status };
}

// Makes a cashier for the seller's shop through the API. Returns the cashier's user id.
async function addCashier(seller, email = `cashier-${Date.now()}@test.lk`) {
  const response = await seller.agent
    .post('/api/seller/staff')
    .set(...CSRF)
    .send({ name: 'Saman Cashier', email, phone: '0711234567', password: 'Cashier123!' });
  if (response.status !== 201) throw new Error(JSON.stringify(response.body));
  // The cashier opens the verification link from their email.
  await request(app).post('/api/auth/verify-email').set(...CSRF).send({ token: lastEmailToken(email) });
  return { id: response.body.user.id, email };
}

describe('Staff (cashier accounts)', () => {
  test('a new cashier must verify their email before logging in', async () => {
    const seller = await createSellerWithShop(app);
    const email = 'unverified-cashier@test.lk';
    await seller.agent.post('/api/seller/staff').set(...CSRF).send({ name: 'New Cashier', email, phone: '0711234567', password: 'Cashier123!' });
    const { status } = await loginWith(email, 'Cashier123!');
    expect(status).toBe(403);
  });

  test('a seller adds a cashier, who can log in but only gets POS rights', async () => {
    const seller = await createSellerWithShop(app);
    const { email } = await addCashier(seller);

    const cashierUser = await User.findOne({ email });
    expect(cashierUser.role).toBe('seller_cashier');
    expect(String(cashierUser.shop)).toBe(String(seller.shop._id));

    const { agent, status } = await loginWith(email, 'Cashier123!');
    expect(status).toBe(200);

    // Refused everywhere except POS (built in phase 7).
    for (const path of ['/api/seller/products', '/api/seller/orders', '/api/seller/earnings', '/api/seller/payouts', '/api/seller/staff', '/api/seller/dashboard', '/api/seller/shop']) {
      expect((await agent.get(path)).status).toBe(403);
    }
    expect((await agent.post('/api/seller/payouts').set(...CSRF)).status).toBe(403);
  });

  test('disabling a cashier logs them out at once; a password reset also logs them out', async () => {
    const seller = await createSellerWithShop(app);
    const { id, email } = await addCashier(seller);
    const { agent } = await loginWith(email, 'Cashier123!');
    expect((await agent.get('/api/users/me')).status).toBe(200);

    await seller.agent.patch(`/api/seller/staff/${id}/status`).set(...CSRF).send({ isActive: false });
    expect((await agent.get('/api/users/me')).status).toBe(401);

    await seller.agent.patch(`/api/seller/staff/${id}/status`).set(...CSRF).send({ isActive: true });
    await agent.post('/api/auth/login').set(...CSRF).send({ email, password: 'Cashier123!' });
    await seller.agent.post(`/api/seller/staff/${id}/password`).set(...CSRF).send({ password: 'NewCashier1!' });
    expect((await agent.get('/api/users/me')).status).toBe(401);
    const relogin = await agent.post('/api/auth/login').set(...CSRF).send({ email, password: 'NewCashier1!' });
    expect(relogin.status).toBe(200);

    expect(await AuditLog.countDocuments({ action: { $regex: /^staff\./ } })).toBe(4);
  });

  test("seller B cannot see or change seller A's cashiers, nor any non-cashier user", async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);
    const { id } = await addCashier(sellerA);
    const customer = await createLoggedInUser(app, 'customer');

    expect((await sellerB.agent.get('/api/seller/staff')).body.staff).toHaveLength(0);
    expect((await sellerB.agent.patch(`/api/seller/staff/${id}/status`).set(...CSRF).send({ isActive: false })).status).toBe(404);
    expect((await sellerB.agent.post(`/api/seller/staff/${id}/password`).set(...CSRF).send({ password: 'Hijack123!' })).status).toBe(404);
    expect((await sellerA.agent.post(`/api/seller/staff/${customer.user._id}/password`).set(...CSRF).send({ password: 'Hijack123!' })).status).toBe(404);
  });

  test.each(['customer', 'rider', 'super_admin', 'seller_cashier'])('%s cannot manage staff (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    expect((await agent.get('/api/seller/staff')).status).toBe(403);
  });
});

describe('Earnings and payouts', () => {
  test('full flow: bank details → request → approve → paid (earnings marked paid, audited, emailed)', async () => {
    const seller = await createSellerWithShop(app);
    await createEarning(seller.shop, 150000);
    await createEarning(seller.shop, 50000);
    await createEarning(seller.shop, 99999, 'pending');

    const noBank = await seller.agent.post('/api/seller/payouts').set(...CSRF);
    expect(noBank.body.error.code).toBe('BANK_DETAILS_REQUIRED');

    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    expect(await AuditLog.countDocuments({ action: 'shop.bank_change' })).toBe(1);

    const requested = await seller.agent.post('/api/seller/payouts').set(...CSRF);
    expect(requested.status).toBe(201);
    expect(requested.body.payout).toMatchObject({ amount: 200000, status: 'requested', earningsCount: 2 });
    expect(requested.body.payout.bank.accountNumber).toBe('•••• 7890');

    const twice = await seller.agent.post('/api/seller/payouts').set(...CSRF);
    expect(twice.body.error.code).toBe('PAYOUT_OPEN');

    const summary = (await seller.agent.get('/api/seller/earnings')).body.summary;
    expect(summary).toMatchObject({ available: 0, inPayout: 200000, pending: 99999 });

    const admin = await createLoggedInUser(app, 'super_admin');
    const id = requested.body.payout.id;
    const noRef = await admin.agent.patch(`/api/admin/payouts/${id}`).set(...CSRF).send({ action: 'approve' });
    expect(noRef.body.payout.status).toBe('approved');
    expect((await admin.agent.patch(`/api/admin/payouts/${id}`).set(...CSRF).send({ action: 'mark_paid' })).body.error.code).toBe('REFERENCE_REQUIRED');

    testOutbox.length = 0;
    const paid = await admin.agent.patch(`/api/admin/payouts/${id}`).set(...CSRF).send({ action: 'mark_paid', reference: 'BOC-778899' });
    expect(paid.body.payout).toMatchObject({ status: 'paid', reference: 'BOC-778899' });
    expect(await Earning.countDocuments({ status: 'paid' })).toBe(2);
    expect(testOutbox.some((mail) => mail.text.includes('BOC-778899'))).toBe(true);
    expect(await AuditLog.countDocuments({ action: { $in: ['payout.request', 'payout.approve', 'payout.mark_paid'] } })).toBe(3);

    // Paid payouts are final.
    expect((await admin.agent.patch(`/api/admin/payouts/${id}`).set(...CSRF).send({ action: 'reject', note: 'Oops' })).status).toBe(409);
  });

  test('payouts need at least Rs 1,000 available', async () => {
    const seller = await createSellerWithShop(app);
    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    await createEarning(seller.shop, 99999);
    expect((await seller.agent.post('/api/seller/payouts').set(...CSRF)).body.error.code).toBe('PAYOUT_TOO_SMALL');
  });

  test('a rejected payout frees the earnings so the seller can ask again', async () => {
    const seller = await createSellerWithShop(app);
    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    await createEarning(seller.shop, 200000);
    const first = await seller.agent.post('/api/seller/payouts').set(...CSRF);

    const admin = await createLoggedInUser(app, 'super_admin');
    expect((await admin.agent.patch(`/api/admin/payouts/${first.body.payout.id}`).set(...CSRF).send({ action: 'reject' })).body.error.code).toBe('REASON_REQUIRED');
    await admin.agent.patch(`/api/admin/payouts/${first.body.payout.id}`).set(...CSRF).send({ action: 'reject', note: 'Account name does not match' });

    const second = await seller.agent.post('/api/seller/payouts').set(...CSRF);
    expect(second.status).toBe(201);
    expect(second.body.payout.amount).toBe(200000);
  });

  test('two payout requests at the same moment create only one payout', async () => {
    const seller = await createSellerWithShop(app);
    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    await createEarning(seller.shop, 300000);

    const results = await Promise.all([
      seller.agent.post('/api/seller/payouts').set(...CSRF),
      seller.agent.post('/api/seller/payouts').set(...CSRF),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Payout.countDocuments()).toBe(1);
  });

  test('a return reverses an earning and takes it out of an open payout', async () => {
    const seller = await createSellerWithShop(app);
    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    const earning = await createEarning(seller.shop, 150000);
    await createEarning(seller.shop, 60000);
    await seller.agent.post('/api/seller/payouts').set(...CSRF);

    await runInTransaction((session) => reverseEarning(earning.subOrder, session));

    const payout = await Payout.findOne({});
    expect(payout.amount).toBe(60000);
    expect(payout.earnings).toHaveLength(1);
  });

  test('each seller sees only their own earnings and payouts; only admins review payouts', async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);
    await sellerA.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    await createEarning(sellerA.shop, 200000);
    const request = await sellerA.agent.post('/api/seller/payouts').set(...CSRF);

    expect((await sellerB.agent.get('/api/seller/earnings')).body.total).toBe(0);
    expect((await sellerB.agent.get('/api/seller/payouts')).body.total).toBe(0);

    for (const agent of [sellerA.agent, sellerB.agent]) {
      expect((await agent.patch(`/api/admin/payouts/${request.body.payout.id}`).set(...CSRF).send({ action: 'approve' })).status).toBe(403);
      expect((await agent.get('/api/admin/payouts')).status).toBe(403);
    }
  });

  test('the bank account is never shown in public shop data', async () => {
    const seller = await createSellerWithShop(app);
    await seller.agent.patch('/api/seller/shop').set(...CSRF).send({ bankDetails: BANK });
    const response = await request(app).get(`/api/catalog/shops/${seller.shop.slug}`);
    expect(JSON.stringify(response.body)).not.toContain('1234567890');
  });
});

describe('Low stock', () => {
  test('lists variants at or below the alert level, emails the seller once, again only after a restock', async () => {
    const seller = await createSellerWithShop(app);
    const category = await createCategory();
    const product = await createListedProduct(seller.shop, category, {
      variants: [
        { sku: 'LOW-1', price: 1000, stock: 2 },
        { sku: 'OK-1', price: 1000, stock: 50 },
      ],
    });

    const list = await seller.agent.get('/api/seller/low-stock');
    expect(list.body.items.map((item) => item.sku)).toEqual(['LOW-1']);

    testOutbox.length = 0;
    expect(await sendLowStockDigests()).toBe(1);
    expect(testOutbox[0].text).toContain('LOW-1');
    expect(await sendLowStockDigests()).toBe(0);

    // Restock clears the alert; when it runs low again, a new email goes out.
    const lowVariant = product.variants[0]._id;
    await seller.agent.post(`/api/seller/products/${product._id}/variants/${lowVariant}/stock`).set(...CSRF).send({ change: 1 });
    expect((await Product.findById(product._id)).variants[0].lowStockAlertSentAt).toBeNull();
    expect(await sendLowStockDigests()).toBe(1);
  });
});

describe('Dashboard', () => {
  test('shows to-do counts, earnings, COD and low stock; cashiers are refused', async () => {
    const seller = await createSellerWithShop(app);
    await createEarning(seller.shop, 120000);
    await createEarning(seller.shop, 30000, 'pending');

    const response = await seller.agent.get('/api/seller/dashboard');
    expect(response.status).toBe(200);
    expect(response.body.dashboard.earnings).toMatchObject({ available: 120000, pending: 30000 });
    expect(response.body.dashboard.toDo).toMatchObject({ placed: 0, confirmed: 0 });

    const cashier = await createLoggedInUser(app, 'seller_cashier', { shop: seller.shop._id });
    expect((await cashier.agent.get('/api/seller/dashboard')).status).toBe(403);
  });
});
