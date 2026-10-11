// Loads Sri Lanka's districts, provinces and main cities into MongoDB.
// Safe to run many times: each district is updated in place by its key.
const env = require('../src/config/env');
const District = require('../src/models/District');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { PROVINCES, DISTRICTS } = require('../src/constants/districts');

// Inserts or updates every district.
async function seedDistricts() {
  await connectDatabase(env.MONGODB_URI);

  try {
    const operations = DISTRICTS.map((district) => ({
      updateOne: {
        filter: { key: district.key },
        update: {
          $set: {
            key: district.key,
            name: district.name,
            province: { key: district.province, name: PROVINCES[district.province] },
            cities: district.cities,
          },
        },
        upsert: true,
      },
    }));

    await District.bulkWrite(operations);
    console.log(`Seeded ${DISTRICTS.length} districts.`);
  } finally {
    await disconnectDatabase();
  }
}

seedDistricts().catch((error) => {
  console.error(error);
  process.exit(1);
});
