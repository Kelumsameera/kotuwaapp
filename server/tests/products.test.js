const createApp = require('../src/app');
const Product = require('../src/models/Product');
const AuditLog = require('../src/models/AuditLog');
const StockMovement = require('../src/models/StockMovement');
const imageStorage = require('../src/services/imageStorage');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { createSellerWithShop, createCategory, productBody, shopImage } = require('./helpers/catalog');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// Creates a product through the API and returns the response body's product.
async function createProduct(seller, category, overrides) {
  const response = await seller.agent
    .post('/api/seller/products')
    .set(...CSRF)
    .send(productBody(category._id, seller.shop._id, overrides));
  if (response.status !== 201) throw new Error(JSON.stringify(response.body));
  return response.body.product;
}

describe('Creating products', () => {
  test('creates a draft with variants, initial stock history and cost price for the owner', async () => {
    const seller = await createSellerWithShop(app);
    const category = await createCategory();

    const product = await createProduct(seller, category);
    expect(product.status).toBe('draft');
    expect(product.variants).toHaveLength(2);
    expect(product.variants[0].costPrice).toBe(300000);
    expect(product.name.si).toBe('අත්යන්ත්‍ර සාරිය');

    const movements = await StockMovement.find({ product: product.id, reason: 'initial' });
    expect(movements.map((m) => m.change).sort()).toEqual([10, 5]);
  });

  test('a pending (not yet approved) shop can prepare drafts but cannot submit them', async () => {
    const seller = await createSellerWithShop(app, 'pending');
    const category = await createCategory();
    const product = await createProduct(seller, category);

    const submit = await seller.agent.post(`/api/seller/products/${product.id}/submit`).set(...CSRF);
    expect(submit.status).toBe(403);
    expect(submit.body.error.code).toBe('SHOP_NOT_APPROVED');
  });

  test('a suspended shop cannot add products', async () => {
    const seller = await createSellerWithShop(app, 'suspended');
    const category = await createCategory();
    const response = await seller.agent.post('/api/seller/products').set(...CSRF).send(productBody(category._id, seller.shop._id));
    expect(response.status).toBe(403);
  });

  test('refuses prices that are not whole cents, inactive categories, and duplicate SKUs', async () => {
    const seller = await createSellerWithShop(app);
    const category = await createCategory();
    const hidden = await createCategory({ isActive: false });

    const decimalPrice = productBody(category._id, seller.shop._id);
    decimalPrice.variants[0].price = 4500.5;
    expect((await seller.agent.post('/api/seller/products').set(...CSRF).send(decimalPrice)).status).toBe(400);

    const inactive = productBody(hidden._id, seller.shop._id);
    expect((await seller.agent.post('/api/seller/products').set(...CSRF).send(inactive)).status).toBe(400);

    const dupInside = productBody(category._id, seller.shop._id);
    dupInside.variants[1].sku = 'SAREE-RED';
    expect((await seller.agent.post('/api/seller/products').set(...CSRF).send(dupInside)).status).toBe(409);

    await createProduct(seller, category);
    const dupOther = await seller.agent.post('/api/seller/products').set(...CSRF).send(productBody(category._id, seller.shop._id));
    expect(dupOther.status).toBe(409);
    expect(dupOther.body.error.code).toBe('SKU_TAKEN');
  });

  test('the same SKU is fine in two different shops', async () => {
    const category = await createCategory();
    await createProduct(await createSellerWithShop(app), category);
    await expect(createProduct(await createSellerWithShop(app), category)).resolves.toBeDefined();
  });

  test("cannot use another shop's images", async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);
    const category = await createCategory();

    const body = productBody(category._id, sellerA.shop._id, { images: [shopImage(sellerB.shop._id)] });
    const response = await sellerA.agent.post('/api/seller/products').set(...CSRF).send(body);
    expect(response.status).toBe(400);
  });
});

describe('Ownership: sellers only touch their own products', () => {
  test("seller B gets 404 for every action on seller A's product", async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);
    const category = await createCategory();
    const product = await createProduct(sellerA, category);
    const variantId = product.variants[0].id;

    const calls = [
      sellerB.agent.get(`/api/seller/products/${product.id}`),
      sellerB.agent.patch(`/api/seller/products/${product.id}`).set(...CSRF).send({ weightGrams: 1 }),
      sellerB.agent.post(`/api/seller/products/${product.id}/submit`).set(...CSRF),
      sellerB.agent.patch(`/api/seller/products/${product.id}/visibility`).set(...CSRF).send({ isActive: false }),
      sellerB.agent.post(`/api/seller/products/${product.id}/variants/${variantId}/stock`).set(...CSRF).send({ change: -10 }),
      sellerB.agent.get(`/api/seller/products/${product.id}/stock-history`),
      sellerB.agent.delete(`/api/seller/products/${product.id}`).set(...CSRF),
    ];
    const statuses = (await Promise.all(calls)).map((response) => response.status);
    expect(statuses).toEqual([404, 404, 404, 404, 404, 404, 404]);

    const unchanged = await Product.findById(product.id);
    expect(unchanged.archivedAt).toBeNull();
    expect(unchanged.variants[0].stock).toBe(10);
  });

  test("seller B's product list never contains seller A's products", async () => {
    const sellerA = await createSellerWithShop(app);
    const sellerB = await createSellerWithShop(app);
    await createProduct(sellerA, await createCategory());

    const list = await sellerB.agent.get('/api/seller/products');
    expect(list.body.total).toBe(0);
  });

  test.each(['customer', 'rider', 'super_admin'])('%s cannot use seller product routes (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    expect((await agent.get('/api/seller/products')).status).toBe(403);
  });

  test('a cashier cannot manage products or see cost prices (403)', async () => {
    const seller = await createSellerWithShop(app);
    const { agent } = await createLoggedInUser(app, 'seller_cashier', { shop: seller.shop._id });
    const category = await createCategory();

    expect((await agent.get('/api/seller/products')).status).toBe(403);
    const create = await agent.post('/api/seller/products').set(...CSRF).send(productBody(category._id, seller.shop._id));
    expect(create.status).toBe(403);
  });
});

