const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Category = require('../models/Category');
const Order = require('../models/Order');
const SubOrder = require('../models/SubOrder');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { nextCounterValue } = require('../models/Counter');
const { getPlatformSettings } = require('../models/PlatformSettings');
const { ORDER_STATUS } = require('../constants/orderStatus');
const { ROLES } = require('../constants/roles');
const stockService = require('./stockService');
const { findListedProductsByIds } = require('./catalogService');
const { shippingFeeFor } = require('./shippingService');
const { commissionFor } = require('./commissionService');
const { findMyAddress } = require('./addressService');
const { getPaymentProvider } = require('./payments');
const { notify } = require('./notifications/notify');
const { runInTransaction } = require('../utils/transaction');
const { AppError, badRequest } = require('../utils/AppError');

// ─────────────────────────────────────────────────────────────────────────────
// Checkout: turns the customer's cart into ONE order with ONE sub-order per seller.
// Prices, stock and commission are always read fresh from the database here;
// nothing the browser sends about money is trusted.
// ─────────────────────────────────────────────────────────────────────────────

// Copies a saved address into the shape stored on orders.
function addressSnapshot(address) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    district: address.district,
    province: address.province,
    postalCode: address.postalCode,
  };
}

// Loads the cart with fresh product data, and stops if anything can't be bought as-is.
async function loadCheckoutItems(userId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0) throw badRequest('CART_EMPTY', 'Your cart is empty.');

  const products = await findListedProductsByIds(cart.items.map((item) => item.product));
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const categories = await Category.find({ _id: { $in: products.map((product) => product.category) } });
  const commissionByCategory = new Map(categories.map((category) => [String(category._id), category.commissionPercent]));

  return cart.items.map((cartItem) => {
    const product = productsById.get(String(cartItem.product));
    const variant = product?.variants.id(cartItem.variantId);
    if (!variant || variant.stock < cartItem.quantity) {
      throw new AppError(409, 'CART_HAS_PROBLEMS', 'Some items in your cart changed. Please review your cart.');
    }

    const lineTotal = variant.price * cartItem.quantity;
    const commissionPercent = commissionByCategory.get(String(product.category)) ?? 0;
    return {
      shopId: String(product.shop._id),
      product: product._id,
      variantId: variant._id,
      sku: variant.sku,
      name: product.name,
      options: { size: variant.options?.size, color: variant.options?.color },
      image: product.images[0],
      unitPrice: variant.price,
      quantity: cartItem.quantity,
      lineTotal,
      weightGrams: (product.weightGrams || 0) * cartItem.quantity,
      category: product.category,
      commissionPercent,
      commissionAmount: commissionFor(lineTotal, commissionPercent),
    };
  });
}

// Works out everything the checkout page shows, without saving anything:
// the address, one group per shop with its delivery fee, and the totals.
async function buildCheckout(user, addressId) {
  const address = findMyAddress(user, addressId);
  const items = await loadCheckoutItems(user._id);
  const settings = await getPlatformSettings();
  const shops = await Shop.find({ _id: { $in: [...new Set(items.map((item) => item.shopId))] } });

  const groups = [];
  for (const shop of shops) {
    const shopItems = items.filter((item) => item.shopId === String(shop._id));
    const itemsSubtotal = shopItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const weightGrams = shopItems.reduce((sum, item) => sum + item.weightGrams, 0);
    const shippingFee = await shippingFeeFor({ shop, district: address.district, weightGrams, itemsSubtotal }, settings);
    const commissionTotal = shopItems.reduce((sum, item) => sum + item.commissionAmount, 0);

    groups.push({
      shop,
      items: shopItems,
      itemsSubtotal,
      weightGrams,
      shippingFee,
      total: itemsSubtotal + shippingFee,
      commissionTotal,
    });
  }

  const itemsTotal = groups.reduce((sum, group) => sum + group.itemsSubtotal, 0);
  const shippingTotal = groups.reduce((sum, group) => sum + group.shippingFee, 0);
  return { address, groups, itemsTotal, shippingTotal, grandTotal: itemsTotal + shippingTotal };
}

