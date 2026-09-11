import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, BookOpen, Sparkles } from "lucide-react";
import { listPrograms, createProgram, deleteProgram, knowProgram, whyUs } from "@/lib/api";
import { toast } from "sonner";

export default function Programs() {
  const [progs, setProgs] = useState([]);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [know, setKnow] = useState(null);
  const [knowFor, setKnowFor] = useState(null);
  const [why, setWhy] = useState(null);
  const [whyReasons, setWhyReasons] = useState("");
  const [whyProgram, setWhyProgram] = useState("");

  const refresh = () => listPrograms().then(setProgs).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await createProgram({ name, specialty, city }); setName(""); setSpecialty(""); setCity(""); refresh(); toast.success("Program added"); }
    catch { toast.error("Failed to add"); }
    finally { setBusy(false); }
  };

  const remove = async (id) => { await deleteProgram(id); refresh(); };

  const runKnow = async (p) => {
    setKnowFor(p.name); setKnow(null); setBusy(true);
    try { const r = await knowProgram({ program_name: p.name, specialty: p.specialty || "" }); setKnow(r); }
    catch { toast.error("Could not fetch briefing"); }
    finally { setBusy(false); }
  };

  const runWhy = async () => {
    if (!whyProgram.trim() || !whyReasons.trim()) return;
    setBusy(true); setWhy(null);
    try { const r = await whyUs({ program_name: whyProgram, reasons: whyReasons.split("\n").filter(Boolean) }); setWhy(r); }
    catch { toast.error("Could not build answer"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8" data-testid="programs-view">
      <div>
        <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Programs</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Program-specific prep</h1>
        <p className="mt-2 text-slate-600">Track programs, pull a "Know This Program" briefing, and build an authentic Why Us answer.</p>
      </div>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-4 gap-3">
            <Input data-testid="program-name-input" placeholder="Program name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input data-testid="program-specialty-input" placeholder="Specialty (e.g. IM)" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            <Input data-testid="program-city-input" placeholder="City / state" value={city} onChange={(e) => setCity(e.target.value)} />
            <Button data-testid="add-program-button" onClick={add} disabled={busy} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600"><Plus className="w-4 h-4 mr-1"/>Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {progs.map((p) => (
          <Card key={p.program_id} className="rounded-2xl border-rose-100/70 hover-lift" data-testid={`program-card-${p.program_id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-bold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{[p.specialty, p.city].filter(Boolean).join(" · ")}</div>
                </div>
                <button data-testid={`delete-program-${p.program_id}`} onClick={() => remove(p.program_id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4"/></button>
              </div>
              <Button data-testid={`know-program-${p.program_id}`} onClick={() => runKnow(p)} variant="outline" size="sm" className="mt-4 rounded-full border-rose-200"><BookOpen className="w-3.5 h-3.5 mr-1"/>Know this program</Button>
            </CardContent>
          </Card>
        ))}
        {progs.length === 0 && <div className="text-sm text-slate-500">Add your first program above.</div>}
      </div>

      {know && !know.raw && (
        <Card className="rounded-2xl border-rose-200" data-testid="know-program-result">
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Know this program — {knowFor}</div>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-700">
              <div><b>Mission:</b> {know.mission}</div>
              <div><b>Likely strengths:</b><ul className="list-disc pl-5 mt-1">{(know.likely_strengths||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div><b>Curriculum highlights:</b><ul className="list-disc pl-5 mt-1">{(know.curriculum_highlights||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div><b>Research opportunities:</b><ul className="list-disc pl-5 mt-1">{(know.research_opportunities||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div><b>Questions to ask PD:</b><ul className="list-disc pl-5 mt-1">{(know.suggested_questions_for_pd||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div><b>Questions to ask residents:</b><ul className="list-disc pl-5 mt-1">{(know.suggested_questions_for_residents||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div className="md:col-span-2 rounded-xl bg-amber-50 border border-amber-100 p-3"><b>Questions to avoid:</b><ul className="list-disc pl-5 mt-1">{(know.questions_to_avoid||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              <div className="md:col-span-2"><b>Why Us talking points:</b><ul className="list-disc pl-5 mt-1">{(know.why_us_talking_points||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6 space-y-3">
          <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Why Us — builder</div>
          <Input data-testid="whyus-program-input" placeholder="Program name" value={whyProgram} onChange={(e) => setWhyProgram(e.target.value)} />
          <Textarea data-testid="whyus-reasons-input" placeholder="One reason per line (3-5 reasons you genuinely like the program)" rows={5} value={whyReasons} onChange={(e) => setWhyReasons(e.target.value)} />
          <Button data-testid="whyus-generate" onClick={runWhy} disabled={busy} className="rounded-full bg-slate-900 hover:bg-slate-800"><Sparkles className="w-4 h-4 mr-1"/>Build authentic answer</Button>
          {why && !why.raw && (
            <div className="mt-4 space-y-3" data-testid="whyus-result">
              <div className="rounded-xl bg-rose-50/70 border border-rose-100 p-4 whitespace-pre-wrap text-sm text-slate-800">{why.answer}</div>
              {Array.isArray(why.warnings) && why.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800"><b>Generic phrases to fix:</b><ul className="list-disc pl-5 mt-1">{why.warnings.map((s,i)=><li key={i}>{s}</li>)}</ul></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
