// Starts a local MongoDB for development without Docker or a MongoDB install.
// It runs as a one-node replica set because transactions (stock, payments) need one.
// Data is kept in server/.mongo-data, so it survives restarts. Press Ctrl+C to stop.
const path = require('path');
const fs = require('fs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const PORT = 27017;
const DATA_DIR = path.join(__dirname, '..', '.mongo-data');

// Starts the database and keeps it running until Ctrl+C.
async function startDevDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port: PORT, dbPath: DATA_DIR, ip: '127.0.0.1' }],
  });

  console.log('Local MongoDB is running.');
  console.log(`Put this in server/.env:  MONGODB_URI=mongodb://127.0.0.1:${PORT}/kotuwa?replicaSet=rs0`);
  console.log('Press Ctrl+C to stop.');

  // Stops MongoDB cleanly but keeps the data folder.
  async function stop() {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  }

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

startDevDatabase().catch((error) => {
  console.error('Could not start local MongoDB:', error.message);
  process.exit(1);
});
