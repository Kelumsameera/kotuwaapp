// A guest's cart lives in the browser until they log in: [{ productId, variantId, quantity }].
// Only ids and quantities are kept; prices always come fresh from the API.

const STORAGE_KEY = "kotuwa_guest_cart";

// Reads the guest cart. Returns [] if storage is empty, broken or blocked.
export function readGuestCart() {
  try {
    const items = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(items) ? items.filter((item) => item.productId && item.variantId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

// Saves the guest cart (ignores storage errors, e.g. private browsing).
export function writeGuestCart(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Nothing else to do: the cart just won't survive a reload.
  }
}

// Empties the guest cart (after it is moved into the account).
export function clearGuestCart() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
