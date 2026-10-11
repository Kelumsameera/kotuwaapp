const env = require('./config/env');
const createApp = require('./app');
const { connectDatabase } = require('./config/db');
const { startJobs } = require('./jobs/scheduler');

// Connects to MongoDB, then starts listening for requests.
async function startServer() {
  await connectDatabase(env.MONGODB_URI);

  startJobs();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

startServer().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
