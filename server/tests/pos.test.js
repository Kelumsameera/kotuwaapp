const request = require('supertest');
const createApp = require('../src/app');
const Product = require('../src/models/Product');
const PosSale = require('../src/models/PosSale');
const StockMovement = require('../src/models/StockMovement');
const Earning = require('../src/models/Earning');
const AuditLog = require('../src/models/AuditLog');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { createSellerWithShop, createCategory, createListedProduct } = require('./helpers/catalog');
const { todayInColombo } = require('../src/utils/colomboTime');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// A shop with one product: Rs 1,000 (100000 cents), stock 5, barcode 4791234567890, cost Rs 600.
async function posShop(status = 'approved') {
  const seller = await createSellerWithShop(app, status);
  const product = await createListedProduct(seller.shop, await createCategory(), {
    name: { en: 'Coconut Oil 1L', si: 'පොල් තෙල් 1L' },
    status: 'draft', // drafts are still sold at the counter
    variants: [{ sku: 'OIL-1L', barcode: '4791234567890', price: 100000, costPrice: 60000, stock: 5 }],
  });
  const cashier = await createLoggedInUser(app, 'seller_cashier', { shop: seller.shop._id });
  return { seller, cashier, product, line: { productId: String(product._id), variantId: String(product.variants[0]._id) } };
}

// Sells through the API.
function sell(agent, body) {
  return agent.post('/api/pos/sales').set(...CSRF).send(body);
}

const stockOf = async (product) => (await Product.findById(product._id)).variants[0].stock;

describe('Finding products', () => {
  test('barcode or SKU finds the exact variant; cashiers never see the cost price', async () => {
    const { cashier } = await posShop();

    const byBarcode = await cashier.agent.get('/api/pos/lookup?code=4791234567890');
    expect(byBarcode.body.item).toMatchObject({ sku: 'OIL-1L', price: 100000, stock: 5 });
    expect((await cashier.agent.get('/api/pos/lookup?code=OIL-1L')).status).toBe(200);
    expect(JSON.stringify(byBarcode.body)).not.toContain('costPrice');

    const byName = await cashier.agent.get(`/api/pos/search?q=${encodeURIComponent('පොල්')}`);
    expect(byName.body.items).toHaveLength(1);
    expect(JSON.stringify(byName.body)).not.toContain('60000');
  });

  test("another shop's barcode is not found", async () => {
    const a = await posShop();
    const b = await posShop();
    await Product.updateOne({ _id: b.product._id }, { 'variants.0.barcode': '9999999999999', 'variants.0.sku': 'OTHER' });
    expect((await a.cashier.agent.get('/api/pos/lookup?code=9999999999999')).status).toBe(404);
  });
});

