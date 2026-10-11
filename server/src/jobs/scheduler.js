const { releaseDueEarnings } = require('../services/earningsService');
const { sendLowStockDigests } = require('../services/lowStockService');

const ONE_HOUR_MS = 60 * 60 * 1000;

// Runs one job and logs (never throws) so a failing job can't crash the server.
async function runJob(name, job) {
  try {
    const result = await job();
    if (result) console.log(`[job] ${name}: ${result}`);
  } catch (error) {
    console.error(`[job] ${name} failed:`, error.message);
  }
}

// Starts the background jobs: once now, then every hour.
function startJobs() {
  const runAll = async () => {
    await runJob('release seller earnings', releaseDueEarnings);
    await runJob('low stock emails', sendLowStockDigests);
  };
  runAll();
  return setInterval(runAll, ONE_HOUR_MS);
}

module.exports = { startJobs };
