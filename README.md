# Kotuwa Marketplace

Multi-vendor marketplace with a built-in POS, in English, Sinhala and Tamil. See `PLAN.md` for the design.

| Part | Folder | Port |
|------|--------|------|
| API (Express + MongoDB) | `server/` | 5050 |
| Website (Next.js 16) | `client/` | 3001 |
| Local MongoDB (no Docker) | `server/.mongo-data` | 27017 |

The website forwards `/api/*` to the API, so open only **http://localhost:3001** in the browser.

## First-time setup

```bash
cd server
npm install
cp .env.example .env          # then fill in the two JWT secrets (command is in the file)

cd ../client
npm install
cp .env.example .env.local    # JWT_ACCESS_SECRET must equal the one in server/.env
```

## Running (3 terminals)

```bash
# 1. Database (first run downloads MongoDB, ~100 MB). Keep it open. Ctrl+C to stop.
cd server && npm run db:dev

# 2. API
cd server
npm run seed:districts        # once
npm run seed:admin            # once, after setting ADMIN_* in server/.env
npm run dev

# 3. Website
cd client && npm run dev      # http://localhost:3001
```

You can use MongoDB Atlas instead of step 1: set `MONGODB_URI` in `server/.env` to your Atlas URI.

Image uploads need Cloudinary: fill in `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `server/.env` (free account at cloudinary.com → Dashboard). Without them everything else works, and uploads say "not set up yet".

In development, emails are **not sent**. They are printed in the API terminal (terminal 2), including the verification and reset links. To send real email, fill in the `SMTP_*` settings.

### Demo data (development only)

`npm run seed:demo` (in `server/`) adds demo shops and products. All demo accounts use the password `Demo12345!`:

- `seller@demo.kotuwa.lk`: approved shop "Lanka Craft House"
- `seller2@demo.kotuwa.lk`: shop waiting for admin approval
- `customer@demo.kotuwa.lk`: a customer

It refuses to run when `NODE_ENV=production`.

### Deployment notes

- Only the website should be public. Keep the API private and reach it through the website's `/api` rewrite.
- Put the website behind a reverse proxy (Vercel, nginx, Cloudflare…) that sets `X-Forwarded-For`. Rate limits use the last entry of that header.
- Run with `NODE_ENV=production` and HTTPS, so cookies are marked `Secure`.

## Tests

```bash
cd server && npm test
```

Tests use their own throwaway database. They don't need terminal 1 running.

## Phase status

- [x] 1. Setup, auth (JWT + refresh rotation), RBAC, security basics, i18n
- [x] 2. Seller shops, products, Cloudinary
- [x] 3. Storefront and cart
- [x] 4. Checkout, split orders, COD
- [ ] 5. Delivery and tracking
- [ ] 6. Seller center
- [ ] 7. POS
- [ ] 8. Admin panel
- [ ] 9. Reviews and polish
