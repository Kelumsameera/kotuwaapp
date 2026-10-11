// Sri Lanka time is always UTC+05:30 (no daylight saving), so "a day" can be computed exactly.
const OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date in Sri Lanka as "YYYY-MM-DD".
function todayInColombo(now = new Date()) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

// The start (inclusive) and end (exclusive) instants of a Sri Lanka calendar day.
// "2026-10-11" → 2026-10-10T18:30Z … 2026-10-11T18:30Z
function colomboDayRange(dateText) {
  const start = new Date(Date.parse(`${dateText}T00:00:00Z`) - OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

// "261011" for bill numbers (YYMMDD in Sri Lanka time).
function colomboDateStamp(now = new Date()) {
  return todayInColombo(now).slice(2).replace(/-/g, '');
}

module.exports = { todayInColombo, colomboDayRange, colomboDateStamp };
