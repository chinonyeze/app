import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/components/auth/AuthLayout";
import ProfileForm from "@/components/auth/ProfileForm";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Onboarding() {
  const { profile, user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthLayout title="Tell us about you" description="Complete your private profile to open your MatchPrep dashboard.">
      <ProfileForm key={user.id} profile={profile} submitLabel="Save and open dashboard" onSaved={() => { refresh(); navigate("/dashboard", { replace: true }); }} />
      <Button variant="ghost" className="mt-4 text-slate-500" onClick={() => logout().catch((error) => toast.error(error.message))}>Sign out</Button>
    </AuthLayout>
  );
}