describe('Completing a sale', () => {
  test('cash sale: server prices, change, shared stock, history, no commission', async () => {
    const { cashier, product, line, seller } = await posShop();

    const response = await sell(cashier.agent, {
      items: [{ ...line, quantity: 2 }],
      billDiscount: 0,
      expectedTotal: 200000,
      payment: { method: 'cash', cashReceived: 500000 },
    });
    expect(response.status).toBe(201);
    expect(response.body.sale).toMatchObject({ status: 'completed', total: 200000, payment: { method: 'cash', change: 300000 } });
    expect(response.body.sale.billNumber).toMatch(/^\d{6}-0001$/);
    expect(response.body.shop.name).toBe(seller.shop.name);

    expect(await stockOf(product)).toBe(3);
    expect(await StockMovement.countDocuments({ reason: 'pos_sale', change: -2 })).toBe(1);
    expect(await Earning.countDocuments()).toBe(0);
  });

  test('the screen cannot send its own price', async () => {
    const { cashier, line } = await posShop();
    const response = await sell(cashier.agent, {
      items: [{ ...line, quantity: 1, price: 1 }],
      expectedTotal: 1,
      payment: { method: 'card' },
    });
    expect(response.status).toBe(400);
  });

  test('if a price changed since the screen loaded it, the sale is refused', async () => {
    const { cashier, line, product } = await posShop();
    await Product.updateOne({ _id: product._id }, { 'variants.0.price': 120000 });
    const response = await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' } });
    expect(response.status).toBe(409);
    expect(response.body.error.details).toEqual({ total: 120000 });
  });

  test('not enough cash, or more than is in stock, is refused and nothing is taken', async () => {
    const { cashier, line, product } = await posShop();
    const lowCash = await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'cash', cashReceived: 50000 } });
    expect(lowCash.body.error.code).toBe('NOT_ENOUGH_CASH');

    const tooMany = await sell(cashier.agent, { items: [{ ...line, quantity: 6 }], expectedTotal: 600000, payment: { method: 'card' } });
    expect(tooMany.body.error.code).toBe('OUT_OF_STOCK');
    expect(await stockOf(product)).toBe(5);
    expect(await PosSale.countDocuments()).toBe(0);
  });

  test('two counters selling the last unit at the same moment: only one sale goes through', async () => {
    const { cashier, seller, line, product } = await posShop();
    await Product.updateOne({ _id: product._id }, { 'variants.0.stock': 1 });
    const body = { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' } };

    const results = await Promise.all([sell(cashier.agent, body), sell(seller.agent, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(product)).toBe(0);
  });
});

describe('Discounts', () => {
  test('item and bill discounts are applied; a discount bigger than the line is refused', async () => {
    const { seller, line } = await posShop();
    const ok = await sell(seller.agent, {
      items: [{ ...line, quantity: 2, itemDiscount: 20000 }],
      billDiscount: 30000,
      expectedTotal: 150000,
      payment: { method: 'card', cardReference: 'AUTH-1234' },
    });
    expect(ok.body.sale).toMatchObject({ subtotal: 200000, itemDiscountTotal: 20000, billDiscount: 30000, total: 150000 });

    const tooBig = await sell(seller.agent, { items: [{ ...line, quantity: 1, itemDiscount: 200000 }], expectedTotal: 0, payment: { method: 'card' } });
    expect(tooBig.body.error.code).toBe('DISCOUNT_TOO_BIG');
  });

  test("cashiers are limited to the shop's discount % (10 % by default); the owner is not", async () => {
    const { cashier, seller, line } = await posShop();
    const body = { items: [{ ...line, quantity: 1 }], billDiscount: 20000, expectedTotal: 80000, payment: { method: 'card' } };

    const cashierTry = await sell(cashier.agent, body);
    expect(cashierTry.status).toBe(403);
    expect(cashierTry.body.error.code).toBe('DISCOUNT_LIMIT');
    expect((await sell(cashier.agent, { ...body, billDiscount: 10000, expectedTotal: 90000 })).status).toBe(201);
    expect((await sell(seller.agent, body)).status).toBe(201);
  });
});

describe('Held bills', () => {
  test('hold → resume on another counter → complete; holding takes no stock', async () => {
    const { cashier, seller, line, product } = await posShop();
    const held = await cashier.agent.post('/api/pos/held').set(...CSRF).send({ items: [{ ...line, quantity: 3 }], label: 'Lady in red' });
    expect(held.status).toBe(201);
    expect(await stockOf(product)).toBe(5);

    const list = await seller.agent.get('/api/pos/held');
    expect(list.body.held.map((bill) => bill.heldLabel)).toEqual(['Lady in red']);

    const completed = await sell(seller.agent, {
      items: [{ ...line, quantity: 3 }],
      expectedTotal: 300000,
      payment: { method: 'card' },
      heldSaleId: held.body.held.id,
    });
    expect(completed.body.sale.id).toBe(held.body.held.id);
    expect((await seller.agent.get('/api/pos/held')).body.held).toHaveLength(0);
    expect(await stockOf(product)).toBe(2);

    // The same held bill can't be completed twice.
    const again = await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' }, heldSaleId: held.body.held.id });
    expect(again.status).toBe(404);
  });

  test("a shop can't see or use another shop's held bills", async () => {
    const a = await posShop();
    const b = await posShop();
    const held = await a.cashier.agent.post('/api/pos/held').set(...CSRF).send({ items: [{ ...a.line, quantity: 1 }] });

    expect((await b.seller.agent.get('/api/pos/held')).body.held).toHaveLength(0);
    expect((await b.seller.agent.delete(`/api/pos/held/${held.body.held.id}`).set(...CSRF)).status).toBe(404);
  });
});

describe('Voiding and receipts', () => {
  test('the owner voids a sale (stock back, audited); cashiers cannot void', async () => {
    const { cashier, seller, line, product } = await posShop();
    const sale = await sell(cashier.agent, { items: [{ ...line, quantity: 2 }], expectedTotal: 200000, payment: { method: 'card' } });
    const url = `/api/pos/sales/${sale.body.sale.id}/void`;

    expect((await cashier.agent.post(url).set(...CSRF).send({ reason: 'Customer changed mind' })).status).toBe(403);

    const voided = await seller.agent.post(url).set(...CSRF).send({ reason: 'Customer changed mind' });
    expect(voided.body.sale.status).toBe('voided');
    expect(await stockOf(product)).toBe(5);
    expect(await StockMovement.countDocuments({ reason: 'pos_void' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'pos.void' })).toBe(1);

    expect((await seller.agent.post(url).set(...CSRF).send({ reason: 'Again' })).status).toBe(409);
  });

  test('cashiers can reprint only their own receipts; other shops get 404', async () => {
    const { cashier, seller, line } = await posShop();
    const ownerSale = await sell(seller.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' } });
    const cashierSale = await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' } });

    expect((await cashier.agent.get(`/api/pos/sales/${cashierSale.body.sale.id}`)).status).toBe(200);
    expect((await cashier.agent.get(`/api/pos/sales/${ownerSale.body.sale.id}`)).status).toBe(404);
    expect((await seller.agent.get(`/api/pos/sales/${cashierSale.body.sale.id}`)).status).toBe(200);

    const other = await posShop();
    expect((await other.seller.agent.get(`/api/pos/sales/${ownerSale.body.sale.id}`)).status).toBe(404);
  });
});

describe('Reports', () => {
  test('daily report: totals, cash vs card, voids, best sellers and per-cashier figures', async () => {
    const { cashier, seller, line } = await posShop();
    await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'cash', cashReceived: 100000 } });
    await sell(cashier.agent, { items: [{ ...line, quantity: 1 }], billDiscount: 10000, expectedTotal: 90000, payment: { method: 'card' } });
    const toVoid = await sell(seller.agent, { items: [{ ...line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'cash' } });
    await seller.agent.post(`/api/pos/sales/${toVoid.body.sale.id}/void`).set(...CSRF).send({ reason: 'Mistake' });

    const daily = (await seller.agent.get(`/api/pos/reports/daily?date=${todayInColombo()}`)).body.report;
    expect(daily.totals).toMatchObject({ completedCount: 2, total: 190000, cash: 100000, card: 90000, discounts: 10000, voidedCount: 1, voidedTotal: 100000 });
    expect(daily.topItems[0]).toMatchObject({ sku: 'OIL-1L', quantity: 2 });
    const cashierRow = daily.cashiers.find((row) => row.role === 'seller_cashier');
    expect(cashierRow).toMatchObject({ completedCount: 2, total: 190000 });

    const range = (await seller.agent.get(`/api/pos/reports/cashiers?from=${todayInColombo()}&to=${todayInColombo()}`)).body.report;
    expect(range.cashiers).toHaveLength(2);

    // A cashier sees only their own day, never the shop reports.
    const myDay = (await cashier.agent.get('/api/pos/reports/my-day')).body.report;
    expect(myDay.totals).toMatchObject({ completedCount: 2, total: 190000, cash: 100000 });
    expect((await cashier.agent.get('/api/pos/reports/daily')).status).toBe(403);
    expect((await cashier.agent.get('/api/pos/sales')).status).toBe(403);
  });

  test("seller B's reports never include seller A's sales", async () => {
    const a = await posShop();
    const b = await posShop();
    await sell(a.cashier.agent, { items: [{ ...a.line, quantity: 1 }], expectedTotal: 100000, payment: { method: 'card' } });
    const report = (await b.seller.agent.get('/api/pos/reports/daily')).body.report;
    expect(report.totals.completedCount).toBe(0);
  });
});

describe('Who can use the POS', () => {
  test.each(['customer', 'rider', 'super_admin'])('%s is refused (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    expect((await agent.get('/api/pos/session')).status).toBe(403);
  });

  test('anonymous visitors get 401', async () => {
    expect((await request(app).get('/api/pos/session')).status).toBe(401);
  });

  test("a suspended shop can't use the POS", async () => {
    const { cashier } = await posShop('suspended');
    expect((await cashier.agent.get('/api/pos/session')).status).toBe(403);
  });

  test('a cashier with no shop gets 404', async () => {
    const { agent } = await createLoggedInUser(app, 'seller_cashier');
    expect((await agent.get('/api/pos/session')).status).toBe(404);
  });
});
