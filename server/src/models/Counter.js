const mongoose = require('mongoose');

// A named number that only goes up, used for readable order numbers like KT-261011-000042.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  value: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

// Returns the next number for a counter name (atomic, so two orders never get the same number).
async function nextCounterValue(name, session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { new: true, upsert: true, session }
  );
  return counter.value;
}

module.exports = Counter;
module.exports.nextCounterValue = nextCounterValue;
