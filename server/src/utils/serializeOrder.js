const { nextStatusesFor, MAX_DELIVERY_ATTEMPTS, ORDER_STATUS } = require('../constants/orderStatus');

const DAY_MS = 24 * 60 * 60 * 1000;

// Turns orders into safe JSON for each kind of viewer.
// Customers never see commission or seller earnings; sellers only get their own sub-order;
// riders get what they need to deliver; the public tracking page gets statuses only.

// Copies an image's url and publicId (or null).
function image(value) {
  return value && value.url ? { url: value.url, publicId: value.publicId } : null;
}

// A saved or order address.
function serializeAddress(address) {
  return {
    id: address._id ? String(address._id) : undefined,
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    district: address.district,
    province: address.province,
    postalCode: address.postalCode || '',
    isDefault: address.isDefault,
  };
}

// An item's name in all languages.
function itemName(item) {
  return { en: item.name?.en || '', si: item.name?.si, ta: item.name?.ta };
}

// One bought item. Pass withCommission for sellers and admins.
function serializeItem(item, withCommission = false) {
  const result = {
    productId: String(item.product),
    variantId: String(item.variantId),
    sku: item.sku,
    name: itemName(item),
    options: { size: item.options?.size || '', color: item.options?.color || '' },
    image: image(item.image),
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  };
  if (withCommission) {
    result.commissionPercent = item.commissionPercent;
    result.commissionAmount = item.commissionAmount;
  }
  return result;
}

// The status timeline. Shows the role of who changed it, not their account id.
function serializeTimeline(events) {
  return events.map((event) => ({ status: event.status, note: event.note || '', at: event.at, byRole: event.byRole }));
}

// The shop name/link shown on an order (when the shop was populated).
function shopSummary(shop) {
  return shop && shop.name ? { id: String(shop._id), name: shop.name, slug: shop.slug, logo: image(shop.logo) } : null;
}

// The last moment a delivered sub-order can be returned (ms), or 0 if not delivered.
function returnDeadline(subOrder, returnPeriodDays = 0) {
  const deliveredAt = subOrder.delivery?.deliveredAt;
  return deliveredAt ? new Date(deliveredAt).getTime() + returnPeriodDays * DAY_MS : 0;
}

// The status moves this viewer can make right now (the server checks again on every change).
// Hides moves that would be refused anyway: retrying with no attempts left, or a late return.
function availableMoves(subOrder, role, returnPeriodDays) {
  return nextStatusesFor(subOrder.status, role).filter((next) => {
    if (next === ORDER_STATUS.OUT_FOR_DELIVERY && subOrder.status === ORDER_STATUS.DELIVERY_FAILED) {
      return (subOrder.delivery?.attempts || 0) < MAX_DELIVERY_ATTEMPTS;
    }
    if (next === ORDER_STATUS.RETURN_REQUESTED) {
      return Date.now() <= returnDeadline(subOrder, returnPeriodDays);
    }
    return true;
  });
}

// Proof of delivery details (never the signature image itself).
function proofSummary(delivery) {
  const proof = delivery?.proof;
  if (!proof?.at) return null;
  return { photo: image(proof.photo), hasSignature: Boolean(proof.hasSignature), at: proof.at };
}

// The rider assigned to a sub-order (name and phone when populated).
function riderSummary(rider) {
  if (!rider) return null;
  if (!rider.name) return { id: String(rider) };
  return { id: String(rider._id), name: rider.name, phone: rider.phone || '' };
}

// Courier and tracking fields shared by several views.
function courierFields(delivery) {
  return {
    method: delivery?.method || null,
    courierName: delivery?.courierName || '',
    trackingNumber: delivery?.trackingNumber || '',
    trackingUrl: delivery?.trackingUrl || '',
  };
}

// One seller's part of an order, as the customer sees it.
function serializeSubOrderForCustomer(subOrder, returnPeriodDays) {
  return {
    id: String(subOrder._id),
    subOrderNumber: subOrder.subOrderNumber,
    shop: shopSummary(subOrder.shop),
    items: subOrder.items.map((item) => serializeItem(item)),
    itemsSubtotal: subOrder.itemsSubtotal,
    shippingFee: subOrder.shippingFee,
    total: subOrder.total,
    status: subOrder.status,
    nextStatuses: availableMoves(subOrder, 'customer', returnPeriodDays),
    returnDeadline: subOrder.delivery?.deliveredAt ? new Date(returnDeadline(subOrder, returnPeriodDays)) : null,
    timeline: serializeTimeline(subOrder.trackingHistory),
    delivery: {
      ...courierFields(subOrder.delivery),
      codAmount: subOrder.delivery?.codAmount || 0,
      deliveredAt: subOrder.delivery?.deliveredAt || null,
      proof: proofSummary(subOrder.delivery),
    },
  };
}

// The whole order as the customer sees it.
function serializeOrderForCustomer(order, returnPeriodDays = 0) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    shippingAddress: serializeAddress(order.shippingAddress),
    note: order.note || '',
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    itemsTotal: order.itemsTotal,
    shippingTotal: order.shippingTotal,
    grandTotal: order.grandTotal,
    subOrders: (order.subOrders || []).map((subOrder) => serializeSubOrderForCustomer(subOrder, returnPeriodDays)),
  };
}

