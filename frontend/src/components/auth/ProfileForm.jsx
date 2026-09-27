import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APPLICANT_TYPES, PROFILE_FIELDS, updateProfile } from "@/lib/profiles";

export default function ProfileForm({ profile, onSaved, submitLabel = "Save profile" }) {
  const [values, setValues] = useState(profile || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setValues((previous) => ({ ...previous, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const saved = await updateProfile(values); onSaved(saved); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="space-y-6">
      <p className="text-sm text-slate-600">Account email: <span className="font-medium">{profile?.email}</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_FIELDS.map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`profile-${key}`} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
            {key === "applicant_type" ? (
              <select id={`profile-${key}`} required value={values[key] || ""} onChange={(e) => set(key, e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="" disabled>Select applicant type</option>
                {APPLICANT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            ) : (
              <Input id={`profile-${key}`} required maxLength={200} type={key === "graduation_year" ? "number" : "text"}
                min={key === "graduation_year" ? 1900 : undefined} max={key === "graduation_year" ? 2100 : undefined}
                step={key === "graduation_year" ? 1 : undefined}
                autoComplete={key === "first_name" ? "given-name" : key === "last_name" ? "family-name" : "off"}
                placeholder={key === "current_status" ? "e.g. Final-year student, graduate, resident" : key === "interview_season" ? "e.g. 2026–2027" : undefined}
                value={values[key] ?? ""} onChange={(e) => set(key, e.target.value)} className="mt-1" />
            )}
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <Button type="submit" disabled={busy} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600">{busy ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
