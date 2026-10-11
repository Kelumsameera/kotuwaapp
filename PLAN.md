# Kotuwa Marketplace: Build Plan (approved 2026-10-11)

This plan covers what PROMPT.md asks for before any code: the folder structure, database schemas, how multi-seller orders work, how POS and online stock stay in sync, and how auth/RBAC works. Nothing is built until you approve it.

---

## 0. Key decisions (please confirm or change)

| # | Decision | My default |
|---|----------|-----------|
| 1 | Language | **Plain JavaScript** (no TypeScript), which is easier for a beginner to read |
| 2 | Repo layout | `/client` (Next.js 16, port 3001) and `/server` (Express, port 5050) side by side, each with its own `package.json` |
| 3 | Money | Stored as **integer cents (LKR × 100)** so totals never have float rounding errors. Display helper formats it as `Rs 1,250.00` |
| 4 | Same-origin API | Next.js **rewrites `/api/*` → Express**. The browser only ever talks to one domain, so `sameSite=strict` cookies work and Next middleware can read the access-token cookie |
| 5 | Locale routing | **Cookie-based, with no URL prefix** (`/products/x`, not `/si/products/x`). The `NEXT_LOCALE` cookie is synced to `user.preferredLanguage`. This keeps `/admin/*`, `/seller/*` and the other paths exactly as specified |
| 6 | When stock is taken | **At order placement** (COD). Cancellation or return gives it back |
| 7 | Commission | Online orders only, at the **category rate snapshotted at order time**. Not charged on shipping fees. Not charged on POS sales |
| 8 | Return period | **7 days** after Delivered (admin setting). Earnings are released after that |
| 9 | Validation | **Zod** |
| 10 | MongoDB | Transactions need a **replica set**. Atlas (free tier) works out of the box. No Docker: locally, `npm run db:dev` starts a single-node replica set using `mongodb-memory-server` (data kept in `server/.mongo-data`), or point `MONGODB_URI` at Atlas. Tests use `mongodb-memory-server` replica set |
| 11 | Background jobs | `node-cron` inside the server for earnings release, delayed-delivery flags and low-stock digests |

---

## 1. Folder structure

```
kotuwaapp/
├── PROMPT.md, PLAN.md, README.md
├── client/                         # Next.js App Router
│   ├── messages/ en.json si.json ta.json
│   ├── src/proxy.js                # route protection (Next 16 renamed middleware to proxy)
│   ├── next.config.js              # rewrites /api -> server
│   ├── src/
│   │   ├── app/
│   │   │   ├── (store)/            # home, category, search, product, cart, checkout, orders, wishlist, track
│   │   │   ├── (auth)/             # login, register, verify-email, forgot/reset-password
│   │   │   ├── seller/             # dashboard, shop, products, orders, earnings, payouts, staff, shipping
│   │   │   ├── pos/                # billing screen, held bills, reports
│   │   │   ├── rider/              # assigned deliveries (mobile first)
│   │   │   └── admin/              # sellers, products, categories, orders, deliveries, payouts, disputes, stats
│   │   ├── components/             # ui/, layout/, product/, cart/, pos/, tracking/ ...
│   │   ├── context/AuthContext.js  # current user + silent token refresh
│   │   ├── lib/ apiClient.js, formatMoney.js, pickLanguage.js, roles.js
│   │   └── i18n/ request.js        # next-intl config
└── server/
    ├── .env.example
    ├── src/
    │   ├── app.js                  # express app (security middleware, routes, error handler)
    │   ├── server.js               # connect DB, start cron, listen
    │   ├── config/                 # env.js (validated with zod), db.js, cloudinary.js, mailer.js
    │   ├── constants/              # roles.js, permissions.js, orderStatus.js, districts.js
    │   ├── models/                 # one file per Mongoose model (section 2)
    │   ├── routes/                 # auth, users, shops, products, categories, cart, checkout, orders,
    │   │                           # tracking, rider, pos, seller, admin, reviews, uploads
    │   ├── controllers/            # thin: read request -> call service -> send response
    │   ├── services/
    │   │   ├── authService, tokenService, stockService, orderService, commissionService,
    │   │   ├── shippingService, earningsService, posService, auditService, reportService
    │   │   ├── payments/   PaymentProvider.js (interface), codProvider.js, index.js (registry)
    │   │   ├── couriers/   CourierProvider.js (interface), manualProvider.js, index.js
    │   │   └── notifications/ NotificationChannel.js, emailChannel.js, notify.js, templates/{en,si,ta}
    │   ├── middleware/             # authenticate, authorizeRoles, loadMyShop, requireApprovedShop,
    │   │                           # validate, csrfGuard, rateLimiters, upload, errorHandler
    │   ├── validators/             # zod schemas per route group
    │   ├── jobs/                   # releaseEarnings, flagDelayedDeliveries, lowStockDigest
    │   └── utils/                  # asyncHandler, AppError, money, serialize (strips secrets)
    ├── scripts/ seedAdmin.js, seedDistricts.js
    └── tests/                      # jest + supertest, one file per role + feature tests
```

