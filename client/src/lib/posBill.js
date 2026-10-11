// Works out a POS bill on the screen, with the SAME rules the server uses (all money in cents).
// The server recalculates everything; if the totals differ (a price changed), it refuses the sale.

// lines: [{ price, quantity, itemDiscount }]
export function computeBill(lines, billDiscount = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemDiscountTotal = lines.reduce((sum, line) => sum + (line.itemDiscount || 0), 0);
  const total = subtotal - itemDiscountTotal - billDiscount;
  return { subtotal, itemDiscountTotal, billDiscount, total };
}

// The total of one line after its discount.
export function lineTotal(line) {
  return line.price * line.quantity - (line.itemDiscount || 0);
}

// What the server needs for a sale or a held bill: ids, quantities and discounts only.
export function linesForServer(lines) {
  return lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    itemDiscount: line.itemDiscount || 0,
  }));
}

// Turns a held bill from the server back into screen lines.
export function linesFromHeldBill(heldBill) {
  return heldBill.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    sku: item.sku,
    options: item.options,
    price: item.unitPrice,
    quantity: item.quantity,
    itemDiscount: item.itemDiscount,
    stock: null,
  }));
}
