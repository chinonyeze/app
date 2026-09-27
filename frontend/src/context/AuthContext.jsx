import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);
// DEVELOPMENT/PREVIEW ONLY. This is a UI fixture, never real authentication.
// CRA fixes NODE_ENV to production for builds, including Vercel preview builds.
export const isDevelopmentPreview = process.env.NODE_ENV === "development";
const previewUser = isDevelopmentPreview ? {
  id: "preview-user",
  name: "Preview User",
  email: "preview@local",
  plan: "pro",
} : null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(previewUser);
  const check = useCallback(async () => { setUser(previewUser); }, []);
  const logout = async () => { setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading: false, logout, refresh: check }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
