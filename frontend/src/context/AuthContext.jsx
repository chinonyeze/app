import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadProfile } from "@/lib/profiles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [record, setRecord] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setRecord((previous) => previous ? { ...previous, loading: true } : previous);
    setRevision((value) => value + 1);
  }, []);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let active = true;
    let authEvents = 0;
    let subscription;
    try {
      const client = getSupabase();
      // Keep this callback synchronous: database calls happen in the effect below.
      subscription = client.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        authEvents += 1;
        setSession(nextSession);
        setLoading(false);
        setAuthError("");
        if (event === "SIGNED_OUT") setRecord(null);
      }).data.subscription;
      client.auth.getSession().then(({ data, error }) => {
        // An auth event after startup wins over an older getSession result.
        if (!active || authEvents > 0) return;
        if (error) setAuthError("Your sign-in link or session could not be restored. Please sign in again or request a new link.");
        setSession(error ? null : data.session);
        setLoading(false);
      }).catch(() => {
        if (active) { setAuthError("Could not restore your session. Please try again."); setLoading(false); }
      });
    } catch {
      setAuthError("Sign-in configuration is unavailable. Please contact support.");
      setLoading(false);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) { setRecord(null); return; }
    let active = true;
    setRecord({ userId, loading: true });
    loadProfile(userId).then((profile) => {
      if (active) setRecord({ userId, profile, loading: false });
    }).catch((error) => {
      if (active) setRecord({ userId, error: error.message, loading: false });
    });
    return () => { active = false; };
  }, [userId, revision]);

  const logout = async () => {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) throw new Error("Could not sign out. Please try again.");
    setSession(null);
    setRecord(null);
  };
  const current = record?.userId === userId ? record : null;
  const profile = current?.profile || null;
  const user = session?.user ? {
    ...session.user,
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || session.user.email,
  } : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError,
      profileLoading: Boolean(userId && (!current || current.loading)),
      profileError: current?.error || "", logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
