const SubOrder = require('../models/SubOrder');
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const User = require('../models/User');
const { getPlatformSettings } = require('../models/PlatformSettings');
const { ORDER_STATUS, TRANSITIONS, MAX_DELIVERY_ATTEMPTS } = require('../constants/orderStatus');
const { ROLES } = require('../constants/roles');
const stockService = require('./stockService');
const earningsService = require('./earningsService');
const { getCourierProvider } = require('./couriers');
const { isProofImage } = require('./imageStorage');
const { logAudit } = require('./auditService');
const { notify } = require('./notifications/notify');
const { runInTransaction } = require('../utils/transaction');
const { badRequest, conflict, forbidden, notFound } = require('../utils/AppError');

const S = ORDER_STATUS;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SIGNATURE_BYTES = 80 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Every sub-order status change goes through changeStatus() below.
// It checks the TRANSITIONS table (constants/orderStatus.js), applies the extra rules of
// each step, saves a timeline entry, and keeps stock, earnings and payment in step,
// all in one transaction. Afterwards the customer is emailed in their own language.
// ─────────────────────────────────────────────────────────────────────────────

// Loads a sub-order the person may act on. Anything else gives 404 (so ids can't be probed):
// sellers only their shop's, riders only those assigned to them, customers only their own.
async function findSubOrderFor(actor, shop, subOrderNumber, session) {
  const filter = { subOrderNumber };
  if (actor.role === ROLES.SELLER) filter.shop = shop._id;
  else if (actor.role === ROLES.RIDER) filter['delivery.rider'] = actor._id;
  else if (actor.role === ROLES.CUSTOMER) filter.customer = actor._id;
  else if (actor.role !== ROLES.SUPER_ADMIN) throw forbidden();

  const subOrder = await SubOrder.findOne(filter).session(session || null);
  if (!subOrder) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  return subOrder;
}

// Requires a non-empty text, e.g. a reason.
function requireText(value, code, message) {
  const text = (value || '').trim();
  if (!text) throw badRequest(code, message);
  return text;
}

// Checks a drawn signature: a small PNG sent as a data URL.
function checkSignature(signature) {
  const prefix = 'data:image/png;base64,';
  if (typeof signature !== 'string' || !signature.startsWith(prefix)) {
    throw badRequest('INVALID_SIGNATURE', 'The signature is not a valid image.');
  }
  const bytes = Buffer.from(signature.slice(prefix.length), 'base64');
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng || bytes.length > MAX_SIGNATURE_BYTES) {
    throw badRequest('INVALID_SIGNATURE', 'The signature is not a valid image.');
  }
}

// Shipping: the seller picks how it travels. Couriers need a name and tracking number.
async function applyShipping(subOrder, details, settings) {
  const shop = await Shop.findById(subOrder.shop);
  const allowed = {
    self: settings.deliveryMethods.selfDelivery && shop.deliveryMethods?.selfDelivery !== false,
    courier: settings.deliveryMethods.courier && shop.deliveryMethods?.courier !== false,
  };
  if (!details.method || !allowed[details.method]) {
    throw badRequest('DELIVERY_METHOD_NOT_ALLOWED', 'Choose an allowed delivery method.');
  }

  subOrder.delivery.method = details.method;
  if (details.method === 'courier') {
    const courierName = requireText(details.courierName, 'COURIER_REQUIRED', 'Enter the courier name.');
    const trackingNumber = requireText(details.trackingNumber, 'TRACKING_REQUIRED', 'Enter the tracking number.');
    const provider = getCourierProvider();
    const shipment = await provider.createShipment(subOrder, { courierName, trackingNumber, trackingUrl: details.trackingUrl });
    Object.assign(subOrder.delivery, shipment, { provider: provider.id });
  }
}

// Delivered: records cash and proof, and creates the seller's (pending) earning.
async function applyDelivered({ subOrder, actor, details, settings, session }) {
  const isCod = subOrder.delivery.codAmount > 0;

  if (actor.role === ROLES.RIDER) {
    // A rider hands over the parcel in person, so they must collect the cash and show proof.
    if (isCod && details.cashCollected !== true) {
      throw badRequest('CASH_REQUIRED', 'Collect the cash before marking this delivered.');
    }
    if (!details.photo && !details.signature) {
      throw badRequest('PROOF_REQUIRED', 'Add a photo or signature as proof of delivery.');
    }
  }
  if (details.photo && !isProofImage(subOrder._id, details.photo)) {
    throw badRequest('INVALID_IMAGE', 'That photo was not uploaded for this delivery.');
  }
  if (details.signature) checkSignature(details.signature);

  const now = new Date();
  subOrder.delivery.deliveredAt = now;
  if (details.photo || details.signature) {
    subOrder.delivery.proof = {
      photo: details.photo,
      signature: details.signature,
      hasSignature: Boolean(details.signature),
      at: now,
      by: actor._id,
    };
  }
  if (isCod && details.cashCollected === true) {
    subOrder.delivery.codCollected = true;
    subOrder.delivery.codCollectedAt = now;
    subOrder.delivery.codCollectedBy = actor._id;
  }

  await earningsService.createEarningForDelivery(subOrder, settings.returnPeriodDays, session);
}

// Puts the sub-order's items back into stock (cancelled or returned).
function returnItemsToStock(subOrder, actor, reason, session) {
  const items = subOrder.items.map((item) => ({ productId: item.product, variantId: item.variantId, quantity: item.quantity }));
  return stockService.returnStock(items, { session, reason, refModel: 'SubOrder', refId: subOrder._id, by: actor._id });
}

// The extra rules of each target status. Throws if something required is missing.
async function applyStatusRules({ subOrder, toStatus, actor, note, details, settings, session }) {
  const fromStatus = subOrder.status;

  switch (toStatus) {
    case S.SHIPPED:
      await applyShipping(subOrder, details, settings);
      break;

    case S.OUT_FOR_DELIVERY:
      if (fromStatus === S.DELIVERY_FAILED && subOrder.delivery.attempts >= MAX_DELIVERY_ATTEMPTS) {
        throw conflict('NO_ATTEMPTS_LEFT', 'No delivery attempts left. Return the parcel to the seller.');
      }
      break;

    case S.DELIVERY_FAILED: {
      const reason = requireText(details.failReason || note, 'REASON_REQUIRED', 'Say why the delivery failed.');
      subOrder.delivery.attempts += 1;
      subOrder.delivery.failReasons.push(reason);
      break;
    }

    case S.DELIVERED:
      if (fromStatus === S.RETURN_REQUESTED) {
        // Return refused: the parcel stays delivered and keeps its existing earning.
        requireText(note, 'REASON_REQUIRED', 'Explain why the return was refused.');
      } else {
        await applyDelivered({ subOrder, actor, details, settings, session });
      }
      break;

    case S.CANCELLED:
      if (actor.role === ROLES.CUSTOMER) requireText(note, 'REASON_REQUIRED', 'Please tell us why you are cancelling.');
      subOrder.cancelReason = note;
      await returnItemsToStock(subOrder, actor, 'order_cancelled', session);
      break;

    case S.RETURN_REQUESTED: {
      const reason = requireText(note, 'REASON_REQUIRED', 'Please tell us why you are returning this.');
      const deadline = subOrder.delivery.deliveredAt.getTime() + settings.returnPeriodDays * DAY_MS;
      if (Date.now() > deadline) throw badRequest('RETURN_PERIOD_OVER', 'The return period for this order is over.');
      subOrder.returnRequest = { reason, requestedAt: new Date() };
      break;
    }

    case S.RETURNED:
      await returnItemsToStock(subOrder, actor, 'order_returned', session);
      await earningsService.reverseEarning(subOrder._id, session);
      break;

    default:
      break;
  }
}

// Sets the order's payment status from its sub-orders: "paid" once every active part was
// delivered with cash collected; "failed" if every part was cancelled or returned.
async function refreshPaymentStatus(orderId, session) {
  const subOrders = await SubOrder.find({ order: orderId }).session(session);
  const active = subOrders.filter((subOrder) => ![S.CANCELLED, S.RETURNED].includes(subOrder.status));

  let paymentStatus = 'pending';
  if (active.length === 0) paymentStatus = 'failed';
  else if (active.every((subOrder) => subOrder.status === S.DELIVERED && subOrder.delivery.codCollected)) paymentStatus = 'paid';

  await Order.updateOne({ _id: orderId }, { paymentStatus }, { session });
}

// Emails after a change: the customer always; the seller when the customer cancelled or asked for a return.
async function sendStatusEmails(subOrder, actor, note) {
  const customer = await User.findById(subOrder.customer);
  if (customer) await notify(customer, 'orderStatusChanged', { subOrder, note });

  if (actor.role === ROLES.CUSTOMER) {
    const shop = await Shop.findById(subOrder.shop);
    const owner = shop && (await User.findById(shop.owner));
    if (owner) await notify(owner, 'sellerOrderUpdate', { subOrder, note });
  }
}

// Changes a sub-order's status. actor = the logged-in user; shop = their shop (sellers only).
// details may hold: method, courierName, trackingNumber, trackingUrl, failReason, cashCollected, photo, signature.
async function changeStatus({ actor, shop, subOrderNumber, toStatus, note, details = {} }) {
  const settings = await getPlatformSettings();
  const cleanNote = (note || '').trim() || undefined;

  let subOrder;
  try {
    subOrder = await runInTransaction(async (session) => {
      const found = await findSubOrderFor(actor, shop, subOrderNumber, session);
      const allowedRoles = TRANSITIONS[found.status]?.[toStatus];
      if (!allowedRoles) {
        throw conflict('INVALID_STATUS_CHANGE', `An order that is "${found.status}" cannot become "${toStatus}".`);
      }
      if (!allowedRoles.includes(actor.role)) throw forbidden('STATUS_CHANGE_NOT_ALLOWED', 'You cannot make this change.');

      await applyStatusRules({ subOrder: found, toStatus, actor, note: cleanNote, details, settings, session });

      found.status = toStatus;
      found.trackingHistory.push({ status: toStatus, note: cleanNote, at: new Date(), by: actor._id, byRole: actor.role });
      await found.save({ session });
      await refreshPaymentStatus(found.order, session);
      return found;
    });
  } catch (error) {
    // Someone else changed this order at the same moment.
    if (error.name === 'VersionError') throw conflict('ORDER_CHANGED', 'This order was just updated. Please reload.');
    throw error;
  }

  await sendStatusEmails(subOrder, actor, cleanNote);
  return subOrder;
}

// Marks cash as collected later (e.g. the courier paid the seller after delivery).
async function markCashCollected({ actor, shop, subOrderNumber }) {
  return runInTransaction(async (session) => {
    const subOrder = await findSubOrderFor(actor, shop, subOrderNumber, session);
    if (subOrder.status !== S.DELIVERED || subOrder.delivery.codAmount === 0) {
      throw conflict('INVALID_STATUS_CHANGE', 'Only delivered cash-on-delivery orders can be marked as paid.');
    }
    if (!subOrder.delivery.codCollected) {
      subOrder.delivery.codCollected = true;
      subOrder.delivery.codCollectedAt = new Date();
      subOrder.delivery.codCollectedBy = actor._id;
      await subOrder.save({ session });
      await refreshPaymentStatus(subOrder.order, session);
    }
    return subOrder;
  });
}

// Statuses in which a rider can still be assigned or changed.
const RIDER_ASSIGNABLE = [S.CONFIRMED, S.PACKED, S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERY_FAILED];

// Admin: assigns a rider to a sub-order (or removes the rider with riderId = null).
async function assignRider(req, subOrderNumber, riderId) {
  const subOrder = await SubOrder.findOne({ subOrderNumber });
  if (!subOrder) throw notFound('ORDER_NOT_FOUND', 'Order not found.');
  if (!RIDER_ASSIGNABLE.includes(subOrder.status)) {
    throw conflict('INVALID_STATUS_CHANGE', 'A rider cannot be assigned to this order now.');
  }

  if (riderId) {
    const rider = await User.findOne({ _id: riderId, role: ROLES.RIDER, isActive: true });
    if (!rider) throw badRequest('INVALID_RIDER', 'Choose an active rider.');
  }

  const before = { rider: subOrder.delivery.rider || null };
  subOrder.delivery.rider = riderId || undefined;
  await subOrder.save();

  await logAudit(req, { action: 'delivery.assign_rider', targetModel: 'SubOrder', targetId: subOrder._id, before, after: { rider: riderId } });
  return subOrder;
}

module.exports = { changeStatus, markCashCollected, assignRider, findSubOrderFor, RIDER_ASSIGNABLE };
