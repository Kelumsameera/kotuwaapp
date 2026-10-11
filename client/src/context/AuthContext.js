"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { api, refreshSession } from "@/lib/apiClient";
import { saveLocaleCookie } from "@/lib/localeCookie";

const AuthContext = createContext(null);

// Refresh a little before the 15-minute access token runs out.
const REFRESH_EVERY_MS = 13 * 60 * 1000;

// Asks the server who is logged in (refreshing the session if needed). Returns the user or null.
async function fetchCurrentUser() {
  try {
    const data = await api("/users/me");
    return data.user;
  } catch {
    return null;
  }
}

// Keeps the logged-in user available to every page and refreshes tokens automatically.
export function AuthProvider({ children }) {
  const router = useRouter();
  const currentLocale = useLocale();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Switches the site language to the user's saved language after login.
  const applyUserLanguage = useCallback(
    (loggedInUser) => {
      if (loggedInUser?.preferredLanguage && loggedInUser.preferredLanguage !== currentLocale) {
        saveLocaleCookie(loggedInUser.preferredLanguage);
        router.refresh();
      }
    },
    [currentLocale, router]
  );

  // Re-reads the current user from the server (e.g. after a profile change).
  const loadUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  // On first load, find out who is logged in.
  useEffect(() => {
    let isCancelled = false;
    fetchCurrentUser().then((currentUser) => {
      if (isCancelled) return;
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // While logged in, quietly get a new access token before the old one expires.
  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(async () => {
      const refreshedUser = await refreshSession();
      setUser(refreshedUser);
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [user]);

  // Logs in and stores the user.
  const login = useCallback(
    async (email, password) => {
      const data = await api("/auth/login", { method: "POST", body: { email, password } });
      setUser(data.user);
      applyUserLanguage(data.user);
      return data.user;
    },
    [applyUserLanguage]
  );

  // Logs out on the server and forgets the user.
  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, setUser, reloadUser: loadUser }),
    [user, isLoading, login, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Gives any client component access to { user, isLoading, login, logout, ... }.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
