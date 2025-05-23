import { useState, useEffect } from "react";
import { isAuthenticated, getUser, logout, User } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(getUser());
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated());

  useEffect(() => {
    // Update state when auth status changes
    const checkAuth = () => {
      setUser(getUser());
      setAuthenticated(isAuthenticated());
    };

    // Check initially
    checkAuth();

    // Set up event listener for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return {
    user,
    isAuthenticated: authenticated,
    logout,
  };
}
