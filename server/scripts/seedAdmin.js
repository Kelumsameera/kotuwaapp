// Creates the first super_admin from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in .env.
// This is the ONLY way to create a super_admin; the register API never allows it.
const env = require('../src/config/env');
const User = require('../src/models/User');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { hashPassword } = require('../src/services/authService');
const { ROLES } = require('../src/constants/roles');

// Stops the script with a message.
function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

// Creates the admin account if no super_admin exists yet.
async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return fail('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  }
  if (ADMIN_PASSWORD.length < 12) {
    return fail('ADMIN_PASSWORD must be at least 12 characters.');
  }

  await connectDatabase(env.MONGODB_URI);

  try {
    const existingAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });
    if (existingAdmin) {
      console.log(`A super_admin already exists (${existingAdmin.email}). Nothing to do.`);
      return;
    }

    const email = ADMIN_EMAIL.toLowerCase().trim();
    if (await User.exists({ email })) {
      return fail(`${email} is already used by a non-admin account. Use a different ADMIN_EMAIL.`);
    }

    await User.create({
      name: ADMIN_NAME,
      email,
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    });

    console.log(`Super admin created: ${email}`);
    console.log('You can now remove ADMIN_PASSWORD from .env.');
  } finally {
    await disconnectDatabase();
  }
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
