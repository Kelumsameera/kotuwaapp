"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// React hook: loads the logged-in seller's shop.
// Returns { shop, setShop, isLoading, hasNoShop, error }.
export function useMyShop() {
  const [state, setState] = useState({ shop: null, isLoading: true, hasNoShop: false, error: null });

  useEffect(() => {
    let isCancelled = false;
    api("/seller/shop")
      .then((data) => {
        if (!isCancelled) setState({ shop: data.shop, isLoading: false, hasNoShop: false, error: null });
      })
      .catch((error) => {
        if (isCancelled) return;
        const hasNoShop = error.code === "SHOP_NOT_FOUND";
        setState({ shop: null, isLoading: false, hasNoShop, error: hasNoShop ? null : error });
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Replaces the shop after it is created or saved.
  function setShop(shop) {
    setState({ shop, isLoading: false, hasNoShop: false, error: null });
  }

  return { ...state, setShop };
}
