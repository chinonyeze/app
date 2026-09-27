import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "./AuthPage";
import { useAuth } from "@/context/AuthContext";
import { getSupabase, signInWithGoogle } from "@/lib/supabase";
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ isSupabaseConfigured: true, getSupabase: jest.fn(), signInWithGoogle: jest.fn(), authRedirect: (path) => `http://localhost${path}` }));
let root, element, auth;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement("div"); document.body.appendChild(element); root = createRoot(element);
  useAuth.mockReturnValue({ user: null, loading: false });
  auth = Object.fromEntries(["signInWithPassword", "signUp", "resetPasswordForEmail", "updateUser", "signInWithOAuth"].map((method) => [method, jest.fn().mockResolvedValue({ data: {}, error: null })]));
  getSupabase.mockReturnValue({ auth });
  signInWithGoogle.mockReset().mockResolvedValue({ data: {}, error: null });
});
afterEach(() => { act(() => root.unmount()); element.remove(); });
const render = (mode) => act(() => root.render(<MemoryRouter><AuthPage mode={mode} /></MemoryRouter>));
function fill(id, value) {
  const input = element.querySelector(`#${id}`);
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () => act(async () => element.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

test("signup requires matching passwords before contacting Supabase", async () => {
  render("signup"); fill("email", "test@example.invalid"); fill("password", "test-only-password"); fill("confirm", "different-test-password"); await submit();
  expect(auth.signUp).not.toHaveBeenCalled(); expect(element.textContent).toContain("do not match");
});
test("signup without session asks for email verification", async () => {
  render("signup"); fill("email", "test@example.invalid"); fill("password", "test-only-password"); fill("confirm", "test-only-password"); await submit();
  expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: "http://localhost/auth/callback" } }));
  expect(element.textContent).toContain("Check your email");
});
test("invalid password login shows an error and re-enables submission", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
  render("login"); fill("email", "test@example.invalid"); fill("password", "test-only-password"); await submit();
  expect(element.textContent).toContain("Invalid login credentials"); expect(element.querySelector('[type="submit"]').disabled).toBe(false);
});
test("forgot password sends exact reset redirect and shows neutral confirmation", async () => {
  render("forgot"); fill("email", "test@example.invalid"); await submit();
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.invalid", { redirectTo: "http://localhost/reset-password" });
  expect(element.textContent).toContain("If an account exists");
});
test("reset without a session cannot submit a new password", () => {
  render("reset"); expect(element.querySelector("form")).toBe(null); expect(element.textContent).toContain("Request a new link");
});
test("recovered session can update password", async () => {
  useAuth.mockReturnValue({ user: { id: "test-user" }, loading: false });
  render("reset"); fill("password", "test-only-password"); fill("confirm", "test-only-password"); await submit();
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "test-only-password" }); expect(element.textContent).toContain("password has been updated");
});
test("Google button uses Supabase OAuth and the app callback", async () => {
  render("login");
  await act(async () => Array.from(element.querySelectorAll("button")).find((button) => button.textContent.includes("Google")).click());
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
});
