const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, TEST_PASSWORD, createUser, loginAs, lastEmailToken, cookieFromResponse } = require('./helpers/auth');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// Registers a user through the API and returns the response.
function register(body) {
  return request(app).post('/api/auth/register').set(...CSRF).send(body);
}

describe('Register', () => {
  test('creates a customer, sends a verification email, and never returns the password hash', async () => {
    const response = await register({ name: 'Nimal', email: 'nimal@test.lk', password: 'Password123!' });

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    const user = await User.findOne({ email: 'nimal@test.lk' });
    expect(user.role).toBe('customer');
    expect(user.isEmailVerified).toBe(false);
    expect(lastEmailToken('nimal@test.lk')).toHaveLength(64);
  });

  test('can register as a seller', async () => {
    const response = await register({ name: 'Shop Owner', email: 'seller@test.lk', password: 'Password123!', role: 'seller' });
    expect(response.status).toBe(201);
    expect((await User.findOne({ email: 'seller@test.lk' })).role).toBe('seller');
  });

  test.each(['super_admin', 'rider', 'seller_cashier'])('refuses role=%s', async (role) => {
    const response = await register({ name: 'Hacker', email: `h-${role}@test.lk`, password: 'Password123!', role });
    expect(response.status).toBe(400);
    expect(await User.exists({ email: `h-${role}@test.lk` })).toBeNull();
  });

  test('refuses extra fields such as isEmailVerified', async () => {
    const response = await register({ name: 'Hacker', email: 'x@test.lk', password: 'Password123!', isEmailVerified: true });
    expect(response.status).toBe(400);
  });

  test('refuses passwords shorter than 8 characters', async () => {
    const response = await register({ name: 'Short', email: 'short@test.lk', password: 'abc123' });
    expect(response.status).toBe(400);
  });

  test('refuses a duplicate email', async () => {
    await register({ name: 'One', email: 'dup@test.lk', password: 'Password123!' });
    const response = await register({ name: 'Two', email: 'DUP@test.lk', password: 'Password123!' });
    expect(response.status).toBe(409);
  });
});

describe('Email verification and login', () => {
  test('blocks login until the email is verified, then allows it', async () => {
    await register({ name: 'Kamal', email: 'kamal@test.lk', password: 'Password123!' });

    const blocked = await request(app).post('/api/auth/login').set(...CSRF).send({ email: 'kamal@test.lk', password: 'Password123!' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const token = lastEmailToken('kamal@test.lk');
    const verified = await request(app).post('/api/auth/verify-email').set(...CSRF).send({ token });
    expect(verified.status).toBe(200);

    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: 'kamal@test.lk', password: 'Password123!' });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('kamal@test.lk');
    expect(login.body.user.passwordHash).toBeUndefined();
  });

  test('sets httpOnly sameSite=strict cookies and puts no tokens in the JSON body', async () => {
    const user = await createUser('customer');
    const response = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });

    const cookies = response.headers['set-cookie'].join('\n');
    expect(cookies).toMatch(/access_token=.*HttpOnly/);
    expect(cookies).toMatch(/access_token=.*SameSite=Strict/);
    expect(cookies).toMatch(/refresh_token=.*Path=\/api\/auth.*HttpOnly/);
    expect(JSON.stringify(response.body)).not.toMatch(/token/i);
  });

  test('refresh tokens are stored hashed, never as plain text', async () => {
    const user = await createUser('customer');
    const response = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const refreshToken = cookieFromResponse(response, 'refresh_token');

    const stored = await RefreshToken.findOne({ user: user._id });
    expect(stored.tokenHash).not.toBe(refreshToken);
    expect(stored.tokenHash).toHaveLength(64);
  });

  test('locks the account for 15 minutes after 5 wrong passwords', async () => {
    const user = await createUser('customer');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: 'wrong-password' });
    }

    const response = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('ACCOUNT_LOCKED');

    const locked = await User.findById(user._id).select('+lockUntil');
    const minutesLocked = (locked.lockUntil - Date.now()) / 60000;
    expect(minutesLocked).toBeGreaterThan(14);
    expect(minutesLocked).toBeLessThanOrEqual(15);
  });

  test('gives the same error for an unknown email and a wrong password', async () => {
    const user = await createUser('customer');
    const unknown = await request(app).post('/api/auth/login').set(...CSRF).send({ email: 'nobody@test.lk', password: 'whatever1' });
    const wrong = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: 'whatever1' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.code).toBe(wrong.body.error.code);
  });

  test('disabled accounts cannot log in', async () => {
    const user = await createUser('customer', { isActive: false });
    const response = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    expect(response.status).toBe(403);
  });
});

