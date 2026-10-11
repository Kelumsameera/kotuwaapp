"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// React hook for admin/seller lists: loads `${path}?page=..&limit=..&<filters>`.
// Returns { data, error, page, setPage, reload }.
export function usePagedList(path, filters, limit = 20) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let isCancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    for (const [key, value] of Object.entries(JSON.parse(filterKey))) {
      if (value) params.set(key, value);
    }

    api(`${path}?${params}`)
      .then((result) => {
        if (isCancelled) return;
        setData(result);
        setError(null);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, [path, filterKey, page, limit, reloadCount]);

  // Loads the same page again (after an approve/reject).
  function reload() {
    setReloadCount((count) => count + 1);
  }

  return { data, error, page, setPage, reload, pageCount: data ? Math.max(1, Math.ceil(data.total / limit)) : 1 };
}
