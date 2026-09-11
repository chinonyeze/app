import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProfile, saveProfile, generateQuestions, getQuestions } from "@/lib/api";
import { toast } from "sonner";
import { Save, Sparkles } from "lucide-react";

const FIELDS = [
  ["specialty", "Specialty", "e.g. Internal Medicine"],
  ["medical_school", "Medical school", "e.g. Boston University"],
  ["graduation_year", "Graduation year", "e.g. 2026"],
  ["usmle_step1", "USMLE Step 1", "P/F or 3-digit"],
  ["usmle_step2", "USMLE Step 2 CK", "3-digit score"],
  ["comlex_level1", "COMLEX Level 1", "if applicable"],
  ["comlex_level2", "COMLEX Level 2", "if applicable"],
  ["interview_date", "Next interview date (YYYY-MM-DD)", "2026-03-12"],
];

const LONG = [
  ["clinical_experiences", "Clinical experiences"],
  ["research", "Research"],
  ["publications", "Publications"],
  ["leadership", "Leadership"],
  ["volunteer", "Volunteer work"],
  ["hobbies", "Hobbies / interests"],
  ["geographic_preferences", "Geographic preferences"],
  ["programs_applied", "Programs applied to"],
  ["personal_statement", "Personal statement"],
];

export default function MyStory() {
  const [p, setP] = useState({});
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState([]);
  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    getProfile().then(setP).catch(() => {});
    getQuestions().then((d) => setBank(d.questions || [])).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try { await saveProfile(p); toast.success("Saved"); }
    catch { toast.error("Save failed"); }
    finally { setBusy(false); }
  };
  const gen = async () => {
    setBusy(true);
    try { const r = await generateQuestions(); setBank(r.questions || []); toast.success("Questions generated"); }
    catch { toast.error("Generate failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8" data-testid="mystory-view">
      <div>
        <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">My Story</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Your application, ready to talk about.</h1>
        <p className="mt-2 text-slate-600">Fill this in once. Every mock interview and question bank draws from here.</p>
      </div>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {FIELDS.map(([k, label, ph]) => (
              <div key={k}>
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
                <Input data-testid={`field-${k}`} value={p[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="mt-1"/>
              </div>
            ))}
          </div>
          <div className="grid gap-4 mt-6">
            {LONG.map(([k, label]) => (
              <div key={k}>
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
                <Textarea data-testid={`field-${k}`} value={p[k] || ""} onChange={(e) => set(k, e.target.value)} rows={k === "personal_statement" ? 6 : 3} className="mt-1"/>
              </div>
            ))}
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
            <input data-testid="consent-toggle" type="checkbox" checked={!!p.consent_feedback} onChange={(e) => set("consent_feedback", e.target.checked)}/>
            I consent to sharing anonymized pre/post-evaluation feedback so matchprepai can improve.
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button data-testid="save-profile" onClick={save} disabled={busy} className="rounded-full bg-slate-900 hover:bg-slate-800"><Save className="w-4 h-4 mr-1"/>Save profile</Button>
            <Button data-testid="generate-questions" onClick={gen} disabled={busy} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600"><Sparkles className="w-4 h-4 mr-1"/>Generate my question bank</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Personalized question bank</div>
          {bank.length === 0 && <div className="mt-3 text-sm text-slate-500">Save your profile then click Generate to build a personalized question bank.</div>}
          <div className="mt-4 space-y-3">
            {bank.map((q, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-4" data-testid={`question-${i}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-900">{q.q}</div>
                  <Badge variant="outline" className="rounded-full capitalize">{q.category}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-1">Why asked: {q.why_asked}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