---

## 2. Database schemas (Mongoose)

All models have `timestamps: true`. Multi-language text uses `{ en: String (required), si: String, ta: String }`. A helper `pickLanguage(field, lang)` falls back to `en`.

**User**
`name, email (unique, lowercase), phone, passwordHash (select:false), role (enum of 5 roles), preferredLanguage (en|si|ta), isEmailVerified, emailVerifyTokenHash, emailVerifyExpires, passwordResetTokenHash, passwordResetExpires, failedLoginCount, lockUntil, passwordChangedAt, shop (ref Shop, for seller_cashier), isActive, addresses [Address], wishlist [ref Product]`

**Address** (embedded)
`fullName, phone, addressLine1, addressLine2, city, district, province, postalCode, isDefault`

**RefreshToken**
`user, tokenHash (sha256), family (uuid), expiresAt (TTL index), revokedAt, replacedBy, createdByIp, userAgent`

**District** (seeded)
`name {en,si,ta}, province {en,si,ta}, cities [{ name {en,si,ta}, postalCode }]` (25 districts, 9 provinces)

**Shop**
`owner (ref User, unique), name, slug, logo {url, publicId}, banner {…}, description {en,si,ta}, phone, address, status (pending|approved|suspended|rejected), suspendReason, deliveryMethods { selfDelivery: bool, courier: bool }, freeShippingThreshold, returnPolicyDays, ratingAverage, ratingCount, lowStockThreshold (default 5)`

**Category**
`name {en,si,ta}, slug, parent (ref Category), image, commissionPercent, isActive, sortOrder`

**Product**
```
shop, category, name {en,si,ta}, description {en,si,ta}, slug, images [{url, publicId}],
status (draft|pending|approved|rejected), rejectReason, isActive,
weightGrams, ratingAverage, ratingCount,
variants: [{
  _id, sku (unique per shop), barcode, options { size, color },
  price, compareAtPrice, costPrice (hidden from cashiers & public),
  stock (>= 0, the ONLY stock number), lowStockAlertSentAt
}]
```
Indexes: `{shop, 'variants.sku'}`, `{shop, 'variants.barcode'}`, text index on names for search.

**StockMovement** (audit trail of every stock change)
`shop, product, variantId, change (+/-), stockAfter, reason (online_order|pos_sale|order_cancelled|order_returned|pos_void|manual_adjust), refId, refModel, by (user)`

**Cart**
`user (unique), items [{ product, variantId, quantity }]`. Prices are always re-read from Product at checkout and never trusted from the cart. Guests keep the cart in localStorage, and it merges into the server cart at login.

**Order** (parent, one per checkout)
`orderNumber (e.g. KT-250114-000123, unique), customer, shippingAddress (snapshot), paymentMethod (cod), paymentStatus, itemsTotal, shippingTotal, grandTotal, language (for emails), subOrders [ref SubOrder]`

