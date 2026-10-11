// Fills a DEVELOPMENT database with demo shops, categories and products so the store isn't empty.
// Demo accounts (password Demo12345!):
//   seller@demo.kotuwa.lk     approved shop "Lanka Craft House"
//   seller2@demo.kotuwa.lk    shop "Galle Spice Garden" waiting for admin approval
//   customer@demo.kotuwa.lk   a customer for trying the cart
// Safe to run again: it does nothing if the demo seller already exists.
const env = require('../src/config/env');
const User = require('../src/models/User');
const Shop = require('../src/models/Shop');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { hashPassword } = require('../src/services/authService');
const { recordInitialStock } = require('../src/services/stockService');
const { uniqueSlug } = require('../src/utils/slug');

const DEMO_PASSWORD = 'Demo12345!';

const CATEGORIES = [
  { key: 'clothing', name: { en: 'Clothing', si: 'ඇඳුම්', ta: 'ஆடைகள்' }, commissionPercent: 10 },
  { key: 'sarees', parent: 'clothing', name: { en: 'Sarees', si: 'සාරි', ta: 'சேலைகள்' }, commissionPercent: 10 },
  { key: 'tea', name: { en: 'Tea & Spices', si: 'තේ සහ කුළුබඩු', ta: 'தேநீர் & மசாலா' }, commissionPercent: 8 },
  { key: 'home', name: { en: 'Home & Kitchen', si: 'නිවස සහ මුළුතැන්ගෙය', ta: 'வீடு & சமையலறை' }, commissionPercent: 12 },
  { key: 'electronics', name: { en: 'Electronics', si: 'ඉලෙක්ට්‍රොනික', ta: 'மின்னணு' }, commissionPercent: 6 },
];

// Prices are in cents (Rs 1 = 100).
const LANKA_CRAFT_PRODUCTS = [
  {
    category: 'sarees',
    name: { en: 'Handloom Cotton Saree', si: 'අත්යන්ත්‍ර කපු සාරිය', ta: 'கைத்தறி பருத்திச் சேலை' },
    description: { en: 'Hand-woven in Talagune. Soft pure cotton, 6 yards with blouse piece.', si: 'තලගුනේ අතින් වියන ලද. මෘදු පිරිසිදු කපු, යාර 6 ක් හා හැට්ට රෙද්දක් සහිතයි.' },
    weightGrams: 600,
    variants: [
      { sku: 'SAREE-RED', options: { color: 'Red' }, price: 650000, compareAtPrice: 750000, costPrice: 420000, stock: 6 },
      { sku: 'SAREE-BLUE', options: { color: 'Blue' }, price: 650000, costPrice: 420000, stock: 3 },
      { sku: 'SAREE-GREEN', options: { color: 'Green' }, price: 650000, costPrice: 420000, stock: 0 },
    ],
  },
  {
    category: 'clothing',
    name: { en: 'Batik Sarong', si: 'බතික් සරම', ta: 'பத்திக் சாரம்' },
    description: { en: 'Traditional wax-resist batik, hand-dyed in Kandy.' },
    weightGrams: 350,
    variants: [
      { sku: 'SARONG-M', options: { size: 'M' }, price: 285000, costPrice: 160000, stock: 12 },
      { sku: 'SARONG-L', options: { size: 'L' }, price: 295000, costPrice: 165000, stock: 8 },
    ],
  },
  {
    category: 'home',
    name: { en: 'Clay Cooking Pot', si: 'මැටි හට්ටිය', ta: 'மண் பானை' },
    description: { en: 'Unglazed clay pot for curries. Season before first use.', ta: 'கறிகளுக்கான மண் பானை. முதல் பயன்பாட்டிற்கு முன் பதப்படுத்தவும்.' },
    weightGrams: 1200,
    variants: [{ sku: 'POT-MED', barcode: '4790001000011', price: 145000, costPrice: 70000, stock: 20 }],
  },
  {
    category: 'home',
    name: { en: 'Coconut Shell Bowl Set', si: 'පොල් කටු බඳුන් කට්ටලය', ta: 'தேங்காய் ஓட்டுக் கிண்ணத் தொகுப்பு' },
    description: { en: 'Set of 4 polished coconut shell bowls with wooden spoons.' },
    weightGrams: 500,
    variants: [{ sku: 'BOWL-SET4', barcode: '4790001000028', price: 320000, costPrice: 180000, stock: 4 }],
  },
  {
    category: 'electronics',
    name: { en: 'Wireless Earbuds', si: 'රැහැන් රහිත කන් ඇබ', ta: 'கம்பியில்லா காதணிகள்' },
    description: { en: 'Bluetooth 5.3, 24-hour battery with case, 1-year local warranty.' },
    weightGrams: 150,
    variants: [
      { sku: 'EARBUD-BLK', options: { color: 'Black' }, price: 899000, compareAtPrice: 1099000, costPrice: 600000, stock: 15 },
      { sku: 'EARBUD-WHT', options: { color: 'White' }, price: 899000, costPrice: 600000, stock: 2 },
    ],
  },
];

