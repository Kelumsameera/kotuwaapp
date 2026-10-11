"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// React hook: loads what the POS needs to start (shop, logged-in user, today's date).
// Returns { session, error }.
export function usePosSession() {
  const [state, setState] = useState({ session: null, error: null });

  useEffect(() => {
    api("/pos/session")
      .then((session) => setState({ session, error: null }))
      .catch((error) => setState({ session: null, error }));
  }, []);

  return state;
}
