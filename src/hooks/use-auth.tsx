import { useEffect, useState, useCallback } from "react";
import { api, authStorage, type AuthUser } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = authStorage.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res ? res.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleAuthChange = () => {
      refreshUser();
    };

    window.addEventListener("roadwatch_auth_change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("roadwatch_auth_change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, [refreshUser]);

  const signOut = useCallback(() => {
    api.signOut();
    setUser(null);
  }, []);

  const isAdmin = !!(user && user.role === "admin");

  return {
    user,
    loading,
    isAdmin,
    signOut,
    refreshUser,
  };
}
