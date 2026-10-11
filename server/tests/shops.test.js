const request = require('supertest');
const createApp = require('../src/app');
const Shop = require('../src/models/Shop');
const AuditLog = require('../src/models/AuditLog');
const { testOutbox } = require('../src/config/mailer');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { shopBody, createSellerWithShop, shopImage } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('Opening a shop', () => {
  test('a seller can open one shop, which starts as pending', async () => {
    const { agent, user } = await createLoggedInUser(app, 'seller');

    const response = await agent.post('/api/seller/shop').set(...CSRF).send(shopBody());
    expect(response.status).toBe(201);
    expect(response.body.shop.status).toBe('pending');
    expect(response.body.shop.owner).toBe(String(user._id));

    const second = await agent.post('/api/seller/shop').set(...CSRF).send(shopBody({ name: 'Second' }));
    expect(second.status).toBe(409);
  });

  test('a seller cannot choose the status or owner of a new shop', async () => {
    const { agent } = await createLoggedInUser(app, 'seller');
    const response = await agent.post('/api/seller/shop').set(...CSRF).send({ ...shopBody(), status: 'approved' });
    expect(response.status).toBe(400);
  });

  test.each(['customer', 'rider', 'seller_cashier', 'super_admin'])('%s cannot open a shop (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    const response = await agent.post('/api/seller/shop').set(...CSRF).send(shopBody());
    expect(response.status).toBe(403);
  });

  test('anonymous visitors get 401', async () => {
    const response = await request(app).get('/api/seller/shop');
    expect(response.status).toBe(401);
  });

  test('an unknown district is refused', async () => {
    const { agent } = await createLoggedInUser(app, 'seller');
    const body = shopBody({ address: { addressLine1: '1 Road', city: 'X', district: 'atlantis' } });
    expect((await agent.post('/api/seller/shop').set(...CSRF).send(body)).status).toBe(400);
  });
});

describe('Editing my shop', () => {
  test('a seller only ever sees and edits their OWN shop', async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);

    const mine = await sellerA.agent.get('/api/seller/shop');
    expect(mine.body.shop.id).toBe(String(sellerA.shop._id));

    await sellerB.agent.patch('/api/seller/shop').set(...CSRF).send({ name: 'Renamed B' });
    expect((await Shop.findById(sellerA.shop._id)).name).not.toBe('Renamed B');
    expect((await Shop.findById(sellerB.shop._id)).name).toBe('Renamed B');
  });

  test('logo must be an image uploaded by this shop', async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);

    const ownImage = await sellerA.agent.patch('/api/seller/shop').set(...CSRF).send({ logo: shopImage(sellerA.shop._id) });
    expect(ownImage.status).toBe(200);

    const stolenImage = await sellerA.agent.patch('/api/seller/shop').set(...CSRF).send({ logo: shopImage(sellerB.shop._id) });
    expect(stolenImage.status).toBe(400);

    const outsideUrl = await sellerA.agent
      .patch('/api/seller/shop')
      .set(...CSRF)
      .send({ logo: { url: 'https://evil.example/x.jpg', publicId: `kotuwa/shops/${sellerA.shop._id}/x` } });
    expect(outsideUrl.status).toBe(400);
  });

  test('a suspended shop cannot be edited', async () => {
    const { agent } = await createSellerWithShop(app, 'suspended');
    const response = await agent.patch('/api/seller/shop').set(...CSRF).send({ name: 'New name' });
    expect(response.status).toBe(403);
  });

  test('editing a rejected shop sends it back for review', async () => {
    const { agent, shop } = await createSellerWithShop(app, 'rejected');
    await agent.patch('/api/seller/shop').set(...CSRF).send({ name: 'Fixed name' });
    expect((await Shop.findById(shop._id)).status).toBe('pending');
  });
});

describe('Admin shop approval', () => {
  test('admin approves a shop: audit log + email to the seller', async () => {
    const { agent: adminAgent, user: admin } = await createLoggedInUser(app, 'super_admin');
    const { shop, user: seller } = await createSellerWithShop(app, 'pending');

    const response = await adminAgent.patch(`/api/admin/shops/${shop._id}/status`).set(...CSRF).send({ status: 'approved' });
    expect(response.status).toBe(200);
    expect(response.body.shop.status).toBe('approved');

    const log = await AuditLog.findOne({ action: 'shop.approve', targetId: shop._id });
    expect(String(log.actor)).toBe(String(admin._id));
    expect(testOutbox.some((mail) => mail.to === seller.email && /approved/.test(mail.text))).toBe(true);
  });

  test('suspending needs a reason', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const { shop } = await createSellerWithShop(app);
    const response = await agent.patch(`/api/admin/shops/${shop._id}/status`).set(...CSRF).send({ status: 'suspended' });
    expect(response.status).toBe(400);
  });

  test.each(['seller', 'customer', 'rider', 'seller_cashier'])('%s cannot approve shops (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    const { shop } = await createSellerWithShop(app, 'pending');
    const response = await agent.patch(`/api/admin/shops/${shop._id}/status`).set(...CSRF).send({ status: 'approved' });
    expect(response.status).toBe(403);
    expect((await Shop.findById(shop._id)).status).toBe('pending');
  });
});
