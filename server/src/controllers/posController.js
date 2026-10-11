const posService = require('../services/posService');
const posReportService = require('../services/posReportService');
const { todayInColombo } = require('../utils/colomboTime');

// One POS bill as JSON (for the screen and for printing the receipt).
function serializeSale(sale) {
  return {
    id: String(sale._id),
    billNumber: sale.billNumber || null,
    status: sale.status,
    cashier: sale.cashier?.name ? { id: String(sale.cashier._id), name: sale.cashier.name } : { id: String(sale.cashier) },
    items: sale.items.map((line) => ({
      productId: String(line.product),
      variantId: String(line.variantId),
      sku: line.sku,
      name: { en: line.name?.en || '', si: line.name?.si, ta: line.name?.ta },
      options: { size: line.options?.size || '', color: line.options?.color || '' },
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      itemDiscount: line.itemDiscount,
      lineTotal: line.lineTotal,
    })),
    subtotal: sale.subtotal,
    itemDiscountTotal: sale.itemDiscountTotal,
    billDiscount: sale.billDiscount,
    total: sale.total,
    payment: sale.payment?.method
      ? {
          method: sale.payment.method,
          cashReceived: sale.payment.cashReceived ?? null,
          change: sale.payment.change ?? null,
          cardReference: sale.payment.cardReference || '',
        }
      : null,
    heldLabel: sale.heldLabel || '',
    createdAt: sale.createdAt,
    completedAt: sale.completedAt || null,
    voidedAt: sale.voidedAt || null,
    voidReason: sale.voidReason || '',
  };
}

// The shop details printed on receipts.
function receiptShop(shop) {
  return {
    name: shop.name,
    phone: shop.phone || '',
    address: [shop.address?.addressLine1, shop.address?.city].filter(Boolean).join(', '),
  };
}

// GET /api/pos/session — what the POS screen needs to start: shop, cashier and discount limit.
async function session(req, res) {
  res.json({
    shop: { ...receiptShop(req.shop), status: req.shop.status, cashierMaxDiscountPercent: req.shop.cashierMaxDiscountPercent ?? 10 },
    user: { id: String(req.user._id), name: req.user.name, role: req.user.role },
    today: todayInColombo(),
  });
}

// GET /api/pos/lookup?code= (barcode scanner)
async function lookup(req, res) {
  res.json({ item: await posService.lookupByCode(req.shop, req.query.code) });
}

// GET /api/pos/search?q=
async function search(req, res) {
  res.json({ items: await posService.searchProducts(req.shop, req.query.q) });
}

// POST /api/pos/sales
async function completeSale(req, res) {
  const sale = await posService.completeSale(req.user, req.shop, req.body);
  await sale.populate('cashier', 'name');
  res.status(201).json({ sale: serializeSale(sale), shop: receiptShop(req.shop) });
}

// GET /api/pos/sales/:id (reprint)
async function getSale(req, res) {
  const sale = await posService.getSale(req.user, req.shop, req.params.id);
  res.json({ sale: serializeSale(sale), shop: receiptShop(req.shop) });
}

// POST /api/pos/sales/:id/void (owner only)
async function voidSale(req, res) {
  const sale = await posService.voidSale(req, req.shop, req.params.id, req.body.reason);
  res.json({ sale: serializeSale(sale) });
}

// GET /api/pos/held
async function listHeld(req, res) {
  const sales = await posService.listHeldBills(req.shop);
  res.json({ held: sales.map(serializeSale) });
}

// POST /api/pos/held
async function holdBill(req, res) {
  const sale = await posService.holdBill(req.user, req.shop, req.body);
  res.status(201).json({ held: serializeSale(sale) });
}

// DELETE /api/pos/held/:id
async function deleteHeld(req, res) {
  await posService.deleteHeldBill(req.shop, req.params.id);
  res.status(204).end();
}

// GET /api/pos/reports/my-day?date= (any POS user: their own totals)
async function myDay(req, res) {
  res.json({ report: await posReportService.myDay(req.user, req.shop, req.query.date || todayInColombo()) });
}

// GET /api/pos/reports/daily?date= (owner)
async function dailyReport(req, res) {
  res.json({ report: await posReportService.dailyReport(req.shop, req.query.date || todayInColombo()) });
}

// GET /api/pos/reports/cashiers?from=&to= (owner)
async function cashierReport(req, res) {
  res.json({ report: await posReportService.cashierReport(req.shop, req.query.from, req.query.to) });
}

// GET /api/pos/sales?date=&cashier= (owner)
async function listSales(req, res) {
  const { sales, total, page, limit } = await posReportService.listSales(req.shop, { ...req.query, date: req.query.date || todayInColombo() });
  res.json({ sales: sales.map(serializeSale), total, page, limit });
}

module.exports = {
  session,
  lookup,
  search,
  completeSale,
  getSale,
  voidSale,
  listHeld,
  holdBill,
  deleteHeld,
  myDay,
  dailyReport,
  cashierReport,
  listSales,
};
