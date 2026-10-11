// Turns orders into safe JSON for each kind of viewer.
// Customers never see commission or seller earnings; sellers only get their own sub-order.

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

// One bought item. Pass withCommission for sellers and admins.
function serializeItem(item, withCommission = false) {
  const result = {
    productId: String(item.product),
    variantId: String(item.variantId),
    sku: item.sku,
    name: { en: item.name?.en || '', si: item.name?.si, ta: item.name?.ta },
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

// One seller's part of an order, as the customer sees it.
function serializeSubOrderForCustomer(subOrder) {
  return {
    id: String(subOrder._id),
    subOrderNumber: subOrder.subOrderNumber,
    shop: shopSummary(subOrder.shop),
    items: subOrder.items.map((item) => serializeItem(item)),
    itemsSubtotal: subOrder.itemsSubtotal,
    shippingFee: subOrder.shippingFee,
    total: subOrder.total,
    status: subOrder.status,
    timeline: serializeTimeline(subOrder.trackingHistory),
    delivery: {
      method: subOrder.delivery?.method || null,
      courierName: subOrder.delivery?.courierName || '',
      trackingNumber: subOrder.delivery?.trackingNumber || '',
      trackingUrl: subOrder.delivery?.trackingUrl || '',
      codAmount: subOrder.delivery?.codAmount || 0,
    },
  };
}

// The whole order as the customer sees it.
function serializeOrderForCustomer(order) {
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
    subOrders: (order.subOrders || []).map(serializeSubOrderForCustomer),
  };
}

// A sub-order as its seller (or an admin) sees it: buyer address, commission and earnings.
function serializeSubOrderForSeller(subOrder) {
  return {
    id: String(subOrder._id),
    orderNumber: subOrder.orderNumber,
    subOrderNumber: subOrder.subOrderNumber,
    shop: shopSummary(subOrder.shop),
    createdAt: subOrder.createdAt,
    shippingAddress: serializeAddress(subOrder.shippingAddress),
    items: subOrder.items.map((item) => serializeItem(item, true)),
    itemsSubtotal: subOrder.itemsSubtotal,
    shippingFee: subOrder.shippingFee,
    total: subOrder.total,
    commissionTotal: subOrder.commissionTotal,
    sellerNet: subOrder.sellerNet,
    status: subOrder.status,
    timeline: serializeTimeline(subOrder.trackingHistory),
    delivery: {
      method: subOrder.delivery?.method || null,
      courierName: subOrder.delivery?.courierName || '',
      trackingNumber: subOrder.delivery?.trackingNumber || '',
      trackingUrl: subOrder.delivery?.trackingUrl || '',
      codAmount: subOrder.delivery?.codAmount || 0,
      codCollected: Boolean(subOrder.delivery?.codCollected),
      attempts: subOrder.delivery?.attempts || 0,
    },
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
    subOrders: (order.subOrders || []).map(serializeSubOrderForSeller),
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
  serializeSubOrderForSeller,
  serializeOrderForAdmin,
  serializeCheckout,
};
