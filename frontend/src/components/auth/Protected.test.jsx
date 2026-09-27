import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Protected from "./Protected";
import { useAuth } from "@/context/AuthContext";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ getSupabase: jest.fn() }));
let element, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement("div"); document.body.appendChild(element); root = createRoot(element);
});
afterEach(() => { act(() => root.unmount()); element.remove(); });
const profile = { first_name: "A", last_name: "B", medical_school: "School", specialty: "Medicine", applicant_type: "US MD", graduation_year: 2026, current_status: "Graduate", interview_season: "2026–2027" };
function render(state, path = "/dashboard", requireOnboarding = true) {
  useAuth.mockReturnValue(state);
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<p>LOGIN PAGE</p>} />
    <Route path="/onboarding" element={<p>ONBOARDING PAGE</p>} />
    <Route path={path} element={<Protected requireOnboarding={requireOnboarding}><p>PRIVATE CONTENT</p></Protected>} />
  </Routes></MemoryRouter>));
}
test.each(["/dashboard", "/practice", "/programs", "/progress", "/my-story"])("signed-out %s redirects to login", (path) => {
  render({ user: null, loading: false }, path);
  expect(element.textContent).toContain("LOGIN PAGE");
  expect(element.textContent).not.toContain("PRIVATE CONTENT");
});
test("waits for session restoration", () => { render({ loading: true }); expect(element.textContent).toContain("Restoring"); });
test("waits for profile", () => { render({ user: { id: "a" }, profileLoading: true }); expect(element.textContent).toContain("Loading your profile"); });
test("incomplete profile redirects to onboarding", () => { render({ user: { id: "a" }, profile: {} }); expect(element.textContent).toContain("ONBOARDING PAGE"); });
test("profile failure does not grant access", () => { render({ user: { id: "a" }, profileError: "Try again" }); expect(element.textContent).toContain("Retry"); expect(element.textContent).not.toContain("PRIVATE CONTENT"); });
test("complete authenticated user can see private content", () => { render({ user: { id: "a" }, profile }); expect(element.textContent).toContain("PRIVATE CONTENT"); });
test("onboarding guard allows signed-in incomplete profile", () => { render({ user: { id: "a" }, profile: {} }, "/setup-test", false); expect(element.textContent).toContain("PRIVATE CONTENT"); });
