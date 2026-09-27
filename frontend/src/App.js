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
import { AuthProvider } from "@/context/AuthContext";
import Protected from "@/components/auth/Protected";
import AuthPage from "@/pages/AuthPage";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
      <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<Protected requireOnboarding={false}><Onboarding /></Protected>} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/my-story" element={<MyStory />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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
