// All money is stored in cents (Rs 1 = 100). This turns 450000 into "Rs 4,500.00" for emails.
function formatMoney(cents) {
  const rupees = (cents || 0) / 100;
  return `Rs ${rupees.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { formatMoney };
