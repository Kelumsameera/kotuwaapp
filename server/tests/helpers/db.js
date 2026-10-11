const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

// Starts a throwaway MongoDB replica set (so transactions work) and connects Mongoose.
async function startTestDatabase() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  // Make sure unique indexes exist before tests rely on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

// Deletes every document so each test starts clean.
async function clearTestDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

// Disconnects and shuts the test database down.
async function stopTestDatabase() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

module.exports = { startTestDatabase, clearTestDatabase, stopTestDatabase };