**SubOrder** (one per seller in that checkout)
```
order, orderNumber, subOrderNumber (KT-…-A, -B), shop, customer,
items [{ product, variantId, sku, nameSnapshot {en,si,ta}, options, unitPrice, quantity,
         lineTotal, commissionPercent, commissionAmount }],
itemsSubtotal, shippingFee, total, commissionTotal, sellerNet,
status (placed|confirmed|packed|shipped|out_for_delivery|delivered|cancelled|
        delivery_failed|return_requested|returned),
trackingHistory [{ status, note, at, by (user), byRole }],
delivery {
  method (self|courier), courierName, trackingNumber, trackingUrl, provider ('manual'),
  rider (ref User), attempts (0-2), failReasons [String],
  proof { photo {url,publicId}, signature {url,publicId}, at },
  codAmount, codCollected, codCollectedAt, codCollectedBy, deliveredAt
},
returnRequest { reason, requestedAt, resolution }
```

**Earning** (seller ledger, one per delivered/returned sub-order)
`shop, subOrder, gross, commission, net, status (pending|available|paid|reversed), releaseAt, payout`

**Payout**
`shop, amount, status (requested|approved|rejected|paid), bankDetails snapshot, requestedBy, reviewedBy, note, earnings [ref Earning]`

**ShippingRate**
`owner ('admin' | shop id), district (null = default for all districts), baseFee (first kg), extraPerKg`

**PlatformSettings** (single document)
`deliveryMethodsEnabled { selfDelivery, courier }, returnPeriodDays, defaultFreeShippingThreshold, posCommissionPercent (0)`

**PosSale** (POS bill)
```
shop, billNumber, cashier, status (held|completed|voided),
items [{ product, variantId, sku, name, unitPrice, quantity, itemDiscount, lineTotal }],
billDiscount, subtotal, total, payment { method (cash|card), cashReceived, change, cardRef },
heldLabel, completedAt, voidedBy, voidReason
```

**Review**
`product, shop, customer, subOrder, rating 1-5, comment, sellerRating 1-5, isHidden`. Unique on `(customer, product, subOrder)`.

**Dispute**
`subOrder, customer, shop, type (refund|return|other), reason, status (open|resolved|rejected), refundAmount, messages [{by, text, at}], resolvedBy`

**AuditLog**
`actor, actorRole, action (e.g. product.price_change, payout.approve, user.role_change, refund.issue, shop.approve), targetModel, targetId, before, after, ip, at`

**Counter**: used to generate sequential order, bill and payout numbers atomically.

---

## 3. How multi-seller orders work

1. Customer clicks **Place order**. The server reloads the cart and re-reads every product and variant (current price, `approved` and active status, shop `approved`).
2. Items are **grouped by shop**. For each shop, `shippingService` calculates the fee (section 3a), and `commissionService` snapshots each item's category commission %.
3. Inside **one MongoDB transaction**:
   - `stockService.takeStock(items, session)` reduces stock (section 4). If any item is short, the whole transaction aborts and the customer sees which item is short.
   - Create 1 `Order` and N `SubOrder`s, each with `status: placed` and its first trackingHistory entry.
   - `paymentProvider('cod').createPayment(order)` records "pending, collect on delivery".
   - Clear the cart.
4. After commit, `notify()` emails the customer (in `order.language`) and each seller.
5. Each seller only queries `SubOrder.find({ shop: req.shop._id })`. The customer sees `Order` with all its sub-orders, each with its own timeline.
6. **Earnings:** when a sub-order is `delivered`, an `Earning` is created with `status: pending, releaseAt = deliveredAt + returnPeriodDays`. A nightly job flips it to `available` unless a return or dispute is open. Sellers can request payouts only from `available` earnings.
7. **Cancellation:** allowed until `packed`, and returns stock in a transaction. A **return** (`returned`) also returns stock and reverses the earning.

