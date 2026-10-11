// All money in the API is in cents (Rs 1 = 100 cents). These helpers convert for display and forms.

// 450000 → "Rs 4,500.00"
export function formatMoney(cents) {
  if (cents === null || cents === undefined) return "";
  const rupees = cents / 100;
  return `Rs ${rupees.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 450000 → "4500.00" (for putting into a form input)
export function centsToInput(cents) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

// "4,500.50" → 450050. Returns null for empty input and NaN for invalid input.
export function inputToCents(text) {
  const cleaned = String(text ?? "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}
