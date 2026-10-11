const mongoose = require('mongoose');

// Opens the MongoDB connection used by the whole app.
async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

// Closes the MongoDB connection (used by scripts and tests).
async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
