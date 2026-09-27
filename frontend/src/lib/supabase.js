import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(url && key);
let client;

export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error("Sign-in is not configured yet. Please try again later.");
  }
  if (!client) {
    client = createClient(url, key, {
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
