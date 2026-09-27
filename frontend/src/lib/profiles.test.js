import { isProfileComplete, profilePayload, updateProfile } from "./profiles";
import { getSupabase } from "./supabase";
jest.mock("./supabase", () => ({ getSupabase: jest.fn() }));

const values = {
  first_name: " Ada ", last_name: "Test", medical_school: "Example University",
  specialty: "Internal Medicine", applicant_type: "US MD", graduation_year: "2026",
  current_status: "Graduate", interview_season: "2026–2027",
};

test("only sends validated editable fields, never identity, email or entitlements", () => {
  const payload = profilePayload({ ...values, id: "someone-else", email: "other@example.test", plan: "pro", created_at: "forged" });
  expect(payload).toEqual({ ...values, first_name: "Ada", graduation_year: 2026 });
});

test.each([{}, { ...values, first_name: " " }, { ...values, applicant_type: "admin" },
  { ...values, graduation_year: "2026.1" }, { ...values, graduation_year: "1800" },
  { ...values, medical_school: "x".repeat(201) }])("incomplete/invalid profiles cannot complete onboarding: %j", (profile) => {
  expect(isProfileComplete(profile)).toBe(false);
});

test("complete profile passes onboarding", () => expect(isProfileComplete(values)).toBe(true));

test("save uses verified auth user rather than caller supplied ID", async () => {
  const single = jest.fn().mockResolvedValue({ data: values, error: null });
  const select = jest.fn(() => ({ single }));
  const eq = jest.fn(() => ({ select }));
  const update = jest.fn(() => ({ eq }));
  getSupabase.mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: () => ({ update }) });
  await updateProfile({ ...values, id: "victim" });
  expect(eq).toHaveBeenCalledWith("id", "owner");
  expect(update.mock.calls[0][0]).not.toHaveProperty("id");
});

test("signed-out save never touches the database", async () => {
  const from = jest.fn();
  getSupabase.mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) }, from });
  await expect(updateProfile(values)).rejects.toThrow("sign in again");
  expect(from).not.toHaveBeenCalled();
});
