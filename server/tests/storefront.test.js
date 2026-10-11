const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createUser, createLoggedInUser } = require('./helpers/auth');
const { createShopFor, createCategory, createListedProduct } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// An approved shop with one category, ready for listing tests.
async function approvedShop(status = 'approved') {
  const seller = await createUser('seller');
  const shop = await createShopFor(seller, status);
  const category = await createCategory();
  return { seller, shop, category };
}

// Returns the English names of the products the public list shows.
async function listedNames(query = '') {
  const response = await request(app).get(`/api/catalog/products${query}`);
  return response.body.products.map((product) => product.name.en).sort();
}

describe('What the store shows', () => {
  test('only approved, active, non-archived products of approved shops are listed', async () => {
    const { shop, category } = await approvedShop();
    const { shop: pendingShop } = await approvedShop('pending');

    await createListedProduct(shop, category, { name: { en: 'Visible' } });
    await createListedProduct(shop, category, { name: { en: 'Draft' }, status: 'draft' });
    await createListedProduct(shop, category, { name: { en: 'Pending' }, status: 'pending' });
    await createListedProduct(shop, category, { name: { en: 'Hidden' }, isActive: false });
    await createListedProduct(shop, category, { name: { en: 'Archived' }, archivedAt: new Date() });
    await createListedProduct(pendingShop, category, { name: { en: 'PendingShop' } });

    expect(await listedNames()).toEqual(['Visible']);
  });

  test('suspending a shop removes its products from the store at once', async () => {
    const { shop, category } = await approvedShop();
    const { agent: admin } = await createLoggedInUser(app, 'super_admin');
    await createListedProduct(shop, category, { name: { en: 'Sarong' } });

    await admin.patch(`/api/admin/shops/${shop._id}/status`).set(...CSRF).send({ status: 'suspended', reason: 'Fake goods' });
    expect(await listedNames()).toEqual([]);

    await admin.patch(`/api/admin/shops/${shop._id}/status`).set(...CSRF).send({ status: 'approved' });
    expect(await listedNames()).toEqual(['Sarong']);
  });

  test('product pages never show cost prices, and unlisted products are 404', async () => {
    const { shop, category } = await approvedShop();
    const listed = await createListedProduct(shop, category);
    const draft = await createListedProduct(shop, category, { status: 'draft' });

    const response = await request(app).get(`/api/catalog/products/${listed.slug}`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/costPrice|statusReason|owner/);
    expect(response.body.product.shop.name).toBe(shop.name);

    expect((await request(app).get(`/api/catalog/products/${draft.slug}`)).status).toBe(404);
  });
});

describe('Search, filters and sorting', () => {
  test('category filter includes sub-categories', async () => {
    const { shop } = await approvedShop();
    const fashion = await createCategory({ slug: 'fashion' });
    const sarees = await createCategory({ slug: 'sarees', parent: fashion._id });
    const books = await createCategory({ slug: 'books' });

    await createListedProduct(shop, fashion, { name: { en: 'Shirt' } });
    await createListedProduct(shop, sarees, { name: { en: 'Saree' } });
    await createListedProduct(shop, books, { name: { en: 'Novel' } });

    expect(await listedNames('?category=fashion')).toEqual(['Saree', 'Shirt']);
    expect(await listedNames('?category=sarees')).toEqual(['Saree']);
  });

  test('price range and price sorting use the cheapest variant', async () => {
    const { shop, category } = await approvedShop();
    await createListedProduct(shop, category, { name: { en: 'Cheap' }, variants: [{ sku: 'A', price: 50000, stock: 1 }] });
    await createListedProduct(shop, category, {
      name: { en: 'Mid' },
      variants: [
        { sku: 'B1', price: 300000, stock: 1 },
        { sku: 'B2', price: 150000, stock: 1 },
      ],
    });
    await createListedProduct(shop, category, { name: { en: 'Dear' }, variants: [{ sku: 'C', price: 900000, stock: 1 }] });

    expect(await listedNames('?minPrice=100000&maxPrice=500000')).toEqual(['Mid']);

    const sorted = await request(app).get('/api/catalog/products?sort=price_asc');
    expect(sorted.body.products.map((p) => p.name.en)).toEqual(['Cheap', 'Mid', 'Dear']);
    expect(sorted.body.products[1].minPrice).toBe(150000);
  });

  test('search works on Sinhala and Tamil names', async () => {
    const { shop, category } = await approvedShop();
    await createListedProduct(shop, category, { name: { en: 'Tea', si: 'තේ කොළ', ta: 'தேயிலை' } });
    await createListedProduct(shop, category, { name: { en: 'Coffee' } });

    expect(await listedNames(`?search=${encodeURIComponent('තේ')}`)).toEqual(['Tea']);
    expect(await listedNames(`?search=${encodeURIComponent('தேயி')}`)).toEqual(['Tea']);
  });

  test('regex characters in a search are treated as plain text', async () => {
    const response = await request(app).get(`/api/catalog/products?search=${encodeURIComponent('.*(a+)+$')}`);
    expect(response.status).toBe(200);
  });
});