// Today's date in Sri Lanka as YYMMDD, e.g. "261011".
function colomboDateStamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}${part('month')}${part('day')}`;
}

// Makes the next readable order number, e.g. KT-261011-000042 (restarts at 1 each day).
async function nextOrderNumber(session) {
  const stamp = colomboDateStamp();
  const sequence = await nextCounterValue(`order-${stamp}`, session);
  return `KT-${stamp}-${String(sequence).padStart(6, '0')}`;
}

// Builds the sub-order for one shop (not saved yet).
function buildSubOrder({ group, orderId, orderNumber, index, customer, address }) {
  const firstEvent = { status: ORDER_STATUS.PLACED, at: new Date(), by: customer._id, byRole: ROLES.CUSTOMER };
  return new SubOrder({
    order: orderId,
    orderNumber,
    subOrderNumber: `${orderNumber}-${index + 1}`,
    shop: group.shop._id,
    customer: customer._id,
    shippingAddress: address,
    // Copy each item without the shopId helper field (the sub-order already has the shop).
    items: group.items.map(({ shopId, ...item }) => item),
    itemsSubtotal: group.itemsSubtotal,
    shippingFee: group.shippingFee,
    total: group.total,
    commissionTotal: group.commissionTotal,
    sellerNet: group.total - group.commissionTotal,
    status: ORDER_STATUS.PLACED,
    trackingHistory: [firstEvent],
  });
}

// Emails the customer and every seller after the order is safely saved.
async function sendOrderEmails(customer, order, subOrders) {
  const shops = await Shop.find({ _id: { $in: subOrders.map((subOrder) => subOrder.shop) } });
  const shopOf = (subOrder) => shops.find((candidate) => String(candidate._id) === String(subOrder.shop));

  const groups = subOrders.map((subOrder) => ({
    shopName: shopOf(subOrder)?.name || '',
    items: subOrder.items,
    shippingFee: subOrder.shippingFee,
    total: subOrder.total,
  }));
  await notify(customer, 'orderPlaced', { order, groups });

  for (const subOrder of subOrders) {
    const owner = await User.findById(shopOf(subOrder)?.owner);
    if (owner) await notify(owner, 'newSubOrder', { subOrder });
  }
}

// Places the order. Everything happens in ONE transaction: stock is taken, the order and
// sub-orders are saved and the cart is emptied. If anything fails, nothing changes at all.
async function placeOrder(customer, { addressId, paymentMethod, expectedTotal, idempotencyKey, note }) {
  // The same checkout submitted twice (double click, retry) returns the first order.
  const earlier = await Order.findOne({ customer: customer._id, idempotencyKey });
  if (earlier) return { order: earlier, isNew: false };

  const provider = getPaymentProvider(paymentMethod);
  const checkout = await buildCheckout(customer, addressId);

  // The customer agreed to a total; if a price or fee changed since then, ask again.
  if (expectedTotal !== checkout.grandTotal) {
    throw new AppError(409, 'TOTAL_CHANGED', 'Prices or delivery fees changed. Please check the new total.', {
      grandTotal: checkout.grandTotal,
    });
  }

  const address = addressSnapshot(checkout.address);
  let saved;
  try {
    saved = await runInTransaction(async (session) => {
      const orderId = new mongoose.Types.ObjectId();
      const orderNumber = await nextOrderNumber(session);

      const stockItems = checkout.groups.flatMap((group) =>
        group.items.map((item) => ({ productId: item.product, variantId: item.variantId, quantity: item.quantity }))
      );
      await stockService.takeStock(stockItems, {
        session,
        reason: 'online_order',
        refModel: 'Order',
        refId: orderId,
        by: customer._id,
      });

      const subOrders = checkout.groups.map((group, index) =>
        buildSubOrder({ group, orderId, orderNumber, index, customer, address })
      );
      const order = new Order({
        _id: orderId,
        orderNumber,
        customer: customer._id,
        shippingAddress: address,
        note,
        paymentMethod: provider.method,
        itemsTotal: checkout.itemsTotal,
        shippingTotal: checkout.shippingTotal,
        grandTotal: checkout.grandTotal,
        language: customer.preferredLanguage,
        subOrders: subOrders.map((subOrder) => subOrder._id),
        idempotencyKey,
      });

      const payment = await provider.createPayment(order, subOrders, session);
      order.paymentStatus = payment.paymentStatus;

      for (const subOrder of subOrders) await subOrder.save({ session });
      await order.save({ session });
      await Cart.updateOne({ user: customer._id }, { items: [] }, { session });

      return { order, subOrders };
    });
  } catch (error) {
    // Two identical requests at the same moment: the second one hits the unique key.
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ customer: customer._id, idempotencyKey });
      if (existing) return { order: existing, isNew: false };
    }
    throw error;
  }

  await sendOrderEmails(customer, saved.order, saved.subOrders);
  return { order: saved.order, isNew: true };
}

module.exports = { buildCheckout, placeOrder };
