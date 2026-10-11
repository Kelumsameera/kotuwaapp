const mongoose = require('mongoose');

// Runs work inside a MongoDB transaction: either every change is saved, or none is.
// MongoDB retries the work automatically if two transactions collide.
async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction };
