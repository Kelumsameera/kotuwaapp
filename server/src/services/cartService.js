const Cart = require('../models/Cart');
const { findListedProductsByIds } = require('./catalogService');
const { AppError, badRequest, notFound } = require('../utils/AppError');

const MAX_QUANTITY = 99;
const MAX_LINES = 50;

// Finds a listed product's variant, or throws "not available".
async function findListedVariant(productId, variantId) {
  const [product] = await findListedProductsByIds([productId]);
  const variant = product?.variants.id(variantId);
  if (!variant) throw notFound('PRODUCT_NOT_AVAILABLE', 'This product is no longer available.');
  return { product, variant };
}

// Throws if the wanted quantity is more than what is in stock.
function checkStock(variant, quantity) {
  if (quantity > variant.stock) {
    throw new AppError(409, 'NOT_ENOUGH_STOCK', `Only ${variant.stock} left in stock.`, { available: variant.stock });
  }
}

// Builds what the cart page shows from raw [{ product, variantId, quantity }] items:
// fresh names and prices, grouped by shop, with a warning on items that can't be bought.
async function buildCartView(rawItems) {
  const products = await findListedProductsByIds(rawItems.map((item) => item.product));
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const shops = new Map();
  let itemCount = 0;
  let subtotal = 0;

  for (const item of rawItems) {
    const product = productsById.get(String(item.product));
    const variant = product?.variants.id(item.variantId);

    let problem = null;
    if (!variant) problem = 'UNAVAILABLE';
    else if (variant.stock < item.quantity) problem = variant.stock === 0 ? 'OUT_OF_STOCK' : 'NOT_ENOUGH_STOCK';

    const shopId = product ? String(product.shop._id) : 'unavailable';
    if (!shops.has(shopId)) {
      shops.set(shopId, {
        shopId: product ? shopId : null,
        shopName: product ? product.shop.name : '',
        shopSlug: product ? product.shop.slug : '',
        items: [],
        subtotal: 0,
      });
    }
    const group = shops.get(shopId);

    const line = {
      productId: String(item.product),
      variantId: String(item.variantId),
      quantity: item.quantity,
      problem,
      slug: product?.slug || '',
      name: product?.name || { en: '' },
      image: product?.images[0] || null,
      options: variant ? { size: variant.options?.size || '', color: variant.options?.color || '' } : {},
      unitPrice: variant?.price ?? 0,
      availableStock: variant?.stock ?? 0,
      lineTotal: variant ? variant.price * item.quantity : 0,
    };
    group.items.push(line);

    if (!problem) {
      group.subtotal += line.lineTotal;
      subtotal += line.lineTotal;
      itemCount += item.quantity;
    }
  }

  return { shops: [...shops.values()], itemCount, subtotal };
}

// Loads (or starts) the customer's cart.
async function loadCart(userId) {
  return (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] });
}

// The customer's cart as the cart page shows it.
async function getCartView(userId) {
  const cart = await loadCart(userId);
  return buildCartView(cart.items);
}

// Adds a quantity of a variant (merging with what is already in the cart).
async function addItem(userId, { productId, variantId, quantity }) {
  const { variant } = await findListedVariant(productId, variantId);
  const cart = await loadCart(userId);

  const existing = cart.items.find((item) => String(item.variantId) === variantId);
  const newQuantity = (existing?.quantity || 0) + quantity;
  if (newQuantity > MAX_QUANTITY) throw badRequest('QUANTITY_LIMIT', `At most ${MAX_QUANTITY} of one item.`);
  checkStock(variant, newQuantity);

  if (existing) {
    existing.quantity = newQuantity;
  } else {
    if (cart.items.length >= MAX_LINES) throw badRequest('CART_FULL', 'Your cart is full.');
    cart.items.push({ product: productId, variantId, quantity });
  }
  await cart.save();
  return buildCartView(cart.items);
}

// Sets the quantity of a variant that is already in the cart.
async function setQuantity(userId, variantId, quantity) {
  const cart = await loadCart(userId);
  const existing = cart.items.find((item) => String(item.variantId) === variantId);
  if (!existing) throw notFound('NOT_IN_CART', 'This item is not in your cart.');

  const { variant } = await findListedVariant(existing.product, variantId);
  checkStock(variant, quantity);

  existing.quantity = quantity;
  await cart.save();
  return buildCartView(cart.items);
}

// Removes one variant from the cart.
async function removeItem(userId, variantId) {
  const cart = await loadCart(userId);
  cart.items = cart.items.filter((item) => String(item.variantId) !== variantId);
  await cart.save();
  return buildCartView(cart.items);
}

// Moves a guest's browser cart into the account after login.
// Unavailable items are skipped and quantities are capped at what is in stock.
async function mergeGuestItems(userId, guestItems) {
  const cart = await loadCart(userId);
  const products = await findListedProductsByIds(guestItems.map((item) => item.productId));
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  for (const guestItem of guestItems) {
    const variant = productsById.get(guestItem.productId)?.variants.id(guestItem.variantId);
    if (!variant) continue;

    const existing = cart.items.find((item) => String(item.variantId) === guestItem.variantId);
    const wanted = (existing?.quantity || 0) + guestItem.quantity;
    const quantity = Math.min(wanted, variant.stock, MAX_QUANTITY);
    if (quantity < 1) continue;

    if (existing) existing.quantity = quantity;
    else if (cart.items.length < MAX_LINES) cart.items.push({ product: guestItem.productId, variantId: guestItem.variantId, quantity });
  }

  await cart.save();
  return buildCartView(cart.items);
}

// Builds a cart view for a guest from the items kept in their browser (nothing is saved).
function previewGuestCart(guestItems) {
  return buildCartView(
    guestItems.map((item) => ({ product: item.productId, variantId: item.variantId, quantity: item.quantity }))
  );
}

module.exports = { getCartView, addItem, setQuantity, removeItem, mergeGuestItems, previewGuestCart, MAX_QUANTITY, MAX_LINES };
