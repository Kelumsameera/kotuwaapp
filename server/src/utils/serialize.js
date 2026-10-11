// Turns a User document into the safe shape we send to the browser.
// Only listed fields are copied, so password hashes and tokens can never leak.
function serializeUser(user) {
  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    shop: user.shop ? String(user.shop) : null,
    createdAt: user.createdAt,
  };
}

// Copies { en, si, ta } text without Mongoose extras.
function serializeText(text) {
  if (!text) return { en: '' };
  return { en: text.en || '', si: text.si || undefined, ta: text.ta || undefined };
}

// Copies an image's url and publicId (or null).
function serializeImage(image) {
  return image && image.url ? { url: image.url, publicId: image.publicId } : null;
}

// The shop as its owner or an admin sees it.
function serializeShop(shop) {
  if (!shop) return null;
  return {
    id: String(shop._id),
    owner: String(shop.owner?._id || shop.owner),
    name: shop.name,
    slug: shop.slug,
    description: serializeText(shop.description),
    logo: serializeImage(shop.logo),
    banner: serializeImage(shop.banner),
    phone: shop.phone || '',
    address: {
      addressLine1: shop.address?.addressLine1 || '',
      city: shop.address?.city || '',
      district: shop.address?.district || '',
      postalCode: shop.address?.postalCode || '',
    },
    status: shop.status,
    statusReason: shop.statusReason || '',
    lowStockThreshold: shop.lowStockThreshold,
    freeShippingThreshold: shop.freeShippingThreshold ?? null,
    ratingAverage: shop.ratingAverage,
    ratingCount: shop.ratingCount,
    createdAt: shop.createdAt,
  };
}

// A category, including its commission % (public: shown on seller and admin screens).
function serializeCategory(category) {
  return {
    id: String(category._id),
    name: serializeText(category.name),
    slug: category.slug,
    parent: category.parent ? String(category.parent) : null,
    commissionPercent: category.commissionPercent,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

// One variant. costPrice is only included when includeCost is true (owner seller or admin).
function serializeVariant(variant, includeCost) {
  const result = {
    id: String(variant._id),
    sku: variant.sku,
    barcode: variant.barcode || '',
    options: { size: variant.options?.size || '', color: variant.options?.color || '' },
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    stock: variant.stock,
  };
  if (includeCost) result.costPrice = variant.costPrice ?? null;
  return result;
}

// A product. Pass { includeCost: true } only for the owning seller or an admin,
// never for cashiers or the public.
function serializeProduct(product, { includeCost = false } = {}) {
  return {
    id: String(product._id),
    shop: String(product.shop?._id || product.shop),
    category: String(product.category?._id || product.category),
    name: serializeText(product.name),
    description: serializeText(product.description),
    slug: product.slug,
    images: (product.images || []).map(serializeImage),
    weightGrams: product.weightGrams,
    status: product.status,
    statusReason: product.statusReason || '',
    isActive: product.isActive,
    variants: product.variants.map((variant) => serializeVariant(variant, includeCost)),
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// The shop as shoppers see it (no owner, phone or status details).
function serializePublicShop(shop) {
  if (!shop || !shop.name) return null;
  return {
    id: String(shop._id),
    name: shop.name,
    slug: shop.slug,
    logo: serializeImage(shop.logo),
    banner: serializeImage(shop.banner),
    description: shop.description ? serializeText(shop.description) : undefined,
    district: shop.address?.district || '',
    ratingAverage: shop.ratingAverage,
    ratingCount: shop.ratingCount,
  };
}

// A product as shoppers see it: no cost prices, review notes or internal flags.
// Pass { withDescription: false } for lists to keep responses small.
function serializePublicProduct(product, { withDescription = true } = {}) {
  const result = {
    id: String(product._id),
    slug: product.slug,
    name: serializeText(product.name),
    images: (product.images || []).map(serializeImage),
    minPrice: product.minPrice,
    weightGrams: product.weightGrams,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    shop: serializePublicShop(product.shop),
    variants: product.variants.map((variant) => serializeVariant(variant, false)),
  };
  if (withDescription) {
    result.description = serializeText(product.description);
    result.category = product.category?.name
      ? { id: String(product.category._id), slug: product.category.slug, name: serializeText(product.category.name) }
      : null;
  }
  return result;
}

module.exports = {
  serializeUser,
  serializeShop,
  serializeCategory,
  serializeProduct,
  serializePublicShop,
  serializePublicProduct,
};
