import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { progressSummary, listSessions } from "@/lib/api";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Flame, Target, TrendingUp } from "lucide-react";

const CATS = ["content","conciseness","confidence","specialty_knowledge","program_knowledge","behavioral","body_language"];

export default function Progress() {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    progressSummary().then(setSummary).catch(() => {});
    listSessions().then(setSessions).catch(() => {});
  }, []);

  const data = CATS.map((c) => ({ subject: c.replaceAll("_"," "), score: summary?.categories?.[c] || 0 }));

  return (
    <div className="space-y-8" data-testid="progress-view">
      <div>
        <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Progress</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Your readiness dashboard</h1>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 stagger">
        <Card className="rounded-2xl border-rose-100/70"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><Target className="w-3.5 h-3.5"/>Overall readiness</div>
          <div className="mt-2 text-3xl font-display font-extrabold text-slate-900">{summary?.overall_readiness ?? 0}%</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-rose-100/70"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><Flame className="w-3.5 h-3.5"/>Streak</div>
          <div className="mt-2 text-3xl font-display font-extrabold text-slate-900">{summary?.streak_days ?? 0}</div>
        </CardContent></Card>
        <Card className="rounded-2xl border-rose-100/70"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><TrendingUp className="w-3.5 h-3.5"/>Weakest area</div>
          <div className="mt-2 text-xl font-display font-bold text-slate-900 capitalize">{(summary?.weakest || "content").replaceAll("_"," ")}</div>
        </CardContent></Card>
      </div>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold mb-3">7-category radar</div>
          <div style={{ width: "100%", height: 340 }}>
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="#FECDD3"/>
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#334155", fontSize: 12 }}/>
                <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fill: "#94A3B8", fontSize: 10 }}/>
                <Radar dataKey="score" stroke="#E11D48" fill="#E11D48" fillOpacity={0.35}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold mb-3">Session history</div>
          {sessions.length === 0 && <div className="text-sm text-slate-500">Complete a mock interview to see history here.</div>}
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div key={s.session_id} className="py-3 flex items-center justify-between gap-4" data-testid={`session-row-${s.session_id}`}>
                <div>
                  <div className="text-sm font-medium text-slate-800 capitalize">{(s.personality||"").replaceAll("_"," ")} · {(s.mode||"").replaceAll("_"," ")}</div>
                  <div className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  {s.scores ? (
                    <div className="text-xs text-slate-600">Content <span className="font-semibold text-slate-900">{s.scores.content ?? "—"}</span> · Confidence <span className="font-semibold text-slate-900">{s.scores.confidence ?? "—"}</span></div>
                  ) : <span className="text-xs text-amber-700">Unscored</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
