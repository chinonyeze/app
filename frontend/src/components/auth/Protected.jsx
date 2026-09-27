import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isProfileComplete } from "@/lib/profiles";
import AuthLayout from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Protected({ children, requireOnboarding = true }) {
  const { user, loading, profile, profileLoading, profileError, refresh, logout } = useAuth();
  if (loading) return <div role="status" className="p-12 text-center text-slate-600">Restoring your session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <div role="status" className="p-12 text-center text-slate-600">Loading your profile…</div>;
  if (profileError) return (
    <AuthLayout title="Your profile is unavailable" description={profileError}>
      <div className="flex gap-3">
        <Button onClick={refresh}>Retry</Button>
        <Button variant="outline" onClick={() => logout().catch((error) => toast.error(error.message))}>Sign out</Button>
      </div>
    </AuthLayout>
  );
  if (requireOnboarding && !isProfileComplete(profile)) return <Navigate to="/onboarding" replace />;
  return children;
}