describe('Cart', () => {
  test('a customer adds, changes and removes items; prices come from the product', async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category);
    const variantId = String(product.variants[0]._id);
    const { agent } = await createLoggedInUser(app, 'customer');

    const added = await agent.post('/api/cart/items').set(...CSRF).send({ productId: String(product._id), variantId, quantity: 2 });
    expect(added.status).toBe(200);
    expect(added.body.cart.subtotal).toBe(200000);
    expect(added.body.cart.shops[0].shopName).toBe(shop.name);

    const changed = await agent.patch(`/api/cart/items/${variantId}`).set(...CSRF).send({ quantity: 3 });
    expect(changed.body.cart.itemCount).toBe(3);

    const removed = await agent.delete(`/api/cart/items/${variantId}`).set(...CSRF);
    expect(removed.body.cart.itemCount).toBe(0);
  });

  test('cannot add more than is in stock, or a price of your own', async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category);
    const { agent } = await createLoggedInUser(app, 'customer');
    const item = { productId: String(product._id), variantId: String(product.variants[0]._id) };

    const tooMany = await agent.post('/api/cart/items').set(...CSRF).send({ ...item, quantity: 6 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.details).toEqual({ available: 5 });

    const withPrice = await agent.post('/api/cart/items').set(...CSRF).send({ ...item, quantity: 1, price: 1 });
    expect(withPrice.status).toBe(400);
  });

  test('unlisted products cannot be added', async () => {
    const { shop, category } = await approvedShop();
    const draft = await createListedProduct(shop, category, { status: 'draft' });
    const { agent } = await createLoggedInUser(app, 'customer');
    const response = await agent
      .post('/api/cart/items')
      .set(...CSRF)
      .send({ productId: String(draft._id), variantId: String(draft.variants[0]._id), quantity: 1 });
    expect(response.status).toBe(404);
  });

  test('items that became unavailable are flagged and left out of the total', async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category);
    const { agent } = await createLoggedInUser(app, 'customer');
    const variantId = String(product.variants[0]._id);
    await agent.post('/api/cart/items').set(...CSRF).send({ productId: String(product._id), variantId, quantity: 2 });

    product.isActive = false;
    await product.save();

    const cart = (await agent.get('/api/cart')).body.cart;
    expect(cart.subtotal).toBe(0);
    expect(cart.shops[0].items[0].problem).toBe('UNAVAILABLE');
  });

  test('a guest cart is previewed without login and merged at login, capped to stock', async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category);
    const guestItems = [{ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 4 }];

    const preview = await request(app).post('/api/catalog/cart-preview').set(...CSRF).send({ items: guestItems });
    expect(preview.body.cart.subtotal).toBe(400000);

    const { agent } = await createLoggedInUser(app, 'customer');
    await agent.post('/api/cart/merge').set(...CSRF).send({ items: guestItems });
    const merged = await agent.post('/api/cart/merge').set(...CSRF).send({ items: guestItems });
    // 4 + 4 = 8 wanted, but only 5 in stock.
    expect(merged.body.cart.itemCount).toBe(5);
  });

  test("each customer only sees their own cart", async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category);
    const alice = await createLoggedInUser(app, 'customer');
    const bob = await createLoggedInUser(app, 'customer');

    await alice.agent
      .post('/api/cart/items')
      .set(...CSRF)
      .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 1 });
    expect((await bob.agent.get('/api/cart')).body.cart.itemCount).toBe(0);
  });

  test('anonymous users get 401 on the cart', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });

  test.each(['seller', 'seller_cashier', 'rider', 'super_admin'])('%s has no cart or wishlist (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    expect((await agent.get('/api/cart')).status).toBe(403);
    expect((await agent.get('/api/wishlist')).status).toBe(403);
  });
});

describe('Wishlist', () => {
  test('a customer saves, lists and removes products', async () => {
    const { shop, category } = await approvedShop();
    const product = await createListedProduct(shop, category, { name: { en: 'Kettle' } });
    const { agent, user } = await createLoggedInUser(app, 'customer');

    expect((await agent.put(`/api/wishlist/${product._id}`).set(...CSRF)).status).toBe(204);
    expect((await agent.put(`/api/wishlist/${product._id}`).set(...CSRF)).status).toBe(204);
    expect((await User.findById(user._id)).wishlist).toHaveLength(1);

    const list = await agent.get('/api/wishlist');
    expect(list.body.products.map((p) => p.name.en)).toEqual(['Kettle']);

    await agent.delete(`/api/wishlist/${product._id}`).set(...CSRF);
    expect((await agent.get('/api/wishlist')).body.products).toEqual([]);
  });

  test('unlisted products cannot be saved', async () => {
    const { shop, category } = await approvedShop();
    const draft = await createListedProduct(shop, category, { status: 'draft' });
    const { agent } = await createLoggedInUser(app, 'customer');
    expect((await agent.put(`/api/wishlist/${draft._id}`).set(...CSRF)).status).toBe(404);
  });
});
