const Order = require('../models/Order');
const SubOrder = require('../models/SubOrder');
const { notFound } = require('../utils/AppError');

// Reading orders. Every query is scoped to who is asking:
// customers see only their orders, sellers only their shop's sub-orders.

const SHOP_FIELDS = 'name slug logo';

// Escapes text for a safe regular-expression search.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Customer: one page of their own orders, newest first.
async function listCustomerOrders(customerId, { page, limit }) {
  const filter = { customer: customerId };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'subOrders', populate: { path: 'shop', select: SHOP_FIELDS } }),
    Order.countDocuments(filter),
  ]);
  return { orders, total, page, limit };
}

// Customer: one of their own orders with every sub-order. Another customer's order is 404.
async function getCustomerOrder(customerId, orderNumber) {
  const order = await Order.findOne({ orderNumber, customer: customerId }).populate({
    path: 'subOrders',
    populate: { path: 'shop', select: SHOP_FIELDS },
  });
  if (!order) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return order;
}

// Seller: one page of their own shop's sub-orders, optionally filtered by status or number.
async function listShopSubOrders(shopId, { status, search, page, limit }) {
  const filter = { shop: shopId };
  if (status) filter.status = status;
  if (search) filter.subOrderNumber = new RegExp(escapeRegex(search), 'i');

  const [subOrders, total] = await Promise.all([
    SubOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    SubOrder.countDocuments(filter),
  ]);
  return { subOrders, total, page, limit };
}

// Seller: one of their own shop's sub-orders. Another shop's sub-order is 404.
async function getShopSubOrder(shopId, subOrderNumber) {
  const subOrder = await SubOrder.findOne({ subOrderNumber, shop: shopId });
  if (!subOrder) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return subOrder;
}

// Admin: one page of all orders, optionally searched by order number.
async function listAllOrders({ search, page, limit }) {
  const filter = {};
  if (search) filter.orderNumber = new RegExp(escapeRegex(search), 'i');

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'name email')
      .populate({ path: 'subOrders', populate: { path: 'shop', select: SHOP_FIELDS } }),
    Order.countDocuments(filter),
  ]);
  return { orders, total, page, limit };
}

module.exports = { listCustomerOrders, getCustomerOrder, listShopSubOrders, getShopSubOrder, listAllOrders };
