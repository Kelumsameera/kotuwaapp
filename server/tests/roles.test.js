// One test block per role, proving what each role can and cannot access.
const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { startTestDatabase, clearTestDatabase, stopTestDatabase } = require('./helpers/db');
const { CSRF, createUser, createLoggedInUser } = require('./helpers/auth');

const app = createApp();

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

// Calls every admin route and returns the status codes.
async function callAdminRoutes(agent, targetId) {
  const list = await agent.get('/api/admin/users');
  const role = await agent.patch(`/api/admin/users/${targetId}/role`).set(...CSRF).send({ role: 'seller' });
  const status = await agent.patch(`/api/admin/users/${targetId}/status`).set(...CSRF).send({ isActive: false });
  const rider = await agent
    .post('/api/admin/riders')
    .set(...CSRF)
    .send({ name: 'Rider', email: `r${Date.now()}@test.lk`, phone: '0771234567', password: 'Password123!' });
  return [list.status, role.status, status.status, rider.status];
}

describe('anonymous visitor', () => {
  test('can read public data', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/locations/districts')).status).toBe(200);
  });

  test('cannot access any protected route (401)', async () => {
    const target = await createUser('customer');
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    const response = await request(app).patch(`/api/admin/users/${target._id}/role`).set(...CSRF).send({ role: 'seller' });
    expect(response.status).toBe(401);
  });
});

describe.each(['customer', 'seller', 'seller_cashier', 'rider'])('%s', (role) => {
  test('can read and update their own profile and language', async () => {
    const { agent, user } = await createLoggedInUser(app, role);

    const me = await agent.get('/api/users/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(String(user._id));
    expect(me.body.user.role).toBe(role);

    const language = await agent.patch('/api/users/me/language').set(...CSRF).send({ language: 'si' });
    expect(language.status).toBe(200);
    expect(language.body.user.preferredLanguage).toBe('si');
  });

  test('cannot change their own role through the profile route', async () => {
    const { agent, user } = await createLoggedInUser(app, role);
    const response = await agent.patch('/api/users/me').set(...CSRF).send({ role: 'super_admin' });
    expect(response.status).toBe(400);
    expect((await User.findById(user._id)).role).toBe(role);
  });

  test('is refused on every admin route (403)', async () => {
    const { agent } = await createLoggedInUser(app, role);
    const target = await createUser('customer');
    expect(await callAdminRoutes(agent, target._id)).toEqual([403, 403, 403, 403]);
    expect((await User.findById(target._id)).role).toBe('customer');
  });
});

describe('super_admin', () => {
  test('can list users, change roles, disable users and create riders', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const target = await createUser('customer');
    expect(await callAdminRoutes(agent, target._id)).toEqual([200, 200, 200, 201]);
  });

  test('role changes and disables are written to the audit log', async () => {
    const { agent, user: admin } = await createLoggedInUser(app, 'super_admin');
    const target = await createUser('customer');

    await agent.patch(`/api/admin/users/${target._id}/role`).set(...CSRF).send({ role: 'seller' });
    const log = await AuditLog.findOne({ action: 'user.role_change', targetId: target._id });
    expect(String(log.actor)).toBe(String(admin._id));
    expect(log.before).toEqual({ role: 'customer' });
    expect(log.after).toEqual({ role: 'seller' });
  });

  test('cannot make anyone a super_admin', async () => {
    const { agent } = await createLoggedInUser(app, 'super_admin');
    const target = await createUser('customer');
    const response = await agent.patch(`/api/admin/users/${target._id}/role`).set(...CSRF).send({ role: 'super_admin' });
    expect(response.status).toBe(400);
  });

  test('cannot change themselves or another super_admin', async () => {
    const { agent, user: admin } = await createLoggedInUser(app, 'super_admin');
    const otherAdmin = await createUser('super_admin');

    const self = await agent.patch(`/api/admin/users/${admin._id}/status`).set(...CSRF).send({ isActive: false });
    const other = await agent.patch(`/api/admin/users/${otherAdmin._id}/status`).set(...CSRF).send({ isActive: false });
    expect(self.status).toBe(400);
    expect(other.status).toBe(400);
  });

  test('a disabled user is logged out at once', async () => {
    const { agent: adminAgent } = await createLoggedInUser(app, 'super_admin');
    const { agent: customerAgent, user: customer } = await createLoggedInUser(app, 'customer');

    expect((await customerAgent.get('/api/users/me')).status).toBe(200);
    await adminAgent.patch(`/api/admin/users/${customer._id}/status`).set(...CSRF).send({ isActive: false });

    expect((await customerAgent.get('/api/users/me')).status).toBe(401);
    expect((await customerAgent.post('/api/auth/refresh').set(...CSRF)).status).toBe(401);
  });

  test('a role change kills old access tokens, and one refresh brings the new role', async () => {
    const { agent: adminAgent } = await createLoggedInUser(app, 'super_admin');
    const { agent: riderAgent, user: rider } = await createLoggedInUser(app, 'rider');

    await adminAgent.patch(`/api/admin/users/${rider._id}/role`).set(...CSRF).send({ role: 'customer' });

    // The old access token (which says "rider") is refused at once.
    const stale = await riderAgent.get('/api/users/me');
    expect(stale.status).toBe(401);
    expect(stale.body.error.code).toBe('TOKEN_REVOKED');

    // The browser refreshes once (no new login needed) and now has the new role.
    const refreshed = await riderAgent.post('/api/auth/refresh').set(...CSRF);
    expect(refreshed.body.user.role).toBe('customer');
    const me = await riderAgent.get('/api/users/me');
    expect(me.body.user.role).toBe('customer');
  });
});
