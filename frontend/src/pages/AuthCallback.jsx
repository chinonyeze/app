import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AuthCallback() {
  const { loading, user, authError } = useAuth();
  const failed = new URLSearchParams(window.location.hash.slice(1)).has("error") || new URLSearchParams(window.location.search).has("error");
  if (loading) return <AuthLayout title="Signing you in" description="Verifying your session…" />;
  if (!failed && !authError && user) return <Navigate to="/dashboard" replace />;
  return <AuthLayout title="Sign-in could not finish" description="Your link may be expired or already used. Try signing in again, or request a new password reset link.">
    <Link to="/login" className="text-rose-700 underline">Back to sign in</Link>
  </AuthLayout>;
}
