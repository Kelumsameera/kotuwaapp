const request = require('supertest');
const User = require('../../src/models/User');
const { hashPassword } = require('../../src/services/authService');
const { testOutbox } = require('../../src/config/mailer');
const { CSRF_HEADER, CSRF_HEADER_VALUE } = require('../../src/middleware/csrfGuard');

const TEST_PASSWORD = 'Password123!';

// Creates a verified, active user with the given role directly in the database.
async function createUser(role, overrides = {}) {
  return User.create({
    name: `Test ${role}`,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.lk`,
    role,
    isEmailVerified: true,
    passwordHash: await hashPassword(TEST_PASSWORD),
    ...overrides,
  });
}

// Returns a supertest "agent" (it keeps cookies like a browser) that is logged in as the user.
async function loginAs(app, user) {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .set(CSRF_HEADER, CSRF_HEADER_VALUE)
    .send({ email: user.email, password: TEST_PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${user.email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

// Creates a user with the role and logs in. Returns { user, agent }.
async function createLoggedInUser(app, role, overrides) {
  const user = await createUser(role, overrides);
  const agent = await loginAs(app, user);
  return { user, agent };
}

// Finds the token in the last email sent to an address (e.g. ...?token=abc).
function lastEmailToken(emailAddress) {
  const message = [...testOutbox].reverse().find((mail) => mail.to === emailAddress);
  if (!message) throw new Error(`No email sent to ${emailAddress}`);
  const match = message.text.match(/token=([a-f0-9]{64})/);
  if (!match) throw new Error('No token in email');
  return match[1];
}

// Reads one cookie value from a supertest response's Set-Cookie headers.
function cookieFromResponse(response, name) {
  const header = (response.headers['set-cookie'] || []).find((cookie) => cookie.startsWith(`${name}=`));
  return header ? header.split(';')[0].slice(name.length + 1) : undefined;
}

module.exports = {
  TEST_PASSWORD,
  CSRF: [CSRF_HEADER, CSRF_HEADER_VALUE],
  createUser,
  loginAs,
  createLoggedInUser,
  lastEmailToken,
  cookieFromResponse,
};
