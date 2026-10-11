const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, TEST_PASSWORD, createUser, createLoggedInUser } = require('./helpers/auth');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('CSRF protection', () => {
  test('refuses data-changing requests without the custom header', async () => {
    const user = await createUser('customer');
    const response = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_CHECK_FAILED');
  });

  test('refuses requests from another website origin', async () => {
    const user = await createUser('customer');
    const response = await request(app)
      .post('/api/auth/login')
      .set(...CSRF)
      .set('Origin', 'https://evil.example')
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(response.status).toBe(403);
  });
});

describe('Injection and XSS', () => {
  test('NoSQL operators in login are removed, not executed', async () => {
    await createUser('customer');
    const response = await request(app)
      .post('/api/auth/login')
      .set(...CSRF)
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(response.status).toBe(400);
  });

  test('HTML is stripped from text fields', async () => {
    const { agent, user } = await createLoggedInUser(app, 'customer');
    await agent.patch('/api/users/me').set(...CSRF).send({ name: 'Saman<script>alert(1)</script><b>x</b>' });
    const saved = await User.findById(user._id);
    expect(saved.name).toBe('Samanx');
  });
});

describe('Safe responses', () => {
  test('/me never includes secrets', async () => {
    const { agent } = await createLoggedInUser(app, 'customer');
    const response = await agent.get('/api/users/me');
    const body = JSON.stringify(response.body);
    expect(body).not.toMatch(/passwordHash|TokenHash|failedLoginCount|lockUntil/);
  });

  test('unknown routes return a JSON 404', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('a bad id in the URL is a validation error, not a crash', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const response = await agent.patch('/api/admin/users/not-an-id/role').set(...CSRF).send({ role: 'seller' });
    expect(response.status).toBe(400);
  });

  test('sets security headers (helmet)', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
