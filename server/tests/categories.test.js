const request = require('supertest');
const createApp = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { createCategory, createSellerWithShop, productBody } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('Categories', () => {
  test('admin creates, edits commission (audited) and deletes a category', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');

    const created = await agent
      .post('/api/admin/categories')
      .set(...CSRF)
      .send({ name: { en: 'Electronics', si: 'ඉලෙක්ට්‍රොනික', ta: 'மின்னணு' }, commissionPercent: 7.5 });
    expect(created.status).toBe(201);
    const id = created.body.category.id;

    const updated = await agent.patch(`/api/admin/categories/${id}`).set(...CSRF).send({ commissionPercent: 8 });
    expect(updated.body.category.commissionPercent).toBe(8);
    const log = await AuditLog.findOne({ action: 'category.commission_change', targetId: id });
    expect(log.before).toEqual({ commissionPercent: 7.5 });

    expect((await agent.delete(`/api/admin/categories/${id}`).set(...CSRF)).status).toBe(204);
  });

  test('commission must be between 0 and 100 with at most 2 decimals', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    for (const commissionPercent of [-1, 101, 5.123]) {
      const response = await agent.post('/api/admin/categories').set(...CSRF).send({ name: { en: 'X' }, commissionPercent });
      expect(response.status).toBe(400);
    }
  });

  test('only two levels: a sub-category cannot be a parent', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const top = await createCategory();
    const child = await createCategory({ parent: top._id });
    const response = await agent
      .post('/api/admin/categories')
      .set(...CSRF)
      .send({ name: { en: 'Grandchild' }, parent: String(child._id), commissionPercent: 5 });
    expect(response.status).toBe(400);
  });

  test('a category used by products cannot be deleted', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const seller = await createSellerWithShop(app);
    const category = await createCategory();
    await seller.agent.post('/api/seller/products').set(...CSRF).send(productBody(category._id, seller.shop._id));

    expect((await agent.delete(`/api/admin/categories/${category._id}`).set(...CSRF)).status).toBe(409);
  });

  test('the public list shows active categories only', async () => {
    await createCategory({ name: { en: 'Visible' } });
    await createCategory({ name: { en: 'Hidden' }, isActive: false });
    const response = await request(app).get('/api/categories');
    expect(response.body.categories.map((c) => c.name.en)).toEqual(['Visible']);
  });

  test.each(['seller', 'seller_cashier', 'rider', 'customer'])('%s cannot manage categories (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    const response = await agent.post('/api/admin/categories').set(...CSRF).send({ name: { en: 'X' }, commissionPercent: 5 });
    expect(response.status).toBe(403);
    expect((await agent.get('/api/admin/categories')).status).toBe(403);
  });
});
