import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import AppShell from "@/pages/AppShell";
import Dashboard from "@/pages/Dashboard";
import Practice from "@/pages/Practice";
import Programs from "@/pages/Programs";
import Progress from "@/pages/Progress";
import MyStory from "@/pages/MyStory";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { exchangeSession } from "@/lib/api";

function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  useEffect(() => {
    const hash = location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/", { replace: true }); return; }
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    exchangeSession(m[1])
      .then((user) => {
        setUser(user);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true });
      })
      .catch(() => navigate("/", { replace: true }));
  }, [location.hash, navigate, setUser]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-50">
      <div className="text-rose-700 font-semibold" data-testid="auth-callback-loading">Signing you in…</div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/my-story" element={<MyStory />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