const GALLE_SPICE_PRODUCTS = [
  {
    category: 'tea',
    name: { en: 'Ceylon Black Tea 400g', si: 'ලංකා කළු තේ 400g', ta: 'இலங்கை கருப்புத் தேநீர் 400g' },
    description: { en: 'High-grown BOPF from Nuwara Eliya estates.' },
    weightGrams: 450,
    variants: [{ sku: 'TEA-400', barcode: '4790002000017', price: 125000, costPrice: 80000, stock: 40 }],
  },
  {
    category: 'tea',
    name: { en: 'True Cinnamon Sticks 100g', si: 'කුරුඳු පොතු 100g', ta: 'இலவங்கப்பட்டை 100g' },
    description: { en: 'Alba-grade Ceylon cinnamon from Galle.' },
    weightGrams: 120,
    variants: [{ sku: 'CINN-100', price: 95000, costPrice: 55000, stock: 30 }],
  },
];

// Creates a verified demo user.
async function createDemoUser(name, email, role) {
  return User.create({ name, email, role, isEmailVerified: true, passwordHash: await hashPassword(DEMO_PASSWORD) });
}

// Creates the demo categories and returns them by key.
async function createCategories() {
  const byKey = {};
  for (const [index, category] of CATEGORIES.entries()) {
    const existing = await Category.findOne({ 'name.en': category.name.en });
    byKey[category.key] =
      existing ||
      (await Category.create({
        name: category.name,
        slug: uniqueSlug(category.name.en, 'category'),
        parent: category.parent ? byKey[category.parent]._id : null,
        commissionPercent: category.commissionPercent,
        sortOrder: index,
      }));
  }
  return byKey;
}

// Creates a shop's products with the given status and records their starting stock.
async function createProducts(shop, owner, products, categories, status) {
  for (const data of products) {
    const product = await Product.create({
      ...data,
      shop: shop._id,
      category: categories[data.category]._id,
      slug: uniqueSlug(data.name.en, 'product'),
      status,
      shopIsApproved: shop.status === 'approved',
    });
    for (const variant of product.variants) await recordInitialStock(product, variant, owner._id);
  }
}

// Fills the database with demo data.
async function seedDemo() {
  if (env.isProduction) {
    console.error('Refusing to add demo data to a production database.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase(env.MONGODB_URI);
  try {
    if (await User.exists({ email: 'seller@demo.kotuwa.lk' })) {
      console.log('Demo data already exists. Nothing to do.');
      return;
    }

    const categories = await createCategories();

    const seller = await createDemoUser('Nimal Perera', 'seller@demo.kotuwa.lk', 'seller');
    const craftShop = await Shop.create({
      owner: seller._id,
      name: 'Lanka Craft House',
      slug: uniqueSlug('Lanka Craft House', 'shop'),
      description: { en: 'Handmade goods from artisans across Sri Lanka.', si: 'ශ්‍රී ලංකාව පුරා ශිල්පීන්ගේ අත්කම් භාණ්ඩ.', ta: 'இலங்கை முழுவதும் உள்ள கைவினைஞர்களின் கைத்தயாரிப்புகள்.' },
      phone: '0771234567',
      address: { addressLine1: '12 Temple Road', city: 'Kandy', district: 'kandy', postalCode: '20000' },
      status: 'approved',
    });
    await createProducts(craftShop, seller, LANKA_CRAFT_PRODUCTS, categories, 'approved');

    const seller2 = await createDemoUser('Fathima Rizwan', 'seller2@demo.kotuwa.lk', 'seller');
    const spiceShop = await Shop.create({
      owner: seller2._id,
      name: 'Galle Spice Garden',
      slug: uniqueSlug('Galle Spice Garden', 'shop'),
      phone: '0712345678',
      address: { addressLine1: '45 Church Street', city: 'Galle', district: 'galle', postalCode: '80000' },
      status: 'pending',
    });
    await createProducts(spiceShop, seller2, GALLE_SPICE_PRODUCTS, categories, 'pending');

    await createDemoUser('Kumari Silva', 'customer@demo.kotuwa.lk', 'customer');

    console.log('Demo data added. Accounts (password Demo12345!):');
    console.log('  seller@demo.kotuwa.lk   (approved shop)');
    console.log('  seller2@demo.kotuwa.lk  (shop waiting for approval)');
    console.log('  customer@demo.kotuwa.lk');
  } finally {
    await disconnectDatabase();
  }
}

seedDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
