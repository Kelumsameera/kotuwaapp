const crypto = require('crypto');
const { CSRF, createUser, createLoggedInUser, loginAs } = require('./auth');
const { createShopFor, createCategory, createListedProduct } = require('./catalog');

const ADDRESS = {
  fullName: 'Kumari Silva',
  phone: '0771234567',
  addressLine1: '10 Lake Road',
  city: 'Kandy',
  district: 'kandy',
  postalCode: '20000',
};

// Places a real order through the API: one shop, one product (Rs 1,000, stock 5), quantity 2.
// Returns logged-in agents for the customer and seller plus the order numbers.
async function placeTestOrder(app, { customerOverrides } = {}) {
  const sellerUser = await createUser('seller');
  const shop = await createShopFor(sellerUser, 'approved');
  const product = await createListedProduct(shop, await createCategory());
  const seller = await loginAs(app, sellerUser);

  const customer = await createLoggedInUser(app, 'customer', customerOverrides);
  const addressResponse = await customer.agent.post('/api/users/me/addresses').set(...CSRF).send(ADDRESS);
  const addressId = addressResponse.body.addresses[0].id;

  await customer.agent
    .post('/api/cart/items')
    .set(...CSRF)
    .send({ productId: String(product._id), variantId: String(product.variants[0]._id), quantity: 2 });
  const preview = await customer.agent.post('/api/checkout/preview').set(...CSRF).send({ addressId });
  const placed = await customer.agent.post('/api/checkout/place-order').set(...CSRF).send({
    addressId,
    paymentMethod: 'cod',
    expectedTotal: preview.body.checkout.grandTotal,
    idempotencyKey: crypto.randomUUID(),
  });

  const orderNumber = placed.body.orderNumber;
  return {
    shop,
    product,
    seller,
    sellerUser,
    customer: customer.agent,
    customerUser: customer.user,
    orderNumber,
    subOrderNumber: `${orderNumber}-1`,
  };
}

// Moves a sub-order through statuses as the seller. steps: [{ status, ...details }]
async function sellerSteps(seller, subOrderNumber, steps) {
  let response;
  for (const step of steps) {
    response = await seller.patch(`/api/seller/orders/${subOrderNumber}/status`).set(...CSRF).send(step);
    if (response.status !== 200) {
      throw new Error(`${step.status} failed: ${response.status} ${JSON.stringify(response.body)}`);
    }
  }
  return response;
}

// The usual path to "out for delivery" with the seller delivering it themselves.
const TO_OUT_FOR_DELIVERY = [
  { status: 'confirmed' },
  { status: 'packed' },
  { status: 'shipped', method: 'self' },
  { status: 'out_for_delivery' },
];

module.exports = { ADDRESS, placeTestOrder, sellerSteps, TO_OUT_FOR_DELIVERY };