**3a. Shipping fee:** `weight = Σ(item weight × qty)`. Rate lookup order: shop rate for the district → shop default → admin rate for the district → admin default. `fee = baseFee + extraPerKg × ceil(max(0, kg − 1))`. The fee is 0 if the shop subtotal is at least the shop's (or platform's) free-shipping threshold.

**Status rules** live in one place, `constants/orderStatus.js`, as an allowed-transitions map and a "who may do it" map, e.g.
`placed→confirmed|cancelled (seller)`, `packed→shipped (seller, requires courierName+trackingNumber if courier)`, `out_for_delivery→delivered|delivery_failed (rider/seller)`, `delivery_failed→out_for_delivery (attempts < 2) | returned`. Every change goes through **one function**, `orderService.changeStatus()`, which validates the transition, appends to trackingHistory and triggers notifications.

---

## 4. How POS and online stock stay in sync

- There is **one stock number per variant** (`Product.variants[].stock`). POS and online both change only that number, and **only through `stockService`**. No other code is allowed to touch `stock`.
- The decrease is a single **atomic conditional update** that cannot go negative:
  ```js
  Product.updateOne(
    { _id: productId, variants: { $elemMatch: { _id: variantId, stock: { $gte: qty } } } },
    { $inc: { 'variants.$.stock': -qty } },
    { session }
  )
  ```
  If `modifiedCount === 0`, there wasn't enough stock (someone else bought it a millisecond earlier), so the transaction aborts.
- Every change also writes a `StockMovement` row in the same transaction, which gives a full history of who changed what.
- **Held POS bills do not reserve stock.** Stock is taken when the bill is completed, so a held bill can never lock stock forever. On resume, quantities are re-checked.
- After each decrease, if `stock <= shop.lowStockThreshold`, a low-stock alert is raised (dashboard badge + email digest).
- Concurrency test: two parallel checkouts for the last item mean exactly one succeeds. This is included in the tests.

---

## 5. How auth and RBAC work

**Tokens**
- Login returns two **httpOnly, secure, sameSite=strict** cookies:
  - `access_token`: JWT, 15 min, `JWT_ACCESS_SECRET`, payload `{ sub, role, shopId }`
  - `refresh_token`: random 64-byte string, 7 days, path `/api/auth`, stored **sha256-hashed** in `RefreshToken`. It is signed as a JWT with `JWT_REFRESH_SECRET` and holds the id and family.
- `POST /api/auth/refresh` checks the hash. It **revokes the old token and issues a new one** (rotation). If a revoked token is reused, the **whole family is revoked** (theft detection).
- Logout revokes the current token. A password change or reset revokes all of the user's tokens and sets `passwordChangedAt`, and access tokens issued before that are rejected.
- bcrypt with 12 salt rounds. Password minimum is 8 characters.
- Login rate limit (by IP + email). 5 failures set `lockUntil = now + 15 min`.
- Email verification token and password reset token (1 hour) are random, stored hashed and single use. "Forgot password" always answers the same way, so it doesn't reveal which emails exist.
- The register schema only accepts `customer` or `seller`. `super_admin` is created by `npm run seed:admin`. Cashiers are created by their seller. Riders are created by admin.

**RBAC**
- `constants/permissions.js` is the single map of role → actions, e.g.
  ```js
  seller:         ['product:manage', 'order:manageOwn', 'pos:use', 'pos:reports', 'earnings:view', 'payout:request', 'staff:manage', ...]
  seller_cashier: ['pos:use', 'product:lookup']
  rider:          ['delivery:viewAssigned', 'delivery:update']
  customer:       ['cart:use', 'order:place', 'order:viewOwn', 'review:create', ...]
  super_admin:    ['admin:*' ...]
  ```
  `rolesWith('pos:use')` turns that into a role list, so every route reads like
  `router.post('/pos/sales', authenticate, authorizeRoles(...rolesWith('pos:use')), loadMyShop, requireApprovedShop, validate(schema), posController.completeSale)`.
