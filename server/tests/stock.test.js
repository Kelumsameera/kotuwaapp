const createApp = require('../src/app');
const Product = require('../src/models/Product');
const StockMovement = require('../src/models/StockMovement');
const stockService = require('../src/services/stockService');
const { runInTransaction } = require('../src/utils/transaction');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF } = require('./helpers/auth');
const { createSellerWithShop, createCategory, productBody } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// Creates a seller, a product with stock 10 and 5, and returns everything needed.
async function setup() {
  const seller = await createSellerWithShop(app);
  const category = await createCategory();
  const response = await seller.agent.post('/api/seller/products').set(...CSRF).send(productBody(category._id, seller.shop._id));
  const product = response.body.product;
  return { seller, product, variantId: product.variants[0].id };
}

// Reads the current stock of a variant from the database.
async function currentStock(productId, variantId) {
  const product = await Product.findById(productId);
  return product.variants.id(variantId).stock;
}

describe('Manual stock adjustment', () => {
  test('adds and removes stock and records each change', async () => {
    const { seller, product, variantId } = await setup();
    const url = `/api/seller/products/${product.id}/variants/${variantId}/stock`;

    const added = await seller.agent.post(url).set(...CSRF).send({ change: 5, note: 'New delivery' });
    expect(added.body.stock).toBe(15);

    const removed = await seller.agent.post(url).set(...CSRF).send({ change: -12, note: 'Damaged' });
    expect(removed.body).toEqual({ stock: 3, isLow: true });

    const history = await seller.agent.get(`/api/seller/products/${product.id}/stock-history`);
    const changes = history.body.movements.filter((m) => m.variantId === variantId).map((m) => m.change);
    expect(changes).toEqual([-12, 5, 10]);
  });

  test('stock can never go below zero', async () => {
    const { seller, product, variantId } = await setup();
    const response = await seller.agent
      .post(`/api/seller/products/${product.id}/variants/${variantId}/stock`)
      .set(...CSRF)
      .send({ change: -11 });
    expect(response.status).toBe(409);
    expect(await currentStock(product.id, variantId)).toBe(10);
  });
});

describe('Shared stock for online orders and POS (stockService)', () => {
  test('20 buyers racing for 10 items: exactly 10 succeed and stock ends at 0', async () => {
    const { product, variantId } = await setup();

    // Each attempt is its own transaction, like 20 checkouts / POS bills at the same moment.
    const attempts = Array.from({ length: 20 }, (unused, index) =>
      runInTransaction((session) =>
        stockService.takeStock([{ productId: product.id, variantId, quantity: 1 }], {
          session,
          reason: index % 2 === 0 ? 'online_order' : 'pos_sale',
        })
      )
    );
    const results = await Promise.allSettled(attempts);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(await currentStock(product.id, variantId)).toBe(0);
    expect(await StockMovement.countDocuments({ variantId, reason: { $in: ['online_order', 'pos_sale'] } })).toBe(10);
  });

  test('if one item in an order is short, nothing is taken (rollback)', async () => {
    const { product } = await setup();
    const [red, blue] = product.variants;

    await expect(
      runInTransaction((session) =>
        stockService.takeStock(
          [
            { productId: product.id, variantId: red.id, quantity: 2 },
            { productId: product.id, variantId: blue.id, quantity: 99 },
          ],
          { session, reason: 'online_order' }
        )
      )
    ).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });

    expect(await currentStock(product.id, red.id)).toBe(10);
    expect(await currentStock(product.id, blue.id)).toBe(5);
  });

  test('returnStock puts stock back', async () => {
    const { product, variantId } = await setup();
    await runInTransaction((session) =>
      stockService.returnStock([{ productId: product.id, variantId, quantity: 3 }], { session, reason: 'order_cancelled' })
    );
    expect(await currentStock(product.id, variantId)).toBe(13);
  });

  test('a seller edit saved while stock was sold does not bring the sold stock back', async () => {
    const { seller, product, variantId } = await setup();

    // Someone buys 4 while the seller has the edit form open.
    await runInTransaction((session) =>
      stockService.takeStock([{ productId: product.id, variantId, quantity: 4 }], { session, reason: 'pos_sale' })
    );

    const variants = product.variants.map((v) => ({ _id: v.id, sku: v.sku, price: v.price + 100, stock: v.stock }));
    await seller.agent.patch(`/api/seller/products/${product.id}`).set(...CSRF).send({ variants });

    expect(await currentStock(product.id, variantId)).toBe(6);
  });
});
