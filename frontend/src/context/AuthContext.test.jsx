import { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext";
import { getSupabase } from "@/lib/supabase";
import { loadProfile } from "@/lib/profiles";

jest.mock("@/lib/supabase", () => ({ isSupabaseConfigured: true, getSupabase: jest.fn() }));
jest.mock("@/lib/profiles", () => ({ loadProfile: jest.fn() }));
let root, element, latest, emit, client;
function Probe() { latest = useAuth(); return <span>{latest.user?.name || "SIGNED OUT"}</span>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement("div"); document.body.appendChild(element); root = createRoot(element);
  client = { auth: {
    onAuthStateChange: jest.fn((callback) => { emit = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  } };
  getSupabase.mockReturnValue(client);
  loadProfile.mockReset();
});
afterEach(() => { act(() => root.unmount()); element.remove(); });
const mount = () => act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });
const session = (id) => ({ user: { id, email: `${id}@example.test` } });

test("no fixture user when Supabase has no session", async () => {
  await mount(); expect(latest.user).toBe(null); expect(latest.loading).toBe(false);
});
test("restores session and profile then clears both on cross-tab signout", async () => {
  client.auth.getSession.mockResolvedValue({ data: { session: session("a") } });
  loadProfile.mockResolvedValue({ id: "a", first_name: "Ada", last_name: "Test" });
  await mount(); expect(latest.user.name).toBe("Ada Test");
  await act(async () => emit("SIGNED_OUT", null));
  expect(latest.user).toBe(null); expect(latest.profile).toBe(null);
});
test("ignores profile response from a previous user", async () => {
  let resolveA;
  loadProfile.mockImplementation((id) => id === "a" ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ id: "b", first_name: "B" }));
  await mount();
  await act(async () => emit("SIGNED_IN", session("a")));
  await act(async () => emit("SIGNED_IN", session("b")));
  await act(async () => resolveA({ id: "a", first_name: "A" }));
  expect(latest.profile.id).toBe("b"); expect(latest.user.id).toBe("b");
});
test("failed logout surfaces error without pretending signout succeeded", async () => {
  client.auth.getSession.mockResolvedValue({ data: { session: session("a") } });
  loadProfile.mockResolvedValue({ id: "a" });
  client.auth.signOut.mockResolvedValue({ error: { message: "network" } });
  await mount(); await expect(latest.logout()).rejects.toThrow("Could not sign out");
  expect(latest.user.id).toBe("a");
});
test("recovery session is restored without requiring a completed profile", async () => {
  loadProfile.mockRejectedValue(new Error("profile unavailable"));
  await mount(); await act(async () => emit("PASSWORD_RECOVERY", session("a")));
  expect(latest.user.id).toBe("a"); expect(latest.profileError).toBe("profile unavailable");
});
