import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { AuthProvider, useAuth, isDevelopmentPreview } from "@/context/AuthContext";
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
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
          {isDevelopmentPreview && (
            <div role="status" className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
              DEVELOPMENT/PREVIEW ONLY — simulated Pro user. No real authentication, payments, or backend features.
            </div>
          )}
          <AppRouter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