describe('Refresh token rotation', () => {
  test('refresh gives new tokens and the old refresh token stops working', async () => {
    const user = await createUser('customer');
    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const firstRefresh = cookieFromResponse(login, 'refresh_token');

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set(...CSRF)
      .set('Cookie', `refresh_token=${firstRefresh}`);
    expect(refreshed.status).toBe(200);
    const secondRefresh = cookieFromResponse(refreshed, 'refresh_token');
    expect(secondRefresh).toBeDefined();
    expect(secondRefresh).not.toBe(firstRefresh);

    // Reusing the old token later is treated as theft: it fails AND the new token is revoked too.
    await RefreshToken.updateOne({ replacedByHash: { $exists: true } }, { revokedAt: new Date(Date.now() - 60 * 1000) });
    const reused = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${firstRefresh}`);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    const afterTheft = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${secondRefresh}`);
    expect(afterTheft.status).toBe(401);
  });

  test('two tabs refreshing at once do not log the user out', async () => {
    const user = await createUser('customer');
    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const sharedRefresh = cookieFromResponse(login, 'refresh_token');

    const firstTab = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${sharedRefresh}`);
    const secondTab = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${sharedRefresh}`);
    expect(firstTab.status).toBe(200);
    expect(secondTab.status).toBe(401);
    expect(secondTab.body.error.code).toBe('REFRESH_RACE');
    // The race response issues nothing new and leaves the browser's cookies alone.
    expect(secondTab.headers['set-cookie']).toBeUndefined();

    // The first tab's new token keeps working.
    const newRefresh = cookieFromResponse(firstTab, 'refresh_token');
    const next = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${newRefresh}`);
    expect(next.status).toBe(200);
  });

  test('a token revoked by logout is not given the tab-race grace period', async () => {
    const user = await createUser('customer');
    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const refreshToken = cookieFromResponse(login, 'refresh_token');

    await request(app).post('/api/auth/logout').set(...CSRF).set('Cookie', `refresh_token=${refreshToken}`);
    const response = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${refreshToken}`);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_REUSED');
  });

  test('logout revokes the refresh token', async () => {
    const user = await createUser('customer');
    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const refreshToken = cookieFromResponse(login, 'refresh_token');

    await request(app).post('/api/auth/logout').set(...CSRF).set('Cookie', `refresh_token=${refreshToken}`);

    const response = await request(app).post('/api/auth/refresh').set(...CSRF).set('Cookie', `refresh_token=${refreshToken}`);
    expect(response.status).toBe(401);
  });

  test('a refresh token cannot be used as an access token (different secrets)', async () => {
    const user = await createUser('customer');
    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: TEST_PASSWORD });
    const refreshToken = cookieFromResponse(login, 'refresh_token');

    const response = await request(app).get('/api/users/me').set('Cookie', `access_token=${refreshToken}`);
    expect(response.status).toBe(401);
  });
});

describe('Password reset and change', () => {
  test('reset link works once, logs out other sessions, and the new password works', async () => {
    const user = await createUser('customer');
    const agent = await loginAs(app, user);

    await request(app).post('/api/auth/forgot-password').set(...CSRF).send({ email: user.email });
    const token = lastEmailToken(user.email);

    const reset = await request(app).post('/api/auth/reset-password').set(...CSRF).send({ token, password: 'BrandNew123!' });
    expect(reset.status).toBe(200);

    const reuse = await request(app).post('/api/auth/reset-password').set(...CSRF).send({ token, password: 'Another123!' });
    expect(reuse.status).toBe(400);

    // The old session no longer works: neither its access token nor its refresh token.
    expect((await agent.get('/api/users/me')).status).toBe(401);
    const oldSession = await agent.post('/api/auth/refresh').set(...CSRF);
    expect(oldSession.status).toBe(401);

    const login = await request(app).post('/api/auth/login').set(...CSRF).send({ email: user.email, password: 'BrandNew123!' });
    expect(login.status).toBe(200);
  });

  test('reset link expires after 1 hour', async () => {
    const user = await createUser('customer');
    await request(app).post('/api/auth/forgot-password').set(...CSRF).send({ email: user.email });
    const token = lastEmailToken(user.email);

    await User.updateOne({ _id: user._id }, { passwordResetExpires: new Date(Date.now() - 1000) });

    const response = await request(app).post('/api/auth/reset-password').set(...CSRF).send({ token, password: 'BrandNew123!' });
    expect(response.status).toBe(400);
  });

  test('forgot-password answers the same for unknown emails', async () => {
    const response = await request(app).post('/api/auth/forgot-password').set(...CSRF).send({ email: 'ghost@test.lk' });
    expect(response.status).toBe(200);
  });

  test('change-password needs the current password', async () => {
    const user = await createUser('customer');
    const agent = await loginAs(app, user);

    const wrong = await agent.post('/api/auth/change-password').set(...CSRF).send({ currentPassword: 'nope', newPassword: 'BrandNew123!' });
    expect(wrong.status).toBe(400);

    const right = await agent.post('/api/auth/change-password').set(...CSRF).send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNew123!' });
    expect(right.status).toBe(200);

    // This device got fresh cookies and stays logged in.
    const me = await agent.get('/api/users/me');
    expect(me.status).toBe(200);
  });
});
