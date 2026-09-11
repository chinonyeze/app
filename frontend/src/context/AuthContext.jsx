import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, logout as apiLogout } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try { const u = await getMe(); setUser(u); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Skip check if callback in progress
    if (window.location.hash?.includes("session_id=")) { setLoading(false); return; }
    check();
  }, [check]);

  const logout = async () => { await apiLogout(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, refresh: check }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
