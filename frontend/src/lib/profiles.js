import { getSupabase } from "./supabase";

export const APPLICANT_TYPES = ["US MD", "US DO", "US IMG", "Non-US IMG", "Other"];
export const PROFILE_FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["medical_school", "Medical school"],
  ["specialty", "Specialty applying to"],
  ["applicant_type", "Applicant type"],
  ["graduation_year", "Graduation year"],
  ["current_status", "Current status"],
  ["interview_season", "Interview season"],
];

export function profilePayload(values) {
  const result = Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, String(values[key] ?? "").trim()]));
  if (Object.values(result).some((value) => !value)) throw new Error("Please complete every profile field.");
  if (Object.values(result).some((value) => value.length > 200)) throw new Error("Please keep each field to 200 characters or fewer.");
  if (!APPLICANT_TYPES.includes(result.applicant_type)) throw new Error("Choose a valid applicant type.");
  if (!/^\d{4}$/.test(result.graduation_year) || Number(result.graduation_year) < 1900 || Number(result.graduation_year) > 2100) {
    throw new Error("Enter a graduation year between 1900 and 2100.");
  }
  return { ...result, graduation_year: Number(result.graduation_year) };
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  try { profilePayload(profile); return true; } catch { return false; }
}

export async function loadProfile(userId) {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error("Your profile could not be loaded. Please retry. If this continues, contact support.");
  return data;
}

export async function updateProfile(values) {
  const client = getSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Please sign in again before saving your profile.");
  // Only editable fields are sent. IDs, email and timestamps are server-controlled.
  const { data, error } = await client.from("profiles").update(profilePayload(values)).eq("id", user.id).select().single();
  if (error) throw new Error("Your profile could not be saved. Please retry.");
  return data;
}
