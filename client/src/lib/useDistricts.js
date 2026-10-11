"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// The district list rarely changes, so it is loaded once per page visit and shared.
let districtsPromise = null;

// Loads the districts (with cities) from the API.
function loadDistricts() {
  if (!districtsPromise) {
    districtsPromise = api("/locations/districts")
      .then((data) => data.districts)
      .catch(() => {
        districtsPromise = null;
        return [];
      });
  }
  return districtsPromise;
}

// React hook: returns the district list ([] while loading).
export function useDistricts() {
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    let isCancelled = false;
    loadDistricts().then((list) => {
      if (!isCancelled) setDistricts(list);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  return districts;
}