- **Ownership is checked in services, never trusted from the client.** Every seller and cashier query is scoped with `{ shop: req.shop._id }`, where `req.shop` comes from the token's user, never from the request body. Customer queries are scoped with `{ customer: req.user._id }`, and rider queries with `{ 'delivery.rider': req.user._id }`. A non-owned id returns **404** (not 403), so ids can't be probed.
- **Cashier restrictions:** a serializer strips `costPrice` and the earnings fields. Cashier routes are limited to POS, and the backend refuses earnings and payout routes for them.
- `requireApprovedShop` blocks selling actions until admin approves the shop.

**Frontend**
- `src/proxy.js` (Next.js 16 name for middleware) reads `access_token`, verifies it with `jose`, and checks the role for `/admin/*`, `/seller/*`, `/pos/*` and `/rider/*`. If the token is missing or expired, it redirects to `/login?next=…`. The login page first tries a silent refresh, then bounces back.
- `AuthContext` loads `/api/auth/me`. `apiClient` retries once after `/api/auth/refresh` on a 401, and sends the `X-Requested-With: kotuwa` header.
- Menus and buttons are hidden with a `can(user, action)` helper that uses the same permission names (UX only).

**API security**
`helmet`, `cors` (origin = `CLIENT_URL`, credentials), `express-rate-limit` (global + stricter on auth and public tracking), `express-mongo-sanitize`, `xss-clean` style sanitizing of strings, `hpp`. CSRF is handled by **sameSite=strict + a required custom header** on all non-GET requests. Zod validation runs on body, params and query of every route. `multer` memory storage checks type (jpeg/png/webp) and size (2 MB), plus a magic-byte check, before Cloudinary. A central `errorHandler` hides the stack and message in production. `auditService.log()` runs on price changes, payouts, role changes, refunds and shop approval. Response serializers never include `passwordHash` or token fields.

---

## 6. Pluggable interfaces (for later integrations)

```js
// services/payments/PaymentProvider.js
createPayment(order) / handleCallback(req) / refund(payment, amount)
// -> codProvider now; payhereProvider later, registered in payments/index.js

// services/couriers/CourierProvider.js
createShipment(subOrder) / getTrackingUrl(trackingNumber) / fetchStatus(trackingNumber)
// -> manualProvider now; prontoProvider/domexProvider/koombiyoProvider later

// services/notifications/NotificationChannel.js
send({ user, templateKey, data, language })
// -> emailChannel now; smsChannel/whatsappChannel later. notify() loops over enabled channels.
```

---

## 7. Phases (I'll stop after each one for your go-ahead)

1. **Setup + auth + RBAC + security basics + i18n.** Includes both apps, env config, the user/refresh-token models, register/login/refresh/logout/verify/reset, the permissions map, the security middleware, the next-intl switcher, fonts, the seed scripts, and role-access tests.
2. **Seller shops + products + Cloudinary.** Covers shop registration and approval state, categories, product CRUD with variants and images, and stockService.
3. **Storefront + cart.** Home, categories, search/filter/sort, product page, guest and server cart, wishlist.
4. **Checkout + split orders + COD.** Addresses with district and city dropdowns, shipping calculation, transaction checkout, order pages, emails.
5. **Delivery and tracking.** Status machine, timeline, courier info, public tracking, rider app with proof, COD collection, failed attempts, earnings release job.
6. **Seller center.** Dashboard, order management, earnings, payouts, staff and cashiers, shipping rates, low-stock alerts.
7. **POS.** Billing screen, barcode and keyboard flow, discounts, cash/card with change, held bills, receipt printing, daily and cashier reports.
8. **Admin panel.** Approvals, categories and commission, all orders and deliveries, rider/courier assignment, payouts, disputes and refunds, stats, delivery performance, audit log viewer.
9. **Reviews + polish.** Verified-buyer reviews, seller ratings, translation completeness check, accessibility and performance pass.

Each phase ends with run and test instructions, a security review pass (role checks, ownership, validation), and Jest + Supertest tests showing what each role can and cannot access.