describe('Review flow and edits', () => {
  test('submit → admin approves → editing the name sends it back to review, price edit does not', async () => {
    const seller = await createSellerWithShop(app);
    const { agent: admin } = await createLoggedInUser(app, 'super_admin');
    const product = await createProduct(seller, await createCategory());

    expect((await seller.agent.post(`/api/seller/products/${product.id}/submit`).set(...CSRF)).body.product.status).toBe('pending');
    const approved = await admin.patch(`/api/admin/products/${product.id}/review`).set(...CSRF).send({ decision: 'approve' });
    expect(approved.body.product.status).toBe('approved');

    // Price change: stays approved, and is written to the audit log.
    const variants = product.variants.map((v) => ({ _id: v.id, sku: v.sku, options: v.options, price: v.price + 10000 }));
    const priceEdit = await seller.agent.patch(`/api/seller/products/${product.id}`).set(...CSRF).send({ variants });
    expect(priceEdit.body.product.status).toBe('approved');
    const log = await AuditLog.findOne({ action: 'product.price_change', targetId: product.id });
    expect(log.before[0]).toEqual({ sku: 'SAREE-RED', price: 450000 });
    expect(log.after[0]).toEqual({ sku: 'SAREE-RED', price: 460000 });

    // Name change: back to pending.
    const nameEdit = await seller.agent.patch(`/api/seller/products/${product.id}`).set(...CSRF).send({ name: { en: 'New name' } });
    expect(nameEdit.body.product.status).toBe('pending');
  });

  test('editing never overwrites stock: the stock field of existing variants is ignored', async () => {
    const seller = await createSellerWithShop(app);
    const product = await createProduct(seller, await createCategory());

    const variants = product.variants.map((v) => ({ _id: v.id, sku: v.sku, price: v.price, stock: 9999 }));
    const response = await seller.agent.patch(`/api/seller/products/${product.id}`).set(...CSRF).send({ variants });
    expect(response.body.product.variants.map((v) => v.stock)).toEqual([10, 5]);
  });

  test("a variant id from another product is refused", async () => {
    const seller = await createSellerWithShop(app);
    const category = await createCategory();
    const first = await createProduct(seller, category);
    const second = await createProduct(seller, category, {
      variants: [{ sku: 'OTHER-1', price: 1000, stock: 1 }],
    });

    const response = await seller.agent
      .patch(`/api/seller/products/${first.id}`)
      .set(...CSRF)
      .send({ variants: [{ _id: second.variants[0].id, sku: 'X-1', price: 1 }] });
    expect(response.status).toBe(400);
  });

  test('rejecting needs a reason, and only admins can review', async () => {
    const seller = await createSellerWithShop(app);
    const { agent: admin } = await createLoggedInUser(app, 'super_admin');
    const product = await createProduct(seller, await createCategory());
    await seller.agent.post(`/api/seller/products/${product.id}/submit`).set(...CSRF);

    expect((await admin.patch(`/api/admin/products/${product.id}/review`).set(...CSRF).send({ decision: 'reject' })).status).toBe(400);
    expect(
      (await seller.agent.patch(`/api/admin/products/${product.id}/review`).set(...CSRF).send({ decision: 'approve' })).status
    ).toBe(403);

    const rejected = await admin
      .patch(`/api/admin/products/${product.id}/review`)
      .set(...CSRF)
      .send({ decision: 'reject', reason: 'Blurry photos' });
    expect(rejected.body.product.status).toBe('rejected');
    expect(rejected.body.product.statusReason).toBe('Blurry photos');
  });

  test('a photo removed from one product is not deleted while another product still uses it', async () => {
    const seller = await createSellerWithShop(app);
    const category = await createCategory();
    const sharedPhoto = shopImage(seller.shop._id, 'shared');
    const first = await createProduct(seller, category, { images: [sharedPhoto] });
    const second = await createProduct(seller, category, { images: [sharedPhoto], variants: [{ sku: 'OTHER-1', price: 100 }] });

    const deleteSpy = jest.spyOn(imageStorage, 'deleteImage').mockResolvedValue();
    await seller.agent.patch(`/api/seller/products/${first.id}`).set(...CSRF).send({ images: [] });
    expect(deleteSpy).not.toHaveBeenCalled();

    // Once the last product stops using it, the photo is deleted.
    await seller.agent.patch(`/api/seller/products/${second.id}`).set(...CSRF).send({ images: [] });
    expect(deleteSpy).toHaveBeenCalledWith(sharedPhoto.publicId);
    deleteSpy.mockRestore();
  });

  test('deleting archives the product and hides it from the list', async () => {
    const seller = await createSellerWithShop(app);
    const product = await createProduct(seller, await createCategory());

    expect((await seller.agent.delete(`/api/seller/products/${product.id}`).set(...CSRF)).status).toBe(204);
    expect((await seller.agent.get('/api/seller/products')).body.total).toBe(0);
    expect(await Product.exists({ _id: product.id })).not.toBeNull();
  });
});
