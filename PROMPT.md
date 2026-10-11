# Multi-Vendor Marketplace: Full Build Prompt

Build a multi-vendor marketplace (like Daraz / AliExpress) where any person can open a shop and sell, and anyone can buy. Each seller also gets a built-in POS system for their physical shop. The site must support English, Sinhala and Tamil. Build BOTH the frontend and the backend.

## Tech stack
- Frontend: Next.js (App Router) + Tailwind CSS + next-intl for translations
- Backend: Node.js + Express (separate /server folder, REST API)
- Database: MongoDB with Mongoose
- Image storage: Cloudinary
- Auth: JWT with roles (super_admin, seller, seller_cashier, rider, customer)
- Email: Nodemailer (configurable provider via .env)
- Tests: Jest + Supertest

## Languages: English, Sinhala, Tamil
- Language switcher in the header, saved per user
- All UI text in translation files (en.json, si.json, ta.json), never hard-coded
- Products: seller can enter name/description in each language (English required, others optional, fall back to English)
- Use Noto Sans Sinhala and Noto Sans Tamil fonts
- Receipts and emails must display correctly in all 3 languages

## Modules

### 1. Storefront
Anyone can browse; login is needed only at checkout.
- Home, categories, search/filter/sort
- Product page with seller info and reviews
- Multi-seller cart, checkout, order tracking, wishlist

### 2. Seller center
- Register and open a shop (shop name, logo, banner, description)
- Product CRUD with variants (size/color), Cloudinary images, stock management
- Own orders, mark packed/shipped/delivered
- Earnings and payout requests
- Staff/cashier accounts

### 3. POS (inside seller center, each seller sees only their own shop)
- Fast product search and barcode/SKU input
- Billing screen with quantity edit, per-item and whole-bill discounts
- Cash / card payment with change calculation
- Printable receipt (shop name, items, total, date, cashier)
- Hold and resume bills
- Daily sales report and cashier-wise report
- POS sales and online orders reduce the SAME stock, so stock never goes out of sync
- Low stock alerts
- Works with keyboard and barcode scanner, layout fits tablets
- POS sales are completed immediately and need no delivery

### 4. Super admin panel
- Approve/suspend sellers, approve products, manage categories
- View all orders, commission % per category
- Payout approvals, disputes/refunds
- Site-wide stats

### 5. Orders
- One checkout splits into sub-orders per seller
- Each seller sees only their own sub-orders
- Commission is calculated automatically on online orders (POS sales are not commissioned unless I say otherwise)

### 6. Payments
- Cash on Delivery first
- Clean payment interface so PayHere can be added later

### 7. Reviews and ratings
- Only buyers can review
- Seller ratings

### 8. Delivery and tracking
- Delivery methods per seller: (a) seller delivers by themselves, (b) third-party courier. Admin can enable/disable each method.
- Shipping fee by district and weight. Admin sets default rates, sellers can set their own rates. Free-shipping threshold option.
- Sri Lanka address format: name, phone, address, city, district, province, postal code, with district/city dropdowns
- Sub-order status flow: Placed → Confirmed → Packed → Shipped → Out for Delivery → Delivered. Also: Cancelled, Delivery Failed, Return Requested, Returned.
- Every status change is saved in a tracking history (status, time, note, who changed it) and shown to the customer as a timeline
- Seller enters courier name and tracking number when shipping, with a "Track with courier" link
- Public tracking page: anyone enters Order ID + phone number to see the timeline (no login)
- Multi-seller orders: each sub-order has its own tracking, the customer sees all of them under one order
- Cash on Delivery: delivery person marks "Delivered" and "Cash collected". Show COD pending amounts to seller and admin.
- Failed delivery: reason + re-attempt option (max 2 attempts), then return to seller
- Notifications: email on every status change, in the customer's chosen language. Clean notification interface so SMS/WhatsApp can be added later.
- Courier provider module: write a clean interface with a manual provider now, so Pronto/Domex/Koombiyo APIs can be added later without changing other code
- Rider role: sees assigned deliveries on a mobile-friendly page, updates status, takes a delivery photo/signature as proof
- Admin: view all deliveries, assign courier/rider, handle delayed or failed deliveries, delivery performance report
- Seller earnings are released only after the order is Delivered and the return period has passed

### 9. Security and Role-Based Access Control (RBAC)

**Authentication (JWT)**
- Short-lived access token (15 minutes) + long-lived refresh token (7 days)
- Store tokens in httpOnly, secure, sameSite cookies (NOT localStorage)
- Refresh token rotation: issue a new refresh token on every refresh and invalidate the old one
- Store refresh tokens (hashed) in MongoDB so they can be revoked on logout or password change
- Passwords hashed with bcrypt (salt rounds 12), minimum 8 characters
- Login rate limiting and account lockout after 5 failed attempts (15 minutes)
- Email verification on register, and a secure password reset flow (token expires in 1 hour)
- JWT secrets only in .env, access and refresh tokens use different secrets
- Register API must never allow choosing role=super_admin. Create the first admin with a seed script.

**Authorization (RBAC)**
- Roles: super_admin, seller, seller_cashier, rider, customer
- Middleware: authenticate (verifies token) and authorizeRoles(...roles) (checks role)
- Define a permissions map in one file (role → allowed actions) and use it everywhere
- Ownership checks: a seller can only read or edit their OWN products, orders, POS bills and reports. A customer sees only their OWN orders. A rider sees only assigned deliveries. Always check ownership in the backend, never trust the frontend.
- seller_cashier can only use POS and cannot see earnings, payouts or product costs
- Seller accounts must be approved by admin before they can sell
- Every protected API route has both authenticate and authorizeRoles applied

**Frontend protection**
- Next.js middleware protects /admin/*, /seller/*, /pos/*, /rider/* and redirects to login when not allowed
- Hide menu items and buttons the user's role cannot use (UX only, the real protection is the backend)
- Auth context that loads the current user and handles automatic token refresh

**API security**
- helmet, cors (only my frontend domain), express-rate-limit
- express-mongo-sanitize, xss protection, hpp
- CSRF protection (sameSite=strict plus a custom header check, or a CSRF token)
- Validate all inputs with Zod or Joi on every route
- Never return password hashes or tokens in API responses
- File upload validation (type and size limit) before Cloudinary
- Central error handler that hides internal details in production
- Audit log (who, what, when) for sensitive actions: price changes, payouts, role changes, refunds, seller approval
- Payments and stock changes use MongoDB transactions to prevent double-spending and negative stock

## Code style
- Easy for a beginner to read
- Clear variable and function names
- A short comment on every function
- One function does one job
- Simple, clear approach over clever tricks
- Folder structure: routes, controllers, models, middleware, services

## Rules
- Do NOT build everything at once. First give me a plan: folder structure, database schemas, how multi-seller orders work, how POS and online stock stay in sync, and how auth/RBAC works. Wait for my approval.
- Then build phase by phase:
  1. Setup + auth (JWT, refresh tokens, RBAC middleware) + security basics + i18n
  2. Seller shops + products + Cloudinary
  3. Storefront + cart
  4. Checkout + split orders + COD
  5. Delivery and tracking
  6. Seller center
  7. POS
  8. Admin panel
  9. Reviews + polish
- After each phase, tell me how to run and test it, then wait for me before continuing.
- After each phase, review it for security problems (missing role checks, missing ownership checks, unvalidated input) and fix them before moving on.
- Write a short Jest + Supertest test for each role proving what it can and cannot access.
- Use .env for all secrets (MongoDB URI, JWT secrets, Cloudinary keys, email settings) and include a .env.example.
- Include a seed script for the first super_admin and the Sri Lanka districts list.
