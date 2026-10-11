const createApp = require('../src/app');
const imageStorage = require('../src/services/imageStorage');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createLoggedInUser } = require('./helpers/auth');
const { createSellerWithShop } = require('./helpers/catalog');

const app = createApp();

// The smallest valid PNG header, padded: enough for the magic-byte check.
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

beforeAll(startTestDatabase);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearTestDatabase();
});
afterAll(stopTestDatabase);

// Sends one file to the upload route.
function upload(agent, buffer, filename, contentType) {
  return agent.post('/api/seller/uploads/images').set(...CSRF).attach('image', buffer, { filename, contentType });
}

describe('Image uploads', () => {
  test('a real PNG is uploaded into the shop folder', async () => {
    const { agent, shop } = await createSellerWithShop(app);
    const spy = jest
      .spyOn(imageStorage, 'uploadShopImage')
      .mockResolvedValue({ url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/x.png', publicId: 'x' });

    const response = await upload(agent, PNG_BYTES, 'photo.png', 'image/png');
    expect(response.status).toBe(201);
    expect(String(spy.mock.calls[0][0])).toBe(String(shop._id));
  });

  test('a text file pretending to be a PNG is refused', async () => {
    const { agent } = await createSellerWithShop(app);
    const response = await upload(agent, Buffer.from('<script>alert(1)</script>'.padEnd(64)), 'evil.png', 'image/png');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UPLOAD_NOT_IMAGE');
  });

  test('other file types are refused', async () => {
    const { agent } = await createSellerWithShop(app);
    const response = await upload(agent, Buffer.from('%PDF-1.4'.padEnd(64)), 'doc.pdf', 'application/pdf');
    expect(response.status).toBe(400);
  });

  test('files over 2 MB are refused', async () => {
    const { agent } = await createSellerWithShop(app);
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);
    const response = await upload(agent, big, 'big.png', 'image/png');
    expect(response.status).toBe(413);
  });

  test('without Cloudinary keys the API says uploads are not set up (503)', async () => {
    const { agent } = await createSellerWithShop(app);
    const response = await upload(agent, PNG_BYTES, 'photo.png', 'image/png');
    expect(response.status).toBe(503);
  });

  test('a suspended shop cannot upload', async () => {
    const { agent } = await createSellerWithShop(app, 'suspended');
    const response = await upload(agent, PNG_BYTES, 'photo.png', 'image/png');
    expect(response.status).toBe(403);
  });

  test.each(['customer', 'rider', 'seller_cashier', 'super_admin'])('%s cannot upload (403)', async (role) => {
    const { agent } = await createLoggedInUser(app, role);
    const response = await upload(agent, PNG_BYTES, 'photo.png', 'image/png');
    expect(response.status).toBe(403);
  });
});
