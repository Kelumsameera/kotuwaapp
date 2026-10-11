// Commission the platform keeps from an online sale. Rounded to the nearest cent.
// e.g. Rs 4,500.00 (450000 cents) at 7.5 % → 33750 cents.
// POS sales are not commissioned (see PLAN.md).
function commissionFor(lineTotal, commissionPercent) {
  return Math.round((lineTotal * commissionPercent) / 100);
}

module.exports = { commissionFor };