// A sub-order as its seller (or an admin) sees it: buyer address, commission, earnings and delivery.
// viewerRole decides which status buttons are offered.
function serializeSubOrderForSeller(subOrder, viewerRole = 'seller') {
  return {
    id: String(subOrder._id),
    orderNumber: subOrder.orderNumber,
    subOrderNumber: subOrder.subOrderNumber,
    shop: shopSummary(subOrder.shop),
    createdAt: subOrder.createdAt,
    updatedAt: subOrder.updatedAt,
    shippingAddress: serializeAddress(subOrder.shippingAddress),
    items: subOrder.items.map((item) => serializeItem(item, true)),
    itemsSubtotal: subOrder.itemsSubtotal,
    shippingFee: subOrder.shippingFee,
    total: subOrder.total,
    commissionTotal: subOrder.commissionTotal,
    sellerNet: subOrder.sellerNet,
    status: subOrder.status,
    nextStatuses: availableMoves(subOrder, viewerRole),
    cancelReason: subOrder.cancelReason || '',
    returnRequest: subOrder.returnRequest?.requestedAt
      ? { reason: subOrder.returnRequest.reason, requestedAt: subOrder.returnRequest.requestedAt }
      : null,
    timeline: serializeTimeline(subOrder.trackingHistory),
    delivery: {
      ...courierFields(subOrder.delivery),
      codAmount: subOrder.delivery?.codAmount || 0,
      codCollected: Boolean(subOrder.delivery?.codCollected),
      attempts: subOrder.delivery?.attempts || 0,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      failReasons: subOrder.delivery?.failReasons || [],
      rider: riderSummary(subOrder.delivery?.rider),
      deliveredAt: subOrder.delivery?.deliveredAt || null,
      proof: proofSummary(subOrder.delivery),
    },
  };
}

// A delivery as the rider sees it: where to pick up, where to deliver, cash to collect.
function serializeDeliveryForRider(subOrder) {
  const shop = subOrder.shop || {};
  return {
    subOrderNumber: subOrder.subOrderNumber,
    status: subOrder.status,
    nextStatuses: availableMoves(subOrder, 'rider'),
    pickup: {
      shopName: shop.name || '',
      phone: shop.phone || '',
      address: [shop.address?.addressLine1, shop.address?.city].filter(Boolean).join(', '),
    },
    dropoff: serializeAddress(subOrder.shippingAddress),
    items: subOrder.items.map((item) => ({ name: itemName(item), quantity: item.quantity, options: item.options })),
    codAmount: subOrder.delivery?.codAmount || 0,
    codCollected: Boolean(subOrder.delivery?.codCollected),
    attempts: subOrder.delivery?.attempts || 0,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
    failReasons: subOrder.delivery?.failReasons || [],
    proof: proofSummary(subOrder.delivery),
    timeline: serializeTimeline(subOrder.trackingHistory),
  };
}

// Public tracking (order number + phone): statuses, items and courier links only.
// No address, phone, prices, notes or names of people.
function serializePublicTracking(order) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    parts: (order.subOrders || []).map((subOrder) => ({
      subOrderNumber: subOrder.subOrderNumber,
      shopName: subOrder.shop?.name || '',
      status: subOrder.status,
      items: subOrder.items.map((item) => ({ name: itemName(item), quantity: item.quantity })),
      courierName: subOrder.delivery?.courierName || '',
      trackingNumber: subOrder.delivery?.trackingNumber || '',
      trackingUrl: subOrder.delivery?.trackingUrl || '',
      timeline: subOrder.trackingHistory.map((event) => ({ status: event.status, at: event.at })),
    })),
  };
}

// A whole order for the admin.
function serializeOrderForAdmin(order) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customer: order.customer?.name ? { name: order.customer.name, email: order.customer.email } : null,
    shippingAddress: serializeAddress(order.shippingAddress),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    itemsTotal: order.itemsTotal,
    shippingTotal: order.shippingTotal,
    grandTotal: order.grandTotal,
    subOrders: (order.subOrders || []).map((subOrder) => serializeSubOrderForSeller(subOrder, 'super_admin')),
  };
}

// The checkout summary (before placing): per-shop items, delivery fees and totals. No commission.
function serializeCheckout(checkout) {
  return {
    address: serializeAddress(checkout.address),
    groups: checkout.groups.map((group) => ({
      shop: shopSummary(group.shop),
      items: group.items.map((item) => serializeItem(item)),
      itemsSubtotal: group.itemsSubtotal,
      weightGrams: group.weightGrams,
      shippingFee: group.shippingFee,
      total: group.total,
    })),
    itemsTotal: checkout.itemsTotal,
    shippingTotal: checkout.shippingTotal,
    grandTotal: checkout.grandTotal,
  };
}

module.exports = {
  serializeAddress,
  serializeOrderForCustomer,
  serializeSubOrderForCustomer,
  serializeSubOrderForSeller,
  serializeDeliveryForRider,
  serializePublicTracking,
  serializeOrderForAdmin,
  serializeCheckout,
};
