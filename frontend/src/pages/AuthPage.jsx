import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authRedirect, getSupabase, isSupabaseConfigured, signInWithGoogle } from "@/lib/supabase";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const copy = {
  login: ["Welcome back", "Sign in to your private MatchPrep workspace.", "Sign in"],
  signup: ["Create your account", "Start with your account, then tell us a little about your application.", "Create account"],
  forgot: ["Forgot your password?", "We'll email you a link to reset it.", "Send reset link"],
  reset: ["Choose a new password", "Use at least 8 characters for your new password.", "Update password"],
};

export default function AuthPage({ mode }) {
  const { user, loading, authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, description, label] = copy[mode];
  const hasPassword = mode !== "forgot";
  const isNewPassword = mode === "signup" || mode === "reset";
  const callbackFailed = new URLSearchParams(window.location.hash.slice(1)).has("error") || new URLSearchParams(window.location.search).has("error");

  if (loading) return <AuthLayout title={title} description="Restoring your session…" />;
  if (user && (mode === "login" || mode === "signup")) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (isNewPassword && password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const client = getSupabase();
      let result;
      if (mode === "login") result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (mode === "signup") {
        result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect("/auth/callback") } });
      }
      if (mode === "forgot") result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect("/reset-password") });
      if (mode === "reset") result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) setMessage("Check your email for a verification link. If you already have an account, sign in or reset your password.");
      if (mode === "forgot") setMessage("If an account exists for this email, a password reset link will arrive shortly. Check your spam folder too.");
      if (mode === "reset") { setMessage("Your password has been updated."); setPassword(""); setConfirm(""); }
      if (mode === "login" || (mode === "signup" && result.data.session)) navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true); setError("");
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) throw oauthError;
    } catch (err) { setError(err.message || "Google sign-in could not start."); setBusy(false); }
  };
  const unavailableReset = mode === "reset" && (!user || callbackFailed || authError);

  return (
    <AuthLayout title={title} description={description}>
      {!isSupabaseConfigured && <p role="alert" className="mb-4 text-sm text-rose-700">Supabase not configured</p>}
      {(error || authError || callbackFailed) && <p role="alert" className="mb-4 text-sm text-rose-700">{error || authError || "This sign-in link is invalid or expired. Please request a new link."}</p>}
      {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {unavailableReset ? (
        <p className="text-sm text-slate-600">Open a valid password reset link from your email. <Link className="text-rose-700 underline" to="/forgot-password">Request a new link</Link></p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {mode !== "reset" && <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
            <Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>}
          {hasPassword && <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
            <Input id="password" type="password" autoComplete={isNewPassword ? "new-password" : "current-password"} required minLength={isNewPassword ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>}
          {isNewPassword && <div>
            <label htmlFor="confirm" className="text-sm font-medium text-slate-700">Confirm password</label>
            <Input id="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
          </div>}
          <Button type="submit" disabled={busy || !isSupabaseConfigured} className="w-full rounded-full bg-gradient-to-r from-rose-600 to-pink-600">{busy ? "Please wait…" : label}</Button>
        </form>
      )}
      {(mode === "login" || mode === "signup") && <Button type="button" variant="outline" disabled={busy || !isSupabaseConfigured} onClick={google} className="mt-3 w-full rounded-full border-rose-200">Continue with Google</Button>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-rose-700">
        {mode === "login" ? <><Link to="/signup">Create an account</Link><Link to="/forgot-password">Forgot password?</Link></> : <Link to="/login">Back to sign in</Link>}
        {mode === "reset" && user && <Link to="/dashboard">Continue to dashboard</Link>}
      </div>
    </AuthLayout>
  );
}
