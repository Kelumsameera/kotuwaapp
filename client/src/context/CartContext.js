"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/apiClient";
import { clearGuestCart, readGuestCart, writeGuestCart } from "@/lib/guestCart";

const CartContext = createContext(null);
const EMPTY_CART = { shops: [], itemCount: 0, subtotal: 0 };

// Who can use a cart: guests (kept in the browser) and customers (kept on the server).
// Sellers, cashiers, riders and admins cannot buy with their staff accounts.
function cartModeFor(user) {
  if (!user) return "guest";
  if (user.role === "customer") return "customer";
  return "none";
}

// Asks the API for fresh prices and stock for the guest's items.
async function previewGuestItems(items) {
  if (items.length === 0) return EMPTY_CART;
  const data = await api("/catalog/cart-preview", { method: "POST", body: { items } });
  return data.cart;
}

// Finds the line for a variant in a cart view.
function findLine(cart, variantId) {
  for (const shop of cart.shops) {
    const line = shop.items.find((item) => item.variantId === variantId);
    if (line) return line;
  }
  return null;
}

// Keeps the cart for the whole site: loads it, and adds/changes/removes items.
export function CartProvider({ children }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const mode = cartModeFor(user);
  const [cart, setCart] = useState(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);
  // Bumped to load the cart again (e.g. after an order empties it on the server).
  const [reloadCount, setReloadCount] = useState(0);

  // Loads the cart whenever the logged-in user changes. A customer who just logged in
  // gets their guest cart moved into their account first.
  useEffect(() => {
    if (isAuthLoading) return undefined;
    let isCancelled = false;

    async function load() {
      if (mode === "none") return EMPTY_CART;
      if (mode === "guest") return previewGuestItems(readGuestCart());

      const guestItems = readGuestCart();
      if (guestItems.length > 0) {
        const merged = await api("/cart/merge", { method: "POST", body: { items: guestItems } });
        clearGuestCart();
        return merged.cart;
      }
      return (await api("/cart")).cart;
    }

    load()
      .catch(() => EMPTY_CART)
      .then((loaded) => {
        if (isCancelled) return;
        setCart(loaded);
        setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [mode, isAuthLoading, user?.id, reloadCount]);

  // Loads the cart again from the server.
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Changes a guest's cart: saves the new list only if the API says every item can be bought.
  const changeGuestCart = useCallback(async (newItems, changedVariantId) => {
    const preview = await previewGuestItems(newItems);
    const line = findLine(preview, changedVariantId);
    if (line?.problem) {
      throw new ApiError(409, line.problem === "UNAVAILABLE" ? "PRODUCT_NOT_AVAILABLE" : "NOT_ENOUGH_STOCK", "", {
        available: line.availableStock,
      });
    }
    writeGuestCart(newItems);
    setCart(preview);
  }, []);

  // Adds a quantity of a variant to the cart.
  const addItem = useCallback(
    async ({ productId, variantId, quantity }) => {
      if (mode === "customer") {
        const data = await api("/cart/items", { method: "POST", body: { productId, variantId, quantity } });
        setCart(data.cart);
        return;
      }
      const items = readGuestCart();
      const existing = items.find((item) => item.variantId === variantId);
      const newItems = existing
        ? items.map((item) => (item.variantId === variantId ? { ...item, quantity: item.quantity + quantity } : item))
        : [...items, { productId, variantId, quantity }];
      await changeGuestCart(newItems, variantId);
    },
    [mode, changeGuestCart]
  );

  // Sets the quantity of an item already in the cart.
  const setQuantity = useCallback(
    async (variantId, quantity) => {
      if (mode === "customer") {
        const data = await api(`/cart/items/${variantId}`, { method: "PATCH", body: { quantity } });
        setCart(data.cart);
        return;
      }
      const newItems = readGuestCart().map((item) => (item.variantId === variantId ? { ...item, quantity } : item));
      await changeGuestCart(newItems, variantId);
    },
    [mode, changeGuestCart]
  );

  // Removes an item from the cart.
  const removeItem = useCallback(
    async (variantId) => {
      if (mode === "customer") {
        const data = await api(`/cart/items/${variantId}`, { method: "DELETE" });
        setCart(data.cart);
        return;
      }
      const newItems = readGuestCart().filter((item) => item.variantId !== variantId);
      writeGuestCart(newItems);
      setCart(await previewGuestItems(newItems));
    },
    [mode]
  );

  const value = useMemo(
    () => ({ cart, isLoading, canShop: mode !== "none", addItem, setQuantity, removeItem, reload }),
    [cart, isLoading, mode, addItem, setQuantity, removeItem, reload]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Gives any client component access to the cart.
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
