import { createClient } from "@supabase/supabase-js";

const url = (process.env.REACT_APP_SUPABASE_URL || "").trim();
const publishableKey = (process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || "").trim();
export const isSupabaseConfigured = Boolean(url && publishableKey);
if (!isSupabaseConfigured) {
  // Report missing build-time configuration without printing either value.
  console.warn("Supabase not configured");
}
let client;

export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Browser-only CRA app: supports email links opened in a different browser.
        flowType: "implicit",
      },
    });
  }
  return client;
}

export const authRedirect = (path) => `${window.location.origin}${path}`;

export function signInWithGoogle() {
  return getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirect("/auth/callback"),
      // OAuth is a browser navigation, so the SDK's fetch headers do not travel
      // with it. Supply the public project key through the SDK URL builder.
      queryParams: { apikey: publishableKey },
    },
  });
}
